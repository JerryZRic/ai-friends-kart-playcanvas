import * as pc from 'playcanvas';

/** Original procedural geometry, authored for AI Friends Kart. AGPL-3.0-only.
 * These are the source models, not borrowed game assets or font characters.
 * The inventory portraits and world entities consume these same triangles.
 */
export type ItemKind = 'boost' | 'shield' | 'pulse';
export type ItemDisplay = ItemKind | 'mystery';
type Point = readonly [number, number, number];
type Point2 = readonly [number, number];
export interface ItemModelPart {
  readonly color: string;
  readonly metalness: number;
  readonly positions: readonly number[];
  readonly normals: readonly number[];
  readonly indices: readonly number[];
}
export interface ItemGeometry {
  readonly type: ItemDisplay;
  readonly parts: readonly ItemModelPart[];
  readonly bounds: { readonly min: Point; readonly max: Point };
  readonly triangleCount: number;
}
export const ITEM_MODEL_METADATA = Object.freeze({
  author: 'AI Friends Kart contributors',
  license: 'AGPL-3.0-only',
  source: 'src/item-models.ts',
  original: true,
  portrait: 'Orthographic, lit triangle projection of the world geometry',
  items: Object.freeze({
    boost: Object.freeze({ name: 'Comet boost', color: '#ff9d34', description: 'Finned orange rocket with an ivory speed crest and a faceted flame' }),
    shield: Object.freeze({ name: 'Tide shield', color: '#55d9f2', description: 'Deep-blue kite shield with a silver-cyan bevel and a raised crest' }),
    pulse: Object.freeze({ name: 'Nova pulse', color: '#ed70e9', description: 'Faceted plasma core enclosed by crossed luminous orbital rings' }),
    mystery: Object.freeze({ name: 'Mystery item', color: '#ffdb6b', description: 'Solid, beveled gold question mark with a separate raised dot' }),
  }),
});

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: Point): Point => { const n = Math.hypot(...v); return [v[0] / n, v[1] / n, v[2] / n]; };
const rotate = (p: Point, x = 0, y = 0, z = 0): Point => {
  const a = x * Math.PI / 180, b = y * Math.PI / 180, c = z * Math.PI / 180;
  const q: Point = [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)];
  const r: Point = [q[0] * Math.cos(b) + q[2] * Math.sin(b), q[1], -q[0] * Math.sin(b) + q[2] * Math.cos(b)];
  return [r[0] * Math.cos(c) - r[1] * Math.sin(c), r[0] * Math.sin(c) + r[1] * Math.cos(c), r[2]];
};
type MutablePart = { color: string; metalness: number; positions: number[]; normals: number[]; indices: number[] };

