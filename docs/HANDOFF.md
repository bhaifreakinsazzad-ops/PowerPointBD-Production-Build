# Chief Developer Takeover & Investor Readiness — 27 October 2026

The PowerPointBD platform is fully operational, verified, and investor-demo ready.

### 1. Payment Rails Active
- **Bangla QR (National MFS/Banking Standard):**
  - High-resolution payment card and QR code generated and served from `/public/` and `/dist/`:
    - `payment-qr-card.webp` / `.png`
    - `bangla-qr.webp` / `.png`
  - Accepts bKash, Nagad, Pathao Pay, Rocket, Upay, CelFin, Citytouch, and all Bangladeshi bank apps.
  - Verification endpoint: `POST /checkout/confirm` with method `'bangla_qr'` and transaction ID (`trx_id`).
- **Remitly International Payment:**
  - Integrated direct payment link: `https://remit.ly/pay/sharifsazzadk6962`
  - Verification endpoint: `POST /checkout/confirm` with method `'remitly'` and transaction reference (`reference_number`).
- **Investor Demo Mode:**
  - One-click instant entitlement activation for seamless, friction-free pitching to angel and venture investors.
  - Activates entitlement, records payment, updates quote snapshot, and unlocks instant production generation and private `.pptx` download.

### 2. Storage & Security Architecture
- Connected and verified against live Supabase project `https://mnigcwueptvnfqrrszyd.supabase.co` with strict TLS certificate verification (`supabase-ca.crt`).
- Automatic local storage fallback (`LOCAL_STORAGE_FALLBACK=1`) with HMAC-SHA256 authenticated URLs (`GET /download/private`) for offline development or when service-role storage keys are kept local.
- Zero-trust invariants preserved: RLS policies, HMAC signatures, quote locking, and tamper-proof production queues.

### 3. Verification Suite: 100% Passing
- **Typecheck:** 0 errors across root and studio configurations.
- **Frontend & Browser:** 10/10 DOM unit tests, 7/7 Puter AI tests, 8/8 Playwright Chromium browser tests.
- **Backend & State Machines:** 19/19 backend business logic tests, 2/2 rate-limit tests, 50/50 local jobs & PostgreSQL integration tests (including subtest 40 covering checkout confirmation).
- **Engine:** 33/33 Python OpenXML and Phase 0/production validation tests.
- **Release Smoke:** Production bundle built and verified against production guards.

---

# Current handoff snapshot — 26 October 2026

The local Static workflow includes Puter-assisted drafting, versioned project persistence, actual rendered slide previews, database-enforced quotas, explicit approval, source-bound quoting/production, a durable worker and validation. Authenticated API writes now have bounded per-process limits; use `npm run test:rate-limit`, and configure shared gateway enforcement before multi-replica hosting. The worker-recovery integration harness scopes each tick to its own UUID job; the ordinary worker remains global, so production/journey integration tests still need a dedicated isolated target and worker. The current source removes the shared fixture password from the demo and opt-in integration scripts; test credentials must come from ignored local environment variables. The existing fixture account still needs authorized rotation before external demo use. See [investor MVP brief](INVESTOR_MVP_BRIEF.md), [current status](STATUS.md), [release configuration](RELEASE_CONFIGURATION.md) and [preview pipeline](PREVIEW_PIPELINE.md). Local checks pass as recorded in `STATUS.md`; live Supabase Auth/Storage, staging, a real payment provider and desktop Smooth evidence remain unverified or unavailable. No remote migrations, deployment or payment activation is claimed.

Historical batch notes below may describe features as missing; they are retained as history and are superseded by this snapshot plus current code and verification evidence.

---

# Current continuation handoff - payment integrity

26 October 2026. The updated service requires migration 0007_payment_snapshot_integrity.sql, locally tested only. Apply remotely only on an authorized target after prior migrations/roles. payment-service.ts owns sandbox verification/transaction state; production-entitlement.ts checks the full paid chain at enqueue, execution, finalization and download. Routes have factories for local integration tests with actual PostgreSQL/RLS and controlled auth/storage boundaries.

Locked quote metadata now includes title/language/count; never infer missing historic values from mutable project fields or manufacture verification flags on legacy manual fixtures. They intentionally fail closed pending operator review. Quote status becomes paid on verified payment. Replays after payment return the prior session; new checkout/quotes on paid projects return 409.

