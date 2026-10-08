import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { PlanarRenderer } from 'playcanvas/scripts/esm/planar-renderer.mjs';
import { createWaterparkReflection, getWaterparkReflectionSize } from '../src/waterpark-reflection';
import { sampleCamera, sampleWaterpark, SAMPLE_LENGTH } from '../src/waterpark-design';

/** Real engine cameras/layers/script/resources on NullGraphicsDevice; no GPU pixels. */
function fixture(withScripts = false) {
  const canvas = {
    id: 'reflection-test', width: 1280, height: 720,
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; },
  } as any;
  const app = new pc.AppBase(canvas), options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem,
    ...(withScripts ? [pc.ScriptComponentSystem] : [])];
  options.devtools = false;
  app.init(options);
  const root = new pc.Entity('Static scenery'); app.root.addChild(root);
  const waterMaterial = new pc.StandardMaterial(), stoneMaterial = new pc.StandardMaterial();
  const addMesh = (name: string, material = stoneMaterial, parent = root) => {
    const entity = new pc.Entity(name);
    entity.addComponent('render', {
      meshInstances: [new pc.MeshInstance(pc.Mesh.fromGeometry(app.graphicsDevice, new pc.BoxGeometry()), material)],
    });
    parent.addChild(entity);
    return entity;
  };
  const scenery = addMesh('Reflectable tower'), water = addMesh('Water surface', waterMaterial);
  const sun = new pc.Entity('Sun');
  sun.addComponent('light', { type: 'directional', intensity: 2.1, castShadows: true });
  sun.setEulerAngles(47, -35, 0); root.addChild(sun);
  const camera = new pc.Entity('Main camera');
  camera.addComponent('camera', { fov: 56, nearClip: 0.1, farClip: 1200, gammaCorrection: pc.GAMMA_SRGB, toneMapping: pc.TONEMAP_ACES });
  root.addChild(camera); camera.setPosition(2, 4, 10); camera.lookAt(0, 0, 0);
  return { app, canvas, root, camera, sun, scenery, water, waterMaterial, stoneMaterial, addMesh };
}

function parameter<T>(material: pc.Material, name: string) {
  return (material.getParameter(name) as { data: T }).data;
}

test('reflection quality is half resolution with both axes capped, including portrait and device limits', () => {
  assert.deepEqual(getWaterparkReflectionSize(1280, 720), { width: 640, height: 360, scale: 0.5 });
  assert.deepEqual(getWaterparkReflectionSize(3840, 2160), { width: 768, height: 432, scale: 0.2 });
  assert.deepEqual(getWaterparkReflectionSize(2160, 3840), { width: 432, height: 768, scale: 0.2 });
  assert.deepEqual(getWaterparkReflectionSize(2048, 1024, 256), { width: 256, height: 128, scale: 0.125 });
  assert.deepEqual(getWaterparkReflectionSize(2, 2), { width: 1, height: 1, scale: 0.5 });
  for (const [width, height, limit] of [[0, 720, 4096], [1280, 1, 4096], [NaN, 720, 4096], [1280, Infinity, 4096], [1280, 720, 0], [1e9, 2, 4096]]) {
    assert.equal(getWaterparkReflectionSize(width, height, limit), null);
  }
});

