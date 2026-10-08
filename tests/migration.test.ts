import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { Vec3 } from 'playcanvas';
import { DRIVERS, raceOrder, DEFAULT_DRIVER_ID } from '../src/driver-roster.js';
import { CoastCircuit, ORIGINAL_TRACK_POINTS, HALF, MAX_SPEED } from '../src/track.ts';

const read = (name: string) => readFileSync(new URL('../' + name, import.meta.url));
const json = (name: string) => JSON.parse(read(name).toString());
const sha = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const ids = ['whale', 'gemini', 'gpt', 'claude', 'grok', 'glm'];
const allFiles = (dir: string): string[] => readdirSync(new URL('../' + dir, import.meta.url)).flatMap(name => {
  const path = join(dir, name);
  return statSync(new URL('../' + path, import.meta.url)).isDirectory() ? allFiles(path) : [path];
});
function glbDocument(bytes: Buffer, name: string) {
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF', name);
  assert.equal(bytes.readUInt32LE(4), 2, name);
  assert.equal(bytes.readUInt32LE(8), bytes.length, name);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, name);
  return JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)).trim());
}
function samePoint(a: Vec3, b: number[], tolerance = 1e-8) {
  assert.ok(a.clone().sub(new Vec3(...b)).length() < tolerance, `${a.toString()} differs from ${b}`);
}