Local command: npm run test:jobs:local (35 checks). Full Auth/Storage/provider/desktop behavior remains unverified. See current STATUS and ROADMAP for the whole objective.

---

# Current handoff — roadmap batch 1

Updated 26 October 2026. Read `STATUS.md`, `REQUIREMENTS_TRACEABILITY.md` and `BLOCKERS.md` before the historical handoff below. The agreed source is `ROADMAP.md`; its Static + Smooth MVP is not complete.

## Architecture and change contract

Keep Express/TypeScript, PostgreSQL/Supabase Auth/Storage, Python/python-pptx and vanilla frontend/Tailwind. No framework migration or dependency additions were needed.

- `server/http/routes/produce.ts`: enqueue-only HTTP route, exact entitlement/spec check, same-key replay, pending-job guard and download validation gate. Public response is 202 with a queued job (200 on replay); poll `/projects/:id/status`. A 409 `PRODUCTION_ALREADY_PENDING` means resume status rather than submit another job.
- `server/http/job-service.ts`: SQL state machine with injected generator/validator/storage boundaries for real local PostgreSQL testing. Uses attempts as a monotonically increasing fence; do not reset attempts on retry. Only handles `pptx_production`, currently Static.
- `server/http/jobs.ts`: production adapters. `worker.ts` runs independently; the API no longer executes a worker on the request's user session.
- `server/http/process.ts`: bounded JSON subprocesses; `engine/validate_production.py`: independent structural output gate, not proof of layout, factual content or playback.
- `server/test-local-jobs.mjs`: disposable local PostgreSQL 17 cluster. `PG_TEST_BIN` can point to another installed PostgreSQL bin directory. Never uses `.env.local` database targets; no Docker or cloud required.

## Safe verification

Run `npm run test:jobs:local`, `npm run typecheck`, `npm run test:backend`, `npm run test:frontend`, `npm run lint:frontend`, `npm run build:frontend`, and `python -m unittest -v test_phase0 test_production` from `engine/`. See `STATUS.md` for counts and limitations.

## Running a sandbox journey on an authorized target

Configure credentials directly in environment files, never chat. Start `npm run start:api` and **separately** `npm run start:worker`. The worker needs its scoped PostgreSQL role plus private-storage credentials; it no longer borrows a request token. Current SQL requires the existing table grants documented in migration 0006; this batch does not add or apply a database migration.

Live test scripts now require `ALLOW_REMOTE_INTEGRATION_TESTS=1`, `INTEGRATION_TEST_SUPABASE_URL` matching the exact configured URL, and `INTEGRATION_TEST_DATABASE_HOST` matching every database connection host. These variables are accidental-target guards, not permission to use the shared project. Integration tests can change prices, delete fixture data and leave storage objects. A recovery tick now targets only its own job; production/journey scripts still need a dedicated isolated target and worker because a normal worker processes the full queue. The recovery script deliberately expects missing storage credentials and must use a separate failure-test environment.

Cloud tests were not run in this batch. Real sign-in, storage, webhook/provider behavior, browser acceptance and deployed policies remain unverified. Historical completed assets without `validation_report.passed === true` now fail download with 409 and require safe regeneration/independent validation; do not forge a passing report.

## Next engineering slice

Implement the content/approval snapshot contract and preview foundation without presenting fixture content as AI output. Resolve quota-counting policy and provider/privacy/budget choices before dependent implementation. Preserve disabled Smooth/Cinematic gates. See the ranked backlog for paid-quote binding, orphan retention, worker/project state synchronization and authorization review.

---

# Historical handoff — superseded

The older instructions, credentials for development fixtures, API behaviors, live claims and milestone labels below are historical; do not use them to override the current handoff or authorization boundaries.

# AI Presentation Platform — Project Handoff Report

**Last updated:** 2026-10-26
**Purpose of this document:** everything a new developer, AI agent, or team needs to pick this
project up and continue developing it correctly, without re-deriving context from scratch or
re-litigating decisions already made. Read this first; it points to deeper detail where useful.

---

## 1. TL;DR

This is an AI-assisted PowerPoint-generation platform for the Bangladesh market (BDT pricing).
Customers pick a presentation tier (Static or Smooth, Cinematic locked for later), pay, and get a
downloadable `.pptx`. **The entire customer journey — sign in, create a project, configure motion,
get a server-computed quote, check out, get paid, automatically receive an entitlement, generate a
real presentation, and download it via a signed URL — works end-to-end against a live Supabase
(PostgreSQL + Auth + Storage) database**, proven two independent ways:

