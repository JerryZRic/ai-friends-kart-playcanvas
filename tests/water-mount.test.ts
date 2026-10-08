import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createWaterMount, getWaterMountGeometry, WATER_MOUNT_METADATA } from '../src/water-mount';
import { parseLocalGLB, disposeDriverAsset, RUNTIME_MODELS, type DriverAsset } from '../src/assets';
import { syntheticDriverGLB } from './helpers/synthetic-driver.mjs';

/** Real hierarchy, animation and CPU skin evaluation. NullGraphicsDevice does
 * not verify the GPU/browser appearance; only image decoding is substituted.
 */
function headlessApp() {
  const canvas = { id: `water-mount-${Math.random()}`, width: 1, height: 1, addEventListener() {}, removeEventListener() {}, getBoundingClientRect() { return { left: 0, top: 0, width: 1, height: 1 }; } } as any;
  const app = new pc.AppBase(canvas), options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.RenderComponentSystem, pc.AnimComponentSystem];
  options.resourceHandlers = [pc.ContainerHandler, pc.RenderHandler, pc.MaterialHandler, pc.TextureHandler]; options.devtools = false; app.init(options);
  app.assets.on('add', (asset: pc.Asset) => {
    if (asset.type === 'container') (asset.options as any).image = { processAsync(_image: unknown, done: Function) {
      const texture = new pc.Asset('water-mount-headless-texture', 'texture');
      texture.resource = new pc.Texture(options.graphicsDevice, { width: 1, height: 1 }); texture.loaded = true; app.assets.add(texture); done(null, texture);
    } };
  });
  return app;
}
const meshes = (entity: pc.Entity) => (entity.findComponents('render') as pc.RenderComponent[]).flatMap(r => r.meshInstances);

test('original whale geometry is reusable, forward +Z, finite and below 3,000 triangles', () => {
  const geometry = getWaterMountGeometry();
  assert.equal(getWaterMountGeometry(), geometry);
  assert.equal(WATER_MOUNT_METADATA.original, true);
  assert.equal(WATER_MOUNT_METADATA.license, 'AGPL-3.0-only');
  assert.equal(WATER_MOUNT_METADATA.forward, '+Z');
  assert.deepEqual(geometry.seat, [0, 1.1, -.42]);
  assert.ok(geometry.triangleCount > 1000 && geometry.triangleCount < 3000);
  assert.ok(geometry.parts.length <= 10);
  assert.ok(Object.isFrozen(geometry) && Object.isFrozen(geometry.parts));
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(geometry)));
  const required = ['rounded-blue-body', 'cream-belly', 'tail-flukes', 'friendly-eyes', 'eye-glints', 'saddle-cushion'];
  for (const name of required) assert.ok(geometry.parts.some(p => p.name === name));
  assert.equal(geometry.parts.filter(p => p.name === 'side-flipper').length, 2);
  const body = geometry.parts.find(p => p.name === 'rounded-blue-body')!;
  const xs = body.positions.filter((_, i) => i % 3 === 0);
  assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 1.7) < 1e-8);
  for (const part of geometry.parts) {
    assert.ok(Object.isFrozen(part) && Object.isFrozen(part.positions));
    assert.equal(part.positions.length, part.normals.length);
    assert.ok([...part.positions, ...part.normals].every(Number.isFinite));
    const point = (index: number) => new pc.Vec3(...part.positions.slice(index * 3, index * 3 + 3));
    for (let i = 0; i < part.indices.length; i += 3) {
      const [a, b, c] = part.indices.slice(i, i + 3);
      assert.ok([a, b, c].every(v => Number.isInteger(v) && v >= 0 && v * 3 < part.positions.length));
      const normal = new pc.Vec3().cross(point(b).sub(point(a)), point(c).sub(point(a)));
      assert.ok(normal.length() > 1e-10, `${part.name} has solid nondegenerate faces`);
      const averaged = new pc.Vec3();
      for (const vertex of [a, b, c]) {
        const n = new pc.Vec3(...part.normals.slice(vertex * 3, vertex * 3 + 3));
        assert.ok(Math.abs(n.length() - 1) < 1e-5); averaged.add(n);
      }
      assert.ok(averaged.dot(normal) > 0, `${part.name} surface normals match its outward winding`);
    }
  }
});

