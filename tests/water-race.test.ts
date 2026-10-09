import test from 'node:test';import assert from 'node:assert/strict';
import {newWaterRace,advanceWaterRace,advanceWaterCheckpoints,waterStandings,waterTravelSpeed,resetWaterPickups,useWaterItem,WATER_CHECKPOINTS,WATER_LAPS} from '../src/water-race';
import {WATER_RACE_LENGTH,waterparkCurvature,WATER_RACE_PICKUPS} from '../src/waterpark-design';
import {stepWaterMotion,waterTurnCurrent} from '../src/waterpark-motion';
import {characterTuning} from '../src/character-profiles';
import type {RacingPickup} from '../src/npc-tactics';
const input={throttle:true,brake:false,steer:0};
function boxes():RacingPickup[]{return Array.from({length:24},(_,i)=>({d:45+Math.floor(i/3)*75,lateral:(i%3-1)*4,display:'boost',cool:0,mesh:{enabled:true},models:{boost:{enabled:true},shield:{enabled:false},pulse:{enabled:false},mystery:{enabled:false}}}));}
function run(hz:number){
 const race=newWaterRace('whale'),pickups=boxes();resetWaterPickups(race,pickups);
 // A medium-complexity route needs steering. Hold a deterministic controller
 // decision for one second so 30/60/120 Hz feeds exactly the same fixed ticks.
 for(let second=0;second<180&&!race.finished;second++){
  const player=race.racers[0],steer=Math.max(-1,Math.min(1,-player.lateral*.6-player.motion.lateralSpeed*.4));
  for(let frame=0;frame<hz&&!race.finished;frame++)advanceWaterRace(race,{...input,steer},1/hz,pickups);
 }
 return race;
}
test('six unique racers keep real three-lap results and deterministic replay',()=>{const race=run(60);assert.ok(race.finished);assert.equal(new Set(race.racers.map(r=>r.id)).size,6);assert.equal(race.racers[0].checkpoint,24);for(const r of race.racers){if(r.finishTime!==null){assert.equal(r.checkpoint,24);assert.equal(r.total,WATER_RACE_LENGTH*3);assert.ok(r.finishTime>70);}else {assert.ok(r.checkpoint<24);assert.ok(r.total<WATER_RACE_LENGTH*3);}assert.equal(r.speed,0);}assert.deepEqual(run(60),race);assert.ok(race.racers.slice(1).some(r=>r.pickups>0&&r.uses>0));assert.ok(race.racers.every(r=>r.uses<=r.pickups));const sorted=waterStandings(race);assert.ok(sorted.every((r,i)=>i===0||r.finishTime!>=sorted[i-1].finishTime!));});
test('race finish times and rank are identical at 30, 60 and 120 Hz',()=>{const a=run(30),b=run(60),c=run(120);assert.deepEqual(a.racers,b.racers);assert.deepEqual(a.racers,c.racers);});
test('countdown and effects use simulation time; invalid deltas and finished frames do nothing',()=>{const r=newWaterRace('glm');advanceWaterRace(r,input,2.5);assert.equal(r.elapsed,0);assert.equal(r.racers[0].total,0);advanceWaterRace(r,input,.6);assert.ok(Math.abs(r.elapsed-.1)<.009);const snapshot=structuredClone(r);advanceWaterRace(r,input,NaN);advanceWaterRace(r,input,-1);advanceWaterRace(r,input,1e12);assert.deepEqual(r,snapshot);const done=run(60),saved=structuredClone(done);advanceWaterRace(done,input,3);assert.deepEqual(done,saved);});
test('reverse, seam oscillation and checkpoint skips cannot earn laps',()=>{const r={checkpoint:0},gap=WATER_RACE_LENGTH/WATER_CHECKPOINTS;advanceWaterCheckpoints(r,0,WATER_RACE_LENGTH);assert.equal(r.checkpoint,0);advanceWaterCheckpoints(r,gap+1,gap-1);assert.equal(r.checkpoint,0);advanceWaterCheckpoints(r,gap-1,gap+1);assert.equal(r.checkpoint,1);advanceWaterCheckpoints(r,gap+1,gap-1);advanceWaterCheckpoints(r,gap-1,gap+1);assert.equal(r.checkpoint,1);for(let gate=2;gate<=WATER_CHECKPOINTS*WATER_LAPS;gate++)advanceWaterCheckpoints(r,gate*gap-1,gate*gap+1);assert.equal(r.checkpoint,24);});
test('inventory starts empty and player cannot create items during countdown or after finish',()=>{const race=newWaterRace('gpt');for(const r of race.racers)assert.equal(r.held,null);race.racers[0].held='boost';useWaterItem(race,race.racers[0]);assert.equal(race.racers[0].held,'boost');advanceWaterRace(race,input,3.1);useWaterItem(race,race.racers[0]);assert.equal(race.racers[0].held,null);assert.ok(race.racers[0].boost>0);});
test('contact impulses are local, shield-aware and cannot use a finisher as an obstacle',()=>{const r=newWaterRace('whale');r.countdown=0;const [a,b]=r.racers;a.total=b.total=20;a.lateral=b.lateral=0;a.motion={...a.motion,distance:20,lane:0,speed:10};b.motion={...b.motion,distance:20,lane:0,speed:10};a.shield=2;const expected=stepWaterMotion(a.motion,input,1/120,{...characterTuning(a.id,'waterpark'),finishDistance:Infinity,curvature:waterparkCurvature(a.total)});advanceWaterRace(r,input,1/120);assert.ok(a.bump>0&&b.bump>0);assert.equal(a.motion.lateralSpeed,expected.lateralSpeed);assert.ok(Math.abs(b.motion.lateralSpeed)>1);const finished=newWaterRace('whale');finished.countdown=0;finished.racers[1].finishTime=1;finished.racers[1].total=finished.racers[0].total;finished.racers[1].lateral=finished.racers[0].lateral;advanceWaterRace(finished,input,1/120);assert.equal(finished.racers[0].bump,0);});
test('player finish immediately freezes the whole race with truthful pending times',()=>{const race=newWaterRace('gpt');race.countdown=0;const player=race.racers[0];player.checkpoint=23;player.total=WATER_RACE_LENGTH*3-.03;player.motion={...player.motion,distance:player.total,speed:20};advanceWaterRace(race,input,1/60);assert.ok(player.finishTime!==null);assert.ok(player.finishTime!<1/60);assert.equal(race.finished,true);assert.equal(race.elapsed,player.finishTime);assert.ok(race.racers.slice(1).every(r=>r.finishTime===null));const finished=structuredClone(race);advanceWaterRace(race,{...input,steer:1},1);assert.deepEqual(race,finished);assert.equal(waterStandings(race)[0].id,player.id);});
test('all six profiles drive actual player and NPC acceleration, caps and steering equally',async()=>{const {CHARACTER_PROFILES,characterTuning}=await import('../src/character-profiles');const {WATER_HANDLING}=await import('../src/waterpark-motion');const dt=1/120;
 for(const profile of CHARACTER_PROFILES){
  const race=newWaterRace(profile.id);race.countdown=0;for(const [i,r] of race.racers.entries()){r.total=i*40;r.motion.distance=r.total;}
  advanceWaterRace(race,{...input,steer:1},dt);
  for(const racer of race.racers){const tuning=characterTuning(racer.id,'waterpark');assert.ok(Math.abs(racer.speed-tuning.acceleration*dt*Math.exp(-WATER_HANDLING.drag*dt))<1e-10,`${racer.id} acceleration as ${racer===race.racers[0]?'player':'NPC'}`);}
  const player=race.racers[0],tuning=characterTuning(profile.id,'waterpark');const expectedLateral=(tuning.steering*Math.min(1,player.speed/6)+waterTurnCurrent(player.speed,waterparkCurvature(0)))*dt*Math.exp(-WATER_HANDLING.lateralDrag*dt);assert.ok(Math.abs(player.motion.lateralSpeed-expectedLateral)<1e-10,`${profile.id} steering`);
  for(const racer of race.racers){racer.motion.speed=1000;racer.boost=racer.slow=0;}
  advanceWaterRace(race,input,dt);for(const racer of race.racers)assert.equal(racer.speed,characterTuning(racer.id,'waterpark').maxSpeed,`${racer.id} cap`);
 }
});

