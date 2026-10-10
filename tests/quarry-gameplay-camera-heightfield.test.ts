import test from 'node:test';
import assert from 'node:assert/strict';
import {safeLandCamera,cameraTerrainHeight,type CameraHeightfield} from '../src/land-camera';

const blocker=(heightfield:CameraHeightfield)=>({min:[heightfield.minX,0,heightfield.minZ],max:[heightfield.minX+heightfield.dx*(heightfield.columns-1),4,heightfield.minZ+heightfield.dz*(heightfield.rows-1)],heightfield});

test('camera source terrain follows triangle diagonals rather than bilinear interpolation',()=>{
 const field={minX:0,minZ:0,dx:1,dz:1,columns:2,rows:2,heights:[0,0,0,4]};
 assert.equal(cameraTerrainHeight(field,.25,.25),0);assert.equal(cameraTerrainHeight(field,.75,.75),2);
 assert.equal(cameraTerrainHeight(field,1,1),4);assert.equal(cameraTerrainHeight(field,-.01,0),null);
 const anchor={x:.1,y:1,z:.1},desired={x:.9,y:1,z:.9},safe=safeLandCamera(anchor,desired,[blocker(field)]);
 assert.ok(safe.x<.56875);assert.ok(safe.y>cameraTerrainHeight(field,safe.x,safe.z)!+.45);
 assert.deepEqual(safeLandCamera(anchor,safe,[blocker(field)]),safe,'rechecking a retracted or smoothed boom is idempotent');
});

test('exact terrain intervals detect a thin interior ridge even when both endpoints are clear and outside its grid',()=>{
 for(const dx of [1,.0001])for(const reverse of [false,true]){
  const field={minX:0,minZ:0,dx,dz:2,columns:3,rows:2,heights:[0,4,0,0,4,0]};
  const ends=[{x:-.1*dx,y:2,z:1},{x:2.1*dx,y:2,z:1}],anchor=ends[reverse?1:0],desired=ends[reverse?0:1];
  const safe=safeLandCamera(anchor,desired,[blocker(field)]);
  assert.ok(reverse?safe.x>1.6125*dx:safe.x<.3875*dx);
  assert.ok(safe.y>cameraTerrainHeight(field,safe.x,safe.z)!+.45);
 }
});

test('terrain blockers preserve the supported upper deck and existing facade-only behavior',()=>{
 const field={minX:-20,minZ:-20,dx:40,dz:40,columns:2,rows:2,heights:[0,0,0,0]};
 const anchor={x:0,y:25,z:0},desired={x:10,y:20,z:0};
 assert.deepEqual(safeLandCamera(anchor,desired,[blocker(field)]),desired,'low quarry terrain cannot pull an upper bridge camera down to another road');
 const box={min:[3,15,-2],max:[4,28,2]};
 assert.deepEqual(safeLandCamera(anchor,desired,[blocker(field),box]),safeLandCamera(anchor,desired,[box]));
});
