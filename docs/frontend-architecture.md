# AI Presentation Platform — Frontend Prototype Architecture, Walkthrough & Production Integration Guide

**Date:** 26 October 2026  
**Status:** Runnable 12-Screen Interactive Prototype + Phase 0 Workbench (`index.html`)  
**Visual System:** HTKIS Dark SaaS Design Language (`#090a0c` / `#111317` / `#161920`)

---

## 1. Repository Inspection & Stack Alignment

### 1.1 Current Workspace Inspection
- **Existing Files Audited:**
  - `index.html`: Self-contained clickable PWA prototype and Phase 0 Open XML Workbench.
  - `phase0_pptx_spike.py`: Zero-dependency Python Open XML `.pptx` generator, template patcher, and automated OPC/policy validator.
  - `architecture_and_phase0_audit.md` & `phase_0_decision_report_compatibility_matrix_and_go_no_go_recommendation.md`: Engineering audit, contracts, and Phase 0 test results.
- **Stack Strategy:**
  - For immediate interactive verification in the browser preview canvas, `index.html` provides a zero-build, self-contained runnable prototype implementing all 12 required screens, explicit mock services, and the Phase 0 Open XML inspector.
  - Section 3 below maps every screen, design token, and mock service directly to the target **Next.js App Router + TypeScript + Tailwind CSS** production repository structure so the proven Phase 0 engine and Supabase backend can be wired in without UI rework.

---

## 2. Design Tokens & HTKIS Visual System Adaptation

Adapted from the HTKIS reference for high-contrast readability, Bengali + English bilingual legibility (`Inter` + `Nirmala UI` + `Noto Sans Bengali`), and zero heavy WebGL/3D dependencies:

| CSS Variable / Token | Hex Value | Purpose in Presentation Platform |
| :--- | :--- | :--- |
| `--bg` | `#090a0c` | Primary application canvas and Open XML code inspector background |
| `--panel` | `#111317` | Elevated container panels, navigation bars, and modal dialogs (`.htkis-panel`) |
| `--panel-elevated` | `#161920` | Interactive project cards, slide preview cards, and transition selectors (`.htkis-card`) |
| `--border` | `#222631` | Hairline structural borders with `#33394a` hover elevation |
| `--text-primary` | `#f3f4f6` | High-contrast headings, BDT quote totals, and Bengali conjunct typography |
| `--text-secondary` | `#9ca3af` | Supporting descriptions, formula explanations, and timestamps |
| `--accent` | `#3b82f6` | Primary CTAs, active screen indicators, and focus-visible rings (`2px solid #3b82f6`) |
| `--emerald` | `#10b981` | Server-verified quotes, passed OPC/XML checks, and verified webhook badges |
| `--amber` | `#f59e0b` | Simulation disclaimers, quote expiry warnings, and external desktop QA gates |
| `--rose` | `#ef4444` | Quarantined worker jobs, quota exhaustion alerts, and rejected tamper attempts |

**Accessibility & Motion Compliance:**
- Every interactive control supports keyboard navigation (`Tab`, `Enter`, `Space`) with explicit `:focus-visible` outlines.
- All modals (`#shortlistModal`, `#slideDetailModal`, `#receiptModal`, `#pwaInstallModal`) include `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and close on `Escape`.
- `@media (prefers-reduced-motion: reduce)` disables all CSS keyframe transitions (`pptFadeIn`, `pptWipeRight`, `pptPushLeft`, `pptZoomIn`, `pptSlideUp`, and skeleton shimmers).

---

## 3. Component Structure (Next.js App Router + TypeScript Mapping)

When scaffolding the multi-file Next.js repository in Phase 2, the prototype modules in `index.html` map 1-to-1 to the following TypeScript directory layout:

```text
src/
├── app/
│   ├── layout.tsx                  # Root layout with exact 14 SEO/OG metadata fields & PWA manifest link
│   ├── manifest.ts                 # PWA Web App Manifest (standalone, #090a0c theme, 192px/512px icons)
│   ├── page.tsx                    # Screen 01: Public Landing & Interactive BDT Pricing Calculator
│   ├── (portal)/
│   │   ├── dashboard/page.tsx      # Screen 02: Project List, Category Filters, Search & Shortlist Drawer
│   │   ├── projects/new/page.tsx   # Screen 03: New Presentation Intake (Prompt/Outline/Paste + Motion Yes/No)
│   │   ├── projects/[id]/
│   │   │   ├── preview/page.tsx    # Screen 04: Static Slide-Image Preview Gallery & Revision Quota
│   │   │   ├── motion/page.tsx     # Screen 05: Curated Transition Selector, Intensity & 3s Sample Clips
│   │   │   ├── compare/page.tsx    # Screen 06: Static vs. Smooth vs. Gated Cinematic Comparison
│   │   │   ├── quote/page.tsx      # Screen 07: Server-Authoritative Itemized Quote & Spec Lock
│   │   │   ├── checkout/page.tsx   # Screen 08: Payment Gateway Session & Webhook Status Verification
│   │   │   ├── status/page.tsx     # Screen 09: Durable Worker Progress & XML Quarantine Recovery
│   │   │   └── download/page.tsx   # Screen 10: Signed URL Download, 1 Free Motion Swap & Tier Upgrade
│   │   └── account/page.tsx        # Screen 11: Quotas, PWA Install Guide & Immutable Order Receipts
│   └── admin/
│       └── page.tsx                # Screen 12: Live Rate Config, Motion Library Toggles, Job Monitor & Audit Log
├── components/
│   ├── ui/                         # HtkisPanel, HtkisCard, AccessibleModal, SkeletonShimmer, ToastBanner
│   ├── pricing/                    # LiveQuoteBadge, PricingSlider, ImmutableReceiptModal
│   ├── slides/                     # StaticSlideCard, SlideRoleInspectorModal, SampleClipPlayer
│   └── layout/                     # TopStatusHeader, JourneyStepperBar, SidebarNavigation
└── lib/
    ├── types/contracts.ts          # Shared TypeScript interfaces (MotionTier, QuoteBreakdown, DesignSpecJson)
    ├── services/mockApiService.ts  # Explicit mock service layer ready to swap for Supabase/REST endpoints
    └── policy/motionPolicy.ts      # Client-readable mirror of server MOTION_POLICY registry
