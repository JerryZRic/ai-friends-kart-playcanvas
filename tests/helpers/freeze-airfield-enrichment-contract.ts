/** One-time independent immutable-source freeze. Never loads a candidate or overwrites expectations. */
import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {airfieldSceneData} from './airfield-enrichment-scene';
import {airfieldBaselineContract,airfieldSha,airfieldDigest,AIRFIELD_ORIGINAL_SOURCE_SHA256} from './airfield-enrichment-contract';
import {landTexturePixels} from '../../src/land-scenery';
const path='tests/fixtures/airfield-enrichment-original-geometry.json';assert.ok(!existsSync(path),'Never replace historical baseline');
const base='fc5360139c00e0d60148afabd0d24ed85c272ed6',original=JSON.parse(readFileSync('tests/fixtures/airfield-enrichment-original-inventory.json','utf8'));
assert.equal(original.baselineCommit,base);
const before:Record<string,string>={};
for(const [file,hash]of Object.entries(original.sourceInventory))if(file.startsWith('src/')||file==='package-lock.json'){
 const current=airfieldSha(readFileSync(file));assert.equal(current,hash,file+' untouched current input before immutable freeze');assert.equal(airfieldSha(execFileSync('git',['show',base+':'+file],{maxBuffer:8*1024*1024})),hash,file+' independent immutable git bytes');before[file]=current;
}
const ledger=process.argv[2];assert.ok(ledger,'Explicit cleanup ledger required');const {geometry:g,theme}=await airfieldSceneData(true,ledger);
assert.deepEqual(g.budget,{batches:20,triangles:94747,vertices:103278});
const protection={...airfieldBaselineContract(g,theme),textures:airfieldDigest(Object.fromEntries((['stone','asphalt','wood','grass']as const).map(k=>[k,{width:64,height:64,pixels:[...landTexturePixels(k)]}])))};
for(const [file,hash]of Object.entries(before))assert.equal(airfieldSha(readFileSync(file)),hash,file+' source stable');
const record={schema:'airfield-enrichment-original-geometry-v1',baselineSourceCommit:base,sourceSha256:AIRFIELD_ORIGINAL_SOURCE_SHA256,sourceHashes:before,protection};writeFileSync(path,JSON.stringify(record)+'\n',{flag:'wx'});
writeFileSync('tests/fixtures/airfield-enrichment-original-assemblies.json',JSON.stringify(g.assemblies)+'\n',{flag:'wx'});
console.log(JSON.stringify({fixtureSha256:airfieldSha(readFileSync(path)),budget:g.budget,components:g.components.length,assemblies:g.assemblies.length,roadTriangles:g.roadFaces.length,terrainComponents:g.components.filter(c=>c.role==='terrain').map(c=>c.kind),assemblyFixtureSha256:airfieldSha(readFileSync('tests/fixtures/airfield-enrichment-original-assemblies.json')),textureSha256:protection.textures}));
