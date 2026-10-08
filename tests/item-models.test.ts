import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { createItemModel, getItemGeometry, itemImage, ITEM_MODEL_METADATA, type ItemDisplay } from '../src/item-models';

const kinds: ItemDisplay[] = ['boost', 'shield', 'pulse', 'mystery'];
function headlessApp() {
  const canvas = { id: `item-model-${Math.random()}`, width: 1, height: 1, addEventListener() {}, removeEventListener() {}, getBoundingClientRect() { return { left: 0, top: 0, width: 1, height: 1 }; } } as any;
  const app = new pc.AppBase(canvas), options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.RenderComponentSystem]; options.devtools = false;
  app.init(options);
  return app;
}

test('all four original item models are immutable, centered, finite, nondegenerate solids with outward face normals', () => {
  assert.equal(ITEM_MODEL_METADATA.license, 'AGPL-3.0-only');
  assert.equal(ITEM_MODEL_METADATA.original, true);
  assert.ok(ITEM_MODEL_METADATA.author);
  for (const kind of kinds) {
    const model = getItemGeometry(kind);
    assert.equal(getItemGeometry(kind), model, 'authored model is generated once');
    assert.equal(model.type, kind);
    assert.ok(Object.isFrozen(model) && Object.isFrozen(model.parts));
    assert.ok(model.triangleCount > 50 && model.triangleCount < 800, 'real geometry with a small triangle budget');
    assert.ok(model.parts.length <= 9, 'faces are batched by reusable material');
    assert.equal(Math.max(...model.bounds.max.map((v, i) => v - model.bounds.min[i])), 1);
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(Math.abs(model.bounds.min[axis] + model.bounds.max[axis]) < 1e-10, 'origin is the model bounds center');
      assert.ok(model.bounds.max[axis] - model.bounds.min[axis] > .15, 'every model has genuine depth');
    }
    let count = 0;
    for (const part of model.parts) {
      assert.ok(Object.isFrozen(part.positions) && Object.isFrozen(part.indices) && Object.isFrozen(part.normals));
      assert.equal(part.positions.length, part.normals.length);
      assert.equal(part.positions.length % 3, 0);
      assert.equal(part.indices.length % 3, 0);
      assert.ok(/^#[0-9a-f]{6}$/i.test(part.color));
      assert.ok(part.positions.every(Number.isFinite));
      assert.ok(part.normals.every(Number.isFinite));
      for (let i = 0; i < part.positions.length; i++) {
        assert.ok(part.positions[i] >= model.bounds.min[i % 3] - 1e-8);
        assert.ok(part.positions[i] <= model.bounds.max[i % 3] + 1e-8);
      }
      for (let i = 0; i < part.indices.length; i += 3) {
        const vertices = part.indices.slice(i, i + 3).map(index => {
          assert.ok(Number.isInteger(index) && index >= 0 && index * 3 < part.positions.length);
          return new pc.Vec3(...part.positions.slice(index * 3, index * 3 + 3));
        });
        const geometric = new pc.Vec3().cross(vertices[1].clone().sub(vertices[0]), vertices[2].clone().sub(vertices[0]));
        assert.ok(geometric.length() > 1e-7, `${kind} has no collapsed triangles`);
        geometric.normalize();
        for (const index of part.indices.slice(i, i + 3)) {
          const normal = new pc.Vec3(...part.normals.slice(index * 3, index * 3 + 3));
          assert.ok(Math.abs(normal.length() - 1) < 1e-7);
          assert.ok(normal.dot(geometric) > .999999, 'normal matches triangle winding, including extruded side walls');
        }
        count++;
      }
    }
    assert.equal(count, model.triangleCount);
  }
  assert.equal(new Set(kinds.map(kind => JSON.stringify(getItemGeometry(kind).parts))).size, kinds.length, 'each item has its own authored silhouette');
});

test('PlayCanvas entities share the exact authored meshes and opaque materials without sharing transforms', () => {
  const app = headlessApp();
  try {
    for (const kind of kinds) {
      const a = createItemModel(app, kind), b = createItemModel(app, kind);
      app.root.addChild(a); app.root.addChild(b);
      assert.notEqual(a, b);
      assert.equal(a.name, ITEM_MODEL_METADATA.items[kind].name);
      a.setLocalPosition(5, 2, 1); assert.equal(b.getLocalPosition().length(), 0);
      const authored = getItemGeometry(kind), am = a.render!.meshInstances, bm = b.render!.meshInstances;
      assert.equal(am.length, authored.parts.length);
      for (let i = 0; i < am.length; i++) {
        assert.notEqual(am[i], bm[i]); assert.equal(am[i].mesh, bm[i].mesh); assert.equal(am[i].material, bm[i].material);
        const material = am[i].material as pc.StandardMaterial;
        assert.equal(material.opacity, 1); assert.equal(material.blendType, pc.BLEND_NONE);
        assert.equal(material.cull, pc.CULLFACE_BACK); assert.equal(material.depthWrite, true); assert.equal(material.useLighting, true);
        const positions: number[] = [], normals: number[] = [], indices: number[] = [];
        am[i].mesh.getPositions(positions); am[i].mesh.getNormals(normals); am[i].mesh.getIndices(indices);
        assert.equal(positions.length, authored.parts[i].positions.length);
        assert.deepEqual(indices, authored.parts[i].indices);
        for (let j = 0; j < positions.length; j++) {
          assert.ok(Math.abs(positions[j] - authored.parts[i].positions[j]) < 1e-7, 'world mesh uses source model vertices');
          assert.ok(Math.abs(normals[j] - authored.parts[i].normals[j]) < 1e-7);
        }
      }
      const meshes = am.map(instance => instance.mesh), materials = am.map(instance => instance.material);
      a.destroy();
      assert.ok(meshes.every(mesh => mesh.vertexBuffer && mesh.refCount >= 2), 'a sibling and the cache retain the mesh');
      b.destroy();
      assert.ok(meshes.every(mesh => mesh.vertexBuffer && mesh.refCount === 1), 'cache survives removal of every instance');
      const c = createItemModel(app, kind); app.root.addChild(c);
      for (let i = 0; i < meshes.length; i++) { assert.equal(c.render!.meshInstances[i].mesh, meshes[i]); assert.equal(c.render!.meshInstances[i].material, materials[i]); }
      c.destroy();
    }
  } finally { app.destroy(); }
});

