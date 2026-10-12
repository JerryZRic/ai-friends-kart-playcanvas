/** Immutable original indexed-prefix proof. No scenery labels define original membership. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as pc from 'playcanvas';
import {certifiedGeometryBaseline} from './geometry-runtime-portability';
import type {GardenSceneGeometry} from '../../src/garden-scenery';
export const GARDEN_ORIGINAL_SOURCE_SHA256='684f7d54d9318fbeac7c8c625772807e1d4b8f2c8c0718b01090d54d05605d40';
export const gardenSha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
export const gardenDigest=(value:unknown)=>gardenSha(JSON.stringify(value));
export const gardenMaterial=(b:any)=>Object.fromEntries(Object.entries(b).filter(([k])=>!['positions','indices','uvs','normals'].includes(k)));
export const GARDEN_APPENDABLE=['components','cameraObstacles','props','foundations','groundedDetails','structuralContacts','landforms','assemblies'] as const;
export const GARDEN_EXACT=['version','trackId','roadSamples','routeRoadSamples','roadFaces','roadUndersideFaces','shoulderFaces','structures','landmarks','railMembers','wheelContacts','sightlines','terrainGrid','terrainVertices','terrainTriangles','terrainExposure','terrainPartitions','arbor'] as const;
export function gardenBaselineContract(g:GardenSceneGeometry,theme:unknown){
 const batches=g.batches.map(b=>({material:gardenMaterial(b),vertices:b.positions.length/3,indices:b.indices.length,positions:gardenDigest(b.positions),uvs:gardenDigest(b.uvs),indexed:gardenDigest(b.indices),normals:gardenDigest(pc.calculateNormals(b.positions,b.indices))}));
 return{budget:g.budget,theme,batches,components:g.components,exact:Object.fromEntries(GARDEN_EXACT.map(k=>[k,gardenDigest(g[k])])),prefixes:Object.fromEntries(GARDEN_APPENDABLE.map(k=>[k,{count:g[k].length,digest:gardenDigest(g[k])}]))};
}
export type GardenBaselineContract=ReturnType<typeof gardenBaselineContract>;
let frozen:GardenBaselineContract|undefined;
export function gardenFrozenBaseline(){
 if(!frozen){const text=readFileSync('tests/fixtures/garden-enrichment-original-geometry.json','utf8');assert.equal(gardenSha(text),'d9cfca121326440d1eedfc5ce202710a7428c390be647abd9980f676d3896be0','Frozen original geometry fixture is immutable');const record=JSON.parse(text);assert.equal(record.sourceSha256,GARDEN_ORIGINAL_SOURCE_SHA256);frozen=record.protection;}
 return frozen!;
}
export const gardenRuntimeBaseline=()=>certifiedGeometryBaseline('garden',gardenFrozenBaseline());
/** Certifies exact complete original records, including order/ranges, before projection. */
export function assertGardenOriginalComponents(components:GardenSceneGeometry['components'],old:GardenBaselineContract){
 assert.equal(old.components.length,1813);assert.equal(old.prefixes.components.count,1813);
 assert.ok(components.length>=old.components.length,'An original component was removed');
 const original=components.slice(0,old.components.length);
 assert.deepEqual(original,old.components,'Every original component, order, kind, role, landmark and full indexed range must remain exact');
 assert.equal(gardenDigest(original),old.prefixes.components.digest,'Immutable complete original component manifest');return original;
}
export function assertGardenOriginalProjection(g:GardenSceneGeometry,old:GardenBaselineContract=gardenRuntimeBaseline()){
 assert.deepEqual(old.budget,{batches:21,triangles:108557,vertices:117223});assert.equal(g.batches.length,21);
 const original=assertGardenOriginalComponents(g.components,old);
 for(const [i,b]of g.batches.entries()){
  const before=old.batches[i];assert.deepEqual(gardenMaterial(b),before.material,'Exact original material values and batch order');
  assert.ok(b.positions.length/3>=before.vertices&&b.indices.length>=before.indices);
  assert.equal(gardenDigest(b.positions.slice(0,before.vertices*3)),before.positions,b.name+' original positions');
  assert.equal(gardenDigest(b.uvs.slice(0,before.vertices*2)),before.uvs,b.name+' original UVs');
  assert.equal(gardenDigest(b.indices.slice(0,before.indices)),before.indexed,b.name+' full original indexed range');
  assert.ok(b.indices.slice(before.indices).every(index=>index>=before.vertices),'No new triangle may reuse an original vertex');
 }
 return original;
}
export function assertGardenPreservation(g:GardenSceneGeometry,theme:unknown,old:GardenBaselineContract){
 assertGardenOriginalProjection(g,old);assert.deepEqual(theme,old.theme,'Exact original garden lighting/fog/sky/theme');
 for(const [i,b]of g.batches.entries()){
  const before=old.batches[i],normals=pc.calculateNormals(b.positions,b.indices);
  assert.equal(gardenDigest(normals.slice(0,before.vertices*3)),before.normals,b.name+' actual computed original normals');
  for(let j=before.vertices*3;j<normals.length;j+=3)assert.ok(Math.abs(Math.hypot(normals[j],normals[j+1],normals[j+2])-1)<1e-5,b.name+' new finite unit normal');
 }
 for(const k of GARDEN_EXACT)assert.equal(gardenDigest(g[k]),old.exact[k],k+' exact original metadata/geometry');
 for(const k of GARDEN_APPENDABLE){const before=old.prefixes[k];assert.ok(g[k].length>=before.count);assert.equal(gardenDigest(g[k].slice(0,before.count)),before.digest,k+' full original prefix');}
 const added=g.components.slice(old.components.length);assert.ok(added.length>0);assert.ok(added.every(c=>c.kind.startsWith('garden-enrichment-')&&!c.landmark),'Secondary additions never claim original landmark ownership');
 assert.equal(g.budget.batches,21);assert.ok(g.budget.vertices<200000);assert.ok(g.budget.triangles<120000);
 assert.ok(g.budget.triangles>108557&&g.budget.triangles-108557<=10000,'Only the approved <=10000 added triangles');
 assert.ok(g.budget.vertices-117223<=20000,'Independent <=20000 additive vertex ledger');return added;
}
