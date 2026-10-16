import test from 'node:test';
import assert from 'node:assert/strict';
import {readPinnedSuccessor,restoreSuccessor,successorHash,successorSha as sha,verifySuccessorContentInventory,verifySuccessorCheckout,successorGitTree,verifySuccessorTrees} from './helpers/post-v100-reviewed-revisions';
const before=Buffer.from('a\nold\nz\n'),after=Buffer.from('a\nnew\nz\n'),unchanged=Buffer.from('same'),added=Buffer.from('addition');
function fixture(){const record={schema:'post-v100-successor-v1',state:'independently-reviewed',baselineTree:'1'.repeat(40),candidateContentTree:'2'.repeat(40),inventoryScope:{kind:'complete-git-content-snapshot-excluding-explicit-audit-bootstrap',excludedPaths:['tests/helpers/post-v100-successor.json','tests/helpers/post-v100-review-pin.ts']},changes:{'src/a.ts':{kind:'text',previousSha256:sha(before),currentSha256:sha(after),scope:'Synthetic fixture only',evidence:['synthetic unit fixture'],mode:'100644',previousMode:'100644',hunks:[{beforeStart:1,afterStart:1,removedLines:['old\n'],insertedLines:['new\n']}]}},additions:{'src/new.ts':{currentSha256:sha(added),scope:'Synthetic addition',evidence:['synthetic unit fixture'],mode:'100644'}},protectedFiles:{'src/same.ts':sha(unchanged)},protectedModes:{'src/same.ts':'100644'}};const text=JSON.stringify(record);return readPinnedSuccessor(text,sha(text));}
test('synthetic successor exactly reverses current bytes and binds incoming identity',()=>{const r=fixture();assert.deepEqual(restoreSuccessor(r,'src/a.ts',after),before);assert.equal(successorHash(r,'src/a.ts',sha(before)),sha(after));assert.deepEqual(restoreSuccessor(r,'src/same.ts',unchanged),unchanged);});
test('one-byte mutations, wrong incoming hashes, old bytes and path aliases are rejected',()=>{const r=fixture();for(const b of [Buffer.concat([after,Buffer.from(' ')]),before,Buffer.from('a\nNEW\nz\n')])assert.throws(()=>restoreSuccessor(r,'src/a.ts',b));for(const p of ['./src/a.ts','src//a.ts','src/a.ts/extra'])assert.throws(()=>restoreSuccessor(r,p,after));assert.throws(()=>successorHash(r,'src/a.ts',sha(after)));assert.throws(()=>restoreSuccessor(r,'src/new.ts',added));});
test('complete inventory rejects unknown additions, missing dependencies and mutated additions',()=>{const r=fixture(),files:Record<string,Buffer>={'src/a.ts':after,'src/new.ts':added,'src/same.ts':unchanged},paths=Object.keys(files);verifySuccessorContentInventory(r,paths,p=>files[p]);assert.throws(()=>verifySuccessorContentInventory(r,[...paths,'src/unknown.ts'],p=>files[p]));assert.throws(()=>verifySuccessorContentInventory(r,paths.slice(1),p=>files[p]));assert.throws(()=>verifySuccessorContentInventory(r,paths,p=>p==='src/new.ts'?Buffer.from('altered'):files[p]));});
test('unreviewed drafts and tampered manifests cannot be used as reviewed evidence',()=>{const r=fixture(),text=JSON.stringify(r);assert.throws(()=>readPinnedSuccessor(text+' ',sha(text)));assert.throws(()=>readPinnedSuccessor(text,'UNSIGNED'));const draft=JSON.stringify({...r,state:'DRAFT_REVIEW_REQUIRED'});assert.throws(()=>readPinnedSuccessor(draft,sha(draft)));});

test('final checkout explicitly accounts for both bootstrap files and rejects executable pin drift',()=>{
 const r=fixture(),text=JSON.stringify(r),pin=sha(text),files:Record<string,Buffer>={'src/a.ts':after,'src/new.ts':added,'src/same.ts':unchanged,'tests/helpers/post-v100-successor.json':Buffer.from(text),'tests/helpers/post-v100-review-pin.ts':Buffer.from(`export const POST_V100_REVIEW_SHA256 = '${pin}';\n`)};
 verifySuccessorCheckout(r,Object.keys(files),p=>files[p],pin);
 assert.throws(()=>verifySuccessorCheckout(r,Object.keys(files).filter(p=>!p.endsWith('review-pin.ts')),p=>files[p],pin));
 files['tests/helpers/post-v100-review-pin.ts']=Buffer.from(`export const POST_V100_REVIEW_SHA256 = '${pin}';\nconsole.log('unreviewed');\n`);
 assert.throws(()=>verifySuccessorCheckout(r,Object.keys(files),p=>files[p],pin));
});

test('complete historical and current trees reconstruct exact Git objects, including file modes',()=>{
 const r=fixture(),files:Record<string,Buffer>={'src/a.ts':after,'src/new.ts':added,'src/same.ts':unchanged};
 r.candidateContentTree=successorGitTree(Object.fromEntries(Object.entries(files).map(([p,bytes])=>[p,{bytes,mode:'100644'}])));
 r.baselineTree=successorGitTree({'src/a.ts':{bytes:before,mode:'100644'},'src/same.ts':{bytes:unchanged,mode:'100644'}});
 verifySuccessorTrees(r,p=>files[p]);
 r.baselineTree='0'.repeat(40);assert.throws(()=>verifySuccessorTrees(r,p=>files[p]));
});

test('required behavioral evidence survives review and cannot be omitted',()=>{
 const r=fixture();r.changes['src/a.ts'].behavioralEvidenceRequired=true;
 let text=JSON.stringify(r);assert.throws(()=>readPinnedSuccessor(text,sha(text)));
 r.changes['src/a.ts'].behavioralEvidence=['Synthetic current behavior evidence'];
 text=JSON.stringify(r);assert.deepEqual(readPinnedSuccessor(text,sha(text)).changes['src/a.ts'].behavioralEvidence,r.changes['src/a.ts'].behavioralEvidence);
});

test('portable closure names both bootstrap dependencies without self-hashing them',()=>{
 const r=fixture();r.portableClosures={airfield:{historicalManifestSha256:'0'.repeat(64),additions:['src/new.ts'],bootstrapDependencies:['tests/helpers/post-v100-successor.json','tests/helpers/post-v100-review-pin.ts'],scope:'Synthetic closure',evidence:['Synthetic evidence']}};
 let text=JSON.stringify(r);readPinnedSuccessor(text,sha(text));
 r.portableClosures.airfield.bootstrapDependencies=[];text=JSON.stringify(r);assert.throws(()=>readPinnedSuccessor(text,sha(text)),/bootstrap scope/);
});
