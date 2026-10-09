import test from 'node:test';
import assert from 'node:assert/strict';
import { claimPickup, advancePickup } from '../src/item-pickups';
import type { RacingPickup } from '../src/npc-tactics';
import { createDynamicPickupDirector, DYNAMIC_PICKUP_CAPACITY, DYNAMIC_PICKUP_RULES, pickupReactionDistance, type DynamicPickupRacer, type DynamicPickupTrack, type DynamicPickupOptions } from '../src/dynamic-pickups';
import { LENGTH, sample, shoulderAt, COAST_PICKUPS } from '../src/track';
import { WATER_RACE_LENGTH, sampleWaterparkLoop, WATER_RACE_PICKUPS } from '../src/waterpark-design';

function box(): RacingPickup {
  return { d: -100, lateral: 0, display: 'boost', cool: 0, mesh: { enabled: true }, models: { boost: { enabled: true }, shield: { enabled: false }, pulse: { enabled: false }, mystery: { enabled: false } } };
}
function racer(id = 'driver', overrides: Partial<DynamicPickupRacer> = {}): DynamicPickupRacer {
  return { id, total: 0, lateral: 0, travelSpeed: 20, maxSpeed: 20, acceleration: 0, ...overrides };
}
function circle(length = 2000): DynamicPickupTrack {
  return { length, laneLimit: () => 5.2, sample: (d, lateral = 0) => {
    const a = d / length * Math.PI * 2, radius = length / (Math.PI * 2);
    return { p: { x: (radius - lateral) * Math.sin(a), y: 0, z: radius - (radius - lateral) * Math.cos(a) }, t: { x: Math.cos(a), y: 0, z: Math.sin(a) } };
  } };
}
function random(seed = 71923) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
const immediate: DynamicPickupOptions = { initialDelay: 0, interval: 1, intervalJitter: 0, attempts: 1, aheadJitter: 0, rng: () => .5 };
function setup(options: DynamicPickupOptions = {}, track = circle(), count = 1) {
  const pool = Array.from({ length: count }, box), director = createDynamicPickupDirector(pool, track, { ...immediate, ...options });
  return { pool, director, tick: (racers = [racer()], dt = .1, active = true, staticBoxes: { d: number; lateral: number }[] = []) => director.tick({ racers, dt, active, staticBoxes }) };
}
const gap = (from: number, to: number, length: number) => ((to - from) % length + length) % length;

test('reaction distance integrates acceleration, caps achieved speed and retains actual speed above a stale cap', () => {
  assert.ok(Math.abs(pickupReactionDistance(20, 60, 20, 1.4) - 47.6) < 1e-10);
  assert.equal(pickupReactionDistance(20, 30, 20, 2), 57.5);
  assert.equal(pickupReactionDistance(-20, 20, 0, 1.4), 28);
  assert.equal(pickupReactionDistance(60, 20, 10, 1), 60);
  assert.equal(pickupReactionDistance(0, 40, 20, 1), 10);
  assert.equal(pickupReactionDistance(NaN, 40, 20, 1), Infinity);
});

test('construction hides only the finite pool and the director returns boxes to reposition', () => {
  const { pool, director, tick } = setup({}, circle(), DYNAMIC_PICKUP_CAPACITY);
  assert.equal(pool.length, 4);
  assert.ok(pool.every(b => !b.mesh.enabled && b.cool === Infinity));
  const moved = tick();
  assert.deepEqual(moved, [pool[0]]);
  assert.equal(pool[0].d, 37);
  assert.equal(pool[0].lateral, 0);
  assert.equal(pool[0].cool, 0);
  assert.equal(pool[0].mesh.enabled, true);
  assert.equal(director.slots[0].targetId, 'driver');
  assert.equal(director.slots[0].lifetime, 12);
  assert.ok(pool.slice(1).every(b => !b.mesh.enabled));
});

