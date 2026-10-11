// Deterministic, deliberately narrow GLB-to-shared-scene conversion.
// No downloads, Blender invocation, simplification, coordinate rounding or mesh welding.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
export const SELECTED_ALPINE_IDS = ['04_ridge_picnic_table', '12_ranger_relief_map_station'];
export const ALPINE_MATERIAL_FAMILIES = Object.freeze({
  Alpine_cedar: 'wood', Alpine_bark: 'bark', Alpine_slate: 'stone',
  Alpine_charcoal: 'darkStone', Alpine_pine: 'pine', Alpine_cream: 'white',
  Alpine_sage: 'pineTips', Alpine_water: 'darkStone', Alpine_coral: 'red',
  Alpine_gold: 'yellow', Alpine_brass: 'yellow',
});
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (condition, message) => assert.ok(condition, message);

/** Only the committed opaque, static, embedded-buffer glTF subset is accepted. */
export function readAlpineGlb(bytes, expectedId) {
  check(bytes.readUInt32LE(0) === 0x46546c67 && bytes.readUInt32LE(4) === 2, 'Expected GLB 2');
  check(bytes.readUInt32LE(8) === bytes.length, 'GLB length mismatch');
  let document, binary;
  for (let offset = 12; offset < bytes.length;) {
    check(offset + 8 <= bytes.length, 'Truncated GLB chunk');
    const size = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    check(size % 4 === 0 && offset + 8 + size <= bytes.length, 'Invalid GLB chunk size');
    const body = bytes.subarray(offset + 8, offset + 8 + size);
    if (type === 0x4e4f534a) { check(!document, 'Duplicate JSON chunk'); document = JSON.parse(body.toString('utf8')); }
    else if (type === 0x004e4942) { check(!binary, 'Duplicate binary chunk'); binary = body; }
    else throw new Error('Unexpected GLB chunk type');
    offset += 8 + size;
  }
  check(document?.asset?.version === '2.0' && binary, 'Missing glTF document or binary');
  check(!document.extensionsRequired?.length && !document.extensionsUsed?.length, 'Extensions need explicit review');
  for (const key of ['images', 'textures', 'animations', 'skins', 'cameras']) check(!document[key]?.length, `Unexpected ${key}`);
  check(document.buffers?.length === 1 && !document.buffers[0].uri, 'Only one embedded buffer is supported');
  check(document.buffers[0].byteLength <= binary.length && binary.length - document.buffers[0].byteLength < 4, 'Buffer length mismatch');
  check(document.nodes?.length === 1 && document.meshes?.length === 1, 'Expected one mesh and one node');
  const node = document.nodes[0];
  check(node.mesh === 0 && node.name === expectedId, 'Unexpected source node identity');
  for (const key of ['matrix', 'translation', 'rotation', 'scale', 'children', 'weights', 'extensions']) check(node[key] === undefined, `Unexpected node ${key}`);
  assert.deepEqual(document.scenes?.[document.scene ?? 0]?.nodes, [0], 'Unexpected scene roots');
  function accessor(index, type, components, acceptedTypes) {
    const a = document.accessors[index], view = document.bufferViews[a?.bufferView];
    check(a && a.type === type && acceptedTypes.includes(a.componentType), 'Unexpected accessor format');
    check(Number.isInteger(a.count) && a.count > 0 && !a.sparse && !a.normalized, 'Unsupported accessor');
    check(view?.buffer === 0 && !view.extensions, 'Unsupported buffer view');
    const size = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
    const stride = view.byteStride ?? size * components, offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    check(stride >= size * components && stride % size === 0 && offset % size === 0, 'Invalid accessor alignment');
    check((a.byteOffset ?? 0) + (a.count - 1) * stride + size * components <= view.byteLength, 'Accessor escapes buffer view');
    check((view.byteOffset ?? 0) + view.byteLength <= document.buffers[0].byteLength, 'Buffer view escapes buffer');
    const output = [];
    for (let i = 0; i < a.count; i++) for (let j = 0; j < components; j++) {
      const at = offset + i * stride + j * size;
      const value = a.componentType === 5126 ? binary.readFloatLE(at)
        : a.componentType === 5125 ? binary.readUInt32LE(at)
        : a.componentType === 5123 ? binary.readUInt16LE(at) : binary.readUInt8(at);
      check(Number.isFinite(value), 'Nonfinite source attribute'); output.push(value);
    }
    return output;
  }
  const materials = document.meshes[0].primitives.map((p, sourcePrimitive) => {
    check((p.mode ?? 4) === 4 && !p.targets && !p.extensions, 'Only static triangle primitives are supported');
    assert.deepEqual(Object.keys(p.attributes).sort(), ['NORMAL', 'POSITION', 'TEXCOORD_0']);
    const sourceMaterial = document.materials[p.material], pbr = sourceMaterial?.pbrMetallicRoughness;
    check(sourceMaterial && ALPINE_MATERIAL_FAMILIES[sourceMaterial.name], 'Unmapped Alpine material');
    check((sourceMaterial.alphaMode ?? 'OPAQUE') === 'OPAQUE' && (pbr?.baseColorFactor?.[3] ?? 1) === 1, 'Only opaque source materials are supported');
    check(!sourceMaterial.extensions && !pbr?.baseColorTexture && !pbr?.metallicRoughnessTexture && !sourceMaterial.normalTexture && !sourceMaterial.occlusionTexture && !sourceMaterial.emissiveTexture, 'Unexpected material dependency');
    const positions = accessor(p.attributes.POSITION, 'VEC3', 3, [5126]);
    const normals = accessor(p.attributes.NORMAL, 'VEC3', 3, [5126]);
    const uvs = accessor(p.attributes.TEXCOORD_0, 'VEC2', 2, [5126]);
    const indices = accessor(p.indices, 'SCALAR', 1, [5121, 5123, 5125]);
    check(normals.length === positions.length && uvs.length === positions.length / 3 * 2, 'Attribute count mismatch');
    check(indices.length % 3 === 0 && indices.every(i => i >= 0 && i < positions.length / 3), 'Invalid triangle indices');
    for (let i = 0; i < normals.length; i += 3) check(Math.abs(Math.hypot(...normals.slice(i, i + 3)) - 1) < 1e-4, 'Invalid source normal');
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = indices.slice(i, i + 3).map(k => positions.slice(k * 3, k * 3 + 3));
      const u = b.map((n, k) => n - a[k]), v = c.map((n, k) => n - a[k]);
      check(Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) > 2e-12, 'Degenerate source triangle');
    }
    return { sourcePrimitive, sourceMaterial: sourceMaterial.name, sourcePbr: pbr,
      family: ALPINE_MATERIAL_FAMILIES[sourceMaterial.name], positions, indices, uvs,
      sourceNormalsSha256: sha256(JSON.stringify(normals)) };
  });
  return { materials, document };
}

