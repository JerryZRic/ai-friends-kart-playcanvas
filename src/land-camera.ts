/** Small static-facade camera safety adapter. This is a segment/AABB query, not
 * kart collision or nearest-road projection; it preserves the chosen deck. */
export type CameraPoint={x:number;y:number;z:number};
export type CameraBlocker={min:readonly number[];max:readonly number[]};
export function safeLandCamera(anchor:CameraPoint,desired:CameraPoint,blockers:readonly CameraBlocker[],margin=.45):CameraPoint {
  const start=[anchor.x,anchor.y,anchor.z],delta=[desired.x-anchor.x,desired.y-anchor.y,desired.z-anchor.z];
  let fraction=1;
  for(const box of blockers){
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
