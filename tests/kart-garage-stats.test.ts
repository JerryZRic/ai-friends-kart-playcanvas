import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CHARACTER_PROFILES, MAP_BASELINES} from '../src/character-profiles';
import {defaultBuild, kartTuning, VEHICLE_CLAMPS, catalog, KART_SLOTS, type KartBuild} from '../src/kart-build';
import {kartPresets} from '../src/kart-presets';
import {GARAGE_STAT_KEYS, GARAGE_STAT_SCALES, garageStatScore, garageStatSegments, renderGarageStatBars, type GarageCombinedStats} from '../src/kart-garage-stats';

const standard: GarageCombinedStats = {acceleration: 18, speed: 151.2, handling: 7, stability: 1.372};
const render = (current = standard, previous = standard, prospective = false, driverLabel = 'GPT') => renderGarageStatBars({driverLabel, current, previous, prospective});
const fills = (markup: string) => [...markup.matchAll(/class="garage-stat-fill" style="width:([\d.]+)%"/g)].map(match => Number(match[1]));
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);
function combined(driver: string, build: KartBuild): GarageCombinedStats {
  const tuning = kartTuning(driver, 'coast', build, {speed: 0, grade: 0, curvature: 0});
  return {acceleration: tuning.acceleration, speed: tuning.maxSpeed * 3.6, handling: tuning.steering, stability: tuning.stats.rollThresholdG};
}

test('five independent fractional cells include exact 3.2 behavior and all endpoints', () => {
  assert.deepEqual(garageStatSegments(3.2), [1, 1, 1, .2, 0]);
  assert.deepEqual(garageStatSegments(0), [0, 0, 0, 0, 0]);
  assert.deepEqual(garageStatSegments(.125), [.125, 0, 0, 0, 0]);
  assert.deepEqual(garageStatSegments(2), [1, 1, 0, 0, 0]);
  assert.deepEqual(garageStatSegments(4.999), [1, 1, 1, 1, .999]);
  assert.deepEqual(garageStatSegments(5), [1, 1, 1, 1, 1]);
  assert.deepEqual(garageStatSegments(500), [1, 1, 1, 1, 1]);
  for (const invalid of [-1, -Infinity, Infinity, NaN]) assert.deepEqual(garageStatSegments(invalid), [0, 0, 0, 0, 0]);
  for (let score = 0; score <= 5; score += .013) {
    const segments = garageStatSegments(score);
    assert.equal(segments.length, 5); near(segments.reduce((sum, fill) => sum + fill, 0), score);
    assert.ok(segments.every(fill => fill >= 0 && fill <= 1));
    assert.ok(segments.filter(fill => fill > 0 && fill < 1).length <= 1);
  }
});

test('independent, documented game-unit ranges map linearly and clamp hostile values', () => {
  for (const key of GARAGE_STAT_KEYS) {
    const {min, max} = GARAGE_STAT_SCALES[key];
    assert.equal(garageStatScore(key, min), 0); assert.equal(garageStatScore(key, max), 5);
    near(garageStatScore(key, (min + max) / 2), 2.5);
    near(garageStatScore(key, min + (max - min) * 3.2 / 5), 3.2);
    for (const invalid of [NaN, Infinity, -Infinity, -1, 0]) assert.equal(garageStatScore(key, invalid), 0);
    assert.equal(garageStatScore(key, Number.MAX_VALUE), 5);
    assert.ok(Object.isFrozen(GARAGE_STAT_SCALES[key]));
  }
  // This guard requires a deliberate scale update if future tuning outgrows it.
  for (const character of CHARACTER_PROFILES) for (const endpoint of [0, 1]) {
    const limits = {
      acceleration: MAP_BASELINES.coast.acceleration * character.acceleration * VEHICLE_CLAMPS.acceleration[endpoint],
      speed: MAP_BASELINES.coast.maxSpeed * character.topSpeed * VEHICLE_CLAMPS.speed[endpoint] * 3.6,
      handling: MAP_BASELINES.coast.steering * character.steering * VEHICLE_CLAMPS.handling[endpoint],
    };
    for (const key of GARAGE_STAT_KEYS) assert.ok(limits[key] >= GARAGE_STAT_SCALES[key].min && limits[key] <= GARAGE_STAT_SCALES[key].max, `${character.id} ${key} fits its fixed scale`);
  }
});

test('rendering preserves fractional widths rather than rounding a 3.2 rating to four cells', () => {
  const current = {...standard, acceleration: 19.68};
  const html = render(current);
  assert.deepEqual(fills(html).slice(0, 5), [100, 100, 100, 20, 0]);
  assert.match(html, /aria-valuenow="3.2"/);
  assert.equal(fills(html).length, 15);
  assert.equal((html.match(/role="meter"/g) || []).length, 3);
  assert.equal((html.match(/class="garage-stat-segment" aria-hidden="true"/g) || []).length, 15);
  assert.match(html, /aria-valuemin="0" aria-valuemax="5"/);
  assert.match(html, /加速 12–24、极速 120–190、操控 5.5–9/);
  assert.match(html, /0 格为标尺下限，不代表零性能/);
});

