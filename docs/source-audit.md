# Source audit and implementation gate

Date: 26 October 2026 (Asia/Dhaka). Scope: the eleven uploaded files, inspected before new implementation. This report describes the uploaded baseline; later work must record its own fixes and tests separately.

## Release decision

**NO-GO for paid production. GO for a clearly labeled prototype and controlled Phase 0 experiments.** The existing HTML is a clickable simulation, the TypeScript service is an in-memory model, and the SQL has not been applied to a running database here. No PowerPoint decks, native-engine script, desktop playback evidence, genuine sample clips, authenticated deployment, or payment-provider integration accompanied the upload.

## Repository and source inventory

| Supplied item | What it actually contains | Treatment |
|---|---|---|
| `AI_Presentation_Platform_Requirements_Analysis.md` | Detailed requirements derived from an October 25 motion/pricing addendum; it explicitly says the original project plan is missing | Primary available product reference, while preserving its specified/recommended/open distinctions. Direct addendum was not attached |
| `Pasted text(20261025-235211).txt` | Execution instructions spanning audit, Phase 0, prototype, backend, and release review; backend request appears twice | Current work instructions; sequence through gates rather than building all phases at once |
| `PWA Architecture and Backend Design.md` | A prior conversation/plan with illustrative skeletons, questions, and proposed architecture | Planning context, not implementation or test evidence |
| Both `ai_presentation_platform_prototype_and_phase_0_workbench*.html` files | Same 2,305-line HTML/CSS/JS prototype, 12 customer/admin screens plus Phase 0 lab | Reuse one copy as an existing design/code target; correct misleading claims |
| `frontend_prototype_architecture_walkthrough_and_integration_guide.md` | Description of prototype features, future Next.js mapping and missing engine commands | Useful interaction checklist; executable claims require independent checks |
| `production_backend_implementation_schemas_and_automated_tests.ts` | Types, handwritten validation schemas, in-memory service methods, crypto helpers, twelve sequential self-tests | Reference/test fixture, not an HTTP server or durable production backend |
| `postgresql_schema_migrations_triggers_rls_and_seed_data.sql` | PostgreSQL DDL, sample RLS, triggers and seeded demo accounts/data | Unapplied migration candidate requiring correction and database integration tests |
| `api_specification_environment_configuration_and_external_dependencies_report.md` | API proposal, example environment variables, earlier claims of tests and package validation | Contract input, not evidence those operations occurred |
| C&F `.htm` and `.mhtml` | Saved customs/forwarding marketing page at `customsandforwarding.howtokeepitsimple.online`, with external and local asset references | Unrelated business content; no basis for importing claims, contact details or tracking into this presentation product |

The two prototype HTML files have the identical SHA-256 `2626f3378db52c1c16e66c5bcd6aa49e40983498c80ee91344c597bf54266935`. The C&F files are different archive formats, not byte-identical copies. No application package manifest, lockfile, TypeScript configuration, existing app Git repository, engine script, or generated `.pptx` was present in the uploaded baseline. The independently saved custom skill has its own Git repository; it is not an existing app repository.

The directly requested HTKIS HTML reference and original motion/pricing addendum are not among these eleven attachments. The existing prototype already records its HTKIS-inspired tokens and provides a usable code target. Do not treat the unrelated C&F website as a complete HTKIS product specification.

## Confirmed requirements and open decisions

“Confirmed” below means reported as specified in the available requirements analysis; the underlying addendum itself has not been independently read.

| Area | Confirmed behavior | Open or recommended detail |
|---|---|---|
| Pricing | Initial Static BDT 25/slide; Smooth BDT 36/slide comprising 25 base + 11 motion; Smooth default | Minimum order, VAT/fees, international prices; no unverified tax rate |
| Journey | Static preview → design approval → one deck-wide transition + intensity for Smooth → itemized quote → verified payment → production → private download | Final intake types and original section 15 missing |
| Preview limits | Two free-preview projects/account and two preview revisions/project | Identity/onboarding and exact consumption/reset rules |
| Motion | Candidate transitions fade/wipe/push/zoom; entrances fade/wipe/zoom/slide_in; AI selects IDs only; max five entrances/slide; reduce when bullets >6 | Role table includes quote/closing, short description only title/image; reduction priority and counting require sign-off |
| Intensity | Subtle/standard/dynamic scales 0.8/1/1.2; intensity does not add a fee | Transition scaling vs entrance scaling and baseline timings unconfirmed |
| Quotes | Server authority, immutable monetary snapshot, expiry, locked design | Exact 24 vs 48-hour TTL; 24h is a prototype default |
| Payment | Verified provider event/transaction, amount/currency/order match, idempotency | Provider, merchant credentials, actual signature/validation protocol, refunds |
| Revisions | One free motion swap; upgrades charge difference; free re-render per defined policy | Refund on downgrade, swap definition/window, later-swap price |
| Cinematic | Disabled until Phase 0 and five-paying-client gates | Price unset; milestone definition and cost study |
| Delivery | Validation, private storage, authorized expiring link, audit metadata | Supported Office baselines, retention/deletion, genuine clips |
| App | Responsive installable web direction | PWA recommended; no confirmed native `.exe` requirement |

