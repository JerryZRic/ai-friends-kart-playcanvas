# Free-mode dev playtest

Entry: `dev/index.html`. The stable root game and the existing Windows release
are unchanged. See [the isolated deployment procedure](dev-preview.md).

## Complete play flow

- Main menu: 大肥鱼卡丁车, with Story, Free mode, Settings and Exit at the bottom. Story opens a development notice only when selected
- Free mode: choose Sunset Coast (kart) or Sunny Waterpark (water mount), then
  confirm the rotating 3D map preview and choose one of the same six distributed characters
- Start: real resource loading, then countdown and three laps against five NPCs
- Pause: resume, restart, change map or return to the menu
- Results: actual finishing order/times where available, replay, change character,
  change map or return to the main menu; unfinished competitors are identified
- Exit: a resting page with a return button and instructions to close the tab;
  browsers are not asked to close an arbitrary tab

The cover and map picker reuse the actual PlayCanvas course geometry, animated water,
and lighting. A slow orbit and radial dolly move the camera; the cover changes maps
behind a smooth dark fade every 30 seconds. The cover camera runs at nine times the original overview orbit/dolly timing and
two-ninths of the original overview target distance (two-thirds of the previous cover distance).
Its focus follows an actual S-bend centerline with a smooth bounded sweep, keeping
the center on the track rather than the empty infield. The 30-second scene cycle
is unchanged.
The map picker stays on the selected track, now at exactly one-tenth of its
original overview distance and five times its original orbit/dolly speed. Its
closer framing centers a real S-bend instead of the empty course infield. These
map-preview changes do not alter the cover or racing cameras. No character models are downloaded for either track preview.

Character selection shows the original standing figure from before the driving-rig
edits, with drag and arrow-key rotation. These six web-optimized portrait assets
preserve their original textures and poses, including the approved center Gemini.
Only the selected portrait downloads (about 6.7–7.3 MiB); static figures render
again only when needed. Stale selections are cancelled and a bounded two-entry,
36 MiB decoded-byte cache avoids repeated downloads. The seated racing rigs remain
unchanged. See [portrait provenance and validation](PORTRAIT-ASSETS.md). Attribute differences and the existing
race links remain unchanged. The six symbols are selection buttons, not model
previews. Story content and background music are not included.

WebGL2 is required for all real 3D previews and races. Menu navigation remains usable
if WebGL initialization fails; the cover adds no error/debug text. The character
viewer reports loading failures with a retry control. Reduced-motion users get a
static track composition. Leaving a screen destroys its viewer, and hidden pages
suspend frame work. Track previews cap frame rate at 30 fps and cap total rendered
pixels; quality settings also control shadows and extra water captures.

## Shared character profiles

`src/character-profiles.ts` is the common source for the displayed values and
player/NPC tuning. The bounded acceleration, speed and steering coefficients have
tradeoffs; no character has the best value in every category. The models,
identities and license boundaries are unchanged.

Coast defaults are 42 m/s speed cap, 18 m/s² throttle acceleration and 7 m/s
lateral movement at normal top speed. Water defaults are 22 m/s speed cap,
8.6 m/s² thrust and 11 m/s² lateral acceleration before water damping. Menu
values exclude boosts, braking, drift, surface drag and terrain modifiers.

NPC decisions reuse the shared inventory, tactical activation and swept pickup
APIs. Opponents must collect a real available box before using its item. Pickup
claims are resolved by crossing time rather than always giving the player first
choice. There are no invisible random inventory grants.

## One shared race interface

Coast and Waterpark are map/vehicle adapters within the same free-mode game.
Their scene construction and physical handling differ; the player-facing race
interface is implemented once:

- `race-hud.ts` mounts one canonical HUD, touch controls and pause dialog
- `race-ui.css` is the single race stylesheet used by both entry pages
- `race-shell.ts` renders rank, laps, timer, signed speed, charge, held-item
  models, toasts, countdown, pause/resume and results. It also owns race navigation,
  geometry-fitted minimaps and optional tone audio
- `race-controls.ts` handles keyboard/touch sources, focus, rear view, pointer
  lock, interruption and disposal for both maps
