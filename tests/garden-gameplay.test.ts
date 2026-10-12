import {gardenNativeBlockerComponents} from './helpers/garden-enrichment-native-provenance';
import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import * as pc from 'playcanvas';
import {runGameScenario} from './helpers/gameplay-scenario';
import {getNpcPresets} from '../src/kart-presets';
import {GARDEN_ARBOR} from '../src/maps/garden';
import {createCursor,createRouteProgress,resetCursor,sampleCursor} from '../src/land-routes';
import {safeLandCamera,cameraMeshCandidateIds} from '../src/land-camera';
import {chaseCamera} from '../src/race-camera';
import {placeLandFrame} from '../src/land-course';

/** Exact triangle/AABB SAT. Whole-racer union is broad phase only; every
 * intersecting source triangle is retested against the unchanged individual
 * rendered kart AND driver mesh-instance bounds, including their empty corners.
 * This certifies these conservative real bounds, not arbitrary mixed builds. */
function intersects(triangle:readonly (readonly number[])[],minimum:number[],maximum:number[]) {
 const center=minimum.map((v,i)=>(v+maximum[i])/2),half=minimum.map((v,i)=>(maximum[i]-v)/2);
 const v=triangle.map(p=>p.map((n,i)=>n-center[i])),sub=(a:number[],b:number[])=>a.map((n,i)=>n-b[i]);
 const cross=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a:number[],b:number[])=>a.reduce((sum,n,i)=>sum+n*b[i],0);
 const edges=[sub(v[1],v[0]),sub(v[2],v[1]),sub(v[0],v[2])],axes=[[1,0,0],[0,1,0],[0,0,1],cross(edges[0],edges[1]),...edges.flatMap(edge=>[[1,0,0],[0,1,0],[0,0,1]].map(axis=>cross(edge,axis)))];
 return axes.every(axis=>{const projection=v.map(p=>dot(p,axis)),radius=half.reduce((sum,h,i)=>sum+h*Math.abs(axis[i]),0);return Math.min(...projection)<=radius+1e-8&&Math.max(...projection)>=-radius-1e-8;});
}
const distance=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