function uniquePoints(points) {
  return [...new Map(points.map(p => [p.join(','), p])).values()].sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
}
/** Conservative complete projected hull; this is a reservation, not a collider. */
function footprint(points) {
  const p = uniquePoints(points.map(([x, , z]) => [x, 0, z]));
  const cross = (a, b, c) => (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
  const half = ordered => { const out = []; for (const v of ordered) { while (out.length > 1 && cross(out.at(-2), out.at(-1), v) <= 0) out.pop(); out.push(v); } return out; };
  const lo = half(p), hi = half([...p].reverse()); lo.pop(); hi.pop();
  return [...lo, ...hi];
}

export function convertAlpineProps(sourceDirectory = resolve(root, 'models/alpine-campsite')) {
  const manifest = JSON.parse(readFileSync(resolve(sourceDirectory, 'selected-manifest.json'), 'utf8'));
  assert.deepEqual(manifest.assets.map(a => a.id), SELECTED_ALPINE_IDS, 'Unexpected selection');
  const props = manifest.assets.map(asset => {
    check(asset.file === `glb/${asset.id}.glb` && asset.lod === 0, 'Expected selected full-detail source');
    const bytes = readFileSync(resolve(sourceDirectory, asset.file));
    check(sha256(bytes) === asset.sha256, `Source hash mismatch: ${asset.id}`);
    const { materials } = readAlpineGlb(bytes, asset.id), points = [];
    for (const m of materials) for (let i = 0; i < m.positions.length; i += 3) points.push(m.positions.slice(i, i + 3));
    const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (const p of points) for (let k = 0; k < 3; k++) { bounds.min[k] = Math.min(bounds.min[k], p[k]); bounds.max[k] = Math.max(bounds.max[k], p[k]); }
    check(Math.abs(bounds.min[1]) < 1e-6, 'Source ground origin changed');
    const triangles = materials.reduce((sum, m) => sum + m.indices.length / 3, 0);
    check(triangles === asset.triangles && materials.length === asset.materials, 'Source complexity changed');
    return { kind: asset.id, source: { title: 'Alpine Campsite', file: asset.file, sha256: asset.sha256, lod: 0, triangles },
      materials, bounds, footprint: footprint(points),
      groundContacts: uniquePoints(points.filter(p => p[1] <= bounds.min[1] + 1e-6)),
      supportBand: { height: .05, points: uniquePoints(points.filter(p => p[1] <= bounds.min[1] + .05)) } };
  });
  return { version: 1, units: 'metres', upAxis: 'Y', frontAxis: '+Z',
    normalPolicy: 'Original normals remain in the selected GLBs; the shared scene renderer recalculates normals from unchanged source topology.',
    geometryPolicy: 'Exact source float32 positions and UV0, original indices and winding; no simplification, welding, rescaling or deformation.', props };
}

export const serializeAlpineProps = data => JSON.stringify(data) + '\n';
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  check(args.length === 0 || args.length === 1 && args[0] === '--check', 'Usage: node scripts/convert-alpine-props.mjs [--check]');
  const destination = resolve(root, 'src/generated/alpine-props.json');
  const output = serializeAlpineProps(convertAlpineProps());
  if (args[0] === '--check') assert.equal(readFileSync(destination, 'utf8'), output, 'Generated Alpine geometry is stale');
  else writeFileSync(destination, output);
  console.log(`Alpine selected geometry ${args[0] === '--check' ? 'verified' : 'written'}: 2 props, 6152 triangles, 15 source primitives; no extra runtime materials`);
}
