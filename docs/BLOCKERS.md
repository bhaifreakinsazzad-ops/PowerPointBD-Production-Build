# Current release gates

Read the current gate table and [investor MVP brief](INVESTOR_MVP_BRIEF.md) first. Historical backlog notes below are retained as context only; they contain stale items and must not be used to determine the present implementation state.

---

# Current remaining gates — 26 October 2026

The current local Static workflow now includes Puter-assisted slide drafting, versioned persistence, actual PPTX slide-image previews, server-enforced quotas, explicit design approval, approved-source Static quoting/production, durable worker processing, validation and a guarded private-download interface. These capabilities are covered by the fresh local checks recorded in `STATUS.md` and `INVESTOR_MVP_BRIEF.md`. The legacy backlog tables below are historical and must not be used as the present code status.

| Priority | Remaining gate | Required evidence / dependency |
|---|---|---|
| P1 external | Live staging environment and cloud integration | The confirmed target is Supabase project `HTKIS---SaaS-Agency` (`mnigcwueptvnfqrrszyd`), with PowerPointBD isolated in `ai_presentation` and scoped app/worker/webhook roles already present. Review and apply migrations 0007–0011 only within this boundary, replace the earlier Storage owner-write policies with migration 0011's restrictive rules, then verify real Auth, Storage transfer, worker completion, download, TLS and recovery. The project also hosts unrelated applications, so use a reviewed migration window or an isolated database branch when available. |
| P1 external/product | Real payment provider and terms | Owner selects provider and supplies sandbox access; engineering implements provider-specific checkout/webhooks/idempotency/refunds; owner confirms fee, refund, TTL and tax/invoice policy. |
| P1 external | Smooth release support | Licensed Windows/Mac/older Office matrix, actual playback and genuine three-second clips; keep Smooth disabled until accepted. |
| P1 engineering | Commercial operations | Verify Auth email delivery and callback allowlists on staging; add shared gateway rate limits for multi-instance deployments, monitoring/alerts, retention/orphan reconciliation, backup/restore and incident/runbook acceptance. The API now has bounded per-process authenticated write limits. |
| P2 | Full accessibility and content/layout acceptance | Review keyboard/screen reader flows and representative dense Bengali/English decks, font fallback, overflow, images/charts and renderer reliability. |
| Deferred | Cinematic | Keep disabled until Phase 0, five paying clients and approved economics/pricing requirements are evidenced. |
| Tooling | Independent CodeRabbit review | Requires supported authenticated runtime; not a release blocker if replaced with documented human/code review. |

Migrations 0007–0011 remain local. The existing Supabase target and local credential configuration are confirmed, but no new migration, payment activation, deploy, remote mutation, commit or push is claimed. See the investor brief for a demo flow and conditions.

---

# Historical draft-persistence update — superseded

26 October 2026: authenticated versioned draft save/load and real-content Python rendering are implemented and locally tested. Migration 0008 is local only. Saved drafts deliberately cannot use the metadata-only sandbox checkout; actual same-source image previews, quota/revisions, explicit design approval and approved production snapshot binding remain next. See STATUS.md for fresh evidence and setup; older statements below about all drafts remaining local are superseded.

---

# Historical priority after Puter selection — superseded

26 October 2026: AI provider selection is resolved: use Puter.js. No direct OpenAI key is needed. Live generation needs the end-user Puter session/allowance; the studio handles sign-in and consent.

Next: persist validated studio content to authenticated projects, create actual preview imagery and server quotas/approval, freeze the real approved content into quotes and render it through the paid Python job. Draft JSON and a 3D storyboard do not satisfy those release gates. Worker storage, real payment integration, desktop Smooth proof, operations and staging blockers remain.

---

# Historical ranked backlog and dependencies — superseded by the gate table above

Updated 26 October 2026. This list supersedes the historical blockers below. Severity describes launch/user impact, not a claim that an exploit has been reproduced.

