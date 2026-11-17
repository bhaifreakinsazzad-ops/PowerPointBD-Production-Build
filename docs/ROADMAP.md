# Product development and release roadmap

**Prepared:** 26 October 2026  
**Status:** implementation is substantially underway; the local Static design-to-delivery slice is implemented and locally verified. Staging and paid-launch gates remain open. See [current evidence](STATUS.md) and the [investor MVP brief](INVESTOR_MVP_BRIEF.md).  
**Goal:** deliver a secure, usable AI presentation product that meets the supplied client addendum, then extend it when the remaining requirements and release gates are satisfied.

## Scope and evidence

The source is the client’s `Motion_Tier_Pricing_Model_Bangla_Final.docx`, an addendum rather than the original full project plan. Source requirements, recommendations and unresolved choices must remain distinguishable. The full plan may change scope, acceptance criteria and priorities; integrate it when supplied. Historical milestones below describe the intended work sequence; implementation status must be read from current evidence in `STATUS.md` and the requirement matrix, not from unchecked boxes alone.

Current repository: Express/TypeScript API and worker, Supabase Postgres/Auth/Storage, Python PowerPoint generation and experimental motion templates, and a vanilla HTML/CSS/JS frontend prototype. Preserve the existing stack unless a documented need and authorization justify a change. `docs/STATUS.md`, `docs/HANDOFF.md` and `docs/REQUIREMENTS_TRACEABILITY.md` include historical and sometimes conflicting status statements; reconcile them with code and fresh evidence before treating them as current.

**Product outcome:** a customer can create a presentation, review and approve actual static slide images, choose an eligible motion tier, see an itemized server-generated quote, pay through a verified provider, and receive a validated private PowerPoint file. The released MVP must support Static and Smooth; a Static-only internal or staging slice is an interim milestone, not fulfillment of the complete MVP.

## Client constraints to preserve

- Initial prices: Static BDT 25 per slide; Smooth adds BDT 11 per slide, total BDT 36. Rates are administrator-configurable, not hardcoded forever. Cinematic pricing is undecided.
- Smooth is the default customer preference; Static is the opt-out. Until motion is verified and implemented, explain its unavailability honestly and fail closed.
- Preview is static imagery; limit free previews to two projects per account and two revision rounds per project. Counting and recovery rules need clarification and must be enforced on the server.
- After design approval, offer an AI-curated list of 2–6 eligible transitions, one deck-wide transition, and Subtle/Standard/Dynamic intensity. Show real three-second recordings from desktop PowerPoint; do not substitute simulated samples.
- AI selects approved effect IDs only; timing and XML come from tested, versioned templates. Enforce at most five animations per slide and reduce animations above six bullets. Record choices per job.
- Compute prices on the server, snapshot quotes and design settings, verify payment and tier entitlement before production, and audit price changes. Existing quotes retain their rates.
- One post-delivery motion swap is free; further changes are paid add-ons. Tier changes require a free re-render and upgrades charge the difference; the downgrade refund policy remains open.
- Cinematic is deferred until Phase 0 passes, five paying clients are reached, and a price is approved. Do not sell unverified motion or infer that the gate is met.

## Working rules and dependencies

- Start locally and protect existing work. The existing Supabase environment is shared with unrelated projects; inspect the target and obtain authorization before remote migrations or other consequential changes. Do not deploy, activate payments, commit or push without authorization.
- Do not use secrets in client code, logs, documents or chat. Separate development, staging and production credentials and data. Live tests can create or alter remote data: inspect their effects and target before running them.
- Missing provider access does not prevent local contracts, interfaces and failure handling, but it prevents claiming a real integration or completed paid journey. Use explicit unavailable states; do not present fixtures as generated content, real payments or verified previews.
- Work can proceed in parallel conceptually: product and Static workflow, motion proof, and commercial decisions. Release gates remain independent. Sequence individual changes to preserve reviewability and avoid blocking work on choices that are not yet needed.

## Milestone 0 — Reconcile and establish a trustworthy baseline

**Purpose:** make subsequent work evidence-led and prevent rebuilding already functional pieces.

- [ ] Inventory the actual frontend, API routes, database migrations and policies, worker, generator, tests, configuration and deployment assumptions. Map each source requirement to code, test evidence, gap and owner.
- [ ] Reconcile stale status and traceability records; mark historical results with their dates and distinguish reference-model, local, live-database, browser and PowerPoint evidence.
- [ ] Inspect the shared database boundary and the exact side effects of integration tests before choosing a safe environment. Identify service accounts, privileges and credential requirements without exposing values.
- [ ] Run appropriate non-destructive local baseline checks: TypeScript, backend reference tests, frontend tests/lint/build and Python engine tests when dependencies are available. Record actual results and pre-existing failures. Run live tests only on an authorized, suitable target.
- [ ] Complete the requested CodeRabbit review when its supported runtime and authentication are available; the Windows installer previously failed and WSL was absent. A diff-scoped review does not by itself establish whole-codebase coverage. Track independently confirmed issues separately.
- [ ] Create a prioritized defect and dependency backlog, classify severity and user impact, and resolve any defects that block the first vertical slice.

