import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Pool } from 'pg';
import { isDeepStrictEqual } from 'node:util';
import { ApiError } from './errors.ts';

interface SandboxPayload {
  event_id: string;
  provider_session_id: string;
  status: 'VALID' | 'FAILED';
  amount_bdt: number;
  currency: 'BDT';
}
type Outcome = 'verified' | 'failed' | 'ignored_terminal' | 'amount_mismatch'
  | 'snapshot_mismatch' | 'quote_not_payable' | 'entitlement_conflict' | 'project_not_payable';
const REVIEW_CODES: Partial<Record<Outcome, string>> = {
  amount_mismatch: 'AMOUNT_MISMATCH', snapshot_mismatch: 'PAYMENT_SNAPSHOT_MISMATCH',
  quote_not_payable: 'PAYMENT_REQUIRES_REVIEW', entitlement_conflict: 'ENTITLEMENT_CONFLICT',
  project_not_payable: 'PAYMENT_REQUIRES_REVIEW',
};
export function sandboxOutcomeResponse(outcome: Outcome | null, replay = false) {
  const code = outcome && REVIEW_CODES[outcome];
  return code ? { status: 409, body: { ok: false, error: {
    code, message: 'Payment could not grant production access and requires review.',
  } } } : { status: 200, body: { ok: true, data: {
    ...(outcome ? { outcome } : {}), ...(replay ? { already_processed: true } : {}),
  } } };
}

function parseSignedPayload(raw: Buffer, signature: string | undefined, secret: string): SandboxPayload {
  if (!secret) throw new ApiError(503, 'SANDBOX_WEBHOOK_UNAVAILABLE', 'Sandbox webhook is not configured.');
  if (!signature || !/^[a-f\d]{64}$/i.test(signature)) {
    throw new ApiError(401, 'INVALID_SIGNATURE', 'Webhook signature verification failed.');
  }
  const expected = createHmac('sha256', secret).update(raw).digest();
  if (!timingSafeEqual(Buffer.from(signature, 'hex'), expected)) {
    throw new ApiError(401, 'INVALID_SIGNATURE', 'Webhook signature verification failed.');
  }
  let value: unknown;
  try { value = JSON.parse(raw.toString('utf8')); }
  catch { throw new ApiError(400, 'INVALID_WEBHOOK_PAYLOAD', 'Webhook payload must be valid JSON.'); }
  const body = value as Partial<SandboxPayload> | null;
  const identifier = (item: unknown): item is string => typeof item === 'string' && /^[A-Za-z\d_.:-]{1,128}$/.test(item);
  if (!body || Array.isArray(body) || !identifier(body.event_id) || !identifier(body.provider_session_id)
      || !['VALID', 'FAILED'].includes(body.status ?? '') || body.currency !== 'BDT'
      || typeof body.amount_bdt !== 'number' || !Number.isSafeInteger(body.amount_bdt)
      || body.amount_bdt < 0 || body.amount_bdt > 2_147_483_647) {
    throw new ApiError(400, 'INVALID_WEBHOOK_PAYLOAD', 'Webhook payload has invalid fields.');
  }
  return body as SandboxPayload;
}

