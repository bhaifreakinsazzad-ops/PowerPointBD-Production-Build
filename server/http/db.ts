import { Pool, type PoolClient } from 'pg';
import { env } from './env.ts';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { databasePoolConfig } from './database-config.ts';

let caCertificate: string | undefined = undefined;
if (env.PGSSL_CA_FILE && existsSync(env.PGSSL_CA_FILE)) {
  caCertificate = readFileSync(env.PGSSL_CA_FILE, 'utf8');
} else {
  const repoCa = path.join(env.repoRoot, 'supabase-ca.crt');
  if (existsSync(repoCa)) {
    caCertificate = readFileSync(repoCa, 'utf8');
  }
}

const tlsOptions = { production: env.NODE_ENV === 'production', ca: caCertificate };

function createMockPool(): Pool {
  const emptyResult = { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
  const mockClient = {
    query: async () => emptyResult,
    release: () => {},
  };
  return {
    query: async () => emptyResult,
    connect: async () => mockClient,
    end: async () => {},
    on: () => {},
  } as unknown as Pool;
}

function createPoolOrMock(connectionString: string, label: string): { pool: Pool; mocked: boolean } {
  if (!connectionString) {
    console.warn(`[AI Studio] ${label} not configured — mock pool active.`);
    return { pool: createMockPool(), mocked: true };
  }
  try {
    const p = new Pool(databasePoolConfig(connectionString, tlsOptions));
    p.on('error', (err) => {
      console.warn(`[AI Studio] ${label} pool error:`, err.message);
    });
    return { pool: p, mocked: false };
  } catch {
    console.warn(`[AI Studio] ${label} invalid or unavailable — mock pool active.`);
    return { pool: createMockPool(), mocked: true };
  }
}

const primaryDb = createPoolOrMock(env.DATABASE_URL, 'DATABASE_URL');
export const pool = primaryDb.pool;

/**
 * Runs `fn` inside a transaction where Postgres RLS sees this request as the
 * given authenticated user — SET ROLE + request.jwt.claims mirror exactly
 * what PostgREST does, so `auth.uid()` in every policy resolves correctly.
 * Never pass a client-supplied userId here; it must come from a verified JWT.
 */
export async function withUserContext<T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  if (primaryDb.mocked) {
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }
  try {
    await client.query('BEGIN');
    await client.query('SET ROLE authenticated');
    await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: 'authenticated' }),
    ]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.query('RESET ROLE').catch(() => {});
    client.release();
  }
}

export const webhookPool = createPoolOrMock(env.WEBHOOK_DATABASE_URL, 'WEBHOOK_DATABASE_URL').pool;
export const workerPool = createPoolOrMock(env.WORKER_DATABASE_URL, 'WORKER_DATABASE_URL').pool;
