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

## CedarLight Observatory / 杉影星台环线

The fourth original land course connects a low root-valley slalom, a broad climbing cedar bowl, two observatory approaches and a winding treetop viaduct. The main observatory-rim lap is approximately 2,862 m; the Lens Service Path lap approximately 2,798 m. The bowl uses real sampled support banking up to 8.02 degrees. The only disconnected crossing separates road heights by 24 m, with more than 21 m of sampled underside clearance after reserving 2.2 m for structure.

A 97.5 m straight decision approach contains the unchanged shared steering-choice window. Both branches append the same separately sampled tail, certifying the final 40 m of shared pavement. Race support, traffic, items, progress, reverse/reset and lap validation continue to use physical edge distance. Character, garage, difficulty, seed, controls, loading, HUD and results remain shared.

The original scene uses connected ridge-and-valley terrain, 99 cedars, clearings, a physically open observatory dome slit, forestry structures and an open viaduct. Final source geometry currently contains 21 material batches, 107,780 triangles and 140,018 vertices. Its 6,193 bounded camera blockers include short oriented rail pieces rather than loose long-beam boxes; the source terrain heightfield matches the emitted triangles exactly. These are measured source budgets, not FPS.

Independent emitted-mesh audits cover 122,976 complete camera booms and 3,000 live interpolated seam frames, 96 default-view pickup visibility/frustum checks, full-footprint structure/tree grounding and coplanar junction ownership. Actual crossing underside clearance measures 22.033 m. Four complete observatory center sightlines pass, as do the reserved cedar corridors; a wider all-material 3 m viewing corridor is not claimed because ordinary bowl foreground comes within 2.38 m of a center ray.

Controlled same-build native laps measure 78.117 s on the service route and 78.883 s on the rim. Pure shared-physics tests cover all six character/build pairs at five refresh rates and 72 deterministic three-lap NPC races. Sustained steering errors produce real rail contacts that erase the shortcut reward. Native checks also exercise both physical routes, loading recovery, input interruption, pause, settings and garage/map navigation. Fixed pickup rows retain the shared eight-second respawn; physical reaction-gap guarantees apply to dynamic rows, not every fixed-row respawn. The same offline-preview, GPU and device-playtesting limitations above apply.

## Clockwind Workshop / 发条工坊回旋道

The fifth original land course races through an oversized clockmaker workshop. A low wooden apron climbs through a physically graded three-quarter spiral, crosses above its earlier approach, chooses a technical cabinet route or a broad workbench rim, then returns down connected drawer terraces. The perimeter lap is approximately 2,642 m and the cabinet lap approximately 2,592 m. The spiral gains 24 m of actual supported height; sampled banking reaches 5.73 degrees.

The crossing revisits the same physical start edge at two different distances, so support, resets, traffic, pickups and checkpoint validation must retain edge-local metres rather than selecting the nearest XZ road. Both branches use a separately sampled identical final 40 m tail. Pavement ownership and guardrails follow the full spatial road union, including the larger overlap around split and merge; the interaction tail is not a mesh clipping boundary.

A 200 m level straight contains the unchanged shared steering-choice window. Wood and cabinet inlay use the existing grip and rolling-resistance channels. The clock gears and tools are static original scenery; no moving conveyor, jump, magnetic attraction or hidden branch speed bonus is implied. Fixed pickup rows retain their existing eight-second cooldown, while the shared dynamic placement director evaluates physical reaction gaps.

The final original scene contains 21 static material batches, 97,508 triangles and 146,357 vertices. Modeled clock wheels have connected shafts and a rear supporting frame; the tool cabinet has recessed fronts and handles; the vise includes a screw, jaw pads and cross handle. The amber lamp diffuser is colored geometry under the shared scene lighting, not a new light-emitting gameplay system. These counts are source budgets, not GPU frame rates.

An additive exact triangle camera primitive represents open spiral shelves and thin elevated decks without treating their empty underside as a solid box. It uses a cached spatial grid and swept-sphere face/edge/vertex queries. Existing box and terrain-heightfield paths are unchanged. Independent source-mesh audits cover 152,928 desired/smoothed whole booms, 14,664 live seam and densely sampled crossing frames, and 18,336 additional whole-boom clearance probes; the latter have a minimum measured separation of 0.49575 m. Local shelf queries select at most 384 of 8,424 shelf triangles in the audited samples, not an all-scene scan. This is bounded sampled CPU coverage, not a universal visibility or performance guarantee.

Actual crossing structure has at least 24.432 m of sampled full-width underside clearance. All road-body prisms and the reserved lower passage are clear of scenery; full-footprint grounding, 15,075 correct-deck support probes, 96 pickup sightline/default-frustum checks and four target-first-hit landmark rays pass. Camera safety does not change vehicle collision, support, physics or route progress.

Controlled same-build native laps measure 70.80 s through the cabinet and 71.33 s around the rim, both without rail contact. A three-second held steering error after a clean approach makes the cabinet run take 73.40 s with 5.267 s of actual rail contact, losing its reward against both clean and equally delayed rim controls. Pure shared-runtime tests cover all six builds at five refresh rates on both routes and 72 deterministic three-lap NPC runs. Full-traffic/item races are separate functional observations, not controlled balance comparisons. Native tests also exercise both same-edge crossing levels, reset/checkpoints, input interruption and shared results/navigation. Offline previews and CPU checks do not establish device GPU frame rate or replace human playtesting.

## Amberwind Harvest / 谷风麦垄回环

