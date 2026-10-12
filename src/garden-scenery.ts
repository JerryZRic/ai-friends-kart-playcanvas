import * as pc from 'playcanvas';
import {LandMeshBatch as Batch} from './land-mesh-builder';
import {footprintArea,intersectRoadFootprint,subtractRoadFootprint,sampleRoadFootprints,roadFootprint,RoadFootprintIndex,type SceneryForkCourse,type SceneryRoadEdge,type RoadFootprint} from './land-road-mesh';
import type {LandSceneGeometry,LandPropPlacement} from './land-scenery';
import type {LandSceneTheme} from './land-scene';
import {cameraTerrainHeight,type CameraBlocker,type CameraHeightfield} from './land-camera';
import {GARDEN_ARBOR,GARDEN_LANDMARKS,gardenArborPlan} from './maps/garden';

type Face={edgeId:string;distance:number;points:number[][]};
type Role='terrain'|'road'|'support'|'structure'|'rail'|'detail'|'visual-coping';
export type GardenComponent={kind:string;batch:string;vertexStart:number;vertexEnd:number;indexStart:number;indexEnd:number;min:number[];max:number[];role:Role;solid:boolean;landmark?:string;assembly?:string};
export interface GardenSceneGeometry extends LandSceneGeometry {
 routeRoadSamples:{edgeId:string;distance:number;left:number[];right:number[];rendered:boolean}[];
 roadFaces:Face[];roadUndersideFaces:Face[];shoulderFaces:Face[];
 cameraObstacles:(CameraBlocker&{kind:string})[];components:GardenComponent[];
 landmarks:{kind:string;label:string;position:number[];radius:number;height:number}[];
 foundations:{kind:string;top:number;bottom:number;footprint:number[][];terrainLow:number;terrainHigh:number;component:number}[];
 groundedDetails:{kind:string;x:number;z:number;bottom:number;terrainY:number;footprint:number[][];component:number}[];
 structuralContacts:{kind:string;first:number;second:number}[];
 railMembers:{edgeId:string;distance:number;side:number;points:number[][]}[];
 wheelContacts:never[];
 sightlines:{name:string;eye:number[];target:number[];radius:number;targetId:string}[];
 landforms:{kind:string;footprint:number[][];bottom:number;top:number}[];
 terrainGrid:CameraHeightfield;terrainVertices:number[];terrainTriangles:number[][][];
 terrainExposure:number[];terrainPartitions:{sourceTriangle:number;material:'meadow'|'fern';batch:string;indexStart:number;indexEnd:number}[];
 arbor:{from:number;to:number;faces:{kind:string;points:number[][]}[];members:{id:string;kind:string;component:number;aNode:string;bNode:string}[];supports:{id:string;s:number;side:number;footprint:number[][];bottom:number;top:number;terrainLow:number;terrainHigh:number;component:number}[]};
 assemblies:{id:string;components:number[];closed:boolean}[];
 enrichmentAssemblies:any[];
 budget:{batches:number;triangles:number;vertices:number};
}
export const GARDEN_SCENE_THEME:Readonly<LandSceneTheme>=Object.freeze({textureLabel:'original Verdant Canopy garden stone leaf and laminated timber',ambient:'#c4d9b5',sky:'#e4efd5',fogStart:1050,fogEnd:2250,cameraName:'Verdant Canopy chase camera',sunName:'Verdant Canopy warm morning sunlight',sunColor:'#fff2d5',sunIntensity:1.6,sunEuler:[43,-36,0] as const});
const vec=(x:number,y:number,z:number)=>new pc.Vec3(x,y,z),tuple=(p:pc.Vec3)=>[p.x,p.y,p.z];
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const smooth=(x:number)=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
const local=(p:pc.Vec3,yaw=0)=>{const c=Math.cos(yaw),s=Math.sin(yaw);return(x:number,y:number,z:number)=>vec(p.x+x*c+z*s,p.y+y,p.z-x*s+z*c);};
const clean=(input:pc.Vec3[])=>{let p=input.filter((v,i)=>v.distance(input[(i+input.length-1)%input.length])>1e-8),changed=true;while(changed&&p.length>3){changed=false;for(let i=0;i<p.length;i++){const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length];if(Math.abs((b.x-a.x)*(c.z-b.z)-(b.z-a.z)*(c.x-b.x))<1e-9){p.splice(i,1);changed=true;break;}}}return p;};
const cut=(p:pc.Vec3[],owner:pc.Vec3[])=>{const a=clean(p),b=clean(owner);return a.length>=3&&b.length>=3?subtractRoadFootprint(a,b).map(clean).filter(q=>q.length>=3&&footprintArea(q)>1e-8):a.length>=3?[a]:[];};
const yAt=(f:pc.Vec3[],x:number,z:number)=>{const[a,b,c]=f,den=(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x),u=((x-a.x)*(c.z-a.z)-(z-a.z)*(c.x-a.x))/den,v=((b.x-a.x)*(z-a.z)-(b.z-a.z)*(x-a.x))/den;return a.y+u*(b.y-a.y)+v*(c.y-a.y);};

/** Source-authored static botanical garden. All geometry and camera triangles
 * share these exact buffers; no downloaded art, new physics or shaders. */
