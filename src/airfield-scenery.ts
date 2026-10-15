import * as pc from 'playcanvas';
import {LandMeshBatch as Batch} from './land-mesh-builder';
import {footprintArea,intersectRoadFootprint,subtractRoadFootprint,sampleRoadFootprints,roadFootprint,RoadFootprintIndex,type SceneryForkCourse,type SceneryRoadEdge,type RoadFootprint} from './land-road-mesh';
import type {LandSceneGeometry,LandPropPlacement} from './land-scenery';
import type {LandSceneTheme} from './land-scene';
import {cameraTerrainHeight,type CameraBlocker,type CameraHeightfield} from './land-camera';
import {AIRFIELD_HANGAR,AIRFIELD_LANDMARKS,airfieldHangarPlan} from './maps/airfield';

type Face={edgeId:string;distance:number;points:number[][]};
type Role='terrain'|'road'|'support'|'structure'|'rail'|'detail'|'visual-coping';
export type AirfieldComponent={kind:string;batch:string;vertexStart:number;vertexEnd:number;indexStart:number;indexEnd:number;min:number[];max:number[];role:Role;solid:boolean;landmark?:string;assembly?:string};
export interface AirfieldSceneGeometry extends LandSceneGeometry {
 routeRoadSamples:{edgeId:string;distance:number;left:number[];right:number[];rendered:boolean}[];
 roadFaces:Face[];roadUndersideFaces:Face[];shoulderFaces:Face[];
 cameraObstacles:(CameraBlocker&{kind:string})[];components:AirfieldComponent[];
 landmarks:{kind:string;label:string;position:number[];radius:number;height:number}[];
 foundations:{kind:string;top:number;bottom:number;footprint:number[][];terrainLow:number;terrainHigh:number;component:number}[];
 groundedDetails:{kind:string;x:number;z:number;bottom:number;terrainY:number;footprint:number[][];component:number}[];
 structuralContacts:{kind:string;first:number;second:number}[];
 railMembers:{edgeId:string;distance:number;side:number;points:number[][]}[];
 wheelContacts:{kind:string;component:number;pad:number;footprint:number[][];bottom:number;top:number}[];
 bearingPoints:{kind:string;first:number;second:number;point:number[]}[];
 sightlines:{name:string;eye:number[];target:number[];radius:number;targetId:string}[];
 landforms:{kind:string;footprint:number[][];bottom:number;top:number}[];
 terrainGrid:CameraHeightfield;terrainVertices:number[];terrainTriangles:number[][][];
 terrainExposure:number[];terrainPartitions:{sourceTriangle:number;material:'ochre'|'sage'|'clay';batch:string;indexStart:number;indexEnd:number}[];
 hangar:{from:number;to:number;faces:{kind:string;points:number[][]}[];members:{id:string;kind:string;component:number;aNode:string;bNode:string}[];supports:{id:string;s:number;side:number;footprint:number[][];bottom:number;top:number;terrainLow:number;terrainHigh:number;component:number}[]};
 assemblies:{id:string;components:number[];closed:boolean}[];
 budget:{batches:number;triangles:number;vertices:number};
 enrichmentAssemblies:any[];
}
export const AIRFIELD_SCENE_THEME:Readonly<LandSceneTheme>=Object.freeze({textureLabel:'original Copperwing Airfield concrete dry upland and opaque aircraft skins',ambient:'#d7e4ef',sky:'#e6f0f7',fogStart:1250,fogEnd:2650,cameraName:'Copperwing Airfield chase camera',sunName:'Copperwing Airfield warm late afternoon sunlight',sunColor:'#fff5e5',sunIntensity:1.55,sunEuler:[38,-29,0] as const});
const vec=(x:number,y:number,z:number)=>new pc.Vec3(x,y,z),tuple=(p:pc.Vec3)=>[p.x,p.y,p.z];
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const smooth=(x:number)=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
const local=(p:pc.Vec3,yaw=0)=>{const c=Math.cos(yaw),s=Math.sin(yaw);return(x:number,y:number,z:number)=>vec(p.x+x*c+z*s,p.y+y,p.z-x*s+z*c);};
const clean=(input:pc.Vec3[])=>{let p=input.filter((v,i)=>v.distance(input[(i+input.length-1)%input.length])>1e-8),changed=true;while(changed&&p.length>3){changed=false;for(let i=0;i<p.length;i++){const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length];if(Math.abs((b.x-a.x)*(c.z-b.z)-(b.z-a.z)*(c.x-b.x))<1e-9){p.splice(i,1);changed=true;break;}}}return p;};
const cut=(p:pc.Vec3[],owner:pc.Vec3[])=>{const a=clean(p),b=clean(owner);return a.length>=3&&b.length>=3?subtractRoadFootprint(a,b).map(clean).filter(q=>q.length>=3&&footprintArea(q)>1e-8):a.length>=3?[a]:[];};
const yAt=(f:pc.Vec3[],x:number,z:number)=>{const[a,b,c]=f,den=(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x),u=((x-a.x)*(c.z-a.z)-(z-a.z)*(c.x-a.x))/den,v=((b.x-a.x)*(z-a.z)-(b.z-a.z)*(x-a.x))/den;return a.y+u*(b.y-a.y)+v*(c.y-a.y);};

/** Source-authored static aviation museum. All geometry and camera triangles
 * share these exact buffers; no downloaded art, new physics or shaders. */
