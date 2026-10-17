import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import snapshot from './v101a-route-snapshot/source-graph.json';

/** Exact v1.0.1a transitive source graph. No imports fall back to current src.
 * The original route observations describe this historical physics version;
 * current production is separately exercised by current-route-physics.test.ts. */
export async function historicalRoutePhysics(){
 assert.equal(createHash('sha256').update(readFileSync(new URL('./v101a-route-snapshot/source-graph.json',import.meta.url))).digest('hex'),'1c4879364a314a7b074d250d376bd96742213b2a3769bb8c9fecd683999593b8','immutable historical source graph');
 assert.equal(snapshot.commit,'33988b49dee01547238c08df4684cce93fae9497');
 const root=mkdtempSync(join(process.cwd(),'.historical-route-'));
 try {
  for(const [path,file] of Object.entries(snapshot.files)){
   const bytes=Buffer.from(file.content);
   assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),file.gitBlobSha,`${path}: immutable historical Git blob`);
   assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,`${path}: historical SHA-256`);
   const target=join(root,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes);
  }
  writeFileSync(join(root,'package.json'),'{"type":"module"}\n');
  symlinkSync(resolve('node_modules'),join(root,'node_modules'),'dir');
  const load=(path:string)=>import(pathToFileURL(join(root,path)).href);
  const {benchmarkForkDriving}=await load('tests/helpers/fork-driving-benchmark.ts');
  const {getNpcPresets}=await load('src/kart-presets.ts');
  const {raceKartBuild}=await load('src/kart-race.ts');
  return {benchmarkForkDriving,getNpcPresets,raceKartBuild,course:async(map:string)=>(await load(`src/maps/${map}.ts`))[`${map.toUpperCase()}_COURSE`],dispose:()=>rmSync(root,{recursive:true,force:true})};
 }catch(error){rmSync(root,{recursive:true,force:true});throw error;}
}
