import assert from 'node:assert/strict';
import type {ForkCourse} from '../../src/land-routes';
import {createLandRaceRoute} from '../../src/land-race-route';
import {createRaceKartTuning,kartRoadContext} from '../../src/kart-race';
import {defaultBuild} from '../../src/kart-build';
import {npcSkill,npcDriving} from '../../src/npc-difficulty';
import {COAST_DRIFT,coastDriftReady,coastDriftBoost} from '../../src/coast-race-feedback';
import {landLookAheadBend,landRailScrape,landSteeringGrip,landBankDrift,stepLandSpeed} from '../../src/land-driving';
import {planLane,moveLane,newBrain,tickBrain,tickEffects,RULES,type Combatant} from '../../src/npc-tactics';
import {clamp} from '../../src/track';
const actor=(id:string):Combatant=>({id,total:0,lateral:0,speed:0,held:null,boost:0,shield:0,slow:0});

/** Uses the native game's pure NPC control/physics functions and decision
 * cadence. Models, traffic, items, DOM and GPU are deliberately excluded. */
export function runForkNpc(course:ForkCourse,seed:number,id:string,phase:number,difficulty:'easy'|'normal'|'hard') {
  const runtime=createLandRaceRoute(course,seed),skill=npcSkill(difficulty),dt=1/60;
  const compiled=createRaceKartTuning(defaultBuild,seed),selectedId=id==='whale'?'gpt':'whale';
  const bot={...actor(id),...newBrain(phase,(phase%2?1:-1)*3.2),aiBend:0,driftCharge:0,driftCooldown:0,aiDrifting:false};
  bot.lateral=bot.targetLane;runtime.init(id,0,bot.lateral);
  let frames=0,minY=Infinity,maxY=-Infinity,brakeFrames=0,driftFrames=0,maxStep=0;
  while(!runtime.get(id).finished&&frames++<21600){
    tickEffects(bot,dt);tickBrain(bot,dt);runtime.npcChoice(id);
    const road=runtime.view(id,bot.total),tuning=compiled(id,selectedId,kartRoadContext(bot.total,bot.speed,road.sample));
    if(bot.decisionIn<=0){
      bot.decisionIn=skill.decision+phase*.015;
      bot.aiBend=landLookAheadBend(road,bot.total,skill.lookAhead);
      const safeLane=Math.min(runtime.limit(id,0,.8),runtime.limit(id,22,.8));
      bot.targetLane=clamp(planLane(bot,[bot],[],course.canonicalLength,phase,bot.aiBend,skill,runtime.interactions),-safeLane,safeLane);
    }
    if(runtime.nearFork(id))bot.targetLane=runtime.npcChoice(id)==='alley'?2.8:-2.8;
    bot.driftCooldown=Math.max(0,bot.driftCooldown-dt);
    const control=npcDriving(bot.speed,tuning.maxSpeed*(bot.boost>0?RULES.boostFactor:1),bot.aiBend,skill,bot.driftCharge,bot.targetLane-bot.lateral);
    control.handbrake=control.drift=control.drift&&bot.driftCooldown===0;
    if(control.drift){bot.driftCharge=Math.min(COAST_DRIFT.maxCharge,bot.driftCharge+dt);driftFrames++;}
    else{if(bot.aiDrifting){if(!control.brake&&coastDriftReady(bot.driftCharge))bot.boost=Math.max(bot.boost,coastDriftBoost(bot.driftCharge));bot.driftCooldown=2;}bot.driftCharge=0;}
    if(control.brake)brakeFrames++;bot.aiDrifting=control.drift;
    const previous=runtime.sample(id).p,previousLane=bot.lateral;
    bot.speed=stepLandSpeed(road,bot.total,bot.speed,control,dt,tuning,bot.boost,bot.slow,Math.abs(bot.lateral)>runtime.limit(id,0,.9));
    const attempted=moveLane(bot.lateral,bot.targetLane,dt*tuning.multipliers.steering*landSteeringGrip(road,bot.total))+landBankDrift(road,bot.total,bot.speed,dt);
    const rail=landRailScrape(bot.speed,attempted,runtime.limit(id,0,.8),dt);bot.speed=rail.speed;bot.lateral=rail.lateral;
    const selected=runtime.npcChoice(id)==='alley'&&bot.lateral>.35?'alley':'boulevard';
    const progress=runtime.advance(id,bot.speed*dt,dt,bot.lateral,selected);
    assert.ok(progress.accepted,`${seed}/${id}/${difficulty}: ${progress.reason}`);bot.total=progress.total;
    bot.lateral=clamp(bot.lateral,-runtime.limit(id,0,.8),runtime.limit(id,0,.8));runtime.setLane(id,bot.lateral);
    const cursor=runtime.cursor(id),position=runtime.sample(id).p;
    assert.ok([bot.total,bot.lateral,bot.speed,position.x,position.y,position.z].every(Number.isFinite));
    assert.ok(cursor.s>=0&&cursor.s<=course.edges[cursor.edgeId].length);
    assert.ok(Math.abs(bot.lateral)<=runtime.limit(id,0,.8)+1e-8);
    const step=position.distance(previous);maxStep=Math.max(maxStep,step);
    assert.ok(step<=Math.abs(bot.speed*dt)*2+Math.abs(bot.lateral-previousLane)*2+.05,`${id} support jumped ${step}m at ${cursor.edgeId}`);
    minY=Math.min(minY,position.y);maxY=Math.max(maxY,position.y);
  }
  const state=runtime.get(id);
  assert.ok(state.finished,`${seed}/${id}/${difficulty} stalled at ${JSON.stringify(state.cursor)}`);
  assert.equal(state.laps,3);assert.equal(state.nextGate,course.gatesPerLap*3);assert.ok(maxY-minY>18);
  assert.ok(brakeFrames>0,'actual NPC braking is exercised');
  return {frames,brakeFrames,driftFrames,maxStep,branches:Object.values(state.cursor.choiceByLap),finish:state.cursor};
}