export function buildAirfieldSceneGeometry(course:SceneryForkCourse):AirfieldSceneGeometry {
 const ochre=new Batch('Airfield connected dry ochre uplands','#d3dfd1',1,'grass');
 const sage=new Batch('Airfield connected muted sage banks','#adc6b2',1,'grass');
 const clay=new Batch('Airfield connected warm clay contours','#c4cecf',1,'stone');
 const road=new Batch('Airfield charcoal runway and taxiway','#8298ad',.97,'asphalt');
 const shoulder=new Batch('Airfield full-width gravel shoulder stitches','#c7d3dd',1,'stone');
 const foundationStone=new Batch('Airfield whole footprint warm concrete','#dbe2e7',1,'stone');
 const paleStone=new Batch('Airfield pale limestone edge and plaques','#f2f3ee',.96,'stone');
 const steel=new Batch('Airfield opaque blue steel structure','#50789f',.65,'none',.45);
 const darkSteel=new Batch('Airfield dark steel joints and webs','#3b5575',.7,'none',.5);
 const copper=new Batch('Airfield muted copper dimensional panels','#c3d2df',.6,'none',.45);
 const cream=new Batch('Airfield cream closed fuselage skins','#fafbf7',.72,'none',.22);
 const teal=new Batch('Airfield cool teal closed wing skins','#94bfdb',.66,'none',.35);
 const underside=new Batch('Airfield shaded blue wing undersides','#698bae',.79,'none',.28);
 const tire=new Batch('Airfield dark rubber closed tread','#354451',.95,'asphalt');
 const hubMetal=new Batch('Airfield pale alloy hubs and bearing shoes','#d3e2ed',.5,'none',.6);
 const brass=new Batch('Airfield warm brass spars and rib edges','#e6bb67',.6,'none',.42);
 const coral=new Batch('Airfield muted terracotta tower fins','#e9f0f5',.8,'none',.2);
 const signFace=new Batch('Airfield deep teal museum signs','#315575',.8,'none');
 const inlay=new Batch('Airfield original ivory runway markings','#fff7dd',.94,'stone');
 const grass=new Batch('Airfield sparse grounded dry grass','#b5c9a8',1,'grass');
 const batches=[ochre,sage,clay,road,shoulder,foundationStone,paleStone,steel,darkSteel,copper,cream,teal,underside,tire,hubMetal,brass,coral,signFace,inlay,grass];
 const edges=[course.commonStart,course.alternates.alley,course.alternates.boulevard,course.commonFinish],sourceFaces=sampleRoadFootprints(edges,1.65),roadIndex=new RoadFootprintIndex(sourceFaces),plots=AIRFIELD_LANDMARKS.plots;
 const props:LandPropPlacement[]=[],roadSamples:AirfieldSceneGeometry['roadSamples']=[],routeRoadSamples:AirfieldSceneGeometry['routeRoadSamples']=[],roadFaces:Face[]=[],roadUndersideFaces:Face[]=[],shoulderFaces:Face[]=[];
 const components:AirfieldComponent[]=[],cameraObstacles:AirfieldSceneGeometry['cameraObstacles']=[],landmarks:AirfieldSceneGeometry['landmarks']=[],foundations:AirfieldSceneGeometry['foundations']=[],groundedDetails:AirfieldSceneGeometry['groundedDetails']=[],structuralContacts:AirfieldSceneGeometry['structuralContacts']=[],railMembers:AirfieldSceneGeometry['railMembers']=[],landforms:AirfieldSceneGeometry['landforms']=[],assemblies:AirfieldSceneGeometry['assemblies']=[];
 const hangar:AirfieldSceneGeometry['hangar']={from:AIRFIELD_HANGAR.physicalS[0],to:AIRFIELD_HANGAR.physicalS[1],faces:[],members:[],supports:[]};
 const wheelContacts:AirfieldSceneGeometry['wheelContacts']=[],bearingPoints:AirfieldSceneGeometry['bearingPoints']=[];
 let landmark:string|undefined,assembly:string|undefined;
 const point=(e:SceneryRoadEdge,s:number,l=0,h=0)=>e.sample(s,l).p.clone().add(vec(0,h,0));
 const bound=(kind:string,b:Batch,start:number,role:Role='structure',solid=true,indexStart?:number)=>{
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=start*3;i<b.positions.length;i++){const k=i%3;min[k]=Math.min(min[k],b.positions[i]);max[k]=Math.max(max[k],b.positions[i]);}
  let index=indexStart??b.indices.length;while(indexStart===undefined&&index>0&&b.indices[index-1]>=start)index-=3;
  if(index===b.indices.length)return undefined;
  if(solid){let volume=0;const origin=b.positions.slice(start*3,start*3+3);for(let i=index;i<b.indices.length;i+=3){const p=b.indices.slice(i,i+3).map(k=>b.positions.slice(k*3,k*3+3).map((v,j)=>v-origin[j]));volume+=p[0][0]*(p[1][1]*p[2][2]-p[1][2]*p[2][1])+p[0][1]*(p[1][2]*p[2][0]-p[1][0]*p[2][2])+p[0][2]*(p[1][0]*p[2][1]-p[1][1]*p[2][0]);}if(volume<0)for(let i=index;i<b.indices.length;i+=3)[b.indices[i+1],b.indices[i+2]]=[b.indices[i+2],b.indices[i+1]];}
  const c:AirfieldComponent={kind,batch:b.name,vertexStart:start,vertexEnd:b.positions.length/3,indexStart:index,indexEnd:b.indices.length,min,max,role,solid,...(landmark?{landmark}:{}),...(assembly?{assembly}:{})};components.push(c);return c;
 };
 const facesFor=(c:AirfieldComponent)=>{const b=batches.find(b=>b.name===c.batch)!,out:number[][][]=[];for(let i=c.indexStart;i<c.indexEnd;i+=3)out.push(b.indices.slice(i,i+3).map(k=>b.positions.slice(k*3,k*3+3)));return out;};
 const meshBlock=(kind:string,triangles:number[][][])=>{if(!triangles.length)return;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const t of triangles)for(const p of t)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}cameraObstacles.push({kind,min,max,triangles});};
 const box=(kind:string,b:Batch,p:pc.Vec3,size:pc.Vec3,yaw=0,role:Role='structure')=>{const start=b.positions.length/3;b.box(p,size,yaw);return bound(kind,b,start,role)!;};
 const contact=(kind:string,a:AirfieldComponent,b:AirfieldComponent,p?:pc.Vec3)=>{const first=components.indexOf(a),second=components.indexOf(b);structuralContacts.push({kind,first,second});if(p)bearingPoints.push({kind,first,second,point:tuple(p)});};
 const beam=(kind:string,b:Batch,a:pc.Vec3,c:pc.Vec3,width:number,depth=width,role:Role='structure',extension=0,relief?:'cheeks'|'all')=>{
  relief??=landmark?'all':undefined;
  const y=c.clone().sub(a).normalize(),ref=Math.abs(y.y)>.95?vec(1,0,0):vec(0,1,0),x=new pc.Vec3().cross(y,ref).normalize(),z=new pc.Vec3().cross(y,x).normalize(),aa=a.clone().sub(y.clone().mulScalar(extension)),cc=c.clone().add(y.clone().mulScalar(extension)),at=(p:pc.Vec3,i:number,j:number)=>p.clone().add(x.clone().mulScalar(i*width/2)).add(z.clone().mulScalar(j*depth/2));
  const v=[at(aa,-1,-1),at(aa,1,-1),at(aa,1,1),at(aa,-1,1),at(cc,-1,-1),at(cc,1,-1),at(cc,1,1),at(cc,-1,1)],start=b.positions.length/3;for(const p of v)b.vertex(p);for(const [face,f]of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].entries()){if((relief==='all'&&face>=2)||(relief==='cheeks'&&(face===3||face===5))){const center=f.reduce((p,i)=>p.add(v[i]),vec(0,0,0)).mulScalar(.25),core=aa.clone().lerp(aa,cc,.5),inward=core.sub(center).normalize().mulScalar(.016),index=b.positions.length/3;b.vertex(center.add(inward));for(let i=0;i<4;i++)b.indices.push(start+f[i],start+f[(i+1)%4],index);}else b.indices.push(start+f[0],start+f[1],start+f[2],start+f[0],start+f[2],start+f[3]);}return bound(kind,b,start,role)!;
 };
 const rect=(p:pc.Vec3,w:number,d:number,yaw=0)=>{const at=local(p,yaw);return[at(-w/2,0,-d/2),at(w/2,0,-d/2),at(w/2,0,d/2),at(-w/2,0,d/2)];};
 const solid=(kind:string,b:Batch,polygon:pc.Vec3[],bottom:number,top:number,role:Role='structure')=>{const p=clean(polygon),start=b.positions.length/3;for(let i=0;i<p.length;i++)b.vertex(vec(p[i].x,bottom,p[i].z));for(let i=0;i<p.length;i++)b.vertex(vec(p[i].x,top,p[i].z));const n=p.length;for(let i=1;i<n-1;i++)b.indices.push(start,start+i+1,start+i,start+n,start+n+i,start+n+i+1);for(let i=0;i<n;i++){const j=(i+1)%n;b.indices.push(start+i,start+j,start+i+n,start+j,start+j+n,start+i+n);}return bound(kind,b,start,role)!;};
 const sightlines:AirfieldSceneGeometry['sightlines']=[
  {name:'runway grounded Twinboom Courier',eye:tuple(point(course.commonStart,course.commonStart.length*.1,0,1.6)),target:[plots[0].x,plots[0].ySeed+8,plots[0].z],radius:2,targetId:plots[0].id},
  {name:'reversing ridge Splitfin Tower',eye:tuple(point(course.commonStart,course.commonStart.length*.53,0,1.6)),target:[plots[1].x,plots[1].ySeed+18,plots[1].z],radius:2,targetId:plots[1].id},
  {name:'perimeter static rotor cutaway',eye:tuple(point(course.alternates.boulevard,course.alternates.boulevard.length*.5,0,1.6)),target:[plots[2].x,plots[2].ySeed+9,plots[2].z],radius:2,targetId:plots[2].id},
  {name:'hangar-side wing anatomy gallery',eye:tuple(point(course.alternates.alley,course.alternates.alley.length*.63,0,1.6)),target:[419.31029464627494,24.08846630988553,205.55222522564068],radius:2,targetId:plots[3].id},
  {name:'descending return Sunfin Glider',eye:tuple(point(course.commonFinish,course.commonFinish.length*.4,0,1.6)),target:[plots[4].x,plots[4].ySeed+9,plots[4].z],radius:2,targetId:plots[4].id},
 ];
 const spines=[
  {id:'runway-plateau',knots:[[-380,9,-175],[-200,10,-175],[0,12,-175],[130,19,-130]],widths:[125,140,140,120]},
  {id:'rising-observation-ridge',knots:[[235,23,-40],[225,33,65],[130,39,155],[20,40,180]],widths:[100,100,110,90]},
  {id:'inner-low-saddle',knots:[[-40,15,-10],[-70,17,50],[-150,21,130]],widths:[120,90,100]},
  {id:'west-ridge-descent',knots:[[-175,29,195],[-150,26,280],[-55,25,340]],widths:[100,100,95]},
  {id:'museum-apron-shelf',knots:[[95,19,245],[260,19,245],[410,18,225],[560,18,240]],widths:[100,125,130,115]},
  {id:'outer-taxiway-crown',knots:[[300,24,385],[410,27,475],[535,24,390]],widths:[110,125,110]},
  {id:'descending-eastern-upland',knots:[[710,24,250],[715,20,100],[635,13,-70],[505,10,-220]],widths:[120,115,115,110]},
  {id:'southern-return-bench',knots:[[340,12,-340],[140,13,-355],[-80,10,-365],[-290,9,-335],[-410,10,-260]],widths:[120,120,130,120,100]},
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
 const minX=-500,maxX=800,minZ=-445,maxZ=530,nx=160,nz=120,dx=(maxX-minX)/nx,dz=(maxZ-minZ)/nz,heights:number[]=[];
 for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++)heights.push(terrainY(minX+x*dx,minZ+z*dz));
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const xx=minX+x*dx,zz=minZ+z*dz,cell=[vec(xx,0,zz),vec(xx+dx,0,zz),vec(xx+dx,0,zz+dz),vec(xx,0,zz+dz)];let cap=Infinity;for(const f of roadIndex.query(xx,xx+dx,zz,zz+dz))if(footprintArea(intersectRoadFootprint(f.points,cell))>1e-10)cap=Math.min(cap,f.minY-.42);const i=z*(nx+1)+x;for(const j of [i,i+1,i+nx+1,i+nx+2])heights[j]=Math.min(heights[j],cap);}
 const terrainVertices:number[]=[],terrainTriangles:number[][][]=[],terrainExposure:number[]=[],terrainPartitions:AirfieldSceneGeometry['terrainPartitions']=[];
 // Three broad continuous scalar bands partition each welded baseline face.
 // Intersections on shared source edges are identical; there are no whole-cell
 // material assignments, floating patches, or coplanar terrain overlays.
 for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){const i=z*(nx+1)+x,wx=minX+x*dx,wz=minZ+z*dz;terrainVertices.push(wx,heights[i],wz);terrainExposure.push(heights[i]-(13.7+.002*(wx+120)+2.4*Math.sin(wz*.009)+1.8*Math.sin(wx*.012+wz*.004)));}
 type CV={p:pc.Vec3;key:string;value:number};
 const caches=new Map<Batch,Map<string,number>>([[ochre,new Map()],[sage,new Map()],[clay,new Map()]]);
 const tv=(i:number)=>vec(...terrainVertices.slice(i*3,i*3+3) as [number,number,number]);
 const contour=(input:CV[],threshold:number,positive:boolean)=>{const out:CV[]=[];for(let k=0;k<input.length;k++){const a=input[k],b=input[(k+1)%input.length],inside=positive?a.value>=threshold:a.value<=threshold,next=positive?b.value>=threshold:b.value<=threshold;if(inside)out.push(a);if(inside!==next){const [lo,hi]=a.key<b.key?[a,b]:[b,a],t=(threshold-lo.value)/(hi.value-lo.value),key='e:'+lo.key+':'+hi.key+':'+threshold;out.push({p:lo.p.clone().lerp(lo.p,hi.p,t),key,value:threshold});}}return out.filter((v,i)=>v.p.distance(out[(i+out.length-1)%out.length].p)>1e-10);};
 const emitContour=(sourceTriangle:number,p:CV[],b:Batch,material:'ochre'|'sage'|'clay')=>{if(p.length<3)return;const indexStart=b.indices.length,cache=caches.get(b)!,index=(v:CV)=>{let i=cache.get(v.key);if(i===undefined){i=b.positions.length/3;b.vertex(v.p,[v.p.x*.11,v.p.z*.11]);cache.set(v.key,i);}return i;};for(let k=1;k<p.length-1;k++)if(footprintArea([p[0].p,p[k].p,p[k+1].p])>1e-9)b.indices.push(index(p[0]),index(p[k]),index(p[k+1]));if(b.indices.length>indexStart)terrainPartitions.push({sourceTriangle,material,batch:b.name,indexStart,indexEnd:b.indices.length});};
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const i=z*(nx+1)+x;for(const ids of [[i,i+nx+1,i+1],[i+1,i+nx+1,i+nx+2]]){const source=terrainTriangles.length,p=ids.map(i=>({p:tv(i),key:'v:'+i,value:terrainExposure[i]}));terrainTriangles.push(ids.map(i=>tuple(tv(i))));emitContour(source,contour(p,-3,false),ochre,'ochre');emitContour(source,contour(contour(p,-3,true),7,false),sage,'sage');emitContour(source,contour(p,7,true),clay,'clay');}}
 for(const [b,name]of [[ochre,'ochre'],[sage,'sage'],[clay,'clay']]as const)bound('connected-contour-'+name+'-heightfield',b,0,'terrain',false,0);
 const terrainGrid:CameraHeightfield={minX,minZ,dx,dz,columns:nx+1,rows:nz+1,heights};cameraObstacles.push({kind:'airfield-actual-connected-heightfield',min:[minX,Math.min(...heights),minZ],max:[maxX,Math.max(...heights),maxZ],heightfield:terrainGrid});
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
 // Exact opaque structural plan: closed steel solids, real split sheets, literal
 // ridge slot. Footing bottoms and post roots adapt to full terrain polygons.
 const plan=airfieldHangarPlan(),footByPost=new Map<string,{component:AirfieldComponent;top:number}>(),nodeMembers=new Map<string,AirfieldComponent[]>();
 for(const p of plan.supports){const f=foundation('hangar-'+p.id,[...p.footprint],.28);footByPost.set(p.id.replace('-footing','-post'),f);hangar.supports.push({id:p.id,s:p.s,side:p.side,footprint:p.footprint.map(tuple),bottom:f.bottom,top:f.top,terrainLow:f.ext.low,terrainHigh:f.ext.high,component:components.indexOf(f.component)});for(const t of facesFor(f.component))hangar.faces.push({kind:'footing',points:t});}
 const closedPolyhedron=(kind:string,b:Batch,vertices:pc.Vec3[],polygons:number[][],relieved=false)=>{const start=b.positions.length/3;for(const p of vertices)b.vertex(p);const core=vertices.reduce((a,p)=>a.add(p),vec(0,0,0)).mulScalar(1/vertices.length);for(const f of polygons){if(relieved&&f.length===4){const center=f.reduce((a,i)=>a.add(vertices[i]),vec(0,0,0)).mulScalar(.25),toward=core.clone().sub(center).normalize().mulScalar(.012),j=b.positions.length/3;b.vertex(center.add(toward));for(let k=0;k<f.length;k++)b.indices.push(start+f[k],start+f[(k+1)%f.length],j);}else for(let i=1;i<f.length-1;i++)b.indices.push(start+f[0],start+f[i],start+f[i+1]);}return bound(kind,b,start)!;};
 for(const m of plan.members){let c:AirfieldComponent;const foot=footByPost.get(m.id);if(m.kind==='roof-panel'){
   const n=new pc.Vec3().cross(m.corners[1].clone().sub(m.corners[0]),m.corners[2].clone().sub(m.corners[0])).normalize();if(n.y<0)n.mulScalar(-1);const v=[...m.corners.map(p=>p.clone()),...m.corners.map(p=>p.clone().sub(n.clone().mulScalar(m.thickness)))];
   c=closedPolyhedron('hangar-'+m.id,copper,v,[[0,1,2,3],[7,6,5,4],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]]);
  }else{const a=m.a.clone();if(foot)a.y=foot.top;c=beam('hangar-'+m.id,m.kind==='web'||m.kind==='roof-lattice'?darkSteel:steel,a,m.b,m.halfWidth*2,m.halfWidth*2,'structure',m.endExtension,m.kind==='tie'||m.kind==='rafter'?'cheeks':m.kind==='purlin'?'all':undefined);if(foot)contact('hangar-post-complete-plinth-bearing',c,foot.component,a);}
  hangar.members.push({id:m.id,kind:m.kind,component:components.indexOf(c),aNode:m.aNode,bNode:m.bNode});for(const t of facesFor(c))hangar.faces.push({kind:m.kind,points:t});
  for(const node of m.kind==='roof-panel'?m.cornerNodes:[m.aNode,m.bNode]){const siblings=nodeMembers.get(node)??[];for(const other of siblings)contact('hangar-shared-node-'+node,c,other);siblings.push(c);nodeMembers.set(node,siblings);}
 }
 // All rounded skins and shafts use closed indexed rings with finite end caps.
 const ringLoft=(kind:string,b:Batch,rings:pc.Vec3[][])=>{const start=b.positions.length/3,n=rings[0].length;for(const ring of rings)for(const p of ring)b.vertex(p);for(let k=0;k<rings.length-1;k++)for(let i=0;i<n;i++){const a=start+k*n+i,c=start+k*n+(i+1)%n;b.indices.push(a,c,a+n,c,c+n,a+n);}for(const k of [0,rings.length-1]){const j=b.positions.length/3;b.vertex(rings[k].reduce((a,p)=>a.add(p),vec(0,0,0)).mulScalar(1/n));for(let i=0;i<n;i++){const a=start+k*n+i,c=start+k*n+(i+1)%n;b.indices.push(j,...(k===0?[c,a]:[a,c]));}}return bound(kind,b,start)!;};
 const tube=(kind:string,b:Batch,points:pc.Vec3[],radii:number[],sides=12,role:Role='structure')=>{const rings=points.map((p,i)=>{const d=points[Math.min(points.length-1,i+1)].clone().sub(points[Math.max(0,i-1)]).normalize(),ref=Math.abs(d.y)>.94?vec(1,0,0):vec(0,1,0),u=new pc.Vec3().cross(d,ref).normalize(),v=new pc.Vec3().cross(d,u).normalize();return Array.from({length:sides},(_,j)=>{const a=j/sides*Math.PI*2;return p.clone().add(u.clone().mulScalar(Math.cos(a)*radii[i])).add(v.clone().mulScalar(Math.sin(a)*radii[i]));});});const c=ringLoft(kind,b,rings);c.role=role;return c;};
 const oval=(p:pc.Vec3,rx:number,rz:number,yaw=0,n=64)=>{const at=local(p,yaw);return Array.from({length:n},(_,i)=>at(Math.cos(i/n*Math.PI*2)*rx,0,Math.sin(i/n*Math.PI*2)*rz));};
 const court=(p:typeof plots[number],rx:number,rz:number,yaw:number)=>{landmark=p.id;const f=foundation(p.id+'-continuous-apron',oval(vec(p.x,0,p.z),rx,rz,yaw),.18),base=vec(p.x,f.top,p.z),at=local(base,yaw);landforms.push({kind:p.id,footprint:oval(base,rx,rz,yaw).map(tuple),bottom:f.bottom,top:f.top});return{...f,base,at,yaw};};
 const record=(p:typeof plots[number],base:pc.Vec3,label:string)=>{landmarks.push({kind:p.id,label,position:tuple(base),radius:p.radius,height:p.height});props.push({kind:p.id,x:base.x,y:base.y,z:base.z,radius:p.radius});};
 const label=(id:string,at:(x:number,y:number,z:number)=>pc.Vec3,x:number,z:number,yaw:number,pad:AirfieldComponent)=>{const stakes:AirfieldComponent[]=[];for(const side of [-1,1]){const p=at(x+side*.9,.7,z+.055),c=box(id+'-plaque-grounded-post',darkSteel,p,vec(.18,1.5,.22),yaw,'detail');contact('plaque-post-apron-bearing',c,pad,at(x+side*.9,0,z));stakes.push(c);}const board=box(id+'-original-museum-plaque',signFace,at(x,1.48,z),vec(2.5,.85,.22),yaw,'detail');for(const c of stakes)contact('plaque-board-post-bearing',board,c);for(let i=0;i<4;i++){const glyph=box(id+'-invented-plaque-mark',inlay,at(x-.77+i*.48,1.48,z-.13),vec(.22,.1+.09*(i%3),.08),yaw,'detail');contact('plaque-glyph-board-bearing',glyph,board);}return board;};
 // A closed wing is one continuous dimensional shell, with separate upper,
 // lower and perimeter material ranges. Stations carry actual swept/upturned
 // sections, never a flat silhouette or detached tips.
 const wing=(kind:string,at:(x:number,y:number,z:number)=>pc.Vec3,stations:number[][],thickness:number,upper:Batch,sectionsPerSpan=6,across=8,camberHeight=.42)=>{
  const first=components.length,id=kind+'-shell';assembly=id;const rows:number[][]=[];for(let k=0;k<stations.length-1;k++)for(let j=0;j<sectionsPerSpan;j++){const t=j/sectionsPerSpan;rows.push(stations[k].map((v,i)=>v+(stations[k+1][i]-v)*t));}rows.push(stations[stations.length-1]);
  const up:pc.Vec3[][]=[],down:pc.Vec3[][]=[];for(const [z,x,y,chord]of rows){const a:pc.Vec3[]=[],b:pc.Vec3[]=[];for(let j=0;j<=across;j++){const u=j/across*2-1,camber=camberHeight*(1-u*u);a.push(at(x+u*chord,y+camber+thickness/2,z));b.push(at(x+u*chord,y+camber-thickness/2,z));}up.push(a);down.push(b);}
  for(const [grid,b,flip,face]of [[up,upper,false,'upper'],[down,underside,true,'lower']]as const){const start=b.positions.length/3;for(const row of grid)for(const p of row)b.vertex(p);for(let i=0;i<rows.length-1;i++)for(let j=0;j<across;j++){const a=start+i*(across+1)+j,c=a+across+1;for(const t of [[a,c,a+1],[a+1,c,c+1]])b.indices.push(...(flip?[t[0],t[2],t[1]]:t));}bound(kind+'-joined-'+face,b,start,'structure',false);}
  const top:pc.Vec3[]=[],bottom:pc.Vec3[]=[];for(let j=0;j<=across;j++){top.push(up[0][j]);bottom.push(down[0][j]);}for(let i=1;i<rows.length;i++){top.push(up[i][across]);bottom.push(down[i][across]);}for(let j=across-1;j>=0;j--){top.push(up[rows.length-1][j]);bottom.push(down[rows.length-1][j]);}for(let i=rows.length-2;i>0;i--){top.push(up[i][0]);bottom.push(down[i][0]);}const start=copper.positions.length/3;for(let i=0;i<top.length;i++){const j=(i+1)%top.length;copper.tri(top[i],top[j],bottom[i]);copper.tri(top[j],bottom[j],bottom[i]);}bound(kind+'-closed-perimeter',copper,start,'structure',false);
  const parts=Array.from({length:components.length-first},(_,i)=>first+i);assemblies.push({id,components:parts,closed:true});assembly=undefined;
  // The whole directed shell orientation is determined once across materials.
  let volume=0;const origin=facesFor(components[first])[0][0];for(const i of parts)for(const t of facesFor(components[i])){const p=t.map(p=>p.map((v,k)=>v-origin[k]));volume+=p[0][0]*(p[1][1]*p[2][2]-p[1][2]*p[2][1])+p[0][1]*(p[1][2]*p[2][0]-p[1][0]*p[2][2])+p[0][2]*(p[1][0]*p[2][1]-p[1][1]*p[2][0]);}if(volume<0)for(const i of parts){const c=components[i],b=batches.find(b=>b.name===c.batch)!;for(let k=c.indexStart;k<c.indexEnd;k+=3)[b.indices[k+1],b.indices[k+2]]=[b.indices[k+2],b.indices[k+1]];}
  return{parts:parts.map(i=>components[i]),surface:components[first]};
 };
 const airframe=(p:typeof plots[number],glider:boolean)=>{
  const yaw=glider?-.35:.12,c=court(p,glider?28:26,glider?28:26,yaw),{at}=c;
  const stations=glider?[[-17,5,.6],[-10,5.6,2.3],[0,6.2,2.9],[11,6,1.3],[17,7,.4]]:[[-16,4,.8],[-11,5,3.2],[0,5.8,3.8],[9,5.2,2.4],[15,5,.5]],bodyRings:pc.Vec3[][]=[];
  for(let k=0;k<stations.length-1;k++)for(let j=0;j<7;j++){const t=j/7,[x,y,r]=stations[k].map((v,i)=>v+(stations[k+1][i]-v)*t);bodyRings.push(Array.from({length:32},(_,i)=>{const a=i/32*Math.PI*2;return at(x,y+Math.cos(a)*r*.68,Math.sin(a)*r); }));}const last=stations[stations.length-1];bodyRings.push(Array.from({length:32},(_,i)=>{const a=i/32*Math.PI*2;return at(last[0],last[1]+Math.cos(a)*last[2]*.68,Math.sin(a)*last[2]);}));
  const body=ringLoft(p.id+'-closed-station-fuselage',cream,bodyRings);
  const hood=ringLoft(p.id+'-opaque-short-cockpit-hood',signFace,[[-9,5.7,.4],[-7,7.3,1.3],[-3,7.8,1.5],[0,7.1,.45]].map(([x,y,r])=>Array.from({length:24},(_,i)=>{const a=i/24*Math.PI*2;return at(x,y+Math.cos(a)*r*.72,Math.sin(a)*r);})));contact('aircraft-hood-fuselage-bearing',hood,body,at(-4,7,0));
  const positive=glider?[[0,0,8,6],[9,-1,8.5,5.4],[19,-4,10.5,3.2],[26.5,-7,14,.6]]:[[0,0,7,5],[8,-1,7.5,4.8],[18,-5,8,3.3],[24,-8,9,.5]],wingStations=[...positive.slice(1).reverse().map(([z,x,y,w])=>[-z,x,y,w]),...positive];
  const main=wing(p.id+'-continuous-swept-wing',at,wingStations,glider?.42:.45,teal,6,8),spar=tube(p.id+'-continuous-wing-carry-through-spar',brass,wingStations.map(([z,x,y])=>at(x,y+.42,z)),wingStations.map(()=>.34),14);contact('aircraft-spar-through-fuselage',spar,body,at(0,positive[0][2]+.3,0));for(const part of main.parts)contact('aircraft-wing-skin-spar-bearing',part,spar);
  if(glider){const boom=tube(p.id+'-continuous-central-tail-boom',steel,[at(7,6,0),at(13,6.4,0),at(17,7,0)],[.65,.48,.34],20);contact('glider-tail-boom-fuselage',boom,body,at(11,6,0));for(const [side,height]of [[-1,6],[1,8]]){const tailAt=(x:number,y:number,z:number)=>at(x+14,6.6+y,z),fin=wing(p.id+'-unequal-tail-fin-'+side,tailAt,[[0,0,0,2.7],[side*3,1,height*.5,2.2],[side*5,2,height,.5]].sort((a,b)=>a[0]-b[0]),.4,side<0?copper:cream,7,5);for(const part of fin.parts)contact('glider-tail-fin-central-boom',part,boom);const brace=beam(p.id+'-tail-fin-visible-brace-'+side,brass,at(11,6,0),at(15,7+height*.5,side*3),.20);contact('glider-tail-brace-boom',brace,boom);contact('glider-tail-brace-fin',brace,fin.surface);}}
  else{const booms:AirfieldComponent[]=[];for(const side of [-1,1]){const boom=tube(p.id+'-paired-tail-boom-'+side,steel,[at(-1,7.8,side*9),at(8,6.5,side*9),at(16,6.2,side*9)],[.7,.56,.34],20);contact('courier-tail-boom-wing-spar',boom,spar,at(-1,7.8,side*9));booms.push(boom);}const tail=wing(p.id+'-joined-cross-tail',at,[[-11,14,6.3,.8],[-9,14,6.3,2.3],[0,14,6.3,2.7],[9,14,6.3,2.3],[11,14,6.3,.8]],.42,cream,4,4);for(const b of booms)contact('courier-cross-tail-both-booms',tail.surface,b);for(const side of [-1,1]){const fin=closedPolyhedron(p.id+'-closed-tail-fin-'+side,copper,[at(11,6.2,side*9-.2),at(16,6.2,side*9-.2),at(15,11,side*9-.2),at(13,10,side*9-.2),at(11,6.2,side*9+.2),at(16,6.2,side*9+.2),at(15,11,side*9+.2),at(13,10,side*9+.2)],[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]);contact('courier-tail-fin-boom',fin,booms[side<0?0:1]);}}
  const wheels=glider?[[-8,1.5,-4],[-8,1.5,4],[12,1.1,0]]:[[-8,1.4,-4],[-8,1.4,4],[11,1,0]];
  for(const [i,[x,r,z]]of wheels.entries()){
   const center=r-.07,n=48,start=tire.positions.length/3,profile=[[r*.48,-.40],[r*.83,-.57],[r,-.40],[r,.40],[r*.83,.57],[r*.48,.40]];
   for(let j=0;j<n;j++){const a=-Math.PI/2+j/n*Math.PI*2;for(const [radius,width]of profile)tire.vertex(at(x+Math.cos(a)*radius,center+Math.max(-r+.07,Math.sin(a)*radius),z+width));}
   for(let j=0;j<n;j++)for(let k=0;k<profile.length;k++){const a=start+j*profile.length+k,b=start+((j+1)%n)*profile.length+k,aa=start+j*profile.length+(k+1)%profile.length,bb=start+((j+1)%n)*profile.length+(k+1)%profile.length;tire.indices.push(a,b,aa,aa,b,bb);}const wheel=bound(p.id+'-closed-grounded-tire-'+i,tire,start)!;
   const hub=tube(p.id+'-wheel-hub-'+i,hubMetal,[at(x,center,z-.53),at(x,center,z+.53)],[r*.52,r*.52],24),axle=tube(p.id+'-wheel-axle-'+i,brass,[at(x,center,z-.85),at(x,center,z+.85)],[.19,.19],16);contact('wheel-hub-tire-bearing',hub,wheel,at(x+r*.5,center,z));contact('wheel-axle-hub-bearing',axle,hub,at(x,center,z));
   const belly=at(x,x>0?(glider?5.65:4.5):(glider?4.5:4.0),z===0?0:z*.38),hardpoint=box(p.id+'-belly-landing-hardpoint-'+i,darkSteel,belly,vec(1.4,1.0,1.2),yaw),yoke=at(x,center+1.25,z),strut=tube(p.id+'-landing-strut-'+i,steel,[belly,yoke],[.25,.25],16);contact('landing-hardpoint-fuselage-bearing',hardpoint,body,belly);contact('landing-strut-belly-hardpoint',strut,hardpoint,belly);
   for(const side of [-1,1]){const fork=beam(p.id+'-wheel-fork-'+i+'-'+side,steel,yoke,at(x,center,z+side*.72),.22);contact('landing-fork-strut',fork,strut,yoke);contact('landing-fork-axle',fork,axle,at(x,center,z+side*.72));}
   const footprint=rect(at(x,0,z),r*2,1.16,yaw);wheelContacts.push({kind:p.id+'-complete-tire-projection-'+i,component:components.indexOf(wheel),pad:components.indexOf(c.component),footprint:footprint.map(tuple),bottom:c.top,top:c.top});contact('wheel-tread-complete-apron-bearing',wheel,c.component,at(x,0,z));
  }
  label(p.id,at,-10,-11,yaw,c.component);record(p,c.base,glider?'Sunfin Glider: closed upswept wings, unequal tail and complete visible landing gear':'Twinboom Courier: crescent wing, paired tail booms and grounded three-wheel gear');
 };
 airframe(plots[0],false);
 // SPLITFIN TOWER: two unequal opaque roof fins, a literal slotted deck,
 // exposed V load frames and a grounded three-flight switchback stair.
 {
  const p=plots[1],yaw=.18,c=court(p,21.8,21.8,yaw),{at}=c,pylons:AirfieldComponent[]=[];
  for(const [i,x,z]of [[0,-6,-6],[1,8,5]]){const plinth=box('splitfin-tower-pylon-plinth-'+i,paleStone,at(x,.4,z),vec(5,.8,5),yaw);contact('tower-plinth-apron',plinth,c.component,at(x,0,z));const pylon=ringLoft('splitfin-tower-unequal-grounded-pylon-'+i,steel,[[.65,2.0],[8.8,1.3],[11.0,1.3]].map(([y,r])=>[at(x-r,y,z-r),at(x+r,y,z-r),at(x+r,y,z+r),at(x-r,y,z+r)]));contact('tower-pylon-plinth',pylon,plinth,at(x,.7,z));pylons.push(pylon);}
  const ties:AirfieldComponent[]=[];for(const z of [-6,5]){const tie=beam('splitfin-tower-deck-bearing-crossbeam-'+z,darkSteel,at(-13,10.4,z),at(13,10.4,z),.85,1.1);contact('tower-deck-crossbeam-pylon',tie,pylons[z<0?0:1],at(z<0?-6:8,10.4,z));ties.push(tie);}
  const joists:AirfieldComponent[]=[];for(const x of [-11,-6,0,6,11]){const joist=beam('splitfin-tower-deck-longitudinal-joist-'+x,steel,at(x,10.85,-10.8),at(x,10.85,10.8),.65,.75);for(const tie of ties)contact('tower-joist-crossbeam',joist,tie);joists.push(joist);}
  const slats:AirfieldComponent[]=[];for(let i=0;i<22;i++){const z=-10.5+i,slat=box('splitfin-tower-open-deck-slat-'+i,paleStone,at(0,11.35,z),vec(26,.38,.82),yaw);for(const joist of joists)contact('tower-slat-joist',slat,joist);slats.push(slat);}
  const roofTie=beam('splitfin-tower-offset-roof-tie',brass,at(-10,21.05,0),at(12,21.05,0),1.1,.85);
  for(const [i,x,z]of [[0,-6,-6],[1,8,5]])for(const side of [-1,1]){const arm=beam('splitfin-tower-visible-V-frame-'+i+'-'+side,steel,at(x,10.6,z),at(x+side*3.0,21.05,0),.75,.75);contact('tower-V-frame-pylon',arm,pylons[i],at(x,10.6,z));contact('tower-V-frame-roof-tie',arm,roofTie,at(x+side*3,21.05,0));}
  const fin=wing('splitfin-tower-unequal-swept-roof-fins',at,[[-15,-2,25.2,4],[-8,0,23.1,8],[0,1,21.0,10],[6,3,22.3,7],[11.5,6,24.0,2.2]],.9,coral,6,8);for(const part of fin.parts)contact('tower-fins-offset-roof-tie',part,roofTie);
  // Stair occupies a separate narrow bay; slotted deck remains open beneath.
  const landings:AirfieldComponent[]=[],stairColumns=new Map<string,AirfieldComponent>();for(const [i,x,y]of [[0,-13.8,.35],[1,-6.6,4.0],[2,-13.8,7.65],[3,-6.6,11.3]]){const landing=box('splitfin-tower-stair-bearing-landing-'+i,paleStone,at(x,y,-13.2),vec(3.3,i===0?.75:.38,3.6),yaw);if(i===0)contact('tower-stair-ground-landing-apron',landing,c.component);else{for(const side of [-1,1]){const key=(x+side*1.2).toFixed(5);let post=stairColumns.get(key);if(!post){post=beam('splitfin-tower-stair-grounded-landing-post-'+i+'-'+side,steel,at(x+side*1.2,0,-13.2),at(x+side*1.2,x===-6.6?11.3:y,-13.2),.30);stairColumns.set(key,post);contact('tower-stair-landing-post-apron',post,c.component,at(x+side*1.2,0,-13.2));}contact('tower-stair-landing-post-platform',post,landing,at(x+side*1.2,y,-13.2));}}landings.push(landing);}
  const stairHandrailPosts=new Map<string,AirfieldComponent>();
  for(let flight=0;flight<3;flight++){const ax=flight%2===0?-12.3:-8.1,bx=flight%2===0?-8.1:-12.3,ay=.35+flight*3.65,by=ay+3.65,stringers:AirfieldComponent[]=[];for(const side of [-1,1]){const stringer=beam('splitfin-tower-stair-stringer-'+flight+'-'+side,darkSteel,at(ax,ay,-13.2+side*1.3),at(bx,by,-13.2+side*1.3),.35,.45);contact('tower-stair-stringer-lower-landing',stringer,landings[flight]);contact('tower-stair-stringer-upper-landing',stringer,landings[flight+1]);stringers.push(stringer);}for(let j=0;j<12;j++){const t=(j+.5)/12,x=ax+(bx-ax)*t,y=ay+(by-ay)*t,step=box('splitfin-tower-supported-stair-tread-'+flight+'-'+j,hubMetal,at(x,y+.13,-13.2),vec(.62,.26,2.9),yaw);for(const s of stringers)contact('tower-stair-tread-stringer',step,s);}for(const side of [-1,1]){const rail=beam('splitfin-tower-stair-handrail-'+flight+'-'+side,brass,at(ax,ay+1.2,-13.2+side*1.35),at(bx,by+1.2,-13.2+side*1.35),.12);for(const t of [0,.5,1]){const x=ax+(bx-ax)*t,y=ay+(by-ay)*t,key=[x,y,side].map(n=>n.toFixed(6)).join(':');let post=stairHandrailPosts.get(key);if(!post){post=beam('splitfin-tower-stair-handrail-post',steel,at(x,y,-13.2+side*1.35),at(x,y+1.2,-13.2+side*1.35),.10);stairHandrailPosts.set(key,post);}contact('tower-handrail-post-stringer',post,stringers[side<0?0:1]);contact('tower-handrail-post-top-rail',post,rail);}}}
  // Bridge landing joins the deck rather than stopping beside it.
  const bridge=box('splitfin-tower-top-stair-deck-bridge',paleStone,at(-6.6,11.32,-11.0),vec(3.15,.40,1.2),yaw);contact('tower-stair-bridge-landing',bridge,landings[3]);contact('tower-stair-bridge-deck',bridge,slats[0]);
  for(const side of [-1,1]){const rail=beam('splitfin-tower-deck-edge-handrail-'+side,brass,at(side*12.8,12.55,-10.5),at(side*12.8,12.55,10.5),.12);for(const z of [-10.5,-5.5,.5,5.5,10.5]){const post=beam('splitfin-tower-deck-handrail-bearing-post',steel,at(side*12.8,11.35,z),at(side*12.8,12.55,z),.12);contact('tower-deck-post-slat',post,slats[Math.round(z+10.5)]);contact('tower-deck-post-rail',post,rail);}}
  label(p.id,at,5,-15,yaw,c.component);record(p,c.base,'Splitfin Tower: unequal roof fins on visible V frames, slotted deck and bearing stair');
 }
 // A hollow annular section with finite thickness and end caps. Partial arcs
 // retain actual open spaces, useful for rib cutouts and engine casing windows.
 const annularSection=(kind:string,b:Batch,at:(a:number,b:number,c:number)=>pc.Vec3,rx:number,ry:number,inner:number,front:number,back:number,a0=0,a1=Math.PI*2,n=48)=>{const full=Math.abs(a1-a0-Math.PI*2)<1e-9,count=full?n:n+1,start=b.positions.length/3;for(let i=0;i<count;i++){const a=a0+(a1-a0)*i/n;for(const [scale,z]of [[1,front],[inner,front],[1,back],[inner,back]])b.vertex(at(Math.cos(a)*rx*scale,Math.sin(a)*ry*scale,z));}for(let i=0;i<n;i++){const a=start+i*4,c=start+((i+1)%count)*4;for(const t of [[a,c,a+2],[a+2,c,c+2],[a+1,a+3,c+1],[a+3,c+3,c+1],[a,a+1,c],[a+1,c+1,c],[a+2,c+2,a+3],[a+3,c+2,c+3]])b.indices.push(...t);}if(!full)for(const k of [0,count-1]){const i=start+k*4;b.indices.push(...(k===0?[i,i+2,i+1,i+1,i+2,i+3]:[i,i+1,i+2,i+1,i+3,i+2]));}return bound(kind,b,start)!;};
 // ROTOR CUTAWAY COURT: nine stationary rooted blades, an exposed continuous
 // shaft, true bearing saddles, and partial casing rings on a grounded sled.
 {
  const p=plots[2],yaw=-.45,c=court(p,17.5,17.5,yaw),{at}=c,feet:AirfieldComponent[]=[];
  for(const [i,x,z]of [[0,-8,-6],[1,-8,6],[2,8,-6],[3,8,6]]){const foot=box('rotor-cutaway-court-complete-sled-foot-'+i,paleStone,at(x,.4,z),vec(3.5,.8,3.0),yaw);contact('rotor-sled-foot-apron',foot,c.component,at(x,0,z));feet.push(foot);}
  const runners:AirfieldComponent[]=[];for(const side of [-1,1]){const runner=beam('rotor-cutaway-court-grounded-sled-runner-'+side,steel,at(-10,.95,side*6),at(10,.95,side*6),.8,.9);for(const i of side<0?[0,2]:[1,3])contact('rotor-sled-runner-feet',runner,feet[i]);runners.push(runner);}
  const cross:AirfieldComponent[]=[];for(const x of [-8,5,8]){const b=beam('rotor-cutaway-court-sled-cross-tie-'+x,darkSteel,at(x,1.35,-6),at(x,1.35,6),.7);for(const runner of runners)contact('rotor-sled-cross-tie-runner',b,runner);cross.push(b);}
  const saddles:AirfieldComponent[]=[];for(const [i,x]of [[0,-6],[1,5]]){const base=box('rotor-cutaway-court-bearing-saddle-base-'+i,steel,at(x,1.45,0),vec(3.2,.6,13),yaw);for(const runner of runners)contact('rotor-saddle-base-sled',base,runner);const saddle=closedPolyhedron('rotor-cutaway-court-visible-bearing-saddle-'+i,steel,[at(x-1.4,1.5,-3),at(x+1.4,1.5,-3),at(x+1.4,1.5,3),at(x-1.4,1.5,3),at(x-.8,8.9,-1.0),at(x+.8,8.9,-1.0),at(x+.8,8.9,1.0),at(x-.8,8.9,1.0)],[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]);contact('rotor-saddle-base-bearing',saddle,base,at(x,1.5,0));saddles.push(saddle);}
  const shaft=tube('rotor-cutaway-court-continuous-central-shaft',brass,[at(-9.5,9,0),at(9.5,9,0)],[.48,.48],24),hub=tube('rotor-cutaway-court-thick-static-hub',copper,[at(-3.4,9,0),at(-1.2,9,0)],[2.1,2.1],40);contact('rotor-hub-shaft',hub,shaft,at(-2.1,9,0));for(const saddle of saddles)contact('rotor-shaft-bearing-saddle',shaft,saddle);
  for(let i=0;i<9;i++){const angle=i/9*Math.PI*2,bladeAt=(x:number,y:number,z:number)=>at(-2.2+x,9+z*Math.cos(angle)+y*Math.sin(angle),z*Math.sin(angle)-y*Math.cos(angle)),blade=wing('rotor-cutaway-court-static-rooted-fan-blade-'+i,bladeAt,[[1.8,-.2,0,.48],[3.3,.1,.2,.77],[5.7,.5,.55,.64],[7.6,.8,.7,.30]],.32,teal,5,5);for(const part of blade.parts)contact('rotor-each-blade-root-hub',part,hub);}
  const rings:AirfieldComponent[]=[];for(const [i,x]of [[0,-7],[1,-2],[2,5]]){const casingAt=(a:number,b:number,z:number)=>at(x+z,9+a,b),ring=annularSection('rotor-cutaway-court-open-casing-ring-'+i,cream,casingAt,8.45,8.45,.945,-.28,.28,-Math.PI*.68,Math.PI*.68,60);rings.push(ring);for(const side of [-1,1]){const support=beam('rotor-cutaway-court-casing-grounded-brace-'+i+'-'+side,steel,at(x,1.4,side*5.7),at(x,4.6,side*7.0),.3);contact('rotor-casing-brace-sled',support,runners[side<0?0:1]);contact('rotor-casing-ring-brace',support,ring);}}
  for(const angle of [-1.8,-1.1,0,1.1,1.8]){const rib=tube('rotor-cutaway-court-continuous-casing-rib',darkSteel,[-7,-2,5].map(x=>at(x,9+Math.cos(angle)*8.22,Math.sin(angle)*8.22)),[.17,.17,.17],10);for(const ring of rings)contact('rotor-casing-rib-ring',rib,ring);}
  label(p.id,at,-11,-10,yaw,c.component);record(p,c.base,'Rotor Cutaway Court: stationary fan, exposed shaft and paired bearing saddles');
 }
 // WING SPAR GALLERY: literal rib cutouts, two continuous spars, one joined
 // skin panel, bearing shoes and cross-tied A trestles with four broad feet.
 {
  const p=plots[3],yaw=.25,c=court(p,14,20,yaw),{at}=c,ribs:AirfieldComponent[]=[];
  for(const z of [-16,0,16]){const rx=z===0?7:5,frame=(x:number,y:number,zz:number)=>at(x,8+y,z+zz),rib=annularSection('wing-spar-gallery-literal-cutout-rib-'+z,brass,frame,rx,3,.58,-.26,.26,0,Math.PI*2,56);ribs.push(rib);}
  const spars:AirfieldComponent[]=[];for(const x of [-3,4]){const spar=beam('wing-spar-gallery-continuous-spar-'+x,steel,at(x,6.2,-18),at(x,6.2,18),.7,.7);for(const rib of ribs)contact('gallery-every-rib-both-spars',rib,spar);spars.push(spar);}
  const panelAt=(x:number,y:number,z:number)=>{const rx=7-2*z/16;return at(x*rx,y+8+3*Math.sqrt(Math.max(0,1-x*x)),z);},panel=wing('wing-spar-gallery-bearing-cutaway-skin-panel',panelAt,[[0,0,0,.82],[16,0,0,.82]],.28,cream,16,10,0);for(const rib of ribs.slice(1))for(const part of panel.parts)contact('gallery-skin-panel-two-ribs',part,rib);
  for(const z of [-11,11]){const feet:AirfieldComponent[]=[];for(const x of [-5.8,6.8]){const foot=box('wing-spar-gallery-full-trestle-foot',paleStone,at(x,.3,z),vec(3,.6,3.4),yaw);contact('gallery-trestle-foot-apron',foot,c.component,at(x,0,z));feet.push(foot);}const header=beam('wing-spar-gallery-trestle-bearing-header',brass,at(-4.5,5.8,z),at(5.5,5.8,z),.85,.85);for(const spar of spars)contact('gallery-spars-header-bearing',spar,header);const legs:AirfieldComponent[]=[];for(const [i,x,top]of [[0,-5.8,-3],[1,6.8,4]]){const leg=beam('wing-spar-gallery-A-trestle-leg',steel,at(x,.3,z),at(top,5.8,z),.55);contact('gallery-trestle-leg-foot',leg,feet[i],at(x,.3,z));contact('gallery-trestle-leg-header',leg,header,at(top,5.8,z));legs.push(leg);}const tie=beam('wing-spar-gallery-visible-trestle-cross-tie',darkSteel,at(-4.78,2.3,z),at(5.78,2.3,z),.35);for(const leg of legs)contact('gallery-trestle-cross-tie-leg',tie,leg);for(const x of [-3,4]){const shoe=box('wing-spar-gallery-spar-bearing-shoe',hubMetal,at(x,6.15,z),vec(1.3,.65,1.4),yaw);contact('gallery-spar-shoe-header',shoe,header);contact('gallery-spar-shoe-spar',shoe,spars[x<0?0:1]);}}
  label(p.id,at,-10,-10,yaw,c.component);record(p,c.base,'Wing Spar Gallery: real rib holes, continuous spars and four-footed A trestles');
 }
 airframe(plots[4],true);
 landmark=undefined;assembly=undefined;
 // True exposed union edges only. Rails retain the enlarged assembly reserve.
 for(const edge of edges){const n=Math.ceil(edge.length/1.65);for(let i=0;i<n;i++){const s=i/n*edge.length,t=(i+1)/n*edge.length,w=edge.halfWidthAt(s),wt=edge.halfWidthAt(t),sample={edgeId:edge.id,distance:s,left:tuple(point(edge,s,-w)),right:tuple(point(edge,s,w)),rendered:ownership.get(edge.id+':'+s)??false};roadSamples.push(sample);routeRoadSamples.push(sample);
  for(const side of [-1,1]){const p=point(edge,s,side*w),q=point(edge,t,side*wt),mid=p.clone().lerp(p,q,.5),other=(f:RoadFootprint)=>f.edge!==edge;if(!roadIndex.clearAt(mid.x,mid.z,p.distance(q)/2+.025,other))continue;
   if(i%5===0){const out=point(edge,s,side*(w+.27),.027),next=point(edge,t,side*(wt+.27),.027),start=paleStone.positions.length/3;if(side>0)paleStone.quad(p.clone().add(vec(0,.027,0)),out,q.clone().add(vec(0,.027,0)),next);else paleStone.quad(out,p.clone().add(vec(0,.027,0)),next,q.clone().add(vec(0,.027,0)));bound('road-exposed-upward-coping',paleStone,start,'visual-coping',false);}
   if(i%48===0){const end=Math.min(edge.length,s+10),u=point(edge,s,side*(w+4.1),.85),v=point(edge,end,side*(edge.halfWidthAt(end)+4.1),.85),middle=u.clone().lerp(u,v,.5);if(roadIndex.clearAt(middle.x,middle.z,u.distance(v)/2+3.35,other)){const b=beam('airfield-outboard-grounded-low-steel-rail',steel,u,v,.25,.28,'rail');railMembers.push({edgeId:edge.id,distance:s,side,points:facesFor(b).flat()});for(const p of [u,v]){const post=grounded('airfield-whole-footprint-rail-post',p,.40,.40,p.y+.12,darkSteel,0,'rail');contact('airfield-rail-post-beam-bearing',post,b);}}}
  }
 }}
 for(let row=0;row<2;row++)for(let col=0;col<16;col++)if((row+col)%2===0){const e=course.commonStart,s=row*.75,t=(row+1)*.75,w=e.halfWidthAt(s),start=inlay.positions.length/3;inlay.quad(point(e,s,-w+col*w/8,.033),point(e,s,-w+(col+1)*w/8,.033),point(e,t,-w+col*w/8,.033),point(e,t,-w+(col+1)*w/8,.033));bound('start-line-original-airfield-stone-inlay',inlay,start,'visual-coping',false);}
 // Original paired runway center dashes give the launch its own scale cue.
 for(let s=12;s<205;s+=18){const e=course.commonStart,start=inlay.positions.length/3;for(const lateral of [-.24,.24])inlay.quad(point(e,s,lateral-.12,.026),point(e,s,lateral+.12,.026),point(e,s+6,lateral-.12,.026),point(e,s+6,lateral+.12,.026));bound('airfield-runway-original-center-inlay',inlay,start,'visual-coping',false);}
 for(const side of [-1,1]){const e=course.commonStart,s=e.length-118,p=point(e,s,side*(e.halfWidthAt(s)+24)),top=terrainExtrema(rect(p,5.8,1.1)).high+4.1,at=local(vec(p.x,0,p.z)),posts:AirfieldComponent[]=[];for(const x of [-2,2])posts.push(grounded('airfield-wayfinding-full-footprint-stake',at(x,0,0),.42,.48,top-.1,darkSteel));const board=box('airfield-wayfinding-bearing-museum-tablet',signFace,at(0,top-.7,0),vec(5.5,1.55,.36));for(const post of posts)contact('airfield-wayfinding-board-stake-bearing',board,post);for(let i=0;i<(side<0?2:3);i++){const icon=box('airfield-wayfinding-attached-branch-glyph',inlay,at(-1.5+i*.65,top-.7,-.20),vec(.24,side<0?.58:.97,.08));contact('airfield-wayfinding-glyph-board-bearing',icon,board);}for(const sign of [-1,1]){const arrow=beam('airfield-wayfinding-attached-direction',inlay,at(side*1.87,top-.7,-.20),at(side*.93,top-.7+sign*.43,-.20),.12,.08,'detail');contact('airfield-wayfinding-arrow-board-bearing',arrow,board);}}
 // Sparse low original dry tussocks have continuous ground-seated sockets.
 for(const [i,x,z]of [[0,-310,-190],[1,-180,-360],[2,-130,75],[3,-170,265],[4,250,445],[5,560,375],[6,705,120],[7,560,-145],[8,210,-350],[9,5,-370]]){const f=foundation('airfield-low-upland-grass-'+i,oval(vec(x,0,z),1.7,1.45,0,16),.05),at=local(vec(x,f.top,z));for(let j=0;j<7;j++){const a=j/7*Math.PI*2,p=at(Math.cos(a)*.6,0,Math.sin(a)*.6),tip=at(Math.cos(a)*1.2,1.1+(j%3)*.3,Math.sin(a)*1.2),blade=tube('airfield-grounded-dry-grass-blade',grass,[p,tip],[.14,.025],5,'detail');contact('airfield-dry-grass-full-foundation',blade,f.component,p);}}
 // Append-only service architecture. All existing terrain, road, museum heroes,
 // materials and physical gameplay buffers above retain their original prefixes.
 // These founded open workshops are scenic objects, never new driving routes.
 const enrichmentAssemblies:any[]=[],enrichmentOpenings:any[]=[];
 const enrichStart=components.length;
 const composition=(id:string,recipe:()=>void)=>{
  const first=components.length,firstFoundation=foundations.length,firstContact=structuralContacts.length,firstOpening=enrichmentOpenings.length;
  recipe();
  const grouped=new Map<string,number[]>();for(let i=first;i<components.length;i++){const c=components[i],key=c.assembly??id+'-solid-'+i,list=grouped.get(key)??[];list.push(i);grouped.set(key,list);}
  const ids=new Map<number,string>();let serial=0;for(const list of grouped.values()){const key=id+'-piece-'+serial++;for(const i of list)ids.set(i,key);}
  const pieces=[...grouped.values()].map(list=>{const firstPart=components[list[0]],parts=list.map(i=>components[i]);return{...firstPart,id:ids.get(list[0]),componentIndices:list,min:[0,1,2].map(k=>Math.min(...parts.map(c=>c.min[k]))),max:[0,1,2].map(k=>Math.max(...parts.map(c=>c.max[k]))),supportOwner:[...new Set(structuralContacts.slice(firstContact).filter(q=>list.includes(q.first)).map(q=>ids.get(q.second)).filter(Boolean))]};});
  enrichmentAssemblies.push({id,pieces,groundContacts:foundations.slice(firstFoundation).map(q=>({...q,pieceId:ids.get(q.component)})),openBayWitnesses:enrichmentOpenings.slice(firstOpening),roofSeats:structuralContacts.slice(firstContact).filter(q=>q.kind==='airfield-enrichment-roof-full-seat-bearing').map(q=>({roofPieceId:ids.get(q.first),supportPieceId:ids.get(q.second),roofUnderside:facesFor(components[q.first]).slice(0,2),supportTop:facesFor(components[q.second]).slice(2,4)}))});
 };
 const serviceSite=(edge:SceneryRoadEdge,s:number,offset:number)=>{const f=edge.sample(s,offset);return{p:vec(f.p.x,0,f.p.z),yaw:Math.atan2(-f.t.z,f.t.x)};};
 const serviceWedge=(kind:string,b:Batch,at:(x:number,y:number,z:number)=>pc.Vec3,x0:number,x1:number,z0:number,z1:number,low:(z:number)=>number,high:(z:number)=>number)=>{
  const start=b.positions.length/3;for(const y of [low,high])for(const [x,z]of [[x0,z0],[x1,z0],[x1,z1],[x0,z1]])b.vertex(at(x,y(z),z));
  for(const t of [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]])b.indices.push(...t.map(i=>i+start));return bound(kind,b,start)!;
 };
 const openWorkshop=(name:string,p:pc.Vec3,yaw:number,width:number,depth:number,height:number,roofMaterial:Batch,endScreen:boolean,serviceBay=false)=>{
  const f=foundation(name+'-complete-working-pad',rect(p,width+2,depth+2,yaw),.35),at=local(vec(p.x,f.top,p.z),yaw),slope=.10,roofBottom=(z:number)=>height+slope*z;
  const seats:AirfieldComponent[]=[];
  for(const [row,z]of [-depth/2+1,0,depth/2-1].entries()){
   const beamBottom=roofBottom(z-.45)-.68,seat=serviceWedge(name+'-roof-bearing-'+row,darkSteel,at,-width/2+.25,width/2-.25,z-.45,z+.45,()=>beamBottom,roofBottom);seats.push(seat);
   const xs=row===1?[-width/2+1,width/2-1]:[-width/2+1,0,width/2-1];
   for(const [column,x]of xs.entries()){
    const shoe=box(name+'-complete-column-shoe-'+row+'-'+column,paleStone,at(x,.24,z),vec(1.5,.48,1.5),yaw);contact('airfield-enrichment-shoe-pad-bearing',shoe,f.component);
    const bottom=.48,post=box(name+'-blue-steel-column-'+row+'-'+column,steel,at(x,(bottom+beamBottom)/2,z),vec(.76,beamBottom-bottom,.76),yaw);contact('airfield-enrichment-column-shoe-bearing',post,shoe);contact('airfield-enrichment-beam-column-bearing',seat,post);
   }
  }
  const roof=serviceWedge(name+'-thick-opaque-shed-roof',roofMaterial,at,-width/2-.7,width/2+.7,-depth/2-.6,depth/2+.6,roofBottom,z=>roofBottom(z)+.42);for(const seat of seats)contact('airfield-enrichment-roof-full-seat-bearing',roof,seat);
  // A thick short end screen is seated on its complete pad; it does not fill
  // the front openings or touch the columns, roof, or other opaque surfaces.
  if(endScreen){const screen=box(name+'-founded-short-end-screen',cream,at(width/2+.45,1.8,depth/2-3.6),vec(.6,3.6,3.6),yaw);contact('airfield-enrichment-end-screen-pad-bearing',screen,f.component);}
  // The lower runway service wing is a substantial original opaque L-plan
  // workroom. Its cream lower wall and teal upper band form real thick solids,
  // seated edge-to-edge outside the columns, with broad front bays left open.
  if(serviceBay){
   const wallHeight=height-.35,lowerHeight=3.1;
   for(const [part,x,z,w,d]of [['rear',0,depth/2+.45,width+1.5,.6],['return',width/2+.45,.975,.6,depth-1.65]] as const){
    const lower=box(name+'-'+part+'-cream-service-wall',cream,at(x,lowerHeight/2,z),vec(w,lowerHeight,d),yaw);contact('airfield-enrichment-service-wall-pad-bearing',lower,f.component);
    const top=part==='return'?height-.7:wallHeight,upper=box(name+'-'+part+'-teal-service-band',teal,at(x,(lowerHeight+top)/2,z),vec(w,top-lowerHeight,d),yaw);contact('airfield-enrichment-service-band-wall-bearing',upper,lower);
   }
  }
  // Both front bays have real connected empty volume through the rear beam.
  for(const side of [-1,1]){const x=side*(width/4-.25),w=width/2-2.7,footprint=rect(at(x,0,0),w,depth-1.9,yaw),bottom=f.top+.8,top=f.top+roofBottom(-depth/2+1-.45)-.85;
   enrichmentOpenings.push({label:name+(serviceBay?'-open-front-workroom-bay-':'-literal-through-bay-')+side,corners:[...footprint.map(q=>[q.x,bottom,q.z]),...footprint.map(q=>[q.x,top,q.z])],bottom,top,width:w,depth:depth-1.9,yaw});
  }
  return{pad:f,at};
 };
 // An original mid-scale propeller overhaul cart behind the tall service bay.
 // Four faceted wheels have full flat bearing patches at both pad and deck;
 // the four swept blades meet actual octagonal hub flats without hidden overlap.
 const propellerServiceCart=(name:string,p:pc.Vec3,yaw:number)=>{
  const f=foundation(name+'-whole-maintenance-pad',rect(p,6.5,4.6,yaw),.28),at=local(vec(p.x,f.top,p.z),yaw),radius=.9,half=radius*Math.sin(Math.PI/3),wheels:AirfieldComponent[]=[];
  const angles=[0,30,60,120,150,180,210,240,300,330].map(a=>a*Math.PI/180);
  for(const [i,x,z]of [[0,-2,-1.1],[1,2,-1.1],[2,-2,1.1],[3,2,1.1]]){
   const wheel=ringLoft(name+'-flat-contact-wheel-'+i,tire,[-.24,.24].map(dz=>angles.map(a=>at(x+Math.cos(a)*radius,half+Math.sin(a)*radius,z+dz))));contact('airfield-enrichment-cart-wheel-pad-bearing',wheel,f.component);wheels.push(wheel);
  }
  const deck=box(name+'-blue-steel-working-deck',steel,at(0,half*2+.25,0),vec(5.6,.5,3.4),yaw);for(const wheel of wheels)contact('airfield-enrichment-cart-deck-wheel-bearing',deck,wheel);
  const floor=half*2+.5,stand=box(name+'-broad-propeller-service-stand',cream,at(0,(floor+6.5)/2,.45),vec(2.2,6.5-floor,.6),yaw);contact('airfield-enrichment-cart-stand-deck-bearing',stand,deck);
  const hubY=5.5,hubRadius=.8,hubFlat=hubRadius*Math.cos(Math.PI/8),hub=ringLoft(name+'-octagonal-propeller-hub',copper,[-.55,.15].map(z=>Array.from({length:8},(_,i)=>{const a=Math.PI/8+i*Math.PI/4;return at(Math.cos(a)*hubRadius,hubY+Math.sin(a)*hubRadius,z);})));contact('airfield-enrichment-propeller-hub-stand-bearing',hub,stand);
  for(let blade=0;blade<4;blade++){
   const angle=blade*Math.PI/2,cs=Math.cos(angle),sn=Math.sin(angle),outline=[[hubFlat,-.25],[hubFlat,.25],[2.2,.65],[3,.45],[2.85,-.05]],v=[-.4,0].flatMap(z=>outline.map(([x,y])=>at(x*cs-y*sn,hubY+x*sn+y*cs,z))),n=outline.length,faces=[[4,3,2,1,0],[5,6,7,8,9]];
   for(let i=0;i<n;i++){const j=(i+1)%n;faces.push([i,j,j+n,i+n]);}
   const part=closedPolyhedron(name+'-swept-spare-propeller-blade-'+blade,blade%2?brass:teal,v,faces);contact('airfield-enrichment-spare-blade-hub-flat-bearing',part,hub);
  }
 };
 composition('airfield-enrichment-runway-workshop',()=>{
  const {p,yaw}=serviceSite(course.commonStart,280,-38),at=local(p,yaw);
  openWorkshop('airfield-enrichment-runway-low-wing',at(-13.8,0,2),yaw,18,14,5.7,teal,false,true);
  openWorkshop('airfield-enrichment-runway-high-workshop',at(10,0,0),yaw,24,18,8.6,copper,false);
  foundation('airfield-enrichment-runway-loading-terrace',rect(at(-3,0,-15),32,5,yaw),.65);
 });
 composition('airfield-enrichment-perimeter-court',()=>{
  const {p,yaw}=serviceSite(course.alternates.boulevard,195,-34),at=local(p,yaw);
  openWorkshop('airfield-enrichment-perimeter-low-bay',at(-15,0,0),yaw,16,14,7.0,teal,false);
  openWorkshop('airfield-enrichment-perimeter-high-bay',at(15,0,2),yaw,18,16,10.0,copper,true);
  propellerServiceCart('airfield-enrichment-perimeter-propeller-overhaul-cart',at(15,0,14),yaw);
  foundation('airfield-enrichment-perimeter-low-apron',rect(at(-16,0,-8.75),18,1,yaw),.7);
  foundation('airfield-enrichment-perimeter-return-apron',rect(at(16,0,-8.5),20,2,yaw),.9);
  const gap=rect(at(-.5,0,0),10.5,15,yaw),bottom=terrainExtrema(gap).high+.25,top=bottom+5;
  enrichmentOpenings.push({label:'airfield-enrichment-perimeter-open-sky-court',corners:[...gap.map(q=>[q.x,bottom,q.z]),...gap.map(q=>[q.x,top,q.z])],bottom,top,width:10.5,depth:15,yaw});
 });
 composition('airfield-enrichment-return-terrace',()=>{
  const {p,yaw}=serviceSite(course.commonFinish,775,-50),at=local(p,yaw);
  openWorkshop('airfield-enrichment-return-low-shelter',at(0,0,5),yaw,22,12,6.1,copper,true);
  foundation('airfield-enrichment-return-long-terrace',rect(at(-16,0,-11),26,7,yaw),1.25);
  foundation('airfield-enrichment-return-short-terrace',rect(at(16,0,-10),22,8,yaw),1.6);
 });
 // Dev polish reuses the museum airfield's open service architecture. New
 // detail is grouped on existing pads or one complete off-road service pad.
 const polishBox=(kind:string,b:Batch,at:ReturnType<typeof local>,yaw:number,x:number,y:number,z:number,w:number,h:number,d:number)=>box('airfield-polish-'+kind,b,at(x,y,z),vec(w,h,d),yaw,'detail');
 composition('airfield-polish-runway-terminal-framing',()=>{
  const {p,yaw}=serviceSite(course.commonStart,280,-38),frame=local(p,yaw);
  for(const [name,cx,cz,width,depth,height]of [['airfield-enrichment-runway-low-wing',-13.8,2,18,14,5.7],['airfield-enrichment-runway-high-workshop',10,0,24,18,8.6]]as const){
   const origin=frame(cx,0,cz),pad=foundations.find(f=>f.kind===name+'-complete-working-pad')!,at=local(vec(origin.x,pad.top,origin.z),yaw);
   const put=(k:string,b:Batch,x:number,y:number,z:number,w:number,h:number,d:number)=>polishBox(k,b,at,yaw,x,y,z,w,h,d);
   for(const z of [-depth/2+.12,depth/2+.68])put('terminal-white-fascia',cream,0,height+.1*z+.24,z,width+1.8,.40,.23);
   for(const side of [-1,1])beam('airfield-polish-terminal-sloping-edge',cream,at(side*(width/2+.78),height+.1*(-depth/2+.12)+.24,-depth/2+.12),at(side*(width/2+.78),height+.1*(depth/2+.6)+.24,depth/2+.6),.23,.40,'detail');
   for(const z of [-depth*.32,0,depth*.32])put('terminal-roof-rib',hubMetal,0,height+.1*z+.49,z,width+1.5,.14,.18);
   for(const x of [-width/2+1,0,width/2-1]){
    put('terminal-column-capital',hubMetal,x,height+.1*(-depth/2+1)-.85,-depth/2+1,1.12,.30,1.12);
    put('terminal-column-foot-collar',cream,x,.52,-depth/2+1,1.25,.20,1.25);
   }
   if(name.endsWith('low-wing')){
    // Recessed deep-blue panels attach to the existing solid rear service band.
    // The front bays and their original witness volumes stay geometrically open.
    for(const x of [-6,-2,2,6]){
     put('terminal-window-frame',cream,x,4.14,depth/2+.77,3.5,1.30,.12);
     put('terminal-blue-window',signFace,x,4.14,depth/2+.85,3.12,.98,.07);
     put('terminal-window-mullion',hubMetal,x,4.14,depth/2+.91,.10,1.08,.08);
    }
   }
  }
 });
 composition('airfield-polish-control-deck-crown',()=>{
  const p=plots[1],pad=foundations.find(f=>f.kind===p.id+'-continuous-apron')!,yaw=.18,at=local(vec(p.x,pad.top,p.z),yaw);
  const put=(k:string,b:Batch,x:number,y:number,z:number,w:number,h:number,d:number)=>polishBox(k,b,at,yaw,x,y,z,w,h,d);
  // Compact control pavilion bears on the existing deck. It occupies only a
  // small part of the upper platform and leaves the stairs/outer view walk open.
  const cx=2,cz=-3,base=11.54;
  put('control-pavilion-sill',cream,cx,base+.17,cz,5.6,.34,4.5);
  for(const x of [-2.4,2.4])for(const z of [-1.85,1.85])put('control-pavilion-upright',cream,cx+x,base+2.16,cz+z,.22,3.64,.22);
  for(const z of [-1.85,1.85]){
   put('control-pavilion-lintel',cream,cx,base+4.07,cz+z,5.12,.22,.25);
   put('control-blue-glass',signFace,cx,base+2.13,cz+z,4.57,3.36,.09);
   for(const x of [-.8,.8])put('control-glass-mullion',hubMetal,cx+x,base+2.13,cz+z-.08,.10,3.40,.14);
  }
  for(const x of [-2.4,2.4]){put('control-side-glass',signFace,cx+x,base+2.13,cz,.09,3.36,3.42);put('control-side-lintel',cream,cx+x,base+4.07,cz,.25,.22,3.52);}
  put('control-crown-roof',cream,cx,base+4.38,cz,6.15,.40,4.98);
  put('control-crown-rim',steel,cx,base+4.61,cz,5.9,.10,4.73);
  put('beacon-pedestal',hubMetal,cx,base+4.97,cz,1.15,.62,1.15);
  put('beacon-amber-lens',brass,cx,base+5.48,cz,.66,.40,.66);
  put('beacon-weather-cap',cream,cx,base+5.76,cz,.98,.15,.98);
 });
 composition('airfield-polish-ground-service-train',()=>{
  const {p,yaw}=serviceSite(course.commonStart,280,-38),frame=local(p,yaw),q=frame(-13,0,17);
  const pad=foundation('airfield-polish-ground-service-pad',rect(q,21,9,yaw),.18),at=local(vec(q.x,pad.top,q.z),yaw);
  const put=(k:string,b:Batch,x:number,y:number,z:number,w:number,h:number,d:number)=>polishBox(k,b,at,yaw,x,y,z,w,h,d);
  const wheel=(x:number,z:number,r:number)=>{
   ringLoft('airfield-polish-service-wheel',tire,[-.16,.16].map(d=>Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return at(x+Math.cos(a)*r,r+Math.sin(a)*r,z+d);}))); 
   ringLoft('airfield-polish-service-wheel-hub',hubMetal,[-.185,.185].map(d=>Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return at(x+Math.cos(a)*r*.47,r+Math.sin(a)*r*.47,z+d);}))); 
  };
  for(const cx of [-5.1,.5]){
   for(const x of [-1.55,1.55])for(const side of [-1,1])wheel(cx+x,side*1.25,.46);
   put('luggage-cart-chassis',steel,cx,1.08,0,4.3,.32,2.25);
   put('luggage-cart-deck',hubMetal,cx,1.30,0,4.4,.13,2.36);
   for(const side of [-1,1]){
    for(const x of [-1.98,1.98])put('cart-rail-post',steel,cx+x,1.85,side*1.1,.12,1.1,.12);
    put('cart-open-side-rail',cream,cx,2.35,side*1.1,4.1,.14,.15);
   }
   for(const [i,x]of [-1.12,1.05].entries()){
    put('luggage-case',i?teal:cream,cx+x,1.91,0,1.65,1.10,1.62);
    for(const z of [-.48,.48])put('luggage-case-strap',steel,cx+x,1.93,z,1.69,1.14,.10);
    put('luggage-case-handle',brass,cx+x,2.54,0,.55,.16,.14);
   }
   put('cart-drawbar',steel,cx+2.6,1.0,0,1.3,.16,.20);
  }
  // Short low tow tractor, with modeled fenders and a separate blue cab.
  const cx=6.6;
  for(const x of [-1.1,1.1])for(const side of [-1,1])wheel(cx+x,side*1.04,.58);
  put('tow-tractor-chassis',steel,cx,1.15,0,3.6,.28,1.9);
  put('tow-tractor-body',cream,cx,1.72,0,3.25,.86,1.76);
  for(const side of [-1,1])put('tow-tractor-fender',cream,cx,1.58,side*1.07,3.38,.18,.38);
  put('tow-tractor-cab-glass',signFace,cx+.6,2.70,0,1.30,1.1,1.55);
  for(const x of [.0,1.2])for(const side of [-1,1])put('tow-cab-pillar',cream,cx+x,2.68,side*.82,.13,1.3,.13);
  put('tow-cab-roof',cream,cx+.6,3.40,0,1.8,.22,1.96);
  put('tow-tractor-amber-beacon',brass,cx+.6,3.69,0,.28,.36,.28);
  for(const side of [-1,1])put('tow-tractor-headlight',inlay,cx+1.67,1.80,side*.58,.10,.24,.32);
  put('tow-tractor-bumper',steel,cx+1.78,1.22,0,.22,.34,2.04);
 });

 // Reveal targets are actual emitted triangle centroids.
 for(const sight of sightlines){const seed=[...sight.target];let best=Infinity;for(const c of components.filter(c=>c.landmark===sight.targetId))for(const face of facesFor(c)){const p=[0,1,2].map(k=>(face[0][k]+face[1][k]+face[2][k])/3),d=p.reduce((n,v,k)=>n+(v-seed[k])**2,0);if(d<best){best=d;sight.target=p;}}}
 // Exact non-road triangle provenance preserves roof slots, engine openings,
 // rib holes, wheels and every real beam, rail, sign and wing.
 meshBlock('airfield-actual-source-shoulder-triangles',shoulderFaces.map(f=>f.points));
 meshBlock('airfield-actual-open-hangar-triangles',components.filter(c=>c.kind.startsWith('hangar-')).flatMap(facesFor));
 for(const p of plots)meshBlock('airfield-actual-'+p.id,components.filter(c=>c.landmark===p.id).flatMap(facesFor));
 meshBlock('airfield-actual-other-source-triangles',components.slice(0,enrichStart).filter(c=>!c.landmark&&!c.kind.startsWith('hangar-')&&c.role!=='terrain'&&c.role!=='road'&&c.kind!=='source-exact-layer-owned-shoulders').flatMap(facesFor));
 for(const group of enrichmentAssemblies)meshBlock(group.id+'-exact-triangles',group.pieces.flatMap((piece:any)=>piece.componentIndices.flatMap((i:number)=>facesFor(components[i]))));
 const used=batches.filter(b=>b.indices.length),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const b of used)for(let i=0;i<b.positions.length;i++){const k=i%3;min[k]=Math.min(min[k],b.positions[i]);max[k]=Math.max(max[k],b.positions[i]);}
 const budget={batches:used.length,triangles:used.reduce((n,b)=>n+b.indices.length/3,0),vertices:used.reduce((n,b)=>n+b.positions.length/3,0)};
 if(budget.batches>24||budget.triangles>=110000||budget.vertices>=200000)throw new Error('Airfield emitted geometry budget exceeded: '+JSON.stringify({budget,batches:used.map(b=>[b.name,b.indices.length/3,b.positions.length/3])}));
 return{version:1,trackId:course.id,batches:used,roadSamples,routeRoadSamples,roadFaces,roadUndersideFaces,shoulderFaces,props,structures:[{kind:'gallery',from:hangar.from,to:hangar.to,overheadClearance:24.95}],bounds:{min,max},cameraObstacles,components,landmarks,foundations,groundedDetails,railMembers,wheelContacts,bearingPoints,structuralContacts,sightlines,landforms,terrainGrid,terrainVertices,terrainTriangles,terrainExposure,terrainPartitions,hangar,assemblies,budget,enrichmentAssemblies};
}
