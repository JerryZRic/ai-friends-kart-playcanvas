import test from 'node:test';
import assert from 'node:assert/strict';
import {MOUNTAIN_TRACK as track} from '../src/maps/mountain';
import {advanceLapProgress, createLapProgress, landSupportAt, rebaseLapProgress} from '../src/land-track';

test('canonical checkpoints reject reverse credit, wrap jumps, teleports and off-road shortcuts', () => {
  const initial = createLapProgress(track);
  const moved = advanceLapProgress(track, initial, 1, 1 / 60);
  assert.equal(moved.accepted, true);
  for (const [candidate, dt, lateral, reason] of [[200,1/60,0,'teleport'], [2,2,0,'invalid-step'], [NaN,1/60,0,'invalid-step']] as const) {
    const result = advanceLapProgress(track, moved.state, candidate, dt, lateral);
    assert.equal(result.accepted, false); assert.equal(result.reason, reason); assert.equal(result.state, moved.state);
  }
  const reversed = advanceLapProgress(track, moved.state, 0, 1 / 60);
  assert.equal(reversed.accepted, true); assert.equal(reversed.state.distance, 0);
  assert.equal(reversed.state.nextCheckpoint, moved.state.nextCheckpoint);
  const offRoad = advanceLapProgress(track, moved.state, 2, 1 / 60, 20);
  assert.equal(offRoad.accepted, false); assert.equal(offRoad.state.distance, 2);
  assert.equal(offRoad.state.nextCheckpoint, moved.state.nextCheckpoint);
  let state = createLapProgress(track);
  for (let d = 5; d <= track.length; d += 5) state = advanceLapProgress(track, state, d, .1).state;
  const seam = advanceLapProgress(track, state, track.length + 1, .1);
  assert.equal(seam.accepted, true); assert.equal(seam.state.laps, 1);
  const falseWrap = advanceLapProgress(track, seam.state, 2, .1);
  assert.equal(falseWrap.accepted, false); assert.equal(falseWrap.state.laps, 1);
  // Starting late in the course does not award a full lap at the first finish line.
  let partial = createLapProgress(track, track.length - 3);
  partial = advanceLapProgress(track, partial, track.length + 1, .1).state;
  assert.equal(partial.laps, 0);
  // Oscillating over the finish can never re-earn a checkpoint.
  let repeated = seam.state;
  for (let i = 0; i < 100; i++) {
    repeated = advanceLapProgress(track, repeated, track.length - 1, .1).state;
    repeated = advanceLapProgress(track, repeated, track.length + 1, .1).state;
  }
  assert.equal(repeated.laps, 1);
  // Off-road passage or reset past an unearned gate must return to that gate.
  const gate = track.length / 12;
  const skipped = rebaseLapProgress(initial, gate + 1);
  assert.equal(advanceLapProgress(track, skipped, gate + 2, .1).state.nextCheckpoint, 1);
  const returned = advanceLapProgress(track, skipped, gate - 1, .1).state;
  assert.equal(advanceLapProgress(track, returned, gate + 1, .1).state.nextCheckpoint, 2);
});

test('seeded NPC-like constrained traversal keeps support finite and credits exactly twelve complete laps', () => {
  let seed = 20261010, state = createLapProgress(track), d = 0, lastY = track.sample(0).p.y, frames = 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  while (d < track.length * 12) {
    const dt = 1 / 30, speed = 22 + random() * 20;
    d = Math.min(track.length * 12 + .001, d + speed * dt);
    const lateral = Math.sin(d / 90) * 4;
    const result = advanceLapProgress(track, state, d, dt, lateral);
    assert.equal(result.accepted, true); state = result.state;
    const support = landSupportAt(track, d, lateral);
    assert.ok(support.p.toArray().every(Number.isFinite));
    assert.ok(Math.abs(support.p.y - lastY) < .5, 'No snapping between crossing levels');
    lastY = support.p.y; frames++;
  }
  assert.ok(frames > 35000); assert.equal(state.laps, 12);
});
