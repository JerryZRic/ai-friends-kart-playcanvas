/** Static camera safety. Queries source boxes and optional source terrain,
 * never kart collision or nearest-road projection, preserving the chosen deck. */
export type CameraPoint={x:number;y:number;z:number};
export type CameraHeightfield=Readonly<{minX:number;minZ:number;dx:number;dz:number;columns:number;rows:number;heights:readonly number[]}>;
export type CameraBlocker={min:readonly number[];max:readonly number[];heightfield?:CameraHeightfield;triangles?:readonly (readonly (readonly number[])[])[]};

/** The same two source triangles as an emitted row-major terrain cell:
 * (00,01,10) and (10,01,11). This is not bilinear height approximation. */
export function cameraTerrainHeight(field:CameraHeightfield,x:number,z:number):number|null {
  const gx=(x-field.minX)/field.dx,gz=(z-field.minZ)/field.dz;
  if(gx<0||gz<0||gx>field.columns-1||gz>field.rows-1)return null;
  const ix=Math.min(field.columns-2,Math.floor(gx)),iz=Math.min(field.rows-2,Math.floor(gz)),u=gx-ix,v=gz-iz,i=iz*field.columns+ix;
  const a=field.heights[i],b=field.heights[i+1],c=field.heights[i+field.columns],d=field.heights[i+field.columns+1];
  const height=u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
  return Number.isFinite(height)?height:null;
}

/** Exact segment/triangle intersection with a vertical clearance margin.
 * Split only at grid lines crossed by this boom, then each crossed cell's
 * diagonal. Clearance is linear on each interval, so thin terrain peaks cannot
 * disappear between fixed sampling steps. Typical booms visit only a few cells. */
function terrainFraction(anchor:CameraPoint,desired:CameraPoint,field:CameraHeightfield,margin:number):number {
  if(field.columns<2||field.rows<2||field.dx<=0||field.dz<=0)return 1;
  const gx=(anchor.x-field.minX)/field.dx,gz=(anchor.z-field.minZ)/field.dz;
  const sx=(desired.x-anchor.x)/field.dx,sz=(desired.z-anchor.z)/field.dz;
  const cuts=[0,1];
  for(const [start,delta,count]of [[gx,sx,field.columns],[gz,sz,field.rows]]){
    if(Math.abs(delta)<1e-12)continue;
    const first=Math.max(0,Math.ceil(Math.min(start,start+delta))),last=Math.min(count-1,Math.floor(Math.max(start,start+delta)));
    for(let grid=first;grid<=last;grid++){const t=(grid-start)/delta;if(t>0&&t<1)cuts.push(t);}
  }
  cuts.sort((a,b)=>a-b);
  const triangles=[...cuts];
  for(let i=1;i<cuts.length;i++){
    const lo=cuts[i-1],hi=cuts[i],mid=(lo+hi)/2,x=gx+sx*mid,z=gz+sz*mid;
    if(x<0||z<0||x>=field.columns-1||z>=field.rows-1||Math.abs(sx+sz)<1e-12)continue;
    const diagonal=(Math.floor(x)+Math.floor(z)+1-gx-gz)/(sx+sz);
    if(diagonal>lo+1e-12&&diagonal<hi-1e-12)triangles.push(diagonal);
  }
  triangles.sort((a,b)=>a-b);
  const clear=(t:number)=>{
    const height=cameraTerrainHeight(field,anchor.x+(desired.x-anchor.x)*t,anchor.z+(desired.z-anchor.z)*t);
    return height===null?null:anchor.y+(desired.y-anchor.y)*t-height-margin;
  };
  for(let i=1;i<triangles.length;i++){
    const lo=triangles[i-1],hi=triangles[i];if(hi-lo<1e-12)continue;
    const middle=clear((lo+hi)/2);if(middle===null)continue;
    // A boundary roundoff can fall a hair outside the finite grid. Interpolate
    // the interval's endpoint from an interior point rather than extending it.
    const start=clear(lo)??clear(lo+(hi-lo)*1e-9),end=clear(hi)??clear(hi-(hi-lo)*1e-9);
    if(start===null||end===null)continue;
    if(start<=0)return Math.max(0,lo-.02);
    if(end<=0){const hit=lo+(hi-lo)*start/(start-end);return Math.max(0,hit-.02);}
  }
  return 1;
}
/** Triangle mesh acceleration is built once for each immutable source array.
 * A chase boom visits only its small XZ corridor, never every scene triangle. */
type CameraTriangle=readonly (readonly number[])[];
type MeshIndex={cells:Map<string,number[]>;triangles:readonly CameraTriangle[]};
const cameraMeshIndexes=new WeakMap<readonly CameraTriangle[],MeshIndex>();
const meshCell=24;
const subtract=(a:readonly number[],b:readonly number[])=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:readonly number[],b:readonly number[])=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:readonly number[],b:readonly number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function meshIndex(triangles:readonly CameraTriangle[]):MeshIndex {
  const cached=cameraMeshIndexes.get(triangles);if(cached)return cached;
  const cells=new Map<string,number[]>();
  triangles.forEach((t,i)=>{if(t.length!==3||t.some(p=>p.length<3||!p.slice(0,3).every(Number.isFinite)))return;
    const minX=Math.floor(Math.min(...t.map(p=>p[0]))/meshCell),maxX=Math.floor(Math.max(...t.map(p=>p[0]))/meshCell),minZ=Math.floor(Math.min(...t.map(p=>p[2]))/meshCell),maxZ=Math.floor(Math.max(...t.map(p=>p[2]))/meshCell);
    for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const key=x+','+z,list=cells.get(key)??[];list.push(i);cells.set(key,list);}
  });const index={cells,triangles};cameraMeshIndexes.set(triangles,index);return index;
}
/** Exposed for bounded-work tests and diagnostics; it returns source triangle
 * IDs only and never changes mesh contents or support physics. */
