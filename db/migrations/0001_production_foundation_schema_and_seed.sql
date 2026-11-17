-- UNAPPLIED DEMO MIGRATION CANDIDATE. Not production approved.
-- No database, RLS, auth or payment integration was executed by copying this file.
-- Untested effects are disabled; experimental candidate status is NOT a PASS.
-- ============================================================================
-- AI Presentation Platform — Production Foundation Database Migration (0001)
-- Target Engine: PostgreSQL 15+ / Supabase (with Row Level Security)
-- Date: 26 October 2026
--
-- Preserves all mandatory source fields:
--   1. projects.motion_tier_requested
--   2. design_specs.spec_json (motion_tier, intensity, transition_id, animation_policy)
--   3. payments.tier, payments.quote_amount, payments.quote_breakdown
--   4. entitlements.motion_tier
--   5. jobs.animation_choices
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USERS & AUTHENTICATION PROFILES
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  role VARCHAR(24) NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'admin', 'support')),
  free_preview_projects_used INTEGER NOT NULL DEFAULT 0
    CHECK (free_preview_projects_used >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. VERSIONED SERVER-AUTHORITATIVE PRICING CONFIGURATION
-- ============================================================================
CREATE TABLE IF NOT EXISTS price_configs (
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
  updated_by UUID NOT NULL REFERENCES users(id),
  change_reason TEXT NOT NULL DEFAULT 'Initial MVP pricing configuration',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Enforce Cinematic release gate at the database constraint level (FR-24)
  CONSTRAINT chk_cinematic_release_gate CHECK (
    cinematic_enabled = FALSE OR (
      phase0_desktop_gate_passed = TRUE
      AND paying_clients_milestone_count >= 5
      AND cinematic_rate_bdt IS NOT NULL
    )
  )
);

-- ============================================================================
-- 3. MOTION LIBRARY REGISTRY (Tested Native PowerPoint Effects Only)
-- ============================================================================
CREATE TABLE IF NOT EXISTS motion_library (
  id VARCHAR(64) PRIMARY KEY, -- e.g. 'transition:fade', 'entrance:slide_in'
  effect_id VARCHAR(32) NOT NULL, -- 'fade', 'wipe', 'push', 'zoom', 'slide_in'
  category VARCHAR(16) NOT NULL CHECK (category IN ('transition', 'entrance')),
  display_name_en VARCHAR(64) NOT NULL,
  display_name_bn VARCHAR(64) NOT NULL,
  template_version VARCHAR(32) NOT NULL DEFAULT '2026.10.26-rev2',
  structural_xml_status VARCHAR(32) NOT NULL DEFAULT 'UNVERIFIED',
  desktop_qa_status VARCHAR(48) NOT NULL DEFAULT 'UNVERIFIED_EXTERNAL_DESKTOP_REQUIRED',
  sample_clip_storage_key TEXT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category, effect_id)
);

-- ============================================================================
-- 4. PROJECTS (Preserves projects.motion_tier_requested)
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
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
      'draft',
      'preview_queued',
      'preview_ready',
      'design_review',
      'preview_revision_requested',
      'design_approved',
      'motion_configured',
      'quoted',
      'payment_pending',
      'payment_failed',
      'paid',
      'production_queued',
      'producing',
      'validating',
      'production_failed',
      'delivered',
      'revision_requested',
      'cancelled'
    )),
  preview_revisions_used INTEGER NOT NULL DEFAULT 0
    CHECK (preview_revisions_used >= 0),
  free_motion_swap_used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_state ON projects(state);

-- ============================================================================
-- 5. DESIGN SPECIFICATIONS (Preserves design_specs.spec_json)
-- ============================================================================
CREATE TABLE IF NOT EXISTS design_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  locked_at TIMESTAMPTZ NULL,
  spec_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, version),
  -- Guarantee required source keys exist in design_specs.spec_json
  CONSTRAINT chk_spec_json_required_keys CHECK (
    (spec_json ? 'motion_tier') AND
    (spec_json ? 'intensity') AND
    (spec_json ? 'transition_id') AND
    (spec_json ? 'animation_policy') AND
    (spec_json->>'motion_tier' IN ('static', 'smooth', 'cinematic'))
  ),
  -- Static tier must have null transition_id and intensity; Smooth must have non-null
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

