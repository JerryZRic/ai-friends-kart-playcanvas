import * as pc from 'playcanvas';
import {waterparkLayout, WATER_RACE_LENGTH, WATER_HALF_WIDTH, type MeshData, type WaterparkGeometryOptions} from './waterpark-design';
import {finiteWaterValue} from './waterpark-surface';

export const WATERPARK_BED_BUDGET = Object.freeze({batches: 2, triangles: 4200, textureSize: 128});
export const WATERPARK_BED_EXTENT = Object.freeze({start: -35, end: 335, step: 2});
export const WATERPARK_BED_LANES = Object.freeze([-12, -11.6, -10.4, -8, -4, 0, 4, 8, 10.4, 11.6, 12]);
export const WATERPARK_BED_NAMES = Object.freeze({floor: 'Submerged ivory tile basin', inlays: 'Submerged blue tile depth markers'});
export type WaterparkBedMesh = MeshData & {submerged: true};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Positive, metre-scale depth below the shared y=0 water datum. The edge is
 * inside the existing coping wall (which extends to -0.4), and always remains
 * below the lowest analytical wave. The whole channel is still presentation,
 * with no change to movement/collision limits. */
export function sampleWaterparkBedDepth(distance: number, lateral: number, options: WaterparkGeometryOptions = {}) {
  const d = options.race ? finiteWaterValue(distance) % WATER_RACE_LENGTH : clamp(finiteWaterValue(distance), WATERPARK_BED_EXTENT.start, WATERPARK_BED_EXTENT.end);
  const l = clamp(Math.abs(finiteWaterValue(lateral)), 0, WATER_HALF_WIDTH);
  const phase = d / WATER_RACE_LENGTH * Math.PI * 2;
  const deep = options.race ? 2.65 + Math.sin(phase * 2) * .18 + Math.cos(phase) * .1 : 2.65 + Math.sin(d * .024) * .18 + Math.cos(d * .011) * .1;
  const t = clamp((WATER_HALF_WIDTH - l) / 4, 0, 1), slope = t * t * (3 - 2 * t);
  return .36 + (deep - .36) * slope;
}

/** One indexed curved basin and one merged set of small physical tile inlays.
 * These are real opaque submerged surfaces for refraction color/depth capture,
 * not a second plane on top of the water or a screen-space floor approximation. */
export function createWaterparkBedDesign(options: WaterparkGeometryOptions = {}): WaterparkBedMesh[] {
  const {sample, start, end, closed} = waterparkLayout(options);
  const depthAt = (d: number, l: number) => sampleWaterparkBedDepth(d, l, options);
  const make = (name: string, color: string): WaterparkBedMesh => ({name, color, positions: [], indices: [], uvs: [], submerged: true});
  const floor = make(WATERPARK_BED_NAMES.floor, '#d8e7de'), inlays = make(WATERPARK_BED_NAMES.inlays, '#428a9d');
  const {step} = WATERPARK_BED_EXTENT, lanes = WATERPARK_BED_LANES;
  const rows = Math.ceil((end - start) / step) + 1;
  for (let row = 0; row < rows; row++) {
    const d = Math.min(end, start + row * step);
    let crossDistance = 0, previousDepth = depthAt(d, lanes[0]);
    for (let col = 0; col < lanes.length; col++) {
      const lane = lanes[col], depth = depthAt(d, lane), p = sample(d, lane).p;
      if (col) crossDistance += Math.hypot(lane - lanes[col - 1], depth - previousDepth);
      floor.positions.push(p.x, -depth, p.z);
      // The repeat contains 4 x 4 half-metre tiles. Arc-length UVs keep grout
      // widths consistent across the shallows rather than projecting from above.
      floor.uvs.push(crossDistance / 2, d / 2); previousDepth = depth;
      if (row < rows - 1 && col < lanes.length - 1) {
        const a = row * lanes.length + col, b = a + 1, c = a + lanes.length, e = c + 1;
        floor.indices.push(a, c, b, b, c, e);
      }
    }
  }
  // Short dark-blue mosaic strips create a readable distortion reference in
  // the refracted image. Central floor is flat laterally so these tiny raised
  // inlays cannot intersect the coarser slope triangles or produce z fighting.
  for (let d = closed ? 9 : -28; d < end - 5; d += 8) for (const lane of [-5, 5]) {
    const offset = inlays.positions.length / 3;
    // Place vertices on an existing floor row to match its interpolated depth.
    const from = d - 1, to = d + 1;
    for (const [s, l] of [[from, lane - .16], [from, lane + .16], [to, lane - .16], [to, lane + .16]]) {
      const p = sample(s, l).p;
      inlays.positions.push(p.x, -depthAt(s, l) + .006, p.z);
      inlays.uvs.push((l - lane) * .5, s * .5);
    }
    inlays.indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
  }
  return [floor, inlays];
}

