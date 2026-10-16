/** Strict successor primitives. No current candidate has been approved here.
 * Callers must supply an independently reviewed manifest and immutable pin.
 * This module is deliberately NOT wired into any historical adapter yet.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const SUCCESSOR_BOOTSTRAP_PATHS=['tests/helpers/post-v100-successor.json','tests/helpers/post-v100-review-pin.ts'] as const;
export const successorSha=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
type Hunk={beforeStart:number;afterStart:number;removedLines:string[];insertedLines:string[]};
type Addition={currentSha256:string;scope:string;evidence:string[];mode:string;behavioralEvidenceRequired?:boolean;behavioralEvidence?:string[]};
type Change=Addition&{previousSha256:string;previousMode:string;kind:'text'|'binary';hunks?:Hunk[];historicalBytesBase64?:string};
export type Successor={portableClosures?:Record<string,{historicalManifestSha256:string;additions:string[];bootstrapDependencies:string[];scope:string;evidence:string[]}>;schema:string;state:string;baselineTree:string;candidateContentTree:string;inventoryScope:{kind:string;excludedPaths:string[]};changes:Record<string,Change>;additions:Record<string,Addition>;protectedFiles:Record<string,string>;protectedModes:Record<string,string>};
const validPath=(p:string)=>!!p&&!p.startsWith('/')&&!p.split('/').some(x=>!x||x==='.'||x==='..');
export function readPinnedSuccessor(text:string,expectedSha:string):Successor {
 assert.match(expectedSha,/^[a-f0-9]{64}$/,'An independently reviewed immutable pin is required');
 assert.equal(successorSha(text),expectedSha,'Exact reviewed successor record');
 const r=JSON.parse(text) as Successor;
 assert.equal(r.schema,'post-v100-successor-v1');assert.equal(r.state,'independently-reviewed');
 for(const hash of [r.baselineTree,r.candidateContentTree])assert.match(hash,/^[a-f0-9]{40}$/);
 assert.deepEqual(r.inventoryScope,{kind:'complete-git-content-snapshot-excluding-explicit-audit-bootstrap',excludedPaths:[...SUCCESSOR_BOOTSTRAP_PATHS]},'Explicit non-circular audit bootstrap scope');
 const paths=[...Object.keys(r.changes),...Object.keys(r.additions),...Object.keys(r.protectedFiles)];
 assert.equal(new Set(paths).size,paths.length,'Disjoint full inventory');
 for(const p of paths){assert.ok(validPath(p),'Canonical exact path: '+p);assert.ok(!(SUCCESSOR_BOOTSTRAP_PATHS as readonly string[]).includes(p),'Bootstrap must not hash itself');}
 assert.deepEqual(Object.keys(r.protectedModes).sort(),Object.keys(r.protectedFiles).sort(),'Complete protected mode inventory');
 for(const [p,h]of Object.entries(r.protectedFiles)){assert.match(h,/^[a-f0-9]{64}$/,p);assert.ok(['100644','100755'].includes(r.protectedModes[p]));}
 for(const [p,row]of [...Object.entries(r.changes),...Object.entries(r.additions)]){
  assert.match(row.currentSha256,/^[a-f0-9]{64}$/,p);assert.ok(row.scope);assert.ok(Array.isArray(row.evidence)&&row.evidence.length);
  assert.ok(['100644','100755'].includes(row.mode));
  if(row.behavioralEvidenceRequired!==undefined)assert.equal(typeof row.behavioralEvidenceRequired,'boolean');
  if(row.behavioralEvidence!==undefined)assert.ok(Array.isArray(row.behavioralEvidence)&&row.behavioralEvidence.every(item=>typeof item==='string'&&item.trim().length>0),'Explicit behavioral evidence references');
  if(row.behavioralEvidenceRequired)assert.ok(row.behavioralEvidence?.length,p+' required behavioral evidence retained');
  assert.ok(!p.startsWith('tests/fixtures/')&&!p.startsWith('docs/scene-baselines/')&&!(p.startsWith('tests/helpers/')&&p.endsWith('-transition.json')),'Historical evidence remains frozen');
 }
 for(const [p,row]of Object.entries(r.changes)){
  assert.match(row.previousSha256,/^[a-f0-9]{64}$/,p);assert.notEqual(row.previousSha256,row.currentSha256,p+' real byte transition required');assert.equal(row.previousMode,row.mode,'Mode changes need separate review protocol');
  if(row.kind==='text'){
   assert.ok(row.hunks?.length);let beforeEnd=0,afterEnd=0,delta=0;
   for(const h of row.hunks!){
    assert.ok(Number.isSafeInteger(h.beforeStart)&&h.beforeStart>=beforeEnd);assert.ok(Number.isSafeInteger(h.afterStart)&&h.afterStart>=afterEnd);
    assert.equal(h.afterStart,h.beforeStart+delta);assert.ok(h.removedLines.length||h.insertedLines.length);
    assert.ok([...h.removedLines,...h.insertedLines].every(x=>typeof x==='string'));
    beforeEnd=h.beforeStart+h.removedLines.length;afterEnd=h.afterStart+h.insertedLines.length;delta+=h.insertedLines.length-h.removedLines.length;
   }
  }else{assert.equal(row.kind,'binary');assert.equal(successorSha(Buffer.from(row.historicalBytesBase64!,'base64')),row.previousSha256,p+' independently preserved binary baseline');}
 }
 for(const [scene,c]of Object.entries(r.portableClosures??{})){assert.deepEqual(c.bootstrapDependencies,[...SUCCESSOR_BOOTSTRAP_PATHS],'Explicit portable bootstrap scope');assert.ok(['airfield','garden'].includes(scene));assert.match(c.historicalManifestSha256,/^[a-f0-9]{64}$/);assert.ok(c.scope&&Array.isArray(c.evidence)&&c.evidence.length);assert.ok(c.additions.every(p=>validPath(p)&&(Object.hasOwn(r.changes,p)||Object.hasOwn(r.additions,p)||Object.hasOwn(r.protectedFiles,p))));}
 return r;
}
export function successorHash(r:Successor,path:string,incoming:unknown){
 assert.ok(validPath(path),'Canonical exact path');
 const row=r.changes[path];
 if(row){assert.equal(incoming,row.previousSha256,path+' exact incoming successor identity');return row.currentSha256;}
 assert.ok(Object.hasOwn(r.protectedFiles,path),path+' known baseline path');
 assert.equal(incoming,r.protectedFiles[path],path+' exact protected incoming identity');return incoming;
}
export function restoreSuccessor(r:Successor,path:string,current:Buffer):Buffer{
 assert.ok(validPath(path),'Canonical exact path');
 const row=r.changes[path];
 if(!row){assert.ok(Object.hasOwn(r.protectedFiles,path),path+' known historical path');assert.equal(successorSha(current),r.protectedFiles[path],path+' protected bytes');return current;}
 assert.equal(successorSha(current),row.currentSha256,path+' exact reviewed current bytes');
 if(row.kind==='binary'){const prior=Buffer.from(row.historicalBytesBase64!,'base64');assert.equal(successorSha(prior),row.previousSha256,path+' exact preserved baseline bytes');return prior;}
 const lines=current.toString('utf8').match(/[^\n]*\n|[^\n]+$/g)??[];
 for(const h of [...row.hunks!].reverse()){
  assert.deepEqual(lines.slice(h.afterStart,h.afterStart+h.insertedLines.length),h.insertedLines,path+' exact inserted hunk');
  lines.splice(h.afterStart,h.insertedLines.length,...h.removedLines);
 }
 const prior=Buffer.from(lines.join(''));assert.equal(successorSha(prior),row.previousSha256,path+' complete historical bytes');return prior;
}
export function verifySuccessorContentInventory(r:Successor,paths:string[],read:(path:string)=>Buffer){
 const expected=[...Object.keys(r.changes),...Object.keys(r.additions),...Object.keys(r.protectedFiles)].sort();
 assert.deepEqual([...paths].sort(),expected,'Complete exact candidate inventory, no unreviewed additions or missing dependencies');
 for(const p of expected){const hash=r.changes[p]?.currentSha256??r.additions[p]?.currentSha256??r.protectedFiles[p];assert.equal(successorSha(read(p)),hash,p+' exact candidate bytes');}
}

/** The source tree is complete except for these TWO explicitly scoped trust-root
 * files. The final Git commit/CI identity binds the complete package externally.
 * Never claim candidateContentTree is the final tree containing its own pin.
 */