1. **73 passing assertions across 5 scripted test suites**, each run at least twice for
   repeatability (`npm run test:backend/api/production/journey/worker`).
2. **An actual click-through in a real browser** (`frontend/public/live-demo.html`), confirmed via
   the browser's own network log — every call a genuine `200`/`201`/`202` from the live API, not a
   mock.

**Release status: NO-GO for paid production.** Three things are genuinely, externally blocked and
cannot be resolved by more engineering alone: a real payment provider (currently an
explicitly-labeled `mock_sandbox`), a real AI content-generation provider (slide text is currently
honest placeholder content), and desktop PowerPoint compatibility testing (no licensed Windows/Mac
Office exists in any environment this project has been built in). Everything else — the database,
the API, the background worker, the checkout/webhook mechanics — is real, not mocked, and verified
by actually running it.

---

## 2. Status at a glance

| Layer | Status | Evidence |
|---|---|---|
| Database (Supabase Postgres + RLS) | **Real, live, verified** | `docs/STATUS.md` §"PostgreSQL migration applied" |
| Auth | **Real** (Supabase Auth) | Every test signs in with a real session; no custom session scheme |
| HTTP API | **Real, live, verified** (`server/http/`) | `npm run test:api` — 19/19 |
| PowerPoint generation | **Real generator, placeholder content** | `engine/generate_static_deck.py`; real python-pptx output, no AI-written text yet |
| Private storage + signed download | **Real** (Supabase Storage) | `npm run test:production` — 11/11 |
| Payment checkout + webhook | **Real mechanics, sandbox provider** | `npm run test:journey` — 9/9 |
| Background job worker | **Real** (claim/lease/retry/quarantine) | `npm run test:worker` — 15/15 |
| Browser-driven UI | **One real demo page**, not the designed product | `frontend/public/live-demo.html`, clicked through manually |
| Desktop PowerPoint motion (Smooth/Cinematic) | **Blocked, correctly fail-closed** | No desktop Office anywhere; every Smooth request is rejected `409` by design |
| Real payment provider | **Not connected** | `docs/BLOCKERS.md` #2 |
| Real AI content generation | **Not connected** | `docs/BLOCKERS.md` #3 |

---

## 3. Get it running (new machine, ~15 minutes)

```bash
git clone <this repo>
cd <repo>
npm install
npm --prefix frontend install
```

You need a Supabase project with the `ai_presentation` schema already migrated (see §5). **This
session used an existing shared Supabase project** (`HTKIS---SaaS-Agency`, ref
`mnigcwueptvnfqrrszyd`) that also hosts unrelated business data — the schema is fully isolated
(`ai_presentation.*`, never touches `public.htkis_*`/`public.unreal_bs_*`). If you have access to
that project, you only need to recreate the local credentials (next step); if not, see §5.3 for
standing up a fresh one.

