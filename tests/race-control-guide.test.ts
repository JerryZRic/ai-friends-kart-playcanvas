import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RACE_KEY_GUIDE, RACE_CONTROL_GUIDE_MARKUP} from '../src/race-control-guide';
import {RACE_LOADING_MARKUP} from '../src/race-loading-ui';
import {bindRaceControls, type RaceControlState} from '../src/race-controls';
import {driveInput} from '../src/vehicle-controls.js';

const read = (path: string) => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');
const codesFor = (id: string) => RACE_KEY_GUIDE.find(entry => entry.id === id)!.codes;

test('the shared loading guide covers every bound keyboard code exactly once', () => {
  const binding = read('race-controls.ts');
  const handled = binding.match(/const handledCodes = new Set\(\[([^\]]+)\]\)/)![1];
  const boundCodes = [...handled.matchAll(/'([^']+)'/g)].map(match => match[1]);
  // Enter is intentionally not prevented: native button activation must work.
  assert.match(binding, /code === 'Enter' && \(state === 'menu' \|\| state === 'finished'\)/);
  boundCodes.push('Enter');
  const documentedCodes = RACE_KEY_GUIDE.flatMap(entry => [...entry.codes]);
  assert.equal(new Set(documentedCodes).size, documentedCodes.length);
  assert.deepEqual([...documentedCodes].sort(), boundCodes.sort());
  const physicalDriveCodes = [...read('vehicle-controls.js').matchAll(/keys\.((?:Key|Arrow|Shift)\w+|Space)/g)].map(match => match[1]);
  for (const code of physicalDriveCodes) assert.ok(documentedCodes.includes(code as any), code);
  assert.ok(RACE_LOADING_MARKUP.includes(RACE_CONTROL_GUIDE_MARKUP), 'both maps mount this one complete guide');
  for (const entry of RACE_KEY_GUIDE) {
    assert.ok(RACE_CONTROL_GUIDE_MARKUP.includes(`data-key-codes="${entry.codes.join(' ')}"`));
    assert.equal(entry.keys.length, entry.labels.length, entry.id + ' has accessible key names');
  }
});

function fixture() {
  class Target extends EventTarget {
    pointerLockElement = null;
    querySelectorAll() { return []; }
  }
  const canvas = new Target(), win = new Target(), doc = new Target();
  let state: RaceControlState = 'active';
  const calls = {camera: 0, item: 0, recenter: 0, start: 0};
  const controls = bindRaceControls(canvas as any, {
    window: win as any, document: doc as any, state: () => state,
    pause: () => { state = state === 'active' ? 'paused' : 'active'; },
    useItem: () => { if (state === 'active') calls.item++; },
    switchCamera: () => { calls.camera++; }, recenter: () => { calls.recenter++; },
    start: () => { calls.start++; }, status: () => {},
  });
  function key(type: string, code: string) {
    const event = new Event(type, {cancelable: true});
    Object.defineProperties(event, {code: {value: code}, target: {value: canvas}});
    win.dispatchEvent(event);
  }
  return {controls, calls, key, state: () => state, setState: (value: RaceControlState) => { state = value; }};
}

test('every displayed driving alias activates its documented real input', () => {
  const f = fixture();
  const expected = {throttle: ['throttle', true], reverse: ['reverse', true], left: ['steer', -1], right: ['steer', 1], brake: ['brake', true], drift: ['handbrake', true]} as const;
  for (const [id, [property, value]] of Object.entries(expected)) {
    for (const code of codesFor(id)) {
      f.key('keydown', code);
      assert.equal(driveInput(f.controls.keys)[property], value, id + ' / ' + code);
      f.key('keyup', code);
      assert.equal(driveInput(f.controls.keys)[property], property === 'steer' ? 0 : false);
    }
  }
  f.controls.dispose();
});

test('displayed action keys preserve camera, item, P, Esc and state-qualified Enter semantics', () => {
  const f = fixture();
  for (const id of ['item', 'camera', 'recenter']) for (const code of codesFor(id)) {
    f.key('keydown', code); f.key('keyup', code);
  }
  assert.deepEqual(f.calls, {camera: 2, item: 1, recenter: 1, start: 0});
  f.key('keydown', codesFor('pause')[0]); assert.equal(f.state(), 'paused');
  f.key('keydown', codesFor('release')[0]); assert.equal(f.state(), 'paused', 'Esc never resumes');
  f.key('keydown', codesFor('pause')[0]); assert.equal(f.state(), 'active');
  f.key('keydown', codesFor('release')[0]); assert.equal(f.state(), 'paused');
  for (const state of ['active', 'paused', 'loading'] as const) { f.setState(state); f.key('keydown', codesFor('start')[0]); }
  assert.equal(f.calls.start, 0, 'Enter does not skip downloading or restart a live race');
  for (const state of ['menu', 'finished'] as const) { f.setState(state); f.key('keydown', codesFor('start')[0]); }
  assert.equal(f.calls.start, 2);
  assert.match(RACE_CONTROL_GUIDE_MARKUP, /就绪菜单开始 \/ 结算后再来一局/);
  assert.match(RACE_CONTROL_GUIDE_MARKUP, /下载中不能用 Enter 跳过/);
  assert.match(RACE_CONTROL_GUIDE_MARKUP, /聚焦按钮后，Enter \/ Space 可确认/);
  f.controls.dispose();
});

test('mouse diagrams explain actual lock, drag fallback and held rear view without invented wheel zoom', () => {
  for (const id of ['orbit', 'drag', 'rear']) assert.match(RACE_CONTROL_GUIDE_MARKUP, new RegExp(`data-mouse-control="${id}"`));
  assert.match(RACE_CONTROL_GUIDE_MARKUP, /先左键单击赛道锁定鼠标/);
  assert.match(RACE_CONTROL_GUIDE_MARKUP, /无法锁定时环顾/);
  assert.match(RACE_CONTROL_GUIDE_MARKUP, /按住右键/);
  assert.match(RACE_CONTROL_GUIDE_MARKUP, /松开恢复原视角/);
  assert.match(read('mouse-look.js'), /if \(fallback\) \{ dragging = true/);
  assert.match(read('race-controls.ts'), /canMove: \(\) => !keys.RearView/);
  assert.doesNotMatch(RACE_CONTROL_GUIDE_MARKUP, /滚轮|缩放|wheel|zoom/i);
  assert.doesNotMatch(read('race-control-guide.ts'), /addEventListener|preventDefault|requestPointerLock\(/, 'guide is strictly presentation-only');
});