## Confirmed defects in supplied baseline

| Priority | Evidence | Impact / required fix |
|---|---|---|
| Critical | TS `postProjectQuote`, line 925, assigns `existingQuote.status = 'superseded'`, but records are frozen at line 996 | Actual self-test aborts during the second quote in Test 5. Replace record for lifecycle status changes; freeze only appropriate snapshots |
| Critical | SQL motion seeds have `enabled=TRUE` and desktop status `UNVERIFIED_EXTERNAL_DESKTOP_REQUIRED`; TS seeds all four transitions enabled | Violates “no advertised effect enabled without compatibility tests.” Production allowlist must fail closed, separate from experimental candidates |
| Critical | TS `processBackgroundJob` creates fixed byte sizes and checksums from job IDs, then marks validation/delivery successful without writing/reading a deck | No generation or validation integration exists; must remain a mock and cannot authorize real customer delivery |
| High | TypeScript service stores every entity in `Map`/arrays and accepts an `AuthenticatedUser` argument | No JWT/session verifier, HTTP router, database transaction, durable queue, persisted idempotency, or storage authorization deployment exists |
| High | Payment sessions use invented `sess_` values and simulated checkout URLs; webhook only checks generic HMAC + JSON | No provider API call or provider-specific transaction validation. Labels resembling SSLCOMMERZ/bKash do not establish sandbox integration |
| High | Uploaded filename does not include `production_foundation_backend`; the direct-run guard checks that substring | Executing the actual uploaded filename exits successfully without running any self-test. Import and invoke the exported test explicitly |
| High | Prototype `runPhase0AllExperiments()` renders a lab and says “5/5 PASS”; report hardcodes `all_structural_validations_passed: true` | Browser illustration is not package evidence. Replace with real generated report data or label every result as simulated |
| High | Prototype “download bundle” calls `downloadCurrentSlideXml()` | It supplies a single XML fragment, not a PPTX. Download state must name the real artifact and never imply a customer deck exists |
| High | `postProjectQuote` accepts a draft project; reproduced 201 | Missing state/approval gate allows quoting without approved design |
| High | `postProjectMotion` updates spec but not `projects.motion_tier_requested`; reproduced Static selection retaining Smooth | Required project field becomes inconsistent with design/quote; update atomically |
| High | SQL enables RLS on `design_specs` and `audit_logs` but defines no corresponding access policies; auth context uses `app.current_user_id` | Not a complete Supabase ownership strategy. Verify grants, auth identity mapping and service-role boundaries with real roles; no RLS passes are claimed |
| High | SQL protects only `spec_json` while locked; lock flag can be changed independently. Payment snapshot has no equivalent immutability trigger | Database contracts need append-only/lock-transition enforcement, cross-entity consistency, and negative tests |
| High | SQL IDs are UUID while TS generates `qt_`, `pay_`, `spec_`, `job_` strings | Reference implementation cannot be wired directly to SQL without a unified identifier contract |
| Medium | Admin schema accepts negative `quote_ttl_hours`; reproduced `success: true` for -99 | Validate finite integer TTL bounds, optional Cinematic rate and boolean fields rather than coercing |
| Medium | Checkout and production deduplicate by supplied key without comparing complete request/project parameters | Same-owner key reuse for a different operation could return an unrelated result. Bind idempotency to actor + operation + request digest |
| Medium | Generic webhook processing does not bind the route provider to payment.provider or guard terminal verified/refunded states against later events | Add provider binding, unique transaction reconciliation, monotonic state handling and out-of-order tests |
| Medium | No manifest link/service-worker registration in prototype; external Tailwind CDN is required | Installation help is not installability. Bundle CSS and add real manifest/icons/secure-origin verification before PWA claims |
| Medium | SQL uses unconditional `CREATE POLICY`; hard-coded pricing version seed does not advance the serial sequence | Migration reruns can fail; future serial inserts can collide unless migration/version strategy corrects this |

