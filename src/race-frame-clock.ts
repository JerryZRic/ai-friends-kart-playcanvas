/** Engine deltas straddle start/resume and include model upload/shader warm-up.
 * Rebase at those boundaries. During the pre-race countdown, bound a slow
 * visible frame instead of treating preparation as a suspended race. Actual
 * blur/hidden/pagehide/Escape/lock loss still pause immediately via controls.
 */
export function createRaceFrameClock() {
  let fresh = true;
  return {
    reset() { fresh = true; },
    sample(delta: number, active: boolean, countdown: number) {
      const dt = Number.isFinite(delta) ? Math.max(0, delta) : 0;
      if (!active) return {dt, interrupted: false};
      if (fresh) { fresh = false; return {dt: 0, interrupted: false}; }
      if (countdown > 0) return {dt: dt > .25 ? Math.min(.25, countdown) : dt, interrupted: false};
      return dt > .25 ? {dt: 0, interrupted: true} : {dt, interrupted: false};
    },
  };
}
