import * as crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function requestId(): string {
  return `req_${crypto.randomBytes(8).toString('hex')}`;
}

export function sendError(res: Response, err: unknown): void {
  const rid = requestId();
  if (err && typeof err === 'object' && 'type' in err
      && (err.type === 'entity.too.large' || err.type === 'entity.parse.failed')) {
    res.status(err.type === 'entity.too.large' ? 413 : 400).json({ ok: false,
      error: { code: err.type === 'entity.too.large' ? 'REQUEST_TOO_LARGE' : 'INVALID_JSON_BODY',
        message: 'Supply valid JSON within the request size limit.', request_id: rid } });
    return; // Parser errors can contain the private request body. Never log it.
  }
  if (err instanceof ApiError) {
    res.status(err.status).json({
      ok: false,
      error: { code: err.code, message: err.message, request_id: rid, details: err.details },
    });
    return;
  }
  // Never leak stack traces or internal error text to the client.
  console.error(`[${rid}]`, err);
  res.status(500).json({
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.', request_id: rid },
  });
}

export function asyncRoute(
  handler: (req: Request, res: Response) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res).catch((err) => {
      try {
        sendError(res, err);
      } catch (sendErr) {
        next(sendErr);
      }
    });
  };
}
