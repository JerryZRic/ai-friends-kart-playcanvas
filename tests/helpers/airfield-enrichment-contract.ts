/** Immutable original indexed-prefix proof. No scenery labels define original membership. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as pc from 'playcanvas';
import type {AirfieldSceneGeometry} from '../../src/airfield-scenery';
export const AIRFIELD_ORIGINAL_COMPONENTS=1585; // pinned after independent original-only execution
export const AIRFIELD_GEOMETRY_FIXTURE_SHA256='264433eb8a734047aea058f6bcc92be4f0f03cda65db545e3036b6d5c25b7f30';
export const AIRFIELD_ORIGINAL_SOURCE_SHA256='a5414a810f061a5cb4da169f9c8f5577d377c2e76fb6c7aa6dca0eaf80f99cb2';
export const airfieldSha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
export const airfieldDigest=(value:unknown)=>airfieldSha(JSON.stringify(value));
export const airfieldMaterial=(b:any)=>Object.fromEntries(Object.entries(b).filter(([k])=>!['positions','indices','uvs','normals'].includes(k)));
export const AIRFIELD_APPENDABLE=['components','cameraObstacles','props','foundations','groundedDetails','structuralContacts','bearingPoints','landforms','assemblies'] as const;
export const AIRFIELD_EXACT=['version','trackId','roadSamples','routeRoadSamples','roadFaces','roadUndersideFaces','shoulderFaces','structures','landmarks','railMembers','wheelContacts','sightlines','terrainGrid','terrainVertices','terrainTriangles','terrainExposure','terrainPartitions','hangar'] as const;
export function airfieldBaselineContract(g:AirfieldSceneGeometry,theme:unknown){
 const batches=g.batches.map(b=>({material:airfieldMaterial(b),vertices:b.positions.length/3,indices:b.indices.length,positions:airfieldDigest(b.positions),uvs:airfieldDigest(b.uvs),indexed:airfieldDigest(b.indices),normals:airfieldDigest(pc.calculateNormals(b.positions,b.indices))}));
 return{budget:g.budget,theme,batches,components:g.components,exact:Object.fromEntries(AIRFIELD_EXACT.map(k=>[k,airfieldDigest(g[k])])),prefixes:Object.fromEntries(AIRFIELD_APPENDABLE.map(k=>[k,{count:g[k].length,digest:airfieldDigest(g[k])}]))};
}
export type AirfieldBaselineContract=ReturnType<typeof airfieldBaselineContract>;
let frozen:AirfieldBaselineContract|undefined;
export function airfieldFrozenBaseline(){
 if(!frozen){const text=readFileSync('tests/fixtures/airfield-enrichment-original-geometry.json','utf8');assert.equal(airfieldSha(text),AIRFIELD_GEOMETRY_FIXTURE_SHA256,'Frozen original geometry fixture is immutable');const record=JSON.parse(text);assert.equal(record.sourceSha256,AIRFIELD_ORIGINAL_SOURCE_SHA256);frozen=record.protection;}
 return frozen!;
}
/** Certifies exact complete original records, including order/ranges, before projection. */
export function assertAirfieldOriginalComponents(components:AirfieldSceneGeometry['components'],old:AirfieldBaselineContract){
 assert.equal(old.components.length,AIRFIELD_ORIGINAL_COMPONENTS);assert.equal(old.prefixes.components.count,AIRFIELD_ORIGINAL_COMPONENTS);
 assert.ok(components.length>=old.components.length,'An original component was removed');
 const original=components.slice(0,old.components.length);
 assert.deepEqual(original,old.components,'Every original component, order, kind, role, landmark and full indexed range must remain exact');
 assert.equal(airfieldDigest(original),old.prefixes.components.digest,'Immutable complete original component manifest');return original;
}
export function assertAirfieldOriginalProjection(g:AirfieldSceneGeometry,old:AirfieldBaselineContract=airfieldFrozenBaseline()){
 assert.deepEqual(old.budget,{batches:20,triangles:94747,vertices:103278});assert.equal(g.batches.length,20);
 const original=assertAirfieldOriginalComponents(g.components,old);
 for(const [i,b]of g.batches.entries()){
  const before=old.batches[i];assert.deepEqual(airfieldMaterial(b),before.material,'Exact original material values and batch order');
  assert.ok(b.positions.length/3>=before.vertices&&b.indices.length>=before.indices);
  assert.equal(airfieldDigest(b.positions.slice(0,before.vertices*3)),before.positions,b.name+' original positions');
  assert.equal(airfieldDigest(b.uvs.slice(0,before.vertices*2)),before.uvs,b.name+' original UVs');
  assert.equal(airfieldDigest(b.indices.slice(0,before.indices)),before.indexed,b.name+' full original indexed range');
  assert.ok(b.indices.slice(before.indices).every(index=>index>=before.vertices),'No new triangle may reuse an original vertex');
 }
 return original;
}
export function assertAirfieldPreservation(g:AirfieldSceneGeometry,theme:unknown,old:AirfieldBaselineContract){
 assertAirfieldOriginalProjection(g,old);assert.deepEqual(theme,old.theme,'Exact original airfield lighting/fog/sky/theme');
 for(const [i,b]of g.batches.entries()){
  const before=old.batches[i],normals=pc.calculateNormals(b.positions,b.indices);
  assert.equal(airfieldDigest(normals.slice(0,before.vertices*3)),before.normals,b.name+' actual computed original normals');
  for(let j=before.vertices*3;j<normals.length;j+=3)assert.ok(Math.abs(Math.hypot(normals[j],normals[j+1],normals[j+2])-1)<1e-5,b.name+' new finite unit normal');
 }
 for(const k of AIRFIELD_EXACT)assert.equal(airfieldDigest(g[k]),old.exact[k],k+' exact original metadata/geometry');
 for(const k of AIRFIELD_APPENDABLE){const before=old.prefixes[k];assert.ok(g[k].length>=before.count);assert.equal(airfieldDigest(g[k].slice(0,before.count)),before.digest,k+' full original prefix');}
 const added=g.components.slice(old.components.length);assert.ok(added.length>0);assert.ok(added.every(c=>c.kind.startsWith('airfield-enrichment-')&&!c.landmark),'Secondary additions never claim original landmark ownership');
 assert.equal(g.budget.batches,20);assert.ok(g.budget.vertices<200000);assert.ok(g.budget.triangles<110000);
 assert.ok(g.budget.triangles>94747&&g.budget.triangles-94747<=12000,'Only the approved <=12000 added triangles');
 assert.ok(g.budget.vertices-103278<=36000,'Independent <=36000 additive vertex ledger');return added;
}
