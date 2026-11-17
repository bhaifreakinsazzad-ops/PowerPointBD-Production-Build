/**
 * IN-MEMORY DEMO REFERENCE ONLY — NOT A PRODUCTION BACKEND.
 * No HTTP authentication, database persistence, actual payment gateway,
 * durable queue, native PowerPoint generation, validation or private storage.
 * Generated asset metadata and worker outcomes below are simulated fixtures.
 * Run: node --experimental-strip-types project/reference/test-backend.mjs
 */
/**
 * AI Presentation Platform — Phase 2 Production Foundation Backend
 *
 * Implements:
 * 1. Reusable Runtime Validation Schemas (Zero-trust payload validation)
 * 2. Server-Authoritative Pricing & Immutable Quote Snapshot Service
 * 3. Cryptographic Webhook Signature Verification (HMAC-SHA256) & Idempotency
 * 4. Entitlement Enforcement & Durable Background Job Queue with Retries
 * 5. Private Asset Storage & Expiring Signed Download URLs (HMAC-SHA256)
 * 6. Admin-Only Pricing Updates with Append-Only Audit Logging
 * 7. All 7 Required REST API Route Handlers + Automated Test Suite
 *
 * Run automated tests with:
 *   npx tsx production_foundation_backend.ts
 */

import * as crypto from 'crypto';

// ============================================================================
// 1. DOMAIN CONTRACTS & REQUIRED SOURCE FIELDS
// ============================================================================

export type UserRole = 'customer' | 'admin' | 'support';
export type MotionTier = 'static' | 'smooth' | 'cinematic';
export type TransitionId = 'fade' | 'wipe' | 'push' | 'zoom';
export type EntranceId = 'fade' | 'wipe' | 'zoom' | 'slide_in';
export type IntensityLevel = 'subtle' | 'standard' | 'dynamic';
export type SlideRole = 'title' | 'bullets' | 'image' | 'chart' | 'quote' | 'closing';

export type ProjectState =
  | 'draft'
  | 'preview_queued'
  | 'preview_ready'
  | 'design_review'
  | 'preview_revision_requested'
  | 'design_approved'
  | 'motion_configured'
  | 'quoted'
  | 'payment_pending'
  | 'payment_failed'
  | 'paid'
  | 'production_queued'
  | 'producing'
  | 'validating'
  | 'production_failed'
  | 'delivered'
  | 'revision_requested'
  | 'cancelled';

export type JobStatus = 'queued' | 'running' | 'validating' | 'completed' | 'failed' | 'quarantined';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  freePreviewProjectsUsed: number;
}

export interface PriceConfigRecord {
  version: number;
  currency: 'BDT';
  base_rate_bdt: number;
  base_rate_paisa: number;
  smooth_rate_bdt: number;
  smooth_rate_paisa: number;
  cinematic_rate_bdt: number | null;
  cinematic_enabled: boolean;
  phase0_desktop_gate_passed: boolean;
  paying_clients_milestone_count: number;
  free_preview_project_cap: number;
  free_preview_revision_cap: number;
  quote_ttl_hours: number;
  updated_by: string;
  change_reason: string;
  created_at: string;
}

export interface ProjectRecord {
  id: string;
  owner_id: string;
  title: string;
  language_mode: 'bilingual' | 'bn' | 'en';
  design_family: string;
  slide_count: number;
  /** Preserved source requirement: projects.motion_tier_requested */
  motion_tier_requested: MotionTier;
  state: ProjectState;
  preview_revisions_used: number;
  free_motion_swap_used: boolean;
  created_at: string;
  updated_at: string;
}

export interface DesignSpecJsonPayload {
  /** Preserved source requirement: design_specs.spec_json fields */
  motion_tier: MotionTier;
  intensity: IntensityLevel | null;
  transition_id: TransitionId | null;
  animation_policy: string;
  design_family: string;
  slide_count: number;
}

export interface DesignSpecRecord {
  id: string;
  project_id: string;
  version: number;
  is_locked: boolean;
  locked_at: string | null;
  /** Preserved source requirement: design_specs.spec_json */
  spec_json: DesignSpecJsonPayload;
  created_at: string;
  updated_at: string;
}

export interface QuoteBreakdownSnapshot {
  currency: 'BDT';
  pricing_config_version: number;
  slide_count: number;
  tier: MotionTier;
  base_rate_per_slide_bdt: number;
  motion_rate_per_slide_bdt: number;
  base_subtotal_bdt: number;
  motion_subtotal_bdt: number;
  tax_amount_bdt: number;
  total_amount_bdt: number;
  total_amount_paisa: number;
  formula_applied: string;
  compatibility_statement: string;
  snapshot_timestamp: string;
}

export interface QuoteRecord {
  id: string;
  project_id: string;
  owner_id: string;
  design_spec_id: string;
  pricing_config_version: number;
  tier: MotionTier;
  slide_count: number;
  base_rate_bdt: number;
  motion_rate_bdt: number;
  quote_amount: number;
  quote_amount_paisa: number;
  quote_breakdown: QuoteBreakdownSnapshot;
  status: 'active' | 'expired' | 'paid' | 'superseded';
  expires_at: string;
  created_at: string;
}

export interface PaymentRecord {
  id: string;
  project_id: string;
  owner_id: string;
  quote_id: string;
  provider: string;
  provider_session_id: string;
  provider_txn_id: string | null;
  idempotency_key: string;
  /** Preserved source requirement: payments.tier */
  tier: MotionTier;
  /** Preserved source requirement: payments.quote_amount */
  quote_amount: number;
  quote_amount_paisa: number;
  /** Preserved source requirement: payments.quote_breakdown */
  quote_breakdown: QuoteBreakdownSnapshot;
  status: 'pending' | 'verified' | 'failed' | 'refunded';
  webhook_signature_verified: boolean;
  verified_at: string | null;
  created_at: string;
}

export interface EntitlementRecord {
  id: string;
  project_id: string;
  owner_id: string;
  payment_id: string;
  design_spec_id: string;
  /** Preserved source requirement: entitlements.motion_tier */
  motion_tier: MotionTier;
  free_motion_swaps_remaining: number;
  status: 'active' | 'revoked';
  granted_at: string;
}

export interface JobAnimationChoicesAudit {
  generator_version: string;
  template_version: string;
  policy_version: string;
  tier: MotionTier;
  deck_transition: TransitionId | null;
  intensity: IntensityLevel | null;
  slides: Array<{
    slide_index: number;
    bullet_count: number;
    bullet_suppression_applied: boolean;
    cap_truncation_applied: boolean;
    selected_entrances: Array<{
      shape_id: number;
      role: SlideRole;
      entrance_id: EntranceId;
      duration_ms: number;
      trigger: 'withEffect' | 'afterEffect';
    }>;
  }>;
}

export interface JobRecord {
  id: string;
  project_id: string;
  owner_id: string;
  design_spec_id: string;
  entitlement_id: string;
  idempotency_key: string;
  job_type: 'static_preview' | 'pptx_production' | 'motion_swap_rerender' | 'tier_upgrade_rerender';
  status: JobStatus;
  progress_stage: string;
  attempts: number;
  max_attempts: number;
  next_retry_at: string | null;
  /** Preserved source requirement: jobs.animation_choices */
  animation_choices: JobAnimationChoicesAudit;
  validation_report: {
    valid_package_and_policy: boolean;
    checked_slides: number;
    errors: string[];
  } | null;
  output_asset_id: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface GeneratedAssetRecord {
  id: string;
  project_id: string;
  job_id: string;
  owner_id: string;
  asset_type: 'preview_image' | 'pptx_deck' | 'static_pdf' | 'validation_report';
  storage_bucket: 'private-presentations';
  storage_key: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  sha256_checksum: string;
  is_private: true;
  is_quarantined: boolean;
  created_at: string;
}

export interface AuditLogRecord {
  id: string;
  actor_id: string;
  actor_role: UserRole;
  action: string;
  target_entity: string;
  target_id: string;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
}

// ============================================================================
// 2. REUSABLE RUNTIME VALIDATION SCHEMAS (Zero-Trust Input Validation)
// ============================================================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errorCode: string; issues: string[] };

const ALLOWED_TIERS: readonly MotionTier[] = ['static', 'smooth', 'cinematic'];
const ALLOWED_TRANSITIONS: readonly TransitionId[] = ['fade', 'wipe', 'push', 'zoom'];
const ALLOWED_INTENSITIES: readonly IntensityLevel[] = ['subtle', 'standard', 'dynamic'];

const FORBIDDEN_CLIENT_PRICE_FIELDS = [
  'price',
  'amount',
  'quote_amount',
  'quote_amount_paisa',
  'total',
  'base_rate_bdt',
  'smooth_rate_bdt',
  'override_price',
  'paid',
  'entitled',
] as const;

function rejectForbiddenClientPriceFields(payload: Record<string, unknown>, issues: string[]): void {
  for (const field of FORBIDDEN_CLIENT_PRICE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      issues.push(
        `SECURITY_VIOLATION: Client payload must not submit server-authoritative field '${field}'.`
      );
    }
  }
}

export interface MotionUpdateInput {
  motion_tier: MotionTier;
  transition_id: TransitionId | null;
  intensity: IntensityLevel | null;
}