```

---

## 4. Walkthrough of the 12 Prototype Screens & Interactive States

You can navigate through all 12 screens (plus the Phase 0 Lab) using the left sidebar or the top **Journey Stepper Bar (`← Prev Screen` / `Next Screen →`)**:

1. **Screen 01 — Public Landing & Product Explanation (`#screen-landing`)**:
   - Displays the exact headline, subheadline, and CTAs from the Landing Page Metadata specification.
   - **Interactive Pricing Calculator:** Click the quick-preset buttons (`10 Slides`, `20 Slides`, `30 Slides`) or drag the slider (`5–50` slides) to verify the exact source formula ($\text{Static} = N \times \text{BDT } 25$, $\text{Smooth} = N \times \text{BDT } 36$).
2. **Screen 02 — Dashboard & Project List (`#screen-dashboard`)**:
   - **Working Category Filters & Search:** Filter by `All Projects`, `Smooth Motion`, `Static Only`, `Delivered`, or `★ Shortlisted`, and type in the search box (`fintech`, `bn`, `startup_pulse`).
   - **Consistent Loading & Empty States:** Click `⟳ Simulate Loading State` to inspect the skeleton shimmer cards, or search for a non-existent term to test the Empty State with its one-click `Reset Filters` button.
   - **Shortlist & Project Selection:** Click `☆ Pin` / `★ Saved` on any card and open the `★ Compare Shortlist` modal, or click `Load Project →` to load that deck's exact slide count and tier into the active prototype flow.
3. **Screen 03 — New Presentation Input Flow (`#screen-intake`)**:
   - Switch between `1. AI Topic Prompt`, `2. Structured Outline`, and `3. Document Paste`.
   - Toggle `Motion needed for desktop PowerPoint?` between **Yes — Smooth Motion (Default, +BDT 11/slide)** and **No — Static Deck Opt-Out (+BDT 0/slide)** and watch the live price estimate update immediately.
   - Click `[Test] Toggle Quota Exhausted` to inspect the server-enforced `2/2 Free Preview Projects Used` error state.
4. **Screen 04 — Static Slide-Image Preview & Design Approval (`#screen-preview`)**:
   - Displays the 8 bilingual slides with explicit `Static Images Only — No Motion Rendered Yet` labeling.
   - Click any slide card to open the **Slide Inspector Modal** showing its Bengali/English text and assigned object roles (`role:title`, `role:bullets`, `role:image`, `role:chart`, `role:quote`, `role:closing`).
   - Click `Request Design Revision` up to 2 times to test the server-enforced revision counter (`FR-05`).
5. **Screen 05 — Motion Selection with Sample-Clip Placeholders (`#screen-motion`)**:
   - **Live Quote Sync:** Switching between `Smooth Motion` and `Static Only`, or changing transition (`fade`, `push`, `wipe`, `zoom`) and intensity (`subtle` $320\text{ ms}$, `standard` $500\text{ ms}$, `dynamic` $600\text{ ms}$), immediately updates the **Live Mock Quote** badge on the screen, top header, and sidebar.
   - **Role Policy Toggle (`Blocker B-02`):** Switch between `v1.0.0-table` (animates `title`, `image`, `quote`, `closing`) and `v1.0.0-minimal` (`title` and `image` only).