**Exit:** a current requirement/implementation matrix, reproducible baseline and ranked backlog exist; unknowns and unverified claims are visible.

## Milestone 1 — Secure project and design workflow

**Purpose:** let a customer create and review a real project before payment.

- [ ] Reconcile project inputs, supported languages, slide counts, content sources, design families and user journeys with the missing main plan. Until then, implement only clearly agreed inputs without claiming the full intake scope.
- [ ] Establish account onboarding, sign-in, session recovery and ownership boundaries as required by the agreed product scope. Validate every project and asset operation on the server.
- [ ] Add a structured slide-content contract and validated AI-provider integration after a provider, budget and credentials are selected. Handle timeouts, invalid output and provider failure; protect untrusted user content. Preserve a visibly unavailable state when no provider is configured.
- [ ] Generate actual project slide previews from the same approved content and design inputs used for production. Choose a rendering approach after evaluating fidelity, dependencies, cost and Bengali typography; never imply a mock image is the real preview.
- [ ] Implement persisted preview generation, review, revisions and explicit design approval. Enforce quotas atomically per account/project, with documented behavior for retries, failures, concurrency and abandoned projects.
- [ ] Integrate the designed frontend with real authenticated APIs; provide loading, empty, failure and recovery states, keyboard access, and responsive layouts. Do not leave prototype-only controls looking functional.

**Exit:** an authorized user can create a project, generate real previews within enforced limits, revise and approve the design, and resume safely; unauthorized users cannot access another user's data. Verify the journey with representative desktop/mobile and failure-path tests.

## Milestone 2 — Static quote, production and delivery vertical slice

**Purpose:** complete a real presentation journey in a controlled environment before integrating live payment.

- [ ] Ensure production uses the approved, immutable content/design snapshot and creates real customer content, not placeholder slides. Validate Bengali and English text, fonts, overflow, images, charts and slide counts within the agreed scope.
- [ ] Reconcile server pricing, quote expiry, design locking, versioning, and administrator pricing/audit behavior. Display the same active pricing source used by quotes, with clear itemization and a compatibility statement.
- [ ] Ensure entitlement checks match the exact paid quote and design snapshot. Use sandbox payments only in development and staging until the real provider is verified.
- [ ] Complete a genuinely asynchronous production flow: enqueue, claim, lease, heartbeat or otherwise protect long jobs, retry safely, quarantine failures, monitor status, and avoid duplicate delivery. Verify the detached worker can finish using correctly scoped storage credentials.
- [ ] Validate package integrity, slide content and policy; quarantine failures and report useful errors. Deliver through private storage and authorized short-lived downloads; define retention and recovery.
- [ ] Integrate the complete Static flow into the customer interface, including quote, sandbox checkout, status, error recovery and download.

**Exit:** a real user-created Static deck completes from approved preview through sandbox payment and private download, with no placeholder content; security, concurrency, retry and failure cases are verified. This is not yet a paid launch or the full Smooth MVP.

## Milestone 3 — Desktop PowerPoint proof and Smooth MVP

**Purpose:** prove the animation behavior customers will receive, then integrate it without compromising the Static path.

- [ ] Agree the supported Windows, Mac and legacy Office versions, Bengali fonts and compatibility statement. Generate reproducible eight-slide Bengali/English Static and Smooth test decks.
- [ ] Test four transition candidates and four entrance candidates in licensed desktop PowerPoint; test Zoom separately and capture version, template hash, output, repair warnings, playback and layout evidence. Remove failed effects and leave untested effects disabled.
- [ ] Record genuine three-second slideshow clips for each approved style, with provenance. Measure Static versus Smooth production and QA time; finalize policy and templates from observed results.
- [ ] Resolve the source conflict: the short Smooth description mentions title/image while its role table also includes quote/closing. Agree the rule for reducing effects above six bullets and the intensity/timing interpretation.
- [ ] Implement the post-approval recommendation and selection flow using only available approved effects, one transition per deck, intensity and versioned policy. If fewer than two effects pass, resolve the conflict with the requested 2–6 choices before presenting the flow as complete.
- [ ] Integrate real Smooth generation into the production worker, validate policy/targets/packaging, log choices, and prevent unverified effects from reaching customers. Provide safe error and recovery paths.

**Exit:** every advertised Smooth effect passes the agreed desktop matrix with real clips; an approved, paid sandbox order produces and delivers the chosen motion correctly, with no unexpected clicks, repair prompts or policy violations.

## Milestone 4 — Commerce, revisions and administration

