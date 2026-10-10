import test from 'node:test';
import assert from 'node:assert/strict';
import {safeLandCamera,cameraMeshCandidateIds,type CameraBlocker} from '../src/land-camera';
const slab=(y:number,x=0,z=0,w=10,d=10):number[][][]=>[[[x-w,y,z-d],[x+w,y,z-d],[x-w,y,z+d]],[[x+w,y,z-d],[x+w,y,z+d],[x-w,y,z+d]]];
const blocker=(triangles:number[][][]):CameraBlocker=>({min:[-100,-100,-100],max:[100,100,100],triangles});
const length=(a:any,b:any)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
test('triangle camera preserves open annulus holes and does not invent an upper-deck fill',()=>{
  const annulus=[...slab(20,-15,0,5,20),...slab(20,15,0,5,20),...slab(20,0,-15,10,5),...slab(20,0,15,10,5)],mesh=blocker(annulus);
  const anchor={x:0,y:0,z:0},desired={x:0,y:40,z:0};assert.deepEqual(safeLandCamera(anchor,desired,[mesh]),desired);
  const a={x:15,y:5,z:0},d={x:15,y:35,z:0},safe=safeLandCamera(a,d,[mesh]);assert.ok(safe.y>18&&safe.y<19.56);
  assert.deepEqual(safeLandCamera({x:0,y:7,z:0},{x:15,y:14,z:0},[blocker(slab(36))]),{x:15,y:14,z:0});
  assert.deepEqual(safeLandCamera({x:0,y:38,z:0},{x:15,y:45,z:0},[blocker(slab(36))]),{x:15,y:45,z:0});
});
test('two-sided swept-sphere faces keep a real margin above and below thin/banked decks',()=>{
  for(const sign of [-1,1]){const a={x:0,y:10+sign*10,z:0},d={x:0,y:10-sign*10,z:0},safe=safeLandCamera(a,d,[blocker(slab(10))]);assert.ok(sign*(safe.y-10)>=.45);assert.ok(sign*(safe.y-10)<1);}
  const mesh=blocker([[[-10,0,-10],[10,10,-10],[-10,0,10]],[[10,10,-10],[10,10,10],[-10,0,10]]]);const a={x:0,y:15,z:0},d={x:0,y:-5,z:0},safe=safeLandCamera(a,d,[mesh]);assert.ok(safe.y>5.5&&safe.y<6.1);
});
test('edge capsules and vertex spheres catch near-misses without using a broad bounding box',()=>{
  const triangle=blocker([[[0,0,0],[10,0,0],[0,0,10]]]);
  const a={x:-.2,y:5,z:5},d={x:-.2,y:-5,z:5};assert.ok(safeLandCamera(a,d,[triangle]).y>.4);
  assert.deepEqual(safeLandCamera({x:8,y:5,z:8},{x:8,y:-5,z:8},[triangle]),{x:8,y:-5,z:8});
  assert.ok(safeLandCamera({x:-.2,y:5,z:-.2},{x:-.2,y:-5,z:-.2},[triangle]).y>.2);
});
test('on-surface anchors may escape; zero-length, parallel and degenerate inputs remain finite',()=>{
  const mesh=blocker(slab(0)),anchor={x:0,y:.1,z:0},desired={x:0,y:5,z:0};assert.deepEqual(safeLandCamera(anchor,desired,[mesh]),desired);
  assert.deepEqual(safeLandCamera(anchor,anchor,[mesh]),anchor);
  assert.deepEqual(safeLandCamera({x:0,y:1,z:0},{x:5,y:1,z:0},[mesh]),{x:5,y:1,z:0});
  assert.deepEqual(safeLandCamera({x:0,y:5,z:0},{x:0,y:-5,z:0},[blocker([[[0,0,0],[0,0,0],[0,0,0]]])]),{x:0,y:-5,z:0});
});
test('mesh broadphase queries only a local corridor from a cached immutable source array',()=>{
  const triangles=Array.from({length:1000},(_,i)=>slab(0,i*50,0,5,5)).flat(),a={x:1,y:5,z:0},d={x:3,y:-5,z:0};
  const ids=cameraMeshCandidateIds(triangles,a,d);assert.ok(ids.length<=4);assert.deepEqual(cameraMeshCandidateIds(triangles,a,d),ids);assert.ok(safeLandCamera(a,d,[blocker(triangles)]).y>.45);
});
test('old boxes and terrain retain exact behavior when no triangle blocker is present',()=>{
  const boxes:CameraBlocker[]=[{min:[-2,1,-2],max:[2,2,2]}],a={x:0,y:5,z:0},d={x:0,y:0,z:0};assert.deepEqual(safeLandCamera(a,d,boxes),{x:0,y:2.55,z:0});
  const field:CameraBlocker={min:[-10,0,-10],max:[10,0,10],heightfield:{minX:-10,minZ:-10,dx:20,dz:20,columns:2,rows:2,heights:[0,0,0,0]}};assert.deepEqual(safeLandCamera(a,d,[field]),{x:0,y:.5500000000000007,z:0});
  assert.equal(length(safeLandCamera({x:0,y:1.5,z:0},{x:0,y:5,z:0},boxes),{x:0,y:5,z:0}),0);
});
