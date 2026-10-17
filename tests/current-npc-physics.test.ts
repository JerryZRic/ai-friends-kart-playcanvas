import test from 'node:test';
import assert from 'node:assert/strict';
import {AIRFIELD_COURSE} from '../src/maps/airfield';
import {CALDERA_COURSE} from '../src/maps/caldera';
import {GARDEN_COURSE} from '../src/maps/garden';
import {runForkNpc} from './helpers/fork-npc-benchmark';

const ids=['whale','gemini','gpt','claude','grok','glm'] as const;
const difficulties=['easy','normal','hard'] as const;
const seeds=[72,713] as const;
// Accepted current tuning measured on 2026-10-16 with the unchanged seeded NPC
// controls: observed maxima 271.317s, 326.283s, 249.417s respectively. These
// rounded completion guardrails remain stricter than the original 360s helper
// timeout. They are safety/completion budgets, not new golden rows or a claim
// that character pace, difficulty ordering, items or multiplayer are balanced.
const cases=[
 {map:'airfield',course:AIRFIELD_COURSE,maximumSeconds:300,observedSeconds:[241.93333333333334,271.31666666666666]},
 {map:'caldera',course:CALDERA_COURSE,maximumSeconds:350,observedSeconds:[275.73333333333335,326.28333333333336]},
 {map:'garden',course:GARDEN_COURSE,maximumSeconds:275,observedSeconds:[228.08333333333334,249.41666666666666]},
] as const;
for(const {map,course,maximumSeconds,observedSeconds}of cases)test(`${map} current production NPCs: six builds × three difficulties × two fixed seeds, three laps, both branches, safe motion and exact replay`,t=>{
 const runs=[],coverage=new Map<string,Set<string>>();
 for(const difficulty of difficulties)for(const [phase,id]of ids.entries())for(const seed of seeds){
  // Deliberately imports the real current helper and current src modules. The
  // helper asserts every physics step is finite, supported, within lane/cursor
  // limits and accepted by the route runtime; all gates and three laps must end.
  const first=runForkNpc(course,seed,id,phase,difficulty),repeat=runForkNpc(course,seed,id,phase,difficulty);
  const label=`${map}/${id}/${difficulty}/${seed}`;
  assert.deepEqual(repeat,first,`${label}: exact complete current replay`);
  assert.ok(first.frames>0&&first.frames/60<maximumSeconds,`${label}: ${first.frames/60}s exceeds ${maximumSeconds}s completion guard`);
  assert.equal(first.finish.lap,3,`${label}: finished all three laps`);
  assert.equal(first.finish.edgeId,'start');assert.equal(first.finish.s,0);
  assert.equal(first.branches.length,3,`${label}: one recorded branch per completed lap`);
  assert.equal(Object.keys(first.finish.choiceByLap).length,3);
  assert.ok(first.branches.every(branch=>branch==='alley'||branch==='boulevard'));
  assert.ok(first.brakeFrames>0&&first.brakeFrames<=first.frames,`${label}: real braking is exercised`);
  assert.ok(first.driftFrames>=0&&first.driftFrames<=first.frames);
  if(difficulty==='easy')assert.equal(first.driftFrames,0,`${label}: easy does not drift`);
  else assert.ok(first.driftFrames>0,`${label}: current normal/hard drift controller exercised`);
  assert.ok(Number.isFinite(first.maxStep)&&first.maxStep>0);
  const key=id+'/'+difficulty,branches=coverage.get(key)??new Set<string>();first.branches.forEach(branch=>branches.add(branch));coverage.set(key,branches);
  runs.push({id,difficulty,seed,phase,diagnostics:first});
 }
 assert.equal(runs.length,36);assert.equal(coverage.size,18);
 for(const [key,branches]of coverage)assert.deepEqual([...branches].sort(),['alley','boulevard'],`${map}/${key}: both branches across the fixed seeds`);
 const measuredSeconds=[Math.min(...runs.map(row=>row.diagnostics.frames/60)),Math.max(...runs.map(row=>row.diagnostics.frames/60))];
 t.diagnostic(JSON.stringify({map,currentProduction:true,runs,racesIncludingReplay:72,lapsPerRun:3,seeds,completionBudgetSeconds:maximumSeconds,observedAtAlignmentSeconds:observedSeconds,measuredSeconds,scope:'Current accepted tuning: deterministic completion, branch coverage and per-frame support/lane/finite-state safety only. Not a fairness, difficulty ordering, item combat, GPU or performance certification.'}));
});
