import {clearInventory,type ItemSlot} from './item-inventory';
import {COAST_DRIFT,coastDriftReady,coastDriftBoost} from './coast-race-feedback';
import {npcDriving,type NpcSkill} from './npc-difficulty';
import {RULES,tickEffects,tickBrain,planLane,chooseItemSlot,activateItem,moveLane,nearbyGap,type Combatant,type Brain,type RacingPickup,type PickupReachability} from './npc-tactics';
import {advanceLapProgress,type LandTrack,type LandLapProgress} from './land-track';
import {stepLandSpeed,landLookAheadBend,landSteeringGrip,landBankDrift,landRailScrape} from './land-driving';
import type {createLandRaceRoute} from './land-race-route';
import {clamp} from './track';

/** Driving state only. The browser may add meshes and the balance runner may
 * add a characterId; id identifies the race seat for routes and interaction ties. */
export type LandCpuActor = Combatant & Brain & {
  phase:number; driving:boolean; cornerPace:number; aiBend:number;
  driftCharge:number; driftCooldown:number; aiDrifting:boolean; finishedAt:number|null;
};
export type LandCpuTuning = {maxSpeed:number;multipliers:{acceleration:number;steering:number}};
export interface LandCpuContext {
  /** Experimental pickup targeting only; normal races keep the legacy planner. */
  pickupPlanning?:'legacy'|'execution-matched';
  length:number;
  track:LandTrack|null;
  sample:(distance:number,lateral?:number)=>{t:{x:number;y:number;z:number}};
  halfWidthAt:(distance:number)=>number;
  routes:ReturnType<typeof createLandRaceRoute>|null;
  progress:Map<string,LandLapProgress>;
  skill:NpcSkill;
  tuning:(id:string,distance:number,speed:number)=>LandCpuTuning;
}
/** elapsed is the END of the accepted simulation step, as in the browser. */
export interface LandCpuFrame {dt:number;elapsed:number}
export interface LandCpuFeedback {
  /** Overrides activation as well as feedback. Omit for normal CPU activation. */
  useItem?:(actor:LandCpuActor,racers:readonly Combatant[],slot?:ItemSlot)=>void;
  finished?:(actor:LandCpuActor)=>void;
  /** Observes existing progress guards; never changes integration or lap credit. */
  rejectedStep?:(actor:LandCpuActor,reason:string)=>void;
  /** Read-only estimates for eligible boxes, before traffic filtering. */
  pickupReachability?:(actor:LandCpuActor,box:RacingPickup,estimate:PickupReachability)=>void;
  railContact?:(actor:LandCpuActor,lateral:number)=>void;
}
const actorTrack=(b:LandCpuActor,c:LandCpuContext)=>c.routes?.states.has(b.id)?c.routes.view(b.id,b.total):c.track;
const actorLimit=(b:LandCpuActor,c:LandCpuContext,margin:number,ahead=0)=>c.routes?.states.has(b.id)?c.routes.limit(b.id,ahead,margin):c.halfWidthAt(b.total+ahead)-margin;

export const landCpuFinished=(b:LandCpuActor,c:LandCpuContext)=>c.routes?!!c.routes.get(b.id)?.finished:b.total>=c.length*3&&(!c.track||(c.progress.get(b.id)?.laps??0)>=3);

/** Call for every actor before deciding for any actor. Item attacks therefore
 * retain the browser's original same-frame effect/decision ordering. */
export function tickLandCpu(b:LandCpuActor,dt:number) {tickEffects(b,dt);tickBrain(b,dt);}

export function activateLandCpuItem(b:LandCpuActor,racers:readonly Combatant[],c:LandCpuContext,slot:ItemSlot=0) {
  const result=activateItem(b,racers,c.length,c.routes?.interactions,slot);
  if(result){b.uses++;b.cooldown=RULES.cooldown;if(result.item==='pulse')b.pulseFlash=.65;}
  return result;
}

/** Extracted from the normal game NPC decision loop without changing timings,
 * road sampling, lane planning or item decisions. */
export function decideLandCpu(b:LandCpuActor,racers:readonly Combatant[],boxes:readonly RacingPickup[],c:LandCpuContext,{dt,elapsed}:LandCpuFrame,feedback:LandCpuFeedback={}) {
  if(landCpuFinished(b,c)){b.finishedAt??=elapsed-dt;clearInventory(b);b.boost=b.shield=b.slow=b.pulseFlash=0;feedback.finished?.(b);return;}
  const {routes,skill}=c;
  if(routes)routes.npcChoice(b.id);
  if(b.decisionIn<=0){
    b.decisionIn=skill.decision+b.phase*.015;
    const road=actorTrack(b,c),a=(routes?.states.has(b.id)?routes.sample(b.id,0):c.sample(b.total)).t,z=routes?routes.sampleAhead(b.id,skill.lookAhead).t:c.sample(b.total+skill.lookAhead).t,bend=road?landLookAheadBend(road,b.total,skill.lookAhead):a.x*z.z-a.z*z.x;b.aiBend=bend;
    const safeLane=Math.min(actorLimit(b,c,.8),actorLimit(b,c,.8,22));
    const pickupPlanning=c.pickupPlanning==='execution-matched'||feedback.pickupReachability?{
      mode:c.pickupPlanning,
      lateralMultiplier:c.tuning(b.id,b.total,b.speed).multipliers.steering*landSteeringGrip(road,b.total),
      observe:feedback.pickupReachability?(box:RacingPickup,estimate:PickupReachability)=>feedback.pickupReachability!(b,box,estimate):undefined,
    }:undefined;
    b.targetLane=clamp(planLane(b,racers,boxes,c.length,b.phase,bend,skill,routes?.interactions,pickupPlanning),-safeLane,safeLane);
    const itemSlot=chooseItemSlot(b,racers,c.length,bend,skill,routes?.interactions);
    if(itemSlot!==null){
      if(feedback.useItem)feedback.useItem(b,racers,itemSlot);else activateLandCpuItem(b,racers,c,itemSlot);
    }
  }
}

