import test from 'node:test';
import assert from 'node:assert/strict';
import { COAST_DRIFT, coastDriftReady, coastDriftBoost, coastCornerPace, coastHudFeedback } from '../src/coast-race-feedback';
import { activateItem, type Combatant } from '../src/npc-tactics';
import { sample, LENGTH, COAST_SECTIONS } from '../src/track';
import { driveSpeed } from '../src/vehicle-controls.js';
import { CHARACTER_PROFILES, characterTuning } from '../src/character-profiles';
const racer = (id = 'player', total = 0): Combatant => ({id,total,lateral:0,speed:30,held:null,boost:0,shield:0,slow:0});
const feedback = (actor: Combatant, others: Combatant[] = [], charge = 0) => coastHudFeedback(actor, others, 1000, charge, id => id.toUpperCase());

test('coast drift feedback and boost use the same strict threshold and real charge cap', () => {
  const actor = racer();
  for (const charge of [0, .3, .6]) {
    assert.equal(coastDriftReady(charge), false);
    assert.equal(coastDriftBoost(charge), 0);
    assert.doesNotMatch(feedback(actor, [], charge).chargeLabel!, /松开 Shift/);
  }
  for (const charge of [.60001, 1, 1.6]) {
    assert.equal(coastDriftReady(charge), true);
    assert.match(feedback(actor, [], charge).chargeLabel!, /松开 Shift/);
    assert.equal(coastDriftBoost(charge), charge * 1.5);
  }
  assert.equal(feedback(actor, [], .8).chargeMax, 1.6);
  assert.equal(feedback(actor, [], COAST_DRIFT.maxCharge).chargeState, 'full');
  assert.equal(feedback(actor, [], .61).chargeState, 'ready');
  assert.equal(feedback(actor, [], .6).chargeState, 'charging');
});

test('pulse preview agrees with actual nearest-target, shield and fallback rules without consuming inventory', () => {
  const actor = racer(); actor.held = 'pulse';
  const near = racer('near', 10), far = racer('far', 20); near.shield = 2;
  assert.match(feedback(actor,[far,near]).itemHelp!, /NEAR 有护盾/);
  assert.equal(actor.held, 'pulse'); assert.equal(near.slow,0);
  const blocked = activateItem(actor,[far,near],1000)!;
  assert.equal(blocked.target,near); assert.equal(blocked.blocked,true);
  actor.held='pulse'; near.shield=0;
  assert.match(feedback(actor,[far,near]).itemHelp!, /NEAR · E 发射/);
  assert.equal(activateItem(actor,[far,near],1000)!.target,near);
  actor.held='pulse';
  assert.match(feedback(actor,[]).itemHelp!, /1.9 秒加速/);
  activateItem(actor,[],1000); assert.equal(actor.boost,1.9);
  actor.held='pulse'; actor.total=990; near.total=5;
  assert.match(feedback(actor,[near]).itemHelp!, /NEAR/, 'same wrapped target at the start line');
  near.total=110; assert.match(feedback(actor,[near]).itemHelp!, /前方无目标/, '120m boundary is excluded');
});

test('active effect seconds are readable while idle and drift readiness takes priority while charging', () => {
  const actor=racer(); Object.assign(actor,{boost:1.8,shield:4.2,slow:.7});
  assert.equal(feedback(actor).chargeLabel,'加速 1.8 秒 · 护盾 4.2 秒 · 减速 0.7 秒');
  assert.match(feedback(actor,[],.8).chargeLabel!,/漂移就绪/);
  Object.assign(actor,{boost:0,shield:0,slow:0,speed:0}); assert.match(feedback(actor).chargeLabel!,/起步/);
  actor.held='boost';assert.match(feedback(actor).itemHelp!,/3.3 秒/);
  actor.held='shield';assert.match(feedback(actor).itemHelp!,/6 秒/);
  actor.held=null;assert.equal(feedback(actor).itemHelp,undefined);
});

test('corner pace is straight-neutral, symmetric, bounded and sees the second turn of a chicane', () => {
  const straight=()=>({t:{x:1,z:0}});
  for(const speed of [0,20,60])assert.equal(coastCornerPace(10,speed,straight),1);
  const turn=(direction:number)=>(d:number)=>({t:{x:Math.cos(d*.04),z:Math.sin(d*.04)*direction}});
  assert.equal(coastCornerPace(0,40,turn(1)),.86);
  assert.equal(coastCornerPace(0,40,turn(-1)),.86);
  const chicane=(d:number)=>{const angle=d<=22?0:-(d-22)*.06;return {t:{x:Math.cos(angle),z:Math.sin(angle)}};};
  assert.equal(coastCornerPace(0,0,chicane),1);
  assert.ok(coastCornerPace(0,40,chicane)<.9,'look-ahead picks up a bend whose start/end current window is straight');
});

test('real coast preserves both sprint zones and creates bounded corner/recovery pace for every profile', () => {
  const metrics = COAST_SECTIONS.map(section=>{
    const factors=[];for(let d=section.from;d<section.to;d++)factors.push(coastCornerPace(d,40,sample));
    return {name:section.name,min:Math.min(...factors),mean:factors.reduce((a,b)=>a+b,0)/factors.length};
  });
  assert.equal(metrics[0].mean,1); assert.equal(metrics.at(-1)!.mean,1);
  assert.ok(metrics[3].mean<.94); assert.ok(metrics[3].min<=.861);
  for(const metric of metrics)assert.ok(metric.min>=.86&&metric.mean<=1);
  for(let distance=-20;distance<LENGTH;distance+=5)assert.ok(Math.abs(coastCornerPace(distance,40,sample)-coastCornerPace(distance+LENGTH,40,sample))<1e-10,'lap seam repeats exactly');
  for(const profile of CHARACTER_PROFILES){
    const tuning=characterTuning(profile.id,'coast'), straight=tuning.maxSpeed*.92;
    let speed=straight, distance=0;
    for(let step=0;step<60;step++){
      const previous=speed;speed=driveSpeed(speed,{throttle:true},1/60*tuning.multipliers.acceleration,straight*.86);
      assert.ok(previous-speed<=22/60*tuning.multipliers.acceleration+1e-9,'no speed teleport'); distance+=speed/60;
    }
    assert.ok(speed<straight*.87);assert.ok(distance>straight*.85);
    for(let step=0;step<60;step++)speed=driveSpeed(speed,{throttle:true},1/60*tuning.multipliers.acceleration,straight);
    assert.equal(speed,straight,profile.id+' recovers after exit');
  }
});
