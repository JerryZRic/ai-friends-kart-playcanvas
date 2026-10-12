import * as pc from 'playcanvas';
import {LandMeshBatch as Batch} from './land-mesh-builder';
import {footprintArea,intersectRoadFootprint,subtractRoadFootprint,sampleRoadFootprints,roadFootprint,RoadFootprintIndex,type SceneryForkCourse,type SceneryRoadEdge,type RoadFootprint} from './land-road-mesh';
import type {LandSceneGeometry,LandPropPlacement} from './land-scenery';
import type {LandSceneTheme} from './land-scene';
import {cameraTerrainHeight,type CameraBlocker,type CameraHeightfield} from './land-camera';
import {CALDERA_VIADUCT,CALDERA_LANDMARKS,calderaViaductDepthAt} from './maps/caldera';

type Face={edgeId:string;distance:number;points:number[][]};
type Role='terrain'|'road'|'support'|'structure'|'rail'|'detail'|'visual-coping';
export type CalderaComponent={kind:string;batch:string;vertexStart:number;vertexEnd:number;indexStart:number;indexEnd:number;min:number[];max:number[];role:Role;solid:boolean;landmark?:string;assembly?:string};
export interface CalderaSceneGeometry extends LandSceneGeometry {
 routeRoadSamples:{edgeId:string;distance:number;left:number[];right:number[];rendered:boolean}[];
 roadFaces:Face[];roadUndersideFaces:Face[];shoulderFaces:Face[];
 cameraObstacles:(CameraBlocker&{kind:string})[];components:CalderaComponent[];
 landmarks:{kind:string;label:string;position:number[];radius:number;height:number}[];
 foundations:{kind:string;top:number;bottom:number;footprint:number[][];terrainLow:number;terrainHigh:number}[];
 groundedDetails:{kind:string;x:number;z:number;bottom:number;terrainY:number;footprint:number[][]}[];
 structuralContacts:{kind:string;first:number;second:number}[];
 railMembers:{edgeId:string;distance:number;side:number;points:number[][]}[];
 wheelContacts:never[];
 sightlines:{name:string;eye:number[];target:number[];radius:number;targetId:string}[];
 landforms:{kind:string;footprint:number[][];bottom:number;top:number}[];
 terrainGrid:CameraHeightfield;terrainVertices:number[];terrainTriangles:number[][][];
 terrainExposure:number[];terrainPartitions:{sourceTriangle:number;material:'basalt'|'ash'|'ochre';batch:string;indexStart:number;indexEnd:number}[];
 viaduct:{from:number;to:number;deckHalfWidth:number;groundLayer:string;faces:{kind:string;points:number[][]}[];undersideFaces:number[][][];supports:{kind:string;s:number;footprint:number[][];bottom:number;top:number;terrainLow:number;terrainHigh:number;component:number}[];archSpans:{from:number;to:number}[]};
 assemblies:{id:string;components:number[];closed:boolean}[];
 budget:{batches:number;triangles:number;vertices:number};
}
export const CALDERA_SCENE_THEME:Readonly<LandSceneTheme>=Object.freeze({textureLabel:'basalt crown original cooled stone and dry ash',ambient:'#b5b0a3',sky:'#d8d0ba',fogStart:1150,fogEnd:2450,cameraName:'Basalt Crown chase camera',sunName:'Basalt Crown warm raking sunlight',sunColor:'#fff0d4',sunIntensity:1.65,sunEuler:[36,-38,0] as const});
const vec=(x:number,y:number,z:number)=>new pc.Vec3(x,y,z),tuple=(p:pc.Vec3)=>[p.x,p.y,p.z];
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const smooth=(x:number)=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
const local=(p:pc.Vec3,yaw=0)=>{const c=Math.cos(yaw),s=Math.sin(yaw);return(x:number,y:number,z:number)=>vec(p.x+x*c+z*s,p.y+y,p.z-x*s+z*c);};
/** Remove endpoint duplicates and collinear vertices before every convex clip.
 * A repeated first vertex must never silently reverse cutter orientation. */
const clean=(input:pc.Vec3[])=>{let p=input.filter((v,i)=>v.distance(input[(i+input.length-1)%input.length])>1e-8),changed=true;while(changed&&p.length>3){changed=false;for(let i=0;i<p.length;i++){const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length];if(Math.abs((b.x-a.x)*(c.z-b.z)-(b.z-a.z)*(c.x-b.x))<1e-9){p.splice(i,1);changed=true;break;}}}return p;};
const cut=(p:pc.Vec3[],owner:pc.Vec3[])=>{const a=clean(p),b=clean(owner);return a.length>=3&&b.length>=3?subtractRoadFootprint(a,b).map(clean).filter(q=>q.length>=3&&footprintArea(q)>1e-8):a.length>=3?[a]:[];};
const yAt=(f:pc.Vec3[],x:number,z:number)=>{const[a,b,c]=f,den=(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x),u=((x-a.x)*(c.z-a.z)-(z-a.z)*(c.x-a.x))/den,v=((b.x-a.x)*(z-a.z)-(b.z-a.z)*(x-a.x))/den;return a.y+u*(b.y-a.y)+v*(c.y-a.y);};

/** One original dry-land environment. Runtime physics remains source-owned.
 * Every camera obstacle and every audit face is emitted from these batches. */
