/** Independent emitted-triangle math. Input is rendered indexed geometry only.
 * Never import source camera, terrain, component bounds or scene acceptance helpers. */
import type {CameraPoint} from '../../src/land-camera';
export type V=readonly number[];
export type Triangle={indexStart?:number;id:number;batch:string;vertices:readonly number[];a:V;b:V;c:V;min:V;max:V};
export const tuple=(p:CameraPoint):V=>[p.x,p.y,p.z];
export const lerp=(a:V,b:V,t:number):V=>a.map((n,i)=>n+(b[i]-n)*t);
export const cross2=(a:V,b:V,p:V)=>(b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]);
export const area=(p:V[])=>Math.abs(p.reduce((v,a,i)=>{const b=p[(i+1)%p.length];return v+a[0]*b[2]-a[2]*b[0];},0))/2;
export const height=(t:Triangle,x:number,z:number)=>{
  const {a,b,c}=t,den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
  const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den;
  const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
  return u*a[1]+v*b[1]+(1-u-v)*c[1];
};
export function clipPolygon(subject:V[],triangle:Triangle):V[]{
  let p=subject;const c=[triangle.a,triangle.b,triangle.c],sign=Math.sign(cross2(c[0],c[1],c[2]));
  for(let i=0;i<3&&p.length;i++){
    const a=c[i],b=c[(i+1)%3],out:V[]=[];
    for(let j=0;j<p.length;j++){
      const q=p[j],r=p[(j+1)%p.length],dq=cross2(a,b,q)*sign,dr=cross2(a,b,r)*sign;
      if(dq>=0)out.push(q);if((dq>=0)!==(dr>=0))out.push(lerp(q,r,dq/(dq-dr)));
    }p=out;
  }return p;
}
// Exact projected interval, so thin source-terrain peaks cannot slip between
// arbitrary boom sample points. Heights are linear across each source triangle.
export function projectedInterval(t:Triangle,a:V,b:V):[number,number]|null{
  const p=[t.a,t.b,t.c],sign=Math.sign(cross2(p[0],p[1],p[2]));if(!sign)return null;
  let lo=0,hi=1;
  for(let i=0;i<3;i++){
    const q=p[i],r=p[(i+1)%3],da=cross2(q,r,a)*sign,db=cross2(q,r,b)*sign,delta=db-da;
    if(Math.abs(delta)<1e-12){if(da< -1e-8)return null;continue;}
    const at=-da/delta;if(delta>0)lo=Math.max(lo,at);else hi=Math.min(hi,at);
    if(lo>hi+1e-10)return null;
  }return [Math.max(0,lo),Math.min(1,hi)];
}
export function hitFraction(t:Triangle,o:V,end:V):number|null{
  const dx=end[0]-o[0],dy=end[1]-o[1],dz=end[2]-o[2];
  const ex=t.b[0]-t.a[0],ey=t.b[1]-t.a[1],ez=t.b[2]-t.a[2],fx=t.c[0]-t.a[0],fy=t.c[1]-t.a[1],fz=t.c[2]-t.a[2];
  const hx=dy*fz-dz*fy,hy=dz*fx-dx*fz,hz=dx*fy-dy*fx,det=ex*hx+ey*hy+ez*hz;if(Math.abs(det)<1e-10)return null;
  const sx=o[0]-t.a[0],sy=o[1]-t.a[1],sz=o[2]-t.a[2],u=(sx*hx+sy*hy+sz*hz)/det;if(u< -1e-9||u>1+1e-9)return null;
  const qx=sy*ez-sz*ey,qy=sz*ex-sx*ez,qz=sx*ey-sy*ex,v=(dx*qx+dy*qy+dz*qz)/det;if(v< -1e-9||u+v>1+1e-9)return null;
  const d=(fx*qx+fy*qy+fz*qz)/det;return d>1e-7&&d<1+1e-7?d:null;
}
export class MeshOracle {
  triangles:Triangle[]=[];private cells=new Map<string,Triangle[]>();private seen:Uint32Array;private stamp=0;
  constructor(batches:readonly {name:string;positions:readonly number[];indices:readonly number[]}[]){
    for(const batch of batches)for(let i=0;i<batch.indices.length;i+=3){
      const [a,b,c]=batch.indices.slice(i,i+3).map(v=>batch.positions.slice(v*3,v*3+3));
      const t:Triangle={indexStart:i,id:this.triangles.length,batch:batch.name,vertices:batch.indices.slice(i,i+3),a,b,c,min:[0,1,2].map(k=>Math.min(a[k],b[k],c[k])),max:[0,1,2].map(k=>Math.max(a[k],b[k],c[k]))};
      this.triangles.push(t);
      for(let x=Math.floor(t.min[0]/16);x<=Math.floor(t.max[0]/16);x++)for(let z=Math.floor(t.min[2]/16);z<=Math.floor(t.max[2]/16);z++){
        const key=x+','+z,list=this.cells.get(key)??[];list.push(t);this.cells.set(key,list);
      }
    }this.seen=new Uint32Array(this.triangles.length);
  }
  query(a:V,b:V,margin=0){
    const min=a.map((v,i)=>Math.min(v,b[i])-margin),max=a.map((v,i)=>Math.max(v,b[i])+margin),found:Triangle[]=[];this.stamp++;
    for(let x=Math.floor(min[0]/16);x<=Math.floor(max[0]/16);x++)for(let z=Math.floor(min[2]/16);z<=Math.floor(max[2]/16);z++)for(const t of this.cells.get(x+','+z)??[]){
      if(this.seen[t.id]===this.stamp)continue;this.seen[t.id]=this.stamp;
      if(t.min[0]<=max[0]&&t.max[0]>=min[0]&&t.min[2]<=max[2]&&t.max[2]>=min[2])found.push(t);
    }return found;
  }
  firstHit(a:V,b:V){
    let result:{triangle:Triangle;fraction:number}|null=null;
    for(const t of this.query(a,b)){
      if(t.min[1]>Math.max(a[1],b[1])||t.max[1]<Math.min(a[1],b[1]))continue;
      const fraction=hitFraction(t,a,b);if(fraction!==null&&(!result||fraction<result.fraction))result={triangle:t,fraction};
    }return result;
  }
}
export const sub=(a:V,b:V):V=>a.map((n,i)=>n-b[i]);
export const dot=(a:V,b:V)=>a.reduce((n,v,i)=>n+v*b[i],0);
export const lengthSquared=(a:V)=>dot(a,a);
export function pointTriangleDistanceSquared(p:V,t:Triangle){
  const normalA=sub(t.b,t.a),normalB=sub(t.c,t.a),normal=[normalA[1]*normalB[2]-normalA[2]*normalB[1],normalA[2]*normalB[0]-normalA[0]*normalB[2],normalA[0]*normalB[1]-normalA[1]*normalB[0]];
  if(dot(normal,normal)<1e-20)return Math.min(segmentDistanceSquared(p,p,t.a,t.b),segmentDistanceSquared(p,p,t.b,t.c),segmentDistanceSquared(p,p,t.c,t.a));
  const ab=sub(t.b,t.a),ac=sub(t.c,t.a),ap=sub(p,t.a),d1=dot(ab,ap),d2=dot(ac,ap);
  if(d1<=0&&d2<=0)return lengthSquared(ap);
  const bp=sub(p,t.b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return lengthSquared(bp);
  const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0)return lengthSquared(sub(p,lerp(t.a,t.b,d1/(d1-d3))));
  const cp=sub(p,t.c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return lengthSquared(cp);
  const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0)return lengthSquared(sub(p,lerp(t.a,t.c,d2/(d2-d6))));
  const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0)return lengthSquared(sub(p,lerp(t.b,t.c,(d4-d3)/(d4-d3+d5-d6))));
  const den=1/(va+vb+vc),v=vb*den,w=vc*den;
  return lengthSquared(sub(p,t.a.map((n,i)=>n+ab[i]*v+ac[i]*w)));
}
export function segmentDistanceSquared(p:V,q:V,a:V,b:V){
  const d=sub(q,p),e=sub(b,a),r=sub(p,a),dd=dot(d,d),ee=dot(e,e),de=dot(d,e),dr=dot(d,r),er=dot(e,r),clamp=(v:number)=>Math.max(0,Math.min(1,v));
  let s=dd*ee-de*de>1e-12?clamp((de*er-dr*ee)/(dd*ee-de*de)):0,t=ee>1e-12?(de*s+er)/ee:0;
  if(t<0){t=0;s=dd>1e-12?clamp(-dr/dd):0;}else if(t>1){t=1;s=dd>1e-12?clamp((de-dr)/dd):0;}
  return lengthSquared(sub(lerp(p,q,s),lerp(a,b,t)));
}
export function segmentTriangleDistance(a:V,b:V,t:Triangle){
  if(hitFraction(t,a,b)!==null)return 0;
  return Math.sqrt(Math.min(pointTriangleDistanceSquared(a,t),pointTriangleDistanceSquared(b,t),segmentDistanceSquared(a,b,t.a,t.b),segmentDistanceSquared(a,b,t.b,t.c),segmentDistanceSquared(a,b,t.c,t.a)));
}

