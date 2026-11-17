-- Local implementation only. Apply to a separately authorized target after review.
-- Draft text is not design approval. No preview quota or payment is consumed here.
BEGIN;
CREATE TABLE ai_presentation.content_drafts (
  project_id uuid NOT NULL REFERENCES ai_presentation.projects(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object' AND octet_length(content::text) <= 1048576),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, version)
);
ALTER TABLE ai_presentation.content_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_drafts_owner_select ON ai_presentation.content_drafts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM ai_presentation.projects p WHERE p.id = project_id AND p.owner_id = (SELECT auth.uid())));
CREATE POLICY content_drafts_owner_insert ON ai_presentation.content_drafts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM ai_presentation.projects p WHERE p.id = project_id AND p.owner_id = (SELECT auth.uid())));
GRANT SELECT, INSERT ON ai_presentation.content_drafts TO authenticated;

-- Serialize even direct SQL inserts with project operations. Historical versions
-- cannot be edited, reordered or appended after quoting/preview work has begun.
CREATE FUNCTION ai_presentation.guard_content_draft() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE project_state text; latest integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'CONTENT_DRAFT_IMMUTABLE'; END IF;
  SELECT state INTO project_state FROM ai_presentation.projects WHERE id = NEW.project_id FOR UPDATE;
  IF project_state <> 'draft' OR EXISTS (
    SELECT 1 FROM ai_presentation.design_specs WHERE project_id = NEW.project_id AND is_locked
  ) THEN RAISE EXCEPTION 'CONTENT_DRAFT_LOCKED'; END IF;
  SELECT coalesce(max(version), 0) INTO latest FROM ai_presentation.content_drafts WHERE project_id = NEW.project_id;
  IF NEW.version <> latest + 1 THEN RAISE EXCEPTION 'CONTENT_VERSION_CONFLICT'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_content_draft BEFORE INSERT OR UPDATE ON ai_presentation.content_drafts
  FOR EACH ROW EXECUTE FUNCTION ai_presentation.guard_content_draft();
COMMIT;
