import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parseLocalGLB, validateDriverContract, createImportedRacer, disposeDriverAsset, RUNTIME_MODELS, WHEEL_AXIS, WHEEL_CENTER, MAX_WHEEL_ANGLE, type DriverAsset } from '../src/assets';

/** Real PlayCanvas loader/skeleton/animation pipeline; no GPU rendering claim.
 * Only image pixel decoding is replaced with a 1x1 null-device texture. The GLB
 * bytes, hierarchy, geometry, weights, inverse bind matrices and clips are real.
 */
function headlessApp() {
  const canvas = { id: 'rig-test', width: 1, height: 1, addEventListener() {}, removeEventListener() {}, getBoundingClientRect() { return {left: 0, top: 0, width: 1, height: 1}; } } as any;
  const device = new pc.NullGraphicsDevice(canvas), app = new pc.AppBase(canvas);
  const options = new pc.AppOptions();
  options.graphicsDevice = device; options.componentSystems = [pc.RenderComponentSystem, pc.AnimComponentSystem];
  options.resourceHandlers = [pc.ContainerHandler, pc.RenderHandler, pc.MaterialHandler, pc.TextureHandler]; options.devtools = false;
  app.init(options);
  app.assets.on('add', (asset: pc.Asset) => {
    if (asset.type === 'container') (asset.options as any).image = { processAsync(_image: unknown, done: Function) {
      const texture = new pc.Asset('headless-test-texture', 'texture');
      texture.resource = new pc.Texture(device, { width: 1, height: 1 }); texture.loaded = true; app.assets.add(texture); done(null, texture);
    } };
  });
  return app;
}
function bytes(path: string, gzip = false) {
  const data = gzip ? gunzipSync(readFileSync(path)) : readFileSync(path);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}
const skinnedMeshes = (entity: pc.Entity) => (entity.findComponents('render') as pc.RenderComponent[]).flatMap(render => render.meshInstances).filter(mesh => mesh.skinInstance);
const skins = (entity: pc.Entity) => skinnedMeshes(entity).map(mesh => mesh.skinInstance);

