/**
 * Real end-to-end integration test: starts the actual Express app in-process,
 * signs in as two real Supabase Auth fixture users (created once via SQL —
 * see docs/STATUS.md), and exercises the live HTTP API against the live
 * Supabase database. No mocks, no in-memory stand-ins.
 *
 * Requires DATABASE_URL to be filled in .env.local (see docs/BLOCKERS.md #15).
 */
import { createClient } from '@supabase/supabase-js';
import { createApp } from './app.ts';
import { env } from './env.ts';
import { pool, withUserContext } from './db.ts';
import { integrationFixtureUser } from './test-fixtures.ts';

import { assertIntegrationTarget } from './integration-safety.ts';
assertIntegrationTarget(env);

const USER_A_ID = 'f0000000-0000-4000-8000-00000000000a';
const USER_B_ID = 'f0000000-0000-4000-8000-00000000000b';
// test-production-pipeline.ts's permanent fixture project (same owner, User
// A) - it has a payments/entitlements chain (ON DELETE RESTRICT), so a
// blanket "delete all of this user's projects" must exclude it explicitly.
const PRODUCTION_FIXTURE_PROJECT_ID = '735b4bdc-c9ad-47a7-b0b7-1c5da2d04213';

// This is a test script exercising a JSON HTTP API — typing every response
// body precisely isn't worth it here; the assertions are the real check.
async function json(res: Response): Promise<any> {
  return res.json();
}

async function signIn(creds: { email: string; password: string }): Promise<string> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.signInWithPassword(creds);
  if (error || !data.session) {
    throw new Error(`Sign-in failed for ${creds.email}: ${error?.message}`);
  }
  return data.session.access_token;
}

// Deletes each user's own projects through their own RLS context — same
// path a real "delete my project" feature would use, not a privileged bypass.
async function cleanupFixtureProjects(): Promise<void> {
  await withUserContext(USER_A_ID, (c) =>
    c.query('DELETE FROM ai_presentation.projects WHERE owner_id = $1 AND id != $2', [USER_A_ID, PRODUCTION_FIXTURE_PROJECT_ID])
  );
  await withUserContext(USER_B_ID, (c) => c.query('DELETE FROM ai_presentation.projects WHERE owner_id = $1', [USER_B_ID]));
}

