import * as pc from 'playcanvas';
import {LandMeshBatch as Batch} from './land-mesh-builder';
import {footprintArea,intersectRoadFootprint,subtractRoadFootprint,sampleRoadFootprints,RoadFootprintIndex,roadFootprint,type SceneryForkCourse,type SceneryRoadEdge} from './land-road-mesh';
import type {LandSceneGeometry,LandPropPlacement} from './land-scenery';
import type {LandSceneTheme} from './land-scene';
import {cameraTerrainHeight,type CameraBlocker,type CameraHeightfield} from './land-camera';

type Face={edgeId:string;distance:number;points:number[][]};
type Component={kind:string;batch:string;vertexStart:number;vertexEnd:number;min:number[];max:number[];landmark?:string};
export interface WorkshopSceneGeometry extends LandSceneGeometry {
  routeRoadSamples:{edgeId:string;distance:number;left:number[];right:number[];rendered:boolean}[];
  roadFaces:Face[];roadUndersideFaces:Face[];supportFaces:Face[];
  cameraObstacles:(CameraBlocker&{kind:string;triangles?:number[][][]})[];
  components:Component[];landmarks:{kind:string;label:string;position:number[];radius:number;height:number}[];
  foundations:{kind:string;top:number;bottom:number;footprint:number[][];support:string}[];
  groundedDetails:{kind:string;x:number;z:number;bottom:number;terrainY:number;footprint:number[][]}[];
  gears:{teeth:number;spokes:number;center:number[];radius:number;innerRadius:number}[];
  drawers:{kind:string;position:number[];recess:number;handleDepth:number}[];
  railMembers:{edgeId:string;distance:number;side:number;points:number[][]}[];
  bridgeMembers:{kind:string;points:number[][]}[];
  sightlines:{name:string;eye:number[];target:number[];radius:number;targetId:string}[];
  terrainGrid:CameraHeightfield;
  budget:{batches:number;triangles:number;vertices:number};
}
export const WORKSHOP_SCENE_THEME:Readonly<LandSceneTheme>=Object.freeze({
  textureLabel:'clockwind handmade maple',ambient:'#d2c0a2',sky:'#ded5bd',fogStart:850,fogEnd:1800,
  cameraName:'Clockwind workshop chase camera',sunName:'Clockwind high window key',sunColor:'#fff0ce',sunIntensity:1.65,sunEuler:[47,-31,0] as const,
});
const vec=(x:number,y:number,z:number)=>new pc.Vec3(x,y,z),tuple=(p:pc.Vec3)=>[p.x,p.y,p.z];
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const local=(p:pc.Vec3,yaw=0)=>{const c=Math.cos(yaw),s=Math.sin(yaw);return(x:number,y:number,z:number)=>vec(p.x+x*c+z*s,p.y+y,p.z-x*s+z*c);};
const plotData=[
  {kind:'clock-heart-and-spool',x:-40,z:40,r:47,height:62,top:0,w:66,d:66,label:'Clock Heart: two hand-marked dials, four open-spoke gears and turned pillars'},
  {kind:'tool-cabinet-bank',x:280,z:-190,r:23,height:45,top:35.55,w:38,d:24,label:'Tool Cabinet: nine inset drawers, loop handles and pegboard tools'},
  {kind:'vise-and-jaw-station',x:-53.857062724933975,z:-209.70012796108534,r:20,height:22,top:7.55,w:30,d:24,label:'Bench Vise: modeled screw ridges, leather jaws and sliding handle'},
  {kind:'upright-drafting-square',x:423.05358192538665,z:-223.39097080856916,r:16,height:48,top:35.55,w:26,d:18,label:'Drafting Square: open triangular brass frame and supported hand plane'},
  {kind:'turned-wooden-lamp',x:-73.35545262122052,z:-258.8518674647417,r:21,height:60,top:21.5,w:32,d:26,label:'Turned Lamp: maple spindle, two-piece copper arm and amber diffuser'},
  {kind:'drawer-stack-ramp',x:-374.0264735991185,z:-325.55644052254195,r:18,height:34,top:7.55,w:28,d:22,label:'Return Drawers: stepped recessed faces, turned pulls and sloped tool trays'},
] as const;

/** Original static workshop construction. Every road, shelf and deck derives
 * from physical edge coordinates. No nearest-XZ elevated terrain is used. */