test('actual race reverse remains signed under item/slide boost and slow, without checkpoint credit',()=>{
 const race=newWaterRace('gpt');race.countdown=0;
 for(const [i,racer] of race.racers.entries()){racer.total=100+i*40;racer.motion.distance=racer.total;}
 const player=race.racers[0];player.speed=player.motion.speed=-5;player.boost=2;player.motion.slideBoost=2;player.slow=2;
 assert.equal(waterTravelSpeed(player),-5*.55);
 const previous=player.total;
 advanceWaterRace(race,{throttle:false,brake:false,reverse:true,steer:0},1/120);
 assert.ok(player.total<previous);assert.equal(player.checkpoint,0);
 assert.ok(Math.abs(player.total-previous-waterTravelSpeed(player)/120)<1e-10);
});

test('release boost affects that same race tick and shares a single multiplier with an item',()=>{
 for(const itemBoost of [0,2]){
  const race=newWaterRace('gpt');race.countdown=0;
  for(const [i,racer] of race.racers.entries()){racer.total=i*40;racer.motion.distance=racer.total;}
  const player=race.racers[0];player.speed=player.motion.speed=18;player.motion.charge=1;player.motion.drifting=true;player.boost=itemBoost;
  advanceWaterRace(race,{...input,drift:false,steer:.2},1/120);
  assert.ok(player.motion.slideBoost>1);assert.equal(player.motion.charge,0);
  assert.ok(Math.abs(waterTravelSpeed(player)-player.speed*1.34)<1e-10);
  assert.ok(Math.abs(player.total-waterTravelSpeed(player)/120)<1e-10);
 }
});

