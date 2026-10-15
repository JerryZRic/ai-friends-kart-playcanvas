import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSnowSceneGeometry} from '../src/snow-scenery';
import {SNOW_COURSE,SNOW_ROAD_EDGES} from '../src/maps/snow';
import {RoadFootprintIndex,sampleRoadFootprints} from '../src/land-road-mesh';
const geometry=buildSnowSceneGeometry(SNOW_COURSE);
const road=new RoadFootprintIndex(sampleRoadFootprints(SNOW_ROAD_EDGES,1.65));
test('snow dev polish retains finite indexed geometry and the existing material budget',()=>{
 assert.equal(geometry.budget.batches,23);
 assert.ok(geometry.budget.triangles<120000);
 for(const b of geometry.batches){assert.ok(b.positions.every(Number.isFinite));assert.ok(b.uvs.every(Number.isFinite));assert.equal(b.uvs.length,b.positions.length/3*2);assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));}
 const added=geometry.components.filter(c=>c.kind.startsWith('snow-polish-'));
 assert.ok(added.length>=100);
 for(const c of added){const b=geometry.batches.find(b=>b.name===c.batch)!;for(let i=c.vertexStart;i<c.vertexEnd;i++)assert.ok(road.clearAt(b.positions[i*3],b.positions[i*3+2],18),c.kind+' enters camera reservation');}
 assert.equal(geometry.enrichmentAssemblies.filter(a=>a.id.startsWith('snow-polish-')).length,3);
});
test('snow utility group has modeled runners, pack straps, hood supports and real slatted seating',()=>{
 const count=(kind:string)=>geometry.components.filter(c=>c.kind==='snow-polish-'+kind).length;
 assert.equal(count('sled-curled-runner'),4);assert.equal(count('sled-pack-strap'),4);
 assert.equal(count('chimney-hood-leg'),4);assert.equal(count('gable-ice-fascia'),8);
 assert.equal(count('bench-slat'),3);assert.equal(count('locker-cross-vertical'),2);
 for(const sample of geometry.routeRoadSamples){const e=SNOW_ROAD_EDGES.find(e=>e.id===sample.edgeId)!;for(const [side,point]of [[-1,sample.left],[1,sample.right]]as const){const source=e.sample(sample.distance,side*e.halfWidthAt(sample.distance)).p;assert.ok(Math.hypot(source.x-point[0],source.y-point[1],source.z-point[2])<1e-8);}}
});
