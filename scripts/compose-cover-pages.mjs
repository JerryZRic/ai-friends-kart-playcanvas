// Add only /cover-preview/ to an exact prior successful Pages artifact.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
export async function inventory(root, prefix = '') {
  const files = [];
  for (const e of (await readdir(join(root, prefix), {withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
    assert.ok(!e.isSymbolicLink(), `Symlink forbidden: ${prefix}${e.name}`);
    const name = `${prefix}${e.name}`;
    if(e.isDirectory()) files.push(...await inventory(root, `${name}/`));
    else {
      assert.ok(e.isFile(), `Nonregular file: ${name}`);
      const bytes = await readFile(join(root,name));
      files.push({path:name, bytes:bytes.length, sha256:createHash('sha256').update(bytes).digest('hex')});
    }
  }
  return files.sort((a,b)=>a.path.localeCompare(b.path));
}
export async function compose(baseline, preview, output, maxBytes=1_000_000_000) {
  baseline=resolve(baseline); preview=resolve(preview); output=resolve(output);
  assert.ok(![baseline,preview].some(p=>output===p || output.startsWith(p+'/') || p.startsWith(output+'/')), 'Output overlaps input');
  await assert.rejects(lstat(output), {code:'ENOENT'});
  const before=await inventory(baseline);
  assert.ok(before.some(f=>f.path==='index.html') && before.some(f=>f.path==='dev/index.html'), 'Baseline must contain stable and dev');
  assert.ok(!before.some(f=>f.path.startsWith('cover-preview/')), 'Use a pinned baseline without previous preview');
  const cover=await inventory(preview);
  assert.ok(cover.some(f=>f.path==='index.html'), 'Missing preview entry');
  const bytes=[...before,...cover].reduce((n,f)=>n+f.bytes,0);
  assert.ok(bytes<=maxBytes, `Site ${bytes} bytes exceeds supported Pages size ${maxBytes}`);
  await cp(baseline,output,{recursive:true,force:false,errorOnExist:true});
  await cp(preview,join(output,'cover-preview'),{recursive:true,force:false,errorOnExist:true});
  const after=await inventory(output);
  assert.deepEqual(after.filter(f=>!f.path.startsWith('cover-preview/')), before, 'Stable root or dev bytes changed');
  assert.deepEqual(after.filter(f=>f.path.startsWith('cover-preview/')).map(f=>({...f,path:f.path.slice(14)})),cover);
  const report={sourceCommit:process.env.GITHUB_SHA??null,baselinePagesRun:38639517124,baselinePagesArtifact:11930010985,baselineFiles:before.length,coverFiles:cover.length,totalBytes:bytes,baselineInventorySha256:createHash('sha256').update(JSON.stringify(before)).digest('hex'),preservedRootAndDev:true,baselineFilesSha256:before,coverFilesSha256:cover};
  return report;
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const [baseline,preview,output]=process.argv.slice(2);
  assert.ok(baseline && preview && output, 'Usage: compose-cover-pages baseline preview output');
  const report=await compose(baseline,preview,output);
  await writeFile('cover-preservation-report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({baselineFiles:report.baselineFiles,coverFiles:report.coverFiles,totalBytes:report.totalBytes,preservedRootAndDev:report.preservedRootAndDev,baselineInventorySha256:report.baselineInventorySha256}));
}
