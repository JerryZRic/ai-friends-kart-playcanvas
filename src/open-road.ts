import {Vec3} from 'playcanvas';
import type {CircuitPoint} from './closed-circuit';
import type {LandSample} from './land-track';
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const vector = (p: CircuitPoint) => Array.isArray(p) ? new Vec3(...p as [number, number, number]) : new Vec3((p as Vec3).x, (p as Vec3).y, (p as Vec3).z);
/** Original open Hermite road with physical arc-length lookup. Endpoint direction
 * is explicit so independently authored fork ribbons share exact support frames. */
export class OpenRoad {
  readonly length: number;
  readonly points: readonly Vec3[];
  private readonly tangents: readonly Vec3[];
  private readonly arcs: readonly number[];
  private readonly steps: number;
  constructor(points: readonly CircuitPoint[], startDirection: CircuitPoint, endDirection: CircuitPoint) {
    if (points.length < 2) throw new Error('Open road needs two points');
    this.points = points.map(vector);
    if (this.points.some(p => ![p.x,p.y,p.z].every(Number.isFinite))) throw new Error('Nonfinite road knot');
    this.tangents = this.points.map((p,i) => i === 0 ? vector(startDirection).normalize() : i === points.length-1 ? vector(endDirection).normalize() : this.points[i+1].clone().sub(this.points[i-1]).normalize());
    this.steps = (points.length-1)*160;
    const arcs = [0]; let previous = this.point(0);
    for (let i=1;i<=this.steps;i++) { const p=this.point(i/this.steps); arcs.push(arcs[i-1]+p.clone().sub(previous).length()); previous=p; }
    this.arcs=arcs; this.length=arcs.at(-1)!;
    if (this.length < 1) throw new Error('Degenerate road');
  }
  private evaluate(u: number, derivative = false): Vec3 {
    const q=clamp(u,0,1)*(this.points.length-1), i=Math.min(this.points.length-2,Math.floor(q)), t=q-i;
    const a=this.points[i], b=this.points[i+1], len=b.clone().sub(a).length();
    const m=this.tangents[i], n=this.tangents[i+1];
    const h=derivative ? [6*t*t-6*t,3*t*t-4*t+1,-6*t*t+6*t,3*t*t-2*t] : [2*t*t*t-3*t*t+1,t*t*t-2*t*t+t,-2*t*t*t+3*t*t,t*t*t-t*t];
    return a.clone().mulScalar(h[0]).add(m.clone().mulScalar(h[1]*len)).add(b.clone().mulScalar(h[2])).add(n.clone().mulScalar(h[3]*len));
  }
  point(u: number) { return this.evaluate(u); }
  private parameter(s: number): number {
    const target=clamp(Number.isFinite(s)?s:0,0,this.length); let lo=0, hi=this.steps;
    while(lo+1<hi) { const m=(lo+hi)>>1; if(this.arcs[m]<=target)lo=m;else hi=m; }
    return (lo+(target-this.arcs[lo])/(this.arcs[hi]-this.arcs[lo]))/this.steps;
  }
  sample(s: number, lateral=0): LandSample {
    const u=this.parameter(s), p=this.point(u), t=this.evaluate(u,true).normalize(), n=new Vec3(t.z,0,-t.x).normalize(), normal=new Vec3().cross(t,n).normalize();
    p.add(n.clone().mulScalar(Number.isFinite(lateral)?lateral:0));
    return {p,t,n,normal,u:s/this.length,angle:Math.atan2(t.x,t.z),bank:0,grade:t.y/Math.max(1e-6,Math.hypot(t.x,t.z))};
  }
  curvature(s: number, span=7) { const a=this.sample(clamp(s,0,this.length)).t,b=this.sample(clamp(s+span,0,this.length)).t; return Math.atan2(a.z*b.x-a.x*b.z,a.x*b.x+a.z*b.z)/span; }
}