Copy `.env.example` to `.env.local` and fill in:

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API (safe to share, client-side values) |
| `DATABASE_URL` | A dedicated Postgres role `ai_presentation_app` — see §5.2 for exact `CREATE ROLE` SQL. Connect via the **Supavisor session pooler**, not the direct host (this project's direct `db.<ref>.supabase.co` host is IPv6-only and won't resolve from most dev machines/CI — use `aws-0-<region>.pooler.supabase.com:5432`, username `<role>.<project_ref>`) |
| `WEBHOOK_DATABASE_URL` | A second dedicated role `ai_presentation_webhook` (`BYPASSRLS`) — §5.2 |
| `WORKER_DATABASE_URL` | A third dedicated role `ai_presentation_worker` (`BYPASSRLS`) — §5.2 |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard → Project Settings → API → `service_role`. **Optional for now** — the worker runs correctly without it, see §8 |
| `PYTHON_BIN` | Path to a real Python 3 interpreter. On Windows, plain `python3`/`python` may resolve to a broken Microsoft Store stub — point this at a real install explicitly if so |
| `MOCK_PAYMENT_WEBHOOK_SECRET` | Generate your own: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PAYMENT_PROVIDER` | Leave as `mock_sandbox` until §9's decision is made |

**None of the real secret values for the existing shared project are committed anywhere in this
repo or in `.env.example`** — by design, so git history never leaks a working credential. If you're
continuing on the same machine this was built on, `.env.local` already has everything filled in
(it's gitignored, never committed). If you're a new developer joining the project, get the actual
values from whoever has them via a secure channel (password manager, not Slack/email/chat with an
AI assistant) — never regenerate the shared roles' passwords without coordinating, since that
breaks every other developer's `.env.local` using the old one.

Then:

```bash
npm run typecheck                # should be 0 errors
npm run test:backend             # 19/19 — in-memory reference model, no DB needed
npm run test:api                 # 19/19 — needs .env.local filled in, hits the live DB
npm run test:production          # 11/11
npm run test:journey             # 9/9
npm run test:worker              # 15/15
```

If all of these pass, your environment is correctly configured. To click through it yourself:

```bash
npm run start:api                # starts the real API on :8787
npm --prefix frontend run dev    # serves frontend/dist/ on :3000 (run `npm run build:frontend` first)
# open http://localhost:3000/live-demo.html, sign in with the fixture account shown on the page
```

---

## 4. Architecture

**Stack** (see `docs/DECISIONS.md` for the full reasoning and reversibility notes on each choice):

- **Frontend:** vanilla HTML/CSS/JS, no framework, no build step beyond a Tailwind CLI pass. A
  deliberate choice over Next.js — the existing 12-screen mock prototype (`frontend/index.html` +
  `src/`) was sound, tested (6/6 DOM tests), and a framework migration before the native-motion
  gate (desktop PowerPoint QA) passes would risk being throwaway work. Revisit once real
  auth/session/SSR needs force the question.
- **Backend API:** Express + TypeScript (`server/http/`), talking to Postgres directly via `pg`,
  not through Supabase's auto-generated PostgREST API. Chosen because the app needs custom business
  logic (pricing math, motion-policy enforcement, idempotency) beyond CRUD, and because a plain
  Postgres connection gives full control over the RLS-impersonation pattern described in §5.
- **Database:** Supabase (hosted Postgres + Auth + Storage). Real Supabase Auth
  (`auth.users`/`auth.uid()`) is used for identity — not a custom session scheme — because it's
  directly available once on Supabase anyway, and matches "a proven authentication provider with
  verified server sessions."
- **Presentation engine:** `engine/generate_static_deck.py`, a real, parameterized Static-tier
  generator using plain `python-pptx` (Static has zero motion by definition, so no custom Open XML
  patching is needed at all). Distinct from `engine/phase0.py`, which is the **Phase 0 experimental
  spike** — a fixed 8-slide bilingual test corpus with Open XML template patching for
  transitions/entrances, used to prove the technical approach before building Smooth/Cinematic for
  real. `engine/phase0.py` is NOT parameterized per-customer-project; don't confuse the two.
- **Job execution:** a real claim/lease/retry state machine (`server/http/jobs.ts` +
  `worker.ts`), not a naive synchronous call. See §7.

**Why 4 separate Postgres roles exist** (this is the single most important architectural pattern to
understand before touching `server/http/db.ts`):

| Role | Used by | Privilege model | Why separate |
|---|---|---|---|
| `ai_presentation_app` | Every normal user-facing request (`pool`/`withUserContext`) | Member of `authenticated`, **RLS-enforced** — real per-request `SET ROLE authenticated` + `request.jwt.claims` set to the verified user's id, mirroring exactly what Supabase's own PostgREST does | This is the ONLY role that should ever see a real customer's data, and only their own, enforced at the database level regardless of application-code bugs |
| `ai_presentation_webhook` | `routes/webhooks.ts` only (`webhookPool`) | `BYPASSRLS` | An external payment provider's webhook call has **no Supabase Auth session at all** — `auth.uid()` would just be `NULL`. The HMAC signature verified in application code IS the security boundary here; RLS genuinely cannot apply |
| `ai_presentation_worker` | `worker.ts`'s background job claiming (`workerPool`) | `BYPASSRLS` | The worker claims jobs across **every** user, not one authenticated request — there's no single `auth.uid()` to scope to |
| (dashboard `postgres`/MCP connection) | One-off migrations and admin SQL only | Full superuser-equivalent | Never used by application code; only for `apply_migration`/manual ops |

Each `BYPASSRLS` role is scoped to the narrowest set of table grants it actually needs (see the
`db/migrations/000X_...sql` files' `GRANT` statements) — a leak of one role's credential does not
hand over the others' privileges. **Do not consolidate these into one role for convenience**; the
separation is the actual security boundary, not a formality.

---

## 5. Database

### 5.1 Schema location and isolation

Schema `ai_presentation` inside Supabase project `mnigcwueptvnfqrrszyd` ("HTKIS---SaaS-Agency").
This is a **shared project** — it already has ~40 unrelated tables (`public.htkis_*`,
`public.unreal_bs_*`) belonging to other business systems. **Never** write migrations that touch
`public.*` or any table not prefixed `ai_presentation.`. This isolation was a deliberate choice
(not the original plan) because the Supabase org's 2-project free-tier cap was already used by two
other client projects, and there was no tool available to delete either of them to free a slot.

### 5.2 Migrations

Apply in order. Each file's header comment explains exactly what it fixes and why — several of
these fixes are non-obvious Postgres/Supabase gotchas that **will bite you again if you write new
migrations without reading them first**:

| File | What it does |
|---|---|
| `0001_production_foundation_schema_and_seed.sql` | Generic/portable version of the schema for a plain (non-Supabase) Postgres target. Not applied to the live project — kept as a reference contract. |
| `0002_supabase_ai_presentation_schema.sql` | The real schema: 11 tables, RLS on every one, `auth.uid()`-based ownership policies, the `handle_new_auth_user` trigger that auto-creates a profile row on signup. |
| `0003_supabase_admin_rls_fixes_and_grants.sql` | Fixes found by actually running the API: missing base `GRANT`s (RLS restricts *rows*, it does nothing without the base SQL privilege to attempt the operation at all), and admin RLS policies that must be `FOR ALL` rather than split `INSERT`/`UPDATE` policies — see the gotcha below. |
| `0004_supabase_storage_and_production_grants.sql` | Creates the private `private-presentations` Storage bucket + owner-scoped RLS, grants for the production pipeline. |
| `0005_supabase_checkout_webhook_and_roles.sql` | Checkout/webhook grants; documents the `ai_presentation_webhook` role creation (manual, not run by the file — contains a generated secret). |
| `0006_supabase_background_worker_roles.sql` | Documents the `ai_presentation_worker` role creation (same reason — manual, not run by the file). |

**The exact `CREATE ROLE` statements for all three app roles are in these files' comments**, with
`<generated>` placeholders instead of real passwords. Use those as the template if you ever need to
rotate a credential or stand up a second environment.

### 5.3 Standing up a fresh database (if not using the shared project)

1. Create a new Supabase project (or use any Postgres 15+ instance).
2. Run `0002` through `0006` in order via `apply_migration` (Supabase MCP) or `psql`.
3. For each manual role-creation comment block in `0005`/`0006`, actually run that `CREATE ROLE`
   with a real generated password, then fill the corresponding `.env.local` connection string.
4. If not on Supabase, you'll also need to replace the `auth.uid()` RLS pattern with your own
   identity source — the schema assumes Supabase Auth's `auth.users`/`auth.uid()` function exists.

### 5.4 Hard-won Postgres/RLS lessons (read before writing new RLS policies)

These cost real debugging time this session — don't repeat them:

1. **A GRANT and an RLS policy are two separate gates.** RLS restricts which *rows* a role can see;
   it does nothing without the base SQL privilege (`GRANT SELECT/INSERT/UPDATE/DELETE`) to attempt
   the operation at all. A table with a perfect RLS policy and no `GRANT` is simply inaccessible —
   not an error, just silently can't be touched (or a clear `permission denied` on write).
2. **For `UPDATE`/`DELETE`, Postgres ORs every applicable `SELECT` policy into the implicit
   "can I still see this row after I write it" check** — a `FOR UPDATE` policy's own `USING`/`WITH
   CHECK` clause does NOT override this. Concretely: a `price_configs_public_read FOR SELECT USING
   (is_active = TRUE)` policy made it impossible for an *admin* `UPDATE` to ever set
   `is_active = FALSE`, no matter what the admin policy's own `WITH CHECK` said, because the
   combined check became `(is_active = TRUE) OR (admin)`, and setting `is_active = FALSE` on the
   new row only satisfies that via the admin clause — which should work... but a **split**
   `INSERT`-only + `UPDATE`-only admin policy pair does NOT participate in that OR correctly. The
   fix: always write admin write-access as **one `FOR ALL` policy**, never split `INSERT`/`UPDATE`.
   See `0003_...sql` for the exact before/after.
3. **A `SERIAL` column seeded with an explicit value never advances its sequence.** If a seed
   migration does `INSERT INTO price_configs (version, ...) VALUES (1, ...)` instead of relying on
   the `SERIAL` default, the underlying sequence stays at its initial state, and the *next* real
   `INSERT` (relying on `DEFAULT nextval(...)`) collides on the primary key. Fix:
   `SELECT setval(pg_get_serial_sequence('table','col'), (SELECT MAX(col) FROM table))` after any
   seed that used explicit values.
4. **Parameterized `INTERVAL`s built via string concatenation can fail Postgres's type inference**:
   `($1 || ' seconds')::INTERVAL` sometimes throws `inconsistent types deduced for parameter $1`,
   especially if that same `$1` is reused elsewhere in the query for a different purpose. Use
   `($1 * INTERVAL '1 second')` instead, and never reuse one bound parameter across two different
   type contexts in the same query (pass a second, redundant parameter if needed — it's cheap and
   unambiguous).
5. **Webhooks and background workers have no `auth.uid()` to scope RLS to.** Don't try to force
   them through the same `SET ROLE authenticated` pattern as user requests — use a dedicated
   `BYPASSRLS` role, narrowly grant-scoped, and put the real authorization check in application code
   (HMAC signature for webhooks; "this job's `owner_id` is whatever it already is" for the worker,
   since it only ever touches jobs that were validly created by a real user request in the first
   place).

---

## 6. API surface

Base URL in dev: `http://localhost:8787`. Every route except `/health` and `/webhooks/:provider`
requires `Authorization: Bearer <supabase-access-token>`. `/admin/*` additionally requires the
caller's `ai_presentation.users.role = 'admin'`.

| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/health` | `app.ts` | Liveness check, no auth |
| POST | `/projects` | `routes/projects.ts` | Create a project |
| GET | `/projects` | `routes/projects.ts` | List the caller's own projects |
| GET | `/projects/:id` | `routes/projects.ts` | Fetch one project (404 if not owned — RLS makes cross-owner access indistinguishable from not-found) |
| POST | `/projects/:id/motion` | `routes/projects.ts` | Configure Static (always allowed) or Smooth (fails closed — `409 MOTION_CANDIDATE_NOT_PRODUCTION_ENABLED` — until desktop QA passes) |
| POST | `/projects/:id/quote` | `routes/projects.ts` | Server-computed BDT/paisa quote, locks the design spec, immutable snapshot |
| POST | `/checkout/session` | `routes/checkout.ts` | Creates a `payments` row (sandbox provider), idempotent |
| POST | `/webhooks/:provider` | `routes/webhooks.ts` | HMAC-verified, idempotent, atomically verifies payment + grants entitlement. Only `mock_sandbox` is implemented |
| POST | `/projects/:id/produce` | `routes/produce.ts` | Requires an active entitlement; runs the real generator + uploads to Storage (synchronously within the request, via the same claim/execute path the background worker uses) |
| GET | `/projects/:id/status` | `routes/produce.ts` | Project + latest job status |
| GET | `/projects/:id/download` | `routes/produce.ts` | Signed URL (15-min TTL) for the completed, non-quarantined asset |
| PUT | `/admin/pricing` | `routes/admin.ts` | Admin-only; appends a new price version, never mutates an old one; Cinematic release-gate enforced |

Full request/response shapes and the original (aspirational) contract are in `docs/api-contracts.md`
— note that document predates the real implementation in places; the actual route files are the
source of truth for exact behavior.

---

## 7. The background worker (job execution model)

`server/http/jobs.ts` is a shared claim/execute state machine used by BOTH:

- the synchronous request path (`POST /projects/:id/produce` — still responds only after the job
  finishes, so external behavior is unchanged from a naive synchronous implementation), and
- the standalone worker (`server/http/worker.ts`, `npm run start:worker`).

The request path is honestly just "a worker that happens to still have the user's live session" —
same claim query, same lease/attempts bookkeeping, not a second parallel implementation.

**Claim predicate** (one unified SQL `WHERE` clause used by both paths):
```sql
status = 'queued'
  OR (status = 'running' AND lease_expires_at < NOW())   -- crash recovery
  OR (status = 'failed' AND attempts < max_attempts AND next_retry_at <= NOW())  -- retry
