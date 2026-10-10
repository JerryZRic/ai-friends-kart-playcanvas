/** Slow showroom motion uses wall-clock frame deltas, never loading/hidden time. */
export const GARAGE_SPIN_DEGREES_PER_SECOND = 8;
export const GARAGE_INTERACTION_IDLE_MS = 3500;
export function garageSpinDelta(now: number, previous: number | null, enabled: boolean, interacting: boolean, resumeAt: number) {
  if (!enabled || interacting || previous === null || !Number.isFinite(now) || !Number.isFinite(previous) || now < resumeAt) return 0;
  return Math.min(.05, Math.max(0, (now - Math.max(previous, resumeAt)) / 1000)) * GARAGE_SPIN_DEGREES_PER_SECOND;
}
/** Pointer distances are expressed in the fixed design coordinate space. */
export function garagePointerDelta(delta: number, renderedWidth: number, logicalWidth: number) {
  if (![delta, renderedWidth, logicalWidth].every(Number.isFinite) || renderedWidth <= 0 || logicalWidth <= 0) return 0;
  return delta * logicalWidth / renderedWidth;
}