// Three-dimensional clipping catches upright piers/walls too. Projected-area
// overlap alone silently discards exactly vertical triangles.
export function clipPlane(subject:V[],signed:(p:V)=>number):V[]{
  const out:V[]=[];
  for(let i=0;i<subject.length;i++){
    const a=subject[i],b=subject[(i+1)%subject.length],da=signed(a),db=signed(b);
    if(da>=0)out.push(a);
    if((da>=0)!==(db>=0))out.push(lerp(a,b,da/(da-db)));
  }return out;
}
export function area3D(points:V[]){
  let total=0;
  for(let i=2;i<points.length;i++){
    const a=sub(points[i-1],points[0]),b=sub(points[i],points[0]);
    total+=Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])/2;
  }return total;
}
export function prismIntersection(triangle:Triangle,road:Triangle,bottom:number,top:number){
  let polygon=[triangle.a,triangle.b,triangle.c];
  const p=[road.a,road.b,road.c],sign=Math.sign(cross2(p[0],p[1],p[2]));
  for(let i=0;i<3&&polygon.length;i++)polygon=clipPlane(polygon,q=>sign*cross2(p[i],p[(i+1)%3],q));
  if(polygon.length)polygon=clipPlane(polygon,q=>q[1]-height(road,q[0],q[2])-bottom);
  if(polygon.length)polygon=clipPlane(polygon,q=>height(road,q[0],q[2])+top-q[1]);
  return polygon;
}

