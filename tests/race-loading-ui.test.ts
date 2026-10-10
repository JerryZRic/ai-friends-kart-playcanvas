import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mountRaceLoadingUi, RACE_LOADING_MARKUP } from '../src/race-loading-ui';
import { RACE_HUD_MARKUP } from '../src/race-hud';

function fixture() {
  class Element {
    textContent = ''; hidden = false; disabled = false; value = 0;
    attributes: Record<string, string> = {};
    setAttribute(name: string, value: string) { this.attributes[name] = value; }
    removeAttribute(name: string) { delete this.attributes[name]; }
  }
  const elements = new Map<string, Element>();
  const host = { set innerHTML(html: string) {
    for (const match of html.matchAll(/id="([^"]+)"/g)) elements.set(match[1], new Element());
  } };
  const doc = { getElementById: (id: string) => id === 'raceLoading' ? host : elements.get(id) } as unknown as Document;
  return { doc, get: (id: string) => elements.get(id)! };
}

test('shared loading mount varies only map identity and uses one keyboard diagram', () => {
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
  for (const key of ['W', 'A', 'S', 'D', 'Shift', 'Space']) assert.match(RACE_LOADING_MARKUP, new RegExp(`>${key}</kbd>`));
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
  assert.match(css, /\.loading-bottom \.loading-controls\{position:static;flex:0 0 208px;order:1/);
  assert.doesNotMatch(css, /@media[^{}]*(?:max|min)-(?:width|height)/);
  assert.match(css, /body\.menu:not\(\.finished\) \.race-loading-screen\{display:block\}/);
});
