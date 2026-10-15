import test from 'node:test';import assert from 'node:assert/strict';
import {itemAt,storeItem,takeItem,inventoryFull,clearInventory,createItemRequests} from '../src/item-inventory';
import {activateItem,collectPickups,chooseItemSlot,planLane,newBrain,type Combatant,type RacingPickup} from '../src/npc-tactics';
import {newWaterRace,useWaterItem,advanceWaterRace} from '../src/water-race';
import {loadLandSimulationCourse} from '../src/land-simulation-course';
import {createCpuRace} from '../src/land-cpu-simulation';
const actor=(id='a'):Combatant&ReturnType<typeof newBrain>=>({id,total:0,lateral:0,speed:24,held:null,heldSecond:null,boost:0,shield:0,slow:0,...newBrain(0,0)});
const box=(d=10):RacingPickup=>({d,lateral:0,cool:0,display:'boost',mesh:{enabled:true},models:{boost:{enabled:true},shield:{enabled:false},pulse:{enabled:false},mystery:{enabled:false}}});
test('E/R stay fixed, fill first empty and reject third without implicit upgrade',()=>{
 const a=actor();assert.equal(storeItem(a,'boost'),0);assert.equal(storeItem(a,'boost'),1);assert.equal(storeItem(a,'boost'),null);assert.equal(inventoryFull(a),true);
 assert.equal(takeItem(a,0),'boost');assert.equal(itemAt(a,1),'boost');assert.equal(itemAt(a,0),null);assert.equal(storeItem(a,'shield'),0);assert.equal(itemAt(a,1),'boost');
 clearInventory(a);assert.deepEqual([a.held,a.heldSecond],[null,null]);
});
test('legacy fixtures remain explicitly single-capacity',()=>{const a={held:'boost' as const};assert.equal(inventoryFull(a),true);assert.equal(storeItem(a,'shield'),null);assert.equal(itemAt(a,1),null);});
test('both slots use unchanged effects; empty E never falls through to R',()=>{
 const a=actor();a.heldSecond='pulse';assert.equal(activateItem(a,[a],100),null);assert.equal(a.heldSecond,'pulse');
 const result=activateItem(a,[a],100,undefined,1);assert.equal(result?.item,'pulse');assert.equal(a.boost,1.9);assert.equal(a.heldSecond,null);
 a.held='boost';a.heldSecond='shield';activateItem(a,[a],100,undefined,1);assert.equal(a.shield,6);assert.equal(a.held,'boost');
});
test('full rejected pickup is unconsumed and available to next tied racer',()=>{
 const a=actor('a'),b=actor('b'),pickup=box();a.held='boost';a.heldSecond='shield';a.total=b.total=20;
 let rngCalls=0;collectPickups([{actor:a,previous:0,previousLane:0},{actor:b,previous:0,previousLane:0}],[pickup],100,()=>{rngCalls++;return 0;});
 assert.equal(b.held,'boost');assert.ok(pickup.cool>0);assert.equal(rngCalls,0);assert.equal(a.heldSecond,'shield');
 const mystery={...box(),display:'mystery' as const};collectPickups([{actor:a,previous:0,previousLane:0}],[mystery],100,()=>{rngCalls++;return 0;});
 assert.equal(mystery.cool,0);assert.equal(mystery.mesh.enabled,true);assert.equal(rngCalls,0);
});
test('swept contact atomically fills exactly two slots across three boxes',()=>{
 const a=actor();a.total=30;const boxes=[box(8),box(16),box(24)];collectPickups([{actor:a,previous:0,previousLane:0}],boxes,100,()=>0);
 assert.deepEqual([a.held,a.heldSecond],['boost','boost']);assert.ok(boxes[0].cool>0&&boxes[1].cool>0);assert.equal(boxes[2].cool,0);
});
test('same-tick R then E requests execute E only and discard the other edge',()=>{
 const a=actor();a.held='boost';a.heldSecond='shield';const q=createItemRequests(),used:number[]=[];q.request(1,a);q.request(0,a);
 assert.equal(q.drain(a,slot=>{used.push(slot);return !!takeItem(a,slot);}),0);assert.equal(q.drain(a,()=>{assert.fail('no deferred R');}),null);assert.deepEqual(used,[0]);assert.equal(a.heldSecond,'shield');
});
test('invalid E does not reserve future pickup; canceled batches cannot fire after pause/reset',()=>{
 const a=actor(),q=createItemRequests();q.request(0,a);storeItem(a,'boost');assert.equal(q.drain(a,()=>{assert.fail('no pre-arm');}),null);
 for(const reason of ['pause','blur','reset','dispose']){q.request(0,a);q.clear();assert.equal(q.drain(a,()=>{assert.fail(reason);}),null);}
 q.request(0,a);a.held='shield';assert.equal(q.drain(a,()=>{assert.fail('replaced item');}),null);
});
test('NPC can retain no-target pulse in E and use eligible boost in R with normal cooldown',()=>{
 const a=actor();a.held='pulse';a.heldSecond='boost';assert.equal(chooseItemSlot(a,[a],1000,0),1);a.cooldown=1;assert.equal(chooseItemSlot(a,[a],1000,0),null);
 a.cooldown=0;a.heldSecond='pulse';assert.equal(chooseItemSlot(a,[a],1000,0),null);
});
test('one empty NPC slot permits default pickup targeting; two full slots preserve base line',()=>{
 const a=actor();a.held='pulse';const pickup={...box(20),lateral:2};assert.equal(planLane(a,[a],[pickup],1000,0,0),2);a.heldSecond='shield';assert.equal(planLane(a,[a],[pickup],1000,0,0),0);
});
test('water player and five NPCs opt into same two-slot capacity; reset is empty',()=>{
 const race=newWaterRace('gpt',undefined,2);for(const a of race.racers){assert.equal(storeItem(a,'boost'),0);assert.equal(storeItem(a,'shield'),1);assert.equal(storeItem(a,'pulse'),null);}
 assert.equal(useWaterItem(race,race.racers[0],1),undefined);race.countdown=0;assert.equal(useWaterItem(race,race.racers[0],1)?.item,'shield');assert.equal(race.racers[0].held,'boost');
 for(const a of newWaterRace('gpt',undefined,2).racers)assert.deepEqual([a.held,a.heldSecond],[null,null]);
});
test('water NPC warning preserves the selected slot instead of consuming E accidentally',()=>{
 const race=newWaterRace('gpt',undefined,2);race.countdown=0;const npc=race.racers[1];npc.held='pulse';npc.heldSecond='shield';npc.warning=.001;npc.warningSlot=1;
 advanceWaterRace(race,{throttle:false,brake:false,steer:0,drift:false},1/120);
 assert.equal(npc.held,'pulse');assert.equal(npc.heldSecond,null);assert.ok(npc.shield>0);assert.equal(npc.uses,1);
});
test('CPU harness capacity is explicit and all six roles use the same transaction',async()=>{
 const course=await loadLandSimulationCourse('coast');for(const capacity of [1,2] as const){const race=createCpuRace(course,{seed:20261015,itemCapacity:capacity});for(const a of race.actors){assert.equal(storeItem(a,'boost'),0);assert.equal(storeItem(a,'shield'),capacity===2?1:null);}race.step();}
});
test('use-before-pickup refills E without replaying its old press or shifting R',()=>{
 const a=actor(),q=createItemRequests();a.held='boost';a.heldSecond='shield';q.request(0,a);q.request(1,a);
 q.drain(a,slot=>!!activateItem(a,[a],100,undefined,slot));a.total=20;const pickup=box();collectPickups([{actor:a,previous:0,previousLane:0}],[pickup],100,()=>0);
 assert.deepEqual([a.held,a.heldSecond],['boost','shield']);assert.equal(a.shield,0);assert.equal(a.boost,3.3);assert.equal(q.drain(a,()=>{assert.fail('fresh item must wait for fresh edge');}),null);
});
test('two-slot CPU finish clears both inventories without applying an extra item',async()=>{
 const {decideLandCpu}=await import('../src/land-cpu');const course=await loadLandSimulationCourse('coast'),race=createCpuRace(course,{seed:7,itemCapacity:2});const a=race.actors[0];a.total=course.length*3;a.held='boost';a.heldSecond='shield';
 decideLandCpu(a,[a],[],race.context,{dt:1/60,elapsed:1});assert.deepEqual([a.held,a.heldSecond],[null,null]);assert.equal(a.boost,0);assert.equal(a.shield,0);
});