test('official renderer initializes without an existing script system, mirrors the camera and clips below water', () => {
  const f = fixture();
  try {
    assert.equal(f.app.systems.script, undefined);
    const reflection = createWaterparkReflection(f.app, f.root, f.camera, f.waterMaterial, [f.water]);
    assert.ok(f.app.systems.script instanceof pc.ScriptComponentSystem);
    assert.ok(reflection.renderer instanceof PlanarRenderer);
    assert.equal(reflection.renderer.sceneCameraEntity, f.camera);
    assert.equal(reflection.renderer.obliqueClipping, true);
    assert.equal(reflection.renderer.clipBias, 0.15);
    assert.equal(reflection.renderer.planePoint.y, 0);
    assert.deepEqual(reflection.camera.getPosition().toArray(), [2, -4, 10]);
    assert.ok(Math.abs(reflection.camera.forward.y + f.camera.forward.y) < 1e-6);
    const target = reflection.camera.camera!.renderTarget!;
    assert.equal(target.width, 640); assert.equal(target.height, 360);
    assert.equal(target.samples, 1); assert.equal(target.depth, true);
    assert.equal(target.colorBuffer!.format, pc.PIXELFORMAT_SRGBA8);
    assert.equal(target.colorBuffer!.mipmaps, false);
    assert.equal(parameter(f.waterMaterial, 'waterReflectionMap'), target.colorBuffer);
    assert.equal(parameter(f.waterMaterial, 'waterReflectionAvailable'), 1);
    assert.deepEqual(Array.from(parameter<Float32Array>(f.waterMaterial, 'uScreenSize')).slice(0, 2), [1280, 720]);
    const projection = new pc.Mat4(); reflection.camera.camera!.calculateProjection!(projection, pc.VIEW_CENTER);
    assert.ok(Array.from(projection.data).every(Number.isFinite));
    // Geometry below the biased water plane is beyond the oblique near plane.
    const view = new pc.Mat4().invert(reflection.camera.getWorldTransform());
    const viewProjection = new pc.Mat4().mul2(projection, view);
    const above = viewProjection.transformVec4(new pc.Vec4(0, 2, 0, 1));
    const below = viewProjection.transformVec4(new pc.Vec4(0, -2, 0, 1));
    assert.ok(above.z >= -above.w);
    assert.ok(below.z < -below.w);
    assert.equal(reflection.camera.camera!.priority, f.camera.camera!.priority - 1);
    assert.equal(reflection.camera.camera!.toneMapping, f.camera.camera!.toneMapping);
  } finally { f.app.destroy(); f.waterMaterial.destroy(); f.stoneMaterial.destroy(); }
});

test('dedicated layers exclude water, nested wake and later mount while reflection lights never cast shadows', () => {
  const f = fixture(true);
  try {
    const scripts = f.app.systems.script;
    const reflection = createWaterparkReflection(f.app, f.root, f.camera, f.waterMaterial);
    assert.equal(f.app.systems.script, scripts, 'existing script system is reused');
    assert.deepEqual(reflection.camera.camera!.layers, [reflection.layer.id]);
    assert.ok(f.camera.camera!.layers.includes(reflection.waterLayer.id));
    assert.ok(!f.camera.camera!.layers.includes(reflection.layer.id));
    assert.deepEqual(f.water.render!.layers, [reflection.waterLayer.id], 'material feedback guard excludes water without an explicit entity');
    assert.deepEqual(reflection.layer.meshInstances, [...f.scenery.render!.meshInstances]);
    assert.equal(reflection.layer.shadowCasters.length, 0);
    assert.equal(reflection.reflectionLights.length, 1);
    assert.equal(reflection.reflectionLights[0].light!.castShadows, false);
    assert.equal(reflection.reflectionLights[0].light!.intensity, f.sun.light!.intensity);
    assert.deepEqual(reflection.reflectionLights[0].light!.layers, [reflection.layer.id]);
    assert.equal(f.sun.light!.castShadows, true);
    assert.deepEqual(f.sun.light!.layers, [pc.LAYERID_WORLD]);
    const mount = f.addMesh('Later dynamic mount');
    assert.ok(!reflection.layer.meshInstances.includes(mount.render!.meshInstances[0]));
    const wakeRoot = new pc.Entity('Wake root'); f.root.addChild(wakeRoot);
    const wake = f.addMesh('Nested wake', f.stoneMaterial, wakeRoot);
    reflection.exclude(wakeRoot); reflection.exclude(wakeRoot);
    assert.deepEqual(wake.render!.layers, [reflection.waterLayer.id]);
    assert.ok(!reflection.layer.meshInstances.includes(wake.render!.meshInstances[0]));
    const world = f.app.scene.layers.getLayerById(pc.LAYERID_WORLD)!;
    assert.ok(f.app.scene.layers.getOpaqueIndex(reflection.waterLayer) > f.app.scene.layers.getOpaqueIndex(world));
    assert.ok(f.app.scene.layers.getOpaqueIndex(reflection.waterLayer) < f.app.scene.layers.getTransparentIndex(world));
    reflection.destroy(); reflection.destroy();
    assert.deepEqual(f.water.render!.layers, [pc.LAYERID_WORLD]);
    assert.deepEqual(wake.render!.layers, [pc.LAYERID_WORLD]);
    assert.ok(!f.camera.camera!.layers.includes(reflection.waterLayer.id));
    assert.equal(f.app.scene.layers.getLayerById(reflection.layer.id), null);
    assert.equal(f.app.scene.layers.getLayerById(reflection.waterLayer.id), null);
    assert.equal(reflection.update(), null);
  } finally { f.app.destroy(); f.waterMaterial.destroy(); f.stoneMaterial.destroy(); }
});

