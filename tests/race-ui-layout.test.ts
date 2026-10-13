import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mountRaceUiLayout, disposeRaceUiLayout } from '../src/race-ui-layout';
import { createRaceShell } from '../src/race-shell';
import { UI_DESIGN_WIDTH, UI_DESIGN_HEIGHT } from '../src/ui-layout';

function fixture(width = 1440, height = 900) {
  class Target {
    listeners = new Map<string, Set<Function>>();
    addEventListener(type: string, listener: Function) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type)!.add(listener);
    }
    removeEventListener(type: string, listener: Function) { this.listeners.get(type)?.delete(listener); }
    emit(type: string, event: unknown = {}) { for (const listener of this.listeners.get(type) || []) listener(event); }
    count(type: string) { return this.listeners.get(type)?.size || 0; }
  }
  const frames = new Map<number, FrameRequestCallback>(); let frameId = 0;
  const visualViewport = Object.assign(new Target(), { width, height, offsetLeft: 0, offsetTop: 0 });
  const host = Object.assign(new Target(), {
    innerWidth: width, innerHeight: height, visualViewport,
    requestAnimationFrame(callback: FrameRequestCallback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id: number) { frames.delete(id); },
  });
  class Element {
    id: string; children: Element[] = []; parentElement: Element | null = null;
    attrs = new Map<string, string>(); classes = new Set<string>(); className = ''; textContent = ''; hidden = false;
    width = 260; height = 230; ownerDocument: typeof doc;
    classList = { add: (value: string) => this.classes.add(value) };
    props = new Map<string, string>();
    style = {
      getPropertyValue: (name: string) => this.props.get(name) || '', getPropertyPriority: () => '',
      setProperty: (name: string, value: string) => this.props.set(name, value), removeProperty: (name: string) => this.props.delete(name),
    };
    constructor(id: string) { this.id = id; }
    getAttribute(name: string) { return this.attrs.get(name) ?? null; }
    setAttribute(name: string, value: string) { this.attrs.set(name, value); }
    removeAttribute(name: string) { this.attrs.delete(name); }
    appendChild(child: Element) { child.remove(); child.parentElement = this; this.children.push(child); return child; }
    insertBefore(child: Element, reference: Element) {
      child.remove(); child.parentElement = this;
      const index = this.children.indexOf(reference);
      assert.ok(index >= 0, 'reference exists in the physical body'); this.children.splice(index, 0, child);
      return child;
    }
    remove() {
      if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
      this.parentElement = null;
    }
  }
  const elements = new Map<string, Element>();
  const doc = { defaultView: host, getElementById: (id: string) => elements.get(id) || null,
    createElement: (tag: string) => make(tag), body: undefined as unknown as Element };
  function make(id: string) { const element = new Element(id); element.ownerDocument = doc; elements.set(id, element); return element; }
  doc.body = make('body');
  const root = make('raceUi'), hud = make('raceHud'), canvas = make('game'), vignette = make('vignette'), minimap = make('map');
  canvas.width = 2880; canvas.height = 1800;
  doc.body.appendChild(root); root.appendChild(hud); hud.appendChild(canvas); hud.appendChild(vignette); hud.appendChild(minimap);
  root.appendChild(make('raceLoading')); root.appendChild(make('overlay'));
  return {doc: doc as unknown as Document, host, visualViewport, root, hud, canvas, vignette, minimap,
    resize(width: number, height: number) { host.innerWidth = visualViewport.width = width; host.innerHeight = visualViewport.height = height; host.emit('resize'); },
    flush() { for (const [id, callback] of frames) { frames.delete(id); callback(0); } },
    notices: () => doc.body.children.filter(child => child.className === 'ui-viewport-notice'),
  };
}

