import {createLandRaceRoute} from '../../src/land-race-route';
import {createRaceKartTuning,kartRoadContext,raceKartBuild} from '../../src/kart-race';
import {landBankDrift,landRailScrape,landSteeringGrip,stepLandSpeed} from '../../src/land-driving';
import {lateralInput} from '../../src/vehicle-controls.js';
import {clamp} from '../../src/track';
import type {KartBuild} from '../../src/kart-build';
import type {BranchId,ForkCourse} from '../../src/land-routes';
/** Headless physics benchmark, matching the validated native runtime's control
 * recipe and exact driving/tuning helpers, without loading models or a scene. */
export function benchmarkTownDriving(course:ForkCourse,branch:BranchId,corrective:boolean,dt=1/60,id='whale',build?:KartBuild) {
  const route=createLandRaceRoute(course,20261010);route.init(id,0,-2);
  const tuningFor=createRaceKartTuning(build??raceKartBuild(''),20261010);
  let total=0,lane=-2,speed=0,elapsed=0,branchStart=0,branchEnd=0,railSeconds=0,branchRailSeconds=0;
  for(let frame=0;frame<Math.ceil(200/dt)&&route.get(id).laps<1;frame++){
    const c=route.cursor(id),near=route.nearFork(id),target=near?(branch==='alley'?2.6:-2.6):0;
    const left=(near||corrective)&&c.lateral<target-.35,right=(near||corrective)&&c.lateral>target+.35,steer=Number(right)-Number(left);
    const road=route.view(id,total),tuning=tuningFor(id,id,kartRoadContext(total,speed,road.sample));
    const now=road.sample(total),next=road.sample(total+7),curvature=now.t.x*next.t.z-now.t.z*next.t.x;
    speed=stepLandSpeed(road,total,speed,{throttle:true},dt,tuning,0,0,Math.abs(lane)>route.limit(id,0,.9));
    lane+=lateralInput(steer,speed,tuning.maxSpeed,false,dt)*tuning.multipliers.steering*landSteeringGrip(road,total)+curvature*speed*dt*.43+landBankDrift(road,total,speed,dt);
    const rail=landRailScrape(speed,lane,route.limit(id),dt);speed=rail.speed;lane=rail.lateral;
    const result=route.advance(id,speed*dt,dt,lane,route.playerChoice(id,steer,lane));if(!result.accepted)throw new Error(result.reason);
    if(![result.total,speed,lane].every(Number.isFinite))throw new Error('Non-finite physical state');
    total=result.total;lane=clamp(lane,-route.limit(id),route.limit(id));route.setLane(id,lane);elapsed+=dt;
    const after=route.cursor(id);if(after.edgeId===branch&&branchStart===0)branchStart=elapsed;if(after.edgeId==='finish'&&branchEnd===0)branchEnd=elapsed;
    if(Math.abs(lane)>=route.limit(id)-.02){railSeconds+=dt;if(after.edgeId===branch)branchRailSeconds+=dt;}
  }
  if(route.get(id).laps!==1)throw new Error('Benchmark failed to complete physical lap');
  return {seconds:elapsed,railSeconds,branchSeconds:branchEnd-branchStart,branchRailSeconds,choice:route.cursor(id).choiceByLap[0]};
}
