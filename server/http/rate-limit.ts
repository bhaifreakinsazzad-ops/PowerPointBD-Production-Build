import type { NextFunction, Request, Response } from 'express';

type Window = { startedAt: number; count: number };
type RateLimitOptions = { windowMs: number; max: number; maxKeys?: number; now?: () => number };

/**
 * Small bounded per-process limiter for authenticated API writes.
 * Production deployments with multiple API replicas must also enforce limits
 * at a shared gateway; this in-memory fallback is not a distributed quota.
 */
export function createRateLimiter({ windowMs, max, maxKeys = 10_000, now = Date.now }: RateLimitOptions) {
  if (!Number.isFinite(windowMs) || windowMs <= 0 || !Number.isInteger(max) || max < 1 || !Number.isInteger(maxKeys) || maxKeys < 1) {
    throw new TypeError('Invalid rate limit configuration.');
  }
  const buckets = new Map<string, Window>();

  return function rateLimit(keyFor: (req: Request) => string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = keyFor(req);
      if (!key) return next();
      const time = now();
      let bucket = buckets.get(key);
      if (!bucket || time - bucket.startedAt >= windowMs || time < bucket.startedAt) {
        if (buckets.size >= maxKeys) {
          for (const [existingKey, existing] of buckets) {
            if (time - existing.startedAt >= windowMs || time < existing.startedAt) buckets.delete(existingKey);
          }
          if (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value!);
        }
        bucket = { startedAt: time, count: 0 };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      const remaining = Math.max(0, max - bucket.count);
      const resetSeconds = Math.max(1, Math.ceil((bucket.startedAt + windowMs - time) / 1000));
      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', String(remaining));
      res.setHeader('RateLimit-Reset', String(resetSeconds));
      if (bucket.count > max) {
        res.setHeader('Retry-After', String(resetSeconds));
        res.status(429).json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait before trying again.' } });
        return;
      }
      next();
    };
  };
}

const generalWriteLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });
const expensiveActionLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 12 });

export function authenticatedWriteRateLimit(req: Request, res: Response, next: NextFunction) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const userId = (req as Request & { user?: { id?: string } }).user?.id;
  if (!userId) return next(); // requireAuth owns the unauthenticated response.
  const normalizedPath = req.path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
  const expensive = /^\/projects\/[^/]+\/(?:previews|preview-revision|approve-preview|quote|produce|checkout)$/.test(normalizedPath);
  return (expensive ? expensiveActionLimiter : generalWriteLimiter)((request) => `${userId}:${request.method}:${normalizedPath}`)(req, res, next);
}
