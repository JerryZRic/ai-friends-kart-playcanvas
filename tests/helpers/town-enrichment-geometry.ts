import {area3D,boundsOf,clipPlane,dot,sub,type Triangle,type V,type ConvexPlane} from './emitted-scene-oracle';

/** Weld and split collinear boundary segments so a correctly tiled planar
 * recess can meet the original longer footing edges without fake open seams. */
export function splitShellEdges(triangles:readonly Triangle[]){
 const key=(p:V)=>p.map(n=>Math.round(n*1e6)).join(','),vertices=[...new Map(triangles.flatMap(t=>[t.a,t.b,t.c]).map(p=>[key(p),p])).values()];
 const edges=new Map<string,{count:number;direction:number;a:V;b:V}>();
 for(const t of triangles){if(area3D([t.a,t.b,t.c])<1e-10)continue;const v=[t.a,t.b,t.c];
  for(let i=0;i<3;i++){const a=v[i],b=v[(i+1)%3],d=sub(b,a),l2=dot(d,d);if(l2<1e-16)continue;
   const cuts=vertices.map(p=>({p,u:dot(sub(p,a),d)/l2})).filter(({p,u})=>u>=-1e-8&&u<=1+1e-8&&Math.hypot(...p.map((n,k)=>n-a[k]-u*d[k]))<1e-6).sort((x,y)=>x.u-y.u);
   for(let j=1;j<cuts.length;j++){const p=cuts[j-1].p,q=cuts[j].p,pk=key(p),qk=key(q);if(pk===qk)continue;const k=[pk,qk].sort().join('|'),e=edges.get(k)??{count:0,direction:0,a:p,b:q};e.count++;e.direction+=pk<qk?1:-1;edges.set(k,e);}
  }
 }
 return [...edges.values()].filter(e=>e.count!==2||e.direction!==0);
}
export const overlapBounds=(a:{min:V;max:V},b:{min:V;max:V},epsilon=1e-7)=>a.min.every((n,k)=>n<=b.max[k]+epsilon)&&a.max.every((n,k)=>n>=b.min[k]-epsilon);
export function triangleInsideConvex(t:Triangle,planes:readonly ConvexPlane[],epsilon=1e-7){
 let p=[t.a,t.b,t.c];for(const plane of planes){p=clipPlane(p,q=>-dot(plane.n,sub(q,plane.a))-epsilon);if(!p.length)break;}return p;
}
/** SAT broadphase is finite AABB only; all acceptance decisions use triangles. */
export function primitivePairs<T>(members:readonly T[],bounds:{get(member:T):{min:V;max:V}|undefined}){
 const sorted=[...members].sort((a,b)=>bounds.get(a)!.min[0]-bounds.get(b)!.min[0]);
 const result:[T,T][]=[];
 for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length&&bounds.get(sorted[j])!.min[0]<=bounds.get(sorted[i])!.max[0]+1e-7;j++)if(overlapBounds(bounds.get(sorted[i])!,bounds.get(sorted[j])!))result.push([sorted[i],sorted[j]]);
 return result;
}
export const witness=(q:Triangle)=>({triangle:q.id,batch:q.batch,indexStart:q.indexStart,points:[q.a,q.b,q.c]});
export const polygonCenter=(p:readonly V[])=>[0,1,2].map(k=>p.reduce((n,q)=>n+q[k],0)/p.length);
