# Latest order and release-configuration update

26 October 2026: quote/order status, verified production controls and private download UI are implemented and locally tested. Real checkout remains unavailable pending provider selection. Remote database TLS verification, production mock-payment blocking, loopback defaults, exact-origin CORS and private-response headers are implemented. Read STATUS.md and RELEASE_CONFIGURATION.md for fresh evidence and remaining release gates; older statements that all production UI is absent are superseded.

---

# Latest preview/approval update

26 October 2026: Real PPTX-to-image preview rendering, count-at-start quota enforcement, explicit immutable approval and exact-approved-source Static delivery now pass local checks. See STATUS.md and PREVIEW_PIPELINE.md for evidence and setup. Migrations 0009-0011 remain local only. Live Auth/Storage, customer checkout/production UI, a selected payment provider, desktop Smooth proof and release operations remain open. The owner confirmed that the payment provider is not selected yet. Historical statements below about missing preview/approval implementation are superseded; their live-release gates remain.

---

# Latest draft-persistence update

26 October 2026: authenticated versioned draft save/load and real-content Python rendering are implemented and locally tested. Migration 0008 is local only. Saved drafts deliberately cannot use the metadata-only sandbox checkout; actual same-source image previews, quota/revisions, explicit design approval and approved production snapshot binding remain next. See STATUS.md for fresh evidence and setup; older statements below about all drafts remaining local are superseded.

---

# Continuation evidence - payment and production guards

26 October 2026: FR-15/16/17/18/20 now have additional local PostgreSQL coverage: migration 0007, immutable quoted metadata, full paid-chain validation, forged/duplicate/out-of-order events, quote expiry, cancellation, refund/revocation blocking. These prove sandbox mechanics, not real payment integration. FR-02/04/05 (real content/preview/approval/quota) and FR-06-12 (verified Smooth) remain incomplete. Full Static + Smooth release acceptance is unchanged.

---

# Current requirements traceability

Reconciled 26 October 2026 against current code and fresh local checks. Ownership: **Engineering** means implementation here; **Owner** means product/access/commercial decision; **Desktop QA** requires licensed PowerPoint evidence. Historical traceability follows this current matrix and is not current evidence.

| ID | Requirement | Current implementation / evidence | Gap and owner |
|---|---|---|---|
| FR-01 | Installable PWA | Manifest, service worker and icons; production build/release smoke validates assets | Browser install, HTTPS/offline behavior and privacy acceptance; Engineering + Owner |
| FR-02 | Project intake, drafts and account access | Authenticated versioned draft API, studio, signup/sign-in, PKCE email confirmation and password recovery; local PostgreSQL/RLS and controlled browser tests | Full original plan needed to confirm remaining intake scope; live Auth/email delivery and redirect allowlists remain unverified; Owner + Engineering |
| FR-03 | Smooth default, Static opt-out | Request defaults and reference tests; unverified Smooth fails closed | Real customer flow and accurate availability copy; Engineering |
| FR-04 | Actual static slide previews | Python-generated PPTX rendered by LibreOffice/Poppler; durable private image assets; local pipeline verified | External Storage transfer and broader Bengali/font/layout acceptance; Engineering + Desktop QA |
| FR-05 | Two projects / two revisions | Atomic database quotas, count-at-render-start policy and concurrency/retry tests | Live authorized staging confirmation; policy documented in `DECISIONS.md` |
| FR-06 | Real three-second clips | None verified | Licensed desktop recordings and provenance; Desktop QA |
| FR-07 | AI-curated 2–6 transitions | Disabled experimental registry | Approved candidates, provider, fewer-than-two policy; Desktop QA + Owner + Engineering |
| FR-08 | One transition per deck | Experimental engine policy checks | Production Smooth integration/playback; Engineering + Desktop QA |
| FR-09 | Intensity, no price effect | Reference and engine tests pass | Final timing interpretation and real visual QA; Owner + Desktop QA |
| FR-10 | Role-based entrances | Experimental templates and policy tests | Title/image versus quote/closing source conflict; Owner |
| FR-11 | Approved IDs, no AI-authored XML | Experimental negative tests pass | Provider contract and production Smooth enforcement; Engineering |
| FR-12 | Five entrances / dense slide reduction | Experimental cap tests pass | Final dense-slide reduction policy; Owner + Desktop QA |
| FR-13 | Server quotes | API quote is bound to approved Static content; local SQL journey | Cloud migration and commercial pricing confirmation; Engineering + Owner |
| FR-14 | Configurable rates | Versioned schema/admin path | Live authorization/access review on isolated staging; Engineering |
| FR-15 | Immutable quote/design | Immutable approved content/source, metadata and paid-chain checks; local SQL tests | External staging evidence; Engineering |
| FR-16 | Expiring quotes | 24h provisional default; reference tests | Final commercial TTL and provider expiry scenarios; Owner + Engineering |
| FR-17 | Paid-tier production entitlement | API, worker and download validate the paid chain; local negative tests | Real provider and live cloud proof; Engineering |
| FR-18 | Verified, idempotent payments | Mock sandbox mechanics, HMAC validation and replay/tamper/order tests | No real provider selected or integrated; Owner + Engineering |
| FR-19 | Durable jobs / motion audit | PostgreSQL queue, lease/retry/fencing/quarantine and worker tests; Static source metadata recorded | Operational dashboards/status/retention and Smooth audit; Engineering |
| FR-20 | Delivery validation | Independent content/package validation and checksum-preserving Static path; Python/local SQL tests | Broader layout/factual review and cloud transfer reliability; Engineering + Desktop QA |
| FR-21 | Accurate pricing explanation | Authenticated customer UI displays server quote and current order state | Customer pricing acceptance in live staging; Engineering |
| FR-22 | One included motion swap | Schema counter only | Durable revision ledger, swap definition and add-on price; Owner + Engineering |
| FR-23 | Tier changes | Reference pricing concepts only | Upgrade differences, rerender workflow, downgrade/refund decision; Owner + Engineering |
| FR-24 | Cinematic gate | Disabled registry/server gate; reference/engine tests | Approved price, Phase 0 sign-off, five paying clients; Owner + Desktop QA |
| FR-25 | Admin audit | Schema and price-change code exist | Real admin UI, permissions, durable operational audit verification; Engineering |
| FR-26 | BDT payments and tax invoices | Sandbox mechanics only; no approved tax policy | Provider access and accountant-approved terms; Owner |

