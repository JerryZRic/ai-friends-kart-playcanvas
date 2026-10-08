# Free-mode dev playtest

Entry: `dev/index.html`. The stable root game and the existing Windows release
are unchanged. See [the isolated deployment procedure](dev-preview.md).

## Complete play flow

- Main menu: 大肥鱼卡丁车, with Story, Free mode, Settings and Exit at the bottom. Story opens a development notice only when selected
- Free mode: choose Sunset Coast (kart) or Sunny Waterpark (water mount), then
  confirm the rotating 3D map preview and choose one of the same six distributed characters
- Start: real resource loading, then countdown and three laps against five NPCs
- Pause: resume, restart or return to the menu
- Results: actual finishing order/times where available, replay, change character,
  change map or return to the main menu; unfinished competitors are identified
- Exit: a resting page with a return button and instructions to close the tab;
  browsers are not asked to close an arbitrary tab

The cover and map picker reuse the actual PlayCanvas course geometry, animated water,
and lighting. A slow orbit and radial dolly move the camera; the cover changes maps
behind a smooth dark fade every 30 seconds. The map picker stays on the selected
track. No character models are downloaded for either track preview.

Character selection shows the selected distributed rigged GLB, loaded on demand,
with drag and arrow-key rotation. Stale selections are cancelled and a bounded
session cache avoids repeated downloads. Attribute differences and the existing
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

## Water circuit

The full circuit is a closed stadium: two 92 m straights and two radius-76 m
semicircles, approximately 661.52 m per lap. Position and tangent are continuous
at the joints and lap seam, and banks, floor, camera and wakes follow the same
sampler. Eight sequential forward checkpoints per lap prevent credit from
re-crossing a seam or skipping gates. The separate art-study page retains its
original short demonstration route.

Race simulation and countdown use update deltas, not independent timer loops.
Pausing or going into the background freezes gameplay clocks and item effects.
Large stalls explicitly pause rather than attempting unlimited catch-up work. The water
simulation runs fixed 120 Hz steps; render-rate equivalence is covered by tests.

## Settings and rendering

Settings are versioned, validated and stored locally. Invalid or unavailable
storage falls back safely. Settings apply when entering the next race.

- Smooth: pixel-ratio cap 1, shadows off
- Balanced: pixel-ratio cap 1.7, standard shadows
- Detailed: pixel-ratio cap 1.7, higher-resolution shadows
- Optional water refraction; the water performance panel retains its A/B switch
  and locks it during a capture

Reflections/refraction capture static scenery rather than rendering six riders
again. Refraction is bounded color/depth rendering, not a new fluid simulation.
Performance JSON identifies this build separately from the earlier 285 m sample;
those earlier reports must not be treated as six-rider circuit measurements.

## Validation boundaries

Run `npm run check`, `npm test`, `npm run build` and `npm run test:dist`.
CPU integration uses actual PlayCanvas meshes, rigs and race modules on a
NullGraphicsDevice. DOM/network fixtures do not establish GPU shader output,
framebuffer completeness, appearance or hardware performance. Target-device
visual and frame-rate checks remain necessary, especially with all six models.

Every dev publication includes the complete corresponding source and notices.
Six character archives retain their exact authorized hashes and remain separate
from the code license. No new model redistribution terms are introduced.
