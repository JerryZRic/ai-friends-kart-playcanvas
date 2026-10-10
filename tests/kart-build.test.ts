import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  KART_SLOTS, catalog, parts, partsBySlot, themes, getPart, defaultBuild, starterBuilds,
  validateBuild, resolveBuild, buildParts, buildStats, buildPerformance, kartTuning, compileKartBuild,
  defaultGarageState, parseGarageState, loadGarageState, saveGarageState, GARAGE_STORAGE_KEY,
  MAX_NAMED_BUILDS, MAX_BUILD_NAME_LENGTH, VEHICLE_CLAMPS,
  type KartBuild, type GarageState,
} from '../src/kart-build';
import {CHARACTER_PROFILES, characterTuning} from '../src/character-profiles';

const close = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
function sameTheme(number: number): KartBuild {
  return Object.fromEntries(KART_SLOTS.map(slot => [slot, partsBySlot[slot].find(part => part.kitNumber === number)!.id])) as KartBuild;
}
function assertBounds(build: KartBuild) {
  const stats = buildStats(build);
  for (const [key, range] of Object.entries(VEHICLE_CLAMPS)) {
    assert.ok(stats.multipliers[key] >= range[0] && stats.multipliers[key] <= range[1], `${key} bounded`);
  }
  for (const [key, value] of Object.entries(stats)) {
    if (key === 'multipliers' || value === null) continue;
    assert.ok(typeof value === 'number' && Number.isFinite(value) && value > 0, `${key} positive and finite`);
  }
}

test('frozen catalog contains exactly 55 complete themes / 330 exact slot identities', () => {
  assert.equal(catalog, parts); assert.equal(catalog.length, 330); assert.equal(themes.length, 55);
  assert.equal(new Set(catalog.map(part => part.id)).size, 330);
  assert.equal(new Set(themes.map(theme => theme.id)).size, 55);
  for (const slot of KART_SLOTS) {
    assert.equal(partsBySlot[slot].length, 55);
    assert.equal(new Set(partsBySlot[slot].map(part => part.archetypeId)).size, 6);
    for (const part of partsBySlot[slot]) {
      assert.equal(part.slot, slot); assert.equal(part.id, part.partId); assert.equal(part.kitId, part.themeId);
      assert.equal(part.id, `kit${String(part.kitNumber).padStart(3, '0')}::${part.moduleId}`);
      assert.equal(part.assetFilename, `${part.moduleId}.glb`);
      assert.ok(part.themeName.length); assert.ok(part.archetypeLabel.length); assert.ok(part.name.includes(part.themeName));
      assert.ok(Object.isFrozen(part)); assert.ok(Object.isFrozen(part.physicalDesign));
      assert.equal(getPart(part.id), part); assertBounds({...defaultBuild, [slot]: part.id});
    }
  }
  for (let kit = 0; kit <= 54; kit++) assert.equal(validateBuild(sameTheme(kit)), true);
  const payload = readFileSync(new URL('../src/kart-catalog.json', import.meta.url), 'utf8');
  assert.equal(/libfile_|source_library|\/workspace\/|asset_evidence|manifest_reference/.test(payload), false);
});

test('baseline is mixed, fresh, and preserves every original character coefficient', () => {
  assert.equal(new Set(Object.values(buildParts(defaultBuild)).map(part => part.kitId)).size, 6);
  assert.deepEqual(buildStats(defaultBuild).multipliers, {acceleration: 1, speed: 1, handling: 1});
  assert.equal(buildStats(defaultBuild).massKg, 208);
  const expected = [
    ['whale', 1.06, .92, 1.02], ['gemini', .92, 1, 1.08], ['gpt', 1, 1, 1],
    ['claude', 1.08, .96, .96], ['grok', .96, 1.08, .96], ['glm', .94, 1.04, 1.02],
  ];
  assert.deepEqual(CHARACTER_PROFILES.map(p => [p.id, p.acceleration, p.topSpeed, p.steering]), expected);
  for (const character of CHARACTER_PROFILES) {
    const existing = characterTuning(character.id, 'coast'), actual = kartTuning(character.id, 'coast', defaultBuild);
    assert.equal(actual.maxSpeed, existing.maxSpeed); assert.equal(actual.acceleration, existing.acceleration); assert.equal(actual.steering, existing.steering);
    assert.deepEqual(actual.multipliers, existing.multipliers);
  }
});