/** Sandbox mechanics only. Signature failures never reach the database or reserve IDs. */
export function createSandboxPaymentService(db: Pool, secret: string) {
  return async function processWebhook(raw: Buffer, signature?: string) {
    const payload = parseSignedPayload(raw, signature, secret);
    const payloadHash = createHash('sha256').update(raw).digest('hex');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout = '10s'");
      await client.query("SET LOCAL lock_timeout = '10s'");
      // Event-level lock covers concurrent identical IDs even before an event row exists.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`mock_sandbox:${payload.event_id}`]);
      const event = (await client.query(`SELECT signature_valid, payload_sha256, raw_payload, processing_outcome
        FROM ai_presentation.payment_webhook_events
        WHERE provider = 'mock_sandbox' AND provider_event_id = $1`, [payload.event_id])).rows[0];
      if (event?.signature_valid) {
        if (!isDeepStrictEqual(event.raw_payload, payload)) {
          throw new ApiError(409, 'WEBHOOK_EVENT_CONFLICT', 'This event ID was already used for different content.');
        }
        await client.query('COMMIT');
        return sandboxOutcomeResponse(event.processing_outcome as Outcome | null, true);
      }
      // Repair a legacy poisoned ID only after authenticating a real delivery.
      if (event) await client.query(`DELETE FROM ai_presentation.payment_webhook_events
        WHERE provider = 'mock_sandbox' AND provider_event_id = $1 AND signature_valid = FALSE`, [payload.event_id]);

      const candidate = (await client.query(`SELECT id, project_id FROM ai_presentation.payments
        WHERE provider = 'mock_sandbox' AND provider_session_id = $1`, [payload.provider_session_id])).rows[0];
      if (!candidate) throw new ApiError(404, 'PAYMENT_SESSION_NOT_FOUND', 'Payment session was not found.');
      // Project before payment/quote: serialize competing sessions and match checkout lock order.
      const project = (await client.query('SELECT * FROM ai_presentation.projects WHERE id = $1 FOR UPDATE', [candidate.project_id])).rows[0];
      const payment = (await client.query('SELECT * FROM ai_presentation.payments WHERE id = $1 FOR UPDATE', [candidate.id])).rows[0];
      const quote = (await client.query(`SELECT q.*, q.expires_at > clock_timestamp() AS not_expired,
          (q.owner_id = p.owner_id AND q.project_id = p.project_id AND q.tier = p.tier
           AND q.quote_amount = p.quote_amount AND q.quote_amount_paisa = p.quote_amount_paisa
           AND q.quote_breakdown = p.quote_breakdown AND p.currency = 'BDT'
           AND q.quote_amount_paisa = q.quote_amount::bigint * 100
           AND p.quote_amount_paisa = p.quote_amount::bigint * 100
           AND s.project_id = q.project_id AND s.is_locked
           AND s.spec_json->>'motion_tier' = q.tier
           AND (s.spec_json->>'slide_count')::integer = q.slide_count) AS snapshot_matches
        FROM ai_presentation.quotes q
        JOIN ai_presentation.payments p ON p.quote_id = q.id AND p.id = $1
        JOIN ai_presentation.design_specs s ON s.id = q.design_spec_id
        FOR UPDATE OF q`, [payment.id])).rows[0];
      let outcome: Outcome;
      if (payment.status === 'refunded') outcome = 'ignored_terminal';
      else if (!project || !quote?.snapshot_matches || project.owner_id !== payment.owner_id) outcome = 'snapshot_mismatch';
      else if (payload.amount_bdt !== payment.quote_amount) outcome = 'amount_mismatch';
      else if (payment.status === 'verified') {
        // Further provider events cannot downgrade paid money, re-grant revoked access,
        // consume swaps or reset producing/delivered project state.
        outcome = 'ignored_terminal';
      } else if (project.state === 'cancelled') outcome = 'project_not_payable';
      else if (!quote.not_expired || quote.status !== 'active') outcome = 'quote_not_payable';
      else if (payload.status === 'FAILED') {
        await client.query("UPDATE ai_presentation.payments SET status = 'failed', updated_at = NOW() WHERE id = $1", [payment.id]);
        outcome = 'failed';
      } else {
        const entitlement = (await client.query('SELECT * FROM ai_presentation.entitlements WHERE project_id = $1', [payment.project_id])).rows[0];
        if (entitlement && (entitlement.payment_id !== payment.id || entitlement.status !== 'active'
            || entitlement.design_spec_id !== quote.design_spec_id || entitlement.owner_id !== payment.owner_id
            || entitlement.motion_tier !== payment.tier)) outcome = 'entitlement_conflict';
        else {
          await client.query(`UPDATE ai_presentation.payments SET status = 'verified',
            webhook_signature_verified = TRUE, verified_at = NOW(), updated_at = NOW() WHERE id = $1`, [payment.id]);
          if (!entitlement) await client.query(`INSERT INTO ai_presentation.entitlements
            (project_id, owner_id, payment_id, design_spec_id, motion_tier, status)
            VALUES ($1,$2,$3,$4,$5,'active')`, [payment.project_id, payment.owner_id, payment.id, quote.design_spec_id, payment.tier]);
          await client.query("UPDATE ai_presentation.quotes SET status = 'paid' WHERE id = $1", [quote.id]);
          await client.query("UPDATE ai_presentation.projects SET state = 'paid', updated_at = NOW() WHERE id = $1", [payment.project_id]);
          outcome = 'verified';
        }
      }
      await client.query(`INSERT INTO ai_presentation.payment_webhook_events
        (provider, provider_event_id, payment_id, signature_valid, payload_sha256, raw_payload, processing_outcome)
        VALUES ('mock_sandbox',$1,$2,TRUE,$3,$4,$5)`, [payload.event_id, payment.id, payloadHash, JSON.stringify(payload), outcome]);
      await client.query(`INSERT INTO ai_presentation.audit_logs
        (actor_id,actor_role,action,target_entity,target_id,new_value)
        VALUES ($1,'system','SANDBOX_PAYMENT_EVENT_PROCESSED','payments',$2,$3)`,
        [payment.owner_id, payment.id, JSON.stringify({ provider_event_id: payload.event_id, outcome })]);
      await client.query('COMMIT');
      return sandboxOutcomeResponse(outcome);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  };
}