export function hullXZ(input:V[]):V[]{
  const points=[...new Map(input.map(p=>[p[0]+','+p[2],p])).values()].sort((a,b)=>a[0]-b[0]||a[2]-b[2]);
  if(points.length<3)return points;const lower:V[]=[],upper:V[]=[];
  for(const p of points){while(lower.length>=2&&cross2(lower.at(-2)!,lower.at(-1)!,p)<=1e-9)lower.pop();lower.push(p);}
  for(const p of [...points].reverse()){while(upper.length>=2&&cross2(upper.at(-2)!,upper.at(-1)!,p)<=1e-9)upper.pop();upper.push(p);}
  return [...lower.slice(0,-1),...upper.slice(0,-1)];
}
export function boundsOf(points:readonly V[]){return{min:[0,1,2].map(k=>Math.min(...points.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...points.map(p=>p[k])))};}

export function subtractTriangleFootprint(subject:V[],triangle:Triangle):V[][]{
  const points=[triangle.a,triangle.b,triangle.c],sign=Math.sign(cross2(points[0],points[1],points[2]));
  let inside=subject;const outside:V[][]=[];
  for(let i=0;i<3&&inside.length;i++){
    const signed=(p:V)=>cross2(points[i],points[(i+1)%3],p)*sign;
    const fragment=clipPlane(inside,p=>-signed(p));if(area(fragment)>1e-9)outside.push(fragment);
    inside=clipPlane(inside,signed);
  }return outside;
}



