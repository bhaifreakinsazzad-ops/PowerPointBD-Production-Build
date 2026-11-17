# Phase 0 decision report

Date: 26 October 2026. **Decision: GO for further engineering experiments and the independent prototype. NO-GO for paid generation or advertising any native motion effect.**

## What actually ran

The supplied walkthrough referenced a missing `phase0_pptx_spike.py` and earlier 6/6 results. Those historical claims were not adopted. This new spike generates six real eight-slide `.pptx` specimens using installed python-pptx 1.0.2 and lxml 6.1.1, then patches only versioned XML fragments selected from an explicit registry. It never accepts XML from model output or user payloads. Both Static and Smooth decks contain English and Bengali text. Image/chart roles are clearly labeled native text fixtures for target-policy testing, not proofs of an image generator or chart rendering pipeline.

Commands from the project directory:

```bash
python -m pip install -r engine/requirements.txt
python engine/phase0.py --output-dir artifacts
cd engine
python -m unittest -v test_phase0
```

The two dependencies were already installed. Generation and tests above were executed; the install command is a setup instruction, not a claim that pip installation ran. **23 tests passed.** See `artifacts/test-results.txt`. Byte-for-byte reproducibility across repeated generation passes is tested. Every generated deck was reopened by python-pptx and reported eight slides. This is parser reopening, not PowerPoint opening or rendering.

## Structural evidence

Checks cover ZIP CRC, duplicate parts, XML parsing with DTD/entity rejection, content-type coverage, internal OPC relationship targets, embedded relationship references, explicit slide order, shape target existence, timing-ID uniqueness, a root/main sequence, automatic trigger/delay expectations, the five-entrance cap, role targets, dense-slide suppression, and matching each entrance group to its controlled template. Unknown effect IDs raise an error rather than substituting a default.

Static has no `p:transition` or `p:timing`. The four Smooth specimens apply exactly one chosen transition across all eight slides and fade the selected roles. The separate experimental coverage specimen cycles fade/wipe/zoom/slide_in entrances across its slides. It is deliberately outside the Smooth role-effect policy and must not ship as Smooth. Slide 5 contains eight bullet items and exercises a provisional title-only reduction rule. Slide 6 has seven eligible objects and verifies the five-entrance cap. Intensity unit checks verify 400/500/600 ms for subtle/standard/dynamic without changing prices.

**This checker is not full OOXML XSD validation.** No Open XML SDK schema-validator binary was available. The templates were authored for this experiment using documented PresentationML constructs and have not been captured from, or certified by, desktop PowerPoint. In particular, zoom scaling and slide-in motion-path behavior need real playback review. Structural pass does not establish correct visual motion, repair-free opening, Bengali shaping, simultaneous trigger semantics, or version compatibility.

## Measured local results

Single-run elapsed wall time in this container, not a benchmark or production SLA. Both file construction and deterministic ZIP writing are included in generation time. Validation time excludes desktop QA, which did not happen.

| Specimen | Generate ms | Validate ms | Bytes | Structural/policy subset | Desktop playback |
|---|---:|---:|---:|---|---|
| `phase0_static.pptx` | 28.8 | 5.9 | 37,955 | PASS | UNVERIFIED |
| `phase0_smooth_fade_smooth.pptx` | 30.1 | 11.4 | 41,487 | PASS | UNVERIFIED |
| `phase0_smooth_wipe_smooth.pptx` | 30.6 | 11.3 | 41,528 | PASS | UNVERIFIED |
| `phase0_smooth_push_smooth.pptx` | 30.9 | 10.9 | 41,518 | PASS | UNVERIFIED |
| `phase0_smooth_zoom_smooth.pptx` | 31.0 | 11.1 | 41,529 | PASS | UNVERIFIED |
| `phase0_smooth_fade_experimental-coverage.pptx` | 31.0 | 10.9 | 41,606 | PASS | UNVERIFIED |