test('mirrored projection remains finite along the complete route and matches the official screen-UV vertical flip', () => {
  const f = fixture();
  try {
    const reflection = createWaterparkReflection(f.app, f.root, f.camera, f.waterMaterial);
    f.camera.camera!.aspectRatio = f.canvas.width / f.canvas.height;
    for (let distance = 0; distance <= SAMPLE_LENGTH; distance += 5) {
      const pose = sampleCamera(distance);
      f.camera.setPosition(...pose.position as [number, number, number]);
      f.camera.lookAt(...pose.target as [number, number, number]);
      reflection.update();
      const reflectedPosition = reflection.camera.getPosition();
      assert.ok(Math.abs(reflectedPosition.x - pose.position[0]) < 1e-5);
      assert.ok(Math.abs(reflectedPosition.y + pose.position[1]) < 1e-5);
      assert.ok(Math.abs(reflectedPosition.z - pose.position[2]) < 2e-5);
      const projection = new pc.Mat4(); reflection.camera.camera!.calculateProjection!(projection, pc.VIEW_CENTER);
      assert.ok(Array.from(projection.data).every(Number.isFinite), `finite oblique projection at ${distance}m`);
      const reflectionView = new pc.Mat4().invert(reflection.camera.getWorldTransform());
      const reflectionVp = new pc.Mat4().mul2(projection, reflectionView);
      const mainView = new pc.Mat4().invert(f.camera.getWorldTransform());
      const mainVp = new pc.Mat4().mul2(f.camera.camera!.projectionMatrix, mainView);
      for (const lateral of [-8, 0, 8]) {
        const point = sampleWaterpark(distance + 25, lateral).p;
        const world = new pc.Vec4(point.x, 0, point.z, 1);
        const main = mainVp.transformVec4(world), reflected = reflectionVp.transformVec4(world);
        assert.ok(Math.abs(main.x / main.w - reflected.x / reflected.w) < 2e-4, `screen x at ${distance}m`);
        assert.ok(Math.abs(main.y / main.w + reflected.y / reflected.w) < 2e-4, `flipped screen y at ${distance}m`);
      }
    }
  } finally { f.app.destroy(); f.waterMaterial.destroy(); f.stoneMaterial.destroy(); }
});

test('initial hidden canvas binds a fallback without allocating a target and disposes before app start', () => {
  const f = fixture();
  f.canvas.width = 0; f.canvas.height = 0;
  try {
    const reflection = createWaterparkReflection(f.app, f.root, f.camera, f.waterMaterial);
    assert.equal(reflection.camera.camera!.renderTarget, null);
    assert.equal(reflection.camera.camera!.enabled, false);
    assert.equal(parameter(f.waterMaterial, 'waterReflectionAvailable'), 0);
    const fallback = parameter<pc.Texture>(f.waterMaterial, 'waterReflectionMap');
    assert.equal(fallback.width, 1);
    assert.equal(f.app.scene.hasEvent('postrender'), true, 'official initialize ran before app.start');
    reflection.destroy();
    assert.equal(f.app.scene.hasEvent('postrender'), false);
    assert.equal((fallback as any).device, null);
  } finally { f.app.destroy(); f.waterMaterial.destroy(); f.stoneMaterial.destroy(); }
});

