import test from 'node:test';
import assert from 'node:assert/strict';
import {TOWN_COURSE as course,TOWN_TRACK as track} from '../src/maps/town';
import {createLandRaceRoute} from '../src/land-race-route';
import {createCursor,createRouteProgress,resetCursor,sampleCursor,routeGap,type LandCursor,type RouteProgress} from '../src/land-routes';
import {CHARACTER_PROFILES} from '../src/character-profiles';
import {collectPickups,planLane,moveLane,newBrain,tickBrain,tickEffects,RULES,type Combatant,type RacingPickup} from '../src/npc-tactics';
import {createDynamicPickupDirector,type DynamicPickupTrack,type DynamicPickupRacer} from '../src/dynamic-pickups';
import {createRaceKartTuning,kartRoadContext} from '../src/kart-race';
import {defaultBuild} from '../src/kart-build';
import {npcSkill,npcDriving} from '../src/npc-difficulty';
import {COAST_DRIFT,coastDriftReady,coastDriftBoost} from '../src/coast-race-feedback';
import {landLookAheadBend,landRailScrape,landSteeringGrip,landBankDrift,stepLandSpeed} from '../src/land-driving';
import {clamp} from '../src/track';

const near=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
const actor=(id:string):Combatant=>({id,total:0,lateral:0,speed:0,held:null,boost:0,shield:0,slow:0});
const pickup=(edgeId:string,s:number,lateral=0):RacingPickup=>({edgeId,s,d:0,lateral,cool:0,display:'boost',mesh:{enabled:true},models:{boost:{enabled:true},shield:{enabled:false},pulse:{enabled:false},mystery:{enabled:false}}});
const locate=(edgeId:LandCursor['edgeId'],s:number,lateral=0):LandCursor=>({...createCursor(lateral),edgeId,s,choiceByLap:edgeId==='alley'||edgeId==='boulevard'?{0:edgeId}:{}});

test('player finish truncation restores an NPC physical position and unearned terminal checkpoint',()=>{
  const runtime=createLandRaceRoute(course,7);runtime.init('npc');
  const prior:RouteProgress={cursor:{...locate('finish',course.commonFinish.length-2),lap:2},nextGate:23,laps:2,finished:false};
  runtime.states.set('npc',prior);
  const completed=runtime.advance('npc',4,.1,0,'boulevard');
  near(completed.finishFraction!, .5);assert.equal(completed.state.nextGate,24);
  const truncated=runtime.truncateFrame('npc',prior,.1,.25);
  near(truncated.cursor.s,course.commonFinish.length-1);
  assert.equal(truncated.cursor.edgeId,'finish');assert.equal(truncated.cursor.lap,2);
  assert.equal(truncated.nextGate,23);assert.equal(truncated.laps,2);assert.equal(truncated.finished,false);
});

test('partial-frame replay also removes an intermediate gate crossed after the player finish',()=>{
  const runtime=createLandRaceRoute(course,7);runtime.init('npc');
  const gate=course.checkpointGates.find(g=>g.index===6)!.s;
  const prior:RouteProgress={cursor:{...locate('finish',gate-1),lap:2},nextGate:22,laps:2,finished:false};
  runtime.states.set('npc',prior);runtime.advance('npc',4,.1,2,'boulevard');
  assert.equal(runtime.get('npc').nextGate,23);
  const truncated=runtime.truncateFrame('npc',prior,.1,.125);
  near(truncated.cursor.s,gate-.5);near(truncated.cursor.lateral,.25);assert.equal(truncated.nextGate,22);
  assert.deepEqual(runtime.truncateFrame('npc',prior,.1,0),prior);
});

