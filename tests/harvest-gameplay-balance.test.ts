import test from 'node:test';
import assert from 'node:assert/strict';
import {HARVEST_COURSE as course} from '../src/maps/harvest';
import {benchmarkForkDriving} from './helpers/fork-driving-benchmark';
import {getNpcPresets} from '../src/kart-presets';

test('harvest physical barn path saves a modest 1.733s without hidden speed bonuses',t=>{
  const contour=benchmarkForkDriving(course,'boulevard',true),barn=benchmarkForkDriving(course,'alley',true);
  assert.ok(Math.abs(contour.seconds-barn.seconds-104/60)<1/60+1e-8);
  assert.equal(contour.branchRailSeconds,0);assert.equal(barn.branchRailSeconds,0);
  assert.equal(barn.choice,'alley');assert.equal(contour.choice,'boulevard');
  t.diagnostic(JSON.stringify({contour,barn}));
});

test('harvest all six character/build pairs finish both physical branches at 30/60/120/144/240Hz',t=>{
  const results=[];
  for(const preset of getNpcPresets('coast',20261010))for(const hz of [30,60,120,144,240]){
    const barn=benchmarkForkDriving(course,'alley',true,1/hz,preset.characterId,preset.build,0,true);
    const contour=benchmarkForkDriving(course,'boulevard',true,1/hz,preset.characterId,preset.build,0,true);
    assert.equal(barn.choice,'alley');assert.equal(contour.choice,'boulevard');
    assert.equal(barn.railSeconds,0);assert.equal(contour.railSeconds,0);
    for(const result of [barn,contour])assert.ok(Number.isFinite(result.seconds)&&result.seconds>45&&result.seconds<110,`${preset.characterId}/${hz}: ${JSON.stringify(result)}`);
    assert.ok(contour.seconds>barn.seconds,'real distance savings reward a clean route');
    assert.ok(contour.seconds-barn.seconds<2.5,'shortcut reward stays modest for every build');
    results.push({character:preset.characterId,preset:preset.presetId,hz,barn:barn.seconds,contour:contour.seconds,advantage:contour.seconds-barn.seconds,barnRail:barn.branchRailSeconds,contourRail:contour.branchRailSeconds});
  }
  for(const id of new Set(results.map(row=>row.character))){
    const group=results.filter(row=>row.character===id);
    for(const route of ['barn','contour'] as const)assert.ok(Math.max(...group.map(row=>row[route]))-Math.min(...group.map(row=>row[route]))<.11,`${id} refresh-rate physical equivalence`);
  }
  const errors=getNpcPresets('coast',20261010).map(preset=>{
    const cleanContour=results.find(row=>row.character===preset.characterId&&row.hz===60)!.contour;
    const barn=benchmarkForkDriving(course,'alley',true,1/60,preset.characterId,preset.build,3,true);
    assert.ok(barn.branchRailSeconds>3,`${preset.characterId} physical barn rail error`);
    assert.ok(barn.seconds>cleanContour,`${preset.characterId} a real branch error loses the clean-contour advantage`);
    return {character:preset.characterId,cleanContour,barn};
  });
  t.diagnostic(JSON.stringify({clean:results,staleBranchInput:errors}));
});

test('harvest bounded branch-only steering errors lose to a clean contour without inventing a universal equal-error reversal',t=>{
  const results=[0,.8,1.6,2.4,3].map(reaction=>({reaction,barn:benchmarkForkDriving(course,'alley',true,1/60,'whale',undefined,reaction,true),contour:benchmarkForkDriving(course,'boulevard',true,1/60,'whale',undefined,reaction,true)}));
  assert.equal(results[0].barn.branchRailSeconds,0);assert.equal(results[0].contour.branchRailSeconds,0);
  for(const result of results){assert.equal(result.barn.choice,'alley');assert.equal(result.contour.choice,'boulevard');}
  assert.ok(results[1].barn.branchRailSeconds>0);assert.equal(results[1].contour.branchRailSeconds,0);
  assert.ok(results[3].barn.seconds>results[0].contour.seconds,'2.4s stale branch decisions erase the clean reward against clean contour driving');
  assert.ok(results[4].barn.seconds>results[0].contour.seconds+1,'3s stale branch decisions produce a reproducible real cost');
  assert.ok(results[4].barn.branchRailSeconds>results[4].contour.branchRailSeconds+2);
  // This is a physical control recipe, not an assumption that the narrow path
  // loses every equal-error comparison. Keep the design's measured caveat.
  assert.ok(results[4].barn.seconds<results[4].contour.seconds);
  t.diagnostic(JSON.stringify({recipe:'Clean approach and exit; hold steering decisions for the stated interval only while on the selected branch. Identical shared physics, no traffic or item effects.',results}));
});