| Priority | Confirmed gap / impact | Next action | Owner / gate |
|---|---|---|---|
| P1 | No real content, preview or approval workflow; placeholder decks cannot fulfill a customer order | Structured content contract, persisted approved snapshot, real image previews using the same content/design | Engineering; provider/privacy/budget decision by Owner |
| P1 | Free-preview caps exist only in the prototype | Decide counting for failures/retries/abandonment, then atomic server reservations and concurrency tests | Owner then Engineering |
| P1 | Quoted title/language/count and exact paid chain now pass local checks, but actual slide content/design approval are absent | Extend the frozen specification to real approved content and preview fidelity; retain verified payment chain | Engineering; 0007 staging rollout still required |
| P1 | Smooth cannot satisfy the released MVP without desktop QA and genuine clips | Agree supported Office matrix, test candidates and record real samples; keep disabled | Desktop QA + Owner |
| P1 | No real payment provider or approved financial terms | Choose provider/sandbox, verify official contract; decide swaps/refunds/minimum/TTL/tax/invoices | Owner + Engineering |
| P1 | Cloud detached worker/storage success is unverified; service storage key historically missing | Secure credentials on a dedicated target and verify least privilege plus end-to-end upload/download | Owner access, then Engineering |
| P1 | Integration scripts mutate global pricing, fixture data and private storage; normal detached workers process the full queue | Worker-recovery harness now scopes claims and retry quarantine to its own job. Use only an explicitly authorized isolated target; remaining integration fixtures and detached-worker scope still require isolation | Engineering + Owner target authorization |
| Resolved locally | Forged-event poisoning, duplicate races, verified-payment regression and exact paid-chain validation | Hardened sandbox service and migration 0007 pass local PostgreSQL regressions; deploy/retest only on authorized staging | Engineering; real provider remains separate |
| P1 | Table-level authenticated job/payment write policies and manual privileged-role grants need a full authorization review before exposing schemas | Test direct SQL/RLS as well as HTTP; restrict writable fields or use narrow privileged operations as needed | Engineering; inspection concern, not a reproduced remote exploit |
| P2 | Project state is not synchronized by worker completion; job status is the authoritative progress source | Add a scoped, tested persistence/status design; current worker has SELECT-only projects grant | Engineering; requires reviewed migration for worker writes if chosen |
| P2 | Lost workers may leave private, unregistered attempt uploads | Add retention/reconciliation with bounded orphan cleanup and preserved valid assets | Engineering + Owner retention policy |
| P2 | Designed frontend is still mostly simulated; demo is not a launch UI | Wire auth/session/project/content/approval/quote/payment/jobs/download to real APIs | Engineering |
| P2 | Abuse controls, upload constraints, full a11y/responsive QA, PWA assets, restore/monitoring/runbooks and staging evidence missing | Implement and verify before release | Engineering + Owner hosting/support |
| P2 | Happy DOM VM warning; Browserslist dataset warning | Keep DOM harness restricted to controlled repo code; assess dependency maintenance in hardening; do not suppress warnings | Engineering |
| External | CodeRabbit cannot install in current runtime | Official installer exited 1: Unsupported operating system: mingw64_nt-10.0-26300. Provision supported Linux/macOS/WSL runtime and authenticate | Owner environment/access |
| Deferred | Cinematic | Keep unavailable until Phase 0, five paying clients and approved economics/price pass | Owner + Desktop QA |

## Resolved in local batch 1

HTTP synchronous execution; missing heartbeats and stale-attempt fencing; unbounded child execution/output; overwrite-prone upload keys; endless reclaim after last-attempt crashes; missing independent Static package gate; async consumer incompatibility; historical downloads without validation evidence; unguarded remote test entrypoints. See `STATUS.md` for actual test coverage and its boundaries.

---

# Historical blockers — superseded

Older resolved/unresolved labels below are retained only as history and may conflict with the current list above.

# Blockers

Ranked by what they stop. "External" = cannot be resolved by engineering work alone in this
environment. "Internal" = genuinely buildable here without new access.

## External — need owner action or access

| # | Blocker | Blocks | What's needed |
|---|---|---|---|
| 1 | No licensed Windows/Mac/legacy-Office desktop PowerPoint | Selling ANY Smooth or Cinematic effect; genuine 3-second sample clips | Owner provides or arranges access to real desktop PowerPoint installs (see `docs/phase0-report-v2.md` manual QA checklist and `desktop-compatibility-matrix.csv` template, regenerated via `python engine/phase0.py --output-dir phase0_artifacts`) |
| 2 | No payment provider credentials | Only the real external API call — `POST /checkout/session` and `POST /webhooks/:provider` are built and tested against an explicitly-labeled `mock_sandbox` provider (idempotency, HMAC verification, amount matching, atomic entitlement grant all real — see `docs/STATUS.md`), just not a live SSLCOMMERZ/bKash/Nagad integration | Owner selects provider(s) and supplies sandbox merchant credentials |
| 3 | No AI content-generation provider/API key | Real slide content — every generated deck right now carries explicitly-labeled placeholder text (`PLACEHOLDER_NOT_AI_GENERATED`), not invented customer content | Owner selects provider, supplies API key via `.env.local` (never in chat), sets budget/rate limits |
| 4 | No confirmed hosting target | Any staging deployment | Owner names a target (Vercel/AppDeploy/VPS/other) |
| 5 | No accountant-confirmed VAT/BIN/tax policy | Showing any tax line on a real invoice | Owner + accountant confirmation; `tax_amount_bdt` stays 0 until then |
| 6 | Original full project plan / direct motion-pricing addendum not supplied | Resolving the Smooth role-policy conflict and several open commercial decisions definitively (currently using documented provisional defaults) | Owner supplies the original documents, or confirms the provisional defaults in `docs/DECISIONS.md` are acceptable |

## Internal — buildable now, just not done yet