test('race layout moves only physical rendering layers outside the shared design plane', () => {
  const f = fixture();
  const mount = mountRaceUiLayout(f.doc, f.canvas as unknown as HTMLCanvasElement)!;
  assert.equal(f.canvas.parentElement, f.doc.body); assert.equal(f.vignette.parentElement, f.doc.body);
  assert.equal(f.hud.parentElement, f.root); assert.equal(f.minimap.parentElement, f.hud);
  assert.equal(f.doc.getElementById('raceLoading')!.parentElement, f.root);
  assert.equal(f.doc.getElementById('overlay')!.parentElement, f.root);
  assert.equal(f.root.getAttribute('data-fixed-layout'), '1440x900');
  assert.equal(f.root.props.get('--ui-design-width'), `${UI_DESIGN_WIDTH}px`);
  assert.equal(f.root.props.get('--ui-design-height'), `${UI_DESIGN_HEIGHT}px`);
  assert.equal(f.canvas.width, 2880); assert.equal(f.canvas.height, 1800);
  assert.equal(f.minimap.width, 260); assert.equal(f.minimap.height, 230);
  assert.equal(f.canvas.props.size, 0, 'no UI scaling can change render resolution or canvas transforms');
  assert.ok(f.root.classes.has('fixed-ui-root'));
  assert.equal(f.notices().length, 1);
  mount.dispose(); assert.equal(f.notices().length, 0);
});

test('race design remains proportional after resize, orientation and visual-viewport movement', () => {
  const f = fixture(), mount = mountRaceUiLayout(f.doc, f.canvas as unknown as HTMLCanvasElement)!;
  for (const [width, height] of [[1920,1080], [1280,720], [1024,768], [3440,1440], [800,1280], [390,844], [640,360]]) {
    f.resize(width, height); f.flush();
    const scale = Math.min(width / 1440, height / 900), layout = mount.layout;
    assert.equal(layout.scale, scale);
    assert.equal(layout.left, (width - 1440 * scale) / 2);
    assert.equal(layout.top, (height - 900 * scale) / 2);
    assert.equal(f.root.props.get('--ui-scale'), String(scale));
    assert.equal(f.root.getAttribute('data-ui-compact'), String(scale < .55));
    assert.equal(f.notices()[0].hidden, scale >= .55 || layout.top < 60, 'hints use only letterbox space');
    assert.equal(f.canvas.width, 2880); assert.equal(f.minimap.width, 260);
  }
  f.visualViewport.offsetLeft = 11; f.visualViewport.offsetTop = 19;
  f.visualViewport.emit('scroll'); f.flush();
  assert.equal(mount.layout.left, 43); assert.equal(mount.layout.top, 19);
  for (const type of ['keydown', 'keyup', 'pointerdown', 'pointermove', 'wheel']) assert.equal(f.host.count(type), 0);
  mount.dispose(); mount.dispose();
  assert.equal(f.host.count('resize'), 0); assert.equal(f.visualViewport.count('scroll'), 0);
});

test('BFCache retains race layout while replacement and final disposal remove their listeners', () => {
  const f = fixture(), first = mountRaceUiLayout(f.doc, f.canvas as unknown as HTMLCanvasElement)!;
  f.host.emit('pagehide', {persisted: true}); assert.equal(f.host.count('resize'), 2);
  f.visualViewport.width = 1280; f.visualViewport.height = 720;
  f.host.emit('pageshow'); assert.equal(first.layout.scale, .8);
  const second = mountRaceUiLayout(f.doc, f.canvas as unknown as HTMLCanvasElement)!;
  assert.equal(f.notices().length, 1); assert.equal(f.host.count('resize'), 2);
  first.dispose(); assert.equal(f.host.count('resize'), 2, 'stale handle cannot dispose the replacement');
  f.host.emit('pagehide', {persisted: false}); assert.equal(f.host.count('resize'), 0);
  assert.equal(f.host.count('pageshow'), 0); assert.equal(f.notices().length, 0);
  second.dispose(); disposeRaceUiLayout(f.doc);
  mountRaceUiLayout(f.doc, f.canvas as unknown as HTMLCanvasElement);
  disposeRaceUiLayout(f.doc); assert.equal(f.host.count('resize'), 0);
});


