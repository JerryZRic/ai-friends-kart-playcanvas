import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ALPINE_PROPS, getAlpineProp } from '../src/alpine-props';
import { convertAlpineProps, serializeAlpineProps, readAlpineGlb, ALPINE_MATERIAL_FAMILIES } from '../scripts/convert-alpine-props.mjs';

const root = new URL('../', import.meta.url);
const source = (file: string) => readFileSync(new URL(`models/alpine-campsite/${file}`, root));
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const manifest: { assets: { id: string; file: string; sha256: string }[] } = JSON.parse(source('selected-manifest.json').toString('utf8'));
const points = (p: typeof ALPINE_PROPS[number]) => p.materials.flatMap(m => Array.from({ length: m.positions.length / 3 }, (_, i) => m.positions.slice(i * 3, i * 3 + 3)));

test('selected exact source hashes and full-detail complexity are reproducible', () => {
  assert.deepEqual(ALPINE_PROPS.map(p => p.kind), ['04_ridge_picnic_table', '12_ranger_relief_map_station']);
  assert.deepEqual(ALPINE_PROPS.map(p => p.source.triangles), [4152, 2000]);
  assert.deepEqual(ALPINE_PROPS.map(p => p.materials.length), [6, 9]);
  assert.equal(ALPINE_PROPS.reduce((sum, p) => sum + p.source.triangles, 0), 6152);
  for (const p of ALPINE_PROPS) {
    const a = manifest.assets.find(a => a.id === p.kind)!;
    assert.equal(digest(source(a.file)), a.sha256);
    assert.equal(p.source.sha256, a.sha256);
    assert.equal(p.source.lod, 0);
    assert.equal(getAlpineProp(p.kind), p);
  }
  const expected = readFileSync(new URL('src/generated/alpine-props.json', root), 'utf8');
  assert.equal(serializeAlpineProps(convertAlpineProps()), expected);
  assert.equal(serializeAlpineProps(convertAlpineProps()), expected, 'repeat conversion differs');
});

test('every source primitive retains original positions, index order, UV0 and material provenance', () => {
  for (const p of ALPINE_PROPS) {
    const parsed = readAlpineGlb(source(p.source.file), p.kind);
    assert.equal(parsed.materials.length, p.materials.length);
    p.materials.forEach((m, i) => {
      assert.deepEqual(m, parsed.materials[i]);
      assert.equal(m.sourcePrimitive, i);
      assert.match(m.sourceNormalsSha256, /^[a-f0-9]{64}$/);
      assert.ok(m.positions.every(Number.isFinite));
      assert.ok(m.uvs.every(Number.isFinite));
      assert.equal(m.positions.length % 3, 0);
      assert.equal(m.uvs.length, m.positions.length / 3 * 2);
      assert.equal(m.indices.length % 3, 0);
      assert.ok(m.indices.every(n => Number.isInteger(n) && n >= 0 && n < m.positions.length / 3));
      assert.equal(m.family, ALPINE_MATERIAL_FAMILIES[m.sourceMaterial as keyof typeof ALPINE_MATERIAL_FAMILIES]);
    });
  }
});

test('all vertices fit complete bounds and projected footprint, including overhangs', () => {
  for (const prop of ALPINE_PROPS) {
    const pp = points(prop), hull = prop.footprint;
    assert.ok(hull.length >= 4 && hull.every(p => p[1] === 0));
    for (let k = 0; k < 3; k++) {
      assert.equal(prop.bounds.min[k], Math.min(...pp.map(p => p[k])));
      assert.equal(prop.bounds.max[k], Math.max(...pp.map(p => p[k])));
    }
    for (const p of pp) for (let i = 0; i < hull.length; i++) {
      const a = hull[i], b = hull[(i + 1) % hull.length];
      assert.ok((b[0] - a[0]) * (p[2] - a[2]) - (b[2] - a[2]) * (p[0] - a[0]) >= -1e-10, `${prop.kind}: incomplete footprint`);
    }
    for (const axis of [0, 2]) {
      assert.equal(Math.min(...hull.map(p => p[axis])), prop.bounds.min[axis]);
      assert.equal(Math.max(...hull.map(p => p[axis])), prop.bounds.max[axis]);
    }
  }
  const table = getAlpineProp('04_ridge_picnic_table');
  assert.ok(table.bounds.max[0] - table.bounds.min[0] > 2.37, 'benches omitted');
  assert.ok(table.bounds.max[2] - table.bounds.min[2] > 2.14, 'bench ends omitted');
  const station = getAlpineProp('12_ranger_relief_map_station');
  assert.ok(station.bounds.max[2] - station.bounds.min[2] > 1.25, 'canopy omitted');
});

