import test from 'node:test';
import assert from 'node:assert/strict';
import { createRaceMinimap, createRaceShell, createRaceSound, formatRaceResults, renderRaceResults, formatRaceTime, raceNavigation, RACE_SOUND_KEY, type RaceHudSnapshot } from '../src/race-shell';
import { itemImage } from '../src/item-models';

/** Shared DOM presentation contract. Simulation/GPU work belongs to map tests. */
function fixture(map: 'coast' | 'waterpark' = 'coast') {
  let activeElement: FakeElement | null = null;
  class FakeElement {
    textContent = ''; innerHTML = ''; style: Record<string, string> = {}; dataset: Record<string, string> = {};
    attrs: Record<string, string> = {}; classes = new Set<string>(); disabled = false; hidden = false;
    alt = ''; href = ''; srcWrites = 0; private source = '';
    classList = { add: (name: string) => { this.classes.add(name); }, remove: (name: string) => { this.classes.delete(name); } };
    setAttribute(name: string, value: string) { this.attrs[name] = value; }
    removeAttribute(name: string) { delete this.attrs[name]; if (name === 'src') this.source = ''; }
    get src() { return this.source; }
    set src(value: string) { this.source = value; this.srcWrites++; }
    focus() { activeElement = this; }
  }
  const elements = new Map<string, FakeElement>();
  const $ = (id: string) => {
    if (!elements.has(id)) elements.set(id, new FakeElement());
    return elements.get(id)!;
  };
  const document = { getElementById: $, body: $('body') } as unknown as Document;
  const canvas = $('game') as unknown as HTMLCanvasElement;
  const storage = new Map<string, string>();
  const shell = createRaceShell(document, canvas, { map, driver: 'grok', storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); } }, audioFactory: () => null });
  return { shell, $, storage, get activeElement() { return activeElement; } };
}

const snapshot: RaceHudSnapshot = { rank: 2, lap: 1, elapsed: 69.9, speed: 20, charge: .7, boost: 0, shield: 0, held: 'boost' };
const finish = { rank: 2, elapsed: 99.123, selectedDriverId: 'grok', trackLength: 100, racers: [
  { id: 'whale', total: 300, finishedAt: 90.456 },
  { id: 'grok', total: 300, finishedAt: 99.123 },
  { id: 'glm', total: 200, finishedAt: null },
] };

test('race navigation retains map and character for both destination screens', () => {
  assert.deepEqual(raceNavigation('waterpark', 'grok'), {
    main: 'index.html', changeMap: 'index.html?screen=maps&map=waterpark&driver=grok', changeCharacter: 'index.html?screen=characters&map=waterpark&driver=grok',
  });
  const { shell, $ } = fixture();
  assert.match($('raceChangeMap').href, /map=coast&driver=grok$/);
  shell.updateNavigation('waterpark', 'glm');
  assert.equal($('raceChangeCharacter').href, $('change-driver').href);
  assert.match($('change-map').href, /map=waterpark&driver=glm$/);
  assert.equal(raceNavigation('invalid' as any, '<script>').changeMap, 'index.html?screen=maps&map=coast&driver=whale');
});

test('both maps receive identical signed-speed, rank, timer and cached item HUD', () => {
  for (const map of ['coast', 'waterpark'] as const) {
    const { shell, $ } = fixture(map);
    shell.start(3); shell.updateHUD(snapshot);
    assert.equal($('rank').innerHTML, '2 <small>/ 6</small>');
    assert.equal($('lap').innerHTML, '1 <small>/ 3</small>');
    assert.equal($('timer').textContent, '1:09'); assert.equal($('speed').textContent, '72');
    assert.equal($('charge').style.width, '50%'); assert.match($('chargeLabel').textContent, /释放漂移加速/);
    assert.equal($('itemImage').src, itemImage('boost')); assert.equal($('itemImage').alt, '涡轮加速模型');
    assert.equal($('item').dataset.held, 'boost'); assert.equal($('item').attrs['aria-label'], '使用涡轮加速');
    shell.updateHUD({ ...snapshot, speed: -2 });
    assert.equal($('speed').textContent, 'R 7'); assert.equal($('itemImage').srcWrites, 1, 'same held item does not reset image decoding every frame');
    shell.updateHUD({ ...snapshot, held: 'shield', boost: 2, charge: 5 });
    assert.equal($('itemImage').srcWrites, 2); assert.match($('chargeLabel').textContent, /涡轮加速中/); assert.equal($('charge').style.width, '100%');
    shell.updateHUD({ ...snapshot, held: null, speed: 0, charge: 0 });
    assert.equal($('itemImage').src, ''); assert.equal($('itemImage').hidden, true); assert.equal($('itemImage').alt, '');
    assert.equal($('item').disabled, true); assert.equal($('item').dataset.held, 'empty'); assert.match($('chargeLabel').textContent, /起步/);
    shell.dispose();
  }
});

