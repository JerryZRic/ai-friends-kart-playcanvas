import * as pc from 'playcanvas';
import {LandMeshBatch} from './land-mesh-builder';
import {getAlpineProp,type AlpinePropKind} from './alpine-props';
import type {LandTrack} from './land-track';
import type {LandGeometryBatch,LandPropPlacement,LandSceneGeometry} from './land-scenery';
import {cameraTerrainHeight,type CameraBlocker,type CameraHeightfield} from './land-camera';
import {intersectRoadFootprint,roadFootprint,RoadFootprintIndex,type RoadFootprint} from './land-road-mesh';

type Role='road'|'terrain'|'support'|'structure'|'rail'|'vegetation'|'detail';
export type MountainComponent={kind:string;batch:string;vertexStart:number;vertexEnd:number;indexStart:number;indexEnd:number;min:number[];max:number[];role:Role;solid:boolean;assembly?:string};
export interface MountainSceneGeometry extends LandSceneGeometry {
  components:MountainComponent[];
  cameraObstacles:(CameraBlocker&{kind:string})[];
  terrainGrid:CameraHeightfield;
  terrainPartitions:{batch:string;sourceTriangles:number[]}[];
  roadFaces:{distance:number;points:number[][]}[];
  foundations:{kind:string;component:number;footprint:number[][];bottom:number;top:number;terrainLow:number;terrainHigh:number}[];
  contacts:{kind:string;first:number;second:number;point:number[]}[];
  groundedDetails:{kind:string;component:number;footprint:number[][];bottom:number;terrainLow:number;terrainHigh:number}[];
  landforms:{kind:string;knots:number[][];widths:number[]}[];
  sectionRhythms:{name:string;from:number;to:number;trees:number;rocks:number;intent:string}[];
  assemblies:{id:string;components:number[];closed:boolean}[];
  lookout:{position:number[];yaw:number;platformComponent:number;accentPlacements:{kind:string;position:number[];yaw:number}[]};
  reusedProps:{kind:AlpinePropKind;sourceFile:string;sourceSha256:string;position:number[];yaw:number;footprint:number[][];groundContacts:number[][];supportBand:number[][];pad:number;components:number[];primitives:{component:number;sourcePrimitive:number;sourceMaterial:string}[];integrationSupports:{kind:string;component:number;joins:number[];externalDetail?:boolean}[]}[];
  budget:{batches:number;triangles:number;vertices:number};
}
const vec=(x:number,y:number,z:number)=>new pc.Vec3(x,y,z),tuple=(p:pc.Vec3)=>[p.x,p.y,p.z];
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const smooth=(x:number)=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
const noise=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
const local=(p:pc.Vec3,yaw:number)=>{const c=Math.cos(yaw),s=Math.sin(yaw);return(x:number,y:number,z:number)=>vec(p.x+x*c+z*s,p.y+y,p.z-x*s+z*c);};

/** Metric face coordinates give vertical rock the same texel scale as a cap.
 * No XZ-only projection can collapse the vertical axis into stretched stripes. */
class MountainBatch extends LandMeshBatch {
  private face(points:pc.Vec3[],quad:boolean) {
    const start=this.positions.length/3,a=points[0],u=points[1].clone().sub(a).normalize();
    const normal=new pc.Vec3().cross(points[1].clone().sub(a),points[2].clone().sub(a)).normalize();
    const v=new pc.Vec3().cross(normal,u).normalize();
    for(const p of points){const q=p.clone().sub(a);this.vertex(p,[q.dot(u)*.22,q.dot(v)*.22]);}
    if(quad)this.indices.push(start,start+2,start+1,start+1,start+2,start+3);else this.indices.push(start,start+1,start+2);
  }
  tri(a:pc.Vec3,b:pc.Vec3,c:pc.Vec3){this.face([a,b,c],false);}
  quad(a:pc.Vec3,b:pc.Vec3,c:pc.Vec3,d:pc.Vec3){this.face([a,b,c,d],true);}
  box(p:pc.Vec3,size:pc.Vec3,yaw=0){
    const at=local(p,yaw),x=size.x/2,y=size.y/2,z=size.z/2;
    const c=[at(-x,-y,-z),at(x,-y,-z),at(-x,y,-z),at(x,y,-z),at(-x,-y,z),at(x,-y,z),at(-x,y,z),at(x,y,z)];
    for(const f of [[0,1,2,3],[5,4,7,6],[4,0,6,2],[1,5,3,7],[2,3,6,7],[4,5,0,1]])this.quad(c[f[0]],c[f[1]],c[f[2]],c[f[3]]);
  }
}

/** Enrichment of Mountain001's existing route, not a second course runtime.
 * Road buffer generation below is deliberately identical to the original.
 * Terrain, supports and camera blockers all derive from these emitted meshes. */
