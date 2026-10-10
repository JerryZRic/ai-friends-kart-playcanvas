/** One kart runtime; large scenery modules load only for the selected course. */
import * as pc from 'playcanvas';
import {createCoastScene, placeKart as placeCoastKart} from './scene';
import {LENGTH, sample, halfWidthAt, circuit} from './track';
import {resolveMap, type MapId} from './map-profiles';
import type {LandTrack,LandSample} from './land-track';
export type CameraObstacle={min:readonly number[];max:readonly number[]};
import type {ForkCourse} from './land-routes';

export async function loadLandCourse(search: string) {
  const requested=resolveMap(new URLSearchParams(search).get('map'));
  const mapId: MapId=requested.vehicle==='kart'?requested.id:'coast';
  if(mapId==='town') {
    const [{TOWN_TRACK:track,TOWN_COURSE:routes},{createLandScene},{buildTownSceneGeometry,TOWN_SCENE_THEME}]=await Promise.all([import('./maps/town'),import('./land-scene'),import('./town-scenery')]);
    const geometry=buildTownSceneGeometry(routes);
    const rows=([['start',.15],['alley',.43],['boulevard',.32],['boulevard',.61],['finish',.56],['finish',.83]] as const);
    const pickups=rows.flatMap(([edgeId,fraction])=>[-2.4,2.4].map(lateral=>{
      const edge=routes.edges[edgeId],s=edge.length*fraction;
      const d=edgeId==='start'?s:edgeId==='finish'?routes.commonStart.length+routes.alternates.boulevard.length+s:routes.commonStart.length+s/edge.length*routes.alternates.boulevard.length;
      return {edgeId,s,d,lateral,p:edge.sample(s,lateral).p};
    }));
    return {id:mapId,profile:resolveMap(mapId),track,routes:routes as ForkCourse|null,length:track.length,sample:track.sample,halfWidthAt:track.halfWidthAt,
      cameraObstacles:geometry.cameraObstacles,
      createScene:(app:pc.Application)=>createLandScene(app,track,{geometry,theme:TOWN_SCENE_THEME,pickups}),
      placeKart:(entity:pc.Entity,distance:number,lateral:number,angle=0)=>placeLandKart(entity,track,distance,lateral,angle)};
  }
  if(mapId==='mountain') {
    const [{MOUNTAIN_TRACK:track},{createLandScene}]=await Promise.all([import('./maps/mountain'),import('./land-scene')]);
    return {id:mapId,profile:resolveMap(mapId),cameraObstacles:[] as readonly CameraObstacle[],track, routes:null as ForkCourse|null, length:track.length, sample:track.sample, halfWidthAt:track.halfWidthAt,
      createScene:(app:pc.Application)=>createLandScene(app,track),
      placeKart:(entity:pc.Entity,distance:number,lateral:number,angle=0)=>placeLandKart(entity,track,distance,lateral,angle)};
  }
  return {id:'coast' as MapId,profile:resolveMap('coast'),cameraObstacles:[] as readonly CameraObstacle[],track:null as LandTrack|null,routes:null as ForkCourse|null,length:LENGTH,sample,halfWidthAt,
    createScene:createCoastScene,placeKart:placeCoastKart};
}
/** Model +Z faces the tangent; the local up follows real grade AND camber. */
export function placeLandKart(entity:pc.Entity,track:LandTrack,distance:number,lateral:number,angle=0) {
  return placeLandFrame(entity,track.sample(distance,lateral),angle);
}
export function placeLandFrame(entity:pc.Entity,frame:LandSample,angle=0) {
  const up=frame.normal??new pc.Vec3().cross(frame.t,frame.n).normalize();
  const forward=frame.t.clone().normalize(),right=new pc.Vec3().cross(up,forward).normalize();
  const matrix=new pc.Mat4();
  matrix.data.set([right.x,right.y,right.z,0,up.x,up.y,up.z,0,forward.x,forward.y,forward.z,0,0,0,0,1]);
  const rotation=new pc.Quat().setFromMat4(matrix).mul(new pc.Quat().setFromEulerAngles(0,angle*180/Math.PI,0));
  entity.setPosition(frame.p.clone().add(up.clone().mulScalar(.11)));
  entity.setRotation(rotation);
  return frame;
}