test('HUD clamps invalid display numbers and permits a map-specific slide hint', () => {
  const { shell, $ } = fixture();
  shell.updateHUD({ ...snapshot, rank: Infinity, lap: 15, elapsed: NaN, speed: NaN, charge: -20, laps: 4, racerCount: 8 });
  assert.equal($('rank').innerHTML, '1 <small>/ 8</small>'); assert.equal($('lap').innerHTML, '4 <small>/ 4</small>');
  assert.equal($('timer').textContent, '0:00'); assert.equal($('speed').textContent, '0'); assert.equal($('charge').style.width, '0%');
  shell.updateHUD({ ...snapshot, charge: 0, slideLabel: '水面滑移' }); assert.equal($('chargeLabel').textContent, '水面滑移');
  shell.updateHUD({ ...snapshot, shield: 3 }); assert.equal($('chargeLabel').textContent, '能量护盾保护中');
});

test('shared start, pause, resume, finish and restart clear stale presentation', () => {
  const fixtureState = fixture('waterpark'), { shell, $ } = fixtureState;
  shell.showMenu(); assert.equal($('body').classes.has('menu'), true);
  assert.equal($('pause').disabled, true);
  shell.start(3.1); assert.equal($('count').textContent, '4'); assert.equal($('overlay').classes.has('hidden'), true);
  assert.equal($('pause').disabled, false);
  assert.equal(fixtureState.activeElement, $('game'));
  shell.renderCountdown(2.1); assert.equal($('count').textContent, '3');
  shell.setPaused(true, 2.1); assert.equal($('count').textContent, '已暂停'); assert.equal(fixtureState.activeElement, $('resumeRace'));
  assert.equal($('item').disabled, true);
  assert.equal($('pausePanel').classes.has('hidden'), false); assert.equal($('pause').attrs['aria-expanded'], 'true');
  shell.renderCountdown(0); shell.setPaused(true); assert.equal($('count').textContent, '已暂停', 'rendering cannot overwrite pause title');
  shell.updateHUD(snapshot); assert.equal($('item').disabled, true, 'paused inventory is inactive');
  shell.setPaused(false, 2.1); assert.equal($('count').textContent, '3'); assert.equal(fixtureState.activeElement, $('game'));
  shell.setPaused(false, 0); assert.equal($('count').textContent, '3', 'duplicate resume does not erase countdown');
  shell.renderCountdown(0, true); assert.match($('count').textContent, /等待其他选手/); assert.ok($('count').classes.has('waiting'));
  shell.finish(finish); assert.equal($('body').classes.has('finished'), true); assert.equal($('overlay').classes.has('hidden'), false);
  assert.equal($('pause').disabled, true);
  assert.match($('desc').textContent, /晴空水上乐园/); assert.match($('results').innerHTML, /GROK<span class="result-you">你<\/span>/); assert.equal($('startText').textContent, '再来一场');
  assert.equal($('count').textContent, ''); assert.equal(fixtureState.activeElement, $('start')); assert.equal($('pausePanel').classes.has('hidden'), true);
  shell.setPaused(true); shell.renderCountdown(2); assert.equal($('count').textContent, '', 'terminal flow cannot be paused or show old countdown');
  shell.start(3); assert.equal($('body').classes.has('finished'), false); assert.equal($('results').textContent, ''); assert.equal($('results').classes.has('hidden'), true);
  shell.updateHUD({ ...snapshot, canUseItem: false }); assert.equal($('item').disabled, true);
  shell.updateHUD(snapshot); assert.equal($('item').disabled, false);
});

test('result formatting uses authoritative ordering and exact player finish time', () => {
  assert.equal(formatRaceResults(finish), '第 2 / 3 名 · 99.12 秒\n1. WHALE · 90.46 秒\n2. GROK（你） · 99.12 秒\n3. GLM · 未冲线 · 66.7%');
  assert.match(formatRaceResults({ ...finish, racerCount: 6, racers: [{ id: 'grok', label: '<name>', finishedAt: null, total: 400 }] }), /<name>（你） · 未冲线 · 99.9%/);
  assert.equal(formatRaceTime(3601.9), '60:01'); assert.equal(formatRaceTime(-2), '0:00'); assert.equal(formatRaceTime(Infinity), '0:00');
});

test('toast lifetime is reset on replacement/restart and cannot be prolonged by invalid delta', () => {
  const { shell, $ } = fixture();
  shell.toast('第一条', 1); shell.tick(.7); assert.equal($('toast').style.opacity, '1');
  shell.toast('第二条', 2); shell.tick(.5); assert.equal($('toast').textContent, '第二条');
  shell.tick(-5); shell.tick(NaN); shell.tick(Infinity); shell.tick(1); assert.equal($('toast').style.opacity, '1');
  shell.tick(.5); assert.equal($('toast').style.opacity, '0');
  shell.toast('旧消息'); shell.start(); assert.equal($('toast').textContent, ''); assert.equal($('toast').style.opacity, '0');
  shell.dispose(); shell.toast('ignored'); shell.start(); assert.equal($('toast').textContent, '');
});

