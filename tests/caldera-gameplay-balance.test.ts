import {historicalRoutePhysics} from './helpers/historical-route-physics';
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
const historical=await historicalRoutePhysics();
after(()=>historical.dispose());
const {benchmarkForkDriving,getNpcPresets,raceKartBuild}=historical;
const course=await historical.course('caldera');




// Frozen pre-production design observations. Every complete returned result is
// compared exactly; these do not grant branch boosts or alter the shared pilot.
// Character, build, physical branch, Hz, stale-input seconds, lap seconds,
// rail seconds, branch seconds, branch rail seconds. All runs are ONE lap.
const frozen:readonly (readonly [string,string,'alley'|'boulevard',number,number,number,number,number,number])[]=[
 ["whale","default","alley",60,0,98.76666666666235,0,12.633333333332622,0],
 ["whale","default","boulevard",60,0,99.83333333332895,0,13.716666666665894,0],
 ["whale","default","alley",60,0.4,98.76666666666235,0,12.633333333332622,0],
 ["whale","default","boulevard",60,0.4,99.83333333332895,0,13.716666666665894,0],
 ["whale","default","alley",60,0.8,98.76666666666235,0.016666666666666666,12.633333333332622,0.016666666666666666],
 ["whale","default","boulevard",60,0.8,99.83333333332895,0,13.716666666665894,0],
 ["whale","default","alley",60,1.6,99.31666666666231,1.1333333333333342,13.199999999999257,1.1333333333333342],
 ["whale","default","boulevard",60,1.6,99.94999999999561,0.35,13.84999999999922,0.35],
 ["whale","default","alley",60,3,102.34999999999548,7.283333333333313,16.233333333332418,7.283333333333313],
 ["whale","default","boulevard",60,3,101.28333333332887,3.1999999999999935,15.083333333332483,3.183333333333327],
 ["whale","default","alley",30,0,98.76666666666235,0,12.633333333332622,0],
 ["whale","default","boulevard",30,0,99.83333333332895,0,13.716666666665894,0],
 ["whale","default","alley",144,0,98.75694444442603,0,12.63194444444158,0],
 ["whale","default","boulevard",144,0,99.81944444442578,0,13.708333333330224,0],
 ["whale","balanced","alley",30,0,98.73333333332901,0,12.633333333332622,0],
 ["whale","balanced","boulevard",30,0,99.79999999999562,0,13.699999999999228,0],
 ["whale","balanced","alley",60,0,98.73333333332901,0,12.633333333332622,0],
 ["whale","balanced","boulevard",60,0,99.79999999999562,0,13.699999999999228,0],
 ["whale","balanced","alley",120,0,98.72500000002464,0,12.625000000002316,0],
 ["whale","balanced","boulevard",120,0,99.79166666669215,0,13.708333333336498,0],
 ["whale","balanced","alley",144,0,98.72916666664825,0,12.63194444444158,0],
 ["whale","balanced","boulevard",144,0,99.79166666664801,0,13.708333333330224,0],
 ["whale","balanced","alley",240,0,98.72499999999238,0,12.63333333333729,0],
 ["whale","balanced","boulevard",240,0,99.79166666665807,0,13.708333333336327,0],
 ["gemini","corner","alley",30,0,101.24999999999554,0,12.633333333332622,0],
 ["gemini","corner","boulevard",30,0,102.56666666666213,0,13.96666666666588,0],
 ["gemini","corner","alley",60,0,101.24999999999554,0,12.633333333332622,0],
 ["gemini","corner","boulevard",60,0,102.56666666666213,0,13.96666666666588,0],
 ["gemini","corner","alley",120,0,101.2416666666933,0,12.641666666670467,0],
 ["gemini","corner","boulevard",120,0,102.56666666669436,0,13.958333333338182,0],
 ["gemini","corner","alley",144,0,101.24305555553657,0,12.638888888886022,0],
 ["gemini","corner","boulevard",144,0,102.56249999998072,0,13.958333333330167,0],
 ["gemini","corner","alley",240,0,101.24583333332342,0,12.637500000000998,0],
 ["gemini","corner","boulevard",240,0,102.56249999998889,0,13.958333333333137,0],
 ["gpt","straight","alley",30,0,83.43333333332988,0,10.866666666666049,0],
 ["gpt","straight","boulevard",30,0,84.16666666666318,0,11.59999999999934,0],
 ["gpt","straight","alley",60,0,83.43333333332988,0,10.866666666666049,0],
 ["gpt","straight","boulevard",60,0,84.16666666666318,0,11.59999999999934,0],
 ["gpt","straight","alley",120,0,83.44166666667914,0,10.866666666666049,0],
 ["gpt","straight","boulevard",120,0,84.16666666667972,0,11.608333333332673,0],
 ["gpt","straight","alley",144,0,83.43749999998506,0,10.868055555553084,0],
 ["gpt","straight","boulevard",144,0,84.16666666665157,0,11.611111111108471,0],
 ["gpt","straight","alley",240,0,83.43750000000628,0,10.870833333341984,0],
 ["gpt","straight","boulevard",240,0,84.16250000000562,0,11.604166666675901,0],
 ["claude","start-hill","alley",30,0,106.46666666666191,0,13.433333333332577,0],
 ["claude","start-hill","boulevard",30,0,107.7833333333285,0,14.749999999999169,0],
 ["claude","start-hill","alley",60,0,106.46666666666191,0,13.433333333332577,0],
 ["claude","start-hill","boulevard",60,0,107.7833333333285,0,14.749999999999169,0],
 ["claude","start-hill","alley",120,0,106.45833333336412,0,13.43333333334001,0],
 ["claude","start-hill","boulevard",120,0,107.78333333336518,0,14.766666666674396,0],
 ["claude","start-hill","alley",144,0,106.45833333331316,0,13.437499999996952,0],
 ["claude","start-hill","boulevard",144,0,107.77777777775731,0,14.756944444441096,0],
 ["claude","start-hill","alley",240,0,106.45416666665201,0,13.433333333329124,0],
 ["claude","start-hill","boulevard",240,0,107.77916666665081,0,14.758333333327926,0],
 ["grok","impact","alley",30,0,89.99999999999618,0,11.299999999999358,0],
 ["grok","impact","boulevard",30,0,91.09999999999611,0,12.399999999999295,0],
 ["grok","impact","alley",60,0,89.99999999999618,0,11.299999999999358,0],
 ["grok","impact","boulevard",60,0,91.09999999999611,0,12.399999999999295,0],
 ["grok","impact","alley",120,0,89.99166666668435,0,11.291666666666025,0],
 ["grok","impact","boulevard",120,0,91.10000000001857,0,12.399999999999295,0],
 ["grok","impact","alley",144,0,89.99305555553913,0,11.298611111108542,0],
 ["grok","impact","boulevard",144,0,91.09722222220554,0,12.402777777774958,0],
 ["grok","impact","alley",240,0,89.99166666666699,0,11.291666666675653,0],
 ["grok","impact","boulevard",240,0,91.09999999999931,0,12.404166666676538,0],
 ["glm","balanced","alley",30,0,87.73333333332964,0,11.166666666666032,0],
 ["glm","balanced","boulevard",30,0,88.68333333332959,0,12.133333333332644,0],
 ["glm","balanced","alley",60,0,87.73333333332964,0,11.166666666666032,0],
 ["glm","balanced","boulevard",60,0,88.68333333332959,0,12.133333333332644,0],
 ["glm","balanced","alley",120,0,87.73333333334922,0,11.183333333332698,0],
 ["glm","balanced","boulevard",120,0,88.68333333334998,0,12.141666666665976,0],
 ["glm","balanced","alley",144,0,87.7361111110952,0,11.180555555553013,0],
 ["glm","balanced","boulevard",144,0,88.68749999998387,0,12.138888888886129,0],
 ["glm","balanced","alley",240,0,87.73333333333571,0,11.175000000008893,0],
 ["glm","balanced","boulevard",240,0,88.68333333333484,0,12.13750000000966,0],
 ["whale","balanced","alley",60,3,102.29999999999548,7.316666666666646,16.216666666665752,7.316666666666646],
 ["whale","balanced","boulevard",60,3,101.2166666666622,3.1999999999999935,15.049999999999152,3.183333333333327],
 ["gemini","corner","alley",60,3,105.64999999999529,7.399999999999979,17.033333333332372,7.399999999999979],
 ["gemini","corner","boulevard",60,3,105.03333333332866,4.733333333333322,16.41666666666574,4.733333333333322],
 ["gpt","straight","alley",60,3,84.48333333332982,2.7666666666666617,11.91666666666599,2.749999999999995],
 ["gpt","straight","boulevard",60,3,84.94999999999646,1.5833333333333326,12.38333333333263,1.5833333333333326],
 ["claude","start-hill","alley",60,3,110.03333333332837,6.766666666666648,16.99999999999904,6.766666666666648],
 ["claude","start-hill","boulevard",60,3,109.29999999999508,3.099999999999994,16.26666666666575,3.099999999999994],
 ["grok","impact","alley",60,3,92.98333333332934,5.166666666666654,14.283333333332529,5.149999999999987],
 ["grok","impact","boulevard",60,3,92.34999999999604,2.6999999999999953,13.649999999999231,2.6999999999999953],
 ["glm","balanced","alley",60,3,90.43333333332949,3.866666666666658,13.866666666665878,3.866666666666658],
 ["glm","balanced","boulevard",60,3,89.78333333332952,2.3166666666666633,13.233333333332581,2.3166666666666633]
];

