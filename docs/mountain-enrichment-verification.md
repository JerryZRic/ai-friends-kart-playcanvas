# Mountain001 scene enrichment: independent verification

Receipt date: 2026-10-11 UTC. Scope: scene enrichment of the existing closed Mountain001 course. Results below are separate serial, focused/bounded runs, not the final release suite or a publication certificate.

## Source identity and preservation

- Pristine baseline commit: `769911cc562b9330a57f043e9a7f9a2f0a976dac`.
- Final `src/mountain-scenery.ts` SHA-256: `847253b5accf6121ef086c6f111c82f8db93e6fe93a497c1bae287c2a3af9009` (candidate 015).
- The three preservation tests pass. `src/maps/mountain.ts`, protected driver/physics/AI/checkpoint/item/control/shared-camera sources, the other ten land scenes, and protected coast/water sources retain their baseline contracts. Non-Mountain loader/menu branches also match.
- Dense route comparison covers 4,098 stations × five lanes, preserving exact Float64 route frame, width, grade, camber, normal and surface results. The original 960-sample road positions, indices and UVs are bit-identical. The course retains eight sections and one closed route.
- All 46 original bridge piers retain their exact baseline placements, emitted Float64 vertex buffers, UInt32 topology and bounds.
- Native controls reproduce all 19,343 baseline frames and 336 full snapshots. Whole-stream SHA-256: `27cf89ead18334a7f9be62df8a015a13d662293a36bb1987b99698d2e0a04307`; snapshot-stream SHA-256: `7d470a7c970984edf1f1cb7ff7bede62512ca635612d8fef05490523c8fd069a`. Camera output is intentionally excluded because the original loader supplied no camera blockers.

Compact golden fixtures are `tests/fixtures/mountain-source-baseline.json` (SHA-256 `2d872b1677663b72ef8778fd35f82f9c0b94f5b1cbd20a8f49505cdc047f0faa`) and `tests/fixtures/mountain-native-control-baseline.json` (SHA-256 `5446f2bcfd2d6bc14b28bfdc4c93ab0ab7883755678e598cb60d539619fffd63`).

## Emitted geometry and structure

All 12 independent structural gates pass on candidate 015:

- 22 material batches, 109,984 triangles and 181,125 vertices, within the 24 / fewer-than-110,000 / fewer-than-190,000 budgets; 2,275 components.
- One connected terrain field: 42,276 fragments cover 37,000 source field planes with exact single ownership, no unmatched interior edges or area overlaps, and camera-heightfield plane parity. There are 2,583 genuine within-face material-contour splits; maximum contour plane error is 1.14 × 10⁻¹³ m. Terrain density exceeds the original 22,472-face floor.
- The 1,920 road triangles retain a minimum 2.65 m terrain gap over 11,356 actual intersections. The full road-body prism to 3.2 m is clear; 44 original thin marking contacts are separately classified by exact source/height witnesses.
- 1,037 full-footprint foundations/grounded details, 675 root toes and 1,975 declared joints pass. Actual contact graphs cover 260 support assemblies and 3,943 contacts, with 2,245 components connected to ground. Imported multi-shell material primitives are grouped nodes in this graph; this does not certify every original decorative subpart.
- All 176 tested hero/detail components have real external first-hit witnesses: 4,864 rays, 2,924 valid outside/above-terrain eyes and six oblique fallbacks. All 462 raw coflush pairs are strictly buried; zero remain exposed. Burial requires positive interior depth or exact higher-terrain clipping, rather than accepting another coincident outer skin.
- Both full-detail Alpine props retain their original unit-scale primitive geometry and winding. Their 10 picnic and four station low-support shells are seated. Twenty specifically authored relief shells have actual contact paths and visible faces through nine added hidden mounts. Two added picnic seam bindings are visible and subject to the hero-detail test.

## Whole-camera geometry and metadata bridge

The five independent camera gates pass on candidate 014, whose geometry is exactly equal to candidate 015. Candidate 014 builder SHA-256: `f39a2d6d9a7a2f2614c0de140e1db1e0e30544bcee267748adcef314324262e2`.

An independent sequential reconstruction verified all 20 non-contact exported fields, all 1,975 contact identities and all nonpermitted locator values. Only 14 diagnostic `contacts[].point` vectors changed among 16 permitted front-truss/rail locators. Every mesh, blocker, terrain field and other metadata field is identical. Geometry batch digest: `0b0bdee22af7f164f5481f16fa9a64e7b0f05f893a8f0e7156e8b4e3f896792d`; camera payload digest: `fcf0e51c0d1e9b00589ed2749da7aa69e48cbfd0b7b533bd8521dbebc3b19305`.