test('countdown suppresses reverse, slide charge and effects; fresh races reset every new field',()=>{
 const race=newWaterRace('claude'),initial=structuredClone(race);
 race.racers[0].boost=2;
 const reverse={throttle:false,brake:false,reverse:true,drift:true,steer:1};
 advanceWaterRace(race,reverse,3);
 assert.equal(race.countdown,0);assert.equal(race.elapsed,0);assert.equal(race.racers[0].speed,0);assert.equal(race.racers[0].boost,2);assert.equal(race.racers[0].motion.charge,0);
 advanceWaterRace(race,reverse,.25);
 assert.ok(race.racers[0].total<0);assert.equal(race.racers[0].motion.charge,0);
 assert.deepEqual(newWaterRace('claude'),initial);
});

test('player finish clips opponent progress and pickup clocks before later same-tick crossings',async()=>{
 const {stepWaterMotion}=await import('../src/waterpark-motion');
 const {characterTuning}=await import('../src/character-profiles');
 const race=newWaterRace('gpt'),line=WATER_RACE_LENGTH*WATER_LAPS,dt=1/120;
 race.countdown=0;race.elapsed=40;
 for(const [i,racer] of race.racers.entries()){
  racer.checkpoint=23;racer.total=line-(i===0?.03:i===1?.005:i===2?.12:40*i);
  racer.motion={...racer.motion,distance:racer.total,lane:0,speed:20,elapsed:40};racer.speed=20;racer.lateral=0;
 }
 const player=race.racers[0],later=race.racers[2],beforeLater=later.total;
 const predicted=stepWaterMotion(player.motion,input,dt,{...characterTuning(player.id,'waterpark'),finishDistance:Infinity});
 const expectedDuration=(line-player.total)/predicted.speed;
 const pickups=boxes();pickups[0].cool=1;
 advanceWaterRace(race,input,1,pickups);
 assert.equal(race.finished,true);assert.ok(Math.abs(player.finishTime!-(40+expectedDuration))<1e-10);
 assert.equal(race.elapsed,player.finishTime);assert.equal(race.remainder,0);
 assert.ok(race.racers[1].finishTime!==null&&race.racers[1].finishTime!<player.finishTime!);
 assert.equal(later.finishTime,null);assert.equal(later.motion.finished,false);assert.equal(later.checkpoint,23);
 assert.ok(later.total>beforeLater&&later.total<line);
 assert.ok(Math.abs(later.motion.elapsed-race.elapsed)<1e-10);
 assert.ok(Math.abs(pickups[0].cool-(1-expectedDuration))<1e-10,'pickup timers stop at the crossing');
 assert.deepEqual(waterStandings(race).slice(0,2).map(r=>r.id),[race.racers[1].id,player.id]);
 for(const racer of race.racers){assert.equal(racer.speed,0);assert.equal(racer.motion.speed,0);assert.equal(racer.motion.slideBoost,0);assert.equal(racer.motion.charge,0);assert.equal(racer.held,null);}
 const saved=structuredClone({race,pickups});
 advanceWaterRace(race,{throttle:false,brake:false,reverse:true,drift:true,steer:1},10,pickups);useWaterItem(race,player);
 assert.deepEqual({race,pickups},saved);
});

