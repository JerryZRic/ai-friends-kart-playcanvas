import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {createWaterparkWake, waterparkEffectGeometry, CONTACT_SEGMENTS, SPRAY_DROPLETS, WATERPARK_WAKE_BUDGET} from '../src/waterpark-wake';
import {sampleWaterSurface} from '../src/waterpark-surface';
import {CameraShaderParams} from '../node_modules/playcanvas/build/playcanvas/src/scene/camera-shader-params.js';

function fixture() {
  const canvas = {id: 'wake-test', width: 1280, height: 720, addEventListener() {}, removeEventListener() {}, getBoundingClientRect() {return {left: 0, top: 0, width: 1280, height: 720};}} as any;
  const app = new pc.AppBase(canvas), options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas); options.componentSystems = [pc.RenderComponentSystem]; options.devtools = false;
  app.init(options); const root = new pc.Entity('Wake parent'); app.root.addChild(root); return {app, root};
}

test('contact collar stays on analytical water throughout the bend and remains fixed-size', () => {
  for (const distance of [0, 91, 135, 183, 226, 285]) for (const lane of [-10.5, 0, 10.5]) for (const steer of [-8, 0, 8]) {
    const data = waterparkEffectGeometry(distance, lane, 30, 6.2, steer);
    assert.equal(data.contact.length, (CONTACT_SEGMENTS + 1) * 2 * 3);
    assert.ok([...data.contact, ...data.spray].every(Number.isFinite));
    assert.ok(data.impact >= 0 && data.impact <= .4);
    for (let i = 0; i < data.contact.length; i += 3) {
      assert.ok(Math.abs(data.contact[i + 1] - sampleWaterSurface(data.contact[i], data.contact[i + 2], 6.2).height - .042) < 1e-9);
    }
    assert.deepEqual(data, waterparkEffectGeometry(distance, lane, 30, 6.2, steer));
  }
  assert.notDeepEqual(waterparkEffectGeometry(100, 0, 25, 3, -8).contact, waterparkEffectGeometry(100, 0, 25, 3, 8).contact);
  const bad = waterparkEffectGeometry(NaN, Infinity, -Infinity, NaN, Infinity);
  assert.equal(bad.enabled, false); assert.ok(bad.contact.every(Number.isFinite));
});

test('all ballistic droplets collapse before recycling, even at maximum turn and impact', () => {
  const width = (data: ReturnType<typeof waterparkEffectGeometry>, index: number) => {
    const i = index * 12, p = data.spray;
    return Math.hypot(p[i + 3] - p[i], p[i + 4] - p[i + 1], p[i + 5] - p[i + 2]);
  };
  for (let index = 0; index < SPRAY_DROPLETS; index++) {
    const phase = index * .61803398875 % 1, deadTime = 20 + .999 - phase, aliveTime = 20 + .3 - phase;
    for (const d of [0, 100, 183, 285]) for (const turn of [-8, 8]) {
      assert.equal(width(waterparkEffectGeometry(d, 0, 30, deadTime, turn), index), 0);
      assert.ok(width(waterparkEffectGeometry(d, 0, 30, aliveTime, turn), index) > .01);
    }
  }
});

test('two wake draws reuse fixed buffers, preprocess native shader variants and release on parent exit', () => {
  const {app, root} = fixture();
  try {
    const wake = createWaterparkWake(app as pc.Application, root), instances = wake.entity.render!.meshInstances;
    assert.equal(instances.length, WATERPARK_WAKE_BUDGET.draws); assert.equal(wake.entity.enabled, false);
    const total = instances.reduce((sum, instance) => sum + instance.mesh.primitive[0].count / 3, 0);
    assert.equal(total, WATERPARK_WAKE_BUDGET.triangles); assert.ok(total < 200);
    const vertexBuffers = instances.map(instance => instance.mesh.vertexBuffer), indexBuffers = instances.map(instance => instance.mesh.indexBuffer[0]);
    for (let frame = 0; frame < 90; frame++) wake.update(90 + frame * .2, Math.sin(frame) * 10.5, 30, frame / 60, 8);
    for (let i = 0; i < instances.length; i++) {
      assert.equal(instances[i].mesh.vertexBuffer, vertexBuffers[i]); assert.equal(instances[i].mesh.indexBuffer[0], indexBuffers[i]);
      const instance = instances[i], material = instance.material as pc.ShaderMaterial;
      for (const srgbRenderTarget of [false, true]) {
        const cameraShaderParams = new CameraShaderParams(); cameraShaderParams.gammaCorrection = pc.GAMMA_SRGB; cameraShaderParams.srgbRenderTarget = srgbRenderTarget;
        const shader = material.getShaderVariant({device: app.graphicsDevice, scene: app.scene, objDefs: 0, cameraShaderParams, pass: pc.SHADER_FORWARD, lightList: [], vertexFormat: instance.mesh.vertexBuffer.format} as any);
        assert.equal(shader.failed, false); assert.doesNotMatch(shader.definition.fshader!, /#include/);
        assert.match(shader.definition.fshader!, /gammaCorrectOutput/);
      }
      assert.equal(material.depthWrite, false); assert.equal(material.blendType, pc.BLEND_NORMAL);
    }
    assert.equal(wake.entity.enabled, true); wake.update(10, 0, 0, 8); assert.equal(wake.entity.enabled, false);
    const counts: number[] = [], resources = instances.flatMap(instance => [instance.mesh, instance.material]);
    resources.forEach((resource, i) => {counts[i] = 0; const destroy = resource.destroy.bind(resource); resource.destroy = () => {counts[i]++; destroy();};});
    root.destroy(); wake.dispose(); wake.update(100, 0, 30, 10); assert.deepEqual(counts, [1, 1, 1, 1]);
  } finally {app.destroy();}
});
