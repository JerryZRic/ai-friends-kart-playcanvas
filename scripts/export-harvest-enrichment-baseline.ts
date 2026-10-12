/** Recreate the immutable original Harvest export without replacing active source.
 * NODE_OPTIONS=--max-old-space-size=448 node --import tsx scripts/export-harvest-enrichment-baseline.ts OUTPUT_DIR
 * Temporary modules use the original snapshot and the unchanged shared exporter.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),output=process.argv[2];
assert.ok(output,'Provide an explicit baseline output directory');
const frozen=JSON.parse(readFileSync(join(root,'docs/harvest-enrichment-cameras.json'),'utf8'));
const contract=frozen.baselineGeometryContract,sha=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const snapshot=readFileSync(join(root,contract.scenerySnapshot),'utf8');
assert.equal(sha(snapshot),contract.sourceHashes['src/harvest-scenery.ts'],'Archived Harvest source changed');
for(const [name,digest]of Object.entries({...contract.sourceHashes,...contract.additionalProtectedSourceHashes}))if(name!=='src/harvest-scenery.ts')assert.equal(sha(readFileSync(join(root,name))),digest,'Protected baseline input changed: '+name);
const temp=mkdtempSync(join(tmpdir(),'harvest-baseline-export-'));
try{
 const scenery=join(temp,'harvest-baseline.mts'),exporter=join(temp,'export-baseline.mts');
 const playcanvas=fileURLToPath(import.meta.resolve('playcanvas'));
 writeFileSync(scenery,snapshot.replace("from 'playcanvas'",'from '+JSON.stringify(playcanvas)).replace(/from '\.\//g,"from '"+join(root,'src')+'/'));
 let source=readFileSync(join(root,'scripts/export-harvest-preview.ts'),'utf8');
 source=source.replace("from 'playcanvas'",'from '+JSON.stringify(playcanvas)).replace("from '../src/harvest-scenery.ts'",'from '+JSON.stringify(scenery)).replace(/from '\.\.\/src\//g,"from '"+join(root,'src')+'/');
 const original="const sourceHashes=Object.fromEntries(files.map(path=>[path,hash(readFileSync(path))]));";
 assert.ok(source.includes(original),'Shared exporter hash declaration changed; review baseline adapter');
 source=source.replace(original,"const sourceHashes=Object.fromEntries(files.map(path=>[path,path==='src/harvest-scenery.ts'?"+JSON.stringify(sha(snapshot))+":hash(readFileSync(path))]));");
 const guard="if(hash(readFileSync(path))!==digest)throw new Error('Source changed during export: '+path);";
 assert.ok(source.includes(guard),'Shared exporter final source guard changed; review baseline adapter');
 source=source.replace(guard,"if(hash(readFileSync(path==='src/harvest-scenery.ts'?"+JSON.stringify(join(root,contract.scenerySnapshot))+":path))!==digest)throw new Error('Source changed during export: '+path);");
 writeFileSync(exporter,source);
 const result=spawnSync(process.execPath,['--import',join(root,'node_modules/tsx/dist/loader.mjs'),exporter,resolve(output)],{cwd:root,env:process.env,stdio:'inherit'});
 assert.equal(result.status,0,'Baseline export failed: '+String(result.error??result.signal));
 assert.equal(sha(readFileSync(join(resolve(output),'harvest-geometry.json'))),contract.geometryJsonSha256,'Baseline geometry export differs from frozen original');
 assert.equal(sha(readFileSync(join(resolve(output),'harvest-original-scene.glb'))),contract.glbSha256,'Baseline GLB differs from frozen original');
 console.log('Exact frozen Harvest baseline export verified');
}finally{rmSync(temp,{recursive:true,force:true});}