test('disposing failed race startup retains the usable scaled error and exit view', () => {
  const f = fixture(1280, 720), mount = mountRaceUiLayout(f.doc, f.canvas as unknown as HTMLCanvasElement)!;
  const shell = createRaceShell(f.doc, f.canvas as unknown as HTMLCanvasElement, {map: 'waterpark', driver: 'whale', storage: {getItem: () => null, setItem() {}}, audioFactory: () => null});
  shell.dispose();
  assert.equal(f.root.props.get('--ui-scale'), '0.8');
  assert.equal(f.host.count('resize'), 2, 'recovery remains responsive after WebGL initialization failure');
  f.resize(1024, 768); f.flush(); assert.equal(mount.layout.scale, 1024 / 1440);
  f.host.emit('pagehide', {persisted: false}); assert.equal(f.host.count('resize'), 0);
});

test('both race entries mount logical UI before WebGL and never responsive-resize controls', () => {
  const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  for (const [page, entry] of [['coast.html','src/game.ts'], ['waterpark.html','src/waterpark-play.ts']]) {
    const html = read(page), source = read(entry);
    assert.match(html, /<div id="raceUi" class="fixed-ui-root">\s*<div id="raceHud">/);
    assert.ok(html.indexOf('id="raceUi"') < html.indexOf('id="raceLoading"'));
    assert.ok(html.indexOf('id="raceLoading"') < html.indexOf('id="overlay"'));
    assert.ok(source.indexOf('mountRaceHud({') < source.indexOf('new pc.Application('));
  }
  const css = read('src/race-ui.css');
  assert.match(css, /@import ['"]\.\/ui-layout\.css['"]/);
  assert.doesNotMatch(css, /@media[^{}]*(?:max|min)-(?:width|height)|\b\d+(?:\.\d+)?(?:dvh|dvw|vw|vh|vmin|vmax)\b/);
  assert.match(css, /#raceUi\{[^}]*pointer-events:none/);
  assert.match(css, /\.pause-panel\{[^}]*position:absolute[^}]*pointer-events:auto/);
  assert.match(css, /#perf-body\{[^}]*width:310px;max-height:740px/);
  assert.match(css, /#map\{[^}]*width:162px;height:auto;aspect-ratio:260\/230/);
  assert.match(css, /@import ['"]\.\/mobile-controls\.css['"]/);
  assert.doesNotMatch(css, /\.touch\s*(?:button)?\s*\{/, 'legacy touch rules cannot override physical controls');
  const mobileCss = read('src/mobile-controls.css');
  assert.match(mobileCss, /body\[data-input-mode='touch'\]:not\(\.menu\):not\(\.race-paused\) \.mobile-controls\{display:block\}/);
  assert.match(mobileCss, /\.mobile-controls \{[^}]*position:fixed;inset:0/s);
  assert.match(mobileCss, /min-width:48px;min-height:48px/);
  assert.match(mobileCss, /#mobileControlMode \{[^}]*min-height:44px/s);
  assert.match(mobileCss, /#pausePanel \.pause-actions button\{min-height:48px/);
  assert.match(mobileCss, /transform:scale\(calc\(1 \/ var\(--ui-scale, 1\)\)\)/);
  assert.doesNotMatch(mobileCss, /\.(?:touch|desktop)-control-guide\{display:/, 'loading mounts one actual-mode guide instead of hiding duplicate content');
  const hud = read('src/race-hud.ts');
  for (const key of ['ArrowLeft','ArrowRight','KeyW','KeyS','Space','ShiftLeft','RearView']) assert.ok(hud.includes('data-key="' + key + '"'));
  for (const action of ['camera','recenter','item','pause']) assert.ok(hud.includes('data-mobile-action="' + action + '"'));
  assert.ok(hud.indexOf('mountRaceUiLayout(doc, canvas)') < hud.indexOf('mountMobileControls(doc, canvas)'));
  assert.match(read('src/race-hud.ts'), /mountRaceUiLayout\(doc, canvas\)/);
  assert.doesNotMatch(read('src/race-shell.ts'), /disposeRaceUiLayout/, 'renderer failure disposal must retain the scaled recovery view');
});

test('physical touch layout arithmetic keeps driving targets separate at representative phone sizes', () => {
  // This is a source/layout contract, not a substitute for browser screenshots.
  // Tie the independent rectangle calculation to every CSS spacing constant.
  const css = readFileSync(new URL('../src/mobile-controls.css', import.meta.url), 'utf8');
  for (const source of [
    '--mobile-edge:20px;--mobile-bottom:30px;--mobile-primary:68px',
    '--mobile-edge:12px;--mobile-bottom:22px;--mobile-primary:60px',
    '--mobile-bottom:12px;--mobile-edge:14px;--mobile-primary:60px',
    'var(--mobile-bottom) + 112px', 'var(--mobile-bottom) + 206px',
    'var(--mobile-bottom) + 290px', 'var(--mobile-bottom) + 360px',
  ]) assert.ok(css.includes(source), source);
  type Box = {name: string; x: number; y: number; w: number; h: number};
  for (const [width,height,insetX,insetBottom] of [[320,568,0,0],[375,667,0,0],[390,844,0,34],[640,360,0,0],[844,390,44,21],[1024,768,0,0]]) {
    const portrait = height > width, short = !portrait && height <= 380;
    const edge = portrait ? 12 : short ? 14 : 20;
    const bottom = (portrait ? 22 : short ? 12 : 30) + insetBottom;
    const primary = portrait || short ? 60 : 68;
    const boxes: Box[] = [];
    const add = (name:string,x:number,b:number,w:number,h=w) => boxes.push({name,x,y:height-b-h,w,h});
    add('left',edge+insetX,bottom+14,primary);
    add('right',edge+insetX+primary+(portrait?10:14),bottom+14,primary);
    const right = edge+insetX;
    add('reverse',width-right-primary,bottom,primary);
    add('throttle',width-right-primary,bottom+primary+14,primary);
    add('drift',width-right-primary-20-78,bottom+(portrait?112:0),78);
    add('brake',width-right-primary-(portrait?20:112)-60,bottom+(portrait?290:8),60);
    add('item',width-right-primary-29-60,bottom+(portrait?206:94),60);
    for(let i=0;i<4;i++)add('utility'+i,width-right-4*48-3*10+i*58,bottom+(portrait?360:short?160:178),48);
    for(const box of boxes){
      assert.ok(box.w>=48&&box.h>=48,`${width}: ${box.name} physical target`);
      assert.ok(box.x>=0&&box.y>=0&&box.x+box.w<=width&&box.y+box.h<=height,`${width}: ${box.name} remains within viewport`);
    }
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i],b=boxes[j];
      assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,`${width}×${height}: ${a.name} overlaps ${b.name}`);
    }
  }
});


test('land and water SPA wrappers retain their own physical layers without body insertBefore errors', () => {
  for (const sceneName of ['land', 'water']) {
    const f = fixture();
    const scene = f.doc.createElement('div'); scene.id = `app-scene-${sceneName}`;
    f.doc.body.appendChild(scene); scene.appendChild(f.root as unknown as Node);
    const mount = mountRaceUiLayout(f.doc, f.canvas as unknown as HTMLCanvasElement)!;
    assert.ok(mount, sceneName);
    assert.equal(f.canvas.parentElement, scene); assert.equal(f.vignette.parentElement, scene);
    assert.equal(f.root.parentElement, scene); assert.equal(f.hud.parentElement, f.root);
    assert.equal(f.canvas.width, 2880); assert.equal(f.canvas.height, 1800);
    assert.equal(f.canvas.props.size, 0, 'physical canvas remains unscaled');
    mount.dispose(); assert.equal(f.notices().length, 0);
    scene.remove(); assert.equal(f.host.count('resize'), 0);
  }
});
