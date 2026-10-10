import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_PROFILES, characterTuning } from '../src/character-profiles';
import { defaultBuild, starterBuilds, defaultGarageState, GARAGE_STORAGE_KEY, KART_SLOTS, kartTuning, type KartBuild } from '../src/kart-build';
import { raceKartBuild, buildForRacer, raceKartTuning, createRaceKartTuning, kartBuildKey, kartRoadContext } from '../src/kart-race';
import { sample, LENGTH } from '../src/track';

const saved = starterBuilds.find(entry => entry.id === 'mixed_straight')!.build;
const fromUrl = starterBuilds.find(entry => entry.id === 'mixed_corner')!.build;
const query = (value: unknown) => '?driver=whale&kart=' + encodeURIComponent(JSON.stringify(value));
function withStorage(getItem: (key: string) => string | null, check: () => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {getItem, setItem() {assert.fail('race selection must never write storage');}}});
  try {check();} finally {if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete (globalThis as any).localStorage;}
}

test('race URL snapshots override saved builds and are copied before use', () => {
  const result = raceKartBuild(query(fromUrl), saved);
  assert.deepEqual(result, fromUrl); assert.notEqual(result, fromUrl);
  result.body = defaultBuild.body; assert.equal(fromUrl.body, starterBuilds[0].build.body);
  assert.deepEqual(raceKartBuild('?driver=gpt', saved), saved);
  assert.deepEqual(raceKartBuild('?kart=', saved), saved);
  withStorage(() => {throw new DOMException('blocked', 'SecurityError');}, () => {
    assert.deepEqual(raceKartBuild(query(fromUrl)), fromUrl, 'URL launch still works when storage is denied');
    assert.deepEqual(raceKartBuild(''), defaultBuild, 'denied storage falls back to the balanced six-slot build');
  });
});

test('invalid, foreign, partial, oversized and extra-key URL builds retain the valid saved selection', () => {
  const invalid = [null, [], 'build', {}, {body: fromUrl.body}, {...fromUrl, wheels: fromUrl.body}, {...fromUrl, body: 'https://example.invalid/model.glb'}, {...fromUrl, multiplier: 999}, {...fromUrl, version: 2}, JSON.parse('{"__proto__":{},' + JSON.stringify(fromUrl).slice(1))];
  for (const value of invalid) assert.deepEqual(raceKartBuild(query(value), saved), saved);
  for (const value of ['{', 'undefined', JSON.stringify(fromUrl) + ' '.repeat(2049)])
    assert.deepEqual(raceKartBuild('?kart=' + encodeURIComponent(value), saved), saved);
  assert.deepEqual(raceKartBuild(query(fromUrl) + '&kart=' + encodeURIComponent(JSON.stringify(saved)), saved), fromUrl, 'URLSearchParams uses the first snapshot deterministically');
});

test('race reads the real versioned garage key and safely handles damaged browser storage', () => {
  const reads: string[] = [];
  withStorage(key => {reads.push(key); return JSON.stringify({...defaultGarageState(), activeBuild: saved});}, () => {
    assert.deepEqual(raceKartBuild('?kart=not-json'), saved);
    assert.deepEqual(reads, [GARAGE_STORAGE_KEY]);
  });
  for (const raw of [null, '{', JSON.stringify({...defaultGarageState(), version: 2}), JSON.stringify({...defaultGarageState(), activeBuild: {...saved, battery: saved.body}})])
    withStorage(() => raw, () => assert.deepEqual(raceKartBuild(''), defaultBuild));
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, get() {throw new DOMException('blocked', 'SecurityError');}});
    assert.deepEqual(raceKartBuild(''), defaultBuild);
  } finally {if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete (globalThis as any).localStorage;}
});

test('active build follows the selected player while every opponent keeps the baseline six slots', () => {
  for (const selected of CHARACTER_PROFILES) for (const racer of CHARACTER_PROFILES) {
    const expected = racer.id === selected.id ? saved : defaultBuild;
    assert.deepEqual(buildForRacer(racer.id, selected.id, saved), expected);
    assert.deepEqual(raceKartTuning(racer.id, selected.id, saved), kartTuning(racer.id, 'coast', expected));
    if (racer.id !== selected.id) {
      const tuning = raceKartTuning(racer.id, selected.id, saved), legacy = characterTuning(racer.id, 'coast');
      assert.equal(tuning.acceleration, legacy.acceleration); assert.equal(tuning.maxSpeed, legacy.maxSpeed); assert.equal(tuning.steering, legacy.steering);
    }
  }
  assert.equal(kartBuildKey(saved), KART_SLOTS.map(slot => saved[slot]).join('|'));
  for (const slot of KART_SLOTS) assert.notEqual(kartBuildKey({...saved, [slot]: defaultBuild[slot]}), kartBuildKey(saved));
});

test('compiled race tuning snapshots build selection and applies identical road conditions to player and NPC', () => {
  const mutable: KartBuild = {...saved}, tune = createRaceKartTuning(mutable);
  mutable.motor = defaultBuild.motor;
  for (const selected of CHARACTER_PROFILES) for (const racer of CHARACTER_PROFILES) {
    for (const context of [{speed: 0, grade: 0, curvature: 0}, {speed: 24, grade: .12, curvature: -.02}, {speed: 30, grade: -.1, curvature: .05}])
      assert.deepEqual(tune(racer.id, selected.id, context), kartTuning(racer.id, 'coast', racer.id === selected.id ? saved : defaultBuild, context));
  }
  const corner = createRaceKartTuning(fromUrl), straight = createRaceKartTuning(saved);
  assert.ok(straight('whale', 'whale', {curvature: 0}).maxSpeed > corner('whale', 'whale', {curvature: 0}).maxSpeed);
  assert.ok(corner('whale', 'whale', {curvature: .05}).maxSpeed > straight('whale', 'whale', {curvature: .05}).maxSpeed, 'tight turns reward measured grip over long gearing');
});

test('road context uses signed rise/run and wrapped horizontal heading change per metre', () => {
  const flat = kartRoadContext(10, 22, () => ({t: {x: 0, y: 0, z: 1}}));
  assert.deepEqual(flat, {speed: 22, grade: 0, curvature: 0});
  const theta = .21, make = (sign: number) => (distance: number) => ({t: {x: -Math.sin(sign * distance * theta / 7), y: sign * .12, z: Math.cos(sign * distance * theta / 7)}});
  const left = kartRoadContext(0, 25, make(1)), right = kartRoadContext(0, 25, make(-1));
  assert.ok(Math.abs(left.grade! - .12) < 1e-12); assert.ok(Math.abs(left.curvature! - .03) < 1e-12);
  assert.equal(right.grade, -left.grade); assert.equal(right.curvature, -left.curvature);
  for (const distance of [-7, 0, 120, 533, LENGTH - .001, LENGTH, LENGTH + 7]) {
    const context = kartRoadContext(distance, 30, sample), repeat = kartRoadContext(distance + LENGTH, 30, sample);
    assert.ok(Object.values(context).every(Number.isFinite));
    assert.ok(Math.abs(context.grade! - repeat.grade!) < 1e-6);
    assert.ok(Math.abs(context.curvature! - repeat.curvature!) < 1e-6);
  }
});
