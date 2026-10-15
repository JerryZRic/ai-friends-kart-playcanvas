import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LAND_SIMULATION_MAPS,loadLandSimulationCourse,type LandSimulationCourse} from '../src/land-simulation-course';
import {landCpuFinished,tickLandCpu,decideLandCpu,advanceLandCpu,collideLandCpu,activateLandCpuItem,type LandCpuActor,type LandCpuContext,type LandCpuFrame} from '../src/land-cpu';
import {legacyLandCpuFrame} from './helpers/legacy-land-cpu';
import {createLandRaceRoute} from '../src/land-race-route';
import {canonicalProgress,createRouteProgress,type LandCursor} from '../src/land-routes';
import {createLapProgress} from '../src/land-track';
import {createRaceKartTuning,kartRoadContext} from '../src/kart-race';
import {defaultBuild} from '../src/kart-build';
import {newBrain,collectPickups,type Combatant,type RacingPickup} from '../src/npc-tactics';
import {npcSkill,seededRandom} from '../src/npc-difficulty';
import {resetPickup,advancePickup} from '../src/item-pickups';
import {clamp} from '../src/track';
import {nearbyGap} from '../src/npc-tactics';

function actor(id:string,phase:number,total:number,lateral:number):LandCpuActor {
 return {id,phase,total,lateral,speed:34,driving:true,cornerPace:1,aiBend:0,driftCharge:0,driftCooldown:0,aiDrifting:false,held:null,boost:0,shield:0,slow:0,finishedAt:null,...newBrain(phase,lateral)};
}
function world(course:LandSimulationCourse,stage:'start'|'fork'|'rail'|'finish') {
 const ids=['gemini','gpt','claude','grok','glm'],seed=20261010;
 const routes=course.routes?createLandRaceRoute(course.routes,seed):null,progress=new Map(),compiled=createRaceKartTuning(defaultBuild,seed),rng=seededRandom(seed);
 const context:LandCpuContext={length:course.length,track:course.track,sample:course.sample,halfWidthAt:course.halfWidthAt,routes,progress,skill:npcSkill('normal'),
  tuning:(id,distance,speed)=>compiled(id,'whale',kartRoadContext(distance,speed,routes?.states.has(id)?routes.view(id,distance).sample:course.sample))};
 const offset=stage==='start'?12:stage==='fork'?(course.routes?.commonStart.length??course.length*.31)-18:course.length*.42;
 const bots=ids.map((id,i)=>actor(id,i,offset+Math.floor(i/2)*5.2,(i%2?1:-1)*.7));
 const human:Combatant={id:'whale',total:offset-200,lateral:0,speed:0,held:null,boost:0,shield:0,slow:0};
 if(routes)routes.init(human.id,human.total,human.lateral);
 for(const [i,b] of bots.entries()){
  b.held=(['pulse','shield','boost',null,null] as const)[i];b.decisionIn=0;
  if(routes){
   routes.init(b.id,b.total,b.lateral);
   if(stage==='rail'||stage==='finish'){
    const edgeId=stage==='finish'?'finish':'alley',edge=course.routes!.edges[edgeId];
    const cursor:LandCursor={lap:stage==='finish'?2:0,edgeId,s:stage==='finish'?edge.length-.2-i*.02:edge.length*.4+i*.8,lateral:stage==='finish'?0:edge.halfWidthAt(edge.length*.4)+1,choiceByLap:{0:'alley',1:'boulevard',2:'boulevard'}};
    routes.states.set(b.id,stage==='finish'?{cursor,nextGate:course.routes!.gatesPerLap*3-1,laps:2,finished:false}:createRouteProgress(cursor));
    b.total=canonicalProgress(course.routes!,cursor);b.lateral=cursor.lateral;b.targetLane=cursor.lateral;b.decisionIn=1;
   }
  }else{
   if(stage==='finish'){b.total=course.length*3-.2-i*.02;b.lateral=b.targetLane=0;b.decisionIn=1;}
   if(stage==='rail'){b.lateral=course.halfWidthAt(b.total)+1;b.targetLane=b.lateral;b.decisionIn=1;}
   if(course.track)progress.set(b.id,stage==='finish'?{distance:b.total,nextCheckpoint:36,checkpoints:12,passedCheckpoints:11,laps:2}:createLapProgress(course.track,b.total));
  }
 }
 const boxes:RacingPickup[]=course.pickups.map(row=>({...row,display:'mystery',cool:0,mesh:{enabled:true},models:{mystery:{enabled:true},boost:{enabled:false},shield:{enabled:false},pulse:{enabled:false}}}));
 boxes.forEach(box=>resetPickup(box,rng));
 return {bots,human,boxes,context,rng};
}
type World=ReturnType<typeof world>;
function step(w:World,frame:LandCpuFrame,legacy:boolean) {
 const {bots,human,boxes,context}=w;
 const prior=bots.map(b=>({actor:b,previous:b.total,previousLane:b.lateral,onPickup:()=>{b.pickups++;b.reaction=context.skill.reaction+b.phase*.025;}}));
 for(const box of boxes)advancePickup(box,frame.dt,w.rng);
 const racers=[human,...bots.filter(b=>!landCpuFinished(b,context))],events:string[]=[];
 if(legacy)events.push(...legacyLandCpuFrame(bots,racers,boxes,context,frame));
 else{
  const feedback={finished:(b:LandCpuActor)=>{events.push('finished:'+b.id);},railContact:()=>{events.push('rail');}};
  for(const b of bots)tickLandCpu(b,frame.dt);
  for(const b of bots)decideLandCpu(b,racers,boxes,context,frame,feedback);
  for(const b of bots)advanceLandCpu(b,context,frame,feedback);
  for(const b of bots)collideLandCpu(b,racers,context);
 }
 collectPickups(prior.filter(r=>!landCpuFinished(r.actor,context)),boxes,context.length,w.rng,context.routes?.contact);
 return events;
}
function snapshot(w:World) {
 return {bots:w.bots,human:w.human,boxes:w.boxes,progress:[...w.context.progress],routes:w.context.routes?[...w.context.routes.states]:null};
}

