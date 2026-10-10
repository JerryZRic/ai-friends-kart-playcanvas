/** One kart runtime; large scenery modules load only for the selected course. */
import * as pc from 'playcanvas';
import {createCoastScene, placeKart as placeCoastKart} from './scene';
import {LENGTH, sample, halfWidthAt} from './track';
import {townPickupRows,quarryPickupRows,forestPickupRows,workshopPickupRows} from './land-course-pickups';
import {resolveMap, type MapId} from './map-profiles';
import type {LandTrack,LandSample} from './land-track';
export type {CameraBlocker as CameraObstacle} from './land-camera';
import type {CameraBlocker as CameraObstacle} from './land-camera';
import type {ForkCourse} from './land-routes';

export async function loadLandCourse(search: string) {
  const requested=resolveMap(new URLSearchParams(search).get('map'));
  const mapId: MapId=requested.vehicle==='kart'?requested.id:'coast';
  if(mapId==='town'||mapId==='quarry'||mapId==='forest'||mapId==='workshop') {
    // Each importer stays explicit so production splits the large scenery. A
    // single adapter feeds all original forks into the same kart runtime.
    const definition=mapId==='town'
      ? Promise.all([import('./maps/town'),import('./town-scenery')]).then(([map,scene])=>({track:map.TOWN_TRACK,routes:map.TOWN_COURSE,geometry:scene.buildTownSceneGeometry(map.TOWN_COURSE),theme:scene.TOWN_SCENE_THEME,pickups:townPickupRows(map.TOWN_COURSE)}))
      : mapId==='quarry' ? Promise.all([import('./maps/quarry'),import('./quarry-scenery')]).then(([map,scene])=>({track:map.QUARRY_TRACK,routes:map.QUARRY_COURSE,geometry:scene.buildQuarrySceneGeometry(map.QUARRY_COURSE),theme:scene.QUARRY_SCENE_THEME,pickups:quarryPickupRows(map.QUARRY_COURSE)}))
      : mapId==='forest' ? Promise.all([import('./maps/forest'),import('./forest-scenery')]).then(([map,scene])=>({track:map.FOREST_TRACK,routes:map.FOREST_COURSE,geometry:scene.buildForestSceneGeometry(map.FOREST_COURSE),theme:scene.FOREST_SCENE_THEME,pickups:forestPickupRows(map.FOREST_COURSE)}))
      : Promise.all([import('./maps/workshop'),import('./workshop-scenery')]).then(([map,scene])=>({track:map.WORKSHOP_TRACK,routes:map.WORKSHOP_COURSE,geometry:scene.buildWorkshopSceneGeometry(map.WORKSHOP_COURSE),theme:scene.WORKSHOP_SCENE_THEME,pickups:workshopPickupRows(map.WORKSHOP_COURSE)}));
    const [{track,routes,geometry,theme,pickups},{createLandScene}]=await Promise.all([definition,import('./land-scene')]);
    const labels=routes.presentation?.branchLabels??{alley:'支线',boulevard:'主路'};
    return {id:mapId,profile:resolveMap(mapId),track,routes:routes as ForkCourse|null,length:track.length,sample:track.sample,halfWidthAt:track.halfWidthAt,
      forkHint:`← A / 左键：${labels.alley} · D / 右键 →：${labels.boulevard}（默认）`,cameraObstacles:geometry.cameraObstacles,
      createScene:(app:pc.Application)=>createLandScene(app,track,{geometry,theme,pickups}),
      placeKart:(entity:pc.Entity,distance:number,lateral:number,angle=0)=>placeLandKart(entity,track,distance,lateral,angle)};
  }
  if(mapId==='mountain') {
    const [{MOUNTAIN_TRACK:track},{createLandScene}]=await Promise.all([import('./maps/mountain'),import('./land-scene')]);
    return {id:mapId,profile:resolveMap(mapId),forkHint:'',cameraObstacles:[] as readonly CameraObstacle[],track, routes:null as ForkCourse|null, length:track.length, sample:track.sample, halfWidthAt:track.halfWidthAt,
      createScene:(app:pc.Application)=>createLandScene(app,track),
      placeKart:(entity:pc.Entity,distance:number,lateral:number,angle=0)=>placeLandKart(entity,track,distance,lateral,angle)};
  }
  return {id:'coast' as MapId,profile:resolveMap('coast'),forkHint:'',cameraObstacles:[] as readonly CameraObstacle[],track:null as LandTrack|null,routes:null as ForkCourse|null,length:LENGTH,sample,halfWidthAt,
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
