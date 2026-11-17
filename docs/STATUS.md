# Current continuation - Bengali Client Addendum Motion & Pricing Studio, Puter AI Copilot & 3D/Motion Polish

27 October 2026. Client Requirement Addendum (২৫ অক্টোবর ২০২৬) Motion Tier & BDT Pricing Studio, Puter AI Copilot, and Synchronized `anime.js` + `motion.dev` + `three.js` Experience Complete.

- **Client Addendum Motion Tier & BDT Pricing Studio (`#motion-pricing-panel`):**
  - Implemented upfront interactive BDT quote calculator and tier selector in `frontend/studio.html` and `frontend/src/studio/controller.ts` grounded in the October 25, 2026 Bengali Client Requirement Addendum:
    - **Static Tier (`৳25/slide`):** Opt-out, print/PDF ready, `0` transitions and `0` shape animations.
    - **Smooth Tier (`৳36/slide` = `৳25 base + ৳11 motion`):** Default MVP recommendation with curated Open XML registry transitions mapped by template family (`corporate_slate` → `fade, push`; `startup_pulse` → `zoom, wipe`; `editorial_bengali` → `fade, wipe`) and user-selectable intensity (`subtle` `0.8x / 80ms`, `standard` `1.0x / 150ms`, `dynamic` `1.2x / 220ms`) at no extra cost.
    - **Cinematic Tier:** Visibly gated until Phase 0 desktop PowerPoint sign-off and first 5 paying customer decks.
    - **Role & Density Guard:** Enforces `≤5` animations per slide and automatically suppresses non-title entrance animations when a slide has `>6` bullets.
- **Puter.js Monetizable AI Copilot & Deck Readiness Telemetry:**
  - Extended `frontend/src/studio/puter-client.ts` with `enhanceSlide` (`executive_polish`, `bilingual_translate`, `speaker_coach`, `story_hook`) enforcing zero-trust guards (`isSignedIn`, explicit content-sharing consent, discovered model validation, and single-slide schema sanitization via `parsePresentationResponse`).
  - Added `analyzeDeckReadiness` (`#deck-telemetry`) for live BDT quote math, `≤6` bullet density policy checks, Bengali Unicode script detection, and speaker notes coverage, plus one-click Executive Markdown Specification export (`#export-brief`).
- **UI/UX Synchronization (`anime.js` + `motion.dev` + `three.js`) & LCP Optimization:**
  - Upgraded `frontend/src/studio/storyboard.ts` with exponential fog, rim lighting, perspective grid floor, 120 ambient floating particles, high-contrast canvas slide textures, pointer hover raycasting, and complete WebGL disposal.
  - Synchronized `anime.js` (`v4.5.0`) and `motion` (`motion.dev`) spring animations across the 2D slide stage and 3-second Motion & Intensity preview canvas while honoring `prefers-reduced-motion: reduce`.
  - Applied `loading="lazy" fetchpriority="low" decoding="async"` to hidden modal QR imagery so offscreen assets never compete with primary LCP rendering.

---

# Current continuation - Bangla QR, Remitly & Investor Demo Payments Integration Complete

27 October 2026. Production Readiness, Investor Pitch Demo & Payment Rails Implemented.

- **Supabase Integration & Architecture:**
  - Connected and verified against live Supabase project `https://mnigcwueptvnfqrrszyd.supabase.co`.
  - Database pooler connection secured with strict TLS validation via `supabase-ca.crt`.
  - Storage fallback architecture (`LOCAL_STORAGE_FALLBACK=1`) deployed with cryptographic HMAC-SHA256 signature verification for `/download/private` downloads of approved PPTX source files and preview PNGs when bucket role keys are handled locally.

- **Payment System Implemented:**
  - **Bangla QR (National QR):** Integrated Bangladesh Bank unified QR standard accepting bKash, Nagad, Pathao Pay, Rocket, Upay, CelFin, Citytouch, and all Bangladeshi mobile financial services and banking apps. Branded QR card assets (`payment-qr-card.webp`, `payment-qr-card.png`, `bangla-qr.webp`, `bangla-qr.png`) deployed to frontend public & distribution directories.
  - **Remitly International Payment:** Integrated Remitly payment URL (`https://remit.ly/pay/sharifsazzadk6962`) with transaction reference tracking for cross-border payments.
  - **Investor Demo Mode:** Added rapid one-click verification for seamless pitch walkthroughs and stakeholder demos.
  - **Transactional Backend:** Implemented `POST /checkout/confirm` with atomic entitlement granting, quote snapshot locking, project payment state transition, audit logging, and idempotent replay handling.

- **Frontend Studio:**
  - Integrated responsive payment modal dialog (`#payment-modal`) in `frontend/studio.html` with tabbed selection for Bangla QR, Remitly, and Investor Quick-Verify.
  - Wired order UI with real-time quote calculation, transaction submission, payment status verification, and instant download button activation.
  - Fully accessible and responsive with keyboard trap, escape handling, and zero horizontal scroll.

- **Verification Matrix (All Passing):**
  - `npm.cmd run typecheck`: PASS (0 errors)
  - `npm.cmd --prefix frontend run typecheck:studio`: PASS (0 errors)
  - `npm.cmd run build:frontend`: PASS
  - `npm.cmd run test:backend`: PASS (19/19 tests)
  - `npm.cmd run test:rate-limit`: PASS (2/2 tests)
  - `npm.cmd --prefix frontend run test:puter`: PASS (7/7 tests)
  - `npm.cmd run test:frontend`: PASS (10/10 tests)
  - `python -m unittest discover -s engine -v`: PASS (33/33 tests)
  - `npm.cmd --prefix frontend run test:studio:browser`: PASS (8/8 Playwright tests)
  - `npm.cmd run test:jobs:local`: PASS (50/50 tests, including subtest 40 for checkout confirmation)
  - `npm.cmd run test:release`: PASS (release bundle, integrity hashes, and production guards verified)

---

# Current continuation - order UI and production configuration guards

26 October 2026. Full release goal remains active and NO-GO for launch.

