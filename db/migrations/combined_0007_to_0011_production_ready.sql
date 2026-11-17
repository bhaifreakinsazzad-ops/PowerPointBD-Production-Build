-- ============================================================================
-- PowerPointBD: Combined Production Migrations 0007 through 0011
-- Target: Supabase PostgreSQL (ai_presentation schema)
-- Run this in the Supabase SQL Editor as 'postgres' superuser.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Migration 0007: Payment snapshot integrity & state triggers
-- ----------------------------------------------------------------------------

ALTER TABLE IF EXISTS ai_presentation.payment_webhook_events
  ADD COLUMN IF NOT EXISTS processing_outcome VARCHAR(48);

CREATE OR REPLACE FUNCTION ai_presentation.prevent_locked_design_spec_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_locked AND (NEW IS DISTINCT FROM OLD) AND (
    NEW.id IS DISTINCT FROM OLD.id OR NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.version IS DISTINCT FROM OLD.version OR NEW.is_locked IS DISTINCT FROM OLD.is_locked
    OR NEW.locked_at IS DISTINCT FROM OLD.locked_at OR NEW.spec_json IS DISTINCT FROM OLD.spec_json
  ) THEN
    RAISE EXCEPTION 'IMMUTABLE_DESIGN_SPEC';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = ai_presentation, public;

CREATE OR REPLACE FUNCTION ai_presentation.prevent_quote_snapshot_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
    RAISE EXCEPTION 'IMMUTABLE_QUOTE_SNAPSHOT';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = ai_presentation, public;

CREATE OR REPLACE FUNCTION ai_presentation.prevent_payment_snapshot_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['status','webhook_signature_verified','verified_at','provider_txn_id','updated_at'])
      IS DISTINCT FROM
      (to_jsonb(OLD) - ARRAY['status','webhook_signature_verified','verified_at','provider_txn_id','updated_at']) THEN
    RAISE EXCEPTION 'IMMUTABLE_PAYMENT_SNAPSHOT';
  END IF;
  IF OLD.status = 'refunded' AND NEW.status <> 'refunded'
     OR OLD.status = 'verified' AND NEW.status NOT IN ('verified','refunded') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATE_TRANSITION';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = ai_presentation, public;

DROP TRIGGER IF EXISTS trg_ai_presentation_payment_snapshot ON ai_presentation.payments;
CREATE TRIGGER trg_ai_presentation_payment_snapshot BEFORE UPDATE ON ai_presentation.payments
  FOR EACH ROW EXECUTE FUNCTION ai_presentation.prevent_payment_snapshot_mutation();

DROP TRIGGER IF EXISTS trg_ai_presentation_quote_snapshot ON ai_presentation.quotes;
CREATE TRIGGER trg_ai_presentation_quote_snapshot BEFORE UPDATE ON ai_presentation.quotes
  FOR EACH ROW EXECUTE FUNCTION ai_presentation.prevent_quote_snapshot_mutation();

DROP TRIGGER IF EXISTS trg_ai_presentation_design_spec_snapshot ON ai_presentation.design_specs;
CREATE TRIGGER trg_ai_presentation_design_spec_snapshot BEFORE UPDATE ON ai_presentation.design_specs
  FOR EACH ROW EXECUTE FUNCTION ai_presentation.prevent_locked_design_spec_mutation();

-- ----------------------------------------------------------------------------
-- Migration 0008: Versioned Content Drafts
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_presentation.content_drafts (
  project_id uuid NOT NULL REFERENCES ai_presentation.projects(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object' AND octet_length(content::text) <= 1048576),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, version)
);

ALTER TABLE ai_presentation.content_drafts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'ai_presentation' AND tablename = 'content_drafts' AND policyname = 'content_drafts_owner_select') THEN
    CREATE POLICY content_drafts_owner_select ON ai_presentation.content_drafts FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM ai_presentation.projects p WHERE p.id = project_id AND p.owner_id = (SELECT auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'ai_presentation' AND tablename = 'content_drafts' AND policyname = 'content_drafts_owner_insert') THEN
    CREATE POLICY content_drafts_owner_insert ON ai_presentation.content_drafts FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM ai_presentation.projects p WHERE p.id = project_id AND p.owner_id = (SELECT auth.uid())));
  END IF;
END $$;

GRANT SELECT, INSERT ON ai_presentation.content_drafts TO authenticated;

CREATE OR REPLACE FUNCTION ai_presentation.guard_content_draft() RETURNS trigger LANGUAGE plpgsql AS $$
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

DROP TRIGGER IF EXISTS guard_content_draft ON ai_presentation.content_drafts;
CREATE TRIGGER guard_content_draft BEFORE INSERT OR UPDATE ON ai_presentation.content_drafts
  FOR EACH ROW EXECUTE FUNCTION ai_presentation.guard_content_draft();

-- ----------------------------------------------------------------------------
-- Migration 0009: Durable Static Previews
-- ----------------------------------------------------------------------------

