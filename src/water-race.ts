/** Deterministic fixed-step race rules. Rendering, wall time and loading cannot advance a race. */
import { raceOrder } from './driver-roster.js';
import { characterTuning } from './character-profiles';
import { newWaterState, stepWaterMotion, type WaterInput, type WaterState } from './waterpark-motion';
import { WATER_RACE_LENGTH } from './waterpark-design';
import { activateItem, collectPickups, chooseItem, newBrain, planLane, nearbyGap, racingSpeed, RULES, tickBrain, tickEffects, type Brain, type Combatant, type RacingPickup } from './npc-tactics';
import { advancePickup, resetPickup } from './item-pickups';
export const WATER_LAPS=3, WATER_CHECKPOINTS=8, WATER_COUNTDOWN=3;
export type WaterRacer=Combatant & Brain & {motion:WaterState;checkpoint:number;finishTime:number|null;phase:number;warning:number};
export type WaterRace={racers:WaterRacer[];countdown:number;elapsed:number;finished:boolean;remainder:number;seed:number;announcements:string[]};
/** Actual forward travel speed, shared by movement, HUD, wake and rider animation. */
export function waterTravelSpeed(racer:WaterRacer){return racer.finishTime!==null?0:racingSpeed(racer,characterTuning(racer.id,'waterpark').maxSpeed);}
export function newWaterRace(selected:string):WaterRace {
 return {racers:raceOrder(selected).map((d,i)=>({...newBrain(i,(i%3-1)*4),id:d.id,total:-5*Math.floor(i/3)||0,lateral:(i%3-1)*4,speed:0,held:null,boost:0,shield:0,slow:0,motion:{...newWaterState(),distance:-5*Math.floor(i/3)||0,lane:(i%3-1)*4},checkpoint:0,finishTime:null,phase:i,warning:0})),countdown:WATER_COUNTDOWN,elapsed:0,finished:false,remainder:0,seed:47291,announcements:[]};
}
export function raceRandom(r:WaterRace){r.seed=(Math.imul(r.seed,1664525)+1013904223)>>>0;return r.seed/4294967296;}
/** Sequential forward gates, never lap-count from modulo distance. Reverse and
 * re-crossing a seam cannot create credit; impossible teleports get no gates. */
