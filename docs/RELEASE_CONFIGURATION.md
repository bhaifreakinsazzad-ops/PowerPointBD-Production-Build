# Runtime and commerce configuration

This describes implemented local guards, not a deployed or accepted release. Read `STATUS.md` for current evidence and `ROADMAP.md` for the complete release gates. Do not apply remote migrations or expose a deployment without separate authorization.

## Confirmed Supabase integration target

The existing integration target is Supabase project `HTKIS---SaaS-Agency` (`mnigcwueptvnfqrrszyd`, `ap-southeast-2`). PowerPointBD is isolated in the `ai_presentation` schema and `private-presentations` bucket alongside unrelated applications in other schemas. Presence-only inspection confirms local URL, anon/service-role and scoped app/worker/webhook database settings, and the public URL plus all three database connection strings match this exact project reference; never print or commit their values.

Read-only cloud preflight on 26 October 2026 found 12 RLS-enabled PowerPointBD tables, 19 policies, 31 indexes, three scoped database roles, three platform users and existing historical fixture data. All seven existing jobs are completed `pptx_production` jobs with non-null design-spec and entitlement references, so migration 0009's new job-reference constraint is compatible with the observed rows. The `processing_outcome` marker and the `content_drafts`, `preview_requests` and `preview_approvals` tables are absent, confirming migrations 0007–0010 have not been applied. The private bucket exists, but it still uses the earlier permissive owner read/write/update policies; migration 0011 replaces them with worker-only writes and restrictive read boundaries.

Apply 0007–0011 in order as one reviewed application release. Before applying, capture a recoverable database state or use an isolated Supabase database branch when available, stop integration workers, and confirm the observed legacy-row compatibility again. After applying, deploy the matching API and worker together; verify the marker column/new tables, policy names, Auth ownership, private preview reads, browser write denial, worker upload, paid download, TLS and recovery. Re-run Supabase security and performance advisors. Do not run the ordinary worker or the production/journey integration suites against a target containing unrelated eligible jobs.

The current Supabase advisor reports one informational security item for `payment_webhook_events` having RLS with no browser policy; this table is intentionally service-side and should remain inaccessible to browser roles. Performance findings include per-row `auth.uid()` evaluation in existing policies, missing covering indexes for several foreign keys, and overlapping permissive read policies. Treat those as a separate reviewed hardening migration after the functional schema rollout; the unapplied 0008–0011 policies already use the cached `(SELECT auth.uid())` form.

## Runtime boundaries

| Setting | Behavior |
|---|---|
| `NODE_ENV` | Accepts `development`, `test`, or `production`; other values fail startup. Defaults to development. A production deployment must explicitly use production mode. |
| `HOST` | Defaults to `127.0.0.1`, avoiding accidental network exposure during local work. Set another listener only for an authorized deployment. |
| `FRONTEND_ORIGIN` | One exact cross-origin frontend origin. Development defaults to `http://localhost:3000`; production defaults to none for same-origin reverse proxy use. No wildcard grant. |
| `PGSSL_CA_FILE` | Optional trusted provider CA PEM file. Needed when the server certificate does not chain to the runtime's trusted roots. Never replace this with disabled certificate verification. |

The app, webhook and worker PostgreSQL pools require `rejectUnauthorized: true` for remote hosts, in all runtime modes. Only development/test loopback databases use plaintext. Production loopback connections also require TLS. URL parameters such as `sslmode`, `sslcert`, `sslkey`, `sslrootcert` and `ssl` are removed before constructing the pool so they cannot replace its explicit TLS object. If a deployment needs client-certificate authentication, implement that explicitly; the current worker is designed for the existing password-authenticated Supabase stack.

TLS configuration was checked against the actual node-postgres connection parameters, including URL override attempts and an optional CA. This is not evidence of a successful handshake with an external database. Verify the selected environment's certificate chain and hostname on the authorized target before release. No `.env.local` credentials were changed here.

Primary references: [node-postgres SSL configuration and URL override behavior](https://node-postgres.com/features/ssl), [Supabase SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement).

API responses set `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and omit `X-Powered-By`. CORS grants only the configured exact origin and rejects other preflights. Authenticated writes have bounded per-process limits: 60 requests per minute per user and route, with 12 requests per 15 minutes for preview/approval/quote/production operations. This is a local API safeguard, not a distributed quota: production must also enforce shared limits at its gateway when running multiple replicas. Full frontend CSP, deployment proxy/HTTPS configuration and broader security acceptance remain separate work.

## Payment and delivery behavior

No real payment provider has been selected or implemented. The public `GET /commerce/capabilities` endpoint always reports live checkout unavailable. A historical `PAYMENT_PROVIDER` environment value is not a gateway integration or activation switch.

- Development/test can use the explicitly named mock sandbox and its signed HMAC webhook for controlled integration tests.
- Production refuses mock checkout with 503, refuses mock webhooks before processing, and rejects stored mock/development entitlements for production/download. The mock HMAC secret is neither required nor used in production.
- Real provider integration must replace the production unavailable gate with independently verified provider authorization. Merely removing the guard or changing an environment string is not sufficient.
- Existing sandbox sessions are not presented as real paid orders. The studio labels them development verification and contains no browser-side payment-success button.

`GET /projects/:id/order` returns the authenticated owner's quote, payment summary and production status. `can_produce` and `download_available` are derived from the server's verified paid chain and private asset state. Refunding a payment removes new access. Browser labels or controls never grant entitlements.

The studio can request a Static quote after design approval, display the immutable approved slide count and amount, follow queued production, and prepare a private download for an eligible verified order. Checkout remains disabled with an explicit reason. Existing active quotes are reused in the UI. Failed/expired commercial states remain server-controlled.

Private download URLs must use the configured Supabase origin and the signed `private-presentations` bucket path. They are shown only after an explicit request, cleared on project change/sign-out, and hidden on expiry. An already issued bearer URL can remain usable until its expiry; refreshing an order or refunding a payment is not instantaneous invalidation of an existing link.

## Verification and remaining gates

Use `npm run test:jobs:local` for the disposable PostgreSQL SQL/RLS and process suite. It pins test mode, loopback endpoints and fixture credentials without reading a remote database. `npm --prefix frontend run test:studio:browser` follows a normal frontend build and uses labeled controlled Auth/payment/storage responses. A normal build removes its QA bundles.

No live gateway, customer authentication/email delivery, external database TLS, Storage byte transfer or staging behavior is established by those local checks. The isolated release-package smoke test verifies the runtime install, compiled API startup, production guards, studio root, icons and development/private-file exclusion locally; it does not establish hosted behavior. Verify Auth email confirmation/reset delivery and callback allowlists on staging; operational cleanup/restore, real provider integration, licensed desktop Smooth verification and authorized release acceptance remain required.

The latest optional real-renderer suite passed 49/49. After increasing conversion and rasterization bounds from 60 to 180 seconds, the real journey passed on its first attempt in 40.1 seconds on a warmed local renderer. A prior cold conversion exceeded the old 60-second bound and succeeded on the durable retry. The integration follows the retry schedule and ceiling if an attempt fails, checking quota and unpublished-asset invariants. The warmed pass does not establish cold-start reliability; gather broader latency evidence on the selected runtime before launch.
