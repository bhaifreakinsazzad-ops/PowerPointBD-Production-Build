# AI Presentation Platform
## Client Demand, Product Requirements & Implementation Research

**Source document:** *Motion Tier ও Pricing মডেল — প্রজেক্ট প্ল্যানের সংযোজন (Addendum), চূড়ান্ত সংস্করণ, ২৫ অক্টোবর ২০২৬*  
**Source reviewed:** Full 9-page document, including all tables and the `motion_policy` JSON example  
**Analysis date:** 26 October 2026  
**Purpose:** Translate the client’s stated motion/pricing requirements into an implementation-ready plan for an installable web application.

> **Scope warning:** The uploaded file is a 9-page addendum about motion tiers, pricing, production policy, and related backend changes. It references an original project plan (including “section 15”) that was not provided. This report fully analyses the supplied addendum, but it cannot confirm requirements that exist only in the missing original plan. Any additional feature or architecture proposed below is labelled as a recommendation or inference, not as a confirmed client requirement.

---

## 1. Executive assessment

The client wants an AI presentation platform that creates downloadable PowerPoint decks and sells motion as a transparent, controlled product option—not as an unpredictable custom service. The web application must let customers preview the slide design before committing to a motion style, understand the total price before payment, select a deck-wide transition from a short AI-curated list, and receive a PowerPoint file whose animation behaviour has been validated against tested templates.

The strongest product decisions in the addendum are:

- **Fixed pricing:** BDT 25 per slide for the base deck; Smooth motion adds BDT 11 per slide. Smooth therefore costs BDT 36 per slide in the stated MVP pricing model.
- **Low-friction default:** Smooth is the default; Static is an opt-out at the base price.
- **Narrow customer choice:** Customers choose one transition and one intensity level. AI chooses role-based entrance animations from an approved library.
- **Constrained generation:** AI may choose approved animation identifiers, but must never author animation XML. Timings and sequence structures come from tested templates.
- **Design before motion configuration:** The customer first approves static design images, then selects a transition and intensity, receives a final quote, locks the design specification, and pays.
- **MVP sequencing:** Static and Smooth first. Cinematic remains disabled until Phase 0 tests pass and the first five paying-client milestone is reached.
- **Server authority:** Price, tier entitlement, quote validity, and payment status must be verified on the server; client-supplied prices are never trusted.

**Main engineering conclusion:** Treat native PowerPoint motion as the critical technical proof—not as a routine slide-generation checkbox. The first milestone should be a real `.pptx` spike that proves the selected generator/template-patching approach in desktop PowerPoint on Windows and Mac. A syntactically valid OOXML package is necessary but does not prove the animation will play as intended.

**Recommended product delivery:** An installable **Progressive Web App (PWA)** with a responsive customer portal, server-controlled pricing and checkout, private project storage, and an asynchronous PowerPoint-generation/validation worker. An installable PWA is not the same as a downloadable Windows `.exe` or native desktop app; confirm that the client intends browser-based installation if native desktop functionality is expected.

## 2. Evidence boundary and interpretation rules

This analysis distinguishes three kinds of statements:

| Label | Meaning |
|---|---|
| **Specified** | Directly stated in the uploaded addendum. |
| **Recommendation** | An engineering/product recommendation to make the specified workflow secure and buildable. It is not automatically a client-approved requirement. |
| **Open decision** | The source explicitly leaves the decision unresolved or does not provide enough information. It must be answered before the affected part is considered production-ready. |

The source is dated 25 October 2026 and is titled as an addendum for an “AI Presentation Platform.” It is not a complete system specification. The addendum does not fully define the content-input workflow, AI content-generation behaviour, image provider, first design family, user roles, account/onboarding rules, full presentation editor, operational support model, retention policy, or the complete payment-provider contract. Do not infer those details silently from the motion/pricing appendix.

## 3. Product intent and customer journey

### 3.1 What the client is trying to achieve

The commercial strategy is to remove uncertainty from the purchase: customers see a static design preview first, see actual PowerPoint sample clips before choosing motion, and receive an itemised server-generated quote before payment. Fixed tiers avoid subjective “complexity-based” pricing disputes. The tier rules and motion-library restrictions also reduce rendering defects and support burden.

The product is **not** intended to expose a full animation editor. The addendum explicitly limits user control to choosing whether motion is needed (Static vs Smooth in the MVP), selecting one recommended transition after design approval, and setting intensity to Subtle, Standard, or Dynamic. AI owns the remaining animation choices within a tested policy.

### 3.2 End-to-end customer flow

