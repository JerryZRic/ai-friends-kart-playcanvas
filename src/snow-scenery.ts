import {assertRuntimeAppendGeometry} from './geometry-runtime-contract';
import * as pc from 'playcanvas';
import {LandMeshBatch as Batch} from './land-mesh-builder';
import {footprintArea,intersectRoadFootprint,subtractRoadFootprint,sampleRoadFootprints,RoadFootprintIndex,roadFootprint,type SceneryForkCourse,type SceneryRoadEdge} from './land-road-mesh';
import type {LandSceneGeometry,LandPropPlacement} from './land-scenery';
import type {LandSceneTheme} from './land-scene';
import {cameraTerrainHeight,type CameraBlocker,type CameraHeightfield} from './land-camera';

type Role='terrain'|'road'|'support'|'visual-coping'|'rail'|'structure'|'detail';
export type SnowComponent={kind:string;batch:string;vertexStart:number;vertexEnd:number;indexStart:number;indexEnd:number;min:number[];max:number[];role:Role;solid:boolean;landmark?:string;enrichmentAssembly?:string};
type Component=SnowComponent;
type Face={edgeId:string;distance:number;points:number[][]};
export interface SnowSceneGeometry extends LandSceneGeometry {
 routeRoadSamples:{edgeId:string;distance:number;left:number[];right:number[];rendered:boolean}[];
 roadFaces:Face[];roadUndersideFaces:Face[];shoulderFaces:Face[];
 cameraObstacles:(CameraBlocker&{kind:string})[];components:Component[];
 landmarks:{kind:string;label:string;position:number[];radius:number;height:number}[];
 foundations:{kind:string;top:number;bottom:number;footprint:number[][];terrainLow:number;terrainHigh:number}[];
 groundedDetails:{kind:string;x:number;z:number;bottom:number;terrainY:number;footprint:number[][]}[];
 railMembers:{edgeId:string;distance:number;side:number;points:number[][]}[];
 wheelContacts:{kind:string;component:number;supportKind:string;points:number[][];supportY:number;signedGap:number}[];
 structuralContacts:{kind:string;first:number;second:number}[];
 sightlines:{name:string;eye:number[];target:number[];radius:number;targetId:string}[];
 landforms:{kind:string;footprint:number[][];bottom:number;top:number}[];
 terrainGrid:CameraHeightfield;terrainVertices:number[];terrainTriangles:number[][][];
 terrainExposure:number[];terrainPartitions:{sourceTriangle:number;material:'snow'|'slate';indexStart:number;indexEnd:number}[];
 enrichmentAssemblies:{id:string;pieces:(Component&{id:string;supportOwner:string[];supportIndexStart?:number;supportIndexEnd?:number})[];groundContacts:{pieceId:string;footprint:number[][];bottom:number;terrainLow:number;terrainHigh:number;bottomIndexStart:number;bottomIndexEnd:number;terrainPenetrationMetres:number}[]}[];
 budget:{batches:number;triangles:number;vertices:number};
}
export const SNOW_SCENE_THEME:Readonly<LandSceneTheme>=Object.freeze({textureLabel:'frostloop original snow slate and depot textures',ambient:'#bccfda',sky:'#c3d9e4',fogStart:980,fogEnd:2200,cameraName:'Frostloop Depot chase camera',sunName:'Frostloop low winter sun',sunColor:'#fff0d5',sunIntensity:1.55,sunEuler:[39,-32,0] as const});
const vec=(x:number,y:number,z:number)=>new pc.Vec3(x,y,z),tuple=(p:pc.Vec3)=>[p.x,p.y,p.z];
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const smooth=(x:number)=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
const noise=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const local=(p:pc.Vec3,yaw=0)=>{const c=Math.cos(yaw),s=Math.sin(yaw);return(x:number,y:number,z:number)=>vec(p.x+x*c+z*s,p.y+y,p.z-x*s+z*c);};
const plots=[
 {kind:'ridge-signal-house',x:78.21051759724152,z:-265.7541594056325,r:22,h:26,label:'Ridge Signal House: unequal slate roof, open porch and observation turret'},
 {kind:'snow-split-ridge',x:126.25436072868013,z:-.30407261971647337,r:26,h:39,label:'Split Snow Ridge: connected twin wind shoulders and real lower saddle'},
 {kind:'depot-clock-hall',x:445.37842115712493,z:-525.5060716381129,r:28,h:25,label:'Depot Clock Hall: twelve-tick bronze dial and open platform porch'},
 {kind:'maintenance-roundhouse',x:170.01970061790266,z:-604.5657070926818,r:20,h:16,label:'Maintenance Roundhouse: three open service bays and static inspection trolley'},
 {kind:'stone-plow-shed',x:-31.669037995054445,z:-810.7023664917805,r:24,h:17,label:'Stone Plow Shed: open truss workshop and original wedge plow'},
] as const;

/** Original static LAND geometry. Every mesh, footing and camera blocker derives
 * from these sources; no terrain or building changes the shared driving model. */
