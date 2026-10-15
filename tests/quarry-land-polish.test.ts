/** Finite visual-polish checks, separate from historical quarry audit fixtures. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildQuarrySceneGeometry} from '../src/quarry-scenery';
import {QUARRY_COURSE,QUARRY_ROAD_EDGES} from '../src/maps/quarry';
import {RoadFootprintIndex,sampleRoadFootprints} from '../src/land-road-mesh';
import {safeLandCamera} from '../src/land-camera';
const scene=buildQuarrySceneGeometry(QUARRY_COURSE),roads=new RoadFootprintIndex(sampleRoadFootprints(QUARRY_ROAD_EDGES));
const inside=(x:number,z:number,polygon:number[][])=>{
  const c=polygon.map((a,i)=>{const b=polygon[(i+1)%polygon.length];return(b[0]-a[0])*(z-a[2])-(b[2]-a[2])*(x-a[0]);});
  return c.every(v=>v>=-1e-7)||c.every(v=>v<=1e-7);
};
test('Quarry segmented machinery and aggregate groups remain within existing grounded pads',()=>{
  assert.equal(scene.batches.length,20);
  const added=scene.polishDetails.reduce((n,p)=>n+p.triangles,0);
  assert.ok(added>1000&&added<=2500,`added triangles ${added}`);
  assert.equal(scene.polishDetails.filter(d=>d.kind==='polish-quarry-conveyor-drive-motor').length,2);
  assert.equal(scene.polishDetails.filter(d=>d.kind==='polish-quarry-aggregate-bin-floor').length,9);
  for(const detail of scene.polishDetails){
    const b=scene.batches.find(b=>b.name===detail.batch)!,obstacles=scene.cameraObstacles.filter(o=>o.kind===detail.kind);
    for(let i=detail.vertexStart*3;i<detail.vertexEnd*3;i+=3){const p=b.positions.slice(i,i+3);
      assert.ok(p.every(Number.isFinite));assert.ok(roads.clearAt(p[0],p[2],3),detail.kind+' must stay away from both roads');
      assert.ok(scene.foundations.some(f=>inside(p[0],p[2],f.footprint)&&p[1]>=f.top-1e-6),detail.kind+' must stay over an existing founded pad');
      assert.ok(obstacles.some(o=>p.every((v,k)=>v>=o.min[k]-1e-6&&v<=o.max[k]+1e-6)),detail.kind+' must be represented in camera safety');
    }
  }
});
test('Quarry finite adjusted cameras remain usable through the decorated working districts',()=>{
  for(const edge of QUARRY_ROAD_EDGES)for(let i=2;i<=24;i++){
    const s=edge.length*i/26,p=edge.sample(s).p,q=edge.sample(s-8).p,anchor={x:p.x,y:p.y+1.5,z:p.z};
    const camera=safeLandCamera(anchor,{x:q.x,y:q.y+4.5,z:q.z},scene.cameraObstacles,.3);
    assert.ok(Object.values(camera).every(Number.isFinite));
    assert.ok(Math.hypot(camera.x-anchor.x,camera.y-anchor.y,camera.z-anchor.z)>2);
  }
});
