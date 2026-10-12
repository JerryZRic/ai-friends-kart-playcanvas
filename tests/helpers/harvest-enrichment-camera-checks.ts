/** Additive targeted matrix; original >60k general/barn and46656 frame gates stay intact. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HARVEST_COURSE} from '../../src/maps/harvest';
import type {HarvestSceneGeometry} from '../../src/harvest-scenery';
import {chaseCamera} from '../../src/race-camera';
import {safeLandCamera,type CameraPoint} from '../../src/land-camera';
import {MeshOracle,tuple,type V} from './emitted-scene-oracle';
import {harvestDigest as digest} from './harvest-enrichment-contract';
import {inspectHarvestBoom,harvestFaceKey,harvestWitnessKey,inheritedHarvestCameraWitness,harvestCameraOracleSentinels} from './harvest-enrichment-camera-oracle';
export function harvestCameraChecks(g:HarvestSceneGeometry,mesh:MeshOracle,baseline:boolean,old?:any){
 harvestCameraOracleSentinels();
 const manifest=JSON.parse(readFileSync('docs/harvest-enrichment-cameras.json','utf8')),views=manifest.views;
 assert.equal(manifest.baselineSourceCommit,'15db9eb703aeed462a931b9a743c22690656c0a6');assert.equal(views.length,34);assert.equal(Object.keys(manifest.catalogViews).length,5);
 const receipt=JSON.parse(readFileSync('tests/fixtures/harvest-enrichment-protected.json','utf8')),keys=['name','projection','sensorFit','sensorWidthMillimetres','sensorHeightMillimetres','lensMillimetres','verticalFovDegrees','orthographicScaleMetres','clipStart','clipEnd','resolution','samples','sourceEye','sourceTarget','cameraPositionBlender','cameraQuaternionBlender','roadEdge','roadDistanceMetres','sourceRoad','sourceAnchor','sourceDesiredEye'],cameraView=(v:any)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(v,k)).map(k=>[k,v[k]])),frozen={render:manifest.render,lighting:manifest.lighting,views:views.map(cameraView),catalogViews:manifest.catalogViews.map(cameraView)},viewDigest=digest(frozen);
 assert.equal(viewDigest,'58ee0ddf647e6d0a4420aa7cd63f22c192ff5d6287e927a62040a1781000ecd3','Original frozen cameras, lights, samples, FOV and exposure cannot be re-targeted');assert.deepEqual(frozen,receipt.frozenCameraContract);
 const faceOccurrences=new Map<string,number>(),faceKeys=mesh.triangles.map(q=>{const k=harvestFaceKey(q),n=faceOccurrences.get(k)??0;faceOccurrences.set(k,n+1);return k+':'+n;});
 if(!baseline)assert.equal(viewDigest,old.viewDigest,'Every original frozen eye/target/normal view and all catalog poses stay exact');
 const oldFaces=new Set<string>(old?.faceKeys??[]),changed=new Set(mesh.triangles.filter(q=>!oldFaces.has(faceKeys[q.id])).map(q=>q.id));
 const failures:Record<string,number>={},witnesses:any[]=[],newWitnesses:any[]=[],poses:Record<string,{a:V;b:V}>={};let inspections=0,retractions=0;
 const inspect=(a:V,b:V,label:string)=>{assert.ok([...a,...b].every(Number.isFinite));inspections++;if(baseline)poses[label]={a,b};else assert.ok(old.poses[label],'Targeted poses retain baseline labels');inspectHarvestBoom(mesh,a,b,({triangle:q,gap,kind})=>{const key=harvestWitnessKey(label,kind,faceKeys[q.id],a,b),w={label,kind,gap,faceKey:faceKeys[q.id],batch:q.batch,indexStart:q.indexStart,vertices:[q.a,q.b,q.c],a,b};failures[key]=gap;witnesses.push(w);if(!baseline&&!inheritedHarvestCameraWitness(changed.has(q.id),key,gap,old.failures))newWitnesses.push(w);});};
 // A forward road-eye view has no third-person boom. Its eye is checked as a
 // point capsule; camera-to-look rays are not misrepresented as camera booms.
 for(const view of views){assert.equal(view.verticalFovDegrees,56);assert.deepEqual(view.resolution,[960,540]);inspect(view.sourceAnchor??view.sourceEye,view.sourceEye,'frozen/'+view.name);}
 const orientations=[...Array.from({length:8},(_,i)=>[-.28,0,.4,.78].map(pitch=>({yaw:-Math.PI+i*Math.PI/4,pitch,rearView:false}))).flat(),{yaw:0,pitch:0,rearView:true}],stations=views.filter((v:any)=>v.name.startsWith('harvest-chase-'));
 assert.equal(stations.length,15);let targetedPoses=0;
 const anchorAt=(f:any):CameraPoint=>({x:f.p.x,y:f.p.y+1.35,z:f.p.z}),smooth=(a:CameraPoint,b:CameraPoint):CameraPoint=>{const alpha=1-Math.exp(-8/60);return{x:a.x+(b.x-a.x)*alpha,y:a.y+(b.y-a.y)*alpha,z:a.z+(b.z-a.z)*alpha};};
 for(const station of stations){const edge=HARVEST_COURSE.edges[station.roadEdge],s=station.roadDistanceMetres;
  for(const lane of [-1,0,1])for(const view of [0,1])for(const {yaw,pitch,rearView}of orientations){const f=edge.sample(s,lane*edge.laneLimitAt(s)),anchor=anchorAt(f),raw=chaseCamera({position:f.p,tangent:f.t,view,rearView,orbit:{yaw,pitch}}).position,safe=safeLandCamera(anchor,raw,g.cameraObstacles),label=`targeted/${station.name}/${lane}/${view}/${yaw}/${pitch}/${rearView}`;
   if(Math.hypot(safe.x-raw.x,safe.y-raw.y,safe.z-raw.z)>.01)retractions++;inspect(tuple(anchor),tuple(safe),label+'/safe');
   const priorS=Math.max(0,s-2.4),prior=edge.sample(priorS,lane*Math.max(0,edge.laneLimitAt(priorS)-.25)),priorAnchor=anchorAt(prior),priorRaw=chaseCamera({position:prior.p,tangent:prior.t,view,rearView:false,orbit:{yaw:yaw+.6,pitch}}).position,priorSafe=safeLandCamera(priorAnchor,priorRaw,g.cameraObstacles),final=safeLandCamera(anchor,smooth(priorSafe,safe),g.cameraObstacles);inspect(tuple(anchor),tuple(final),label+'/interpolated');targetedPoses++;
  }
 }
 assert.equal(targetedPoses,2970);assert.equal(inspections,5974);
 return{viewDigest,targetedPoses,inspections,retractions,witnesses,newWitnesses,...(baseline?{faceKeys,failures,poses}:{})};
}