export const MotionUpdateRequestSchema = {
  safeParse(input: unknown): ValidationResult<MotionUpdateInput> {
    const issues: string[] = [];
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return { success: false, errorCode: 'INVALID_JSON_BODY', issues: ['Body must be a JSON object.'] };
    }
    const obj = input as Record<string, unknown>;
    rejectForbiddenClientPriceFields(obj, issues);

    const tier = obj.motion_tier as MotionTier;
    if (!ALLOWED_TIERS.includes(tier)) {
      issues.push(`motion_tier must be one of: ${ALLOWED_TIERS.join(', ')}`);
    }

    const transitionId = obj.transition_id === undefined ? null : obj.transition_id;
    const intensity = obj.intensity === undefined ? null : obj.intensity;

    if (tier === 'static') {
      if (transitionId !== null || intensity !== null) {
        issues.push('Static tier must have transition_id = null and intensity = null.');
      }
    } else if (tier === 'smooth' || tier === 'cinematic') {
      if (typeof transitionId !== 'string' || !ALLOWED_TRANSITIONS.includes(transitionId as TransitionId)) {
        issues.push(`Smooth/Cinematic tier requires transition_id in [${ALLOWED_TRANSITIONS.join(', ')}].`);
      }
      if (typeof intensity !== 'string' || !ALLOWED_INTENSITIES.includes(intensity as IntensityLevel)) {
        issues.push(`Smooth/Cinematic tier requires intensity in [${ALLOWED_INTENSITIES.join(', ')}].`);
      }
    }

    if (issues.length > 0) {
      return { success: false, errorCode: 'VALIDATION_ERROR', issues };
    }
    return {
      success: true,
      data: {
        motion_tier: tier,
        transition_id: transitionId as TransitionId | null,
        intensity: intensity as IntensityLevel | null,
      },
    };
  },
};

export interface QuoteCreateInput {
  design_spec_id?: string;
}

export const QuoteCreateRequestSchema = {
  safeParse(input: unknown): ValidationResult<QuoteCreateInput> {
    const issues: string[] = [];
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return { success: false, errorCode: 'INVALID_JSON_BODY', issues: ['Body must be a JSON object.'] };
    }
    const obj = input as Record<string, unknown>;
    rejectForbiddenClientPriceFields(obj, issues);

    if (obj.design_spec_id !== undefined && typeof obj.design_spec_id !== 'string') {
      issues.push('design_spec_id must be a string UUID if provided.');
    }
    if (issues.length > 0) {
      return { success: false, errorCode: 'VALIDATION_ERROR', issues };
    }
    return {
      success: true,
      data: { design_spec_id: obj.design_spec_id as string | undefined },
    };
  },
};

export interface CheckoutSessionInput {
  quote_id: string;
  provider: 'sslcommerz_sandbox' | 'bkash_sandbox';
  idempotency_key: string;
}

export const CheckoutSessionRequestSchema = {
  safeParse(input: unknown): ValidationResult<CheckoutSessionInput> {
    const issues: string[] = [];
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return { success: false, errorCode: 'INVALID_JSON_BODY', issues: ['Body must be a JSON object.'] };
    }
    const obj = input as Record<string, unknown>;
    rejectForbiddenClientPriceFields(obj, issues);

    if (typeof obj.quote_id !== 'string' || obj.quote_id.trim().length < 4) {
      issues.push('quote_id is required.');
    }
    if (obj.provider !== 'sslcommerz_sandbox' && obj.provider !== 'bkash_sandbox') {
      issues.push("provider must be 'sslcommerz_sandbox' or 'bkash_sandbox'.");
    }
    if (typeof obj.idempotency_key !== 'string' || obj.idempotency_key.trim().length < 6) {
      issues.push('idempotency_key (min 6 chars) is required.');
    }

    if (issues.length > 0) {
      return { success: false, errorCode: 'VALIDATION_ERROR', issues };
    }
    return {
      success: true,
      data: {
        quote_id: (obj.quote_id as string).trim(),
        provider: obj.provider as 'sslcommerz_sandbox' | 'bkash_sandbox',
        idempotency_key: (obj.idempotency_key as string).trim(),
      },
    };
  },
};

export interface WebhookPayloadInput {
  event_id: string;
  provider_session_id: string;
  provider_txn_id: string;
  status: 'VALID' | 'VALIDATED' | 'FAILED';
  amount_bdt: number;
  currency: 'BDT';
}

export const WebhookPayloadSchema = {
  safeParse(input: unknown): ValidationResult<WebhookPayloadInput> {
    const issues: string[] = [];
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return { success: false, errorCode: 'INVALID_WEBHOOK_PAYLOAD', issues: ['Payload must be an object.'] };
    }
    const obj = input as Record<string, unknown>;
    if (typeof obj.event_id !== 'string' || !obj.event_id.trim()) {
      issues.push('event_id is required.');
    }
    if (typeof obj.provider_session_id !== 'string' || !obj.provider_session_id.trim()) {
      issues.push('provider_session_id is required.');
    }
    if (typeof obj.provider_txn_id !== 'string' || !obj.provider_txn_id.trim()) {
      issues.push('provider_txn_id is required.');
    }
    if (obj.status !== 'VALID' && obj.status !== 'VALIDATED' && obj.status !== 'FAILED') {
      issues.push("status must be 'VALID', 'VALIDATED', or 'FAILED'.");
    }
    if (typeof obj.amount_bdt !== 'number' || !Number.isInteger(obj.amount_bdt) || obj.amount_bdt <= 0) {
      issues.push('amount_bdt must be a positive integer.');
    }
    if (obj.currency !== 'BDT') {
      issues.push("currency must be 'BDT'.");
    }

    if (issues.length > 0) {
      return { success: false, errorCode: 'VALIDATION_ERROR', issues };
    }
    return {
      success: true,
      data: {
        event_id: obj.event_id as string,
        provider_session_id: obj.provider_session_id as string,
        provider_txn_id: obj.provider_txn_id as string,
        status: obj.status as 'VALID' | 'VALIDATED' | 'FAILED',
        amount_bdt: obj.amount_bdt as number,
        currency: 'BDT',
      },
    };
  },
};

export interface ProduceJobInput {
  idempotency_key: string;
  simulate_validation_failure?: boolean;
}

export const ProduceJobRequestSchema = {
  safeParse(input: unknown): ValidationResult<ProduceJobInput> {
    const issues: string[] = [];
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return { success: false, errorCode: 'INVALID_JSON_BODY', issues: ['Body must be a JSON object.'] };
    }
    const obj = input as Record<string, unknown>;
    rejectForbiddenClientPriceFields(obj, issues);

    if (typeof obj.idempotency_key !== 'string' || obj.idempotency_key.trim().length < 6) {
      issues.push('idempotency_key (min 6 chars) is required.');
    }
    if (issues.length > 0) {
      return { success: false, errorCode: 'VALIDATION_ERROR', issues };
    }
    return {
      success: true,
      data: {
        idempotency_key: (obj.idempotency_key as string).trim(),
        simulate_validation_failure: Boolean(obj.simulate_validation_failure),
      },
    };
  },
};

export interface AdminPricingUpdateInput {
  base_rate_bdt: number;
  smooth_rate_bdt: number;
  cinematic_rate_bdt?: number | null;
  cinematic_enabled?: boolean;
  quote_ttl_hours?: number;
  change_reason: string;
}

export const AdminPricingUpdateSchema = {
  safeParse(input: unknown): ValidationResult<AdminPricingUpdateInput> {
    const issues: string[] = [];
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return { success: false, errorCode: 'INVALID_JSON_BODY', issues: ['Body must be a JSON object.'] };
    }
    const obj = input as Record<string, unknown>;

    if (typeof obj.base_rate_bdt !== 'number' || !Number.isInteger(obj.base_rate_bdt) || obj.base_rate_bdt < 5 || obj.base_rate_bdt > 2000) {
      issues.push('base_rate_bdt must be an integer between 5 and 2000 BDT.');
    }
    if (typeof obj.smooth_rate_bdt !== 'number' || !Number.isInteger(obj.smooth_rate_bdt) || obj.smooth_rate_bdt < 0 || obj.smooth_rate_bdt > 2000) {
      issues.push('smooth_rate_bdt must be an integer between 0 and 2000 BDT.');
    }
    if (obj.quote_ttl_hours !== undefined && (
      typeof obj.quote_ttl_hours !== 'number' || !Number.isInteger(obj.quote_ttl_hours) ||
      obj.quote_ttl_hours < 1 || obj.quote_ttl_hours > 168
    )) {
      issues.push('quote_ttl_hours must be an integer between 1 and 168 hours.');
    }
    if (obj.cinematic_rate_bdt !== undefined && obj.cinematic_rate_bdt !== null && (
      typeof obj.cinematic_rate_bdt !== 'number' || !Number.isInteger(obj.cinematic_rate_bdt) ||
      obj.cinematic_rate_bdt <= 0 || obj.cinematic_rate_bdt > 2000
    )) {
      issues.push('cinematic_rate_bdt must be null or an integer between 1 and 2000 BDT.');
    }
    if (obj.cinematic_enabled !== undefined && typeof obj.cinematic_enabled !== 'boolean') {
      issues.push('cinematic_enabled must be a boolean.');
    }
    if (typeof obj.change_reason !== 'string' || obj.change_reason.trim().length < 5) {
      issues.push('change_reason (min 5 chars) is required for the administrative audit trail.');
    }

    if (issues.length > 0) {
      return { success: false, errorCode: 'VALIDATION_ERROR', issues };
    }
    return {
      success: true,
      data: {
        base_rate_bdt: obj.base_rate_bdt as number,
        smooth_rate_bdt: obj.smooth_rate_bdt as number,
        cinematic_rate_bdt: (obj.cinematic_rate_bdt as number | null | undefined) ?? null,
        cinematic_enabled: Boolean(obj.cinematic_enabled),
        quote_ttl_hours: (obj.quote_ttl_hours as number | undefined) ?? 24,
        change_reason: (obj.change_reason as string).trim(),
      },
    };
  },
};

