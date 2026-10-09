import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { sample as sampleCoast, LENGTH as COAST_LENGTH } from '../src/track';
import { sampleWaterparkLoop, WATER_RACE_LENGTH, WATER_RACE_BRIDGE_DISTANCE, WATER_RACE_TOWER_DISTANCE, WATER_RACE_TOWER_LANE } from '../src/waterpark-design';
import { DEFAULT_SETTINGS } from '../src/game-settings';
import { MENU_FADE_SECONDS, MENU_MAX_FPS, MENU_SCENE_SECONDS, menuBackdropPhase, menuBackdropQuality, menuCameraPose, menuCameraAnchors, mapPreviewCameraPose, coverCameraPose, coverTrackTarget, type MenuBackdropOptions } from '../src/menu-camera';
import { createMenuWorld, mountMenuBackdrop } from '../src/menu-backdrop';
import {coastGroundHeightAt} from '../src/scene';

const maps = ['waterpark', 'coast'] as const;
const referenceCenterlines = Object.fromEntries(maps.map(map => {
  const sample = map === 'coast' ? sampleCoast : sampleWaterparkLoop, length = map === 'coast' ? COAST_LENGTH : WATER_RACE_LENGTH;
  return [map, Array.from({length: 2048}, (_, i) => sample(i / 2048 * length).p)];
})) as Record<typeof maps[number], pc.Vec3[]>;
function nearestCenterlinePoint(map: typeof maps[number], target: pc.Vec3) {
  return referenceCenterlines[map].reduce((nearest, point) => point.clone().sub(target).lengthSq() < nearest.clone().sub(target).lengthSq() ? point : nearest);
}


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
    assert.ok(portrait.position[1] > 25);
    assert.notDeepEqual(portrait.target, first.target, 'portrait reframes a real route section instead of cropping empty infield');
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
      world.camera.getPosition().toArray().forEach((value, axis) => assert.ok(Math.abs(value - mapPreviewCameraPose(map, 5).position[axis]) < .0001));
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

test('original overview baseline still fits full track and landmarks independently of preview zoom', () => {
  const app = fixture();
  try {
    for (const map of maps) {
      const world = createMenuWorld(app, map, DEFAULT_SETTINGS);
      for (const aspect of [16 / 9, 390 / 844, 350 / 390]) for (const time of [0, 15, 29]) {
        const baseline = menuCameraPose(map, time, aspect);
        world.camera.setPosition(...baseline.position); world.camera.lookAt(...baseline.target);
        const camera = world.camera.camera!;
        camera.aspectRatioMode = pc.ASPECT_MANUAL; camera.aspectRatio = aspect;
        camera.camera.updateFrustum();
        const sample = map === 'coast' ? sampleCoast : sampleWaterparkLoop, length = map === 'coast' ? COAST_LENGTH : WATER_RACE_LENGTH;
        const visible = Array.from({length: 120}, (_, i) => sample(i / 120 * length).p).filter(p => camera.camera.frustum.containsPoint(p));

        assert.ok(visible.length >= (aspect >= 1 ? 115 : 20), `${map}: landscape retains the full loop and portrait a readable course section`);
        if (map === 'waterpark') {
          const tower = sampleWaterparkLoop(WATER_RACE_TOWER_DISTANCE, WATER_RACE_TOWER_LANE).p; tower.y = 15;
          const bridge = sampleWaterparkLoop(WATER_RACE_BRIDGE_DISTANCE).p; bridge.y = 8;
          assert.ok(camera.camera.frustum.containsPoint(tower));
          if (aspect >= 1) assert.ok(camera.camera.frustum.containsPoint(bridge));
          const viewProjection = new pc.Mat4().mul2(camera.camera.projectionMatrix, new pc.Mat4().invert(world.camera.getWorldTransform()));
          const towerScreens = [-8, 8].flatMap(dx => [2, 27].flatMap(y => [-8, 8].map(dz => {
            const x = tower.x + dx, z = tower.z + dz;
            const p = viewProjection.transformVec4(new pc.Vec4(x, y, z, 1)); return {x: p.x / p.w, y: p.y / p.w};
          })));
          assert.ok(towerScreens.every(p => Math.abs(p.x) < .95 && Math.abs(p.y) < .95), 'full tower silhouette has viewport margin');

        }
      }
      world.destroy();
    }
  } finally { app.destroy(); }
});


