import test from 'node:test';
import assert from 'node:assert/strict';
import {MOUNTAIN_TRACK as track, MOUNTAIN_POINTS} from '../src/maps/mountain';
import {landSupportAt, resetLandSupport, createLandTrack} from '../src/land-track';

const atKnot = (index: number) => track.circuit.arcs[index * track.circuit.arcSteps / MOUNTAIN_POINTS.length];

test('mountain has meaningful relief, technical curvature, separated roads and a real grade-separated crossing', () => {
  const samples = Array.from({length: Math.ceil(track.length / 4)}, (_, i) => { const d = i * 4; return {d, ...track.sample(d)}; });
  const elevations = samples.map(s => s.p.y);
  assert.ok(Math.max(...elevations) - Math.min(...elevations) >= 30);
  assert.ok(Math.max(...elevations) - Math.min(...elevations) <= 50);
  assert.ok(samples.every(s => Math.abs(s.grade) < .20));
  assert.ok(samples.every(s => Math.abs(track.circuit.curvature(s.d)) < .05));
  let overlapPairs = 0, minimumClearance = Infinity;
  for (let i = 0; i < samples.length; i++) for (let j = i + 1; j < samples.length; j++) {
    const a = samples[i], b = samples[j], delta = Math.abs(a.d - b.d);
    if (Math.min(delta, track.length - delta) < 70) continue;
    const horizontal = Math.hypot(a.p.x - b.p.x, a.p.z - b.p.z);
    if (horizontal < track.halfWidthAt(a.d) + track.halfWidthAt(b.d) + 2) {
      overlapPairs++;
      // Conservative allowance for camber and underside of the rendered slab.
      const clearance = Math.abs(a.p.y - b.p.y) - 2 * 9.5 * Math.sin(.16) - 1;
      minimumClearance = Math.min(minimumClearance, clearance);
      assert.ok(clearance >= 8, `Road collision at ${a.d} / ${b.d}: ${clearance}`);
      assert.ok(Math.abs(a.p.x) < 30 && Math.abs(a.p.z) < 45, 'Only the designated central viaduct crosses');
    }
  }
  assert.ok(overlapPairs > 0); assert.ok(minimumClearance > 30);
});

test('banked support, render sampling and reset resolve the correct crossing altitude', () => {
  const upperD = atKnot(13), lowerD = atKnot(28);
  const upper = landSupportAt(track, upperD), lower = landSupportAt(track, lowerD);
  assert.ok(Math.hypot(upper.p.x - lower.p.x, upper.p.z - lower.p.z) < 1e-6);
  assert.ok(upper.p.y - lower.p.y > 35);
  for (const distance of [upperD, lowerD, upperD + 10 * track.length, lowerD - 3 * track.length]) {
    const reset = resetLandSupport(track, distance);
    assert.equal(reset.distance, distance);
    assert.ok(reset.p.distance(track.sample(distance).p) < .601);
    assert.ok(Math.abs(reset.p.y - track.sample(distance).p.y - .6) < .01);
  }
  const hairpin = atKnot(5), right = track.sample(hairpin, 7), left = track.sample(hairpin, -7);
  assert.ok(Math.abs(right.p.y - left.p.y) > .5, 'Camber must alter actual road/vehicle height');
  assert.ok(landSupportAt(track, hairpin, 500).lateral <= track.laneLimitAt(hairpin));
  assert.equal(track.clearAt(0, 0, 1), false);
  assert.equal(track.clearAt(1000, 1000, 5), true);
});

test('road sampler has finite orthonormal frames and periodic geometry, widths and surfaces', () => {
  for (let d = -track.length; d < 2 * track.length; d += 7.3) {
    const s = track.sample(d, 5), wrapped = track.sample(d + track.length, 5);
    assert.ok([...s.p.toArray(), ...s.t.toArray(), ...s.n.toArray(), ...s.normal.toArray(), s.bank, s.grade].every(Number.isFinite));
    for (const v of [s.t, s.n, s.normal]) assert.ok(Math.abs(v.length() - 1) < 1e-9);
    assert.ok(Math.abs(s.t.dot(s.n)) < 1e-9); assert.ok(Math.abs(s.normal.dot(s.n)) < 1e-9);
    assert.ok(s.p.distance(wrapped.p) < 1e-7);
    assert.ok(Math.abs(track.halfWidthAt(d) - track.halfWidthAt(d + track.length)) < 1e-9);
    assert.ok(track.halfWidthAt(d) >= 8 && track.halfWidthAt(d) <= 9.5);
  }
  const before = track.sample(-1e-5, 7), after = track.sample(1e-5, 7);
  assert.ok(before.p.distance(after.p) < .001); assert.ok(before.n.distance(after.n) < .001);
  for (const value of [NaN, Infinity, -Infinity]) assert.ok(track.sample(value, value).p.toArray().every(Number.isFinite));
  assert.ok(track.pickups.every(p => Math.abs(p.lateral) < track.laneLimitAt(p.d)));
  assert.equal(track.sections[0].from, 0); assert.equal(track.sections.at(-1)!.to, track.length);
  assert.notEqual(track.surfaceAt(.55 * track.length).grip, track.surfaceAt(0).grip);
  assert.throws(() => createLandTrack({id:'bad', label:'bad', tag:'bad', points: MOUNTAIN_POINTS, widths:[[0,8],[1,9]], sections:[], pickups:[]}), /periodic/);
});
