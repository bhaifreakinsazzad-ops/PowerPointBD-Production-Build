// Starts an isolated, loopback-only PostgreSQL cluster; never reads .env.local.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

const bin = process.env.PG_TEST_BIN ?? (process.platform === 'win32'
  ? 'C:/Program Files/PostgreSQL/17/bin' : '/usr/lib/postgresql/17/bin');
const exe = (name) => path.join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
await access(exe('initdb'));
const root = await mkdtemp(path.join(tmpdir(), 'powerpointbd-jobs-test-'));
const data = path.join(root, 'data');
const reserved = net.createServer();
await new Promise((resolve, reject) => reserved.once('error', reject).listen(0, '127.0.0.1', resolve));
const port = reserved.address().port;
await new Promise((resolve) => reserved.close(resolve));
function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`Local test command exited ${code}`)));
  });
}
let started = false;
try {
  await run(exe('initdb'), ['-D', data, '-U', 'codex_test', '-A', 'trust', '--no-locale', '-E', 'UTF8']);
  await run(exe('pg_ctl'), ['-D', data, '-l', path.join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -F`, '-w', 'start']);
  started = true;
  const url = `postgresql://codex_test@127.0.0.1:${port}/postgres`;
  await run(process.execPath, ['--import', 'tsx', '--test', 'server/http/job-service.test.ts', 'server/http/process.test.ts'], {
    ...process.env, NODE_ENV:'test', HOST:'127.0.0.1', FRONTEND_ORIGIN:'http://localhost:3000',PGSSL_CA_FILE:'', JOB_TEST_DATABASE_URL: url, POWERPOINTBD_DISPOSABLE_TEST: '1',
    DATABASE_URL: url, WEBHOOK_DATABASE_URL: url, WORKER_DATABASE_URL: url,
    SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_ANON_KEY: 'local-test-only',
    MOCK_PAYMENT_WEBHOOK_SECRET: 'local-test-only', SUPABASE_SERVICE_ROLE_KEY: '',
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (started) {
    await run(exe('pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop']);
  }
  // Only delete the exact temporary directory created above, after shutdown.
  if (path.dirname(root) !== path.resolve(tmpdir()) || !path.basename(root).startsWith('powerpointbd-jobs-test-')) {
    throw new Error('Unexpected test directory; refusing cleanup');
  }
  await rm(root, { recursive: true, force: true });
}
