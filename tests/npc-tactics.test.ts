import test from 'node:test';
import assert from 'node:assert/strict';
import type { ItemDisplay, ItemKind } from '../src/item-models';
import { advancePickup, PICKUP_RESPAWN_SECONDS, resetPickup, setPickupDisplay } from '../src/item-pickups';
import {
  RULES, activateItem, chooseItem, collectPickups, forwardGap, moveLane, nearbyGap,
  newBrain, planLane, pulseTarget, racingSpeed, tickBrain, tickEffects,
  type Brain, type Combatant, type PickupRacer, type RacingPickup,
} from '../src/npc-tactics';
import { LENGTH, MAX_SPEED, sample } from '../src/track';

type Bot = Combatant & Brain;
const kinds: ItemKind[] = ['boost', 'shield', 'pulse'];
function racer(id = 'bot', values: Partial<Bot> = {}): Bot {
  return { id, total: 0, lateral: 0, speed: 36, held: null, boost: 0, shield: 0, slow: 0, ...newBrain(0, 0), ...values };
}
function box(d = 20, lateral = 0, display: ItemDisplay = 'boost'): RacingPickup {
  const value: RacingPickup = {
    d, lateral, display, cool: 0, mesh: { enabled: true },
    models: { boost: { enabled: false }, shield: { enabled: false }, pulse: { enabled: false }, mystery: { enabled: false } },
  };
  setPickupDisplay(value, display);
  return value;
}
const swept = (actor: Combatant, previous: number, previousLane = actor.lateral): PickupRacer => ({ actor, previous, previousLane });
const close = (actual: number, expected: number, message?: string) => assert.ok(Math.abs(actual - expected) < 1e-9, message || `${actual} ~= ${expected}`);
function seeded(seed: number) {
  return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 0x100000000; };
}

test('new brains start without rewards and ordinary thinking never manufactures inventory', () => {
  const actor = racer(), opponent = racer('player', { total: 4, held: 'pulse' });
  assert.deepEqual(newBrain(0, -3.2), { bump: 0, decisionIn: 0, reaction: 0, cooldown: 0, targetLane: -3.2, pulseFlash: 0, pickups: 0, uses: 0 });
  for (let i = 0; i < 600; i++) {
    tickBrain(actor, .1); tickEffects(actor, .1);
    actor.lateral = moveLane(actor.lateral, planLane(actor, [actor, opponent], [], LENGTH, 1, .1), .1);
    actor.total += racingSpeed(actor, MAX_SPEED) * .1;
    assert.equal(chooseItem(actor, [actor, opponent], LENGTH, 0), null);
    assert.equal(activateItem(actor, [actor, opponent], LENGTH), null);
    collectPickups([swept(actor, actor.total - actor.speed * .1)], [], LENGTH);
    assert.equal(actor.held, null); assert.equal(actor.pickups, 0); assert.equal(actor.uses, 0);
    assert.equal(actor.boost + actor.shield + actor.slow, 0);
  }
});

test('physical gaps remain correct at the lap seam and on later or negative laps', () => {
  for (const lap of [-3, 0, 1, 8]) {
    close(forwardGap(lap * LENGTH + LENGTH - 5, 5, LENGTH), 10);
    close(nearbyGap(lap * LENGTH + LENGTH - 5, 5, LENGTH), 10);
    close(nearbyGap(5, lap * LENGTH + LENGTH - 5, LENGTH), -10);
  }
});

test('shared effect clocks expire exactly, never go negative, and ignore negative elapsed time', () => {
  const actor = racer('player', { boost: 1, shield: 2, slow: 3, bump: .55, reaction: .2, cooldown: .3, decisionIn: .1, pulseFlash: .4 });
  const original = { ...actor };
  tickEffects(actor, -1); tickBrain(actor, -1); assert.deepEqual(actor, original);
  tickEffects(actor, .5); tickBrain(actor, .25);
  assert.deepEqual([actor.boost, actor.shield, actor.slow], [.5, 1.5, 2.5]);
  close(actor.cooldown, .05); close(actor.pulseFlash, .15); close(actor.bump, .3);
  assert.equal(actor.reaction, 0); assert.equal(actor.decisionIn, 0);
  tickEffects(actor, 100); tickBrain(actor, 100);
  for (const key of ['boost', 'shield', 'slow', 'bump', 'reaction', 'cooldown', 'decisionIn', 'pulseFlash'] as const) assert.equal(actor[key], 0, key);
});

