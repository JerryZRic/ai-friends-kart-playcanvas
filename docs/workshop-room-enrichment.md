# Workshop005: room-scale architecture and work zones

## Scope

This is a bounded original scenery pass on the existing Clockwind Workshop course. It adds no course, route, gameplay mode or external artwork. The archived baseline is public dev commit `915109353ed1d2fcdc8afbb5bdacafca3648e92e`, tree `546c70332556d4e812105504df1c1e2bef52b401`. The unchanged original generator is retained in `docs/scene-baselines/workshop-scenery.ts.txt`.

All original batch position/index/UV prefixes and procedural texture pixels are retained. The only original material changes are the pale-road and cabinet-inlay texture selectors from wood to none: colors, roughness and metalness remain exact. This deliberately smooth sealed surface removes oversized road grain without changing runtime texture behavior or adding a shared material abstraction. The floor heightfield, road tops and undersides, continuous shelves, real thin east bench, separated legs, open crossing, six original landmarks and their supports are unchanged. So are routes, pickups, physics, AI, checkpoints, controls and the shared camera. The original eleven courses remain available. Stable publication files, workflows and Windows packaging are outside this pass.

## Composition

- Five north and three west opaque ivory window bays establish the scale of an oversized clockmaker's room. Substantial timber piers, deep sills and lintels surround broad sage lower panels; thin closed panes attach to lintels, and the south/east foreground stays open
- Five low service/storage compositions provide a middle layer around the original clock, cabinet, outer rim, lamp and descending return. Each has a thin worktop, separated grounded legs, structural aprons, broad parts boxes and a few large planing blanks
- The rim-side table sits farther along the actual outer east bench so it does not align with the fork road's vanishing point. Both original signs and the road opening retain their distinct silhouettes
- New painted pieces sample a fixed coordinate in the original wood texture to produce quiet broad surfaces. New timber uses lower-frequency UVs. These choices do not change any existing UV, shared material behavior, texture byte, light, exposure or fog setting
- All new assemblies own exact batch/index/vertex ranges and support chains. Actual indexed triangles provide camera collision coverage; windows and table under-spaces do not receive filled furniture-sized blocking boxes

## Budget

| Metric | Original | Candidate | Constraint |
|---|---:|---:|---:|
| Batches | 21 | 21 | Retain 21 |
| Triangles | 97,508 | 99,572 | Working addition ≤7,500; hard total <110,000 |
| Vertices | 146,357 | 150,485 | Hard total <200,000 |
| Original landmarks | 6 | 6 | Retain all six |
| New assemblies | 0 | 7 | Two architecture groups, five work zones |

The pass adds 2,064 triangles and 4,128 vertices. These are source geometry counts, not performance measurements.

## Matched visual evidence

`docs/workshop-enrichment-cameras.json` preserves 36 optional transforms: thirteen shared-chase, thirteen forward road-eye, four authored landmark-directed and six original catalog cameras. The default representative set has 18 views: eight shared-chase, four forward road-eye and the six original catalog poses. Unrendered optional transforms are not pixel evidence.

The shared-chase transforms come from the unchanged `chaseCamera` with baseline `safeLandCamera`, center lane, view 0, yaw/pitch 0 and rear view off. Forward road-eye cameras instead sit 1.6 m above the source road and look 40 m ahead on the same edge. These views use 56° vertical FOV and 16:9 framing. Target-facing original landmark rays are explicitly separate from normal forward-driving views. The six catalog poses retain their exact historical transforms and orthographic scale. The fixed overview keeps the complete course and both branches inside the frame; some taller distant window tops extend beyond its upper edge. Inherited fitted-subject bounds describe the historical baseline fit, not a refit around new architecture. No camera is fitted to candidate scenery.

Baseline and candidate use the same float32 normal POINT attribute and shader path: source `(x,y,z)` to Blender `(x,-z,y)`, OBJECT to WORLD NORMAL transform, normalization, and the double-sided `1−2×Backfacing` sign. Original positions, indices, UVs, materials and texture pixels are exported directly. Both sides use identical lighting, exposure, samples, resolution and seed. Native custom-corner encoding is bypassed consistently.

The first eight paired art views cover lower crossing, spool north, fork signs and lamp return, each as both normal shared chase and forward road eye. They establish the added room depth while preserving the original route and open support geometry. A later same-camera material gate replaces only the two road texture selectors and adds readable opaque panes; every road vertex, index and UV remains exact. This is a deliberately bounded architecture pass, not a claim of a finished high-detail environment.

## Reproduction

Requires the locked Node dependencies, Blender 4.3.2 Cycles CPU and Pillow. From the repository root:

1. Export the public baseline in its own unchanged checkout using `node --max-old-space-size=448 --import tsx scripts/export-workshop-preview.ts BASELINE_OUTPUT`. Its scenery must match the archived snapshot and its JSON/GLB hashes the camera manifest
2. Reuse the committed camera manifest. The freeze script documents its initial source derivation and refuses to overwrite a manifest or accept a different baseline tree
3. Export the final candidate using `node --max-old-space-size=448 --import tsx scripts/export-workshop-preview.ts CANDIDATE_OUTPUT`
4. From the final checkout, render the baseline with `blender -b -t 2 --python-exit-code 1 --python scripts/render-workshop-enrichment-preview.py -- BASELINE_OUTPUT --baseline`
5. Render the candidate using the same command with `CANDIDATE_OUTPUT --update-catalog` and without `--baseline`. `--views` selects fixed optional poses; `--resume` requires identical hash-verified inputs. Catalog update requires all 18 default views
6. Reopen each BLEND using `blender -b OUTPUT/workshop-original-scene.blend -t 2 --python-exit-code 1 --python scripts/verify-workshop-enrichment-model.py -- OUTPUT`. The read-only verifier checks source buffers, materials, shader sockets, packed original pixels, camera sensors/transforms and all corresponding GLB accessors
7. Compose matched evidence with `python3 scripts/compose-workshop-enrichment-comparison.py BASELINE_OUTPUT CANDIDATE_OUTPUT COMPARISON_OUTPUT`. The optional `--approved ART_ACCEPTED_OUTPUT` checks exact decoded-pixel identity against an earlier accepted render

