# Quarry land-map polish, 2026-10-14

Scenery-only refinement from dev b761b518. Pale sandstone and subdued mineral layers replace the heavy red-brown massing; blue-grey metal and small construction-yellow shields give working machinery a clearer hierarchy. Haul-road/shelf-road colors, road geometry, terrain geometry, collision, routes, AI, pickups and camera logic remain unchanged.

## Modeled additions
- Hopper drive plinth, segmented motor, five cooling fins and yellow end shield
- Raised control pedestal with an inset panel, switches and vents
- Hopper rim corner plates
- Two conveyor bearing/drive assemblies with cooling ribs, seat brackets and yellow shields
- Transfer inspection cover, hinges and switchboard details
- Nine open aggregate grading bins in the rear of the existing three service shelters, each with a base, sides, low front, grounded chips and simple grade markers

No extra random scatter or roadside reservations. The aggregate bins occupy the shallow rear strip; the open front bays and loading aprons remain clear. New machinery parts have camera bounds from actual emitted geometry, and every original camera obstacle is preserved.

## Cost and verification
- Before: 20 batches, 103,842 triangles, 167,849 vertices
- After: 20 batches, 105,690 triangles, 171,545 vertices
- Added: 0 batches, 1,848 triangles, 3,696 vertices
- npm run check / npm run build passed (existing bundle-size warning)
- quarry-scene.test.ts: 10/10 passed, including source road ribbons, merge ownership, terrain clearance, full foundation support, trestle clearance and original machinery support connections
- quarry-land-polish.test.ts: 2/2 passed, including every new vertex's exact road-union clearance (3 m), placement over an existing foundation, correct camera obstacle inclusion and 92 finite adjusted-camera samples across all four edges
- Direct baseline comparison removed only explicitly recorded added vertices: all old position/index/UV arrays, road data, props, structures, landmarks, extraction terraces, trestle members and original camera obstacles remain exactly equal to b761b518
- Historical fixtures and strict hash audits remain unchanged; no full test gate or browser WebGL/FPS claim

## Actual geometry previews
Existing exporter and Blender Cycles CPU renderer generated draft 12-sample views, visually inspected:
- quarry-overview-draft.png, 960 x 540
- quarry-conveyor-detail-draft.png, 900 x 562

These are approximate offline renderings, not gameplay screenshots or generated concept art. Source geometry, reusable GLB and baseline-comparison.json are in /workspace/scratch/7e8d826334ea/mtq-artifacts/quarry.
