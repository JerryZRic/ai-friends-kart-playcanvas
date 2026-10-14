# Mountain land-map polish, 2026-10-14

Scoped scenery-only update from dev b761b518. The connected terrain, road mesh, shoulders, rail geometry, route, collision, pickups, AI and camera implementation are unchanged. All original scenery position/index/UV buffers remain; additions are one group inside the existing founded lookout. No A01, main or release work.

## Appearance
- Fresh meadow / light limestone / blue-distance palette, warm cedar and small amber accents
- Louvered green chalet shutters and divided window panes
- Raised closed roof tile courses
- Three attached balcony flower troughs with leaves, flowers and brackets
- Segmented viewing telescope on the existing stone canopy landing
- Stone geology display bench with three low-poly mineral specimens

## Cost and checks
- Before: 24 batches, 109,990 triangles, 180,757 vertices
- After: 24 batches, 111,694 triangles, 184,529 vertices
- Added: 0 batches, 1,704 triangles (+1.55%), 3,772 vertices
- npm run check: passed
- npm run build: passed (existing large-chunk warning)
- New focused tests: 2/2 passed, including finite data, component ownership, 3 m road clearance of every added vertex, 41 finite adjusted arrival-camera samples
- Existing mountain-enrichment-scenery: 9/9 passed, including unchanged road buffers, terrain clearance, grounded content, closed solids and declared contacts, original prop provenance and exact camera-mesh inclusion
- Its scenery budget retains the original <110,000-triangle cap after subtracting the explicitly identified new group, and independently caps the new group at 2,000 triangles. Every historical golden/hash audit fixture remains unchanged. A separate focused check also limits total cost to 112,000 triangles
- No browser WebGL or FPS claim, and no full test sweep

## Approximate offline renders
Existing export-land-preview.ts and render-land-preview.py generated actual new runtime geometry in Blender Cycles CPU, 12 samples. These are approximate offline renderings, not gameplay screenshots or concept art.
- mountain-overview-draft.png, 960 x 540
- mountain-chalet-roadside-draft.png, 800 x 500

Local artifact directory: /workspace/scratch/7e8d826334ea/mtq-artifacts/mountain
