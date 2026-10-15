# Home portraits and optional Live2D preparation

Branch baseline: `dev` at `4357252f2a356b46426419325e4fb3ff70b2f053`.
This branch does not change `dev`, `main`, release workflows, or Windows packaging.

## Implemented

- Six-entry registry in `src/home-cover-registry.ts`. All six portraits are approved. The five v1 drawings were explicitly approved before integration; v2 is not used. Runtime WebP derivatives preserve the original transparent v1 source dimensions; original PNGs remain archived, with source hashes in home-cover-assets.json.
- Uniform random choice among approved entries, remembered in a WeakMap for the current Document. SPA navigation and menu remounts retain it; a new page load chooses again. This does not change the race driver or persist a preference.
- Existing 1600×900 stage and `object-fit: contain` portrait box remain unchanged (left 64%, top 26%, width 30%, height 64%). Portrait, logo and menu stay proportionally framed.
- Portrait network failure retries the approved DeepSeek PNG once, then hides a broken image rather than looping.
- Original runtime-neutral adapter lifecycle: deferred loader, static image until a rendered model is ready, reduced-motion/visibility suspension, resize, context-loss fallback, abort and late-result cleanup. No adapter loader is wired into production until the gates below are resolved.

## Art handoff

Approved full-body v1 sources are encoded as transparent WebP runtime derivatives. The five new entries use non-destructive framing (1.65×, top-center) to bring the face/upper-body scale closer to the existing three-quarter DeepSeek composition. The enclosing portrait frame clips excess artwork without changing the source image or menu layout. Loading a fallback resets framing. Only the selected image is fetched. Current fallback is `public/menu-art/whale-maid.png`; logo is `public/menu-art/title-logo.png`.

Static PNGs are not rigged Live2D assets. After approval, separate the drawing into appropriate layers and construct/QA a genuine model in an authorized Cubism Editor. A browser model handoff normally includes `.model3.json`, `.moc3`, textures and any referenced physics, expressions and motions. The adapter's `mount` must resolve only after its first valid rendered frame, honor cancellation, and release its own animation loops, GPU resources and listeners on disposal. Do not emulate a rig by swaying a flat image.

## Licensing gate (checked 2026-10-15, not legal advice)

No Live2D software has been downloaded, accepted, bundled or relicensed here. This original adapter contract has no SDK dependency.

- [Official Web SDK overview](https://docs.live2d.com/en/cubism-sdk-manual/cubism-sdk-for-web/): Cubism Core is proprietary and not published in the official GitHub repository.
- [Core agreement](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html): redistribution is limited to identified redistributables and conditions; it cannot simply be labelled AGPL or put under AGPL source/modification obligations.
- [Framework agreement](https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html): source availability is not an unrestricted permissive license. Sections 5.6/5.7 restrict incompatible-license combinations and relicensing; retain notices and review distribution terms.
- [Publication policy](https://www.live2d.com/en/sdk/license/): qualifying individuals/small businesses have exemptions, except expandable applications. Do not assume a paid publication contract is required, or that a free game automatically qualifies. SDK agreement acceptance and publication eligibility are separate issues.

The repository is AGPL-3.0-only and its NOTICE names JerryZRic **and contributors**, preserving earlier-project provenance. Ownership of all relevant rights has not been established. Before real SDK integration, establish an authorized compatible licensing path (including relevant rightsholders if an exception is needed) and explicit acceptance of SDK terms. Dynamic import or a separate file is not a licensing workaround. Model/art rights remain a separate review; SDK permission does not license the illustrations.

## Verification

Focused tests: `node --import tsx --test tests/home-cover.test.ts tests/menu-spa-lifecycle.test.ts tests/title-menu.test.ts`.
Typecheck: `npm run check`. Compilation: `npx vite build`.
These are targeted development checks, not full stable-release certification. The full asset snapshot is available for game builds. The separate `npm run build:cover-preview` produces only the visual-review homepage, a static backdrop and its seven portrait/logo assets; game buttons link to the existing ../dev/. This avoids duplicating the full game on Pages. No real Cubism playback or final new-art browser QA can be claimed before SDK/model/art gates pass.

Local browser launch was blocked by process socket EPERM and the cloud browser could not access the executor localhost. Final browser composition QA is performed against the separately deployed preview; do not treat compilation as visual QA.