test('stationary and lateral-only physical pickup contacts retain earliest full-frame timing',()=>{
  const runtime=createLandRaceRoute(course,7),racer=actor('p');runtime.init('p');
  runtime.states.set('p',createRouteProgress(locate('alley',30)));
  runtime.advance('p',0,.1,0,'alley');
  const box=pickup('alley',30);
  assert.equal(runtime.contact({actor:racer,previous:0,previousLane:0},box),0);
  assert.equal(runtime.contact({actor:racer,previous:0,previousLane:0},pickup('boulevard',30)),null);
  collectPickups([{actor:racer,previous:0,previousLane:0}],[box],course.canonicalLength,()=>.5,runtime.contact);assert.equal(racer.held,'boost');
  runtime.states.set('p',createRouteProgress(locate('alley',30,-3)));
  runtime.advance('p',0,.1,3,'alley');
  near(runtime.contact({actor:racer,previous:0,previousLane:-3},pickup('alley',30))!,(3-1.25)/6);
});

test('terminal clipped pickup motion uses requested frame distance rather than its shortened sweep',()=>{
  const runtime=createLandRaceRoute(course,7),racer=actor('p');runtime.init('p');
  runtime.states.set('p',{cursor:{...locate('finish',course.commonFinish.length-4),lap:2},nextGate:23,laps:2,finished:false});
  runtime.advance('p',8,.1,0,'boulevard');
  const contact=runtime.contact({actor:racer,previous:0,previousLane:0},pickup('finish',course.commonFinish.length-1));
  near(contact!,1.2/8);
});

test('six supported characters own independent branch ledgers and reset clears every actor motion',()=>{
  const runtime=createLandRaceRoute(course,773);
  for(const [index,{id}] of CHARACTER_PROFILES.entries()){
    runtime.init(id,course.commonStart.length-.5,index%2?2:-2);
    const choice=index%2?'alley':'boulevard';runtime.advance(id,1,.1,index%2?2:-2,choice);
    assert.equal(runtime.cursor(id).edgeId,choice);assert.equal(runtime.cursor(id).choiceByLap[0],choice);
  }
  const snapshots=CHARACTER_PROFILES.slice(1).map(({id})=>structuredClone(runtime.get(id)));
  runtime.advance(CHARACTER_PROFILES[0].id,-2,.1,0,'alley');runtime.advance(CHARACTER_PROFILES[0].id,2,.1,0,'alley');
  assert.equal(runtime.cursor(CHARACTER_PROFILES[0].id).edgeId,'boulevard');
  assert.deepEqual(CHARACTER_PROFILES.slice(1).map(({id})=>runtime.get(id)),snapshots);
  runtime.reset();assert.equal(runtime.states.size,0);assert.equal(runtime.motions.size,0);
  for(const {id} of CHARACTER_PROFILES){runtime.init(id);assert.deepEqual(runtime.cursor(id).choiceByLap,{});assert.equal(runtime.get(id).nextGate,0);}
});

test('cursor recovery keeps the authored upper and lower bridge decks despite coincident map positions',()=>{
  const nearest=(edgeId:'start'|'finish')=>{
    const edge=course.edges[edgeId];let best=0,distance=Infinity;
    for(let s=0;s<edge.length;s+=.25){const p=edge.sample(s).p,d=Math.hypot(p.x,p.z+25.5);if(d<distance){distance=d;best=s;}}
    return locate(edgeId,best,3);
  };
  const lower=nearest('start'),upper=nearest('finish');
  const lowerReset=resetCursor(course,lower),upperReset=resetCursor(course,upper);
  near(lowerReset.s,lower.s);near(upperReset.s,upper.s);
  const a=sampleCursor(course,lowerReset).p,b=sampleCursor(course,upperReset).p;
  assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.5);assert.ok(b.y-a.y>20);
  assert.equal(lowerReset.edgeId,'start');assert.equal(upperReset.edgeId,'finish');
});

