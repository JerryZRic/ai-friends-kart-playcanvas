/** Retained Airfield010 camera output parity, preserving the original loop order. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {AIRFIELD_COURSE as course,AIRFIELD_HANGAR} from '../../src/maps/airfield';
import {airfieldPickupRows} from '../../src/land-course-pickups';
import {chaseCamera} from '../../src/race-camera';
import {safeLandCamera,cameraMeshCandidateIds,type CameraPoint} from '../../src/land-camera';
import {airfieldSceneData} from './airfield-enrichment-scene';
import {airfieldSha as sha} from './airfield-enrichment-contract';
import {airfieldAuditHashes} from './airfield-enrichment-source-stability';
import {AirfieldCameraRecords,airfieldCameraPlan,assertAirfieldCameraExpected,airfieldCameraExpectedPath} from './airfield-enrichment-camera-records';
const [stage,run,ledger]=process.argv.slice(2),baseline=stage==='baseline',started=Date.now();assert.ok(['baseline','candidate'].includes(stage));
if(!baseline)assert.ok(existsSync(airfieldCameraExpectedPath),'Original output digests must be frozen before candidate starts');
const plan=airfieldCameraPlan(),sourceHashesBefore=airfieldAuditHashes(),sourceSha256=sha(readFileSync(baseline?'docs/scene-baselines/airfield-original/src/airfield-scenery.ts.txt':'src/airfield-scenery.ts'));
const previous=baseline?null:JSON.parse(readFileSync(join(run,'baseline-retained-report.json'),'utf8'));if(previous){assert.equal(previous.sourceSha256,plan.originalSourceSha256);assert.deepEqual(sourceHashesBefore,previous.sourceHashesBefore,'All source and QA inputs must stay frozen between stages');}
const {geometry:g}=await airfieldSceneData(baseline,ledger),records=new AirfieldCameraRecords(baseline,run,'retained');
const tuple=(p:CameraPoint)=>[p.x,p.y,p.z],anchorAt=(f:any)=>({x:f.p.x,y:f.p.y+1.35,z:f.p.z});
const smooth=(a:CameraPoint,b:CameraPoint,dt=1/60):CameraPoint=>{const t=1-Math.exp(-8*dt);return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};};
const row=(label:string,a:CameraPoint,b:CameraPoint)=>records.record(label,[...tuple(a),...tuple(b)]),safe=(a:CameraPoint,b:CameraPoint)=>safeLandCamera(a,b,g.cameraObstacles);
const orientations=[...Array.from({length:24},(_,i)=>[-.5,0,.5,1.15].map(pitch=>({yaw:-Math.PI+i*Math.PI/12,pitch,rearView:false}))).flat(),{yaw:0,pitch:0,rearView:true}];
let wholeCoursePoses=0,retractions=0;const retractHash=createHash('sha256');
records.begin('retained-whole-course-safe-and-interpolated');
for(const edge of Object.values(course.edges)){
 const distances=new Set<number>([0,edge.length]);for(let s=0;s<edge.length;s+=12)distances.add(s);
 for(const s0 of [0,edge.length,...(edge.id==='alley'||edge.id==='boulevard'?[80,110,edge.length-80,edge.length-110]:[])])for(let s=Math.max(0,s0-36);s<=Math.min(edge.length,s0+36);s+=3)distances.add(s);
 for(const s0 of (edge.id==='alley'?[...AIRFIELD_HANGAR.physicalS]:[]))for(let s=Math.max(0,s0-35);s<=Math.min(edge.length,s0+35);s+=2)distances.add(s);
 for(const s of distances)for(const side of [-1,0,1])for(const view of [0,1])for(const orientation of orientations){
  const {yaw,pitch,rearView}=orientation,f=edge.sample(s,side*edge.laneLimitAt(s)),a=anchorAt(f),raw=chaseCamera({position:f.p,tangent:f.t,view,rearView,orbit:{yaw,pitch}}).position,desired=safe(a,raw);
  if(Math.hypot(desired.x-raw.x,desired.y-raw.y,desired.z-raw.z)>.01){retractions++;retractHash.update(JSON.stringify([edge.id,s,side,view,orientation,desired])+'\n');}
  const priorS=Math.max(0,s-2.4),prior=edge.sample(priorS,side*Math.max(0,edge.laneLimitAt(priorS)-.25)),priorAnchor=anchorAt(prior),priorRaw=chaseCamera({position:prior.p,tangent:prior.t,view,rearView:false,orbit:{yaw:yaw+.6,pitch}}).position,priorSafe=safe(priorAnchor,priorRaw),final=safe(a,smooth(priorSafe,desired));
  row(`${edge.id}/${s}/${side}/${view}/${yaw}/${pitch}/${rearView}`,desired,final);wholeCoursePoses++;
 }
}
assert.equal(wholeCoursePoses,342798,'Independently frozen complete original Airfield whole-course matrix');assert.equal(retractions,55,'All historical original retractions retained exactly');console.log(JSON.stringify({stage,phase:'whole-course',poses:wholeCoursePoses,retractions}));
records.begin('retained-split-merge-lap-transitions');
const e=course.edges,joins=[[e.start,e.alley],[e.start,e.boulevard],[e.alley,e.finish],[e.boulevard,e.finish],[e.finish,e.start]] as const;let seamFrames=0;
for(const reverse of [false,true])for(const side of [-1,0,1])for(const view of [0,1])for(const rearMode of [0,1,2])for(const pitch of [-.28,.78])for(const [from,to]of joins){let previous:CameraPoint|null=null;
 for(let i=0;i<=80;i++){const offset=(reverse?40-i:i-40)*.8,edge=offset<0?from:to,s=offset<0?from.length+offset:offset,f=edge.sample(s,side*edge.laneLimitAt(s)),a=anchorAt(f),rearView=rearMode===1||(rearMode===2&&i>=20&&i<50),yaw=Math.PI*Math.sin(i/80*Math.PI*2),raw=chaseCamera({position:f.p,tangent:f.t,view,rearView,orbit:{yaw,pitch}}).position,desired=safe(a,raw),final=safe(a,previous?smooth(previous,desired):desired);row(`${from.id}/${to.id}/${reverse}/${side}/${view}/${rearMode}/${pitch}/${i}`,desired,final);previous=final;seamFrames++;}
}assert.equal(seamFrames,29160);
records.begin('retained-live-full-route-histories');let liveRuns=0,liveFrames=0;
for(const branch of ['alley','boulevard']as const)for(const hz of [30,60,144])for(const side of [-1,0,1]){let previous:CameraPoint|null=null,time=0;liveRuns++;
 for(const edge of [e.start,e[branch],e.finish])for(let s=0;s<edge.length;s+=55/hz){const f=edge.sample(s,side*edge.laneLimitAt(s)),phase=Math.floor(time*2),a=anchorAt(f),raw=chaseCamera({position:f.p,tangent:f.t,view:phase%2,rearView:phase%5===2,orbit:{yaw:(phase%7-3)*Math.PI/3,pitch:[-.5,0,.5,1.15][phase%4]}}).position,desired=safe(a,raw),final=safe(a,smooth(previous??desired,desired,1/hz));row(`${branch}/${hz}/${side}/${edge.id}/${s}/${time}`,desired,final);previous=final;time+=1/hz;liveFrames++;}
}assert.equal(liveRuns,18);
records.begin('retained-gameplay-grid-safe-and-idempotence');let gameplayPoses=0;
for(const edge of Object.values(e))for(let s=0;s<edge.length;s+=35)for(const lane of [-edge.laneLimitAt(s),0,edge.laneLimitAt(s)])for(const view of [0,1])for(const rearView of [false,true])for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/2])for(const pitch of [-.28,0,.78]){const f=edge.sample(s,lane),a=anchorAt(f),raw=chaseCamera({position:f.p,tangent:f.t,view,rearView,orbit:{yaw,pitch}}).position,desired=safe(a,raw),again=safe(a,desired);row(`${edge.id}/${s}/${lane}/${view}/${rearView}/${yaw}/${pitch}`,desired,again);gameplayPoses++;}
assert.ok(gameplayPoses>10000);
records.begin('retained-fixed-pickup-bob-rays');let pickupRays=0;
for(const box of airfieldPickupRows(course))for(const ahead of [12,25,40])for(const view of [0,1])for(const lane of [-2.2,0,2.2]){const f=e[box.edgeId].sample(box.s-ahead,lane),a=anchorAt(f),pose=chaseCamera({position:f.p,tangent:f.t,view,rearView:false,orbit:{yaw:0,pitch:0}}),camera=safe(a,pose.position);
 for(const bob of [-.17,.17]){const target={x:box.p.x,y:box.p.y+1.25+bob,z:box.p.z},end=safeLandCamera(camera,target,g.cameraObstacles,0);row(`${box.edgeId}/${box.s}/${box.lateral}/${ahead}/${view}/${lane}/${bob}`,camera,end);pickupRays++;}}
assert.equal(pickupRays,720);
records.begin('retained-full-legal-lane-pickup-approaches');let fullLanePickupRays=0;
for(const box of airfieldPickupRows(course))for(const ahead of [12,25,40,55])for(const side of [-1,0,1])for(const view of [0,1]){const edge=e[box.edgeId],s=box.s-ahead,f=edge.sample(s,side*edge.laneLimitAt(s)),a=anchorAt(f),pose=chaseCamera({position:f.p,tangent:f.t,view,rearView:false,orbit:{yaw:0,pitch:0}}),camera=safe(a,pose.position);
 for(const lift of [1.08,1.25,1.42]){const target={x:box.p.x,y:box.p.y+lift,z:box.p.z};row(`${box.edgeId}/${box.s}/${box.lateral}/${ahead}/${side}/${view}/${lift}`,camera,target);fullLanePickupRays++;}}
assert.equal(fullLanePickupRays,1440);
records.begin('retained-sampled-cpu-query-outputs');let cpuQueryOutputs=0;
for(const edge of Object.values(e))for(let s=0;s<edge.length;s+=38)for(const side of [-1,0,1])for(const view of [0,1]){const f=edge.sample(s,side*edge.laneLimitAt(s)),a=anchorAt(f),raw=chaseCamera({position:f.p,tangent:f.t,view,rearView:false,orbit:{yaw:s*.021,pitch:-.5}}).position;row(`${edge.id}/${s}/${side}/${view}`,a,safe(a,raw));cpuQueryOutputs++;}
assert.equal(cpuQueryOutputs,552);
records.begin('retained-nine-original-fraction-review-poses');let originalReviewPoses=0;
for(const [id,fraction]of [['start',.10],['start',.32],['start',.53],['start',.76],['start',.97],['alley',.49],['boulevard',.50],['finish',.40],['finish',.88]]as const){const edge=e[id],s=edge.length*fraction,f=edge.sample(s),a=anchorAt(f),forward=edge.sample(s+32);row(`${id}/${fraction}/driver`,{x:f.p.x,y:f.p.y+1.6,z:f.p.z},{x:forward.p.x,y:forward.p.y+1.6,z:forward.p.z});originalReviewPoses++;
 for(const view of [0,1]){const pose=chaseCamera({position:f.p,tangent:f.t,view,rearView:false,orbit:{yaw:0,pitch:0}});row(`${id}/${fraction}/chase${view}`,safe(a,pose.position),pose.look);originalReviewPoses++;}}
assert.equal(originalReviewPoses,27);
records.begin('retained-full-hangar-aperture');let hangarPoses=0;const hangar=g.cameraObstacles.filter(o=>o.kind.includes('hangar'));
for(let s=AIRFIELD_HANGAR.physicalS[0]-20;s<=AIRFIELD_HANGAR.physicalS[1]+20;s+=2)for(const side of [-1,0,1])for(const view of [0,1])for(const rearView of [false,true])for(let angle=0;angle<24;angle++)for(const pitch of [-.28,0,.78]){const edge=e.alley,lane=side*edge.laneLimitAt(s),f=edge.sample(s,lane),a=anchorAt(f),raw=chaseCamera({position:f.p,tangent:f.t,view,rearView,orbit:{yaw:angle*Math.PI/12,pitch}}).position,eye=safeLandCamera(a,raw,hangar);row(`${s}/${side}/${view}/${rearView}/${angle}/${pitch}`,raw,eye);hangarPoses++;}
assert.equal(hangarPoses,52704);
const broadphase:any[]=[];for(const edge of Object.values(e))for(let s=0;s<edge.length;s+=100)for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/2]){const f=edge.sample(s),a=anchorAt(f),b=chaseCamera({position:f.p,tangent:f.t,view:1,rearView:false,orbit:{yaw,pitch:-.28}}).position;const local=g.cameraObstacles.filter(o=>o.triangles).map(o=>({kind:o.kind,candidates:cameraMeshCandidateIds(o.triangles!,a,b).length}));broadphase.push({edge:edge.id,s,yaw,total:local.reduce((n,o)=>n+o.candidates,0),local});}
const outputs=records.finish(),sourceHashesAfter=airfieldAuditHashes();assert.deepEqual(sourceHashesAfter,sourceHashesBefore,'All source and audit inputs remain stable');
const report={schema:'airfield-enrichment-retained-camera-parity-v1',stage,baselineCommit:plan.baselineCommit,sourceSha256,sourceHashesBefore,sourceHashesAfter,stable:true,wholeCoursePoses,retractions,retractionOutputSha256:retractHash.digest('hex'),seamFrames,liveRuns,liveFrames,gameplayPoses,pickupRays,fullLanePickupRays,cpuQueryOutputs,originalReviewPoses,hangarPoses,broadphase,outputs,durationSeconds:(Date.now()-started)/1000,resources:{maxRSSKiB:process.resourceUsage().maxRSS,heapCapMiB:448,concurrency:1},limitations:['Exact CPU output equality for retained safe/interpolated matrices; original independent collision assertions remain required separately','All frames of original live histories are compared, not only the hangar-local selected frames','No native pixels/GPU/FPS claim']};
writeFileSync(join(run,stage+'-retained-report.json'),JSON.stringify(report)+'\n',{flag:'wx'});
if(process.env.AIRFIELD_ENRICHMENT_AUDIT_DIR){const out=resolve(process.env.AIRFIELD_ENRICHMENT_AUDIT_DIR);mkdirSync(out,{recursive:true});writeFileSync(join(out,stage+'-retained-camera-report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({...report,sourceHashesBefore:undefined,sourceHashesAfter:undefined,broadphase:undefined}));
assertAirfieldCameraExpected(stage,'retained',outputs);
if(existsSync(airfieldCameraExpectedPath)){const frozen=JSON.parse(readFileSync(airfieldCameraExpectedPath,'utf8'));assert.equal(retractions,frozen.retainedRetractions);assert.equal(report.retractionOutputSha256,frozen.retainedRetractionOutputSha256);}
if(!baseline){const old=JSON.parse(readFileSync(join(run,'baseline-retained-report.json'),'utf8'));assert.equal(report.retractions,old.retractions);assert.equal(report.retractionOutputSha256,old.retractionOutputSha256);assert.equal(outputs.outputSha256,old.outputs.outputSha256);assert.equal(outputs.labelSha256,old.outputs.labelSha256);assert.equal(outputs.changedRows,0,JSON.stringify(outputs.changes));for(let i=0;i<broadphase.length;i++)for(const before of old.broadphase[i].local){const after=broadphase[i].local.find((o:any)=>o.kind===before.kind);assert.deepEqual(after,before,'Every original broadphase candidate count unchanged');}}
