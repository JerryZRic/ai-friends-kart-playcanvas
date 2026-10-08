# Waterpark scene study 01

Status: unpublished two-map prototype. The original coast retains its kart circuit and physics. Waterpark has separate water-mount handling and a bounded 285 m trial. Baseline character files and the Windows release are unchanged.

## Review locally

- `npm run dev`, then open `/waterpark.html` in a WebGL2-capable browser
- `node scripts/build-waterpark.mjs` produces `dist-waterpark/`, independently of the main `dist/`
- The map menu on the original game links to the new playable sample. Choose one of the six existing rigged characters, accelerate with W/Up, brake with S/Down, steer with A/D or arrows; Esc/P pauses and R restarts. On-screen controls support touch. The course ends after 285 m rather than teleporting around an unfinished lap.
- `/waterpark-study.html` retains play/pause, scrubbing and the 18-second camera-only composition study

## Scope

Original native PlayCanvas meshes: 285 m view section with a straight, wide 100-degree bend and short bridge. Layered ivory/cream/turquoise banks, railings, palms with curved leaf meshes, striped parasols, pavilions and an original pink observation tower. Shared color batches reduce draw calls. A metre-based UV field keeps water flow, bank foam and bridge shading aligned through the bend. No reference-video images are used as textures.

`src/waterpark-design.ts` produces the actual mesh data. `src/waterpark-scene.ts` turns it into native PlayCanvas mesh instances. `src/waterpark-water.ts` owns animated opaque water; both GLSL stages defer precision to the engine to prevent cross-stage uniform precision mismatch.

`node --import tsx scripts/export-waterpark-preview.ts /tmp/waterpark-design.json` exports the exact geometry and cameras for offline art inspection. Offline Blender renders use an approximation of the water shader and lighting, and are not gameplay screenshots or proof of browser GPU rendering.

## Two-map architecture

`map-profiles.ts` declares coast/kart and waterpark/water-mount identities. Separate entry pages keep the existing kart game intact. `waterpark-motion.ts` owns acceleration, water drag, lateral inertia, bank response and finish/reset state. `water-mount.ts` owns original whale geometry and character-seat adaptation. `waterpark-wake.ts` draws a single-mesh pair of animated foam trails. The waterpark sample does not yet implement full closed-lap AI racing or NPC item battles. Six-character assets are reused without modifying their source meshes or animations.

## Verification boundary

TypeScript, native NullGraphicsDevice scene construction, water topology/UVs, camera frusta and engine-generated shader interface precision are testable without a GPU. Native browser GPU compilation, final water appearance, six-character frame time and driving feel still require a WebGL2-capable browser. This prototype is not a finished art-quality or performance acceptance.

To reproduce an offline geometry review after exporting JSON:

`blender -b -t 6 --python scripts/render-waterpark.py -- /tmp/waterpark-design.json /tmp/waterpark-renders`

The renderer uses CPU Cycles without denoising and saves two PNGs plus an editable Blender scene. It intentionally does not claim shader/GPU parity with the PlayCanvas build.
