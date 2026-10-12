# Amberwind Harvest: working-farm composition

## Scope and baseline

This is an original scenery enrichment of existing Harvest006. The route, physics, AI, controls, checkpoints, connected terrain, road/support/shoulder/rail geometry, open barn route and original major architecture are protected. There is no new map, bridge or playable-heightfield change.

The frozen local baseline is `15db9eb703aeed462a931b9a743c22690656c0a6`, containing the sealed, unpublished Workshop candidate. It is not a public-release claim. The last parent-verified public dev commit is `915109353ed1d2fcdc8afbb5bdacafca3648e92e`; Harvest source was identical. `docs/scene-baselines/harvest-scenery.ts.txt` retains the exact original source, SHA-256 `ea93d8ad6dca07bac38efc3934ff397bbde0ea93444982530319d56d79f1458a`. Original native-test snapshots are also retained separately from reviewed numeric changes.

## Composition

Official Nintendo and SEGA racing screenshots were studied for readable mass hierarchy, road/ground separation and grouped agricultural depth. Only compositional ideas were used. No commercial reference pixels, models, routes or branded motifs ship in this scene.

The first palette-only study and the second two-small-shelter study were rejected at the visual gate. The current revision adds foreground, middle-ground and background structure:

- Cooler olive ground and grouped wide/narrow crop rows separate cultivated fields from the ochre road
- Nine of the original orchard trees have larger asymmetric mature crowns. All 27 original roots and planted centers remain exact
- A broad separate cultivated rise supports three sloping field bands and four grouped fruit trees; four additional trees frame the mill approach from original terrain
- Three grounded hedgerow runs define the original orchard field edge
- An open mill-side drying shelter and a wider silo loading crib add secondary farmyard masses
- Two six-bale stepped hay yards sit visibly in the frozen orchard and silo approach views. Two further fruit trees group the silo middle ground

The original mill, granary, open barn, silos, press, market, walls, tools, sails and harvest pockets retain their original indexed geometry. The mill/rise/approach groups were held during the last targeted orchard/silo placement revision. A winding correction applies only to the new tree trunks.

## Material contract

Existing textures, texture pixels, UV rules, roughness and metalness remain unchanged. Only five existing batch colors change:

| Batch | Original | Enriched |
| --- | --- | --- |
| Harvest connected contour earth | `#a18b55` | `#82895a` |
| Harvest ripe wheat rows | `#dbad42` | `#d6af49` |
| Harvest pale straw ears and bales | `#ebc66b` | `#e4c77a` |
| Harvest olive orchard leaves | `#748447` | `#5e7444` |
| Harvest sunlit orchard leaves | `#99a25a` | `#91a65e` |

Straw also recolors original bales, sacks and seed heads; olive leaves also color original low fallow surfaces. Road, paving/coping, support/shoulder soil and architectural wood/stone/roof/plaster/metal colors stay exact. The sole appended batch is `Harvest rolling cultivated earth`, color `#7a8853`, roughness 1, existing grass texture. It does not change the connected terrain batch. No unsupported per-batch texture tiling, custom texture-family claim, theme/lighting adjustment or normal-shader correction is introduced.

## Explicit geometry budget

Current candidate: **114,583 triangles, 183,295 vertices, 22 batches**. Original: **108,687 triangles, 178,812 vertices, 21 batches**. Net growth is 5,896 triangles and 4,483 vertices. The triangle ledger is +1,044 new rigid farmyard faces, +4,242 landscape faces, +972 mature-crown topology faces and −362 field faces, totaling +5,896. The public audit receipt is `docs/harvest-enrichment-audit.json`.

The approved Harvest-only ceiling is strictly below 118,000 triangles and 200,000 vertices, with exactly 22 batches. The working aim was at most 116,500 / 198,000, not a fill target. This scoped increase funds a readable cultivated silhouette and actual mid-scale groups after the previous near-zero-growth study failed the art gate. It is not a runtime performance claim and does not weaken other maps or shared budgets.

The production guard is in `src/harvest-scenery.ts`. Reviewed numeric-only ceiling changes are confined to `tests/harvest-scene.test.ts`, `tests/harvest-independent-audit.test.ts` and `tests/harvest-preview-assets.test.ts`. New enrichment-specific tests independently cover the expanded ownership/contact/camera scope. Original test snapshots and original geometry goldens are not rebased.

