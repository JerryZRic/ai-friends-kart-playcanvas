import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTER_PROFILES,characterTuning,WATER_CHARACTER_MULTIPLIERS} from '../src/character-profiles';
import {compileKartBuild,defaultBuild} from '../src/kart-build';
import {stepRaceKartSpeed} from '../src/kart-race';
import {moveLane} from '../src/npc-tactics';
const compiled=compileKartBuild(defaultBuild);

test('land role overrides enter the SAME shared compiler, including tight-corner handling',()=>{
 const context={speed:30,grade:0,curvature:.05};
 const agile=compiled.tuning('gpt','coast',context,{acceleration:1,topSpeed:1,steering:1.2}),normal=compiled.tuning('gpt','coast',context,{acceleration:1,topSpeed:1,steering:1});
 assert.ok(agile.maxSpeed>normal.maxSpeed,'character steering contributes to grip-limited pace');
 const fast=compiled.tuning('gpt','coast',context,{acceleration:1,topSpeed:1.1,steering:1});
 assert.ok(Math.abs(fast.maxSpeed-normal.maxSpeed)<.01,'higher straight gearing alone cannot raise a tight-corner cap');
 assert.ok(compiled.tuning('grok','coast',{curvature:0}).maxSpeed>compiled.tuning('gemini','coast',{curvature:0}).maxSpeed);
 assert.ok(compiled.tuning('gemini','coast',context).maxSpeed>compiled.tuning('grok','coast',context).maxSpeed);
});
test('character acceleration and steering produce differentiated real speed and lane integration',()=>{
 const quick=compiled.tuning('claude','coast',{curvature:0}),slow=compiled.tuning('gemini','coast',{curvature:0});
 assert.ok(stepRaceKartSpeed(0,{throttle:true},1/60,quick,0,0)>stepRaceKartSpeed(0,{throttle:true},1/60,slow,0,0));
 const agile=compiled.tuning('gemini','coast'),stable=compiled.tuning('grok','coast');
 assert.ok(moveLane(0,4,1/60*agile.multipliers.steering)>moveLane(0,4,1/60*stable.multipliers.steering));
});
test('A01 retains the released original coefficients even when a land override is supplied',()=>{
 const original={whale:[1.06,.92,1.02],gemini:[.92,1,1.08],gpt:[1,1,1],claude:[1.08,.96,.96],grok:[.96,1.08,.96],glm:[.94,1.04,1.02]};
 for(const profile of CHARACTER_PROFILES){const [acceleration,topSpeed,steering]=original[profile.id];assert.deepEqual(WATER_CHARACTER_MULTIPLIERS[profile.id],{acceleration,topSpeed,steering});const value=characterTuning(profile.id,'waterpark',{acceleration:1.4,topSpeed:1.05,steering:1.3});assert.deepEqual(value.multipliers,{acceleration,topSpeed,steering});assert.equal(value.maxSpeed,22*topSpeed);assert.equal(value.acceleration,8.6*acceleration);assert.equal(value.steering,11*steering);}
});
test('the land roster preserves main archetypes and meaningful stat spread under the declared trait amendment',()=>{
 const byId=Object.fromEntries(CHARACTER_PROFILES.map(p=>[p.id,p]));
 for(const profile of CHARACTER_PROFILES){
  if(profile.id!=='claude')assert.ok(byId.claude.acceleration>profile.acceleration,'Claude retains strongest launch');
  if(profile.id!=='grok')assert.ok(byId.grok.topSpeed>profile.topSpeed,'Grok retains highest straight speed');
  if(profile.id!=='gemini')assert.ok(byId.gemini.steering>profile.steering,'Gemini retains strongest handling');
 }
 assert.ok(byId.whale.acceleration>1 && byId.whale.steering>1 && byId.whale.topSpeed<1,'Whale stays brisk/agile with lower straight speed');
 assert.ok(byId.glm.acceleration<1 && byId.glm.topSpeed>1 && byId.glm.steering>1,'GLM trades slower launch for speed/handling');
 assert.ok(byId.grok.acceleration<1 && byId.grok.steering<1,'Grok retains launch/handling tradeoffs');
 assert.ok(byId.gemini.acceleration<1 && byId.claude.topSpeed<1,'corner and launch specialists retain tradeoffs');
 for(const key of ['acceleration','topSpeed','steering'] as const)assert.equal(byId.gpt[key],1);
 for(const [key,minimum,low,high] of [['acceleration',.16,.65,1.45],['topSpeed',.07,.90,1.10],['steering',.12,.85,1.30]] as const){const values=CHARACTER_PROFILES.map(p=>p[key]);assert.ok(Math.max(...values)-Math.min(...values)>=minimum-1e-9);assert.ok(values.every(v=>v>=low&&v<=high));}
});

test('character menu labels use map-specific multipliers and expose the full tuned land range',async()=>{
 const {readFileSync}=await import('node:fs');const menu=readFileSync(new URL('../src/menu.ts',import.meta.url),'utf8');
 for(const key of ['acceleration','topSpeed','steering'])assert.ok(menu.includes(`t.multipliers.${key}`));
 assert.ok(menu.includes("state.map==='waterpark'?.85:.65"));assert.ok(menu.includes("state.map==='waterpark'?1.15:1.45"));
});
test('the CPU lab is a built and corresponding-source-packaged entry',async()=>{
 const {readFileSync}=await import('node:fs');
 const build=readFileSync(new URL('../vite.config.ts',import.meta.url),'utf8'),packager=readFileSync(new URL('../scripts/package-source.mjs',import.meta.url),'utf8');
 assert.ok(build.includes("balance: 'balance-lab.html'"));assert.ok(packager.includes("'balance-lab.html','LICENSE'"));
});
