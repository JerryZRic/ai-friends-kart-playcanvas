import test from 'node:test';
import assert from 'node:assert/strict';
import {createRaceFrameClock} from '../src/race-frame-clock';

test('start, replay, restart, map entry and resume each discard their stale engine interval',()=>{
  const clock=createRaceFrameClock();
  for(const action of ['start','replay','restart','map entry','resume']) {
    clock.reset();
    assert.deepEqual(clock.sample(5,false,3),{dt:5,interrupted:false},action);
    assert.deepEqual(clock.sample(5,true,action==='resume'?0:3),{dt:0,interrupted:false},action);
    assert.deepEqual(clock.sample(1/60,true,0),{dt:1/60,interrupted:false});
    assert.deepEqual(clock.sample(.8,true,0),{dt:0,interrupted:true});
  }
});
test('successive shader warm-up frames cannot pause or skip the countdown',()=>{
  const clock=createRaceFrameClock();clock.sample(0,true,3);
  for(const dt of [.3,.8,1.2,10,1e6])assert.deepEqual(clock.sample(dt,true,3),{dt:.25,interrupted:false});
  assert.deepEqual(clock.sample(1.2,true,.02),{dt:.02,interrupted:false},'warm-up cannot spill into racing');
  assert.deepEqual(clock.sample(.02,true,.01),{dt:.02,interrupted:false},'ordinary countdown overflow is preserved');
  assert.deepEqual(clock.sample(.25,true,0),{dt:.25,interrupted:false});
  assert.deepEqual(clock.sample(.251,true,0),{dt:0,interrupted:true},'real racing stall still pauses');
});
test('invalid deltas stay finite and inactive frames do not consume the new race boundary',()=>{
  const clock=createRaceFrameClock();
  for(const dt of [NaN,Infinity,-2])assert.deepEqual(clock.sample(dt,false,0),{dt:0,interrupted:false});
  assert.deepEqual(clock.sample(.1,true,0),{dt:0,interrupted:false});
  for(const dt of [NaN,Infinity,-2])assert.deepEqual(clock.sample(dt,true,0),{dt:0,interrupted:false});
});
