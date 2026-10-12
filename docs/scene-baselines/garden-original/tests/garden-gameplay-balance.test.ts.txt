import test from 'node:test';
import assert from 'node:assert/strict';
import {GARDEN_COURSE as course} from '../src/maps/garden';
import {benchmarkForkDriving} from './helpers/fork-driving-benchmark';
import {getNpcPresets} from '../src/kart-presets';
import {raceKartBuild} from '../src/kart-race';
// Frozen pre-production design observations. Every complete returned result is
// compared exactly; these do not grant branch boosts or alter the shared pilot.
// Character, build, physical branch, Hz, stale-input seconds, lap seconds,
// rail seconds, branch seconds, branch rail seconds. All runs are ONE lap.
const frozen:readonly (readonly [string,string,'alley'|'boulevard',number,number,number,number,number,number])[]=[["whale","default","alley",60,0,74.8666666666637,0,11.099999999999369,0],
 ["whale","default","boulevard",60,0,75.78333333333032,0,12.03333333333265,0],
 ["whale","default","alley",60,0.4,74.8666666666637,0,11.099999999999369,0],
 ["whale","default","boulevard",60,0.4,75.78333333333032,0,12.03333333333265,0],
 ["whale","default","alley",60,0.8,74.8666666666637,0,11.099999999999369,0],
 ["whale","default","boulevard",60,0.8,75.78333333333032,0,12.03333333333265,0],
 ["whale","default","alley",60,1.6,75.36666666666368,0.8833333333333344,11.59999999999934,0.8833333333333344],
 ["whale","default","boulevard",60,1.6,75.93333333333031,0.2833333333333333,12.18333333333264,0.2833333333333333],
 ["whale","default","alley",60,3,77.9833333333302,5.833333333333318,14.233333333332524,5.833333333333318],
 ["whale","default","boulevard",60,3,76.96666666666358,2.3166666666666633,13.216666666665915,2.3166666666666633],
 ["whale","default","alley",30,0,74.8666666666637,0,11.099999999999369,0],
 ["whale","default","boulevard",30,0,75.78333333333032,0,12.03333333333265,0],
 ["whale","default","alley",144,0,74.86111111109813,0,11.104166666664142,0],
 ["whale","default","boulevard",144,0,75.78472222220903,0,12.034722222219486,0],
 ["whale","balanced","alley",30,0,74.83333333333037,0,11.116666666666035,0],
 ["whale","balanced","boulevard",30,0,75.74999999999699,0,12.03333333333265,0],
 ["whale","balanced","alley",60,0,74.83333333333037,0,11.116666666666035,0],
 ["whale","balanced","boulevard",60,0,75.74999999999699,0,12.03333333333265,0],
 ["whale","balanced","alley",120,0,74.82500000000562,0,11.108333333332702,0],
 ["whale","balanced","boulevard",120,0,75.75833333333969,0,12.03333333333265,0],
 ["whale","balanced","alley",144,0,74.82638888887591,0,11.111111111108585,0],
 ["whale","balanced","boulevard",144,0,75.75694444443126,0,12.034722222219486,0],
 ["whale","balanced","alley",240,0,74.82916666668078,0,11.104166666675503,0],
 ["whale","balanced","boulevard",240,0,75.75416666667994,0,12.03333333334291,0],
 ["gemini","corner","alley",30,0,76.0833333333303,0,11.083333333332703,0],
 ["gemini","corner","boulevard",30,0,77.1999999999969,0,12.199999999999307,0],
 ["gemini","corner","alley",60,0,76.0833333333303,0,11.083333333332703,0],
 ["gemini","corner","boulevard",60,0,77.1999999999969,0,12.199999999999307,0],
 ["gemini","corner","alley",120,0,76.08333333333995,0,11.083333333332703,0],
 ["gemini","corner","boulevard",120,0,77.19166666667417,0,12.199999999999307,0],
 ["gemini","corner","alley",144,0,76.08333333332007,0,11.090277777775256,0],
 ["gemini","corner","boulevard",144,0,77.19444444443093,0,12.201388888886115,0],
 ["gemini","corner","alley",240,0,76.07916666667964,0,11.087500000008824,0],
 ["gemini","corner","boulevard",240,0,77.19583333334529,0,12.200000000009709,0],
 ["gpt","straight","alley",30,0,63.899999999997654,0,9.583333333332789,0],
 ["gpt","straight","boulevard",30,0,64.54999999999762,0,10.249999999999417,0],
 ["gpt","straight","alley",60,0,63.899999999997654,0,9.583333333332789,0],
 ["gpt","straight","boulevard",60,0,64.54999999999762,0,10.249999999999417,0],
 ["gpt","straight","alley",120,0,63.89166666666368,0,9.583333333332789,0],
 ["gpt","straight","boulevard",120,0,64.54999999999744,0,10.241666666666084,0],
 ["gpt","straight","alley",144,0,63.895833333322834,0,9.583333333331154,0],
 ["gpt","straight","boulevard",144,0,64.55555555554491,0,10.236111111108784,0],
 ["gpt","straight","alley",240,0,63.89583333335722,0,9.58333333334096,0],
 ["gpt","straight","boulevard",240,0,64.55416666669012,0,10.241666666674817,0],
 ["claude","start-hill","alley",30,0,80.06666666666341,0,11.783333333332664,0],
 ["claude","start-hill","boulevard",30,0,81.18333333333001,0,12.916666666665932,0],
 ["claude","start-hill","alley",60,0,80.06666666666341,0,11.783333333332664,0],
 ["claude","start-hill","boulevard",60,0,81.18333333333001,0,12.916666666665932,0],
 ["claude","start-hill","alley",120,0,80.05833333334311,0,11.783333333332664,0],
 ["claude","start-hill","boulevard",120,0,81.18333333334401,0,12.9083333333326,0],
 ["claude","start-hill","alley",144,0,80.05555555554139,0,11.7777777777751,0],
 ["claude","start-hill","boulevard",144,0,81.18749999998558,0,12.909722222219287,0],
 ["claude","start-hill","alley",240,0,80.05833333334269,0,11.78750000000938,0],
 ["claude","start-hill","boulevard",240,0,81.18333333334166,0,12.908333333343606,0],
 ["grok","impact","alley",30,0,67.89999999999743,0,9.916666666666103,0],
 ["grok","impact","boulevard",30,0,68.84999999999738,0,10.866666666666049,0],
 ["grok","impact","alley",60,0,67.89999999999743,0,9.916666666666103,0],
 ["grok","impact","boulevard",60,0,68.84999999999738,0,10.866666666666049,0],
 ["grok","impact","alley",120,0,67.90833333333345,0,9.924999999999436,0],
 ["grok","impact","boulevard",120,0,68.84166666666752,0,10.858333333332716,0],
 ["grok","impact","alley",144,0,67.90277777776637,0,9.916666666664412,0],
 ["grok","impact","boulevard",144,0,68.8472222222106,0,10.861111111108642,0],
 ["grok","impact","alley",240,0,67.90416666668708,0,9.920833333341228,0],
 ["grok","impact","boulevard",240,0,68.84583333335289,0,10.858333333341974,0],
 ["glm","balanced","alley",30,0,66.63333333333084,0,9.84999999999944,0],
 ["glm","balanced","boulevard",30,0,67.44999999999746,0,10.66666666666606,0],
 ["glm","balanced","alley",60,0,66.63333333333084,0,9.84999999999944,0],
 ["glm","balanced","boulevard",60,0,67.44999999999746,0,10.66666666666606,0],
 ["glm","balanced","alley",120,0,66.63333333333243,0,9.841666666666107,0],
 ["glm","balanced","boulevard",120,0,67.44999999999975,0,10.658333333332727,0],
 ["glm","balanced","alley",144,0,66.63194444443333,0,9.84027777777554,0],
 ["glm","balanced","boulevard",144,0,67.45138888887759,0,10.659722222219798,0],
 ["glm","balanced","alley",240,0,66.62916666668823,0,9.841666666674499,0],
 ["glm","balanced","boulevard",240,0,67.45000000002082,0,10.658333333341815,0],
 ["whale","balanced","alley",60,3,77.9333333333302,5.866666666666651,14.216666666665859,5.866666666666651],
 ["whale","balanced","boulevard",60,3,76.93333333333025,2.3166666666666633,13.19999999999925,2.3166666666666633],
 ["gemini","corner","alley",60,3,80.29999999999673,8.349999999999994,15.06666666666581,8.333333333333327],
 ["gemini","corner","boulevard",60,3,79.0499999999968,3.766666666666658,14.066666666665867,3.766666666666658],
 ["gpt","straight","alley",60,3,65.0499999999976,2.3166666666666633,10.749999999999389,2.3166666666666633],
 ["gpt","straight","boulevard",60,3,65.51666666666424,1.8333333333333317,11.216666666666029,1.8333333333333317],
 ["claude","start-hill","alley",60,3,83.54999999999654,7.483333333333312,15.116666666665807,7.483333333333312],
 ["claude","start-hill","boulevard",60,3,82.24999999999662,2.4333333333333296,13.966666666665873,2.4333333333333296],
 ["grok","impact","alley",60,3,70.81666666666393,5.566666666666652,12.833333333332604,5.566666666666652],
 ["grok","impact","boulevard",60,3,70.1999999999973,2.633333333333329,12.216666666665972,2.633333333333329],
 ["glm","balanced","alley",60,3,69.1333333333307,5.016666666666654,12.349999999999298,5.016666666666654],
 ["glm","balanced","boulevard",60,3,68.73333333333072,2.2999999999999967,11.94999999999932,2.28333333333333]];

