/** Frame duration is not evidence of focus loss: shader compilation, asset
 * upload and GC can stall a visible race at any time. Bound simulation catch-up
 * to 250 ms (substepped by each adapter), dropping excess wall time rather than
 * opening a pause dialog or teleporting racers. Only explicit user/browser
 * interruption events in race-controls pause. Rebase start/resume intervals.
 */
export function createRaceFrameClock() {
  let fresh = true;
  return {
    reset() { fresh = true; },
    sample(delta: number, active: boolean, countdown: number) {
      const dt = Number.isFinite(delta) ? Math.max(0, delta) : 0;
      if (!active) return {dt};
      if (fresh) { fresh = false; return {dt: 0}; }
      if (countdown > 0 && dt > .25) return {dt: Math.min(.25, countdown)};
      return {dt: Math.min(dt, .25)};
    },
  };
}
