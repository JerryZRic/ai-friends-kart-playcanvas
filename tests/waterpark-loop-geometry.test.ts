import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {createWaterparkDesign, sampleWaterpark, sampleWaterparkLoop, SAMPLE_LENGTH, WATER_HALF_WIDTH, WATER_RACE_LENGTH, WATER_RACE_RADIUS, WATER_RACE_STRAIGHT} from '../src/waterpark-design';
import {createWaterparkBedDesign, sampleWaterparkBedDepth, WATERPARK_BED_LANES} from '../src/waterpark-bed';
import {createWaterparkEnvironmentDetails} from '../src/waterpark-environment';
import {createWaterparkScene} from '../src/waterpark-scene';
import {createWaterparkWake, waterparkEffectGeometry} from '../src/waterpark-wake';

const race = {race: true};
const near = (a: number, b: number, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const same = (a: number[], b: number[], tolerance = 1e-9) => {assert.equal(a.length, b.length); a.forEach((value, index) => near(value, b[index], tolerance));};
const xyz = (p: pc.Vec3) => [p.x, p.y, p.z];

function fixture() {
  const canvas = {id: 'waterpark-loop-test', width: 1280, height: 720, addEventListener() {}, removeEventListener() {}, getBoundingClientRect() {return {left: 0, top: 0, width: 1280, height: 720};}} as any;
  const app = new pc.AppBase(canvas), options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
  options.devtools = false; app.init(options); return app;
}

test('stadium samples wrap through every join with continuous position and unit tangent', () => {
  assert.equal(SAMPLE_LENGTH, 285, 'study route is preserved');
  assert.equal(sampleWaterpark(270).angle, 1.75);
  near(WATER_RACE_LENGTH, 184 + 152 * Math.PI);
  const joins = [0, WATER_RACE_STRAIGHT, WATER_RACE_STRAIGHT + Math.PI * WATER_RACE_RADIUS, 2 * WATER_RACE_STRAIGHT + Math.PI * WATER_RACE_RADIUS, WATER_RACE_LENGTH];
  for (const lane of [-65, -WATER_HALF_WIDTH, 0, WATER_HALF_WIDTH, 65]) {
    for (const d of [-1000, -3, 0, 91, 183, 330, 480, WATER_RACE_LENGTH, 1000]) {
      const a = sampleWaterparkLoop(d, lane), b = sampleWaterparkLoop(d + WATER_RACE_LENGTH, lane);
      same(xyz(a.p), xyz(b.p)); same(xyz(a.t), xyz(b.t)); same(xyz(a.n), xyz(b.n));
      near(a.t.length(), 1); near(a.n.length(), 1); near(a.t.dot(a.n), 0);
    }
    for (const d of joins) {
      const before = sampleWaterparkLoop(d - 1e-5, lane), at = sampleWaterparkLoop(d, lane), after = sampleWaterparkLoop(d + 1e-5, lane);
      assert.ok(before.p.distance(after.p) < .00004);
      assert.ok(before.t.distance(after.t) < .000001);
      const forward = after.p.clone().sub(before.p).normalize();
      assert.ok(forward.dot(at.t) > .999999, 'no reversed/cusped offset at a join');
    }
  }
  for (const invalid of [NaN, Infinity, -Infinity]) assert.ok(xyz(sampleWaterparkLoop(invalid, invalid).p).every(Number.isFinite));
});

test('race meshes are deterministic, finite and keep one gapless non-inverted canal', () => {
  const design = createWaterparkDesign(race), details = createWaterparkEnvironmentDetails(race), bed = createWaterparkBedDesign(race);
  assert.deepEqual(design, createWaterparkDesign(race));
  assert.deepEqual(details, createWaterparkEnvironmentDetails(race));
  assert.deepEqual(bed, createWaterparkBedDesign(race));
  const meshes = [...design, ...details, ...bed];
  assert.equal(meshes.filter(mesh => mesh.water).length, 1);
  assert.ok(meshes.reduce((sum, mesh) => sum + mesh.indices.length / 3, 0) < 125000);
  for (const mesh of meshes) {
    assert.equal(mesh.positions.length % 3, 0); assert.equal(mesh.indices.length % 3, 0);
    assert.ok(mesh.positions.every(Number.isFinite)); assert.ok(mesh.uvs.every(Number.isFinite));
    assert.ok(mesh.indices.every(i => Number.isInteger(i) && i >= 0 && i < mesh.positions.length / 3));
    assert.ok(mesh.positions.length / 3 < 65536, 'every merged batch retains 16-bit indices');
  }
  const water = design.find(mesh => mesh.water)!, rows = Math.ceil(WATER_RACE_LENGTH / 1.3);
  assert.equal(water.positions.length, 24 * rows * 12);
  assert.equal(water.uvs.length, water.positions.length / 3 * 2);
  let area = 0;
  for (let lane = 0; lane < 24; lane++) {
    const first = lane * rows * 12, last = first + (rows - 1) * 12;
    same(water.positions.slice(first, first + 6), water.positions.slice(last + 6, last + 12));
    for (let row = 0; row < rows; row++) {
      const i = first + row * 12;
      if (row + 1 < rows) same(water.positions.slice(i + 6, i + 12), water.positions.slice(i + 12, i + 18));
      if (lane + 1 < 24) {
        const adjacent = i + rows * 12;
        same(water.positions.slice(i + 3, i + 6), water.positions.slice(adjacent, adjacent + 3));
        same(water.positions.slice(i + 9, i + 12), water.positions.slice(adjacent + 6, adjacent + 9));
      }
    }
  }
  for (let i = 0; i < water.indices.length; i += 3) {
    const [a, b, c] = water.indices.slice(i, i + 3).map(index => new pc.Vec3(...water.positions.slice(index * 3, index * 3 + 3) as [number, number, number]));
    const normal = new pc.Vec3().cross(b.sub(a), c.sub(a)); assert.ok(normal.y > 0, 'every water triangle faces up'); area += normal.y / 2;
  }
  near(area / (WATER_RACE_LENGTH * WATER_HALF_WIDTH * 2), 1, .0001);
});

test('submerged basin closes at identical depths and covers every lane for the whole lap', () => {
  const floor = createWaterparkBedDesign(race)[0], columns = WATERPARK_BED_LANES.length, rows = Math.ceil(WATER_RACE_LENGTH / 2) + 1;
  assert.equal(floor.positions.length, rows * columns * 3);
  same(floor.positions.slice(0, columns * 3), floor.positions.slice(-columns * 3));
  const normals = pc.calculateNormals(floor.positions, floor.indices);
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const d = Math.min(WATER_RACE_LENGTH, row * 2), lane = WATERPARK_BED_LANES[col], p = sampleWaterparkLoop(d, lane).p, i = (row * columns + col) * 3;
    same(floor.positions.slice(i, i + 3), [p.x, -sampleWaterparkBedDepth(d, lane, race), p.z]);
    assert.ok(normals[i + 1] > .5, 'no inverted shoulders or bottom');
  }
  for (const lane of WATERPARK_BED_LANES) {
    near(sampleWaterparkBedDepth(0, lane, race), sampleWaterparkBedDepth(WATER_RACE_LENGTH, lane, race));
    near(sampleWaterparkBedDepth(-1e-4, lane, race), sampleWaterparkBedDepth(1e-4, lane, race), 1e-6);
  }
});

