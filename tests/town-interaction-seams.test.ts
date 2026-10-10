import test from 'node:test';
import assert from 'node:assert/strict';
import { activateItem, chooseItem, collectPickups, newBrain, planLane, pulseTarget, type Combatant, type RacingPickup, type RouteInteractions } from '../src/npc-tactics';
import { createDynamicPickupDirector, type DynamicPickupTrack } from '../src/dynamic-pickups';
import { createRaceMinimap } from '../src/race-shell';

const actor = (id: string, total = 0) => ({ id, total, lateral: 0, speed: 25, held: null, boost: 0, shield: 0, slow: 0, ...newBrain(0, 0) } as Combatant & ReturnType<typeof newBrain>);
const box = (d = 20, lateral = 0): RacingPickup => ({ d, lateral, cool: 0, display: 'boost', mesh: { enabled: true }, models: { boost: { enabled: true }, shield: { enabled: false }, pulse: { enabled: false }, mystery: { enabled: false } } });
const separated: RouteInteractions = { gap: () => null, pickupGap: () => null };

test('different branches do not pulse, threaten shields, block boosts, or distract lanes', () => {
  const a = actor('alley'), b = actor('boulevard', 3);
  assert.equal(pulseTarget(a, [b], 1000), b);
  assert.equal(pulseTarget(a, [b], 1000, separated), undefined);
  a.held = 'pulse'; assert.equal(chooseItem(a, [b], 1000, 0, undefined, separated), null);
  assert.equal(activateItem(a, [b], 1000, separated)?.target, undefined); assert.equal(b.slow, 0);
  a.boost = 0; a.held = 'shield'; assert.equal(chooseItem(a, [b], 1000, 0, undefined, separated), null);
  a.held = 'boost'; assert.equal(chooseItem(a, [b], 1000, 0, undefined, separated), 'boost');
  a.held = null;
  assert.equal(planLane(a, [b], [box(20, 3)], 1000, 0, 0, undefined, separated), 0);
});

test('physical route gaps determine target range and reachable merge order, independent of canonical totals', () => {
  const a = actor('alley', 500), near = actor('merge', 800), far = actor('far', 502);
  const routes: RouteInteractions = { gap: (_a, b) => b.id === 'merge' ? 12 : 130 };
  assert.equal(pulseTarget(a, [far, near], 1000, routes), near);
  a.held = 'pulse'; assert.equal(activateItem(a, [far, near], 1000, routes)?.target, near);
  assert.equal(near.slow, 3); assert.equal(far.slow, 0);
});

test('physical pickup contact keeps global earliest-arrival and ID ties, rejecting incompatible decks', () => {
  for (const reverse of [false, true]) {
    const a = actor('a', 999), z = actor('z', 999), other = actor('other-deck', 20), pickup = box();
    const racers = [a, z, other].map(actor => ({ actor, previous: 0, previousLane: 0 }));
    if (reverse) racers.reverse();
    collectPickups(racers, [pickup], 1000, () => .5, r => r.actor.id === 'other-deck' ? null : r.actor.id === 'z' ? .2 : .4);
    assert.equal(z.held, 'boost'); assert.equal(a.held, null); assert.equal(other.held, null);
    const tied = box(); z.held = null;
    collectPickups(racers, [tied], 1000, () => .5, r => r.actor.id === 'other-deck' ? null : .3);
    assert.equal(a.held, 'boost'); assert.equal(z.held, null);
  }
});

test('invalid physical contact fractions cannot claim boxes; exact frame endpoints can', () => {
  for (const time of [null, NaN, Infinity, -0.1, 1.1, 0, 1]) {
    const a = actor('a', 20);
    collectPickups([{ actor: a, previous: 0, previousLane: 0 }], [box()], 1000, () => .5, () => time);
    assert.equal(a.held, time === 0 || time === 1 ? 'boost' : null);
  }
});

const straight: DynamicPickupTrack = { length: 2000, sample: (d, lateral = 0) => ({ p: { x: d, y: 0, z: lateral }, t: { x: 1, y: 0, z: 0 } }) };
const driver = { id: 'target', total: 0, lateral: 0, travelSpeed: 20, maxSpeed: 20, acceleration: 0 };
const options = { initialDelay: 0, attempts: 1, aheadJitter: 0, rng: () => .5 };

