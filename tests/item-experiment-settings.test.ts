import test from 'node:test';
import assert from 'node:assert/strict';
import {itemStackingExperimentAvailable, itemStackingRestartUrl, mountItemExperimentSettings} from '../src/item-experiment-settings';
import {DEFAULT_RACE_OPTIONS, parseRaceOptions, raceOptionsQuery} from '../src/race-options';
import {parseMenuState, menuQuery, raceEntry, garageEntry} from '../src/menu-state';
import {raceNavigation} from '../src/race-shell';

test('stack experiment requires the dev preview path or explicit Vite development environment', () => {
  assert.equal(itemStackingExperimentAvailable(), false, 'Node has no implicit experiment availability');
  for (const pathname of ['/', '/ai-friends-kart-playcanvas/', '/coast.html', '/development/coast.html', '/dev-preview/coast.html']) {
    assert.equal(itemStackingExperimentAvailable({pathname}), false, pathname);
  }
  for (const pathname of ['/dev/coast.html', '/ai-friends-kart-playcanvas/dev/waterpark.html']) {
    assert.equal(itemStackingExperimentAvailable({pathname}), true, pathname);
  }
  assert.equal(itemStackingExperimentAvailable({baseUrl: '/ai-friends-kart-playcanvas/dev/'}), true);
  assert.equal(itemStackingExperimentAvailable({development: true, pathname: '/coast.html'}), true);
  assert.equal(itemStackingExperimentAvailable({development: false, baseUrl: './', pathname: '/coast.html'}), false);
});

test('race options preserve exact default shape and require explicit available opt-in', () => {
  for (const search of ['', '?itemStacking=0', '?itemStacking=true', '?itemStacking=2', '?itemStacking=']) {
    assert.deepEqual(parseRaceOptions(search, true), DEFAULT_RACE_OPTIONS);
  }
  assert.deepEqual(parseRaceOptions('?itemStacking=1', false), DEFAULT_RACE_OPTIONS);
  assert.deepEqual(parseRaceOptions('?itemStacking=1'), DEFAULT_RACE_OPTIONS);
  assert.deepEqual(parseRaceOptions('?difficulty=hard&seed=42&itemStacking=1', true), {difficulty: 'hard', seed: 42, itemStacking: true});
  const setup = {difficulty: 'hard' as const, seed: 42, itemStacking: true};
  assert.equal(raceOptionsQuery(setup), '?difficulty=hard&seed=42&itemStacking=1');
  assert.deepEqual(parseRaceOptions(raceOptionsQuery(setup), true), setup);
  assert.equal(raceOptionsQuery({...setup, itemStacking: false}), '?difficulty=hard&seed=42');
  assert.deepEqual(parseRaceOptions(raceOptionsQuery(setup), false), {difficulty: 'hard', seed: 42});
});

test('opt-in survives dev race, menu and garage navigation, and cannot activate stable URLs', () => {
  const previous = globalThis.location;
  try {
    globalThis.location = {pathname: '/ai-friends-kart-playcanvas/dev/coast.html'} as Location;
    const setup = parseMenuState('?map=coast&driver=gpt&difficulty=hard&seed=42&itemStacking=1');
    assert.equal(setup.itemStacking, true);
    for (const url of [menuQuery(setup), raceEntry('coast', 'gpt', setup), raceEntry('waterpark', 'gpt', setup), garageEntry('gpt', setup),
      ...Object.values(raceNavigation('coast', 'gpt', '?difficulty=hard&seed=42&itemStacking=1'))]) {
      assert.equal(new URLSearchParams(url.slice(url.indexOf('?'))).get('itemStacking'), '1', url);
    }
    globalThis.location = {pathname: '/ai-friends-kart-playcanvas/coast.html'} as Location;
    assert.equal(parseMenuState('?itemStacking=1').itemStacking, undefined);
  } finally {
    if (previous === undefined) delete (globalThis as {location?: Location}).location; else globalThis.location = previous;
  }
});

