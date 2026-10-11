import test from 'node:test';
import assert from 'node:assert/strict';
import {DESERT_COURSE as course} from '../src/maps/desert';
import {benchmarkForkDriving} from './helpers/fork-driving-benchmark';
import {getNpcPresets} from '../src/kart-presets';

// Read-only design pilots used the same helpers, seed, native 1/60s substeps,
// throttle, starting lane -2 and ordinary steering deadband .35. These values
// are regression observations, not a speed bonus or universal human balance rule.
const measured60={
  whale:{weave:74.4,sweep:75.4,staleWeave:77.66666666666667,staleSweep:77.01666666666667},
  gemini:{weave:76.01666666666667,sweep:77.25,staleWeave:80.75,staleSweep:80.11666666666666},
  gpt:{weave:63.25,sweep:63.88333333333333,staleWeave:65.2,staleSweep:64.88333333333334},
  claude:{weave:79.9,sweep:81.13333333333334,staleWeave:83.38333333333334,staleSweep:82.35},
  grok:{weave:67.73333333333333,sweep:68.75,staleWeave:71.03333333333333,staleSweep:70.73333333333333},
  glm:{weave:66.23333333333333,sweep:67.1,staleWeave:69.35,staleSweep:68.83333333333333},
};
const near=(actual:number,expected:number,label:string)=>assert.ok(Math.abs(actual-expected)<1e-7,`${label}: ${actual} versus private design ${expected}`);
const pilot=(branch:'alley'|'boulevard',reaction=0,hz=60)=>benchmarkForkDriving(course,branch,true,1/hz,'whale',undefined,reaction,true);

test('desert default clean physical routes reproduce 74.433s / 75.433s with zero rail contact',t=>{
  const weave=pilot('alley'),sweep=pilot('boulevard');
  near(weave.seconds,74.43333333333334,'weave');near(sweep.seconds,75.43333333333334,'sweep');
  near(sweep.seconds-weave.seconds,1,'physical reward');
  for(const result of [weave,sweep])assert.equal(result.railSeconds,0);
  assert.equal(weave.choice,'alley');assert.equal(sweep.choice,'boulevard');
  for(const hz of [30,144])for(const branch of ['alley','boulevard']as const){const result=pilot(branch,0,hz);assert.equal(result.railSeconds,0);assert.equal(result.choice,branch);assert.ok(Math.abs(result.seconds-(branch==='alley'?weave:sweep).seconds)<.009);}
  t.diagnostic(JSON.stringify({weave,sweep}));
});

test('desert all six character/build pairs complete both physical branches cleanly at 30/60/120/144/240Hz',t=>{
  const clean=[];
  for(const preset of getNpcPresets('coast',20261010))for(const hz of [30,60,120,144,240]){
    const weave=benchmarkForkDriving(course,'alley',true,1/hz,preset.characterId,preset.build,0,true);
    const sweep=benchmarkForkDriving(course,'boulevard',true,1/hz,preset.characterId,preset.build,0,true);
    assert.equal(weave.choice,'alley');assert.equal(sweep.choice,'boulevard');
    for(const result of [weave,sweep]){assert.equal(result.railSeconds,0);assert.equal(result.branchRailSeconds,0);assert.ok(Number.isFinite(result.seconds)&&result.seconds>0);}
    assert.ok(sweep.seconds>weave.seconds,'real 57.049m distance saving rewards a clean route');
    if(hz===60){const expected=measured60[preset.characterId];near(weave.seconds,expected.weave,`${preset.characterId} weave`);near(sweep.seconds,expected.sweep,`${preset.characterId} sweep`);}
    clean.push({character:preset.characterId,preset:preset.presetId,hz,weave:weave.seconds,sweep:sweep.seconds,reward:sweep.seconds-weave.seconds});
  }
  for(const id of new Set(clean.map(row=>row.character))){
    const group=clean.filter(row=>row.character===id);
    for(const branch of ['weave','sweep']as const)assert.ok(Math.max(...group.map(row=>row[branch]))-Math.min(...group.map(row=>row[branch]))<=1/120+1e-7,`${id}: refresh-rate physical equivalence`);
  }
  const error=getNpcPresets('coast',20261010).map(preset=>{
    const expected=measured60[preset.characterId],cleanSweep=clean.find(row=>row.character===preset.characterId&&row.hz===60)!.sweep;
    const weave=benchmarkForkDriving(course,'alley',true,1/60,preset.characterId,preset.build,3,true);
    const sweep=benchmarkForkDriving(course,'boulevard',true,1/60,preset.characterId,preset.build,3,true);
    near(weave.seconds,expected.staleWeave,`${preset.characterId} stale weave`);near(sweep.seconds,expected.staleSweep,`${preset.characterId} stale sweep`);
    assert.equal(weave.choice,'alley');assert.equal(sweep.choice,'boulevard');
    assert.ok(weave.branchRailSeconds>sweep.branchRailSeconds&&sweep.branchRailSeconds>0);
    assert.ok(weave.seconds>cleanSweep,'the narrow route loses its clean reward against clean wide driving');
    assert.ok(weave.seconds>sweep.seconds,'this measured 3s control error also loses against equally stale wide driving');
    return {character:preset.characterId,weave,sweep,lossToCleanSweep:weave.seconds-cleanSweep,lossToStaleSweep:weave.seconds-sweep.seconds};
  });
  const at60=clean.filter(row=>row.hz===60);
  near(Math.min(...at60.map(row=>row.reward)),38/60,'minimum clean reward');near(Math.max(...at60.map(row=>row.reward)),74/60,'maximum clean reward');
  near(Math.min(...error.map(row=>row.lossToCleanSweep)),79/60,'minimum loss to clean sweep');near(Math.max(...error.map(row=>row.lossToCleanSweep)),3.5,'maximum loss to clean sweep');
  near(Math.min(...error.map(row=>row.lossToStaleSweep)),.3,'minimum loss to equal-error sweep');near(Math.max(...error.map(row=>row.lossToStaleSweep)),62/60,'maximum loss to equal-error sweep');
  t.diagnostic(JSON.stringify({clean,staleBranchInput:error,scope:'Unchanged shared controls; finite, lane-clamped accepted physical progression; no traffic, items, arbitrary mixed parts, GPU or human-difficulty guarantee'}));
});

test('desert bounded branch-only steering delays report the actual default-build crossover',t=>{
  const results=[.4,.8,1.6,3].map(reaction=>({reaction,weave:pilot('alley',reaction),sweep:pilot('boulevard',reaction)}));
  for(const result of results){assert.equal(result.weave.choice,'alley');assert.equal(result.sweep.choice,'boulevard');}
  for(const result of results.slice(0,2)){assert.equal(result.weave.railSeconds,0);assert.equal(result.sweep.railSeconds,0);}
  assert.ok(results[2].weave.branchRailSeconds>results[2].sweep.branchRailSeconds);assert.ok(results[2].weave.seconds<results[2].sweep.seconds,'1.6s stale steering has not yet erased the distance reward');
  near(results[3].weave.seconds,77.75,'3s default weave');near(results[3].sweep.seconds,77.05,'3s default sweep');
  assert.ok(results[3].weave.seconds>results[3].sweep.seconds);assert.ok(results[3].weave.branchRailSeconds>7);
  t.diagnostic(JSON.stringify({recipe:'Hold the ordinary steering decision for the given interval only while on the selected branch; correct the approach and exit',results}));
});
