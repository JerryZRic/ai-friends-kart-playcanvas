/** Immutable original indexed-prefix proof. No scenery labels define original membership. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as pc from 'playcanvas';
import type {CalderaSceneGeometry} from '../../src/caldera-scenery';
export const CALDERA_ORIGINAL_SOURCE_SHA256='ccbe4ea4c0b4a6334aad73e71640e42460ed3fe3884db45d4ea2730978e48de2';
export const calderaSha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
export const calderaDigest=(value:unknown)=>calderaSha(JSON.stringify(value));
export const calderaMaterial=(b:any)=>({name:b.name,color:b.color,roughness:b.roughness,metalness:b.metalness,texture:b.texture});
export const CALDERA_APPENDABLE=['components','cameraObstacles','props'] as const;
export const CALDERA_EXACT=['version','trackId','roadSamples','routeRoadSamples','roadFaces','roadUndersideFaces','shoulderFaces','structures','landmarks','foundations','groundedDetails','railMembers','wheelContacts','structuralContacts','sightlines','landforms','terrainGrid','terrainVertices','terrainTriangles','terrainExposure','terrainPartitions','viaduct','assemblies'] as const;
export function calderaBaselineContract(g:CalderaSceneGeometry,theme:unknown){
 const batches=g.batches.map(b=>({material:calderaMaterial(b),vertices:b.positions.length/3,indices:b.indices.length,positions:calderaDigest(b.positions),uvs:calderaDigest(b.uvs),indexed:calderaDigest(b.indices),normals:calderaDigest(pc.calculateNormals(b.positions,b.indices))}));
 return{budget:g.budget,theme,batches,components:g.components,exact:Object.fromEntries(CALDERA_EXACT.map(k=>[k,calderaDigest(g[k])])),prefixes:Object.fromEntries(CALDERA_APPENDABLE.map(k=>[k,{count:g[k].length,digest:calderaDigest(g[k])}]))};
}
export type CalderaBaselineContract=ReturnType<typeof calderaBaselineContract>;
let frozen:CalderaBaselineContract|undefined;
export function calderaFrozenBaseline(){
 if(!frozen){const text=readFileSync('tests/fixtures/caldera-enrichment-original-geometry.json','utf8');assert.equal(calderaSha(text),'9de28b035c62c3236eddc3f9200dbf777ac40feb798379faec87526f8a43bb70','Frozen original geometry fixture is immutable');const record=JSON.parse(text);assert.equal(record.sourceSha256,CALDERA_ORIGINAL_SOURCE_SHA256);frozen=record.protection;}
 return frozen!;
}
/** Certifies exact complete original records, including order/ranges, before projection. */
export function assertCalderaOriginalComponents(components:CalderaSceneGeometry['components'],old:CalderaBaselineContract){
 assert.equal(old.components.length,2715);assert.equal(old.prefixes.components.count,2715);
 assert.ok(components.length>=old.components.length,'An original component was removed');
 const original=components.slice(0,old.components.length);
 assert.deepEqual(original,old.components,'Every original component, order, kind, role, landmark and full indexed range must remain exact');
 assert.equal(calderaDigest(original),old.prefixes.components.digest,'Immutable complete original component manifest');return original;
}
export function assertCalderaOriginalProjection(g:CalderaSceneGeometry,old:CalderaBaselineContract=calderaFrozenBaseline()){
 assert.deepEqual(old.budget,{batches:21,triangles:95132,vertices:126320});assert.equal(g.batches.length,21);
 const original=assertCalderaOriginalComponents(g.components,old);
 for(const [i,b]of g.batches.entries()){
  const before=old.batches[i];assert.deepEqual(calderaMaterial(b),before.material,'Exact original material values and batch order');
  assert.ok(b.positions.length/3>=before.vertices&&b.indices.length>=before.indices);
  assert.equal(calderaDigest(b.positions.slice(0,before.vertices*3)),before.positions,b.name+' original positions');
  assert.equal(calderaDigest(b.uvs.slice(0,before.vertices*2)),before.uvs,b.name+' original UVs');
  assert.equal(calderaDigest(b.indices.slice(0,before.indices)),before.indexed,b.name+' full original indexed range');
  assert.ok(b.indices.slice(before.indices).every(index=>index>=before.vertices),'No new triangle may reuse an original vertex');
 }
 return original;
}
export function assertCalderaPreservation(g:CalderaSceneGeometry,theme:unknown,old:CalderaBaselineContract){
 assertCalderaOriginalProjection(g,old);assert.deepEqual(theme,old.theme,'Exact original winter lighting/fog/sky/theme');
 for(const [i,b]of g.batches.entries()){
  const before=old.batches[i],normals=pc.calculateNormals(b.positions,b.indices);
  assert.equal(calderaDigest(normals.slice(0,before.vertices*3)),before.normals,b.name+' actual computed original normals');
  for(let j=before.vertices*3;j<normals.length;j+=3)assert.ok(Math.abs(Math.hypot(normals[j],normals[j+1],normals[j+2])-1)<1e-5,b.name+' new finite unit normal');
 }
 for(const k of CALDERA_EXACT)assert.equal(calderaDigest(g[k]),old.exact[k],k+' exact original metadata/geometry');
 for(const k of CALDERA_APPENDABLE){const before=old.prefixes[k];assert.ok(g[k].length>=before.count);assert.equal(calderaDigest(g[k].slice(0,before.count)),before.digest,k+' full original prefix');}
 const added=g.components.slice(old.components.length);assert.ok(added.length>0);assert.ok(added.every(c=>c.kind.startsWith('enrichment-')&&!c.landmark),'Secondary additions never claim original landmark ownership');
 assert.equal(g.budget.batches,21);assert.ok(g.budget.vertices<200000);assert.ok(g.budget.triangles<110000);
 assert.ok(g.budget.triangles>95132&&g.budget.triangles-95132<=12000,'Only the approved <=12000 added triangles');
 assert.ok(g.budget.vertices-126320<=30000,'Independent <=30000 additive vertex ledger');return added;
}
