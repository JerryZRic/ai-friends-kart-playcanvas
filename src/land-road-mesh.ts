import * as pc from 'playcanvas';
import type {LandSample} from './land-track';

/** Renderer-only structural road contract; cursor/ranking state stays elsewhere. */
export interface SceneryRoadEdge {
  readonly id:string; readonly length:number;
  sample(s:number,lateral?:number):LandSample;
  halfWidthAt(s:number):number;
}
export interface SceneryForkCourse {
  readonly id:string; readonly commonStart:SceneryRoadEdge;
  readonly alternates:Readonly<{alley:SceneryRoadEdge;boulevard:SceneryRoadEdge}>;
  readonly commonFinish:SceneryRoadEdge;
}
export interface RoadFootprint {
  edge:SceneryRoadEdge; distance:number; points:pc.Vec3[];
  minX:number;maxX:number;minZ:number;maxZ:number;minY:number;maxY:number;
}
export const footprintArea=(poly:readonly pc.Vec3[])=>Math.abs(poly.reduce((n,p,i)=>{
  const q=poly[(i+1)%poly.length];return n+p.x*q.z-q.x*p.z;
},0))/2;
const cross=(a:pc.Vec3,b:pc.Vec3,p:pc.Vec3)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);

/** Exact convex XZ difference, retaining linearly interpolated SOURCE Y.
 * Coplanar ownership is spatial, never a fixed distance from a fork/merge. */
export function subtractRoadFootprint(subject:pc.Vec3[],cutter:readonly pc.Vec3[]):pc.Vec3[][] {
  const orientation=Math.sign(cross(cutter[0],cutter[1],cutter[2]))||1;
  const clip=(poly:pc.Vec3[],a:pc.Vec3,b:pc.Vec3,inside:boolean)=>{
    const out:pc.Vec3[]=[];
    for(let i=0;i<poly.length;i++){
      const p=poly[i],q=poly[(i+1)%poly.length],dp=cross(a,b,p)*orientation,dq=cross(a,b,q)*orientation;
      const ip=inside?dp>=0:dp<=0,iq=inside?dq>=0:dq<=0;
      if(ip)out.push(p);if(ip!==iq)out.push(p.clone().lerp(p,q,dp/(dp-dq)));
    }return out;
  };
  const result:pc.Vec3[][]=[];let remaining=subject;
  for(let i=0;i<cutter.length&&remaining.length>=3;i++){
    const a=cutter[i],b=cutter[(i+1)%cutter.length],outside=clip(remaining,a,b,false);
    if(outside.length>=3&&footprintArea(outside)>1e-8)result.push(outside);
    remaining=clip(remaining,a,b,true);
  }return result;
}
export function roadFootprint(edge:SceneryRoadEdge,distance:number,points:pc.Vec3[]):RoadFootprint {
  return {edge,distance,points,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),
    minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
}
export function sampleRoadFootprints(edges:readonly SceneryRoadEdge[],spacing=1.65):RoadFootprint[] {
  return edges.flatMap(edge=>Array.from({length:Math.ceil(edge.length/spacing)},(_,i)=>{
    const n=Math.ceil(edge.length/spacing),s=i/n*edge.length,t=(i+1)/n*edge.length,w=edge.halfWidthAt(s),v=edge.halfWidthAt(t);
    const a=edge.sample(s,-w).p,b=edge.sample(s,w).p,c=edge.sample(t,-v).p,d=edge.sample(t,v).p;
    return [roadFootprint(edge,s,[a,c,b]),roadFootprint(edge,s,[b,c,d])];
  }).flat());
}
/** Small immutable spatial index over source triangles. It includes both branches. */
export class RoadFootprintIndex {
  private cells=new Map<string,RoadFootprint[]>();
  constructor(readonly faces:readonly RoadFootprint[],private cellSize=24){
    for(const f of faces)for(let x=Math.floor(f.minX/cellSize);x<=Math.floor(f.maxX/cellSize);x++)for(let z=Math.floor(f.minZ/cellSize);z<=Math.floor(f.maxZ/cellSize);z++){
      const key=x+','+z,list=this.cells.get(key)??[];list.push(f);this.cells.set(key,list);
    }
  }
  query(minX:number,maxX:number,minZ:number,maxZ:number):RoadFootprint[]{
    const found=new Set<RoadFootprint>();
    for(let x=Math.floor(minX/this.cellSize);x<=Math.floor(maxX/this.cellSize);x++)for(let z=Math.floor(minZ/this.cellSize);z<=Math.floor(maxZ/this.cellSize);z++){
      for(const f of this.cells.get(x+','+z)??[])if(f.maxX>=minX&&f.minX<=maxX&&f.maxZ>=minZ&&f.minZ<=maxZ)found.add(f);
    }return [...found];
  }
  /** Exact distance to full source triangle union (zero anywhere on a road). */
  clearAt(x:number,z:number,radius=0,predicate:(f:RoadFootprint)=>boolean=()=>true):boolean {
    const p=new pc.Vec3(x,0,z),r=Math.max(radius,1e-7);
    return this.query(x-r,x+r,z-r,z+r).filter(predicate).every(f=>{
      const signs=f.points.map((a,i)=>cross(a,f.points[(i+1)%f.points.length],p));
      if(signs.every(n=>n>=-1e-9)||signs.every(n=>n<=1e-9))return false;
      return f.points.every((a,i)=>{const b=f.points[(i+1)%f.points.length],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
        return Math.hypot(x-a.x-t*dx,z-a.z-t*dz)>r;});
    });
  }
}

/** Convex intersection with source interpolation, useful for exact grounding. */
export function intersectRoadFootprint(subject:pc.Vec3[],cutter:readonly pc.Vec3[]):pc.Vec3[] {
  const orientation=Math.sign(cross(cutter[0],cutter[1],cutter[2]))||1;let poly=subject;
  for(let i=0;i<cutter.length&&poly.length;i++){
    const a=cutter[i],b=cutter[(i+1)%cutter.length],out:pc.Vec3[]=[];
    for(let j=0;j<poly.length;j++){
      const p=poly[j],q=poly[(j+1)%poly.length],dp=cross(a,b,p)*orientation,dq=cross(a,b,q)*orientation;
      if(dp>=0)out.push(p);if((dp>=0)!==(dq>=0))out.push(p.clone().lerp(p,q,dp/(dp-dq)));
    }poly=out;
  }return poly;
}
