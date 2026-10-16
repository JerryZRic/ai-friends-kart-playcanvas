import {postV100Review} from './helpers/post-v100-current';
import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,mkdirSync,readFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createV100HistoricalRuntime} from './helpers/v100-historical-runtime';
import {v100Review,v100Sha} from './helpers/v100-reviewed-revisions';

test('historical control graph restores every reviewed source and excludes every new source, including pickup-size',()=>{
 const parent=mkdtempSync(join(tmpdir(),'v100-graph-test-')),review=v100Review();
 const runtime=createV100HistoricalRuntime(parent);
 try {
  for(const [path,hash]of Object.entries(review.protectedFiles).filter(([path])=>path.startsWith('src/')))assert.equal(v100Sha(runtime.read(path)),hash,path);
  for(const [path,row]of Object.entries(review.changes).filter(([path])=>path.startsWith('src/')))assert.equal(v100Sha(runtime.read(path)),row.previousSha256,path);
  for(const path of [...Object.keys(review.additions),...Object.keys(postV100Review().additions)].filter(path=>path.startsWith('src/')))assert.throws(()=>runtime.read(path),{code:'ENOENT'},path+' cannot leak into historical dependency graph');
  assert.doesNotMatch(runtime.read('src/npc-tactics.ts'),/pickup-size/);
  assert.doesNotMatch(runtime.read('src/land-race-route.ts'),/pickup-size/);
  assert.doesNotMatch(runtime.read('src/pickup-visual.ts'),/pickup-size/);
  assert.equal(runtime.read('src/maps/mountain.ts'),readFileSync('src/maps/mountain.ts','utf8'));
  assert.equal(v100Sha(runtime.read('src/mountain-scenery.ts')),review.protectedFiles['src/mountain-scenery.ts'],'Historical scenery stays exactly at its original graph endpoint');
  assert.notEqual(runtime.read('src/game.ts'),readFileSync('src/game.ts','utf8'),'historical entry never retains current SPA behavior');
  assert.ok(fileURLToPath(runtime.directory).startsWith(parent));
 }finally{runtime.dispose();assert.deepEqual(readdirSync(parent),[]);rmSync(parent,{recursive:true});}
});

test('historical bridge rejects modified collision, new constants, unreviewed files and missing dependencies',()=>{
 const parent=mkdtempSync(join(tmpdir(),'v100-graph-negative-')),candidate=join(parent,'candidate'),outputs=join(parent,'outputs');mkdirSync(candidate);mkdirSync(outputs);
 cpSync('src',join(candidate,'src'),{recursive:true});
 try {
  for(const path of ['src/npc-tactics.ts','src/pickup-size.ts','src/maps/mountain.ts']){
   const original=readFileSync(join(candidate,path));writeFileSync(join(candidate,path),Buffer.concat([original,Buffer.from(' ')]));
   assert.throws(()=>createV100HistoricalRuntime(outputs,candidate),/verified/);assert.deepEqual(readdirSync(outputs),[]);
   writeFileSync(join(candidate,path),original);
  }
  const extra=join(candidate,'src/unreviewed-runtime.ts');writeFileSync(extra,'export const changed=true;');
  assert.throws(()=>createV100HistoricalRuntime(outputs,candidate),/complete reviewed source inventory/);rmSync(extra);
  rmSync(join(candidate,'src/npc-tactics.ts'));
  assert.throws(()=>createV100HistoricalRuntime(outputs,candidate),/complete reviewed source inventory/);
  assert.deepEqual(readdirSync(outputs),[]);
 }finally{rmSync(parent,{recursive:true,force:true});}
});
