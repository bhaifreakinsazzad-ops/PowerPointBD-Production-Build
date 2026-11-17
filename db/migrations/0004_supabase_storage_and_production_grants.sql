-- ============================================================================
-- AI Presentation Platform — Supabase deployment migration (0004)
-- Adds private asset storage and the grants/RLS needed for the real
-- production pipeline (POST /projects/:id/produce, GET /status, GET /download).
-- ============================================================================

-- Dedicated private bucket, NOT the existing public.product-files bucket
-- (that belongs to the other app sharing this project).
INSERT INTO storage.buckets (id, name, public)
VALUES ('private-presentations', 'private-presentations', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Objects are stored under "{owner_id}/{project_id}/{job_id}.pptx". Our own
-- backend acts AS the authenticated user (their own verified access token,
-- not a service-role bypass we don't have configured), so it needs real
-- read/write grants scoped to that owner prefix - never another user's.
DROP POLICY IF EXISTS presentations_owner_read ON storage.objects;
CREATE POLICY presentations_owner_read ON storage.objects
  FOR SELECT
  USING (bucket_id = 'private-presentations' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS presentations_owner_write ON storage.objects;
CREATE POLICY presentations_owner_write ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'private-presentations' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS presentations_owner_update ON storage.objects;
CREATE POLICY presentations_owner_update ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'private-presentations' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'private-presentations' AND (storage.foldername(name))[1] = auth.uid()::text);

-- jobs/generated_assets previously had SELECT-only grants (0002) - the
-- production route needs to actually write them.
GRANT INSERT, UPDATE ON ai_presentation.jobs TO authenticated;
GRANT INSERT ON ai_presentation.generated_assets TO authenticated;

DROP POLICY IF EXISTS jobs_owner_insert ON ai_presentation.jobs;
CREATE POLICY jobs_owner_insert ON ai_presentation.jobs
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS jobs_owner_update ON ai_presentation.jobs;
CREATE POLICY jobs_owner_update ON ai_presentation.jobs
  FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS assets_owner_insert ON ai_presentation.generated_assets;
CREATE POLICY assets_owner_insert ON ai_presentation.generated_assets
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- ============================================================================
-- Manual step, NOT run by this file: a permanent fixture project + quote +
-- payment + entitlement for server/http/test-production-pipeline.ts, owned
-- by the integration-test-a fixture user. ai_presentation.entitlements has
-- no owner-insert RLS policy by design (only a real verified payment should
-- ever grant one), so this cannot be created through the API - it was
-- inserted once via a privileged connection. See docs/STATUS.md for the
-- exact IDs; do not recreate it, and never delete it via a blanket
-- "delete all of this user's projects" cleanup (payments/entitlements
-- reference it with ON DELETE RESTRICT).
-- ============================================================================
