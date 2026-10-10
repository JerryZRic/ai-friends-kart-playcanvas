import test from 'node:test';
import assert from 'node:assert/strict';
import {FOREST_COURSE as c,FOREST_LANDMARKS} from '../src/maps/forest';
import {advanceCursor,advanceRouteProgress,canonicalProgress,createCursor,createRouteProgress,rebaseRouteProgress,resetCursor,sampleAhead,sampleCursor,type BranchId,type LandCursor} from '../src/land-routes';

const choices=['alley','boulevard'] as const;
const near=(a:number,b:number,t=1e-7) => assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const lapLength=(choice:BranchId) => c.commonStart.length+c.alternates[choice].length+c.commonFinish.length;

test('equal signed physical movement remains equal through either fork, independent of ranking scale',()=>{
  for(const selected of choices){
    const before={...createCursor(),s:c.commonStart.length-3},step=advanceCursor(c,before,153,selected);
    assert.equal(step.cursor.edgeId,selected);assert.equal(step.cursor.choiceByLap[0],selected);
    near(step.cursor.s,150);near(step.physicalTravel,153);
    assert.deepEqual(step.sweeps.map(s=>({id:s.edgeId,from:s.from,to:s.to,travelBefore:s.travelBefore})),[
      {id:'start',from:c.commonStart.length-3,to:c.commonStart.length,travelBefore:0},
      {id:selected,from:0,to:150,travelBefore:3},
    ]);
    near(sampleAhead(c,before,153,selected).p.distance(sampleCursor(c,step.cursor).p),0);
  }
  const a=advanceCursor(c,createCursor(),c.commonStart.length+150,'alley');
  const b=advanceCursor(c,createCursor(),c.commonStart.length+150,'boulevard');
  near(a.physicalTravel,b.physicalTravel);assert.ok(a.canonicalAfter>b.canonicalAfter);
  assert.ok(sampleCursor(c,a.cursor).p.distance(sampleCursor(c,b.cursor).p)>45,'ranking must never substitute one support path for the other');
});

test('every exact route boundary, reverse traversal and reset retains the selected branch ledger',()=>{
  for(const selected of choices){
    const other=selected==='alley'?'boulevard':'alley';
    const split=advanceCursor(c,createCursor(),c.commonStart.length,selected).cursor;
    assert.equal(split.edgeId,selected);near(split.s,0);
    const reverse=advanceCursor(c,split,-12,other).cursor;
    assert.equal(reverse.edgeId,'start');near(reverse.s,c.commonStart.length-12);
    const repeated=advanceCursor(c,reverse,17,other).cursor;
    assert.equal(repeated.edgeId,selected);near(repeated.s,5);assert.equal(repeated.choiceByLap[0],selected);
    const merge=advanceCursor(c,split,c.alternates[selected].length,other).cursor;
    assert.equal(merge.edgeId,'finish');near(merge.s,0);
    const throughMerge=advanceCursor(c,merge,-25,other).cursor;
    assert.equal(throughMerge.edgeId,selected);near(throughMerge.s,c.alternates[selected].length-25);
    const reset=resetCursor(c,{...throughMerge,lateral:9});
    assert.equal(reset.edgeId,selected);near(reset.s,throughMerge.s);near(reset.lateral,0);
    assert.equal(reset.choiceByLap[0],selected);near(sampleCursor(c,reset).p.distance(c.edges[selected].sample(reset.s).p),0);
    const nextLap=advanceCursor(c,createCursor(),lapLength(selected)+10,selected).cursor;
    assert.equal(nextLap.lap,1);assert.equal(nextLap.edgeId,'start');near(nextLap.s,10);
    const backwardsLap=advanceCursor(c,nextLap,-lapLength(selected),other).cursor;
    near(canonicalProgress(c,backwardsLap),10);assert.equal(backwardsLap.choiceByLap[0],selected);
    const state=createRouteProgress(repeated);
    assert.equal(rebaseRouteProgress(state,{...repeated,edgeId:other,choiceByLap:{0:other}}),state);
  }
});

test('checkpoint definitions cover equivalent ordered physical support on both branches',()=>{
  assert.equal(c.gatesPerLap,8);assert.equal(c.checkpointGates.length,10);
  for(const choice of choices){
    const routeGates=c.checkpointGates.filter(g=>g.edgeId==='start'||g.edgeId===choice||g.edgeId==='finish');
    assert.deepEqual(routeGates.map(g=>g.index),[0,1,2,3,4,5,6,7]);
    for(const gate of routeGates){
      const edge=c.edges[gate.edgeId];assert.ok(gate.s>0&&gate.s<=edge.length);
      for(const lateral of [-edge.laneLimitAt(gate.s),0,edge.laneLimitAt(gate.s)]){
        const frame=edge.sample(gate.s,lateral);assert.ok([frame.p.x,frame.p.y,frame.p.z].every(Number.isFinite));
      }
    }
    near(routeGates.at(-1)!.s,c.commonFinish.length);
  }
});

