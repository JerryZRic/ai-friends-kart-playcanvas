import test from 'node:test';
import assert from 'node:assert/strict';
import {benchmarkForkDriving} from './helpers/fork-driving-benchmark';
import {getNpcPresets} from '../src/kart-presets';
import {currentRouteScenarios,routeMaps} from './helpers/current-route-scenarios';
import {verifyCurrentRouteInputs} from './helpers/current-route-inputs';
import frozen from './helpers/accepted-route-physics/current-results.json';

// These observations deliberately belong to the accepted current physics, not
// v1.0.1a. A shorter path can take longer with a particular grip/gearing profile.
// Historical constants remain unchanged in the separate historical replay.
verifyCurrentRouteInputs();
const presets=getNpcPresets('coast',20261010);
test('current route fixture covers every declared character, build, rate, branch and stale-input scenario',()=>{
 assert.equal(frozen.sourceCommit,'4d9b345f0cb938af092b57e4231396b03ff64858');
 assert.deepEqual(frozen.rows.map(({result,...scenario})=>scenario),currentRouteScenarios());
});
for(const map of routeMaps)test(`current ${map}: exact accepted route times, contacts and signed shortcut rewards across all five rates`,async t=>{
 const course=(await import(`../src/maps/${map}.ts`))[`${map.toUpperCase()}_COURSE`];
 const rows=frozen.rows.filter(row=>row.map===map),actual=[];
 for(const row of rows){
  const {character,preset,hz,branch,reaction,corrective,nativeFrame}=row;
  const build=preset==='default'?undefined:presets.find(p=>p.characterId===character&&p.presetId===preset)!.build;
  // The unmodified production benchmark rejects invalid progress, nonfinite
  // state and incomplete laps on every integration step. Current imports only.
  const result=benchmarkForkDriving(course,branch as 'alley'|'boulevard',corrective,1/hz,character,build,reaction,nativeFrame);
  assert.deepEqual(result,row.result,`${map}/${character}/${preset}/${hz}/${branch}/delay=${reaction}/corrective=${corrective}/native=${nativeFrame}`);
  assert.equal(result.choice,branch);
  assert.ok(Number.isFinite(result.seconds)&&result.seconds>0);
  assert.ok(result.railSeconds>=0&&result.branchRailSeconds>=0&&result.branchRailSeconds<=result.railSeconds+1e-9);
  if(corrective&&reaction===0){assert.equal(result.railSeconds,0);assert.equal(result.branchRailSeconds,0);}
  actual.push({...row,result});
 }
 const rewards=[],negative=[];
 for(const cut of actual.filter(r=>r.branch==='alley'&&r.corrective&&r.reaction===0&&r.nativeFrame)){
  const wide=actual.find(r=>r.branch==='boulevard'&&r.character===cut.character&&r.preset===cut.preset&&r.hz===cut.hz&&r.corrective&&r.reaction===0&&r.nativeFrame)!;
  const expectedCut=rows.find(r=>r.branch==='alley'&&r.character===cut.character&&r.preset===cut.preset&&r.hz===cut.hz&&r.corrective&&r.reaction===0&&r.nativeFrame)!;
  const expectedWide=rows.find(r=>r.branch==='boulevard'&&r.character===cut.character&&r.preset===cut.preset&&r.hz===cut.hz&&r.corrective&&r.reaction===0&&r.nativeFrame)!;
  const reward=wide.result.seconds-cut.result.seconds,expected=expectedWide.result.seconds-expectedCut.result.seconds;
  assert.equal(reward,expected,'signed reward is exact, including zero and negative cases; no positivity assumption');
  if(expected<0){assert.ok(reward<0,`${cut.character}/${cut.preset}/${cut.hz}: accepted slower narrow route must remain explicit`);negative.push({map,character:cut.character,preset:cut.preset,hz:cut.hz,rewardSeconds:reward});}
  rewards.push({character:cut.character,preset:cut.preset,hz:cut.hz,seconds:reward});
 }
 assert.deepEqual(negative,frozen.negativeCleanRewardCases.filter(row=>row.map===map),'every accepted negative reward stays explicitly enumerated');
 assert.equal(rewards.length,35,'seven builds retain all five refresh rates');
 t.diagnostic(JSON.stringify({map,signedCleanRewards:rewards}));
});
