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

test('dev stacking defaults on and only explicit zero opts out, while stable stays off', () => {
  for (const search of ['', '?itemStacking=1', '?itemStacking=true', '?itemStacking=2', '?itemStacking=']) {
    assert.deepEqual(parseRaceOptions(search, true), {...DEFAULT_RACE_OPTIONS, itemStacking: true});
  }
  assert.deepEqual(parseRaceOptions('?itemStacking=0', true), {...DEFAULT_RACE_OPTIONS, itemStacking: false});
  for (const search of ['', '?itemStacking=1', '?itemStacking=0']) {
    assert.deepEqual(parseRaceOptions(search, false), DEFAULT_RACE_OPTIONS);
  }
  assert.deepEqual(parseRaceOptions('?itemStacking=1'), DEFAULT_RACE_OPTIONS);
  assert.deepEqual(parseRaceOptions('?difficulty=hard&seed=42&itemStacking=1', true), {difficulty: 'hard', seed: 42, itemStacking: true});
  const setup = {difficulty: 'hard' as const, seed: 42, itemStacking: true};
  assert.equal(raceOptionsQuery(setup), '?difficulty=hard&seed=42&itemStacking=1');
  assert.deepEqual(parseRaceOptions(raceOptionsQuery(setup), true), setup);
  assert.equal(raceOptionsQuery({...setup, itemStacking: false}), '?difficulty=hard&seed=42&itemStacking=0');
  assert.deepEqual(parseRaceOptions(raceOptionsQuery({...setup, itemStacking: false}), true), {...setup, itemStacking: false});
  assert.equal(raceOptionsQuery({difficulty: 'hard', seed: 42}), '?difficulty=hard&seed=42');
  assert.deepEqual(parseRaceOptions(raceOptionsQuery(setup), false), {difficulty: 'hard', seed: 42});
});

test('dev default and explicit on or off survive race, menu and garage navigation', () => {
  const previous = globalThis.location;
  try {
    globalThis.location = {pathname: '/ai-friends-kart-playcanvas/dev/coast.html'} as Location;
    for (const [flag, expected] of [['', '1'], ['&itemStacking=1', '1'], ['&itemStacking=0', '0']]) {
      const search = '?map=coast&driver=gpt&difficulty=hard&seed=42' + flag;
      const setup = parseMenuState(search);
      assert.equal(setup.itemStacking, expected === '1');
      for (const url of [menuQuery(setup), raceEntry('coast', 'gpt', setup), raceEntry('waterpark', 'gpt', setup), garageEntry('gpt', setup),
        ...Object.values(raceNavigation('coast', 'gpt', search)), ...Object.values(raceNavigation('waterpark', 'gpt', search))]) {
        const query = url.slice(url.indexOf('?'));
        assert.equal(new URLSearchParams(query).get('itemStacking'), expected, url);
        assert.equal(parseMenuState(query).itemStacking, expected === '1', url);
      }
    }
    globalThis.location = {pathname: '/ai-friends-kart-playcanvas/coast.html'} as Location;
    for (const search of ['', '?itemStacking=1', '?itemStacking=0']) assert.equal(parseMenuState(search).itemStacking, undefined);
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
  assert.equal(disabled.searchParams.get('itemStacking'), '0');
  assert.equal(parseRaceOptions(disabled.search, true).itemStacking, false);
  assert.equal(disabled.searchParams.get('autostart'), '1');
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
  assert.equal(checkbox.checked, true); assert.match(hint.textContent, /勾选不改变当前比赛/); assert.match(hint.textContent, /重新开始本场/);
  assert.match(hint.textContent, /dev默认开启，可取消恢复双槽/);
  assert.match(hint.textContent, /同槽普通 ×2 每次用 1/); assert.match(hint.textContent, /第三枚变 super 1 次/); assert.match(hint.textContent, /满槽神秘箱不接收/);
  assert.match(hint.textContent, /super 后同类箱消耗但不强化、不填另一槽、不生成 Token/); assert.match(hint.textContent, /有空槽神秘箱照常抽取/);
  assert.equal(apply.textContent, '应用并重新开始');
  checkbox.checked = false; checkbox.dispatchEvent(new Event('change'));
  assert.equal(f.navigations.length, 0); assert.equal(f.location.searchParams.has('itemStacking'), false);
  apply.dispatchEvent(new Event('click'));
  assert.equal(f.navigations.length, 1); assert.equal(new URL(f.navigations[0]).searchParams.get('itemStacking'), '0');
  checkbox.checked = true; apply.dispatchEvent(new Event('click'));
  assert.equal(new URL(f.navigations[1]).searchParams.get('itemStacking'), '1');
  dispose(); assert.deepEqual(f.parent.children, [f.before]);
  apply.dispatchEvent(new Event('click')); assert.equal(f.navigations.length, 2, 'disposed shell cannot trigger a stale restart');
});

test('stable pause settings hide experiment even with a forged query, while dev reflects active mode', () => {
  const stable = settingsFixture('https://example.test/game/coast.html?itemStacking=1');
  const dispose = stable.mount(); assert.deepEqual(stable.parent.children, [stable.before]); dispose();
  for (const [query, checked] of [['', true], ['?itemStacking=1', true], ['?itemStacking=0', false]] as const) {
    const dev = settingsFixture('https://example.test/game/dev/waterpark.html' + query);
    const disposeDev = dev.mount(); assert.equal(dev.parent.children[0].children[0].children[0].checked, checked);
    disposeDev(); assert.deepEqual(dev.parent.children, [dev.before]);
  }
});
