# Workshop daylight and joinery polish

Second sample in the October land-map pass, following Coast. The oversized
clockmaker's room remains an interior workbench course with its original six
landmark groups, both road branches and the open upper/lower crossing.

## Changes

- Cream daylight panels and honey maple contrast with blue-grey metal and teal
  painted cabinets; copper/brass remains a limited mechanical accent
- Window heads gain stepped cream cornices and recessed blue-grey reveal strips
- Five existing service tables gain fifteen divided clock-repair trays, supported
  brass stock pieces and inset framed cabinet labels
- All details reuse existing material batches and attach to existing furniture or
  architectural support owners; the scene remains static

## Budget and verification

21 batches remain 21. Triangles: 99,572 → 101,564 (+1,992). Vertices: 150,485 →
154,469. The existing hard 110,000 triangle / 200,000 vertex limits remain valid.
The 166 added closed box pieces have recorded source ranges and exact camera
faces. Their actual XZ footprints do not overlap any emitted road triangle.

TypeScript, production build and 12 focused native tests pass. Exact before/after
comparisons retain road samples/faces/undersides, road support faces, terrain
heightfield, original landmarks, props and structures. Gameplay and waterpark
source files are not modified. This is not a full historical audit-suite run.

Supplemental pictures export the actual current scene geometry and use Blender
CPU with the existing fixed camera poses. A separate local render manifest records
the new daylight color; frozen historical manifests remain unchanged. These are
approximate offline lighting/material previews, not browser or gameplay captures.
Cloud Chromium cannot enable WebGL here, so GPU appearance/FPS remains unverified.
