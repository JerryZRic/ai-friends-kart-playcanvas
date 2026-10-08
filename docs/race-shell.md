# Shared race shell

The race shell is the common presentation layer for Coast and Waterpark. An
entrypoint supplies map identity, track sampling and snapshots from its own
simulation. It must not implement a second HUD, input binding or results screen.

## Ownership

`race-hud.ts` mounts the shared DOM once before scene initialization. Both HTML
pages import `race-ui.css`; their remaining markup is loading/driver-selection
content inside the same overlay contract.

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
