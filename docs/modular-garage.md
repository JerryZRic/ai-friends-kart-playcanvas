# Modular food kart garage · dev preview

Open `garage.html` from the main-menu workshop link or the coast character picker.
Free mode follows map → character → garage → race settings → race. A standalone
garage link keeps its direct coast test action. Waterpark uses a mount confirmation
step, then the same race setup, without electric kart statistics or substitutions.

## Implemented

- Six independent slots: body, chassis, motor, final drive, battery and wheels
- 54 original food themes / 324 exact catalog part identities
- Theme and text filters, actual source-render thumbnails, complete-theme fitting
- Real six-container PlayCanvas preview, orbit/zoom and keyboard camera controls
- Current/candidate combined character+car comparisons and five editable role recipes
- Browser-local active build and named builds; strict validation and graceful
  unavailable/corrupted-storage handling
- The garage race URL carries a validated build snapshot, so blocked storage does
  not silently discard a selection on the next page
- Actual player coast vehicle geometry and handling use the selected six parts;
  opponents use deterministic authored mixed recipes with identical part formulas
- Existing six character multipliers remain authoritative and unchanged
- Grip-dependent corner ceilings and gear/mass-dependent grade acceleration apply
  to both player and opponents through the same centerline sampling
- No matching-theme performance bonus

## Loading and resource ownership

The collection is never preloaded at boot. The garage downloads only the theme bundles needed for selected
parts; a race prepares the selected player build and five authored opponent recipes,
then shares containers among the six independent actor instances. Original PNG
bytes are shared in transit, with a bounded verified-theme cache. Identical
textures with identical format/sampler state share reference-counted GPU resources.
Unused part containers are bounded; live instances pin their resources.

Every part reconstructs its exact original GLB hash before parsing. Progress is
measured download bytes and explicit parse stages, not a timed success animation.
Missing/corrupted parts prevent assembly readiness and race start. A retry retains
already prepared assets. New preview selections cancel old requests; stale parse
results are disposed. Page exit cancels transfers and waits for active parsers
before destroying the PlayCanvas application.

## Rider adapter

Food modules retain their common authored identity roots and mount anchors. Their
material-batched chassis has no authored moving steering pivot, and actual food
cushions differ in height from the construction marker. The runtime adapter measures
the seat, extracts the original food steering solids into owned meshes, repositions
the original wheel/column for the seated rider, and fits unchanged arm lengths to
actual left/right handles. It preserves original source files and material pixels.
Four independent wheel pivots animate at the original 0.435 m radius.

See tests/kart-driver.test.ts for real PlayCanvas hierarchy, geometry, skin/pose,
all-chassis fitting, independent actors and resource disposal checks. CPU/headless
checks do not establish a hardware-GPU rendering or mobile performance result.

## Deliberate preview limits

This is assembly and fresh-vehicle performance first. Battery discharge, wear,
repair/economy, rollover and recovery systems are not active. Capacity, rigidity,
durability and recovery figures remain design metadata. Heavier variants whose
proposed benefit is durability therefore lack that benefit in this preview; the
324 entries are not claimed equally competitive. Design SI figures and game-world
speed are distinct; gameplay uses bounded ratios against the existing race baseline.

Food cockpit geometry is adapted to the stylized seated characters, rather than
changing their proportions. Existing short-leg poses are retained; foot-to-pedal
contact is not a completed animation feature. The preview contains no Windows
package and does not alter the stable main branch or stable publication manifest.

## Reproduce

From a repository checkout: `npm ci`, `npm test`, `npm run build`, `npm run test:dist`.
After extracting source.zip, first restore separately served runtime assets with
`npm run models:fetch` and `npm run food:fetch`. `npm run food:verify` independently
checks all 324 public food payloads without private production files.

## Original workshop presentation

