import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {boundedTestProcess} from './helpers/bounded-test-process';
import {cleanupInstrumentedSourceManifest} from './helpers/instrumented-source-files';
test('Snow frozen forward views and added static/live camera matrix preserve exact original witnesses',{timeout:990_000},async t=>{
 const run=join(process.env.TMPDIR??tmpdir(),'snow-enrichment-camera-'+randomUUID());mkdirSync(run,{recursive:true});
 try{for(const stage of ['baseline','candidate']){const ledger=join(run,stage+'-sources.json');try{const result=await boundedTestProcess(process.execPath,['--max-old-space-size=448','--import','tsx','tests/helpers/snow-enrichment-camera-worker.ts',stage,run,ledger],{timeoutMs:480_000,env:{...process.env,NODE_OPTIONS:'--max-old-space-size=448'},signal:t.signal});assert.equal(result.termination,null,result.output);assert.equal(result.code,0,result.output);}finally{cleanupInstrumentedSourceManifest(ledger);}}const report=JSON.parse(readFileSync(join(run,'candidate-report.json'),'utf8'));t.diagnostic(JSON.stringify({sourceSha256:report.sourceSha256,staticPoses:report.camera.staticPoses,densePoses:report.camera.densePoses,denseStations:report.camera.denseStations,movingFrames:report.camera.movingFrames,inspections:report.camera.inspections,oldWitnesses:report.camera.witnesses.length-report.camera.newWitnesses.length,newWitnesses:report.camera.newWitnesses.length,resources:report.resources}));}finally{rmSync(run,{recursive:true,force:true});}
});