export type Provenance={kind:string;batch:string;vertexStart:number;vertexEnd:number;indexStart:number;indexEnd:number;role:string;solid?:boolean;assembly?:string};
export class ComponentOracle {
 readonly owner=new Map<number,Provenance>();readonly triangles=new Map<Provenance,Triangle[]>();readonly bounds=new Map<Provenance,{min:number[];max:number[]}>();private closed=new Map<Provenance,boolean>();
 constructor(readonly mesh:MeshOracle,readonly components:readonly Provenance[]){
  const batches=new Map<string,Provenance[]>();for(const c of components){const list=batches.get(c.batch)??[];list.push(c);batches.set(c.batch,list);}
  for(const q of mesh.triangles){const owners=(batches.get(q.batch)??[]).filter(c=>q.indexStart!>=c.indexStart&&q.indexStart!<c.indexEnd);if(owners.length!==1||q.vertices.some(i=>i<owners[0].vertexStart||i>=owners[0].vertexEnd))throw new Error(`Triangle ${q.id} has invalid exact primitive provenance`);const c=owners[0];this.owner.set(q.id,c);const list=this.triangles.get(c)??[];list.push(q);this.triangles.set(c,list);}
  for(const c of components){const qs=this.triangles.get(c)??[];this.bounds.set(c,boundsOf(qs.flatMap(q=>[q.a,q.b,q.c])));}
 }
 points(c:Provenance){return(this.triangles.get(c)??[]).flatMap(q=>[q.a,q.b,q.c]);}
 contact(a:Provenance,b:Provenance,tolerance=.001){
  const ba=this.bounds.get(a)!,bb=this.bounds.get(b)!;if(ba.min.some((n,k)=>n>bb.max[k]+tolerance)||ba.max.some((n,k)=>n<bb.min[k]-tolerance))return false;
  for(const q of this.triangles.get(a)??[])for(const r of this.triangles.get(b)??[]){if(q.min.some((n,k)=>n>r.max[k]+tolerance)||q.max.some((n,k)=>n<r.min[k]-tolerance))continue;if([[q.a,q.b],[q.b,q.c],[q.c,q.a]].some(([x,y])=>segmentTriangleDistance(x,y,r)<=tolerance)||[[r.a,r.b],[r.b,r.c],[r.c,r.a]].some(([x,y])=>segmentTriangleDistance(x,y,q)<=tolerance))return true;}return false;
 }
 closedShell(c:Provenance){
  let result=this.closed.get(c);if(result!==undefined)return result;const edges=new Map<string,{count:number;direction:number}>();
  for(const q of this.triangles.get(c)??[]){if(area3D([q.a,q.b,q.c])<1e-10)continue;const p=[q.a,q.b,q.c].map(v=>v.map(n=>Math.round(n*1e7)).join(','));for(let i=0;i<3;i++){const a=p[i],b=p[(i+1)%3],key=[a,b].sort().join('|'),edge=edges.get(key)??{count:0,direction:0};edge.count++;edge.direction+=a<b?1:-1;edges.set(key,edge);}}
  result=edges.size>0&&[...edges.values()].every(e=>e.count===2&&e.direction===0);this.closed.set(c,result);return result;
 }
 inside(p:V,c:Provenance){
  if(!this.closedShell(c))return false;const b=this.bounds.get(c)!;if(p.some((v,k)=>v<=b.min[k]||v>=b.max[k]))return false;const d=Math.hypot(...b.max.map((v,k)=>v-b.min[k]))*3+1;
  return [[1,.371,.529],[.617,1,.419]].every(axis=>{const end=p.map((v,k)=>v+d*axis[k]),hits=(this.triangles.get(c)??[]).map(q=>hitFraction(q,p,end)).filter((x):x is number=>x!==null).sort((a,b)=>a-b),unique=hits.filter((x,i)=>i===0||x-hits[i-1]>1e-7);return unique.length%2===1;});
 }
 attachment(a:Provenance,b:Provenance){return this.contact(a,b)||this.points(a).some(p=>this.inside(p,b))||this.points(b).some(p=>this.inside(p,a));}
}
export function supportCoverage(mesh:MeshOracle,polygon:V[],accept:(q:Triangle,overlap:V[])=>boolean){
 const b=boundsOf(polygon);let remaining=[polygon],intersections=0;
 for(const q of mesh.query(b.min,b.max)){if(Math.abs(cross2(q.a,q.b,q.c))<1e-9)continue;const overlap=clipPolygon(polygon,q);if(area(overlap)<1e-9||!accept(q,overlap))continue;remaining=remaining.flatMap(p=>subtractTriangleFootprint(p,q));intersections++;}return{uncovered:remaining.reduce((sum,p)=>sum+area(p),0),intersections};
}
export function coincidentOutwardPolygon(a:Triangle,b:Triangle):{polygon:V[];normal:V}|null{
 const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],na=cross(sub(a.b,a.a),sub(a.c,a.a)),nb=cross(sub(b.b,b.a),sub(b.c,b.a)),la=Math.hypot(...na),lb=Math.hypot(...nb);if(la<1e-10||lb<1e-10||dot(na,nb)/(la*lb)<1-1e-9)return null;const n=na.map(x=>x/la);if([b.a,b.b,b.c].some(p=>Math.abs(dot(sub(p,a.a),n))>1e-7))return null;
 const drop=n.reduce((best,value,k)=>Math.abs(value)>Math.abs(n[best])?k:best,0),axes=[0,1,2].filter(k=>k!==drop),project=(p:V):V=>[p[axes[0]],p[drop],p[axes[1]]],restore=(p:V):V=>{const q=[0,0,0];q[axes[0]]=p[0];q[drop]=p[1];q[axes[1]]=p[2];return q;},p=[a.a,a.b,a.c].map(project),q={...b,a:project(b.a),b:project(b.b),c:project(b.c)},clipped=clipPolygon(p,q);return area(clipped)>1e-9?{polygon:clipped.map(restore),normal:n}:null;
}
export type ConvexPlane={a:V;n:V};
export function convexPlanes(parts:ComponentOracle,c:Provenance):ConvexPlane[]|null{
 if(!parts.closedShell(c))return null;const points=parts.points(c),planes:ConvexPlane[]=[];
 for(const q of parts.triangles.get(c)??[]){const a=sub(q.b,q.a),b=sub(q.c,q.a),n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...n);if(length<1e-10)continue;n.forEach((x,i)=>n[i]=x/length);if(points.some(p=>dot(n,sub(p,q.a))>1e-6))return null;planes.push({a:q.a,n});}return planes;
}
export function subtractConvexSolid(subject:V[],planes:ConvexPlane[]){
 let inside=subject;const outside:V[][]=[];for(const plane of planes){const signed=(p:V)=>-dot(plane.n,sub(p,plane.a)),fragment=clipPlane(inside,p=>-signed(p));if(area3D(fragment)>1e-10)outside.push(fragment);inside=clipPlane(inside,signed);if(!inside.length)break;}
 // A third coflush outer skin does not bury this skin. Positive interior
 // depth must exist against EVERY plane. For a convex clipped polygon its
 // centroid is then strictly interior; boundary-only contact is not burial.
 if(inside.length&&planes.some(plane=>!inside.some(p=>-dot(plane.n,sub(p,plane.a))>1e-7)))return[subject];return outside;
}
/** Exact emitted shell decomposition; welding tolerance is one micrometre,
 * far below the original relief gaps. Material membership never joins shells. */
