import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {inflateRawSync, gunzipSync} from 'node:zlib';
import {makeSourceArchive, sourceFiles, sourceLink} from '../scripts/package-dist.mjs';

const read = name => readFileSync(name);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const tests = [];
function test(name, fn) { fn(); tests.push(name); }

// Independently maintained publication boundaries: expanding these is a review.
const originalGLBs = {
  'arch.glb':'02d5846dff35d97535b979348a255aaaf7d38b0e1b971ca6a0428b4807d496ae',
  'kart.glb':'ba1b4f018004eeabf860922ad570c338c281a671c9af56cdc839592df7ae59a0',
  'palm.glb':'bce1b487f8f7e821bf361c4e4c0ae60dd0ed03eb16f783e85c74db7bf8c52b03',
  'rock.glb':'751119ac92b808fd4cf99cd4f639d2e17db832306a7fc8e59e1e61adcc9beb11',
};
const chassisHash='2eadfef0873bb96f62c5047d321bc3f1805a2b22a236b726684d5e17d9e42086';
const originalModels = {
  'models/kart.blend':'745f413157d2479233bdf3c9e51ce14cea47da2f1b23f0238d0f48f619817e8a',
  'models/props.blend':'9b0c0d933919d18abdf27d7ce75a2eb1fc12a007d9a7ff79529f3ced8f8e4a9d',
};
const authorizedRuntime = [
  {
    "id": "whale",
    "path": "dist/assets/drivers/whale-driver.glb.gz",
    "bytes": 7888160,
    "sha256": "1bb498c06caab6797756af42cc4a092e9f51dfe661fa97f13639e2e359ff5bc8",
    "decodedBytes": 13572628,
    "decodedSha256": "50610733ba5a4eb73b47bddb22c96fad2883e7c8f4e56cdd229f6d77318b8703"
  },
  {
    "id": "gemini",
    "path": "dist/assets/drivers/gemini-driver.glb.gz",
    "bytes": 9977393,
    "sha256": "74a8c3827f4168117b01af7288e24a662f01a18a72b04464cc0044e8815b7a0d",
    "decodedBytes": 16200556,
    "decodedSha256": "bf5519ce507441012124ae9b0dba542a9f11d434a7ea4da03cdca6ef5ccb11c3"
  },
  {
    "id": "gpt",
    "path": "dist/assets/drivers/gpt-driver.glb.gz",
    "bytes": 7716185,
    "sha256": "b89e0bf70b457785ee9e59887b552cd73143be05eee783d8aefafc1c8b0b5388",
    "decodedBytes": 13839372,
    "decodedSha256": "c6817f6f72f4ff58a801cd18e3deaef84003f7bbe6b88004bfb734b9da2f2efb"
  },
  {
    "id": "claude",
    "path": "dist/assets/drivers/claude-driver.glb.gz",
    "bytes": 7572632,
    "sha256": "0d60bb2a3da169fb5a2a7aee4573597bfe57966284b48a2169afcb039c2a0269",
    "decodedBytes": 11241728,
    "decodedSha256": "08ad20d0a29495f49d69c1bd7b9948e5a6ca56148ac41ec342e62c0640a9b523"
  },
  {
    "id": "grok",
    "path": "dist/assets/drivers/grok-driver.glb.gz",
    "bytes": 9013413,
    "sha256": "c0af0d6d75f1ce030f0af777a1b312db91ead5d5411eaf89304f1e461a9d5b7b",
    "decodedBytes": 14850864,
    "decodedSha256": "382f56fa39cb26e8a243ab0faa8a413062c2416e3fdbb775317ec2f84f400a2c"
  },
  {
    "id": "glm",
    "path": "dist/assets/drivers/glm-driver.glb.gz",
    "bytes": 9459423,
    "sha256": "0b690d9993b94d9797bab23ea7d63e313a6253b12008d44c7b8d9f4e67be67fe",
    "decodedBytes": 16631232,
    "decodedSha256": "ccbea7de68001e680de8e945b955392d28e958db4e02d3f549ecd6b905141e62"
  }
];
const allowedSource = new Set([
  '.gitignore','.github/workflows/pages.yml','package.json','package-lock.json','build.mjs',
  'LICENSE','NOTICE','THIRD-PARTY-NOTICES.txt','SOURCE.txt','MODEL-NOTICE.txt',
  'README.md','README.zh-CN.md','README.zh-TW.md','README.yue.md','README.ja.md','README.ko.md',
  'src/game.js','src/index.html','src/vehicle-controls.js','src/mouse-look.js',
  'src/driver-roster.js','src/animated-driver.js','src/local-driver-import.js','src/bundled-drivers.js',
  'models/kart.blend','models/props.blend','models/build_models.py','models/create_props.py','models/model_metadata.json',
  'dist/assets/kart.glb','dist/assets/palm.glb','dist/assets/rock.glb','dist/assets/arch.glb','dist/assets/kart-r12-chassis.glb',
  'tests/three-test.mjs','tests/gameplay.test.mjs','tests/vehicle-controls.test.mjs','tests/mouse-look.test.mjs','tests/dist.test.mjs',
  'tests/local-driver-import.test.mjs','tests/public-artifact.test.mjs','tests/helpers/synthetic-driver.mjs','tests/runtime-drivers.test.mjs','tests/bundled-drivers.test.mjs',
  'scripts/package-dist.mjs','scripts/fetch-runtime-models.mjs','scripts/verify-runtime-assets.mjs','models/export_original_chassis.py',
  'docs/runtime-models.json','docs/github-pages.md','docs/releases/v1.0.0.md','docs/releases/v1.0.0-original-source.json','docs/local-import.md',
]);
const generatedDist = new Set(['.nojekyll','LICENSE','NOTICE','SOURCE.txt','THIRD-PARTY-NOTICES.txt','game.js','index.html','source.html','source.zip',...Object.keys(originalGLBs).map(n=>`assets/${n}`),'assets/kart-r12-chassis.glb','MODEL-NOTICE.txt',...authorizedRuntime.map(asset=>asset.path.slice(5))]);
function inventory(directory, prefix='', skipDevelopment=false) {
  return readdirSync(directory).sort().flatMap(name=>{
    if (skipDevelopment && !prefix && ['node_modules','.git'].includes(name)) return [];
    const path=join(directory,name), relative=prefix+name, stat=lstatSync(path);
    assert.ok(!stat.isSymbolicLink(),`Unapproved published symbolic link: ${relative}`);
    return stat.isDirectory()?inventory(path,`${relative}/`):[relative];
  });
}
function safePath(name) {
  assert.ok(name && !name.startsWith('/') && !name.includes('\\') && !name.split('/').some(p=>['..','.'].includes(p)),`Unsafe archive path: ${name}`);
}
// Split sentinel strings so the scanner can safely inspect its own test source.
const sensitivePatterns = [
  new RegExp('lib'+'file_[A-Za-z0-9_-]{8,}','i'),
  new RegExp('sedi'+'ment://file_','i'),
  new RegExp('/work'+'space/scratch/','i'),
  new RegExp('https?://(?:www\\.)?github\\.com/[^/\\s]+/ai-friends-'+'kart(?:[/?#\\s"\']|$)','i'),
  /(?:ghp|github_pat)_[A-Za-z0-9_]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
function safeContent(path, bytes) {
  if(path.endsWith('.glb.gz'))bytes=gunzipSync(bytes,{maxOutputLength:32*1024*1024});
  for(const pattern of sensitivePatterns) assert.doesNotMatch(bytes.toString('utf8'),pattern,`Private content pattern in ${path}`);
}
function embeddedGLB(path, bytes) {
  assert.equal(bytes.toString('ascii',0,4),'glTF',path); assert.equal(bytes.readUInt32LE(4),2,path);
  assert.equal(bytes.readUInt32LE(8),bytes.length,path); assert.equal(bytes.readUInt32LE(16),0x4e4f534a,path);
  const doc=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)).trim());
  for(const value of [...(doc.buffers??[]),...(doc.images??[])]) assert.ok(!value.uri || value.uri.startsWith('data:'),`External asset dependency in ${path}`);
  return doc;
}

