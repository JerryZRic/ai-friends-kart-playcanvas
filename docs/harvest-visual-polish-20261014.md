# Harvest visual polish, 2026-10-14

Dev-only polish based on b761b518. The original richly modeled farm is retained; additions concentrate on its existing five off-road working yards. No A01, route, terrain, road/shoulder mesh, physics, AI, pickups, camera configuration, barn aperture or existing collision changes. Historical fixtures, audits and catalog previews remain frozen.

## Added modeling and palette

- Mill: grounded hand pump with spout, jointed lever/grip and bound timber trough, on the existing terrace corner outside the tower plinth
- Granary: barn-red shutters and iron hinges, projecting sills, crossed door braces, tied sack necks, two resting rakes
- Orchard press: restrained painted fascia and pegs, leaning fruit ladder with eight rungs, twenty raised stave seams on the existing press baskets
- Silo yard: battened service door and an open-tray single-wheel feed barrow with hub, frame, ground-resting legs and feed bags
- Market: small red valance tabs and supported hanging produce scales
- Warm golden grain/cream straw, clearer orchard greens, pale honey wood, restrained red accents; driving surfaces and lighting unchanged

## Budget and preservation

114,583 → 116,519 triangles (+1,936; 1.69%), 183,295 → 186,075 vertices (+2,780), 22 → 22 batches. The original runtime limits of 118,000 triangles and 200,000 vertices still apply unchanged. Every original mesh position/index/UV prefix and all scene records other than new cosmetic component ranges and computed budget are byte-identical to b761b518. See the accompanying JSON comparison report.

## Checks

- npm run check and npm run build: passed (existing Vite worker_threads / large-chunk warnings)
- tests/harvest-visual-polish.test.ts: passed; finite geometry/UVs, valid indices, reused materials, existing budgets and conservative full-component bounds ≥8 m outside all roads
- tests/harvest-route-footprints.test.ts: 6 tests passed
- tests/harvest-gameplay-camera.test.ts: passed; 13,536 route camera poses, 16,128 barn aperture poses, 648 fixed-row rays
- Manual inspection of actual-source Blender CPU overview and orchard-press detail drafts

These are approximate offline static-mesh renders, not gameplay screenshots or FPS certification. Full historical enrichment/golden gates were not run or modified under the dev F5 scope.

## Reproduction

node --import tsx scripts/export-harvest-preview.ts OUTPUT_DIR

blender -b -t 2 --python scripts/render-harvest-preview.py -- OUTPUT_DIR draft harvest-overview,harvest-orchard-detail

Draft renders write only OUTPUT_DIR, leaving published/frozen catalog assets unchanged.
