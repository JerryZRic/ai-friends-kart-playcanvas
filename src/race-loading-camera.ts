import type {RaceVector} from './race-camera';

export type LoadingCameraPose = {position:RaceVector;look:RaceVector;fov?:number};
export type LoadingCameraTrack = {length:number;sample:(distance:number)=>{p:RaceVector}};
export const LOADING_FLIGHT_SPEED = 22;
export const LOADING_FLIGHT_HEIGHT = 46;
export const LOADING_RETURN_SECONDS = 1.15;
const copy=(v:RaceVector)=>({...v});
const mix=(a:RaceVector,b:RaceVector,t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});

/** Pure shared cinematic. Race clocks and input stay blocked until phase=ready.
 * No wall-clock timers: hidden/unfocused pages freeze without skipping a return. */
export function createLoadingCamera(track:LoadingCameraTrack) {
  let distance=0,elapsed=0,disposed=false,phase:'flyover'|'return'|'ready'='flyover';
  const sample=(d:number)=>track.sample(((d%track.length)+track.length)%track.length).p;
  function flight():Required<LoadingCameraPose>{
    const ground=sample(distance),behind=sample(distance-18),ahead=sample(distance+22);
    return {position:{x:behind.x,y:ground.y+LOADING_FLIGHT_HEIGHT,z:behind.z},look:{x:ahead.x,y:ahead.y,z:ahead.z},fov:54};
  }
  let pose=flight(),from=pose,target=pose;
  return {
    get phase(){return phase;},
    beginReturn(destination:LoadingCameraPose, source?:LoadingCameraPose){
      if(disposed||phase==='return')return;
      from={position:copy(source?.position??pose.position),look:copy(source?.look??pose.look),fov:source?.fov??pose.fov};
      target={position:copy(destination.position),look:copy(destination.look),fov:destination.fov??56};
      elapsed=0;phase='return';
    },
    step(dt:number,active=true){
      const step=active&&!disposed&&Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
      if(phase==='flyover'){distance=(distance+step*LOADING_FLIGHT_SPEED)%track.length;pose=flight();}
      else if(phase==='return'){
        elapsed=Math.min(LOADING_RETURN_SECONDS,elapsed+step);
        const t=elapsed/LOADING_RETURN_SECONDS,ease=t*t*t*(t*(t*6-15)+10);
        pose={position:mix(from.position,target.position,ease),look:mix(from.look,target.look,ease),fov:from.fov+(target.fov-from.fov)*ease};
        if(elapsed>=LOADING_RETURN_SECONDS){phase='ready';pose={position:copy(target.position),look:copy(target.look),fov:target.fov};}
      }
      return {position:copy(pose.position),look:copy(pose.look),fov:pose.fov,phase};
    },
    reset(){if(disposed)return;distance=elapsed=0;phase='flyover';pose=flight();},
    dispose(){disposed=true;},
  };
}
