/** Narrow finite checks for the 2026 scenery additions; prior fixtures untouched. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTownSceneGeometry} from '../src/town-scenery';
import {TOWN_COURSE,TOWN_ROAD_EDGES} from '../src/maps/town';
import {RoadFootprintIndex,sampleRoadFootprints} from '../src/land-road-mesh';
import {safeLandCamera} from '../src/land-camera';
const scene=buildTownSceneGeometry(TOWN_COURSE),roads=new RoadFootprintIndex(sampleRoadFootprints(TOWN_ROAD_EDGES));
test('Town facade and market details stay bounded and reuse the twenty material batches',()=>{
  assert.equal(scene.batches.length,20);
  const added=scene.polishDetails.reduce((n,p)=>n+p.triangles,0);
  assert.ok(added>4000&&added<=9000,`added triangles ${added}`);
  assert.ok(scene.polishDetails.some(p=>p.kind==='teal-shutter-louver'));
  assert.equal(scene.polishDetails.filter(p=>p.kind==='market-crate-floor').length,28);
  assert.equal(scene.polishDetails.filter(p=>p.kind==='limestone-entry-lintel').length,46);
  for(const detail of scene.polishDetails){
    const b=scene.batches.find(b=>b.name===detail.batch)!;
    for(let i=detail.vertexStart*3;i<detail.vertexEnd*3;i+=3){
      const p=b.positions.slice(i,i+3);assert.ok(p.every(Number.isFinite));
      assert.ok(roads.clearAt(p[0],p[2],3),detail.kind+' must clear both fork roads');
      assert.ok(scene.cameraObstacles.some(o=>p.every((v,k)=>v>=o.min[k]-1e-6&&v<=o.max[k]+1e-6)),detail.kind+' must remain inside an existing camera reservation');
    }
  }
});
test('Town finite adjusted cameras stay usable around the decorated market and both choices',()=>{
  for(const edge of TOWN_ROAD_EDGES)for(let i=2;i<=20;i++){
    const s=edge.length*i/22,p=edge.sample(s).p,q=edge.sample(s-8).p;
    const anchor={x:p.x,y:p.y+1.5,z:p.z},camera=safeLandCamera(anchor,{x:q.x,y:q.y+4.5,z:q.z},scene.cameraObstacles,.3);
    assert.ok(Object.values(camera).every(Number.isFinite));
    assert.ok(Math.hypot(camera.x-anchor.x,camera.y-anchor.y,camera.z-anchor.z)>2);
  }
});
