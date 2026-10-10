import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GARAGE_DESIGN_WIDTH, GARAGE_DESIGN_HEIGHT, GARAGE_DIALOG_WIDTH, GARAGE_DIALOG_HEIGHT, garageLayout, garageDialogBounds, mountGarageLayout} from '../src/kart-garage-layout';

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const viewports = [[1280, 720], [1366, 768], [1920, 1080], [1180, 757], [390, 844], [844, 390], [320, 568], [2880, 1800]];

test('one 1440×900 composition is uniformly contained and centered at every viewport', () => {
  for (const [width, height] of viewports) {
    const frame = garageLayout(width, height);
    near(frame.scale, Math.min(width / 1440, height / 900));
    near(frame.width / frame.height, 1440 / 900);
    near(frame.width / GARAGE_DESIGN_WIDTH, frame.height / GARAGE_DESIGN_HEIGHT);
    near(frame.left * 2 + frame.width, width);
    near(frame.top * 2 + frame.height, height);
    assert.ok(frame.left >= -1e-8 && frame.top >= -1e-8);
    assert.ok(frame.left + frame.width <= width + 1e-8);
    assert.ok(frame.top + frame.height <= height + 1e-8);
    assert.ok(Math.abs(frame.width - width) < 1e-8 || Math.abs(frame.height - height) < 1e-8);
  }
});

test('slot icons, six-card tray, and preview preserve design proportions without rearrangement', () => {
  // The fixed CSS composition has 24px side insets, 48/64/456/216/56 rows,
  // 12px gaps, and 220/850/290px columns with 16px gaps.
  const controls = [
    {name: 'slot panel', x: 24, y: 136, width: 220, height: 456},
    {name: 'preview panel', x: 260, y: 136, width: 850, height: 456},
    {name: 'canvas', x: 263, y: 199, width: 844, height: 336},
    {name: 'performance panel', x: 1126, y: 136, width: 290, height: 456},
    {name: 'parts tray', x: 24, y: 604, width: 1392, height: 216},
    {name: 'actions', x: 24, y: 832, width: 1392, height: 56},
  ];
  for (const [width, height] of viewports) {
    const frame = garageLayout(width, height);
    for (const box of controls) {
      const rendered = {x: frame.left + box.x * frame.scale, y: frame.top + box.y * frame.scale, width: box.width * frame.scale, height: box.height * frame.scale};
      near(rendered.width / rendered.height, box.width / box.height);
      near((rendered.x - frame.left) / frame.width, box.x / GARAGE_DESIGN_WIDTH);
      near((rendered.y - frame.top) / frame.height, box.y / GARAGE_DESIGN_HEIGHT);
      assert.ok(rendered.x >= 0 && rendered.y >= 0, box.name);
      assert.ok(rendered.x + rendered.width <= width + 1e-8, box.name);
      assert.ok(rendered.y + rendered.height <= height + 1e-8, box.name);
    }
    near((72 * frame.scale) / frame.width, 72 / GARAGE_DESIGN_WIDTH);
  }
});

test('native top-layer dialogs use the exact same scale and fit inside every letterbox', () => {
  for (const [width, height] of viewports) {
    const layout = garageLayout(width, height), dialog = garageDialogBounds(layout);
    near(dialog.scale, layout.scale);
    near(dialog.width / dialog.height, GARAGE_DIALOG_WIDTH / GARAGE_DIALOG_HEIGHT);
    near(dialog.left + dialog.width / 2, width / 2);
    near(dialog.top + dialog.height / 2, height / 2);
    assert.ok(dialog.left >= layout.left && dialog.top >= layout.top);
    assert.ok(dialog.left + dialog.width <= layout.left + layout.width);
    assert.ok(dialog.top + dialog.height <= layout.top + layout.height);
  }
});

test('visual viewport offsets and keyboard height do not distort or clip controls', () => {
  const layout = garageLayout(390, 360, 16, 204), dialog = garageDialogBounds(layout);
  near(layout.centerX, 211);
  near(layout.centerY, 384);
  near(layout.left, 16);
  assert.ok(layout.top >= 204 && layout.top + layout.height <= 564);
  assert.ok(dialog.left >= 16 && dialog.left + dialog.width <= 406);
  assert.ok(dialog.top >= 204 && dialog.top + dialog.height <= 564);
  near(layout.width / layout.height, 1.6);
});

test('invalid viewport measurements recover to finite nonzero dimensions', () => {
  for (const width of [Number.NaN, Infinity, 0, -100]) {
    const layout = garageLayout(width, Number.NaN, Infinity, Number.NaN);
    assert.deepEqual(layout, garageLayout(GARAGE_DESIGN_WIDTH, GARAGE_DESIGN_HEIGHT));
  }
});

class FakeEvents {
  listeners = new Map<string, Set<() => void>>();
  addEventListener(name: string, fn: () => void) {if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name)!.add(fn);}
  removeEventListener(name: string, fn: () => void) {this.listeners.get(name)?.delete(fn);}
  fire(name: string) {for (const fn of this.listeners.get(name) || []) fn();}
  count() {return [...this.listeners.values()].reduce((total, callbacks) => total + callbacks.size, 0);}
}

