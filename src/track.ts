import { Vec3 } from 'playcanvas';
import { ClosedCircuit, type CircuitOptions, type CircuitPoint } from './closed-circuit';

/** Nominal start-grid width; the rest of level 0 uses halfWidthAt(distance). */
export const HALF = 7.2;
export const MAX_SPEED = 42;
export const UP = new Vec3(0, 1, 0);
/** Historical migration baseline, retained for independent fixture verification.
 * It is intentionally not the current playable level-0 circuit. */
export const ORIGINAL_TRACK_POINTS = [
  [0, 2.4, -140], [95, 4.5, -125], [160, 7, -40],
  [135, 4.5, 50], [70, 2.6, 90], [35, 2.4, 155],
  [-70, 4, 160], [-145, 6, 100], [-155, 3.2, 0], [-110, 2.4, -85],
].map(([x, y, z]) => new Vec3(x, y, z));
/** Authored broad coastal lobes: unequal straights, shallow S transitions and
 * two gradual overlooks. No hairpins, crossing roads, jumps or blind crests. */
export const TRACK_POINTS = [
  [0, 2.4, -140], [47.3108, 3.2055, -128.5014], [115.1811, 5.15, -129.3609],
  [186.2046, 7.0945, -95.3854], [197.0093, 7.9, -26.5207],
  [145.0579, 7.0945, 27.1266], [91.0779, 5.15, 54.7989],
  [54.3705, 3.2055, 90.6775], [0, 2.4, 130], [-70.9234, 3.2055, 126.358],
  [-114.4872, 5.15, 75.7001], [-128.505, 7.0945, 21.0048],
  [-150.1907, 7.9, -26.5207], [-169.6517, 7.0945, -89.2636],
  [-138.5904, 5.15, -150.2621], [-63.8637, 3.2055, -164.182],
].map(([x, y, z]) => new Vec3(x, y, z));

export const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
export const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));
export const scaled = (p: Vec3, direction: Vec3, amount: number) => p.add(direction.clone().mulScalar(amount));
export const radians = (degrees: number) => degrees * Math.PI / 180;
export const degrees = (radians: number) => radians * 180 / Math.PI;
export class CoastCircuit extends ClosedCircuit {
  constructor(points: readonly CircuitPoint[] = TRACK_POINTS, options: CircuitOptions = {}) { super(points, options); }
}
export const circuit = new CoastCircuit();
export const LENGTH = circuit.length;
export const sample = (distance: number, lateral = 0) => circuit.sample(distance, lateral);

/** Periodic, metre-scale width transitions with zero slope at their ends. */
const WIDTH_KEYS = [[0, 7.2], [.06, 7.2], [.14, 8.2], [.27, 8.2], [.35, 7.2], [.43, 6.2], [.51, 6.2], [.60, 7.2], [.69, 8.2], [.77, 8.2], [.85, 7.2], [1, 7.2]] as const;
export function halfWidthAt(distance: number): number {
  const u = (((Number.isFinite(distance) ? distance : 0) / LENGTH) % 1 + 1) % 1;
  const index = WIDTH_KEYS.findIndex((key, i) => i > 0 && u <= key[0]);
  const a = WIDTH_KEYS[Math.max(0, index - 1)], b = WIDTH_KEYS[index < 0 ? WIDTH_KEYS.length - 1 : index];
  const t = clamp((u - a[0]) / Math.max(1e-9, b[0] - a[0]), 0, 1), smooth = t * t * (3 - 2 * t);
  return a[1] + (b[1] - a[1]) * smooth;
}
/** Same conservative curb allowance as the original 7.2m-half-width road. */
export const laneLimitAt = (distance: number) => halfWidthAt(distance) - .45;
export const shoulderAt = (distance: number) => halfWidthAt(distance) - .9;
export const COAST_TURN_SIGNS = [.10, .35, .56, .65].map(fraction => {
  const distance = fraction * LENGTH;
  return Object.freeze({distance, left: circuit.curvature(distance + 12, 22) > 0});
});
/** Forty-five existing boxes, redistributed into readable optional lines.
 * Centres offer recovery; staggered side exits reward choosing a lane early.
 * No pickup leaves the tactical AI's existing 4.2m reachable lateral range. */
export const COAST_PICKUPS = [.045, .105, .165, .235, .305, .37, .435, .50, .565, .625, .685, .755, .825, .885, .945].flatMap((fraction, group) => {
  const distance = fraction * LENGTH, side = circuit.curvature(distance + 10, 25) > 0 ? 1 : -1;
  const wide = halfWidthAt(distance) > 7.7, recovery = !wide && group % 3 === 0;
  const line = wide ? 'wide-choice' : recovery ? 'recovery' : 's-exit';
  const lanes = wide ? [0, side * 4.2, -side * 4.2] : recovery ? [0, -2.8, 2.8] : [side * 3.8, 0, -side * 3.8];
  return lanes.map((lateral, index) => Object.freeze({d: distance + index * 14, lateral, group, line}));
});
/** Coarse static-placement clearance, evaluated at build time, never per frame. */
const clearanceSamples = Array.from({length: 360}, (_, i) => ({p: sample(i / 360 * LENGTH).p, half: halfWidthAt(i / 360 * LENGTH)}));
export function isRoadsideClear(x: number, z: number, radius = 0): boolean {
  return clearanceSamples.every(({p, half}) => Math.hypot(p.x - x, p.z - z) > half + radius + 2);
}
