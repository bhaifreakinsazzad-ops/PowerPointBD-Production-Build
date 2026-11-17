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
export const pool = new Pool(databasePoolConfig(env.DATABASE_URL,tlsOptions));

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

// No RLS-bypass "admin context" exists for user-facing routes on purpose:
// admin writes (price configs, motion library, audit logs) are enforced by
// real RLS policies that check ai_presentation.users.role = 'admin' via
// auth.uid() — the same mechanism as every other table. See
// db/migrations/0003_...sql. requireAdmin in auth.ts still checks role first
// for a fast, clean 403; the RLS policy is the actual enforced boundary.

// Webhooks are the one genuine exception: there is no Supabase Auth session
// at all for an external payment provider calling us, so auth.uid()-based
// RLS cannot apply (it would just resolve to NULL). The HMAC signature IS
// the security boundary here, verified in application code (routes/webhooks.ts)
// before this pool is touched at all. A SEPARATE role/credential from
// `pool` above, scoped to exactly what webhook processing needs - see
// db/migrations/0005_...sql - so a leak of one doesn't grant the other's
// privileges.
export const webhookPool = new Pool(databasePoolConfig(env.WEBHOOK_DATABASE_URL,tlsOptions));

// The background worker claims jobs across ALL users, not one authenticated
// request - there is no single userId to scope SET ROLE authenticated +
// request.jwt.claims to. A THIRD separate role/credential from both above
// (see db/migrations/0006_...sql), so a leak of any one role doesn't grant
// the others' privileges.
export const workerPool = new Pool(databasePoolConfig(env.WORKER_DATABASE_URL,tlsOptions));