- Two blockers represent all emitted geometry: 67,708 explicit triangle faces plus the plane-equivalent terrain heightfield. Road, deck and rails remain included. No filled bounding box closes the underpass.
- 458 stations, 266,556 poses and 533,112 desired/interpolated whole booms cover three legal lanes, two views, 24 yaw values, four pitches and rear views. Zero strict 0.3 m safety failures. The record retains 562 raw desired-boom intersections and 20,428 safe retractions.
- Eighteen live smoothing histories cover 12,012 frames at 30/60/144 Hz: zero whole-boom or motion failures; minimum measured motion clearance 0.548925 m.
- In 1,200 isolated CPU queries, median cost was 0.085667 ms, p95 0.221849 ms and maximum 1.682392 ms. Triangle candidates: median 244, p95 550, maximum 4,921. These are sampled CPU query costs, not FPS or GPU performance.

### Retained original-pier limitation

The conservative **unretracted** whole-orbit cylinder is not clear. It covers route fractions 0.875–0.935 (3,164.196654–3,381.170139 m), 434 stations at 0.5 m steps, radius 16.510905487 m, plus 0.3 m safety and 0.75 m between-station allowance. Its vertical span uses the full-lane endpoint range from minimum Y + 1.05 m to maximum Y + 17.810905487 m; global tested Y is 8.983294–25.877611 m.

There are 1,359 face/station contacts with unchanged original pier components 84, 89, 96 and 101 (bents 6, 7, 9 and 10); minimum raw structural margin is −7.148113 m. Within the tested viaduct-structure and road-face set, no additional non-original-pier intrusions were found. This unretracted-cylinder gate did not cover other scenery; the separate safety-adjusted whole-boom checks include all emitted geometry. Raw polygon witnesses are capped at 40; aggregate counts and offending face IDs are complete. Adjacent lane-endpoint travel is numerically bounded at 0.508706 m, not claimed as an analytic spline proof. The actual crossing has 114 overlapping upper/lower face pairs and at least 35.906695 m road-to-road vertical separation.

This negative remains recorded alongside the passing full driving-body, adjusted-camera and motion gates. The original bridge is retained, with no pier exclusion or relaxed safety threshold.

## Assembled native integration and regressions

- `tests/mountain-enrichment-gameplay.test.ts` passes on candidate 015: 22,734 poses of six actual authored kart/driver builds, full-route 32 m stations and dense 4 m structure/section-boundary poses, three legal lanes and yaw −0.36/0/+0.36 with controller animation.
- The renderer's `updateCpuSkinMatrices` runs before reading each mesh-instance AABB. Coverage includes 1,136,700 individual mesh bounds, 318,069 scene candidates and 478,183 exact weighted/skinned refinements. There are zero obstacle penetrations and zero actual support-triangle intersections; 113,136 local support-bound contacts are retained separately.
- All 96 native default/rear views and 14,679 live smoothed frames pass. Correct high/low reset altitude, reverse/checkpoints, full three-lap race, pause/items, unchanged eight-active-second pickup respawn, touch cancellation, retry and navigation pass.
- A further 55 bounded regressions pass, including Mountain lazy-menu/native repeat switching, shared driving, legacy geometry/textures, coast lifecycle/items/saved-build/cancellation, and five water lifecycle scenarios. Temporary test source copies were cleaned up; final builder identity remained unchanged.

The finite six-build/sample-state matrix does not cover arbitrary custom parts or every animation state. Native integration uses CPU `NullGraphicsDevice`; it does not establish GPU/browser pixels or FPS. Earlier failed receipts remain retained, including the test-only Infinity-versus-JSON-null comparison mismatch. Its correction preserved both control hashes and the original fixture, with raw physical positions/speeds still required finite.

## Resources and remaining release gates

All runs were serial, concurrency one. V8 old-space limits were 448 MiB (384 MiB for preservation); process RSS also includes native/off-heap memory.

| Run | Wall time | Peak process/child RSS | End V8 heap |
| --- | ---: | ---: | ---: |
| Independent export equality | 4.14 s | 395,804 KiB | 36.63 MiB |
| Preservation | 2.30 s | 298,276 KiB | Not sampled |
| Structure | 14.72 s | 455,356 KiB | 174.65 MiB |
| Camera | 106.49 s | 421,500 KiB | 250.11 MiB |
| Native assemblies/control/camera | 360.02 s | 940,128 KiB | 251.93 MiB |
| Bounded regressions | 58.16 s | 848,648 KiB | Not sampled |

Native 500-pose checkpoints observed a maximum 409.95 MiB V8 heap; this is a sampled high-water mark, not an analytic peak. Final rendered preview/provenance integration and the final full release suite, including a camera rerun against the corrected source, remain separate release gates.

Test sources: `tests/mountain-enrichment-contract.test.ts`, `tests/mountain-independent-audit.test.ts`, `tests/mountain-enrichment-gameplay.test.ts`, `tests/helpers/emitted-scene-oracle.ts`, `tests/helpers/native-mesh-oracle.ts`, and `tests/helpers/mountain-baseline-contract.ts`.