The garage uses an original illustrated workshop backdrop, colored tool drawers,
a cutting-mat assembly bench, paper recipe slips, and a physical-style instrument
panel. The speed dial uses the same driver-adjusted flat-road ceiling as the
numeric readout (0–240 km/h dial scale, with the needle bounded at the ends).
Comparison changes still use the real selected/candidate build. Decorative props
and the redundant dial are hidden from assistive technology. All original native
controls, status/progress, loading failure and retry handling remain available.
Small-screen layouts reflow; motion is suppressed for reduced-motion preferences.
Artwork is original SVG/CSS; no third-party game artwork is included.

## Free-mode recipes and difficulty

`src/kart-presets.ts` defines balanced, corner, straight, start/hill and stable-control
collision-practice recipes. All 324 parts are unlocked. Recipes are starting points;
every slot remains editable. There is no rarity, equipment level, random affix,
matching-theme bonus or single overall power number. The collision-practice recipe
has no special damage resistance: durability and rollover/recovery remain inactive.

A saved car is a name and six validated part IDs, independent of character. Loading
one enters clearly labelled update mode; saving updates the same record. Save as new
creates a separate copy. Car snapshots travel in validated URLs, retaining choices
through map/character changes even when storage is unavailable. The garage compares
combined acceleration, HUD-converted speed and steering, and separately labels its
vehicle-only stability estimate. Physical design estimates are never presented as
measured real-world performance.

Easy / normal / hard change NPC input timing, braking reserve, racing line, drift
choices and item decisions. The selected difficulty does not alter kart/character
statistics, equipment recipes, item strength or grant inventory. Coast player and
NPCs also share the same forward-speed integrator and gradual boost/slow caps.
NPC lane following remains an AI simplification, not a claim of identical human
steering/collision inputs. Both maps default
to normal. An explicit 32-bit seed supports reproducible gameplay; cosmetic particles
are not required to be identical. Water difficulty operates on living mounts and
character-only motion. Coast and water have different movement models.

Opponent recipes share only six theme ZIPs (15,506,709 bytes, 14.79 MiB), plus any
additional themes in the player's selection. Only selected part containers are
parsed; all 324 parts are never parsed at race boot. Character downloads remain
separate. Shared source mesh/material resources are never mutated across actors;
steering and skin instances retain independent ownership. This is a bounded resource
budget, not a verified mobile frame-rate claim.

Tests cover menu/back/setup routes, corrupt or blocked storage, recipe edits,
character-independent saved builds, deterministic skill decisions, shared tuning,
actual model selection, cancellation, retries, race lifecycle and all six driver
fits through the real PlayCanvas NullGraphicsDevice pipeline. Browser GPU rendering,
mobile memory pressure and real-device frame rate still require hardware testing.

## Landscape workshop layout

The garage uses a viewport-height cockpit at landscape widths of at least 1000 CSS pixels and heights of at least 680 CSS pixels. Six drawers, the real assembly preview, character-plus-car comparison, a six-item horizontal tray and bottom actions stay on the main screen. The tray pages through all 54 parts per slot; changing filters resets its page. Smaller or portrait windows use a flowing fallback.

Recipes and named-build editing share a native modal dialog, while detailed design estimates and explanations live in a second dialog. Escape or the visible close button dismisses each dialog and returns focus to its opener. The actual build state, preview cancellation, camera controls and race navigation remain shared with the existing garage flow. The requested common desktop sizes are layout targets; browser verification records the actual available viewport rather than claiming unperformed device coverage.

The simplified workshop uses six original SVG silhouettes above short slot labels; installed parts remain available through accessible names and tooltips. Main comparisons show current values and deltas, with full units/history in Details. The preview now renders an opaque cream/mint room, stationary turntable and procedural contact shadow directly in PlayCanvas, avoiding reliance on transparent-canvas compositing. Horizontal input rotates a centered assembly wrapper; the room and world lights stay fixed. Source module geometry and materials are unchanged. GPU pixel output still requires verification on a WebGL-capable browser; NullGraphicsDevice tests establish lifecycle, transforms, fitting and sizing only.