test('racing speed clamps the base pace and applies the same bounded boost and slow factors', () => {
  const actor = racer();
  for (const base of [-10, 0, 18, MAX_SPEED, MAX_SPEED * 20]) {
    actor.speed = base;
    for (const boosting of [false, true]) for (const slowed of [false, true]) {
      actor.boost = boosting ? 1 : 0; actor.slow = slowed ? 1 : 0;
      close(racingSpeed(actor, MAX_SPEED), Math.min(MAX_SPEED, Math.max(0, base)) * (boosting ? RULES.boostFactor : 1) * (slowed ? RULES.slowFactor : 1));
      assert.ok(racingSpeed(actor, MAX_SPEED) >= 0 && racingSpeed(actor, MAX_SPEED) <= MAX_SPEED * RULES.boostFactor);
    }
  }
});

test('boost and shield consume exactly one held item and preserve a longer active effect', () => {
  for (const id of ['player', 'bot-0']) for (const kind of ['boost', 'shield'] as const) {
    const actor = racer(id, { held: kind }), other = racer('other');
    const event = activateItem(actor, [actor, other], LENGTH);
    assert.equal(event?.item, kind); assert.equal(actor.held, null);
    assert.equal(actor[kind], RULES[kind]); assert.equal(other.boost + other.shield + other.slow, 0);
    assert.equal(activateItem(actor, [actor, other], LENGTH), null);
    actor[kind] = 20; actor.held = kind; activateItem(actor, [actor, other], LENGTH);
    assert.equal(actor[kind], 20, 'another item cannot shorten an existing effect');
  }
});

test('pulses select the nearest physical racer including player and bots across the seam', () => {
  const actor = racer('shooter', { total: LENGTH - 9, held: 'pulse' });
  const player = racer('player', { total: 3 }), farther = racer('bot-far', { total: 20 }), behind = racer('bot-behind', { total: LENGTH - 12 });
  assert.equal(pulseTarget(actor, [farther, actor, behind, player], LENGTH), player);
  const event = activateItem(actor, [farther, actor, behind, player], LENGTH);
  assert.equal(event?.target, player); assert.equal(event?.blocked, false);
  assert.equal(player.slow, RULES.slow); assert.equal(farther.slow, 0); assert.equal(behind.slow, 0);
  actor.total = 0; actor.held = 'pulse'; player.total = 20; farther.total = 7;
  assert.equal(activateItem(actor, [player, farther, actor], LENGTH)?.target, farther);
  assert.equal(farther.slow, RULES.slow);
});

test('a nearest shield blocks the pulse without skipping to an unshielded racer', () => {
  const actor = racer('player', { held: 'pulse' }), protectedBot = racer('bot-a', { total: 7, shield: 2 }), farther = racer('bot-b', { total: 9 });
  const event = activateItem(actor, [farther, protectedBot, actor], LENGTH);
  assert.equal(event?.target, protectedBot); assert.equal(event?.blocked, true);
  assert.equal(protectedBot.slow, 0); assert.equal(farther.slow, 0); assert.equal(actor.boost, 0);
  assert.equal(actor.held, null); assert.equal(protectedBot.shield, 2);
});

test('pulse targeting has a deterministic tie, a strict range, and a no-target fallback', () => {
  const actor = racer('shooter', { held: 'pulse' }), a = racer('a', { total: 15 }), z = racer('z', { total: 15 });
  assert.equal(pulseTarget(actor, [z, a, actor], LENGTH), a);
  assert.equal(pulseTarget(actor, [actor, a, z], LENGTH), a);
  for (const distance of [0, .099, .1, RULES.pulseRange, -1]) {
    const target = racer('target', { total: distance });
    assert.equal(pulseTarget(actor, [target, actor], LENGTH), undefined, `outside forward range: ${distance}`);
  }
  const event = activateItem(actor, [actor], LENGTH);
  assert.equal(event?.target, undefined); assert.equal(event?.blocked, false);
  assert.equal(actor.held, null); assert.equal(actor.boost, 1.9);
});

test('reaction delay and cooldown gate every tactical item without consuming it', () => {
  for (const held of kinds) {
    const actor = racer('bot', { held });
    const target = racer('player', { total: held === 'shield' ? -10 : 15, lateral: held === 'boost' ? 4 : 0, held: held === 'shield' ? 'pulse' : null });
    assert.equal(chooseItem(actor, [actor, target], LENGTH, 0), held);
    for (const gate of ['reaction', 'cooldown'] as const) {
      actor[gate] = gate === 'reaction' ? RULES.reaction : RULES.cooldown;
      assert.equal(chooseItem(actor, [actor, target], LENGTH, 0), null);
      tickBrain(actor, actor[gate] - .01);
      assert.equal(chooseItem(actor, [actor, target], LENGTH, 0), null);
      tickBrain(actor, .02);
      assert.equal(chooseItem(actor, [actor, target], LENGTH, 0), held);
      assert.equal(actor.held, held, 'choosing is read-only');
    }
  }
});