Output directories should be outside the repository's source, public, documentation, test and model folders. Generated scene files contain original project artwork only.

## Reference study and limits

Official Nintendo [Tick-Tock Clock](https://www.nintendo.com/eu/media/images/08_content_images/games_6/nintendo_switch_7/nswitch_mariokart8deluxe/courses_lightning_01.jpg) and [Ribbon Road](https://www.nintendo.com/eu/media/images/08_content_images/games_6/nintendo_switch_7/nswitch_mariokart8deluxe/courses_bell_02.jpg) pixels informed only broad structural hierarchy, negative space and room scale. Official SEGA [course still 02](https://sonic.sega.jp/TeamSonicRacing/game/image/06_contents_ss_02.jpg) and [course still 03](https://sonic.sega.jp/TeamSonicRacing/game/image/06_contents_ss_03.jpg) informed edge clarity and layered support silhouettes. Reference pixels are not repository assets; no route, branded motif, named-world architecture, model or texture was copied.

These images are offline static source-geometry renders. Blender light, color management and PBR response approximate PlayCanvas; there is no driver, vehicle, HUD, runtime pixel-equivalence, GPU capture or measured frame-rate claim. Comprehensive indexed-geometry, camera and release checks are separate acceptance gates; the original baseline passed its 11 scene tests before edits.

## Indexed-geometry verification

The portable [geometry, camera and material audit](workshop-enrichment-audit.json) records the independent checks and their finite scope. The independent gate passed on scenery SHA-256 `3462b19fdff0bb68e53eed8b510d924300855b10f9fafd7453a4f4dca85dad48`. It verifies the unchanged original indexed geometry/normal/UV prefixes and all original material fields except the two explicitly approved texture selectors. All seven new assemblies contain 172 closed indexed pieces: 38 completely grounded root footprints, 134 attached pieces, and exact camera coverage for every one of the 2,064 added triangles.

The initial overlap audit identified 35 genuinely exposed triangle-pair witnesses at north sill joins. Recessing those sills by 0.1 m removes them without changing the accepted composition. The remaining 64 transom/pane overlap witnesses are wholly buried inside specifically identified adjacent piers, established by full outward-polygon clipping against their actual indexed closed geometry. The final exposed coflush count is zero; no broad overlap exemption is used.

Finite source-triangle face-center rays find each of the seven new assemblies inside at least one of the 13 frozen normal forward-chase frusta. This establishes sampled visibility only, not complete landmark silhouettes, continuous visibility, runtime GPU output or frame rate. Comprehensive camera replay and final model/preview verification are recorded below; release checks remain separate gates.

## Finite camera and retained behavior checks

The strict paired camera audit passed on the same frozen source with zero failures, zero unchanged-mesh regressions and no inherited-failure exemptions. It covers 217 stations, 31,248 safe poses, 62,496 desired/interpolated booms, and 582 continuous motion runs totaling 19,788 frames with actual previous-frame camera state retained. In total it inspects 102,098 candidate segments, including the 26 frozen normal-chase/forward-eye poses. All 102,072 archived runtime segments have identical corrected positions. The minimum measured indexed-face clearance in this finite audit is 0.493259 m; this is not a guarantee for arbitrary continuous camera input.

All 86 retained original Workshop tests also passed, including 76,464 desired plus 76,464 interpolated booms, 96 pickup rays, 3,000 seam frames, 11,664 crossing frames and 18,336 margin probes. Type checking, the independent geometry gate and obstruction-oracle sentinels passed. These checks preserve the real two-level crossing, both branches, supported kart envelopes and original gameplay contracts. They do not measure browser-rendered pixels, native device performance or frame rate.

## Final preview and editable-model verification

The portable [preview and model receipt](workshop-enrichment-preview-audit.json) records all 18 final baseline/candidate pairs and seven comparison sheets. Every pair has exact camera, source-normal shader, lighting, exposure, samples and resolution agreement. Both full sets were rendered from the sealed inputs, and all paired sheets were inspected. They visibly retain the branch signs, road opening, crossing supports and original landmarks while adding the workshop backdrop and grouped work zones. The baseline is the original Workshop at public dev `91510935`, not the preceding Forest enrichment.

Both saved BLEND models were reopened and passed exact float32 position/normal/UV/index checks, explicit shader-link checks, identity object-transform checks, original texture-pixel checks, all 36 camera checks and matching light/material checks. Each GLB also passed all 84 accessor and 21 material checks. The BLEND files contain every used texture image (`wood` and `stone`) packed with no external file paths or linked libraries; the unused `grass` and `asphalt` images are legitimately omitted on Blender save. All four source texture families remain exact in each GLB and exported PNG directory.

The public poster and its provenance are derived from the final candidate source `3462b19f`, including the narrow audited pane/sill repairs. Earlier review renders remain historical evidence; no exact pixel-equality claim against those earlier candidates is made. Comparison-sheet labels, source PNG hashes and model hashes are included in the portable receipt. These are static source-model verification results, not browser runtime, GPU or frame-rate measurements.
