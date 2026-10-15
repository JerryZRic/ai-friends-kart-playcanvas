import test from 'node:test';
import assert from 'node:assert/strict';
import {
 canStoreItem,clearInventory,createItemRequests,inventoryFull,inventoryHas,
 itemAt,itemCount,itemUpgraded,storeItem,takeItem,type ItemInventory,type ItemSlot,
} from '../src/item-inventory';
import type {ItemKind} from '../src/item-models';

const kinds:ItemKind[]=['boost','shield','pulse'];
const empty=():ItemInventory=>({held:null,heldSecond:null,itemStacking:true});
const view=(inventory:ItemInventory)=>[0,1].map(slot=>({
 item:itemAt(inventory,slot as ItemSlot),
 count:itemCount(inventory,slot as ItemSlot),
 upgraded:itemUpgraded(inventory,slot as ItemSlot),
}));
const sources=(inventory:ItemInventory,kind?:ItemKind)=>[0,1].reduce((total,slot)=>{
 const s=slot as ItemSlot;
 return total+(itemAt(inventory,s)&&(!kind||itemAt(inventory,s)===kind)?itemUpgraded(inventory,s)?3:itemCount(inventory,s):0);
},0);

test('missing and explicit OFF preserve original dual-slot shape and behavior',()=>{
 for(const itemStacking of [undefined,false]){
  const inventory:ItemInventory={held:null,heldSecond:null,...(itemStacking===undefined?{}:{itemStacking})};
  const keys=Object.keys(inventory);
  assert.equal(storeItem(inventory,'boost'),0);
  assert.equal(storeItem(inventory,'boost'),1);
  assert.equal(canStoreItem(inventory,'boost'),false);
  assert.equal(storeItem(inventory,'boost'),null);
  assert.equal(inventoryFull(inventory),true);
  assert.equal(itemCount(inventory,0),1);
  assert.equal(itemUpgraded(inventory,0),false);
  assert.equal(takeItem(inventory,0),'boost');
  assert.equal(itemAt(inventory,1),'boost');
  assert.equal(storeItem(inventory,'shield'),0);
  assert.equal(itemAt(inventory,1),'boost');
  clearInventory(inventory);
  assert.deepEqual([inventory.held,inventory.heldSecond],[null,null]);
  assert.deepEqual(Object.keys(inventory),keys);
 }
});

test('OFF ignores experimental metadata, even if it is present on a fixture',()=>{
 const inventory:ItemInventory={held:'boost',heldSecond:'shield',itemStacking:false,heldCount:2,heldUpgraded:true};
 assert.equal(itemCount(inventory),1);assert.equal(itemUpgraded(inventory),false);
 assert.equal(canStoreItem(inventory,'boost'),false);
 assert.equal(takeItem(inventory),'boost');assert.equal(inventory.held,null);
});

test('legacy omitted R remains unavailable in both modes',()=>{
 for(const itemStacking of [false,true]){
  const inventory:ItemInventory={held:null,itemStacking};
  assert.equal(storeItem(inventory,'boost'),0);
  assert.equal(inventoryFull(inventory),true);
  assert.equal(canStoreItem(inventory,'shield'),false);
  assert.equal(storeItem(inventory,'shield'),null);
  assert.equal(itemAt(inventory,1),null);
  if(itemStacking){assert.equal(storeItem(inventory,'boost'),0);assert.equal(storeItem(inventory,'boost'),0);assert.equal(storeItem(inventory,'boost'),null);}
  clearInventory(inventory);assert.equal(inventory.heldSecond,undefined);
 }
});

test('all ordinary kinds progress from one to two to a one-use upgrade',()=>{
 for(const kind of kinds){
  const inventory=empty();
  for(const [count,upgraded,sourceCount] of [[1,false,1],[2,false,2],[1,true,3]] as const){
   assert.equal(storeItem(inventory,kind),0);
   assert.equal(itemAt(inventory),kind);assert.equal(itemCount(inventory),count);
   assert.equal(itemUpgraded(inventory),upgraded);assert.equal(sources(inventory),sourceCount);
   assert.equal(itemAt(inventory,1),null);
  }
 }
});

test('an occupied ordinary slot defaults to one and an empty slot to zero',()=>{
 const inventory:ItemInventory={held:'boost',heldSecond:null,itemStacking:true};
 assert.equal(itemCount(inventory),1);assert.equal(itemUpgraded(inventory),false);
 assert.equal(itemCount(inventory,1),0);assert.equal(itemUpgraded(inventory,1),false);
 for(const count of [0,-1,3,4,1.5,NaN,Infinity]){inventory.heldCount=count;assert.equal(itemCount(inventory),1);}
 inventory.heldCount=2;inventory.heldUpgraded=true;
 assert.equal(itemCount(inventory),1);assert.equal(itemUpgraded(inventory),true);
 inventory.held=null;assert.equal(itemCount(inventory),0);assert.equal(itemUpgraded(inventory),false);
});

