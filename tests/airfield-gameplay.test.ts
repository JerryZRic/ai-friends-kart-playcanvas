import {airfieldNativeBlockerComponents} from './helpers/airfield-enrichment-native-provenance';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import * as pc from 'playcanvas';
import {runGameScenario} from './helpers/gameplay-scenario';
import {getNpcPresets} from '../src/kart-presets';
import {AIRFIELD_HANGAR} from '../src/maps/airfield';
import {createCursor,createRouteProgress,resetCursor,sampleCursor} from '../src/land-routes';
import {safeLandCamera,cameraMeshCandidateIds} from '../src/land-camera';
import {chaseCamera} from '../src/race-camera';
import {steeringYaw} from '../src/vehicle-controls.js';
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
 const lo=instance.aabb.getMin().toArray(),hi=instance.aabb.getMax().toArray();
 assert.ok(vertices.every((x,i)=>x>=lo[i%3]-1e-4&&x<=hi[i%3]+1e-4),'actual weighted/skinned vertices stay inside the unchanged refreshed PlayCanvas bound');
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

async function auditAirfieldNative({qa,game,course,routes,id,key,canvas,docEvents,t,geometry}:any) {
 const sourceSHA256=Object.fromEntries(['src/maps/airfield.ts','src/airfield-scenery.ts','src/land-course.ts','src/land-course-pickups.ts','src/game.ts','src/kart-driver.ts','tests/helpers/gameplay-scenario.ts','tests/airfield-gameplay.test.ts'].map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')]));
 const obstacles=qa.course.cameraObstacles,solids=obstacles.filter(o=>o.triangles?.length),hangar=solids.filter(o=>o.kind.includes('hangar'));
 assert.ok(hangar.length>0,'open hangar retains actual emitted triangle blockers');
 assert.ok(solids.some(o=>o.kind.includes('other')||o.kind.includes('rail')),'rails and supports are included in actual solid geometry');
 assert.equal(geometry.cameraObstacles,obstacles,'native game and audit inspect the SAME emitted source object');
 const componentRanges=new Map<any,any[]>(),certifiedBlockerComponents=airfieldNativeBlockerComponents(geometry);
 for(const solid of solids){
  const components=certifiedBlockerComponents.get(solid)!;
  let from=0;const ranges=components.map(component=>{const range={from,to:from+(component.indexEnd-component.indexStart)/3,component};from=range.to;return range;});
  assert.equal(from,solid.triangles.length,solid.kind+' exact source component coverage');componentRanges.set(solid,ranges);
 }
 // Preserve the connected source terrain too. Its contour partitions are
 // independently checked to be the same piecewise planar source surface.
 const terrainSource={kind:'airfield-actual-connected-source-terrain',triangles:geometry.terrainTriangles,min:geometry.cameraObstacles.find(o=>o.heightfield).min,max:geometry.cameraObstacles.find(o=>o.heightfield).max};
 const roadTriangles=geometry.roadFaces.map(face=>face.points),heightCache=new WeakMap<object,number[]>();
 const sourceHeightOffsets=(triangle:number[][])=>{
  let result=heightCache.get(triangle);if(result)return result;
  result=triangle.map(([x,y,z])=>{
   let nearest=Infinity,roadY=NaN;
   for(const index of cameraMeshCandidateIds(roadTriangles,{x:x-9,y:-100,z:z-9},{x:x+9,y:100,z:z+9},0)){
    const points=roadTriangles[index],[a,b,c]=points,den=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]),u=((x-a[0])*(c[2]-a[2])-(z-a[2])*(c[0]-a[0]))/den,v=((b[0]-a[0])*(z-a[2])-(b[2]-a[2])*(x-a[0]))/den;
    if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8){nearest=0;roadY=a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]);break;}
    for(let k=0;k<3;k++){const a=points[k],b=points[(k+1)%3],dx=b[0]-a[0],dz=b[2]-a[2],length=dx*dx+dz*dz;if(length<1e-12)continue;const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/length)),d=Math.hypot(x-a[0]-dx*t,z-a[2]-dz*t);if(d<nearest){nearest=d;roadY=a[1]+(b[1]-a[1])*t;}}
   }
   assert.ok(Number.isFinite(roadY)&&nearest<=7.1,'support witness has actual nearby emitted road reference');return y-roadY;
  });heightCache.set(triangle,result);return result;
 };
 const expected=getNpcPresets('coast',20261010),racers=[{id,mesh:qa.player()},...qa.bots()];
 assert.equal(racers.length,6);assert.deepEqual(game.getState().kartBuild,expected.find(p=>p.characterId===id)!.build);
 for(const bot of game.getState().npcBuilds)assert.deepEqual(bot.build,expected.find(p=>p.characterId===bot.id)!.build);
 let assemblies=0,meshBounds=0,unionOnlyOverlaps=0,views=0,interpolationSamples=0;
 const measuredBounds:any[]=[],intrusions:any[]=[],supportBoundOverlaps:any[]=[],surfaceBoundOverlaps:any[]=[],underfaceNarrowPhase:any[]=[],terrainNarrowPhase:any[]=[],cameraRuns:any[]=[];
 const poses:{edgeId:'start'|'alley'|'boulevard'|'finish';s:number}[]=[];
 for(const edge of Object.values(course.edges) as any[]) {
  const stations=new Set<number>([0,edge.length*.13,edge.length*.31,edge.length*.54,edge.length*.75,edge.length*.96,edge.length]);
  for(let s=0;s<edge.length;s+=32)stations.add(s);
  if(edge.id==='alley')for(let s=AIRFIELD_HANGAR.physicalS[0]-20;s<=AIRFIELD_HANGAR.physicalS[1]+20;s+=4)stations.add(s);
  if(edge.id==='alley')AIRFIELD_HANGAR.supportStations.forEach(s=>stations.add(s));
  for(const s of [...stations].sort((a,b)=>a-b))poses.push({edgeId:edge.id,s});
 }
 for(const {edgeId,s} of poses)for(const sign of [-1,0,1])for(const yaw of [-.36,0,.36]) {
  assert.equal(yaw,steeringYaw(-Math.sign(yaw),30,yaw!==0));
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
      if(component.kind==='source-exact-layer-owned-shoulders'){
       assert.equal(component.role,'support');assert.equal(component.solid,false);
       const sourceOffsets=sourceHeightOffsets(triangle);assert.ok(Math.max(...sourceOffsets)<.06,'shoulder is the actual descending traversable support, never an elevated structure');
       supportBoundOverlaps.push({...witness,sourceOffsets,classification:'Source-authored descending drivable shoulder support; retained conservative mesh-bound witness'});
      }
      else if(component.kind==='start-line-original-airfield-stone-inlay'||component.kind==='airfield-runway-original-center-inlay'||component.kind==='road-exposed-upward-coping'){
       assert.equal(component.role,'visual-coping');assert.equal(component.solid,false);
       const sourceOffsets=sourceHeightOffsets(triangle);assert.ok(sourceOffsets.every(offset=>offset>-.01&&offset<.06),'inlay/coping source remains a thin traversable pavement layer');
       surfaceBoundOverlaps.push({...witness,sourceOffsets,classification:'Intentional traversable thin pavement surface',sourceHeightOffset:component.kind.startsWith('start-line')?.033:component.kind==='airfield-runway-original-center-inlay'?.026:.027});
      }else if(component.kind==='ground-road-thick-underfaces'){
       const sourceOffsets=sourceHeightOffsets(triangle);assert.ok(sourceOffsets.every(offset=>Math.abs(offset+.22)<1e-6),'actual source underface stays exactly 0.22m below pavement');
       const checks=hits.map(part=>{const instance=nativeInstances[part.instanceIndex];let actual=transformed.get(instance);if(!actual){actual=actualWorldGeometry(instance);transformed.set(instance,actual);}return {part:part.name,...triangleMeshContact(triangle,actual)};});
       underfaceNarrowPhase.push({...witness,sourceOffsets,checks});
       if(checks.some(check=>check.intersections>0))intrusions.push({...witness,checks});
      }else intrusions.push(witness);
     }else unionOnlyOverlaps++;
    }
   }
   for(const index of cameraMeshCandidateIds(terrainSource.triangles,{x:min[0],y:min[1],z:min[2]},{x:max[0],y:max[1],z:max[2]},0)){
    const triangle=terrainSource.triangles[index];if(!intersects(triangle,min,max))continue;
    const hits=parts.filter(part=>intersects(triangle,part.min,part.max));
    if(!hits.length){unionOnlyOverlaps++;continue;}
    const checks=hits.map(part=>{const instance=nativeInstances[part.instanceIndex];let actual=transformed.get(instance);if(!actual){actual=actualWorldGeometry(instance);transformed.set(instance,actual);}return {part:part.name,...triangleMeshContact(triangle,actual)};});
    const witness={racer:racer.id,edgeId,s,lane,yaw,kind:terrainSource.kind,triangleIndex:index,triangle,parts:hits,checks};
    terrainNarrowPhase.push(witness);if(checks.some(check=>check.intersections>0))intrusions.push(witness);
   }
   const center=course.edges[edgeId].sample(s),origin=center.p.toArray();
   const range=(axis:pc.Vec3)=>{const direction=axis.toArray();return [Math.min(...parts.map(part=>direction.reduce((sum,n,k)=>sum+n*((n>=0?part.min[k]:part.max[k])-origin[k]),0))),Math.max(...parts.map(part=>direction.reduce((sum,n,k)=>sum+n*((n>=0?part.max[k]:part.min[k])-origin[k]),0)))];};
   measuredBounds.push({id:racer.id,edgeId,s,lane,yaw,min,max,instances:parts.length,lateral:range(center.n),longitudinal:range(center.t),normal:range(center.normal)});assemblies++;
  }
 }
 const boundSummary={assemblies,individualMeshBounds:meshBounds,unionOnlyOverlaps,maximumNormalTop:Math.max(...measuredBounds.map(r=>r.normal[1])),maximumLateralOutward:Math.max(...measuredBounds.map(r=>Math.max(-r.lateral[0],r.lateral[1]))),intrusionCount:intrusions.length,supportBoundOverlapCount:supportBoundOverlaps.length,surfaceBoundOverlapCount:surfaceBoundOverlaps.length,underfaceBoundOverlapCount:underfaceNarrowPhase.length,terrainBoundOverlapCount:terrainNarrowPhase.length,terrainActualTriangleIntersections:terrainNarrowPhase.reduce((sum,r)=>sum+r.checks.reduce((n,c)=>n+c.intersections,0),0),underfaceActualTriangleIntersections:underfaceNarrowPhase.reduce((sum,r)=>sum+r.checks.reduce((n,c)=>n+c.intersections,0),0)};
 if(process.env.AIRFIELD_RUNTIME_EVIDENCE_DIR)writeFileSync(join(process.env.AIRFIELD_RUNTIME_EVIDENCE_DIR,'airfield-native-assembly-bounds.json'),JSON.stringify({sourceSHA256,summary:boundSummary,measuredBounds,intrusions,supportBoundOverlaps,surfaceBoundOverlaps,underfaceNarrowPhase,terrainNarrowPhase},null,2)+'\n');
 t.diagnostic(JSON.stringify({airfieldNativeBoundCertificate:boundSummary,firstIntrusions:intrusions.slice(0,8)}));
 assert.equal(intrusions.length,0,'Actual unshrunk rendered mesh-instance bounds must clear all emitted obstruction triangles; drivable-support witnesses are retained separately, never shrink bounds or omit obstacles');
 const setPose=(s:number,lane:number)=>{
  const cursor={...createCursor(lane),edgeId:'alley' as const,s,choiceByLap:{0:'alley' as const}},reset=resetCursor(course,cursor);
  assert.equal(reset.edgeId,'alley');assert.equal(reset.s,s);assert.equal(reset.lateral,0);
  routes.states.set(id,createRouteProgress(cursor));qa.set({pos:routes.total(id),lane,speed:0,steerVis:0});return sampleCursor(course,cursor,lane);
 };
 for(let s=AIRFIELD_HANGAR.physicalS[0]-20;s<=AIRFIELD_HANGAR.physicalS[1]+20;s+=4)for(const sign of [-1,0,1])for(const view of [0,1])for(const rear of [false,true]){
  const lane=sign*course.edges.alley.laneLimitAt(s),frame=setPose(s,lane);
  if(game.getState().camera!==view){key('keydown','KeyZ');key('keyup','KeyZ');}
  if(rear)canvas.emit('mousedown',{button:2});else docEvents.mouseup?.forEach(fn=>fn({button:2}));
  qa.orbit.recenter(true);qa.draw(1);const actual=qa.world.camera.getPosition(),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z};
  const desired=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:rear,orbit:{yaw:0,pitch:0}}).position;
  assert.ok(distance(safeLandCamera(anchor,desired,hangar),desired)<1e-7,'actual member triangles retain the complete desired boom');
  assert.ok(distance(actual,desired)<.1,'actual native default/rear camera is not shortened or lowered');
  assert.ok(distance(safeLandCamera(anchor,actual,obstacles),actual)<1e-4,'actual native camera is safe against emitted source');
  assert.ok(qa.player().getPosition().distance(frame.p)<.13);views++;
 }
 docEvents.mouseup?.forEach(fn=>fn({button:2}));
 // Continuous desired AND real exponential-interpolated native booms through
 // every member station; ordinary shared yaw/pitch input at 30/60/144 Hz.
 for(const hz of [30,60,144])for(const view of [0,1])for(const sign of [-1,0,1]){
  if(game.getState().camera!==view){key('keydown','KeyZ');key('keyup','KeyZ');}
  const from=AIRFIELD_HANGAR.physicalS[0]-20,to=AIRFIELD_HANGAR.physicalS[1]+20,dt=1/hz;qa.orbit.recenter(true);setPose(from,sign*course.edges.alley.laneLimitAt(from));qa.draw(1);
  let count=0,maxDesiredClip=0,maxActualClip=0,maxMotionClip=0,previousCamera=qa.world.camera.getPosition().clone();
  for(let at=0;at<=(to-from)/30;at+=dt){
   const s=Math.min(to,from+at*30),frame=setPose(s,sign*course.edges.alley.laneLimitAt(s));
   qa.orbit.move(Math.sin(at*2.3)*8,Math.cos(at*1.7)*3);qa.draw(dt);
   const actual=qa.world.camera.getPosition(),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z},desired=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:false,orbit:qa.orbit.get()}).position;
   maxDesiredClip=Math.max(maxDesiredClip,distance(safeLandCamera(anchor,desired,hangar),desired));maxActualClip=Math.max(maxActualClip,distance(safeLandCamera(anchor,actual,obstacles),actual));
   maxMotionClip=Math.max(maxMotionClip,distance(safeLandCamera(previousCamera,actual,obstacles),actual));previousCamera.copy(actual);assert.ok(maxMotionClip<1e-4);
   assert.ok(maxDesiredClip<1e-7);assert.ok(maxActualClip<1e-4);assert.ok([actual.x,actual.y,actual.z].every(Number.isFinite));count++;interpolationSamples++;
  }
  cameraRuns.push({hz,view,laneSign:sign,count,maxDesiredClip,maxActualClip,maxMotionClip});
 }
 qa.orbit.recenter(true);docEvents.mouseup?.forEach(fn=>fn({button:2}));
 game.start();qa.update(3);qa.draw(0);
 const resetState=game.getState(),resetFrame=sampleCursor(course,resetState.route,resetState.lane),resetAnchor={x:resetFrame.p.x,y:resetFrame.p.y+1.35,z:resetFrame.p.z};
 const resetDesired=chaseCamera({position:resetFrame.p,tangent:resetFrame.t,view:resetState.camera,rearView:false,orbit:{yaw:0,pitch:0}}).position;
 assert.equal(resetState.route.edgeId,'start');assert.deepEqual(resetState.route.choiceByLap,{});assert.equal(resetState.validatedLaps,0);
 assert.ok(distance(qa.world.camera.getPosition(),safeLandCamera(resetAnchor,resetDesired,obstacles))<1e-4,'actual restart snaps shared camera to the launch support and clears orbit');
 const certificate={sourceSHA256,...boundSummary,defaultRearViews:views,interpolationSamples,cameraRuns,resources:{maxRSSKiB:process.resourceUsage().maxRSS,v8HeapUsedMiB:process.memoryUsage().heapUsed/1048576,v8HeapTotalMiB:process.memoryUsage().heapTotal/1048576,configuredOldSpaceMiB:448},scope:'Actual PlayCanvas NullGraphicsDevice native assemblies and shared desired/interpolated/rear cameras with 1.35m safety anchor. CPU source checks, no browser/GPU/FPS or arbitrary mixed-parts certification.'};
 if(process.env.AIRFIELD_RUNTIME_EVIDENCE_DIR)writeFileSync(join(process.env.AIRFIELD_RUNTIME_EVIDENCE_DIR,'airfield-native-camera.json'),JSON.stringify(certificate,null,2)+'\n');
 t.diagnostic(JSON.stringify({airfieldActualNativeCertificate:certificate}));
}

test('airfield native shared runtime: all six authored assemblies, literal hangar and rails, actual cameras, touch, items, three laps, pause and restart',t=>runGameScenario({name:'airfield',cancelDuringParts:false,airfield:true,savedBuild:getNpcPresets('coast',20261010).find(p=>p.characterId==='whale')!.build,airfieldAudit:auditAirfieldNative},t));
test('airfield lazy course failure retains shared visible retry and Airfield navigation',t=>runGameScenario({name:'airfield-chunk-failure',cancelDuringParts:false,airfield:true,courseFailure:true},t));
