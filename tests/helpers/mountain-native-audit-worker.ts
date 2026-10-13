import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {nativeSourceHashes,nativeResources,nativePosePlan,nativeMeshBounds,NATIVE_RACER_MESH_BOUNDS,poseLine,type NativePartition} from './mountain-native-partitions';
import * as pc from 'playcanvas';
import {runGameScenario} from './gameplay-scenario';
import {MeshOracle,segmentTriangleDistance,tuple,type V} from './emitted-scene-oracle';
import {intersects,actualWorldGeometry,triangleMeshContact} from './native-mesh-oracle';
import {placeLandFrame} from '../../src/land-course';
import {resetLandSupport} from '../../src/land-track';
import {resetPickup,setPickupDisplay} from '../../src/item-pickups';
import {getNpcPresets} from '../../src/kart-presets';
import {mountainSupportWitnesses} from './mountain-baseline-contract';
import {steeringYaw} from '../../src/vehicle-controls.js';
import {chaseCamera} from '../../src/race-camera';

const auditDir=process.env.MOUNTAIN_AUDIT_DIR;
const sourceHashes=nativeSourceHashes;
const initialHashes=sourceHashes();after(()=>assert.deepEqual(sourceHashes(),initialHashes,'native source changed during the run'));
const partition:NativePartition=JSON.parse(process.env.MOUNTAIN_NATIVE_PARTITION!);
assert.ok(partition&&['mesh','camera','capture'].includes(partition.kind),'worker requires an explicit bounded partition');
assert.equal(Boolean(process.env.MOUNTAIN_NATIVE_GOLDEN_CAPTURE),partition.kind==='capture','capture is explicit and cannot replace an audit partition');
const geometryWitness=process.env.MOUNTAIN_NATIVE_GEOMETRY_WITNESS===undefined?null:Number(process.env.MOUNTAIN_NATIVE_GEOMETRY_WITNESS);
const geometryWitnessCount=Number(process.env.MOUNTAIN_NATIVE_GEOMETRY_WITNESS_COUNT??1);
if(geometryWitness!==null)assert.ok(partition.kind==='mesh'&&Number.isInteger(geometryWitness)&&geometryWitness>=partition.start&&Number.isInteger(geometryWitnessCount)&&geometryWitnessCount>0&&geometryWitness+geometryWitnessCount<=partition.end,'geometry witnesses belong to the asserted shard');
async function auditMountainNative({qa,game,track,app,key,canvas,docEvents,events,t,touch,element,control,geometry}:any){
 const capture=process.env.MOUNTAIN_NATIVE_GOLDEN_CAPTURE;
 if(capture){writeFileSync(capture,JSON.stringify({baseCommit:'769911cc562b9330a57f043e9a7f9a2f0a976dac',scope:'All-frame complete player/NPC physical/control/checkpoint/item digest with full 90-frame samples. Camera output intentionally excluded.',control},null,2)+'\n');t.diagnostic(JSON.stringify({capturedFrames:control.frames,sha256:control.sha256,sourceHashes:sourceHashes(),resources:nativeResources()}));return;}
 const golden=JSON.parse(readFileSync(new URL('../fixtures/mountain-native-control-baseline.json',import.meta.url),'utf8'));
 // This historical invariance proof uses the entire hash-verified pre-v1.0
 // source graph; current 1.2 pickup behavior is exercised by mountain-gameplay.
 // The pristine fixture was captured through JSON, including inactive dynamic
 // pickup cooldown Infinity encoded as null. Compare the same representation;
 // the complete all-frame and sample-stream digests remain independently exact.
 const compactControl=JSON.parse(JSON.stringify({frames:control.frames,sha256:control.sha256,sampleCount:control.samples.length,samplesSHA256:createHash('sha256').update(JSON.stringify(control.samples)).digest('hex'),first:control.samples[0],finish:control.samples.at(-1)}));
 assert.deepEqual(compactControl,golden.control,'enriched scenery with exact historical runtime preserves the complete deterministic player/NPC/control/checkpoint/item result, not just a lap clock');
 assert.ok(geometry,'audit observes the exact current production geometry');assert.equal(qa.course.cameraObstacles,geometry.cameraObstacles);
 globalThis.gc?.();
 const mesh=new MeshOracle(geometry.batches);
 globalThis.gc?.();
 qa.set({state:'running',held:null,boost:0,slow:0,hit:0});
 const byBatch=new Map<string,any[]>();for(const c of geometry.components){const list=byBatch.get(c.batch)??[];list.push(c);byBatch.set(c.batch,list);}
 const owner=(triangle:any)=>(byBatch.get(triangle.batch)??[]).find(c=>triangle.indexStart>=c.indexStart&&triangle.indexStart<c.indexEnd);
 const intended=mountainSupportWitnesses(track);
 const racers=[{id:game.getState().selectedDriverId,mesh:qa.player()},...qa.bots()],presets=getNpcPresets('coast',20261010);
 assert.equal(racers.length,6);for(const bot of game.getState().npcBuilds)assert.deepEqual(bot.build,presets.find(p=>p.characterId===bot.id)!.build);
 const report:any={sourceHashes:sourceHashes(),controls:{frames:control.frames,sha256:control.sha256,samples:control.samples.length},assemblies:0,meshBounds:0,unionOnlyOverlaps:0,individualBoundOverlaps:0,exactRefinements:0,sourceCandidates:0,supportContacts:0,supportActualIntersections:0,supportMinimumPlaneDistance:Infinity,failures:0,intrusions:[],witnesses:[],poses:[],camera:{views:0,smoothedFrames:0,failures:[],minimumBoom:Infinity,minimumMotion:Infinity},limitations:['Six authored native assemblies and sampled animation states only, not arbitrary custom parts or every animation frame','CPU NullGraphicsDevice integration; no native GPU pixels or FPS claim']};
 const note=(witness:any)=>{if(report.witnesses.length<160)report.witnesses.push(witness);};
 const flush=(phase:string)=>{report.phase=phase;report.resources=nativeResources();if(auditDir){mkdirSync(auditDir,{recursive:true});writeFileSync(resolve(auditDir,partition.id+'-progress.json'),JSON.stringify(report,null,2)+'\n');}};
 const plan=nativePosePlan(track,racers.map(r=>r.id));
 assert.equal(plan.length,22734,'the complete original assembled-pose matrix is retained');
 const start=partition.kind==='mesh'?partition.start:0,end=partition.kind==='mesh'?partition.end:plan.length;
 assert.ok(Number.isInteger(start)&&Number.isInteger(end)&&start>=0&&end<=plan.length&&end>start);
 if(partition.kind==='mesh')assert.ok(end-start<=432,'each mesh process has a bounded pose allocation lifetime');
 const coverage=createHash('sha256');
 report.partition=partition;report.expectedAssemblies=partition.kind==='mesh'?end-start:0;
 report.replayedAssemblies=0;report.replayWitnesses=[];report.coverage={start,end,sha256:'',racerIds:racers.map(r=>r.id)};
 flush('native-mesh-start');
 // Replay every prior controller/placement/skin update in original order. Only
 // the expensive geometry assertions are partitioned: animation history is not
 // reset at the boundary, and the camera worker sees the original final poses.
 for(const pose of plan.slice(0,end)){
   const {index,d,lane,yaw,racerIndex}=pose,racer=racers[racerIndex],frame=track.sample(d,lane);
   assert.equal(yaw,steeringYaw(-Math.sign(yaw),30,yaw!==0));
   qa.controllers.get(racer.id).update(.25,-Math.sign(yaw),false,30);placeLandFrame(racer.mesh,frame,yaw);
   const instances:pc.MeshInstance[]=racer.mesh.findComponents('render').flatMap((r:any)=>r.meshInstances);
   app.renderer.updateCpuSkinMatrices(instances);
   if((index<start||partition.kind==='camera')?index%1026===0:(index-start)%54===0)globalThis.gc?.();
   if(partition.kind!=='mesh'||index<start){report.replayedAssemblies++;continue;}
   const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],parts=instances.map((instance,index)=>{const lo=instance.aabb.getMin().toArray(),hi=instance.aabb.getMax().toArray();for(let k=0;k<3;k++){min[k]=Math.min(min[k],lo[k]);max[k]=Math.max(max[k],hi[k]);}return{index,name:instance.node.name,min:lo,max:hi};});
   assert.equal(parts.length,NATIVE_RACER_MESH_BOUNDS[racer.id],'all original parts remain in this native racer assembly');
   assert.ok(parts.length&&[...min,...max].every(Number.isFinite));report.meshBounds+=parts.length;
   const transformed=new Map<number,ReturnType<typeof actualWorldGeometry>>();
   if(geometryWitness!==null&&index>=geometryWitness&&index<geometryWitness+geometryWitnessCount){
    // Optional bounded overlap probe: hash every actual refreshed weighted
    // world vertex and index, including parts whose AABBs miss the scenery.
    const weighted=createHash('sha256');
    for(const [part,instance]of instances.entries()){
     const actual=actualWorldGeometry(instance);transformed.set(part,actual);
     weighted.update(JSON.stringify({part,name:instance.node.name,bounds:parts[part]}));
     weighted.update(Buffer.from(actual.vertices.buffer,actual.vertices.byteOffset,actual.vertices.byteLength));
     weighted.update(Buffer.from(new Uint32Array(actual.indices).buffer));
    }
    report.replayWitnesses.push({index,racer:racer.id,parts:instances.length,weightedWorldGeometrySHA256:weighted.digest('hex')});
   }
   for(const triangle of mesh.query(min,max)){
    if(triangle.min[1]>max[1]||triangle.max[1]<min[1])continue;report.sourceCandidates++;
    const points=[triangle.a,triangle.b,triangle.c];if(!intersects(points,min,max))continue;
    const hits=parts.filter(p=>intersects(points,p.min,p.max));if(!hits.length){report.unionOnlyOverlaps++;continue;}report.individualBoundOverlaps++;
    const c=owner(triangle),witness={racer:racer.id,d,lane,yaw,triangle:triangle.id,batch:triangle.batch,component:c?.kind,parts:hits.map(p=>p.name)};
    const support=intended.records.get(intended.key(points));
    // Source provenance alone is not a blanket road exemption. A support face
    // must belong to this nearby continuous route interval, and every individual
    // bound overlap is refined using the actual refreshed weighted mesh below.
    const wrapped=((d%track.length)+track.length)%track.length,sourceMid=support?(support.distance+support.next)/2:0,routeGap=support?Math.min(Math.abs(wrapped-sourceMid),Math.abs(wrapped-sourceMid-track.length),Math.abs(wrapped-sourceMid+track.length)):Infinity;
    const actualExtent=Math.hypot(...max.map((x,k)=>x-min[k])),localSupport=!!support&&routeGap<=actualExtent+2*track.length/960;
    if(localSupport)report.supportContacts++;
    for(const part of hits){let actual=transformed.get(part.index);if(!actual){actual=actualWorldGeometry(instances[part.index]);transformed.set(part.index,actual);}
     const result=triangleMeshContact(points,actual);report.exactRefinements++;
     if(localSupport){report.supportActualIntersections+=result.intersections;report.supportMinimumPlaneDistance=Math.min(report.supportMinimumPlaneDistance,result.minPlaneDistance);note({...witness,part:part.name,classification:result.intersections?'Actual contact with the exact preserved local driving surface':'Conservative local driving-surface bound contact; actual weighted triangles are disjoint',sourceWitness:support,routeGap,actualExtent,result});continue;}
     if(result.intersections){report.failures++;const intrusion={...witness,part:part.name,classification:'Actual native geometry penetration',result,points,...(support?{sourceWitness:support,routeGap,actualExtent,reason:'source road belongs to a different route interval, so it is an obstruction here'}:{})};if(report.intrusions.length<120)report.intrusions.push(intrusion);note(intrusion);}
     else if(report.witnesses.length<80)note({...witness,part:part.name,classification:'Conservative individual bound overlap; exact weighted/skinned triangles are disjoint',result});
    }
   }
   report.assemblies++;coverage.update(poseLine(pose));
   if(report.assemblies%54===0)flush('native-mesh-running');
   if(report.poses.length<36)report.poses.push({index,racer:racer.id,d,lane,yaw,min,max,parts:parts.length});
 }
 report.coverage.sha256=coverage.digest('hex');
 if(geometryWitness!==null)assert.equal(report.replayWitnesses.length,geometryWitnessCount,'every requested weighted geometry witness is actually evaluated');
 assert.equal(report.assemblies,report.expectedAssemblies,'every assigned pose is asserted exactly once');
 assert.equal(report.meshBounds,partition.kind==='mesh'?nativeMeshBounds(plan.slice(start,end)):0,'all original native mesh bounds are retained per racer/pose');
 flush('native-mesh-complete');
 if(partition.kind==='mesh'){
  assert.equal(report.failures,0,'actual native kart/driver penetration: '+JSON.stringify(report.intrusions.slice(0,10)));
  writeFileSync(process.env.MOUNTAIN_NATIVE_RESULT!,JSON.stringify(report,null,2)+'\n');
  return;
 }
 const inspectBoom=(anchor:V,camera:V,label:string)=>{for(const tri of mesh.query(anchor,camera,.3)){if(tri.min[1]>Math.max(anchor[1],camera[1])+.3||tri.max[1]<Math.min(anchor[1],camera[1])-.3)continue;const distance=segmentTriangleDistance(anchor,camera,tri);report.camera.minimumBoom=Math.min(report.camera.minimumBoom,distance);if(distance<.3-1e-6&&report.camera.failures.length<60)report.camera.failures.push({label,triangle:tri.id,batch:tri.batch,distance,anchor,camera});}};
 // Native game camera calls the actual smoothing and safety code, never a test reimplementation.
 for(const section of track.sections)for(const sign of [-1,0,1])for(const view of [0,1])for(const rear of [false,true]){
  const d=(section.from+section.to)/2,lane=sign*track.laneLimitAt(d),frame=track.sample(d,lane);
  qa.set({pos:d,lane,speed:0,steerVis:0});if(game.getState().camera!==view){key('keydown','KeyZ');key('keyup','KeyZ');}
  if(rear)canvas.emit('mousedown',{button:2});else docEvents.mouseup?.forEach((fn:any)=>fn({button:2}));qa.orbit.recenter(true);qa.draw(1);
  assert.ok(qa.player().getPosition().distance(frame.p)<.13);const desired=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:rear,orbit:{yaw:0,pitch:0}}).position;
  const camera=tuple(qa.world.camera.getPosition()),anchor=[frame.p.x,frame.p.y+1.35,frame.p.z];inspectBoom(anchor,camera,`${section.name}/${sign}/${view}/${rear}`);
  report.camera.views++;if(!rear&&sign===0)assert.ok(Math.hypot(camera[0]-desired.x,camera[1]-desired.y,camera[2]-desired.z)<.1,'default middle-lane section view remains open');
 }
 docEvents.mouseup?.forEach((fn:any)=>fn({button:2}));
 for(const hz of [30,60,144])for(const sign of [-1,0,1])for(const [from,to]of [[.35,.47],[.86,1]]){
  let previous:V|null=null;
  for(let d=track.length*from;d<=track.length*to;d+=45/hz){const lane=sign*track.laneLimitAt(d),frame=track.sample(d,lane);qa.set({pos:d,lane,speed:0,steerVis:0});qa.draw(previous?1/hz:1);const camera=tuple(qa.world.camera.getPosition());inspectBoom([frame.p.x,frame.p.y+1.35,frame.p.z],camera,`native-smooth/${hz}/${d}/${sign}`);
   if(previous)for(const tri of mesh.query(previous,camera,.3)){if(tri.min[1]>Math.max(previous[1],camera[1])+.3||tri.max[1]<Math.min(previous[1],camera[1])-.3)continue;const gap=segmentTriangleDistance(previous,camera,tri);report.camera.minimumMotion=Math.min(report.camera.minimumMotion,gap);if(gap<.3-1e-6&&report.camera.failures.length<60)report.camera.failures.push({label:'actual camera motion',hz,d,sign,triangle:tri.id,batch:tri.batch,gap});}previous=camera;report.camera.smoothedFrames++;if(report.camera.smoothedFrames%540===0)globalThis.gc?.();
  }
 }
 flush('native-camera-complete');
 // Actual reset support retains unwrapped distance and correct viaduct altitude.
 for(const fraction of [.405,.91])for(const lap of [0,1,2]){const d=track.length*(lap+fraction),support=resetLandSupport(track,d),expected=track.sample(d);assert.equal(support.distance,d);assert.ok(support.p.clone().sub(expected.p).dot(expected.normal)>.59999);}
 game.start();for(let i=0;i<300&&game.getState().state!=='running';i++)qa.advanceFrame(1/60);assert.equal(game.getState().state,'running');qa.set({noBots:true});
 const box=qa.boxes().find((b:any)=>!b.dynamic);resetPickup(box);setPickupDisplay(box,'shield');qa.keys.KeyW=true;for(let f=0;f<900&&game.getState().pos<box.d-5;f++)qa.update(1/60);qa.keys.KeyW=false;qa.set({lane:box.lateral,speed:30,held:null});for(let f=0;f<60&&game.getState().held===null;f++)qa.update(1/60);assert.equal(game.getState().held,'shield');assert.equal(box.cool,8);game.pause();qa.update(9);assert.equal(box.cool,8);game.pause();game.useItem();assert.equal(game.getState().shield,6);qa.keys.KeyW=true;for(let i=0;i<4;i++)qa.update(.25);qa.keys.KeyW=false;qa.set({speed:0});for(let i=0;i<27;i++)qa.update(.25);assert.equal(box.cool,.25);assert.equal(box.mesh.enabled,false);qa.update(.25);assert.equal(box.cool,0);assert.equal(box.mesh.enabled,true,'unchanged fixed pickup becomes available after exactly eight active seconds');
 for(const button of touch){button.emit('pointerdown',{pointerId:71});assert.equal(qa.keys[button.dataset.key],true);button.emit('pointercancel',{pointerId:71});assert.equal(qa.keys[button.dataset.key],false);}
 assert.match(element('raceChangeMap').href,/map=mountain/);assert.equal(await game.retryLoading(),false);report.controls.pauseItemsTouchRetryNavigation=true;
 report.resources=nativeResources();
 if(auditDir){mkdirSync(auditDir,{recursive:true});writeFileSync(resolve(auditDir,partition.id+'-report.json'),JSON.stringify(report,null,2)+'\n');}
 t.diagnostic(JSON.stringify({controls:report.controls,assemblies:report.assemblies,meshBounds:report.meshBounds,sourceCandidates:report.sourceCandidates,supportContacts:report.supportContacts,supportActualIntersections:report.supportActualIntersections,supportMinimumPlaneDistance:report.supportMinimumPlaneDistance,exactRefinements:report.exactRefinements,failures:report.failures,camera:report.camera,resources:report.resources,limitations:report.limitations}));
 assert.equal(report.failures,0,'actual native kart/driver penetration: '+JSON.stringify(report.intrusions.slice(0,10)));
 assert.equal(report.camera.failures.length,0,'actual native camera failures: '+JSON.stringify(report.camera.failures.slice(0,10)));
 writeFileSync(process.env.MOUNTAIN_NATIVE_RESULT!,JSON.stringify(report,null,2)+'\n');
}
test(`Mountain native ${partition.id}`,t=>runGameScenario({name:'mountain-enrichment',cancelDuringParts:false,mountain:true,mountainAudit:auditMountainNative},t));
