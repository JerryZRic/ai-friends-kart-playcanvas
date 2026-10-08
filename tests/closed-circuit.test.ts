import test from 'node:test';
import assert from 'node:assert/strict';
import {Vec3} from 'playcanvas';
import {ClosedCircuit} from '../src/closed-circuit';

const points = [[0, 0, 0], [0, 0, 80], [90, 0, 120], [140, 0, 20], [70, 0, -60]] as const;

test('common circuit owns a finite monotonic metre table and independent copied points', () => {
  const input = points.map(p => new Vec3(...p)), curve = new ClosedCircuit(input);
  assert.equal(curve.arcs.length, 1801); assert.equal(curve.arcs[0], 0); assert.equal(curve.arcs.at(-1), curve.length);
  assert.ok(curve.arcs.every((value, i) => Number.isFinite(value) && (!i || value > curve.arcs[i - 1])));
  input[0].set(1000, 1000, 1000); assert.equal(curve.points[0].x, 0);
  assert.equal(curve.parameterAt(0), 0); assert.equal(curve.parameterAt(1), 1);
  assert.equal(curve.parameterAt(-1), 0); assert.equal(curve.parameterAt(2), 1);
  assert.equal(new ClosedCircuit(points, {arcSteps: 256}).arcs.length, 257);
  assert.throws(() => new ClosedCircuit([[0, 0, 0]]), /at least four/);
  assert.throws(() => new ClosedCircuit([[NaN, 0, 0], ...points]), /finite/);
  assert.throws(() => new ClosedCircuit([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]), /positive/);
});

test('common sampler wraps position, tangent, lane normal and curvature across every lap', () => {
  const curve = new ClosedCircuit(points);
  for (const d of [-1000, -1e-5, 0, .01, 100, curve.length - 1e-5, curve.length, 3000]) {
    const a = curve.sample(d, 4), b = curve.sample(d + curve.length * 3, 4);
    for (const key of ['p', 't', 'n'] as const) assert.ok(a[key].distance(b[key]) < 1e-8);
    assert.ok(Math.abs(a.t.length() - 1) < 1e-12); assert.ok(Math.abs(a.n.length() - 1) < 1e-12); assert.ok(Math.abs(a.t.dot(a.n)) < 1e-12);
    assert.ok(Math.abs(curve.curvature(d) - curve.curvature(d + curve.length * 2)) < 1e-10);
    assert.equal(a.angle, Math.atan2(a.t.x, a.t.z));
    const moved = curve.sample(d, 4).p.sub(curve.sample(d).p); assert.ok(Math.abs(moved.length() - 4) < 1e-9); assert.ok(moved.dot(a.n) > 0);
  }
  assert.ok(curve.sample(-1e-5).t.distance(curve.sample(1e-5).t) < 1e-5);
  for (const value of [NaN, Infinity, -Infinity]) {
    const frame = curve.sample(value, value);
    assert.ok([...frame.p.toArray(), ...frame.t.toArray(), ...frame.n.toArray(), frame.angle].every(Number.isFinite));
  }
});
