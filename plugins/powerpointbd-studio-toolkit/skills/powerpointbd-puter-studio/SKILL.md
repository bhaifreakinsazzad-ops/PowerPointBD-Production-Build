---
name: powerpointbd-puter-studio
description: Build and verify Puter AI drafting, Puter AI Copilot slide enhancements, anime.js + motion.dev interactions, and Three.js storyboards in PowerPointBD while preserving its server pricing and production boundaries.
---

# PowerPointBD Puter studio

Use this skill for this platform's real AI drafting, Puter AI Copilot slide refinement, Motion & Pricing Studio, and 3D storyboard, not unrelated OpenAI key setup or a framework migration.

- Preserve Express/TypeScript, Supabase, Python generation and the existing vanilla frontend. The user's chosen AI integration is Puter.js (`@heyputer/puter.js`); a direct OpenAI key is not required for Puter browser calls.
- Inspect `shared/presentation.ts` and `frontend/src/studio` before extending the content contract. Treat model output from `client.generate(...)` and `client.enhanceSlide(...)` (`executive_polish`, `bilingual_translate`, `speaker_coach`, `story_hook`) as untrusted, plain-text content. Normalize and validate count, language, titles, bullets and notes. Do not accept AI-authored prices, entitlements, XML or tool execution.
- Discover model IDs/providers with `puter.ai.listModels()`; never fabricate a successful catalogue or generation fallback. Start auth from a user gesture, and disclose that requests use the user's Puter account/allowance. Submit only on deliberate generation with content-sharing consent. Do not print/store tokens or silently charge a developer account. Cancellation may not prevent provider billing for already submitted work.
- Use `analyzeDeckReadiness` (`frontend/src/studio/puter-client.ts`) and the Upfront Motion & BDT Pricing Calculator (`#motion-pricing-panel`) to surface the Bengali Client Addendum rules (`Static` `৳25/slide`, `Smooth` `৳36/slide = ৳25 base + ৳11 motion`, `Cinematic` gated add-on, `≤6` bullets density guard, transition mapping by template family `corporate_slate`, `startup_pulse`, `editorial_bengali`, and `subtle`/`standard`/`dynamic` intensity multipliers).
- Keep draft text/Three.js storyboard separate from actual production slide-image previews and desktop PowerPoint compatibility evidence. Browser animation must never enable disabled Smooth/Cinematic effects or bypass approved content, server quotes, payment verification or private delivery.
- Use `anime.js` scopes (`createScope`, `createTimeline`, `stagger`) and `motion` (`motion.dev` spring physics) for reversible UI animation and the 3-second Motion & Intensity preview stage, and always honor `prefers-reduced-motion: reduce`. Lazy-load Three.js and Puter chunks. Dispose controls, renderer, textures and materials; stop render loops while hidden/offscreen. Keep accessible slide navigation and a usable 2D view when WebGL fails.
- A Puter response is not proof of factual accuracy, provenance or server authorization. Review and edit generated content before promoting it into the immutable production workflow. No fictional citations or fabricated customer evidence.

## Verification

Run the studio typecheck (`npm.cmd --prefix frontend run typecheck:studio`), Puter boundary tests (`npm.cmd --prefix frontend run test:puter`), existing DOM tests (`npm.cmd run test:frontend`), frontend build (`npm.cmd run build:vercel`), and Playwright Chromium tests (`npm.cmd --prefix frontend run test:studio:browser`). Use the real browser for layout, keyboard navigation, mobile overflow (`390x844`) and storyboard behavior. `frontend/scripts/build-browser-harness.mjs` generates an explicitly labeled fixture page for local interaction checks; that proves controlled UI behavior, not live AI generation. A normal build removes these temporary pages.

For live provider checks, distinguish public catalogue discovery, account authentication and actual charged generation. Never claim a stubbed SDK call proves live provider behavior. Current upstream references: https://docs.puter.com/AI/chat/ , https://docs.puter.com/AI/listModels/ , https://animejs.com/documentation/scope/ , https://motion.dev/docs/quick-start , https://threejs.org/manual/pages/how-to-dispose-of-objects.html .

Inspect `docs/ROADMAP.md` and `docs/STATUS.md` before claiming release readiness. Deployment, shared database changes and payment activation retain the existing authorization boundaries.
