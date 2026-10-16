import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {postV100Review,postV100PortableClosure} from './helpers/post-v100-current';
import {POST_V100_REVIEW_SHA256} from './helpers/post-v100-review-pin';
import {verifySuccessorCheckout,verifySuccessorTrees,restoreSuccessor,successorHash,successorSha} from './helpers/post-v100-reviewed-revisions';
const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=dir==='.'?e.name:dir+'/'+e.name;return dir==='.'&&['.git','node_modules'].includes(e.name)?[]:e.isDirectory()?walk(p):[p];});
test('reviewed successor accounts for every checkout file and reconstructs both exact Git trees',()=>{
 const r=postV100Review();assert.equal(r.baselineTree,'f6d45e8684325c262f03c83c7aeab6ec05ea09e7','Independent published post-v1.0-repin endpoint');
 const paths=walk('.');verifySuccessorCheckout(r,paths,p=>readFileSync(p),POST_V100_REVIEW_SHA256);
 for(const path of paths){const info=lstatSync(path);assert.ok(info.isFile(),path+' actual regular file, no symlink substitution');const mode=r.changes[path]?.mode??r.additions[path]?.mode??r.protectedModes[path]??'100644';assert.equal(info.mode&0o111?'100755':'100644',mode,path+' exact Git executable mode');}
 verifySuccessorTrees(r,p=>readFileSync(p));
});
test('each reviewed successor is exactly reversible and rejects mutation and wrong incoming identity',()=>{
 const r=postV100Review();for(const [path,row]of Object.entries(r.changes)){
  const bytes=readFileSync(path),previous=restoreSuccessor(r,path,bytes);
  assert.equal(successorSha(previous),row.previousSha256,path+' full baseline bytes');
  assert.equal(successorHash(r,path,row.previousSha256),row.currentSha256,path+' full forward identity');
  assert.throws(()=>restoreSuccessor(r,path,Buffer.concat([bytes,Buffer.from(' ')])),undefined,path+' one-byte mutation');
  assert.throws(()=>successorHash(r,path,row.currentSha256),undefined,path+' wrong incoming endpoint');
  if(row.kind==='text'){
   const lines=previous.toString('utf8').match(/[^\n]*\n|[^\n]+$/g)??[];
   for(const h of [...row.hunks!].reverse()){assert.deepEqual(lines.slice(h.beforeStart,h.beforeStart+h.removedLines.length),h.removedLines);lines.splice(h.beforeStart,h.removedLines.length,...h.insertedLines);}
   assert.deepEqual(Buffer.from(lines.join('')),bytes,path+' complete forward byte round trip');
  }
 }
});
test('both portable closure successors retain their historical records and every explicitly added dependency',()=>{
 for(const scene of ['airfield','garden'] as const){const original=JSON.parse(readFileSync(`docs/${scene}-enrichment-qa-files.json`,'utf8'));const r=postV100Review();assert.ok(r.portableClosures?.[scene]);postV100PortableClosure(scene,original.finalFileSha256,r.portableClosures![scene].additions);}
});
