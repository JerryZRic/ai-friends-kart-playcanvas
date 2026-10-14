/** Bounded dev visual sanity only; historical enrichment audits are unchanged. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildForestSceneGeometry} from '../src/forest-scenery';
import {FOREST_COURSE,FOREST_ROAD_EDGES} from '../src/maps/forest';
import {sampleRoadFootprints,RoadFootprintIndex} from '../src/land-road-mesh';

test('Forest visual details stay finite, batched and outside every driveable ribbon',()=>{
  const geometry=buildForestSceneGeometry(FOREST_COURSE);
  const index=new RoadFootprintIndex(sampleRoadFootprints(FOREST_ROAD_EDGES));
  assert.equal(geometry.batches.length,21,'reuse the existing 21 materials');
  const details=geometry.components.filter(c=>c.kind.startsWith('forest-polish-'));
  assert.ok(details.length>150,'model detail must be present, not palette-only');
  for(const b of geometry.batches){
    assert.ok(b.positions.every(Number.isFinite),b.name);
    assert.ok(b.uvs.every(Number.isFinite),b.name);
    assert.equal(b.positions.length/3,b.uvs.length/2,b.name);
    assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3),b.name);
  }
  for(const c of details){
    const x=(c.min[0]+c.max[0])/2,z=(c.min[2]+c.max[2])/2;
    const r=Math.hypot(c.max[0]-c.min[0],c.max[2]-c.min[2])/2;
    assert.ok(index.clearAt(x,z,r+8),c.kind+' full bounds need 8m road clearance');
  }
  assert.ok(!geometry.cameraObstacles.some(c=>c.kind.startsWith('forest-polish-')),'cosmetic details cannot replace the reserved existing camera solids');
  assert.ok(geometry.batches.reduce((sum,b)=>sum+b.indices.length/3,0)<116000);
  assert.ok(details.some(c=>c.kind==='forest-polish-station-sawbench-top'));
  assert.ok(details.some(c=>c.kind==='forest-polish-lookout-deck-board'));
  assert.ok(details.some(c=>c.kind==='forest-polish-layered-fern-leaflets'));
});