export function cameraMeshCandidateIds(triangles:readonly CameraTriangle[],anchor:CameraPoint,desired:CameraPoint,margin=.45):number[] {
  const index=meshIndex(triangles),ids=new Set<number>();
  const minX=Math.floor((Math.min(anchor.x,desired.x)-margin)/meshCell),maxX=Math.floor((Math.max(anchor.x,desired.x)+margin)/meshCell),minZ=Math.floor((Math.min(anchor.z,desired.z)-margin)/meshCell),maxZ=Math.floor((Math.max(anchor.z,desired.z)+margin)/meshCell);
  for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++)for(const id of index.cells.get(x+','+z)??[])ids.add(id);return [...ids];
}
function pointTriangleDistanceSquared(p:number[],t:CameraTriangle):number {
  const [a,b,c]=t,ab=subtract(b,a),ac=subtract(c,a),ap=subtract(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
  if(d1<=0&&d2<=0)return dot(ap,ap);const bp=subtract(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return dot(bp,bp);
  const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3),q=ap.map((x,i)=>x-v*ab[i]);return dot(q,q);}
  const cp=subtract(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return dot(cp,cp);
  const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6),q=ap.map((x,i)=>x-w*ac[i]);return dot(q,q);}
  const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6)),bc=subtract(c,b),q=bp.map((x,i)=>x-w*bc[i]);return dot(q,q);}
  const denominator=va+vb+vc;if(Math.abs(denominator)<1e-18)return Infinity;const v=vb/denominator,w=vc/denominator,q=ap.map((x,i)=>x-v*ab[i]-w*ac[i]);return dot(q,q);
}
function meshFraction(anchor:CameraPoint,desired:CameraPoint,triangles:readonly CameraTriangle[],margin:number):number {
  const origin=[anchor.x,anchor.y,anchor.z],delta=[desired.x-anchor.x,desired.y-anchor.y,desired.z-anchor.z],dd=dot(delta,delta);if(dd<1e-20)return 1;
  const radius=Math.max(0,margin),r2=radius*radius;let hit=1;
  const accept=(t:number)=>{if(Number.isFinite(t)&&t>=0&&t<hit)hit=t;};
  const sphere=(center:readonly number[])=>{const q=subtract(origin,center),b=dot(q,delta),c=dot(q,q)-r2,d=b*b-dd*c;if(d>=0)accept((-b-Math.sqrt(d))/dd);};
  for(const id of cameraMeshCandidateIds(triangles,anchor,desired,radius)){
    const tri=triangles[id],normal=cross(subtract(tri[1],tri[0]),subtract(tri[2],tri[0])),nn=dot(normal,normal);if(nn<1e-18)continue;
    // As with existing boxes, an anchor already within this face's clearance
    // shell may escape. Other faces still protect the boom. No solid volume
    // is invented inside an open annulus or below a thin bridge deck.
    if(pointTriangleDistanceSquared(origin,tri)<=r2+1e-12)continue;
    const normalLength=Math.sqrt(nn),n=normal.map(x=>x/normalLength),distance=dot(subtract(origin,tri[0]),n),speed=dot(delta,n);
    if(Math.abs(speed)>1e-12)for(const sign of [-1,1]){const t=(sign*radius-distance)/speed;if(t<0||t>hit)continue;const projected=origin.map((x,i)=>x+delta[i]*t-sign*radius*n[i]);if(pointTriangleDistanceSquared(projected,tri)<1e-12)accept(t);}
    // Swept-sphere edge capsules and end spheres cover thin/oblique corners.
    for(let i=0;i<3;i++){const a=tri[i],b=tri[(i+1)%3],ba=subtract(b,a),oa=subtract(origin,a),baba=dot(ba,ba);sphere(a);if(baba<1e-20)continue;
      const bard=dot(ba,delta),baoa=dot(ba,oa),A=baba*dd-bard*bard,B=baba*dot(delta,oa)-baoa*bard,C=baba*(dot(oa,oa)-r2)-baoa*baoa,D=B*B-A*C;
      if(Math.abs(A)>1e-18&&D>=0){const t=(-B-Math.sqrt(D))/A,y=baoa+t*bard;if(y>=0&&y<=baba)accept(t);}
    }
  }return hit<1?Math.max(0,hit-.02):1;
}
export function safeLandCamera(anchor:CameraPoint,desired:CameraPoint,blockers:readonly CameraBlocker[],margin=.45):CameraPoint {
  const start=[anchor.x,anchor.y,anchor.z],delta=[desired.x-anchor.x,desired.y-anchor.y,desired.z-anchor.z];
  let fraction=1;
  for(const box of blockers){
    if(box.triangles){fraction=Math.min(fraction,meshFraction(anchor,desired,box.triangles,margin));continue;}
    if(box.heightfield){fraction=Math.min(fraction,terrainFraction(anchor,desired,box.heightfield,margin));continue;}
    let enter=0,leave=1,inside=true;
    for(let axis=0;axis<3;axis++){
      const lo=box.min[axis]-margin,hi=box.max[axis]+margin;
      if(start[axis]<lo||start[axis]>hi)inside=false;
      if(Math.abs(delta[axis])<1e-9){if(start[axis]<lo||start[axis]>hi){enter=2;break;}}
      else {const a=(lo-start[axis])/delta[axis],b=(hi-start[axis])/delta[axis];enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));}
    }
    if(!inside&&enter<=leave&&enter>=0&&enter<=fraction)fraction=Math.max(0,enter-.02);
  }
  return {x:anchor.x+delta[0]*fraction,y:anchor.y+delta[1]*fraction,z:anchor.z+delta[2]*fraction};
}
