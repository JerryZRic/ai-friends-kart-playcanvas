/** Exact complete 6bb9 source graph for historical enrichment recipe/protection audits.
 * No current source module is a fallback. Current physical/polish checks remain separate.
 */
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {postV100Review,postV100CurrentHash,restorePostV100Buffer} from './post-v100-current';
import {successorSha} from './post-v100-reviewed-revisions';
type Scene='airfield'|'snow'|'forest'|'harvest'|'workshop'|'town'|'quarry'|'caldera'|'garden';
export async function postV100HistoricalScene(scene:Scene,instrumented=false){
 const review=postV100Review(),root=mkdtempSync(join(process.cwd(),'.historical-post-v100-'));
 const env=scene.toUpperCase()+'_ENRICHMENT_INSTRUMENT_MANIFEST',previousManifest=process.env[env];
 try{
  const paths=Object.keys({...review.protectedFiles,...review.changes}).filter(p=>p.startsWith('src/')||['package.json','docs/runtime-models.json','docs/portrait-models.json'].includes(p));
  for(const p of paths){const bytes=restorePostV100Buffer(p,readFileSync(p)),target=join(root,p);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes);}
  symlinkSync(resolve('node_modules'),join(root,'node_modules'),'dir');
  const scenery=await import(pathToFileURL(join(root,`src/${scene}-scenery.ts`)).href),map=await import(pathToFileURL(join(root,`src/maps/${scene}.ts`)).href),cap=scene[0].toUpperCase()+scene.slice(1);
  const ordinary=scenery[`build${cap}SceneGeometry`](map[scene.toUpperCase()+'_COURSE']);let traced:any;
  if(instrumented){
   assert.ok(['forest','town','quarry'].includes(scene));
   for(const path of [`tests/helpers/${scene}-enrichment-provenance.ts`,'tests/helpers/instrumented-source-files.ts']){const bytes=readFileSync(path);assert.equal(successorSha(bytes),postV100CurrentHash(path),'Exact reviewed instrumentation helper');const target=join(root,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes);}
   // This graph owns its temporary entries and removes the whole private graph.
   // Do not emit a parent cleanup ledger pointing into a different source tree.
   delete process.env[env];
   const helper=await import(pathToFileURL(join(root,`tests/helpers/${scene}-enrichment-provenance.ts`)).href);traced=await helper[`instrument${cap}`]();
   assert.equal(successorSha(JSON.stringify(traced.geometry)),successorSha(JSON.stringify(ordinary)),'Historical instrumentation preserves every ordinary emitted buffer');
  }
  return {geometry:traced?.geometry??ordinary,ordinaryGeometrySha256:successorSha(JSON.stringify(ordinary)),theme:scenery[scene.toUpperCase()+'_SCENE_THEME'],instrumented:traced,executedSourceSha256:successorSha(readFileSync(join(root,`src/${scene}-scenery.ts`))),auditScope:'historical-6bb9-enrichment-core; current geometry/polish is covered by separate current physical and finite/road-clearance tests'};
 }finally{if(previousManifest===undefined)delete process.env[env];else process.env[env]=previousManifest;rmSync(root,{recursive:true,force:true});}
}
