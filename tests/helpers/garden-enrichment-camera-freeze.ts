/** One-time original-only freeze. Refuses existing expectations; never loads candidate. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,statfsSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {boundedTestProcess} from './bounded-test-process';
import {cleanupInstrumentedSourceManifest} from './instrumented-source-files';
import {gardenAuditHashes} from './garden-enrichment-source-stability';
import {gardenSha as sha} from './garden-enrichment-contract';
import {gardenCameraExpectedPath,gardenCameraPlan} from './garden-enrichment-camera-records';
assert.ok(!existsSync(gardenCameraExpectedPath),'Never overwrite original camera expectations');
const plan=gardenCameraPlan(),disk=resolve(process.env.TMPDIR??'../verification-temp'),out=resolve(process.env.GARDEN_ENRICHMENT_AUDIT_DIR??'../land-map-artifacts/garden-enrichment-audit');mkdirSync(disk,{recursive:true});mkdirSync(out,{recursive:true});assert.notEqual(statfsSync(disk).type,0x01021994,'Original raw archives must use disk-backed temporary space');
const run=join(disk,'garden-original-camera-freeze-'+randomUUID());mkdirSync(run);const sourceHashesBefore=gardenAuditHashes(),started=new Date().toISOString(),runs:any[]=[];
for(const suite of ['retained','local']){
 const worker=suite==='retained'?'pose':'camera',ledger=join(run,suite+'-sources.json'),start=Date.now();
 try{const result=await boundedTestProcess(process.execPath,['--max-old-space-size=448','--import','tsx',`tests/helpers/garden-enrichment-${worker}-worker.ts`,'baseline',run,ledger],{timeoutMs:950_000,env:{...process.env,TMPDIR:disk,NODE_OPTIONS:'--max-old-space-size=448',GARDEN_ENRICHMENT_AUDIT_DIR:join(out,'original-camera-freeze')}});writeFileSync(join(out,`original-camera-freeze-${suite}.log`),result.output);runs.push({suite,code:result.code,termination:result.termination,signal:result.signal,seconds:(Date.now()-start)/1000});console.log(JSON.stringify(runs.at(-1)));assert.equal(result.termination,null,result.output);assert.equal(result.code,0,result.output);}finally{cleanupInstrumentedSourceManifest(ledger);}
}
const sourceHashesAfter=gardenAuditHashes();assert.deepEqual(sourceHashesAfter,sourceHashesBefore,'Complete original-only freeze was source-stable');
const retained=JSON.parse(readFileSync(join(run,'baseline-retained-report.json'),'utf8')),local=JSON.parse(readFileSync(join(run,'baseline-local-report.json'),'utf8'));
for(const report of [retained,local]){assert.equal(report.stage,'baseline');assert.equal(report.sourceSha256,plan.originalSourceSha256);assert.equal(report.stable,true);assert.equal(report.outputs.changedRows,0);}
const select=(o:any)=>({rows:o.rows,outputSha256:o.outputSha256,labelSha256:o.labelSha256,phases:o.phases});
const expected={schema:'garden-enrichment-camera-original-outputs-v1',baselineCommit:plan.baselineCommit,baselineSourceSha256:plan.originalSourceSha256,planSha256:sha(readFileSync('tests/helpers/garden-enrichment-camera-frozen.json')),retained:select(retained.outputs),local:select(local.outputs),retainedRetractions:retained.retractions,retainedRetractionOutputSha256:retained.retractionOutputSha256,localBaselineFailuresSha256:local.baselineFailuresSha256,localBaselineWitnesses:local.camera.witnesses.length};
writeFileSync(gardenCameraExpectedPath,JSON.stringify(expected,null,2)+'\n',{flag:'wx'});
writeFileSync(join(out,'original-camera-freeze-receipt.json'),JSON.stringify({schema:'garden-camera-original-freeze-receipt-v1',started,finished:new Date().toISOString(),sourceHashesBefore,sourceHashesAfter,stable:true,runs,rawArchiveName:basename(run),expectedFixture: gardenCameraExpectedPath,expectedFixtureSha256:sha(readFileSync(gardenCameraExpectedPath)),expected,limitations:['Original source-only CPU freeze; no candidate was executed by this runner','Subsequent paired test must reproduce these full-output digests before any candidate acceptance']},null,2)+'\n');
console.log(JSON.stringify({status:'frozen-original-only',expectedFixture:gardenCameraExpectedPath,expectedFixtureSha256:sha(readFileSync(gardenCameraExpectedPath)),rawArchiveName:basename(run),retainedRows:expected.retained.rows,localRows:expected.local.rows,localBaselineWitnesses:expected.localBaselineWitnesses}));