test('garden frozen 86 one-lap player runs preserve all 60 clean build × rate × route results and the honest stale-input counterexample',t=>{
 const presets=getNpcPresets('coast',20261010),runs=[];
 for(const [character,preset,branch,hz,reaction,seconds,railSeconds,branchSeconds,branchRailSeconds]of frozen){
  const build=preset==='default'?raceKartBuild(''):presets.find(p=>p.characterId===character&&p.presetId===preset)!.build;
  const result=benchmarkForkDriving(course,branch,true,1/hz,character,build,reaction,true);
  assert.deepEqual(result,{seconds,railSeconds,branchSeconds,branchRailSeconds,choice:branch},`${character}/${preset}/${branch}/${hz}/${reaction} full frozen design replay`);
  runs.push({character,preset,branch,hz,reaction,...result});
 }
 assert.equal(runs.length,86);
 const clean=runs.filter(r=>r.preset!=='default'&&r.reaction===0);assert.equal(clean.length,60);
 for(const row of clean){assert.equal(row.railSeconds,0);assert.equal(row.branchRailSeconds,0);}
 const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} versus ${b}`),summary=[];
 for(const {characterId:character}of presets){
  const group=clean.filter(r=>r.character===character),cut=group.find(r=>r.hz===60&&r.branch==='alley')!,wide=group.find(r=>r.hz===60&&r.branch==='boulevard')!;
  for(const branch of ['alley','boulevard']){const times=group.filter(r=>r.branch===branch).map(r=>r.seconds);assert.ok(Math.max(...times)-Math.min(...times)<=.0112,'physical refresh equivalence');}
  assert.ok(wide.seconds>cut.seconds);
  const staleCut=runs.find(r=>r.character===character&&r.preset!=='default'&&r.reaction===3&&r.branch==='alley')!,staleWide=runs.find(r=>r.character===character&&r.preset!=='default'&&r.reaction===3&&r.branch==='boulevard')!;
  assert.ok(staleCut.seconds>wide.seconds,'every stale technical run loses to CLEAN broad driving');
  assert.ok(staleCut.branchRailSeconds>staleWide.branchRailSeconds&&staleWide.branchRailSeconds>0);
  if(character==='gpt')near(staleCut.seconds-staleWide.seconds,-28/60);
  else assert.ok(staleCut.seconds>staleWide.seconds);
  summary.push({character,cleanReward:wide.seconds-cut.seconds,staleTechnicalVsCleanBroad:staleCut.seconds-wide.seconds,staleTechnicalVsEquallyStaleBroad:staleCut.seconds-staleWide.seconds});
 }
 near(Math.min(...summary.map(r=>r.cleanReward)),39/60);near(Math.max(...summary.map(r=>r.cleanReward)),67/60);
 const defaults=runs.filter(r=>r.preset==='default'&&r.hz===60);
 near(defaults.find(r=>r.branch==='alley'&&r.reaction===0)!.seconds,74.86666666666667);
 near(defaults.find(r=>r.branch==='boulevard'&&r.reaction===0)!.seconds,75.78333333333333);
 const mild=defaults.find(r=>r.branch==='alley'&&r.reaction===.8)!;near(mild.railSeconds,0);
 t.diagnostic(JSON.stringify({runs,summary,playerLapsPerRun:1,cleanBuildRateRouteRuns:60,resources:{maxRSSKiB:process.resourceUsage().maxRSS},scope:'Unchanged shared pilot and physics; finite accepted physical progression. GPT equally stale broad is 0.467s slower than stale technical. Not a universal reversal, human difficulty, arbitrary mixed-part, traffic, item or GPU claim.'}));
});
