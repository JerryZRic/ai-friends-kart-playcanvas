import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url));
const json = (path: string) => JSON.parse(read(path).toString());
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const ids = ['whale', 'gemini', 'gpt', 'claude', 'grok', 'glm'];

test('six standing portraits retain final verified identities, self-contained geometry and no driving rig', () => {
  const manifest = json('docs/portrait-models.json'), fixture = json('tests/helpers/authorized-portraits.json');
  const drivers = json('docs/runtime-models.json');
  assert.equal(manifest.schemaVersion, 1); assert.deepEqual(manifest.assets, fixture.assets);
  assert.deepEqual(manifest.assets.map(record => record.id), ids);
  assert.deepEqual(readdirSync(new URL('../public/assets/portraits/', import.meta.url)).sort(), ids.map(id => `${id}-portrait.glb.gz`).sort());
  for (const record of manifest.assets) {
    assert.equal(record.path, `assets/portraits/${record.id}-portrait.glb.gz`);
    const compressed = read('public/' + record.path), decoded = gunzipSync(compressed, {maxOutputLength: 32 * 1024 * 1024});
    assert.equal(compressed.length, record.bytes); assert.equal(sha(compressed), record.sha256);
    assert.equal(compressed[3], 0, 'Gzip has no optional names/comments'); assert.equal(compressed.readUInt32LE(4), 0, 'Gzip has no source timestamp');
    assert.equal(decoded.length, record.decodedBytes); assert.equal(sha(decoded), record.decodedSha256);
    assert.notEqual(record.decodedSha256, drivers.assets.find(driver => driver.id === record.id).decodedSha256, 'Portrait is a separate standing model');
    assert.equal(decoded.toString('ascii', 0, 4), 'glTF'); assert.equal(decoded.readUInt32LE(4), 2);
    assert.equal(decoded.readUInt32LE(8), decoded.length); assert.equal(decoded.readUInt32LE(16), 0x4e4f534a);
    const gltf = JSON.parse(decoded.toString('utf8', 20, 20 + decoded.readUInt32LE(12)).trim());
    assert.ok(gltf.meshes?.length > 0); assert.ok(gltf.scenes?.length > 0);
    assert.equal(gltf.skins?.length || 0, 0); assert.equal(gltf.animations?.length || 0, 0);
    for (const node of gltf.nodes ?? []) assert.equal(node.skin, undefined, 'No dangling driving-rig skin reference');
    for (const resource of [...(gltf.buffers ?? []), ...(gltf.images ?? [])]) assert.ok(!resource.uri || resource.uri.startsWith('data:'), 'Portrait resources are self-contained');
  }
});

test('portrait licensing, source exclusion and restore instructions are explicit in every documentation language', () => {
  for (const path of ['MODEL-NOTICE.txt', 'SOURCE.txt', 'NOTICE', 'public/source.html']) {
    const text = read(path).toString(); assert.match(text, /portrait/i); assert.match(text, /AGPL/);
  }
  const notice = read('MODEL-NOTICE.txt').toString();
  assert.match(notice, /non.commercial/i); assert.match(notice, /does not grant/); assert.match(notice, /not.*AGPL|not treat.*AGPL/i);
  for (const path of ['README.md', 'README.zh-CN.md', 'README.zh-TW.md', 'README.yue.md', 'README.ja.md', 'README.ko.md']) {
    const text = read(path).toString();
    assert.match(text, /public\/assets\/portraits\//, path); assert.match(text, /docs\/portrait-models\.json/, path);
    assert.match(text, /\/dev\//, path); assert.match(text, /MODEL-NOTICE/, path);
  }
  const packager = read('scripts/package-source.mjs').toString();
  assert.match(packager, /path === 'public\/assets\/drivers' \|\| path === 'public\/assets\/portraits'/);
});