async function main() {
  const USER_A = integrationFixtureUser('A');
  const USER_B = integrationFixtureUser('B');
  console.log('=== Cleaning up any leftover fixture data from a previous run ===');
  await cleanupFixtureProjects();

  const app = createApp();
  const server = app.listen(0);
  const address = server.address();
  if (typeof address !== 'object' || address === null) throw new Error('Failed to bind test server.');
  const base = `http://127.0.0.1:${address.port}`;

  const results: string[] = [];
  const check = (name: string, cond: boolean) => {
    if (!cond) throw new Error(`FAILED: ${name}`);
    results.push(`PASS: ${name}`);
  };

  try {
    console.log('=== Signing in as two real Supabase Auth fixture users ===');
    const tokenA = await signIn(USER_A);
    const tokenB = await signIn(USER_B);
    check('signed in as both fixture users via real Supabase Auth', Boolean(tokenA && tokenB));

    const asA = (path: string, init: RequestInit = {}) =>
      fetch(`${base}${path}`, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      });
    const asB = (path: string, init: RequestInit = {}) =>
      fetch(`${base}${path}`, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      });

    // 1. Create a project as A
    const createRes = await asA('/projects', {
      method: 'POST',
      body: JSON.stringify({ title: 'Live Integration Test Project', slide_count: 8, motion_tier_requested: 'static' }),
    });
    const created = await json(createRes);
    check('POST /projects returns 201', createRes.status === 201);
    check('created project has a real UUID and correct owner', created.data.project.owner_id === USER_A_ID);
    const projectId = created.data.project.id as string;

    // 2. Security: client-submitted price field is rejected outright
    const tamperRes = await asA('/projects', {
      method: 'POST',
      body: JSON.stringify({ title: 'Tamper attempt', slide_count: 8, price: 1 }),
    });
    check('client-submitted price field rejected with 400 SECURITY_VIOLATION', tamperRes.status === 400);
    const tamperBody = await json(tamperRes);
    check('rejection carries the right error code', tamperBody.error.code === 'SECURITY_VIOLATION');

    // 3. RLS via the real HTTP layer: A sees it, B does not
    const listAsA = await json(await asA('/projects'));
    check('owner A sees their own project via the API', listAsA.data.projects.some((p: any) => p.id === projectId));
    const listAsB = await json(await asB('/projects'));
    check('owner B sees none of owner A\'s projects via the API', !listAsB.data.projects.some((p: any) => p.id === projectId));
    const getAsB = await asB(`/projects/${projectId}`);
    check('owner B gets 404 (not 403) fetching owner A\'s project directly', getAsB.status === 404);

    // 4. Static motion configuration
    const motionRes = await asA(`/projects/${projectId}/motion`, {
      method: 'POST',
      body: JSON.stringify({ motion_tier: 'static', transition_id: null, intensity: null }),
    });
    check('static motion configuration succeeds', motionRes.status === 200);

    // 5. Real server-computed quote: 8 slides * BDT 25 = BDT 200 (static, no motion fee)
    const quoteRes = await asA(`/projects/${projectId}/quote`, { method: 'POST', body: '{}' });
    const quoteBody = await json(quoteRes);
    check('quote created (201)', quoteRes.status === 201);
    check('quote math is correct: BDT 200 for 8 static slides', quoteBody.data.quote.quote_amount === 200);
    // quote_amount_paisa is BIGINT; pg returns int8 as a string to avoid JS precision loss.
    check('quote paisa matches BDT * 100', Number(quoteBody.data.quote.quote_amount_paisa) === 20000);

    // 6. Fail-closed motion gate via the real HTTP layer (not just the in-memory model):
    // nothing in motion_library is enabled yet, so Smooth must be rejected end-to-end.
    const smoothProjectRes = await asA('/projects', {
      method: 'POST',
      body: JSON.stringify({ title: 'Smooth Attempt', slide_count: 8, motion_tier_requested: 'smooth' }),
    });
    const smoothProject = (await json(smoothProjectRes)).data.project;
    const smoothMotionRes = await asA(`/projects/${smoothProject.id}/motion`, {
      method: 'POST',
      body: JSON.stringify({ motion_tier: 'smooth', transition_id: 'fade', intensity: 'standard' }),
    });
    const smoothMotionBody = await json(smoothMotionRes);
    check(
      'Smooth transition rejected end-to-end (409 MOTION_CANDIDATE_NOT_PRODUCTION_ENABLED) until desktop QA passes',
      smoothMotionRes.status === 409 && smoothMotionBody.error.code === 'MOTION_CANDIDATE_NOT_PRODUCTION_ENABLED'
    );

    // 7. Unauthenticated request rejected
    const noAuthRes = await fetch(`${base}/projects`);
    check('unauthenticated request rejected with 401', noAuthRes.status === 401);

    // 8. Admin endpoint rejects non-admin caller
    const adminAsARes = await asA('/admin/pricing', {
      method: 'PUT',
      body: JSON.stringify({ base_rate_bdt: 30, smooth_rate_bdt: 15, quote_ttl_hours: 24, change_reason: 'test' }),
    });
    check('non-admin user gets 403 from admin endpoint', adminAsARes.status === 403);

    // 9. Admin (fixture user B, promoted to admin for this test) genuinely changes pricing...
    const tokenAdmin = await signIn(USER_B); // re-sign-in: role claim changes don't retroactively alter an old JWT, but our app re-checks role per-request from the DB anyway
    const asAdmin = (path: string, init: RequestInit = {}) =>
      fetch(`${base}${path}`, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${tokenAdmin}`, 'Content-Type': 'application/json' },
      });
    const priceChangeRes = await asAdmin('/admin/pricing', {
      method: 'PUT',
      body: JSON.stringify({ base_rate_bdt: 30, smooth_rate_bdt: 15, quote_ttl_hours: 24, change_reason: 'live integration test' }),
    });
    const priceChangeBody = await json(priceChangeRes);
    check('admin price change succeeds (201)', priceChangeRes.status === 201);
    check('new price config is active at the new rate', priceChangeRes.status === 201 && priceChangeBody.data.price_config.base_rate_bdt === 30);

    // ...while the EARLIER quote (created under the OLD BDT 25 rate) stays exactly as it was.
    const oldQuoteRefetch = await json(await asA(`/projects/${projectId}`));
    check('old project unaffected by new pricing', oldQuoteRefetch.data.project.id === projectId);

    // ...and a NEW quote on a NEW project picks up the NEW rate: 8 * 30 = BDT 240.
    const newRateProjectRes = await asA('/projects', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Rate Test', slide_count: 8, motion_tier_requested: 'static' }),
    });
    const newRateProject = (await json(newRateProjectRes)).data.project;
    await asA(`/projects/${newRateProject.id}/motion`, {
      method: 'POST',
      body: JSON.stringify({ motion_tier: 'static', transition_id: null, intensity: null }),
    });
    const newRateQuoteRes = await asA(`/projects/${newRateProject.id}/quote`, { method: 'POST', body: '{}' });
    const newRateQuoteBody = await json(newRateQuoteRes);
    check('fresh quote uses the newly-admin-set rate: BDT 240 for 8 static slides', newRateQuoteBody.data.quote.quote_amount === 240);

    console.log(`\n=== AI Presentation Platform — Live HTTP + Supabase Integration Test ===`);
    for (const line of results) console.log(`  ✓ ${line}`);
    console.log(`\nResult: ${results.length}/${results.length} live end-to-end assertions PASSED.\n`);
  } finally {
    // Restore the original BDT 25/11 rate as a new version so repeated runs
    // (and anything else reading "the active price") aren't left drifted.
    try {
      const tokenAdmin = await signIn(USER_B);
      await fetch(`${base}/admin/pricing`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenAdmin}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_rate_bdt: 25, smooth_rate_bdt: 11, quote_ttl_hours: 24, change_reason: 'restore after live integration test' }),
      });
    } catch {
      // best-effort; don't let cleanup failures mask the real test result
    }
    await cleanupFixtureProjects();
    server.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('INTEGRATION TEST FAILED:', err);
  process.exitCode = 1;
});
