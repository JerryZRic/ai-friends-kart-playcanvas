import test from 'node:test';
import assert from 'node:assert/strict';
import {TOWN_COURSE as c} from '../src/maps/town';
import {createCursor,advanceCursor,sampleCursor,sampleAhead,canonicalProgress,routeGap,resetCursor,createRouteProgress,advanceRouteProgress,rebaseRouteProgress,type BranchId} from '../src/land-routes';
const near=(a:number,b:number,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('split residual is physical; alternatives consume identical speed times dt',()=>{
  const initial={...createCursor(),s:c.edges.start.length-3};
  for(const choice of ['alley','boulevard'] as const){const step=advanceCursor(c,initial,153,choice);assert.equal(step.cursor.edgeId,choice);near(step.cursor.s,150);near(step.physicalTravel,153);assert.equal(step.sweeps.length,2);assert.equal(step.cursor.choiceByLap[0],choice);}
  const a=advanceCursor(c,initial,153,'alley'),b=advanceCursor(c,initial,153,'boulevard');assert.ok(a.canonicalAfter>b.canonicalAfter);near(sampleAhead(c,initial,153,'alley').p.clone().sub(sampleCursor(c,a.cursor).p).length(),0);
});
test('exact boundaries, reverse and reset preserve route selection without drifting',()=>{
  for(const choice of ['alley','boulevard'] as const){const selected=advanceCursor(c,createCursor(),c.edges.start.length,choice).cursor;assert.equal(selected.edgeId,choice);near(selected.s,0);
    const backwards=advanceCursor(c,selected,-12,choice).cursor,again=advanceCursor(c,backwards,17,choice==='alley'?'boulevard':'alley').cursor;assert.equal(again.edgeId,choice);near(again.s,5);
    const reset=resetCursor(c,{...again,lateral:4});assert.equal(reset.edgeId,choice);near(reset.s,5);near(reset.lateral,0);assert.equal(reset.choiceByLap[0],choice);
    const lapLength=c.edges.start.length+c.edges[choice].length+c.edges.finish.length;
    const forward=advanceCursor(c,createCursor(),lapLength+10,choice).cursor;assert.equal(forward.lap,1);assert.equal(forward.edgeId,'start');near(forward.s,10);const reverse=advanceCursor(c,forward,-lapLength,choice).cursor;near(canonicalProgress(c,reverse),10);
  }
});
test('three laps complete only ordered actual gates at all supported frame steps',()=>{
  for(const choice of ['alley','boulevard'] as const)for(const dt of [1/30,1/60,1/144,.25]){
    let state=createRouteProgress(),frames=0,finishFraction:number|undefined;
    while(!state.finished&&frames++<25000){const result=advanceRouteProgress(c,state,36*dt,dt,choice);assert.ok(result.accepted);state=result.state;finishFraction=result.finishFraction;}
    assert.ok(state.finished,`${choice}/${dt}`);assert.equal(state.laps,3);assert.equal(state.nextGate,24);assert.ok(finishFraction!==undefined&&finishFraction>0&&finishFraction<=1);
    assert.ok(Object.keys(state.cursor.choiceByLap).length<=4);
  }
});
test('teleports, skipped gates, reverse farming, and off-support sweeps earn no credit',()=>{
  const state=createRouteProgress();assert.equal(advanceRouteProgress(c,state,30,.1).reason,'teleport');assert.equal(advanceRouteProgress(c,state,1,1).reason,'invalid-step');
  let skipped=rebaseRouteProgress(state,{...createCursor(),edgeId:'finish',s:c.edges.finish.length-2});skipped=advanceRouteProgress(c,skipped,5,.1).state;assert.equal(skipped.nextGate,0);assert.equal(skipped.laps,0);
  let farm=createRouteProgress({...createCursor(),s:c.checkpointGates[0].s-1});farm=advanceRouteProgress(c,farm,2,.1).state;assert.equal(farm.nextGate,1);for(let i=0;i<20;i++){farm=advanceRouteProgress(c,farm,-2,.1).state;farm=advanceRouteProgress(c,farm,2,.1).state;}assert.equal(farm.nextGate,1);
  const off=advanceRouteProgress(c,createRouteProgress({...createCursor(),s:c.checkpointGates[0].s-1,lateral:20}),2,.1);assert.equal(off.state.nextGate,0);
});
test('physical gap prevents cross-branch interactions and uses real remaining length after merge',()=>{
  const alley=advanceCursor(c,createCursor(),c.edges.start.length+100,'alley').cursor,boulevard=advanceCursor(c,createCursor(),c.edges.start.length+100,'boulevard').cursor;
  assert.equal(routeGap(c,alley,boulevard),null);near(routeGap(c,alley,{...alley,s:110})!,10);
  const before={...alley,s:c.edges.alley.length-10},after={...alley,edgeId:'finish' as const,s:15};near(routeGap(c,before,after)!,25);
});
test('long deterministic traversal and reverse use bounded ledger',()=>{
  const run=()=>{let cursor=createCursor();for(let i=0;i<20000;i++)cursor=advanceCursor(c,cursor,i%9===0?-1.25:2.5,i%2?'alley':'boulevard').cursor;return cursor;};
  const a=run(),b=run();assert.deepEqual(a,b);assert.ok(Object.keys(a.choiceByLap).length<=4);assert.ok(Number.isFinite(canonicalProgress(c,a)));
});
test('reset cannot override an already selected alternate and reverse records the starting lap',()=>{
  const alley=advanceCursor(c,createCursor(),c.edges.start.length+10,'alley').cursor,state=createRouteProgress(alley);
  assert.equal(rebaseRouteProgress(state,{...alley,edgeId:'boulevard',choiceByLap:{0:'boulevard'}}),state);
  const backwards=advanceCursor(c,createCursor(),-c.edges.finish.length-2).cursor;assert.equal(backwards.edgeId,'boulevard');assert.equal(backwards.choiceByLap[-1],'boulevard');
});
test('terminal finish consumes only physical travel up to the third finish gate',()=>{
  const cursor={...createCursor(),lap:2,edgeId:'finish' as const,s:c.edges.finish.length-1};
  const result=advanceRouteProgress(c,{cursor,nextGate:23,laps:2,finished:false},4,.1);
  assert.ok(result.state.finished);near(result.finishFraction!, .25);near(result.advance!.physicalTravel,1);near(result.state.cursor.s,0);assert.equal(result.state.cursor.lap,3);
});
