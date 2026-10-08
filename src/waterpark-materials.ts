import * as pc from 'playcanvas';

export type WaterparkSurface = 'stone' | 'wetStone' | 'sandstone' | 'paint' | 'tile' | 'fabric' | 'metal' | 'glass' | 'wood' | 'foliage' | 'cloud';
type SurfaceProfile = { roughness: number; metalness: number; reflection: number; coat: number; bump: number; texture?: 'mineral' | 'tile' | 'weave' };

// Keep the sunlit pastel silhouettes broad. Only tile, glazing and small metal
// fixtures get tight highlights; stone and cloth should never look lacquered.
export const WATERPARK_SURFACES: Readonly<Record<WaterparkSurface, SurfaceProfile>> = {
  stone:     { roughness: .88, metalness: 0, reflection: .23, coat: 0, bump: .2, texture: 'mineral' },
  wetStone:  { roughness: .25, metalness: 0, reflection: .62, coat: .2, bump: .1, texture: 'mineral' },
  sandstone: { roughness: .96, metalness: 0, reflection: .12, coat: 0, bump: .3, texture: 'mineral' },
  paint:     { roughness: .58, metalness: 0, reflection: .42, coat: .08, bump: .08, texture: 'mineral' },
  tile:      { roughness: .29, metalness: 0, reflection: .64, coat: .28, bump: .2, texture: 'tile' },
  fabric:    { roughness: .94, metalness: 0, reflection: .1, coat: 0, bump: .1, texture: 'weave' },
  metal:     { roughness: .32, metalness: .82, reflection: .78, coat: .12, bump: 0 },
  glass:     { roughness: .11, metalness: 0, reflection: .92, coat: .62, bump: 0 },
  wood:      { roughness: .77, metalness: 0, reflection: .24, coat: 0, bump: .1, texture: 'weave' },
  foliage:   { roughness: .85, metalness: 0, reflection: .14, coat: 0, bump: 0 },
  cloud:     { roughness: 1, metalness: 0, reflection: 0, coat: 0, bump: 0 },
};

export function waterparkSurfaceFor(name: string): WaterparkSurface {
  if (/glass|glazing/i.test(name)) return 'glass';
  if (/woven|fabric/i.test(name)) return 'fabric';
  if (/cloud/i.test(name)) return 'cloud';
  if (/leaves|planted|foliage/i.test(name)) return 'foliage';
  if (/trunks|timber/i.test(name)) return 'wood';
  if (/brushed|hardware/i.test(name)) return 'metal';
  if (/sand|joints/i.test(name)) return 'sandstone';
  if (/retaining|curb/i.test(name)) return 'tile';
  if (/stone|coping/i.test(name)) return 'stone';
  return 'paint';
}

/** World-metre planar UVs on all solid faces; avoids stretched primitive UVs. */
export function waterparkSurfaceUvs(positions: number[], normals: number[]): number[] {
  const uvs: number[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    const nx = Math.abs(normals[i]), ny = Math.abs(normals[i + 1]), nz = Math.abs(normals[i + 2]);
    if (ny >= nx && ny >= nz) uvs.push(x, z);
    else if (nx > nz) uvs.push(z, y);
    else uvs.push(x, y);
  }
  return uvs;
}

