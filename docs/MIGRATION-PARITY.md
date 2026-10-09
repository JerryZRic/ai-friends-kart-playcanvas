# Full migration parity and verification

This inventory compares the released **AI Friends Kart Web 1.2.0** feature set with this separate PlayCanvas project. The original project is retained separately; the migration does not overwrite it. This document records source and automated evidence separately from browser evidence. A passing CPU test is not a rendered-gameplay sign-off.

The dev free-mode Coast now intentionally has a medium-complexity route:
asymmetric lobes, an open hairpin, stronger counter-bends, variable width and hills. Original curve fixtures remain
unchanged and are checked against an explicit historical `CoastCircuit` using
`ORIGINAL_TRACK_POINTS` and its legacy seam convention. They do not describe the
current playable route. The current route is checked separately in
`coast-level0-geometry.test.ts`; original model/Blender byte-identity checks are
still required. See [free-mode architecture](free-mode.md).

## Verification labels

- **Passed**: a named check was actually executed successfully against this migration
- **Implemented / pending check**: the corresponding code or asset exists but its relevant check has not yet passed
- **In progress**: implementation or integration is still underway
- **Blocked**: the requested verification cannot run in the available environment

## Feature inventory

| Feature group | Original scope that must be retained | Migration evidence and status |
| --- | --- | --- |
| Rendering engine | Complete 3D sunset-coast game, not a selection-only or driving-only prototype | PlayCanvas 2.23.1 installed; runtime imports exclude Three.js. Engine-dependency assertion **passed**. Visual parity **blocked** pending a GPU browser |
| Circuit and environment | Closed elevated coast circuit, road, striped curbs, rails/posts/supports, start checkerboard, original arch/kart/palm/rock assets, signs, islands, mountains, sky/sun, ocean | Historical 1,800-step curve and 32 original position/tangent fixtures remain independently checked. Current dev medium-complexity Coast uses a 28-point shared spline, knot-aligned metre table, periodic tangent, variable-width geometry, slope-conforming markings, curvature-directed signs and rock-clearance filtering. New geometry/invariant tests **passed** on a NullGraphicsDevice. Original asset hashes **passed**; rendering remains unverified |
| Six selectable racers | WHALE, GEMINI, GPT, CLAUDE, GROK, GLM; selected player plus the other five AI racers; stable labels/colors/order | Roster/order checks **passed**. All six exact compressed/decoded identities, original skin/vertex counts, clips and markers **passed**. Real engine animation, independent clones and all six live-game selections also **passed** |
| Rigged models | Full original geometry, UVs, materials/textures, independent skin hierarchies; sampled authored steering, wheel ±18°, pause freeze, neutral reset | Six original payloads unchanged and structurally checked. Real PlayCanvas parser/skin/animation checks **passed**: 121 poses for each model, 54,208 finite CPU-deformed vertex samples, independent clones, unchanged material objects, pause/reset/disposal. Maximum grip drift was 0.199 mm, below the 2 mm limit. Texture decoding/rendering and visual grip inspection **blocked** |
| Loading and retry | Five original course files plus six models; streamed actual byte progress; separate decompression/preparation; size/SHA-256 checks; bounded two-file model work; 60-second attempts; up to four attempts for transient network/408/429/5xx; permanent/parse/integrity failures do not auto-retry | Engine-independent stream/retry suite and 13 bundled/course-loader groups **passed**. No percentage is claimed for parsing. Model failures must be explicit per-slot original-driver fallbacks; course failure must prevent starting |
| Manual retry lifecycle | Retry only failed files; cache successes for page session; retain local replacements; single-flight repeated clicks; no duplicate scene; unknown byte totals remain indeterminate; preparation failure remains visible | Live-game injected preparation failure/recovery, repeated single-flight retry and failed GLM fallback/retry retaining the other five parsed rigs **passed**. Course-loader unknown totals and missing-file retry **passed** |
| Local replacements | Menu-only single selected slot or multiple filename-matched slots; memory-only .glb reads; restore default; refresh clears; cancellation/failure retains prior model | 12 validation/store groups **passed**, covering lifecycle/races, resource bounds and external URI rejection. Native file picker and GPU decode **blocked** |
| Keyboard and driving | Physical WASD/arrows, Space brake, S brake/reverse, Shift drift/release boost, E item, Z/C camera, P pause/resume, Esc pause/release, Q recenter; no automatic acceleration | 11 vehicle-control groups **passed**, including 360-heading steering checks using PlayCanvas math. Full native game keyboard/UI event integration **passed**, including both cameras × 32 headings, focus and native Enter/Space |
| Mouse and touch | Explicit primary click pointer lock, drag fallback, smooth orbit/pitch limits, rear view on right mouse, mouse-button chording, release/cancel/lock-loss safety, native button Enter/Space, canvas focus after Start, mobile steering/throttle/reverse/brake/drift | 9 mouse-orbit/lifecycle groups **passed**. HTML control/accessibility inventory **passed**. Native browser interaction and physical mobile multi-touch **blocked** |
| Race rules and feedback | 3.1-second countdown, three laps, five independently phased bots, timer/rank/finish/restart; collisions and off-road slowdown; 45 item boxes, boosts/shield/pulse; mini-map, speed/reverse, drift meter, toasts/sound | Implemented in native PlayCanvas. CPU integration **passed** for countdown, acceleration/brake/reverse/drift, shield/boost/no-target pulse, pause/safety events, three-lap finish threshold, reset, six selections, 45 boxes and live local replacements. Actual rendered race/feedback/audio and physical touch remain browser checks |
| UI and language scope | Responsive zh-CN game UI with English branding; six README languages: English, Simplified Chinese, Traditional Chinese, Cantonese, Japanese, Korean | Original UI IDs, loading placement, native progress/live region, picker and six touch controls **passed**. All six updated README language files and license references **passed**. The original game has no runtime language switch |
| Licenses and publication | Original AGPL code/open assets and editable sources; separate character-model restriction notice; dependency notices; local relative URLs and nested Pages hosting; downloadable source without duplicated restricted models | Exact five original GLBs and two Blender hashes **passed**; six model identities **passed**. Five source/dist groups **passed**, including privacy/allowlist checks, deterministic source ZIP, source-only/full byte-identical offline rebuilds, manifest-only model restoration and root/nested Pages links. Deployment is verified separately |

