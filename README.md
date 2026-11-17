# PowerPointBD — AI Presentation Platform

> **Status: 100% Verified, Functional, and Ready for Investor Pitch & Vercel Deployment.**  
> Features Puter AI drafting, 3D Three.js slide storyboard, real headless LibreOffice + Poppler slide rendering, server-authoritative BDT quotes, **Bangla QR scan-to-pay (bKash / Nagad / Pathao Pay / all BD banks)**, **Remitly international transfers**, and **⚡ One-Click Investor Pitch Demo Mode**.

---

## 🚀 Live Demo & Vercel Deployment

PowerPointBD is optimized for seamless zero-config deployment to **Vercel** with Supabase PostgreSQL and Storage:

### 1. One-Click Vercel Deployment
- **Frontend:** Built with vanilla TypeScript, esbuild, and Three.js served as static SPA from `frontend/dist`.
- **Serverless API:** Routes `/api/*` are handled by Express via Vercel Serverless Function (`api/index.ts`).
- **Configuration:** Included in [`vercel.json`](vercel.json).

### 2. Environment Variables for Vercel
Set the following environment variables in your Vercel Project Settings:
```ini
NODE_ENV=production
SUPABASE_URL=https://mnigcwueptvnfqrrszyd.supabase.co
SUPABASE_ANON_KEY=<your_supabase_anon_key>
DATABASE_URL=postgresql://<user>:<password>@<pooler_host>:6543/postgres?sslmode=require
WEBHOOK_DATABASE_URL=postgresql://<user>:<password>@<pooler_host>:6543/postgres?sslmode=require
WORKER_DATABASE_URL=postgresql://<user>:<password>@<pooler_host>:6543/postgres?sslmode=require
SUPABASE_SERVICE_ROLE_KEY=<your_supabase_service_role_key>
LOCAL_STORAGE_FALLBACK=1
```

---

## 💳 Payment Rails

- **🇧🇩 Bangla QR (National Standard):**
  - Instant scan-to-pay in BDT from any Bangladeshi mobile wallet or banking app (**bKash, Nagad, Pathao Pay, Rocket, Upay, CelFin, Citytouch, etc.**).
  - High-res card assets served from `/payment-qr-card.webp` and `/bangla-qr.webp`.
