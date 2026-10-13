import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');
const css = read('src/mobile-controls.css');
function rule(selector: string) {
  const start = css.indexOf(selector + ' {');
  const compact = css.indexOf(selector + '{');
  const index = start < 0 ? compact : start;
  assert.ok(index >= 0, selector);
  const body = css.slice(css.indexOf('{', index) + 1, css.indexOf('}', index));
  return Object.fromEntries(body.split(';').filter(s => s.includes(':')).map(s => {
    const split = s.indexOf(':'); return [s.slice(0, split).trim(), s.slice(split + 1).trim()];
  }));
}
const alpha = (hex: string) => hex.length === 9 ? parseInt(hex.slice(7), 16) / 255 : 1;

test('touch button normal paint reveals the course without fading icons or changing hit behavior', () => {
  const normal = rule('.mobile-controls button');
  assert.equal(normal.background, '#15313933');
  assert.ok(alpha(normal.background) <= .2);
  assert.ok(alpha(normal.border.split(' ').at(-1)!) <= .26);
  assert.equal(normal['backdrop-filter'], 'none', 'course detail remains sharp behind controls');
  assert.equal(normal.color, '#f4f9f7');
  assert.match(normal['text-shadow'], /#031820/, 'local dark edge protects light icons on bright water or sand');
  assert.equal(normal.opacity, undefined, 'do not fade the entire icon/button');
  assert.equal(normal['pointer-events'], 'auto');
  assert.equal(normal['touch-action'], 'none');
  assert.equal(normal['min-width'], '48px'); assert.equal(normal['min-height'], '48px');
  assert.ok(alpha(rule('.mobile-pedals .throttle').background) < .1);
  assert.ok(alpha(rule('.mobile-utilities button').background) < .16);
});

test('pressed controls remain distinct, while disabled and keyboard-focus states remain available', () => {
  const normal = rule('.mobile-controls button');
  const pressed = rule(".mobile-controls button[aria-pressed='true']");
  assert.match(css, /button:active,\.mobile-controls button\.is-pressed,/);
  assert.ok(alpha(pressed.background) > alpha(normal.background));
  assert.ok(alpha(pressed.background) <= .4);
  assert.ok(alpha(pressed['border-color']) > alpha(normal.border.split(' ').at(-1)!));
  assert.equal(pressed.color, '#142f31');
  assert.equal(rule('.mobile-controls button:disabled').opacity, '.45');
  assert.equal(rule('.mobile-controls button:disabled')['pointer-events'], 'none');
  assert.equal(rule('.mobile-controls button:focus-visible').outline, '3px solid var(--lime)');
});

test('normal controls preserve more underlying water, sand and asphalt color than previous paint', () => {
  const backgrounds = {water:[10,135,152], sand:[225,220,166], asphalt:[98,112,120]};
  const tint = [21,49,57];
  const delta = (background: number[], opacity: number) => background.reduce((sum, value, i) => sum + Math.abs((value * (1-opacity) + tint[i] * opacity) - value), 0);
  for (const [name, background] of Object.entries(backgrounds)) {
    assert.ok(delta(background, alpha(rule('.mobile-controls button').background)) < delta(background, 128/255) * .41, name);
  }
});

test('all track states hide only the injected license shortcut and menu navigation restores it', () => {
  const raceCss = read('src/race-ui.css'), menuCss = read('src/menu.css');
  assert.match(raceCss, /#raceUi\s*~\s*#source-license\s*\{display:none\}/);
  assert.doesNotMatch(menuCss, /#source-license/);
  for (const page of ['coast.html', 'waterpark.html']) {
    const html = read(page);
    assert.match(html, /href="\/src\/race-ui\.css"/);
    assert.match(html, /id="raceUi"/);
    assert.match(html, /id="raceMainMenu" href="index\.html"/);
    for (const state of ['loading', 'ready', 'race', 'race-paused', 'results', 'failed']) {
      assert.ok(!/#raceUi\s*~\s*#source-license\s*\{[^}]*\b(?:touch|desktop|menu|paused)\b/.test(raceCss), page + ' ' + state + ' has no mode/state gate');
    }
  }
  const menu = read('index.html');
  assert.doesNotMatch(menu, /id="raceUi"/);
  assert.match(menu, /href="\/src\/menu\.css"/);
  const packager = read('scripts/package-source.mjs');
  assert.match(packager, /id="source-license" href="source\.html"/);
  assert.match(packager, /aria-label="Source code and license \/ 源码与许可证"/);
  for (const file of ['LICENSE', 'NOTICE', 'MODEL-NOTICE.txt', 'FOOD-ASSET-NOTICE.txt', 'ALPINE-PROP-NOTICE.txt', 'THIRD-PARTY-NOTICES.txt', 'SOURCE.txt', 'public/source.html']) assert.ok(read(file).length > 0, file);
});
