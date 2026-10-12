/** Independent complete-boom and camera-motion checks on rendered indexed faces. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GARDEN_COURSE as course} from '../../src/maps/garden';
import type {GardenSceneGeometry} from '../../src/garden-scenery';
import {chaseCamera} from '../../src/race-camera';
import {safeLandCamera,type CameraPoint} from '../../src/land-camera';
import {MeshOracle,area3D,projectedInterval,height,lerp,segmentTriangleDistance,tuple,type V,type Triangle} from './emitted-scene-oracle';
import {gardenDigest as digest} from './garden-enrichment-contract';
import {GardenCameraRecords} from './garden-enrichment-camera-records';
export function inspectGardenEnrichmentBoom(mesh:MeshOracle,a:V,b:V,visit:(w:{triangle:Triangle;gap:number;kind:string})=>void,terrain=true){
 for(const q of mesh.query(a,b,.3)){
  if(area3D([q.a,q.b,q.c])<=1e-12)continue;
  if(q.min[1]<=Math.max(a[1],b[1])+.3&&q.max[1]>=Math.min(a[1],b[1])-.3){const gap=segmentTriangleDistance(a,b,q);if(gap<.3-1e-6)visit({triangle:q,gap,kind:'face-clearance'});}
  if(terrain&&['Garden connected sunlit meadow','Garden connected deep fern terraces'].includes(q.batch)){
   const interval=projectedInterval(q,a,b);if(interval){const gap=Math.min(...interval.map(t=>{const p=lerp(a,b,t);return p[1]-height(q,p[0],p[2]);}));if(gap<.3-1e-7)visit({triangle:q,gap,kind:'below-terrain'});}
  }
 }
}
export function gardenEnrichmentCameraSentinels(){
 const mesh=new MeshOracle([{name:'sentinel',positions:[0,-2,-2,0,2,-2,0,0,2],indices:[0,1,2]}]),violations:any[]=[];
 inspectGardenEnrichmentBoom(mesh,[-1,0,0],[1,0,0],w=>violations.push(w));assert.equal(violations.length,1);assert.equal(violations[0].gap,0,'Clear endpoints cannot hide a through-face boom');
 violations.length=0;inspectGardenEnrichmentBoom(mesh,[-.299,0,0],[-.299,0,0],w=>violations.push(w));assert.equal(violations.length,1,'0.3 m capsule margin catches nonintersecting near misses');
 violations.length=0;inspectGardenEnrichmentBoom(mesh,[-.301,0,0],[-.301,0,0],w=>violations.push(w));assert.equal(violations.length,0,'Oracle distinguishes a truly clear point');
 const ground=new MeshOracle([{name:'Garden connected sunlit meadow',positions:[-10,0,-10,10,0,-10,0,0,10],indices:[0,1,2]}]);violations.length=0;inspectGardenEnrichmentBoom(ground,[-1,-2,0],[1,-2,0],w=>violations.push(w));assert.ok(violations.some(w=>w.kind==='below-terrain'),'Below-terrain booms cannot evade vertical filtering');
}
export function gardenEnrichmentCameraChecks(g:GardenSceneGeometry,baseline:boolean,plan:any,records:GardenCameraRecords,old?:any){
 gardenEnrichmentCameraSentinels();const mesh=new MeshOracle(g.batches),occurrences=new Map<string,number>(),keys=mesh.triangles.map(q=>{const key=digest({batch:q.batch,vertices:[q.a,q.b,q.c]});const n=occurrences.get(key)??0;occurrences.set(key,n+1);return key+':'+n;});
 const failures:Record<string,number>={},witnesses:any[]=[],newWitnesses:any[]=[];let inspections=0,retractions=0,forwardRetractions=0;
 function inspect(a:V,b:V,label:string,terrain=true){
  inspections++;records.record(label,[...a,...b]);inspectGardenEnrichmentBoom(mesh,a,b,({triangle:q,gap,kind})=>{const face=keys[q.id],key=digest([label,kind,face,a,b]),inherited=!baseline&&Object.hasOwn(old.failures,key)&&gap>=old.failures[key]-1e-9,w={key,label,kind,face,batch:q.batch,indexStart:q.indexStart,vertices:[q.a,q.b,q.c],a,b,gap,inherited};failures[key]=gap;witnesses.push(w);if(!baseline&&!inherited)newWitnesses.push(w);},terrain);
 }
 const point=(v:V):CameraPoint=>({x:v[0],y:v[1],z:v[2]}),anchorAt=(f:any):CameraPoint=>({x:f.p.x,y:f.p.y+1.35,z:f.p.z});
 const smooth=(a:CameraPoint,b:CameraPoint,hz:number):CameraPoint=>{const t=1-Math.exp(-8/hz);return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};};
 const checked=(a:CameraPoint,b:CameraPoint)=>{const safe=safeLandCamera(a,b,g.cameraObstacles),again=safeLandCamera(a,safe,g.cameraObstacles);assert.ok(Math.hypot(safe.x-again.x,safe.y-again.y,safe.z-again.z)<1e-6,'Final safety result remains idempotent');return safe;};
 records.begin('frozen-60-source-views-and-40-normal-chases');const reviews=JSON.parse(readFileSync('docs/garden-enrichment-cameras.json','utf8'));assert.equal(reviews.views.length,60);assert.equal(Object.keys(reviews.catalogViews).length,5);let frozenViews=0,currentChases=0;
 for(const view of reviews.views){assert.equal(view.verticalFovDegrees,56);assert.deepEqual(view.resolution,[1280,800]);assert.equal(view.clipStart,.12);assert.equal(view.clipEnd,2200);assert.equal(view.samples,8);assert.equal(view.projection,'PERSP');
  inspect(view.kind==='eye'?view.sourceEye:view.sourceAnchor,view.sourceEye,'frozen/'+view.name);frozenViews++;
  if(view.kind.startsWith('chase')){const safe=checked(point(view.sourceAnchor),point(view.sourceDesiredEye));assert.deepEqual(tuple(safe),view.sourceEye,'All original normal chase review outputs stay exactly fixed');inspect(view.sourceAnchor,tuple(safe),'current/'+view.name);currentChases++;}
 }
 assert.equal(currentChases,40);
 records.begin('dense-local-2m-safe-and-interpolated');const local=plan.local,orientations=[...Array.from({length:local.yawSteps},(_,i)=>local.pitches.map((pitch:number)=>({yaw:-Math.PI+i*Math.PI/12,pitch,rearView:false}))).flat(),{yaw:0,pitch:0,rearView:true}];
 assert.equal(local.spacingMetres,2);assert.equal(local.windowExpansionMetres,25);assert.equal(local.windows.length,3);assert.equal(orientations.length,97);let denseStations=0,densePoses=0;const stationDetails:any[]=[];
 for(const w of local.windows){const edge=course.edges[w.edge],from=Math.max(0,w.from-local.windowExpansionMetres),to=Math.min(edge.length,w.to+local.windowExpansionMetres),distances=new Set<number>([from,to]);for(let s=from;s<to;s+=local.spacingMetres)distances.add(s);
  for(const s of [...distances].sort((a,b)=>a-b)){denseStations++;stationDetails.push({region:w.id,edge:w.edge,s});
   for(const lane of local.laneFractions)for(const view of local.views)for(const {yaw,pitch,rearView}of orientations){
    const f=edge.sample(s,lane*edge.laneLimitAt(s)),anchor=anchorAt(f),raw=chaseCamera({position:f.p,tangent:f.t,view,rearView,orbit:{yaw,pitch}}).position,safe=checked(anchor,raw),label=`dense/${w.id}/${s}/${lane}/${view}/${yaw}/${pitch}/${rearView}`;
    if(Math.hypot(safe.x-raw.x,safe.y-raw.y,safe.z-raw.z)>.01){retractions++;if(yaw===0&&pitch===0&&!rearView)forwardRetractions++;}inspect(tuple(anchor),tuple(safe),label+'/safe');
    const priorS=Math.max(0,s-2.4),prior=edge.sample(priorS,lane*Math.max(0,edge.laneLimitAt(priorS)-.25)),priorAnchor=anchorAt(prior),priorRaw=chaseCamera({position:prior.p,tangent:prior.t,view,rearView:false,orbit:{yaw:yaw+.6,pitch}}).position,priorSafe=checked(priorAnchor,priorRaw),final=checked(anchor,smooth(priorSafe,safe,60));inspect(tuple(anchor),tuple(final),label+'/interpolated');densePoses++;
   }
  }
 }
 assert.equal(densePoses,denseStations*3*2*97);console.log(JSON.stringify({stage:baseline?'baseline':'candidate',phase:'dense-local',denseStations,densePoses,inspections,witnesses:witnesses.length,newWitnesses:newWitnesses.length}));
 records.begin('local-live-30-60-144hz-forward-reverse');let movingFrames=0,movingRuns=0,previousFrames=0;const runDetails:any[]=[];
 for(const w of local.windows)for(const reverse of [false,true])for(const lane of local.laneFractions)for(const hz of local.ratesHz){
  const edge=course.edges[w.edge],from=Math.max(0,w.from-local.windowExpansionMetres),to=Math.min(edge.length,w.to+local.windowExpansionMetres),count=Math.ceil((to-from)/(local.speedMetresPerSecond/hz));let previous:CameraPoint|undefined;movingRuns++;runDetails.push({region:w.id,edge:w.edge,from,to,reverse,lane,hz,frames:count+1});
  for(let i=0;i<=count;i++){const u=i/count,s=reverse?to-(to-from)*u:from+(to-from)*u,f=edge.sample(s,lane*edge.laneLimitAt(s)),anchor=anchorAt(f),raw=chaseCamera({position:f.p,tangent:f.t,view:u<.35?0:1,rearView:u>=.45&&u<.65,orbit:{yaw:u<.2?0:Math.PI*Math.sin((u-.2)/.8*Math.PI*2),pitch:u<.2?0:.25+.53*Math.sin(u*Math.PI*2)}}).position,safe=checked(anchor,raw),last=previous??safe,final=checked(anchor,smooth(last,safe,hz)),label=`live/${w.id}/${reverse}/${lane}/${hz}/${i}`;
   inspect(tuple(anchor),tuple(final),label+'/boom');inspect(tuple(last),tuple(final),label+'/movement',false);if(previous)previousFrames++;previous=final;movingFrames++;
  }
 }
 assert.equal(movingRuns,54);assert.equal(previousFrames,movingFrames-movingRuns,'Real prior final pose propagates through every view/rear/orbit transition');
 return{scope:'Additional independent actual-triangle finite capsule and moving-segment checks; no pixels/GPU/FPS claim',strictMarginMetres:.3,frozenViews,currentChases,denseStations,densePoses,stationDetails,movingFrames,movingRuns,previousFrames,runDetails,inspections,retractions,forwardRetractions,witnesses,newWitnesses,...(baseline?{failures}:{})};
}
/** Shared oracle name for independently authored Garden mutation sentinels. */
export const inspectGardenBoom=inspectGardenEnrichmentBoom;
