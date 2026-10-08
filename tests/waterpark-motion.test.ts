import test from 'node:test';import assert from 'node:assert/strict';
import {newWaterState,stepWaterMotion,WATER_HANDLING}from'../src/waterpark-motion';
import{resolveMap}from'../src/map-profiles';
test('maps explicitly select independent vehicle identities and safe default',()=>{assert.equal(resolveMap('coast').vehicle,'kart');assert.equal(resolveMap('waterpark').vehicle,'water-mount');assert.equal(resolveMap('bad').id,'coast');});
test('water sample completes once, remains stopped, and resets deterministically',()=>{let s=newWaterState();for(let i=0;i<1800&&!s.finished;i++)s=stepWaterMotion(s,{throttle:true,brake:false,steer:0},1/60);assert.equal(s.finished,true);assert.equal(s.distance,285);assert.ok(s.elapsed>14&&s.elapsed<21);assert.equal(s.speed,0);assert.deepEqual(stepWaterMotion(s,{throttle:true,brake:false,steer:1},1),s);assert.deepEqual(newWaterState(),newWaterState());});
test('water steering has inertia, brakes take priority and banks stay bounded',()=>{let s=newWaterState();for(let i=0;i<400;i++)s=stepWaterMotion(s,{throttle:true,brake:false,steer:1},1/60);assert.ok(Math.abs(s.lane)<=WATER_HANDLING.bankLimit);const speed=s.speed;s=stepWaterMotion(s,{throttle:true,brake:true,steer:0},1/60);assert.ok(s.speed<speed);assert.ok(Number.isFinite(stepWaterMotion(s,{throttle:false,brake:false,steer:NaN},NaN).lane));});

test('Space stops forward and reverse without ever becoming a reverse throttle',()=>{
 for(const initial of [20,-6]){
  let s={...newWaterState(),speed:initial};
  for(let i=0;i<480;i++){
   s=stepWaterMotion(s,{throttle:false,brake:true,reverse:true,steer:0},1/120,{finishDistance:Infinity});
   assert.ok(initial>0?s.speed>=0:s.speed<=0);
  }
  assert.equal(s.speed,0);
  const stopped=s.distance;
  for(let i=0;i<60;i++)s=stepWaterMotion(s,{throttle:false,brake:true,steer:0},1/120,{finishDistance:Infinity});
  assert.equal(s.distance,stopped);
 }
});

test('S brakes to zero before reverse, W brakes reverse before forward, and opposing pedals stop',()=>{
 let s={...newWaterState(),speed:15},sawStop=false;
 for(let i=0;i<500;i++){
  const previous=s.speed;
  s=stepWaterMotion(s,{throttle:false,brake:false,reverse:true,steer:0},1/120,{finishDistance:Infinity});
  if(previous>0)assert.ok(s.speed>=0,'one tick cannot jump from forward into reverse');
  if(s.speed===0)sawStop=true;
 }
 assert.ok(sawStop&&s.speed<0);
 assert.ok(s.speed>=-WATER_HANDLING.maxSpeed*WATER_HANDLING.reverseRatio);
 const backedUp=s.distance;
 s=stepWaterMotion(s,{throttle:false,brake:false,reverse:true,steer:0},1/120,{finishDistance:Infinity});
 assert.ok(s.distance<backedUp);
 for(let i=0;i<300;i++){
  const previous=s.speed;
  s=stepWaterMotion(s,{throttle:true,brake:false,steer:0},1/120,{finishDistance:Infinity});
  if(previous<0)assert.ok(s.speed<=0,'W brakes reverse first');
 }
 assert.ok(s.speed>0);
 for(let i=0;i<500;i++)s=stepWaterMotion(s,{throttle:true,brake:false,reverse:true,drift:true,steer:1},1/120,{finishDistance:Infinity});
 assert.equal(s.speed,0);assert.equal(s.charge,0);assert.equal(s.slideBoost,0);
});

test('reverse steering is signed and water keeps lateral inertia after the turn is released',()=>{
 const forward=stepWaterMotion({...newWaterState(),speed:5},{throttle:false,brake:false,steer:.5},1/60);
 const reverse=stepWaterMotion({...newWaterState(),speed:-5},{throttle:false,brake:false,steer:.5},1/60);
 assert.ok(forward.lateralSpeed>0&&reverse.lateralSpeed<0);
 assert.ok(Math.abs(forward.lateralSpeed+reverse.lateralSpeed)<1e-12);
 const released=stepWaterMotion(forward,{throttle:false,brake:false,steer:0},1/60);
 assert.ok(released.lateralSpeed>0&&released.lateralSpeed<forward.lateralSpeed);
 assert.ok(released.lane>forward.lane);
});

test('a moving Shift turn charges a bounded water slide and releasing Shift earns boost',async()=>{
 const {waterMotionTravelSpeed}=await import('../src/waterpark-motion');
 let slide={...newWaterState(),speed:18},normal={...slide};
 for(let i=0;i<120;i++){
  slide=stepWaterMotion(slide,{throttle:true,brake:false,drift:true,steer:.2},1/120,{finishDistance:Infinity});
  normal=stepWaterMotion(normal,{throttle:true,brake:false,steer:.2},1/120,{finishDistance:Infinity});
 }
 assert.equal(slide.drifting,true);assert.ok(slide.charge>WATER_HANDLING.slideMinCharge);assert.ok(slide.lateralSpeed>normal.lateralSpeed);
 const released=stepWaterMotion(slide,{throttle:true,brake:false,steer:.2},1/120,{finishDistance:Infinity});
 assert.equal(released.drifting,false);assert.equal(released.charge,0);assert.ok(released.slideBoost>1.4);
 assert.ok(waterMotionTravelSpeed(released)>released.speed);
 assert.ok(Math.abs(released.distance-slide.distance-waterMotionTravelSpeed(released)/120)<1e-10);
 for(let i=0;i<400;i++)slide=stepWaterMotion(slide,{throttle:true,brake:false,drift:true,steer:.02},1/120,{finishDistance:Infinity});
 assert.equal(slide.charge,WATER_HANDLING.slideMaxCharge);
 let boosted=released;
 for(let i=0;i<240;i++)boosted=stepWaterMotion(boosted,{throttle:true,brake:false,steer:0},1/120,{finishDistance:Infinity});
 assert.equal(boosted.slideBoost,0);
});

