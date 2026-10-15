import {inventoryFull} from './item-inventory';
/** Six equivalent CPU roles using the SAME exported NPC loop as game.ts.
 * IDs identify scenario seats, never characters: branches, tie breaks, phases,
 * processing order and starting positions rotate independently of profile stats. */
import {CHARACTER_PROFILES,type CharacterId} from './character-profiles';
import {compileKartBuild,defaultBuild,starterBuilds,type KartBuild} from './kart-build';
import {kartPresets} from './kart-presets';
import {kartRoadContext} from './kart-race';
import {npcSkill,seededRandom} from './npc-difficulty';
import type {Difficulty} from './race-options';
import {newBrain,collectPickups,RULES,type RacingPickup} from './npc-tactics';
import {advancePickup,resetPickup} from './item-pickups';
import {createDynamicPickupDirector,DYNAMIC_PICKUP_CAPACITY} from './dynamic-pickups';
import {createLandRaceRoute} from './land-race-route';
import {createLapProgress} from './land-track';
import {coastStandings} from './coast-race-rules';
import {landCpuFinished,tickLandCpu,decideLandCpu,advanceLandCpu,collideLandCpu,type LandCpuActor,type LandCpuContext} from './land-cpu';
import type {LandSimulationCourse} from './land-simulation-course';
export const CPU_CHARACTER_IDS=CHARACTER_PROFILES.map(p=>p.id);
export type CpuMultipliers={acceleration:number;topSpeed:number;steering:number};
export type CpuProfileOverrides=Partial<Record<CharacterId,CpuMultipliers>>;
export type CpuSimulationOptions={seed:number;itemCapacity?:1|2;rotation?:number;difficulty?:Difficulty;equipment?:'equal'|'mixed';items?:boolean;timeoutSeconds?:number;profiles?:CpuProfileOverrides;identityControl?:boolean};
export function cpuSeed(domain:string,map:string,index:number) {let hash=2166136261;for(const char of `${domain}:${map}:${index}`)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;return hash;}
function shuffle<T>(input:readonly T[],rng:()=>number):T[]{const result=[...input];for(let i=result.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
function pickup(data:Partial<RacingPickup>):RacingPickup{return {d:0,lateral:0,cool:0,display:'mystery',mesh:{enabled:false},models:{boost:{enabled:false},shield:{enabled:false},pulse:{enabled:false},mystery:{enabled:false}},...data};}
export interface CpuRaceActor extends LandCpuActor {
 characterId:CharacterId;seat:number;build:Readonly<KartBuild>;lapTimes:number[];collisionCount:number;railContacts:number;slowSeconds:number;driftSeconds:number;maxObservedSpeed:number;invalidSteps:number;rejectionReasons:Record<string,number>;
}
export interface CpuRaceResult {
 map:string;seed:number;rotation:number;itemCapacity:1|2;difficulty:Difficulty;equipment:string;items:boolean;elapsed:number;steps:number;complete:boolean;timeout:boolean;winner:CharacterId|null;
 racers:Array<{id:string;characterId:CharacterId;seat:number;phase:number;rank:number;finishedAt:number|null;dnf:boolean;total:number;laps:number;lapTimes:number[];branches:string[];pickups:number;uses:number;collisionCount:number;railContacts:number;slowSeconds:number;driftSeconds:number;maxObservedSpeed:number;invalidSteps:number;rejectionReasons:Record<string,number>;build:Readonly<KartBuild>}>;
}
export function createCpuRace(course:LandSimulationCourse,options:CpuSimulationOptions) {
 const seed=options.seed>>>0,rotation=((options.rotation??0)%6+6)%6,difficulty=options.difficulty??'normal',equipment=options.equipment??'equal',items=options.items!==false;
 const timeoutSeconds=options.timeoutSeconds??600;
 if(!Number.isFinite(timeoutSeconds)||timeoutSeconds<=0)throw new RangeError('Invalid timeout');
 const rng=seededRandom(seed),scenario=seededRandom(cpuSeed('roles',course.id,seed));
 const phaseOrder=shuffle([0,1,2,3,4,5],scenario),characters=shuffle(CPU_CHARACTER_IDS,scenario);
 const recipes:Readonly<KartBuild>[]=shuffle([...kartPresets.map(p=>p.build),starterBuilds.find(p=>p.id==='mixed_corner')?.build??defaultBuild],scenario);
 const routes=course.routes?createLandRaceRoute(course.routes,seed):null;
 const progress=new Map();
 const grid=[{total:0,lateral:-2},...Array.from({length:5},(_,i)=>({total:12+Math.floor(i/2)*5.2,lateral:(i%2?1:-1)*3.2}))];
 const actors:CpuRaceActor[]=grid.map((start,seat)=>{
  const phase=phaseOrder[seat],characterId=characters[(seat+rotation)%6],build=equipment==='mixed'?recipes[seat]:defaultBuild;
  return {id:`seat-${seat}`,characterId,seat,phase,build,...start,...(options.itemCapacity===2?{heldSecond:null}:{}),speed:0,driving:true,cornerPace:1,aiBend:0,driftCharge:0,driftCooldown:0,aiDrifting:false,held:null,boost:0,shield:0,slow:0,finishedAt:null,...newBrain(phase,start.lateral),lapTimes:[],collisionCount:0,railContacts:0,slowSeconds:0,driftSeconds:0,maxObservedSpeed:0,invalidSteps:0,rejectionReasons:{}};
 });
 const byId=new Map(actors.map(a=>[a.id,a])),compiled=new Map(actors.map(a=>[a.id,compileKartBuild(a.build)]));
 for(const actor of actors){routes?.init(actor.id,actor.total,actor.lateral);if(course.track&&!routes)progress.set(actor.id,createLapProgress(course.track,actor.total));}
 const tuning=(id:string,distance?:number,speed=0)=>{
  const actor=byId.get(id)!,character=options.identityControl?'gpt':actor.characterId;
  const context=distance===undefined?undefined:kartRoadContext(distance,speed,routes?routes.view(id,distance).sample:course.sample);
  return compiled.get(id)!.tuning(character,'coast',context,options.profiles?.[character]);
 };
 const context:LandCpuContext={length:course.length,track:course.track,sample:course.sample,halfWidthAt:course.halfWidthAt,routes,progress,skill:npcSkill(difficulty),tuning};
 const boxes=items?[...course.pickups.map(row=>pickup(row)),...Array.from({length:DYNAMIC_PICKUP_CAPACITY},()=>pickup({dynamic:true}))]:[];
 for(const box of boxes)if(!box.dynamic)resetPickup(box,rng);
 const staticBoxes=boxes.filter(b=>!b.dynamic);
 const director=createDynamicPickupDirector(boxes.filter(b=>b.dynamic),{length:course.length,sample:course.sample,laneLimit:d=>Math.min(5.2,course.halfWidthAt(d)-1.1),...(routes?{eligibility:routes.eligible,racerPosition:r=>routes.sample(r.id,r.lateral).p,racerGap:(r,d)=>routes.gapToDistance(r.id,d),pickupPosition:routes.pickupPosition}:{})},{rng});
 let elapsed=0,steps=0,done=false,timeout=false;
 const laps=(actor:CpuRaceActor)=>routes?routes.get(actor.id).laps:course.track?progress.get(actor.id)!.laps:Math.max(0,Math.min(3,Math.floor(actor.total/course.length)));
 function step(dt=1/60){
  if(done)return;
  if(!Number.isFinite(dt)||dt<=0||dt>1/60+1e-10)throw new RangeError('Simulation uses steps no larger than 1/60s');
  elapsed+=dt;steps++;
  const previous=actors.map(actor=>({actor,previous:actor.total,previousLane:actor.lateral,lap:laps(actor),onPickup:()=>{actor.pickups++;actor.reaction=context.skill.reaction+actor.phase*.025;}}));
  for(const box of staticBoxes)advancePickup(box,dt,rng);
  const racers=actors.filter(actor=>!landCpuFinished(actor,context));
  for(const actor of actors)tickLandCpu(actor,dt);
  const frame={dt,elapsed};
  for(const actor of actors)decideLandCpu(actor,racers,boxes,context,frame);
  for(const actor of actors){
   if(landCpuFinished(actor,context))continue;
   advanceLandCpu(actor,context,frame,{railContact:()=>actor.railContacts++,rejectedStep:(_,reason)=>{actor.invalidSteps++;actor.rejectionReasons[reason]=(actor.rejectionReasons[reason]??0)+1;}});
   actor.slowSeconds+=(actor.slow>0?dt:0);actor.driftSeconds+=(actor.aiDrifting?dt:0);actor.maxObservedSpeed=Math.max(actor.maxObservedSpeed,actor.speed);
   if(!Number.isFinite(actor.total+actor.speed+actor.lateral))throw new Error(`Non-finite actor ${actor.id}`);
  }
  // Finished competitors leave combat immediately, but their exact completion
  // times remain in the standings. No selected-human early-stop privilege.
  const active=actors.filter(actor=>!landCpuFinished(actor,context));
  for(const actor of active){const before=actor.bump;collideLandCpu(actor,active,context);if(actor.bump>before)actor.collisionCount++;}
  collectPickups(previous.filter(p=>!landCpuFinished(p.actor,context)),boxes,course.length,rng,routes?.contact);
  for(const prior of previous){const count=laps(prior.actor);if(count>prior.lap){const fraction=prior.actor.finishedAt!==null?(prior.actor.finishedAt-elapsed+dt)/dt:(course.length*count-prior.previous)/Math.max(1e-9,prior.actor.total-prior.previous);const time=elapsed-dt+dt*Math.max(0,Math.min(1,fraction));prior.actor.lapTimes.push(time-(prior.actor.lapTimes.reduce((a,b)=>a+b,0)));}}
  if(items)director.tick({dt,active:true,racers:actors.map(actor=>{const value=tuning(actor.id);return {id:actor.id,total:actor.total,lateral:actor.lateral,held:inventoryFull(actor)?actor.held:null,travelSpeed:actor.speed,reactionSpeed:Math.abs(actor.speed),finished:landCpuFinished(actor,context),finishDistance:course.length*3,maxSpeed:value.maxSpeed*RULES.boostFactor*(course.track?1.06:1),acceleration:value.acceleration*RULES.boostFactor+(course.track?2:0)};}),staticBoxes});
  done=actors.every(actor=>landCpuFinished(actor,context));
  if(!done&&elapsed>=timeoutSeconds-1e-9){timeout=true;done=true;}
  if(done)director.finish();
 }
 function result():CpuRaceResult{
  const standings=coastStandings(actors),winner=standings[0]?.finishedAt!==null?byId.get(standings[0].id)!.characterId:null;
  return {map:course.id,seed,rotation,itemCapacity:options.itemCapacity??1,difficulty,equipment,items,elapsed,steps,complete:actors.every(a=>landCpuFinished(a,context)),timeout,winner,racers:standings.map((standing,index)=>{const actor=byId.get(standing.id)!;return {id:actor.id,characterId:actor.characterId,seat:actor.seat,phase:actor.phase,rank:index+1,finishedAt:actor.finishedAt,dnf:!landCpuFinished(actor,context),total:actor.total,laps:laps(actor),lapTimes:[...actor.lapTimes],branches:routes?Object.values(routes.cursor(actor.id).choiceByLap):[],pickups:actor.pickups,uses:actor.uses,collisionCount:actor.collisionCount,railContacts:actor.railContacts,slowSeconds:actor.slowSeconds,driftSeconds:actor.driftSeconds,maxObservedSpeed:actor.maxObservedSpeed,invalidSteps:actor.invalidSteps,rejectionReasons:{...actor.rejectionReasons},build:actor.build};})};
 }
 return {course,options,actors,boxes,routes,context,step,result,get elapsed(){return elapsed;},get done(){return done;},position:(actor:CpuRaceActor)=>routes?routes.sample(actor.id,actor.lateral).p:course.sample(actor.total,actor.lateral).p};
}
export function runCpuRace(course:LandSimulationCourse,options:CpuSimulationOptions):CpuRaceResult{const race=createCpuRace(course,options);while(!race.done)race.step();return race.result();}
