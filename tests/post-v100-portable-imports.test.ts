import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,relative} from 'node:path';
import {postV100LocalDependencies} from './helpers/post-v100-current';
test('portable parser ignores quoted import examples but rejects a real missing dependency',()=>{
 const root=mkdtempSync(join(process.cwd(),'.portable-import-check-')),entry=relative(process.cwd(),join(root,'entry.ts')),dependency=relative(process.cwd(),join(root,'dependency.ts'));
 try{
  writeFileSync(entry,`const example = "import('./' + name)"; export {value} from './dependency';\n`);writeFileSync(dependency,'export const value = 1;\n');
  assert.deepEqual(postV100LocalDependencies([entry]),[dependency,entry].sort());
  writeFileSync(entry,`import './actually-missing';\n`);assert.throws(()=>postV100LocalDependencies([entry]),/missing literal dependency/);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('portable parser resolves bounded dynamic import patterns from the actual source directory',()=>{
 const root=mkdtempSync(join(process.cwd(),'.portable-dynamic-check-')),entry=relative(process.cwd(),join(root,'entry.ts'));
 try{mkdirSync(join(root,'maps'));writeFileSync(join(root,'maps','a.ts'),'export const value = 1;\n');writeFileSync(join(root,'maps','b.ts'),'export const value = 2;\n');writeFileSync(entry,'export const load = (name:string)=>import(`./maps/${name}.ts`);\n');
  assert.deepEqual(postV100LocalDependencies([entry]),[entry,relative(process.cwd(),join(root,'maps','a.ts')),relative(process.cwd(),join(root,'maps','b.ts'))].sort());
 }finally{rmSync(root,{recursive:true,force:true});}
});