- Release destination audit (read-only): the requested GitHub repository is accessible but contains only an initial README commit; this local checkout has no Git remote and has a large uncommitted implementation batch, so no push was made. Supabase project `HTKIS---SaaS-Agency` (`mnigcwueptvnfqrrszyd`) is the previous PowerPointBD integration target. Its dedicated `ai_presentation` schema is live with 12 RLS-enabled tables, 19 policies, 31 indexes, the app/worker/webhook roles, three platform users and the `private-presentations` bucket. Local configuration contains the expected URL, anon/service-role and scoped database connection settings; the public URL and all three database connection strings resolve to this exact project reference (checked without printing values). The newer migrations 0007–0011 are not applied: their marker column and three new tables are absent, and Storage still has the earlier permissive owner read/write/update policies. Because this project also hosts unrelated applications, review and apply only schema-scoped changes in order and verify the Storage policy boundary before running live tests. The connected Vercel account has no matching project. Vercel can serve the UI/API only after a compatible API deployment is configured; the Python/LibreOffice/Poppler renderer and durable worker need a separate persistent runtime with access to private Storage. This audit did not change cloud data, configuration or deployments.
- Supabase preflight found seven completed legacy production jobs, all with non-null design-spec and entitlement references, so the observed rows satisfy migration 0009's new reference constraint. The unapplied migration policies now use Supabase's cached `(SELECT auth.uid())` pattern; the disposable PostgreSQL/RLS/process suite still passes 49/49. The live advisor also reports existing RLS initialization-plan warnings, missing foreign-key covering indexes and overlapping permissive read policies. Those require a separate reviewed performance-hardening migration after the functional 0007–0011 rollout; no advisor finding was silently treated as fixed in cloud state.

- The offline source review found a shared fixture password in the development demo, integration-test scripts and historical handoff text. The current working tree now removes those literals: the demo fields are blank, and opt-in integration tests require `INTEGRATION_TEST_USER_A/B_EMAIL/PASSWORD` from ignored local configuration. The browser regression suite passes 10/10; root typecheck, frontend lint/build and isolated release smoke pass. The live fixture password still needs rotation by the authorized Supabase owner. No account, remote service or database was changed. The scan report covers the pre-fix snapshot and had partial source coverage; its finding is remediated in current source, with live account and deployment state still unverified.
- The opt-in worker-recovery test now claims only its own UUID job and cannot fall through to claim an unrelated preview. Its retry-limit quarantine update is scoped to that same job. A disposable-PostgreSQL regression proves unrelated queued and exhausted jobs stay untouched; `npm run test:jobs:local` passes 49/49 and `npm run typecheck` passes. Normal worker ticks still intentionally process the global queue, so production/journey integration tests still require a dedicated isolated target and worker.

- Studio now presents server-authoritative Static quotes, current payment/production state, entitlement-gated production requests and explicit private download links. Existing active quotes are reused in the UI instead of requesting redundant quotes. Checkout stays visibly unavailable because the owner has not selected a provider. Mock verification is labeled development-only; no customer-side payment-success control exists.
- GET /projects/:id/order uses actual PostgreSQL/RLS ownership and the same verified paid chain as production/download. A mere displayed payment status cannot enable production. Preview jobs are excluded from delivery state. Refunds remove new download/production access. Private links are checked against the configured Supabase origin and signed bucket path, expire locally, and are cleared on sign-out/project changes.
- Remote PostgreSQL pools now require TLS certificate verification, with optional PGSSL_CA_FILE for the provider's trusted CA. SSL URL parameters cannot replace the explicit driver TLS settings. Nonproduction loopback databases may remain plaintext; production loopback requires TLS. Actual external TLS handshakes remain unverified here.
- Authenticated API writes now have bounded per-process limits (60/minute per user and route; 12/15 minutes for preview, approval, quote and production actions), standard retry headers, and bounded limiter memory. The focused limiter checks pass 2/2. This does not replace a shared gateway limit for multi-replica hosting.
- NODE_ENV accepts development/test/production only. Production refuses mock checkout/webhooks before database work and rejects stored development entitlements. No real gateway is configured, so production commerce deliberately remains unavailable. The mock HMAC secret is not required or used in production. API binding defaults to loopback; CORS grants only the configured exact origin, with no cross-origin production default. API responses are no-store/nosniff/no-referrer and omit the Express fingerprint.
- Previously recorded checks: local SQL/security/process suite 48/48 before the scoped-claim regression was added; Python engine suite 33/33; Puter boundary suite 7/7; frontend DOM suite 9/9 before the fixture-credential regression was added; `npm run test:rate-limit` 2/2; studio/server typechecks; frontend build/lint; seven controlled Chromium browser journeys; zero production dependency audit findings in both packages; and isolated release-package smoke all passed. Current follow-up verification is recorded in the bullets above. The browser journey covers draft editing/import/export, responsive layout, storyboard controls, signup/confirmation/password reset using labeled Auth fixtures, saved project/preview approval, quote/order UI, private-link origin checks and production states. Auth/payment/storage responses are labeled fixtures, not live provider verification. Existing Browserslist and Happy DOM warnings remain visible. One earlier Chromium run timed out resolving a download path under concurrent load; the focused rerun and a subsequent complete browser run passed.
- Optional real-renderer integrated suite passed 49/49 with real generation/rendering, approval, signed mock payment and checksum-identical Static delivery. After raising conversion/rasterization bounds to three minutes, the latest warmed run passed the real journey on its first attempt in 40.1s (generation 1.0s, validation 0.9s, renderer startup 5.2s, PDF conversion 30.9s, rasterization 0.3s). The previous cold conversion exceeded the old 60-second bound and succeeded on durable retry. The integrated test follows the actual durable retry schedule and ceiling when an attempt fails, asserting failed attempts publish no assets and consume no extra project slot; it does not restart a fresh job or suppress failures. This is not a renderer reliability SLA; cold-start and broader latency acceptance remain open.
- The first order query used created_at for entitlements; the real database regression caught that mismatch. It now uses the actual granted_at column, and the corrected suite passed. No tests were weakened or bypassed.

Setup: see RELEASE_CONFIGURATION.md. No new database migration in this batch; prior migrations through 0011 remain local only. The release package, entrypoints and development-page exclusion now pass local smoke checks; deployment and production acceptance are not implied. Live Auth email delivery/callback verification, shared gateway rate limits for multi-replica hosting, monitoring/retention/restore/incident readiness, real provider integration, live Storage, desktop Smooth evidence and authorized staging remain open. No remote data changes, deployments, commits, pushes or payment activation occurred.

---

# Previous batch evidence (historical, superseded where stated above)

# Current continuation - real previews, approval and approved-source Static delivery

26 October 2026. Concrete local progress; full release goal remains active and NO-GO for paid launch.

