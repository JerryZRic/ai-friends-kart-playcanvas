import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mountRaceLoadingUi, RACE_LOADING_MARKUP } from '../src/race-loading-ui';
import {CONTROL_MODE_EVENT, mountMobileControls} from '../src/mobile-controls';
import {MAP_PROFILES} from '../src/map-profiles';
import { RACE_HUD_MARKUP } from '../src/race-hud';

function fixture(mode: 'touch' | 'desktop' = 'desktop') {
  const elements = new Map<string, Element>();
  class Element extends EventTarget {
    textContent = ''; hidden = false; disabled = false; value: any = 0;
    attributes: Record<string, string> = {};
    dataset: Record<string, string> = {};
    html = ''; removed = false;
    setAttribute(name: string, value: string) { this.attributes[name] = value; }
    removeAttribute(name: string) { delete this.attributes[name]; }
    appendChild(element: Element) { return element; }
    remove() { this.removed = true; }
    set innerHTML(html: string) {
      this.html = html;
      for (const match of html.matchAll(/id="([^"]+)"/g)) elements.set(match[1], new Element());
      const panel = elements.get('loadingControlsPanel');
      if (html.includes('id="loadingControlsPanel"') && panel) {
        const start = html.indexOf('>', html.indexOf('id="loadingControlsPanel"')) + 1;
        const end = html.indexOf('\n  <div class="loading-footer">');
        panel.html = html.slice(start, end).replace(/<\/section>\s*$/, '');
      }
    }
    get innerHTML() { return this.html; }
  }
  const host = new Element(), body = new Element(); body.dataset.inputMode = mode;
  const doc = Object.assign(new EventTarget(), {body, defaultView: null as any, getElementById: (id: string) => id === 'raceLoading' ? host : elements.get(id)}) as unknown as Document;
  const changeMode = (next: 'touch' | 'desktop') => { body.dataset.inputMode = next; doc.dispatchEvent(new Event(CONTROL_MODE_EVENT)); };
  return {doc, host, body, elements, Element, changeMode, get: (id: string) => elements.get(id)!};
}

test('shared loading mount varies only map identity and uses one complete keycap guide', () => {
  for (const [map, name] of [['coast', '日落海岸'], ['waterpark', '晴空水上乐园']] as const) {
    const { doc, get } = fixture(); const ui = mountRaceLoadingUi(doc, map);
    assert.equal(get('loadingMapName').textContent, name);
    assert.equal(get('loadingDriftHelp').textContent, map === 'waterpark' ? '水上滑移' : '手刹漂移');
    ui.update({ progress: .427, status: '正在下载角色', busy: true });
    assert.equal(get('raceLoadingProgress').value, .427);
    assert.equal(get('raceLoadingPercent').textContent, '42%');
    assert.equal(get('raceLoadingStatus').textContent, '正在下载角色');
    assert.equal(get('raceLoadingProgressGroup').attributes['aria-busy'], 'true');
    assert.equal(ui.retryButton.hidden, true); assert.equal(ui.continueButton.hidden, true);
    assert.equal(get('raceLoadingExit').hidden, true);
  }
  for (const key of ['W', 'A', 'S', 'D', '↑', '↓', '←', '→', 'Shift', 'Space', 'E', 'Z', 'C', 'Q', 'P', 'Esc', 'Enter']) assert.match(RACE_LOADING_MARKUP, new RegExp(`>${key}</kbd>`));
  assert.match(RACE_LOADING_MARKUP, /aria-label="资源下载进度"/);
  assert.throws(() => mountRaceLoadingUi({ getElementById: () => null } as unknown as Document, 'coast'), /Missing shared race loading mount/);
});