test('dynamic eligibility receives the entire unwrapped lead-time corridor and rejects interior blind zones', () => {
  const calls: unknown[] = [];
  for (const blocked of [true, false]) {
    const track = { ...straight, eligibility: (from: number, to: number, id: string) => { calls.push([from, to, id]); return !blocked || !(from < 15 && to > 15); } };
    const director = createDynamicPickupDirector([box()], track, options);
    assert.equal(director.tick({ dt: .1, active: true, racers: [driver] }).length, blocked ? 0 : 1);
  }
  assert.deepEqual(calls, [[0, 37, 'target'], [0, 37, 'target']]);
  let corridor: number[] = [];
  const director = createDynamicPickupDirector([box()], { ...straight, eligibility: (a, b) => { corridor = [a, b]; return false; } }, options);
  director.tick({ dt: .1, active: true, racers: [{ ...driver, total: 1990 }] });
  assert.deepEqual(corridor, [1990, 2027]);
});

test('dynamic 3D safety uses the actual branch position of every racer', () => {
  const nearby = { ...driver, id: 'other', total: 400, held: 'shield' };
  const track = { ...straight, racerPosition: (r: typeof driver) => ({ x: r.id === 'other' ? 37 : 0, y: 0, z: 0 }) };
  const director = createDynamicPickupDirector([box()], track, options);
  assert.deepEqual(director.tick({ dt: .1, active: true, racers: [driver, nearby] }), []);
});

test('minimap bounds contain both branches and actor dots use real world positions', () => {
  const moves: number[][] = [], dots: number[][] = []; let closes = 0, samples = 0;
  const context = { clearRect() {}, beginPath() {}, moveTo: (x: number, y: number) => moves.push([x, y]), lineTo() {}, closePath() { closes++; }, stroke() {}, fill() {}, arc: (x: number, y: number) => dots.push([x, y]) };
  const canvas = { width: 260, height: 230, getContext: () => context } as unknown as HTMLCanvasElement;
  const minimap = createRaceMinimap(canvas, { length: 100, sample: d => { samples++; return { p: { x: d, z: 0 } }; }, extraPaths: [{ length: 100, sample: d => ({ p: { x: d, z: 100 } }) }] });
  const initial = samples;
  minimap.draw([{ total: 20, position: { x: 50, z: 100 }, player: true }]);
  assert.equal(samples, initial); assert.equal(moves.length, 2); assert.equal(closes, 1);
  assert.deepEqual(dots, [[130, 216]]);
});

test('dynamic reaction and opposite-direction windows use physical route gaps', () => {
  for (const travelSpeed of [58, -58, 0, 1, -1]) {
    const other = { ...driver, id: 'other', total: 400, held: 'shield', travelSpeed, maxSpeed: 58, acceleration: Math.abs(travelSpeed) <= 1 ? 40 : 0 };
    const physicalGap = Math.abs(travelSpeed) > 1 ? Math.sign(travelSpeed) * 88.5 : travelSpeed > 0 ? -12 : 12;
    const track = { ...straight, racerGap: (r: typeof driver, d: number) => r.id === 'other' ? physicalGap : d - r.total };
    const director = createDynamicPickupDirector([box()], track, options);
    assert.deepEqual(director.tick({ dt: .1, active: true, racers: [driver, other] }), [], `speed ${travelSpeed}`);
  }
});

test('unreachable dynamic route gaps still check 3D proximity and invalid gaps fail closed', () => {
  for (const gap of [null, NaN, Infinity]) {
    const other = { ...driver, id: 'other', total: 400, held: 'shield' };
    const track = { ...straight, racerGap: (r: typeof driver, d: number) => r.id === 'other' ? gap : d - r.total,
      racerPosition: (r: typeof driver) => ({ x: r.id === 'other' ? 37 : 0, y: 0, z: 0 }) };
    const director = createDynamicPickupDirector([box()], track, options);
    assert.deepEqual(director.tick({ dt: .1, active: true, racers: [driver, other] }), []);
  }
});

test('dynamic authored pickup clearance uses the pickup actual branch position', () => {
  const track = { ...straight, pickupPosition: () => ({ x: 37, y: 0, z: 0 }) };
  const director = createDynamicPickupDirector([box()], track, options);
  assert.deepEqual(director.tick({ dt: .1, active: true, racers: [driver], staticBoxes: [box(400)] }), []);
});
