/** One kart runtime; large scenery modules load only for the selected course. */
import * as pc from 'playcanvas';
import {createCoastScene, placeKart as placeCoastKart} from './scene';
import {LENGTH, sample, halfWidthAt, circuit} from './track';
import {resolveMap, type MapId} from './map-profiles';
import type {LandTrack} from './land-track';

export async function loadLandCourse(search: string) {
  const requested=resolveMap(new URLSearchParams(search).get('map'));
  const mapId: MapId=requested.vehicle==='kart'?requested.id:'coast';
  if(mapId==='mountain') {
    const [{MOUNTAIN_TRACK:track},{createLandScene}]=await Promise.all([import('./maps/mountain'),import('./land-scene')]);
    return {id:mapId,profile:resolveMap(mapId),track, length:track.length, sample:track.sample, halfWidthAt:track.halfWidthAt,
      createScene:(app:pc.Application)=>createLandScene(app,track),
      placeKart:(entity:pc.Entity,distance:number,lateral:number,angle=0)=>placeLandKart(entity,track,distance,lateral,angle)};
  }
  return {id:'coast' as MapId,profile:resolveMap('coast'),track:null as LandTrack|null,length:LENGTH,sample,halfWidthAt,
    createScene:createCoastScene,placeKart:placeCoastKart};
}
/** Model +Z faces the tangent; the local up follows real grade AND camber. */
export function placeLandKart(entity:pc.Entity,track:LandTrack,distance:number,lateral:number,angle=0) {
  const frame=track.sample(distance,lateral);
  const up=frame.normal??new pc.Vec3().cross(frame.t,frame.n).normalize();
  const forward=frame.t.clone().normalize(),right=new pc.Vec3().cross(up,forward).normalize();
  const matrix=new pc.Mat4();
  matrix.data.set([right.x,right.y,right.z,0,up.x,up.y,up.z,0,forward.x,forward.y,forward.z,0,0,0,0,1]);
  const rotation=new pc.Quat().setFromMat4(matrix).mul(new pc.Quat().setFromEulerAngles(0,angle*180/Math.PI,0));
  entity.setPosition(frame.p.clone().add(up.clone().mulScalar(.11)));
  entity.setRotation(rotation);
  return frame;
}
