-- ============================================================================
-- AI Presentation Platform — Supabase deployment migration (0005)
-- Adds POST /checkout/session and POST /webhooks/:provider support: a real
-- checkout session (owner-scoped RLS) and a real webhook handler whose only
-- authentication is its own HMAC signature (no Supabase Auth session exists
-- for an external payment provider calling us, so auth.uid()-based RLS
-- cannot apply here at all).
-- ============================================================================

-- --- Checkout: owner creates their own payment/session row -----------------
GRANT INSERT ON ai_presentation.payments TO authenticated;

DROP POLICY IF EXISTS payments_owner_insert ON ai_presentation.payments;
CREATE POLICY payments_owner_insert ON ai_presentation.payments
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- ============================================================================
-- Manual step, NOT run by this file (contains a generated secret - never
-- commit real credentials to a migration): a SECOND dedicated role, kept
-- separate from ai_presentation_app, scoped to exactly what webhook
-- processing needs. It has BYPASSRLS because there is genuinely no
-- auth.uid() to check against for this caller - the HMAC signature verified
-- in server/http/routes/webhooks.ts before this role is ever touched IS the
-- security boundary. Keeping it as its own role (not just granting
-- ai_presentation_app more privileges) bounds the blast radius of a leak to
-- exactly the webhook's own operations.
--
--   CREATE ROLE ai_presentation_webhook LOGIN PASSWORD '<generated>'
--     NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS
--     CONNECTION LIMIT 5;
--   GRANT USAGE ON SCHEMA ai_presentation TO ai_presentation_webhook;
--   GRANT CONNECT ON DATABASE postgres TO ai_presentation_webhook;
--   GRANT SELECT, UPDATE ON ai_presentation.payments TO ai_presentation_webhook;
--   GRANT SELECT, INSERT, DELETE ON ai_presentation.payment_webhook_events TO ai_presentation_webhook;
--   GRANT SELECT, INSERT, DELETE ON ai_presentation.entitlements TO ai_presentation_webhook;
--   GRANT SELECT ON ai_presentation.quotes, ai_presentation.design_specs TO ai_presentation_webhook;
--   GRANT SELECT, UPDATE, DELETE ON ai_presentation.projects TO ai_presentation_webhook;
--   GRANT INSERT ON ai_presentation.audit_logs TO ai_presentation_webhook;
--   GRANT SELECT, DELETE ON ai_presentation.jobs TO ai_presentation_webhook; -- test cleanup only
--
-- (DELETE grants beyond payment_webhook_events are only exercised by
-- server/http/test-checkout-webhook.ts's own fixture cleanup - the webhook
-- handler itself never deletes anything.)
--
-- Already applied to the live project. WEBHOOK_DATABASE_URL in .env.local
-- uses this role via the same Supavisor pooler as DATABASE_URL, with a
-- DIFFERENT password from ai_presentation_app.
-- ============================================================================