test('historical v1.0.1a: caldera frozen 86 one-lap player runs preserve all 60 clean build × rate × route results and the honest stale-input counterexample',t=>{
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
  for(const branch of ['alley','boulevard']){const times=group.filter(r=>r.branch===branch).map(r=>r.seconds);assert.ok(Math.max(...times)-Math.min(...times)<=.013,'physical refresh equivalence');}
  assert.ok(wide.seconds>cut.seconds);
  const staleCut=runs.find(r=>r.character===character&&r.preset!=='default'&&r.reaction===3&&r.branch==='alley')!,staleWide=runs.find(r=>r.character===character&&r.preset!=='default'&&r.reaction===3&&r.branch==='boulevard')!;
  assert.ok(staleCut.seconds>wide.seconds,'every stale technical run loses to CLEAN broad driving');
  assert.ok(staleCut.branchRailSeconds>staleWide.branchRailSeconds&&staleWide.branchRailSeconds>0);
  if(character==='gpt')near(staleCut.seconds-staleWide.seconds,-28/60);
  else assert.ok(staleCut.seconds>staleWide.seconds);
  summary.push({character,cleanReward:wide.seconds-cut.seconds,staleTechnicalVsCleanBroad:staleCut.seconds-wide.seconds,staleTechnicalVsEquallyStaleBroad:staleCut.seconds-staleWide.seconds});
 }
 near(Math.min(...summary.map(r=>r.cleanReward)),44/60);near(Math.max(...summary.map(r=>r.cleanReward)),79/60);
 const defaults=runs.filter(r=>r.preset==='default'&&r.hz===60);
 near(defaults.find(r=>r.branch==='alley'&&r.reaction===0)!.seconds,98.76666666666667);
 near(defaults.find(r=>r.branch==='boulevard'&&r.reaction===0)!.seconds,99.83333333333333);
 const mild=defaults.find(r=>r.branch==='alley'&&r.reaction===.8)!;near(mild.railSeconds,1/60);
 t.diagnostic(JSON.stringify({runs,summary,playerLapsPerRun:1,cleanBuildRateRouteRuns:60,resources:{maxRSSKiB:process.resourceUsage().maxRSS},scope:'Unchanged shared pilot and physics; finite accepted physical progression. GPT equally stale broad is 0.467s slower than stale technical. Not a universal reversal, human difficulty, arbitrary mixed-part, traffic, item or GPU claim.'}));
});
