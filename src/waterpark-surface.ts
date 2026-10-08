/** Shared, bounded analytical wave field. Visual surface response, not a fluid solver.
 * One coefficient table emits both CPU sampling and GLSL, preventing buoyancy drift.
 * Frequencies remain resolvable by the existing 1 x 1.3 metre water mesh. */
export const WATERPARK_WAVES = Object.freeze([
  Object.freeze({x:.18,z:.31,amplitude:.075,speed:.8}),
  Object.freeze({x:-.43,z:.16,amplitude:.038,speed:1.1}),
  Object.freeze({x:.64,z:.53,amplitude:.014,speed:1.35}),
]);
export const MAX_WATER_HEIGHT=WATERPARK_WAVES.reduce((v,w)=>v+w.amplitude,0);
export const finiteWaterValue=(value:number,limit=86400)=>Number.isFinite(value)?Math.max(-limit,Math.min(limit,value)):0;
export function sampleWaterSurface(x:number,z:number,time:number){
 x=finiteWaterValue(x);z=finiteWaterValue(z);time=finiteWaterValue(time);
 let height=0,dx=0,dz=0;
 for(const w of WATERPARK_WAVES){const phase=x*w.x+z*w.z-time*w.speed; height+=Math.sin(phase)*w.amplitude;const slope=Math.cos(phase)*w.amplitude;dx+=slope*w.x;dz+=slope*w.z;}
 const length=Math.hypot(dx,1,dz);
 return{height,dx,dz,normal:{x:-dx/length,y:1/length,z:-dz/length}};
}
const glsl=(n:number)=>Number.isInteger(n)?`${n}.0`:String(n);
export const WATER_SURFACE_GLSL=`vec3 waterSurface(vec2 p, float t) {\n vec3 result=vec3(0.0);\n${WATERPARK_WAVES.map(w=>` { vec2 k=vec2(${glsl(w.x)},${glsl(w.z)}); float phase=dot(p,k)-t*${glsl(w.speed)}; result+=vec3(sin(phase),cos(phase)*k)*${glsl(w.amplitude)}; }`).join('\n')}\n return result;\n}`;

/** World-up→surface-normal, then heading in that tangent frame. Composing
 * quaternions avoids Euler XYZ applying route-local slopes in world axes. */
export function waterSurfaceRotation(normal:{x:number;y:number;z:number},yawRadians:number){
 const length=Math.hypot(normal.z,normal.x,1+normal.y),half=finiteWaterValue(yawRadians)*.5;
 const x=normal.z/length,z=-normal.x/length,w=(1+normal.y)/length,c=Math.cos(half),s=Math.sin(half);
 return{x:x*c-z*s,y:w*s,z:x*s+z*c,w:w*c};
}