const distFiles=inventory('dist');
test('public worktree and dist are strictly allowlisted; no private asset directories',()=>{
  for(const file of inventory('.', '', true)) {
    assert.ok(allowedSource.has(file) || (file.startsWith('dist/') && generatedDist.has(file.slice(5))),`Unexpected public worktree file: ${file}`);
    safeContent(file,read(file));
  }
  assert.deepEqual(distFiles,[...generatedDist].sort(),'Distribution must contain exactly the approved runtime files');
  for(const asset of authorizedRuntime){const bytes=read(asset.path);assert.equal(bytes.length,asset.bytes);assert.equal(sha256(bytes),asset.sha256,`Unauthorized runtime model revision: ${asset.path}`);assert.equal(bytes[3],0,'Gzip filename/optional metadata must be absent');assert.equal(bytes.readUInt32LE(4),0,'Gzip timestamp must be deterministic');const decoded=gunzipSync(bytes);assert.equal(decoded.length,asset.decodedBytes);assert.equal(sha256(decoded),asset.decodedSha256);embeddedGLB(asset.path,decoded);}
  for(const file of Object.keys(originalGLBs)) assert.equal(sha256(read(`dist/assets/${file}`)),originalGLBs[file],`Original public asset changed: ${file}`);
  for(const file of distFiles.filter(p=>p.endsWith('.glb'))) embeddedGLB(file,read(`dist/${file}`));
  for(const [file,hash] of Object.entries(originalModels)) assert.equal(sha256(read(file)),hash,`Original editable model changed: ${file}`);
  assert.equal(sha256(read('dist/assets/kart-r12-chassis.glb')),chassisHash,'Reviewed original chassis changed');
  const chassis=embeddedGLB('original chassis',read('dist/assets/kart-r12-chassis.glb'));
  assert.equal((chassis.images??[]).length,0);assert.equal((chassis.skins??[]).length,0);assert.equal((chassis.animations??[]).length,0);
  assert.ok(chassis.nodes.some(n=>n.name==='SteeringPivot'));
  assert.ok(chassis.nodes.every(n=>/^(?:NeonKart_|Wheel_|SteeringPivot|R12KartChassis$)/.test(n.name)), 'Only original chassis parts may be bundled');
});
test('public model manifest names exactly the six sanitized runtime files with separate rights notice',()=>{
  const manifest=JSON.parse(read('docs/runtime-models.json').toString());
  assert.deepEqual(manifest.assets,authorizedRuntime.map(({id,path,bytes,sha256,decodedBytes,decodedSha256})=>({id,path:path.slice(5),bytes,sha256,decodedBytes,decodedSha256})));
  for(const entry of manifest.assets)assert.deepEqual(Object.keys(entry).sort(),['bytes','decodedBytes','decodedSha256','id','path','sha256']);
  for(const entry of authorizedRuntime){const json=embeddedGLB(entry.path,gunzipSync(read(entry.path)));const stack=[json];while(stack.length){const value=stack.pop();if(!value||typeof value!=='object')continue;if(value.extras)for(const key of ['source_library_id','source_blend','centerline_file'])assert.ok(!(key in value.extras),`Private authoring metadata in ${entry.id}`);stack.push(...Object.values(value).filter(child=>child&&typeof child==='object'));}}
  const notice=read('MODEL-NOTICE.txt').toString();assert.match(notice,/non.commercial/i);assert.match(notice,/AGPL/i);assert.deepEqual(read('dist/MODEL-NOTICE.txt'),read('MODEL-NOTICE.txt'));
  const instructions=read('SOURCE.txt').toString();assert.match(instructions,/fetch-runtime-models|models:fetch/);assert.match(instructions,/MODEL-NOTICE/);
});
test('owned local import path never uploads or persists selected models',()=>{
  for(const path of ['src/game.js','src/animated-driver.js','src/local-driver-import.js','src/driver-roster.js']) {
    const code=read(path).toString();
    assert.doesNotMatch(code,/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|CacheStorage|showSaveFilePicker)\b/,`Unexpected network or persistence API in ${path}`);
  }
  const importer=read('src/local-driver-import.js').toString();assert.ok(importer.includes('file.arrayBuffer()'));assert.ok(importer.includes('.parseAsync(buffer'));
  assert.ok(!/\b(?:upload|download)\s*\(/.test(importer));
});
test('standalone HTML, license/source links and all nested relative links resolve',()=>{
  const html=read('dist/index.html').toString(), source=read('dist/source.html').toString();
  assert.equal(html,read('src/index.html').toString().replace('</body>',`${sourceLink}</body>`));
  assert.equal((html.match(/id="source-license"/g)||[]).length,1);
  assert.ok(html.includes('src="game.js"')); assert.doesNotMatch(html,/<base\b/i);
  for(const file of ['LICENSE','NOTICE','THIRD-PARTY-NOTICES.txt','SOURCE.txt']) assert.deepEqual(read(`dist/${file}`),read(file));
  assert.equal(read('dist/.nojekyll').length,0);
  for(const prefix of ['/','/ai-friends-kart-web/','/preview/nested/game/']) {
    const base=`https://example.invalid${prefix}`;
    for(const page of [html,source]) for(const [,value] of page.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
      if(value.startsWith('data:') || value.startsWith('#')) continue;
      assert.ok(!/^(?:[a-z]+:|\/)/i.test(value),`Non-relative page dependency: ${value}`);
      const url=new URL(value,base); assert.ok(url.pathname.startsWith(prefix));
      const relative=decodeURIComponent(url.pathname.slice(prefix.length))||'index.html';
      assert.ok(distFiles.includes(relative),`Missing relative URL target: ${relative}`);
    }
    for(const asset of distFiles) assert.ok(new URL(asset,base).pathname.startsWith(prefix));
  }
});