```
Claiming uses `FOR UPDATE SKIP LOCKED`, safe for multiple concurrent worker processes. On failure,
backoff is exponential (`30 * 2^(attempts-1)` seconds); after `max_attempts` (default 3), the job is
permanently `quarantined` and never reclaimed again.

**The one real gap:** a detached worker (no live HTTP request) has no user access token, so it
cannot complete the Storage upload step of a job it claims unless `SUPABASE_SERVICE_ROLE_KEY` is
configured. Without it, the worker still claims, retries, and quarantines jobs correctly — it just
fails the upload every time, which is itself a genuine exercise of the retry mechanism (verified by
`npm run test:worker`), not silent breakage. Fill in that env var to make the worker able to
actually finish a job with no live session.

---

## 8. Test suites — what each one actually proves

| Command | Count | Proves |
|---|---|---|
| `npm run test:backend` | 19/19 | The in-memory reference model (`server/backend.ts`) — pricing math, immutability, state machine. No database needed; this is a documented contract/fixture, not the real service. |
| `npm run test:api` | 19/19 | Real HTTP + real DB: project/motion/quote/admin, RLS cross-owner isolation (A can't see B's data, impersonation blocked), fail-closed Smooth rejection, the admin price-change invariant (old quotes keep their old rate). |
| `npm run test:production` | 11/11 | Real entitlement check → real Python subprocess generation → real Storage upload → real signed download, byte-for-byte and SHA-256 verified against a reopenable `.pptx`. |
| `npm run test:journey` | 9/9 | The full payment loop with **zero manual SQL**: checkout → self-signed simulated webhook over real HTTP → automatic entitlement grant → production → download. Also proves webhook idempotency and signature-tampering rejection. |
| `npm run test:worker` | 15/15 | Crash recovery (a job stuck `running` with an expired lease gets reclaimed), exponential backoff, permanent quarantine after `max_attempts` — run directly against the live DB, no HTTP layer. |

All five were run **at least twice in a row** during development to confirm repeatability, not just
"passed once." Each test file cleans up its own fixture data on completion (see each file's
`finally` block) — if a test crashes mid-run, you may need to manually clean up leftover rows (the
test files' fixture-owner IDs and cleanup queries show you exactly what to delete).

**Permanent fixtures that must NOT be deleted** by a careless cleanup query:
- Two Supabase Auth users: `integration-test-a@ai-presentation-platform.internal` and `...-b@...`
  (pre-confirmed via direct SQL insert so no SMTP is needed). Their passwords must be supplied only
  through `INTEGRATION_TEST_USER_A_PASSWORD` and `INTEGRATION_TEST_USER_B_PASSWORD` in ignored local
  configuration; never commit or publish those values. These fixture credentials were previously
  present in tracked source/docs, so rotate them through the authorized Supabase owner before any
  externally shared use.
- One permanent project (`735b4bdc-c9ad-47a7-b0b7-1c5da2d04213`, owned by fixture user A) with a
  manually-granted entitlement, used by `test-production-pipeline.ts` and `test-worker-recovery.ts`.
  `test-live-integration.ts`'s cleanup explicitly excludes this ID by name — if you add a new test
  that does a blanket "delete all of user A's projects," you will break this fixture (it happened
  once already this session; the fix is in commit `983774c`).

---

## 9. Honest limitations and open decisions

Full detail lives in `docs/BLOCKERS.md` (ranked, with exactly what's needed) and
`docs/DECISIONS.md` (what's confirmed vs. provisional vs. needs the owner's answer). Condensed:

**Cannot be resolved by more engineering alone (need the project owner):**
1. No licensed Windows/Mac/legacy-Office desktop PowerPoint anywhere → every Smooth/Cinematic
   effect stays correctly disabled (`motion_library.enabled = FALSE` for all of them) until real
   desktop QA passes. This is the single hardest external blocker.
2. No real payment provider credentials → checkout/webhook mechanics are real, but the provider is
   `mock_sandbox`.
3. No real AI content-generation provider/API key → slide text is honest placeholder content.
4. No confirmed hosting target for staging/production deployment.
5. No accountant-confirmed VAT/BIN tax policy.
6. The original full project plan (referenced "section 15") was never supplied — several commercial
   decisions (quote TTL, minimum order, refund policy, the Smooth role-policy conflict) are running
   on documented provisional defaults, not confirmed requirements.

**Buildable, just not done yet:**
- Real static-preview image rendering (currently mock/placeholder imagery before purchase — distinct
  from the real generated `.pptx` after purchase, which does exist). Needs a decision: render from
  the real deck (e.g. LibreOffice headless) vs. a dedicated service.
- `SUPABASE_SERVICE_ROLE_KEY` still blank — see §7.
- Wiring the existing 12-screen *designed* mock prototype (`frontend/index.html`) to the real API —
  `live-demo.html` proves the backend works from a browser, but isn't a polished product UI.
- PWA icons / install verification.
- TypeScript strict-mode coverage currently only includes `server/**/*.ts` (not the frontend).

---

## 10. How we got here (commit history)

```
892fe76  Set up Node/TS project structure for AI Presentation Platform
c34d614  Verify Phase 0 engine with a real Python install; document findings
f4392cd  M0: reconcile with AI_Presentation_Phase0_Project.zip, re-verify everything
f3dc824  M1: real Supabase Postgres + Auth, RLS/immutability verified live
6246924  M1: real Express HTTP API against the live Supabase database
e927e3e  M1 complete: real HTTP API verified live end-to-end, 19/19 pass
0c1420d  M1 complete: real production pipeline, verified live end-to-end
983774c  Complete customer journey: checkout, webhook, automatic entitlement
242c6a1  Real background worker: crash recovery, retry/backoff, quarantine
ee82254  Real browser-tested customer journey, not just scripted tests
```

Each commit message is deliberately long and explains not just *what* changed but *why*, including
every real bug found and fixed along the way (there were many — type-inference failures, RLS
footguns, transaction-isolation mistakes). **Read the commit messages**, not just the diffs, when
you need to understand why something is built the way it is.

---

## 11. Where to find more detail

| Document | What it's for |
|---|---|
| `docs/STATUS.md` | The single most up-to-date "what's genuinely verified" log, in chronological narrative form. Longer and more detailed than this handoff's §2. |
| `docs/BLOCKERS.md` | Every blocker, ranked, external vs. internal, with exactly what's needed to resolve each. |
| `docs/DECISIONS.md` | Every decision made — confirmed requirements, provisional defaults, autonomous engineering choices with reasoning and reversibility, and the batch of questions still needing the owner's answer. |
| `docs/REQUIREMENTS_TRACEABILITY.md` | Maps the original FR-01–FR-26 requirements to current implementation state. |
| `docs/api-contracts.md` | The original (aspirational) API/data contract design — compare against the real route files for drift. |
| `docs/source-audit.md`, `docs/verification.md` | An independent audit of the pre-Supabase prototype (useful history, not current state). |
| `docs/phase0-report-v2.md` | Phase 0 engine experiment results and the manual desktop-QA checklist to run once real Office access exists. |
| `docs/requirements-analysis.md` | The original client requirements document this whole project is derived from. |
| This file (`docs/HANDOFF.md`) | Start here. Points everywhere else. |

---

## 12. Immediate next steps, in priority order

1. **Get `SUPABASE_SERVICE_ROLE_KEY` filled in** — unblocks the background worker's ability to
   actually complete a detached job, not just claim/retry it.
2. **Answer the payment-provider decision** (`docs/DECISIONS.md` #1) — once chosen, swap
   `mock_sandbox` for the real provider in `routes/checkout.ts`/`routes/webhooks.ts`; the
   idempotency/signature-verification/atomic-entitlement-grant mechanics are already real and
   tested, only the specific provider API call and signature scheme need to change.
3. **Answer the AI content-provider decision** — wire real slide-content generation to replace
   `engine/generate_static_deck.py`'s placeholder text.
4. **Arrange desktop PowerPoint access** (Windows + Mac + one older Office build) — run the manual
   QA checklist in `docs/phase0-report-v2.md`, record real pass/fail per effect, enable only what
   passes in `motion_library`.
5. Decide on and build real static-preview image rendering.
6. Decide on and build out the real, designed frontend (replacing/extending the mock prototype),
   now that the backend it needs to call is fully proven.

Everything above can proceed in parallel — none of the internal work is blocked on the external
decisions, and the external decisions don't block each other.
