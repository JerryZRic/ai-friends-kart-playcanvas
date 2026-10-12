import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {MAP_CATALOG, MAP_DISPLAY_CODES, MAP_MENU_ORDER} from '../src/map-presentation';
import {MAP_PROFILES, resolveMap} from '../src/map-profiles';
import {parseMenuState, menuQuery, raceEntry, garageEntry} from '../src/menu-state';
import {defaultBuild} from '../src/kart-build';
import {mountRaceLoadingUi} from '../src/race-loading-ui';

const expected = [
  ['coast', '01'], ['mountain', '02'], ['town', '03'], ['quarry', '04'],
  ['forest', '05'], ['workshop', '06'], ['harvest', '07'], ['desert', '08'],
  ['snow', '09'], ['caldera', '10'], ['garden', '11'], ['airfield', '12'],
  ['waterpark', 'A01'],
] as const;

test('13 explicit display identities put land 01–12 before water A01', () => {
  assert.deepEqual(MAP_CATALOG.map(map => [map.id, map.displayCode]), expected);
  assert.deepEqual(MAP_MENU_ORDER, expected.map(([id]) => id));
  assert.deepEqual(Object.keys(MAP_DISPLAY_CODES).sort(), Object.keys(MAP_PROFILES).sort());
  assert.deepEqual([...MAP_MENU_ORDER].sort(), Object.keys(MAP_PROFILES).sort());
  assert.equal(new Set(MAP_MENU_ORDER).size, 13);
  assert.equal(new Set(Object.values(MAP_DISPLAY_CODES)).size, 13);
  for (const value of [MAP_CATALOG, MAP_MENU_ORDER, MAP_DISPLAY_CODES, ...MAP_CATALOG]) assert.ok(Object.isFrozen(value));
  for (const [id, code] of expected) {
    assert.equal(MAP_DISPLAY_CODES[id], code);
    const {displayCode, ...profile} = MAP_CATALOG.find(map => map.id === id)!;
    assert.equal(displayCode, code);
    assert.deepEqual(profile, MAP_PROFILES[id], id + ' preserves every original profile field');
  }
  assert.deepEqual(Object.keys(MAP_PROFILES), ['coast', 'waterpark', 'mountain', 'town', 'quarry', 'forest', 'workshop', 'harvest', 'desert', 'snow', 'caldera', 'garden', 'airfield'], 'runtime profile insertion order is unchanged');
});

test('display codes never replace IDs in existing deep links, settings returns or race URLs', () => {
  const kart = JSON.stringify(defaultBuild);
  for (const [id, code] of expected) {
    const state = parseMenuState('?screen=maps&map=' + id + '&driver=claude&difficulty=hard&seed=91&kart=' + encodeURIComponent(kart));
    assert.equal(state.map, id);
    for (const screen of ['maps', 'characters', 'vehicles', 'race-settings', 'settings'] as const) {
      const next = {...state, screen, returnTo: 'race-settings' as const};
      const roundTrip = parseMenuState(menuQuery(next));
      assert.equal(roundTrip.map, id); assert.equal(roundTrip.driver, 'claude');
      assert.equal(roundTrip.kart, kart); assert.equal(roundTrip.difficulty, 'hard'); assert.equal(roundTrip.seed, 91);
      if (screen === 'settings') assert.equal(roundTrip.returnTo, 'race-settings');
      assert.equal(new URLSearchParams(menuQuery(next)).get('map'), id);
    }
    const race = new URL(raceEntry(id, state.driver, state), 'https://test.invalid/dev/');
    assert.equal(race.pathname, id === 'waterpark' ? '/dev/waterpark.html' : '/dev/coast.html');
    assert.equal(race.searchParams.get('map'), id === 'coast' || id === 'waterpark' ? null : id);
    assert.equal(race.searchParams.get('kart'), id === 'waterpark' ? null : kart);
    assert.equal(race.searchParams.get('driver'), 'claude');
    assert.equal(race.searchParams.get('difficulty'), 'hard'); assert.equal(race.searchParams.get('seed'), '91');
    if (id !== 'waterpark') assert.equal(new URL(garageEntry(state.driver, state), 'https://test.invalid/dev/').searchParams.get('map'), id);
    assert.equal(resolveMap(code).id, 'coast', 'presentation codes are not new route aliases');
    assert.equal(parseMenuState('?screen=maps&map=' + code).map, 'coast');
  }
});

test('loading retains the same unnumbered names and tags for every course', () => {
  for (const [id] of expected) {
    const elements = new Map<string, {textContent: string}>();
    const host = {set innerHTML(html: string) {
      for (const match of html.matchAll(/id="([^"]+)"/g)) elements.set(match[1], {textContent: ''});
    }};
    const doc = {getElementById: (name: string) => name === 'raceLoading' ? host : elements.get(name)} as unknown as Document;
    mountRaceLoadingUi(doc, id);
    assert.equal(elements.get('loadingMapName')!.textContent, MAP_PROFILES[id].label);
    assert.equal(elements.get('loadingMapTag')!.textContent, MAP_PROFILES[id].tag);
  }
});

test('identity, routing, saved settings and loading sources retain exact pre-presentation bytes', () => {
  const hashes = {
    'src/map-profiles.ts': 'ca3c81e08883d36bbb2c73c8e17e8920e61c5e6ea23b26e0f3b7ace574b3a911',
    'src/menu-state.ts': '7b0be5d8766b8ac28b8191fa7b5b94eb89c33d8c54aac55bb92049bd311c7ec5',
    'src/game-settings.ts': 'cd2cef0d1531393e7290bff1766f2988a3f95d8fe0535fc086bb989d4bf50730',
    'src/race-loading-ui.ts': 'cfbe96cebd69b1d7727be6c2ede0772f42dbc51c2fd315657b5e713caf32dd33',
  };
  for (const [path, hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), hash, path);
});
