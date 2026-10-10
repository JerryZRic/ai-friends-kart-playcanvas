import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRaceOptions,raceOptionsQuery,DEFAULT_RACE_OPTIONS} from '../src/race-options';
import {parseMenuState,menuQuery,garageEntry,raceEntry} from '../src/menu-state';
import {defaultBuild} from '../src/kart-build';
test('difficulty and deterministic seed sanitize legacy and corrupt URLs',()=>{
 for(const query of ['', '?difficulty=extreme&seed=NaN','?difficulty=<script>&seed=-4','?seed=4294967296','?seed=1.5','?seed=Infinity','?seed='])assert.deepEqual(parseRaceOptions(query),DEFAULT_RACE_OPTIONS);
 for(const difficulty of ['easy','normal','hard'] as const)for(const seed of [0,20261010,4294967295])assert.deepEqual(parseRaceOptions(raceOptionsQuery({difficulty,seed})),{difficulty,seed});
});
test('map character garage graphics settings and race links retain independent setup',()=>{
 const kart=JSON.stringify(defaultBuild);
 const setup=parseMenuState('?screen=characters&map=coast&driver=gpt&difficulty=hard&seed=77&kart='+encodeURIComponent(kart));
 for(const screen of ['main','maps','characters','vehicles','race-settings','settings'] as const){
  const restored=parseMenuState(menuQuery({...setup,screen,returnTo:'race-settings'}));
  assert.equal(restored.driver,'gpt');assert.equal(restored.kart,kart);assert.equal(restored.seed,77);assert.equal(restored.difficulty,'hard');
  if(screen==='settings')assert.equal(restored.returnTo,'race-settings');
 }
 const garage=new URL(garageEntry('glm',setup),'https://test.invalid');
 assert.equal(garage.searchParams.get('flow'),'free');assert.equal(garage.searchParams.get('driver'),'glm');assert.equal(garage.searchParams.get('kart'),kart);
 const race=new URL(raceEntry('coast','glm',setup),'https://test.invalid');
 assert.equal(race.searchParams.get('kart'),kart);assert.equal(race.searchParams.get('difficulty'),'hard');assert.equal(race.searchParams.get('seed'),'77');
 const water=new URL(raceEntry('waterpark','glm',setup),'https://test.invalid');assert.equal(water.searchParams.has('kart'),false);assert.equal(water.searchParams.get('difficulty'),'hard');
});
test('invalid build payloads are removed and legacy direct entry remains compatible',()=>{
 for(const kart of ['{','null','[]','{"body":"unknown"}','x'.repeat(5000)]){
  const state=parseMenuState('?screen=race-settings&kart='+encodeURIComponent(kart));assert.equal(state.kart,undefined);assert.equal(new URLSearchParams(menuQuery(state)).has('kart'),false);
 }
 assert.equal(raceEntry('coast','grok'),'./coast.html?driver=grok&autostart=1');
 assert.equal(garageEntry('grok'),'./garage.html?driver=grok');
});
