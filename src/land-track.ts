import {Vec3} from 'playcanvas';
import {ClosedCircuit, type CircuitPoint} from './closed-circuit';

export type LandSurface = Readonly<{kind: string; grip: number; rollingResistance: number}>;
export type LandSection = Readonly<{name: string; from: number; to: number}>;
export type LandSample = ReturnType<ClosedCircuit['sample']> & {bank: number; normal: Vec3; grade: number};
export interface LandTrack {
  readonly id: string;
  readonly label: string;
  readonly tag: string;
  readonly length: number;
  readonly circuit: ClosedCircuit;
  readonly sections: readonly LandSection[];
  readonly pickups: readonly Readonly<{d: number; lateral: number}>[];
  sample(distance: number, lateral?: number): LandSample;
  halfWidthAt(distance: number): number;
  laneLimitAt(distance: number): number;
  surfaceAt(distance: number): LandSurface;
  clearAt(x: number, z: number, radius?: number): boolean;
}
export type ProfileKey = readonly [fraction: number, value: number];
export const wrapLandDistance = (distance: number, length: number) => ((Number.isFinite(distance) ? distance : 0) % length + length) % length;
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
/** Periodic smoothstep profile. Keys include matching values at fractions 0/1. */
export function periodicValue(keys: readonly ProfileKey[], fraction: number): number {
  const u = wrapLandDistance(fraction, 1);
  const index = Math.max(1, keys.findIndex((key, i) => i > 0 && key[0] >= u));
  const a = keys[index - 1], b = keys[index];
  const t = clamp((u - a[0]) / (b[0] - a[0]), 0, 1);
  return a[1] + (b[1] - a[1]) * t * t * (3 - 2 * t);
}
export interface LandTrackDefinition {
  id: string; label: string; tag: string; points: readonly CircuitPoint[];
  widths: readonly ProfileKey[];
  /** Sections and pickup distances use lap fractions in the source definition. */
  sections: readonly LandSection[];
  pickups: readonly Readonly<{d: number; lateral: number}>[];
  surfaces?: readonly Readonly<{from: number; to: number; surface: LandSurface}>[];
  bankScale?: number;
}
/** Shared constrained-road geometry, NOT a rigidbody/free-roaming collision engine.
 * The same banked positions feed road vertices, vehicles, pickups and reset support. */
