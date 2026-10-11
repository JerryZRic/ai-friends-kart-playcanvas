import * as pc from 'playcanvas';
import {LandMeshBatch as Batch} from './land-mesh-builder';
import {footprintArea,intersectRoadFootprint,subtractRoadFootprint,sampleRoadFootprints,RoadFootprintIndex,type SceneryForkCourse,type SceneryRoadEdge} from './land-road-mesh';
import type {LandSceneGeometry,LandPropPlacement} from './land-scenery';
import type {LandSceneTheme} from './land-scene';
import {cameraTerrainHeight,type CameraBlocker,type CameraHeightfield} from './land-camera';

export interface ForestSceneGeometry extends LandSceneGeometry {
  routeRoadSamples:{edgeId:string;distance:number;left:number[];right:number[];rendered:boolean}[];
  roadFaces:{edgeId:string;distance:number;points:number[][]}[];
  roadUndersideFaces:{edgeId:string;distance:number;points:number[][]}[];
  foundations:{kind:string;top:number;bottom:number;footprint:number[][];masonryVertexStart:number;pavingVertexStart:number}[];
  cameraObstacles:(CameraBlocker&{kind:string})[];
  components:{kind:string;batch:string;vertexStart:number;vertexEnd:number;min:number[];max:number[]}[];
  landmarks:{kind:string;label:string;position:number[]}[];
  terrainGrid:{minX:number;minZ:number;dx:number;dz:number;columns:number;rows:number};
  trestleMembers:{kind:string;points:number[][];minimumRoadClearance:number}[];
  trees:{kind:string;position:number[];radius:number;height:number}[];
  groundedDetails:{kind:string;x:number;z:number;bottom:number;terrainY:number}[];
  sightlines:{name:string;eye:number[];target:number[];radius:number}[];
  dome:{center:number[];radius:number;slitYaw:number;slitHalfAngle:number;faces:number[][][]};
}
export const FOREST_SCENE_THEME:Readonly<LandSceneTheme>=Object.freeze({
  textureLabel:'cedarlight woodland',ambient:'#aac2b8',sky:'#c6d8ce',fogStart:680,fogEnd:1480,
  cameraName:'CedarLight Observatory chase camera',sunName:'CedarLight warm canopy sunlight',
  sunColor:'#fff1cc',sunIntensity:1.65,sunEuler:[43,-38,0] as const,
});
const vec=(x:number,y:number,z:number)=>new pc.Vec3(x,y,z);
const tuple=(p:pc.Vec3)=>[p.x,p.y,p.z];
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const smooth=(n:number)=>{const t=clamp(n,0,1);return t*t*(3-2*t);};
const noise=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const local=(p:pc.Vec3,yaw:number)=>{const c=Math.cos(yaw),s=Math.sin(yaw);return(x:number,y:number,z:number)=>vec(p.x+x*c+z*s,p.y+y,p.z-x*s+z*c);};

/** Original cedar ridge, working observatory and open canopy viaduct. The
 * renderer and offline exporter consume these identical, source-derived meshes. */