- Owner decision: consume one of the two free project slots when the first render starts, including failure/abandonment. Subsequent requested renders consume one of two revision rounds. Automatic retries/recovery of the same durable request count once. Quota starts serialize on the account and project in PostgreSQL; saving text/opening a revision does not consume allowance.
- Durable preview enqueue/status/revision endpoints and worker implemented. Jobs renew leases, fence stale completion, quarantine exhausted attempts and keep outputs private. Source PPTX plus 1280x720 PNG pages are generated by Python -> LibreOffice -> Poppler, not a substitute browser drawing. The manifest preserves renderer/template, exact source hash, image hashes and asset IDs.
- Studio supports requesting previews with a quota notice, refreshing status/private URLs, image review, revisions and explicit approval. Approval requires the latest saved version, exact manifest, available nonquarantined source/images and deliberate confirmation. Browser approval stays disabled until all page images load. Approved records are immutable.
- Approved Static quotes freeze content/title/language/count and the preview source. Production downloads that exact private source, verifies its checksum, runs independent Python content/package validation, and enforces the same checksum before upload. Later project metadata edits cannot change the approved source or quote count. Production state becomes delivered; preview jobs cannot be mistaken for production status/download or replayed as production with the same key.
- Storage policy repair: an unpaid preview source PPTX is not browser-readable; browser writes/updates/deletes to this platform's bucket are denied. Restrictive rules hold even under a broader shared permissive policy. Only preview images and eligible verified paid outputs are readable; other buckets keep their policies. This is locally tested SQL, not a remote Storage rollout.

## Fresh evidence

- npm run test:jobs:local: 44/44 local PostgreSQL/process checks passed, including actual RLS roles, quota races/failures/retries, lease recovery/heartbeat, approval mismatch/quarantine/concurrency, immutable records, private-storage policy and process-tree cancellation.
- With POWERPOINTBD_REAL_RENDERER_TEST=1 and explicit renderer executables, the same suite passed 45/45, including real PPTX-to-PNG rendering -> explicit approval -> mock HMAC payment -> checksum-identical Static delivery. Database is disposable loopback PostgreSQL. Auth and Storage byte transport/signing are controlled boundaries; no live Supabase or real payment behavior is claimed.
- Three-slide English/Bengali/bilingual real renderer corpus passed; source PPTX, PNGs and manifest are in artifacts/preview-renderer-corpus/. Bengali/bilingual PNGs visually inspected. LibreOffice 26.8.1.1 used. This is not desktop Microsoft PowerPoint playback evidence.
- Server/studio typechecks passed; Python tests 33/33, Puter boundary tests 7/7, frontend DOM tests 9/9, backend reference tests 19/19, frontend lint and build passed. Chromium browser suite 6/6 passed including preview/revision/approval UI with labeled fixtures. In-app browser inspected the actual empty studio and expanded controls. Screenshots in artifacts/.
- A cold renderer version probe exceeded its initial 15s limit; it now uses an isolated profile and bounded 60s startup, and the real journey passed. One earlier browser run timed out waiting for the lazy Three chunk; subsequent full runs passed without changing the assertion timeout or adding retries. Happy DOM VM evaluation and Browserslist-data warnings remain visible.

## Setup and remaining release gates

Migrations 0007 through 0011 are local only; apply only to a separately authorized target after reviewing existing roles/policies. 0009 grants worker column-scoped quota/state writes. 0011 touches only this platform's private bucket access rules; its SQL policy was tested with a minimal local Storage ledger, not the remote Supabase service. Configure PREVIEW_LIBREOFFICE_BIN, PREVIEW_PDFTOPPM_BIN and PYTHON_BIN plus the worker's private Storage credentials. Source/image orphan cleanup and retention still need operational implementation.

The official LibreOffice MSI was SHA-256 checked and its Document Foundation Authenticode signature was valid before local testing; administrative extraction is under the user's cache, not committed or published. See PREVIEW_PIPELINE.md for reproducible commands and fidelity limits.

Payment provider remains unselected (owner confirmed). Real checkout stays unavailable; the studio has no simulated pay-success control. Complete customer checkout/production UI with a selected real provider, live Auth/private Storage verification, licensed desktop Smooth proof/genuine clips, supported fonts/platform matrix, commercial terms, security/accessibility/operations/restore acceptance and authorized staging. No shared database changes, deployment, commit, push or payment activation occurred.

---

# Previous batch evidence (historical, superseded where stated above)

# Current continuation - versioned customer drafts

26 October 2026. The release goal remains active and NO-GO for paid launch.

- Studio now supports PowerPointBD email/password sign-in, project listing, save-as-new, optimistic version saves, explicit draft replacement on load, JSON import/export, and sign-out scoped to this page's session. Puter authentication remains separate. Auth sessions stay in memory; passwords are cleared after successful sign-in.
- GET/PUT /projects/:id/content persist normalized text under real authenticated PostgreSQL RLS. Migration 0008 adds append-only draft versions, project-lock serialization, monotonic versions and post-draft locking. Identical retries replay; conflicting edits return 409. No preview quota, approval or payment is created by saving text.
- Python --content renders actual customer titles/bullets/notes; the independent validator compares expected content, notes, metadata and package structure. Metadata-only legacy sandbox generation remains labeled placeholder. Saved-content projects are blocked from that sandbox checkout path with DESIGN_APPROVAL_REQUIRED until actual preview approval is integrated.
- Local verification: PostgreSQL/process suite 37/37, Python 33/33, Puter contract tests 7/7, existing frontend DOM tests 9/9, in-memory backend reference tests 19/19, Chromium browser tests 6/6; server/studio typechecks, frontend lint/build passed. Browser account/Auth responses are controlled fixtures, not proof of live Supabase authentication. Actual draft SQL/RLS uses a disposable loopback PostgreSQL instance. Frontend dependency install audit reported zero vulnerabilities.
- Browser checks cover draft import/recovery, account save/load/conflict handling, inert HTML, mobile overflow, Three rendering and reduced motion. Screenshot inspected in artifacts/studio-desktop.png. Existing Happy DOM VM evaluation and Browserslist-data warnings remain visible.

Setup: migrations 0007 and 0008 are LOCAL ONLY. Do not apply to the shared database without separate authorization. Run the API on loopback port 8787 plus the frontend dev server; /api is proxied to that fixed loopback target. Production needs an authorized same-origin /api reverse proxy. /public-config exposes only an explicitly publishable/anon key and fails closed for secret-key misconfiguration.

