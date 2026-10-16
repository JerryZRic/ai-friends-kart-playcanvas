import * as pc from 'playcanvas';
import type {LandSample} from './land-track';
import type {LandSceneGeometry, LandPropPlacement} from './land-scenery';
import type {LandSceneTheme} from './land-scene';
import {LandMeshBatch as Batch, cylinder, ellipsoid} from './land-mesh-builder';

/** Structural contract keeps the renderer independent from race cursor state. */
export interface TownSceneryEdge {
  readonly id: string; readonly length: number;
  sample(s: number, lateral?: number): LandSample;
  halfWidthAt(s: number): number;
}
export interface TownSceneryCourse {
  readonly id: string;
  readonly commonStart: TownSceneryEdge;
  readonly alternates: Readonly<{alley: TownSceneryEdge; boulevard: TownSceneryEdge}>;
  readonly commonFinish: TownSceneryEdge;
}
export interface TownCameraObstacle {kind: string; min: number[]; max: number[]; triangles?:readonly (readonly (readonly number[])[])[]}
export interface TownSceneGeometry extends LandSceneGeometry {
  routeRoadSamples: {edgeId: string; distance: number; left: number[]; right: number[]; rendered: boolean}[];
  roadFaces: {edgeId:string; distance:number; points:number[][]}[];
  foundations: {kind:string;top:number;bottom:number;footprint:number[][];masonryVertexStart:number;pavingVertexStart:number}[];
  cameraObstacles: TownCameraObstacle[];
  landmarks: {kind: string; label: string; position: number[]}[];
  polishDetails:{kind:string;batch:string;vertexStart:number;vertexEnd:number;triangles:number}[];
}
export const TOWN_SCENE_THEME: Readonly<LandSceneTheme> = Object.freeze({
  textureLabel: 'lantern town', ambient: '#d8c9ad', sky: '#ecdac3', fogStart: 440, fogEnd: 1200,
  cameraName: 'Lantern Terrace chase camera', sunName: 'Lantern Terrace warm evening key light',
  sunColor: '#ffe6bb', sunIntensity: 1.65, sunEuler: [42,-55,0] as const,
});
export const TOWN_THEME=TOWN_SCENE_THEME;
const vec=(x:number,y:number,z:number)=>new pc.Vec3(x,y,z);
const tuple=(p:pc.Vec3)=>[p.x,p.y,p.z];
const noise=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
const edgesOf=(course:TownSceneryCourse)=>[course.commonStart,course.alternates.alley,course.alternates.boulevard,course.commonFinish];

/** Convex footprint difference. Intersections retain interpolated SOURCE Y;
 * it removes covered geometry instead of lifting one road to hide z-fighting. */
function subtractFootprint(subject:pc.Vec3[], cutter:pc.Vec3[]):pc.Vec3[][] {
  const cross=(a:pc.Vec3,b:pc.Vec3,p:pc.Vec3)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
  const orientation=Math.sign(cross(cutter[0],cutter[1],cutter[2]))||1;
  const cut=(poly:pc.Vec3[],a:pc.Vec3,b:pc.Vec3,inside:boolean)=>{
    const result:pc.Vec3[]=[];
    for(let i=0;i<poly.length;i++){
      const p=poly[i],q=poly[(i+1)%poly.length],dp=cross(a,b,p)*orientation,dq=cross(a,b,q)*orientation;
      const ip=inside?dp>=0:dp<=0,iq=inside?dq>=0:dq<=0;
      if(ip)result.push(p);if(ip!==iq)result.push(p.clone().lerp(p,q,dp/(dp-dq)));
    }return result;
  };
  const fragments:pc.Vec3[][]=[];let remaining=subject;
  for(let i=0;i<cutter.length&&remaining.length>=3;i++){
    const a=cutter[i],b=cutter[(i+1)%cutter.length],outside=cut(remaining,a,b,false);
    if(outside.length>=3)fragments.push(outside);remaining=cut(remaining,a,b,true);
  }return fragments;
}
const projectedArea=(poly:pc.Vec3[])=>Math.abs(poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p.x*q.z-q.x*p.z;},0))/2;

/** Original warm trading town. Every road is emitted from its authoritative
 * open edge, including BOTH choices. Nothing uses a canonical interpolated
 * lap coordinate to infer branch geometry or the height of a bridge. */
