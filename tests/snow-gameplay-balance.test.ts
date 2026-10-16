import {historicalRoutePhysics} from './helpers/historical-route-physics';
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
const historical=await historicalRoutePhysics();
after(()=>historical.dispose());
const {benchmarkForkDriving,getNpcPresets,raceKartBuild}=historical;
const course=await historical.course('snow');




// Read-only design pilots used the same helpers, seed, native 1/60s substeps,
// throttle, starting lane -2 and ordinary steering deadband .35. These values
// are regression observations, not a speed bonus or universal human balance rule.
const measured60={
  "whale": {
    "cut": 96.24999999999582,
    "sweep": 96.88333333332912,
    "staleCut": 100.34999999999559,
    "staleSweep": 98.43333333332903
  },
  "gemini": {
    "cut": 98.24999999999571,
    "sweep": 99.18333333332899,
    "staleCut": 103.24999999999542,
    "staleSweep": 102.06666666666216
  },
  "gpt": {
    "cut": 81.71666666666331,
    "sweep": 81.99999999999663,
    "staleCut": 83.29999999999656,
    "staleSweep": 82.74999999999659
  },
  "claude": {
    "cut": 103.41666666666208,
    "sweep": 104.31666666666203,
    "staleCut": 107.33333333332853,
    "staleSweep": 105.51666666666196
  },
  "grok": {
    "cut": 87.49999999999632,
    "sweep": 88.23333333332961,
    "staleCut": 91.31666666666277,
    "staleSweep": 90.03333333332951
  },
  "glm": {
    "cut": 85.5666666666631,
    "sweep": 86.11666666666306,
    "staleCut": 89.03333333332957,
    "staleSweep": 87.29999999999633
  }
};
const near=(actual:number,expected:number,label:string)=>assert.ok(Math.abs(actual-expected)<1e-7,`${label}: ${actual} versus private design ${expected}`);
const pilot=(branch:'alley'|'boulevard',reaction=0,hz=60)=>benchmarkForkDriving(course,branch,true,1/hz,'whale',undefined,reaction,true);

test('historical v1.0.1a: snow default clean physical routes reproduce 96.283s / 96.917s with zero rail contact',t=>{
  const runs=[],cut=pilot('alley'),sweep=pilot('boulevard');
  runs.push({branch:'alley',hz:60,...cut},{branch:'boulevard',hz:60,...sweep});
  near(cut.seconds,96.28333333333333,'cut');near(sweep.seconds,96.91666666666667,'sweep');
  near(sweep.seconds-cut.seconds,38/60,'physical reward');
  for(const result of [cut,sweep])assert.equal(result.railSeconds,0);
  assert.equal(cut.choice,'alley');assert.equal(sweep.choice,'boulevard');
  for(const hz of [30,144])for(const branch of ['alley','boulevard']as const){const result=pilot(branch,0,hz);assert.equal(result.railSeconds,0);assert.equal(result.choice,branch);assert.ok(Math.abs(result.seconds-(branch==='alley'?cut:sweep).seconds)<.009);runs.push({branch,hz,...result});}
  t.diagnostic(JSON.stringify({initialRuns:runs}));
});