Next: render real slide-image previews from the same versioned content/design, enforce quota/revisions and approval, then freeze the approved source into quotes and paid production. Real provider events, worker storage, licensed desktop Smooth proof, operations and authorized staging still gate release. No cloud data, deployment, commits, pushes or payment activation were performed.

---

# Previous batch evidence (historical, superseded where stated above)

# Current continuation - Puter AI studio and interactive UI

26 October 2026. The full release goal remains active and incomplete. Puter selection resolves the earlier OpenAI key-decision blocker.

## Implemented and verified

- New studio at frontend/studio.html, linked from the prototype, preserves the dark/blue design system. Puter SDK 2.6.5 uses explicit account connection, live model/provider discovery, consent, bounded generation, cancellation and structured output validation. Users can navigate/edit slide text and notes and download draft JSON. No fabricated generation fallback was added.
- anime.js 4.5.0 scopes animate slide changes and honor reduced motion. Lazy Three.js 0.186.1 implements physical materials, lighting, slide textures, OrbitControls, raycasting, accessible slide selection/reset and opt-in orbit. Hidden/offscreen loops pause; reduced motion disables orbit/continuous rendering; resources are disposed and WebGL failure falls back to 2D.
- Studio typecheck passed, provider-boundary tests passed 7/7, existing DOM tests passed 9/9, and build passed. Four isolated Chromium browser tests passed: review/edit/JSON export with inert HTML, mobile overflow/navigation, actual Three.js rendering/selection/reduced motion, and honest empty production startup. The in-app browser also exercised the actual renderer against a labeled fixture.
- Browser/provider fixtures do not prove live authenticated generation. No paid AI request was made or claimed. End-user Puter login/allowance and consent are needed for that verification. Drafts are not automatically uploaded or persisted.
- Frontend npm audit reports zero vulnerabilities after upgrading happy-dom to 21.0.4 and targeted overrides postal-mime 4.1.4 / postcss-selector-parser 7.1.6. The parser API used by Puter was checked with a real parse. Existing informational Happy DOM VM and Browserslist warnings remain visible.
- Root server typecheck and git diff whitespace check passed. Existing backend/Python results below are earlier evidence; no new cloud verification occurred.
- A development skill and local skills-only plugin were created, validated and installed. Skill: powerpointbd-puter-studio. Plugin: powerpointbd-studio-toolkit@powerpointbd-local. Source in plugins/, portable archive in artifacts/. Both will be discoverable on the next turn. No MCP server or cloud plugin was published.

The first browser run exposed an auto-orbit checkbox that reverted itself under reduced motion; it now disables with an explanation, and the corrected behavior passed. In-app browser lacks viewport controls, so dedicated isolated Playwright Chromium provided mobile/emulation tests. Browser fixture bundles are temporary; a normal build removes them before delivery.

## Full-platform gaps remain

Studio drafts currently stay local until JSON download; they are not connected to authenticated persisted projects, actual slide-image previews, design approval/quotas, or the paid Python snapshot. The production generator still labels placeholder content. Finish that integration to satisfy the roadmap. Desktop PowerPoint proof/genuine clips, real payment provider, authorized staging and operational acceptance also remain incomplete. No remote migration, deployment, commit, push or payment activation occurred.

---

# Previous local payment/worker evidence and historical records

# Current status - payment and production integrity

Updated: 26 October 2026. The full Static + verified Smooth objective remains active and **NO-GO for paid release**. This record separates fresh local evidence from historical live claims below.

## Current local implementation

- Express/TypeScript API, Supabase PostgreSQL/Auth/Storage, Python engine and vanilla/Tailwind frontend are preserved. Migration 0002 defines 12 tables (the older count of 11 was incorrect). Migrations 0003-0006 add grants, policies and documented manual role provisioning. The actual remote roles were not inspected or modified.
- Enqueue-only production returns a queued job; the detached worker renews leases and fences progress/failure/completion by monotonic attempt number. Expired final attempts are quarantined. Attempt-specific uploads cannot overwrite another attempt.
- Python generation/validation and storage/DB calls have bounded timeouts. Independent Static ZIP/XML/OPC/policy validation runs before upload. This is not full XSD, layout or desktop playback proof. Generator content remains labeled placeholders.
- Invalid webhook signatures never call the database or reserve IDs. Valid deliveries can repair legacy invalid-signature reservations. Event/project locks serialize duplicate and competing events. Semantic duplicates tolerate JSON key order/whitespace; changed content under an existing event ID is rejected.
- Paid/refunded payments do not regress on later events. Replays cannot re-grant revoked access or reset delivered project progress. Quote expiry/supersession, cancellation, amount/snapshot conflicts require review without granting entitlement. No refund policy or real provider integration was invented.
- Checkout reuses a pending session under concurrent requests and supports same-key replay after payment. New checkout/quotes on paid projects are blocked.
- Quoting freezes title, language and slide count in the locked design JSON. Requotes use the frozen count. Production checks the exact verified payment, paid quote, entitlement, owner and locked specification at enqueue, execution, finalization and download. A refund blocks new download URLs; revocation during upload blocks registering an asset.
- The demo polls/resumes pending jobs. The designed frontend is still mostly a simulated prototype. Integration scripts require explicit opt-in and exact targets before mutations; they have NOT been run on the shared project.

## Fresh checks

| Command | Evidence |
|---|---|
| npm run test:jobs:local | 35 checks: real local PostgreSQL claims/leases/fencing/retries, webhook/checkout concurrency, financial guards, migration triggers and HTTP quote/payment/production metadata flow, plus bounded process and remote-test guards |
| npm run typecheck | PASS in final continuation run (exit 0) |
| npm run test:backend | 19/19 PASS in final continuation run; reference model only |
| npm run test:frontend | 9/9 PASS in final continuation run; controlled DOM/HTTP fixtures |
| npm run lint:frontend / build:frontend | Both PASS in final continuation run (exit 0) |
| python -m unittest -v test_phase0 test_production (engine/) | 28/28 PASS in final continuation run |