export const WATERPARK_ENVIRONMENT_SIZE = 256;
const SKY_WIDTH = 128, SKY_HEIGHT = 64, NORMAL_SIZE = 64;
const smoothstep = (a: number, b: number, x: number) => { const t = pc.math.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Original low-frequency lighting panorama, not a capture or downloaded HDRI. */
export function waterparkSkyPixels(): Uint8Array {
  const data = new Uint8Array(SKY_WIDTH * SKY_HEIGHT * 4);
  for (let y = 0; y < SKY_HEIGHT; y++) for (let x = 0; x < SKY_WIDTH; x++) {
    const elevation = Math.cos((y + .5) / SKY_HEIGHT * Math.PI);
    const azimuth = (x + .5) / SKY_WIDTH * Math.PI * 2;
    const high = smoothstep(-.06, .72, elevation), ground = smoothstep(-.02, -.38, elevation);
    const cloud = smoothstep(.75, .98, Math.sin(azimuth * 3 + elevation * 4) * .55 + Math.cos(azimuth * 5 - elevation * 8) * .45) * smoothstep(.03, .18, elevation) * (1 - smoothstep(.5, .8, elevation)) * .48;
    const horizon = [.66, .86, .95], zenith = [.12, .4, .76], earth = [.34, .39, .34];
    for (let c = 0; c < 3; c++) {
      const sky = pc.math.lerp(pc.math.lerp(horizon[c], zenith[c], high), .96, cloud);
      data[(y * SKY_WIDTH + x) * 4 + c] = Math.round(255 * pc.math.lerp(sky, earth[c], ground));
    }
    data[(y * SKY_WIDTH + x) * 4 + 3] = 255;
  }
  return data;
}

function normalPixels(kind: 'mineral' | 'tile' | 'weave'): Uint8Array {
  const data = new Uint8Array(NORMAL_SIZE * NORMAL_SIZE * 4);
  const height = (x: number, y: number) => {
    const u = (x + NORMAL_SIZE) % NORMAL_SIZE / NORMAL_SIZE, v = (y + NORMAL_SIZE) % NORMAL_SIZE / NORMAL_SIZE;
    if (kind === 'tile') return smoothstep(0, .05, Math.min(u, 1 - u, v, 1 - v)) * .16;
    if (kind === 'weave') return (Math.sin(u * Math.PI * 32) + Math.sin(v * Math.PI * 32)) * .017;
    return Math.sin(u * Math.PI * 10 + Math.sin(v * Math.PI * 4)) * .035 + Math.cos(v * Math.PI * 14 + Math.sin(u * Math.PI * 6)) * .025;
  };
  for (let y = 0; y < NORMAL_SIZE; y++) for (let x = 0; x < NORMAL_SIZE; x++) {
    const normal = new pc.Vec3((height(x - 1, y) - height(x + 1, y)) * 4, (height(x, y - 1) - height(x, y + 1)) * 4, 1).normalize();
    const i = (y * NORMAL_SIZE + x) * 4;
    data[i] = Math.round((normal.x * .5 + .5) * 255); data[i + 1] = Math.round((normal.y * .5 + .5) * 255); data[i + 2] = Math.round((normal.z * .5 + .5) * 255); data[i + 3] = 255;
  }
  return data;
}

export function createWaterparkMaterials(device: pc.GraphicsDevice) {
  const sky = new pc.Texture(device, {name: 'Waterpark original sky lighting', width: SKY_WIDTH, height: SKY_HEIGHT, projection: pc.TEXTUREPROJECTION_EQUIRECT, format: pc.PIXELFORMAT_RGBA8, mipmaps: false, levels: [waterparkSkyPixels()], addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_CLAMP_TO_EDGE});
  // Engine GGX prefilter runs once at scene creation. One small atlas is shared
  // by every solid surface; this is sky IBL, separate from the water reflection.
  const environment = pc.EnvLighting.generateAtlas(sky, {size: WATERPARK_ENVIRONMENT_SIZE, numReflectionSamples: 64, numAmbientSamples: 32});
  sky.destroy();
  const textures = new Map<string, pc.Texture>();
  for (const kind of ['mineral', 'tile', 'weave'] as const) textures.set(kind, new pc.Texture(device, {
    name: `Waterpark ${kind} normal`, width: NORMAL_SIZE, height: NORMAL_SIZE, format: pc.PIXELFORMAT_RGBA8,
    mipmaps: true, minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR, magFilter: pc.FILTER_LINEAR, addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_REPEAT,
    levels: [normalPixels(kind)],
  }));
  const materials = new Map<string, pc.StandardMaterial>();
  let destroyed = false;
  function get(name: string, color: string, surface = waterparkSurfaceFor(name)) {
    const key = `${surface}:${color}`;
    if (materials.has(key)) return materials.get(key)!;
    const p = WATERPARK_SURFACES[surface], material = new pc.StandardMaterial();
    material.name = `Waterpark ${surface} ${color}`;
    material.diffuse = new pc.Color().fromString(color);
    material.useMetalness = true; material.metalness = p.metalness; material.gloss = 1 - p.roughness;
    material.reflectivity = p.reflection; material.clearCoat = p.coat; material.clearCoatGloss = .82;
    material.cull = pc.CULLFACE_NONE; material.twoSidedLighting = true;
    if (surface !== 'cloud') material.envAtlas = environment;
    if (p.texture) {
      material.normalMap = textures.get(p.texture)!; material.bumpiness = p.bump;
      // Tile is an architectural scale; mineral/weave never add broad noise.
      const scale = p.texture === 'tile' ? 1.25 : p.texture === 'weave' ? 2 : 2.5;
      material.normalMapTiling.set(scale, scale);
    }
    // Tinted backed glazing stays opaque: no transparent sorting over water,
    // no extra screen-space refraction buffer for these small distant windows.
    if (surface === 'glass') { material.diffuse.mulScalar(.68); material.specularityFactor = 1.18; }
    if (surface === 'cloud') { material.emissive = new pc.Color(.24, .26, .28); }
    material.update(); materials.set(key, material); return material;
  }
  function destroy() {
    if (destroyed) return; destroyed = true;
    for (const material of materials.values()) material.destroy();
    for (const texture of textures.values()) texture.destroy();
    environment.destroy();
  }
  return {get, destroy, environment, materials, textures};
}