test('three physical laps finish at every supported frame step and stop at the final subframe',()=>{
  for(const choice of choices)for(const hz of [30,60,120,144,240,4]){
    const dt=1/hz;let state=createRouteProgress(),frames=0,physicalTravel=0,finishFraction:number|undefined;
    while(!state.finished&&frames++<60000){
      const result=advanceRouteProgress(c,state,36*dt,dt,choice);
      assert.equal(result.accepted,true);assert.ok(result.advance);
      physicalTravel+=result.advance.physicalTravel;state=result.state;finishFraction=result.finishFraction;
    }
    assert.equal(state.finished,true,`${choice} at ${hz}Hz`);
    assert.equal(state.laps,3);assert.equal(state.nextGate,24);assert.equal(state.cursor.lap,3);
    assert.equal(state.cursor.edgeId,'start');near(state.cursor.s,0);
    assert.ok(finishFraction!==undefined&&finishFraction>0&&finishFraction<=1);
    near(physicalTravel,lapLength(choice)*3,1e-5);
    assert.deepEqual(state.cursor.choiceByLap,{0:choice,1:choice,2:choice});
    const terminal=advanceRouteProgress(c,state,2,dt,choice);
    assert.equal(terminal.state,state);assert.equal(terminal.advance,undefined);
  }
});

test('teleports, omitted branch gates, reverse farming and off-support crossings earn no lap credit',()=>{
  const empty=createRouteProgress();
  assert.equal(advanceRouteProgress(c,empty,30,.1).reason,'teleport');
  assert.equal(advanceRouteProgress(c,empty,1,1).reason,'invalid-step');
  assert.equal(advanceRouteProgress(c,empty,NaN,.1).reason,'invalid-step');
  for(const choice of choices){
    let skipped=rebaseRouteProgress(empty,{...createCursor(),edgeId:'finish',s:c.commonFinish.length-2,choiceByLap:{0:choice}});
    skipped=advanceRouteProgress(c,skipped,5,.1,choice).state;
    assert.equal(skipped.nextGate,0);assert.equal(skipped.laps,0);assert.equal(skipped.finished,false);
    const branchGate=c.checkpointGates.find(g=>g.edgeId===choice&&g.index===2)!;
    const atGate:LandCursor={...createCursor(),edgeId:choice,s:branchGate.s-1,choiceByLap:{0:choice}};
    let farm={...createRouteProgress(atGate),nextGate:2};
    farm=advanceRouteProgress(c,farm,2,.1,choice).state;assert.equal(farm.nextGate,3);
    for(let i=0;i<20;i++){
      farm=advanceRouteProgress(c,farm,-2,.1,choice).state;
      farm=advanceRouteProgress(c,farm,2,.1,choice).state;
    }
    assert.equal(farm.nextGate,3);assert.equal(farm.laps,0);
    const unsupported={...createRouteProgress({...atGate,lateral:c.edges[choice].laneLimitAt(branchGate.s)+.1}),nextGate:2};
    const off=advanceRouteProgress(c,unsupported,2,.1,choice);
    assert.equal(off.state.nextGate,2);assert.equal(off.state.laps,0);
    const wrongLap={...createRouteProgress({...atGate,lap:1}),nextGate:2};
    assert.equal(advanceRouteProgress(c,wrongLap,2,.1,choice).state.nextGate,2);
    const reverseOnly={...createRouteProgress({...atGate,s:branchGate.s+1}),nextGate:2};
    assert.equal(advanceRouteProgress(c,reverseOnly,-2,.1,choice).state.nextGate,2);
  }
});

test('crossing resets keep correct physical deck and cannot award unearned progress',()=>{
  const bridge=FOREST_LANDMARKS.crossing;
  for(const [edgeId,s,y] of [[bridge.lowerEdge,bridge.lowerS,bridge.lowerY],[bridge.upperEdge,bridge.upperS,bridge.upperY]] as const){
    const safe=resetCursor(c,{...createCursor(),edgeId,s,lateral:8});
    assert.equal(safe.edgeId,edgeId);near(safe.s,s);near(safe.lateral,0);near(sampleCursor(c,safe).p.y,y);
    const rebased=rebaseRouteProgress(createRouteProgress(),safe);
    assert.equal(rebased.nextGate,0);assert.equal(rebased.laps,0);
    assert.equal(advanceRouteProgress(c,rebased,2,.1).state.nextGate,0);
  }
});

test('mixed branch choices, repeated reverse and long traversal maintain a bounded deterministic ledger',()=>{
  const run=()=>{
    let cursor=createCursor();
    for(let i=0;i<24000;i++)cursor=advanceCursor(c,cursor,i%9===0?-1.25:2.5,i%2?'alley':'boulevard').cursor;
    return cursor;
  };
  const a=run(),b=run();assert.deepEqual(a,b);assert.ok(Number.isFinite(canonicalProgress(c,a)));
  assert.ok(Object.keys(a.choiceByLap).length<=4);
  const backwards=advanceCursor(c,createCursor(),-c.commonFinish.length-2).cursor;
  assert.equal(backwards.lap,-1);assert.equal(backwards.edgeId,'boulevard');assert.equal(backwards.choiceByLap[-1],'boulevard');
  let mixed=createCursor();
  for(const choice of ['alley','boulevard','alley'] as const)mixed=advanceCursor(c,mixed,lapLength(choice),choice).cursor;
  assert.equal(mixed.lap,3);assert.deepEqual(mixed.choiceByLap,{0:'alley',1:'boulevard',2:'alley'});
});

test('terminal finish consumes the exact remaining physical metre with no third-lap overshoot',()=>{
  const cursor={...createCursor(),lap:2,edgeId:'finish' as const,s:c.commonFinish.length-1};
  const result=advanceRouteProgress(c,{cursor,nextGate:23,laps:2,finished:false},4,.1);
  assert.equal(result.state.finished,true);near(result.finishFraction!,.25);near(result.advance!.physicalTravel,1);
  near(result.state.cursor.s,0);assert.equal(result.state.cursor.lap,3);
});