These observations are source review and a few local reproductions, not an exhaustive security certification. No live credentials were found or used; embedded strings in the TS are demo defaults and must not become deployed secrets.

## Checks actually run in this audit

Host: Linux, Node v24.22.1. No `tsx`, `tsc`, `psql`, or `libreoffice` executable was found through `command -v` at audit time. Python has `python-pptx` and `lxml` as independently checked by the main session.

| Command/check | Result | What this proves |
|---|---|---|
| `sha256sum upload/*` | Completed; duplicate HTML hash above | Byte identity of the two prototype attachments |
| `node --experimental-strip-types upload/production_backend_implementation_schemas_and_automated_tests.ts` | Exit 0; no output/tests | Parses/runs module, but self-test guard skips suite under actual filename |
| `node --experimental-strip-types --input-type=module -e "import {runProductionFoundationTests} from './upload/production_backend_implementation_schemas_and_automated_tests.ts'; console.log(runProductionFoundationTests())"` | Exit 1, `TypeError: Cannot assign to read only property 'status'` at line 925, called by test line 1798 | Existing “12 passed” claim is not reproduced; sequential suite aborts during Test 5 |
| Import service; choose Static; inspect project requested tier | Output `smooth` | Required tier field is stale |
| Import service; set project `draft`; request quote | Output 201 | Missing quote state gate |
| Parse admin rates with TTL -99 | Output `true` | Optional TTL is not validated |
| Standard-library HTML parser | Found 13 sections, external Tailwind script, no manifest link; only one static `role=dialog` | HTML inventory only; dynamic dialogs and keyboard behavior still require browser QA |

Not run here: PostgreSQL migration, database RLS/grants tests, TypeScript static type check, lint, browser E2E/visual/accessibility audit, real gateway sandbox/live payment, actual storage download, deployed health, PowerPoint desktop playback, repair detection, Bengali font rendering or screen recordings. Later milestone reports must add their own actual results.

## Risk-ranked implementation plan

1. **P0: Establish evidence and fail-closed registry.** Generate real eight-slide bilingual specimens, deterministic templates and machine-readable checks. All candidates remain disabled for production until desktop sign-off. Preserve source files as inputs.
2. **P0 parallel: Repair prototype truthfulness.** Reuse existing visual target, bundle dependencies, clearly label simulations, remove hardcoded PASS claims and false PPTX download behavior. Verify required flows on mobile/desktop and keyboard.
3. **P0 external gate: Desktop compatibility.** Run Windows and Mac agreed versions plus an older baseline. Record no-repair opening, visual timing, first-slide behavior, Bengali conjuncts and real three-second samples. Disable any failed effect explicitly.
4. **P1 after spike: Correct contracts and isolated model defects.** Fix quote lifecycle, requested tier, state gates, identifier consistency and input validation; independently test important invariants. Keep fake gateway/storage/generator adapters distinct.
5. **P1: Integrate persistence/auth/private storage/durable worker.** Apply versioned migrations in a disposable database; real role tests, transactional ownership and immutable snapshots; recovery and idempotency under concurrency.
6. **P1: Integrate selected payment provider.** Read current official protocol, use real sandbox credentials and provider transaction validation. Reconcile duplicate/out-of-order events and amounts before entitlements. Configure tax only after owner confirmation.
7. **P2: Release verification.** Build/type/lint/tests, browser and PWA checks, deployed smoke tests, backup/restore and rollback exercise, retention/support procedures. Paid launch only after all critical gates pass.

## Proposed Phase 0 matrix

| Layer/environment | Specimens/coverage | Required evidence | Initial status |
|---|---|---|---|
| Linux automated generation | Same eight-slide bilingual content Static and four deck-wide transition candidates; entrance comparison specimens | Generated files, generator/template/policy versions, hashes, timings | To be run by Phase 0 milestone |
| Package inspection | ZIP integrity, OPC relationships, content types, slide order, shape targets, timing IDs/triggers, animation caps and >6-bullet rule | Machine-readable validation and negative mutation tests | To be run |
| Windows desktop PowerPoint | All four transitions and four entrances, all intensity settings; first slide separately | Exact OS/Office build, no repair, trigger/timing notes, genuine 3s clips | UNVERIFIED |
| Mac desktop PowerPoint | Same effects/content/intensities | Exact OS/Office build, Bengali font/wrapping, clip and defect references | UNVERIFIED |
| Older supported PowerPoint | Owner-agreed version; test all effects, especially zoom | Exact version and explicit pass/fail per effect | UNVERIFIED |
| Economic comparison | Static vs Smooth generation/validation time, output size, QA effort and cost | Measured local timings; manual minutes/infrastructure cost left unknown until measured | Not yet measured |

