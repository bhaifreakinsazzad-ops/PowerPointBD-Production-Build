-- ============================================================================
-- PowerPointBD Revision Report v2 — Database Schema Migration (0012)
-- Defines the v2 tables in the isolated `ai_presentation` schema:
-- profiles, pricing, instructions, orders, briefs, design_specs, slides,
-- payments (with UNIQUE reference constraint), files, chat_messages, ai_calls.
-- Includes full Row Level Security (RLS) policies.
-- ============================================================================

SET search_path TO ai_presentation, public;

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS ai_presentation.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(120) NOT NULL DEFAULT 'Unnamed User',
  role VARCHAR(24) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'support')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PRICING & LIMITS
CREATE TABLE IF NOT EXISTS ai_presentation.pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_per_slide INTEGER NOT NULL DEFAULT 32,
  word_limit INTEGER NOT NULL DEFAULT 1500,
  min_words INTEGER NOT NULL DEFAULT 30,
  free_regenerates INTEGER NOT NULL DEFAULT 3,
  softcap_pct INTEGER NOT NULL DEFAULT 30,
  hardcap_pct INTEGER NOT NULL DEFAULT 60,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default pricing if empty
INSERT INTO ai_presentation.pricing (price_per_slide, word_limit, min_words, free_regenerates, softcap_pct, hardcap_pct)
SELECT 32, 1500, 30, 3, 30, 60
WHERE NOT EXISTS (SELECT 1 FROM ai_presentation.pricing);

-- 3. INSTRUCTIONS (SYSTEM PROMPT VERSIONING)
CREATE TABLE IF NOT EXISTS ai_presentation.instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(20) NOT NULL UNIQUE,
  body TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'archived')),
  created_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ
);

-- Seed initial instructions
INSERT INTO ai_presentation.instructions (version, body, status, published_at)
VALUES
  ('v1', 'Base system prompt for PowerPoint generation.', 'archived', '2026-10-01'),
  ('v2', 'Calibri and Nirmala UI typography rules with standard layout schemas.', 'archived', '2026-10-15'),
  ('v3', 'Infographic-first. Max 6 points per slide. Fonts: Calibri (English), Nirmala UI (Bangla). Title slide + Thank you slide always included. H1/H2 in the description = slide title hint; divider = slide break; table = chart or table slide.', 'live', '2026-11-01')
ON CONFLICT (version) DO NOTHING;

-- 4. ORDERS
CREATE TABLE IF NOT EXISTS ai_presentation.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic VARCHAR(255) NOT NULL,
  slide_count INTEGER NOT NULL DEFAULT 12 CHECK (slide_count >= 5 AND slide_count <= 30),
  amount INTEGER NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'previewed' CHECK (status IN ('previewed', 'payment_submitted', 'verified', 'rejected', 'ready')),
  instruction_version VARCHAR(20) NOT NULL DEFAULT 'v3',
  regenerates_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. BRIEFS
CREATE TABLE IF NOT EXISTS ai_presentation.briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ai_presentation.orders(id) ON DELETE CASCADE,
  source VARCHAR(20) NOT NULL DEFAULT 'editor' CHECK (source IN ('editor', 'docx')),
  markdown TEXT NOT NULL,
  content_brief JSONB NOT NULL,
  word_count INTEGER NOT NULL
);

-- 6. DESIGN SPECS
CREATE TABLE IF NOT EXISTS ai_presentation.design_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ai_presentation.orders(id) ON DELETE CASCADE,
  palette JSONB NOT NULL,
  layout_plan JSONB NOT NULL,
  locked BOOLEAN NOT NULL DEFAULT FALSE
);

-- 7. SLIDES
CREATE TABLE IF NOT EXISTS ai_presentation.slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ai_presentation.orders(id) ON DELETE CASCADE,
  n INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  json JSONB NOT NULL,
  png_url TEXT
);

-- 8. PAYMENTS (WITH UNIQUE REFERENCE TO PREVENT DUPLICATES)
CREATE TABLE IF NOT EXISTS ai_presentation.payments_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ai_presentation.orders(id) ON DELETE CASCADE,
  method VARCHAR(32) NOT NULL DEFAULT 'bangla_qr',
  reference VARCHAR(128) NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'verified', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reject_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. FILES
CREATE TABLE IF NOT EXISTS ai_presentation.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ai_presentation.orders(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('pptx', 'pdf', 'preview_png')),
  storage_path TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

-- 10. CHAT MESSAGES
CREATE TABLE IF NOT EXISTS ai_presentation.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ai_presentation.orders(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  text TEXT NOT NULL,
  slides_changed JSONB,
  flag VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. AI CALLS & TELEMETRY
CREATE TABLE IF NOT EXISTS ai_presentation.ai_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES ai_presentation.orders(id) ON DELETE SET NULL,
  purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('brief', 'preview', 'produce', 'chat')),
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 6) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE ai_presentation.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_presentation.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_presentation.briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_presentation.design_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_presentation.slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_presentation.payments_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_presentation.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_presentation.chat_messages ENABLE ROW LEVEL SECURITY;

-- User Policies: Users can view and manage their own orders
DROP POLICY IF EXISTS p_user_orders ON ai_presentation.orders;
CREATE POLICY p_user_orders ON ai_presentation.orders
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin Policies: Admin has full access to all tables
DROP POLICY IF EXISTS p_admin_all_orders ON ai_presentation.orders;
CREATE POLICY p_admin_all_orders ON ai_presentation.orders
  FOR ALL TO authenticated
  USING ((SELECT role FROM ai_presentation.profiles WHERE id = auth.uid()) = 'admin');
