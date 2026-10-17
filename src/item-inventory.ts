import type {ItemKind} from './item-models';
export type ItemSlot=0|1;
/** Omitted heldSecond means a legacy single-slot fixture. Browser races
 * explicitly initialize it to null; slot identities never compact. */
export interface ItemInventory {
 held:ItemKind|null;heldSecond?:ItemKind|null;
 /** Opt-in experiment. Missing/false preserves the original slot behavior. */
 itemStacking?:boolean;
 heldCount?:number;heldSecondCount?:number;
 heldUpgraded?:boolean;heldSecondUpgraded?:boolean;
}
export function itemAt(inventory:ItemInventory,slot:ItemSlot=0):ItemKind|null{return slot===0?inventory.held:inventory.heldSecond??null;}
export function itemUpgraded(inventory:ItemInventory,slot:ItemSlot=0):boolean{
 return !!inventory.itemStacking&&!!itemAt(inventory,slot)&&(slot===0?inventory.heldUpgraded:inventory.heldSecondUpgraded)===true;
}
/** Remaining uses, not source pickups: an upgraded item represents three
 * pickups but is used once. Legacy occupied slots implicitly contain one. */
export function itemCount(inventory:ItemInventory,slot:ItemSlot=0):number{
 if(!itemAt(inventory,slot))return 0;
 if(!inventory.itemStacking||itemUpgraded(inventory,slot))return 1;
 return (slot===0?inventory.heldCount:inventory.heldSecondCount)===2?2:1;
}
/** Occupancy only, including during the experiment. A mystery box must not
 * roll a kind when there is no empty slot to accept every possible result. */
export function inventoryFull(inventory:ItemInventory){return !!inventory.held&&(inventory.heldSecond===undefined||!!inventory.heldSecond);}
export function inventoryHas(inventory:ItemInventory,kind:ItemKind){return inventory.held===kind||inventory.heldSecond===kind;}
function storageSlot(inventory:ItemInventory,item:ItemKind):ItemSlot|null{
 if(inventory.itemStacking){
  if(([0,1] as const).some(slot=>itemAt(inventory,slot)===item&&itemUpgraded(inventory,slot)))return null;
  for(const slot of [0,1] as const)if(itemAt(inventory,slot)===item)return slot;
 }
 if(!inventory.held)return 0;
 if(inventory.heldSecond===null)return 1;
 return null;
}
export function canStoreItem(inventory:ItemInventory,item:ItemKind):boolean{return storageSlot(inventory,item)!==null;}
function setStack(inventory:ItemInventory,slot:ItemSlot,count:number,upgraded=false){
 if(slot===0){inventory.heldCount=count;inventory.heldUpgraded=upgraded;}
 else{inventory.heldSecondCount=count;inventory.heldSecondUpgraded=upgraded;}
}
export function storeItem(inventory:ItemInventory,item:ItemKind):ItemSlot|null{
 const slot=storageSlot(inventory,item);if(slot===null)return null;
 if(inventory.itemStacking){
  const count=itemCount(inventory,slot);
  setStack(inventory,slot,count===1?2:1,count===2);
 }
 if(slot===0)inventory.held=item;else inventory.heldSecond=item;
 return slot;
}
export function takeItem(inventory:ItemInventory,slot:ItemSlot=0){
 const item=itemAt(inventory,slot);if(!item)return null;
 if(inventory.itemStacking){
  if(itemCount(inventory,slot)===2){setStack(inventory,slot,1);return item;}
  setStack(inventory,slot,0);
 }
 if(slot===0)inventory.held=null;else inventory.heldSecond=null;return item;
}
export function clearInventory(inventory:ItemInventory){
 inventory.held=null;
 if(inventory.itemStacking)setStack(inventory,0,0);
 if(inventory.heldSecond!==undefined){inventory.heldSecond=null;if(inventory.itemStacking)setStack(inventory,1,0);}
}
/** Edge requests for the next accepted tick only. Empty-slot presses do not
 * arm future pickups. E wins ties; unsuccessful E may fall through to R.
 * Every drain discards the whole batch, including the unconsumed second edge. */
export function createItemRequests(){
 const pending=new Map<ItemSlot,{item:ItemKind;count:number;upgraded:boolean;stacking:boolean}>();
 return {
  request(slot:ItemSlot,inventory:ItemInventory){
   const item=itemAt(inventory,slot);
   if(item)pending.set(slot,{item,count:itemCount(inventory,slot),upgraded:itemUpgraded(inventory,slot),stacking:!!inventory.itemStacking});
  },
  clear(){pending.clear();},
  drain(inventory:ItemInventory,use:(slot:ItemSlot)=>boolean){
   const batch=new Map(pending);pending.clear();
   for(const slot of [0,1] as const){
    const request=batch.get(slot);
    if(request&&itemAt(inventory,slot)===request.item&&!!inventory.itemStacking===request.stacking
      &&(!request.stacking||(itemCount(inventory,slot)===request.count&&itemUpgraded(inventory,slot)===request.upgraded))
      &&use(slot))return slot;
   }
   return null;
  },
 };
}
