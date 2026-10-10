import test from 'node:test';
import assert from 'node:assert/strict';
import {kartPresets,getNpcPresets,NPC_THEME_BUDGET} from '../src/kart-presets';
import {buildStats,buildParts,KART_SLOTS,validateBuild,kartTuning,VEHICLE_CLAMPS,defaultGarageState,saveGarageState,loadGarageState} from '../src/kart-build';
import {CHARACTER_PROFILES} from '../src/character-profiles';

test('five authored roles are freely editable authentic mixed builds, not power tiers',()=>{
 assert.deepEqual(kartPresets.map(p=>p.id),['balanced','corner','straight','start-hill','impact']);
 for(const p of kartPresets){assert.ok(validateBuild(p.build));assert.ok(new Set(Object.values(buildParts(p.build)).map(x=>x.kitId)).size>1);assert.ok(Object.isFrozen(p.build));}
 const [balanced,corner,straight,hill,impact]=kartPresets.map(p=>buildStats(p.build));
 assert.ok(corner.handlingMultiplier>balanced.handlingMultiplier && corner.speedMultiplier<balanced.speedMultiplier);
 assert.ok(straight.speedMultiplier>balanced.speedMultiplier && straight.handlingMultiplier<balanced.handlingMultiplier);
 assert.ok(hill.accelerationMultiplier>balanced.accelerationMultiplier && hill.speedMultiplier<balanced.speedMultiplier);
 assert.ok(impact.handlingMultiplier>balanced.handlingMultiplier && impact.massKg>balanced.massKg && impact.speedMultiplier<balanced.speedMultiplier);
 assert.match(kartPresets[4].description,/尚未启用/);
});
test('NPC recipe selection is reproducible, covers six characters and bounds archives',()=>{
 for(const seed of [0,1,20261010,4294967295,-1,NaN,Infinity]){
  const recipes=getNpcPresets('coast',seed);assert.equal(recipes.length,6);assert.deepEqual(recipes,getNpcPresets('coast',seed));
  assert.deepEqual(recipes.map(p=>p.characterId),CHARACTER_PROFILES.map(p=>p.id));
  const kits=new Set(recipes.flatMap(p=>Object.values(buildParts(p.build)).map(part=>part.kitId)));assert.ok(kits.size<=NPC_THEME_BUDGET);
  for(const p of recipes)assert.ok(kartPresets.some(authored=>authored.build===p.build));
 }
 assert.deepEqual(getNpcPresets('waterpark',1),[]);
});
test('every preset composes existing character identity and shared clamps',()=>{
 for(const p of kartPresets)for(const c of CHARACTER_PROFILES){
  const t=kartTuning(c.id,'coast',p.build);
  assert.equal(t.maxSpeed,42*c.topSpeed*t.buildMultipliers.speed);
  assert.equal(t.acceleration,18*c.acceleration*t.buildMultipliers.acceleration);
  assert.equal(t.steering,7*c.steering*t.buildMultipliers.handling);
  for(const [name,range] of Object.entries(VEHICLE_CLAMPS))assert.ok(t.buildMultipliers[name]>=range[0]&&t.buildMultipliers[name]<=range[1]);
  assert.equal(kartTuning(c.id,'waterpark',p.build).maxSpeed,22*c.topSpeed);
 }
});
test('saved cars remain six part IDs plus name independent of character selection',()=>{
 const state=defaultGarageState();state.activeBuild={...kartPresets[2].build};state.namedBuilds=[{id:'my-straight',name:'我的直线车',build:{...state.activeBuild}}];
 let raw='';assert.equal(saveGarageState(state,{setItem(_key,value){raw=value}}),true);
 const restored=loadGarageState({getItem(){return raw}});assert.deepEqual(restored,state);assert.ok(!raw.includes('driver'));assert.ok(!raw.includes('character'));
 assert.deepEqual(Object.keys(restored.namedBuilds[0].build),[...KART_SLOTS]);
 assert.notEqual(kartTuning('whale','coast',restored.activeBuild).maxSpeed,kartTuning('grok','coast',restored.activeBuild).maxSpeed);
 assert.deepEqual(restored.activeBuild,state.activeBuild);
});