export function buildGardenSceneGeometry(course:SceneryForkCourse):GardenSceneGeometry {
 const meadow=new Batch('Garden connected sunlit meadow','#95af6a',1,'grass');
 const fern=new Batch('Garden connected deep fern terraces','#638e67',1,'grass');
 const soil=new Batch('Garden planted rich soil','#695438',1,'stone');
 const road=new Batch('Garden warm dressed garden paving','#c1b99b',.96,'asphalt');
 const shoulder=new Batch('Garden graded gravel shoulder stitches','#b6a989',1,'stone');
 const foundationStone=new Batch('Garden whole footprint limestone foundations','#a39576',1,'stone');
 const planterStone=new Batch('Garden pale limestone planter rims','#ddd0a6',.94,'stone');
 const timber=new Batch('Garden opaque honey laminated timber','#ba8b50',.9,'wood');
 const darkTimber=new Batch('Garden opaque umber truss webs','#86633d',.98,'wood');
 const bronze=new Batch('Garden quiet bronze bearing hardware','#a08640',.6,'none',.45);
 const leaf=new Batch('Garden emerald modeled leaf surfaces','#37795d',.8,'grass');
 const newLeaf=new Batch('Garden lime new modeled leaf surfaces','#a4b755',.85,'grass');
 const underside=new Batch('Garden teal modeled leaf underside','#4b8073',.92,'grass');
 const ivory=new Batch('Garden warm ivory petal solids','#eee0a8',.85,'none');
 const blush=new Batch('Garden muted coral petal solids','#d9947b',.83,'none');
 const amber=new Batch('Garden amber petal and seed heart','#d7b757',.78,'none');
 const stem=new Batch('Garden continuous green stems and midribs','#557845',.95,'wood');
 const labelWood=new Batch('Garden specimen board and bench oak','#9c7851',.95,'wood');
 const inlay=new Batch('Garden ivory inset route glyphs','#f3e7ba',.91,'stone');
 const seedShell=new Batch('Garden seed section chestnut shell','#906141',.94,'wood');
 const seedFlesh=new Batch('Garden seed section warm heartwood','#d2af74',.93,'wood');
 const batches=[meadow,fern,soil,road,shoulder,foundationStone,planterStone,timber,darkTimber,bronze,leaf,newLeaf,underside,ivory,blush,amber,stem,labelWood,inlay,seedShell,seedFlesh];
 const edges=[course.commonStart,course.alternates.alley,course.alternates.boulevard,course.commonFinish],sourceFaces=sampleRoadFootprints(edges,1.65),roadIndex=new RoadFootprintIndex(sourceFaces),plots=GARDEN_LANDMARKS.plots;
 const props:LandPropPlacement[]=[],roadSamples:GardenSceneGeometry['roadSamples']=[],routeRoadSamples:GardenSceneGeometry['routeRoadSamples']=[],roadFaces:Face[]=[],roadUndersideFaces:Face[]=[],shoulderFaces:Face[]=[];
 const components:GardenComponent[]=[],cameraObstacles:GardenSceneGeometry['cameraObstacles']=[],landmarks:GardenSceneGeometry['landmarks']=[],foundations:GardenSceneGeometry['foundations']=[],groundedDetails:GardenSceneGeometry['groundedDetails']=[],structuralContacts:GardenSceneGeometry['structuralContacts']=[],railMembers:GardenSceneGeometry['railMembers']=[],landforms:GardenSceneGeometry['landforms']=[],assemblies:GardenSceneGeometry['assemblies']=[];
 const arbor:GardenSceneGeometry['arbor']={from:GARDEN_ARBOR.physicalS[0],to:GARDEN_ARBOR.physicalS[1],faces:[],members:[],supports:[]};
 let landmark:string|undefined,assembly:string|undefined;
 const point=(e:SceneryRoadEdge,s:number,l=0,h=0)=>e.sample(s,l).p.clone().add(vec(0,h,0));
 const bound=(kind:string,b:Batch,start:number,role:Role='structure',solid=true,indexStart?:number)=>{
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=start*3;i<b.positions.length;i++){const k=i%3;min[k]=Math.min(min[k],b.positions[i]);max[k]=Math.max(max[k],b.positions[i]);}
  let index=indexStart??b.indices.length;while(indexStart===undefined&&index>0&&b.indices[index-1]>=start)index-=3;
  if(index===b.indices.length)return undefined;
  if(solid){let volume=0;const origin=b.positions.slice(start*3,start*3+3);for(let i=index;i<b.indices.length;i+=3){const p=b.indices.slice(i,i+3).map(k=>b.positions.slice(k*3,k*3+3).map((v,j)=>v-origin[j]));volume+=p[0][0]*(p[1][1]*p[2][2]-p[1][2]*p[2][1])+p[0][1]*(p[1][2]*p[2][0]-p[1][0]*p[2][2])+p[0][2]*(p[1][0]*p[2][1]-p[1][1]*p[2][0]);}if(volume<0)for(let i=index;i<b.indices.length;i+=3)[b.indices[i+1],b.indices[i+2]]=[b.indices[i+2],b.indices[i+1]];}
  const c:GardenComponent={kind,batch:b.name,vertexStart:start,vertexEnd:b.positions.length/3,indexStart:index,indexEnd:b.indices.length,min,max,role,solid,...(landmark?{landmark}:{}),...(assembly?{assembly}:{})};components.push(c);return c;
 };
 const facesFor=(c:GardenComponent)=>{const b=batches.find(b=>b.name===c.batch)!,out:number[][][]=[];for(let i=c.indexStart;i<c.indexEnd;i+=3)out.push(b.indices.slice(i,i+3).map(k=>b.positions.slice(k*3,k*3+3)));return out;};
 const meshBlock=(kind:string,triangles:number[][][])=>{if(!triangles.length)return;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const t of triangles)for(const p of t)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}cameraObstacles.push({kind,min,max,triangles});};
 const box=(kind:string,b:Batch,p:pc.Vec3,size:pc.Vec3,yaw=0,role:Role='structure')=>{const start=b.positions.length/3;b.box(p,size,yaw);return bound(kind,b,start,role)!;};
 const contact=(kind:string,a:GardenComponent,b:GardenComponent)=>structuralContacts.push({kind,first:components.indexOf(a),second:components.indexOf(b)});
 const beam=(kind:string,b:Batch,a:pc.Vec3,c:pc.Vec3,width:number,depth=width,role:Role='structure',extension=0,relief?:'cheeks'|'all')=>{
  const y=c.clone().sub(a).normalize(),ref=Math.abs(y.y)>.95?vec(1,0,0):vec(0,1,0),x=new pc.Vec3().cross(y,ref).normalize(),z=new pc.Vec3().cross(y,x).normalize(),aa=a.clone().sub(y.clone().mulScalar(extension)),cc=c.clone().add(y.clone().mulScalar(extension)),at=(p:pc.Vec3,i:number,j:number)=>p.clone().add(x.clone().mulScalar(i*width/2)).add(z.clone().mulScalar(j*depth/2));
  const v=[at(aa,-1,-1),at(aa,1,-1),at(aa,1,1),at(aa,-1,1),at(cc,-1,-1),at(cc,1,-1),at(cc,1,1),at(cc,-1,1)],start=b.positions.length/3;for(const p of v)b.vertex(p);for(const [face,f]of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].entries()){if((relief==='all'&&face>=2)||(relief==='cheeks'&&(face===3||face===5))){const center=f.reduce((p,i)=>p.add(v[i]),vec(0,0,0)).mulScalar(.25),core=aa.clone().lerp(aa,cc,.5),inward=core.sub(center).normalize().mulScalar(.016),index=b.positions.length/3;b.vertex(center.add(inward));for(let i=0;i<4;i++)b.indices.push(start+f[i],start+f[(i+1)%4],index);}else b.indices.push(start+f[0],start+f[1],start+f[2],start+f[0],start+f[2],start+f[3]);}return bound(kind,b,start,role)!;
 };
 const rect=(p:pc.Vec3,w:number,d:number,yaw=0)=>{const at=local(p,yaw);return[at(-w/2,0,-d/2),at(w/2,0,-d/2),at(w/2,0,d/2),at(-w/2,0,d/2)];};
 const solid=(kind:string,b:Batch,polygon:pc.Vec3[],bottom:number,top:number,role:Role='structure')=>{const p=clean(polygon),start=b.positions.length/3;for(let i=0;i<p.length;i++)b.vertex(vec(p[i].x,bottom,p[i].z));for(let i=0;i<p.length;i++)b.vertex(vec(p[i].x,top,p[i].z));const n=p.length;for(let i=1;i<n-1;i++)b.indices.push(start,start+i+1,start+i,start+n,start+n+i,start+n+i+1);for(let i=0;i<n;i++){const j=(i+1)%n;b.indices.push(start+i,start+j,start+i+n,start+j,start+j+n,start+i+n);}return bound(kind,b,start,role)!;};
 const sightlines:GardenSceneGeometry['sightlines']=[
  {name:'western ascent folded leaf crown',eye:tuple(point(course.commonStart,306,0,1.6)),target:[plots[0].x,35,plots[0].z],radius:2.5,targetId:plots[0].id},
  {name:'upper terrace sevenfold flower',eye:tuple(point(course.commonStart,790,0,1.6)),target:[plots[1].x,31,plots[1].z],radius:2.5,targetId:plots[1].id},
  {name:'outer garden seed library',eye:tuple(point(course.alternates.boulevard,240,0,1.6)),target:[plots[2].x,22,plots[2].z],radius:2,targetId:plots[2].id},
  {name:'open arbor curled fern crown',eye:tuple(point(course.alternates.alley,224,0,1.6)),target:[plots[3].x,23,plots[3].z],radius:2,targetId:plots[3].id},
  {name:'southern return layered crown bloom',eye:tuple(point(course.commonFinish,350,0,1.6)),target:[plots[4].x,39,plots[4].z],radius:2.5,targetId:plots[4].id},
 ];
 const spines=[
  {id:'west-foldleaf-terrace',knots:[[-430,19,-80],[-410,29,85],[-300,39,190],[-180,37,205]],widths:[85,100,100,90]},
  {id:'inner-scalloped-garden-bed',knots:[[-230,13,20],[-150,15,-5],[-80,18,30],[0,21,65]],widths:[90,110,100,75]},
  {id:'upper-petal-terrace',knots:[[-90,28,235],[-35,34,335],[85,37,395],[205,31,335]],widths:[65,85,100,80]},
  {id:'east-crescent-garden',knots:[[290,27,220],[310,25,85],[295,22,-45]],widths:[90,80,70]},
  {id:'arbor-lower-bed',knots:[[105,16,-185],[105,14,-300],[95,16,-440]],widths:[100,100,100]},
  {id:'outer-petal-ribbon',knots:[[380,23,-205],[415,26,-335],[365,24,-465]],widths:[90,110,100]},
  {id:'south-bloom-terrace',knots:[[100,25,-650],[-45,33,-635],[-175,31,-580],[-315,20,-540]],widths:[90,120,105,90]},
  {id:'western-basin-return',knots:[[-430,3,-410],[-440,9,-285],[-420,20,-155]],widths:[95,90,80]},
 ];
 const nearest=(x:number,z:number)=>{
  let candidates:RoadFootprint[]=[];for(const r of [18,48,120,280,650,1500]){candidates=roadIndex.query(x-r,x+r,z-r,z+r);if(candidates.length)break;}
  let distance=Infinity,y=0,face=sourceFaces[0];
  for(let pass=0;pass<2;pass++){for(const f of candidates){const[a,b,c]=f.points,den=(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x),u=((x-a.x)*(c.z-a.z)-(z-a.z)*(c.x-a.x))/den,v=((b.x-a.x)*(z-a.z)-(b.z-a.z)*(x-a.x))/den;if(u>=0&&v>=0&&u+v<=1)return{distance:0,y:a.y+u*(b.y-a.y)+v*(c.y-a.y),face:f};for(let k=0;k<3;k++){const a=f.points[k],b=f.points[(k+1)%3],dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1),d=Math.hypot(x-a.x-dx*t,z-a.z-dz*t);if(d<distance){distance=d;y=a.y+(b.y-a.y)*t;face=f;}}}if(pass===0)candidates=roadIndex.query(x-distance-1e-7,x+distance+1e-7,z-distance-1e-7,z+distance+1e-7);}
  return{distance,y,face};
 };
 const terrainY=(x:number,z:number)=>{
  let y=2.3+1.6*Math.sin(x*.004)*Math.cos(z*.003);
  for(const spine of spines)for(let k=1;k<spine.knots.length;k++){const a=spine.knots[k-1],b=spine.knots[k],t=clamp(((x-a[0])*(b[0]-a[0])+(z-a[2])*(b[2]-a[2]))/((b[0]-a[0])**2+(b[2]-a[2])**2),0,1),d=Math.hypot(x-a[0]-(b[0]-a[0])*t,z-a[2]-(b[2]-a[2])*t),w=smooth(1-d/(spine.widths[k-1]+(spine.widths[k]-spine.widths[k-1])*t));y=Math.max(y,2+(a[1]+(b[1]-a[1])*t-2)*w);}
  for(const p of plots){const d=Math.hypot(x-p.x,z-p.z),w=smooth((p.radius+25-d)/25);y+=(p.ySeed-y)*w;}
  const q=nearest(x,z),d=q.distance,weight=1-smooth((d-22)/35),target=q.y-.62-.073*Math.min(d,18);return y+(target-y)*weight;
 };
 const minX=-510,maxX=490,minZ=-730,maxZ=450,nx=150,nz=125,dx=(maxX-minX)/nx,dz=(maxZ-minZ)/nz,heights:number[]=[];
 for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++)heights.push(terrainY(minX+x*dx,minZ+z*dz));
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const xx=minX+x*dx,zz=minZ+z*dz,cell=[vec(xx,0,zz),vec(xx+dx,0,zz),vec(xx+dx,0,zz+dz),vec(xx,0,zz+dz)];let cap=Infinity;for(const f of roadIndex.query(xx,xx+dx,zz,zz+dz))if(footprintArea(intersectRoadFootprint(f.points,cell))>1e-10)cap=Math.min(cap,f.minY-.42);const i=z*(nx+1)+x;for(const j of [i,i+1,i+nx+1,i+nx+2])heights[j]=Math.min(heights[j],cap);}
 const terrainVertices:number[]=[],terrainTriangles:number[][][]=[],terrainExposure:number[]=[],terrainPartitions:GardenSceneGeometry['terrainPartitions']=[];
 // One continuous planted contour field. Material edges interpolate the same
 // physical source triangles; no categorical cells, overlays or detached hills.
 for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){const i=z*(nx+1)+x,wx=minX+x*dx,wz=minZ+z*dz;terrainVertices.push(wx,heights[i],wz);terrainExposure.push(heights[i]-(13.7+.004*(wx+120)+2.4*Math.sin(wz*.009)+1.8*Math.sin(wx*.012+wz*.004)));}
 type CV={p:pc.Vec3;key:string;value:number};
 const intersections=new Map<string,CV>(),caches=new Map<Batch,Map<string,number>>([[meadow,new Map()],[fern,new Map()]]);
 const tv=(i:number)=>vec(...terrainVertices.slice(i*3,i*3+3) as [number,number,number]);
 const sourceVertex=(i:number):CV=>({p:tv(i),key:'v:'+i,value:terrainExposure[i]});
 const contour=(ids:number[],positive:boolean)=>{const p=ids.map(sourceVertex),out:CV[]=[];for(let k=0;k<3;k++){const a=p[k],b=p[(k+1)%3],inside=positive?a.value>=0:a.value<=0,next=positive?b.value>=0:b.value<=0;if(inside)out.push(a);if(inside!==next){const lo=Math.min(ids[k],ids[(k+1)%3]),hi=Math.max(ids[k],ids[(k+1)%3]),key='e:'+lo+':'+hi;let v=intersections.get(key);if(!v){const aa=sourceVertex(lo),bb=sourceVertex(hi),t=aa.value/(aa.value-bb.value);v={p:aa.p.clone().lerp(aa.p,bb.p,t),key,value:0};intersections.set(key,v);}out.push(v);}}return out.filter((v,i)=>v.p.distance(out[(i+out.length-1)%out.length].p)>1e-10);};
 const emitContour=(sourceTriangle:number,p:CV[],b:Batch,material:'meadow'|'fern')=>{if(p.length<3)return;const indexStart=b.indices.length,cache=caches.get(b)!,index=(v:CV)=>{let i=cache.get(v.key);if(i===undefined){i=b.positions.length/3;b.vertex(v.p,[v.p.x*.11,v.p.z*.11]);cache.set(v.key,i);}return i;};for(let k=1;k<p.length-1;k++)if(footprintArea([p[0].p,p[k].p,p[k+1].p])>1e-9)b.indices.push(index(p[0]),index(p[k]),index(p[k+1]));if(b.indices.length>indexStart)terrainPartitions.push({sourceTriangle,material,batch:b.name,indexStart,indexEnd:b.indices.length});};
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const i=z*(nx+1)+x;for(const ids of [[i,i+nx+1,i+1],[i+1,i+nx+1,i+nx+2]]){const source=terrainTriangles.length;terrainTriangles.push(ids.map(i=>tuple(tv(i))));emitContour(source,contour(ids,true),meadow,'meadow');emitContour(source,contour(ids,false),fern,'fern');}}
 bound('connected-contour-meadow-heightfield',meadow,0,'terrain',false,0);bound('connected-contour-fern-heightfield',fern,0,'terrain',false,0);
 const terrainGrid:CameraHeightfield={minX,minZ,dx,dz,columns:nx+1,rows:nz+1,heights};cameraObstacles.push({kind:'garden-actual-connected-heightfield',min:[minX,Math.min(...heights),minZ],max:[maxX,Math.max(...heights),maxZ],heightfield:terrainGrid});
 const groundY=(x:number,z:number)=>cameraTerrainHeight(terrainGrid,x,z)??terrainY(x,z);
 const terrainExtrema=(polygon:pc.Vec3[])=>{const x0=clamp(Math.floor((Math.min(...polygon.map(p=>p.x))-minX)/dx),0,nx-1),x1=clamp(Math.floor((Math.max(...polygon.map(p=>p.x))-minX)/dx),0,nx-1),z0=clamp(Math.floor((Math.min(...polygon.map(p=>p.z))-minZ)/dz),0,nz-1),z1=clamp(Math.floor((Math.max(...polygon.map(p=>p.z))-minZ)/dz),0,nz-1);let low=Infinity,high=-Infinity;for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const i=z*(nx+1)+x;for(const ids of [[i,i+nx+1,i+1],[i+1,i+nx+1,i+nx+2]])for(const p of intersectRoadFootprint(ids.map(tv),polygon)){low=Math.min(low,p.y);high=Math.max(high,p.y);}}return{low,high};};
 const foundation=(kind:string,footprint:pc.Vec3[],rise=.16)=>{const ext=terrainExtrema(footprint),bottom=ext.low-.25,top=ext.high+rise,c=solid(kind+'-whole-footprint-foundation',foundationStone,footprint,bottom,top,'support');foundations.push({kind,top,bottom,footprint:footprint.map(tuple),terrainLow:ext.low,terrainHigh:ext.high,component:components.indexOf(c)});return{component:c,top,bottom,ext};};
 const grounded=(kind:string,p:pc.Vec3,w:number,d:number,top:number,b:Batch=foundationStone,yaw=0,role:Role='detail')=>{const footprint=rect(p,w,d,yaw),bottom=terrainExtrema(footprint).low-.12,c=solid(kind,b,footprint,bottom,top,role);groundedDetails.push({kind,x:p.x,z:p.z,bottom,terrainY:groundY(p.x,p.z),footprint:footprint.map(tuple),component:components.indexOf(c)});return c;};
 // Full physical road/shoulder union, including all endpoint ownership.
 const priority=new Map([[course.commonStart,0],[course.commonFinish,1],[course.alternates.boulevard,2],[course.alternates.alley,3]]),ownership=new Map<string,boolean>();
 const samePlane=(a:RoadFootprint,b:RoadFootprint)=>{if(a.maxY<b.minY-.005||b.maxY<a.minY-.005)return false;const p=clean(intersectRoadFootprint(a.points,b.points));return p.length>=3&&footprintArea(p)>1e-8&&p.every(p=>Math.abs(yAt(a.points,p.x,p.z)-yAt(b.points,p.x,p.z))<.005);};
 for(const f of sourceFaces){let fragments=[f.points];for(const owner of roadIndex.query(f.minX,f.maxX,f.minZ,f.maxZ)){if(priority.get(owner.edge)!>=priority.get(f.edge)!||!samePlane(f,owner))continue;fragments=fragments.flatMap(p=>cut(p,owner.points));if(!fragments.length)break;}const key=f.edge.id+':'+f.distance;ownership.set(key,(ownership.get(key)??false)||fragments.length>0);for(const poly of fragments)for(let i=1;i<poly.length-1;i++){const p=[poly[0],poly[i],poly[i+1]];if(footprintArea(p)<1e-8)continue;road.tri(...p as [pc.Vec3,pc.Vec3,pc.Vec3]);roadFaces.push({edgeId:f.edge.id,distance:f.distance,points:p.map(tuple)});const under=[p[2],p[1],p[0]].map(q=>q.clone().add(vec(0,-.22,0)));shoulder.tri(...under as [pc.Vec3,pc.Vec3,pc.Vec3]);roadUndersideFaces.push({edgeId:f.edge.id,distance:f.distance,points:under.map(tuple)});}}
 bound('road-exact-full-width-spatial-union',road,0,'road',false,0);bound('ground-road-thick-underfaces',shoulder,0,'support',false,0);
 const shoulderStart=shoulder.positions.length/3,shoulderIndexStart=shoulder.indices.length,metrics=new WeakMap<RoadFootprint,{a:pc.Vec3;b:pc.Vec3;sign:number;length:number}>();
 const shoulderDistance=(f:RoadFootprint,p:pc.Vec3)=>{const q=metrics.get(f)!;return((q.b.x-q.a.x)*(p.z-q.a.z)-(q.b.z-q.a.z)*(p.x-q.a.x))*q.sign/q.length;};
 const shoulderOuterY=(e:SceneryRoadEdge,s:number,p:pc.Vec3)=>groundY(p.x,p.z)-.03;
 const rawShoulders=edges.flatMap(edge=>{const out:RoadFootprint[]=[],n=Math.ceil(edge.length/1.65),stations=Array.from({length:n+1},(_,i)=>i/n*edge.length);stations.sort((a,b)=>a-b);for(let i=0;i<stations.length-1;i++){const s=stations[i],t=stations[i+1];if(t-s<1e-8)continue;const extra=7;for(const side of [-1,1]){const a=point(edge,s,side*edge.halfWidthAt(s)),b=point(edge,t,side*edge.halfWidthAt(t)),c=point(edge,s,side*(edge.halfWidthAt(s)+extra)),d=point(edge,t,side*(edge.halfWidthAt(t)+extra));c.y=shoulderOuterY(edge,s,c);d.y=shoulderOuterY(edge,t,d);for(const p of [[a,c,b],[b,c,d]]){const f=roadFootprint(edge,s,p);metrics.set(f,{a,b,sign:Math.sign((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x)),length:Math.hypot(b.x-a.x,b.z-a.z)});out.push(f);}}}return out;}),shoulderIndex=new RoadFootprintIndex(rawShoulders),shoulderOrder=new Map(rawShoulders.map((f,i)=>[f,i]));
 const sameLayer=(a:RoadFootprint,b:RoadFootprint)=>Math.abs(a.edge.sample(a.distance).p.y-b.edge.sample(b.distance).p.y)<5;
 for(const f of rawShoulders){let fragments=[f.points];for(const owner of roadIndex.query(f.minX,f.maxX,f.minZ,f.maxZ)){if(!sameLayer(f,owner)||footprintArea(intersectRoadFootprint(f.points,owner.points))<1e-8)continue;fragments=fragments.flatMap(p=>cut(p,owner.points));if(!fragments.length)break;}for(const owner of shoulderIndex.query(f.minX,f.maxX,f.minZ,f.maxZ)){if(owner.edge===f.edge||!sameLayer(f,owner))continue;const overlap=clean(intersectRoadFootprint(f.points,owner.points));if(overlap.length<3||footprintArea(overlap)<1e-8)continue;const cutter:pc.Vec3[]=[],delta=(p:pc.Vec3)=>shoulderDistance(f,p)-shoulderDistance(owner,p)+(shoulderOrder.get(owner)!<shoulderOrder.get(f)!?1e-10:-1e-10);for(let i=0;i<overlap.length;i++){const p=overlap[i],q=overlap[(i+1)%overlap.length],a=delta(p),b=delta(q);if(a>=0)cutter.push(p);if((a>=0)!==(b>=0))cutter.push(p.clone().lerp(p,q,a/(a-b)));}if(cutter.length<3||footprintArea(cutter)<1e-8)continue;fragments=fragments.flatMap(p=>cut(p,cutter));if(!fragments.length)break;}for(const poly of fragments)for(let i=1;i<poly.length-1;i++){const p=[poly[0],poly[i],poly[i+1]];if(footprintArea(p)<1e-8)continue;if(new pc.Vec3().cross(p[1].clone().sub(p[0]),p[2].clone().sub(p[0])).y<0)[p[1],p[2]]=[p[2],p[1]];shoulder.tri(...p as [pc.Vec3,pc.Vec3,pc.Vec3]);shoulderFaces.push({edgeId:f.edge.id,distance:f.distance,points:p.map(tuple)});}}
 bound('source-exact-layer-owned-shoulders',shoulder,shoulderStart,'support',false,shoulderIndexStart);
 // Tiny modeled inward face relief removes coflush construction skins while
 // retaining every original member corner, span, support and external envelope.
 // All six opaque portals reproduce the named planned member cross sections.
 // Only the bottoms of their twelve posts adapt to actual complete terrain feet.
 const plan=gardenArborPlan(),footByPost=new Map<string,{component:GardenComponent;top:number}>();
 for(const p of plan.supports){const f=foundation('arbor-'+p.id,[...p.footprint],.28);footByPost.set(p.id.replace('-footing','-post'),f);arbor.supports.push({id:p.id,s:p.s,side:p.side,footprint:p.footprint.map(tuple),bottom:f.bottom,top:f.top,terrainLow:f.ext.low,terrainHigh:f.ext.high,component:components.indexOf(f.component)});for(const t of facesFor(f.component))arbor.faces.push({kind:'footing',points:t});}
 const nodeMembers=new Map<string,GardenComponent[]>();
 for(const m of plan.members){const a=m.a.clone(),foot=footByPost.get(m.id);if(foot)a.y=foot.top;const c=beam('arbor-'+m.id,m.kind==='web'||m.kind==='roof-lattice'?darkTimber:timber,a,m.b,m.halfWidth*2,m.halfWidth*2,'structure',m.endExtension,m.kind==='tie'||m.kind==='rafter'?'cheeks':m.kind==='purlin'?'all':undefined);arbor.members.push({id:m.id,kind:m.kind,component:components.indexOf(c),aNode:m.aNode,bNode:m.bNode});for(const t of facesFor(c))arbor.faces.push({kind:m.kind,points:t});if(foot)contact('arbor-post-complete-plinth-bearing',c,foot.component);for(const node of [m.aNode,m.bNode]){const members=nodeMembers.get(node)??[];for(const other of members)contact('arbor-shared-node-'+node,c,other);members.push(c);nodeMembers.set(node,members);}}
 // Closed indexed lofts have real downward caps. Curved stems are swept from
 // one continuous centerline; every leaflet and midrib is a bearing attachment.
 const loft=(kind:string,b:Batch,rings:{p:pc.Vec3;rx:number;rz:number}[],sides=32,role:Role='structure')=>{const start=b.positions.length/3;for(const ring of rings)for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2;b.vertex(ring.p.clone().add(vec(Math.cos(a)*ring.rx,0,Math.sin(a)*ring.rz)));}for(let k=0;k<rings.length-1;k++)for(let i=0;i<sides;i++){const a=start+k*sides+i,c=start+k*sides+(i+1)%sides;b.indices.push(a,a+sides,c,c,a+sides,c+sides);}for(const k of [0,rings.length-1]){const center=b.positions.length/3;b.vertex(rings[k].p);for(let i=0;i<sides;i++){const a=start+k*sides+i,c=start+k*sides+(i+1)%sides;b.indices.push(center,...(k===0?[a,c]:[c,a]));}}return bound(kind,b,start,role)!;};
 const tube=(kind:string,b:Batch,points:pc.Vec3[],radii:number[],sides=12,role:Role='structure')=>{const start=b.positions.length/3;for(let i=0;i<points.length;i++){const d=points[Math.min(points.length-1,i+1)].clone().sub(points[Math.max(0,i-1)]).normalize(),ref=Math.abs(d.y)>.94?vec(1,0,0):vec(0,1,0),u=new pc.Vec3().cross(d,ref).normalize(),v=new pc.Vec3().cross(d,u).normalize();for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2;b.vertex(points[i].clone().add(u.clone().mulScalar(Math.cos(a)*radii[i])).add(v.clone().mulScalar(Math.sin(a)*radii[i])));}}for(let k=0;k<points.length-1;k++)for(let i=0;i<sides;i++){const a=start+k*sides+i,c=start+k*sides+(i+1)%sides;b.indices.push(a,c,a+sides,c,c+sides,a+sides);}for(const k of [0,points.length-1]){const center=b.positions.length/3;b.vertex(points[k]);for(let i=0;i<sides;i++){const a=start+k*sides+i,c=start+k*sides+(i+1)%sides;b.indices.push(center,...(k===0?[c,a]:[a,c]));}}return bound(kind,b,start,role)!;};
 const annulus=(kind:string,b:Batch,at:(x:number,y:number,z:number)=>pc.Vec3,rx:number,rz:number,inner:number,bottom:number,top:number,a0=0,a1=Math.PI*2,n=64)=>{const full=Math.abs(a1-a0-Math.PI*2)<1e-9,count=full?n:n+1,start=b.positions.length/3;for(let i=0;i<count;i++){const a=a0+(a1-a0)*i/n;for(const [scale,y]of [[1,bottom],[inner,bottom],[1,top],[inner,top]])b.vertex(at(Math.cos(a)*rx*scale,y,Math.sin(a)*rz*scale));}for(let i=0;i<n;i++){const a=start+i*4,c=start+((i+1)%count)*4;for(const t of [[a,c,a+2],[a+2,c,c+2],[a+1,a+3,c+1],[a+3,c+3,c+1],[a+2,c+2,a+3],[a+3,c+2,c+3],[a,a+1,c],[a+1,c+1,c]])b.indices.push(...t);}if(!full)for(const k of [0,count-1]){const i=start+k*4;b.indices.push(...(k===0?[i,i+2,i+1,i+1,i+2,i+3]:[i,i+1,i+2,i+1,i+3,i+2]));}return bound(kind,b,start)!;};
 const oval=(p:pc.Vec3,rx:number,rz:number,yaw=0,n=64)=>{const at=local(p,yaw);return Array.from({length:n},(_,i)=>at(Math.cos(i/n*Math.PI*2)*rx,0,Math.sin(i/n*Math.PI*2)*rz));};
 const planter=(kind:string,x:number,z:number,rx:number,rz:number,yaw=0)=>{const p=vec(x,0,z),f=foundation(kind,oval(p,rx,rz,yaw),.18),base=vec(x,f.top,z),at=local(base,yaw),rim=annulus(kind+'-continuous-stone-rim',planterStone,at,rx,rz,1-.9/Math.min(rx,rz),0,.76),bed=solid(kind+'-continuous-planted-soil',soil,oval(base,rx-.72,rz-.72,yaw),f.top-.05,f.top+.58);contact('planter-rim-full-pad-bearing',rim,f.component);contact('planter-soil-full-pad-bearing',bed,f.component);landforms.push({kind,footprint:oval(p,rx,rz,yaw).map(tuple),bottom:f.bottom,top:f.top+.76});return{base:vec(x,f.top+.58,z),at:local(vec(x,f.top+.58,z),yaw),bed,rim,pad:f.component};};
 const profile=(t:number,keys:readonly number[],values:readonly number[])=>{let i=1;while(i<keys.length-1&&t>keys[i])i++;const u=(t-keys[i-1])/(keys[i]-keys[i-1]);return values[i-1]+(values[i]-values[i-1])*u;};
 // A blade is a closed thick shell partitioned into upper/lower/perimeter
 // materials, without coincident skins. Its full surface assembly is closed.
 const blade=(kind:string,root:pc.Vec3,length:number,widthScale:number,yaw:number,rise:number,twist:number,upper:Batch,petal=false,sections=24,across=8)=>{
  const first=components.length,id=kind+'-'+assemblies.length;assembly=id;const keys=petal?[0,.12,.30,.55,.77,.92,1]:[0,.08,.22,.42,.63,.82,.94,1],widths=petal?[.08,.19,.36,.43,.38,.20,.015]:[.015,.12,.30,.43,.38,.24,.10,.001],curves=petal?[0,-.015,.035,.14,.26,.32,.34]:[0,.035,.10,.16,.19,.16,.09,.035],folds=[0,.01,.025,.075,.09,.07,.025,0],thick=petal?.18:.12,at=local(root,yaw),upperPoints:pc.Vec3[][]=[],lowerPoints:pc.Vec3[][]=[];
  const center=(t:number)=>{const h=profile(t,keys,curves)*length;return at(0,t*length*Math.sin(rise)+h*Math.cos(rise),t*length*Math.cos(rise)-h*Math.sin(rise));};
  for(let i=0;i<=sections;i++){const t=i/sections,hw=profile(t,keys,widths)*length*widthScale,h=profile(t,keys,curves)*length,fold=petal?.055*Math.sin(t*Math.PI)*length:profile(t,keys,folds)*length,up:pc.Vec3[]=[],down:pc.Vec3[]=[];for(let j=0;j<=across;j++){const u=j/across*2-1,x=u*hw,angle=twist*t,yy=h-fold*Math.pow(Math.abs(u),1.4)+x*Math.sin(angle),xx=x*Math.cos(angle),z=t*length;up.push(at(xx,z*Math.sin(rise)+(yy+thick/2)*Math.cos(rise),z*Math.cos(rise)-(yy+thick/2)*Math.sin(rise)));down.push(at(xx,z*Math.sin(rise)+(yy-thick/2)*Math.cos(rise),z*Math.cos(rise)-(yy-thick/2)*Math.sin(rise)));}upperPoints.push(up);lowerPoints.push(down);}
  for(const [grid,b,flip,faceKind]of [[upperPoints,upper,false,'upper'],[lowerPoints,petal?upper:underside,true,'lower']]as const){const start=b.positions.length/3;for(const row of grid)for(const p of row)b.vertex(p);for(let i=0;i<sections;i++)for(let j=0;j<across;j++){const a=start+i*(across+1)+j,c=a+across+1;const triangles=[[a,c,a+1],[a+1,c,c+1]];for(const t of triangles)b.indices.push(...(flip?[t[0],t[2],t[1]]:t));}bound(kind+'-joined-'+faceKind+'-surface',b,start,'structure',false);}
  const edgeBatch=petal?upper:stem,start=edgeBatch.positions.length/3,topBoundary:pc.Vec3[]=[],bottomBoundary:pc.Vec3[]=[];
  for(let j=0;j<=across;j++){topBoundary.push(upperPoints[0][j]);bottomBoundary.push(lowerPoints[0][j]);}for(let i=1;i<=sections;i++){topBoundary.push(upperPoints[i][across]);bottomBoundary.push(lowerPoints[i][across]);}for(let j=across-1;j>=0;j--){topBoundary.push(upperPoints[sections][j]);bottomBoundary.push(lowerPoints[sections][j]);}for(let i=sections-1;i>0;i--){topBoundary.push(upperPoints[i][0]);bottomBoundary.push(lowerPoints[i][0]);}
  for(let i=0;i<topBoundary.length;i++){const j=(i+1)%topBoundary.length;edgeBatch.tri(topBoundary[i],topBoundary[j],bottomBoundary[i]);edgeBatch.tri(topBoundary[j],bottomBoundary[j],bottomBoundary[i]);}bound(kind+'-closed-thick-perimeter',edgeBatch,start,'structure',false);
  assemblies.push({id,components:Array.from({length:components.length-first},(_,i)=>first+i),closed:true});assembly=undefined;
  return{surface:components[first],parts:components.slice(first),center,tip:center(1)};
 };
 const record=(p:typeof plots[number],base:pc.Vec3,label:string)=>{landmarks.push({kind:p.id,label,position:tuple(base),radius:p.radius,height:p.height});props.push({kind:p.id,x:base.x,y:base.y,z:base.z,radius:p.radius});};
 const label=(name:string,at:(x:number,y:number,z:number)=>pc.Vec3,x:number,z:number,yaw:number,bed:GardenComponent)=>{const stakes:GardenComponent[]=[];for(const offset of [-.54,.54]){const c=box(name+'-soil-seated-label-stake',labelWood,at(x+offset,.61,z),vec(.14,1.42,.18),yaw,'detail');contact('label-stake-soil-bearing',c,bed);stakes.push(c);}const board=box(name+'-attached-label-board',labelWood,at(x,1.25,z-.08),vec(1.5,.48,.18),yaw,'detail');for(const stake of stakes)contact('label-board-stake-bearing',board,stake);for(const side of [-1,1]){const brace=beam(name+'-bearing-label-brace',bronze,at(x+side*.54,.72,z-.02),at(x+side*.32,1.16,z-.14),.07,.07,'detail');contact('label-brace-board-bearing',brace,board);contact('label-brace-stake-bearing',brace,stakes[side<0?0:1]);}for(let i=0;i<3;i++){const glyph=box(name+'-original-specimen-glyph',inlay,at(x-.35+i*.31,1.25,z-.185),vec(.16,.035+.06*i,.04),yaw,'detail');contact('specimen-glyph-board-bearing',glyph,board);}return board;};
 // FOLDLEAF FAN: three unequal thick, folded leaves and raised midribs grow
 // from curved petioles into one visible, planted radial crown.
 {
  const p=plots[0];landmark=p.id;const court=planter(p.id,p.x,p.z,12,9,.22),{base,at}=court,crown=loft('foldleaf-root-crown',stem,[{p:at(0,-.15,0),rx:2.7,rz:2.25},{p:at(0,.8,0),rx:1.5,rz:1.4},{p:at(0,1.25,0),rx:.8,rz:.8}],40);contact('foldleaf-crown-planted-soil-bearing',crown,court.bed);
  for(const [index,length,width,yaw,rise,twist]of [[0,15,.88,-34,42,9],[1,18,.74,15,57,-13],[2,13,1.02,62,36,17]]){const angle=yaw*Math.PI/180,root=at(Math.sin(angle)*.65,.45,Math.cos(angle)*.65),path=Array.from({length:13},(_,i)=>{const t=i/12;return root.clone().add(vec(Math.sin(angle)*1.8*t*t,4.75*t,Math.cos(angle)*1.8*t*t));}),petiole=tube('foldleaf-'+index+'-continuous-curved-petiole',stem,path,path.map((_,i)=>.48-.20*i/12),12);contact('foldleaf-petiole-crown-bearing',petiole,crown);const leafShape=blade('foldleaf-'+index,path[path.length-1],length,width,angle,rise*Math.PI/180,twist*Math.PI/180,index===1?newLeaf:leaf,false,24,8);contact('foldleaf-blade-petiole-bearing',leafShape.surface,petiole);const midrib=tube('foldleaf-'+index+'-continuous-raised-midrib',stem,Array.from({length:33},(_,i)=>leafShape.center(i/32)),Array.from({length:33},(_,i)=>.23-.19*i/32),10);contact('foldleaf-midrib-petiole-bearing',midrib,petiole);contact('foldleaf-midrib-blade-bearing',midrib,leafShape.surface);}
  label('Foldleaf-No3',at,-5,-4,.22,court.bed);record(p,base,'Foldleaf Fan: three joined unequal folded leaves and raised midribs');
 }
 // RADIAL PETAL COURT: seven thick ruled petals bear on a real open collar.
 // A grounded central stalk and branching arms carry its annular receptacle.
 {
  const p=plots[1];landmark=p.id;const court=planter(p.id,p.x,p.z,17,15,-.18),{base,at}=court,stalk=loft('petal-court-grounded-stalk',stem,[{p:at(0,-.2,0),rx:1.1,rz:1.1},{p:at(.25,3.5,0),rx:.82,rz:.82},{p:at(0,7.45,0),rx:.65,rz:.65}],32);contact('petal-court-stalk-soil-bearing',stalk,court.bed);
  const collar=annulus('petal-court-open-central-collar',seedFlesh,at,3.4,3.4,.55,7.1,8.1);const angles=[0,49,99,154,210,264,316],lengths=[10.5,11.4,10.8,12,11.1,10.3,11.7];
  for(let i=0;i<7;i++){const yaw=angles[i]*Math.PI/180,a=at(0,5.8,0),b=at(Math.sin(yaw)*2.9,7.55,Math.cos(yaw)*2.9),arm=tube('petal-court-radial-calyx-arm-'+i,stem,[a,a.clone().lerp(a,b,.5),b],[.31,.27,.22],10);contact('petal-court-arm-stalk-bearing',arm,stalk);contact('petal-court-collar-arm-bearing',collar,arm);const flower=blade('petal-court-petal-'+i,at(Math.sin(yaw)*2.8,7.72,Math.cos(yaw)*2.8),lengths[i],.9,yaw,0,.06*Math.sin(i),i%3===1?blush:ivory,true,18,6);contact('petal-court-each-petal-collar-bearing',flower.surface,collar);const vein=tube('petal-court-petal-'+i+'-joined-center-vein',amber,Array.from({length:10},(_,j)=>flower.center(j/9*.88)),Array.from({length:10},(_,j)=>.10-.065*j/9),6);contact('petal-court-vein-petal-bearing',vein,flower.surface);}
  // Offset closed seedpod with modeled ribs, attached to its own thick stalk.
  const seedBase=at(-9,0,-6),seedStalk=loft('petal-court-offset-seed-stalk',stem,[{p:seedBase.clone().add(vec(0,-.18,0)),rx:.75,rz:.75},{p:seedBase.clone().add(vec(0,9,0)),rx:.5,rz:.5}],24),pod=loft('petal-court-offset-sculpted-seedpod',amber,[{p:seedBase.clone().add(vec(0,8.8,0)),rx:.6,rz:.6},{p:seedBase.clone().add(vec(0,10,0)),rx:1.65,rz:1.65},{p:seedBase.clone().add(vec(0,12.1,0)),rx:1.4,rz:1.4},{p:seedBase.clone().add(vec(0,13,0)),rx:.3,rz:.3}],40);contact('offset-seed-stalk-soil-bearing',seedStalk,court.bed);contact('offset-seedpod-stalk-bearing',pod,seedStalk);
  for(let j=0;j<8;j++){const a=j*Math.PI/4,points=Array.from({length:13},(_,i)=>{const t=i/12,r=.56+1.10*Math.sin(t*Math.PI);return seedBase.clone().add(vec(Math.cos(a)*r,8.94+3.97*t,Math.sin(a)*r));}),rib=tube('offset-seedpod-attached-longitudinal-rib',seedShell,points,points.map(()=>.10),8);contact('offset-seedpod-rib-shell-bearing',rib,pod);}
  label('Sevenfold-Bloom',at,8,-9,-.18,court.bed);record(p,base,'Radial Petal Court: seven joined opaque petals around a literal open collar');
 }
 // TERRACE SEED LIBRARY: two low crescent beds and open bearing benches,
 // with an original upright thick almond section and attached relief embryo.
 {
  const p=plots[2];landmark=p.id;const f=foundation(p.id,rect(vec(p.x,0,p.z),27,20,.28),.16),base=vec(p.x,f.top,p.z),at=local(base,.28);
  const beds:GardenComponent[]=[];
  for(const [i,rx,rz,inner,centerZ,a0,a1]of [[0,12.3,7.5,.76,1,.05,Math.PI-.05],[1,8.8,5.8,.69,-1,Math.PI+.12,Math.PI*2-.12]]){const aa=local(at(0,0,centerZ),.28),rim=annulus('seed-library-crescent-stone-bed-'+i,planterStone,aa,rx,rz,inner,0,.94,a0,a1,42),bed=annulus('seed-library-crescent-soil-'+i,soil,aa,rx-.18,rz-.18,(inner+.035),.84,.99,a0+.025,a1-.025,42);contact('seed-library-crescent-pad-bearing',rim,f.component);contact('seed-library-soil-stone-bearing',bed,rim);beds.push(bed);}
  for(let i=0;i<3;i++){const x=-8+i*8,z=1.4,legs:GardenComponent[]=[];for(const side of [-1,1]){const leg=box('seed-library-bench-grounded-leg',labelWood,at(x+side*1.3,.55,z),vec(.55,1.1,2.5),.28);contact('seed-library-leg-pad-bearing',leg,f.component);legs.push(leg);}const bench=box('seed-library-bearing-bench',labelWood,at(x,1.24,z),vec(3.7,.30,2.7),.28);for(const leg of legs)contact('seed-library-bench-leg-bearing',bench,leg);const tray=box('seed-library-seated-specimen-tray',planterStone,at(x,1.59,z),vec(3.3,.42,2.25),.28);contact('seed-library-tray-bench-bearing',tray,bench);for(let j=0;j<3;j++){const bulb=loft('seed-library-grounded-specimen-seed',j%2?seedFlesh:seedShell,[{p:at(x-.95+j*.95,1.76,z),rx:.27,rz:.24},{p:at(x-.91+j*.95,2.12+j*.09,z),rx:.40,rz:.34},{p:at(x-.95+j*.95,2.48+j*.12,z),rx:.10,rz:.12}],20);contact('seed-library-specimen-tray-bearing',bulb,tray);}}
  const seat=box('seed-section-display-grounded-seat',planterStone,at(0,.32,-5.2),vec(4.8,.64,2.2),.28);contact('seed-section-seat-pad-bearing',seat,f.component);
  const root=at(0,.5,-5.2),shell=blade('seed-section-thick-original-almond',root,7.6,.83,.28,Math.PI/2,0,seedShell,true,26,10);contact('seed-section-shell-seat-bearing',shell.surface,seat);
  const heart=blade('seed-section-attached-heartwood',at(0,1.15,-5.38),5.7,.68,.28,Math.PI/2,0,seedFlesh,true,22,8);contact('seed-section-heartwood-shell-bearing',heart.surface,shell.surface);
  const embryo=tube('seed-section-modeled-embryo-relief',amber,[at(-.8,3,-5.9),at(-.65,3.6,-6.10),at(.1,4.05,-6.20),at(.72,4.7,-6.35)],[.28,.29,.24,.12],12);contact('seed-section-embryo-heart-bearing',embryo,heart.surface);
  for(const side of [-1,1]){const brace=beam('seed-section-visible-bearing-brace',darkTimber,at(side*1.8,.55,-5.2),at(side*.6,1.7,-5.2),.22,.30);contact('seed-section-brace-seat-bearing',brace,seat);contact('seed-section-brace-shell-bearing',brace,shell.surface);}
  // Labels root into broad soil arcs; their bearings are actual source solids.
  for(const [x,z]of [[-6,6.1],[6,6.1]]){const raised=local(at(0,.92,0),.28);label('Amber-Seed-Study',raised,x,z,.28,beds[0]);}
  record(p,base,'Terrace Seed Library: crescent soil beds, bearing specimen benches and thick seed section');
 }
 // SPIRAL FROND COURT: curved rachises and every paired leaflet are connected.
 {
  const p=plots[3];landmark=p.id;const court=planter(p.id,p.x,p.z,12,8.5,-.4),{base,at}=court,crown=loft('frond-grounded-radial-root-crown',stem,[{p:at(0,-.18,0),rx:3.6,rz:2.6},{p:at(0,.65,0),rx:2.9,rz:2.1},{p:at(0,1,0),rx:1.1,rz:1.1}],40);contact('frond-root-crown-soil-bearing',crown,court.bed);
  const keys=[[0,0],[.03,.28],[.12,.61],[.28,.82],[.46,.85],[.58,.72],[.55,.55],[.40,.48],[.30,.58]];
  for(let k=0;k<3;k++){const yaw=-.95+k*.83,origin=at((k-1)*2.0,.45,(k%2)*.8),frame=local(origin,yaw),path=Array.from({length:49},(_,i)=>{const u=i/48*(keys.length-1),j=Math.min(keys.length-2,Math.floor(u)),t=u-j,a=keys[j],b=keys[j+1];return frame((a[0]+(b[0]-a[0])*t)*11,(a[1]+(b[1]-a[1])*t)*11,0);}),rachis=tube('frond-'+k+'-continuous-curled-rachis',stem,path,path.map((_,i)=>.42-.33*i/48),10);contact('frond-rachis-root-bearing',rachis,crown);
   for(let pair=0;pair<9;pair++){const index=4+pair*4,pivot=path[index],length=1.2+2.9*Math.sin((pair+1)/11*Math.PI);for(const side of [-1,1]){const leafShape=blade('frond-'+k+'-joined-leaflet-'+pair+'-'+side,pivot,length,.42,yaw+side*Math.PI/2,.19+(pair/8)*.12,side*.11,pair%3===0?newLeaf:leaf,false,6,2);contact('frond-leaflet-rachis-bearing',leafShape.surface,rachis);}}
  }
  label('Curled-Frond',at,-5,-3.8,-.4,court.bed);record(p,base,'Spiral Frond Court: three continuous curled rachises with joined leaflet pairs');
 }
 // CROWN BLOOM: two asymmetrical whorls bear on one thick receptacle/calyx.
 {
  const p=plots[4];landmark=p.id;const court=planter(p.id,p.x,p.z,17,14,.12),{base,at}=court,crown=loft('crown-bloom-buttressed-root-seat',stem,[{p:at(0,-.2,0),rx:3.7,rz:3.3},{p:at(0,1.2,0),rx:2,rz:1.8},{p:at(0,2.6,0),rx:1.1,rz:1.05}],48),stalk=loft('crown-bloom-continuous-thick-stalk',stem,[{p:at(0,1.8,0),rx:1.20,rz:1.15},{p:at(.45,6.5,0),rx:.88,rz:.86},{p:at(0,10.7,0),rx:1.18,rz:1.18}],40);contact('crown-root-planted-soil-bearing',crown,court.bed);contact('crown-stalk-root-bearing',stalk,crown);
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2,brace=tube('crown-root-real-buttress-'+i,stem,[at(Math.sin(a)*3.25,-.04,Math.cos(a)*3.0),at(Math.sin(a)*1.45,1.8,Math.cos(a)*1.45),at(Math.sin(a)*.8,3,Math.cos(a)*.8)],[.55,.49,.31],12);contact('crown-buttress-soil-bearing',brace,court.bed);contact('crown-buttress-root-bearing',brace,crown);contact('crown-buttress-stalk-bearing',brace,stalk);}
  const calyx=loft('crown-bloom-bearing-calyx',leaf,[{p:at(0,9.9,0),rx:1.16,rz:1.16},{p:at(0,11.65,0),rx:3.3,rz:3.3},{p:at(0,12.0,0),rx:3.34,rz:3.34}],48),receptacle=loft('crown-bloom-two-whorl-receptacle',amber,[{p:at(0,11.7,0),rx:3.30,rz:3.30},{p:at(0,12.6,0),rx:3.13,rz:3.13},{p:at(0,14.25,0),rx:2.6,rz:2.6},{p:at(0,15.25,0),rx:.9,rz:.9}],48);contact('crown-calyx-stalk-bearing',calyx,stalk);contact('crown-receptacle-calyx-bearing',receptacle,calyx);
  for(const [whorl,radius,height,count,offset,length]of [[0,2.8,12.2,7,8,11.5],[1,2.1,14,5,31,8.6]])for(let i=0;i<count;i++){const a=(offset+i*360/count)*Math.PI/180,l=length*(1+.035*Math.sin(i*1.9)),petal=blade('crown-whorl-'+whorl+'-petal-'+i,at(Math.sin(a)*radius,height,Math.cos(a)*radius),l,.96,a,0,.045*Math.cos(i),whorl===0?(i%3?blush:ivory):ivory,true,18,6);contact('crown-every-petal-receptacle-bearing',petal.surface,receptacle);const vein=tube('crown-whorl-'+whorl+'-petal-'+i+'-attached-vein',amber,Array.from({length:10},(_,j)=>petal.center(j/9*.91)),Array.from({length:10},(_,j)=>.09-.06*j/9),6);contact('crown-petal-vein-bearing',vein,petal.surface);}
  label('Crown-Petal',at,-7,-7,.12,court.bed);record(p,base,'Crown Bloom Terrace: two asymmetric petal whorls on a joined receptacle, calyx and stalk');
 }
 landmark=undefined;assembly=undefined;
 // Native assembled racers keep their full authored sizes. Every physical rail
 // is carried at least 3.25m beyond the road edge, never at the lane inset.
 for(const edge of edges){const n=Math.ceil(edge.length/1.65);for(let i=0;i<n;i++){const s=i/n*edge.length,t=(i+1)/n*edge.length,w=edge.halfWidthAt(s),wt=edge.halfWidthAt(t),sample={edgeId:edge.id,distance:s,left:tuple(point(edge,s,-w)),right:tuple(point(edge,s,w)),rendered:ownership.get(edge.id+':'+s)??false};roadSamples.push(sample);routeRoadSamples.push(sample);
  for(const side of [-1,1]){const p=point(edge,s,side*w),q=point(edge,t,side*wt),mid=p.clone().lerp(p,q,.5),other=(f:RoadFootprint)=>f.edge!==edge;if(!roadIndex.clearAt(mid.x,mid.z,p.distance(q)/2+.025,other))continue;
   if(i%4===0){const out=point(edge,s,side*(w+.27),.027),next=point(edge,t,side*(wt+.27),.027),start=planterStone.positions.length/3;if(side>0)planterStone.quad(p.clone().add(vec(0,.027,0)),out,q.clone().add(vec(0,.027,0)),next);else planterStone.quad(out,p.clone().add(vec(0,.027,0)),next,q.clone().add(vec(0,.027,0)));bound('road-exposed-upward-coping',planterStone,start,'visual-coping',false);}
   if(i%42===0){const end=Math.min(edge.length,s+10),u=point(edge,s,side*(w+4.05),.92),v=point(edge,end,side*(edge.halfWidthAt(end)+4.05),.92),middle=u.clone().lerp(u,v,.5);if(roadIndex.clearAt(middle.x,middle.z,u.distance(v)/2+3.35,other)){const b=beam('garden-outboard-grounded-low-timber-rail',timber,u,v,.28,.30,'rail');railMembers.push({edgeId:edge.id,distance:s,side,points:facesFor(b).flat()});for(const p of [u,v]){const post=grounded('garden-whole-footprint-rail-post',p,.40,.40,p.y+.12,darkTimber,0,'rail');contact('garden-rail-post-beam-bearing',post,b);}}}
  }
 }}
 for(let row=0;row<2;row++)for(let col=0;col<16;col++)if((row+col)%2===0){const e=course.commonStart,s=row*.75,t=(row+1)*.75,w=e.halfWidthAt(s),start=inlay.positions.length/3;inlay.quad(point(e,s,-w+col*w/8,.033),point(e,s,-w+(col+1)*w/8,.033),point(e,t,-w+col*w/8,.033),point(e,t,-w+(col+1)*w/8,.033));bound('start-line-original-garden-stone-inlay',inlay,start,'visual-coping',false);}
 // Tall route tablets sit outside the complete orbit, ahead of the choice zone.
 for(const side of [-1,1]){const e=course.commonStart,s=e.length-118,p=point(e,s,side*(e.halfWidthAt(s)+24)),top=terrainExtrema(rect(p,5.8,1.1)).high+4.1,at=local(vec(p.x,0,p.z)),posts:GardenComponent[]=[];for(const x of [-2,2])posts.push(grounded('garden-wayfinding-full-footprint-stake',at(x,0,0),.42,.48,top-.1,darkTimber));const board=box('garden-wayfinding-bearing-timber-tablet',labelWood,at(0,top-.7,0),vec(5.5,1.55,.36));for(const post of posts)contact('garden-wayfinding-board-stake-bearing',board,post);for(let i=0;i<(side<0?2:3);i++){const icon=box('garden-wayfinding-attached-branch-glyph',inlay,at(-1.5+i*.65,top-.7,-.20),vec(.24,side<0?.58:.97,.08));contact('garden-wayfinding-glyph-board-bearing',icon,board);}for(const sign of [-1,1]){const c=beam('garden-wayfinding-attached-direction',inlay,at(side*1.87,top-.7,-.20),at(side*.93,top-.7+sign*.43,-.20),.12,.08,'detail');contact('garden-wayfinding-arrow-board-bearing',c,board);}}
 // Ten deliberately sparse low botanical accents, each with a whole-footprint
 // planted socket and attached leaves; no particle bushes or billboard trees.
 for(const [i,x,z]of [[0,-450,130],[1,-205,255],[2,-76,353],[3,138,375],[4,328,155],[5,382,-118],[6,421,-315],[7,286,-542],[8,-28,-643],[9,-448,-296]]){
  const footprint=oval(vec(x,0,z),2.4,2.0,0,20),f=foundation('garden-low-leaf-clump-'+i,footprint,.08),base=vec(x,f.top,z),root=loft('garden-low-clump-planted-root',stem,[{p:base.clone().add(vec(0,-.04,0)),rx:.65,rz:.65},{p:base.clone().add(vec(0,.45,0)),rx:.42,rz:.42}],16);contact('garden-low-clump-root-footing-bearing',root,f.component);for(let j=0;j<4;j++){const shape=blade('garden-low-attached-leaf',base.clone().add(vec(0,.3,0)),2.6+j*.23,.62,j*Math.PI/2+i*.37,.44+(j%2)*.18,.08,j%2?newLeaf:leaf,false,6,2);contact('garden-low-leaf-root-bearing',shape.surface,root);}
 }
 // ORIGINAL GARDEN ENRICHMENT: three composed off-road planting/court groups.
 // Append-only: original terrain, road, heroes and all material buffers above
 // remain byte-identical. These are scenic meshes, never driving surfaces.
 const enrichmentAssemblies:any[]=[],enrichmentOpenings:any[]=[];
 const enrichStart=components.length;
 const composition=(id:string,recipe:()=>void)=>{
  const first=components.length,firstFoundation=foundations.length,firstContact=structuralContacts.length,firstOpening=enrichmentOpenings.length;
  recipe();
  const grouped=new Map<string,number[]>();for(let i=first;i<components.length;i++){const c=components[i],key=c.assembly??id+'-solid-'+i;const list=grouped.get(key)??[];list.push(i);grouped.set(key,list);}
  const ids=new Map<number,string>();let serial=0;for(const list of grouped.values()){const key=id+'-piece-'+serial++;for(const i of list)ids.set(i,key);}
  const pieces=[...grouped.values()].map(list=>{const firstPart=components[list[0]],parts=list.map(i=>components[i]);return{...firstPart,id:ids.get(list[0]),componentIndices:list,min:[0,1,2].map(k=>Math.min(...parts.map(c=>c.min[k]))),max:[0,1,2].map(k=>Math.max(...parts.map(c=>c.max[k]))),supportOwner:[...new Set(structuralContacts.slice(firstContact).filter(q=>list.includes(q.first)).map(q=>ids.get(q.second)).filter(Boolean))]};});
  enrichmentAssemblies.push({id,pieces,groundContacts:foundations.slice(firstFoundation).map(q=>({...q,pieceId:ids.get(q.component)})),openBayWitnesses:enrichmentOpenings.slice(firstOpening),roofSeats:structuralContacts.slice(firstContact).filter(q=>q.kind==='garden-enrichment-roof-full-seat-bearing').map(q=>({roofPieceId:ids.get(q.first),supportPieceId:ids.get(q.second),roofUnderside:facesFor(components[q.first]).slice(0,2),supportTop:facesFor(components[q.second]).slice(2,4)}))});
 };
 const site=(edge:SceneryRoadEdge,s:number,offset:number)=>{const f=edge.sample(s,offset);return{p:vec(f.p.x,0,f.p.z),yaw:Math.atan2(-f.t.z,f.t.x)};};
 const plantedBed=(name:string,edge:SceneryRoadEdge,s:number,offset:number,rx:number,rz:number,rise:number,plants:number,scale:number)=>{
  const {p,yaw:routeYaw}=site(edge,s,offset),gx=groundY(p.x+1,p.z)-groundY(p.x-1,p.z),gz=groundY(p.x,p.z+1)-groundY(p.x,p.z-1),yaw=rise>.5?Math.atan2(gx,gz):routeYaw,fp=oval(p,rx,rz,yaw,16),f=foundation(name,fp,rise),at=local(vec(p.x,f.top,p.z),yaw);
  const rim=annulus(name+'-thick-stone-rim',planterStone,at,rx,rz,1-.7/rz,0,1.05,0,Math.PI*2,16);
  const bed=solid(name+'-deep-soil',soil,oval(p,rx*(1-.7/rz)+.12,rz-.58,yaw,16),f.top-.05,f.top+.76);
  contact('garden-enrichment-rim-pad-bearing',rim,f.component);contact('garden-enrichment-soil-pad-bearing',bed,f.component);contact('garden-enrichment-soil-retaining-rim-interface',bed,rim);
  for(let j=0;j<plants;j++){
   const x=(j-(plants-1)/2)*rx*1.24/Math.max(1,plants-1),z=(j%2?1:-1)*rz*(name==='garden-enrichment-west-high'?.10:.20),rootAt=at(x,.65,z);
   const crown=loft(name+'-root-'+j,stem,[{p:rootAt,rx:.82,rz:.82},{p:rootAt.clone().add(vec(0,1.60,0)),rx:.86,rz:.86}],8);
   contact('garden-enrichment-root-soil-bearing',crown,bed);
   if(j===0||j===plants-1){
    const low=blade(name+'-broad-low-underplanting-'+j,rootAt.clone().add(vec(0,.25,0)),Math.min(5.3,rx*.44),1.5,yaw+(j===0?Math.PI/2:-Math.PI/2),.18,j===0?.06:-.06,j===0?leaf:newLeaf,false,4,2);
    contact('garden-enrichment-underplanting-root-bearing',low.surface,crown);
   }
   for(let k=0;k<3;k++){
    const a=yaw+k*2.1+j*.67+((name==='garden-enrichment-west-low'&&j===1||name==='garden-enrichment-west-high'&&j===0)&&k===1?.45:0),L=scale*(.86+.12*k+.07*(j%2)),r=rootAt.clone().add(vec(Math.sin(a)*.55,1.40,Math.cos(a)*.55));
    const bladeShape=blade(name+'-fan-'+j+'-'+k,r,L,.66,a,.56+.13*k,(k-1)*.08,k===1?newLeaf:leaf,false,8,2);
    contact('garden-enrichment-leaf-root-bearing',bladeShape.surface,crown);
   }
  }
  if(name==='garden-enrichment-west-low'){
   const origin=at(rx*.32,.65,-rz*.67),flowerStem=loft(name+'-single-focal-flower-stem',stem,[{p:origin,rx:.26,rz:.26},{p:origin.clone().add(vec(0,3.55,0)),rx:.20,rz:.20}],8);
   contact('garden-enrichment-focal-flower-soil-bearing',flowerStem,bed);
   const heart=loft(name+'-warm-focal-receptacle',amber,[{p:origin.clone().add(vec(0,3.10,0)),rx:.28,rz:.28},{p:origin.clone().add(vec(0,3.62,0)),rx:.72,rz:.72},{p:origin.clone().add(vec(0,4.12,0)),rx:.25,rz:.25}],8);
   contact('garden-enrichment-focal-heart-stem-bearing',heart,flowerStem);
   const pivot=origin.clone().add(vec(0,3.62,0)),approach=course.commonStart.sample(270).p.clone().sub(pivot);approach.y=0;approach.normalize();
   const axis=vec(approach.z,0,-approach.x),angleTilt=.90,cs=Math.cos(angleTilt),sn=Math.sin(angleTilt);
   for(let k=0;k<5;k++){
    const angle=k*Math.PI*2/5+.3,petal=blade(name+'-warm-focal-petal-'+k,pivot.clone().add(vec(Math.sin(angle)*.42,0,Math.cos(angle)*.42)),2.55,.90,angle,.05,0,k%2?blush:ivory,true,4,2);
    // Tilt the whole closed petal shell toward the natural driving approach;
    // only its newly appended vertices change, before normal computation.
    for(const c of petal.parts){const b=batches.find(b=>b.name===c.batch)!;for(let i=c.vertexStart;i<c.vertexEnd;i++){const q=vec(...b.positions.slice(i*3,i*3+3) as [number,number,number]).sub(pivot),cross=new pc.Vec3().cross(axis,q),rot=q.clone().mulScalar(cs).add(cross.mulScalar(sn)).add(axis.clone().mulScalar(axis.dot(q)*(1-cs))).add(pivot);b.positions.splice(i*3,3,rot.x,rot.y,rot.z);b.uvs.splice(i*2,2,rot.x*.15,rot.z*.15);}for(let d=0;d<3;d++){const values=b.positions.slice(c.vertexStart*3,c.vertexEnd*3).filter((_,i)=>i%3===d);c.min[d]=Math.min(...values);c.max[d]=Math.max(...values);}}
    contact('garden-enrichment-focal-petal-heart-bearing',petal.surface,heart);if(k===3)contact('garden-enrichment-focal-petal-stem-bearing',petal.surface,flowerStem);
   }
  }
 };
 composition('garden-enrichment-west-terraces',()=>{
  plantedBed('garden-enrichment-west-low',course.commonStart,341,-33,14,4.6,.40,3,5.4);
  plantedBed('garden-enrichment-west-high',course.commonStart,365,-41,11,3.2,.65,3,6.5);
  plantedBed('garden-enrichment-west-return',course.commonStart,387,-35,10,4.4,.35,2,5.0);
 });
 // Two unequal nursery wings: literal open bays with sloping thick timber
 // roofs, complete transverse seats and individual visible column bearings.
 composition('garden-enrichment-nursery-court',()=>{
  for(const [wing,s,offset,width,depth,height] of [[0,789,-41,15,12,7.2],[1,810,-43,17,12,9.0]]){
   const name='garden-enrichment-nursery-wing-'+wing,{p,yaw}=site(course.commonStart,s,offset),baseY=groundY(p.x,p.z)+.35,at=local(vec(p.x,baseY,p.z),yaw);
   const slope=.13,roofBottom=(z:number)=>height+slope*z;
   const wedge=(kind:string,b:Batch,x0:number,x1:number,z0:number,z1:number,low:(z:number)=>number,high:(z:number)=>number)=>{
    const start=b.positions.length/3;for(const y of [low,high])for(const [x,z]of [[x0,z0],[x1,z0],[x1,z1],[x0,z1]])b.vertex(at(x,y(z),z));
    for(const t of [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]])b.indices.push(...t.map(i=>i+start));return bound(kind,b,start)!;
   };
   const beams:GardenComponent[]=[];
   for(const z of [-4.6,4.6]){
    const low=roofBottom(z)-.8;
    const seat=wedge(name+'-complete-roof-bearing',darkTimber,-width/2+.3,width/2-.3,z-.46,z+.46,()=>low,zz=>roofBottom(zz)+.025);beams.push(seat);
    for(const x of [-width/2+1.0,width/2-1.0]){
     const footAt=at(x,0,z),f=foundation(name+'-column-foot-'+x+'-'+z,rect(footAt,1.7,1.7,yaw),.18),shoeY=f.top-baseY;
     const shoe=box(name+'-stone-column-shoe',planterStone,at(x,shoeY+.25,z),vec(1.35,.50,1.35),yaw);contact('garden-enrichment-column-shoe-pad-bearing',shoe,f.component);
     const postBottom=shoeY+.38,post=box(name+'-timber-column',timber,at(x,(low+postBottom)/2,z),vec(.78,low-postBottom+.025,.78),yaw);contact('garden-enrichment-column-shoe-bearing',post,shoe);contact('garden-enrichment-crossbeam-column-bearing',seat,post);
    }
   }
   const roof=wedge(name+'-sloped-opaque-roof',timber,-width/2-.65,width/2+.65,-depth/2-.6,depth/2+.6,roofBottom,z=>roofBottom(z)+.48);for(const seat of beams)contact('garden-enrichment-roof-full-seat-bearing',roof,seat);
   const openingFootprint=rect(p,width-3.9,8,yaw),openingBottom=terrainExtrema(openingFootprint).high+.2,openingTop=baseY+roofBottom(-4.6)-1.05;
   enrichmentOpenings.push({label:name+'-literal-open-bay',corners:[...openingFootprint.map(q=>[q.x,openingBottom,q.z]),...openingFootprint.map(q=>[q.x,openingTop,q.z])],bottom:openingBottom,top:openingTop,width:width-3.9,depth:8,yaw});
  }
  plantedBed('garden-enrichment-nursery-front-bed',course.commonStart,770,-33,9,4,.32,2,4.8);
  plantedBed('garden-enrichment-nursery-upper-bed',course.commonStart,838,-40,11,3.8,.55,3,5.7);
 });
 composition('garden-enrichment-return-terraces',()=>{
  plantedBed('garden-enrichment-return-low',course.commonFinish,375,34,12,4.7,.35,3,5.5);
  plantedBed('garden-enrichment-return-high',course.commonFinish,400,34,11,3.5,.55,3,6.2);
 });

 // Each target is a centroid of emitted hero triangles, never a guessed icon.
 for(const sight of sightlines){const seed=[...sight.target];let best=Infinity;for(const c of components.filter(c=>c.landmark===sight.targetId))for(const face of facesFor(c)){const p=[0,1,2].map(k=>(face[0][k]+face[1][k]+face[2][k])/3),d=p.reduce((n,v,k)=>n+(v-seed[k])**2,0);if(d<best){best=d;sight.target=p;}}}
 // Every non-road source face is represented exactly once: the separately
 // verified heightfield supplies terrain, and these literal triangles preserve
 // all gaps through the open arbor, petals, leaflets and bearing assemblies.
 meshBlock('garden-actual-source-shoulder-triangles',shoulderFaces.map(f=>f.points));
 meshBlock('garden-actual-open-arbor-triangles',components.filter(c=>c.kind.startsWith('arbor-')).flatMap(facesFor));
 for(const p of plots)meshBlock('garden-actual-'+p.id,components.filter(c=>c.landmark===p.id).flatMap(facesFor));
 meshBlock('garden-actual-other-source-triangles',components.slice(0,enrichStart).filter(c=>!c.landmark&&!c.kind.startsWith('arbor-')&&c.role!=='terrain'&&c.role!=='road'&&c.kind!=='source-exact-layer-owned-shoulders').flatMap(facesFor));
 for(const group of enrichmentAssemblies)meshBlock(group.id+'-exact-triangles',group.pieces.flatMap((piece:any)=>piece.componentIndices.flatMap((i:number)=>facesFor(components[i]))));
 const used=batches.filter(b=>b.indices.length),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const b of used)for(let i=0;i<b.positions.length;i++){const k=i%3;min[k]=Math.min(min[k],b.positions[i]);max[k]=Math.max(max[k],b.positions[i]);}
 const budget={batches:used.length,triangles:used.reduce((n,b)=>n+b.indices.length/3,0),vertices:used.reduce((n,b)=>n+b.positions.length/3,0)};
 if(budget.batches!==21||budget.triangles>=120000||budget.triangles-108557>10000||budget.vertices>=200000)throw new Error('Garden emitted geometry budget exceeded: '+JSON.stringify({budget,batches:used.map(b=>[b.name,b.indices.length/3,b.positions.length/3])}));
 return{version:1,trackId:course.id,batches:used,roadSamples,routeRoadSamples,roadFaces,roadUndersideFaces,shoulderFaces,props,structures:[{kind:'gallery',from:arbor.from,to:arbor.to,overheadClearance:22.95}],bounds:{min,max},cameraObstacles,components,landmarks,foundations,groundedDetails,railMembers,wheelContacts:[],structuralContacts,sightlines,landforms,terrainGrid,terrainVertices,terrainTriangles,terrainExposure,terrainPartitions,arbor,assemblies,budget,enrichmentAssemblies};
}
