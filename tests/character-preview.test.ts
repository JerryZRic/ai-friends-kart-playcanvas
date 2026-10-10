import test from 'node:test';
import {characterPreviewDragDegrees} from '../src/character-preview';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseLocalGLB, disposeDriverAsset, type DriverAsset } from '../src/assets';
import { PORTRAIT_MODELS, createPreviewBufferCache, loadCharacterPreviewBuffer, createCharacterPreviewModel, createCharacterPreviewSession, characterPreviewCamera, type CharacterPreviewModel } from '../src/character-preview';

/** Original standing mesh ownership and bounds checks. Image decoding uses a 1px
 * texture on NullGraphicsDevice; these checks make no browser-rendering claim. */
function headlessApp() {
  const canvas = {id: 'preview-test', width: 1, height: 1, addEventListener() {}, removeEventListener() {}, getBoundingClientRect() { return {left: 0, top: 0, width: 1, height: 1}; }} as any;
  const device = new pc.NullGraphicsDevice(canvas), app = new pc.AppBase(canvas), options = new pc.AppOptions();
  options.graphicsDevice = device; options.componentSystems = [pc.RenderComponentSystem, pc.AnimComponentSystem];
  options.resourceHandlers = [pc.ContainerHandler, pc.RenderHandler, pc.MaterialHandler, pc.TextureHandler]; options.devtools = false; app.init(options);
  app.assets.on('add', (asset: pc.Asset) => {
    if (asset.type === 'container') (asset.options as any).image = {processAsync(_image: unknown, done: Function) {
      const texture = new pc.Asset('preview-test-texture', 'texture'); texture.resource = new pc.Texture(device, {width: 1, height: 1}); texture.loaded = true; app.assets.add(texture); done(null, texture);
    }};
  });
  return app;
}
function bytes(path: string, gzip = false) {
  const data = gzip ? gunzipSync(readFileSync(path)) : readFileSync(path);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: unknown) => void; const promise = new Promise<T>((a, b) => {resolve = a; reject = b;}); return {promise, resolve, reject}; }
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('preview CPU cache enforces LRU entry and byte bounds, including oversize replacements', () => {
  const cache = createPreviewBufferCache(2, 10);
  cache.set('a', new ArrayBuffer(4)); cache.set('b', new ArrayBuffer(4));
  assert.ok(cache.get('a')); cache.set('c', new ArrayBuffer(4)); assert.equal(cache.get('b'), undefined); assert.equal(cache.bytes, 8);
  cache.set('d', new ArrayBuffer(7)); assert.equal(cache.size, 1); assert.equal(cache.bytes, 7);
  cache.set('d', new ArrayBuffer(11)); assert.equal(cache.size, 0); assert.equal(cache.bytes, 0);
  cache.set('e', new ArrayBuffer(1)); cache.clear(); assert.equal(cache.size, 0);
});

test('preview downloads only the selected manifest entry, verifies it and reuses bytes', async () => {
  const cache = createPreviewBufferCache(), requests: string[] = [], signal = new AbortController().signal;
  const load = async (path: string) => {requests.push(path); return bytes(`public/${path}`);};
  const first = await loadCharacterPreviewBuffer('whale', signal, () => {}, cache, load);
  assert.equal(first.byteLength, PORTRAIT_MODELS[0].decodedBytes);
  assert.equal(await loadCharacterPreviewBuffer('whale', signal, () => {}, cache, load), first);
  assert.deepEqual(requests, [PORTRAIT_MODELS[0].path]);
  await assert.rejects(loadCharacterPreviewBuffer('unknown', signal, () => {}, cache, load));
  const stopped = new AbortController(); stopped.abort();
  await assert.rejects(loadCharacterPreviewBuffer('gemini', stopped.signal, () => {}, cache, load), {name: 'AbortError'});
  assert.equal(requests.length, 1);
});

