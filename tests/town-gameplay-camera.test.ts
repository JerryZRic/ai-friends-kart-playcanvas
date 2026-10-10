import test from 'node:test';
import assert from 'node:assert/strict';
import {TOWN_COURSE} from '../src/maps/town';
import {buildTownSceneGeometry} from '../src/town-scenery';
import {chaseCamera} from '../src/race-camera';
import {safeLandCamera} from '../src/land-camera';

test('both town bridge decks and branch roads retain finite unobstructed cameras in every orbit/rear/height mode',()=>{
 const geometry=buildTownSceneGeometry(TOWN_COURSE),boxes=geometry.cameraObstacles;
 let clipped=0,poses=0;
 for(const edge of Object.values(TOWN_COURSE.edges))for(let s=0;s<edge.length;s+=35)for(const view of [0,1])for(const rearView of [false,true])for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/2])for(const pitch of [-.28,0,.78]){
  const frame=edge.sample(s),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z};
  const desired=chaseCamera({position:frame.p,tangent:frame.t,view,rearView,orbit:{yaw,pitch}}).position;
  const safe=safeLandCamera(anchor,desired,boxes);assert.ok(Object.values(safe).every(Number.isFinite));
  if(Math.hypot(safe.x-desired.x,safe.y-desired.y,safe.z-desired.z)>.01)clipped++;
  const checked=safeLandCamera(anchor,safe,boxes);assert.ok(Math.hypot(safe.x-checked.x,safe.y-checked.y,safe.z-checked.z)<1e-6,'post-smoothing safety pose is unobstructed');
  for(const box of boxes)assert.ok(!(safe.x>box.min[0]&&safe.x<box.max[0]&&safe.y>box.min[1]&&safe.y<box.max[1]&&safe.z>box.min[2]&&safe.z<box.max[2]),'camera remains outside facade/bridge volumes');
  poses++;
 }
 assert.ok(poses>1500);assert.ok(clipped>0,'test exercises actual facade or soffit obstructions');
});
