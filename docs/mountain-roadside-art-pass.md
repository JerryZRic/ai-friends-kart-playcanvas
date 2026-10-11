# Cloudridge Pass: roadside art pass

This is an incremental refinement of existing Mountain001, 云岭盘山道. It improves the first structural pass's sparse driver-height composition with original early-autumn planting and a small lookout landmark. It is not a claim of finished fidelity comparable to the commercial reference games.

## Visible changes and comparison

The lodge approach now has spruce groups framing its bank, overlapping green/gold broadleaf crowns, and low mixed green/ochre/copper planting with granite bases. Western esses and the pine switchback receive related but separated pockets, leaving the apex, road exit and skyline readable. A compact gold-roofed watch platform sits back from the lodge. Its placement was corrected after the historic architectural comparison revealed an obscured roof; the complete original roof and canopy are visible again.

The work reuses the [official visual-reference study and original-art boundaries](mountain-scene-enrichment.md#reference-study). It borrows composition principles rather than any course, character, logo or mesh. The two selected original Alpine props and their license/provenance remain unchanged.

Before/after images use the first structural scene as the baseline and the same frozen cameras, exposure, source light and source-normal translation. Eight 56-degree shared-chase poses, the frozen overview, the separately identified 36 mm architectural view and lower-underpass approach provide eleven comparisons. The current menu overview and supplemental topdown are separately identified. Every scenery batch stays enabled. These are CPU source-derived offline renders; their material, ambient, shadow and color response differs from PlayCanvas. They are not browser gameplay or GPU captures.

## Final source and budget

- Final builder SHA-256: `1ee148604b6078d946b9c213994b0a3874e1089af60930d7194d3b8a30a0f5af`
- 24 static material batches, 109,990 triangles, 180,757 vertices and 2,366 components
- Unchanged limits: at most 24 batches, fewer than 110,000 triangles and fewer than 190,000 vertices
- Four existing procedural textures are reused; course-specific lazy loading remains unchanged
- First structural scene: 22 batches, 109,984 triangles and 181,125 vertices

These counts exclude vehicles, item pools and effects. They are source budgets, not measured GPU memory or frame rate. The earlier [camera-query CPU benchmark](mountain-camera-benchmark.json) measures the first structural pass only and is not presented as a new timing sample for this art pass.

## Independent targeted checks

The additional tests are in `tests/mountain-art-pass-clearance.test.ts`, with independently captured first-pass fixtures. The baseline runtime geometry is the first structural builder `847253b5…`; its corresponding published runtime source is in commit `308ca27c828677805d2a3f15282816462ab0f457`. Original route and native-control goldens were not regenerated.

- All 1,961 selected solids, comprising 26,526 faces, are consistently oriented closed shells
- The complement of 405 components and 83,464 triangles retains exact first-pass position/index/UV buffers and component identities, making the selected change-family coverage explicit
- 183,955 selected-versus-all candidate pairs contain zero raw or exposed same-facing coflush overlaps
- 108 finite camera histories cover six arrival/planting intervals, three legal lanes, 30/60/144 Hz, default/rear views and bounded orbit changes
- 34,776 frames, 69,552 whole booms and 34,668 inter-frame motion segments pass the unchanged 0.3 m clearance requirement against all emitted triangles and exact terrain planes; measured minimum boom clearance is 0.453745315 m and motion clearance 0.415017466 m
- Three protected-source/route/road/pier/isolation preservation gates and TypeScript checking pass

The targeted run took 14.422 seconds with 409,364 KiB peak process RSS and 174.991 MiB end V8 heap under a 448 MiB old-space cap, serial concurrency one. These are bounded CPU-process observations, not GPU/FPS results. Full global camera, structural, six-build native gameplay and release-wide regression are separate gates.

## Retained unretracted-orbit limitation

The conservative unretracted underpass cylinder remains obstructed. The original first-pass diagnostic tested viaduct/road faces only, so its non-pier result must be read within that component set. This added diagnostic inspects all source-diff-family faces and exact original piers, while other unchanged scenery remains outside its narrow raw-cylinder scope.

The finite matrix covers route fractions 0.875–0.935, 434 stations at 0.5 m spacing, radius 16.510905487 m, 0.3 m margin and 0.75 m between-station allowance. It retains 1,359 original-pier face/station contacts, minimum margin −7.148113298 m, and 8,171 inherited-scenery contacts. The independently expanded first-pass measurement has 9,432 scenery contacts. Triangle-contact counts are diagnostic because tessellation differs.

The final candidate has 206 inherited assembly/station pairs versus 208 in that baseline. It adds no sampled pair, worsens no sampled per-station physical minimum and introduces no contact from new or relocated scenery. Exact original crowns for `spruce-3-0-2` and `spruce-3-1-1`, and the complete original talus at section 7 / rock 2, were restored after the broader test exposed small retessellation regressions. Three new low shrub masses use fewer sides to retain the original geometry ceiling. The original piers, safety thresholds, route and shared camera code are unchanged.

This records a negative conservative envelope alongside passing actual safety-adjusted camera checks. It does not certify unrestricted continuous-angle travel without retraction, or every possible camera/model/animation state. Real GPU lighting, FPS and device control feel still require device playtesting.

No new map, race mode, Windows package, driving rule, AI behavior, checkpoint rule or item timing is introduced.
