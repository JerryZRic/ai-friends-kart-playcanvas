import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,rmSync,statfsSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {boundedTestProcess} from './helpers/bounded-test-process';
import {cleanupInstrumentedSourceManifest} from './helpers/instrumented-source-files';
import {gardenCameraExpectedPath} from './helpers/garden-enrichment-camera-records';
import {gardenAuditHashes} from './helpers/garden-enrichment-source-stability';
import {gardenSha} from './helpers/garden-enrichment-contract';
import {gardenEnrichmentCameraSentinels} from './helpers/garden-enrichment-camera-checks';
test('Garden independent camera oracle catches whole-segment near-miss and below-ground sentinels',()=>gardenEnrichmentCameraSentinels());
test('Garden retains complete frozen output matrices and adds dense local 2m and real30/60/144Hz triangle probes',{timeout:3_900_000},async t=>{
 assert.ok(existsSync(gardenCameraExpectedPath),'Original-only output digests must already be frozen; this test never creates or updates expectations');
 const disk=resolve(process.env.TMPDIR??'../verification-temp');mkdirSync(disk,{recursive:true});assert.notEqual(statfsSync(disk).type,0x01021994,'Keep bounded worker archives on disk, never tmpfs');
 const run=join(disk,'garden-enrichment-camera-'+randomUUID());mkdirSync(run);const sourceHashesBefore=gardenAuditHashes(),started=new Date().toISOString(),runs:any[]=[];
 try{
  // Complete both immutable-source baseline archives before candidate execution.
  for(const stage of ['baseline','candidate'])for(const suite of ['retained','local']){
   const ledger=join(run,stage+'-'+suite+'-sources.json'),worker=suite==='retained'?'pose':'camera';
   try{const result=await boundedTestProcess(process.execPath,['--max-old-space-size=448','--import','tsx',`tests/helpers/garden-enrichment-${worker}-worker.ts`,stage,run,ledger],{timeoutMs:950_000,env:{...process.env,TMPDIR:disk,NODE_OPTIONS:'--max-old-space-size=448'},signal:t.signal});runs.push({stage,suite,code:result.code,termination:result.termination,signal:result.signal});assert.equal(result.termination,null,result.output);assert.equal(result.code,0,result.output);}finally{cleanupInstrumentedSourceManifest(ledger);}
  }
  const retained=JSON.parse(readFileSync(join(run,'candidate-retained-report.json'),'utf8')),local=JSON.parse(readFileSync(join(run,'candidate-local-report.json'),'utf8'));
  const sourceHashesAfter=gardenAuditHashes();assert.deepEqual(sourceHashesAfter,sourceHashesBefore,'All four serial camera stages were source-stable');
  if(process.env.GARDEN_ENRICHMENT_AUDIT_DIR){
   const out=resolve(process.env.GARDEN_ENRICHMENT_AUDIT_DIR);mkdirSync(out,{recursive:true});
   const reportFiles=Object.fromEntries(['baseline-retained-camera-report.json','candidate-retained-camera-report.json','baseline-local-camera-report.json','candidate-local-camera-report.json'].map(name=>[name,gardenSha(readFileSync(join(out,name)))]));
   writeFileSync(join(out,'camera-pair-receipt.json'),JSON.stringify({schema:'garden-camera-pair-receipt-v1',status:'passed',started,finished:new Date().toISOString(),sourceSha256:retained.sourceSha256,sourceHashesBefore,sourceHashesAfter,stable:true,runs,expectedFixtureSha256:gardenSha(readFileSync(gardenCameraExpectedPath)),reportFiles,retained:{rows:retained.outputs.rows,changedRows:retained.outputs.changedRows,outputSha256:retained.outputs.outputSha256,labelSha256:retained.outputs.labelSha256,retractions:retained.retractions},local:{rows:local.outputs.rows,changedRows:local.outputs.changedRows,outputSha256:local.outputs.outputSha256,labelSha256:local.outputs.labelSha256,newWitnesses:local.camera.newWitnesses.length,inheritedWitnesses:local.camera.witnesses.length-local.camera.newWitnesses.length,inspections:local.camera.inspections},limitations:['Exact CPU source camera outputs and triangle clearance; native pixels/GPU/FPS are separate','Original retained independent collision, terrain and frustum assertions remain separately required']},null,2)+'\n');
  }
  t.diagnostic(JSON.stringify({retained:{wholeCoursePoses:retained.wholeCoursePoses,retractions:retained.retractions,seamFrames:retained.seamFrames,liveFrames:retained.liveFrames,gameplayPoses:retained.gameplayPoses,pickupRays:retained.pickupRays,arborPoses:retained.arborPoses,outputs:retained.outputs,resources:retained.resources},local:{denseStations:local.camera.denseStations,densePoses:local.camera.densePoses,movingFrames:local.camera.movingFrames,inspections:local.camera.inspections,witnesses:local.camera.witnesses.length,newWitnesses:local.camera.newWitnesses.length,outputs:local.outputs,resources:local.resources}}));
 }finally{rmSync(run,{recursive:true,force:true});}
});
