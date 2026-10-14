# Town land-map polish, 2026-10-14

Scenery-only refinement from dev b761b518. Cream/apricot walls, brighter terracotta, teal shutters and pale masonry form a coherent warm palette, with a muted meadow base. Road material colors, roads, collision, routes, AI, pickups, terrain geometry and camera logic stay unchanged.

## Modeled additions
- Limestone doorway jambs and lintels on the 46 street-row buildings
- Layered eave cornices and paired timber corbels
- Supported window sills and two-louver shutters on selected focal facades
- 28 five-piece, open-topped produce crates across the 14 market stalls

Details are attached to existing buildings/counters, within their existing camera reservations. Existing genuine recessed lower shop bays, street layout, buildings, foundations and landmarks are preserved.

## Cost and verification
- Before: 20 batches, 89,092 triangles, 171,140 vertices
- After: 20 batches, 96,964 triangles, 186,884 vertices
- Added: 0 batches, 7,872 triangles, 15,744 vertices
- npm run check / npm run build passed (existing bundle-size warning)
- town-scene.test.ts 8/8 passed, including exact road samples, both-fork clearance, source terrain, founded props, support winding and repeated NullGraphicsDevice lifecycle
- town-land-polish.test.ts 2/2 passed: every added vertex has 3 m clearance from the exact road union and remains in an existing camera reservation; 76 finite adjusted camera samples across all four edges
- Direct baseline comparison removed only the recorded new vertex ranges and verified that every original batch position, index and UV array matches b761b518 exactly. Road samples, road faces, props, structures, camera reservations and landmarks also match exactly
- No historical hash fixture/audit change; no full test gate or browser WebGL/FPS claim

## Actual geometry previews
Existing exporter and Blender Cycles CPU renderer, draft 12-sample views, visually inspected:
- town-overview-draft.png, 960 x 540
- town-market-street-draft.png, 900 x 562

These are approximate offline renderings of actual runtime geometry, not gameplay screenshots. Source data and reusable GLB are in /workspace/scratch/7e8d826334ea/mtq-artifacts/town alongside baseline-comparison.json.
