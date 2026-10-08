import type { ItemKind, ItemDisplay } from './item-models';

export const ITEM_KINDS: readonly ItemKind[] = ['boost', 'shield', 'pulse'];
export const MYSTERY_CHANCE = .25;
export const PICKUP_RESPAWN_SECONDS = 8;
export interface PickupState {
  display: ItemDisplay;
  cool: number;
  mesh: { enabled: boolean };
  models: Record<ItemDisplay, { enabled: boolean }>;
}
const roll = (rng: () => number) => Math.min(1 - Number.EPSILON, Math.max(0, rng()));
export const randomItem = (rng = Math.random): ItemKind => ITEM_KINDS[Math.floor(roll(rng) * ITEM_KINDS.length)];
export function rollDisplay(rng = Math.random): ItemDisplay {
  return roll(rng) < MYSTERY_CHANCE ? 'mystery' : randomItem(rng);
}
export function setPickupDisplay(box: PickupState, display: ItemDisplay) {
  box.display = display;
  for (const [kind, model] of Object.entries(box.models)) model.enabled = kind === display;
}
export function resetPickup(box: PickupState, rng = Math.random) {
  box.cool = 0;
  setPickupDisplay(box, rollDisplay(rng));
  box.mesh.enabled = true;
}
/** Claim synchronously before returning the reward: a second racer cannot claim it. */
export function claimPickup(box: PickupState, occupied: boolean, rng = Math.random): ItemKind | null {
  if (occupied || box.cool > 0 || !box.mesh.enabled) return null;
  const reward = box.display === 'mystery' ? randomItem(rng) : box.display;
  box.cool = PICKUP_RESPAWN_SECONDS;
  box.mesh.enabled = false; // Parent hides the glass, frame AND enclosed model immediately.
  return reward;
}
/** Call only while racing. Pausing/countdown/menu must not consume the cooldown. */
export function advancePickup(box: PickupState, dt: number, rng = Math.random) {
  if (box.cool <= 0) return;
  box.cool = Math.max(0, box.cool - Math.max(0, dt));
  if (box.cool === 0) resetPickup(box, rng);
}
