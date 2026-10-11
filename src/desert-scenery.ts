import * as pc from 'playcanvas';
import {LandMeshBatch as Batch} from './land-mesh-builder';
import {footprintArea,intersectRoadFootprint,subtractRoadFootprint,sampleRoadFootprints,RoadFootprintIndex,roadFootprint,type SceneryForkCourse,type SceneryRoadEdge} from './land-road-mesh';
import type {LandSceneGeometry,LandPropPlacement} from './land-scenery';
import type {LandSceneTheme} from './land-scene';
import {cameraTerrainHeight,type CameraBlocker,type CameraHeightfield} from './land-camera';

type Role='terrain'|'road'|'support'|'visual-coping'|'rail'|'structure'|'detail';
type Component={kind:string;batch:string;vertexStart:number;vertexEnd:number;indexStart:number;indexEnd:number;min:number[];max:number[];role:Role;solid:boolean;landmark?:string};
type Face={edgeId:string;distance:number;points:number[][]};
export interface DesertSceneGeometry extends LandSceneGeometry {
 routeRoadSamples:{edgeId:string;distance:number;left:number[];right:number[];rendered:boolean}[];
 roadFaces:Face[];roadUndersideFaces:Face[];shoulderFaces:Face[];
 cameraObstacles:(CameraBlocker&{kind:string})[];components:Component[];
 landmarks:{kind:string;label:string;position:number[];radius:number;height:number}[];
 foundations:{kind:string;top:number;bottom:number;footprint:number[][];terrainLow:number;terrainHigh:number}[];
 groundedDetails:{kind:string;x:number;z:number;bottom:number;terrainY:number;footprint:number[][]}[];
 railMembers:{edgeId:string;distance:number;side:number;points:number[][]}[];
 arches:{edgeId:string;centerS:number;depth:number;undersideY:number;center:number[];portalWidth:number;driveableWidth:number;headroom:number;springY:number;innerRise:number;from:number;to:number;triangles:number[][][]}[];
 sightlines:{name:string;eye:number[];target:number[];radius:number;targetId:string}[];
 landforms:{kind:string;footprint:number[][];bottom:number;top:number}[];
 terrainGrid:CameraHeightfield;budget:{batches:number;triangles:number;vertices:number};
}
export const DESERT_SCENE_THEME:Readonly<LandSceneTheme>=Object.freeze({textureLabel:'sunweave original desert textures',ambient:'#e3cda7',sky:'#e6dbc3',fogStart:850,fogEnd:1950,cameraName:'Sunweave Caravan chase camera',sunName:'Sunweave late afternoon sun',sunColor:'#ffe9bb',sunIntensity:1.65,sunEuler:[48,-35,0] as const});
const vec=(x:number,y:number,z:number)=>new pc.Vec3(x,y,z),tuple=(p:pc.Vec3)=>[p.x,p.y,p.z];
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const smooth=(x:number)=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
const noise=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const local=(p:pc.Vec3,yaw=0)=>{const c=Math.cos(yaw),s=Math.sin(yaw);return(x:number,y:number,z:number)=>vec(p.x+x*c+z*s,p.y+y,p.z-x*s+z*c);};
const plots=[
 {kind:'sun-dial-beacon',x:145,z:-40,r:27,h:42,w:32,d:30,label:'Sun Dial Beacon: open side arch, carved slits and seated bronze dial'},
 {kind:'wind-carved-spire',x:375.75246803720836,z:30.482669948055367,r:20,h:38,w:31,d:23,label:'Wind Spire: connected rounded strata and recessed erosion pockets'},
 {kind:'caravan-sailcourt',x:-202.8203114674157,z:174.64595156552548,r:24,h:17,w:35,d:31,label:'Caravan Sailcourt: three unequal pegged timber and cloth frames'},
 {kind:'terracotta-kiln-court',x:-562.0954105823064,z:-21.506240456810755,r:22,h:16,w:31,d:28,label:'Terracotta Kiln Court: recessed firing mouth and handled amphorae'},
 {kind:'saltstone-waystation',x:-197.52555113189763,z:-249.35653259226845,r:22,h:19,w:33,d:25,label:'Saltstone Waystation: recessed masonry rooms and grounded cargo cart'},
] as const;

/** Original deterministic source geometry. The renderer, road audit and camera
 * all consume these same triangles. Nothing here changes vehicle physics. */