| # | Item | Status | Next step |
|---|---|---|---|
| 7 | ~~No real database~~ **RESOLVED 2026-10-26** | Real Postgres via Supabase project `HTKIS---SaaS-Agency` (`mnigcwueptvnfqrrszyd`), isolated in its own `ai_presentation` schema. `db/migrations/0002_supabase_ai_presentation_schema.sql` applied and verified: 11 tables, RLS on every one, ownership isolation/anti-impersonation/immutability triggers/append-only audit log all independently tested against the live database (see `docs/STATUS.md`) | Done — needs `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` filled into `.env.local` (by you, from the dashboard) before the HTTP server (next item) can connect |
| 8 | ~~No real HTTP server~~ **RESOLVED AND LIVE-VERIFIED 2026-10-26** | `server/http/` is a real Express app covering the complete customer journey: `/projects`, `/projects/:id/motion`, `/projects/:id/quote`, `/checkout/session`, `/webhooks/:provider`, `/projects/:id/produce`, `/projects/:id/status`, `/projects/:id/download`, `/admin/pricing`. `npm run test:api` (19/19), `npm run test:production` (11/11), and `npm run test:journey` (9/9) all pass, each run twice | Swap the sandbox payment provider for a real one once item #2 is resolved |
| 9 | ~~No real auth~~ **RESOLVED, UI EXISTS 2026-10-26** | Using real Supabase Auth (`auth.users` + `auth.uid()` in RLS). `frontend/public/live-demo.html` has a real working sign-in form (minimal, dev-only) — see `docs/STATUS.md` | Real sign-up (not just sign-in) needs a decision on email confirmation (currently would require SMTP/confirmation, untested) |
| 10 | No real static-preview image rendering | Preview screens (before purchase) show mock/placeholder imagery — distinct from the real generated `.pptx` itself, which now exists | Needs a decision: render actual slide images from the generated `.pptx` (e.g. LibreOffice headless, if installable) vs. a dedicated rendering service |
| 11 | ~~No durable job queue~~ **RESOLVED AND LIVE-VERIFIED 2026-10-26** | `server/http/worker.ts` is a real standalone background worker: atomic claim with `FOR UPDATE SKIP LOCKED` (safe for multiple concurrent workers), lease-based crash recovery, exponential backoff retries, and permanent quarantine after `max_attempts`. `npm run test:worker` proves all of it against the live database — a job stuck `running` with an expired lease is reclaimed, retried twice with doubling backoff, then quarantined — 15/15 PASS, twice in a row | The one real gap: a detached worker has no live user session for the storage-upload step, so it needs `SUPABASE_SERVICE_ROLE_KEY` (item 17) to *complete* a job, not just claim/retry it |
| 12 | PWA icons missing; install/offline/HTTPS unverified | Manifest exists, nothing else does | Generate real 192/512px icons; verify installability once something is actually served over HTTPS |
| 13 | Frontend dev-dependency vulnerabilities (happy-dom, tailwindcss/postcss-selector-parser) | `npm audit`: 1 high, 3 moderate — both are dev/test/build tooling only, never shipped to the browser | Low priority; revisit when upgrading build tooling (tailwindcss v4 is a breaking change) |
| 14 | No TypeScript strict-mode coverage outside `server/` | `tsconfig.json` only includes `server/**/*.ts` | Expand once a real app (not just the reference model) exists |
| 15 | ~~`DATABASE_URL` missing~~ **RESOLVED 2026-10-26, self-service** | Created a dedicated least-privilege role (`ai_presentation_app`, scoped to the `ai_presentation` schema only, no superuser/bypass) rather than touching the shared project's own credentials, connected via the Supavisor pooler (the direct host is IPv6-only here). `SUPABASE_SERVICE_ROLE_KEY` is still blank — no code uses it yet | None — fill in `SUPABASE_SERVICE_ROLE_KEY` only if/when something needs it |
| 16 | Local PostgreSQL 17 was installed and is running as Windows service `postgresql-dev`, now unused after the pivot to Supabase | Harmless (bound to localhost, no sensitive data) but idle | Stop/uninstall it yourself (this session couldn't — `net stop` needed admin rights) if you don't want it, or leave it as a spare local option |
| 17 | `SUPABASE_SERVICE_ROLE_KEY` is still blank | The background worker (item 11) can claim/retry/quarantine jobs correctly without it, but cannot *complete* one it picks up with no live user session — it fails the storage-upload step every time, which is a real, observable exercise of the retry logic, not silent breakage | Get it from Supabase dashboard → Project Settings → API → `service_role`. Paste directly into `.env.local`, never into chat |
| 18 | `frontend/public/live-demo.html` is a minimal, separate demo page — not the real product frontend, and not wired to the existing 12-screen mock prototype at all | Proves the real backend works end-to-end from an actual browser, but isn't a designed/polished customer-facing UI | Needs a decision: replace the mock prototype's controllers with real API calls screen-by-screen (preserving its existing HTKIS-derived visual design), vs. building a new app. Not started |

## Explicitly not blocked

The real HTTP service, job queue, and frontend hardening can all proceed in parallel on the
recommended defaults in `docs/DECISIONS.md` without waiting on any external blocker above — the
database (item 7) is no longer a blocker at all.
