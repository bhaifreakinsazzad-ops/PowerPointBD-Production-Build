-- ============================================================================
-- AI Presentation Platform — Supabase deployment migration (0002)
-- Target: a SHARED Supabase project ("HTKIS---SaaS-Agency") that also hosts
-- unrelated business systems (htkis_*, unreal_bs_* tables in `public`).
-- This migration is fully isolated in its own schema and touches nothing
-- outside it. Real Supabase Auth (auth.uid()) is used for RLS, not a custom
-- session setting — fixes the exact defect flagged in docs/source-audit.md
-- ("Not a complete Supabase ownership strategy... bind policies to the real
-- auth mechanism").
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS ai_presentation;

-- Deliberately NOT altering the `authenticator` role's pgrst.db_schemas here:
-- this is a SHARED Supabase project also serving other live apps (htkis_*,
-- unreal_bs_*), and that setting is project-wide, not schema-scoped - an
-- unexpected change to it could affect their PostgREST exposure too. This
-- platform's own backend will connect to Postgres directly (service-role
-- connection string), not through the auto-generated REST API, so exposure
-- isn't required. If supabase-js REST access to this schema is wanted later,
-- add `ai_presentation` under Project Settings > API > Exposed schemas in
-- the dashboard instead of altering shared role config via SQL.