test('actual signed boosted speed and conservative acceleration set the lead distance', () => {
  for (const speed of [6, 20, 45, 60]) {
    const { tick } = setup();
    const target = racer('driver', { travelSpeed: speed, maxSpeed: 65, acceleration: 27 });
    const [spawn] = tick([target]);
    assert.ok(spawn, `speed ${speed}`);
    const instantaneous = Math.min(65, speed * 1.34);
    assert.ok(spawn.d >= pickupReactionDistance(instantaneous, 65, 27, 1.4) + 8);
  }
});

test('explicit unslowed reaction speed protects immediate slow expiry as well as new boosts', () => {
  const target = racer('target', { travelSpeed: 8, maxSpeed: 60, acceleration: 5, reactionSpeed: 50 });
  const [spawn] = setup().tick([target]);
  assert.ok(spawn.d >= pickupReactionDistance(50, 60, 5, 1.4) + 8);
  const slowedBlocker = racer('slowed blocker', { total: -25, travelSpeed: 5, maxSpeed: 60, acceleration: 5, reactionSpeed: 50, held: 'shield' });
  assert.deepEqual(setup().tick([racer('target'), slowedBlocker]), []);
  assert.deepEqual(setup().tick([racer('bad', { reactionSpeed: NaN })]), []);
  assert.deepEqual(setup().tick([racer('bad', { reactionSpeed: -1 })]), []);
});

test('near-stopped racers also block reachable space after changing direction', () => {
  for (const blocker of [racer('reverse to forward', { total: 22, travelSpeed: -2, maxSpeed: 60, acceleration: 40, held: 'shield' }), racer('forward to reverse', { total: 52, travelSpeed: 2, maxSpeed: 60, acceleration: 40, held: 'shield' })]) {
    assert.deepEqual(setup().tick([racer('target'), blocker]), []);
  }
});

test('a blocked trailing target is not rerolled into an easy leader opportunity', () => {
  const draws = [.5, .999, .5, .5];
  const { tick } = setup({ attempts: 8, rng: () => draws.shift() ?? 0 });
  // The first target roll chooses last; later zero rolls would select leader
  // if a rejected candidate incorrectly caused target selection to run again.
  // The last racer is deliberately chosen; its whole candidate range overlaps
  // the leader's protected reaction window. A target reroll could reward leader.
  const racers = [racer('leader', { total: 25, held: null }), racer('last', { held: null })];
  assert.deepEqual(tick(racers), []);
});

test('stationary, reversing, inventory-holding and finished racers receive no targeted spawns', () => {
  for (const patch of [{ travelSpeed: 0 }, { travelSpeed: -20 }, { travelSpeed: 5.99 }, { held: 'shield' }, { finished: true }]) {
    const { tick, pool } = setup();
    assert.deepEqual(tick([racer('driver', patch)]), []);
    assert.equal(pool[0].mesh.enabled, false);
  }
});

test('every physical racer blocks instant forward, reverse and lapped spawns regardless of lane or inventory', () => {
  const blockers: Partial<DynamicPickupRacer>[] = [
    { total: 37, travelSpeed: 0 },
    { total: 2037, travelSpeed: 0, finished: true },
    { total: -1963, travelSpeed: 0 },
    { total: 10, travelSpeed: 20 },
    { total: 70, travelSpeed: -20 },
    { total: 80, travelSpeed: 0, maxSpeed: 60, acceleration: 40 },
    { total: 37, lateral: 5.2, travelSpeed: 0 },
  ];
  for (const blocker of blockers) {
    const { tick } = setup();
    assert.deepEqual(tick([racer('target'), racer('blocker', { held: 'shield', ...blocker })]), [], JSON.stringify(blocker));
  }
});

test('physical proximity rejects boxes on a nearby folded segment despite a distant arc position', () => {
  const track: DynamicPickupTrack = { length: 2000, sample: (d, lateral = 0) => ({ p: { x: d > 400 && d < 600 ? d - 463 : d, y: 0, z: lateral }, t: { x: 1, y: 0, z: 0 } }) };
  const { tick } = setup({}, track);
  assert.deepEqual(tick([racer('target'), racer('other segment', { total: 500, held: 'pulse', travelSpeed: 0 })]), []);
});

