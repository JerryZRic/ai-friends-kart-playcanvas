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
