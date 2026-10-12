/** Additive camera matrix; never replaces the original 356472 whole-boom checks. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DESERT_COURSE} from '../../src/maps/desert';
import type {DesertSceneGeometry} from '../../src/desert-scenery';
import {chaseCamera} from '../../src/race-camera';
import {safeLandCamera,type CameraPoint} from '../../src/land-camera';
import {MeshOracle,area3D,projectedInterval,height,lerp,segmentTriangleDistance,tuple,type V} from './emitted-scene-oracle';
import {desertDigest as digest} from './desert-enrichment-contract';
export function inspectDesertBoom(mesh:MeshOracle,a:V,b:V,visit:(w:any)=>void){
 for(const q of mesh.query(a,b,.3)){
  if(area3D([q.a,q.b,q.c])<=1e-12)continue;
  if(q.min[1]<=Math.max(a[1],b[1])+.3&&q.max[1]>=Math.min(a[1],b[1])-.3){const gap=segmentTriangleDistance(a,b,q);if(gap<.3-1e-6)visit({triangle:q,gap,kind:'face-clearance'});}
  if(q.batch==='Desert connected sculpted dune terrain'){const interval=projectedInterval(q,a,b);if(interval){const gap=Math.min(...interval.map(t=>{const p=lerp(a,b,t);return p[1]-height(q,p[0],p[2]);}));if(gap<.3-1e-7)visit({triangle:q,gap,kind:'below-terrain'});}}
 }
}
export function desertCameraChecks(g:DesertSceneGeometry,mesh:MeshOracle,baseline:boolean,old?:any){
 const plan=JSON.parse(readFileSync('tests/helpers/desert-enrichment-camera-frozen.json','utf8'));
 assert.equal(digest(plan),'170d0147641810d7f043761f8f951bac32f1a6c57bdd115e90eda7086eed78c9','Exact pre-edit views, matrices, native56° lenses,1280×800 viewport and8sample draft settings');
 assert.equal(plan.views.length,30);assert.equal(Object.keys(plan.catalogViews).length,5);
 const failures:Record<string,number>={},poses:Record<string,{a:V;b:V}>={},witnesses:any[]=[],newWitnesses:any[]=[],cameraChanges:any[]=[];
 const keys=mesh.triangles.map(q=>digest({batch:q.batch,points:[q.a,q.b,q.c]}));let inspections=0,retractions=0,replays=0;
 const inspect=(a:V,b:V,label:string,replay=false)=>{
  inspections++;assert.ok([...a,...b].every(Number.isFinite));
  inspectDesertBoom(mesh,a,b,({triangle:q,gap,kind})=>{const key=label+'|'+kind+'|'+keys[q.id]+'|'+digest([a,b]),w={label,kind,gap,face:keys[q.id],batch:q.batch,indexStart:q.indexStart,vertices:[q.a,q.b,q.c],a,b,replay};failures[key]=gap;witnesses.push(w);if(!baseline&&(!Object.hasOwn(old.failures,key)||gap<old.failures[key]-1e-9))newWitnesses.push(w);});
 };
 const audit=(a:V,b:V,label:string)=>{if(baseline)poses[label]={a,b};else{assert.ok(old.poses[label],'Candidate must preserve every frozen input pose label');if(digest([a,b])!==digest([old.poses[label].a,old.poses[label].b])){cameraChanges.push({label,old:old.poses[label],current:{a,b}});inspect(old.poses[label].a,old.poses[label].b,label,true);}replays++;}inspect(a,b,label);};
 const anchorAt=(f:any):CameraPoint=>({x:f.p.x,y:f.p.y+1.35,z:f.p.z}),point=(v:V)=>({x:v[0],y:v[1],z:v[2]}),smooth=(a:CameraPoint,b:CameraPoint,hz:number):CameraPoint=>{const t=1-Math.exp(-8/hz);return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};};
 const checked=(a:CameraPoint,b:CameraPoint)=>{const safe=safeLandCamera(a,b,g.cameraObstacles),again=safeLandCamera(a,safe,g.cameraObstacles);assert.ok(Math.hypot(safe.x-again.x,safe.y-again.y,safe.z-again.z)<1e-6,'Post-safety pose is idempotent');return safe;};
 for(const v of plan.views){assert.equal(v.verticalFovDegrees,56);assert.deepEqual(v.resolution,[1280,800]);assert.equal(v.clipStart,.12);assert.equal(v.clipEnd,2200);audit(v.kind==='eye'?v.sourceEye:v.sourceAnchor,v.sourceEye,'frozen/'+v.name);if(v.kind==='chase'){const safe=checked(point(v.sourceAnchor),point(v.sourceDesiredEye));if(baseline)assert.deepEqual(tuple(safe),v.sourceEye,'Frozen baseline normal chase is the final safety-corrected eye');audit(v.sourceAnchor,tuple(safe),'current-normal/'+v.name);}}
 const stations=plan.views.filter((v:any)=>v.kind==='chase'),orientations=[...Array.from({length:8},(_,i)=>[-.28,0,.4,.78].map(pitch=>({yaw:-Math.PI+i*Math.PI/4,pitch,rearView:false}))).flat(),{yaw:0,pitch:0,rearView:true}];
 assert.equal(stations.length,15);let staticPoses=0;
 for(const station of stations)for(const lane of [-1,0,1])for(const view of [0,1])for(const {yaw,pitch,rearView}of orientations){
  const edge=DESERT_COURSE.edges[station.edge],s=station.s,f=edge.sample(s,lane*edge.laneLimitAt(s)),anchor=anchorAt(f),raw=chaseCamera({position:f.p,tangent:f.t,view,rearView,orbit:{yaw,pitch}}).position,safe=checked(anchor,raw),label=`static/${station.name}/${lane}/${view}/${yaw}/${pitch}/${rearView}`;
  if(Math.hypot(safe.x-raw.x,safe.y-raw.y,safe.z-raw.z)>.01)retractions++;audit(tuple(anchor),tuple(safe),label+'/safe');
  const s0=Math.max(0,s-2.4),prior=edge.sample(s0,lane*edge.laneLimitAt(s0)),a0=anchorAt(prior),raw0=chaseCamera({position:prior.p,tangent:prior.t,view:1-view,rearView:!rearView,orbit:{yaw:yaw+.6,pitch}}).position,previous=checked(a0,raw0),final=checked(anchor,smooth(previous,safe,60));audit(tuple(anchor),tuple(final),label+'/interpolated');staticPoses++;
 }
 let movingFrames=0,runs=0;
 for(const station of stations)for(const lane of [-1,0,1])for(const hz of [30,60]){
  const edge=DESERT_COURSE.edges[station.edge],count=hz*2;let previous:CameraPoint|undefined;runs++;
  for(let i=0;i<=count;i++){const u=i/count,s=Math.max(0,Math.min(edge.length,station.s-18+36*u)),f=edge.sample(s,lane*edge.laneLimitAt(s)),anchor=anchorAt(f),raw=chaseCamera({position:f.p,tangent:f.t,view:u<.35?0:1,rearView:u>=.45&&u<.65,orbit:{yaw:u<.2?0:Math.PI*Math.sin((u-.2)/.8*Math.PI*2),pitch:.25+.53*Math.sin(u*Math.PI*2)}}).position,safe=checked(anchor,raw),last=previous??safe,final=checked(anchor,smooth(last,safe,hz)),label=`live/${station.name}/${lane}/${hz}/${i}`;audit(tuple(anchor),tuple(final),label+'/boom');audit(tuple(last),tuple(final),label+'/movement');previous=final;movingFrames++;}
 }
 assert.equal(staticPoses,2970);assert.equal(movingFrames,8190);assert.equal(runs,90);
 if(!baseline)assert.equal(replays,Object.keys(old.poses).length,'Every baseline archived pose replayed against candidate, or verified numerically identical');
 return{scope:'Additional CPU actual-triangle static, live-smoothed and fixed-camera checks; no native pixels/GPU/FPS claim',staticPoses,movingFrames,runs,inspections,retractions,baselinePoseReplays:replays,cameraChanges,witnesses,newWitnesses,...(baseline?{poses,failures}:{})};
}
