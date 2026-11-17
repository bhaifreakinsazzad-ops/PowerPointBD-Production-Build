import { createClient } from '@supabase/supabase-js';
import type { Request, Response, NextFunction } from 'express';
import { env } from './env.ts';
import { ApiError } from './errors.ts';
import { withUserContext } from './db.ts';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  /** The verified bearer token itself, kept only to act on Supabase Storage
   * on this user's behalf (their own RLS boundary, not a privileged bypass). */
  accessToken: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Verifies the bearer JWT against Supabase Auth itself (a real network
 * round-trip to GoTrue, not a locally-decoded, trust-the-client claim).
 * This is the "verified server session" the master prompt requires -
 * req.user.id is never taken from a client-submitted field.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Missing Authorization: Bearer <token> header.');
    }
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid or expired session token.');
    }
    req.user = { id: data.user.id, email: data.user.email ?? null, accessToken: token };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Looks up the caller's own ai_presentation.users.role. Runs through the
 * same RLS context as every other query (SET ROLE authenticated +
 * request.jwt.claims) - users_self_select already permits id = auth.uid(),
 * so this is a real, RLS-respecting read, not a privileged side channel.
 */
export async function requireAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Missing authenticated session.');
    }
    const role = await withUserContext(req.user.id, async (client) => {
      const { rows } = await client.query<{ role: string }>(
        'SELECT role FROM ai_presentation.users WHERE id = $1',
        [req.user!.id]
      );
      return rows[0]?.role;
    });
    if (role !== 'admin') {
      throw new ApiError(403, 'FORBIDDEN_NOT_ADMIN', 'This action requires an administrator account.');
    }
    next();
  } catch (err) {
    next(err);
  }
}
