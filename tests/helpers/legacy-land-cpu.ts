/** Independent reference copied from game.ts at published v1.0.1a
 * 33988b49dee01547238c08df4684cce93fae9497. Do not implement it using land-cpu.
 * Only rendering callbacks and the separate human collision path are omitted. */
import {RULES,tickEffects,tickBrain,planLane,chooseItem,activateItem,moveLane,nearbyGap,type Combatant,type RacingPickup} from '../../src/npc-tactics';
import {npcDriving} from '../../src/npc-difficulty';
import {COAST_DRIFT,coastDriftReady,coastDriftBoost} from '../../src/coast-race-feedback';
import {stepLandSpeed,landLookAheadBend,landSteeringGrip,landBankDrift,landRailScrape} from '../../src/land-driving';
import {advanceLapProgress} from '../../src/land-track';
import {clamp} from '../../src/track';
import type {LandCpuActor,LandCpuContext,LandCpuFrame} from '../../src/land-cpu';
export function legacyLandCpuFrame(bots:LandCpuActor[],racers:Combatant[],boxes:RacingPickup[],context:LandCpuContext,{dt,elapsed}:LandCpuFrame) {
const {length:LENGTH,routes,skill,progress:botProgress}=context,course={track:context.track},sample=context.sample,racerTuning=context.tuning;
const events:string[]=[];
const botFinished=(bot:LandCpuActor)=>routes?!!routes.get(bot.id)?.finished:bot.total>=LENGTH*3&&(!course.track||(botProgress.get(bot.id)?.laps??0)>=3);
const actorSample=(id:string,total:number,lateral=0)=>routes?.states.has(id)?routes.sample(id,lateral):sample(total,lateral);
const actorTrack=(id:string,total:number)=>routes?.states.has(id)?routes.view(id,total):course.track;
const actorLimit=(id:string,total:number,margin=.65,ahead=0)=>routes?.states.has(id)?routes.limit(id,ahead,margin):context.halfWidthAt(total+ahead)-margin;
const hideBotFX=(b:LandCpuActor)=>{events.push('finished:'+b.id);};
const emit=(_position:unknown)=>{events.push('rail');};
function useCombatItem(actor:Combatant,racers:Combatant[]) {
const result=activateItem(actor,racers,LENGTH,routes?.interactions);if(!result)return;
const bot=bots.find(b=>b.id===actor.id);
if(bot){bot.uses++;bot.cooldown=RULES.cooldown;if(result.item==='pulse')bot.pulseFlash=.65;}
}
for(const b of bots){tickEffects(b,dt);tickBrain(b,dt);}
for(const b of bots){
  if(botFinished(b)){b.finishedAt??=elapsed-dt;b.held=null;b.boost=b.shield=b.slow=b.pulseFlash=0;hideBotFX(b);continue;}
  if(routes)routes.npcChoice(b.id);
  if(b.decisionIn<=0){
    b.decisionIn=skill.decision+b.phase*.015;
    // Read the same road geometry used by player physics; no rank-based pace.
    const road=actorTrack(b.id,b.total),a=actorSample(b.id,b.total).t,z=routes?routes.sampleAhead(b.id,skill.lookAhead).t:sample(b.total+skill.lookAhead).t,bend=road?landLookAheadBend(road,b.total,skill.lookAhead):a.x*z.z-a.z*z.x; b.aiBend=bend;
    const safeLane=Math.min(actorLimit(b.id,b.total,.8),actorLimit(b.id,b.total,.8,22));
    b.targetLane=clamp(planLane(b,racers,boxes,LENGTH,b.phase,bend,skill,routes?.interactions),-safeLane,safeLane);
    if(chooseItem(b,racers,LENGTH,bend,skill,routes?.interactions))useCombatItem(b,racers);
  }
}
for(const b of bots){
  if(botFinished(b))continue;
  const tuning=racerTuning(b.id,b.total,b.speed),road=actorTrack(b.id,b.total);
  if(routes?.nearFork(b.id)){const selected=routes.npcChoice(b.id);b.targetLane=selected==='alley'?2.8:-2.8;}
  b.driftCooldown=Math.max(0,b.driftCooldown-dt);
  const control=npcDriving(b.speed,tuning.maxSpeed*(b.boost>0?RULES.boostFactor:1)*(b.slow>0?RULES.slowFactor:1),b.aiBend,skill,b.driftCharge,b.targetLane-b.lateral);
  control.handbrake=control.drift=control.drift&&b.driftCooldown===0;
  if(control.drift)b.driftCharge=Math.min(COAST_DRIFT.maxCharge,b.driftCharge+dt);
  else {if(b.aiDrifting){if(!control.brake&&coastDriftReady(b.driftCharge))b.boost=Math.max(b.boost,coastDriftBoost(b.driftCharge));b.driftCooldown=2;}b.driftCharge=0;}
  b.aiDrifting=control.drift;
  if(b.driving)b.speed=stepLandSpeed(road,b.total,b.speed,control,dt,tuning,b.boost,b.slow,Math.abs(b.lateral)>actorLimit(b.id,b.total,.9));
  if(routes){
    const attempted=moveLane(b.lateral,b.targetLane,dt*tuning.multipliers.steering*landSteeringGrip(road,b.total))+landBankDrift(road,b.total,b.speed,dt);
    const rail=landRailScrape(b.speed,attempted,actorLimit(b.id,b.total,.8),dt);b.speed=rail.speed;if(rail.contact)emit(undefined);b.lateral=rail.lateral;
    const selected=routes.npcChoice(b.id)==='alley'&&b.lateral>.35?'alley':'boulevard';const progress=routes.advance(b.id,b.speed*dt,dt,b.lateral,selected);b.total=progress.total;if(!progress.accepted)b.speed=0;if(progress.finishFraction!==undefined)b.finishedAt=elapsed-dt+dt*progress.finishFraction;
    b.lateral=clamp(b.lateral,-actorLimit(b.id,b.total,.8),actorLimit(b.id,b.total,.8));routes.setLane(b.id,b.lateral);
  }else{
    // Identity adapter retains the established coast/mountain integration order.
    const travel=b.speed*dt,before=b.total;b.total=Math.min(LENGTH*3,b.total+travel);
    if(course.track){const progress=advanceLapProgress(course.track,botProgress.get(b.id)!,b.total,dt,b.lateral);botProgress.set(b.id,progress.state);if(!progress.accepted&&progress.reason!=='off-road'){b.total=progress.state.distance;b.speed=0;}}
    if(botFinished(b))b.finishedAt=elapsed-dt+dt*(LENGTH*3-before)/Math.max(travel,1e-9);
    b.lateral=clamp(moveLane(b.lateral,b.targetLane,dt*tuning.multipliers.steering*landSteeringGrip(course.track,b.total)),-actorLimit(b.id,b.total,.8),actorLimit(b.id,b.total,.8));
  }
  if(botFinished(b)){b.held=null;b.boost=b.shield=b.slow=b.bump=b.reaction=b.cooldown=b.decisionIn=b.pulseFlash=0;hideBotFX(b);continue;}
}
for(const b of bots){
  if(botFinished(b))continue;
  if(b.bump<=0&&b.shield<=0&&racers.some(r=>r.id!==b.id&&(routes?routes.collides(b,r):Math.abs(nearbyGap(b.total,r.total,LENGTH))<2.9&&Math.abs(b.lateral-r.lateral)<1.85))){b.slow=Math.max(b.slow,.55);b.bump=.8;}
}
return events;
}