SET search_path TO ai_presentation, public;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USER PROFILES — one row per real Supabase Auth user (auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_presentation.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL DEFAULT 'Unnamed User',
  role VARCHAR(24) NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'admin', 'support')),
  free_preview_projects_used INTEGER NOT NULL DEFAULT 0
    CHECK (free_preview_projects_used >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create a profile row whenever a real Supabase Auth user signs up.
CREATE OR REPLACE FUNCTION ai_presentation.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ai_presentation.users (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Unnamed User'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ai_presentation, public;

DROP TRIGGER IF EXISTS trg_ai_presentation_new_auth_user ON auth.users;
CREATE TRIGGER trg_ai_presentation_new_auth_user
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION ai_presentation.handle_new_auth_user();

-- ============================================================================
-- 2. VERSIONED SERVER-AUTHORITATIVE PRICING CONFIGURATION
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_presentation.price_configs (
  version SERIAL PRIMARY KEY,
  currency VARCHAR(3) NOT NULL DEFAULT 'BDT' CHECK (currency = 'BDT'),
  base_rate_bdt INTEGER NOT NULL DEFAULT 25 CHECK (base_rate_bdt > 0),
  base_rate_paisa BIGINT GENERATED ALWAYS AS (base_rate_bdt::BIGINT * 100) STORED,
  smooth_rate_bdt INTEGER NOT NULL DEFAULT 11 CHECK (smooth_rate_bdt >= 0),
  smooth_rate_paisa BIGINT GENERATED ALWAYS AS (smooth_rate_bdt::BIGINT * 100) STORED,
  cinematic_rate_bdt INTEGER NULL CHECK (cinematic_rate_bdt IS NULL OR cinematic_rate_bdt > 0),
  cinematic_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  phase0_desktop_gate_passed BOOLEAN NOT NULL DEFAULT FALSE,
  paying_clients_milestone_count INTEGER NOT NULL DEFAULT 0 CHECK (paying_clients_milestone_count >= 0),
  free_preview_project_cap INTEGER NOT NULL DEFAULT 2 CHECK (free_preview_project_cap >= 0),
  free_preview_revision_cap INTEGER NOT NULL DEFAULT 2 CHECK (free_preview_revision_cap >= 0),
  quote_ttl_hours INTEGER NOT NULL DEFAULT 24 CHECK (quote_ttl_hours BETWEEN 1 AND 168),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID NOT NULL REFERENCES ai_presentation.users(id),
  change_reason TEXT NOT NULL DEFAULT 'Initial MVP pricing configuration',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_cinematic_release_gate CHECK (
    cinematic_enabled = FALSE OR (
      phase0_desktop_gate_passed = TRUE
      AND paying_clients_milestone_count >= 5
      AND cinematic_rate_bdt IS NOT NULL
    )
  )
);

-- ============================================================================
-- 3. MOTION LIBRARY REGISTRY (fail-closed — nothing enabled without evidence)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_presentation.motion_library (
  id VARCHAR(64) PRIMARY KEY,
  effect_id VARCHAR(32) NOT NULL,
  category VARCHAR(16) NOT NULL CHECK (category IN ('transition', 'entrance')),
  display_name_en VARCHAR(64) NOT NULL,
  display_name_bn VARCHAR(64) NOT NULL,
  template_version VARCHAR(32) NOT NULL DEFAULT 'v1',
  structural_xml_status VARCHAR(32) NOT NULL DEFAULT 'UNVERIFIED',
  desktop_qa_status VARCHAR(48) NOT NULL DEFAULT 'UNVERIFIED_EXTERNAL_DESKTOP_REQUIRED',
  sample_clip_storage_key TEXT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by UUID REFERENCES ai_presentation.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category, effect_id)
);

-- ============================================================================
-- 4. PROJECTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_presentation.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES ai_presentation.users(id) ON DELETE RESTRICT,
  title VARCHAR(200) NOT NULL,
  language_mode VARCHAR(16) NOT NULL DEFAULT 'bilingual'
    CHECK (language_mode IN ('bilingual', 'bn', 'en')),
  design_family VARCHAR(64) NOT NULL DEFAULT 'corporate_slate',
  input_mode VARCHAR(24) NOT NULL DEFAULT 'prompt'
    CHECK (input_mode IN ('prompt', 'outline', 'paste')),
  raw_input_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  slide_count INTEGER NOT NULL CHECK (slide_count BETWEEN 1 AND 100),
  motion_tier_requested VARCHAR(16) NOT NULL DEFAULT 'smooth'
    CHECK (motion_tier_requested IN ('static', 'smooth', 'cinematic')),
  state VARCHAR(32) NOT NULL DEFAULT 'draft'
    CHECK (state IN (
      'draft', 'preview_queued', 'preview_ready', 'design_review',
      'preview_revision_requested', 'design_approved', 'motion_configured',
      'quoted', 'payment_pending', 'payment_failed', 'paid',
      'production_queued', 'producing', 'validating', 'production_failed',
      'delivered', 'revision_requested', 'cancelled'
    )),
  preview_revisions_used INTEGER NOT NULL DEFAULT 0 CHECK (preview_revisions_used >= 0),
  free_motion_swap_used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_presentation_projects_owner_id ON ai_presentation.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_ai_presentation_projects_state ON ai_presentation.projects(state);

-- ============================================================================
-- 5. DESIGN SPECIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_presentation.design_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES ai_presentation.projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  locked_at TIMESTAMPTZ NULL,
  spec_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, version),
  CONSTRAINT chk_spec_json_required_keys CHECK (
    (spec_json ? 'motion_tier') AND (spec_json ? 'intensity') AND
    (spec_json ? 'transition_id') AND (spec_json ? 'animation_policy') AND
    (spec_json->>'motion_tier' IN ('static', 'smooth', 'cinematic'))
  ),
  CONSTRAINT chk_spec_json_tier_consistency CHECK (
    (
      spec_json->>'motion_tier' = 'static'
      AND (spec_json->'transition_id' = 'null'::JSONB)
      AND (spec_json->'intensity' = 'null'::JSONB)
    )
    OR
    (
      spec_json->>'motion_tier' IN ('smooth', 'cinematic')
      AND (spec_json->>'transition_id' IN ('fade', 'wipe', 'push', 'zoom'))
      AND (spec_json->>'intensity' IN ('subtle', 'standard', 'dynamic'))
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_ai_presentation_design_specs_project_id ON ai_presentation.design_specs(project_id);

CREATE OR REPLACE FUNCTION ai_presentation.prevent_locked_design_spec_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_locked = TRUE AND NEW.spec_json IS DISTINCT FROM OLD.spec_json THEN
    RAISE EXCEPTION 'IMMUTABLE_DESIGN_SPEC: Cannot modify spec_json on a locked design specification (id=%). Create a new revision version instead.', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = ai_presentation, public;

DROP TRIGGER IF EXISTS trg_ai_presentation_prevent_locked_spec_mutation ON ai_presentation.design_specs;
CREATE TRIGGER trg_ai_presentation_prevent_locked_spec_mutation
BEFORE UPDATE ON ai_presentation.design_specs
FOR EACH ROW EXECUTE FUNCTION ai_presentation.prevent_locked_design_spec_mutation();

-- ============================================================================
-- 6. IMMUTABLE SERVER QUOTES
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_presentation.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES ai_presentation.projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES ai_presentation.users(id),
  design_spec_id UUID NOT NULL REFERENCES ai_presentation.design_specs(id),
  pricing_config_version INTEGER NOT NULL REFERENCES ai_presentation.price_configs(version),
  tier VARCHAR(16) NOT NULL CHECK (tier IN ('static', 'smooth', 'cinematic')),
  slide_count INTEGER NOT NULL CHECK (slide_count BETWEEN 1 AND 100),
  base_rate_bdt INTEGER NOT NULL CHECK (base_rate_bdt > 0),
  motion_rate_bdt INTEGER NOT NULL CHECK (motion_rate_bdt >= 0),
  quote_amount INTEGER NOT NULL CHECK (quote_amount >= 0),
  quote_amount_paisa BIGINT NOT NULL CHECK (quote_amount_paisa >= 0),
  quote_breakdown JSONB NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'paid', 'superseded')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_quote_math_integrity CHECK (quote_amount_paisa = (quote_amount::BIGINT * 100))
);