export function verifySuccessorCheckout(r:Successor,paths:string[],read:(path:string)=>Buffer,expectedSha:string){
 const bootstrap:string[]=[...SUCCESSOR_BOOTSTRAP_PATHS];
 assert.ok(bootstrap.every(p=>paths.includes(p)),'Both explicit audit bootstrap files exist');
 const text=read(bootstrap[0]).toString('utf8');assert.equal(successorSha(text),expectedSha,'Exact bootstrap manifest');
 assert.deepEqual(readPinnedSuccessor(text,expectedSha),r,'Checkout manifest is the reviewed record in use');
 assert.equal(read(bootstrap[1]).toString('utf8'),`export const POST_V100_REVIEW_SHA256 = '${expectedSha}';\n`,'Canonical data-only bootstrap pin; no unrecorded code');
 verifySuccessorContentInventory(r,paths.filter(p=>!bootstrap.includes(p)),read);
}

export function successorGitTree(files:Record<string,{bytes:Buffer;mode:string}>){
 type Tree={ [key:string]:Tree|{digest:Buffer;mode:string} };const root:Tree={};
 const object=(kind:string,bytes:Buffer)=>createHash('sha1').update(kind+' '+bytes.length+'\0').update(bytes).digest();
 for(const [path,row]of Object.entries(files)){
  assert.ok(validPath(path));const parts=path.split('/');let dir=root;
  for(const name of parts.slice(0,-1))dir=(dir[name]??={}) as Tree;
  dir[parts.at(-1)!]={digest:object('blob',row.bytes),mode:row.mode};
 }
 const isBlob=(value:Tree|{digest:Buffer;mode:string}):value is {digest:Buffer;mode:string}=>Buffer.isBuffer(value.digest);
 const encode=(tree:Tree):Buffer=>object('tree',Buffer.concat(Object.entries(tree).sort(([a,x],[b,y])=>Buffer.compare(Buffer.from(a+(isBlob(x)?'':'/')),Buffer.from(b+(isBlob(y)?'':'/')))).map(([name,value])=>Buffer.concat([Buffer.from((isBlob(value)?value.mode:'40000')+' '+name+'\0'),isBlob(value)?value.digest:encode(value)]))));
 return encode(root).toString('hex');
}
export function verifySuccessorTrees(r:Successor,read:(path:string)=>Buffer){
 const current:Record<string,{bytes:Buffer;mode:string}>={},previous:Record<string,{bytes:Buffer;mode:string}>={};
 for(const p of [...Object.keys(r.protectedFiles),...Object.keys(r.changes),...Object.keys(r.additions)]){
  const bytes=read(p),row=r.changes[p],addition=r.additions[p],mode=row?.mode??addition?.mode??r.protectedModes[p];
  assert.equal(successorSha(bytes),row?.currentSha256??addition?.currentSha256??r.protectedFiles[p],p+' exact content snapshot');
  current[p]={bytes,mode};if(!addition)previous[p]={bytes:restoreSuccessor(r,p,bytes),mode:row?.previousMode??mode};
 }
 assert.equal(successorGitTree(current),r.candidateContentTree,'Complete content snapshot tree excluding explicit bootstrap');
 assert.equal(successorGitTree(previous),r.baselineTree,'Complete exact independently fixed historical endpoint tree');
}