test('same-kind normal stack takes priority over an empty slot, including R before empty E',()=>{
 const inventory:ItemInventory={held:null,heldSecond:'pulse',itemStacking:true};
 assert.equal(storeItem(inventory,'pulse'),1);
 assert.equal(itemCount(inventory,1),2);assert.equal(itemAt(inventory),null);
 assert.equal(storeItem(inventory,'pulse'),1);
 assert.equal(itemUpgraded(inventory,1),true);assert.equal(itemAt(inventory),null);
 assert.equal(storeItem(inventory,'shield'),0);
 assert.equal(itemAt(inventory,1),'pulse');
});

test('E wins when both fixed slots contain the same ordinary kind',()=>{
 const inventory:ItemInventory={held:'boost',heldSecond:'boost',itemStacking:true};
 assert.equal(storeItem(inventory,'boost'),0);
 assert.deepEqual([itemCount(inventory),itemCount(inventory,1)],[2,1]);
 assert.equal(storeItem(inventory,'boost'),0);
 assert.equal(itemUpgraded(inventory),true);
 assert.equal(storeItem(inventory,'boost'),1);
 assert.deepEqual([itemCount(inventory),itemCount(inventory,1)],[1,2]);
});

test('an upgrade never stacks: it reuses an empty slot then rejects without overwrite',()=>{
 const inventory=empty();
 for(let i=0;i<3;i++)assert.equal(storeItem(inventory,'boost'),0);
 const upgradedE={item:itemAt(inventory),count:itemCount(inventory),upgraded:itemUpgraded(inventory)};
 assert.equal(storeItem(inventory,'shield'),1);
 const before=structuredClone(inventory);
 assert.equal(canStoreItem(inventory,'boost'),false);assert.equal(storeItem(inventory,'boost'),null);
 assert.deepEqual(inventory,before);
 assert.equal(takeItem(inventory,1),'shield');
 for(let i=0;i<3;i++)assert.equal(storeItem(inventory,'boost'),1);
 assert.deepEqual(view(inventory)[0],upgradedE);
 assert.equal(canStoreItem(inventory,'boost'),false);assert.equal(storeItem(inventory,'boost'),null);
 assert.equal(sources(inventory),6);
});

test('different kinds use E then R and a full incompatible pickup leaves both untouched',()=>{
 const inventory=empty();assert.equal(storeItem(inventory,'boost'),0);assert.equal(storeItem(inventory,'shield'),1);
 const before=structuredClone(inventory);
 assert.equal(canStoreItem(inventory,'pulse'),false);assert.equal(storeItem(inventory,'pulse'),null);
 assert.deepEqual(inventory,before);assert.equal(inventoryHas(inventory,'boost'),true);
 assert.equal(inventoryHas(inventory,'pulse'),false);
});

test('inventoryFull is occupancy-only although a known matching kind can still be stored',()=>{
 const inventory=empty();storeItem(inventory,'boost');storeItem(inventory,'shield');
 assert.equal(inventoryFull(inventory),true);
 assert.equal(canStoreItem(inventory,'boost'),true);assert.equal(canStoreItem(inventory,'shield'),true);
 assert.equal(canStoreItem(inventory,'pulse'),false);
 assert.equal(storeItem(inventory,'boost'),0);assert.equal(inventoryFull(inventory),true);
 takeItem(inventory,1);assert.equal(inventoryFull(inventory),false);
});

test('ordinary x2 consumes one per use and never shifts the other slot',()=>{
 for(const slot of [0,1] as const){
  const inventory:ItemInventory={held:'boost',heldSecond:'shield',itemStacking:true};
  const kind=itemAt(inventory,slot)!;const other=(1-slot) as ItemSlot;
  storeItem(inventory,kind);assert.equal(itemCount(inventory,slot),2);
  const otherBefore=view(inventory)[other];
  assert.equal(takeItem(inventory,slot),kind);assert.equal(itemCount(inventory,slot),1);assert.equal(itemAt(inventory,slot),kind);
  assert.equal(takeItem(inventory,slot),kind);assert.equal(itemCount(inventory,slot),0);assert.equal(itemAt(inventory,slot),null);
  assert.equal(takeItem(inventory,slot),null);assert.deepEqual(view(inventory)[other],otherBefore);
 }
});

