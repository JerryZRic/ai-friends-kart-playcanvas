import test from 'node:test';
import assert from 'node:assert/strict';
import {AIRFIELD_COURSE as course} from '../src/maps/airfield';
import {benchmarkForkDriving} from './helpers/fork-driving-benchmark';
import {getNpcPresets} from '../src/kart-presets';
import {raceKartBuild} from '../src/kart-race';
// Frozen pre-production design observations. Every complete returned result is
// compared exactly; these do not grant branch boosts or alter the shared pilot.
// Character, build, physical branch, Hz, stale-input seconds, lap seconds,
// rail seconds, branch seconds, branch rail seconds. All runs are ONE lap.
const frozen:readonly (readonly [string,string,'alley'|'boulevard',number,number,number,number,number,number])[]=
 [["whale","default","alley",60,0,81.59999999999665,0,10.483333333332737,0],
 ["whale","default","boulevard",60,0,82.83333333332992,0,11.733333333332666,0],
 ["whale","default","alley",60,0.4,81.59999999999665,0,10.483333333332737,0],
 ["whale","default","boulevard",60,0.4,82.83333333332992,0,11.733333333332666,0],
 ["whale","default","alley",60,0.8,81.59999999999665,0,10.483333333332737,0],
 ["whale","default","boulevard",60,0.8,82.83333333332992,0,11.733333333332666,0],
 ["whale","default","alley",60,1.6,82.04999999999663,0.966666666666668,10.933333333332712,0.966666666666668],
 ["whale","default","boulevard",60,1.6,82.98333333332991,0.2833333333333333,11.883333333332658,0.2833333333333333],
 ["whale","default","alley",60,3,84.23333333332984,5.166666666666654,13.133333333332587,5.166666666666654],
 ["whale","default","boulevard",60,3,83.96666666666319,2.3166666666666633,12.84999999999927,2.3166666666666633],
 ["whale","default","alley",30,0,81.59999999999665,0,10.483333333332737,0],
 ["whale","default","boulevard",30,0,82.83333333332992,0,11.733333333332666,0],
 ["whale","default","alley",144,0,81.5972222222077,0,10.479166666664284,0],
 ["whale","default","boulevard",144,0,82.83333333331854,0,11.729166666664,0],
 ["whale","balanced","alley",30,0,81.56666666666332,0,10.466666666666072,0],
 ["whale","balanced","boulevard",30,0,82.79999999999659,0,11.733333333332666,0],
 ["whale","balanced","alley",60,0,81.56666666666332,0,10.466666666666072,0],
 ["whale","balanced","boulevard",60,0,82.79999999999659,0,11.733333333332666,0],
 ["whale","balanced","alley",120,0,81.56666666667765,0,10.483333333332737,0],
 ["whale","balanced","boulevard",120,0,82.80000000001196,0,11.716666666666,0],
 ["whale","balanced","alley",144,0,81.56249999998549,0,10.479166666664284,0],
 ["whale","balanced","boulevard",144,0,82.80555555554076,0,11.722222222219557,0],
 ["whale","balanced","alley",240,0,81.56666666667465,0,10.479166666675006,0],
 ["whale","balanced","boulevard",240,0,82.80416666667352,0,11.72500000000933,0],
 ["gemini","corner","alley",30,0,83.54999999999654,0,10.583333333332732,0],
 ["gemini","corner","boulevard",30,0,84.86666666666314,0,11.91666666666599,0],
 ["gemini","corner","alley",60,0,83.54999999999654,0,10.583333333332732,0],
 ["gemini","corner","boulevard",60,0,84.86666666666314,0,11.91666666666599,0],
 ["gemini","corner","alley",120,0,83.54166666667922,0,10.583333333332732,0],
 ["gemini","corner","boulevard",120,0,84.85833333334693,0,11.908333333332656,0],
 ["gemini","corner","alley",144,0,83.54166666665171,0,10.583333333330927,0],
 ["gemini","corner","boulevard",144,0,84.86111111109585,0,11.902777777775071,0],
 ["gemini","corner","alley",240,0,83.54166666667285,0,10.587500000008426,0],
 ["gemini","corner","boulevard",240,0,84.86250000000499,0,11.90833333334281,0],
 ["gpt","straight","alley",30,0,69.06666666666403,0,8.933333333332829,0],
 ["gpt","straight","boulevard",30,0,70.08333333333064,0,9.966666666666104,0],
 ["gpt","straight","alley",60,0,69.06666666666403,0,8.933333333332829,0],
 ["gpt","straight","boulevard",60,0,70.08333333333064,0,9.966666666666104,0],
 ["gpt","straight","alley",120,0,69.0666666666677,0,8.941666666666162,0],
 ["gpt","straight","boulevard",120,0,70.08333333333518,0,9.949999999999438,0],
 ["gpt","straight","alley",144,0,69.06944444443278,0,8.937499999997968,0],
 ["gpt","straight","boulevard",144,0,70.08333333332143,0,9.958333333331069,0],
 ["gpt","straight","alley",240,0,69.07083333335268,0,8.937500000003794,0],
 ["gpt","straight","boulevard",240,0,70.08333333335176,0,9.958333333337933,0],
 ["claude","start-hill","alley",30,0,87.7999999999963,0,11.216666666666029,0],
 ["claude","start-hill","boulevard",30,0,89.16666666666289,0,12.599999999999284,0],
 ["claude","start-hill","alley",60,0,87.7999999999963,0,11.216666666666029,0],
 ["claude","start-hill","boulevard",60,0,89.16666666666289,0,12.599999999999284,0],
 ["claude","start-hill","alley",120,0,87.7916666666826,0,11.216666666666029,0],
 ["claude","start-hill","boulevard",120,0,89.1666666666837,0,12.599999999999284,0],
 ["claude","start-hill","alley",144,0,87.79166666665074,0,11.215277777775228,0],
 ["claude","start-hill","boulevard",144,0,89.16666666665043,0,12.597222222219358,0],
 ["claude","start-hill","alley",240,0,87.79166666666899,0,11.220833333342263,0],
 ["claude","start-hill","boulevard",240,0,89.16666666666774,0,12.591666666676687,0],
 ["grok","impact","alley",30,0,74.34999999999707,0,9.4333333333328,0],
 ["grok","impact","boulevard",30,0,75.499999999997,0,10.599999999999401,0],
 ["grok","impact","alley",60,0,74.34999999999707,0,9.4333333333328,0],
 ["grok","impact","boulevard",60,0,75.499999999997,0,10.599999999999401,0],
 ["grok","impact","alley",120,0,74.3416666666719,0,9.424999999999468,0],
 ["grok","impact","boulevard",120,0,75.50000000000615,0,10.591666666666068,0],
 ["grok","impact","alley",144,0,74.34027777776491,0,9.430555555553411,0],
 ["grok","impact","boulevard",144,0,75.49999999998687,0,10.59027777777537,0],
 ["grok","impact","alley",240,0,74.34166666668122,0,9.429166666672764,0],
 ["grok","impact","boulevard",240,0,75.49583333334684,0,10.587500000007019,0],
 ["glm","balanced","alley",30,0,72.54999999999717,0,9.28333333333281,0],
 ["glm","balanced","boulevard",30,0,73.66666666666377,0,10.383333333332747,0],
 ["glm","balanced","alley",60,0,72.54999999999717,0,9.28333333333281,0],
 ["glm","balanced","boulevard",60,0,73.66666666666377,0,10.383333333332747,0],
 ["glm","balanced","alley",120,0,72.55833333333715,0,9.274999999999476,0],
 ["glm","balanced","boulevard",120,0,73.65833333333802,0,10.383333333332747,0],
 ["glm","balanced","alley",144,0,72.5555555555431,0,9.277777777775668,0],
 ["glm","balanced","boulevard",144,0,73.65972222220951,0,10.381944444442084,0],
 ["glm","balanced","alley",240,0,72.55416666668285,0,9.275000000005338,0],
 ["glm","balanced","boulevard",240,0,73.65833333334851,0,10.38333333333955,0],
 ["whale","balanced","alley",60,3,84.18333333332984,5.18333333333332,13.099999999999255,5.18333333333332],
 ["whale","balanced","boulevard",60,3,83.91666666666319,2.3166666666666633,12.833333333332604,2.3166666666666633],
 ["gemini","corner","alley",60,3,86.96666666666302,5.33333333333332,13.999999999999204,5.33333333333332],
 ["gemini","corner","boulevard",60,3,86.79999999999636,3.7499999999999916,13.849999999999213,3.7499999999999916],
 ["gpt","straight","alley",60,3,70.26666666666397,2.716666666666662,10.13333333333276,2.716666666666662],
 ["gpt","straight","boulevard",60,3,70.99999999999726,1.8333333333333317,10.883333333332718,1.8333333333333317],
 ["claude","start-hill","alley",60,3,90.48333333332948,4.716666666666655,13.89999999999921,4.716666666666655],
 ["claude","start-hill","boulevard",60,3,90.19999999999617,2.3166666666666633,13.616666666665893,2.3166666666666633],
 ["grok","impact","alley",60,3,76.53333333333028,4.39999999999999,11.61666666666601,4.383333333333323],
 ["grok","impact","boulevard",60,3,76.83333333333026,2.583333333333329,11.916666666665993,2.5666666666666624],
 ["glm","balanced","alley",60,3,74.51666666666372,3.3333333333333264,11.249999999999364,3.3333333333333264],
 ["glm","balanced","boulevard",60,3,74.94999999999703,2.2666666666666635,11.666666666666007,2.2666666666666635]];