CREATE INDEX IF NOT EXISTS idx_design_specs_project_id ON design_specs(project_id);

-- Immutability Trigger: Once design_specs.is_locked = TRUE, spec_json cannot be mutated
CREATE OR REPLACE FUNCTION prevent_locked_design_spec_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_locked = TRUE AND NEW.spec_json IS DISTINCT FROM OLD.spec_json THEN
    RAISE EXCEPTION 'IMMUTABLE_DESIGN_SPEC: Cannot modify spec_json on a locked design specification (id=%). Create a new revision version instead.', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_locked_design_spec_mutation ON design_specs;
CREATE TRIGGER trg_prevent_locked_design_spec_mutation
BEFORE UPDATE ON design_specs
FOR EACH ROW EXECUTE FUNCTION prevent_locked_design_spec_mutation();

-- ============================================================================
-- 6. IMMUTABLE SERVER QUOTES (Snapshots Active Rates & Breakdown)
-- ============================================================================
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id),
  design_spec_id UUID NOT NULL REFERENCES design_specs(id),
  pricing_config_version INTEGER NOT NULL REFERENCES price_configs(version),
  tier VARCHAR(16) NOT NULL CHECK (tier IN ('static', 'smooth', 'cinematic')),
  slide_count INTEGER NOT NULL CHECK (slide_count BETWEEN 1 AND 100),
  base_rate_bdt INTEGER NOT NULL CHECK (base_rate_bdt > 0),
  motion_rate_bdt INTEGER NOT NULL CHECK (motion_rate_bdt >= 0),
  quote_amount INTEGER NOT NULL CHECK (quote_amount >= 0), -- Integer BDT
  quote_amount_paisa BIGINT NOT NULL CHECK (quote_amount_paisa >= 0), -- Minor units (BDT * 100)
  quote_breakdown JSONB NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'paid', 'superseded')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_quote_math_integrity CHECK (
    quote_amount_paisa = (quote_amount::BIGINT * 100)
  )
);

CREATE INDEX IF NOT EXISTS idx_quotes_project_id ON quotes(project_id);
CREATE INDEX IF NOT EXISTS idx_quotes_owner_id ON quotes(owner_id);

-- Immutability Trigger: Prevent any modification to monetary snapshot fields on quotes
CREATE OR REPLACE FUNCTION prevent_quote_snapshot_mutation()
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_quote_snapshot_mutation ON quotes;
CREATE TRIGGER trg_prevent_quote_snapshot_mutation
BEFORE UPDATE ON quotes
FOR EACH ROW EXECUTE FUNCTION prevent_quote_snapshot_mutation();

-- ============================================================================
-- 7. PAYMENTS & WEBHOOK EVENTS (Preserves payments.tier, quote_amount, quote_breakdown)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  owner_id UUID NOT NULL REFERENCES users(id),
  quote_id UUID NOT NULL REFERENCES quotes(id),
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

CREATE INDEX IF NOT EXISTS idx_payments_project_id ON payments(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_quote_id ON payments(quote_id);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(32) NOT NULL,
  provider_event_id VARCHAR(128) NOT NULL,
  payment_id UUID NULL REFERENCES payments(id),
  signature_valid BOOLEAN NOT NULL,
  payload_sha256 VARCHAR(64) NOT NULL,
  raw_payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_event_id)
);

