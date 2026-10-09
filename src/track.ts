import { Vec3 } from 'playcanvas';
import { ClosedCircuit, type CircuitOptions, type CircuitPoint } from './closed-circuit';

/** Nominal start-grid width; the rest of the circuit uses halfWidthAt(distance). */
export const HALF = 7.2;
export const MAX_SPEED = 42;
export const UP = new Vec3(0, 1, 0);
/** Historical migration baseline, retained for independent fixture verification.
 * It is intentionally not the current playable circuit. */
export const ORIGINAL_TRACK_POINTS = [
  [0, 2.4, -140], [95, 4.5, -125], [160, 7, -40],
  [135, 4.5, 50], [70, 2.6, 90], [35, 2.4, 155],
  [-70, 4, 160], [-145, 6, 100], [-155, 3.2, 0], [-110, 2.4, -85],
].map(([x, y, z]) => new Vec3(x, y, z));
/** Original medium-complexity coast: a climbing headland, downhill chicane,
 * open lookout hairpin, cross-island esses and a double-apex harbour return.
 * The four unequal lobes are deliberately separated, with no crossing roads. */
export const TRACK_POINTS = [
  [0, 2.4, -165],
  [65.6, 2.6, -162.4],
  [129.2, 4.832, -151],
  [178.12, 8.016, -122.8],
  [199.04, 11.2, -82],
  [186.04, 12.6, -44.2],
  [149.56, 11.56, -16],
  [112.36, 9.28, 13.92],
  [95.84, 7.08, 50.72],
  [112.44, 5.32, 88.92],
  [145.68, 4.064, 126.24],
  [156.56, 3.2, 165.72],
  [129.68, 2.696, 194.88],
  [84, 2.516, 195.48],
  [38.56, 2.816, 163.8],
  [-6.48, 3.972, 123.32],
  [-54.44, 5.896, 108.84],
  [-101.48, 7.94, 119.96],
  [-146.12, 9.6, 124.36],
  [-178.6, 10.24, 102.24],
  [-182.72, 9.32, 62.6],
  [-160.96, 7.28, 21.84],
  [-143.08, 5.36, -15.96],
  [-154.4, 4.056, -53.72],
  [-177.48, 3.152, -93.48],
  [-173.96, 2.608, -133.28],
  [-134.16, 2.424, -159.72],
  [-72.12, 2.4, -166.12],
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
export const COAST_SECTIONS = Object.freeze([
  {name: 'Grid sprint', from: 0, to: .09},
  {name: 'Headland climb', from: .09, to: .24},
  {name: 'Downhill chicane', from: .24, to: .355},
  {name: 'Lookout hairpin', from: .355, to: .47},
  {name: 'Cross-island esses', from: .47, to: .64},
  {name: 'Palm bluff sweep', from: .64, to: .76},
  {name: 'Harbour double apex', from: .76, to: .94},
  {name: 'Finish sprint', from: .94, to: 1},
].map(section => Object.freeze({...section, from: section.from * LENGTH, to: section.to * LENGTH})));
export const sample = (distance: number, lateral = 0) => circuit.sample(distance, lateral);

/** Periodic, metre-scale width transitions with zero slope at their ends. */
const WIDTH_KEYS = [[0, 7.2], [.08, 7.2], [.16, 8.2], [.25, 8.2], [.32, 7.2], [.37, 8.2], [.45, 8.2], [.51, 7.2], [.59, 6.6], [.65, 7.2], [.70, 8.2], [.78, 8.2], [.84, 7.2], [.90, 6.8], [.96, 7.2], [1, 7.2]] as const;
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
export const COAST_TURN_SIGNS = [.10, .24, .335, .425, .515, .63, .73, .83].map(fraction => {
  const distance = fraction * LENGTH;
  return Object.freeze({distance, left: circuit.curvature(distance + 12, 22) > 0});
});
/** Forty-five existing boxes, redistributed into readable optional lines.
 * Centres offer recovery; staggered side exits reward choosing a lane early.
 * No pickup leaves the tactical AI's existing 4.2m reachable lateral range. */
export const COAST_PICKUPS = [.045, .105, .165, .235, .305, .37, .435, .50, .565, .625, .685, .755, .825, .885, .945].flatMap((fraction, group) => {
  const distance = fraction * LENGTH, side = circuit.curvature(distance + 10, 25) > 0 ? 1 : -1;
  const wide = halfWidthAt(distance) > 7.7, recovery = !wide && group % 3 === 0;
  const line = wide ? 'wide-choice' : recovery ? 'recovery' : 'corner-exit';
  const lanes = wide ? [0, side * 4.2, -side * 4.2] : recovery ? [0, -2.8, 2.8] : [side * 3.8, 0, -side * 3.8];
  return lanes.map((lateral, index) => Object.freeze({d: distance + index * 14, lateral, group, line}));
});
/** Coarse static-placement clearance, evaluated at build time, never per frame. */
const clearanceSamples = Array.from({length: 360}, (_, i) => ({p: sample(i / 360 * LENGTH).p, half: halfWidthAt(i / 360 * LENGTH)}));
export function isRoadsideClear(x: number, z: number, radius = 0): boolean {
  return clearanceSamples.every(({p, half}) => Math.hypot(p.x - x, p.z - z) > half + radius + 2);
}