export function buildWorkshopSceneGeometry(course:SceneryForkCourse):WorkshopSceneGeometry {
  const floor=new Batch('Workshop joined maple room floor','#94734d',.97,'wood');
  const seam=new Batch('Workshop dark joints and contact trim','#493a2b',.96,'wood');
  const maple=new Batch('Workshop continuous maple worktops','#b98345',.86,'wood');
  const endgrain=new Batch('Workshop cut wood edges and fascia','#d4aa6a',.91,'wood');
  const road=new Batch('Workshop pale sealed maple road','#dabd7e',.87,'wood');
  const inlay=new Batch('Workshop cabinet road inlay','#8eab90',.89,'wood');
  const soffit=new Batch('Workshop open deck undersides','#705034',.97,'wood');
  const rail=new Batch('Workshop forest green safety rails','#285b4a',.78,'none',.22);
  const steel=new Batch('Workshop brushed steel tools','#a6b2ad',.48,'none',.7);
  const copper=new Batch('Workshop copper gears and arms','#b86e3d',.43,'none',.72);
  const brass=new Batch('Workshop brass rims and graduations','#d1a959',.42,'none',.75);
  const ivory=new Batch('Workshop ivory dial and sign faces','#f2e6c9',.78);
  const ink=new Batch('Workshop inked scale and dial marks','#302820',.88);
  const green=new Batch('Workshop recessed cabinet green','#224f45',.84,'wood');
  const leather=new Batch('Workshop vise leather jaw pads','#8b4737',.98,'stone');
  const toolDark=new Batch('Workshop dark iron tools and brackets','#40514b',.57,'none',.62);
  const amber=new Batch('Workshop warm recessed diffuser','#edb967',.6);
  const pegboard=new Batch('Workshop perforated tool backing','#b7a17a',.94,'wood');
  const lightWood=new Batch('Workshop turned wood spindles','#d9b67c',.85,'wood');
  const hardware=new Batch('Workshop dark fasteners and threads','#665749',.52,'none',.65);
  const wall=new Batch('Workshop sage room skirting','#718574',.94,'wood');
  const batches=[floor,seam,maple,endgrain,road,inlay,soffit,rail,steel,copper,brass,ivory,ink,green,leather,toolDark,amber,pegboard,lightWood,hardware,wall];
  const edges=[course.commonStart,course.alternates.alley,course.alternates.boulevard,course.commonFinish];
  const sourceFaces=sampleRoadFootprints(edges,2),roadIndex=new RoadFootprintIndex(sourceFaces);
  const props:LandPropPlacement[]=[],roadSamples:WorkshopSceneGeometry['roadSamples']=[],routeRoadSamples:WorkshopSceneGeometry['routeRoadSamples']=[];
  const roadFaces:Face[]=[],roadUndersideFaces:Face[]=[],supportFaces:Face[]=[],components:Component[]=[],cameraObstacles:WorkshopSceneGeometry['cameraObstacles']=[];
  const landmarks:WorkshopSceneGeometry['landmarks']=[],foundations:WorkshopSceneGeometry['foundations']=[],groundedDetails:WorkshopSceneGeometry['groundedDetails']=[];
  const gears:WorkshopSceneGeometry['gears']=[],drawers:WorkshopSceneGeometry['drawers']=[],railMembers:WorkshopSceneGeometry['railMembers']=[],bridgeMembers:WorkshopSceneGeometry['bridgeMembers']=[];
  let landmark:string|undefined;
  const point=(e:SceneryRoadEdge,s:number,l=0,h=0)=>e.sample(s,l).p.clone().add(vec(0,h,0));
  const bounds=(points:pc.Vec3[])=>({min:[0,1,2].map(k=>Math.min(...points.map(p=>tuple(p)[k]))),max:[0,1,2].map(k=>Math.max(...points.map(p=>tuple(p)[k])))});
  const bound=(kind:string,b:Batch,start:number,obstacle=false)=>{
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=start*3;i<b.positions.length;i++){const j=i%3;min[j]=Math.min(min[j],b.positions[i]);max[j]=Math.max(max[j],b.positions[i]);}
    components.push({kind,batch:b.name,vertexStart:start,vertexEnd:b.positions.length/3,min,max,...(landmark?{landmark}:{})});
    if(obstacle&&min.every((n,i)=>n<max[i]))cameraObstacles.push({kind,min,max});
  };
  const box=(kind:string,b:Batch,p:pc.Vec3,size:pc.Vec3,yaw=0,obstacle=false)=>{const start=b.positions.length/3;b.box(p,size,yaw);bound(kind,b,start,obstacle);};
  const beam=(kind:string,b:Batch,a:pc.Vec3,c:pc.Vec3,width:number,depth=width,obstacle=true)=>{
    const y=c.clone().sub(a).normalize(),x=new pc.Vec3().cross(y,vec(0,1,0));if(x.length()<.01)x.set(1,0,0);else x.normalize();
    const z=new pc.Vec3().cross(x,y).normalize(),at=(p:pc.Vec3,i:number,j:number)=>p.clone().add(x.clone().mulScalar(i*width/2)).add(z.clone().mulScalar(j*depth/2));
    const v=[at(a,-1,-1),at(a,1,-1),at(c,-1,-1),at(c,1,-1),at(a,-1,1),at(a,1,1),at(c,-1,1),at(c,1,1)],start=b.positions.length/3;
    for(const f of [[0,1,2,3],[5,4,7,6],[4,0,6,2],[1,5,3,7],[2,3,6,7],[4,5,0,1]])b.quad(v[f[0]],v[f[1]],v[f[2]],v[f[3]]);bound(kind,b,start);
    if(obstacle){const n=Math.ceil(a.distance(c)/1.25);for(let i=0;i<n;i++){const points=[[0,2],[1,3],[4,6],[5,7]].flatMap(([lo,hi])=>[v[lo].clone().lerp(v[lo],v[hi],i/n),v[lo].clone().lerp(v[lo],v[hi],(i+1)/n)]);cameraObstacles.push({kind:kind+'-camera-piece',...bounds(points)});}}
    return v;
  };
  const tube=(kind:string,b:Batch,path:pc.Vec3[],radii:number[],sides=12,capStart=true,capEnd=true,obstacle=false)=>{
    const start=b.positions.length/3;
    for(let k=0;k<path.length;k++){const axis=path[Math.min(k+1,path.length-1)].clone().sub(path[Math.max(0,k-1)]).normalize(),u=new pc.Vec3().cross(axis,Math.abs(axis.y)>.93?vec(1,0,0):vec(0,1,0)).normalize(),v=new pc.Vec3().cross(axis,u).normalize();
      for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2;b.vertex(path[k].clone().add(u.clone().mulScalar(Math.cos(a)*radii[k])).add(v.clone().mulScalar(Math.sin(a)*radii[k])),[j/sides,k*.2]);}}
    for(let k=0;k<path.length-1;k++)for(let j=0;j<sides;j++){const a=start+k*sides+j,c=start+k*sides+(j+1)%sides;b.indices.push(a,a+sides,c,c,a+sides,c+sides);}
    for(const [enabled,k,reverse]of [[capStart,0,true],[capEnd,path.length-1,false]] as const)if(enabled){const center=b.positions.length/3;b.vertex(path[k]);for(let j=0;j<sides;j++){const a=start+k*sides+j,c=start+k*sides+(j+1)%sides;b.indices.push(center,...(reverse?[c,a]:[a,c]));}}
    bound(kind,b,start,obstacle);
  };
  const turned=(kind:string,b:Batch,at:(x:number,y:number,z:number)=>pc.Vec3,profile:number[][],sides=24)=>tube(kind,b,profile.map(([y])=>at(0,y,0)),profile.map(([,r])=>r),sides);
  const meshBlock=(kind:string,triangles:number[][][])=>{if(!triangles.length)return;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const tri of triangles)for(const p of tri)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}cameraObstacles.push({kind,min,max,triangles});};

  // The room floor is a joined indexed panel grid. Ray support uses exactly
  // these source triangles, not a smoothed or bilinear approximation.
  const minX=-485,minZ=-385,columns=130,rows=79,dx=965/129,dz=585/78,heights:number[]=[];
  for(let z=0;z<rows;z++)for(let x=0;x<columns;x++){const px=minX+x*dx,pz=minZ+z*dz,h=.04+.035*Math.sin(px*.032)*Math.sin(pz*.028);heights.push(h);const i=z*columns+x;floor.vertex(vec(px,h,pz),[px*.027,pz*.065]);if(x<columns-1&&z<rows-1)floor.indices.push(i,i+columns,i+1,i+1,i+columns,i+columns+1);}
  const terrainGrid:CameraHeightfield={minX,minZ,columns,rows,dx,dz,heights};
  cameraObstacles.push({kind:'workshop-exact-room-floor',min:[minX,0,minZ],max:[480,.08,200],heightfield:terrainGrid});
  const floorY=(x:number,z:number)=>cameraTerrainHeight(terrainGrid,x,z)??0;
  const floorExtrema=(poly:pc.Vec3[])=>{
    const x0=clamp(Math.floor((Math.min(...poly.map(p=>p.x))-minX)/dx),0,columns-2),x1=clamp(Math.floor((Math.max(...poly.map(p=>p.x))-minX)/dx),0,columns-2),z0=clamp(Math.floor((Math.min(...poly.map(p=>p.z))-minZ)/dz),0,rows-2),z1=clamp(Math.floor((Math.max(...poly.map(p=>p.z))-minZ)/dz),0,rows-2);let low=Infinity,high=-Infinity;
    const vertex=(i:number)=>vec(...floor.positions.slice(i*3,i*3+3) as [number,number,number]);for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const i=z*columns+x;for(const tri of [[i,i+columns,i+1],[i+1,i+columns,i+columns+1]])for(const p of intersectRoadFootprint(tri.map(vertex),poly)){low=Math.min(low,p.y);high=Math.max(high,p.y);}}return{low,high};
  };
  for(let z=-347;z<190;z+=38){for(let x=-480;x<475;x+=90){const offset=(Math.round((z+347)/38)%2)*45,left=Math.max(-484,x+offset),right=Math.min(479,x+offset+90);if(right<=left)continue;box('flush-floor-panel-joint',seam,vec((left+right)/2,.077,z),vec(right-left,.025,.13));if(x+offset<475)box('flush-floor-panel-end',seam,vec(left,.077,z-19),vec(.13,.025,38));}}
  for(const [p,size]of [[vec(-484,1, -92.5),vec(2,2,585)],[vec(479,1,-92.5),vec(2,2,585)],[vec(-2.5,1,-384),vec(963,2,2)],[vec(-2.5,1,199),vec(963,2,2)]] as const)box('room-perimeter-skirting',wall,p,size,0,true);
  const leg=(kind:string,x:number,z:number,top:number,width=2.5)=>{
    const footprint=[vec(x-width/2,0,z-width/2),vec(x+width/2,0,z-width/2),vec(x+width/2,0,z+width/2),vec(x-width/2,0,z+width/2)],bottom=floorExtrema(footprint).low-.12;
    if(top<=bottom)return;box(kind,soffit,vec(x,(bottom+top)/2,z),vec(width,top-bottom,width),0,true);box(kind+'-foot-collar',hardware,vec(x,bottom+.32,z),vec(width+.35,.65,width+.35));groundedDetails.push({kind,x,z,bottom,terrainY:floorY(x,z),footprint:footprint.map(tuple)});
  };
  // One high workbench stays east of the open crossing. Only the thin slab is
  // solid; legs are actual separated volumes running down to the room floor.
  box('east-workbench-slab',maple,vec(316,34.75,-192.5),vec(272,1.6,319),0,true);
  for(const x of [192,316,440])for(const z of [-340,-190,-45])if(roadIndex.clearAt(x,z,4))leg('east-workbench-leg',x,z,33.95,4);
  for(const z of [-352,-33])box('east-workbench-apron',endgrain,vec(316,32.95,z),vec(272,2,1.4));
  for(const x of [180,452])box('east-workbench-apron',endgrain,vec(x,32.95,-192.5),vec(1.4,2,319));
  const benchCut=[vec(180,0,-352),vec(452,0,-352),vec(452,0,-33),vec(180,0,-33)];
  // Road deck ownership is exact spatial source triangle subtraction. The
  // source-identical common tail is not used as a guessed render cutoff.
  const priority=new Map([[course.commonStart,0],[course.commonFinish,1],[course.alternates.boulevard,2],[course.alternates.alley,3]]),ownership=new Map<string,boolean>();
  for(const f of sourceFaces){let fragments=[f.points];for(const owner of roadIndex.query(f.minX,f.maxX,f.minZ,f.maxZ)){
    if(priority.get(owner.edge)!>=priority.get(f.edge)!||Math.max(owner.maxY,f.maxY)-Math.min(owner.minY,f.minY)>.005)continue;fragments=fragments.flatMap(poly=>subtractRoadFootprint(poly,owner.points));if(!fragments.length)break;
  }ownership.set(f.edge.id+':'+f.distance,(ownership.get(f.edge.id+':'+f.distance)??false)||fragments.length>0);
    for(const poly of fragments)for(let i=1;i<poly.length-1;i++){const p=[poly[0],poly[i],poly[i+1]];if(footprintArea(p)<1e-8)continue;(f.edge===course.alternates.alley?inlay:road).tri(...p as [pc.Vec3,pc.Vec3,pc.Vec3]);const under=[p[2],p[1],p[0]].map(q=>q.clone().add(vec(0,-.45,0)));soffit.tri(...under as [pc.Vec3,pc.Vec3,pc.Vec3]);roadFaces.push({edgeId:f.edge.id,distance:f.distance,points:p.map(tuple)});roadUndersideFaces.push({edgeId:f.edge.id,distance:f.distance,points:under.map(tuple)});
    }
  }
  // Joined shelves use the actual lateral frame and retain an open underside.
  // Upper bridge x68..151 is exactly road width, never a filled heightfield.
  const shelfWidth=(e:SceneryRoadEdge,s:number)=>{const p=e.sample(s).p,w=e.halfWidthAt(s);if(e===course.commonStart&&s>1150)return w+22*clamp((p.x-151)/29,0,1);return w+(e===course.commonStart&&s>620&&s<1150?19.5:22);};
  const deckTriangles:number[][][]=[];
  for(const edge of [course.commonStart,course.commonFinish]){const n=Math.ceil(edge.length/2);for(let i=0;i<n;i++){
    const s=i/n*edge.length,t=(i+1)/n*edge.length,w=shelfWidth(edge,s),wt=shelfWidth(edge,t),a=point(edge,s,-w,-.45),b=point(edge,s,w,-.45),c=point(edge,t,-wt,-.45),d=point(edge,t,wt,-.45);
    for(const tri of [[a,c,b],[b,c,d]]){let fragments=[tri];if(Math.min(...tri.map(p=>p.y))>34)fragments=fragments.flatMap(p=>subtractRoadFootprint(p,benchCut));for(const poly of fragments)for(let j=1;j<poly.length-1;j++){const p=[poly[0],poly[j],poly[j+1]],q=[p[2],p[1],p[0]].map(p=>p.clone().add(vec(0,-1.6,0)));maple.tri(...p as [pc.Vec3,pc.Vec3,pc.Vec3]);soffit.tri(...q as [pc.Vec3,pc.Vec3,pc.Vec3]);supportFaces.push({edgeId:edge.id,distance:s,points:p.map(tuple)});deckTriangles.push(p.map(tuple),q.map(tuple));}}
    for(const side of [-1,1]){const p=point(edge,s,side*w,-.45),q=point(edge,t,side*wt,-.45);if(p.x>180&&p.z>-352&&p.z< -33)continue;const low=p.clone().add(vec(0,-1.6,0)),lowQ=q.clone().add(vec(0,-1.6,0));endgrain.quad(p,low,q,lowQ);deckTriangles.push([p,low,q].map(tuple),[q,low,lowQ].map(tuple));}
    if(i%26===0){for(const side of [-1,1]){const p=point(edge,s,side*(w-2),-2.05);if(p.x>178&&p.z>-354&&p.z< -31)continue;if(p.x>68&&p.x<151&&p.z>-101&&p.z< -39&&s>1150)continue;if(!roadIndex.clearAt(p.x,p.z,3,f=>f.maxY<p.y+1.5))continue;leg('sampled-shelf-leg',p.x,p.z,p.y,2.6);}}
  }}
  meshBlock('exact-connected-shelf-triangles',deckTriangles);
  for(const x of [65,155])for(const z of [-82,-58]){if(!roadIndex.clearAt(x,z,3,f=>f.maxY<20))throw new Error('Workshop crossing support enters lower route');leg('open-crossing-end-bent',x,z,33.55,2.8);}
  for(const z of [-79.05,-60.95]){const points=beam('open-crossing-side-rib',hardware,vec(65,34.25,z),vec(155,34.25,z),.6,.7);bridgeMembers.push({kind:'open-crossing-side-rib',points:points.map(tuple)});}
  // Full exposed road union controls rails, including the long overlapping
  // split/merge lobes. Tiny source-derived camera pieces follow their yaw.
  for(const edge of edges){const n=Math.ceil(edge.length/2);for(let i=0;i<n;i++){
    const s=i/n*edge.length,t=(i+1)/n*edge.length,w=edge.halfWidthAt(s),wt=edge.halfWidthAt(t),a=point(edge,s,-w),b=point(edge,s,w),sample={edgeId:edge.id,distance:s,left:tuple(a),right:tuple(b),rendered:ownership.get(edge.id+':'+s)??false};roadSamples.push(sample);routeRoadSamples.push(sample);
    for(const side of [-1,1]){const p=point(edge,s,side*w),q=point(edge,t,side*wt),mid=p.clone().lerp(p,q,.5),other=(f:typeof sourceFaces[number])=>f.edge!==edge&&f.minY<p.y+4&&f.maxY>p.y-4;if(!roadIndex.clearAt(mid.x,mid.z,p.distance(q)/2+.03,other))continue;
      const out=point(edge,s,side*(w+.48),.025),next=point(edge,t,side*(wt+.48),.025);brass.quad(p.clone().add(vec(0,.025,0)),out,q.clone().add(vec(0,.025,0)),next);endgrain.quad(p,p.clone().add(vec(0,-.45,0)),q,q.clone().add(vec(0,-.45,0)));
      if(i%5===0){const end=Math.min(edge.length,s+9.3),u=point(edge,s,side*(w+.6),1.15),v=point(edge,end,side*(edge.halfWidthAt(end)+.6),1.15),middle=u.clone().lerp(u,v,.5);if(roadIndex.clearAt(middle.x,middle.z,u.distance(v)/2+.18,other)){const points=beam('exposed-workshop-road-rail',rail,u,v,.22,.28);railMembers.push({edgeId:edge.id,distance:s,side,points:points.map(tuple)});beam('workshop-rail-dowel',copper,u.clone().add(vec(0,-1.48,0)),u.clone().add(vec(0,.26,0)),.24,.24);if(i%15===0)box('rail-ivory-marker',ivory,u.clone().add(vec(0,.03,0)),vec(.26,.17,.3));}}
      if(i%7===0){const length=i%35===0?1.6:.7;ivory.quad(point(edge,s,side*(w-.85),.026),point(edge,s+.12,side*(w-.85),.026),point(edge,s,side*(w-.85-length),.026),point(edge,s+.12,side*(w-.85-length),.026));}
    }
  }}
  for(let row=0;row<2;row++)for(let col=0;col<16;col++)if((row+col)%2===0){const e=course.commonStart,s=row*.75,t=(row+1)*.75,w=e.halfWidthAt(s);ivory.quad(point(e,s,-w+col*w/8,.03),point(e,s,-w+(col+1)*w/8,.03),point(e,t,-w+col*w/8,.03),point(e,t,-w+(col+1)*w/8,.03));}

  // Genuine side worktops bridge to the continuous shelves. Their legs reach
  // all the way to the emitted floor, so landmark y values are not seed guesses.
  const sideTops=[{kind:'vise-worktop-wing',x:-54,z:-191,w:45,d:74,top:7.55},{kind:'lamp-worktop-wing',x:-73,z:-267,w:45,d:58,top:21.5},{kind:'return-drawer-worktop-wing',x:-372,z:-311,w:40,d:58,top:7.55}];
  for(const p of sideTops){box(p.kind,maple,vec(p.x,p.top-.8,p.z),vec(p.w,1.6,p.d),0,true);for(const x of [-1,1])for(const z of [-1,1]){const px=p.x+x*(p.w/2-3),pz=p.z+z*(p.d/2-3);if(roadIndex.clearAt(px,pz,2.2))leg(p.kind+'-leg',px,pz,p.top-1.6,2.8);}}
  const gear=(at:(x:number,y:number,z:number)=>pc.Vec3,cx:number,cy:number,cz:number,r:number,teeth:number,spokes:number)=>{
    const inner=r*.68,depth=1.15,start=copper.positions.length/3,N=teeth*4,center=at(cx,cy,cz);gears.push({teeth,spokes,center:tuple(center),radius:r*1.11,innerRadius:inner});
    const g=(a:number,r:number,z:number)=>at(cx+Math.cos(a)*r,cy+Math.sin(a)*r,cz+z);
    for(let i=0;i<N;i++){const a=i/N*Math.PI*2,b=(i+1)/N*Math.PI*2,ra=r*(i%4===1||i%4===2?1.11:1),rb=r*((i+1)%4===1||(i+1)%4===2?1.11:1),a0=g(a,ra,-depth/2),b0=g(b,rb,-depth/2),a1=g(a,ra,depth/2),b1=g(b,rb,depth/2),u0=g(a,inner,-depth/2),v0=g(b,inner,-depth/2),u1=g(a,inner,depth/2),v1=g(b,inner,depth/2);copper.quad(a0,b0,a1,b1);copper.quad(u0,u1,v0,v1);copper.quad(a0,u0,b0,v0);copper.quad(a1,b1,u1,v1);}
    bound('modeled-tooth-gear-ring',copper,start);
    for(let i=0;i<spokes;i++){const a=i/spokes*Math.PI*2;beam('open-gear-spoke',copper,g(a,r*.18,0),g(a,inner+.1,0),r*.11,depth,false);}
    tube('gear-spindle-boss',brass,[at(cx,cy,cz-1.1),at(cx,cy,cz+1.1)],[r*.2,r*.2],24);
    tube('gear-axle',hardware,[at(cx,cy,cz-1.7),at(cx,cy,10.6)],[r*.055,r*.055],16);
  };
  const drawer=(at:(x:number,y:number,z:number)=>pc.Vec3,cx:number,cy:number,z:number,width:number,height:number,kind:string)=>{
    box('drawer-recess-shadow',ink,at(cx,cy,z),vec(width,height,.35));box('drawer-inset-front',green,at(cx,cy,z-.23),vec(width-.55,height-.55,.26));
    for(const y of [-1,1])box('drawer-beveled-wood-frame',endgrain,at(cx,cy+y*(height/2+.13),z-.3),vec(width+.65,.28,.5));
    for(const x of [-1,1])box('drawer-beveled-wood-frame',endgrain,at(cx+x*(width/2+.16),cy,z-.3),vec(.3,height+.3,.5));
    tube('drawer-rounded-loop-handle',brass,[at(cx-width*.28,cy,z-.4),at(cx-width*.28,cy+.6,z-1.3),at(cx+width*.28,cy+.6,z-1.3),at(cx+width*.28,cy,z-.4)],[.16,.16,.16,.16],10);
    box('drawer-label-slot',brass,at(cx,cy-height*.29,z-.44),vec(width*.26,.58,.12));box('drawer-recessed-ivory-label',ivory,at(cx,cy-height*.29,z-.51),vec(width*.21,.36,.035));
    drawers.push({kind,position:tuple(at(cx,cy,z)),recess:.35,handleDepth:1.3});
  };
  for(const plot of plotData){
    if(!roadIndex.clearAt(plot.x,plot.z,plot.r+19.9))throw new Error('Workshop landmark footprint enters reserved road gap: '+plot.kind);
    landmark=plot.kind;const foot=[vec(plot.x-plot.w/2,0,plot.z-plot.d/2),vec(plot.x+plot.w/2,0,plot.z-plot.d/2),vec(plot.x+plot.w/2,0,plot.z+plot.d/2),vec(plot.x-plot.w/2,0,plot.z+plot.d/2)];
    const base=plot.top===0?floorExtrema(foot).high+.12:plot.top,p=vec(plot.x,base,plot.z),at=local(p);const put=(kind:string,b:Batch,x:number,y:number,z:number,w:number,h:number,d:number)=>box(kind,b,at(x,y,z),vec(w,h,d));
    const strut=(kind:string,b:Batch,a:number[],c:number[],w:number,d=w)=>beam(kind,b,at(...a as [number,number,number]),at(...c as [number,number,number]),w,d,false);
    const foundationBottom=plot.top===0?floorExtrema(foot).low-.12:base-.08;box('landmark-ground-contact-trim',seam,vec(p.x,(base+foundationBottom)/2,p.z),vec(plot.w,base-foundationBottom,plot.d));foundations.push({kind:plot.kind,top:base,bottom:foundationBottom,footprint:foot.map(tuple),support:plot.top===0?'exact-room-floor':plot.top===35.55?'east-workbench-slab':'connected-side-worktop'});
    props.push({kind:plot.kind,x:p.x,y:p.y,z:p.z,radius:plot.r});landmarks.push({kind:plot.kind,label:plot.label,position:tuple(p),radius:plot.r,height:plot.height});
    if(plot.kind==='clock-heart-and-spool'){
      turned('clock-grounded-stepped-pedestal',maple,at,[[0,31],[.5,33],[2,33],[2.4,30],[3.8,30]],64);
      for(const [x,z,h]of [[-26,10,54],[26,10,46],[3,21,57]])turned('clock-turned-frame-column',lightWood,local(at(x,3,z)),[[0,3],[1.4,3.7],[3,2.7],[8,2.1],[h-8,1.7],[h-4,2.6],[h-2,2.6],[h,1.8]],24);
      for(const y of [12,18,25,41,43])strut('clock-supported-rear-crossmember',maple,[-26,y,10],[26,y,10],1.5,1.8);
      strut('clock-asymmetric-top-crossbar',maple,[-26,55,10],[3,60,21],3,3);strut('clock-asymmetric-top-crossbar',maple,[3,60,21],[26,47,10],3,3);
      for(const [cx,cy,r,z]of [[-6,41,18,-5],[19,25,10,-10]]){
        tube('clock-dial-frame-shaft',hardware,[at(cx,cy,z+.7),at(cx,cy,10.6)],[1.1,1.1],16);
        tube('clock-dial-stepped-bezel',brass,[at(cx,cy,z+1.4),at(cx,cy,z+.7),at(cx,cy,z+.2),at(cx,cy,z-.3)],[r+1.2,r+1.2,r+.6,r+.6],96);
        tube('clock-ivory-dial-face',ivory,[at(cx,cy,z-.31),at(cx,cy,z-.53)],[r,r],96);
        for(let i=0;i<60;i++){const a=i/60*Math.PI*2,major=i%5===0;strut('clock-dial-raised-tick',ink,[cx+Math.cos(a)*(r-(major?2.2:1.05)),cy+Math.sin(a)*(r-(major?2.2:1.05)),z-.69],[cx+Math.cos(a)*(r-.55),cy+Math.sin(a)*(r-.55),z-.69],major?.42:.17,.1);}
        strut('clock-broad-hour-hand',toolDark,[cx,cy,z-.86],[cx-r*.42,cy+r*.35,z-.86],.75,.2);strut('clock-broad-minute-hand',toolDark,[cx,cy,z-.94],[cx+r*.18,cy+r*.75,z-.94],.5,.2);tube('clock-hand-rivet',copper,[at(cx,cy,z-1.2),at(cx,cy,z-.8)],[.8,.8],24);
      }
      gear(at,-22,18,-9,9,24,6);gear(at,3,12,-12,7,18,5);gear(at,23,43,-7,10,30,6);gear(at,-14,43,6,14,36,8);
      for(let i=0;i<12;i++){const a=i/12*Math.PI*2;turned('pedestal-brass-inset-pin',brass,local(at(Math.cos(a)*28,3.72,Math.sin(a)*28)),[[0,.48],[.3,.48]],12);}
    } else if(plot.kind==='tool-cabinet-bank'){
      put('cabinet-joined-backboard',pegboard,0,22.5,8,36,45,1);put('cabinet-bottom-plinth',maple,0,1,0,38,2,19);
      for(const [index,x]of [-12,0,12].entries()){const h=27+index*2;put('cabinet-closed-tower-shell',maple,x,h/2+2,0,11.3,h,16);for(let row=0;row<3;row++)drawer(at,x,6.8+row*7.5,-8.07,10.1,6.8,'cabinet-bank');put('cabinet-crown-lip',endgrain,x,h+2.1,0,12,.45,17);}
      for(let x=-16;x<=16;x+=2)for(let y=36;y<44;y+=1.8)tube('pegboard-recessed-hole',ink,[at(x,y,7.46),at(x,y,7.43)],[.22,.22],8);
      for(const [x,y]of [[-11,40.5],[0,41],[10,42],[8.3,43.7]])tube('pegboard-modeled-peg-collar',brass,[at(x,y,7.7),at(x,y,6.5)],[.42,.26],12);
      strut('pegboard-ruler-tool',steel,[-13,37,6.5],[-9,44,6.5],.65,.2);strut('pegboard-mallet-handle',lightWood,[0,38,6.5],[0,43,6.5],.5,.5);put('pegboard-mallet-head',toolDark,0,43.3,6.5,4,1.5,1.1);strut('pegboard-caliper-spine',brass,[10,38,6.5],[10,44,6.5],.4,.3);for(const y of [38.3,43.7])strut('pegboard-caliper-jaw',brass,[7.5,y,6.5],[10,y,6.5],.35,.3);
    } else if(plot.kind==='vise-and-jaw-station'){
      turned('vise-bolted-round-plinth',toolDark,at,[[0,14],[1.3,14],[1.7,11],[3.2,11]],48);put('vise-fixed-body',rail,-7,7,0,9,8,14);put('vise-moving-body',rail,7,7,0,7,7,13);
      for(const x of [-7,7]){put('vise-chamfered-jaw',steel,x,13,0,5,7,16);put('vise-leather-jaw-pad',leather,x+(x<0?2.56:-2.56),13,0,.3,5.8,14.5);}
      const path=Array.from({length:145},(_,i)=>at(-15+i*30/144,7.5,-.1));tube('vise-modeled-threaded-screw',hardware,path,path.map((_,i)=>i%3===1?1.18:.78),20);
      tube('vise-screw-collar',brass,[at(14,7.5,-.1),at(16,7.5,-.1)],[1.65,1.65],24);strut('vise-sliding-handle',steel,[17,1.5,-.1],[17,13.5,-.1],.7);for(const y of [1.5,13.5])tube('vise-handle-stop',copper,[at(17,y-.55,-.1),at(17,y+.55,-.1)],[.9,.9],16);
      for(let i=0;i<6;i++){const a=i/6*Math.PI*2;turned('vise-plinth-hex-bolt',hardware,local(at(Math.cos(a)*12,1.3,Math.sin(a)*12)),[[0,.65],[.65,.65]],6);}
    } else if(plot.kind==='upright-drafting-square'){
      // Three thick frame beams leave an actual triangular opening.
      strut('drafting-square-upright',brass,[-10,2,0],[-10,46,0],2.6,1.8);strut('drafting-square-baseline',brass,[-10,2,0],[12,2,0],2.6,1.8);strut('drafting-square-hypotenuse',brass,[-10,46,0],[12,2,0],2.6,1.8);
      for(let y=5;y<43;y+=1.5)put('drafting-square-raised-tick',ink,-10+(Math.round(y)%3===0?.35:0),y,-.98,Math.round(y)%3===0?1.6:.85,.16,.12);
      for(const x of [-10,11]){put('drafting-square-stout-foot',maple,x,.7,0,5,1.4,12);strut('drafting-square-support-brace',toolDark,[x,1,5],[x,10,0],.8);}
      put('hand-plane-soled-body',toolDark,3,1.8,6,10,2,4);strut('hand-plane-supported-blade',steel,[1,2,6],[4,7,6],2.4,.4);turned('hand-plane-front-knob',lightWood,local(at(-.5,2.7,6)),[[0,.7],[1,1.1],[2,.7]],18);
      for(let i=0;i<3;i++){const path=Array.from({length:29},(_,j)=>{const a=j/28*Math.PI*1.8;return at(1+i*2+Math.cos(a)*1.4,.35+Math.sin(a)*1.2,8.5);});tube('hand-plane-coiled-wood-shaving',lightWood,path,path.map(()=>.09),5);}
    } else if(plot.kind==='turned-wooden-lamp'){
      turned('lamp-layered-foot',maple,at,[[0,13],[.7,14],[1.3,14],[1.7,12],[2.8,11],[3.2,8]],64);
      turned('lamp-turned-shaft',lightWood,at,[[3.2,4],[4,4.5],[5.2,3.4],[8,2.4],[30,1.6],[33,2.7],[35,2.7],[36,1.4]],40);
      strut('lamp-copper-lower-arm',copper,[0,34,0],[-8,46,0],1.4);strut('lamp-copper-upper-arm',copper,[-8,46,0],[6,52,0],1.2);tube('lamp-elbow-pin',hardware,[at(-8,46,-1.8),at(-8,46,1.8)],[2,2],24);
      const shade=local(at(7,47,0));turned('lamp-faceted-ivory-shade',ivory,shade,[[0,11],[.6,11.2],[5,5],[7,3]],32);turned('lamp-recessed-amber-diffuser',amber,shade,[[-.05,9.2],[.12,9.2]],48);tube('lamp-shade-copper-neck',copper,[at(7,52,0),at(7,55,0)],[1.7,1.3],24);
      put('lamp-bakelite-switch',ink,7,2.8,-7,2,1.2,2);for(let y=8;y<34;y+=6)put('lamp-protected-cable-clip',hardware,0,y,2.2,.65,.55,.55);
    } else {
      for(let i=0;i<3;i++){const x=-10+i*10,h=15+i*7;put('return-stepped-cabinet-body',maple,x,h/2,0,9.7,h,17);for(let row=0;row<2+i;row++)drawer(at,x,3.5+row*6.3,-8.7,8.5,5.5,'return-terrace');put('return-cabinet-top-lip',endgrain,x,h+.2,0,10.3,.4,18);}
      for(const x of [-12,12])strut('return-side-sloping-tool-tray',green,[x,1,7],[x,6,11.4],2,1.1);
      for(let i=0;i<5;i++)put('return-tenon-plate',hardware,-12+i*6,1,-9,.8,1.6,.28);
    }
    landmark=undefined;
  }
  // Low fascia drawer bays follow the actual return's changing elevation.
  for(const s of [90,145,220,300,375,450,530,610,680]){const e=course.commonFinish,p=e.sample(s,26).p,yaw=e.sample(s).angle,at=local(vec(p.x,p.y-2.1,p.z),yaw);if(!roadIndex.clearAt(p.x,p.z,5.6))continue;box('return-grade-following-drawer-fascia',green,at(0,-1.6,0),vec(10,3.2,.45),yaw);for(const x of [-2.7,2.7])tube('return-fascia-turned-pull',brass,[at(x,-1.6,-.3),at(x,-1.6,-1.05)],[.24,.4],10);box('return-fascia-wood-lip',endgrain,at(0,.12,0),vec(10.8,.3,.9),yaw);}
  // Two signs remain outside the 80 m steering window and attach to the bench.
  for(const side of [-1,1]){const e=course.commonStart,s=e.length-115,w=e.halfWidthAt(s),p=point(e,s,side*(w+8)),at=local(p,Math.PI/2),top=p.y-.45;for(const x of [-2.2,2.2])beam('fork-wayfinding-post',copper,at(x,-.45,0),at(x,5,0),.3);box('fork-wayfinding-ivory-board',ivory,at(0,4,0),vec(5.5,2.2,.25),Math.PI/2);for(const z of [-.14,.14]){brass.quad(at(-1,3.85,z),at(1,3.85,z),at(-1,4.1,z),at(1,4.1,z));brass.tri(at(side*2.1,4,z),at(side*.7,4.75,z),at(side*.7,3.25,z));}props.push({kind:'workshop-fork-wayfinding',x:p.x,y:top,z:p.z,radius:3.2});}
  // Affine AABB pieces alone can still contain a banked/curved near-edge
  // anchor after clearance expansion. The exact emitted rail faces retain
  // the true swept-sphere margin even when the legacy box escape policy skips
  // one such piece. Both representations are spatially bounded.
  const exactRailTriangles:number[][][]=[];
  for(let i=0;i<rail.indices.length;i+=3)exactRailTriangles.push(rail.indices.slice(i,i+3).map(k=>rail.positions.slice(k*3,k*3+3)));
  meshBlock('exact-exposed-rail-triangles',exactRailTriangles);
  const sightlines:WorkshopSceneGeometry['sightlines']=[
    {name:'clockwork entrance reveal',eye:tuple(point(course.commonStart,596.0671069703933,0,1.6)),target:[-40,62,40],radius:3,targetId:'clock-heart-and-spool'},
    {name:'spool summit dial view',eye:tuple(point(course.commonStart,930.4462157586628,0,1.6)),target:[-40,62,40],radius:3,targetId:'clock-heart-and-spool'},
    {name:'cabinet branch preview',eye:tuple(point(course.commonStart,1366.5928793955359,0,1.6)),target:[280,66,-190],radius:3,targetId:'tool-cabinet-bank'},
    {name:'outside rim tool silhouette',eye:tuple(point(course.alternates.boulevard,216.7751306434509,0,1.6)),target:[423.05358192538665,78,-223.39097080856916],radius:3,targetId:'upright-drafting-square'},
  ];
  const used=batches.filter(b=>b.indices.length),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const b of used)for(let i=0;i<b.positions.length;i++){const j=i%3;min[j]=Math.min(min[j],b.positions[i]);max[j]=Math.max(max[j],b.positions[i]);}
  const budget={batches:used.length,triangles:used.reduce((n,b)=>n+b.indices.length/3,0),vertices:used.reduce((n,b)=>n+b.positions.length/3,0)};
  if(budget.batches>24||budget.triangles>=110000||budget.vertices>=200000)throw new Error('Workshop emitted geometry budget exceeded: '+JSON.stringify(budget));
  return {version:1,trackId:course.id,batches:used,roadSamples,routeRoadSamples,roadFaces,roadUndersideFaces,supportFaces,props,structures:[{kind:'viaduct',from:1250,to:1350,overheadClearance:24.3}],bounds:{min,max},cameraObstacles,components,landmarks,foundations,groundedDetails,gears,drawers,railMembers,bridgeMembers,sightlines,terrainGrid,budget};
}