-- ============================================================================
-- 8. ENTITLEMENTS (Preserves entitlements.motion_tier)
-- ============================================================================
CREATE TABLE IF NOT EXISTS entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES users(id),
  payment_id UUID NOT NULL UNIQUE REFERENCES payments(id),
  design_spec_id UUID NOT NULL REFERENCES design_specs(id),
  motion_tier VARCHAR(16) NOT NULL CHECK (motion_tier IN ('static', 'smooth', 'cinematic')),
  free_motion_swaps_remaining INTEGER NOT NULL DEFAULT 1 CHECK (free_motion_swaps_remaining BETWEEN 0 AND 1),
  status VARCHAR(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 9. DURABLE BACKGROUND JOBS (Preserves jobs.animation_choices)
-- ============================================================================
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  owner_id UUID NOT NULL REFERENCES users(id),
  design_spec_id UUID NOT NULL REFERENCES design_specs(id),
  entitlement_id UUID NOT NULL REFERENCES entitlements(id),
  idempotency_key VARCHAR(128) NOT NULL UNIQUE,
  job_type VARCHAR(32) NOT NULL DEFAULT 'pptx_production'
    CHECK (job_type IN ('static_preview', 'pptx_production', 'motion_swap_rerender', 'tier_upgrade_rerender')),
  status VARCHAR(24) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'validating', 'completed', 'failed', 'quarantined')),
  progress_stage VARCHAR(64) NOT NULL DEFAULT 'Job queued for durable worker execution',
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
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

CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status_retry ON jobs(status, next_retry_at);

-- ============================================================================
-- 10. GENERATED PRIVATE ASSETS (Private Storage Keys & Checksums)
-- ============================================================================
CREATE TABLE IF NOT EXISTS generated_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id),
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
-- 11. APPEND-ONLY ADMINISTRATIVE & SECURITY AUDIT LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES users(id),
  actor_role VARCHAR(24) NOT NULL,
  action VARCHAR(64) NOT NULL,
  target_entity VARCHAR(64) NOT NULL,
  target_id TEXT NOT NULL,
  old_value JSONB NULL,
  new_value JSONB NULL,
  ip_address VARCHAR(64) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'APPEND_ONLY_AUDIT_LOG: audit_logs rows cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_modification ON audit_logs;
CREATE TRIGGER trg_prevent_audit_log_modification
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

-- ============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES FOR SUPABASE / POSTGRES
-- ============================================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Example owner-scoped policy using current_setting('app.current_user_id', true)
CREATE POLICY projects_owner_isolation ON projects
  FOR ALL
  USING (owner_id::TEXT = current_setting('app.current_user_id', true));

CREATE POLICY quotes_owner_isolation ON quotes
  FOR SELECT
  USING (owner_id::TEXT = current_setting('app.current_user_id', true));

CREATE POLICY payments_owner_isolation ON payments
  FOR SELECT
  USING (owner_id::TEXT = current_setting('app.current_user_id', true));

CREATE POLICY entitlements_owner_isolation ON entitlements
  FOR SELECT
  USING (owner_id::TEXT = current_setting('app.current_user_id', true));

CREATE POLICY jobs_owner_isolation ON jobs
  FOR SELECT
  USING (owner_id::TEXT = current_setting('app.current_user_id', true));

CREATE POLICY assets_owner_isolation ON generated_assets
  FOR SELECT
  USING (
    owner_id::TEXT = current_setting('app.current_user_id', true)
    AND is_quarantined = FALSE
  );