/** Flat normals intentionally preserve toy-like facets and hard metal bevels. */
class ModelBuilder {
  parts = new Map<string, MutablePart>();
  triangle(color: string, a: Point, b: Point, c: Point, metalness = .2) {
    const normal = cross(sub(b, a), sub(c, a));
    if (Math.hypot(...normal) < 1e-9) return;
    const key = `${color}:${metalness}`;
    if (!this.parts.has(key)) this.parts.set(key, { color, metalness, positions: [], normals: [], indices: [] });
    const part = this.parts.get(key)!, offset = part.positions.length / 3, n = unit(normal);
    part.positions.push(...a, ...b, ...c); part.normals.push(...n, ...n, ...n); part.indices.push(offset, offset + 1, offset + 2);
  }
  quad(color: string, a: Point, b: Point, c: Point, d: Point, metalness = .2) {
    this.triangle(color, a, b, c, metalness); this.triangle(color, a, c, d, metalness);
  }
  /** Closed ring profile around +Y. End points may have zero radius. */
  lathe(profile: readonly (readonly [number, number])[], colors: readonly string[], segments = 12, center: Point = [0, 0, 0]) {
    const at = (ring: number, segment: number): Point => {
      const [y, r] = profile[ring], a = segment * Math.PI * 2 / segments;
      return [center[0] + Math.cos(a) * r, center[1] + y, center[2] + Math.sin(a) * r];
    };
    for (let i = 0; i < profile.length - 1; i++) for (let j = 0; j < segments; j++) {
      this.quad(colors[Math.min(i, colors.length - 1)], at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1));
    }
  }
  /** Ear-clipped 2D extrusion; front is +Z. Also supports concave symbols. */
  extrude(points: readonly Point2[], front: number, back: number, face: string, edge: string) {
    const p = [...points];
    const area = p.reduce((s, v, i) => { const q = p[(i + 1) % p.length]; return s + v[0] * q[1] - q[0] * v[1]; }, 0);
    if (area < 0) p.reverse();
    const at = (i: number, z: number): Point => [p[i][0], p[i][1], z];
    const indices = p.map((_, i) => i);
    const side = (a: Point2, b: Point2, c: Point2) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    while (indices.length > 2) {
      let clipped = false;
      for (let i = 0; i < indices.length; i++) {
        const a = indices[(i + indices.length - 1) % indices.length], b = indices[i], c = indices[(i + 1) % indices.length];
        if (side(p[a], p[b], p[c]) <= 1e-10) continue;
        if (indices.some(j => j !== a && j !== b && j !== c && side(p[a], p[b], p[j]) >= -1e-10 && side(p[b], p[c], p[j]) >= -1e-10 && side(p[c], p[a], p[j]) >= -1e-10)) continue;
        this.triangle(face, at(a, front), at(b, front), at(c, front));
        this.triangle(edge, at(c, back), at(b, back), at(a, back));
        indices.splice(i, 1); clipped = true; break;
      }
      if (!clipped) throw new Error('Item silhouette cannot be triangulated');
    }
    for (let i = 0; i < p.length; i++) {
      const j = (i + 1) % p.length;
      this.quad(edge, at(i, back), at(j, back), at(j, front), at(i, front));
    }
  }
  /** Faceted domed face over a convex silhouette, with a visible raised rim. */
  plate(points: readonly Point2[], z: number, edge: string, face: string, centerZ: number) {
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      this.quad(edge, [p[0], p[1], z], [q[0], q[1], z], [q[0] * .82, q[1] * .82, z + .055], [p[0] * .82, p[1] * .82, z + .055], .45);
      this.triangle(face, [p[0] * .82, p[1] * .82, z + .055], [q[0] * .82, q[1] * .82, z + .055], [0, 0, centerZ]);
    }
  }
  torus(radius: number, thickness: number, color: string, rotation: Point, segments = 28, sides = 6) {
    const at = (u: number, v: number): Point => {
      const a = u * 2 * Math.PI / segments, b = v * 2 * Math.PI / sides;
      return rotate([(radius + thickness * Math.cos(b)) * Math.cos(a), (radius + thickness * Math.cos(b)) * Math.sin(a), thickness * Math.sin(b)], ...rotation);
    };
    for (let i = 0; i < segments; i++) for (let j = 0; j < sides; j++) this.quad(color, at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1), .35);
  }
  finish(type: ItemDisplay, rotation: Point = [0, 0, 0]): ItemGeometry {
    const parts = [...this.parts.values()];
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const part of parts) for (let i = 0; i < part.positions.length; i += 3) {
      const p = rotate(part.positions.slice(i, i + 3) as unknown as Point, ...rotation);
      const n = rotate(part.normals.slice(i, i + 3) as unknown as Point, ...rotation);
      for (let axis = 0; axis < 3; axis++) { part.positions[i + axis] = p[axis]; part.normals[i + axis] = n[axis]; min[axis] = Math.min(min[axis], p[axis]); max[axis] = Math.max(max[axis], p[axis]); }
    }
    const size = Math.max(...max.map((v, i) => v - min[i])), center = max.map((v, i) => (v + min[i]) / 2);
    for (const part of parts) {
      for (let i = 0; i < part.positions.length; i++) part.positions[i] = (part.positions[i] - center[i % 3]) / size;
      Object.freeze(part.positions); Object.freeze(part.normals); Object.freeze(part.indices); Object.freeze(part);
    }
    return Object.freeze({ type, parts: Object.freeze(parts), bounds: Object.freeze({ min: Object.freeze(min.map((v, i) => (v - center[i]) / size)) as unknown as Point, max: Object.freeze(max.map((v, i) => (v - center[i]) / size)) as unknown as Point }), triangleCount: parts.reduce((sum, part) => sum + part.indices.length / 3, 0) });
  }
}

