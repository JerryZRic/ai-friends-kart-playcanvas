import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createKartAssemblyLoader, kartAssemblyCamera} from '../src/kart-assembly';
import {catalog, defaultBuild, KART_SLOTS, type KartBuild} from '../src/kart-build';
import {filterGarageParts, garageRaceEntry} from '../src/kart-garage';
import {parseLocalGLB, type DriverAsset, disposeDriverAsset} from '../src/assets';
import {foodKartManifest as manifest, foodKartFixtureBytes} from './helpers/food-kart-fixture';

function app() {
  const canvas = {id: 'garage-test', width: 1, height: 1, addEventListener() {}, removeEventListener() {}, getBoundingClientRect() {return {left: 0, top: 0, width: 1, height: 1};}} as any;
  const device = new pc.NullGraphicsDevice(canvas), app = new pc.AppBase(canvas), options = new pc.AppOptions();
  options.graphicsDevice = device; options.componentSystems = [pc.RenderComponentSystem]; options.resourceHandlers = [pc.ContainerHandler, pc.RenderHandler, pc.MaterialHandler, pc.TextureHandler]; options.devtools = false; app.init(options);
  app.assets.on('add', (asset: pc.Asset) => {if (asset.type === 'container') (asset.options as any).image = {processAsync(_image: unknown, done: Function) {const texture = new pc.Asset('garage-test-texture', 'texture'); texture.resource = new pc.Texture(device, {width: 1, height: 1}); texture.loaded = true; app.assets.add(texture); done(null, texture);}};});
  return app;
}
function buffer(id: string) {
  const part = manifest.parts.find((part: any) => part.id === id)!;
  return foodKartFixtureBytes(part);
}
function kit(number: string): KartBuild {return Object.fromEntries(KART_SLOTS.map(slot => [slot, catalog.find(part => part.kitNumber === Number(number) && part.slot === slot)!.id])) as KartBuild;}
function deferred<T>() {let resolve!: (value: T) => void; const promise = new Promise<T>(done => resolve = done); return {promise, resolve};}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('garage filters exact IDs across six 54-part slots and passes a valid selected build to the race', () => {
  for (const slot of KART_SLOTS) {
    assert.equal(filterGarageParts(slot, '', '').length, 54);
    const part = catalog.find(part => part.slot === slot)!;
    assert.deepEqual(filterGarageParts(slot, part.themeId, ''), [part]);
    assert.deepEqual(filterGarageParts(slot, '', part.id.toUpperCase()), [part]);
    assert.ok(filterGarageParts(slot, '', part.themeName).some(value => value.id === part.id));
  }
  assert.deepEqual(filterGarageParts('body', '', '<script>'), []);
  const url = new URL(garageRaceEntry('glm', defaultBuild), 'https://example.com/dev/');
  assert.equal(url.pathname, '/dev/coast.html'); assert.equal(url.searchParams.get('driver'), 'glm');
  assert.deepEqual(JSON.parse(url.searchParams.get('kart')!), defaultBuild);
  assert.equal(new URL(garageRaceEntry('hostile', defaultBuild), 'https://example.com').searchParams.get('driver'), 'whale');
});

