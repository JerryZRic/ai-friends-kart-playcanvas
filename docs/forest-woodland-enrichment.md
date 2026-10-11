# Forest004: bounded woodland composition

## Scope and fixed baseline

This is an incremental, sparse stylized woodland enrichment, not a finished high-detail environment. It is an original scenery pass on the existing CedarLight Observatory course. It does not add a twelfth course. The baseline is public dev commit [`a5ffb65ec9e12f0e80b9643b03335650235b04a1`](https://github.com/JerryZRic/ai-friends-kart-playcanvas/commit/a5ffb65ec9e12f0e80b9643b03335650235b04a1), tree `31a857424d0ac0600ea9ab738efac92628377c81`. The original Forest generator is retained byte-for-byte in `docs/scene-baselines/forest-scenery.ts.txt`.

The original source terrain, every road/bridge member, route support, gameplay, pickups, controls, shared camera and nine landmark cedars are protected. Observatory, armillary, lookout, forestry station, fork signs and their source foundations remain unchanged. All eleven courses remain present. This pass does not change main, stable-release metadata, workflows or Windows packaging.

## Composition

- Reuse all 99 cedars. The 90 ordinary woodland trees gain coherent, closed, softly scalloped crown layers. Each ordinary layer uses 40 triangles; ordinary hero layers use 48, exactly retaining the former foliage triangle allocation. The nine trees belonging to the original Root Cathedral and Cedar Bowl landmark groups retain their original meshes
- Redistribute existing ordinary cedars into near, middle and distant groups at the bowl exterior and fork hillside. Smaller foreground silhouettes and larger overlapping middle-distance crowns create depth while retaining a deliberate road/sky opening
- Add four modest shale shoulders, accepted only where complete road margins, source terrain support and sight reservations allow them. Rejected proposals are not forced into the scene
- Add four low soil/understory beds beneath selected ordinary cedar groups. Each top is clipped from the actual source terrain triangles and lifted by at least 0.05 m. A closed shell descends to a wholly buried base. Exact emitted indices, complete footprints, owned tree seeds and matching triangle camera payloads are recorded
- Retain the original material palette, procedural texture pixels, exposure, lighting and fog. Original fern and shale details remain exact indexed prefixes

The fork remains a broad clearing rather than a dense forest tunnel. The strongest changes are the bowl and fork cedar groups and the fuller silhouettes around the crossing. The complete comparison set also shows unchanged wide open stretches: the normal rim-summit chase pose mainly frames road and sky, while the station approach leaves the station at the left edge. Landmark-directed views are labeled separately; this pass does not establish every landmark's visibility from every driving position.

## Budget

| Metric | Original | Layered candidate | Contract |
|---|---:|---:|---:|
| Trees | 99 | 99 | Retain 99 |
| Batches | 21 | 21 | Retain 21 |
| Triangles | 107,780 | 108,772 | Working target ≤108,980; hard <110,000 |
| Vertices | 140,018 | 138,214 | Hard <200,000 |
| Procedural texture kinds | 4 | 4 | Unchanged |

The 992 added triangles are four shale shoulders (120) and four terrain-conforming beds (872). Coherent crowns use fewer vertices without increasing their previous triangle allocation.

## Matched-camera evidence

`docs/forest-enrichment-cameras.json` preserves nine exact shared-chase poses, four explicitly labeled landmark-directed road-eye views and five original catalog poses. The shared-chase poses use the unchanged `chaseCamera` and baseline `safeLandCamera`, center lane, view 0, yaw/pitch 0, rear view off, 56° vertical FOV and 16:9 framing. Candidate scenery never refits or retargets these cameras.

Both sides use exact exported positions, indices, UVs, material values, source texture pixels and float32 runtime normals. The normal shader uses a POINT vector attribute, source `(x,y,z)` to Blender `(x,-z,y)`, object-to-world NORMAL transform, normalization and `1−2×Backfacing`. Native custom-corner normal encoding is bypassed for both baseline and candidate. Lighting, exposure, samples, resolution and seed match.

The initial four-view art gate covers root-valley underpass, cedar-bowl entry, fork decision and upper-canopy crossing. The layered four-view composition was accepted for safety validation. Both final source versions now have all 18 frozen renders. All camera/render settings match across the 18 pairs, and the four accepted art views reproduce exactly the same decoded RGBA pixels after the final ownership-only metadata correction. Their PNG file hashes differ solely because Blender embeds render timestamps and timing metadata. All six full-set comparison sheets were visually inspected, including every shared-chase, landmark-directed and historical catalog view. All images are offline static source-geometry renders, not PlayCanvas/GPU captures. There is no driver, vehicle, HUD, measured frame-rate claim or runtime pixel-equivalence claim.

Reproduction tools:

1. Export the public baseline in a separate baseline checkout with `node --import tsx scripts/export-forest-preview.ts BASELINE_OUTPUT`. Its scenery bytes must match `docs/scene-baselines/forest-scenery.ts.txt` and its JSON/GLB hashes must match the committed camera manifest
2. Reuse the committed camera manifest for reproduction. `scripts/freeze-forest-enrichment-cameras.ts` records how it was initially generated before scenery edits; it deliberately refuses to overwrite an existing manifest or run against a different tree
3. Export the final checkout with `node --import tsx scripts/export-forest-preview.ts CANDIDATE_OUTPUT`
4. Render both exports from the final checkout with `blender -b -t 2 --python-exit-code 1 --python scripts/render-forest-enrichment-preview.py -- OUTPUT`. Add `--baseline` only for the archived baseline. `--resume` requires identical verified inputs; `--update-catalog` requires the complete candidate set
5. Reopen each model with `blender -b OUTPUT/forest-original-scene.blend -t 2 --python-exit-code 1 --python scripts/verify-forest-enrichment-model.py -- OUTPUT`. The verifier checks both the reopened BLEND and its companion GLB
6. Compose all paired evidence with `python3 scripts/compose-forest-enrichment-comparison.py BASELINE_OUTPUT CANDIDATE_OUTPUT COMPARISON_OUTPUT`. Add `--approved ART_ACCEPTED_OUTPUT` to verify the earlier four-view pixel identity. CLI inputs are portable; output receipts contain filenames and hashes, not machine paths. The public composer reproduced all seven reviewed sheet PNGs byte-for-byte using the same Pillow/DejaVu Sans environment. A final clearer baseline header was then independently reconstructed with every other sheet pixel identical

## Reference study

The following official reference pixels were actively inspected for composition. They are not game assets and are not included in this repository.

- Nintendo, [Mario Kart 8 Deluxe official course page](https://www.nintendo.com/en-gb/Games/Nintendo-Switch-games/Mario-Kart-8-Deluxe-1173281.html), [Wild Woods course image](https://www.nintendo.com/eu/media/images/08_content_images/games_6/nintendo_switch_7/nswitch_mariokart8deluxe/courses_crossing_03.jpg): layered dark woodland silhouettes, foreground enclosure and deliberate open sight gaps. The small official thumbnail supports mass/color study, not detailed asset imitation
- SEGA, [Team Sonic Racing official game page](https://sonic.sega.jp/TeamSonicRacing/game/), [course gameplay image](https://sonic.sega.jp/TeamSonicRacing/game/image/06_contents_ss_04.jpg): a readable warm route framed by low dark foreground forms and overlapping middle-distance foliage

Only the principles of scale hierarchy, depth, grouping and route visibility are transferred. Routes, named worlds, architecture, characters, textures, plants and distinctive branded motifs are not copied.

## Validation status

The unchanged baseline passed its 11 scene tests and eight independent indexed-mesh audits, including 61,488 desired and 61,488 genuinely interpolated booms, 3,000 seam frames, 96 pickup rays and four observatory center rays with cedar reservations. Those are baseline results, not candidate acceptance.

The candidate's initial exported equality checks preserve route/theme/texture data, original terrain, road surfaces and undersides, foundations, trestle members, landmarks, dome, sightlines, original fern geometry and the original shale prefix. The independent candidate indexed-geometry gate passed against final source `4ecc8445726214c8f8de5f5e38e1e46eff6e9119a85110b2cdf49ecd43f4215b`: 21,286 protected emitted components remain exact, all 372 audited trunk/root footprints are grounded, all four banks and four beds have complete support and closed shells, and all 992 added faces have exact triangle camera coverage. Seven center-inside ordinary-tree owners and three specifically indexed boundary trunk/root members have actual verified bed contact. No exposed coflush skins or unrelated structure clashes were found. The original Forest matrix then passed 72/72 tests (the source-current preview-assets check is reserved for the completed catalog). Historical fingerprints and hard limits remain intact.

The new paired camera gate passed 2/2 tests. It covers 218 stations, 31,392 safe poses and 31,392 genuinely smoothed poses, plus 630 contiguous moving runs / 21,420 frames at 30 and 60 Hz. In total, 105,633 actual indexed-geometry inspections include the nine frozen shared-chase review poses. There are no source intersections, new changed-face failures or unchanged-mesh regressions.

This is a finite camera result, not unrestricted orbit clearance: 721 exact inherited triangle/segment witnesses across 221 distinct segment labels remain below the strict 0.3 m face-clearance target. Their minimum clearance is 0.11335568368899696 m. Every one matches unchanged original coping, timber or soffit geometry and the same baseline path and face multiplicity; none uses a shortened-path exception. Witnesses are face/segment records, not a count of distinct camera/input poses. See the portable [paired camera summary](forest-enrichment-camera-audit.json) and [independent geometry and camera summary](forest-enrichment-independent-audit.json) for exact source hashes, counts and limitations.

Both archived-baseline and final-candidate BLEND files were reopened successfully. The read-only verifier checked every float32 position, normal, UV and index; the explicit two-sided source-normal shader; material values and texture links; four packed exact source texture sets; unchanged lighting; and all 18 camera transforms and sensor settings. Both companion GLBs preserve all 84 attribute/index accessors, 21 materials and four embedded texture sets. Neither BLEND requires an external image or linked library. The final menu poster and preview provenance were regenerated from the candidate overview. See the [matched-preview and reopened-model receipts](forest-enrichment-preview-audit.json). The final source-current preview, typecheck, geometry and focused shared inventory checks passed, bringing the distinct local test count to 80. Exact-head CI and release/build checks remain the integrator's separate gates. These CPU checks do not measure GPU performance, native vehicle traversal or browser-rendered pixels.
