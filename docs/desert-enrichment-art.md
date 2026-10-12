# Sunweave Caravan: layered shoulders and caravan-court district

## Design and source scope

This extends the existing Desert007 scene with original procedural geometry. It does not add a course. The physical roads, terrain grid, original scenery, arches, five hero landmarks, AI, controls, physics, route choices and shared camera/runtime source are preserved.

The comparison baseline is local commit `077d232f4b4160d8928cce8cd85d0008c7212747`, which includes unpublished Workshop/Harvest candidates. Its Desert source is the original scene. The last verified public dev head at the time of the freeze was `915109353ed1d2fcdc8afbb5bdacafca3648e92e`. Neither the baseline nor these local previews proves a new public deployment.

Original allocation: 107,224 triangles, 133,911 vertices, 22 material batches. Approved Desert-only limits: fewer than 125,000 triangles, fewer than 200,000 vertices, exactly 22 batches, and no more than 16,000 added triangles. The budget is an upper bound, not a target. The current candidate emits 118,490 triangles (+11,266), 154,180 vertices and the same 22 material batches.

## Compositions

- A long, low sandstone shoulder on the eastern crown provides a broad foreground-to-middle-distance silhouette beside the retained small original rocks. The mass has an inclined apron, interrupted course widths and a lower trailing end.
- An inner descent bench gives the opposite side of the sequence a second substantial profile. Its placement retains sky over the road exit, the original far arches and the open basin release.
- Three unequal open work bays form an exterior crescent along the Sailcourt Sweep. The original three-sail hero court stays in its original location. The new district uses cream and ochre sagging cloth, load-bearing posts, knee braces, split low entry edges, rear work benches and one substantial loading table with stacked covered crates and an open amphora.

The first interior/northwestern court layout was rejected after fixed forward renders: it appeared at the late bend but was nearly absent from the 175 m and 230 m forward approaches. The accepted direction relocates the secondary bays into safe outer-sweep pockets across the road from the original court. No member bridges or crosses the road. The western bay was then shifted to create a visible continuation ahead at 290 m. This is a geometry/layout revision, not a camera retargeting.

No kiln-yard extension was added. The two priority compositions receive the available attention rather than using the remaining budget for unrelated small props.

## Construction

All new positions, indices, UVs and components append after the original indexed batch prefixes. New exact-triangle camera blockers append after all original blocker payloads. Materials and original calculated normal prefixes remain unchanged.

The two rock assemblies consist of successive closed courses, with measured shared cap interfaces. They are not nested ornamental sleeves. Their lowest faces are clipped from the actual unchanged terrain triangles with 0.04 m intended foundation embedment. The court platforms use the same full-footprint terrain contact, preserving the terrain's original cell diagonals instead of relying on a center-height sample.

Every added piece has a distinct `desert-enrichment-` kind, an assembly-owned ID and named structural supports. Ground contact and variable-height rock seat face ranges are explicit. A directed-edge closure check reconciles newly generated multi-face solid winding and rejects an open/nonmanifold seam. The independent audits remain responsible for proving actual mesh contact, footprint support, clearances and camera coverage.

The bays have real openings, not hidden closed proxy boxes. Their thick cloth sheets span supported eaves; seams are seated on the sheet. The main near-bay loading table has four feet, two bearers, sixteen separate deck slats, two stacked covered crates and one supported open amphora. The other two bays remain mostly open. Narrow attached cream/ochre fabric valances reuse existing cloth colors without modifying original material values. Nothing changes the original sailcourt's exact three cloth frames or twelve posts.

## Frozen pixel comparison

`desert-enrichment-cameras.json` freezes 30 source-derived poses before scenery edits and retains the five original catalog transforms. The primary gate uses eight forward comparisons (the final representative set adds the two release views, five original catalog views, two arch driving witnesses and the spire approach for exactly 18 pairs):

- Crown 820 m: road eye and shared chase
- Descent 1050 m: road eye and shared chase
- Sailcourt approach 175.44967945926842 m: road eye
- Sailcourt middle 230 m: shared chase
- Sailcourt continuation 290 m: road eye and shared chase

Road-eye poses use sampled road +1.6 m and a sampled road target 32 m ahead. Shared chase uses the unchanged view-0 camera, zero yaw/pitch, rear view off and baseline `safeLandCamera` result. The primary viewport is 1280×800, vertical FOV 56°, clipping 0.12–2200 m. Unrendered frozen poses are available transforms, not image evidence.