test('unloaded mount is explicit, deterministic and never overwrites the race transform', () => {
  const app = headlessApp();
  try {
    const mount = createWaterMount(app); app.root.addChild(mount.root);
    assert.equal(mount.rider, null); assert.equal(mount.getState().riderStatus, 'unloaded');
    assert.equal(mount.getState().animationMode, 'none');
    assert.equal(mount.getState().pelvisSeatError, null);
    assert.ok(!mount.root.findByName('SteeringPivot'), 'there is no kart/chassis dependency');
    assert.ok(meshes(mount.root).length <= 12);
    assert.equal(mount.getState().triangles, meshes(mount.root).reduce((count, instance) => { const indices: number[] = []; instance.mesh.getIndices(indices); return count + indices.length / 3; }, 0), 'triangle budget includes the actual grab bar mesh');
    mount.root.setPosition(12, .2, 25); mount.root.setEulerAngles(0, 70, 0);
    const position = mount.root.getPosition().clone(), rotation = mount.root.getRotation().clone();
    mount.update({ speed: 20, steer: .8, time: 1.4, boost: true });
    const tail = mount.tail.getLocalRotation().clone(), body = mount.body.getLocalRotation().clone();
    assert.ok(Math.abs(body.z) > .02); assert.ok(Math.abs(tail.x) > .01);
    assert.deepEqual(mount.root.getPosition(), position); assert.deepEqual(mount.root.getRotation(), rotation);
    mount.update({ speed: 0, steer: -1, time: 3 });
    mount.update({ speed: 20, steer: .8, time: 1.4, boost: true });
    assert.deepEqual(mount.tail.getLocalRotation(), tail); assert.deepEqual(mount.body.getLocalRotation(), body);
    mount.update({ speed: NaN, steer: Infinity, time: NaN, boost: NaN });
    assert.deepEqual([mount.getState().speed, mount.getState().steer, mount.getState().time, mount.getState().boost], [0, 0, 0, 0]);
    const owned = meshes(mount.root).map(instance => instance.mesh);
    mount.dispose(); mount.dispose(); mount.update({ speed: 20, steer: 1, time: 99 });
    assert.equal(mount.getState().status, 'disposed');
    assert.ok(owned.every(mesh => !mesh.vertexBuffer), 'all mount-owned geometry is released');
  } finally { app.destroy(); }
});

test('synthetic real skin stays borrowed and independent across mount instances', async () => {
  const app = headlessApp(), asset = await parseLocalGLB(app, syntheticDriverGLB({ bones: ['Pelvis', 'WheelBone'] }));
  try {
    const a = createWaterMount(app, asset), b = createWaterMount(app, asset);
    app.root.addChild(a.root); app.root.addChild(b.root);
    const first = meshes(a.rider!)[0], second = meshes(b.rider!)[0];
    assert.notEqual(first.skinInstance, second.skinInstance);
    assert.notEqual(first.skinInstance.bones[0], second.skinInstance.bones[0]);
    assert.equal(first.mesh, second.mesh); assert.equal(first.material, second.material);
    const neutral = b.gripTargets.left.getPosition().clone();
    a.update({ speed: 12, steer: 1, time: 2 });
    assert.ok(a.gripTargets.left.getPosition().distance(neutral) > .03);
    assert.ok(b.gripTargets.left.getPosition().distance(neutral) < 1e-7);
    assert.ok(a.getState().pelvisSeatError! < 1e-5);
    assert.ok(a.getState().gripErrors.left! < 1e-5);
    a.dispose(); assert.ok(second.mesh.vertexBuffer); assert.ok(!asset.disposed);
    b.update({ speed: 20, steer: -1, time: 3 }); assert.ok(b.getState().gripErrors.left! < 1e-5);
    const borrowedMesh = second.mesh;
    b.dispose(); assert.ok(borrowedMesh.vertexBuffer, 'container ownership survives every borrowed instance');
  } finally { disposeDriverAsset(asset); app.destroy(); }
});

