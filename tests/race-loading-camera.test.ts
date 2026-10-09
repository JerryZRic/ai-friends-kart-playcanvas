import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoadingCamera,LOADING_FLIGHT_HEIGHT,LOADING_FLIGHT_SPEED} from '../src/race-loading-camera';
import {LENGTH,sample} from '../src/track';
import {WATER_RACE_LENGTH,sampleWaterparkLoop} from '../src/waterpark-design';
import {chaseCamera} from '../src/race-camera';

for(const [name,track] of [['coast',{length:LENGTH,sample}],['waterpark',{length:WATER_RACE_LENGTH,sample:sampleWaterparkLoop}]] as const){
 test(`${name}: true track aerial moves at a moderate speed and smoothly lands before racing`,()=>{
  const camera=createLoadingCamera(track),first=camera.step(0);
  assert.equal(first.position.y,track.sample(0).p.y+LOADING_FLIGHT_HEIGHT);
  for(let i=0;i<60;i++)camera.step(1/60);
  const moving=camera.step(0),ground=track.sample(LOADING_FLIGHT_SPEED);
  assert.ok(Math.abs(moving.position.y-ground.p.y-LOADING_FLIGHT_HEIGHT)<1e-8);
  assert.ok(Math.hypot(first.position.x-moving.position.x,first.position.z-moving.position.z)>10);
  assert.deepEqual(camera.step(500,false),moving,'background does not advance');
  const line=track.sample(0),target=chaseCamera({position:line.p,tangent:line.t,view:0,rearView:false,orbit:{yaw:0,pitch:0}});
  camera.beginReturn(target);const frozen=camera.step(0);
  assert.deepEqual(camera.step(10,false),frozen);
  camera.step(10);assert.equal(camera.phase,'return','one stalled frame cannot skip transition');
  let previous=camera.step(0).position;
  for(let i=0;i<80;i++){const pose=camera.step(1/60);assert.ok(Number.isFinite(pose.position.x));assert.ok(Math.hypot(pose.position.x-previous.x,pose.position.y-previous.y,pose.position.z-previous.z)<6);previous=pose.position;}
  assert.equal(camera.phase,'ready');assert.deepEqual(camera.step(0).position,target.position);assert.deepEqual(camera.step(0).look,target.look);
  camera.reset();assert.equal(camera.phase,'flyover');assert.deepEqual(camera.step(0),first);
  camera.dispose();assert.deepEqual(camera.step(10),first);
 });
}