1. **Start a project.** The complete input fields are not specified in this addendum and must be imported from the missing original plan.
2. **Choose motion preference.** Ask one question: “Motion needed?” Default is Yes/Smooth (+ BDT 11 per slide); No means Static, with no motion fee. Cinematic is not offered in the MVP.
3. **Generate a free static preview.** Preview consists of design images and contains no motion. The account/project preview limits must be enforced on the server.
4. **Approve the design.** The customer should be able to approve or use an allowed preview revision before motion configuration.
5. **Choose motion.** Show a curated list of 2–6 transition options recommended from the deck tone/design family; include real three-second screen recordings made from a desktop PowerPoint slide show. The customer chooses one transition for the whole deck and one intensity value. Static customers skip this step.
6. **Generate an itemised quote.** The server reads the active price configuration, calculates the total, records the quote breakdown and rate snapshot, and sets an expiry time.
7. **Lock the design specification.** Persist motion tier, transition, intensity, animation policy/version, slide count, design family, and any relevant generation settings. Production must use this locked snapshot.
8. **Pay.** Start checkout using the server-computed amount. Verify the provider callback/webhook and transaction status on the server. Do not unlock production merely because the browser returns to a “success” URL.
9. **Produce the PowerPoint.** The worker applies only approved effects and template-defined timing/sequence XML. It records the AI’s library selections and generation metadata.
10. **Validate and deliver.** Check package integrity and policy compliance; run PowerPoint compatibility tests. Deliver the `.pptx`, with a static PDF as an optional extra if selected/implemented.
11. **Revision or tier change.** Apply the defined included motion swap and tier-change policy. Upgrades charge the difference. The refund rule for downgrades is still open.

### 3.3 Suggested project state machine

**Recommendation:** Make project/payment/job status explicit rather than inferring progress from scattered booleans.

`draft → preview_queued → preview_ready → design_review → design_approved → motion_configured → quoted → payment_pending → paid → production_queued → producing → validating → delivered`

Side paths should include `preview_revision_requested`, `production_failed`, `revision_requested`, `cancelled`, `payment_failed`, and `refund_pending/refunded` if refunds are supported. Only permitted transitions should be available via the API. For example, a project must not enter `producing` while payment is unverified or while the quote is expired.

## 4. Functional requirements

| ID | Requirement | Status and implementation implication |
|---|---|---|
| FR-01 | Installable web application | **Recommendation based on the request.** Build a PWA with manifest, 192px and 512px icons, standalone display mode, HTTPS, responsive layouts, and a clear install/help flow. This does not create a Windows `.exe`. |
| FR-02 | Project input | Required by the overall product context, but the form fields and supported input sources are **not specified in this addendum**. Import them from the original project plan before finalising the form. |
| FR-03 | Motion default | **Specified.** Smooth is the default in the MVP; Static is available as an opt-out. The initial form asks only whether motion is needed. |
| FR-04 | Static preview | **Specified.** Free preview is static imagery; it must not imply that motion has already been rendered or validated. |
| FR-05 | Preview caps | **Specified initial values.** Maximum two free-preview projects per account and two free preview revision rounds per project. Enforce server-side. Define what happens when limits are exhausted. |
| FR-06 | Sample clips | **Specified.** One three-second clip per transition/animation style, captured from an actual desktop PowerPoint slide show, not a mock-up. Show samples before the customer commits to motion choices. |
| FR-07 | AI-recommended transitions | **Specified.** Recommend 2–6 options based on deck tone/design family and approved library availability. Initial transition IDs: `fade`, `wipe`, `push`, `zoom`. |
| FR-08 | One deck-wide transition | **Specified.** One transition applies to the whole deck; slide-specific overrides are postponed to a later phase. |
| FR-09 | Intensity control | **Specified.** Choose Subtle, Standard, or Dynamic in the same step as transition selection, after design approval. Static skips this step. |
| FR-10 | Role-based animations | **Specified.** AI selects effects by slide-object role using a controlled library and policy. No customer-level per-object animation editor in MVP. |
| FR-11 | No AI-authored animation XML | **Specified.** AI may return only approved IDs and policy-compliant choices. XML timing and sequence fragments must come from tested templates. |
| FR-12 | Animation limits | **Specified but needs a precise interpretation.** Maximum five animations per slide; reduce animations when bullet count exceeds six. Define counting and priority rules so this cannot conflict with title/image/chart roles. |
| FR-13 | Server-computed quote | **Specified.** Calculate from server-side slide count, active rates, and tier; expose a line-item breakdown. Never trust a price posted by the browser. |
| FR-14 | Price settings | **Specified.** Admin can change rates/configuration without code changes or redeploys. Changes affect new quotes only. |
| FR-15 | Immutable quote snapshot | **Specified.** Persist quoted rates and itemisation with the quote/payment so an admin price edit does not change an existing order. |
| FR-16 | Quote expiration | **Specified as a proposal, not a final value.** Source suggests 24–48 hours. Choose the exact TTL and define checkout behaviour after expiry. |
| FR-17 | Tier entitlement validation | **Specified.** Payment tier must match the locked design spec and entitlement before production; reject mismatches. |
| FR-18 | Webhook safety | **Specified.** Signature verification and idempotency are required. Use provider-side transaction validation where available. |
| FR-19 | Job audit log | **Specified.** Store which animation library IDs AI chose for every production job. Also recommended: policy version, template version, generator version, job attempts, and validation result. |
| FR-20 | Automated delivery validation | **Specified.** Verify that the file opens and XML is valid before delivery. **Recommendation:** add real PowerPoint playback checks for the supported effects; XML parsing alone is not sufficient. |
| FR-21 | Pricing explanation | **Specified.** Pricing page explains tier contents, included revision rounds, and the statement that motion is built for desktop PowerPoint. |
| FR-22 | Post-delivery motion swap | **Specified.** One free motion swap is included; further changes become paid add-ons. Define exactly what counts as a “swap.” |
| FR-23 | Post-delivery tier change | **Specified with one open policy.** Re-rendering is free; upgrades charge only the price difference. Refundability on downgrades must be decided and published. |
| FR-24 | Cinematic gate | **Specified.** Do not sell Cinematic until Phase 0 passes and the first five paying clients milestone is met. Confirm whether those five clients must be completed projects or any five paid orders. |
| FR-25 | Admin audit trail | **Specified.** Every price change logs who changed it, when, and old/new values. Recommended for other consequential actions as well. |
| FR-26 | BDT payments/tax invoices | **Open implementation dependency.** Source mentions bKash, Nagad, Rocket, gateway fees, and VAT/BIN handling, and asks that these be verified with an accountant/provider. Do not hardcode unverified tax rates. |

