-- Local-tested additive hardening. Apply remotely only on an authorized target.
BEGIN;

ALTER TABLE ai_presentation.payment_webhook_events
  ADD COLUMN IF NOT EXISTS processing_outcome VARCHAR(48);

-- A locked specification cannot be unlocked, rebound or rewritten in two steps.
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

-- Fail closed at execution too: the worker needs to read the paid quote chain.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_presentation_worker') THEN
    GRANT SELECT ON ai_presentation.payments, ai_presentation.quotes TO ai_presentation_worker;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_presentation_webhook') THEN
    GRANT UPDATE ON ai_presentation.quotes TO ai_presentation_webhook;
  END IF;
END $$;
COMMIT;