test('stationary, straight, low-speed, reverse, cancelled and banked slides cannot farm boost',()=>{
 for(const [speed,steer,reverse] of [[0,1,false],[7,1,false],[18,0,false],[-5,1,true]] as const){
  const s=stepWaterMotion({...newWaterState(),speed},{throttle:false,brake:false,drift:true,steer,reverse},1/60,{finishDistance:Infinity});
  assert.equal(s.drifting,false);assert.equal(s.charge,0);assert.equal(s.slideBoost,0);
 }
 for(const control of [{throttle:true,brake:true,steer:1},{throttle:false,brake:false,reverse:true,steer:1},{throttle:true,brake:false,drift:true,steer:0}]){
  const s=stepWaterMotion({...newWaterState(),speed:18,drifting:true,charge:1},control,1/60,{finishDistance:Infinity});
  assert.equal(s.charge,0);assert.equal(s.slideBoost,0);
 }
 const short=stepWaterMotion({...newWaterState(),speed:18,drifting:true,charge:.2},{throttle:true,brake:false,steer:1},1/60);
 assert.equal(short.slideBoost,0);
 const bank=stepWaterMotion({...newWaterState(),speed:18,lane:WATER_HANDLING.bankLimit,lateralSpeed:4,drifting:true,charge:1},{throttle:true,brake:false,drift:true,steer:1},1/60,{finishDistance:Infinity});
 assert.equal(bank.bankHit,true);assert.equal(bank.charge,0);assert.equal(bank.drifting,false);assert.equal(bank.slideBoost,0);
});

test('all six character profiles retain their acceleration, forward/reverse caps and slide steering',async()=>{
 const {CHARACTER_PROFILES,characterTuning}=await import('../src/character-profiles');
 for(const profile of CHARACTER_PROFILES){
  const tuning=characterTuning(profile.id,'waterpark'),dt=1/120;
  const start=stepWaterMotion(newWaterState(),{throttle:true,brake:false,steer:0},dt,tuning);
  assert.ok(Math.abs(start.speed-tuning.acceleration*dt*Math.exp(-WATER_HANDLING.drag*dt))<1e-10);
  const cap=stepWaterMotion({...newWaterState(),speed:1000},{throttle:true,brake:false,steer:0},dt,tuning);
  assert.equal(cap.speed,tuning.maxSpeed);
  const reverse=stepWaterMotion({...newWaterState(),speed:-1000},{throttle:false,brake:false,reverse:true,steer:0},dt,tuning);
  assert.equal(reverse.speed,-tuning.maxSpeed*WATER_HANDLING.reverseRatio);
  const slide=stepWaterMotion({...newWaterState(),speed:16},{throttle:true,brake:false,drift:true,steer:.5},dt,tuning);
  assert.ok(Math.abs(slide.lateralSpeed-.5*tuning.steering*WATER_HANDLING.slideSteering*dt*Math.exp(-WATER_HANDLING.slideLateralDrag*dt))<1e-10);
 }
});

test('zero and invalid motion deltas do not release a stored slide or advance effects',()=>{
 const s={...newWaterState(),speed:18,drifting:true,charge:1,slideBoost:2,bankHit:true};
 for(const dt of [0,-1,NaN,Infinity])assert.deepEqual(stepWaterMotion(s,{throttle:true,brake:false,steer:1},dt),s);
});

test('water bend current is gently bounded, points outside either turn and applies to reverse safely',async()=>{
 const {waterTurnCurrent}=await import('../src/waterpark-motion');
 assert.ok(waterTurnCurrent(20,.02)<0,'a left (+lane) turn pushes toward the right bank');
 assert.ok(waterTurnCurrent(20,-.02)>0,'a right turn pushes toward the left bank');
 assert.equal(waterTurnCurrent(-20,.02),waterTurnCurrent(20,.02));
 assert.equal(waterTurnCurrent(0,.02),0);assert.equal(waterTurnCurrent(20,0),0);
 assert.ok(Math.abs(waterTurnCurrent(1000,1000))<=WATER_HANDLING.maxTurnCurrent);
 assert.equal(waterTurnCurrent(NaN,.02),0);assert.equal(waterTurnCurrent(20,NaN),0);
 const moving={...newWaterState(),speed:18};
 const left=stepWaterMotion(moving,{throttle:true,brake:false,steer:0},1/120,{curvature:.02});
 const right=stepWaterMotion(moving,{throttle:true,brake:false,steer:0},1/120,{curvature:-.02});
 assert.ok(left.lateralSpeed<0&&right.lateralSpeed>0);assert.equal(left.speed,right.speed);assert.equal(left.distance,right.distance);
 assert.ok(Math.abs(left.lateralSpeed+right.lateralSpeed)<1e-12);
 const corrected=stepWaterMotion(moving,{throttle:true,brake:false,steer:.1},1/120,{curvature:.02});
 assert.ok(corrected.lateralSpeed>0,'a small steering correction can overcome the beginner current');
});
