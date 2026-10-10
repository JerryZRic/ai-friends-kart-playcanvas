import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {garageSpinDelta, garagePointerDelta} from '../src/kart-garage-motion';
test('showroom spin clamps stalls and never jumps after hidden/reduced motion/interaction', () => {
  assert.equal(garageSpinDelta(1000, null, true, false, 0), 0);
  assert.equal(garageSpinDelta(1016, 1000, true, false, 0), .128);
  assert.equal(garageSpinDelta(10000, 1000, true, false, 0), .4);
  assert.equal(garageSpinDelta(1016, 1000, false, false, 0), 0);
  assert.equal(garageSpinDelta(1016, 1000, true, true, 0), 0);
  assert.equal(garageSpinDelta(1016, 1000, true, false, 2000), 0);
  assert.equal(garageSpinDelta(2016, 1000, true, false, 2000), .128);
  assert.equal(garageSpinDelta(1000, 1016, true, false, 0), 0);
  for (const bad of [NaN, Infinity, -Infinity]) assert.equal(garageSpinDelta(bad, 1000, true, false, 0), 0);
});
test('equal visual drags retain logical camera sensitivity through uniform scales', () => {
  for (const scale of [.25, .5, .864, 1, 1.5, 2]) assert.ok(Math.abs(garagePointerDelta(30 * scale, 600 * scale, 600) - 30) < 1e-10);
  assert.equal(garagePointerDelta(1, 0, 100), 0);
  assert.equal(garagePointerDelta(NaN, 10, 10), 0);
});
test('preview owns animation, motion preference, physical resolution and cleanup', () => {
  const source = readFileSync('src/kart-garage.ts', 'utf8');
  assert.match(source, /garageSpinDelta/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /motionPreference\?\.removeEventListener\('change', motionChanged\)/);
  assert.match(source, /pc.RESOLUTION_FIXED, size.width, size.height/);
  assert.match(source, /document.hidden/);
  assert.match(source, /id="preview-spin"[^>]*aria-pressed/);
});