test('route-derived camera fitting retains the current anchors with margin and handles invalid input', () => {
  for (const map of maps) for (const aspect of [16 / 9, 2.3, 1, 390 / 844, .3]) {
    for (const time of [0, 15, 29, 180]) {
      const pose = menuCameraPose(map, time, aspect);
      const position = new pc.Vec3(...pose.position), target = new pc.Vec3(...pose.target);
      const forward = target.clone().sub(position).normalize();
      const right = new pc.Vec3().cross(forward, pc.Vec3.UP).normalize(), up = new pc.Vec3().cross(right, forward);
      const tanV = Math.tan(pose.fov * Math.PI / 360);
      for (const point of menuCameraAnchors(map, aspect)) {
        const delta = new pc.Vec3(...point).sub(position), depth = delta.dot(forward);
        assert.ok(depth > 0);
        assert.ok(Math.abs(delta.dot(right) / (depth * tanV * aspect)) < .9, `${map}: horizontal framing margin`);
        assert.ok(Math.abs(delta.dot(up) / (depth * tanV)) < .9, `${map}: vertical framing margin`);
      }
    }
  }
  for (const value of [NaN, Infinity, -Infinity, 0, -2]) for (const map of maps) {
    const pose = menuCameraPose(map, value, value);
    assert.ok([...pose.position, ...pose.target, pose.fov].every(Number.isFinite));
  }
});


test('public framing data cannot mutate the bounded internal viewport cache', () => {
  const before = menuCameraPose('coast', 9, 16 / 9);
  const points = menuCameraAnchors('coast', 16 / 9);
  points[0][0] = 100000; points.length = 0;
  const disposable = menuCameraPose('coast', 9, 16 / 9); disposable.target[0] = -100000;
  assert.deepEqual(menuCameraPose('coast', 9, 16 / 9), before);
  for (let i = 0; i < 40; i++) menuCameraPose(i % 2 ? 'coast' : 'waterpark', 9, .3 + i / 40);
  assert.deepEqual(menuCameraPose('coast', 9, 16 / 9), before, 'resizing replaces cached framing without changing the result');
});


test('procedural coastal preview palms are planted in actual island caps and never over ocean', () => {
  const app = fixture();
  try {
    const world = createMenuWorld(app, 'coast', DEFAULT_SETTINGS);
    const trunks = (app.root.findComponents('render') as pc.RenderComponent[])
      .filter(component => component.entity.name === 'Menu coastal palms')
      .flatMap(component => component.meshInstances)
      .find(instance => (instance.material as pc.StandardMaterial).diffuse.toString(false) === '#a17b60')!;
    assert.ok(trunks);
    const positions: number[] = []; trunks.mesh.getPositions(positions);
    const stride = new pc.CylinderGeometry({radius: .35, height: 8, capSegments: 6}).positions.length;
    assert.equal(positions.length % stride, 0);
    const count = positions.length / stride;
    const expected = Array.from({length: 26}, (_, i) => sampleCoast(i * 37 + 9, (i % 2 ? -1 : 1) * (16 + i % 3 * 4)).p)
      .filter(point => coastGroundHeightAt(point.x, point.z) !== null).length;
    assert.equal(count, expected); assert.ok(count > 0 && count < 26);
    for (let offset = 0; offset < positions.length; offset += stride) {
      const points = positions.slice(offset, offset + stride);
      const min = [0, 1, 2].map(axis => Math.min(...points.filter((_, i) => i % 3 === axis)));
      const max = [0, 1, 2].map(axis => Math.max(...points.filter((_, i) => i % 3 === axis)));
      const ground = coastGroundHeightAt((min[0] + max[0]) / 2, (min[2] + max[2]) / 2);
      assert.notEqual(ground, null, 'trunk center lies over solid ground');
      assert.ok(Math.abs(min[1] - (ground! - .2)) < .00001, 'trunk base uses the actual cap height');
    }
    world.destroy();
  } finally { app.destroy(); }
});

