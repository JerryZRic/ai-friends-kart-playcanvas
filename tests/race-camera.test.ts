import assert from 'node:assert/strict';
import test from 'node:test';
import * as pc from 'playcanvas';
import {chaseCamera, type RaceCameraOptions} from '../src/race-camera';
import {createOrbit} from '../src/mouse-look.js';

// Independent copy of the previously approved coast rendering equations. This
// catches sign/height/look-ahead drift when either map adapts the shared camera.
function coastReference({position, tangent, view, rearView, orbit}: RaceCameraOptions) {
  const yaw = rearView ? Math.PI : orbit.yaw, pitch = rearView ? 0 : orbit.pitch;
  const behind = view ? 15 : 10.5, height = view ? 7.9 : 4.6;
  const forward = new pc.Vec3(tangent.x, 0, tangent.z).normalize();
  new pc.Quat().setFromAxisAngle(pc.Vec3.UP, -yaw * 180 / Math.PI).transformVector(forward, forward);
  const radius = Math.hypot(behind, height - 1), elevation = Math.max(.08, Math.min(1.15, Math.atan2(height - 1, behind) + pitch));
  const cameraPosition = new pc.Vec3(position.x, position.y, position.z).add(forward.clone().mulScalar(-radius * Math.cos(elevation)));
  cameraPosition.y += 1 + radius * Math.sin(elevation);
  const look = new pc.Vec3(position.x, position.y, position.z).add(forward.clone().mulScalar((view ? 12 : 16) * Math.cos(elevation)));
  look.y += 1 - Math.sin(pitch) * 8;
  return {position: cameraPosition, look};
}
function close(actual: {x: number; y: number; z: number}, expected: {x: number; y: number; z: number}) {
  for (const axis of ['x', 'y', 'z'] as const) assert.ok(Math.abs(actual[axis] - expected[axis]) < 1e-11, `${axis}: ${actual[axis]} != ${expected[axis]}`);
}
const base: RaceCameraOptions = {position: {x: 31, y: 2, z: -7}, tangent: {x: 1, y: .2, z: 0}, view: 0, rearView: false, orbit: {yaw: 0, pitch: 0}};

test('both chase modes exactly preserve coast geometry for orbit, pitch limits and rear view', () => {
  for (const view of [0, 1]) for (const rearView of [false, true]) for (const yaw of [-5.1, -1.1, 0, .37, 2.2, 7.4]) for (const pitch of [-.8, -.28, 0, .78, 1.5]) {
    for (const tangent of [{x: 1, y: .3, z: 0}, {x: -2, y: 0, z: 3}, {x: 0, y: 4, z: -1}, {x: 0, y: 0, z: 0}]) {
      const options = {...base, tangent, view, rearView, orbit: {yaw, pitch}};
      const actual = chaseCamera(options), expected = coastReference(options);
      close(actual.position, expected.position); close(actual.look, expected.look);
    }
  }
});

test('low and high cameras retain baseline distance/height and flatten surface normals', () => {
  close(chaseCamera(base).position, {x: 20.5, y: 6.6, z: -7});
  close(chaseCamera({...base, view: 1}).position, {x: 16, y: 9.9, z: -7});
  assert.deepEqual(chaseCamera(base), chaseCamera({...base, tangent: {x: 4, y: 20, z: 0}}));
});

test('rear view overrides orbit without changing it; release and recenter restore the same chase', () => {
  const orbit = createOrbit(); orbit.move(100, 100); orbit.step(.2);
  const original = orbit.get();
  const forward = chaseCamera({...base, orbit: original});
  const rear = chaseCamera({...base, orbit: original, rearView: true});
  assert.deepEqual(rear, chaseCamera({...base, rearView: true}));
  assert.deepEqual(orbit.get(), original);
  assert.deepEqual(chaseCamera({...base, orbit: orbit.get()}), forward);
  orbit.recenter(true); assert.deepEqual(chaseCamera({...base, orbit: orbit.get()}), chaseCamera(base));
  close(rear.position, {x: 41.5, y: 6.6, z: -7});
});

test('camera math does not mutate any caller-owned vectors or angles', () => {
  const options = structuredClone(base), before = structuredClone(options);
  chaseCamera(options); assert.deepEqual(options, before);
});
