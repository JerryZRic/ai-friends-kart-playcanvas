import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {circuit, LENGTH, HALF, halfWidthAt, laneLimitAt, shoulderAt, sample, isRoadsideClear, COAST_TURN_SIGNS, COAST_PICKUPS, COAST_SECTIONS} from '../src/track';
import {createCoastScene, coastGroundHeightAt, coastPalmPlacements, COAST_ISLANDS} from '../src/scene';

const near = (a: number, b: number, tolerance = 1e-4) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);
const same = (a: number[], b: number[], tolerance = 1e-4) => { assert.equal(a.length, b.length); a.forEach((v, i) => near(v, b[i], tolerance)); };

test('coast has medium-complexity turns, a real open hairpin and separated branches', () => {
  assert.ok(LENGTH > 1350 && LENGTH < 1400); assert.equal(circuit.points.length, 28);
  same(sample(0).p.toArray(), [0, 2.4, -165]);
  let minY = Infinity, maxY = -Infinity, maximumCurvature = 0, maximumGrade = 0, leftMetres = 0, rightMetres = 0, straightMetres = 0, absoluteYaw = 0;
  const step = LENGTH / 3000;
  for (let d = 0; d < LENGTH; d += step) {
    const a = sample(d), b = sample(d + step), angle = Math.atan2(a.t.z * b.t.x - a.t.x * b.t.z, a.t.x * b.t.x + a.t.z * b.t.z), k = angle / step;
    absoluteYaw += Math.abs(k) * step;
    minY = Math.min(minY, a.p.y); maxY = Math.max(maxY, a.p.y); maximumCurvature = Math.max(maximumCurvature, Math.abs(k));
    maximumGrade = Math.max(maximumGrade, Math.abs(a.t.y) / Math.hypot(a.t.x, a.t.z));
    if (k > .002) leftMetres += step; if (k < -.002) rightMetres += step; if (Math.abs(k) < .0025) straightMetres += step;
    assert.ok(a.p.distance(b.p) < step * 1.015, 'metre sampler cannot accelerate around a knot');
  }
  assert.ok(1 / maximumCurvature > 20, 'open hairpins leave clearance outside the full road and rails'); assert.ok(maximumGrade < .08);
  assert.ok(minY > 2.3 && maxY < 13 && maxY - minY > 10); assert.ok(leftMetres > 250 && rightMetres > 600 && straightMetres > 100);
  assert.ok(absoluteYaw > 14 && absoluteYaw < 16, 'roughly 850 degrees of turning, not the previous 515-degree S oval');
  assert.equal(COAST_SECTIONS.length, 8);
  assert.ok(COAST_SECTIONS.some(section => section.name === 'Lookout hairpin'));
  assert.ok(sample(-.0001).t.distance(sample(.0001).t) < 1e-5, 'no finish-seam heading pop');
  const rows = Array.from({length: 240}, (_, i) => sample(i / 240 * LENGTH).p);
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const gap = Math.min(j - i, rows.length - (j - i)) * LENGTH / rows.length;
    if (gap > 45) assert.ok(Math.hypot(rows[i].x - rows[j].x, rows[i].z - rows[j].z) > 28, 'nonadjacent road sections cannot overlap');
  }
});

test('width variations are periodic, gradual and wide enough for all existing pickup/NPC lanes', () => {
  let min = Infinity, max = -Infinity;
  for (let d = -10; d < LENGTH + 10; d += .5) {
    const half = halfWidthAt(d); min = Math.min(min, half); max = Math.max(max, half);
    assert.ok(half >= 6.6 && half <= 8.2); near(half, halfWidthAt(d + LENGTH * 3), 1e-12);
    assert.ok(Math.abs(halfWidthAt(d + .5) - half) < .011, 'no abrupt pinch');
    near(laneLimitAt(d), half - .45); near(shoulderAt(d), half - .9);
    assert.ok(laneLimitAt(d) >= 5.2); assert.ok(half - 4.2 > 1.3);
  }
  near(min, 6.6); near(max, 8.2);
  for (const d of [-10, 0, 10, 40]) near(halfWidthAt(d), HALF, 1e-12);
  assert.ok(COAST_TURN_SIGNS.some(sign => sign.left) && COAST_TURN_SIGNS.some(sign => !sign.left));
  for (const sign of COAST_TURN_SIGNS) assert.equal(sign.left, circuit.curvature(sign.distance + 12, 22) > 0);
});

