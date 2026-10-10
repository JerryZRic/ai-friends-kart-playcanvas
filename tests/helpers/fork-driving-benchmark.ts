import {createLandRaceRoute} from '../../src/land-race-route';
import {createRaceKartTuning,kartRoadContext,raceKartBuild} from '../../src/kart-race';
import {landBankDrift,landRailScrape,landSteeringGrip,stepLandSpeed} from '../../src/land-driving';
import {lateralInput} from '../../src/vehicle-controls.js';
import {clamp} from '../../src/track';
import type {KartBuild} from '../../src/kart-build';
import type {BranchId,ForkCourse} from '../../src/land-routes';
/** Headless physics benchmark, matching the validated native runtime's control
 * recipe and exact driving/tuning helpers, without loading models or a scene. */
export function benchmarkForkDriving(course:ForkCourse,branch:BranchId,corrective:boolean,dt=1/60,id='whale',build?:KartBuild,branchReactionSeconds=0,nativeFrame=false) {
  const route=createLandRaceRoute(course,20261010);route.init(id,0,-2);
  const tuningFor=createRaceKartTuning(build??raceKartBuild(''),20261010);
  let total=0,lane=-2,speed=0,elapsed=0,branchStart=0,branchEnd=0,railSeconds=0,branchRailSeconds=0,heldSteer=0,nextDecision=0;
  for(let frame=0;frame<Math.ceil(200/dt)&&route.get(id).laps<1;frame++){
    const c=route.cursor(id),near=route.nearFork(id),target=near?(branch==='alley'?2.6:-2.6):0;
    const left=(near||corrective)&&c.lateral<target-.35,right=(near||corrective)&&c.lateral>target+.35,desiredSteer=Number(right)-Number(left);
    if(c.edgeId!==branch||elapsed>=nextDecision){heldSteer=desiredSteer;nextDecision=elapsed+branchReactionSeconds;}
    const steer=heldSteer;
    // Native advanceFrame caps each physics integration at 1/60s while
    // holding the frame's input. The legacy default deliberately retains its
    // direct-dt stress behavior for existing town benchmark callers.
    for(let remaining=dt;remaining>1e-9&&route.get(id).laps<1;){
      const step=nativeFrame?Math.min(1/60,remaining):remaining;remaining-=step;
      const road=route.view(id,total),tuning=tuningFor(id,id,kartRoadContext(total,speed,road.sample));
      const now=road.sample(total),next=road.sample(total+7),curvature=now.t.x*next.t.z-now.t.z*next.t.x;
      speed=stepLandSpeed(road,total,speed,{throttle:true},step,tuning,0,0,Math.abs(lane)>route.limit(id,0,.9));
      lane+=lateralInput(steer,speed,tuning.maxSpeed,false,step)*tuning.multipliers.steering*landSteeringGrip(road,total)+curvature*speed*step*.43+landBankDrift(road,total,speed,step);
      const rail=landRailScrape(speed,lane,route.limit(id),step);speed=rail.speed;lane=rail.lateral;
      const result=route.advance(id,speed*step,step,lane,route.playerChoice(id,steer,lane));if(!result.accepted)throw new Error(result.reason);
      if(![result.total,speed,lane].every(Number.isFinite))throw new Error('Non-finite physical state');
      total=result.total;lane=clamp(lane,-route.limit(id),route.limit(id));route.setLane(id,lane);elapsed+=step;
      const after=route.cursor(id);if(after.edgeId===branch&&branchStart===0){branchStart=elapsed;nextDecision=elapsed;}if(after.edgeId==='finish'&&branchEnd===0)branchEnd=elapsed;
      if(Math.abs(lane)>=route.limit(id)-.02){railSeconds+=step;if(after.edgeId===branch)branchRailSeconds+=step;}
    }
  }
  if(route.get(id).laps!==1)throw new Error('Benchmark failed to complete physical lap');
  return {seconds:elapsed,railSeconds,branchSeconds:branchEnd-branchStart,branchRailSeconds,choice:route.cursor(id).choiceByLap[0]};
}
