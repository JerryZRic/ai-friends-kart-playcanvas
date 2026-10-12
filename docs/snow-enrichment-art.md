# Frostloop Depot: wind-packed shelves and station terraces

## Scope and honest baseline

This is an append-only enrichment of the existing Snow008 course. It creates no new course and changes no physical road, terrain grid, original landmark, wheel, route, camera formula, input, physics, checkpoint, pickup or AI source. Main and Windows are outside scope.

The baseline is clean local commit `1005abd2b09b49310c8a8387de10e674ad9ee6ce`, containing unpublished Workshop, Harvest and Desert candidates. Snow itself is original. The last independently verified public dev head was `915109353ed1d2fcdc8afbb5bdacafca3648e92e`; the local baseline is not represented as a new public release.

The original Snow allocation is 106,286 triangles, 155,970 vertices and 23 batches. The approved Snow-only ceilings are fewer than 120,000 total triangles, at most 12,000 added triangles, fewer than 200,000 vertices and exactly 23 material batches. These are ceilings, not targets. The current reviewed candidate has 114,800 triangles (+8,514) and 172,192 vertices (+16,222), keeping all 23 original materials unchanged.

## Original composition

- Five broad wind-packed snow shelves make two bowl approaches visibly layered. Two unequal shelves sit on the first outer bank, with a lower opposite exit shelf. Two more follow the second bank's existing grade. Each has a terrain-clipped closed underside and a thick, uneven, rounded upper profile
- Two cohesive windbreak clusters add three unequal, snow-laden evergreen silhouettes on each outer bank. Their original closed crowns and thick seated snow mantles provide a darker middle-ground layer at fixed driver height
- Two substantial open slatted snow fences occupy the gaps between snow masses. They have independently grounded feet, continuous posts and three baffle rows with real daylight gaps
- Two unequal station annexes frame the preserved clock hall. Their facades face the normal driving approach, with actual open center doors, recessed outer windows, thick slate/snow roofs and a low, six-post platform shelter. The clock remains the tallest identifying feature
- One open maintenance-yard shelter frames the Service Cut without touching the original roundhouse bays or sidings. Two broad, curved oxide plow-blade stocks sit on real ground-connected bearers; there are no additional wheels or moving vehicles

The first left-only bowl design was rejected because it was mostly outside the fixed driving frame. The first annex orientation was rejected because the approach showed a blank side wall. The accepted direction moves snow onto the visible outer bank and turns the facades toward the driver. No camera was moved to disguise these revisions. No tint-only change, added generic tree count or microscopic prop budget is used.

## Structural ownership

Every added vertex, index and component follows all original per-batch prefixes. Original components, landmarks, ground records, contact records and camera blockers remain unchanged. Each enrichment assembly gets its own indexed piece ledger, directed support ownership and exact-triangle camera blocker; the open doors and shelters have no filled proxy boxes.

The assembly ledger names five closed drift solids, two fence groups, two windbreak groups, two annex groups and the maintenance-yard group, with 165 new closed solids. Terrain-contact bases are clipped from the unchanged actual terrain triangles, with intended 0.04 m embedment and explicit bottom-face ranges. Ground is never flattened. For each fir, the lowest crown’s complete 18-sided footprint is clipped against actual terrain; a derived stem lift keeps the crown base at least 0.30 m above the highest terrain in that footprint, while its small root slab stays unchanged and the continuous trunk extends by the same amount. The upper crowns fit inside that first footprint. Lower snow mantles also name their intentional trunk-through contact, independently of their complete green-crown bearing surface. Snow roof caps name the exact slate support and full underside range. Curved blade stock is a closed original mesh rather than a billboard or downloaded model.

This construction description does not substitute for independent proof. The QA suite separately reconstructs indexed ownership, closure, outward winding, ground contact, full seats, structural contacts, overlap, openings, road-body clearance and camera payloads. See `SNOW-ENRICHMENT-QA.md` for the final scope and any remaining failures.