The sixth original land course connects golden grain terraces, a windmill ridge, orchard contours, a genuine drive-through barn and a low market hollow. The Golden Contour lap is approximately 2,787 m and the Barnyard Cut approximately 2,697 m. Actual supported road heights range from about 9.8 m to 34.0 m; there is no forced elevated-road crossing. The shorter choice earns its distance advantage through physical geometry, not a branch speed bonus.

A 100 m straight decision approach contains the unchanged shared steering-choice window. Both branches append the same separately sampled 40 m tail, with physical edge-local metres used for race support, items, traffic, resets and checkpoint validation. The barn has a 48 m architectural opening, with a visibly bounded 11.4 m road inside it and 18 m of measured full-road roof headroom. The wider building opening is not a claim that its entire floor is a driveable lane. Windmill sails and farm machinery are static scenery.

The original harvest scene contains 21 static material batches, 108,687 triangles and 178,812 vertices, including 27 orchard trees, 47 crop rows and five farm landmarks. Grounded timber frames, seated rafters, tool-rack brackets, retaining stone and modeled farm equipment are verified against emitted source geometry. These are source budgets, not measured GPU performance.

Independent mesh checks cover all 3,900 full-width road polygons, 16,095 legal-lane support probes and 376,344 whole-camera-boom clearance checks across desired positions, genuine interpolation, the barn passage and shared-route seams. The sampled checks enforce a 0.3 m surface margin. Intentional lane rails remain included in driving-body and camera checks; only the architectural aperture calculation distinguishes them from building structure. Exact triangle blockers also cover the fork sign and its posts. There are 432 pickup sightline/default-view checks, including the barn approach at several distances, and four target-first-hit landmark rays. This is bounded sampled CPU coverage, not a guarantee at every camera position or a GPU playtest.

Controlled same-build native laps measure 73.150 s through the barn and 74.883 s along the contour, a 1.733 s reward. A three-second held steering error on the branch raises the barn time to 76.083 s, losing to the clean contour by 1.200 s; it still narrowly beats the equally delayed contour at 76.250 s, so an equal-error reversal is not claimed. Pure shared-physics checks cover six builds at five refresh rates and 72 deterministic three-lap NPC runs. Native tests complete both three-lap routes with six racers and exercise shared menu navigation, camera, reset and input behavior. Fixed pickup rows retain the existing eight-second respawn; physical reaction-gap guarantees apply to dynamically placed rows rather than all respawns.

## Sunweave Caravan / 星砂古驿

The seventh original land course climbs supported dune ridges to a sandstone crown, descends a wind-carved S corridor and enters open caravan courtyards. The broad Sailcourt Sweep measures approximately 2,784 m; the technical Archway Weave approximately 2,727 m. Actual sampled road heights range from about 9.5 m to 43.8 m. The course has no road crossing or additional vehicle behavior.

A straight, level 100 m westbound approach contains the unchanged steering-choice window. Both branches append the same separately sampled 40 m tail. The road is 19 m wide on the broad sections and 11.8 m on the technical interior; pavement and visible guardrails follow the full spatial road union rather than using the interaction tail as a clipping boundary. The paired stone arches have actual 52 m architectural openings over the visibly bounded driving ribbon. The measured full-road overhead clearance is at least 33.635 m; the wide building aperture is not a claim that its entire floor is driveable.

The original scene contains 22 static material batches, 107,224 triangles and 133,911 vertices. A connected 27,000-triangle terrain mesh spans about 8.1–57.6 m in height, with grounded closed sandstone corridor forms and layered rock detail. The source budget prioritizes connected landform and structural support before smaller caravan props. Original open masonry rings, fabric frames, seated pottery, a grounded wheeled cart and modeled ruin assemblies have explicit component provenance. Vehicles and items are additional to these environment counts.

Independent emitted-source audits pass 24 structural/camera gates, including all 4,016 full-width road polygons, 16,585 legal-lane support probes, 12 complete foundations and 1,059 modeled structural contacts. The cart wheels seat 0.01 m into their supporting cap, with no positive floating gap. Some inner spokes are naturally hidden by the cart body and cargo; the source report distinguishes visible witnesses from physical connections rather than claiming every detail is always visible.

Actual whole-camera-boom audits cover 356,472 desired/interpolated checks with a strict 0.3 m surface margin, plus 1,296 pickup sightline/frustum rays. Seven driver/chase/rear reveal positions have explicit source first-hit coverage, separate from the offline pixel review. The runtime camera payload includes all 80,224 non-base-terrain faces, while the exact heightfield covers the remaining 27,000 terrain triangles. A representative 140-query sample selects at most 2,172 mesh candidates per query; this is a bounded sampled source-cost observation, not a universal maximum or GPU/FPS measurement.

Controlled same-build native laps measure 74.450 s through the archway and 75.450 s around the sailcourt, a 1.000 s shortcut reward. A three-second held steering error on the selected branch produces 77.767 s versus 77.067 s on the equally delayed broad route, reversing that reward by 0.700 s. Across all six authored builds and five tested refresh rates, clean rewards range from 0.625 to 1.242 s, with no clean rail contact; each route's refresh spread stays below 0.0084 s. These are reproducible CPU input recipes, not measured human balance. All 72 deterministic three-lap NPC runs finish and replay identically.

Native tests also check all six assembled driver/kart bounds through the actual arch openings, all 18 fixed pickup claims, pause-frozen cooldown, unchanged eight-second respawn, reverse/reset/checkpoints, both three-lap branches and shared loading/menu/garage behavior. Dynamic item placement retains its physical reaction-gap checks; fixed respawns are not described as having a universal reaction-gap guarantee. Offline source renders, geometry audits and NullGraphicsDevice tests do not establish GPU execution or device frame rate.
