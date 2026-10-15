import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {compose,inventory} from '../scripts/compose-pages-snapshot.mjs';
import {validateConfig,verifyPublishedBaseline} from '../scripts/verify-pages-snapshot.mjs';
async function fixture(fn){const d=await mkdtemp(join(tmpdir(),'pages-snapshot-'));try{for(const p of ['baseline/dev','baseline/cover-preview','next'])await mkdir(join(d,p),{recursive:true});for(const [p,s] of Object.entries({'baseline/index.html':'stable','baseline/dev/index.html':'old dev','baseline/cover-preview/index.html':'old cover','next/index.html':'new preview'}))await writeFile(join(d,p),s);await fn(d);}finally{await rm(d,{recursive:true,force:true});}}
for(const target of ['dev','cover-preview'])test(`replaces only ${target} with exact other-tree preservation`,()=>fixture(async d=>{const before=await inventory(d+'/baseline');const r=await compose(d+'/baseline',d+'/next',d+'/out',target);assert.equal(r.preserved,true);assert.equal(r.preservedFiles,2);assert.equal(await readFile(d+'/out/'+target+'/index.html','utf8'),'new preview');assert.deepEqual((await inventory(d+'/out')).filter(f=>!f.path.startsWith(target+'/')),before.filter(f=>!f.path.startsWith(target+'/')));}));
test('reject unknown target, overlap, oversize and output reuse',()=>fixture(async d=>{await assert.rejects(compose(d+'/baseline',d+'/next',d+'/out','main'));await assert.rejects(compose(d+'/baseline',d+'/next',d+'/next/out','dev'),/overlap/);await assert.rejects(compose(d+'/baseline',d+'/next',d+'/out','dev',1),/exceeds/);await mkdir(d+'/out');await assert.rejects(compose(d+'/baseline',d+'/next',d+'/out','dev'));}));
test('reject symlinks and missing baseline trees',()=>fixture(async d=>{await symlink('../baseline/index.html',d+'/next/link');await assert.rejects(compose(d+'/baseline',d+'/next',d+'/out','dev'),/Symlink/);await rm(d+'/next/link');await rm(d+'/baseline/cover-preview',{recursive:true});await assert.rejects(compose(d+'/baseline',d+'/next',d+'/out','dev'),/Missing baseline/);}));
const sha='a'.repeat(40),current='b'.repeat(40);
const config={schemaVersion:1,repository:'JerryZRic/ai-friends-kart-playcanvas',target:'dev',sourceBranch:'dev',baseline:{runId:12,artifactId:13,deploymentId:14,commit:sha,branch:'feature/home-portraits-live2d',artifactDigest:'sha256:'+'c'.repeat(64)},expectedRefs:{main:sha,dev:'CURRENT','feature/home-portraits-live2d':sha}};
function responses(){return {'actions/runs/12':{status:'completed',conclusion:'success',head_sha:sha,head_branch:config.baseline.branch},'actions/artifacts/13':{name:'github-pages',expired:false,digest:config.baseline.artifactDigest,workflow_run:{id:12,head_sha:sha}},'deployments?environment=github-pages&per_page=100':[{id:14,sha}], 'deployments/14/statuses?per_page=100':[{state:'success',log_url:'https://github.com/x/y/actions/runs/12/job/1'}]};}
const api=d=>async p=>{assert.ok(p in d,p);return d[p];};
test('config constrains branch, root and exact refs',()=>{assert.equal(validateConfig(structuredClone(config)).target,'dev');for(const mutation of [c=>c.target='unknown',c=>c.expectedRefs.main='CURRENT',c=>c.sourceBranch='main']){const c=structuredClone(config);mutation(c);assert.throws(()=>validateConfig(c));}});
test('accepts exact completed successful run/artifact/deployment provenance',async()=>{await verifyPublishedBaseline(config,api(responses()),current);});
test('never treats failed/running runs or expired/wrong artifacts as baseline',async()=>{for(const mutation of [d=>d['actions/runs/12'].conclusion='failure',d=>d['actions/runs/12'].status='in_progress',d=>d['actions/artifacts/13'].expired=true,d=>d['actions/artifacts/13'].digest='other']){const d=responses();mutation(d);await assert.rejects(verifyPublishedBaseline(config,api(d),current));}});
test('refuses newer successful publication even when same commit is reused',async()=>{const d=responses();d['deployments?environment=github-pages&per_page=100'].unshift({id:15,sha});d['deployments/15/statuses?per_page=100']=[{state:'success',log_url:'https://github.com/x/y/actions/runs/99/job/1'}];await assert.rejects(verifyPublishedBaseline(config,api(d),current),/Latest successful/);});
test('ignores newer failed deployment, allows own pending, rejects other pending',async()=>{const d=responses();d['deployments?environment=github-pages&per_page=100'].unshift({id:15,sha:current});d['deployments/15/statuses?per_page=100']=[{state:'failure'}];await verifyPublishedBaseline(config,api(d),current);d['deployments/15/statuses?per_page=100']=[{state:'in_progress'}];await verifyPublishedBaseline(config,api(d),current);d['deployments?environment=github-pages&per_page=100'][0].sha='d'.repeat(40);await assert.rejects(verifyPublishedBaseline(config,api(d),current),/Another Pages/);});
test('refuses successful deployment with unrelated run provenance',async()=>{const d=responses();d['deployments/14/statuses?per_page=100'][0].log_url='https://github.com/x/y/actions/runs/99/job/1';await assert.rejects(verifyPublishedBaseline(config,api(d),current),/originate/);});