test('arc-length placement wraps correctly at the lap seam and respects the race finish', () => {
  const seam = setup();
  assert.equal(seam.tick([racer('driver', { total: 1980 })])[0].d, 17);
  const finish = setup();
  assert.deepEqual(finish.tick([racer('driver', { total: 1980, finishDistance: 2000 })]), []);
  const before = setup();
  assert.equal(before.tick([racer('driver', { total: 1950, finishDistance: 2000 })])[0].d, 1987);
});

test('sharp curved and folded paths fail geometric visibility rather than spawning merely by arc distance', () => {
  const { tick } = setup({}, circle(100));
  assert.deepEqual(tick(), []);
  // Endpoint is straight ahead, but the intervening road curves behind a bank.
  const hidden: DynamicPickupTrack = { length: 2000, laneLimit: () => 4, sample: (d, lateral = 0) => ({
    p: { x: d, y: 0, z: lateral + 20 * Math.sin(Math.PI * d / 37) ** 2 },
    t: { x: 1, y: 0, z: 20 * Math.PI / 37 * Math.sin(Math.PI * 2 * d / 37) },
  }) };
  assert.deepEqual(setup({}, hidden).tick(), []);
});

test('authored boxes retain density protection while cooling, and existing dynamic slots are separated', () => {
  const close = setup();
  assert.deepEqual(close.tick([racer()], .1, true, [{ d: 37, lateral: 0 }]), []);
  const seam = setup();
  assert.deepEqual(seam.tick([racer('driver', { total: 1980 })], .1, true, [{ d: 18, lateral: 0 }]), []);
  const dense = setup({ maximumNearby: 3 });
  assert.deepEqual(dense.tick([racer()], .1, true, [{ d: 8, lateral: -4 }, { d: 57, lateral: 4 }, { d: 70, lateral: -4 }]), []);
  const { director, tick } = setup({ targetProgress: 0 }, circle(), 2);
  assert.equal(tick().length, 1);
  assert.deepEqual(tick([racer('driver', { total: 15 })], 1), []);
  assert.equal(director.slots.filter(s => s.active).length, 1);
});

test('pause, menu/countdown and zero/invalid dt cannot consume spawn, expiry or reuse clocks', () => {
  const { tick, director, pool } = setup({ initialDelay: 4 });
  for (const dt of [0, -1, NaN, Infinity, 11]) assert.deepEqual(tick([racer()], dt), []);
  assert.deepEqual(tick([racer()], 10, false), []);
  assert.deepEqual(tick([racer()], 3.9), []);
  assert.equal(tick([racer()], .11).length, 1);
  const before = { ...director.slots[0] };
  for (let i = 0; i < 30; i++) tick([racer()], 10, false);
  assert.equal(director.slots[0].lifetime, before.lifetime);
  claimPickup(pool[0], false);
  tick([racer()], .1);
  assert.equal(director.slots[0].reuseIn, 8);
  tick([racer()], 10, false);
  assert.equal(director.slots[0].reuseIn, 8);
});

test('claim is atomic, removes the box, then reuses the slot elsewhere after active-race cooldown', () => {
  const { director, tick, pool } = setup({ targetProgress: 0 });
  tick();
  assert.equal(claimPickup(pool[0], false), 'shield');
  assert.equal(claimPickup(pool[0], false), null);
  tick([racer('driver', { total: 100 })], .1);
  assert.equal(director.slots[0].active, false);
  assert.equal(pool[0].cool, Infinity);
  advancePickup(pool[0], 100); // Accidental generic advancement still cannot farm it.
  assert.equal(pool[0].mesh.enabled, false);
  assert.deepEqual(tick([racer('driver', { total: 100 })], 7), []);
  assert.equal(tick([racer('driver', { total: 100 })], 1).length, 1);
  assert.equal(pool[0].d, 137);
});