## 5. Motion-tier policy and exact rules

### 5.1 Tier definition

| Tier | Intended output | MVP status | Price treatment |
|---|---|---|---|
| **Static** | No transition and no animation. Intended for print/PDF-oriented customers or those who do not want motion. | In MVP | Base price only: BDT 25/slide at the initial rate. |
| **Smooth** | One deck-wide transition plus simple automatic entrance animations, according to role policy. | In MVP; default | Base + BDT 11/slide = BDT 36/slide. |
| **Cinematic** | Smooth features plus object-by-object build, presenter-click bullet progression, staged charts, and emphasis effects. | Later phase; must be disabled until gate passes | Separate extra per-slide rate is **not set**. Source’s rough estimate is 2–3 times the Smooth motion fee (BDT 22–33 extra/slide), making a provisional BDT 47–58 total per slide with the current base rate. This is an estimate, not a sale price. |

### 5.2 Allowed transition and entrance identifiers

- **Initial transition library:** `fade`, `wipe`, `push`, `zoom`.
- **Initial entrance library:** `fade`, `wipe`, `zoom`, `slide_in`.
- Keep transition IDs and entrance-effect IDs as separate typed fields even when an identifier appears in both lists. Their semantics are different.
- AI may select from the approved set; it must not invent an unknown ID, duration, direction, trigger, or XML node.
- The transition recommendation mapping (e.g., corporate → fade/push, startup → zoom/wipe) is illustrative in the source. A real mapping table and fallback behaviour still need to be implemented and tested.

### 5.3 Role policy from the source

| Role | Smooth | Cinematic |
|---|---|---|
| Title | Fade | Fade |
| Bullets | No animation | Fade; each paragraph builds on presenter click |
| Image | Fade | Zoom |
| Chart | No animation | Wipe from the left |
| Quote | Fade | Slide in from bottom |
| Closing | Fade | Fade |

**Source inconsistency to resolve:** The high-level Smooth tier summary says simple entrance animations for “title and image,” while the role table and JSON example also animate `quote` and `closing`. Before coding, the client must choose whether the role matrix/JSON example or the shorter tier description is authoritative. For implementation, use one versioned policy as the single source of truth.

### 5.4 Intensity settings from the source

| Intensity | Duration scale | Stagger value | Intended feel |
|---|---:|---:|---|
| Subtle | 0.8 | 80 ms | Restrained, formal motion |
| Standard | 1.0 | 150 ms | Default for most decks |
| Dynamic | 1.2 | 220 ms | More lively motion |

These values are starting estimates and must be tuned in PowerPoint. The addendum says stagger applies only to Cinematic after-previous sequences; it does not apply to Smooth, and the bullet build is click-triggered. Define precisely which Cinematic automatic object sequence uses `stagger_ms`. Also confirm whether transition duration is affected by intensity; the source defines a transition duration separately but does not explicitly say that intensity scales it.

### 5.5 Policy enforcement

Recommended production algorithm:

1. Classify each slide/object into a known role (title, bullets, image, chart, quote, closing, or an explicitly defined fallback role).
2. Load a specific `motion_policy` version, not an AI-generated policy.
3. Apply the selected tier, selected transition ID, intensity and design-level settings.
4. Map roles to approved animation template IDs and tested timing fragments.
5. Apply per-slide caps and a deterministic reduction/fallback policy.
6. Record every selected library ID and any reduction/fallback reason in `jobs.animation_choices` or an expanded job log.
7. Validate the resulting package and the generated animation references before a customer download is enabled.

### 5.6 XML and compatibility caution

