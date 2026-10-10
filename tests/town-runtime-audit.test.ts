import {runForkNpc} from './helpers/fork-npc-benchmark';
import test from 'node:test';
import assert from 'node:assert/strict';
import {TOWN_COURSE as course,TOWN_TRACK as track} from '../src/maps/town';
import {createLandRaceRoute} from '../src/land-race-route';
import {createCursor,createRouteProgress,resetCursor,sampleCursor,routeGap,type LandCursor,type RouteProgress} from '../src/land-routes';
import {CHARACTER_PROFILES} from '../src/character-profiles';
import {collectPickups,type Combatant,type RacingPickup} from '../src/npc-tactics';
import {createDynamicPickupDirector,type DynamicPickupTrack,type DynamicPickupRacer} from '../src/dynamic-pickups';

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

test('all six NPC builds finish both routes on every difficulty with repeated deterministic physical support',t=>{
  let races=0,maximumSeconds=0;
  for(const difficulty of ['easy','normal','hard'] as const)for(const [phase,{id}]of CHARACTER_PROFILES.entries()){
    const branches=new Set<string>();
    for(const seed of [72,713]){
      const first=runForkNpc(course,seed,id,phase,difficulty),repeat=runForkNpc(course,seed,id,phase,difficulty);
      assert.deepEqual(repeat,first,`${id}/${difficulty}/${seed} reproducibility`);
      first.branches.forEach(branch=>branches.add(branch));races+=2;maximumSeconds=Math.max(maximumSeconds,first.frames/60);
    }
    assert.deepEqual([...branches].sort(),['alley','boulevard'],`${id}/${difficulty} uses both physical alternatives`);
  }
  t.diagnostic(`${races} three-lap pure NPC races; all six builds × all three difficulties × two seeds × deterministic replay; slowest ${maximumSeconds.toFixed(2)}s`);
});