CREATE INDEX IF NOT EXISTS idx_ai_presentation_quotes_project_id ON ai_presentation.quotes(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_presentation_quotes_owner_id ON ai_presentation.quotes(owner_id);

CREATE OR REPLACE FUNCTION ai_presentation.prevent_quote_snapshot_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_amount IS DISTINCT FROM OLD.quote_amount
     OR NEW.quote_amount_paisa IS DISTINCT FROM OLD.quote_amount_paisa
     OR NEW.base_rate_bdt IS DISTINCT FROM OLD.base_rate_bdt
     OR NEW.motion_rate_bdt IS DISTINCT FROM OLD.motion_rate_bdt
     OR NEW.quote_breakdown IS DISTINCT FROM OLD.quote_breakdown
     OR NEW.tier IS DISTINCT FROM OLD.tier
     OR NEW.slide_count IS DISTINCT FROM OLD.slide_count THEN
    RAISE EXCEPTION 'IMMUTABLE_QUOTE_SNAPSHOT: Quote pricing fields cannot be altered after creation (quote_id=%).', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = ai_presentation, public;

DROP TRIGGER IF EXISTS trg_ai_presentation_prevent_quote_snapshot_mutation ON ai_presentation.quotes;
CREATE TRIGGER trg_ai_presentation_prevent_quote_snapshot_mutation
BEFORE UPDATE ON ai_presentation.quotes
FOR EACH ROW EXECUTE FUNCTION ai_presentation.prevent_quote_snapshot_mutation();

-- ============================================================================
-- 7. PAYMENTS & WEBHOOK EVENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_presentation.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES ai_presentation.projects(id),
  owner_id UUID NOT NULL REFERENCES ai_presentation.users(id),
  quote_id UUID NOT NULL REFERENCES ai_presentation.quotes(id),
  provider VARCHAR(32) NOT NULL DEFAULT 'sslcommerz_sandbox',
  provider_session_id VARCHAR(128) NOT NULL UNIQUE,
  provider_txn_id VARCHAR(128) NULL UNIQUE,
  idempotency_key VARCHAR(128) NOT NULL UNIQUE,
  tier VARCHAR(16) NOT NULL CHECK (tier IN ('static', 'smooth', 'cinematic')),
  quote_amount INTEGER NOT NULL CHECK (quote_amount >= 0),
  quote_amount_paisa BIGINT NOT NULL CHECK (quote_amount_paisa >= 0),
  quote_breakdown JSONB NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
  status VARCHAR(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'failed', 'refunded')),
  webhook_signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_presentation_payments_project_id ON ai_presentation.payments(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_presentation_payments_quote_id ON ai_presentation.payments(quote_id);

CREATE TABLE IF NOT EXISTS ai_presentation.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(32) NOT NULL,
  provider_event_id VARCHAR(128) NOT NULL,
  payment_id UUID NULL REFERENCES ai_presentation.payments(id),
  signature_valid BOOLEAN NOT NULL,
  payload_sha256 VARCHAR(64) NOT NULL,
  raw_payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_event_id)
);

