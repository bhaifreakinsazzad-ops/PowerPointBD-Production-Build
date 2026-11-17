# Current owner decisions - preview quota and payment provider

26 October 2026: Count a project/revision when rendering starts, including failures and abandoned work. The implementation charges once per durable logical request; lease recovery and automatic retries do not charge again. Two projects/account and two revision rounds/project remain the caps. Draft saves and merely opening a revision do not consume quota.

The owner confirmed that the payment provider is not selected yet. Keep live checkout unavailable and use the explicitly labeled mock sandbox only for controlled development verification. No real charges or payment activation are authorized.

---

# Current choices - Puter, anime.js and Three.js

26 October 2026: The owner selected Puter.js for AI and anime.js/Three.js for interactive UI. This supersedes the direct OpenAI key gate and the undecided provider entry. Use the user's Puter account and discovered models, disclose usage billing/cancellation, and obtain content-sharing consent before generation. No developer provider key is required by the browser studio.

Preserve the current stack. Browser 3D/animation does not enable unverified PowerPoint effects or bypass server pricing/payment/production controls. A reusable local skill and skills-only plugin were created/validated/installed; no hosted MCP service or account upload was created.

---

# Decision authority update — 26 October 2026

The owner selected roadmap-first execution. `ROADMAP.md` defines current sequencing and release gates. Recommendations below remain provisional; a historical statement that work continues on defaults is not approval for paid behavior. Resolve quota counting, providers/privacy/budget, motion policy conflicts, minimum/TTL/refunds/swaps/tax and hosting at their respective gates. Keep the existing stack. See `STATUS.md` for fresh evidence and `BLOCKERS.md` for dependencies.

---

## Historical decision register

# Decisions

Format per entry: decision, source, status, impact, evidence.

## Already decided (by the requirements source, not by this session)

| Decision | Source | Status | Impact |
|---|---|---|---|
| Static = BDT 25/slide; Smooth = BDT 25 + 11 = 36/slide; Smooth is default | Requirements analysis / master prompt Â§4 | Confirmed | Implemented in `server/backend.ts` pricing, tested in Test 04/05/08 |
| Monetary values are integer paisa, never floating point | Master prompt Â§4 | Confirmed | `quote_amount_paisa` fields throughout; no float arithmetic in pricing path |
| Transition candidates: fade/wipe/push/zoom. Entrance candidates: fade/wipe/zoom/slide_in. Separate typed registries even where names overlap | Requirements analysis | Confirmed | `engine/registry.json`, `server/backend.ts` motion library |
| AI never authors animation XML; only approved IDs + versioned templates | Master prompt Â§9 | Confirmed | `engine/phase0.py` + `engine/templates/v1/*.xml`; enforced by `UnsupportedMotionEffectError`-equivalent rejection in `test_phase0.py` |
| Every motion candidate stays production-disabled until desktop compatibility evidence exists | Master prompt Â§9, Â§12 | Confirmed | `engine/registry.json`: `"production_enabled": false` globally and per-effect; backend regression test "all unverified motion candidates disabled by default" |
| Cinematic stays unavailable until Phase 0 passes + first-five-paying-clients + approved price | Master prompt Â§4, Â§6 | Confirmed | Rejected server-side (`PermissionError` equivalent) in backend |
| Quote TTL default 24h (not yet confirmed 24 vs 48) | Master prompt Â§5 | **Development default**, not final | `quote_ttl_hours` is admin-configurable, defaults to 24; do not present as an approved commercial policy |

## Autonomous engineering decisions made this session (routine, reversible)