function actualWorldGeometry(instance:pc.MeshInstance){
 assert.equal(instance.morphInstance,null,'this exact native certificate expects the original non-morphed driver assets');
 const positions:number[]=[],indices:number[]=[],weights:number[]=[],joints:number[]=[];instance.mesh.getPositions(positions);instance.mesh.getIndices(indices);
 if(instance.skinInstance){instance.mesh.getVertexStream(pc.SEMANTIC_BLENDWEIGHT,weights);instance.mesh.getVertexStream(pc.SEMANTIC_BLENDINDICES,joints);}
 const weightFormat=instance.mesh.vertexBuffer.format.elements.find(e=>e.name===pc.SEMANTIC_BLENDWEIGHT),divisor=weightFormat?.normalize?(weightFormat.dataType===pc.TYPE_UINT8?255:weightFormat.dataType===pc.TYPE_UINT16?65535:1):1;
 const world=instance.node.getWorldTransform(),vertices=new Float64Array(positions.length),point=new pc.Vec3(),local=new pc.Vec3(),weighted=new pc.Vec3();
 for(let i=0;i<positions.length/3;i++){
  point.set(positions[i*3],positions[i*3+1],positions[i*3+2]);local.set(0,0,0);
  if(instance.skinInstance){let sum=0;for(let k=0;k<4;k++){const weight=weights[i*4+k]/divisor;sum+=weight;if(weight)local.add(instance.skinInstance.matrices[joints[i*4+k]].transformPoint(point,weighted).mulScalar(weight));}assert.ok(Math.abs(sum-1)<1e-5,'exact original vertex weights sum to one');}
  else local.copy(point);
  world.transformPoint(local,weighted);vertices[i*3]=weighted.x;vertices[i*3+1]=weighted.y;vertices[i*3+2]=weighted.z;
 }
 return {vertices,indices};
}
function triangleMeshContact(triangle:readonly (readonly number[])[],mesh:{vertices:Float64Array;indices:number[]}){
 const sub=(a:readonly number[],b:readonly number[])=>a.map((n,i)=>n-b[i]),cross=(a:readonly number[],b:readonly number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a:readonly number[],b:readonly number[])=>a.reduce((sum,n,i)=>sum+n*b[i],0);
 const normal=cross(sub(triangle[1],triangle[0]),sub(triangle[2],triangle[0]));if(normal[1]<0)normal.forEach((v,i)=>normal[i]=-v);const length=Math.hypot(...normal);
 let minPlaneDistance=Infinity,maxPlaneDistance=-Infinity,testedTriangles=0,intersections=0;for(let i=0;i<mesh.vertices.length;i+=3){const d=((mesh.vertices[i]-triangle[0][0])*normal[0]+(mesh.vertices[i+1]-triangle[0][1])*normal[1]+(mesh.vertices[i+2]-triangle[0][2])*normal[2])/length;minPlaneDistance=Math.min(minPlaneDistance,d);maxPlaneDistance=Math.max(maxPlaneDistance,d);}
 if(minPlaneDistance<=1e-7&&maxPlaneDistance>=-1e-7)for(let i=0;i<mesh.indices.length;i+=3){
  const t=mesh.indices.slice(i,i+3).map(k=>[mesh.vertices[k*3],mesh.vertices[k*3+1],mesh.vertices[k*3+2]]),min=[0,1,2].map(k=>Math.min(...t.map(p=>p[k]))),max=[0,1,2].map(k=>Math.max(...t.map(p=>p[k])));if(!intersects(triangle,min,max))continue;testedTriangles++;
  const a=[sub(triangle[1],triangle[0]),sub(triangle[2],triangle[1]),sub(triangle[0],triangle[2])],b=[sub(t[1],t[0]),sub(t[2],t[1]),sub(t[0],t[2])],na=cross(a[0],a[1]),nb=cross(b[0],b[1]);
  const axes=[na,nb,...a.flatMap(x=>b.map(y=>cross(x,y))),...a.map(e=>cross(na,e)),...b.map(e=>cross(nb,e))];
  if(axes.every(axis=>{if(Math.hypot(...axis)<1e-10)return true;const x=triangle.map(p=>dot(p,axis)),y=t.map(p=>dot(p,axis)),epsilon=1e-7*Math.hypot(...axis);return Math.max(...x)>=Math.min(...y)-epsilon&&Math.max(...y)>=Math.min(...x)-epsilon;}))intersections++;
 }
 return {vertexCount:mesh.vertices.length/3,meshTriangleCount:mesh.indices.length/3,minPlaneDistance,maxPlaneDistance,testedTriangles,intersections};
}

