# Modular food kart garage · dev preview

Open `garage.html` from the main-menu workshop link or the coast character picker.
The existing direct-race button still works. Waterpark continues to use living
water mounts, without electric kart statistics or model substitutions.

## Implemented

- Six independent slots: body, chassis, motor, final drive, battery and wheels
- 54 original food themes / 324 exact catalog part identities
- Theme and text filters, actual source-render thumbnails, complete-theme fitting
- Real six-container PlayCanvas preview, orbit/zoom and keyboard camera controls
- Current/candidate stat comparisons, balanced default and six example mixes
- Browser-local active build and named builds; strict validation and graceful
  unavailable/corrupted-storage handling
- The garage race URL carries a validated build snapshot, so blocked storage does
  not silently discard a selection on the next page
- Actual player coast vehicle geometry and handling use the selected six parts;
  opponents use the baseline balanced mixed build
- Existing six character multipliers remain authoritative and unchanged
- Grip-dependent corner ceilings and gear/mass-dependent grade acceleration apply
  to both player and opponents through the same centerline sampling
- No matching-theme performance bonus

## Loading and resource ownership

The collection is never preloaded at boot. The garage downloads only the theme bundles needed for selected
parts; a race prepares the selected player build and the default opponent build,
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
