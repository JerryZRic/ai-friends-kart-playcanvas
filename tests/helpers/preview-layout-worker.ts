/** Bounded CPU-only route/layout observation. This does not render any pixels. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as pc from 'playcanvas';
const [root,id]=process.argv.slice(2);
assert.ok(root&&/^(coast|waterpark|mountain|town|quarry|forest|workshop|harvest|desert|snow|caldera|garden|airfield)$/.test(id));
const load=(path:string)=>import(pathToFileURL(resolve(root,'src',path)).href);
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const close=(a:number[],b:number[],label:string,tolerance=2e-6)=>{assert.equal(a.length,b.length,label);for(let i=0;i<a.length;i++)assert.ok(Number.isFinite(a[i])&&Math.abs(a[i]-b[i])<=tolerance,`${label}[${i}] ${a[i]} versus ${b[i]}`);};
function bounds(points:number[][]){assert.ok(points.length);return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];}
function safe(frame:number[],label:string){assert.ok(frame.every(Number.isFinite)&&Math.min(...frame.slice(0,2))>=.059&&Math.max(...frame.slice(2))<=.941,label+' complete route safe frame');}
function project(points:number[][],view:any){
  assert.equal(view.projection,'ORTHO');
  const q=view.cameraQuaternionBlender??view.cameraQuaternionBlenderWXYZ;
  assert.ok(q?.length===4&&q.every(Number.isFinite));
  const norm=Math.hypot(...q),[w,x,y,z]=q.map((v:number)=>v/norm),position=view.cameraPositionBlender;
  const scale=view.orthographicScaleMetres,aspect=view.resolution[0]/view.resolution[1];
  assert.ok(scale>0&&Number.isFinite(scale)&&position.length===3);
  return points.map(([sx,sy,sz])=>{
    const [dx,dy,dz]=[sx-position[0],-sz-position[1],sy-position[2]];
    const horizontal=(1-2*y*y-2*z*z)*dx+(2*x*y+2*w*z)*dy+(2*x*z-2*w*y)*dz;
    const vertical=(2*x*y-2*w*z)*dx+(1-2*x*x-2*z*z)*dy+(2*y*z+2*w*x)*dz;
    return [.5+horizontal/scale,.5+vertical*aspect/scale];
  });
}
function samples(edge:any){
  const count=Math.ceil(edge.length/1.5);
  return Array.from({length:count+1},(_,i)=>{const s=edge.length*i/count,f=edge.sample(s),width=edge.halfWidthAt(s);return {s,p:f.p.toArray(),t:f.t.toArray(),n:f.n.toArray(),halfWidth:width,left:edge.sample(s,-width).p.toArray(),right:edge.sample(s,width).p.toArray()};});
}
async function land(){
  const p=JSON.parse(readFileSync(resolve(root,`docs/${id}-preview-provenance.json`),'utf8'));
  const map=await load(`maps/${id}.ts`),upper=id.toUpperCase(),track=map[upper+'_TRACK'];
  const route=id==='mountain'?track:map[upper+'_COURSE'];
  const module=await load(id+'-scenery.ts'),build=module['build'+id[0].toUpperCase()+id.slice(1)+'SceneGeometry'];
  const geometry=build(route);
  const roads=id==='mountain'?[{id,length:track.length,samples:samples(track)}]:map[upper+'_ROAD_EDGES'].map((edge:any)=>({id:edge.id,length:edge.length,samples:samples(edge)}));
  const exact:any={};
  for(const key of ['roadSamples','routeRoadSamples','roadFaces','roadUndersideFaces','landmarks','sightlines','props','structures'])if(Object.hasOwn(geometry,key))exact[key]=geometry[key];
  // Mountain's lookout metadata includes mutable buffer indices. Keep its
  // physical position/yaw and authored reused-prop placement anchors instead.
  if(id==='mountain')exact.landmarkPlacements={lookout:{position:geometry.lookout.position,yaw:geometry.lookout.yaw},reusedProps:geometry.reusedProps.map((p:any)=>({kind:p.kind,position:p.position,yaw:p.yaw,footprint:p.footprint,groundContacts:p.groundContacts}))};
  const rows=geometry.routeRoadSamples??geometry.roadSamples;
  // The retained enrichment renderers record emitted road samples, while
  // physical-branch bounds use the independently sampled route edges.
  const anchors:number[][]=rows.flatMap((row:any)=>[row.left,row.right]);
  const completeAnchors=anchors.concat(roads.flatMap((e:any)=>e.samples.flatMap((s:any)=>[s.left,s.right])),geometry.roadFaces.flatMap((f:any)=>f.points));
  const frames:any={};
  const landmarkPoints:number[][]=geometry.landmarks?.map((p:any)=>p.position)??geometry.props.map((p:any)=>[p.x,p.y,p.z]);
  assert.ok(landmarkPoints.length&&landmarkPoints.every(p=>p.length===3&&p.every(Number.isFinite)));
  for(const kind of ['overview','topdown']){
    const key=id+'-'+kind,view=p.views[key],frame=bounds(project(anchors,view));
    close(frame,view.routeScreenBounds,key+' independently projected archived frame');safe(frame,key);
    frames[key]=frame;
    frames[key+':complete-current-road']=bounds(project(completeAnchors,view));safe(frames[key+':complete-current-road'],key+' all sampled edges and emitted road faces');
    frames[key+':original-landmark-anchors']=bounds(project(landmarkPoints,view));
    if(view.physicalBranchScreenBounds)for(const edge of ['alley','boulevard']){
      const branch=roads.find((e:any)=>e.id===edge).samples.flatMap((s:any)=>[s.left,s.right]);
      const branchFrame=bounds(project(branch,view));close(branchFrame,view.physicalBranchScreenBounds[edge],key+':'+edge);safe(branchFrame,key+':'+edge);frames[key+':'+edge]=branchFrame;
    }
  }
  const authored={points:map[upper+'_POINTS'],landmarks:map[upper+'_LANDMARKS'],checkpointGates:route.checkpointGates,sections:track.sections,roads};
  return {roadPointCount:anchors.length,landmarkAnchorCount:geometry.landmarks?.length??geometry.props.length,authoredRouteSha256:digest(authored),emittedLayoutSha256:digest(exact),frames};
}
async function coastal(){
  const manifest=JSON.parse(readFileSync(resolve(root,'docs/map-preview-provenance.json'),'utf8')),p=manifest.maps[id];
  const {createMenuWorld}=await load('menu-backdrop.ts'),{DEFAULT_SETTINGS}=await load('game-settings.ts');
  const track=await load('track.ts'),water=await load('waterpark-design.ts');
  const canvas={id:'historical-route-layout',width:1280,height:720,addEventListener(){},removeEventListener(){},getBoundingClientRect(){return {left:0,top:0,width:1280,height:720};}} as any;
  const app=new pc.AppBase(canvas),options=new pc.AppOptions();options.graphicsDevice=new pc.NullGraphicsDevice(canvas);options.componentSystems=[pc.RenderComponentSystem,pc.CameraComponentSystem,pc.LightComponentSystem,pc.ScriptComponentSystem];options.devtools=false;app.init(options);
  const world=createMenuWorld(app,id,{...DEFAULT_SETTINGS,quality:'low'});
  try{
    const sampler=id==='coast'?track.sample:water.sampleWaterparkLoop,length=id==='coast'?track.LENGTH:water.WATER_RACE_LENGTH;
    const points:number[][]=[],anchors:number[][]=[],landmarks:any[]=[],roadMeshes:any[]=[];
    for(let i=0;i<720;i++){const s=i/720*length;points.push(sampler(s).p.toArray());const edge=id==='coast'?track.halfWidthAt(s)+2:16;for(const lateral of [-edge,edge])anchors.push(sampler(s,lateral).p.toArray());}
    // Coast's original export fits road edges only: no original mesh matched
    // its tower/roof selector. Verify its original island/piers/palm anchors
    // separately; the later lighthouse/cabana batches are not in this poster.
    const coastLandmarks=['Island','Elevated road piers','Menu coastal palms'];
    const coastRoad=['Circuit ribbon','Coral kerbs','Cream kerbs','Coastal guardrail','Lane markings','Guardrail supports','Checkered starting line'];
    const waterRoad=['Turquoise flowing canal','Ivory coping and bridge stone','Coral curb accents'];
    for(const render of app.root.findComponents('render') as pc.RenderComponent[])for(const instance of render.meshInstances){
      const name=instance.node.name;
      const fitLandmark=id==='waterpark'&&/tower|roofs|canopies|bridge stone|resort terraces|resort glazing/i.test(name);
      const landmark=id==='coast'?coastLandmarks.includes(name):fitLandmark;
      const road=(id==='coast'?coastRoad:waterRoad).includes(name);
      if(!landmark&&!road)continue;
      const local:number[]=[],indices:number[]=[];instance.mesh.getPositions(local);instance.mesh.getIndices(indices);if(!indices.length)continue;
      const matrix=instance.node.getWorldTransform(),positions:number[][]=[];
      for(let i=0;i<local.length;i+=3){const q=matrix.transformPoint(new pc.Vec3(local[i],local[i+1],local[i+2])).toArray();positions.push(q);if(fitLandmark)anchors.push(q);}
      if(landmark)landmarks.push({name,positions,indices});
      if(road)roadMeshes.push({name,positions,indices});
    }
    assert.ok(landmarks.length>0);
    close([0,1,2].map(axis=>Math.min(...points.map(q=>q[axis]))),p.routeBounds.min,id+' route minimum');
    close([0,1,2].map(axis=>Math.max(...points.map(q=>q[axis]))),p.routeBounds.max,id+' route maximum');
    assert.equal(length,p.routeLength);
    const xyz=(q:number[])=>[q[0],-q[2],q[1]],pts=points.map(xyz),fit=anchors.map(xyz),mean=[0,1,2].map(axis=>pts.reduce((n,q)=>n+q[axis],0)/pts.length);
    const xx=pts.reduce((n,q)=>n+(q[0]-mean[0])**2,0),yy=pts.reduce((n,q)=>n+(q[1]-mean[1])**2,0),xy=pts.reduce((n,q)=>n+(q[0]-mean[0])*(q[1]-mean[1]),0);
    const angle=.5*Math.atan2(2*xy,xx-yy),pitch=68*Math.PI/180,right=[Math.cos(angle),Math.sin(angle),0],direction=[Math.sin(angle)*Math.cos(pitch),-Math.cos(angle)*Math.cos(pitch),Math.sin(pitch)];
    const up=[direction[1]*right[2]-direction[2]*right[1],direction[2]*right[0]-direction[0]*right[2],direction[0]*right[1]-direction[1]*right[0]];
    const dot=(a:number[],b:number[])=>a.reduce((n,v,i)=>n+v*b[i],0),projected=fit.map(q=>{const delta=q.map((v,i)=>v-mean[i]);return [dot(delta,right),dot(delta,up)];}),raw=bounds(projected),scale=Math.max(raw[2]-raw[0],(raw[3]-raw[1])*16/9)/.88;
    const frame=bounds(projected.map(q=>[.5+(q[0]-(raw[0]+raw[2])/2)/scale,.5+(q[1]-(raw[1]+raw[3])/2)*16/9/scale]));
    const landmarkProjection=landmarks.flatMap(m=>m.positions).map(xyz).map(q=>{const delta=q.map((v,i)=>v-mean[i]);return [.5+(dot(delta,right)-(raw[0]+raw[2])/2)/scale,.5+(dot(delta,up)-(raw[1]+raw[3])/2)*16/9/scale];});
    close(frame,p.camera.normalizedSafeBounds,id+' independently calculated route/landmark fit');safe(frame,id);
    return {roadPointCount:1440,landmarkAnchorCount:landmarks.length,authoredRouteSha256:digest({length,points,edges:anchors.slice(0,1440)}),emittedLayoutSha256:digest({landmarks,roadMeshes}),frames:{overview:frame,originalLandmarkAnchors:bounds(landmarkProjection)}};
  }finally{world.destroy();app.destroy();}
}
console.log('PREVIEW_LAYOUT '+JSON.stringify(await (id==='coast'||id==='waterpark'?coastal():land())));