test('real-town dynamic box spawn respects the physical reaction window of a fast alley exit',()=>{
  const runtime=createLandRaceRoute(course,7);runtime.init('target');runtime.init('other');
  runtime.states.set('target',createRouteProgress(locate('finish',55)));
  runtime.states.set('other',createRouteProgress(locate('alley',course.edges.alley.length-8.5)));
  const target:DynamicPickupRacer={id:'target',total:runtime.total('target'),lateral:0,travelSpeed:6,maxSpeed:6,acceleration:0,reactionSpeed:6};
  const other:DynamicPickupRacer={id:'other',total:runtime.total('other'),lateral:0,travelSpeed:58,maxSpeed:58,acceleration:0,reactionSpeed:58,held:'shield'};
  const adapter:DynamicPickupTrack={length:course.canonicalLength,sample:track.sample,laneLimit:track.laneLimitAt,eligibility:runtime.eligible,racerPosition:r=>runtime.sample(r.id,r.lateral).p};
  const options={initialDelay:0,attempts:1,aheadJitter:0,rng:()=>.5};
  // Establish the regression on exact authored geometry, without an abstract
  // synthetic-distance fixture that could miss adapter errors.
  const legacyBox=pickup('start',0);delete legacyBox.edgeId;delete legacyBox.s;
  const unsafe=createDynamicPickupDirector([legacyBox],adapter,options).tick({dt:.1,active:true,racers:[target,other]});
  assert.equal(unsafe.length,1);
  const physical=routeGap(course,runtime.cursor('other'),runtime.boxCursor(legacyBox))!;
  near(physical,88.5);assert.ok(physical<58*1.4+8);assert.ok(legacyBox.d-other.total>58*1.4+8);
  const safeBox=pickup('start',0);delete safeBox.edgeId;delete safeBox.s;
  const safe=createDynamicPickupDirector([safeBox],{...adapter,racerGap:(r,d)=>runtime.gapToDistance(r.id,d),pickupPosition:runtime.pickupPosition},options).tick({dt:.1,active:true,racers:[target,other]});
  assert.equal(safe.length,0);
});

/** Uses the native game's pure NPC control/physics functions and decision
 * cadence. Models, traffic, items, DOM and GPU are deliberately excluded. */