-- ============================================================================
-- 8. ENTITLEMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_presentation.entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES ai_presentation.projects(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES ai_presentation.users(id),
  payment_id UUID NOT NULL UNIQUE REFERENCES ai_presentation.payments(id),
  design_spec_id UUID NOT NULL REFERENCES ai_presentation.design_specs(id),
  motion_tier VARCHAR(16) NOT NULL CHECK (motion_tier IN ('static', 'smooth', 'cinematic')),
  free_motion_swaps_remaining INTEGER NOT NULL DEFAULT 1 CHECK (free_motion_swaps_remaining BETWEEN 0 AND 1),
  status VARCHAR(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 9. DURABLE BACKGROUND JOBS
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_presentation.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES ai_presentation.projects(id),
  owner_id UUID NOT NULL REFERENCES ai_presentation.users(id),
  design_spec_id UUID NOT NULL REFERENCES ai_presentation.design_specs(id),
  entitlement_id UUID NOT NULL REFERENCES ai_presentation.entitlements(id),
  idempotency_key VARCHAR(128) NOT NULL UNIQUE,
  job_type VARCHAR(32) NOT NULL DEFAULT 'pptx_production'
    CHECK (job_type IN ('static_preview', 'pptx_production', 'motion_swap_rerender', 'tier_upgrade_rerender')),
  status VARCHAR(24) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'validating', 'completed', 'failed', 'quarantined')),
  progress_stage VARCHAR(64) NOT NULL DEFAULT 'Job queued for durable worker execution',
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  lease_expires_at TIMESTAMPTZ NULL,
  next_retry_at TIMESTAMPTZ NULL,
  animation_choices JSONB NOT NULL DEFAULT '{}'::JSONB,
  validation_report JSONB NULL,
  output_asset_id UUID NULL,
  error_code VARCHAR(64) NULL,
  error_message TEXT NULL,
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_presentation_jobs_project_id ON ai_presentation.jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_presentation_jobs_status_retry ON ai_presentation.jobs(status, next_retry_at);

-- ============================================================================
-- 10. GENERATED PRIVATE ASSETS
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_presentation.generated_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES ai_presentation.projects(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES ai_presentation.jobs(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES ai_presentation.users(id),
  asset_type VARCHAR(32) NOT NULL
    CHECK (asset_type IN ('preview_image', 'pptx_deck', 'static_pdf', 'validation_report')),
  storage_bucket VARCHAR(64) NOT NULL DEFAULT 'private-presentations',
  storage_key TEXT NOT NULL UNIQUE,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(128) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  sha256_checksum VARCHAR(64) NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT TRUE CHECK (is_private = TRUE),
  is_quarantined BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 11. APPEND-ONLY AUDIT LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_presentation.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES ai_presentation.users(id),
  actor_role VARCHAR(24) NOT NULL,
  action VARCHAR(64) NOT NULL,
  target_entity VARCHAR(64) NOT NULL,
  target_id TEXT NOT NULL,
  old_value JSONB NULL,
  new_value JSONB NULL,
  ip_address VARCHAR(64) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION ai_presentation.prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'APPEND_ONLY_AUDIT_LOG: audit_logs rows cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_presentation_prevent_audit_log_modification ON ai_presentation.audit_logs;
CREATE TRIGGER trg_ai_presentation_prevent_audit_log_modification
BEFORE UPDATE OR DELETE ON ai_presentation.audit_logs
FOR EACH ROW EXECUTE FUNCTION ai_presentation.prevent_audit_log_modification();

-- ============================================================================
-- 12. ROW LEVEL SECURITY — real Supabase Auth (auth.uid()), not a custom GUC
-- ============================================================================
ALTER TABLE ai_presentation.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_presentation.price_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_presentation.motion_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_presentation.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_presentation.design_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_presentation.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_presentation.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_presentation.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_presentation.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_presentation.generated_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_presentation.audit_logs ENABLE ROW LEVEL SECURITY;
-- payment_webhook_events: no policies — only the service role (which bypasses
-- RLS entirely) should ever touch this table; deny-by-default for everyone else.
ALTER TABLE ai_presentation.payment_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_self_select ON ai_presentation.users
  FOR SELECT USING (id = auth.uid());

-- Public, read-only reference data: active price config and enabled effects
-- (customers must see current pricing/available effects to get a quote).
CREATE POLICY price_configs_public_read ON ai_presentation.price_configs
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY motion_library_public_read ON ai_presentation.motion_library
  FOR SELECT USING (enabled = TRUE);

CREATE POLICY projects_owner_isolation ON ai_presentation.projects
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY design_specs_owner_isolation ON ai_presentation.design_specs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM ai_presentation.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );

CREATE POLICY quotes_owner_isolation ON ai_presentation.quotes
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY payments_owner_isolation ON ai_presentation.payments
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY entitlements_owner_isolation ON ai_presentation.entitlements
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY jobs_owner_isolation ON ai_presentation.jobs
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY assets_owner_isolation ON ai_presentation.generated_assets
  FOR SELECT USING (owner_id = auth.uid() AND is_quarantined = FALSE);
-- audit_logs: RLS enabled, zero policies -> inaccessible to anon/authenticated,
-- only the service role (bypasses RLS) can read/write it. Deliberate.

-- ============================================================================
-- 13. GRANTS — RLS restricts rows, Postgres GRANTs restrict operations.
-- PostgREST requires both for anon/authenticated roles to reach this schema.
-- ============================================================================
GRANT USAGE ON SCHEMA ai_presentation TO authenticated, anon;
GRANT SELECT ON ai_presentation.price_configs, ai_presentation.motion_library TO authenticated, anon;
GRANT SELECT ON ai_presentation.users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ai_presentation.projects, ai_presentation.design_specs TO authenticated;
GRANT SELECT, INSERT ON ai_presentation.quotes TO authenticated;
GRANT SELECT ON ai_presentation.payments, ai_presentation.entitlements, ai_presentation.jobs, ai_presentation.generated_assets TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ai_presentation TO authenticated;

-- ============================================================================
-- 14. SEED — reference data only. No fake users: real users come from
-- actual Supabase Auth sign-ups via the trigger above.
-- ============================================================================
-- A bootstrap system row is required as updated_by/actor_id FK target before
-- any real user exists. We insert a placeholder auth.users row for this
-- purpose only — Supabase Auth itself never issues a session for it (no
-- password, not returned by any sign-in flow), so it can't be used to log in.
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) VALUES (
  '00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'system@ai-presentation-platform.internal',
  '', NOW(), NOW(), NOW(), '{"provider":"system","providers":[]}'::JSONB, '{}'::JSONB
) ON CONFLICT (id) DO NOTHING;

