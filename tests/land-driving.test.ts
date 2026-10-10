import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {MOUNTAIN_TRACK as track} from '../src/maps/mountain';
import {stepLandSpeed,landSteeringGrip,landBankDrift,landLookAheadBend} from '../src/land-driving';
import {stepRaceKartSpeed} from '../src/kart-race';
import {placeLandKart} from '../src/land-course';
const tuning={maxSpeed:42,multipliers:{acceleration:1}};
test('shared land integrator preserves old coast behavior exactly',()=>{
 for(const speed of [-8,0,12,42])for(const input of [{throttle:true},{reverse:true},{brake:true},{}]){
  assert.equal(stepLandSpeed(null,0,speed,input,1/60,tuning,0,0),stepRaceKartSpeed(speed,input,1/60,tuning,0,0));
 }
});
test('mountain slope force affects real speed and brakes hold on a slope',()=>{
 const ds=Array.from({length:600},(_,i)=>i*track.length/600);
 const up=ds.reduce((best,d)=>track.sample(d).t.y>track.sample(best).t.y?d:best,0);
 const down=ds.reduce((best,d)=>track.sample(d).t.y<track.sample(best).t.y?d:best,0);
 assert.ok(stepLandSpeed(track,up,20,{throttle:true},.05,tuning,0,0)<stepLandSpeed(track,down,20,{throttle:true},.05,tuning,0,0));
 assert.equal(stepLandSpeed(track,down,0,{brake:true},.05,tuning,0,0),0);
 let recovering=-3;for(let i=0;i<180;i++)recovering=stepLandSpeed(track,up,recovering,{throttle:true},1/60,tuning,0,0);
 assert.ok(recovering>10,'uphill launch recovers after reversing without gravity trapping at zero');
 assert.ok(landSteeringGrip(track,track.length*.56)<1);
 assert.ok(Number.isFinite(landLookAheadBend(track,track.length*.55,32)));
});
test('banked model orientation follows actual road normal with a height clearance',()=>{
 const entity=new pc.Entity();
 for(let i=0;i<500;i++){
  const d=i*track.length/500,frame=placeLandKart(entity,track,d,3);
  assert.ok(Math.abs(entity.getPosition().distance(frame.p)-.11)<1e-5);
  const up=entity.getRotation().transformVector(pc.Vec3.UP);
  assert.ok(up.dot(frame.normal)>.99999);
  assert.ok(Number.isFinite(landBankDrift(track,d,30,.02)));
 }
 entity.destroy();
});

test('mountain launch and reverse recovery accumulate throttle at high refresh rates',()=>{
 for(const hz of [60,120,144,240])for(const initial of [0,-2]){
  let speed=initial,distance=0;const dt=1/hz;
  for(let i=0;i<5*hz;i++){speed=stepLandSpeed(track,distance,speed,{throttle:true},dt,tuning,0,0);distance+=speed*dt;}
  assert.ok(speed>35,`${hz}Hz launch speed ${speed}`);assert.ok(distance>130,`${hz}Hz distance ${distance}`);
 }
});
