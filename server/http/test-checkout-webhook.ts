/**
 * Real end-to-end test of the FULL customer journey with zero manual SQL:
 * sign up -> create project -> configure motion -> get a quote -> create a
 * checkout session -> simulate a signed webhook delivery -> entitlement is
 * granted automatically -> produce -> download. This is the first time in
 * this project that an entitlement exists without me inserting it by hand.
 *
 * "Simulated webhook delivery" means: this script signs the payload with
 * the real MOCK_PAYMENT_WEBHOOK_SECRET and POSTs it to the real
 * /webhooks/mock_sandbox route, exactly as a real provider would call it -
 * it does not reach into the database directly.
 */
import { createHmac, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createApp } from './app.ts';
import { env } from './env.ts';
import { waitForJob } from './wait-for-job.ts';
import { webhookPool } from './db.ts';
import { integrationFixtureUser } from './test-fixtures.ts';

import { assertIntegrationTarget } from './integration-safety.ts';
assertIntegrationTarget(env);

const USER_A_ID = 'f0000000-0000-4000-8000-00000000000a';

async function json(res: Response): Promise<any> {
  return res.json();
}

async function main() {
  const USER_A = integrationFixtureUser('A');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  const { data } = await supabase.auth.signInWithPassword(USER_A);
  const token = data.session!.access_token;

  const app = createApp();
  const server = app.listen(0);
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const call = (path: string, init: RequestInit = {}) =>
    fetch(`${base}${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });

  const results: string[] = [];
  const check = (name: string, cond: boolean) => {
    if (!cond) throw new Error(`FAILED: ${name}`);
    results.push(`PASS: ${name}`);
  };

  let projectId: string | undefined;
  try {
    const created = await json(await call('/projects', { method: 'POST', body: JSON.stringify({ title: 'Full Journey Test', slide_count: 6, motion_tier_requested: 'static' }) }));
    projectId = created.data.project.id;
    await call(`/projects/${projectId}/motion`, { method: 'POST', body: JSON.stringify({ motion_tier: 'static', transition_id: null, intensity: null }) });
    const quoted = await json(await call(`/projects/${projectId}/quote`, { method: 'POST', body: '{}' }));
    check('quote created', quoted.data.quote.status === 'active');

    const produceBeforePayRes = await call(`/projects/${projectId}/produce`, { method: 'POST', body: JSON.stringify({ idempotency_key: `before_pay_${Date.now()}` }) });
    check('produce blocked before payment (403 ENTITLEMENT_REQUIRED)', produceBeforePayRes.status === 403);

    const checkoutRes = await call('/checkout/session', { method: 'POST', body: JSON.stringify({ quote_id: quoted.data.quote.id, idempotency_key: `checkout_${Date.now()}` }) });
    const checkoutBody = await json(checkoutRes);
    check('checkout session created (201)', checkoutRes.status === 201);
    check('payment is pending', checkoutBody.data.payment.status === 'pending');

    // --- Simulate the provider calling our webhook, signed for real ---
    const webhookPayload = JSON.stringify({
      event_id: randomUUID(),
      provider_session_id: checkoutBody.data.payment.provider_session_id,
      status: 'VALID',
      amount_bdt: checkoutBody.data.payment.quote_amount,
      currency: 'BDT',
    });
    const signature = createHmac('sha256', env.MOCK_PAYMENT_WEBHOOK_SECRET).update(webhookPayload).digest('hex');
    const webhookRes = await fetch(`${base}/webhooks/mock_sandbox`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Mock-Signature': signature },
      body: webhookPayload,
    });
    const webhookBody = await json(webhookRes);
    check('webhook accepted and verified (200, outcome=verified)', webhookRes.status === 200 && webhookBody.data.outcome === 'verified');

    // Replaying the exact same event must be a no-op, not a double-grant.
    const replayRes = await fetch(`${base}/webhooks/mock_sandbox`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Mock-Signature': signature },
      body: webhookPayload,
    });
    const replayBody = await json(replayRes);
    check('duplicate webhook event is a no-op', replayRes.status === 200 && replayBody.data.already_processed === true);

    // A tampered signature must be rejected outright.
    const badSigRes = await fetch(`${base}/webhooks/mock_sandbox`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Mock-Signature': 'deadbeef'.repeat(8) },
      body: JSON.stringify({ event_id: randomUUID(), provider_session_id: checkoutBody.data.payment.provider_session_id, status: 'VALID', amount_bdt: 999999, currency: 'BDT' }),
    });
    check('tampered signature rejected (401)', badSigRes.status === 401);

    // --- Entitlement now exists with ZERO manual SQL. Produce and download for real. ---
    const produceRes = await call(`/projects/${projectId}/produce`, { method: 'POST', body: JSON.stringify({ idempotency_key: `after_pay_${Date.now()}` }) });
    const produceBody = await json(produceRes);
    check('production queues after payment verification', produceRes.status === 202 && produceBody.data.job.status === 'queued');
    await waitForJob(call, projectId!, produceBody.data.job.id);

    const downloadRes = await call(`/projects/${projectId}/download`);
    const downloadBody = await json(downloadRes);
    check('download succeeds through the fully automated journey', downloadRes.status === 200 && downloadBody.data.size_bytes > 0);

    console.log(`\n=== Full Customer Journey (zero manual SQL) ===`);
    for (const line of results) console.log(`  ✓ ${line}`);
    console.log(`\nResult: ${results.length}/${results.length} PASSED.\n`);
  } finally {
    // webhookPool (BYPASSRLS) because deleting entitlements/payments isn't
    // something any RLS policy permits (correctly - only this test's own
    // cleanup, acting like an operator, should ever hard-delete these).
    if (projectId) {
      try {
        // jobs.entitlement_id and entitlements.project_id are both plain
        // REFERENCES (default RESTRICT) - jobs must go before entitlements,
        // and generated_assets cascades automatically once its owning job
        // is deleted (ON DELETE CASCADE on jobs.id in migration 0002).
        await webhookPool.query('DELETE FROM ai_presentation.jobs WHERE project_id = $1', [projectId]);
        await webhookPool.query('DELETE FROM ai_presentation.entitlements WHERE project_id = $1', [projectId]);
        await webhookPool.query('DELETE FROM ai_presentation.payment_webhook_events WHERE payment_id IN (SELECT id FROM ai_presentation.payments WHERE project_id = $1)', [projectId]);
        await webhookPool.query('DELETE FROM ai_presentation.payments WHERE project_id = $1', [projectId]);
        await webhookPool.query('DELETE FROM ai_presentation.projects WHERE id = $1', [projectId]);
      } catch (e) {
        console.error('cleanup failed (non-fatal):', e instanceof Error ? e.message : e);
      }
    }
    server.close();
  }
}

main().catch((err) => {
  console.error('FULL JOURNEY TEST FAILED:', err);
  process.exitCode = 1;
});