UPDATE ai_presentation.users SET role = 'admin', full_name = 'Platform System'
WHERE id = '00000000-0000-4000-8000-000000000001';

INSERT INTO ai_presentation.price_configs (
  version, base_rate_bdt, smooth_rate_bdt, cinematic_rate_bdt,
  cinematic_enabled, phase0_desktop_gate_passed, paying_clients_milestone_count,
  quote_ttl_hours, is_active, updated_by, change_reason
) VALUES (
  1, 25, 11, NULL, FALSE, FALSE, 0, 24, TRUE,
  '00000000-0000-4000-8000-000000000001',
  'Initial MVP launch pricing: BDT 25/slide base + BDT 11/slide Smooth motion'
) ON CONFLICT (version) DO NOTHING;

INSERT INTO ai_presentation.motion_library (id, effect_id, category, display_name_en, display_name_bn, enabled, updated_by)
VALUES
  ('transition:fade', 'fade', 'transition', 'Fade', 'ফেড', FALSE, '00000000-0000-4000-8000-000000000001'),
  ('transition:wipe', 'wipe', 'transition', 'Wipe', 'ওয়াইপ', FALSE, '00000000-0000-4000-8000-000000000001'),
  ('transition:push', 'push', 'transition', 'Push', 'পুশ', FALSE, '00000000-0000-4000-8000-000000000001'),
  ('transition:zoom', 'zoom', 'transition', 'Zoom', 'জুম', FALSE, '00000000-0000-4000-8000-000000000001'),
  ('entrance:fade', 'fade', 'entrance', 'Fade Entrance', 'ফেড এন্ট্রান্স', FALSE, '00000000-0000-4000-8000-000000000001'),
  ('entrance:wipe', 'wipe', 'entrance', 'Wipe Entrance', 'ওয়াইপ এন্ট্রান্স', FALSE, '00000000-0000-4000-8000-000000000001'),
  ('entrance:zoom', 'zoom', 'entrance', 'Zoom Entrance', 'জুম এন্ট্রান্স', FALSE, '00000000-0000-4000-8000-000000000001'),
  ('entrance:slide_in', 'slide_in', 'entrance', 'Slide In Up', 'স্লাইড ইন', FALSE, '00000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_presentation.audit_logs (actor_id, actor_role, action, target_entity, target_id, old_value, new_value)
VALUES (
  '00000000-0000-4000-8000-000000000001', 'admin', 'SEED_INITIAL_PRICING', 'price_configs', '1',
  NULL, '{"version": 1, "base_rate_bdt": 25, "smooth_rate_bdt": 11, "cinematic_enabled": false}'::JSONB
);
