import assert from 'node:assert/strict';
import {hullXZ,sub,dot,area3D,boundsOf,type V,type Triangle,type ConvexPlane,ComponentOracle} from './emitted-scene-oracle';
import {splitShellEdges,polygonCenter} from './town-enrichment-geometry';
import type {QuarryPrimitive} from './quarry-enrichment-provenance';
/** Minimum-area oriented rectangle, derived from the full indexed footprint. */
export function footprintAxes(points:readonly V[]){
 const hull=hullXZ([...points]);let best:{area:number;long:number;short:number;ratio:number;angle:number}|null=null;
 for(let i=0;i<hull.length;i++){const a=hull[i],b=hull[(i+1)%hull.length],angle=Math.atan2(b[2]-a[2],b[0]-a[0]),c=Math.cos(angle),s=Math.sin(angle),x=hull.map(p=>p[0]*c+p[2]*s),z=hull.map(p=>-p[0]*s+p[2]*c),u=Math.max(...x)-Math.min(...x),v=Math.max(...z)-Math.min(...z),result={area:u*v,long:Math.max(u,v),short:Math.min(u,v),ratio:Math.max(u,v)/Math.min(u,v),angle};if(!best||result.area<best.area)best=result;}
 assert.ok(best&&Number.isFinite(best.ratio));return best;
}
/** Convex component volume from its actual indexed planes. An authored solid
 * may omit one internal/buried planar cap; the single real boundary loop is
 * closed analytically, never treated as a newly rendered face or an aperture.
 * Arbitrary open architecture is NOT accepted by this helper. */
export function emittedConvexVolume(parts:ComponentOracle,c:QuarryPrimitive):ConvexPlane[]|null{
 if(!['box','beam','solid'].includes(c.method))return null;
 const qs=parts.triangles.get(c)!,points=parts.points(c),center=polygonCenter(points),planes:ConvexPlane[]=[];
 const plane=(a:V,b:V,d:V)=>{const x=sub(b,a),y=sub(d,a),n=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]],l=Math.hypot(...n);if(l<1e-10)return null;for(let k=0;k<3;k++)n[k]/=l;if(dot(n,sub(center,a))>0)for(let k=0;k<3;k++)n[k]*=-1;return{a,n};};
 for(const q of qs){const p=plane(q.a,q.b,q.c);if(p)planes.push(p);}
 if(!parts.closedShell(c)){
  const boundary=splitShellEdges(qs);if(!boundary.length||boundary.some(e=>e.count!==1))return null;
  const ring=hullXZ(boundary.flatMap(e=>[e.a,e.b]));if(ring.length<3)return null;const p=plane(ring[0],ring[1],ring[2]);if(!p||boundary.some(e=>[e.a,e.b].some(v=>Math.abs(dot(p.n,sub(v,p.a)))>1e-6)))return null;
  const degree=new Map<string,number>();for(const edge of boundary)for(const p of [edge.a,edge.b]){const k=p.map(n=>Math.round(n*1e6)).join(',');degree.set(k,(degree.get(k)??0)+1);}if([...degree.values()].some(n=>n!==2))return null;planes.push(p);
 }
 if(points.some(v=>planes.some(p=>dot(p.n,sub(v,p.a))>1e-6)))return null;
 if(planes.some(p=>dot(p.n,sub(center,p.a))>=-1e-8))return null;
 return planes;
}
export const triangleKey=(q:Triangle)=>JSON.stringify([q.a,q.b,q.c]);
