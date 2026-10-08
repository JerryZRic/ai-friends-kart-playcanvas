import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { sample as sampleCoast, LENGTH as COAST_LENGTH } from '../src/track';
import { sampleWaterparkLoop, WATER_RACE_LENGTH } from '../src/waterpark-design';
import { DEFAULT_SETTINGS } from '../src/game-settings';
import { MENU_FADE_SECONDS, MENU_MAX_FPS, MENU_SCENE_SECONDS, menuBackdropPhase, menuBackdropQuality, menuCameraPose } from '../src/menu-camera';
import { createMenuWorld, mountMenuBackdrop } from '../src/menu-backdrop';

const maps = ['waterpark', 'coast'] as const;

function fixture(inputCanvas?: HTMLCanvasElement) {
  const canvas = inputCanvas ?? {id: 'menu-backdrop-test', width: 1280, height: 720, addEventListener() {}, removeEventListener() {},
    getBoundingClientRect() { return {left: 0, top: 0, width: this.width, height: this.height}; }} as any;
  const app = new pc.AppBase(canvas), options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem, pc.ScriptComponentSystem];
  options.devtools = false; app.init(options);
  return app as pc.Application;
}

test('title scenery changes only at thirty seconds behind a smooth dark curtain', () => {
  assert.equal(MENU_SCENE_SECONDS, 30); assert.equal(MENU_MAX_FPS, 30);
  assert.deepEqual(menuBackdropPhase(0), {map: 'waterpark', localTime: 0, opacity: 1});
  assert.equal(menuBackdropPhase(MENU_FADE_SECONDS).opacity, 0);
  assert.equal(menuBackdropPhase(15).opacity, 0);
  assert.equal(menuBackdropPhase(29).map, 'waterpark');
  assert.ok(menuBackdropPhase(29.999).opacity > .999);
  assert.deepEqual(menuBackdropPhase(30), {map: 'coast', localTime: 0, opacity: 1});
  assert.equal(menuBackdropPhase(31.2).opacity, 0);
  assert.equal(menuBackdropPhase(60).map, 'waterpark');
  for (const time of [0, 15, 30, 600]) {
    assert.deepEqual(menuBackdropPhase(time, true), {map: 'waterpark', localTime: 0, opacity: 0});
    assert.deepEqual(menuBackdropPhase(time, true, {map: 'coast'}), {map: 'coast', localTime: 0, opacity: 0});
    assert.equal(menuBackdropPhase(time, false, {map: 'coast', autoCycle: false}).map, 'coast');
  }
  assert.equal(menuBackdropPhase(31, false, {map: 'coast'}).opacity, 0);
  assert.equal(menuBackdropPhase(31, false, {map: 'coast'}).localTime, 31);
});

test('orbit and dolly remain continuous, above scenery and stable in portrait', () => {
  for (const map of maps) {
    const first = menuCameraPose(map, 0), later = menuCameraPose(map, 20), portrait = menuCameraPose(map, 0, .5);
    assert.notDeepEqual(first.position, later.position);
    assert.ok(portrait.position[1] > first.position[1]);
    for (let time = 0; time < 65; time += .5) {
      const a = menuCameraPose(map, time), b = menuCameraPose(map, time + 1 / 30);
      assert.ok([...a.position, ...a.target].every(Number.isFinite));
      assert.ok(a.position[1] > 25);
      assert.ok(Math.hypot(...a.position.map((v, i) => v - b.position[i])) < .2, 'no camera jumps');
    }
  }
});

test('render quality caps retina pixels, shadows, and extra water captures', () => {
  for (const quality of ['low', 'balanced', 'high'] as const) {
    const q = menuBackdropQuality({...DEFAULT_SETTINGS, quality}, 3840, 2160, 3);
    const limit = quality === 'low' ? 850_000 : quality === 'high' ? 2_000_000 : 1_350_000;
    assert.ok(3840 * 2160 * q.pixelRatio ** 2 <= limit + 1);
    assert.equal(q.shadows, quality !== 'low');
    assert.equal(q.refraction, quality === 'high');
    assert.ok(q.shadowResolution <= 1024);
  }
  assert.equal(menuBackdropQuality({...DEFAULT_SETTINGS, quality: 'high', refraction: false}, 400, 800, 2).refraction, false);
});

