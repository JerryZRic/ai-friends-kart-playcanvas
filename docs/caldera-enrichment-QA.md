# Basalt Crown append-only QA

The immutable pre-edit source is commit `70e66387b09c50a1ed8244048089cea2269e426e`. The original scene has 95,132 triangles, 126,320 vertices, 21 material batches and 2,715 component records. This pass keeps the original strict 110,000-triangle and 200,000-vertex ceilings, and additionally limits additions to 12,000 triangles and 30,000 vertices. There is no budget increase.

## Independent original witness

`tests/fixtures/caldera-enrichment-original-geometry.json` was frozen before scenery edits from the untouched exporter output. The freeze checked every recorded exporter input against the immutable Git commit and the still-untouched worktree. Exported normals were independently recalculated. The fixture includes exact original component records and material values, complete indexed/position/UV/normal buffer hashes, camera-obstacle prefixes, terrain and route metadata, viaduct and geological assembly records. The immutable export SHA-256 is `d3d8825822cc7407905bc8d61e80fbb5699b04171c92076cc1d846f905f32ff5`; the fixture SHA-256 is `9de28b035c62c3236eddc3f9200dbf777ac40feb798379faec87526f8a43bb70`.

The 40 source-frozen forward/chase transforms retain the same native 56-degree vertical field of view, 1280×800 draft viewport and exposure/material/light settings. Five original catalog cameras are separate evidence. Actual source-frustum intersections are numerical visibility evidence, not a substitute for visual art review.

## Gates, in order

1. Compare source-matched baseline and candidate forward/chase images before retaining long checks. Both priority compositions must meaningfully improve broad near/middle/background forms without hiding the original landmarks or next bend.
2. Independently freeze explicit assembly recipes, full support graph, actual opening rays and external-surface witnesses. Geometry proof reconstructs all indexed triangles rather than trusting scenery bounds or labels. It checks whole terrain-conforming feet, whole flat feet, complete roof bearing seats, closed outward shells, finite indexed buffers, unique ownership, body/road prisms, unrelated positive-volume intersections and exposed coplanar skins. Runtime opaque payloads must exactly equal actual faces; true openings stay empty.
3. Run mutation-sensitive QA for altered original buffers/records, lifted feet, missing roof seats, road intruders, missing camera walls, filled openings, inverted shells and duplicate skins.
4. Run all 13 original Caldera test files, including all 30 independent assertions without changed thresholds, filters or loops. Required retained coverage: 463,272 desired-safe whole booms, 463,272 genuinely interpolated booms, 29,160 transition frames, 1,440 pickup rays, 750 dense lower-arch orbit frames and 5,265 source-frustum rays.
5. Compare every original safe/interpolated output pose against a fresh immutable-baseline build. Original camera behavior includes 2,896 retractions and one raw desired hit; safe/interpolated collision failures are zero. Additional local/dense matrices supplement the retained tests. Neither fabricated zero baseline counts nor unexplained new retractions are acceptable.
6. Freeze exact source/poster/provenance and reviewed inherited hash consumers. Preserve every nested original source golden. Run the inventory and portable dependency checks, typecheck, aggregate tests and build/dist verification on the exact final state.

## Reproduction and receipts

The tests invoke bounded child processes serially with a 448 MiB Node heap. Use a disk-backed `TMPDIR`. The portable file manifest is `docs/caldera-enrichment-qa-files.json`; it explicitly includes the retained runner and unchanged shared mathematical/process helpers rather than relying on an enrichment filename glob. The runner supports `--defer-preview` for 12 original safety suites and `--complete-preview` for the final catalog test; it verifies unchanged runtime/native inputs between phases. Retained and additive receipts include source hashes before and after execution, exact test coverage and resource limits. A final aggregate must count distinct tests/files rather than counting repeated runs twice.

Current implementation status must be taken from the final execution receipts, not this plan. No native pixels, GPU memory or FPS certification is made. Publication, remote changes, Windows packaging and shared gameplay changes are outside this local QA pass.
