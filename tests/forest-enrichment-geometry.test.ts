/** Focused bounded Forest source audit; no browser, GPU or unchanged native reruns. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {boundedTestProcess} from './helpers/bounded-test-process';
import {cleanupInstrumentedSourceManifest} from './helpers/instrumented-source-files';
test('Forest enrichment preserves protected original geometry and validates indexed foliage', {timeout:990_000},async t=>{
 const run=join(process.env.TMPDIR??tmpdir(),'forest-enrichment-geometry-'+randomUUID());mkdirSync(run,{recursive:true});
 try{
  for(const stage of ['baseline','candidate']){
   const ledger=join(run,stage+'-sources.json');
   try{const result=await boundedTestProcess(process.execPath,['--max-old-space-size=448','--import','tsx','tests/helpers/forest-enrichment-geometry-worker.ts',stage,run,ledger],{timeoutMs:480_000,env:{...process.env,NODE_OPTIONS:'--max-old-space-size=448'},signal:t.signal});assert.equal(result.termination,null,result.output);assert.equal(result.code,0,result.output);}
   finally{cleanupInstrumentedSourceManifest(ledger);}
  }
  t.diagnostic(readFileSync(join(run,'candidate-report.json'),'utf8'));
 }finally{rmSync(run,{recursive:true,force:true});}
});