function buildGeometry(type: ItemDisplay): ItemGeometry {
  const b = new ModelBuilder();
  if (type === 'boost') {
    // Distinct flame/nozzle/body/nose silhouette; the crest is real raised mesh.
    b.lathe([[-.69, 0], [-.50, .09], [-.37, .105], [-.33, 0]], ['#ffc94f', '#ff7038', '#ff9d34'], 8);
    b.lathe([[-.43, 0], [-.40, .105], [-.28, .105], [-.26, 0]], ['#203456', '#203456', '#203456']);
    b.lathe([[-.31, 0], [-.30, .15], [-.24, .18], [-.06, .185], [.03, .185], [.27, .155], [.38, .10], [.48, 0]], ['#ffb344', '#ffb344', '#ff9d34', '#fff4d5', '#ff9d34', '#ffb344', '#fff4d5']);
    b.extrude([[-.12, -.04], [-.31, -.25], [-.34, -.43], [-.14, -.32]], .065, -.065, '#fff4d5', '#df6840');
    b.extrude([[.12, -.04], [.31, -.25], [.34, -.43], [.14, -.32]], .065, -.065, '#fff4d5', '#df6840');
    b.extrude([[.025, .28], [-.10, .06], [.003, .06], [-.045, -.11], [.13, .13], [.025, .13]], .195, .17, '#fff4d5', '#d27932');
    return b.finish(type, [0, 0, -25]);
  }
  if (type === 'shield') {
    const outline: Point2[] = [[0, -.53], [.30, -.30], [.43, .17], [.35, .40], [0, .50], [-.35, .40], [-.43, .17], [-.30, -.30]];
    b.extrude(outline, .025, -.115, '#164e80', '#164e80');
    b.plate(outline, .025, '#b2f6ff', '#38bbdf', .21);
    // Central chevron and inset jewel make the shield legible at HUD sizes.
    b.extrude([[-.22, .22], [0, .10], [.22, .22], [.17, .06], [0, -.06], [-.17, .06]], .24, .17, '#e2ffff', '#1688b3');
    b.extrude([[0, -.36], [.07, -.17], [0, -.10], [-.07, -.17]], .225, .14, '#a8f3ff', '#1688b3');
    return b.finish(type);
  }
  if (type === 'pulse') {
    b.lathe([[-.28, 0], [-.20, .16], [-.08, .245], [.08, .245], [.20, .16], [.28, 0]], ['#982dba', '#c84bdd', '#ed70e9', '#ffb8f4', '#ffd6fb'], 10);
    b.torus(.39, .043, '#d9eeff', [47, -23, 26], 24, 5);
    b.torus(.43, .039, '#a690ff', [-38, 36, -23], 24, 5);
    b.extrude([[.025, .17], [-.11, -.025], [-.012, -.025], [-.046, -.16], [.115, .052], [.024, .052]], .26, .225, '#fff0ff', '#bc39c4');
    return b.finish(type);
  }
  const hook: Point2[] = [[-.33, .22], [-.30, .38], [-.18, .49], [.13, .49], [.29, .41], [.35, .26], [.31, .11], [.19, .005], [.085, -.07], [.085, -.20], [-.10, -.20], [-.10, .006], [.035, .10], [.135, .17], [.16, .25], [.12, .31], [.045, .34], [-.08, .34], [-.14, .29], [-.15, .22]];
  b.extrude(hook, .07, -.11, '#ffbc43', '#b66328');
  const inset = hook.map(([x, y]): Point2 => [x * .90, (y - .15) * .90 + .15]);
  b.extrude(inset, .11, .068, '#fff0a6', '#f5a638');
  const dot: Point2[] = [[-.11, -.47], [.11, -.47], [.11, -.29], [-.11, -.29]];
  b.extrude(dot, .07, -.11, '#ffbc43', '#b66328');
  b.extrude(dot.map(([x, y]): Point2 => [x * .75, (y + .38) * .75 - .38]), .11, .068, '#fff0a6', '#f5a638');
  return b.finish(type, [0, 0, -7]);
}

const geometryCache = new Map<ItemDisplay, ItemGeometry>();
/** Stable immutable descriptors, shared by GPU models and CPU portraits. */
export function getItemGeometry(type: ItemDisplay): ItemGeometry {
  if (!geometryCache.has(type)) geometryCache.set(type, buildGeometry(type));
  return geometryCache.get(type)!;
}

