import * as pc from 'playcanvas';
import {LandMeshBatch as Batch,cylinder} from './land-mesh-builder';
import {footprintArea,intersectRoadFootprint,subtractRoadFootprint,sampleRoadFootprints,RoadFootprintIndex,type SceneryForkCourse,type SceneryRoadEdge} from './land-road-mesh';
import type {LandSceneGeometry,LandPropPlacement} from './land-scenery';
import type {LandSceneTheme} from './land-scene';
import type {CameraBlocker} from './land-camera';

export interface QuarrySceneGeometry extends LandSceneGeometry {
  routeRoadSamples:{edgeId:string;distance:number;left:number[];right:number[];rendered:boolean}[];
  roadFaces:{edgeId:string;distance:number;points:number[][]}[];
  roadUndersideFaces:{edgeId:string;distance:number;points:number[][]}[];
  foundations:{kind:string;top:number;bottom:number;footprint:number[][];masonryVertexStart:number;pavingVertexStart:number}[];
  cameraObstacles:(CameraBlocker&{kind:string})[];
  landmarks:{kind:string;label:string;position:number[]}[];
  terrainGrid:{minX:number;minZ:number;dx:number;dz:number;columns:number;rows:number};
  trestleMembers:{kind:string;points:number[][];minimumRoadClearance:number}[];
}
export const QUARRY_SCENE_THEME:Readonly<LandSceneTheme>=Object.freeze({
  textureLabel:'redstrata quarry',ambient:'#b9a183',sky:'#e5caa0',fogStart:700,fogEnd:1400,
  cameraName:'Redstrata Quarry chase camera',sunName:'Redstrata dry afternoon sunlight',
  sunColor:'#fff0cb',sunIntensity:1.65,sunEuler:[48,-32,0] as const,
});
const vec=(x:number,y:number,z:number)=>new pc.Vec3(x,y,z);
const tuple=(p:pc.Vec3)=>[p.x,p.y,p.z];
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const smooth=(v:number)=>{const u=clamp(v,0,1);return u*u*(3-2*u);};
const noise=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const local=(p:pc.Vec3,yaw:number)=>{const c=Math.cos(yaw),s=Math.sin(yaw);return(x:number,y:number,z:number)=>vec(p.x+x*c+z*s,p.y+y,p.z-x*s+z*c);};

/** Original, entirely dry sandstone working quarry. All roads, structures,
 * supports and the offline artifact consume the same physical edge samplers. */