Static price at the specified initial rates is BDT 200 for eight slides. Smooth price is BDT 288, including BDT 88 motion. These are customer-pricing calculations, not measured generation cost. No AI calls or paid generation APIs ran. Infrastructure cost, gateway fees and manual QA time remain unmeasured. Record operator minutes and actual invoice costs during desktop QA before establishing unit economics.

## Strategy supported by evidence

The installed python-pptx Slide API exposes no high-level transition/timing authoring property in the exercised API; its generated Static packages contain no motion. Controlled template patching can create deterministic packages and preserve all references checked here. This supports the **experiment architecture**, not a production library endorsement. Adopt a two-stage geometry plus deterministic XML patcher only if desktop tests accept these exact template hashes. Prefer genuine PowerPoint-authored template fragments when available. Pin generator, policy and template versions; sidecars record hashes, selected IDs, timings and validation evidence.

No claim is made that PptxGenJS or another untested library cannot support these features. Those alternatives were not installed or experimentally assessed in this spike.

## Desktop matrix and manual QA

`artifacts/desktop-compatibility-matrix.csv` contains the exact outstanding matrix. Every row remains `UNVERIFIED`. The proposed test environments are Windows desktop PowerPoint Microsoft 365, Mac desktop PowerPoint Microsoft 365, and an owner-nominated legacy desktop build. Exact OS/Office versions and support policy must be agreed before compatibility sign-off.

For each environment:

1. Record machine OS, full Office product/build, display scaling and installed Bengali font family/version. Use a licensed desktop PowerPoint installation.
2. Open all six decks. Record any repair prompt or missing content. Confirm eight slides and compare the static layout. Inspect conjuncts such as ক্ষ, ত্র, শ্র and জ্ঞ. Noto Sans Bengali is requested but not embedded; no Bengali font was detected in this container. Install an approved font and document licensing before distribution if embedding is chosen.
3. Run Slide Show from the beginning. Verify each transition candidate without substituting another effect. Confirm every eligible object starts automatically together, bullets/charts stay still, dense slide animates only its title, and cap slide has exactly five entrance effects.
4. Review the experimental coverage deck separately for all four entrance IDs, including native Zoom and the slide-in path. Check initial/final position, no flash, no offscreen residual and proper completion. Flag any animation silently dropped by PowerPoint.
5. Record real three-second clips in Slide Show for each distinct transition and entrance sample. Capture enough lead-in to see the effect. Store clip hashes, machine/build metadata and exact deck/template hashes. Browser CSS or generated videos do not satisfy this requirement.
6. Inspect Animation Pane durations and triggers, then save/reopen and replay. Log defects with slide number, expected/actual behavior and reproducible steps. Record manual QA effort in minutes.
7. Submit explicit per-effect pass/fail sign-off. Keep failed and untested IDs disabled. A partial pass enables only the signed-off ID/platform combination after product support rules are agreed.

## Release gates

`engine/registry.json` disables production globally and disables every candidate transition/entrance individually. All native effects and Cinematic remain unavailable in production. No real recordings were fabricated. No desktop sessions occurred. The release remains NO-GO until desktop playback, genuine clips, source-policy decisions and the separate authentication/payment/private-delivery gates pass. Cinematic also needs the five-paying-client milestone and a confirmed price; no provisional Cinematic rate is exposed here.

## Open policy decisions

The role table includes quote/closing but the short Smooth summary mentions only title/image. This experiment follows the table, labeled provisional. The source requests reduction above six bullets but does not specify precedence; this experiment uses title-only and labels that choice provisional. Exact Office builds, typography treatment, transition duration/intensity linkage and the commercial launch support matrix remain owner decisions.

## Primary technical references consulted

- Microsoft Transition / ZoomTransition: https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.transition?view=openxml-3.0.1 and https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.zoomtransition?view=openxml-3.0.1
- Microsoft AnimateEffect: https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.animateeffect?view=openxml-3.0.1
- Microsoft AnimateScale: https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.animatescale?view=openxml-3.0.1
- Microsoft AnimateMotion: https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.presentation.animatemotion?view=openxml-3.0.1

These establish available XML constructs, not correct PowerPoint playback of this implementation.
