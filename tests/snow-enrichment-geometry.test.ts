import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {boundedTestProcess} from './helpers/bounded-test-process';
import {cleanupInstrumentedSourceManifest} from './helpers/instrumented-source-files';
test('Snow append-only enrichment preserves indexed original normals,ownership,support and materials',{timeout:990_000},async t=>{
 const run=join(process.env.TMPDIR??tmpdir(),'snow-enrichment-geometry-'+randomUUID());mkdirSync(run,{recursive:true});
 try{for(const stage of ['baseline','candidate']){const ledger=join(run,stage+'-sources.json');try{const result=await boundedTestProcess(process.execPath,['--max-old-space-size=448','--import','tsx','tests/helpers/snow-enrichment-geometry-worker.ts',stage,run,ledger],{timeoutMs:480_000,env:{...process.env,NODE_OPTIONS:'--max-old-space-size=448'},signal:t.signal});assert.equal(result.termination,null,result.output);assert.equal(result.code,0,result.output);}finally{cleanupInstrumentedSourceManifest(ledger);}}const report=JSON.parse(readFileSync(join(run,'candidate-report.json'),'utf8'));t.diagnostic(JSON.stringify({sourceSha256:report.sourceSha256,budget:report.budget,protectedComponents:report.protectedComponents,addedComponents:report.addedComponents,newTriangles:report.newTriangles,resources:report.resources}));}finally{rmSync(run,{recursive:true,force:true});}
});
