/** One-time, pre-edit freeze from the verified untouched source exporter output. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {calderaBaselineContract,calderaSha,CALDERA_ORIGINAL_SOURCE_SHA256} from './caldera-enrichment-contract';
const commit='70e66387b09c50a1ed8244048089cea2269e426e',input=process.argv[2],output=process.argv[3];assert.ok(input&&output);
const bytes=readFileSync(input),record=JSON.parse(bytes.toString());
for(const [file,sha]of Object.entries(record.sourceHashes)){assert.equal(calderaSha(execFileSync('git',['show',commit+':'+file],{maxBuffer:4*1024*1024})),sha,file+' exact immutable source');assert.equal(calderaSha(readFileSync(file)),sha,file+' remains untouched before freeze');}
assert.equal(record.sourceHashes['src/caldera-scenery.ts'],CALDERA_ORIGINAL_SOURCE_SHA256);assert.deepEqual(record.geometry.budget,{batches:21,triangles:95132,vertices:126320});assert.equal(record.geometry.components.length,2715);
const protection=calderaBaselineContract(record.geometry,record.theme);
for(const [i,b]of record.geometry.batches.entries())assert.equal(calderaSha(JSON.stringify(b.normals)),protection.batches[i].normals,'Exported normals equal independent calculation');
const fixture={schema:'caldera-enrichment-original-geometry-v1',baselineSourceCommit:commit,sourceSha256:CALDERA_ORIGINAL_SOURCE_SHA256,exportSha256:calderaSha(bytes),protection};
const text=JSON.stringify(fixture)+'\n';writeFileSync(output,text);console.log(JSON.stringify({fixtureSha256:calderaSha(text),exportSha256:fixture.exportSha256,budget:protection.budget,components:protection.components.length}));
