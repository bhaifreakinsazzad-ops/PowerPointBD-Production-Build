-- Approval records bind the exact rendered source and content version.
BEGIN;
CREATE TABLE ai_presentation.preview_approvals (
  project_id uuid PRIMARY KEY REFERENCES ai_presentation.projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES ai_presentation.users(id),
  preview_job_id uuid NOT NULL UNIQUE REFERENCES ai_presentation.preview_requests(job_id),
  content_version integer NOT NULL,
  render_manifest jsonb NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(project_id,content_version) REFERENCES ai_presentation.content_drafts(project_id,version)
);
ALTER TABLE ai_presentation.preview_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY preview_approval_owner_select ON ai_presentation.preview_approvals FOR SELECT TO authenticated USING(owner_id=(SELECT auth.uid()));
CREATE POLICY preview_approval_owner_insert ON ai_presentation.preview_approvals FOR INSERT TO authenticated WITH CHECK(owner_id=(SELECT auth.uid()));
GRANT SELECT,INSERT ON ai_presentation.preview_approvals TO authenticated;
CREATE FUNCTION ai_presentation.guard_preview_approval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest integer; project_state text;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'PREVIEW_APPROVAL_IMMUTABLE'; END IF;
  NEW.approved_at=clock_timestamp();
  SELECT state INTO project_state FROM ai_presentation.projects WHERE id=NEW.project_id AND owner_id=NEW.owner_id FOR UPDATE;
  IF project_state <> 'preview_ready' THEN RAISE EXCEPTION 'PREVIEW_NOT_APPROVABLE'; END IF;
  SELECT max(version) INTO latest FROM ai_presentation.content_drafts WHERE project_id=NEW.project_id;
  IF latest IS DISTINCT FROM NEW.content_version OR NOT EXISTS (
    SELECT 1 FROM ai_presentation.preview_requests r JOIN ai_presentation.jobs j ON j.id=r.job_id
    WHERE r.job_id=NEW.preview_job_id AND r.project_id=NEW.project_id AND r.owner_id=NEW.owner_id
      AND r.content_version=NEW.content_version AND r.render_manifest=NEW.render_manifest
      AND r.job_id=(SELECT latest_request.job_id FROM ai_presentation.preview_requests latest_request
        WHERE latest_request.project_id=NEW.project_id ORDER BY latest_request.created_at DESC,latest_request.job_id DESC LIMIT 1)
      AND r.charged_at IS NOT NULL AND j.status='completed' AND j.job_type='static_preview'
      AND j.validation_report->>'passed'='true' AND r.render_manifest IS NOT NULL
      AND jsonb_array_length(r.render_manifest->'page_asset_ids')=(r.render_manifest->>'slide_count')::integer
      AND EXISTS(SELECT 1 FROM ai_presentation.generated_assets a WHERE a.id=(r.render_manifest->>'source_asset_id')::uuid
        AND a.job_id=j.id AND a.project_id=NEW.project_id AND a.owner_id=NEW.owner_id AND a.asset_type='pptx_deck'
        AND NOT a.is_quarantined AND a.is_private AND a.sha256_checksum=r.render_manifest->>'pptx_sha256')
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(r.render_manifest->'page_asset_ids') WITH ORDINALITY AS pages(page_id,position)
        WHERE NOT EXISTS(SELECT 1 FROM ai_presentation.generated_assets a WHERE a.id=pages.page_id::uuid AND a.job_id=j.id
          AND a.owner_id=NEW.owner_id AND a.project_id=NEW.project_id AND a.asset_type='preview_image' AND a.is_private AND NOT a.is_quarantined
          AND a.sha256_checksum=r.render_manifest->'page_sha256'->>(pages.position::integer-1)))
  ) THEN RAISE EXCEPTION 'PREVIEW_NOT_APPROVABLE'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_preview_approval BEFORE INSERT OR UPDATE ON ai_presentation.preview_approvals
  FOR EACH ROW EXECUTE FUNCTION ai_presentation.guard_preview_approval();
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ai_presentation_worker') THEN
    GRANT SELECT ON ai_presentation.preview_approvals TO ai_presentation_worker;
  END IF;
END $$;
COMMIT;