test('all 324 selection thumbnails derive from actual source modules and no placeholder masquerades as a preview', () => {
  const indexBytes = readFileSync('public/models/food-karts/thumbnails.json');
  const index = JSON.parse(indexBytes.toString('utf8'));
  const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
  assert.equal(index.schemaVersion, 1);
  assert.equal(manifest.thumbnailIndex.path, 'models/food-karts/thumbnails.json');
  assert.equal(indexBytes.length, manifest.thumbnailIndex.bytes);
  assert.equal(sha256(indexBytes), manifest.thumbnailIndex.sha256);
  assert.deepEqual(Object.keys(index.images).sort(), catalog.map(part => part.id).sort());
  const originalThumbnails: [string, string][] = [];
  for (const part of catalog) {
    const uri = index.images[part.id];
    assert.match(uri, /^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/, part.id);
    const encoded = uri.slice('data:image/webp;base64,'.length), bytes = Buffer.from(encoded, 'base64');
    assert.equal(bytes.toString('base64'), encoded, `${part.id} has canonical complete base64`);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.readUInt32LE(4) + 8, bytes.length, `${part.id} is a complete WebP`);
    assert.equal(bytes.toString('ascii', 8, 16), 'WEBPVP8 ');
    assert.deepEqual([...bytes.subarray(23, 26)], [0x9d, 0x01, 0x2a], 'VP8 key-frame signature');
    assert.equal(bytes.readUInt16LE(26) & 0x3fff, 369, `${part.id} preserves source width`);
    assert.equal(bytes.readUInt16LE(28) & 0x3fff, 300, `${part.id} preserves source height`);
    originalThumbnails.push([part.id, sha256(bytes)]);
  }
  // Captured from all original public WebPs before lossless JSON bundling.
  originalThumbnails.sort(([a], [b]) => a.localeCompare(b));
  assert.equal(sha256(JSON.stringify(originalThumbnails)), '93b216610afed08d680078a9baa8354cab4bc22e3edf80f95dc25be5ee544975');
  const source = readFileSync('src/kart-garage.ts', 'utf8');
  assert.match(source, /不会用占位模型替代缺失零件/); assert.match(source, /原始模型模块图/);
  assert.match(source, /当前试玩：重量、动力、极速、操控已参与海岸竞速/);
  assert.match(source, /设计极速/); assert.match(source, /设计起步/);
  assert.match(source, /比赛平路上限/); assert.match(source, /raceTuning\.maxSpeed \* 3\.6/);
  assert.match(source, /kartTuning\(driver\.id, 'coast'/); assert.match(source, /翻车恢复暂未启用/);
  assert.match(source, /pagehide/); assert.match(source, /pageshow/); assert.match(source, /webglcontextlost/);
  assert.match(source, /preview-zoom-in/); assert.match(source, /preview-zoom-out/);
});

test('real six-part imports keep original module transforms, instantiate independently and release resources', async () => {
  const application = app(), progress: any[] = [], requests: string[] = [];
  const loader = createKartAssemblyLoader(application, {maxUnusedParts: 0, loadPayload: async (id, {onProgress}) => {requests.push(id); const result = buffer(id); onProgress?.({stage: 'download', receivedBytes: result.byteLength, totalBytes: result.byteLength, cachedBytes: 0}); return result;}});
  try {
    const build = kit('050'), assembly = await loader.load(build, {onProgress: value => progress.push(value)});
    application.root.addChild(assembly.root);
    assert.equal(assembly.root.children.length, 6); assert.equal(loader.liveInstances, 1); assert.equal(loader.cachedParts, 6);
    assert.deepEqual(requests, KART_SLOTS.map(slot => build[slot]));
    for (const slot of KART_SLOTS) {
      assert.deepEqual(assembly.parts[slot].getLocalPosition().toArray(), [0, 0, 0]);
      assert.deepEqual(assembly.parts[slot].getLocalScale().toArray(), [1, 1, 1]);
    }
    assert.ok(assembly.bounds.halfExtents.x > .9 && assembly.bounds.halfExtents.z > 1.3);
    const other = loader.instantiate(build); application.root.addChild(other.root);
    assert.notEqual(other.parts.body, assembly.parts.body); assert.equal(requests.length, 6);
    assert.equal(progress.at(-1).stage, 'ready'); assert.equal(progress.at(-1).completed, 6);
    assert.ok(progress.at(-1).receivedBytes > 0); assert.equal(progress.at(-1).receivedBytes, progress.at(-1).totalBytes);
    assert.ok(loader.textureStats().textures > 0); assert.ok(loader.textureStats().containers === 6);
    assembly.dispose(); assert.equal(loader.liveInstances, 1); assert.equal(loader.cachedParts, 6);
    other.dispose(); other.dispose(); assert.equal(loader.cachedParts, 0); assert.equal(loader.textureStats().textures, 0);
    assert.equal(application.assets.list().length, 0); assert.equal(application.root.children.length, 0);
  } finally {await loader.dispose(); application.destroy();}
});

test('failed module does not report success or create a partial kart', async () => {
  const application = app(), stages: string[] = []; let count = 0;
  const loader = createKartAssemblyLoader(application, {maxUnusedParts: 0, loadPayload: async id => {if (++count === 3) throw new Error('missing authentic module'); return buffer(id);}});
  try {
    await assert.rejects(loader.load(kit('050'), {onProgress: p => stages.push(p.stage)}), /missing authentic module/);
    assert.equal(stages.includes('ready'), false); assert.equal(loader.liveInstances, 0); assert.equal(loader.cachedParts, 0); assert.equal(application.assets.list().length, 0);
    await assert.rejects(loader.load({...defaultBuild, body: defaultBuild.wheels}), /six valid part IDs/);
  } finally {await loader.dispose(); application.destroy();}
});

