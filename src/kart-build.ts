import catalogData from './kart-catalog.json';
import { characterTuning } from './character-profiles';

/** Fresh-vehicle experiment. No currency, wear, charge consumption or theme bonuses. */
export const KART_SLOTS = Object.freeze(['body', 'chassis', 'motor', 'transmission', 'battery', 'wheels'] as const);
export type KartSlot = typeof KART_SLOTS[number];
export type KartBuild = Record<KartSlot, string>;
export type KartPart = Readonly<{
  id: string; partId: string; kitId: string; themeId: string; kitNumber: number;
  themeName: string; name: string; slot: KartSlot; moduleId: string; assetFilename: string;
  archetypeId: number; archetypeLabel: string; physicalDesign: Readonly<Record<string, number>>;
}>;
export type KartMultipliers = Readonly<{acceleration: number; speed: number; handling: number}>;
export type KartBuildStats = Readonly<{
  massKg: number; launchAcceleration: number; accelerationIndex: number; topSpeedKph: number;
  zeroTo50Seconds: number | null; lateralGripG: number; rollThresholdG: number;
  cruisePowerKw: number; cruiseMinutes: number; batteryKwh: number; drivePowerKw: number;
  recoverySeconds: number; wheelRpmCapKph: number; accelerationMultiplier: number;
  speedMultiplier: number; handlingMultiplier: number; multipliers: KartMultipliers;
}>;
export type NamedKartBuild = {id: string; name: string; build: KartBuild};
export type StarterKartBuild = Readonly<NamedKartBuild & {description: string}>;
export type GarageState = {version: 1; activeBuild: KartBuild; namedBuilds: NamedKartBuild[]};
export type GarageStorage = Pick<Storage, 'getItem' | 'setItem'>;
export const GARAGE_STORAGE_KEY = 'ai-friends-kart:modular-garage:v1';
export const MAX_NAMED_BUILDS = 24;
export const MAX_BUILD_NAME_LENGTH = 48;
const MAX_STORAGE_LENGTH = 48_000;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const round = (value: number, digits: number) => Number(value.toFixed(digits));
const finite = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const plain = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const exactKeys = (value: Record<string, unknown>, expected: readonly string[]) =>
  Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));

export const catalog: readonly KartPart[] = Object.freeze(catalogData.parts.map(part =>
  Object.freeze({...part, slot: part.slot as KartSlot, physicalDesign: Object.freeze({...part.physicalDesign})})));
export const parts = catalog;
const partIndex = new Map(catalog.map(part => [part.id, part]));
export const partsBySlot = Object.freeze(Object.fromEntries(KART_SLOTS.map(slot =>
  [slot, Object.freeze(catalog.filter(part => part.slot === slot))])) as Record<KartSlot, readonly KartPart[]>);
export const SLOT_LABELS = Object.freeze({body: '车身', chassis: '底盘', motor: '电机', transmission: '终传', battery: '电池', wheels: '轮胎'});
export const themes = Object.freeze(partsBySlot.body.map(part => Object.freeze({id: part.kitId, name: part.themeName, number: part.kitNumber})));
export function getPart(id: unknown): KartPart | undefined { return typeof id === 'string' ? partIndex.get(id) : undefined; }

/** Six different themes with the exact reference aggregate mass and performance.
 * A first-time player therefore keeps the existing six-character tuning. */
export const defaultBuild: Readonly<KartBuild> = Object.freeze({
  body: 'kit028::01_BodyShell', chassis: 'kit023::02_ChassisSuspension', motor: 'kit033::04_Motor',
  transmission: 'kit025::05_FinalDrive', battery: 'kit019::06_Battery', wheels: 'kit031::03_WheelsTires',
});
export const starterBuilds: readonly StarterKartBuild[] = Object.freeze(catalogData.starterBuilds.map(entry =>
  Object.freeze({...entry, build: Object.freeze({...entry.build})})));

/** Storage validation is strict: exactly one authentic part for every slot. */
export function validateBuild(value: unknown): value is KartBuild {
  return plain(value) && exactKeys(value, KART_SLOTS) && KART_SLOTS.every(slot => getPart(value[slot])?.slot === slot);
}
/** Interactive edits may salvage valid slots; persistence never silently salvages a broken build. */
export function resolveBuild(value: unknown): KartBuild {
  return Object.fromEntries(KART_SLOTS.map(slot => {
    const id = plain(value) && Object.hasOwn(value, slot) ? value[slot] : undefined;
    return [slot, getPart(id)?.slot === slot ? id : defaultBuild[slot]];
  })) as KartBuild;
}
export function buildParts(build: unknown): Readonly<Record<KartSlot, KartPart>> {
  const valid = resolveBuild(build);
  return Object.freeze(Object.fromEntries(KART_SLOTS.map(slot => [slot, partIndex.get(valid[slot])!]))) as Record<KartSlot, KartPart>;
}