-- ============================================================================
-- 13. SEED DATA (Users, Initial BDT 25 / BDT 11 Rates, Motion Library, Projects)
-- ============================================================================
INSERT INTO users (id, email, full_name, role, free_preview_projects_used)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'admin@aipresentation.bd', 'Platform Administrator', 'admin', 0),
  ('00000000-0000-4000-8000-000000000002', 'customer.one@dhaka-fintech.bd', 'Nadia Rahman', 'customer', 1),
  ('00000000-0000-4000-8000-000000000003', 'customer.two@chattogram-logistics.bd', 'Tanvir Ahmed', 'customer', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO price_configs (
  version, currency, base_rate_bdt, smooth_rate_bdt, cinematic_rate_bdt,
  cinematic_enabled, phase0_desktop_gate_passed, paying_clients_milestone_count,
  free_preview_project_cap, free_preview_revision_cap, quote_ttl_hours,
  is_active, updated_by, change_reason
)
VALUES (
  1, 'BDT', 25, 11, NULL,
  FALSE, FALSE, 0,
  2, 2, 24,
  TRUE, '00000000-0000-4000-8000-000000000001',
  'Initial MVP launch pricing: BDT 25/slide base + BDT 11/slide Smooth motion'
)
ON CONFLICT (version) DO NOTHING;

INSERT INTO motion_library (id, effect_id, category, display_name_en, display_name_bn, template_version, structural_xml_status, desktop_qa_status, enabled, updated_by)
VALUES
  ('transition:fade', 'fade', 'transition', 'Fade', 'ফেড', '2026.10.26-rev2', 'UNVERIFIED', 'UNVERIFIED_EXTERNAL_DESKTOP_REQUIRED', FALSE, '00000000-0000-4000-8000-000000000001'),
  ('transition:wipe', 'wipe', 'transition', 'Wipe', 'ওয়াইপ', '2026.10.26-rev2', 'UNVERIFIED', 'UNVERIFIED_EXTERNAL_DESKTOP_REQUIRED', FALSE, '00000000-0000-4000-8000-000000000001'),
  ('transition:push', 'push', 'transition', 'Push', 'পুশ', '2026.10.26-rev2', 'UNVERIFIED', 'UNVERIFIED_EXTERNAL_DESKTOP_REQUIRED', FALSE, '00000000-0000-4000-8000-000000000001'),
  ('transition:zoom', 'zoom', 'transition', 'Zoom', 'জুম', '2026.10.26-rev2', 'UNVERIFIED', 'UNVERIFIED_EXTERNAL_DESKTOP_REQUIRED', FALSE, '00000000-0000-4000-8000-000000000001'),
  ('entrance:fade', 'fade', 'entrance', 'Fade Entrance', 'ফেড এন্ট্রান্স', '2026.10.26-rev2', 'UNVERIFIED', 'UNVERIFIED_EXTERNAL_DESKTOP_REQUIRED', FALSE, '00000000-0000-4000-8000-000000000001'),
  ('entrance:wipe', 'wipe', 'entrance', 'Wipe Entrance', 'ওয়াইপ এন্ট্রান্স', '2026.10.26-rev2', 'UNVERIFIED', 'UNVERIFIED_EXTERNAL_DESKTOP_REQUIRED', FALSE, '00000000-0000-4000-8000-000000000001'),
  ('entrance:zoom', 'zoom', 'entrance', 'Zoom Entrance', 'জুম এন্ট্রান্স', '2026.10.26-rev2', 'UNVERIFIED', 'UNVERIFIED_EXTERNAL_DESKTOP_REQUIRED', FALSE, '00000000-0000-4000-8000-000000000001'),
  ('entrance:slide_in', 'slide_in', 'entrance', 'Slide In Up', 'স্লাইড ইন', '2026.10.26-rev2', 'UNVERIFIED', 'UNVERIFIED_EXTERNAL_DESKTOP_REQUIRED', FALSE, '00000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (
  id, owner_id, title, language_mode, design_family, input_mode,
  slide_count, motion_tier_requested, state, preview_revisions_used
)
VALUES (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'Q4 Bangladesh Fintech Expansion',
  'bilingual',
  'corporate_slate',
  'prompt',
  8,
  'smooth',
  'design_approved',
  0
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO design_specs (id, project_id, version, is_locked, spec_json)
VALUES (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  1,
  FALSE,
  '{
    "motion_tier": "smooth",
    "intensity": "standard",
    "transition_id": "fade",
    "animation_policy": "1.0.0-phase0",
    "design_family": "corporate_slate",
    "slide_count": 8
  }'::JSONB
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO audit_logs (actor_id, actor_role, action, target_entity, target_id, old_value, new_value)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'admin',
  'SEED_INITIAL_PRICING',
  'price_configs',
  '1',
  NULL,
  '{"version": 1, "base_rate_bdt": 25, "smooth_rate_bdt": 11, "cinematic_enabled": false}'::JSONB
);

COMMIT;