test('upgraded use clears exactly its slot and refill starts as ordinary x1',()=>{
 const inventory:ItemInventory={held:'pulse',heldSecond:'boost',itemStacking:true};
 storeItem(inventory,'boost');storeItem(inventory,'boost');
 assert.equal(itemUpgraded(inventory,1),true);assert.equal(takeItem(inventory,1),'boost');
 assert.equal(itemAt(inventory,1),null);assert.equal(itemCount(inventory,1),0);assert.equal(itemUpgraded(inventory,1),false);
 assert.equal(itemAt(inventory),'pulse');assert.equal(storeItem(inventory,'boost'),1);
 assert.equal(itemCount(inventory,1),1);assert.equal(itemUpgraded(inventory,1),false);
});

test('clear resets both stacks and upgrades without changing the experiment setting',()=>{
 const inventory=empty();for(let i=0;i<3;i++)storeItem(inventory,'boost');for(let i=0;i<2;i++)storeItem(inventory,'shield');
 clearInventory(inventory);
 assert.deepEqual(view(inventory),[{item:null,count:0,upgraded:false},{item:null,count:0,upgraded:false}]);
 assert.equal(inventory.itemStacking,true);
 assert.equal(storeItem(inventory,'shield'),0);assert.equal(itemCount(inventory),1);assert.equal(itemUpgraded(inventory),false);
});

test('stacked same-tick R/E requests execute E once and discard the other edge',()=>{
 const inventory:ItemInventory={held:'boost',heldSecond:'shield',itemStacking:true};
 storeItem(inventory,'boost');storeItem(inventory,'shield');
 const queue=createItemRequests(),used:ItemSlot[]=[];
 queue.request(1,inventory);queue.request(0,inventory);
 assert.equal(queue.drain(inventory,slot=>{used.push(slot);return !!takeItem(inventory,slot);}),0);
 assert.deepEqual(used,[0]);assert.equal(itemCount(inventory),1);assert.equal(itemCount(inventory,1),2);
 assert.equal(queue.drain(inventory,()=>assert.fail('R must not be deferred')),null);
});

test('an unsuccessful E may fall through to R, while every drain discards its batch',()=>{
 const inventory:ItemInventory={held:'boost',heldSecond:'shield',itemStacking:true};
 const queue=createItemRequests(),attempted:ItemSlot[]=[];
 queue.request(1,inventory);queue.request(0,inventory);
 assert.equal(queue.drain(inventory,slot=>{attempted.push(slot);return slot===1&&!!takeItem(inventory,slot);}),1);
 assert.deepEqual(attempted,[0,1]);assert.equal(itemAt(inventory),'boost');
 assert.equal(queue.drain(inventory,()=>assert.fail('failed E must not be deferred')),null);
});

test('old request cannot consume a newly stacked, upgraded, or depleted item',()=>{
 for(const initialCount of [1,2]){
  const inventory=empty(),queue=createItemRequests();
  for(let i=0;i<initialCount;i++)storeItem(inventory,'boost');
  queue.request(0,inventory);storeItem(inventory,'boost');
  assert.equal(queue.drain(inventory,()=>assert.fail('pickup changed the requested item')),null);
  assert.equal(sources(inventory),initialCount+1);
 }
 const inventory=empty(),queue=createItemRequests();storeItem(inventory,'shield');storeItem(inventory,'shield');
 queue.request(0,inventory);takeItem(inventory);
 assert.equal(queue.drain(inventory,()=>assert.fail('stack was already depleted')),null);
});

test('reset cancellation prevents a same-kind replacement or rebuilt upgrade inheriting an edge',()=>{
 for(const count of [1,3]){
  const inventory=empty(),queue=createItemRequests();
  for(let i=0;i<count;i++)storeItem(inventory,'pulse');
  queue.request(0,inventory);queue.clear();clearInventory(inventory);
  for(let i=0;i<count;i++)storeItem(inventory,'pulse');
  assert.equal(queue.drain(inventory,()=>assert.fail('replacement must need a fresh edge')),null);
  assert.equal(sources(inventory),count);
 }
});

test('request snapshots work with per-tick temporary actor objects',()=>{
 const inventory=empty(),queue=createItemRequests();storeItem(inventory,'boost');storeItem(inventory,'boost');
 queue.request(0,inventory);
 const temporary={...inventory};
 assert.equal(queue.drain(temporary,slot=>!!takeItem(temporary,slot)),0);
 assert.equal(itemCount(temporary),1);assert.equal(itemCount(inventory),2);
});