export function buildForestSceneGeometry(course:SceneryForkCourse):ForestSceneGeometry {
  const moss=new Batch('Forest connected moss ridge terrain','#50634e',1,'grass');
  const earth=new Batch('Forest exposed connected earth cuts','#66544a',1,'stone');
  const shale=new Batch('Forest fractured slate outcrops','#747b79',.98,'stone');
  const road=new Batch('Forest packed cedar needle road','#8d8773',.98,'asphalt');
  const service=new Batch('Forest observatory service stone','#a9a899',.96,'stone');
  const coping=new Batch('Forest pale road coping and foundation caps','#c0bd9f',.95,'stone');
  const roots=new Batch('Forest dark root collars and soffits','#4b3b32',1,'wood');
  const bark=new Batch('Forest fissured cedar bark','#766154',1,'wood');
  const needles=new Batch('Forest shaded cedar bough fans','#1e4540',.99,'grass');
  const litNeedles=new Batch('Forest sunlit cedar bough fans','#4f7560',.98,'grass');
  const blueNeedles=new Batch('Forest blue cedar bough fans','#345b58',.99,'grass');
  const timber=new Batch('Forest laminated viaduct and ranger timber','#8b765e',.94,'wood');
  const iron=new Batch('Forest dark structural iron','#4c5e5c',.64,'none',.63);
  const cutWood=new Batch('Forest warm cut timber ends','#b39c74',.94,'wood');
  const masonry=new Batch('Forest observatory foundation masonry','#b5b09d',.95,'stone');
  const copper=new Batch('Forest oxidized copper dome and shutters','#649887',.63,'none',.58);
  const brass=new Batch('Forest weathered brass instruments','#b29a59',.43,'none',.76);
  const glass=new Batch('Forest recessed opaque instrument glass','#445b68',.26,'none',.12);
  const fern=new Batch('Forest low fern frond clusters','#759365',.99,'grass');
  const cream=new Batch('Forest ivory survey signs and race marks','#ddd6b1',.87);
  const signal=new Batch('Forest amber route and shutter signals','#d59256',.8);
  const batches=[moss,earth,shale,road,service,coping,roots,bark,needles,litNeedles,blueNeedles,timber,iron,cutWood,masonry,copper,brass,glass,fern,cream,signal];
  const edges=[course.commonStart,course.alternates.alley,course.alternates.boulevard,course.commonFinish];
  const sourceFaces=sampleRoadFootprints(edges),roadIndex=new RoadFootprintIndex(sourceFaces);
  const props:LandPropPlacement[]=[],roadSamples:ForestSceneGeometry['roadSamples']=[],routeRoadSamples:ForestSceneGeometry['routeRoadSamples']=[];
  const roadFaces:ForestSceneGeometry['roadFaces']=[],roadUndersideFaces:ForestSceneGeometry['roadUndersideFaces']=[],foundations:ForestSceneGeometry['foundations']=[];
  const cameraObstacles:ForestSceneGeometry['cameraObstacles']=[],components:ForestSceneGeometry['components']=[],landmarks:ForestSceneGeometry['landmarks']=[];
  const trestleMembers:ForestSceneGeometry['trestleMembers']=[],structures:ForestSceneGeometry['structures']=[],trees:ForestSceneGeometry['trees']=[],groundedDetails:ForestSceneGeometry['groundedDetails']=[];
  const point=(e:SceneryRoadEdge,s:number,l=0,h=0)=>e.sample(s,l).p.clone().add(vec(0,h,0));
  const clearAt=(p:pc.Vec3,r:number,margin=5)=>roadIndex.clearAt(p.x,p.z,r+margin);
  const freeAt=(p:pc.Vec3,r:number,margin=5)=>clearAt(p,r,margin)&&props.every(q=>Math.hypot(q.x-p.x,q.z-p.z)>q.radius+r+2);
  const bound=(kind:string,b:Batch,start:number,obstacle=true)=>{
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=start*3;i<b.positions.length;i++){const j=i%3;min[j]=Math.min(min[j],b.positions[i]);max[j]=Math.max(max[j],b.positions[i]);}
    components.push({kind,batch:b.name,vertexStart:start,vertexEnd:b.positions.length/3,min,max});
    if(obstacle&&min.every((n,i)=>n<max[i]))cameraObstacles.push({kind,min,max});
  };
  const box=(kind:string,b:Batch,p:pc.Vec3,size:pc.Vec3,yaw=0,obstacle=true)=>{const start=b.positions.length/3;b.box(p,size,yaw);bound(kind,b,start,obstacle);};
  // Indexed polygon tubes own each ring once and cap only exposed ends.
  const tube=(kind:string,b:Batch,path:pc.Vec3[],radii:number[],sides=8,capStart=true,capEnd=true,obstacle=true)=>{
    const start=b.positions.length/3,vertices:pc.Vec3[]=[];
    for(let k=0;k<path.length;k++){
      const axis=path[Math.min(k+1,path.length-1)].clone().sub(path[Math.max(0,k-1)]).normalize();
      const u=new pc.Vec3().cross(axis,Math.abs(axis.y)>.93?vec(1,0,0):vec(0,1,0)).normalize(),v=new pc.Vec3().cross(axis,u).normalize();
      for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,p=path[k].clone().add(u.clone().mulScalar(Math.cos(a)*radii[k])).add(v.clone().mulScalar(Math.sin(a)*radii[k]));vertices.push(p);b.vertex(p,[j/sides,k]);}
    }
    for(let k=0;k<path.length-1;k++)for(let j=0;j<sides;j++){const a=start+k*sides+j,c=start+k*sides+(j+1)%sides;b.indices.push(a,a+sides,c,c,a+sides,c+sides);}
    for(const [enabled,k,reverse] of [[capStart,0,true],[capEnd,path.length-1,false]] as const)if(enabled){const center=b.positions.length/3;b.vertex(path[k]);for(let j=0;j<sides;j++){const a=start+k*sides+j,c=start+k*sides+(j+1)%sides;b.indices.push(center,...(reverse?[c,a]:[a,c]));}}
    bound(kind,b,start,obstacle);return vertices;
  };
  const beam=(kind:string,b:Batch,a:pc.Vec3,c:pc.Vec3,width:number,depth=width,obstacle=true)=>{
    const y=c.clone().sub(a).normalize(),x=new pc.Vec3().cross(y,vec(0,1,0));if(x.length()<.01)x.set(1,0,0);else x.normalize();
    const z=new pc.Vec3().cross(x,y).normalize(),at=(p:pc.Vec3,i:number,j:number)=>p.clone().add(x.clone().mulScalar(i*width/2)).add(z.clone().mulScalar(j*depth/2));
    const v=[at(a,-1,-1),at(a,1,-1),at(c,-1,-1),at(c,1,-1),at(a,-1,1),at(a,1,1),at(c,-1,1),at(c,1,1)],start=b.positions.length/3;
    for(const f of [[0,1,2,3],[5,4,7,6],[4,0,6,2],[1,5,3,7],[2,3,6,7],[4,5,0,1]])b.quad(v[f[0]],v[f[1]],v[f[2]],v[f[3]]);
    bound(kind,b,start,obstacle&&kind!=='roadside-cedar-rail');
    if(obstacle&&kind==='roadside-cedar-rail'){
      // Tight affine pieces of this exact beam volume avoid a long rotated
      // AABB swallowing an otherwise road-clear camera anchor on the bank.
      const count=Math.ceil(a.distance(c)/1.25),pairs=[[0,2],[1,3],[4,6],[5,7]];
      for(let j=0;j<count;j++){const points=pairs.flatMap(([lo,hi])=>[v[lo].clone().lerp(v[lo],v[hi],j/count),v[lo].clone().lerp(v[lo],v[hi],(j+1)/count)]);
        cameraObstacles.push({kind:'roadside-cedar-rail-camera-piece',min:[0,1,2].map(k=>Math.min(...points.map(p=>tuple(p)[k]))),max:[0,1,2].map(k=>Math.max(...points.map(p=>tuple(p)[k])))});
      }
    }return v;
  };
  const sightlines:ForestSceneGeometry['sightlines']=[
    {name:'bowl exit reveal',eye:tuple(point(course.commonStart,850,0,1.6)),target:[20,59,405],radius:3},
    {name:'decision straight',eye:tuple(point(course.commonStart,1030,0,1.6)),target:[20,59,405],radius:3},
    {name:'rim summit',eye:tuple(point(course.alternates.boulevard,160,0,1.6)),target:[20,59,405],radius:3},
    {name:'merge departure',eye:tuple(point(course.commonFinish,50,0,1.6)),target:[20,59,405],radius:3},
  ];
  // One continuous heightfield, with long authored ridge rails rather than
  // isolated radial mounds. Uniform 7.5 m cells retain exact shared camera support.
  const ridgeRails=[
    [[-310,16,-300],[-300,24,-90],[-290,43,145],[-245,48,315],[-155,43,480],[-70,36,610]],
    [[175,20,-170],[185,26,90],[170,34,255],[110,34,390],[25,33,445],[-80,35,550]],
    [[270,10,-360],[290,15,-230],[280,22,-50],[230,28,80]],
  ];
  const valleyRails=[[[ -100,5,-215],[-70,7,-130],[10,9,-50],[40,10,5],[-25,12,75],[-110,15,100]],[[130,12,95],[75,10,45],[30,9,0],[-45,8,-35],[-120,9,-90]]];
  const railSample=(rail:number[][],x:number,z:number)=>{let distance=Infinity,height=0;for(let i=1;i<rail.length;i++){const a=rail[i-1],b=rail[i],dx=b[0]-a[0],dz=b[2]-a[2],t=clamp(((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz),0,1),d=Math.hypot(x-a[0]-t*dx,z-a[2]-t*dz);if(d<distance){distance=d;height=a[1]+t*(b[1]-a[1]);}}return {distance,height};};
  const support=edges.flatMap(edge=>Array.from({length:Math.ceil(edge.length/3)+1},(_,i)=>{const s=edge.length*i/Math.ceil(edge.length/3),f=edge.sample(s),half=edge.halfWidthAt(s);return {edge,s,p:f.p,half,low:f.p.y-Math.abs(f.n.y)*half};}));
  const minX=-350,maxX=340,minZ=-420,maxZ=650,nx=92,nz=143,dx=(maxX-minX)/nx,dz=(maxZ-minZ)/nz;
  const terrainY=(x:number,z:number)=>{
    let y=3+1.2*Math.sin(z/120+x/160);
    for(let i=0;i<ridgeRails.length;i++){const q=railSample(ridgeRails[i],x,z),width=[145,140,105][i];y=Math.max(y,3+(q.height-3)*smooth(1-q.distance/width));}
    for(const rail of valleyRails){const q=railSample(rail,x,z),w=smooth(1-q.distance/58);y=y*(1-w)+Math.min(y,q.height)*w;}
    let nearest=Infinity,target=y,ceiling=Infinity;
    for(const q of support){const d=Math.hypot(x-q.p.x,z-q.p.z),gap=Math.max(0,d-q.half);if(gap<nearest&&!(q.edge===course.commonFinish&&q.s>250&&q.s<625)){nearest=gap;target=q.low-1.6;}if(d<q.half+16)ceiling=Math.min(ceiling,q.low-1.6);}
    y=y+(target-y)*smooth(1-nearest/34);y=Math.min(y,ceiling);
    // A broad joined observatory bench, connecting to the north plateau.
    const bench=smooth(1-Math.abs(x-20)/68)*smooth(1-Math.abs(z-421)/76);y=y+(32-y)*bench;
    if(x>2&&x<52&&z>-24&&z<25)y=Math.min(y,9.5);
    return y;
  };
  const heights:number[]=[];
  for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++)heights.push(terrainY(minX+x*dx,minZ+z*dz));
  // Every grid cell touching any supported ribbon is capped by the LOWEST
  // source face's minimum Y. Thus affine terrain triangles cannot poke through
  // any road interior, including both banked edges and the crossing below.
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
    const x0=minX+x*dx,z0=minZ+z*dz,near=roadIndex.query(x0,x0+dx,z0,z0+dz);if(!near.length)continue;
    const cell=[vec(x0,0,z0),vec(x0+dx,0,z0),vec(x0+dx,0,z0+dz),vec(x0,0,z0+dz)];
    let cap=Infinity;for(const f of near)if(footprintArea(intersectRoadFootprint(f.points,cell))>1e-10)cap=Math.min(cap,f.minY-1.25);
    const i=z*(nx+1)+x;for(const j of [i,i+1,i+nx+1,i+nx+2])heights[j]=Math.min(heights[j],cap);
  }
  for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){const i=z*(nx+1)+x;moss.vertex(vec(minX+x*dx,heights[i],minZ+z*dz));if(x<nx&&z<nz)moss.indices.push(i,i+nx+1,i+1,i+1,i+nx+1,i+nx+2);}
  const heightfield:CameraHeightfield={minX,minZ,dx,dz,columns:nx+1,rows:nz+1,heights};
  cameraObstacles.push({kind:'forest-emitted-terrain',min:[minX,Math.min(...heights),minZ],max:[maxX,Math.max(...heights),maxZ],heightfield});
  const terrainMeshY=(x:number,z:number)=>cameraTerrainHeight(heightfield,x,z)??terrainY(x,z);
  const terrainExtrema=(polygon:pc.Vec3[])=>{
    const x0=clamp(Math.floor((Math.min(...polygon.map(p=>p.x))-minX)/dx),0,nx-1),x1=clamp(Math.floor((Math.max(...polygon.map(p=>p.x))-minX)/dx),0,nx-1);
    const z0=clamp(Math.floor((Math.min(...polygon.map(p=>p.z))-minZ)/dz),0,nz-1),z1=clamp(Math.floor((Math.max(...polygon.map(p=>p.z))-minZ)/dz),0,nz-1);
    let low=Infinity,high=-Infinity;const vertex=(i:number)=>vec(...moss.positions.slice(i*3,i*3+3) as [number,number,number]);
    for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const i=z*(nx+1)+x;for(const t of [[i,i+nx+1,i+1],[i+1,i+nx+1,i+nx+2]])for(const p of intersectRoadFootprint(t.map(vertex),polygon)){low=Math.min(low,p.y);high=Math.max(high,p.y);}}return {low,high};
  };
  const groundPad=(kind:string,p:pc.Vec3,yaw:number,width:number,depth:number)=>{
    const at=local(p,yaw),footprint=[at(-width/2,0,-depth/2),at(width/2,0,-depth/2),at(width/2,0,depth/2),at(-width/2,0,depth/2)],{low,high}=terrainExtrema(footprint),bottom=low-.5;p.y=high+.16;
    const masonryVertexStart=masonry.positions.length/3,pavingVertexStart=coping.positions.length/3;
    box(kind+'-foundation',masonry,vec(p.x,(p.y-.12+bottom)/2,p.z),vec(width,p.y-.12-bottom,depth),yaw);masonry.indices.splice(masonry.indices.length-12,6);
    box(kind+'-cap',coping,vec(p.x,p.y-.06,p.z),vec(width,.12,depth),yaw);coping.indices.splice(coping.indices.length-6,6);
    foundations.push({kind,top:p.y,bottom,footprint:footprint.map(tuple),masonryVertexStart,pavingVertexStart});return local(p,yaw);
  };
  const record=(kind:string,p:pc.Vec3,radius:number,label?:string)=>{props.push({kind,x:p.x,y:p.y,z:p.z,radius});if(label)landmarks.push({kind,label,position:tuple(p)});};

  // Exact spatial ownership removes complete coplanar split/merge overlap.
  const priority=new Map([[course.commonStart,0],[course.commonFinish,1],[course.alternates.boulevard,2],[course.alternates.alley,3]]),ownership=new Map<string,boolean>();
  for(const f of sourceFaces){let fragments=[f.points];for(const owner of roadIndex.query(f.minX,f.maxX,f.minZ,f.maxZ)){
    if(priority.get(owner.edge)!>=priority.get(f.edge)!||Math.max(owner.maxY,f.maxY)-Math.min(owner.minY,f.minY)>.005)continue;
    fragments=fragments.flatMap(poly=>subtractRoadFootprint(poly,owner.points));if(!fragments.length)break;
  }const key=f.edge.id+':'+f.distance;ownership.set(key,(ownership.get(key)??false)||fragments.length>0);
    for(const poly of fragments)for(let i=1;i<poly.length-1;i++){const p=[poly[0],poly[i],poly[i+1]];if(footprintArea(p)<1e-8)continue;(f.edge===course.alternates.alley?service:road).tri(...p as [pc.Vec3,pc.Vec3,pc.Vec3]);
      const under=[p[2],p[1],p[0]].map(q=>q.clone().add(vec(0,-.45,0)));roots.tri(...under as [pc.Vec3,pc.Vec3,pc.Vec3]);roadFaces.push({edgeId:f.edge.id,distance:f.distance,points:p.map(tuple)});roadUndersideFaces.push({edgeId:f.edge.id,distance:f.distance,points:under.map(tuple)});
    }
  }
  for(const edge of edges){const n=Math.ceil(edge.length/1.65);for(let i=0;i<n;i++){
    const s=i/n*edge.length,t=(i+1)/n*edge.length,w=edge.halfWidthAt(s),wt=edge.halfWidthAt(t),a=point(edge,s,-w),b=point(edge,s,w),sample={edgeId:edge.id,distance:s,left:tuple(a),right:tuple(b),rendered:ownership.get(edge.id+':'+s)??false};roadSamples.push(sample);routeRoadSamples.push(sample);
    const viaduct=edge===course.commonFinish&&s<615&&t>260;
    for(const side of [-1,1]){
      const a=point(edge,s,side*w),b=point(edge,t,side*wt),mid=a.clone().lerp(a,b,.5),other=(f:typeof sourceFaces[number])=>f.edge!==edge&&f.minY<a.y+4&&f.maxY>a.y-4;
      if(!roadIndex.clearAt(mid.x,mid.z,a.distance(b)/2+.025,other))continue;
      const out=point(edge,s,side*(w+.7),.025),outNext=point(edge,t,side*(wt+.7),.025);
      coping.quad(a.clone().add(vec(0,.025,0)),out,b.clone().add(vec(0,.025,0)),outNext);roots.quad(a,a.clone().add(vec(0,-.45,0)),b,b.clone().add(vec(0,-.45,0)));
      if(!viaduct&&roadIndex.clearAt(mid.x,mid.z,a.distance(b)/2+2,f=>f.maxY<a.y-5)){
        const bottomA=terrainMeshY(out.x,out.z)-.25,bottomB=terrainMeshY(outNext.x,outNext.z)-.25;
        earth.quad(out,vec(out.x,bottomA,out.z),outNext,vec(outNext.x,bottomB,outNext.z));
        if(i%24===0)beam('retaining-timber-sleeper',roots,point(edge,s,side*(w+.68),-.6),point(edge,t,side*(wt+.68),-.6),.22,.32,false);
      }
      if(i%12===0){const end=Math.min(edge.length,s+12.8),p=point(edge,s,side*(w+.52),1.1),q=point(edge,end,side*(edge.halfWidthAt(end)+.52),1.1),middle=p.clone().lerp(p,q,.5);
        if(roadIndex.clearAt(middle.x,middle.z,p.distance(q)/2+.22,other)){
          beam('roadside-cedar-rail',timber,p,q,.24,.27);beam('roadside-cedar-post',roots,p.clone().add(vec(0,-1.0,0)),p.clone().add(vec(0,.28,0)),.26);
          if(i%36===0)box('roadside-amber-reflector',signal,p.clone().add(vec(0,.02,0)),vec(.29,.19,.29),0,false);
        }
      }
    }
  }}
  for(let row=0;row<2;row++)for(let col=0;col<16;col++)if((row+col)%2===0){const e=course.commonStart,s=row*.75,t=(row+1)*.75,w=e.halfWidthAt(s);cream.quad(point(e,s,-w+col*w/8,.027),point(e,s,-w+(col+1)*w/8,.027),point(e,t,-w+col*w/8,.027),point(e,t,-w+(col+1)*w/8,.027));}

  const plotData=[
    {kind:'abandoned-observatory',x:20,z:405,r:23,w:34,d:30,yaw:.24,label:'CedarLight Observatory: open copper dome and double-fork lens'},
    {kind:'root-cathedral',x:69.88613199486466,z:-47.050011386285156,r:17,w:0,d:0,yaw:0,label:'Root Cathedral: three rooted veteran cedars'},
    {kind:'cedar-bowl-fan',x:-278.6908745068894,z:148.5673587453813,r:20,w:0,d:0,yaw:0,label:'Cedar Bowl Fan: leaning crowns on one ridge shoulder'},
    {kind:'broken-meridian-armillary',x:46.63393569558838,z:571.3495747545905,r:12,w:12,d:12,yaw:.4,label:'Broken Meridian: interrupted brass survey rings'},
    {kind:'canopy-viaduct-lookout',x:106.34834083478663,z:115.4405858299369,r:13,w:17,d:16,yaw:-.28,label:'Canopy Lookout: off-road survey deck and prism'},
    {kind:'old-forestry-station',x:179.1281131652654,z:-369.12287388948823,r:15,w:24,d:17,yaw:-.25,label:'Old Forestry Station: ranger workshop and timber yard'},
  ];
  const dome:ForestSceneGeometry['dome']={center:[],radius:11.4,slitYaw:-1.85,slitHalfAngle:Math.PI/12,faces:[]};
  const ring=(kind:string,b:Batch,center:pc.Vec3,radius:number,yaw:number,tilt:number,from:number,to:number,width=.22)=>{
    const c=Math.cos(tilt),s=Math.sin(tilt),turn=local(center,yaw),segments=Math.ceil((to-from)/(.15)),path=[];
    for(let i=0;i<=segments;i++){const a=from+(to-from)*i/segments;path.push(turn(Math.cos(a)*radius,Math.sin(a)*radius*c,Math.sin(a)*radius*s));}
    tube(kind,b,path,path.map(()=>width),6,true,true);
  };
  // Solid wedge boughs have horizontal arms, dipping tips and exposed gaps.
  // They deliberately avoid the familiar repeated-cone pine silhouette.
  const bough=(kind:string,b:Batch,p:pc.Vec3,yaw:number,length:number,width:number,drop:number)=>{
    const at=local(p,yaw),v=[at(0,0,0),at(length*.42,.35,-width*.7),at(length*.42,.35,width*.7),at(length,-drop,0),at(length*.40,-.65,-width*.78),at(length*.40,-.65,width*.78)],start=b.positions.length/3;
    v.forEach(q=>b.vertex(q));for(const f of [[0,2,1],[1,2,3],[0,1,4],[1,3,4],[0,5,2],[2,5,3],[0,4,5],[4,3,5]])b.indices.push(...f.map(i=>start+i));bound(kind,b,start);return v;
  };
  const tree=(p:pc.Vec3,height:number,radius:number,seed:number,kind='cedar-cluster-tree',hero=false,fullness=1)=>{
    p.y=terrainMeshY(p.x,p.z);const lean=(noise(seed+31)-.5)*2.3,az=noise(seed+52)*Math.PI*2,at=local(p,az),baseRadius=hero?.95:.5+height*.013;
    const foot=baseRadius*1.5+.15,footprint=[vec(p.x-foot,0,p.z-foot),vec(p.x+foot,0,p.z-foot),vec(p.x+foot,0,p.z+foot),vec(p.x-foot,0,p.z+foot)],rootBottom=terrainExtrema(footprint).low-.35;groundedDetails.push({kind:'cedar-trunk-foot',x:p.x,z:p.z,bottom:rootBottom,terrainY:p.y});
    const path=[vec(p.x,rootBottom,p.z),at(lean*.12,height*.30,0),at(lean*.62,height*.67,.25),at(lean,height,.5)];
    tube('cedar-tapered-trunk',bark,path,[baseRadius*1.5,baseRadius,baseRadius*.59,.065],hero?9:7,true,true);
    for(let j=0;j<(hero?5:3);j++){
      const angle=az+j*Math.PI*2/(hero?5:3)+.25,reach=(hero?4.8:2.7)*(1+.15*noise(seed+j)),tip=vec(p.x+Math.cos(angle)*reach,0,p.z+Math.sin(angle)*reach);tip.y=terrainMeshY(tip.x,tip.z)-.2;
      const middle=vec(p.x+Math.cos(angle)*reach*.52,0,p.z+Math.sin(angle)*reach*.52);middle.y=Math.max(terrainMeshY(middle.x,middle.z)+.12,p.y+.1);
      tube('cedar-grounded-root',roots,[p.clone().add(vec(0,.45,0)),middle,tip],[baseRadius*.7,.35,.065],6,false,true);
      groundedDetails.push({kind:'cedar-root-toe',x:tip.x,z:tip.z,bottom:tip.y,terrainY:terrainMeshY(tip.x,tip.z)});
    }
    const layers=hero?5:3;
    for(let layer=0;layer<layers;layer++){
      const fraction=hero?.42+layer*.12:.43+layer*.23,center=at(lean*fraction,height*fraction,.35*fraction),reach=radius*(1-layer*(hero?.155:.25)),arms=hero?6:5;
      for(let j=0;j<arms;j++){const yaw=az+j*Math.PI*2/arms+layer*.57,branch=hero&&layer<3;
        if(branch)tube('cedar-visible-bough-branch',bark,[center,center.clone().add(vec(Math.cos(yaw)*reach*.77,-.3,Math.sin(yaw)*reach*.77))],[.17,.035],5,false,true,false);
        bough('cedar-opaque-bough-fan',[needles,litNeedles,blueNeedles][(j+layer+seed)%3],center,-yaw+Math.PI/2,reach*(.9+noise(seed+j*13+layer)*.15),reach*.28*fullness,.65+layer*.08);
      }
    }
    trees.push({kind,position:tuple(p),radius:radius+Math.abs(lean)+1,height});
  };
  for(const plot of plotData){
    const p=vec(plot.x,0,plot.z);if(!clearAt(p,plot.r,18))throw new Error('Forest landmark infringes source footprint: '+plot.kind);
    const at=plot.w?groundPad(plot.kind,p,plot.yaw,plot.w,plot.d):local(vec(p.x,terrainMeshY(p.x,p.z),p.z),plot.yaw);if(!plot.w)p.y=terrainMeshY(p.x,p.z);
    const put=(kind:string,b:Batch,x:number,y:number,z:number,w:number,h:number,d:number)=>box(kind,b,at(x,y,z),vec(w,h,d),plot.yaw);
    const strut=(kind:string,b:Batch,a:number[],c:number[],w:number,d=w)=>beam(kind,b,at(...a as [number,number,number]),at(...c as [number,number,number]),w,d);
    if(plot.kind==='abandoned-observatory'){
      tube('observatory-stepped-lower-drum',masonry,[at(0,0,0),at(0,1.4,0)],[12.9,12.9],24,false,false);
      tube('observatory-main-masonry-drum',masonry,[at(0,1.4,0),at(0,12,0)],[11.2,11.2],24,false,false);
      // Visible annular shoulder owns the drum step; no full coincident caps.
      for(let i=0;i<24;i++){const a=i/24*Math.PI*2,b=(i+1)/24*Math.PI*2;coping.quad(at(Math.cos(a)*12.9,1.4,Math.sin(a)*12.9),at(Math.cos(a)*11.2,1.4,Math.sin(a)*11.2),at(Math.cos(b)*12.9,1.4,Math.sin(b)*12.9),at(Math.cos(b)*11.2,1.4,Math.sin(b)*11.2));}
      tube('observatory-dome-bearing-ring',iron,[at(0,11.8,0),at(0,12.25,0)],[11.5,11.5],32,false,false);
      const center=at(0,12.2,0);dome.center=tuple(center);const segments=32,rings=10,from=dome.slitYaw+dome.slitHalfAngle,to=dome.slitYaw+Math.PI*2-dome.slitHalfAngle;
      const domePoint=(u:number,v:number,r=dome.radius)=>vec(center.x+Math.cos(u)*Math.cos(v)*r,center.y+Math.sin(v)*r,center.z+Math.sin(u)*Math.cos(v)*r);
      const start=copper.positions.length/3;
      for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++)copper.vertex(domePoint(from+(to-from)*i/segments,j/rings*Math.PI/2));
      for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const a=start+j*(segments+1)+i;for(const ids of [[a,a+1,a+segments+1],[a+1,a+segments+2,a+segments+1]]){
        // Omit degenerate zenith duplicates, keeping the slit actually open.
        const v=ids.map(k=>vec(...copper.positions.slice(k*3,k*3+3) as [number,number,number]));if(new pc.Vec3().cross(v[1].clone().sub(v[0]),v[2].clone().sub(v[0])).length()<1e-8)continue;copper.indices.push(...ids);dome.faces.push(v.map(tuple));
      }}bound('observatory-open-copper-dome',copper,start);
      for(const a of [from,to]){const path=Array.from({length:15},(_,j)=>domePoint(a,j/14*Math.PI/2));tube('observatory-articulated-shutter-edge',brass,path,path.map(()=>.18),6,true,true);}
      // Offset shutter slab follows one side of the opening without closing it.
      for(let j=0;j<8;j++){const a=domePoint(to-.10,j/10*Math.PI/2,11.62),b=domePoint(to-.10,(j+1)/10*Math.PI/2,11.62);beam('observatory-offset-shutter-rib',copper,a,b,.62,.12);}
      tube('observatory-instrument-pedestal',iron,[at(0,1.4,0),at(0,10.4,0)],[.85,.68],10,false,true);
      for(const x of [-1.65,1.65])strut('observatory-double-fork-arm',brass,[x,8.5,0],[x,14.5,0],.38);
      strut('observatory-double-fork-crosshead',brass,[-1.65,14.2,0],[1.65,14.2,0],.38);
      const lensA=at(-1,12.6,1.1),lensB=at(1.3,17.5,-3.9);tube('observatory-original-telescope',iron,[lensA,lensB],[.82,.65],12,true,false);tube('observatory-recessed-lens',glass,[lensB,lensB.clone().add(vec(.015,.03,-.025))],[.61,.61],12,true,true);
      // Separate stair tower remains inside the full, measured terrace plot.
      for(const x of [-14.2,-11.7])for(const z of [7,11])put('observatory-stair-tower-post',iron,x,5.2,z,.28,10.4,.28);
      for(let j=0;j<15;j++)put('observatory-real-stair-tread',coping,-12.95,.25+j*.34,-5.8+j*1.08,2.9,.22,1.05);
      for(const x of [-14.15,-11.75])strut('observatory-stair-under-stringer',iron,[x,.1,-6.3],[x,5.12,10.6],.18,.28);
      put('observatory-first-stair-shoe',masonry,-12.95,.10,-5.8,2.9,.2,1.1);
      put('observatory-stair-upper-landing',timber,-12.95,5.12,10.5,3.2,.24,3.0);
      for(const x of [-14.4,-11.45])strut('observatory-stair-hand-rail',iron,[x,1.25,-6.2],[x,6.3,10.6],.12);
      for(let i=0;i<9;i++){const a=i/9*Math.PI*2;box('observatory-recessed-window',glass,at(Math.cos(a)*11.19,7.3,Math.sin(a)*11.19),vec(1.25,2.4,.14),plot.yaw-a,false);}
      for(const z of [-9,9])put('observatory-copper-drain',copper,10.7,5.1,z,.18,9.9,.18);
      dome.center=tuple(center);for(const sight of sightlines)sight.target[1]=center.y+dome.radius*.86;
    }else if(plot.kind==='root-cathedral'){
      for(let j=0;j<3;j++)tree(vec(p.x+[-5.5,5,-.5][j],0,p.z+[-2.5,-3.7,5][j]),[29,26,31][j],[7.0,6.7,7.4][j],10+j,'root-cathedral-veteran',true);
    }else if(plot.kind==='cedar-bowl-fan'){
      for(let j=0;j<6;j++)tree(vec(p.x-11+j*4.2,0,p.z+Math.sin(j*1.15)*5),22+(j%3)*3.3,5.4+(j%2)*.6,20+j,'bowl-leaning-cedar',j%2===0);
    }else if(plot.kind==='broken-meridian-armillary'){
      put('armillary-grounded-stone-shoe',shale,0,.6,0,5,1.2,5);for(const side of [-1,1])strut('armillary-forked-iron-pedestal',iron,[side*1.7,1.2,0],[side*3.4,6.4,0],.42);
      ring('armillary-broken-meridian',brass,at(0,8.3,0),5.3,plot.yaw,0,.30,Math.PI*2-.45,.24);
      ring('armillary-oblique-equator',copper,at(0,8.3,0),4.6,plot.yaw+Math.PI/2,.40,0,Math.PI*2,.2);
      strut('armillary-survey-axis',iron,[0,3.2,-2.1],[0,12.9,2.1],.22);put('armillary-amber-index',signal,0,8.3,0,.55,.55,.55);
    }else if(plot.kind==='canopy-viaduct-lookout'){
      for(const x of [-4,4])for(const z of [-4,4]){put('lookout-stone-shoe',masonry,x,.35,z,1.3,.7,1.3);put('lookout-timber-post',timber,x,5.7,z,.55,10,.55);}
      for(const z of [-4,4])strut('lookout-open-cross-brace',roots,[-4,1.2,z],[4,9.8,z],.24);
      put('lookout-survey-platform',timber,0,10.6,0,9,.35,9);for(const side of [-1,1]){put('lookout-side-rail',timber,side*4.3,11.65,0,.19,.19,8.8);put('lookout-end-rail',timber,0,11.65,side*4.3,8.8,.19,.19);}
      for(let i=0;i<23;i++)put('lookout-real-stair-tread',cutWood,-6.2,.3+i*.46,-6+i*.52,2.1,.18,.52);
      for(const x of [-7.3,-5.1])strut('lookout-stair-side-stringer',roots,[x,.2,-6.35],[x,10.65,5.8],.23,.34);
      for(const x of [-7.3,-5.1])strut('lookout-stair-hand-rail',timber,[x,1.35,-6.35],[x,11.8,5.8],.16);
      put('lookout-stair-landing',timber,-5.7,10.6,4.1,2.9,.35,2.1);put('lookout-prism-pedestal',iron,0,11.7,0,.2,2.0,.2);
      tube('lookout-static-prism',brass,[at(0,12.6,0),at(0,13.25,0)],[.75,.75],3,true,true);
    }else{
      put('forestry-workshop-rear-wall',timber,-3,3,4.75,15,6,.5);
      for(const x of [-10.25,4.25])put('forestry-workshop-side-wall',timber,x,3,0,.5,6,10);
      for(const x of [-7.625,1.625])put('forestry-door-opening-pier',timber,x,3,-4.75,5.75,6,.5);
      put('forestry-door-opening-lintel',timber,-3,5.4,-4.75,3.5,1.2,.5);
      // Gable walls are true triangles with a pitched split roof.
      for(const z of [-5,5]){const st=cutWood.positions.length/3;cutWood.tri(at(-10.5,6,z),at(4.5,6,z),at(-3,9,z));bound('forestry-workshop-gable',cutWood,st);}
      for(const side of [-1,1]){const st=copper.positions.length/3;copper.quad(at(-3,9.05,-5.8),at(-3+side*8.2,5.78,-5.8),at(-3,9.05,5.8),at(-3+side*8.2,5.78,5.8));bound('forestry-pitched-roof',copper,st);}
      put('forestry-recessed-door',roots,-3,2.2,-4.35,3.5,4.4,.14);
      for(const x of [-4.75,-1.25])put('forestry-door-reveal',cutWood,x,2.4,-4.65,.16,4.8,.70);
      put('forestry-door-threshold',masonry,-3,.09,-4.65,3.5,.18,.85);for(const x of [-5,-1])put('forestry-door-jamb',cutWood,x,2.4,-5.18,.28,4.8,.38);put('forestry-door-header',cutWood,-3,4.8,-5.18,4.3,.28,.38);
      for(const x of [-8,2])put('forestry-recessed-window',glass,x,3.8,-5.05,2.1,1.8,.12);
      for(const z of [-4,4])put('forestry-lean-to-post',timber,10.2,2.0,z,.38,4,.38);
      const st=timber.positions.length/3;timber.quad(at(4.5,5.6,-4.8),at(11,4.1,-4.8),at(4.5,5.6,4.8),at(11,4.1,4.8));bound('forestry-slope-lean-to',timber,st);
      for(const z of [-3,3])put('forestry-log-saddle',roots,7.8,.35,z,5.0,.7,.65);
      for(let i=0;i<5;i++){const x=5.75+i*.95;const a=at(x,1.15,-3.8),b=at(x,1.15,3.8);tube('forestry-supported-cut-log',bark,[a,b],[.46,.46],8,false,false);tube('forestry-log-visible-cut-end',cutWood,[a,a.clone().lerp(a,b,.002)],[.455,.455],8,true,false);tube('forestry-log-visible-cut-end',cutWood,[b.clone().lerp(b,a,.002),b],[.455,.455],8,false,true);}
      for(const z of [-5.9,5.9])put('forestry-rain-channel',iron,-3,5.84,z,16.4,.13,.16);
    }
    record(plot.kind,p,plot.r,plot.label);
  }

  // Full-width open viaduct: all in-corridor structure fits inside 2.2 m.
  const upper=course.commonFinish,spanFrom=260,spanTo=615,lowerFaces=sourceFaces.filter(f=>f.edge!==upper),lowerIndex=new RoadFootprintIndex(lowerFaces);
  let clearance=Infinity;for(const a of sourceFaces.filter(f=>f.edge===upper&&f.distance>=spanFrom&&f.distance<=spanTo))for(const b of lowerIndex.query(a.minX,a.maxX,a.minZ,a.maxZ)){
    if(a.minY<b.maxY+10)continue;const overlap=intersectRoadFootprint(a.points,b.points);if(footprintArea(overlap)>1e-8)clearance=Math.min(clearance,a.minY-b.maxY-2.2);
  }
  structures.push({kind:'viaduct',from:spanFrom,to:spanTo,overheadClearance:clearance});
  for(let s=spanFrom;s<spanTo;s+=3){const t=Math.min(spanTo,s+3),w=upper.halfWidthAt(s),wt=upper.halfWidthAt(t);
    for(const side of [-1,1]){const v=beam('canopy-shallow-laminated-chord',timber,point(upper,s,side*(w-.7),-1.25),point(upper,t,side*(wt-.7),-1.25),.7,.8);trestleMembers.push({kind:'shallow-chord',points:v.map(tuple),minimumRoadClearance:clearance});}
    if((s-spanFrom)%6===0){const v=beam('canopy-separated-cross-tie',roots,point(upper,s,-w-.7,-.72),point(upper,s,w+.7,-.72),.4,.42);trestleMembers.push({kind:'cross-tie',points:v.map(tuple),minimumRoadClearance:clearance});}
    const p=[point(upper,s,-w,-.45),point(upper,s,w,-.45),point(upper,t,-wt),point(upper,t,wt)];cameraObstacles.push({kind:'canopy-source-deck-segment',min:[Math.min(...p.map(q=>q.x)),Math.min(...p.map(q=>q.y)),Math.min(...p.map(q=>q.z))],max:[Math.max(...p.map(q=>q.x)),Math.max(...p.map(q=>q.y)),Math.max(...p.map(q=>q.z))]});
  }
  for(let s=266;s<spanTo;s+=36)for(const side of [-1,1]){
    const w=upper.halfWidthAt(s),p=point(upper,s,side*(w+7.8)),deckY=p.y,yaw=upper.sample(s).angle,inner=point(upper,s,side*(w-.7),-1.25);
    if(!freeAt(p,2.5)||deckY-terrainMeshY(p.x,p.z)<4)continue;
    const middle=p.clone().lerp(p,inner,.5),lower=(f:typeof sourceFaces[number])=>f.maxY<deckY-5;
    // The whole post/crosshead/brace envelope, not just its centre, clears
    // the lower ribbon union with the stipulated five metres of room.
    if(!roadIndex.clearAt(middle.x,middle.z,p.distance(inner)/2+5.8,lower))continue;
    groundPad('canopy-grounded-bent',p,yaw,3.4,3.4);const top=deckY-1.25;
    box('canopy-stone-shoe',masonry,p.clone().add(vec(0,.35,0)),vec(1.6,.7,1.6),yaw);
    const post=beam('canopy-grounded-timber-post',timber,p.clone().add(vec(0,.7,0)),vec(p.x,top,p.z),.82);trestleMembers.push({kind:'outside-corridor-post',points:post.map(tuple),minimumRoadClearance:5});
    const arm=beam('canopy-open-crosshead',timber,vec(p.x,top,p.z),inner,.72,.76);trestleMembers.push({kind:'outside-corridor-crosshead',points:arm.map(tuple),minimumRoadClearance:5});
    const brace=beam('canopy-open-knee-brace',cutWood,vec(p.x,Math.max(p.y+1.1,top-5.5),p.z),inner.clone().lerp(inner,vec(p.x,top,p.z),.2),.35,.40);trestleMembers.push({kind:'outside-corridor-brace',points:brace.map(tuple),minimumRoadClearance:5});
    box('canopy-iron-post-saddle',iron,vec(p.x,top-.3,p.z),vec(.91,.2,.91),yaw);record('canopy-grounded-bent',p,2.5);
  }
  landmarks.push({kind:'canopy-root-viaduct',label:'Canopy Viaduct: open upper span above the earlier Root Valley',position:tuple(upper.sample(452.320503).p)});

  // Trees follow six intentional ridge/valley groups, leaving full crown
  // margins, the inner bowl and four observatory sight tubes deliberately open.
  const blocksSight=(p:pc.Vec3,r:number,h:number)=>sightlines.some(({eye,target,radius})=>{
    const dx=target[0]-eye[0],dz=target[2]-eye[2],t=clamp(((p.x-eye[0])*dx+(p.z-eye[2])*dz)/(dx*dx+dz*dz),0,1),d=Math.hypot(p.x-eye[0]-dx*t,p.z-eye[2]-dz*t),y=eye[1]+(target[1]-eye[1])*t;
    return d<r+radius&&p.y+h>y-radius&&p.y<y+radius;
  });
  const groups=[{x:-302,z:-172,w:58,d:178},{x:-300,z:323,w:62,d:179},{x:-151,z:584,w:116,d:74},{x:223,z:286,w:118,d:145},{x:263,z:-123,w:96,d:201},{x:-45,z:-318,w:146,d:67}];
  const cedarPlans:{p:pc.Vec3;height:number;r:number;seed:number;kind:string;hero:boolean;fullness:number;prop:LandPropPlacement}[]=[],treeStart=trees.length;
  // Preserve the original ninety-tree allocation and prototype complexity.
  // Plan before emitting so a deliberate composition move cannot add geometry.
  for(let g=0;g<groups.length;g++){const q=groups[g];let placed=0;for(let i=0;i<160&&placed<18;i++){
    const x=q.x+(noise(g*301+i*13)-.5)*q.w,z=q.z+(noise(g*509+i*17)-.5)*q.d,p=vec(x,terrainMeshY(x,z),z),height=18+noise(i*11+g)*13,r=5.4+noise(i*23+g)*2.8;
    if(x-r<minX+3||x+r>maxX-3||z-r<minZ+3||z+r>maxZ-3||!freeAt(p,r+3,18)||blocksSight(p,r+3,height)||trees.some(t=>Math.hypot(t.position[0]-x,t.position[2]-z)<(t.radius+r)*.65))continue;
    const seed=g*1000+i,kind='ridge-cluster-'+g,hero=placed===0;
    trees.push({kind,position:tuple(p),radius:r+Math.abs((noise(seed+31)-.5)*2.3)+1,height});
    record('ridge-cedar-cluster',p,r+3);cedarPlans.push({p,height,r,seed,kind,hero,fullness:1,prop:props[props.length-1]});placed++;
  }}
  const nearClusters=[
    {name:'root-valley',edge:course.commonStart,distances:[200,235,270,305,340,375,410,465,500,535,565],sides:[-1,1]},
    {name:'outer-bowl',edge:course.commonStart,distances:[610,640,670,700,730,760,790,820,850,880,910],sides:[-1]},
    {name:'canopy-return',edge:course.commonFinish,distances:[240,280,320,360,400,500,540,580,630,670,710],sides:[-1,1]},
    {name:'sunbreak-shoulder',edge:course.commonFinish,distances:[735,770,805,840,875,910,945,980,1015,1050,1085],sides:[-1,1]},
  ];
  const candidates=Array.from({length:11},(_,i)=>nearClusters.flatMap(cluster=>cluster.sides.map(side=>({cluster,s:cluster.distances[i],side})))).flat();
  for(let k=0;k<54;k++){
    const plan=cedarPlans[(k*37)%cedarPlans.length],r=9.4+(k%4)*.55,height=plan.height+3.5;
    let found=false;
    for(const extra of [0,8,16]){for(const {cluster,s,side} of candidates){
      const p=point(cluster.edge,s,side*(cluster.edge.halfWidthAt(s)+r+3+18.1+extra));p.y=terrainMeshY(p.x,p.z);
      if(p.x-r<minX+3||p.x+r>maxX-3||p.z-r<minZ+3||p.z+r>maxZ-3||!clearAt(p,r+3,18)||blocksSight(p,r+3,height))continue;
      if(props.some(q=>q!==plan.prop&&Math.hypot(q.x-p.x,q.z-p.z)<=q.radius+r+5))continue;
      plan.p=p;plan.r=r;plan.height=height;plan.kind='near-route-'+cluster.name;plan.fullness=1.75;
      Object.assign(plan.prop,{kind:'near-route-cedar-cluster',x:p.x,y:p.y,z:p.z,radius:r+3});found=true;break;
    }if(found)break;}
  }
  trees.splice(treeStart);
  for(const plan of cedarPlans)tree(plan.p,plan.height,plan.r,plan.seed,plan.kind,plan.hero,plan.fullness);
  const findPlot=(e:SceneryRoadEdge,s:number,r:number,side:number,margin=7)=>{for(const extra of [0,5,11,18]){const p=point(e,s,side*(e.halfWidthAt(s)+r+margin+extra));if(freeAt(p,r))return p;}return null;};
  for(const side of [-1,1]){
    const e=course.commonStart,s=e.length-88,p=findPlot(e,s,3.6,side);if(!p)continue;const yaw=e.sample(s).angle,at=groundPad('forest-fork-wayfinding',p,yaw,5.8,1.8),raise=e.sample(s).p.y-p.y;
    for(const x of [-2.25,2.25])box('fork-sign-post',roots,at(x,(4.2+raise)/2,0),vec(.3,4.2+raise,.3),yaw);
    box('fork-sign-cream-board',cream,at(0,raise+3.8,0),vec(5.6,1.8,.2),yaw);
    for(const z of [-.12,.12]){signal.quad(at(-1.0,raise+3.7,z),at(1.0,raise+3.7,z),at(-1.0,raise+3.9,z),at(1.0,raise+3.9,z));signal.tri(at(side*2.1,raise+3.8,z),at(side*.75,raise+4.45,z),at(side*.75,raise+3.15,z));for(let j=0;j<(side>0?2:4);j++)box('fork-width-symbol',iron,at(-1.8+j*.35,raise+3.27,z),vec(.20,.12,.025),yaw,false);}
    record('forest-fork-wayfinding',p,3.6,side>0?'Lens Service Path: narrow inner route':'Observatory Rim: broad outer route');
  }
  // Low paired fern and shale groups hug the actual soil, never floating pads.
  for(let i=0;i<60;i++){
    const e=edges[i%4],s=(.07+(i%15)/17)*e.length,p=findPlot(e,s,2.2,i%2?1:-1);if(!p)continue;p.y=terrainMeshY(p.x,p.z);
    for(let j=0;j<5;j++){const a=j/5*Math.PI*2+i*.7,tip=vec(p.x+Math.cos(a)*1.6,p.y+.3,p.z+Math.sin(a)*1.6),mid=p.clone().lerp(p,tip,.55);mid.y+=.8;
      const side=vec(-Math.sin(a)*.28,0,Math.cos(a)*.28);fern.tri(p.clone().add(vec(0,-.07,0)),mid.clone().add(side),tip);fern.tri(p.clone().add(vec(0,-.07,0)),tip,mid.clone().sub(side));
    }groundedDetails.push({kind:'fern-root',x:p.x,z:p.z,bottom:p.y-.07,terrainY:p.y});
    if(i%4===0){const footprint=[vec(p.x-1.25,0,p.z-1.25),vec(p.x+1.25,0,p.z-1.25),vec(p.x+1.25,0,p.z+1.25),vec(p.x-1.25,0,p.z+1.25)],a=vec(p.x,terrainExtrema(footprint).low-.5,p.z),b=p.clone().add(vec(.3,.85,.1));tube('soil-embedded-shale-fin',shale,[a,b],[1.1,.62],5,true,true,false);groundedDetails.push({kind:'shale-foot',x:p.x,z:p.z,bottom:a.y,terrainY:p.y});}
  }
  const used=batches.filter(b=>b.indices.length),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const b of used)for(let i=0;i<b.positions.length;i++){const j=i%3;min[j]=Math.min(min[j],b.positions[i]);max[j]=Math.max(max[j],b.positions[i]);}
  return {version:1,trackId:course.id,batches:used,roadSamples,routeRoadSamples,props,structures,roadFaces,roadUndersideFaces,foundations,cameraObstacles,components,landmarks,trestleMembers,trees,groundedDetails,sightlines,dome,terrainGrid:{minX,minZ,dx,dz,columns:nx+1,rows:nz+1},bounds:{min,max}};
}
