import * as pc from 'playcanvas';
import {LandMeshBatch as Batch} from './land-mesh-builder';
import {footprintArea,intersectRoadFootprint,subtractRoadFootprint,sampleRoadFootprints,RoadFootprintIndex,roadFootprint,type SceneryForkCourse,type SceneryRoadEdge} from './land-road-mesh';
import type {LandSceneGeometry,LandPropPlacement} from './land-scenery';
import type {LandSceneTheme} from './land-scene';
import {cameraTerrainHeight,type CameraBlocker,type CameraHeightfield} from './land-camera';

type Component={kind:string;batch:string;vertexStart:number;vertexEnd:number;min:number[];max:number[];landmark?:string};
type Face={edgeId:string;distance:number;points:number[][]};
export interface HarvestSceneGeometry extends LandSceneGeometry {
  routeRoadSamples:{edgeId:string;distance:number;left:number[];right:number[];rendered:boolean}[];
  roadFaces:Face[];roadUndersideFaces:Face[];shoulderFaces:Face[];
  cameraObstacles:(CameraBlocker&{kind:string})[];components:Component[];
  landmarks:{kind:string;label:string;position:number[];radius:number;height:number}[];
  foundations:{kind:string;top:number;bottom:number;footprint:number[][];terrainLow:number;terrainHigh:number}[];
  groundedDetails:{kind:string;x:number;z:number;bottom:number;terrainY:number;footprint:number[][]}[];
  railMembers:{edgeId:string;distance:number;side:number;points:number[][]}[];
  trees:{position:number[];radius:number;height:number}[];
  cropRows:{kind:string;points:number[][];height:number}[];
  barn:{center:number[];portalWidth:number;headroom:number;from:number;to:number;triangles:number[][][]};
  sails:{angle:number;hub:number[];tips:number[][];slats:number}[];
  sightlines:{name:string;eye:number[];target:number[];radius:number;targetId:string}[];
  terrainGrid:CameraHeightfield;budget:{batches:number;triangles:number;vertices:number};
}
export const HARVEST_SCENE_THEME:Readonly<LandSceneTheme>=Object.freeze({
  textureLabel:'amberwind original farm textures',ambient:'#dbce9f',sky:'#dde0c4',fogStart:860,fogEnd:1900,
  cameraName:'Amberwind Harvest chase camera',sunName:'Amberwind late summer sunlight',sunColor:'#fff0c4',sunIntensity:1.6,sunEuler:[46,-32,0] as const,
});
const vec=(x:number,y:number,z:number)=>new pc.Vec3(x,y,z),tuple=(p:pc.Vec3)=>[p.x,p.y,p.z];
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const smooth=(x:number)=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
const noise=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const local=(p:pc.Vec3,yaw=0)=>{const c=Math.cos(yaw),s=Math.sin(yaw);return(x:number,y:number,z:number)=>vec(p.x+x*c+z*s,p.y+y,p.z-x*s+z*c);};
const plots=[
  {kind:'amberwind-mill',x:-205,z:25,r:35,h:56,w:29,d:29,label:'Amberwind Mill: masonry tower, open slatted sails and a supported static axle'},
  {kind:'stone-granary',x:-45.346328981244035,z:-209.77734289004638,r:19,h:21,w:29,d:22,label:'Stone Granary: recessed door, roof tiles, sacks and suspended scale pans'},
  {kind:'orchard-press',x:-298.33223835008846,z:241.56972426375236,r:17,h:17,w:24,d:21,label:'Orchard Press: timber frame, screw presses, fruit baskets and a handcart'},
  {kind:'field-silo-cluster',x:402.5564852979575,z:-47.413882819346284,r:18,h:29,w:27,d:23,label:'Field Silos: three ringed grain drums, ladders and a covered chute'},
  {kind:'harvest-market',x:-165.2363233219158,z:-440.4465763627862,r:23,h:15,w:35,d:25,label:'Harvest Market: three cloth stalls, baskets, jars and produce wagon'},
] as const;

/** Original connected farming landscape. This source is shared by the runtime,
 * camera and offline renderer; every agricultural machine remains static. */