test('mutation of the other slot does not invalidate the requested stack',()=>{
 const inventory:ItemInventory={held:'boost',heldSecond:'shield',itemStacking:true},queue=createItemRequests();
 queue.request(0,inventory);storeItem(inventory,'shield');
 assert.equal(queue.drain(inventory,slot=>!!takeItem(inventory,slot)),0);
 assert.equal(itemCount(inventory,1),2);
});

test('empty presses and canceled requests cannot arm pickups, and stale E can fall through to R',()=>{
 const inventory=empty(),queue=createItemRequests();queue.request(0,inventory);storeItem(inventory,'boost');
 assert.equal(queue.drain(inventory,()=>assert.fail('empty press cannot pre-arm')),null);
 for(const reason of ['pause','blur','reset','dispose']){
  queue.request(0,inventory);queue.clear();assert.equal(queue.drain(inventory,()=>assert.fail(reason)),null);
 }
 storeItem(inventory,'shield');queue.request(0,inventory);queue.request(1,inventory);storeItem(inventory,'boost');
 assert.equal(queue.drain(inventory,slot=>{assert.equal(slot,1);return !!takeItem(inventory,slot);}),1);
 assert.equal(itemCount(inventory),2);
});

test('requests compare visible count/upgrade snapshots and reject an experiment toggle',()=>{
 for(const change of [
  (inventory:ItemInventory)=>{inventory.heldCount=2;},
  (inventory:ItemInventory)=>{inventory.heldUpgraded=true;},
  (inventory:ItemInventory)=>{inventory.itemStacking=false;},
 ]){
  const inventory:ItemInventory={held:'boost',heldSecond:null,itemStacking:true},queue=createItemRequests();
  queue.request(0,inventory);change(inventory);
  assert.equal(queue.drain(inventory,()=>assert.fail('snapshot no longer matches')),null);
 }
});

test('all valid two-slot states conserve each kind across accepted/rejected pickups and uses',()=>{
 type ModelSlot={kind:ItemKind;sources:1|2|3}|null;
 const states:ModelSlot[]=[null,...kinds.flatMap(kind=>[1,2,3].map(sources=>({kind,sources:sources as 1|2|3})))];
 const make=(a:ModelSlot,b:ModelSlot):ItemInventory=>({
  held:a?.kind??null,heldSecond:b?.kind??null,itemStacking:true,
  heldCount:a?.sources===2?2:a?1:0,heldSecondCount:b?.sources===2?2:b?1:0,
  heldUpgraded:a?.sources===3,heldSecondUpgraded:b?.sources===3,
 });
 for(const a of states)for(const b of states)for(const kind of kinds){
  const slots=[a,b];const inventory=make(a,b);const before=structuredClone(inventory);
  let expectedSlot=slots.findIndex(slot=>slot?.kind===kind&&slot.sources<3);
  if(expectedSlot<0)expectedSlot=slots.findIndex(slot=>slot===null);
  const expected=expectedSlot<0?null:expectedSlot as ItemSlot;
  assert.equal(canStoreItem(inventory,kind),expected!==null);
  assert.deepEqual(inventory,before,'eligibility must be read-only');
  assert.equal(storeItem(inventory,kind),expected);
  if(expected===null)assert.deepEqual(inventory,before,'rejected pickup must not mutate');
  for(const checkedKind of kinds)assert.equal(sources(inventory,checkedKind),sources(before,checkedKind)+(expected!==null&&kind===checkedKind?1:0));
  if(expected!==null){
   const existing=slots[expected];const expectedSources=existing?existing.sources+1:1;
   assert.equal(itemAt(inventory,expected),kind);
   assert.equal(itemCount(inventory,expected),expectedSources===2?2:1);
   assert.equal(itemUpgraded(inventory,expected),expectedSources===3);
   assert.deepEqual(view(inventory)[1-expected],view(before)[1-expected],'slots must never move');
  }
  for(const slot of [0,1] as const){
   const beforeUse=structuredClone(inventory);const usedKind=itemAt(inventory,slot);
   const spent=usedKind?(itemUpgraded(inventory,slot)?3:1):0;
   assert.equal(takeItem(inventory,slot),usedKind);
   for(const checkedKind of kinds)assert.equal(sources(inventory,checkedKind),sources(beforeUse,checkedKind)-(usedKind===checkedKind?spent:0));
   assert.deepEqual(view(inventory)[1-slot],view(beforeUse)[1-slot]);
  }
 }
});
