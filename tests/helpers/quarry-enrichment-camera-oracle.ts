/** Acceptance math uses only actual emitted indexed triangles. Obstacle bounds
 * and kind labels never establish a geometric pass or inherited exception. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MeshOracle,area3D,height,lerp,projectedInterval,segmentTriangleDistance,type Triangle,type V} from './emitted-scene-oracle';
export const QUARRY_CAMERA_MARGIN=.3;
export const quarryFaceKey=(q:Pick<Triangle,'a'|'b'|'c'>)=>createHash('sha256').update(JSON.stringify([q.a,q.b,q.c].map(p=>[...p]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]))).digest('hex');
export type CameraViolation={triangle:Triangle;gap:number;kind:'face-clearance'|'below-terrain'};
export function inspectQuarryBoom(mesh:MeshOracle,a:V,b:V,visit:(violation:CameraViolation)=>void,terrain=true,only?:ReadonlySet<number>){
 let minimum=Infinity;
 for(const q of mesh.query(a,b,QUARRY_CAMERA_MARGIN)){
  if(only&&!only.has(q.id)||area3D([q.a,q.b,q.c])<=1e-12)continue;
  if(q.min[1]<=Math.max(a[1],b[1])+QUARRY_CAMERA_MARGIN&&q.max[1]>=Math.min(a[1],b[1])-QUARRY_CAMERA_MARGIN){
   const gap=segmentTriangleDistance(a,b,q);minimum=Math.min(minimum,gap);
   if(gap<QUARRY_CAMERA_MARGIN-1e-6)visit({triangle:q,gap,kind:'face-clearance'});
  }
  // The named source batch is the continuous emitted working floor. The
  // query intentionally keeps triangles above the boom for this test.
  if(terrain&&q.batch==='Quarry continuous dry working floor'){
   const interval=projectedInterval(q,a,b);
   if(interval){const gap=Math.min(...interval.map(t=>{const p=lerp(a,b,t);return p[1]-height(q,p[0],p[2]);}));if(gap<QUARRY_CAMERA_MARGIN-1e-7)visit({triangle:q,gap,kind:'below-terrain'});}
  }
 }return minimum;
}
export function quarryCameraOracleSentinels(){
 const mesh=(positions:number[])=>new MeshOracle([{name:'sentinel',positions,indices:[0,1,2]}]).triangles[0];
 const wall=mesh([0,-2,-2,0,2,-2,0,0,2]);
 assert.equal(segmentTriangleDistance([-1,0,0],[1,0,0],wall),0,'interior hit despite clear endpoints');
 assert.equal(segmentTriangleDistance([0,0,0],[0,0,0],wall),0,'zero-length point on source triangle');
 assert.ok(Math.abs(segmentTriangleDistance([-.3,0,0],[-.3,0,0],wall)-.3)<1e-12,'independent strict margin remains .3 m');
 assert.ok(segmentTriangleDistance([-.299,0,0],[-.299,0,0],wall)<.3,'sub-margin near miss fails without a face intersection');
 const corner=mesh([0,0,0,10,0,0,0,0,10]);
 assert.ok(Math.abs(segmentTriangleDistance([-.2,-1,-.2],[-.2,1,-.2],corner)-Math.sqrt(.08))<1e-12,'edge/vertex capsule near miss');
 assert.ok(segmentTriangleDistance([8,-1,8],[8,1,8],corner)>4,'triangle AABB interior is not a filled triangle');
 const ridge=mesh([4.99999,0,-1,5.00002,8,0,4.99999,0,1]),interval=projectedInterval(ridge,[0,1,0],[10,1,0]);
 assert.ok(interval&&interval[0]<.5&&interval[1]>.5&&interval[1]-interval[0]<.00001,'exact narrow interior terrain interval');
 assert.ok(interval.some(t=>{const p=lerp([0,1,0],[10,1,0],t);return height(ridge,p[0],p[2])>p[1];}),'interval endpoint heights detect thin terrain peak');
 const inverted=new MeshOracle([{name:'Quarry continuous dry working floor',positions:[-2,10,-2,2,10,-2,0,10,2],indices:[0,1,2]}]),failures:CameraViolation[]=[];
 inspectQuarryBoom(inverted,[-.1,0,0],[.1,0,0],v=>failures.push(v));assert.ok(failures.some(v=>v.kind==='below-terrain'&&v.gap===-10),'terrain well above the boom cannot disappear in a Y broadphase');
 const reversed={...wall,b:wall.c,c:wall.b};assert.equal(segmentTriangleDistance([-1,0,0],[1,0,0],reversed),0,'both face windings count');
}

export const quarryWitnessKey=(label:string,kind:string,faceKey:string,a:V,b:V)=>label+'|'+kind+'|'+faceKey+'|'+createHash('sha256').update(JSON.stringify([a,b])).digest('hex');
export function inheritedQuarryCameraWitness(changed:boolean,key:string,gap:number,baseline:Record<string,number>){
 return !changed&&Object.hasOwn(baseline,key)&&gap>=baseline[key]-1e-9&&(gap>1e-12||baseline[key]<=1e-12);
}

/** A retracted endpoint can retain an existing near-rail witness, but only
 * when it is proved to be the same anchored ray's contained subsegment.
 * Mere face/gap matching, shifted rays and general moving paths do not qualify.
 * The caller must separately prove same label/kind and unchanged face identity.
 */
export function quarryAnchoredShorteningProof(a:V,b:V,oldA:V,oldB:V,gap:number,oldGap:number){
 const toleranceMetres=1e-9,fractionTolerance=1e-12;
 if(![...a,...b,...oldA,...oldB,gap,oldGap].every(Number.isFinite)||gap<oldGap-toleranceMetres)return null;
 const startResidual=Math.hypot(...a.map((n,k)=>n-oldA[k]));if(startResidual>toleranceMetres)return null;
 const direction=oldB.map((n,k)=>n-oldA[k]),lengthSquared=direction.reduce((n,v)=>n+v*v,0);if(lengthSquared<1e-20)return null;
 const fraction=b.reduce((n,v,k)=>n+(v-oldA[k])*direction[k],0)/lengthSquared;
 if(fraction< -fractionTolerance||fraction>1+fractionTolerance)return null;
 const endpointResidual=Math.hypot(...b.map((n,k)=>n-(oldA[k]+fraction*direction[k])));if(endpointResidual>toleranceMetres)return null;
 // A newly intersecting segment cannot inherit a nonintersecting margin.
 if(gap<=1e-12&&oldGap>1e-12)return null;
 return {kind:'same-anchor-collinear-subsegment',startResidualMetres:startResidual,endpointResidualMetres:endpointResidual,endpointFraction:fraction,toleranceMetres,fractionTolerance,baselineGap:oldGap,currentGap:gap,baselineA:oldA,baselineB:oldB};
}
