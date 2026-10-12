/** Full original indexed prefixes, normals and metadata are immutable. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as pc from 'playcanvas';
import type {DesertSceneGeometry} from '../../src/desert-scenery';
export const desertSha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
export const desertDigest=(value:unknown)=>desertSha(JSON.stringify(value));
export const desertMaterial=(b:any)=>({name:b.name,color:b.color,roughness:b.roughness,metalness:b.metalness,texture:b.texture});
export const DESERT_APPENDABLE=['components','cameraObstacles','props','foundations','groundedDetails','landforms'] as const;
export const DESERT_EXACT=['version','trackId','roadSamples','routeRoadSamples','roadFaces','roadUndersideFaces','shoulderFaces','structures','landmarks','railMembers','arches','sightlines','terrainGrid'] as const;
export function desertBaselineContract(g:DesertSceneGeometry,theme:unknown){
 const batches=g.batches.map(b=>({material:desertMaterial(b),vertices:b.positions.length/3,indices:b.indices.length,positions:desertDigest(b.positions),uvs:desertDigest(b.uvs),indexed:desertDigest(b.indices),normals:desertDigest(pc.calculateNormals(b.positions,b.indices))}));
 return{budget:g.budget,theme,batches,exact:Object.fromEntries(DESERT_EXACT.map(k=>[k,desertDigest(g[k])])),prefixes:Object.fromEntries(DESERT_APPENDABLE.map(k=>[k,{count:g[k].length,digest:desertDigest(g[k])}]))};
}
export function assertDesertPreservation(g:DesertSceneGeometry,theme:unknown,old:ReturnType<typeof desertBaselineContract>){
 assert.deepEqual(old.budget,{batches:22,triangles:107224,vertices:133911});assert.deepEqual(theme,old.theme,'Original light/fog/sky/theme remain exact');assert.equal(g.batches.length,22);
 for(const [i,b]of g.batches.entries()){
  const before=old.batches[i];assert.deepEqual(desertMaterial(b),before.material,'Original material values and batch order remain exact');assert.ok(b.positions.length/3>=before.vertices&&b.indices.length>=before.indices);
  assert.equal(desertDigest(b.positions.slice(0,before.vertices*3)),before.positions,b.name+' original positions');assert.equal(desertDigest(b.uvs.slice(0,before.vertices*2)),before.uvs,b.name+' original UVs');assert.equal(desertDigest(b.indices.slice(0,before.indices)),before.indexed,b.name+' original primitive indices');
  const normals=pc.calculateNormals(b.positions,b.indices);assert.equal(desertDigest(normals.slice(0,before.vertices*3)),before.normals,b.name+' actual runtime-computed source normals remain exact');
  for(let i=before.vertices*3;i<normals.length;i+=3)assert.ok(Math.abs(Math.hypot(normals[i],normals[i+1],normals[i+2])-1)<1e-5,b.name+' appended source normal is finite and unit length');
  assert.ok(b.indices.slice(before.indices).every(index=>index>=before.vertices),'New geometry may not rewrite normals by sharing original vertices');
 }
 for(const k of DESERT_EXACT)assert.equal(desertDigest(g[k]),old.exact[k],k+' exact original metadata/geometry');
 for(const k of DESERT_APPENDABLE){const before=old.prefixes[k];assert.ok(g[k].length>=before.count);assert.equal(desertDigest(g[k].slice(0,before.count)),before.digest,k+' complete original prefix');}
 const components=g.components.slice(old.prefixes.components.count);assert.ok(components.length>0,'Candidate adds explicit owned scenery');assert.ok(components.every(c=>c.kind.startsWith('desert-enrichment-')&&!c.landmark),'New secondary scenery cannot borrow original hero ownership');
 assert.equal(g.budget.batches,22);assert.ok(g.budget.vertices<200000);assert.ok(g.budget.triangles<125000);assert.ok(g.budget.triangles>old.budget.triangles&&g.budget.triangles-old.budget.triangles<=16000,'Bounded additive triangle allocation');
 return components;
}
