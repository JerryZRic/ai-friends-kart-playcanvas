# Lantern Terrace: architectural scene pass

This pass develops the existing Town circuit. Both physical branches, the
banked road ribbons, terrain, bridge, checkpoints, AI, driving controls and
shared camera implementation are preserved. It does not add another map.

## Visual direction

- Group the houses into stepped street fronts instead of isolated repeated props
- Give the market occupied lower shopfronts with real recessed openings
- Connect the nine arcade bays into three readable architectural runs
- Reveal the existing tram and civic clocktower from the original approach views
- Separate quiet paving, warm plaster, terracotta roofs and teal timber details
- Use a few grounded distant roof masses rather than decorative microdetail

The official [Mario Kart 8 Deluxe Toad Harbor reference image](https://www.nintendo.com/ph/switch/aabp/assets/images/course/detail/2-2.jpg)
was reviewed for overlapping roof masses, varied material scale and a landmark
revealed through a street opening. These are composition principles only.
All geometry, textures and scene design here are original; no Nintendo assets,
logos, architecture or course layout are imported or reproduced.

## Geometry and materials

The final scene has 20 static material batches, 89,092 triangles and 171,140
vertices, compared with 20 / 95,630 / 184,438 before this pass. It reuses the
same four 64×64 procedural texture pixel sets. Material and UV adjustments
are local to Town; shared texture generation is unchanged.

Fifteen lower shopfronts remove the old retaining-box front skin and replace
it with planar infill, jambs, sills, soffits and recessed glazing. Their real
openings are not black planes placed over an intact wall. Small trim-depth
and contact corrections remove detached strips, adjacent arcade-base overlap
and exposed coincident faces without changing the reviewed composition.

The 129 actual foundations remain grounded in the unchanged rendered terrain.
All geometry is produced by `src/town-scenery.ts`; the portable exporter and
renderer keep the reusable source/model workflow available.

## Camera data

Town's citrus and lantern meshes now participate in camera safety using their
existing source bounds. The road and bridge structural camera payload contains
9,820 actual emitted paving/masonry triangles. Its aggregate bounds are only
a broadphase bound; they are not a filled obstacle. Open underpasses stay open.
The existing shared camera algorithm is unchanged.

The finite audit retains one exact pre-existing, non-intersecting road-shell
witness: common start s=280 m, right legal lane, low view, yaw −π, pitch −0.28.
Its desired-safe boom clearance is 0.2624718505 m, below the audit's conservative
0.30 m target. The same face, endpoints and gap occur in the original scene.
This is an explicit limitation, not a claim of unrestricted continuous-orbit
clearance.

## Reproducing the images

1. Run `node --import tsx scripts/export-town-preview.ts OUTPUT_DIR`
2. Run `blender -b -t 2 --python scripts/render-town-enrichment-preview.py -- OUTPUT_DIR`

The renderer uses the fixed cameras in `docs/town-enrichment-cameras.json`.
Sixteen before/after views preserve their poses, field of view, resolution,
lighting and exposure. The original catalog topdown and bridge poses are recorded separately.
The full 125-pose collection is retained for inspection. No new flattering
camera fit is substituted after moving the buildings.

These are source-derived offline Blender Cycles CPU renders. They are not
PlayCanvas browser screenshots, GPU validation or frame-rate measurements.
They contain no driver, vehicle, HUD or dynamic pickups. Lighting and shader
response differ from the runtime, so before/after comparisons use the same
frozen renderer. Both sides use the corrected exact float32 source-normal
attribute shader, including object-to-world normal transformation and the
runtime-compatible two-sided sign. Original native-normal images are retained
separately because the historical Blender normal encoder altered shading
around ellipsoid poles; they are not used as the current comparison baseline.

Full release validation and final artifact hashes are recorded separately;
an offline preview alone does not establish deployment or device performance.
