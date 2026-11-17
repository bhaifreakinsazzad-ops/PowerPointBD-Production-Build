# AI Presentation Platform — Production Foundation API Specification, Environment Guide & External Dependencies Report

**Date:** 26 October 2026  
**Milestone:** Phase 2 — Server-Authoritative Production Foundation  
**Deliverables Covered:** Database Migrations (`0001_production_foundation_schema_and_seed.sql`), Backend Implementation & Validation Schemas (`production_foundation_backend.ts`), Automated Tests, Environment Variables, Updated API Specification, and External Dependencies Report.

---

## 1. Source-of-Truth Data Field Traceability

Every database entity and TypeScript contract in this milestone preserves the mandatory fields specified in the client addendum:

| Source Requirement | Database Column & Constraint (`0001_...sql`) | TypeScript Contract (`production_foundation_backend.ts`) | Security & Immutability Control |
| :--- | :--- | :--- | :--- |
| **`projects.motion_tier_requested`** | `projects.motion_tier_requested VARCHAR(16) NOT NULL DEFAULT 'smooth'` | `ProjectRecord.motion_tier_requested` | Validated against `'static' \| 'smooth'`; defaults to `'smooth'`. |
| **`design_specs.spec_json`** | `design_specs.spec_json JSONB NOT NULL` with `chk_spec_json_required_keys` and `chk_spec_json_tier_consistency` | `DesignSpecRecord.spec_json` (`motion_tier`, `intensity`, `transition_id`, `animation_policy`) | Trigger `trg_prevent_locked_design_spec_mutation` blocks edits once `is_locked = TRUE`. |
| **`payments.tier`, `quote_amount`, `quote_breakdown`** | `payments.tier`, `payments.quote_amount` (BDT), `payments.quote_amount_paisa` ($\text{BDT} \times 100$), `payments.quote_breakdown` (JSONB) | `PaymentRecord.tier`, `quote_amount`, `quote_breakdown` | Populated strictly from the immutable `quotes` snapshot; client prices are rejected. |
| **`entitlements.motion_tier`** | `entitlements.motion_tier VARCHAR(16) NOT NULL` | `EntitlementRecord.motion_tier` | Granted exclusively by verified server webhook (`POST /webhooks/:provider`). |
| **`jobs.animation_choices`** | `jobs.animation_choices JSONB NOT NULL` | `JobRecord.animation_choices` (`JobAnimationChoicesAudit`) | Records generator/template/policy versions, deck transition, and per-slide role entrances. |

---

## 2. Environment-Variable Documentation (`.env.example`)

Copy the following template into `.env.local` (for local development) or configure it in your production secret manager. **Never prefix server secrets with `NEXT_PUBLIC_`.**

```ini
# ============================================================================
# AI Presentation Platform — Environment Configuration (.env.example)
# ============================================================================

# 1. Application & PWA Origin
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="https://YOUR-DOMAIN.com"

# 2. PostgreSQL / Supabase Database & Auth
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-public-anon-key-for-rls-client"
SUPABASE_SERVICE_ROLE_KEY="SERVER_ONLY_SERVICE_ROLE_SECRET_DO_NOT_EXPOSE"
DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_presentation_platform"

# 3. Private Object Storage & Expiring Signed Download URLs
PRIVATE_STORAGE_BUCKET="private-presentations"
DOWNLOAD_URL_SIGNING_SECRET="replace_with_32_byte_hex_hmac_secret"
DOWNLOAD_URL_TTL_SECONDS="900" # 15 minutes (900 seconds)

# 4. Payment Gateway Configuration (Sandbox vs. Production — Blocker B-05)
PAYMENT_PROVIDER_MODE="sandbox" # 'sandbox' | 'live'
SSLCOMMERZ_STORE_ID="UNCONFIGURED_SANDBOX_STORE_ID"
SSLCOMMERZ_STORE_PASSWORD="UNCONFIGURED_SANDBOX_STORE_PASS"
SSLCOMMERZ_WEBHOOK_HMAC_SECRET="replace_with_provider_ipn_hmac_secret"
SSLCOMMERZ_VALIDATION_API_URL="https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php"

# 5. Durable Worker & Phase 0 Open XML Engine
PYTHON_BIN_PATH="python3"
PHASE0_ENGINE_SCRIPT_PATH="./phase0_pptx_spike.py"
JOB_MAX_ATTEMPTS="3"
JOB_BASE_BACKOFF_SECONDS="15"
```