test('shield is held for a nearby collision or an incoming pulse rather than fired blindly', () => {
  const actor = racer('bot', { held: 'shield' }), other = racer('player', { total: 30 });
  assert.equal(chooseItem(actor, [actor, other], LENGTH, 0), null);
  other.total = 7; other.speed = actor.speed + 5;
  assert.equal(chooseItem(actor, [actor, other], LENGTH, 0), null, 'the car ahead is pulling away');
  other.speed = actor.speed - 5;
  assert.equal(chooseItem(actor, [actor, other], LENGTH, 0), 'shield');
  other.lateral = 4;
  assert.equal(chooseItem(actor, [actor, other], LENGTH, 0), null, 'adjacent-lane traffic is not a collision');
  other.total = LENGTH - 20; other.held = 'pulse';
  assert.equal(chooseItem(actor, [actor, other], LENGTH, 0), 'shield', 'wrapped pulse threat works across lanes');
  actor.shield = 1;
  assert.equal(chooseItem(actor, [actor, other], LENGTH, 0), null, 'do not waste a second shield');
  actor.shield = 0; other.total = LENGTH - 61;
  assert.equal(chooseItem(actor, [actor, other], LENGTH, 0), null);
  other.total = 20;
  assert.equal(chooseItem(actor, [actor, other], LENGTH, 0), null, 'a forward-firing pulse ahead is not incoming');
});

test('pulse tactics wait for a vulnerable target and do not spend the no-target fallback', () => {
  const actor = racer('bot', { held: 'pulse' }), near = racer('player', { total: 7 }), far = racer('other', { total: 12 });
  assert.equal(chooseItem(actor, [actor], LENGTH, 0), null);
  assert.equal(chooseItem(actor, [actor, near, far], LENGTH, 0), 'pulse');
  near.shield = 1;
  assert.equal(chooseItem(actor, [actor, near, far], LENGTH, 0), null, 'do not skip a shielded nearest racer');
  near.shield = 0; near.slow = .5;
  assert.equal(chooseItem(actor, [actor, near, far], LENGTH, 0), null);
  near.slow = .49;
  assert.equal(chooseItem(actor, [actor, near, far], LENGTH, 0), 'pulse');
});

test('boost tactics require an open straight, useful pace, safe lane, and no existing effect', () => {
  const actor = racer('bot', { held: 'boost' }), traffic = racer('player', { total: 15 });
  assert.equal(chooseItem(actor, [actor], LENGTH, 0), 'boost');
  for (const patch of [{ boost: 1 }, { slow: 1 }, { speed: 12 }, { lateral: 5.4 }, { lateral: -5.4 }]) {
    assert.equal(chooseItem({ ...actor, ...patch }, [actor], LENGTH, 0), null, JSON.stringify(patch));
  }
  for (const bend of [-.31, .31]) assert.equal(chooseItem(actor, [actor], LENGTH, bend), null);
  assert.equal(chooseItem(actor, [actor, traffic], LENGTH, 0), null, 'traffic blocks the acceleration corridor');
  traffic.lateral = 3;
  assert.equal(chooseItem(actor, [actor, traffic], LENGTH, 0), 'boost');
});

test('swept pickup collision prevents tunnelling but requires simultaneous longitudinal and lateral overlap', () => {
  const actor = racer('bot', { total: 40 }), pickup = box(20);
  collectPickups([swept(actor, 0)], [pickup], LENGTH);
  assert.equal(actor.held, 'boost'); assert.equal(pickup.cool, PICKUP_RESPAWN_SECONDS); assert.equal(pickup.mesh.enabled, false);
  const lateralMiss = racer('miss', { total: 40, lateral: 1.251 }), untouched = box(20);
  collectPickups([swept(lateralMiss, 0)], [untouched], LENGTH);
  assert.equal(lateralMiss.held, null); assert.equal(untouched.cool, 0);
  const mistimed = racer('mistimed', { total: 40, lateral: 0 }), separateIntervals = box(10);
  collectPickups([swept(mistimed, 0, 6)], [separateIntervals], LENGTH);
  assert.equal(mistimed.held, null, 'crossing each axis at separate times is not contact');
  assert.equal(separateIntervals.mesh.enabled, true);
});

