import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,copyFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {successorSha as sha} from './helpers/post-v100-reviewed-revisions';
/** Exercise the REAL terminal adapter against explicitly synthetic successor
 * data, preserving the actual independently pinned historical repin ledger.
 * This fixture neither approves production changes nor writes any repo proof.
 */
test('terminal bridge composes a synthetic exact successor with the unchanged historical repin',()=>{
 const root=mkdtempSync(join(tmpdir(),'successor-terminal-'));mkdirSync(join(root,'tests/helpers'),{recursive:true});mkdirSync(join(root,'docs'));
 try{
  symlinkSync(resolve('node_modules'),join(root,'node_modules'),'dir');
  for(const name of ['post-v100-reviewed-revisions.ts','post-v100-current.ts','stable-pages-v100-repin-reviewed-revisions.ts'])copyFileSync('tests/helpers/'+name,join(root,'tests/helpers',name));
  const old=JSON.parse(readFileSync('tests/helpers/stable-pages-v100-repin-transition.json','utf8'));copyFileSync('tests/helpers/stable-pages-v100-repin-transition.json',join(root,'tests/helpers/stable-pages-v100-repin-transition.json'));
  const path='docs/stable-pages-manifest.json',row=old.changes[path];
  // This independently pinned publication manifest remains protected at the
  // reviewed post-v1.0 endpoint. Refuse any later bytes rather than assuming.
  const endpoint=readFileSync(path,'utf8');assert.equal(sha(endpoint),row.currentSha256);
  const previousLines=endpoint.match(/[^\n]*\n|[^\n]+$/g)??[];
  for(const h of [...row.hunks].reverse()){assert.deepEqual(previousLines.slice(h.afterStart,h.afterStart+h.insertedLines.length),h.insertedLines);previousLines.splice(h.afterStart,h.insertedLines.length,...h.removedLines);}
  const before=previousLines.join('');assert.equal(sha(before),row.previousSha256);
  const current=endpoint+'\n',lineCount=(endpoint.match(/[^\n]*\n|[^\n]+$/g)??[]).length;
  const record={schema:'post-v100-successor-v1',state:'independently-reviewed',baselineTree:'1'.repeat(40),candidateContentTree:'2'.repeat(40),inventoryScope:{kind:'complete-git-content-snapshot-excluding-explicit-audit-bootstrap',excludedPaths:['tests/helpers/post-v100-successor.json','tests/helpers/post-v100-review-pin.ts']},changes:{[path]:{previousSha256:sha(endpoint),currentSha256:sha(current),previousMode:'100644',mode:'100644',kind:'text',scope:'Synthetic newline only; not production approval',evidence:['Synthetic terminal composition unit test'],hunks:[{beforeStart:lineCount,afterStart:lineCount,removedLines:[],insertedLines:['\n']}]}},protectedFiles:{'src/protected.ts':sha('protected')},protectedModes:{'src/protected.ts':'100644'},additions:{}};
  const text=JSON.stringify(record);writeFileSync(join(root,'tests/helpers/post-v100-successor.json'),text);writeFileSync(join(root,'tests/helpers/post-v100-review-pin.ts'),`export const POST_V100_REVIEW_SHA256 = '${sha(text)}';\n`);
  const runner=`import assert from 'node:assert/strict';import {stablePagesV100RepinHash as forward,restoreStablePagesV100RepinBytes as inverse} from './tests/helpers/stable-pages-v100-repin-reviewed-revisions';const p=${JSON.stringify(path)},current=${JSON.stringify(current)},before=${JSON.stringify(before)};assert.equal(forward(p,${JSON.stringify(row.previousSha256)}),${JSON.stringify(sha(current))});assert.equal(inverse(p,current),before);assert.throws(()=>inverse(p,current+' '));assert.throws(()=>forward(p,'0'.repeat(64)));assert.equal(forward('./'+p,'old'),'old');assert.equal(inverse('./'+p,'unreviewed'),'unreviewed');assert.equal(forward('src/protected.ts','unchanged'),'unchanged');assert.equal(inverse('src/protected.ts','unchanged'),'unchanged');`;
  writeFileSync(join(root,'run.ts'),runner);
  const result=spawnSync(process.execPath,[...process.execArgv.filter(x=>x!=='--test'),'run.ts'],{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr);
 }finally{rmSync(root,{recursive:true,force:true});}
});