test('unclaimed boxes expire, finish is latched, and reset clears the entire lifecycle', () => {
  const { director, tick, pool } = setup();
  tick();
  tick([racer()], 6); tick([racer()], 6);
  assert.equal(pool[0].mesh.enabled, false);
  assert.equal(director.slots[0].reuseIn, 8);
  director.reset();
  assert.equal(director.slots[0].reuseIn, 0);
  assert.equal(tick().length, 1);
  director.finish();
  assert.ok(pool.every(b => !b.mesh.enabled));
  assert.equal(director.slots[0].targetId, null);
  assert.deepEqual(tick([racer('driver', { total: 400 })], 10), []);
  director.reset();
  assert.equal(tick().length, 1);
});

test('high-water progress prevents stationary and forward/reverse farming over the same patch', () => {
  const { director, tick } = setup({ lifetime: .1, reuseDelay: 0 });
  assert.equal(tick().length, 1);
  for (const [total, travelSpeed] of [[-30, -20], [-10, 20], [0, 20], [30, 20], [0, -20], [79, 20]]) {
    assert.deepEqual(tick([racer('driver', { total, travelSpeed })], 1), []);
  }
  assert.equal(tick([racer('driver', { total: 80 })], 1).length, 1);
  tick([racer('driver', { total: 170, held: 'boost' })], 1);
  assert.deepEqual(tick([racer('driver', { total: 0 })], 1), []);
  assert.equal(tick([racer('driver', { total: 170 })], 1).length, 1);
  assert.equal(director.slots[0].targetId, 'driver');
});

test('the caller-owned pool never grows and one tick cannot burst multiple spawns', () => {
  const { director, pool, tick } = setup({ targetProgress: 0, interval: 0, lifetime: 100, dynamicGap: 0, pickupGap: 0, worldPickupGap: 0, densityRadius: 0 }, circle(), 4);
  for (let i = 0; i < 4; i++) assert.equal(tick([racer('driver', { total: i * 100 })], .1).length, 1);
  const identities = pool.slice();
  assert.deepEqual(tick([racer('driver', { total: 500 })], 10), []);
  assert.equal(director.slots.length, 4);
  assert.deepEqual(pool, identities);
});

test('rank-weighted target selection is random, last gets more chances, and identities/order do not confer privilege', () => {
  const counts = { front: 0, middle: 0, last: 0 }, rng = random();
  const { director, tick } = setup({ rng });
  const racers = [racer('front', { total: 600 }), racer('middle', { total: 300 }), racer('last')];
  for (let i = 0; i < 6000; i++) {
    director.reset();
    assert.equal(tick(i % 2 ? [...racers].reverse() : racers).length, 1);
    counts[director.slots[0].targetId as keyof typeof counts]++;
  }
  assert.ok(counts.front > 850 && counts.front < 1350, JSON.stringify(counts));
  assert.ok(counts.middle > 1350 && counts.middle < 1850, JSON.stringify(counts));
  assert.ok(counts.last > counts.front * 2.5 && counts.last < counts.front * 3.5, JSON.stringify(counts));
  const simulate = (rename: boolean) => {
    const { director: d, tick: t } = setup({ rng: random(456) });
    const result: number[] = [];
    for (let i = 0; i < 50; i++) { d.reset(); t(racers.map(r => ({ ...r, id: rename ? `NPC-${r.id}` : r.id }))); result.push(d.slots[0].box.d); }
    return result;
  };
  assert.deepEqual(simulate(false), simulate(true));
});

test('rank weights include finished and inventory-holding racers before eligibility filtering', () => {
  const races = [racer('finished', { total: 1000, finished: true }), racer('front', { total: 600 }), racer('holding', { total: 300, held: 'boost' }), racer('last')];
  // Effective eligible weights: front=1+2/9, last=3. A .28 roll selects front;
  // reranking eligible racers alone (1:3) would incorrectly select last.
  let calls = 0;
  const { director, tick } = setup({ rng: () => ++calls === 2 ? .28 : .5 });
  assert.equal(tick(races).length, 1);
  assert.equal(director.slots[0].targetId, 'front');
});

