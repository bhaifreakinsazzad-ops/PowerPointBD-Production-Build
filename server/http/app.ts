import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { requireAuth, requireAdmin } from './auth.ts';
import { projectsRouter } from './routes/projects.ts';
import { contentRouter } from './routes/content.ts';
import { previewsRouter } from './routes/previews.ts';
import { adminRouter } from './routes/admin.ts';
import { produceRouter } from './routes/produce.ts';
import { checkoutRouter } from './routes/checkout.ts';
import { webhooksRouter } from './routes/webhooks.ts';
import { aiRouter } from './routes/ai.ts';
import { sendError, ApiError } from './errors.ts';
import { env } from './env.ts';
import { commercePolicy } from './commerce-policy.ts';
import { authenticatedWriteRateLimit } from './rate-limit.ts';
import { verifySignedStorageUrl, getLocalPathForStorageKey } from './storage.ts';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // Support both /api/* (via reverse proxy or Vercel serverless) and direct paths
  app.use((req, _res, next) => {
    if (req.url.startsWith('/api/')) {
      req.url = req.url.slice(4);
    }
    next();
  });

  // Allow only the configured cross-origin frontend or trusted Vercel deployments.
  app.use((req, res, next) => {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.vary('Origin');
    const origin = req.header('origin');
    const isAllowedOrigin = !!(origin && (
      origin === env.FRONTEND_ORIGIN ||
      origin.endsWith('.vercel.app') ||
      (env.NODE_ENV !== 'production' && ['http://localhost:3000', 'http://127.0.0.1:3000'].includes(origin))
    ));
    if (isAllowedOrigin && origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(origin && !isAllowedOrigin ? 403 : 204);
      return;
    }
    next();
  });

  // Captures the exact raw bytes alongside the parsed body: webhook HMAC
  // verification must run over what was actually sent, not a re-serialized
  // copy (which can differ byte-for-byte - key ordering, whitespace, etc.).
  const contentParser = express.json({ limit: '1mb' });
  app.use((req, res, next) => {
    if (req.method === 'PUT' && /^\/projects\/[^/]+\/content$/.test(req.path)) contentParser(req,res,next);
    else next();
  });
  app.use(
    express.json({
      limit: '256kb',
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true, data: { status: 'up' } });
  });

  app.get('/public-config', (_req, res) => {
    // Only a publishable/anon key belongs in a browser. Fail closed on a
    // mistakenly configured secret; never serialize the environment object.
    let publicKey = env.SUPABASE_ANON_KEY.startsWith('sb_publishable_');
    try {
      const payload = JSON.parse(Buffer.from(env.SUPABASE_ANON_KEY.split('.')[1] ?? '', 'base64url').toString());
      publicKey ||= payload.role === 'anon';
    } catch { /* Non-JWT publishable keys are handled by their explicit prefix. */ }
    if (!publicKey) { res.status(503).json({ ok: false, error: { code: 'PUBLIC_AUTH_CONFIG_UNAVAILABLE' } }); return; }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, data: { supabaseUrl: env.SUPABASE_URL, supabaseAnonKey: env.SUPABASE_ANON_KEY } });
  });

  app.get('/commerce/capabilities',(_req,res)=>{
    res.setHeader('Cache-Control','no-store');res.json({ok:true,data:commercePolicy(env.NODE_ENV)});
  });

  app.get('/download/private', async (req, res, next) => {
    try {
      const key = String(req.query.key ?? '');
      const expires = Number(req.query.expires ?? 0);
      const sig = String(req.query.sig ?? '');
      if (!verifySignedStorageUrl(key, expires, sig)) {
        throw new ApiError(403, 'DOWNLOAD_URL_INVALID', 'The private download link is expired or invalid.');
      }
      const filePath = getLocalPathForStorageKey(key);
      try {
        await fs.promises.access(filePath, fs.constants.R_OK);
      } catch {
        throw new ApiError(404, 'ASSET_NOT_FOUND', 'Asset not found on disk.');
      }
      const filename = path.basename(filePath);
      if (filename.endsWith('.pptx')) {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      } else if (filename.endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', 'inline');
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.sendFile(path.resolve(filePath));
    } catch (err) {
      next(err);
    }
  });

  // No Supabase Auth session exists for an external payment provider - the
  // webhook's own HMAC signature is the authentication, verified inside the
  // route itself. Must be mounted before requireAuth below.
  app.use(webhooksRouter);

  // Public AI route – does NOT require auth.
  app.use(aiRouter);

  // Every route below requires a verified Supabase Auth session.
  app.use(requireAuth);
  app.use(authenticatedWriteRateLimit);
  app.use(projectsRouter);
  app.use(contentRouter);
  app.use(previewsRouter);
  app.use(produceRouter);
  app.use(checkoutRouter);
  // aiRouter removed from here – it is now public.
  app.use('/admin', requireAdmin, adminRouter);

  // 404 for anything unmatched.
  app.use((_req, res) => {
    res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'No such route.' } });
  });

  // Express error handler — catches anything asyncRoute's own catch missed.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    sendError(res, err);
  });

  return app;
}