export function createLandTrack(definition: LandTrackDefinition): LandTrack {
  if (definition.widths.length < 2 || definition.widths[0][0] !== 0 || definition.widths.at(-1)![0] !== 1 || definition.widths[0][1] !== definition.widths.at(-1)![1]
    || definition.widths.some(([u, w], i, keys) => !Number.isFinite(u + w) || w < 3 || (i > 0 && u <= keys[i - 1][0]))) throw new Error('Land widths must be finite, ordered, positive and periodic');
  const circuit = new ClosedCircuit(definition.points), length = circuit.length;
  const halfWidthAt = (d: number) => periodicValue(definition.widths, d / length);
  const laneLimitAt = (d: number) => halfWidthAt(d) - .65;
  const asphalt: LandSurface = Object.freeze({kind: 'asphalt', grip: 1, rollingResistance: 1});
  const sample = (distance: number, lateral = 0): LandSample => {
    const frame = circuit.sample(distance);
    const bank = clamp(-circuit.curvature(distance - 5, 10) * (definition.bankScale ?? 5), -.16, .16);
    const baseUp = new Vec3().cross(frame.t, frame.n).normalize();
    const n = frame.n.clone().mulScalar(Math.cos(bank)).add(baseUp.mulScalar(Math.sin(bank))).normalize();
    const normal = new Vec3().cross(frame.t, n).normalize();
    const p = frame.p.add(n.clone().mulScalar(Number.isFinite(lateral) ? lateral : 0));
    return {...frame, p, n, normal, bank, grade: frame.t.y / Math.max(1e-6, Math.hypot(frame.t.x, frame.t.z))};
  };
  // Static roadside placement only; no ambiguity-sensitive nearest-XZ driving.
  const count = Math.ceil(length / 3);
  const clearance = Array.from({length: count}, (_, i) => ({p: sample(i * length / count).p, half: halfWidthAt(i * length / count)}));
  return Object.freeze({
    id: definition.id, label: definition.label, tag: definition.tag, circuit, length, sample, halfWidthAt, laneLimitAt,
    sections: Object.freeze(definition.sections.map(s => Object.freeze({...s, from: s.from * length, to: s.to * length}))),
    pickups: Object.freeze(definition.pickups.map(p => Object.freeze({...p, d: p.d * length}))),
    surfaceAt(distance: number) {
      const u = wrapLandDistance(distance, length) / length;
      return definition.surfaces?.find(s => u >= s.from && u < s.to)?.surface ?? asphalt;
    },
    clearAt(x: number, z: number, radius = 0) {
      return Number.isFinite(x + z + radius) && clearance.every(({p, half}) => Math.hypot(p.x - x, p.z - z) > half + Math.max(0, radius) + 3.5);
    },
  });
}
/** Resolve the deck by canonical track distance, even when X/Z overlaps another deck. */
export function landSupportAt(track: LandTrack, distance: number, lateral = 0) {
  const lane = clamp(Number.isFinite(lateral) ? lateral : 0, -track.laneLimitAt(distance), track.laneLimitAt(distance));
  return {...track.sample(distance, lane), distance: Number.isFinite(distance) ? distance : 0, lateral: lane, surface: track.surfaceAt(distance)};
}
/** Reset keeps the unwrapped lap coordinate and therefore the correct bridge level. */
export function resetLandSupport(track: LandTrack, safeDistance: number, clearance = .6) {
  const support = landSupportAt(track, safeDistance, 0);
  return {...support, p: support.p.clone().add(support.normal.clone().mulScalar(Math.max(0, clearance)))};
}
export type LandLapProgress = Readonly<{distance: number; nextCheckpoint: number; checkpoints: number; passedCheckpoints: number; laps: number}>;
export function createLapProgress(track: LandTrack, distance = 0, checkpointCount = 12): LandLapProgress {
  const d = Number.isFinite(distance) ? distance : 0, count = Number.isFinite(checkpointCount) ? Math.max(4, Math.floor(checkpointCount)) : 12;
  return {distance: d, nextCheckpoint: Math.floor(d / (track.length / count)) + 1, checkpoints: count, passedCheckpoints: 0, laps: 0};
}
/** Explicit physical reset/recovery: preserve earned checkpoint order. A rebase
 * beyond an unearned gate cannot grant it: the racer must return and cross it. */
export function rebaseLapProgress(state: LandLapProgress, safeDistance: number): LandLapProgress {
  return Number.isFinite(safeDistance) ? {...state, distance: safeDistance} : state;
}
/** Call using canonical UNWRAPPED distance after physical integration. Rejected
 * movement does not earn checkpoints. Bounded reversing is physically accepted
 * without credit; nextCheckpoint is monotonic and blocks repeated finish farming.
 * Bounded per-frame progress + lateral support prevent seam/reverse/teleport credit;
 * these are local gameplay checks, not an anti-cheat/server authority boundary. */
export function advanceLapProgress(track: LandTrack, state: LandLapProgress, candidate: number, dt: number, lateral = 0, maxSpeed = 85): {accepted: boolean; state: LandLapProgress; reason?: string} {
  const delta = candidate - state.distance;
  const reject = (reason: string) => ({accepted: false, state, reason});
  if (![candidate, dt, lateral, maxSpeed].every(Number.isFinite) || dt <= 0 || dt > .25 || maxSpeed <= 0) return reject('invalid-step');
  if (Math.abs(delta) > maxSpeed * dt + .03) return reject('teleport');
  if (Math.abs(lateral) > track.laneLimitAt(candidate) + .01) return {accepted: false, state: {...state, distance: candidate}, reason: 'off-road'};
  if (delta <= 0) return {accepted: true, state: {...state, distance: candidate}};
  const spacing = track.length / state.checkpoints;
  let nextCheckpoint = state.nextCheckpoint, laps = state.laps, passedCheckpoints = state.passedCheckpoints;
  while (state.distance < nextCheckpoint * spacing && candidate >= nextCheckpoint * spacing) {
    passedCheckpoints++;
    if (nextCheckpoint > 0 && nextCheckpoint % state.checkpoints === 0 && passedCheckpoints >= state.checkpoints) { laps++; passedCheckpoints = 0; }
    nextCheckpoint++;
  }
  return {accepted: true, state: {...state, distance: candidate, nextCheckpoint, passedCheckpoints, laps}};
}