export function weldedTriangleShells(triangles:readonly Triangle[]):Triangle[][]{
 const parents=triangles.map((_,i)=>i),root=(i:number):number=>parents[i]===i?i:(parents[i]=root(parents[i])),weld=new Map<string,number>();
 triangles.forEach((q,i)=>{for(const p of [q.a,q.b,q.c]){const key=p.map(n=>Math.round(n*1e6)).join(','),prior=weld.get(key);if(prior===undefined)weld.set(key,i);else parents[root(i)]=root(prior);}});const groups=new Map<number,Triangle[]>();triangles.forEach((q,i)=>{const key=root(i),list=groups.get(key)??[];list.push(q);groups.set(key,list);});return[...groups.values()];
}
/** Prove burial under the actual connected ground over the WHOLE polygon.
 * Only projected regions with strictly higher terrain are removed. Vertical
 * patches conservatively remain unproved; no center/AABB hiding shortcut. */
export function subtractTerrainBurial(mesh:MeshOracle,terrainIds:ReadonlySet<number>,subject:V[]):V[][]{
 if(area(subject)<1e-10)return[subject];const box=boundsOf(subject);let remaining=[subject];
 for(const ground of mesh.query(box.min,box.max)){if(!terrainIds.has(ground.id))continue;const projected=clipPolygon(subject,ground),buried=clipPlane(projected,p=>height(ground,p[0],p[2])-p[1]-1e-6);if(area(buried)<1e-10)continue;
  for(let i=1;i<buried.length-1;i++){const q:Triangle={id:-1,batch:'actual whole-plane terrain burial',vertices:[],a:buried[0],b:buried[i],c:buried[i+1],...boundsOf([buried[0],buried[i],buried[i+1]])};remaining=remaining.flatMap(p=>subtractTriangleFootprint(p,q));}if(!remaining.length)break;
 }return remaining;
}
