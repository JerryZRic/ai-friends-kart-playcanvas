# Original land courses · dev preview

## Cloudridge Pass / 云岭盘山道

The new land course is selected from Free Mode and uses the same kart garage, six drivers, difficulty/seed options, loading screen, HUD, controls, items and results as Sunset Coast. It runs through `coast.html?map=mountain`; this is a shared runtime, not a second copy of the game. Waterpark retains its own water handling.

- Original 3,616 m closed contour circuit with approximately 39 m of road elevation change
- Terraced climb, summit horseshoe, high viaduct, downhill esses, pine switchback, granite basin hairpin and underpass recovery straight
- Actual graded and cambered road coordinates support the vehicles, camera, scenery and pickups; the bridge's two driveable decks remain separate at the X/Z crossing
- Track-constrained arcade support, with grade force, road grip and rolling resistance shared by player and NPCs. This is not a free-roaming rigidbody suspension simulation
- Canonical unwrapped distance and twelve ordered checkpoint gates per lap; bounded reverse subtracts physical progress and never grants gate credit, while teleport/skipped-gate movements cannot manufacture laps
- Multi-sample NPC turn look-ahead avoids mistaking an S-bend for a straight; difficulty changes decisions rather than vehicle physics
- Original modeled guardrails/reflectors, limestone shoulders, stone strata, viaduct piers, terrain heightfield, clustered spruces and timber lookout chalet

## Geometry and loading budget

The first mountain environment uses 20 static material batches and 78,158 environment triangles, with shared 64×64 procedural textures. Gameplay item pools and six assembled vehicles are additional. These counts are source/headless measurements, not measured GPU frame rate. Mountain modules load only when selected; coastal props are not downloaded for the mountain race. Existing character and kart downloads are shared and retain their established license terms.

Preview, race and offline render all consume the same authored map module and scene geometry. The `.blend`/geometry deliverable is an editable snapshot of those original meshes. Public menu artwork is a CPU offline render with approximate lighting, not a browser gameplay screenshot.

## Validation scope

Tests cover finite road geometry, bank/grade and seam continuity, complete road separation away from the deliberate high crossing, conservative crossing clearance, terrain below both decks, roadside clearance, repeatable procedural textures, preview cleanup, URL/garage state retention, slope launch after reversing, altitude-correct restart, anti-shortcut gates, and a complete native PlayCanvas race with actual character and kart models. Existing coast/water/menu/garage regression and source-reproduction checks are required before publication.

The cloud environment cannot perform reliable WebGL/GPU visual or FPS verification. Real GPU lighting, performance, control feel and platform-specific behavior still need device playtesting. No new Windows package is part of this land-map update.

## Sources and licensing

Route coordinates, procedural meshes, textures and rendering scripts are original project work distributed with the repository's AGPL-3.0-only corresponding source. No Nintendo/T-Time map or artwork was copied. The reusable map-only package contains no character model; the game's existing character models retain separate non-commercial restrictions. See `MODEL-NOTICE.txt` and `LICENSE`.

## Lantern Terrace Rally / 灯阶旧城环线

The second original land course extends the same race runtime with a physical fork. Steer left into Lantern Alley or right onto Tram Boulevard before the signed junction. Both choices rejoin the market circuit; NPCs choose routes deterministically from the race seed. The narrow technical alley saves distance, while the broader boulevard offers a more forgiving line. Route comparison uses the same kart and actual shared driving helpers, not hidden route speed multipliers.

Each racer retains its own physical edge, metres travelled and per-lap route history. Canonical progress is used only for standings and checkpoint order. Reverse movement retraces the chosen edge; reset, camera, road support, collisions, pickups and traffic use the physical branch. A high street viaduct crosses the lower circuit with measured overhead clearance. Branch separation also prevents items or traffic from affecting racers across disconnected streets.

The original town scene includes terracotta-roofed houses, timber arcades, market stalls, a clock tower, parked tram, citrus trees, lanterns, masonry abutments and road-edge details. Shared junctions are kept open, overlapping merge surfaces are deduplicated, and scenery is checked against both driveable ribbons. Modules and geometry load only after selecting this course. All normal garage, character, difficulty, seed, loading, pause, settings and results flows remain shared.

Town previews use exported runtime geometry and procedural textures. Counts and headless lifecycle checks are engineering budgets, not measured FPS. The same GPU and device-playtesting limitations above apply.

Current town environment budget: 20 material batches, 95,630 triangles and four shared procedural textures. The complete boulevard lap is approximately 1,526 m; the alley lap is approximately 1,437 m. Full-scene meshes include architecture and props, not the six vehicles or item/effect pools.

A controlled same-kart native-runtime lap, with no traffic or items, measured 42.000 s through a corrected alley line and 42.783 s through a corrected boulevard line. An uncorrected alley run took 43.333 s. This validates a modest shortcut reward that rail scrapes can lose; it is one automated control recipe, not a promise of player times or competitive balance across every build. Pure driving tests also cover all six character builds on both routes at 30, 60, 120, 144 and 240 Hz.

## Redstrata Quarry / 赤砾采石环道

A dry sandstone extraction basin adds an original third land layout: a low processing-floor sweep, inner carved hook, technical stone shelf or broad haul-road crescent, timber trestle and rounded loading-yard return. The haul lap measures approximately 2,239 m; the shelf lap approximately 2,171 m. Road relief is approximately 27 m and the maximum authored grade is 10.43%. The one disconnected crossing has more than 22 m of conservative structural clearance in the route design.

Both branches join an explicitly certified 40 m shared throat. Racers approaching or occupying the same pavement use physical remaining-distance interactions, while disconnected branch interiors remain isolated. The course reuses the exact physical-cursor/checkpoint/camera/item runtime established by the town. Its HUD branch labels, deterministic NPC salt and pickup rows are course metadata rather than a duplicate game.

Original cut-stone benches, open timber structures and industrial landmarks are built from reusable small materials and batched meshes. Source tests check every driveable ribbon, coplanar junction ownership, terrain clearance, support grounding and structural clearance. Runtime geometry, public map thumbnail and downloadable original model use the same source geometry.

A reproducible default mixed-build, full-throttle pilot at 60 Hz gives the clean shelf a 0.650 s advantage (60.983 s versus 61.633 s). With the same synthetic 1.2 s branch steering response interval, shelf contact loses that advantage (62.283 s versus 61.633 s). This is a controlled physics recipe, not measured player skill or a guarantee for every build. Character/build and frame-rate checks, NPC route simulations, native game tests and complete legacy regression precede publication. The GPU/device-playtesting limits above continue to apply.

Quarry production geometry uses 20 static material batches, 165,571 vertices and 102,692 triangles with shared procedural textures. The production ceiling is 24 batches, 200,000 vertices and 110,000 environment triangles, revised from the initial design estimate to accommodate fully grounded structures, safe junction ownership and detailed industrial modeling. Vehicles/items are additional. These are source budgets, not measured GPU frame rates.

The quarry camera checks the exact emitted terrain triangles along its whole boom, including after smoothing, so a cut-stone ridge cannot be skipped by sparse point sampling. Independent source-mesh audits cover 37,872 lane/orbit poses and 84 default-view pickup sight rays. Extreme mouse pitch can partly hide a box behind a thin rail; source checks do not establish perfect visibility at every camera angle.
