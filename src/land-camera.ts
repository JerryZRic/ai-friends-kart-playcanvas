/** Static camera safety. Queries source boxes and optional source terrain,
 * never kart collision or nearest-road projection, preserving the chosen deck. */
export type CameraPoint={x:number;y:number;z:number};
export type CameraHeightfield=Readonly<{minX:number;minZ:number;dx:number;dz:number;columns:number;rows:number;heights:readonly number[]}>;
export type CameraBlocker={min:readonly number[];max:readonly number[];heightfield?:CameraHeightfield};

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
export function safeLandCamera(anchor:CameraPoint,desired:CameraPoint,blockers:readonly CameraBlocker[],margin=.45):CameraPoint {
  const start=[anchor.x,anchor.y,anchor.z],delta=[desired.x-anchor.x,desired.y-anchor.y,desired.z-anchor.z];
  let fraction=1;
  for(const box of blockers){
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
