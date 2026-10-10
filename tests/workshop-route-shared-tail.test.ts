import test from 'node:test';
import assert from 'node:assert/strict';
import {WORKSHOP_COURSE as c,WORKSHOP_SHARED_MERGE_LENGTH,WORKSHOP_MERGE_TAIL} from '../src/maps/workshop';
import {advanceCursor,createCursor,routeGap,type BranchId,type LandCursor,type ForkCourse,type RouteEdge} from '../src/land-routes';

const near=(a:number,b:number,t=1e-10) => assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const cursor=(edgeId:BranchId,remaining:number):LandCursor => ({...createCursor(),edgeId,s:c.edges[edgeId].length-remaining,choiceByLap:{0:edgeId}});

test('entire declared 40m tail has identical support position, complete frame, bank, width and surface',()=>{
  assert.equal(c.sharedMergeLength,40);assert.equal(c.sharedMergeLength,WORKSHOP_SHARED_MERGE_LENGTH);
  assert.equal(WORKSHOP_MERGE_TAIL.length,c.sharedMergeLength);
  for(let remaining=0;remaining<=c.sharedMergeLength!;remaining+=.125){
    const as=c.edges.alley.length-remaining,bs=c.edges.boulevard.length-remaining;
    for(const lateral of [-9.5,-4.75,0,4.75,9.5]){
      const a=c.edges.alley.sample(as,lateral),b=c.edges.boulevard.sample(bs,lateral);
      for(const key of ['p','t','n','normal'] as const)near(a[key].distance(b[key]),0);
      near(a.bank,b.bank);near(a.grade,b.grade);near(a.bank,0);near(a.grade,0);
    }
    near(c.edges.alley.halfWidthAt(as),c.edges.boulevard.halfWidthAt(bs));
    near(c.edges.alley.halfWidthAt(as),9.5);
    near(c.edges.alley.laneLimitAt(as),c.edges.boulevard.laneLimitAt(bs));
    near(c.edges.alley.laneLimitAt(as),8.85);
    assert.deepEqual(c.edges.alley.surfaceAt(as),c.edges.boulevard.surfaceAt(bs));
    assert.deepEqual(c.edges.alley.surfaceAt(as),{kind:'workshop-sealed-wood',grip:.99,rollingResistance:1.02});
  }
});

test('shared gap uses signed physical metres on both branches and is continuous through merge/reverse',()=>{
  for(const [ar,br,gap] of [[30,12,18],[55,12,43],[40,40,0],[40.001,30,10.001],[30,40.001,-10.001],[0,0,0],[20,15,5]]){
    near(routeGap(c,cursor('alley',ar),cursor('boulevard',br))!,gap);
    near(routeGap(c,cursor('boulevard',br),cursor('alley',ar))!,-gap);
  }
  for(const [ar,br] of [[40.001,40.001],[80,90],[120,130]])assert.equal(routeGap(c,cursor('alley',ar),cursor('boulevard',br)),null);
  const merged={...createCursor(),edgeId:'finish' as const,s:2};
  for(const branch of ['alley','boulevard'] as const)near(routeGap(c,cursor(branch,5),merged)!,7);
  const reversed=advanceCursor(c,cursor('alley',20),-4,'boulevard').cursor;
  assert.equal(reversed.edgeId,'alley');assert.equal(reversed.choiceByLap[0],'alley');
  near(routeGap(c,reversed,cursor('boulevard',15))!,9);
  near(routeGap(c,advanceCursor(c,reversed,4,'boulevard').cursor,cursor('boulevard',15))!,5);
});

test('missing certification and malformed physical cursors cannot enable cross-branch interaction',()=>{
  for(const sharedMergeLength of [undefined,0,-1,NaN,Infinity,c.edges.alley.length+1]){
    assert.equal(routeGap({...c,sharedMergeLength},cursor('alley',20),cursor('boulevard',15)),null);
  }
  for(const bad of [NaN,Infinity,-1,c.edges.alley.length+1]){
    assert.equal(routeGap(c,{...cursor('alley',20),s:bad},cursor('boulevard',15)),null);
  }
});

test('altered source position, heading or bank frame fails closed at either certified cursor',()=>{
  for(const remaining of [20,15])for(const key of ['p','t','n','normal'] as const){
    const source=c.edges.boulevard;
    const changed:RouteEdge={...source,sample(s,lateral=0){
      const frame=source.sample(s,lateral);
      if(Math.abs(source.length-s-remaining)<.001)frame[key].y+=.1;
      return frame;
    }};
    const altered:ForkCourse={...c,edges:{...c.edges,boulevard:changed},alternates:{...c.alternates,boulevard:changed}};
    assert.equal(routeGap(altered,cursor('alley',20),cursor('boulevard',15)),null,`${key} at ${remaining}`);
  }
});