## Roadmap milestone / operational coverage

| Milestone | Current evidence | Remaining exit conditions / owner |
|---|---|---|
| 0 | Stack/routes/migrations/roles/worker/generator/test inventory; local baseline; ranked backlog; remote-test guards | CodeRabbit supported runtime/login unavailable; independent deployed DB evidence deferred to authorized target |
| 1 | Supabase Auth middleware, ownership SQL and prototype exist | Onboarding/recovery browser tests, structured content, provider/privacy/budget, real previews, quotas, approval, responsive authenticated frontend; Engineering + Owner |
| 2 | Async queue, leases, crash/retry/fencing, validation and private delivery code | Real approved content snapshot, exact quote/payment binding, cloud least-privilege storage, retention, true sandbox journey; Engineering + Owner |
| 3 | Experimental versioned templates and structural checks | Supported Office matrix, bilingual eight-slide desktop proof, genuine clips, role/timing decisions and production Smooth; Desktop QA + Owner + Engineering |
| 4 | Server quotes, sandbox webhook and pricing API foundations | Provider, revision ledger, tier-change/refund policies, invoicing, 20-deck economics and three-client feedback; Owner + Engineering |
| 5 | Fresh local test/build evidence | Security/dependency review, abuse controls, responsive/a11y/PWA acceptance, operations/backups/restore, authorized staging and sign-off; Engineering + Owner |
| 6 | Cinematic disabled | Phase 0, paying-client gate, approved rate and separately validated effects; Owner + Desktop QA + Engineering |

Rules: preserve the current stack; no fabricated AI or motion evidence; no cloud mutation/deployment/payment activation/commit/push without authorization. Existing untracked `docs/ROADMAP.md` is preserved. Historical claims are evidence leads, never an automatic pass.

---

# Historical traceability — superseded

This older table contains known stale claims and old milestone numbering. Use the current tables above.

# Requirements traceability

Cross-referencing `docs/requirements-analysis.md` FR-01–FR-26 against what actually exists in this
repo today, verified by running the commands in `docs/STATUS.md`, not by reading prior reports.