test('all six original standing portraits preserve authored geometry, transforms and fitting cameras without driving rigs', async () => {
  const app = headlessApp();
  try {
    for (const record of PORTRAIT_MODELS) {
      const asset = await parseLocalGLB(app, bytes(`public/${record.path}`, true));
      const authored = asset.resource.instantiateRenderEntity();
      const transform = [...authored.getLocalTransform().data];
      const authoredMeshes = (authored.findComponents('render') as pc.RenderComponent[]).flatMap(component => component.meshInstances);
      const materials = authoredMeshes.map(mesh => mesh.material as pc.StandardMaterial);
      const materialState = () => materials.map(material => ({
        diffuse: material.diffuse.toArray(), emissive: material.emissive.toArray(),
        emissiveIntensity: material.emissiveIntensity, opacity: material.opacity,
        blendType: material.blendType, useLighting: material.useLighting,
        diffuseMap: material.diffuseMap, emissiveMap: material.emissiveMap,
      }));
      const originalMaterials = materialState(); authored.destroy();
      const a = createCharacterPreviewModel(app, asset), b = createCharacterPreviewModel(app, asset);
      assert.deepEqual([...a.model.getLocalTransform().data], transform, `${record.id}: authored root preserved`);
      const meshes = (a.model.findComponents('render') as pc.RenderComponent[]).flatMap(component => component.meshInstances);
      const other = (b.model.findComponents('render') as pc.RenderComponent[]).flatMap(component => component.meshInstances);
      assert.ok(meshes.length > 0); assert.equal(meshes.length, other.length);
      assert.deepEqual(meshes.map(mesh => mesh.material), materials, 'portrait borrows unchanged authored materials');
      assert.deepEqual(materialState(), originalMaterials, 'preview adds no tint, emissive boost, gamma override or alpha change');
      assert.notEqual(meshes[0], other[0], 'each portrait owns independent mesh instances');
      assert.equal(meshes.every(mesh => !mesh.skinInstance), true, 'standing originals have no driving rig');
      assert.equal(a.model.anim, undefined); assert.equal(a.animated, false);
      assert.equal(asset.animations.length, 0);
      assert.ok(a.bounds.halfExtents.y > .1 && a.bounds.halfExtents.y < 4, `${record.id}: reasonable posed height`);
      assert.equal(a.bounds.getMin().y, 0, `${record.id}: placed on ground`);
      assert.equal(a.bounds.center.x, 0); assert.equal(a.bounds.center.z, 0);
      for (const aspect of [.42, .75, 1, 1.9]) {
        const camera = characterPreviewCamera(a.bounds, aspect);
        const angle = Math.asin(camera.radius / camera.distance);
        const vertical = camera.fov * Math.PI / 360, horizontal = Math.atan(Math.tan(vertical) * aspect);
        assert.ok(angle < Math.min(vertical, horizontal), `${record.id} sphere fits aspect ${aspect}`);
        assert.ok(camera.nearClip < camera.distance - camera.radius);
        assert.ok(camera.farClip > camera.distance + camera.radius);
      }
      const originalAngle = b.angle; a.rotate(94); a.update(.1);
      assert.equal(a.angle, 94); assert.equal(b.angle, originalAngle);
      a.destroy(); a.destroy(); b.update(.1); b.destroy(); disposeDriverAsset(asset);
      assert.equal(app.root.children.length, 0, `${record.id}: no scene leak`);
      assert.equal(app.assets.list().length, 0, `${record.id}: container and texture resources released`);
    }
  } finally { app.destroy(); }
});

test('latest selection aborts downloads, ignores late results and disposes pending parser results', async () => {
  const loads = new Map<string, ReturnType<typeof deferred<ArrayBuffer>>>(), signals: AbortSignal[] = [], states: string[] = [], disposed: DriverAsset[] = [], built: string[] = [];
  const parsed = deferred<DriverAsset>(); let parseCalls = 0;
  const fakeAsset = (name: string) => ({metadata: {name}} as DriverAsset);
  const model = (name: string) => ({destroy() {built.push(`destroy:${name}`);}} as CharacterPreviewModel);
  const session = createCharacterPreviewSession({} as pc.AppBase, {
    load: async (id, signal) => {signals.push(signal); const job = deferred<ArrayBuffer>(); loads.set(id, job); return job.promise;},
    parse: async () => {parseCalls++; return parsed.promise;},
    createModel: (_app, asset) => {built.push(asset.metadata.name); return model(asset.metadata.name);},
    disposeAsset: asset => disposed.push(asset), onState: state => states.push(`${state.driver}:${state.stage}`),
  });
  const a = session.select('whale'), b = session.select('gpt');
  assert.equal(signals[0].aborted, true);
  loads.get('whale')!.resolve(new ArrayBuffer(1)); assert.equal(await a, false); assert.equal(parseCalls, 0);
  loads.get('gpt')!.resolve(new ArrayBuffer(1)); await tick(); assert.equal(parseCalls, 1);
  const disposing = session.dispose(); assert.equal(signals[1].aborted, true);
  const late = fakeAsset('gpt'); parsed.resolve(late); await disposing;
  assert.equal(await b, false); assert.deepEqual(disposed, [late]); assert.deepEqual(built, []);
  assert.equal(states.includes('gpt:ready'), false); assert.equal(await session.select('claude'), false);
  await session.dispose(); assert.equal(disposed.length, 1);
});

