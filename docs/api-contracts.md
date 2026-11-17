# Proposed API and data contracts

Status: integration proposal based on supplied requirements. It is not a deployed API. Exact intake fields, payment protocol, quote TTL and role-policy conflict remain open. Use TypeScript runtime schemas and server ownership checks; use UUIDs consistently with PostgreSQL.

## Shared values

- `MotionTier = 'static' | 'smooth'`; reserve `cinematic` server-side but reject until release gates pass.
- `TransitionId = 'fade' | 'wipe' | 'push' | 'zoom'`; `EntranceId = 'fade' | 'wipe' | 'zoom' | 'slide_in'`. Candidate membership is separate from production approval.
- `Intensity = 'subtle' | 'standard' | 'dynamic'`; Static requires null transition and intensity.
- `Money = { currency: 'BDT', amount_paisa: integer >= 0 }`; initial rates base 2500 paisa and Smooth fee 1100 paisa/slide. Human UI derives BDT by dividing by 100. Reject floating client price inputs.
- `EffectApproval = { category, effect_id, template_version, template_sha256, structural_status, desktop_evidence[], sample_clip_asset_id, production_enabled }`; enabled only after agreed compatibility evidence passes. Fail closed after a template change.
- All mutable records have UUID identity, server timestamps and explicit version; all user records have project/owner scope. Server obtains actor from verified session, never request JSON.

## Persistent records and invariants

| Record | Required fields | Invariants |
|---|---|---|
| `projects` | id, owner_id, title, verified_slide_count, motion_tier_requested, state, version, created_at, updated_at | State transitions server-controlled; requested tier updated with spec; quotas atomic |
| `design_specs` | id, project_id, version, spec_json, locked_at, approval_version | spec_json preserves motion_tier, intensity, transition_id, animation_policy plus slide count/design family; immutable once locked; new revision gets new UUID/version |
| `price_configs` | version, currency, base_rate_paisa, smooth_rate_paisa, quote_ttl_seconds, active_from, updated_by, reason | Append new versions, exactly one active selection; audit old/new values; no unverified tax defaults presented as tax exemption |
| `quotes` | id, project_id, owner_id, design_spec_id, pricing_version, tier, slide_count, quote_amount_paisa, quote_breakdown, expires_at, status | Monetary/rate/design identity snapshot immutable; lifecycle may change through server transaction; amount equals stored line items |
| `payments` | id, project_id, owner_id, quote_id, provider, provider_session_id, provider_txn_id, tier, quote_amount, quote_amount_paisa, quote_breakdown, status | Preserve source-required BDT amount and breakdown while integer paisa is canonical; exact conversion; immutable snapshot; unique provider transaction |
| `payment_events` | provider, event_id, payment_id, payload_hash, validation_outcome, processed_at | Unique provider/event; altered payload with reused event ID rejected or investigated; no raw secrets; validate provider protocol |
| `entitlements` | id, project_id, owner_id, payment_id, design_spec_id, motion_tier, status, remaining_swaps | Grant only verified payment transaction; tier/spec/payment agree; revoke/reconcile on terminal refund policy |
| `jobs` | id, project_id, owner_id, entitlement_id, design_spec_id, status, attempts, next_retry_at, lease_expires_at, animation_choices, validation_report, output_asset_id | Durable leasing/retries; idempotency bound to request hash; no output without actual artifact/validation; log versions and per-slide choices |
| `generated_assets` | id, owner_id, project_id, job_id, private_storage_key, filename, mime_type, byte_size, sha256, quarantined_at | Hash/size measured from actual bytes; private storage; downloadable only after job validation and authorization |
| `audit_logs` | id, actor_id, action, target_id, old_value, new_value, request_id, created_at | Append-only under restricted roles; capture admin rate/effect changes and sensitive production actions |

Do not rely on arbitrary custom Postgres settings to establish a browser user's identity. Bind policies to the real auth mechanism and test unprivileged roles. Ensure cross-record ownership and project/spec/payment/entitlement consistency in transactional commands and database constraints where practical.

## API surface

| Endpoint | Input | Authorization and result |
|---|---|---|
| `POST /projects` | Approved intake schema, requested tier, client idempotency key | Verified actor, quota/rate limit; create draft. Input contract remains provisional |
| `POST /projects/:id/preview` | revision/version, idempotency key | Owner; atomic quota consumption; durable preview job; 202 |
| `POST /projects/:id/approve` | design_spec_id, expected_version | Owner; preview belongs to project; lock approval version |
| `POST /projects/:id/motion` | motion_tier, transition_id/null, intensity/null, expected_version | Owner + approved design; fail closed for disabled effects; update requested tier/spec atomically |
| `POST /projects/:id/quote` | design_spec_id, expected_version | Owner; approved/configured spec; server-verified slide count; create immutable quote + design lock |
| `POST /checkout/session` | quote_id, idempotency_key | Owner; active/unexpired/unpaid quote; create actual provider session using stored snapshot; bind idempotency to request digest |
| `POST /webhooks/:provider` | Raw provider event + official validation fields | Provider-specific signature/transaction validation; compare provider/session/order/amount/currency; atomically dedupe and grant entitlement; no browser success trust |
| `POST /projects/:id/produce` | entitlement_id, design_spec_id, idempotency_key | Owner; verified matching payment/spec/tier; approved registry versions; durable job, 202 |
| `GET /projects/:id/status` | path only | Owner or explicit admin grant; safe progress + actionable errors |
| `GET /projects/:id/download` | optional asset_id | Owner; actual validated non-quarantined asset; short-lived private URL or authorized byte stream |
| `PUT /admin/pricing` | expected_version, integer rates, bounded TTL, reason | Verified admin; append pricing version + audit transaction; old quote snapshots untouched |
| `PUT /admin/motion-library/:id` | expected_version, requested_enabled, evidence IDs, reason | Verified admin; cannot enable without compatibility evidence and sample clip; audit |

For idempotent requests: replay identical requests returns original outcome; changed request with same key returns 409. Use scoped unique keys and transactions. Payment state transitions must handle duplicate and out-of-order events without reverting verified/settled payments based solely on a later failed notification.

## Quote example

Eight-slide Smooth quote at initial rates: base `8 × 2500 = 20000` paisa; motion `8 × 1100 = 8800` paisa; total `28800` paisa = BDT 288. Store rate version, slide count, tier, design-spec UUID, policy/template versions, line items, creation/expiry times and tax treatment state. A later admin rate change must not alter this quote. Intensity is not a price multiplier.

## Errors and state boundaries

Return structured `{ok:false,error:{code,message,request_id,details?}}` without stack traces/secrets. Use 400 invalid input, 401 unauthenticated/provider signature failure, 403 forbidden, 404 missing or concealed cross-owner target, 409 stale version/invalid state/expired quote/unmet release gate, 429 limits, 503 temporary dependency failure. Failed package validation quarantines the asset and blocks download. Retries must not charge again or silently substitute a different effect or tier.

## Release contract

Automated package checks establish only measured structural/policy properties. They do not assert PowerPoint playback, complete ECMA-376 schema conformance, or production entitlement. Each enabled effect must reference genuine Windows/Mac/older-version QA evidence agreed for launch. Missing versions or recordings remain explicitly UNVERIFIED. Browser mock checkout/progress/quote/admin controls must carry simulation labels; research specimens are separate from paid customer deliveries.