- `race-camera.ts` provides the same chase-camera geometry and orbit behavior
- The same settings/performance popover is mounted in each race toolbar;
  water-only refraction controls appear only where supported

W/Up is throttle; S/Down brakes then reverses; Space brakes; A/D or arrows steer;
Shift with steering charges a slide boost. E uses the collected item, Z/C changes
camera, Q recenters, right mouse looks back, and Esc/P pauses. Water retains its
own inertia and damping. Release Shift to spend a charged slide; braking,
reversing and interrupted input cannot accidentally spend a stale charge.

Both races show results at the player's finish, using the map's actual ordering
and interpolated finish time. Competitors who have not crossed are shown with
their progress rather than invented finish times. Replay clears old results and
effects before a new countdown. See [the race-shell contract](race-shell.md) for
the adapter API and ownership boundaries.

## Original medium-complexity circuits

The approximately 921 m water circuit has a tower-side horseshoe, a garden
dogleg, an eastern bowl, a stronger lagoon counter-bend and a broad south
return, with a bridge on the finish approach. Its consistent 24 m canal retains
room to recover. Fourteen staggered pickups offer central recovery and optional
inside/outside lines at corner exits.

The approximately 1,373 m coast circuit has four unequal lobes: a headland
climb, downhill chicane, an open 177-degree lookout hairpin, cross-island esses
and a harbour double apex. Road elevation spans about 2.4–12.6 m, with grade
below 8%; width changes smoothly from 13.2–16.4 m. Wide corner exits alternate
with acceleration sections. Forty-five pickups retain reachable optional lines.

Both use the shared metre-distance `ClosedCircuit` sampler. Rendered surfaces,
barriers, racers, pickups, minimap and map previews follow the same geometry.
Water's eight sequential forward gates per lap still prevent reverse/seam or
skipped-gate credit. The separate art-study page retains its original 285 m
route. See [course design and original reference principles](level-zero-courses.md).

Race simulation and countdown use update deltas, not independent timer loops.
Pausing or going into the background freezes gameplay clocks and item effects.
Long foreground frames are bounded to 250 ms of substepped simulation instead of opening pause or attempting unlimited catch-up. Blur, hidden tabs and explicit controls pause separately. The water
simulation runs fixed 120 Hz steps; render-rate equivalence is covered by tests.

## Settings and rendering

Settings are versioned, validated and stored locally. Invalid or unavailable
storage falls back safely. Settings apply when entering the next race.

- Smooth: pixel-ratio cap 1, shadows off
- Balanced: pixel-ratio cap 1.7, standard shadows
- Detailed: pixel-ratio cap 1.7, higher-resolution shadows
- Optional water refraction; the water performance panel retains its A/B switch
  and locks it during a capture
- Optional race sound effects default to muted and use a separate local
  preference shared across maps. This does not add background music or change
  the versioned quality/refraction settings schema

Reflections/refraction capture static scenery rather than rendering six riders
again. Refraction is bounded color/depth rendering, not a new fluid simulation.
Performance JSON identifies this build separately from the earlier 285 m sample;
those earlier reports must not be treated as six-rider circuit measurements.

## Validation boundaries

Run `npm run check`, `npm test`, `npm run build` and `npm run test:dist`.
`race-shell.test.ts` checks both maps' shared HUD, image caching, pause/resume,
replay, result formatting, navigation, minimap bounds, toast expiration and
blocked storage/audio. `race-hud.test.ts` checks common markup and unique IDs;
`shared-race-architecture.test.ts` prevents entrypoints from bypassing the shared
shell, controls and camera. Input/camera and real-entry integration tests cover
interruption, native menu controls and return-to-race behavior.
CPU integration uses actual PlayCanvas meshes, rigs and race modules on a
NullGraphicsDevice. DOM/network fixtures do not establish GPU shader output,
framebuffer completeness, appearance or hardware performance. Target-device
visual and frame-rate checks remain necessary, especially with all six models.

Every dev publication includes the complete corresponding source and notices.
All twelve driving/portrait character archives retain their exact authorized hashes and remain separate
from the code license. No new model redistribution terms are introduced.
