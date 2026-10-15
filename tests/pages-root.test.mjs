import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,rm,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {prepareRoot,redirectHtml,validateRootPublication} from '../scripts/prepare-pages-root.mjs';
import {inventory} from '../scripts/compose-pages-snapshot.mjs';
const current='b'.repeat(40),old='a'.repeat(40),source=Buffer.from('exact corresponding source ZIP fixture');
const sourceRecord={bytes:source.length,sha256:createHash('sha256').update(source).digest('hex')};
const config={schemaVersion:1,repository:'JerryZRic/ai-friends-kart-playcanvas',target:'root',sourceBranch:'main',baseline:{runId:12,artifactId:13,deploymentId:14,commit:old,branch:'dev',artifactDigest:'sha256:'+'c'.repeat(64)},expectedRefs:{main:'CURRENT',dev:old,'feature/home-portraits-live2d':old},rootPublication:{approved:true,mode:'release-source-and-dev-diagnostics',releaseTag:'v1.0.2a',sourceAsset:'source.zip'}};
const proof={sourceCommit:current,tag:'v1.0.2a',releaseUrl:'https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v1.0.2a',sourceUrl:'https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.0.2a/source.zip',sourceSha256:sourceRecord.sha256,sourceBytes:sourceRecord.bytes};
async function fixture(fn){
 const dir=await mkdtemp(join(tmpdir(),'pages-root-'));
 try{
  const files={'dist/index.html':'game runtime','dist/source.html':'<html><body><a href="source.zip" download>Source</a></body></html>','dist/source.zip':source,'dist/assets/game.js':'compiled runtime bytes','dist/assets/music/LICENSE.txt':'separate music notice','dist/LICENSE':'unchanged legal notice','dist/SOURCE.txt':'unchanged build instructions','dist/balance-lab.html':'original lab','dist/balance-report.html':'original report','dist/balance-results/summary.json':'{"original":true}','dist/balance-results/large.json':'large diagnostics','baseline/index.html':'old main','baseline/dev/index.html':'old dev','baseline/cover-preview/index.html':'old cover','baseline/dev/balance-lab.html':'preserved lab','baseline/dev/balance-report.html':'preserved report','baseline/dev/balance-results/summary.json':'{"preserved":true}','baseline/dev/balance-results/artifact-index.json':'{}'};
  for(const [path,bytes] of Object.entries(files)){await mkdir(join(dir,path,'..'),{recursive:true});await writeFile(join(dir,path),bytes);}
  await fn(dir);
 }finally{await rm(dir,{recursive:true,force:true});}
}
test('approved Pages transformation keeps full build, legal/runtime bytes and diagnostics baseline intact',()=>fixture(async d=>{
 const full=await inventory(d+'/dist'),baseline=await inventory(d+'/baseline');
 const result=await prepareRoot(d+'/dist',d+'/baseline',d+'/root',config,proof,current);
 assert.equal(result.fullBuildPreserved,true);assert.equal(result.sourceSha256,sourceRecord.sha256);
 assert.deepEqual(await inventory(d+'/dist'),full);assert.deepEqual(await inventory(d+'/baseline'),baseline);
 assert.equal(await readFile(d+'/root/assets/game.js','utf8'),'compiled runtime bytes');
 assert.equal(await readFile(d+'/root/LICENSE','utf8'),'unchanged legal notice');
 assert.equal((await lstat(d+'/root/source.zip')).isDirectory(),true);
 await assert.rejects(lstat(d+'/root/balance-results'),{code:'ENOENT'});
 assert.ok((await readFile(d+'/root/source.html','utf8')).includes(`href="${proof.sourceUrl}"`));
 assert.ok((await readFile(d+'/root/source.zip/index.html','utf8')).includes(proof.sourceUrl));
 for(const page of ['balance-lab.html','balance-report.html'])assert.ok((await readFile(d+'/root/'+page,'utf8')).includes('./dev/'+page));
}));
test('migration rejects missing approval, wrong release, stale commit and mismatched corresponding source',()=>{
 for(const mutation of [c=>c.rootPublication.approved=false,c=>delete c.rootPublication,c=>c.target='dev']){const c=structuredClone(config);mutation(c);assert.throws(()=>validateRootPublication(c,proof,current,sourceRecord));}
 for(const mutation of [p=>p.sourceCommit=old,p=>p.tag='v1.0.2',p=>p.sourceUrl='https://example.com/source.zip',p=>p.releaseUrl='https://example.com/release',p=>p.sourceSha256='d'.repeat(64),p=>p.sourceBytes++]){const p=structuredClone(proof);mutation(p);assert.throws(()=>validateRootPublication(config,p,current,sourceRecord));}
});
test('migration rejects overlapping/reused output and missing diagnostic redirect targets',()=>fixture(async d=>{
 await assert.rejects(prepareRoot(d+'/dist',d+'/baseline',d+'/dist/root',config,proof,current),/overlap/);
 await mkdir(d+'/root');await assert.rejects(prepareRoot(d+'/dist',d+'/baseline',d+'/root',config,proof,current));await rm(d+'/root',{recursive:true});
 await rm(d+'/baseline/dev/balance-results/summary.json');await assert.rejects(prepareRoot(d+'/dist',d+'/baseline',d+'/root',config,proof,current));
 await assert.rejects(lstat(d+'/root'),{code:'ENOENT'});
}));
test('diagnostic redirects preserve query and fragment at nested project URLs',()=>{
 for(const page of ['balance-lab.html','balance-report.html']){
  const html=redirectHtml('./dev/'+page,true),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];let redirected;
  const location={href:`https://jerryzric.github.io/ai-friends-kart-playcanvas/${page}?map=coast&mode=cpu#results`,search:'?map=coast&mode=cpu',hash:'#results',replace:url=>redirected=url};
  vm.runInNewContext(script,{URL,location});assert.equal(redirected,`https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/${page}?map=coast&mode=cpu#results`);
 }
});
test('legacy source URL redirects directly to the pinned public ZIP without forwarding visitor parameters',()=>{
 const script=redirectHtml(proof.sourceUrl).match(/<script>([\s\S]*?)<\/script>/)[1];let redirected;
 vm.runInNewContext(script,{URL,location:{href:'https://example.com/project/source.zip/?private=value#anchor',search:'?private=value',hash:'#anchor',replace:url=>redirected=url}});
 assert.equal(redirected,proof.sourceUrl);assert.throws(()=>redirectHtml('https://example.com/evil'),/Unexpected/);
});
test('main workflow builds release identity, publishes after public source, and never rewrites previews',async()=>{
 const w=await readFile(new URL('../.github/workflows/pages-stable.yml',import.meta.url),'utf8');
 assert.match(w,/GAME_BUILD_CHANNEL: release/);assert.match(w,/DEV_BUILD_SHA: \$\{\{ github\.sha \}\}/);
 assert.match(w,/compose-pages-snapshot\.mjs baseline-pages dist-root dist-pages root/);
 assert.ok(w.indexOf('wait-public --source-file dist/source.zip')<w.indexOf('prepare-pages-root.mjs'));
 assert.ok(w.lastIndexOf('check-public')<w.indexOf('uses: actions/deploy-pages@'));
 assert.match(w,/EXPECTED_SOURCE_SHA256:/);assert.match(w,/EXPECTED_SOURCE_BYTES:/);
 assert.match(w,/group: github-pages/);assert.match(w,/name: github-pages/);
 assert.doesNotMatch(w,/npm test|npm run test:dist|test-targeted|mkdir dist-pages\/dev|cp.*dist-pages\/dev|windows-latest/);
});
