import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {garageRaceEntry, garageBackEntry, garageInitialBuild, garageCombinedStats, filterGarageParts} from '../src/kart-garage';
import {catalog, defaultBuild, KART_SLOTS, loadGarageState, saveGarageState, defaultGarageState, type KartBuild} from '../src/kart-build';
import {kartPresets} from '../src/kart-presets';
const parse = (path: string) => new URL(path, 'https://example.com/dev/');
const mixed: KartBuild = {...defaultBuild, body: catalog.find(p => p.slot === 'body')!.id};
test('free garage completion goes to settings, preserves setup, and never autostarts', () => {
  for (const driver of ['gpt', 'glm', 'claude']) {
    const url = parse(garageRaceEntry(driver, mixed, '?flow=free&difficulty=hard&seed=34'));
    assert.equal(url.pathname, '/dev/index.html');
    for (const [key, value] of Object.entries({flow:'free',screen:'race-settings',map:'coast',driver,difficulty:'hard',seed:'34'})) assert.equal(url.searchParams.get(key), value);
    assert.equal(url.searchParams.has('autostart'), false);
    assert.deepEqual(JSON.parse(url.searchParams.get('kart')!), mixed);
  }
});
test('back, driver changes and repeated garage entry retain the six-part vehicle and setup', () => {
  const back = parse(garageBackEntry('gpt', mixed, '?flow=free&difficulty=easy&seed=0'));
  assert.equal(back.searchParams.get('screen'), 'characters');
  assert.equal(back.searchParams.get('flow'), 'free');
  const build = garageInitialBuild(back.search, defaultBuild);
  for (let repeat = 0; repeat < 4; repeat++) {
    const next = parse(garageRaceEntry('grok', build, back.search));
    assert.equal(next.searchParams.get('difficulty'), 'easy'); assert.equal(next.searchParams.get('seed'), '0');
    assert.deepEqual(garageInitialBuild(next.search, defaultBuild), mixed);
  }
  assert.notEqual(garageCombinedStats('grok', mixed).speed, garageCombinedStats('gpt', mixed).speed);
  assert.equal(garageCombinedStats('grok', mixed).stability, garageCombinedStats('gpt', mixed).stability);
});
test('standalone entry remains a direct coast test and malformed URL cannot replace saved build', () => {
  const url = parse(garageRaceEntry('glm', mixed));
  assert.equal(url.pathname, '/dev/coast.html'); assert.equal(url.searchParams.get('autostart'), '1');
  for (const raw of ['{', '{}', JSON.stringify({...mixed, motor:mixed.body}), 'x'.repeat(5000)]) assert.deepEqual(garageInitialBuild('?kart='+encodeURIComponent(raw), mixed), mixed);
});
test('corrupt or blocked storage is recoverable; named builds never bind a driver', () => {
  assert.deepEqual(loadGarageState({getItem(){throw new Error('blocked');}}), defaultGarageState());
  assert.deepEqual(loadGarageState({getItem(){return '{';}}), defaultGarageState());
  const state = defaultGarageState(); state.activeBuild = mixed; state.namedBuilds = [{id:'my-car', name:'我的搭配', build:mixed}];
  assert.equal(saveGarageState(state, {setItem(){throw new Error('blocked');}}), false);
  let saved = ''; assert.equal(saveGarageState(state, {setItem(_key, value){saved=value;}}), true);
  assert.equal(saved.includes('driver'), false);
  assert.deepEqual(loadGarageState({getItem(){return saved;}}), state);
  assert.deepEqual(JSON.parse(parse(garageRaceEntry('gemini', mixed, '?flow=free')).searchParams.get('kart')!), mixed);
});
test('five editable tradeoff presets and all 324 parts remain freely available', () => {
  assert.deepEqual(kartPresets.map(p=>p.id), ['balanced','corner','straight','start-hill','impact']);
  assert.equal(KART_SLOTS.reduce((n, slot)=>n+filterGarageParts(slot, '', '').length, 0),324);
  const source = readFileSync('src/kart-garage.ts','utf8');
  assert.match(source,/data-starter/); assert.match(source,/applyBuild\(\{\.\.\.state.activeBuild/);
  assert.match(source,/电池容量（消耗未启用）/); assert.match(source,/耐久损耗/); assert.match(source,/无当前优势/);
  assert.match(source,/抗侧翻未启用/); assert.match(source,/风阻面积 CdA/); assert.match(source,/终传齿比/);
});
test('repeat mounts and page exit cancel old work; stale preview responses are disposed', () => {
  const source = readFileSync('src/kart-garage.ts','utf8');
  assert.match(source,/mountedGarages.get\(root\)\?\.\(\)/);
  assert.match(source,/signal: events.signal/); assert.match(source,/events.abort\(\)/);
  assert.match(source,/thumbnailAbort.abort\(\)/);
  assert.match(source,/if \(disposed \|\| thisVersion !== version\) \{next.dispose\(\); return;\}/);
  assert.match(source,/controller\?\.abort\(\)/);
});

test('saving, editing, and reloading a named build updates its ID without duplicates', async () => {
  const {upsertGarageNamedBuild} = await import('../src/kart-garage');
  const initial = defaultGarageState(); initial.activeBuild = mixed;
  const created = upsertGarageNamedBuild(initial, 'First car', null, 'car-1');
  assert.equal(created.ok, true); if (!created.ok) return;
  assert.equal(created.state.namedBuilds.length, 1);
  const updated = upsertGarageNamedBuild({...created.state, activeBuild:{...defaultBuild}}, 'Renamed car', created.id, 'unused-id');
  assert.equal(updated.ok, true); if (!updated.ok) return;
  assert.equal(updated.id, 'car-1'); assert.equal(updated.state.namedBuilds.length,1);
  assert.equal(updated.state.namedBuilds[0].name, 'Renamed car');
  assert.deepEqual(updated.state.namedBuilds[0].build, defaultBuild);
  let raw = ''; assert.equal(saveGarageState(updated.state, {setItem(_key,value){raw=value;}}), true);
  const reloaded = loadGarageState({getItem(){return raw;}});
  assert.deepEqual(reloaded.namedBuilds, updated.state.namedBuilds);
  const copy = upsertGarageNamedBuild(reloaded, 'Copy', null, 'car-2');
  assert.equal(copy.ok, true); if (copy.ok) assert.deepEqual(copy.state.namedBuilds.map(entry=>entry.id), ['car-1','car-2']);
  assert.equal(saveGarageState(updated.state,{setItem(){throw new Error('quota');}}),false);
  const source = readFileSync('src/kart-garage.ts','utf8');
  assert.match(source,/此浏览器无法保存/); assert.match(source,/id="save-as-new"/); assert.match(source,/更新方案/);
  assert.match(source,/editingId === target.dataset.deleteBuild/); assert.match(source,/input.value = name/);
  assert.match(source,/id="build-description"/); assert.match(source,/textContent = description/);
});

test('edit refresh and settings-back history use the latest build instead of a stale URL snapshot', async () => {
  const {replaceGarageBuildUrl} = await import('../src/kart-garage');
  const original = new URL('https://example.com/dev/garage.html?flow=free&map=coast&driver=gpt&difficulty=hard&seed=77#parts');
  original.searchParams.set('kart', JSON.stringify(defaultBuild));
  const state = {menuEntry:true}; let current = original, writes = 0;
  const navigation = {state, replaceState(data:unknown, _unused:string, next?:string|URL|null) {
    assert.equal(data,state); writes++; current = new URL(String(next), current);
  }};
  assert.equal(replaceGarageBuildUrl(mixed, current, navigation), true);
  assert.equal(writes,1); assert.equal(current.pathname,original.pathname); assert.equal(current.hash,'#parts');
  for (const key of ['flow','map','driver','difficulty','seed']) assert.equal(current.searchParams.get(key),original.searchParams.get(key));
  // Refresh uses the updated URL even if storage was blocked or older.
  assert.deepEqual(garageInitialBuild(current.search,defaultBuild),mixed);
  const settings = parse(garageRaceEntry('gpt', mixed, current.search));
  assert.deepEqual(garageInitialBuild(settings.search,defaultBuild),mixed);
  // Browser Back restores this same replaced garage entry, not the entry's old A snapshot.
  assert.deepEqual(garageInitialBuild(current.search,defaultBuild),mixed);
  assert.equal(replaceGarageBuildUrl(defaultBuild,current,navigation),true);
  assert.deepEqual(garageInitialBuild(current.search,mixed),defaultBuild);
  assert.equal(replaceGarageBuildUrl(mixed,current,{state:null,replaceState(){throw new Error('sandbox');}}),false);
  assert.match(readFileSync('src/kart-garage.ts','utf8'),/replaceGarageBuildUrl\(state.activeBuild, location, history\)/);
});