test('all selected drivers can finish immediately without waiting for unfinished opponents',()=>{
 for(const selected of ['whale','gemini','gpt','claude','grok','glm']){
  const race=newWaterRace(selected);race.countdown=0;
  const player=race.racers[0];player.total=WATER_RACE_LENGTH*WATER_LAPS-.02;player.checkpoint=23;
  player.motion={...player.motion,distance:player.total,speed:18};player.speed=18;
  advanceWaterRace(race,input,1/30);
  assert.equal(race.finished,true);assert.ok(player.finishTime!==null);
  assert.equal(race.racers.filter(r=>r.finishTime===null).length,5);
  assert.equal(waterStandings(race)[0].id,selected);
  assert.equal(newWaterRace(selected).racers[0].motion.slideBoost,0);
 }
});

test('throttle, water slide, brake and reverse replays stay deterministic at common frame rates',()=>{
 const replay=(hz:number)=>{
  const race=newWaterRace('gemini'),pickups=boxes();resetWaterPickups(race,pickups);
  const phases=[
   {seconds:8,control:input},
   {seconds:1,control:{...input,drift:true,steer:.2}},
   {seconds:2,control:{...input,steer:.1}},
   {seconds:2,control:{throttle:false,brake:true,steer:0}},
   {seconds:3,control:{throttle:false,brake:false,reverse:true,steer:.1}},
   {seconds:3,control:input},
  ];
  for(const phase of phases)for(let frame=0;frame<phase.seconds*hz;frame++)advanceWaterRace(race,phase.control,1/hz,pickups);
  return {racers:race.racers,elapsed:race.elapsed,seed:race.seed,pickups};
 };
 const expected=replay(120);assert.deepEqual(replay(60),expected);assert.deepEqual(replay(30),expected);
});

