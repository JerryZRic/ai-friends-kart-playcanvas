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
export interface TownCameraObstacle {kind: string; min: number[]; max: number[]}
export interface TownSceneGeometry extends LandSceneGeometry {
  routeRoadSamples: {edgeId: string; distance: number; left: number[]; right: number[]; rendered: boolean}[];
  roadFaces: {edgeId:string; distance:number; points:number[][]}[];
  foundations: {kind:string;top:number;bottom:number;footprint:number[][];masonryVertexStart:number;pavingVertexStart:number}[];
  cameraObstacles: TownCameraObstacle[];
  landmarks: {kind: string; label: string; position: number[]}[];
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
  const cobble=new Batch('Lantern Alley pale cobbled road','#b8a78a',.96,'stone');
  const boulevard=new Batch('Tram Boulevard dark paved road','#66675e',.98,'asphalt');
  const common=new Batch('Market and civic warm stone road','#928a76',.98,'stone');
  const paving=new Batch('Cream sidewalk coping and civic columns','#e4d2b0',.96,'stone');
  const masonry=new Batch('Ochre terrace retaining masonry','#b19b78',1,'stone');
  const dark=new Batch('Street bridge soffit and shadowed masonry','#777261',1,'stone');
  const ground=new Batch('Town garden earth and distant terraces','#998b68',1,'grass');
  const cream=new Batch('Ivory plaster facades','#ecd8aa',.95,'stone');
  const peach=new Batch('Warm apricot plaster facades','#d89d6f',.95,'stone');
  const rose=new Batch('Dusty rose plaster facades','#bd8372',.95,'stone');
  const roof=new Batch('Terracotta tiled roofs and chimney caps','#a6553e',.95,'stone');
  const wood=new Batch('Timber shop beams eaves and market counters','#684b35',.94,'wood');
  const teal=new Batch('Teal shutters doors balcony rails and tram','#34736c',.7,'wood');
  const glass=new Batch('Deep blue shop windows and clock faces','#354c51',.3,'none',.15);
  const brass=new Batch('Copper lantern frames and tram trim','#ba8b50',.46,'none',.58);
  const glow=new Batch('Warm lantern panes and clock hands','#ffe3a0',.43);
  const plum=new Batch('Plum market awnings','#965b72',.96,'wood');
  const linen=new Batch('Ivory market canopy stripes and race markings','#f4dfae',.96);
  const foliage=new Batch('Citrus tree rounded foliage','#547a46',1,'grass');
  const fruit=new Batch('Orange fruit and market produce','#e9a439',.83);
  const batches=[cobble,boulevard,common,paving,masonry,dark,ground,cream,peach,rose,roof,wood,teal,glass,brass,glow,plum,linen,foliage,fruit];
  const edges=edgesOf(course),props:LandPropPlacement[]=[],cameraObstacles:TownCameraObstacle[]=[],landmarks:TownSceneGeometry['landmarks']=[];
  const roadFaces:TownSceneGeometry['roadFaces']=[],foundations:TownSceneGeometry['foundations']=[];
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
  function house(p:pc.Vec3,yaw:number,width:number,depth:number,height:number,seed:number){
    const at=local(p,yaw),put=(batch:Batch,x:number,y:number,z:number,a:number,b:number,c:number)=>batch.box(at(x,y,z),vec(a,b,c),yaw);
    const wall=[cream,peach,rose][seed%3],roofY=height+2.3;
    groundPad('terrace-house',p,yaw,width+.5,depth+.5);put(wall,0,height/2,0,width,height,depth);
    for(const z of [-depth/2,depth/2])wall.tri(at(-width/2,height,z),at(0,roofY,z),at(width/2,height,z));
    roof.quad(at(-width/2-.65,height,-depth/2-.65),at(0,roofY+.1,-depth/2-.65),at(-width/2-.65,height,depth/2+.65),at(0,roofY+.1,depth/2+.65));
    roof.quad(at(0,roofY+.1,-depth/2-.65),at(width/2+.65,height,-depth/2-.65),at(0,roofY+.1,depth/2+.65),at(width/2+.65,height,depth/2+.65));
    for(const x of [-width/2,width/2])put(wood,x,height-.15,0,.2,.28,depth+1.3);
    put(roof,0,roofY+.13,0,.28,.2,depth+1.4);
    // Individually modeled raised tile courses give the roofs a tiled silhouette.
    for(let j=1;j<=4;j++)for(const side of [-1,1])put(roof,side*j*(width/2+.6)/5,roofY+.08-j*2.4/5,0,.10,.11,depth+1.22);
    put(cream,width*.28,height+.5,depth*.18,1.1,3.2,1.1);put(roof,width*.28,height+2.15,depth*.18,1.45,.22,1.45);
    for(const side of [-1,1]){
      const z=side*(depth/2+.06);
      put(teal,0,1.35,z,1.6,2.7,.16);put(brass,.5,1.25,z+side*.13,.1,.1,.12);
      for(const y of [3.8,6.8].filter(y=>y<height-1))for(const x of [-width*.29,width*.29]){
        put(glass,x,y,z,1.25,1.7,.12);put(paving,x,y-.92,z,1.7,.18,.36);
        put(wood,x,y,z+side*.1,.09,1.75,.12);put(wood,x,y,z+side*.1,1.28,.09,.12);
        for(const q of [-1,1]){put(teal,x+q*.92,y,z,.45,1.85,.16);}
      }
      // Half timber ground floor shopfront, chunky eaves and an actual canopy.
      if(seed%2===0){for(const x of [-width*.46,width*.46])put(wood,x,height*.48,z,.22,height*.96,.22);put(wood,0,2.9,z,width,.2,.22);
        for(const q of [-1,1])wood.quad(at(q*width*.46,2.85,z+side*.18),at(q*width*.46,3.10,z+side*.18),at(q*width*.23,4.3,z+side*.18),at(q*width*.23,4.55,z+side*.18));
      }
      if(seed%3!==1&&side===1){
        put(wood,0,3.05,z+side*.7,width*.7,.25,1.4);put(teal,0,4.12,z+side*1.35,width*.72,.14,.15);
        for(let x=-width*.33;x<=width*.34;x+=.75)put(teal,x,3.6,z+side*1.35,.10,1,.10);
        for(const x of [-width*.32,width*.32])put(wood,x,2.5,z+side*.70,.20,1.1,.20);
      }
    }
    const radius=Math.hypot(width/2+.8,depth/2+1.6);record('terrace-house',p,radius,roofY+1.3);
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
  // Arcade bays are separate open architectural elements beside the boulevard.
  for(let i=0;i<10;i++){
    const site=plot(course.alternates.boulevard,.13+i*.068,4.4,-1);if(!site)continue;
    const {p,yaw}=site,at=local(p,yaw);
    groundPad('open-arcade-bay',p,yaw,6.8,5.2);
    for(const x of [-2.7,2.7])for(const z of [-2,2]){cylinder(paving,at(x,0,z),.35,4.5,8);paving.box(at(x,.18,z),vec(.95,.35,.95),yaw);}
    paving.box(at(0,4.8,0),vec(6.4,.7,4.8),yaw);roof.box(at(0,5.22,0),vec(6.8,.15,5.2),yaw);
    // Faceted semicircular arch intrados above the open center, rather than a
    // solid wall masquerading as an arch. Kept out of the racing corridor.
    for(let j=0;j<10;j++)for(const z of [-2,2]){
      const a=j/10*Math.PI,b=(j+1)/10*Math.PI;
      paving.quad(at(Math.cos(a)*2.35,2.7+Math.sin(a)*1.65,z-.3),at(Math.cos(a)*2.8,2.7+Math.sin(a)*2.1,z-.3),at(Math.cos(b)*2.35,2.7+Math.sin(b)*1.65,z+.3),at(Math.cos(b)*2.8,2.7+Math.sin(b)*2.1,z+.3));
    }
    record('open-arcade-bay',p,4.4,5.4);
  }
  for(let i=0;i<16;i++){
    const edge=i<10?course.commonStart:course.alternates.alley,site=plot(edge,.12+(i%10)*.075,3.5,i%2?1:-1);if(!site)continue;
    const {p,yaw}=site,at=local(p,yaw),put=(b:Batch,x:number,y:number,z:number,w:number,h:number,d:number)=>b.box(at(x,y,z),vec(w,h,d),yaw);
    groundPad('striped-market-stall',p,yaw,5.2,3.3);put(wood,0,.65,0,4.5,1.3,2.7);for(const x of [-2.1,2.1])for(const z of [-1.15,1.15])put(wood,x,1.8,z,.14,3.6,.14);
    for(let strip=0;strip<6;strip++){const x=-2.6+strip*.87;(strip%2?linen:plum).quad(at(x,3.45,-1.6),at(x+.87,3.45,-1.6),at(x,3.0,1.7),at(x+.87,3.0,1.7));}
    for(let j=0;j<7;j++)ellipsoid(j%3?fruit:foliage,at(-1.7+j*.55,1.5,.2),vec(.26,.25,.35),6,3);
    put(plum,0,2.82,1.68,5.25,.34,.10);record('striped-market-stall',p,3.5,3.7);
  }
  for(const edge of edges)for(let i=0;i<Math.ceil(edge.length/28);i++){
    const s=(i+.5)*28;if(s>=edge.length||junction(edge,s))continue;
    const side=i%2?1:-1,p=point(edge,s,side*(edge.halfWidthAt(s)+6.5));
    if(!freeAt(p,2.1))continue;
    groundPad('potted-citrus-tree',p,0,2.5,2.5);cylinder(roof,p,1.1,1.15,10);cylinder(masonry,p.clone().add(vec(0,1.1,0)),1.2,.18,10);
    wood.box(p.clone().add(vec(0,2,0)),vec(.22,2.1,.22));ellipsoid(foliage,p.clone().add(vec(0,3.3,0)),vec(1.9,1.6,1.9));
    for(let j=0;j<7;j++){const a=j/7*Math.PI*2;ellipsoid(fruit,p.clone().add(vec(Math.cos(a)*1.65,3.1+(j%3)*.4,Math.sin(a)*1.65)),vec(.16,.17,.16),5,3);}
    record('potted-citrus-tree',p,2.1,5,false);
  }
  // Lantern poles and wayfinding arrows stay out of the shared throats too.
  for(const edge of edges)for(let s=24;s<edge.length;s+=31){
    if(junction(edge,s))continue;const p=point(edge,s,edge.halfWidthAt(s)+6);if(!freeAt(p,1))continue;
    groundPad('copper-street-lantern',p,0,1.2,1.2);brass.box(p.clone().add(vec(0,2.3,0)),vec(.14,4.6,.14));brass.box(p.clone().add(vec(0,4.45,0)),vec(1.1,.15,.16));
    brass.box(p.clone().add(vec(.45,3.92,0)),vec(.61,.82,.61));glow.box(p.clone().add(vec(.45,3.93,0)),vec(.65,.55,.65));roof.cone(p.clone().add(vec(.45,4.34,0)),.52,.40,4,Math.PI/4);
    record('copper-street-lantern',p,1,4.8,false);
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
  const used=batches.filter(b=>b.indices.length),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const batch of used)for(let i=0;i<batch.positions.length;i++){const a=i%3;min[a]=Math.min(min[a],batch.positions[i]);max[a]=Math.max(max[a],batch.positions[i]);}
  return {version:1,trackId:course.id,batches:used,roadSamples,routeRoadSamples,props,structures,roadFaces,foundations,cameraObstacles,landmarks,bounds:{min,max}};
}