test('applying a stack choice preserves race setup and only changes that flag plus autostart', () => {
  const current = 'https://example.test/game/dev/coast.html?map=snow&driver=grok&difficulty=hard&seed=42&kart=%7B%22body%22%3A%22tiny%22%7D&qa=1#race';
  const enabled = new URL(itemStackingRestartUrl(current, true)), source = new URL(current);
  assert.equal(enabled.origin, source.origin); assert.equal(enabled.pathname, source.pathname); assert.equal(enabled.hash, source.hash);
  for (const [key, value] of source.searchParams) assert.equal(enabled.searchParams.get(key), value);
  assert.equal(enabled.searchParams.get('itemStacking'), '1'); assert.equal(enabled.searchParams.get('autostart'), '1');
  const disabled = new URL(itemStackingRestartUrl(enabled.href, false));
  assert.equal(disabled.searchParams.has('itemStacking'), false);
  assert.equal(disabled.searchParams.get('map'), 'snow'); assert.equal(disabled.searchParams.get('seed'), '42');
});

function settingsFixture(href = 'https://example.test/game/dev/coast.html?driver=grok&seed=42') {
  class Element extends EventTarget {
    id = ''; type = ''; textContent = ''; className = ''; checked = false; htmlFor = '';
    dataset: Record<string, string> = {}; attrs: Record<string, string> = {};
    children: Element[] = []; parent: Element | null = null;
    setAttribute(name: string, value: string) { this.attrs[name] = value; }
    appendChild(node: Element) { this.children.push(node); node.parent = this; return node; }
    insertBefore(node: Element, before: Element | null) {
      const index = before ? this.children.indexOf(before) : -1;
      if (index < 0) this.children.push(node); else this.children.splice(index, 0, node);
      node.parent = this; return node;
    }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null; }
  }
  const location = new URL(href), parent = new Element(), before = parent.appendChild(new Element()), navigations: string[] = [];
  const document = {defaultView: {location}, createElement: () => new Element(), createTextNode: (textContent: string) => Object.assign(new Element(), {textContent})} as unknown as Document;
  return {document, parent, before, location, navigations, mount: (pathname = location.pathname) => mountItemExperimentSettings(document, parent as unknown as HTMLElement,
    before as unknown as HTMLElement, href => navigations.push(href), {pathname})};
}

test('dev pause setting is pending until explicit restart and cleans up its listener', () => {
  const f = settingsFixture(), dispose = f.mount(), panel = f.parent.children[0];
  assert.equal(panel.dataset.itemExperimentSettings, 'true'); assert.equal(f.parent.children[1], f.before);
  const [label, hint, apply] = panel.children, checkbox = label.children[0];
  assert.equal(label.children[1].textContent, ' 实验：三同类升级（下次比赛生效）');
  assert.equal(checkbox.checked, false); assert.match(hint.textContent, /勾选不改变当前比赛/); assert.match(hint.textContent, /重新开始本场/);
  assert.match(hint.textContent, /同槽普通 ×2 每次用 1/); assert.match(hint.textContent, /第三枚变高阶 1 次/); assert.match(hint.textContent, /满槽神秘箱不接收/);
  assert.equal(apply.textContent, '应用并重新开始');
  checkbox.checked = true; checkbox.dispatchEvent(new Event('change'));
  assert.equal(f.navigations.length, 0); assert.equal(f.location.searchParams.has('itemStacking'), false);
  apply.dispatchEvent(new Event('click'));
  assert.equal(f.navigations.length, 1); assert.equal(new URL(f.navigations[0]).searchParams.get('itemStacking'), '1');
  checkbox.checked = false; apply.dispatchEvent(new Event('click'));
  assert.equal(new URL(f.navigations[1]).searchParams.has('itemStacking'), false);
  dispose(); assert.deepEqual(f.parent.children, [f.before]);
  apply.dispatchEvent(new Event('click')); assert.equal(f.navigations.length, 2, 'disposed shell cannot trigger a stale restart');
});

test('stable pause settings hide experiment even with a forged query, while dev reflects active mode', () => {
  const stable = settingsFixture('https://example.test/game/coast.html?itemStacking=1');
  const dispose = stable.mount(); assert.deepEqual(stable.parent.children, [stable.before]); dispose();
  const dev = settingsFixture('https://example.test/game/dev/waterpark.html?itemStacking=1');
  dev.mount(); assert.equal(dev.parent.children[0].children[0].children[0].checked, true);
});
