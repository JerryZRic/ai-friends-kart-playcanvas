import type { GameSettings } from './game-settings';
import type { MapId } from './map-profiles';
import {sample as sampleCoast,LENGTH as COAST_LENGTH} from './track';
import {sampleWaterparkLoop,WATER_RACE_LENGTH,WATER_RACE_BRIDGE_DISTANCE,WATER_RACE_TOWER_DISTANCE,WATER_RACE_TOWER_LANE} from './waterpark-design';

export const MENU_SCENE_SECONDS = 30;
export const MENU_FADE_SECONDS = 1.15;
export const MENU_MAX_FPS = 30;
export type MenuPresentation = 'cover' | 'map-preview';
export type MenuBackdropOptions = {map?: MapId; autoCycle?: boolean; presentation?: MenuPresentation};

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

type Point = [number, number, number];
const route = (map: MapId) => map === 'coast'
  ? {sample: sampleCoast, length: COAST_LENGTH, lane: 9}
  : {sample: sampleWaterparkLoop, length: WATER_RACE_LENGTH, lane: 14};
const portraitWeight = (aspect: number) => smooth((1 - Math.max(.2, Number.isFinite(aspect) ? aspect : 16 / 9)) / .55);

/** The route remains the source of truth after layout changes. Wide previews
 * show the full course; narrow previews focus on a real S section or the tower
 * sweep instead of cropping to empty infield. The study scene is not sampled. */
function buildCameraAnchors(map: MapId, aspect = 16 / 9): Point[] {
  const {sample, length, lane} = route(map), portrait = portraitWeight(aspect);
  const focus = map === 'coast' ? length * .71 : WATER_RACE_TOWER_DISTANCE;
  const span = length * (1 - portrait * .74), points: Point[] = [];
  for (let i = 0; i <= 96; i++) for (const lateral of [-lane, lane]) {
    const p = sample(focus - span / 2 + i / 96 * span, lateral).p;
    points.push([p.x, p.y + 1, p.z]);
  }
  if (map === 'waterpark') {
    const tower = sampleWaterparkLoop(WATER_RACE_TOWER_DISTANCE, WATER_RACE_TOWER_LANE).p;
    for (const x of [-8, 8]) for (const y of [2, 27]) for (const z of [-8, 8]) points.push([tower.x + x, y, tower.z + z]);
    if (portrait < .5) {
      const bridge = sampleWaterparkLoop(WATER_RACE_BRIDGE_DISTANCE);
      for (const lateral of [-18, 18]) for (const forward of [-4, 4]) points.push([
        bridge.p.x + bridge.n.x * lateral + bridge.t.x * forward, 10,
        bridge.p.z + bridge.n.z * lateral + bridge.t.z * forward,
      ]);
    }
  }
  return points;
}

// Route sampling runs only when the viewport changes, not every animation frame.
// Bound the cache even while repeatedly resizing a window or switching maps.
const frameCache = new Map<MapId, {aspect: number; points: Point[]; target: Point}>();
function cameraFrame(map: MapId, aspect: number) {
  const cached = frameCache.get(map);
  if (cached?.aspect === aspect) return cached;
  const points = buildCameraAnchors(map, aspect);
  const min = [0, 1, 2].map(axis => Math.min(...points.map(point => point[axis])));
  const max = [0, 1, 2].map(axis => Math.max(...points.map(point => point[axis])));
  const target = min.map((value, axis) => (value + max[axis]) / 2) as Point;
  const frame = {aspect, points, target}; frameCache.set(map, frame);
  return frame;
}
export function menuCameraAnchors(map: MapId, aspect = 16 / 9): Point[] {
  return cameraFrame(map, aspect).points.map(point => [...point] as Point);
}

/** Fit actual route/landmark anchors with viewport margin. Slow orbital motion
 * and a separate radial dolly are continuous within each thirty-second shot. */
