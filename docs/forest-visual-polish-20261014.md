# Forest visual polish, 2026-10-14

Dev-only visual work based on b761b518. No changes to A01, route/road geometry, physics, AI, pickups, camera configuration or existing collision geometry. Historical fixtures, preview assets, frozen comparisons and audit scripts are unchanged.

## Added modeling

- Forestry station: pale honey board battens, framed/silled windows, four-legged sawbench with supported cut log, open slatted crate
- Canopy lookout: individually separated top deck boards, railing spindles, supported three-slat bench and back
- Observatory: raised stone courses, modeled window trim/mullions, two timber planters containing soil and layered fern leaflets
- Ten existing near-route cedar groups: composed understory bouquets and small amber mushrooms, rooted on actual terrain
- Palette: layered fresh green canopies and moss; honey timber/end grain; light copper and restrained amber details. Driving surfaces and scene lighting are unchanged

## Budget and preservation

108,772 → 114,308 triangles (+5,536; 5.09%), 138,214 → 149,208 vertices (+10,994), 21 → 21 material batches. All additions are append-only; every pre-existing position/index/UV prefix is identical. Protected scene records, including roads, terrain, camera solids, props, tree bounds, structures, foundations and sightlines, compare byte-for-byte with b761b518. Detailed counts/hashes are in the accompanying JSON report, not a replacement for historical fixtures.

## Checked

- npm run check: passed
- npm run build: passed (existing Vite large-chunk / worker_threads warnings)
- tests/forest-visual-polish.test.ts: passed, including finite vertices/UVs, valid indices, preserved material count and conservative full-component bounds ≥8 m outside all source road ribbons
- tests/forest-route-footprints.test.ts: 3 tests passed
- tests/forest-gameplay-camera.test.ts: passed, 13,392 center/lane-limit poses across orbit/rear/height modes
- Manual inspection of two source-geometry Blender draft renders: complete route and station detail

The Blender CPU previews are approximate offline renders of actual runtime meshes. They are not browser/gameplay screenshots and do not establish runtime FPS. Full historical enrichment/golden gates were not run or rewritten under the agreed dev F5 scope.

## Reproduction

node --import tsx scripts/export-forest-preview.ts OUTPUT_DIR

blender -b -t 2 --python scripts/render-forest-preview.py -- OUTPUT_DIR draft forest-overview,forest-station-detail

Draft mode writes only OUTPUT_DIR; it does not overwrite frozen catalog imagery or provenance.
