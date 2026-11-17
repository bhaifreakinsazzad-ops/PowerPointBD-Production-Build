/**
 * Real test of the background worker's crash-recovery and retry/backoff
 * state machine, run directly against the live database (no HTTP layer -
 * this is purely about claimNextAvailableJob/executeClaimedJob).
 *
 * SUPABASE_SERVICE_ROLE_KEY is not configured in this environment (see
 * docs/BLOCKERS.md), so every claimed job here will fail at the storage
 * step - that is the EXPECTED, correct behavior being tested: a worker
 * with no live user session and no service key cannot complete a storage
 * upload, and must back off and retry rather than silently succeed or
 * crash the whole process. The claim/lease/attempts/backoff/quarantine
 * mechanics are exactly what a real crash-recovered job would go through.
 */
import { randomUUID } from 'node:crypto';
import { runOneTick } from './worker.ts';
import { webhookPool } from './db.ts';

import { assertIntegrationTarget } from './integration-safety.ts';
import { env } from './env.ts';
assertIntegrationTarget(env);
if (env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('This failure-path suite requires an isolated target without worker storage credentials.');
}

const FIXTURE_PROJECT_ID = '735b4bdc-c9ad-47a7-b0b7-1c5da2d04213'; // permanent production-pipeline fixture
const FIXTURE_OWNER_ID = 'f0000000-0000-4000-8000-00000000000a';

async function getFixtureRefs() {
  const spec = await webhookPool.query('SELECT id FROM ai_presentation.design_specs WHERE project_id = $1 ORDER BY version DESC LIMIT 1', [FIXTURE_PROJECT_ID]);
  const entitlement = await webhookPool.query("SELECT id FROM ai_presentation.entitlements WHERE project_id = $1 AND status = 'active'", [FIXTURE_PROJECT_ID]);
  return { designSpecId: spec.rows[0].id, entitlementId: entitlement.rows[0].id };
}

async function fetchJob(jobId: string) {
  const r = await webhookPool.query('SELECT * FROM ai_presentation.jobs WHERE id = $1', [jobId]);
  return r.rows[0];
}

async function main() {
  const results: string[] = [];
  const check = (name: string, cond: boolean) => {
    if (!cond) throw new Error(`FAILED: ${name}`);
    results.push(`PASS: ${name}`);
  };

  const { designSpecId, entitlementId } = await getFixtureRefs();
  const jobId = randomUUID();

  try {
    // --- Scenario 1: crash recovery. Simulate a worker that died mid-job:
    // status='running' with an ALREADY-EXPIRED lease (as if the process
    // that claimed it never came back).
    await webhookPool.query(
      `INSERT INTO ai_presentation.jobs
         (id, project_id, owner_id, design_spec_id, entitlement_id, idempotency_key, job_type, status, attempts, max_attempts, lease_expires_at, animation_choices)
       VALUES ($1, $2, $3, $4, $5, $6, 'pptx_production', 'running', 0, 3, NOW() - INTERVAL '1 minute', '{}'::jsonb)`,
      [jobId, FIXTURE_PROJECT_ID, FIXTURE_OWNER_ID, designSpecId, entitlementId, `worker_recovery_test_${Date.now()}`]
    );

    const tick1 = await runOneTick(jobId);
    check('tick 1 claims the crashed job (not empty)', tick1 === 'claimed');
    const afterTick1 = await fetchJob(jobId);
    check('attempts incremented to 1 on first claim (crash recovery)', afterTick1.attempts === 1);
    check(
      'job failed at the storage step (no live session, no service key) - expected, not a bug',
      afterTick1.status === 'failed' && afterTick1.error_code === 'WORKER_STORAGE_CREDENTIALS_MISSING'
    );
    check('next_retry_at was set for a future retry', new Date(afterTick1.next_retry_at).getTime() > Date.now());
    const firstBackoffMs = new Date(afterTick1.next_retry_at).getTime() - Date.now();
    check('backoff is roughly 30s for attempt 1', firstBackoffMs > 25000 && firstBackoffMs < 35000);

    // --- Scenario 2: not due yet -> nothing claimable.
    const tick2 = await runOneTick(jobId);
    const afterTick2 = await fetchJob(jobId);
    check('tick 2 reports empty because this job is still in backoff', tick2 === 'empty' && afterTick2.attempts === 1);

    // --- Scenario 3: fast-forward past the backoff window, retry again.
    await webhookPool.query("UPDATE ai_presentation.jobs SET next_retry_at = NOW() - INTERVAL '1 second' WHERE id = $1", [jobId]);
    const tick3 = await runOneTick(jobId);
    check('tick 3 claims the retry-due job', tick3 === 'claimed');
    const afterTick3 = await fetchJob(jobId);
    check('attempts incremented to 2 on retry', afterTick3.attempts === 2);
    check('still failed (same missing credential)', afterTick3.status === 'failed');
    const secondBackoffMs = new Date(afterTick3.next_retry_at).getTime() - Date.now();
    check('backoff roughly doubled for attempt 2 (~60s)', secondBackoffMs > 50000 && secondBackoffMs < 70000);

    // --- Scenario 4: exhaust max_attempts (3) -> permanent quarantine, never retried again.
    await webhookPool.query("UPDATE ai_presentation.jobs SET next_retry_at = NOW() - INTERVAL '1 second' WHERE id = $1", [jobId]);
    const tick4 = await runOneTick(jobId);
    check('tick 4 claims the final retry', tick4 === 'claimed');
    const afterTick4 = await fetchJob(jobId);
    check('attempts reached max_attempts (3)', afterTick4.attempts === 3);
    check('job is permanently quarantined, not just failed', afterTick4.status === 'quarantined');
    check('quarantined job has no next_retry_at (will never be auto-retried again)', afterTick4.next_retry_at === null);

    await webhookPool.query("UPDATE ai_presentation.jobs SET next_retry_at = NOW() - INTERVAL '1 second' WHERE id = $1", [jobId]);
    const tick5 = await runOneTick(jobId);
    const afterTick5 = await fetchJob(jobId);
    check('a quarantined job is never reclaimed even if next_retry_at is forced into the past', tick5 === 'empty' && afterTick5.attempts === 3 && afterTick5.status === 'quarantined');

    console.log(`\n=== Worker Crash Recovery & Retry/Backoff ===`);
    for (const line of results) console.log(`  ✓ ${line}`);
    console.log(`\nResult: ${results.length}/${results.length} PASSED.\n`);
  } finally {
    await webhookPool.query('DELETE FROM ai_presentation.jobs WHERE id = $1', [jobId]).catch(() => {});
  }
}

main().catch((err) => {
  console.error('WORKER RECOVERY TEST FAILED:', err);
  process.exitCode = 1;
});
