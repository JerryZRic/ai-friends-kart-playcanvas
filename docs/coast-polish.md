# Coast playtest: turn rhythm and readable decisions

This dev-only iteration keeps the existing coast geometry, player handling and controls. It does not change the waterpark simulation, add maps/assets/music, promote main or package Windows.

## Changes

- **Rival corner rhythm:** coast NPCs look at two overlapping 22 m tangent windows, including a speed-dependent approach of at most 16 m. Stronger turns reduce their ordinary target pace by at most 14%. The existing acceleration/braking function approaches that target; existing boost and slowdown multipliers still apply. Geometry is sampled at the existing AI decision cadence, not on every rendered frame. No player position, rank or catch-up multiplier determines this pace.
- **Truthful drift feedback:** the coast meter fills at its actual 1.6-second charge cap. It turns amber and offers release only above the existing strict 0.6-second threshold. The label shows the corresponding boost duration; full charge grants the unchanged 2.4 seconds. Charging remains visible even while another effect is active. When not charging, active boost/shield/slow timers are shown together.
- **Item decisions before spending:** held pulse help identifies its current nearest target and warns if that target has a shield. No target shows the existing 1.9-second boost fallback. The preview uses the same target resolver as firing and excludes finished rivals. Boost/shield help gives their unchanged durations. Preview text never consumes an item or alters a target.

## Measurements

Real-course geometry sampled at 1 m intervals with a 40 m/s look-ahead:

| Section | Mean ordinary target pace | Lowest target pace |
| --- | ---: | ---: |
| Grid sprint | 100.0% | 100.0% |
| Headland climb | 96.7% | 88.7% |
| Downhill chicane | 95.8% | 86.2% |
| Lookout hairpin | 92.8% | 86.0% |
| Cross-island esses | 98.4% | 90.7% |
| Palm bluff sweep | 93.5% | 86.2% |
| Harbour double apex | 95.5% | 86.2% |
| Finish sprint | 100.0% | 100.0% |

A deterministic CPU reference (60 Hz, phase-0 NPC target, three laps, starting at rest; **no items, traffic or collisions**) changes lap totals as follows. These are isolated pacing measurements, not predictions of race difficulty or player finish times.

| Profile | Prior target, seconds | Corner-aware target, seconds |
| --- | ---: | ---: |
| WHALE | 119.31 | 123.94 |
| GEMINI | 110.07 | 114.40 |
| GPT | 109.97 | 114.34 |
| CLAUDE | 114.40 | 118.88 |
| GROK | 102.04 | 106.14 |
| GLM | 105.90 | 110.11 |

## Checks and trial scope

Pure tests cover exact drift boundaries/cap, target resolution and shield/fallback behavior, turn symmetry, chicane look-ahead, bounds, lap seam and acceleration recovery for all six profiles. Real game-module tests use PlayCanvas NullGraphicsDevice with a mocked DOM: they check the actual NPC update at the hairpin/sprint, HUD changes, pause/reset, finished-target exclusion and three-lap completion for all profiles. Dynamic pickup scenarios have independent random seeds and monotonic test-only entity IDs, so previous scenarios' different race timing cannot change their fixture sequence. Existing pickup safety rules remain untouched.

The shared HUD additions are optional map-provided text/state fields. Water omits them and keeps its previous default text, scale and appearance; a regression test checks that absent overrides reset to those defaults.

Cloud checks do not establish WebGL visuals, physical input feel or whether the new pace is fun. For a human trial in `/dev/`, select the coast and try:

1. Follow a rival through the lookout hairpin and onto a sprint. Check that lifting/recovery creates an overtaking opportunity without making the pack feel too slow.
2. Hold Shift plus steering until the meter becomes amber, then release. Compare a brief charge with full charge and verify the cue feels timely.
3. Hold a pulse while approaching a shielded rival, then wait for the shield to expire. Check whether the item help makes the choice clearer; try the no-target fallback on an empty straight.

Feedback on those three points should decide the next tuning pass before adding content.