test('unknown totals are indeterminate and invalid numbers never fabricate percentages', () => {
  const { doc, get } = fixture(); const ui = mountRaceLoadingUi(doc, 'coast');
  for (const progress of [null, NaN, Infinity]) {
    get('raceLoadingProgress').setAttribute('value', '.3');
    ui.update({ progress, status: '正在确定下载大小' });
    assert.equal(get('raceLoadingPercent').textContent, '—');
    assert.equal('value' in get('raceLoadingProgress').attributes, false);
  }
  ui.update({ progress: -3, status: '等待连接' }); assert.equal(get('raceLoadingPercent').textContent, '0%');
  ui.update({ progress: 2, status: '下载完成 · 正在准备模型' });
  assert.equal(get('raceLoadingPercent').textContent, '100%');
  assert.equal(get('raceLoadingStatus').textContent, '下载完成 · 正在准备模型');
});

test('error recovery actions appear only when allowed and disposal rejects late callbacks', () => {
  const { doc, get } = fixture(); const ui = mountRaceLoadingUi(doc, 'waterpark');
  ui.update({ progress: .8, status: '角色下载失败，请重试', busy: false, canRetry: true });
  assert.equal(ui.retryButton.hidden, false); assert.equal(ui.retryButton.disabled, false);
  assert.equal(ui.continueButton.hidden, true); assert.equal(get('raceLoadingExit').hidden, false);
  ui.update({ progress: .8, status: '正在重试', busy: true, canRetry: true });
  assert.equal(ui.retryButton.disabled, true); assert.equal(get('raceLoadingExit').hidden, true);
  ui.update({ progress: 1, status: '已就绪', busy: false, canContinue: true, continueLabel: '开始比赛' });
  assert.equal(ui.retryButton.hidden, true); assert.equal(ui.continueButton.hidden, false);
  assert.equal(ui.continueButton.disabled, false); assert.equal(ui.continueButton.textContent, '开始比赛');
  assert.equal(get('raceLoadingExit').hidden, true);
  ui.update({ progress: null, status: '画面已中断，请刷新', busy: false });
  assert.equal(get('raceLoadingExit').hidden, false);
  ui.update({ progress: 1, status: '已就绪', busy: true });
  ui.dispose(); ui.dispose(); ui.update({ progress: .1, status: '过期回调', canRetry: true });
  assert.equal(get('raceLoadingStatus').textContent, '已就绪');
  assert.equal(ui.retryButton.disabled, true); assert.equal(ui.continueButton.disabled, true);
});

test('both pages preserve hidden adapter IDs and share clutter-free loading/results layout', () => {
  for (const page of ['coast.html', 'waterpark.html']) {
    const html = readFileSync(new URL('../' + page, import.meta.url), 'utf8');
    assert.match(html, /<div id="raceLoading"><\/div>/);
    assert.match(html, /class="legacy-race-menu" hidden inert aria-hidden="true"/);
    assert.match(html, /class="overlay race-finish"[^>]*role="dialog"/);
    const ids = [...(html + RACE_HUD_MARKUP + RACE_LOADING_MARKUP).matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, page + ' must never contain duplicate live/legacy IDs');
    assert.ok(html.indexOf('id="results"') < html.indexOf('race-finish-actions'));
  }
  const css = readFileSync(new URL('../src/race-ui.css', import.meta.url), 'utf8');
  assert.match(css, /body\.menu:not\(\.finished\) \.race-loading-screen\{display:block\}/);
  assert.match(css, /body\.finished \.overlay\.race-finish\{display:flex\}/);
  assert.match(css, /\.legacy-race-menu\{display:none!important\}/);
});


