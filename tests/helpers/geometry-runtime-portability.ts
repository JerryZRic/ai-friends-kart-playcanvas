/** Exact certification of independently reproduced Math.pow fingerprints.
 * Never derives acceptance from candidate geometry and never rounds a number.
 * The historical fixtures remain immutable. Only 51 indexed-buffer Float64 scalars
 * differ, plus their repeated camera-payload coordinates. Float32 is identical.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as pc from 'playcanvas';
export const GEOMETRY_RUNTIME_CERTIFICATE='tests/fixtures/geometry-runtime-portability.json';
export const GEOMETRY_RUNTIME_CERTIFICATE_SHA256='46902badf0d40a040fe311f83e71397df5b7e1211d919b7e4bd3a3a7f1905a87';
const sha=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
const digest=(value:unknown)=>sha(JSON.stringify(value));
export const float64Bits=(value:number)=>{const bytes=Buffer.allocUnsafe(8);bytes.writeDoubleLE(value);return bytes.toString('hex');};
const fromBits=(hex:string)=>Buffer.from(hex,'hex').readDoubleLE();
export type CertifiedMap='garden'|'caldera';
export function assertGeometryCertificateBytes(text:string){
 assert.equal(sha(text),GEOMETRY_RUNTIME_CERTIFICATE_SHA256,'Independently pinned original-only runtime certificate');
 const record=JSON.parse(text);assert.equal(record.schema,'geometry-runtime-portability-v1');return record;
}
export function assertGeometryCertificateDependencies(record:any,read:(path:string)=>Buffer=readFileSync){
 for(const [path,hash]of Object.entries(record.dependencies))assert.equal(sha(read(path)),hash,path+' exact original geometry dependency');
}
let certificate:any;
export function geometryRuntimeCertificate(){
 if(!certificate){const record=assertGeometryCertificateBytes(readFileSync(GEOMETRY_RUNTIME_CERTIFICATE,'utf8'));assertGeometryCertificateDependencies(record);certificate=record;}
 return certificate;
}
export function certifiedGeometryProfile(record=geometryRuntimeCertificate(),bits=record.powInputs.map(([x,y]:number[])=>float64Bits(Math.pow(x,y)))){
 const matches=Object.entries<any>(record.profiles).filter(([,profile])=>JSON.stringify(profile.powBits)===JSON.stringify(bits));
 assert.equal(matches.length,1,'Uncertified Math.pow implementation: independently reproduce original geometry before adding a profile');return matches[0][0] as 'node24'|'node22';
}
export function certifiedGeometryBaseline<T extends {batches:any[];prefixes:any}>(map:CertifiedMap,frozen:T):T{
 const record=geometryRuntimeCertificate(),proof=record.maps[map],profile=certifiedGeometryProfile(record);
 assert.equal(sha(readFileSync(`tests/fixtures/${map}-enrichment-original-geometry.json`)),proof.originalFixtureSha256,'Historical fixture was not rebased');
 const result=structuredClone(frozen);
 for(const patch of proof.replacements){const batch=result.batches[patch.batchIndex];assert.equal(batch.material.name,patch.batch);assert.equal(batch[patch.field],patch.original,'Every alternate starts from an independently frozen exact hash');if(profile==='node22')batch[patch.field]=patch.node22;}
 assert.equal(result.prefixes.cameraObstacles.digest,proof.cameraPayload.original,'The full original camera payload hash remains independently frozen');if(profile==='node22')result.prefixes.cameraObstacles.digest=proof.cameraPayload.node22;
 return result;
}
function numberBuffer(values:ArrayLike<number>,single=false){const bytes=Buffer.allocUnsafe(values.length*(single?4:8));for(let i=0;i<values.length;i++)if(single)bytes.writeFloatLE(values[i],i*4);else bytes.writeDoubleLE(values[i],i*8);return bytes;}
/** A complete byte digest, including signed zeros, for every original scalar. */
export function geometryOriginalBufferDigests(g:{batches:any[]},limits?:{batches:{vertices:number;indices:number}[]}){
 return g.batches.flatMap((batch,i)=>{
  const normals=pc.calculateNormals(batch.positions,batch.indices),before=limits?.batches[i];
  return (['positions','uvs','indices','normals'] as const).map(field=>{const full=field==='normals'?normals:batch[field],length=before?(field==='indices'?before.indices:before.vertices*(field==='uvs'?2:3)):full.length,values=full.slice(0,length);return{batch:batch.name,field,length,sha256:sha(numberBuffer(values))};});
 });
}
/** A fresh unchanged-source build must match a pre-existing certified profile.
 * Replacing only the documented exact scalars must recover the original golden
 * hash. A tolerance, skipped field, unknown index or new runtime is never used.
 */
export function assertCertifiedOriginalGeometry(map:CertifiedMap,g:{batches:any[];cameraObstacles:any[]},actual:any,frozen:any){
 const record=geometryRuntimeCertificate(),profile=certifiedGeometryProfile(record),proof=record.maps[map],expected=certifiedGeometryBaseline(map,frozen);
 // Garden’s frozen file additionally retains its bounds/texture/route receipts;
 // the actual six-field indexed contract must never omit or add a field.
 assert.deepEqual(Object.keys(actual).sort(),['batches','budget','components','exact','prefixes','theme'],'Complete original indexed-contract field set');
 for(const key of Object.keys(actual))assert.deepEqual(actual[key],expected[key],map+' original exactly reproduces certified '+key);
 const buffers=geometryOriginalBufferDigests(g);assert.deepEqual(buffers,proof.rawBuffers[profile],map+' complete unchanged-original Float64 bytes');
 for(const delta of proof.differences){
  const batch=g.batches[delta.batchIndex];assert.equal(batch.name,delta.batch);
  const values=delta.field==='normals'?pc.calculateNormals(batch.positions,batch.indices):batch[delta.field],normalized=Array.from(values) as number[];
  for(const difference of delta.allDiffs){
   const expectedBits=profile==='node22'?difference.bits22:difference.bits24;
   assert.equal(float64Bits(values[difference.index]),expectedBits,map+' exact independently measured differing scalar');
   const a=fromBits(difference.bits24),b=fromBits(difference.bits22);
   assert.deepEqual(numberBuffer([a],true),numberBuffer([b],true),'Certified CPU drift cannot change emitted Float32 bytes');normalized[difference.index]=a;
  }
  assert.equal(digest(normalized),frozen.batches[delta.batchIndex][delta.field],map+' sparse exact restoration reproduces historical full-buffer hash');
 }
 const camera=structuredClone(g.cameraObstacles);
 for(const difference of proof.cameraPayload.differences){const parent=difference.path.slice(0,-1).reduce((value:any,key:any)=>value[key],camera),key=difference.path.at(-1);assert.equal(float64Bits(parent[key]),profile==='node22'?difference.bits22:difference.bits24,'Exact repeated original triangle coordinate');parent[key]=fromBits(difference.bits24);}
 assert.equal(digest(camera),frozen.prefixes.cameraObstacles.digest,'Sparse exact triangle restoration reproduces the complete original camera payload hash');
 return{profile,powBits:record.profiles[profile].powBits,originalBuffers:buffers};
}