test('cover camera uses two-thirds of the prior cover radius at nine-times baseline orbit/dolly phase', () => {
  const offset = (pose: ReturnType<typeof menuCameraPose>) => pose.position.map((value, axis) => value - pose.target[axis]);
  for (const map of maps) for (const aspect of [16 / 9, 2.3, 1, 390 / 844, .3]) {
    for (const time of [0, .125, 3, 9.9, 10, 17, 29.999, 35]) {
      const cover = coverCameraPose(map, time, aspect), preview = menuCameraPose(map, time * 9, aspect);
      const actual = offset(cover), expected = offset(preview);
      assert.equal(cover.fov, preview.fov, `${map}: zoom changes distance, not field of view`);
      for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(actual[axis] * 9 / 2 - expected[axis]) < 1e-10, `${map}: exact two-ninths baseline offset on axis ${axis}`);
      assert.ok(Math.abs(Math.hypot(...actual) / Math.hypot(...expected) - 2 / 9) < 1e-12);
      const previousCoverRadiusAtThreeTimesCurrentTime = Math.hypot(...offset(menuCameraPose(map, (time * 3) * 3, aspect))) / 3;
      assert.ok(Math.abs(Math.hypot(...actual) / previousCoverRadiusAtThreeTimesCurrentTime - 2 / 3) < 1e-12, 'reducing current distance by one-third preserves two-thirds of the prior cover distance');
      const dt = 1 / 30, nextCover = offset(coverCameraPose(map, time + dt, aspect));
      const nextPreview = offset(menuCameraPose(map, (time + dt) * 9, aspect));
      for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs((nextCover[axis] - actual[axis]) * 9 / 2 - (nextPreview[axis] - expected[axis])) < 1e-10, 'orbital and radial changes both use the accelerated phase');
    }
  }
  for (const time of [0, 9.999, 10, 29.999, 30, 59.999, 60, 90]) {
    assert.deepEqual(menuBackdropPhase(time, false, {presentation: 'cover'}), menuBackdropPhase(time), 'cover motion does not speed up the thirty-second map cycle or fade');
  }
});