test('real PlayCanvas worlds release cameras, reflection layers and GPU textures on repeated switches', () => {
  const app = fixture(), baselineLayers = app.scene.layers.layerList.length;
  const baselineTextures = app.graphicsDevice.textures.size, baselineBuffers = app.graphicsDevice.buffers.size;
  try {
    for (let pass = 0; pass < 3; pass++) for (const map of maps) {
      const world = createMenuWorld(app, map, {...DEFAULT_SETTINGS, quality: pass === 0 ? 'low' : 'balanced'});
      world.update(5, 16 / 9);
      world.camera.getPosition().toArray().forEach((value, axis) => assert.ok(Math.abs(value - menuCameraPose(map, 5).position[axis]) < .0001));
      assert.equal(app.assets.list().length, 0, 'menu must not load GLB assets');
      assert.equal(app.root.findByName('Energy item box'), null);
      assert.equal(app.root.findByName('Drift spark'), null);
      assert.ok(app.root.findByName(map === 'coast' ? 'Circuit ribbon' : 'Turquoise flowing canal'));
      const light = app.root.findByName(map === 'coast' ? 'Warm sunset key light' : 'Waterpark afternoon sun') as pc.Entity;
      assert.equal(light.light!.castShadows, pass !== 0);
      assert.equal(light.light!.numCascades, 1);
      world.destroy(); world.destroy();
      assert.equal(app.root.children.length, 0, 'no orphan cameras or reflection resources');
      assert.equal(app.scene.layers.layerList.length, baselineLayers, 'no accumulation of reflection layers');
      assert.equal(app.graphicsDevice.textures.size, baselineTextures, 'runtime texture ownership is released');
      assert.equal(app.graphicsDevice.buffers.size, baselineBuffers, 'all mesh vertex/index buffers are released');
    }
  } finally { app.destroy(); }
});

test('mount pauses hidden/pagehide work, resizes from its container, and releases all listeners', () => {
  const saved = new Map(['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  class Target extends EventTarget {
    listeners = new Map<string, Set<any>>();
    override addEventListener(type: string, callback: any, options?: any) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type)!.add(callback); super.addEventListener(type, callback, options); }
    override removeEventListener(type: string, callback: any, options?: any) { this.listeners.get(type)?.delete(callback); super.removeEventListener(type, callback, options); }
    listenerCount() { return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0); }
  }
  let width = 1200, height = 700, nextFrame = 0, renders = 0, contextsLost = 0, appDestroyed = false;
  const queued = new Map<number, FrameRequestCallback>();
  const parent = {getBoundingClientRect: () => ({left: 0, top: 0, width, height})};
  const canvas = Object.assign(new Target(), {id: 'menu-lifecycle-test', width, height, dataset: {}, style: {width: '', height: ''}, parentElement: parent,
    getBoundingClientRect() { return {left: 0, top: 0, width: parseFloat(this.style.width) || width, height: parseFloat(this.style.height) || height}; }});
  Object.defineProperties(canvas, {clientWidth: {get: () => parseFloat(canvas.style.width) || width}, clientHeight: {get: () => parseFloat(canvas.style.height) || height}});
  const app = fixture(canvas as any); app.render = () => { renders++; };
  const destroyApp = app.destroy.bind(app); app.destroy = () => { destroyApp(); appDestroyed = true; };
  Object.assign(app.graphicsDevice, {gl: {getExtension: () => ({loseContext: () => { assert.ok(appDestroyed, 'release browser context only after engine teardown'); contextsLost++; }})}});
  const media = Object.assign(new Target(), {matches: false});
  const win = Object.assign(new Target(), {innerWidth: width, innerHeight: height, devicePixelRatio: 2, matchMedia: () => media});
  const doc = Object.assign(new Target(), {hidden: false});
  Object.assign(globalThis, {window: win, document: doc,
    requestAnimationFrame: (callback: FrameRequestCallback) => {queued.set(++nextFrame, callback); return nextFrame;},
    cancelAnimationFrame: (id: number) => {queued.delete(id);}});
  const flush = (time: number) => { const callbacks = [...queued]; queued.clear(); for (const [, callback] of callbacks) callback(time); };
  let dispose: (() => void) | undefined;
  try {
    const baselineCanvasListeners = canvas.listenerCount();
    dispose = mountMenuBackdrop(canvas as any, {style: {opacity: ''}} as any, DEFAULT_SETTINGS, {map: 'coast'}, () => app);
    assert.equal(queued.size, 1, 'only one owned scheduler');
    flush(1000); assert.equal(renders, 1);
    flush(1016); assert.equal(renders, 1, 'skips frames to stay at 30 fps');
    flush(1034); assert.equal(renders, 2);
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
    assert.equal(queued.size, 0); assert.equal((canvas.dataset as any).backdropState, 'paused');
    flush(2000); assert.equal(renders, 2);
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); flush(3000); assert.equal(renders, 3);
    win.dispatchEvent(new Event('pagehide')); assert.equal(queued.size, 0);
    win.dispatchEvent(new Event('pageshow')); flush(4000); assert.equal(renders, 4);
    width = 390; height = 844; win.dispatchEvent(new Event('resize')); flush(5000);
    assert.equal(canvas.style.width, '390px'); assert.equal(canvas.style.height, '844px');
    const camera = app.root.findByName('Chase camera') as pc.Entity;
    assert.ok(Math.abs(camera.camera!.aspectRatio - 390 / 844) < .002);
    media.matches = true; media.dispatchEvent(new Event('change')); flush(6000);
    assert.equal(queued.size, 0, 'reduced motion draws once and then sleeps');
    assert.equal((canvas.dataset as any).backdropState, 'static');
    media.matches = false; media.dispatchEvent(new Event('change')); assert.equal(queued.size, 1);
    dispose(); dispose();
    assert.equal(queued.size, 0); assert.equal(win.listenerCount(), 0); assert.equal(doc.listenerCount(), 0); assert.equal(media.listenerCount(), 0);
    assert.ok(canvas.listenerCount() <= baselineCanvasListeners, 'backdrop and engine listeners are removed');
    assert.equal((canvas.dataset as any).backdropState, 'disposed');
    assert.equal(contextsLost, 1, 'disposed previews release their browser WebGL slot once');
  } finally {
    dispose?.();
    for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete (globalThis as any)[name]; }
  }
});