/** Original deterministic tile albedo and shallow grout normal map. No image
 * download, canvas, asset registry entry, or per-tile draw call is needed. */
export function waterparkBedTilePixels(normal = false): Uint8Array {
  const size = WATERPARK_BED_BUDGET.textureSize, cell = size / 4, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, u = x % cell, v = y % cell;
    if (normal) {
      const nx = u === 1 ? -.22 : u === cell - 1 ? .22 : 0;
      const ny = v === 1 ? -.22 : v === cell - 1 ? .22 : 0;
      const length = Math.hypot(nx, ny, 1);
      pixels[i] = Math.round((nx / length * .5 + .5) * 255);
      pixels[i + 1] = Math.round((ny / length * .5 + .5) * 255);
      pixels[i + 2] = Math.round((1 / length * .5 + .5) * 255);
    } else {
      const tile = Math.floor(x / cell) + Math.floor(y / cell) * 4;
      const variation = ((tile * 7) % 9 - 4) * 2;
      const grout = u === 0 || v === 0;
      for (let c = 0; c < 3; c++) pixels[i + c] = grout ? [105, 146, 149][c] : [218, 236, 228][c] + variation;
    }
    pixels[i + 3] = 255;
  }
  return pixels;
}

export function createWaterparkBedMaterials(device: pc.GraphicsDevice, environment?: pc.Texture) {
  const size = WATERPARK_BED_BUDGET.textureSize;
  const texture = (normal: boolean) => new pc.Texture(device, {
    name: normal ? 'Waterpark basin grout normals' : 'Waterpark basin ivory tile albedo', width: size, height: size,
    format: normal ? pc.PIXELFORMAT_RGBA8 : pc.PIXELFORMAT_SRGBA8,
    mipmaps: true, minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR, magFilter: pc.FILTER_LINEAR,
    addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_REPEAT, levels: [waterparkBedTilePixels(normal)],
  });
  const albedo = texture(false), normal = texture(true), materials = new Map<string, pc.StandardMaterial>();
  for (const name of Object.values(WATERPARK_BED_NAMES)) {
    const material = new pc.StandardMaterial(); material.name = name;
    material.diffuse = new pc.Color().fromString(name === WATERPARK_BED_NAMES.floor ? '#ffffff' : '#40879b');
    if (name === WATERPARK_BED_NAMES.floor) material.diffuseMap = albedo;
    material.normalMap = normal; material.bumpiness = .18;
    material.useMetalness = true; material.metalness = 0; material.gloss = .32; material.reflectivity = .15;
    material.cull = pc.CULLFACE_NONE; material.twoSidedLighting = true;
    if (environment) material.envAtlas = environment;
    material.update(); materials.set(name, material);
  }
  let destroyed = false;
  function destroy() {
    if (destroyed) return; destroyed = true;
    for (const material of materials.values()) material.destroy();
    albedo.destroy(); normal.destroy();
  }
  function get(name: string) {
    const material = materials.get(name);
    if (!material) throw new Error(`Unknown waterpark bed material: ${name}`);
    return material;
  }
  return {get, materials, textures: [albedo, normal], destroy};
}