const archive=read('dist/source.zip'), entries=new Map(),localEntries=[]; let cursor=0;
test('ZIP local members are safe, unique, allowlisted, complete and byte-current',()=>{
  while(cursor+4<=archive.length && archive.readUInt32LE(cursor)===0x04034b50) {
    const compressedSize=archive.readUInt32LE(cursor+18),size=archive.readUInt32LE(cursor+22);
    const nameSize=archive.readUInt16LE(cursor+26),extraSize=archive.readUInt16LE(cursor+28);
    const name=archive.toString('utf8',cursor+30,cursor+30+nameSize); safePath(name);
    const slash=name.indexOf('/'); assert.ok(slash>0); const relative=name.slice(slash+1); safePath(relative);
    assert.equal(archive.readUInt16LE(cursor+8),8); assert.ok(allowedSource.has(relative),`Unapproved source member: ${relative}`);
    assert.ok(sourceFiles.includes(relative),`Unexpected source member: ${relative}`); assert.ok(!entries.has(relative),`Duplicate source member: ${relative}`);
    const start=cursor+30+nameSize+extraSize; assert.ok(start+compressedSize<=archive.length);
    const bytes=inflateRawSync(archive.subarray(start,start+compressedSize)); assert.equal(bytes.length,size);
    assert.deepEqual(bytes,read(relative),`Source archive is stale: ${relative}`); safeContent(relative,bytes);
    entries.set(relative,bytes);localEntries.push({name,offset:cursor,compressedSize,size,crc:archive.readUInt32LE(cursor+14)}); cursor=start+compressedSize;
  }
  assert.equal(archive.readUInt32LE(cursor),0x02014b50);
  const centralStart=cursor;
  for(const local of localEntries){
    assert.equal(archive.readUInt32LE(cursor),0x02014b50);const nameSize=archive.readUInt16LE(cursor+28),extra=archive.readUInt16LE(cursor+30),comment=archive.readUInt16LE(cursor+32);
    assert.equal(archive.toString('utf8',cursor+46,cursor+46+nameSize),local.name);assert.equal(archive.readUInt32LE(cursor+42),local.offset);assert.equal(archive.readUInt32LE(cursor+20),local.compressedSize);assert.equal(archive.readUInt32LE(cursor+24),local.size);assert.equal(archive.readUInt32LE(cursor+16),local.crc);
    cursor+=46+nameSize+extra+comment;
  }
  assert.equal(archive.readUInt32LE(cursor),0x06054b50);assert.equal(archive.readUInt16LE(cursor+8),localEntries.length);assert.equal(archive.readUInt16LE(cursor+10),localEntries.length);assert.equal(archive.readUInt32LE(cursor+12),cursor-centralStart);assert.equal(archive.readUInt32LE(cursor+16),centralStart);assert.equal(cursor+22+archive.readUInt16LE(cursor+20),archive.length);
  assert.deepEqual([...entries.keys()],sourceFiles); assert.deepEqual(archive,makeSourceArchive());
  for(const asset of authorizedRuntime)assert.ok(!sourceFiles.includes(asset.path),'Restricted runtime models must not be duplicated into AGPL source.zip');
  assert.ok(sourceFiles.includes('docs/runtime-models.json'));
  assert.ok(sourceFiles.includes('src/local-driver-import.js')); assert.ok(sourceFiles.includes('tests/helpers/synthetic-driver.mjs'));
});
test('extracted source plus separately authorized runtime models rebuild each dist byte without network',()=>{
  const temporary=mkdtempSync(join(tmpdir(),'public-kart-source-'));
  try {
    for(const [path,bytes] of entries) {const target=join(temporary,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes);}
    symlinkSync(resolve('node_modules'),join(temporary,'node_modules'),'dir');
    // The open source builds independently; the separately licensed six models
    // can be restored by the supplied script. All HTTP is replaced by local test
    // bytes, including the second invocation's already-present-file checks.
    execFileSync(process.execPath,['build.mjs'],{cwd:temporary,stdio:'pipe'});
    for(const asset of authorizedRuntime)assert.ok(!existsSync(join(temporary,asset.path)));
    const harness = `
      import assert from 'node:assert/strict';
      import {readFileSync} from 'node:fs';
      import {join} from 'node:path';
      let calls=0;
      globalThis.fetch=async (url,options)=>{
        calls++;assert.equal(process.env.QA_EXPECT_DOWNLOADS,'6');
        const parsed=new URL(url);assert.equal(parsed.origin,'https://jerryzric.github.io');
        assert.match(parsed.pathname,/^\\/ai-friends-kart-web\\/assets\\/drivers\\/(whale|gemini|gpt|claude|grok|glm)-driver\\.glb\\.gz$/);
        assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);assert.equal(options.body,undefined);
        const bytes=readFileSync(join(process.env.QA_RUNTIME_ROOT,'assets/drivers',parsed.pathname.split('/').at(-1)));
        return {ok:true,status:200,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
      };
      await import('./scripts/fetch-runtime-models.mjs');assert.equal(calls,Number(process.env.QA_EXPECT_DOWNLOADS));
    `;
    for(const count of ['6','0'])execFileSync(process.execPath,['--input-type=module','-e',harness],{cwd:temporary,stdio:'pipe',env:{...process.env,QA_RUNTIME_ROOT:resolve('dist'),QA_EXPECT_DOWNLOADS:count}});
    for(const asset of authorizedRuntime)assert.deepEqual(readFileSync(join(temporary,asset.path)),read(asset.path));
    execFileSync(process.execPath,['build.mjs'],{cwd:temporary,stdio:'pipe'});
    const rebuilt=inventory(join(temporary,'dist'));
    assert.deepEqual(rebuilt,distFiles);
    for(const path of distFiles) assert.deepEqual(readFileSync(join(temporary,'dist',path)),read(`dist/${path}`),`Non-reproducible distribution: ${path}`);
  } finally {rmSync(temporary,{recursive:true,force:true});}
});
function checkHistoricalSourceArchive(bytes) {
  let position=0,total=0;const names=new Set();
  while(position+30<=bytes.length && bytes.readUInt32LE(position)===0x04034b50){
    const compressed=bytes.readUInt32LE(position+18),size=bytes.readUInt32LE(position+22),nameLength=bytes.readUInt16LE(position+26),extra=bytes.readUInt16LE(position+28);
    const name=bytes.toString('utf8',position+30,position+30+nameLength);safePath(name);const relative=name.slice(name.indexOf('/')+1);safePath(relative);assert.ok(allowedSource.has(relative),`Unapproved historical ZIP member: ${relative}`);assert.ok(!names.has(relative));names.add(relative);
    total+=size;assert.ok(total<64*1024*1024,'Unexpected historical source archive size');assert.equal(bytes.readUInt16LE(position+8),8);
    const start=position+30+nameLength+extra;assert.ok(start+compressed<=bytes.length);const raw=inflateRawSync(bytes.subarray(start,start+compressed),{maxOutputLength:64*1024*1024});assert.equal(raw.length,size);safeContent(relative,raw);
    if(relative==='dist/assets/kart-r12-chassis.glb')assert.equal(sha256(raw),chassisHash);
    if(originalModels[relative])assert.equal(sha256(raw),originalModels[relative]);
    if(relative.startsWith('dist/assets/')&&originalGLBs[relative.slice(12)])assert.equal(sha256(raw),originalGLBs[relative.slice(12)]);
    position=start+compressed;
  }
  assert.ok(names.size>0);assert.equal(bytes.readUInt32LE(position),0x02014b50);
}
const historicalPlaceholder={path:'dist/assets/drivers/ASSET-NOTICE.txt',gitBlobSha:'fc7fe8b2f76c08a9e8955c7a1b48d7d6361f7a9a'};
let gitCommits=0;
test('all reachable Git history, when present, contains only public allowlisted files',()=>{
  if(!existsSync('.git')) return;
  let commits;
  try {commits=execFileSync('git',['rev-list','--all'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);} catch(error) {throw new Error(`Unable to audit Git history: ${error.message}`);}
  gitCommits=commits.length;
  for(const commit of commits) {
    const rows=execFileSync('git',['ls-tree','-rz','--full-tree',commit],{encoding:'utf8'}).split('\0').filter(Boolean);
    for(const row of rows) {
      const [metadata,path]=row.split('\t'),[mode,type,oid]=metadata.split(' ');
      assert.equal(type,'blob');assert.notEqual(mode,'120000');const knownPlaceholder=path===historicalPlaceholder.path&&oid===historicalPlaceholder.gitBlobSha;assert.ok(knownPlaceholder||allowedSource.has(path)||(path.startsWith('dist/')&&generatedDist.has(path.slice(5))),`Unapproved historical path: ${path}`);
      const bytes=execFileSync('git',['cat-file','blob',oid],{maxBuffer:32*1024*1024}); safeContent(path,bytes);
      if(path==='dist/source.zip')checkHistoricalSourceArchive(bytes);
      const runtime=authorizedRuntime.find(asset=>asset.path===path);if(runtime){assert.equal(bytes.length,runtime.bytes);assert.equal(sha256(bytes),runtime.sha256,'Historical runtime model must match sanitized public revision');}
      if(path==='dist/assets/kart-r12-chassis.glb')assert.equal(sha256(bytes),chassisHash);
      if(originalModels[path]) assert.equal(sha256(bytes),originalModels[path],`Historical original model changed: ${path}`);
      if(path.startsWith('dist/assets/') && originalGLBs[path.slice(12)]) assert.equal(sha256(bytes),originalGLBs[path.slice(12)],`Historical asset changed: ${path}`);
    }
  }
});
console.log(JSON.stringify({status:'passed',suite:'public artifact and source safety',tests,sourceFiles:entries.size,distributionFiles:distFiles.length,gitCommits,note:'CPU/file checks only; no network server, browser, deployed-site or visual WebGL test. Rebuild uses already installed pinned dependencies plus the six separately licensed public gzip runtime models described in the manifest; these GLBs are intentionally absent from source.zip.'},null,2));