test('original rock placements are filtered by real road clearance without changing prop assets', () => {
  let retained = 0, removed = 0;
  for (let i = 0; i < 36; i++) {
    const a = i / 36 * Math.PI * 2, x = Math.cos(a) * (100 + i % 3 * 10) - 12, z = Math.sin(a) * (90 + i % 4 * 7), radius = 4.4 * (.6 + i % 3 * .23);
    if (!isRoadsideClear(x, z, radius)) { removed++; continue; }
    retained++;
    for (let d = 0; d < LENGTH; d += 1) { const p = sample(d).p; assert.ok(Math.hypot(p.x - x, p.z - z) > halfWidthAt(d) + radius + 1.8); }
  }
  assert.ok(retained >= 20 && removed > 0);
  assert.equal(isRoadsideClear(sample(100).p.x, sample(100).p.z, 1), false);
});

test('race palms use real supporting island caps and never spawn with ocean roots', () => {
  assert.equal(coastGroundHeightAt(1000, 1000), null); assert.equal(coastGroundHeightAt(NaN, 0), null);
  near(coastGroundHeightAt(-12, 5)!, .6); near(coastGroundHeightAt(-90, 68)!, .68);
  const placements = coastPalmPlacements();
  assert.ok(placements.length > 20 && placements.length < 94, 'offshore candidates are skipped rather than floated');
  for (const palm of placements) {
    const ground = coastGroundHeightAt(palm.position.x, palm.position.z); assert.notEqual(ground, null);
    near(palm.position.y + .2, ground!, 1e-12);
    assert.ok(COAST_ISLANDS.some(island => Math.hypot((palm.position.x - island.x) / (island.radius * island.sx), (palm.position.z - island.z) / (island.radius * island.sz)) < 1));
    assert.ok(palm.scale >= .82 && palm.scale <= 1.09);
  }
  assert.deepEqual(coastPalmPlacements(), placements, 'terrain filtering is deterministic');
});

test('forty-five pickups form staggered optional side lines with safe centre recovery', () => {
  assert.equal(COAST_PICKUPS.length, 45); assert.equal(new Set(COAST_PICKUPS.map(p => p.d)).size, 45);
  assert.deepEqual(new Set(COAST_PICKUPS.map(p => p.line)), new Set(['recovery', 'corner-exit', 'wide-choice']));
  for (let group = 0; group < 15; group++) {
    const row = COAST_PICKUPS.filter(p => p.group === group); assert.equal(row.length, 3);
    assert.ok(row.some(p => p.lateral === 0)); near(row[2].d - row[0].d, 28, 1e-10);
    for (const pickup of row) { assert.ok(pickup.d > 30 && pickup.d < LENGTH - 25); assert.ok(Math.abs(pickup.lateral) <= 4.2); assert.ok(Math.abs(pickup.lateral) + 1.3 < halfWidthAt(pickup.d)); }
  }
});

