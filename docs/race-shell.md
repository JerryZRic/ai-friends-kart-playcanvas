# Shared race shell

The race shell is the common presentation layer for Coast and Waterpark. An
entrypoint supplies map identity, track sampling and snapshots from its own
simulation. It must not implement a second HUD, input binding or results screen.

## Ownership

`race-hud.ts` mounts the shared DOM once before scene initialization. Both HTML
pages import `race-ui.css`. `race-loading-ui.ts` mounts the same sparse loading
overlay into both pages; legacy adapter IDs remain inert and hidden. The visible
finish overlay holds one centered standings table with replay/map/menu controls.

`createRaceShell(document, canvas, options)` captures the HUD elements once and
owns presentation changes. `options` contains `map`, `driver`, and optionally a
track `{length, sample, samples}`. `sample(distance)` returns a point as
`{p: {x, z}}`. The shell samples the route once, fits it into the same minimap
canvas, and renders per-frame racer positions on that route.

The shell never advances elapsed race time, countdown, physics, checkpoints,
items or NPC decisions. It has no animation/timer loop. Its internal phase only
protects display transitions from repeated pause/resume calls and stale
countdown rendering. Simulation state remains authoritative in the entrypoint.

## Adapter calls

- `updateHUD({rank, lap, elapsed, speed, held, ...})`: supply signed world speed
  in metres/second. Optional `laps` and `racerCount` default to 3 and 6. `charge`,
  `boost`, `shield`, `slideLabel` and `canUseItem` control common feedback
- `start(countdown)`: hide the menu/results, clear old feedback and focus the
  canvas after the adapter has reset its simulation
- `setPaused(true, countdown)` / `setPaused(false, countdown)`: render the
  common pause dialog and restore canvas focus. The adapter first changes its
  own state, clears input and releases pointer lock
- `renderCountdown(seconds)`: update only during an active race. Repeated calls
  cannot overwrite a pause dialog or final result
- `finish({rank, elapsed, selectedDriverId, racers, trackLength, ...})`: racers
  are already ordered by the adapter, with `{id, label?, total, finishedAt}`.
  Unfinished racers have `finishedAt: null`; their distance becomes progress,
  never a fabricated time. Water's `finishTime` is mapped to `finishedAt`
- `showMenu()`: return presentation to loading/selection without inventing or
  resetting any simulation state
- `updateNavigation(map, driver)`: update shared or legacy selection anchors.
  `raceNavigation(map, driver)` also supplies the same validated URLs for
  programmatic navigation
- `drawMinimap(racers)`: supply `{total, color?, player?}`. The player is drawn
  last so grouped starting positions cannot obscure them
- `toast(message, seconds)` and `tick(delta)`: use the map's existing frame loop
  to expire messages; this UI delta does not affect countdown or elapsed time
- `toggleSound()`, `tone(frequency, duration)` and `muted`: default-muted tone
  audio is lazy and fails harmlessly when the browser denies it. Preference key
  `ai-friends-kart.sound.v1` is separate from the game settings schema
- `dispose()`: closes optional audio, clears transient feedback and makes later
  renderer calls harmless

State changes belong in the adapter; all display changes listed above belong in
the shell. Map effects such as water wakes and kart drift sparks remain in their
scene renderers. `race-controls.ts` owns browser event bindings and
`race-camera.ts` owns chase geometry, independently of the shell.

## Verification

`tests/race-shell.test.ts` exercises both map identities with DOM stubs, including
duplicate pause/resume, restart after results, missing optional elements,
invalid display numbers, portrait caching, minimap fitting and blocked audio or
storage. `tests/shared-race-architecture.test.ts` checks that both real entries
consume the same modules and do not reintroduce separate keyboard, inventory
portrait or audio implementations.

These tests supplement `gameplay.test.ts` and `waterpark-play.test.ts`, which
execute the real entries with PlayCanvas's NullGraphicsDevice. None of these
checks establishes visual quality, pointer-lock behavior in an actual browser,
GPU rendering correctness, or frame rate on the user's hardware. Those require
browser/device testing of the produced preview.

## Shared loading and starting-line return

`race-loading-camera.ts` follows each map's actual loop at 22 world metres per
second, 46 metres above the sampled road/water. It interpolates camera position,
look target and field of view to the starting-line chase camera in 1.15 seconds
using a smooth quintic curve. Bounded cinematic steps cannot skip the transition
on a stalled frame. Hidden/unfocused pages freeze it. Only after it arrives do
adapters clear held input, reset the frame clock and begin the countdown.
Replay/restart retain the immediate clean reset after the first entry.

The loading overlay contains map identity, six-racer/three-lap parameters,
keyboard diagram and download percentage with one short stage line. Percentage
measures actual received/expected bytes for the current resource phase, not
model readiness. Unknown sizes remain indeterminate; 100% download may still
need parsing. Download errors retain successful assets and show retry/exit.
No retired low-poly racer is instantiated or displayed. Missing actual models
remain absent and block race readiness rather than becoming substitutes.

`renderRaceResults` receives all authoritative standings in their original
order, escapes labels, highlights the player and distinguishes finished times
from unfinished progress. It never predicts finish times.

CPU integration covers partial failure/retry, hidden and focused transitions,
input/countdown isolation, replay, pause and disposal. DOM/CSS layout inspection
is separate from GPU scene rendering; cloud WebGL is not supported.