test('loading tips teach map-specific charged release without changing loading actions', () => {
  for (const map of ['coast', 'waterpark'] as const) {
    const { doc, get } = fixture(); const ui = mountRaceLoadingUi(doc, map);
    assert.equal(get('loadingTipTitle').textContent, map === 'coast' ? '漂移加速' : '水上滑移加速');
    assert.match(get('loadingTipStart').textContent, /W.*左 Shift \+ A \/ D.*转向蓄力/);
    assert.match(get('loadingTipRelease').textContent, /松开 Shift 加速/);
    if (map === 'coast') assert.match(get('loadingTipRelease').textContent, /变黄/);
    else {
      assert.match(get('loadingTipRelease').textContent, /超过 0\.6 秒/);
      assert.doesNotMatch(get('loadingTipRelease').textContent, /黄|漂移/);
    }
    const tip = get('loadingTipRelease').textContent;
    for (const snapshot of [
      {progress: null, status: '等待资源', busy: true},
      {progress: .8, status: '下载失败', busy: false, canRetry: true},
      {progress: .8, status: '正在重试', busy: true},
      {progress: 1, status: '回到发车位', busy: true},
    ]) {
      ui.update(snapshot);
      assert.equal(get('loadingTipRelease').textContent, tip);
      assert.equal(ui.continueButton.hidden, true, 'tips must not unlock driving or continuation');
    }
    ui.dispose(); ui.update({progress: 1, status: '过期回调', canContinue: true});
    assert.equal(ui.continueButton.disabled, true);
    mountRaceLoadingUi(doc, map);
    assert.equal(get('loadingTipRelease').textContent, tip, 're-entering loading mounts the same correct hint');
  }
  // Static instructions remain outside the busy/live progress region.
  assert.ok(RACE_LOADING_MARKUP.indexOf('aria-labelledby="loadingTipTitle"') < RACE_LOADING_MARKUP.indexOf('id="raceLoadingProgressGroup"'));
  assert.doesNotMatch(RACE_LOADING_MARKUP, /loadingTip[^>]*aria-live/);
});

