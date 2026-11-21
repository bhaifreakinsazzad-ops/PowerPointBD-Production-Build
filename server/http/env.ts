import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runtimeEnvironment } from './commerce-policy.ts';

// Nearest ancestor with package.json: correct both for server/http/env.ts and
// for the bundled Vercel function at api/index.mjs (one level deep).
function findRepoRoot(start: string): string {
  for (let dir = start; ; dir = path.dirname(dir)) {
    if (existsSync(path.join(dir, 'package.json'))) return dir;
    if (path.dirname(dir) === dir) return process.cwd();
  }
}
const repoRoot = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
// Production receives secrets from its process environment, never a copied
// development file. dotenv is deliberately a development-only dependency.
if(process.env.NODE_ENV!=='production'){
  const {config}=await import('dotenv');config({path:path.join(repoRoot,'.env.local')});
}
const environment=runtimeEnvironment(process.env.NODE_ENV || undefined);

function optionalWithWarning(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.warn(`[AI Studio] Optional environment variable ${name} is not set — running with fallback/mock mode.`);
    return '';
  }
  return value;
}

const defaultDbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

export const env = {
  NODE_ENV:environment,
  HOST:process.env.HOST || '0.0.0.0',
  FRONTEND_ORIGIN:process.env.FRONTEND_ORIGIN??(environment==='production'?'':'http://localhost:3000'),
  PGSSL_CA_FILE:process.env.PGSSL_CA_FILE??'',
  PORT: Number(process.env.PORT) || 3000,
  SUPABASE_URL: optionalWithWarning('SUPABASE_URL'),
  SUPABASE_ANON_KEY: optionalWithWarning('SUPABASE_ANON_KEY'),
  DATABASE_URL: defaultDbUrl || optionalWithWarning('DATABASE_URL'),
  WEBHOOK_DATABASE_URL: process.env.WEBHOOK_DATABASE_URL || defaultDbUrl,
  WORKER_DATABASE_URL: process.env.WORKER_DATABASE_URL || defaultDbUrl,
  MOCK_PAYMENT_WEBHOOK_SECRET: environment==='production'?'':(process.env.MOCK_PAYMENT_WEBHOOK_SECRET || 'local-dev-webhook-secret'),
  // Deliberately NOT required(): the worker must still run, claim, and retry
  // jobs for real with this unset - it just can't complete the storage
  // upload step without it, which is itself the real, observable retry path.
  // See docs/BLOCKERS.md.
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || null,
  // 'python3'/'python' resolve to a broken Microsoft Store stub on a fresh
  // Windows install - see docs/STATUS.md. Override in .env.local if needed.
  PYTHON_BIN: process.env.PYTHON_BIN ?? 'python3',
  PREVIEW_LIBREOFFICE_BIN: process.env.PREVIEW_LIBREOFFICE_BIN ?? '',
  PREVIEW_PDFTOPPM_BIN: process.env.PREVIEW_PDFTOPPM_BIN ?? '',
  LOCAL_STORAGE_FALLBACK: process.env.LOCAL_STORAGE_FALLBACK === '1' || !process.env.SUPABASE_SERVICE_ROLE_KEY,
  repoRoot,
};