6. **Screen 06 — Static versus Smooth Comparison (`#screen-comparison`)**:
   - Side-by-side breakdown of `Static` ($\text{BDT } 25/\text{slide}$), `Smooth` ($\text{BDT } 36/\text{slide}$), and `Cinematic` (locked behind Gate `FR-24`).
7. **Screen 07 — Itemized Pricing & Quote Confirmation (`#screen-quote`)**:
   - Displays the immutable quote ID, base subtotal, motion line item, integer minor units (`paisa`), 24-hour expiry timestamp, and locked `design_specs.spec_json`.
   - Click `[Test] Simulate Quote Expiry` and then try to proceed to checkout to verify that expired quotes are blocked and automatically re-quoted (`FR-16`).
8. **Screen 08 — Checkout & Payment-Result Mockups (`#screen-checkout`)**:
   - Clearly labeled **Simulated Sandbox Checkout**.
   - Test all 4 payment and security states:
     - `✓ Simulate Valid Signed IPN Webhook & Grant Entitlement` (unlocks the production job button)
     - `✗ Simulate Payment Declined / Gateway Failure State`
     - `⚠ [Security Test] Attempt Unverified Browser Redirect` (rejected in the server log)
     - `⚠ [Security Test] Submit Tampered Price (BDT 10)` (ignored in favor of the stored server quote)
9. **Screen 09 — Production Progress & Error States (`#screen-production`)**:
   - Shows meaningful worker stages (`Entitlement Verification` $\rightarrow$ `Static Slide Geometry` $\rightarrow$ `Controlled Open XML Patcher` $\rightarrow$ `Automated OPC & Policy Validator`).
   - Click `[Test] Simulate XML Quarantine` to trigger the `FR-20` delivery block error state, then test `Safe Idempotent Retry` or `Deliver Verified Static Fallback`.
10. **Screen 10 — Final Presentation Download & Revisions (`#screen-download`)**:
    - Shows the expiring signed URL timer, desktop PowerPoint compatibility note, and buttons to download the patched `.xml` slide spec or `.json` validation report.
    - Test the **1 Free Motion Swap (`FR-22`)** button and the **Static $\rightarrow$ Smooth Tier Upgrade (`FR-23`)** button (which charges only the $\text{BDT } 11/\text{slide}$ difference).
11. **Screen 11 — Account Settings & Order History (`#screen-account`)**:
    - Displays account quotas and the immutable quote/order history table. Click any row to open the **Immutable Receipt JSON Modal**.
12. **Screen 12 — Administrative Pricing, Motion Library & Job Monitor (`#screen-admin`)**:
    - Change the Base Rate or Smooth Motion Fee and click `Save New Pricing Version`. Navigate back to Screen 07 or Screen 11 to verify that existing quotes kept their original rate snapshot while new quotes use the updated rate.
    - Toggle any transition (`fade`, `push`, `wipe`, `zoom`) in the **Motion Library Registry** and verify on Screen 05 that disabled effects cannot be selected by customers.
    - Filter background jobs by `Quarantined` and click `Retry` to test manual job recovery.

---

## 5. Setup Instructions & Remaining Production Integrations

### 5.1 Running the Prototype & Phase 0 Engine Locally
1. **Launch the Interactive Frontend Prototype:**
   Open `index.html` directly in any modern desktop or mobile browser, or serve it over local HTTP:
   ```bash
   python3 -m http.server 3000
   # Open http://localhost:3000 in Chrome, Edge, Safari, or Firefox
   ```
2. **Generate & Validate the 6 Phase 0 Bilingual `.pptx` Test Decks:**
   ```bash
   python3 phase0_pptx_spike.py --run-all --output-dir ./phase0_artifacts
   python3 phase0_pptx_spike.py --self-test
   ```

### 5.2 Remaining Production Integrations (Before Paid Launch)
1. **External Desktop PowerPoint Playback & 3-Second Video Capture (`BLOCKER-P0-DESKTOP`):**
   - Open the 6 generated `.pptx` files in `./phase0_artifacts/` on physical Windows 11 (M365), macOS Sonoma (M365), and Windows 10 (Office 2016/2019) machines.
   - Record genuine $3.0\text{-second}$ $1080\text{p}$ $60\text{fps}$ `.mp4`/`.webm` clips from desktop PowerPoint slide shows and upload them to private storage to replace the simulated preview stage in Screen 05.
2. **Original Project Plan Section 15 Import (`Blocker B-01`):**
   - Confirm final intake form fields, AI content/image generation provider credentials, and initial visual design family templates.
3. **Database & Auth Wiring (Phase 2 Foundation):**
   - Apply the PostgreSQL / Supabase migrations defined in `architecture_and_phase0_audit.md` with Row Level Security (RLS) and private storage buckets.
4. **Live Payment Gateway & Accountant VAT/BIN Verification (`Blocker B-05`):**
   - Configure live merchant credentials (SSLCOMMERZ / bKash / Nagad) and accountant-confirmed Bangladesh VAT/BIN invoice rules.