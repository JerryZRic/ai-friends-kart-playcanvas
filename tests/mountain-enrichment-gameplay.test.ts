import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MOUNTAIN_TRACK} from '../src/maps/mountain';
import {CHARACTER_PROFILES} from '../src/character-profiles';
import {assertNativePartition,nativeCountFields,nativePartitions,nativePosePlan,nativeResources,nativeSourceHashes,NATIVE_ASSEMBLIES,NATIVE_MESH_BOUNDS,poseDigest,type NativePartition} from './helpers/mountain-native-partitions';

import {boundedTestProcess} from './helpers/bounded-test-process';
import {cleanupInstrumentedSourceManifest} from './helpers/instrumented-source-files';

const initialHashes=nativeSourceHashes();after(()=>assert.deepEqual(nativeSourceHashes(),initialHashes,'native source changed during the run'));
const worker=fileURLToPath(new URL('./helpers/mountain-native-audit-worker.ts',import.meta.url));
const racers=['whale',...CHARACTER_PROFILES.map(p=>p.id).filter(id=>id!=='whale')];
const plan=nativePosePlan(MOUNTAIN_TRACK,racers);

// The orchestrator never creates an AppBase, loads assets, or retains meshes.
// One child exits (including harness cleanup) before the next is started, so
// engine, glTF, typed-array and allocator high-water memory dies between shards.
test('Mountain enrichment preserves complete native controls and audits real six-driver geometry/cameras',async t=>{
 assert.equal(plan.length,NATIVE_ASSEMBLIES);
 const auditDir=process.env.MOUNTAIN_AUDIT_DIR?resolve(process.env.MOUNTAIN_AUDIT_DIR):undefined;
 if(auditDir)mkdirSync(auditDir,{recursive:true});
 const runDir=mkdtempSync(resolve(auditDir??tmpdir(),'mountain-native-'));
 const oldSpace=Number(process.env.MOUNTAIN_NATIVE_OLD_SPACE_MIB??320),maxPoses=Number(process.env.MOUNTAIN_NATIVE_SHARD_POSES??378);
 assert.ok(Number.isInteger(oldSpace)&&oldSpace>=256&&oldSpace<=448,'native child old-space cap must be 256–448 MiB');
 const partitions=nativePartitions(plan.length,maxPoses);
 let completed=false;
 const run=async(partition:NativePartition)=>{
  const result=resolve(runDir,partition.id+'.json');
  const args=[`--max-old-space-size=${oldSpace}`,'--max-semi-space-size=16','--expose-gc','--import','tsx','--test','--test-concurrency=1',worker];
  const manifest=resolve(runDir,partition.id+'.sources.json');
  const outcome=await boundedTestProcess(process.execPath,args,{cwd:process.cwd(),env:{...process.env,NODE_OPTIONS:'',MOUNTAIN_AUDIT_DIR:runDir,MOUNTAIN_NATIVE_PARTITION:JSON.stringify(partition),MOUNTAIN_NATIVE_RESULT:result,MOUNTAIN_NATIVE_SOURCE_MANIFEST:manifest},timeoutMs:partition.kind==='camera'?600000:120000,signal:t.signal});
  writeFileSync(resolve(runDir,partition.id+'.log'),outcome.output);
  // Child close is awaited before cleanup or another engine/model allocation.
  // SIGTERM gets a short grace period before SIGKILL of the entire worker group.
  cleanupInstrumentedSourceManifest(manifest);
  assert.ok(outcome.code===0&&!outcome.signal&&!outcome.termination,`Native ${partition.id} failed (code=${outcome.code}, signal=${outcome.signal}, termination=${outcome.termination}); report directory: ${runDir}\n${outcome.output}`);
  const output=outcome.output;
  if(partition.kind==='capture'){t.diagnostic(output);return null;}
  const report=JSON.parse(readFileSync(result,'utf8'));
  assert.deepEqual(report.sourceHashes,initialHashes);assert.deepEqual(report.partition,partition);
  assert.equal(report.resources.configuredOldSpaceMiB,oldSpace,'report labels the actual child heap flag');
  assert.ok(report.resources.v8HeapLimitMiB>oldSpace,'measured total V8 heap includes other spaces');
  return report;
 };
 try{
  if(process.env.MOUNTAIN_NATIVE_GOLDEN_CAPTURE){await run({kind:'capture',id:'capture',start:0,end:0});completed=true;return;}
  const report:any={sourceHashes:initialHashes,controls:null,...Object.fromEntries(nativeCountFields.map(key=>[key,0])),supportMinimumPlaneDistance:Infinity,intrusions:[],witnesses:[],poses:[],camera:null,expectedAssemblies:NATIVE_ASSEMBLIES,expectedMeshBounds:NATIVE_MESH_BOUNDS,coverage:{sha256:poseDigest(plan),racerIds:racers,completed:0,total:partitions.length,shards:[]},resources:{orchestrator:nativeResources(),maxChildRSSKiB:0,childOldSpaceMiB:oldSpace,concurrency:1},limitations:[]};
  const flush=(phase:string)=>{report.phase=phase;if(auditDir)writeFileSync(resolve(auditDir,'native-progress-report.json'),JSON.stringify(report,null,2)+'\n');};
  flush('native-mesh-start');
  for(const partition of partitions){
   const shard=await run(partition);assertNativePartition(shard,partition,plan,initialHashes);
   assert.equal(partition.start,report.assemblies,'aggregate has no missing or overlapping range');
   assert.deepEqual(shard.coverage.racerIds,racers,'original native racer order remains exact');
   if(report.controls===null)report.controls=shard.controls;else assert.deepEqual(shard.controls,report.controls,'every shard preserves the identical full native control digest');
   for(const field of nativeCountFields)report[field]+=shard[field];
   report.supportMinimumPlaneDistance=Math.min(report.supportMinimumPlaneDistance,shard.supportMinimumPlaneDistance??Infinity);
   report.intrusions.push(...shard.intrusions.slice(0,120-report.intrusions.length));report.witnesses.push(...shard.witnesses.slice(0,160-report.witnesses.length));report.poses.push(...shard.poses.slice(0,36-report.poses.length));
   report.coverage.completed++;report.coverage.shards.push({partition,sha256:shard.coverage.sha256,assemblies:shard.assemblies,meshBounds:shard.meshBounds,resources:shard.resources});
   report.resources.maxChildRSSKiB=Math.max(report.resources.maxChildRSSKiB,shard.resources.maxRSSKiB);report.limitations=shard.limitations;
   flush('native-mesh-running');
   t.diagnostic(`Mountain native ${partition.id}: ${report.assemblies}/${NATIVE_ASSEMBLIES} poses, ${report.meshBounds}/${NATIVE_MESH_BOUNDS} bounds; child peak ${shard.resources.maxRSSKiB} KiB`);
  }
  assert.equal(report.assemblies,NATIVE_ASSEMBLIES);assert.equal(report.meshBounds,NATIVE_MESH_BOUNDS);assert.equal(report.coverage.completed,partitions.length);
  flush('native-mesh-complete');
  const camera=await run({kind:'camera',id:'camera-controls',start:0,end:plan.length});
  assert.deepEqual({...camera.controls,pauseItemsTouchRetryNavigation:undefined},{...report.controls,pauseItemsTouchRetryNavigation:undefined});
  assert.equal(camera.replayedAssemblies,NATIVE_ASSEMBLIES,'camera worker sees all original assembly animation updates');
  assert.equal(camera.assemblies,0);assert.equal(camera.meshBounds,0);assert.equal(camera.camera.views,96);assert.equal(camera.camera.smoothedFrames,14679);
  assert.equal(camera.controls.pauseItemsTouchRetryNavigation,true);assert.equal(camera.camera.failures.length,0);
  report.controls=camera.controls;report.camera=camera.camera;report.resources.camera=camera.resources;report.resources.maxChildRSSKiB=Math.max(report.resources.maxChildRSSKiB,camera.resources.maxRSSKiB);
  flush('native-complete');
  if(auditDir){const json=JSON.stringify(report,null,2)+'\n';writeFileSync(resolve(auditDir,'native-report.json'),json);writeFileSync(resolve(auditDir,new Date().toISOString().replaceAll(':','-')+'-native-report.json'),json);}
  t.diagnostic(JSON.stringify({controls:report.controls,assemblies:report.assemblies,meshBounds:report.meshBounds,sourceCandidates:report.sourceCandidates,supportContacts:report.supportContacts,supportActualIntersections:report.supportActualIntersections,supportMinimumPlaneDistance:report.supportMinimumPlaneDistance,exactRefinements:report.exactRefinements,failures:report.failures,camera:report.camera,resources:report.resources,limitations:report.limitations}));
  completed=true;
 }finally{if(completed&&!auditDir)rmSync(runDir,{recursive:true});}
});
