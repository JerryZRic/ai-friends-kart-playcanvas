# Cloudridge Pass: existing-scene enrichment

This is an initial structural/readability pass. Some driver-height views still look sparse and muted; stronger visible planting groups, color accents and landmarks remain the next art-direction target.

This update enriches Mountain001, **云岭盘山道**, inside the existing shared kart game. It does not introduce a twelfth new course. The original route, driving support, grade/camber, controls, NPC behavior, item timing and ordered checkpoint semantics remain protected by pristine-source and native-state fixtures.

## Art direction

The original isolated tall rock shapes are replaced by connected terrain: lower roadside banks, grouped spruce/talus middle ground, and set-back mountain silhouettes with asymmetric peaks and saddles. Local mineral patches follow the authored landforms rather than a constant-height stripe around the world. Broad distant surfaces use muted untextured materials; masonry and timber retain close-range procedural detail. The high viaduct deliberately leaves a more open skyline.

The cedar lookout has a grounded terrace, supported porch truss and balcony, chimney, founded approach steps and a lower canopy. Its complete roof remains visible in the unchanged architectural comparison camera. Existing road edges and rails are preserved; restrained advance-chevron groups clarify selected bends without implying another route.

The two selected original Alpine Campsite props are a picnic table and ranger relief-map station, together retaining all **6,152 source triangles** at unit scale. Their original buffers are preserved. Explicit integration pads seat their authored feet, and nine tiny mounting pieces (108 triangles, separate from that original count) support raised map-relief layers. Two additional 8×68×8 mm coral cloth-edge bindings (24 triangles) cover the picnic model’s original narrow cloth/cedar duplicate surface strips, about 1.14 cm² total, without changing either source mesh. Their source provenance, original spacing and the limited scope of shell/contact checks are documented in [ALPINE-PROP-NOTICE.txt](../ALPINE-PROP-NOTICE.txt) and [the authoring README](../models/alpine-campsite/README.md). The full private theme collection is not included.

## Reference study

The transferable reference principles were observed in official course imagery:

- [Nintendo: Mario Kart 8 Deluxe courses](https://www.nintendo.com/ph/switch/aabp/course/index.html), including [Mount Wario](https://www.nintendo.com/ph/switch/aabp/assets/images/course/detail/3-4.jpg): legible road edges, grouped roadside masses, distinctive skyline gaps and distance layers
- [Nintendo: Mario Kart World](https://www.nintendo.com/en-gb/Games/Nintendo-Switch-2-games/Mario-Kart-World-2790000.html): readable landmarks and a deliberate hierarchy between road, middle ground and background
- [SEGA: Sonic Racing CrossWorlds courses](https://sonic.sega.jp/SonicRacingCrossWorlds/courses.html): thematic landmarks and composition that keeps the driving corridor readable

These are visual references, not asset sources. No reference screenshots, copied course layouts, characters, logos or third-party meshes are included in the game or reusable model package.

## Honest before/after method

The baseline contains eight actual shared-chase poses with **56-degree vertical field of view**, one overview and one separately identified historic **36 mm architectural camera**. A separately frozen lower-underpass approach adds an eleventh comparison. Both sides use identical camera positions, rotations, projection, light/exposure and source-normal shader translation. Every runtime scenery batch stays enabled. An additional final topdown or terrace detail is separately identified and never substitutes for a locked comparison view.

The first enrichment draft was rejected because its continuous striped cliffs and raised lookout platform weakened the same-camera view. The revised scene restores separate foreground/middle-ground/background layers and the complete roof silhouette. Source-derived offline previews use Blender CPU rendering and approximate material/light translation; they are **not browser gameplay or GPU captures**.

## Budget and validation boundaries

The scene contains **22 static material batches, 181,125 vertices and 109,984 triangles**, versus the original 20 batches and 78,158 triangles. Four existing 64×64 procedural textures are reused. Selected-course lazy imports keep this scenery out of the initial coast/water load. Vehicles, gameplay effects and item pools are additional. These are source measurements and numeric budgets, not measured FPS or GPU-memory figures.

[The independent focused verification receipt](mountain-enrichment-verification.md) records the exact finite coverage, negative envelope result and resource use. It is separate from release-wide tests and deployment. Protected fixtures compare exact road positions, triangle indices and UVs; 4,098 route stations across five lane offsets; gameplay/control source hashes; and the complete native physical-state stream. Independent emitted-mesh checks reconstruct terrain ownership, actual surface contacts and camera clearance from the source triangles. Native vehicle checks refresh skin palettes before using real model bounds and refine candidate contacts against weighted triangles. The test reports state their finite sampling coverage; they do not establish safety for every imaginable camera angle or external model.

The original bridge retains all 46 pier placements and its construction dimensions. A deliberately conservative unretracted orbit cylinder of radius 16.5109 m intersects those piers. This is retained as a limitation: unrestricted continuous-angle camera travel without retraction is not certified. The separate mandatory camera checks include those same faces and test the actual safety-adjusted booms and smoothed motion; the full 3.2 m driving-body prism is checked independently. The negative envelope result is not hidden by widening the bridge or excluding its supports.

The enriched camera payload is consolidated from 270 per-group blockers to two indexed blockers (exact non-terrain triangle multiset plus exact terrain heightfield). A separate-process, 3,600-query headless sample across 1,200 distinct camera inputs retained identical input/output hashes while median query CPU time changed from 0.3218 ms to 0.0890 ms and p95 from 0.5640 ms to 0.2471 ms; cold setup was 51.9822 ms versus 53.9023 ms. Post-query V8 heap was 68.9969 versus 68.5163 MiB and measured peak RSS 333.3633 versus 343.0703 MiB. Cold setup and peak RSS did not improve in this final receipt. The reproducible script is `scripts/benchmark-mountain-camera.mjs`; [both exact receipts](mountain-camera-benchmark.json) retain their source and input/output hashes. This compares the ungrouped and consolidated **enriched** scene, not the original empty-blocker implementation. It is a bounded CPU sample, not a GPU/FPS or universal timing claim.

Original shared fixed item boxes still respawn after eight active seconds. Dynamic-row reaction-gap logic does not make that guarantee for every fixed-row respawn. No new Windows package is included. Device playtesting remains necessary for real GPU lighting, frame rate and control feel.
