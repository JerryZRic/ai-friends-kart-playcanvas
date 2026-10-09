import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as pc from 'playcanvas';
import { CHARACTER_PROFILES, characterTuning } from '../src/character-profiles';
import { parseLocalGLB, COURSE_FILES, RUNTIME_MODELS } from '../src/assets';
import {halfWidthAt,laneLimitAt} from '../src/track';
import { itemImage, type ItemDisplay, type ItemKind } from '../src/item-models';
import { resetPickup, setPickupDisplay } from '../src/item-pickups';

/** Runs the actual game module with a real PlayCanvas NullGraphicsDevice.
 * DOM events and image pixels are mocked, not race code, meshes, glTFs or rigs.
 * This validates engine integration; it does NOT claim GPU/browser visual QA. */
test('native game integration preserves race, camera, items, menu and safety flows', async (t) => {
  const g = globalThis as any, originalFetch = globalThis.fetch, originalConsoleError = console.error,originalRandom=Math.random;
  let randomSeed=0x51a7c0de;Math.random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/0x100000000;};
  const previousLocation=g.location;g.location={search:'?driver=whale&autostart=1'};
  const loggedErrors: unknown[] = []; console.error = (...args) => { loggedErrors.push(args[0]); };
  const elements = new Map<string, any>(), events: Record<string, Function[]> = {}, docEvents: Record<string, Function[]> = {};
  class Element {
    id: string; tagName = 'CANVAS'; width = 1280; height = 800; disabled = false; hidden = false; alt = ''; value: any = ''; textContent: any = ''; style: any = {}; dataset: any = {}; attributes: any = {}; listeners: Record<string, Function[]> = {}; open = false;
    children: Element[] = []; parentNode: Element | null = null; captured = new Set<number>(); private markup = '';
    classes = new Set<string>();
    classList = {add: (...names: string[]) => names.forEach(name => this.classes.add(name)), remove: (...names: string[]) => names.forEach(name => this.classes.delete(name)), contains: (name: string) => this.classes.has(name), toggle: (name: string, force?: boolean) => {const add=force ?? !this.classes.has(name);if(add)this.classes.add(name);else this.classes.delete(name);return add;}};
    constructor(id: string) { this.id = id; }
    get innerHTML() { return this.markup; }
    set innerHTML(value: string) {
      this.markup=value;this.textContent=value.replace(/<[^>]*>/g,'');this.children=[];
      // Register actual template IDs without replacing a previously created canvas
      // used by NullGraphicsDevice. Dynamic performance controls share this DOM.
      for(const match of value.matchAll(/<([a-z][\w-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)) {
        const child=element(match[3]) as Element;child.tagName=match[1].toUpperCase();
        child.hidden=/\shidden(?:\s|>|$)/.test(match[2]);child.disabled=/\sdisabled(?:\s|>|$)/.test(match[2]);
        for(const attribute of match[2].matchAll(/([\w-]+)="([^"]*)"/g))child.setAttribute(attribute[1],attribute[2]);
        this.append(child);
      }
    }
    append(...children: Element[]) { for(const child of children){child.parentNode=this;this.children.push(child);} }
    querySelector(selector: string) { return selector.startsWith('#') ? elements.get(selector.slice(1)) ?? null : null; }
    remove() { if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=null; }
    closest(selector: string) { return selector.split(',').some(tag=>tag.toUpperCase()===this.tagName||tag==='[contenteditable]'&&'contenteditable' in this.attributes)?this:null; }
    getContext() { return new Proxy({}, { get: () => () => {} }); }
    getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }
    get src() { return this.attributes.src || ''; }
    set src(value: string) { this.attributes.src = value; }
    setAttribute(name, value) { this.attributes[name] = value;if(name==='class')this.classes=new Set(String(value).split(/\s+/));if(name==='alt')this.alt=value;if(name.startsWith('data-'))this.dataset[name.slice(5)]=value; }
    removeAttribute(name) { delete this.attributes[name]; }
    addEventListener(name, fn, options?) { (this.listeners[name] ||= []).push(fn);options?.signal?.addEventListener('abort',()=>this.removeEventListener(name,fn),{once:true}); }
    removeEventListener(name, fn) { this.listeners[name]=(this.listeners[name]||[]).filter(listener=>listener!==fn); }
    setPointerCapture(id: number) { this.captured.add(id); }
    hasPointerCapture(id: number) { return this.captured.has(id); }
    releasePointerCapture(id: number) { this.captured.delete(id);this.emit('lostpointercapture',{pointerId:id}); }
    focus() { g.document.activeElement = this; }
    click() { if (!this.disabled) {(this as any).onclick?.();this.emit('click');} }
    emit(name, e = {}) { this.listeners[name]?.slice().forEach(fn => fn({target:this,preventDefault(){},...e})); }
  }
  const element = (id: string) => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
  const touch = ['ArrowLeft', 'ArrowRight', 'ShiftLeft', 'Space', 'KeyS', 'KeyW'].map(key => { const e = element('touch-' + key); e.dataset.key = key; return e; });
  g.HTMLCanvasElement = Element;
  g.window = { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
  g.document = { getElementById: element, createElement: (tag: string) => {const created=new Element('');created.tagName=tag.toUpperCase();return created;}, body: element('body'), documentElement: { clientWidth: 1280, clientHeight: 800 }, hidden: false, querySelectorAll: () => touch, addEventListener: (name, fn) => (docEvents[name] ||= []).push(fn), removeEventListener: (name, fn) => {docEvents[name]=(docEvents[name]||[]).filter(listener=>listener!==fn);} };
  g.innerWidth = 1280; g.innerHeight = 800; g.devicePixelRatio = 1;
  g.addEventListener = (name, fn) => (events[name] ||= []).push(fn);
  g.removeEventListener = (name, fn) => {events[name]=(events[name]||[]).filter(listener=>listener!==fn);};
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
    for (let i = 0; i < 300 && game.getState().loading.busy; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(game.getState().loading.error, null); assert.equal(game.getState().modelsLoaded, false, 'missing real character cannot be declared ready');
    assert.equal(courseAttempts, 2); assert.equal(bundleAttempts, 1); assert.equal(qa.controllers.size, 5);
    assert.deepEqual(game.getState().bundledFailures, ['glm']); assert.equal(game.getState().allDriversLoaded, false);
    assert.equal(game.getState().driverStates.find(d=>d.id==='glm').appearance, 'not-loaded');
    assert.match(element('startText').textContent, /重试/);assert.equal(game.getState().state,'menu','autostart failure remains retryable');assert.equal(game.selectDriver('whale'),false);game.start();assert.equal(game.getState().state,'menu');assert.equal(qa.bots().find(b=>b.id==='glm').mesh.enabled,false,'missing model has no placeholder render');assert.equal(qa.bots().find(b=>b.id==='glm').mesh.findComponents('render').length,0); const courseRoot = qa.world.root.findByName('Original course props');
    failGLM = false; assert.equal(await game.retryLoading(), true); assert.equal(bundleAttempts, 2); assert.equal(courseAttempts, 2);
    assert.equal(game.getState().allDriversLoaded, true);assert.equal(game.getState().state,'returning','autostart first returns to the starting line'); assert.equal(qa.controllers.size, 6); assert.ok(Object.values(parsedDrivers).every(count => count === 1), 'successful drivers are retained on failed-slot retry'); assert.equal(qa.world.root.findByName('Original course props'), courseRoot);
    assert.equal(qa.boxes().length, 49); assert.equal(qa.boxes().filter(box=>!box.dynamic).length,45); assert.equal(qa.boxes().filter(box=>box.dynamic).length,4); assert.equal(qa.world.root.findByName('Original course props')?.name, 'Original course props');
    assert.ok(qa.world.root.findComponents('render').length > 100);
    qa.freeze();
    await t.test('model-ready return freezes race and input until camera arrives',()=>{
      assert.equal(game.getState().state,'returning');
      key('keydown','KeyW');qa.advanceFrame(.8);assert.equal(game.getState().state,'returning');assert.equal(game.getState().elapsed,0);assert.equal(game.getState().speed,0);
      const before=qa.world.camera.getPosition().clone();g.document.hidden=true;qa.advanceFrame(10);assert.ok(qa.world.camera.getPosition().equals(before));assert.equal(game.getState().state,'returning');g.document.hidden=false;
      events.blur?.forEach(fn=>fn({}));qa.advanceFrame(10);assert.ok(qa.world.camera.getPosition().equals(before),'blur freezes loading return');events.focus?.forEach(fn=>fn({}));
      for(let i=0;i<80;i++)qa.advanceFrame(1/60);
      assert.equal(game.getState().state,'countdown');assert.equal(element('pausePanel').classList.contains('hidden'),true);assert.equal(game.getState().speed,0);
      qa.advanceFrame(.8);qa.advanceFrame(1.2);assert.equal(game.getState().state,'countdown');assert.equal(game.getState().elapsed,0);key('keydown','Escape');assert.equal(game.getState().state,'paused');element('restartRace').click();qa.advanceFrame(.8);assert.equal(game.getState().state,'countdown');
    });
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
    const parkBots = () => {
      const bots = qa.bots();
      for (const [index, bot] of bots.entries()) Object.assign(bot, {
        total: 400 + index * 30, lateral: 5, targetLane: 5, speed: 0,
        held: null, boost: 0, shield: 0, slow: 0, pulseFlash: 0, bump: 0, finishedAt: null,
        driving: false, decisionIn: 1000, reaction: 1000, cooldown: 1000, pickups: 0, uses: 0,
      });
      return bots;
    };
    const sceneEntities = () => {
      const entities: pc.Entity[] = [];
      const visit = (entity: pc.Entity) => {
        entities.push(entity);
        for (const child of entity.children) visit(child as pc.Entity);
      };
      visit(app.root);
      return entities;
    };
    const botFX = (bot): pc.Entity[] => [bot.fx.shield, ...bot.fx.flames.map(flame => flame.mesh), ...Object.values(bot.fx.inventory)] as pc.Entity[];
    const assertBotFXHidden = (bot) => {
      for (const entity of botFX(bot)) {
        assert.equal(entity.enabled, false, `${entity.name} is hidden immediately`);
        for (const render of entity.findComponents('render') as pc.RenderComponent[])
          for (const mesh of render.meshInstances) assert.equal(worldLayer.meshInstances.includes(mesh), false, `${entity.name} leaves the native render layer`);
      }
    };
    await t.test('every character applies acceleration, top-speed and steering tuning to player and opponents', () => {
      for (const profile of CHARACTER_PROFILES) {
        qa.set({state:'menu'}); assert.equal(game.selectDriver(profile.id),true);game.start();
        qa.set({state:'running',countdown:0,elapsed:0});
        key('keydown','KeyW');qa.update(.1);key('keyup','KeyW');
        const tuning=characterTuning(profile.id,'coast');
        assert.equal(game.getState().selectedDriverId,profile.id);
        assert.equal(element('raceChangeCharacter').href,'index.html?screen=characters&map=coast&driver='+profile.id);
        assert.equal(element('raceChangeMap').href,'index.html?screen=maps&map=coast&driver='+profile.id);
        assert.ok(Math.abs(game.getState().speed-tuning.acceleration*.1)<1e-8);
        for(const bot of qa.bots())assert.ok(Math.abs(bot.speed-characterTuning(bot.id,'coast').acceleration*.1)<1e-8,`${bot.id} has its own acceleration`);
        qa.set({noBots:true,pos:0,lane:0,speed:0});
        key('keydown','KeyW');for(let frame=0;frame<240;frame++)qa.update(1/60);key('keyup','KeyW');
        assert.ok(Math.abs(game.getState().speed-tuning.maxSpeed)<1e-6);
        qa.set({pos:0,lane:0,speed:tuning.maxSpeed});
        key('keydown','KeyD');qa.update(.01);key('keyup','KeyD');
        const steered=game.getState().lane;
        qa.set({pos:0,lane:0,speed:tuning.maxSpeed});qa.update(.01);
        const neutral=game.getState().lane;
        assert.ok(Math.abs((steered-neutral)-(-7*(tuning.maxSpeed-.06)/tuning.maxSpeed*.01*tuning.multipliers.steering))<1e-8);
      }
      qa.set({state:'menu'});game.selectDriver('whale');
    });
    await t.test('medium-complexity variable-width course is completable by all six profiles with bounded racers',()=>{
      for(const profile of CHARACTER_PROFILES){
        qa.set({state:'menu'});game.selectDriver(profile.id);game.start();
        key('keydown','KeyW');
        let frames=0;
        while(game.getState().state!=='finished'&&frames++<60*210){
          const state=game.getState();
          key('keyup','KeyA');key('keyup','KeyD');
          if(state.lane>1.2)key('keydown','KeyD');else if(state.lane< -1.2)key('keydown','KeyA');
          if(frames%180===0)key('keydown','KeyE');
          qa.update(1/60);
          const next=game.getState();
          assert.ok(Math.abs(next.lane)<=laneLimitAt(next.pos)+1e-8,`${profile.id} remains inside current road width`);
          for(const bot of qa.bots())assert.ok(Math.abs(bot.lateral)<=halfWidthAt(bot.total)-.8+1e-8,`${bot.id} stays inside road`);
        }
        key('keyup','KeyW');key('keyup','KeyA');key('keyup','KeyD');key('keyup','KeyE');
        const result=game.getState();assert.equal(result.state,'finished',profile.id);
        assert.equal(result.standings.length,6);assert.ok(result.elapsed<207);
        assert.equal(result.pos,result.length*3);
      }
      qa.set({state:'menu'});game.selectDriver('whale');
    });
    await t.test('foreground stalls after five and ten seconds never open the pause dialog',()=>{
      for(const seconds of [5,10]){
        game.start();qa.set({noBots:true});qa.advanceFrame(0);
        for(let frame=0;frame<(3+seconds)*60;frame++)qa.advanceFrame(1/60);
        assert.equal(game.getState().state,'running');
        const before=game.getState().elapsed;qa.advanceFrame(.8);
        assert.equal(game.getState().state,'running',`foreground stall at ${seconds}s`);
        assert.equal(element('pausePanel').classList.contains('hidden'),true);
        assert.ok(game.getState().elapsed>before&&game.getState().elapsed-before<=.2500001,'catch-up is bounded');
        events.blur.forEach(fn=>fn());const frozen=game.getState().elapsed;qa.advanceFrame(20);
        assert.equal(game.getState().state,'paused');assert.equal(game.getState().elapsed,frozen);
        game.pause();qa.advanceFrame(20);assert.equal(game.getState().state,'running');assert.equal(game.getState().elapsed,frozen);
        g.document.hidden=true;docEvents.visibilitychange.forEach(fn=>fn());qa.advanceFrame(20);
        assert.equal(game.getState().state,'paused');assert.equal(game.getState().elapsed,frozen);
        g.document.hidden=false;docEvents.visibilitychange.forEach(fn=>fn());assert.equal(game.getState().state,'paused');
        game.pause();qa.advanceFrame(20);assert.equal(game.getState().elapsed,frozen);

      }
    });
    await t.test('30/60/120 Hz frames preserve countdown overflow and clocks; huge foreground stalls remain bounded',()=>{
      for(const hz of [30,60,120]){
        game.start();qa.set({noBots:true});qa.advanceFrame(0);
        for(let frame=0;frame<hz*4;frame++)qa.advanceFrame(1/hz);
        assert.equal(game.getState().state,'running');assert.ok(Math.abs(game.getState().elapsed-1)<1e-7);
        const elapsed=game.getState().elapsed;qa.advanceFrame(1e6);
        assert.equal(game.getState().state,'running');assert.ok(Math.abs(game.getState().elapsed-elapsed-.25)<1e-7);
        const afterStall=game.getState().elapsed;game.pause();qa.advanceFrame(2);assert.equal(game.getState().state,'paused');assert.equal(game.getState().elapsed,afterStall);
        game.pause();qa.advanceFrame(.8);assert.equal(game.getState().elapsed,afterStall);qa.advanceFrame(1/hz);assert.ok(Math.abs(game.getState().elapsed-afterStall-1/hz)<1e-7);
      }
    });
    await t.test('pause buttons freeze countdown and restart a clean race, with exact crossing time in results',()=>{
      game.start();qa.update(.5);const before=game.getState();game.pause();qa.update(2);
      assert.equal(game.getState().elapsed,before.elapsed);assert.equal(game.getState().state,'paused');
      element('resumeRace').click();assert.equal(game.getState().state,'countdown');
      game.pause();element('restartRace').click();assert.equal(game.getState().state,'countdown');assert.equal(game.getState().elapsed,0);
      qa.update(3.2);assert.equal(game.getState().state,'running');assert.ok(Math.abs(game.getState().elapsed-.2)<1e-8);
      qa.set({pos:game.getState().length*3-.1,speed:20,noBots:true});qa.update(.1);
      const result=game.getState();assert.equal(result.state,'finished');assert.ok(result.elapsed>.2&&result.elapsed<.3);
      assert.equal(result.standings[0].finishedAt,result.elapsed);assert.equal(result.pos,result.length*3);
      assert.match(element('results').textContent,/WHALE你/);assert.doesNotThrow(()=>JSON.stringify(result));
    });
    await t.test('all native boxes have transparent front glass and one enclosed model', () => {
      for (const box of qa.boxes()) {
        if(box.dynamic)assertBoxHidden(box);else assertBoxVisible(box);
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
      const html = (readFileSync('coast.html', 'utf8')+readFileSync('src/race-hud.ts','utf8'));
      assert.match(html, /<img\b[^>]*id="itemImage"[^>]*\balt=""[^>]*\bhidden/);
    });
    await t.test('dynamic native pool stays dormant through drawing/countdown, spawns on the actual circuit, and cleans up on restart/finish', () => {
      game.start();
      const pool=qa.boxes().filter(box=>box.dynamic),staticBoxes=qa.boxes().filter(box=>!box.dynamic);
      assert.equal(pool.length,4);pool.forEach(assertBoxHidden);
      qa.draw(1);qa.update(2.5);qa.draw(1);pool.forEach(assertBoxHidden);
      const entityCount=sceneEntities().length,renderCount=app.root.findComponents('render').length;
      qa.update(.5);assert.equal(game.getState().state,'running');
      let first:any;
      for(let frame=0;frame<60*100&&!first;frame++){qa.update(1/60);first=pool.find(box=>box.mesh.enabled);}
      assert.ok(first,'real coast updates activate a preallocated random pickup without a test-only spawner');
      assert.ok(first.d>=0&&first.d<game.getState().length);
      assert.ok(Math.abs(first.lateral)<=laneLimitAt(first.d));
      assert.ok(!staticBoxes.some(box=>box.d===first.d&&box.lateral===first.lateral),'dynamic spawn is not an authored static pickup');
      const sample=qa.sample(first.d,first.lateral).p,position=first.mesh.getPosition();
      assert.ok(Math.abs(position.x-sample.x)<1e-4&&Math.abs(position.z-sample.z)<1e-4);
      assert.ok(Math.abs(position.y-sample.y-1.25)<1e-4,'spawn position is set before the next draw');
      const state=()=>pool.map(box=>({d:box.d,lateral:box.lateral,cool:box.cool,display:box.display,enabled:box.mesh.enabled,position:box.mesh.getPosition().toArray()}));
      qa.draw(0);game.pause();const paused=state();for(let frame=0;frame<48;frame++)qa.advanceFrame(.25);assert.deepEqual(state(),paused,'pause freezes pool lifetime, position and scheduling');
      game.pause();parkBots();setPickupDisplay(first,'shield');
      qa.set({pos:first.d,lane:first.lateral,speed:0,held:null});qa.update(0);
      assert.equal(game.getState().held,'shield');assertBoxHidden(first);
      qa.draw(0);assertBoxHidden(first);qa.update(0);assertBoxHidden(first);
      assert.equal(game.getState().held,'shield','drawing and an overlapping second update cannot claim the temporary pickup twice');
      game.start();pool.forEach(assertBoxHidden);qa.draw(0);pool.forEach(assertBoxHidden);
      assert.equal(sceneEntities().length,entityCount);assert.equal(app.root.findComponents('render').length,renderCount);
      qa.update(3);let active:any;
      for(let frame=0;frame<60*100&&!active;frame++){qa.update(1/60);active=pool.find(box=>box.mesh.enabled);}
      assert.ok(active,'restart starts a fresh dynamic schedule');
      qa.set({pos:game.getState().length*3-.01,lane:0,speed:40,noBots:true});qa.update(.01);
      assert.equal(game.getState().state,'finished');pool.forEach(assertBoxHidden);
      qa.draw(3);qa.update(20);pool.forEach(assertBoxHidden);
    });
    await t.test('all six characters can collect dynamic pool items as NPCs and use the earned reward', () => {
      for(const [index,profile] of CHARACTER_PROFILES.entries()){
        qa.set({state:'menu'});assert.equal(game.selectDriver(CHARACTER_PROFILES[(index+1)%CHARACTER_PROFILES.length].id),true);
        race();const pool=qa.boxes().filter(box=>box.dynamic);let box:any;
        for(let frame=0;frame<60*100&&!box;frame++){qa.update(1/60);box=pool.find(candidate=>candidate.mesh.enabled);}
        assert.ok(box,`${profile.id} scenario receives a real runtime spawn`);
        const bots=parkBots(),bot=bots.find(candidate=>candidate.id===profile.id);assert.ok(bot);
        for(const [slot,other] of bots.entries())Object.assign(other,{total:box.d+150+slot*30,lateral:5,targetLane:5});
        Object.assign(bot,{total:box.d,lateral:box.lateral,targetLane:box.lateral,decisionIn:1000});
        qa.set({pos:box.d+12,lane:box.lateral,speed:0,held:null,shield:0,slow:0});
        setPickupDisplay(box,'pulse');qa.update(0);
        assert.equal(bot.held,'pulse',`${profile.id} uses the shared dynamic collision resolver`);assert.equal(bot.pickups,1);assert.equal(bot.uses,0);
        assertBoxHidden(box);qa.draw(0);assertBoxHidden(box);
        Object.assign(bot,{reaction:0,cooldown:0,decisionIn:0});qa.update(0);
        assert.equal(bot.held,null);assert.equal(bot.uses,1);assert.equal(game.getState().slow,3,`${profile.id} uses the item against a valid nearby target`);
        assertBoxHidden(box);
      }
    });
    qa.set({state:'menu'});assert.equal(game.selectDriver('whale'),true);
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
    await t.test('NPCs collect depicted and mystery boxes without overwriting either racer inventory', () => {
      race();
      const box = qa.boxes()[0], [bot] = parkBots();
      qa.set({ pos: 0, lane: 0, speed: 0, held: null });
      Object.assign(bot, { total: box.d, lateral: box.lateral, targetLane: box.lateral });
      const cases: [ItemDisplay, ItemKind, number][] = [
        ['boost', 'boost', .9], ['shield', 'shield', 0], ['pulse', 'pulse', .1],
        ['mystery', 'boost', 0], ['mystery', 'shield', .5], ['mystery', 'pulse', .99],
      ];
      for (const [index, [display, reward, random]] of cases.entries()) {
        resetPickup(box); setPickupDisplay(box, display); bot.held = null;
        withRandom(() => random, () => qa.update(0));
        assert.equal(bot.held, reward, `NPC receives ${reward} from ${display}`);
        assert.equal(bot.pickups, index + 1); assert.equal(bot.uses, 0);
        assert.ok(bot.reaction >= .65, 'a real pickup starts the human-readable reaction delay');
        assert.equal(game.getState().held, null, 'NPC pickup does not change the player HUD');
        assertEmptyImage(); assertBoxHidden(box);
        const snapshot = game.getState().bots.find(racer => racer.id === bot.id);
        assert.equal(snapshot.held, reward); assert.equal(snapshot.pickups, bot.pickups);
        assert.equal(snapshot.mesh, undefined, 'public bot snapshots do not expose native scene objects');
        qa.update(0); assert.equal(bot.held, reward); assert.equal(bot.pickups, index + 1);
      }
      resetPickup(box); setPickupDisplay(box, 'shield'); bot.held = 'boost';
      qa.update(0); assert.equal(bot.held, 'boost'); assertBoxVisible(box);
      qa.set({ noBots: true, pos: box.d + game.getState().length, lane: box.lateral, held: 'boost' });
      qa.update(0);
      assert.equal(game.getState().held, 'boost'); assertHeldImage('boost'); assertBoxVisible(box);
      game.useItem(); qa.update(0);
      assert.equal(game.getState().held, 'shield', 'player pickup collision also works on later laps');
      assertBoxHidden(box); assertHeldImage('shield');
    });
    await t.test('the shared swept pickup resolver awards the earliest arrival exactly once', () => {
      race();
      const box = qa.boxes()[1], [bot] = parkBots();
      resetPickup(box); setPickupDisplay(box, 'pulse');
      qa.set({ pos: box.d - 6, lane: box.lateral, speed: 42, held: null });
      Object.assign(bot, { total: box.d - 4, lateral: box.lateral, targetLane: box.lateral, speed: 40 });
      qa.update(.2);
      assert.equal(bot.held, 'pulse', 'NPC crossing first wins even though the player is resolved in the same frame');
      assert.equal(bot.pickups, 1); assert.equal(game.getState().held, null); assertBoxHidden(box);
      resetPickup(box); setPickupDisplay(box, 'shield');
      Object.assign(bot, { total: box.d - 5, held: null, pickups: 0 });
      qa.set({ pos: box.d, lane: box.lateral, speed: 0, held: null, hit: 0 });
      qa.update(.2);
      assert.equal(game.getState().held, 'shield', 'player already in the box wins before an approaching NPC');
      assert.equal(bot.held, null); assert.equal(bot.pickups, 0); assertBoxHidden(box);
      qa.update(0); assert.equal(bot.held, null); assert.equal(game.getState().held, 'shield');
    });
    await t.test('NPCs show held items, wait after pickup and then use a safe boost', () => {
      race();
      const box = qa.boxes()[1], [bot] = parkBots();
      // Isolate one lifecycle: staggered routes may offer another legitimate box
      // immediately after the boost is consumed. That is covered separately.
      for(const other of qa.boxes())if(other!==box){other.cool=100;other.mesh.enabled=false;}
      resetPickup(box); setPickupDisplay(box, 'boost');
      qa.set({ pos: 0, lane: -5, speed: 0 });
      Object.assign(bot, { total: box.d, lateral: box.lateral, targetLane: box.lateral, speed: 36, decisionIn: 0, reaction: 0, cooldown: 0 });
      qa.update(0); qa.draw(0);
      assert.equal(bot.held, 'boost'); assert.equal(bot.boost, 0); assert.equal(bot.uses, 0);
      for (const kind of ['boost', 'shield', 'pulse'] as ItemKind[]) {
        const inventory = bot.fx.inventory[kind] as pc.Entity;
        assert.equal(inventory.parent, app.root, 'inventory marker uses an independent native scene entity');
        assert.equal(inventory.enabled, kind === 'boost');
        assert.ok(inventory.findComponents('render').length > 0, 'held NPC items have real native geometry');
      }
      qa.step(.4);
      assert.equal(bot.held, 'boost', 'NPC cannot consume a pickup before the reaction delay');
      assert.equal(bot.boost, 0); assert.equal(bot.uses, 0);
      qa.step(1);
      assert.equal(bot.held, null); assert.equal(bot.uses, 1); assert.ok(bot.boost > 0);
      assert.ok(bot.fx.flames.every(flame => flame.mesh.enabled));
      assert.ok(Object.values(bot.fx.inventory).every((entity: pc.Entity) => !entity.enabled));
    });
    await t.test('NPC pulses select the nearest player or bot, respect shields and wrap across laps', () => {
      race();
      const [shooter, other] = parkBots(), length = game.getState().length;
      const arm = () => Object.assign(shooter, { held: 'pulse', boost: 0, shield: 0, slow: 0, reaction: 0, cooldown: 0, decisionIn: 0 });
      qa.set({ pos: 125, lane: -4, speed: 0, slow: 0, shield: 0, held: null });
      Object.assign(shooter, { total: 100, lateral: 0, targetLane: 0 });
      Object.assign(other, { total: 115, lateral: 4, targetLane: 4, slow: 0 });
      arm(); qa.update(0);
      assert.equal(shooter.held, null); assert.equal(shooter.uses, 1);
      assert.equal(other.slow, 3, 'a closer NPC is selected instead of always attacking the player');
      assert.equal(game.getState().slow, 0);
      other.slow = 0; other.total = 130;
      qa.set({ pos: 110 }); arm(); qa.update(0);
      assert.equal(game.getState().slow, 3, 'the player is a valid nearest target');
      assert.equal(other.slow, 0); assert.equal(shooter.uses, 2);
      qa.set({ slow: 0, shield: 6 }); arm(); qa.update(0);
      assert.equal(shooter.held, 'pulse', 'NPC holds its pulse instead of firing at an active shield');
      assert.equal(game.getState().slow, 0); assert.equal(other.slow, 0); assert.equal(shooter.uses, 2);
      qa.set({ pos: length + 5, shield: 0, slow: 0 });
      shooter.total = length - 10; other.total = 300; arm(); qa.update(0);
      assert.equal(game.getState().slow, 3, 'forward targeting sees through the lap boundary');
      assert.equal(shooter.held, null); assert.equal(shooter.uses, 3);
      qa.set({ pos: 300, shield: 0, slow: 0 }); shooter.total = 100; other.total = 500;
      arm(); qa.update(0);
      assert.equal(shooter.held, 'pulse', 'NPC does not waste a pulse with no nearby forward target');
      assert.equal(shooter.boost, 0); assert.equal(shooter.uses, 3);
    });
    await t.test('player pulse shares nearest-target, shield-blocking and lap-relative rules', () => {
      race();
      const [nearest, farther] = parkBots(), length = game.getState().length;
      qa.set({ pos: 100, lane: 0, speed: 0, held: 'pulse', boost: 0 });
      Object.assign(nearest, { total: 115, shield: 6, slow: 0 });
      Object.assign(farther, { total: 130, slow: 0 });
      game.useItem();
      assert.equal(game.getState().held, null); assert.equal(game.getState().boost, 0);
      assert.equal(nearest.slow, 0, 'shield blocks the nearest target');
      assert.equal(farther.slow, 0, 'blocked pulses do not skip through to a farther target');
      qa.set({ pos: length - 10, held: 'pulse' }); nearest.total = length + 5; nearest.shield = 0;
      game.useItem(); assert.equal(nearest.slow, 3); assert.equal(farther.slow, 0);
      nearest.total = 500; farther.total = 650; nearest.slow = 0;
      qa.set({ pos: 100, held: 'pulse', boost: 0 }); game.useItem();
      assert.equal(game.getState().boost, 1.9, 'manual no-target pulse preserves the legacy boost fallback');
    });
    await t.test('all five NPCs earn and use items during an unassisted simulated race', () => {
      let seed = 0x71a5c0de;
      const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
      withRandom(random, () => {
        race();
        for (let frame = 0; frame < 60 * 60; frame++) qa.update(1 / 60);
        qa.draw(0);
      });
      assert.equal(game.getState().state, 'running');
      for (const bot of game.getState().bots) {
        assert.ok(bot.pickups > 0, `${bot.id} naturally steers to and wins a shared box: ${JSON.stringify(bot)}`);
        assert.ok(bot.uses > 0, `${bot.id} naturally finds a valid use for its earned item: ${JSON.stringify(bot)}`);
        assert.ok(bot.uses <= bot.pickups, 'AI never fabricates inventory');
        assert.ok(Number.isFinite(bot.total) && bot.total > 1000 && bot.total < game.getState().length * 3);
        assert.ok(Math.abs(bot.lateral) <= 5.2, 'lane planning keeps racers inside its safe road bounds');
      }
    });
    await t.test('NPC shield and boost decisions react to traffic instead of consuming on a fixed timer', () => {
      race();
      const [bot, traffic] = parkBots();
      qa.set({ pos: 0, lane: -5, speed: 0, held: null });
      Object.assign(bot, { total: 100, lateral: 0, targetLane: 0, speed: 36, held: 'shield', reaction: 0, cooldown: 0, decisionIn: 0 });
      qa.update(0);
      assert.equal(bot.held, 'shield'); assert.equal(bot.shield, 0); assert.equal(bot.uses, 0);
      qa.set({ pos: 80, held: 'pulse' }); bot.decisionIn = 0; qa.update(0);
      assert.equal(bot.held, null); assert.equal(bot.shield, 6); assert.equal(bot.uses, 1, 'nearby armed pursuer triggers a defensive shield');
      qa.draw(0); assert.equal(bot.fx.shield.enabled, true);
      qa.set({ pos: 0, held: null });
      Object.assign(bot, { held: 'boost', reaction: 0, cooldown: 0, decisionIn: 0, boost: 0 });
      Object.assign(traffic, { total: 110, lateral: 0, targetLane: 0 }); qa.update(0);
      assert.equal(bot.held, 'boost'); assert.equal(bot.boost, 0, 'NPC waits when a kart blocks the boost path');
      traffic.total = 150; bot.decisionIn = 0; qa.update(0);
      assert.equal(bot.held, null); assert.equal(bot.boost, 3.3); assert.equal(bot.uses, 2);
    });
    await t.test('boost and pulse slow alter real NPC travel with the shared bounded speed rules', () => {
      race();
      const [normal, boosted, slowed] = parkBots();
      qa.set({ pos: 0, lane: -5, speed: 0 });
      Object.assign(normal, { total: 200, speed: 40 });
      Object.assign(boosted, { total: 400, speed: 40, boost: 3.3 });
      Object.assign(slowed, { total: 600, speed: 40, slow: 3 });
      qa.update(.25);
      assert.ok(Math.abs((normal.total - 200) - 10) < 1e-6);
      assert.ok(Math.abs((boosted.total - 400) - 13.4) < 1e-6);
      assert.ok(Math.abs((slowed.total - 600) - 5.5) < 1e-6);
      assert.equal(boosted.boost, 3.05); assert.equal(slowed.slow, 2.75);
    });
    await t.test('pause freezes NPC decisions and native FX, then reset disposes effects immediately', () => {
      race();
      const [bot] = parkBots();
      qa.set({ pos: 0, lane: 0, speed: 0, held: 'shield', boost: 3, shield: 4, slow: 2 });
      Object.assign(bot, { total: 200, lateral: 0, targetLane: 0, held: 'pulse', speed: 36, boost: 3, shield: 4, slow: 2, decisionIn: .2, reaction: .4, cooldown: .8, pulseFlash: .6 });
      qa.draw(0);
      assert.equal(bot.fx.shield.enabled, true); assert.ok(bot.fx.flames.every(flame => flame.mesh.enabled));
      assert.equal(bot.fx.inventory.pulse.enabled, true);
      const fields = ['total', 'lateral', 'held', 'boost', 'shield', 'slow', 'bump', 'decisionIn', 'reaction', 'cooldown', 'pulseFlash', 'pickups', 'uses'];
      const snapshot = () => Object.fromEntries(fields.map(field => [field, bot[field]]));
      const before = snapshot(), elapsed = game.getState().elapsed;
      const effects = botFX(bot), transforms = effects.map(entity => ({
        position: entity.getLocalPosition().clone(), rotation: entity.getLocalRotation().clone(), scale: entity.getLocalScale().clone(), enabled: entity.enabled,
      }));
      game.pause(); qa.step(1);
      assert.deepEqual(snapshot(), before); assert.equal(game.getState().elapsed, elapsed);
      assert.equal(game.getState().boost, 3); assert.equal(game.getState().shield, 4); assert.equal(game.getState().slow, 2);
      effects.forEach((entity, index) => {
        assert.equal(entity.enabled, transforms[index].enabled);
        assert.ok(entity.getLocalPosition().equals(transforms[index].position), `${entity.name} position stays frozen`);
        assert.ok(entity.getLocalRotation().equals(transforms[index].rotation), `${entity.name} rotation stays frozen`);
        assert.ok(entity.getLocalScale().equals(transforms[index].scale), `${entity.name} animation stays frozen`);
      });
      game.pause(); qa.step(1 / 60);
      assert.ok(bot.total > before.total); assert.ok(bot.boost < before.boost); assert.ok(bot.reaction < before.reaction);
      const oldEffects = qa.bots().flatMap(botFX); game.start();
      assert.equal(game.getState().state, 'countdown'); assert.equal(game.getState().held, null); assertEmptyImage();
      assert.equal(game.getState().boost, 0); assert.equal(game.getState().shield, 0); assert.equal(game.getState().slow, 0);
      assert.equal(qa.world.shield.enabled, false); assert.ok(qa.world.flames.every(flame => !flame.mesh.enabled));
      for (const entity of oldEffects) assert.equal(entity.parent, null, 'reset destroys every independently parented old NPC effect');
      for (const newBot of qa.bots()) {
        assert.equal(newBot.held, null); assert.equal(newBot.boost, 0); assert.equal(newBot.shield, 0); assert.equal(newBot.slow, 0);
        assert.equal(newBot.pickups, 0); assert.equal(newBot.uses, 0); assertBotFXHidden(newBot);
      }
    });
    await t.test('finishing clears inventories and all combat FX before the next render', () => {
      race();
      const [bot] = parkBots();
      qa.set({ pos: game.getState().length * 3 - .1, lane: 0, speed: 42, held: 'pulse', boost: 3, shield: 4, slow: 0 });
      Object.assign(bot, { held: 'shield', boost: 3, shield: 4, slow: 2, pulseFlash: .6 }); qa.draw(0);
      assert.equal(bot.fx.shield.enabled, true); assert.equal(qa.world.shield.enabled, true);
      qa.update(.1);
      assert.equal(game.getState().state, 'finished'); assert.equal(game.getState().held, null); assertEmptyImage();
      assert.equal(game.getState().boost, 0); assert.equal(game.getState().shield, 0); assert.equal(game.getState().slow, 0);
      assert.equal(qa.world.shield.enabled, false); assert.ok(qa.world.flames.every(flame => !flame.mesh.enabled));
      for (const racer of qa.bots()) {
        assert.equal(racer.held, null);
        for (const field of ['boost', 'shield', 'slow', 'bump', 'pulseFlash', 'reaction', 'cooldown', 'decisionIn']) assert.equal(racer[field], 0, `${field} is cleared at finish`);
        assertBotFXHidden(racer);
      }
      const finished = game.getState(); qa.step(1);
      assert.equal(game.getState().elapsed, finished.elapsed); assert.equal(game.getState().pos, finished.pos);
      for (const racer of qa.bots()) assertBotFXHidden(racer);
    });
    await t.test('NPC shields prevent contact slowdown and unshielded contact has a bounded recovery timer', () => {
      race();
      const [bot] = parkBots();
      qa.set({ pos: 100, lane: 0, speed: 0, shield: 6 });
      Object.assign(bot, { total: 101, lateral: 0, targetLane: 0, shield: 0, slow: 0, bump: 0 });
      qa.update(0);
      assert.equal(bot.slow, .55); assert.equal(bot.bump, .8);
      Object.assign(bot, { shield: 6, slow: 0, bump: 0 }); qa.update(0);
      assert.equal(bot.slow, 0, 'active NPC shield prevents collision slowdown'); assert.equal(bot.bump, 0);
      qa.set({ pos: 0 }); bot.shield = 0; bot.slow = .55; bot.bump = .8; qa.update(1);
      assert.equal(bot.slow, 0); assert.equal(bot.bump, 0, 'unshielded contact immunity expires on the race clock');
    });
    await t.test('finish ranking preserves earlier NPC finishes and resolves crossing order within one frame', () => {
      race();
      const finish = game.getState().length * 3, [bot] = parkBots();
      qa.set({ pos: 0, lane: -5, speed: 0 });
      Object.assign(bot, { total: finish - 1, lateral: 4, targetLane: 4, speed: 40, held: 'shield', shield: 3, pulseFlash: .6 });
      qa.draw(0); qa.update(.1);
      assert.equal(bot.total, finish); assert.ok(Number.isFinite(bot.finishedAt)); assert.equal(game.getState().state, 'running');
      assert.equal(bot.held, null); assert.equal(bot.shield, 0); assertBotFXHidden(bot);
      const npcFinishTime = bot.finishedAt;
      qa.set({ pos: finish - .1, lane: -5, speed: 42 }); qa.update(.1);
      assert.equal(game.getState().state, 'finished'); assert.equal(game.getState().rank, 2, 'a finished NPC stays ahead when player reaches the cap');
      assert.equal(bot.finishedAt, npcFinishTime);
      for (const [playerDistance, botDistance, expectedRank] of [[1, 3, 1], [3, 1, 2]]) {
        race(); const [opponent] = parkBots();
        qa.set({ pos: finish - playerDistance, lane: -5, speed: 40 });
        Object.assign(opponent, { total: finish - botDistance, lateral: 4, targetLane: 4, speed: 40 });
        qa.update(.1);
        assert.equal(game.getState().state, 'finished');
        assert.equal(game.getState().rank, expectedRank, 'within-frame finish time decides order, rather than array order or capped distance');
      }
    });
    await t.test('repeated race resets and QA bot removal do not leak independent effect entities', () => {
      game.start();
      const entityCount = sceneEntities().length, renderCount = app.root.findComponents('render').length;
      for (let repeat = 0; repeat < 5; repeat++) {
        const oldActors = qa.bots().map(bot => bot.mesh), oldEffects = qa.bots().flatMap(botFX);
        game.start();
        assert.equal(qa.bots().length, 5); assert.equal(qa.controllers.size, 6);
        assert.equal(sceneEntities().length, entityCount); assert.equal(app.root.findComponents('render').length, renderCount);
        for (const entity of [...oldActors, ...oldEffects]) assert.equal(entity.parent, null);
        for (const bot of qa.bots()) assertBotFXHidden(bot);
      }
      const removedActors = qa.bots().map(bot => bot.mesh), removedEffects = qa.bots().flatMap(botFX);
      qa.set({ noBots: true });
      assert.equal(qa.bots().length, 0);
      for (const entity of [...removedActors, ...removedEffects]) assert.equal(entity.parent, null, 'QA bot removal also releases actors and their native effects');
      game.start();
      assert.equal(sceneEntities().length, entityCount); assert.equal(app.root.findComponents('render').length, renderCount);
      assert.equal(qa.controllers.size, 6);
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
      for (const pickup of qa.boxes()) { assert.ok(displays.includes(pickup.display)); if(pickup.dynamic)assertBoxHidden(pickup);else assertBoxVisible(pickup); }
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
    for (const button of touch) { button.emit('pointerdown', { pointerId: 1, preventDefault() {} }); assert.equal(qa.keys[button.dataset.key], true); button.emit('pointercancel', {pointerId: 1}); assert.equal(qa.keys[button.dataset.key], false); }
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
    // BFCache keeps the scene alive and paused. A true exit waits for outstanding
    // local reads/parses before destroying PlayCanvas, and never publishes stale UI.
    events.pagehide.forEach(fn=>fn({persisted:true}));assert.equal(game.getState().state,'paused');assert.ok(app.graphicsDevice);
    qa.set({state:'menu'});let finishRead:Function;const delayed=new Promise(resolve=>{finishRead=resolve});
    const leavingImport=game.importDrivers([{name:'custom.glb',size:importedBytes.byteLength,arrayBuffer:()=>delayed}]);
    const previousImportStatus=element('importStatus').textContent;
    const exitingPool=qa.boxes().filter(box=>box.dynamic);for(const box of exitingPool){box.mesh.enabled=true;box.cool=0;}
    events.pagehide.forEach(fn=>fn({persisted:false}));assert.ok(app.graphicsDevice,'in-flight work retains the parser app');exitingPool.forEach(assertBoxHidden);
    finishRead(importedBytes);const leavingResult=await leavingImport;
    assert.equal(leavingResult[0].value.status,'stale');assert.equal(element('importStatus').textContent,previousImportStatus);
    assert.equal(app.graphicsDevice,null,'last pending task closes the app exactly once');

  } finally {
    Math.random=originalRandom;g.location=previousLocation; console.error = originalConsoleError; globalThis.fetch = originalFetch; unlinkSync(copy); if(app.graphicsDevice)app.destroy();
    delete g.__testApp; delete g.__loadCourseAssets; delete g.__loadBundledDrivers;
  }
});
