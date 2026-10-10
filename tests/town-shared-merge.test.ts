import test from 'node:test';
import assert from 'node:assert/strict';
import {TOWN_COURSE as course} from '../src/maps/town';
import {createLandRaceRoute} from '../src/land-race-route';
import {advanceCursor,createCursor,createRouteProgress,routeGap,type BranchId,type ForkCourse,type RouteEdge,type LandCursor} from '../src/land-routes';
import {pulseTarget,planLane,activateItem,type Combatant} from '../src/npc-tactics';
import {npcSkill} from '../src/npc-difficulty';

const cursor=(edgeId:BranchId,remaining:number):LandCursor=>({...createCursor(),edgeId,s:course.edges[edgeId].length-remaining,choiceByLap:{0:edgeId}});
const near=(a:number,b:number,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);

test('the complete certified merge band has identical source positions, tangents and bank frames',()=>{
  assert.equal(course.sharedMergeLength,35);
  for(let remaining=0;remaining<=course.sharedMergeLength!;remaining+=.25){
    const a=course.edges.alley.sample(course.edges.alley.length-remaining),b=course.edges.boulevard.sample(course.edges.boulevard.length-remaining);
    for(const key of ['p','t','n','normal'] as const)near(a[key].distance(b[key]),0,key==='p'?.001:.00001);
    for(const lateral of [-4,0,4])near(course.edges.alley.sample(course.edges.alley.length-remaining,lateral).p.distance(course.edges.boulevard.sample(course.edges.boulevard.length-remaining,lateral).p),0,.001);
  }
});

test('shared throat physical gaps are signed, symmetric, continuous at merge, and bounded by certification',()=>{
  near(routeGap(course,cursor('alley',20),cursor('boulevard',15))!,5);
  near(routeGap(course,cursor('boulevard',15),cursor('alley',20))!,-5);
  near(routeGap(course,cursor('alley',35),cursor('boulevard',30))!,5);
  near(routeGap(course,cursor('alley',0),cursor('boulevard',0))!,0);
  const merged={...createCursor(),edgeId:'finish' as const,s:2};
  near(routeGap(course,cursor('alley',5),merged)!,7);
  near(routeGap(course,cursor('boulevard',5),merged)!,7);
  near(routeGap(course,cursor('alley',35.001),cursor('boulevard',30))!,5.001);
  near(routeGap(course,cursor('alley',30),cursor('boulevard',35.001))!,-5.001);
  near(routeGap(course,cursor('alley',40),cursor('boulevard',33))!,7);
  near(routeGap(course,cursor('boulevard',33),cursor('alley',40))!,-7);
  const reversed=advanceCursor(course,cursor('alley',20),-4,'boulevard').cursor;
  near(routeGap(course,reversed,cursor('boulevard',15))!,9);assert.equal(reversed.edgeId,'alley');assert.equal(reversed.choiceByLap[0],'alley');
  near(routeGap(course,advanceCursor(course,reversed,4,'boulevard').cursor,cursor('boulevard',15))!,5);
  for(const [a,b]of [[cursor('alley',35.001),cursor('boulevard',40)],[cursor('alley',100),cursor('boulevard',95)],[cursor('alley',-1),cursor('boulevard',0)]])assert.equal(routeGap(course,a,b),null);
});

test('cars on shared pavement remain visible to pulse targeting, shield response and traffic avoidance',()=>{
  const runtime=createLandRaceRoute(course,7);
  const actor=(id:string):Combatant=>({id,total:0,lateral:0,speed:30,held:'pulse',boost:0,shield:0,slow:0});
  const a=actor('a'),b=actor('b');runtime.init(a.id);runtime.init(b.id);
  runtime.states.set(a.id,createRouteProgress(cursor('alley',20)));runtime.states.set(b.id,createRouteProgress(cursor('boulevard',15)));
  a.total=runtime.total(a.id);b.total=runtime.total(b.id);
  near(runtime.sample(a.id).p.distance(runtime.sample(b.id).p),5,.001);
  assert.equal(pulseTarget(a,[a,b],course.canonicalLength,runtime.interactions),b);
  near(planLane(a,[a,b],[],course.canonicalLength,0,0,npcSkill('hard'),runtime.interactions),2.4);
  b.shield=1;assert.equal(activateItem(a,[a,b],course.canonicalLength,runtime.interactions)?.blocked,true);assert.equal(b.slow,0);
  a.held='pulse';b.shield=0;activateItem(a,[a,b],course.canonicalLength,runtime.interactions);assert.equal(b.slow,3);
  assert.equal(pulseTarget(b,[a,b],course.canonicalLength,runtime.interactions),undefined,'the rear car is not a forward target');
  runtime.states.set(a.id,createRouteProgress(cursor('alley',40)));runtime.states.set(b.id,createRouteProgress(cursor('boulevard',33)));
  a.total=runtime.total(a.id);b.total=runtime.total(b.id);a.held='pulse';
  assert.equal(pulseTarget(a,[a,b],course.canonicalLength,runtime.interactions),b,'approaching cars see traffic already in the shared throat');
  near(planLane(a,[a,b],[],course.canonicalLength,0,0,npcSkill('hard'),runtime.interactions),2.4);
});

test('missing or malformed overlap certification cannot permit cross-branch effects',()=>{
  const a=cursor('alley',20),b=cursor('boulevard',15);
  for(const sharedMergeLength of [undefined,0,-1,NaN,Infinity,course.edges.alley.length+1])assert.equal(routeGap({...course,sharedMergeLength},a,b),null);
  assert.equal(routeGap(course,{...a,s:NaN},b),null);
  assert.equal(routeGap(course,a,{...b,s:Infinity}),null);
});

test('source position, heading, lateral frame and normal disagreements fail closed at either actor distance',()=>{
  for(const remaining of [20,15])for(const kind of ['height','heading','lateral','normal','nonfinite'] as const){
    const original=course.edges.boulevard;
    const changed:RouteEdge={...original,sample(s,lateral=0){
      const sample=original.sample(s,lateral);
      if(Math.abs(original.length-s-remaining)<.001){
        if(kind==='height')sample.p.y+=.1;
        if(kind==='heading')sample.t.x+=.1;
        if(kind==='lateral')sample.n.y+=.1;
        if(kind==='normal')sample.normal.x+=.1;
        if(kind==='nonfinite')sample.p.y=NaN;
      }
      return sample;
    }};
    const altered:ForkCourse={...course,edges:{...course.edges,boulevard:changed},alternates:{...course.alternates,boulevard:changed}};
    assert.equal(routeGap(altered,cursor('alley',20),cursor('boulevard',15)),null,`${kind} at ${remaining}`);
  }
});
