# Snow008 additive scenery QA

This work enriches the existing Frostloop Depot scene. It does not add a twelfth map, change the shared gameplay/camera implementation, publish a preview, alter main, or package Windows.

## Immutable origin

Clean local source commit: `1005abd2b09b49310c8a8387de10e674ad9ee6ce`. It includes earlier unpublished Workshop/Harvest/Desert candidates; the original Snow source is unchanged from the verified public Snow version at dev `915109353ed1d2fcdc8afbb5bdacafca3648e92e`.

Original builder SHA-256: `a33aa52b70e3a234bacccdacbb24f9259c2e010780a4cc56979f0f16d9cf4486`. Its unchanged source and three original test files are preserved under `docs/scene-baselines/`. `tests/fixtures/snow-enrichment-original-geometry.json` freezes the original export, all 6,339 ordered component records and full per-batch buffer/material/normal hashes. That fixture is itself pinned to SHA-256 `b36d22a2608ae65811f9623a9a7f10405ac9f91acf774f756e6d21aa6bbca9e9`.

The original geometry is exactly 23 batches, 106,286 triangles, 155,970 vertices, nine camera blockers, five landmarks and 14 wheels. The historical physical terrain and non-macro goldens remain unchanged:

- Physical grid: `21b5990a647cc49c9b527c56a7af222f24e9a350328dbf3ac5d3c73df25f9f5c`
- Original non-macro triangles: `f28d831186a27c39497a69ed70cc59521cd321ab60f70a12debff57cbe5b3be9`

## Exact permitted test transformations

The authorized Snow-only total triangle ceiling is `<120000`, with a separate maximum `12000` added triangles. Exactly 23 batches and `<200000` vertices remain required; the new append ledger additionally caps added vertices at 30,000. No original geometry is removed to make room.

Only these three existing numeric comparisons change from 110000 to 120000:

- `tests/snow-scene.test.ts`: `triangles<110000`
- `tests/snow-independent-audit.test.ts`: `triangles<110000`
- `tests/snow-preview-assets.test.ts`: `p.triangles<110000`

A separately reviewed non-numeric adaptation adds the `assertSnowOriginalProjection` import and changes only the iteration input of `nonMacroTriangleHash()` to that helper. Before returning the original projection, the helper certifies all 6,339 original records in order, every original kind/role/landmark/range, and all original indexed position/UV/index prefixes. It rejects original removal, reordering, range shortening and buffer mutation. The historical digest is not replaced. A separate full geometry test checks computed normals, all original metadata and camera blocker prefixes, as well as every new component. The original non-budget native assertion bodies remain byte-identical.

## New actual-geometry proof

The independent audit reconstructs triangles from indexed batches. Claimed bounds, component labels, terrain convenience queries and filled building boxes are not proof. It checks complete index and vertex ownership, closed consistently wound shells, positive outward volume, self-intersection, full terrain-following bottoms, actual support-contact graphs, broad seat coverage, full road-body/overhead clearance, true voids and exact per-assembly camera payloads. It checks new/new and new/original contacts, positive-volume intersections and exposed duplicate skins. Convex burial is accepted only after actual convexity is established.

The original full camera loop is retained. The explicit serial retained runner requires exactly 333,486 desired-safe and 333,486 genuinely interpolated booms, 29,160 transition frames, 1,440 pickup rays and 12,920 review rays. Its receipt must be fresh for the candidate. Additional frozen-camera/local-motion coverage does not replace the original matrix.

Historical boulevard distance 330 points away from the clock hall. It remains a regression view. Clock approaches at distances 100, 160 and 220 are separate fixed forward views. All five original catalog matrices remain fixed. Architectural detail shots and target-facing road-eye views are not relabeled as ordinary forward driving.

Additional camera coverage contains 259 stations spaced 3 m apart. Its 120,456 segment inspections are 36 frozen/current-normal records, plus two segments for each of 2,376 fixed pose cases, 51,282 dense pose cases and 6,552 moving frames. Static and dense cases check safe and interpolated booms; moving frames check the boom and frame-to-frame movement segment. Baseline and candidate runs are separate; the total does not add them together. Exact endpoint comparison records any candidate camera change.