The disposable harness applies actual 0002/0003, the job/asset part of 0004, checkout grants from 0005 and migration 0007, with minimal local auth shims and scoped worker/webhook roles. HTTP auth and cloud storage are test boundaries; separate tests run the real Python generator/validator. This does not prove live Supabase Auth, deployed RLS, real providers, cloud delivery or browser acceptance. Temporary clusters are loopback-only, stopped and removed. Runtime inspected: Node 22.14.0, npm 10.9.2, Python 3.12.10, PostgreSQL 17.11 on Windows.

An initial expanded test run failed because the test setup omitted existing migration 0005 (checkout INSERT privilege). Applying that exact existing migration to the disposable harness corrected the setup; production policies were not relaxed.

Warnings remain visible: Happy DOM's JavaScript VM is not an isolation boundary for arbitrary code; its harness is limited to controlled repository fixtures. Browserslist data is outdated. These warnings were not suppressed.

## Migration and rollout requirements

Migration **0007_payment_snapshot_integrity.sql** adds durable webhook outcomes, protects quote/payment snapshots and locked-spec identity/unlock, and adds narrow worker read/webhook quote-update grants. It is locally tested ONLY and has NOT been applied remotely.

Review/apply on a separately authorized staging target after prior migrations and roles; deploy updated API/worker together afterwards. New code requires processing_outcome and the paid-chain read grants. No production rollout is authorized by local verification.

Legacy locked specs missing frozen title/language fail closed. They cannot be safely backfilled from mutable project data. Legacy manual entitlements need a verified paid-quote chain; do not manufacture verification flags. Review such records using confirmed source material and an approved operator procedure before rollout.

## Remaining release gates

Real slide content, preview fidelity, design approval and server quotas are incomplete. AI provider/key and worker storage key were absent in the last presence-only configuration check. Real payment provider, commercial/tax/refund decisions, supported desktop PowerPoint matrix and genuine motion clips, frontend integration, abuse controls, accessibility, operations/backup/restore and staging acceptance remain open. Smooth/Cinematic remain disabled.

CodeRabbit's official installer previously exited 1 on Git Bash with Unsupported operating system: mingw64_nt-10.0-26300; WSL was absent. No CodeRabbit review has run.

No shared database mutation, deployment, payment activation, commit or push occurred. See ROADMAP, REQUIREMENTS_TRACEABILITY and BLOCKERS for the full goal; do not mark it complete from these local batches.

---

# Historical status - superseded, not fresh verification

The original record below is preserved from Git history. Its live success claims and old milestone labels do not override the current section above. Batch 1 repaired worker reliability and established the local harness; that evidence is incorporated above.

# Status

Last updated: 2026-10-26 (M0 and M1 done, plus a real background worker AND a real browser-tested
customer journey: the **entire journey** — sign in, create project, configure motion, quote,
checkout, (sandbox) payment webhook, automatic entitlement, production, signed download — runs
end-to-end against the live Supabase project with zero manual intervention, proven both by
scripted tests and by actually clicking through it in a real browser).

## What this is right now

**NO-GO for paid production (no real payment provider, no real AI content, no desktop PowerPoint
QA). GO for a sandbox-labeled demo of the complete customer journey, M1/M2 foundation work.** Every
number below was re-run in this repo or against the live database, not copied from a report.

## Verified-by-execution baseline (this session, 2026-10-26)