test('pickup competition uses earliest contact rather than player or iteration priority', () => {
  for (const reverse of [false, true]) {
    const player = racer('player', { total: 30 }), bot = racer('bot', { total: 30 }), pickup = box(20, 0, 'shield');
    const racers = [swept(player, 0), swept(bot, 10)];
    collectPickups(reverse ? racers.reverse() : racers, [pickup], LENGTH);
    assert.equal(bot.held, 'shield'); assert.equal(player.held, null);
  }
  for (const reverse of [false, true]) {
    const a = racer('a', { total: 30 }), z = racer('z', { total: 30 }), pickup = box();
    const racers = [swept(z, 0), swept(a, 0)];
    collectPickups(reverse ? racers.reverse() : racers, [pickup], LENGTH);
    assert.equal(a.held, 'boost'); assert.equal(z.held, null, 'exact ties are stable by racer ID');
  }
});

test('lateral entry time participates in pickup competition', () => {
  const lateLane = racer('a', { total: 20, lateral: 0 }), earlyLane = racer('z', { total: 20, lateral: 0 }), pickup = box(20);
  collectPickups([swept(lateLane, 20, 6), swept(earlyLane, 15, 0)], [pickup], LENGTH);
  assert.equal(earlyLane.held, 'boost'); assert.equal(lateLane.held, null);
});

test('full inventory, cooling boxes and hidden boxes cannot be claimed or overwritten', () => {
  const occupied = racer('occupied', { total: 20, held: 'pulse' }), waiting = racer('waiting', { total: 20 }), pickup = box(20, 0, 'shield');
  collectPickups([swept(occupied, 0)], [pickup], LENGTH);
  assert.equal(occupied.held, 'pulse'); assert.equal(pickup.cool, 0); assert.equal(pickup.mesh.enabled, true);
  collectPickups([swept(occupied, 0), swept(waiting, 10)], [pickup], LENGTH);
  assert.equal(waiting.held, 'shield'); assert.equal(occupied.held, 'pulse');
  for (const inactive of [Object.assign(box(), { cool: 2 }), Object.assign(box(), { mesh: { enabled: false } })]) {
    const actor = racer('empty', { total: 20 }); collectPickups([swept(actor, 0)], [inactive], LENGTH);
    assert.equal(actor.held, null);
  }
});

test('one sweep awards at most one item per racer and respects box contact time, not box order', () => {
  for (const reverse of [false, true]) {
    const actor = racer('bot', { total: 50 }), early = box(10, 0, 'shield'), late = box(30, 0, 'pulse');
    const boxes = [late, early]; let notifications = 0;
    collectPickups([{ ...swept(actor, 0), onPickup(kind) { notifications++; assert.equal(kind, 'shield'); } }], reverse ? boxes.reverse() : boxes, LENGTH);
    assert.equal(actor.held, 'shield'); assert.equal(notifications, 1);
    assert.equal(early.mesh.enabled, false); assert.equal(late.mesh.enabled, true);
  }
  const first = racer('a', { total: 50 }), second = racer('b', { total: 50 });
  const early = box(10, 0, 'shield'), later = box(30, 0, 'pulse');
  collectPickups([swept(first, 0), swept(second, 0)], [later, early], LENGTH);
  assert.equal(first.held, 'shield'); assert.equal(second.held, 'pulse', 'a loser at the first box can still reach a later box');
});

test('mystery competition rolls exactly once and never rerolls an occupied or cooling pickup', () => {
  const a = racer('a', { total: 30 }), b = racer('b', { total: 30 }), pickup = box(20, 0, 'mystery'); let rolls = 0;
  const rng = () => { rolls++; return .9; };
  collectPickups([swept(b, 0), swept(a, 0)], [pickup], LENGTH, rng);
  assert.equal(a.held, 'pulse'); assert.equal(b.held, null); assert.equal(rolls, 1);
  collectPickups([swept(a, 0), swept(b, 0)], [pickup], LENGTH, rng);
  assert.equal(rolls, 1);
});

test('swept pickups work forward, in reverse, and across either lap seam', () => {
  for (const [previous, total, distance] of [[5, 35, 20], [35, 5, 20], [95, 105, 1], [105, 95, 99], [-5, 5, 0], [305, 295, 0]]) {
    const actor = racer('bot', { total }), pickup = box(distance);
    collectPickups([swept(actor, previous)], [pickup], 100);
    assert.equal(actor.held, 'boost', `${previous} -> ${total}, box ${distance}`);
  }
});