test('all six actual drivers fit the saddle and handles with independent seated skin poses', async () => {
  const app = headlessApp();
  try {
    for (const { id, path } of RUNTIME_MODELS) {
      const bytes = gunzipSync(readFileSync(`public/${path}`));
      const asset = await parseLocalGLB(app, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
      const original = asset.resource.instantiateRenderEntity();
      const sourcePosition = original.getLocalPosition().clone(), sourceRotation = original.getLocalRotation().clone(), sourceScale = original.getLocalScale().clone();
      original.destroy();
      const mount = createWaterMount(app, asset, { id }); app.root.addChild(mount.root);
      assert.deepEqual(mount.rider!.getLocalPosition(), sourcePosition, `${id} preserves GLB fitting translation`);
      assert.deepEqual(mount.rider!.getLocalRotation(), sourceRotation, `${id} preserves GLB fitting rotation`);
      assert.deepEqual(mount.rider!.getLocalScale(), sourceScale, `${id} preserves GLB fitting scale`);
      assert.equal(mount.getState().riderStatus, 'ready'); assert.equal(mount.getState().ridingLegPairs, 2);
      for (const side of ['L', 'R']) {
        const thigh = mount.rider!.findByName(`Thigh.${side}`)!, shin = mount.rider!.findByName(`Shin.${side}`)!, foot = mount.rider!.findByName(`Foot.${side}`)!;
        assert.ok(Math.abs(shin.getPosition().x) > Math.abs(thigh.getPosition().x) + .05, `${id} knee splays out beside saddle`);
        assert.ok(Math.abs(foot.getPosition().x) > Math.abs(shin.getPosition().x) + .04, `${id} feet remain outside knees`);
        assert.ok(foot.getPosition().y < shin.getPosition().y && shin.getPosition().y < thigh.getPosition().y, `${id} legs descend naturally from saddle`);
      }
      mount.root.setPosition(17, .13, -34); mount.root.setEulerAngles(0, 73, 0);
      let maximumSeatError = 0, maximumGripError = 0, paletteChanged = false;
      const skinMeshes = meshes(mount.rider!).filter(m => m.skinInstance);
      const before = new Map(skinMeshes.map(mesh => { mesh.skinInstance.updateMatrixPalette(mesh.skinInstance.rootBone, 1); return [mesh, [...mesh.skinInstance.matrixPalette]]; }));
      for (let pose = 0; pose <= 20; pose++) {
        mount.update({ speed: 22, steer: -1 + pose / 10, time: pose * .12, boost: pose > 15 });
        const state = mount.getState(); maximumSeatError = Math.max(maximumSeatError, state.pelvisSeatError!); maximumGripError = Math.max(maximumGripError, state.gripErrors.left!, state.gripErrors.right!);
        for (const mesh of skinMeshes) {
          const skin = mesh.skinInstance; skin.updateMatrixPalette(skin.rootBone, pose + 2);
          assert.ok([...skin.matrixPalette].every(Number.isFinite));
          if (JSON.stringify([...skin.matrixPalette]) !== JSON.stringify(before.get(mesh))) paletteChanged = true;
          const positions: number[] = [], weights: number[] = [], indices: number[] = [];
          mesh.mesh.getPositions(positions); mesh.mesh.getVertexStream(pc.SEMANTIC_BLENDWEIGHT, weights); mesh.mesh.getVertexStream(pc.SEMANTIC_BLENDINDICES, indices);
          for (let sample = 0; sample < 12; sample++) {
            const v = Math.floor(sample * (positions.length / 3 - 1) / 11), point = new pc.Vec3(...positions.slice(v * 3, v * 3 + 3)), result = new pc.Vec3();
            for (let k = 0; k < 4; k++) result.add(skin.matrices[indices[v * 4 + k]].transformPoint(point).mulScalar(weights[v * 4 + k]));
            assert.ok([result.x, result.y, result.z].every(Number.isFinite) && result.length() < 50, `${id} has a finite deformed rig`);
          }
        }
      }
      assert.ok(paletteChanged, `${id} retains actual skin animation`);
      assert.ok(maximumSeatError < .00002, `${id} pelvis remains anchored after turning and bobbing`);
      assert.ok(maximumGripError < .00002, `${id} hands keep contact with actual grab bar targets`);
      console.log(JSON.stringify({ id, poses: 21, maximumSeatError, maximumGripError, ridingLegPairs: mount.getState().ridingLegPairs }));
      mount.dispose(); disposeDriverAsset(asset);
    }
  } finally { app.destroy(); }
});

test('canonical three-clip imports steer the grab bar without requiring a range clip', async () => {
  const app = headlessApp();
  const asset = await parseLocalGLB(app, syntheticDriverGLB({ bones: ['Pelvis', 'WheelBone'], clips: ['Idle', 'Steer_Left', 'Steer_Right'] }));
  try {
    const mount = createWaterMount(app, asset); app.root.addChild(mount.root);
    assert.equal(mount.getState().animationMode, 'three-clip-blend');
    mount.update({ speed: 12, steer: -1, time: 1 }); assert.ok(mount.getState().gripErrors.left! < 1e-5);
    mount.update({ speed: 12, steer: 1, time: 1 }); assert.ok(mount.getState().gripErrors.left! < 1e-5);
    mount.dispose();
  } finally { disposeDriverAsset(asset); app.destroy(); }
});