export function buildTownSceneGeometry(course: TownSceneryCourse): TownSceneGeometry {
  const cobble=new Batch('Lantern Alley pale cobbled road','#b8ab91',.96,'asphalt');
  const boulevard=new Batch('Tram Boulevard dark paved road','#66675e',.98,'asphalt');
  const common=new Batch('Market and civic warm stone road','#a19a87',.98,'asphalt');
  const paving=new Batch('Cream sidewalk coping and civic columns','#f0dfbd',.96,'stone');
  const masonry=new Batch('Ochre terrace retaining masonry','#c6ae87',1,'stone');
  const dark=new Batch('Street bridge soffit and shadowed masonry','#858d89',1,'stone');
  const ground=new Batch('Town garden earth and distant terraces','#a9b283',1,'grass');
  const cream=new Batch('Ivory plaster facades','#f3e3be',.97,'none');
  const peach=new Batch('Warm apricot plaster facades','#e5b48b',.97,'none');
  const rose=new Batch('Dusty rose plaster facades','#d9aaa0',.97,'none');
  const roof=new Batch('Terracotta tiled roofs and chimney caps','#cf7856',.97,'none');
  const wood=new Batch('Timber shop beams eaves and market counters','#87644a',.94,'wood');
  const teal=new Batch('Teal shutters doors balcony rails and tram','#3c9692',.7,'wood');
  const glass=new Batch('Deep blue shop windows and clock faces','#416779',.3,'none',.15);
  const brass=new Batch('Copper lantern frames and tram trim','#d9ae6d',.46,'none',.58);
  const glow=new Batch('Warm lantern panes and clock hands','#ffe3a0',.43);
  const plum=new Batch('Plum market awnings','#b97e95',.96,'wood');
  const linen=new Batch('Ivory market canopy stripes and race markings','#f4dfae',.96);
  const foliage=new Batch('Citrus tree rounded foliage','#75a368',1,'grass');
  const fruit=new Batch('Orange fruit and market produce','#f3b947',.83);
  const batches=[cobble,boulevard,common,paving,masonry,dark,ground,cream,peach,rose,roof,wood,teal,glass,brass,glow,plum,linen,foliage,fruit];
  // Town-local metre UVs distinguish small masonry courses from calm plaster.
  // This touches material coordinates only; every protected position/index stays exact.
  for(const batch of [paving,masonry]){
    const box=batch.box.bind(batch);
    batch.box=(p,size,yaw=0)=>{
      const start=batch.positions.length/3;box(p,size,yaw);
      const spans=[[size.x,size.y],[size.x,size.y],[size.z,size.y],[size.z,size.y],[size.x,size.z],[size.x,size.z]];
      for(let face=0;face<6;face++)for(let corner=0;corner<4;corner++){
        const i=(start+face*4+corner)*2;
        batch.uvs[i]=(corner%2)*spans[face][0]*.42;
        batch.uvs[i+1]=Math.floor(corner/2)*spans[face][1]*1.15;
      }
    };
  }
  const edges=edgesOf(course),props:LandPropPlacement[]=[],cameraObstacles:TownCameraObstacle[]=[],landmarks:TownSceneGeometry['landmarks']=[];
  const roadFaces:TownSceneGeometry['roadFaces']=[],foundations:TownSceneGeometry['foundations']=[];
  const polishDetails:TownSceneGeometry['polishDetails']=[];
  const polishBox=(kind:string,b:Batch,p:pc.Vec3,size:pc.Vec3,yaw:number)=>{
    const vertexStart=b.positions.length/3,indexStart=b.indices.length;b.box(p,size,yaw);
    polishDetails.push({kind,batch:b.name,vertexStart,vertexEnd:b.positions.length/3,triangles:(b.indices.length-indexStart)/3});
  };
  const roadSamples:LandSceneGeometry['roadSamples']=[],routeRoadSamples:TownSceneGeometry['routeRoadSamples']=[],structures:LandSceneGeometry['structures']=[];
  const support=edges.flatMap(edge=>Array.from({length:Math.ceil(edge.length/2)+1},(_,i)=>{
    const s=edge.length*i/Math.ceil(edge.length/2),f=edge.sample(s),half=edge.halfWidthAt(s);
    return {edge,s,p:f.p,half,low:f.p.y-Math.abs(f.n.y)*half,high:f.p.y+Math.abs(f.n.y)*half};
  }));
  const floor=Math.min(...support.map(s=>s.low))-8;
  // Includes every branch, with a conservative sampling and sidewalk margin.
  const clearAt=(p:pc.Vec3,r:number)=>support.every(s=>Math.hypot(s.p.x-p.x,s.p.z-p.z)>s.half+r+3.5);
  const freeAt=(p:pc.Vec3,r:number)=>clearAt(p,r)&&props.every(q=>Math.hypot(q.x-p.x,q.z-p.z)>q.radius+r+1.2);
  const record=(kind:string,p:pc.Vec3,radius:number,height:number,obstacle=true)=>{
    props.push({kind,x:p.x,y:p.y,z:p.z,radius});
    if(obstacle)cameraObstacles.push({kind,min:[p.x-radius,p.y-.5,p.z-radius],max:[p.x+radius,p.y+height,p.z+radius]});
  };
  const point=(edge:TownSceneryEdge,s:number,l:number,h=0)=>edge.sample(s,l).p.clone().add(vec(0,h,0));
  const junction=(edge:TownSceneryEdge,s:number)=>edge===course.commonStart?edge.length-s<100:edge===course.commonFinish?s<100:s<100||edge.length-s<100;
  // Flat ground below all streets is covered by stepped, source-following town
  // terraces. No nearest-height terrain fill can wall off the underpass.
  const minX=Math.min(...support.map(s=>s.p.x))-160,maxX=Math.max(...support.map(s=>s.p.x))+160;
  const minZ=Math.min(...support.map(s=>s.p.z))-160,maxZ=Math.max(...support.map(s=>s.p.z))+160;
  const nx=Math.ceil((maxX-minX)/10),nz=Math.ceil((maxZ-minZ)/10);
  const terrainY=(x:number,z:number)=>{
    let nearest=Infinity,height=floor,ceiling=Infinity;
    for(const q of support){const d=Math.hypot(x-q.p.x,z-q.p.z);if(d<nearest){nearest=d;height=q.low;}
      if(d<q.half+22)ceiling=Math.min(ceiling,q.low-2.4);}
    return Math.min(ceiling,floor+(height-2-floor)*Math.max(0,1-Math.max(0,nearest-12)/115));
  };
  for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++){
    const x=minX+(maxX-minX)*ix/nx,z=minZ+(maxZ-minZ)*iz/nz;
    ground.vertex(vec(x,terrainY(x,z),z));if(ix<nx&&iz<nz){const k=iz*(nx+1)+ix;ground.indices.push(k,k+nx+1,k+1,k+1,k+nx+1,k+nx+2);}
  }
  // Sample EXACT emitted boulevard triangles, not an approximate centreline
  // distance or hard-coded shared-tail length. Alley coverage is subtracted in
  // both junctions, including partial triangles at the opening of the merge.
  const owner=course.alternates.boulevard,ownerCount=Math.ceil(owner.length/1.65);
  const ownerFaces=Array.from({length:ownerCount},(_,i)=>{
    const a=i/ownerCount*owner.length,b=(i+1)/ownerCount*owner.length;
    const p=point(owner,a,-owner.halfWidthAt(a)),q=point(owner,a,owner.halfWidthAt(a)),r=point(owner,b,-owner.halfWidthAt(b)),t=point(owner,b,owner.halfWidthAt(b));
    return [[p,r,q],[q,r,t]];
  }).flat().map(points=>({points,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z)),y:points.reduce((n,p)=>n+p.y,0)/3}));
  // Camera contact uses complete emitted structural faces, never a solid box
  // across the town or its open underpass. Capture ranges at emission boundaries.
  const structuralTriangles:number[][][]=[],structuralBatches=[paving,masonry];
  const captureStructural=(starts:number[])=>{
    for(let b=0;b<structuralBatches.length;b++){
      const batch=structuralBatches[b];
      for(let i=starts[b];i<batch.indices.length;i+=3)structuralTriangles.push(batch.indices.slice(i,i+3).map(index=>batch.positions.slice(index*3,index*3+3)));
    }
  };
  const roadStructureStarts=structuralBatches.map(batch=>batch.indices.length);
  for(const edge of edges){
    const count=Math.ceil(edge.length/1.65),road=edge===course.alternates.alley?cobble:edge===course.alternates.boulevard?boulevard:common;
    for(let i=0;i<count;i++){
      const s=i/count*edge.length,t=(i+1)/count*edge.length,w=edge.halfWidthAt(s),wt=edge.halfWidthAt(t);
      const a=point(edge,s,-w),b=point(edge,s,w),c=point(edge,t,-wt),d=point(edge,t,wt);
      let polygons=[[a,c,b],[b,c,d]];
      if(edge===course.alternates.alley&&junction(edge,s)){
        const lowX=Math.min(a.x,b.x,c.x,d.x),highX=Math.max(a.x,b.x,c.x,d.x),lowZ=Math.min(a.z,b.z,c.z,d.z),highZ=Math.max(a.z,b.z,c.z,d.z),height=(a.y+b.y+c.y+d.y)/4;
        for(const owner of ownerFaces){
          if(owner.maxX<lowX||owner.minX>highX||owner.maxZ<lowZ||owner.minZ>highZ||Math.abs(owner.y-height)>1)continue;
          polygons=polygons.flatMap(poly=>subtractFootprint(poly,owner.points)).filter(poly=>projectedArea(poly)>1e-7);
          if(!polygons.length)break;
        }
      }
      const rendered=polygons.length>0;
      const sample={edgeId:edge.id,distance:s,left:tuple(a),right:tuple(b),rendered};roadSamples.push(sample);routeRoadSamples.push(sample);
      if(!rendered)continue;
      for(const poly of polygons)for(let k=1;k<poly.length-1;k++){
        const vertices=[poly[0],poly[k],poly[k+1]];if(projectedArea(vertices)<1e-7)continue;
        (junction(edge,s)?common:road).tri(...vertices as [pc.Vec3,pc.Vec3,pc.Vec3]);
        dark.tri(vertices[2].clone().add(vec(0,-.65,0)),vertices[1].clone().add(vec(0,-.65,0)),vertices[0].clone().add(vec(0,-.65,0)));
        roadFaces.push({edgeId:edge.id,distance:s,points:vertices.map(tuple)});
      }
      for(const side of [-1,1]){
        const e=point(edge,s,side*w),f=point(edge,t,side*wt);
        if(!(edge===course.alternates.alley&&junction(edge,s)))dark.quad(e,e.clone().add(vec(0,-.65,0)),f,f.clone().add(vec(0,-.65,0)));
        // Junction throats stay entirely open. No overlapping branch curbs.
        if(junction(edge,s)||junction(edge,t))continue;
        const outer=point(edge,s,side*(w+1.2),.10),outerNext=point(edge,t,side*(wt+1.2),.10);
        const intersectsOther=support.some(q=>(q.edge!==edge||Math.abs(q.s-s)>35)&&Math.hypot(q.p.x-outer.x,q.p.z-outer.z)<q.half+2&&Math.abs(q.p.y-outer.y)<5);
        if(intersectsOther)continue;
        paving.quad(e.clone().add(vec(0,.10,0)),outer,f.clone().add(vec(0,.10,0)),outerNext);
        paving.quad(e,e.clone().add(vec(0,.10,0)),f,f.clone().add(vec(0,.10,0)));
        // Only wall into terrain where it cannot meet another lower roadway.
        const cross=support.some(q=>(q.edge!==edge||Math.abs(q.s-s)>60)&&Math.hypot(q.p.x-outer.x,q.p.z-outer.z)<q.half+7&&q.low<outer.y-4);
        if(!cross)masonry.quad(outer,vec(outer.x,terrainY(outer.x,outer.z)-.4,outer.z),outerNext,vec(outerNext.x,terrainY(outerNext.x,outerNext.z)-.4,outerNext.z));
      }
      if(edge!==course.alternates.alley&&!junction(edge,s)&&i%11<5)linen.quad(point(edge,s,-.07,.025),point(edge,s,.07,.025),point(edge,t,-.07,.025),point(edge,t,.07,.025));
    }
  }
  captureStructural(roadStructureStarts);
  // Start stripe is only on the common edge and uses exact road banking.
  for(let row=0;row<2;row++)for(let col=0;col<16;col++)if((row+col)%2===0){
    const edge=course.commonStart,s=row*.75,t=(row+1)*.75,w=edge.halfWidthAt(s);
    linen.quad(point(edge,s,-w+col*w/8,.035),point(edge,s,-w+(col+1)*w/8,.035),point(edge,t,-w+col*w/8,.035),point(edge,t,-w+(col+1)*w/8,.035));
  }
  // Sample the actual rendered heightfield triangles; analytic nearest-road
  // heights alone need not equal the sloped mesh between its grid vertices.
  const terrainMeshY=(x:number,z:number)=>{
    const gx=(x-minX)/(maxX-minX)*nx,gz=(z-minZ)/(maxZ-minZ)*nz,ix=Math.max(0,Math.min(nx-1,Math.floor(gx))),iz=Math.max(0,Math.min(nz-1,Math.floor(gz))),u=gx-ix,v=gz-iz,i=iz*(nx+1)+ix;
    const y=(k:number)=>ground.positions[k*3+1],a=y(i),b=y(i+1),c=y(i+nx+1),d=y(i+nx+2);
    return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
  };
  function groundPad(kind:string,p:pc.Vec3,yaw:number,width:number,depth:number){
    const at=local(p,yaw),footprint=[at(-width/2,0,-depth/2),at(width/2,0,-depth/2),at(width/2,0,depth/2),at(-width/2,0,depth/2)];
    let bottom=Infinity,highest=-Infinity;for(let x=0;x<=16;x++)for(let z=0;z<=16;z++){const q=at((x/16-.5)*width,0,(z/16-.5)*depth),y=terrainMeshY(q.x,q.z);bottom=Math.min(bottom,y-.5);highest=Math.max(highest,y);}
    // A lower street can sit beside a higher terrace. Raise the entire prop
    // with its pad rather than burying it or creating a negative-height base.
    p.y=Math.max(p.y,highest+.06);
    // Masonry stops at the cap underside. Its old top at p.y coincided with
    // the visible paving top and produced a black coplanar render artifact.
    const masonryVertexStart=masonry.positions.length/3,pavingVertexStart=paving.positions.length/3,baseTop=p.y-.08;
    masonry.box(vec(p.x,(baseTop+bottom)/2,p.z),vec(width,baseTop-bottom,depth),yaw);
    paving.box(p.clone().add(vec(0,-.04,0)),vec(width,.08,depth),yaw);
    foundations.push({kind,top:p.y,bottom,footprint:footprint.map(tuple),masonryVertexStart,pavingVertexStart});
    cameraObstacles.push({kind:kind+'-foundation',min:[Math.min(...footprint.map(q=>q.x)),bottom,Math.min(...footprint.map(q=>q.z))],max:[Math.max(...footprint.map(q=>q.x)),p.y+.02,Math.max(...footprint.map(q=>q.z))]});
  }
  function local(p:pc.Vec3,yaw:number){const c=Math.cos(yaw),s=Math.sin(yaw);return (x:number,y:number,z:number)=>vec(p.x+x*c+z*s,p.y+y,p.z-x*s+z*c);}
  let legacyPlanning=true;
  function house(p:pc.Vec3,yaw:number,width:number,depth:number,height:number,seed:number,padWidth=width+.5,frontSide=1,distant=false,wingCount=2){
    // Preserve the original furnishing/sign/support placement survey before
    // replacing architecture. Decorative regrouping cannot displace a bridge pier.
    if(legacyPlanning){record('legacy-terrace-house',p,Math.hypot(width/2+.8,depth/2+1.6),height+3.6,false);return;}
    const at=local(p,yaw),put=(batch:Batch,x:number,y:number,z:number,a:number,b:number,c:number)=>batch.box(at(x,y,z),vec(a,b,c),yaw);
    const wall=[cream,peach,rose][seed%3],roofY=height+2.3;
    if(distant){
      // One grounded joined-wing building, read as a quiet distant town silhouette.
      // The central party wall is a true butt join; roofs terminate at it, with
      // overhangs only around the outside. No tiny facade dressing or new batch.
      const padDepth=depth+(wingCount===3?3:.8);
      groundPad('terrace-house',p,yaw,padWidth,padDepth);
      for(let wing=0;wing<wingCount;wing++){
        const x0=-width/2+wing*width/wingCount,x1=x0+width/wingCount,mid=(x0+x1)/2;
        const h=height+(wingCount===3?[0,1.8,.6][wing]:wing*1.8),setback=wingCount===3?[-1,1,-.5][wing]:0;
        const facade=wing?cream:peach;put(facade,mid,h/2,setback,width/wingCount,h,depth);
        for(const z of [setback-depth/2,setback+depth/2])facade.tri(at(x0,h,z),at(mid,h+3,z),at(x1,h,z));
        const left=x0-(wing===0?.35:0),right=x1+(wing===wingCount-1?.35:0);
        roof.quad(at(left,h,setback-depth/2-.35),at(mid,h+3.08,setback-depth/2-.35),at(left,h,setback+depth/2+.35),at(mid,h+3.08,setback+depth/2+.35));
        roof.quad(at(mid,h+3.08,setback-depth/2-.35),at(right,h,setback-depth/2-.35),at(mid,h+3.08,setback+depth/2+.35),at(right,h,setback+depth/2+.35));
      }
      record('terrace-house',p,Math.hypot(padWidth/2,padDepth/2),height+5.2);return;
    }
    groundPad('terrace-house',p,yaw,padWidth,depth+2.4);
    const footing=foundations[foundations.length-1],front=frontSide*(depth/2+1.2);
    let streetFloor=-Infinity;
    for(let i=0;i<=16;i++){const q=at((i/16-.5)*padWidth,0,front);streetFloor=Math.max(streetFloor,terrainMeshY(q.x,q.z)+.15);}
    if(p.y-streetFloor>4.8){
      // Occupied lower workshops replace the exposed front of a tall retaining
      // base. Remove that masonry face before building genuine recessed bays;
      // there is no coplanar wall skin or overlapping visible surface.
      const face=frontSide===1?1:0;masonry.indices.splice(masonry.indices.length-36+face*6,6);
      const low=streetFloor-p.y,high=-.08,openingBottom=low+.3,openingTop=Math.min(high-.55,low+3.8);
      const faceQuad=(batch:Batch,x0:number,x1:number,y0:number,y1:number,z:number)=>{
        const left=frontSide===1?x1:x0,right=frontSide===1?x0:x1;
        batch.quad(at(left,y0,z),at(right,y0,z),at(left,y1,z),at(right,y1,z));
      };
      const half=padWidth/2,back=front-frontSide*.32,z0=Math.min(front,back),z1=Math.max(front,back);
      // The perimeter meets the retained footing sides/bottom/top at shared
      // edges only. Unlike boxes, these infill quads have no duplicate end faces.
      faceQuad(wall,-half,half,footing.bottom-p.y,openingBottom,front);
      faceQuad(wall,-half,half,openingTop,high,front);
      for(const [x0,x1] of [[-half,-half+.6],[-.3,.3],[half-.6,half]])faceQuad(wall,x0,x1,openingBottom,openingTop,front);
      for(const [x0,x1] of [[-half+.6,-.3],[.3,half-.6]]){
        // Genuine reveal jambs, sill and soffit close onto an inset glass back.
        wall.quad(at(x0,openingBottom,z0),at(x0,openingBottom,z1),at(x0,openingTop,z0),at(x0,openingTop,z1));
        wall.quad(at(x1,openingBottom,z1),at(x1,openingBottom,z0),at(x1,openingTop,z1),at(x1,openingTop,z0));
        paving.quad(at(x0,openingBottom,z0),at(x1,openingBottom,z0),at(x0,openingBottom,z1),at(x1,openingBottom,z1));
        wall.quad(at(x1,openingTop,z0),at(x0,openingTop,z0),at(x1,openingTop,z1),at(x0,openingTop,z1));
        faceQuad(glass,x0,x1,openingBottom,openingTop,back);
        put(wood,(x0+x1)/2,openingBottom+.10,front-frontSide*.12,x1-x0-.16,.20,.12);
        put(wood,(x0+x1)/2,(openingBottom+openingTop)/2,front-frontSide*.12,.15,openingTop-openingBottom-.22,.14);
      }
      // Inset ends avoid coincident side patches on an exposed row-end footing.
      put(paving,0,openingTop+.14,front-frontSide*.02,padWidth-.24,.24,.32);
      put(wood,0,high-.28,front-frontSide*.02,padWidth-.24,.3,.32);
      // The projecting cornice is below the ordinary house volume: include it
      // in the foundation obstacle rather than leaving a camera-visible lip.
      const obstacle=cameraObstacles[cameraObstacles.length-1];
      for(const axis of [0,2]){obstacle.min[axis]-=.2;obstacle.max[axis]+=.2;}
    }
    put(wall,0,height/2,0,width,height,depth);
    for(const z of [-depth/2,depth/2])wall.tri(at(-width/2,height,z),at(0,roofY,z),at(width/2,height,z));
    roof.quad(at(-width/2-.65,height,-depth/2-.65),at(0,roofY+.1,-depth/2-.65),at(-width/2-.65,height,depth/2+.65),at(0,roofY+.1,depth/2+.65));
    roof.quad(at(0,roofY+.1,-depth/2-.65),at(width/2+.65,height,-depth/2-.65),at(0,roofY+.1,depth/2+.65),at(width/2+.65,height,depth/2+.65));
    for(const x of [-width/2,width/2])put(wood,x,height-.15,0,.2,.28,depth+1.3);
    put(roof,0,roofY+.13,0,.28,.2,depth+1.4);
    // Individually modeled raised tile courses give the roofs a tiled silhouette.
    for(let j=1;j<=3;j++)for(const side of [-1,1])put(roof,side*j*(width/2+.6)/4,roofY+.08-j*2.4/4,0,.10,.11,depth+1.22);
    put(cream,width*.28,height+.5,depth*.18,1.1,3.2,1.1);put(roof,width*.28,height+2.15,depth*.18,1.45,.22,1.45);
    for(const side of [-1,1]){
      const z=side*(depth/2+.06);
      put(teal,0,1.35,z,1.6,2.7,.16);put(brass,.5,1.25,z+side*.13,.1,.1,.12);
      for(const y of (height<6?[2.35]:[3.8,6.8].filter(y=>y<height-1)))for(const x of [-width*.29,width*.29]){
        put(glass,x,y,z,1.25,1.7,.12);put(paving,x,y-.92,z,1.7,.18,.36);
        put(wood,x,y,z+side*.1,.09,1.75,.14);put(wood,x,y,z+side*.1,1.28,.09,.12);
        for(const q of [-1,1]){put(teal,x+q*.92,y,z,.45,1.85,.16);}
      }
      // Half timber ground floor shopfront, chunky eaves and an actual canopy.
      if(seed%2===0){for(const x of [-width*.46,width*.46])put(wood,x,height*.48,z,.22,height*.96,.22);put(wood,0,2.9,z,width-.02,.2,.24);
        for(const q of [-1,1])wood.quad(at(q*width*.46,2.85,z+side*.10),at(q*width*.46,3.10,z+side*.10),at(q*width*.23,4.3,z+side*.10),at(q*width*.23,4.55,z+side*.10));
      }
      if(seed%3!==1&&side===frontSide){
        put(wood,0,3.05,z+side*.7,width*.7,.25,1.4);put(teal,0,4.12,z+side*1.35,width*.72,.14,.15);
        for(let x=-width*.33;x<=width*.34;x+=1.3)put(teal,x,3.6,z+side*1.32,.10,1,.10);
        for(const x of [-width*.32,width*.32])put(wood,x,2.5,z+side*.70,.20,1.1,.20);
      }
    }
    // Add a readable street-facing relief hierarchy inside the existing house
    // reservation. No new street clutter or changes to the recessed shop bays.
    const polishFront=frontSide*(depth/2+.12),detail=(kind:string,b:Batch,x:number,y:number,z:number,w:number,h:number,d:number)=>polishBox(kind,b,at(x,y,z),vec(w,h,d),yaw);
    detail('limestone-entry-lintel',paving,0,2.79,polishFront,2.17,.24,.28);
    for(const x of [-.95,.95])detail('limestone-entry-jamb',paving,x,1.335,polishFront,.20,2.67,.28);
    detail('layered-eave-cornice',paving,0,height-.42,polishFront,width+.18,.20,.31);
    for(const x of [-width*.36,width*.36])detail('carved-eave-corbel',wood,x,height-.66,polishFront+frontSide*.04,.25,.35,.36);
    // A few more articulated facades form focal buildings within each row.
    // Louvers and sill brackets remain on the wall, never beyond the balcony.
    if(seed%4===0)for(const y of (height<6?[2.35]:[3.8,6.8].filter(y=>y<height-1)))for(const x of [-width*.29,width*.29]){
      for(const q of [-1,1]){
        detail('supported-window-sill',paving,x+q*.48,y-1.09,polishFront,.22,.26,.40);
        for(const dy of [-.48,.48])detail('teal-shutter-louver',teal,x+q*.92,y+dy,polishFront+frontSide*.06,.46,.14,.12);
      }
    }
    const radius=Math.hypot(Math.max(width/2+.8,padWidth/2),depth/2+1.6);record('terrace-house',p,radius,roofY+1.3);
  }
  // Give prominent landmarks first choice of clear plots; later architecture
  // respects their full footprint as well as the union of both road choices.
  function plot(edge:TownSceneryEdge,fraction:number,radius:number,preferredSide=1,allowJunction=false){
    for(const side of [preferredSide,-preferredSide])for(const shift of [0,12,-12,25,-25])for(const extra of [0,9,18,28]){
      const s=Math.max(0,Math.min(edge.length,fraction*edge.length+shift));if(!allowJunction&&junction(edge,s))continue;const frame=edge.sample(s),p=point(edge,s,side*(edge.halfWidthAt(s)+radius+5+extra));
      if(freeAt(p,radius))return {p,yaw:frame.angle,s};
    }return undefined;
  }
  const tower=plot(course.commonFinish,.55,9,-1);
  if(tower){const {p,yaw}=tower,at=local(p,yaw),put=(b:Batch,x:number,y:number,z:number,w:number,h:number,d:number)=>b.box(at(x,y,z),vec(w,h,d),yaw);
    groundPad('clock-tower',p,yaw,12,12);put(masonry,0,1,0,12,2,12);put(cream,0,13,0,7,24,7);for(const y of [4,10,18,24])put(paving,0,y,0,8,.5,8);
    for(const side of [-1,1]){put(glass,0,20,side*3.58,3.2,3.2,.12);put(glow,0,20.55,side*3.68,.13,1.18,.08);put(glow,.62,20,side*3.68,1.35,.13,.08);
      for(const x of [-2.2,2.2])put(teal,x,14,side*3.58,.7,2.4,.1);}
    for(const x of [-2.65,2.65])for(const z of [-2.65,2.65])put(paving,x,26.2,z,.6,4,.6);
    roof.cone(at(0,28,0),5.7,5,4,Math.PI/4+yaw);brass.box(at(0,34,0),vec(.14,2.2,.14));
    record('clock-tower',p,9,35);landmarks.push({kind:'clock-tower',label:'Civic clock tower',position:tuple(p)});
  }
  const tram=plot(course.alternates.boulevard,.52,13,1);
  if(tram){const {p,yaw}=tram,at=local(p,yaw),put=(b:Batch,x:number,y:number,z:number,w:number,h:number,d:number)=>b.box(at(x,y,z),vec(w,h,d),yaw);
    groundPad('parked-market-tram',p.clone().add(vec(0,-.4,0)),yaw,9,22);put(paving,0,-.15,0,9,.5,22);for(const x of [-.9,.9])put(brass,x,.12,0,.10,.10,19);
    put(teal,0,1.85,0,3.8,2.8,14);put(cream,0,3.55,0,4.2,.48,14.7);put(brass,0,.75,0,4,.16,14.3);
    for(const x of [-1.96,1.96])for(let z=-5.4;z<=5.5;z+=2.15){put(glass,x,2.4,z,.10,1.5,1.65);put(brass,x,1.6,z,.13,.12,1.8);}
    for(const z of [-7.05,7.05]){put(glass,0,2.3,z,2.7,1.6,.12);put(glow,0,1.1,z, .55,.4,.13);}
    for(const z of [-4.8,4.8])for(const x of [-1.75,1.75])put(dark,x,.40,z,.42,.8,1.25);
    // Statically parked, separated from playable road by a visible platform fence.
    for(const x of [-4.1,4.1]){for(let z=-10;z<=10;z+=2)put(teal,x,.65,z,.16,1.4,.16);put(teal,x,1.15,0,.15,.15,20.4);}
    put(brass,0,5,0,.16,2.6,.16);put(brass,0,6.25,0,2.8,.12,.16);
    record('parked-market-tram',p,13,6.5);landmarks.push({kind:'tram',label:'Parked market tram behind platform barriers',position:tuple(p)});
  }
  // 48 individually articulated houses, with alternating facade families.
  let houses=0;
  for(let pass=0;pass<3&&houses<48;pass++)for(const edge of edges){
    const count=Math.ceil(edge.length/25);
    for(let i=0;i<count&&houses<48;i++){
      const s=(i+.35+pass*.21)/count*edge.length;if(s<0||s>edge.length||junction(edge,s))continue;
      const seed=i+pass*79+edges.indexOf(edge)*131,width=8+noise(seed)*4,depth=6.5+noise(seed+44)*3,height=7+noise(seed+60)*5;
      const radius=Math.hypot(width/2+.8,depth/2+1.6),side=(i+pass)%2?1:-1;
      const p=point(edge,s,side*(edge.halfWidthAt(s)+radius+5+pass*14));
      if(freeAt(p,radius)){house(p,edge.sample(s).angle+Math.PI/2,width,depth,height,seed);houses++;}
    }
  }
  // Keep the old architectural reservations for the furnishing survey only.
  for(let i=0;i<10;i++){
    const site=plot(course.alternates.boulevard,.13+i*.068,4.4,-1);if(site)record('legacy-open-arcade-bay',site.p,4.4,5.4,false);
  }
  function marketStall(p:pc.Vec3,yaw:number){
    const at=local(p,yaw),put=(b:Batch,x:number,y:number,z:number,w:number,h:number,d:number)=>b.box(at(x,y,z),vec(w,h,d),yaw);
    groundPad('striped-market-stall',p,yaw,5.2,3.3);put(wood,0,.65,0,4.5,1.3,2.7);for(const x of [-2.1,2.1])for(const z of [-1.15,1.15])put(wood,x,1.8,z,.14,3.6,.14);
    for(let strip=0;strip<6;strip++){const x=-2.6+strip*.87;(strip%2?linen:plum).quad(at(x,3.45,-1.6),at(x+.87,3.45,-1.6),at(x,3.0,1.7),at(x+.87,3.0,1.7));}
    for(let j=0;j<7;j++)ellipsoid(j%3?fruit:foliage,at(-1.7+j*.55,1.5,.2),vec(.26,.25,.35),6,3);
    // Paired open produce crates explain the market group at human scale.
    // They bear directly on the counter and reuse its already protected volume.
    for(const x of [-1.10,1.10]){
      const detail=(kind:string,b:Batch,dx:number,y:number,z:number,w:number,h:number,d:number)=>polishBox(kind,b,at(x+dx,y,z),vec(w,h,d),yaw);
      detail('market-crate-floor',wood,0,1.34,.14,1.95,.08,1.26);
      for(const z of [-.49,.77])detail('market-crate-slat',wood,0,1.49,z,2.03,.28,.10);
      for(const dx of [-.975,.975])detail('market-crate-end',wood,dx,1.49,.14,.10,.28,1.16);
    }
    put(plum,0,2.84,1.68,5.25,.34,.10);record('striped-market-stall',p,3.5,3.7);
  }
  for(let i=0;i<16;i++){
    const edge=i<10?course.commonStart:course.alternates.alley,site=plot(edge,.12+(i%10)*.075,3.5,i%2?1:-1);if(!site)continue;
    record('legacy-striped-market-stall',site.p,3.5,3.7,false);
  }
  for(const edge of edges)for(let i=0;i<Math.ceil(edge.length/28);i++){
    const s=(i+.5)*28;if(s>=edge.length||junction(edge,s))continue;
    const side=i%2?1:-1,p=point(edge,s,side*(edge.halfWidthAt(s)+6.5));
    if(!freeAt(p,2.1))continue;
    groundPad('potted-citrus-tree',p,0,2.5,2.5);cylinder(roof,p,1.1,1.15,10);cylinder(masonry,p.clone().add(vec(0,1.1,0)),1.2,.18,10);
    wood.box(p.clone().add(vec(0,2,0)),vec(.22,2.1,.22));ellipsoid(foliage,p.clone().add(vec(0,3.3,0)),vec(1.9,1.6,1.9));
    for(let j=0;j<3;j++){const a=j/3*Math.PI*2;ellipsoid(fruit,p.clone().add(vec(Math.cos(a)*1.65,3.1+(j%3)*.4,Math.sin(a)*1.65)),vec(.16,.17,.16),5,3);}
    record('potted-citrus-tree',p,2.1,5);
  }
  // Lantern poles and wayfinding arrows stay out of the shared throats too.
  for(const edge of edges)for(let s=24;s<edge.length;s+=31){
    if(junction(edge,s))continue;const p=point(edge,s,edge.halfWidthAt(s)+6);if(!freeAt(p,1))continue;
    groundPad('copper-street-lantern',p,0,1.2,1.2);brass.box(p.clone().add(vec(0,2.3,0)),vec(.14,4.6,.14));brass.box(p.clone().add(vec(0,4.45,0)),vec(1.1,.15,.16));
    brass.box(p.clone().add(vec(.45,3.92,0)),vec(.61,.82,.61));glow.box(p.clone().add(vec(.45,3.93,0)),vec(.65,.55,.65));roof.cone(p.clone().add(vec(.45,4.34,0)),.52,.40,4,Math.PI/4);
    record('copper-street-lantern',p,1,4.8);
  }
  // Two roadside boards express an actual choice; signs are not fake exits.
  for(const side of [-1,1]){
    const edge=course.commonStart,s=Math.max(0,edge.length-72),site=plot(edge,s/edge.length,3,side,true);
    if(!site)continue;const {p,yaw}=site,at=local(p,yaw);
    groundPad('fork-wayfinding-board',p,yaw,4.5,1.1);for(const x of [-1.8,1.8])wood.box(at(x,2.2,0),vec(.2,4.4,.2),yaw);
    teal.box(at(0,4,0),vec(5,1.8,.22),yaw);
    // Raised ivory directional arrow on both readable board faces.
    for(const z of [-.14,.14]){
      linen.quad(at(-1.25,3.82,z),at(1.25,3.82,z),at(-1.25,4.12,z),at(1.25,4.12,z));
      const dir=side;linen.tri(at(dir*1.9,3.97,z),at(dir*.8,4.55,z),at(dir*.8,3.4,z));
    }
    record('fork-wayfinding-board',p,3,5.1);landmarks.push({kind:side>0?'alley-sign':'boulevard-sign',label:side>0?'Lantern Alley: short narrow technical street':'Tram Boulevard: broad longer street',position:tuple(p)});
  }
  const bridgeStructureStarts=structuralBatches.map(batch=>batch.indices.length);
  // Bridge spans are discovered from actual separated road ribbons, never an
  // invented flat top. All authored structural undersides use <=2.2m depth.
  for(const edge of edges){
    const crossings=support.filter(a=>a.edge===edge&&support.some(b=>(b.edge!==edge||Math.abs(a.s-b.s)>90)&&a.low-b.high>16&&Math.hypot(a.p.x-b.p.x,a.p.z-b.p.z)<a.half+b.half+4));
    if(!crossings.length)continue;
    const from=Math.max(0,Math.min(...crossings.map(a=>a.s))-22),to=Math.min(edge.length,Math.max(...crossings.map(a=>a.s))+22);
    let clearance=Infinity;
    for(const a of crossings)for(const b of support)if((a.edge!==b.edge||Math.abs(a.s-b.s)>90)&&a.low>b.high+16&&Math.hypot(a.p.x-b.p.x,a.p.z-b.p.z)<a.half+b.half+4)clearance=Math.min(clearance,a.low-2.2-b.high);
    structures.push({kind:'viaduct',from,to,overheadClearance:clearance});
    for(let s=from;s<to;s+=2){const t=Math.min(to,s+2),w=edge.halfWidthAt(s),wt=edge.halfWidthAt(t);
      const soffit=[point(edge,s,-w,-.65),point(edge,s,w,-.65),point(edge,t,-wt,0),point(edge,t,wt,0)];
      cameraObstacles.push({kind:'street-bridge-soffit',min:[Math.min(...soffit.map(p=>p.x)),Math.min(...soffit.map(p=>p.y))-.1,Math.min(...soffit.map(p=>p.z))],max:[Math.max(...soffit.map(p=>p.x)),Math.max(...soffit.map(p=>p.y))+.1,Math.max(...soffit.map(p=>p.z))]});
      for(const side of [-1,1]){
        const a=point(edge,s,side*(w+1),0),b=point(edge,t,side*(wt+1),0),c=a.clone().add(vec(0,1.05,0)),d=b.clone().add(vec(0,1.05,0));
        masonry.quad(a,c,b,d);paving.quad(point(edge,s,side*(w+.75),1.1),point(edge,s,side*(w+1.2),1.1),point(edge,t,side*(wt+.75),1.1),point(edge,t,side*(wt+1.2),1.1));
        const archDepth=(q:number)=>.8+1.4*Math.pow(Math.abs((q-from)/(to-from)*2-1),2);
        dark.quad(a,a.clone().add(vec(0,-archDepth(s),0)),b,b.clone().add(vec(0,-archDepth(t),0)));
      }
    }
    for(const s of [from+3,to-3])for(const side of [-1,1]){
      const p=point(edge,s,side*(edge.halfWidthAt(s)+8));if(!freeAt(p,2.8))continue;
      const top=p.y-1;p.y=terrainY(p.x,p.z)-.3;masonry.box(p.clone().add(vec(0,(top-p.y)/2,0)),vec(3.8,top-p.y,3.8),edge.sample(s).angle);record('street-bridge-abutment',p,2.8,top-p.y);
      // Short cantilever joins the setback pier to the actual source-aligned
      // deck without putting a vertical support in either racing corridor.
      const arm=point(edge,s,side*(edge.halfWidthAt(s)+3.8),-1.45);
      masonry.box(arm,vec(9.4,.6,2.2),edge.sample(s).angle);
    }
    landmarks.push({kind:'street-bridge',label:'High masonry street bridge with open lower street',position:tuple(edge.sample((from+to)/2).p)});
  }
  captureStructural(bridgeStructureStarts);
  if(structuralTriangles.length){
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(const triangle of structuralTriangles)for(const p of triangle)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}
    cameraObstacles.push({kind:'town-exact-roadside-and-bridge-structure',min,max,triangles:structuralTriangles});
  }
  // Signs, tower, tram, trees, lanterns and structural supports above retain
  // their original anchors. Recompose houses, arcades and loose market stalls.
  for(let i=props.length-1;i>=0;i--)if(props[i].kind.startsWith('legacy-'))props.splice(i,1);
  legacyPlanning=false;
  const revealCorridors=[
    {eye:vec(-43.63245009956036,0,222.59712340061606),target:tram?.p,spread:15},
    {eye:vec(-68.14486270301028,0,-45.30996534604241),target:tower?.p,spread:13},
  ];
  const keepsReveal=(p:pc.Vec3,r:number)=>revealCorridors.every(({eye,target,spread})=>{
    if(!target)return true;const dx=target.x-eye.x,dz=target.z-eye.z,len2=dx*dx+dz*dz;
    const t=((p.x-eye.x)*dx+(p.z-eye.z)*dz)/len2;
    return t<0||t>1.08||Math.hypot(p.x-eye.x-t*dx,p.z-eye.z-t*dz)>r+spread*Math.max(0,t);
  });
  // Connected rows are designed as one street wall. Each house retains its own
  // terrain-grounded stepped footing and closed rear face; adjoining caps meet
  // edge-to-edge, so no giant bounding box fills courtyards or a second branch.
  const districts=[
    {edge:course.commonStart,s:95,side:-1,setback:30,width:12,depth:9.4,height:8.4,count:3},
    {edge:course.commonStart,s:109,side:1,setback:29,width:11.8,depth:8.5,height:10.6,count:4},
    {edge:course.commonStart,s:142,side:-1,setback:33,width:10.5,depth:9,height:8.2,count:5},
    {edge:course.alternates.alley,s:134,side:1,setback:26,width:11.2,depth:9.4,height:12,count:3},
    {edge:course.alternates.alley,s:193,side:1,setback:28,width:10.1,depth:8.8,height:10,count:4},
    {edge:course.alternates.alley,s:264,side:1,setback:28,width:12.2,depth:10,height:9.4,count:3},
    {edge:course.alternates.boulevard,s:168,side:-1,setback:40,width:15,depth:12,height:9.4,count:3},
    {edge:course.alternates.boulevard,s:246,side:-1,setback:42,width:12,depth:10.8,height:11.8,count:4},
    {edge:course.alternates.boulevard,s:325,side:-1,setback:40,width:15,depth:12,height:9.2,count:3},
    {edge:course.commonFinish,s:300,side:1,setback:32,width:12.4,depth:10.2,height:9.6,count:4},
    {edge:course.commonFinish,s:445,side:1,setback:34,width:12.4,depth:10.2,height:8.2,count:4},
    {edge:course.commonFinish,s:551,side:1,setback:31,width:11.8,depth:10,height:8.6,count:2},
    {edge:course.commonFinish,s:349,side:-1,setback:29,width:11.5,depth:8.5,height:4.2,count:2},
    {edge:course.commonFinish,s:429,side:-1,setback:29,width:11.5,depth:8.5,height:4.2,count:2},
  ];
  for(const [district,d] of [...districts.entries()].sort((a,b)=>(a[1].height<5?-1:0)-(b[1].height<5?-1:0))){
    const spacing=d.width+1.5,radius=Math.hypot(spacing/2,d.depth/2+1.6);
    let row:{p:pc.Vec3;yaw:number}[]|undefined;
    search:for(const extra of [0,7,14,22,32,44])for(const shift of [0,8,-8,16,-16,25,-25]){
      const s=d.s+shift,frame=d.edge.sample(s),yaw=frame.angle+Math.PI/2;
      const center=point(d.edge,s,d.side*(d.setback+extra)),at=local(center,yaw);
      const candidate=Array.from({length:d.count},(_,i)=>({p:at((i-(d.count-1)/2)*spacing,0,0),yaw}));
      if(candidate.every(({p})=>freeAt(p,radius)&&(d.height<5||keepsReveal(p,radius)))){row=candidate;break search;}
    }
    if(!row)throw new Error('No union-clear town district '+district);
    row.forEach(({p,yaw},i)=>house(p,yaw,d.width,d.depth,d.height+[0,1.4,-.6,.7,-.3][i],district*7+i,spacing,-d.side));
  }
  // Two return-straight houses remain in place as a route landmark. Reuse the
  // other two as broad, connected roof silhouettes beyond the two horizon gaps.
  // These are real closed building masses on the original terrain, not billboards.
  for(const [index,site] of [
    {x:175,z:237,yaw:Math.PI/2,width:36,depth:14,height:12,wings:2},
    {x:-208,z:-82,yaw:1.0,width:58,depth:16,height:8,wings:3},
  ].entries()){
    const p=vec(site.x,terrainMeshY(site.x,site.z)+.06,site.z),radius=Math.hypot((site.width+.8)/2,(site.depth+(site.wings===3?3:.8))/2);
    if(!freeAt(p,radius))throw new Error('Distant town roofline must clear all roads and props');
    house(p,site.yaw,site.width,site.depth,site.height,80+index,site.width+.8,1,true,site.wings);
  }
  // Nine real open bays form three continuous, backed market-hall runs. Broad
  // arch openings and one cornice read at driving distance; no arch crosses road.
  for(const [run,s] of [171,246,325].entries()){
    const edge=course.alternates.boulevard,spacing=6.9,radius=Math.hypot(spacing/2,3.4);
    let row:{p:pc.Vec3;yaw:number}[]|undefined;
    search:for(const shift of [0,9,-9,18,-18,30,-30])for(const extra of [0,7,14,22,34,46]){
      const frame=edge.sample(s+shift),yaw=frame.angle+Math.PI/2,center=point(edge,s+shift,-(25+extra)),at=local(center,yaw);
      const candidate=Array.from({length:3},(_,i)=>({p:at((i-1)*spacing,0,0),yaw}));
      if(candidate.every(({p})=>freeAt(p,radius)&&keepsReveal(p,radius))){row=candidate;break search;}
    }
    if(!row)throw new Error('No union-clear market hall '+run);
    // All three bays share one level while each footing reaches actual terrain.
    let top=Math.max(...row.map(({p})=>p.y));
    for(const {p,yaw} of row){const at=local(p,yaw);for(let x=0;x<=16;x++)for(let z=0;z<=16;z++){const q=at((x/16-.5)*spacing,0,(z/16-.5)*6.8);top=Math.max(top,terrainMeshY(q.x,q.z)+.06);}}
    for(const [i,{p,yaw}] of row.entries()){
      p.y=top;groundPad('open-arcade-bay',p,yaw,spacing,6.8);const at=local(p,yaw),put=(b:Batch,x:number,y:number,z:number,w:number,h:number,d:number)=>b.box(at(x,y,z),vec(w,h,d),yaw);
      const wall=[cream,peach,rose][run];put(wall,0,2.5625,-2.8,spacing,5.125,.6);
      for(const x of [-3.05,3.05]){put(paving,x,2.25,2.65,.6,4.5,.65);put(paving,x,.22,2.65,.8,.44,.9);}
      put(paving,0,5.35,0,spacing,.45,6.6);put(roof,0,5.725,0,spacing,.3,6.8);
      put(wood,0,4.85,2.65,spacing,.22,.32);
      // Closed annular arch band, with proper front/back and curved intrados.
      for(let j=0;j<10;j++){
        const a=j/10*Math.PI,b=(j+1)/10*Math.PI;
        const q=(angle:number,outer:boolean,z:number)=>at(Math.cos(angle)*(outer?3.0:2.5),2.65+Math.sin(angle)*(outer?2.45:1.95),z);
        paving.quad(q(a,false,2.3),q(a,true,2.3),q(b,false,2.3),q(b,true,2.3));
        paving.quad(q(b,false,3),q(b,true,3),q(a,false,3),q(a,true,3));
        paving.quad(q(a,false,3),q(a,false,2.3),q(b,false,3),q(b,false,2.3));
        paving.quad(q(a,true,2.3),q(a,true,3),q(b,true,2.3),q(b,true,3));
      }
      if(i===0||i===2)put(wall,(i===0?-1:1)*3.12,2.8,0,.45,5.6,5.2);
      put(teal,0,2.3,-2.425,2.25,3.2,.15);put(brass,0,4.55,2.85,.6,.25,.13);
      record('open-arcade-bay',p,radius,5.95);
    }
  }
  // Shops take spatial priority over loose stalls. Re-house the same fourteen
  // stalls beside the completed market/alley groups, outside both road choices.
  let marketStalls=0;
  for(let pass=0;pass<3&&marketStalls<14;pass++)for(let i=0;i<16&&marketStalls<14;i++){
    const edge=i<10?course.commonStart:course.alternates.alley;
    const site=plot(edge,.12+(i%10)*.075+pass*.013,3.5,i%2?1:-1);
    if(site){marketStall(site.p,site.yaw);marketStalls++;}
  }
  if(marketStalls!==14)throw new Error('Town market needs fourteen terrain-grounded stalls');
  // Pale alley texture reads as small paving, never broad undulations. Source
  // road/terrain/support triangles and normals remain bit-for-bit untouched.
  for(let i=0;i<cobble.uvs.length;i++)cobble.uvs[i]*=7;
  const used=batches.filter(b=>b.indices.length),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const batch of used)for(let i=0;i<batch.positions.length;i++){const a=i%3;min[a]=Math.min(min[a],batch.positions[i]);max[a]=Math.max(max[a],batch.positions[i]);}
  return {version:1,trackId:course.id,batches:used,roadSamples,routeRoadSamples,props,structures,roadFaces,foundations,cameraObstacles,landmarks,polishDetails,bounds:{min,max}};
}