export function buildDesertSceneGeometry(course:SceneryForkCourse):DesertSceneGeometry {
 const ground=new Batch('Desert connected sculpted dune terrain','#dfb975',1,'grass');
 const sandstone=new Batch('Desert wind rounded sandstone','#ac714c',.98,'stone');
 const strata=new Batch('Desert pale eroded strata','#cf9e67',.99,'stone');
 const supportStone=new Batch('Desert compact road support','#aa784a',1,'stone');
 const road=new Batch('Desert warm hardpan racing ribbon','#c99050',1,'asphalt');
 const paving=new Batch('Desert sandstone lane and visual coping','#d7b080',.98,'stone');
 const foundationStone=new Batch('Desert ruin foundation masonry','#b58c66',.98,'stone');
 const archStone=new Batch('Desert ochre arch voussoirs','#c09a72',.98,'stone');
 const paleStone=new Batch('Desert pale keystones and contact trim','#eddbb5',.97,'stone');
 const beaconStone=new Batch('Desert beacon cut limestone','#d8c495',.97,'stone');
 const bronze=new Batch('Desert original bronze dial','#9d7942',.52,'none',.58);
 const timber=new Batch('Desert dark structural timber','#714d33',.95,'wood');
 const boards=new Batch('Desert worn cart slats','#a07849',.96,'wood');
 const canvas=new Batch('Desert warm woven sail cloth','#e5ba62',.98,'wood');
 const paleCanvas=new Batch('Desert reinforced cream cloth','#f2dfaf',.98,'wood');
 const clay=new Batch('Desert fired terracotta','#bd704c',.97,'stone');
 const glaze=new Batch('Desert turquoise ceramic glaze','#2c7977',.38,'none',.1);
 const rope=new Batch('Desert coarse bound rope','#735044',.98,'wood');
 const iron=new Batch('Desert dark iron fasteners','#4c4a43',.53,'none',.62);
 const dark=new Batch('Desert deep masonry and pottery recesses','#65513f',1,'stone');
 const dryRoot=new Batch('Desert dry roots and baskets','#9e8654',.99,'wood');
 const inlay=new Batch('Desert ivory wayfinding and relief','#f6e8bc',.92,'stone');
 const batches=[ground,sandstone,strata,supportStone,road,paving,foundationStone,archStone,paleStone,beaconStone,bronze,timber,boards,canvas,paleCanvas,clay,glaze,rope,iron,dark,dryRoot,inlay];
 const edges=[course.commonStart,course.alternates.alley,course.alternates.boulevard,course.commonFinish];
 const sourceFaces=sampleRoadFootprints(edges,1.65),roadIndex=new RoadFootprintIndex(sourceFaces);
 const props:LandPropPlacement[]=[],roadSamples:DesertSceneGeometry['roadSamples']=[],routeRoadSamples:DesertSceneGeometry['routeRoadSamples']=[];
 const roadFaces:Face[]=[],roadUndersideFaces:Face[]=[],shoulderFaces:Face[]=[],cameraObstacles:DesertSceneGeometry['cameraObstacles']=[],components:Component[]=[];
 const landmarks:DesertSceneGeometry['landmarks']=[],foundations:DesertSceneGeometry['foundations']=[],groundedDetails:DesertSceneGeometry['groundedDetails']=[],railMembers:DesertSceneGeometry['railMembers']=[],arches:DesertSceneGeometry['arches']=[],landforms:DesertSceneGeometry['landforms']=[];
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
 const sightlines:DesertSceneGeometry['sightlines']=[
  {name:'beacon beyond low saddle',eye:tuple(point(course.commonStart,570.44106190816,0,1.6)),target:[145,66,-40],radius:3,targetId:'sun-dial-beacon'},
  {name:'wind spire at corridor mouth',eye:tuple(point(course.commonStart,975.7544480008,0,1.6)),target:[375.75246803720836,65.48708184926616,30.482669948055367],radius:3,targetId:'wind-carved-spire'},
  {name:'sailcourt above southern curve',eye:tuple(point(course.alternates.boulevard,175.44967945926842,0,1.6)),target:[-202.8203114674157,31.45167236505248,174.64595156552548],radius:3,targetId:'caravan-sailcourt'},
  {name:'kiln above clay shoulder',eye:tuple(point(course.commonFinish,320.8874242145482,0,1.6)),target:[-562.0954105823064,22.914441708729235,-21.506240456810755],radius:3,targetId:'terracotta-kiln-court'},
 ];
 const inSight=(x:number,z:number,r:number)=>sightlines.some(q=>{const dx=q.target[0]-q.eye[0],dz=q.target[2]-q.eye[2],t=clamp(((x-q.eye[0])*dx+(z-q.eye[2])*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-q.eye[0]-dx*t,z-q.eye[2]-dz*t)<r+q.radius;});

 // Authored XYZ crest spines create a connected landscape at driver height.
 // The road-relative canyon section alternates a raised outer wall and low
 // alcove, retaining the exact banked boundary as its vertical datum.
 const spines=[{knots:[[-320,14,-340],[-200,20,-355],[-70,27,-345]],width:64},{knots:[[-60,20,-140],[90,28,-100],[150,31,-70]],width:92},{knots:[[350,45,-220],[395,58,-100],[390,47,10]],width:62},{knots:[[-270,12,-110],[-150,15,-50],[0,18,35]],width:135}];
 const support=edges.flatMap(edge=>Array.from({length:Math.ceil(edge.length/3.5)+1},(_,i)=>{const s=i/Math.ceil(edge.length/3.5)*edge.length,f=edge.sample(s),w=edge.halfWidthAt(s);return{edge,s,p:f.p,n:f.n,w};}));
 const nearest=(x:number,z:number)=>{let distance=Infinity,q=support[0],lateral=0;for(const p of support){const d=Math.hypot(x-p.p.x,z-p.p.z);if(d<distance){distance=d;q=p;lateral=(x-p.p.x)*p.n.x+(z-p.p.z)*p.n.z;}}return{q,distance,lateral,outward:Math.max(0,distance-q.w)};};
 const terrainY=(x:number,z:number)=>{
  let y=8.7+2.1*Math.sin(x*.006+z*.004)+.55*Math.sin(x*.024-z*.015);
  for(const spine of spines)for(let k=1;k<spine.knots.length;k++){const a=spine.knots[k-1],b=spine.knots[k],u=clamp(((x-a[0])*(b[0]-a[0])+(z-a[2])*(b[2]-a[2]))/((b[0]-a[0])**2+(b[2]-a[2])**2),0,1),d=Math.hypot(x-a[0]-(b[0]-a[0])*u,z-a[2]-(b[2]-a[2])*u),weight=smooth(1-d/spine.width);y=Math.max(y,9+(a[1]+(b[1]-a[1])*u-9)*weight);}
  const yard=smooth((x+515)/45)*smooth((100-x)/45)*smooth((z-65)/40)*smooth((365-z)/30);y+=(17.58-y)*yard;
  const near=nearest(x,z),q=near.q,side=Math.sign(near.lateral)||1,edgeY=q.p.y+q.n.y*side*q.w,d=near.outward;
  // A supported road shoulder dominates nearby terrain; a 16 m low trough is
  // retained before wall relief so full orbit/rear booms remain outside rock.
  const roadWeight=smooth(1-d/46),supportY=edgeY-.50-.09*Math.min(d,16);y+=(supportY-y)*roadWeight;
  if(q.edge===course.commonStart&&q.s>800&&q.s<1330){const window=smooth((q.s-800)/65)*smooth((1330-q.s)/65),wave=.5+.5*Math.sin(q.s*.023+side*1.7),wall=window*smooth((d-17)/13)*smooth((73-d)/30)*(6+13*wave);y=Math.max(y,supportY+wall);}
  // Crown dunes are asymmetrical broad ridges, not independent round props.
  if(q.edge===course.commonStart&&q.s>330&&q.s<835){const crest=smooth((q.s-330)/90)*smooth((835-q.s)/80)*smooth((d-18)/22)*smooth((100-d)/48),ridge=side>0?4+6*Math.sin(q.s*.009)**2:1.2;y=Math.max(y,supportY+crest*ridge);}
  const pad=smooth((x+290)/7)*smooth((-230-x)/7)*smooth((z-250)/7)*smooth((330-z)/7);y+=(17.70-y)*pad;
  for(const sight of sightlines){const dx=sight.target[0]-sight.eye[0],dz=sight.target[2]-sight.eye[2],u=clamp(((x-sight.eye[0])*dx+(z-sight.eye[2])*dz)/(dx*dx+dz*dz),0,1),r=Math.hypot(x-sight.eye[0]-u*dx,z-sight.eye[2]-u*dz);if(r<7&&u<.94)y=Math.min(y,sight.eye[1]+u*(sight.target[1]-sight.eye[1])-4);}
  return y;
 };
 const minX=-660,maxX=435,minZ=-385,maxZ=395,nx=150,nz=90,dx=(maxX-minX)/nx,dz=(maxZ-minZ)/nz;
 const heights:number[]=[];for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++)heights.push(terrainY(minX+x*dx,minZ+z*dz));
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const x0=minX+x*dx,z0=minZ+z*dz,cell=[vec(x0,0,z0),vec(x0+dx,0,z0),vec(x0+dx,0,z0+dz),vec(x0,0,z0+dz)];let cap=Infinity;for(const f of roadIndex.query(x0,x0+dx,z0,z0+dz))if(footprintArea(intersectRoadFootprint(f.points,cell))>1e-10)cap=Math.min(cap,f.minY-.38);const i=z*(nx+1)+x;for(const j of [i,i+1,i+nx+1,i+nx+2])heights[j]=Math.min(heights[j],cap);}
 for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){const i=z*(nx+1)+x;ground.vertex(vec(minX+x*dx,heights[i],minZ+z*dz),[x*.24,z*.24]);if(x<nx&&z<nz)ground.indices.push(i,i+nx+1,i+1,i+1,i+nx+1,i+nx+2);}
 bound('dune-body-connected-terrain',ground,0,'terrain',false,0);
 const terrainGrid:CameraHeightfield={minX,minZ,columns:nx+1,rows:nz+1,dx,dz,heights};
 cameraObstacles.push({kind:'desert-exact-connected-terrain',min:[minX,Math.min(...heights),minZ],max:[maxX,Math.max(...heights),maxZ],heightfield:terrainGrid});
 const groundY=(x:number,z:number)=>cameraTerrainHeight(terrainGrid,x,z)??terrainY(x,z);
 const terrainPieces=(polygon:pc.Vec3[])=>{const x0=clamp(Math.floor((Math.min(...polygon.map(p=>p.x))-minX)/dx),0,nx-1),x1=clamp(Math.floor((Math.max(...polygon.map(p=>p.x))-minX)/dx),0,nx-1),z0=clamp(Math.floor((Math.min(...polygon.map(p=>p.z))-minZ)/dz),0,nz-1),z1=clamp(Math.floor((Math.max(...polygon.map(p=>p.z))-minZ)/dz),0,nz-1),out:pc.Vec3[][]=[];const v=(i:number)=>vec(...ground.positions.slice(i*3,i*3+3) as [number,number,number]);for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const i=z*(nx+1)+x;for(const t of [[i,i+nx+1,i+1],[i+1,i+nx+1,i+nx+2]]){const p=intersectRoadFootprint(t.map(v),polygon);if(p.length>=3&&footprintArea(p)>1e-9)out.push(p);}}return out;};
 const terrainExtrema=(polygon:pc.Vec3[])=>{let low=Infinity,high=-Infinity;for(const p of terrainPieces(polygon))for(const v of p){low=Math.min(low,v.y);high=Math.max(high,v.y);}return{low,high};};
 const rect=(p:pc.Vec3,w:number,d:number,yaw=0)=>{const at=local(p,yaw);return[at(-w/2,0,-d/2),at(w/2,0,-d/2),at(w/2,0,d/2),at(-w/2,0,d/2)];};
 const foundation=(kind:string,p:pc.Vec3,w:number,d:number,yaw=0,top?:number)=>{const footprint=rect(p,w,d,yaw),ext=terrainExtrema(footprint),bottom=ext.low-.22;p.y=top??ext.high+.10;box(kind+'-continuous-foundation',foundationStone,vec(p.x,(p.y-.10+bottom)/2,p.z),vec(w,p.y-.10-bottom,d),yaw,'support');box(kind+'-foundation-cap',paleStone,vec(p.x,p.y-.06,p.z),vec(w,.12,d),yaw,'support');foundations.push({kind,top:p.y,bottom,footprint:footprint.map(tuple),terrainLow:ext.low,terrainHigh:ext.high});return local(p,yaw);};
 const grounded=(kind:string,x:number,z:number,w:number,d:number,top:number,b:Batch=foundationStone,yaw=0,role:Role='detail')=>{const footprint=rect(vec(x,0,z),w,d,yaw),bottom=terrainExtrema(footprint).low-.10;box(kind,b,vec(x,(top+bottom)/2,z),vec(w,top-bottom,d),yaw,role);groundedDetails.push({kind,x,z,bottom,terrainY:groundY(x,z),footprint:footprint.map(tuple)});return bottom;};
  // Exact spatial triangle ownership across every branch overlap, including
  // the full coplanar fork and merge lobes beyond the shared tail.
  const priority=new Map([[course.commonStart,0],[course.commonFinish,1],[course.alternates.boulevard,2],[course.alternates.alley,3]]),ownership=new Map<string,boolean>();
  for(const f of sourceFaces){let fragments=[f.points];for(const owner of roadIndex.query(f.minX,f.maxX,f.minZ,f.maxZ)){if(priority.get(owner.edge)!>=priority.get(f.edge)!)continue;fragments=fragments.flatMap(p=>subtractRoadFootprint(p,owner.points));if(!fragments.length)break;}const key=f.edge.id+':'+f.distance;ownership.set(key,(ownership.get(key)??false)||fragments.length>0);for(const poly of fragments)for(let i=1;i<poly.length-1;i++){const p=[poly[0],poly[i],poly[i+1]];if(footprintArea(p)<1e-8)continue;(f.edge===course.alternates.alley?paving:road).tri(...p as [pc.Vec3,pc.Vec3,pc.Vec3]);const under=[p[2],p[1],p[0]].map(q=>q.clone().add(vec(0,-.22,0)));supportStone.tri(...under as [pc.Vec3,pc.Vec3,pc.Vec3]);roadFaces.push({edgeId:f.edge.id,distance:f.distance,points:p.map(tuple)});roadUndersideFaces.push({edgeId:f.edge.id,distance:f.distance,points:under.map(tuple)});}}
  bound('road-source-owned-hardpan',road,0,'road',false,0);
  bound('road-source-owned-technical-paving',paving,0,'road',false,0);
  bound('road-source-owned-underside',supportStone,0,'support',false,0);
  const shoulderVertexStart=supportStone.positions.length/3,shoulderIndexStart=supportStone.indices.length;
  // Shoulders are source-affine ribbons blending to the actual terrain at 8 m.
  // Their complete polygons are clipped by roads AND earlier shoulder owners.
  const shoulderMetrics=new WeakMap<ReturnType<typeof roadFootprint>,{a:pc.Vec3;b:pc.Vec3;sign:number;length:number}>();
  const shoulderDistance=(f:ReturnType<typeof roadFootprint>,p:pc.Vec3)=>{const q=shoulderMetrics.get(f)!;return ((q.b.x-q.a.x)*(p.z-q.a.z)-(q.b.z-q.a.z)*(p.x-q.a.x))*q.sign/q.length;};
  const rawShoulders=edges.flatMap(edge=>{const out:ReturnType<typeof roadFootprint>[]=[],n=Math.ceil(edge.length/1.65);for(let i=0;i<n;i++){const s=i/n*edge.length,t=(i+1)/n*edge.length;for(const side of [-1,1]){const a=point(edge,s,side*edge.halfWidthAt(s)),b=point(edge,t,side*edge.halfWidthAt(t)),c=point(edge,s,side*(edge.halfWidthAt(s)+8)),d=point(edge,t,side*(edge.halfWidthAt(t)+8));c.y=groundY(c.x,c.z)-.03;d.y=groundY(d.x,d.z)-.03;for(const tri of [[a,c,b],[b,c,d]]){const face=roadFootprint(edge,s,tri);shoulderMetrics.set(face,{a,b,sign:Math.sign((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x)),length:Math.hypot(b.x-a.x,b.z-a.z)});out.push(face);}}}return out;}),shoulderIndex=new RoadFootprintIndex(rawShoulders),shoulderOrder=new Map(rawShoulders.map((f,i)=>[f,i]));
  for(const f of rawShoulders){let fragments=[f.points];for(const owner of roadIndex.query(f.minX,f.maxX,f.minZ,f.maxZ)){if(footprintArea(intersectRoadFootprint(f.points,owner.points))<1e-8)continue;fragments=fragments.flatMap(p=>subtractRoadFootprint(p,owner.points));if(!fragments.length)break;}for(const owner of shoulderIndex.query(f.minX,f.maxX,f.minZ,f.maxZ)){if(owner.edge===f.edge)continue;const overlap=intersectRoadFootprint(f.points,owner.points);if(footprintArea(overlap)<1e-8)continue;const cut:pc.Vec3[]=[],delta=(p:pc.Vec3)=>shoulderDistance(f,p)-shoulderDistance(owner,p)+(shoulderOrder.get(owner)!<shoulderOrder.get(f)!?1e-10:-1e-10);for(let i=0;i<overlap.length;i++){const p=overlap[i],q=overlap[(i+1)%overlap.length],a=delta(p),b=delta(q);if(a>=0)cut.push(p);if((a>=0)!==(b>=0))cut.push(p.clone().lerp(p,q,a/(a-b)));}if(cut.length<3||footprintArea(cut)<1e-8)continue;fragments=fragments.flatMap(p=>subtractRoadFootprint(p,cut));if(!fragments.length)break;}for(const poly of fragments)for(let i=1;i<poly.length-1;i++){const p=[poly[0],poly[i],poly[i+1]];if(footprintArea(p)<1e-8)continue;if(new pc.Vec3().cross(p[1].clone().sub(p[0]),p[2].clone().sub(p[0])).y<0)[p[1],p[2]]=[p[2],p[1]];supportStone.tri(...p as [pc.Vec3,pc.Vec3,pc.Vec3]);shoulderFaces.push({edgeId:f.edge.id,distance:f.distance,points:p.map(tuple)});}}
  bound('exact-source-shoulder-stitches',supportStone,shoulderVertexStart,'support',false,shoulderIndexStart);
  meshBlock('exact-source-shoulder-triangles',shoulderFaces.map(f=>f.points));
  for(const edge of edges){const n=Math.ceil(edge.length/1.65);for(let i=0;i<n;i++){const s=i/n*edge.length,t=(i+1)/n*edge.length,w=edge.halfWidthAt(s),wt=edge.halfWidthAt(t),a=point(edge,s,-w),b=point(edge,s,w),sample={edgeId:edge.id,distance:s,left:tuple(a),right:tuple(b),rendered:ownership.get(edge.id+':'+s)??false};roadSamples.push(sample);routeRoadSamples.push(sample);
    for(const side of [-1,1]){const p=point(edge,s,side*w),q=point(edge,t,side*wt),mid=p.clone().lerp(p,q,.5),other=(f:typeof sourceFaces[number])=>f.edge!==edge;if(!roadIndex.clearAt(mid.x,mid.z,p.distance(q)/2+.025,other))continue;const out=point(edge,s,side*(w+.36),.024),next=point(edge,t,side*(wt+.36),.024);const copingStart=paving.positions.length/3;if(side>0)paving.quad(p.clone().add(vec(0,.024,0)),out,q.clone().add(vec(0,.024,0)),next);else paving.quad(out,p.clone().add(vec(0,.024,0)),next,q.clone().add(vec(0,.024,0)));bound('road-edge-coping',paving,copingStart,'visual-coping',false);
      if(i%20===0){const end=Math.min(edge.length,s+10.5),u=point(edge,s,side*(w+.68),1.02),v=point(edge,end,side*(edge.halfWidthAt(end)+.68),1.02),middle=u.clone().lerp(u,v,.5);if(roadIndex.clearAt(middle.x,middle.z,u.distance(v)/2+.20,other)){const points=beam('exposed-desert-road-rail',boards,u,v,.22,.27,'rail');railMembers.push({edgeId:edge.id,distance:s,side,points:points.map(tuple)});grounded('road-rail-grounded-post',u.x,u.z,.30,.30,u.y+.3,timber,0,'rail');}}}
    if(i%12===0&&ownership.get(edge.id+':'+s)){const h=.027;for(const side of [-1,1]){const l=side*w*.48;dark.quad(point(edge,s,l-.06,h),point(edge,s,l+.06,h),point(edge,t,l-.06,h),point(edge,t,l+.06,h));}}
  }}
  meshBlock('exact-exposed-desert-rail-triangles',components.filter(c=>c.role==='rail').flatMap(facesFor));
  for(let row=0;row<2;row++)for(let col=0;col<16;col++)if((row+col)%2===0){const e=course.commonStart,s=row*.7,t=(row+1)*.7,w=e.halfWidthAt(s);canvas.quad(point(e,s,-w+col*w/8,.03),point(e,s,-w+(col+1)*w/8,.03),point(e,t,-w+col*w/8,.03),point(e,t,-w+(col+1)*w/8,.03));}


  if(dark.indices.length)bound('diffuse-racing-wheelmarks',dark,0,'visual-coping',false,0);
  if(canvas.indices.length)bound('start-line-checker-inlay',canvas,0,'visual-coping',false,0);
 // Volumetric canyon shoulders are joined with exact grounded lower rings.
 // Interrupted positions/radii were chosen from the seven driver reveal views.
 // Their broad modeled banding complements the same connected heightfield.
 for(const [s,side,radius,length,height]of [[858,-1,10,30,10],[910,-1,12,36,14],[993,1,9,29,12],[1070,-1,11,27,15],[1134,1,11,31,13],[1217,-1,11,34,12],[1280,1,10,26,8]] as const){
  const e=course.commonStart,f=e.sample(s),p=point(e,s,side*(e.halfWidthAt(s)+45)),yaw=Math.atan2(f.t.x,f.t.z),footprint=rect(p,radius*2.08,length*1.04,yaw),ext=terrainExtrema(footprint);
  if(!roadIndex.clearAt(p.x,p.z,Math.hypot(radius,length/2)+23)||inSight(p.x,p.z,Math.hypot(radius,length/2)))continue;
  const at=local(vec(p.x,ext.low-.35,p.z),yaw),baseHeight=ext.high-ext.low+.35,rings=Array.from({length:17},(_,i)=>{const u=i/16,h=baseHeight+height*u,form=.94-.52*u*u+.09*Math.sin(u*4*Math.PI),scallop=1+.045*Math.sin(u*12*Math.PI);return{y:i===0?0:h,rx:radius*form*scallop,rz:length/2*form*(1+.08*Math.cos(u*5*Math.PI)),x:Math.sin(u*3.2)*radius*.18,z:Math.sin(u*4.1)*2};});
  const part=loft('wind-carved-sandstone-corridor',sandstone,at,rings,32,s,'terrain');
  // Pale thin sleeves are seated onto the same lobe profile, with closed
  // upper/lower surfaces. They are relief bands, not unsupported shelves.
  for(const k of [4,8,11,14]){const q=rings[k],next=rings[k+1];loft('canyon-joined-curving-stratum',strata,at,[{...q,rx:q.rx+.07,rz:q.rz+.07},{...next,rx:next.rx+.07,rz:next.rz+.07}],24,s,'terrain');}
  landforms.push({kind:part.kind,footprint:footprint.map(tuple),bottom:ext.low-.35,top:part.max[1]});
 }

 // Two independent closed elliptical stone rings. Twenty-four seated wedges
 // carry genuine intrados/extrados, face bevels and individually modeled joints.
 const archRing=(centerX:number)=>{
  const arc=(angle:number,radial:number,x:number)=>vec(centerX+x,38+(14+2*radial)*Math.sin(angle),290+(26+3*radial)*Math.cos(angle));
  for(let wedge=0;wedge<24;wedge++){
   const a0=wedge*Math.PI/24,a1=(wedge+1)*Math.PI/24,b=wedge===11||wedge===12?paleStone:wedge%5===0?strata:archStone,start=b.positions.length/3;
   const grid=(nu:number,nv:number,at:(u:number,v:number)=>pc.Vec3,reverse=false)=>{const o=b.positions.length/3;for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++)b.vertex(at(i/nu,j/nv),[i/nu,j/nv]);for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=o+j*(nu+1)+i,c=a+1,d=a+nu+1,e=d+1;b.indices.push(...(reverse?[a,c,d,c,e,d]:[a,d,c,c,d,e]));}};
   for(const x of [-4,4])grid(4,2,(u,v)=>arc(a0+(a1-a0)*u,v,x),x<0);
   for(const r of [0,1])grid(4,2,(u,v)=>arc(a0+(a1-a0)*u,r,-4+8*v),r>0);
   for(const a of [a0,a1])grid(2,2,(u,v)=>arc(a,u,-4+8*v),a===a0);
   bound('arch-seated-closed-elliptical-voussoir',b,start);
   // Face carving follows the wedge, inset from every structural boundary.
   for(const x of [-4.035,4.035]){const p=arc((a0+a1)/2,.60,x),q=arc((a0+a1)/2,.85,x);beam('arch-supported-radial-stone-relief',inlay,p,q,.10,.075,'detail');}
  }
 };
 for(const [i,cx]of [-248,-272].entries()){
  landmark='open-sunweave-arch-'+i;const first=components.length;
  for(const side of [-1,1]){
   const z=290+side*27.5,p=vec(cx,0,z+side*.4),at=foundation('arch-outward-plinth',p,9,4.8,0,18);
   // The inward edge remains at z264/316; every larger foot projects outward.
   for(let row=0;row<6;row++){
    const y=18+row*3.25,h=3.35;
    for(let col=0;col<2;col++){const width=3.99,x=cx-2+col*4;box('arch-six-course-pier-ashlar',archStone,vec(x,y+h/2,z),vec(width,h,3),0);}
    for(const face of [-1,1])box('arch-pier-incised-course-inset',strata,vec(cx+face*4.025,y+1.6,z+side*.25),vec(.08,1.15,1.7),0,'detail');
   }
   box('arch-pier-ring-contact-cap',paleStone,vec(cx,37.78,z),vec(8,.46,3));
   for(const x of [-3.4,3.4])box('arch-plinth-outer-contact-block',paleStone,vec(cx+x,18.5,z+side*.55),vec(1.1,1.05,3.7));
   // Eight-ray original star seal anchored to outer pier face.
   const seal=vec(cx+4.08,29,z);for(let ray=0;ray<8;ray++){const a=ray*Math.PI/4;beam('arch-original-star-seal-ray',bronze,seal,vec(seal.x,seal.y+Math.sin(a)*.70,seal.z+Math.cos(a)*.70),.13,.13,'detail');}
  }
  archRing(cx);
  const triangles=components.slice(first).flatMap(facesFor);meshBlock('open-arch-'+i+'-exact-solid-triangles',triangles);
  arches.push({edgeId:'alley',centerS:298.72575808588084+(i?32:8),depth:8,undersideY:38,center:[cx,18,290],portalWidth:52,driveableWidth:11.8,headroom:20,springY:38,innerRise:14,from:298.72575808588084+(i?28:4),to:298.72575808588084+(i?36:12),triangles});landmark=undefined;
 }

 // Pottery is a hollow lathed vessel with an actual recessed opening and two
 // curved handles seated at belly and neck. It is not a sphere with a sticker.
 const jar=(at:(x:number,y:number,z:number)=>pc.Vec3,x:number,y:number,z:number,r=1,h=3.3,glazed=false)=>{
  const here=local(at(x,y,z)),profile=[[0,r*.53],[.15,r*.67],[h*.17,r*.86],[h*.42,r],[h*.68,r*.81],[h*.83,r*.41],[h*.94,r*.39],[h,r*.48],[h+.10,r*.46],[h+.10,r*.32],[h-.13,r*.29],[h*.83,r*.29],[h*.70,r*.40],[h*.34,r*.80],[.23,r*.50]];
  turned('amphora-foot-belly-neck-hollow-lip',glazed?glaze:clay,here,profile,12,'detail');
  for(const side of [-1,1]){const path=Array.from({length:9},(_,i)=>{const u=i/8;return here(side*r*(.43+.55*u+Math.sin(u*Math.PI)*.65),h*(.85-.41*u),0);});tube('amphora-seated-paired-handle',glazed?glaze:clay,path,path.map(()=>r*.13),6,true,true,'detail');}
  for(const yy of [h*.76])turned('amphora-raised-incised-band',paleStone,local(at(x,y+yy,z)),[[0,r*(yy<.3?.73:.59)],[.05,r*(yy<.3?.73:.59)]],14,'detail');
 };
 const basket=(at:(x:number,y:number,z:number)=>pc.Vec3,x:number,y:number,z:number,r=1.4)=>{const here=local(at(x,y,z));turned('basket-grounded-woven-body',dryRoot,here,[[0,r*.75],[.2,r*.8],[1.2,r],[1.6,r]],12,'detail');for(let i=0;i<3;i++)turned('basket-seated-weave-ring',rope,here,[[.2+i*.36,r*(.82+i*.072)],[.28+i*.36,r*(.82+i*.072)]],12,'detail');for(let k=0;k<12;k++){const a=k*Math.PI/6;tube('basket-connected-upright-weave',boards,[here(Math.cos(a)*r*.76,.04,Math.sin(a)*r*.76),here(Math.cos(a)*r,1.63,Math.sin(a)*r)],[.055,.055],5,true,true,'detail');}};
 const wheel=(at:(x:number,y:number,z:number)=>pc.Vec3,x:number,y:number,z:number,r:number)=>{
  const path=Array.from({length:33},(_,i)=>{const a=i/32*Math.PI*2;return at(x,y+Math.cos(a)*r,z+Math.sin(a)*r);});tube('cart-open-grounded-wheel-rim',iron,path,path.map(()=>.13),8,false,false);tube('cart-real-axle-bearing-hub',bronze,[at(x-.25,y,z),at(x+.25,y,z)],[.27,.27],16);for(let i=0;i<8;i++){const a=i/8*Math.PI*2;beam('cart-eight-joined-wheel-spokes',boards,at(x,y,z),at(x,y+Math.cos(a)*r,z+Math.sin(a)*r),.15,.18);}
 };
 const cart=(at:(x:number,y:number,z:number)=>pc.Vec3,x:number,z:number)=>{
  const r=1.3;for(const side of [-1,1])wheel(at,x+side*2,r+.12,z,r);beam('cart-joined-through-axle',iron,at(x-2.3,r+.12,z),at(x+2.3,r+.12,z),.22);
  box('cart-axle-seated-underframe',timber,at(x,1.68,z),vec(4.2,.62,1.1));for(const side of [-1,1])box('cart-underframe-seated-longitudinal-bed-support',timber,at(x+side*1.4,1.72,z),vec(.40,.42,4.5));for(let i=0;i<8;i++)box('cart-supported-separate-bed-slat',boards,at(x,1.98,z-1.9+i*.54),vec(3.95,.18,.47));for(const side of [-1,1]){beam('cart-ground-resting-support-shaft',timber,at(x+side*1.7,1.9,z-1.5),at(x+side*1.7,.12,z-5.8),.24,.24);for(const zz of [-2.1,2.1])box('cart-corner-upright',timber,at(x+side*1.85,2.75,z+zz),vec(.25,1.65,.25));for(let j=0;j<3;j++)box('cart-raised-cargo-side-slat',boards,at(x+side*1.85,2.4+j*.44,z),vec(.22,.24,4.4));}box('cart-slats-seated-cargo-tray',boards,at(x,2.10,z),vec(3.5,.08,3.7));jar(at,x-.7,2.14,z-.65,.61,1.85);jar(at,x+.7,2.14,z+.5,.63,1.9,true);
 };
 const frame=(base:(x:number,y:number,z:number)=>pc.Vec3,ox:number,oz:number,w:number,d:number,h:number,yaw:number,index:number)=>{
  const at=local(base(ox,0,oz),yaw),corner=(x:number,z:number)=>h+.5*x/w+.35*z/d;
  for(const side of [-1,1])for(const end of [-1,1]){const x=side*w/2,z=end*d/2,q=at(x,0,z);box('sail-post-seated-stone-shoe',paleStone,at(x,.24,z),vec(1.2,.55,1.2),yaw);tube('sail-tapered-post',timber,[at(x,.2,z),at(x,corner(x,z)+.4,z)],[.34,.22],12);for(const dir of [-1,1]){const xx=x-side*1.8,zz=z-end*1.6;if(dir<0)beam('sail-post-seated-knee-brace',boards,at(x,corner(x,z)-2,z),at(xx,corner(xx,z),z),.25);else beam('sail-post-seated-knee-brace',boards,at(x,corner(x,z)-2,z),at(x,corner(x,zz),zz),.25);}
   for(const yy of [.45,corner(x,z)-.1])turned('sail-post-bound-lashing',rope,local(at(x,yy,z)),[[0,.37],[.15,.37]],12,'detail');
  }
  for(const side of [-1,1]){beam('sail-post-seated-crossbar',timber,at(-w/2-.4,corner(-w/2,side*d/2),side*d/2),at(w/2+.4,corner(w/2,side*d/2),side*d/2),.45,.48);beam('sail-post-seated-longitudinal-bar',boards,at(side*w/2,corner(side*w/2,-d/2),-d/2-.35),at(side*w/2,corner(side*w/2,d/2),d/2+.35),.40,.40);}
  const cloth=(u:number,v:number,delta=0)=>{const x=(u-.5)*w,z=(v-.5)*d;return at(x,corner(x,z)+.24-.90*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)+delta,z);};
  const b=index%2?paleCanvas:canvas,start=b.positions.length/3,nu=12,nv=8;
  for(let layer=0;layer<2;layer++){const o=b.positions.length/3;for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++)b.vertex(cloth(i/nu,j/nv,layer*.055),[i/nu*2,j/nv*2]);for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=o+j*(nu+1)+i,c=a+1,d=a+nu+1,e=d+1;b.indices.push(...(layer?[a,d,c,c,d,e]:[a,c,d,c,e,d]));}}
  for(let side=0;side<4;side++)for(let i=0;i<18;i++){const u=i/18,v=(i+1)/18,p=(t:number,dy:number)=>side===0?cloth(t,0,dy):side===1?cloth(t,1,dy):side===2?cloth(0,t,dy):cloth(1,t,dy);b.quad(p(u,0),p(v,0),p(u,.055),p(v,.055));}bound('sail-supported-sagging-closed-cloth',b,start);
  for(let side=0;side<4;side++){const path=Array.from({length:11},(_,i)=>{const u=i/10;return side===0?cloth(u,0,.08):side===1?cloth(u,1,.08):side===2?cloth(0,u,.08):cloth(1,u,.08);});tube('sail-cloth-joined-edge-hem',paleCanvas,path,path.map(()=>.08),5,true,true,'detail');}
  for(const side of [-1,1])for(const end of [-1,1]){const x=side*w/2,z=end*d/2;box('sail-beam-seated-rope-anchor',iron,at(x,corner(x,z)+.25,z),vec(.30,.26,.30),yaw,'detail');const path=[at(x,corner(x,z)+.26,z),at(x*.78,corner(x,z)+.19,z*.78)];tube('sail-corner-anchored-rope',rope,path,[.065,.065],8,true,true,'detail');}
 };
 for(const plot of plots){
  landmark=plot.kind;const first=components.length,p=vec(plot.x,0,plot.z),at=plot.kind==='wind-carved-spire'?local(p):foundation(plot.kind,p,plot.w,plot.d);
  const put=(kind:string,b:Batch,x:number,y:number,z:number,w:number,h:number,d:number)=>box(kind,b,at(x,y,z),vec(w,h,d));
  const strut=(kind:string,b:Batch,a:number[],c:number[],w:number,d=w)=>beam(kind,b,at(...a as [number,number,number]),at(...c as [number,number,number]),w,d);
  if(plot.kind==='sun-dial-beacon'){
   // Lower pier pair and separate closed arch wedges make a real open side
   // passage. Upper walls are independently cut around deep slit recesses.
   for(const side of [-1,1]){put('beacon-stepped-polygonal-foot',foundationStone,side*5.4,.50,0,5.4,1.02,12.6);for(let row=0;row<7;row++)put('beacon-passage-load-bearing-pier',beaconStone,side*5.2,1.0+row*1.7,0,3.9,1.73,10.6);put('beacon-pier-seated-arch-cap',paleStone,side*5.2,12.0,0,4.1,.65,11);}
   for(let seg=0;seg<20;seg++){const a=seg*Math.PI/20,b=(seg+1)*Math.PI/20,start=beaconStone.positions.length/3,ap=(u:number,outer:boolean,z:number)=>at((outer?7.1:3.25)*Math.cos(u),8.8+(outer?5.5:3.3)*Math.sin(u),z),v=[ap(a,false,-5.3),ap(b,false,-5.3),ap(a,true,-5.3),ap(b,true,-5.3),ap(a,false,5.3),ap(b,false,5.3),ap(a,true,5.3),ap(b,true,5.3)];for(const f of [[0,1,2,3],[5,4,7,6],[4,0,6,2],[1,5,3,7],[2,3,6,7],[4,5,0,1]])beaconStone.quad(v[f[0]],v[f[1]],v[f[2]],v[f[3]]);bound('beacon-closed-open-passage-arch',beaconStone,start);}
   // Horizontal seating course carries the upper tower on the arch crown.
   put('beacon-arch-seated-upper-course',beaconStone,0,14.0,0,14,1.2,10.6);
   for(const side of [-1,1])put('beacon-upper-return-wall',beaconStone,side*6.35,21.4,0,1.3,14.0,10.6);
   put('beacon-upper-back-wall',beaconStone,0,21.4,4.6,12,14,1.4);
   for(const [x,w]of [[-5.0,2.6],[0,4.4],[5.0,2.6]])put('beacon-front-slit-separated-masonry',beaconStone,x,21.4,-4.6,w,14,1.4);
   for(const side of [-1,1]){put('beacon-slit-lower-spandrel',beaconStone,side*3.0,15.45,-4.6,1.35,2.1,1.4);put('beacon-slit-upper-spandrel',beaconStone,side*3.0,26.15,-4.6,1.35,4.5,1.4);put('beacon-deep-slit-back',dark,side*3.0,20.15,-3.91,1.3,7.3,.18);for(const x of [side*3.0-.65,side*3.0+.65])put('beacon-slit-reveal-jamb',paleStone,x,20.1,-4.71,.18,7.4,1.2);}
   for(let row=0;row<8;row++)for(const side of [-1,1])for(const z of [-4.75,4.75])put('beacon-staggered-corner-quoin',paleStone,side*6.4,14.9+row*1.7,z,1.2+(row%2)*.55,1.45,1.2);
   put('beacon-seated-upper-coping',paleStone,0,28.7,0,14.9,.85,11.3);put('beacon-fin-support-shoulder',beaconStone,1.4,30.1,0,7,2.2,7);strut('beacon-original-offset-fin',beaconStone,[1.4,30.2,0],[4.5,39.7,.6],2.4,3.0);put('beacon-fin-bronze-seated-cap',bronze,4.5,39.65,.6,2.7,.4,3.25);
   // Dial rings share a recessed plate, radial strips and central socket;
   // each ring has physical contact instead of floating on a blank façade.
   put('beacon-dial-recessed-support-plate',bronze,0,23.7,-5.42,5.1,5.1,.28);
   for(const radius of [.8,1.6,2.25]){const path=Array.from({length:49},(_,i)=>{const a=i/48*Math.PI*2;return at(Math.cos(a)*radius,23.7+Math.sin(a)*radius,-5.62);});tube('beacon-supported-concentric-dial-ring',paleStone,path,path.map(()=>.105),8,false,false,'detail');}
   for(let ray=0;ray<12;ray++){const a=ray*Math.PI/6;strut('beacon-plate-seated-dial-radial-strip',inlay,[Math.cos(a)*.45,23.7+Math.sin(a)*.45,-5.68],[Math.cos(a)*2.42,23.7+Math.sin(a)*2.42,-5.68],.08,.07);}
   tube('beacon-gnomon-attached-socket',bronze,[at(0,23.7,-5.4),at(0,23.7,-6.0)],[.48,.48],20);strut('beacon-socket-seated-gnomon',bronze,[0,23.7,-5.85],[0,26.7,-9.5],.22,.30);strut('beacon-gnomon-braced-return',bronze,[0,26.7,-9.5],[0,26.7,-5.1],.17,.17);
   for(let side=-1;side<=1;side+=2)for(let j=0;j<5;j++)put('beacon-grounded-court-coping',foundationStone,side*12.5,.55,-9+j*4.5,1.0,1.12,3.7);
  }else if(plot.kind==='wind-carved-spire'){
   // Full footprint sets the hidden bottom and the exposed base. Offset
   // continuous rings cut two broad non-through pockets into one solid mass.
   const footprint=rect(vec(p.x,0,p.z),31,23),ext=terrainExtrema(footprint);p.y=ext.high;const here=local(vec(p.x,ext.low-.35,p.z)),base=p.y-ext.low+.35;
   const rings=Array.from({length:35},(_,i)=>{const u=i/34,bulge=1-.74*u+.15*Math.sin(u*5*Math.PI),neck=1-.16*Math.exp(-(((u-.38)/.07)**2))-.13*Math.exp(-(((u-.72)/.06)**2));return{y:i?base+u*36.5:0,rx:15*bulge*neck,rz:10.9*bulge*neck,x:Math.sin(u*5.2)*1.9,z:Math.sin(u*4)*1.1};});
   loft('spire-continuous-pocketed-sandstone-mass',sandstone,here,rings,40,7);
   for(const k of [5,10,15,21,26,31]){const a=rings[k],b=rings[k+1];loft('spire-seated-wavy-stratum-relief',strata,here,[{...a,rx:a.rx+.12,rz:a.rz+.12},{...b,rx:b.rx+.12,rz:b.rz+.12}],40,7);}
   groundedDetails.push({kind:'spire-continuous-pocketed-sandstone-mass',x:p.x,z:p.z,bottom:ext.low-.35,terrainY:groundY(p.x,p.z),footprint:footprint.map(tuple)});landforms.push({kind:'wind-carved-spire',footprint:footprint.map(tuple),bottom:ext.low-.35,top:p.y+36.5});
  }else if(plot.kind==='caravan-sailcourt'){
   frame(at,-8.0,-6.9,12,11,10.3,.10,0);frame(at,7.2,-6.5,12.2,10.2,12.9,-.12,1);frame(at,.1,8.1,16,9.4,9.0,.045,2);
   for(const [x,z]of [[-7,-6],[7,-6]]){put('sailcourt-supported-goods-table',boards,x,2.4,z,7,.38,2.8);for(const side of [-1,1])put('sailcourt-table-grounded-leg',timber,x+side*2.7,1.18,z,.35,2.4,.45);for(let i=0;i<2;i++)jar(at,x-1.3+i*2.6,2.59,z,.65,1.8,i===1);}
   for(const [x,z]of [[-11,9],[-6,9],[6,9],[11,9]])basket(at,x,0,z,1.25);
  }else if(plot.kind==='terracotta-kiln-court'){
   const here=local(at(-4,0,1));
   // The lower kiln is segmented around a real recessed mouth. The stepped
   // upper dome seats on this horseshoe instead of plugging the opening.
   for(let seg=0;seg<32;seg++){const a=seg*Math.PI*2/32,b=(seg+1)*Math.PI*2/32;if(seg>=22&&seg<=25)continue;const start=clay.positions.length/3,pt=(u:number,r:number,y:number)=>here(Math.cos(u)*r,y,Math.sin(u)*r),v=[pt(a,6.8,0),pt(b,6.8,0),pt(a,6.8,3.8),pt(b,6.8,3.8),pt(a,5.2,0),pt(b,5.2,0),pt(a,5.2,3.8),pt(b,5.2,3.8)];for(const f of [[0,1,2,3],[5,4,7,6],[4,0,6,2],[1,5,3,7],[2,3,6,7],[4,5,0,1]])clay.quad(v[f[0]],v[f[1]],v[f[2]],v[f[3]]);bound('kiln-mouth-separated-lower-masonry',clay,start);}
   turned('kiln-lower-wall-seated-clay-dome',clay,here,Array.from({length:21},(_,i)=>{const u=i/20;return[3.7+u*6.8,6.75*Math.sqrt(Math.max(.02,1-u*u))];}),40);
   box('kiln-recessed-firing-chamber-back',dark,at(-4,1.85,-2.8),vec(4.1,3.7,.25));box('kiln-mouth-grounded-hearth',foundationStone,at(-4,.12,-4.8),vec(4.2,.25,4.2));for(const side of [-1,1])box('kiln-mouth-seated-jamb',paleStone,at(-4+side*2.15,1.70,-5.1),vec(.7,3.5,1.4));box('kiln-mouth-jamb-seated-lintel',paleStone,at(-4,3.75,-5.1),vec(5,.6,1.4));
   turned('kiln-dome-attached-stepped-flue',clay,local(at(-4,10.1,1)),[[0,1.45],[1.2,1.45],[1.25,1.1],[3.9,1.1],[4.0,1.5],[4.35,1.5]],28);turned('kiln-flue-recessed-dark-mouth',dark,local(at(-4,14.28,1)),[[0,1.16],[.04,1.16]],24);
   // Two continuous end piers carry all three shelves. Their ends sit inside
   // the wood shelf perimeter; no nested boxes or coplanar exposed faces.
   for(const z of [-5,5])put('kiln-shelf-grounded-masonry-ledge',foundationStone,10,2.3,z,.75,4.6,1.6);
   for(let row=0;row<3;row++){const yy=1.3+row*1.65;put('kiln-ledge-seated-pottery-shelf',boards,10,yy+.12,0,3,.25,12);jar(at,10,yy+.245,-2+row*2,.75,1.35,row%2===0);}
   for(const [x,z,r,h]of [[-10,-10,1.0,2.7],[-7,-10,.85,2.9],[-4,-10,.9,3.1],[-1,-10,.8,2.6],[2,-10,1.05,3.0]])jar(at,x,0,z,r,h);
   for(let i=0;i<7;i++)put('kiln-grounded-glazed-tile-sample',i%2?glaze:clay,-11.5+i*1.9,.13,10,1.65,.26,1.5);
  }else{
   // Cut-in niches retain deep reveals. Backing surfaces are recessed behind
   // real return walls; no black decal is pasted onto an unbroken solid box.
   for(const side of [-1,1])put('waystation-grounded-side-wall',foundationStone,side*10,5.6,3,1.3,11.2,15);
   put('waystation-grounded-back-wall',foundationStone,0,5.6,10,20,11.2,1.4);
   for(const [x,w]of [[-9.2,1.6],[-4.4,2.4],[1.4,2.4],[7.3,5.4]])put('waystation-cut-niche-front-pier',foundationStone,x,5.6,-4, w,11.2,1.4);
   for(const x of [-6.65,-1.35,4.1]){put('waystation-niche-low-spandrel',foundationStone,x,1.35,-4,2.75,2.7,1.4);put('waystation-niche-upper-spandrel',foundationStone,x,9.8,-4,2.75,2.8,1.4);put('waystation-deep-niche-back',dark,x,5.45,-3.28,2.75,5.55,.15);for(const side of [-1,1])put('waystation-niche-return-jamb',paleStone,x+side*1.39,5.45,-4,.2,5.55,1.45);put('waystation-seated-niche-sill',paleStone,x,2.79,-4.1,2.9,.28,1.7);}
   put('waystation-wall-seated-flat-roof',paleStone,0,11.3,3,21.7,.5,15.8);for(let i=0;i<12;i++)put('waystation-terracotta-raised-coping',clay,-10.2+i*1.85,11.8,-4.6,1.75,.65,.9);for(const side of [-1,1])for(let i=0;i<8;i++)put('waystation-corner-projecting-block',paleStone,side*10,1.0+i*1.4,-4,1.7,1.2,1.8);
   for(const x of [-9,0,9]){put('waystation-porch-post-shoe',paleStone,x,.23,-10.4,1.1,.5,1.1);put('waystation-porch-post',timber,x,4.05,-10.4,.45,8.1,.45);strut('waystation-porch-seated-knee-brace',boards,[x,6,-10.4],[x+(x<0?2:-2),8,-10.4],.28);strut('waystation-wall-seated-porch-rafter',timber,[x,8,-10.6],[x,9.7,-4.0],.4,.4);}
   strut('waystation-post-seated-porch-lintel',timber,[-9.4,8.1,-10.4],[9.4,8.1,-10.4],.55);for(let i=0;i<18;i++)strut('waystation-supported-porch-slat',boards,[-9+i*1.05,8.38,-10.6],[-9+i*1.05,9.96,-4.0],.35,.15);
   for(let i=0;i<7;i++){const z=-10.4+i*.85,y=8.42+i*.205;box('waystation-frame-secured-folded-cloth',i%2?canvas:paleCanvas,at(-4.5,y,z),vec(6,.10,.92));}
   cart(at,13.1,1);for(const x of [-9,-5])basket(at,x,0,7,1.05);
  }
  const parts=components.slice(first);meshBlock(plot.kind+'-exact-solid-triangles',parts.flatMap(facesFor));props.push({kind:plot.kind,x:p.x,y:p.y,z:p.z,radius:plot.r});landmarks.push({kind:plot.kind,label:plot.label,position:tuple(p),radius:plot.r,height:plot.h});landmark=undefined;
 }
 // Sight endpoints are on real modeled surfaces. The independent audit casts
 // target-first-hit rays, so a reservation aimed at empty air cannot pass.
 for(const sight of sightlines){const plot=landmarks.find(p=>p.kind===sight.targetId)!;if(plot.kind==='sun-dial-beacon')sight.target=[plot.position[0],plot.position[1]+23.7,plot.position[2]-5.72];else if(plot.kind==='wind-carved-spire')sight.target=[plot.position[0],plot.position[1]+28,plot.position[2]];else if(plot.kind==='caravan-sailcourt')sight.target=[plot.position[0]+7.2,plot.position[1]+12.7,plot.position[2]-6.5];else sight.target=[plot.position[0]-4,plot.position[1]+8.7,plot.position[2]+1];}

 // Low staggered ruin walls make the open courtyards legible without covering
 // either lane. Their entire block footprint is seated into the terrain.
 for(const [cx,cz,yaw,len]of [[-130,315,.1,44],[-355,335,-.14,42],[-244,343,0,39],[-303,242,.04,35]] as const){
  if(!roadIndex.clearAt(cx,cz,len/2+23)||inSight(cx,cz,len/2+2))continue;
  const base=vec(cx,0,cz),at=foundation('ruin-courtyard-wall-foot',base,len,2.6,yaw);
  for(let row=0;row<3;row++)for(let i=0;i<Math.floor(len/3.8);i++){if(row===2&&(i%4===1||i===0))continue;box('ruin-staggered-seated-masonry-block',i%5===0?paleStone:archStone,at(-len/2+2+i*3.8+(row%2)*.20,.8+row*1.5,0),vec(3.72,1.55,2.0),yaw);}
 }
 // Sparse rooted deadwood and layered alluvial rock pockets. All are outside
 // full source-road/camera/reveal reservations, with no decorative road noise.
 for(let i=0;i<24;i++){
  const x=-610+noise(i*4+7)*990,z=-335+noise(i*4+11)*650,r=2.6+noise(i)*3.2;
  if(!roadIndex.clearAt(x,z,r+27)||plots.some(p=>Math.hypot(p.x-x,p.z-z)<p.r+r+8)||inSight(x,z,r+3))continue;
  const footprint=rect(vec(x,0,z),r*2,r*1.5),ext=terrainExtrema(footprint),at=local(vec(x,ext.low-.15,z));
  loft('grounded-wind-polished-alluvial-rock',i%3?strata:sandstone,at,[{y:0,rx:r*.82,rz:r*.62},{y:ext.high-ext.low+.6,rx:r*.96,rz:r*.70},{y:ext.high-ext.low+1.8,rx:r*.83,rz:r*.61},{y:ext.high-ext.low+2.6,rx:r*.42,rz:r*.35}],12,i,'detail');groundedDetails.push({kind:'grounded-wind-polished-alluvial-rock',x,z,bottom:ext.low-.15,terrainY:groundY(x,z),footprint:footprint.map(tuple)});
  if(i%4===0){const p=vec(x+r*.4,0,z),rootFoot=rect(p,.60,.60),root=terrainExtrema(rootFoot).low-.12;for(let branch=0;branch<3;branch++){const a=branch*Math.PI*2/3;tube('desert-grounded-dry-root',dryRoot,[vec(p.x,root,p.z),vec(p.x+.15,ext.high+1,p.z),vec(p.x+Math.cos(a)*1.6,ext.high+1.7+branch*.35,p.z+Math.sin(a)*1.6)],[.3,.18,.045],7,true,true,'detail');}groundedDetails.push({kind:'desert-grounded-dry-root',x:p.x,z:p.z,bottom:root,terrainY:groundY(p.x,p.z),footprint:rootFoot.map(tuple)});}
 }
 // Physical +lateral is the northern Archway Weave. Boards appear before the
 // steering decision window; board, relief, arrow and posts all block cameras.
 const signFirst=components.length;
 for(const side of [-1,1]){const e=course.commonStart,s=e.length-115,p=point(e,s,side*(e.halfWidthAt(s)+14)),yaw=Math.PI/2,at=local(vec(p.x,0,p.z),yaw),y=p.y+3.7;
  for(const x of [-2.4,2.4]){const q=at(x,0,0);grounded('desert-fork-grounded-sign-post',q.x,q.z,.34,.34,y+1.45,timber,0,'structure');}
  box('desert-fork-supported-arrow-board',boards,at(0,y,0),vec(6.4,2.6,.40),yaw);
  for(const z of [-.24,.24]){const start=inlay.positions.length/3;inlay.tri(at(side*2.9,y,z),at(side*1.5,y+.85,z),at(side*1.5,y-.85,z));bound('desert-fork-raised-direction-arrow',inlay,start,'detail',false);
   if(side>0){for(const x of [-1.4,.1])beam('desert-fork-arch-icon-pier',inlay,at(x,y-.85,z),at(x,y+.1,z),.15,.11,'detail');const path=Array.from({length:13},(_,i)=>{const a=i/12*Math.PI;return at(-.65+Math.cos(a)*.75,y+.1+Math.sin(a)*.65,z);});tube('desert-fork-open-arch-icon',inlay,path,path.map(()=>.11),6,true,true,'detail');}
   else{for(const x of [-.1,1.4])beam('desert-fork-sail-icon-pole',inlay,at(x,y-.85,z),at(x,y+.80,z),.12,.11,'detail');beam('desert-fork-sail-icon-supported-cloth',inlay,at(-.1,y+.7,z),at(.65,y+.35,z),.22,.1,'detail');beam('desert-fork-sail-icon-supported-cloth',inlay,at(.65,y+.35,z),at(1.4,y+.7,z),.22,.1,'detail');}
  }props.push({kind:'desert-fork-wayfinding',x:p.x,y:p.y,z:p.z,radius:3.5});
 }
 meshBlock('desert-fork-wayfinding-exact-triangles',components.slice(signFirst).flatMap(facesFor));
 // All remaining solid primitives, including quiet courtyard foundations and
 // dry roots, are covered by exact triangles rather than approximate boxes.
 meshBlock('desert-exact-road-support-and-coping',components.filter(c=>c.role==='road'||c.role==='visual-coping'||c.kind==='road-source-owned-underside').flatMap(facesFor));
 const covered=new Set(['sun-dial-beacon','wind-carved-spire','caravan-sailcourt','terracotta-kiln-court','saltstone-waystation','open-sunweave-arch-0','open-sunweave-arch-1']);
 meshBlock('desert-exact-grounded-landforms-and-details',components.filter(c=>!covered.has(c.landmark??'')&&c.role!=='road'&&c.role!=='visual-coping'&&c.role!=='rail'&&c.kind!=='dune-body-connected-terrain'&&!c.kind.startsWith('road-source-')&&!c.kind.startsWith('exact-source-')&&!c.kind.startsWith('desert-fork-')).flatMap(facesFor));
 const used=batches.filter(b=>b.indices.length),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const b of used)for(let i=0;i<b.positions.length;i++){const k=i%3;min[k]=Math.min(min[k],b.positions[i]);max[k]=Math.max(max[k],b.positions[i]);}
 const budget={batches:used.length,triangles:used.reduce((n,b)=>n+b.indices.length/3,0),vertices:used.reduce((n,b)=>n+b.positions.length/3,0)};
 if(budget.batches>24||budget.triangles>=110000||budget.vertices>=200000)throw new Error('Desert emitted geometry budget exceeded: '+JSON.stringify({budget,batches:used.map(b=>[b.name,b.indices.length/3,b.positions.length/3])}));
 return{version:1,trackId:course.id,batches:used,roadSamples,routeRoadSamples,roadFaces,roadUndersideFaces,shoulderFaces,props,structures:[{kind:'gallery',from:298.72575808588084,to:338.72575808588084,overheadClearance:20}],bounds:{min,max},cameraObstacles,components,landmarks,foundations,groundedDetails,railMembers,arches,sightlines,landforms,terrainGrid,budget};
}