---

## 3. Updated REST API Specification

All user-facing endpoints require an authenticated session (`Authorization: Bearer <jwt>`) and enforce `project.owner_id === user.id`. Any request payload containing client-submitted price fields (`price`, `amount`, `quote_amount`, `total`, `paid`, `entitled`) is immediately rejected with `400 Bad Request (SECURITY_VIOLATION)`.

### 3.1 `POST /projects/:id/motion`
Saves the deck-wide transition and intensity level before locking the design specification.
- **Auth & Checks:** Authenticated project owner; project state must be `design_approved`, `motion_configured`, or `quoted`; `transition_id` must be enabled in `motion_library`. Rejects non-null `transition_id` or `intensity` when `motion_tier === "static"`.
- **Request Body (`Smooth` example):**
  ```json
  {
    "motion_tier": "smooth",
    "transition_id": "fade",
    "intensity": "standard"
  }
  ```
- **Response (`200 OK`):** Returns updated `project` (`state: "motion_configured"`) and `design_spec` (`spec_json`).

### 3.2 `POST /projects/:id/quote`
Calculates the server-authoritative BDT quote from the project's verified `slide_count` and active `price_configs`, locks `design_specs`, and persists an immutable quote snapshot.
- **Pricing Formula:**
  - $\text{Static Total} = N \times B$ (initial $B = \text{BDT } 25$)
  - $\text{Smooth Total} = N \times (B + S)$ (initial $B = \text{BDT } 25, S = \text{BDT } 11 \implies \text{BDT } 36/\text{slide}$)
  - $\text{Minor Units (Paisa)} = \text{Total BDT} \times 100$
- **Request Body:**
  ```json
  {
    "design_spec_id": "20000000-0000-4000-8000-000000000001"
  }
  ```
- **Response (`201 Created`):**
  ```json
  {
    "ok": true,
    "data": {
      "quote": {
        "id": "qt_8f91a2c3d4e5",
        "project_id": "10000000-0000-4000-8000-000000000001",
        "design_spec_id": "20000000-0000-4000-8000-000000000001",
        "pricing_config_version": 1,
        "tier": "smooth",
        "slide_count": 10,
        "base_rate_bdt": 25,
        "motion_rate_bdt": 11,
        "quote_amount": 360,
        "quote_amount_paisa": 36000,
        "quote_breakdown": {
          "currency": "BDT",
          "pricing_config_version": 1,
          "slide_count": 10,
          "tier": "smooth",
          "base_rate_per_slide_bdt": 25,
          "motion_rate_per_slide_bdt": 11,
          "base_subtotal_bdt": 250,
          "motion_subtotal_bdt": 110,
          "tax_amount_bdt": 0,
          "total_amount_bdt": 360,
          "total_amount_paisa": 36000,
          "formula_applied": "10 slides * (BDT 25 + BDT 11) = BDT 360",
          "compatibility_statement": "Motion is built for desktop Microsoft PowerPoint."
        },
        "status": "active",
        "expires_at": "2026-10-27T06:00:00.000Z"
      }
    }
  }
  ```

### 3.3 `POST /checkout/session`
Creates a payment gateway session using the stored immutable `quote_amount`.
- **Auth & Checks:** Authenticated owner; verifies `quote.status === "active"` and `NOW() < quote.expires_at`. Returns `409 QUOTE_EXPIRED` if expired. Supports idempotent retries via `idempotency_key`.
- **Request Body:**
  ```json
  {
    "quote_id": "qt_8f91a2c3d4e5",
    "provider": "sslcommerz_sandbox",
    "idempotency_key": "checkout_proj1_qt8f91"
  }
  ```

