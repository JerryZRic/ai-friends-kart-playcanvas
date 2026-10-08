/** Coast uses signed, unwrapped arc length on a constrained circuit. Reversing
 * reduces progress; crossing the visual start line cannot grant a lap. */
export const COAST_LAPS = 3;
export function coastLap(distance: number, length: number) {
  return Math.max(1, Math.min(COAST_LAPS, Math.floor(distance / length) + 1));
}
export function crossingTime(previous: number, current: number, finish: number, elapsed: number, dt: number): number | null {
  if (current <= previous || previous >= finish || current < finish) return null;
  return elapsed - dt + dt * (finish - previous) / (current - previous);
}
export interface CoastStanding { id: string; total: number; finishedAt: number | null }
export function coastStandings(racers: CoastStanding[]) {
  return [...racers].sort((a,b) => {
    if (a.finishedAt !== null || b.finishedAt !== null) return (a.finishedAt ?? Infinity) - (b.finishedAt ?? Infinity) || a.id.localeCompare(b.id);
    return b.total - a.total || a.id.localeCompare(b.id);
  });
}