function runNpc(seed:number,id:string,phase:number,difficulty:'easy'|'normal'|'hard') {
  const runtime=createLandRaceRoute(course,seed),skill=npcSkill(difficulty),dt=1/60;
  const compiled=createRaceKartTuning(defaultBuild,seed),selectedId=id==='whale'?'gpt':'whale';
  const bot={...actor(id),...newBrain(phase,(phase%2?1:-1)*3.2),aiBend:0,driftCharge:0,driftCooldown:0,aiDrifting:false};
  bot.lateral=bot.targetLane;runtime.init(id,0,bot.lateral);
  let frames=0,minY=Infinity,maxY=-Infinity,brakeFrames=0,driftFrames=0,maxStep=0;
  while(!runtime.get(id).finished&&frames++<21600){
    tickEffects(bot,dt);tickBrain(bot,dt);runtime.npcChoice(id);
    const road=runtime.view(id,bot.total),tuning=compiled(id,selectedId,kartRoadContext(bot.total,bot.speed,road.sample));
    if(bot.decisionIn<=0){
      bot.decisionIn=skill.decision+phase*.015;
      bot.aiBend=landLookAheadBend(road,bot.total,skill.lookAhead);
      const safeLane=Math.min(runtime.limit(id,0,.8),runtime.limit(id,22,.8));
      bot.targetLane=clamp(planLane(bot,[bot],[],course.canonicalLength,phase,bot.aiBend,skill,runtime.interactions),-safeLane,safeLane);
    }
    if(runtime.nearFork(id))bot.targetLane=runtime.npcChoice(id)==='alley'?2.8:-2.8;
    bot.driftCooldown=Math.max(0,bot.driftCooldown-dt);
    const control=npcDriving(bot.speed,tuning.maxSpeed*(bot.boost>0?RULES.boostFactor:1),bot.aiBend,skill,bot.driftCharge,bot.targetLane-bot.lateral);
    control.handbrake=control.drift=control.drift&&bot.driftCooldown===0;
    if(control.drift){bot.driftCharge=Math.min(COAST_DRIFT.maxCharge,bot.driftCharge+dt);driftFrames++;}
    else{if(bot.aiDrifting){if(!control.brake&&coastDriftReady(bot.driftCharge))bot.boost=Math.max(bot.boost,coastDriftBoost(bot.driftCharge));bot.driftCooldown=2;}bot.driftCharge=0;}
    if(control.brake)brakeFrames++;bot.aiDrifting=control.drift;
    const previous=runtime.sample(id).p,previousLane=bot.lateral;
    bot.speed=stepLandSpeed(road,bot.total,bot.speed,control,dt,tuning,bot.boost,bot.slow,Math.abs(bot.lateral)>runtime.limit(id,0,.9));
    const attempted=moveLane(bot.lateral,bot.targetLane,dt*tuning.multipliers.steering*landSteeringGrip(road,bot.total))+landBankDrift(road,bot.total,bot.speed,dt);
    const rail=landRailScrape(bot.speed,attempted,runtime.limit(id,0,.8),dt);bot.speed=rail.speed;bot.lateral=rail.lateral;
    const selected=runtime.npcChoice(id)==='alley'&&bot.lateral>.35?'alley':'boulevard';
    const progress=runtime.advance(id,bot.speed*dt,dt,bot.lateral,selected);
    assert.ok(progress.accepted,`${seed}/${id}/${difficulty}: ${progress.reason}`);bot.total=progress.total;
    bot.lateral=clamp(bot.lateral,-runtime.limit(id,0,.8),runtime.limit(id,0,.8));runtime.setLane(id,bot.lateral);
    const cursor=runtime.cursor(id),position=runtime.sample(id).p;
    assert.ok([bot.total,bot.lateral,bot.speed,position.x,position.y,position.z].every(Number.isFinite));
    assert.ok(cursor.s>=0&&cursor.s<=course.edges[cursor.edgeId].length);
    assert.ok(Math.abs(bot.lateral)<=runtime.limit(id,0,.8)+1e-8);
    const step=position.distance(previous);maxStep=Math.max(maxStep,step);
    assert.ok(step<=Math.abs(bot.speed*dt)*2+Math.abs(bot.lateral-previousLane)*2+.05,`${id} support jumped ${step}m at ${cursor.edgeId}`);
    minY=Math.min(minY,position.y);maxY=Math.max(maxY,position.y);
  }
  const state=runtime.get(id);
  assert.ok(state.finished,`${seed}/${id}/${difficulty} stalled at ${JSON.stringify(state.cursor)}`);
  assert.equal(state.laps,3);assert.equal(state.nextGate,24);assert.ok(maxY-minY>18);
  assert.ok(brakeFrames>0,'actual NPC braking is exercised');
  return {frames,brakeFrames,driftFrames,maxStep,branches:Object.values(state.cursor.choiceByLap),finish:state.cursor};
}

test('all six NPC builds finish both routes on every difficulty with repeated deterministic physical support',t=>{
  let races=0,maximumSeconds=0;
  for(const difficulty of ['easy','normal','hard'] as const)for(const [phase,{id}]of CHARACTER_PROFILES.entries()){
    const branches=new Set<string>();
    for(const seed of [72,713]){
      const first=runNpc(seed,id,phase,difficulty),repeat=runNpc(seed,id,phase,difficulty);
      assert.deepEqual(repeat,first,`${id}/${difficulty}/${seed} reproducibility`);
      first.branches.forEach(branch=>branches.add(branch));races+=2;maximumSeconds=Math.max(maximumSeconds,first.frames/60);
    }
    assert.deepEqual([...branches].sort(),['alley','boulevard'],`${id}/${difficulty} uses both physical alternatives`);
  }
  t.diagnostic(`${races} three-lap pure NPC races; all six builds × all three difficulties × two seeds × deterministic replay; slowest ${maximumSeconds.toFixed(2)}s`);
});
