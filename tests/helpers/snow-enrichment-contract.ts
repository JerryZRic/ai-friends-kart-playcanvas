import {assertCurrentSceneMaterial} from './current-airfield-snow-polish';
/** Immutable original indexed-prefix proof. No scenery labels define original membership. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as pc from 'playcanvas';
import type {SnowSceneGeometry} from '../../src/snow-scenery';
export const SNOW_ORIGINAL_SOURCE_SHA256='a33aa52b70e3a234bacccdacbb24f9259c2e010780a4cc56979f0f16d9cf4486';
export const snowSha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
export const snowDigest=(value:unknown)=>snowSha(JSON.stringify(value));
export const snowMaterial=(b:any)=>({name:b.name,color:b.color,roughness:b.roughness,metalness:b.metalness,texture:b.texture});
export const SNOW_APPENDABLE=['components','cameraObstacles','props'] as const;
export const SNOW_EXACT=['version','trackId','roadSamples','routeRoadSamples','roadFaces','roadUndersideFaces','shoulderFaces','structures','landmarks','foundations','groundedDetails','railMembers','wheelContacts','structuralContacts','sightlines','landforms','terrainGrid','terrainVertices','terrainTriangles','terrainExposure','terrainPartitions'] as const;
export function snowBaselineContract(g:SnowSceneGeometry,theme:unknown){
 const batches=g.batches.map(b=>({material:snowMaterial(b),vertices:b.positions.length/3,indices:b.indices.length,positions:snowDigest(b.positions),uvs:snowDigest(b.uvs),indexed:snowDigest(b.indices),normals:snowDigest(pc.calculateNormals(b.positions,b.indices))}));
 return{budget:g.budget,theme,batches,components:g.components,exact:Object.fromEntries(SNOW_EXACT.map(k=>[k,snowDigest(g[k])])),prefixes:Object.fromEntries(SNOW_APPENDABLE.map(k=>[k,{count:g[k].length,digest:snowDigest(g[k])}]))};
}
export type SnowBaselineContract=ReturnType<typeof snowBaselineContract>;
let frozen:SnowBaselineContract|undefined;
export function snowFrozenBaseline(){
 if(!frozen){const text=readFileSync('tests/fixtures/snow-enrichment-original-geometry.json','utf8');assert.equal(snowSha(text),'b36d22a2608ae65811f9623a9a7f10405ac9f91acf774f756e6d21aa6bbca9e9','Frozen original geometry fixture is immutable');const record=JSON.parse(text);assert.equal(record.sourceSha256,SNOW_ORIGINAL_SOURCE_SHA256);frozen=record.protection;}
 return frozen!;
}
/** Certifies exact complete original records, including order/ranges, before projection. */
export function assertSnowOriginalComponents(components:SnowSceneGeometry['components'],old:SnowBaselineContract){
 assert.equal(old.components.length,6339);assert.equal(old.prefixes.components.count,6339);
 assert.ok(components.length>=old.components.length,'An original component was removed');
 const original=components.slice(0,old.components.length);
 assert.deepEqual(original,old.components,'Every original component, order, kind, role, landmark and full indexed range must remain exact');
 assert.equal(snowDigest(original),old.prefixes.components.digest,'Immutable complete original component manifest');return original;
}
export function assertSnowOriginalProjection(g:SnowSceneGeometry,old:SnowBaselineContract=snowFrozenBaseline(),historicalCore=false){
 assert.deepEqual(old.budget,{batches:23,triangles:106286,vertices:155970});assert.equal(g.batches.length,23);
 const original=assertSnowOriginalComponents(g.components,old);
 for(const [i,b]of g.batches.entries()){
  const before=old.batches[i];historicalCore?assert.deepEqual(snowMaterial(b),before.material,'Exact historical core material'):assertCurrentSceneMaterial('snow',i,snowMaterial(b),before.material);
  assert.ok(b.positions.length/3>=before.vertices&&b.indices.length>=before.indices);
  assert.equal(snowDigest(b.positions.slice(0,before.vertices*3)),before.positions,b.name+' original positions');
  assert.equal(snowDigest(b.uvs.slice(0,before.vertices*2)),before.uvs,b.name+' original UVs');
  assert.equal(snowDigest(b.indices.slice(0,before.indices)),before.indexed,b.name+' full original indexed range');
  assert.ok(b.indices.slice(before.indices).every(index=>index>=before.vertices),'No new triangle may reuse an original vertex');
 }
 return original;
}
export function assertSnowPreservation(g:SnowSceneGeometry,theme:unknown,old:SnowBaselineContract,historicalCore=false){
 assertSnowOriginalProjection(g,old,historicalCore);assert.deepEqual(theme,old.theme,'Exact original winter lighting/fog/sky/theme');
 for(const [i,b]of g.batches.entries()){
  const before=old.batches[i],normals=pc.calculateNormals(b.positions,b.indices);
  assert.equal(snowDigest(normals.slice(0,before.vertices*3)),before.normals,b.name+' actual computed original normals');
  for(let j=before.vertices*3;j<normals.length;j+=3)assert.ok(Math.abs(Math.hypot(normals[j],normals[j+1],normals[j+2])-1)<1e-5,b.name+' new finite unit normal');
 }
 for(const k of SNOW_EXACT)assert.equal(snowDigest(g[k]),old.exact[k],k+' exact original metadata/geometry');
 for(const k of SNOW_APPENDABLE){const before=old.prefixes[k];assert.ok(g[k].length>=before.count);assert.equal(snowDigest(g[k].slice(0,before.count)),before.digest,k+' full original prefix');}
 const added=g.components.slice(old.components.length);assert.ok(added.length>0);assert.ok(added.every(c=>c.kind.startsWith('snow-enrichment-')&&!c.landmark),'Secondary additions never claim original landmark ownership');
 assert.equal(g.budget.batches,23);assert.ok(g.budget.vertices<200000);assert.ok(g.budget.triangles<120000);
 assert.ok(g.budget.triangles>106286&&g.budget.triangles-106286<=12000,'Only the approved <=12000 added triangles');
 assert.ok(g.budget.vertices-155970<=30000,'Independent <=30000 additive vertex ledger');return added;
}