PowerPoint stores slide transition information and in-slide animation timing in different PresentationML elements (`p:transition` and `p:timing`). Microsoft’s Open XML documentation explains this separation. A valid ZIP package or parseable XML can still behave incorrectly in a presentation application; validate both structural correctness and real slide-show behaviour. See Microsoft’s [Working with animation](https://github.com/OfficeDev/open-xml-docs/blob/main/docs/presentation/working-with-animation.md) and [Transition class reference](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.transition?view=openxml-3.0.1).

## 6. Pricing, quoting, revision, and commercial rules

### 6.1 MVP formula

Let:
- `N` = server-verified slide count
- `B` = `base_rate_per_slide` (initially BDT 25)
- `S` = `smooth_rate_per_slide` (initially BDT 11)
- `C` = `cinematic_rate_per_slide` (unresolved; Cinematic disabled while unset)

Then:

- **Static total:** `N × B`
- **Smooth total:** `N × (B + S)`
- **Cinematic total after approval of its rate:** `N × (B + C)`

The endpoint draft mentions design family as an input to quote generation, but the stated price formula is tier/slide-count based. Unless the client approves design-family price modifiers, design family should influence the design/motion recommendation—not silently change the price.

### 6.2 Source pricing examples

| Slides | Static at BDT 25/slide | Smooth at BDT 36/slide | Smooth motion line item |
|---:|---:|---:|---:|
| 10 | BDT 250 | BDT 360 | BDT 110 |
| 20 | BDT 500 | BDT 720 | BDT 220 |
| 30 | BDT 750 | BDT 1,080 | BDT 330 |

### 6.3 Quote UI and lifecycle

Show at least:

- slide count and design/package scope;
- selected tier and a concise “included/not included” explanation;
- base deck line item;
- motion line item, shown separately for Smooth;
- discount/tax/fees only if defined and applicable;
- total payable, currency, and quote expiry;
- revision allowance and PowerPoint compatibility note.

At quote creation, persist a snapshot of the active config (rates, currency, calculation version, slide count, tier, line items, total, tax treatment if any, creation time and expiry). Price changes apply to new quotes only. Expired quotes must be re-quoted; never quietly charge a new amount on an old quote.

**Money representation recommendation:** use integer minor units (paisa/cents where appropriate) or a decimal-safe money library; do not calculate monetary values using binary floating-point. If international pricing is added, keep currency-specific precision and do not convert BDT to USD using an unapproved hardcoded exchange rate.

### 6.4 Commercial rules to implement and clarify

- Free-preview limit: two projects per account; two revision rounds per project. Define whether rejected/cancelled/abandoned projects count against the limit.
- Quote validity: source suggests 24–48 hours; select an exact value.
- Minimum order: unresolved. Source suggests a minimum of 10 slides or a minimum order amount. Calculate the break-even point from measured support/payment costs before setting it.
- Motion revision: one free motion swap after delivery; define whether it includes transition changes, intensity changes, or both.
- Tier change after delivery: a re-render is free; an upgrade charges only the difference. Define the downgrade refund/no-refund policy before accepting payment.
- Cinematic rate: do not expose a buyable option until set, tested against measured production/QA costs, and explicitly enabled by an administrator.
- International pricing: USD rates are deferred and unresolved.
- Cost validation: source asks to measure average AI token cost, QA time and payment fees across 20 test decks. The 20–30% cost-to-revenue target for a 20-slide Smooth deck is an unvalidated rule of thumb, not proven financial data. Recalculate after the sample.

## 7. Data model and API contract

### 7.1 Fields explicitly requested in the source

| Entity | Source-specified additions |
|---|---|
| `projects` | `motion_tier_requested` — customer’s initial choice at input time. |
| `design_specs.spec_json` | `motion_tier`, `intensity`, `transition_id`, `animation_policy`. |
| `payments` | `tier`, `quote_amount`, `quote_breakdown` (base + slide count × motion rate). |
| `entitlements` | `motion_tier`; Smooth default, Cinematic only when an add-on is purchased/entitled. |
| `jobs` | `animation_choices` — log of AI-selected library IDs. |

### 7.2 Recommended additional data

These are engineering recommendations rather than source-confirmed tables:

- **`price_configs` / `price_config_versions`:** active rates, currency, min order, preview caps, quote TTL, enable flags, editor identity and timestamps.
- **`quotes`:** immutable quote snapshot, status, expiry, idempotency key and the exact pricing version used. Keeping quotes separate from payments improves traceability.
- **`payment_events`:** provider event/transaction IDs, validation state, signature/verification result, timestamps and idempotency keys. Store only the minimum data needed; do not store sensitive payment credentials.
- **`motion_library`:** effect ID, category (`transition` or `entrance`), supported versions/platforms, allowed roles, template version, test status and enabled flag.
- **`motion_samples`:** library ID, storage path, duration, app/platform used to record it, version and QA approval status.
- **`project_assets`:** private storage keys, asset type, owner/project, checksum, size, MIME type and retention status.
- **`audit_logs`:** append-only record for pricing edits, enable/disable events, entitlement changes, refunds and manual production actions.
- **`revisions`:** revision type, included/paid status, scope, request time and job relationship.

Protect every user-owned table and private file with access policies. Supabase documents that Storage access is designed to work with Postgres Row Level Security; use project ownership rules and signed URLs for private deck downloads. Never expose a service-role secret in browser code. Reference: [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

### 7.3 API endpoints

The source proposes two endpoints; the rest below are recommended to complete the workflow.

| Method and endpoint | Purpose and non-negotiable checks |
|---|---|
| `POST /projects/:id/motion` | Save transition and intensity before design lock. Validate ownership, allowed IDs, current tier, and project state. Reject motion settings for Static. |
| `POST /projects/:id/quote` | Calculate quote server-side from active config, verified slide count and selected tier; snapshot rates; return itemised total and expiry. |
| `POST /projects` | Create a project from the input schema defined by the missing original plan. |
| `POST /projects/:id/preview` | Enqueue limited free-preview generation; enforce account/project quotas and idempotency. |
| `POST /checkout/session` | Verify quote exists, is unexpired, unpaid, and owned by the user; create a provider checkout session using the stored quote amount. |
| `POST /webhooks/:provider` | Verify signature, validate the transaction server-to-server where available, ensure amount/currency/order match, and process idempotently. |
| `POST /projects/:id/produce` | Verify payment and entitlement tier match the locked design spec; enqueue a production job, not an unbounded synchronous HTTP render. |
| `GET /projects/:id/status` | Return authorised job/project status and safe progress messages. |
| `GET /projects/:id/download` | Authorise the owner, confirm delivered status, and issue a short-lived private download URL. |
| `GET/PUT /admin/pricing` | Read/edit configuration for authorised admins only; validate ranges and write an audit record. |
| `GET/PUT /admin/motion-library` | Manage tested IDs, sample clips, compatibility labels and enable flags; never allow untested IDs into production. |

### 7.4 Payment confirmation

SSLCOMMERZ’s official developer documentation describes a flow of creating a transaction session, receiving an IPN notification, and calling the order-validation API to validate the transaction before confirming it. If SSLCOMMERZ is selected, implement that server-side validation and idempotency rather than relying on a browser redirect. Confirm merchant eligibility, current method coverage, fees, settlement and refund behaviour directly with the provider before selection. Reference: [SSLCOMMERZ Developer Arena](https://developer.sslcommerz.com/).

The exact provider and whether the checkout is direct bKash/Nagad/Rocket or an aggregator are open decisions. Payment fees, local tax treatment and invoice fields must be verified with the provider and a Bangladesh accountant. The NBR’s VAT FAQ includes guidance on BIN and tax invoice fields, but it should not be treated as a substitute for checking the latest applicable rules for the actual business and supply. Reference: [National Board of Revenue — VAT FAQ](https://nbr.gov.bd/faq/vat-faq/eng).

## 8. Recommended application architecture

This is a build recommendation, not a stack requirement written in the addendum.

### 8.1 Application layers

1. **Customer PWA:** responsive Next.js App Router + TypeScript UI, forms, preview gallery, motion sample selector, quote, checkout redirection, order dashboard and download page.
2. **Server/API layer:** authenticated project APIs; central pricing service; quote and entitlement rules; payment-session creation; verified webhook handlers; admin-only configuration.
3. **Database and object storage:** PostgreSQL/Supabase for project metadata, quotes, payments, entitlements and audit logs; private object storage for previews, PPTX/PDF outputs and sample media with RLS/signed URL access.
4. **Job system:** durable asynchronous queue/worker for preview generation, AI calls, PowerPoint packaging, validation and re-render jobs. Start with a controlled worker and durable job table for a small MVP, or a managed queue as volume requires.
5. **Presentation generation engine:** selected only after the Phase 0 spike. Use controlled templates and a constrained OOXML patcher if the chosen slide-generation library does not natively support the exact animation features. AI returns structured choices only.
6. **Validation worker:** package/XML checks plus real desktop PowerPoint verification for supported effects. The validation process should produce a machine-readable report and block downloads for failed files.
7. **Admin console:** pricing values, Cinematic enable switch, motion-library test status, sample clips, job failures, refunds/tier corrections and audit logs.

### 8.2 Practical stack recommendation

- **Frontend:** Next.js, TypeScript, Tailwind CSS, accessible component primitives.
- **Auth/database/storage:** Supabase Auth + Postgres + private Storage with Row Level Security.
- **Worker:** separate Node.js or Python worker, selected around the chosen `.pptx` library and test runner. Do not assume a serverless request should synchronously generate and validate every deck.
- **Hosting:** PWA/UI/API can run on a web platform such as Vercel; keep long-running generation and any Windows/PowerPoint-dependent validation in an appropriate worker/runner. A June 2026 Vercel update notes extended function durations for some plans, but longer request timeouts do not replace durable jobs, retries, idempotency or an independently observable workflow. Reference: [Vercel function-duration update](https://vercel.com/changelog/vercel-functions-can-now-run-up-to-30-minutes).
- **PowerPoint engine:** no library should be approved merely because it can create a `.pptx`. PptxGenJS advertises programmatic text, images, charts and slide masters, but its public feature overview does not by itself establish that the exact native animation/timing requirements in this brief are supported. Prove the full chain in Phase 0 before locking the generator. Reference: [PptxGenJS documentation](https://gitbrent.github.io/PptxGenJS/docs/introduction/).

### 8.3 PWA behaviour and boundaries

The PWA should provide an app icon, standalone launch experience and clear installation guidance. Next.js documents manifest creation, service-worker setup, installation and related PWA concerns; MDN lists the manifest/secure-context considerations for installability. A service worker is useful for caching the application shell, but the source does not require offline PowerPoint generation. For the MVP, treat project submission, payment, generation and download as online operations; do not cache private decks or payment pages into a shared offline cache.

PWA install support differs by browser/platform: Chromium browsers support manifest-based installation on supported desktop OSes; Safari offers Add to Dock on supported macOS versions; Firefox does not provide the same manifest-based PWA installation flow. Provide browser-specific instructions and a normal responsive-web fallback rather than promising identical installation everywhere. References: [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) and [MDN: Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## 9. Security, reliability, and operational requirements

| Area | Required control |
|---|---|
| Pricing | Server-only calculation; decimal-safe arithmetic; immutable quote snapshots; quote expiry; range validation; admin-only edits; audit logs. |
| Payments | Signed webhook verification; provider transaction validation where available; compare order ID, amount and currency; idempotent event handling; duplicate/out-of-order event handling; never grant entitlement from a browser redirect alone. |
| Authorisation | Every project, asset, quote, payment and download must be scoped to the authenticated owner; role-protect admin APIs. |
| Storage | Private buckets for previews and outputs; short-lived signed download URLs; file size/type limits; safe filenames; retention/deletion policy. |
| AI output | Validate structured JSON against enums/schema; reject unsupported IDs and policy overrides; keep prompts and user content from changing the motion policy. |
| PPTX files | Validate ZIP/package entries, XML parseability, relationships, animation targets and allowed IDs; enforce resource/time limits; quarantine failed output. |
| Job processing | Durable job state, retries with ceilings, idempotent re-runs, timeout handling, failure reason and manual requeue. Avoid duplicate charges or duplicate entitlement grants. |
| Secrets | Keep model, storage, payment and admin secrets server-side; rotate credentials; separate sandbox and production secrets. |
| Abuse/cost control | Enforce free preview quotas and rate limits server-side; prevent repeated preview creation from bypassing quotas; set upload and generation limits. |
| Accessibility | Use keyboard-operable controls, visible focus states, labels, readable status updates and captions/text labels for preview clips. Follow WCAG 2.2 as a target baseline. |
| Audit/compliance | Log price changes and payment/entitlement adjustments; verify tax invoice obligations and data-retention requirements with qualified professionals. |

OWASP ASVS 5.0.0 is a suitable structured security-verification reference for the implementation and release checklist: [OWASP ASVS](https://asvs.owasp.org/). WCAG 2.2 is the current W3C accessibility recommendation referenced here: [W3C WCAG 2.2](https://www.w3.org/TR/wcag/).

## 10. Phase 0: required technical proof before building the full product

The addendum labels Phase 0 as week one. Its defined work should be treated as a release gate.

### 10.1 Required experiments from the source

1. Build an eight-slide test deck containing Bengali text; also produce the English counterpart.
2. Test all four transitions (`fade`, `wipe`, `push`, `zoom`) and four entrance effects (`fade`, `wipe`, `zoom`, `slide_in`) on desktop PowerPoint for Windows and Mac.
3. Test Zoom separately and run all effects in at least one older PowerPoint version. Remove any effect that breaks.
4. Record three-second clips from actual desktop PowerPoint slide shows for the approved transition/effect options.
5. Generate the same content as Static and Smooth and record time/cost for each.
6. Use the test results to finalise `motion_policy` and its JSON/schema.

### 10.2 Additional recommended checks

- Confirm the output opens without a repair warning and all media/relationships resolve.
- Verify the transition is applied to the intended slides; test the first slide separately because transitions are stored on the slide being transitioned to.
- Confirm Smooth entrance effects follow the intended trigger order and do not require unexpected presenter clicks.
- Measure how the maximum-five-animation rule interacts with title/image/quote/closing roles and bullet count.
- Test Bengali fonts, mixed Bengali/English text, line wrapping, punctuation and fallback fonts.
- Keep the generator version, template/policy version, OS, PowerPoint version, result and defect notes in a test matrix.
- Verify all three intensity settings visually and confirm whether their timing behaviour matches the product wording.
- Run a Static fallback if motion validation fails; do not silently deliver a broken animated file.

### 10.3 Suggested Go/No-Go criteria

These are **recommended acceptance thresholds**, not values stated in the source:

- 100% of effects advertised in the MVP pass the agreed Windows/Mac/version matrix or are removed from the enabled library.
- No generated file requires PowerPoint repair to open.
- No unapproved animation ID or XML template can enter the output.
- A failed validation blocks delivery and records an actionable error.
- Static and Smooth Bengali/English eight-slide test decks can be regenerated reproducibly from the same inputs/policy version.
- The observed time/cost data is recorded before locking Cinematic pricing and before treating the proposed cost ratio as validated.

### 10.4 Commercial validation in parallel

The source proposes sending the base price plus BDT 11/slide Smooth fee to the first three potential clients and asking whether Cinematic would be valuable. Record actual objections, willingness to pay, expected slide counts and requested motion variants. This customer feedback is separate from the technical five-paying-client gate for Cinematic; define how the two milestones relate.

## 11. Recommended build roadmap

The source explicitly references Phase 0, Phase 2, Phase 3 and Phase 5. The following adds a suggested foundation phase; treat that extra sequencing as a recommendation, not as a source-defined commitment.

| Stage | Scope | Exit condition |
|---|---|---|
| **Phase 0 — Technical spike** | Eight-slide bilingual decks; four transitions and four entrance effects; real PowerPoint sample clips; Static vs Smooth measurements; schema finalisation. | Generator/template approach and enabled library proven. Remove failed effects. |
| **Foundation — PWA and data** | PWA shell/installability, authentication, project records, private asset storage, admin access, job/status schema and initial design-family integration once the original plan is supplied. | Secure account/project skeleton with no public private files. |
| **Phase 2 — Motion UX** | Motion yes/no at intake; sample clips; design approval; AI-curated transition list; intensity selection; lock of design spec. | Complete customer flow works in Static and Smooth, including quotas and state validation. |
| **Phase 3 — Pricing/payment/production** | Server quote; itemised pricing; quote expiry/snapshots; provider checkout; verified webhook; entitlement check; Smooth production and delivery validation. | End-to-end paid order succeeds; tampered price/tier requests are rejected. |
| **Release hardening** | Security/accessibility tests, failure paths, admin controls, invoice/tax configuration after professional review, support workflow and monitoring. | Release checklist and rollback/recovery procedures pass. |
| **Phase 5 — Cinematic and advanced controls** | Set Cinematic rate after cost study; on-click bullet build; slide-level overrides; expanded library. | Phase 0 passes, first-five-paying-client gate is satisfied, new behaviour tested and price approved. |

## 12. Gaps and decisions required from the client

Resolve these before describing the requirements as complete. Some are explicitly open in the source; others are missing because the original main plan was not attached.

### Commercial / policy decisions

1. Set exact Cinematic price after the 20-deck cost study; keep it disabled until approved.
2. Choose the minimum order rule: minimum slides, minimum BDT amount, or both.
3. Set quote expiry exactly (24 or 48 hours, or another value based on the sales cycle).
4. Define refunds/downgrades, cancellations, failed generation after payment, payment retry and chargeback handling.
5. Define the boundary of one free motion swap and the price for later swaps.
6. Decide whether tier changes are allowed after delivery indefinitely or within a fixed period; define what “free re-render” includes.
7. Confirm international market, USD price table, tax/currency display, and exchange-rate policy.
8. Define the first-five-paying-client milestone: paid order vs completed delivered job; whether test/friendly clients count.

### Technical / product decisions

9. Supply the original project plan, especially the referenced section 15: image source, payment provider, launch language, and initial design family.
10. Confirm the product input types: user prompt, document upload, outline, existing PowerPoint upload, web URL, or another source. The addendum does not settle this.
11. Choose the supported PowerPoint baseline versions and decide whether Windows and Mac must both be supported at launch. The source says test both; that should become an explicit compatibility promise only after evidence.
12. Decide whether “installable web app” means a PWA or also a downloadable native Windows/macOS installer. They are different deliverables.
13. Confirm whether free preview requires account creation before the first preview; the per-account cap implies identity, but onboarding is not specified.
14. Decide whether preview output includes a PDF or image-only slide previews; a Static PDF is described as optional in the compatibility risk mitigation.
15. Confirm the first design family, image-generation provider, permitted image sources/licensing, and image failure fallback.
16. Define role-classification rules and fallback for objects that do not map cleanly to title/bullets/image/chart/quote/closing.
17. Resolve the Smooth tier role mismatch: tier summary vs role table/JSON for quote and closing effects.
18. Resolve the max-five animation cap vs one-by-one bullets and other role animations. Specify what is counted and the reduction priority.
19. Define exactly which Cinematic automatic objects use stagger timing; confirm intensity scaling of slide transitions vs entrance animations.
20. Select the presentation generator and XML/template patch strategy only after the Phase 0 spike.
21. Confirm payment provider(s), merchant approval, payment-method coverage, fees, webhook-validation contract, refunds and payout timing.
22. Confirm the accountant-approved invoice/VAT/BIN requirements and whether tax is included in listed prices or calculated separately.
23. Define retention and deletion policy for prompts, uploaded materials, preview images, final decks, payment metadata, and failed job artifacts.
24. Decide initial UI language(s), supported languages in generated slides, and fallback fonts for Bengali/English.

## 13. MVP acceptance checklist

A first paid launch should not be declared ready until all applicable items pass.

### Product flow

- [ ] Customer can create a project using the input workflow from the original plan.
- [ ] Motion question defaults to Smooth; choosing No selects Static.
- [ ] Preview output is static and free-preview limits are enforced server-side.
- [ ] After design approval, customer sees actual sample clips, selects exactly one allowed transition and one intensity, and can understand the result.
- [ ] Static customers are not forced through motion controls.
- [ ] Customer sees a complete line-item quote and expiration before paying.
- [ ] Design lock freezes the exact tier/transition/intensity/policy snapshot used by production.

### Pricing and payment

- [ ] Static = slide count × BDT 25 at initial rate.
- [ ] Smooth = slide count × (BDT 25 + BDT 11) at initial rate.
- [ ] Quote and checkout use the same stored quote snapshot; frontend-submitted prices are ignored.
- [ ] An expired quote cannot be paid at the old amount without a new quote.
- [ ] Webhook verification, provider transaction validation where available, amount/order matching, and idempotency pass test cases.
- [ ] Production cannot run on an unpaid order or when payment tier and locked design tier differ.
- [ ] Admin price changes are logged and apply only to new quotes.

### Production and delivery

- [ ] AI output is schema-validated and restricted to enabled IDs.
- [ ] Animation XML comes from tested templates; the model cannot author or override timing XML.
- [ ] Every job logs policy/template/generator version, animation choices and validation result.
- [ ] Invalid or incompatible output is blocked from download and can safely retry or fall back to Static.
- [ ] Download links are private and time-limited.
- [ ] Customer sees the target compatibility statement: “Motion is built for desktop Microsoft PowerPoint.”
- [ ] One free motion swap and tier-change rules are correctly enforced and explained.

### PWA, security and admin

- [ ] PWA manifest, icons, HTTPS and install flow are tested on agreed browsers/devices.
- [ ] Private project data/files are inaccessible across accounts; admin APIs require admin privileges.
- [ ] Secrets are server-only; upload types/sizes, quotas and rate limits are enforced.
- [ ] Pricing changes and manual entitlement/payment corrections are auditable.
- [ ] Keyboard navigation, labels, focus states, contrast and status announcements are tested.

## 14. Overall recommendation

Build this as a **PWA customer portal plus a server-authoritative production service**, but do not start the full implementation before completing the Phase 0 proof. The top risk is not the pricing calculator or the installable shell; it is reliably producing the precise native PowerPoint behaviour promised by the tier definitions. A disciplined template-driven motion library, immutable quote/design snapshots, verified payment events, and hard delivery validation are the core of the product’s credibility.

The immediate next actions are:

1. Obtain the missing main project plan and resolve the explicit open decisions above.
2. Run the eight-slide bilingual PowerPoint spike and document each passing/failing effect across the agreed Office versions.
3. Finalise one authoritative `motion_policy` schema and the generator/patcher approach based on real results.
4. Validate BDT pricing with 20 test decks and three prospective customers; set the minimum order, quote expiry, payment provider, and tax/invoice implementation only after verification.
5. Build the PWA workflow and backend around the validated generation contract, not around an unproven animation assumption.

---

## Appendix A — Source-to-requirement traceability

| Source location | Key content used in this analysis |
|---|---|
| Page 1, Sections 1–2 | Fixed tiers; default Smooth; BDT 11/slide; Cinematic later; tier definitions. |
| Page 2, Sections 3–4 | Customer sequence; static preview; sample clips; initial transition library; one deck-wide transition. |
| Page 3, Section 5 | Intensity values; role-based animation table; AI limits; five-animation limit; logging and validation. |
| Page 4, Section 6 | Pricing formula/examples; post-delivery tier/revision policy; Bangladesh payment/tax note; proposed cost study. |
| Page 5, Section 6.1 | Admin-controlled price settings, preview quotas, snapshots, quote expiry, audit logs. |
| Page 6, Section 7 | Server-side pricing/entitlement/webhook requirements; data fields and endpoint drafts. |
| Page 7, Section 8 | Draft `motion_policy` JSON, allowed IDs and sequence limits. |
| Page 8, Sections 9–10 | Risk mitigations; Phase 0 Windows/Mac/version testing; sample clips and bilingual deck. |
| Page 9, Sections 10–12 | Roadmap, next steps, final decisions and unresolved items. |

## Appendix B — External technical references

1. **Next.js — Progressive Web Applications guide** (updated 25 March 2026). PWA manifest, service-worker, installation and testing implementation guidance. https://nextjs.org/docs/app/guides/progressive-web-apps
2. **MDN — Making PWAs installable.** Manifest/HTTPS requirements and browser/platform installation behaviour. https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
3. **Microsoft Support — Compare PowerPoint features on different platforms.** Platform feature differences relevant to transitions, animations and triggers. https://support.microsoft.com/en-us/powerpoint/compare-powerpoint-features-on-different-platforms
4. **Microsoft Open XML documentation — Working with animation.** Explains PresentationML timing and transition structures. https://github.com/OfficeDev/open-xml-docs/blob/main/docs/presentation/working-with-animation.md
5. **Microsoft Learn — Transition class (Open XML SDK).** Slide transition semantics/attributes. https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.transition?view=openxml-3.0.1
6. **PptxGenJS documentation.** Programmatic PowerPoint generation capabilities; does not by itself establish support for this brief’s exact native animation requirements. https://gitbrent.github.io/PptxGenJS/docs/introduction/
7. **Supabase — Storage access control.** RLS and protected private-file access. https://supabase.com/docs/guides/storage/security/access-control
8. **SSLCOMMERZ Developer Arena.** Session creation, IPN and transaction-validation workflow. https://developer.sslcommerz.com/
9. **National Board of Revenue, Bangladesh — VAT FAQ.** Reference for BIN and VAT invoice considerations; confirm the latest applicable rules with a qualified accountant. https://nbr.gov.bd/faq/vat-faq/eng
10. **OWASP Application Security Verification Standard (ASVS) 5.0.0.** Structured security verification baseline. https://asvs.owasp.org/
11. **W3C — Web Content Accessibility Guidelines 2.2.** Accessibility target baseline. https://www.w3.org/TR/wcag/
12. **Vercel — Function duration update (15 June 2026).** Current execution-time capability context; not a substitute for a durable asynchronous worker design. https://vercel.com/changelog/vercel-functions-can-now-run-up-to-30-minutes

*Research boundary: Technical references were checked on 26 October 2026. Provider pricing, merchant eligibility, payment-method coverage, tax treatment, and Office-version compatibility must be verified directly in the final implementation context; this report does not claim those have already been contractually confirmed.*
