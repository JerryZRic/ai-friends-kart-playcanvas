import test from 'node:test';
import assert from 'node:assert/strict';
import {HARVEST_COURSE as course,HARVEST_BARN as barn} from '../src/maps/harvest';
import {buildHarvestSceneGeometry} from '../src/harvest-scenery';
import {harvestPickupRows} from '../src/land-course-pickups';
import {chaseCamera} from '../src/race-camera';
import {safeLandCamera,cameraTerrainHeight,type CameraPoint} from '../src/land-camera';
const distance=(a:CameraPoint,b:CameraPoint)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

test('harvest emitted terrain and barn share the runtime camera safety query in both views, rear and orbit modes',t=>{
 const geometry=buildHarvestSceneGeometry(course),blockers=geometry.cameraObstacles;
 assert.ok(blockers.some(blocker=>blocker.triangles));
 assert.ok(geometry.barn.triangles.length>0);assert.equal(geometry.barn.portalWidth,48);assert.equal(geometry.barn.headroom,18);
 let poses=0,clipped=0,barnPoses=0;
 for(const edge of Object.values(course.edges))for(let s=0;s<edge.length;s+=35)for(const lane of [-edge.laneLimitAt(s),0,edge.laneLimitAt(s)])for(const view of [0,1])for(const rearView of [false,true])for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/2])for(const pitch of [-.28,0,.78]){
  const frame=edge.sample(s,lane),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z};
  const desired=chaseCamera({position:frame.p,tangent:frame.t,view,rearView,orbit:{yaw,pitch}}).position;
  const safe=safeLandCamera(anchor,desired,blockers),again=safeLandCamera(anchor,safe,blockers);
  assert.ok([safe.x,safe.y,safe.z].every(Number.isFinite));assert.ok(distance(safe,again)<1e-6,'rechecking a safe boom is idempotent');
  const ground=cameraTerrainHeight(geometry.terrainGrid,safe.x,safe.z);assert.ok(ground===null||safe.y>=ground+.45-1e-7,'safe camera clears emitted source terrain');
  if(distance(safe,desired)>.01)clipped++;poses++;
 }
 const barnOnly={min:[254.6,16,-28],max:[306.6,43,28],triangles:geometry.barn.triangles};
 for(let s=barn.straightFromS;s<=barn.straightToS;s+=2)for(const lane of [-4.5,0,4.5])for(const view of [0,1])for(const rearView of [false,true])for(let yaw=0;yaw<Math.PI*2;yaw+=Math.PI/6)for(const pitch of [-.28,0,.4,.78]){
  const frame=course.edges.alley.sample(s,lane),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z};
  const desired=chaseCamera({position:frame.p,tangent:frame.t,view,rearView,orbit:{yaw,pitch}}).position;
  assert.ok(distance(safeLandCamera(anchor,desired,[barnOnly]),desired)<1e-7,'real barn structure leaves the certified complete camera aperture open');
  barnPoses++;
 }
 // Initially authored fixed rows are checked against emitted structures, not
 // merely an estimated centerline sight tube. Dynamic respawn uses its own gate.
 let pickupRays=0;
 for(const box of harvestPickupRows(course))for(const ahead of [12,25,40])for(const view of [0,1])for(const lane of [-2.2,0,2.2]){
  const frame=course.edges[box.edgeId].sample(box.s-ahead,lane),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z};
  const desired=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:false,orbit:{yaw:0,pitch:0}}).position;
  const camera=safeLandCamera(anchor,desired,blockers);
  for(const bob of [-.17,.17]){const target={x:box.p.x,y:box.p.y+1.25+bob,z:box.p.z};assert.ok(distance(safeLandCamera(camera,target,blockers,0),target)<1e-5,`${box.edgeId}:${box.s} emitted pickup view is clear`);pickupRays++;}
 }
 assert.ok(poses>10000);assert.ok(barnPoses>10000);assert.ok(pickupRays>=648);
 t.diagnostic(`${poses} route camera poses (${clipped} clipped), ${barnPoses} actual barn-triangle aperture poses, ${pickupRays} fixed-row rays; CPU source geometry only, not GPU/FPS or visual certification`);
});
