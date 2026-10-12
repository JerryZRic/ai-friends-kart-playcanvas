/** Serial CPU audit. Production camera outputs are subjects; the oracle reads
 * every rendered indexed triangle and never trusts obstacle metadata as proof. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {WORKSHOP_COURSE} from '../../src/maps/workshop';
import {chaseCamera} from '../../src/race-camera';
import {safeLandCamera,type CameraPoint} from '../../src/land-camera';
import {MeshOracle,tuple,sub,area3D,type V} from './emitted-scene-oracle';
import {workshopCameraScene,workshopSourceSha256 as sha} from './workshop-enrichment-camera-scene';
import {inspectWorkshopBoom,workshopCameraOracleSentinels,workshopFaceKey,WORKSHOP_CAMERA_MARGIN,workshopWitnessKey,inheritedWorkshopCameraWitness,workshopAnchoredShorteningProof,type CameraViolation} from './workshop-enrichment-camera-oracle';

const [stage,run,ledger]=process.argv.slice(2),baseline=stage==='baseline',started=Date.now();assert.ok(['baseline','candidate'].includes(stage));
const plan=JSON.parse(readFileSync('tests/helpers/workshop-enrichment-camera-frozen.json','utf8'));
assert.equal(sha(readFileSync('docs/scene-baselines/workshop-scenery.ts.txt')),plan.baselineSourceSha256);
for(const [file,digest]of Object.entries(plan.dependencies))assert.equal(sha(readFileSync(file)),digest,'Frozen camera dependency changed: '+file);
const sourceFiles=[...Object.keys(plan.dependencies),'src/workshop-scenery.ts','docs/scene-baselines/workshop-scenery.ts.txt','tests/workshop-enrichment-camera.test.ts',...['frozen.json','worker.ts','scene.ts','oracle.ts'].map(s=>'tests/helpers/workshop-enrichment-camera-'+s),'tests/helpers/emitted-scene-oracle.ts','tests/helpers/instrumented-source-files.ts','tests/helpers/bounded-test-process.ts'];
const sources=Object.fromEntries(sourceFiles.map(f=>[f,sha(readFileSync(f))]));
assert.match(readFileSync('src/game.ts','utf8'),/safeLandCamera\(cameraAnchor,cameraPosition,course.cameraObstacles\)[\s\S]*?1 - Math.exp\(-dt \* \(menu \? 1.8 : 8\)\)[\s\S]*?safeLandCamera\(cameraAnchor,camera.getPosition\(\),course.cameraObstacles\)/,'Production pre-safety, damping and post-safety order must remain unchanged');
workshopCameraOracleSentinels();
const old=baseline?null:JSON.parse(readFileSync(join(run,'baseline-report.json'),'utf8'));
if(old)assert.deepEqual(sources,old.sources,'Sources changed between serial stages');
const geometry=await workshopCameraScene(baseline,ledger),mesh=new MeshOracle(geometry.batches);
// Multiplicity is part of identity: an extra coincident face cannot acquire an
// inherited exemption merely because its coordinates existed once before.
const occurrences=new Map<string,number>(),faceKeys=mesh.triangles.map(q=>{const k=workshopFaceKey(q),n=occurrences.get(k)??0;occurrences.set(k,n+1);return k+':'+n;});
const oldFaces=old?new Set<string>(old.faceKeys):null,changed=new Set<number>(baseline?[]:mesh.triangles.filter(q=>!oldFaces!.has(faceKeys[q.id])).map(q=>q.id));
const report:any={schema:'workshop-enrichment-camera-report-v1',stage,sources,baselineSourceCommit:plan.baselineSourceCommit,baselineSourceSha256:plan.baselineSourceSha256,candidateSourceSha256:sources['src/workshop-scenery.ts'],strictFaceMargin:WORKSHOP_CAMERA_MARGIN,metrics:{},totalFailures:0,inheritedFailures:0,newFailures:0,changedMeshFailures:0,unchangedMeshRegressions:0,newFailuresByBatch:{},failureExamples:[],newFailureExamples:[],newWitnesses:[],inheritedWitnesses:[],inheritedShorteningWitnesses:[],archivedRuntimeReplay:{scope:'Nongating geometry diagnostics for archived baseline runtime booms; fixed source-review poses remain gated separately',totalFailures:0,newFailures:0,inheritedFailures:0,changedMeshFailures:0,unchangedMeshRegressions:0,minimumObservedViolationGap:null,witnesses:[]},acceptanceContract:'Gate actual candidate safe/interpolated/moving booms and 26 fixed source-review poses. Archived baseline runtime replay is diagnostic. Inherit only exact witnesses or proved same-anchor collinear shortening of the same-label baseline segment on unchanged indexed-face geometry/multiplicity with no worse clearance or intersection.',limitations:[plan.scope,'Inherited failures remain reported witnesses with exact identity or numerical subsegment proof; no face batch, region or camera mode is excluded']};
const failures:Record<string,number>={},failureKeys=new Set<string>(),baselinePoses:Record<string,{a:V;b:V;terrain:boolean}>={};
let minimum=Infinity,inspections=0,frozenReplays=0,identicalReplays=0;
function record(a:V,b:V,label:string,{triangle:q,gap,kind}:CameraViolation,replay:boolean){
 const face=faceKeys[q.id],key=workshopWitnessKey(label,kind,face,a,b),dedup=(replay?'archive|':'actual|')+key;
 if(failureKeys.has(dedup))return;failureKeys.add(dedup);
 const category=replay?report.archivedRuntimeReplay:report;category.totalFailures++;
 if(baseline)failures[key]=gap;
 const exact=!baseline&&inheritedWorkshopCameraWitness(changed.has(q.id),key,gap,old.failures),oldPose=old?.poses[label],baselineKey=oldPose?workshopWitnessKey(label,kind,face,oldPose.a,oldPose.b):null;
 const shortening=!baseline&&!replay&&!exact&&!changed.has(q.id)&&baselineKey&&Object.hasOwn(old.failures,baselineKey)?workshopAnchoredShorteningProof(a,b,oldPose.a,oldPose.b,gap,old.failures[baselineKey]):null;
 const inherited=exact||!!shortening,proof=exact?{kind:'exact-segment-face-witness',baselineKey:key,baselineGap:old.failures[key]}:shortening?{...shortening,baselineKey}:null;
 const witness={label,kind,gap,triangle:q.id,indexStart:q.indexStart,batch:q.batch,faceKey:face,changed:changed.has(q.id),inherited,replay,proof,baselineGap:baselineKey?old?.failures[baselineKey]:undefined,a,b,vertices:[q.a,q.b,q.c]};
 if(replay){report.archivedRuntimeReplay.witnesses.push(witness);category.minimumObservedViolationGap=Math.min(category.minimumObservedViolationGap??Infinity,gap);}else if(report.failureExamples.length<32)report.failureExamples.push(witness);
 if(inherited){category.inheritedFailures++;if(!replay){report.inheritedWitnesses.push(witness);if(shortening)report.inheritedShorteningWitnesses.push(witness);}}
 else if(!baseline){category.newFailures++;if(changed.has(q.id))category.changedMeshFailures++;else category.unchangedMeshRegressions++;
  if(!replay){report.newWitnesses.push(witness);report.newFailuresByBatch[q.batch]=(report.newFailuresByBatch[q.batch]??0)+1;if(report.newFailureExamples.length<96)report.newFailureExamples.push(witness);}
 }
}
function inspect(a:V,b:V,label:string,terrain=true,replay=false){
 assert.ok([...a,...b].every(Number.isFinite),label+' finite boom');inspections++;const violations:CameraViolation[]=[];
 const gap=inspectWorkshopBoom(mesh,a,b,violation=>{violations.push(violation);record(a,b,label,violation,replay);},terrain);if(!replay)minimum=Math.min(minimum,gap);return violations;
}
function audit(a:V,b:V,label:string,terrain=true){
 if(baseline)baselinePoses[label]={a,b,terrain};
 const current=inspect(a,b,label,terrain);
 if(!baseline){const frozen=old.poses[label];assert.ok(frozen,'Every candidate pose requires an identical baseline label');assert.equal(frozen.terrain,terrain);
  if(!label.startsWith('frozen-source/')){frozenReplays++;
   if(JSON.stringify([a,b])===JSON.stringify([frozen.a,frozen.b])){identicalReplays++;for(const violation of current)record(a,b,label,violation,true);}
   else inspect(frozen.a,frozen.b,label,terrain,true);
  }
 }
}
const edges=WORKSHOP_COURSE.edges,typeIds=Object.keys(edges) as (keyof typeof edges)[];
type EdgeId=keyof typeof edges;
const anchorAt=(f:ReturnType<typeof edges.start.sample>):CameraPoint=>({x:f.p.x,y:f.p.y+1.35,z:f.p.z});
const smooth=(a:CameraPoint,b:CameraPoint,dt:number):CameraPoint=>{const alpha=1-Math.exp(-plan.motion.dampingRate*dt);return{x:a.x+(b.x-a.x)*alpha,y:a.y+(b.y-a.y)*alpha,z:a.z+(b.z-a.z)*alpha};};
const finite=(p:CameraPoint)=>assert.ok(Object.values(p).every(Number.isFinite));
const checked=(anchor:CameraPoint,raw:CameraPoint)=>{const safe=safeLandCamera(anchor,raw,geometry.cameraObstacles);finite(safe);const again=safeLandCamera(anchor,safe,geometry.cameraObstacles);assert.ok(Math.hypot(...sub(tuple(safe),tuple(again)))<1e-6,'Finite post-safety result is idempotent');return safe;};
const stations=new Map<string,{edge:EdgeId;s:number;reasons:string[]}>();
function station(edge:EdgeId,s:number,reason:string){s=Math.max(0,Math.min(edges[edge].length,s));const key=edge+':'+s.toFixed(9),prior=stations.get(key);if(prior)prior.reasons.push(reason);else stations.set(key,{edge,s,reasons:[reason]});}
for(const id of typeIds){for(let s=0;s<edges[id].length;s+=plan.static.stepMetres)station(id,s,'fixed 35 m grid');station(id,edges[id].length,'endpoint');for(const offset of plan.static.endpointOffsetsMetres)station(id,offset<0?edges[id].length+offset:offset,'endpoint approach');}
for(const target of plan.targetStations)station(target.edge,target.s,target.reason);
for(const pocket of plan.loadingPockets)for(let i=0;i<pocket.count;i++)station(pocket.edge,pocket.from+i*pocket.spacingMetres,'fixed architectural approach');
assert.ok(stations.size<=plan.static.maximumStations,'Static station count stays bounded');
if(!baseline)assert.deepEqual([...stations.values()],old.metrics.static.stationDetails,'Static input poses cannot change between stages');
let poses=0,retractions=0;
for(const {edge:id,s}of stations.values())for(const lane of plan.static.laneFractions)for(const view of plan.static.views)for(const rearView of plan.static.rearViews)for(const yaw of plan.static.yaws)for(const pitch of plan.static.pitches){
 const edge=edges[id],frame=edge.sample(s,lane*edge.laneLimitAt(s)),anchor=anchorAt(frame),raw=chaseCamera({position:frame.p,tangent:frame.t,view,rearView,orbit:{yaw,pitch}}).position,safe=checked(anchor,raw),label=`static/${id}/${s}/${lane}/${view}/${rearView}/${yaw}/${pitch}`;
 if(Math.hypot(...sub(tuple(safe),tuple(raw)))>.01)retractions++;
 audit(tuple(anchor),tuple(safe),label+'/safe');
 const priorS=Math.max(0,s-2.4),priorFrame=edge.sample(priorS,lane*edge.laneLimitAt(priorS)),priorAnchor=anchorAt(priorFrame),priorRaw=chaseCamera({position:priorFrame.p,tangent:priorFrame.t,view:1-view,rearView:!rearView,orbit:{yaw:yaw+.6,pitch}}).position,previous=checked(priorAnchor,priorRaw),final=checked(anchor,smooth(previous,safe,1/60));
 audit(tuple(anchor),tuple(final),label+'/interpolated');poses++;
}
assert.ok(poses>10000&&retractions>0,'Broad source camera sweep exercises real retraction');
report.metrics.static={stations:stations.size,stationDetails:[...stations.values()],poses,booms:poses*2,lanes:plan.static.laneFractions,views:plan.static.views,rearViews:plan.static.rearViews,yaws:plan.static.yaws,pitches:plan.static.pitches,retractions};
console.log(JSON.stringify({stage,phase:'static',poses,totalFailures:report.totalFailures,newFailures:report.newFailures}));

// Contiguous 40 m route windows cover all roads, plus fixed architectural approaches
// and both fork/merge choices. The same list is used before and after the edit.
const windows=new Map<string,{edge:EdgeId;s:number;branch:'alley'|'boulevard';reason:string}>();
function window(edge:EdgeId,s:number,reason:string,branch:'alley'|'boulevard'=edge==='alley'?'alley':'boulevard'){s=Math.max(0,Math.min(edges[edge].length,s));windows.set(edge+'/'+s+'/'+branch,{edge,s,branch,reason});}
for(const id of typeIds){for(let s=0;s<edges[id].length;s+=plan.motion.stepMetres)window(id,s,'fixed contiguous route envelope');window(id,edges[id].length,'endpoint');}
for(const target of plan.targetStations)window(target.edge,target.s,target.reason);
for(const branch of ['alley','boulevard']as const){window('start',edges.start.length,'fork seam',branch);window(branch,edges[branch].length-40,'shared merge entry',branch);window(branch,edges[branch].length,'branch to finish',branch);}
window('finish',edges.finish.length,'lap seam');assert.ok(windows.size<=plan.motion.maximumWindows,'Motion window count stays bounded');
if(!baseline)assert.deepEqual([...windows.values()],old.metrics.motion.windows,'Motion windows cannot change between stages');
for(const target of stations.values())assert.ok([...windows.values()].some(w=>w.edge===target.edge&&Math.abs(w.s-target.s)<=plan.motion.windowMetres/2),'Every static source envelope also has a moving-camera window');
function routeFrame(w:{edge:EdgeId;s:number;branch:'alley'|'boulevard'},offset:number,lane:number){
 const route=[edges.start,edges[w.branch],edges.finish],prefix=w.edge==='start'?0:w.edge==='finish'?edges.start.length+edges[w.branch].length:edges.start.length,total=route.reduce((n,e)=>n+e.length,0);let d=((prefix+w.s+offset)%total+total)%total;
 for(const edge of route){if(d<=edge.length)return edge.sample(d,lane*edge.laneLimitAt(d));d-=edge.length;}throw Error('No physical route frame');
}
let frames=0,runs=0,previousFrames=0,rawSmoothingCorrections=0;
for(const [wi,w]of [...windows.values()].entries())for(const hz of plan.motion.ratesHz)for(const lane of plan.motion.laneFractions){
 let previous:CameraPoint|undefined;const count=Math.ceil(plan.motion.windowMetres/(plan.motion.speedMetresPerSecond/hz));
 for(let i=0;i<=count;i++){
  const u=i/count,frame=routeFrame(w,-plan.motion.windowMetres/2+plan.motion.windowMetres*u,lane),anchor=anchorAt(frame),options={view:u<.35?0:1,rearView:u>=.45&&u<.65,orbit:{yaw:u<.2?0:Math.PI*Math.sin((u-.2)/.8*Math.PI*2),pitch:u<.2?0:.25+.53*Math.sin(u*Math.PI*2)}};
  const raw=chaseCamera({position:frame.p,tangent:frame.t,...options}).position,safe=checked(anchor,raw),last=previous??safe,smoothed=smooth(last,safe,1/hz),final=checked(anchor,smoothed),label=`live/${wi}/${hz}/${lane}/${i}`;
  if(previous)previousFrames++;if(Math.hypot(...sub(tuple(final),tuple(smoothed)))>1e-8)rawSmoothingCorrections++;
  audit(tuple(anchor),tuple(final),label+'/boom');
  // Motion itself may cross a surface even when the final boom is safe.
  audit(tuple(last),tuple(final),label+'/movement');previous=final;frames++;
 }runs++;
}
assert.equal(previousFrames,frames-runs,'Every continuing frame uses the preceding final post-safety pose');
report.metrics.motion={windows:[...windows.values()],runs,frames,previousFrames,ratesHz:plan.motion.ratesHz,laneFractions:plan.motion.laneFractions,windowMetres:plan.motion.windowMetres,speedMetresPerSecond:plan.motion.speedMetresPerSecond,actualPreviousRetained:true,productionDampingRate:8,rawSmoothingCorrections};
console.log(JSON.stringify({stage,phase:'motion',runs,frames,totalFailures:report.totalFailures,newFailures:report.newFailures}));

let sourceViews=0;
for(const view of plan.frozenSourceViews){
 const eye:V=view.sourceEye??[view.cameraPositionBlender[0],view.cameraPositionBlender[2],-view.cameraPositionBlender[1]];
 // Fixed image-review eyes are geometry evidence only, not gameplay frames.
 const a:V=view.roadEdge?tuple(anchorAt(edges[view.roadEdge as EdgeId].sample(view.roadDistanceMetres))):eye;
 audit(a,eye,'frozen-source/'+view.name);sourceViews++;
}
report.metrics.frozenSourceViews=sourceViews;
report.metrics.frozenBaselineReplay={count:frozenReplays,identicalPosesAlreadyInspected:identicalReplays,additionalChangedPoseQueries:frozenReplays-identicalReplays};
if(!baseline)assert.equal(frozenReplays,Object.keys(old.poses).filter(label=>!label.startsWith('frozen-source/')).length,'Every archived runtime baseline boom is replayed; fixed source-review poses are gated separately');
report.metrics.geometry={batches:geometry.batches.length,triangles:mesh.triangles.length,changedFaces:changed.size,degenerateFaces:mesh.triangles.filter(q=>area3D([q.a,q.b,q.c])<=1e-12).length,inspections,minimumClearance:minimum};
report.faceKeys=baseline?faceKeys:undefined;report.failures=baseline?failures:undefined;report.poses=baseline?baselinePoses:undefined;
report.durationSeconds=(Date.now()-started)/1000;report.resources={maxRSSKiB:process.resourceUsage().maxRSS,heapCapMiB:448,concurrency:1};
for(const [file,digest]of Object.entries(sources))assert.equal(sha(readFileSync(file)),digest,'Source changed during camera audit: '+file);
writeFileSync(join(run,stage+'-report.json'),JSON.stringify(report));
if(process.env.WORKSHOP_ENRICHMENT_CAMERA_AUDIT_DIR){const output=resolve(process.env.WORKSHOP_ENRICHMENT_CAMERA_AUDIT_DIR);mkdirSync(output,{recursive:true});writeFileSync(join(output,stage+'-report.json'),JSON.stringify(report)+'\n');}
console.log(JSON.stringify({stage,durationSeconds:report.durationSeconds,resources:report.resources,totalFailures:report.totalFailures,newFailures:report.newFailures,inheritedFailures:report.inheritedFailures,changedMeshFailures:report.changedMeshFailures,unchangedMeshRegressions:report.unchangedMeshRegressions,newFailuresByBatch:report.newFailuresByBatch,inheritedShorteningProofs:report.inheritedShorteningWitnesses.length,archiveDiagnostics:{totalFailures:report.archivedRuntimeReplay.totalFailures,newFailures:report.archivedRuntimeReplay.newFailures,changedMeshFailures:report.archivedRuntimeReplay.changedMeshFailures}}));
