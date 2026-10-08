import type { GameSettings } from './game-settings';
import type { MapId } from './map-profiles';

export const MENU_SCENE_SECONDS = 30;
export const MENU_FADE_SECONDS = 1.15;
export const MENU_MAX_FPS = 30;
export type MenuBackdropOptions = {map?: MapId; autoCycle?: boolean};

const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

/** Fade fully dark at a switch; scene creation happens behind that same curtain. */
export function menuBackdropPhase(seconds: number, reducedMotion = false, options: MenuBackdropOptions = {}) {
  const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  if (reducedMotion) return { map: options.map ?? 'waterpark', localTime: 0, opacity: 0 };
  if (!(options.autoCycle ?? !options.map)) return { map: options.map ?? 'waterpark', localTime: time, opacity: 1 - smooth(time / MENU_FADE_SECONDS) };
  const index = Math.floor(time / MENU_SCENE_SECONDS), localTime = time % MENU_SCENE_SECONDS;
  const opacity = localTime < MENU_FADE_SECONDS
    ? 1 - smooth(localTime / MENU_FADE_SECONDS)
    : smooth((localTime - MENU_SCENE_SECONDS + MENU_FADE_SECONDS) / MENU_FADE_SECONDS);
  return { map: (index % 2 ? 'coast' : 'waterpark') as MapId, localTime, opacity };
}

/** Explicitly bounded even on a retina or 4K display. */
export function menuBackdropQuality(settings: GameSettings, width: number, height: number, deviceRatio = 1) {
  const high = settings.quality === 'high', low = settings.quality === 'low';
  const pixels = low ? 850_000 : high ? 2_000_000 : 1_350_000;
  const area = Math.max(1, Number.isFinite(width * height) ? width * height : 1);
  return {
    pixelRatio: Math.min(Math.max(.25, deviceRatio || 1), low ? 1 : high ? 1.5 : 1.25, Math.sqrt(pixels / area)),
    shadows: !low,
    shadowResolution: high ? 1024 : 512,
    refraction: high && settings.refraction,
    reflection: !low,
  };
}

/** Slow orbital motion and a separate radial dolly, without cuts within a shot.
 * Portrait moves back to retain the same landmarks beside the title controls. */
export function menuCameraPose(map: MapId, seconds: number, aspect = 16 / 9) {
  const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const portrait = Math.max(0, Math.min(1, 1 - aspect));
  if (map === 'waterpark') {
    const angle = -1.92 + time * .012;
    const radius = (110 + Math.sin(time * .075) * 7) * (1 + portrait * .8);
    const target: [number, number, number] = [22 - portrait * 30, 6, 113 + portrait * 6];
    return { position: [target[0] + Math.cos(angle) * radius, 39 + Math.sin(time * .055) * 3 + portrait * 24,
      target[2] + Math.sin(angle) * radius] as [number, number, number], target, fov: 53 };
  }
  const angle = -2.16 + time * .011;
  const radius = (225 + Math.sin(time * .07) * 13) * (1 + portrait * .2);
  const target: [number, number, number] = [-8, 3, -30];
  return { position: [target[0] + Math.cos(angle) * radius, 92 + Math.sin(time * .06) * 5 + portrait * 17,
    target[2] + Math.sin(angle) * radius] as [number, number, number], target, fov: 53 };
}