export function advanceWaterCheckpoints(r:Pick<WaterRacer,'checkpoint'>,previous:number,total:number){
 const gap=WATER_RACE_LENGTH/WATER_CHECKPOINTS;
 if(total<=previous||total-previous>gap)return;
 while(r.checkpoint<WATER_LAPS*WATER_CHECKPOINTS){const gate=(r.checkpoint+1)*gap;if(previous>gate+1e-7||total<gate)break;r.checkpoint++;}
}
export function waterStandings(race:WaterRace){return [...race.racers].sort((a,b)=>a.finishTime!==null&&b.finishTime!==null?a.finishTime-b.finishTime||a.id.localeCompare(b.id):a.finishTime!==null?-1:b.finishTime!==null?1:b.total-a.total||a.id.localeCompare(b.id));}
export function useWaterItem(race:WaterRace,racer:WaterRacer){
 if(racer.finishTime!==null||race.countdown>0||race.finished)return;
 const result=activateItem(racer,race.racers.filter(r=>r.finishTime===null),WATER_RACE_LENGTH);
 if(result){racer.uses++;racer.cooldown=RULES.cooldown;racer.pulseFlash=result.item==='pulse'?.8:0;race.announcements.push(`${racer.id} 使用${result.item==='boost'?'加速':result.item==='shield'?'护盾':'脉冲'}${result.target?` → ${result.target.id}${result.blocked?'（护盾抵挡）':''}`:''}`);if(race.announcements.length>4)race.announcements.shift();}
}
export function resetWaterPickups(race:WaterRace,boxes:readonly RacingPickup[]){for(const box of boxes)resetPickup(box,()=>raceRandom(race));}
function tick(race:WaterRace,input:WaterInput,dt:number,boxes:readonly RacingPickup[]){
 if(race.finished)return;
 if(race.countdown>0){const waiting=Math.min(dt,race.countdown);race.countdown-=waiting;dt-=waiting;if(race.countdown<1e-9)race.countdown=0;if(dt<1e-9)return;}
 const beforeTime=race.elapsed;race.elapsed+=dt;
 for(const b of boxes)advancePickup(b,dt,()=>raceRandom(race));
 const active=race.racers.filter(r=>r.finishTime===null);
 const previous=active.map(actor=>({actor,previous:actor.total,previousLane:actor.lateral,onPickup:()=>{actor.pickups++;actor.reaction=RULES.reaction;}}));
 for(const racer of active){
  tickEffects(racer,dt);tickBrain(racer,dt);const wasWarning=racer.warning;racer.warning=Math.max(0,racer.warning-dt);
  const tuning=characterTuning(racer.id,'waterpark');
  let control=input;
  if(racer!==race.racers[0]){
   if(racer.decisionIn<=0){racer.targetLane=planLane(racer,active,boxes,WATER_RACE_LENGTH,racer.phase,.1);racer.decisionIn=.2;}
   const steer=Math.max(-1,Math.min(1,(racer.targetLane-racer.lateral)*1.3-racer.motion.lateralSpeed*.5));
   control={throttle:true,brake:false,steer};
   if(wasWarning>0&&racer.warning===0){useWaterItem(race,racer);racer.warning=0;}
   else if(racer.warning===0&&chooseItem(racer,active,WATER_RACE_LENGTH,.1))racer.warning=.5;
  }
  const old=racer.total;
  const next=stepWaterMotion(racer.motion,control,dt,{...tuning,finishDistance:Infinity});
  racer.speed=next.speed;
  next.distance=old+waterTravelSpeed(racer)*dt;
  racer.motion=next;racer.total=next.distance;racer.lateral=next.lane;
  advanceWaterCheckpoints(racer,old,racer.total);
  if(racer.checkpoint===WATER_CHECKPOINTS*WATER_LAPS){const line=WATER_RACE_LENGTH*WATER_LAPS;racer.finishTime=beforeTime+dt*(line-old)/Math.max(1e-9,racer.total-old);racer.total=line;racer.motion.distance=line;racer.motion.speed=0;racer.speed=0;racer.motion.lateralSpeed=0;racer.motion.finished=true;}
 }
 // Symmetric local contact response, no AI privilege, no finished-line obstacles.
 for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
  const a=active[i],b=active[j];if(a.finishTime!==null||b.finishTime!==null||a.bump>0||b.bump>0)continue;
  if(Math.abs(nearbyGap(a.total,b.total,WATER_RACE_LENGTH))<2.5&&Math.abs(a.lateral-b.lateral)<1.55){
   const direction=a.lateral===b.lateral?(a.id.localeCompare(b.id)<0?-1:1):Math.sign(a.lateral-b.lateral);
   for(const [r,sign] of [[a,direction],[b,-direction]] as const){r.bump=.65;if(r.shield<=0){r.motion.speed*=.90;r.speed=r.motion.speed;r.motion.lateralSpeed+=sign*1.5;}}
  }
 }
 collectPickups(previous.filter(r=>r.actor.finishTime===null),boxes,WATER_RACE_LENGTH,()=>raceRandom(race));
 race.finished=race.racers.every(r=>r.finishTime!==null);
}
/** Accumulate rather than truncate ordinary deltas at 120Hz. A >10s suspension
 * does no work; the browser UI pauses at >1s and requires explicit resume. */
export function advanceWaterRace(race:WaterRace,input:WaterInput,delta:number,boxes:readonly RacingPickup[]=[]){
 if(!Number.isFinite(delta)||delta<=0||delta>10||race.finished)return;
 race.remainder+=delta;const step=1/120;
 while(race.remainder+1e-10>=step){tick(race,input,step,boxes);race.remainder-=step;}
}