type PhysicalParts = Record<KartSlot, Readonly<Record<string, number>>>;
function mechanics(selected: PhysicalParts) {
  const {body, chassis, motor, transmission, battery, wheels} = selected;
  const mass = 70 + KART_SLOTS.reduce((total, slot) => total + selected[slot].mass_kg, 0);
  const eta = motor.efficiency * transmission.efficiency;
  const power = Math.min(motor.power_kw, battery.output_kw) * 1000 * eta;
  const rpmSpeed = motor.max_rpm * 2 * Math.PI / 60 * .435 / transmission.final_drive_ratio;
  const resistance = (speed: number, grade = 0) => {
    const slope = Math.atan(grade);
    return .5 * 1.225 * body.drag_area_m2 * speed * speed +
      wheels.rolling_resistance * mass * 9.81 * Math.cos(slope) + mass * 9.81 * Math.sin(slope);
  };
  const force = (speed: number) => Math.min(motor.torque_nm * transmission.final_drive_ratio * transmission.efficiency / .435,
    power / Math.max(speed, 2), wheels.grip_coefficient * mass * 9.81);
  const acceleration = (speed: number, grade = 0) => (force(speed) - resistance(speed, grade)) / mass;
  return {body, chassis, motor, transmission, battery, wheels, mass, eta, power, rpmSpeed, resistance, force, acceleration};
}
function derive(selected: PhysicalParts) {
  const m = mechanics(selected);
  let lo = 0, hi = m.rpmSpeed;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (m.force(mid) > m.resistance(mid)) lo = mid; else hi = mid;
  }
  let speed = 0, steps = 0;
  while (speed < 50 / 3.6 && steps < 3000) { speed += Math.max(0, m.acceleration(speed)) * .01; steps++; }
  const cruisePower = m.resistance(50 / 3.6) * (50 / 3.6) / m.eta / 1000 + .15;
  return {
    massKg: round(m.mass, 3), launchAcceleration: round(m.acceleration(0), 4),
    accelerationIndex: round(.4 * m.acceleration(0) + .6 * m.acceleration(20), 4),
    topSpeedKph: round((lo + hi) / 2 * 3.6, 3), zeroTo50Seconds: speed >= 50 / 3.6 ? round(steps * .01, 2) : null,
    lateralGripG: round(m.wheels.grip_coefficient * m.chassis.corner_stability_factor, 4),
    rollThresholdG: round(clamp(1.96 / (2 * m.chassis.cg_height_m) * .70, 1.20, 1.60), 4),
    cruisePowerKw: round(cruisePower, 4), cruiseMinutes: round(m.battery.capacity_kwh / cruisePower * 60, 2),
    batteryKwh: m.battery.capacity_kwh, drivePowerKw: round(m.power / 1000, 3),
    recoverySeconds: m.chassis.recovery_seconds, wheelRpmCapKph: round(m.rpmSpeed * 3.6, 3),
  };
}
const referenceParts = catalogData.referenceParts as PhysicalParts;
const reference = derive(referenceParts);
const referenceMechanics = mechanics(referenceParts);
export const VEHICLE_CLAMPS = Object.freeze({
  acceleration: Object.freeze([.8, 1.2] as const), speed: Object.freeze([.88, 1.12] as const), handling: Object.freeze([.85, 1.15] as const),
});
const statsCache = new Map<string, KartBuildStats>();
function physicalParts(build: KartBuild): PhysicalParts {
  return Object.fromEntries(KART_SLOTS.map(slot => [slot, partIndex.get(build[slot])!.physicalDesign])) as PhysicalParts;
}
/** All SI numbers are design estimates. They are never added to the game's units.
 * Cache is bounded and results immutable; per-frame callers cannot leak builds. */
