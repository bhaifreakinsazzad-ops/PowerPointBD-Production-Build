import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runJsonProcess } from './process.ts';
import { assertIntegrationTarget } from './integration-safety.ts';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { databasePoolConfig } from './database-config.ts';
import { commercePolicy,runtimeEnvironment } from './commerce-policy.ts';
import { Client } from 'pg';

test('subprocess JSON success', async () => {
  assert.deepEqual(await runJsonProcess(process.execPath, ['-e', 'console.log(JSON.stringify({ok:true}))']), { ok: true });
});
test('hanging child is killed by timeout', async () => {
  await assert.rejects(runJsonProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs: 150 }), /PROCESS_TIMEOUT/);
});
test('subprocess output is capped', async () => {
  await assert.rejects(runJsonProcess(process.execPath, ['-e', "console.log('x'.repeat(10000))"], { maxOutputBytes: 100 }), /PROCESS_OUTPUT_LIMIT/);
});
test('malformed JSON is rejected without exposing child output', async () => {
  await assert.rejects(runJsonProcess(process.execPath, ['-e', "console.log('sensitive-content')"]), /PROCESS_INVALID_JSON/);
});
test('nonzero exit and missing executable fail safely', async () => {
  await assert.rejects(runJsonProcess(process.execPath, ['-e', 'process.exit(1)']), /PROCESS_FAILED/);
  await assert.rejects(runJsonProcess('nonexistent-powerpointbd-command', []), /PROCESS_START_FAILED/);
});
test('lease cancellation terminates a running child', async () => {
  const controller = new AbortController();
  const result = runJsonProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { signal: controller.signal });
  controller.abort();
  await assert.rejects(result, /JOB_CANCELLED/);
});

test('cancellation terminates renderer descendants as well as their launcher',async()=>{
  const folder=await mkdtemp(path.join(tmpdir(),'powerpointbd-process-tree-'));
  const pidFile=path.join(folder,'child.pid');let pid:number|undefined;
  const controller=new AbortController();
  const grandchild=`require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));setInterval(()=>{},50);`;
  const launcher=`require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(grandchild)}],{stdio:'ignore'});setInterval(()=>{},50);`;
  const result=runJsonProcess(process.execPath,['-e',launcher],{signal:controller.signal,timeoutMs:10000});
  void result.catch(()=>{});
  try{
    for(let i=0;i<60;i++){try{pid=Number(await readFile(pidFile,'utf8'));break;}catch{await delay(50);}}
    assert.ok(pid);controller.abort();await assert.rejects(result,/JOB_CANCELLED/);
    await delay(100);
    assert.throws(()=>process.kill(pid!,0));
  }finally{
    controller.abort();await result.catch(()=>{});
    if(pid){try{process.kill(pid,'SIGKILL');}catch{/* already terminated */}}
    await rm(folder,{recursive:true,force:true});
  }
});

test('remote integration tests require opt-in and matching targets', () => {
  const config = { SUPABASE_URL: 'https://test.invalid', DATABASE_URL: 'postgres://test@db.invalid/test',
    WEBHOOK_DATABASE_URL: 'postgres://test@db.invalid/test', WORKER_DATABASE_URL: 'postgres://test@db.invalid/test' };
  assert.throws(() => assertIntegrationTarget(config, {}), /disabled/);
  assert.throws(() => assertIntegrationTarget(config, {
    ALLOW_REMOTE_INTEGRATION_TESTS: '1', INTEGRATION_TEST_SUPABASE_URL: config.SUPABASE_URL,
    INTEGRATION_TEST_DATABASE_HOST: 'wrong.invalid',
  }), /host differs/);
  assert.doesNotThrow(() => assertIntegrationTarget(config, {
    ALLOW_REMOTE_INTEGRATION_TESTS: '1', INTEGRATION_TEST_SUPABASE_URL: config.SUPABASE_URL,
    INTEGRATION_TEST_DATABASE_HOST: 'db.invalid',
  }));
});

test('database driver configuration cannot disable remote TLS verification through URL options',async()=>{
  const config=databasePoolConfig('postgres://fixture:unused@db.test.invalid/app?sslmode=no-verify&sslrootcert=bad&ssl=false&application_name=fixture');
  assert.deepEqual(config.ssl,{rejectUnauthorized:true});
  const url=new URL(config.connectionString!);assert.equal(url.searchParams.has('sslmode'),false);assert.equal(url.searchParams.has('sslrootcert'),false);assert.equal(url.searchParams.has('ssl'),false);
  assert.equal(url.searchParams.get('application_name'),'fixture');
  // Inspect the actual driver-parsed settings, not just our config object.
  const driver=new Client(config) as unknown as {connectionParameters:{ssl:unknown}};
  assert.deepEqual(driver.connectionParameters.ssl,{rejectUnauthorized:true});
  assert.deepEqual(databasePoolConfig('postgres://fixture@db.test.invalid/app',{ca:'test CA'}).ssl,{rejectUnauthorized:true,ca:'test CA'});
  assert.equal(databasePoolConfig('postgres://fixture@127.0.0.1/app').ssl,false);
  assert.deepEqual(databasePoolConfig('postgres://fixture@127.0.0.1/app',{production:true}).ssl,{rejectUnauthorized:true});
  assert.throws(()=>databasePoolConfig('not a database URL'),/DATABASE_URL_INVALID/);
  assert.throws(()=>databasePoolConfig('https://example.invalid'),/DATABASE_URL_INVALID/);
});

test('production commerce cannot enable mock checkout through a mistyped environment',()=>{
  assert.equal(commercePolicy(runtimeEnvironment('production')).sandbox_available,false);
  assert.equal(commercePolicy(runtimeEnvironment('test')).sandbox_available,true);
  assert.equal(commercePolicy('production').live_checkout_available,false);
  assert.throws(()=>runtimeEnvironment('prod'),/NODE_ENV_INVALID/);
});
