import test from 'node:test';
import assert from 'node:assert/strict';
import {FOREST_COURSE as course} from '../src/maps/forest';
import {benchmarkForkDriving} from './helpers/fork-driving-benchmark';
import {getNpcPresets} from '../src/kart-presets';

test('forest physical service path saves a modest 0.767s without hidden speed bonuses',t=>{
  const rim=benchmarkForkDriving(course,'boulevard',true),service=benchmarkForkDriving(course,'alley',true);
  assert.ok(Math.abs(rim.seconds-service.seconds-46/60)<1/60+1e-8);
  assert.equal(rim.branchRailSeconds,0);assert.equal(service.branchRailSeconds,0);
  assert.equal(service.choice,'alley');assert.equal(rim.choice,'boulevard');
  t.diagnostic(JSON.stringify({rim,service}));
});

test('forest all six character/build pairs finish both physical branches at 30/60/120/144/240Hz',t=>{
  const results=[];
  for(const preset of getNpcPresets('coast',20261010))for(const hz of [30,60,120,144,240]){
    const service=benchmarkForkDriving(course,'alley',true,1/hz,preset.characterId,preset.build,0,true);
    const rim=benchmarkForkDriving(course,'boulevard',true,1/hz,preset.characterId,preset.build,0,true);
    assert.equal(service.choice,'alley');assert.equal(rim.choice,'boulevard');
    for(const result of [service,rim])assert.ok(Number.isFinite(result.seconds)&&result.seconds>45&&result.seconds<110,`${preset.characterId}/${hz}: ${JSON.stringify(result)}`);
    assert.ok(rim.seconds>service.seconds,'real distance savings reward a clean route');
    assert.ok(rim.seconds-service.seconds<1.5,'shortcut reward stays modest for every build');
    results.push({character:preset.characterId,preset:preset.presetId,hz,service:service.seconds,rim:rim.seconds,advantage:rim.seconds-service.seconds,serviceRail:service.branchRailSeconds,rimRail:rim.branchRailSeconds});
  }
  for(const id of new Set(results.map(row=>row.character))){
    const group=results.filter(row=>row.character===id);
    for(const route of ['service','rim'] as const)assert.ok(Math.max(...group.map(row=>row[route]))-Math.min(...group.map(row=>row[route]))<.11,`${id} refresh-rate physical equivalence`);
  }
  const errors=getNpcPresets('coast',20261010).map(preset=>{
    const cleanRim=results.find(row=>row.character===preset.characterId&&row.hz===60)!.rim;
    const service=benchmarkForkDriving(course,'alley',true,1/60,preset.characterId,preset.build,3,true);
    assert.ok(service.branchRailSeconds>3,`${preset.characterId} physical service rail error`);
    assert.ok(service.seconds>cleanRim,`${preset.characterId} a real branch error loses the clean-rim advantage`);
    return {character:preset.characterId,cleanRim,service};
  });
  t.diagnostic(JSON.stringify({clean:results,staleBranchInput:errors}));
});

test('forest actual branch rail errors can erase the service-path reward under equal decision timing',t=>{
  const results=[0,.4,.8,1.2,1.6,2,3].map(reaction=>({reaction,service:benchmarkForkDriving(course,'alley',true,1/60,'whale',undefined,reaction,true),rim:benchmarkForkDriving(course,'boulevard',true,1/60,'whale',undefined,reaction,true)}));
  assert.equal(results[0].service.branchRailSeconds,0);
  assert.ok(results[3].service.branchRailSeconds>.4);assert.equal(results[3].rim.branchRailSeconds,0);
  assert.ok(results[4].service.seconds>results[0].rim.seconds,'1.6s stale service input loses its advantage over a clean rim lap');
  assert.ok(results[6].service.seconds>results[6].rim.seconds+.5,'identical 3s stale branch decisions reverse the clean advantage');
  assert.ok(results[6].service.branchRailSeconds>results[6].rim.branchRailSeconds+1);
  t.diagnostic(JSON.stringify(results));
});
