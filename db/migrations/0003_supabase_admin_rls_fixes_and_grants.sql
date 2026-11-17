-- ============================================================================
-- AI Presentation Platform — Supabase deployment migration (0003)
-- Fixes found by actually exercising 0002 against the live database through
-- the real HTTP server, not by inspection. Every one of these was a genuine
-- bug caught by npm run test:api failing for a real reason:
--
--  1. Several tables were missing base GRANTs entirely (RLS restricts which
--     ROWS a role can touch; it does nothing without the underlying SQL
--     privilege to attempt the operation at all).
--  2. price_configs.version/motion_library's admin write policies were split
--     into separate INSERT/UPDATE policies. For UPDATE, PostgreSQL ORs every
--     applicable SELECT policy's USING clause into the implicit "can I still
--     see this row after writing it" check - no WITH CHECK on the UPDATE
--     policy alone can opt out of that. Flipping is_active from TRUE to
--     FALSE then failed the public "is_active = TRUE" SELECT policy. Fixed
--     by replacing both with a single FOR ALL admin policy, so the OR
--     correctly becomes (is_active = TRUE) OR (caller is admin).
--  3. price_configs.version is SERIAL, but 0002 seeded version=1 with an
--     explicit value, never advancing the sequence - exactly the defect
--     docs/source-audit.md flagged ("hard-coded pricing version seed does
--     not advance the serial sequence"). The second real quote update then
--     collided on the primary key.
-- ============================================================================

-- --- Fix 1: missing base grants -------------------------------------------
GRANT UPDATE ON ai_presentation.quotes TO authenticated;
GRANT INSERT, UPDATE ON ai_presentation.price_configs TO authenticated;
GRANT UPDATE ON ai_presentation.motion_library TO authenticated;
GRANT INSERT ON ai_presentation.audit_logs TO authenticated;
GRANT DELETE ON ai_presentation.projects TO authenticated; -- design_specs/quotes cascade via project_id FK

DROP POLICY IF EXISTS quotes_owner_insert ON ai_presentation.quotes;
CREATE POLICY quotes_owner_insert ON ai_presentation.quotes
  FOR INSERT WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS quotes_owner_update ON ai_presentation.quotes;
CREATE POLICY quotes_owner_update ON ai_presentation.quotes
  FOR UPDATE USING (owner_id = auth.uid());

-- --- Fix 2: admin write policies must be FOR ALL, not split INSERT/UPDATE --
DROP POLICY IF EXISTS price_configs_admin_write ON ai_presentation.price_configs;
DROP POLICY IF EXISTS price_configs_admin_update ON ai_presentation.price_configs;
DROP POLICY IF EXISTS price_configs_admin_all ON ai_presentation.price_configs;
CREATE POLICY price_configs_admin_all ON ai_presentation.price_configs
  FOR ALL
  USING (EXISTS (SELECT 1 FROM ai_presentation.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM ai_presentation.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS motion_library_admin_write ON ai_presentation.motion_library;
DROP POLICY IF EXISTS motion_library_admin_update ON ai_presentation.motion_library;
DROP POLICY IF EXISTS motion_library_admin_all ON ai_presentation.motion_library;
CREATE POLICY motion_library_admin_all ON ai_presentation.motion_library
  FOR ALL
  USING (EXISTS (SELECT 1 FROM ai_presentation.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM ai_presentation.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- audit_logs is INSERT-only (no SELECT policy at all - deliberately
-- inaccessible except to a direct privileged connection), so it isn't
-- subject to the same OR-with-SELECT trap and didn't need this fix.
DROP POLICY IF EXISTS audit_logs_admin_insert ON ai_presentation.audit_logs;
CREATE POLICY audit_logs_admin_insert ON ai_presentation.audit_logs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM ai_presentation.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- --- Fix 3: resync the price_configs serial sequence -----------------------
SELECT setval(
  pg_get_serial_sequence('ai_presentation.price_configs', 'version'),
  COALESCE((SELECT MAX(version) FROM ai_presentation.price_configs), 1)
);

-- ============================================================================
-- Manual step, NOT run by this file (contains a generated secret - do not
-- commit real credentials to a migration): a dedicated least-privilege
-- Postgres role for this app's own DATABASE_URL connection, scoped to this
-- schema only, NOT superuser/BYPASSRLS, member of `authenticated` (so
-- `SET ROLE authenticated` in server/http/db.ts works) -
--
--   CREATE ROLE ai_presentation_app LOGIN PASSWORD '<generated>'
--     NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 20;
--   GRANT authenticated TO ai_presentation_app;
--   GRANT CONNECT ON DATABASE postgres TO ai_presentation_app;
--   GRANT DELETE ON ai_presentation.projects, ai_presentation.quotes,
--     ai_presentation.design_specs TO ai_presentation_app; -- test-fixture cleanup only
--
-- Already applied to the live project. DATABASE_URL in .env.local uses this
-- role via the Supavisor session pooler (the direct db.<ref>.supabase.co
-- host is IPv6-only for this project and didn't resolve from this network):
--   postgresql://ai_presentation_app.<project_ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
-- ============================================================================
