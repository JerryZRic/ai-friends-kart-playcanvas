import test from 'node:test';
import assert from 'node:assert/strict';
import {FOREST_COURSE} from '../src/maps/forest';
import {buildForestSceneGeometry} from '../src/forest-scenery';
import {chaseCamera} from '../src/race-camera';
import {safeLandCamera,cameraTerrainHeight} from '../src/land-camera';

test('both forest root-valley decks and branch roads retain finite unobstructed cameras in every orbit/rear/height mode',t=>{
 const geometry=buildForestSceneGeometry(FOREST_COURSE),boxes=geometry.cameraObstacles;
 let clipped=0,poses=0;
 for(const edge of Object.values(FOREST_COURSE.edges))for(let s=0;s<edge.length;s+=35)for(const lane of [-edge.laneLimitAt(s),0,edge.laneLimitAt(s)])for(const view of [0,1])for(const rearView of [false,true])for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/2])for(const pitch of [-.28,0,.78]){
  const frame=edge.sample(s,lane),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z};
  const desired=chaseCamera({position:frame.p,tangent:frame.t,view,rearView,orbit:{yaw,pitch}}).position;
  const safe=safeLandCamera(anchor,desired,boxes);assert.ok(Object.values(safe).every(Number.isFinite));
  if(Math.hypot(safe.x-desired.x,safe.y-desired.y,safe.z-desired.z)>.01)clipped++;
  const checked=safeLandCamera(anchor,safe,boxes);assert.ok(Math.hypot(safe.x-checked.x,safe.y-checked.y,safe.z-checked.z)<1e-6,'rechecking a safe boom is idempotent');
  for(const box of boxes){
   if(box.heightfield){const ground=cameraTerrainHeight(box.heightfield,safe.x,safe.z);assert.ok(ground===null||safe.y>=ground+.45-1e-8,`lane ${lane} ${edge.id}:${s} camera below source terrain`);continue;}
   const insideAnchor=[anchor.x,anchor.y,anchor.z].every((v,i)=>v>=box.min[i]-.45&&v<=box.max[i]+.45);
   // A rotated thin rail AABB may contain the supported anchor without its
   // actual mesh intersecting the boom. Independent triangle tests cover it.
   if(!insideAnchor)assert.ok(!(safe.x>box.min[0]&&safe.x<box.max[0]&&safe.y>box.min[1]&&safe.y<box.max[1]&&safe.z>box.min[2]&&safe.z<box.max[2]),'camera remains outside forest structure/bridge volumes');
  }
  poses++;
 }
 assert.ok(poses>10000);assert.ok(clipped>0,'test exercises actual structure or soffit obstructions');
 t.diagnostic(`${poses} poses at center and both lane limits; ${clipped} booms retracted; desired and rechecked safe poses remain source-terrain clear`);
});