export function buildSnowSceneGeometry(course:SceneryForkCourse):SnowSceneGeometry {
 const ground=new Batch('Snow connected wind sculpted terrain','#dbe9ed',1,'grass');
 const slate=new Batch('Snow connected blue slate ribs','#4c697d',.98,'stone');
 const snowShade=new Batch('Snow compressed leeside strata','#a9c4d0',1,'stone');
 const supportStone=new Batch('Snow exact road shoulder and support','#afcbd5',1,'stone');
 const road=new Batch('Snow packed racing ribbon','#bdced3',1,'asphalt');
 const paving=new Batch('Snow service paving and edge stones','#7a939b',.98,'stone');
 const foundationStone=new Batch('Snow foundation and platform stone','#859ba4',.99,'stone');
 const paleStone=new Batch('Snow warm pale station masonry','#d4cfb8',.98,'stone');
 const darkStone=new Batch('Snow recessed masonry and mortar','#677d86',.98,'stone');
 const teal=new Batch('Snow teal structural painted timber','#496d73',.95,'wood');
 const timber=new Batch('Snow aged structural timber','#785a40',.97,'wood');
 const boards=new Batch('Snow worn cart and bench boards','#a38157',.97,'wood');
 const roofSlate=new Batch('Snow thick slate roof planes','#405b70',.96,'stone');
 const roofSnow=new Batch('Snow seated roof caps','#e4eff0',1,'grass');
 const bronze=new Batch('Snow clock and signal bronze','#b99757',.48,'none',.64);
 const glass=new Batch('Snow recessed cool window glass','#668c9b',.32,'none',.1);
 const steel=new Batch('Snow static rails axles and ironwork','#67747a',.50,'none',.68);
 const oxide=new Batch('Snow oxide plow steel','#805b4d',.76,'none',.46);
 const rubber=new Batch('Snow dark wheel treads','#303e45',.91,'asphalt');
 const evergreen=new Batch('Snow sparse rooted fir boughs','#426a68',.97,'grass');
 const inlay=new Batch('Snow route marker ivory relief','#eee3c4',.93,'stone');
 const burlap=new Batch('Snow tied yard cargo','#ae9673',1,'wood');
 const warm=new Batch('Snow warm window and signal inserts','#e7ba77',.54,'none');
 const batches=[ground,slate,snowShade,supportStone,road,paving,foundationStone,paleStone,darkStone,teal,timber,boards,roofSlate,roofSnow,bronze,glass,steel,oxide,rubber,evergreen,inlay,burlap,warm];
 const edges=[course.commonStart,course.alternates.alley,course.alternates.boulevard,course.commonFinish];
 const sourceFaces=sampleRoadFootprints(edges,1.65),roadIndex=new RoadFootprintIndex(sourceFaces);
 const props:LandPropPlacement[]=[],roadSamples:SnowSceneGeometry['roadSamples']=[],routeRoadSamples:SnowSceneGeometry['routeRoadSamples']=[];
 const roadFaces:Face[]=[],roadUndersideFaces:Face[]=[],shoulderFaces:Face[]=[],cameraObstacles:SnowSceneGeometry['cameraObstacles']=[],components:Component[]=[];
 const landmarks:SnowSceneGeometry['landmarks']=[],foundations:SnowSceneGeometry['foundations']=[],groundedDetails:SnowSceneGeometry['groundedDetails']=[],railMembers:SnowSceneGeometry['railMembers']=[],landforms:SnowSceneGeometry['landforms']=[];
 const wheelContacts:SnowSceneGeometry['wheelContacts']=[],structuralContacts:SnowSceneGeometry['structuralContacts']=[];
 let landmark:string|undefined;
 const point=(e:SceneryRoadEdge,s:number,l=0,h=0)=>e.sample(s,l).p.clone().add(vec(0,h,0));
 const meshBlock=(kind:string,triangles:number[][][])=>{if(!triangles.length)return;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const t of triangles)for(const p of t)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}cameraObstacles.push({kind,min,max,triangles});};
 const bound=(kind:string,b:Batch,start:number,role:Role='structure',solid=true,indexStart?:number)=>{
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=start*3;i<b.positions.length;i++){const k=i%3;min[k]=Math.min(min[k],b.positions[i]);max[k]=Math.max(max[k],b.positions[i]);}
  let index=indexStart??b.indices.length;while(indexStart===undefined&&index>0&&b.indices[index-1]>=start)index-=3;
  if(solid){let volume=0;const origin=b.positions.slice(start*3,start*3+3);for(let i=index;i<b.indices.length;i+=3){const p=b.indices.slice(i,i+3).map(k=>b.positions.slice(k*3,k*3+3).map((v,j)=>v-origin[j]));volume+=p[0][0]*(p[1][1]*p[2][2]-p[1][2]*p[2][1])+p[0][1]*(p[1][2]*p[2][0]-p[1][0]*p[2][2])+p[0][2]*(p[1][0]*p[2][1]-p[1][1]*p[2][0]);}if(volume<0)for(let i=index;i<b.indices.length;i+=3)[b.indices[i+1],b.indices[i+2]]=[b.indices[i+2],b.indices[i+1]];}
  const c:Component={kind,batch:b.name,vertexStart:start,vertexEnd:b.positions.length/3,indexStart:index,indexEnd:b.indices.length,min,max,role,solid,...(landmark?{landmark}:{})};components.push(c);return c;
 };
 const facesFor=(c:Component)=>{const b=batches.find(b=>b.name===c.batch)!,out:number[][][]=[];for(let i=c.indexStart;i<c.indexEnd;i+=3)out.push(b.indices.slice(i,i+3).map(k=>b.positions.slice(k*3,k*3+3)));return out;};
 const box=(kind:string,b:Batch,p:pc.Vec3,size:pc.Vec3,yaw=0,role:Role='structure')=>{const start=b.positions.length/3;b.box(p,size,yaw);return bound(kind,b,start,role);};
 const beam=(kind:string,b:Batch,a:pc.Vec3,c:pc.Vec3,width:number,depth=width,role:Role='structure')=>{
  const y=c.clone().sub(a).normalize(),x=new pc.Vec3().cross(y,vec(0,1,0));if(x.length()<.01)x.set(1,0,0);else x.normalize();const z=new pc.Vec3().cross(x,y).normalize();
  const at=(p:pc.Vec3,i:number,j:number)=>p.clone().add(x.clone().mulScalar(i*width/2)).add(z.clone().mulScalar(j*depth/2));
  const v=[at(a,-1,-1),at(a,1,-1),at(c,-1,-1),at(c,1,-1),at(a,-1,1),at(a,1,1),at(c,-1,1),at(c,1,1)],start=b.positions.length/3;
  for(const f of [[0,1,2,3],[5,4,7,6],[4,0,6,2],[1,5,3,7],[2,3,6,7],[4,5,0,1]])b.quad(v[f[0]],v[f[1]],v[f[2]],v[f[3]]);bound(kind,b,start,role);return v;
 };
 const tube=(kind:string,b:Batch,path:pc.Vec3[],radii:number[],sides=12,capStart=true,capEnd=true,role:Role='structure')=>{
  const closedLoop=path.length>2&&path[0].distance(path[path.length-1])<1e-7;const start=b.positions.length/3;for(let k=0;k<path.length;k++){const axis=(closedLoop&&(k===0||k===path.length-1)?path[1].clone().sub(path[path.length-2]):path[Math.min(k+1,path.length-1)].clone().sub(path[Math.max(0,k-1)])).normalize(),u=new pc.Vec3().cross(axis,Math.abs(axis.y)>.93?vec(1,0,0):vec(0,1,0)).normalize(),v=new pc.Vec3().cross(axis,u).normalize();for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2;b.vertex(path[k].clone().add(u.clone().mulScalar(Math.cos(a)*radii[k])).add(v.clone().mulScalar(Math.sin(a)*radii[k])),[j/sides,k*.28]);}}
  for(let k=0;k<path.length-1;k++)for(let j=0;j<sides;j++){const a=start+k*sides+j,c=start+k*sides+(j+1)%sides;b.indices.push(a,c,a+sides,c,c+sides,a+sides);}
  for(const [enabled,k,reverse]of [[capStart,0,true],[capEnd,path.length-1,false]] as const)if(enabled){const center=b.positions.length/3;b.vertex(path[k]);for(let j=0;j<sides;j++){const a=start+k*sides+j,c=start+k*sides+(j+1)%sides;b.indices.push(center,...(reverse?[c,a]:[a,c]));}}
  return bound(kind,b,start,role,(capStart&&capEnd)||closedLoop);
 };
 const turned=(kind:string,b:Batch,at:(x:number,y:number,z:number)=>pc.Vec3,profile:number[][],sides=24,role:Role='structure')=>{const start=b.positions.length/3;for(const [y,r]of profile)for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2;b.vertex(at(Math.cos(a)*r,y,Math.sin(a)*r),[j/sides,y*.2]);}for(let k=0;k<profile.length-1;k++)for(let j=0;j<sides;j++){const a=start+k*sides+j,c=start+k*sides+(j+1)%sides;b.indices.push(a,c,a+sides,c,c+sides,a+sides);}for(const k of [0,profile.length-1]){const center=b.positions.length/3;b.vertex(at(0,profile[k][0],0));for(let j=0;j<sides;j++){const a=start+k*sides+j,c=start+k*sides+(j+1)%sides;b.indices.push(center,...(k===0?[c,a]:[a,c]));}}return bound(kind,b,start,role);};
 // Indexed lofts model joined wind-eroded volumes, rather than overlapping
 // cones. Every ring is shared with its neighbor and both ends are closed.
 const loft=(kind:string,b:Batch,at:(x:number,y:number,z:number)=>pc.Vec3,rings:{y:number;rx:number;rz:number;x?:number;z?:number}[],sides=48,seed=0,role:Role='structure')=>{
  const start=b.positions.length/3;for(let k=0;k<rings.length;k++){const q=rings[k];for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,w=1+.025*Math.sin(a*5+seed)+.018*Math.sin(a*9+seed*.7),notch=1-.10*Math.exp(-Math.pow((Math.sin(a+.8)+.7)*4,2))*Math.sin(k/(rings.length-1)*Math.PI);b.vertex(at((q.x??0)+Math.cos(a)*q.rx*w*notch,q.y,(q.z??0)+Math.sin(a)*q.rz*w*notch),[j/sides*4,k*.35]);}}
  for(let k=0;k<rings.length-1;k++)for(let j=0;j<sides;j++){const a=start+k*sides+j,c=start+k*sides+(j+1)%sides;b.indices.push(a,c,a+sides,c,c+sides,a+sides);}for(const k of [0,rings.length-1]){const q=rings[k],c=b.positions.length/3;b.vertex(at(q.x??0,q.y,q.z??0));for(let j=0;j<sides;j++){const a=start+k*sides+j,d=start+k*sides+(j+1)%sides;b.indices.push(c,...(k===0?[d,a]:[a,d]));}}return bound(kind,b,start,role);
 };
 const contact=(kind:string,a:Component,b:Component)=>structuralContacts.push({kind,first:components.indexOf(a),second:components.indexOf(b)});
 const sightlines:SnowSceneGeometry['sightlines']=[
  {name:'first bowl signal house',eye:tuple(point(course.commonStart,433.0492005667512,0,1.6)),target:[plots[0].x,54.04962568831835,plots[0].z],radius:3,targetId:plots[0].kind},
  {name:'opposing bowl split ridge',eye:tuple(point(course.commonStart,920.2295512043464,0,1.6)),target:[plots[1].x,63.68203979639006,plots[1].z],radius:3,targetId:plots[1].kind},
  {name:'terrace clock hall',eye:tuple(point(course.alternates.boulevard,330,0,1.6)),target:[plots[2].x,39.5,plots[2].z],radius:3,targetId:plots[2].kind},
  {name:'service cut open bays',eye:tuple(point(course.alternates.alley,210,0,1.6)),target:[plots[3].x,25,plots[3].z],radius:3,targetId:plots[3].kind},
  {name:'return plow court',eye:tuple(point(course.commonFinish,410,0,1.6)),target:[plots[4].x,24,plots[4].z],radius:3,targetId:plots[4].kind},
 ];
 const inSight=(x:number,z:number,r:number)=>sightlines.some(q=>{const dx=q.target[0]-q.eye[0],dz=q.target[2]-q.eye[2],t=clamp(((x-q.eye[0])*dx+(z-q.eye[2])*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-q.eye[0]-dx*t,z-q.eye[2]-dz*t)<r+q.radius;});
 const spines=[
  {knots:[[-340,29,-260],[-330,44,-100],[-200,53,-55],[-55,47,-65]],width:88},
  {knots:[[-170,17,-305],[-120,23,-245],[-70,29,-185]],width:100},
  {knots:[[140,48,-35],[158,55,18],[192,48,54]],width:45},
  {knots:[[35,40,110],[145,58,198],[295,60,202],[410,45,90]],width:86},
  {knots:[[470,22,-365],[504,26,-565],[440,22,-760]],width:64},
  {knots:[[135,18,-1020],[-95,24,-990],[-240,36,-925],[-405,39,-785],[-420,31,-560]],width:90},
  {knots:[[-170,11,-590],[-40,13,-450],[95,15,-425]],width:155},
 ];
 // Nearest point on the ACTUAL banked source triangle union, including its
 // corners. No sampled center-height substitution or 40m overlap cutoff.
 const nearest=(x:number,z:number)=>{
  let candidates:typeof sourceFaces=[];for(const r of [14,42,110,260,600,1400]){candidates=roadIndex.query(x-r,x+r,z-r,z+r);if(candidates.length)break;}
  let distance=Infinity,y=0,face=sourceFaces[0],px=x,pz=z;
  for(let pass=0;pass<2;pass++){for(const f of candidates){const [a,b,c]=f.points,den=(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x),u=((x-a.x)*(c.z-a.z)-(z-a.z)*(c.x-a.x))/den,v=((b.x-a.x)*(z-a.z)-(b.z-a.z)*(x-a.x))/den;if(u>=0&&v>=0&&u+v<=1)return{distance:0,y:a.y+u*(b.y-a.y)+v*(c.y-a.y),face:f,x,z};
   for(let k=0;k<3;k++){const a=f.points[k],b=f.points[(k+1)%3],dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1),qx=a.x+t*dx,qz=a.z+t*dz,d=Math.hypot(x-qx,z-qz);if(d<distance){distance=d;y=a.y+(b.y-a.y)*t;face=f;px=qx;pz=qz;}}
  }if(pass===0)candidates=roadIndex.query(x-distance-1e-8,x+distance+1e-8,z-distance-1e-8,z+distance+1e-8);}
  return{distance,y,face,x:px,z:pz};
 };
 const terrainY=(x:number,z:number)=>{
  let y=9.5+1.5*Math.sin(x*.006-z*.004)+.8*Math.sin(x*.019+z*.012);
  for(const spine of spines)for(let k=1;k<spine.knots.length;k++){const a=spine.knots[k-1],b=spine.knots[k],u=clamp(((x-a[0])*(b[0]-a[0])+(z-a[2])*(b[2]-a[2]))/((b[0]-a[0])**2+(b[2]-a[2])**2),0,1),d=Math.hypot(x-a[0]-(b[0]-a[0])*u,z-a[2]-(b[2]-a[2])*u),w=smooth(1-d/spine.width);y=Math.max(y,9+(a[1]+(b[1]-a[1])*u-9)*w);}
  const q=nearest(x,z),d=q.distance;
  // Broad connected outer snow lips rise AFTER the complete camera orbit
  // reservation. The other shoulder opens toward a basin and lower saddle.
  if(q.face.edge===course.commonStart){const f=q.face.edge.sample(q.face.distance),side=Math.sign((x-f.p.x)*f.n.x+(z-f.p.z)*f.n.z);const s=q.face.distance;
   const first=smooth((s-170)/90)*smooth((650-s)/110),second=smooth((s-1050)/90)*smooth((1510-s)/110);
   const ridge=(side<0?first:second)*smooth((d-23)/19)*smooth((102-d)/46)*(16+5*Math.sin(s*.011)**2);y=Math.max(y,q.y-2+ridge);
  }
  // The continuous apron grades gently to each building; its slab will still
  // be grounded against the whole emitted terrain footprint, never this seed.
  for(const p of plots)if(p.kind!=='snow-split-ridge'){const r=Math.hypot(x-p.x,z-p.z),w=smooth((p.r+11-r)/11),base=p.kind==='ridge-signal-house'?30.2:p.kind==='depot-clock-hall'?17.35:p.kind==='maintenance-roundhouse'?15.3:13.3;y+=(base-y)*w;}
  const roadWeight=smooth(1-d/42),roadY=q.y-.52-.095*Math.min(d,18);y+=(roadY-y)*roadWeight;
  for(const sight of sightlines){const dx=sight.target[0]-sight.eye[0],dz=sight.target[2]-sight.eye[2],u=clamp(((x-sight.eye[0])*dx+(z-sight.eye[2])*dz)/(dx*dx+dz*dz),0,1);if(u<.91&&Math.hypot(x-sight.eye[0]-u*dx,z-sight.eye[2]-u*dz)<8)y=Math.min(y,sight.eye[1]+u*(sight.target[1]-sight.eye[1])-4);}
  return y;
 };
 // 33,500 connected top triangles are protected before a single cosmetic prop.
 const minX=-540,maxX=600,minZ=-1130,maxZ=330,nx=125,nz=134,dx=(maxX-minX)/nx,dz=(maxZ-minZ)/nz;
 const heights:number[]=[];for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++)heights.push(terrainY(minX+x*dx,minZ+z*dz));
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const x0=minX+x*dx,z0=minZ+z*dz,cell=[vec(x0,0,z0),vec(x0+dx,0,z0),vec(x0+dx,0,z0+dz),vec(x0,0,z0+dz)];let cap=Infinity;for(const f of roadIndex.query(x0,x0+dx,z0,z0+dz))if(footprintArea(intersectRoadFootprint(f.points,cell))>1e-10)cap=Math.min(cap,f.minY-.38);const i=z*(nx+1)+x;for(const j of [i,i+1,i+nx+1,i+nx+2])heights[j]=Math.min(heights[j],cap);}
 const terrainVertices:number[]=[],terrainTriangles:number[][][]=[];
 for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){const i=z*(nx+1)+x,p=vec(minX+x*dx,heights[i],minZ+z*dz);ground.vertex(p,[x*.31,z*.31]);terrainVertices.push(...tuple(p));}
 // A continuous vertex field exposes broad slate ribs beneath snowy crests.
 // Its contours cut the existing physical triangles exactly; no whole-cell
 // checkerboard threshold changes either height or the terrain's support plane.
 const terrainExposure:number[]=[],terrainPartitions:SnowSceneGeometry['terrainPartitions']=[];
 for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){
  const i=z*(nx+1)+x,wx=minX+x*dx,wz=minZ+z*dz,left=heights[z*(nx+1)+Math.max(0,x-1)],right=heights[z*(nx+1)+Math.min(nx,x+1)],back=heights[Math.max(0,z-1)*(nx+1)+x],front=heights[Math.min(nz,z+1)*(nx+1)+x],gx=(right-left)/(dx*(x===0||x===nx?1:2)),gz=(front-back)/(dz*(z===0||z===nz?1:2)),slope=Math.hypot(gx,gz);
  // World-space, low-frequency variation creates unequal geological lips,
  // not grid-phase stripes. High crests naturally retain low-slope snow caps.
  const threshold=.39+.105*Math.sin(wx*.012+Math.sin(wz*.009)*.8)+.065*Math.cos(wz*.017-wx*.004),lowCover=.75*(1-smooth((heights[i]-22)/8));
  terrainExposure.push(slope-threshold-lowCover);
 }
 type ContourVertex={p:pc.Vec3;key:string;value:number};
 const intersections=new Map<string,ContourVertex>(),snowVertices=new Map<string,number>(),slateVertices=new Map<string,number>();
 const sourceVertex=(i:number):ContourVertex=>({p:vec(...terrainVertices.slice(i*3,i*3+3) as [number,number,number]),key:'v:'+i,value:terrainExposure[i]});
 const contour=(ids:number[],positive:boolean)=>{
  const poly=ids.map(sourceVertex),out:ContourVertex[]=[];
  for(let k=0;k<3;k++){const a=poly[k],b=poly[(k+1)%3],inside=positive?a.value>=0:a.value<=0,nextInside=positive?b.value>=0:b.value<=0;if(inside)out.push(a);if(inside!==nextInside){const lo=Math.min(ids[k],ids[(k+1)%3]),hi=Math.max(ids[k],ids[(k+1)%3]),key='e:'+lo+':'+hi;let cut=intersections.get(key);if(!cut){const aa=sourceVertex(lo),bb=sourceVertex(hi),t=aa.value/(aa.value-bb.value);cut={p:aa.p.clone().lerp(aa.p,bb.p,t),key,value:0};intersections.set(key,cut);}out.push(cut);}}
  return out.filter((p,i)=>p.p.distance(out[(i+out.length-1)%out.length].p)>1e-10);
 };
 const emitContour=(sourceTriangle:number,poly:ContourVertex[],material:'snow'|'slate')=>{
  if(poly.length<3)return;const b=material==='snow'?ground:slate,cache=material==='snow'?snowVertices:slateVertices,first=b.indices.length;
  const index=(v:ContourVertex)=>{if(material==='snow'&&v.key.startsWith('v:'))return Number(v.key.slice(2));let i=cache.get(v.key);if(i===undefined){i=b.positions.length/3;b.vertex(v.p,material==='snow'?[(v.p.x-minX)/dx*.31,(v.p.z-minZ)/dz*.31]:[v.p.x*.15,v.p.z*.15]);cache.set(v.key,i);}return i;};
  for(let k=1;k<poly.length-1;k++){const t=[poly[0],poly[k],poly[k+1]];if(footprintArea(t.map(v=>v.p))>1e-9)b.indices.push(...t.map(index));}
  if(b.indices.length>first)terrainPartitions.push({sourceTriangle,material,indexStart:first,indexEnd:b.indices.length});
 };
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const i=z*(nx+1)+x;for(const ids of [[i,i+nx+1,i+1],[i+1,i+nx+1,i+nx+2]]){const sourceTriangle=terrainTriangles.length;terrainTriangles.push(ids.map(i=>terrainVertices.slice(i*3,i*3+3)));emitContour(sourceTriangle,contour(ids,false),'snow');emitContour(sourceTriangle,contour(ids,true),'slate');}}
 bound('connected-snow-bowl-heightfield',ground,0,'terrain',false,0);bound('connected-slate-exposures-heightfield',slate,0,'terrain',false,0);
 const terrainGrid:CameraHeightfield={minX,minZ,columns:nx+1,rows:nz+1,dx,dz,heights};
 cameraObstacles.push({kind:'snow-exact-connected-terrain',min:[minX,Math.min(...heights),minZ],max:[maxX,Math.max(...heights),maxZ],heightfield:terrainGrid});
 const groundY=(x:number,z:number)=>cameraTerrainHeight(terrainGrid,x,z)??terrainY(x,z);
 const terrainPieces=(polygon:pc.Vec3[])=>{const x0=clamp(Math.floor((Math.min(...polygon.map(p=>p.x))-minX)/dx),0,nx-1),x1=clamp(Math.floor((Math.max(...polygon.map(p=>p.x))-minX)/dx),0,nx-1),z0=clamp(Math.floor((Math.min(...polygon.map(p=>p.z))-minZ)/dz),0,nz-1),z1=clamp(Math.floor((Math.max(...polygon.map(p=>p.z))-minZ)/dz),0,nz-1),out:pc.Vec3[][]=[];const v=(i:number)=>vec(...terrainVertices.slice(i*3,i*3+3) as [number,number,number]);for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const i=z*(nx+1)+x;for(const t of [[i,i+nx+1,i+1],[i+1,i+nx+1,i+nx+2]]){const p=intersectRoadFootprint(t.map(v),polygon);if(p.length>=3&&footprintArea(p)>1e-9)out.push(p);}}return out;};
 const terrainExtrema=(polygon:pc.Vec3[])=>{let low=Infinity,high=-Infinity;for(const p of terrainPieces(polygon))for(const v of p){low=Math.min(low,v.y);high=Math.max(high,v.y);}return{low,high};};
 const rect=(p:pc.Vec3,w:number,d:number,yaw=0)=>{const at=local(p,yaw);return[at(-w/2,0,-d/2),at(w/2,0,-d/2),at(w/2,0,d/2),at(-w/2,0,d/2)];};
 const foundation=(kind:string,p:pc.Vec3,w:number,d:number,yaw=0,top?:number)=>{const footprint=rect(p,w,d,yaw),ext=terrainExtrema(footprint),bottom=ext.low-.22;p.y=top??ext.high+.16;box(kind+'-continuous-foundation',foundationStone,vec(p.x,(p.y-.16+bottom)/2,p.z),vec(w,p.y-.16-bottom,d),yaw,'support');box(kind+'-foundation-cap',paleStone,vec(p.x,p.y-.08,p.z),vec(w,.16,d),yaw,'support');foundations.push({kind,top:p.y,bottom,footprint:footprint.map(tuple),terrainLow:ext.low,terrainHigh:ext.high});return local(p,yaw);};
 const grounded=(kind:string,x:number,z:number,w:number,d:number,top:number,b:Batch=foundationStone,yaw=0,role:Role='detail')=>{const footprint=rect(vec(x,0,z),w,d,yaw),bottom=terrainExtrema(footprint).low-.10;box(kind,b,vec(x,(top+bottom)/2,z),vec(w,top-bottom,d),yaw,role);groundedDetails.push({kind,x,z,bottom,terrainY:groundY(x,z),footprint:footprint.map(tuple)});return bottom;};
  // Exact spatial triangle ownership across every branch overlap, including
  // the full coplanar fork and merge lobes beyond the shared tail.
  const priority=new Map([[course.commonStart,0],[course.commonFinish,1],[course.alternates.boulevard,2],[course.alternates.alley,3]]),ownership=new Map<string,boolean>();
  for(const f of sourceFaces){let fragments=[f.points];for(const owner of roadIndex.query(f.minX,f.maxX,f.minZ,f.maxZ)){if(priority.get(owner.edge)!>=priority.get(f.edge)!)continue;fragments=fragments.flatMap(p=>subtractRoadFootprint(p,owner.points));if(!fragments.length)break;}const key=f.edge.id+':'+f.distance;ownership.set(key,(ownership.get(key)??false)||fragments.length>0);for(const poly of fragments)for(let i=1;i<poly.length-1;i++){const p=[poly[0],poly[i],poly[i+1]];if(footprintArea(p)<1e-8)continue;(f.edge===course.alternates.alley?paving:road).tri(...p as [pc.Vec3,pc.Vec3,pc.Vec3]);const under=[p[2],p[1],p[0]].map(q=>q.clone().add(vec(0,-.22,0)));supportStone.tri(...under as [pc.Vec3,pc.Vec3,pc.Vec3]);roadFaces.push({edgeId:f.edge.id,distance:f.distance,points:p.map(tuple)});roadUndersideFaces.push({edgeId:f.edge.id,distance:f.distance,points:under.map(tuple)});}}
  bound('road-source-owned-packed-snow',road,0,'road',false,0);
  bound('road-source-owned-technical-paving',paving,0,'road',false,0);
  bound('road-source-owned-underside',supportStone,0,'support',false,0);
  const shoulderVertexStart=supportStone.positions.length/3,shoulderIndexStart=supportStone.indices.length;
  // Shoulders are source-affine ribbons blending to the actual terrain at 8 m.
  // Their complete polygons are clipped by roads AND earlier shoulder owners.
  const cleanPolygon=(input:pc.Vec3[])=>{let poly=input.filter((p,i)=>p.distance(input[(i+input.length-1)%input.length])>1e-8);let changed=true;while(changed&&poly.length>3){changed=false;for(let i=0;i<poly.length;i++){const a=poly[(i+poly.length-1)%poly.length],b=poly[i],c=poly[(i+1)%poly.length];if(Math.abs((b.x-a.x)*(c.z-b.z)-(b.z-a.z)*(c.x-b.x))<1e-9){poly.splice(i,1);changed=true;break;}}}return poly;};
  const shoulderMetrics=new WeakMap<ReturnType<typeof roadFootprint>,{a:pc.Vec3;b:pc.Vec3;sign:number;length:number}>();
  const shoulderDistance=(f:ReturnType<typeof roadFootprint>,p:pc.Vec3)=>{const q=shoulderMetrics.get(f)!;return ((q.b.x-q.a.x)*(p.z-q.a.z)-(q.b.z-q.a.z)*(p.x-q.a.x))*q.sign/q.length;};
  const rawShoulders=edges.flatMap(edge=>{const out:ReturnType<typeof roadFootprint>[]=[],n=Math.ceil(edge.length/1.65);for(let i=0;i<n;i++){const s=i/n*edge.length,t=(i+1)/n*edge.length;for(const side of [-1,1]){const a=point(edge,s,side*edge.halfWidthAt(s)),b=point(edge,t,side*edge.halfWidthAt(t)),c=point(edge,s,side*(edge.halfWidthAt(s)+8)),d=point(edge,t,side*(edge.halfWidthAt(t)+8));c.y=groundY(c.x,c.z)-.03;d.y=groundY(d.x,d.z)-.03;for(const tri of [[a,c,b],[b,c,d]]){const face=roadFootprint(edge,s,tri);shoulderMetrics.set(face,{a,b,sign:Math.sign((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x)),length:Math.hypot(b.x-a.x,b.z-a.z)});out.push(face);}}}return out;}),shoulderIndex=new RoadFootprintIndex(rawShoulders),shoulderOrder=new Map(rawShoulders.map((f,i)=>[f,i]));
  for(const f of rawShoulders){let fragments=[f.points];for(const owner of roadIndex.query(f.minX,f.maxX,f.minZ,f.maxZ)){if(footprintArea(intersectRoadFootprint(f.points,owner.points))<1e-8)continue;fragments=fragments.flatMap(p=>subtractRoadFootprint(p,owner.points));if(!fragments.length)break;}for(const owner of shoulderIndex.query(f.minX,f.maxX,f.minZ,f.maxZ)){if(owner.edge===f.edge)continue;const overlap=intersectRoadFootprint(f.points,owner.points);if(footprintArea(overlap)<1e-8)continue;const cut:pc.Vec3[]=[],delta=(p:pc.Vec3)=>shoulderDistance(f,p)-shoulderDistance(owner,p)+(shoulderOrder.get(owner)!<shoulderOrder.get(f)!?1e-10:-1e-10);for(let i=0;i<overlap.length;i++){const p=overlap[i],q=overlap[(i+1)%overlap.length],a=delta(p),b=delta(q);if(a>=0)cut.push(p);if((a>=0)!==(b>=0))cut.push(p.clone().lerp(p,q,a/(a-b)));}if(cut.length<3||footprintArea(cut)<1e-8)continue;fragments=fragments.flatMap(p=>subtractRoadFootprint(p,cleanPolygon(cut)));if(!fragments.length)break;}for(const poly of fragments)for(let i=1;i<poly.length-1;i++){const p=[poly[0],poly[i],poly[i+1]];if(footprintArea(p)<1e-8)continue;if(new pc.Vec3().cross(p[1].clone().sub(p[0]),p[2].clone().sub(p[0])).y<0)[p[1],p[2]]=[p[2],p[1]];supportStone.tri(...p as [pc.Vec3,pc.Vec3,pc.Vec3]);shoulderFaces.push({edgeId:f.edge.id,distance:f.distance,points:p.map(tuple)});}}
  bound('exact-source-shoulder-stitches',supportStone,shoulderVertexStart,'support',false,shoulderIndexStart);
  meshBlock('exact-source-shoulder-triangles',shoulderFaces.map(f=>f.points));
  for(const edge of edges){const n=Math.ceil(edge.length/1.65);for(let i=0;i<n;i++){const s=i/n*edge.length,t=(i+1)/n*edge.length,w=edge.halfWidthAt(s),wt=edge.halfWidthAt(t),a=point(edge,s,-w),b=point(edge,s,w),sample={edgeId:edge.id,distance:s,left:tuple(a),right:tuple(b),rendered:ownership.get(edge.id+':'+s)??false};roadSamples.push(sample);routeRoadSamples.push(sample);
    for(const side of [-1,1]){const p=point(edge,s,side*w),q=point(edge,t,side*wt),mid=p.clone().lerp(p,q,.5),other=(f:typeof sourceFaces[number])=>f.edge!==edge;if(!roadIndex.clearAt(mid.x,mid.z,p.distance(q)/2+.025,other))continue;const out=point(edge,s,side*(w+.36),.024),next=point(edge,t,side*(wt+.36),.024);const copingStart=paving.positions.length/3;if(side>0)paving.quad(p.clone().add(vec(0,.024,0)),out,q.clone().add(vec(0,.024,0)),next);else paving.quad(out,p.clone().add(vec(0,.024,0)),next,q.clone().add(vec(0,.024,0)));bound('road-edge-coping',paving,copingStart,'visual-coping',false);
      if(i%20===0){const end=Math.min(edge.length,s+10.5),u=point(edge,s,side*(w+.68),1.02),v=point(edge,end,side*(edge.halfWidthAt(end)+.68),1.02),middle=u.clone().lerp(u,v,.5);if(roadIndex.clearAt(middle.x,middle.z,u.distance(v)/2+.20,other)){const points=beam('exposed-snow-road-rail',teal,u,v,.22,.27,'rail');railMembers.push({edgeId:edge.id,distance:s,side,points:points.map(tuple)});grounded('road-rail-grounded-post',u.x,u.z,.30,.30,u.y+.3,timber,0,'rail');}}}
    if(i%12===0&&ownership.get(edge.id+':'+s)){const h=.027;for(const side of [-1,1]){const l=side*w*.48;snowShade.quad(point(edge,s,l-.06,h),point(edge,s,l+.06,h),point(edge,t,l-.06,h),point(edge,t,l+.06,h));}}
  }}
  meshBlock('exact-exposed-snow-rail-triangles',components.filter(c=>c.role==='rail').flatMap(facesFor));
  for(let row=0;row<2;row++)for(let col=0;col<16;col++)if((row+col)%2===0){const e=course.commonStart,s=row*.7,t=(row+1)*.7,w=e.halfWidthAt(s);inlay.quad(point(e,s,-w+col*w/8,.03),point(e,s,-w+(col+1)*w/8,.03),point(e,t,-w+col*w/8,.03),point(e,t,-w+(col+1)*w/8,.03));}


  if(snowShade.indices.length)bound('diffuse-racing-wheelmarks',snowShade,0,'visual-coping',false,0);
  if(inlay.indices.length)bound('start-line-checker-inlay',inlay,0,'visual-coping',false,0);
 // Roofs are closed sloping slabs, each snow underside is the same plane as
 // its slate seat. Truss ends, eave beams and post caps have named contacts.
 const roofPanel=(kind:string,b:Batch,at:(x:number,y:number,z:number)=>pc.Vec3,x0:number,x1:number,y0:number,y1:number,z0:number,z1:number,thickness:number)=>{
  const a=at(x0,y0,z0),c=at(x1,y1,z0),d=at(x0,y0,z1),e=at(x1,y1,z1),v=[a,c,d,e,a.clone().add(vec(0,thickness,0)),c.clone().add(vec(0,thickness,0)),d.clone().add(vec(0,thickness,0)),e.clone().add(vec(0,thickness,0))],start=b.positions.length/3;
  for(const f of [[0,1,2,3],[4,6,5,7],[0,4,1,5],[2,3,6,7],[0,2,4,6],[1,5,3,7]])b.quad(v[f[0]],v[f[1]],v[f[2]],v[f[3]]);return bound(kind,b,start)!;
 };
 const gableRoof=(kind:string,at:(x:number,y:number,z:number)=>pc.Vec3,w:number,d:number,eave:number,rise:number,ridgeX=0)=>{
  const slabs:Component[]=[];for(const [x0,x1,y0,y1]of [[-w/2,ridgeX,eave,eave+rise],[ridgeX,w/2,eave+rise,eave]]){
   const slab=roofPanel(kind+'-thick-slate-roof',roofSlate,at,x0,x1,y0,y1,-d/2,d/2,.32),snow=roofPanel(kind+'-roof-seated-snow-cap',roofSnow,at,x0,x1,y0+.32,y1+.32,-d/2,d/2,.50);slabs.push(slab);contact(kind+'-snow-to-slate-seat',snow,slab);
   const inset=kind==='signal-house'?1.36:kind==='clock-hall'?1.35:kind==='plow-shed'?1.50:kind==='signal-turret'?1:.85,wallX=x0===-w/2?x0+inset:x1-inset,wallY=y0+(y1-y0)*(wallX-x0)/(x1-x0),bearing=box(kind+'-continuous-eave-bearing',timber,at(wallX,(eave+wallY)/2,0),vec(.40,Math.max(.06,wallY-eave),d-2),Math.atan2(at(0,0,1).x-at(0,0,0).x,at(0,0,1).z-at(0,0,0).z))!;contact(kind+'-eave-bearing-to-roof',bearing,slab);
   for(let j=1;j<=5;j++){const z=-d/2+j*d/6;beam(kind+'-supported-slate-roof-seam',steel,at(x0,y0+.335,z),at(x1,y1+.335,z),.055,.045,'detail');}
  }return slabs;
 };
 const seatedPost=(kind:string,at:(x:number,y:number,z:number)=>pc.Vec3,x:number,z:number,base:number,top:number,yaw:number)=>{
  const shoe=box(kind+'-stone-post-shoe',paleStone,at(x,base+.18,z),vec(.85,.36,.85),yaw)!,post=box(kind+'-tenoned-timber-post',teal,at(x,(base+.36+top)/2,z),vec(.43,top-base-.36,.43),yaw)!;contact(kind+'-post-to-shoe',post,shoe);return post;
 };
 const wall=(kind:string,at:(x:number,y:number,z:number)=>pc.Vec3,w:number,z:number,yaw:number,door=false)=>{
  const openings=3,step=w/openings,winW=Math.min(3.8,step-1.2),bottom=2.5,top=6.6,wallTop=8.2;
  // No continuous facade box behind the modeled openings. Jambs terminate
  // precisely beneath the lintel, avoiding coplanar nested exterior skins.
  for(let i=0;i<openings;i++){const x=-w/2+step*(i+.5),isDoor=door&&i===1;
   if(!isDoor)box(kind+'-window-low-wall',paleStone,at(x,bottom/2,z),vec(step,bottom,.72),yaw);
   const side=(step-winW)/2;for(const sign of [-1,1])box(kind+'-opening-jamb',teal,at(x+sign*(winW/2+side/2),(bottom+top)/2,z),vec(side,top-bottom,.72),yaw);
   if(isDoor)for(const sign of [-1,1])box(kind+'-door-lower-jamb',paleStone,at(x+sign*(winW/2+side/2),bottom/2,z),vec(side,bottom,.72),yaw);
   const lintel=box(kind+'-jamb-seated-lintel',teal,at(x,(top+wallTop)/2,z),vec(step,wallTop-top,.72),yaw)!;
   for(const c of components.slice(-7).filter(c=>c.kind===kind+'-opening-jamb'&&Math.abs(c.max[1]-lintel.min[1])<1e-7))contact(kind+'-jamb-lintel-bearing',c,lintel);
   if(!isDoor){box(kind+'-deep-window-sill',paleStone,at(x,bottom+.10,z-.08),vec(winW+.16,.20,.95),yaw);box(kind+'-deep-window-insert',i===0?warm:glass,at(x,(bottom+top)/2,z+.18),vec(winW-.10,top-bottom-.18,.10),yaw);
    box(kind+'-window-mullion',teal,at(x,(bottom+.20+top)/2,z-.1),vec(.15,top-bottom-.20,.30),yaw);for(const side of [-1,1])box(kind+'-window-transom',teal,at(x+side*(winW+.15)/4,bottom+2.15,z-.1),vec((winW-.15)/2,.13,.30),yaw);
   }
  }
 };
 const wheel=(kind:string,at:(x:number,y:number,z:number)=>pc.Vec3,x:number,z:number,r:number,width:number,supportY:number,supportKind:string,b:Batch=rubber)=>{
  const start=b.positions.length/3,profile=[[-width/2,r*.79],[-width/2,r],[width/2,r],[width/2,r*.79]],sides=32;for(const [axial,radius]of profile)for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2;b.vertex(at(x+axial,supportY+r+Math.cos(a)*radius,z+Math.sin(a)*radius),[j/sides,axial]);}for(let k=0;k<4;k++)for(let j=0;j<sides;j++){const a=start+k*sides+j,c=start+k*sides+(j+1)%sides,d=start+((k+1)%4)*sides+j,e=start+((k+1)%4)*sides+(j+1)%sides;b.indices.push(a,c,d,c,e,d);}const comp=bound(kind,b,start,'detail')!;
  const verts=Array.from({length:comp.vertexEnd-comp.vertexStart},(_,i)=>b.positions.slice((comp.vertexStart+i)*3,(comp.vertexStart+i)*3+3)),low=Math.min(...verts.map(p=>p[1])),lowest=verts.filter(p=>Math.abs(p[1]-low)<1e-9),worldSupport=at(x,supportY,z).y;
  wheelContacts.push({kind,component:components.indexOf(comp),supportKind,points:lowest,supportY:worldSupport,signedGap:low-worldSupport});
  for(let spoke=0;spoke<8;spoke++){const a=spoke*Math.PI/4;beam(kind+'-eight-joined-spoke',boards,at(x,supportY+r+Math.cos(a)*.17,z+Math.sin(a)*.17),at(x,supportY+r+Math.cos(a)*r*.90,z+Math.sin(a)*r*.90),.10,.12,'detail');}
  turned(kind+'-seated-hub',steel,(u,a,v)=>at(x+a,supportY+r+u,z+v),[[-width*.70,.19],[width*.70,.19]],16,'detail');return comp;
 };
 const parcelCart=(at:(x:number,y:number,z:number)=>pc.Vec3,cx:number,cz:number,yaw:number)=>{
  const r=.66;for(const z of [cz-1.20,cz+1.20]){for(const side of [-1,1])wheel('parcels-cart-actual-wheel',at,cx+side*1.4,z,r,.25,0,'station-platform');beam('parcels-cart-through-axle',steel,at(cx-1.62,r,z),at(cx+1.62,r,z),.18,.18,'detail');for(const side of [-1,1])box('parcels-cart-axle-to-frame-bearing',steel,at(cx+side*1.02,.85,z),vec(.24,.30,.34),yaw,'detail');}
  box('parcels-cart-supported-deck-frame',teal,at(cx,1.11,cz),vec(2.5,.3,3.4),yaw);for(let i=0;i<7;i++)box('parcels-cart-seated-deck-slat',boards,at(cx,1.32,cz-1.45+i*.48),vec(2.5,.12,.43),yaw);
  for(const side of [-1,1]){beam('parcels-cart-push-handle',timber,at(cx+side*1.0,1.16,cz+1.5),at(cx+side*1.0,2.75,cz+2.1),.12,.12,'detail');}beam('parcels-cart-push-crossbar',timber,at(cx-1,2.75,cz+2.1),at(cx+1,2.75,cz+2.1),.14,.14,'detail');
  for(const [x,z,h]of [[-.55,-.55,1.0],[.5,.6,.75]]){box('parcels-cart-seated-tied-cargo',burlap,at(cx+x,1.38+h/2,cz+z),vec(.92,h,1.12),yaw);for(const k of [-.3,.3])box('parcels-cart-secured-cargo-binding',timber,at(cx+x+k,1.38+h/2,cz+z),vec(.055,h+.015,1.135),yaw,'detail');}
 };
 const bench=(at:(x:number,y:number,z:number)=>pc.Vec3,x:number,z:number,yaw:number)=>{
  const legs:Component[]=[];for(const q of [-1.5,1.5])legs.push(box('bench-continuous-seated-leg',steel,at(x+q,.50,z),vec(.16,1.0,1.0),yaw,'detail')!);
  for(const q of [-.38,0,.38]){const seat=box('bench-leg-supported-seat-slat',boards,at(x,1.04,z+q),vec(3.7,.13,.34),yaw,'detail')!;for(const leg of legs)contact('bench-seat-to-leg',seat,leg);}
  for(const q of [-1.5,1.5])box('bench-back-continuous-upright',steel,at(x+q,1.24,z+.44),vec(.13,1.55,.13),yaw,'detail');for(const y of [1.6,1.94])box('bench-supported-back-slat',boards,at(x,y,z+.44),vec(3.7,.26,.16),yaw,'detail');
 };
 // Natural landmark is a connected, closed rectangular radial surface whose
 // outline is tucked into terrain. Two unequal top lobes meet in a real saddle.
 {
  const p=plots[1];landmark=p.kind;const footprint=rect(vec(p.x,0,p.z),36,34),ext=terrainExtrema(footprint),base=ext.low-.18,at=local(vec(p.x,base,p.z));
  const n=42,m=38,vertices:pc.Vec3[]=[];for(let j=0;j<=m;j++)for(let i=0;i<=n;i++){const x=-18+36*i/n,z=-17+34*j/m,u=x/18,v=z/17,edge=Math.max(Math.abs(u),Math.abs(v)),blend=smooth((1-edge)/.30),one=29*Math.exp(-((x+7)**2/70+(z+3)**2/120)),two=25*Math.exp(-((x-8)**2/60+(z-3)**2/90)),peak=Math.max(one,two),floor=groundY(p.x+x,p.z+z)-base-.08;vertices.push(at(x,floor+blend*(3+peak),z));}
  const starts=batches.map(b=>[b.positions.length/3,b.indices.length]);for(let j=0;j<m;j++)for(let i=0;i<n;i++){const k=j*(n+1)+i;for(const ids of [[k,k+n+1,k+1],[k+1,k+n+1,k+n+2]]){const t=ids.map(k=>vertices[k]),normal=new pc.Vec3().cross(t[1].clone().sub(t[0]),t[2].clone().sub(t[0])).normalize(),b=normal.y>.59?roofSnow:((i+Math.floor(j/4))%7<2?snowShade:slate);b.tri(...t as [pc.Vec3,pc.Vec3,pc.Vec3]);}}
  for(const [k,b]of batches.entries())if(b.indices.length>starts[k][1])bound('split-ridge-connected-snow-slate-surface',b,starts[k][0],'terrain',false,starts[k][1]);
  const top=Math.max(...vertices.map(v=>v.y));landforms.push({kind:p.kind,footprint:footprint.map(tuple),bottom:base,top});landmarks.push({kind:p.kind,label:p.label,position:[p.x,ext.high,p.z],radius:p.r,height:p.h});props.push({kind:p.kind,x:p.x,y:ext.high,z:p.z,radius:p.r});
 }
 // Ridge signal house with real window holes, deep masonry sill courses,
 // open porch, asymmetrical roof and a separate open-slit observation turret.
 {
  const p=plots[0];landmark=p.kind;const yaw=.20,base=vec(p.x,0,p.z),at=foundation(p.kind,base,21,19,yaw),cap=components.at(-1)!;
  wall('signal-house-front',at,18,-5.8,yaw,true);wall('signal-house-rear',at,18,5.8,yaw);
  for(const side of [-1,1])box('signal-house-side-bearing-wall',paleStone,at(side*8.64,4.1,0),vec(.72,8.2,10.88),yaw);
  const roofs=gableRoof('signal-house',at,20,14,8.2,4.2,-1.6);
  for(const z of [-5.4,5.4]){beam('signal-house-roof-seated-tie',timber,at(-9.85,8.13,z),at(9.85,8.13,z),.3,.36);const tie=components.at(-1)!;for(const x of [-10,10]){beam('signal-house-open-truss-rafter',timber,at(x,8.2,z),at(-1.6+(x<0?-.22:.22),12.30,z),.25,.30);contact('signal-rafter-roof-bearing',components.at(-1)!,roofs[x<0?0:1]);contact('signal-rafter-tie-bearing',components.at(-1)!,tie);}}
  box('signal-house-truss-seated-ridge-beam',timber,at(-1.6,12.20,0),vec(.50,.40,11.4),yaw);
  const porchPosts:Component[]=[];for(const x of [-8,0,8])porchPosts.push(seatedPost('signal-porch',at,x,-8.3,0,6.1,yaw));
  const bar=box('signal-porch-seated-eave-beam',teal,at(0,6.28,-8.3),vec(17,.36,.5),yaw)!;for(const post of porchPosts){contact('signal-porch-post-beam',post,bar);const shoe=components.find(c=>c.kind==='signal-porch-stone-post-shoe'&&Math.abs((c.min[0]+c.max[0])-(post.min[0]+post.max[0]))<1e-7&&Math.abs((c.min[2]+c.max[2])-(post.min[2]+post.max[2]))<1e-7)!;contact('signal-porch-shoe-foundation',shoe,cap);}
  const canopy=roofPanel('signal-porch-supported-canopy',roofSlate,at,-9.3,9.3,6.46,6.46,-9,-5.4,.27),snow=roofPanel('signal-porch-roof-seated-snow',roofSnow,at,-9.3,9.3,6.73,6.73,-9,-5.4,.43);contact('signal-porch-roof-beam',canopy,bar);contact('signal-porch-snow-roof',snow,canopy);
  // Six-metre turret rises from bearing walls, not from an unsupported roof.
  const tx=4.5,tz=1.2;for(const sx of [-1,1])for(const sz of [-1,1])box('signal-turret-continuous-corner-pier',paleStone,at(tx+sx*2.5,9.45,tz+sz*2.5),vec(1,18.9,1),yaw);
  for(const z of [-2.5,2.5]){box('signal-turret-lower-spandrel',teal,at(tx,15.5,tz+z),vec(4,1.3,1),yaw);box('signal-turret-slit-seated-lintel',paleStone,at(tx,18.25,tz+z),vec(4,1.3,1),yaw);for(const x of [-1.3,1.3])box('signal-turret-slit-mullion',teal,at(tx+x,16.9,tz+z),vec(.28,1.5,.85),yaw);}
  for(const x of [-2.5,2.5]){box('signal-turret-side-spandrel',teal,at(tx+x,15.5,tz),vec(1,1.3,4),yaw);box('signal-turret-side-lintel',paleStone,at(tx+x,18.25,tz),vec(1,1.3,4),yaw);}
  gableRoof('signal-turret',(x,y,z)=>at(tx+x,y,tz+z),7,7,18.9,3.2,.5);
  const mast=box('signal-house-socketed-direction-mast',steel,at(-7.2,3.8,-1),vec(.30,7.6,.30),yaw)!;for(const [y,x]of [[5.8,1],[6.7,-1]]){const paddle=box('signal-house-supported-teal-paddle',teal,at(-7.2+x*1.3,y,-1),vec(2.8,.52,.20),yaw)!;contact('signal-paddle-mast',paddle,mast);}
  landmarks.push({kind:p.kind,label:p.label,position:tuple(base),radius:p.r,height:p.h});props.push({kind:p.kind,x:p.x,y:base.y,z:p.z,radius:p.r});
 }
 // Clock hall uses a long west-facing platform. Its open porch is an empty
 // volume under separate thin roof plates, with no hidden facade behind it.
 {
  const p=plots[2];landmark=p.kind;const yaw=Math.PI/2,base=vec(p.x,0,p.z),at=foundation(p.kind,base,38,31,yaw,terrainExtrema(rect(base,38,31,yaw)).high+.72);
  wall('clock-hall-platform-front',at,36,-10.5,yaw,true);wall('clock-hall-rear',at,36,10.5,yaw);
  for(const x of [-17.65,17.65])box('clock-hall-side-bearing-wall',paleStone,at(x,4.1,0),vec(.70,8.2,20.28),yaw);
  gableRoof('clock-hall',at,38,23,8.2,3.9,-2);
  const posts:Component[]=[];for(const x of [-16,-8,0,8,16])posts.push(seatedPost('clock-platform-porch',at,x,-14.2,0,6.4,yaw));
  const eave=box('clock-platform-post-seated-beam',teal,at(0,6.62,-14.2),vec(34,.44,.60),yaw)!;for(const post of posts)contact('clock-platform-post-beam',post,eave);
  const canopy=roofPanel('clock-platform-open-canopy-slate',roofSlate,at,-18.5,18.5,6.84,6.84,-15.2,-10.15,.30),snow=roofPanel('clock-platform-canopy-seated-snow',roofSnow,at,-18.5,18.5,7.14,7.14,-15.2,-10.15,.50);contact('clock-platform-canopy-beam',canopy,eave);contact('clock-platform-snow-slate',snow,canopy);
  for(const x of [-16,-8,0,8,16]){beam('clock-platform-seated-knee-brace',timber,at(x,5.6,-14.2),at(x+1.3,6.4,-14.2),.2,.24);beam('clock-platform-rear-roof-bearing',timber,at(x,6.55,-14.2),at(x,7.3,-10.1),.22,.3);}
  const tx=10,tz=2.9;for(const sx of [-1,1])box('clock-tower-continuous-side-wall',paleStone,at(tx+sx*3.35,10.15,tz),vec(.7,20.3,7.4),yaw);
  for(const sz of [-1,1]){box('clock-tower-front-back-lower-wall',teal,at(tx,9.25,tz+sz*3.35),vec(6,18.5,.7),yaw);box('clock-tower-recess-top-lintel',paleStone,at(tx,19.8,tz+sz*3.35),vec(6,1.0,.7),yaw);for(const x of [-2.8,2.8])box('clock-tower-recess-side-jamb',paleStone,at(tx+x,18.9,tz+sz*3.35),vec(.4,.8,.7),yaw);box('clock-tower-deep-upper-slit',darkStone,at(tx,18.9,tz+sz*3.05),vec(5.2,.8,.10),yaw);}
  gableRoof('clock-tower', (x,y,z)=>at(tx+x,y,tz+z),8.4,8.4,20.3,3.0,.65);
  const dialY=16.0,dialZ=tz-3.76;
  const mounting=turned('clock-deep-seated-stone-dial',paleStone,(u,a,v)=>at(tx+u,dialY+v,dialZ+a),[[-.20,2.5],[.20,2.5]],48);
  const disk=turned('clock-bronze-recessed-dial-face',bronze,(u,a,v)=>at(tx+u,dialY+v,dialZ-.23+a),[[-.05,2.20],[.05,2.20]],48);contact('clock-dial-stone-seat',disk,mounting);
  const path=Array.from({length:49},(_,i)=>{const a=i/48*Math.PI*2;return at(tx+Math.cos(a)*2.30,dialY+Math.sin(a)*2.30,dialZ-.29);});tube('clock-supported-bronze-dial-rim',bronze,path,path.map(()=>.12),8,false,false,'detail');
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;beam('clock-twelve-original-radial-tick',inlay,at(tx+Math.sin(a)*1.72,dialY+Math.cos(a)*1.72,dialZ-.30),at(tx+Math.sin(a)*2.02,dialY+Math.cos(a)*2.02,dialZ-.30),.10,.08,'detail');}
  turned('clock-dial-seated-hand-arbor',bronze,(u,a,v)=>at(tx+u,dialY+v,dialZ+a),[[-.58,.16],[-.15,.16]],16,'detail');
  beam('clock-supported-hour-hand',teal,at(tx,dialY,dialZ-.35),at(tx-.70,dialY+1.04,dialZ-.35),.18,.10,'detail');beam('clock-supported-minute-hand',teal,at(tx,dialY,dialZ-.46),at(tx+1.54,dialY+.45,dialZ-.46),.12,.10,'detail');
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;beam('clock-original-central-snowflake',inlay,at(tx+Math.cos(a)*.17,dialY+Math.sin(a)*.17,dialZ-.53),at(tx+Math.cos(a)*.32,dialY+Math.sin(a)*.32,dialZ-.53),.06,.06,'detail');}
  bench(at,-8,-13.8,yaw);bench(at,7,-13.8,yaw);parcelCart(at,-14,-12.7,yaw);
  // Three contiguous height bands form the steps. They never duplicate a
  // ground-to-top box skin at another shelf level.
  for(let i=0;i<3;i++){const z=-16.0-i*.85,q=at(0,0,z),top=base.y-.10-i*.18;grounded('clock-platform-contiguous-entry-step',q.x,q.z,5.4,.85,top,foundationStone,yaw,'support');}
  for(const x of [-18,18])for(let i=0;i<5;i++){const z=-7+i*3.5;box('clock-platform-anchored-low-baluster',teal,at(x,.55,z),vec(.14,1.1,.14),yaw,'detail');}for(const x of [-18,18])box('clock-platform-baluster-supported-caprail',teal,at(x,1.08,0),vec(.20,.18,15),yaw,'detail');
  landmarks.push({kind:p.kind,label:p.label,position:tuple(base),radius:p.r,height:p.h});props.push({kind:p.kind,x:p.x,y:base.y,z:p.z,radius:p.r});
 }
 // Open faceted roundhouse. Pier-built apertures expose floor, trusses and
 // back walls. All siding and sleepers stay inside the off-road court disk.
 {
  const p=plots[3];landmark=p.kind;const yaw=-Math.PI/2,base=vec(p.x,0,p.z),at=foundation(p.kind,base,28,25,yaw);
  const front=-7.7,back=9.2,piers:Component[]=[];
  for(const x of [-13,-4.35,4.35,13]){const pier=box('roundhouse-continuous-bay-pier',paleStone,at(x,3.8,front),vec(1.25,7.6,1.4),yaw)!;piers.push(pier);}
  for(const x of [-8.7,0,8.7]){const lintel=box('roundhouse-pier-seated-bay-lintel',teal,at(x,8.0,front),vec(7.45,.80,1.4),yaw)!;for(const pier of piers)if([0,2].every(k=>Math.min(pier.max[k],lintel.max[k])-Math.max(pier.min[k],lintel.min[k])>-.02)&&Math.abs(pier.max[1]-lintel.min[1])<1e-6)contact('roundhouse-jamb-lintel-contact',pier,lintel);}
  // Unequal wall facets curve the rear plan without a black painted bay.
  const wallPath=[[-13,front],[-13,3],[-9,9.2],[6,9.2],[13,4],[13,front]],miters=wallPath.map((p,i)=>{const directions=[wallPath[Math.max(0,i-1)],wallPath[Math.min(wallPath.length-1,i+1)]],dx=directions[1][0]-directions[0][0],dz=directions[1][1]-directions[0][1],length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length;const q=wallPath[Math.min(i+1,wallPath.length-1)],a=wallPath[Math.max(0,i-1)],ex=i===wallPath.length-1?p[0]-a[0]:q[0]-p[0],ez=i===wallPath.length-1?p[1]-a[1]:q[1]-p[1],el=Math.hypot(ex,ez),scale=.4/(nx*(-ez/el)+nz*(ex/el));return[nx*scale,nz*scale];});
  for(let i=0;i<wallPath.length-1;i++){const a=wallPath[i],b=wallPath[i+1],na=miters[i],nb=miters[i+1],poly=[at(a[0]+na[0],0,a[1]+na[1]),at(b[0]+nb[0],0,b[1]+nb[1]),at(a[0]-na[0],0,a[1]-na[1]),at(b[0]-nb[0],0,b[1]-nb[1])],v=[...poly,...poly.map(p=>p.clone().add(vec(0,8.4,0)))],start=paleStone.positions.length/3;for(const f of [[0,1,2,3],[4,6,5,7],[0,4,1,5],[2,3,6,7],[0,2,4,6],[1,5,3,7]])paleStone.quad(v[f[0]],v[f[1]],v[f[2]],v[f[3]]);bound('roundhouse-faceted-continuous-rear-wall',paleStone,start);}
  for(const [x,w,rise]of [[-8.65,8.7,3.0],[0,8.6,3.7],[8.65,8.7,2.6]]){const bat=(u:number,y:number,z:number)=>at(x+u,y,z+.75);const roofs=gableRoof('roundhouse-unequal-bay',bat,w,20.1,8.4,rise,.35);for(const z of [-7.7,5.5]){beam('roundhouse-visible-bearing-tie',timber,at(x-w/2+.1,8.3,z),at(x+w/2-.1,8.3,z),.24,.35);const tie=components.at(-1)!;for(const side of [-1,1]){beam('roundhouse-open-truss-rafter',timber,at(x+side*w/2,8.4,z),at(x+.35+side*.22,8.30+rise,z),.22,.26);contact('roundhouse-rafter-roof-bearing',components.at(-1)!,roofs[side<0?0:1]);contact('roundhouse-rafter-tie-bearing',components.at(-1)!,tie);}box('roundhouse-truss-seated-ridge-beam',timber,at(x+.35,8.20+rise,z),vec(.50,.40,.40),yaw);}}
  box('roundhouse-third-bay-sliding-door',teal,at(10.8,3.65,front-.22),vec(3.9,7.3,.35),yaw);for(let i=0;i<8;i++)box('roundhouse-door-seated-plank-batten',boards,at(9.1+i*.47,3.65,front-.43),vec(.10,7.2,.12),yaw,'detail');for(const x of [9.5,12])box('roundhouse-door-supported-hanger',steel,at(x,7.90,front-.40),vec(.10,1.20,.12),yaw,'detail');box('roundhouse-supported-door-track',steel,at(8.7,8.55,front-.48),vec(7.8,.15,.22),yaw,'detail');
  const railTop=.47;for(const cx of [-7.0,3.8]){
   for(let i=0;i<12;i++){const z=-11+i*1.75;box('siding-platform-seated-sleeper',timber,at(cx,.10,z),vec(3.1,.20,.35),yaw,'support');for(const side of [-1,1]){box('siding-sleeper-seated-rail-shoe',steel,at(cx+side*.90,.22,z),vec(.53,.04,.42),yaw,'detail');for(const sign of [-1,1])turned('siding-seated-rail-bolt',bronze,(u,y,v)=>at(cx+side*.9+sign*.22+u,.24+y,z+v),[[0,.07],[.06,.07]],8,'detail');}}
   for(const side of [-1,1]){box('siding-sleeper-bearing-rail-web',steel,at(cx+side*.90,.33,-1.35),vec(.13,.18,20.7),yaw,'rail');box('siding-continuous-raised-rail-head',steel,at(cx+side*.90,.445,-1.35),vec(.46,.05,20.7),yaw,'rail');}
   const buffer=box('siding-buffer-seated-stop-beam',oxide,at(cx,1.05,8.8),vec(2.7,.40,.40),yaw)!;for(const side of [-1,1]){beam('siding-buffer-triangular-grounded-brace',steel,at(cx+side*1.30,.0,7.7),at(cx+side*1.30,1.05,8.8),.16,.18);beam('siding-buffer-grounded-upright',steel,at(cx+side*1.05,0,8.8),at(cx+side*1.05,1.05,8.8),.20,.20);contact('siding-buffer-brace-beam',components.at(-1)!,buffer);}
  }
  const cx=-7,cz=-4.1,r=.58;for(const z of [cz-1.35,cz+1.35]){for(const side of [-1,1])wheel('inspection-trolley-flanged-wheel',at,cx+side*.90,z,r,.31,railTop,'siding-continuous-raised-rail-head',steel);beam('inspection-trolley-exposed-through-axle',steel,at(cx-1.18,railTop+r,z),at(cx+1.18,railTop+r,z),.15,.15,'detail');}
  box('inspection-trolley-axle-seated-frame',oxide,at(cx,1.69,cz),vec(1.4,.22,3.4),yaw);for(let i=0;i<7;i++)box('inspection-trolley-frame-seated-slat',boards,at(cx,1.88,cz-1.45+i*.48),vec(2.1,.16,.43),yaw,'detail');for(const side of [-1,1])for(const z of [cz-1.35,cz+1.35])box('inspection-trolley-paired-spring-block',steel,at(cx+side*.50,1.375,z),vec(.26,.50,.62),yaw,'detail');
  for(const side of [-1,1])beam('inspection-trolley-joined-pump-post',teal,at(cx+side*.66,1.96,cz),at(cx+side*.66,3.10,cz),.15,.15);beam('inspection-trolley-supported-hand-lever',boards,at(cx-1.1,3.10,cz),at(cx+1.1,3.10,cz),.17,.20);
  landmarks.push({kind:p.kind,label:p.label,position:tuple(base),radius:p.r,height:p.h});props.push({kind:p.kind,x:p.x,y:base.y,z:p.z,radius:p.r});
 }
 // South return workshop: a genuinely open shed with visible load-bearing
 // trusses. The stationary wedge plow is an original curved two-plate assembly.
 {
  const p=plots[4];landmark=p.kind;const yaw=-.16,base=vec(p.x,0,p.z),at=foundation(p.kind,base,33,27,yaw);
  for(const x of [-14.5,14.5])box('plow-shed-continuous-side-wall',paleStone,at(x,3.9,.5),vec(1,7.8,17),yaw);
  box('plow-shed-continuous-rear-wall',paleStone,at(0,3.9,9.5),vec(28,7.8,1),yaw);
  const frontPosts:Component[]=[];for(const x of [-14,0,14])frontPosts.push(seatedPost('plow-shed-open-front',at,x,-8,0,7.4,yaw));
  const lintel=box('plow-shed-post-seated-front-lintel',timber,at(0,7.6,-8),vec(28,.40,.55),yaw)!;for(const post of frontPosts)contact('plow-shed-front-post-lintel',post,lintel);
  const roofs=gableRoof('plow-shed',at,32,21,7.8,3.8,-2.2);
  for(const z of [-8,-1,7]){beam('plow-shed-visible-truss-tie',timber,at(-15.85,7.68,z),at(15.85,7.68,z),.28,.42);const tie=components.at(-1)!;for(const x of [-16,16]){beam('plow-shed-open-diagonal-rafter',timber,at(x,7.8,z),at(-2.2+(x<0?-.22:.22),11.50,z),.26,.34);contact('plow-shed-rafter-roof-bearing',components.at(-1)!,roofs[x<0?0:1]);contact('plow-shed-rafter-tie-bearing',components.at(-1)!,tie);}box('plow-shed-truss-seated-ridge-beam',timber,at(-2.2,11.40,z),vec(.50,.40,.42),yaw);beam('plow-shed-seated-king-post',timber,at(-2.2,7.68,z),at(-2.2,11.6,z),.22,.26);}
  const cx=-6,cz=-3,r=.87;for(const side of [-1,1])wheel('snowplow-open-eight-spoke-wheel',at,cx+side*1.75,cz,r,.32,0,'plow-shed-platform',rubber);
  beam('snowplow-continuous-through-axle',steel,at(cx-2.05,r,cz),at(cx+2.05,r,cz),.24,.24);box('snowplow-axle-seated-chassis',oxide,at(cx,1.21,cz-.35),vec(2.8,.45,2.1),yaw);
  // Each curved blade is a thick closed parametric plate. The center nose,
  // rear ribs and chassis intersect its real underside rather than float.
  for(const side of [-1,1]){const start=oxide.positions.length/3,nu=18,nv=8;
   const v=(u:number,v:number,back:number)=>at(cx+side*(.04+u*2.65),.35+v*2.6,cz-3.9+u*1.55+.35*Math.sin(v*Math.PI)+back*.18);
   const grid=(back:number)=>{const offset=oxide.positions.length/3;for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++)oxide.vertex(v(i/nu,j/nv,back),[i/nu,j/nv]);for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=offset+j*(nu+1)+i;oxide.indices.push(...((back===1)!==(side<0)?[a,a+1,a+nu+1,a+1,a+nu+2,a+nu+1]:[a,a+nu+1,a+1,a+1,a+nu+1,a+nu+2]));}};grid(0);grid(1);
   for(const u of [0,1])for(let j=0;j<nv;j++){const first=oxide.indices.length;oxide.quad(v(u,j/nv,0),v(u,(j+1)/nv,0),v(u,j/nv,1),v(u,(j+1)/nv,1));if(side<0?u===0:u===1)for(let k=first;k<oxide.indices.length;k+=3)[oxide.indices[k+1],oxide.indices[k+2]]=[oxide.indices[k+2],oxide.indices[k+1]];}for(const q of [0,1])for(let i=0;i<nu;i++){const first=oxide.indices.length;oxide.quad(v(i/nu,q,0),v((i+1)/nu,q,0),v(i/nu,q,1),v((i+1)/nu,q,1));if(side>0?q===0:q===1)for(let k=first;k<oxide.indices.length;k+=3)[oxide.indices[k+1],oxide.indices[k+2]]=[oxide.indices[k+2],oxide.indices[k+1]];}bound('snowplow-thick-curved-wedge-blade',oxide,start,'structure',true);
   for(const u of [.22,.55,.86]){const path=Array.from({length:9},(_,i)=>v(u,i/8,1));tube('snowplow-blade-seated-rear-rib',steel,path,path.map(()=>.10),8,true,true,'detail');for(const q of [.18,.80])turned('snowplow-seated-blade-rivet',bronze,(x,y,z)=>v(u,q,1).add(vec(x,z,y)),[[0,.10],[.08,.10]],8,'detail');}
   beam('snowplow-chassis-to-blade-strut',steel,at(cx+side*1.1,1.15,cz-.8),v(.65,.32,1),.20,.20);
  }
  beam('snowplow-supported-center-nose-spine',steel,at(cx,.30,cz-3.9),at(cx,2.99,cz-3.90),.18,.22);
  for(const side of [-1,1]){box('snowplow-ground-seated-adjustable-skid',steel,at(cx+side*2.25,.09,cz-2.85),vec(.50,.18,1.00),yaw);beam('snowplow-skid-seated-shank',steel,at(cx+side*2.25,.18,cz-2.85),at(cx+side*2.25,.90,cz-2.85),.13,.13);beam('snowplow-forked-drawbar',timber,at(cx+side*1.0,1.32,cz+.45),at(cx+side*.24,1.45,cz+3.75),.17,.17);}
  box('snowplow-drawbar-grounded-parking-leg',steel,at(cx,.75,cz+3.5),vec(.18,1.5,.18),yaw);beam('snowplow-supported-drawbar-handle',timber,at(cx-.6,1.45,cz+3.75),at(cx+.6,1.45,cz+3.75),.15,.15);
  parcelCart(at,8,-7.5,yaw);
  // Continuous rack legs carry three separate shelves; no stacked boxes
  // extend to ground under each shelf and no shelf has a coplanar leg skin.
  const rackLegs:Component[]=[];for(const x of [-10,-4])for(const z of [5.3,7.1])rackLegs.push(box('plow-rack-continuous-pier',teal,at(x,2.0,z),vec(.22,4,.22),yaw)!);
  for(const y of [.85,2.15,3.65]){const shelf=box('plow-rack-pier-seated-shelf',boards,at(-7,y,6.2),vec(6.5,.18,2.2),yaw)!;for(const leg of rackLegs)contact('plow-rack-shelf-pier',shelf,leg);}
  for(let i=0;i<3;i++){box('plow-shed-floor-seated-grit-bin',boards,at(3+i*3.0,1.05,6.2),vec(2.55,2.1,2.4),yaw);box('plow-shed-bin-seated-grit',snowShade,at(3+i*3.0,2.12,6.2),vec(2.30,.10,2.15),yaw,'detail');}
  const spare=box('plow-rack-seated-spare-blade-plate',oxide,at(-7,3.09,6.2),vec(4.5,1.7,.20),yaw)!;contact('plow-spare-blade-lower-shelf',spare,components.find(c=>c.kind==='plow-rack-pier-seated-shelf'&&Math.abs(c.max[1]-(base.y+2.24))<1e-7)!);
  landmarks.push({kind:p.kind,label:p.label,position:tuple(base),radius:p.r,height:p.h});props.push({kind:p.kind,x:p.x,y:base.y,z:p.z,radius:p.r});
 }
 landmark=undefined;
 // Sparse, irregular fir groups retain attached branches and grounded trunks;
 // none blocks a driver reveal ray, a hero silhouette or full camera orbit.
 let firCount=0;for(let i=0;i<29&&firCount<6;i++){
  const x=-445+noise(i*7+21)*980,z=-1010+noise(i*7+35)*1220,r=2.4+noise(i*3)*1.4,h=7+noise(i*9)*5;
  if(!roadIndex.clearAt(x,z,r+30)||plots.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+r+12)||inSight(x,z,r+5))continue;
  firCount++;const footprint=rect(vec(x,0,z),.74,.74),ext=terrainExtrema(footprint),bottom=ext.low-.12,at=local(vec(x,bottom,z)),rise=ext.high-bottom;
  const trunk=turned('snow-fir-grounded-continuous-trunk',timber,at,[[0,.34],[rise+h*.55,.24],[rise+h,.065]],10,'detail');groundedDetails.push({kind:trunk.kind,x,z,bottom,terrainY:groundY(x,z),footprint:footprint.map(tuple)});
  for(let tier=0;tier<3;tier++){const y=rise+2+tier*h*.17,rad=r*(1-tier*.18);for(let branch=0;branch<4;branch++){const a=branch*Math.PI*2/4+tier*.7+i*.2,tip=at(Math.cos(a)*rad,y-.38,Math.sin(a)*rad);beam('snow-fir-trunk-joined-branch',timber,at(0,y,0),tip,.095,.12,'detail');const leaf=local(tip);loft('snow-fir-branch-seated-bough',evergreen,leaf,[{y:-.16,rx:rad*.35,rz:rad*.28},{y:.25,rx:rad*.49,rz:rad*.34},{y:.75,rx:rad*.25,rz:rad*.20},{y:1.12,rx:.025,rz:.025}],8,branch,'detail');loft('snow-fir-bough-seated-snow',roofSnow,leaf,[{y:.45,rx:rad*.36,rz:rad*.28},{y:.78,rx:rad*.25,rz:rad*.2},{y:1.22,rx:.025,rz:.025}],8,branch,'detail');}}
 }
 // Branch boards are set outside full camera sweeps, before the original
 // 80m steering choice window. Their arrows are raised supported relief.
 for(const side of [-1,1]){const e=course.commonStart,s=e.length-118,p=point(e,s,side*(e.halfWidthAt(s)+24)),yaw=0,y=terrainExtrema(rect(p,6.2,.7)).high+2.5,at=local(vec(p.x,0,p.z),yaw);
  for(const x of [-2.25,2.25]){const q=at(x,0,0);grounded('snow-fork-grounded-sign-post',q.x,q.z,.50,.55,y+1.35,teal,0,'structure');}
  box('snow-fork-supported-arrow-board',teal,at(0,y,0),vec(6.0,2.45,.40),yaw);for(const z of [-.195,.195]){const first=inlay.positions.length/3,sign=Math.sign(z),v=[at(side*2.65,y,z),at(side*1.4,y+.78,z),at(side*1.4,y-.78,z),at(side*2.65,y,z+sign*.075),at(side*1.4,y+.78,z+sign*.075),at(side*1.4,y-.78,z+sign*.075)];inlay.tri(v[0],v[2],v[1]);inlay.tri(v[3],v[4],v[5]);for(const [a,b]of [[0,1],[1,2],[2,0]])inlay.quad(v[a],v[b],v[a+3],v[b+3]);bound('snow-fork-supported-raised-arrow',inlay,first,'detail',true);for(let j=0;j<(side>0?3:2);j++)box('snow-fork-supported-route-icon',inlay,at(-side*(.4+j*.55),y,z),vec(.23,side>0?1.20:.65,.07),yaw,'detail');}
  props.push({kind:'snow-fork-wayfinding',x:p.x,y:p.y,z:p.z,radius:3.4});
 }
 // Authored reveal eyes are retained; each target now names a real emitted
 // face centroid rather than the provisional design cylinder's empty centre.
 for(const sight of sightlines){const kinds:Record<string,string>={'ridge-signal-house':'signal-turret-thick-slate-roof','snow-split-ridge':'split-ridge-connected-snow-slate-surface','depot-clock-hall':'clock-bronze-recessed-dial-face','maintenance-roundhouse':'roundhouse-pier-seated-bay-lintel','stone-plow-shed':'plow-shed-thick-slate-roof'};const seed=[...sight.target];let best=Infinity;for(const c of components.filter(c=>c.landmark===sight.targetId&&c.kind===kinds[sight.targetId]))for(const face of facesFor(c)){const p=[0,1,2].map(k=>(face[0][k]+face[1][k]+face[2][k])/3),d=p.reduce((n,v,k)=>n+(v-seed[k])**2,0);if(d<best){best=d;sight.target=p;}}}
 // Camera uses source triangles for every emitted assembly, retaining real
 // openings. The macro heightfield is the exact same two diagonals per cell.
 for(const p of plots)meshBlock('snow-exact-'+p.kind,components.filter(c=>c.landmark===p.kind).flatMap(facesFor));
 meshBlock('snow-exact-all-other-assemblies',components.filter(c=>!c.landmark&&c.kind!=='connected-snow-bowl-heightfield'&&c.kind!=='connected-slate-exposures-heightfield'&&c.kind!=='exact-source-shoulder-stitches'&&c.role!=='rail').flatMap(facesFor));
 // Snow enrichment is appended only after every original range and blocker.
 // Each new solid has distinct ownership, actual support faces, and an exact
 // triangle camera payload. Original terrain and architecture stay immutable.
 const enrichmentAssemblies:SnowSceneGeometry['enrichmentAssemblies']=[];
 type EnrichmentPiece=SnowSceneGeometry['enrichmentAssemblies'][number]['pieces'][number];
 const originalTriangleCount=batches.reduce((n,b)=>n+b.indices.length/3,0);
 const beginAssembly=(id:string)=>{const a:SnowSceneGeometry['enrichmentAssemblies'][number]={id,pieces:[],groundContacts:[]};enrichmentAssemblies.push(a);return a;};
 let assembly:SnowSceneGeometry['enrichmentAssemblies'][number];
 const own=(c:Component,supportOwner:string[]=[])=>{c.enrichmentAssembly=assembly.id;const p:EnrichmentPiece={...c,id:assembly.id+':'+assembly.pieces.length,supportOwner};assembly.pieces.push(p);return p;};
 const ownLast=(supports:string[])=>own(components[components.length-1],supports);
 const finishAssembly=()=>meshBlock(assembly.id+'-exact-triangles',assembly.pieces.flatMap(facesFor));
 // Independently close the new multi-face solids by shared geometric edges.
 // Winding is reconciled across terrain-clipped caps and all shell sides;
 // an open/nonmanifold seam is rejected rather than hidden by two-sided shading.
 const closedPart=(kind:string,b:Batch,start:number,role:Role,ii:number)=>{
  const key=(i:number)=>b.positions.slice(i*3,i*3+3).map(v=>v.toFixed(7)).join(','),edges=new Map<string,{face:number;sign:number}[]>(),count=(b.indices.length-ii)/3,adj:Array<{face:number;flip:boolean}[]>=Array.from({length:count},()=>[]);
  for(let f=0;f<count;f++)for(let j=0;j<3;j++){const a=key(b.indices[ii+f*3+j]),c=key(b.indices[ii+f*3+(j+1)%3]);if(a===c)throw Error('Degenerate enrichment edge: '+kind);const k=[a,c].sort().join('|'),list=edges.get(k)??[];list.push({face:f,sign:a<c?1:-1});edges.set(k,list);}
  for(const es of edges.values()){if(es.length!==2)throw Error('Open enrichment seam: '+kind);const [a,c]=es;adj[a.face].push({face:c.face,flip:a.sign===c.sign});adj[c.face].push({face:a.face,flip:a.sign===c.sign});}
  const flips:Array<boolean|undefined>=Array(count);for(let seed=0;seed<count;seed++){if(flips[seed]!==undefined)continue;flips[seed]=false;const queue=[seed];for(let n=0;n<queue.length;n++)for(const e of adj[queue[n]]){const expected=flips[queue[n]]!==e.flip;if(flips[e.face]===undefined){flips[e.face]=expected;queue.push(e.face);}else if(flips[e.face]!==expected)throw Error('Non-orientable enrichment solid');}}
  for(let f=0;f<count;f++)if(flips[f])[b.indices[ii+f*3+1],b.indices[ii+f*3+2]]=[b.indices[ii+f*3+2],b.indices[ii+f*3+1]];
  return bound(kind,b,start,role,true,ii)!;
 };

 // Clip the actual triangulated terrain; preserve its diagonals under every
 // foot. Boundary edges are split at the same terrain crossings as the base.
 const clippedBase=(footprint:pc.Vec3[])=>{
  const pieces=terrainPieces(footprint),key=(p:pc.Vec3)=>p.x.toFixed(7)+','+p.z.toFixed(7),edges=new Map<string,{a:pc.Vec3;b:pc.Vec3;count:number}>();
  for(const poly of pieces)for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if(a.distance(b)<1e-8)continue;const k=[key(a),key(b)].sort().join('|'),old=edges.get(k);if(old)old.count++;else edges.set(k,{a,b,count:1});}
  const border=[...edges.values()].filter(e=>e.count===1),loop:pc.Vec3[]=[border[0].a];let current=border[0].b;border.splice(0,1);
  while(border.length){loop.push(current);const i=border.findIndex(e=>key(e.a)===key(current)||key(e.b)===key(current));if(i<0)throw Error('Enrichment terrain boundary is not continuous');const e=border.splice(i,1)[0];current=key(e.a)===key(current)?e.b:e.a;}
  if(key(current)!==key(loop[0]))throw Error('Enrichment terrain boundary is not closed');
  return{pieces,loop};
 };
 const foundationSlab=(kind:string,x:number,z:number,w:number,d:number,yaw=0)=>{
  const footprint=rect(vec(x,0,z),w,d,yaw),ext=terrainExtrema(footprint),base=clippedBase(footprint),top=ext.high+.24,start=foundationStone.positions.length/3,ii=foundationStone.indices.length;
  for(const poly of base.pieces)for(let j=1;j<poly.length-1;j++){const t=[poly[0],poly[j],poly[j+1]].map(p=>p.clone().add(vec(0,-.04,0)));foundationStone.tri(t[0],t[1],t[2]);}
  const bottomEnd=foundationStone.indices.length;
  for(const poly of base.pieces)for(let j=1;j<poly.length-1;j++){const t=[poly[0],poly[j],poly[j+1]].map(p=>vec(p.x,top,p.z));foundationStone.tri(t[2],t[1],t[0]);}
  for(let i=0;i<base.loop.length;i++){const p=base.loop[i],q=base.loop[(i+1)%base.loop.length];foundationStone.quad(p.clone().add(vec(0,-.04,0)),q.clone().add(vec(0,-.04,0)),vec(p.x,top,p.z),vec(q.x,top,q.z));}
  const part=own(closedPart(kind,foundationStone,start,'support',ii));
  assembly.groundContacts.push({pieceId:part.id,footprint:footprint.map(tuple),bottom:ext.low-.04,terrainLow:ext.low,terrainHigh:ext.high,bottomIndexStart:ii,bottomIndexEnd:bottomEnd,terrainPenetrationMetres:.04});
  return{part,top,at:local(vec(x,top,z),yaw)};
 };
 // Broad wind-packed snow is modeled as closed terrain-seated shells with
 // unequal rounded shoulders, not new terrain, identical cones or borrowed art.
 const drift=(id:string,cx:number,cz:number,w:number,d:number,yaw:number,h:number,seed:number)=>{
  assembly=beginAssembly(id);const at=local(vec(cx,0,cz),yaw),outline=Array.from({length:24},(_,i)=>{const a=i*Math.PI/12,r=1+.025*Math.sin(3*a+seed);return at(Math.cos(a)*w/2*r,0,Math.sin(a)*d/2*r);}),ext=terrainExtrema(outline),base=clippedBase(outline),b=roofSnow,start=b.positions.length/3,ii=b.indices.length;
  for(const poly of base.pieces)for(let j=1;j<poly.length-1;j++){const t=[poly[0],poly[j],poly[j+1]].map(p=>p.clone().add(vec(0,-.04,0)));b.tri(t[0],t[1],t[2]);}const bottomEnd=b.indices.length;
  const rings=[{s:1,h:-.04},{s:.97,h:h*.35},{s:.77,h:h*.78},{s:.43,h:h*.96},{s:.13,h}];
  const ring=(r:typeof rings[number],p:pc.Vec3)=>{const x=cx+(p.x-cx)*r.s,z=cz+(p.z-cz)*r.s;return vec(x,r.h<0?p.y+r.h:groundY(x,z)+r.h*(.92+.08*Math.cos(Math.atan2(p.z-cz,p.x-cx)+seed)),z);};
  for(let k=0;k<rings.length-1;k++)for(let j=0;j<base.loop.length;j++){const n=(j+1)%base.loop.length;b.quad(ring(rings[k],base.loop[j]),ring(rings[k],base.loop[n]),ring(rings[k+1],base.loop[j]),ring(rings[k+1],base.loop[n]));}
  const top=rings.at(-1)!,center=vec(cx,groundY(cx,cz)+h,cz);for(let j=0;j<base.loop.length;j++)b.tri(center,ring(top,base.loop[j]),ring(top,base.loop[(j+1)%base.loop.length]));
  const part=own(closedPart('snow-enrichment-wind-packed-drift',b,start,'structure',ii));assembly.groundContacts.push({pieceId:part.id,footprint:base.loop.map(tuple),bottom:ext.low-.04,terrainLow:ext.low,terrainHigh:ext.high,bottomIndexStart:ii,bottomIndexEnd:bottomEnd,terrainPenetrationMetres:.04});finishAssembly();
 };
 drift('snow-enrichment-first-near-shelf',42,-168,30,38,-.10,5.6,.4);
 drift('snow-enrichment-first-middle-shelf',52,-211,26,23,-.06,4.7,1.0);
 drift('snow-enrichment-first-exit-shelf',-25,-338,39,20,-.14,7.4,1.2);
 drift('snow-enrichment-second-near-shelf',80,137,43,17,-.16,5.4,.7);
 drift('snow-enrichment-second-high-shelf',117,162,42,18,-.25,6.7,1.7);
 // Fence posts have terrain-clipped independent feet. Broad horizontal snow
 // baffles are actual closed planks with clear daylight gaps, not a proxy wall.
 const fence=(id:string,cx:number,cz:number,length:number,yaw:number)=>{
  assembly=beginAssembly(id);const at=local(vec(cx,0,cz),yaw),posts:EnrichmentPiece[]=[],tops:number[]=[];
  for(let i=0;i<5;i++){const x=-length/2+i*length/4,p=at(x,0,0),foot=foundationSlab('snow-enrichment-fence-footing',p.x,p.z,1.25,1.25,yaw),top=foot.top+5.6;tops.push(top);posts.push(own(box('snow-enrichment-fence-bearing-upright',timber,vec(p.x,(foot.top+top)/2,p.z),vec(.50,top-foot.top,.56),yaw)!,[foot.part.id]));}
  for(let i=0;i<4;i++)for(let row=0;row<3;row++){const x0=-length/2+i*length/4,x1=x0+length/4,inset=.24,t=inset/(length/4),y0=tops[i]+(tops[i+1]-tops[i])*t-3.7+row*1.1,y1=tops[i+1]-(tops[i+1]-tops[i])*t-3.7+row*1.1,a=at(x0+inset,0,-.31),c=at(x1-inset,0,-.31);beam('snow-enrichment-fence-slatted-baffle',boards,vec(a.x,y0,a.z),vec(c.x,y1,c.z),.18,.70);ownLast([posts[i].id,posts[i+1].id]);}
  finishAssembly();
 };
 fence('snow-enrichment-first-bowl-fence',53,-193,24,0);
 fence('snow-enrichment-second-bowl-fence',103,146,20,.65);
 // Two coherent snow-laden windbreak groups add unequal middle-ground depth.
 // Every crown is closed and supported by its continuous trunk; each snow
 // underside exactly coincides with the upper conical crown faces and tip.
 const firGroup=(id:string,trees:{x:number;z:number;h:number;r:number}[])=>{
  assembly=beginAssembly(id);
  for(const tree of trees){
   const root=foundationSlab('snow-enrichment-fir-terrain-root',tree.x,tree.z,1.6,1.6),at=root.at,crownFootprint=Array.from({length:18},(_,i)=>vec(tree.x+Math.cos(i/18*Math.PI*2)*tree.r,0,tree.z+Math.sin(i/18*Math.PI*2)*tree.r)),stemLift=Math.max(0,terrainExtrema(crownFootprint).high+.30-root.top-tree.h*.14);
   const trunk=own(turned('snow-enrichment-fir-continuous-trunk',timber,at,[[0,.46],[tree.h+stemLift-.2,.18]],12),[root.part.id]);
   for(const [j,tier] of [{y:.14,h:.29,r:1},{y:.46,h:.25,r:.76},{y:.74,h:.26,r:.49}].entries()){
    const y=tree.h*tier.y+stemLift,h=tree.h*tier.h,r=tree.r*tier.r,tip=.60,segments=18;
    const crown=own(turned('snow-enrichment-fir-supported-crown',evergreen,at,[[y,r],[y+h,tip]],segments),[trunk.id]);
    const b=roofSnow,start=b.positions.length/3,ii=b.indices.length,u=.34,lo=y+h*u,rr=r+(tip-r)*u,thick=.42;
    const ring=(i:number,upper:boolean,lift=0)=>{const a=i/segments*Math.PI*2,rad=upper?tip:rr;return at(Math.cos(a)*rad,(upper?y+h:lo)+lift,Math.sin(a)*rad);};
    for(let i=0;i<segments;i++)b.quad(ring(i,false),ring(i+1,false),ring(i,true),ring(i+1,true));
    for(let i=0;i<segments;i++)b.tri(at(0,y+h,0),ring(i,true),ring(i+1,true));const bottomEnd=b.indices.length;
    for(let i=0;i<segments;i++){b.quad(ring(i,false,thick),ring(i+1,false,thick),ring(i,true,thick),ring(i+1,true,thick));b.tri(at(0,y+h+thick,0),ring(i,true,thick),ring(i+1,true,thick));b.quad(ring(i,false),ring(i+1,false),ring(i,false,thick),ring(i+1,false,thick));}
    const cap=own(closedPart('snow-enrichment-fir-seated-snow-mantle',b,start,'structure',ii),j<2?[crown.id,trunk.id]:[crown.id]);cap.supportIndexStart=ii;cap.supportIndexEnd=bottomEnd;
   }
  }
  finishAssembly();
 };
 firGroup('snow-enrichment-first-bowl-windbreak',[{x:40,z:-240,h:19,r:6},{x:55,z:-230,h:24,r:7},{x:70,z:-225,h:16,r:5}]);
 firGroup('snow-enrichment-second-bowl-windbreak',[{x:144,z:168,h:21,r:6},{x:154,z:188,h:26,r:7},{x:173,z:176,h:17,r:5}]);
 // A layered pair of original station annexes preserves the clock hall as
 // the tallest identifying landmark. Every aperture remains geometrically open.
 const station=(id:string,cx:number,cz:number,w:number,d:number,h:number,rise:number,yaw:number,shelter:boolean)=>{
  assembly=beginAssembly(id);const slab=foundationSlab('snow-enrichment-station-ground-seat',cx,cz,w+3.4,d+3.4,yaw),at=slab.at;
  const put=(kind:string,b:Batch,x:number,y:number,z:number,ww:number,hh:number,dd:number,supports:string[])=>own(box('snow-enrichment-'+kind,b,at(x,y,z),vec(ww,hh,dd),yaw)!,supports);
  const wallL=put('station-west-masonry',paleStone,-w/2+.4,h/2,.4,.8,h,d-.8,[slab.part.id]),wallR=put('station-east-masonry',paleStone,w/2-.4,h/2,.4,.8,h,d-.8,[slab.part.id]);
  const back=put('station-rear-masonry',paleStone,0,h/2,d/2-.4,w-1.6,h,.8,[slab.part.id]);
  const piers:EnrichmentPiece[]=[],bay=(w-.8)/3;for(let i=0;i<=3;i++)piers.push(put('station-open-front-pier',teal,-w/2+.4+i*bay,(h-.9)/2,-d/2+.4,.8,h-.9,.8,[slab.part.id]));
  const lintels:EnrichmentPiece[]=[];for(let i=0;i<3;i++)lintels.push(put('station-open-front-header',timber,-w/2+.4+(i+.5)*bay,h-.45,-d/2+.4,bay,.9,.8,[piers[i].id,piers[i+1].id]));
  // Separate low sills and recessed panes occupy only the two outer bays.
  for(const i of [0,2]){const x=-w/2+.4+(i+.5)*bay,sill=put('station-window-parapet',paleStone,x,1.15,-d/2+.4,bay-.8,2.3,.8,[slab.part.id]);put('station-recessed-window',i===0?warm:glass,x,(2.3+h-.9)/2,-d/2+.66,bay-.96,h-3.2,.12,[sill.id,lintels[i].id]);}
  const eaves:EnrichmentPiece[]=[];for(const side of [-1,1]){const wall=side<0?wallL:wallR;const x0=side<0?-w/2:w/2-.8,x1=x0+.8,yy=(x:number)=>h+rise*(1-Math.abs(x)/(w/2+1.2)),v=[at(x0,h,-d/2),at(x1,h,-d/2),at(x0,h,d/2),at(x1,h,d/2),at(x0,yy(x0),-d/2),at(x1,yy(x1),-d/2),at(x0,yy(x0),d/2),at(x1,yy(x1),d/2)],start=timber.positions.length/3,ii=timber.indices.length;for(const f of [[0,1,2,3],[4,6,5,7],[0,4,1,5],[2,3,6,7],[0,2,4,6],[1,5,3,7]])timber.quad(v[f[0]],v[f[1]],v[f[2]],v[f[3]]);eaves.push(own(closedPart('snow-enrichment-sloping-eave-seat',timber,start,'structure',ii),[wall.id]));}
  for(const side of [-1,1]){const x0=side<0?-w/2-1.2:0,x1=side<0?0:w/2+1.2,y0=side<0?h:h+rise,y1=side<0?h+rise:h;
   const slate=own(roofPanel('snow-enrichment-annex-thick-slate',roofSlate,at,x0,x1,y0,y1,-d/2-1.2,d/2+1.2,.38),[eaves[side<0?0:1].id]);
   const cap=own(roofPanel('snow-enrichment-annex-attached-snow',roofSnow,at,x0,x1,y0+.38,y1+.38,-d/2-1.2,d/2+1.2,.62),[slate.id]);cap.supportIndexStart=cap.indexStart;cap.supportIndexEnd=cap.indexStart+6;
  }
  if(shelter){
   // The platform extension is a second low, genuinely open roof in front.
   const porch=foundationSlab('snow-enrichment-platform-ground-seat',cx+Math.sin(yaw)*(-d/2-5.4),cz+Math.cos(yaw)*(-d/2-5.4),w+3.4,7.4,yaw),pa=porch.at,ph=slab.top+h-2.2-porch.top,posts:EnrichmentPiece[]=[];
   for(const x of [-w/2+1,0,w/2-1])for(const z of [-2.8,2.8])posts.push(own(box('snow-enrichment-platform-upright',teal,pa(x,ph/2,z),vec(.6,ph,.6),yaw)!,[porch.part.id]));
   const beams:EnrichmentPiece[]=[];for(const z of [-2.8,2.8])beams.push(own(box('snow-enrichment-platform-crossbeam',timber,pa(0,ph+.3,z),vec(w-.8,.6,.6),yaw)!,posts.filter((_,i)=>i%2===(z<0?0:1)).map(p=>p.id)));
   const roof=own(box('snow-enrichment-platform-slate-seat',roofSlate,pa(0,ph+.8,0),vec(w+1.4,.4,7.4),yaw)!,beams.map(p=>p.id));
   const cap=own(box('snow-enrichment-platform-snow-seat',roofSnow,pa(0,ph+1.28,0),vec(w+1.4,.56,7.4),yaw)!,[roof.id]);cap.supportIndexStart=cap.indexStart+30;cap.supportIndexEnd=cap.indexStart+36;
  }
  finishAssembly();
 };
 station('snow-enrichment-station-near-annex',442,-584,28,9,10.2,3.5,Math.PI/2,true);
 station('snow-enrichment-station-high-annex',484,-624,22,14,8.7,3.5,2.35,false);
 // An open lower yard roof gives the Service Cut a second readable roof mass
 // without extending sidings or covering any original roundhouse bay.
 const yard=()=>{
  assembly=beginAssembly('snow-enrichment-open-maintenance-yard');const slab=foundationSlab('snow-enrichment-yard-ground-seat',133,-574,29,17,.1),at=slab.at,yaw=.1,posts:EnrichmentPiece[]=[];
  for(const x of [-12,0,12])for(const z of [-6,6])posts.push(own(box('snow-enrichment-yard-bearing-post',teal,at(x,4.5,z),vec(.7,9,.7),yaw)!,[slab.part.id]));
  const beams:EnrichmentPiece[]=[];for(const z of [-6,6])beams.push(own(box('snow-enrichment-yard-bearing-beam',timber,at(0,9.4,z),vec(24.7,.8,.7),yaw)!,posts.filter(p=>Math.abs((p.min[2]+p.max[2])/2-at(0,0,z).z)<2).map(p=>p.id)));
  const roof=own(box('snow-enrichment-yard-thick-roof',roofSlate,at(0,10,0),vec(27,.4,15),yaw)!,beams.map(p=>p.id));const cap=own(box('snow-enrichment-yard-attached-snow',roofSnow,at(0,10.55,0),vec(27,.7,15),yaw)!,[roof.id]);cap.supportIndexStart=cap.indexStart+30;cap.supportIndexEnd=cap.indexStart+36;
  for(const x of [-7,5]){const base=own(box('snow-enrichment-yard-stock-bearer',timber,at(x,.45,0),vec(3.5,.9,7),yaw)!,[slab.part.id]);const b=oxide,start=b.positions.length/3,ii=b.indices.length,xs=[-3.5,-1.75,0,1.75,3.5],front=(xx:number,y:number,side:number)=>at(x+1.05-.13*xx*xx-side*.30,y,xx);for(let i=0;i<xs.length-1;i++){const a=xs[i],c=xs[i+1];for(const side of [0,1])b.quad(front(a,.9,side),front(c,.9,side),front(a,3.9,side),front(c,3.9,side));b.quad(front(a,.9,0),front(c,.9,0),front(a,.9,1),front(c,.9,1));b.quad(front(a,3.9,0),front(c,3.9,0),front(a,3.9,1),front(c,3.9,1));}for(const xx of [xs[0],xs.at(-1)!])b.quad(front(xx,.9,0),front(xx,.9,1),front(xx,3.9,0),front(xx,3.9,1));own(closedPart('snow-enrichment-yard-curved-plow-blade-stock',b,start,'structure',ii),[base.id]);}
  finishAssembly();
 };yard();
 const enrichmentTriangles=enrichmentAssemblies.reduce((n,a)=>n+a.pieces.reduce((m,p)=>m+(p.indexEnd-p.indexStart)/3,0),0);
 assertRuntimeAppendGeometry('Snow',batches,originalTriangleCount,enrichmentTriangles,12000);

 const used=batches.filter(b=>b.indices.length),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const b of used)for(let i=0;i<b.positions.length;i++){const k=i%3;min[k]=Math.min(min[k],b.positions[i]);max[k]=Math.max(max[k],b.positions[i]);}
 const budget={batches:used.length,triangles:used.reduce((n,b)=>n+b.indices.length/3,0),vertices:used.reduce((n,b)=>n+b.positions.length/3,0)};
 if(budget.batches!==23||budget.triangles>=120000||budget.vertices>=200000)throw new Error('Snow emitted geometry budget exceeded: '+JSON.stringify({budget,batches:used.map(b=>[b.name,b.indices.length/3,b.positions.length/3])}));
 return{version:1,trackId:course.id,batches:used,roadSamples,routeRoadSamples,roadFaces,roadUndersideFaces,shoulderFaces,props,structures:[],bounds:{min,max},cameraObstacles,components,landmarks,foundations,groundedDetails,railMembers,wheelContacts,structuralContacts,sightlines,landforms,terrainGrid,terrainVertices,terrainTriangles,terrainExposure,terrainPartitions,budget,enrichmentAssemblies};
}
