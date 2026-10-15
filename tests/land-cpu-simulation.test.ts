import test from 'node:test';
import assert from 'node:assert/strict';
import {createCpuRace,runCpuRace,CPU_CHARACTER_IDS,cpuSeed} from '../src/land-cpu-simulation';
import {loadLandSimulationCourse} from '../src/land-simulation-course';

test('same seed and options exactly replay complete actual CPU results',async()=>{
 const course=await loadLandSimulationCourse('town'),options={seed:991,rotation:2};
 const first=runCpuRace(course,options),repeat=runCpuRace(course,options);
 assert.deepEqual(first,repeat);assert.equal(first.complete,true);assert.equal(first.racers.length,6);
 for(const racer of first.racers){assert.equal(racer.laps,3);assert.equal(racer.dnf,false);assert.equal(racer.invalidSteps,0);assert.equal(racer.lapTimes.length,3);assert.ok(Math.abs(racer.lapTimes.reduce((a,b)=>a+b,0)-racer.finishedAt!)<1e-8);}
 assert.ok(first.racers.some(r=>r.pickups>0));assert.ok(first.racers.some(r=>r.uses>0));assert.ok(first.racers.some(r=>r.collisionCount>0));
 assert.ok(first.racers.every((r,i,a)=>i===0||r.finishedAt!>=a[i-1].finishedAt!));
});
test('identical mechanics with rotated character labels give every label each winning seat exactly once',async()=>{
 const course=await loadLandSimulationCourse('town');const results=Array.from({length:6},(_,rotation)=>runCpuRace(course,{seed:72,rotation,identityControl:true}));
 assert.deepEqual(results.map(r=>r.winner).sort(),[...CPU_CHARACTER_IDS].sort());
 const bySeat=(r:typeof results[number])=>r.racers.map(({characterId,...actor})=>actor).sort((a,b)=>a.seat-b.seat);
 for(const result of results)assert.deepEqual(bySeat(result),bySeat(results[0]));
});
test('scenario roles, phases, equipment and grid rotate independently of character identity',async()=>{
 const course=await loadLandSimulationCourse('coast'),races=Array.from({length:6},(_,rotation)=>createCpuRace(course,{seed:732,rotation,equipment:'mixed'}));
 for(let seat=0;seat<6;seat++)assert.deepEqual(races.map(r=>r.actors[seat].characterId).sort(),[...CPU_CHARACTER_IDS].sort());
 for(const race of races){assert.deepEqual(race.actors.map(a=>a.phase).sort(),[0,1,2,3,4,5]);assert.equal(new Set(race.actors.map(a=>a.id)).size,6);}
 for(let seat=0;seat<6;seat++)for(const race of races){assert.deepEqual(race.actors[seat].build,races[0].actors[seat].build);assert.equal(race.actors[seat].phase,races[0].actors[seat].phase);assert.equal(race.actors[seat].total,races[0].actors[seat].total);}
 const equal=createCpuRace(course,{seed:1});for(const actor of equal.actors)assert.deepEqual(actor.build,equal.actors[0].build);
});
test('timeouts retain all DNFs without invented winner, and stopping is latched',async()=>{
 const course=await loadLandSimulationCourse('coast'),race=createCpuRace(course,{seed:2,timeoutSeconds:.05});while(!race.done)race.step();
 const result=race.result();assert.equal(result.timeout,true);assert.equal(result.complete,false);assert.equal(result.winner,null);assert.equal(result.racers.filter(a=>a.dnf).length,6);
 race.step();assert.deepEqual(race.result(),result);
});
test('items can be disabled only explicitly and seed domains do not overlap in the declared matrix',async()=>{
 const course=await loadLandSimulationCourse('coast');assert.equal(createCpuRace(course,{seed:2,items:false}).boxes.length,0);assert.ok(createCpuRace(course,{seed:2}).boxes.length>0);
 const seeds=new Set<number>();for(const domain of ['land-balance-training-v1','land-balance-holdout-v1','land-balance-mixed-holdout-v1'])for(const map of ['coast','mountain','town','quarry','forest','workshop','harvest','desert','snow','caldera','garden','airfield'])for(let i=0;i<128;i++){const seed=cpuSeed(domain,map,i);assert.equal(seeds.has(seed),false);seeds.add(seed);}
 assert.throws(()=>loadLandSimulationCourse('waterpark' as any),/land maps/);
});

test('rejected progress is observed before speed reset on both route and checkpoint paths',async()=>{
 for(const map of ['town','mountain'] as const){
  const race=createCpuRace(await loadLandSimulationCourse(map),{seed:77,items:false});
  const actor=race.actors[0];actor.speed=200;actor.driving=false;
  race.step();assert.equal(actor.speed,0);assert.equal(actor.invalidSteps,1);
  assert.equal(Object.values(actor.rejectionReasons).reduce((a,b)=>a+b,0),1);
  assert.ok(Object.keys(actor.rejectionReasons).some(reason=>/teleport|step|speed/.test(reason)),JSON.stringify(actor.rejectionReasons));
 }
});
