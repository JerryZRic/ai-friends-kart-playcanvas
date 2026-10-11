/** Deterministic native-audit coverage. This module allocates no engine/model scene. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {getHeapStatistics} from 'node:v8';
import type {LandTrack} from '../../src/land-track';

export type NativePartition={kind:'mesh'|'camera'|'capture';id:string;start:number;end:number};
export type NativePose={index:number;d:number;lane:number;yaw:number;racerIndex:number;racer:string};
export const NATIVE_ASSEMBLIES=22734,NATIVE_MESH_BOUNDS=1136700;
export const NATIVE_RACER_MESH_BOUNDS={whale:46,gemini:52,gpt:52,claude:48,grok:50,glm:52} as const;
export const nativeMeshBounds=(poses:readonly NativePose[])=>poses.reduce((sum,pose)=>sum+NATIVE_RACER_MESH_BOUNDS[pose.racer],0);
export function nativeSourceHashes(){
 const sources=['src/game.ts','src/maps/mountain.ts','src/land-course.ts','src/land-track.ts','src/land-driving.ts','src/race-camera.ts','src/land-camera.ts','src/kart-driver.ts','tests/helpers/gameplay-scenario.ts','tests/helpers/instrumented-source-files.ts','tests/mountain-enrichment-gameplay.test.ts','tests/helpers/mountain-native-partitions.ts','tests/helpers/mountain-native-audit-worker.ts','tests/helpers/bounded-test-process.ts','tests/mountain-native-partitions.test.ts'];
 if(!process.env.MOUNTAIN_NATIVE_GOLDEN_CAPTURE)sources.push('src/mountain-scenery.ts','src/alpine-props.ts','src/generated/alpine-props.json','tests/helpers/emitted-scene-oracle.ts','tests/helpers/native-mesh-oracle.ts','tests/helpers/mountain-baseline-contract.ts','tests/fixtures/mountain-native-control-baseline.json');
 return Object.fromEntries(sources.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
}
export function nativeResources(){
 const memory=process.memoryUsage(),flag=process.execArgv.find(arg=>arg.startsWith('--max-old-space-size='));
 return {pid:process.pid,maxRSSKiB:process.resourceUsage().maxRSS,rssMiB:memory.rss/1048576,v8HeapUsedMiB:memory.heapUsed/1048576,v8HeapTotalMiB:memory.heapTotal/1048576,v8HeapLimitMiB:getHeapStatistics().heap_size_limit/1048576,externalMiB:memory.external/1048576,arrayBuffersMiB:memory.arrayBuffers/1048576,configuredOldSpaceMiB:flag?Number(flag.split('=')[1]):null,execArgv:process.execArgv,concurrency:1};
}
export function nativePosePlan(track:LandTrack,racerIds:readonly string[]):NativePose[]{
 const distances=new Set<number>([0,track.length]);for(let d=0;d<track.length;d+=32)distances.add(d);
 for(const s of track.sections)for(let d=Math.max(0,s.from-20);d<=Math.min(track.length,s.from+20);d+=4)distances.add(d);
 for(const [from,to]of [[.35,.47],[.86,1]])for(let d=track.length*from;d<=track.length*to;d+=4)distances.add(d);
 const poses:NativePose[]=[];
 for(const d of [...distances].sort((a,b)=>a-b))for(const sign of [-1,0,1])for(const yaw of [-.36,0,.36])for(const [racerIndex,racer]of racerIds.entries())poses.push({index:poses.length,d,lane:sign*track.laneLimitAt(d),yaw,racerIndex,racer});
 return poses;
}
export const poseLine=(pose:NativePose)=>JSON.stringify([pose.index,pose.d,pose.lane,pose.yaw,pose.racerIndex,pose.racer])+'\n';
export const poseDigest=(poses:readonly NativePose[])=>{const hash=createHash('sha256');for(const pose of poses)hash.update(poseLine(pose));return hash.digest('hex');};
export function nativePartitions(total:number,maxPoses=378):NativePartition[]{
 assert.ok(Number.isInteger(total)&&total>0);
 assert.ok(Number.isInteger(maxPoses)&&maxPoses>=6&&maxPoses<=432,'native mesh shards must contain 6–432 poses');
 const parts:NativePartition[]=[];
 for(let start=0;start<total;start+=maxPoses)parts.push({kind:'mesh',id:`mesh-${String(parts.length).padStart(3,'0')}`,start,end:Math.min(total,start+maxPoses)});
 return parts;
}
export const nativeCountFields=['assemblies','meshBounds','unionOnlyOverlaps','individualBoundOverlaps','exactRefinements','sourceCandidates','supportContacts','supportActualIntersections','failures'] as const;
/** Reject missing, reordered, duplicate, overlapping or mutated shard coverage. */
export function assertNativePartition(report:any,partition:NativePartition,plan:readonly NativePose[],hashes:Record<string,string>){
 assert.deepEqual(report.partition,partition,'worker returned its exact assigned partition');
 assert.deepEqual(report.sourceHashes,hashes,'all native processes use identical production and test sources');
 assert.equal(report.coverage.start,partition.start);assert.equal(report.coverage.end,partition.end);
 assert.equal(report.coverage.sha256,poseDigest(plan.slice(partition.start,partition.end)),'every assigned ordered pose was asserted exactly once');
 assert.equal(report.assemblies,partition.end-partition.start);
 assert.equal(report.meshBounds,nativeMeshBounds(plan.slice(partition.start,partition.end)));
 assert.equal(report.replayedAssemblies,partition.start,'original preceding animation/placement/skin updates were replayed');
 assert.equal(report.failures,0,'native geometry failures cannot be hidden by aggregation');
 for(const field of nativeCountFields)assert.ok(Number.isSafeInteger(report[field])&&report[field]>=0,`valid exact shard count: ${field}`);
}