type ModelResource = { mesh: pc.Mesh; material: pc.StandardMaterial };
const appResources = new WeakMap<pc.AppBase, Map<ItemDisplay, ModelResource[]>>();
/** Returns an independent entity; expensive meshes/materials are reused per app.
 * A cache reference keeps meshes alive even when every current instance is removed.
 */
export function createItemModel(app: pc.AppBase, type: ItemDisplay): pc.Entity {
  let cache = appResources.get(app);
  if (!cache) {
    cache = new Map(); appResources.set(app, cache);
    const owned = cache;
    app.once('destroy', () => {
      for (const resources of owned.values()) for (const { mesh, material } of resources) { mesh.decRefCount(); mesh.destroy(); material.destroy(); }
      owned.clear(); appResources.delete(app);
    });
  }
  if (!cache.has(type)) cache.set(type, getItemGeometry(type).parts.map(part => {
    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.setPositions([...part.positions]); mesh.setNormals([...part.normals]); mesh.setIndices([...part.indices]); mesh.update(pc.PRIMITIVE_TRIANGLES); mesh.incRefCount();
    const material = new pc.StandardMaterial();
    material.name = `${type} ${part.color}`; material.diffuse = new pc.Color().fromString(part.color);
    material.emissive = new pc.Color().fromString(part.color).mulScalar(.065);
    material.useMetalness = true; material.metalness = part.metalness; material.gloss = .48;
    material.cull = pc.CULLFACE_BACK; material.blendType = pc.BLEND_NONE; material.depthWrite = true; material.update();
    return { mesh, material };
  }));
  const entity = new pc.Entity(ITEM_MODEL_METADATA.items[type].name, app);
  entity.addComponent('render', { meshInstances: cache.get(type)!.map(({ mesh, material }) => new pc.MeshInstance(mesh, material)), castShadows: true, receiveShadows: true });
  return entity;
}

const imageCache = new Map<ItemDisplay, string>();
/** Render the actual model into a deterministic transparent SVG portrait.
 * No WebGL, DOM, canvas, font, downloaded image or separate icon asset is needed.
 * Backface culling, per-face normal lighting and far-to-near triangle ordering
 * provide an orthographic 3D render that also works during loading and in tests.
 */
export function itemImage(type: ItemDisplay): string {
  if (imageCache.has(type)) return imageCache.get(type)!;
  const geometry = getItemGeometry(type), light = unit([-.45, .85, 1.6]);
  const faces: { points: Point[]; z: number; fill: string }[] = [];
  const transformed = geometry.parts.map(part => ({ part, vertices: Array.from({ length: part.positions.length / 3 }, (_, i) => rotate(part.positions.slice(i * 3, i * 3 + 3) as unknown as Point, 16, -22)) }));
  const all = transformed.flatMap(({ vertices }) => vertices);
  const minX = Math.min(...all.map(p => p[0])), maxX = Math.max(...all.map(p => p[0]));
  const minY = Math.min(...all.map(p => p[1])), maxY = Math.max(...all.map(p => p[1]));
  const scale = 218 / Math.max(maxX - minX, maxY - minY), cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  for (const { part, vertices } of transformed) for (let i = 0; i < part.indices.length; i += 3) {
    const points = part.indices.slice(i, i + 3).map(index => vertices[index]);
    const normal = unit(cross(sub(points[1], points[0]), sub(points[2], points[0])));
    if (normal[2] <= 1e-7) continue;
    const brightness = .55 + .45 * Math.max(0, dot(normal, light));
    const rgb = [1, 3, 5].map(offset => Math.round(parseInt(part.color.slice(offset, offset + 2), 16) * brightness));
    faces.push({ points, z: points.reduce((sum, p) => sum + p[2], 0) / 3, fill: `rgb(${rgb.join(',')})` });
  }
  faces.sort((a, b) => a.z - b.z);
  const triangles = faces.map(({ points, fill }) => `<path d="M${points.map(p => `${((p[0] - cx) * scale + 128).toFixed(2)},${(128 - (p[1] - cy) * scale).toFixed(2)}`).join('L')}Z" fill="${fill}" stroke="${fill}" stroke-width="0.55" stroke-linejoin="round"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img"><title>${ITEM_MODEL_METADATA.items[type].name}</title><g>${triangles}</g></svg>`;
  const image = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  imageCache.set(type, image); return image;
}