// ============================================================================
// 3. CRYPTOGRAPHIC WEBHOOK SIGNATURE & EXPIRING SIGNED URL UTILITIES
// ============================================================================

export function computeWebhookHmacSignature(rawBody: string, webhookSecret: string): string {
  return crypto.createHmac('sha256', webhookSecret).update(rawBody, 'utf8').digest('hex');
}

export function verifyWebhookHmacSignature(
  rawBody: string,
  providedSignatureHex: string,
  webhookSecret: string
): boolean {
  if (!providedSignatureHex || typeof providedSignatureHex !== 'string') {
    return false;
  }
  const expectedHex = computeWebhookHmacSignature(rawBody, webhookSecret);
  const a = Buffer.from(expectedHex, 'utf8');
  const b = Buffer.from(providedSignatureHex, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export function createExpiringSignedDownloadUrl(params: {
  assetId: string;
  projectId: string;
  ownerId: string;
  storageKey: string;
  expiresInSeconds: number;
  signingSecret: string;
  nowMs?: number;
}): { signedUrl: string; expiresAtIso: string; token: string } {
  const now = params.nowMs ?? Date.now();
  const expMs = now + params.expiresInSeconds * 1000;
  const payloadStr = `${params.assetId}:${params.projectId}:${params.ownerId}:${params.storageKey}:${expMs}`;
  const sig = crypto
    .createHmac('sha256', params.signingSecret)
    .update(payloadStr, 'utf8')
    .digest('hex');
  const token = Buffer.from(`${payloadStr}:${sig}`, 'utf8').toString('base64url');
  return {
    signedUrl: `https://storage.aipresentation.bd/private-presentations/${encodeURIComponent(
      params.storageKey
    )}?token=${token}`,
    expiresAtIso: new Date(expMs).toISOString(),
    token,
  };
}

export function verifyExpiringSignedDownloadToken(
  token: string,
  expectedOwnerId: string,
  signingSecret: string,
  nowMs?: number
): { valid: boolean; reason?: string; storageKey?: string } {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 6) {
      return { valid: false, reason: 'MALFORMED_TOKEN' };
    }
    const [assetId, projectId, ownerId, storageKey, expMsStr, providedSig] = parts as [
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    if (ownerId !== expectedOwnerId) {
      return { valid: false, reason: 'OWNER_MISMATCH' };
    }
    const expMs = Number(expMsStr);
    const currentMs = nowMs ?? Date.now();
    if (!Number.isFinite(expMs) || currentMs > expMs) {
      return { valid: false, reason: 'TOKEN_EXPIRED' };
    }
    const payloadStr = `${assetId}:${projectId}:${ownerId}:${storageKey}:${expMsStr}`;
    const expectedSig = crypto
      .createHmac('sha256', signingSecret)
      .update(payloadStr, 'utf8')
      .digest('hex');
    const validSig =
      expectedSig.length === providedSig.length &&
      crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(providedSig));
    if (!validSig) {
      return { valid: false, reason: 'INVALID_SIGNATURE' };
    }
    return { valid: true, storageKey };
  } catch {
    return { valid: false, reason: 'TOKEN_DECODE_ERROR' };
  }
}

// ============================================================================
// 4. PRODUCTION FOUNDATION SERVICE & API CONTROLLER
// ============================================================================

export interface ApiResponse<T = unknown> {
  status: number;
  body:
    | { ok: true; data: T }
    | { ok: false; errorCode: string; message: string; details?: string[] };
}

export class ProductionFoundationServer {
  private readonly webhookSecret: string;
  private readonly downloadSigningSecret: string;
  private currentClockMs: number;

  public users = new Map<string, AuthenticatedUser>();
  public priceConfigs: PriceConfigRecord[] = [];
  public motionLibrary = new Map<TransitionId, { enabled: boolean; templateVersion: string }>();
  public projects = new Map<string, ProjectRecord>();
  public designSpecs = new Map<string, DesignSpecRecord>();
  public quotes = new Map<string, QuoteRecord>();
  public payments = new Map<string, PaymentRecord>();
  public webhookEvents = new Map<string, { eventId: string; paymentId: string; processedAt: string }>();
  public entitlements = new Map<string, EntitlementRecord>();
  public jobs = new Map<string, JobRecord>();
  public assets = new Map<string, GeneratedAssetRecord>();
  public auditLogs: AuditLogRecord[] = [];

  constructor(config?: { webhookSecret?: string; downloadSigningSecret?: string; initialNowMs?: number }) {
    this.webhookSecret = config?.webhookSecret ?? 'sandbox_webhook_hmac_secret_2026_do_not_expose';
    this.downloadSigningSecret = config?.downloadSigningSecret ?? 'private_storage_url_secret_2026';
    this.currentClockMs = config?.initialNowMs ?? Date.parse('2026-10-26T06:00:00.000Z');
    this.seedInitialData();
  }

  public advanceClockMs(deltaMs: number): void {
    this.currentClockMs += deltaMs;
  }

  public nowIso(): string {
    return new Date(this.currentClockMs).toISOString();
  }

  private seedInitialData(): void {
    const adminUser: AuthenticatedUser = {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'admin@aipresentation.bd',
      fullName: 'Platform Administrator',
      role: 'admin',
      freePreviewProjectsUsed: 0,
    };
    const customerOne: AuthenticatedUser = {
      id: '00000000-0000-4000-8000-000000000002',
      email: 'customer.one@dhaka-fintech.bd',
      fullName: 'Nadia Rahman',
      role: 'customer',
      freePreviewProjectsUsed: 1,
    };
    const customerTwo: AuthenticatedUser = {
      id: '00000000-0000-4000-8000-000000000003',
      email: 'customer.two@chattogram-logistics.bd',
      fullName: 'Tanvir Ahmed',
      role: 'customer',
      freePreviewProjectsUsed: 0,
    };

    this.users.set(adminUser.id, adminUser);
    this.users.set(customerOne.id, customerOne);
    this.users.set(customerTwo.id, customerTwo);

    this.priceConfigs.push({
      version: 1,
      currency: 'BDT',
      base_rate_bdt: 25,
      base_rate_paisa: 2500,
      smooth_rate_bdt: 11,
      smooth_rate_paisa: 1100,
      cinematic_rate_bdt: null,
      cinematic_enabled: false,
      phase0_desktop_gate_passed: false,
      paying_clients_milestone_count: 0,
      free_preview_project_cap: 2,
      free_preview_revision_cap: 2,
      quote_ttl_hours: 24,
      updated_by: adminUser.id,
      change_reason: 'Initial MVP rates: Base BDT 25/slide, Smooth +BDT 11/slide',
      created_at: this.nowIso(),
    });

    for (const t of ALLOWED_TRANSITIONS) {
      this.motionLibrary.set(t, { enabled: false, templateVersion: '2026.10.26-rev2' });
    }

    const seedProject: ProjectRecord = {
      id: '10000000-0000-4000-8000-000000000001',
      owner_id: customerOne.id,
      title: 'Q4 Bangladesh Fintech Expansion',
      language_mode: 'bilingual',
      design_family: 'corporate_slate',
      slide_count: 10,
      motion_tier_requested: 'smooth',
      state: 'design_approved',
      preview_revisions_used: 0,
      free_motion_swap_used: false,
      created_at: this.nowIso(),
      updated_at: this.nowIso(),
    };
    this.projects.set(seedProject.id, seedProject);

    const seedSpec: DesignSpecRecord = {
      id: '20000000-0000-4000-8000-000000000001',
      project_id: seedProject.id,
      version: 1,
      is_locked: false,
      locked_at: null,
      spec_json: {
        motion_tier: 'smooth',
        intensity: 'standard',
        transition_id: 'fade',
        animation_policy: '1.0.0-phase0',
        design_family: seedProject.design_family,
        slide_count: seedProject.slide_count,
      },
      created_at: this.nowIso(),
      updated_at: this.nowIso(),
    };
    this.designSpecs.set(seedSpec.id, seedSpec);
  }

  public getActivePriceConfig(): PriceConfigRecord {
    const active = this.priceConfigs[this.priceConfigs.length - 1];
    if (!active) {
      throw new Error('No price configuration is seeded.');
    }
    return active;
  }

  private getLatestDesignSpecForProject(projectId: string): DesignSpecRecord | undefined {
    const specs = Array.from(this.designSpecs.values())
      .filter((s) => s.project_id === projectId)
      .sort((a, b) => b.version - a.version);
    return specs[0];
  }