| Decision | Reasoning | Reversibility |
|---|---|---|
| Reconcile repo with `AI_Presentation_Phase0_Project.zip`'s `project/` bundle instead of continuing to patch the OneDrive-derived files | Independently verified every claim (19/19 backend, 23/23 engine, 6/6 frontend tests actually pass); it already fixes the exact two bugs found earlier this session plus ~15 more defects (stale `motion_tier_requested`, draft-can-quote gap, TTL validation gaps, fail-closed-by-default motion registry, etc. â€” see `docs/source-audit.md`), and uses a cleaner versioned-template architecture for the Open XML engine | Fully reversible â€” old files are in git history (commits `892fe76`, `c34d614`) |
| Keep the vanilla HTML/CSS/JS + Tailwind frontend rather than scaffolding Next.js now | Master prompt Â§6 explicitly allows reusing a sound existing stack; this one is tested (6/6), builds cleanly, and a framework migration before the native-motion gate passes would be throwaway work if effects get rejected on desktop. Revisit once real auth/session/SSR needs force the question (M2+) | Reversible â€” no server-side framework commitment has been made yet |
| Install Python 3.12 via `winget` | No real Python existed, only a Microsoft Store stub alias | Reversible â€” standard Windows uninstall |
| Use `tsx` (not Node's native `--experimental-strip-types`) to run TypeScript | The zip's own README assumed Node 24; this environment has Node 22.14. `tsx` works identically on both and is already a pinned devDependency | Reversible â€” pure tooling choice, no code depends on it |
| **Database: real Supabase Postgres, in an isolated `ai_presentation` schema inside the existing `HTKIS---SaaS-Agency` project** (user-directed â€” see below) | User explicitly asked to use the `supabase-expert` skill for the database. The org's free-tier cap (2 projects) was already used by two *other* client projects (`JOSANNAH`, `HTKIS-SaaS-Agency`); no `delete_project` tool exists for me to free a slot, so per the user's choice we share the active project under a dedicated schema rather than touch either existing one. `db/migrations/0002_supabase_ai_presentation_schema.sql` applied; RLS uses real `auth.uid()` (not the custom `app.current_user_id` GUC the audit flagged as incomplete) | Reversible â€” `DROP SCHEMA ai_presentation CASCADE` removes everything this added without touching `public.htkis_*`/`public.unreal_bs_*` |
| **Auth: real Supabase Auth**, resolving the previously-open item #9 below | Now directly available since we're on a real Supabase project; it's exactly the "proven authentication provider... with verified server sessions" the master prompt recommends, and a routine/reversible choice | Reversible pre-launch â€” no real users exist yet |
| Stopped using the newly-installed local PostgreSQL 17 Windows service after the pivot to Supabase | Superseded by the cloud database; left installed but idle rather than fighting a permissions error to stop it (see `docs/BLOCKERS.md` #16) | Fully reversible â€” can be stopped/uninstalled anytime |

## Needs your answer (batched â€” recommended defaults shown; independent work continues regardless)

These materially affect paid behavior, security posture, branding, or launch, so I'm not deciding
them myself. Recommended default is listed first; implementation continues on that default until
you say otherwise.

1. **Payment provider.** Recommended default: build to the SSLCOMMERZ sandbox contract (most
   commonly cited in the requirements) but keep the adapter interface provider-agnostic. *Needed:*
   which provider(s), merchant sandbox credentials, and whether bKash/Nagad/Rocket direct
   integration or an aggregator is intended.
2. **AI content-generation provider.** Recommended default: none connected yet â€” all "generate
   content" paths stay explicit dev fixtures until you provide a provider + API key. *Needed:*
   provider choice, API key (entered by you directly into a `.env.local` I'll scaffold, never pasted
   into chat), budget/rate limits.
3. **Hosting target for staging.** Recommended default: keep working locally (this machine) until a
   target is named â€” no deployment attempted without one. *Needed:* where should staging actually
   run (Vercel/AppDeploy/own VPS/other)?
4. **Desktop PowerPoint access.** *Needed:* a licensed Windows + Mac + one older-Office machine (or
   remote access to one) to run the manual QA checklist in `docs/phase0-report-v2.md` and record
   genuine 3-second clips. Nothing in Smooth/Cinematic can be sold without this regardless of any
   other decision.
5. **Smooth role-policy conflict** (short description says title/image only; the detailed role
   table also animates quote/closing). Recommended default: keep following the wider table
   (already what `engine/registry.json` encodes), label provisional. *Needed:* confirm or correct.
6. **Quote TTL:** 24h vs 48h. Recommended default: 24h (current). *Needed:* confirm.
7. **Minimum order** (slide count or BDT amount). Recommended default: none enforced yet.
   *Needed:* confirm whether one is wanted, and its value.
8. **Downgrade refund policy** (Smoothâ†’Static after payment). Recommended default: no refund,
   re-render only. *Needed:* confirm.

None of the above blocks independent engineering work (database setup, HTTP service build-out,
frontend hardening, admin tooling) â€” that continues on the recommended defaults in parallel.