export function menuCameraPose(map: MapId, seconds: number, aspect = 16 / 9) {
  const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
  const {points, target} = cameraFrame(map, safeAspect);
  const angle = (map === 'coast' ? -2.16 : -1.92) + time * .0065;
  const pitch = map === 'coast' ? .59 : .55;
  const direction = [Math.cos(angle) * Math.cos(pitch), Math.sin(pitch), Math.sin(angle) * Math.cos(pitch)];
  const right = [-Math.sin(angle), 0, Math.cos(angle)];
  const up = [-Math.cos(angle) * Math.sin(pitch), Math.cos(pitch), -Math.sin(angle) * Math.sin(pitch)];
  const fov = 53, tanV = Math.tan(fov * Math.PI / 360), tanH = tanV * safeAspect;
  let distance = 55;
  for (const point of points) {
    const relative = point.map((value, axis) => value - target[axis]);
    const dot = (axis: number[]) => relative.reduce((sum, value, index) => sum + value * axis[index], 0);
    distance = Math.max(distance, dot(direction) + Math.max(Math.abs(dot(right)) / tanH, Math.abs(dot(up)) / tanV) / .86);
  }
  distance += 8 + Math.sin(time * .075) * 5;
  return {position: target.map((value, axis) => value + direction[axis] * distance) as Point, target: [...target] as Point, fov};
}

/** Keep the cover's focal point on a real S-bend centerline. A slow, bounded
 * metre-distance sweep follows that section continuously; no world-bounds
 * center or empty-water fallback is used, even in portrait layouts. */
export function coverTrackTarget(map: MapId, seconds: number): Point {
  const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const {sample, length} = route(map);
  const distance = length * (map === 'coast' ? .69 : .165) + 24 * Math.sin(time * .05);
  const point = sample(distance).p;
  return [point.x, point.y + .3, point.z];
}

/** Reduce the previous cover radius by one third and triple its motion rate:
 * original overview radius * 2/9, original orbit/dolly phase * 9.
 * Translate that exact offset onto the real track focal point without re-fit
 * or zoom clamps. This baseline remains independent of map-selection zoom. */
export function coverCameraPose(map: MapId, seconds: number, aspect = 16 / 9) {
  const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const baseline = menuCameraPose(map, time * 9, aspect);
  const target = coverTrackTarget(map, time);
  return {
    position: baseline.position.map((value, axis) => target[axis] + (value - baseline.target[axis]) * 2 / 9) as Point,
    target,
    fov: baseline.fov,
  };
}

/** Map selection is a calm elevated course diorama beside full-route cards.
 * Fit actual geometry in its own viewport and keep the lens above the palms;
 * the previous close orbit could put large leaves directly in front of it.
 * This composition deliberately has no dependency on the cover zoom/phase. */
export function mapPreviewCameraPose(map: MapId, seconds: number, aspect = 16 / 9) {
  const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
  const {points, target} = cameraFrame(map, safeAspect);
  const angle = (map === 'coast' ? -2.16 : -1.92) + Math.sin(time * .045) * .14;
  const pitch = .76, direction = [Math.cos(angle) * Math.cos(pitch), Math.sin(pitch), Math.sin(angle) * Math.cos(pitch)];
  const right = [-Math.sin(angle), 0, Math.cos(angle)];
  const up = [-Math.cos(angle) * Math.sin(pitch), Math.cos(pitch), -Math.sin(angle) * Math.sin(pitch)];
  const fov = 48, tanV = Math.tan(fov * Math.PI / 360), tanH = tanV * safeAspect;
  let distance = 110;
  for (const point of points) {
    const relative = point.map((value, axis) => value - target[axis]);
    const dot = (axis: number[]) => relative.reduce((sum, value, index) => sum + value * axis[index], 0);
    distance = Math.max(distance, dot(direction) + Math.max(Math.abs(dot(right)) / tanH, Math.abs(dot(up)) / tanV) / .88);
  }
  distance += 10 + 2 * Math.sin(time * .065);
  return {position: target.map((value, axis) => value + direction[axis] * distance) as Point, target: [...target] as Point, fov};
}