## Frozen comparisons

`docs/snow-enrichment-cameras.json` freezes 24 source-derived road-eye/shared-chase transforms before any enrichment edits, plus all five original catalog transforms. It retains all eight historical review stations and adds baseline-only early clock/service approach candidates. Boulevard s330 faces away from the clock hall; it remains a regression transform and is never claimed as a forward clock view. The s160 normal approach was rendered and inspected on the original baseline before implementation, then kept fixed.

The first eight-pair gate uses road eye and shared chase at first bowl s380, second bowl s1100, Service Cut s210 and Terrace Sweep s160. Road eye is sampled road +1.6 m, looking to sampled road +32 m. Shared chase uses the unmodified view-0 camera, zero orbit, rear off and the original baseline safety result. Every comparison uses 56-degree vertical FOV at 1280×800, identical camera transforms, original materials, procedural texture bytes, source normals, exposure and winter lighting.

Draft images use eight Cycles CPU samples with two threads and no denoising. The renderer checks exact source positions and the source-normal FLOAT_VECTOR POINT attribute at float32 precision, then shades using object-to-world NORMAL, normalization and the original two-sided facing sign. It does not smooth away source geometry or substitute a different normal field. Catalog cameras are not refitted to the candidate.

These are offline static source previews with approximate lighting/material response. They contain no kart, racing driver or HUD and are not native gameplay, GPU or FPS evidence. Off-road clock/plow portraits retain their original off-road labels. Unrendered frozen camera transforms are not image evidence.

## References and licensing

The design uses only general composition principles observed in official Nintendo winter and SEGA station/roofscape promotional images: thick unequal roof masses, repeated supports, foreground/middle/background layers and an open driving exit. All new geometry is authored in the project's procedural source. No game route, character, logo, signature building, reference image, external texture or downloaded model is copied or shipped.

Official reference pages:

- https://www.nintendo.com/us/store/products/wave-3-70050000032778-switch/
- https://asia.sega.com/SonicRacingCrossWorlds/en/courses.html

The existing source-license notices apply, including AGPL-3.0-only project provenance. Reference images are private research evidence and are excluded from source and model deliverables.

## Reproduction and status

Export with `node --import tsx scripts/export-snow-preview.ts OUTPUT`. Render frozen draft views with `blender -b -t 2 --python scripts/render-snow-enrichment-preview.py -- OUTPUT --samples 8`; `--baseline` verifies archived source and immutable baseline artifact identities. `--catalog` adds all five original catalog cameras. `--samples 48 --final-set` selects the fixed 13-view final set: eight driving views plus all five catalog views, while retaining all 29 frozen transforms in the BLEND. `--views` selects existing frozen names without retargeting. `--resume` requires unchanged source, geometry, camera, renderer and settings hashes.

Use `scripts/verify-snow-enrichment-model.py` against the reopened BLEND to verify exact indexed positions, normals, UVs, source-normal shader links, packed pixels, camera transforms, materials and companion GLB streams. Rendering alone is not reopened-model proof.

Current status: the fixed-camera art gate is accepted. Independent new-geometry checks pass all 165 closed outward solids, 25 full terrain roots, complete cap seats, original geometry/normal/material prefixes and zero self-intersection, exposed coflush skin, unrelated-volume overlap or terrain intrusion. All 13 original Snow suites and the added, affected-isolation and shared checks passed: 183 distinct local tests across 35 files. The complete retained camera/runtime matrix passed, as did the 120,456 additional baseline/candidate camera comparisons, with no new retraction or output changes. All 13 matched final image pairs were rendered with identical fixed cameras/settings; both reopened GLB/BLEND exports preserve exact source positions, normals, UVs, materials, texture pixels and all 29 frozen cameras. The local poster/provenance update passed. Build/source reproduction and remote deployment are reported separately; no new public preview or remote-write claim is made here.