function fixture() {
  const properties = new Map<string, {value: string; priority: string}>(), attributes = new Map<string, string>();
  const root = {
    getAttribute: (key: string) => attributes.get(key) ?? null,
    setAttribute: (key: string, value: string) => attributes.set(key, value),
    removeAttribute: (key: string) => attributes.delete(key),
    style: {
      getPropertyValue: (key: string) => properties.get(key)?.value ?? '',
      getPropertyPriority: (key: string) => properties.get(key)?.priority ?? '',
      setProperty: (key: string, value: string, priority = '') => properties.set(key, {value, priority}),
      removeProperty: (key: string) => properties.delete(key),
    },
  };
  const viewport = Object.assign(new FakeEvents(), {width: 1280, height: 720, offsetLeft: 0, offsetTop: 0});
  const host = Object.assign(new FakeEvents(), {
    visualViewport: viewport, innerWidth: 1280, innerHeight: 720, nextFrame: 1,
    frames: new Map<number, () => void>(),
    requestAnimationFrame(fn: () => void) {const id = this.nextFrame++; this.frames.set(id, fn); return id;},
    cancelAnimationFrame(id: number) {this.frames.delete(id);},
    flush() {const frames = [...this.frames.values()]; this.frames.clear(); for (const frame of frames) frame();},
  });
  return {root: root as unknown as HTMLElement, host, window: host as unknown as Window, viewport, properties, attributes};
}

test('mount applies scale before callback, coalesces all resize sources, and restores state', () => {
  const f = fixture(), layouts: number[] = [];
  f.root.style.setProperty('--garage-ui-left', '7px', 'important');
  const handle = mountGarageLayout(f.root, current => {
    assert.equal(f.root.style.getPropertyValue('--garage-ui-scale'), String(current.scale));
    layouts.push(current.scale);
  }, f.window);
  assert.equal(f.attributes.get('data-fixed-layout'), '1440x900');
  assert.equal(f.root.style.getPropertyValue('--garage-design-width'), '1440px');
  assert.deepEqual(layouts, [.8]);
  f.viewport.width = 1920; f.viewport.height = 1080;
  f.host.fire('resize'); f.host.fire('orientationchange'); f.viewport.fire('resize');
  assert.equal(f.host.frames.size, 1);
  f.host.flush();
  assert.deepEqual(layouts, [.8, 1.2]);
  near(handle.layout.scale, 1.2);
  f.host.fire('resize'); f.host.flush();
  assert.equal(layouts.length, 2, 'unchanged layout does not resize the renderer repeatedly');
  f.viewport.offsetTop = 40; f.viewport.fire('scroll'); f.host.flush();
  near(handle.layout.centerY, 580);
  assert.equal(layouts.length, 3);
  f.host.fire('resize');
  handle.dispose(); handle.dispose();
  assert.equal(f.host.frames.size, 0);
  assert.equal(f.host.count(), 0);
  assert.equal(f.viewport.count(), 0);
  assert.equal(f.attributes.has('data-fixed-layout'), false);
  assert.deepEqual([...f.properties], [['--garage-ui-left', {value: '7px', priority: 'important'}]]);
  handle.update();
  assert.equal(layouts.length, 3, 'disposed handles never mutate the UI again');
});

test('repeated mounts dispose earlier listeners and fallback without visualViewport', () => {
  const f = fixture();
  const first = mountGarageLayout(f.root, undefined, f.window);
  const second = mountGarageLayout(f.root, undefined, f.window);
  assert.equal(f.host.count(), 2);
  assert.equal(f.viewport.count(), 2);
  first.dispose();
  assert.equal(f.attributes.get('data-fixed-layout'), '1440x900');
  second.dispose();
  assert.equal(f.properties.size, 0);
  Object.assign(f.host, {visualViewport: null, innerWidth: 1366, innerHeight: 768});
  const fallback = mountGarageLayout(f.root, undefined, f.window);
  near(fallback.layout.scale, 768 / 900);
  fallback.dispose();
});

test('canonical stylesheet contains no viewport-driven reflow and gives dialogs explicit uniform scale', () => {
  const css = readFileSync('src/kart-garage-fixed.css', 'utf8');
  const media = [...css.matchAll(/@media\s*([^\{]+)\{/g)].map(match => match[1].trim());
  assert.deepEqual(media, ['(prefers-reduced-motion: reduce)', '(forced-colors: active)']);
  assert.doesNotMatch(css, /@import|\b\d+(?:\.\d+)?(?:vw|vh|svh|dvh|vmin|vmax)\b|scale[XY]\(/);
  assert.match(css, /grid-template-rows:\s*48px 64px minmax\(0, 1fr\) 216px 56px/);
  assert.match(css, /grid-template-columns:\s*220px minmax\(0, 1fr\) 290px/);
  assert.match(css, /#garage-slots\s*\{[^}]*grid-template-columns:\s*repeat\(2,[^}]*grid-template-rows:\s*repeat\(3,/);
  assert.match(css, /\.parts-grid\s*\{[^}]*grid-template-columns:\s*repeat\(6,/);
  assert.match(css, /\.workshop-dialog\s*\{[^}]*width:\s*820px;[^}]*height:\s*720px;[^}]*transform:\s*translate\(-50%, -50%\) scale\(var\(--garage-ui-scale, 1\)\)/);
  assert.match(css, /\.dialog-heading\s*\{[^}]*position:\s*sticky/);
});