test('six original GLBs retain independent real skins, fitted transforms and exact steering animation in PlayCanvas', async () => {
  const app = headlessApp();
  const chassis = await parseLocalGLB(app, bytes('public/assets/kart-r12-chassis.glb'));
  try {
    for (const {id, path} of RUNTIME_MODELS) {
      const asset = await parseLocalGLB(app, bytes(`public/${path}`, true));
      assert.equal(validateDriverContract(asset), true, `${id} valid rig/weights/clips/grip trajectory`);
      const a = createImportedRacer(app, asset, chassis, {id}), b = createImportedRacer(app, asset, chassis, {id: `${id}-clone`});
      const aSkin = skins(a.model)[0], bSkin = skins(b.model)[0];
      assert.notEqual(aSkin, bSkin); assert.notEqual(aSkin.bones[0], bSkin.bones[0]);
      const aGrip = a.model.findByName('Grip.L')!, bGrip = b.model.findByName('Grip.L')!;
      const neutral = bGrip.getPosition().clone();
      aSkin.updateMatrixPalette(aSkin.rootBone, 1); const before = [...aSkin.matrixPalette];
      a.update(1, 1); aSkin.updateMatrixPalette(aSkin.rootBone, 2);
      assert.notDeepEqual([...aSkin.matrixPalette], before, `${id} updates the skin GPU matrix palette`);
      assert.ok(aGrip.getPosition().distance(neutral) > .025, `${id} authored grip moves`);
      assert.ok(bGrip.getPosition().distance(neutral) < 1e-6, `${id} second actor is independent`);
      assert.equal(a.getState().steering, 1); assert.ok(Math.abs(a.getState().wheelAngle + Math.PI / 10) < 1e-8);
      // Match the original edition's dense 121-pose CPU rig check. Sample real
      // mesh positions using the same per-bone matrices and weights as skinning.
      a.reset();
      const grips = ['L', 'R'].map(side => a.model.findByName(`Grip.${side}`)!);
      const offsets = grips.map(grip => grip.getPosition().clone().sub(WHEEL_CENTER));
      const sampledMeshes = skinnedMeshes(a.model).map(mesh => {
        const positions: number[] = [], joints: number[] = [], weights: number[] = [];
        mesh.mesh.getPositions(positions); mesh.mesh.getVertexStream(pc.SEMANTIC_BLENDINDICES, joints); mesh.mesh.getVertexStream(pc.SEMANTIC_BLENDWEIGHT, weights);
        const other = skinnedMeshes(b.model).find(candidate => candidate.mesh === mesh.mesh)!;
        assert.ok(other); assert.equal(mesh.material, other.material, 'character materials remain borrowed without recoloring');
        return {mesh, positions, joints, weights};
      });
      let maxGripError = 0, finiteSkinSamples = 0;
      const rotation = new pc.Quat(), point = new pc.Vec3(), transformed = new pc.Vec3(), result = new pc.Vec3();
      for (let pose = 0; pose <= 120; pose++) {
        const steering = -1 + pose / 60; a.update(10, steering);
        assert.equal(a.getState().steering, steering);
        assert.ok(Math.abs(a.getState().wheelAngle + steering * MAX_WHEEL_ANGLE) < 1e-10);
        rotation.setFromAxisAngle(WHEEL_AXIS, -steering * 18);
        for (let i = 0; i < grips.length; i++) {
          const expected = rotation.transformVector(offsets[i]).add(WHEEL_CENTER);
          maxGripError = Math.max(maxGripError, grips[i].getPosition().distance(expected));
        }
        for (const {mesh, positions, joints, weights} of sampledMeshes) {
          const skin = mesh.skinInstance; skin.updateMatrixPalette(skin.rootBone, pose + 10);
          for (let sample = 0; sample < 32; sample++) {
            const index = Math.floor(sample * (positions.length / 3 - 1) / 31);
            point.set(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]); result.set(0, 0, 0);
            for (let influence = 0; influence < 4; influence++) {
              const offset = index * 4 + influence;
              skin.matrices[joints[offset]].transformPoint(point, transformed);
              result.add(transformed.mulScalar(weights[offset]));
            }
            assert.ok([result.x, result.y, result.z].every(Number.isFinite), `${id} finite deformed vertex`);
            assert.ok(result.length() < 50, `${id} deformed vertex remains in fitted character scale`); finiteSkinSamples++;
          }
        }
      }
      assert.ok(maxGripError < .002, `${id} dense authored grip trajectory stays within 2 mm`);
      console.log(JSON.stringify({id, poses: 121, skinnedMeshes: sampledMeshes.length, finiteSkinSamples, maxGripDriftMillimeters: maxGripError * 1000}));
      const paused = aGrip.getPosition().clone(); a.update(1, -1, true);
      assert.ok(aGrip.getPosition().distance(paused) < 1e-8); a.reset();
      assert.ok(aGrip.getPosition().distance(neutral) < 1e-6, `${id} reset returns neutral`);
      a.dispose(); a.dispose(); assert.equal(a.getState().status, 'disposed');
      b.update(1, -1); assert.ok(bGrip.getPosition().distance(neutral) > .025, `${id} sibling survives disposal`);
      b.dispose(); disposeDriverAsset(asset);
    }
  } finally { disposeDriverAsset(chassis); app.destroy(); }
});

test('canonical Idle / Steer_Left / Steer_Right local format has a working PlayCanvas blend tree', async () => {
  const app = headlessApp();
  const original = await parseLocalGLB(app, bytes('public/assets/drivers/whale-driver.glb.gz', true));
  const chassis = await parseLocalGLB(app, bytes('public/assets/kart-r12-chassis.glb'));
  const canonical: DriverAsset = {...original, animations: ['Idle', 'Steer_Left', 'Steer_Right'].map((name, index) => {
    const source = original.animations.map(asset => asset.resource as pc.AnimTrack).find(track => track.name === ['DriveIdle', 'SteerLeft', 'SteerRight'][index])!;
    const asset = new pc.Asset(name, 'animation'); asset.resource = new pc.AnimTrack(name, source.duration, source.inputs, source.outputs, source.curves); return asset;
  })};
  try {
    assert.equal(validateDriverContract(canonical), true);
    const racer = createImportedRacer(app, canonical, chassis);
    assert.equal(racer.getState().animationMode, 'three-clip-blend');
    const grip = racer.model.findByName('Grip.L')!; const neutral = grip.getPosition().clone();
    racer.update(.5, -1); assert.ok(grip.getPosition().distance(neutral) > .02);
    racer.update(.5, 1); assert.ok(grip.getPosition().distance(neutral) > .02);
    racer.dispose();
  } finally { disposeDriverAsset(original); disposeDriverAsset(chassis); app.destroy(); }
});