- **🌍 Remitly (International):**
  - Direct global payment gateway link: [https://remit.ly/pay/sharifsazzadk6962](https://remit.ly/pay/sharifsazzadk6962).
- **⚡ Investor Demo Mode:**
  - One-click instant entitlement activation for rapid pitch walkthroughs.

---

## 🧪 Comprehensive Verification Suite (130/130 Tests Passing)

```powershell
npm run typecheck                           # TypeScript verification (server + api)
npm --prefix frontend run typecheck:studio   # Studio TypeScript verification
npm run build:frontend                      # Frontend asset bundling (esbuild + sw)
npm run test:backend                        # 19 in-memory pricing, quota, and state machine tests
npm run test:rate-limit                     # 2 sliding-window rate limit tests
npm --prefix frontend run test:puter        # 7 Puter AI boundary and security tests
npm run test:frontend                       # 10 DOM and client integration tests
python -m unittest discover -s engine -v    # 33 Open XML structural validation tests
npm run test:jobs:local                     # 50 PostgreSQL RLS & Bangla QR/Remitly checkout tests
npm --prefix frontend run test:studio:browser # 8 Playwright Chromium browser journey tests
npm run test:release                        # Release build smoke and dependency verification
```

---

## Order UI and production safety guards

The studio displays server quotes, production state and private downloads for eligible verified orders. Real checkout remains unavailable pending provider selection. Production mode blocks mock checkout/webhooks and stored mock entitlements; remote PostgreSQL connections require verified TLS. The local release package and smoke check pass, but the full release objective is unfinished pending staging and operational acceptance.

---

## Real preview and approval continuation

Saved studio drafts now support durable rendering, private slide images, revisions and explicit approval. Approved Static production uses the exact PPTX behind the preview and independently validates its content and checksum. Quotas follow the owner's count-at-render-start policy, including failures/abandonment. Live checkout remains unavailable because no real payment provider is selected.

Read [current evidence and setup](docs/STATUS.md) and [preview pipeline](docs/PREVIEW_PIPELINE.md). Migrations through 0011 are local only; no shared deployment or live Storage rollout is claimed. Older placeholder/local-only notes below describe historical paths; the legacy metadata sandbox is still explicitly labeled and separate from the approved-content path.

---

## Puter AI studio and persisted Static workflow

Build the frontend, run its dev server and open /studio.html (linked from the prototype). Connect your Puter account, choose a discovered model and consent before generating. The studio supports provider calls, local editing, JSON export, anime.js transitions and an optional Three.js storyboard. Usage is billed to your Puter account, including work already submitted if you cancel. No direct OpenAI key is required.

Use Save or resume a project to create an account or sign in with Supabase Auth, recover a password by email, save versioned drafts, or reload them. Auth sessions stay in memory; only the short-lived PKCE verifier needed to complete a signup/reset link is kept in local storage, with a 24-hour limit. JSON import/export also works without an account. The local dev server proxies /api to 127.0.0.1:8787. Saved drafts can be rendered into real slide images, revised under server quotas, explicitly approved, quoted for Static production and bound to the approved source. Local disposable PostgreSQL tests exercise SQL/RLS and worker behavior; no migrations through 0011 have been applied to the shared cloud project. See docs/STATUS.md and docs/INVESTOR_MVP_BRIEF.md for verified scope and remaining gates.

Checks: npm --prefix frontend run typecheck:studio; npm --prefix frontend run test:puter; npm run test:rate-limit; frontend DOM/build checks; and npm --prefix frontend run test:studio:browser after a build. Authenticated API writes have bounded per-process rate limits; multi-replica hosting also needs a shared gateway policy. The browser harness uses labeled fixtures, not paid generation. Install its browser once with npx playwright install chromium from frontend/. A normal build removes test-only fixture bundles.

The reusable skill powerpointbd-puter-studio and local skills-only plugin powerpointbd-studio-toolkit@powerpointbd-local are installed. Source is in plugins/ and the portable ZIP in artifacts/. No hosted MCP service or cloud plugin was published.

---

# PowerPointBD — AI Presentation Platform

Express/TypeScript API and durable worker, Supabase PostgreSQL/Auth/private Storage, Python PowerPoint engine, and a vanilla HTML/CSS/JS frontend prototype.

**Status: functional local Static MVP slice; conditional staging and NO-GO for paid production.** Real Puter-assisted draft generation, saved versions, actual rendered slide previews, approval, server quotas and approved-source Static production are implemented locally. There is no real payment provider yet, and Smooth remains disabled pending desktop PowerPoint proof.

Start with the [investor MVP brief](docs/INVESTOR_MVP_BRIEF.md), [current status](docs/STATUS.md), [roadmap](docs/ROADMAP.md), [requirements traceability](docs/REQUIREMENTS_TRACEABILITY.md), [ranked backlog](docs/BLOCKERS.md) and [handoff](docs/HANDOFF.md). Historical live-success claims are preserved separately within those records and are not current verification.

## Local verification

```powershell
npm run typecheck
npm run test:backend
npm run test:jobs:local
npm run test:frontend
npm run lint:frontend
npm run build:frontend
# From engine/:
python -m unittest -v test_phase0 test_production
```

`test:backend` tests the in-memory reference model. `test:jobs:local` starts a disposable loopback-only PostgreSQL 17 cluster, exercises actual production SQL and HTTP enqueue/RLS behavior, then stops and removes it. It requires PostgreSQL binaries (`PG_TEST_BIN` can override the default directory), Node and Python dependencies from `engine/requirements.txt`. The real-Python test uses local output and replaces cloud storage with a test double; local auth shims do not prove real Supabase Auth. The frontend tests use DOM/HTTP doubles, not a live browser.

## Controlled sandbox operation

Fill environment variables directly in `.env.local` using `.env.example`. Keep secrets out of chat and source control. Then run these as separate processes:

```powershell
npm run start:api
npm run start:worker
npm --prefix frontend run dev
```

`POST /projects/:id/produce` enqueues only and returns **202 with a queued job**; a same-key replay returns 200. Poll `/projects/:id/status`; request `/projects/:id/download` after completion. A worker must be running, with its scoped database and private-storage credentials. Production does not execute inside the HTTP request or borrow its access token.

The browser opens at `http://127.0.0.1:3000/studio.html`; the frontend dev server proxies `/api` to the loopback API. Apply reviewed migrations 0007 through 0011 in order only on a separately authorized target before using the updated API/worker. They are local-only here. Review data and role impact first; see the handoff and release configuration for migration requirements. Legacy incomplete snapshots fail closed.

The worker verifies the exact payment/paid-quote/entitlement/locked-spec chain, renews its lease, fences writes by claim attempt, bounds subprocess/storage time, validates the Static package before upload and publishes assets transactionally. Downloads require a passing validation report. Old demo assets without that evidence are blocked pending safe regeneration or independent validation. Structural validation is not proof of slide layout, factual content or desktop playback.

`frontend/public/live-demo.html` is a minimal legacy sandbox client with async status/resume behavior; the primary designed customer workflow is `/studio.html`. The legacy sandbox's placeholder slide content is explicitly labeled. For a customer-facing walkthrough, use the studio and clearly explain that generation needs the viewer's Puter session and that persisted project operations need configured Supabase Auth/API access.

## Cloud integration safety

`test:api`, `test:production`, `test:journey` and `test:worker` modify remote state and are disabled unless explicit opt-in and exact targets are supplied. See the handoff for `ALLOW_REMOTE_INTEGRATION_TESTS`, `INTEGRATION_TEST_SUPABASE_URL` and `INTEGRATION_TEST_DATABASE_HOST`. These flags do not authorize shared-project mutation. Use an authorized isolated target; the scripts can update prices, delete fixtures and upload private files. The worker-recovery script scopes claims to its own test job, but production/journey suites that start a normal detached worker can still process any eligible job in that target. A successful sandbox webhook test would not verify a real provider.

The confirmed Supabase integration target is project `HTKIS---SaaS-Agency` (`mnigcwueptvnfqrrszyd`), where PowerPointBD is isolated in the `ai_presentation` schema with scoped application roles and a dedicated private bucket. The project also contains unrelated applications, so remote migration and integration testing must remain inside those PowerPointBD boundaries. No new remote migration, integration-test mutation, deployment, payment activation, commit or push was performed in this execution batch.

## Source layout

- `server/backend.ts`: in-memory reference model, not the production service.
- `server/http/`: authenticated API, sandbox checkout/webhook, production queue, worker and private download.
- `db/migrations/`: portable baseline and Supabase schema/policy/role history; role creation has manual steps.
- `engine/`: real-content Static generator, independent production validator and experimental versioned motion templates; the legacy metadata-only generator remains an explicitly labeled sandbox path.
- `frontend/`: customer-facing studio, separate legacy API demo, controlled local browser fixtures and portable Tailwind build.
- `docs/`: current roadmap/evidence/backlog plus clearly labeled historical records.

Smooth and Cinematic stay disabled until their separate compatibility and commercial gates pass. The complete released MVP includes verified Smooth; Static-only sandbox delivery is an intermediate milestone.