test('aborted parsing is released before loader/app destruction and retry uses a new request', async () => {
  const application = app(), parsed = deferred<DriverAsset>(), started = deferred<void>(), released: DriverAsset[] = [];
  let first = true;
  const loader = createKartAssemblyLoader(application, {maxUnusedParts: 0, loadPayload: async id => buffer(id), parse: async (bytes, filename) => {if (first) {first = false; started.resolve(); return parsed.promise;} return parseLocalGLB(application, bytes, filename);}, releaseAsset: asset => {released.push(asset); disposeDriverAsset(asset);}});
  try {
    const controller = new AbortController(); const loading = loader.load(kit('050'), {signal: controller.signal});
    const failed = assert.rejects(loading, {name: 'AbortError'}); await started.promise;
    controller.abort(); const asset = await parseLocalGLB(application, buffer(kit('050').body)); parsed.resolve(asset); await failed;
    assert.ok(released.includes(asset)); assert.equal(loader.liveInstances, 0); assert.equal(application.assets.list().length, 0);
    const instance = await loader.load(kit('050')); assert.equal(instance.root.children.length, 6); instance.dispose();
    await loader.dispose(); await assert.rejects(loader.load(defaultBuild), /disposed/); assert.equal(application.assets.list().length, 0);
  } finally {await loader.dispose(); application.destroy();}
});

test('dispose waits for the parser and suppresses late progress/results', async () => {
  const application = app(), parsed = deferred<DriverAsset>(), started = deferred<void>();
  const stages: string[] = [], loader = createKartAssemblyLoader(application, {loadPayload: async id => buffer(id), parse: async () => {started.resolve(); return parsed.promise;}});
  const result = loader.load(kit('050'), {onProgress: p => stages.push(p.stage)}); const fail = assert.rejects(result, {name: 'AbortError'});
  await started.promise; let done = false; const disposed = loader.dispose().then(() => {done = true;}); await tick(); assert.equal(done, false);
  const asset = await parseLocalGLB(application, buffer(kit('050').body)); parsed.resolve(asset); await fail; await disposed;
  assert.equal(done, true); assert.equal(stages.includes('ready'), false); assert.equal(application.assets.list().length, 0); application.destroy();
});

test('camera fits the complete assembly at desktop and phone aspects without per-part recentering', () => {
  const bounds = new pc.BoundingBox(new pc.Vec3(0, .8, 0), new pc.Vec3(1.2, .8, 1.8));
  for (const aspect of [.5, 1, 1.8, 3]) {
    const view = kartAssemblyCamera(bounds, aspect), distance = view.position.distance(view.target), radius = bounds.halfExtents.length();
    const angle = Math.asin(radius / distance), limit = Math.min(view.fov * Math.PI / 360, Math.atan(Math.tan(view.fov * Math.PI / 360) * aspect));
    assert.ok(angle < limit); assert.ok(view.nearClip < distance - radius); assert.ok(view.farClip > distance + radius);
    assert.deepEqual(view.target.toArray(), bounds.center.toArray());
  }
});

test('concurrent racing assemblies pin shared parts through parsing and bounded-cache eviction', async () => {
  const application = app(), loader = createKartAssemblyLoader(application, {maxUnusedParts: 0, loadPayload: async id => buffer(id)});
  try {
    const [a, b, c] = await Promise.all([loader.load(kit('050')), loader.load(kit('050')), loader.load(kit('051'))]);
    assert.equal(loader.liveInstances, 3); assert.equal(loader.cachedParts, 12);
    assert.notEqual(a.parts.body, b.parts.body); assert.deepEqual(a.build, b.build);
    a.dispose(); assert.equal(loader.cachedParts, 12); b.dispose(); assert.equal(loader.cachedParts, 6); c.dispose();
    assert.equal(loader.cachedParts, 0); assert.equal(loader.textureStats().containers, 0); assert.equal(application.assets.list().length, 0);
  } finally {await loader.dispose(); application.destroy();}
});