test('target resources are reused, reallocated on bounded resize and released exactly once on app destroy', () => {
  const f = fixture();
  const reflection = createWaterparkReflection(f.app, f.root, f.camera, f.waterMaterial, [f.water]);
  const first = reflection.camera.camera!.renderTarget!, firstTexture = first.colorBuffer!;
  let firstTargetDestroyed = 0, firstTextureDestroyed = 0;
  const destroyTarget = first.destroy.bind(first), destroyTexture = firstTexture.destroy.bind(firstTexture);
  first.destroy = () => { firstTargetDestroyed++; destroyTarget(); };
  firstTexture.destroy = () => { firstTextureDestroyed++; destroyTexture(); };
  assert.equal(reflection.update(), firstTexture);
  assert.equal(reflection.camera.camera!.renderTarget, first);
  f.canvas.width = 3840; f.canvas.height = 2160;
  const secondTexture = reflection.update()!;
  assert.equal(secondTexture.width, 768); assert.equal(secondTexture.height, 432);
  assert.equal(firstTargetDestroyed, 1); assert.equal(firstTextureDestroyed, 1);
  const second = reflection.camera.camera!.renderTarget!;
  let secondTargetDestroyed = 0, secondTextureDestroyed = 0;
  const secondTargetDestroy = second.destroy.bind(second), secondTextureDestroy = secondTexture.destroy.bind(secondTexture);
  second.destroy = () => { secondTargetDestroyed++; secondTargetDestroy(); };
  secondTexture.destroy = () => { secondTextureDestroyed++; secondTextureDestroy(); };
  f.canvas.width = 0;
  assert.equal(reflection.update(), null);
  assert.equal(reflection.camera.camera!.enabled, false);
  assert.equal(parameter(f.waterMaterial, 'waterReflectionAvailable'), 0);
  const fallback = parameter<pc.Texture>(f.waterMaterial, 'waterReflectionMap');
  assert.notEqual(fallback, secondTexture); assert.equal(fallback.width, 1);
  assert.ok(Array.from(parameter<Float32Array>(f.waterMaterial, 'uScreenSize')).every(Number.isFinite));
  let fallbackDestroyed = 0; const fallbackDestroy = fallback.destroy.bind(fallback);
  fallback.destroy = () => { fallbackDestroyed++; fallbackDestroy(); };
  f.canvas.width = 3840;
  assert.equal(reflection.update(), secondTexture);
  assert.equal(reflection.camera.camera!.enabled, true);
  f.app.destroy(); reflection.destroy();
  assert.equal(secondTargetDestroyed, 1); assert.equal(secondTextureDestroyed, 1); assert.equal(fallbackDestroyed, 1);
  assert.equal(firstTargetDestroyed, 1); assert.equal(firstTextureDestroyed, 1);
  assert.equal(parameter(f.waterMaterial, 'waterReflectionAvailable'), 0);
  f.waterMaterial.destroy(); f.stoneMaterial.destroy();
});

test('scene removal releases reflection camera, official scene hook and textures before app teardown', () => {
  const f = fixture();
  const reflection = createWaterparkReflection(f.app, f.root, f.camera, f.waterMaterial);
  const texture = reflection.camera.camera!.renderTarget!.colorBuffer!;
  let released = 0; const destroyTexture = texture.destroy.bind(texture);
  texture.destroy = () => { released++; destroyTexture(); };
  assert.equal(f.app.scene.hasEvent('postrender'), true);
  f.root.destroy();
  assert.equal(released, 1);
  assert.equal(f.app.scene.hasEvent('postrender'), false);
  assert.equal(reflection.camera.parent, null);
  assert.equal(reflection.camera.camera, undefined);
  assert.equal(reflection.layer.meshInstances.length, 0);
  f.app.destroy(); assert.equal(released, 1);
  f.waterMaterial.destroy(); f.stoneMaterial.destroy();
});