test('airfield frozen 86 one-lap player runs preserve all 60 clean build × rate × route results and the honest stale-input counterexamples',t=>{
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
  for(const branch of ['alley','boulevard']){const times=group.filter(r=>r.branch===branch).map(r=>r.seconds);assert.ok(Math.max(...times)-Math.min(...times)<=.01,'physical refresh equivalence');}
  assert.ok(wide.seconds>cut.seconds);
  const staleCut=runs.find(r=>r.character===character&&r.preset!=='default'&&r.reaction===3&&r.branch==='alley')!,staleWide=runs.find(r=>r.character===character&&r.preset!=='default'&&r.reaction===3&&r.branch==='boulevard')!;
  assert.ok(staleCut.seconds>wide.seconds,'every stale technical run loses to CLEAN broad driving');
  assert.ok(staleCut.branchRailSeconds>staleWide.branchRailSeconds&&staleWide.branchRailSeconds>0);
  if(character==='gpt')near(staleCut.seconds-staleWide.seconds,-44/60);
  else if(character==='glm')near(staleCut.seconds-staleWide.seconds,-26/60);
  else if(character==='grok')near(staleCut.seconds-staleWide.seconds,-18/60);
  else assert.ok(staleCut.seconds>staleWide.seconds);
  summary.push({character,cleanReward:wide.seconds-cut.seconds,staleTechnicalVsCleanBroad:staleCut.seconds-wide.seconds,staleTechnicalVsEquallyStaleBroad:staleCut.seconds-staleWide.seconds});
 }
 near(Math.min(...summary.map(r=>r.cleanReward)),61/60);near(Math.max(...summary.map(r=>r.cleanReward)),82/60);
 const defaults=runs.filter(r=>r.preset==='default'&&r.hz===60);
 near(defaults.find(r=>r.branch==='alley'&&r.reaction===0)!.seconds,81.6);
 near(defaults.find(r=>r.branch==='boulevard'&&r.reaction===0)!.seconds,82.83333333333333);
 const mild=defaults.find(r=>r.branch==='alley'&&r.reaction===.8)!;near(mild.railSeconds,0);
 t.diagnostic(JSON.stringify({runs,summary,playerLapsPerRun:1,cleanBuildRateRouteRuns:60,resources:{maxRSSKiB:process.resourceUsage().maxRSS,v8HeapUsedMiB:process.memoryUsage().heapUsed/1048576,configuredOldSpaceMiB:384},scope:'Unchanged shared pilot and physics; finite accepted physical progression. GPT, GLM and Grok equally stale broad are 0.733s, 0.433s and 0.300s slower than stale technical. Not a universal reversal, human difficulty, arbitrary mixed-part, traffic, item or GPU claim.'}));
});