### 3.4 `POST /webhooks/:provider`
Handles signed server-to-server payment notifications (`X-Webhook-Signature` HMAC-SHA256).
- **Security & Idempotency:** Verifies HMAC-SHA256 using `crypto.timingSafeEqual`, checks `payment_webhook_events` for duplicate `event_id`, verifies `amount_bdt === payment.quote_amount`, marks `payments.status = "verified"`, and inserts `entitlements.motion_tier`.

### 3.5 `POST /projects/:id/produce` & `GET /projects/:id/status`
Enqueues an idempotent background production job and retrieves meaningful stage progress.
- **Security Checks:** Verifies `entitlements.motion_tier === locked_design_spec.spec_json.motion_tier`. Enqueues a durable `jobs` row with `max_attempts = 3`, exponential backoff (`next_retry_at`), and full `jobs.animation_choices` logging.

### 3.6 `GET /projects/:id/download`
Issues a 15-minute expiring signed URL (`token`) for private presentation delivery.
- **Validation Gate (`FR-20`):** Blocks delivery (`409 DELIVERY_BLOCKED_OR_INCOMPLETE`) if `jobs.status === "quarantined"` or `generated_assets.is_quarantined === true`.

### 3.7 `PUT /admin/pricing`
Updates server-side base and Smooth motion rates for future quotes only.
- **Auth & Audit:** Requires `user.role === "admin"`. Appends a new version to `price_configs`, enforces the Cinematic release gate (`FR-24`), and writes old/new values to the append-only `audit_logs` table. Existing rows in `quotes` and `payments` are never modified.

---

## 4. Running Migrations & Automated Tests

1. **Apply Database Migrations & Seed Data:**
   ```bash
   psql "$DATABASE_URL" -f 0001_production_foundation_schema_and_seed.sql
   ```
2. **Execute the Automated Backend Security, Immutability & Contract Test Suite:**
   ```bash
   npx tsx production_foundation_backend.ts
   ```
   This executes 12 automated assertions verifying ownership isolation, Static/Smooth quote math, client price-tampering rejection, quote immutability across admin price edits, quote expiry blocking, webhook HMAC verification, webhook idempotency, XML quarantine delivery blocking, and 15-minute expiring signed download tokens.

---

## 5. Report of Remaining External Dependencies

In accordance with our strict engineering honesty rule, no live credentials have been invented and no external payment gateway is claimed to be live. The following external dependencies remain before production launch:

| Dependency ID | Area | Current Implementation State | Action Required from Project Owner |
| :--- | :--- | :--- | :--- |
| **DEP-01** | **Bangladesh Payment Gateway Credentials** | Implemented signed HMAC webhook handler, session creator, and idempotency log in sandbox mode (`sslcommerz_sandbox` / `bkash_sandbox`). | Obtain live merchant credentials (`SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, IPN secret) or direct bKash/Nagad merchant keys. |
| **DEP-02** | **NBR VAT / BIN Tax Invoice Rules** | `tax_amount_bdt` defaults to `0` in `quote_breakdown` (no unverified tax rate is hardcoded). | Confirm VAT registration (BIN), applicable tax percentage, and invoice field requirements with a qualified Bangladesh accountant. |
| **DEP-03** | **External Desktop PowerPoint Playback & 3s Clips** | Automated OPC/XML validator (`phase0_pptx_spike.py`) passes `6/6` decks; `motion_library.desktop_qa_status` is marked `UNVERIFIED_EXTERNAL_DESKTOP_REQUIRED`. | Open generated `.pptx` decks on physical Windows 11, macOS Sonoma, and Office 2016/2019 machines and record real 3-second `.mp4`/`.webm` sample clips. |
| **DEP-04** | **Original Project Plan (Section 15)** | `projects.raw_input_payload` supports `prompt`, `outline`, and `paste` modes and 3 initial design families. | Provide the original project plan Section 15 to finalize intake form fields, AI image generation provider keys, and launch design families. |
| **DEP-05** | **Commercial Policy Confirmations** | Configured safe defaults: `quote_ttl_hours = 24`, `free_motion_swaps_remaining = 1`, upgrades charge differential ($N \times S$). | Confirm final quote TTL ($24\text{h}$ vs $48\text{h}$), minimum slide/order threshold, and whether post-payment downgrades (`smooth` $\rightarrow$ `static`) are non-refundable. |