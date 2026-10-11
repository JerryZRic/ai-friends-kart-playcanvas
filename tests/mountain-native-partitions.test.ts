import test from 'node:test';
import assert from 'node:assert/strict';
import {MOUNTAIN_TRACK} from '../src/maps/mountain';
import {assertNativePartition,nativeCountFields,nativePartitions,nativePosePlan,nativeMeshBounds,NATIVE_ASSEMBLIES,NATIVE_MESH_BOUNDS,poseDigest} from './helpers/mountain-native-partitions';

const racers=['whale','gemini','gpt','claude','grok','glm'],plan=nativePosePlan(MOUNTAIN_TRACK,racers);
test('native shards cover the complete original ordered distance/lane/yaw/racer matrix',()=>{
 assert.equal(plan.length,NATIVE_ASSEMBLIES);assert.equal(nativeMeshBounds(plan),NATIVE_MESH_BOUNDS);
 // Independent original nested-loop enumeration guards the partition helper.
 const track=MOUNTAIN_TRACK,distances=new Set<number>([0,track.length]);for(let d=0;d<track.length;d+=32)distances.add(d);
 for(const s of track.sections)for(let d=Math.max(0,s.from-20);d<=Math.min(track.length,s.from+20);d+=4)distances.add(d);
 for(const [from,to]of [[.35,.47],[.86,1]])for(let d=track.length*from;d<=track.length*to;d+=4)distances.add(d);
 let index=0;for(const d of [...distances].sort((a,b)=>a-b))for(const sign of [-1,0,1])for(const yaw of [-.36,0,.36])for(const [racerIndex,racer]of racers.entries())assert.deepEqual(plan[index],{index:index++,d,lane:sign*track.laneLimitAt(d),yaw,racerIndex,racer});
 for(const size of [6,7,54,108,378,432]){
  const partitions=nativePartitions(plan.length,size),seen=new Uint8Array(plan.length);let end=0;
  for(const partition of partitions){assert.equal(partition.start,end);assert.ok(partition.end-partition.start<=size);for(let i=partition.start;i<partition.end;i++)seen[i]++;end=partition.end;}
  assert.equal(end,plan.length);assert.ok(seen.every(n=>n===1));
 }
 assert.throws(()=>nativePartitions(plan.length,433));assert.throws(()=>nativePartitions(plan.length,0));
});
test('native aggregation rejects altered coverage, missing bounds, source drift and hidden failures',()=>{
 const partition=nativePartitions(plan.length)[0],hashes={source:'unchanged'};
 const report={...Object.fromEntries(nativeCountFields.map(key=>[key,0])),partition,sourceHashes:hashes,coverage:{start:partition.start,end:partition.end,sha256:poseDigest(plan.slice(partition.start,partition.end))},assemblies:partition.end-partition.start,meshBounds:nativeMeshBounds(plan.slice(partition.start,partition.end)),replayedAssemblies:0};
 assert.doesNotThrow(()=>assertNativePartition(report,partition,plan,hashes));
 for(const mutate of [r=>r.assemblies--,r=>r.meshBounds--,r=>r.coverage.start++,r=>r.coverage.end--,r=>r.coverage.sha256=poseDigest(plan.slice(1,partition.end+1)),r=>r.sourceHashes.source='changed',r=>r.failures=1,r=>r.exactRefinements=-1,r=>r.replayedAssemblies=1]){
  const changed=structuredClone(report);mutate(changed);assert.throws(()=>assertNativePartition(changed,partition,plan,hashes));
 }
});

test('bounded native worker propagates failed exit and force-terminates a stalled process',async()=>{
 const {boundedTestProcess}=await import('./helpers/bounded-test-process');
 const failed=await boundedTestProcess(process.execPath,['-e','console.error("deliberate failure");process.exit(7)'],{timeoutMs:5000});
 assert.equal(failed.code,7);assert.match(failed.output,/deliberate failure/);assert.equal(failed.termination,null);
 const stalled=await boundedTestProcess(process.execPath,['-e','process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'],{timeoutMs:1000,killGraceMs:100});
 assert.equal(stalled.termination,'exceeded 1000 ms deadline');assert.notEqual(stalled.code,0);assert.ok(stalled.signal);
});
test('failed native worker cleanup removes only exact recorded instrumented siblings',async t=>{
 const {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join,sep}=await import('node:path'),{pathToFileURL}=await import('node:url');
 const {createInstrumentedSourceFiles,cleanupInstrumentedSourceManifest}=await import('./helpers/instrumented-source-files');
 const root=mkdtempSync(join(tmpdir(),'native-source-ledger-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const directory=pathToFileURL(root+sep),manifest=join(root,'owned.json'),owned=createInstrumentedSourceFiles(directory,manifest),other=createInstrumentedSourceFiles(directory);
 const a=owned.write('game-test-mountain','export const a=1'),b=other.write('game-test-mountain','export const b=2');
 cleanupInstrumentedSourceManifest(manifest,directory);assert.equal(existsSync(a.url),false);assert.equal(readFileSync(b.url,'utf8'),'export const b=2');
 cleanupInstrumentedSourceManifest(manifest,directory);
 const ledger=JSON.parse(readFileSync(manifest,'utf8'));ledger.files=[b.url.href];writeFileSync(manifest,JSON.stringify(ledger));
 assert.throws(()=>cleanupInstrumentedSourceManifest(manifest,directory));assert.equal(existsSync(b.url),true);other.cleanup();
});

test('bounded native subprocess runs node:test independently of the parent runner',async t=>{
 const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{boundedTestProcess}=await import('./helpers/bounded-test-process');
 const root=mkdtempSync(join(tmpdir(),'native-nested-runner-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const worker=join(root,'worker.mjs');writeFileSync(worker,'import test from "node:test"; test("actually executed independent worker",()=>{});');
 const result=await boundedTestProcess(process.execPath,['--test','--test-reporter=tap',worker],{timeoutMs:5000,env:{...process.env,NODE_TEST_CONTEXT:'child-v8'}});
 assert.equal(result.code,0);assert.match(result.output,/# pass 1/);assert.match(result.output,/ok 1 - actually executed independent worker/);assert.doesNotMatch(result.output,/recursively/);
});