test('ground contacts and the separately labeled low support band come from actual source vertices', () => {
  for (const prop of ALPINE_PROPS) {
    const pp = points(prop), set = new Set(pp.map(p => p.join(',')));
    assert.ok(Math.abs(prop.bounds.min[1]) < 1e-6);
    assert.ok(prop.groundContacts.length > 1);
    assert.equal(prop.supportBand.height, .05);
    for (const p of prop.groundContacts) {
      assert.ok(set.has(p.join(',')));
      assert.ok(p[1] <= prop.bounds.min[1] + 1e-6);
    }
    for (const p of prop.supportBand.points) {
      assert.ok(set.has(p.join(',')));
      assert.ok(p[1] <= prop.bounds.min[1] + .05);
    }
    const contactKeys = new Set(prop.groundContacts.map(p => p.join(',')));
    for (const p of pp.filter(p => p[1] <= prop.bounds.min[1] + 1e-6)) assert.ok(contactKeys.has(p.join(',')));
  }
});

test('material remap preserves light/dark and warm/cool families without new materials', () => {
  assert.equal(ALPINE_MATERIAL_FAMILIES.Alpine_cream, 'white');
  assert.equal(ALPINE_MATERIAL_FAMILIES.Alpine_sage, 'pineTips');
  assert.notEqual(ALPINE_MATERIAL_FAMILIES.Alpine_sage, ALPINE_MATERIAL_FAMILIES.Alpine_pine);
  assert.equal(ALPINE_MATERIAL_FAMILIES.Alpine_coral, 'red');
  assert.equal(ALPINE_MATERIAL_FAMILIES.Alpine_water, 'darkStone');
  assert.equal(ALPINE_MATERIAL_FAMILIES.Alpine_brass, 'yellow');
  const allowed = new Set(['wood', 'bark', 'stone', 'darkStone', 'white', 'red', 'yellow', 'pine', 'pineTips']);
  for (const prop of ALPINE_PROPS) for (const m of prop.materials) assert.ok(allowed.has(m.family));
});

test('converter rejects transforms, texture dependencies, and unexpected source identities', () => {
  const p = ALPINE_PROPS[0], bytes = source(p.source.file);
  assert.throws(() => readAlpineGlb(bytes, 'unselected-model'), /identity/);
  const jsonLength = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  function changed(change: (d: any) => void) {
    const d = structuredClone(document); change(d);
    const raw = Buffer.from(JSON.stringify(d));
    const json = Buffer.alloc(Math.ceil(raw.length / 4) * 4, ' '); raw.copy(json);
    const tail = bytes.subarray(20 + jsonLength), out = Buffer.alloc(20 + json.length + tail.length);
    bytes.subarray(0, 20).copy(out); out.writeUInt32LE(out.length, 8); out.writeUInt32LE(json.length, 12);
    json.copy(out, 20); tail.copy(out, 20 + json.length); return out;
  }
  assert.throws(() => readAlpineGlb(changed(d => { d.nodes[0].scale = [2, 2, 2]; }), p.kind), /node scale/);
  assert.throws(() => readAlpineGlb(changed(d => { d.images = [{ uri: 'https://example.invalid/texture.png' }]; }), p.kind), /images/);
  assert.throws(() => readAlpineGlb(changed(d => { d.materials[0].alphaMode = 'BLEND'; }), p.kind), /opaque/);
});
