import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {garageSpinDelta, garagePointerDelta, GARAGE_INTERACTION_IDLE_MS} from '../src/kart-garage-motion';
import {garageViewportSize} from '../src/kart-garage-stage';

/** Execute the real preview mount with isolated DOM/engine dependencies. Nothing
 * is written to disk or installed on globalThis, so parallel suites cannot
 * collide. These are lifecycle tests, not WebGL or browser-rendering tests. */
const source = readFileSync(new URL('../src/kart-garage.ts', import.meta.url), 'utf8');
const start = source.indexOf('export function mountKartGaragePreview(');
const end = source.indexOf('\nconst mountedGarages', start);
assert.ok(start >= 0 && end > start, 'the actual preview mount is available');
const mountSource = stripTypeScriptTypes(source.slice(start, end).replace('export function', 'function'));

function eventTarget<T extends object>(properties: T) {
  const listeners = new Map<string, Set<(event: any) => void>>();
  return Object.assign(properties, {
    addEventListener(type: string, listener: (event: any) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: (event: any) => void) {listeners.get(type)?.delete(listener);},
    emit(type: string, event: any = {}) {for (const listener of [...(listeners.get(type) || [])]) listener(event);},
    listenerCount() {return [...listeners.values()].reduce((sum, group) => sum + group.size, 0);},
  });
}