test('candidate compares against equipped build; equipped compares against previous with non-color signs', () => {
  const changed = {acceleration: 19.2, speed: 140.4, handling: 7, stability: 1.6};
  const candidate = render(changed, standard, true), equipped = render(changed, standard);
  assert.match(candidate, /data-comparison="candidate"/); assert.match(candidate, /当前 → 试装/);
  assert.match(candidate, /当前 18.00 → 试装 19.20 游戏单位\/s²/);
  assert.match(candidate, /positive[^>]*aria-label="加速，当前 → 试装，增加 1.20 游戏单位\/s²">Δ \+1.20/);
  assert.match(candidate, /negative[^>]*>Δ −10.8/);
  assert.match(candidate, /neutral[^>]*aria-label="操控，当前 → 试装，无变化">Δ 0/);
  assert.match(equipped, /data-comparison="equipped"/); assert.match(equipped, /上次 18.00 → 当前 19.20/);
  assert.deepEqual(fills(candidate), fills(equipped), 'comparison mode never changes displayed performance');
  assert.deepEqual(fills(render(changed, {...standard, acceleration: 16})), fills(equipped), 'changing baseline never rescales the meter');
});

test('inactive stability is neutral design metadata, with no meter, score, or benefit delta', () => {
  const html = render({...standard, stability: 1.6}, {...standard, stability: 1.2}, true);
  const inactive = html.slice(html.indexOf('<div class="garage-stat-inactive"'), html.indexOf('<p class="garage-stat-scale-note"'));
  assert.match(inactive, /稳定性/); assert.match(inactive, /未启用/); assert.match(inactive, /1.60/);
  assert.match(inactive, /g · 设计估计/); assert.match(inactive, /无当前加成/);
  assert.doesNotMatch(inactive, /role="meter"|positive|negative|Δ|garage-stat-fill/);
});

test('numeric failures stay safe and unavailable; visible rounding never produces negative zero', () => {
  for (const value of [NaN, Infinity, -Infinity, -1, '<img onerror=alert(1)>' as unknown as number]) {
    const broken = {acceleration: value, speed: value, handling: value, stability: value};
    const html = render(broken, standard, true);
    assert.doesNotMatch(html, /NaN|Infinity|onerror|width:-|aria-valuenow="-/);
    assert.match(html, /aria-valuetext="数据不可用"/); assert.match(html, /比较值不可用/);
    assert.deepEqual(fills(html), Array(15).fill(0));
  }
  const invalidBaseline = render(standard, {acceleration: NaN, speed: -1, handling: Infinity, stability: NaN});
  assert.equal((invalidBaseline.match(/>Δ —</g) || []).length, 3);
  assert.deepEqual(fills(invalidBaseline), fills(render()));
  const rounded = render({...standard, acceleration: 17.999999, speed: 151.199999, handling: 6.999999});
  assert.equal((rounded.match(/>Δ 0</g) || []).length, 3); assert.doesNotMatch(rounded, /Δ [−-]0/);
  const huge = render({acceleration: Number.MAX_VALUE, speed: Number.MAX_VALUE, handling: Number.MAX_VALUE, stability: Number.MAX_VALUE});
  assert.deepEqual(fills(huge), Array(15).fill(100)); assert.doesNotMatch(huge, /NaN|Infinity/);
});

test('caller-provided label is escaped in text and attributes without injecting markup', () => {
  const html = render(standard, standard, false, 'A&B <img src=x onerror="bad"> \'quoted\'');
  assert.match(html, /A&amp;B &lt;img src=x onerror=&quot;bad&quot;&gt; &#39;quoted&#39;/);
  assert.doesNotMatch(html, /<img|onerror="bad"/);
});

test('all characters, authored presets and 55 real full kits keep finite meaningful scores', () => {
  const kits = [...new Set(catalog.map(part => part.kitNumber))].map(number => Object.fromEntries(KART_SLOTS.map(slot => [slot, catalog.find(part => part.kitNumber === number && part.slot === slot)!.id])) as KartBuild);
  for (const driver of CHARACTER_PROFILES) for (const build of [defaultBuild, ...kartPresets.map(preset => preset.build), ...kits]) {
    const stats = combined(driver.id, build), html = render(stats, standard, false, driver.label);
    for (const key of GARAGE_STAT_KEYS) {
      const score = garageStatScore(key, stats[key]);
      assert.ok(score > 0 && score < 5, `${driver.id} ${key} is inside documented scale`);
      assert.match(html, new RegExp(`aria-valuenow="${Number(score.toFixed(3))}"`));
    }
    assert.equal(fills(html).length, 15); assert.ok(fills(html).every(fill => fill >= 0 && fill <= 100));
    assert.doesNotMatch(html, /NaN|Infinity/);
  }
  near(garageStatScore('acceleration', combined('gpt', defaultBuild).acceleration), 2.5);
  const [balanced, corner, straight, hill] = kartPresets.map(preset => combined('gpt', preset.build));
  assert.ok(garageStatScore('handling', corner.handling) > garageStatScore('handling', balanced.handling));
  assert.ok(garageStatScore('speed', straight.speed) > garageStatScore('speed', balanced.speed));
  assert.ok(garageStatScore('acceleration', hill.acceleration) > garageStatScore('acceleration', balanced.acceleration));
});

test('CSS keeps true segment gaps and clipped fractional fill, including high-contrast fallback', () => {
  const css = readFileSync('src/kart-garage-stats.css', 'utf8');
  assert.match(css, /\.garage-stat-meter\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)[^}]*gap:5px/);
  assert.match(css, /\.garage-stat-segment\{[^}]*overflow:hidden/);
  assert.match(css, /forced-colors:active/);
  assert.doesNotMatch(css, /transition:|animation:/);
});
