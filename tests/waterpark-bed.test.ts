import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {createWaterparkBedDesign, createWaterparkBedMaterials, sampleWaterparkBedDepth, waterparkBedTilePixels, WATERPARK_BED_BUDGET, WATERPARK_BED_EXTENT, WATERPARK_BED_LANES, WATERPARK_BED_NAMES} from '../src/waterpark-bed';
import {sampleWaterpark, createWaterparkDesign} from '../src/waterpark-design';
import {MAX_WATER_HEIGHT} from '../src/waterpark-surface';

function createDevice() {
  return new pc.NullGraphicsDevice({width: 1280, height: 720, addEventListener() {}, removeEventListener() {}} as any);
}

test('real curved basin has shallow shoulders, a varying deep channel and bounded finite topology', () => {
  const meshes = createWaterparkBedDesign(), floor = meshes[0];
  assert.deepEqual(meshes, createWaterparkBedDesign());
  assert.equal(meshes.length, WATERPARK_BED_BUDGET.batches);
  assert.ok(meshes.reduce((count, m) => count + m.indices.length / 3, 0) <= WATERPARK_BED_BUDGET.triangles);
  for (const mesh of meshes) {
    assert.equal(mesh.submerged, true); assert.equal(mesh.water, undefined);
    assert.ok(mesh.positions.every(Number.isFinite)); assert.ok(mesh.uvs.every(Number.isFinite));
    assert.equal(mesh.positions.length / 3 * 2, mesh.uvs.length);
    assert.equal(mesh.indices.length % 3, 0);
    assert.ok(mesh.indices.every(i => Number.isInteger(i) && i >= 0 && i < mesh.positions.length / 3));
    const normals = pc.calculateNormals(mesh.positions, mesh.indices);
    for (let i = 0; i < mesh.positions.length; i += 3) {
      assert.ok(mesh.positions[i + 1] < -MAX_WATER_HEIGHT - .2, 'floor never intersects wave troughs');
      assert.ok(mesh.positions[i + 1] > -3, 'depth stays within the authored absorption range');
      assert.ok(normals[i + 1] > .55, 'basin and inlays face up and never invert');
    }
  }
  const columns = WATERPARK_BED_LANES.length, {start, end, step} = WATERPARK_BED_EXTENT;
  for (let d = start, row = 0; d <= end; d += step, row++) for (let col = 0; col < columns; col++) {
    const lane = WATERPARK_BED_LANES[col], p = sampleWaterpark(d, lane).p, i = (row * columns + col) * 3;
    assert.equal(floor.positions[i], p.x); assert.equal(floor.positions[i + 2], p.z);
    assert.equal(floor.positions[i + 1], -sampleWaterparkBedDepth(d, lane));
  }
  assert.equal(createWaterparkDesign().filter(mesh => mesh.water).length, 1, 'no replacement of the existing water mesh');
});

test('bathymetry joins existing coping and deepens smoothly without changing navigation bounds', () => {
  for (let distance = -35; distance <= 335; distance += 2.5) {
    assert.equal(sampleWaterparkBedDepth(distance, -12), .36);
    assert.equal(sampleWaterparkBedDepth(distance, 12), .36);
    assert.ok(sampleWaterparkBedDepth(distance, 0) >= 2.37 && sampleWaterparkBedDepth(distance, 0) <= 2.93);
    let prior = sampleWaterparkBedDepth(distance, 0);
    for (let lane = .1; lane <= 12; lane += .1) {
      const depth = sampleWaterparkBedDepth(distance, lane);
      assert.ok(depth <= prior + 1e-12); assert.equal(depth, sampleWaterparkBedDepth(distance, -lane));
      assert.ok(prior - depth < .105, 'shallows have no vertical steps'); prior = depth;
    }
  }
  assert.notEqual(sampleWaterparkBedDepth(0, 0), sampleWaterparkBedDepth(183, 0));
  for (const invalid of [NaN, Infinity, -Infinity]) assert.ok(Number.isFinite(sampleWaterparkBedDepth(invalid, invalid)));
  assert.equal(sampleWaterparkBedDepth(100, 100), .36);
});

test('dark inlays are physical indexed surfaces slightly above existing basin rows', () => {
  const [floor, inlays] = createWaterparkBedDesign();
  for (let i = 0; i < inlays.positions.length; i += 3) {
    const d = inlays.uvs[i / 3 * 2 + 1] * 2;
    const row = (d - WATERPARK_BED_EXTENT.start) / WATERPARK_BED_EXTENT.step;
    assert.ok(Number.isInteger(row), 'inlay vertices match a basin row');
    const floorY = floor.positions[(row * WATERPARK_BED_LANES.length + 5) * 3 + 1];
    assert.ok(Math.abs(inlays.positions[i + 1] - floorY - .006) < 1e-12);
  }
});

test('procedural tile/grout material uses tiny reusable opaque textures and disposes exactly once', () => {
  const device = createDevice(), environment = new pc.Texture(device, {width: 1, height: 1});
  const resources = createWaterparkBedMaterials(device, environment);
  try {
    const floor = resources.get(WATERPARK_BED_NAMES.floor), inlays = resources.get(WATERPARK_BED_NAMES.inlays);
    assert.equal(resources.materials.size, 2); assert.equal(resources.textures.length, 2);
    assert.equal(floor.envAtlas, environment); assert.equal(inlays.envAtlas, environment);
    assert.equal(floor.diffuseMap, resources.textures[0]); assert.equal(inlays.normalMap, resources.textures[1]);
    assert.equal(floor.normalMap, inlays.normalMap);
    for (const material of resources.materials.values()) {
      assert.equal(material.blendType, pc.BLEND_NONE); assert.equal(material.depthWrite, true);
      assert.equal(material.useMetalness, true); assert.equal(material.metalness, 0);
    }
    for (const normal of [false, true]) {
      const pixels = waterparkBedTilePixels(normal); assert.deepEqual(pixels, waterparkBedTilePixels(normal));
      assert.equal(pixels.length, WATERPARK_BED_BUDGET.textureSize ** 2 * 4);
      assert.ok(pixels.every((value, i) => i % 4 !== 3 || value === 255));
    }
    const pixels = waterparkBedTilePixels();
    assert.ok(pixels[0] < pixels[(5 * WATERPARK_BED_BUDGET.textureSize + 5) * 4], 'grout contrasts with tile');
    assert.throws(() => resources.get('not-a-bed-material'), /Unknown waterpark bed material/);
    const counts = new Map<object, number>();
    for (const resource of [...resources.materials.values(), ...resources.textures]) {
      const destroy = resource.destroy.bind(resource); counts.set(resource, 0);
      resource.destroy = () => {counts.set(resource, counts.get(resource)! + 1); destroy();};
    }
    resources.destroy(); resources.destroy();
    for (const count of counts.values()) assert.equal(count, 1);
    assert.ok(environment.device, 'shared sky atlas remains owned by scene materials');
  } finally {resources.destroy(); environment.destroy(); device.destroy();}
});