test('a missing optional HUD element never blocks the race', () => {
  const document = { getElementById: () => null, body: { classList: { add() {}, remove() {} } } } as unknown as Document;
  const shell = createRaceShell(document, {} as HTMLCanvasElement, { map: 'coast', driver: 'whale', audioFactory: () => null });
  assert.doesNotThrow(() => { shell.start(); shell.updateHUD(snapshot); shell.setPaused(true); shell.setPaused(false); shell.renderCountdown(0); shell.finish(finish); shell.showMenu(); shell.toast('test'); shell.tick(3); shell.drawMinimap([]); shell.dispose(); });
});

test('minimap fits different track bounds, caches the path and paints player last', () => {
  const calls: { name: string; args: number[] }[] = [];
  const context = new Proxy({}, { get: (_target, name: string) => (...args: number[]) => { calls.push({ name, args }); } });
  const sampled: number[] = [];
  const canvas = { width: 260, height: 230, getContext: () => context } as unknown as HTMLCanvasElement;
  const map = createRaceMinimap(canvas, { length: 100, samples: 20, sample(distance) { sampled.push(distance); const angle = distance / 100 * Math.PI * 2; return { p: { x: 2000 + Math.cos(angle) * 500, z: -900 + Math.sin(angle) * 100 } }; } });
  assert.equal(sampled.length, 20);
  map.draw([{ total: -25, player: true }, { total: 125 }]);
  assert.deepEqual(sampled.slice(-2), [25, 75]); assert.equal(calls.filter(call => call.name === 'arc').at(-1)!.args[2], 5.5);
  const points = calls.filter(call => ['moveTo', 'lineTo', 'arc'].includes(call.name));
  assert.ok(points.every(call => call.args[0] >= 14 && call.args[0] <= 246 && call.args[1] >= 14 && call.args[1] <= 216));
  map.draw([{ total: 0 }]); assert.equal(sampled.length, 23, 'only new dots are sampled after initial geometry');
  assert.doesNotThrow(() => createRaceMinimap(null, { length: 100, sample: () => ({ p: { x: 0, z: 0 } }) }).draw([]));
});

test('sound is shared across maps using an independent fail-safe preference', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  let creations = 0, tones = 0, closes = 0;
  const audioFactory = () => {
    creations++;
    return { currentTime: 0, resume: () => Promise.resolve(), close: () => { closes++; return Promise.resolve(); }, destination: {},
      createOscillator: () => ({ frequency: { value: 0 }, connect() {}, disconnect() {}, start() { tones++; }, stop() {} }),
      createGain: () => ({ connect() {}, disconnect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }),
    } as unknown as AudioContext;
  };
  const sound = createRaceSound({ storage, audioFactory });
  sound.tone(); assert.equal(creations, 0, 'audio is lazy and default-muted');
  sound.toggle(); sound.tone(); sound.tone(); assert.equal(creations, 1); assert.equal(tones, 2);
  assert.equal(values.get(RACE_SOUND_KEY), 'on'); assert.equal(createRaceSound({ storage, audioFactory }).muted, false);
  sound.toggle(); sound.tone(); assert.equal(tones, 2); assert.equal(values.get(RACE_SOUND_KEY), 'off');
  sound.dispose(); sound.dispose(); sound.toggle(); sound.tone(); assert.equal(closes, 1); assert.equal(tones, 2);
  const blocked = createRaceSound({ storage: { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } }, audioFactory() { throw Error('unsupported'); } });
  assert.equal(blocked.muted, true); assert.doesNotThrow(() => { blocked.toggle(); blocked.tone(); blocked.dispose(); });
});


test('the shared result table keeps all six authoritative rows and distinguishes unfinished racers', () => {
  const racers = [
    { id: 'claude', finishedAt: 88.002, total: 300 },
    { id: 'grok', finishedAt: 90.123, total: 300 },
    { id: 'whale', finishedAt: 91.345, total: 300 },
    { id: 'gpt', finishedAt: null, total: 288 },
    { id: 'glm', finishedAt: null, total: 245 },
    { id: 'gemini', finishedAt: null, total: 212 },
  ];
  const html = renderRaceResults({ ...finish, racers });
  assert.equal([...html.matchAll(/data-racer-id=/g)].length, 6);
  assert.deepEqual([...html.matchAll(/data-racer-id="([^"]+)"/g)].map(match => match[1]), racers.map(racer => racer.id));
  assert.equal([...html.matchAll(/class="result-state">已冲线/g)].length, 3);
  assert.equal([...html.matchAll(/class="result-state">未冲线/g)].length, 3);
  assert.match(html, /90.12 秒/);
  assert.match(html, /96.0%/);
  for (const row of html.match(/<tr class="[^"]*result-unfinished[^>]*>.*?<\/tr>/g) || []) assert.doesNotMatch(row, /秒/);
  assert.match(html, /<table class="result-table"><caption>本场比赛完整排名<\/caption>/);
  const escaped = renderRaceResults({ ...finish, racers: [{ id: '"<bad>', label: '<img src=x onerror=alert(1)>', finishedAt: Infinity, total: Infinity }] });
  assert.doesNotMatch(escaped, /<img|data-racer-id=""/);
  assert.match(escaped, /&lt;img/); assert.match(escaped, /未冲线/); assert.doesNotMatch(escaped, /Infinity|NaN/);
});