| FR | Requirement | Current state | Evidence |
|---|---|---|---|
| FR-01 | Installable PWA | Manifest + minimal offline worker exist; no icons; install/HTTPS unverified | `frontend/public/manifest.webmanifest`, `frontend/public/sw.js` — BLOCKERS #12 |
| FR-02 | Project input | Intake form validates quota/ranges in the prototype; no persisted backend record yet | `frontend/src/accessibility.js` intake guards; backend `projects` table exists in schema, unpersisted |
| FR-03 | Motion default = Smooth, opt-out Static | Implemented and tested server-side | `server/backend.ts` Test 02; `frontend` motion toggle |
| FR-04 | Static preview = static imagery only | Prototype labels preview correctly; no real image rendering | BLOCKERS #10 |
| FR-05 | Preview caps: 2 projects/account, 2 revisions/project | Enforced in prototype UI; not yet enforced by a real backend+DB | Prototype quota counters; needs DB-backed enforcement |
| FR-06 | Real 3-second sample clips | None exist; explicitly labeled unverified/placeholder everywhere | BLOCKERS #1 |
| FR-07 | AI-recommended transitions (fade/wipe/push/zoom) | Candidate registry implemented, all disabled for production | `engine/registry.json` |
| FR-08 | One deck-wide transition | Implemented in engine (`<p:transition>` applied once per deck) | `engine/phase0.py`, `test_phase0.py::test_all_specimens_pass_structural_policy` |
| FR-09 | Intensity (subtle/standard/dynamic), no price effect | Implemented; tested that intensity changes timing not price | `test_phase0.py::test_intensity_exact_duration_scales`; backend Test 05 |
| FR-10 | Role-based automatic entrances | Implemented via role→template mapping | `engine/phase0.py`, `engine/templates/v1/entrances.xml` |
| FR-11 | No AI-authored animation XML | Enforced — only approved IDs accepted, unknown IDs raise | `test_phase0.py::test_unknown_identifier_no_substitution`, `test_unknown_entrance_rejected` |
| FR-12 | Max 5 entrances/slide; reduce above 6 bullets | Implemented, provisional title-only reduction rule | `test_phase0.py::test_animation_cap_rejected`, `test_cap_and_dense_policy` — provisional per `docs/DECISIONS.md` #5 |
| FR-13 | Server-computed quote | Implemented in reference backend | `server/backend.ts` Test 04/05; needs real HTTP+DB wiring (BLOCKERS #8) |
| FR-14 | Admin-configurable rates | Implemented | `server/backend.ts` Test 06/08 (admin rate update) |
| FR-15 | Immutable quote snapshot | Implemented and regression-tested (the frozen-record bug is fixed) | `server/backend.ts` regression test "re-quote replaces frozen lifecycle record..." |
| FR-16 | Quote expiry | Implemented, 24h dev default | `server/backend.ts` Test 07 — value itself is `docs/DECISIONS.md` #6 |
| FR-17 | Tier entitlement validation before production | Implemented | `server/backend.ts` Test 09 |
| FR-18 | Webhook signature + idempotency | Implemented as a **mock** HMAC verifier — not a real provider integration | `server/backend.ts` Test 10 — real provider is BLOCKERS #2 |
| FR-19 | Job audit log (`jobs.animation_choices`) | Schema field exists and is populated by the reference model; no durable job queue yet | `db/migrations/0001_...sql`, `server/backend.ts` Test 12 — BLOCKERS #11 |
| FR-20 | Automated delivery validation | Implemented structurally (ZIP/OPC/XML/policy); explicitly NOT proof of PowerPoint playback | `engine/phase0.py` validator, `test_phase0.py` negative cases |
| FR-21 | Pricing explanation copy | Present in prototype | `frontend/src/prototype.js` pricing screen |
| FR-22 | One free post-delivery motion swap | Schema field (`free_motion_swaps_remaining`) exists; enforcement logic not yet wired to a real endpoint | `db/migrations/...sql` |
| FR-23 | Tier-change pricing (upgrade = difference only) | Pricing math exists; downgrade refund policy is `docs/DECISIONS.md` #8 (open) | — |
| FR-24 | Cinematic gate | Enforced server-side and in engine registry | `server/backend.ts` cinematic rejection; `engine/registry.json` |
| FR-25 | Admin audit trail | Schema + append-only trigger exist; not yet exercised against a real database | `db/migrations/...sql` `audit_logs` table + `prevent_audit_log_modification` trigger — BLOCKERS #7 |
| FR-26 | BDT payments / tax invoices | Explicitly deferred; `tax_amount_bdt` defaults to 0, no invented rate | `docs/DECISIONS.md` #1, BLOCKERS #5 |

## Milestone traceability (master prompt §19)

| Milestone | Status |
|---|---|
| M0 — Reproduce and decide | **Done**: inventory, reconciliation, baseline re-run, this traceability doc, decision register |
| M1 — Foundation + real Static vertical slice | **Local implementation complete:** versioned drafts, real PPTX previews, quotas, approval, approved-source quote/production and private-download interfaces; disposable PostgreSQL/RLS and renderer tests pass | Authorized live Supabase Auth/Storage/worker journey and broader content/layout acceptance; Engineering + Owner |
| M2 — Commerce and reliability | **Local Static production path implemented; paid checkout intentionally unavailable** | Select provider, implement provider-specific contract, verify staging paid sandbox path, finalize terms and operations; Owner + Engineering |
| M3 — Smooth integration | Architecturally ready (registry/template system exists) but gated entirely on desktop QA (BLOCKERS #1) |
| M4 — Product quality | Studio, responsive/browser checks and release package implemented locally | Complete full accessibility, abuse controls, operational recovery and customer support acceptance; Engineering + Owner |
| M5 — Staging and release | **Not verified:** release artifact smoke passes locally; no authorized deployment target configured | Provision isolated authorized staging, configure secrets safely, apply reviewed migrations and perform end-to-end verification; Owner + Engineering |