## Indexed ownership, contact and clearances

### Original fields and orchard

All 47 accepted crop rows, four categories and 34 modeled wheat stems/heads remain. Widths use `[1.22, 1.22, 0.58]` times the original region width. Original region bounds, row pitch, station logic, top-height rules and terrain-affine clipping remain. Explicit secondary yard reservations alter only the affected field emission. Crop faces retain their anonymous field ownership and independent terrain-affinity audit; they are not reclassified to evade it.

All original 27 tree centers, root geometry and grounded-detail footprints remain exact. Their branch/crown/apple deltas are explicitly indexed. Original tree IDs 2, 3, 4, 5, 10, 11, 12, 13 and 14 use mature 10×5 crown topology and a 9.6 m reservation; other crowns retain 8×4 topology. Actual emitted maximum height defines metadata. Every changed branch/crown/apple triangle is included in `harvest-enrichment-orchard-pruned-crown-exact-triangles`. The complete declared crown radius must clear actual indexed roads by 23 m.

### Farmyards

`enrichmentAssemblies` contains four groups and 87 actual closed pieces:

| ID | Center X/Z | Foundation | Pieces |
| --- | --- | --- | --- |
| mill-shelter | −185 / −23 | 22×10 m | 22 |
| silo-loading | 410 / −90 | 28×14 m | 25 |
| orchard-hay-yard | −232 / 160 | 20×9 m, yaw −2.178 | 20 |
| contour-hay-yard | 385 / −110 | 20×9 m | 20 |

Each piece records stable ID, kind, batch, exclusive vertex/index ranges, complete bounds, role and actual support-owner IDs. Each assembly identifies its real continuous terrain-buried base, complete footprint, bottom and terrain extrema. The open shelters use thin closed roof shells and exact camera triangles rather than opaque whole-building boxes. Actual compound radii cover every emitted XZ vertex.

Each hay yard has three contiguous lower bales, two contiguous middle bales and one top bale. Upper bales have complete actual lower seats; each middle names both supporting lower bales and the top names both middles. Raised ties contact their own bales. The enlarged silo yard was positioned to preserve all original modeled wheat detail.

### Separate cultivated rise and supported bands

`enrichmentLandforms` owns one closed indexed mass, `central-cultivated-rise`, with separate complete top/side/bottom index ranges, actual basal-ring vertices, whole footprint, bottom and original-terrain extrema. Its 16×15 top grid uses original terrain lattice X/Z coordinates, spanning approximately X −65.09..74.59 and Z −78.53..57.35. A smooth maximum 20 m relief is added only to this new mass. Its boundary is 0.12 m below the original surface and its broad bottom is 0.35 m below the original whole-footprint minimum.

Pre-placement survey excludes every road, support, landmark, component and authored reveal footprint. The source additionally excludes real road-footprint intersection and certifies at least 25 m whole-boundary road clearance using samples no more than 2 m apart with a 1 m distance reserve. Original terrain positions, indices and heightfield physics remain exact. The rise is scenery, not a new drivable surface.

Three `enrichmentFieldBands` records own closed terrain-affine bands over the actual new top grid. Each names the rise as support and exposes complete exclusive top/bottom/side ranges, footprint, exact height offset and root depth. Their top offsets are 0.65, 0.65 and 0.30 m; bottoms are 0.04 m inside the supporting top. Independent coverage must prove every band against that emitted top, not against a claimed center height or the original terrain.

### New vegetation

`enrichmentVegetation` contains ten new fruit trees and three hedgerow runs. Total scene tree count is 37. Four trees root on the rise; six root on original terrain. Every rooted trunk or hedge declares its actual whole basal polygon, bottom, support owner and support-surface extrema. New crowns use closed pole-aware topology. New trunks have closed directed-edge/outward side winding without changing any original tube.

All vegetation pieces have exact indexed ownership, actual structural supports and exact camera faces. The only declared cross-tree foliage union is `rise-orchard-1` with `rise-orchard-2`, where actual crown volumes overlap. No unused original-orchard union exemption remains. Root/trunk/building/road intersections are not waived.

## Frozen visual comparison

`docs/harvest-enrichment-cameras.json` was frozen before source edits. It retains 15 normal shared-chase views, 15 forward road-eye views, four labeled landmark-target eyes and five historical catalog poses. Shared chase uses unchanged camera logic and complete original baseline safety geometry. Forward eye uses road +1.6 m looking 40 m ahead. Historical overview/topdown poses are copied, never refitted.

