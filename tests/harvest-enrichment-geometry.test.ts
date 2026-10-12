/** Original camera/gameplay suites remain intact; this adds bounded art QA. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {boundedTestProcess} from './helpers/bounded-test-process';
import {cleanupInstrumentedSourceManifest} from './helpers/instrumented-source-files';
test('Harvest explicit field and orchard changes preserve original geometry and actual contacts',{timeout:990_000},async t=>{
 const run=join(process.env.TMPDIR??tmpdir(),'harvest-enrichment-geometry-'+randomUUID());mkdirSync(run,{recursive:true});
 try{
  for(const stage of ['baseline','candidate']){const ledger=join(run,stage+'-sources.json');try{const result=await boundedTestProcess(process.execPath,['--max-old-space-size=448','--import','tsx','tests/helpers/harvest-enrichment-geometry-worker.ts',stage,run,ledger],{timeoutMs:480_000,env:{...process.env,NODE_OPTIONS:'--max-old-space-size=448'},signal:t.signal});assert.equal(result.termination,null,result.output);assert.equal(result.code,0,result.output);}finally{cleanupInstrumentedSourceManifest(ledger);}}
  const report=JSON.parse(readFileSync(join(run,'candidate-report.json'),'utf8'));t.diagnostic(JSON.stringify({sourceSha256:report.sourceSha256,budget:report.budget,protectedParts:report.protectedParts,changedParts:report.changedParts,changedKinds:report.changedKinds,cropFaces:report.cropFaces,rootFootprints:report.rootFootprints,treeContacts:report.treeContacts,assemblies:report.assembly.assemblies,assemblyContacts:report.assembly.contacts,wholeSeatContacts:report.assembly.wholeSeatContacts,cameraFaces:report.cameraFaces,exposedCoflush:report.exposedCoflush.length,newExposedCoflush:report.newExposedCoflush.length,resources:report.resources}));
 }finally{rmSync(run,{recursive:true,force:true});}
});