test('camera frusta retain real track and waterpark landmarks on desktop and portrait', () => {
  const app = fixture();
  try {
    for (const map of maps) {
      const world = createMenuWorld(app, map, DEFAULT_SETTINGS);
      for (const aspect of [16 / 9, 390 / 844, 350 / 390]) for (const time of [0, 15, 29]) {
        world.update(time, aspect);
        const camera = world.camera.camera!;
        camera.aspectRatioMode = pc.ASPECT_MANUAL; camera.aspectRatio = aspect;
        camera.camera.updateFrustum();
        const sample = map === 'coast' ? sampleCoast : sampleWaterparkLoop, length = map === 'coast' ? COAST_LENGTH : WATER_RACE_LENGTH;
        const visible = Array.from({length: 120}, (_, i) => sample(i / 120 * length).p).filter(p => camera.camera.frustum.containsPoint(p));

        assert.ok(visible.length >= 15, `${map}: at least one readable course section`);
        if (map === 'waterpark') {
          const tower = new pc.Vec3(-15, 15, 130), bridge = sampleWaterparkLoop(183).p; bridge.y = 8;
          assert.ok(camera.camera.frustum.containsPoint(tower));
          assert.ok(camera.camera.frustum.containsPoint(bridge));
          const viewProjection = new pc.Mat4().mul2(camera.camera.projectionMatrix, new pc.Mat4().invert(world.camera.getWorldTransform()));
          const towerScreens = [-23, -7].flatMap(x => [3, 26].flatMap(y => [122, 138].map(z => {
            const p = viewProjection.transformVec4(new pc.Vec4(x, y, z, 1)); return {x: p.x / p.w, y: p.y / p.w};
          })));
          assert.ok(towerScreens.every(p => Math.abs(p.x) < .95 && Math.abs(p.y) < .95), 'full tower silhouette has viewport margin');

        }
      }
      world.destroy();
    }
  } finally { app.destroy(); }
});