export function buildMountainSceneGeometry(track:LandTrack):MountainSceneGeometry {
  const asphalt=new LandMeshBatch('Mountain banked tarmac','#50595e',.99,'asphalt');
  const roughAsphalt=new LandMeshBatch('Weathered aggregate tarmac','#62696b',1,'asphalt');
  const underpassStone=new LandMeshBatch('Underpass dressed stone roadway','#92958d',.98,'none');
  const shoulder=new LandMeshBatch('Crushed limestone shoulders','#aaa68f',.99,'stone');
  const stone=new MountainBatch('Stratified granite and retaining masonry','#89958f',.98,'stone');
  const lightStone=new MountainBatch('Weathered limestone strata','#bdbaa2',.98,'stone');
  const darkStone=new MountainBatch('Slate ledges and viaduct soffits','#596b72',.98,'stone');
  const turf=new MountainBatch('Alpine terrace meadow','#88a86c',1,'grass');
  const valley=new MountainBatch('Forest valley floor','#63855c',1,'grass');
  const distant=new MountainBatch('Distant blue mountain ridges','#879ba3',1,'none');
  const cliff=new MountainBatch('Connected muted granite slopes','#7f8f85',1,'none');
  const paleCliff=new MountainBatch('Local pale exposed mineral beds','#a5af99',1,'none');
  const snow=new MountainBatch('High ridge limestone snow patches','#d3ddd2',.97);
  const rail=new LandMeshBatch('Galvanized double guardrail','#bdc8c9',.46,'none',.65);
  const white=new LandMeshBatch('Ivory road markings','#f1ebce',.81);
  const yellow=new LandMeshBatch('Amber edge reflectors','#e8ab4d',.67);
  const red=new LandMeshBatch('Oxblood safety kerbs and roof','#a5624c',.96);
  const wood=new MountainBatch('Lookout cedar timber','#92704e',.96,'wood');
  const bark=new MountainBatch('Spruce trunks and fence timber','#594f3c',.99,'wood');
  const pine=new MountainBatch('Spruce shaded boughs','#2c5249',1);
  const pineTips=new MountainBatch('Spruce fresh alpine tips','#50755a',1);
  const glass=new MountainBatch('Chalet amber windows','#d2b87b',.38,'none',.1);
  const gold=new MountainBatch('Golden rowan crown accents','#edbd48',1);
  const coral=new MountainBatch('Autumn copper shrub and landmark accents','#c87c46',1);
  const batches:LandMeshBatch[]=[asphalt,roughAsphalt,underpassStone,shoulder,stone,lightStone,darkStone,turf,valley,distant,snow,rail,white,yellow,red,wood,bark,pine,pineTips,glass,cliff,paleCliff,gold,coral];
  const props:LandPropPlacement[]=[],structures:LandSceneGeometry['structures']=[],roadSamples:LandSceneGeometry['roadSamples']=[];
  const components:MountainComponent[]=[],cameraObstacles:MountainSceneGeometry['cameraObstacles']=[],foundations:MountainSceneGeometry['foundations']=[],contacts:MountainSceneGeometry['contacts']=[],groundedDetails:MountainSceneGeometry['groundedDetails']=[],assemblies:MountainSceneGeometry['assemblies']=[];
  let assembly:string|undefined;
  const bound=(kind:string,b:LandGeometryBatch,vertexStart:number,indexStart:number,role:Role,solid=false)=>{
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=vertexStart*3;i<b.positions.length;i++){const axis=i%3;min[axis]=Math.min(min[axis],b.positions[i]);max[axis]=Math.max(max[axis],b.positions[i]);}
    const c:MountainComponent={kind,batch:b.name,vertexStart,vertexEnd:b.positions.length/3,indexStart,indexEnd:b.indices.length,min,max,role,solid,...(assembly?{assembly}:{})};components.push(c);return components.length-1;
  };
  const record=(kind:string,b:LandMeshBatch,emit:()=>void,role:Role='structure',solid=true)=>{const v=b.positions.length/3,i=b.indices.length;emit();return bound(kind,b,v,i,role,solid);};
  const box=(kind:string,b:LandMeshBatch,p:pc.Vec3,size:pc.Vec3,yaw=0,role:Role='structure')=>record(kind,b,()=>b.box(p,size,yaw),role);
  const faceTriangles=(component:MountainComponent)=>{const b=batches.find(b=>b.name===component.batch)!,out:number[][][]=[];for(let i=component.indexStart;i<component.indexEnd;i+=3)out.push(b.indices.slice(i,i+3).map(k=>b.positions.slice(k*3,k*3+3)));return out;};
  // point is a non-certifying diagnostic locator only. Actual contact is
  // proved from the two components' emitted triangles, never from this hint.
  const contact=(kind:string,first:number,second:number,p:pc.Vec3)=>contacts.push({kind,first,second,point:tuple(p)});
  const rect=(p:pc.Vec3,w:number,d:number,yaw=0)=>{const at=local(p,yaw);return[at(-w/2,0,-d/2),at(w/2,0,-d/2),at(w/2,0,d/2),at(-w/2,0,d/2)];};
  const beam=(kind:string,b:LandMeshBatch,a:pc.Vec3,c:pc.Vec3,width:number,depth=width,role:Role='structure')=>record(kind,b,()=>{
    const y=c.clone().sub(a).normalize(),ref=Math.abs(y.y)>.95?vec(1,0,0):vec(0,1,0),x=new pc.Vec3().cross(y,ref).normalize(),z=new pc.Vec3().cross(y,x).normalize();
    const at=(p:pc.Vec3,i:number,j:number)=>p.clone().add(x.clone().mulScalar(i*width/2)).add(z.clone().mulScalar(j*depth/2));
    const v=[at(a,-1,-1),at(a,1,-1),at(a,-1,1),at(a,1,1),at(c,-1,-1),at(c,1,-1),at(c,-1,1),at(c,1,1)];
    for(const f of [[0,1,2,3],[5,4,7,6],[4,0,6,2],[1,5,3,7],[2,3,6,7],[4,5,0,1]])b.quad(v[f[0]],v[f[1]],v[f[2]],v[f[3]]);
  },role);
  const samples=960,step=track.length/samples;
  const point=(d:number,lateral:number,height=0)=>{const p=track.sample(d,lateral).p.clone();p.y+=height;return p;};
  const ribbon=(batch:LandMeshBatch,d:number,next:number,a:number,b:number,height=0)=>batch.quad(point(d,a,height),point(d,b,height),point(next,a,height),point(next,b,height));
  const spans=track.sections as readonly {name:string;from:number;to:number;kind?:string}[];
  const bridge=spans.find(s=>/viaduct|bridge/i.test(s.kind??'')||/viaduct|bridge/i.test(s.name));
  const within=(d:number,span?:{from:number;to:number})=>span&&d>=span.from&&d<=span.to;
  let minimum=Infinity;for(let i=0;i<samples;i++)minimum=Math.min(minimum,track.sample(i*step).p.y-Math.abs(track.sample(i*step).n.y)*track.halfWidthAt(i*step));
  const floor=minimum-19;
  for(let i=0;i<samples;i++) {
    const d=i*step, next=(i+1)*step, w=track.halfWidthAt(d), wn=track.halfWidthAt(next);
    const a=point(d,-w),b=point(d,w),c=point(next,-wn),e=point(next,wn);
    const surface=track.surfaceAt(d).kind;
    (surface==='rough-asphalt'?roughAsphalt:surface==='underpass-stone'?underpassStone:asphalt).quad(a,b,c,e);
    roadSamples.push({distance:d,left:tuple(a),right:tuple(b)});
    for(const side of [-1,1]) {
      shoulder.quad(point(d,side*w,-.04),point(d,side*(w+1.5),-.04),point(next,side*wn,-.04),point(next,side*(wn+1.5),-.04));
      ribbon(i%8<4?white:red,d,next,side*(w+.10),side*(w+.65),.035);
      // Both beam courses follow grade and lateral banking without flat boxes.
      for(const h of [.77,1.10]) rail.quad(point(d,side*(w+1.25),h),point(d,side*(w+1.25),h+.16),point(next,side*(wn+1.25),h),point(next,side*(wn+1.25),h+.16));
    }
    if(i%10<5) ribbon(white,d,next,-.055,.055,.025);
    if(i%4===0) for(const side of [-1,1]) {
      const p=point(d,side*(w+1.25),.57),yaw=track.sample(d).angle;
      rail.box(p,vec(.12,1.18,.14),yaw);
      if(i%12===0) yellow.box(point(d,side*(w+1.23),1.12),vec(.2,.13,.10),yaw);
    }
  }
  for(let row=0;row<2;row++) for(let col=0;col<16;col++) if((row+col)%2===0) {
    const w=track.halfWidthAt(0); ribbon(white,row*.7,(row+1)*.7,-w+col*w/8,-w+(col+1)*w/8,.045);
  }

  for(const b of [asphalt,roughAsphalt,underpassStone,shoulder,rail,white,yellow,red])bound('source-exact-'+b.name,b,0,0,[asphalt,roughAsphalt,underpassStone].includes(b)?'road':b===rail?'rail':b===shoulder?'support':'detail');
  const roadFaces:MountainSceneGeometry['roadFaces']=[],sourceRoadFaces:RoadFootprint[]=[];
  for(let i=0;i<samples;i++){
    const d=i*step,next=(i+1)*step,w=track.halfWidthAt(d),wn=track.halfWidthAt(next),a=point(d,-w),b=point(d,w),c=point(next,-wn),e=point(next,wn);
    for(const points of [[a,c,b],[b,c,e]]){roadFaces.push({distance:d,points:points.map(tuple)});sourceRoadFaces.push(roadFootprint(track,d,points));}
  }
  const roadIndex=new RoadFootprintIndex(sourceRoadFaces);
  const centers=roadSamples.map(s=>s.left),minRoadX=Math.min(...centers.map(p=>p[0])),maxRoadX=Math.max(...centers.map(p=>p[0])),minRoadZ=Math.min(...centers.map(p=>p[2])),maxRoadZ=Math.max(...centers.map(p=>p[2]));
  const lookoutDistance=.045*track.length,lookoutYaw=track.sample(lookoutDistance).angle;
  let lookoutSite=point(lookoutDistance,track.halfWidthAt(lookoutDistance)+22,-1.8);
  if(!track.clearAt(lookoutSite.x,lookoutSite.z,16.4))lookoutSite=point(lookoutDistance,-track.halfWidthAt(lookoutDistance)-22,-1.8);
  if(!track.clearAt(lookoutSite.x,lookoutSite.z,16.4))throw new Error('Original Mountain lookout footprint no longer clears the preserved route');
  const landforms:MountainSceneGeometry['landforms']=[
    {kind:'east-setback-split-granite-crest',knots:[[555,55,-245],[615,115,-35],[615,38,130],[570,98,300],[565,63,390]],widths:[85,110,75,98,90]},
    {kind:'west-setback-twin-summit-and-open-saddle',knots:[[-630,70,-230],[-645,105,-60],[-620,38,75],[-635,135,250],[-590,64,390]],widths:[90,105,70,100,85]},
    {kind:'north-asymmetric-overlapping-high-ridge',knots:[[350,100,535],[240,151,566],[100,62,535],[-30,112,552],[-150,79,530]],widths:[100,100,85,105,90]},
    {kind:'south-low-saddle-and-far-peak',knots:[[-430,62,-455],[-280,105,-475],[-110,38,-454],[90,78,-451]],widths:[91,106,70,90]},
    {kind:'eastern-soft-middle-ground-foothills',knots:[[466,20,-220],[485,34,-65],[458,24,145],[468,32,330]],widths:[65,75,65,73]},
    {kind:'western-forested-middle-ground-spur',knots:[[-489,27,-205],[-505,32,-40],[-478,22,155],[-476,29,330]],widths:[64,71,62,67]},
    {kind:'inner-eastern-layered-buttress',knots:[[352,23,-28],[334,32,80],[343,34,148]],widths:[47,43,39]},
    {kind:'granite-basin-broad-backwall',knots:[[-347,25,275],[-270,32,270],[-207,26,257]],widths:[40,45,39]},
  ];
  const groundSamples=Array.from({length:Math.ceil(track.length/9)},(_,i)=>{const d=i/Math.ceil(track.length/9)*track.length,s=track.sample(d);return{p:s.p,edge:s.p.y-Math.abs(s.n.y)*track.halfWidthAt(d)};});
  const rawTerrain=(x:number,z:number)=>{
    let nearest=Infinity,nearHeight=floor;
    for(const s of groundSamples){const d=Math.hypot(x-s.p.x,z-s.p.z);if(d<nearest){nearest=d;nearHeight=s.edge;}}
    const blend=Math.max(0,1-Math.max(0,nearest-8)/140);
    let y=floor+(nearHeight-4-floor)*blend+Math.sin(x*.027)*Math.cos(z*.021)*Math.min(2.1,nearest/24);
    let nearEnvelope=Math.max(y,floor),farEnvelope=floor-1;
    for(const [ridgeIndex,ridge]of landforms.entries())for(let k=1;k<ridge.knots.length;k++){
      const a=ridge.knots[k-1],b=ridge.knots[k],t=clamp(((x-a[0])*(b[0]-a[0])+(z-a[2])*(b[2]-a[2]))/((b[0]-a[0])**2+(b[2]-a[2])**2),0,1),d=Math.hypot(x-a[0]-(b[0]-a[0])*t,z-a[2]-(b[2]-a[2])*t),width=ridge.widths[k-1]+(ridge.widths[k]-ridge.widths[k-1])*t;
      const u=clamp(1-d/width,0,1),terrace=smooth(u)+Math.sin(u*Math.PI*8)*.025*u;
      const candidate=floor+(a[1]+(b[1]-a[1])*t-floor)*terrace;y=Math.max(y,candidate);
      if(u>0){if(ridgeIndex<4)farEnvelope=Math.max(farEnvelope,candidate);else nearEnvelope=Math.max(nearEnvelope,candidate);}
    }
    // A local earth-cut bench keeps the original lookout's perceived height.
    // Its generous core covers every field cell beneath the stone apron; the
    // outer shoulder blends into the hillside rather than a tall pedestal.
    const lx=(x-lookoutSite.x)*Math.cos(lookoutYaw)-(z-lookoutSite.z)*Math.sin(lookoutYaw),lz=(x-lookoutSite.x)*Math.sin(lookoutYaw)+(z-lookoutSite.z)*Math.cos(lookoutYaw),bench=smooth(1-Math.max(Math.abs(lx)-25,Math.abs(lz)-23,0)/19);
    y+=(lookoutSite.y-.45-y)*bench;
    // The distant material starts only once its owning landform rises 5 cm
    // above the competing envelope. This keeps the exact flat toe in one
    // material rather than creating sub-millimetre color islands from the
    // vanishing derivative of the smooth ridge foot. Terrain is unchanged.
    return{y,farSignal:farEnvelope-nearEnvelope-.05};
  };
  const minX=Math.min(minRoadX-180,...landforms.flatMap(r=>r.knots.map((p,i)=>p[0]-r.widths[i])))-1,maxX=Math.max(maxRoadX+180,...landforms.flatMap(r=>r.knots.map((p,i)=>p[0]+r.widths[i])))+1,minZ=Math.min(minRoadZ-180,...landforms.flatMap(r=>r.knots.map((p,i)=>p[2]-r.widths[i])))-1,maxZ=Math.max(maxRoadZ+180,...landforms.flatMap(r=>r.knots.map((p,i)=>p[2]+r.widths[i])))+1,nx=Math.ceil((maxX-minX)/10),nz=Math.ceil((maxZ-minZ)/10),dx=(maxX-minX)/nx,dz=(maxZ-minZ)/nz,heights:number[]=[],farSignals:number[]=[];
  const triangleDistanceXZ=(x:number,z:number,points:pc.Vec3[])=>{
    const signs=points.map((a,i)=>{const b=points[(i+1)%3];return(b.x-a.x)*(z-a.z)-(b.z-a.z)*(x-a.x);});
    if(signs.every(v=>v>=0)||signs.every(v=>v<=0))return 0;
    return Math.min(...points.map((a,i)=>{const b=points[(i+1)%3],vx=b.x-a.x,vz=b.z-a.z,t=clamp(((x-a.x)*vx+(z-a.z)*vz)/(vx*vx+vz*vz),0,1);return Math.hypot(x-a.x-vx*t,z-a.z-vz*t);}));
  };
  for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){
    const px=minX+x*dx,pz=minZ+z*dz,raw=rawTerrain(px,pz);let y=raw.y;farSignals.push(raw.farSignal);
    // A graded 45 m roadward collar replaces the old sheer curtain beside the
    // lower return. The lower route controls this shoulder even beneath a deck.
    for(const f of roadIndex.query(px-45,px+45,pz-45,pz+45)){const distance=triangleDistanceXZ(px,pz,f.points);if(distance<45)y=Math.min(y,f.minY-2.65+Math.max(0,distance-3)*.70);}
    heights.push(y);
  }
  // For EVERY full driving triangle, all corners of each overlapping terrain
  // cell lie below that triangle's lowest vertex. Linear interpolation then
  // proves clearance throughout the cell, including the lower crossing deck.
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
    const nearby=roadIndex.query(minX+x*dx-1.5,minX+(x+1)*dx+1.5,minZ+z*dz-1.5,minZ+(z+1)*dz+1.5);
    if(!nearby.length)continue;const ceiling=Math.min(...nearby.map(f=>f.minY))-2.65,i=z*(nx+1)+x;
    for(const k of [i,i+1,i+nx+1,i+nx+2])heights[k]=Math.min(heights[k],ceiling);
  }
  const terrainGrid:CameraHeightfield={minX,minZ,dx,dz,columns:nx+1,rows:nz+1,heights};
  const terrainHeight=(x:number,z:number)=>cameraTerrainHeight(terrainGrid,x,z)??floor;
  const gridVertex=(index:number)=>vec(minX+(index%(nx+1))*dx,heights[index],minZ+Math.floor(index/(nx+1))*dz);
  const terrainMaps=new Map<LandMeshBatch,Map<string,number>>(),terrainPartitions:MountainSceneGeometry['terrainPartitions']=[];
  for(const b of [valley,turf,cliff,paleCliff,distant,snow]){terrainMaps.set(b,new Map());terrainPartitions.push({batch:b.name,sourceTriangles:[]});}
  // Clip material boundaries on each source plane. A contour passing through
  // a cell is a real shared mesh edge, never a centroid-painted whole triangle.
  const clipHeight=(poly:pc.Vec3[],height:number,above:boolean)=>{
    const out:pc.Vec3[]=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a.y-height)*(above?1:-1),db=(b.y-height)*(above?1:-1);if(da>=0)out.push(a);if((da>=0)!==(db>=0))out.push(a.clone().lerp(a,b,da/(da-db)));}
    return out.filter((p,i)=>p.distance(out[(i+out.length-1)%out.length])>1e-9);
  };
  type TerrainPiece={source:number;ids:number[];sourcePoints:pc.Vec3[];normal:pc.Vec3;batch:LandMeshBatch;polygon:pc.Vec3[]};
  const pieces:TerrainPiece[]=[],edgeCuts=new Map<string,{t:number;p:pc.Vec3}[]>();
  const edgeKey=(a:number,b:number)=>Math.min(a,b)+','+Math.max(a,b);
  const mask=(x:number,z:number)=>Math.max(1-((x-355)/88)**2-((z-92)/108)**2,1-((x+280)/94)**2-((z-277)/67)**2)-.22;
  let sourceTriangle=0;
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
    const i=z*(nx+1)+x;
    for(const ids of [[i,i+nx+1,i+1],[i+1,i+nx+1,i+nx+2]]){
      const p=ids.map(gridVertex),normal=new pc.Vec3().cross(p[1].clone().sub(p[0]),p[2].clone().sub(p[0])).normalize(),steep=normal.y<.77;
      const sampleField=(q:pc.Vec3,values:number[])=>{const[a,b,c]=p,den=(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x),u=((q.x-a.x)*(c.z-a.z)-(q.z-a.z)*(c.x-a.x))/den,v=((b.x-a.x)*(q.z-a.z)-(b.z-a.z)*(q.x-a.x))/den;return values[0]+u*(values[1]-values[0])+v*(values[2]-values[0]);};
      const split=(polygon:pc.Vec3[],values:number[],threshold=0)=>{
        if(!polygon.length)return{lo:[],hi:[]};const scalars=polygon.map(q=>sampleField(q,values)-threshold);
        if(Math.max(...scalars)<=0)return{lo:polygon,hi:[]};if(Math.min(...scalars)>=0)return{lo:[],hi:polygon};
        const clip=(above:boolean)=>{const out:pc.Vec3[]=[];for(let j=0;j<polygon.length;j++){const a=polygon[j],b=polygon[(j+1)%polygon.length],da=scalars[j]*(above?1:-1),db=scalars[(j+1)%polygon.length]*(above?1:-1);if(da>=0)out.push(a);if((da>=0)!==(db>=0))out.push(a.clone().lerp(a,b,da/(da-db)));}return out.filter((p,i)=>p.distance(out[(i+out.length-1)%out.length])>1e-8);};return{lo:clip(false),hi:clip(true)};
      };
      const add=(polygon:pc.Vec3[],batch:LandMeshBatch)=>{if(polygon.length<3)return;let area=0;for(let k=1;k<polygon.length-1;k++)area+=new pc.Vec3().cross(polygon[k].clone().sub(polygon[0]),polygon[k+1].clone().sub(polygon[0])).length();if(area>1e-8)pieces.push({source:sourceTriangle,ids,sourcePoints:p,normal,batch,polygon});};
      // Far color follows the actual owning background landform, not altitude
      // or a distance ring. Pale rock occurs only in two local geological beds.
      const region=split(p,ids.map(i=>farSignals[i]));
      if(normal.y>.58){const cap=split(region.hi,p.map(q=>q.y),138);add(cap.lo,distant);add(cap.hi,snow);}else add(region.hi,distant);
      if(steep){const mineral=split(region.lo,p.map(q=>mask(q.x,q.z)));add(mineral.lo,cliff);add(mineral.hi,paleCliff);}
      else{const meadow=split(region.lo,p.map(q=>q.y),16);add(meadow.lo,valley);add(meadow.hi,turf);}
      sourceTriangle++;
    }
  }
  // Collect only actual material cut vertices from source edges. Propagating
  // this union makes every neighboring plane conform without redundant bands.
  for(const piece of pieces)for(const q of piece.polygon)for(let edge=0;edge<3;edge++){
    const ia=Math.min(piece.ids[edge],piece.ids[(edge+1)%3]),ib=Math.max(piece.ids[edge],piece.ids[(edge+1)%3]),a=gridVertex(ia),b=gridVertex(ib),delta=b.clone().sub(a),t=q.clone().sub(a).dot(delta)/delta.lengthSq();if(t<=1e-8||t>=1-1e-8||q.distance(a.clone().add(delta.clone().mulScalar(t)))>1e-7)continue;
    const key=edgeKey(ia,ib),cuts=edgeCuts.get(key)??[];if(!cuts.some(p=>Math.abs(p.t-t)<1e-8))cuts.push({t,p:q});edgeCuts.set(key,cuts);
  }
  const localCutPoints=new Map<number,pc.Vec3[]>();for(const piece of pieces){const points=localCutPoints.get(piece.source)??[];for(const p of piece.polygon)if(!points.some(q=>q.distance(p)<1e-8))points.push(p);localCutPoints.set(piece.source,points);}
  for(const piece of pieces){
    const {ids,sourcePoints,normal,batch:b}=piece,polygon:pc.Vec3[]=[];
    // Neighboring source planes agree on EVERY material edge split, including
    // steep/grass transitions. Collinear boundary vertices are retained in the
    // triangulation; there are no interior T-junctions hidden by the rasterizer.
    for(let j=0;j<piece.polygon.length;j++){
      const a=piece.polygon[j],c=piece.polygon[(j+1)%piece.polygon.length],candidates=[...(localCutPoints.get(piece.source)??[])];polygon.push(a);
      for(let edge=0;edge<3;edge++){
        const first=Math.min(ids[edge],ids[(edge+1)%ids.length]),last=Math.max(ids[edge],ids[(edge+1)%ids.length]),u=gridVertex(first),v=gridVertex(last),delta=v.clone().sub(u),length=delta.lengthSq(),ta=a.clone().sub(u).dot(delta)/length,tc=c.clone().sub(u).dot(delta)/length;
        if(a.distance(u.clone().add(delta.clone().mulScalar(ta)))>1e-7||c.distance(u.clone().add(delta.clone().mulScalar(tc)))>1e-7)continue;
        candidates.push(...(edgeCuts.get(edgeKey(first,last))??[]).map(q=>q.p));
      }
      const direction=c.clone().sub(a),length=direction.lengthSq(),cuts=candidates.map(p=>({p,t:p.clone().sub(a).dot(direction)/length})).filter(q=>q.t>1e-8&&q.t<1-1e-8&&q.p.distance(a.clone().add(direction.clone().mulScalar(q.t)))<1e-7).sort((a,b)=>a.t-b.t);
      for(let i=0;i<cuts.length;i++)if(i===0||Math.abs(cuts[i].t-cuts[i-1].t)>1e-8)polygon.push(cuts[i].p);
    }
    const clean=polygon.filter((p,i)=>p.distance(polygon[(i+polygon.length-1)%polygon.length])>1e-8);if(clean.length<3)continue;
    const map=terrainMaps.get(b)!,axis=normal.y<.77?(Math.abs(normal.x)>Math.abs(normal.z)?'zy':'xy'):'xz',vertices:number[]=[];
    for(const p of clean){const key=[p.x,p.y,p.z].map(v=>v.toFixed(8)).join(',')+axis;if(!map.has(key)){map.set(key,b.positions.length/3);b.vertex(p,axis==='zy'?[p.z*.14,p.y*.14]:axis==='xy'?[p.x*.14,p.y*.14]:[p.x*.14,p.z*.14]);}vertices.push(map.get(key)!);}
    const remaining=clean.map((_,i)=>i),partition=terrainPartitions.find(t=>t.batch===b.name)!;
    while(remaining.length>2){let clipped=false;for(let j=0;j<remaining.length;j++){const a=remaining[(j+remaining.length-1)%remaining.length],c=remaining[j],d=remaining[(j+1)%remaining.length],cross=new pc.Vec3().cross(clean[c].clone().sub(clean[a]),clean[d].clone().sub(clean[a]));if(cross.dot(normal)<=1e-10)continue;if(remaining.length>3){let total=0;for(let k=1;k<remaining.length-1;k++)total+=new pc.Vec3().cross(clean[remaining[k]].clone().sub(clean[remaining[0]]),clean[remaining[k+1]].clone().sub(clean[remaining[0]])).dot(normal);if(total-cross.dot(normal)<1e-9)continue;}b.indices.push(vertices[a],vertices[c],vertices[d]);partition.sourceTriangles.push(piece.source);remaining.splice(j,1);clipped=true;break;}if(!clipped)break;}
  }
  for(const b of [valley,turf,cliff,paleCliff,distant,snow])if(b.indices.length)bound('connected-contour-terrain',b,0,0,'terrain');
  cameraObstacles.push({kind:'mountain-exact-connected-terrain',min:[minX,Math.min(...heights),minZ],max:[maxX,Math.max(...heights),maxZ],heightfield:terrainGrid});
  const terrainExtents=(footprint:pc.Vec3[])=>{
    const xx=footprint.map(p=>p.x),zz=footprint.map(p=>p.z),loX=clamp(Math.floor((Math.min(...xx)-minX)/dx),0,nx-1),hiX=clamp(Math.floor((Math.max(...xx)-minX)/dx),0,nx-1),loZ=clamp(Math.floor((Math.min(...zz)-minZ)/dz),0,nz-1),hiZ=clamp(Math.floor((Math.max(...zz)-minZ)/dz),0,nz-1);let low=Infinity,high=-Infinity;
    for(let z=loZ;z<=hiZ;z++)for(let x=loX;x<=hiX;x++){const i=z*(nx+1)+x;for(const ids of [[i,i+nx+1,i+1],[i+1,i+nx+1,i+nx+2]])for(const p of intersectRoadFootprint(ids.map(gridVertex),footprint)){low=Math.min(low,p.y);high=Math.max(high,p.y);}}
    return{low,high};
  };
  const foundation=(kind:string,p:pc.Vec3,w:number,d:number,yaw:number,top:number)=>{
    const footprint=rect(p,w,d,yaw),ext=terrainExtents(footprint),bottom=ext.low-.55;
    top=Math.max(top,ext.high+.22);const component=box(kind,stone,vec(p.x,(bottom+top)/2,p.z),vec(w,top-bottom,d),yaw,'support');
    foundations.push({kind,component,footprint:footprint.map(tuple),bottom,top,terrainLow:ext.low,terrainHigh:ext.high});return{component,top,bottom};
  };
  // Source-edge retaining faces end at the ACTUAL field rather than descending
  // to a universal empty floor. The continuous road silhouette is unchanged.
  for(const side of [-1,1])for(const section of spans){
    const b=darkStone,v=b.positions.length/3,k=b.indices.length;
    for(let i=0;i<samples;i++){
      const d=i*step;if(d<section.from||d>=section.to)continue;const end=(i+1)*step,w=track.halfWidthAt(d),wn=track.halfWidthAt(end),a=point(d,side*(w+1.5),-.12),c=point(end,side*(wn+1.5),-.12);
      const bottomA=a.clone(),bottomC=c.clone();bottomA.y=within(d,bridge)?a.y-1.1:terrainHeight(a.x,a.z)-.10;bottomC.y=within(d,bridge)?c.y-1.1:terrainHeight(c.x,c.z)-.10;
      b.quad(a,bottomA,c,bottomC);
    }
    if(b.indices.length>k)bound('source-edge-terrace-and-deck-fascia',b,v,k,'support');
  }
  if(bridge){
    let crossingClearance=Infinity;
    for(let d=bridge.from;d<bridge.to;d+=8){const upper=track.sample(d),w=track.halfWidthAt(d);for(let q=0;q<track.length;q+=8){const separation=Math.min(Math.abs(d-q),track.length-Math.abs(d-q));if(separation<110)continue;const lower=track.sample(q),lw=track.halfWidthAt(q);if(Math.hypot(upper.p.x-lower.p.x,upper.p.z-lower.p.z)>w+lw+4||lower.p.y>=upper.p.y)continue;crossingClearance=Math.min(crossingClearance,upper.p.y-Math.abs(upper.n.y)*(w+7.3)-1.9-lower.p.y-Math.abs(lower.n.y)*lw);}}
    structures.push({kind:'viaduct',from:bridge.from,to:bridge.to,overheadClearance:Number.isFinite(crossingClearance)?crossingClearance:0});
    const undersideFaces:pc.Vec3[][]=[],deckStart=darkStone.positions.length/3,deckIndex=darkStone.indices.length;
    for(let d=bridge.from;d<bridge.to;d+=step){const end=Math.min(bridge.to,d+step),w=track.halfWidthAt(d),wn=track.halfWidthAt(end),a=point(d,-w-1.5,-1.1),b=point(d,w+1.5,-1.1),c=point(end,-wn-1.5,-1.1),e=point(end,wn+1.5,-1.1);darkStone.quad(a,b,c,e);undersideFaces.push([a,c,b],[b,c,e]);}
    const deck=bound('source-exact-viaduct-undersurface',darkStone,deckStart,deckIndex,'support');
    const count=Math.max(2,Math.ceil((bridge.to-bridge.from)/18));
    for(let i=0;i<count;i++){
      assembly='viaduct-bent-'+i;const first=components.length;
      const d=bridge.from+(bridge.to-bridge.from)*(i+.5)/count,w=track.halfWidthAt(d),s=track.sample(d),beamY=s.p.y-Math.abs(s.n.y)*(w+6.5)-1.5;
      const crossbeam=box('source-exact-viaduct-crossbeam',darkStone,vec(s.p.x,beamY,s.p.z),vec((w+7.3)*2,.8,2.3),s.angle,'support');
      // The original horizontal crossbeam is preserved. Bank/grade-matched
      // bearing webs close its original gap to the exact deck triangle plane.
      const footprint=rect(s.p,(w+1.5)*2,2.3,s.angle),topPolys=undersideFaces.map(f=>clipHeight(intersectRoadFootprint(f,footprint),beamY+.4,true)).map(p=>p.filter((v,i)=>v.distance(p[(i+p.length-1)%p.length])>1e-7)).filter(p=>p.length>=3&&Math.abs(p.reduce((a,v,i)=>{const q=p[(i+1)%p.length];return a+v.x*q.z-q.x*v.z;},0))>1e-8);
      const bearing=record('viaduct-bank-and-grade-matched-deck-bearing',stone,()=>{
        const edges=new Map<string,{a:pc.Vec3;b:pc.Vec3;n:number}>(),key=(p:pc.Vec3)=>[p.x,p.y,p.z].map(v=>v.toFixed(7)).join(','),welded:pc.Vec3[]=[];
        const triangle=(a:pc.Vec3,b:pc.Vec3,c:pc.Vec3)=>{if(new pc.Vec3().cross(b.clone().sub(a),c.clone().sub(a)).lengthSq()>1e-16)stone.tri(a,b,c);};
        for(const source of topPolys){const q=source.map(p=>{const old=welded.find(q=>q.distance(p)<1e-6);if(old)return old;welded.push(p);return p;}),p=q.filter((v,i)=>v.distance(q[(i+q.length-1)%q.length])>1e-7);for(let k=1;k<p.length-1;k++){triangle(p[0],p[k],p[k+1]);triangle(vec(p[0].x,beamY+.4,p[0].z),vec(p[k+1].x,beamY+.4,p[k+1].z),vec(p[k].x,beamY+.4,p[k].z));}for(let k=0;k<p.length;k++){const a=p[k],b=p[(k+1)%p.length],id=[key(a),key(b)].sort().join('|'),old=edges.get(id);if(old)old.n++;else edges.set(id,{a,b,n:1});}}
        for(const {a,b,n}of edges.values())if(n===1){const c=vec(a.x,beamY+.4,a.z),d=vec(b.x,beamY+.4,b.z);triangle(a,c,b);triangle(b,c,d);}
      },'support');
      contact('banked-deck-to-shaped-bearing',bearing,deck,point(d,0,-1.1));contact('shaped-bearing-to-crossbeam',bearing,crossbeam,vec(s.p.x,beamY+.4,s.p.z));
      for(const side of [-1,1]){
        const p=point(d,side*(w+6.5),-1);p.y=beamY-.4;if(!track.clearAt(p.x,p.z,2.4))continue;
        const h=p.y-floor,pier=box('source-exact-viaduct-pier',stone,vec(p.x,floor+h/2,p.z),vec(1.5,h,2.2),s.angle,'support'),foot=box('source-exact-viaduct-footing',lightStone,vec(p.x,floor+.6,p.z),vec(3,1.2,3.5),s.angle,'support');
        const cap=box('viaduct-dressed-pier-cap',lightStone,vec(p.x,beamY-.65,p.z),vec(2.25,.5,2.9),s.angle,'support');
        contact('pier-cap-crossbeam-bearing',cap,crossbeam,vec(p.x,beamY-.4,p.z));contact('pier-cap-shaft-bearing',cap,pier,vec(p.x,beamY-.65,p.z));contact('pier-footing-bearing',pier,foot,vec(p.x,floor+1.0,p.z));
        const footprint=rect(p,3,3.5,s.angle),ext=terrainExtents(footprint);foundations.push({kind:'source-exact-viaduct-footing',component:foot,footprint:footprint.map(tuple),bottom:floor,top:floor+1.2,terrainLow:ext.low,terrainHigh:ext.high});
        props.push({kind:'viaduct-pier',x:p.x,y:floor,z:p.z,radius:2.4});
      }
      assemblies.push({id:assembly,components:Array.from({length:components.length-first},(_,k)=>first+k),closed:false});assembly=undefined;
    }
  }
  const configs=[
    {clusters:8,rocks:6,offset:16,height:13,intent:'Warm lookout arrival with broad low meadow and a clear roadward face'},
    {clusters:11,rocks:15,offset:22,height:14,intent:'Layered exposed granite with grouped spruce at the terrace breaks'},
    {clusters:7,rocks:8,offset:22,height:12,intent:'Low alpine vegetation and deliberate split-summit skyline openings'},
    {clusters:4,rocks:0,offset:38,height:16,intent:'Exposed viaduct with sparse distant vegetation and open air'},
    {clusters:19,rocks:10,offset:16,height:19,intent:'Tall overlapping western spruce groves separated by view windows'},
    {clusters:17,rocks:9,offset:19,height:18,intent:'Dense pine switchback groups with open inside apex and exit'},
    {clusters:7,rocks:16,offset:24,height:11,intent:'Pale broad basin rock and lower, widely separated tree clusters'},
    {clusters:9,rocks:6,offset:19,height:14,intent:'Sheltered lower return, dressed bridge supports and a bright exit'},
  ];
  const sectionRhythms:MountainSceneGeometry['sectionRhythms']=[];
  const closedCone=(kind:string,b:LandMeshBatch,p:pc.Vec3,radius:number,height:number,seed:number,sides=6)=>record(kind,b,()=>{
    const peak=p.clone().add(vec(0,height,0)),rim=Array.from({length:sides},(_,j)=>{const a=j/sides*Math.PI*2+seed;return vec(p.x+Math.cos(a)*radius,p.y,p.z+Math.sin(a)*radius);});for(let j=0;j<sides;j++)b.tri(rim[j],peak,rim[(j+1)%sides]);for(let j=1;j<sides-1;j++)b.tri(rim[0],rim[j],rim[j+1]);
  },'vegetation');
  for(const [sectionIndex,section]of spans.entries()){
    const config=configs[sectionIndex],rhythm={name:section.name,from:section.from,to:section.to,trees:0,rocks:0,intent:config.intent};sectionRhythms.push(rhythm);
    for(let cluster=0;cluster<config.clusters;cluster++){
      const seed=sectionIndex*113+cluster*11,baseD=section.from+(section.to-section.from)*(.12+.77*(cluster+.25+noise(seed)*.5)/config.clusters),side=(cluster+sectionIndex)%4===0?-1:1;
      for(let member=0;member<3;member++){
        const d=baseD+(member-1)*(4.6+noise(seed+2)*2.5),radius=2.7+noise(seed+member+41)*1.9,offset=track.halfWidthAt(d)+config.offset+noise(seed+5)*18+member*3.8,p=point(d,side*offset),height=config.height*(.76+noise(seed+member+91)*.5);
        if(!track.clearAt(p.x,p.z,radius+1.3)||Math.hypot(p.x-lookoutSite.x,p.z-lookoutSite.z)<18.5+radius)continue;
        // The arrival's building sightline and the underpass exit remain empty.
        if(sectionIndex===0&&d/track.length>.021&&d/track.length<.074&&side===1)continue;
        // Redistribute the nine already-budgeted valley spruce into three
        // overlapping bank groups around the destination. Acceptance is based
        // on the original candidates above, so this adds no tree count. The
        // open roadward apron and the lodge's facade sightline remain clear.
        if(sectionIndex===0){
          const site=cluster===0?{fraction:.030,offset:35}:cluster===4?{fraction:.038,offset:49}:{fraction:.052,offset:58},near=site.fraction*track.length+(member-1)*5.0,target=point(near,track.halfWidthAt(near)+site.offset+(member===1?3:-2));
          if(track.clearAt(target.x,target.z,radius*1.45+2)&&Math.hypot(target.x-lookoutSite.x,target.z-lookoutSite.z)>21+radius*1.45)p.copy(target);
        }
        const footprint=rect(p,.7,.7),ext=terrainExtents(footprint);p.y=ext.low-.35;assembly='spruce-'+sectionIndex+'-'+cluster+'-'+member;const first=components.length;
        const trunk=box('spruce-ground-rooted-trunk',bark,p.clone().add(vec(0,height*.34,0)),vec(.46,height*.68,.46),noise(seed)*Math.PI,'vegetation');
        groundedDetails.push({kind:'spruce-ground-rooted-trunk',component:trunk,footprint:footprint.map(tuple),bottom:p.y,terrainLow:ext.low,terrainHigh:ext.high});
        // Keep these two inherited viaduct-side crowns exactly at their first-pass
        // tessellation: simplifying them slightly worsened the conservative raw
        // orbit envelope, even though actual adjusted camera histories pass.
        const originalOrbitCrown=sectionIndex===3&&((cluster===0&&member===2)||(cluster===1&&member===1));
        for(let j=0;j<(originalOrbitCrown?4:3);j++){const base=p.clone().add(vec(0,height*(.17+j*(originalOrbitCrown?.17:.235)),0)),crown=closedCone('spruce-attached-bough-tier',j%2?pineTips:pine,base,radius*(1-j*(originalOrbitCrown?.21:.29))*(sectionIndex===0?1.45:1),height*(originalOrbitCrown?.43:.48),seed*.13,originalOrbitCrown?9:6);contact('spruce-bough-to-trunk',crown,trunk,base);}
        for(let root=0;root<3;root++){
          const angle=root/3*Math.PI*2+seed,tip=vec(p.x+Math.cos(angle)*.78,0,p.z+Math.sin(angle)*.78),left=vec(p.x-Math.sin(angle)*.22,0,p.z+Math.cos(angle)*.22),right=vec(p.x+Math.sin(angle)*.22,0,p.z-Math.cos(angle)*.22),footprint=[tip,left,right],ext=terrainExtents(footprint),bottom=ext.low-.18;
          const v=[...footprint.map(q=>vec(q.x,bottom,q.z)),p.clone().add(vec(0,.85,0))],center=v.reduce((a,b)=>a.add(b),vec(0,0,0)).mulScalar(.25);
          const flare=record('spruce-ground-root-flare',bark,()=>{for(const f of [[0,1,2],[0,3,1],[1,3,2],[2,3,0]]){const a=v[f[0]],b=v[f[1]],c=v[f[2]],normal=new pc.Vec3().cross(b.clone().sub(a),c.clone().sub(a)),out=a.clone().add(b).add(c).mulScalar(1/3).sub(center);if(normal.dot(out)>=0)bark.tri(a,b,c);else bark.tri(a,c,b);}},'vegetation');
          contact('root-flare-to-trunk',flare,trunk,p.clone().add(vec(0,.58,0)));groundedDetails.push({kind:'spruce-ground-root-flare',component:flare,footprint:footprint.map(tuple),bottom,terrainLow:ext.low,terrainHigh:ext.high});
        }
        assemblies.push({id:assembly,components:Array.from({length:components.length-first},(_,i)=>first+i),closed:false});assembly=undefined;
        props.push({kind:'spruce',x:p.x,y:p.y,z:p.z,radius:radius*(sectionIndex===0?1.45:1)});rhythm.trees++;
      }
    }
    for(let rockIndex=0;rockIndex<config.rocks;rockIndex++){
      const group=Math.floor(rockIndex/3),member=rockIndex%3,seed=sectionIndex*171+rockIndex*13,d=section.from+(section.to-section.from)*(.13+.73*(group+.45)/Math.max(1,Math.ceil(config.rocks/3)))+(member-1)*8,side=(group+sectionIndex)%3===0?-1:1,radius=3.0+noise(seed+33)*4.5,p=point(d,side*(track.halfWidthAt(d)+radius+8+group%2*9+member*3));
      if(!track.clearAt(p.x,p.z,radius+1.0)||Math.hypot(p.x-lookoutSite.x,p.z-lookoutSite.z)<18.5+radius)continue;
      // Preserve the exact old footprint as well as the rings for this one
      // inherited underpass talus: footprint extrema determine its whole shape.
      const rockSides=sectionIndex===7&&rockIndex===2?10:8;
      const footprint=Array.from({length:rockSides},(_,i)=>vec(p.x+Math.cos(i/rockSides*Math.PI*2)*radius,p.y,p.z+Math.sin(i/rockSides*Math.PI*2)*radius)),ext=terrainExtents(footprint),bottom=ext.low-.65,top=ext.high+2.6+noise(seed+9)*4.7;
      const b=sectionIndex===6||rockIndex%4===0?paleCliff:cliff,component=record('rooted-low-layered-talus',b,()=>{
        const rings=Array.from({length:5},(_,ring)=>Array.from({length:rockSides},(_,j)=>{const angle=j/rockSides*Math.PI*2,rr=radius*[.96,.94,.75,.51,.16][ring]*(.87+.12*noise(seed+j*7)),rise=[0,.20,.50,.78,1][ring];return vec(p.x+Math.cos(angle)*rr,bottom+(top-bottom)*rise,p.z+Math.sin(angle)*rr); }));
        for(let ring=0;ring<4;ring++)for(let j=0;j<rockSides;j++)b.quad(rings[ring][j],rings[ring][(j+1)%rockSides],rings[ring+1][j],rings[ring+1][(j+1)%rockSides]);
        for(let j=1;j<rockSides-1;j++){b.tri(rings[0][0],rings[0][j],rings[0][j+1]);b.tri(rings[4][0],rings[4][j+1],rings[4][j]);}
      },'terrain');
      groundedDetails.push({kind:'rooted-low-layered-talus',component,footprint:footprint.map(tuple),bottom,terrainLow:ext.low,terrainHigh:ext.high});props.push({kind:'roadside-rock',x:p.x,y:bottom,z:p.z,radius});rhythm.rocks++;
    }
  }
  // Deliberate roadside planting pockets replace geometry spent on four-tier
  // nine-sided spruce crowns. The six-sided three-tier silhouettes keep the
  // original spruce height envelope, with valley groups deliberately reframed, funding large visible color
  // masses rather than distant micro-detail. No route or camera source changes.
  const crownSolid=(kind:string,b:LandMeshBatch,p:pc.Vec3,radius:number,height:number,seed:number,sides=8)=>record(kind,b,()=>{
    const at=(j:number,y:number,r:number)=>{const a=j/sides*Math.PI*2+seed,rr=radius*r*(.86+.14*noise(seed+j*19+y*11));return vec(p.x+Math.cos(a)*rr+Math.sin(seed+y*7)*radius*.09,p.y+y*height,p.z+Math.sin(a)*rr+Math.cos(seed+y*9)*radius*.09);};
    const rings=[[-.28,.66],[.12,1],[.53,.63]].map(([y,r])=>Array.from({length:sides},(_,j)=>at(j,y,r))),bottom=p.clone().add(vec(0,-.48*height,0)),top=p.clone().add(vec(Math.sin(seed)*radius*.18,.76*height,Math.cos(seed)*radius*.16));
    const tri=(a:pc.Vec3,c:pc.Vec3,d:pc.Vec3)=>{const normal=new pc.Vec3().cross(c.clone().sub(a),d.clone().sub(a)),out=a.clone().add(c).add(d).mulScalar(1/3).sub(p);if(normal.dot(out)>0)b.tri(a,c,d);else b.tri(a,d,c);};
    for(let j=0;j<sides;j++){const k=(j+1)%sides;tri(bottom,rings[0][k],rings[0][j]);tri(top,rings[2][j],rings[2][k]);for(let ring=0;ring<2;ring++){tri(rings[ring][j],rings[ring][k],rings[ring+1][j]);tri(rings[ring][k],rings[ring+1][k],rings[ring+1][j]);}}
  },'vegetation');
  // Each pocket has a broad back layer and an uneven low roadward edge. Gaps
  // are authored between pockets; the inside apex and exposed viaduct stay open.
  const plantingPockets=[
    {fraction:.040,side:-1,offset:18,count:3,height:16,rose:7},
    {fraction:.035,side:1,offset:17,count:0,height:0,rose:8},
    {fraction:.060,side:1,offset:22,count:3,height:18,rose:7},
    {fraction:.083,side:-1,offset:19,count:3,height:14,rose:5},
    {fraction:.153,side:1,offset:23,count:3,height:16,rose:5},
    {fraction:.255,side:-1,offset:27,count:3,height:12,rose:4},
    {fraction:.545,side:-1,offset:19,count:3,height:20,rose:7},
    {fraction:.575,side:1,offset:22,count:3,height:18,rose:7},
    {fraction:.610,side:-1,offset:21,count:3,height:15,rose:4},
    {fraction:.662,side:1,offset:23,count:3,height:17,rose:4},
    {fraction:.705,side:-1,offset:21,count:3,height:17,rose:7},
    {fraction:.737,side:1,offset:23,count:3,height:15,rose:5},
    {fraction:.805,side:-1,offset:26,count:3,height:13,rose:4},
  ];
  for(const [group,pocket]of plantingPockets.entries()){
    for(let member=0;member<pocket.count;member++){
      const seed=201+group*71+member*13,d=pocket.fraction*track.length+[-6,1,6][member],radius=4.3+noise(seed)*1.1,p=point(d,pocket.side*(track.halfWidthAt(d)+pocket.offset+[3,0,5][member])),height=pocket.height*[1.04,.71,.90][member]*(.90+noise(seed+1)*.20);
      if(!track.clearAt(p.x,p.z,radius+2)||Math.hypot(p.x-lookoutSite.x,p.z-lookoutSite.z)<24+radius)continue;
      const footprint=rect(p,.9,.9),ext=terrainExtents(footprint);p.y=ext.low-.35;assembly='rowan-pocket-'+group+'-'+member;const first=components.length;
      const trunk=box('rowan-grounded-branching-trunk',bark,p.clone().add(vec(0,height*.31,0)),vec(.68,height*.62,.68),noise(seed)*Math.PI,'vegetation');
      groundedDetails.push({kind:'rowan-grounded-branching-trunk',component:trunk,footprint:footprint.map(tuple),bottom:p.y,terrainLow:ext.low,terrainHigh:ext.high});
      const at=local(p,track.sample(d).angle),foliage=member===1?pineTips:gold;
      const lobes=[{x:0,y:.73,z:0,r:.78,h:.44},{x:-radius*.52,y:.59,z:radius*.14,r:.67,h:.36},{x:radius*.49,y:.57,z:-radius*.12,r:.66,h:.38}];
      let mainCrown=-1;
      for(const [lobe,spec]of lobes.entries()){
        const center=at(spec.x,height*spec.y,spec.z),crown=crownSolid('rowan-overlapping-irregular-crown-lobe',foliage,center,radius*spec.r,height*spec.h,seed+lobe*2.7,6);
        if(lobe===0){mainCrown=crown;contact('rowan-high-crown-trunk-bearing',crown,trunk,at(0,height*.58,0));}
        // This eastern-bank outer lobe already has a genuine crown overlap.
        // Omit its redundant fork: the finite external-face audit found no
        // visible witness for that extra geometry. Do not exempt the test.
        else if(group===4&&member===0&&lobe===2)contact('rowan-overlapping-lobe-bearing',crown,mainCrown,center);
        else{const branch=beam('rowan-visible-fork-branch',bark,at(0,height*.39,0),center,.32,.32,'vegetation');contact('rowan-branch-trunk-joint',branch,trunk,at(0,height*.39,0));contact('rowan-crown-branch-bearing',crown,branch,center);}
      }
      assemblies.push({id:assembly,components:Array.from({length:components.length-first},(_,i)=>first+i),closed:false});assembly=undefined;props.push({kind:'golden-rowan',x:p.x,y:p.y,z:p.z,radius});
    }
    // One broad exposed stone anchors selected planting islands. These are
    // meter-scale base masses, using existing granite rather than more colors.
    if(group<8&&pocket.count>0){
      const d=pocket.fraction*track.length-2,p=point(d,pocket.side*(track.halfWidthAt(d)+18)),radius=2.8,footprint=Array.from({length:6},(_,i)=>vec(p.x+Math.cos(i/6*Math.PI*2)*radius,p.y,p.z+Math.sin(i/6*Math.PI*2)*radius));
      if(track.clearAt(p.x,p.z,radius+2)&&Math.hypot(p.x-lookoutSite.x,p.z-lookoutSite.z)>19+radius){
        const ext=terrainExtents(footprint),bottom=ext.low-.22,component=record('planting-island-grounded-granite',paleCliff,()=>{
          const rim=footprint.map(p=>vec(p.x,bottom,p.z)),peak=vec(p.x+.35,ext.high+2.2,p.z-.3);for(let i=0;i<6;i++)paleCliff.tri(rim[i],peak,rim[(i+1)%6]);for(let i=1;i<5;i++)paleCliff.tri(rim[0],rim[i],rim[i+1]);
        },'terrain');groundedDetails.push({kind:'planting-island-grounded-granite',component,footprint:footprint.map(tuple),bottom,terrainLow:ext.low,terrainHigh:ext.high});
      }
    }
    for(let member=0;member<pocket.rose;member++){
      const seed=507+group*37+member*17,d=pocket.fraction*track.length+[-7,-3,2,6,-4,1,5,9][member],radius=2.8+noise(seed)*1.2,p=point(d,pocket.side*(track.halfWidthAt(d)+(pocket.count===0?12:15)+(pocket.count===0?[0,4,8,5,12,14,17,18]:[0,2,0,3,6,6,7,1])[member])),footprint=Array.from({length:8},(_,j)=>vec(p.x+Math.cos(j/8*Math.PI*2)*radius,p.y,p.z+Math.sin(j/8*Math.PI*2)*radius));
      if(!track.clearAt(p.x,p.z,radius+2)||Math.hypot(p.x-lookoutSite.x,p.z-lookoutSite.z)<19+radius)continue;
      const ext=terrainExtents(footprint),bottom=ext.low-.22,top=ext.high+1.8+noise(seed+2)*1.15,center=vec(p.x,bottom+(top-bottom)*.48/1.24,p.z),component=crownSolid('autumn-copper-rooted-shrub',member%5===0?coral:member%5===3?gold:pineTips,center,radius,(top-bottom)/1.24,0,group===0&&member>=4?6:8);
      groundedDetails.push({kind:'autumn-copper-rooted-shrub',component,footprint:footprint.map(tuple),bottom,terrainLow:ext.low,terrainHigh:ext.high});props.push({kind:'autumn-copper-shrub',x:p.x,y:bottom,z:p.z,radius});
    }
  }
  // A small open timber watch platform belongs to the same trailhead as the
  // chalet. Its gold hipped roof is a local arrival accent, below the skyline;
  // a real deck, rails and four founded posts explain the silhouette.
  {
    const p=local(lookoutSite,lookoutYaw)(22,0,-8);assembly='cloudridge-watch-platform';const first=components.length;
    const foot=foundation('watch-platform-whole-footprint-foundation',p,6.2,6.2,lookoutYaw,terrainHeight(p.x,p.z)+.6),at=local(vec(p.x,foot.top,p.z),lookoutYaw);
    const posts=[];for(const x of [-2,2])for(const z of [-2,2]){const post=box('watch-platform-grounded-cedar-post',wood,at(x,5.2,z),vec(.58,10.4,.58),lookoutYaw);contact('watch-platform-post-plinth-seat',post,foot.component,at(x,0,z));posts.push(post);}
    const deck=box('watch-platform-open-viewing-deck',wood,at(0,7.15,0),vec(5.4,.4,5.4),lookoutYaw,'support');for(const post of posts)contact('watch-platform-deck-post-seat',deck,post,at(0,7.15,0));
    for(const x of [-2,2]){const brace=beam('watch-platform-founded-diagonal-brace',bark,at(x,.6,-2),at(-x,6.94,-2+(x>0?.2:-.2)),.26,.26);for(const post of posts.filter((_,i)=>i%2===0))contact('watch-platform-brace-post-joint',brace,post,at(x,.6,-2));}
    for(const side of [-1,1])for(const y of [8.0,8.65]){
      const a=box('watch-platform-attached-side-rail',wood,at(side*2,y,0),vec(.2,.2,4.5),lookoutYaw,'rail'),b=box('watch-platform-attached-front-rail',wood,at(0,y,side*2),vec(4.5,.22,.22),lookoutYaw,'rail');for(const [i,post]of posts.entries()){if((i<2?-1:1)===side)contact('watch-platform-side-rail-post-joint',a,post,at(side*2,y,0));if((i%2===0?-1:1)===side)contact('watch-platform-front-rail-post-joint',b,post,at(0,y,side*2));}
    }
    const roof=record('watch-platform-golden-hipped-roof',gold,()=>{
      const bottom=[at(-3.0,10.3,-3.0),at(3.0,10.3,-3.0),at(3.0,10.3,3.0),at(-3.0,10.3,3.0)],top=at(0,13.0,0);for(let i=0;i<4;i++)gold.tri(bottom[i],top,bottom[(i+1)%4]);gold.quad(bottom[3],bottom[2],bottom[0],bottom[1]);
    });for(const post of posts)contact('watch-platform-roof-post-bearing',roof,post,at(0,10.35,0));
    const cap=box('watch-platform-copper-roof-finial',coral,at(0,13.1,0),vec(.45,.6,.45),lookoutYaw);contact('watch-platform-finial-roof-bearing',cap,roof,at(0,12.9,0));
    assemblies.push({id:assembly,components:Array.from({length:components.length-first},(_,i)=>first+i),closed:false});assembly=undefined;props.push({kind:'cloudridge-watch-platform',x:p.x,y:foot.top,z:p.z,radius:4.4});
  }
  // The original valley destination becomes one asymmetric, legible building,
  // rather than repeating chalet props around the loop. Its full stone apron
  // has an exact whole-footprint field foundation, including both reused props.
  assembly='valley-lookout';const chaletFirst=components.length;
  const pad=foundation('lookout-whole-footprint-stepped-foundation',lookoutSite,24,20,lookoutYaw,lookoutSite.y),at=local(vec(lookoutSite.x,pad.top,lookoutSite.z),lookoutYaw);
  const put=(kind:string,b:LandMeshBatch,x:number,y:number,z:number,sx:number,sy:number,sz:number,role:Role='structure')=>box(kind,b,at(x,y,z),vec(sx,sy,sz),lookoutYaw,role);
  const bedding=put('lookout-pale-masonry-bedding',lightStone,0,.16,0,24.12,.32,20.12,'support');contact('apron-bedding-to-foundation',bedding,pad.component,at(0,0,0));
  const lower=put('lookout-solid-masonry-ground-floor',stone,-3,1.46,-1,10.8,2.28,8),upper=put('lookout-cedar-upper-storey',wood,-3,4.075,-1,10.8,2.95,8);
  contact('main-wall-to-apron',lower,bedding,at(-3,.32,-1));contact('upper-storey-to-ground-storey',upper,lower,at(-3,2.6,-1));
  // Broad stone bed joints are actual recessed courses, not floating skins.
  for(const [y,depth]of [[.93,.12],[1.66,.12],[2.4,.16]])for(const z of [-5,3]){const course=put('lookout-recessed-masonry-bed-course',lightStone,-3,y,z,10.78,depth,.10,'detail');contact('masonry-course-embedded-in-wall',course,lower,at(-3,y,z));}
  const prism=(kind:string,b:LandMeshBatch,profile:number[][],front:number,back:number)=>record(kind,b,()=>{
    const a=profile.map(p=>at(p[0],p[1],front)),c=profile.map(p=>at(p[0],p[1],back));
    for(let i=1;i<profile.length-1;i++){b.tri(a[0],a[i],a[i+1]);b.tri(c[0],c[i+1],c[i]);}
    for(let i=0;i<profile.length;i++){const j=(i+1)%profile.length;b.quad(a[i],a[j],c[i],c[j]);}
  });
  const roofHeight=(x:number)=>x<=-4.1?5.5+(8.75-5.5)*(x+9.2)/5.1:8.75+(5.5-8.75)*(x+4.1)/7.3;
  const gable=prism('lookout-solid-asymmetric-gable',wood,[[-8.4,5.55],[-8.4,roofHeight(-8.4)-.2],[-4.1,8.55],[2.4,roofHeight(2.4)-.2],[2.4,5.55]],-5,3);
  contact('gable-to-upper-storey',gable,upper,at(-3,5.55,-1));
  const roofLeft=prism('lookout-solid-west-overhanging-roof',red,[[-9.2,5.3],[-9.2,5.5],[-4.1,8.75],[-4.1,8.55]],-5.95,6.0),roofRight=prism('lookout-solid-east-overhanging-roof',red,[[-4.1,8.55],[-4.1,8.75],[3.2,5.5],[3.2,5.3]],-5.95,6.0);
  contact('west-roof-gable-bearing',roofLeft,gable,at(-6,roofHeight(-6)-.2,-1));contact('east-roof-gable-bearing',roofRight,gable,at(0,roofHeight(0)-.2,-1));
  const ridge=put('lookout-roof-ridge-cap',darkStone,-4.1,8.78,.025,.28,.22,12.15);contact('roof-ridge-cap-to-roof',ridge,roofLeft,at(-4.1,8.70,-1));
  for(const z of [-5.55,-3.8,-1.4,1.0,3.58])for(const [x0,x1,roof]of [[-9.05,-4.1,roofLeft],[-4.1,3.05,roofRight]]){
    // Preserve the original perpendicular eave ends and sloped beam depth,
    // but cut both ridge ends on one actual vertical joint plane. Their side
    // skins now stop at the joint instead of overlapping coflush rectangles.
    const slope=(roofHeight(x1)-roofHeight(x0))/(x1-x0),cosine=1/Math.hypot(1,slope),normal=[-slope*cosine*.09,cosine*.09];
    const end=(x:number,upper:boolean)=>x===-4.1?[x,roofHeight(x)-.26+(upper?1:-1)*.09/cosine]:[x+(upper?1:-1)*normal[0],roofHeight(x)-.26+(upper?1:-1)*normal[1]];
    const rafter=prism('lookout-visible-eave-rafter',bark,[end(x0,false),end(x1,false),end(x1,true),end(x0,true)],z-.11,z+.11);contact('roof-rafter-bearing',rafter,roof,at((x0+x1)/2,roofHeight((x0+x1)/2)-.2,z));
  }
  // Inset amber apertures and load-bearing jambs remain readable at road scale.
  for(const z of [-5.035,3.035])for(const x of [-6.7,-3.0,.7]){
    const pane=put('lookout-inset-amber-window',glass,x,4.05,z,2.25,1.55,.12,'detail');contact('window-embedded-wall-seat',pane,upper,at(x,4.05,z));
    for(const side of [-1,1]){const jamb=put('lookout-window-jamb',bark,x+side*1.20,4.05,z, .15,1.8,.22,'detail');contact('jamb-to-wall',jamb,upper,at(x+side*1.2,4.05,z));}
    for(const y of [3.2,4.9]){const frame=put('lookout-window-head-and-sill',wood,x,y,z,2.25,.16,.24,'detail');contact('window-frame-to-wall',frame,upper,at(x,y,z));}
  }
  const door=put('lookout-grounded-recessed-entry',bark,-3,1.36,3.035,1.8,2.08,.12,'detail');contact('entry-door-to-ground-floor',door,lower,at(-3,1.36,3.0));
  // A genuine roadward balcony and front king-post truss give the original
  // chalet a legible inhabited facade. Every load path is modeled, not painted.
  const balcony=put('lookout-roadward-balcony-deck',wood,-3,2.55,4.4,12,.22,2.84,'support');contact('balcony-inner-ledger-to-wall',balcony,lower,at(-3,2.55,3.10));
  const porchColumns:number[]=[];
  for(const x of [-8.4,-4.8,-1.2,2.4]){const post=put('lookout-grounded-balcony-post',bark,x,1.38,5.5,.28,2.12,.28,'support');contact('balcony-post-apron-bearing',post,bedding,at(x,.32,5.5));contact('balcony-post-deck-bearing',post,balcony,at(x,2.44,5.5));porchColumns.push(post);}
  const upperColumns:number[]=[];for(const x of [-8.4,2.4]){const post=put('lookout-porch-upper-load-bearing-post',wood,x,4.0,5.5,.28,2.68,.28,'support');contact('upper-porch-post-balcony-bearing',post,balcony,at(x,2.66,5.5));upperColumns.push(post);}
  const tie=put('lookout-exposed-front-truss-tie',bark,-3,5.45,5.5,11.75,.22,.26,'support');for(const post of upperColumns){const c=components[post];contact('front-truss-to-porch-post',tie,post,vec((c.min[0]+c.max[0])/2,pad.top+5.34,(c.min[2]+c.max[2])/2));}
  const king=put('lookout-exposed-front-truss-king-post',wood,-4.1,7.055,5.5,.26,2.99,.26,'support');contact('king-post-tie-bearing',king,tie,at(-4.1,5.56,5.5));contact('king-post-roof-ridge-bearing',king,roofLeft,at(-4.1,8.55,5.5));
  for(const x of [-8.35,2.35]){const diagonal=beam('lookout-exposed-front-truss-diagonal',wood,at(x,5.49,5.5),at(-4.1,8.45,5.5),.20,.22,'support');contact('truss-diagonal-tie-bearing',diagonal,tie,at(x,5.49,5.5));contact('truss-diagonal-king-bearing',diagonal,king,at(-4.1,8.45,5.5));}
  const balusters:number[]=[];for(const x of [-6.6,-4.8,-3,-1.2,.6]){const post=put('lookout-balcony-attached-baluster',wood,x,3.20,5.55,.12,1.08,.12,'rail');contact('baluster-deck-bearing',post,balcony,at(x,2.66,5.55));balusters.push(post);}
  for(const y of [3.03,3.7]){const railing=put('lookout-balcony-continuous-rail',wood,-3,y,5.55,11.1,.14,.14,'rail');for(const post of [...upperColumns,...balusters]){const c=components[post];contact('balcony-rail-post-joint',railing,post,vec((c.min[0]+c.max[0])/2,pad.top+y,(c.min[2]+c.max[2])/2));}}
  for(const [z,depth,top]of [[11.075,.55,-.18],[10.4,.8,.07]]){const step=foundation('lookout-founded-trailhead-stair',at(0,0,z),3,depth,lookoutYaw,pad.top+top);if(z<10.5)contact('trailhead-stair-to-apron',step.component,bedding,at(0,.03,10.03));}
  // The east side is an open lookout canopy. Individual posts/rafters/roof are
  // blockers; there is intentionally no bounding box across the open arcade.
  const canopyDeck=put('lookout-open-canopy-stone-landing',lightStone,7.15,.49,-1.0,8.9,.34,8.8,'support');contact('canopy-landing-apron-bearing',canopyDeck,bedding,at(7.15,.32,-1));
  const canopyRoof=prism('lookout-low-sloping-canopy-roof',red,[[2.8,5.44],[2.8,5.64],[11.3,4.24],[11.3,4.04]],-5.85,3.85);
  const canopyY=(x:number)=>5.44+(4.04-5.44)*(x-2.8)/8.5;
  for(const x of [3.25,10.65])for(const z of [-4.8,2.8]){
    const footing=put('lookout-canopy-post-stone-shoe',stone,x,.88,z,.82,.44,.82,'support'),top=canopyY(x)-.16,post=put('lookout-canopy-grounded-timber-post',wood,x,(1.1+top)/2,z,.34,top-1.1,.34,'support');
    contact('canopy-shoe-to-landing',footing,canopyDeck,at(x,.66,z));contact('canopy-post-to-shoe',post,footing,at(x,1.1,z));
    const head=put('lookout-canopy-wide-bearing-head',bark,x,top+.08,z,.60,.16,.65,'support');contact('canopy-head-post-bearing',head,post,at(x,top,z));contact('canopy-head-roof-bearing',head,canopyRoof,at(x,canopyY(x),z));
    const brace=beam('lookout-canopy-knee-brace',wood,at(x,top-.8,z),at(x+(x<7?.65:-.65),canopyY(x+(x<7?.65:-.65))-.11,z),.20,.20);contact('canopy-knee-post-bearing',brace,post,at(x,top-.8,z));
  }
  for(const z of [-5.45,-2.8,0,3.45]){const rafter=beam('lookout-canopy-cross-rafter',bark,at(2.95,canopyY(2.95)-.08,z),at(11.15,canopyY(11.15)-.08,z),.18,.20);contact('canopy-rafter-roof-bearing',rafter,canopyRoof,at(7,canopyY(7),z));}
  const chimney=put('lookout-founded-stone-chimney',stone,-.65,5.34,-2.5,1.15,10.04,1.1),chimneyCap=put('lookout-chimney-weather-cap',darkStone,-.65,10.49,-2.5,1.52,.26,1.48);
  contact('chimney-ground-apron-bearing',chimney,bedding,at(-.65,.32,-2.5));contact('chimney-cap-shaft-bearing',chimneyCap,chimney,at(-.65,10.36,-2.5));
  // Low meadow-side fence avoids enclosing the roadway or hiding the building.
  for(const x of [-11.35,11.35]){
    const posts:{component:number;z:number}[]=[];for(const z of [-8.8,-4.4,0,4.4,8.8]){const post=put('lookout-apron-grounded-fence-post',wood,x,1.06,z,.23,1.48,.23,'rail');contact('fence-post-apron-bearing',post,bedding,at(x,.32,z));posts.push({component:post,z});}
    for(const y of [.83,1.58]){const beam=put('lookout-meadow-fence-rail',wood,x,y,0,.15,.15,17.85,'rail');for(const post of posts)contact('fence-rail-post-joint',beam,post.component,at(x,y,post.z));}
  }
  const lookout:MountainSceneGeometry['lookout']={position:[lookoutSite.x,pad.top,lookoutSite.z],yaw:lookoutYaw,platformComponent:pad.component,accentPlacements:[]};
  const reusedProps:MountainSceneGeometry['reusedProps']=[];
  const materialFamilies={wood,bark,stone,darkStone,lightStone,white,red,yellow,pine,pineTips,glass};
  for(const placement of [{kind:'04_ridge_picnic_table' as const,x:-6.5,z:7.4,yaw:.07},{kind:'12_ranger_relief_map_station' as const,x:6.25,z:7.15,yaw:Math.PI}]){
    const prop=getAlpineProp(placement.kind),origin=at(placement.x,.32,placement.z),yaw=lookoutYaw+placement.yaw;
    const width=prop.bounds.max[0]-prop.bounds.min[0]+.40,depth=prop.bounds.max[2]-prop.bounds.min[2]+.40;
    const propPad=box('lookout-alpine-prop-full-support-pad',lightStone,origin.clone().add(vec(0,.09,0)),vec(width,.18,depth),yaw,'support');contact('alpine-pad-to-apron',propPad,bedding,origin);
    // A 3 cm bedding embed seats authored secondary feet without deforming any
    // source mesh. All support-band witnesses are retained for independent QA.
    origin.y+=.18-prop.bounds.min[1]-.03;const transform=local(origin,yaw),first=components.length,primitives:MountainSceneGeometry['reusedProps'][number]['primitives']=[];
    for(const source of prop.materials){const b=materialFamilies[source.family],v=b.positions.length/3,k=b.indices.length;for(let i=0;i<source.positions.length;i+=3)b.vertex(transform(source.positions[i],source.positions[i+1],source.positions[i+2]),[source.uvs[i/3*2],source.uvs[i/3*2+1]]);for(const index of source.indices)b.indices.push(v+index);const component=bound('selected-alpine-'+prop.kind,b,v,k,'detail',false);primitives.push({component,sourcePrimitive:source.sourcePrimitive,sourceMaterial:source.sourceMaterial});}
    const ids=Array.from({length:components.length-first},(_,i)=>first+i),integrationSupports:MountainSceneGeometry['reusedProps'][number]['integrationSupports']=[];
    const source=(id:number)=>primitives.find(p=>p.sourcePrimitive===id)!.component;
    const spacer=(kind:string,b:LandMeshBatch,x:number,y:number,z:number,sx:number,sy:number,sz:number,joins:number[],externalDetail=false)=>{const center=transform(x,y,z),component=box(kind,b,center,vec(sx,sy,sz),yaw,externalDetail?'detail':'support');for(const id of joins)contact(kind+'-actual-seat',component,source(id),center);integrationSupports.push({kind,component,joins:joins.map(source),...(externalDetail?{externalDetail:true}:{})});};
    if(prop.kind==='04_ridge_picnic_table'){
      // The original folded cloth and central plank share two narrow outer
      // strips. A real coral binding covers each contact edge without changing
      // any source triangle; these visible trims retain external-ray auditing.
      for(const z of [-.9,.9])spacer('selected-alpine-picnic-coral-edge-binding',red,-.131,.8465154,z,.008,.068,.008,[3,1],true);
    }
    if(prop.kind==='12_ranger_relief_map_station'){
      // These tiny backing pieces repair authored relief-layer gaps without
      // touching any original primitive, transform, index or material record.
      for(const x of [-.55,.55])spacer('selected-alpine-board-backing-stand-off',bark,x,1.58,-.05875,.08,.10,.006,[3,2]);
      spacer('selected-alpine-lake-relief-boss',darkStone,-.35,1.28,.01275,.04,.04,.0145,[5,3]);
      for(const [x,z]of [[-.36,1.79],[.09,1.76],[.42,1.82]])spacer('selected-alpine-snowcap-relief-boss',white,x,z+.18,.0275,.015,.015,.006,[3,4]);
      spacer('selected-alpine-trail-pin-backing',yellow,.22,1.27,.025,.018,.018,.039,[7,3]);
      for(const [x,y]of [[.46,1.128],[-.59,1.492]])spacer('selected-alpine-pine-emblem-backing',pine,x,y,.02275,.016,.016,.0345,[8,3]);
      contact('selected-alpine-sage-relief-original-overlap',source(4),source(3),transform(0,1.8,.004));
      contact('selected-alpine-trail-original-pin-joint',source(6),source(7),transform(.22,1.27,.05));
    }
    const footprint=prop.footprint.map(p=>tuple(transform(p[0],p[1],p[2]))),groundContacts=prop.groundContacts.map(p=>tuple(transform(p[0],p[1],p[2]))),supportBand=prop.supportBand.points.map(p=>tuple(transform(p[0],p[1],p[2])));
    reusedProps.push({kind:prop.kind,sourceFile:prop.source.file,sourceSha256:prop.source.sha256,position:tuple(origin),yaw,footprint,groundContacts,supportBand,pad:propPad,components:ids,primitives,integrationSupports});lookout.accentPlacements.push({kind:prop.kind,position:tuple(origin),yaw});
    const radius=Math.max(...footprint.map(p=>Math.hypot(p[0]-origin.x,p[2]-origin.z)));props.push({kind:'selected-alpine-'+prop.kind,x:origin.x,y:origin.y,z:origin.z,radius});
  }
  props.push({kind:'lookout-chalet',x:lookoutSite.x,y:pad.top,z:lookoutSite.z,radius:16.4});
  assemblies.push({id:assembly,components:Array.from({length:components.length-chaletFirst},(_,i)=>chaletFirst+i),closed:false});assembly=undefined;
  // Three restrained advance-chevron groups reinforce EXISTING bends. Their
  // faces point upstream and arrows follow the next source tangent; none mark
  // a trail or alternative course. Each post is actually rooted in the field.
  for(const [bend,fraction]of [.155,.695,.795].entries())for(let marker=0;marker<3;marker++){
    const d=(fraction*track.length)+marker*14,s=track.sample(d),ahead=track.sample(d+30),turn=Math.sign(Math.sin(ahead.angle-s.angle))||1,side=-turn,w=track.halfWidthAt(d),p=point(d,side*(w+6.8));
    if(!track.clearAt(p.x,p.z,2.1)||Math.hypot(p.x-lookoutSite.x,p.z-lookoutSite.z)<23)continue;
    assembly='bend-chevron-'+bend+'-'+marker;const first=components.length,at=local(vec(p.x,s.p.y+1.95,p.z),s.angle);
    const panel=box('bend-chevron-solid-backed-panel',darkStone,at(0,0,0),vec(3.4,1.4,.15),s.angle,'detail');
    for(const x of [-1.1,1.1]){const foot=at(x,0,.08),footprint=rect(foot,.24,.24,s.angle),ext=terrainExtents(footprint),bottom=ext.low-.25,top=s.p.y+2.45,post=box('bend-chevron-grounded-post',wood,vec(foot.x,(bottom+top)/2,foot.z),vec(.18,top-bottom,.18),s.angle,'support');groundedDetails.push({kind:'bend-chevron-grounded-post',component:post,footprint:footprint.map(tuple),bottom,terrainLow:ext.low,terrainHigh:ext.high});contact('chevron-panel-post-bearing',panel,post,at(x,0,.05));}
    for(const offset of [-.73,.73]){
      // Exact planar union of the two original stroke rectangles. Splitting
      // their common tip on y=0 keeps the accepted outline but removes the
      // overlapping outward skins; the result is one closed amber inlay.
      const halves=[1,-1].map(sign=>{
        const a=[offset-turn*.40,sign*.43],b=[offset+turn*.40,0],vx=b[0]-a[0],vy=b[1]-a[1],length=Math.hypot(vx,vy),normal=[-vy/length*.12,vx/length*.12],polygon=[[a[0]-normal[0],a[1]-normal[1]],[b[0]-normal[0],b[1]-normal[1]],[b[0]+normal[0],b[1]+normal[1]],[a[0]+normal[0],a[1]+normal[1]]],clipped:number[][]=[];
        for(let i=0;i<polygon.length;i++){const p=polygon[i],q=polygon[(i+1)%polygon.length],d=p[1]*sign,e=q[1]*sign;if(d>=0)clipped.push(p);if((d>=0)!==(e>=0)){const t=d/(d-e);clipped.push([p[0]+(q[0]-p[0])*t,0]);}}
        const joint=clipped.findIndex((p,i)=>p[1]===0&&clipped[(i+1)%clipped.length][1]===0);return Array.from({length:clipped.length},(_,i)=>clipped[(joint+1+i)%clipped.length]);
      }),profile=[...halves[0],...halves[1].slice(1,-1)];
      const stripe=record('bend-chevron-continuous-amber-inlay',yellow,()=>{
        const front=profile.map(p=>at(p[0],p[1],-.1425)),back=profile.map(p=>at(p[0],p[1],-.0675)),remaining=profile.map((_,i)=>i),cross=(a:number[],b:number[],c:number[])=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
        while(remaining.length>2){let cut=false;for(let j=0;j<remaining.length;j++){const a=remaining[(j+remaining.length-1)%remaining.length],b=remaining[j],c=remaining[(j+1)%remaining.length];if(cross(profile[a],profile[b],profile[c])<=1e-12)continue;if(remaining.some(k=>k!==a&&k!==b&&k!==c&&cross(profile[a],profile[b],profile[k])>=-1e-12&&cross(profile[b],profile[c],profile[k])>=-1e-12&&cross(profile[c],profile[a],profile[k])>=-1e-12))continue;yellow.tri(front[a],front[b],front[c]);yellow.tri(back[a],back[c],back[b]);remaining.splice(j,1);cut=true;break;}if(!cut)throw new Error('Mountain chevron union must triangulate completely');}
        for(let i=0;i<profile.length;i++){const j=(i+1)%profile.length;yellow.quad(front[i],front[j],back[i],back[j]);}
      },'detail');contact('chevron-inlay-panel-seat',stripe,panel,at(offset,0,-.075));
    }
    assemblies.push({id:assembly,components:Array.from({length:components.length-first},(_,i)=>first+i),closed:false});assembly=undefined;props.push({kind:'advance-bend-chevron',x:p.x,y:terrainHeight(p.x,p.z),z:p.z,radius:2.1});
  }
  // One immutable triangle array uses the existing camera helper's spatial
  // index once per query. It preserves every emitted face, winding and open
  // gap; its bounds are metadata, never a filled world-sized collision box.
  const cameraMembers=components.filter(c=>c.kind!=='connected-contour-terrain'),cameraMin=[Infinity,Infinity,Infinity],cameraMax=[-Infinity,-Infinity,-Infinity];
  for(const c of cameraMembers)for(let k=0;k<3;k++){cameraMin[k]=Math.min(cameraMin[k],c.min[k]);cameraMax[k]=Math.max(cameraMax[k],c.max[k]);}
  cameraObstacles.push({kind:'mountain-actual-complete-indexed-mesh',min:cameraMin,max:cameraMax,triangles:cameraMembers.flatMap(faceTriangles)});
  const used=batches.filter(b=>b.indices.length),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const b of used)for(let i=0;i<b.positions.length;i++){const axis=i%3;min[axis]=Math.min(min[axis],b.positions[i]);max[axis]=Math.max(max[axis],b.positions[i]);}
  const budget={batches:used.length,triangles:used.reduce((n,b)=>n+b.indices.length/3,0),vertices:used.reduce((n,b)=>n+b.positions.length/3,0)};
  return{version:1,trackId:track.id,batches:used,roadSamples,props,structures,bounds:{min,max},components,cameraObstacles,terrainGrid,terrainPartitions,roadFaces,foundations,contacts,groundedDetails,landforms,sectionRhythms,assemblies,lookout,reusedProps,budget};
}
