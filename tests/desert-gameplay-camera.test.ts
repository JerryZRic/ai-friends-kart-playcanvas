import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DESERT_COURSE as course,DESERT_ARCHES as arches} from '../src/maps/desert';
import {buildDesertSceneGeometry} from '../src/desert-scenery';
import {desertPickupRows} from '../src/land-course-pickups';
import {chaseCamera} from '../src/race-camera';
import {safeLandCamera,cameraTerrainHeight,type CameraPoint} from '../src/land-camera';
const distance=(a:CameraPoint,b:CameraPoint)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const vec=(p:CameraPoint)=>[p.x,p.y,p.z];
const subtract=(a:number[],b:number[])=>a.map((v,i)=>v-b[i]);
const dot=(a:number[],b:number[])=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const cross=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normalize=(p:number[])=>{const length=Math.hypot(...p);return p.map(v=>v/length);};
/** Actual non-boost chase FOV from game.ts is 56 degrees; default canvas is
 * 1280x800. Do not enlarge the camera to manufacture pickup visibility. */
function inDefaultFrustum(camera:CameraPoint,look:CameraPoint,target:CameraPoint){
 const forward=normalize(subtract(vec(look),vec(camera))),right=normalize(cross(forward,[0,1,0])),up=cross(right,forward),delta=subtract(vec(target),vec(camera));
 const depth=dot(delta,forward),vertical=Math.tan(56*Math.PI/360)*depth,horizontal=vertical*1280/800;
 return {visible:depth>.12&&depth<2200&&Math.abs(dot(delta,up))<vertical&&Math.abs(dot(delta,right))<horizontal,depth,x:dot(delta,right)/horizontal,y:dot(delta,up)/vertical};
}

test('desert emitted source terrain and structures retain safe default, rear and orbit cameras; real open arch triangles preserve aperture',t=>{
 const geometry=buildDesertSceneGeometry(course),blockers=geometry.cameraObstacles;
 assert.ok(blockers.some(blocker=>blocker.triangles));
 assert.ok(geometry.arches.flatMap(arch=>arch.triangles).length>0,'camera aperture is checked against actual emitted arch faces');
 assert.equal(arches.portalWidth,52);assert.equal(arches.driveableWidth,11.8);assert.equal(arches.overheadClearance,20);
 let poses=0,clipped=0,archPoses=0;
 for(const edge of Object.values(course.edges))for(let s=0;s<edge.length;s+=35)for(const lane of [-edge.laneLimitAt(s),0,edge.laneLimitAt(s)])for(const view of [0,1])for(const rearView of [false,true])for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/2])for(const pitch of [-.28,0,.78]){
  const frame=edge.sample(s,lane),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z};
  const desired=chaseCamera({position:frame.p,tangent:frame.t,view,rearView,orbit:{yaw,pitch}}).position;
  const safe=safeLandCamera(anchor,desired,blockers),again=safeLandCamera(anchor,safe,blockers);
  assert.ok([safe.x,safe.y,safe.z].every(Number.isFinite));assert.ok(distance(safe,again)<1e-6,'rechecking a safe boom is idempotent');
  const ground=cameraTerrainHeight(geometry.terrainGrid,safe.x,safe.z);assert.ok(ground===null||safe.y>=ground+.45-1e-7,`${edge.id}:${s}/${lane} safe camera clears emitted source terrain`);
  if(distance(safe,desired)>.01)clipped++;poses++;
 }
 const archOnly={min:[-278,18,258],max:[-242,54,322],triangles:geometry.arches.flatMap(arch=>arch.triangles)};
 // Samples cover the complete 40m approach through both separated rings and
 // their conservative aperture, including all legal lane limits.
 for(let s=arches.straightFromS;s<=arches.straightToS+.001;s+=1)for(const lane of [-course.edges.alley.laneLimitAt(s),0,course.edges.alley.laneLimitAt(s)])for(const view of [0,1])for(const rearView of [false,true])for(let yawIndex=0;yawIndex<24;yawIndex++)for(const pitch of [-.28,0,.4,.78]){
  const frame=course.edges.alley.sample(s,lane),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z};
  const desired=chaseCamera({position:frame.p,tangent:frame.t,view,rearView,orbit:{yaw:yawIndex*Math.PI/12,pitch}}).position;
  assert.ok(distance(safeLandCamera(anchor,desired,[archOnly]),desired)<1e-7,`actual open arch faces leave ${s}/${lane}/${view}/${rearView}/${yawIndex}/${pitch} clear`);archPoses++;
 }
 assert.ok(poses>10000);assert.equal(archPoses,47232);
 t.diagnostic(`${poses} route camera poses (${clipped} clipped), ${archPoses} actual arch-triangle aperture poses; exact source geometry CPU checks, no GPU/FPS or pixel-review claim`);
});

test('desert all 18 fixed boxes fit unchanged default frusta at 55m and have clear actual-source bob-envelope rays including near arches',t=>{
 const geometry=buildDesertSceneGeometry(course),blockers=geometry.cameraObstacles;
 const gameSource=readFileSync(new URL('../src/game.ts',import.meta.url),'utf8');assert.match(gameSource,/boost > 0 \? 65 : 56/);
 let rays=0,frusta=0;
 for(const box of desertPickupRows(course))for(const ahead of [12,25,40,55])for(const view of [0,1])for(const lane of [-2.2,0,2.2]){
  const frame=course.edges[box.edgeId].sample(box.s-ahead,lane),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z};
  const pose=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:false,orbit:{yaw:0,pitch:0}}),camera=safeLandCamera(anchor,pose.position,blockers);
  for(const bob of [-.17,.17]){
   const target={x:box.p.x,y:box.p.y+1.25+bob,z:box.p.z};
   assert.ok(distance(safeLandCamera(camera,target,blockers,0),target)<1e-5,`${box.edgeId}:${box.s}/${box.lateral} at ${ahead}m emitted pickup ray is clear`);rays++;
   const frustum=inDefaultFrustum(camera,pose.look,target);assert.ok(frustum.visible,`${box.edgeId}:${box.s}/${box.lateral} at ${ahead}m view${view}/lane${lane} outside actual default frustum ${JSON.stringify(frustum)}`);frusta++;
  }
 }
 assert.equal(rays,864);assert.equal(frusta,864);
 t.diagnostic(`${rays} actual-source fixed-pickup rays and ${frusta} unchanged 56deg / 1280x800 frustum checks, full bob extrema; includes all rows at 55m and arch row at 12/25/40m. Fixed eight-second cooldown is unchanged; only dynamic appearances have reaction-gap guarantees.`);
});