export function buildCalderaSceneGeometry(course:SceneryForkCourse):CalderaSceneGeometry {
 const basalt=new Batch('Caldera connected dark basalt rim','#454c50',1,'stone');
 const ash=new Batch('Caldera connected cooled ash terraces','#a89c83',1,'grass');
 const road=new Batch('Caldera exact dressed basalt road','#898c85',.97,'asphalt');
 const shoulder=new Batch('Caldera exact ground shoulder stitches','#8d8574',1,'stone');
 const foundationStone=new Batch('Caldera full footprint foundations','#67675e',1,'stone');
 const masonry=new Batch('Caldera viaduct dark masonry','#565956',.98,'stone');
 const voussoir=new Batch('Caldera light arch voussoirs','#979582',.97,'stone');
 const coping=new Batch('Caldera exposed pale coping and rails','#b9b39c',.94,'stone');
 const joints=new Batch('Caldera recessed joint faces','#343b3e',1,'stone');
 const walls=new Batch('Caldera warm archive wall stone','#8e8068',.98,'stone');
 const roof=new Batch('Caldera thick bearing slab roofs','#555e60',.98,'stone');
 const specimen=new Batch('Caldera original specimen strata','#a79a81',1,'stone');
 const bronze=new Batch('Caldera aged bronze hardware','#9a8250',.62,'none',.5);
 const timber=new Batch('Caldera dark specimen cradle timber','#65513a',.97,'wood');
 const reveal=new Batch('Caldera deep window reveals','#444b49',1,'stone');
 const trim=new Batch('Caldera archive inset trim','#b5a786',.95,'stone');
 const ochre=new Batch('Caldera connected ochre interbeds','#92734e',1,'stone');
 const tooth=new Batch('Caldera wind eroded window ribs','#667073',1,'stone');
 const inlay=new Batch('Caldera branch signs and inlays','#d4c6a5',.94,'stone');
 const groundcover=new Batch('Caldera sparse dry rooted groundcover','#867b56',1,'grass');
 const packing=new Batch('Caldera masonry joint packing','#6c685d',1,'stone');
 const batches=[basalt,ash,road,shoulder,foundationStone,masonry,voussoir,coping,joints,walls,roof,specimen,bronze,timber,reveal,trim,ochre,tooth,inlay,groundcover,packing];
 const edges=[course.commonStart,course.alternates.alley,course.alternates.boulevard,course.commonFinish],sourceFaces=sampleRoadFootprints(edges,1.65),roadIndex=new RoadFootprintIndex(sourceFaces),plots=CALDERA_LANDMARKS.plots;
 const [bridgeFrom,bridgeTo]=CALDERA_VIADUCT.upperPhysicalS,bridgeStations=CALDERA_VIADUCT.supportStations;
 // Unshrunk native bounds from all six assembled racers require 11.8331m.
 // A real stone ledge carries the outboard parapet beyond that envelope.
 const bridgeHalfWidth=13.1,upperRailCenter=12.6;
 const bridgeAt=(e:SceneryRoadEdge,s:number)=>e===course.commonFinish&&s>=bridgeFrom&&s<=bridgeTo;
 const groundFaces=sourceFaces.filter(f=>!bridgeAt(f.edge,f.distance)&&!bridgeAt(f.edge,f.distance+1.65)),groundIndex=new RoadFootprintIndex(groundFaces);
 const props:LandPropPlacement[]=[],roadSamples:CalderaSceneGeometry['roadSamples']=[],routeRoadSamples:CalderaSceneGeometry['routeRoadSamples']=[],roadFaces:Face[]=[],roadUndersideFaces:Face[]=[],shoulderFaces:Face[]=[];
 const components:CalderaComponent[]=[],cameraObstacles:CalderaSceneGeometry['cameraObstacles']=[],landmarks:CalderaSceneGeometry['landmarks']=[],foundations:CalderaSceneGeometry['foundations']=[],groundedDetails:CalderaSceneGeometry['groundedDetails']=[],structuralContacts:CalderaSceneGeometry['structuralContacts']=[],railMembers:CalderaSceneGeometry['railMembers']=[],landforms:CalderaSceneGeometry['landforms']=[],assemblies:CalderaSceneGeometry['assemblies']=[];
 const viaduct:CalderaSceneGeometry['viaduct']={from:bridgeFrom,to:bridgeTo,deckHalfWidth:bridgeHalfWidth,groundLayer:'lower-branches',faces:[],undersideFaces:[],supports:[],archSpans:[{from:bridgeStations[0],to:bridgeStations[1]},{from:bridgeStations[1],to:bridgeStations[2]}]};
 let landmark:string|undefined,assembly:string|undefined;
 const point=(e:SceneryRoadEdge,s:number,l=0,h=0)=>e.sample(s,l).p.clone().add(vec(0,h,0));
 const bound=(kind:string,b:Batch,start:number,role:Role='structure',solid=true,indexStart?:number)=>{
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=start*3;i<b.positions.length;i++){const k=i%3;min[k]=Math.min(min[k],b.positions[i]);max[k]=Math.max(max[k],b.positions[i]);}
  let index=indexStart??b.indices.length;while(indexStart===undefined&&index>0&&b.indices[index-1]>=start)index-=3;
  if(index===b.indices.length)return undefined;
  if(solid){let volume=0;const origin=b.positions.slice(start*3,start*3+3);for(let i=index;i<b.indices.length;i+=3){const p=b.indices.slice(i,i+3).map(k=>b.positions.slice(k*3,k*3+3).map((v,j)=>v-origin[j]));volume+=p[0][0]*(p[1][1]*p[2][2]-p[1][2]*p[2][1])+p[0][1]*(p[1][2]*p[2][0]-p[1][0]*p[2][2])+p[0][2]*(p[1][0]*p[2][1]-p[1][1]*p[2][0]);}if(volume<0)for(let i=index;i<b.indices.length;i+=3)[b.indices[i+1],b.indices[i+2]]=[b.indices[i+2],b.indices[i+1]];}
  const c:CalderaComponent={kind,batch:b.name,vertexStart:start,vertexEnd:b.positions.length/3,indexStart:index,indexEnd:b.indices.length,min,max,role,solid,...(landmark?{landmark}:{}),...(assembly?{assembly}:{})};components.push(c);return c;
 };
 const facesFor=(c:CalderaComponent)=>{const b=batches.find(b=>b.name===c.batch)!,out:number[][][]=[];for(let i=c.indexStart;i<c.indexEnd;i+=3)out.push(b.indices.slice(i,i+3).map(k=>b.positions.slice(k*3,k*3+3)));return out;};
 const meshBlock=(kind:string,triangles:number[][][])=>{if(!triangles.length)return;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const t of triangles)for(const p of t)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}cameraObstacles.push({kind,min,max,triangles});};
 const box=(kind:string,b:Batch,p:pc.Vec3,size:pc.Vec3,yaw=0,role:Role='structure')=>{const start=b.positions.length/3;b.box(p,size,yaw);return bound(kind,b,start,role)!;};
 const contact=(kind:string,a:CalderaComponent,b:CalderaComponent)=>structuralContacts.push({kind,first:components.indexOf(a),second:components.indexOf(b)});
 const beam=(kind:string,b:Batch,a:pc.Vec3,c:pc.Vec3,width:number,depth=width,role:Role='structure')=>{const y=c.clone().sub(a).normalize(),x=new pc.Vec3().cross(y,vec(0,1,0));if(x.length()<.01)x.set(1,0,0);else x.normalize();const z=new pc.Vec3().cross(x,y).normalize(),at=(p:pc.Vec3,i:number,j:number)=>p.clone().add(x.clone().mulScalar(i*width/2)).add(z.clone().mulScalar(j*depth/2));const v=[at(a,-1,-1),at(a,1,-1),at(c,-1,-1),at(c,1,-1),at(a,-1,1),at(a,1,1),at(c,-1,1),at(c,1,1)],start=b.positions.length/3;for(const f of [[0,1,2,3],[5,4,7,6],[4,0,6,2],[1,5,3,7],[2,3,6,7],[4,5,0,1]])b.quad(v[f[0]],v[f[1]],v[f[2]],v[f[3]]);return bound(kind,b,start,role)!;};
 const rect=(p:pc.Vec3,w:number,d:number,yaw=0)=>{const at=local(p,yaw);return[at(-w/2,0,-d/2),at(w/2,0,-d/2),at(w/2,0,d/2),at(-w/2,0,d/2)];};
 const solid=(kind:string,b:Batch,polygon:pc.Vec3[],bottom:number,top:number,role:Role='structure')=>{const p=clean(polygon),start=b.positions.length/3;for(let i=0;i<p.length;i++)b.vertex(vec(p[i].x,bottom,p[i].z));for(let i=0;i<p.length;i++)b.vertex(vec(p[i].x,top,p[i].z));const n=p.length;for(let i=1;i<n-1;i++)b.indices.push(start,start+i+1,start+i,start+n,start+n+i,start+n+i+1);for(let i=0;i<n;i++){const j=(i+1)%n;b.indices.push(start+i,start+j,start+i+n,start+j,start+j+n,start+i+n);}return bound(kind,b,start,role)!;};
 const sightlines:CalderaSceneGeometry['sightlines']=[
  {name:'upper broken rim gate',eye:tuple(point(course.commonStart,415,0,1.6)),target:[plots[0].x,76,plots[0].z],radius:3,targetId:plots[0].id},
  {name:'hooked bowl radial fan',eye:tuple(point(course.commonStart,1378,0,1.6)),target:[plots[1].x,18,plots[1].z],radius:3,targetId:plots[1].id},
  {name:'Ashen Sweep open archive',eye:tuple(point(course.alternates.boulevard,273,0,1.6)),target:[plots[2].x,22,plots[2].z],radius:3,targetId:plots[2].id},
  {name:'Jointline Cut resonator',eye:tuple(point(course.alternates.alley,225,0,1.6)),target:[plots[3].x,20,plots[3].z],radius:3,targetId:plots[3].id},
  {name:'rising return erosion window',eye:tuple(point(course.commonFinish,370,0,1.6)),target:[plots[4].x,47,plots[4].z],radius:3,targetId:plots[4].id},
 ];
 const spines=[
  {id:'northwest-cooled-caldera-rim',knots:[[-455,61,-30],[-430,78,130],[-300,90,300],[-110,95,350],[70,86,310]],widths:[105,120,130,120,95]},
  {id:'east-descending-broken-rim',knots:[[200,70,260],[300,66,145],[345,50,-25],[295,34,-170]],widths:[95,100,105,80]},
  {id:'hooked-inner-radial-spur',knots:[[-205,27,130],[-95,23,100],[-65,12,-65],[-175,9,-190]],widths:[50,75,95,70]},
  {id:'south-rising-return-ridge',knots:[[-185,16,-840],[60,34,-830],[215,56,-680],[205,61,-475],[20,57,-305]],widths:[110,125,105,95,70]},
  {id:'west-viaduct-abutment-rim',knots:[[-430,49,-390],[-440,56,-270],[-455,63,-110]],widths:[90,85,90]},
 ];
 // Upper bridge faces are deliberately absent from this spatial index. A
 // nearest-upper-road XZ fill would destroy both lower physical apertures.
 const nearest=(x:number,z:number)=>{
  let candidates:RoadFootprint[]=[];for(const r of [18,48,120,280,650,1500]){candidates=groundIndex.query(x-r,x+r,z-r,z+r);if(candidates.length)break;}
  let distance=Infinity,y=0,face=groundFaces[0];
  for(let pass=0;pass<2;pass++){for(const f of candidates){const[a,b,c]=f.points,den=(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x),u=((x-a.x)*(c.z-a.z)-(z-a.z)*(c.x-a.x))/den,v=((b.x-a.x)*(z-a.z)-(b.z-a.z)*(x-a.x))/den;if(u>=0&&v>=0&&u+v<=1)return{distance:0,y:a.y+u*(b.y-a.y)+v*(c.y-a.y),face:f};for(let k=0;k<3;k++){const a=f.points[k],b=f.points[(k+1)%3],dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1),d=Math.hypot(x-a.x-dx*t,z-a.z-dz*t);if(d<distance){distance=d;y=a.y+(b.y-a.y)*t;face=f;}}}if(pass===0)candidates=groundIndex.query(x-distance-1e-7,x+distance+1e-7,z-distance-1e-7,z+distance+1e-7);}
  return{distance,y,face};
 };
 const terrainY=(x:number,z:number)=>{
  // Broad unequal concavity and connected lithic spines carry the landscape.
  const r=Math.hypot((x+18)/330,(z-135)/260);let y=2.4+4.6*smooth(r/1.3);
  for(const spine of spines)for(let k=1;k<spine.knots.length;k++){const a=spine.knots[k-1],b=spine.knots[k],t=clamp(((x-a[0])*(b[0]-a[0])+(z-a[2])*(b[2]-a[2]))/((b[0]-a[0])**2+(b[2]-a[2])**2),0,1),d=Math.hypot(x-a[0]-(b[0]-a[0])*t,z-a[2]-(b[2]-a[2])*t),w=smooth(1-d/(spine.widths[k-1]+(spine.widths[k]-spine.widths[k-1])*t));y=Math.max(y,4+(a[1]+(b[1]-a[1])*t-4)*w);}
  for(const p of plots){const d=Math.hypot(x-p.x,z-p.z),w=smooth((p.radius+18-d)/20);if(p.id==='strata-archive'||p.id==='stone-resonator')y+=(p.ySeed-y)*w;}
  const q=nearest(x,z),d=q.distance,roadWeight=1-smooth((d-22)/35),target=q.y-.65-.085*Math.min(d,18);y+=(target-y)*roadWeight;
  // The whole crossing's low substrate is continuous, including the center
  // pier. The upper approaches blend only outside the literal arch mouths.
  const crossing=smooth((x+362)/25)*smooth((-108-x)/27)*smooth((z+425)/28)*smooth((-285-z)/28);y=Math.min(y,y+(11.1-y)*crossing);
  return y;
 };
 const minX=-590,maxX=465,minZ=-885,maxZ=455,nx=150,nz=125,dx=(maxX-minX)/nx,dz=(maxZ-minZ)/nz,heights:number[]=[];
 for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++)heights.push(terrainY(minX+x*dx,minZ+z*dz));
 // Exact road/cell polygon overlap caps EVERY covered physical grid vertex.
 // Lower full widths own crossing terrain even where the upper road overlaps.
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const xx=minX+x*dx,zz=minZ+z*dz,cell=[vec(xx,0,zz),vec(xx+dx,0,zz),vec(xx+dx,0,zz+dz),vec(xx,0,zz+dz)];let cap=Infinity;for(const f of groundIndex.query(xx,xx+dx,zz,zz+dz))if(footprintArea(intersectRoadFootprint(f.points,cell))>1e-10)cap=Math.min(cap,f.minY-.42);const i=z*(nx+1)+x;for(const j of [i,i+1,i+nx+1,i+nx+2])heights[j]=Math.min(heights[j],cap);}
 const terrainVertices:number[]=[],terrainTriangles:number[][][]=[],terrainExposure:number[]=[],terrainPartitions:CalderaSceneGeometry['terrainPartitions']=[];
 for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){const i=z*(nx+1)+x,wx=minX+x*dx,wz=minZ+z*dz;terrainVertices.push(wx,heights[i],wz);terrainExposure.push(heights[i]-(19+.010*(wx+170)+.007*(wz+120)));}
 type CV={p:pc.Vec3;key:string;value:number};
 const intersections=new Map<string,CV>(),caches=new Map<Batch,Map<string,number>>([[basalt,new Map()],[ash,new Map()]]);
 const tv=(i:number)=>vec(...terrainVertices.slice(i*3,i*3+3) as [number,number,number]);
 const sourceVertex=(i:number):CV=>({p:tv(i),key:'v:'+i,value:terrainExposure[i]});
 const contour=(ids:number[],positive:boolean)=>{const p=ids.map(sourceVertex),out:CV[]=[];for(let k=0;k<3;k++){const a=p[k],b=p[(k+1)%3],inside=positive?a.value>=0:a.value<=0,next=positive?b.value>=0:b.value<=0;if(inside)out.push(a);if(inside!==next){const lo=Math.min(ids[k],ids[(k+1)%3]),hi=Math.max(ids[k],ids[(k+1)%3]),key='e:'+lo+':'+hi;let v=intersections.get(key);if(!v){const aa=sourceVertex(lo),bb=sourceVertex(hi),t=aa.value/(aa.value-bb.value);v={p:aa.p.clone().lerp(aa.p,bb.p,t),key,value:0};intersections.set(key,v);}out.push(v);}}return out.filter((v,i)=>v.p.distance(out[(i+out.length-1)%out.length].p)>1e-10);};
 const emitContour=(sourceTriangle:number,p:CV[],b:Batch,material:'basalt'|'ash')=>{if(p.length<3)return;const indexStart=b.indices.length,cache=caches.get(b)!,index=(v:CV)=>{let i=cache.get(v.key);if(i===undefined){i=b.positions.length/3;b.vertex(v.p,[v.p.x*.11,v.p.z*.11]);cache.set(v.key,i);}return i;};for(let k=1;k<p.length-1;k++)if(footprintArea([p[0].p,p[k].p,p[k+1].p])>1e-9)b.indices.push(index(p[0]),index(p[k]),index(p[k+1]));if(b.indices.length>indexStart)terrainPartitions.push({sourceTriangle,material,batch:b.name,indexStart,indexEnd:b.indices.length});};
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const i=z*(nx+1)+x;for(const ids of [[i,i+nx+1,i+1],[i+1,i+nx+1,i+nx+2]]){const source=terrainTriangles.length;terrainTriangles.push(ids.map(i=>tuple(tv(i))));emitContour(source,contour(ids,true),basalt,'basalt');emitContour(source,contour(ids,false),ash,'ash');}}
 bound('connected-contour-basalt-heightfield',basalt,0,'terrain',false,0);bound('connected-contour-ash-heightfield',ash,0,'terrain',false,0);
 const terrainGrid:CameraHeightfield={minX,minZ,dx,dz,columns:nx+1,rows:nz+1,heights};cameraObstacles.push({kind:'caldera-actual-connected-heightfield',min:[minX,Math.min(...heights),minZ],max:[maxX,Math.max(...heights),maxZ],heightfield:terrainGrid});
 const groundY=(x:number,z:number)=>cameraTerrainHeight(terrainGrid,x,z)??terrainY(x,z);
 const terrainExtrema=(polygon:pc.Vec3[])=>{const x0=clamp(Math.floor((Math.min(...polygon.map(p=>p.x))-minX)/dx),0,nx-1),x1=clamp(Math.floor((Math.max(...polygon.map(p=>p.x))-minX)/dx),0,nx-1),z0=clamp(Math.floor((Math.min(...polygon.map(p=>p.z))-minZ)/dz),0,nz-1),z1=clamp(Math.floor((Math.max(...polygon.map(p=>p.z))-minZ)/dz),0,nz-1);let low=Infinity,high=-Infinity;for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const i=z*(nx+1)+x;for(const ids of [[i,i+nx+1,i+1],[i+1,i+nx+1,i+nx+2]])for(const p of intersectRoadFootprint(ids.map(tv),polygon)){low=Math.min(low,p.y);high=Math.max(high,p.y);}}return{low,high};};
 const foundation=(kind:string,p:pc.Vec3,w:number,d:number,yaw=0)=>{const footprint=rect(p,w,d,yaw),ext=terrainExtrema(footprint),bottom=ext.low-.25;p.y=ext.high+.16;const c=solid(kind+'-single-full-footprint-foundation',foundationStone,footprint,bottom,p.y,'support');foundations.push({kind,top:p.y,bottom,footprint:footprint.map(tuple),terrainLow:ext.low,terrainHigh:ext.high});return{at:local(p,yaw),component:c};};
 const grounded=(kind:string,p:pc.Vec3,w:number,d:number,top:number,b:Batch=foundationStone,yaw=0,role:Role='detail')=>{const footprint=rect(p,w,d,yaw),bottom=terrainExtrema(footprint).low-.12,c=solid(kind,b,footprint,bottom,top,role);groundedDetails.push({kind,x:p.x,z:p.z,bottom,terrainY:groundY(p.x,p.z),footprint:footprint.map(tuple)});return c;};
 // Full spatial union ownership. Only genuinely coplanar overlap is removed;
 // the crossing's two different physical Y layers both remain present.
 const priority=new Map([[course.commonStart,0],[course.commonFinish,1],[course.alternates.boulevard,2],[course.alternates.alley,3]]),ownership=new Map<string,boolean>();
 const samePlane=(a:RoadFootprint,b:RoadFootprint)=>{if(a.maxY<b.minY-.005||b.maxY<a.minY-.005)return false;const p=clean(intersectRoadFootprint(a.points,b.points));return p.length>=3&&footprintArea(p)>1e-8&&p.every(p=>Math.abs(yAt(a.points,p.x,p.z)-yAt(b.points,p.x,p.z))<.005);};
 for(const f of sourceFaces){let fragments=[f.points];for(const owner of roadIndex.query(f.minX,f.maxX,f.minZ,f.maxZ)){if(priority.get(owner.edge)!>=priority.get(f.edge)!||!samePlane(f,owner))continue;fragments=fragments.flatMap(p=>cut(p,owner.points));if(!fragments.length)break;}const key=f.edge.id+':'+f.distance;ownership.set(key,(ownership.get(key)??false)||fragments.length>0);for(const poly of fragments)for(let i=1;i<poly.length-1;i++){const p=[poly[0],poly[i],poly[i+1]];if(footprintArea(p)<1e-8)continue;road.tri(...p as [pc.Vec3,pc.Vec3,pc.Vec3]);roadFaces.push({edgeId:f.edge.id,distance:f.distance,points:p.map(tuple)});const under=[p[2],p[1],p[0]].map(q=>q.clone().add(vec(0,-.22,0)));if(!bridgeAt(f.edge,f.distance)&&!bridgeAt(f.edge,f.distance+1.65))shoulder.tri(...under as [pc.Vec3,pc.Vec3,pc.Vec3]);roadUndersideFaces.push({edgeId:f.edge.id,distance:f.distance,points:under.map(tuple)});}}
 bound('road-exact-full-width-spatial-union',road,0,'road',false,0);bound('ground-road-thick-underfaces',shoulder,0,'support',false,0);
 const shoulderStart=shoulder.positions.length/3,shoulderIndexStart=shoulder.indices.length,metrics=new WeakMap<RoadFootprint,{a:pc.Vec3;b:pc.Vec3;sign:number;length:number}>();
 const shoulderDistance=(f:RoadFootprint,p:pc.Vec3)=>{const q=metrics.get(f)!;return((q.b.x-q.a.x)*(p.z-q.a.z)-(q.b.z-q.a.z)*(p.x-q.a.x))*q.sign/q.length;};
 const nearLanding=(e:SceneryRoadEdge,s:number)=>e===course.commonFinish&&((s>=bridgeFrom-26.4&&s<=bridgeFrom)||(s>=bridgeTo&&s<=bridgeTo+26.4));
 const shoulderOuterY=(e:SceneryRoadEdge,s:number,p:pc.Vec3)=>Math.max(groundY(p.x,p.z)-.03,nearLanding(e,s)?p.y-1.5:-Infinity);
 const rawShoulders=edges.flatMap(edge=>{const out:RoadFootprint[]=[],n=Math.ceil(edge.length/1.65),stations=Array.from({length:n+1},(_,i)=>i/n*edge.length);if(edge===course.commonFinish)stations.push(bridgeFrom,bridgeTo);stations.sort((a,b)=>a-b);for(let i=0;i<stations.length-1;i++){const s=stations[i],t=stations[i+1];if(t-s<1e-8)continue;const upper=bridgeAt(edge,(s+t)/2),extra=upper?2:7;for(const side of [-1,1]){const a=point(edge,s,side*edge.halfWidthAt(s)),b=point(edge,t,side*edge.halfWidthAt(t)),c=point(edge,s,side*(edge.halfWidthAt(s)+extra)),d=point(edge,t,side*(edge.halfWidthAt(t)+extra));if(upper){c.y-=.02;d.y-=.02;}else{c.y=shoulderOuterY(edge,s,c);d.y=shoulderOuterY(edge,t,d);}for(const p of [[a,c,b],[b,c,d]]){const f=roadFootprint(edge,s,p);metrics.set(f,{a,b,sign:Math.sign((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x)),length:Math.hypot(b.x-a.x,b.z-a.z)});out.push(f);}}}return out;}),shoulderIndex=new RoadFootprintIndex(rawShoulders),shoulderOrder=new Map(rawShoulders.map((f,i)=>[f,i]));
 const sameLayer=(a:RoadFootprint,b:RoadFootprint)=>Math.abs(a.edge.sample(a.distance).p.y-b.edge.sample(b.distance).p.y)<5;
 for(const f of rawShoulders){let fragments=[f.points];for(const owner of roadIndex.query(f.minX,f.maxX,f.minZ,f.maxZ)){if(!sameLayer(f,owner)||footprintArea(intersectRoadFootprint(f.points,owner.points))<1e-8)continue;fragments=fragments.flatMap(p=>cut(p,owner.points));if(!fragments.length)break;}for(const owner of shoulderIndex.query(f.minX,f.maxX,f.minZ,f.maxZ)){if(owner.edge===f.edge||!sameLayer(f,owner))continue;const overlap=clean(intersectRoadFootprint(f.points,owner.points));if(overlap.length<3||footprintArea(overlap)<1e-8)continue;const cutter:pc.Vec3[]=[],delta=(p:pc.Vec3)=>shoulderDistance(f,p)-shoulderDistance(owner,p)+(shoulderOrder.get(owner)!<shoulderOrder.get(f)!?1e-10:-1e-10);for(let i=0;i<overlap.length;i++){const p=overlap[i],q=overlap[(i+1)%overlap.length],a=delta(p),b=delta(q);if(a>=0)cutter.push(p);if((a>=0)!==(b>=0))cutter.push(p.clone().lerp(p,q,a/(a-b)));}if(cutter.length<3||footprintArea(cutter)<1e-8)continue;fragments=fragments.flatMap(p=>cut(p,cutter));if(!fragments.length)break;}for(const poly of fragments)for(let i=1;i<poly.length-1;i++){const p=[poly[0],poly[i],poly[i+1]];if(footprintArea(p)<1e-8)continue;if(new pc.Vec3().cross(p[1].clone().sub(p[0]),p[2].clone().sub(p[0])).y<0)[p[1],p[2]]=[p[2],p[1]];shoulder.tri(...p as [pc.Vec3,pc.Vec3,pc.Vec3]);shoulderFaces.push({edgeId:f.edge.id,distance:f.distance,points:p.map(tuple)});}}
 bound('source-exact-layer-owned-shoulders',shoulder,shoulderStart,'support',false,shoulderIndexStart);
 // Real solid stone bridge: two unequal arch profiles, thick crown, source
 // camber and underside. Its top sits beneath the separate exact road skin.
 const bridgePoints=(s:number,l:number,h=0)=>point(course.commonFinish,s,l,h),deckUnder:pc.Vec3[][]=[];
 const stations=[bridgeFrom,bridgeTo,...bridgeStations];for(let s=bridgeFrom+1.65;s<bridgeTo;s+=1.65)stations.push(s);for(const s of bridgeStations)for(const d of [-4,4])if(s+d>bridgeFrom&&s+d<bridgeTo)stations.push(s+d);stations.sort((a,b)=>a-b);const unique=stations.filter((s,i)=>i===0||s-stations[i-1]>1e-8);
 const deckStart=masonry.positions.length/3,deckIndex=masonry.indices.length;
 for(let i=0;i<unique.length;i++){const s=unique[i];for(const [l,under]of [[-bridgeHalfWidth,false],[bridgeHalfWidth,false],[-bridgeHalfWidth,true],[bridgeHalfWidth,true]] as const)masonry.vertex(bridgePoints(s,l,under?-calderaViaductDepthAt(s)-.22:-.22));}
 const deckTriangle=(a:number,b:number,c:number,kind:string)=>{masonry.indices.push(a,c,b);const points=[a,c,b].map(k=>masonry.positions.slice(k*3,k*3+3));viaduct.faces.push({kind,points});if(kind==='arch-underside'){viaduct.undersideFaces.push(points);deckUnder.push(points.map(p=>vec(...p as [number,number,number])));}};
 for(let i=0;i<unique.length-1;i++){const a=deckStart+i*4,b=a+4;for(const[t,kind]of [[[a,a+1,b],'deck-top'],[[a+1,b+1,b],'deck-top'],[[a+2,b+2,a+3],'arch-underside'],[[a+3,b+2,b+3],'arch-underside'],[[a,b,a+2],'arch-side'],[[b,b+2,a+2],'arch-side'],[[a+1,a+3,b+1],'arch-side'],[[b+1,a+3,b+3],'arch-side']] as const)deckTriangle(t[0],t[1],t[2],kind);}
 const end=deckStart+(unique.length-1)*4;for(const t of [[deckStart,deckStart+2,deckStart+1],[deckStart+1,deckStart+2,deckStart+3],[end,end+1,end+2],[end+1,end+3,end+2]])deckTriangle(t[0],t[1],t[2],'abutment-deck-end');
 const deck=bound('viaduct-continuous-two-arch-solid-deck',masonry,deckStart,'structure',true,deckIndex)!;
 // Piers meet the exact triangle-linear soffit over their ENTIRE footprint.
 // Each shaft ends there: no nested full-height capital or coplanar shelf skin.
 for(let j=0;j<bridgeStations.length;j++){
  const s=bridgeStations[j],a=Math.max(bridgeFrom,s-4),b=Math.min(bridgeTo,s+4),footprint=[bridgePoints(a,-8),bridgePoints(a,8),bridgePoints(b,8),bridgePoints(b,-8)],ext=terrainExtrema(footprint),bottom=Math.min(ext.low-.35,30),topPolys=deckUnder.map(t=>clean(intersectRoadFootprint(t,footprint))).filter(p=>p.length>=3&&footprintArea(p)>1e-9),start=foundationStone.positions.length/3,indexStart=foundationStone.indices.length;
  const boundary:pc.Vec3[]=[];
  for(const poly of topPolys)for(let k=1;k<poly.length-1;k++){const p=[poly[0],poly[k],poly[k+1]];if(new pc.Vec3().cross(p[1].clone().sub(p[0]),p[2].clone().sub(p[0])).y<0)[p[1],p[2]]=[p[2],p[1]];foundationStone.tri(...p as [pc.Vec3,pc.Vec3,pc.Vec3]);}
  for(let side=0;side<4;side++){const p=footprint[side],q=footprint[(side+1)%4],vx=q.x-p.x,vz=q.z-p.z,ll=vx*vx+vz*vz,verts=topPolys.flat().filter(v=>Math.abs(vx*(v.z-p.z)-vz*(v.x-p.x))<1e-6).map(v=>({v,t:((v.x-p.x)*vx+(v.z-p.z)*vz)/ll})).filter(v=>v.t>=-1e-8&&v.t<=1+1e-8).sort((a,b)=>a.t-b.t),ordered=verts.filter((v,i)=>i===0||v.v.distance(verts[i-1].v)>1e-7).map(v=>v.v);for(let k=0;k<ordered.length-1;k++){const x=ordered[k],y=ordered[k+1];foundationStone.quad(vec(x.x,bottom,x.z),vec(y.x,bottom,y.z),x,y);boundary.push(vec(x.x,bottom,x.z));}}
  const center=vec(footprint.reduce((n,p)=>n+p.x,0)/4,bottom,footprint.reduce((n,p)=>n+p.z,0)/4);for(let k=0;k<boundary.length;k++)foundationStone.tri(center,boundary[k],boundary[(k+1)%boundary.length]);
  const c=bound('viaduct-'+(j===1?'center-pier':'rim-abutment')+'-exact-soffit-bearing',foundationStone,start,'support',true,indexStart)!,top=Math.max(...topPolys.flat().map(p=>p.y));contact('viaduct-whole-shaft-soffit-bearing',c,deck);viaduct.supports.push({kind:c.kind,s,footprint:footprint.map(tuple),bottom,top,terrainLow:ext.low,terrainHigh:ext.high,component:components.indexOf(c)});foundations.push({kind:c.kind,footprint:footprint.map(tuple),bottom,top,terrainLow:ext.low,terrainHigh:ext.high});for(const t of facesFor(c))viaduct.faces.push({kind:'pier',points:t});
 }
 // Source-affine masonry landings close the real road/shoulder-to-ridge
 // transition outside each aperture. They never raise the crossing terrain.
 // The two side bands seat the seven-metre dry shoulder within 0.02m; the
 // center band's top meets the existing 0.22m pavement underside exactly.
 for(const [from,to]of [[bridgeFrom-26.4,bridgeFrom],[bridgeTo,bridgeTo+26.4]]){
  const e=course.commonFinish,n=Math.ceil(e.length/1.65),ss=[from,to];for(let i=0;i<=n;i++){const s=i/n*e.length;if(s>from&&s<to)ss.push(s);}ss.sort((a,b)=>a-b);
  for(let i=0;i<ss.length-1;i++){const a=ss[i],b=ss[i+1];for(const band of [-1,0,1]){
   const lanes=band===0?[-9.53,9.53]:band<0?[-16.5,-9.53]:[9.53,16.5],topPoint=(s:number,l:number)=>{const p=point(e,s,l);p.y=band===0?p.y-.22:Math.abs(l)>10?shoulderOuterY(e,s,p)-.02:p.y-.02;return p;},top=[topPoint(a,lanes[0]),topPoint(a,lanes[1]),topPoint(b,lanes[0]),topPoint(b,lanes[1])],footprint=[top[0],top[1],top[3],top[2]],ext=terrainExtrema(footprint),bottom=ext.low-.35,start=foundationStone.positions.length/3;
   const q=[...top.map(p=>vec(p.x,bottom,p.z)),...top];for(const f of [[0,1,2,3],[4,6,5,7],[0,4,1,5],[2,3,6,7],[0,2,4,6],[1,5,3,7]])foundationStone.quad(q[f[0]],q[f[1]],q[f[2]],q[f[3]]);
   const c=bound('viaduct-grounded-source-affine-approach-masonry',foundationStone,start,'support')!;foundations.push({kind:c.kind,top:Math.max(...top.map(p=>p.y)),bottom,footprint:footprint.map(tuple),terrainLow:ext.low,terrainHigh:ext.high});for(const f of facesFor(c))viaduct.faces.push({kind:'approach-masonry',points:f});
  }}
 }
 // Visible thick voussoir wedges are attached side stones, never a painted arch.
 // Each wedge has a lower face on the frozen soffit and a finite 1.45m radial
 // thickness. Gaps expose the load-bearing darker continuous arch behind it.
 for(let span=0;span<2;span++){const from=bridgeStations[span],to=bridgeStations[span+1],count=Math.ceil((to-from)/3.2);for(let j=0;j<count;j++){const a=from+(to-from)*(j+.035)/count,b=from+(to-from)*(j+.965)/count;for(const side of [-1,1]){const aa=bridgePoints(a,side*bridgeHalfWidth,-calderaViaductDepthAt(a)-.22),bb=bridgePoints(b,side*bridgeHalfWidth,-calderaViaductDepthAt(b)-.22),cc=bridgePoints(a,side*(bridgeHalfWidth+.38),-calderaViaductDepthAt(a)-.22),dd=bridgePoints(b,side*(bridgeHalfWidth+.38),-calderaViaductDepthAt(b)-.22),v=[aa,bb,cc,dd,...[aa,bb,cc,dd].map(p=>p.clone().add(vec(0,1.45,0)))],start=voussoir.positions.length/3;for(const f of [[0,1,2,3],[4,6,5,7],[0,4,1,5],[2,3,6,7],[0,2,4,6],[1,5,3,7]])voussoir.quad(v[f[0]],v[f[1]],v[f[2]],v[f[3]]);const c=bound('viaduct-attached-real-voussoir-wedge',voussoir,start)!;contact('viaduct-wedge-dark-arch-bearing',c,deck);for(const t of facesFor(c))viaduct.faces.push({kind:'voussoir',points:t});}}}
 // Layered closed geological lofts: shared ring coordinates, actual incised
 // cooling joints and material bands replacing, not overlaying, their faces.
 const rock=(kind:string,at:(x:number,y:number,z:number)=>pc.Vec3,rings:{y:number;rx:number;rz:number;x?:number;z?:number}[],sides=64,seed=0,main:Batch=basalt)=>{
  const id=kind+'-'+assemblies.length,first=components.length;assembly=id;
  const points=rings.map((q,k)=>Array.from({length:sides},(_,j)=>{const a=j/sides*Math.PI*2,phase=a*7+seed+.07*k,groove=1-.065*Math.pow(Math.max(0,Math.cos(phase)),16),shape=1+.035*Math.sin(a*3+seed)+.018*Math.cos(a*5-seed);return at((q.x??0)+Math.cos(a)*q.rx*groove*shape,q.y+(k===0||k===rings.length-1?0:.11*Math.sin(a*3+seed)),(q.z??0)+Math.sin(a)*q.rz*groove*shape);}));
  for(let k=0;k<rings.length-1;k++){const b=k%9===4?ochre:k%9===5?joints:main,start=b.positions.length/3;for(const p of [...points[k],...points[k+1]])b.vertex(p);for(let j=0;j<sides;j++){const a=start+j,c=start+(j+1)%sides;b.indices.push(a,a+sides,c,c,a+sides,c+sides);}bound(kind+'-joined-lithic-band',b,start,'structure',false);}
  for(const k of [0,rings.length-1]){const b=main,start=b.positions.length/3,c=at(rings[k].x??0,rings[k].y,rings[k].z??0);b.vertex(c);for(const p of points[k])b.vertex(p);for(let j=0;j<sides;j++){const a=start+1+j,q=start+1+(j+1)%sides;b.indices.push(start,...(k===0?[a,q]:[q,a]));}bound(kind+'-closed-rock-cap',b,start,'structure',false);}
  assemblies.push({id,components:Array.from({length:components.length-first},(_,i)=>first+i),closed:true});assembly=undefined;return components[first];
 };
 const rockBase=(kind:string,x:number,z:number,rx:number,rz:number,rise:number,yaw=0)=>{const footprint=Array.from({length:64},(_,i)=>local(vec(x,0,z),yaw)(Math.cos(i/64*Math.PI*2)*rx*1.06,0,Math.sin(i/64*Math.PI*2)*rz*1.06)),ext=terrainExtrema(footprint),bottom=ext.low-.3,top=ext.high+rise,p=vec(x,top,z);rock(kind,local(vec(x,0,z),yaw),[{y:bottom,rx:rx*.94,rz:rz*.94},{y:ext.high-.2,rx,rz},{y:top,rx:rx*.96,rz:rz*.96}],64,1.1);foundations.push({kind,bottom,top,footprint:footprint.map(tuple),terrainLow:ext.low,terrainHigh:ext.high});landforms.push({kind,footprint:footprint.map(tuple),bottom,top});return p;};
 const record=(p:typeof plots[number],base:pc.Vec3,label:string)=>{landmarks.push({kind:p.id,label,position:tuple(base),radius:p.radius,height:p.height});props.push({kind:p.id,x:base.x,y:base.y,z:base.z,radius:p.radius});};
 // BROKEN RIM GATE: unequal cooled teeth, common broad foot and a true sky
 // saddle. There is deliberately no cross-road lintel or reused building.
 {
  const p=plots[0];landmark=p.id;const base=rockBase('broken-rim-connected-saddle',p.x,p.z,22,12,.5,.12),at=local(base,.12);
  for(const [x,z,h,rx,rz,lean]of [[-10,0,31,7.5,8.0,-3],[10.5,1.0,23,8.0,8.0,2.5]]){
   const rings=Array.from({length:16},(_,i)=>{const t=i/15,w=1-.45*t+.10*Math.sin(t*Math.PI);return{y:-.35+h*t,rx:rx*w,rz:rz*w,x:x+lean*t,z:z-1.6*t*t};});rock('broken-rim-unequal-cooled-tooth',at,rings,64,x*.17);
  }
  record(p,base,'Broken Rim Gate: two unequal cooled basalt teeth and a real open saddle');
 }
 // RADIAL JOINT FAN: five broad joined ribs rise from one dry apron. Recessed
 // side channels are relief in the solid rock, with finite closed bottoms.
 {
  const p=plots[1];landmark=p.id;const base=rockBase('radial-fan-attached-erosion-apron',p.x,p.z,21,15,.45,-.5);
  for(let i=0;i<5;i++){const angle=-1.07+i*.44,at=local(base,angle),rings=Array.from({length:11},(_,k)=>{const t=k/10;return{y:-.35+t*(6.8+i%3*1.7),rx:2.2*(1-.52*t),rz:13.2*(1-.36*t),x:(i-2)*2.9,z:2.3*t};});rock('radial-fan-broad-jointed-rib-'+i,at,rings,40,.7+i*.81,i%2?tooth:basalt);}
  record(p,base,'Radial Joint Fan: five broad cooling ribs joined to the hooked basin');
 }
 // STRATA ARCHIVE: low crescent of three open stone bays. Slabs sit on two
 // full-height jambs apiece; there is no opaque box behind the courtyard.
 {
  const p=plots[2];landmark=p.id;const base=vec(p.x,0,p.z),yaw=.48,{at,component:pad}=foundation(p.id,base,29,23,yaw);
  for(const [cx,cz,angle,height]of [[-9,3,-.23,7.1],[0,6,0,8.0],[9,3,.23,6.5]]){
   const bay=local(at(cx,0,cz),yaw+angle),jambs:CalderaComponent[]=[];
   for(const x of [-3.45,3.45]){const c=box('archive-continuous-bearing-jamb',walls,bay(x,height/2,0),vec(1.15,height,8.6),yaw+angle);jambs.push(c);contact('archive-jamb-full-pad-bearing',c,pad);}
   const slab=box('archive-thick-jamb-seated-roof',roof,bay(0,height+.62,0),vec(8.4,1.24,9.2),yaw+angle);for(const j of jambs)contact('archive-roof-jamb-bearing',slab,j);
   // Rear slit is actual space between finite wall segments, with inner faces.
   const low=box('archive-rear-low-sill-wall',walls,bay(0,1.2,3.9),vec(5.75,2.4,.8),yaw+angle),top=box('archive-rear-slit-lintel',walls,bay(0,(height+4.8)/2,3.9),vec(5.75,height-4.8,.8),yaw+angle);contact('archive-sill-pad-bearing',low,pad);contact('archive-lintel-roof-bearing',top,slab);
   for(const x of [-2.25,2.25])box('archive-rear-slit-side-reveal',reveal,bay(x,3.6,3.9),vec(1.25,2.4,.8),yaw+angle);
   for(let i=0;i<6;i++)box('archive-seated-roof-edge-block',trim,bay(-3.5+i*1.4,height+1.34,-4.35),vec(1.30,.20,.50),yaw+angle,'detail');
   for(let i=0;i<4;i++){const z=-3.1+i*2.05;for(const x of [-4.21,4.21])box('archive-attached-slab-joint-pin',packing,bay(x,height+.63,z),vec(.04,.90,.065),yaw+angle,'detail');}
  }
  // Five physical section specimens; each has one seat and a visible cradle.
  for(let i=0;i<5;i++){const x=-10+i*5,z=i%2?-6.7:-7.8,seat=box('archive-specimen-floor-seated-plinth',walls,at(x,.42,z),vec(3.0,.84,2.4),yaw);contact('archive-specimen-plinth-pad',seat,pad);for(const side of [-1,1]){const rail=box('archive-specimen-seated-timber-cradle',timber,at(x+side*.95,1.04,z),vec(.32,.40,2.0),yaw);contact('archive-cradle-stone-bearing',rail,seat);}const rings=Array.from({length:8},(_,k)=>({y:1.24+k*.40,rx:1.15-k*.045,rz:.88-k*.019,x,z}));const c=rock('archive-original-cut-layer-specimen',at,rings,32,i*.72,specimen);for(const cradle of components.filter(c=>c.kind==='archive-specimen-seated-timber-cradle').slice(-2))contact('archive-section-cradle-bearing',c,cradle);const plaque=box('archive-plinth-attached-bronze-label',bronze,at(x,.50,z-1.21),vec(1.25,.28,.05),yaw,'detail');contact('archive-label-plinth-bearing',plaque,seat);}
  // Curved bench is joined radial stone seats on individual broad legs.
  for(let i=0;i<7;i++){const a=Math.PI*.10+i*Math.PI*.11,x=Math.cos(a)*9,z=Math.sin(a)*4-1.2,leg=box('archive-courtyard-bench-foot',walls,at(x,.35,z),vec(1.15,.7,.8),yaw-a),seat=box('archive-courtyard-bench-bearing-seat',trim,at(x,.88,z),vec(2.2,.36,1.1),yaw-a);contact('archive-bench-seat-foot',seat,leg);contact('archive-bench-foot-pad',leg,pad);}
  const relief=box('archive-original-low-geology-relief-table',walls,at(0,.65,-2.5),vec(4.7,1.3,2.5),yaw);contact('archive-relief-pad',relief,pad);for(let i=0;i<9;i++){const z=-3.35+i*.19;beam('archive-original-crescent-relief-contour',ochre,at(-1.8+i*.08,1.3425,z),at(1.75-i*.1,1.3425,z+.19),.075,.085,'detail');}
  record(p,base,'Strata Archive: three open slab-roof bays, five original rock sections and a dry courtyard');
 }
 // STONE RESONATOR: static sounding rocks, an open low ring and a completely
 // attached striker. Its two-post side frame has shoes, pins and straps.
 {
  const p=plots[3];landmark=p.id;const base=vec(p.x,0,p.z),yaw=-.4,{at,component:pad}=foundation(p.id,base,24,23,yaw);
  for(let i=0;i<18;i++){const a=i/18*Math.PI*2,b=(i+1)/18*Math.PI*2,poly=[at(Math.cos(a)*9.7,0,Math.sin(a)*9.7),at(Math.cos(b)*9.7,0,Math.sin(b)*9.7),at(Math.cos(b)*11,0,Math.sin(b)*11),at(Math.cos(a)*11,0,Math.sin(a)*11)],ring=solid('resonator-radial-ring-wedge',i%3===0?ochre:tooth,poly,base.y,base.y+.85);contact('resonator-ring-pad-bearing',ring,pad);}
  for(const [x,z,h,rx]of [[-5,1,6.8,2.0],[0,3.8,9.5,2.2],[5,0,5.4,2.0]]){const seat=box('resonator-sounding-block-stone-seat',walls,at(x,.48,z),vec(5,.96,4.5),yaw);contact('resonator-seat-pad-bearing',seat,pad);const rings=Array.from({length:13},(_,k)=>({y:.96+h*k/12,rx:rx*(1-.18*k/12),rz:1.5*(1-.1*k/12),x:x+.65*k/12,z})),c=rock('resonator-unequal-cooled-sounding-block',at,rings,48,h*.12);contact('resonator-block-seat-bearing',c,seat);}
  const posts:CalderaComponent[]=[];for(const x of [-3.3,3.3]){const shoe=box('resonator-frame-grounded-stone-shoe',walls,at(x,.30,-5.3),vec(1.25,.6,1.3),yaw),post=box('resonator-frame-continuous-timber-post',timber,at(x,3.30,-5.3),vec(.62,5.4,.68),yaw);contact('resonator-shoe-pad',shoe,pad);contact('resonator-post-shoe',post,shoe);posts.push(post);}
  const lintel=box('resonator-post-seated-timber-crossbeam',timber,at(0,6.3,-5.3),vec(7.6,.6,.85),yaw);for(const post of posts)contact('resonator-beam-post',lintel,post);
  const clevis=box('resonator-crossbeam-attached-bronze-clevis',bronze,at(0,5.86,-5.3),vec(.62,.32,.95),yaw),strap=box('resonator-clevis-attached-static-suspension',bronze,at(0,4.86,-5.3),vec(.16,1.68,.18),yaw);contact('resonator-clevis-beam',clevis,lintel);contact('resonator-strap-clevis',strap,clevis);const striker=box('resonator-attached-static-bronze-striker',bronze,at(0,3.79,-5.3),vec(2.1,.46,.58),yaw);contact('resonator-striker-strap',striker,strap);
  for(const x of [-3.3,3.3])for(const z of [-5.68,-4.92])box('resonator-seated-frame-pin-head',bronze,at(x,5.8,z),vec(.28,.28,.12),yaw,'detail');
  for(const side of [-1,1]){const leg=box('resonator-visitor-bench-foot',walls,at(side*6.8,.35,-6.6),vec(1.2,.7,.95),yaw),seat=box('resonator-visitor-bench-bearing-slab',trim,at(side*6.8,.9,-6.6),vec(3.1,.40,1.25),yaw);contact('resonator-bench-seat-foot',seat,leg);contact('resonator-bench-foot-pad',leg,pad);}
  record(p,base,'Stone Resonator: three unequal sounding blocks and a visibly attached static bronze striker');
 }
 // WIND-CARVED TOOTH: two broad asymmetric feet support a real hollow arch.
 // Four closed surfaces (outer/inner/front/back) enclose a literal daylight
 // window. No dark decal or opaque bounding box fills its aperture.
 {
  const p=plots[4];landmark=p.id;const base=rockBase('wind-tooth-connected-talus-foot',p.x,p.z,23,15,.6,.42),at=local(base,.42);
  const ringAt=(a:number,outer:boolean,front:boolean)=>{const rx=outer?17.3:7.2,ry=outer?24.2:11.7,center=outer?5.4:5.4,shift=2.3*Math.sin(a);return at(Math.cos(a)*rx+shift,center+Math.sin(a)*ry,front?-4.3:4.3);};
  const n=72,start=tooth.positions.length/3;
  for(let i=0;i<=n;i++){const a=i/n*Math.PI;for(const[outer,front]of [[true,true],[true,false],[false,true],[false,false]] as const)tooth.vertex(ringAt(a,outer,front));}
  for(let i=0;i<n;i++){const a=start+i*4,b=a+4;for(const t of [[a,b,a+1],[a+1,b,b+1],[a+2,a+3,b+2],[a+3,b+3,b+2],[a,a+2,b],[a+2,b+2,b],[a+1,b+1,a+3],[a+3,b+1,b+3]])tooth.indices.push(...t);}
  const end=start+n*4;tooth.indices.push(start,start+1,start+2,start+1,start+3,start+2,end,end+2,end+1,end+1,end+2,end+3);const arch=bound('wind-tooth-real-thick-daylight-window',tooth,start)!;
  for(const side of [-1,1]){const foot=box('wind-tooth-wide-window-bearing-foot',tooth,at(side*12.25,2.7,0),vec(10.1,5.4,8.6),.42);contact('wind-tooth-arch-whole-foot-bearing',arch,foot);}
  // A shorter sloping companion shoulder shares the talus foot.
  rock('wind-tooth-attached-companion-shoulder',at,Array.from({length:17},(_,i)=>({y:-.15+i*.75,rx:4.7-i*.12,rz:5.3-i*.18,x:-11-i*.06,z:7.2})),56,.31,tooth);
  record(p,base,'Wind-carved Tooth: asymmetric buttress with a real thick erosion window and connected talus');
 }
 landmark=undefined;
 // Exposed road boundaries, thin seated coping and sparse safety beams.
 // Neither branch ownership nor the common tail length is a rail cutoff.
 for(const edge of edges){const n=Math.ceil(edge.length/1.65);for(let i=0;i<n;i++){const s=i/n*edge.length,t=(i+1)/n*edge.length,w=edge.halfWidthAt(s),wt=edge.halfWidthAt(t),sample={edgeId:edge.id,distance:s,left:tuple(point(edge,s,-w)),right:tuple(point(edge,s,w)),rendered:ownership.get(edge.id+':'+s)??false};roadSamples.push(sample);routeRoadSamples.push(sample);
  for(const side of [-1,1]){const p=point(edge,s,side*w),q=point(edge,t,side*wt),mid=p.clone().lerp(p,q,.5),other=(f:RoadFootprint)=>f.edge!==edge&&Math.abs(f.edge.sample(f.distance).p.y-mid.y)<5;if(!roadIndex.clearAt(mid.x,mid.z,p.distance(q)/2+.025,other))continue;const out=point(edge,s,side*(w+.32),.026),next=point(edge,t,side*(wt+.32),.026),start=coping.positions.length/3;if(i%3===0){if(side>0)coping.quad(p.clone().add(vec(0,.026,0)),out,q.clone().add(vec(0,.026,0)),next);else coping.quad(out,p.clone().add(vec(0,.026,0)),next,q.clone().add(vec(0,.026,0)));bound('road-exposed-upward-coping',coping,start,'visual-coping',false);}
   if(i%38===0){const end=Math.min(edge.length,s+9.4),u=point(edge,s,side*(bridgeAt(edge,s)?upperRailCenter:w+.83),.96),v=point(edge,end,side*(bridgeAt(edge,end)?upperRailCenter:edge.halfWidthAt(end)+.83),.96),middle=u.clone().lerp(u,v,.5);if(roadIndex.clearAt(middle.x,middle.z,u.distance(v)/2+.25,other)){const b=beam(bridgeAt(edge,s)&&bridgeAt(edge,end)?'viaduct-outboard-seated-stone-parapet':'exposed-road-seated-low-stone-rail',coping,u,v,.28,.3,'rail');if(b.kind.startsWith('viaduct-'))for(const f of facesFor(b))viaduct.faces.push({kind:'upper-parapet',points:f});railMembers.push({edgeId:edge.id,distance:s,side,points:facesFor(b).flat()});for(const [d,p]of [[s,u],[end,v]] as const){const top=p.y+ .12;if(bridgeAt(edge,d)){const low=edge.sample(d).p.y-.22,c=box('viaduct-deck-seated-rail-pier',packing,vec(p.x,(top+low)/2,p.z),vec(.40,top-low,.40),Math.atan2(edge.sample(d).t.x,edge.sample(d).t.z),'rail');contact('viaduct-rail-pier-beam',c,b);}else{const c=grounded('road-grounded-rail-pier',p,.40,.40,top,packing,0,'rail');contact('road-rail-pier-beam',c,b);}}}}
  }
 }}
 for(let row=0;row<2;row++)for(let col=0;col<16;col++)if((row+col)%2===0){const e=course.commonStart,s=row*.75,t=(row+1)*.75,w=e.halfWidthAt(s),start=inlay.positions.length/3;inlay.quad(point(e,s,-w+col*w/8,.032),point(e,s,-w+(col+1)*w/8,.032),point(e,t,-w+col*w/8,.032),point(e,t,-w+(col+1)*w/8,.032));bound('start-line-original-stone-checker',inlay,start,'visual-coping',false);}
 // Two stone choice tablets precede the actual steering window, outside all
 // reserved camera orbits. Raised icons are physically seated on their boards.
 for(const side of [-1,1]){const e=course.commonStart,s=e.length-118,p=point(e,s,side*(e.halfWidthAt(s)+24)),top=terrainExtrema(rect(p,5.8,1.1)).high+4.3,at=local(vec(p.x,0,p.z));const posts:CalderaComponent[]=[];for(const x of [-2,2])posts.push(grounded('fork-wayfinding-grounded-stone-leg',at(x,0,0),.55,.65,top-.1,walls));const board=box('fork-wayfinding-seated-stone-tablet',walls,at(0,top-.7,0),vec(5.6,1.6,.44));for(const post of posts)contact('fork-tablet-leg-bearing',board,post);for(let i=0;i<(side<0?2:3);i++){const icon=box('fork-tablet-attached-route-glyph',inlay,at(-1.55+i*.65,top-.7,-.255),vec(.23,side<0?.60:1.03,.07));contact('fork-glyph-stone-bearing',icon,board);}for(const sign of [-1,1]){const c=beam('fork-tablet-attached-arrow',inlay,at(side*1.90,top-.7,-.255),at(side*.95,top-.7+sign*.45,-.255),.12,.08,'detail');contact('fork-arrow-stone-bearing',c,board);}}
 // A few rooted dry tussocks on distant terraces. No imported assets, trees,
 // lava or moving hazard is used to substitute for connected geology.
 for(let i=0;i<14;i++){const x=-505+(i%7)*128,z=-785+Math.floor(i/7)*960;if(!roadIndex.clearAt(x,z,34)||plots.some(p=>Math.hypot(x-p.x,z-p.z)<p.radius+12))continue;const footprint=rect(vec(x,0,z),1.6,1.6),ext=terrainExtrema(footprint),bottom=ext.low-.1;for(let j=0;j<5;j++){const angle=j*Math.PI*2/5,tip=vec(x+Math.cos(angle)*.75,ext.high+1.1+(j%2)*.4,z+Math.sin(angle)*.75);beam('dry-terrain-rooted-broad-grass-blade',groundcover,vec(x,bottom,z),tip,.085,.12,'detail');}groundedDetails.push({kind:'dry-tussock-root',x,z,bottom,terrainY:groundY(x,z),footprint:footprint.map(tuple)});}
 // Reveal targets now refer to the centroids of actual emitted hero faces.
 for(const sight of sightlines){const seed=[...sight.target];let best=Infinity;for(const c of components.filter(c=>c.landmark===sight.targetId))for(const face of facesFor(c)){const p=[0,1,2].map(k=>(face[0][k]+face[1][k]+face[2][k])/3),d=p.reduce((n,v,k)=>n+(v-seed[k])**2,0);if(d<best){best=d;sight.target=p;}}}
 meshBlock('caldera-actual-source-shoulder-triangles',shoulderFaces.map(f=>f.points));
 meshBlock('caldera-actual-viaduct-triangles',components.filter(c=>c.kind.startsWith('viaduct-')).flatMap(facesFor));
 for(const p of plots)meshBlock('caldera-actual-'+p.id,components.filter(c=>c.landmark===p.id).flatMap(facesFor));
 meshBlock('caldera-actual-other-assemblies',components.filter(c=>!c.landmark&&!c.kind.startsWith('viaduct-')&&c.role!=='terrain'&&c.role!=='road'&&c.kind!=='source-exact-layer-owned-shoulders').flatMap(facesFor));
 const used=batches.filter(b=>b.indices.length),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const b of used)for(let i=0;i<b.positions.length;i++){const k=i%3;min[k]=Math.min(min[k],b.positions[i]);max[k]=Math.max(max[k],b.positions[i]);}
 const budget={batches:used.length,triangles:used.reduce((n,b)=>n+b.indices.length/3,0),vertices:used.reduce((n,b)=>n+b.positions.length/3,0)};
 if(budget.batches>24||budget.triangles>=110000||budget.vertices>=200000)throw new Error('Caldera emitted geometry budget exceeded: '+JSON.stringify({budget,batches:used.map(b=>[b.name,b.indices.length/3,b.positions.length/3])}));
 return{version:1,trackId:course.id,batches:used,roadSamples,routeRoadSamples,roadFaces,roadUndersideFaces,shoulderFaces,props,structures:[{kind:'viaduct',from:bridgeFrom,to:bridgeTo,overheadClearance:24}],bounds:{min,max},cameraObstacles,components,landmarks,foundations,groundedDetails,railMembers,wheelContacts:[],structuralContacts,sightlines,landforms,terrainGrid,terrainVertices,terrainTriangles,terrainExposure,terrainPartitions,viaduct,assemblies,budget};
}
