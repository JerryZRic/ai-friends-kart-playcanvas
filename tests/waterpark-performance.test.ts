import test from 'node:test';
import assert from 'node:assert/strict';
import { PerformanceCapture } from '../src/waterpark-performance';

const close = (actual: number | null, expected: number) => {
  assert.notEqual(actual, null);
  assert.ok(Math.abs(actual! - expected) < 1e-6, `${actual} should equal ${expected}`);
};

test('performance capture begins idle and does not invent data before two active frames', () => {
  const capture = new PerformanceCapture();
  capture.sample(20, true);
  assert.equal(capture.snapshot(20).status, 'idle');
  capture.start(100);
  capture.sample(100, true);
  const result = capture.snapshot(100);
  assert.equal(result.status, 'recording');
  assert.equal(result.frames, 0);
  assert.equal(result.activeMs, 0);
  assert.equal(result.averageFps, null);
  assert.equal(result.medianMs, null);
  assert.equal(result.p95Ms, null);
  assert.equal(result.p99Ms, null);
});

test('performance capture uses frame count over raw active time, not mean instantaneous FPS', () => {
  const capture = new PerformanceCapture();
  capture.start(0);
  for (const now of [0, 10, 30, 280]) capture.sample(now, true);
  const result = capture.snapshot(280);
  assert.equal(result.frames, 3);
  assert.equal(result.activeMs, 280);
  assert.equal(result.wallMs, 280);
  close(result.averageFps, 3000 / 280);
  assert.equal(result.medianMs, 20);
  assert.equal(result.p95Ms, 250);
  assert.equal(result.p99Ms, 250);
  assert.deepEqual(result.longFrames, { over33_3ms: 1, over50ms: 1, over100ms: 1 });
});

test('paused and hidden frames cannot bridge active segments or create catch-up spikes', () => {
  const capture = new PerformanceCapture();
  capture.start(0);
  capture.sample(0, true);
  capture.sample(20, true);
  capture.sample(30, false, 'hidden');
  capture.sample(1000, false, 'hidden');
  capture.sample(5000, true);
  capture.sample(5020, true);
  capture.sample(5030, false, 'paused');
  capture.sample(5040, false, 'paused');
  capture.sample(8000, true);
  capture.sample(8020, true);
  const result = capture.snapshot(8020);
  assert.equal(result.frames, 3);
  assert.equal(result.activeMs, 60);
  assert.equal(result.wallMs, 8020);
  assert.equal(result.averageFps, 50);
  assert.equal(result.p99Ms, 20);
  assert.deepEqual(result.interruptions, { hidden: 1, paused: 1 });
  assert.deepEqual(result.longFrames, { over33_3ms: 0, over50ms: 0, over100ms: 0 });
});

test('explicit interruptions invalidate the anchor and count once per active segment', () => {
  const capture = new PerformanceCapture();
  capture.start(0);
  capture.sample(0, true);
  capture.sample(10, true);
  capture.interrupt('hidden');
  capture.interrupt('hidden');
  capture.sample(10000, true);
  capture.sample(10010, true);
  assert.equal(capture.snapshot(10010).activeMs, 20);
  assert.deepEqual(capture.snapshot(10010).interruptions, { hidden: 1 });
});

test('capture finishes after the target active time using the entire crossing interval', () => {
  const capture = new PerformanceCapture(100);
  capture.start(1000);
  for (const now of [1000, 1040, 1080, 1120]) capture.sample(now, true);
  const completed = capture.snapshot(1120);
  assert.equal(completed.status, 'complete');
  assert.equal(completed.frames, 3);
  assert.equal(completed.activeMs, 120);
  assert.equal(completed.wallMs, 120);
  assert.equal(completed.averageFps, 25);
  capture.sample(9000, true);
  capture.interrupt('hidden');
  capture.cancel(10000);
  assert.deepEqual(capture.snapshot(11000), completed);
});

test('wall time alone cannot complete a paused capture', () => {
  const capture = new PerformanceCapture(100);
  capture.start(0);
  capture.sample(0, true);
  capture.sample(20, true);
  capture.sample(30, false);
  capture.sample(100000, false);
  const result = capture.snapshot(100000);
  assert.equal(result.status, 'recording');
  assert.equal(result.activeMs, 20);
  assert.equal(result.frames, 1);
});

test('cancel freezes existing data without counting an unfinished frame interval', () => {
  const capture = new PerformanceCapture();
  capture.start(100);
  capture.sample(100, true);
  capture.sample(120, true);
  capture.cancel(500);
  const cancelled = capture.snapshot(500);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.frames, 1);
  assert.equal(cancelled.activeMs, 20);
  assert.equal(cancelled.wallMs, 400);
  capture.sample(510, true);
  capture.cancel(1000);
  capture.interrupt('hidden');
  assert.deepEqual(capture.snapshot(1000), cancelled);
});