## Historical route and exact retained assets

- Historical baseline circuit: 985.3759899870129 game units, fixed road half-width 7.2. This curve remains reproducible in its original fixture test; it is no longer the playable dev layout
- Current Coast: approximately 1,372.5 metres; smooth half-width 6.6–8.2 metres, nominal start half-width 7.2; minimum turn radius above 20 metres and grade below 8%. Maximum standard forward speed 42 and reverse cap 11 remain unchanged
- Original files: kart.glb, palm.glb, rock.glb, arch.glb, kart-r12-chassis.glb; the original kart.blend and props.blend editable source files
- Driver order: whale, gemini, gpt, claude, grok, glm
- Character compressed total: 51,627,206 bytes, about 49.2 MiB. All compressed and decoded sizes and SHA-256 values are independently pinned in the migration tests
- Additional compatible local imports may use the canonical Idle / Steer_Left / Steer_Right three-clip format, tested with a native PlayCanvas blend tree. The six distributed models retain sampled SteeringRange motion.
- Original clip names: DriveIdle, SteerLeft, SteerRight, SteeringDemo, SteeringRange. SteeringRange is two seconds: time 0 = left endpoint, 1 = neutral, 2 = right endpoint
- Original skinned mesh counts: 1, 3, 1, 4, 2, 3 respectively
- Original vertex counts: 154,062; 158,314; 150,285; 97,079; 152,817; 189,564 respectively
- Unchanged authored wheel center (0, 1.105, 0.30), shaft axis (0, cos 43°, sin 43°), wheel angle −steering × 18°

Asset payload identity does not establish visual parity or prove a graphics driver can render it. The actual PlayCanvas parser, animation evaluator and actor lifecycle are covered by the separate null-graphics-device rig tests; texture pixels and rendered appearance remain unverified.

## Reused and adapted test inventory

| Original suite | Migration treatment | Limits |
| --- | --- | --- |
| asset-download.test.mjs | Reused unchanged; 7 behavioral groups passed | Fetch/stream mocks; no real HTTP |
| mouse-look.test.mjs | Reused unchanged; 9 behavioral groups passed | Event-target mocks; no native pointer lock |
| vehicle-controls.test.mjs | Same 11 groups; replaced vector/quaternion checks with PlayCanvas math | Pure controls; no rendered camera projection |
| local-driver-import.test.mjs | Retained GLB security/slot/store portion plus hierarchy/decoder security; 12 groups passed against assets.ts using parser/disposal injection | Real container/rig assertions belong to PlayCanvas runtime-asset tests |
| bundled-drivers.test.mjs | 13 passed groups covering manifest, real-byte decode, loader lifecycle and course retry in assets.ts | Real authorized bytes; injected fetch/parser for lifecycle tests |
| runtime-drivers.test.mjs | Replaced by playcanvas-rig.test.ts; real parser, 121 sampled poses per model and independent skin palettes passed | Only image pixel decoding uses 1×1 placeholder textures; no texture-pixel/GPU claim |
| gameplay.test.mjs | Replaced by gameplay.test.ts using the real game module, scene, meshes and six rigs on a NullGraphicsDevice; integration passed | DOM, loading failures and texture pixels are mocked; neither GPU drawing nor native browser behavior is asserted |
| public-artifact.test.mjs | Replaced by scripts/verify-dist.mjs; all 5 artifact/source groups passed | Original absolute allowlist and game.js layout cannot be copied unchanged |
| migration.test.ts | Engine, explicit historical original-curve fixture, roster, asset identity, glTF structure, UI hook and language/license checks | File/CPU evidence only; current dev geometry belongs to coast-level0-geometry.test.ts |
| closed-circuit.test.ts / coast-level0-geometry.test.ts | Shared metre sampler, periodic frame, finite inputs, current S-route curvature/grade/clearance, variable-width native meshes, slope markings, staggered pickups and preserved geometry budget | Procedural geometry/NullGraphicsDevice evidence; no GPU/browser visual claim |

