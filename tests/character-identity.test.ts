import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CHARACTER_IDENTITIES,characterIdentity,characterDisplayName,characterEmblem} from '../src/character-identity.js';
import {CHARACTER_PROFILES,resolveCharacter} from '../src/character-profiles';
import {DRIVERS,raceOrder,getDriver} from '../src/driver-roster.js';
import {renderRaceResults,formatRaceResults} from '../src/race-shell';
const names=['大肥鱼','双子','小吉','克洛德','洛可','智谱'];
const ids=['whale','gemini','gpt','claude','grok','glm'];
test('one verified Chinese identity map covers both rosters without changing IDs or order',()=>{
 assert.deepEqual(Object.keys(CHARACTER_IDENTITIES),ids);
 assert.deepEqual(CHARACTER_PROFILES.map(p=>p.id),ids);
 assert.deepEqual(DRIVERS.map(p=>p.id),ids);
 assert.deepEqual(CHARACTER_PROFILES.map(p=>p.label),names);
 assert.deepEqual(DRIVERS.map(p=>p.label),names);
 for(const [i,id] of ids.entries()){
  assert.equal(characterDisplayName(id,'OLD ENGLISH'),names[i]);
  assert.equal(raceOrder(id)[0].id,id);
  assert.equal(resolveCharacter(id).id,id);
  assert.ok(Object.isFrozen(characterIdentity(id)));
 }
 assert.equal(getDriver('invalid').id,'whale');
 assert.equal(characterDisplayName('invalid'),'未知选手');
 assert.equal(characterIdentity('__proto__'),null);
 assert.equal(characterEmblem('constructor'), '');
});
test('all six transparent emblem files match original-sheet crop provenance',()=>{
 const manifest=JSON.parse(readFileSync('docs/character-emblems.json','utf8'));
 assert.deepEqual(manifest.emblems.map(e=>e.id),ids);
 assert.deepEqual(manifest.emblems.map(e=>e.label),names);
 for(const e of manifest.emblems){
  const file=readFileSync(`public/${e.path}`);
  assert.equal(file.subarray(1,4).toString(),'PNG');
  assert.equal(file.readUInt32BE(16),128);assert.equal(file.readUInt32BE(20),128);
  assert.ok([4,6].includes(file[25]),'PNG stores alpha');
  assert.equal(createHash('sha256').update(file).digest('hex'),e.sha256);
  assert.equal(CHARACTER_IDENTITIES[e.id].emblem,`./${e.path}`);
  assert.equal(e.sourceSha256.length,64);
  assert.ok(e.crop.x>1280&&e.crop.y<40&&e.crop.y+e.crop.height<180);
 }
});
test('emblems use Chinese accessible names only when not adjacent to visible names',()=>{
 for(const [i,id] of ids.entries()){
  assert.match(characterEmblem(id),/alt="" aria-hidden="true"/);
  assert.ok(characterEmblem(id,false).includes(`alt="${names[i]}纹章"`));
  assert.doesNotMatch(characterEmblem(id),/onerror|<svg/);
 }
});
test('results always honor sheet names even with old labels, while preserving standings and escaping unknown labels',()=>{
 const snapshot={rank:3,elapsed:123,selectedDriverId:'gpt',trackLength:100,laps:3,racers:ids.map((id,i)=>({id,label:id.toUpperCase(),finishedAt:i<4?100+i:null,total:280-i}))};
 const text=formatRaceResults(snapshot),html=renderRaceResults(snapshot);
 for(const name of names){assert.ok(text.includes(name));assert.ok(html.includes(name));}
 for(const id of ids){assert.ok(html.includes(`data-racer-id="${id}"`));assert.doesNotMatch(text,new RegExp(id.toUpperCase()));}
 assert.equal((html.match(/class="character-emblem"/g)||[]).length,6);
 assert.match(text,/小吉（你）/);
 const unknown=renderRaceResults({...snapshot,racers:[{id:'other',label:'<script>alert(1)</script>',finishedAt:null,total:2}]});
 assert.ok(unknown.includes('&lt;script&gt;'));assert.ok(!unknown.includes('<script>'));
});
test('menu, garage, selector, HUD and results share emblems; every entry loads emblem styling',()=>{
 for(const file of ['src/menu.ts','src/kart-garage.ts','src/game.ts','src/race-shell.ts']){
  const code=readFileSync(file,'utf8');assert.ok(code.includes('characterEmblem('),file);assert.doesNotMatch(code,/\$\{(?:c|driver)\.symbol\}/);
 }
 for(const page of ['index.html','garage.html','coast.html','waterpark.html'])assert.ok(readFileSync(page,'utf8').includes('/src/character-emblems.css'),page);
 assert.ok(readFileSync('src/game.ts','utf8').includes("shell.updateNavigation(mapId,selectedDriverId)"),'shared land selector refreshes the selected HUD identity for the active map');
 const coast=readFileSync('coast.html','utf8');
 for(const [i,id] of ids.entries())assert.match(coast,new RegExp(`id="slot-${id}"[^>]*>[^<]*${names[i]}`));
});
