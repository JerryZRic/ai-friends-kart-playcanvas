import type {ItemKind} from './item-models';
export type ItemSlot=0|1;
/** Omitted heldSecond means a legacy single-slot fixture. Browser races
 * explicitly initialize it to null; slot identities never compact. */
export interface ItemInventory {held:ItemKind|null;heldSecond?:ItemKind|null}
export function itemAt(inventory:ItemInventory,slot:ItemSlot=0):ItemKind|null{return slot===0?inventory.held:inventory.heldSecond??null;}
export function inventoryFull(inventory:ItemInventory){return !!inventory.held&&(inventory.heldSecond===undefined||!!inventory.heldSecond);}
export function inventoryHas(inventory:ItemInventory,kind:ItemKind){return inventory.held===kind||inventory.heldSecond===kind;}
export function storeItem(inventory:ItemInventory,item:ItemKind):ItemSlot|null{
 if(!inventory.held){inventory.held=item;return 0;}
 if(inventory.heldSecond===null){inventory.heldSecond=item;return 1;}
 return null;
}
export function takeItem(inventory:ItemInventory,slot:ItemSlot=0){
 const item=itemAt(inventory,slot);if(!item)return null;
 if(slot===0)inventory.held=null;else inventory.heldSecond=null;return item;
}
export function clearInventory(inventory:ItemInventory){inventory.held=null;if(inventory.heldSecond!==undefined)inventory.heldSecond=null;}
/** Edge requests for the next accepted tick only. Empty-slot presses do not
 * arm future pickups. E wins ties; unsuccessful E may fall through to R.
 * Every drain discards the whole batch, including the unconsumed second edge. */
export function createItemRequests(){
 const pending=new Map<ItemSlot,ItemKind>();
 return {
  request(slot:ItemSlot,inventory:ItemInventory){const item=itemAt(inventory,slot);if(item)pending.set(slot,item);},
  clear(){pending.clear();},
  drain(inventory:ItemInventory,use:(slot:ItemSlot)=>boolean){
   const batch=new Map(pending);pending.clear();
   for(const slot of [0,1] as const)if(batch.has(slot)&&itemAt(inventory,slot)===batch.get(slot)&&use(slot))return slot;
   return null;
  },
 };
}
