import {catalog, KART_SLOTS, getPart, type KartBuild, type GarageState, type KartSlot} from './kart-build';

/** Whole-car selection is an atomic six-slot recipe, never a permanent lock. */
export const wholeCars = Object.freeze([...new Map(catalog.map(part => [part.themeId, part])).values()]
  .sort((a, b) => a.kitNumber - b.kitNumber)
  .map(part => Object.freeze({id: part.themeId, number: part.kitNumber, name: part.themeName,
    build: Object.freeze(Object.fromEntries(KART_SLOTS.map(slot => [slot, catalog.find(value => value.themeId === part.themeId && value.slot === slot)!.id])) as KartBuild)})));
export function sameKartBuild(a: KartBuild, b: KartBuild): boolean {return KART_SLOTS.every(slot => a[slot] === b[slot]);}
export function wholeCarForBuild(build: KartBuild) {return wholeCars.find(car => sameKartBuild(car.build, build));}
export function isMixedBuild(build: KartBuild): boolean {return new Set(KART_SLOTS.map(slot => getPart(build[slot])?.themeId)).size > 1;}
export function needsWholeCarConfirmation(state: GarageState, candidate: KartBuild): boolean {
  return !sameKartBuild(state.activeBuild, candidate) && isMixedBuild(state.activeBuild)
    && !state.namedBuilds.some(saved => sameKartBuild(saved.build, state.activeBuild));
}
export function filterWholeCars(query: string) {
  const needle = query.trim().toLocaleLowerCase();
  return wholeCars.filter(car => !needle || `${String(car.number).padStart(3, '0')} ${car.name} ${car.id}`.toLocaleLowerCase().includes(needle));
}
export type WholeCarUndo = {
  build: KartBuild; comparison: KartBuild; editingId: string | null; buildName: string; title: string; description: string;
  slot: KartSlot; theme: string; query: string; page: number;
};
export function copyWholeCarUndo(value: WholeCarUndo): WholeCarUndo {return {...value, build: {...value.build}, comparison: {...value.comparison}};}