test('all six drivers complete the authored medium-complexity course while NPCs keep moving and collect real staggered pickups',()=>{
 const reports=[];
 for(const selected of ['whale','gemini','gpt','claude','grok','glm']){
  const race=newWaterRace(selected),pickups:RacingPickup[]=WATER_RACE_PICKUPS.map(({d,lateral})=>({d,lateral,display:'boost',cool:0,mesh:{enabled:true},models:{boost:{enabled:true},shield:{enabled:false},pulse:{enabled:false},mystery:{enabled:false}}}));
  resetWaterPickups(race,pickups);let npcBankHits=0,minNpcSpeed=Infinity;
  for(let frame=0;frame<60*180&&!race.finished;frame++){
   const player=race.racers[0],steer=Math.max(-1,Math.min(1,-player.lateral*.6-player.motion.lateralSpeed*.4));
   advanceWaterRace(race,{...input,steer},1/60,pickups);
   for(const racer of race.racers.slice(1))if(race.elapsed>10&&racer.finishTime===null&&!race.finished){
    minNpcSpeed=Math.min(minNpcSpeed,racer.speed);if(racer.motion.bankHit)npcBankHits++;
    assert.ok(Number.isFinite(racer.total)&&Math.abs(racer.lateral)<=9.8);
   }
  }
  assert.equal(race.finished,true,`${selected} completes three laps using throttle and gentle course correction`);
  assert.equal(race.racers[0].checkpoint,24);assert.ok(race.racers[0].finishTime!<180);
  assert.equal(npcBankHits,0,'curvature-aware AI stays clear of banks');assert.ok(minNpcSpeed>4,'no NPC stalls or wall traps');
  assert.ok(race.racers.slice(1).every(racer=>racer.total>WATER_RACE_LENGTH*WATER_LAPS*.75));
  assert.ok(race.racers.slice(1).some(racer=>racer.pickups>0&&racer.uses>0));
  assert.ok(race.racers.every(racer=>racer.uses<=racer.pickups));
  reports.push({selected,seconds:Number(race.elapsed.toFixed(2)),npcBankHits,minNpcSpeed:Number(minNpcSpeed.toFixed(2))});
 }
 console.log(JSON.stringify({waterMediumCourse:reports}));
});

function dynamicRacePickups():RacingPickup[]{
 const make=(d:number,lateral:number,dynamic=false):RacingPickup=>({d,lateral,dynamic,display:'boost',cool:0,mesh:{enabled:!dynamic},models:{boost:{enabled:true},shield:{enabled:false},pulse:{enabled:false},mystery:{enabled:false}}});
 return [...WATER_RACE_PICKUPS.map(({d,lateral})=>make(d,lateral)),...Array.from({length:4},()=>make(0,0,true))];
}
const correctWaterPlayer=(race:ReturnType<typeof newWaterRace>)=>({...input,steer:Math.max(-1,Math.min(1,-race.racers[0].lateral*.6-race.racers[0].motion.lateralSpeed*.4))});

test('water race owns a serializable bounded dynamic pool through countdown, real spawning, restart and finish',()=>{
 const race=newWaterRace('whale'),pickups=dynamicRacePickups(),pool=pickups.filter(box=>box.dynamic);
 resetWaterPickups(race,pickups);assert.equal(pool.length,4);assert.ok(pool.every(box=>!box.mesh.enabled));
 const initialPool=structuredClone(pool);
 advanceWaterRace(race,input,3,pickups);assert.equal(race.elapsed,0);assert.deepEqual(pool,initialPool,'countdown consumes no pool timers');
 let active:RacingPickup|undefined;
 for(let frame=0;frame<60*45&&!active;frame++){advanceWaterRace(race,correctWaterPlayer(race),1/60,pickups);active=pool.find(box=>box.mesh.enabled);}
 assert.ok(active,'actual authored water circuit permits a runtime random spawn');
 assert.ok(active.d>=0&&active.d<WATER_RACE_LENGTH&&Math.abs(active.lateral)<=5.2);
 assert.ok(!WATER_RACE_PICKUPS.some(box=>box.d===active!.d&&box.lateral===active!.lateral));
 assert.doesNotThrow(()=>structuredClone(race));assert.deepEqual(JSON.parse(JSON.stringify(race)),race,'the director does not leak functions or native entities into race state');
 const frozen=structuredClone({race,pool});
 for(const dt of [0,-1,NaN,Infinity,11])advanceWaterRace(race,input,dt,pickups);
 assert.deepEqual({race,pool},frozen,'non-simulation updates cannot advance dynamic lifetimes');
 const player=race.racers[0];player.checkpoint=WATER_LAPS*WATER_CHECKPOINTS-1;player.total=WATER_RACE_LENGTH*WATER_LAPS-.01;player.motion.distance=player.total;player.speed=player.motion.speed=20;
 advanceWaterRace(race,input,1/60,pickups);assert.equal(race.finished,true);assert.ok(pool.every(box=>!box.mesh.enabled),'finish hides the pool in the same physics tick');
 const finished=structuredClone({race,pool});advanceWaterRace(race,input,10,pickups);assert.deepEqual({race,pool},finished);
 const restarted=newWaterRace('whale');resetWaterPickups(restarted,pickups);assert.ok(pool.every(box=>!box.mesh.enabled&&box.cool===Infinity),'reset restores dormant slots without reviving their old positions');
 assert.ok(pickups.filter(box=>!box.dynamic).every(box=>box.mesh.enabled&&box.cool===0));
});

