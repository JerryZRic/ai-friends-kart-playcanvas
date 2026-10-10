import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as pc from 'playcanvas';
import {createCharacterPreviewStage, PORTRAIT_CLEAR_COLOR, PORTRAIT_LIGHTING} from '../src/character-preview-stage';
import {characterPreviewCamera} from '../src/character-preview';

function application() {
  const canvas = {width: 700, height: 310, addEventListener() {}, removeEventListener() {}} as any;
  const app = new pc.AppBase(canvas), options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.RenderComponentSystem, pc.LightComponentSystem]; options.devtools = false;
  app.init(options); return app;
}

test('portrait lighting is bounded and explicit, isolated from racing and garage scenes', () => {
  const app = application(), otherApp = application();
  const previousAmbient = otherApp.scene.ambientLight.clone(), previousExposure = otherApp.scene.exposure;
  const stage = createCharacterPreviewStage(app);
  try {
    assert.deepEqual(app.scene.ambientLight.toArray().slice(0, 3), [...PORTRAIT_LIGHTING.ambient]);
    assert.equal(app.scene.exposure, 1); assert.equal(PORTRAIT_CLEAR_COLOR.a, 1);
    const lights = stage.room.findComponents('light') as pc.LightComponent[];
    assert.equal(lights.length, 2);
    assert.equal(lights[0].intensity, .95); assert.equal(lights[1].intensity, .30);
    assert.ok(lights.every(light => !light.castShadows));
    assert.deepEqual(otherApp.scene.ambientLight, previousAmbient); assert.equal(otherApp.scene.exposure, previousExposure);
    const source = readFileSync('src/character-preview.ts', 'utf8');
    assert.match(source, /alpha: false/); assert.match(source, /toneMapping: pc.TONEMAP_ACES/); assert.match(source, /gammaCorrection: pc.GAMMA_SRGB/);
    assert.match(source, /clearColor: PORTRAIT_CLEAR_COLOR/);
    assert.match(source, /stage = createCharacterPreviewStage\(app\)/);
    assert.match(source, /stage\?\.fit\(model.bounds\)/);
    assert.match(source, /oldStage\?\.dispose\(\)/);
    for (const file of ['scene.ts', 'waterpark-scene.ts', 'kart-garage-stage.ts']) assert.doesNotMatch(readFileSync(`src/${file}`, 'utf8'), /character-preview-stage/);
  } finally {stage.dispose(); app.destroy(); otherApp.destroy();}
});

test('portrait background has bounded native geometry with a clear center and soft contact', () => {
  const app = application(), stage = createCharacterPreviewStage(app);
  try {
    const renders = stage.room.findComponents('render') as pc.RenderComponent[];
    const meshes = renders.flatMap(render => render.meshInstances);
    const materials = new Set(meshes.map(mesh => mesh.material as pc.StandardMaterial));
    assert.ok(meshes.length <= 24); assert.ok(materials.size <= 8);
    assert.ok(new Set(meshes.map(mesh => mesh.mesh)).size <= 3);
    assert.ok(renders.every(render => !render.castShadows && !render.receiveShadows));
    for (const name of ['Portrait floor', 'Portrait backdrop', 'Portrait display shelf', 'Portrait tool rail', 'Portrait canister 0', 'Portrait hanging utensil 0', 'Portrait pedestal top']) {
      const fixture = stage.room.findByName(name) as pc.Entity;
      assert.ok(fixture?.render?.meshInstances[0]?.mesh.vertexBuffer.numVertices, `${name} is actual geometry`);
    }
    const shadow = [...materials].find(material => material.name === 'Portrait contact shadow')!;
    assert.equal(shadow.opacityMap!.width, 64); assert.equal(shadow.opacityMap!.height, 64);
    assert.equal(shadow.depthWrite, false); assert.equal(shadow.blendType, pc.BLEND_NORMAL);
    assert.ok([...materials].filter(material => material !== shadow).every(material => material.blendType === pc.BLEND_NONE && material.gloss < .2));
  } finally {stage.dispose(); app.destroy();}
});

test('portrait platform follows original bounds while room and props never rotate with the model', () => {
  const app = application(), stage = createCharacterPreviewStage(app);
  const model = new pc.Entity('Unchanged portrait', app); app.root.addChild(model);
  try {
    for (const half of [[.42685, .48987, .26485], [.23814, .28790, .14166], [.41994, .47191, .23238]]) {
      const bounds = new pc.BoundingBox(new pc.Vec3(0, half[1], 0), new pc.Vec3(...half));
      const original = bounds.clone(); stage.fit(bounds);
      const unit = half[1] * 2, radius = Math.hypot(half[0], half[2]);
      const top = (stage.room.findByName('Portrait pedestal top') as pc.Entity).render!.meshInstances[0].aabb;
      assert.ok(Math.abs(top.getMax().y + .014 * unit) < 1e-6, 'feet stay just above platform');
      assert.ok(top.halfExtents.x > radius && top.halfExtents.z > radius, 'platform clears all rotation angles');
      for (const name of ['Portrait backdrop', 'Portrait display shelf', 'Portrait tool rail', 'Portrait canister 0', 'Portrait hanging utensil 0']) {
        const box = (stage.room.findByName(name) as pc.Entity).render!.meshInstances[0].aabb;
        const x = pc.math.clamp(0, box.getMin().x, box.getMax().x), z = pc.math.clamp(0, box.getMin().z, box.getMax().z);
        assert.ok(Math.hypot(x, z) > radius, `${name} never intersects the rotating figure`);
      }
      const transforms = stage.room.children.map(entity => [...entity.getWorldTransform().data]);
      for (const yaw of [-360, -16, 0, 90, 180, 720]) {
        model.setLocalEulerAngles(0, yaw, 0);
        assert.deepEqual(stage.room.children.map(entity => [...entity.getWorldTransform().data]), transforms);
      }
      assert.deepEqual(bounds, original, 'fitting reads but never changes original bounds');
      for (const aspect of [.42, 1, 700/310]) {
        const view = characterPreviewCamera(bounds, aspect);
        assert.ok(view.distance * Math.sin(Math.min(view.fov * Math.PI / 360, Math.atan(Math.tan(view.fov * Math.PI / 360) * aspect))) > bounds.halfExtents.length());
      }
    }
  } finally {model.destroy(); stage.dispose(); app.destroy();}
});

test('portrait stage destroys only owned geometry, materials and contact texture exactly once', () => {
  const app = application(), stage = createCharacterPreviewStage(app);
  const materials = new Set((stage.room.findComponents('render') as pc.RenderComponent[]).flatMap(render => render.meshInstances).map(mesh => mesh.material as pc.StandardMaterial));
  const texture = [...materials].find(material => material.opacityMap)?.opacityMap!;
  let materialDestroys = 0, textureDestroys = 0;
  for (const material of materials) {const destroy = material.destroy.bind(material); material.destroy = () => {materialDestroys++; destroy();};}
  const destroy = texture.destroy.bind(texture); texture.destroy = () => {textureDestroys++; destroy();};
  stage.dispose(); stage.dispose();
  assert.equal(materialDestroys, materials.size); assert.equal(textureDestroys, 1); assert.equal(app.root.children.length, 0);
  app.destroy();
});
