import {SAMPLE_LENGTH} from './waterpark-design';
export const WATER_HANDLING=Object.freeze({maxSpeed:22,acceleration:8.6,brake:15,drag:.18,lateralAcceleration:11,lateralDrag:3.1,bankLimit:9.8});
export type WaterInput={throttle:boolean;brake:boolean;steer:number};
export type WaterState={distance:number;lane:number;speed:number;lateralSpeed:number;elapsed:number;finished:boolean;bankHit:boolean};
export function newWaterState():WaterState{return{distance:0,lane:0,speed:0,lateralSpeed:0,elapsed:0,finished:false,bankHit:false};}
export function stepWaterMotion(state:WaterState,input:WaterInput,delta:number,options?:{maxSpeed?:number;acceleration?:number;steering?:number;finishDistance?:number}):WaterState{
 if(state.finished)return{...state};const dt=Math.min(.05,Math.max(0,Number.isFinite(delta)?delta:0)),s={...state,bankHit:false};
 const steer=Number.isFinite(input.steer)?Math.max(-1,Math.min(1,input.steer)):0;
 s.elapsed+=dt;
 const thrust=input.brake?-WATER_HANDLING.brake:input.throttle?(options?.acceleration??WATER_HANDLING.acceleration):0;
 s.speed=Math.max(0,Math.min(options?.maxSpeed??WATER_HANDLING.maxSpeed,(s.speed+thrust*dt)*Math.exp(-WATER_HANDLING.drag*dt)));
 // A water mount carries lateral momentum; releasing steering gradually settles it.
 const authority=Math.min(1,s.speed/6);
 s.lateralSpeed=(s.lateralSpeed+steer*(options?.steering??WATER_HANDLING.lateralAcceleration)*authority*dt)*Math.exp(-WATER_HANDLING.lateralDrag*dt);
 s.lane+=s.lateralSpeed*dt;
 if(Math.abs(s.lane)>WATER_HANDLING.bankLimit){s.lane=Math.sign(s.lane)*WATER_HANDLING.bankLimit;s.lateralSpeed*=-.2;s.speed*=.96;s.bankHit=true;}
 s.distance=Math.min(options?.finishDistance??SAMPLE_LENGTH,s.distance+s.speed*dt);
 if(s.distance>=(options?.finishDistance??SAMPLE_LENGTH)){s.finished=true;s.speed=0;s.lateralSpeed=0;}
 return s;
}
