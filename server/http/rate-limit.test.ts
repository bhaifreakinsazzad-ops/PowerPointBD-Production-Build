import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { createRateLimiter } from './rate-limit.ts';

function response() {
  const headers = new Map<string, string>();
  let statusCode = 200;
  let body: unknown;
  const res = {
    setHeader(name: string, value: string) { headers.set(name, value); return this; },
    status(value: number) { statusCode = value; return this; },
    json(value: unknown) { body = value; return this; },
  } as unknown as Response;
  return { res, headers, status: () => statusCode, body: () => body };
}

test('rate limiter allows the configured requests and rejects the next one with retry guidance', () => {
  let time = 1_000;
  const middleware = createRateLimiter({ windowMs: 10_000, max: 2, now: () => time })((req) => req.ip ?? '');
  let nextCalls = 0;
  for (let i = 0; i < 2; i += 1) {
    const res = response();
    middleware({ ip: 'user-a' } as Request, res.res, (() => { nextCalls += 1; }) as never);
    assert.equal(res.status(), 200);
    assert.equal(res.headers.get('RateLimit-Remaining'), String(1 - i));
  }
  const limited = response();
  middleware({ ip: 'user-a' } as Request, limited.res, (() => { nextCalls += 1; }) as never);
  assert.equal(limited.status(), 429);
  assert.equal(limited.headers.get('Retry-After'), '10');
  assert.equal((limited.body() as { error: { code: string } }).error.code, 'RATE_LIMITED');
  assert.equal(nextCalls, 2);

  time += 10_000;
  const reset = response();
  middleware({ ip: 'user-a' } as Request, reset.res, (() => { nextCalls += 1; }) as never);
  assert.equal(reset.status(), 200);
  assert.equal(nextCalls, 3);
});

test('rate limiter isolates keys and bounds its bucket map', () => {
  let time = 0;
  const middleware = createRateLimiter({ windowMs: 60_000, max: 1, maxKeys: 1, now: () => time })((req) => req.ip ?? '');
  const invoke = (ip: string) => {
    const res = response();
    middleware({ ip } as Request, res.res, (() => undefined) as never);
    return res.status();
  };
  assert.equal(invoke('one'), 200);
  assert.equal(invoke('two'), 200);
  assert.equal(invoke('one'), 200); // Oldest bucket was evicted at capacity.
  time += 60_000;
  assert.equal(invoke('two'), 200);
});
