import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as pc from 'playcanvas';
import { parseLocalGLB, COURSE_FILES, RUNTIME_MODELS } from '../src/assets';
import { itemImage, type ItemDisplay, type ItemKind } from '../src/item-models';
import { resetPickup, setPickupDisplay } from '../src/item-pickups';

/** Runs the actual game module with a real PlayCanvas NullGraphicsDevice.
 * DOM events and image pixels are mocked, not race code, meshes, glTFs or rigs.
 * This validates engine integration; it does NOT claim GPU/browser visual QA. */
test('native game integration preserves race, camera, items, menu and safety flows', async (t) => {
  const g = globalThis as any, originalFetch = globalThis.fetch, originalConsoleError = console.error;
  const loggedErrors: unknown[] = []; console.error = (...args) => { loggedErrors.push(args[0]); };
  const elements = new Map<string, any>(), events: Record<string, Function[]> = {}, docEvents: Record<string, Function[]> = {};
  class Element {
    id: string; tagName = 'CANVAS'; width = 1280; height = 800; disabled = false; hidden = false; alt = ''; value: any = ''; textContent: any = ''; innerHTML = ''; style: any = {}; dataset: any = {}; attributes: any = {}; listeners: Record<string, Function[]> = {}; open = false;
    classList = { add() {}, remove() {} };
    constructor(id: string) { this.id = id; }
    getContext() { return new Proxy({}, { get: () => () => {} }); }
    getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }
    get src() { return this.attributes.src || ''; }
    set src(value: string) { this.attributes.src = value; }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    removeEventListener() {}
    setPointerCapture() {}
    focus() { g.document.activeElement = this; }
    click() { if (!this.disabled) (this as any).onclick?.(); }
    emit(name, e = {}) { this.listeners[name]?.forEach(fn => fn(e)); }
  }
  const element = (id: string) => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
  const touch = ['ArrowLeft', 'ArrowRight', 'ShiftLeft', 'Space', 'KeyS', 'KeyW'].map(key => { const e = element('touch-' + key); e.dataset.key = key; return e; });
  g.HTMLCanvasElement = Element;
  g.window = { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
  g.document = { getElementById: element, createElement: () => new Element('texture'), body: element('body'), documentElement: { clientWidth: 1280, clientHeight: 800 }, hidden: false, querySelectorAll: () => touch, addEventListener: (name, fn) => (docEvents[name] ||= []).push(fn), removeEventListener() {} };
  g.innerWidth = 1280; g.innerHeight = 800; g.devicePixelRatio = 1;
  g.addEventListener = (name, fn) => (events[name] ||= []).push(fn);
  const canvas = element('game'), device = new pc.NullGraphicsDevice(canvas), app = new pc.AppBase(canvas);
  const options = new pc.AppOptions(); options.graphicsDevice = device;
  options.componentSystems = [pc.RenderComponentSystem, pc.AnimComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
  options.resourceHandlers = [pc.ContainerHandler, pc.RenderHandler, pc.MaterialHandler, pc.TextureHandler];
  options.batchManager = pc.BatchManager; options.devtools = false; app.init(options);
  app.assets.on('add', (asset: pc.Asset) => { if (asset.type === 'container') (asset.options as any).image = { processAsync(_image, done) { const texture = new pc.Asset('test-texture', 'texture'); texture.resource = new pc.Texture(device, { width: 1, height: 1 }); texture.loaded = true; app.assets.add(texture); done(null, texture); } }; });
  g.__testApp = app; (app as any).setCanvasFillMode = () => {}; (app as any).setCanvasResolution = () => {};
  const bytes = (path, gzip = false) => { const buffer = gzip ? gunzipSync(readFileSync(path)) : readFileSync(path); return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength); };
  // Loading remains asynchronous so Start/readiness guards are exercised.
  let courseAttempts = 0, bundleAttempts = 0, failGLM = true; const parsedDrivers: Record<string,number> = {};
  const originalGenerate = app.batcher.generate.bind(app.batcher); let failPreparation = true;
  app.batcher.generate = (...args: any[]) => { if (failPreparation) { failPreparation = false; throw new Error('Injected preparation failure'); } return originalGenerate(...args); };
  let unblock: Function; const gate = new Promise(resolve => { unblock = resolve; });
  g.__loadCourseAssets = async (_app, {existing, onStatus}) => {
    courseAttempts++;
    for (const file of COURSE_FILES) if (!existing.has(file.id)) existing.set(file.id, await parseLocalGLB(app, bytes('public/' + file.path), file.path));
    onStatus({ records: COURSE_FILES.map(f => ({ ...f, stage: 'ready', receivedBytes: 100, totalBytes: 100 })), receivedBytes: 500, totalBytes: 500, completed: 5, total: 5, loaded: 5, failed: 0 });
    return { assets: existing, failures: new Map() };
  };
  g.__loadBundledDrivers = async (_app, {existingDrivers, onStatus, onProgress}) => {
    bundleAttempts++; await gate;
    const drivers = new Map(existingDrivers), failures = new Map();
    for (const record of RUNTIME_MODELS) {
      if (!drivers.has(record.id)) { if (record.id === 'glm' && failGLM) { failures.set('glm', 'Injected model failure'); continue; } parsedDrivers[record.id] = (parsedDrivers[record.id] || 0) + 1; drivers.set(record.id, await parseLocalGLB(app, bytes('public/' + record.path, true), record.id + '.glb')); }
      onProgress();
    }
    onStatus({ records: RUNTIME_MODELS.map(r => ({ id: r.id, stage: 'ready', receivedBytes: 100, totalBytes: 100 })), receivedBytes: 600, totalBytes: 600, completed: 6, total: 6, loaded: 6, failed: 0 });
    return { drivers, failures };
  };
  let source = readFileSync('src/game.ts', 'utf8');
  source = source.replace('loadCourseAssets, loadBundledDrivers,', 'loadCourseAssets as unusedCourseLoader, loadBundledDrivers as unusedDriverLoader,');
  source = source.replace('declare global', 'const loadCourseAssets = (globalThis as any).__loadCourseAssets, loadBundledDrivers = (globalThis as any).__loadBundledDrivers;\ndeclare global');
  source = source.replace(/app = new pc\.Application\(canvas,.*?\);/, 'app = (globalThis as any).__testApp;');
  source = source.replace("import.meta.env.DEV || new URLSearchParams(location.search).has('qa')", 'true');
  source = source.replace('app.start();', '// Manual NullGraphicsDevice stepping.');
  const copy = new URL('../src/.game-test.ts', import.meta.url); writeFileSync(copy, source);
  const key = (kind, code) => events[kind]?.forEach(fn => fn({ code, repeat: false, preventDefault() {} }));
  try {
    await import(copy.href + '?run=' + Date.now());
    const game = g.window.neonKart, qa = game.debug;
    assert.equal(game.getState().engine, 'PlayCanvas'); assert.equal(game.getState().modelsLoaded, false);
    game.start(); assert.equal(game.getState().state, 'loading');
    for (let i = 0; i < 300 && game.getState().loading.busy; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.match(game.getState().loading.error, /Injected preparation failure/);
    assert.equal(qa.world.root.findByName('Original course props'), null, 'failed off-scene build rolls back without publishing duplicate props');
    assert.equal(element('retryLoading').disabled, false);
    const retry = game.retryLoading(); const repeated = game.retryLoading(); assert.equal(retry, repeated, 'concurrent retry clicks share one boot');
    unblock(); await retry;
    for (let i = 0; i < 300 && !game.getState().modelsLoaded; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(game.getState().loading.error, null); assert.equal(game.getState().modelsLoaded, true);
    assert.equal(courseAttempts, 2); assert.equal(bundleAttempts, 1); assert.equal(qa.controllers.size, 5);
    assert.deepEqual(game.getState().bundledFailures, ['glm']); assert.equal(game.getState().allDriversLoaded, false);
    assert.equal(game.getState().driverStates.find(d=>d.id==='glm').appearance, 'original-fallback');
    assert.match(element('startText').textContent, /原创替身/); const courseRoot = qa.world.root.findByName('Original course props');
    failGLM = false; assert.equal(await game.retryLoading(), true); assert.equal(bundleAttempts, 2); assert.equal(courseAttempts, 2);
    assert.equal(game.getState().allDriversLoaded, true); assert.equal(qa.controllers.size, 6); assert.ok(Object.values(parsedDrivers).every(count => count === 1), 'successful drivers are retained on failed-slot retry'); assert.equal(qa.world.root.findByName('Original course props'), courseRoot);
    assert.equal(qa.boxes().length, 45); assert.equal(qa.world.root.findByName('Original course props')?.name, 'Original course props');
    assert.ok(qa.world.root.findComponents('render').length > 100);
    qa.freeze();
    const race = () => { game.start(); qa.step(3.3); assert.equal(game.getState().state, 'running'); };
    const worldLayer = app.scene.layers.getLayerById(pc.LAYERID_WORLD)!;
    const displays: ItemDisplay[] = ['boost', 'shield', 'pulse', 'mystery'];
    const withRandom = <T>(random: () => number, action: () => T): T => {
      const original = Math.random; Math.random = random;
      try { return action(); } finally { Math.random = original; }
    };
    const assertBoxVisible = (box) => {
      assert.equal(box.mesh.enabled, true);
      assert.equal(box.cool, 0);
      assert.deepEqual(Object.keys(box.models).sort(), [...displays].sort());
      for (const kind of displays) {
        const model = box.models[kind] as pc.Entity;
        assert.equal(model.parent, box.mesh, `${kind} model belongs to the pickup parent`);
        assert.equal(model.enabled, kind === box.display, `${kind} is enabled only when depicted`);
        assert.ok(model.findComponents('render').length > 0, `${kind} has native geometry`);
      }
      for (const render of box.mesh.findComponents('render') as pc.RenderComponent[]) {
        for (const mesh of render.meshInstances) {
          assert.equal(worldLayer.meshInstances.includes(mesh), render.entity.enabled,
            `${render.entity.name} matches native layer membership`);
        }
      }
    };
    const assertBoxHidden = (box) => {
      assert.equal(box.mesh.enabled, false, 'pickup parent is disabled without waiting for draw');
      const renders = box.mesh.findComponents('render') as pc.RenderComponent[];
      assert.ok(renders.length > 2, 'assertions include glass, frame and enclosed model geometry');
      for (const render of renders) {
        assert.equal(render.entity.enabled, false, `${render.entity.name} is effectively disabled`);
        for (const mesh of render.meshInstances) {
          assert.equal(worldLayer.meshInstances.includes(mesh), false,
            `${render.entity.name} is removed from the actual render layer immediately`);
        }
      }
    };
    const assertEmptyImage = () => {
      assert.equal(element('itemImage').hidden, true);
      assert.equal(element('itemImage').src, '');
      assert.equal(Object.hasOwn(element('itemImage').attributes, 'src'), false, 'empty slot removes the previous image source');
      assert.equal(element('itemImage').alt, '');
      assert.equal(element('item').dataset.held, 'empty');
      assert.equal(element('item').attributes['aria-label'], '等待道具');
    };
    const assertHeldImage = (kind: ItemKind) => {
      assert.equal(element('itemImage').hidden, false);
      assert.equal(element('itemImage').src, itemImage(kind), 'HUD uses the artwork for the awarded model');
      assert.ok(element('itemImage').src.length > 0);
      assert.match(element('itemImage').alt, /模型/);
      assert.equal(element('item').dataset.held, kind);
      assert.match(element('item').attributes['aria-label'], /^使用/);
    };
    await t.test('all native boxes have transparent front glass and one enclosed model', () => {
      for (const box of qa.boxes()) {
        assertBoxVisible(box);
        const glass = box.mesh.findByName('Translucent pickup glass') as pc.Entity;
        assert.ok(glass?.render);
        const material = glass.render!.meshInstances[0].material as pc.StandardMaterial;
        assert.equal(material.opacity, .16);
        assert.equal(material.blendType, pc.BLEND_NORMAL);
        assert.equal(material.depthWrite, false);
        assert.equal(material.cull, pc.CULLFACE_BACK);
        assert.equal(material.twoSidedLighting, false);
      }
      const box = qa.boxes()[0];
      for (const display of displays) {
        setPickupDisplay(box, display);
        assertBoxVisible(box);
      }
      const html = readFileSync('index.html', 'utf8');
      assert.match(html, /<img\b[^>]*id="itemImage"[^>]*\balt=""[^>]*\bhidden/);
    });
    await t.test('depicted and mystery rewards remove every native mesh before draw and update the HUD', () => {
      race(); qa.set({ noBots: true }); assertEmptyImage();
      const box = qa.boxes()[0], sources = new Set<string>();
      const cases: [ItemDisplay, ItemKind, number][] = [
        ['boost', 'boost', .9], ['shield', 'shield', 0], ['pulse', 'pulse', .1],
        ['mystery', 'boost', 0], ['mystery', 'shield', .5], ['mystery', 'pulse', .99],
      ];
      for (const [display, reward, random] of cases) {
        resetPickup(box); setPickupDisplay(box, display); assertBoxVisible(box);
        qa.set({ pos: box.d, lane: box.lateral, speed: 0, held: null, boost: 0, shield: 0 });
        withRandom(() => random, () => qa.update(0)); // No draw between collision and assertions.
        assert.equal(game.getState().held, reward, `${display} awards ${reward}`);
        assert.equal(box.cool, 8);
        assertBoxHidden(box); assertHeldImage(reward); sources.add(element('itemImage').src);
        qa.update(0);
        assert.equal(game.getState().held, reward, 'another update cannot overwrite an occupied slot');
        if (reward === 'boost') key('keydown', 'KeyE');
        else element('item').click();
        key('keyup', 'KeyE');
        assert.equal(game.getState().held, null); assertEmptyImage();
        qa.update(0);
        assert.equal(game.getState().held, null, 'using the reward while still overlapping cannot claim again');
        assert.equal(box.cool, 8); assertBoxHidden(box);
      }
      assert.equal(sources.size, 3, 'each usable item has a distinct model image');
      // An externally updated inventory must also replace, rather than retain, its prior image.
      qa.set({ pos: 0, held: 'shield' }); qa.update(0); assertHeldImage('shield');
      qa.set({ held: 'pulse' }); qa.update(0); assertHeldImage('pulse');
      qa.set({ held: null }); qa.update(0); assertEmptyImage();
    });
    await t.test('full inventory leaves the box intact and current bots do not collect pickups', () => {
      race();
      const box = qa.boxes()[0], bot = qa.bots()[0];
      resetPickup(box); setPickupDisplay(box, 'shield');
      qa.set({ pos: 0, lane: 0, speed: 0, held: null });
      bot.total = box.d; bot.lateral = box.lateral; bot.speed = 0;
      qa.update(0);
      assertBoxVisible(box); assert.equal(game.getState().held, null);
      qa.set({ noBots: true, pos: box.d + game.getState().length, lane: box.lateral, held: 'boost' });
      qa.update(0);
      assert.equal(game.getState().held, 'boost'); assertHeldImage('boost'); assertBoxVisible(box);
      game.useItem(); qa.update(0);
      assert.equal(game.getState().held, 'shield', 'pickup collision also works on later laps');
      assertBoxHidden(box); assertHeldImage('shield');
    });
    await t.test('pause freezes pickup cooldown and reset restores all boxes and clears the HUD immediately', () => {
      race(); qa.set({ noBots: true });
      const box = qa.boxes()[0]; resetPickup(box); setPickupDisplay(box, 'boost');
      qa.set({ pos: box.d, lane: box.lateral, speed: 0 }); qa.update(0);
      assertHeldImage('boost'); assertBoxHidden(box);
      game.pause();
      const elapsed = game.getState().elapsed;
      qa.step(9);
      assert.equal(game.getState().elapsed, elapsed);
      assert.equal(box.cool, 8); assert.equal(box.display, 'boost'); assertBoxHidden(box);
      game.useItem(); assert.equal(game.getState().held, 'boost', 'paused item use is ignored'); assertHeldImage('boost');
      game.pause(); qa.set({ pos: 0, lane: 0, speed: 0 });
      qa.update(7.5); assert.equal(box.cool, .5); assertBoxHidden(box);
      withRandom(() => 0, () => qa.update(.5));
      assert.equal(box.display, 'mystery', 'respawn selects a fresh depicted reward'); assertBoxVisible(box);
      assertHeldImage('boost');
      game.useItem();
      qa.set({ pos: box.d, lane: box.lateral, boost: 0 });
      withRandom(() => .5, () => qa.update(0));
      assert.equal(game.getState().held, 'shield'); assertBoxHidden(box); assertHeldImage('shield');
      // Starting a race must restore parents now, even before the countdown draws a frame.
      game.start();
      assert.equal(game.getState().state, 'countdown'); assert.equal(game.getState().held, null); assertEmptyImage();
      for (const pickup of qa.boxes()) { assert.ok(displays.includes(pickup.display)); assertBoxVisible(pickup); }
    });
    race(); qa.step(1); assert.equal(game.getState().speed, 0);
    key('keydown', 'KeyW'); qa.step(3); assert.ok(game.getState().speed > 35); key('keyup', 'KeyW');
    qa.set({ held: 'shield', speed: 42, noBots: true }); key('keydown', 'Space'); qa.step(2); key('keyup', 'Space');
    assert.equal(game.getState().speed, 0); assert.equal(game.getState().held, 'shield'); game.useItem(); assert.equal(game.getState().shield, 6);
    qa.set({ pos: 1, speed: 20, lane: 0 }); key('keydown', 'KeyS'); qa.step(3); key('keyup', 'KeyS'); assert.ok(game.getState().speed < 0); assert.equal(game.getState().lap, 1); assert.match(element('speed').textContent, /^R /);
    qa.set({ pos: 200, lane: 0, speed: 35, shield: 0 }); key('keydown', 'KeyW'); key('keydown', 'KeyA'); key('keydown', 'ShiftLeft'); qa.step(1); assert.ok(game.getState().charge > .7); key('keyup', 'ShiftLeft'); key('keyup', 'KeyA'); qa.step(.1); key('keyup', 'KeyW'); assert.ok(game.getState().boost > 0);
    qa.set({ speed: 35, charge: 1, drifting: true, boost: 0 }); key('keydown', 'Space'); qa.step(.1); key('keyup', 'Space'); assert.equal(game.getState().boost, 0); assert.equal(game.getState().charge, 0);
    qa.set({ held: 'boost' }); game.useItem(); assert.equal(game.getState().boost, 3.3);
    qa.set({ held: 'pulse', boost: 0 }); game.useItem(); assert.equal(game.getState().boost, 1.9);
    // Both camera heights preserve steering projection at every circuit heading.
    for (let view = 0; view < 2; view++) {
      if (game.getState().camera !== view) element('camera').click();
      for (let i = 0; i < 32; i++) {
        const d = game.getState().length * i / 32; qa.set({ pos: d, lane: 0, speed: 30, steerVis: 0 }); qa.orbit.recenter(true); qa.draw(1); app.fire('prerender');
        const base = qa.world.camera.camera.worldToScreen(qa.sample(d).p);
        for (const code of ['KeyA', 'KeyD']) { qa.set({ pos: d, lane: 0, speed: 30, steerVis: 0 }); key('keydown', code); qa.update(.1); key('keyup', code); const moved = qa.world.camera.camera.worldToScreen(qa.sample(d, game.getState().lane).p); assert.equal(Math.sign(moved.x - base.x), code === 'KeyA' ? -1 : 1, JSON.stringify({view,i,code,d,lane:game.getState().lane,base,moved,camera:qa.world.camera.getPosition()})); assert.equal(Math.sign(game.getState().steerVis), code === 'KeyA' ? 1 : -1); }
      }
    }
    const previousView = game.getState().camera; key('keydown', 'KeyZ'); key('keyup', 'KeyZ'); assert.notEqual(game.getState().camera, previousView);
    const pointer = { button: 2, pointerId: 1, preventDefault() {} }; canvas.emit('mousedown', pointer); assert.equal(qa.keys.RearView, true); canvas.emit('pointermove', { pointerType: 'mouse', buttons: 1 }); assert.equal(qa.keys.RearView, false);
    qa.orbit.move(200, 100); qa.draw(.1); key('keydown', 'Escape'); assert.equal(game.getState().state, 'paused'); key('keydown', 'Escape'); assert.equal(game.getState().state, 'paused'); assert.ok(Object.values(qa.keys).every(v => !v));
    const pausedTime = game.getState().elapsed; qa.step(1); assert.equal(game.getState().elapsed, pausedTime); game.pause(); assert.equal(game.getState().state, 'running');
    events.blur.forEach(fn => fn()); assert.equal(game.getState().state, 'paused'); game.pause(); g.document.hidden = true; docEvents.visibilitychange.forEach(fn => fn()); assert.equal(game.getState().state, 'paused'); g.document.hidden = false; game.pause();
    for (const button of touch) { button.emit('pointerdown', { pointerId: 1, preventDefault() {} }); assert.equal(qa.keys[button.dataset.key], true); button.emit('pointercancel'); assert.equal(qa.keys[button.dataset.key], false); }
    race(); assert.equal(qa.orbit.get().targetYaw, 0); qa.set({ pos: game.getState().length * 3 - .1, speed: 42, noBots: true }); key('keydown', 'KeyW'); qa.step(.2); assert.equal(game.getState().state, 'finished'); assert.equal(game.getState().lap, 3); assert.equal(game.getState().rank, 1);
    for (const id of ['whale', 'gemini', 'gpt', 'claude', 'grok', 'glm']) { assert.equal(game.selectDriver(id), true); assert.equal(qa.player().userData.driverId, id); assert.equal(qa.bots().length, 5); assert.equal(qa.controllers.size, 6); }
    // Native button Enter/Space never triggers global shortcuts or consumes focus.
    for (const id of ['slot-gpt','importButton','clearDriver','start','driverFiles']) for (const code of ['Enter','Space']) {
      let prevented=false; const target={closest:()=>element(id)}; events.keydown.forEach(fn=>fn({code,repeat:false,target,preventDefault(){prevented=true}})); events.keyup.forEach(fn=>fn({code,target,preventDefault(){prevented=true}})); assert.equal(prevented,false); assert.equal(game.getState().state,'finished');
    }
    game.selectDriver('gpt'); const importedBytes=bytes('public/assets/drivers/whale-driver.glb.gz',true);
    let resolveRead: Function; const delayedRead=new Promise(resolve=>{resolveRead=resolve});
    const pending=game.importDrivers([{name:'custom.glb',size:importedBytes.byteLength,arrayBuffer:()=>delayedRead}]);
    assert.equal(game.getState().importing,true); assert.equal(element('start').disabled,true); game.start(); assert.equal(game.getState().state,'finished');
    game.selectDriver('gemini'); resolveRead(importedBytes); const results=await pending; assert.equal(results[0].value.status,'imported');
    assert.deepEqual(game.getState().importedSlots,['gpt']); assert.equal(game.getState().selectedDriverId,'gemini'); assert.equal(element('start').disabled,false);
    assert.equal(game.getState().driverStates.find(d=>d.id==='gpt').appearance,'local-import'); game.selectDriver('gpt'); assert.equal(game.clearDriver(),true); assert.deepEqual(game.getState().importedSlots,[]); assert.equal(game.getState().driverStates.find(d=>d.id==='gpt').appearance,'bundled-model');
    const invalid=await game.importDrivers([{name:'wrong.zip',size:1,arrayBuffer:async()=>new ArrayBuffer(1)}]); assert.equal(invalid[0].status,'rejected'); assert.equal(element('start').disabled,false);
    const event={target:{files:[],value:'previous'}}; element('driverFiles').emit('change',event); assert.equal(event.target.value,'');
    game.start(); assert.equal(game.getState().speed, 0); assert.equal(game.getState().pos, 0); assert.equal(game.getState().elapsed, 0); assert.equal(game.getState().boost, 0); assert.equal(game.getState().charge, 0);
    assert.equal(g.document.activeElement, canvas); assert.equal(await game.retryLoading(), false);
    assert.equal(loggedErrors.length, 1); assert.match(String(loggedErrors[0]), /Injected preparation failure/);
  } finally {
    console.error = originalConsoleError; globalThis.fetch = originalFetch; unlinkSync(copy); app.destroy();
    delete g.__testApp; delete g.__loadCourseAssets; delete g.__loadBundledDrivers;
  }
});