test('PlayCanvas is the installed rendering engine; runtime source has no Three.js dependency', () => {
  const pkg = json('package.json');
  assert.equal(pkg.dependencies.playcanvas, '2.23.1');
  assert.equal(pkg.dependencies.three, undefined);
  assert.equal(pkg.license, 'AGPL-3.0-only');
  for (const file of allFiles('src').filter(name => /\.[cm]?[jt]sx?$/.test(name))) {
    assert.doesNotMatch(read(file).toString(), /(?:from\s*|import\s*\(|require\s*\()\s*['"]three(?:\/|['"])/, file);
  }
});

test('all six stable selections retain exact IDs, paint colors, labels and selected-first race order', () => {
  assert.deepEqual(DRIVERS.map(driver => driver.id), ids);
  assert.deepEqual(DRIVERS.map(driver => driver.label), ids.map(id => id.toUpperCase()));
  assert.deepEqual(DRIVERS.map(driver => driver.color), ['#77dcea', '#a5a4ff', '#f4e4c8', '#eeac8e', '#b89bdb', '#9cddad']);
  assert.equal(DEFAULT_DRIVER_ID, 'whale');
  for (const id of ids) {
    const order = raceOrder(id);
    assert.equal(order[0].id, id);
    assert.deepEqual(order.slice(1).map(driver => driver.id), ids.filter(other => other !== id));
  }
});

test('historical migration circuit remains independently reproducible from unchanged original fixtures', () => {
  // The requested new level-0 layout has its own invariant/geometry tests.
  // This historical baseline must never be silently rewritten to match it.
  const circuit = new CoastCircuit(ORIGINAL_TRACK_POINTS, {legacySeamTangent: true});
  const LENGTH = circuit.length, sample = (distance: number, lateral = 0) => circuit.sample(distance, lateral);
  const original = json('tests/helpers/original-track.json');
  assert.equal(circuit.arcs.length, 1801);
  assert.ok(Math.abs(LENGTH - original.length) < 1e-8);
  assert.equal(HALF, 7.2);
  assert.equal(MAX_SPEED, 42);
  for (const fixture of original.samples) {
    const s = sample(fixture.u * LENGTH);
    samePoint(s.p, fixture.p);
    samePoint(s.t, fixture.t);
    const left = sample(fixture.u * LENGTH, 4.2).p.sub(s.p);
    assert.ok(Math.abs(left.length() - 4.2) < 1e-10);
    assert.ok(Math.abs(left.dot(s.t)) < 1e-10);
    assert.ok(left.dot(s.n) > 0);
    samePoint(sample((fixture.u + 3) * LENGTH).p, fixture.p);
    samePoint(sample((fixture.u - 2) * LENGTH).p, fixture.p);
  }
});

test('all five original runtime assets and two editable Blender sources preserve reviewed byte identities', () => {
  const expected: Record<string, string> = {
    'public/assets/arch.glb': '02d5846dff35d97535b979348a255aaaf7d38b0e1b971ca6a0428b4807d496ae',
    'public/assets/kart.glb': 'ba1b4f018004eeabf860922ad570c338c281a671c9af56cdc839592df7ae59a0',
    'public/assets/palm.glb': 'bce1b487f8f7e821bf361c4e4c0ae60dd0ed03eb16f783e85c74db7bf8c52b03',
    'public/assets/rock.glb': '751119ac92b808fd4cf99cd4f639d2e17db832306a7fc8e59e1e61adcc9beb11',
    'public/assets/kart-r12-chassis.glb': '2eadfef0873bb96f62c5047d321bc3f1805a2b22a236b726684d5e17d9e42086',
    'models/kart.blend': '745f413157d2479233bdf3c9e51ce14cea47da2f1b23f0238d0f48f619817e8a',
    'models/props.blend': '9b0c0d933919d18abdf27d7ce75a2eb1fc12a007d9a7ff79529f3ced8f8e4a9d',
  };
  for (const [path, hash] of Object.entries(expected)) assert.equal(sha(read(path)), hash, path);
  const chassis = glbDocument(read('public/assets/kart-r12-chassis.glb'), 'chassis');
  assert.ok(chassis.nodes.some(node => node.name === 'SteeringPivot'));
  assert.equal(chassis.skins?.length || 0, 0);
  assert.equal(chassis.animations?.length || 0, 0);
});

test('six published gzip models preserve compressed and decoded identities, clips, skins and embedded resources', () => {
  const manifest = json('docs/runtime-models.json');
  const authorized = json('tests/helpers/authorized-runtime.json');
  assert.deepEqual(manifest.assets, authorized.assets);
  assert.deepEqual(manifest.assets.map(record => record.id), ids);
  assert.deepEqual(allFiles('public/assets/drivers').sort(), ids.map(id => `public/assets/drivers/${id}-driver.glb.gz`).sort());
  const meshCounts = [1, 3, 1, 4, 2, 3], vertices = [154062, 158314, 150285, 97079, 152817, 189564];
  for (const [index, record] of manifest.assets.entries()) {
    const archive = read('public/' + record.path);
    assert.equal(archive.length, record.bytes, record.id);
    assert.equal(sha(archive), record.sha256, record.id);
    assert.equal(archive[3], 0, 'Gzip must not carry optional/private metadata');
    assert.equal(archive.readUInt32LE(4), 0, 'Gzip timestamps must stay deterministic');
    const decoded = gunzipSync(archive, { maxOutputLength: 32 * 1024 * 1024 });
    assert.equal(decoded.length, record.decodedBytes, record.id);
    assert.equal(sha(decoded), record.decodedSha256, record.id);
    const gltf = glbDocument(decoded, record.id);
    for (const resource of [...(gltf.buffers || []), ...(gltf.images || [])]) {
      assert.ok(!resource.uri || resource.uri.startsWith('data:'), `${record.id} external resource`);
    }
    for (const clip of ['DriveIdle', 'SteerLeft', 'SteerRight', 'SteeringDemo', 'SteeringRange']) {
      assert.ok(gltf.animations.some(animation => animation.name === clip), `${record.id}: ${clip}`);
    }
    for (const side of ['L', 'R']) assert.ok(gltf.nodes.some(node => ['Grip' + side, 'Grip.' + side].includes(node.name)));
    const meshes = gltf.nodes.filter(node => node.skin !== undefined).flatMap(node => gltf.meshes[node.mesh].primitives);
    assert.equal(meshes.length, meshCounts[index], record.id);
    assert.equal(meshes.reduce((total, mesh) => total + gltf.accessors[mesh.attributes.POSITION].count, 0), vertices[index]);
    for (const mesh of meshes) for (const semantic of ['JOINTS_0', 'WEIGHTS_0']) {
      assert.equal(gltf.accessors[mesh.attributes[semantic]].type, 'VEC4');
    }
    const stack = [gltf];
    while (stack.length) {
      const value = stack.pop();
      if (!value || typeof value !== 'object') continue;
      if (value.extras) for (const key of ['source_library_id', 'source_blend', 'centerline_file']) assert.ok(!(key in value.extras));
      stack.push(...Object.values(value).filter(child => child && typeof child === 'object'));
    }
  }
});

test('source UI retains accessible selection, loading, local replacement, HUD and mobile controls', () => {
  const html = read('coast.html').toString()+read('src/race-hud.ts').toString();
  for (const id of [...ids.map(id => 'slot-' + id), 'game', 'map', 'loadingSection', 'loadingProgress', 'loadingBytes', 'loadingDetails', 'retryLoading', 'start', 'driverFiles', 'importButton', 'clearDriver', 'pause', 'camera', 'sound', 'rank', 'lap', 'timer', 'speed', 'charge', 'item', 'itemName', 'lookHint']) {
    assert.equal([...html.matchAll(new RegExp('id="' + id + '"', 'g'))].length, 1, id);
  }
  assert.ok(html.indexOf('id="loadingSection"') < html.indexOf('class="driver-picker"'));
  assert.match(html, /<progress id="loadingProgress"[^>]*aria-labelledby="loadingProgressLabel"/);
  assert.match(html, /id="loading" role="status" aria-live="polite"/);
  const picker = html.match(/<input[^>]*id="driverFiles"[^>]*>/)?.[0] || '';
  assert.match(picker, /type="file"/);
  assert.match(picker, /accept="[^"]*\.glb/);
  assert.match(picker, /\bmultiple\b/);
  for (const code of ['KeyW', 'KeyS', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft']) assert.match(html, new RegExp('data-key="' + code + '"'));
});

test('license boundaries and six documentation languages remain explicit', () => {
  assert.match(read('LICENSE').toString(), /GNU AFFERO GENERAL PUBLIC LICENSE/);
  const notice = read('MODEL-NOTICE.txt').toString();
  assert.match(notice, /non.commercial/i);
  assert.match(notice, /AGPL/);
  assert.match(notice, /not.*grant|does not grant/i);
  for (const name of ['README.md', 'README.zh-CN.md', 'README.zh-TW.md', 'README.yue.md', 'README.ja.md', 'README.ko.md']) {
    const text = read(name).toString();
    assert.match(text, /PlayCanvas/i, name);
    assert.match(text, /MODEL-NOTICE/, name);
    assert.match(text, /AGPL/, name);
  }
});


test('coast return navigation has native destinations even before WebGL bootstrap',()=>{
  const html=read('coast.html').toString(),source=read('src/game.ts').toString();
  for(const [id,expected] of [['raceMainMenu','index.html'],['raceChangeMap','index.html?screen=maps&map=coast'],['raceChangeCharacter','index.html?screen=characters&map=coast']]){
    const link=html.match(new RegExp('<a\\b[^>]*id="'+id+'"[^>]*>'))?.[0];
    assert.ok(link,`${id} must be a native anchor, not a script-dependent button`);
    const href=link.match(/href="([^"]+)"/)?.[1].replaceAll('&amp;','&');
    assert.equal(href,expected);
  }
  assert.ok(source.indexOf('updateRaceLinks(getDriver(')<source.indexOf('app = new pc.Application('),'query selection updates links before WebGL can fail');
});
