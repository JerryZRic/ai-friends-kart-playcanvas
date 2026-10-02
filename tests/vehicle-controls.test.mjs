import assert from 'node:assert/strict';
import * as THREE from 'three';
import { keyCode, driveInput, driveSpeed, lateralInput, steeringYaw } from '../src/vehicle-controls.js';
const tests=[];
function test(name,fn){fn();tests.push(name)}
const empty=()=>driveInput({});
function run(speed,input,seconds,limit=42){for(let i=0;i<seconds*60;i++)speed=driveSpeed(speed,input,1/60,limit);return speed}
test('physical WASD survives shifted characters and IME',()=>{assert.equal(keyCode({code:'KeyA',key:'A'}),'KeyA');assert.equal(keyCode({code:'KeyW',key:'Process'}),'KeyW');assert.equal(keyCode({key:'a'}),'KeyA');assert.equal(keyCode({key:' '}),'Space')});
test('core bindings and opposing directions',()=>{assert.equal(driveInput({KeyA:true}).steer,-1);assert.equal(driveInput({KeyD:true}).steer,1);assert.equal(driveInput({KeyA:true,KeyD:true}).steer,0);assert.ok(driveInput({Space:true}).brake);assert.ok(driveInput({ShiftLeft:true}).handbrake);assert.ok(driveInput({ShiftRight:true}).handbrake)});
test('no automatic acceleration',()=>assert.equal(run(0,empty(),10),0));
test('W accelerates; releasing W coasts to a stop',()=>{const v=run(0,driveInput({KeyW:true}),3);assert.equal(v,42);assert.equal(run(v,empty(),8),0)});
test('Space stops without reverse and takes priority over throttle',()=>{const input=driveInput({Space:true,KeyW:true});assert.equal(run(42,input,2),0);assert.equal(run(-11,input,2),0);assert.equal(run(0,input,2),0)});
test('S brakes through zero, then reverses with limited speed',()=>{assert.ok(run(42,driveInput({KeyS:true}),1)>0);assert.equal(run(42,driveInput({KeyS:true}),4),-11)});
test('W stops reverse before driving forward',()=>{assert.ok(run(-11,driveInput({KeyW:true}),.25)<0);assert.ok(run(-11,driveInput({KeyW:true}),1)>0)});
test('W and S together brake instead of oscillating',()=>assert.equal(run(20,driveInput({KeyW:true,KeyS:true}),2),0));
test('handbrake slows acceleration into a drift and brakes when off throttle',()=>{assert.equal(run(42,driveInput({KeyW:true,ShiftLeft:true}),2),42*.76);assert.equal(run(20,driveInput({ShiftLeft:true}),2),0)});
test('A/D lateral travel and yaw are left/right in every forward camera heading',()=>{
  for(let i=0;i<360;i++){
    const angle=i*Math.PI/180,t=new THREE.Vector3(Math.sin(angle),0,Math.cos(angle)),left=new THREE.Vector3(t.z,0,-t.x),right=t.clone().cross(new THREE.Vector3(0,1,0));
    for(const steer of [-1,1]){const world=left.clone().multiplyScalar(lateralInput(steer,42,42,false,.1));assert.equal(Math.sign(world.dot(right)),steer);const turned=t.clone().applyAxisAngle(new THREE.Vector3(0,1,0),steeringYaw(steer,42,false));assert.equal(Math.sign(turned.dot(right)),steer)}
  }
});
test('reverse steering reverses travel and yaw; stationary steering never slides',()=>{assert.ok(lateralInput(-1,-11,42,false,.1)<0);assert.ok(lateralInput(1,-11,42,false,.1)>0);assert.equal(Math.abs(lateralInput(1,0,42,false,.1)),0);assert.equal(Math.abs(steeringYaw(1,0,false)),0);assert.ok(steeringYaw(-1,-11,false)<0)});
console.log(JSON.stringify({status:'passed',suite:'vehicle controls',tests},null,2));
