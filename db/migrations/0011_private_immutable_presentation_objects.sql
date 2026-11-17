-- Scoped ONLY to this platform's bucket/policies. Other shared apps untouched.
-- Browser users may read rendered images and verified paid output, never the
-- unpaid source PPTX. All writes are from the worker service account.
BEGIN;
DROP POLICY IF EXISTS presentations_owner_write ON storage.objects;
DROP POLICY IF EXISTS presentations_owner_update ON storage.objects;
DROP POLICY IF EXISTS presentations_owner_read ON storage.objects;
CREATE FUNCTION ai_presentation.can_read_presentation_object(object_key text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,ai_presentation AS $$ SELECT EXISTS (
    SELECT 1 FROM ai_presentation.generated_assets a JOIN ai_presentation.jobs j ON j.id=a.job_id
    WHERE a.storage_bucket='private-presentations' AND a.storage_key=object_key
      AND a.owner_id=(SELECT auth.uid()) AND j.owner_id=(SELECT auth.uid()) AND a.project_id=j.project_id
      AND a.is_private AND NOT a.is_quarantined AND j.status='completed' AND j.validation_report->>'passed'='true'
      AND (
        (a.asset_type='preview_image' AND j.job_type='static_preview')
        OR (a.asset_type='pptx_deck' AND j.job_type='pptx_production' AND EXISTS (
          SELECT 1 FROM ai_presentation.entitlements e
          JOIN ai_presentation.payments pay ON pay.id=e.payment_id
          JOIN ai_presentation.quotes q ON q.id=pay.quote_id
          JOIN ai_presentation.design_specs s ON s.id=e.design_spec_id
          JOIN ai_presentation.projects p ON p.id=e.project_id
          WHERE e.id=j.entitlement_id AND e.project_id=j.project_id AND e.owner_id=(SELECT auth.uid())
            AND pay.project_id=j.project_id AND pay.owner_id=(SELECT auth.uid()) AND q.owner_id=(SELECT auth.uid()) AND q.project_id=j.project_id
            AND p.owner_id=(SELECT auth.uid()) AND p.state<>'cancelled' AND e.status='active'
            AND e.design_spec_id=j.design_spec_id AND q.design_spec_id=s.id AND s.project_id=j.project_id AND s.is_locked
            AND pay.status='verified' AND pay.webhook_signature_verified AND q.status='paid'
            AND e.motion_tier=q.tier AND q.tier=pay.tier AND q.tier=s.spec_json->>'motion_tier'
            AND pay.currency='BDT' AND pay.quote_amount=q.quote_amount AND pay.quote_amount_paisa=q.quote_amount_paisa
            AND pay.quote_breakdown=q.quote_breakdown
        ))
      )
  ) $$;
REVOKE ALL ON FUNCTION ai_presentation.can_read_presentation_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_presentation.can_read_presentation_object(text) TO authenticated;
CREATE POLICY presentations_owner_read ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id='private-presentations' AND ai_presentation.can_read_presentation_object(name));
-- Restrictive policies also contain any broader permissive policy inherited
-- from another app in the shared project; other buckets keep their own rules.
CREATE POLICY presentations_read_boundary ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING (
  bucket_id<>'private-presentations' OR ai_presentation.can_read_presentation_object(name));
CREATE POLICY presentations_insert_boundary ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'private-presentations');
CREATE POLICY presentations_update_boundary ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'private-presentations') WITH CHECK(bucket_id<>'private-presentations');
CREATE POLICY presentations_delete_boundary ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'private-presentations');
CREATE POLICY presentations_anon_boundary ON storage.objects AS RESTRICTIVE FOR ALL TO anon USING(bucket_id<>'private-presentations') WITH CHECK(bucket_id<>'private-presentations');
COMMIT;
