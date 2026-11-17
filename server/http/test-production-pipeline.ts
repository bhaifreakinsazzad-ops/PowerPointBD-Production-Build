/**
 * Real end-to-end test of the production pipeline (generate -> upload ->
 * validate -> private signed download), run against a PERMANENT fixture
 * project that already has a manually-granted test entitlement - see
 * docs/STATUS.md for exactly what was inserted and why. This script cannot
 * create that entitlement itself: ai_presentation.entitlements has no
 * owner-insert RLS policy by design (only a real verified payment should
 * ever write one), so granting it requires the same privileged channel used
 * to set up the Supabase Auth fixture users.
 */
import { createClient } from '@supabase/supabase-js';
import { createApp } from './app.ts';
import { env } from './env.ts';
import { waitForJob } from './wait-for-job.ts';
import { integrationFixtureUser } from './test-fixtures.ts';

import { assertIntegrationTarget } from './integration-safety.ts';
assertIntegrationTarget(env);

const PROJECT_ID = '735b4bdc-c9ad-47a7-b0b7-1c5da2d04213';
// Fresh key each run so repeated runs create a new job (and exercise the
// fresh-job path) instead of only ever hitting the idempotent-replay branch.
const IDEMPOTENCY_KEY = `prod_pipeline_test_${Date.now()}`;

async function json(res: Response): Promise<any> {
  return res.json();
}

async function main() {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  const { data } = await supabase.auth.signInWithPassword(integrationFixtureUser('A'));
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

  try {
    const produceRes = await call(`/projects/${PROJECT_ID}/produce`, {
      method: 'POST',
      body: JSON.stringify({ idempotency_key: IDEMPOTENCY_KEY }),
    });
    const produceBody = await json(produceRes);
    console.log(JSON.stringify(produceBody, null, 2));
    check('produce returns 202', produceRes.status === 202);
    check('job is queued without synchronous execution', produceBody.data.job.status === 'queued');
    await waitForJob(call, PROJECT_ID, produceBody.data.job.id);

    const replayRes = await call(`/projects/${PROJECT_ID}/produce`, {
      method: 'POST',
      body: JSON.stringify({ idempotency_key: IDEMPOTENCY_KEY }),
    });
    const replayBody = await json(replayRes);
    check('idempotent replay returns 200, not 202', replayRes.status === 200);
    check('idempotent replay returns the SAME job id', replayBody.data.job.id === produceBody.data.job.id);

    const statusRes = await call(`/projects/${PROJECT_ID}/status`);
    const statusBody = await json(statusRes);
    check('status reflects completed job', statusBody.data.job.status === 'completed');

    const downloadRes = await call(`/projects/${PROJECT_ID}/download`);
    const downloadBody = await json(downloadRes);
    check('download returns 200 with a real signed URL', downloadRes.status === 200 && typeof downloadBody.data.download_url === 'string');
    check('download reports the real byte size', downloadBody.data.size_bytes > 0);

    const downloadUrl = downloadBody.data.download_url.startsWith('http') ? downloadBody.data.download_url : `${base}${downloadBody.data.download_url}`;
    const fileRes = await fetch(downloadUrl);
    const fileBuf = Buffer.from(await fileRes.arrayBuffer());
    check('downloaded bytes match the reported size exactly', fileBuf.length === downloadBody.data.size_bytes);
    const crypto = await import('node:crypto');
    const actualSha256 = crypto.createHash('sha256').update(fileBuf).digest('hex');
    check('downloaded bytes match the reported sha256 exactly', actualSha256 === downloadBody.data.sha256_checksum);
    check('downloaded file is a real ZIP/OPC package (starts with PK)', fileBuf[0] === 0x50 && fileBuf[1] === 0x4b);

    console.log(`\n=== Production Pipeline Live Test ===`);
    for (const line of results) console.log(`  ✓ ${line}`);
    console.log(`\nResult: ${results.length}/${results.length} PASSED.\n`);
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('PRODUCTION PIPELINE TEST FAILED:', err);
  process.exitCode = 1;
});