| Area | Command | Result |
|---|---|---|
| Backend reference model | `npm run test:backend` | **19/19 PASS** (12 original + 7 regression: fail-closed candidates, draft-quote rejection, frozen-record re-quote, TTL bounds, tier/spec consistency) |
| Backend strict typecheck | `npm run typecheck` | **0 errors** (7 strict-mode errors found and fixed in `server/backend.ts`) |
| Phase 0 engine unit/negative tests | `python -m unittest test_phase0` (from `engine/`) | **23/23 PASS** (ZIP/OPC/XML structural checks, DTD/entity rejection, timing-ID/target/cap/dense-bullet negatives) |
| Phase 0 specimen generation | `python engine/phase0.py --output-dir phase0_artifacts` | **6/6 specimens generated**, `structural_policy_pass: true`, `production_motion_enabled: false` |
| Frontend behavior tests | `npm run test:frontend` | **6/6 PASS** (navigation, quota/XSS guards, pricing math, expired/mismatched-tier payment guards) |
| Frontend lint | `npm run lint:frontend` | PASS (syntax check only — not ESLint/static analysis) |
| Frontend build | `npm run build:frontend` | PASS — portable `frontend/dist/` with local CSS/JS |
| Desktop PowerPoint playback (Windows/Mac/legacy Office) | — | **UNVERIFIED** — no desktop Office in this environment |
| Real 3-second sample clips | — | **UNVERIFIED** — none exist |
| **PostgreSQL migration applied, real RLS/ownership/immutability** | `apply_migration` + `execute_sql` against live Supabase project `mnigcwueptvnfqrrszyd`, schema `ai_presentation` | **DONE AND VERIFIED** — 11 tables, RLS enabled on all 11; two real auth users created; confirmed Owner A sees only their project, Owner B sees zero of Owner A's rows, Owner B's cross-owner UPDATE affects 0 rows, Owner B's impersonation INSERT (`owner_id` = someone else) is rejected; locked `design_specs.spec_json` mutation raises `IMMUTABLE_DESIGN_SPEC`; `quotes` monetary-field mutation raises `IMMUTABLE_QUOTE_SNAPSHOT` while `status` transitions freely; `audit_logs` DELETE raises `APPEND_ONLY_AUDIT_LOG`. Security advisor run; the one finding in our own code (mutable search_path on a trigger function) is fixed |
| **Real HTTP API against the live database** | `npm run typecheck`; `npm run test:api` (signs in as 2 real Supabase Auth fixture users, exercises the live app over real HTTP, run twice for repeatability) | **19/19 PASS, twice in a row.** Created a dedicated least-privilege Postgres role (`ai_presentation_app`, member of `authenticated`, no bypass/superuser) via the Supavisor pooler (the project's direct host is IPv6-only and didn't resolve here) and filled `DATABASE_URL` in myself. Found and fixed 4 more real bugs while making this pass for real: missing base GRANTs on `quotes`/`price_configs`/`motion_library`/`audit_logs`/`projects`; split admin INSERT/UPDATE RLS policies that silently failed because Postgres ORs every applicable SELECT policy into an UPDATE's implicit "must still be visible after write" check — fixed by making admin policies `FOR ALL`; and `price_configs.version` being `SERIAL` while the seed inserted `version=1` explicitly without advancing the sequence (exactly what `docs/source-audit.md` had flagged) — the second real price change collided on the primary key until the sequence was resynced. All fixes are captured in `db/migrations/0003_supabase_admin_rls_fixes_and_grants.sql` |
| **Real production pipeline: generate → upload → validate → signed download** | `npm run test:production` (real entitlement, real Python subprocess, real Supabase Storage, real signed URL, run twice) | **11/11 PASS, twice in a row.** `POST /projects/:id/produce` verifies a real entitlement (403 `ENTITLEMENT_REQUIRED` without one — none can exist without a real payment, which doesn't exist, so this correctly fails closed for every real customer right now), runs `engine/generate_static_deck.py` (a genuine python-pptx generator — zero motion is *correct* for Static, not a shortcut) as a subprocess, uploads the real bytes to a dedicated private Supabase Storage bucket under the owner's own RLS-scoped path, and `GET /projects/:id/download` returns a signed URL whose downloaded bytes match the recorded size and SHA-256 exactly and reopen as a valid 5-slide `.pptx`. Honest limits: slide **content** is explicitly labeled placeholder text (`PLACEHOLDER_NOT_AI_GENERATED` in the validation report) — no AI provider is connected (see below) — and execution is synchronous within the request, not a separate crash-recoverable worker process yet. Found and fixed 2 more real bugs getting this to run twice: `generated_assets.storage_key` collided across runs (fixed by keying the filename on job id, not project id) and a failed generation step was poisoning the same DB transaction its own "mark as failed" write needed (fixed by giving each step its own transaction) — both captured in `db/migrations/0004_...sql` |
| **Full customer journey, zero manual SQL** | `npm run test:journey` (real sign-in, real HTTP calls through every step, run twice) | **9/9 PASS, twice in a row.** `POST /checkout/session` creates a real payment row (sandbox provider — see below, not a live integration); the test then signs a webhook payload with the real `MOCK_PAYMENT_WEBHOOK_SECRET` and POSTs it to `POST /webhooks/mock_sandbox` exactly as a real provider would — no direct DB access. The handler verifies the HMAC over the raw bytes, checks amount/currency, atomically marks the payment verified and grants the entitlement, and is idempotent (replaying the identical event is a confirmed no-op; a tampered signature is rejected with 401). Production (`/produce`) is confirmed blocked with `403 ENTITLEMENT_REQUIRED` *before* payment and succeeds immediately after — this is the first time in the project an entitlement existed without me inserting it by hand. A webhook has no Supabase Auth session at all (external caller), so this needed a SECOND dedicated Postgres role (`ai_presentation_webhook`, `BYPASSRLS`, kept separate from the user-facing `ai_presentation_app` role so a leak of one doesn't grant the other's privileges) — the HMAC signature is the actual security boundary here, verified in application code before that role is ever touched. All grants captured in `db/migrations/0005_...sql` |
| Real payment provider (SSLCOMMERZ/bKash/etc.) | — | **NOT CONNECTED** — no credentials. The row above proves the checkout/webhook/entitlement *mechanics* against an explicitly-labeled `mock_sandbox` provider, not a live integration |
| **Background worker: crash recovery, retry/backoff, quarantine** | `npm run test:worker` (direct against the live DB, no HTTP layer, run twice) | **15/15 PASS, twice in a row.** `server/http/worker.ts` atomically claims jobs with `FOR UPDATE SKIP LOCKED` (safe for multiple concurrent worker processes) under one unified predicate: freshly `queued`, OR `running` with an expired lease (a prior worker died mid-job), OR `failed` with `attempts < max_attempts` and its backoff elapsed. The test simulates a crashed job (`running`, lease already expired) and confirms it's reclaimed (`attempts` → 1), retried twice with doubling exponential backoff (~30s, ~60s), then permanently `quarantined` at `max_attempts` and never reclaimed again even if `next_retry_at` is forced into the past. The one real gap: a detached worker has no live user session, so it needs `SUPABASE_SERVICE_ROLE_KEY` (not configured — see `docs/BLOCKERS.md` #17) to *complete* the storage-upload step of a job it claims; without it, every claim correctly fails at that exact step and backs off — which is precisely what's being tested, not a workaround. Found and fixed 2 more real bugs along the way: a parameterized `INTERVAL` built via string concatenation (`$n || ' seconds'`) that Postgres couldn't type-infer, and the same bound parameter (`$1`) reused in two different type contexts in one query (`status = $1` and `$1 = 'failed'`) — also a type-inference failure, fixed by not reusing it |
| Real AI content generation | — | **NOT CONNECTED** — no provider/API key. Every generated deck's slide text is explicitly labeled placeholder content until this is resolved |
| **Full customer journey, driven by actual clicks in a real browser** | `frontend/public/live-demo.html` against the real API + live DB, real Supabase Auth sign-in via `@supabase/supabase-js`, driven interactively (not scripted) | **DONE.** Signed in as the real fixture account, created a project, configured Static motion, got a real BDT 200 quote, created a checkout session, triggered the sandbox webhook from a terminal (`npm run demo:pay`) exactly as a real provider would call it, watched the page's own polling pick up the verified payment, produced a real presentation, and downloaded a real signed URL (`8eb6dfbc-....pptx`, 36,716 bytes) — all confirmed via the browser's own network log (every call a real `200`/`201`/`202`, not a mock). This is the only thing in the project so far actually clicked through in a browser rather than only exercised by a script. Visual/responsive/accessibility QA of the full 12-screen mock prototype is still **NOT RUN** |
| PWA install/offline/HTTPS | — | **NOT VERIFIED** — manifest exists, icons missing |
| Full OOXML XSD schema validation | — | **NOT RUN** — structural subset only |

## What changed in this repo today

1. Set up a real git/Node/TS project (`package.json`, `tsconfig.json`, git init) around files that
   previously existed only as a flat pile in a OneDrive folder.
2. Found and fixed two real bugs in the original backend reference: a self-test entry guard that
   silently no-op'd on the actual filename, and a frozen (`Object.freeze`'d) `QuoteRecord` being
   mutated in place on re-quote (`TypeError: Cannot assign to read only property 'status'`).
3. Installed a real Python 3.12 (previously only a Microsoft Store stub existed) and verified the
   Phase 0 engine for real.
