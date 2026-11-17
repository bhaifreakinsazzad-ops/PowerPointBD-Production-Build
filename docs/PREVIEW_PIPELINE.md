# Real Static preview pipeline

The implementation preserves Express/TypeScript, PostgreSQL/Supabase, Python and the vanilla studio. Puter generates draft text in the user's browser account; the server validates that text before persisting a version. Anime.js and Three.js remain editing UI, not evidence of PowerPoint playback.

## Rendering and approval

1. Save normalized content with `PUT /projects/:id/content`, including `expected_version` for optimistic concurrency.
2. Request `POST /projects/:id/previews` with `content_version` and a stable `idempotency_key`. The request enqueues; the HTTP handler does not render.
3. A separately running worker claims the request. At the first render start it charges the account/project allowance atomically. Lease recovery and automatic retries reuse that recorded charge.
4. Python generates the content PPTX and the independent validator reopens its package and compares title, bullets, notes, slide count and language. LibreOffice opens that PPTX and exports a PDF; Poppler rasterizes the actual pages as 1280x720 PNGs. An isolated Office profile and bounded processes prevent shared-profile interference. Cancellation kills the launcher's descendant processes on Windows; the POSIX process-group path is implemented but was not executed on this Windows host.
5. Source PPTX and images upload under private attempt-specific names. A fenced transaction registers assets and records renderer/template, checksums and page order. Failed/stale attempts cannot register a successful result. Partial orphan uploads are inaccessible through the browser policy but still need retention/cleanup operations before launch.
6. `GET /projects/:id/previews` returns status and five-minute signed image URLs after account isolation. Refresh renews expired links. The studio distinguishes draft text from actual rendered images.
7. `POST /projects/:id/approve-preview` requires deliberate confirmation, preview job ID, current content version and manifest digest. The database checks exact immutable manifest equality and available source/image checksums. Approval becomes immutable and freezes that reviewed version.
8. Motion selection and quoting consume the approved content snapshot. Static production retrieves the exact approved source PPTX, verifies its checksum, independently validates the expected content, and verifies the same checksum again before upload. Mutating later project metadata cannot alter the source or price count.

The owner chose count-at-render-start quota behavior, including failed/abandoned work: two project slots per account, then two revision rounds per project. Saving a draft or opening a revision does not consume quota. A new requested render after a terminal failure consumes the next available revision; an automatic retry of the same durable job does not.

## Local verification

`npm run test:jobs:local` provisions a disposable loopback PostgreSQL 17 cluster and removes it after shutdown. It never connects to the shared Supabase target. It executes the real application migrations, roles, RLS, quota, approval and worker SQL. Its minimal local `storage.objects` ledger proves the SQL policy, not Supabase HTTP signing or transport.

To test the actual renderer on Windows PowerShell, configure installed binaries for that process:

```powershell
$env:PYTHON_BIN = 'C:/path/to/python.exe'
$env:PREVIEW_LIBREOFFICE_BIN = 'C:/path/to/LibreOffice/program/soffice.com'
$env:PREVIEW_PDFTOPPM_BIN = 'C:/path/to/pdftoppm.exe'
npm run test:preview:local

# Adds the real-renderer approval/payment/delivery journey to the SQL suite.
$env:POWERPOINTBD_REAL_RENDERER_TEST = '1'
npm run test:jobs:local
```

The real journey uses actual PPTX generation, rendering, approval and independent content validation. It uses controlled authentication and an in-memory private byte store/signing boundary, plus the explicitly named mock payment provider. It does not prove live Auth, Storage, gateway or cloud behavior.

`test:preview:local` writes an explicitly labeled English/Bengali/bilingual corpus to `artifacts/preview-renderer-corpus/`. It contains no customer content or paid AI output. The worker does not depend on those test artifacts. Latest named results are in `STATUS.md`.

## Deployment prerequisites and limits

- Apply reviewed migrations 0007 through 0011 only on a separately authorized target. They have not been applied remotely here. Review existing data and roles first. Migration 0009 makes production references nullable only for preview jobs and adds the worker's scoped quota/state grants. Migration 0011 removes browser writes to this platform's bucket and restricts reads to images or verified paid output, including when broader permissive policies exist for another application. Other buckets retain their rules.
- Configure the worker's Python, LibreOffice and Poppler executables and secure Storage service credentials. API user signing remains account-scoped. Do not copy a service key into browser configuration.
- Live Supabase signed URL creation, byte transfer, role configuration and customer authentication still need an isolated authorized integration target. Signed bearer URLs already issued can remain usable until their expiry; refund checks prevent issuing new URLs, not instantaneous invalidation of an existing URL.
- The tested local renderer is LibreOffice 26.8.1.1 on Windows, using Nirmala UI. Office conversion and Poppler rasterization each have a three-minute process bound. A latest warmed real journey passed on its first attempt in 40.1s, while a prior cold conversion exceeded the old 60-second bound and succeeded on durable retry. This is not a cold-start reliability guarantee. The official MSI was SHA-256 and Authenticode verified and administratively extracted into the user's cache. Deployment needs a supported renderer image and legally available fonts. Do not redistribute Windows fonts or assume Mac/Linux/Bengali typography matches this corpus.
- LibreOffice previews are actual rendered PPTX pages, but are not a guarantee of desktop Microsoft PowerPoint layout/playback. Dense-content overflow, broader template/font corpus and licensed Windows/Mac/older-Office compatibility acceptance remain required. Smooth effects and genuine three-second clips remain gated.
- Real payment provider selection is pending. The studio exposes no fake payment-success control, and paid launch remains unavailable. Complete provider-backed checkout and production UI, commercial terms, operational recovery, security/accessibility acceptance and authorized staging before release.

Primary renderer references: [LibreOffice command-line parameters](https://help.libreoffice.org/latest/en-GB/text/shared/guide/start_parameters.html), [official release download and checksums](https://download.documentfoundation.org/libreoffice/stable/26.8.1/win/x86_64/LibreOffice_26.8.1_Win_x86-64.msi.mirrorlist).