test('six mixed presets reproduce the frozen design multipliers and all SI estimates', () => {
  const golden = [
    ['mixed_corner', .9274, .8899, 1.15, 194.05, 103.573, 1.276],
    ['mixed_straight', 1.04, 1.12, .85, 197.2, 139.238, .9312],
    ['mixed_launch', 1.1093, .88, 1.0366, 0, 0, 0],
    ['mixed_endurance', .8425, 1.0538, .9065, 0, 0, 0],
    ['mixed_guard', .8278, 1.0164, .9625, 0, 0, 0],
    ['mixed_agile', .9704, .9545, .9074, 0, 0, 0],
  ];
  const siGolden = [{"massKg":194.05,"launchAcceleration":7.1601,"accelerationIndex":5.1717,"topSpeedKph":103.573,"zeroTo50Seconds":1.98,"lateralGripG":1.276,"rollThresholdG":1.5591,"cruisePowerKw":2.0738,"cruiseMinutes":23.15,"batteryKwh":0.8,"drivePowerKw":18.819,"recoverySeconds":1.8,"wheelRpmCapKph":103.573},{"massKg":197.2,"launchAcceleration":6.6837,"accelerationIndex":5.7995,"topSpeedKph":139.238,"zeroTo50Seconds":2.12,"lateralGripG":0.9312,"rollThresholdG":1.2704,"cruisePowerKw":1.7454,"cruiseMinutes":34.38,"batteryKwh":1.0,"drivePowerKw":23.736,"recoverySeconds":1.4,"wheelRpmCapKph":139.238},{"massKg":203.6,"launchAcceleration":9.7408,"accelerationIndex":6.186,"topSpeedKph":92.389,"zeroTo50Seconds":1.54,"lateralGripG":1.1424,"rollThresholdG":1.4292,"cruisePowerKw":2.4848,"cruiseMinutes":27.77,"batteryKwh":1.15,"drivePowerKw":20.24,"recoverySeconds":1.2,"wheelRpmCapKph":92.389},{"massKg":213.65,"launchAcceleration":5.9692,"accelerationIndex":4.6979,"topSpeedKph":122.637,"zeroTo50Seconds":2.38,"lateralGripG":0.9991,"rollThresholdG":1.372,"cruisePowerKw":1.8555,"cruiseMinutes":53.35,"batteryKwh":1.65,"drivePowerKw":20.323,"recoverySeconds":1.4,"wheelRpmCapKph":122.637},{"massKg":236.05,"launchAcceleration":6.1672,"accelerationIndex":4.616,"topSpeedKph":118.289,"zeroTo50Seconds":2.31,"lateralGripG":1.0608,"rollThresholdG":1.4292,"cruisePowerKw":2.5396,"cruiseMinutes":28.35,"batteryKwh":1.2,"drivePowerKw":22.004,"recoverySeconds":1.2,"wheelRpmCapKph":118.289},{"massKg":178.2,"launchAcceleration":7.4119,"accelerationIndex":5.4114,"topSpeedKph":111.091,"zeroTo50Seconds":1.92,"lateralGripG":1.0,"rollThresholdG":1.225,"cruisePowerKw":2.1642,"cruiseMinutes":22.18,"batteryKwh":0.8,"drivePowerKw":19.019,"recoverySeconds":1.15,"wheelRpmCapKph":111.091}];
  assert.equal(starterBuilds.length, 6);
  for (const [index, preset] of starterBuilds.entries()) {
    assert.ok(validateBuild(preset.build)); assert.equal(preset.id, golden[index][0]);
    assert.equal(new Set(Object.values(buildParts(preset.build)).map(part => part.kitId)).size, 6);
    const stats = buildStats(preset.build), [, acceleration, speed, handling, mass, topSpeed, grip] = golden[index];
    assert.deepEqual(stats.multipliers, {acceleration, speed, handling});
    for (const [field, value] of Object.entries(siGolden[index])) assert.equal(stats[field], value, `${preset.id}.${field}`);
    for (const character of CHARACTER_PROFILES) {
      const original = characterTuning(character.id, 'coast'), tuned = kartTuning(character.id, 'coast', preset.build);
      close(tuned.acceleration, original.acceleration * Number(acceleration));
      close(tuned.maxSpeed, original.maxSpeed * Number(speed));
      close(tuned.steering, original.steering * Number(handling));
      close(tuned.acceleration, 18 * tuned.multipliers.acceleration);
      close(tuned.maxSpeed, 42 * tuned.multipliers.topSpeed);
      close(tuned.steering, 7 * tuned.multipliers.steering);
      assert.deepEqual(tuned.characterMultipliers, original.multipliers);
    }
  }
});

test('same-theme identity never changes performance: physical equivalents are identical', () => {
  const uniform = sameTheme(25), mixed = {...uniform,
    body: sameTheme(1).body, chassis: sameTheme(49).chassis,
    motor: sameTheme(7).motor, battery: sameTheme(43).battery,
  };
  assert.equal(new Set(Object.values(buildParts(uniform)).map(p => p.kitId)).size, 1);
  assert.equal(new Set(Object.values(buildParts(mixed)).map(p => p.kitId)).size, 5);
  assert.deepEqual(buildStats(uniform), buildStats(mixed));
});

