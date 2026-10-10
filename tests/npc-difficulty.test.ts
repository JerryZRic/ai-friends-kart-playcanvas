import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NPC_SKILLS, npcDriving, npcLine, seededRandom } from '../src/npc-difficulty';
import { newBrain, planLane, chooseItem, type Combatant } from '../src/npc-tactics';
import { getNpcPresets, NPC_THEME_BUDGET } from '../src/kart-presets';
import { defaultBuild, kartTuning, validateBuild } from '../src/kart-build';
import { createRaceKartTuning, buildForRacer, stepRaceKartSpeed } from '../src/kart-race';
import { newWaterRace, advanceWaterRace } from '../src/water-race';
import type { Difficulty } from '../src/race-options';
const difficulties:Difficulty[]=['easy','normal','hard'];

test('fixed mixed recipes are legal, bounded, deterministic sidegrades with identical player physics',()=>{
 const presets=getNpcPresets('coast',73),themes=new Set<string>();
 assert.deepEqual(presets,getNpcPresets('coast',73));assert.equal(presets.length,6);
 assert.deepEqual(getNpcPresets('waterpark',73),[]);
 for(const preset of presets){
  assert.ok(validateBuild(preset.build));Object.values(preset.build).forEach(id=>themes.add(id.split('::')[0]));
  assert.ok(new Set(Object.values(preset.build).map(id=>id.split('::')[0])).size>1);
  const tune=createRaceKartTuning(defaultBuild,73);
  for(const context of [{speed:10,grade:.14,curvature:0},{speed:30,grade:-.12,curvature:.04}]){
   assert.deepEqual(tune(preset.characterId,'not-a-character',context),preset.characterId==='whale'?kartTuning('whale','coast',defaultBuild,context):kartTuning(preset.characterId,'coast',preset.build,context));
   assert.deepEqual(createRaceKartTuning(preset.build,73)(preset.characterId,preset.characterId,context),kartTuning(preset.characterId,'coast',preset.build,context));
  }
 }
 assert.ok(themes.size<=NPC_THEME_BUDGET);
 for(const difficulty of difficulties){
  assert.equal('maxSpeed' in NPC_SKILLS[difficulty],false);assert.equal('acceleration' in NPC_SKILLS[difficulty],false);
  assert.deepEqual(buildForRacer('gpt','whale',defaultBuild,73),presets.find(p=>p.characterId==='gpt')!.build);
 }
});
test('difficulty changes real braking, racing line, drift readiness and item opportunity',()=>{
 assert.equal(npcDriving(35,40,.4,NPC_SKILLS.easy).brake,true);
 assert.equal(npcDriving(35,40,.4,NPC_SKILLS.hard).brake,false);
 assert.equal(npcDriving(28,40,.35,NPC_SKILLS.easy).drift,false);
 assert.equal(npcDriving(28,40,.35,NPC_SKILLS.hard).drift,true);
 assert.equal(npcDriving(28,40,.35,NPC_SKILLS.hard,1.5).drift,false,'charge release earns only the shared drift reward');
 assert.notEqual(npcLine(100,1,.3,NPC_SKILLS.easy),npcLine(100,1,.3,NPC_SKILLS.hard));
 const actor:Combatant & ReturnType<typeof newBrain>={id:'gpt',total:100,lateral:0,speed:28,held:'boost',boost:0,shield:0,slow:0,...newBrain(0,0)};
 assert.equal(chooseItem(actor,[actor],1000,.2,NPC_SKILLS.easy),null);
 assert.equal(chooseItem(actor,[actor],1000,.2,NPC_SKILLS.hard),'boost');
 actor.held=null;
 assert.notEqual(planLane(actor,[actor],[],1000,1,.3,NPC_SKILLS.easy),planLane(actor,[actor],[],1000,1,.3,NPC_SKILLS.hard));
 assert.ok(NPC_SKILLS.easy.reaction>NPC_SKILLS.hard.reaction);
});
test('water difficulty is deterministic at runtime and never equips mechanical parts',()=>{
 const run=(difficulty:Difficulty)=>{const race=newWaterRace('gpt',{difficulty,seed:19});for(let i=0;i<1200;i++)advanceWaterRace(race,{throttle:true,brake:false,steer:0},1/60);return race;};
 const easy=run('easy'),hard=run('hard');
 assert.deepEqual(run('hard'),hard);
 assert.notDeepEqual(easy.racers.slice(1).map(r=>[r.total,r.lateral]),hard.racers.slice(1).map(r=>[r.total,r.lateral]));
 assert.ok(hard.racers.every(r=>!('build' in r)));
 assert.deepEqual(run('normal'),run('normal'));
});
test('coast uses seeded gameplay, actual loadout templates and no phase speed handicap',()=>{
 const source=readFileSync(new URL('../src/game.ts',import.meta.url),'utf8');
 assert.match(source,/kartLoader\.instantiate\(racerBuild\(slot.id\)\)/);
 assert.match(source,/getNpcPresets\('coast',raceOptions.seed\)/);
 assert.match(source,/advancePickup\(box,dt,raceRng\)/);
 assert.match(source,/\],boxes,LENGTH,raceRng\)/);
 assert.match(source,/stepRaceKartSpeed\(b.speed,control,/);
 assert.doesNotMatch(source,/maxSpeed\*\(\.9\+b.phase/);
 assert.doesNotMatch(source,/mat\.emissive\.set/,'shared template materials stay immutable');
 const a=seededRandom(42),b=seededRandom(42),c=seededRandom(43);
 const aa=Array.from({length:30},a);assert.deepEqual(aa,Array.from({length:30},b));assert.notDeepEqual(aa,Array.from({length:30},c));
});

test('coast AI and human with identical inputs use identical effect acceleration and limits',()=>{
 const tuning=createRaceKartTuning(defaultBuild)('gpt','gpt'), input={throttle:true,brake:false};
 for(const boost of [0,3.3])for(const slow of [0,3])for(const offroad of [false,true]){
  let human=20,ai=20;
  for(let frame=0;frame<180;frame++){
   human=stepRaceKartSpeed(human,input,1/60,tuning,boost,slow,offroad);
   ai=stepRaceKartSpeed(ai,input,1/60,tuning,boost,slow,offroad);
   assert.equal(ai,human);
  }
 }
 const accelerated=stepRaceKartSpeed(20,input,1/60,tuning,3.3,0);
 assert.ok(accelerated<21,'pickup does not instantly multiply travel speed');
});