test('rank bias never changes reward odds, gives inventory directly or guarantees a strong item', () => {
  for (const id of ['leader', 'last']) {
    const seen = new Set<string>();
    for (const displayRoll of [0, .5]) for (const itemRoll of [0, .4, .9]) {
      const values = [.5, id === 'leader' ? 0 : .999, .5, .5, displayRoll, itemRoll];
      const { tick, pool } = setup({ rng: () => values.shift() ?? itemRoll });
      const racers = [racer('leader', { total: 300, held: null }), racer('last', { held: null })];
      assert.equal(tick(racers).length, 1);
      assert.ok(racers.every(r => r.held === null));
      seen.add(pool[0].display);
      assert.equal(claimPickup(pool[0], false, () => itemRoll), ['boost', 'shield', 'pulse'][Math.floor(itemRoll * 3)]);
    }
    assert.deepEqual([...seen].sort(), ['boost', 'mystery', 'pulse', 'shield']);
  }
});

test('invalid snapshots, geometry and bounds fail closed without unsafe spawns', () => {
  for (const patch of [{ travelSpeed: NaN }, { acceleration: Infinity }, { total: Infinity }, { lateral: NaN }]) {
    assert.deepEqual(setup().tick([racer(), racer('bad', { held: 'boost', ...patch })]), []);
  }
  assert.deepEqual(setup().tick([racer(), racer()]), []);
  const broken = circle(); broken.sample = () => ({ p: { x: NaN, y: 0, z: 0 }, t: { x: 1, y: 0, z: 0 } });
  assert.deepEqual(setup({}, broken).tick(), []);
  const narrow = circle(); narrow.laneLimit = () => 1;
  assert.ok(Math.abs(setup({ rng: () => .999 }, narrow).tick([racer('driver', { lateral: 5 })])[0].lateral) <= 1);
  assert.throws(() => createDynamicPickupDirector([box()], circle(0)), RangeError);
  const duplicate = box(); assert.throws(() => createDynamicPickupDirector([duplicate, duplicate], circle()), RangeError);
});

test('seeded real coast/water races retain visible dynamic opportunities without overrunning the pool', () => {
  const tracks = [
    { name: 'coast', track: { length: LENGTH, sample, laneLimit: (d: number) => shoulderAt(d) - .8 }, statics: COAST_PICKUPS, speed: 38, max: 60.8, acceleration: 26.05 },
    { name: 'water', track: { length: WATER_RACE_LENGTH, sample: sampleWaterparkLoop, laneLimit: () => 5.2 }, statics: WATER_RACE_PICKUPS, speed: 24, max: 31.8, acceleration: 12.45 },
  ];
  for (const config of tracks) for (const spacing of [5, 110]) {
    const pool = Array.from({ length: DYNAMIC_PICKUP_CAPACITY }, box), director = createDynamicPickupDirector(pool, config.track, { rng: random(778) });
    let count = 0;
    const targets = new Set<string>();
    for (let frame = 0; frame < 2400; frame++) {
      const racers = Array.from({ length: 6 }, (_, i) => racer(`racer-${i}`, { total: frame * .1 * config.speed - i * spacing, travelSpeed: config.speed, maxSpeed: config.max, acceleration: config.acceleration }));
      const moved = director.tick({ dt: .1, active: true, racers, staticBoxes: config.statics });
      count += moved.length;
      for (const box of moved) {
        const slot = director.slots.find(s => s.box === box)!;
        targets.add(slot.targetId!);
        const target = racers.find(r => r.id === slot.targetId)!;
        const ahead = gap(target.total, box.d, config.track.length);
        assert.ok(ahead >= DYNAMIC_PICKUP_RULES.minimumAhead && ahead <= DYNAMIC_PICKUP_RULES.maximumAhead);
      }
      assert.ok(director.slots.filter(s => s.active).length <= DYNAMIC_PICKUP_CAPACITY);
    }
    assert.ok(count >= 10, `${config.name} spacing ${spacing}: only ${count} dynamic opportunities in 240 race seconds`);
    assert.ok(targets.size >= 4, `${config.name} spacing ${spacing}: opportunities reach only ${targets.size} racers`);
  }
});