/** Call after all actors have decided. Player-only steering, collision losses
 * and race-end truncation intentionally remain outside this CPU controller. */
export function advanceLandCpu(b:LandCpuActor,c:LandCpuContext,{dt,elapsed}:LandCpuFrame,feedback:LandCpuFeedback={}) {
  if(landCpuFinished(b,c))return;
  const {routes,skill}=c,tuning=c.tuning(b.id,b.total,b.speed),road=actorTrack(b,c);
  if(routes?.nearFork(b.id)){const selected=routes.npcChoice(b.id);b.targetLane=selected==='alley'?2.8:-2.8;}
  b.driftCooldown=Math.max(0,b.driftCooldown-dt);
  const control=npcDriving(b.speed,tuning.maxSpeed*(b.boost>0?RULES.boostFactor:1)*(b.slow>0?RULES.slowFactor:1),b.aiBend,skill,b.driftCharge,b.targetLane-b.lateral);
  control.handbrake=control.drift=control.drift&&b.driftCooldown===0;
  if(control.drift)b.driftCharge=Math.min(COAST_DRIFT.maxCharge,b.driftCharge+dt);
  else {if(b.aiDrifting){if(!control.brake&&coastDriftReady(b.driftCharge))b.boost=Math.max(b.boost,coastDriftBoost(b.driftCharge));b.driftCooldown=2;}b.driftCharge=0;}
  b.aiDrifting=control.drift;
  if(b.driving)b.speed=stepLandSpeed(road,b.total,b.speed,control,dt,tuning,b.boost,b.slow,Math.abs(b.lateral)>actorLimit(b,c,.9));
  if(routes){
    const attempted=moveLane(b.lateral,b.targetLane,dt*tuning.multipliers.steering*landSteeringGrip(road,b.total))+landBankDrift(road,b.total,b.speed,dt);
    const rail=landRailScrape(b.speed,attempted,actorLimit(b,c,.8),dt);b.speed=rail.speed;if(rail.contact)feedback.railContact?.(b,rail.lateral);b.lateral=rail.lateral;
    const selected=routes.npcChoice(b.id)==='alley'&&b.lateral>.35?'alley':'boulevard';const progress=routes.advance(b.id,b.speed*dt,dt,b.lateral,selected);b.total=progress.total;if(!progress.accepted){b.speed=0;feedback.rejectedStep?.(b,progress.reason??'unknown');}if(progress.finishFraction!==undefined)b.finishedAt=elapsed-dt+dt*progress.finishFraction;
    b.lateral=clamp(b.lateral,-actorLimit(b,c,.8),actorLimit(b,c,.8));routes.setLane(b.id,b.lateral);
  }else{
    // Keep the established coast/mountain order: progress before lane movement.
    const travel=b.speed*dt,before=b.total;b.total=Math.min(c.length*3,b.total+travel);
    if(c.track){const progress=advanceLapProgress(c.track,c.progress.get(b.id)!,b.total,dt,b.lateral);c.progress.set(b.id,progress.state);if(!progress.accepted){feedback.rejectedStep?.(b,progress.reason??'unknown');if(progress.reason!=='off-road'){b.total=progress.state.distance;b.speed=0;}}}
    if(landCpuFinished(b,c))b.finishedAt=elapsed-dt+dt*(c.length*3-before)/Math.max(travel,1e-9);
    b.lateral=clamp(moveLane(b.lateral,b.targetLane,dt*tuning.multipliers.steering*landSteeringGrip(c.track,b.total)),-actorLimit(b,c,.8),actorLimit(b,c,.8));
  }
  if(landCpuFinished(b,c)){clearInventory(b);b.boost=b.shield=b.slow=b.bump=b.reaction=b.cooldown=b.decisionIn=b.pulseFlash=0;feedback.finished?.(b);}
}

export function landActorsCollide(a:Combatant,b:Combatant,c:LandCpuContext) {
  return c.routes?c.routes.collides(a,b):Math.abs(nearbyGap(a.total,b.total,c.length))<2.9&&Math.abs(a.lateral-b.lateral)<1.85;
}

/** CPU contact has its own bounded timer. Never apply the player's .77 speed
 * multiplier or .55 lane displacement to an all-CPU seat. */
export function collideLandCpu(b:LandCpuActor,racers:readonly Combatant[],c:LandCpuContext) {
  if(landCpuFinished(b,c))return;
  if(b.bump<=0&&b.shield<=0&&racers.some(r=>r.id!==b.id&&landActorsCollide(b,r,c))){b.slow=Math.max(b.slow,.55);b.bump=.8;}
}