test('historical v1.0.1a: snow all six character/build pairs complete both physical branches cleanly at 30/60/120/144/240Hz',t=>{
  const clean=[];
  for(const preset of getNpcPresets('coast',20261010))for(const hz of [30,60,120,144,240]){
    const cut=benchmarkForkDriving(course,'alley',true,1/hz,preset.characterId,preset.build,0,true);
    const sweep=benchmarkForkDriving(course,'boulevard',true,1/hz,preset.characterId,preset.build,0,true);
    assert.equal(cut.choice,'alley');assert.equal(sweep.choice,'boulevard');
    for(const result of [cut,sweep]){assert.equal(result.railSeconds,0);assert.equal(result.branchRailSeconds,0);assert.ok(Number.isFinite(result.seconds)&&result.seconds>0);}
    assert.ok(sweep.seconds>cut.seconds,'real 50.265m distance saving rewards a clean route');
    if(hz===60){const expected=measured60[preset.characterId];near(cut.seconds,expected.cut,`${preset.characterId} cut`);near(sweep.seconds,expected.sweep,`${preset.characterId} sweep`);}
    clean.push({character:preset.characterId,preset:preset.presetId,hz,cut:cut.seconds,sweep:sweep.seconds,reward:sweep.seconds-cut.seconds,cutResult:cut,sweepResult:sweep});
  }
  for(const id of new Set(clean.map(row=>row.character))){
    const group=clean.filter(row=>row.character===id);
    for(const branch of ['cut','sweep']as const)assert.ok(Math.max(...group.map(row=>row[branch]))-Math.min(...group.map(row=>row[branch]))<=1/120+1e-7,`${id}: refresh-rate physical equivalence`);
  }
  const error=getNpcPresets('coast',20261010).map(preset=>{
    const expected=measured60[preset.characterId],cleanSweep=clean.find(row=>row.character===preset.characterId&&row.hz===60)!.sweep;
    const cut=benchmarkForkDriving(course,'alley',true,1/60,preset.characterId,preset.build,3,true);
    const sweep=benchmarkForkDriving(course,'boulevard',true,1/60,preset.characterId,preset.build,3,true);
    near(cut.seconds,expected.staleCut,`${preset.characterId} stale cut`);near(sweep.seconds,expected.staleSweep,`${preset.characterId} stale sweep`);
    assert.equal(cut.choice,'alley');assert.equal(sweep.choice,'boulevard');
    assert.ok(cut.branchRailSeconds>sweep.branchRailSeconds&&sweep.branchRailSeconds>0);
    assert.ok(cut.seconds>cleanSweep,'the narrow route loses its clean reward against clean wide driving');
    assert.ok(cut.seconds>sweep.seconds,'this measured 3s control error also loses against equally stale wide driving');
    return {character:preset.characterId,cut,sweep,lossToCleanSweep:cut.seconds-cleanSweep,lossToStaleSweep:cut.seconds-sweep.seconds};
  });
  const at60=clean.filter(row=>row.hz===60);
  near(Math.min(...at60.map(row=>row.reward)),17/60,'minimum clean reward');near(Math.max(...at60.map(row=>row.reward)),56/60,'maximum clean reward');
  near(Math.min(...error.map(row=>row.lossToCleanSweep)),1.3,'minimum loss to clean sweep');near(Math.max(...error.map(row=>row.lossToCleanSweep)),244/60,'maximum loss to clean sweep');
  near(Math.min(...error.map(row=>row.lossToStaleSweep)),.55,'minimum loss to equal-error sweep');near(Math.max(...error.map(row=>row.lossToStaleSweep)),115/60,'maximum loss to equal-error sweep');
  t.diagnostic(JSON.stringify({clean,staleBranchInput:error,scope:'Unchanged shared controls; finite, lane-clamped accepted physical progression; no traffic, items, arbitrary mixed parts, GPU or human-difficulty guarantee'}));
});

test('historical v1.0.1a: snow bounded branch-only steering delays report the actual default-build crossover',t=>{
  const results=[.4,.8,1.6,3].map(reaction=>({reaction,cut:pilot('alley',reaction),sweep:pilot('boulevard',reaction)}));
  for(const result of results){assert.equal(result.cut.choice,'alley');assert.equal(result.sweep.choice,'boulevard');}
  assert.equal(results[0].cut.railSeconds,0);assert.equal(results[0].sweep.railSeconds,0);
  near(results[1].cut.railSeconds,.05,'0.8s branch delay produces a measured small cut rail contact');assert.equal(results[1].sweep.railSeconds,0);
  assert.ok(results[2].cut.branchRailSeconds>results[2].sweep.branchRailSeconds);assert.ok(results[2].cut.seconds<results[2].sweep.seconds,'1.6s stale steering has not yet erased the distance reward');
  near(results[3].cut.seconds,100.38333333333334,'3s default cut');near(results[3].sweep.seconds,98.48333333333333,'3s default sweep');
  assert.ok(results[3].cut.seconds>results[3].sweep.seconds);assert.ok(results[3].cut.branchRailSeconds>7);
  t.diagnostic(JSON.stringify({recipe:'Hold the ordinary steering decision for the given interval only while on the selected branch; correct the approach and exit',results}));
});
