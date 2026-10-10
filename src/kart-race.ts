import { RULES } from './npc-tactics';
import { driveSpeed } from './vehicle-controls.js';
import { loadGarageState, resolveBuild, validateBuild, kartTuning, compileKartBuild, type KartBuild, type KartTrackContext } from './kart-build';
import { getNpcPresets } from './kart-presets';
import { resolveCharacter } from './character-profiles';

/** URL snapshot survives a denied browser storage write. Unknown/oversized input
 * never controls asset URLs: the catalog is the only authority for part IDs. */
export function raceKartBuild(search: string, stored = loadGarageState().activeBuild): KartBuild {
  const encoded = new URLSearchParams(search).get('kart');
  if (encoded && encoded.length <= 2048) {
    try { const value = JSON.parse(encoded); if (validateBuild(value)) return resolveBuild(value); } catch { /* use the saved build */ }
  }
  return resolveBuild(stored);
}
export function buildForRacer(id: unknown, selectedId: unknown, activeBuild: KartBuild, seed = 20261010): KartBuild {
  return resolveCharacter(id).id === resolveCharacter(selectedId).id ? activeBuild : getNpcPresets('coast', seed).find(p => p.characterId === resolveCharacter(id).id)!.build;
}
export function raceKartTuning(id: unknown, selectedId: unknown, activeBuild: KartBuild) {
  return kartTuning(id, 'coast', buildForRacer(id, selectedId, activeBuild));
}
export function kartBuildKey(build: KartBuild) {
  return ['body','chassis','motor','transmission','battery','wheels'].map(slot => build[slot]).join('|');
}

export function createRaceKartTuning(activeBuild: KartBuild, seed = 20261010) {
  const player = compileKartBuild(activeBuild), opponents = new Map(getNpcPresets('coast', seed).map(p => [p.characterId, compileKartBuild(p.build)]));
  return (id: unknown, selectedId: unknown, context?: KartTrackContext) =>
    (resolveCharacter(id).id === resolveCharacter(selectedId).id ? player : opponents.get(resolveCharacter(id).id)!).tuning(id, 'coast', context);
}
/** Signed road gradient and heading change per metre, from the same rendered
 * centerline used for placement. Builds face identical conditions, including AI. */
export function kartRoadContext(distance: number, speed: number, sample: (distance: number) => {t:{x:number;y:number;z:number}}): KartTrackContext {
  const a=sample(distance).t, b=sample(distance+7).t;
  return {speed,grade:a.y/Math.max(.01,Math.hypot(a.x,a.z)),curvature:Math.atan2(a.x*b.z-a.z*b.x,a.x*b.x+a.z*b.z)/7};
}

/** Player and coast AI share the exact forward speed integrator and effect caps.
 * AI difficulty may choose inputs, never modify these physics parameters. */
export function stepRaceKartSpeed(speed: number, input: {throttle?: boolean; brake?: boolean; reverse?: boolean; handbrake?: boolean}, dt: number,
 tuning: {maxSpeed:number;multipliers:{acceleration:number}}, boost: number, slow: number, offroad = false) {
 const limit=tuning.maxSpeed*(boost>0?RULES.boostFactor:1)*(slow>0?RULES.slowFactor:1)*(offroad?.58:1);
 return driveSpeed(speed,input,dt*(input.throttle&&!input.reverse&&!input.brake&&speed>=0&&speed<limit?tuning.multipliers.acceleration:1),limit);
}
