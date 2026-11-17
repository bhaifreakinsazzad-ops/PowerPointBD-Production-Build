# Independent verification

Date: 26 October 2026. Scope: local Phase 0 engine and existing-source frontend prototype. This is a code and DOM verification, not a visual/browser audit or production security sign-off.

## Checks actually run

| Check | Command | Result |
|---|---|---|
| Frontend behavior | `npm --prefix frontend test` from project root | 5 tests passed at initial verification |
| Portable frontend build | `npm --prefix frontend run build` | Passed; produces `frontend/dist` with local CSS/JS |
| JavaScript syntax | `npm --prefix frontend run lint` | Passed. Script uses `node --check`; it is syntax validation, not a full ESLint/static-analysis run |
| Engine unit/negative tests | `python -m unittest discover -s engine -p 'test_*.py'` from project root | 23 tests passed; includes six eight-slide specimens, deterministic regeneration, disabled production registry, package/target/timing/policy corruption negatives |
| Targeted journey probes | Temporary Happy DOM script against current source | Found expired-quote payment, tier mismatch, and stale mock estimate defects below |
| Visual/browser/PWA installation | Not attempted by this verifier | Unverified. Root agent reported a browser URL security policy block; no alternate browser or automation workaround used |
| Desktop PowerPoint/XSD | Unavailable here | No playback, repair-dialog, Bengali font shaping, genuine clips, or full ECMA-376 schema conformance claim |

Happy DOM tests execute reviewed local application scripts. Happy DOM warned that its VM is not a security isolation boundary; it is only a DOM test harness. Test success does not establish browser rendering, accessible layout, touch behavior, authentication or live payment processing.

## Reproduced issues reported for correction

1. **Expired quote:** setting an active quote's `expiresAt` into 2020 still allowed `proceedToCheckout()` to produce `checkout/payment_pending`. It checked only a manually changed status.
2. **Expired simulated payment:** calling `simulateQuoteExpiry()` then the visible payment simulator granted a paid entitlement. The simulator needs an expiry guard even though it is not a gateway.
3. **Tier mismatch:** paying Static, switching the requested tier to Smooth, and starting production entered `demo_delivery` while entitlement remained Static. Require matching quote/project/tier/spec and invalidate authorization when configuration changes.
4. **Stale live estimate:** after the same tier switch, sidebar displayed BDT 200 while the live Smooth calculation was BDT 288. Preserve existing quote snapshots but display a separate current estimate outside the locked quote.
5. **Residual evidence claims:** inherited text said “Validated for desktop Microsoft PowerPoint,” “Built & validated,” “Admin Role Verified,” and “Deliver Verified Static Fallback.” Payment log claimed actual HMAC verification and gateway API calls, and fallback toast claimed a delivered verified deck. These must be explicitly simulated/pending.
6. **Nonexistent CLI flag:** frontend workbench toast mentioned `--run-all`; engine accepts only `--output-dir`. Correct command: `python engine/phase0.py --output-dir artifacts` from project root.

These observations refer to the inspected intermediate source. Root agent owns implementation fixes and final regression rerun; a later results section must supersede the initial findings with actual evidence.

## Evidence and release limits

The checked-in registry has `production_enabled: false`, and every transition/entrance remains production-disabled. Six artifact PPTX packages and their evidence JSON files exist. Engine tests establish only the documented ZIP/XML/OPC and controlled-template/policy subset, plus python-pptx reopening eight slides. The validator is intentionally not a full XSD validator or renderer. Experimental entrance coverage is not an advertised Smooth policy change. Real image/chart rendering, Office font installation, native timing behavior and commercial QA cost remain unverified.

The customer demo's XML download is only illustrative source, not a complete deck. There is no live auth, private storage, provider integration or server-enforced frontend entitlement. Keep production No-Go while those gates remain open.

## Skill forward-test

The new `build-ai-presentation-platform` skill correctly directed this pass to distinguish inherited reports from executed tests, candidate effects from approved effects, and package validity from playback. Its “never offer fabricated generated deck” and in-memory/gateway caveats helped identify residual claims. Recommended refinement: explicitly require timestamp-based expiry, quote/spec/tier equality, authorization invalidation after configuration edits, and evidence-backed labels even inside a demo. This is a task-level forward test using source artifacts, not proof the skill generalizes to every future project.

## Final correction rerun

The root agent corrected the implementation after the findings above. Independently reran `npm --prefix frontend test`: **6 tests passed, 0 failed**. The added test covers expired and mismatched quote guardrails. Targeted probes now show:

- Past timestamp checkout stays off checkout and creates a fresh quote for review.
- Explicitly expired quote cannot grant simulated paid entitlement; status stays expired and entitlement stays null.
- Paid Static quote followed by a Smooth request is blocked by matching quote/tier/spec requirements.
- The sidebar now shows `BDT 288 estimate` for eight Smooth slides while existing quote history retains the old snapshot.
- Gateway log now says no signature was checked and no gateway API called; desktop/admin/fallback labels were changed to demo or unverified language.
- The `actualEvidence` section exists. Loading `public/evidence.js` in the DOM harness renders six evidence table rows, separate from the illustrative workbench matrix. Each row is explicitly package/policy subset evidence with desktop unverified.

A remaining documentation-only command typo was reported to root: the manual QA paragraph in `index.html` still referred to nonexistent `phase0_pptx_spike.py --run-all`. It should reference `python engine/phase0.py --output-dir artifacts` from project root. No claim is made here that a later edit was inspected.

**Final verification decision:** GO for delivery as a clearly labeled, locally built prototype and experimental PPTX package. NO-GO for paid production, Office compatibility advertising, or claims of visual/browser/PWA verification. Production registry remains disabled; full database/provider/deployment and external playback gates remain open.

Parent follow-up: the obsolete manual-QA command was replaced with `python engine/phase0.py --output-dir artifacts`; source search confirms no `phase0_pptx_spike.py` invocation remains in the revised frontend.
