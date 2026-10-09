import { resetPickup } from './item-pickups';
import type { RacingPickup } from './npc-tactics';

/** These are extra opportunities, not a replacement for the authored pickup lines. */
export const DYNAMIC_PICKUP_CAPACITY = 4;
export const DYNAMIC_PICKUP_POOL_SIZE = DYNAMIC_PICKUP_CAPACITY;
export const DYNAMIC_PICKUP_RULES = Object.freeze({
  initialDelay: 4, interval: 3.8, intervalJitter: 1.2,
  lifetime: 12, reuseDelay: 8, attempts: 8,
  reactionSeconds: 1.4, clearance: 8, minimumSpeed: 6,
  minimumAhead: 24, maximumAhead: 125, aheadJitter: 34,
  targetProgress: 80, rankBias: 2,
  pickupGap: 13, pickupLaneGap: 2.8, worldPickupGap: 5,
  dynamicGap: 27, densityRadius: 42, maximumNearby: 4,
  visibilityStep: 6, sightCorridorMargin: 2,
});

type Point = Readonly<{ x: number; y: number; z: number }>;
export interface DynamicPickupTrack {
  length: number;
  /** Distances are arc length, including around the lap seam. */
  sample(distance: number, lateral?: number): { p: Point; t: Point };
  /** Safe pickup-centre lane limit, after allowing for the box's half-width. */
  laneLimit?(distance: number): number;
}
export interface DynamicPickupRacer {
  id: string; total: number; lateral: number;
  /** Actual signed world travel speed, after boosts, slowing and reverse. */
  travelSpeed: number;
  /** Upper bounds for attainable speed and acceleration over the reaction window.
   * Include character tuning and any available boost in these bounds. */
  maxSpeed: number; acceleration: number;
  /** Optional nonnegative bound for an immediate slow-expiry/boost speed jump.
   * Adapters can supply unslowed, maximally boosted current base speed. */
  reactionSpeed?: number;
  held?: unknown; finished?: boolean; finishDistance?: number;
}
export interface DynamicPickupTick {
  dt: number; active: boolean;
  racers: readonly DynamicPickupRacer[];
  /** Include authored locations even while cooling; they may reappear soon. */
  staticBoxes?: readonly Pick<RacingPickup, 'd' | 'lateral'>[];
}
export interface DynamicPickupSlot {
  readonly box: RacingPickup;
  active: boolean; lifetime: number; reuseIn: number; targetId: string | null;
}
export type DynamicPickupOptions = Partial<{ [K in keyof typeof DYNAMIC_PICKUP_RULES]: number }> & { rng?: () => number };
export interface DynamicPickupDirector {
  readonly slots: readonly DynamicPickupSlot[];
  /** Returns the pooled boxes whose positions changed. Place their meshes before
   * the next render. Collect all boxes normally, but advance/reset only STATIC
   * pickups: this director exclusively owns dynamic respawn and expiry. */
  tick(frame: DynamicPickupTick): RacingPickup[];
  reset(): void;
  /** Finish is latched: later active ticks cannot restart spawning until reset. */
  finish(): void;
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const wrap = (n: number, length: number) => ((n % length) + length) % length;
const nearby = (a: number, b: number, length: number) => wrap(b - a + length / 2, length) - length / 2;
const finitePoint = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y + a.z * b.z;
const minus = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

/** Integrates acceleration to the attainable cap, rather than multiplying a
 * stale base speed by a fixed lead time. Exported for adapter/physics tests. */
export function pickupReactionDistance(speed: number, maxSpeed: number, acceleration: number, seconds: number): number {
  if (![speed, maxSpeed, acceleration, seconds].every(Number.isFinite)) return Infinity;
  const v = Math.max(0, Math.abs(speed)), cap = Math.max(v, maxSpeed), a = Math.max(0, acceleration), t = Math.max(0, seconds);
  if (a === 0) return v * t;
  const accelerating = Math.min(t, (cap - v) / a);
  return v * accelerating + .5 * a * accelerating ** 2 + cap * (t - accelerating);
}

/** Pure, engine-independent director. The finite caller-owned mesh pool is never
 * expanded; target choice and item display rolls share an injectable RNG. */
export function createDynamicPickupDirector(pool: readonly RacingPickup[], track: DynamicPickupTrack, options: DynamicPickupOptions = {}): DynamicPickupDirector {
  if (!Number.isFinite(track.length) || track.length <= 0) throw new RangeError('Dynamic pickups require a finite positive track length');
  if (new Set(pool).size !== pool.length) throw new RangeError('Dynamic pickup pool entries must be distinct');
  const { rng = Math.random, ...overrides } = options, rules = { ...DYNAMIC_PICKUP_RULES, ...overrides };
  for (const [key, value] of Object.entries(rules)) if (!Number.isFinite(value) || value < 0) throw new RangeError(`Invalid dynamic pickup option: ${key}`);
  if (rules.visibilityStep <= 0 || rules.maximumAhead < rules.minimumAhead) throw new RangeError('Invalid dynamic pickup sight range');
  const random = () => { const value = rng(); return Number.isFinite(value) ? clamp(value, 0, 1 - Number.EPSILON) : .5; };
  const slots: DynamicPickupSlot[] = pool.map(box => ({ box, active: false, lifetime: 0, reuseIn: 0, targetId: null }));
  const pooled = new Set(pool);
  // High-water progress prevents reversing over the same patch to solicit boxes.
  const progress = new Map<string, { high: number; offered: number }>();
  let spawnIn = rules.initialDelay, finished = false;
  const hide = (slot: DynamicPickupSlot, reuse = 0) => {
    slot.active = false; slot.lifetime = 0; slot.reuseIn = reuse; slot.targetId = null;
    slot.box.mesh.enabled = false;
    // Infinity also makes an accidental generic advancePickup harmless while idle.
    slot.box.cool = Infinity;
  };
  const reset = () => { slots.forEach(slot => hide(slot)); progress.clear(); spawnIn = rules.initialDelay; finished = false; };
  const laneLimit = (d: number) => Math.max(0, Math.min(5.2, track.laneLimit?.(d) ?? 5.2));
  const reach = (racer: DynamicPickupRacer) => {
    // An available boost can raise forward speed immediately; reverse never gets
    // that multiplier. maxSpeed already includes the largest attainable boost.
    const fallback = racer.travelSpeed > 0 ? Math.min(racer.maxSpeed, racer.travelSpeed * 1.34) : Math.abs(racer.travelSpeed);
    const immediate = Math.max(Math.abs(racer.travelSpeed), racer.reactionSpeed ?? fallback);
    return pickupReactionDistance(immediate, racer.maxSpeed, racer.acceleration, rules.reactionSeconds);
  };

  function visible(target: DynamicPickupRacer, ahead: number, d: number, lateral: number): boolean {
    const start = track.sample(target.total, target.lateral), end = track.sample(d, lateral);
    if (![start.p, start.t, end.p, end.t].every(finitePoint)) return false;
    const chord = minus(end.p, start.p), chordLength = Math.hypot(chord.x, chord.y, chord.z);
    if (chordLength < ahead * .72 || chordLength <= 1e-6) return false;
    const tangentLength = Math.hypot(start.t.x, start.t.y, start.t.z);
    if (tangentLength <= 1e-6 || dot(start.t, chord) / (tangentLength * chordLength) < .55) return false;
    // A positive endpoint dot alone accepts hairpins and folded routes. Inspect
    // the whole arc: no backwards-facing segments and no bend out of sight around
    // a narrow road/canal bank. This is geometry visibility, not scenery raycasting.
    const steps = Math.max(2, Math.ceil(ahead / rules.visibilityStep));
    for (let i = 1; i <= steps; i++) {
      const u = i / steps, at = target.total + ahead * u;
      const point = track.sample(at, target.lateral + (lateral - target.lateral) * u);
      if (![point.p, point.t].every(finitePoint)) return false;
      const tangentMagnitude = Math.hypot(point.t.x, point.t.y, point.t.z);
      if (tangentMagnitude <= 1e-6 || dot(point.t, chord) / (tangentMagnitude * chordLength) < .2) return false;
      const offset = minus(point.p, start.p), projection = clamp(dot(offset, chord) / chordLength ** 2, 0, 1);
      const closest = { x: start.p.x + chord.x * projection, y: start.p.y + chord.y * projection, z: start.p.z + chord.z * projection };
      if (distance(point.p, closest) > laneLimit(at) + rules.sightCorridorMargin) return false;
    }
    return true;
  }

  function safeFromRacers(d: number, lateral: number, racers: readonly DynamicPickupRacer[]): boolean {
    const point = track.sample(d, lateral).p;
    if (!finitePoint(point)) return false;
    for (const racer of racers) {
      // Every racer blocks an immediate spawn, including leaders, lapped racers,
      // stationary racers, racers with an item and those travelling in reverse.
      const gap = nearby(racer.total, d, track.length), window = reach(racer) + rules.clearance;
      if (Math.abs(gap) < rules.clearance) return false;
      if (racer.travelSpeed > 0 && wrap(d - racer.total, track.length) < window) return false;
      if (racer.travelSpeed < 0 && wrap(racer.total - d, track.length) < window) return false;
      if (racer.travelSpeed === 0 && Math.abs(gap) < window) return false;
      // Near a stop, a racer can brake and change direction within this same
      // reaction window. Protect that reachable distance on the opposite side.
      const oppositeTime = racer.acceleration > 0 ? Math.max(0, rules.reactionSeconds - Math.abs(racer.travelSpeed) / racer.acceleration) : 0;
      const oppositeWindow = pickupReactionDistance(0, racer.maxSpeed, racer.acceleration, oppositeTime) + rules.clearance;
      if (racer.travelSpeed > 0 && wrap(racer.total - d, track.length) < oppositeWindow) return false;
      if (racer.travelSpeed < 0 && wrap(d - racer.total, track.length) < oppositeWindow) return false;
      const racerPoint = track.sample(racer.total, racer.lateral).p;
      if (!finitePoint(racerPoint) || distance(point, racerPoint) < rules.clearance) return false;
    }
    return true;
  }

  function uncrowded(d: number, lateral: number, authored: readonly Pick<RacingPickup, 'd' | 'lateral'>[]): boolean {
    let neighbors = 0;
    const point = track.sample(d, lateral).p;
    const existing = [...authored.filter(box => !pooled.has(box as RacingPickup)), ...slots.filter(slot => slot.active).map(slot => slot.box)];
    for (const box of existing) {
      if (!Number.isFinite(box.d) || !Number.isFinite(box.lateral)) return false;
      const gap = Math.abs(nearby(d, box.d, track.length));
      if (gap < rules.densityRadius && ++neighbors >= rules.maximumNearby) return false;
      if (gap < rules.pickupGap && Math.abs(box.lateral - lateral) < rules.pickupLaneGap) return false;
      if (pooled.has(box as RacingPickup) && gap < rules.dynamicGap) return false;
      const other = track.sample(box.d, box.lateral).p;
      if (!finitePoint(other) || distance(point, other) < rules.worldPickupGap) return false;
    }
    return true;
  }

  function tick(frame: DynamicPickupTick): RacingPickup[] {
    const moved: RacingPickup[] = [];
    if (finished || !frame.active || !Number.isFinite(frame.dt) || frame.dt <= 0 || frame.dt > 10) return moved;
    for (const slot of slots) {
      slot.reuseIn = Math.max(0, slot.reuseIn - frame.dt);
      if (!slot.active) continue;
      slot.lifetime = Math.max(0, slot.lifetime - frame.dt);
      if (slot.box.cool > 0 || !slot.box.mesh.enabled || slot.lifetime <= 0) hide(slot, rules.reuseDelay);
    }
    spawnIn = Math.max(0, spawnIn - frame.dt);
    const racers = frame.racers.filter(r => [r.total, r.lateral, r.travelSpeed, r.maxSpeed, r.acceleration].every(Number.isFinite)
      && r.maxSpeed >= 0 && r.acceleration >= 0
      && (r.reactionSpeed === undefined || Number.isFinite(r.reactionSpeed) && r.reactionSpeed >= 0)
      && (r.finishDistance === undefined || Number.isFinite(r.finishDistance)));
    // A malformed physical snapshot cannot safely be omitted from collision checks.
    if (racers.length !== frame.racers.length || new Set(racers.map(r => r.id)).size !== racers.length) return moved;
    const ids = new Set(racers.map(r => r.id));
    for (const id of progress.keys()) if (!ids.has(id)) progress.delete(id);
    for (const racer of racers) {
      const prior = progress.get(racer.id);
      if (prior) prior.high = Math.max(prior.high, racer.total);
      else progress.set(racer.id, { high: racer.total, offered: racer.total - rules.targetProgress });
    }
    if (spawnIn > 0) return moved;
    // Do not retry every simulation frame when traffic or curvature rejects a
    // candidate. One bounded decision per interval, and at most one new box.
    spawnIn = rules.interval + random() * rules.intervalJitter;
    const slot = slots.find(s => !s.active && s.reuseIn <= 0);
    if (!slot) return moved;
    const ranked = [...racers].sort((a, b) => Number(!!b.finished) - Number(!!a.finished) || b.total - a.total || a.id.localeCompare(b.id));
    const eligible = ranked.map((racer, rank) => ({ racer, weight: 1 + rules.rankBias * (rank / Math.max(1, ranked.length - 1)) ** 2 }))
      .filter(({ racer }) => !racer.finished && !racer.held && racer.travelSpeed > 0 && racer.travelSpeed >= rules.minimumSpeed && racer.maxSpeed >= 0 && racer.acceleration >= 0
        && racer.total >= progress.get(racer.id)!.high - 1
        && progress.get(racer.id)!.high - progress.get(racer.id)!.offered >= rules.targetProgress);
    if (!eligible.length) return moved;
    const sum = eligible.reduce((n, r) => n + r.weight, 0);
    let roll = random() * sum;
    const target = eligible.find(({ weight }) => (roll -= weight) < 0)?.racer ?? eligible[eligible.length - 1].racer;
    // Keep this weighted choice for all position attempts. Rerolling the target
    // after a safety rejection systematically favours easy, empty road in front
    // of the leader over traffic around trailing racers.
    for (let attempt = 0; attempt < Math.floor(rules.attempts); attempt++) {
      const minimum = Math.max(rules.minimumAhead, reach(target) + rules.clearance), maximum = Math.min(rules.maximumAhead, track.length / 2);
      if (minimum + 1 > maximum) continue;
      const ahead = minimum + 1 + random() * Math.min(rules.aheadJitter, maximum - minimum - 1);
      if (target.finishDistance !== undefined && target.total + ahead >= target.finishDistance) continue;
      const d = wrap(target.total + ahead, track.length), limit = laneLimit(d);
      if (!Number.isFinite(limit)) continue;
      // Fair, reachable choices: favour the target's current local corridor, but
      // never pin the item to their exact line or secretly put it in inventory.
      const lateral = clamp(target.lateral + (random() * 2 - 1) * 3.6, -limit, limit);
      if (!visible(target, ahead, d, lateral) || !safeFromRacers(d, lateral, racers) || !uncrowded(d, lateral, frame.staticBoxes ?? [])) continue;
      slot.box.d = d; slot.box.lateral = lateral;
      resetPickup(slot.box, random); // Same display/reward distribution at every rank.
      slot.active = true; slot.lifetime = rules.lifetime; slot.targetId = target.id;
      progress.get(target.id)!.offered = progress.get(target.id)!.high;
      moved.push(slot.box);
      break;
    }
    return moved;
  }
  reset();
  return { slots, tick, reset, finish: () => { reset(); finished = true; } };
}
