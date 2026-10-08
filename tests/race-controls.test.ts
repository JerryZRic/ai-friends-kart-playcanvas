import assert from 'node:assert/strict';
import test from 'node:test';
import {bindRaceControls, type RaceControlState} from '../src/race-controls';
import {driveInput} from '../src/vehicle-controls.js';

class BrowserTarget extends EventTarget {
  dataset: Record<string, string> = {};
  captured = new Set<number>();
  hidden = false;
  pointerLockElement: BrowserTarget | null = null;
  requestPointerLock?: () => void | Promise<void>;
  constructor(public tagName = '') { super(); }
  closest(selector: string) {
    return selector.split(',').some(tag => tag.toUpperCase() === this.tagName || (tag === '[contenteditable]' && this.tagName === 'EDITABLE')) ? this : null;
  }
  setPointerCapture(id: number) { this.captured.add(id); }
  hasPointerCapture(id: number) { return this.captured.has(id); }
  releasePointerCapture(id: number) { this.captured.delete(id); fire(this, 'lostpointercapture', {pointerId: id}); }
  querySelectorAll() { return []; }
  exitPointerLock() { this.pointerLockElement = null; fire(this, 'pointerlockchange'); }
}
function fire(target: EventTarget, type: string, values: Record<string, unknown> = {}) {
  const event = new Event(type, {cancelable: true});
  for (const [key, value] of Object.entries(values)) Object.defineProperty(event, key, {value, configurable: true});
  target.dispatchEvent(event); return event;
}
function fixture({lock = 'missing', signal}: {lock?: 'missing' | 'pending' | 'reject'; signal?: AbortSignal} = {}) {
  const doc = new BrowserTarget(), win = new BrowserTarget(), canvas = new BrowserTarget('CANVAS');
  const throttle = new BrowserTarget('BUTTON'), brake = new BrowserTarget('BUTTON'), rear = new BrowserTarget('BUTTON');
  throttle.dataset.key = 'KeyW'; brake.dataset.key = 'Space'; rear.dataset.key = 'RearView';
  let state: RaceControlState = 'active';
  const calls = {pause: 0, item: 0, camera: 0, recenter: 0, start: 0, clear: 0, lock: 0, status: [] as string[]};
  if (lock !== 'missing') canvas.requestPointerLock = () => { calls.lock++; if (lock === 'reject') return Promise.reject(new Error('Denied')); };
  const controls = bindRaceControls(canvas as any, {
    document: doc as any, window: win as any, buttons: [throttle, brake, rear] as any, signal,
    state: () => state,
    pause: () => { calls.pause++; state = state === 'paused' ? 'active' : 'paused'; },
    useItem: () => { if (state === 'active') calls.item++; },
    switchCamera: () => { calls.camera++; }, recenter: () => { calls.recenter++; },
    start: () => { calls.start++; state = 'active'; },
    onClear: () => { calls.clear++; }, status: value => { calls.status.push(value); },
  });
  const key = (type: 'keydown' | 'keyup', code: string, other: Record<string, unknown> = {}) => fire(win, type, {code, target: canvas, repeat: false, ...other});
  const pointer = (target: BrowserTarget, type: string, id = 1, other: Record<string, unknown> = {}) => fire(target, type, {pointerId: id, pointerType: 'touch', button: 0, ...other});
  const left = () => pointer(canvas, 'pointerdown', 10, {pointerType: 'mouse', clientX: 100, clientY: 100});
  return {doc, win, canvas, throttle, brake, rear, calls, controls, key, pointer, left, state: () => state, setState: (next: RaceControlState) => { state = next; }};
}

test('real event bindings unify physical keyboard codes, arrows, brake and both Shift keys', () => {
  const f = fixture();
  assert.equal(Object.getPrototypeOf(f.controls.keys), Object.prototype);
  for (const code of ['KeyW', 'KeyD', 'ShiftRight']) assert.ok(f.key('keydown', code).defaultPrevented);
  assert.deepEqual(driveInput(f.controls.keys), {steer: 1, throttle: true, reverse: false, brake: false, handbrake: true, rearView: false});
  f.key('keyup', 'KeyW'); f.key('keydown', 'ArrowDown'); f.key('keydown', 'Space');
  assert.ok(driveInput(f.controls.keys).reverse); assert.ok(driveInput(f.controls.keys).brake);
  f.key('keydown', 'ShiftLeft'); f.key('keyup', 'ShiftRight'); assert.ok(driveInput(f.controls.keys).handbrake);
  f.key('keydown', '', {key: 'a'}); assert.equal(f.controls.keys.KeyA, true);
  f.controls.dispose();
});

