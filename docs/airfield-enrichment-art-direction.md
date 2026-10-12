# Copperwing Airfield 011: founded service architecture

## Scope and original design

The final map in the eleven-map enrichment pass adds three off-road architectural compositions: a stepped runway workshop, an open perimeter maintenance court, and low service terraces on the return. The original five aviation exhibits and split-roof over-track hangar remain the focal mechanical objects. This pass does not create another map or initiate a second production loop.

The complete historical overview, topdown, driver-reveal, hangar-architecture and rotor-detail PNGs were inspected before authoring. They show generous open land around the original grounded aircraft and a strong central hangar. The new work supplies middle-scale service architecture instead of extra signs or scattered crates. The historical driver-reveal is aimed at an exhibit; it is not treated as a normal forward camera.

Private official reference pixels informed only general principles: repeated structural bays with true negative space, unequal roof bands, and near/middle/far composition. No branded architecture, route, proprietary mesh, texture, character, logo or screenshot is included in the game or deliverables. All added solids are original procedural project geometry under the existing source license.

## Placement and construction

- Runway workshop: two unequal roof heights and depths, blue steel frames, complete pale shoes, full concrete pads and a separate low loading terrace. A substantial lower cream/teal L-plan service wing contrasts with the taller open copper bay. The stepped silhouette is approached from the frozen start 170 m forward/chase cameras
- Perimeter court: unequal open bays separated by a genuine open-sky gap, two lower apron faces and thick copper/teal shed roofs. A coherent original propeller-overhaul cart in the tall service bay provides an aviation-specific silhouette, with four closed wheels, a working deck, a broad stand, an octagonal hub and four swept blades. The frozen boulevard 150 m camera remains unchanged. The final site is 4 m farther from the road than the reviewed initial court, after an independently found extreme-orbit camera witness
- Return service terrace: one quieter low open shelter and two unequal broad terraces separated by a deliberate gap. This anchors the long return without competing with the Sunfin Glider

Roof slabs are closed 0.42 m thick wedges. Roof-bearing seats have matching complete sloping top faces. Columns stand on complete square shoes, which stand on complete founded pads. End screens occupy a short outer edge; front and rear bay openings remain literal space. There are no alpha windows, copied models, suspended feet, terrain overlays or new driving surfaces.

## Immutable comparison contract

The baseline is the locally sealed preceding-map head fc5360139c00e0d60148afabd0d24ed85c272ed6, before Airfield runtime edits. Its Airfield export contains exactly 94,747 triangles, 103,278 vertices and 20 batches. Historical provenance is retained separately. Every old geometry/material stream, original hero, terrain, road, route, physics rule, camera rule and gate must remain unchanged. New geometry appends to existing material buffers; the strict total ceiling remains below 110,000 triangles and 200,000 vertices, with at most 12,000 added triangles and exactly 20 batches.

The frozen manifest stores 60 native source-road forward/chase poses and the five original catalog transforms. Forward eyes are road +1.6 m, look 32 m ahead, with a fixed 56-degree vertical FOV at 1280×800. Chase uses unchanged shared chase logic, zero orbit/rear, original safe-camera results, and distinct desired/resolved coordinates. No camera is aimed toward new architecture.

Offline pixels preserve exact float32 source positions, normals and UVs. The normal is a POINT attribute driving an explicit object-to-world NORMAL transform, normalization and two-sided backface sign. Lighting, exposure, seed and compared settings remain identical. The resulting source previews are not native GPU/gameplay or FPS certification.

## Completed visual review

The initial six matched native forward/chase pairs were reviewed before long validation. That review led to a bounded improvement: move the stepped runway composition fully into the unchanged forward view, reduce exposed court foundations, and add a substantial opaque runway service wing. A subsequent bounded request added the single propeller-maintenance grouping. The final court setback preserved the rotor sightline and open bays and received visual acceptance. Cameras were never re-aimed toward the additions.

The final 16 matched pairs were inspected at the frozen settings: forward and both chase views for each of the three compositions, two additional native views of original exhibits, and all five historical catalog views. The workshop reads as a stepped building with a true open upper bay; the court retains an open central interval and its propeller cart; the return remains quieter. The original hangar, aircraft exhibits and physical road branches remain legible. Six supplementary adjacent forward pairs were also inspected at their originally frozen poses. The structures enter and leave the forward field of view naturally; visibility is not claimed at every distance.

## Final source and construction certification

Final runtime `src/airfield-scenery.ts` SHA-256:
`96a84ea580575661041811f3414ea193afffc0d3e5d88c95541a1910996c74db`

The completed scene contains **96,431 triangles, 105,784 vertices and exactly 20 existing batches**. The append-only change adds **1,684 triangles and 2,506 vertices**. All 1,585 original components remain preserved. Independent checks certify 128 new closed physical shells, 11 complete ground roots, 201 complete structural seats, 155 physical contacts and 11 literal opening prisms with positive edge margins. There are no accepted hidden overlap waivers, terrain intrusions or exposed coplanar skins. The minimum measured new footprint-to-road clearance is 10.4546 m.

Two technical repairs were made before the final artifact freeze: a lower return wall band was shortened to clear the sloping roof underside, and the complete court moved 4 m outward to remove one newly introduced extreme-orbit camera retraction. No tolerance, baseline or camera mechanic was changed. The final scene passed all 882,673 retained, dense-local and extension camera output rows with exact original binary64 results, including the original 55 safe-camera retractions. The 12 retained native safety suites passed 126 tests, including six native vehicle assemblies and 39 independent vehicle checks. These source-level results do not establish native GPU performance.

## Source-matched final artifacts

- `airfield-enrichment-final-art-verification.json` identifies the 16 final matched pairs: 11 native-projection pairs and five unchanged catalog camera pairs. All final frames use 48 samples, fixed lighting, seed, exposure and source camera transforms
- `airfield-enrichment-adjacent-art-verification.json` identifies six supplementary eight-sample fixed forward pairs and verifies all 12,288,000 source pixels inside their unscaled comparison panels
- Both final GLB and BLEND files were reopened and checked against the exported exact float32 geometry streams. Checks cover all 65 frozen model cameras, 80 GLB geometry streams, 20 material records and four embedded procedural texture sets. All used BLEND images are packed with empty paths, and no linked libraries remain
- The final unscaled comparison panels preserve all **44,354,800** source pixels exactly. Summary sheets are explicitly downscaled. No scene content was painted into the PNGs or retouched
- Reopened-model first-hit masks verify each added group in its primary forward and chase view. Visible spans range from 20.94% to 43.13% of image width and 13.00% to 25.50% of image height, exceeding the fixed 8% width and 6% height minimums
- The original supplied archive's GLB is byte-identical to the newly exported immutable baseline, and all 12 archived source files match the retained historical hashes
- `airfield-enrichment-preview-provenance.json`, `airfield-preview-provenance.json` and `../public/map-previews/airfield.webp` now describe the same final runtime source. Historical provenance is retained without rewriting its expectations

All previews are offline Blender CPU source-geometry images with approximate offline lighting and materials. They are not gameplay captures, native PlayCanvas/GPU shader certification or frame-rate evidence. Geometry and art production for map 011 are complete; this closes the eleven-map pass without starting another scene.