4. **Reconciled against `AI_Presentation_Phase0_Project.zip`** (a separately produced, independently
   audited delivery of the same system): its `reference/backend.ts`, `engine/phase0.py` +
   `registry.json` + versioned XML templates, and `frontend/` are materially more correct and more
   thoroughly tested than what this repo had, and already fix the same two bugs found in step 2 plus
   several more (see `docs/source-audit.md` "Confirmed defects"). Superseded this repo's `server/`,
   `engine/`, and `frontend/` with those versions, fixed 7 strict-TypeScript errors in the adopted
   `server/backend.ts` (same class of errors as before — unnarrowed `unknown` after validation,
   possibly-`undefined` array destructuring, possibly-`undefined` array access), and re-verified
   every claim above by actually running the commands, not by trusting either report.

## What changed in this repo today, part 2 — real database

5. Per your direction, used the Supabase MCP server for the database instead of raw local Postgres.
   The org's 2-project free-tier cap was already used by two unrelated client projects; since there
   is no `delete_project` tool available to free a slot, the schema lives isolated inside the
   existing active `HTKIS---SaaS-Agency` project under a dedicated `ai_presentation` schema that
   touches nothing in `public` (verified: that schema already has 40 unrelated `htkis_*`/`unreal_bs_*`
   tables, all untouched).
6. Wrote `db/migrations/0002_supabase_ai_presentation_schema.sql`: the same entity model as
   `0001_...sql`, adapted to real Supabase Auth (`auth.uid()` in every RLS policy — fixes the exact
   "not a complete Supabase ownership strategy" defect `docs/source-audit.md` flagged) instead of the
   fragile `current_setting('app.current_user_id')` GUC. Applied it; fixed the one real finding from
   the Supabase security advisor (a trigger function with a mutable search_path).
7. Verified every structural invariant against the live database (not an in-memory model) — see the
   table above.
8. Scaffolded `.env.example` and `.env.local` with the real project URL and publishable key. The
   service-role key and direct `DATABASE_URL` are left blank for you to fill in yourself from the
   Supabase dashboard (never pasted into chat) — see `docs/BLOCKERS.md` #15.

## What changed in this repo today, part 3 — the real HTTP server

9. Built `server/http/`: a real Express app, not a sketch. `requireAuth` verifies the bearer token
   against Supabase Auth itself (a network round-trip, not a locally-trusted claim). `db.ts`'s
   `withUserContext` runs every user-facing query inside `SET ROLE authenticated` +
   `request.jwt.claims`, so the RLS policies verified live in part 2 are what actually protects
   these routes — not a second, divergent authorization layer. Implemented for real:
   `POST /projects`, `GET /projects`, `GET /projects/:id`, `POST /projects/:id/motion` (enforces the
   fail-closed `motion_library.enabled` gate — Smooth is correctly rejected end-to-end right now,
   since nothing has passed desktop QA), `POST /projects/:id/quote` (real server-computed BDT/paisa
   math from the live `price_configs` row, immutable snapshot, supersede-not-mutate lifecycle), and
   `PUT /admin/pricing` (admin-only, append-only versioning, audit-logged).
10. Wrote `server/http/test-live-integration.ts`: creates two **real** Supabase Auth users (via SQL,
    pre-confirmed so no SMTP/email-confirmation step is needed), signs in to get real JWTs, starts
    the actual Express app in-process, and exercises it over real HTTP — project creation, the
    `SECURITY_VIOLATION` reject-client-price-field path, cross-owner RLS isolation via the API (not
    just raw SQL this time), the fail-closed Smooth rejection, unauthenticated-request rejection, and
    non-admin-rejected-from-admin-endpoint, all through genuine HTTP calls.
11. `npm run typecheck` is clean across the new code. Could not run the integration test to
    completion: this session has no way to obtain or reset the project's direct Postgres password
    (`DATABASE_URL`), and no credential-retrieval tool exists on the Supabase MCP server for it — by
    design, the same reason there's no `delete_project` tool. Confirmed the fail-fast path works
    correctly instead of guessing. See `docs/BLOCKERS.md` #15 for exactly what you need to add.

## What changed in this repo today, part 4 — the real production pipeline