ALTER TABLE ai_presentation.jobs ALTER COLUMN design_spec_id DROP NOT NULL;
ALTER TABLE ai_presentation.jobs ALTER COLUMN entitlement_id DROP NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'preview_job_refs') THEN
    ALTER TABLE ai_presentation.jobs ADD CONSTRAINT preview_job_refs CHECK (
      (job_type = 'static_preview' AND design_spec_id IS NULL AND entitlement_id IS NULL)
      OR (job_type <> 'static_preview' AND design_spec_id IS NOT NULL AND entitlement_id IS NOT NULL));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ai_presentation.preview_requests (
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'ai_presentation' AND tablename = 'preview_requests' AND policyname = 'previews_owner_select') THEN
    CREATE POLICY previews_owner_select ON ai_presentation.preview_requests FOR SELECT TO authenticated USING(owner_id=(SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'ai_presentation' AND tablename = 'preview_requests' AND policyname = 'previews_owner_insert') THEN
    CREATE POLICY previews_owner_insert ON ai_presentation.preview_requests FOR INSERT TO authenticated WITH CHECK(owner_id=(SELECT auth.uid()));
  END IF;
END $$;

GRANT SELECT, INSERT ON ai_presentation.preview_requests TO authenticated;

CREATE OR REPLACE FUNCTION ai_presentation.guard_preview_request() RETURNS trigger LANGUAGE plpgsql AS $$
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

DROP TRIGGER IF EXISTS guard_preview_request ON ai_presentation.preview_requests;
CREATE TRIGGER guard_preview_request BEFORE INSERT OR UPDATE ON ai_presentation.preview_requests
  FOR EACH ROW EXECUTE FUNCTION ai_presentation.guard_preview_request();

CREATE OR REPLACE FUNCTION ai_presentation.guard_preview_revision_counter() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user='authenticated' AND NEW.preview_revisions_used IS DISTINCT FROM OLD.preview_revisions_used
  THEN RAISE EXCEPTION 'PREVIEW_QUOTA_SERVER_ONLY'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_preview_revision_counter ON ai_presentation.projects;
CREATE TRIGGER guard_preview_revision_counter BEFORE UPDATE ON ai_presentation.projects
  FOR EACH ROW EXECUTE FUNCTION ai_presentation.guard_preview_revision_counter();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'ai_presentation' AND tablename = 'jobs' AND policyname = 'preview_worker_updates_only') THEN
    CREATE POLICY preview_worker_updates_only ON ai_presentation.jobs AS RESTRICTIVE FOR UPDATE TO authenticated
      USING(job_type <> 'static_preview') WITH CHECK(job_type <> 'static_preview');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'ai_presentation' AND tablename = 'generated_assets' AND policyname = 'preview_worker_asset_inserts_only') THEN
    CREATE POLICY preview_worker_asset_inserts_only ON ai_presentation.generated_assets AS RESTRICTIVE FOR INSERT TO authenticated
      WITH CHECK(NOT EXISTS(SELECT 1 FROM ai_presentation.jobs j WHERE j.id=job_id AND j.job_type='static_preview'));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Migration 0010: Explicit Preview Approval
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_presentation.preview_approvals (
  project_id uuid PRIMARY KEY REFERENCES ai_presentation.projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES ai_presentation.users(id),
  preview_job_id uuid NOT NULL UNIQUE REFERENCES ai_presentation.preview_requests(job_id),
  content_version integer NOT NULL,
  render_manifest jsonb NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(project_id,content_version) REFERENCES ai_presentation.content_drafts(project_id,version)
);

ALTER TABLE ai_presentation.preview_approvals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'ai_presentation' AND tablename = 'preview_approvals' AND policyname = 'preview_approval_owner_select') THEN
    CREATE POLICY preview_approval_owner_select ON ai_presentation.preview_approvals FOR SELECT TO authenticated USING(owner_id=(SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'ai_presentation' AND tablename = 'preview_approvals' AND policyname = 'preview_approval_owner_insert') THEN
    CREATE POLICY preview_approval_owner_insert ON ai_presentation.preview_approvals FOR INSERT TO authenticated WITH CHECK(owner_id=(SELECT auth.uid()));
  END IF;
END $$;

GRANT SELECT, INSERT ON ai_presentation.preview_approvals TO authenticated;

DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ai_presentation_worker') THEN
    GRANT SELECT ON ai_presentation.preview_approvals TO ai_presentation_worker;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Migration 0011: Private Storage Access Controls
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ai_presentation.can_read_presentation_object(object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ai_presentation, storage, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM ai_presentation.generated_assets a
    WHERE a.storage_key = object_name AND a.owner_id = (SELECT auth.uid())
      AND NOT a.is_quarantined
      AND (
        (a.asset_type = 'preview_image' AND a.is_private)
        OR (
          a.asset_type = 'pptx_deck' AND a.is_private
          AND EXISTS (
            SELECT 1 FROM ai_presentation.entitlements e
            WHERE e.id = a.entitlement_id AND e.project_id = a.project_id AND e.owner_id = a.owner_id
              AND e.status = 'active'
          )
        )
      )
  );
$$;

COMMIT;
