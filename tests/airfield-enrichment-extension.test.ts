import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,rmSync,statfsSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {boundedTestProcess} from './helpers/bounded-test-process';
import {cleanupInstrumentedSourceManifest} from './helpers/instrumented-source-files';
import {airfieldAuditHashes} from './helpers/airfield-enrichment-source-stability';
import {airfieldSha as sha} from './helpers/airfield-enrichment-contract';
test('Airfield extra placement extents preserve separately frozen immutable-original dense and live camera outputs',{timeout:1900000},async t=>{
 const disk=resolve(process.env.TMPDIR??'../verification-temp/airfield');mkdirSync(disk,{recursive:true});assert.notEqual(statfsSync(disk).type,0x01021994);const run=join(disk,'airfield-extra-camera-pair-'+randomUUID());mkdirSync(run);const before=airfieldAuditHashes(),started=new Date().toISOString(),runs:any[]=[];
 try{for(const stage of ['baseline','candidate']){const ledger=join(run,stage+'-ledger.json');try{const result=await boundedTestProcess(process.execPath,['--max-old-space-size=448','--import','tsx','tests/helpers/airfield-enrichment-extension-worker.ts',stage,run,ledger],{timeoutMs:950000,env:{...process.env,NODE_OPTIONS:'--max-old-space-size=448',TMPDIR:disk},signal:t.signal});runs.push({stage,code:result.code,termination:result.termination,signal:result.signal});assert.equal(result.termination,null,result.output);assert.equal(result.code,0,result.output);}finally{cleanupInstrumentedSourceManifest(ledger);}}
 const after=airfieldAuditHashes();assert.deepEqual(after,before);const report=JSON.parse(readFileSync(join(run,'candidate-extension-report.json'),'utf8')),out=resolve(process.env.AIRFIELD_ENRICHMENT_AUDIT_DIR??'../land-map-artifacts/airfield-enrichment-audit');mkdirSync(out,{recursive:true});writeFileSync(join(out,'extra-camera-pair-receipt.json'),JSON.stringify({status:'passed',started,finished:new Date().toISOString(),sourceHashesBefore:before,sourceHashesAfter:after,stable:true,runs,sourceSha256:report.sourceSha256,fixtureSha256:sha(readFileSync('tests/fixtures/airfield-enrichment-camera-extension-outputs.json')),rows:report.outputs.rows,changedRows:report.outputs.changedRows,newWitnesses:report.camera.newWitnesses.length,denseStations:report.camera.denseStations,densePoses:report.camera.densePoses,movingFrames:report.camera.movingFrames,limitations:['Separate additional range includes deliberate overlap with existing dense safety coverage; do not add station totals as if every physical station were distinct','Original frozen review cameras and original519453/311356 output matrices remain unchanged']},null,2)+'\n');t.diagnostic(JSON.stringify({rows:report.outputs.rows,densePoses:report.camera.densePoses,movingFrames:report.camera.movingFrames}));
 }finally{rmSync(run,{recursive:true,force:true});}
});
