import test from 'node:test';
import assert from 'node:assert/strict';
import {createRaceFrameClock} from '../src/race-frame-clock';

test('start, replay, restart, map entry and resume each discard their stale engine interval',()=>{
  const clock=createRaceFrameClock();
  for(const action of ['start','replay','restart','map entry','resume']) {
    clock.reset();
    assert.deepEqual(clock.sample(5,false,3),{dt:5},action);
    assert.deepEqual(clock.sample(5,true,action==='resume'?0:3),{dt:0},action);
    assert.deepEqual(clock.sample(1/60,true,0),{dt:1/60});
    assert.deepEqual(clock.sample(.8,true,0),{dt:.25});
  }
});
test('successive shader warm-up frames cannot pause or skip the countdown',()=>{
  const clock=createRaceFrameClock();clock.sample(0,true,3);
  for(const dt of [.3,.8,1.2,10,1e6])assert.deepEqual(clock.sample(dt,true,3),{dt:.25});
  assert.deepEqual(clock.sample(1.2,true,.02),{dt:.02},'warm-up cannot spill into racing');
  assert.deepEqual(clock.sample(.02,true,.01),{dt:.02},'ordinary countdown overflow is preserved');
  assert.deepEqual(clock.sample(.25,true,0),{dt:.25});
  assert.deepEqual(clock.sample(.251,true,0),{dt:.25},'foreground stalls are bounded without a pause signal');
});
test('invalid deltas stay finite and inactive frames do not consume the new race boundary',()=>{
  const clock=createRaceFrameClock();
  for(const dt of [NaN,Infinity,-2])assert.deepEqual(clock.sample(dt,false,0),{dt:0});
  assert.deepEqual(clock.sample(.1,true,0),{dt:0});
  for(const dt of [NaN,Infinity,-2])assert.deepEqual(clock.sample(dt,true,0),{dt:0});
});

test('arbitrarily late or repeated foreground stalls have bounded catch-up, without a warm-up timeout',()=>{
  const clock=createRaceFrameClock();clock.sample(0,true,3);
  for(const elapsed of [5,10,30,300,3600]){
    for(let i=0;i<60;i++)assert.deepEqual(clock.sample(1/60,true,0),{dt:1/60});
    for(const dt of [.251,.8,1.2,5,1e6]){
      const frame=clock.sample(dt,true,0);
      assert.deepEqual(frame,{dt:.25},`foreground stall at ${elapsed}s`);
      assert.equal('interrupted' in frame,false,'clock cannot infer focus or pause state');
    }
  }
});