export function buildQuarrySceneGeometry(course:SceneryForkCourse):QuarrySceneGeometry {
  const haul=new Batch('Quarry compacted haul road','#b89a73',.98,'asphalt');
  const shelf=new Batch('Quarry sawn pale shelf road','#dcc197',.97,'stone');
  const soffit=new Batch('Quarry deck underside and shadow cut','#594536',1,'stone');
  const sandstone=new Batch('Quarry amber sandstone cut faces','#bb7848',1,'stone');
  const strata=new Batch('Quarry red oxide horizontal strata','#a65837',1,'stone');
  const ground=new Batch('Quarry continuous dry working floor','#8f7960',1,'stone');
  const timber=new Batch('Quarry dark structural timber','#4a3427',.98,'wood');
  const sunWood=new Batch('Quarry sunlit timber edges','#96704b',.96,'wood');
  const iron=new Batch('Quarry dark iron plates and bolts','#45413a',.64,'none',.45);
  const belt=new Batch('Quarry charcoal conveyor belts','#302d27',.95,'none');
  const ochre=new Batch('Quarry ochre route boards','#d6a747',.9,'wood');
  const ivory=new Batch('Quarry ivory wayfinding and race marks','#f0dfb6',.88);
  const dust=new Batch('Quarry dry cut chips and dust facets','#c39d6f',1,'stone');
  const pale=new Batch('Quarry freshly sawn sandstone edges','#d6ad78',1,'stone');
  const darkStrata=new Batch('Quarry deep fractured oxide seams','#783f2c',1,'stone');
  const greyWood=new Batch('Quarry silvered cassette sleepers','#82725e',1,'wood');
  const rust=new Batch('Quarry weathered iron wheel rims','#926044',.83,'none',.32);
  const footing=new Batch('Quarry solid footing foundations','#866143',1,'stone');
  const orange=new Batch('Quarry kiln orange safety panels','#d6772f',.84);
  const shadowDust=new Batch('Quarry crushed red gravel facets','#8f6745',1,'stone');
  const batches=[haul,shelf,soffit,sandstone,strata,ground,timber,sunWood,iron,belt,ochre,ivory,dust,pale,darkStrata,greyWood,rust,footing,orange,shadowDust];
  const edges=[course.commonStart,course.alternates.alley,course.alternates.boulevard,course.commonFinish];
  const props:LandPropPlacement[]=[],roadSamples:QuarrySceneGeometry['roadSamples']=[],routeRoadSamples:QuarrySceneGeometry['routeRoadSamples']=[];
  const roadFaces:QuarrySceneGeometry['roadFaces']=[],roadUndersideFaces:QuarrySceneGeometry['roadUndersideFaces']=[],foundations:QuarrySceneGeometry['foundations']=[];
  const cameraObstacles:QuarrySceneGeometry['cameraObstacles']=[],landmarks:QuarrySceneGeometry['landmarks']=[],trestleMembers:QuarrySceneGeometry['trestleMembers']=[],structures:QuarrySceneGeometry['structures']=[];
  const sourceFaces=sampleRoadFootprints(edges),roadIndex=new RoadFootprintIndex(sourceFaces);
  const support=edges.flatMap(edge=>Array.from({length:Math.ceil(edge.length/2)+1},(_,i)=>{
    const s=edge.length*i/Math.ceil(edge.length/2),f=edge.sample(s),half=edge.halfWidthAt(s);
    return {edge,s,p:f.p,half,low:f.p.y-Math.abs(f.n.y)*half,high:f.p.y+Math.abs(f.n.y)*half};
  }));
  const point=(edge:SceneryRoadEdge,s:number,l:number,h=0)=>edge.sample(s,l).p.clone().add(vec(0,h,0));
  const clearAt=(p:pc.Vec3,r:number,margin=5)=>roadIndex.clearAt(p.x,p.z,r+margin);
  const freeAt=(p:pc.Vec3,r:number)=>clearAt(p,r)&&props.every(q=>Math.hypot(q.x-p.x,q.z-p.z)>q.radius+r+2);
  const bound=(kind:string,batch:Batch,start:number)=>{
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=start;i<batch.positions.length;i++){const j=i%3;min[j]=Math.min(min[j],batch.positions[i]);max[j]=Math.max(max[j],batch.positions[i]);}
    if(min.every((n,i)=>n<max[i]))cameraObstacles.push({kind,min,max});
  };
  const box=(kind:string,batch:Batch,p:pc.Vec3,size:pc.Vec3,yaw=0,obstacle=true)=>{
    const start=batch.positions.length;batch.box(p,size,yaw);if(obstacle)bound(kind,batch,start);
  };
  // Proper three-dimensional rectangular beams, including inclined conveyors
  // and braces. Camera bounds come from their actual generated vertices.
  const beam=(kind:string,batch:Batch,a:pc.Vec3,b:pc.Vec3,width:number,depth=width,obstacle=true)=>{
    const y=b.clone().sub(a).normalize(),x=new pc.Vec3().cross(y,vec(0,1,0));if(x.length()<.01)x.set(1,0,0);else x.normalize();
    const z=new pc.Vec3().cross(x,y).normalize(),at=(p:pc.Vec3,i:number,j:number)=>p.clone().add(x.clone().mulScalar(i*width/2)).add(z.clone().mulScalar(j*depth/2));
    const v=[at(a,-1,-1),at(a,1,-1),at(b,-1,-1),at(b,1,-1),at(a,-1,1),at(a,1,1),at(b,-1,1),at(b,1,1)],start=batch.positions.length;
    for(const f of [[0,1,2,3],[5,4,7,6],[4,0,6,2],[1,5,3,7],[2,3,6,7],[4,5,0,1]])batch.quad(v[f[0]],v[f[1]],v[f[2]],v[f[3]]);
    if(obstacle)bound(kind,batch,start);return v;
  };
  const solid=(kind:string,batch:Batch,polygon:pc.Vec3[],bottom:number,top:number,obstacle=true)=>{
    const start=batch.positions.length;
    for(let i=1;i<polygon.length-1;i++){
      const t=[polygon[0],polygon[i],polygon[i+1]].map(p=>vec(p.x,top,p.z));
      const normal=new pc.Vec3().cross(t[1].clone().sub(t[0]),t[2].clone().sub(t[0]));if(normal.y<0)[t[1],t[2]]=[t[2],t[1]];batch.tri(t[0],t[1],t[2]);
    }
    for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];batch.quad(vec(a.x,bottom,a.z),vec(b.x,bottom,b.z),vec(a.x,top,a.z),vec(b.x,top,b.z));}
    if(obstacle)bound(kind,batch,start);
  };

  // A connected heightfield approaches the working roads and is capped by the
  // LOWEST nearby source support. The upper trestle can never fill the underpass.
  const minX=Math.min(...support.map(q=>q.p.x))-150,maxX=Math.max(...support.map(q=>q.p.x))+150;
  const minZ=Math.min(...support.map(q=>q.p.z))-145,maxZ=Math.max(...support.map(q=>q.p.z))+150;
  const nx=Math.ceil((maxX-minX)/6.5),nz=Math.ceil((maxZ-minZ)/6.5),dx=(maxX-minX)/nx,dz=(maxZ-minZ)/nz;
  const terrainY=(x:number,z:number)=>{
    let nearest=Infinity,target=-4,ceiling=Infinity;
    for(const q of support){const d=Math.hypot(x-q.p.x,z-q.p.z);if(d<nearest){nearest=d;target=q.low-2.3;}if(d<q.half+18)ceiling=Math.min(ceiling,q.low-2.8);}
    const rise=smooth(1-Math.max(0,nearest-15)/120),base=-4+(target+4)*rise;
    return Math.min(ceiling,base);
  };
  for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){
    const wx=minX+x*dx,wz=minZ+z*dz;ground.vertex(vec(wx,terrainY(wx,wz),wz));
    if(x<nx&&z<nz){const i=z*(nx+1)+x;ground.indices.push(i,i+nx+1,i+1,i+1,i+nx+1,i+nx+2);}
  }
  const terrainHeights=ground.positions.filter((_,i)=>i%3===1);
  cameraObstacles.push({kind:'quarry-emitted-terrain',min:[minX,Math.min(...terrainHeights),minZ],max:[maxX,Math.max(...terrainHeights),maxZ],
    heightfield:{minX,minZ,dx,dz,columns:nx+1,rows:nz+1,heights:terrainHeights}});
  const terrainMeshY=(x:number,z:number)=>{
    const gx=clamp((x-minX)/dx,0,nx-.000001),gz=clamp((z-minZ)/dz,0,nz-.000001),ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,i=iz*(nx+1)+ix;
    const y=(k:number)=>ground.positions[k*3+1],a=y(i),b=y(i+1),c=y(i+nx+1),d=y(i+nx+2);
    return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
  };
  // Exact extrema of the actual emitted terrain over the entire oriented pad:
  // intersect every covered grid triangle, not only the object's centre/corners.
  const terrainExtrema=(polygon:pc.Vec3[])=>{
    const x0=clamp(Math.floor((Math.min(...polygon.map(p=>p.x))-minX)/dx),0,nx-1),x1=clamp(Math.floor((Math.max(...polygon.map(p=>p.x))-minX)/dx),0,nx-1);
    const z0=clamp(Math.floor((Math.min(...polygon.map(p=>p.z))-minZ)/dz),0,nz-1),z1=clamp(Math.floor((Math.max(...polygon.map(p=>p.z))-minZ)/dz),0,nz-1);
    let low=Infinity,high=-Infinity;const vertex=(i:number)=>vec(...ground.positions.slice(i*3,i*3+3) as [number,number,number]);
    for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const i=z*(nx+1)+x;
      for(const t of [[i,i+nx+1,i+1],[i+1,i+nx+1,i+nx+2]])for(const p of intersectRoadFootprint(t.map(vertex),polygon)){low=Math.min(low,p.y);high=Math.max(high,p.y);}
    }return {low,high};
  };
  const groundPad=(kind:string,p:pc.Vec3,yaw:number,width:number,depth:number)=>{
    const at=local(p,yaw),footprint=[at(-width/2,0,-depth/2),at(width/2,0,-depth/2),at(width/2,0,depth/2),at(-width/2,0,depth/2)];
    const {low,high}=terrainExtrema(footprint),bottom=low-.5;p.y=high+.12;
    const masonryVertexStart=footing.positions.length/3,pavingVertexStart=pale.positions.length/3;
    box(kind+'-foundation',footing,vec(p.x,(p.y-.10+bottom)/2,p.z),vec(width,p.y-.10-bottom,depth),yaw);
    // The touching internal interfaces are not rendered at all. There is one
    // visible cap top, no coincident opposite-wound internal top/bottom faces.
    footing.indices.splice(footing.indices.length-12,6);
    box(kind+'-cap',pale,vec(p.x,p.y-.05,p.z),vec(width,.10,depth),yaw);
    pale.indices.splice(pale.indices.length-6,6);
    foundations.push({kind,top:p.y,bottom,footprint:footprint.map(tuple),masonryVertexStart,pavingVertexStart});return at;
  };
  const record=(kind:string,p:pc.Vec3,radius:number,label?:string)=>{props.push({kind,x:p.x,y:p.y,z:p.z,radius});if(label)landmarks.push({kind,label,position:tuple(p)});};

  // Priority is common roads, then haul, then shelf. Every coplanar overlap
  // between DIFFERENT source ribbons is subtracted, including long branch tails.
  const priority=new Map([[course.commonStart,0],[course.commonFinish,1],[course.alternates.boulevard,2],[course.alternates.alley,3]]);
  const ownership=new Map<string,boolean>();
  for(const face of sourceFaces){
    let fragments=[face.points];
    for(const owner of roadIndex.query(face.minX,face.maxX,face.minZ,face.maxZ)){
      if(priority.get(owner.edge)!>=priority.get(face.edge)!||owner.maxY<face.minY-.005||owner.minY>face.maxY+.005)continue;
      // Disconnected crossing elevations are deliberately never clipped.
      if(Math.max(owner.maxY,face.maxY)-Math.min(owner.minY,face.minY)>.005)continue;
      fragments=fragments.flatMap(poly=>subtractRoadFootprint(poly,owner.points));if(!fragments.length)break;
    }
    const key=face.edge.id+':'+face.distance;ownership.set(key,(ownership.get(key)??false)||fragments.length>0);
    for(const poly of fragments)for(let i=1;i<poly.length-1;i++){
      const p=[poly[0],poly[i],poly[i+1]];if(footprintArea(p)<1e-8)continue;
      (face.edge===course.alternates.alley?shelf:haul).tri(...p as [pc.Vec3,pc.Vec3,pc.Vec3]);
      const under=[p[2],p[1],p[0]].map(q=>q.clone().add(vec(0,-.6,0)));soffit.tri(...under as [pc.Vec3,pc.Vec3,pc.Vec3]);
      roadFaces.push({edgeId:face.edge.id,distance:face.distance,points:p.map(tuple)});
      roadUndersideFaces.push({edgeId:face.edge.id,distance:face.distance,points:under.map(tuple)});
    }
  }
  for(const edge of edges){
    const n=Math.ceil(edge.length/1.65);
    for(let i=0;i<n;i++){
      const s=i/n*edge.length,t=(i+1)/n*edge.length,w=edge.halfWidthAt(s),wt=edge.halfWidthAt(t),a=point(edge,s,-w),b=point(edge,s,w);
      const sample={edgeId:edge.id,distance:s,left:tuple(a),right:tuple(b),rendered:ownership.get(edge.id+':'+s)??false};roadSamples.push(sample);routeRoadSamples.push(sample);
      const trestle=edge===course.commonFinish&&s<610&&t>500;
      for(const side of [-1,1]){
        const a=point(edge,s,side*w),b=point(edge,t,side*wt),m=a.clone().lerp(a,b,.5);
        // Exact union query plus segment radius keeps caps, fills and rails out
        // of ALL overlapping throats instead of deleting a guessed junction zone.
        const other=(f:typeof sourceFaces[number])=>f.edge!==edge&&f.minY<a.y+4&&f.maxY>a.y-4;
        if(!roadIndex.clearAt(m.x,m.z,a.distance(b)/2+.02,other))continue;
        const out=point(edge,s,side*(w+1.1),.08),outNext=point(edge,t,side*(wt+1.1),.08);
        pale.quad(a.clone().add(vec(0,.08,0)),out,b.clone().add(vec(0,.08,0)),outNext);
        soffit.quad(a,a.clone().add(vec(0,-.6,0)),b,b.clone().add(vec(0,-.6,0)));
        if(!trestle){
          const low=(f:typeof sourceFaces[number])=>f.maxY<a.y-5;
          if(roadIndex.clearAt(m.x,m.z,a.distance(b)/2+3,low)){
            const bottomA=terrainMeshY(out.x,out.z)-.3,bottomB=terrainMeshY(outNext.x,outNext.z)-.3;
            const highA=Math.max(bottomA,a.y-1.4),highB=Math.max(bottomB,b.y-1.4),lowA=Math.max(bottomA,a.y-1.7),lowB=Math.max(bottomB,b.y-1.7);
            sandstone.quad(out,vec(out.x,highA,out.z),outNext,vec(outNext.x,highB,outNext.z));
            strata.quad(vec(out.x,highA,out.z),vec(out.x,lowA,out.z),vec(outNext.x,highB,outNext.z),vec(outNext.x,lowB,outNext.z));
            sandstone.quad(vec(out.x,lowA,out.z),vec(out.x,bottomA,out.z),vec(outNext.x,lowB,outNext.z),vec(outNext.x,bottomB,outNext.z));
            cameraObstacles.push({kind:'source-following-retaining-face',min:[Math.min(out.x,outNext.x)-.03,Math.min(bottomA,bottomB),Math.min(out.z,outNext.z)-.03],
              max:[Math.max(out.x,outNext.x)+.03,Math.max(out.y,outNext.y),Math.max(out.z,outNext.z)+.03]});
          }
        }
        if(i%5===0){
          const end=Math.min(edge.length,s+6.1),endW=edge.halfWidthAt(end),p=point(edge,s,side*(w+.8),.45),q=point(edge,end,side*(endW+.8),.45),middle=p.clone().lerp(p,q,.5);
          if(roadIndex.clearAt(middle.x,middle.z,p.distance(q)/2+.30,other)){
            beam('roadside-timber-rail',greyWood,p.clone().add(vec(0,.65,0)),q.clone().add(vec(0,.65,0)),.24,.32);
            beam('roadside-timber-post',timber,p.clone().add(vec(0,-.4,0)),p.clone().add(vec(0,1.15,0)),.28);
            if(i%15===0)box('roadside-orange-reflector',orange,p.clone().add(vec(0,.78,0)),vec(.34,.20,.34),0,false);
          }
        }
      }
    }
  }
  for(let row=0;row<2;row++)for(let col=0;col<16;col++)if((row+col)%2===0){
    const e=course.commonStart,s=row*.75,t=(row+1)*.75,w=e.halfWidthAt(s);
    ivory.quad(point(e,s,-w+col*w/8,.026),point(e,s,-w+(col+1)*w/8,.026),point(e,t,-w+col*w/8,.026),point(e,t,-w+(col+1)*w/8,.026));
  }

  // Five asymmetric extraction benches establish an original stepped quarry
  // silhouette. Whole circumcircles are road-clear before any rock is emitted.
  const benchSites=[[-205,125,46,31],[-105,285,48,43],[70,-64,24,24],[325,55,53,49],[-85,-325,54,40]];
  const shape=[[-.92,-.50],[-.43,-.91],[.34,-.95],[.91,-.45],[.88,.37],[.28,.86],[-.42,.80],[-.97,.21]];
  for(let k=0;k<benchSites.length;k++){
    const [x,z,wanted,height]=benchSites[k],p=vec(x,0,z);let radius=wanted;
    while(radius>12&&!freeAt(p,radius+2))radius-=1;
    if(!freeAt(p,radius+2))continue;
    // Two outer extraction faces are long, one-sided cuts with deliberately
    // unequal terrace breaks; they are not copies of the rounded inner mesas.
    const cutShape=k===1?[[-.97,-.16],[-.78,-.34],[.73,-.29],[.99,-.08],[.86,.22],[.30,.32],[-.88,.23]]:
      k===3?[[-.98,-.10],[-.79,-.31],[.40,-.35],[.93,-.17],[.86,.19],[.23,.30],[-.86,.21]]:shape;
    const levels=k===1?[0,.18,.67,1]:k===3?[0,.12,.34,.76,1]:[0,.2,.4,.6,.8,1];
    const scales=k===1?[1,.91,.64]:k===3?[1,.86,.79,.58]:[1,.87,.74,.61,.48];
    const shiftsX=k===1?[0,.03,.17]:k===3?[0,-.03,-.12,-.19]:[-.025,.045,-.025,.045,-.025];
    const shiftsZ=k===1?[0,.04,.06]:k===3?[0,.05,.04,.02]:[0,-.012,-.024,-.036,-.048];
    const outer=cutShape.map(([a,b])=>vec(x+a*radius,0,z+b*radius)),{low,high}=terrainExtrema(outer),base=high+.08;
    // Wider lower benches have solid sides reaching below the entire floor.
    for(let level=0;level<scales.length;level++){
      const scale=scales[level],poly=cutShape.map(([a,b])=>vec(x+radius*(a*scale+shiftsX[level]),0,z+radius*(b*scale+shiftsZ[level])));
      const bottom=level===0?low-.5:base+levels[level]*height,top=base+levels[level+1]*height;
      const lower=level===0?bottom:bottom-.06,bandTop=lower+(top-lower)*.18;
      solid('extraction-bench-oxide-band',level%2?darkStrata:strata,poly,lower,bandTop);
      solid('extraction-bench-cut-face',level%2?pale:sandstone,poly,bandTop,top);
      // Thin vertical saw grooves are proud relief cut strips, spaced broadly.
      const a=poly[0],b=poly[1];for(let j=1;j<7;j++){
        const q=a.clone().lerp(a,b,j/7),r=a.clone().lerp(a,b,(j+.08)/7),out=vec(q.x-x,0,q.z-z).normalize().mulScalar(.015);
        darkStrata.quad(vec(q.x+out.x,bandTop+.1,q.z+out.z),vec(r.x+out.x,bandTop+.1,r.z+out.z),vec(q.x+out.x,top-.12,q.z+out.z),vec(r.x+out.x,top-.12,r.z+out.z));
      }
    }
    landmarks.push({kind:'extraction-bench',label:(k===1?'Elongated three-break north extraction wall ':k===3?'Asymmetric four-break east cut face ':'Five-tier saw-cut extraction bench ')+(k+1),position:[x,base,z]});
  }
  const placements=[
    {kind:'feed-hopper',edge:course.commonStart,s:321.4461564167139,x:188.0995803384252,z:-87.75281103797074,r:18,w:24,d:22,label:'Splayed timber feed hopper'},
    {kind:'stepped-cut-face',edge:course.commonStart,s:435.2916701476334,x:102.91507071370592,z:-15.850707587615346,r:23,w:39,d:22,label:'Three-step saw-cut sandstone face'},
    {kind:'timber-counterweight-derrick',edge:course.alternates.boulevard,s:220.84905826389885,x:98.76524974936851,z:291.26967331049923,r:12,w:18,d:15,label:'Asymmetric counterweight timber derrick'},
    {kind:'double-belt-transfer',edge:course.commonFinish,s:270.70994259589503,x:256.32258862137064,z:-178.82531193075766,r:23,w:22,d:39,label:'Off-road double conveyor transfer'},
    {kind:'stone-cassette-yard',edge:course.commonFinish,s:868.5277324951633,x:-312.46998125610196,z:-100.9797736321471,r:15,w:24,d:17,label:'Timber-sleepered stone cassette loading yard'},
    {kind:'strata-monolith',edge:course.commonFinish,s:992.6031228516151,x:-261.44546832025566,z:-181.6901210681967,r:18,w:25,d:24,label:'Three-fracture split-strata monolith'},
  ];
  for(const plot of placements){
    const p=vec(plot.x,0,plot.z),frame=plot.edge.sample(plot.s),yaw=frame.angle;
    // The design plots were sampled provisionally. Snap outward by at most
    // two metres only if the final rendered polygon union needs more margin.
    const outward=vec(p.x-frame.p.x,0,p.z-frame.p.z).normalize();
    for(let n=0;n<20&&!clearAt(p,plot.r,5);n++)p.add(outward.clone().mulScalar(.1));
    if(!clearAt(p,plot.r,5))throw new Error('Quarry landmark obstructs road: '+plot.kind);
    groundPad(plot.kind,p,yaw,plot.w,plot.d);const at=local(p,yaw),put=(kind:string,b:Batch,x:number,y:number,z:number,w:number,h:number,d:number)=>box(kind,b,at(x,y,z),vec(w,h,d),yaw);
    const strut=(kind:string,b:Batch,a:number[],c:number[],w:number,d=w)=>beam(kind,b,at(...a as [number,number,number]),at(...c as [number,number,number]),w,d);
    if(plot.kind==='feed-hopper'){
      for(const x of [-8,8])for(const z of [-6,6]){
        put('hopper-stone-shoe',footing,x,.45,z,2.5,.9,2.5);
        strut('hopper-splayed-leg',timber,[x,.9,z],[x*.78,12,z*.78],.9);
        put('hopper-leg-iron-saddle',iron,x,1,z,1.02,.20,1.02);
      }
      for(const z of [-4.6,4.6])strut('hopper-cross-brace',sunWood,[-6.3,3,z],[6.3,10.8,z],.37);
      for(const x of [-6.3,6.3])strut('hopper-side-brace',sunWood,[x,3,-4.6],[x,10.8,4.6],.37);
      // Open stone-lined tapered bin, with an actual dark throat at its bottom.
      const top=[at(-8,15,-5.8),at(8,15,-5.8),at(8,15,5.8),at(-8,15,5.8)],bottom=[at(-2.3,7,-1.8),at(2.3,7,-1.8),at(2.3,7,1.8),at(-2.3,7,1.8)];
      for(let i=0;i<4;i++){
        const j=(i+1)%4,wallStart=sunWood.positions.length;sunWood.quad(bottom[i],bottom[j],top[i],top[j]);bound('hopper-tapered-bin-wall',sunWood,wallStart);
        beam('hopper-rim-beam',timber,top[i],top[j],.65,.8);
        for(let row=1;row<=4;row++){const t=row/5;beam('hopper-bin-band',iron,bottom[i].clone().lerp(bottom[i],top[i],t),bottom[j].clone().lerp(bottom[j],top[j],t),.14,.22);}
      }
      put('hopper-throat',belt,0,6.8,0,4.6,.4,3.6);put('hopper-discharge-chute',rust,0,5.65,2,4.1,.45,5.2);
      for(let i=0;i<14;i++){const x=(i%5-2)*2.4,z=(Math.floor(i/5)-1)*2.3;put('hopper-stone-load',i%3?pale:sandstone,x,13.7+noise(i)*.45,z,1.8,.8,1.7);}
      for(let i=0;i<15;i++)put('hopper-service-ladder',iron,9.6,i*.82+.5,0,.2,.16,1.4);
      strut('hopper-ladder-rail',iron,[9.6,0,-.8],[9.6,12.2,-.8],.13);strut('hopper-ladder-rail',iron,[9.6,0,.8],[9.6,12.2,.8],.13);
    }else if(plot.kind==='stepped-cut-face'){
      const heights=[8.4,16.2,24],widths=[37,29,19],depths=[20,13,7];
      for(let step=0;step<3;step++){
        const w=widths[step],d=depths[step],h=heights[step],bottom=step?heights[step-1]:0,x=step*1.2-1.2,z=step*2.1-1;
        const poly=[[-w/2,-d/2],[w/2,-d/2],[w/2+.4,d/2-.8],[w/2-1,d/2],[-w/2+.5,d/2]].map(([a,b])=>at(x+a,0,z+b));
        solid('sawn-face-red-band',strata,poly,p.y+bottom,p.y+bottom+1.1);
        solid('sawn-face-amber-block',sandstone,poly,p.y+bottom+1.1,p.y+h);
        for(let j=0;j<Math.floor(w/1.25);j++)put('sawn-face-cut-groove',darkStrata,x-w/2+.7+j*1.25,bottom+(h-bottom)/2,z-d/2-.024,.07,h-bottom-.3,.03);
      }
      for(let i=0;i<7;i++)put('sawn-face-separated-offcut',i%2?pale:dust,-16+i*4.6,.45,-9.8,2.9,.9,1.1);
    }else if(plot.kind==='timber-counterweight-derrick'){
      for(const x of [-6.6,6.6])for(const z of [-4.2,4.2]){
        const h=x<0?20:23;put('derrick-stone-shoe',footing,x,.55,z,2.2,1.1,2.2);
        strut('derrick-upright',timber,[x,1.1,z],[x,h,z],.8);
        strut('derrick-open-diagonal',sunWood,[x,2,-4.2],[x,h-1,4.2],.42);
        put('derrick-base-bracket',iron,x,1.4,z,.98,.7,.98);
      }
      for(const z of [-4.2,4.2])strut('derrick-unequal-crossbeam',timber,[-7.4,20,z],[7.4,23,z],1.05);
      strut('derrick-crown-spreader',timber,[5.5,22.7,-5.8],[5.5,22.7,5.8],.9);
      // Rigging beams meet both sloping main frame beams at their exact local
      // heights. Hoist and counterweight lines attach to their undersides.
      strut('derrick-hoist-suspension-beam',timber,[-3.8,20.7297297297,-4.2],[-3.8,20.7297297297,4.2],.75);
      strut('derrick-counterweight-suspension-beam',timber,[4.5,22.4121621622,-4.2],[4.5,22.4121621622,4.2],.75);
      strut('derrick-hook-spreader',iron,[-3.8,8.35,-3],[-3.8,8.35,3],.35);
      strut('derrick-hook-hanger',iron,[-3.8,8,0],[-3.8,8.35,0],.18);
      for(const z of [-2.7,2.7]){
        strut('derrick-static-hoist-line',iron,[-3.8,8.35,z],[-3.8,20.4,z],.08);
        strut('derrick-counterweight-chain',iron,[4.5,15.5,z],[4.5,22.1,z],.10);
      }
      put('derrick-suspended-counterweight',darkStrata,4.5,13.1,0,4.6,4.8,6);
      for(const y of [11.6,14.6])put('derrick-counterweight-band',iron,4.5,y,0,4.7,.18,6.1);
      put('derrick-hook-block',rust,-3.8,7.4,0,1.6,1.2,1.3);
      put('derrick-winch-block',iron,0,1.1,3,3.4,2.2,2.3);
      for(const x of [-2,2]){
        const start=rust.positions.length,indexStart=rust.indices.length;cylinder(rust,at(x,.6,3),.9,1.5,12);
        // Outward upper caps on the vertical winch drums. Leave the shared
        // legacy primitive untouched so the existing maps keep exact output.
        for(let i=0;i<12;i++){const j=indexStart+i*9+7;[rust.indices[j],rust.indices[j+1]]=[rust.indices[j+1],rust.indices[j]];}
        bound('derrick-winch-drum',rust,start);
      }
      for(let i=0;i<4;i++)put('derrick-yard-cut-block',pale,-5+i*2.9,.6,-5.8,2,1.2,1.4);
    }else if(plot.kind==='double-belt-transfer'){
      for(const beltNo of [0,1]){
        const x=beltNo?4.6:-4.6,z0=beltNo?-14:-16,z1=beltNo?15:12,y0=beltNo?5.8:2.1,y1=beltNo?16.6:12.3;
        strut('conveyor-belt',belt,[x,y0,z0],[x,y1,z1],3.3,.20);
        for(const side of [-1,1])strut('conveyor-side-girder',iron,[x+side*1.93,y0-.5,z0],[x+side*1.93,y1-.5,z1],.28,.56);
        for(let i=0;i<=14;i++){
          const t=i/14,y=y0+(y1-y0)*t,z=z0+(z1-z0)*t;
          strut('conveyor-roller',rust,[x-1.72,y-.27,z],[x+1.72,y-.27,z],.25,.25);
          if(i%4===0){
            for(const side of [-1,1]){put('conveyor-foot-shoe',footing,x+side*2.2,.3,z,1.5,.6,1.5);strut('conveyor-trestle-leg',timber,[x+side*2.2,.6,z],[x+side*1.9,y-.45,z],.43);}
            strut('conveyor-open-cross-brace',sunWood,[x-2.1,.8,z],[x+1.9,y-.7,z],.24);
          }
          if(i%2===1)put('conveyor-stone-load',i%3?pale:sandstone,x,y+.4,z,1.4,.65,1.3);
        }
        for(const t of [0,1]){const y=y0+(y1-y0)*t,z=z0+(z1-z0)*t;strut('conveyor-end-roller',iron,[x-2.1,y-.22,z],[x+2.1,y-.22,z],.65,.65);}
      }
      put('conveyor-transfer-housing',orange,0,13.4,12.5,5.5,2.2,3.8);
      strut('conveyor-transfer-chute',rust,[-4.6,13.7,12],[4.6,11.4,9],2.5,.36);
      put('conveyor-switch-cabinet',iron,8,.95,-14,1.3,1.9,1.1);
    }else if(plot.kind==='stone-cassette-yard'){
      for(let row=0;row<3;row++)for(let col=0;col<4;col++){
        const x=-8.2+col*5.4,z=-5.2+row*5.1,h=1.4+((row+col)%3)*.65;
        for(const side of [-1,1])put('cassette-yard-sleeper',greyWood,x+side*1.25,.28,z,.5,.56,3.8);
        for(let layer=0;layer<2+(col%2);layer++){
          put('cassette-yard-stone-slab',layer%2?sandstone:pale,x,.56+layer*h+(h-.07)/2,z,3.8,h-.07,3.15);
          for(const side of [-1,1])put('cassette-yard-slab-spacer',sunWood,x+side*1.15,.56+(layer+1)*h-.035,z,.33,.07,3.2);
        }
        for(const side of [-1,1])put('cassette-yard-iron-retainer',iron,x+side*2.1,1.5,z,.13,3,.16);
      }
      put('cassette-yard-crate',sunWood,9.3,1.1,6,3.1,2.2,2.4);
      for(const x of [8.3,10.3])put('cassette-yard-crate-strap',iron,x,1.11,6,.13,2.25,2.45);
    }else{
      // Three separated off-axis fracture columns, each with five uneven bands.
      const columns=[{x:-7,z:0,w:7.6,d:14,h:27,yaw:-.08},{x:2,z:2,w:8,d:17,h:30,yaw:.07},{x:8,z:-2,w:4.6,d:12,h:23,yaw:-.12}],levels=[0,.16,.36,.49,.76,1];
      for(let c=0;c<columns.length;c++){
        const q=columns[c],where=at(q.x,0,q.z),turn=local(where,yaw+q.yaw);
        for(let layer=0;layer<5;layer++){
          const scale=1-layer*.016,poly=[[-.48,-.5],[.37,-.48],[.51,-.20],[.43,.48],[-.4,.49],[-.53,.11]].map(([x,z])=>turn(x*q.w*scale,0,z*q.d*scale));
          const low=p.y+q.h*levels[layer],high=p.y+q.h*levels[layer+1];
          solid('monolith-distinct-strata-band',[sandstone,strata,pale,darkStrata,sandstone][layer],poly,low,high);
        }
      }
      for(let i=0;i<8;i++)put('monolith-fractured-base-chip',i%2?dust:strata,-9+i*2.6,.4,-10.6+noise(i+31)*2,1.9,.8,1.3);
    }
    record(plot.kind,p,plot.r,plot.label);
  }

  // The one named crossing is a true timber trestle, never a terrain bridge.
  // Shallow upper chords remain inside the reserved 2.4 m structural envelope.
  const upper=course.commonFinish,spanFrom=500,spanTo=610;
  let clearance=Infinity;
  for(const a of support.filter(q=>q.edge===upper&&q.s>=spanFrom&&q.s<=spanTo))for(const b of support){
    if(b.edge===upper||a.low-b.high<15||Math.hypot(a.p.x-b.p.x,a.p.z-b.p.z)>a.half+b.half+2)continue;
    clearance=Math.min(clearance,a.low-2.4-b.high);
  }
  structures.push({kind:'viaduct',from:spanFrom,to:spanTo,overheadClearance:clearance});
  for(let s=spanFrom;s<spanTo;s+=2){
    const t=Math.min(spanTo,s+2),w=upper.halfWidthAt(s),wt=upper.halfWidthAt(t);
    for(const side of [-1,1]){
      const a=point(upper,s,side*(w-.6),-1.4),b=point(upper,t,side*(wt-.6),-1.4),v=beam('trestle-shallow-chord',timber,a,b,.75,.80);
      trestleMembers.push({kind:'shallow-chord',points:v.map(tuple),minimumRoadClearance:clearance});
      beam('trestle-edge-stringer',sunWood,point(upper,s,side*(w+.55),-.38),point(upper,t,side*(wt+.55),-.38),.45,.55);
    }
    if((s-spanFrom)%4===0){
      const v=beam('trestle-cross-sleeper',greyWood,point(upper,s,-w-1,-.88),point(upper,s,w+1,-.88),.52,.5);
      trestleMembers.push({kind:'cross-sleeper',points:v.map(tuple),minimumRoadClearance:clearance});
    }
    const vertices=[point(upper,s,-w,-.6),point(upper,s,w,-.6),point(upper,t,-wt),point(upper,t,wt)];
    cameraObstacles.push({kind:'trestle-deck-segment',min:[Math.min(...vertices.map(p=>p.x)),Math.min(...vertices.map(p=>p.y)),Math.min(...vertices.map(p=>p.z))],max:[Math.max(...vertices.map(p=>p.x)),Math.max(...vertices.map(p=>p.y)),Math.max(...vertices.map(p=>p.z))]});
  }
  // The bents are outside all roads, with the full lower corridor plus 5 m
  // kept clear. Each post/shoe/brace has its own tight camera obstruction.
  for(const s of [502,519,586,608])for(const side of [-1,1]){
    const w=upper.halfWidthAt(s),p=point(upper,s,side*(w+8)),deckY=p.y,yaw=upper.sample(s).angle;
    if(!freeAt(p,2.5))continue;
    groundPad('trestle-grounded-bent',p,yaw,3.3,3.3);const top=deckY-1.75;
    box('trestle-stone-shoe',footing,p.clone().add(vec(0,.48,0)),vec(2.1,.96,2.1),yaw);
    const v=beam('trestle-timber-post',timber,p.clone().add(vec(0,.96,0)),vec(p.x,top,p.z),1.05);
    trestleMembers.push({kind:'outside-corridor-post',points:v.map(tuple),minimumRoadClearance:5});
    const inner=point(upper,s,side*(w-.9),-1.5),outer=vec(p.x,top,p.z),middle=inner.clone().lerp(inner,outer,.5);
    const lower=(f:typeof sourceFaces[number])=>f.maxY<deckY-5;
    if(roadIndex.clearAt(middle.x,middle.z,inner.distance(outer)/2+5.5,lower)){
      const arm=beam('trestle-bent-crosshead',timber,outer,inner,.9,.95);trestleMembers.push({kind:'outside-corridor-crosshead',points:arm.map(tuple),minimumRoadClearance:5});
      const a=vec(p.x,Math.max(p.y+2,top-7),p.z),b=inner.clone().lerp(inner,outer,.22),brace=beam('trestle-open-knee-brace',sunWood,a,b,.5,.55);
      trestleMembers.push({kind:'outside-corridor-brace',points:brace.map(tuple),minimumRoadClearance:5});
    }
    box('trestle-post-iron-strap',iron,vec(p.x,top-.3,p.z),vec(1.12,.24,1.12),yaw);record('trestle-grounded-bent',p,2.5);
  }
  landmarks.push({kind:'dry-cut-trestle',label:'Dry-Cut Trestle: open working-floor road below timber span',position:tuple(upper.sample(550.2825243569553).p)});

  // Loading-area detail is grouped in small working sets rather than scattered
  // noise: separated stone blocks, visible sleepers, open crib bins and spoil.
  const findPlot=(edge:SceneryRoadEdge,s:number,r:number,side:number)=>{
    for(const extra of [0,4,9,15]){
      const p=point(edge,s,side*(edge.halfWidthAt(s)+r+7+extra));if(freeAt(p,r))return p;
    }return null;
  };
  for(let i=0;i<28;i++){
    const edge=i<14?course.commonStart:course.commonFinish,s=i<14?45+i*34:710+(i-14)*27;if(s>edge.length-30)continue;
    const p=findPlot(edge,s,4.5,i%2?1:-1);if(!p)continue;
    const yaw=edge.sample(s).angle;groundPad('roadside-stone-workset',p,yaw,6.8,5.4);const at=local(p,yaw);
    for(const x of [-2.3,2.3])box('workset-timber-sleeper',greyWood,at(x,.24,0),vec(.65,.48,4.6),yaw);
    for(let j=0;j<3;j++){
      const h=1.4+((i+j)%3)*.4;box('workset-cut-stone',j%2?sandstone:pale,at(-2.1+j*2.1,.48+h/2,0),vec(1.75,h,3.5),yaw);
      box('workset-iron-lifting-cleat',rust,at(-2.1+j*2.1,h+.55,0),vec(.4,.14,.25),yaw,false);
    }
    if(i%3===0){
      for(const z of [-2.1,2.1])for(let row=0;row<3;row++)box('workset-crib-board',sunWood,at(0,.35+row*.36,z),vec(6.2,.25,.2),yaw);
      for(const x of [-3,3])box('workset-crib-stake',timber,at(x,.7,0),vec(.24,1.4,4.5),yaw);
    }
    record('roadside-stone-workset',p,4.5);
  }
  for(const edge of edges)for(let i=0,s=35;s<edge.length-25;s+=74,i++){
    const r=1.9,p=findPlot(edge,s,r,i%2?1:-1);if(!p)continue;const yaw=edge.sample(s).angle;
    groundPad('haul-distance-board',p,yaw,2.8,2.1);const at=local(p,yaw);
    box('distance-board-timber-post',timber,at(0,1.4,0),vec(.24,2.8,.24),yaw);
    box('distance-board-ochre-face',ochre,at(0,2.45,0),vec(2.2,.95,.14),yaw);
    // Simple count bars and diagonal panel, legible from either direction.
    for(const z of [-.086,.086])for(let j=0;j<(i%4)+1;j++)box('distance-board-raised-bar',ivory,at(-.7+j*.43,2.45,z),vec(.16,.56,.018),yaw,false);
    box('distance-board-orange-foot',orange,at(0,.12,0),vec(.7,.24,.7),yaw,false);record('haul-distance-board',p,r);
  }
  for(const side of [-1,1]){
    const e=course.commonStart,s=e.length-68,p=findPlot(e,s,3.3,side);if(!p)continue;const yaw=e.sample(s).angle;
    groundPad('quarry-fork-wayfinding',p,yaw,5.7,1.5);const at=local(p,yaw);
    for(const x of [-2.2,2.2])box('fork-sign-timber-post',timber,at(x,2.2,0),vec(.28,4.4,.28),yaw);
    box('fork-sign-ochre-board',ochre,at(0,4,0),vec(5.3,1.8,.20),yaw);
    for(const z of [-.12,.12]){
      ivory.quad(at(-1.2,3.87,z),at(1.2,3.87,z),at(-1.2,4.13,z),at(1.2,4.13,z));
      ivory.tri(at(side*2.05,4,z),at(side*.8,4.59,z),at(side*.8,3.41,z));
      for(let j=0;j<(side>0?2:4);j++)box('fork-sign-route-width-mark',orange,at(-1.9+j*.35,3.45,z),vec(.22,.16,.025),yaw,false);
    }
    record('quarry-fork-wayfinding',p,3.3,side>0?'Carved Shelf: narrow, shorter S route':'Haul Road: broad outer working ramp');
  }
  // Faceted spoil patches are below wheel level, outside every road and every
  // landmark. Their polygons are connected to the rendered terrain itself.
  for(let i=0;i<58;i++){
    const edge=edges[i%4],s=(.07+(i%15)/17)*edge.length,p=findPlot(edge,s,2.3,i%2?1:-1);if(!p)continue;
    const radius=1.7+(i%3)*.15,center=vec(p.x,terrainMeshY(p.x,p.z)+.18,p.z);
    for(let j=0;j<6;j++){
      const a=j/6*Math.PI*2,b=(j+1)/6*Math.PI*2,pa=vec(p.x+Math.cos(a)*radius,0,p.z+Math.sin(a)*radius),pb=vec(p.x+Math.cos(b)*radius,0,p.z+Math.sin(b)*radius);
      pa.y=terrainMeshY(pa.x,pa.z)+.025;pb.y=terrainMeshY(pb.x,pb.z)+.025;(j%2?dust:shadowDust).tri(pa,center,pb);
    }
  }
  const used=batches.filter(b=>b.indices.length),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const b of used)for(let i=0;i<b.positions.length;i++){const j=i%3;min[j]=Math.min(min[j],b.positions[i]);max[j]=Math.max(max[j],b.positions[i]);}
  return {version:1,trackId:course.id,batches:used,roadSamples,routeRoadSamples,props,structures,roadFaces,roadUndersideFaces,foundations,cameraObstacles,landmarks,trestleMembers,
    terrainGrid:{minX,minZ,dx,dz,columns:nx+1,rows:nz+1},bounds:{min,max}};
}
