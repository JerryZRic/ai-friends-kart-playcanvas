/** Independent, bounded before/after emitted-face audit. Baseline and candidate
 * run serially in separate <=448 MiB processes, never concurrently. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {boundedTestProcess} from './helpers/bounded-test-process';
import {cleanupInstrumentedSourceManifest} from './helpers/instrumented-source-files';

test('Town enrichment keeps fixed landmark views and adds no rendered-face camera regressions', {timeout:660_000},async t=>{
 const root=process.env.TMPDIR??tmpdir();mkdirSync(root,{recursive:true});const run=mkdtempSync(join(root,'town-enrichment-camera-'));
 try{
  for(const stage of ['baseline','candidate']){
   const ledger=join(run,stage+'-sources.json');
   try{const result=await boundedTestProcess(process.execPath,['--max-old-space-size=448','--import','tsx','tests/helpers/town-enrichment-camera-worker.ts',stage,run,ledger],{timeoutMs:300_000,env:{...process.env,NODE_OPTIONS:'--max-old-space-size=448'},signal:t.signal});
   assert.equal(result.termination,null,result.output);assert.equal(result.code,0,result.output);
   }finally{cleanupInstrumentedSourceManifest(ledger);}
  }
  const report=JSON.parse(readFileSync(join(run,'candidate-report.json'),'utf8'));
  t.diagnostic(JSON.stringify({stage:report.stage,durationSeconds:report.durationSeconds,resources:report.resources,static:{stations:report.metrics.static.stations,poses:report.metrics.static.poses,booms:report.metrics.static.booms},motion:{runs:report.metrics.motion.runs,frames:report.metrics.motion.frames},frozenPoses:report.metrics.frozenReplay.count,changedFaces:report.metrics.changedFaces,totalFailures:report.totalFailures,inheritedFailures:report.inheritedFailures,newFailures:report.newFailures,landmarks:report.metrics.landmarks.map(({rays,...result})=>result),visibilityFailures:report.visibilityFailures}));assert.equal(report.newFailures,0,JSON.stringify(report.failureExamples));assert.deepEqual(report.visibilityFailures,[],JSON.stringify(report.visibilityFailures));
 }finally{rmSync(run,{recursive:true,force:true});}
});
