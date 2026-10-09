# Race timing and interruption

Both race entrypoints use `createRaceFrameClock`.

An engine frame longer than 250 ms previously opened the pause dialog. The
first correction excluded startup/countdown, but left that heuristic active
once racing. Real-entrypoint regressions reproduced an unwanted pause after
five seconds of foreground racing with an 800–1200 ms frame. A frame interval
alone cannot distinguish backgrounding from rendering, model upload or GC.

- Start, replay, restart and resume rebase the first active frame to zero.
- All subsequent active frames accept at most 250 ms of simulation time,
  substepped by the existing physics adapters. Excess wall time is discarded:
  racers do not teleport and simulation does not run an unbounded catch-up loop.
  The displayed race clock follows accepted simulation time during such stalls.
- Slow countdown frames cannot spill into active racing. Ordinary countdown
  overflow and 30/60/120 Hz timing remain intact.
- Frame duration never opens the pause dialog, including after the countdown.
  There is no arbitrary five-second, ten-second or other grace window.
- Escape, P, pause controls, blur, hidden tabs, pagehide and unexpected pointer
  lock loss still pause immediately through the existing interruption handlers.
  Returning to a visible tab does not automatically resume a paused race.
- Pointer-lock denial still falls back to dragging; it does not pause a race.

Coverage includes the real coast and water entrypoints on PlayCanvas
NullGraphicsDevice, their DOM/input adapters, startup plus five/ten-second
foreground stalls, repeated extreme intervals, restart/replay/resume,
30/60/120 Hz timing, hidden tabs, blur, Escape and mouse lock fallback/loss.
These are CPU/DOM regression checks, not browser GPU or physical-device
performance verification. No external telemetry or data collection was added.