## Serial validation commands

Run only after the art owner releases the heavy slot, with a disk-backed TMPDIR. The parent coordinates final repository-wide CI.

1. `NODE_OPTIONS=--max-old-space-size=448 node --import tsx --test --test-concurrency=1 tests/snow-enrichment-oracles.test.ts tests/snow-enrichment-inventory.test.ts`
2. `NODE_OPTIONS=--max-old-space-size=448 node --import tsx --test --test-concurrency=1 tests/snow-enrichment-geometry.test.ts`
3. `NODE_OPTIONS=--max-old-space-size=448 node --import tsx --test --test-concurrency=1 tests/snow-enrichment-camera.test.ts`
4. `NODE_OPTIONS=--max-old-space-size=448 node --import tsx tests/helpers/run-snow-retained-audit.ts --defer-preview` runs twelve safety suites before catalog production. After final poster/provenance freeze, `--complete-preview` runs the thirteenth preview suite and combines the two explicitly recorded phases only if every production source, original test, projection helper and original geometry fixture is unchanged. With finalized catalog assets already present, omit the flag to run all thirteen in one phase.
5. Run the explicitly affected earlier-scene isolation consumers after final Snow source/poster/provenance freeze, preserving all nested original goldens and recording every reviewed path/hash
6. Typecheck, build/dist validation and final exact-source GLB/BLEND reopen parity belong to the coordinated final candidate validation

A command listed here is not evidence it ran. Passing, failed and never-run stages belong in the final receipt. Exact-source offline images use approximate material/lighting behavior and are not browser, GPU, native-pixel or FPS verification. Publication remains on hold until separately authorized.

## Accepted source and fresh local safety results

Accepted source SHA-256: `1557a21c49f17bdffcaf8c03eb326dbd73d7bde56356b39889e65632d7bd7cc9`. It emits 114,800 triangles (+8,514), 172,192 vertices (+16,222), exactly 23 batches and 165 appended closed pieces in 12 assemblies. All original 6,339 component records and original indexed buffers, generated normals, UVs, materials, terrain/route metadata and nine-blocker prefix remain exact.

The 2026-10-11 local safety phase passed all 103 tests across twelve original suites. The independent suite freshly executed all 25 original checks, including the complete 333,486 desired-safe and 333,486 interpolated boom matrix. It also retained all 29,160 transition frames, 1,440 pickup rays and 12,920 driver-review rays. The thirteenth original preview-assets suite is deliberately a second phase after final source-matched poster/provenance generation; the combined runner refuses to credit the first phase if production/native proof inputs changed.

Fresh targeted geometry checks pass 165 closed outward shells, zero self-crossing failures, all 25 terrain-root footprints, zero exposed coflush areas, zero unrelated positive-volume intersections and zero non-root terrain intrusions. Each of the six 0.6348 m² trunk feet has zero uncovered support area; each root slab follows its complete terrain footprint at −0.04 m, including a 2.13 m terrain rise across one footprint. Lower snow mantles contact their crown and continuous trunk; only the actual crown surface is credited for broad underside coverage. Six explicit opening rays and 165 exposed-part witnesses prevent treating an open assembly as a filled box or accepting fully buried decoration.

The additional baseline/candidate camera check completed the 120,456 comparisons described above with no output-coordinate changes and no source-mesh clearance witnesses. Each scene has 1,147 raw-desired retractions in its static/dense matrix; the candidate adds none. The five negative-control tests reject original component changes/removal/reordering, missing terrain-footprint corners, floating broad caps, open/reversed shells, missing/duplicate ownership, buried intrusion, duplicate skins, thin camera blockers and under-terrain camera paths.

Independent QA inspected the actual baseline/V7 draft pixels for both bowl forward-eye views. They show the new middle-ground forms, visible trunk/base connections and an unobstructed road in the identical frame. QA also inspected the final 48-sample forward clock-approach and service-yard pairs: the original clock/roundhouse silhouettes and road exits remain visible; the added annex and open maintenance shelter do not close the original bays. These four independently inspected pairs are not the complete thirteen-view art receipt, a complete native visual inspection or GPU/FPS verification. Final catalog, model and thirteen-view evidence is tracked separately by the art owner.
