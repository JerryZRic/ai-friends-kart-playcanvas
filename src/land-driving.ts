import {stepRaceKartSpeed} from './kart-race';
import type {LandTrack} from './land-track';
import {RULES} from './npc-tactics';
import {clamp} from './track';

/** Same inputs and force terms for player and NPC. Circuit support is kinematic:
 * distance + lateral, with gravity/rolling losses, not a free-body suspension. */
export function stepLandSpeed(track:LandTrack|null,distance:number,speed:number,input:Parameters<typeof stepRaceKartSpeed>[1],dt:number,
  tuning:Parameters<typeof stepRaceKartSpeed>[3],boost:number,slow:number,offroad=false) {
  const launchSpeed=track&&input.throttle&&!input.reverse&&!input.brake&&speed<0&&speed>-.15?0:speed;
  const driven=stepRaceKartSpeed(launchSpeed,input,dt,tuning,boost,slow,offroad);
  if(!track)return driven;
  const surface=track.surfaceAt(distance),t=track.sample(distance).t;
  const gravity=-9.81*t.y;
  const rolling=Math.max(0,surface.rollingResistance)*.015*9.81;
  // Brake holds a stationary kart on a grade; throttle still feels hill load.
  if(input.brake&&Math.abs(driven)<Math.abs(gravity)*dt+.05)return 0;
  const drag=Math.min(Math.abs(driven),rolling*dt);
  const next=driven-Math.sign(driven)*drag+gravity*dt;
  return Number.isFinite(next)?clamp(next,-14,tuning.maxSpeed*(boost>0?RULES.boostFactor:1)*1.06):0;
}
export function landSteeringGrip(track:LandTrack|null,distance:number) {
  return track?clamp(track.surfaceAt(distance).grip,.45,1.15):1;
}
export function landBankDrift(track:LandTrack|null,distance:number,speed:number,dt:number) {
  if(!track||Math.abs(speed)<.5)return 0;
  const frame=track.sample(distance);
  return -9.81*frame.n.y*dt*clamp(Math.abs(speed)/30,0,1)*.18;
}
/** Multiple signed samples retain the strongest upcoming bend through an S,
 * where a start/end-only heading test could incorrectly see a straight. */
export function landLookAheadBend(track:LandTrack,distance:number,lookAhead:number) {
  let strongest=0;
  for(const fraction of [0,.35,.7]) {
    const a=track.sample(distance+lookAhead*fraction).t,b=track.sample(distance+lookAhead*(fraction+.65)).t;
    const turn=Math.atan2(a.x*b.z-a.z*b.x,a.x*b.x+a.z*b.z);
    if(Math.abs(turn)>Math.abs(strongest))strongest=turn;
  }
  return clamp(strongest,-1,1);
}
