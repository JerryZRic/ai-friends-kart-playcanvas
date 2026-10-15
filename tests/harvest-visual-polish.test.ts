/** Bounded dev visual sanity only; frozen audits remain separate and unchanged. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHarvestSceneGeometry} from '../src/harvest-scenery';
import {HARVEST_COURSE,HARVEST_ROAD_EDGES} from '../src/maps/harvest';
import {sampleRoadFootprints,RoadFootprintIndex} from '../src/land-road-mesh';

test('Harvest detail props retain material/budget limits and clear every racing ribbon',()=>{
  const geometry=buildHarvestSceneGeometry(HARVEST_COURSE);
  const index=new RoadFootprintIndex(sampleRoadFootprints(HARVEST_ROAD_EDGES));
  assert.equal(geometry.batches.length,22);
  const details=geometry.components.filter(c=>c.kind.startsWith('harvest-polish-'));
  assert.ok(details.length>80,'modeled farm details must be emitted');
  for(const b of geometry.batches){
    assert.ok(b.positions.every(Number.isFinite),b.name);
    assert.ok(b.uvs.every(Number.isFinite),b.name);
    assert.equal(b.positions.length/3,b.uvs.length/2,b.name);
    assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3),b.name);
  }
  for(const c of details){
    const x=(c.min[0]+c.max[0])/2,z=(c.min[2]+c.max[2])/2;
    const r=Math.hypot(c.max[0]-c.min[0],c.max[2]-c.min[2])/2;
    assert.ok(index.clearAt(x,z,r+8),c.kind+' complete bounds need 8m road clearance');
  }
  assert.ok(!geometry.cameraObstacles.some(c=>c.kind.startsWith('harvest-polish-')));
  assert.ok(geometry.budget.triangles<118000,'preserve existing runtime budget');
  assert.ok(geometry.budget.vertices<200000);
  for(const kind of ['mill-pump-barrel','silo-barrow-wheel','press-fruit-ladder-rung','market-scale-pan'])
    assert.ok(details.some(c=>c.kind==='harvest-polish-'+kind),kind);
});
