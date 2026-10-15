import test from 'node:test';
import assert from 'node:assert/strict';
import {planLane,pickupReachability,moveLane,newBrain,type RacingPickup} from '../src/npc-tactics';
import {decideLandCpu,type LandCpuActor,type LandCpuContext} from '../src/land-cpu';
import {npcSkill} from '../src/npc-difficulty';
const actor:LandCpuActor={id:'test',total:0,lateral:0,speed:24,held:null,boost:0,slow:0,shield:0,...newBrain(0,0),phase:0,driving:true,cornerPace:1,aiBend:0,driftCharge:0,driftCooldown:0,aiDrifting:false,finishedAt:null};
const box=(d=24,lateral=3):RacingPickup=>({d,lateral,cool:0,display:'boost',mesh:{enabled:true},models:{boost:{enabled:true},shield:{enabled:false},pulse:{enabled:false},mystery:{enabled:false}}});
test('reports optimistic and pessimistic legacy reachability without changing default targets',()=>{
 const b=box(),est=pickupReachability(actor,b,24,.45);
 assert.equal(est.legacyReachable,true);assert.equal(est.executionReachable,false);
 assert.equal(est.executionBudget,moveLane(0,5.2,1*.45)+.65);
 const observations:any[]=[];
 const observed=planLane(actor,[actor],[b],1000,0,0,undefined,undefined,{lateralMultiplier:.45,observe:(_,e)=>observations.push(e)});
 assert.equal(observed,3);assert.equal(observed,planLane(actor,[actor],[b],1000,0,0));assert.equal(observations.length,1);
 assert.equal(planLane(actor,[actor],[b],1000,0,0,undefined,undefined,{mode:'execution-matched',lateralMultiplier:.45}),0);
 const far=box(12,3);
 assert.equal(pickupReachability(actor,far,12,1.5).legacyReachable,false);
 assert.equal(planLane(actor,[actor],[far],1000,0,0,undefined,undefined,{mode:'execution-matched',lateralMultiplier:1.5}),3);
});
test('diagnostics respect visibility, inventory, route eligibility and local lookahead',()=>{
 for(const b of [{...box(),cool:1},{...box(),mesh:{enabled:false}},box(60),box(1),box(20,6)]){
  let count=0;planLane(actor,[actor],[b],1000,0,0,undefined,undefined,{lateralMultiplier:.45,observe:()=>count++});assert.equal(count,0);
 }
 let count=0;const opts={lateralMultiplier:.45,observe:()=>count++};
 planLane({...actor,held:'pulse'},[actor],[box()],1000,0,0,undefined,undefined,opts);
 planLane(actor,[actor],[box()],1000,0,0,undefined,{pickupGap:()=>null},opts);
 assert.equal(count,0);
});
test('shared land CPU feeds steering times clamped surface grip only when opted in',()=>{
 const surface={grip:.5,rollingResistance:0};
 const track:any={sample:()=>({t:{x:0,y:0,z:1}}),surfaceAt:()=>surface};
 let tuningCalls=0;
 const c:LandCpuContext={length:1000,track,sample:track.sample,halfWidthAt:()=>7,routes:null,progress:new Map(),skill:npcSkill('normal'),tuning:()=>{tuningCalls++;return {maxSpeed:40,multipliers:{acceleration:1,steering:.8}};}};
 const baseline={...actor};decideLandCpu(baseline,[baseline],[box()],c,{dt:.1,elapsed:1});assert.equal(tuningCalls,0);assert.equal(baseline.targetLane,3);
 const observed={...actor};let estimate:any;
 decideLandCpu(observed,[observed],[box()],c,{dt:.1,elapsed:1},{pickupReachability:(_,__,e)=>{estimate=e;}});
 assert.deepEqual(observed,baseline);assert.equal(estimate.lateralMultiplier,.4);assert.equal(estimate.executionReachable,false);
 const experimental={...actor};decideLandCpu(experimental,[experimental],[box()],{...c,pickupPlanning:'execution-matched'},{dt:.1,elapsed:1});
 assert.notEqual(experimental.targetLane,3);
});