test('start resets cancelled and complete captures', () => {
  const capture = new PerformanceCapture(20);
  capture.start(0);
  capture.sample(0, true);
  capture.sample(10, true);
  capture.interrupt('paused');
  capture.cancel(100);
  capture.start(1000);
  capture.sample(1000, true);
  capture.sample(1020, true);
  assert.equal(capture.snapshot(1020).status, 'complete');
  capture.start(2000);
  capture.sample(2000, true);
  capture.sample(2010, true);
  capture.cancel(2020);
  capture.start(3000);
  const result = capture.snapshot(3000);
  assert.equal(result.status, 'recording');
  assert.equal(result.frames, 0);
  assert.equal(result.activeMs, 0);
  assert.equal(result.wallMs, 0);
  assert.equal(result.averageFps, null);
  assert.deepEqual(result.interruptions, {});
  assert.deepEqual(result.longFrames, { over33_3ms: 0, over50ms: 0, over100ms: 0 });
  capture.sample(3010, true);
  assert.equal(capture.snapshot(3010).frames, 0);
});

test('non-finite timestamps break the anchor without poisoning subsequent samples', () => {
  for (const invalid of [NaN, Infinity, -Infinity]) {
    const capture = new PerformanceCapture();
    capture.start(0);
    capture.sample(0, true);
    capture.sample(10, true);
    capture.sample(invalid, true);
    capture.sample(1000, true);
    capture.sample(1020, true);
    const result = capture.snapshot(1020);
    assert.equal(result.frames, 2);
    assert.equal(result.activeMs, 30);
    close(result.averageFps, 2000 / 30);
  }
});

test('duplicate and backwards timestamps break the anchor rather than adding invalid intervals', () => {
  for (const invalid of [10, 5]) {
    const capture = new PerformanceCapture();
    capture.start(0);
    capture.sample(0, true);
    capture.sample(10, true);
    capture.sample(invalid, true);
    capture.sample(1000, true);
    capture.sample(1020, true);
    const result = capture.snapshot(1020);
    assert.equal(result.frames, 2);
    assert.equal(result.activeMs, 30);
    assert.equal(result.p99Ms, 20);
  }
});

test('long-frame thresholds are strict and cumulative', () => {
  const capture = new PerformanceCapture();
  capture.start(0);
  let now = 0;
  capture.sample(now, true);
  for (const interval of [33, 34, 50, 51, 100, 101]) {
    now += interval;
    capture.sample(now, true);
  }
  assert.deepEqual(capture.snapshot(now).longFrames, { over33_3ms: 5, over50ms: 3, over100ms: 1 });
});

test('a full 60-second capture completes at the default target', () => {
  const capture = new PerformanceCapture();
  capture.start(0);
  capture.sample(0, true);
  for (let frame = 1; frame < 3000; frame++) capture.sample(frame * 20, true);
  assert.equal(capture.snapshot(59980).status, 'recording');
  capture.sample(60000, true);
  const result = capture.snapshot(60000);
  assert.equal(result.status, 'complete');
  assert.equal(result.frames, 3000);
  assert.equal(result.activeMs, 60000);
  assert.equal(result.averageFps, 50);
  assert.equal(result.medianMs, 20);
  assert.equal(result.p95Ms, 20);
  assert.equal(result.p99Ms, 20);
});

test('a duplicate start while recording does not reset or stretch the capture', () => {
  const capture = new PerformanceCapture();
  capture.start(0);
  capture.sample(0, true);
  capture.sample(10, true);
  capture.start(15);
  capture.sample(20, true);
  const result = capture.snapshot(20);
  assert.equal(result.frames, 2);
  assert.equal(result.activeMs, 20);
  assert.equal(result.wallMs, 20);
});

test('percentiles use nearest-rank across the recorded interval distribution', () => {
  const capture = new PerformanceCapture();
  capture.start(0);
  let now = 0;
  capture.sample(now, true);
  for (let interval = 1; interval <= 100; interval++) {
    now += interval;
    capture.sample(now, true);
  }
  const result = capture.snapshot(now);
  assert.equal(result.medianMs, 50);
  assert.equal(result.p95Ms, 95);
  assert.equal(result.p99Ms, 99);
});

test('bounded percentile retention does not truncate all-capture counts or active time', () => {
  const capture = new PerformanceCapture(1000000);
  capture.start(0);
  let now = 0;
  capture.sample(now, true);
  for (let frame = 0; frame < 33768; frame++) {
    now += frame < 1000 ? 100 : 1;
    capture.sample(now, true);
  }
  const result = capture.snapshot(now);
  assert.equal(result.frames, 33768);
  assert.equal(result.activeMs, 132768);
  close(result.averageFps, 33768000 / 132768);
  assert.equal(result.percentileSamples, 32768);
  assert.equal(result.percentileScope, 'latest 32768 intervals');
  assert.equal(result.medianMs, 1);
  assert.equal(result.p95Ms, 1);
  assert.equal(result.p99Ms, 1);
  assert.deepEqual(result.longFrames, { over33_3ms: 1000, over50ms: 1000, over100ms: 0 });
});

test('snapshots cannot mutate internal threshold and interruption data', () => {
  const capture = new PerformanceCapture();
  capture.start(0);
  capture.sample(0, true);
  capture.sample(100, true);
  capture.interrupt('hidden');
  const first = capture.snapshot(100);
  first.longFrames.over50ms = 999;
  first.interruptions.hidden = 999;
  const second = capture.snapshot(100);
  assert.equal(second.longFrames.over50ms, 1);
  assert.equal(second.interruptions.hidden, 1);
});
