import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAirfieldSceneGeometry} from '../src/airfield-scenery';
import {AIRFIELD_COURSE,AIRFIELD_ROAD_EDGES} from '../src/maps/airfield';
import {RoadFootprintIndex,sampleRoadFootprints} from '../src/land-road-mesh';
const geometry=buildAirfieldSceneGeometry(AIRFIELD_COURSE);
const road=new RoadFootprintIndex(sampleRoadFootprints(AIRFIELD_ROAD_EDGES,1.65));
test('airfield dev props remain finite and emitted vertices stay outside the road/camera reservation',()=>{
 assert.equal(geometry.budget.batches,20);assert.ok(geometry.budget.triangles<110000);
 for(const b of geometry.batches){assert.ok(b.positions.every(Number.isFinite));assert.ok(b.uvs.every(Number.isFinite));assert.equal(b.uvs.length,b.positions.length/3*2);assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));}
 const added=geometry.components.filter(c=>c.kind.startsWith('airfield-polish-'));assert.ok(added.length>=100);
 for(const c of added){const b=geometry.batches.find(b=>b.name===c.batch)!;for(let i=c.vertexStart;i<c.vertexEnd;i++)assert.ok(road.clearAt(b.positions[i*3],b.positions[i*3+2],18),c.kind+' enters camera reservation');}
});
// These checks do not establish whole-surface bearing, complete support
// connectivity, or the absence of exposed coincident faces.
test('airfield polish retains expected part counts, wheel minimum heights, pad extrema and exact road samples',()=>{
 const count=(k:string)=>geometry.components.filter(c=>c.kind==='airfield-polish-'+k).length;
 assert.equal(count('service-wheel'),12);assert.equal(count('service-wheel-hub'),12);assert.equal(count('luggage-case'),4);assert.equal(count('terminal-blue-window'),4);assert.equal(count('control-crown-roof'),1);
 const pad=geometry.foundations.find(f=>f.kind==='airfield-polish-ground-service-pad')!;assert.ok(pad.bottom<pad.terrainLow);assert.ok(pad.top>=pad.terrainHigh);
 for(const w of geometry.components.filter(c=>c.kind==='airfield-polish-service-wheel'))assert.ok(Math.abs(w.min[1]-pad.top)<1e-8,'static wheel must meet pad');
 for(const sample of geometry.routeRoadSamples){const e=AIRFIELD_ROAD_EDGES.find(e=>e.id===sample.edgeId)!;for(const [side,p]of [[-1,sample.left],[1,sample.right]]as const){const q=e.sample(sample.distance,side*e.halfWidthAt(sample.distance)).p;assert.ok(Math.hypot(q.x-p[0],q.y-p[1],q.z-p[2])<1e-8);}}
});
