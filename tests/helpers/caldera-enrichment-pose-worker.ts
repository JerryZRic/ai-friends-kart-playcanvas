/** Exact paired whole-course output audit. Original collision tests remain separate. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {CALDERA_COURSE,CALDERA_VIADUCT} from '../../src/maps/caldera';
import {chaseCamera} from '../../src/race-camera';
import {safeLandCamera,cameraMeshCandidateIds} from '../../src/land-camera';
import {calderaSceneData} from './caldera-enrichment-scene';
import {calderaSha as sha} from './caldera-enrichment-contract';
import {calderaAuditHashes} from './caldera-enrichment-source-stability';
const sourceHashesBefore=calderaAuditHashes();
const [stage,run,ledger]=process.argv.slice(2),baseline=stage==='baseline',started=Date.now();assert.ok(['baseline','candidate'].includes(stage));
const path=baseline?'docs/scene-baselines/caldera-scenery.ts.txt':'src/caldera-scenery.ts',sourceSha256=sha(readFileSync(path)),{geometry:g}=await calderaSceneData(baseline,ledger);
const count=463272,values=new Float64Array(count*6),old=baseline?null:readFileSync(join(run,'baseline-whole-course-poses.bin')),oldValues=old?new Float64Array(old.buffer,old.byteOffset,old.byteLength/8):null;
if(oldValues)assert.equal(oldValues.length,values.length);
const orientations=[...Array.from({length:24},(_,i)=>[-.28,0,.4,.78].map(pitch=>({yaw:-Math.PI+i*Math.PI/12,pitch,rearView:false}))).flat(),{yaw:0,pitch:0,rearView:true}];
const anchorAt=(f:any)=>({x:f.p.x,y:f.p.y+1.35,z:f.p.z});
const smooth=(a:any,b:any)=>{const t=1-Math.exp(-8/60);return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};};
let poses=0,retractions=0,changedPoses=0;const changes:any[]=[],retracted=createHash('sha256');
for(const edge of Object.values(CALDERA_COURSE.edges)){
 const distances=new Set<number>([0,edge.length]);for(let s=0;s<edge.length;s+=12)distances.add(s);
 for(const s0 of [0,edge.length,...(edge.id==='alley'||edge.id==='boulevard'?[80,110,edge.length-80,edge.length-110]:[])])for(let s=Math.max(0,s0-36);s<=Math.min(edge.length,s0+36);s+=3)distances.add(s);
 for(const s0 of [...CALDERA_VIADUCT.crossings.filter(c=>c.lowerEdge===edge.id).map(c=>c.lowerS),...(edge.id==='finish'?[...CALDERA_VIADUCT.upperPhysicalS,...CALDERA_VIADUCT.crossings.map(c=>c.upperS)]:[])])for(let s=Math.max(0,s0-35);s<=Math.min(edge.length,s0+35);s+=2)distances.add(s);
 for(const s of distances)for(const side of [-1,0,1])for(const view of [0,1])for(const orientation of orientations){
  const {yaw,pitch,rearView}=orientation,f=edge.sample(s,side*edge.laneLimitAt(s)),a=anchorAt(f),desired=chaseCamera({position:f.p,tangent:f.t,view,rearView,orbit:{yaw,pitch}}).position,safe=safeLandCamera(a,desired,g.cameraObstacles);
  if(Math.hypot(safe.x-desired.x,safe.y-desired.y,safe.z-desired.z)>.01){retractions++;retracted.update(JSON.stringify([edge.id,s,side,view,orientation,safe])+'\n');}
  const priorS=Math.max(0,s-2.4),prior=edge.sample(priorS,side*Math.max(0,edge.laneLimitAt(priorS)-.25)),a0=anchorAt(prior),raw0=chaseCamera({position:prior.p,tangent:prior.t,view,rearView:false,orbit:{yaw:yaw+.6,pitch}}).position,priorSafe=safeLandCamera(a0,raw0,g.cameraObstacles),final=safeLandCamera(a,smooth(priorSafe,safe),g.cameraObstacles);
  const row=[safe.x,safe.y,safe.z,final.x,final.y,final.z];assert.ok(row.every(Number.isFinite));values.set(row,poses*6);
  if(oldValues&&row.some((v,k)=>!Object.is(v,oldValues[poses*6+k]))){changedPoses++;if(changes.length<24)changes.push({edge:edge.id,s,side,view,...orientation,before:[...oldValues.slice(poses*6,poses*6+6)],after:row});}poses++;
 }
}
const broadphase:any[]=[];
for(const edge of Object.values(CALDERA_COURSE.edges))for(let s=0;s<edge.length;s+=100)for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/2]){const f=edge.sample(s),a=anchorAt(f),b=chaseCamera({position:f.p,tangent:f.t,view:1,rearView:false,orbit:{yaw,pitch:-.28}}).position;const local=g.cameraObstacles.filter(o=>o.triangles).map(o=>({kind:o.kind,candidates:cameraMeshCandidateIds(o.triangles!,a,b).length}));broadphase.push({edge:edge.id,s,yaw,total:local.reduce((n,o)=>n+o.candidates,0),local});}assert.equal(broadphase.length,176);
assert.equal(poses,count);const bytes=Buffer.from(values.buffer),outputSha256=sha(bytes),retractionOutputSha256=retracted.digest('hex');
if(baseline)writeFileSync(join(run,'baseline-whole-course-poses.bin'),bytes);
const previous=baseline?null:JSON.parse(readFileSync(join(run,'baseline-pose-report.json'),'utf8'));
assert.equal(sha(readFileSync(path)),sourceSha256,'Source remained stable');
const sourceHashesAfter=calderaAuditHashes();assert.deepEqual(sourceHashesAfter,sourceHashesBefore,'All original inputs and QA dependencies remained stable');
const report={sourceHashesBefore,sourceHashesAfter,stable:true,schema:'caldera-enrichment-paired-whole-course-v1',stage,sourceSha256,broadphase,poses,desiredSafeOutputs:poses,interpolatedOutputs:poses,retractions,retractionOutputSha256,outputSha256,changedPoses,changes,durationSeconds:(Date.now()-started)/1000,resources:{maxRSSKiB:process.resourceUsage().maxRSS,heapCapMiB:448,concurrency:1},limitations:['Exact CPU safe/interpolated output comparison, not a replacement for all30 independent collision and geometry assertions','No native pixels,GPU or FPS certification']};writeFileSync(join(run,stage+'-pose-report.json'),JSON.stringify(report)+'\n');
if(process.env.CALDERA_ENRICHMENT_AUDIT_DIR){const out=resolve(process.env.CALDERA_ENRICHMENT_AUDIT_DIR);mkdirSync(out,{recursive:true});writeFileSync(join(out,stage+'-whole-course-pose-report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({...report,sourceHashesBefore:undefined,sourceHashesAfter:undefined,broadphase:undefined}));
assert.equal(retractions,2896,'Actual immutable historical retractions remain exact; not a fabricated zero');
if(previous){assert.equal(changedPoses,0,'No original output pose changes: '+JSON.stringify(changes));assert.equal(outputSha256,previous.outputSha256);assert.equal(retractionOutputSha256,previous.retractionOutputSha256);for(let i=0;i<broadphase.length;i++)for(const before of previous.broadphase[i].local){const after=broadphase[i].local.find((o:any)=>o.kind===before.kind);assert.deepEqual(after,before,'Original broadphase block and candidate count unchanged');}}
