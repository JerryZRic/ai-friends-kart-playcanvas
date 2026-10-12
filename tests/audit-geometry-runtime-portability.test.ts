import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assertGeometryCertificateBytes,assertGeometryCertificateDependencies,certifiedGeometryProfile,geometryRuntimeCertificate,assertCertifiedOriginalGeometry,geometryOriginalBufferDigests,GEOMETRY_RUNTIME_CERTIFICATE,float64Bits} from './helpers/geometry-runtime-portability';
import {gardenSceneData} from './helpers/garden-enrichment-scene';
import {gardenBaselineContract,gardenFrozenBaseline} from './helpers/garden-enrichment-contract';
import {calderaSceneData} from './helpers/caldera-enrichment-scene';
import {calderaBaselineContract,calderaFrozenBaseline} from './helpers/caldera-enrichment-contract';
import {cleanupInstrumentedSourceManifest} from './helpers/instrumented-source-files';

test('Runtime portability accepts only independently pinned original evidence and exact dependencies',()=>{
 const text=readFileSync(GEOMETRY_RUNTIME_CERTIFICATE,'utf8'),record=assertGeometryCertificateBytes(text);
 assert.throws(()=>assertGeometryCertificateBytes(text+' '),'Any unreviewed certificate bytes fail');
 const changed=JSON.parse(text);changed.maps.garden.replacements[0].node22='0'.repeat(64);
 assert.throws(()=>assertGeometryCertificateBytes(JSON.stringify(changed)),'A new geometry fingerprint cannot authorize itself');
 assertGeometryCertificateDependencies(record);
 const first=Object.keys(record.dependencies)[0];assert.throws(()=>assertGeometryCertificateDependencies(record,path=>path===first?Buffer.from('changed dependency'):readFileSync(path)),'Changed original source/toolchain input fails');
 assert.throws(()=>certifiedGeometryProfile(record,['0'.repeat(16),'0'.repeat(16)]),'An unknown runtime cannot choose a nearby expected fingerprint');
 for(const profile of ['node24','node22'])assert.equal(certifiedGeometryProfile(record,record.profiles[profile].powBits),profile);
});

test('Byte comparison retains signed zeros and every normal, UV, position and index',()=>{
 assert.notEqual(float64Bits(0),float64Bits(-0));
 const g={batches:[{name:'triangle',positions:[0,0,0,1,0,0,0,1,0],indices:[0,1,2],uvs:[0,0,1,0,0,1]}]},before=geometryOriginalBufferDigests(g);
 g.batches[0].positions[0]=-0;assert.notDeepEqual(geometryOriginalBufferDigests(g),before,'JSON-equivalent signed-zero mutation is not byte-equivalent');
});

for(const map of ['garden','caldera'] as const)test(map+' fresh immutable original exactly reproduces certified bytes and rejects one-ULP mutation',{timeout:90_000},async()=>{
 const ledger=join(tmpdir(),'geometry-runtime-'+randomUUID()+'.json');
 try{
  const {geometry,theme}=await (map==='garden'?gardenSceneData:calderaSceneData)(true,ledger);
  const actual=(map==='garden'?gardenBaselineContract:calderaBaselineContract)(geometry as any,theme),frozen=(map==='garden'?gardenFrozenBaseline:calderaFrozenBaseline)();
  const missing={...actual};delete missing.exact;assert.throws(()=>assertCertifiedOriginalGeometry(map,geometry,missing,frozen),'No complete metadata/geometry contract field can disappear');
  const proof=assertCertifiedOriginalGeometry(map,geometry,actual,frozen);assert.equal(proof.profile,certifiedGeometryProfile());
  const delta=geometryRuntimeCertificate().maps[map].differences.find((row:any)=>row.field==='positions'),array=geometry.batches[delta.batchIndex].positions,index=delta.allDiffs[0].index,old=array[index],bits=Buffer.allocUnsafe(8);bits.writeDoubleLE(old);bits.writeBigUInt64LE(bits.readBigUInt64LE()+1n);array[index]=bits.readDoubleLE();
  try{assert.throws(()=>assertCertifiedOriginalGeometry(map,geometry,actual,frozen),'Any additional single-ULP position mutation fails complete immutable raw-byte proof');}finally{array[index]=old;}
  assert.deepEqual(geometryOriginalBufferDigests(geometry),proof.originalBuffers);
 }finally{cleanupInstrumentedSourceManifest(ledger);}
});