for(const map of LAND_SIMULATION_MAPS)test(`shared CPU preserves pre-extraction state exactly on ${map}`,async()=>{
 const course=await loadLandSimulationCourse(map);
 for(const stage of ['start','fork','rail','finish'] as const){
  const old=world(course,stage),shared=world(course,stage),count=stage==='finish'?5:stage==='rail'?60:360;
  let rails=0;
  for(let i=0;i<count;i++){
   const frame={dt:1/60,elapsed:10+(i+1)/60};
   const expected=step(old,frame,true),actual=step(shared,frame,false);rails+=actual.filter(event=>event==='rail').length;
   assert.deepEqual(actual,expected,`${map}/${stage} callbacks at frame ${i}`);
   if(i%30===0||i===count-1)assert.deepEqual(snapshot(shared),snapshot(old),`${map}/${stage} state at frame ${i}`);
  }
  if(stage==='finish')for(const b of shared.bots){assert.ok(landCpuFinished(b,shared.context),`${map}/${b.id} finishes`);assert.ok(b.finishedAt!>10&&b.finishedAt!<10+1/60,`${map}/${b.id} interpolates the finish`);assert.equal(b.held,null);}
  if(stage==='rail'&&course.routes)assert.ok(rails>0,'real narrow alternate causes actual rail feedback');
 }
});

test('CPU feedback override activates items exactly once and seat IDs are tuning keys',async()=>{
 const course=await loadLandSimulationCourse('coast'),w=world(course,'start');
 const b=actor('seat-3',0,100,0);b.held='boost';b.decisionIn=0;
 const received:string[]=[];w.context.tuning=(id)=>{received.push(id);return {maxSpeed:42,multipliers:{acceleration:1,steering:1}};};
 const frame={dt:1/60,elapsed:1};let callbacks=0;
 decideLandCpu(b,[b],[],w.context,frame,{useItem:(a,r)=>{callbacks++;activateLandCpuItem(a,r,w.context);}});
 advanceLandCpu(b,w.context,frame);
 assert.equal(callbacks,1);assert.equal(b.uses,1);assert.equal(b.held,null);assert.equal(b.boost,3.3);assert.deepEqual(received,['seat-3']);
});

test('normal human collision keeps its own speed and lane loss; CPU collision never inherits it',async()=>{
 const course=await loadLandSimulationCourse('coast'),w=world(course,'start'),b=actor('seat-1',0,101,0);
 const human={id:'human',total:100,lateral:0,speed:40,held:null,boost:0,shield:0,slow:0};
 collideLandCpu(b,[human,b],w.context);assert.equal(b.speed,34);assert.equal(b.lateral,0);assert.equal(b.slow,.55);assert.equal(b.bump,.8);
 // Execute the current production player collision statement, with rendering
 // reduced to a cue recorder. This path deliberately stays outside land-cpu.
 const source=readFileSync(new URL('../src/game.ts',import.meta.url),'utf8');
 const line=source.split('\n').find(line=>line.includes('routes.collides(playerCombatant(),b)'));
 assert.ok(line,'normal player collision remains in the browser runtime');
 const apply=new Function('b','playerShield','nearbyGap','clamp',`
  const routes=null,LENGTH=${course.length},selectedDriverId='human',actorLimit=()=>5.5,shell={cue:()=>{}};
  let pos=100,lane=0,speed=40,hit=0,shield=playerShield;
  const playerCombatant=()=>({id:selectedDriverId,total:pos,lateral:lane,speed,shield});
  ${line}
  return {speed,lane,hit};`);
 assert.deepEqual(apply(b,0,nearbyGap,clamp),{speed:30.8,lane:-.55,hit:.55});
 assert.deepEqual(apply(b,6,nearbyGap,clamp),{speed:40,lane:0,hit:0});
});