The npm test output counts top-level test files for the legacy script-style suites; their JSON output lists individual behavioral groups. Do not confuse those counts with browser scenarios.

## Browser replay checklist

These checkboxes track actual browser execution only. They remain unchecked until observed in a WebGL-capable authorized browser; passing CPU cases above does not check off a browser case.

### Game flow

- [ ] Loading prevents Start until the course is usable and all six model loads settle
- [ ] Each of six selections creates exactly one player and the other five opponents
- [ ] Countdown starts at rest; W accelerates; release coasts; Space never consumes items or reverses
- [ ] S brakes through zero then reverses; reverse HUD remains visible; lap display never becomes zero
- [ ] Shift plus steering charges drift only while moving forward; release grants boost; braking/reverse cancels charge without bonus
- [ ] Three full forward laps finish, freeze race result and offer replay; replay resets keys, elapsed time, items, speed, charge, boosts, orbit, particles, pickup cooldowns and animation steering
- [ ] Collision penalties, shield immunity, road-edge penalties and AI slowing after pulse behave as before
- [ ] Boost item lasts 3.3 seconds, shield 6 seconds; pulse chooses nearest opponent ahead within 120 units, otherwise grants 1.9 seconds of boost
- [ ] Forty-five pickup positions remain distributed across three lanes; cooldown is eight seconds; pickup does not overwrite a held item
- [ ] Mini-map, rank, timer, speed, charge, toasts, results and optional sound match state

### Interrupted and repeated input

- [ ] Pause freezes race timer and actor animation; clears held controls; P or explicit resume works
- [ ] Escape repeatedly pauses/releases without toggling back into running
- [ ] Blur, document hiding and unexpected pointer-lock loss cannot leave throttle/rear-view held
- [ ] Native Enter/Space on menu buttons remains intact; Start focuses game canvas
- [ ] Focus on a race toolbar button does not swallow driving keys
- [ ] Right mouse-button release while another button remains down clears rear view
- [ ] Rear-view mouse motion does not create a subsequent orbit jump
- [ ] Camera height stays above the road through full horizontal orbit and pitch extremes
- [ ] Pointer lock rejection/missing API falls back to drag; late lock success after pause is released
- [ ] Touch pointerup/cancel/lostcapture reliably releases each control; multi-touch allows throttle+steer+drift
- [ ] Resizing preserves camera framing and responsive menu access; graphics-context loss shows a recovery message

### Loading and local import

- [ ] One failed character and all failed characters show correct per-slot original fallbacks, with no false six-ready claim
- [ ] Actual downloaded bytes include cached successes; decompression and preparation remain distinct stages
- [ ] Unknown course lengths show indeterminate progress rather than a fabricated total
- [ ] Retry reuses successful course/models and existing local replacements; repeated Retry calls share one task
- [ ] Course missing-file recovery creates scenery exactly once; successful course files are not fetched again
- [ ] Unexpected actor preparation failure shows failure and retry instead of reporting success
- [ ] Pending local reads block race start and retries; changing selection does not change an already captured import target
- [ ] Empty selection/cancel/wrong extension/oversize/read/parse/rig failures leave existing appearance intact
- [ ] Newer same-slot selection supersedes older reads/parses; stale assets are disposed once; queue never exceeds two tasks
- [ ] A stale completion cannot overwrite newer status text or commit after leaving the menu
- [ ] Restore default affects only the selected local replacement and returns the bundled model, or explicitly reports its failed-model fallback
- [ ] Repeated imports/replays clear independent actor controllers before disposing borrowed assets
- [ ] Imported bytes remain memory-only; no upload, storage persistence or external GLB dependency requests

## Browser and publication checks still required

The available cloud browser previously could not create a usable WebGL context, and its permitted connection route could not reach this local development server. Neither condition is a game-pass result. No browser rendering, native picker, pointer-lock, actual touch interaction, texture-pixel decoding, device performance or visual parity is claimed here. Do not bypass these environment restrictions or substitute CPU screenshots as browser evidence.

A WebGL-capable authorized browser should check desktop and narrow/mobile layouts, all six rendered models and steering poses, full three-lap play, items/collisions, repeated replay/import/retry flows, and low/high/rear/orbit cameras. Record device/browser/GPU, whether hardware acceleration is enabled, actual screenshot evidence and frame time. Test one controlled missing asset plus recovery, malformed local import, pointer lock rejection and context loss where safe.

Static publication must be checked independently: build and source archive reproducibility; exactly six approved final character files; unchanged original editable sources; notices/source links; no private sources or secrets; root and nested relative asset resolution; and, after authorized deployment, the expected commit and actual public HTTP responses. Local filesystem checks do not establish deployment success.
