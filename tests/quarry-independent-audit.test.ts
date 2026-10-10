import test from 'node:test';
import assert from 'node:assert/strict';
import {QUARRY_COURSE} from '../src/maps/quarry';
import {buildQuarrySceneGeometry} from '../src/quarry-scenery';
import {chaseCamera} from '../src/race-camera';
import {safeLandCamera} from '../src/land-camera';
import {quarryPickupRows} from '../src/land-course-pickups';

// Independent edge-lane regression. Centreline-only camera sweeps do not catch
// lower-road orbit cameras entering terrain supporting the nearby upper deck.
const geometry=buildQuarrySceneGeometry(QUARRY_COURSE);
const terrain=geometry.batches.find(batch=>batch.name==='Quarry continuous dry working floor')!;
function terrainHeight(x:number,z:number){
  const {minX,minZ,dx,dz,columns}=geometry.terrainGrid;
  const gx=(x-minX)/dx,gz=(z-minZ)/dz,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,i=iz*columns+ix;
  const y=(vertex:number)=>terrain.positions[vertex*3+1];
  const a=y(i),b=y(i+1),c=y(i+columns),d=y(i+columns+1);
  return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}

test('quarry lane-edge orbit cameras and their complete boom remain above emitted lower-crossing terrain',()=>{
  for(const [s,lateral,view,yaw,pitch] of [[90,-9.35,1,-Math.PI/2,-.28],[130,9.35,1,Math.PI/2,0]]){
    const frame=QUARRY_COURSE.commonStart.sample(s,lateral),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z};
    const desired=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:false,orbit:{yaw,pitch}}).position;
    const safe=safeLandCamera(anchor,desired,geometry.cameraObstacles);
    for(let step=1;step<=32;step++){
      const fraction=step/32,x=anchor.x+(safe.x-anchor.x)*fraction,y=anchor.y+(safe.y-anchor.y)*fraction,z=anchor.z+(safe.z-anchor.z)*fraction;
      assert.ok(y-terrainHeight(x,z)>.3,`camera/boom below terrain at start:${s}, lane:${lateral}, step:${step}, clearance:${y-terrainHeight(x,z)}`);
    }
  }
});

test('quarry source terrain safety covers both lane edges, all route heights and orbit quadrants',()=>{
  let poses=0,terrainClips=0;
  for(const edge of Object.values(QUARRY_COURSE.edges))for(let s=0;s<edge.length;s+=10)
    for(const lateral of [-edge.laneLimitAt(s),0,edge.laneLimitAt(s)])for(const view of [0,1])
    for(const yaw of [-Math.PI,-Math.PI*.75,-Math.PI/2,-Math.PI/4,0,Math.PI/4,Math.PI/2,Math.PI*.75])for(const pitch of [-.28,0,.78]){
      const frame=edge.sample(s,lateral),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z};
      const desired=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:false,orbit:{yaw,pitch}}).position;
      const safe=safeLandCamera(anchor,desired,geometry.cameraObstacles);
      assert.ok(Object.values(safe).every(Number.isFinite));
      if(desired.y<terrainHeight(desired.x,desired.z)+.45)terrainClips++;
      // The independent oracle uses the actual source mesh, never the new
      // heightfield payload or its interpolation/collision implementation.
      for(let step=1;step<=16;step++){
        const fraction=step/16,x=anchor.x+(safe.x-anchor.x)*fraction,y=anchor.y+(safe.y-anchor.y)*fraction,z=anchor.z+(safe.z-anchor.z)*fraction;
        assert.ok(y-terrainHeight(x,z)>.3,`${edge.id}:${s}:${lateral}, view:${view}, yaw:${yaw}, pitch:${pitch}: terrain clips camera boom`);
      }
      poses++;
    }
  assert.ok(poses>37000);assert.ok(terrainClips>=2,'actual terrain obstructions are exercised');
});


test('all authored quarry pickups have a clear 55m source-mesh sight ray in both default chase views',()=>{
  type Vector=readonly number[];
  const sub=(a:Vector,b:Vector)=>a.map((n,i)=>n-b[i]);
  const dot=(a:Vector,b:Vector)=>a.reduce((n,v,i)=>n+v*b[i],0);
  const cross=(a:Vector,b:Vector)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const triangles=geometry.batches.flatMap(batch=>Array.from({length:batch.indices.length/3},(_,i)=>{
    const points=batch.indices.slice(i*3,i*3+3).map(index=>batch.positions.slice(index*3,index*3+3));
    return {batch:batch.name,points,min:[0,1,2].map(axis=>Math.min(...points.map(p=>p[axis]))),max:[0,1,2].map(axis=>Math.max(...points.map(p=>p[axis])))};
  }));
  const intersects=(origin:Vector,direction:Vector,a:Vector,b:Vector,c:Vector)=>{
    const e1=sub(b,a),e2=sub(c,a),h=cross(direction,e2),determinant=dot(e1,h);
    if(Math.abs(determinant)<1e-9)return false;
    const s=sub(origin,a),u=dot(s,h)/determinant;if(u<0||u>1)return false;
    const q=cross(s,e1),v=dot(direction,q)/determinant;if(v<0||u+v>1)return false;
    const t=dot(e2,q)/determinant;return t>1e-5&&t<1-1e-5;
  };
  let rays=0;
  for(const pickup of quarryPickupRows(QUARRY_COURSE))for(const lateral of [-3.5,0,3.5])for(const view of [0,1]){
    const frame=QUARRY_COURSE.edges[pickup.edgeId].sample(pickup.s-55,lateral),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z};
    const desired=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:false,orbit:{yaw:0,pitch:0}}).position;
    const camera=safeLandCamera(anchor,desired,geometry.cameraObstacles),origin=[camera.x,camera.y,camera.z],target=[pickup.p.x,pickup.p.y+1.25,pickup.p.z],direction=sub(target,origin);
    const min=origin.map((n,i)=>Math.min(n,target[i])),max=origin.map((n,i)=>Math.max(n,target[i]));
    for(const triangle of triangles){
      if(triangle.min.some((n,i)=>n>max[i])||triangle.max.some((n,i)=>n<min[i]))continue;
      assert.ok(!intersects(origin,direction,triangle.points[0],triangle.points[1],triangle.points[2]),`${pickup.edgeId}:${pickup.s}, item lane:${pickup.lateral}, actor lane:${lateral}, view:${view} blocked by ${triangle.batch}`);
    }
    rays++;
  }
  assert.equal(rays,84);
});
