/** One finite, serial, memory-bounded source-mesh worker. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {boundedTestProcess} from './helpers/bounded-test-process';
import {cleanupInstrumentedSourceManifest} from './helpers/instrumented-source-files';
test('Town architectural enrichment preserves protection and actual emitted geometry safety',{timeout:360_000},async t=>{
 const root=process.env.TMPDIR??tmpdir();mkdirSync(root,{recursive:true});const run=mkdtempSync(join(root,'town-enrichment-geometry-')),ledger=join(run,'instrumented-sources.json');
 try {
  const result=await boundedTestProcess(process.execPath,['--max-old-space-size=448','--import','tsx','tests/helpers/town-enrichment-geometry-worker.ts'],{timeoutMs:330_000,env:{...process.env,NODE_OPTIONS:'--max-old-space-size=448',TOWN_ENRICHMENT_INSTRUMENT_MANIFEST:ledger},signal:t.signal});
  assert.equal(result.termination,null,result.output);assert.equal(result.code,0,result.output);t.diagnostic(result.output.trim());
 }finally{cleanupInstrumentedSourceManifest(ledger);rmSync(run,{recursive:true,force:true});}
});
