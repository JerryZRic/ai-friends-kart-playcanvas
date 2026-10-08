# Waterpark scene study 01

Status: published two-map sample, with a bounded material/water refinement pass. The original coast retains its kart circuit and physics. Waterpark has separate water-mount handling and a bounded 285 m trial. Baseline character files and the Windows release are unchanged.

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

`map-profiles.ts` declares coast/kart and waterpark/water-mount identities. Separate entry pages keep the existing kart game intact. `waterpark-motion.ts` owns acceleration, water drag, lateral inertia, bank response and finish/reset state. `water-mount.ts` owns original whale geometry and character-seat adaptation. `waterpark-wake.ts` draws fixed-size, batched foam ribbons and ballistic spray droplets (two draw calls). The waterpark sample does not yet implement full closed-lap AI racing or NPC item battles. Six-character assets are reused without modifying their source meshes or animations.

## Verification boundary

TypeScript, native NullGraphicsDevice scene construction, water topology/UVs, camera frusta and engine-generated shader interface precision are testable without a GPU. Native browser GPU compilation, final water appearance, six-character frame time and driving feel still require a WebGL2-capable browser. This prototype is not a finished art-quality or performance acceptance.

To reproduce an offline geometry review after exporting JSON:

`blender -b -t 6 --python scripts/render-waterpark.py -- /tmp/waterpark-design.json /tmp/waterpark-renders`

The renderer uses CPU Cycles without denoising and saves two PNGs plus an editable Blender scene. It intentionally does not claim shader/GPU parity with the PlayCanvas build.


## Water and materials refinement

The approved `waterpark-motion.ts` handling is unchanged. Visual surface following uses a shared three-wave analytical field in `waterpark-surface.ts`; that same coefficient table emits CPU heights/derivatives and GLSL displacement/normals. Maximum displacement is 12.7 cm. The mount follows the sampled height and slope without feeding changes into speed, lateral inertia, banks or the chase camera. Its small swimming animation remains layered on top.

Water uses air/water Schlick Fresnel reflectance, directional fine normal ripples and real planar scenery reflections. The reflection helper is the version already bundled with PlayCanvas 2.23.1, without an engine upgrade. Only static scenery is captured; the mount, wake and water are excluded to avoid recursive reflection. One half-resolution color/depth render target is capped at 768 pixels on either axis, with no additional reflection shadow maps. This is a mean-water-plane reflection, not curved-surface ray tracing.

Shallow/deep absorption color and caustic-like bed highlights use authored canal depth, **not** screen-space scene depth or true refraction. Bank foam follows the known canal edges. The foam wake bends with lateral velocity and follows the same wave heights; fixed-count spray follows short ballistic arcs. These are bounded visual approximations, not a Navier–Stokes fluid solver, SPH simulation, particle collision system or PhysX integration.

Scenery materials distinguish rough stone, matte paving/fabric/plants, painted tile, wet edge surfaces, metal and glass-like windows. A generated prefiltered sky/ground lighting atlas supports their material response; it is not a dynamically captured scenery reflection. Added details are batched to preserve broad near/mid/far composition: 65,480 geometry triangles and 28 scene render batches including water/sky (before the mount and two wake/spray draws). The environment atlas plus three mipmapped normal textures use 327,676 bytes. At the maximum 768×768 reflection target, color plus 32-bit depth is approximately 4.5 MiB; actual depth allocation is backend-dependent. No external textures, models or downloaded HDRIs are introduced.

Validation includes exact CPU wave gradients, normalized surface normals, shared shader coefficients, finite/clamped wake/spray data, original pause/restart/asset loading lifecycle coverage, null-device reflection/material resource checks and shader precision checks. Production/source/privacy checks remain required before publishing. These tests do not establish browser GPU shader compilation, final reflection appearance or actual frame times. Those remain explicit visual/performance acceptance checks on a WebGL2-capable device.