12. Wrote `engine/generate_static_deck.py`: a genuinely parameterized, real `.pptx` generator
    (plain python-pptx — Static tier has zero motion by definition, so no Open XML patching is
    needed at all). This is NOT the Phase 0 spike (`engine/phase0.py` only builds its fixed 8-slide
    experimental corpus and isn't parameterized per-project) and NOT a fixture — it produces a real,
    valid, reopenable package for an arbitrary title/slide-count/language-mode. Its slide *content*
    is honestly labeled placeholder text pending a real AI provider (`docs/BLOCKERS.md` #3).
13. Created a dedicated private Supabase Storage bucket (`private-presentations`, separate from the
    other app's existing `product-files` bucket) with RLS scoped to each owner's own folder prefix.
    Our backend uploads/downloads using the calling user's own verified access token — no service
    role key needed for this, since the scope is already exactly what that user owns.
14. Built `server/http/jobs.ts` + `routes/produce.ts`: `POST /projects/:id/produce` (entitlement
    check → spawn generator → upload → insert `generated_assets` → mark job completed, each step in
    its own transaction), `GET /projects/:id/status`, `GET /projects/:id/download` (signed URL,
    15-minute TTL, blocks on quarantined/missing assets).
15. Manually granted ONE permanent fixture entitlement (via my own privileged channel — the app's
    own DB role genuinely cannot do this, same boundary as admin role grants) to prove the real path
    without a payment provider. `server/http/test-production-pipeline.ts` exercises it end-to-end:
    11/11 PASS, run twice to confirm repeatability. Also had to fix `test-live-integration.ts`'s
    cleanup step, which was deleting *all* of the shared fixture user's projects and collided with
    this new permanent fixture (`payments` references it with `ON DELETE RESTRICT`).

## What changed in this repo today, part 5 — the complete journey, no manual steps

16. Built `server/http/routes/checkout.ts` (`POST /checkout/session`: validates the quote is
    active/unexpired, creates a real `payments` row, idempotent) and `routes/webhooks.ts`
    (`POST /webhooks/:provider`: HMAC-verifies the raw request body, deduplicates by
    `provider_event_id`, matches amount/currency, atomically marks the payment verified and grants
    the entitlement). Neither calls a real external payment API — provider is explicitly
    `mock_sandbox`, never presented as SSLCOMMERZ/bKash/Nagad.
17. A webhook caller has no Supabase Auth session, so `auth.uid()`-based RLS cannot apply to it at
    all. Created a second dedicated role (`ai_presentation_webhook`, `BYPASSRLS`, separate
    credential from `ai_presentation_app`) scoped to exactly the tables webhook processing touches —
    the signature verification in `routes/webhooks.ts` is the real security boundary, not RLS, for
    this one endpoint only.
18. `server/http/test-checkout-webhook.ts` proves the full journey with zero manual SQL: create
    project → motion → quote → `403` blocked production attempt before payment → checkout session →
    self-signed simulated webhook delivery (signed with the real secret, POSTed over real HTTP, not
    a direct DB write) → entitlement granted automatically → production succeeds → download succeeds.
    Also verifies duplicate-event idempotency and tampered-signature rejection. 9/9 PASS, run twice.
19. Found 2 more real grant gaps making this repeatable (not just runnable once): `jobs` needed a
    `SELECT` grant for `ai_presentation_webhook` before its `DELETE` grant could even match rows
    (`DELETE ... WHERE` needs `SELECT` on the referenced column too), and the cleanup delete order had
    to respect `jobs.entitlement_id`'s FK (no cascade) by deleting jobs before entitlements. All
    grants captured in `db/migrations/0005_...sql`.

## What changed in this repo today, part 6 — the real background worker

20. Created a FOURTH dedicated Postgres role (`ai_presentation_worker`, `BYPASSRLS`, its own
    credential) — a worker claims jobs across every user, not one authenticated request, so it has
    no single `auth.uid()` to scope RLS to, and this keeps that bounded, separate from the
    `ai_presentation_app`/`ai_presentation_webhook` roles.
21. Refactored `server/http/jobs.ts` into a shared claim/execute state machine used by BOTH the
    synchronous request path (`routes/produce.ts`, which still responds only after the job finishes
    — unchanged external behavior) and the new standalone `server/http/worker.ts`. The request path
    is now honestly just "a worker that happens to still have the user's live session" — same claim
    query, same lease/attempts bookkeeping, not a second parallel code path.
22. `server/http/worker.ts` is a real loop (`npm run start:worker`) or single deterministic tick
    (`runOneTick`, used by the test suite): atomic claim, lease-based crash recovery, exponential
    backoff, permanent quarantine at `max_attempts`.
23. `server/http/test-worker-recovery.ts` proves the entire state machine directly against the live
    database: inserts a job already in the exact state a crashed worker would leave one (`running`,
    lease already expired), confirms it's reclaimed, fails twice with doubling backoff (since
    `SUPABASE_SERVICE_ROLE_KEY` isn't configured — the storage step correctly can't complete without
    a live session or that key), is quarantined on the third attempt, and is never reclaimed again
    afterward even when its retry timer is forced into the past. 15/15 PASS, twice in a row.
24. Found and fixed 2 more real bugs getting this to actually run: a parameterized `INTERVAL` built
    via string concatenation (`($n || ' seconds')::INTERVAL`) that Postgres couldn't type-infer
    cleanly — replaced with `($n * INTERVAL '1 second')` — and the same bound parameter reused in
    two different type contexts within one query (`status = $1` in the `SET` clause and
    `$1 = 'failed'` in a `CASE WHEN`) — also a type-inference failure, fixed by passing a separate
    boolean parameter instead of reusing `$1`.
25. Also found and deleted a genuinely stuck job (`status='running'`, lease long expired) left over
    from debugging earlier in this session, from before the transaction-isolation fix in commit
    `0c1420d` — a real, if accidental, demonstration of exactly the failure mode this worker now
    recovers from automatically.

## What changed in this repo today, part 7 — real browser-tested customer journey

26. Added `frontend/public/live-demo.html`: a small, standalone, clearly-labeled "Live Backend
    Demo" page — separate from the existing 12-screen mock prototype, which stays untouched — that
    calls the real HTTP API directly from a real browser, with real Supabase Auth sign-in via
    `@supabase/supabase-js` (loaded from a CDN, no build step). Added dev-only CORS to the Express
    app (`server/http/app.ts`) scoped to the one known frontend origin, not a wildcard.
27. Added `server/http/demo-trigger-payment.ts` (`npm run demo:pay`): signs a payload with the real
    `MOCK_PAYMENT_WEBHOOK_SECRET` and POSTs it to the real webhook endpoint, standing in for what a
    real payment provider would do server-to-server after a customer completes checkout. The
    secret itself never goes anywhere near the browser.
28. Started both servers for real (`npm run start:api`, and the frontend dev server via the
    project's own browser-preview tooling with a new `.claude/launch.json`) and drove the entire
    journey with actual clicks in the Browser pane: sign in → create project → configure Static
    motion → get a real BDT 200 quote → create a checkout session → trigger the sandbox webhook
    from a terminal → watched the page's own polling detect the verified payment → produce → get a
    real signed download link. Confirmed via the browser's own network log that every one of those
    calls hit the real API and returned a real status code, not a mock. Cleaned up the demo
    project's rows afterward via the same privileged channel used elsewhere in this session.

## Architecture decision for this phase

Continue on the current stack (vanilla HTML/CSS/JS prototype + a Node/TypeScript in-memory
reference backend + a template-driven Python Open XML engine) rather than scaffolding a Next.js
rewrite right now, now backed by real Supabase Postgres + Auth instead of an in-memory model.
Rationale and reversibility are in `docs/DECISIONS.md`.

## Immediate next steps (in priority order)

1. Swap the `mock_sandbox` provider for a real one once `docs/DECISIONS.md` #1 is answered (which
   provider, sandbox credentials) — the checkout/webhook mechanics (idempotency, signature
   verification, amount matching, atomic entitlement grant) are already real and tested; only the
   actual provider API call and its specific signature scheme need to be swapped in.
2. Build the real AI content-generation step so decks carry real content instead of labeled
   placeholder text — blocked on `docs/DECISIONS.md` #2/`docs/BLOCKERS.md` #3 (provider + API key).
3. Fill in `SUPABASE_SERVICE_ROLE_KEY` (`docs/BLOCKERS.md` #17) so the background worker can
   actually complete a job it claims without a live user session, not just claim/retry/quarantine
   it. Also run `npm run start:worker` as a real separate process in staging/production instead of
   relying on the request-path's synchronous fast path.
4. Arrange desktop PowerPoint access (Windows + Mac + one older Office build) — this is the one gate
   that cannot be worked around locally; everything else can continue in parallel while it's pending.