test('dynamic water spawning and race simulation stay deterministic at 30, 60 and 120 Hz',()=>{
 const replay=(hz:number)=>{
  const race=newWaterRace('gemini'),pickups=dynamicRacePickups();resetWaterPickups(race,pickups);
  for(let second=0;second<45;second++){
   const control=correctWaterPlayer(race);
   for(let frame=0;frame<hz;frame++)advanceWaterRace(race,control,1/hz,pickups);
  }
  assert.ok(Math.abs(race.remainder)<1e-12);
  const {remainder,...state}=race;return {race:state,pickups};
 };
 const expected=replay(120);assert.deepEqual(replay(60),expected);assert.deepEqual(replay(30),expected);
});

test('all six water NPC characters collect actual dynamic spawns and deliberately use earned items',async()=>{
 const {setPickupDisplay}=await import('../src/item-pickups');
 const ids=['whale','gemini','gpt','claude','grok','glm'];
 for(const [index,id] of ids.entries()){
  const race=newWaterRace(ids[(index+1)%ids.length]),pickups=dynamicRacePickups();resetWaterPickups(race,pickups);race.countdown=0;
  let box:RacingPickup|undefined;
  for(let frame=0;frame<60*45&&!box;frame++){advanceWaterRace(race,correctWaterPlayer(race),1/60,pickups);box=pickups.find(candidate=>candidate.dynamic&&candidate.mesh.enabled);}
  assert.ok(box,`${id} receives an actual dynamic spawn`);
  const target=race.racers.find(racer=>racer.id===id)!,player=race.racers[0];
  for(const [slot,racer] of race.racers.entries()){
   Object.assign(racer,{total:box.d+150+slot*35,lateral:4,speed:20,held:null,boost:0,shield:0,slow:0,bump:0,warning:0,reaction:0,cooldown:0,decisionIn:1000,pickups:0,uses:0});
   Object.assign(racer.motion,{distance:racer.total,lane:racer.lateral,speed:20,lateralSpeed:0,slideBoost:0});
  }
  Object.assign(target,{total:box.d,lateral:box.lateral,targetLane:box.lateral});Object.assign(target.motion,{distance:box.d,lane:box.lateral});
  Object.assign(player,{total:box.d+16,lateral:box.lateral});Object.assign(player.motion,{distance:player.total,lane:box.lateral});
  setPickupDisplay(box,'pulse');advanceWaterRace(race,input,1/120,pickups);
  assert.equal(target.held,'pulse',`${id} receives the pool's depicted reward`);assert.equal(target.pickups,1);assert.equal(target.uses,0);assert.equal(box.mesh.enabled,false);
  assert.equal(player.held,null,'an NPC pickup cannot also enter the player inventory');
  for(let tick=0;tick<240&&target.uses===0;tick++)advanceWaterRace(race,input,1/120,pickups);
  assert.equal(target.uses,1,`${id} obeys the reaction and warning delay, then uses the earned pulse`);assert.equal(target.held,null);assert.ok(player.slow>0);assert.equal(box.mesh.enabled,false);
 }
});