test('actual native coast road, kerbs, rails, markings and pickups follow the new sampler', () => {
  const canvas = {id: 'coast-level0', width: 1280, height: 720, addEventListener() {}, removeEventListener() {}, getBoundingClientRect() {return {left: 0, top: 0, width: 1280, height: 720};}} as any;
  const app = new pc.AppBase(canvas), options = new pc.AppOptions(); options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem]; options.devtools = false; app.init(options);
  const world = createCoastScene(app as pc.Application);
  const vertices = (name: string) => { const mesh = (world.root.findByName(name) as pc.Entity).render!.meshInstances[0].mesh, positions: number[] = []; mesh.getPositions(positions); return {mesh, positions}; };
  try {
    const islands = (world.root.findComponents('render') as pc.RenderComponent[]).filter(render => render.entity.name === 'Island');
    assert.equal(islands.length, 6);
    const caps = islands.map(render => { const values: number[] = []; render.meshInstances[0].mesh.getPositions(values); return Math.max(...values.filter((_, i) => i % 3 === 1)) + render.entity.getPosition().y; });
    assert.equal(new Set(caps.filter((_, i) => i % 2 === 0).map(y => y.toFixed(5))).size, 3, 'sand caps have no coincident planes');
    assert.equal(new Set(caps.filter((_, i) => i % 2 === 1).map(y => y.toFixed(5))).size, 3, 'grass caps have no coincident planes');
    assert.ok(Math.max(...caps) < .69 && Math.max(...caps) + 1.5 < Math.min(...circuit.points.map(p => p.y)), 'terrain remains safely below road');
    const road = vertices('Circuit ribbon'); assert.equal(road.positions.length, 720 * 4 * 3);
    for (let i = 0; i < 720; i += 9) for (let corner = 0; corner < 4; corner++) {
      const distance = (i + (corner > 1 ? 1 : 0)) / 720 * LENGTH, lane = (corner % 2 ? 1 : -1) * halfWidthAt(distance);
      same(road.positions.slice((i * 4 + corner) * 3, (i * 4 + corner + 1) * 3), sample(distance, lane).p.toArray());
    }
    const normals: number[] = []; road.mesh.getNormals(normals); assert.ok(normals.filter((_, i) => i % 3 === 1).every(y => y > .99));
    const rails = world.root.findComponents('render').filter((component: pc.RenderComponent) => component.entity.name === 'Coastal guardrail') as pc.RenderComponent[];
    assert.equal(rails.length, 2);
    rails.forEach((rail, sideIndex) => {
      const values: number[] = []; rail.meshInstances[0].mesh.getPositions(values); assert.equal(values.length, 501 * 5 * 3);
      for (let i = 0; i <= 500; i += 10) { const d = i / 500 * LENGTH, s = sample(d, (sideIndex ? 1 : -1) * (halfWidthAt(d) + .95)), p = s.p.add(s.n.mulScalar(.075)); p.y += .74; same(values.slice(i * 15, i * 15 + 3), p.toArray()); }
    });
    const markings = vertices('Lane markings').positions; assert.equal(markings.length, 120 * 2 * 4 * 3);
    for (let i = 0; i < 120; i += 7) for (let laneIndex = 0; laneIndex < 2; laneIndex++) for (let corner = 0; corner < 4; corner++) {
      const d = i * 2 / 240 * LENGTH + (corner < 2 ? -1.05 : 1.05), lane = (laneIndex ? 2.4 : -2.4) + (corner % 2 ? .055 : -.055), p = sample(d, lane).p; p.y += .012;
      const index = (i * 2 + laneIndex) * 12 + corner * 3; same(markings.slice(index, index + 3), p.toArray());
    }
    assert.equal(world.boxes.length, 45);
    for (const box of world.boxes) { const p = sample(box.d, box.lateral).p; p.y += 1.25; same(box.mesh.getPosition().toArray(), p.toArray()); assert.ok(Math.abs(box.lateral) + .65 < halfWidthAt(box.d)); }
    const totalTriangles = (world.root.findComponents('render') as pc.RenderComponent[]).reduce((sum, render) => sum + render.meshInstances.reduce((n, instance) => n + instance.mesh.primitive[0].count / 3, 0), 0);
    // Includes every pooled particle and all hidden pickup variants, exactly as
    // the original scene did; the new route adds no tessellation or draw pools.
    assert.ok(totalTriangles <= 136300, `${totalTriangles} exceeds existing native scene budget`);
  } finally { app.destroy(); }
});
