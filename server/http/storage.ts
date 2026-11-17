import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { env } from './env.ts';

const BUCKET = 'private-presentations';

export function isLocalStorageMode(): boolean {
  return process.env.LOCAL_STORAGE_FALLBACK === '1' || !env.SUPABASE_SERVICE_ROLE_KEY;
}

export function getLocalPathForStorageKey(storageKey: string): string {
  const normalized = path.posix.normalize(storageKey.replace(/\\/g, '/'));
  if (normalized.startsWith('../') || normalized === '..' || path.posix.isAbsolute(normalized)) {
    throw new Error('STORAGE_KEY_INVALID');
  }
  // Serverless hosts (Vercel) only allow writes under the OS temp directory.
  const base = process.env.VERCEL ? path.join(os.tmpdir(), 'powerpointbd-storage') : path.join(env.repoRoot, '.storage');
  return path.join(base, BUCKET, ...normalized.split('/'));
}

/**
 * A Supabase client acting as this specific user (their own verified
 * access token) - storage.objects RLS policies scope every read/write to
 * the "{owner_id}/..." prefix, so this can never touch another user's
 * files regardless of what path is requested.
 */
function clientFor(accessToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` },
      fetch: (url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(15000)}) },
  });
}

/**
 * The service-role client bypasses storage RLS entirely - only used by the
 * background worker, which has no live user session to act on behalf of
 * (e.g. recovering a crashed job later, long after the original request's
 * token would have expired anyway).
 */
function serviceClient(signal?: AbortSignal) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    // Actionable durable code without exposing provider/customer error text.
    throw new Error('WORKER_STORAGE_CREDENTIALS_MISSING');
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    global: { fetch: (url, init) => fetch(url, { ...init,
      signal: AbortSignal.any([AbortSignal.timeout(60_000), ...(signal ? [signal] : [])]),
    }) },
  });
}

/** `auth` is either a live user access token, or `null` to use the service role (worker only). */
function pickClient(auth: string | null, signal?: AbortSignal) {
  return auth ? clientFor(auth) : serviceClient(signal);
}

export async function uploadPresentation(
  auth: string | null,
  ownerId: string,
  projectId: string,
  filename: string,
  bytes: Buffer,
  signal?: AbortSignal
): Promise<{ storageKey: string }> {
  const storageKey = `${ownerId}/${projectId}/${filename}`;
  if (isLocalStorageMode()) {
    const localPath = getLocalPathForStorageKey(storageKey);
    await mkdir(path.dirname(localPath), { recursive: true });
    await writeFile(localPath, bytes);
    return { storageKey };
  }
  const { error } = await pickClient(auth, signal)
    .storage.from(BUCKET)
    .upload(storageKey, bytes, {
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      upsert: false,
    });
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
  return { storageKey };
}

export async function uploadPreviewFile(
  ownerId: string,
  projectId: string,
  filename: string,
  bytes: Buffer,
  mime: string,
  signal: AbortSignal
) {
  const storageKey = `${ownerId}/${projectId}/${filename}`;
  if (isLocalStorageMode()) {
    const localPath = getLocalPathForStorageKey(storageKey);
    await mkdir(path.dirname(localPath), { recursive: true });
    await writeFile(localPath, bytes);
    return { storageKey };
  }
  const { error } = await serviceClient(signal).storage.from(BUCKET).upload(storageKey, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error('PREVIEW_UPLOAD_FAILED');
  return { storageKey };
}

export async function downloadApprovedSource(key: string, signal: AbortSignal): Promise<Buffer> {
  if (isLocalStorageMode()) {
    const localPath = getLocalPathForStorageKey(key);
    try {
      const bytes = await readFile(localPath);
      if (bytes.length > 64 * 1024 * 1024) throw new Error('APPROVED_SOURCE_UNAVAILABLE');
      return bytes;
    } catch {
      // Fall through if file is not found locally
    }
  }
  const { data, error } = await serviceClient(signal).storage.from(BUCKET).download(key);
  if (error || !data || data.size > 64 * 1024 * 1024) throw new Error('APPROVED_SOURCE_UNAVAILABLE');
  return Buffer.from(await data.arrayBuffer());
}

export async function createSignedDownloadUrl(
  auth: string | null,
  storageKey: string,
  ttlSeconds = 900
): Promise<string> {
  if (isLocalStorageMode()) {
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const secret = env.MOCK_PAYMENT_WEBHOOK_SECRET || 'powerpointbd-local-storage-hmac-secret';
    const sig = createHmac('sha256', secret).update(`${storageKey}:${expires}`).digest('hex');
    return `/api/download/private?key=${encodeURIComponent(storageKey)}&expires=${expires}&sig=${sig}`;
  }
  const { data, error } = await pickClient(auth)
    .storage.from(BUCKET)
    .createSignedUrl(storageKey, ttlSeconds);
  if (error || !data) {
    throw new Error(`Signed URL creation failed: ${error?.message}`);
  }
  return data.signedUrl;
}

export function verifySignedStorageUrl(key: string, expires: number, signature: string): boolean {
  if (!key || !expires || !signature) return false;
  if (expires < Math.floor(Date.now() / 1000)) return false;
  const normalized = path.normalize(key).replace(/\\/g, '/');
  if (normalized.includes('..') || normalized.startsWith('/') || !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/.test(normalized)) {
    return false;
  }
  const secret = env.MOCK_PAYMENT_WEBHOOK_SECRET || 'powerpointbd-local-storage-hmac-secret';
  const expected = createHmac('sha256', secret).update(`${key}:${expires}`).digest('hex');
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}