test('lane planning seeks only active, nearby, reachable pickups when inventory is empty', () => {
  const actor = racer(), candidate = box(30, 2.4);
  assert.equal(planLane(actor, [actor], [candidate], LENGTH, 0, 0), 2.4);
  const baseline = planLane(actor, [actor], [], LENGTH, 0, 0);
  for (const invalid of [box(LENGTH - 5, 2.4), box(49, 2.4), box(3, 5.2), box(30, 5.3), Object.assign(box(30, 2.4), { cool: 1 }), Object.assign(box(30, 2.4), { mesh: { enabled: false } })]) {
    assert.equal(planLane(actor, [actor], [invalid], LENGTH, 0, 0), baseline);
  }
  assert.equal(planLane({ ...actor, held: 'pulse' }, [actor], [candidate], LENGTH, 0, 0), baseline);
  assert.equal(planLane(actor, [actor], [candidate], LENGTH, 0, .6), baseline);
  actor.total = LENGTH - 10;
  assert.equal(planLane(actor, [actor], [box(20, 2.4)], LENGTH, 0, 0), 2.4, 'a reachable box across the seam is ahead');
});

test('lane planning accounts for boosted speed when judging pickup reachability', () => {
  const actor = racer('bot', { total: 0, lateral: -3, speed: MAX_SPEED, boost: 2 });
  const tooLate = box(47, 2.1);
  const availableSteering = RULES.lateralSpeed * (47 + 1.8) / racingSpeed(actor, MAX_SPEED) + 1.25;
  assert.ok(Math.abs(tooLate.lateral - actor.lateral) > availableSteering, 'even the final pickup edge is unreachable');
  assert.equal(planLane(actor, [actor], [tooLate], LENGTH, 0, 0), planLane(actor, [actor], [], LENGTH, 0, 0));
});

test('traffic avoidance stays bounded and lane movement is rate-limited without teleporting', () => {
  const actor = racer('bot', { lateral: 4.8 }), traffic = racer('player', { total: 5, lateral: 4.8 });
  const target = planLane(actor, [actor, traffic], [box(25, 4.8)], LENGTH, Math.PI / 2, 0);
  assert.ok(Math.abs(target) <= 5.2);
  for (const lane of [-5.2, -2, 0, 2, 5.2]) for (const goal of [-100, -5.2, 0, 5.2, 100]) for (const dt of [0, .016, .1, 1, 20]) {
    const result = moveLane(lane, goal, dt);
    assert.ok(Math.abs(result) <= 5.2);
    assert.ok(Math.abs(result - lane) <= RULES.lateralSpeed * dt + 1e-9);
    assert.ok(result >= Math.min(lane, goal) && result <= Math.max(lane, goal));
  }
  assert.equal(moveLane(2, -2, -1), 2);
  const blockedLane = planLane(racer(), [racer(), racer('ahead', { total: 4 })], [], LENGTH, 0, 0);
  assert.ok(Math.abs(blockedLane) >= 1.9, 'clear a directly occupied corridor');
});

/** Headless simulation of the real tactics, pickup rules and CoastCircuit spline.
 * Five NPCs race a scripted player through the real 45-box course layout. This
 * checks simulation invariants, not browser rendering or GPU visuals. */
