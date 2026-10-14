import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCalderaSceneGeometry} from '../src/caldera-scenery';
import {CALDERA_COURSE,CALDERA_ROAD_EDGES} from '../src/maps/caldera';
import {RoadFootprintIndex,sampleRoadFootprints} from '../src/land-road-mesh';
const geometry=buildCalderaSceneGeometry(CALDERA_COURSE);
const road=new RoadFootprintIndex(sampleRoadFootprints(CALDERA_ROAD_EDGES,1.65));
test('caldera dev polish stays finite, compact, and outside camera-reserved road space',()=>{
 assert.equal(geometry.budget.batches,22);assert.ok(geometry.budget.triangles<110000);
 for(const b of geometry.batches){assert.ok(b.positions.every(Number.isFinite));assert.ok(b.uvs.every(Number.isFinite));assert.equal(b.uvs.length,b.positions.length/3*2);assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));}
 const added=geometry.components.filter(c=>c.kind.startsWith('caldera-polish-'));assert.ok(added.length>=80);
 for(const c of added){const b=geometry.batches.find(b=>b.name===c.batch)!;for(let i=c.vertexStart;i<c.vertexEnd;i++)assert.ok(road.clearAt(b.positions[i*3],b.positions[i*3+2],18),c.kind+' enters camera reservation');}
 assert.equal(geometry.enrichmentAssemblies.filter(a=>a.id.startsWith('caldera-polish-')).length,2);
});
test('caldera localized instruments and tiered specimens have actual separate geometry',()=>{
 const count=(k:string)=>geometry.components.filter(c=>c.kind==='caldera-polish-'+k).length;
 assert.equal(count('vent-octagonal-shaft'),2);assert.equal(count('vent-flange-collar'),6);assert.equal(count('vent-crown-support'),4);assert.equal(count('stepped-specimen-layer'),8);
 const orange=geometry.batches.find(b=>b.name==='Caldera localized vent instrument heat indicators')!;
 assert.ok(orange.indices.length/3<100,'warm accent stays tiny and localized');
 for(const sample of geometry.routeRoadSamples){const e=CALDERA_ROAD_EDGES.find(e=>e.id===sample.edgeId)!;for(const [side,p]of [[-1,sample.left],[1,sample.right]]as const){const q=e.sample(sample.distance,side*e.halfWidthAt(sample.distance)).p;assert.ok(Math.hypot(q.x-p[0],q.y-p[1],q.z-p[2])<1e-8);}}
});