test('keyboard and multiple touch pointers remain independent in both release orders', () => {
  const f = fixture();
  f.key('keydown', 'KeyW'); f.pointer(f.throttle, 'pointerdown', 1); f.pointer(f.throttle, 'pointerdown', 2);
  f.key('keyup', 'KeyW'); assert.equal(f.controls.keys.KeyW, true);
  f.pointer(f.throttle, 'pointerup', 1); assert.equal(f.controls.keys.KeyW, true);
  f.pointer(f.throttle, 'lostpointercapture', 2); assert.equal(f.controls.keys.KeyW, false);
  f.key('keydown', 'Space'); f.pointer(f.brake, 'pointerdown', 3); f.pointer(f.brake, 'pointercancel', 3);
  assert.equal(f.controls.keys.Space, true); f.key('keyup', 'Space'); assert.equal(f.controls.keys.Space, false);
  f.pointer(f.throttle, 'pointerdown', 5, {pointerType: 'mouse', button: 2}); assert.equal(f.controls.keys.KeyW, false);
  f.controls.dispose();
});

test('native forms retain their keys and focused buttons retain Space and Enter', () => {
  const f = fixture();
  for (const tag of ['INPUT', 'SELECT', 'TEXTAREA', 'EDITABLE']) {
    const target = new BrowserTarget(tag);
    for (const code of ['KeyW', 'ArrowDown', 'Space', 'Escape', 'KeyP', 'KeyE']) assert.equal(f.key('keydown', code, {target}).defaultPrevented, false);
  }
  assert.equal(f.calls.pause, 0); assert.equal(f.calls.item, 0); assert.equal(f.controls.keys.KeyW, undefined);
  const button = new BrowserTarget('BUTTON');
  assert.equal(f.key('keydown', 'Space', {target: button}).defaultPrevented, false);
  assert.equal(f.key('keydown', 'Enter', {target: button}).defaultPrevented, false);
  f.key('keydown', 'KeyW'); f.key('keyup', 'KeyW', {target: button}); assert.equal(f.controls.keys.KeyW, false);
  f.setState('menu');
  for (const code of ['ArrowDown', 'KeyW', 'KeyE', 'Enter']) assert.equal(f.key('keydown', code, {target: button}).defaultPrevented, false);
  assert.equal(f.calls.start, 0);
  f.setState('paused');
  for (const code of ['ArrowDown', 'KeyW', 'Space', 'Enter']) assert.equal(f.key('keydown', code, {target: button}).defaultPrevented, false);
  f.key('keydown', 'Escape', {target: button}); assert.equal(f.state(), 'paused');
  f.key('keydown', 'KeyP', {target: button}); assert.equal(f.state(), 'active', 'P still resumes a focused pause dialog');
  f.setState('menu'); f.key('keydown', 'Enter'); assert.equal(f.calls.start, 1);
  f.controls.dispose();
});

test('single-shot actions suppress repeat; P toggles while Escape never resumes', () => {
  const f = fixture();
  f.controls.orbit.move(100, 100); f.controls.orbit.step(.1);
  for (const code of ['KeyE', 'KeyZ', 'KeyC', 'KeyQ']) { f.key('keydown', code); f.key('keydown', code, {repeat: true}); }
  assert.equal(f.calls.item, 1); assert.equal(f.calls.camera, 2); assert.equal(f.calls.recenter, 1);
  assert.equal(f.controls.orbit.get().targetPitch, 0);
  f.key('keydown', 'KeyW'); f.pointer(f.throttle, 'pointerdown');
  f.key('keydown', 'KeyP'); assert.equal(f.state(), 'paused'); assert.equal(f.controls.keys.KeyW, false);
  assert.equal(f.throttle.captured.size, 0);
  f.key('keydown', 'KeyP', {repeat: true}); assert.equal(f.calls.pause, 1);
  f.key('keydown', 'Escape'); assert.equal(f.calls.pause, 1);
  f.key('keydown', 'KeyP'); assert.equal(f.state(), 'active');
  f.key('keydown', 'Escape'); f.key('keydown', 'Escape'); assert.equal(f.calls.pause, 3); assert.equal(f.state(), 'paused');
  f.controls.dispose();
});

test('blur, hidden document, and pagehide clear every input source and only pause active races', () => {
  for (const interruption of ['blur', 'visibilitychange', 'pagehide']) {
    const f = fixture();
    f.key('keydown', 'KeyW'); f.pointer(f.brake, 'pointerdown', 2);
    f.pointer(f.canvas, 'pointerdown', 3, {pointerType: 'mouse', button: 2});
    if (interruption === 'visibilitychange') { f.doc.hidden = false; fire(f.doc, interruption); assert.equal(f.calls.pause, 0); f.doc.hidden = true; }
    fire(interruption === 'visibilitychange' ? f.doc : f.win, interruption);
    assert.equal(f.calls.pause, 1); assert.equal(f.state(), 'paused');
    assert.ok(Object.values(f.controls.keys).every(value => value === false));
    fire(interruption === 'visibilitychange' ? f.doc : f.win, interruption); assert.equal(f.calls.pause, 1);
    f.setState('active'); f.key('keydown', 'KeyW'); f.key('keyup', 'KeyW');
    assert.equal(f.controls.keys.KeyW, false, 'interruption must discard internal touch sources too');
    f.controls.dispose();
  }
});