export function buildHarvestSceneGeometry(course:SceneryForkCourse):HarvestSceneGeometry {
  const ground=new Batch('Harvest connected contour earth','#a18b55',1,'grass');
  const soil=new Batch('Harvest dark cultivated soil and road support','#79623c',1,'stone');
  const road=new Batch('Harvest packed ochre racing earth','#ad8250',.99,'asphalt');
  const paving=new Batch('Harvest pale yard pavers and coping','#d0bc86',.97,'stone');
  const stone=new Batch('Harvest warm limestone foundations','#94856a',.98,'stone');
  const paleStone=new Batch('Harvest limestone quoins and caps','#c6b892',.96,'stone');
  const timber=new Batch('Harvest structural dark oak','#73523c',.94,'wood');
  const boards=new Batch('Harvest barn warm boards','#a47445',.95,'wood');
  const cutWood=new Batch('Harvest end grain and pale rails','#c3a16b',.93,'wood');
  const roof=new Batch('Harvest muted clay roof tiles','#8c5739',.94,'stone');
  const plaster=new Batch('Harvest lime plaster masonry','#ece2c7',.96,'stone');
  const iron=new Batch('Harvest dark forged iron','#57594e',.58,'none',.58);
  const metal=new Batch('Harvest galvanized silo bands','#a3aaa0',.57,'none',.56);
  const grain=new Batch('Harvest ripe wheat rows','#dbad42',.96,'grass');
  const straw=new Batch('Harvest pale straw ears and bales','#ebc66b',.97,'grass');
  const stems=new Batch('Harvest dry crop stems','#887341',.98,'wood');
  const leaves=new Batch('Harvest olive orchard leaves','#748447',.99,'grass');
  const lightLeaves=new Batch('Harvest sunlit orchard leaves','#99a25a',.99,'grass');
  const fruit=new Batch('Harvest fruit and terracotta','#bc643e',.93,'stone');
  const canvas=new Batch('Harvest cream canopy and sail cloth','#ead8a5',.96,'wood');
  const dark=new Batch('Harvest recesses and warm joints','#473d2b',.98,'wood');
  const batches=[ground,soil,road,paving,stone,paleStone,timber,boards,cutWood,roof,plaster,iron,metal,grain,straw,stems,leaves,lightLeaves,fruit,canvas,dark];
  const edges=[course.commonStart,course.alternates.alley,course.alternates.boulevard,course.commonFinish];
  const sourceFaces=sampleRoadFootprints(edges,1.65),roadIndex=new RoadFootprintIndex(sourceFaces);
  const props:LandPropPlacement[]=[],roadSamples:HarvestSceneGeometry['roadSamples']=[],routeRoadSamples:HarvestSceneGeometry['routeRoadSamples']=[];
  const roadFaces:Face[]=[],roadUndersideFaces:Face[]=[],shoulderFaces:Face[]=[],cameraObstacles:HarvestSceneGeometry['cameraObstacles']=[],components:Component[]=[];
  const landmarks:HarvestSceneGeometry['landmarks']=[],foundations:HarvestSceneGeometry['foundations']=[],groundedDetails:HarvestSceneGeometry['groundedDetails']=[],railMembers:HarvestSceneGeometry['railMembers']=[],trees:HarvestSceneGeometry['trees']=[],cropRows:HarvestSceneGeometry['cropRows']=[],sails:HarvestSceneGeometry['sails']=[];
  let landmark:string|undefined;
  const point=(e:SceneryRoadEdge,s:number,l=0,h=0)=>e.sample(s,l).p.clone().add(vec(0,h,0));
  const meshBlock=(kind:string,triangles:number[][][])=>{if(!triangles.length)return;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const t of triangles)for(const p of t)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}cameraObstacles.push({kind,min,max,triangles});};
  const facesFor=(b:Batch,start:number,end=b.positions.length/3)=>{const out:number[][][]=[];for(let i=0;i<b.indices.length;i+=3){const ids=b.indices.slice(i,i+3);if(ids.every(k=>k>=start&&k<end))out.push(ids.map(k=>b.positions.slice(k*3,k*3+3)));}return out;};
  const bound=(kind:string,b:Batch,start:number,obstacle=false)=>{
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=start*3;i<b.positions.length;i++){const k=i%3;min[k]=Math.min(min[k],b.positions[i]);max[k]=Math.max(max[k],b.positions[i]);}
    const c={kind,batch:b.name,vertexStart:start,vertexEnd:b.positions.length/3,min,max,...(landmark?{landmark}:{})};components.push(c);
    if(obstacle)meshBlock(kind,facesFor(b,start));return c;
  };
  const box=(kind:string,b:Batch,p:pc.Vec3,size:pc.Vec3,yaw=0,obstacle=false)=>{const start=b.positions.length/3;b.box(p,size,yaw);return bound(kind,b,start,obstacle);};
  const beam=(kind:string,b:Batch,a:pc.Vec3,c:pc.Vec3,width:number,depth=width,obstacle=false)=>{
    const y=c.clone().sub(a).normalize(),x=new pc.Vec3().cross(y,vec(0,1,0));if(x.length()<.01)x.set(1,0,0);else x.normalize();const z=new pc.Vec3().cross(x,y).normalize();
    const at=(p:pc.Vec3,i:number,j:number)=>p.clone().add(x.clone().mulScalar(i*width/2)).add(z.clone().mulScalar(j*depth/2));
    const v=[at(a,-1,-1),at(a,1,-1),at(c,-1,-1),at(c,1,-1),at(a,-1,1),at(a,1,1),at(c,-1,1),at(c,1,1)],start=b.positions.length/3;
    for(const f of [[0,1,2,3],[5,4,7,6],[4,0,6,2],[1,5,3,7],[2,3,6,7],[4,5,0,1]])b.quad(v[f[0]],v[f[1]],v[f[2]],v[f[3]]);bound(kind,b,start,obstacle);return v;
  };
  const tube=(kind:string,b:Batch,path:pc.Vec3[],radii:number[],sides=12,capStart=true,capEnd=true,obstacle=false)=>{
    const start=b.positions.length/3;for(let k=0;k<path.length;k++){const axis=path[Math.min(k+1,path.length-1)].clone().sub(path[Math.max(0,k-1)]).normalize(),u=new pc.Vec3().cross(axis,Math.abs(axis.y)>.93?vec(1,0,0):vec(0,1,0)).normalize(),v=new pc.Vec3().cross(axis,u).normalize();for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2;b.vertex(path[k].clone().add(u.clone().mulScalar(Math.cos(a)*radii[k])).add(v.clone().mulScalar(Math.sin(a)*radii[k])),[j/sides,k*.28]);}}
    for(let k=0;k<path.length-1;k++)for(let j=0;j<sides;j++){const a=start+k*sides+j,c=start+k*sides+(j+1)%sides;b.indices.push(a,a+sides,c,c,a+sides,c+sides);}
    for(const [enabled,k,reverse]of [[capStart,0,true],[capEnd,path.length-1,false]] as const)if(enabled){const center=b.positions.length/3;b.vertex(path[k]);for(let j=0;j<sides;j++){const a=start+k*sides+j,c=start+k*sides+(j+1)%sides;b.indices.push(center,...(reverse?[c,a]:[a,c]));}}
    return bound(kind,b,start,obstacle);
  };
  const turned=(kind:string,b:Batch,at:(x:number,y:number,z:number)=>pc.Vec3,profile:number[][],sides=16,obstacle=false)=>tube(kind,b,profile.map(([y])=>at(0,y,0)),profile.map(([,r])=>r),sides,true,true,obstacle);
  const oval=(kind:string,b:Batch,p:pc.Vec3,r:pc.Vec3,sides=8,rings=5)=>{const start=b.positions.length/3;for(let j=0;j<=rings;j++)for(let i=0;i<sides;i++){const u=i/sides*Math.PI*2,v=j/rings*Math.PI;b.vertex(vec(p.x+Math.cos(u)*Math.sin(v)*r.x,p.y+Math.cos(v)*r.y,p.z+Math.sin(u)*Math.sin(v)*r.z),[i/sides,j/rings]);}for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){const a=start+j*sides+i,c=start+j*sides+(i+1)%sides;b.indices.push(a,c,a+sides,c,c+sides,a+sides);}return bound(kind,b,start);};
  const sightlines:HarvestSceneGeometry['sightlines']=[
    {name:'windmill above grain terraces',eye:tuple(point(course.commonStart,334.75895627672134,0,1.6)),target:[-205,77,25],radius:3,targetId:'amberwind-mill'},
    {name:'orchard descent mill reveal',eye:tuple(point(course.commonStart,873.28423376536,0,1.6)),target:[-205,77,25],radius:3,targetId:'amberwind-mill'},
    {name:'fork meadow silo reveal',eye:tuple(point(course.commonStart,course.commonStart.length-25,0,1.6)),target:[402.5564852979575,41.18,-47.413882819346284],radius:3,targetId:'field-silo-cluster'},
    {name:'market canopy home straight',eye:tuple(point(course.commonFinish,391.08262039325814,0,1.6)),target:[-165.2363233219158,18.785,-440.4465763627862],radius:3,targetId:'harvest-market'},
  ];
  const inSight=(x:number,z:number,r:number)=>sightlines.some(q=>{const dx=q.target[0]-q.eye[0],dz=q.target[2]-q.eye[2],t=clamp(((x-q.eye[0])*dx+(z-q.eye[2])*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-q.eye[0]-dx*t,z-q.eye[2]-dz*t)<r+q.radius;});

  // Authored connected agricultural contours, softened terraces and orchard
  // ridge. The whole farm has one exact triangle heightfield, not prop islands.
  const minX=-540,maxX=475,minZ=-525,maxZ=300,nx=109,nz=85,dx=(maxX-minX)/nx,dz=(maxZ-minZ)/nz;
  const support=edges.flatMap(edge=>Array.from({length:Math.ceil(edge.length/4)+1},(_,i)=>{const s=i/Math.ceil(edge.length/4)*edge.length,f=edge.sample(s),w=edge.halfWidthAt(s);return{p:f.p,w,low:f.p.y-Math.abs(f.n.y)*w};}));
  const terrainY=(x:number,z:number)=>{
    const ridge=smooth(1-Math.abs(x+270)/260)*smooth(1-Math.abs(z-15)/290),orchard=smooth(1-Math.abs(x+235)/290)*smooth(1-Math.abs(z-175)/130);
    const terrace=6*smooth((z+245)/36)+6*smooth((z+155)/32)+5*smooth((z+55)/30);
    let y=7+ridge*(11+terrace)+orchard*5+.75*Math.sin(x*.019+z*.013);
    const farm=smooth((x-85)/65)*smooth((430-x)/55)*smooth((z+275)/70)*smooth((180-z)/60);y=y+(15.96-y)*farm;
    let nearest=Infinity,target=y;for(const q of support){const d=Math.max(0,Math.hypot(x-q.p.x,z-q.p.z)-q.w);if(d<nearest){nearest=d;target=q.low-.55;}}
    y+=(target-y)*smooth(1-nearest/39);
    // Flat courtyard is wider than the complete barn; no mound fills its void.
    const barnWeight=smooth((x-232)/16)*smooth((329-x)/16)*smooth((z+51)/16)*smooth((51-z)/16);y+=(15.96-y)*barnWeight;
    return y;
  };
  const heights:number[]=[];for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++)heights.push(terrainY(minX+x*dx,minZ+z*dz));
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const x0=minX+x*dx,z0=minZ+z*dz,cell=[vec(x0,0,z0),vec(x0+dx,0,z0),vec(x0+dx,0,z0+dz),vec(x0,0,z0+dz)];let cap=Infinity;for(const f of roadIndex.query(x0,x0+dx,z0,z0+dz))if(footprintArea(intersectRoadFootprint(f.points,cell))>1e-10)cap=Math.min(cap,f.minY-.38);const i=z*(nx+1)+x;for(const j of [i,i+1,i+nx+1,i+nx+2])heights[j]=Math.min(heights[j],cap);}
  for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){const i=z*(nx+1)+x;ground.vertex(vec(minX+x*dx,heights[i],minZ+z*dz),[x*.21,z*.21]);if(x<nx&&z<nz)ground.indices.push(i,i+nx+1,i+1,i+1,i+nx+1,i+nx+2);}
  const terrainGrid:CameraHeightfield={minX,minZ,columns:nx+1,rows:nz+1,dx,dz,heights};
  cameraObstacles.push({kind:'harvest-exact-connected-terrain',min:[minX,Math.min(...heights),minZ],max:[maxX,Math.max(...heights),maxZ],heightfield:terrainGrid});
  const groundY=(x:number,z:number)=>cameraTerrainHeight(terrainGrid,x,z)??terrainY(x,z);
  const terrainExtrema=(polygon:pc.Vec3[])=>{const x0=clamp(Math.floor((Math.min(...polygon.map(p=>p.x))-minX)/dx),0,nx-1),x1=clamp(Math.floor((Math.max(...polygon.map(p=>p.x))-minX)/dx),0,nx-1),z0=clamp(Math.floor((Math.min(...polygon.map(p=>p.z))-minZ)/dz),0,nz-1),z1=clamp(Math.floor((Math.max(...polygon.map(p=>p.z))-minZ)/dz),0,nz-1);let low=Infinity,high=-Infinity;const v=(i:number)=>vec(...ground.positions.slice(i*3,i*3+3) as [number,number,number]);for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const i=z*(nx+1)+x;for(const t of [[i,i+nx+1,i+1],[i+1,i+nx+1,i+nx+2]])for(const p of intersectRoadFootprint(t.map(v),polygon)){low=Math.min(low,p.y);high=Math.max(high,p.y);}}return{low,high};};
  const rect=(p:pc.Vec3,w:number,d:number,yaw=0)=>{const at=local(p,yaw);return[at(-w/2,0,-d/2),at(w/2,0,-d/2),at(w/2,0,d/2),at(-w/2,0,d/2)];};
  const foundation=(kind:string,p:pc.Vec3,w:number,d:number,yaw=0,top?:number)=>{const footprint=rect(p,w,d,yaw),ext=terrainExtrema(footprint),bottom=ext.low-.22;yaw=yaw||0;p.y=top??ext.high+.16;box(kind+'-continuous-foundation',stone,vec(p.x,(p.y-.12+bottom)/2,p.z),vec(w,p.y-.12-bottom,d),yaw);box(kind+'-foundation-cap',paleStone,vec(p.x,p.y-.06,p.z),vec(w,.12,d),yaw);foundations.push({kind,top:p.y,bottom,footprint:footprint.map(tuple),terrainLow:ext.low,terrainHigh:ext.high});return local(p,yaw);};
  const grounded=(kind:string,x:number,z:number,w:number,d:number,top:number,b:Batch=stone,yaw=0)=>{const footprint=rect(vec(x,0,z),w,d,yaw),bottom=terrainExtrema(footprint).low-.10;box(kind,b,vec(x,(top+bottom)/2,z),vec(w,top-bottom,d),yaw);groundedDetails.push({kind,x,z,bottom,terrainY:groundY(x,z),footprint:footprint.map(tuple)});return bottom;};

  // Exact spatial triangle ownership across every branch overlap, including
  // the full coplanar fork and merge lobes beyond the shared tail.
  const priority=new Map([[course.commonStart,0],[course.commonFinish,1],[course.alternates.boulevard,2],[course.alternates.alley,3]]),ownership=new Map<string,boolean>();
  for(const f of sourceFaces){let fragments=[f.points];for(const owner of roadIndex.query(f.minX,f.maxX,f.minZ,f.maxZ)){if(priority.get(owner.edge)!>=priority.get(f.edge)!)continue;fragments=fragments.flatMap(p=>subtractRoadFootprint(p,owner.points));if(!fragments.length)break;}const key=f.edge.id+':'+f.distance;ownership.set(key,(ownership.get(key)??false)||fragments.length>0);for(const poly of fragments)for(let i=1;i<poly.length-1;i++){const p=[poly[0],poly[i],poly[i+1]];if(footprintArea(p)<1e-8)continue;(f.edge===course.alternates.alley?paving:road).tri(...p as [pc.Vec3,pc.Vec3,pc.Vec3]);const under=[p[2],p[1],p[0]].map(q=>q.clone().add(vec(0,-.22,0)));soil.tri(...under as [pc.Vec3,pc.Vec3,pc.Vec3]);roadFaces.push({edgeId:f.edge.id,distance:f.distance,points:p.map(tuple)});roadUndersideFaces.push({edgeId:f.edge.id,distance:f.distance,points:under.map(tuple)});}}
  // Shoulders are source-affine ribbons blending to the actual terrain at 8 m.
  // Their complete polygons are clipped by roads AND earlier shoulder owners.
  const rawShoulders=edges.flatMap(edge=>{const out:ReturnType<typeof roadFootprint>[]=[],n=Math.ceil(edge.length/1.65);for(let i=0;i<n;i++){const s=i/n*edge.length,t=(i+1)/n*edge.length;for(const side of [-1,1]){const a=point(edge,s,side*edge.halfWidthAt(s)),b=point(edge,t,side*edge.halfWidthAt(t)),c=point(edge,s,side*(edge.halfWidthAt(s)+8)),d=point(edge,t,side*(edge.halfWidthAt(t)+8));c.y=groundY(c.x,c.z)-.03;d.y=groundY(d.x,d.z)-.03;for(const tri of [[a,c,b],[b,c,d]])out.push(roadFootprint(edge,s,tri));}}return out;}),shoulderIndex=new RoadFootprintIndex(rawShoulders),shoulderOrder=new Map(rawShoulders.map((f,i)=>[f,i]));
  for(const f of rawShoulders){let fragments=[f.points];for(const owner of roadIndex.query(f.minX,f.maxX,f.minZ,f.maxZ)){if(footprintArea(intersectRoadFootprint(f.points,owner.points))<1e-8)continue;fragments=fragments.flatMap(p=>subtractRoadFootprint(p,owner.points));if(!fragments.length)break;}for(const owner of shoulderIndex.query(f.minX,f.maxX,f.minZ,f.maxZ)){if(owner.edge===f.edge||shoulderOrder.get(owner)!>=shoulderOrder.get(f)!||footprintArea(intersectRoadFootprint(f.points,owner.points))<1e-8)continue;fragments=fragments.flatMap(p=>subtractRoadFootprint(p,owner.points));if(!fragments.length)break;}for(const poly of fragments)for(let i=1;i<poly.length-1;i++){const p=[poly[0],poly[i],poly[i+1]];if(footprintArea(p)<1e-8)continue;if(new pc.Vec3().cross(p[1].clone().sub(p[0]),p[2].clone().sub(p[0])).y<0)[p[1],p[2]]=[p[2],p[1]];soil.tri(...p as [pc.Vec3,pc.Vec3,pc.Vec3]);shoulderFaces.push({edgeId:f.edge.id,distance:f.distance,points:p.map(tuple)});}}
  meshBlock('exact-source-shoulder-triangles',shoulderFaces.map(f=>f.points));
  for(const edge of edges){const n=Math.ceil(edge.length/1.65);for(let i=0;i<n;i++){const s=i/n*edge.length,t=(i+1)/n*edge.length,w=edge.halfWidthAt(s),wt=edge.halfWidthAt(t),a=point(edge,s,-w),b=point(edge,s,w),sample={edgeId:edge.id,distance:s,left:tuple(a),right:tuple(b),rendered:ownership.get(edge.id+':'+s)??false};roadSamples.push(sample);routeRoadSamples.push(sample);
    for(const side of [-1,1]){const p=point(edge,s,side*w),q=point(edge,t,side*wt),mid=p.clone().lerp(p,q,.5),other=(f:typeof sourceFaces[number])=>f.edge!==edge;if(!roadIndex.clearAt(mid.x,mid.z,p.distance(q)/2+.025,other))continue;const out=point(edge,s,side*(w+.36),.024),next=point(edge,t,side*(wt+.36),.024);const copingStart=paving.positions.length/3;if(side>0)paving.quad(p.clone().add(vec(0,.024,0)),out,q.clone().add(vec(0,.024,0)),next);else paving.quad(out,p.clone().add(vec(0,.024,0)),next,q.clone().add(vec(0,.024,0)));bound('road-edge-coping',paving,copingStart);
      if(i%20===0){const end=Math.min(edge.length,s+10.5),u=point(edge,s,side*(w+.68),1.02),v=point(edge,end,side*(edge.halfWidthAt(end)+.68),1.02),middle=u.clone().lerp(u,v,.5);if(roadIndex.clearAt(middle.x,middle.z,u.distance(v)/2+.20,other)){const points=beam('exposed-farm-road-rail',cutWood,u,v,.22,.27);railMembers.push({edgeId:edge.id,distance:s,side,points:points.map(tuple)});grounded('road-rail-grounded-post',u.x,u.z,.30,.30,u.y+.3,timber);}}}
    if(i%4===0&&ownership.get(edge.id+':'+s)){const h=.027;for(const side of [-1,1]){const l=side*w*.48;dark.quad(point(edge,s,l-.06,h),point(edge,s,l+.06,h),point(edge,t,l-.06,h),point(edge,t,l+.06,h));}}
  }}
  meshBlock('exact-exposed-farm-rail-triangles',components.filter(c=>c.kind==='exposed-farm-road-rail'||c.kind==='road-rail-grounded-post').flatMap(c=>facesFor(batches.find(b=>b.name===c.batch)!,c.vertexStart,c.vertexEnd)));
  for(let row=0;row<2;row++)for(let col=0;col<16;col++)if((row+col)%2===0){const e=course.commonStart,s=row*.7,t=(row+1)*.7,w=e.halfWidthAt(s);canvas.quad(point(e,s,-w+col*w/8,.03),point(e,s,-w+(col+1)*w/8,.03),point(e,t,-w+col*w/8,.03),point(e,t,-w+(col+1)*w/8,.03));}

  // Real drive-through timber barn: two side strips and thin roof members.
  // No complete building box, loft, threshold or hanging ornament fills it.
  landmark='open-threshing-barn';const barnStart=components.length;
  for(const side of [-1,1]){const x=280.6+side*25,p=vec(x,16,0);foundation('barn-side-plinth',p,2,52,0,17);
    for(const z of [-24,-12,0,12,24]){
      box('barn-load-bearing-post',timber,vec(x,25.55,z),vec(1.65,17.3,1.65));
      for(const y of [17.35,33.75])box('barn-post-iron-strap',iron,vec(x,y,z),vec(1.74,.25,1.74));
      for(const dir of [-1,1])if(Math.abs(z+dir*3.8)<26)beam('barn-in-wall-diagonal-brace',cutWood,vec(x,29,z),vec(x,33.75,z+dir*3.8),.5,.5);
    }
    box('barn-continuous-wall-plate',timber,vec(x,33.65,0),vec(1.8,.8,52));
    for(let i=0;i<56;i++){const z=-25.5+i*.927,w=.73+.10*noise(i+side*100);box('barn-recessed-side-plank',boards,vec(x+side*.60,23.2,z),vec(.35,12.4,w));if(i%4===0){for(const y of [18.1,28.4])box('barn-plank-nail-plate',iron,vec(x+side*.79,y,z),vec(.07,.15,.19));}}
    // Tools sit in front of the inside face, entirely in the 2 m side bay.
    const toolX=x-side*.63;
    for(const z of [-18,6,18]){
      box('barn-tool-supported-rack',cutWood,vec(x-side*.39,23,z),vec(.23,3.2,5.4));for(const dz of [-1.8,1.8])beam('barn-rack-wall-bracket',iron,vec(x+side*.55,23.6,z+dz),vec(x-side*.45,23.6,z+dz),.18,.18);
      for(const dz of [-1.5,1.5]){tube('barn-tool-peg',iron,[vec(x-side*.29,24,z+dz),vec(toolX,24,z+dz)],[.10,.10],8);beam('barn-visible-fork-handle',cutWood,vec(toolX,20.8,z+dz),vec(toolX,24.5,z+dz),.18,.18);beam('barn-visible-fork-crossbar',iron,vec(toolX,24.45,z+dz-.45),vec(toolX,24.45,z+dz+.45),.14,.14);for(const tooth of [-.4,0,.4])beam('barn-visible-fork-tine',iron,vec(toolX,24.45,z+dz+tooth),vec(toolX,25.35,z+dz+tooth),.11,.11);}
      box('barn-recessed-feed-shelf',timber,vec(x-side*.48,18.0,z),vec(.75,.25,6));for(let i=0;i<4;i++)oval('barn-visible-feed-sack',straw,vec(x-side*.48,18.58,z-2.1+i*1.4),vec(.31,.47,.51),8,3);
    }
  }
  for(const z of [-24,-12,0,12,24]){
    box('barn-post-seated-tie-beam',timber,vec(280.6,34.45,z),vec(51.8,.9,1.3));
    for(const side of [-1,1])beam('barn-tie-seated-rafter',cutWood,vec(280.6+side*25.4,34.85,z),vec(280.6,42.35,z),.85,.80);
    box('barn-ridge-truss-kingpost',timber,vec(280.6,38.63,z),vec(.65,8.06,.65));
  }
  box('barn-continuous-supported-ridge',timber,vec(280.6,42.33,0),vec(1.15,.75,56));
  for(const side of [-1,1]){
    const start=roof.positions.length/3,a=vec(280.6+side*26,34.94,-28),b=vec(280.6,42.60,-28),c=vec(280.6+side*26,34.94,28),d=vec(280.6,42.60,28),v=[a,b,c,d,...[a,b,c,d].map(p=>p.clone().add(vec(0,.28,0)))];
    for(const f of [[0,1,2,3],[5,4,7,6],[4,0,6,2],[1,5,3,7],[2,3,6,7],[4,5,0,1]])roof.quad(v[f[0]],v[f[1]],v[f[2]],v[f[3]]);bound('barn-thin-pitched-roof-shell',roof,start);
    for(let i=0;i<12;i++){const x=280.6+side*(1+i*2.12),y=42.6-(Math.abs(x-280.6)/26)*7.66+.32;box('barn-raised-roof-seam',boards,vec(x,y,0),vec(.12,.12,56));}
    for(const z of [-27.8,27.8])beam('barn-roof-edge-trim',cutWood,vec(280.6+side*25.8,35.13,z),vec(280.6,42.74,z),.25,.25);
    box('barn-warm-eave-gap',canvas,vec(280.6+side*24.9,34.97,0),vec(.24,.07,50));
  }
  const barnTriangles=components.slice(barnStart).flatMap(c=>facesFor(batches.find(b=>b.name===c.batch)!,c.vertexStart,c.vertexEnd));meshBlock('barn-exact-architecture-triangles',barnTriangles);
  const barn:HarvestSceneGeometry['barn']={center:[280.6,16,0],portalWidth:48,headroom:18,from:130.1148712670008,to:185.31487126720583,triangles:barnTriangles};landmark=undefined;

  // Compact detail helpers preserve physical contact to their host decks.
  const crate=(at:(x:number,y:number,z:number)=>pc.Vec3,x:number,y:number,z:number,w=2.5,d=2.1)=>{box('produce-crate-bottom',boards,at(x,y+.13,z),vec(w,.26,d));for(const side of [-1,1]){for(let row=0;row<3;row++)box('produce-crate-open-side-slat',cutWood,at(x+side*(w/2-.09),y+.45+row*.32,z),vec(.18,.20,d));for(let row=0;row<3;row++)box('produce-crate-open-end-slat',boards,at(x,y+.45+row*.32,z+side*(d/2-.09)),vec(w,.20,.18));}for(let i=0;i<5;i++)oval('crate-visible-fruit',fruit,at(x+((i%3)-1)*w*.26,y+.9,z+(i<3?-.34:.34)),vec(.31,.28,.29),6,3);};
  const barrel=(at:(x:number,y:number,z:number)=>pc.Vec3,x:number,y:number,z:number,r=1,h=2.3)=>{turned('farm-staved-barrel',boards,local(at(x,y,z)),[[0,r*.84],[h*.25,r],[h*.75,r],[h,r*.84]],12);for(const yy of [h*.15,h*.85])turned('barrel-raised-iron-hoop',iron,local(at(x,y+yy,z)),[[0,r*.97],[.13,r*.97]],12);};
  const wheel=(at:(x:number,y:number,z:number)=>pc.Vec3,x:number,y:number,z:number,r:number)=>{const center=at(x,y,z),path=Array.from({length:17},(_,i)=>{const a=i/16*Math.PI*2;return at(x,y+Math.cos(a)*r,z+Math.sin(a)*r);});tube('cart-open-wheel-rim',iron,path,path.map(()=>.16),6,false,false);tube('cart-wheel-hub',iron,[at(x-.3,y,z),at(x+.3,y,z)],[.31,.31],10);for(let i=0;i<8;i++){const a=i/8*Math.PI*2;beam('cart-joined-wheel-spoke',cutWood,center,at(x,y+Math.cos(a)*r,z+Math.sin(a)*r),.14,.14);}};
  const wagon=(at:(x:number,y:number,z:number)=>pc.Vec3,x:number,z:number)=>{const r=1.25;for(const zz of [-2.1,2.1]){beam('wagon-wheel-axle',iron,at(x-2.5,r,z+zz),at(x+2.5,r,z+zz),.23,.23);for(const side of [-1,1])wheel(at,x+side*2.4,r,z+zz,r);}box('wagon-supported-bed',boards,at(x,1.9,z),vec(4.9,.6,6.3));for(const side of [-1,1])for(let row=0;row<3;row++)box('wagon-raised-side-rail',cutWood,at(x+side*2.25,2.5+row*.40,z),vec(.20,.22,6));for(const zz of [-2.6,2.6])box('wagon-end-frame',timber,at(x,2.7,z+zz),vec(4.6,1.5,.2));beam('wagon-ground-resting-shaft',timber,at(x,1.7,z-2.8),at(x,.18,z-8.1),.28,.28);crate(at,x-1.2,2.2,z-1,1.8,2.1);crate(at,x+1,2.2,z+1,1.8,2.1);};
  const shelterRoof=(at:(x:number,y:number,z:number)=>pc.Vec3,w:number,d:number,eave:number,peak:number,b:Batch,kind:string)=>{for(const side of [-1,1]){const start=b.positions.length/3,a=at(side*w/2,eave,-d/2),c=at(side*w/2,eave,d/2),q=at(0,peak,-d/2),r=at(0,peak,d/2);for(const [p0,p1,p2,p3]of [[a,q,c,r],[q.clone().add(vec(0,.25,0)),a.clone().add(vec(0,.25,0)),r.clone().add(vec(0,.25,0)),c.clone().add(vec(0,.25,0))]])b.quad(p0,p1,p2,p3);b.quad(a,a.clone().add(vec(0,.25,0)),c,c.clone().add(vec(0,.25,0)));bound(kind,b,start);}};
  for(const plot of plots){landmark=plot.kind;const p=vec(plot.x,0,plot.z),at=foundation(plot.kind,p,plot.w,plot.d),first=components.length;
    const put=(kind:string,b:Batch,x:number,y:number,z:number,w:number,h:number,d:number)=>box(kind,b,at(x,y,z),vec(w,h,d));
    const strut=(kind:string,b:Batch,a:number[],c:number[],w:number,d=w)=>beam(kind,b,at(...a as [number,number,number]),at(...c as [number,number,number]),w,d);
    if(plot.kind==='amberwind-mill'){
      turned('mill-stepped-masonry-foot',paleStone,at,[[0,13.7],[.8,13.7],[1.3,12.5],[2.1,12.5]],32);
      // Hollow tapered octagonal tower: window apertures are omissions in the
      // wall panels, with independent dark reveals behind a stone casing.
      for(let face=0;face<8;face++){
        const a=face*Math.PI/4+Math.PI/8,b=(face+1)*Math.PI/4+Math.PI/8,wallPoint=(u:number,y:number,depth=0)=>{const r=11.2-y*.145-depth;return at((Math.cos(a)*(1-u)+Math.cos(b)*u)*r,y,(Math.sin(a)*(1-u)+Math.sin(b)*u)*r);};
        const panel=(u:number,v:number,lo:number,hi:number)=>{const start=plaster.positions.length/3,P=[wallPoint(u,lo),wallPoint(v,lo),wallPoint(u,hi),wallPoint(v,hi),wallPoint(u,lo,.5),wallPoint(v,lo,.5),wallPoint(u,hi,.5),wallPoint(v,hi,.5)];for(const f of [[0,1,2,3],[5,4,7,6],[4,0,6,2],[1,5,3,7],[2,3,6,7],[4,5,0,1]])plaster.quad(P[f[0]],P[f[1]],P[f[2]],P[f[3]]);bound('mill-tapered-window-wall-panel',plaster,start);};
        for(const [lo,hi]of [[2.0,9],[13,21],[25,31.6]])panel(0,1,lo,hi);for(const [lo,hi]of [[9,13],[21,25]]){panel(0,.34,lo,hi);panel(.66,1,lo,hi);const back=dark.positions.length/3;dark.quad(wallPoint(.34,lo,.54),wallPoint(.66,lo,.54),wallPoint(.34,hi,.54),wallPoint(.66,hi,.54));bound('mill-recessed-window-back',dark,back);for(const u of [.34,.66])beam('mill-window-stone-jamb',paleStone,wallPoint(u,lo,-.04),wallPoint(u,hi,-.04),.22);for(const y of [lo,hi])beam('mill-window-stone-lintel',paleStone,wallPoint(.32,y,-.04),wallPoint(.68,y,-.04),.25);beam('mill-window-crossbar',cutWood,wallPoint(.5,lo,.10),wallPoint(.5,hi,.10),.12);}
      }
      turned('mill-tower-top-collar',stone,at,[[31.2,7],[32.2,7],[32.65,8]],24);
      turned('mill-faceted-oak-cap',timber,at,[[32.2,8.3],[34.5,7.6],[38.3,.8]],16);
      // Axle explicitly penetrates a transverse bearing carried by two
      // uprights seated in the tower collar. Sails are static, not hazards.
      for(const x of [-4,4])put('mill-bearing-support-upright',cutWood,x,32.6,-5.2,.85,4.8,1.2);
      put('mill-supported-axle-crossmember',timber,0,34,-5.2,8.6,1.4,1.7);
      tube('mill-static-hub-axle',iron,[at(0,34,-4.5),at(0,34,-12.4)],[.75,.75],20);
      tube('mill-raised-iron-hub',iron,[at(0,34,-12.2),at(0,34,-13.05)],[1.75,1.75],24);
      for(let k=0;k<4;k++){const angle=Math.PI/7+k*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle),sail=(u:number,v:number,z=-12.7)=>at(c*u-s*v,34+s*u+c*v,z);for(const v of [-.8,2.8])beam('mill-sail-continuous-spar',cutWood,sail(.4,v),sail(19,v),.28,.28);for(let j=0;j<12;j++){const u=2+j*1.45;beam('mill-sail-separate-slat',boards,sail(u,-.92),sail(u,2.94),.19,.20);if(j<7&&j%2===0){const start=canvas.positions.length/3;canvas.quad(sail(u+.15,-.62,-12.78),sail(u+1.16,-.62,-12.78),sail(u+.15,2.61,-12.78),sail(u+1.16,2.61,-12.78));bound('mill-sail-partial-cloth-panel',canvas,start);}}beam('mill-sail-diagonal-tension',iron,sail(1,-.8),sail(18.8,2.8),.085,.085);sails.push({angle,hub:tuple(at(0,34,-12.7)),tips:[tuple(sail(19,-.8)),tuple(sail(19,2.8))],slats:12});}
      strut('mill-grounded-loading-ramp',boards,[0,.1,14],[-7,2,8],3.6,.5);
      put('mill-rear-door-recess',dark,0,4.9,10.1,3.1,5.6,.25);for(let i=0;i<5;i++)put('mill-rear-door-board',boards,-1.17+i*.58,4.9,10.3,.5,5.3,.19);
      strut('mill-weather-vane-stem',iron,[0,38.1,0],[0,41,0],.14);strut('mill-weather-vane-arrow',iron,[-2.5,40.7,0],[2.5,40.7,0],.13);put('mill-weather-vane-tail',metal,-1.7,40.7,0,1.1,.75,.08);
      barrel(at,10,.05,-5,.85,2.2);
    }else if(plot.kind==='stone-granary'){
      put('granary-solid-plaster-body',plaster,-3,6.4,0,18,12.8,17);for(const x of [-12,6])for(const z of [-8.5,8.5])for(let row=0;row<6;row++)put('granary-staggered-corner-quoin',paleStone,x,1.05+row*2.1,z,1.7+(row%2)*.45,1.85,1.65);
      shelterRoof(local(at(-3,0,0)),20,19,13,18,roof,'granary-pitched-tile-roof');for(const z of [-7.5,7.5])for(const side of [-1,1])strut('granary-wall-seated-roof-rafter',timber,[-3+side*9,13.1,z],[-3,17.95,z],.95,.95);for(let i=0;i<20;i++)for(const side of [-1,1])strut('granary-roof-raised-tile-row',boards,[-3+side*9.8,13.3,-9+i*.95],[-3,18.25,-9+i*.95],.12,.18);
      put('granary-recessed-door-opening',dark,-3,4.8,-8.57,6.4,9.6,.12);for(let i=0;i<7;i++)put('granary-sliding-door-plank',boards,4.4+i*.6,4.8,-8.8,.51,9.5,.35);strut('granary-sliding-door-top-track',iron,[-6,10,-9],[9,10,-9],.24,.24);
      for(const x of [-9,3]){put('granary-window-dark-recess',dark,x,9,-8.62,2.2,2.5,.12);strut('granary-window-crossbar',cutWood,[x-1.15,9,-8.76],[x+1.15,9,-8.76],.14);strut('granary-window-crossbar',cutWood,[x,7.7,-8.76],[x,10.3,-8.76],.14);}
      for(const z of [-8,8]){put('granary-porch-post',timber,12,5.1,z,.65,10.2,.65);strut('granary-porch-support-beam',timber,[6,10,z],[12.7,10,z],.55);}
      put('granary-porch-flat-roof',boards,9.3,10.35,0,7.1,.5,17);for(const x of [8,10.6])barrel(at,x,.02,4,1,2.7);
      put('grain-scale-stone-plinth',stone,9,.5,-3,3,1,2.6);strut('grain-scale-supported-column',iron,[9,1,-3],[9,4.8,-3],.25);strut('grain-scale-horizontal-balance',iron,[6.5,4.8,-3],[11.5,4.8,-3],.18);for(const x of [6.7,11.3]){strut('grain-scale-suspension',iron,[x,4.8,-3],[x,2.9,-3],.08);turned('grain-scale-pan',metal,local(at(x,2.5,-3)),[[0,.15],[.35,.82],[.42,.85]],12);}
      for(const [x,z]of [[-9,-9.5],[-6.5,-9.5],[-11,-7]])oval('granary-filled-grain-sack',canvas,at(x,1,z),vec(.95,1,.78),10,6);
    }else if(plot.kind==='orchard-press'){
      for(const x of [-9,9])for(const z of [-8,8]){put('press-stone-post-seat',paleStone,x,.35,z,1.7,.7,1.7);put('press-load-bearing-post',timber,x,5.6,z,.9,10.7,.9);}
      for(const z of [-8,8])strut('press-post-seated-crossbeam',timber,[-9.5,10.9,z],[9.5,10.9,z],.95,.85);for(const x of [-9,9])strut('press-roof-longitudinal-beam',cutWood,[x,10.85,-8.5],[x,10.85,8.5],.7,.7);shelterRoof(at,21,19,11.1,15.6,roof,'press-supported-pitched-roof');for(const z of [-8,8])for(const side of [-1,1])strut('press-beam-seated-roof-rafter',timber,[side*9,11.5,z],[0,15.5,z],.85,.85);
      for(const x of [-5,5]){put('press-stone-basket-foot',stone,x,.5,1,5.6,1,5.6);turned('press-fruit-basket-body',boards,local(at(x,1,1)),[[0,2.35],[4.0,2.35]],20);for(const y of [1.3,2.7,4.4])turned('press-basket-raised-iron-ring',iron,local(at(x,y,1)),[[0,2.45],[.25,2.45]],20);for(const side of [-1,1])put('press-spindle-bearing-upright',timber,x+side*3,4.7,1,.75,8.8,1.2);strut('press-supported-bearing-crossbar',timber,[x-3.4,8.6,1],[x+3.4,8.6,1],.9,1.3);
        const path=Array.from({length:39},(_,i)=>at(x-3.3+i*6.6/38,7,1));tube('press-static-horizontal-threaded-spindle',cutWood,path,path.map((_,i)=>i%2?.36:.52),12);for(const side of [-1,1])tube('press-spindle-bearing-collar',iron,[at(x+side*2.85,7,1),at(x+side*3.35,7,1)],[.65,.65],12);
        put('press-supported-crushing-platen',boards,x,5.4,1,4.5,.65,4.5);strut('press-platen-screw-guide',iron,[x,5.4,1],[x,7,1],.55);for(let i=0;i<5;i++)oval('press-visible-basket-apples',fruit,at(x+(i%3-1)*.9,5.03,1+(i<3?-.8:.7)),vec(.42,.4,.4),6,3);
      }
      put('press-dry-stone-trough-floor',stone,0,.25,-5.7,8,.5,2);for(const z of [-6.7,-4.7])put('press-dry-stone-trough-rim',paleStone,0,.65,z,8,.8,.25);for(const x of [-4,4])put('press-dry-stone-trough-end',paleStone,x,.65,-5.7,.25,.8,2.2);
      crate(at,-8.4,.05,-5.7,2.3,2.2);crate(at,8.4,.05,-5.7,2.3,2.2);
      // Two-wheel handcart: both open rims touch the foundation at y0.
      for(const x of [-1.8,1.8])wheel(at,x,1,7.7,1);strut('handcart-wheel-axle',iron,[-2,1,7.7],[2,1,7.7],.2);put('handcart-supported-box',boards,0,1.7,7.3,3.6,.55,3.2);for(const x of [-1.4,1.4])strut('handcart-grounded-handle',timber,[x,1.7,7],[x,.18,3.8],.22);crate(at,0,1.98,7.3,2.8,2.5);
    }else if(plot.kind==='field-silo-cluster'){
      for(const [x,z,h,r]of [[-7,-4,25,4.5],[5,-4,20,4.6],[0,5.6,16,4.1]]){turned('silo-concrete-foot-ring',paleStone,local(at(x,0,z)),[[0,r+.6],[.8,r+.6]],24);turned('silo-faceted-grain-body',metal,local(at(x,.8,z)),[[0,r],[h-4,r]],24);turned('silo-conical-roof',iron,local(at(x,h-3.2,z)),[[0,r+.2],[3.1,.15]],24);for(let y=2;y<h-3;y+=3){turned('silo-raised-horizontal-band',iron,local(at(x,y,z)),[[0,r+.10],[.16,r+.10]],24);for(let i=0;i<4;i++){const a=i/4*Math.PI*2;oval('silo-visible-seam-bolt',paleStone,at(x+Math.cos(a)*(r+.12),y+.08,z+Math.sin(a)*(r+.12)),vec(.10,.10,.10),4,2);}}
        for(const xx of [-.48,.48])strut('silo-grounded-ladder-upright',iron,[x+xx,.2,z-r-.26],[x+xx,h-3.8,z-r-.26],.11);for(let y=.8;y<h-3.8;y+=.85)strut('silo-ladder-rung',metal,[x-.55,y,z-r-.32],[x+.55,y,z-r-.32],.11);
      }
      put('silo-low-service-shed',plaster,-9,2.2,6,6.5,4.4,6.5);put('silo-service-shed-roof',roof,-9,4.5,6,7,.3,7);put('silo-service-door',boards,-9,1.8,2.65,2.8,3.6,.16);
      tube('silo-supported-grain-chute',iron,[at(-6,4,5),at(-6,8,5),at(-2,11,5)],[.48,.48,.48],10);put('silo-chute-wall-bracket',timber,-6,4.3,5,1.5,.8,1.5);
    }else{
      for(const [x,z,w,h]of [[-11,0,10,8],[0,2,10,9.3],[11,0,10,7.3]]){for(const xx of [-w/2+.5,w/2-.5])for(const zz of [-4.6,4.6]){put('market-post-stone-seat',paleStone,x+xx,.25,z+zz,1.1,.5,1.1);put('market-canopy-upright',timber,x+xx,h/2,z+zz,.42,h,.42);strut('market-seated-diagonal-brace',cutWood,[x+xx,h-2,z+zz],[x+xx-Math.sign(xx)*1.6,h-.2,z+zz],.24);}for(const zz of [-4.6,4.6])strut('market-post-seated-beam',timber,[x-w/2,h,z+zz],[x+w/2,h,z+zz],.45);shelterRoof(local(at(x,0,z)),w+1,10,h+.05,h+2.8,canvas,'market-asymmetric-cloth-roof');for(const zz of [-4.6,4.6])for(const side of [-1,1])strut('market-beam-seated-canopy-rafter',cutWood,[x+side*w/2,h+.14,z+zz],[x,h+2.74,z+zz],.62,.62);for(let i=0;i<11;i++)for(const side of [-1,1]){const xx=x-w/2+i*w/10,start=canvas.positions.length/3;canvas.tri(at(xx-.5,h+.1,z+side*5),at(xx+.5,h+.1,z+side*5),at(xx,h-.65,z+side*5));bound('market-scalloped-cloth-edge',canvas,start);}put('market-supported-weigh-table',boards,x,2.2,z-2.8,w-1,.45,2.5);for(const xx of [-w/2+1,w/2-1])put('market-table-grounded-leg',timber,x+xx,1.1,z-2.8,.35,2.2,.35);crate(at,x-2,2.43,z-2.8,2.6,2);crate(at,x+1.6,2.43,z-2.8,2.6,2);barrel(at,x+2,.02,z+2,1,2.4);turned('market-broad-earthen-jar',fruit,local(at(x-2,.02,z+2)),[[0,.7],[.5,1.1],[1.6,1.3],[2.7,.6],[2.9,.7]],16);}
      wagon(at,0,-3.5);
    }
    const parts=components.slice(first);meshBlock(plot.kind+'-exact-solid-triangles',parts.flatMap(c=>facesFor(batches.find(b=>b.name===c.batch)!,c.vertexStart,c.vertexEnd)));
    props.push({kind:plot.kind,x:p.x,y:p.y,z:p.z,radius:plot.r});landmarks.push({kind:plot.kind,label:plot.label,position:tuple(p),radius:plot.r,height:plot.h});landmark=undefined;
  }

  // Aim authored reveals at actual emitted surfaces, not provisional design air.
  for(const sight of sightlines){const plot=landmarks.find(p=>p.kind===sight.targetId)!;if(sight.targetId==='amberwind-mill')sight.target=[plot.position[0],plot.position[1]+34,plot.position[2]-13.05];else if(sight.targetId==='field-silo-cluster')sight.target=[plot.position[0]-7,plot.position[1]+24.9,plot.position[2]-4];else sight.target=[plot.position[0],plot.position[1]+12.35,plot.position[2]+2];}
  const reserved=(x:number,z:number,r:number)=>plots.some(p=>Math.hypot(p.x-x,p.z-z)<p.r+r+3)||(x>241-r&&x<320+r&&z>-40-r&&z<40+r);
  // Long contour bands make this an agricultural landscape from a distance.
  // Every crop-root polygon is clipped against emitted terrain triangles, so
  // planted strips follow triangulation rather than hovering over slopes.
  const terrainPieces=(poly:pc.Vec3[])=>{const x0=clamp(Math.floor((Math.min(...poly.map(p=>p.x))-minX)/dx),0,nx-1),x1=clamp(Math.floor((Math.max(...poly.map(p=>p.x))-minX)/dx),0,nx-1),z0=clamp(Math.floor((Math.min(...poly.map(p=>p.z))-minZ)/dz),0,nz-1),z1=clamp(Math.floor((Math.max(...poly.map(p=>p.z))-minZ)/dz),0,nz-1),out:pc.Vec3[][]=[];const v=(i:number)=>vec(...ground.positions.slice(i*3,i*3+3) as [number,number,number]);for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const i=z*(nx+1)+x;for(const t of [[i,i+nx+1,i+1],[i+1,i+nx+1,i+nx+2]]){const p=intersectRoadFootprint(t.map(v),poly);if(p.length>=3&&footprintArea(p)>1e-8)out.push(p);}}return out;};
  const fieldRegions=[{kind:'grain-terrace',x0:-400,x1:-95,z0:-160,z1:108,gap:18,w:7.5,h:1.15},{kind:'southern-stubble',x0:-340,x1:-95,z0:-395,z1:-280,gap:17,w:5.0,h:.30},{kind:'outer-golden-grain',x0:160,x1:434,z0:-200,z1:132,gap:21,w:8.0,h:1.05},{kind:'market-fallow',x0:-300,x1:40,z0:-465,z1:-255,gap:25,w:7,h:.26}];
  for(const region of fieldRegions)for(let z=region.z0,row=0;z<region.z1;z+=region.gap,row++){
    const line:number[][]=[];for(let x=region.x0;x<region.x1-14;x+=14){const zz=z+6*Math.sin((x-region.x0)/95+row*.27),nextZ=z+6*Math.sin((x+14-region.x0)/95+row*.27),cx=x+7,cz=(zz+nextZ)/2,r=Math.hypot(7,region.w/2)+1;if(!roadIndex.clearAt(cx,cz,r+9)||reserved(cx,cz,r))continue;const h=inSight(cx,cz,r)?Math.min(.75,region.h):region.h,poly=[vec(x,0,zz-region.w/2),vec(x+14,0,nextZ-region.w/2),vec(x+14,0,nextZ+region.w/2),vec(x,0,zz+region.w/2)],b=region.kind==='market-fallow'?leaves:region.kind==='southern-stubble'?stems:grain;
      for(const p of terrainPieces(poly)){const top=p.map(q=>q.clone().add(vec(0,h,0)));for(let i=1;i<p.length-1;i++)b.tri(top[0],top[i],top[i+1]);for(let i=0;i<p.length;i++){const j=(i+1)%p.length,mid=p[i].clone().lerp(p[i],p[j],.5);const onBoundary=poly.some((a,k)=>{if(k===1||k===3)return false;const c=poly[(k+1)%poly.length];return Math.abs((c.x-a.x)*(mid.z-a.z)-(c.z-a.z)*(mid.x-a.x))<1e-6;});if(onBoundary)b.quad(p[i].clone().add(vec(0,-.04,0)),p[j].clone().add(vec(0,-.04,0)),top[i],top[j]);}}
      line.push([cx,groundY(cx,cz),cz]);
      // Individual seed heads only in sparse selected bands: readable close
      // relief without thousands of card-like shrubs at the road shoulder.
      if((Math.round((x-region.x0)/7)+row*3)%23===0&&region.h>.5)for(let i=0;i<2;i++){const sx=cx-1+i,sz=cz+(i%2)*.5,foot=rect(vec(sx,0,sz),.10,.10),ext=terrainExtrema(foot),root=ext.low-.06,head=ext.high+h+.22;tube('wheat-grounded-stem',stems,[vec(sx,root,sz),vec(sx+.08,head,sz)],[.04,.025],5);oval('wheat-modeled-seed-head',straw,vec(sx+.08,head+.15,sz),vec(.10,.22,.08),4,2);groundedDetails.push({kind:'wheat-grounded-stem',x:sx,z:sz,bottom:root,terrainY:groundY(sx,sz),footprint:foot.map(tuple)});}
    }if(line.length)cropRows.push({kind:region.kind,points:line,height:region.h});
  }
  // Five irregular orchard rows; the full crown keeps outside orbit corridors.
  for(let row=0;row<5;row++)for(let col=0;col<16;col++){
    const x=-410+col*21.5,z=125+row*24+7*Math.sin(col*.38+row),r=4.2+(col%3)*.3,h=6.4+(row%2)*.8;
    if(!roadIndex.clearAt(x,z,r+25)||reserved(x,z,r)||inSight(x,z,r+3))continue;const root=groundY(x,z),foot=rect(vec(x,0,z),1.4,1.4),ext=terrainExtrema(foot),bottom=ext.low-.15;
    tube('orchard-grounded-flared-root',timber,[vec(x,bottom,z),vec(x,ext.high+.45,z),vec(x,root+3.6,z)],[.75,.4,.26],9);groundedDetails.push({kind:'orchard-grounded-flared-root',x,z,bottom,terrainY:root,footprint:foot.map(tuple)});
    for(let k=0;k<3;k++){const a=k/3*Math.PI*2+.2*row,bx=x+Math.cos(a)*2.0,bz=z+Math.sin(a)*2;beam('orchard-supported-branch',timber,vec(x,root+2.3,z),vec(bx,root+4.6,bz),.23);oval('orchard-original-lobed-canopy',k%2?lightLeaves:leaves,vec(bx,root+4.6,bz),vec(r*.66,2.2,r*.66),8,4);for(let j=0;j<2;j++)oval('orchard-visible-apples',fruit,vec(bx+Math.cos(j*2.1)*1.7,root+3.8,bz+Math.sin(j*2.1)*1.7),vec(.20,.23,.20),4,2);}
    trees.push({position:[x,root,z],radius:r+1,height:h});props.push({kind:'orchard-tree',x,y:root,z,radius:r+1});
  }
  // Low stone-backed terrace edges have source-adapted bottoms at every end,
  // never hanging wall skirts. They sit far beyond the eight-metre shoulder.
  for(let row=0;row<3;row++)for(let i=0;i<20;i++){
    const x=-398+i*13,z=-135+row*83+11*Math.sin(i*.20+row),nextX=x+10.5,nextZ=-135+row*83+11*Math.sin((i+.81)*.20+row),mx=(x+nextX)/2,mz=(z+nextZ)/2,len=Math.hypot(nextX-x,nextZ-z),yaw=Math.atan2(nextX-x,nextZ-z),foot=rect(vec(mx,0,mz),.8,len,yaw);
    if(!roadIndex.clearAt(mx,mz,len/2+15)||reserved(mx,mz,len/2+1))continue;const ext=terrainExtrema(foot),top=ext.high+.7;grounded('terrace-grounded-limestone-wall',mx,mz,.8,len,top,stone,yaw);box('terrace-joined-limestone-cap',paleStone,vec(mx,top+.08,mz),vec(1,.16,len+.1),yaw);
  }
  // Sparse harvest pockets, with level stone feet clipped over the whole
  // assembly footprint. Their tooling is visible above (not behind) bales.
  for(const [edge,s,side]of [[course.commonStart,220,-1],[course.commonStart,535,1],[course.commonStart,790,-1],[course.commonStart,1120,-1],[course.alternates.boulevard,310,-1],[course.commonFinish,160,-1],[course.commonFinish,560,1]] as const){
    const q=point(edge,s,side*(edge.halfWidthAt(s)+34));if(!roadIndex.clearAt(q.x,q.z,28)||reserved(q.x,q.z,7)||inSight(q.x,q.z,7))continue;const p=vec(q.x,0,q.z),at=foundation('harvest-detail-pocket',p,9,7),bale=(x:number,y:number,z:number)=>{box('corded-square-hay-bale',straw,at(x,y+1,z),vec(3.1,2,2.3));for(const xx of [-.8,.8])box('hay-bale-raised-cord',stems,at(x+xx,y+1,z),vec(.08,2.08,2.38));};bale(-1.9,0,0);bale(1.7,0,.4);bale(-.3,2,.1);crate(at,2,.05,-2,2,1.6);props.push({kind:'hay-and-produce-pocket',x:p.x,y:p.y,z:p.z,radius:7});
  }
  // Original fork boards have actual wheat and barn relief. Positive lateral
  // is the barn branch; neither board occupies the final 80 m decision window.
  for(const side of [-1,1]){const e=course.commonStart,s=e.length-115,p=point(e,s,side*(e.halfWidthAt(s)+12)),at=local(vec(p.x,groundY(p.x,p.z),p.z),Math.PI/2);for(const x of [-2.2,2.2]){const q=at(x,0,0);grounded('farm-fork-grounded-sign-post',q.x,q.z,.32,.32,p.y+5,timber);}const y=p.y-groundY(p.x,p.z)+3.8;box('farm-fork-arrow-board',boards,at(0,y,0),vec(6,2.5,.35),Math.PI/2);for(const z of [-.22,.22]){const start=canvas.positions.length/3;canvas.tri(at(side*2.7,y,z),at(side*1.4,y+.75,z),at(side*1.4,y-.75,z));bound('farm-fork-raised-direction-arrow',canvas,start);if(side>0){beam('fork-barn-relief-roof',canvas,at(-1.8,y+.1,z),at(-.9,y+.9,z),.16);beam('fork-barn-relief-roof',canvas,at(-.9,y+.9,z),at(0,y+.1,z),.16);for(const x of [-1.7,-.1])beam('fork-barn-relief-post',canvas,at(x,y-.85,z),at(x,y+.15,z),.15);}else{beam('fork-wheat-relief-stem',canvas,at(.9,y-.9,z),at(.9,y+.85,z),.13);for(const d of [-1,1])for(const yy of [-.45,0,.45])beam('fork-wheat-relief-seed',canvas,at(.9,y+yy,z),at(.9+d*.45,y+yy+.32,z),.17);}}props.push({kind:'harvest-fork-wayfinding',x:p.x,y:p.y,z:p.z,radius:3.5});}
  meshBlock('fork-wayfinding-exact-triangles',components.filter(c=>c.kind.startsWith('farm-fork-')||c.kind.startsWith('fork-barn-')||c.kind.startsWith('fork-wheat-')).flatMap(c=>facesFor(batches.find(b=>b.name===c.batch)!,c.vertexStart,c.vertexEnd)));
  const used=batches.filter(b=>b.indices.length),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const b of used)for(let i=0;i<b.positions.length;i++){const j=i%3;min[j]=Math.min(min[j],b.positions[i]);max[j]=Math.max(max[j],b.positions[i]);}
  const budget={batches:used.length,triangles:used.reduce((n,b)=>n+b.indices.length/3,0),vertices:used.reduce((n,b)=>n+b.positions.length/3,0)};
  if(budget.batches>24||budget.triangles>=110000||budget.vertices>=200000)throw new Error('Harvest emitted geometry budget exceeded: '+JSON.stringify({budget,batches:used.map(b=>[b.name,b.indices.length/3,b.positions.length/3]),shoulderFaces:shoulderFaces.length,roadFaces:roadFaces.length}));
  return{version:1,trackId:course.id,batches:used,roadSamples,routeRoadSamples,roadFaces,roadUndersideFaces,shoulderFaces,props,structures:[{kind:'gallery',from:barn.from,to:barn.to,overheadClearance:18}],bounds:{min,max},cameraObstacles,components,landmarks,foundations,groundedDetails,railMembers,trees,cropRows,barn,sails,sightlines,terrainGrid,budget};
}