test('GPU resources are isolated per app and released on application teardown', () => {
  const first = headlessApp(), second = headlessApp();
  const a = createItemModel(first, 'pulse'), b = createItemModel(second, 'pulse');
  first.root.addChild(a); second.root.addChild(b);
  const firstMesh = a.render!.meshInstances[0].mesh, secondMesh = b.render!.meshInstances[0].mesh;
  assert.notEqual(firstMesh, secondMesh);
  assert.notEqual(a.render!.meshInstances[0].material, b.render!.meshInstances[0].material);
  first.destroy();
  assert.equal(firstMesh.vertexBuffer, null);
  assert.ok(secondMesh.vertexBuffer, 'destroying one app leaves the other intact');
  second.destroy();
  assert.equal(secondMesh.vertexBuffer, null);
});

test('inventory portraits project the actual visible model triangles with depth, lighting, and no substitute glyph', () => {
  const images = new Set<string>();
  for (const kind of kinds) {
    const url = itemImage(kind), svg = decodeURIComponent(url.slice(url.indexOf(',') + 1));
    assert.ok(url.startsWith('data:image/svg+xml;'));
    assert.equal(itemImage(kind), url, 'portraits are cached');
    assert.match(svg, /viewBox="0 0 256 256"/);
    assert.ok(svg.includes(`<title>${ITEM_MODEL_METADATA.items[kind].name}</title>`));
    assert.doesNotMatch(svg, /<text|<image|<foreignObject|href=|<script|NaN|Infinity/i);
    const actual = [...svg.matchAll(/<path d="M([^"]+)" fill="([^"]+)"/g)];
    const source = getItemGeometry(kind), expected: { coords: pc.Vec3[]; z: number; normal: pc.Vec3; color: string }[] = [], all: pc.Vec3[] = [];
    // Reconstruct the documented orthographic camera independently with matrices.
    const rx = new pc.Mat4().setFromAxisAngle(pc.Vec3.RIGHT, 16), ry = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, -22);
    const camera = new pc.Mat4().mul2(ry, rx);
    for (const part of source.parts) {
      const vertices: pc.Vec3[] = [];
      for (let i = 0; i < part.positions.length; i += 3) vertices.push(camera.transformPoint(new pc.Vec3(...part.positions.slice(i, i + 3))));
      all.push(...vertices);
      for (let i = 0; i < part.indices.length; i += 3) {
        const coords = part.indices.slice(i, i + 3).map(index => vertices[index]);
        const normal = new pc.Vec3().cross(coords[1].clone().sub(coords[0]), coords[2].clone().sub(coords[0])).normalize();
        if (normal.z > 1e-7) expected.push({ coords, normal, color: part.color, z: coords.reduce((sum, p) => sum + p.z, 0) / 3 });
      }
    }
    expected.sort((a, b) => a.z - b.z);
    assert.equal(actual.length, expected.length, 'every visible source triangle is rendered once');
    assert.ok(actual.length > 20 && actual.length < source.triangleCount, 'back faces are culled');
    const minX = Math.min(...all.map(p => p.x)), maxX = Math.max(...all.map(p => p.x));
    const minY = Math.min(...all.map(p => p.y)), maxY = Math.max(...all.map(p => p.y));
    const scale = 218 / Math.max(maxX - minX, maxY - minY), cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const light = new pc.Vec3(-.45, .85, 1.6).normalize();
    for (let i = 0; i < actual.length; i++) {
      const coordinates = actual[i][1].replace(/Z$/, '').split('L').map(pair => pair.split(',').map(Number));
      assert.equal(coordinates.length, 3);
      for (let v = 0; v < 3; v++) {
        const p = expected[i].coords[v];
        assert.ok(Math.abs(coordinates[v][0] - ((p.x - cx) * scale + 128)) < .006);
        assert.ok(Math.abs(coordinates[v][1] - (128 - (p.y - cy) * scale)) < .006);
        assert.ok(coordinates[v].every(n => n >= 18 && n <= 238), 'portrait has breathing room and no clipping');
      }
      const brightness = .55 + .45 * Math.max(0, expected[i].normal.dot(light));
      const rgb = [1, 3, 5].map(offset => Math.round(parseInt(expected[i].color.slice(offset, offset + 2), 16) * brightness));
      assert.equal(actual[i][2], `rgb(${rgb.join(',')})`, 'lighting follows the actual surface normal');
    }
    images.add(url);
  }
  assert.equal(images.size, kinds.length);
});