Package/XML parsing is not ECMA-376 schema conformance or proof of PowerPoint playback. Genuine clips cannot be manufactured from browser CSS or generated video. Manual QA acceptance: opens without repair; all eight slides present; Bengali/English text readable; one intended transition throughout; entrances target correct objects; automatic Smooth requires no unexpected clicks; max five entrance effects; dense-bullet suppression matches agreed policy; no orphan hidden objects; Static has no motion; save/reopen remains sound.

## Traceability checkpoint

| Requirements | Available baseline | Gate |
|---|---|---|
| FR-01 PWA | Help modal, no manifest evidence | Manifest/icons + secure-origin/browser checks |
| FR-02–05 intake/default/static preview/quotas | Clickable mock data and counters | Final input contract + server quotas |
| FR-06–12 sample/motion/role/caps | Candidate enums, illustrative CSS/XML and policy | Actual specimens + desktop matrix; resolve role conflict |
| FR-13–16 pricing/snapshot/expiry | In-memory model; frozen-quote defect | Correct tests + transactional database |
| FR-17–19 entitlements/webhooks/job audit | Mock HMAC and synchronous job simulation | Provider verification, durable audit/job integration |
| FR-20 delivery validation | Hardcoded validation and fake metadata | Actual generator/validator/private file gate |
| FR-21–23 pricing/revisions | Prototype explanation and simulated swap/upgrade | Confirm policy and enforce it server-side |
| FR-24 Cinematic | Disabled initial config | Desktop gate + five-client milestone + approved price |
| FR-25 audit trail | Append-only SQL trigger candidate and in-memory array | Real privileges/persistence and recovery tests |
| FR-26 tax/payments | Unconfigured proposals | Provider + accountant/owner confirmation |

Suggested API/data contracts are in `contracts.md`. Later implementation evidence must supersede—not silently rewrite—this baseline audit.

## Corrected reference milestone

Separate corrected copies are provided in `reference/backend.ts` and `reference/schema.sql`; uploaded originals remain unchanged. These are **in-memory demonstration/reference code and an unapplied migration candidate**, not a production backend. The original worker still uses simulated outcomes/asset fixtures and no actual provider or storage integration. All its old pass descriptions refer only to model behavior.

Applied corrections:

- Replace frozen quote records to supersede lifecycle status while preserving the immutable monetary snapshot.
- Block quote requests before design approval/configuration.
- Update `projects.motion_tier_requested` together with motion spec selection.
- Validate integer quote TTL 1–168 hours, optional Cinematic rate bounds and actual boolean flags.
- Disable all untested transition candidates by default and reject direct quotes that would bypass the candidate gate. SQL defaults and all eight seeds are disabled and structural status is `UNVERIFIED`.
- Replace filename-dependent implicit execution with an explicit `reference/test-backend.mjs` runner. Existing tests explicitly enable experimental effects inside their fixture only; this is not desktop approval or a production enablement.

Actual command: `node --experimental-strip-types project/reference/test-backend.mjs`.

Result: **19 in-memory model tests passed**: the original 12 sequential model cases now complete, plus seven regression cases covering fail-closed candidates, direct-quote bypass rejection, requested tier consistency, draft quote rejection, frozen-record re-quoting, invalid TTLs and Cinematic optional types. Full console output: `reference/test-results.txt`. No database migration, RLS integration, HTTP authentication, gateway transaction, durable worker, storage delivery, actual PPTX generation through this adapter, static TypeScript check, lint or deployment was tested by this command. Those remain gates.

Known follow-up defects listed in the baseline table—such as UUID integration, incomplete RLS/lock transitions, provider binding and durable state—remain deliberately outside this Phase 0 reference repair. Do not use the passing model suite as release approval.

## Custom skill forward-test observation

Used the new `build-ai-presentation-platform` skill and its product contract against these raw attachments. Its instruction to treat descriptions as claims rather than proof led to explicitly invoking the exported self-test instead of accepting the successful no-op module execution, checking enabled seeds against desktop status, and identifying mocked assets rather than real generation. The skill's gate sequence and required-field list were sufficient for the audit, proposed contracts, and focused repairs. No hidden expected answer or production state was needed. Suggested future refinement: include the explicit-runner/no-op trap as an optional audit heuristic; it is a generalizable warning, not a mandatory expected bug.