export function buildStats(input: unknown = defaultBuild): KartBuildStats {
  const build = resolveBuild(input), key = KART_SLOTS.map(slot => build[slot]).join('|');
  const cached = statsCache.get(key);
  if (cached) return cached;
  const derived = derive(physicalParts(build));
  const multipliers: KartMultipliers = Object.freeze({
    acceleration: round(clamp(derived.accelerationIndex / reference.accelerationIndex, ...VEHICLE_CLAMPS.acceleration), 4),
    speed: round(clamp(derived.topSpeedKph / reference.topSpeedKph, ...VEHICLE_CLAMPS.speed), 4),
    handling: round(clamp(derived.lateralGripG / reference.lateralGripG, ...VEHICLE_CLAMPS.handling), 4),
  });
  const stats = Object.freeze({...derived, multipliers, accelerationMultiplier: multipliers.acceleration,
    speedMultiplier: multipliers.speed, handlingMultiplier: multipliers.handling});
  if (statsCache.size >= 128) statsCache.delete(statsCache.keys().next().value!);
  statsCache.set(key, stats);
  return stats;
}

export type KartTrackContext = {speed?: number; grade?: number; curvature?: number};
/** Geometry input is explicit and map-neutral. grade=rise/run; curvature=yaw/m.
 * Shape-specific pace is deterministic, bounded, and independent of rank/player.
 * Flat straight acceleration retains the approved fresh index; grades blend in
 * instantaneous torque/power response to make launch and hill builds useful. */
function performanceFor(stats: KartBuildStats, machine: ReturnType<typeof mechanics>, context: KartTrackContext = {}) {
  const grade = clamp(finite(context.grade), -.35, .35), speed = clamp(Math.abs(finite(context.speed)), 0, 100);
  const curvature = clamp(Math.abs(finite(context.curvature)), 0, .2);
  // Map speed is an existing game unit; use the baseline game/SI speed ratio.
  const speedSI = speed * (reference.topSpeedKph / 3.6 / 42);
  const currentRatio = Math.max(.01, machine.acceleration(speedSI, grade)) /
    Math.max(.5, referenceMechanics.acceleration(speedSI, grade));
  const gradeWeight = clamp(Math.abs(grade) * 5, 0, .5);
  const accelerationMultiplier = round(clamp(stats.accelerationMultiplier * (1 - gradeWeight) +
    currentRatio * gradeWeight, ...VEHICLE_CLAMPS.acceleration), 4);
  const bend = clamp((curvature - .005) / .035, 0, 1);
  // A genuine corner ceiling: at a tight bend grip, not long gearing, sets pace.
  const tightCornerRatio = Math.min(1, .62 * Math.sqrt(stats.handlingMultiplier) / stats.speedMultiplier);
  const cornerSpeedScale = round(clamp(1 - bend * (1 - tightCornerRatio), .5, 1), 4);
  return Object.freeze({
    accelerationMultiplier, speedMultiplier: stats.speedMultiplier, handlingMultiplier: stats.handlingMultiplier,
    cornerSpeedScale, gradeAcceleration: round(-9.81 * grade, 4),
    recoverySeconds: stats.recoverySeconds, rollThresholdG: stats.rollThresholdG,
  });
}
export type KartPerformance = ReturnType<typeof performanceFor>;
function tuningFor(driver: unknown, map: 'coast' | 'waterpark', stats: KartBuildStats, performance?: KartPerformance) {
  const base = characterTuning(driver, map);
  const multipliers: KartMultipliers = map === 'waterpark' ? Object.freeze({acceleration: 1, speed: 1, handling: 1}) :
    performance ? Object.freeze({acceleration: performance.accelerationMultiplier, speed: performance.speedMultiplier, handling: performance.handlingMultiplier}) : stats.multipliers;
  const cornerScale = map === 'coast' ? performance?.cornerSpeedScale ?? 1 : 1;
  const combined = {topSpeed: base.multipliers.topSpeed * multipliers.speed * cornerScale,
    acceleration: base.multipliers.acceleration * multipliers.acceleration,
    steering: base.multipliers.steering * multipliers.handling};
  return {...base,
    maxSpeed: base.maxSpeed * multipliers.speed * cornerScale,
    acceleration: base.acceleration * multipliers.acceleration,
    steering: base.steering * multipliers.handling,
    multipliers: combined, characterMultipliers: base.multipliers, buildMultipliers: multipliers, stats,
  };
}
export type CompiledKartBuild = Readonly<{
  build: Readonly<KartBuild>; parts: Readonly<Record<KartSlot, KartPart>>; stats: KartBuildStats;
  performance(context?: KartTrackContext): KartPerformance;
  tuning(driver: unknown, map: 'coast' | 'waterpark', context?: KartTrackContext): ReturnType<typeof tuningFor>;
}>;
const compiledCache = new Map<string, CompiledKartBuild>();
/** Compile once per selection/race. The snapshot cannot change under a racer,
 * and per-frame performance never searches the catalog or recomputes SI stats. */
