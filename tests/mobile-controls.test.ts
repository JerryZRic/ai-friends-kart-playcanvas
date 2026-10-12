import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveControlMode, touchHint} from '../src/mobile-controls';

test('touch detection uses device capabilities, with explicit hybrid overrides', () => {
  assert.equal(resolveControlMode('auto', 5, true), 'touch');
  assert.equal(resolveControlMode('auto', 0, true), 'desktop');
  assert.equal(resolveControlMode('auto', 10, false), 'desktop');
  assert.equal(resolveControlMode('auto', 10, false, true), 'touch');
  assert.equal(resolveControlMode('desktop', 5, true, true), 'desktop');
  assert.equal(resolveControlMode('touch', 0, false), 'touch');
});
test('mobile feedback converts real bindings without changing driving mechanics', () => {
  assert.equal(touchHint('按住 W 提速，再按左 Shift + A / D 持续转向蓄力'), '按住油门 提速，再按漂移 + 左右转向 持续转向蓄力');
  assert.equal(touchHint('松开 Shift 加速；左 Shift + A / D 水上滑移'), '松开 漂移 加速；漂移 + 左右转向 水上滑移');
});
test('idle mobile hint does not repeat the throttle label', () => {
  assert.equal(touchHint('按住 W 油门起步'), '按住油门起步');
});

import {mountMobileControls} from '../src/mobile-controls';
function mountFixture(saved = 'auto', touchPoints = 5, coarseMatches = true) {
  class Node extends EventTarget {
    value = ''; removed = false; dataset: Record<string, string> = {};
    remove() { this.removed = true; }
    appendChild(node: Node) { return node; }
  }
  const nodes = new Map(['mobileTouchControls', 'mobileControlModePanel', 'mobileControlMode'].map(id => [id, new Node()]));
  const canvas = new Node(), media = Object.assign(new EventTarget(), {matches: coarseMatches});
  const storage = new Map([['kart-control-mode', saved]]);
  const win = Object.assign(new EventTarget(), {navigator: {maxTouchPoints: touchPoints}, matchMedia: () => media, localStorage: {getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value)}});
  const body = new Node();
  const doc = Object.assign(new EventTarget(), {body, defaultView: win, getElementById: (id: string) => nodes.get(id)});
  const fire = (target: EventTarget, name: string, values = {}) => { const event = new Event(name); Object.assign(event, values); target.dispatchEvent(event); };
  return {doc, win, body, canvas, media, storage, nodes, fire, selector: nodes.get('mobileControlMode')!};
}
test('mount restores manual preference, reacts to media/touch and persists explicit overrides', () => {
  const f = mountFixture('desktop'); let changes = 0;
  f.doc.addEventListener('racecontrolmodechange', () => changes++);
  const mounted = mountMobileControls(f.doc as any, f.canvas as any)!;
  assert.equal(f.body.dataset.inputMode, 'desktop'); assert.equal(f.selector.value, 'desktop');
  f.fire(f.canvas, 'pointerdown', {pointerType: 'touch'});
  assert.equal(f.body.dataset.inputMode, 'desktop'); assert.equal(changes, 1);
  f.selector.value = 'auto'; f.fire(f.selector, 'change');
  assert.equal(f.body.dataset.inputMode, 'touch'); assert.equal(f.storage.get('kart-control-mode'), 'auto');
  f.selector.value = 'desktop'; f.fire(f.selector, 'change');
  f.media.matches = false; f.fire(f.media, 'change');
  assert.equal(f.body.dataset.inputMode, 'desktop');
  mounted.dispose(); mounted.dispose();
  assert.equal(f.body.dataset.inputMode, undefined);
  f.selector.value = 'touch'; f.fire(f.selector, 'change');
  f.fire(f.canvas, 'pointerdown', {pointerType: 'touch'});
  assert.equal(f.body.dataset.inputMode, undefined); assert.ok(f.nodes.get('mobileTouchControls')!.removed);
});
test('automatic mode updates on capability change and non-persisted pagehide cleans listeners', () => {
  const f = mountFixture('invalid', 5, false);
  mountMobileControls(f.doc as any, f.canvas as any);
  assert.equal(f.body.dataset.inputMode, 'desktop');
  f.media.matches = true; f.fire(f.media, 'change'); assert.equal(f.body.dataset.inputMode, 'touch');
  f.fire(f.win, 'pagehide', {persisted: true}); assert.equal(f.body.dataset.inputMode, 'touch');
  f.fire(f.win, 'pagehide', {persisted: false}); assert.equal(f.body.dataset.inputMode, undefined);
  f.media.matches = false; f.fire(f.media, 'change'); assert.equal(f.body.dataset.inputMode, undefined);
});
test('storage denial and headless consumers are safe', () => {
  assert.equal(mountMobileControls({} as any, {} as any), null);
  const f = mountFixture();
  f.win.localStorage.getItem = () => { throw new Error('Blocked'); };
  f.win.localStorage.setItem = () => { throw new Error('Blocked'); };
  const mounted = mountMobileControls(f.doc as any, f.canvas as any)!;
  assert.equal(f.body.dataset.inputMode, 'touch');
  f.selector.value = 'desktop'; f.fire(f.selector, 'change'); assert.equal(f.body.dataset.inputMode, 'desktop');
  mounted.dispose();
});
