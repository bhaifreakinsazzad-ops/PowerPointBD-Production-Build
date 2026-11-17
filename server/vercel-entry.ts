/**
 * Vercel serverless entry. Bundled by scripts/build-api.mjs into api/index.mjs.
 *
 * The app is loaded lazily so a missing/invalid environment variable produces a
 * clear JSON diagnosis (names only, never values) instead of an opaque
 * FUNCTION_INVOCATION_FAILED crash.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;
let appPromise: Promise<Handler> | undefined;

function load(): Promise<Handler> {
  appPromise ??= import('./http/app.ts').then(({ createApp }) => createApp() as unknown as Handler);
  return appPromise;
}

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'DATABASE_URL'];

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await load();
    app(req, res);
  } catch (error) {
    appPromise = undefined; // Allow recovery after the environment is fixed and redeployed.
    const missing = REQUIRED.filter((name) => !process.env[name]);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({
      ok: false,
      error: {
        code: missing.length ? 'SERVER_ENV_MISSING' : 'SERVER_STARTUP_FAILED',
        message: missing.length
          ? `Configure these Vercel environment variables, then redeploy: ${missing.join(', ')}`
          : 'The API failed to start. Check the Vercel function logs.',
        missing,
      },
    }));
    console.error('[api] startup failed:', error instanceof Error ? error.message : 'unknown error');
  }
}
