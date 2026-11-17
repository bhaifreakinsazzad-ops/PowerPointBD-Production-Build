-- Preview policy selected by owner: count at first rendering start, including
-- failures/abandonment. One logical request is counted once across worker retries.
BEGIN;
ALTER TABLE ai_presentation.jobs ALTER COLUMN design_spec_id DROP NOT NULL;
ALTER TABLE ai_presentation.jobs ALTER COLUMN entitlement_id DROP NOT NULL;
ALTER TABLE ai_presentation.jobs ADD CONSTRAINT preview_job_refs CHECK (
  (job_type = 'static_preview' AND design_spec_id IS NULL AND entitlement_id IS NULL)
  OR (job_type <> 'static_preview' AND design_spec_id IS NOT NULL AND entitlement_id IS NOT NULL));
CREATE TABLE ai_presentation.preview_requests (
  job_id uuid PRIMARY KEY REFERENCES ai_presentation.jobs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES ai_presentation.projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES ai_presentation.users(id),
  content_version integer NOT NULL,
  template text NOT NULL DEFAULT 'corporate_slate-v1' CHECK (template = 'corporate_slate-v1'),
  charged_at timestamptz,
  render_manifest jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(project_id,content_version) REFERENCES ai_presentation.content_drafts(project_id,version)
);
ALTER TABLE ai_presentation.preview_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY previews_owner_select ON ai_presentation.preview_requests FOR SELECT TO authenticated USING(owner_id=(SELECT auth.uid()));
CREATE POLICY previews_owner_insert ON ai_presentation.preview_requests FOR INSERT TO authenticated WITH CHECK(owner_id=(SELECT auth.uid()));
GRANT SELECT,INSERT ON ai_presentation.preview_requests TO authenticated;
CREATE FUNCTION ai_presentation.guard_preview_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.charged_at IS NOT NULL OR NEW.render_manifest IS NOT NULL OR NOT EXISTS (
      SELECT 1 FROM ai_presentation.jobs j WHERE j.id=NEW.job_id AND j.project_id=NEW.project_id
        AND j.owner_id=NEW.owner_id AND j.job_type='static_preview' AND j.status='queued'
        AND j.attempts=0
    ) THEN RAISE EXCEPTION 'INVALID_PREVIEW_REQUEST'; END IF;
  ELSE
    IF (NEW.job_id,NEW.project_id,NEW.owner_id,NEW.content_version,NEW.template,NEW.created_at)
       IS DISTINCT FROM (OLD.job_id,OLD.project_id,OLD.owner_id,OLD.content_version,OLD.template,OLD.created_at)
       OR (OLD.charged_at IS NOT NULL AND NEW.charged_at IS DISTINCT FROM OLD.charged_at)
       OR (OLD.render_manifest IS NOT NULL AND NEW.render_manifest IS DISTINCT FROM OLD.render_manifest)
    THEN RAISE EXCEPTION 'PREVIEW_SNAPSHOT_IMMUTABLE'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_preview_request BEFORE INSERT OR UPDATE ON ai_presentation.preview_requests
  FOR EACH ROW EXECUTE FUNCTION ai_presentation.guard_preview_request();
CREATE FUNCTION ai_presentation.guard_preview_revision_counter() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user='authenticated' AND NEW.preview_revisions_used IS DISTINCT FROM OLD.preview_revisions_used
  THEN RAISE EXCEPTION 'PREVIEW_QUOTA_SERVER_ONLY'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_preview_revision_counter BEFORE UPDATE ON ai_presentation.projects
  FOR EACH ROW EXECUTE FUNCTION ai_presentation.guard_preview_revision_counter();
-- Existing permissive owner policies do not allow forging renderer completion.
CREATE POLICY preview_worker_updates_only ON ai_presentation.jobs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING(job_type <> 'static_preview') WITH CHECK(job_type <> 'static_preview');
CREATE POLICY preview_worker_asset_inserts_only ON ai_presentation.generated_assets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK(NOT EXISTS(SELECT 1 FROM ai_presentation.jobs j WHERE j.id=job_id AND j.job_type='static_preview'));
CREATE FUNCTION ai_presentation.guard_preview_job_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.job_type='static_preview' AND (NEW.status<>'queued' OR NEW.attempts<>0
    OR NEW.lease_expires_at IS NOT NULL OR NEW.validation_report IS NOT NULL OR NEW.output_asset_id IS NOT NULL
    OR NEW.started_at IS NOT NULL OR NEW.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'INVALID_PREVIEW_JOB'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_preview_job_insert BEFORE INSERT ON ai_presentation.jobs
  FOR EACH ROW EXECUTE FUNCTION ai_presentation.guard_preview_job_insert();
CREATE OR REPLACE FUNCTION ai_presentation.guard_content_draft() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE project_state text; latest integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'CONTENT_DRAFT_IMMUTABLE'; END IF;
  SELECT state INTO project_state FROM ai_presentation.projects WHERE id = NEW.project_id FOR UPDATE;
  IF project_state NOT IN ('draft','preview_revision_requested') OR EXISTS (
    SELECT 1 FROM ai_presentation.design_specs WHERE project_id = NEW.project_id AND is_locked
  ) THEN RAISE EXCEPTION 'CONTENT_DRAFT_LOCKED'; END IF;
  SELECT coalesce(max(version), 0) INTO latest FROM ai_presentation.content_drafts WHERE project_id = NEW.project_id;
  IF NEW.version <> latest + 1 THEN RAISE EXCEPTION 'CONTENT_VERSION_CONFLICT'; END IF;
  RETURN NEW;
END $$;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ai_presentation_worker') THEN
    GRANT SELECT ON ai_presentation.preview_requests TO ai_presentation_worker;
    GRANT UPDATE(charged_at,render_manifest) ON ai_presentation.preview_requests TO ai_presentation_worker;
    GRANT SELECT ON ai_presentation.content_drafts TO ai_presentation_worker;
    GRANT UPDATE(free_preview_projects_used,updated_at) ON ai_presentation.users TO ai_presentation_worker;
    GRANT UPDATE(state,preview_revisions_used,updated_at) ON ai_presentation.projects TO ai_presentation_worker;
    GRANT SELECT(id,free_preview_projects_used) ON ai_presentation.users TO ai_presentation_worker;
  END IF;
END $$;
COMMIT;