test('wake geometry crosses the finish without teleporting or clamping at the study limit', () => {
  for (const distance of [0, 285, 400, WATER_RACE_LENGTH - .05, WATER_RACE_LENGTH + .05]) {
    const a = waterparkEffectGeometry(distance, 7, 28, 6.25, -5, race), b = waterparkEffectGeometry(distance + WATER_RACE_LENGTH, 7, 28, 6.25, -5, race);
    for (const key of ['positions', 'contact', 'spray'] as const) {assert.ok(a[key].every(Number.isFinite)); same(a[key], b[key]);}
  }
  const before = waterparkEffectGeometry(WATER_RACE_LENGTH - .001, 0, 28, 4, 0, race);
  const after = waterparkEffectGeometry(WATER_RACE_LENGTH + .001, 0, 28, 4, 0, race);
  same(before.positions, after.positions, .003);
  assert.notDeepEqual(waterparkEffectGeometry(285, 0, 28, 4, 0, race).positions, waterparkEffectGeometry(400, 0, 28, 4, 0, race).positions);
});

test('race scene camera and runtime wake wrap and safely release on repeated exit', () => {
  const app = fixture();
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const scene = createWaterparkScene(app as pc.Application, race), wake = createWaterparkWake(app as pc.Application, scene.root, race);
      assert.equal(scene.root.name, 'Waterpark closed-loop race'); assert.ok(scene.triangles < 125000);
      scene.setCamera(0); const position = scene.camera.getPosition().clone(), rotation = scene.camera.getRotation().clone();
      scene.setCamera(WATER_RACE_LENGTH); same(xyz(position), xyz(scene.camera.getPosition())); near(Math.abs(rotation.dot(scene.camera.getRotation())), 1);
      for (const d of [WATER_RACE_LENGTH - 1, WATER_RACE_LENGTH, WATER_RACE_LENGTH + 1]) wake.update(d, 0, 28, 3);
      assert.equal(wake.entity.enabled, true);
      scene.root.destroy(); wake.dispose(); wake.update(2, 0, 28, 4);
      assert.equal(app.scene.layers.getLayerByName('Waterpark reflected static scenery'), null);
    }
  } finally {app.destroy();}
});
