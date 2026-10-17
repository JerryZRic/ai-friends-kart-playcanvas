import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {join,dirname,resolve,posix} from 'node:path';
import {pathToFileURL} from 'node:url';
import snapshot from './v101a-npc-snapshot/source-graph.json';

export const HISTORICAL_NPC_COMMIT='33988b49dee01547238c08df4684cce93fae9497';
/** Complete historical first-party import closure, including type-only imports.
 * Every embedded byte is checked against its original Git blob; imports never
 * fall back to the current src tree. Current NPC behavior has separate live tests. */
export async function historicalNpcPhysics(){
 assert.equal(createHash('sha256').update(readFileSync(new URL('./v101a-npc-snapshot/source-graph.json',import.meta.url))).digest('hex'),'076a11f4d2d8b5a69afc021541eef588e7cd91e7ef8fca6dd1b07db9dc932c12','immutable historical NPC source graph');
 assert.equal(snapshot.commit,HISTORICAL_NPC_COMMIT);
 const files:Record<string,{content:string;gitBlobSha:string;sha256:string}>=snapshot.files;
 for(const [path,file]of Object.entries(files)){
  const bytes=Buffer.from(file.content);
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),file.gitBlobSha,`${path}: original historical Git blob`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,`${path}: original historical SHA-256`);
  for(const match of file.content.matchAll(/(?:from\s*|import\s*\(?\s*)['"](\.[^'"]+)['"]/g)){
   const base=posix.normalize(posix.join(posix.dirname(path),match[1]));
   assert.ok([base,base+'.ts',base+'.js',base+'.json',base+'/index.ts'].some(candidate=>Object.hasOwn(files,candidate)),`${path}: complete historical dependency ${match[1]}`);
  }
 }
 const root=mkdtempSync(join(process.cwd(),'.historical-npc-'));
 try{
  for(const [path,file]of Object.entries(files)){
   const target=join(root,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,file.content);
  }
  writeFileSync(join(root,'package.json'),'{"type":"module"}\n');
  symlinkSync(resolve('node_modules'),join(root,'node_modules'),'dir');
  const load=(path:string)=>import(pathToFileURL(join(root,path)).href);
  const {runForkNpc}=await load('tests/helpers/fork-npc-benchmark.ts');
  return {runForkNpc,course:async(map:'airfield'|'caldera'|'garden')=>(await load(`src/maps/${map}.ts`))[`${map.toUpperCase()}_COURSE`],dispose:()=>rmSync(root,{recursive:true,force:true})};
 }catch(error){rmSync(root,{recursive:true,force:true});throw error;}
}