Both sides use the same source materials, procedural pixels, light, exposure, renderer and camera settings. Draft pairs use eight CPU samples without denoising. The renderer verifies every imported position and normal against exact float32 source values. Shading uses the source-normal POINT attribute, object-to-world normal transformation, normalization and two-sided facing sign; it does not rely on Blender's potentially lossy custom-corner encoding.

The final set contains exactly 18 pairs at 48 CPU samples, including the original five catalog transforms. All 35 frozen cameras are retained in the reusable BLEND; the other 17 are optional transforms, not rendered evidence. The forward `eye-spire` pose shows the road at the spire station, with the landmark cropped along the right edge. It supports road-exit preservation rather than a centered landmark-visibility claim.

These are offline static source-geometry previews with approximate Blender light/material response. They contain no kart, driver or HUD and are not native gameplay/GPU captures or frame-rate evidence. No offline-only shader change supplies the enrichment.

## References and originality

The design draws only general composition lessons from official Mario Kart 8 Deluxe and Team Sonic Racing stills: broad lateral masses, several depth layers, grouped architecture and a legible next bend. All geometry is authored in this project's source. No reference image, game model, route, branded feature or downloaded asset is shipped.

Official source pages studied:

- https://www.nintendo.com/en-gb/Games/Nintendo-Switch-games/Mario-Kart-8-Deluxe-1173281.html
- https://sonic.sega.jp/TeamSonicRacing/game/

The existing procedural texture families and original 22 material batches are reused. A cloth label does not imply new cloth-weave pixels or a normal map. Source-built geometry and scripts follow the project's existing AGPL-3.0-only provenance.

## Verification status

The frozen scenery source is SHA-256 `aa2ad6819309066caa4a7acd74f3df55a037358c9c9f3c551a0d0bcbf5ccf713`. The independent emitted-mesh audit preserves all original batch/normal/component/camera prefixes and passes 147 closed outward new solids, five full terrain-contact surfaces, 214 named structural contacts, all 11,266 added faces in five exact camera payloads, and zero unrelated intrusions or exposed duplicate skins. It measures intended local structural joins individually, without a whole-assembly exemption.

Retained final-source QA passes typecheck, all 107 original Desert source tests, eight added geometry/inventory/oracle checks and the added camera matrix. The latter includes 2,970 static poses and 8,190 moving frames with no camera changes or witnesses. The fresh original independent audit passes all 24 checks, retaining 100,188 course poses, 54,720 dense-arch poses, 46,656 transitions and 1,296 pickup rays. See `desert-enrichment-qa.md` for the test scope and receipt distinctions.

Both final BLEND files were reopened and checked against their exact source data: indexed positions, normals, UVs, material factors, source-normal shader links, packed texture pixels and all 35 cameras. Each companion GLB passes all 88 accessor streams, 22 material records and four embedded texture sets. The final paired proof verifies exactly 18 identical-input camera pairs at 48 samples. Only after those checks did the guarded updater regenerate the local poster and the five-view and 18-view provenance records. The three labeled short comparison sheets supplement the complete full-resolution pairs; they are explicitly scaled previews, with no source-image retouching.

Final shared-consumer, preview-contract and build verification retain their own receipts. This art document is not a blanket QA or publication certificate.

## Reproduction

Export current source with `node --import tsx scripts/export-desert-preview.ts OUTPUT`. For the eight frozen draft views, use `blender -b -t 2 --python scripts/render-desert-enrichment-preview.py -- OUTPUT`. `--samples 48 --final-set` renders the bounded 18-view final set. `--catalog` adds the five original catalog poses to a draft selection. The renderer never updates repository poster/provenance files. `--views` accepts named frozen poses without refitting. `--resume` accepts only hash-identical source, geometry, renderer, cameras and settings.

Reopen the saved BLEND for `scripts/verify-desert-enrichment-model.py` to compare all source positions, indices, UVs, normal POINT values, shader links, packed textures, camera transforms and companion GLB streams. A successful render alone is not this reopened-model proof.

After reopening and verifying both final models, run `scripts/verify-desert-enrichment-pairs.py BASELINE CANDIDATE` to establish the exact 18-pair receipt. Only then may `scripts/update-desert-enrichment-catalog.py CANDIDATE` update the local Desert poster and provenance; it checks current source, image, model and proof hashes before writing. Neither script publishes, pushes, deploys or changes main/stable/Windows outputs. `scripts/compose-desert-enrichment-comparison.py BASELINE CANDIDATE OUTPUT --final-set` creates all 18 full-resolution labeled pairs, a complete thumbnail sheet and three shorter comparison sheets, each below 10 MiB.
