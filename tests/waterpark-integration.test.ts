import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWaterparkInput,isWaterparkGameKeyTarget} from '../src/waterpark-input';
import {createWaterparkLifetime} from '../src/waterpark-lifetime';
import {MAP_PROFILES} from '../src/map-profiles';

test('touch capture, overlapping pointers, keyboard releases and pause clear stay independent', () => {
  const input = createWaterparkInput();
  input.keyDown('KeyW'); input.pointerDown(1, 'KeyW'); input.keyUp('KeyW');
  assert.equal(input.pressed('KeyW'), true);
  input.pointerDown(2, 'KeyW'); input.pointerUp(1); assert.equal(input.pressed('KeyW'), true);
  input.keyDown('KeyW'); input.pointerUp(2); assert.equal(input.pressed('KeyW'), true);
  input.keyDown('KeyA'); input.pointerDown(3, 'KeyD'); input.clear();
  for (const code of ['KeyW', 'KeyA', 'KeyD']) assert.equal(input.pressed(code), false);
  input.pointerUp(3); input.keyUp('KeyA'); input.keyDown('KeyS');
  assert.equal(input.pressed('KeyS'), true);
});

test('canvas/body accept driving keys while focused menu elements retain native keys', () => {
  const canvas = {tagName: 'CANVAS'} as HTMLCanvasElement;
  assert.equal(isWaterparkGameKeyTarget(canvas, canvas), true);
  for (const tagName of ['BODY','HTML']) assert.equal(isWaterparkGameKeyTarget({tagName} as HTMLElement, canvas), true);
  for (const tagName of ['BUTTON','A','INPUT','SELECT','TEXTAREA']) assert.equal(isWaterparkGameKeyTarget({tagName} as HTMLElement, canvas), false);
});

test('exiting during GLB preparation aborts work and waits for its parser before one disposal', async () => {
  let settle!: () => void, disposal = 0, observed!: AbortSignal;
  const lifetime = createWaterparkLifetime(() => disposal++);
  const load = lifetime.run(async signal => { observed = signal; await new Promise<void>(resolve => settle = resolve); return 'loaded'; });
  lifetime.close(); lifetime.close();
  assert.equal(lifetime.closed, true); assert.equal(observed.aborted, true); assert.equal(disposal, 0);
  await assert.rejects(lifetime.run(async () => 'never'), {name: 'AbortError'});
  settle(); assert.equal(await load, 'loaded'); assert.equal(disposal, 1);
  lifetime.close(); assert.equal(disposal, 1);
});

test('retry rejection releases lifetime work, and ordinary close disposes immediately', async () => {
  let disposal = 0;
  const lifetime = createWaterparkLifetime(() => disposal++);
  await assert.rejects(lifetime.run(async () => { throw new Error('failed asset'); }), /failed asset/);
  assert.equal(disposal, 0);
  assert.equal(await lifetime.run(async () => 'ready subset'), 'ready subset');
  lifetime.close(); assert.equal(disposal, 1);
});

test('both map entries remain relative and keep the kart runtime isolated from the waterpark', () => {
  const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  for (const map of Object.values(MAP_PROFILES)) {
    assert.match(map.entry, /^\.\/[a-z-]+\.html$/);
    const html = read(map.entry);
    for (const prefix of ['/', '/preview/nested/']) assert.ok(new URL(map.entry, `https://example.invalid${prefix}`).pathname.startsWith(prefix));
  }
  const coast = read('coast.html'), waterpark = read('waterpark.html'), study = read('waterpark-study.html');
  assert.match(coast, /src\/game\.ts/); assert.match(read('index.html'), /src\/menu\.ts/);
  assert.doesNotMatch(coast, /src\/waterpark-play\.ts/);
  assert.match(waterpark, /src\/waterpark-play\.ts/); assert.doesNotMatch(waterpark, /src\/game\.ts/);
  assert.match(study, /src\/waterpark-preview\.ts/);
});
