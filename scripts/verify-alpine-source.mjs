// Rebuild only the selected authoring source in a NEW staging directory.
// Requires an already-installed Blender; does not install, render or download.
// Original committed assets are read-only inputs and are hash-checked afterward.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { readAlpineGlb } from './convert-alpine-props.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const inputDirectory = resolve(root, 'models/alpine-campsite');
const [directory, ...extra] = process.argv.slice(2);
assert.ok(directory && extra.length === 0, 'Usage: node scripts/verify-alpine-source.mjs NEW_OUTPUT_DIRECTORY');
const destination = resolve(directory), parent = realpathSync(dirname(destination));
assert.equal(parent, dirname(destination), 'Output parent must not use a symlink');
const projectRelative = relative(root, destination);
assert.ok(projectRelative.startsWith('..') || isAbsolute(projectRelative), 'Use a new staging directory outside the source checkout');
assert.ok(!existsSync(destination), 'Staging directory already exists; preserve it and choose a new one');
mkdirSync(destination);
mkdirSync(resolve(destination, 'source'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceScript = readFileSync(resolve(inputDirectory, 'source/generate-selected.py'));
copyFileSync(resolve(inputDirectory, 'source/generate-selected.py'), resolve(destination, 'source/generate-selected.py'));
const manifest = JSON.parse(readFileSync(resolve(inputDirectory, 'selected-manifest.json'), 'utf8'));
const originals = manifest.assets.map(asset => {
  const bytes = readFileSync(resolve(inputDirectory, asset.file));
  assert.equal(hash(bytes), asset.sha256, 'Original source hash changed');
  return { asset, bytes };
});
const report = {
  schema: 1, sourceScriptSha256: hash(sourceScript),
  policy: 'Original positions, UV0, source normals, materials and indexed triangle connectivity/winding must reproduce exactly. Triangle enumeration and cyclic corner start may differ and are explicitly reported; no coordinate tolerance, topology change, reversed winding or deformation is accepted. Exporter document metadata differences are listed separately.',
  blenderExecutable: process.env.BLENDER_BIN || 'blender',
  blenderCommand: ['--factory-startup', '-b', '-t', '1', '--python-exit-code', '1', '--python', resolve(destination, 'source/generate-selected.py')],
  process: null, props: [], originalsUnchanged: false, result: 'NOT_RUN',
};
const save = () => writeFileSync(resolve(destination, 'authoring-reproduction-report.json'), JSON.stringify(report, null, 2) + '\n');
save();

// Keep native and numerical-library thread counts bounded in the same short run.
const run = spawnSync(report.blenderExecutable, report.blenderCommand, {
  cwd: destination, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  env: { ...process.env, PWD: destination, OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1', MKL_NUM_THREADS: '1' },
});
writeFileSync(resolve(destination, 'blender-stdout.log'), run.stdout ?? '');
writeFileSync(resolve(destination, 'blender-stderr.log'), run.stderr ?? '');
report.process = { status: run.status, signal: run.signal, error: run.error?.message ?? null };
save();

// Independent normal-array read, after the narrow converter has checked buffers.
function sourceNormals(bytes, document, primitive) {
  let binary;
  for (let at = 12; at < bytes.length; at += 8 + bytes.readUInt32LE(at)) {
    if (bytes.readUInt32LE(at + 4) === 0x004e4942) binary = bytes.subarray(at + 8, at + 8 + bytes.readUInt32LE(at));
  }
  const accessor = document.accessors[primitive.attributes.NORMAL], view = document.bufferViews[accessor.bufferView];
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), stride = view.byteStride ?? 12, values = [];
  for (let i = 0; i < accessor.count; i++) for (let k = 0; k < 3; k++) values.push(binary.readFloatLE(start + i * stride + k * 4));
  return values;
}
function canonicalTriangles(primitive, normals, attributes = false) {
  const vertex = index => JSON.stringify(attributes
    ? [primitive.positions.slice(index * 3, index * 3 + 3), normals.slice(index * 3, index * 3 + 3), primitive.uvs.slice(index * 2, index * 2 + 2)]
    : primitive.positions.slice(index * 3, index * 3 + 3));
  const out = [];
  for (let i = 0; i < primitive.indices.length; i += 3) {
    const p = primitive.indices.slice(i, i + 3).map(vertex);
    out.push([0, 1, 2].map(k => [p[k], p[(k + 1) % 3], p[(k + 2) % 3]].join('|')).sort()[0]);
  }
  return out.sort();
}
function canonicalIndexTriangles(indices) {
  const out = [];
  for (let i = 0; i < indices.length; i += 3) {
    const p = indices.slice(i, i + 3);
    out.push([0, 1, 2].map(k => [p[k], p[(k + 1) % 3], p[(k + 2) % 3]].join(',')).sort()[0]);
  }
  return out.sort();
}
function documentDifferences(a, b, path = '') {
  if (isDeepStrictEqual(a, b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(key => documentDifferences(a[key], b[key], `${path}/${key}`));
  }
  return [{ path, original: a ?? null, rebuilt: b ?? null }];
}
function difference(a, b) {
  if (isDeepStrictEqual(a, b)) return { equal: true, length: a.length };
  let first = -1, changed = 0, maxAbsoluteDifference = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) {
    if (first < 0) first = i; changed++;
    if (Number.isFinite(a[i]) && Number.isFinite(b[i])) maxAbsoluteDifference = Math.max(maxAbsoluteDifference, Math.abs(a[i] - b[i]));
  }
  return { equal: false, originalLength: a.length, rebuiltLength: b.length, changed, first,
    originalValue: a[first] ?? null, rebuiltValue: b[first] ?? null, maxAbsoluteDifference };
}

try {
  assert.equal(run.status, 0, 'Blender did not exit successfully; logs preserved');
  assert.match(run.stdout ?? '', /ALPINE_SELECTED_SOURCE_COMPLETE 2/, 'Selected authoring completion marker missing');
  assert.ok(existsSync(resolve(destination, 'source/alpine-selected.blend')), 'Editable selected scene missing');
  for (const { asset, bytes } of originals) {
    const rebuilt = readFileSync(resolve(destination, asset.file));
    const a = readAlpineGlb(bytes, asset.id), b = readAlpineGlb(rebuilt, asset.id);
    const record = { id: asset.id, originalSha256: hash(bytes), rebuiltSha256: hash(rebuilt),
      fileBytesEqual: bytes.equals(rebuilt), exporterMetadataOriginal: a.document.asset,
      exporterMetadataRebuilt: b.document.asset, materialCountEqual: a.materials.length === b.materials.length,
      fullMaterialDefinitionsEqual: isDeepStrictEqual(a.document.materials, b.document.materials),
      documentDifferences: documentDifferences(a.document, b.document),
      primitives: [], exactPayloadEqual: false, geometryMaterialTopologyEquivalent: false };
    for (let i = 0; i < a.materials.length; i++) {
      const original = a.materials[i], candidate = b.materials[i];
      if (!candidate) { record.primitives.push({ index: i, missing: true }); continue; }
      const originalNormals = sourceNormals(bytes, a.document, a.document.meshes[0].primitives[i]);
      const rebuiltNormals = sourceNormals(rebuilt, b.document, b.document.meshes[0].primitives[i]);
      const fields = { positions: difference(original.positions, candidate.positions), indices: difference(original.indices, candidate.indices),
        uvs: difference(original.uvs, candidate.uvs), normals: difference(originalNormals, rebuiltNormals) };
      const materialEqual = original.sourceMaterial === candidate.sourceMaterial && isDeepStrictEqual(original.sourcePbr, candidate.sourcePbr);
      const orientedGeometryTrianglesEqual = isDeepStrictEqual(canonicalTriangles(original, originalNormals), canonicalTriangles(candidate, rebuiltNormals));
      const orientedAttributedTrianglesEqual = isDeepStrictEqual(canonicalTriangles(original, originalNormals, true), canonicalTriangles(candidate, rebuiltNormals, true));
      const indexedTriangleTopologyEqual = isDeepStrictEqual(canonicalIndexTriangles(original.indices), canonicalIndexTriangles(candidate.indices));
      record.primitives.push({ index: i, material: original.sourceMaterial, fields, materialEqual,
        orientedGeometryTrianglesEqual, orientedAttributedTrianglesEqual, indexedTriangleTopologyEqual,
        exactPayloadEqual: materialEqual && Object.values(fields).every(f => f.equal),
        geometryMaterialTopologyEquivalent: materialEqual && fields.positions.equal && fields.uvs.equal && fields.normals.equal && indexedTriangleTopologyEqual });
    }
    record.exactPayloadEqual = record.materialCountEqual && record.primitives.every(p => p.exactPayloadEqual);
    record.geometryMaterialTopologyEquivalent = record.materialCountEqual && record.fullMaterialDefinitionsEqual && record.primitives.every(p => p.geometryMaterialTopologyEquivalent);
    report.props.push(record); save();
  }
  report.result = report.props.length === 2 && report.props.every(p => p.geometryMaterialTopologyEquivalent) ? 'PASS' : 'FAIL';
} catch (error) {
  report.result = 'FAIL'; report.error = error.message;
} finally {
  report.originalsUnchanged = originals.every(({ asset, bytes }) => readFileSync(resolve(inputDirectory, asset.file)).equals(bytes))
    && readFileSync(resolve(inputDirectory, 'source/generate-selected.py')).equals(sourceScript);
  if (!report.originalsUnchanged) report.result = 'FAIL';
  save();
}
console.log(`Alpine authoring reproduction ${report.result}; report: ${resolve(destination, 'authoring-reproduction-report.json')}`);
process.exitCode = report.result === 'PASS' ? 0 : 1;