The first gates used eight matched images at terrace/mill, orchard descent, barn approach and silo approach, each in shared-chase and forward-eye. The final targeted placement gate uses the four unchanged orchard/silo poses. The final representative set is 18 views: the eight terrace/mill, orchard, barn-approach and silo-approach pairs; five additional shared-chase views at press approach, fork signs, barn interior, granary return and market late approach; and the original five catalog views (overview, topdown, barn passage, windmill detail, orchard detail). All 39 transforms remain in the editable model. Optional unrendered cameras are not visual evidence.

Driving images are 960×540, 48-sample Cycles CPU with two threads, exact source float32 normals, textures, UVs and material values, and identical camera/light/color settings. The already-correct Harvest POINT-attribute source-normal shader is reused unchanged. Images are static source-derived offline illustrations, contain no kart/driver/HUD and establish neither browser/GPU appearance nor runtime performance.

## Portable reproduction

Run from the repository root with dependencies already installed. Use an explicit output directory and disk-backed `TMPDIR` suitable for the machine. Commands below are recipes, not claims that their later gates have passed.

```sh
export NODE_OPTIONS=--max-old-space-size=448
node --import tsx scripts/export-harvest-enrichment-baseline.ts "$BASELINE_OUTPUT"
node --import tsx scripts/export-harvest-preview.ts "$CANDIDATE_OUTPUT"
blender -b -t 2 --python-exit-code 1 --python scripts/render-harvest-enrichment-preview.py -- "$BASELINE_OUTPUT" --baseline
blender -b -t 2 --python-exit-code 1 --python scripts/render-harvest-enrichment-preview.py -- "$CANDIDATE_OUTPUT"
blender -b "$BASELINE_OUTPUT/harvest-original-scene.blend" -t 2 --python-exit-code 1 --python scripts/verify-harvest-enrichment-model.py -- "$BASELINE_OUTPUT"
blender -b "$CANDIDATE_OUTPUT/harvest-original-scene.blend" -t 2 --python-exit-code 1 --python scripts/verify-harvest-enrichment-model.py -- "$CANDIDATE_OUTPUT"
python scripts/compare-harvest-enrichment-previews.py "$BASELINE_OUTPUT" "$CANDIDATE_OUTPUT" "$COMPARISON_OUTPUT"
```

The baseline adapter uses the immutable source snapshot and unchanged shared exporter in temporary modules. It checks all protected inputs and requires exact equality to the frozen original JSON and GLB hashes. It never replaces active source. Its end-to-end reproduction has passed exact frozen JSON and GLB equality. The camera freezer has embedded source station records, takes an explicit original-export directory and refuses to overwrite a frozen manifest; there is no private planning-file dependency.

The renderer supports an explicit `--views` subset. `--resume` only accepts hash-verified images from identical source/configuration. `--update-catalog` requires the complete selected final set and belongs after art/geometry acceptance. The reopened-model verifier checks actual mesh/index/normal/UV streams, textures, material nodes, cameras, lighting, model identities and source hashes. The paired comparison script requires all 18 rendered pairs, both successful reopened-model reports, exact model/image identities and identical generators/camera matrices/settings before producing four labeled sheets. Original full-resolution PNGs remain canonical; the sheets are scaled presentations. If the local catalog update is run with `--resume --update-catalog`, reopen/verify the newly saved model again and regenerate the comparison record afterward. Retained first-gate records disclose descriptive/freezer-packaging changes between early generator revisions; the final paired set must use one identical generator revision.

## Current status

Targeted art was approved for QA. The scoped Harvest geometry/contact/camera gates, 93 retained native tests and eight new distinct geometry/oracle/palette-budget tests have passed on the frozen composition. The full-project suite remains a separate integration gate. The complete 18+18 fixed-view set, both reopened BLEND/GLB audits, exact baseline reproduction, four same-generator comparison sheets and local Harvest poster/provenance update have passed. The four final targeted images match the accepted art-gate pixels exactly; PNG hashes differ because Blender embeds render dates/times. All 39 camera transforms are retained, with 21 explicitly unrendered optional views. Full-project tests/build/dist validation, final inventory sealing and any publication remain integration gates. Earlier rejected and corrected iterations are retained for traceability. No remote publication, Library upload or Windows packaging is performed by this art task.