test('native worlds route the independent close cover and map-preview cameras with safe clipping', () => {
  const app = fixture();
  try {
    for (const map of maps) for (const presentation of ['cover', 'map-preview'] as const) {
      const world = createMenuWorld(app, map, DEFAULT_SETTINGS, presentation);
      try {
        for (const aspect of [16 / 9, 390 / 844, 350 / 390]) for (const time of [0, 7.5, 15, 29.999]) {
          world.update(time, aspect);
          const expected = (presentation === 'cover' ? coverCameraPose : mapPreviewCameraPose)(map, time, aspect);
          const position = world.camera.getPosition(), target = new pc.Vec3(...expected.target), camera = world.camera.camera!;
          position.toArray().forEach((value, axis) => assert.ok(Math.abs(value - expected.position[axis]) < .0001));
          assert.ok(world.camera.forward.dot(target.clone().sub(position).normalize()) > .999999, 'native camera keeps aiming at the same target');
          assert.ok(position.y > (presentation === 'cover' ? (map === 'waterpark' ? 27 : 15) : 10), 'camera remains elevated above the focal track surface');
          assert.equal(camera.nearClip, .1); assert.equal(camera.farClip, map === 'coast' ? 1500 : 1200);
          assert.equal(camera.fov, expected.fov);
          const distance = target.clone().sub(position).length();
          assert.ok(distance > camera.nearClip * 10 && distance < camera.farClip, 'look target remains safely within depth limits');
          {
            camera.aspectRatioMode = pc.ASPECT_MANUAL; camera.aspectRatio = aspect; camera.camera.updateFrustum();
            const sample = map === 'coast' ? sampleCoast : sampleWaterparkLoop, length = map === 'coast' ? COAST_LENGTH : WATER_RACE_LENGTH;
            const visible = Array.from({length: 120}, (_, i) => sample(i / 120 * length).p).filter(point => camera.camera.frustum.containsPoint(point));
            assert.ok(visible.length >= (presentation === 'cover' ? 5 : aspect >= 1 ? 115 : 20), `${map}: composition retains a readable real course section`);
            const surface = nearestCenterlinePoint(map, target);
            if (presentation === 'cover') assert.ok(surface.clone().sub(target).length() < 1, 'cover focal point remains within one metre of the real track');
            const viewProjection = new pc.Mat4().mul2(camera.camera.projectionMatrix, new pc.Mat4().invert(world.camera.getWorldTransform()));
            const project = (point: pc.Vec3) => {const value = viewProjection.transformVec4(new pc.Vec4(point.x, point.y, point.z, 1)); return {x: value.x / value.w, y: value.y / value.w, w: value.w};};
            const aimed = project(target), road = project(surface);
            assert.ok(aimed.w > camera.nearClip && Math.abs(aimed.x) < .00001 && Math.abs(aimed.y) < .00001, 'the target projects to native screen center');
            if (presentation === 'cover') assert.ok(road.w > camera.nearClip && Math.abs(road.x) < .035 && Math.abs(road.y) < .035, 'cover centerline geometry stays in the center 3.5% of the viewport');
          }
        }
      } finally { world.destroy(); }
    }
  } finally { app.destroy(); }
});

test('backdrop mount routes cover-only motion separately and retains the thirty-second scene switch', () => {
  const names = ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const saved = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const cases: {options: MenuBackdropOptions; expected: 'cover' | 'map-preview'; map: typeof maps[number]}[] = [
    {options: {presentation: 'cover'}, expected: 'cover', map: 'waterpark'},
    {options: {}, expected: 'cover', map: 'waterpark'},
    {options: {map: 'coast', autoCycle: false, presentation: 'map-preview'}, expected: 'map-preview', map: 'coast'},
    {options: {map: 'coast'}, expected: 'map-preview', map: 'coast'},
  ];
  try {
    for (const entry of cases) {
      let nextFrame = 0;
      const queued = new Map<number, FrameRequestCallback>();
      const width = 1280, height = 720;
      const parent = {getBoundingClientRect: () => ({left: 0, top: 0, width, height})};
      const canvas = Object.assign(new EventTarget(), {id: 'cover-routing-test', width, height, dataset: {} as Record<string, string>, style: {width: '', height: ''}, parentElement: parent,
        getBoundingClientRect: parent.getBoundingClientRect});
      Object.defineProperties(canvas, {clientWidth: {get: () => width}, clientHeight: {get: () => height}});
      const app = fixture(canvas as any); app.render = () => {};
      const media = Object.assign(new EventTarget(), {matches: false});
      Object.assign(globalThis, {
        window: Object.assign(new EventTarget(), {innerWidth: width, innerHeight: height, devicePixelRatio: 1, matchMedia: () => media}),
        document: Object.assign(new EventTarget(), {hidden: false}),
        requestAnimationFrame: (callback: FrameRequestCallback) => {queued.set(++nextFrame, callback); return nextFrame;},
        cancelAnimationFrame: (id: number) => {queued.delete(id);},
      });
      const flush = (time: number) => {const callbacks = [...queued.values()]; queued.clear(); for (const callback of callbacks) callback(time);};
      const dispose = mountMenuBackdrop(canvas as any, {style: {opacity: ''}} as any, DEFAULT_SETTINGS, entry.options, () => app);
      try {
        flush(1000); flush(1100);
        assert.equal(canvas.dataset.backdropMap, entry.map);
        const camera = app.root.findByName(entry.map === 'coast' ? 'Chase camera' : 'Waterpark low chase composition') as pc.Entity;
        const expected = (entry.expected === 'cover' ? coverCameraPose : mapPreviewCameraPose)(entry.map, .1, width / height);
        camera.getPosition().toArray().forEach((value, axis) => assert.ok(Math.abs(value - expected.position[axis]) < .0001));
        if (entry.options.presentation === 'cover') {
          for (let frame = 2; frame <= 100; frame++) flush(1000 + frame * 100);
          assert.equal(canvas.dataset.backdropMap, 'waterpark', 'nine-times camera phase does not switch maps at ten seconds');
          for (let frame = 101; frame <= 301; frame++) flush(1000 + frame * 100);
          assert.equal(canvas.dataset.backdropMap, 'coast', 'the cover still switches scenes after thirty real animation seconds');
        }
      } finally { dispose(); }
    }
  } finally {
    for (const [name, descriptor] of saved) {if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete (globalThis as any)[name];}
  }
});