test('tips and controls keep their logical footer flow through uniform viewport scaling', () => {
  const css = readFileSync(new URL('../src/race-ui.css', import.meta.url), 'utf8');
  assert.match(css, /\.loading-bottom\{[^}]*max-height:[^}]*overflow-y:auto/);
  assert.match(css, /\.loading-bottom \.loading-footer\{position:static/);
  assert.match(css, /\.loading-bottom \.loading-controls\{position:static/);
  assert.match(css, /\.loading-driving-tip p\{[^}]*overflow-wrap:break-word/);
  assert.match(css, /\.loading-bottom \.loading-controls\{position:static;flex:0 0 620px;order:1/);
  assert.match(css, /\.loading-control-columns\{display:grid;grid-template-columns:1fr 1fr/);
  assert.match(css, /\.loading-actions a,\.loading-actions a:visited\{[^}]*color:#f1f6ec/);
  assert.doesNotMatch(css, /@media[^{}]*(?:max|min)-(?:width|height)/);
  assert.match(css, /body\.menu:not\(\.finished\) \.race-loading-screen\{display:block\}/);
});


test('every course mounts only the effective mobile guide before the first loading paint', () => {
  for (const map of Object.keys(MAP_PROFILES) as Array<keyof typeof MAP_PROFILES>) {
    const f = fixture('touch'); const ui = mountRaceLoadingUi(f.doc, map);
    assert.match(f.host.innerHTML, /触屏驾驶/);
    assert.doesNotMatch(f.host.innerHTML, /desktop-control-guide|键鼠操作|<kbd/);
    for (const action of ['油门', '倒车', '刹车', '漂移', '道具', '滑动画面', '回看', '回正', '视角', '暂停']) assert.ok(f.host.innerHTML.includes(action), map + ': ' + action);
    assert.match(f.get('loadingTipStart').textContent, /油门.*左右转向/);
    assert.doesNotMatch(f.get('loadingTipStart').textContent + f.get('loadingTipRelease').textContent, /Shift|W|A \/ D/);
    assert.equal(f.get('loadingDriftHelp').textContent, map === 'waterpark' ? '水上滑移' : '手刹漂移');
    ui.dispose();
  }
});

test('mode changes replace only the guide and tips, keeping active download and recovery state intact', () => {
  const f = fixture('touch'), ui = mountRaceLoadingUi(f.doc, 'waterpark');
  ui.update({progress: .37, status: '资源下载中', busy: true});
  const progress = f.get('raceLoadingProgress'), retry = ui.retryButton;
  f.changeMode('desktop');
  assert.match(f.get('loadingControlsPanel').innerHTML, /键鼠操作/);
  assert.match(f.get('loadingControlsPanel').innerHTML, />W<\/kbd>/);
  assert.doesNotMatch(f.get('loadingControlsPanel').innerHTML, /触屏驾驶/);
  assert.match(f.get('loadingTipStart').textContent, /Shift/);
  f.changeMode('touch');
  assert.match(f.get('loadingControlsPanel').innerHTML, /触屏驾驶/);
  assert.doesNotMatch(f.get('loadingControlsPanel').innerHTML, /<kbd|键鼠操作/);
  assert.equal(f.get('loadingDriftHelp').textContent, '水上滑移');
  assert.equal(f.get('raceLoadingProgress'), progress); assert.equal(progress.value, .37);
  assert.equal(f.get('raceLoadingStatus').textContent, '资源下载中'); assert.equal(ui.retryButton, retry);
  assert.equal(ui.continueButton.hidden, true); assert.equal(ui.continueButton.disabled, true);
  ui.dispose(); const before = f.get('loadingControlsPanel').innerHTML;
  f.changeMode('desktop'); assert.equal(f.get('loadingControlsPanel').innerHTML, before, 'disposed listener cannot rewrite the guide');
});

test('remount removes stale map listeners and old disposal cannot stop the new loading guide', () => {
  const f = fixture('desktop'), old = mountRaceLoadingUi(f.doc, 'coast');
  const current = mountRaceLoadingUi(f.doc, 'waterpark'); old.dispose();
  f.changeMode('touch');
  assert.equal(f.get('loadingDriftHelp').textContent, '水上滑移');
  assert.match(f.get('loadingTipRelease').textContent, /0\.6 秒/);
  assert.doesNotMatch(f.get('loadingTipRelease').textContent, /变黄/);
  current.dispose();
});

test('real shared mode controller drives loading guides through auto detection and saved/manual overrides', () => {
  for (const saved of ['auto', 'desktop', 'touch']) {
    const f = fixture();
    for (const id of ['mobileTouchControls', 'mobileControlModePanel', 'mobileControlMode']) f.elements.set(id, new f.Element());
    const media = Object.assign(new EventTarget(), {matches: true});
    const storage = new Map([['kart-control-mode', saved]]);
    const win = Object.assign(new EventTarget(), {navigator: {maxTouchPoints: 5}, matchMedia: () => media, localStorage: {getItem: (k: string) => storage.get(k), setItem: (k: string, v: string) => storage.set(k, v)}});
    Object.defineProperty(f.doc, 'defaultView', {value: win});
    const canvas = new f.Element();
    const controller = mountMobileControls(f.doc, canvas as any)!;
    const ui = mountRaceLoadingUi(f.doc, 'coast');
    assert.equal(f.host.innerHTML.includes('触屏驾驶'), saved !== 'desktop');
    const selector = f.get('mobileControlMode');
    selector.value = 'desktop'; selector.dispatchEvent(new Event('change'));
    assert.match(f.get('loadingControlsPanel').innerHTML, /键鼠操作/);
    selector.value = 'touch'; selector.dispatchEvent(new Event('change'));
    assert.match(f.get('loadingControlsPanel').innerHTML, /滑动画面/);
    selector.value = 'auto'; selector.dispatchEvent(new Event('change'));
    media.matches = false; media.dispatchEvent(new Event('change'));
    assert.match(f.get('loadingControlsPanel').innerHTML, /键鼠操作/);
    const touch = new Event('pointerdown'); Object.assign(touch, {pointerType: 'touch'}); canvas.dispatchEvent(touch);
    assert.match(f.get('loadingControlsPanel').innerHTML, /触屏驾驶/);
    ui.dispose(); controller.dispose();
  }
});