- [ ] Select a payment provider and confirm its current official integration contract, sandbox access, supported methods, fees, reconciliation and refund behavior. Implement server-to-server verification where applicable, signature checks, amount/currency/order matching, idempotency and out-of-order event handling.
- [ ] Test sandbox checkout success, failure, cancellation, expired quotes, duplicate/tampered webhooks, pending payment, retries and reconciliation. A redirect alone must never grant entitlement.
- [ ] Implement a durable post-delivery revision ledger and enforce one included motion swap; define and charge for further changes according to approved policy. Preserve original assets and audit changes.
- [ ] Implement tier changes, fresh quote and entitlement checks, free re-render and upgrade difference. Do not automate downgrade refunds until the refund policy and provider process are approved.
- [ ] Provide authorized administration for pricing, audited changes, job support and motion availability; verify current quote snapshots remain unchanged after configuration edits.
- [ ] Finalize pricing copy, revision terms, refund/cancellation rules, minimum order, tax and invoice presentation with the owner and accountant. Measure actual costs across 20 test decks and obtain feedback from three prospective clients; the addendum's cost ratio is an assumption, not a proven margin.

**Exit:** provider sandbox and end-to-end revision scenarios pass, finance-related policies are approved, and pricing/entitlement operations are auditable and resistant to replay and tampering. Production payment activation requires separate authorization and production verification.

## Milestone 5 — Release hardening and staging

- [ ] Verify tenant isolation, RLS and storage policies, admin authorization, abuse and rate limits, webhook security, upload constraints, secret handling and dependency vulnerabilities; fix confirmed issues by severity.
- [ ] Exercise functional, integration and end-to-end tests for core journeys, billing and recovery. Test representative mobile/tablet/desktop sizes, keyboard navigation, focus, contrast and screen-reader status messages.
- [ ] Complete PWA assets and installation checks if PWA delivery is confirmed; define offline behavior and avoid caching private presentations or payment data.
- [ ] Define hosting, environment separation, database migration/rollback plan, observability, alerts, backups and restore test, retention, support runbooks and incident handling. Obtain approval before remote changes or deployment.
- [ ] Deploy to an authorized staging environment, run a clean end-to-end journey with sandbox services, inspect operational logs, test failure recovery and document remaining limitations.
- [ ] Obtain explicit release sign-off against the agreed acceptance matrix. Confirm real payment provider, AI provider, accurate pricing/tax policy, desktop QA, private delivery, operational ownership and support are ready before paid production.

**Exit:** staging evidence and a go/no-go checklist demonstrate the entire agreed Static and Smooth MVP, including failure handling; deployment and production behavior are claimed only when independently confirmed.

## Milestone 6 — Cinematic and subsequent enhancements

- [ ] Confirm Phase 0 sign-off, the definition and evidence for five paying clients, an approved rate and unit economics before exposing Cinematic for sale.
- [ ] Build and validate click-triggered bullet builds, staged charts and emphasis effects using approved templates, with desktop compatibility and genuine samples. Add pricing, entitlement, revision and audit coverage.
- [ ] Consider slide-level overrides, international pricing and other enhancements only after requirements and commercial priority are agreed.

**Exit:** Cinematic has separate compatibility, pricing, entitlement and end-to-end acceptance evidence; otherwise it remains disabled.

## Decisions and access required at the appropriate gate

| Item | Needed for | Current approach until resolved |
|---|---|---|
| Original full project plan | Complete scope, inputs and acceptance criteria | Treat this addendum as partial scope. |
| AI provider, budget, approved content and privacy constraints | Real content generation | Explicitly unavailable; use fixtures only in controlled development. |
| Payment provider and sandbox credentials | Real checkout and payment validation | Sandbox mechanics only; no real charges. |
| Licensed PowerPoint on Windows, Mac and an agreed older version | Smooth proof and genuine clips | Keep effects disabled and label unverified. |
| Smooth role conflict, dense-slide rule and timing | Final policy | Existing experimental policy remains provisional. |
| Quote TTL, minimum order, swap definition, downgrade/refund policy | Commercial terms and revisions | Treat existing defaults as provisional, never as client approval. |
| VAT/BIN and invoices | Paid launch | Obtain accountant and provider advice; do not assume tax treatment. |
| Staging/production hosting, access and operational owner | Deployment and support | Continue locally; seek authorization for remote changes. |
| Worker storage credentials and appropriate roles | Detached worker completion | Configure securely in the selected environment; verify least privilege. |
| Preview limits, retries and abandoned-project counting | Fair, enforceable quotas | Specify before enforcing commercial limits. |

## Verification and reporting for every milestone

For each meaningful change: document the acceptance criteria, inspect existing behavior, make focused changes, run the relevant local checks and targeted regression tests, review the diff, and record actual outcomes. Use isolated and authorized environments for database, payment and provider tests. Record test commands, environment, limitations and evidence; never turn an unrun check or historical claim into a current pass. Escalate uncertain source interpretation instead of inventing requirements.

## First execution batch after approval to proceed

1. Perform Milestone 0: reconcile the requirement matrix with code, inspect test side effects and run safe local baselines.
2. Present the ranked confirmed defect backlog and select the smallest complete Static workflow slice that does not depend on unresolved provider or product choices.
3. Implement and verify that slice, maintaining explicit unavailable states for external capabilities and preserving the Smooth release gate.

No implementation, remote migration, live payment activation or deployment is authorized merely by this roadmap.