test('long seeded races keep five NPCs honest, atomic and on-track while using all three item types', (t) => {
  const used: Record<ItemKind, number> = { boost: 0, shield: 0, pulse: 0 };
  let totalPickups = 0, totalDistance = 0;
  for (const seed of [7, 211, 901, 0xdeadbeef]) {
    const rng = seeded(seed), dt = 1 / 30;
    const actors = Array.from({ length: 6 }, (_, i) => racer(i === 0 ? 'player' : `bot-${i - 1}`, {
      total: i === 0 ? 0 : 12 + Math.floor((i - 1) / 2) * 5.2,
      lateral: i === 0 ? -2 : (i % 2 ? -1 : 1) * 3.2,
      speed: MAX_SPEED * (.83 + i * .018), ...newBrain(i, i % 2 ? -3.2 : 3.2),
    }));
    const boxes = Array.from({ length: 15 }, (_, row) => [-4.2, 0, 4.2].map(lateral => box(45 + row * LENGTH / 15, lateral))).flat();
    boxes.forEach(b => resetPickup(b, rng));
    let racePickups = 0;
    for (let frame = 0; frame < 30 * 180; frame++) {
      const prior = actors.map(a => ({ total: a.total, lateral: a.lateral }));
      for (const pickup of boxes) advancePickup(pickup, dt, rng);
      for (const actor of actors) { tickEffects(actor, dt); tickBrain(actor, dt); }
      for (const [i, actor] of actors.entries()) {
        const now = sample(actor.total), next = sample(actor.total + 7);
        const bend = now.t.x * next.t.z - now.t.z * next.t.x;
        if (actor.decisionIn <= 0) {
          actor.targetLane = planLane(actor, actors, boxes, LENGTH, i, bend);
          actor.decisionIn = .18 + i * .013;
          const item = chooseItem(actor, actors, LENGTH, bend);
          if (item) {
            assert.ok(actor.pickups > actor.uses, 'cannot spend inventory that was never collected');
            assert.equal(actor.held, item); assert.equal(actor.reaction, 0); assert.equal(actor.cooldown, 0);
            const event = activateItem(actor, actors, LENGTH)!;
            actor.uses++; if (i > 0) used[event.item]++; actor.cooldown = RULES.cooldown;
            assert.equal(actor.held, null);
          }
        }
        actor.lateral = moveLane(actor.lateral, actor.targetLane, dt);
        actor.total += racingSpeed(actor, MAX_SPEED) * dt;
      }
      const activeBefore = boxes.filter(b => b.mesh.enabled && b.cool === 0).length;
      let frameClaims = 0;
      const contenders = actors.map((actor, i) => ({ actor, previous: prior[i].total, previousLane: prior[i].lateral,
        onPickup() { actor.pickups++; actor.reaction = RULES.reaction; frameClaims++; },
      }));
      // Reversing iteration regularly cannot bestow a fixed player/first-bot advantage.
      collectPickups(frame % 2 ? contenders : contenders.reverse(), boxes, LENGTH, rng);
      assert.equal(activeBefore - boxes.filter(b => b.mesh.enabled && b.cool === 0).length, frameClaims, 'one disabled box per award');
      racePickups += frameClaims;
      for (const [i, actor] of actors.entries()) {
        assert.equal(actor.pickups - actor.uses, actor.held ? 1 : 0, `${actor.id}: exact inventory budget`);
        assert.ok(Number.isFinite(actor.total) && Number.isFinite(actor.lateral));
        assert.ok(actor.total >= prior[i].total, 'NPCs never reverse to harvest a box');
        assert.ok(actor.total - prior[i].total <= MAX_SPEED * RULES.boostFactor * dt + 1e-9);
        assert.ok(Math.abs(actor.lateral) <= 5.2);
        assert.ok(Math.abs(actor.lateral - prior[i].lateral) <= RULES.lateralSpeed * dt + 1e-9);
        for (const key of ['boost', 'shield', 'slow'] as const) assert.ok(actor[key] >= 0 && actor[key] <= RULES[key], `${key}: bounded duration`);
        if (frame % 30 === 0) {
          const { p, t, n } = sample(actor.total, actor.lateral);
          for (const vector of [p, t, n]) for (const value of [vector.x, vector.y, vector.z]) assert.ok(Number.isFinite(value), 'valid world coordinates');
        }
      }
      for (const pickup of boxes) {
        assert.ok(pickup.cool >= 0 && pickup.cool <= PICKUP_RESPAWN_SECONDS);
        assert.equal(pickup.mesh.enabled, pickup.cool === 0, 'cooldown and visibility stay synchronized');
      }
    }
    assert.ok(racePickups > 30, `seed ${seed}: meaningful pickup traffic (${racePickups})`);
    for (const actor of actors.slice(1)) {
      assert.ok(actor.pickups >= 3, `seed ${seed}: ${actor.id} actually collected items`);
      assert.ok(actor.uses >= 2, `seed ${seed}: ${actor.id} actually used items`);
      assert.ok(actor.total > 3 * LENGTH, `seed ${seed}: ${actor.id} completed several laps`);
    }
    totalPickups += racePickups; totalDistance += actors.reduce((sum, a) => sum + a.total, 0);
  }
  for (const kind of kinds) assert.ok(used[kind] >= 10, `meaningful ${kind} use across races: ${used[kind]}`);
  assert.ok(totalPickups > 200); assert.ok(totalDistance > 100 * LENGTH);
  t.diagnostic(`Four 180-second seeded races: ${totalPickups} atomic pickups; NPC uses ${JSON.stringify(used)}; ${(totalDistance / LENGTH).toFixed(1)} cumulative laps`);
});
