import {SAMPLE_LENGTH} from './waterpark-design';
import {RULES} from './npc-tactics';

export const WATER_HANDLING=Object.freeze({
 maxSpeed:22,acceleration:8.6,brake:15,drag:.18,lateralAcceleration:11,lateralDrag:3.1,bankLimit:9.8,
 reverseRatio:.3,reverseAcceleration:.65,slideSpeedRatio:.76,slideLateralDrag:1.65,
 slideSteering:1.14,slideMinSpeedRatio:.4,slideMinCharge:.6,slideMaxCharge:1.6,
});
/** Optional additions keep the original sample's throttle/brake/steer API valid. */
export type WaterInput={throttle:boolean;brake:boolean;steer:number;reverse?:boolean;drift?:boolean};
export type WaterState={distance:number;lane:number;speed:number;lateralSpeed:number;elapsed:number;finished:boolean;bankHit:boolean;drifting:boolean;charge:number;slideBoost:number};
export type WaterMotionOptions={maxSpeed?:number;acceleration?:number;steering?:number;finishDistance?:number};
export function newWaterState():WaterState{return{distance:0,lane:0,speed:0,lateralSpeed:0,elapsed:0,finished:false,bankHit:false,drifting:false,charge:0,slideBoost:0};}
const approach=(value:number,target:number,amount:number)=>value<target?Math.min(target,value+amount):Math.max(target,value-amount);
/** Signed travel, including the earned slide boost. Boost never accelerates reverse. */
export function waterMotionTravelSpeed(state:WaterState,maxSpeed:number=WATER_HANDLING.maxSpeed){
 if(state.finished)return 0;
 return Math.max(-Math.min(11,maxSpeed*WATER_HANDLING.reverseRatio),Math.min(maxSpeed,state.speed))*(state.speed>0&&state.slideBoost>0?RULES.boostFactor:1);
}
export function stepWaterMotion(state:WaterState,input:WaterInput,delta:number,options?:WaterMotionOptions):WaterState{
 const dt=Math.min(.05,Math.max(0,Number.isFinite(delta)?delta:0));
 if(state.finished||dt===0)return{...state};
 const s={...state,bankHit:false},maxSpeed=options?.maxSpeed??WATER_HANDLING.maxSpeed,acceleration=options?.acceleration??WATER_HANDLING.acceleration;
 const steer=Number.isFinite(input.steer)?Math.max(-1,Math.min(1,input.steer)):0;
 const stopping=input.brake||(input.throttle&&input.reverse);
 let forwardLimit=maxSpeed;
 s.elapsed+=dt;s.slideBoost=Math.max(0,s.slideBoost-dt);
 const sliding=!!input.drift&&!!steer&&!stopping&&!input.reverse&&s.speed>maxSpeed*WATER_HANDLING.slideMinSpeedRatio;
 if(sliding)s.charge=Math.min(WATER_HANDLING.slideMaxCharge,s.charge+dt);
 else {
  // Braking, reverse, slowing down or abandoning the turn cancels the charge.
  // Only releasing Shift earns the forward boost; it cannot be farmed at rest.
  if(s.drifting&&!input.drift&&!stopping&&!input.reverse&&s.speed>maxSpeed*WATER_HANDLING.slideMinSpeedRatio&&s.charge>WATER_HANDLING.slideMinCharge){
   s.slideBoost=Math.max(s.slideBoost,Math.min(2.5,s.charge*1.5));
  }
  s.charge=0;
 }
 s.drifting=sliding;
 if(stopping)s.speed=approach(s.speed,0,WATER_HANDLING.brake*dt);
 else if(input.reverse){
  // S first stops forward movement, and only then starts moving backwards.
  s.speed=s.speed>0?approach(s.speed,0,WATER_HANDLING.brake*dt):s.speed-acceleration*WATER_HANDLING.reverseAcceleration*dt;
 }else if(input.throttle){
  if(s.speed<0)s.speed=approach(s.speed,0,WATER_HANDLING.brake*dt);
  else {
   const target=maxSpeed*(input.drift?WATER_HANDLING.slideSpeedRatio:1);
   if(s.speed>target)s.speed=approach(s.speed,target,WATER_HANDLING.brake*.6*dt);
   else {s.speed+=acceleration*dt;forwardLimit=target;}
  }
 }
 s.speed=Math.max(-Math.min(11,maxSpeed*WATER_HANDLING.reverseRatio),Math.min(forwardLimit,s.speed*Math.exp(-WATER_HANDLING.drag*dt)));
 // Water keeps lateral momentum after steering release. Reverse changes steering
 // direction naturally; Shift opens a controlled, more persistent water slide.
 const authority=Math.max(-1,Math.min(1,s.speed/6));
 const lateralDrag=s.drifting?WATER_HANDLING.slideLateralDrag:WATER_HANDLING.lateralDrag;
 s.lateralSpeed=(s.lateralSpeed+steer*(options?.steering??WATER_HANDLING.lateralAcceleration)*authority*(s.drifting?WATER_HANDLING.slideSteering:1)*dt)*Math.exp(-lateralDrag*dt);
 s.lane+=s.lateralSpeed*dt;
 if(Math.abs(s.lane)>WATER_HANDLING.bankLimit){
  s.lane=Math.sign(s.lane)*WATER_HANDLING.bankLimit;s.lateralSpeed*=-.2;s.speed*=.96;s.bankHit=true;
  s.drifting=false;s.charge=0;
 }
 const finish=options?.finishDistance??SAMPLE_LENGTH,travel=waterMotionTravelSpeed(s,maxSpeed)*dt;
 s.distance=Math.min(finish,s.distance+travel);
 if(s.distance>=finish){
  s.elapsed=state.elapsed+dt*Math.max(0,Math.min(1,(finish-state.distance)/Math.max(1e-9,travel)));
  s.finished=true;s.speed=0;s.lateralSpeed=0;s.drifting=false;s.charge=0;s.slideBoost=0;
 }
 return s;
}