test('right mouse view supports chorded mouse release, pointer recovery and independent rear touch', () => {
  const f = fixture();
  f.pointer(f.canvas, 'pointerdown', 10, {pointerType: 'mouse', button: 2}); assert.equal(f.controls.keys.RearView, true);
  fire(f.doc, 'mouseup', {button: 0}); assert.equal(f.controls.keys.RearView, true);
  fire(f.doc, 'mouseup', {button: 2}); assert.equal(f.controls.keys.RearView, false);
  fire(f.canvas, 'mousedown', {button: 2}); assert.equal(f.controls.keys.RearView, true);
  f.pointer(f.canvas, 'pointermove', 10, {pointerType: 'mouse', buttons: 1}); assert.equal(f.controls.keys.RearView, false);
  f.pointer(f.rear, 'pointerdown', 4); fire(f.canvas, 'mousedown', {button: 2}); fire(f.doc, 'mouseup', {button: 2});
  assert.equal(f.controls.keys.RearView, true);
  f.pointer(f.rear, 'lostpointercapture', 4); assert.equal(f.controls.keys.RearView, false);
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    fire(f.canvas, 'mousedown', {button: 2}); f.pointer(f.canvas, event, 10); assert.equal(f.controls.keys.RearView, false);
  }
  f.controls.dispose();
});

test('shared drag fallback suppresses rear-view movement and resumes without an orbit jump', async () => {
  const f = fixture({lock: 'reject'});
  f.left(); await Promise.resolve(); assert.equal(f.controls.mouseLook.get().fallback, true);
  f.left();
  f.pointer(f.canvas, 'pointermove', 10, {pointerType: 'mouse', buttons: 1, clientX: 110, clientY: 110});
  assert.ok(Math.abs(f.controls.orbit.get().targetYaw - .03) < 1e-12);
  f.pointer(f.canvas, 'pointermove', 10, {pointerType: 'mouse', buttons: 3, clientX: 300, clientY: 200});
  assert.ok(Math.abs(f.controls.orbit.get().targetYaw - .03) < 1e-12);
  f.pointer(f.canvas, 'pointermove', 10, {pointerType: 'mouse', buttons: 1, clientX: 300, clientY: 200});
  assert.ok(Math.abs(f.controls.orbit.get().targetYaw - .03) < 1e-12);
  f.pointer(f.canvas, 'pointermove', 10, {pointerType: 'mouse', buttons: 1, clientX: 310, clientY: 200});
  assert.ok(Math.abs(f.controls.orbit.get().targetYaw - .06) < 1e-12);
  f.pointer(f.canvas, 'lostpointercapture', 10); assert.equal(f.controls.mouseLook.get().dragging, false);
  f.controls.dispose();
});

test('browser lock loss pauses once; a paused surface click resumes and reacquires', () => {
  const f = fixture({lock: 'pending'});
  f.left(); f.left(); assert.equal(f.calls.lock, 1);
  f.doc.pointerLockElement = f.canvas; fire(f.doc, 'pointerlockchange');
  fire(f.doc, 'mousemove', {movementX: 20, movementY: 10}); assert.ok(f.controls.orbit.get().targetYaw > 0);
  f.doc.exitPointerLock(); assert.equal(f.calls.pause, 1); assert.equal(f.state(), 'paused');
  fire(f.doc, 'pointerlockchange'); assert.equal(f.calls.pause, 1);
  f.left(); assert.equal(f.state(), 'active'); assert.equal(f.calls.lock, 2);
  f.controls.dispose();
  f.doc.pointerLockElement = f.canvas; fire(f.doc, 'pointerlockchange');
  assert.equal(f.doc.pointerLockElement, null, 'late lock success must be released even after disposal');
  assert.equal(f.calls.pause, 2);
});

test('dispose and external abort detach all gameplay listeners and clear held keys', () => {
  for (const abort of [false, true]) {
    const signal = new AbortController(), f = fixture({signal: signal.signal});
    f.left(); f.key('keydown', 'KeyW');
    if (abort) signal.abort(); else f.controls.dispose();
    const counts = {...f.calls, status: [...f.calls.status]}, angles = f.controls.orbit.get();
    f.key('keydown', 'KeyW'); f.key('keydown', 'KeyE'); f.key('keydown', 'KeyP'); f.left();
    fire(f.win, 'blur'); fire(f.win, 'pagehide');
    f.pointer(f.throttle, 'pointerdown');
    fire(f.doc, 'mousemove', {movementX: 100, movementY: 100});
    assert.equal(f.controls.keys.KeyW, false); assert.deepEqual(f.calls, counts); assert.deepEqual(f.controls.orbit.get(), angles);
    f.controls.dispose(); assert.deepEqual(f.calls, counts);
  }
});