test('all 46,656 six-archetype combinations and 2,000 full-catalog mixes stay finite and bounded', () => {
  for (let code = 0; code < 6 ** 6; code++) {
    let digits = code; const build = {...defaultBuild};
    for (const slot of KART_SLOTS) {build[slot] = partsBySlot[slot].filter(part => part.kitNumber > 0)[digits % 6].id; digits = Math.floor(digits / 6);}
    assertBounds(build);
  }
  let seed = 20261010;
  for (let count = 0; count < 2000; count++) {
    const build = {...defaultBuild};
    for (const slot of KART_SLOTS) {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; build[slot] = partsBySlot[slot][seed % partsBySlot[slot].length].id;}
    assertBounds(build);
  }
});

test('track strategy has distinct straight, launch and sharp-corner advantages', () => {
  const [corner, straight, launch] = starterBuilds;
  assert.ok(kartTuning('gpt', 'coast', straight.build).maxSpeed > kartTuning('gpt', 'coast', corner.build).maxSpeed);
  assert.ok(kartTuning('gpt', 'coast', launch.build).acceleration > kartTuning('gpt', 'coast', straight.build).acceleration);
  const curve = {speed: 30, grade: 0, curvature: .04};
  assert.ok(kartTuning('gpt', 'coast', corner.build, curve).maxSpeed > kartTuning('gpt', 'coast', straight.build, curve).maxSpeed);
  const hill = {speed: 0, grade: .12, curvature: 0};
  assert.ok(kartTuning('gpt', 'coast', launch.build, hill).acceleration > kartTuning('gpt', 'coast', straight.build, hill).acceleration);
  assert.ok(buildPerformance(launch.build, hill).gradeAcceleration < 0);
  assert.ok(buildPerformance(launch.build, {...hill, grade: -.12}).gradeAcceleration > 0);
  for (const preset of starterBuilds) for (const context of [curve, hill, {speed: 1e30, grade: 1e30, curvature: 1e30}, {speed: NaN, grade: Infinity, curvature: NaN}, {speed: -25, grade: -1e30, curvature: -1e30}]) {
    const performance = buildPerformance(preset.build, context);
    assert.ok(performance.accelerationMultiplier >= .8 && performance.accelerationMultiplier <= 1.2);
    assert.ok(performance.cornerSpeedScale >= .5 && performance.cornerSpeedScale <= 1);
    for (const value of Object.values(performance)) assert.ok(Number.isFinite(value));
    const tuning = kartTuning('claude', 'coast', preset.build, context);
    close(tuning.maxSpeed, 42 * tuning.multipliers.topSpeed); close(tuning.acceleration, 18 * tuning.multipliers.acceleration); close(tuning.steering, 7 * tuning.multipliers.steering);
  }
});

test('waterpark living mounts ignore every build and coast context', () => {
  for (const character of CHARACTER_PROFILES) for (const preset of starterBuilds) {
    const expected = characterTuning(character.id, 'waterpark');
    const actual = kartTuning(character.id, 'waterpark', preset.build, {speed: 100, curvature: .2, grade: .35});
    assert.equal(actual.maxSpeed, expected.maxSpeed); assert.equal(actual.acceleration, expected.acceleration); assert.equal(actual.steering, expected.steering);
    assert.deepEqual(actual.multipliers, expected.multipliers); assert.deepEqual(actual.buildMultipliers, {acceleration: 1, speed: 1, handling: 1});
  }
});

test('compiled race snapshots are immutable and reuse cached stats without changing after edits', () => {
  const mutable = {...defaultBuild}, first = compileKartBuild(mutable), second = compileKartBuild({...mutable});
  assert.equal(first, second); assert.deepEqual(first.stats, buildStats(mutable)); assert.ok(Object.isFrozen(first.build)); assert.ok(Object.isFrozen(first.stats));
  mutable.body = partsBySlot.body[0].id;
  assert.equal(first.build.body, defaultBuild.body); assert.notEqual(compileKartBuild(mutable), first);
  for (let i = 0; i < 200; i++) {
    const preset = starterBuilds[i % starterBuilds.length], context = {speed: i / 4, curvature: i / 10000, grade: -.05};
    const compiled = compileKartBuild(preset.build);
    assert.deepEqual(compiled.performance(context), buildPerformance(preset.build, context));
    assert.deepEqual(compiled.tuning('glm', 'coast', context), kartTuning('glm', 'coast', preset.build, context));
  }
});

test('invalid, misplaced and foreign part IDs cannot enter validated builds', () => {
  for (const invalid of [null, [], 'kit001', 17, {}, {...defaultBuild, body: defaultBuild.motor}, {...defaultBuild, body: 'https://example.test/a.glb'}, {...defaultBuild, body: 'kit999::01_BodyShell'}, {...defaultBuild, extra: 1}, Object.create(defaultBuild)]) assert.equal(validateBuild(invalid), false);
  assert.deepEqual(resolveBuild(null), defaultBuild);
  const edited = {...defaultBuild, body: partsBySlot.body[0].id, motor: defaultBuild.body};
  assert.deepEqual(resolveBuild(edited), {...defaultBuild, body: edited.body});
  assert.equal(getPart('__proto__'), undefined); assert.equal(getPart(null), undefined);
});

