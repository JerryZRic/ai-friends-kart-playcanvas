import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorkshopSceneGeometry} from '../src/workshop-scenery';
import {WORKSHOP_COURSE} from '../src/maps/workshop';
import * as pc from 'playcanvas';
import {RoadFootprintIndex,sampleRoadFootprints,intersectRoadFootprint,footprintArea} from '../src/land-road-mesh';
const geometry=buildWorkshopSceneGeometry(WORKSHOP_COURSE);
test('workshop polish reuses materials and adds modeled joinery and compartment trays',()=>{
 assert.equal(geometry.batches.length,21);assert.ok(geometry.budget.triangles<103000);
 const detail=geometry.components.filter(c=>c.kind.includes('polish-'));assert.equal(detail.length,166);
 for(const family of ['polish-cornice','polish-lintel-inset','polish-tray-divider','polish-stock','polish-label-frame'])assert.ok(detail.some(c=>c.kind.includes(family)),family);
 const index=new RoadFootprintIndex(sampleRoadFootprints([WORKSHOP_COURSE.commonStart,WORKSHOP_COURSE.alternates.alley,WORKSHOP_COURSE.alternates.boulevard,WORKSHOP_COURSE.commonFinish],2));
 for(const c of detail){
  const footprint=[[c.min[0],c.min[2]],[c.max[0],c.min[2]],[c.max[0],c.max[2]],[c.min[0],c.max[2]]].map(([x,z])=>new pc.Vec3(x,0,z));
  for(const face of index.query(c.min[0],c.max[0],c.min[2],c.max[2]))assert.ok(footprintArea(intersectRoadFootprint(footprint,face.points))<1e-6,c.kind+' outside actual road footprint');
 }
});
