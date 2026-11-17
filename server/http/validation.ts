import { ApiError } from './errors.ts';

const FORBIDDEN_CLIENT_FIELDS = [
  'price',
  'amount',
  'quote_amount',
  'total',
  'paid',
  'entitled',
  'owner_id',
  'role',
  'is_active',
];

/** Per master prompt §11: reject any request carrying a client-submitted price/role/ownership field outright. */
export function rejectForbiddenClientFields(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(400, 'INVALID_JSON_BODY', 'Request body must be a JSON object.');
  }
  const obj = body as Record<string, unknown>;
  for (const field of FORBIDDEN_CLIENT_FIELDS) {
    if (field in obj) {
      throw new ApiError(
        400,
        'SECURITY_VIOLATION',
        `Field '${field}' may not be submitted by the client; it is always server-computed.`
      );
    }
  }
  return obj;
}

export function requireString(obj: Record<string, unknown>, field: string, opts: { maxLength?: number; minLength?: number } = {}): string {
  const value = obj[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', `'${field}' is required and must be a non-empty string.`);
  }
  const trimmed = value.trim();
  if (opts.maxLength && trimmed.length > opts.maxLength) {
    throw new ApiError(400, 'VALIDATION_ERROR', `'${field}' must be at most ${opts.maxLength} characters.`);
  }
  if (opts.minLength && trimmed.length < opts.minLength) {
    throw new ApiError(400, 'VALIDATION_ERROR', `'${field}' must be at least ${opts.minLength} characters.`);
  }
  return trimmed;
}

export function requireEnum<T extends string>(obj: Record<string, unknown>, field: string, allowed: readonly T[]): T {
  const value = obj[field];
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `'${field}' must be one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}

export function optionalEnum<T extends string>(
  obj: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
  fallback: T
): T {
  if (!(field in obj) || obj[field] === undefined) return fallback;
  return requireEnum(obj, field, allowed);
}

export function requireIntInRange(obj: Record<string, unknown>, field: string, min: number, max: number): number {
  const value = obj[field];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new ApiError(400, 'VALIDATION_ERROR', `'${field}' must be an integer between ${min} and ${max}.`);
  }
  return value;
}

export function requireNullableEnum<T extends string>(
  obj: Record<string, unknown>,
  field: string,
  allowed: readonly T[]
): T | null {
  const value = obj[field];
  if (value === null) return null;
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `'${field}' must be null or one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}
