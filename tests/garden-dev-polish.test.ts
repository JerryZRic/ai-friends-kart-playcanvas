import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGardenSceneGeometry} from '../src/garden-scenery';
import {GARDEN_COURSE,GARDEN_ROAD_EDGES} from '../src/maps/garden';
import {RoadFootprintIndex,sampleRoadFootprints} from '../src/land-road-mesh';
const geometry=buildGardenSceneGeometry(GARDEN_COURSE);
const road=new RoadFootprintIndex(sampleRoadFootprints(GARDEN_ROAD_EDGES,1.65));
test('garden dev detail keeps the hard mesh budget and road-camera space',()=>{
 assert.equal(geometry.budget.batches,21);assert.ok(geometry.budget.triangles<120000);
 for(const b of geometry.batches){assert.ok(b.positions.every(Number.isFinite));assert.ok(b.uvs.every(Number.isFinite));assert.equal(b.uvs.length,b.positions.length/3*2);assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));}
 const added=geometry.components.filter(c=>c.kind.startsWith('garden-polish-'));assert.ok(added.length>=70);
 for(const c of added){const b=geometry.batches.find(b=>b.name===c.batch)!;for(let i=c.vertexStart;i<c.vertexEnd;i++)assert.ok(road.clearAt(b.positions[i*3],b.positions[i*3+2],18),c.kind+' enters camera reservation');}
});
test('garden roses, nursery fascia and supports are real geometry on grounded feet',()=>{
 const count=(k:string)=>geometry.components.filter(c=>c.kind==='garden-polish-'+k).length;
 assert.equal(count('layered-rose-cup'),6);assert.equal(count('rose-inner-bud'),6);assert.equal(count('nursery-column-capital'),8);assert.equal(count('open-knee-brace'),8);
 const feet=geometry.foundations.filter(f=>f.kind.startsWith('garden-polish-rose-planter-foot'));assert.equal(feet.length,2);for(const f of feet){assert.ok(f.bottom<f.terrainLow);assert.ok(f.top>=f.terrainHigh);}
 for(const sample of geometry.routeRoadSamples){const e=GARDEN_ROAD_EDGES.find(e=>e.id===sample.edgeId)!;for(const [side,p]of [[-1,sample.left],[1,sample.right]]as const){const q=e.sample(sample.distance,side*e.halfWidthAt(sample.distance)).p;assert.ok(Math.hypot(q.x-p[0],q.y-p[1],q.z-p[2])<1e-8);}}
});