function fakeStorage(initial: string | null = null) {
  let value = initial, writes = 0;
  return {getItem(key: string) {assert.equal(key, GARAGE_STORAGE_KEY); return value;}, setItem(key: string, raw: string) {assert.equal(key, GARAGE_STORAGE_KEY); value = raw; writes++;}, get value() {return value;}, get writes() {return writes;}};
}
function namedState(): GarageState {
  return {version: 1, activeBuild: {...starterBuilds[0].build}, namedBuilds: starterBuilds.map(({id, name, build}) => ({id, name, build: {...build}}))};
}

test('garage round-trips active and named builds, with no external data or input aliasing', () => {
  const state = namedState(), storage = fakeStorage(); assert.equal(saveGarageState(state, storage), true); assert.equal(storage.writes, 1);
  const restored = loadGarageState(storage); assert.deepEqual(restored, state); assert.notEqual(restored.activeBuild, state.activeBuild); assert.notEqual(restored.namedBuilds[0].build, state.namedBuilds[0].build);
  assert.equal(storage.writes, 1, 'loading is read-only');
  assert.deepEqual(loadGarageState(null), defaultGarageState()); assert.equal(saveGarageState(state, null), false);
});

test('corrupt/unsupported JSON safely resets, and a corrupt entry never damages valid saved builds', () => {
  for (const raw of [null, undefined, 4, '', '{', 'null', '[]', '{}', '{"version":2}', 'x'.repeat(48001), JSON.stringify({...namedState(), surprise: true})]) assert.deepEqual(parseGarageState(raw), defaultGarageState());
  const state: any = namedState(); state.activeBuild = {...defaultBuild, wheels: defaultBuild.motor};
  state.namedBuilds.splice(1, 0, {id: 'bad-url', name: 'Injected', build: {...defaultBuild, body: 'https://example.test/a.glb'}});
  state.namedBuilds.push({...state.namedBuilds[0]}, {id: '__proto__', name: 'Bad', build: {...defaultBuild}});
  const restored = parseGarageState(JSON.stringify(state));
  assert.deepEqual(restored.activeBuild, defaultBuild); assert.equal(restored.namedBuilds.length, 6); assert.deepEqual(restored.namedBuilds.map(b => b.id), starterBuilds.map(b => b.id));
  assert.equal(({} as any).polluted, undefined);
  const storage = fakeStorage('{broken'); assert.deepEqual(loadGarageState(storage), defaultGarageState()); assert.equal(storage.value, '{broken'); assert.equal(storage.writes, 0);
});

test('saving is strict, bounded and atomic on invalid data or blocked browser storage', () => {
  const storage = fakeStorage('preserve');
  const invalids: any[] = [null, {}, {...namedState(), version: 2}, {...namedState(), activeBuild: {}}, {...namedState(), namedBuilds: [null]}, {...namedState(), namedBuilds: [namedState().namedBuilds[0], namedState().namedBuilds[0]]}];
  for (const name of ['', ' x', 'x ', 'x\nname', 'x'.repeat(MAX_BUILD_NAME_LENGTH + 1)]) invalids.push({...namedState(), namedBuilds: [{...namedState().namedBuilds[0], name}]});
  for (const id of ['', '__proto__', 'constructor.prototype', 'a/b', 'x'.repeat(65)]) invalids.push({...namedState(), namedBuilds: [{...namedState().namedBuilds[0], id}]});
  invalids.push({...namedState(), namedBuilds: Array.from({length: MAX_NAMED_BUILDS + 1}, (_, i) => ({id: `b${i}`, name: '车', build: {...defaultBuild}}))});
  for (const state of invalids) assert.equal(saveGarageState(state, storage), false);
  assert.equal(storage.writes, 0); assert.equal(storage.value, 'preserve');
  assert.deepEqual(loadGarageState({getItem() {throw new Error('SecurityError');}}), defaultGarageState());
  assert.equal(saveGarageState(namedState(), {setItem() {throw new Error('QuotaExceededError');}}), false);
  const maximum: GarageState = {version: 1, activeBuild: {...defaultBuild}, namedBuilds: Array.from({length: MAX_NAMED_BUILDS}, (_, i) => ({id: `b${i}`, name: '车'.repeat(MAX_BUILD_NAME_LENGTH), build: {...defaultBuild}}))};
  assert.equal(saveGarageState(maximum, storage), true); assert.deepEqual(loadGarageState(storage), maximum);
});
