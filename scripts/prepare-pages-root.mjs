// Pages-only, explicitly approved transformation. The full build/release is never edited.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cp,lstat,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inventory} from './compose-pages-snapshot.mjs';
import {validateConfig} from './verify-pages-snapshot.mjs';
const REPOSITORY='JerryZRic/ai-friends-kart-playcanvas';
const TAG='v1.1.0';
const RELEASE_URL=`https://github.com/${REPOSITORY}/releases/tag/${TAG}`;
const SOURCE_URL=`https://github.com/${REPOSITORY}/releases/download/${TAG}/source.zip`;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function redirectHtml(target,preserveLocation=false){
 assert.ok(target===SOURCE_URL||['./dev/balance-report.html','./dev/balance-lab.html'].includes(target),'Unexpected redirect destination');
 const destination=JSON.stringify(target);
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI Friends Kart · Moved</title><meta http-equiv="refresh" content="0;url=${escape(target)}"><script>const target=new URL(${destination},location.href);${preserveLocation?'target.search=location.search;target.hash=location.hash;':''}location.replace(target.href);</script></head><body><p>This resource has moved. <a href="${escape(target)}">Continue / 继续</a></p>${preserveLocation?'<p>Your query parameters and page anchor are preserved when JavaScript is available.</p>':'<p>Corresponding source is available as a ZIP from the public GitHub Release.</p>'}</body></html>\n`;
}
export function diagnosticsHtml(){return `<!doctype html><meta charset="utf-8"><title>${TAG} offline diagnostics</title><h1>${TAG} offline diagnostics / 离线诊断工具</h1><p>This hosted runtime omits offline diagnostic datasets. Download and extract the complete ${TAG} HTML package to use these tools. 诊断工具请下载并解压完整 HTML 包。</p><a href="https://github.com/${REPOSITORY}/releases/download/${TAG}/ai-friends-kart-playcanvas-${TAG}-html.zip">Download ${TAG} complete HTML</a>`;}
export function validateRootPublication(config,proof,currentSha,sourceRecord){
 validateConfig(config);assert.equal(config.target,'root');
 assert.deepEqual(config.rootPublication,{approved:true,mode:'release-source-and-offline-diagnostics',releaseTag:TAG,sourceAsset:'source.zip'},'Root migration needs explicit approval');
 assert.match(currentSha??'',/^[a-f0-9]{40}$/,'Missing exact source commit');
 assert.equal(proof.sourceCommit,currentSha,'Public release source commit differs from this build');
 assert.equal(proof.tag,TAG);assert.equal(proof.releaseUrl,RELEASE_URL);assert.equal(proof.sourceUrl,SOURCE_URL);
 assert.equal(proof.sourceSha256,sourceRecord.sha256,'Public corresponding source digest differs from this build');
 assert.equal(proof.sourceBytes,sourceRecord.bytes,'Public corresponding source size differs from this build');
 return proof;
}
export async function prepareRoot(fullBuild,baseline,output,config,proof,currentSha){
 [fullBuild,baseline,output]=[fullBuild,baseline,output].map(p=>resolve(p));
 assert.ok(![fullBuild,baseline].some(p=>p===output||p.startsWith(output+'/')||output.startsWith(p+'/')),'Output overlaps an input');
 await assert.rejects(lstat(output),{code:'ENOENT'});
 for(const dir of [fullBuild,baseline])assert.ok((await lstat(dir)).isDirectory(),'Input must be a real directory');
 const before=await inventory(fullBuild);
 for(const name of ['dev','cover-preview'])assert.ok(!(await readdir(fullBuild)).includes(name),'Full build contains reserved preview tree');
 for(const file of ['index.html','source.html','source.zip','balance-lab.html','balance-report.html','balance-results/summary.json'])assert.ok(before.some(f=>f.path===file),`Missing complete build file: ${file}`);

 const source=before.find(f=>f.path==='source.zip');validateRootPublication(config,proof,currentSha,source);
 const sourceHtml=await readFile(join(fullBuild,'source.html'),'utf8');
 assert.equal((sourceHtml.match(/href="source\.zip"/g)||[]).length,1,'Expected one corresponding-source link');
 await cp(fullBuild,output,{recursive:true,force:false,errorOnExist:true});
 await rm(join(output,'source.zip'));await rm(join(output,'balance-results'),{recursive:true});
 await mkdir(join(output,'source.zip'));
 await writeFile(join(output,'source.zip/index.html'),redirectHtml(SOURCE_URL));
 await writeFile(join(output,'source.html'),sourceHtml.replace('href="source.zip"',`href="${SOURCE_URL}"`).replace('</body>',`<p>Pages source download: <a href="${SOURCE_URL}">public GitHub Release ${TAG}</a>. Exact source commit: ${currentSha}. SHA-256: ${source.sha256}. The complete HTML download retains its local source ZIP and all diagnostic data.</p></body>`));
 for(const page of ['balance-lab.html','balance-report.html'])await writeFile(join(output,page),diagnosticsHtml());
 const after=await inventory(output);
 const unchanged=f=>!['source.zip','source.html','balance-lab.html','balance-report.html'].includes(f.path)&&!f.path.startsWith('balance-results/')&&!f.path.startsWith('source.zip/');
 assert.deepEqual(after.filter(unchanged),before.filter(unchanged),'Unexpected change to runtime or legal bytes');
 assert.deepEqual(await inventory(fullBuild),before,'Full HTML build changed during Pages preparation');
 const bytes=files=>files.reduce((n,f)=>n+f.bytes,0);
 return {sourceCommit:currentSha,releaseUrl:RELEASE_URL,sourceUrl:SOURCE_URL,sourceSha256:source.sha256,sourceBytes:source.bytes,fullBuildPreserved:true,fullBuildInventorySha256:hash(JSON.stringify(before)),fullBuildBytes:bytes(before),rootBytes:bytes(after),removedBytes:bytes(before)-bytes(after),files:after};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [fullBuild,baseline,output,proofFile]=process.argv.slice(2);
 assert.ok(proofFile,'Usage: prepare-pages-root full-build baseline-pages output public-release-proof.json');
 const config=JSON.parse(await readFile('docs/pages-snapshot.json','utf8')),proof=JSON.parse(await readFile(proofFile,'utf8'));
 const report=await prepareRoot(fullBuild,baseline,output,config,proof,process.env.GITHUB_SHA);
 await writeFile('pages-root-preparation-report.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({sourceCommit:report.sourceCommit,rootBytes:report.rootBytes,removedBytes:report.removedBytes,fullBuildPreserved:true,sourceSha256:report.sourceSha256}));
}
