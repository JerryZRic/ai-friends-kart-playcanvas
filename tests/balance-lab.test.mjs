import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
// UI scheduling/export test doubles only. Real racing is exercised by land-cpu-simulation and native gameplay tests.
test('CPU lab controls cancel stale work, pause, export exact options and release resources',async()=>{
const root = fileURLToPath(new URL('../',import.meta.url));
const source = fs.readFileSync(root + '/src/balance-lab.ts', 'utf8').replace(/^import .*;\n/gm, '');
const code = transformSync(source, { loader: 'ts', target: 'es2022' }).code;
const html = fs.readFileSync(root + '/balance-lab.html', 'utf8');
const config = fs.readFileSync(root + '/vite.config.ts', 'utf8');
assert.match(config, /balance:\s*'balance-lab\.html'/);
assert.match(html, /href="\.\/index\.html"/);
assert.match(html, /src="\/src\/balance-lab\.ts"/);
let frames = new Map(), frameId = 0, timeouts = new Map(), timeoutId = 0;
let loads = [], races = [], downloads = [], blobs = new Map(), fetches = [];
let targetSteps = 10000, clock = 0;
class Element {
  constructor(tag = 'div') { this.tagName = tag; this.children = []; this.style = {}; this.dataset = {}; this.events = {}; this.value = ''; this.disabled = false; this.hidden = false; this._text = ''; }
  get textContent() { return this._text || this.children.map(child => typeof child === 'string' ? child : child.textContent).join(''); }
  set textContent(value) { this._text = value; this.children = []; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this._text = ''; this.children = [...children]; }
  addEventListener(name, callback) { (this.events[name] ??= []).push(callback); }
  emit(name) { for (const callback of this.events[name] ?? []) callback({ preventDefault() {} }); }
  reportValidity() { return true; }
  remove() {}
  click() { if (this.tagName === 'a') downloads.push({ href: this.href, name: this.download }); else this.emit('click'); }
}
const elements = new Map([...html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"/g)].map(([, tag, id]) => [id, new Element(tag)]));
for (const [id, value] of Object.entries({ map: 'coast', seed: '20261014', rotation: '0', difficulty: 'normal', equipment: 'equal', items: 'on' })) elements.get(id).value = value;
const canvas = elements.get('track-map');
canvas.width = 960; canvas.height = 560;
canvas.getContext = () => new Proxy({}, { get(target, key) { return target[key] ?? (() => {}); }, set(target, key, value) { target[key] = value; return true; } });
const document = Object.assign(new Element(), { hidden: false, getElementById: id => elements.get(id), createElement: tag => new Element(tag), body: new Element('body') });
const window = new Element('window');
const maps = ['coast','mountain','town','quarry','forest','workshop','harvest','desert','snow','caldera','garden','airfield'];
const characterIds = ['whale', 'gemini', 'gpt', 'claude', 'grok', 'glm'];
const course = { id: 'coast', length: 100, routes: null, sample: distance => ({ p: { x: Math.sin(distance) * 10, z: Math.cos(distance) * 10 } }) };
function mockRace(course, options) {
  let steps = 0;
  const finish = targetSteps;
  const actors = characterIds.map((id, seat) => ({ id: `seat-${seat}`, characterId: id, seat, speed: seat + .123 }));
  const race = { actors, options, course, throwOnStep: false, get elapsed() { return steps / 60; }, get done() { return steps >= finish; }, step(dt) { assert.equal(dt, 1/60); if (this.throwOnStep) throw new Error('test step failure'); steps++; }, position: actor => ({ x: actor.seat, z: actor.seat }), result() { return { map: course.id, seed: options.seed, rotation: options.rotation, difficulty: options.difficulty, equipment: options.equipment, items: options.items, elapsed: steps / 60, steps, complete: this.done, timeout: false, winner: this.done ? 'whale' : null, racers: actors.map((actor, i) => ({ ...actor, rank: i + 1, finishedAt: this.done ? 1 + i / 10 : null, dnf: !this.done, total: steps, laps: this.done ? 3 : 0, lapTimes: [1,2,3], branches: ['alley','boulevard'], pickups: i, uses: 0, collisionCount: 0, railContacts: 0, build: { title: 'a,"quoted"' } })) }; } };
  races.push(race); return race;
}
const sandbox = { document, window, console, Blob, AbortController, Map, Error, JSON, Number, String, Object, performance: { now: () => clock += .2 }, createCpuRace: mockRace, LAND_SIMULATION_MAPS: maps, CHARACTER_PROFILES: characterIds.map(id => ({ id, label: id.toUpperCase(), color: '#ffffff' })), loadLandSimulationCourse: id => new Promise((resolve, reject) => loads.push({ id, resolve, reject })), requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; }, cancelAnimationFrame: id => frames.delete(id), setTimeout: fn => { timeouts.set(++timeoutId, fn); return timeoutId; }, clearTimeout: id => timeouts.delete(id), URL: { createObjectURL: blob => { const url = `blob:${blobs.size}`; blobs.set(url, blob); return url; }, revokeObjectURL: url => blobs.delete(url) }, fetch: (url, options) => new Promise((resolve, reject) => { fetches.push({ url, options, resolve, reject }); options.signal.addEventListener('abort', () => reject(new Error('aborted'))); }) };
const context = vm.createContext(sandbox);
vm.runInContext(code, context);
const get = id => elements.get(id);
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const flush = () => { const callbacks = [...frames.values()]; frames.clear(); for (const callback of callbacks) callback(); };
const submit = () => get('race-form').emit('submit');
assert.equal(get('map').children.length, 12);
submit(); submit(); assert.equal(loads.length, 1, 'repeated start cannot create duplicate loads');
assert.equal(get('start').disabled, true);
get('reset').click(); get('seed').value = '7'; get('map').value = 'town'; submit(); assert.equal(loads.length, 2);
loads[0].resolve(course); await settle(); assert.equal(races.length, 0, 'cancelled load cannot create stale race');
loads[1].resolve({ ...course, id: 'town', routes: { edges: { start: { length: 20, sample: course.sample }, alley: { length: 30, sample: course.sample }, boulevard: { length: 35, sample: course.sample }, finish: { length: 40, sample: course.sample } } } }); await settle();
assert.equal(races.length, 1); assert.equal(races[0].options.seed, 7); assert.equal(frames.size, 1); assert.equal(get('standings').children.length, 6);
flush(); assert.ok(races[0].result().steps > 0 && races[0].result().steps <= 120); assert.equal(frames.size, 1);
get('pause').click(); const pausedSteps = races[0].result().steps; assert.equal(frames.size, 0); flush(); assert.equal(races[0].result().steps, pausedSteps);
get('pause').click(); assert.equal(frames.size, 1); get('pause').click(); assert.equal(frames.size, 0); get('pause').click(); assert.equal(frames.size, 1);
document.hidden = true; document.emit('visibilitychange'); assert.equal(frames.size, 0); assert.match(get('status').textContent, /自动暂停/); document.hidden = false; document.emit('visibilitychange'); assert.equal(frames.size, 0); get('pause').click(); assert.equal(frames.size, 1);
get('reset').click(); assert.equal(frames.size, 0); assert.equal(get('download-json').disabled, true);
// A hidden-page load cannot start work until explicitly resumed.
submit(); document.hidden = true; loads.at(-1).resolve(course); await settle(); assert.equal(frames.size, 0); assert.equal(get('pause').textContent, '继续'); document.hidden = false; get('reset').click();
// Complete one short fake race to exercise exports without competing with the baseline runner.
targetSteps = 3; get('items').value = 'off'; get('equipment').value = 'mixed'; get('rotation').value = '5'; get('difficulty').value = 'hard'; submit(); loads.at(-1).resolve(course); await settle(); flush();
assert.equal(frames.size, 0); assert.equal(get('download-json').disabled, false); assert.equal(get('race-settings').disabled, false); assert.match(get('status').textContent, /均已完赛/);
get('seed').value = '99'; get('download-json').click(); get('download-csv').click(); assert.equal(downloads.length, 2);
const json = JSON.parse(await blobs.get(downloads[0].href).text()); assert.equal(json.seed, 7, 'export must describe the completed run, not edited controls'); assert.equal(json.items, false); assert.equal(json.rotation, 5); assert.equal(json.equipment, 'mixed'); assert.equal(json.racers.length, 6);
const csv = await blobs.get(downloads[1].href).text(); assert.equal(csv.trim().split('\r\n').length, 7); assert.ok(csv.includes('quoted')); assert.ok(csv.includes('""title""')); assert.match(downloads[1].name, /-hard-mixed-noitems\.csv$/);
// Bad parameters and simulation exceptions must be visible and resettable.
get('seed').value = '-1'; submit(); assert.match(get('status').textContent, /参数无效/);
get('reset').click(); get('seed').value = '123'; targetSteps = 20; submit(); loads.at(-1).resolve(course); await settle(); races.at(-1).throwOnStep = true; flush(); assert.match(get('status').textContent, /test step failure/); assert.equal(frames.size, 0); assert.equal(get('download-csv').disabled, true);
get('reset').click();
// Optional report reads: unavailable data, valid data, and pagehide cancellation.
get('load-summary').click(); get('load-summary').click(); assert.equal(fetches.length, 1); assert.equal(fetches[0].url, './balance-results/summary.json'); fetches[0].resolve({ ok: false, status: 404 }); await settle(); assert.match(get('summary-status').textContent, /未提供可读取/); assert.equal(get('load-summary').disabled, false);
get('load-summary').click(); fetches[1].resolve({ ok: true, json: async () => ({ complete: true, runs: 144 }) }); await settle(); assert.equal(get('summary-details').hidden, false); assert.match(get('summary-content').textContent, /144/);
get('load-summary').click(); submit(); window.emit('pagehide'); await settle(); assert.equal(fetches[2].options.signal.aborted, true); loads.at(-1).resolve(course); await settle(); assert.equal(frames.size, 0); assert.equal(get('race-settings').disabled, false); assert.equal(blobs.size, 0); assert.equal(timeouts.size, 0);
});