test('cover focal target follows a continuous actual centerline section in every viewport', () => {
  for (const map of maps) {
    assert.notDeepEqual(coverTrackTarget(map, 0), coverTrackTarget(map, 20), 'focus moves along the authored track section');
    for (const time of [0, .125, 3, 9.9, 10, 17, 29.999, 35, 90]) {
      const target = coverTrackTarget(map, time), point = new pc.Vec3(...target);
      assert.ok(nearestCenterlinePoint(map, point).clone().sub(point).length() < 1);
      const next = new pc.Vec3(...coverTrackTarget(map, time + .001));
      assert.ok(next.sub(point).length() < .05, 'one-millisecond steps have no focal-point jumps');
      for (const aspect of [16 / 9, 2.3, 1, 390 / 844, .3]) assert.deepEqual(coverCameraPose(map, time, aspect).target, target, 'portrait and desktop stay centered on the same real track feature');
    }
  }
});


test('map-selection diorama fits route anchors and stays above foliage throughout its calm motion', () => {
  for (const map of maps) for (const aspect of [16 / 9, 2.3, 1, 390 / 844, .3]) {
    for (const time of [0, .125, 3, 9.9, 10, 17, 29.999, 35, 90, 180]) {
      const pose = mapPreviewCameraPose(map, time, aspect);
      const position = new pc.Vec3(...pose.position), target = new pc.Vec3(...pose.target);
      const forward = target.clone().sub(position).normalize();
      const right = new pc.Vec3().cross(forward, pc.Vec3.UP).normalize(), up = new pc.Vec3().cross(right, forward);
      const tanV = Math.tan(pose.fov * Math.PI / 360);
      assert.ok(pose.position[1] > 75, 'lens clears palms and the landmark tower');
      for (const point of menuCameraAnchors(map, aspect)) {
        const delta = new pc.Vec3(...point).sub(position), depth = delta.dot(forward);
        assert.ok(depth > 0);
        assert.ok(Math.abs(delta.dot(right) / (depth * tanV * aspect)) < .9);
        assert.ok(Math.abs(delta.dot(up) / (depth * tanV)) < .9);
      }
      const next = mapPreviewCameraPose(map, time + 1 / 30, aspect);
      assert.ok(Math.hypot(...next.position.map((value, axis) => value - pose.position[axis])) < 1, 'no fast orbit or camera jump');
      assert.notDeepEqual(pose.position, coverCameraPose(map, time, aspect).position);
    }
  }
  for (const value of [NaN, Infinity, -Infinity, 0, -2]) for (const map of maps) {
    const pose = mapPreviewCameraPose(map, value, value);
    assert.ok([...pose.position, ...pose.target, pose.fov].every(Number.isFinite));
  }
});