export function compileKartBuild(input: unknown = defaultBuild): CompiledKartBuild {
  const build = resolveBuild(input), key = KART_SLOTS.map(slot => build[slot]).join('|');
  const cached = compiledCache.get(key);
  if (cached) return cached;
  const stats = buildStats(build), machine = mechanics(physicalParts(build));
  const compiled: CompiledKartBuild = Object.freeze({
    build: Object.freeze(build), parts: buildParts(build), stats,
    performance: (context: KartTrackContext = {}) => performanceFor(stats, machine, context),
    tuning: (driver: unknown, map: 'coast' | 'waterpark', context?: KartTrackContext) =>
      tuningFor(driver, map, stats, map === 'coast' && context ? performanceFor(stats, machine, context) : undefined),
  });
  if (compiledCache.size >= 128) compiledCache.delete(compiledCache.keys().next().value!);
  compiledCache.set(key, compiled);
  return compiled;
}
export function buildPerformance(input: unknown = defaultBuild, context: KartTrackContext = {}): KartPerformance {
  return compileKartBuild(input).performance(context);
}
/** Character identity is composed, never replaced. Water mounts bypass builds. */
export function kartTuning(driver: unknown, map: 'coast' | 'waterpark', input: unknown = defaultBuild, context?: KartTrackContext) {
  return compileKartBuild(input).tuning(driver, map, context);
}

export function defaultGarageState(): GarageState { return {version: 1, activeBuild: {...defaultBuild}, namedBuilds: []}; }
const validName = (name: unknown): name is string => typeof name === 'string' && name.length > 0 &&
  name.length <= MAX_BUILD_NAME_LENGTH && name.trim() === name && !/[\u0000-\u001f\u007f]/u.test(name);
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id);
function validNamedBuild(value: unknown): value is NamedKartBuild {
  return plain(value) && exactKeys(value, ['id', 'name', 'build']) && validId(value.id) && validName(value.name) && validateBuild(value.build);
}
function validState(value: unknown): value is GarageState {
  return plain(value) && exactKeys(value, ['version', 'activeBuild', 'namedBuilds']) && value.version === 1 &&
    validateBuild(value.activeBuild) && Array.isArray(value.namedBuilds) && value.namedBuilds.length <= MAX_NAMED_BUILDS &&
    value.namedBuilds.every(validNamedBuild) && new Set(value.namedBuilds.map(entry => entry.id)).size === value.namedBuilds.length;
}
/** Accept only bounded JSON. Invalid entries cannot inject part URLs or tuning.
 * Unsupported versions reset; isolated corrupt saved entries are discarded.
 * Loading never writes back, so corrupt data remains available for recovery. */
export function parseGarageState(raw: unknown): GarageState {
  const result = defaultGarageState();
  if (typeof raw !== 'string' || raw.length > MAX_STORAGE_LENGTH) return result;
  try {
    const value: unknown = JSON.parse(raw);
    if (!plain(value) || !exactKeys(value, ['version', 'activeBuild', 'namedBuilds']) || value.version !== 1) return result;
    if (validateBuild(value.activeBuild)) result.activeBuild = {...value.activeBuild};
    if (!Array.isArray(value.namedBuilds)) return result;
    const seen = new Set<string>();
    for (const entry of value.namedBuilds.slice(0, MAX_NAMED_BUILDS)) {
      if (!validNamedBuild(entry) || seen.has(entry.id)) continue;
      seen.add(entry.id); result.namedBuilds.push({id: entry.id, name: entry.name, build: {...entry.build}});
    }
  } catch { /* Invalid JSON is a recoverable first-run state. */ }
  return result;
}
function browserStorage(): GarageStorage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
export function loadGarageState(storage: Pick<GarageStorage, 'getItem'> | null = browserStorage()): GarageState {
  try { return parseGarageState(storage?.getItem(GARAGE_STORAGE_KEY)); } catch { return defaultGarageState(); }
}
/** Never overwrites with a repaired/malformed state; callers can show save errors. */
export function saveGarageState(state: GarageState, storage: Pick<GarageStorage, 'setItem'> | null = browserStorage()): boolean {
  try {
    if (!storage || !validState(state)) return false;
    const raw = JSON.stringify(state);
    if (raw.length > MAX_STORAGE_LENGTH) return false;
    storage.setItem(GARAGE_STORAGE_KEY, raw); return true;
  } catch { return false; }
}