async function auditGardenNative({qa,game,course,routes,id,key,canvas,docEvents,t,geometry}:any) {
 const obstacles=qa.course.cameraObstacles,solids=obstacles.filter(o=>o.triangles?.length),arbor=solids.filter(o=>o.kind.includes('arbor'));
 assert.ok(arbor.length>0,'open arbor retains actual emitted triangle blockers');
 assert.ok(solids.some(o=>o.kind.includes('other')||o.kind.includes('rail')),'rails and supports are included in actual solid geometry');
 assert.equal(geometry.cameraObstacles,obstacles,'native game and audit inspect the SAME emitted source object');
 const componentRanges=new Map<any,any[]>(),certifiedBlockerComponents=gardenNativeBlockerComponents(geometry);
 for(const solid of solids){
  const components=certifiedBlockerComponents.get(solid)!;
  let from=0;const ranges=components.map(component=>{const range={from,to:from+(component.indexEnd-component.indexStart)/3,component};from=range.to;return range;});
  assert.equal(from,solid.triangles.length,solid.kind+' exact source component coverage');componentRanges.set(solid,ranges);
 }
 const expected=getNpcPresets('coast',20261010),racers=[{id,mesh:qa.player()},...qa.bots()];
 assert.equal(racers.length,6);assert.deepEqual(game.getState().kartBuild,expected.find(p=>p.characterId===id)!.build);
 for(const bot of game.getState().npcBuilds)assert.deepEqual(bot.build,expected.find(p=>p.characterId===bot.id)!.build);
 let assemblies=0,meshBounds=0,unionOnlyOverlaps=0,views=0,interpolationSamples=0;
 const measuredBounds:any[]=[],intrusions:any[]=[],supportBoundOverlaps:any[]=[],surfaceBoundOverlaps:any[]=[],underfaceNarrowPhase:any[]=[],claudeUnderfaceGeometry:any[]=[],cameraRuns:any[]=[];
 const poses:{edgeId:'start'|'alley'|'boulevard'|'finish';s:number}[]=[];
 for(const edge of Object.values(course.edges) as any[]) {
  const stations=new Set<number>([0,edge.length*.13,edge.length*.31,edge.length*.54,edge.length*.75,edge.length*.96,edge.length]);
  for(let s=0;s<edge.length;s+=32)stations.add(s);
  if(edge.id==='alley')for(let s=GARDEN_ARBOR.physicalS[0]-20;s<=GARDEN_ARBOR.physicalS[1]+20;s+=4)stations.add(s);
  if(edge.id==='alley')GARDEN_ARBOR.supportStations.forEach(s=>stations.add(s));
  for(const s of [...stations].sort((a,b)=>a-b))poses.push({edgeId:edge.id,s});
 }
 for(const {edgeId,s} of poses)for(const sign of [-1,0,1])for(const yaw of [-.36,0,.36]) {
  const lane=sign*course.edges[edgeId].laneLimitAt(s),cursor={...createCursor(lane),edgeId,s,choiceByLap:{0:edgeId==='boulevard'?'boulevard' as const:'alley' as const}},frame=sampleCursor(course,cursor,lane);
  for(const racer of racers){routes.states.set(racer.id,createRouteProgress(cursor));if(racer.id!==id)Object.assign(racer,{total:routes.total(racer.id),lateral:lane,targetLane:lane,speed:0});}
  qa.set({pos:routes.total(id),lane,speed:0,boost:0,slow:0,hit:0,steerVis:yaw});qa.draw(0);
  for(const racer of racers) {
   // Any authored character can be selected as player. Shared placement applies
   // the legal full drift yaw to every unchanged native assembly, not a proxy.
   qa.controllers.get(racer.id).update(.25,-Math.sign(yaw),false,30);
   placeLandFrame(racer.mesh,frame,yaw);
   const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],parts:{name:string;min:number[];max:number[];instanceIndex:number}[]=[];
   const nativeInstances=racer.mesh.findComponents('render').flatMap(render=>render.meshInstances),transformed=new Map<pc.MeshInstance,{vertices:Float64Array;indices:number[]}>();
   // NullGraphicsDevice does not automatically render. Invoke the real engine's
   // pre-cull CPU skin update before asking for actual animated driver bounds.
   // Bounds are neither replaced nor shrunk; this is the renderer's own path.
   qa.app.renderer.updateCpuSkinMatrices(nativeInstances);
   for(const [instanceIndex,instance] of nativeInstances.entries()){ 
    const lo=instance.aabb.getMin().toArray(),hi=instance.aabb.getMax().toArray();meshBounds++;parts.push({name:instance.node.name,min:lo,max:hi,instanceIndex});
    for(let axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],lo[axis]);max[axis]=Math.max(max[axis],hi[axis]);}
   }
   assert.ok(parts.length>0&&[...min,...max].every(Number.isFinite));
   for(const solid of solids){
    if(min.some((v,k)=>v>solid.max[k])||max.some((v,k)=>v<solid.min[k]))continue;
    for(const index of cameraMeshCandidateIds(solid.triangles,{x:min[0],y:min[1],z:min[2]},{x:max[0],y:max[1],z:max[2]},0)){
     const triangle=solid.triangles[index];if(!intersects(triangle,min,max))continue;
     const hits=parts.filter(part=>intersects(triangle,part.min,part.max));
     if(hits.length){
      const range=componentRanges.get(solid)!.find(r=>index>=r.from&&index<r.to)!;assert.ok(range);
      const component=range.component,batch=geometry.batches.find(b=>b.name===component.batch),offset=component.indexStart+(index-range.from)*3;
      const emitted=batch.indices.slice(offset,offset+3).map(i=>batch.positions.slice(i*3,i*3+3));assert.deepEqual(emitted,triangle,'witness maps exactly to emitted source component');
      const witness={racer:racer.id,edgeId,s,lane,yaw,kind:solid.kind,component:component.kind,role:component.role,solid:component.solid,triangleIndex:index,triangle,parts:hits};
      if(component.kind==='source-exact-layer-owned-shoulders')supportBoundOverlaps.push({...witness,classification:'Source-authored drivable shoulder support; conservative mesh-bound contact is not an obstruction defect'});
      else if(component.kind==='start-line-original-garden-stone-inlay'||component.kind==='road-exposed-upward-coping'){
       assert.equal(component.role,'visual-coping');assert.equal(component.solid,false);
       surfaceBoundOverlaps.push({...witness,classification:'Intentional traversable thin pavement surface',sourceHeightOffset:component.kind.startsWith('start-line')?.033:.027});
      }else if(component.kind==='ground-road-thick-underfaces'){
       const checks=hits.map(part=>{const instance=nativeInstances[part.instanceIndex];let actual=transformed.get(instance);if(!actual){actual=actualWorldGeometry(instance);transformed.set(instance,actual);}return {part:part.name,...triangleMeshContact(triangle,actual)};});
       underfaceNarrowPhase.push({...witness,checks});
       if(checks.some(check=>check.intersections>0))intrusions.push({...witness,checks});
      }else intrusions.push(witness);
     }else unionOnlyOverlaps++;
    }
   }
   // Replay every pose implicated by the first unrefreshed-palette receipt,
   // plus all three yaw values, against actual weighted/skinned triangles.
   // The exact source underfaces are still present, never omitted or lowered.
   if(racer.id==='claude'&&edgeId==='finish'&&[608,640,672,768,800].includes(s)){
    for(const instance of nativeInstances.filter(instance=>instance.skinInstance)){
     let actual=transformed.get(instance);if(!actual){actual=actualWorldGeometry(instance);transformed.set(instance,actual);}
     const lo=instance.aabb.getMin().toArray(),hi=instance.aabb.getMax().toArray();
     assert.ok(actual.vertices.every((x,i)=>x>=lo[i%3]-1e-4&&x<=hi[i%3]+1e-4),'actual weighted vertices are enclosed by the unchanged refreshed PlayCanvas mesh bound');
     for(const face of geometry.roadUndersideFaces.filter(face=>face.edgeId===edgeId&&Math.abs(face.distance-s)<8)){
      const check=triangleMeshContact(face.points,actual),witness={id:racer.id,edgeId,s,lane,yaw,sourceDistance:face.distance,triangle:face.points,mesh:instance.node.name,...check};
      claudeUnderfaceGeometry.push(witness);assert.equal(check.intersections,0,'actual weighted Claude skin triangles must clear every nearby road underface');
     }
    }
   }
   const center=course.edges[edgeId].sample(s),origin=center.p.toArray();
   const range=(axis:pc.Vec3)=>{const direction=axis.toArray();return [Math.min(...parts.map(part=>direction.reduce((sum,n,k)=>sum+n*((n>=0?part.min[k]:part.max[k])-origin[k]),0))),Math.max(...parts.map(part=>direction.reduce((sum,n,k)=>sum+n*((n>=0?part.max[k]:part.min[k])-origin[k]),0)))];};
   measuredBounds.push({id:racer.id,edgeId,s,lane,yaw,min,max,instances:parts.length,lateral:range(center.n),longitudinal:range(center.t),normal:range(center.normal)});assemblies++;
  }
 }
 const boundSummary={assemblies,individualMeshBounds:meshBounds,unionOnlyOverlaps,maximumNormalTop:Math.max(...measuredBounds.map(r=>r.normal[1])),maximumLateralOutward:Math.max(...measuredBounds.map(r=>Math.max(-r.lateral[0],r.lateral[1]))),intrusionCount:intrusions.length,supportBoundOverlapCount:supportBoundOverlaps.length,surfaceBoundOverlapCount:surfaceBoundOverlaps.length,underfaceBoundOverlapCount:underfaceNarrowPhase.length,claudeActualUnderfaceChecks:claudeUnderfaceGeometry.length,claudeActualUnderfaceIntersections:claudeUnderfaceGeometry.reduce((n,r)=>n+r.intersections,0),underfaceActualTriangleIntersections:underfaceNarrowPhase.reduce((sum,r)=>sum+r.checks.reduce((n,c)=>n+c.intersections,0),0)};
 if(process.env.GARDEN_RUNTIME_EVIDENCE_DIR)writeFileSync(join(process.env.GARDEN_RUNTIME_EVIDENCE_DIR,'garden-native-assembly-bounds.json'),JSON.stringify({summary:boundSummary,measuredBounds,intrusions,supportBoundOverlaps,surfaceBoundOverlaps,underfaceNarrowPhase,claudeUnderfaceGeometry},null,2)+'\n');
 t.diagnostic(JSON.stringify({gardenNativeBoundCertificate:boundSummary,firstIntrusions:intrusions.slice(0,8)}));
 assert.equal(intrusions.length,0,'Actual unshrunk rendered mesh-instance bounds must clear all emitted obstruction triangles; drivable-support witnesses are retained separately, never shrink bounds or omit obstacles');
 const setPose=(s:number,lane:number)=>{
  const cursor={...createCursor(lane),edgeId:'alley' as const,s,choiceByLap:{0:'alley' as const}},reset=resetCursor(course,cursor);
  assert.equal(reset.edgeId,'alley');assert.equal(reset.s,s);assert.equal(reset.lateral,0);
  routes.states.set(id,createRouteProgress(cursor));qa.set({pos:routes.total(id),lane,speed:0,steerVis:0});return sampleCursor(course,cursor,lane);
 };
 for(let s=GARDEN_ARBOR.physicalS[0]-20;s<=GARDEN_ARBOR.physicalS[1]+20;s+=4)for(const sign of [-1,0,1])for(const view of [0,1])for(const rear of [false,true]){
  const lane=sign*course.edges.alley.laneLimitAt(s),frame=setPose(s,lane);
  if(game.getState().camera!==view){key('keydown','KeyZ');key('keyup','KeyZ');}
  if(rear)canvas.emit('mousedown',{button:2});else docEvents.mouseup?.forEach(fn=>fn({button:2}));
  qa.orbit.recenter(true);qa.draw(1);const actual=qa.world.camera.getPosition(),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z};
  const desired=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:rear,orbit:{yaw:0,pitch:0}}).position;
  assert.ok(distance(safeLandCamera(anchor,desired,arbor),desired)<1e-7,'actual member triangles retain the complete desired boom');
  assert.ok(distance(actual,desired)<.1,'actual native default/rear camera is not shortened or lowered');
  assert.ok(distance(safeLandCamera(anchor,actual,obstacles),actual)<1e-4,'actual native camera is safe against emitted source');
  assert.ok(qa.player().getPosition().distance(frame.p)<.13);views++;
 }
 docEvents.mouseup?.forEach(fn=>fn({button:2}));
 // Continuous desired AND real exponential-interpolated native booms through
 // every member station; ordinary shared yaw/pitch input at 30/60/144 Hz.
 for(const hz of [30,60,144])for(const view of [0,1])for(const sign of [-1,0,1]){
  if(game.getState().camera!==view){key('keydown','KeyZ');key('keyup','KeyZ');}
  const from=GARDEN_ARBOR.physicalS[0]-20,to=GARDEN_ARBOR.physicalS[1]+20,dt=1/hz;qa.orbit.recenter(true);setPose(from,sign*course.edges.alley.laneLimitAt(from));qa.draw(1);
  let count=0,maxDesiredClip=0,maxActualClip=0;
  for(let at=0;at<=(to-from)/30;at+=dt){
   const s=Math.min(to,from+at*30),frame=setPose(s,sign*course.edges.alley.laneLimitAt(s));
   qa.orbit.move(Math.sin(at*2.3)*8,Math.cos(at*1.7)*3);qa.draw(dt);
   const actual=qa.world.camera.getPosition(),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z},desired=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:false,orbit:qa.orbit.get()}).position;
   maxDesiredClip=Math.max(maxDesiredClip,distance(safeLandCamera(anchor,desired,arbor),desired));maxActualClip=Math.max(maxActualClip,distance(safeLandCamera(anchor,actual,obstacles),actual));
   assert.ok(maxDesiredClip<1e-7);assert.ok(maxActualClip<1e-4);assert.ok([actual.x,actual.y,actual.z].every(Number.isFinite));count++;interpolationSamples++;
  }
  cameraRuns.push({hz,view,laneSign:sign,count,maxDesiredClip,maxActualClip});
 }
 qa.orbit.recenter(true);docEvents.mouseup?.forEach(fn=>fn({button:2}));
 game.start();qa.update(3);qa.draw(0);
 const resetState=game.getState(),resetFrame=sampleCursor(course,resetState.route,resetState.lane),resetAnchor={x:resetFrame.p.x,y:resetFrame.p.y+1.35,z:resetFrame.p.z};
 const resetDesired=chaseCamera({position:resetFrame.p,tangent:resetFrame.t,view:resetState.camera,rearView:false,orbit:{yaw:0,pitch:0}}).position;
 assert.equal(resetState.route.edgeId,'start');assert.deepEqual(resetState.route.choiceByLap,{});assert.equal(resetState.validatedLaps,0);
 assert.ok(distance(qa.world.camera.getPosition(),safeLandCamera(resetAnchor,resetDesired,obstacles))<1e-4,'actual restart snaps shared camera to the launch support and clears orbit');
 const certificate={...boundSummary,defaultRearViews:views,interpolationSamples,cameraRuns,resources:{maxRSSKiB:process.resourceUsage().maxRSS},scope:'Actual PlayCanvas NullGraphicsDevice native assemblies and shared desired/interpolated/rear cameras with 1.35m safety anchor. CPU source checks, no browser/GPU/FPS or arbitrary mixed-parts certification.'};
 if(process.env.GARDEN_RUNTIME_EVIDENCE_DIR)writeFileSync(join(process.env.GARDEN_RUNTIME_EVIDENCE_DIR,'garden-native-camera.json'),JSON.stringify(certificate,null,2)+'\n');
 t.diagnostic(JSON.stringify({gardenActualNativeCertificate:certificate}));
}

test('garden native shared runtime: all six authored assemblies, literal arbor and rails, actual cameras, touch, items, three laps, pause and restart',t=>runGameScenario({name:'garden',cancelDuringParts:false,garden:true,savedBuild:getNpcPresets('coast',20261010).find(p=>p.characterId==='whale')!.build,gardenAudit:auditGardenNative},t));
test('garden lazy course failure retains shared visible retry and Garden navigation',t=>runGameScenario({name:'garden-chunk-failure',cancelDuringParts:false,garden:true,courseFailure:true},t));