  // ==========================================================================
  // ENDPOINT 1: POST /projects/:id/motion
  // ==========================================================================
  public postProjectMotion(
    user: AuthenticatedUser,
    projectId: string,
    rawBody: unknown
  ): ApiResponse<{ project: ProjectRecord; design_spec: DesignSpecRecord }> {
    const project = this.projects.get(projectId);
    if (!project) {
      return { status: 404, body: { ok: false, errorCode: 'PROJECT_NOT_FOUND', message: 'Project not found.' } };
    }
    if (project.owner_id !== user.id) {
      return {
        status: 403,
        body: { ok: false, errorCode: 'FORBIDDEN_NOT_OWNER', message: 'You do not own this project.' },
      };
    }

    const parsed = MotionUpdateRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return {
        status: 400,
        body: { ok: false, errorCode: parsed.errorCode, message: 'Invalid motion payload.', details: parsed.issues },
      };
    }

    const activePricing = this.getActivePriceConfig();
    if (parsed.data.motion_tier === 'cinematic' && !activePricing.cinematic_enabled) {
      return {
        status: 403,
        body: {
          ok: false,
          errorCode: 'CINEMATIC_TIER_DISABLED',
          message: 'Cinematic tier is disabled until Phase 0 desktop QA and the 5-paying-client gates pass.',
        },
      };
    }

    if (parsed.data.transition_id) {
      const libEntry = this.motionLibrary.get(parsed.data.transition_id);
      if (!libEntry || !libEntry.enabled) {
        return {
          status: 400,
          body: {
            ok: false,
            errorCode: 'TRANSITION_DISABLED_IN_LIBRARY',
            message: `Transition '${parsed.data.transition_id}' is currently disabled in the motion library.`,
          },
        };
      }
    }

    const allowedStates: ProjectState[] = ['design_approved', 'motion_configured', 'quoted'];
    if (!allowedStates.includes(project.state)) {
      return {
        status: 409,
        body: {
          ok: false,
          errorCode: 'INVALID_PROJECT_STATE',
          message: `Cannot configure motion when project is in state '${project.state}'. Approve static design first.`,
        },
      };
    }

    const latestSpec = this.getLatestDesignSpecForProject(project.id);
    const nextVersion = latestSpec ? (latestSpec.is_locked ? latestSpec.version + 1 : latestSpec.version) : 1;
    const specId =
      latestSpec && !latestSpec.is_locked ? latestSpec.id : `spec_${crypto.randomUUID().slice(0, 12)}`;

    const updatedSpec: DesignSpecRecord = {
      id: specId,
      project_id: project.id,
      version: nextVersion,
      is_locked: false,
      locked_at: null,
      spec_json: {
        motion_tier: parsed.data.motion_tier,
        intensity: parsed.data.motion_tier === 'static' ? null : parsed.data.intensity,
        transition_id: parsed.data.motion_tier === 'static' ? null : parsed.data.transition_id,
        animation_policy: '1.0.0-phase0',
        design_family: project.design_family,
        slide_count: project.slide_count,
      },
      created_at: latestSpec && !latestSpec.is_locked ? latestSpec.created_at : this.nowIso(),
      updated_at: this.nowIso(),
    };

    this.designSpecs.set(updatedSpec.id, updatedSpec);
    project.motion_tier_requested = parsed.data.motion_tier;
    project.state = 'motion_configured';
    project.updated_at = this.nowIso();

