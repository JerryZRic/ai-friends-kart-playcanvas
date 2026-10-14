/** Bounded dev visual sanity; existing historical geometry audits are untouched. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDesertSceneGeometry} from '../src/desert-scenery';
import {DESERT_COURSE,DESERT_ROAD_EDGES} from '../src/maps/desert';
import {sampleRoadFootprints,RoadFootprintIndex} from '../src/land-road-mesh';

test('Desert visual details are finite, material-batched and wholly off road',()=>{
  const geometry=buildDesertSceneGeometry(DESERT_COURSE);
  const index=new RoadFootprintIndex(sampleRoadFootprints(DESERT_ROAD_EDGES));
  assert.equal(geometry.batches.length,22);
  const details=geometry.components.filter(c=>c.kind.startsWith('desert-polish-'));
  assert.ok(details.length>90,'emit actual well, pottery and architecture detail');
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
  assert.ok(!geometry.cameraObstacles.some(c=>c.kind.startsWith('desert-polish-')));
  assert.ok(geometry.budget.triangles<125000,'original runtime limit remains unchanged');
  assert.ok(geometry.budget.vertices<200000);
  const base=geometry.enrichmentAssemblies.find(a=>a.id==='desert-enrichment-crescent-high-bay')!.pieces.find(p=>p.kind==='desert-enrichment-court-conforming-platform')!;
  const well=details.find(c=>c.kind==='desert-polish-well-hollow-masonry-curb')!;
  assert.ok(Math.abs(well.min[1]-base.max[1])<1e-10,'well is supported on the actual existing slab');
  const water=details.find(c=>c.kind==='desert-polish-well-recessed-water-surface')!;
  assert.ok(water.max[1]<well.max[1]-1,'water stays recessed below open lip');
  assert.ok(details.some(c=>c.kind==='desert-polish-potter-wheel-round-turntable'));
  assert.ok(details.some(c=>c.kind==='desert-polish-waystation-turquoise-lattice-upright'));
});
