import { defaultBuild, loadGarageState, resolveBuild, validateBuild, kartTuning, compileKartBuild, type KartBuild, type KartTrackContext } from './kart-build';
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
export function buildForRacer(id: unknown, selectedId: unknown, activeBuild: KartBuild): KartBuild {
  return resolveCharacter(id).id === resolveCharacter(selectedId).id ? activeBuild : defaultBuild;
}
export function raceKartTuning(id: unknown, selectedId: unknown, activeBuild: KartBuild) {
  return kartTuning(id, 'coast', buildForRacer(id, selectedId, activeBuild));
}
export function kartBuildKey(build: KartBuild) {
  return ['body','chassis','motor','transmission','battery','wheels'].map(slot => build[slot]).join('|');
}

export function createRaceKartTuning(activeBuild: KartBuild) {
  const player = compileKartBuild(activeBuild), opponent = compileKartBuild(defaultBuild);
  return (id: unknown, selectedId: unknown, context?: KartTrackContext) =>
    (resolveCharacter(id).id === resolveCharacter(selectedId).id ? player : opponent).tuning(id, 'coast', context);
}
/** Signed road gradient and heading change per metre, from the same rendered
 * centerline used for placement. Builds face identical conditions, including AI. */
export function kartRoadContext(distance: number, speed: number, sample: (distance: number) => {t:{x:number;y:number;z:number}}): KartTrackContext {
  const a=sample(distance).t, b=sample(distance+7).t;
  return {speed,grade:a.y/Math.max(.01,Math.hypot(a.x,a.z)),curvature:Math.atan2(a.x*b.z-a.z*b.x,a.x*b.x+a.z*b.z)/7};
}