    return {
      status: 200,
      body: { ok: true, data: { project: { ...project }, design_spec: structuredClone(updatedSpec) } },
    };
  }

  // ==========================================================================
  // ENDPOINT 2: POST /projects/:id/quote (Server-Computed & Immutable Snapshot)
  // ==========================================================================
  public postProjectQuote(
    user: AuthenticatedUser,
    projectId: string,
    rawBody: unknown
  ): ApiResponse<{ quote: QuoteRecord; locked_design_spec: DesignSpecRecord }> {
    const project = this.projects.get(projectId);
    if (!project) {
      return { status: 404, body: { ok: false, errorCode: 'PROJECT_NOT_FOUND', message: 'Project not found.' } };
    }
    if (project.owner_id !== user.id) {
      return {
        status: 403,
        body: { ok: false, errorCode: 'FORBIDDEN_NOT_OWNER', message: 'You do not own this project.' },
      };
    }

    const parsed = QuoteCreateRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return {
        status: 400,
        body: { ok: false, errorCode: parsed.errorCode, message: 'Invalid quote request.', details: parsed.issues },
      };
    }

    const quotableStates: ProjectState[] = ['design_approved', 'motion_configured', 'quoted'];
    if (!quotableStates.includes(project.state)) {
      return { status: 409, body: { ok: false, errorCode: 'INVALID_PROJECT_STATE',
        message: 'Approve the static design and configure motion before requesting a quote.' } };
    }

    const spec = parsed.data.design_spec_id
      ? this.designSpecs.get(parsed.data.design_spec_id)
      : this.getLatestDesignSpecForProject(project.id);

    if (!spec || spec.project_id !== project.id) {
      return {
        status: 404,
        body: { ok: false, errorCode: 'DESIGN_SPEC_NOT_FOUND', message: 'Design specification not found.' },
      };
    }

    const cfg = this.getActivePriceConfig();
    const tier = spec.spec_json.motion_tier;

    if (tier === 'cinematic' && (!cfg.cinematic_enabled || cfg.cinematic_rate_bdt === null)) {
      return {
        status: 403,
        body: {
          ok: false,
          errorCode: 'CINEMATIC_TIER_DISABLED',
          message: 'Cinematic tier is not enabled for quoting.',
        },
      };
    }

    if (tier !== 'static') {
      const transition = spec.spec_json.transition_id;
      if (!transition || !this.motionLibrary.get(transition)?.enabled) {
        return { status: 409, body: { ok: false, errorCode: 'TRANSITION_DISABLED_IN_LIBRARY',
          message: 'This motion candidate has no production approval; quoting is blocked.' } };
      }
    }

    // Supersede any previous active quotes for this project
    for (const existingQuote of this.quotes.values()) {
      if (existingQuote.project_id === project.id && existingQuote.status === 'active') {
        this.quotes.set(existingQuote.id, Object.freeze({ ...existingQuote, status: 'superseded' }));
      }
    }

    // Lock the design specification so production is guaranteed to use this exact snapshot
    spec.is_locked = true;
    spec.locked_at = this.nowIso();
    spec.updated_at = this.nowIso();

    const slideCount = project.slide_count;
    const baseRateBdt = cfg.base_rate_bdt;
    const motionRateBdt =
      tier === 'static' ? 0 : tier === 'smooth' ? cfg.smooth_rate_bdt : (cfg.cinematic_rate_bdt ?? 0);

    const baseSubtotalBdt = slideCount * baseRateBdt;
    const motionSubtotalBdt = slideCount * motionRateBdt;
    const totalAmountBdt = baseSubtotalBdt + motionSubtotalBdt;
    const totalAmountPaisa = totalAmountBdt * 100;

    const expiresAtMs = this.currentClockMs + cfg.quote_ttl_hours * 3600 * 1000;

    const breakdown: QuoteBreakdownSnapshot = {
      currency: 'BDT',
      pricing_config_version: cfg.version,
      slide_count: slideCount,
      tier,
      base_rate_per_slide_bdt: baseRateBdt,
      motion_rate_per_slide_bdt: motionRateBdt,
      base_subtotal_bdt: baseSubtotalBdt,
      motion_subtotal_bdt: motionSubtotalBdt,
      tax_amount_bdt: 0,
      total_amount_bdt: totalAmountBdt,
      total_amount_paisa: totalAmountPaisa,
      formula_applied:
        tier === 'static'
          ? `${slideCount} slides * BDT ${baseRateBdt} = BDT ${totalAmountBdt}`
          : `${slideCount} slides * (BDT ${baseRateBdt} + BDT ${motionRateBdt}) = BDT ${totalAmountBdt}`,
      compatibility_statement: 'Motion is built for desktop Microsoft PowerPoint.',
      snapshot_timestamp: this.nowIso(),
    };

    const quoteRecord: QuoteRecord = Object.freeze({
      id: `qt_${crypto.randomUUID().slice(0, 12)}`,
      project_id: project.id,
      owner_id: user.id,
      design_spec_id: spec.id,
      pricing_config_version: cfg.version,
      tier,
      slide_count: slideCount,
      base_rate_bdt: baseRateBdt,
      motion_rate_bdt: motionRateBdt,
      quote_amount: totalAmountBdt,
      quote_amount_paisa: totalAmountPaisa,
      quote_breakdown: Object.freeze(breakdown),
      status: 'active',
      expires_at: new Date(expiresAtMs).toISOString(),
      created_at: this.nowIso(),
    });

    this.quotes.set(quoteRecord.id, quoteRecord);
    project.state = 'quoted';
    project.updated_at = this.nowIso();

    return {
      status: 201,
      body: {
        ok: true,
        data: {
          quote: structuredClone(quoteRecord),
          locked_design_spec: structuredClone(spec),
        },
      },
    };
  }

  // ==========================================================================
  // ENDPOINT 3: POST /checkout/session (Enforces Quote Ownership & Expiry)
  // ==========================================================================
  public postCheckoutSession(
    user: AuthenticatedUser,
    rawBody: unknown
  ): ApiResponse<{ payment: PaymentRecord; gateway_checkout_url: string }> {
    const parsed = CheckoutSessionRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return {
        status: 400,
        body: { ok: false, errorCode: parsed.errorCode, message: 'Invalid checkout request.', details: parsed.issues },
      };
    }

    // Idempotency check on checkout session creation
    for (const existingPayment of this.payments.values()) {
      if (existingPayment.idempotency_key === parsed.data.idempotency_key) {
        if (existingPayment.owner_id !== user.id) {
          return { status: 403, body: { ok: false, errorCode: 'FORBIDDEN_NOT_OWNER', message: 'Forbidden.' } };
        }
        return {
          status: 200,
          body: {
            ok: true,
            data: {
              payment: structuredClone(existingPayment),
              gateway_checkout_url: `https://sandbox.sslcommerz.com/gwprocess/v4/sim/${existingPayment.provider_session_id}`,
            },
          },
        };
      }
    }

    const quote = this.quotes.get(parsed.data.quote_id);
    if (!quote) {
      return { status: 404, body: { ok: false, errorCode: 'QUOTE_NOT_FOUND', message: 'Quote not found.' } };
    }
    if (quote.owner_id !== user.id) {
      return {
        status: 403,
        body: { ok: false, errorCode: 'FORBIDDEN_NOT_OWNER', message: 'You do not own this quote.' },
      };
    }
    if (quote.status === 'paid') {
      return { status: 409, body: { ok: false, errorCode: 'QUOTE_ALREADY_PAID', message: 'Quote is already paid.' } };
    }
    if (quote.status !== 'active' || this.currentClockMs >= Date.parse(quote.expires_at)) {
      return {
        status: 409,
        body: {
          ok: false,
          errorCode: 'QUOTE_EXPIRED',
          message: 'This quote has expired. Please request a fresh server quote before checkout.',
        },
      };
    }

    const project = this.projects.get(quote.project_id)!;
    const payment: PaymentRecord = {
      id: `pay_${crypto.randomUUID().slice(0, 12)}`,
      project_id: quote.project_id,
      owner_id: user.id,
      quote_id: quote.id,
      provider: parsed.data.provider,
      provider_session_id: `sess_${crypto.randomUUID().slice(0, 12)}`,
      provider_txn_id: null,
      idempotency_key: parsed.data.idempotency_key,
      tier: quote.tier,
      quote_amount: quote.quote_amount,
      quote_amount_paisa: quote.quote_amount_paisa,
      quote_breakdown: structuredClone(quote.quote_breakdown),
      status: 'pending',
      webhook_signature_verified: false,
      verified_at: null,
      created_at: this.nowIso(),
    };

    this.payments.set(payment.id, payment);
    project.state = 'payment_pending';
    project.updated_at = this.nowIso();

    return {
      status: 201,
      body: {
        ok: true,
        data: {
          payment: structuredClone(payment),
          gateway_checkout_url: `https://sandbox.sslcommerz.com/gwprocess/v4/sim/${payment.provider_session_id}`,
        },
      },
    };
  }

  // ==========================================================================
  // ENDPOINT 4: POST /webhooks/:provider (Signed & Idempotent Payment Webhook)
  // ==========================================================================
  public postPaymentWebhook(
    provider: string,
    rawBodyString: string,
    signatureHeader: string
  ): ApiResponse<{ idempotent_replay: boolean; payment_status: string; entitlement?: EntitlementRecord }> {
    const sigValid = verifyWebhookHmacSignature(rawBodyString, signatureHeader, this.webhookSecret);
    if (!sigValid) {
      return {
        status: 401,
        body: {
          ok: false,
          errorCode: 'WEBHOOK_SIGNATURE_INVALID',
          message: 'Cryptographic webhook HMAC-SHA256 signature verification failed.',
        },
      };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBodyString);
    } catch {
      return { status: 400, body: { ok: false, errorCode: 'MALFORMED_JSON', message: 'Invalid JSON.' } };
    }

    const validated = WebhookPayloadSchema.safeParse(parsedJson);
    if (!validated.success) {
      return {
        status: 400,
        body: {
          ok: false,
          errorCode: validated.errorCode,
          message: 'Webhook payload schema validation failed.',
          details: validated.issues,
        },
      };
    }

    const payload = validated.data;
    const dedupeKey = `${provider}:${payload.event_id}`;

    // Idempotent replay check
    const existingEvent = this.webhookEvents.get(dedupeKey);
    if (existingEvent) {
      const existingPayment = this.payments.get(existingEvent.paymentId)!;
      const existingEnt = this.entitlements.get(existingPayment.project_id);
      return {
        status: 200,
        body: {
          ok: true,
          data: {
            idempotent_replay: true,
            payment_status: existingPayment.status,
            entitlement: existingEnt ? structuredClone(existingEnt) : undefined,
          },
        },
      };
    }

    const payment = Array.from(this.payments.values()).find(
      (p) => p.provider_session_id === payload.provider_session_id
    );
    if (!payment) {
      return {
        status: 404,
        body: { ok: false, errorCode: 'PAYMENT_SESSION_NOT_FOUND', message: 'Payment session not found.' },
      };
    }

    // Verify amount matches stored server quote snapshot
    if (payload.amount_bdt !== payment.quote_amount) {
      return {
        status: 400,
        body: {
          ok: false,
          errorCode: 'WEBHOOK_AMOUNT_MISMATCH',
          message: `Webhook amount BDT ${payload.amount_bdt} does not match stored quote amount BDT ${payment.quote_amount}.`,
        },
      };
    }

    const project = this.projects.get(payment.project_id)!;
    const quote = this.quotes.get(payment.quote_id)!;

    this.webhookEvents.set(dedupeKey, {
      eventId: payload.event_id,
      paymentId: payment.id,
      processedAt: this.nowIso(),
    });

    if (payload.status === 'FAILED') {
      payment.status = 'failed';
      payment.webhook_signature_verified = true;
      project.state = 'payment_failed';
      project.updated_at = this.nowIso();
      return {
        status: 200,
        body: { ok: true, data: { idempotent_replay: false, payment_status: 'failed' } },
      };
    }

    // Mark payment verified and grant server-side entitlement
    payment.status = 'verified';
    payment.provider_txn_id = payload.provider_txn_id;
    payment.webhook_signature_verified = true;
    payment.verified_at = this.nowIso();

    // Update quote status via new frozen record
    const paidQuote: QuoteRecord = Object.freeze({
      ...quote,
      status: 'paid',
    });
    this.quotes.set(quote.id, paidQuote);

    let entitlement = this.entitlements.get(project.id);
    if (!entitlement) {
      entitlement = {
        id: `ent_${crypto.randomUUID().slice(0, 12)}`,
        project_id: project.id,
        owner_id: payment.owner_id,
        payment_id: payment.id,
        design_spec_id: quote.design_spec_id,
        motion_tier: payment.tier,
        free_motion_swaps_remaining: 1,
        status: 'active',
        granted_at: this.nowIso(),
      };
      this.entitlements.set(project.id, entitlement);
    }

    project.state = 'paid';
    project.updated_at = this.nowIso();

    this.auditLogs.push({
      id: `aud_${crypto.randomUUID().slice(0, 12)}`,
      actor_id: payment.owner_id,
      actor_role: 'customer',
      action: 'PAYMENT_WEBHOOK_VERIFIED_AND_ENTITLEMENT_GRANTED',
      target_entity: 'entitlements',
      target_id: entitlement.id,
      old_value: null,
      new_value: { project_id: project.id, motion_tier: entitlement.motion_tier, quote_amount: payment.quote_amount },
      created_at: this.nowIso(),
    });

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          idempotent_replay: false,
          payment_status: 'verified',
          entitlement: structuredClone(entitlement),
        },
      },
    };
  }

  // ==========================================================================
  // ENDPOINT 5: POST /projects/:id/produce (Idempotent Durable Job Enqueue)
  // ==========================================================================
  public postProducePresentation(
    user: AuthenticatedUser,
    projectId: string,
    rawBody: unknown
  ): ApiResponse<{ job: JobRecord; idempotent_replay: boolean }> {
    const project = this.projects.get(projectId);
    if (!project) {
      return { status: 404, body: { ok: false, errorCode: 'PROJECT_NOT_FOUND', message: 'Project not found.' } };
    }
    if (project.owner_id !== user.id) {
      return {
        status: 403,
        body: { ok: false, errorCode: 'FORBIDDEN_NOT_OWNER', message: 'You do not own this project.' },
      };
    }

    const parsed = ProduceJobRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return {
        status: 400,
        body: { ok: false, errorCode: parsed.errorCode, message: 'Invalid produce request.', details: parsed.issues },
      };
    }

    // Check idempotency key first
    for (const existingJob of this.jobs.values()) {
      if (existingJob.idempotency_key === parsed.data.idempotency_key) {
        if (existingJob.owner_id !== user.id) {
          return { status: 403, body: { ok: false, errorCode: 'FORBIDDEN_NOT_OWNER', message: 'Forbidden.' } };
        }
        return {
          status: 200,
          body: { ok: true, data: { job: structuredClone(existingJob), idempotent_replay: true } },
        };
      }
    }

    // Verify entitlement & locked design spec match (FR-17)
    const entitlement = this.entitlements.get(project.id);
    if (!entitlement || entitlement.status !== 'active') {
      return {
        status: 403,
        body: {
          ok: false,
          errorCode: 'ENTITLEMENT_REQUIRED',
          message: 'Cannot start production without a verified payment entitlement.',
        },
      };
    }

    const lockedSpec = this.designSpecs.get(entitlement.design_spec_id);
    if (!lockedSpec || !lockedSpec.is_locked) {
      return {
        status: 409,
        body: {
          ok: false,
          errorCode: 'DESIGN_SPEC_NOT_LOCKED',
          message: 'Design specification must be locked before production.',
        },
      };
    }

    if (entitlement.motion_tier !== lockedSpec.spec_json.motion_tier) {
      return {
        status: 403,
        body: {
          ok: false,
          errorCode: 'ENTITLEMENT_TIER_MISMATCH',
          message: `Entitlement tier '${entitlement.motion_tier}' does not match locked spec tier '${lockedSpec.spec_json.motion_tier}'.`,
        },
      };
    }

    const tier = lockedSpec.spec_json.motion_tier;
    const transitionId = lockedSpec.spec_json.transition_id;
    const intensity = lockedSpec.spec_json.intensity;

    // Build deterministic jobs.animation_choices audit record (FR-19)
    const animationChoices: JobAnimationChoicesAudit = {
      generator_version: '0.2.0-opc-template-patcher',
      template_version: '2026.10.26-rev2',
      policy_version: lockedSpec.spec_json.animation_policy,
      tier,
      deck_transition: transitionId,
      intensity,
      slides: [
        {
          slide_index: 1,
          bullet_count: 0,
          bullet_suppression_applied: false,
          cap_truncation_applied: false,
          selected_entrances:
            tier === 'smooth'
              ? [
                  { shape_id: 2, role: 'title', entrance_id: 'fade', duration_ms: 500, trigger: 'withEffect' },
                  { shape_id: 3, role: 'quote', entrance_id: 'fade', duration_ms: 500, trigger: 'afterEffect' },
                ]
              : [],
        },
        {
          slide_index: 5,
          bullet_count: 8,
          bullet_suppression_applied: tier === 'smooth',
          cap_truncation_applied: false,
          selected_entrances:
            tier === 'smooth'
              ? [{ shape_id: 2, role: 'title', entrance_id: 'fade', duration_ms: 500, trigger: 'withEffect' }]
              : [],
        },
      ],
    };

    const job: JobRecord = {
      id: `job_${crypto.randomUUID().slice(0, 12)}`,
      project_id: project.id,
      owner_id: user.id,
      design_spec_id: lockedSpec.id,
      entitlement_id: entitlement.id,
      idempotency_key: parsed.data.idempotency_key,
      job_type: 'pptx_production',
      status: 'queued',
      progress_stage: 'Queued for background Open XML generation and validation',
      attempts: 0,
      max_attempts: 3,
      next_retry_at: null,
      animation_choices: animationChoices,
      validation_report: null,
      output_asset_id: null,
      error_code: null,
      error_message: null,
      created_at: this.nowIso(),
      updated_at: this.nowIso(),
      completed_at: null,
    };

    this.jobs.set(job.id, job);
    project.state = 'production_queued';
    project.updated_at = this.nowIso();

    // Execute worker step (simulating durable worker processing)
    this.processBackgroundJob(job.id, Boolean(parsed.data.simulate_validation_failure));

    return {
      status: 202,
      body: { ok: true, data: { job: structuredClone(this.jobs.get(job.id)!), idempotent_replay: false } },
    };
  }

  /**
   * Durable Worker Execution & Retry Strategy
   */
  public processBackgroundJob(jobId: string, simulateValidationFailure = false, simulateTransientCrash = false): JobRecord {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    const project = this.projects.get(job.project_id)!;

    job.attempts += 1;
    job.status = 'running';
    job.progress_stage = 'Generating static slide geometry and applying Open XML template patcher';
    job.updated_at = this.nowIso();
    project.state = 'producing';

    if (simulateTransientCrash) {
      if (job.attempts < job.max_attempts) {
        job.status = 'queued';
        const backoffSeconds = Math.pow(2, job.attempts) * 15;
        job.next_retry_at = new Date(this.currentClockMs + backoffSeconds * 1000).toISOString();
        job.error_code = 'WORKER_TRANSIENT_TIMEOUT';
        job.error_message = `Attempt ${job.attempts}/${job.max_attempts} timed out; scheduled retry in ${backoffSeconds}s.`;
        return job;
      } else {
        job.status = 'failed';
        job.error_code = 'MAX_RETRIES_EXCEEDED';
        job.error_message = 'Worker exhausted maximum retry attempts.';
        project.state = 'production_failed';
        return job;
      }
    }

    job.status = 'validating';
    job.progress_stage = 'Running OPC package integrity and ECMA-376 Open XML policy validation';
    project.state = 'validating';

    if (simulateValidationFailure) {
      job.status = 'quarantined';
      job.progress_stage = 'Delivery blocked: Open XML validation failed and file was quarantined';
      job.error_code = 'OPEN_XML_POLICY_VIOLATION';
      job.error_message = "Slide 5 contains unapproved animation target spid='999'. Output quarantined.";
      job.validation_report = {
        valid_package_and_policy: false,
        checked_slides: project.slide_count,
        errors: [job.error_message],
      };

      const quarantinedAsset: GeneratedAssetRecord = {
        id: `ast_${crypto.randomUUID().slice(0, 12)}`,
        project_id: project.id,
        job_id: job.id,
        owner_id: project.owner_id,
        asset_type: 'pptx_deck',
        storage_bucket: 'private-presentations',
        storage_key: `quarantine/${project.id}/${job.id}.pptx`,
        filename: `${project.id}_quarantined.pptx`,
        mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        size_bytes: 13824,
        sha256_checksum: crypto.createHash('sha256').update(job.id).digest('hex'),
        is_private: true,
        is_quarantined: true,
        created_at: this.nowIso(),
      };
      this.assets.set(quarantinedAsset.id, quarantinedAsset);
      job.output_asset_id = quarantinedAsset.id;
      project.state = 'production_failed';
      return job;
    }

    // Validation passed -> store private asset and mark delivered
    const validAsset: GeneratedAssetRecord = {
      id: `ast_${crypto.randomUUID().slice(0, 12)}`,
      project_id: project.id,
      job_id: job.id,
      owner_id: project.owner_id,
      asset_type: 'pptx_deck',
      storage_bucket: 'private-presentations',
      storage_key: `delivered/${project.owner_id}/${project.id}/${job.id}.pptx`,
      filename: `${project.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.pptx`,
      mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      size_bytes: 14260,
      sha256_checksum: crypto.createHash('sha256').update(`${job.id}:verified`).digest('hex'),
      is_private: true,
      is_quarantined: false,
      created_at: this.nowIso(),
    };
    this.assets.set(validAsset.id, validAsset);

    job.status = 'completed';
    job.progress_stage = 'OPC package and motion policy validation passed; ready for private download';
    job.validation_report = {
      valid_package_and_policy: true,
      checked_slides: project.slide_count,
      errors: [],
    };
    job.output_asset_id = validAsset.id;
    job.error_code = null;
    job.error_message = null;
    job.completed_at = this.nowIso();
    job.updated_at = this.nowIso();

    project.state = 'delivered';
    project.updated_at = this.nowIso();
    return job;
  }

  // ==========================================================================
  // ENDPOINT 6: GET /projects/:id/status (Authenticated Job Status Retrieval)
  // ==========================================================================
  public getProjectJobStatus(
    user: AuthenticatedUser,
    projectId: string
  ): ApiResponse<{ project_state: ProjectState; latest_job: JobRecord | null }> {
    const project = this.projects.get(projectId);
    if (!project) {
      return { status: 404, body: { ok: false, errorCode: 'PROJECT_NOT_FOUND', message: 'Project not found.' } };
    }
    if (project.owner_id !== user.id && user.role !== 'admin') {
      return {
        status: 403,
        body: { ok: false, errorCode: 'FORBIDDEN_NOT_OWNER', message: 'You do not own this project.' },
      };
    }

    const projectJobs = Array.from(this.jobs.values()).filter((j) => j.project_id === project.id);
    const latestJob = projectJobs.length > 0 ? projectJobs[projectJobs.length - 1] : null;

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          project_state: project.state,
          latest_job: latestJob ? structuredClone(latestJob) : null,
        },
      },
    };
  }

  // ==========================================================================
  // ENDPOINT 7: GET /projects/:id/download (Authorized Expiring Signed URL)
  // ==========================================================================
  public getProjectDownload(
    user: AuthenticatedUser,
    projectId: string
  ): ApiResponse<{
    signed_url: string;
    expires_at: string;
    token: string;
    filename: string;
    sha256_checksum: string;
    compatibility_notice: string;
  }> {
    const project = this.projects.get(projectId);
    if (!project) {
      return { status: 404, body: { ok: false, errorCode: 'PROJECT_NOT_FOUND', message: 'Project not found.' } };
    }
    if (project.owner_id !== user.id) {
      return {
        status: 403,
        body: { ok: false, errorCode: 'FORBIDDEN_NOT_OWNER', message: 'You do not own this project.' },
      };
    }

    const projectJobs = Array.from(this.jobs.values()).filter((j) => j.project_id === project.id);
    const latestJob = projectJobs.length > 0 ? projectJobs[projectJobs.length - 1] : null;

    if (!latestJob || latestJob.status === 'quarantined' || latestJob.status !== 'completed') {
      return {
        status: 409,
        body: {
          ok: false,
          errorCode: 'DELIVERY_BLOCKED_OR_INCOMPLETE',
          message:
            latestJob?.status === 'quarantined'
              ? 'Delivery blocked: generated presentation failed Open XML validation and was quarantined.'
              : 'Presentation production is not yet complete.',
        },
      };
    }

    const asset = latestJob.output_asset_id ? this.assets.get(latestJob.output_asset_id) : undefined;
    if (!asset || asset.is_quarantined) {
      return {
        status: 409,
        body: { ok: false, errorCode: 'ASSET_QUARANTINED', message: 'Output asset is quarantined.' },
      };
    }

    const signed = createExpiringSignedDownloadUrl({
      assetId: asset.id,
      projectId: project.id,
      ownerId: user.id,
      storageKey: asset.storage_key,
      expiresInSeconds: 15 * 60, // 15-minute expiring signed URL
      signingSecret: this.downloadSigningSecret,
      nowMs: this.currentClockMs,
    });

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          signed_url: signed.signedUrl,
          expires_at: signed.expiresAtIso,
          token: signed.token,
          filename: asset.filename,
          sha256_checksum: asset.sha256_checksum,
          compatibility_notice: 'Motion is built for desktop Microsoft PowerPoint.',
        },
      },
    };
  }

  // ==========================================================================
  // ENDPOINT 8: PUT /admin/pricing (Admin-Only Rate Update + Audit Trail)
  // ==========================================================================
  public putAdminPricing(
    user: AuthenticatedUser,
    rawBody: unknown
  ): ApiResponse<{ pricing_config: PriceConfigRecord; audit_log: AuditLogRecord }> {
    if (user.role !== 'admin') {
      return {
        status: 403,
        body: { ok: false, errorCode: 'ADMIN_ROLE_REQUIRED', message: 'Only administrators can update pricing.' },
      };
    }

    const parsed = AdminPricingUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return {
        status: 400,
        body: { ok: false, errorCode: parsed.errorCode, message: 'Invalid pricing update.', details: parsed.issues },
      };
    }

    const currentConfig = this.getActivePriceConfig();
    const input = parsed.data;

    // Enforce Cinematic release gate (FR-24)
    if (input.cinematic_enabled) {
      if (
        !currentConfig.phase0_desktop_gate_passed ||
        currentConfig.paying_clients_milestone_count < 5 ||
        !input.cinematic_rate_bdt
      ) {
        return {
          status: 409,
          body: {
            ok: false,
            errorCode: 'CINEMATIC_RELEASE_GATE_UNMET',
            message:
              'Cannot enable Cinematic tier until Phase 0 desktop QA passes, 5 paying clients are recorded, and cinematic_rate_bdt is set.',
          },
        };
      }
    }

    const newConfig: PriceConfigRecord = {
      version: currentConfig.version + 1,
      currency: 'BDT',
      base_rate_bdt: input.base_rate_bdt,
      base_rate_paisa: input.base_rate_bdt * 100,
      smooth_rate_bdt: input.smooth_rate_bdt,
      smooth_rate_paisa: input.smooth_rate_bdt * 100,
      cinematic_rate_bdt: input.cinematic_rate_bdt ?? null,
      cinematic_enabled: Boolean(input.cinematic_enabled),
      phase0_desktop_gate_passed: currentConfig.phase0_desktop_gate_passed,
      paying_clients_milestone_count: currentConfig.paying_clients_milestone_count,
      free_preview_project_cap: currentConfig.free_preview_project_cap,
      free_preview_revision_cap: currentConfig.free_preview_revision_cap,
      quote_ttl_hours: input.quote_ttl_hours ?? currentConfig.quote_ttl_hours,
      updated_by: user.id,
      change_reason: input.change_reason,
      created_at: this.nowIso(),
    };

    this.priceConfigs.push(newConfig);

    const auditEntry: AuditLogRecord = {
      id: `aud_${crypto.randomUUID().slice(0, 12)}`,
      actor_id: user.id,
      actor_role: user.role,
      action: 'ADMIN_UPDATE_PRICING_CONFIG',
      target_entity: 'price_configs',
      target_id: String(newConfig.version),
      old_value: {
        version: currentConfig.version,
        base_rate_bdt: currentConfig.base_rate_bdt,
        smooth_rate_bdt: currentConfig.smooth_rate_bdt,
        cinematic_enabled: currentConfig.cinematic_enabled,
      },
      new_value: {
        version: newConfig.version,
        base_rate_bdt: newConfig.base_rate_bdt,
        smooth_rate_bdt: newConfig.smooth_rate_bdt,
        cinematic_enabled: newConfig.cinematic_enabled,
        change_reason: newConfig.change_reason,
      },
      created_at: this.nowIso(),
    };
    this.auditLogs.push(auditEntry);

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          pricing_config: structuredClone(newConfig),
          audit_log: structuredClone(auditEntry),
        },
      },
    };
  }
}

