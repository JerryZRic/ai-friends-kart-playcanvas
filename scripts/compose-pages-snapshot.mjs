// Replace exactly one published tree; preserve every unrelated published byte.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cp,lstat,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function inventory(root,prefix=''){
 const files=[];
 for(const entry of (await readdir(join(root,prefix),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  const name=prefix+entry.name;
  assert.ok(!entry.isSymbolicLink(),`Symlink forbidden: ${name}`);
  if(entry.isDirectory())files.push(...await inventory(root,name+'/'));
  else{assert.ok(entry.isFile(),`Nonregular file: ${name}`);const bytes=await readFile(join(root,name));files.push({path:name,bytes:bytes.length,sha256:hash(bytes)});}
 }
 return files.sort((a,b)=>a.path.localeCompare(b.path));
}
export async function compose(baseline,replacement,output,target,maxBytes=1_000_000_000){
 assert.ok(['root','dev','cover-preview'].includes(target),'Unknown publication target');
 assert.ok(Number.isSafeInteger(maxBytes)&&maxBytes>0,'Invalid Pages byte limit');
 [baseline,replacement,output]=[baseline,replacement,output].map(p=>resolve(p));
 assert.ok(![baseline,replacement].some(p=>p===output||output.startsWith(p+'/')||p.startsWith(output+'/')),'Output overlaps input');
 await assert.rejects(lstat(output),{code:'ENOENT'});
 for(const directory of [baseline,replacement])assert.ok((await lstat(directory)).isDirectory(),'Input must be a real directory');
 const before=await inventory(baseline),next=await inventory(replacement),prefix=target+'/';
 const preserved=target==='root'?file=>file.path.startsWith('dev/')||file.path.startsWith('cover-preview/'):file=>!file.path.startsWith(prefix);
 if(target==='root'){
  const names=await readdir(replacement);
  for(const name of ['dev','cover-preview'])assert.ok(!names.includes(name),`Root replacement contains reserved preview tree: ${name}`);
 }
 for(const required of ['index.html','dev/index.html','cover-preview/index.html'])assert.ok(before.some(f=>f.path===required),`Missing baseline entry: ${required}`);
 assert.ok(next.some(f=>f.path==='index.html'),'Missing replacement entry');
 const unchanged=before.filter(preserved);
 const bytes=[...unchanged,...next].reduce((n,f)=>n+f.bytes,0);
 assert.ok(bytes<maxBytes,`Site ${bytes} exceeds supported Pages size ${maxBytes}`);
 if(target==='root'){
  await cp(replacement,output,{recursive:true,force:false,errorOnExist:true});
  for(const peer of ['dev','cover-preview'])await cp(join(baseline,peer),join(output,peer),{recursive:true,force:false,errorOnExist:true});
 }else{
  await cp(baseline,output,{recursive:true,force:false,errorOnExist:true});
  await rm(join(output,target),{recursive:true,force:true});
  await cp(replacement,join(output,target),{recursive:true,force:false,errorOnExist:true});
 }
 const after=await inventory(output);
 assert.deepEqual(after.filter(preserved),unchanged,'Untouched publication bytes changed');
 assert.deepEqual(after.filter(f=>!preserved(f)).map(f=>({...f,path:target==='root'?f.path:f.path.slice(prefix.length)})),next,'Replacement differs from build');
 return {sourceCommit:process.env.GITHUB_SHA??null,target,totalBytes:bytes,preservedFiles:unchanged.length,preservedInventorySha256:hash(JSON.stringify(unchanged)),preserved:true,filesBefore:before,filesAfter:after};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [baseline,replacement,output,target]=process.argv.slice(2);assert.ok(target,'Usage: compose-pages-snapshot baseline replacement output target');
 const result=await compose(baseline,replacement,output,target);
 await writeFile('pages-preservation-report.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({sourceCommit:result.sourceCommit,target,preservedFiles:result.preservedFiles,preservedInventorySha256:result.preservedInventorySha256,totalBytes:result.totalBytes,preserved:true}));
}
