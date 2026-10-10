import test from 'node:test';
import assert from 'node:assert/strict';
import {TOWN_COURSE} from '../src/maps/town';
import {benchmarkTownDriving} from './helpers/town-driving-benchmark';
import {getNpcPresets} from '../src/kart-presets';

test('original town geometry gives a modest clean alley advantage that uncorrected rail contact loses',t=>{
 const boulevard=benchmarkTownDriving(TOWN_COURSE,'boulevard',true),clean=benchmarkTownDriving(TOWN_COURSE,'alley',true),scraped=benchmarkTownDriving(TOWN_COURSE,'alley',false);
 const advantage=boulevard.seconds-clean.seconds;
 assert.ok(advantage>.3&&advantage<1.1,`clean physical advantage ${advantage}s`);
 assert.ok(scraped.seconds>boulevard.seconds,`uncorrected alley ${scraped.seconds}s, clean boulevard ${boulevard.seconds}s`);
 assert.ok(clean.railSeconds<.1);assert.ok(scraped.branchRailSeconds>1);assert.ok(scraped.seconds-clean.seconds>.8);
 t.diagnostic(JSON.stringify({boulevard,clean,scraped}));
});
test('all six physical kart builds complete both branches at 30/60/120/144/240Hz without stall or lost choice',()=>{
 for(const preset of getNpcPresets('coast',20261010))for(const hz of [30,60,120,144,240])for(const branch of ['alley','boulevard'] as const){
   const result=benchmarkTownDriving(TOWN_COURSE,branch,true,1/hz,preset.characterId,preset.build);
   assert.equal(result.choice,branch,`${preset.characterId} ${hz}Hz`);
   assert.ok(Number.isFinite(result.seconds)&&result.seconds>20&&result.seconds<90,`${preset.characterId} ${hz}Hz ${branch}: ${result.seconds}`);
   assert.ok(result.branchSeconds>5&&result.branchSeconds<30);
 }
});
