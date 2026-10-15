import test from 'node:test';
import assert from 'node:assert/strict';
import {driveSpeed} from '../src/vehicle-controls.js';
import {stepRaceKartSpeed} from '../src/kart-race';
import {stepLandSpeed} from '../src/land-driving';
import {RULES} from '../src/npc-tactics';
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const tune=(acceleration:number)=>({maxSpeed:40,multipliers:{acceleration}});
// Frozen W formula, not a substitute for the C21 source or holdout evidence.
function legacy(speed:number,input:any,dt:number,acceleration:number,limit=40){
 return driveSpeed(speed,input,dt*(input.throttle&&!input.reverse&&!input.brake&&speed>=0&&speed<limit?acceleration:1),limit);
}
test('reproduces W coupling and fixes throttle+handbrake deceleration only',()=>{
 const input={throttle:true,handbrake:true};
 close(legacy(35,input,.1,.6),33.68);close(legacy(35,input,.1,1.4),31.92);
 for(const acceleration of [.6,1,1.4]){
  close(stepRaceKartSpeed(35,input,.1,tune(acceleration),0,0),32.8);
  close(stepLandSpeed(null,0,35,input,.1,tune(acceleration),0,0),32.8);
 }
});
test('preserves all branches outside the handbrake deceleration interval',()=>{
 for(const acceleration of [.6,1,1.4])for(const speed of [-12,-.1,0,10,30.4,40,48])
 for(const throttle of [false,true])for(const reverse of [false,true])for(const brake of [false,true])for(const handbrake of [false,true]){
  const input={throttle,reverse,brake,handbrake};
  close(stepRaceKartSpeed(speed,input,.03,tune(acceleration),0,0),legacy(speed,input,.03,acceleration));
 }
});
test('retains propulsion differences and clamps both sides of the drift target',()=>{
 for(const acceleration of [.6,1,1.4]){
  close(stepRaceKartSpeed(10,{throttle:true},.1,tune(acceleration),0,0),10+1.8*acceleration);
  close(stepRaceKartSpeed(10,{throttle:true,handbrake:true},.1,tune(acceleration),0,0),10+1.8*acceleration);
  close(stepRaceKartSpeed(30.39,{throttle:true,handbrake:true},.1,tune(acceleration),0,0),30.4);
  close(stepRaceKartSpeed(30.41,{throttle:true,handbrake:true},.1,tune(acceleration),0,0),30.4);
 }
});
test('effect and offroad caps use the same deceleration rule without modifying elapsed time',()=>{
 for(const boost of [0,1])for(const slow of [0,1])for(const offroad of [false,true])for(const acceleration of [.6,1.4]){
  const limit=40*(boost?RULES.boostFactor:1)*(slow?RULES.slowFactor:1)*(offroad?.58:1);
  const speed=.9*limit,dt=.01;
  close(stepRaceKartSpeed(speed,{throttle:true,handbrake:true},dt,tune(acceleration),boost,slow,offroad),speed-22*dt);
  close(stepRaceKartSpeed(speed,{throttle:true,handbrake:true},0,tune(acceleration),boost,slow,offroad),speed);
 }
});
