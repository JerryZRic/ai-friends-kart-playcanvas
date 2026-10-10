import test from 'node:test';
import assert from 'node:assert/strict';
import {uiLayout, mountUiLayout, UI_DESIGN_WIDTH, UI_DESIGN_HEIGHT} from '../src/ui-layout';
import {garageLayout} from '../src/kart-garage-layout';
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('all game screens share one aspect and normalized placement across common and extreme displays', () => {
  for (const [w,h] of [[1280,720],[1366,768],[1920,1080],[1180,757],[2560,1080],[1024,768],[3840,2160],[390,844],[844,390]]) {
    const frame = uiLayout(w,h);
    assert.deepEqual(frame, garageLayout(w,h));
    near(frame.scale, Math.min(w/UI_DESIGN_WIDTH,h/UI_DESIGN_HEIGHT));
    near(frame.width/frame.height,1.6);
    near(frame.left*2+frame.width,w); near(frame.top*2+frame.height,h);
    for (const [x,y,width,height] of [[32,24,1376,72],[24,740,1392,136],[650,330,140,140]]) {
      const rendered = {x: frame.left+x*frame.scale, y: frame.top+y*frame.scale, width:width*frame.scale,height:height*frame.scale};
      near(rendered.width/rendered.height,width/height);
      near((rendered.x-frame.left)/frame.width,x/1440);
      assert.ok(rendered.x>=0&&rendered.y>=0&&rendered.x+rendered.width<=w+1e-8&&rendered.y+rendered.height<=h+1e-8);
    }
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
  f.root.style.setProperty('--ui-left', '7px', 'important');
  const handle = mountUiLayout(f.root, current => {
    assert.equal(f.root.style.getPropertyValue('--ui-scale'), String(current.scale));
    layouts.push(current.scale);
  }, f.window);
  assert.equal(f.attributes.get('data-fixed-layout'), '1440x900');
  assert.equal(f.root.style.getPropertyValue('--ui-design-width'), '1440px');
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
  assert.deepEqual([...f.properties], [['--ui-left', {value: '7px', priority: 'important'}]]);
  handle.update();
  assert.equal(layouts.length, 3, 'disposed handles never mutate the UI again');
});

test('repeated mounts dispose earlier listeners and fallback without visualViewport', () => {
  const f = fixture();
  const first = mountUiLayout(f.root, undefined, f.window);
  const second = mountUiLayout(f.root, undefined, f.window);
  assert.equal(f.host.count(), 2);
  assert.equal(f.viewport.count(), 2);
  first.dispose();
  assert.equal(f.attributes.get('data-fixed-layout'), '1440x900');
  second.dispose();
  assert.equal(f.properties.size, 0);
  Object.assign(f.host, {visualViewport: null, innerWidth: 1366, innerHeight: 768});
  const fallback = mountUiLayout(f.root, undefined, f.window);
  near(fallback.layout.scale, 768 / 900);
  fallback.dispose();
});


test('compact hint state follows actual logical scale and restores on unmount', () => {
  const f=fixture(); f.viewport.width=390; f.viewport.height=844;
  const handle=mountUiLayout(f.root,undefined,f.window);
  assert.equal(f.attributes.get('data-ui-compact'),'true');
  f.viewport.width=1280; f.viewport.height=720; handle.update();
  assert.equal(f.attributes.get('data-ui-compact'),'false');
  handle.dispose(); assert.equal(f.attributes.has('data-ui-compact'),false);
});

test('garage boot recovery fits before the module is available and relinquishes resize ownership', async () => {
  const {readFileSync} = await import('node:fs');
  const html = readFileSync('garage.html','utf8');
  const code = readFileSync('src/kart-garage.ts','utf8');
  assert.match(html, /Math\.min\(w\/1440,h\/900\)/);
  assert.match(html, /__garageBootLayout=\{release:release\}/);
  assert.match(code, /__garageBootLayout\?\.release\(\)/);
  assert.match(readFileSync('src/kart-garage-fixed.css','utf8'), /#kart-garage:has\(> \.garage-boot\) \{display: block\}/);
});
