import test from 'node:test';
import assert from 'node:assert/strict';
import {QUARRY_COURSE as course} from '../src/maps/quarry';
import {benchmarkForkDriving} from './helpers/fork-driving-benchmark';
import {getNpcPresets} from '../src/kart-presets';

test('quarry physical shelf saves 0.650s in the measured mixed build without hidden speed bonuses',t=>{
  const haul=benchmarkForkDriving(course,'boulevard',true),shelf=benchmarkForkDriving(course,'alley',true);
  const uncorrectedShelf=benchmarkForkDriving(course,'alley',false),uncorrectedHaul=benchmarkForkDriving(course,'boulevard',false);
  assert.ok(Math.abs(haul.seconds-shelf.seconds-.650)<1/60+1e-8);
  assert.equal(haul.branchRailSeconds,0);assert.equal(shelf.branchRailSeconds,0);
  assert.ok(uncorrectedShelf.branchRailSeconds>.5);assert.ok(uncorrectedShelf.seconds>haul.seconds);
  assert.ok(uncorrectedHaul.seconds>uncorrectedShelf.seconds,'nonsteering whole-lap stress is not evidence that haul needs no steering');
  assert.ok(uncorrectedShelf.branchSeconds>shelf.branchSeconds+.5);
  t.diagnostic(JSON.stringify({haul,shelf,uncorrectedShelf,uncorrectedHaul}));
});

test('all six character/build pairs finish both real quarry branches at 30/60/120/144/240Hz',t=>{
  const results=[];
  for(const preset of getNpcPresets('coast',20261010))for(const hz of [30,60,120,144,240]){
    const shelf=benchmarkForkDriving(course,'alley',true,1/hz,preset.characterId,preset.build,0,true);
    const haul=benchmarkForkDriving(course,'boulevard',true,1/hz,preset.characterId,preset.build,0,true);
    const shelfNoCorrection=benchmarkForkDriving(course,'alley',false,1/hz,preset.characterId,preset.build,0,true),haulNoCorrection=benchmarkForkDriving(course,'boulevard',false,1/hz,preset.characterId,preset.build,0,true);
    assert.equal(shelf.choice,'alley');assert.equal(haul.choice,'boulevard');
    for(const result of [shelf,haul,shelfNoCorrection,haulNoCorrection])assert.ok(Number.isFinite(result.seconds)&&result.seconds>35&&result.seconds<100,`${preset.characterId}/${hz}: ${JSON.stringify(result)}`);
    assert.ok(haul.seconds>shelf.seconds,'physical distance saving rewards clean steering');
    assert.ok(shelfNoCorrection.seconds>shelf.seconds&&haulNoCorrection.seconds>haul.seconds,'both routes require real steering');
    assert.ok(shelfNoCorrection.branchRailSeconds>0&&haulNoCorrection.branchRailSeconds>0,'uncorrected branch contacts are measured independently of common road');
    assert.ok(haul.seconds-shelf.seconds<1.5,'shelf reward remains modest for every build');
    results.push({character:preset.characterId,preset:preset.presetId,hz,shelf:shelf.seconds,haul:haul.seconds,advantage:haul.seconds-shelf.seconds,shelfNoCorrection:shelfNoCorrection.seconds,haulNoCorrection:haulNoCorrection.seconds});
  }
  t.diagnostic(JSON.stringify(results));
});

test('held branch steering decisions expose less shelf recovery room under identical input timing',t=>{
  const results=[0,.2,.4,.6,.8,1,1.2].map(reaction=>({reaction,shelf:benchmarkForkDriving(course,'alley',true,1/60,'whale',undefined,reaction),haul:benchmarkForkDriving(course,'boulevard',true,1/60,'whale',undefined,reaction)}));
  assert.equal(results[0].shelf.branchRailSeconds,0);
  assert.ok(results[4].shelf.branchRailSeconds>.4);assert.equal(results[4].haul.branchRailSeconds,0);
  assert.ok(results[4].haul.seconds-results[4].shelf.seconds<results[0].haul.seconds-results[0].shelf.seconds);
  assert.ok(results[6].shelf.seconds>results[6].haul.seconds+.5,'identical 1.2s branch decision cadence loses shelf advantage');
  assert.equal(results[6].haul.branchRailSeconds,0);
  t.diagnostic(JSON.stringify(results));
});