const settle = async () => {for (let i = 0; i < 8; i++) await Promise.resolve();};
const closeTo = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} should equal ${expected}`);

function harness({reducedMotion = false, deferredLoads = false} = {}) {
  let now = 0, nextFrame = 1, capturedPointer: number | null = null;
  const counts = {renders: 0, apps: 0, appDisposals: 0, stageDisposals: 0, observerDisconnections: 0};
  const frames = new Map<number, FrameRequestCallback>();
  const requestAnimationFrame = (callback: FrameRequestCallback) => {const id = nextFrame++; frames.set(id, callback); return id;};
  const cancelAnimationFrame = (id: number) => {frames.delete(id);};
  const step = (time: number) => {now = time; const callbacks = [...frames.values()]; frames.clear(); for (const callback of callbacks) callback(time);};
  const preference = eventTarget({matches: reducedMotion});
  const host = eventTarget({devicePixelRatio: 2, matchMedia: () => preference});
  const document = eventTarget({hidden: false});
  const button = {attributes: {} as Record<string, string>, textContent: '', setAttribute(name: string, value: string) {this.attributes[name] = value;}};
  const display = {width: 300, height: 150};
  const canvas = eventTarget({
    dataset: {} as Record<string, string>, attributes: {} as Record<string, string>, clientWidth: 600, clientHeight: 300,
    parentElement: {clientWidth: 600, clientHeight: 300, getBoundingClientRect: () => ({...display})},
    closest: () => ({querySelector: () => button}),
    setAttribute(name: string, value: string) {this.attributes[name] = value;},
    getBoundingClientRect: () => ({...display}),
    setPointerCapture(pointer: number) {capturedPointer = pointer;},
    hasPointerCapture(pointer: number) {return capturedPointer === pointer;},
    releasePointerCapture(pointer: number) {capturedPointer = null; canvas.emit('lostpointercapture', {pointerId: pointer});},
  });
  const rotations: number[] = [], fits: {aspect: number; pitch: number; zoom: number}[] = [];
  const attached: unknown[] = [], statuses: {stage: string}[] = [];
  const cssSizes: number[][] = [], resolutions: unknown[][] = [];
  const devices: {maxPixelRatio?: number}[] = [];
  class Application {
    graphicsDevice: {maxPixelRatio?: number} = {};
    root = {enabled: true, addChild() {}};
    frameRequestId: number | null = null;
    constructor() {counts.apps++; devices.push(this.graphicsDevice);}
    setCanvasFillMode() {}
    setCanvasResolution(...args: unknown[]) {resolutions.push(args);}
    resizeCanvas(width: number, height: number) {cssSizes.push([width, height]);}
    start() {this.frameRequestId = requestAnimationFrame(() => assert.fail('the engine frame loop must be canceled'));}
    update() {}
    render() {counts.renders++;}
    fire() {}
    destroy() {counts.appDisposals++;}
  }
  class Entity {camera = {}; addComponent() {} setPosition() {} lookAt() {}}
  class ResizeObserver {observe() {} disconnect() {counts.observerDisconnections++;}}
  type Model = {root: object; bounds: object; disposals: number; dispose(): void};
  const models: Model[] = [];
  const loads: {signal: AbortSignal; resolve: () => void; promise: Promise<Model>}[] = [];
  const createKartAssemblyLoader = () => {
    const ownLoads: Promise<Model>[] = [];
    return {
      load(_build: unknown, {signal}: {signal: AbortSignal}) {
        let finish!: (model: Model) => void, resolved = false;
        const promise = new Promise<Model>(resolve => {finish = resolve;});
        const resolve = () => {
          if (resolved) return;
          resolved = true;
          const model: Model = {root: {}, bounds: {}, disposals: 0, dispose() {this.disposals++;}};
          models.push(model); finish(model);
        };
        ownLoads.push(promise); loads.push({signal, resolve, promise});
        if (!deferredLoads) resolve();
        return promise;
      },
      async dispose() {await Promise.allSettled(ownLoads);},
    };
  };
  const dependencies = {
    pc: {Application, Entity, math: {clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))}, FILLMODE_NONE: 'none', RESOLUTION_FIXED: 'fixed'},
    resolveBuild: (build: unknown) => build, readGameSettings: () => ({quality: 'high'}),
    garageSpinDelta, garagePointerDelta, GARAGE_INTERACTION_IDLE_MS, garageViewportSize,
    window: host, document, requestAnimationFrame, cancelAnimationFrame, performance: {now: () => now},
    createKartAssemblyLoader,
    createKartGarageStage: () => ({rotate(yaw: number) {rotations.push(yaw);}, attach(root: unknown) {attached.push(root);}, dispose() {counts.stageDisposals++;}}),
    garageStageCamera(_bounds: unknown, aspect: number, pitch: number, zoom: number) {fits.push({aspect, pitch, zoom}); return {position: {}, target: {}, fov: 34, nearClip: .01, farClip: 100};},
    GARAGE_CLEAR_COLOR: {}, ResizeObserver,
  };
  const mount = new Function(...Object.keys(dependencies), `${mountSource}; return mountKartGaragePreview;`)(...Object.values(dependencies));
  const preview = mount(canvas, (status: {stage: string}) => statuses.push(status), {});
  return {
    preview, counts, frames, step, preference, host, document, button, canvas, display, rotations, fits, attached, statuses, cssSizes, resolutions, devices, models, loads,
    get yaw() {return rotations.at(-1)!;},
    get listeners() {return canvas.listenerCount() + host.listenerCount() + document.listenerCount() + preference.listenerCount();},
    async cleanup() {preview.dispose(); for (const load of loads) load.resolve(); await settle();},
  };
}

test('mounted preview spins slowly, scales drag input and resumes only after interaction idle', async t => {
  const h = harness(); t.after(() => h.cleanup()); await settle();
  assert.equal(h.preview.ready, true);
  h.step(0); h.step(16); closeTo(h.yaw, 36.128);
  h.canvas.emit('pointerdown', {button: 0, pointerId: 1, clientX: 0, clientY: 0});
  h.step(32); closeTo(h.yaw, 36.128);
  h.canvas.emit('pointermove', {pointerId: 1, clientX: 10, clientY: 5});
  closeTo(h.yaw, 45.128); closeTo(h.fits.at(-1)!.pitch, 24.5);
  h.step(48); h.canvas.emit('pointerup', {pointerId: 1});
  h.step(3547); closeTo(h.yaw, 45.128);
  h.step(3548); closeTo(h.yaw, 45.128);
  h.step(3564); closeTo(h.yaw, 45.256);
  h.canvas.emit('keydown', {key: 'ArrowRight', preventDefault() {}});
  closeTo(h.yaw, 57.256); h.step(7064); closeTo(h.yaw, 57.256);
  h.step(7080); closeTo(h.yaw, 57.384);
  h.canvas.emit('wheel', {deltaY: 100, preventDefault() {}});
  closeTo(h.fits.at(-1)!.zoom, 1.1); h.step(10580); closeTo(h.yaw, 57.384);
  h.step(10596); closeTo(h.yaw, 57.512);
  h.preview.reset(); closeTo(h.yaw, 36); closeTo(h.fits.at(-1)!.zoom, 1);
  h.step(14096); closeTo(h.yaw, 36); h.step(14112); closeTo(h.yaw, 36.128);
});

test('mounted preview honors reduced motion and OS changes never undo explicit Pause', async t => {
  const h = harness({reducedMotion: true}); t.after(() => h.cleanup()); await settle();
  h.step(0); assert.equal(h.frames.size, 0); assert.equal(h.button.attributes['aria-pressed'], 'false');
  h.preference.matches = false; h.preference.emit('change'); h.step(16); h.step(32);
  closeTo(h.yaw, 36.128); assert.equal(h.button.attributes['aria-pressed'], 'true');
  h.preview.toggleSpin(); h.step(48);
  assert.equal(h.frames.size, 0); assert.equal(h.button.attributes['aria-pressed'], 'false');
  h.preference.matches = true; h.preference.emit('change'); h.step(64);
  h.preference.matches = false; h.preference.emit('change'); h.step(80);
  assert.equal(h.frames.size, 0); assert.equal(h.button.attributes['aria-pressed'], 'false'); closeTo(h.yaw, 36.128);
  h.preview.toggleSpin(); h.step(96); h.step(112); closeTo(h.yaw, 36.256);
  h.preference.matches = true; h.preference.emit('change'); h.step(128);
  assert.equal(h.frames.size, 0); closeTo(h.yaw, 36.256);
});

test('mounted preview cancels hidden/context-lost frames and fully cleans up after recovery', async t => {
  const h = harness(); t.after(() => h.cleanup()); await settle(); h.step(0); h.step(16);
  h.canvas.emit('pointerdown', {button: 0, pointerId: 1, clientX: 0, clientY: 0});
  assert.equal(h.canvas.hasPointerCapture(1), true);
  h.document.hidden = true; h.document.emit('visibilitychange'); assert.equal(h.frames.size, 0);
  assert.equal(h.canvas.hasPointerCapture(1), false, 'hiding mid-drag releases capture without waiting for pointerup');
  h.step(9999); closeTo(h.yaw, 36.128);
  h.document.hidden = false; h.document.emit('visibilitychange'); h.step(9999); closeTo(h.yaw, 36.128);
  h.step(10015); closeTo(h.yaw, 36.256);
  h.canvas.emit('pointerdown', {button: 0, pointerId: 2, clientX: 0, clientY: 0});
  h.canvas.emit('webglcontextlost', {preventDefault() {}});
  assert.equal(h.canvas.hasPointerCapture(2), false, 'context loss clears an interrupted drag');
  assert.equal(h.frames.size, 0); assert.equal(h.preview.ready, false); assert.equal(h.loads[0].signal.aborted, true);
  h.canvas.emit('webglcontextrestored'); await settle();
  assert.equal(h.preview.ready, true); h.step(20000); closeTo(h.yaw, 36.256);
  h.step(20016); closeTo(h.yaw, 36.384);
  h.canvas.emit('pointerdown', {button: 0, pointerId: 3, clientX: 0, clientY: 0});
  h.preview.dispose(); h.preview.dispose(); await settle();
  assert.equal(h.canvas.hasPointerCapture(3), false, 'disposal releases capture before removing listeners');
  assert.equal(h.frames.size, 0); assert.equal(h.listeners, 0);
  assert.deepEqual(h.models.map(model => model.disposals), [1, 1]);
  assert.equal(h.counts.appDisposals, 1); assert.equal(h.counts.stageDisposals, 1); assert.equal(h.counts.observerDisconnections, 1);
  const renders = h.counts.renders; h.step(30000); assert.equal(h.counts.renders, renders);
});

test('mounted preview passes display-space resolution to the engine and retains logical CSS size', async t => {
  const h = harness(); t.after(() => h.cleanup()); await settle();
  assert.deepEqual(h.cssSizes.at(-1), [600, 300]);
  assert.deepEqual(h.resolutions.at(-1), ['fixed', 300, 150]);
  assert.equal(h.devices[0].maxPixelRatio, 1.5, 'the engine applies this cap once');
  h.display.width = 150; h.display.height = 75; h.preview.resize();
  assert.deepEqual(h.cssSizes.at(-1), [600, 300]);
  assert.deepEqual(h.resolutions.at(-1), ['fixed', 150, 75]);
  assert.equal(h.fits.at(-1)!.aspect, 2);
});

test('mounted preview discards stale loads and waits for pending cleanup before destroying the engine', async t => {
  const h = harness({deferredLoads: true}); t.after(() => h.cleanup());
  const newer = h.preview.select({selection: 'newer'});
  assert.equal(h.loads[0].signal.aborted, true);
  h.loads[0].resolve(); await settle();
  assert.equal(h.models[0].disposals, 1); assert.equal(h.attached.length, 0);
  h.preview.dispose(); assert.equal(h.loads[1].signal.aborted, true);
  assert.equal(h.counts.appDisposals, 0, 'engine remains alive while the loader is cleaning up');
  const statusCount = h.statuses.length;
  h.loads[1].resolve(); await newer; await settle();
  assert.equal(h.models[1].disposals, 1); assert.equal(h.attached.length, 0);
  assert.equal(h.statuses.length, statusCount, 'late completion cannot publish ready status');
  assert.equal(h.counts.appDisposals, 1); assert.equal(h.frames.size, 0); assert.equal(h.listeners, 0);
});
