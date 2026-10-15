# Desert visual polish, 2026-10-14

Dev-only finish pass based on b761b518. No A01, route/road/shoulder/terrain geometry, physics, AI, pickups, camera settings, arch aperture or existing collision changes. Original frozen enrichment ownership, tests, fixtures and catalog assets are preserved.

## Added modeling

- A hollow masonry well on the middle crescent bay's existing grounded platform, under its existing shade cloth. Includes separately modeled rim stones, a recessed ceramic-toned water surface, supported winding frame, bearings/crank, rope, open drawing bucket and curved handle
- Two water jars on the existing rear stone worktop
- Market textile stacks and serving cups supported by the existing tables, plus nine small hanging turquoise/ivory tiles tied to the existing eaves
- Potter's wheel, an unfired open bowl, a four-legged slatted stool and restrained shelf tile edges in the kiln yard
- Open turquoise/wood lattice and shallow relief/frieze pieces inside the waystation's existing niches
- Four low stratified scree groupings at the wind spire's feet, sunk into measured terrain support
- Pale apricot dunes, warm layered stone, honey timber and restrained turquoise. Road colors and scene lighting are unchanged

## Budget and preservation

118,490 → 121,330 triangles (+2,840; 2.40%), 154,180 → 157,344 vertices (+3,164), 22 → 22 material batches. Existing final runtime limits of 125,000 triangles and 200,000 vertices stay unchanged. The original enrichment accounting remains intact; an additional bounded runtime append/finite/index check validates the separate cosmetic pass with a 4,000-triangle ceiling.

Every old mesh position/index/UV prefix and all scene records other than new cosmetic component ranges and computed budget compare byte-identically to b761b518. This includes road faces, shoulders, source terrain, camera obstacle triangles, arch geometry, props, foundations, landforms and existing enrichment ownership. See the accompanying JSON report.

## Checks

- npm run check and npm run build: passed (existing Vite worker_threads / large-chunk warnings)
- tests/desert-visual-polish.test.ts: passed; finite mesh/UVs, valid indices, batch/budget limits, conservative full-component bounds ≥8 m clear of every source road, exact well-to-slab contact and recessed water below the open lip
- tests/desert-route-footprints.test.ts: 7 tests passed
- tests/desert-gameplay-camera.test.ts: 2 tests passed; 13,824 route camera poses, 47,232 actual arch-triangle aperture poses, 864 fixed-pickup rays and 864 frustum checks
- Final repeat of all three new visual-polish sanity tests and Desert camera checks: 5 tests passed
- Manual inspection of source-geometry Blender CPU route overview, caravan detail and shaded-well detail

These images are approximate offline static-mesh renders, not browser/gameplay screenshots or runtime FPS certification. The close well camera illustrates actual geometry and is not a frozen before/after comparison. No source meshes are hidden. Full historical enrichment/golden gates were not run or rewritten under the dev F5 scope.

## Reproduction

node --import tsx scripts/export-desert-preview.ts OUTPUT_DIR

blender -b -t 2 --python scripts/render-desert-preview.py -- OUTPUT_DIR draft desert-overview,desert-caravan-detail

blender -b -t 2 --python scripts/render-desert-visual-polish.py -- OUTPUT_DIR

The new helper reuses the existing source importer and lighting, checks current source hashes, renders all meshes, and writes its image/camera/source provenance only into OUTPUT_DIR. Draft mode leaves frozen/published catalog previews unchanged.
