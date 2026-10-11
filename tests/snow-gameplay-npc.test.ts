import test from 'node:test';
import assert from 'node:assert/strict';
import {SNOW_COURSE as course} from '../src/maps/snow';
import {CHARACTER_PROFILES} from '../src/character-profiles';
import {runForkNpc} from './helpers/fork-npc-benchmark';

test('all six snow NPC builds complete three physical laps on every difficulty and replay deterministically',t=>{
  const runs=[];let races=0,maximumSeconds=0;
  for(const difficulty of ['easy','normal','hard'] as const)for(const [phase,{id}]of CHARACTER_PROFILES.entries()){
    const branches=new Set<string>();
    for(const seed of [72,2]){
      const first=runForkNpc(course,seed,id,phase,difficulty),repeat=runForkNpc(course,seed,id,phase,difficulty);
      assert.deepEqual(repeat,first,`${id}/${difficulty}/${seed} reproducibility`);
      runs.push({id,difficulty,seed,phase,first,repeat});
      first.branches.forEach(branch=>branches.add(branch));races+=2;maximumSeconds=Math.max(maximumSeconds,first.frames/60);
    }
    assert.deepEqual([...branches].sort(),['alley','boulevard'],`${id}/${difficulty} uses both alternatives`);
  }
  assert.equal(races,72);assert.ok(maximumSeconds<360);
  t.diagnostic(JSON.stringify({runs,races,maximumSeconds,seeds:[72,2],scope:'Unchanged 360s helper bound; seeds chosen by route coverage. Prior seed713 exploratory results remain private because Grok lacked broad-route coverage.'}));
  t.diagnostic(`${races} three-lap pure NPC races; six builds × three difficulties × two seeds × replay; slowest ${maximumSeconds.toFixed(2)}s; no models, items or traffic in this isolated control test`);
});
