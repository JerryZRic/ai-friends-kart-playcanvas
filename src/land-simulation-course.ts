/** Gameplay-only course data. No scenery, assets, DOM or graphics device. */
import {LENGTH,sample,halfWidthAt,COAST_PICKUPS} from './track';
import type {LandTrack} from './land-track';
import type {ForkCourse} from './land-routes';
import {townPickupRows,quarryPickupRows,forestPickupRows,workshopPickupRows,harvestPickupRows,desertPickupRows,snowPickupRows,calderaPickupRows,gardenPickupRows,airfieldPickupRows} from './land-course-pickups';
export const LAND_SIMULATION_MAPS=['coast','mountain','town','quarry','forest','workshop','harvest','desert','snow','caldera','garden','airfield'] as const;
export type LandSimulationMap=typeof LAND_SIMULATION_MAPS[number];
export interface LandSimulationCourse {
 id:LandSimulationMap; length:number; track:LandTrack|null; routes:ForkCourse|null;
 sample:typeof sample; halfWidthAt:(distance:number)=>number;
 pickups:readonly {d:number;lateral:number;edgeId?:string;s?:number}[];
}
const cache=new Map<LandSimulationMap,Promise<LandSimulationCourse>>();
export function loadLandSimulationCourse(id:LandSimulationMap):Promise<LandSimulationCourse> {
 if(!LAND_SIMULATION_MAPS.includes(id))throw new RangeError('Only land maps 01–12 are supported');
 if(cache.has(id))return cache.get(id)!;
 const pending=(async()=>{
  if(id==='coast')return {id,length:LENGTH,track:null,routes:null,sample,halfWidthAt,pickups:COAST_PICKUPS};
  if(id==='mountain') {const {MOUNTAIN_TRACK:track}=await import('./maps/mountain');return {id,length:track.length,track,routes:null,sample:track.sample,halfWidthAt:track.halfWidthAt,pickups:track.pickups};}
  const definitions={
   town:()=>import('./maps/town').then(m=>({track:m.TOWN_TRACK,routes:m.TOWN_COURSE,pickups:townPickupRows(m.TOWN_COURSE)})),
   quarry:()=>import('./maps/quarry').then(m=>({track:m.QUARRY_TRACK,routes:m.QUARRY_COURSE,pickups:quarryPickupRows(m.QUARRY_COURSE)})),
   forest:()=>import('./maps/forest').then(m=>({track:m.FOREST_TRACK,routes:m.FOREST_COURSE,pickups:forestPickupRows(m.FOREST_COURSE)})),
   workshop:()=>import('./maps/workshop').then(m=>({track:m.WORKSHOP_TRACK,routes:m.WORKSHOP_COURSE,pickups:workshopPickupRows(m.WORKSHOP_COURSE)})),
   harvest:()=>import('./maps/harvest').then(m=>({track:m.HARVEST_TRACK,routes:m.HARVEST_COURSE,pickups:harvestPickupRows(m.HARVEST_COURSE)})),
   desert:()=>import('./maps/desert').then(m=>({track:m.DESERT_TRACK,routes:m.DESERT_COURSE,pickups:desertPickupRows(m.DESERT_COURSE)})),
   snow:()=>import('./maps/snow').then(m=>({track:m.SNOW_TRACK,routes:m.SNOW_COURSE,pickups:snowPickupRows(m.SNOW_COURSE)})),
   caldera:()=>import('./maps/caldera').then(m=>({track:m.CALDERA_TRACK,routes:m.CALDERA_COURSE,pickups:calderaPickupRows(m.CALDERA_COURSE)})),
   garden:()=>import('./maps/garden').then(m=>({track:m.GARDEN_TRACK,routes:m.GARDEN_COURSE,pickups:gardenPickupRows(m.GARDEN_COURSE)})),
   airfield:()=>import('./maps/airfield').then(m=>({track:m.AIRFIELD_TRACK,routes:m.AIRFIELD_COURSE,pickups:airfieldPickupRows(m.AIRFIELD_COURSE)})),
  };
  const data=await definitions[id]();return {id,length:data.track.length,...data,sample:data.track.sample,halfWidthAt:data.track.halfWidthAt};
 })();cache.set(id,pending);return pending;
}