test('failed preview can retry and repeated selections release model before its borrowed asset', async () => {
  const events: string[] = []; let attempt = 0;
  const session = createCharacterPreviewSession({} as pc.AppBase, {
    load: async () => {if (++attempt === 1) throw new Error('network'); return new ArrayBuffer(1);},
    parse: async () => ({metadata: {name: `asset${attempt}`}} as DriverAsset),
    createModel: (_app, asset) => ({destroy() {events.push(`model:${asset.metadata.name}`);}} as CharacterPreviewModel),
    disposeAsset: asset => events.push(`asset:${asset.metadata.name}`), onState: state => events.push(state.stage),
  });
  assert.equal(await session.select('whale'), false); assert.ok(events.includes('failed'));
  assert.equal(await session.retry(), true); assert.ok(session.model);
  assert.equal(await session.select('glm'), true);
  assert.ok(events.indexOf('model:asset2') < events.indexOf('asset:asset2'));
  await session.dispose(); assert.ok(events.indexOf('model:asset3') < events.indexOf('asset:asset3'));
  assert.equal(session.model, null);
});

test('a newer selection waits for the old parser, then discards its model without stale status', async () => {
  const firstParse = deferred<DriverAsset>();
  const order: string[] = [], states: string[] = [];
  let parsing = 0, peak = 0, count = 0;
  const session = createCharacterPreviewSession({} as pc.AppBase, {
    load: async () => new ArrayBuffer(1),
    parse: async () => {
      const index = ++count; parsing++; peak = Math.max(peak, parsing); order.push(`parse:${index}`);
      const asset = index === 1 ? await firstParse.promise : {metadata: {name: 'gpt'}} as DriverAsset;
      parsing--; return asset;
    },
    createModel: (_app, asset) => {order.push(`build:${asset.metadata.name}`); return {destroy() {order.push(`model:${asset.metadata.name}`);}} as CharacterPreviewModel;},
    disposeAsset: asset => order.push(`asset:${asset.metadata.name}`), onState: state => states.push(`${state.driver}:${state.stage}`),
  });
  const first = session.select('whale'); await tick();
  const second = session.select('gpt'); await tick();
  assert.equal(count, 1, 'no parallel GPU parser for superseded character');
  firstParse.resolve({metadata: {name: 'whale'}} as DriverAsset);
  assert.equal(await first, false); assert.equal(await second, true);
  assert.equal(peak, 1); assert.equal(order.includes('build:whale'), false); assert.ok(order.includes('asset:whale'));
  assert.equal(states.includes('whale:ready'), false); assert.equal(states.at(-1), 'gpt:ready');
  await session.dispose(); assert.equal(order.at(-2), 'model:gpt'); assert.equal(order.at(-1), 'asset:gpt');
});

test('portrait drag uses logical pixels across proportional viewport sizes', () => {
  for (const scale of [320/1440,390/1440,390/900,.8,1,1.2,2]) {
    assert.ok(Math.abs(characterPreviewDragDegrees(60*scale,700*scale,700)-30)<1e-10);
    assert.ok(Math.abs(characterPreviewDragDegrees(-80*scale,700*scale,700)+40)<1e-10);
  }
  for(const invalid of [0,-1,NaN,Infinity]) assert.equal(characterPreviewDragDegrees(20,invalid,700),10);
});