test('root replacement preserves both preview inventories and removes stale root files',()=>fixture(async d=>{
 await writeFile(d+'/baseline/stale.js','old root asset');
 await mkdir(d+'/baseline/dev/assets');await writeFile(d+'/baseline/dev/assets/game.js','exact dev bytes');
 await mkdir(d+'/baseline/cover-preview/assets');await writeFile(d+'/baseline/cover-preview/assets/cover.js','exact cover bytes');
 const before=await inventory(d+'/baseline'),peer=f=>f.path.startsWith('dev/')||f.path.startsWith('cover-preview/');
 const r=await compose(d+'/baseline',d+'/next',d+'/out','root');
 assert.equal(r.preservedFiles,4);assert.equal(await readFile(d+'/out/index.html','utf8'),'new preview');
 assert.deepEqual((await inventory(d+'/out')).filter(peer),before.filter(peer));
 await assert.rejects(readFile(d+'/out/stale.js'),{code:'ENOENT'});
}));
test('root refuses reserved preview entries, including empty directories and plain files',()=>fixture(async d=>{
 for(const name of ['dev','cover-preview']){
  await mkdir(d+'/next/'+name);await assert.rejects(compose(d+'/baseline',d+'/next',d+'/out','root'),/reserved preview/);await rm(d+'/next/'+name,{recursive:true});
  await writeFile(d+'/next/'+name,'collision');await assert.rejects(compose(d+'/baseline',d+'/next',d+'/out','root'),/reserved preview/);await rm(d+'/next/'+name);
 }
}));
test('root requires strictly less than the supported Pages size',()=>fixture(async d=>{
 const before=await inventory(d+'/baseline'),next=await inventory(d+'/next');
 const bytes=[...before.filter(f=>f.path.startsWith('dev/')||f.path.startsWith('cover-preview/')),...next].reduce((n,f)=>n+f.bytes,0);
 await assert.rejects(compose(d+'/baseline',d+'/next',d+'/out','root',bytes),/exceeds/);
 const r=await compose(d+'/baseline',d+'/next',d+'/out','root',bytes+1);assert.equal(r.totalBytes,bytes);
}));
test('root configuration requires main CURRENT and exact preview refs',()=>{
 const c=structuredClone(config);c.target='root';c.sourceBranch='main';c.expectedRefs.main='CURRENT';c.expectedRefs.dev=sha;
 assert.equal(validateConfig(c).target,'root');
 for(const mutation of [c=>c.sourceBranch='dev',c=>c.expectedRefs.dev='CURRENT',c=>c.expectedRefs.main=sha,c=>delete c.expectedRefs['feature/home-portraits-live2d']]){
  const bad=structuredClone(c);mutation(bad);assert.throws(()=>validateConfig(bad));
 }
});