// ============================================================================
// 5. AUTOMATED SECURITY, IMMUTABILITY & CONTRACT TEST SUITE
// ============================================================================

function assertCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

export function runProductionFoundationTests(): { passed: number; results: string[] } {
  const results: string[] = [];
  const webhookSecret = 'test_webhook_secret_key_2026';
  const downloadSecret = 'test_download_secret_key_2026';
  const server = new ProductionFoundationServer({
    webhookSecret,
    downloadSigningSecret: downloadSecret,
  });

  // TEST FIXTURE ONLY: enable experimental candidates to exercise pricing/payment models.
  // This does not approve any effect for production or desktop playback.
  for (const effect of server.motionLibrary.values()) effect.enabled = true;

  const admin = server.users.get('00000000-0000-4000-8000-000000000001')!;
  const userA = server.users.get('00000000-0000-4000-8000-000000000002')!;
  const userB = server.users.get('00000000-0000-4000-8000-000000000003')!;
  const projectId = '10000000-0000-4000-8000-000000000001'; // 10 slides, owned by userA

  // Test 1: Ownership check on POST /projects/:id/motion
  const crossUserMotion = server.postProjectMotion(userB, projectId, {
    motion_tier: 'smooth',
    transition_id: 'fade',
    intensity: 'standard',
  });
  assertCondition(crossUserMotion.status === 403, 'User B must be blocked from updating User A project motion.');
  results.push('PASS [Test 01]: Project ownership check enforced on POST /projects/:id/motion (403 Forbidden).');

  // Test 2: Static tier rejects non-null transition_id or intensity
  const invalidStaticMotion = server.postProjectMotion(userA, projectId, {
    motion_tier: 'static',
    transition_id: 'fade',
    intensity: 'standard',
  });
  assertCondition(invalidStaticMotion.status === 400, 'Static tier with transition_id must be rejected (400).');
  results.push('PASS [Test 02]: Static tier rejects non-null transition_id/intensity settings (400 Bad Request).');

  // Test 3: Client-submitted price fields are rejected by schema validation
  const tamperedQuoteReq = server.postProjectQuote(userA, projectId, {
    quote_amount: 10,
    price: 10,
  });
  assertCondition(tamperedQuoteReq.status === 400, 'Client-supplied price fields must be rejected.');
  results.push('PASS [Test 03]: Zero-trust validation rejects client-submitted price fields (400 Security Violation).');

  // Test 4: Static quote math (10 slides * BDT 25 = BDT 250 / 25,000 paisa)
  const validStaticMotion = server.postProjectMotion(userA, projectId, {
    motion_tier: 'static',
    transition_id: null,
    intensity: null,
  });
  assertCondition(validStaticMotion.status === 200, 'Valid Static motion config must succeed.');
  const staticQuoteRes = server.postProjectQuote(userA, projectId, {});
  assertCondition(staticQuoteRes.status === 201 && staticQuoteRes.body.ok, 'Static quote creation must succeed.');
  if (staticQuoteRes.body.ok) {
    assertCondition(staticQuoteRes.body.data.quote.quote_amount === 250, '10-slide Static quote must equal BDT 250.');
    assertCondition(
      staticQuoteRes.body.data.quote.quote_amount_paisa === 25000,
      '10-slide Static quote must equal 25,000 paisa.'
    );
  }
  results.push('PASS [Test 04]: Static server quote calculated accurately (10 slides * BDT 25 = BDT 250 / 25,000 paisa).');

  // Test 5: Smooth quote math (10 slides * (BDT 25 + BDT 11) = BDT 360 / 36,000 paisa) & Design Spec Lock
  const validSmoothMotion = server.postProjectMotion(userA, projectId, {
    motion_tier: 'smooth',
    transition_id: 'wipe',
    intensity: 'dynamic',
  });
  assertCondition(validSmoothMotion.status === 200, 'Valid Smooth motion config must succeed.');
  const smoothQuoteRes = server.postProjectQuote(userA, projectId, {});
  assertCondition(smoothQuoteRes.status === 201 && smoothQuoteRes.body.ok, 'Smooth quote creation must succeed.');
  const quote1 = smoothQuoteRes.body.ok ? smoothQuoteRes.body.data.quote : null!;
  assertCondition(quote1.quote_amount === 360, '10-slide Smooth quote must equal BDT 360.');
  assertCondition(quote1.quote_breakdown.base_subtotal_bdt === 250, 'Base subtotal must be BDT 250.');
  assertCondition(quote1.quote_breakdown.motion_subtotal_bdt === 110, 'Motion subtotal must be BDT 110.');
  results.push('PASS [Test 05]: Smooth server quote calculated accurately (10 slides * BDT 36 = BDT 360) and spec locked.');

  // Test 6: Admin pricing update & Quote Immutability (FR-14, FR-15, FR-25)
  const nonAdminPricingAttempt = server.putAdminPricing(userA, {
    base_rate_bdt: 30,
    smooth_rate_bdt: 15,
    change_reason: 'Unauthorized customer attempt',
  });
  assertCondition(nonAdminPricingAttempt.status === 403, 'Non-admin must be blocked from updating pricing.');

  const adminUpdateRes = server.putAdminPricing(admin, {
    base_rate_bdt: 30,
    smooth_rate_bdt: 15,
    change_reason: 'Q4 rate adjustment after 20-deck cost study',
  });
  assertCondition(adminUpdateRes.status === 200 && adminUpdateRes.body.ok, 'Admin price update must succeed.');

  // Verify existing quote1 remained completely unchanged at BDT 360 (BDT 25 + BDT 11)
  const storedQuote1AfterAdminEdit = server.quotes.get(quote1.id)!;
  assertCondition(
    storedQuote1AfterAdminEdit.quote_amount === 360 &&
      storedQuote1AfterAdminEdit.base_rate_bdt === 25 &&
      storedQuote1AfterAdminEdit.motion_rate_bdt === 11,
    'Existing quote snapshot must remain immutable at BDT 360 after admin rate change.'
  );
  results.push(
    'PASS [Test 06]: Admin rate update (25->30, 11->15) logged to audit_logs; existing quote snapshot remained immutable at BDT 360.'
  );

  // Test 7: Quote Expiry Enforcement (FR-16)
  server.advanceClockMs(25 * 3600 * 1000); // Advance clock 25 hours (> 24h TTL)
  const expiredCheckoutAttempt = server.postCheckoutSession(userA, {
    quote_id: quote1.id,
    provider: 'sslcommerz_sandbox',
    idempotency_key: 'idem_checkout_expired_01',
  });
  assertCondition(
    expiredCheckoutAttempt.status === 409 &&
      !expiredCheckoutAttempt.body.ok &&
      expiredCheckoutAttempt.body.errorCode === 'QUOTE_EXPIRED',
    'Expired quote must be rejected at checkout (409 QUOTE_EXPIRED).'
  );
  results.push('PASS [Test 07]: Expired quote (>24h TTL) blocked from checkout (409 QUOTE_EXPIRED).');

  // Test 8: Re-quoting after expiry uses new Pricing Config v2 (10 slides * (30 + 15) = BDT 450)
  const freshQuoteRes = server.postProjectQuote(userA, projectId, {});
  assertCondition(freshQuoteRes.status === 201 && freshQuoteRes.body.ok, 'Fresh quote must succeed.');
  const quote2 = freshQuoteRes.body.ok ? freshQuoteRes.body.data.quote : null!;
  assertCondition(
    quote2.quote_amount === 450 && quote2.pricing_config_version === 2,
    'New quote after rate update must use v2 rates (BDT 450).'
  );

  const checkoutRes = server.postCheckoutSession(userA, {
    quote_id: quote2.id,
    provider: 'sslcommerz_sandbox',
    idempotency_key: 'idem_checkout_valid_02',
  });
  assertCondition(checkoutRes.status === 201 && checkoutRes.body.ok, 'Checkout session creation must succeed.');
  const paymentSession = checkoutRes.body.ok ? checkoutRes.body.data.payment : null!;
  results.push('PASS [Test 08]: Fresh quote uses updated v2 rates (BDT 450) and creates locked checkout session.');

  // Test 9: Unpaid production job attempt is blocked (FR-17)
  const unpaidProduceAttempt = server.postProducePresentation(userA, projectId, {
    idempotency_key: 'idem_produce_unpaid_01',
  });
  assertCondition(unpaidProduceAttempt.status === 403, 'Production before verified webhook must be blocked (403).');
  results.push('PASS [Test 09]: Production request before payment webhook verification is blocked (403 ENTITLEMENT_REQUIRED).');

  // Test 10: Webhook Signature Verification & Idempotent Replay (FR-18)
  const webhookPayloadObj: WebhookPayloadInput = {
    event_id: 'evt_ssl_20261026_001',
    provider_session_id: paymentSession.provider_session_id,
    provider_txn_id: 'txn_bd_8849201',
    status: 'VALIDATED',
    amount_bdt: 450,
    currency: 'BDT',
  };
  const rawWebhookBody = JSON.stringify(webhookPayloadObj);

  const forgedWebhookRes = server.postPaymentWebhook('sslcommerz_sandbox', rawWebhookBody, 'forged_bad_signature');
  assertCondition(forgedWebhookRes.status === 401, 'Forged webhook signature must be rejected (401).');

  const validSig = computeWebhookHmacSignature(rawWebhookBody, webhookSecret);
  const validWebhookRes1 = server.postPaymentWebhook('sslcommerz_sandbox', rawWebhookBody, validSig);
  assertCondition(
    validWebhookRes1.status === 200 && validWebhookRes1.body.ok && !validWebhookRes1.body.data.idempotent_replay,
    'First valid signed webhook must verify payment and grant entitlement.'
  );

  const validWebhookRes2 = server.postPaymentWebhook('sslcommerz_sandbox', rawWebhookBody, validSig);
  assertCondition(
    validWebhookRes2.status === 200 && validWebhookRes2.body.ok && validWebhookRes2.body.data.idempotent_replay,
    'Duplicate webhook event must be handled idempotently.'
  );
  results.push('PASS [Test 10]: Webhook HMAC-SHA256 signature verified and duplicate IPN event handled idempotently.');

  // Test 11: Quarantined XML Validation Failure Blocks Delivery (FR-20)
  const failedJobRes = server.postProducePresentation(userA, projectId, {
    idempotency_key: 'idem_produce_quarantine_test',
    simulate_validation_failure: true,
  });
  assertCondition(
    failedJobRes.status === 202 &&
      failedJobRes.body.ok &&
      failedJobRes.body.data.job.status === 'quarantined',
    'Validation failure must place job in quarantined state.'
  );

  const blockedDownloadRes = server.getProjectDownload(userA, projectId);
  assertCondition(blockedDownloadRes.status === 409, 'Download of quarantined output must be blocked (409).');
  results.push('PASS [Test 11]: Failed Open XML validation quarantines output and blocks download (409).');

  // Test 12: Successful Idempotent Production Job & Expiring Signed Download URL
  const goodJobRes1 = server.postProducePresentation(userA, projectId, {
    idempotency_key: 'idem_produce_good_01',
    simulate_validation_failure: false,
  });
  assertCondition(
    goodJobRes1.status === 202 && goodJobRes1.body.ok && goodJobRes1.body.data.job.status === 'completed',
    'Valid production job must complete and record jobs.animation_choices.'
  );

  const goodJobRes2 = server.postProducePresentation(userA, projectId, {
    idempotency_key: 'idem_produce_good_01',
  });
  assertCondition(
    goodJobRes2.status === 200 && goodJobRes2.body.ok && goodJobRes2.body.data.idempotent_replay,
    'Duplicate production job request with same idempotency_key must return existing job.'
  );

  const downloadRes = server.getProjectDownload(userA, projectId);
  assertCondition(downloadRes.status === 200 && downloadRes.body.ok, 'Owner download must return signed URL.');
  if (downloadRes.body.ok) {
    const tokenCheckValid = verifyExpiringSignedDownloadToken(
      downloadRes.body.data.token,
      userA.id,
      downloadSecret,
      Date.parse('2026-10-27T07:05:00.000Z')
    );
    assertCondition(tokenCheckValid.valid, 'Signed download token must verify for owner within 15m TTL.');

    const tokenCheckWrongUser = verifyExpiringSignedDownloadToken(
      downloadRes.body.data.token,
      userB.id,
      downloadSecret,
      Date.parse('2026-10-27T07:05:00.000Z')
    );
    assertCondition(!tokenCheckWrongUser.valid, 'Signed download token must reject different user.');

    const tokenCheckExpired = verifyExpiringSignedDownloadToken(
      downloadRes.body.data.token,
      userA.id,
      downloadSecret,
      Date.parse('2026-10-27T08:00:00.000Z') // Past 15m TTL
    );
    assertCondition(
      !tokenCheckExpired.valid && tokenCheckExpired.reason === 'TOKEN_EXPIRED',
      'Signed download token must reject access after 15-minute expiry.'
    );
  }
  results.push(
    'PASS [Test 12]: Idempotent production job logs jobs.animation_choices and issues 15-minute expiring signed URL.'
  );

  return { passed: results.length, results };
}

// Tests run only through the explicit test-backend.mjs entrypoint.
