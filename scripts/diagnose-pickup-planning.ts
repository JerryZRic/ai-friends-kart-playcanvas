/** Small deterministic mechanism study. No character overrides or balance certification. */
import {writeFileSync,mkdirSync} from 'node:fs';
import {createCpuRace} from '../src/land-cpu-simulation';
import {loadLandSimulationCourse} from '../src/land-simulation-course';
import {compileKartBuild,defaultBuild} from '../src/kart-build';
import {landSteeringGrip} from '../src/land-driving';
import {planLane,pickupReachability,moveLane,collectPickups,nearbyGap,type RacingPickup} from '../src/npc-tactics';
const maps=['coast','snow','caldera'] as const,seeds=[20261015,20261016],modes=['legacy','execution-matched'] as const;
const output=process.argv[2]??'results';mkdirSync(output,{recursive:true});
const makeBox=(d:number,lateral:number):RacingPickup=>({d,lateral,cool:0,display:'boost',mesh:{enabled:true},models:{boost:{enabled:true},shield:{enabled:false},pulse:{enabled:false},mystery:{enabled:false}}});
const build=compileKartBuild(defaultBuild),micro:any[]=[],races:any[]=[];
for(const map of maps){
 const course=await loadLandSimulationCourse(map);
 const grips=Array.from({length:128},(_,i)=>({distance:i*course.length/128,grip:landSteeringGrip(course.track,i*course.length/128)}));
 const sample=grips.reduce((a,b)=>a.grip<=b.grip?a:b);
 // Low/high steering with the same legal default build. Freeze speed and local
 // grip to isolate reachability; these are not full track-driving trajectories.
 for(const character of ['claude','gemini'] as const)for(const speed of [18,30])for(const gap of [8,16,24])for(const lateral of [2,3.5,5]){
  const steering=build.tuning(character,'coast').multipliers.steering,multiplier=steering*sample.grip;
  for(const mode of modes){
   const actor={id:'micro',total:0,lateral:0,speed,held:null,boost:0,slow:0,shield:0},box=makeBox(gap,lateral);
   const estimate=pickupReachability(actor,box,gap,multiplier);
   const lane=planLane(actor,[actor],[box],1000,0,0,undefined,undefined,{mode,lateralMultiplier:multiplier});
   const attempted=lane===lateral;
   let closest=Infinity;
   while(actor.total<=gap+3){const previous=actor.total,previousLane=actor.lateral;actor.total+=speed/60;actor.lateral=moveLane(actor.lateral,lane,multiplier/60);if(Math.abs(actor.total-gap)<=2.16)closest=Math.min(closest,Math.abs(actor.lateral-lateral));collectPickups([{actor,previous,previousLane}],[box],1000,()=>0);}
   micro.push({map,character,speed,gap,lateral,grip:sample.grip,gripSampleDistance:sample.distance,steering,mode,attempted,collected:actor.held!==null,closestLateralAtWindow:closest,estimate});
  }
 }
 for(const seed of seeds)for(const mode of modes){
  const race=createCpuRace(course,{seed,equipment:'equal',items:true,timeoutSeconds:600});race.context.pickupPlanning=mode;
  const measures=new Map(race.actors.map(a=>[a.id,{targetLaneEpisodes:0,collectedDuringEpisode:0,passedUncollected:0,unavailableOrTaken:0,retargeted:0,censored:0,lateralErrorIntegral:0,activeSeconds:0,laneTravel:0}]));
  const active=new Map<string,{box:RacingPickup,pickups:number}>();
  // Episode inference is intentionally labelled, not presented as an exact AI
  // intent log: match one eligible box to the final selected lane at decisions.
  while(!race.done){
   const before=new Map(race.actors.map(a=>[a.id,{lane:a.lateral,pickups:a.pickups,decision:a.decisionIn<=1/60,finished:a.finishedAt!==null,held:a.held}]));
   race.step();
   for(const a of race.actors){
    const old=before.get(a.id)!,m=measures.get(a.id)!;
    if(!old.finished){m.lateralErrorIntegral+=Math.abs(a.targetLane-a.lateral)/60;m.activeSeconds+=1/60;m.laneTravel+=Math.abs(a.lateral-old.lane);}
    const prior=active.get(a.id);
    const gapTo=(box:RacingPickup)=>race.routes?race.routes.interactions.pickupGap!(a,box):nearbyGap(a.total,box.d,course.length);
    if(prior){
     const gap=gapTo(prior.box);
     let reason:keyof typeof m|undefined;
     if(a.pickups>prior.pickups)reason='collectedDuringEpisode';
     else if(a.finishedAt!==null)reason='censored';
     else if(prior.box.cool>0||!prior.box.mesh.enabled)reason='unavailableOrTaken';
     else if(gap!==null&&gap < -2.16)reason='passedUncollected';
     else if(old.decision&&Math.abs(a.targetLane-prior.box.lateral)>1e-8)reason='retargeted';
     if(reason){m[reason]++;active.delete(a.id);}
    }
    if(!active.has(a.id)&&old.decision&&!a.held&&a.finishedAt===null){
     const candidates=race.boxes.filter(box=>box.cool<=0&&box.mesh.enabled&&Math.abs(box.lateral-a.targetLane)<1e-8).filter(box=>{const gap=gapTo(box);return gap!==null&&gap>=2&&gap<=race.context.skill.pickupLookAhead;});
     if(candidates.length===1){m.targetLaneEpisodes++;active.set(a.id,{box:candidates[0],pickups:a.pickups});}
    }
   }
  }
  for(const id of active.keys())measures.get(id)!.censored++;
  const result=race.result();
  const row={map,seed,mode,complete:result.complete,timeout:result.timeout,elapsed:result.elapsed,racers:result.racers.map(r=>({...r,diagnostics:measures.get(r.id),meanLateralError:measures.get(r.id)!.lateralErrorIntegral/measures.get(r.id)!.activeSeconds}))};races.push(row);
  console.log(JSON.stringify({map,seed,mode,complete:row.complete,pickups:row.racers.reduce((n,r)=>n+r.pickups,0),episodes:row.racers.reduce((n,r)=>n+r.diagnostics!.targetLaneEpisodes,0)}));
 }
}
writeFileSync(output+'/pickup-planning-study.json',JSON.stringify({source:'Gameplay modules verified against dev 3bed4f9c',maps,seeds,micro,races,limitations:['Micro trials freeze speed/local grip; not full driving trajectories','Target-lane episodes are inferred, not exact selected-pickup events','CollectedDuringEpisode may be a different box; unavailableOrTaken does not identify taker','Paired full races diverge in item RNG consumption after different pickups','Two seeds per map; descriptive mechanism probes, no balance or fun certification']},null,2));
