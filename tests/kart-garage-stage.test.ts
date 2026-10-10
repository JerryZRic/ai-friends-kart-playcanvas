import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {createKartGarageStage, garageStageCamera, garageViewportSize, GARAGE_CLEAR_COLOR} from '../src/kart-garage-stage';

function application() {
  const canvas = {width: 1280, height: 720, addEventListener() {}, removeEventListener() {}} as any;
  const app = new pc.AppBase(canvas), options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.RenderComponentSystem, pc.LightComponentSystem]; options.devtools = false;
  app.init(options); return app;
}

test('garage viewport sizing stays finite on resize and bounds resolution cost', () => {
  assert.deepEqual(garageViewportSize(715, 278, 3), {width:715, height:278, aspect:715/278, pixelRatio:1.5});
  assert.deepEqual(garageViewportSize(0, NaN, Infinity, true), {width:1, height:1, aspect:1, pixelRatio:1});
  assert.equal(GARAGE_CLEAR_COLOR.a, 1);
});

test('garage turntable keeps room and lights fixed while centering the unchanged assembly modules', () => {
  const app = application(), stage = createKartGarageStage(app);
  const root = new pc.Entity('Original assembly', app), part = new pc.Entity('Original module', app);
  root.addChild(part); part.setLocalPosition(.7, -.1, .4); part.setLocalEulerAngles(10, 20, 30);
  const original = part.getLocalTransform().clone();
  const bounds = new pc.BoundingBox(new pc.Vec3(3, 2, -4), new pc.Vec3(1, .8, 1.7));
  stage.attach(root, bounds);
  const roomTransform = stage.room.getWorldTransform().clone();
  const light = stage.room.findByName('Garage key') as pc.Entity;
  const lightTransform = light.getWorldTransform().clone();
  const fixtures = stage.room.children.map(entity => ({entity, transform: entity.getWorldTransform().clone()}));
  const center = new pc.Vec3();
  for (const yaw of [-360, 0, 36, 90, 180, 540]) {
    stage.rotate(yaw);
    root.getWorldTransform().transformPoint(bounds.center, center);
    assert.ok(center.distance(bounds.center) < 1e-5, 'rotation is about the assembly bounds center');
    assert.deepEqual([...part.getLocalTransform().data], [...original.data]);
    assert.deepEqual([...stage.room.getWorldTransform().data], [...roomTransform.data]);
    assert.deepEqual([...light.getWorldTransform().data], [...lightTransform.data]);
    for (const {entity, transform} of fixtures) assert.deepEqual([...entity.getWorldTransform().data], [...transform.data], `${entity.name} stays fixed while the car turns`);
  }
  root.destroy(); stage.dispose(); stage.dispose(); assert.equal(app.root.children.length, 0); app.destroy();
});

test('garage camera fits complete rotation sphere even at closest zoom and short landscape ratios', () => {
  const bounds = new pc.BoundingBox(new pc.Vec3(1, 2, 3), new pc.Vec3(1.2, 1, 2));
  for (const aspect of [.45, 1, 715/278, 4]) for (const pitch of [4, 22, 78]) for (const zoom of [.72, 1, 1.8]) {
    const view = garageStageCamera(bounds, aspect, pitch, zoom), distance = view.position.distance(view.target);
    const halfFov = Math.min(view.fov * Math.PI/360, Math.atan(Math.tan(view.fov*Math.PI/360)*aspect));
    assert.ok(distance * Math.sin(halfFov) >= bounds.halfExtents.length());
    assert.ok(view.nearClip < distance - bounds.halfExtents.length());
    assert.ok(view.farClip > distance + bounds.halfExtents.length());
    assert.ok(Math.abs(Math.atan2(view.position.x-view.target.x,view.position.z-view.target.z)*180/Math.PI-36)<1e-5);
  }
});

test('mounted garage uses opaque stage, centered vehicle rotation, resize helper and cleanup', async () => {
  const {readFileSync} = await import('node:fs');
  const source = readFileSync('src/kart-garage.ts', 'utf8');
  assert.match(source, /alpha: false/);
  assert.match(source, /clearColor: GARAGE_CLEAR_COLOR/);
  assert.match(source, /stage = createKartGarageStage\(app\)/);
  assert.match(source, /stage!\.attach\(next.root, next.bounds\)/);
  assert.match(source, /stage\?\.rotate\(yaw\)/);
  assert.match(source, /garageViewportSize\(rect.width, rect.height/);
  assert.match(source, /stage\?\.dispose\(\); stage = null/);
});


test('workshop details are real native meshes with shared finishes and bounded render cost', () => {
  const app = application(), stage = createKartGarageStage(app);
  try {
    const fixtureNames = [
      'Workbench left inset panel', 'Workbench drawer pull 0', 'Workbench top surface',
      'Pegboard inset', 'Hanging wrench shaft', 'Hanging hammer head', 'Hanging screwdriver grip',
      'Bench vise jaw -3.6', 'Bench vise crank', 'Bench light diffuser',
      'Workshop frosted window', 'Workshop window mullion', 'Workshop window sill',
      'Workshop wall shelf', 'Shelf canister cap 0', 'Shelf bin label',
      'Service trolley caster 1.83 -2.64', 'Service trolley drawer pull 0', 'Service trolley tin lid',
      'Stationary platform rim', 'Platform service mark 0', 'Floor joint across 0',
    ];
    for (const name of fixtureNames) {
      const fixture = stage.room.findByName(name) as pc.Entity;
      assert.ok(fixture?.render?.meshInstances.length, `${name} has actual engine geometry`);
      assert.equal(fixture.parent, stage.room, `${name} never inherits the car pivot`);
      for (const mesh of fixture.render.meshInstances) {
        assert.ok(mesh.mesh.vertexBuffer.numVertices > 0);
        assert.ok([...mesh.aabb.center.toArray(), ...mesh.aabb.halfExtents.toArray()].every(Number.isFinite));
      }
    }
    const renders = stage.room.findComponents('render') as pc.RenderComponent[];
    const meshes = renders.flatMap(render => render.meshInstances);
    const materials = new Set(meshes.map(mesh => mesh.material as pc.StandardMaterial));
    assert.ok(meshes.length <= 128, 'workshop detail has a small fixed draw-call budget');
    assert.ok(materials.size <= 16, 'props reuse the room palette instead of allocating per object');
    assert.ok(new Set(meshes.map(mesh => mesh.mesh)).size <= 3, 'all props reuse native box, cylinder and plane geometry');
    assert.ok([...materials].some(material => material.gloss >= .5), 'metal has a distinct brushed finish');
    assert.ok([...materials].some(material => material.gloss < .1), 'rubber remains matte');
    for (const render of renders) {
      assert.equal(render.castShadows, false);
      assert.equal(render.receiveShadows, false);
    }
    const lights = stage.room.findComponents('light') as pc.LightComponent[];
    assert.equal(lights.length, 2, 'diffusers need no per-prop lights or extra shadow maps');
    assert.ok(lights.every(light => !light.castShadows));
    assert.ok([...materials].filter(material => material.blendType !== pc.BLEND_NONE).every(material => material.name === 'Soft contact shadow'));
  } finally {stage.dispose(); app.destroy();}
});

test('workshop furniture clears the rotating vehicle and grounding survives assembly changes', () => {
  const app = application(), stage = createKartGarageStage(app);
  try {
    for (const bounds of [
      new pc.BoundingBox(new pc.Vec3(0, 1, 0), new pc.Vec3(1, 1, 1.7)),
      new pc.BoundingBox(new pc.Vec3(-3, .1, 7), new pc.Vec3(.1, .08, .2)),
    ]) {
      const root = new pc.Entity('Unchanged replacement assembly', app);
      stage.attach(root, bounds);
      const unit = Math.max(.5, Math.hypot(bounds.halfExtents.x, bounds.halfExtents.z));
      assert.ok(stage.room.getPosition().distance(new pc.Vec3(bounds.center.x, bounds.center.y - bounds.halfExtents.y, bounds.center.z)) < 1e-6);
      const top = (stage.room.findByName('Stationary turntable top') as pc.Entity).render.meshInstances[0].aabb;
      const gap = bounds.center.y - bounds.halfExtents.y - top.getMax().y;
      assert.ok(Math.abs(gap - .012 * unit) < 1e-5, 'platform remains immediately below the unchanged wheel/assembly bounds');
      for (const name of ['Workbench recessed carcass', 'Bench vise body', 'Pegboard inset', 'Workshop wall shelf', 'Service trolley body', 'Workshop window frame']) {
        const fixture = stage.room.findByName(name) as pc.Entity;
        const box = fixture.render.meshInstances[0].aabb, min = box.getMin(), max = box.getMax();
        const closestX = pc.math.clamp(bounds.center.x, min.x, max.x) - bounds.center.x;
        const closestZ = pc.math.clamp(bounds.center.z, min.z, max.z) - bounds.center.z;
        assert.ok(Math.hypot(closestX, closestZ) > 1.25 * unit, `${name} clears the complete vehicle turn radius`);
      }
      const detachedBounds = stage.bounds!; detachedBounds.center.set(999, 999, 999);
      assert.deepEqual(stage.bounds!.center, bounds.center, 'callers cannot mutate the stored fit');
      root.destroy();
    }
  } finally {stage.dispose(); app.destroy();}
});

test('workshop disposal releases each owned material and contact texture exactly once', () => {
  const app = application(), stage = createKartGarageStage(app);
  const materials = new Set((stage.room.findComponents('render') as pc.RenderComponent[]).flatMap(render => render.meshInstances.map(mesh => mesh.material as pc.StandardMaterial)));
  const destroys = new Map<pc.StandardMaterial, number>();
  for (const material of materials) {
    const destroy = material.destroy.bind(material);
    material.destroy = () => {destroys.set(material, (destroys.get(material) || 0) + 1); destroy();};
  }
  const shadow = [...materials].find(material => material.name === 'Soft contact shadow')!.opacityMap!;
  let textureDestroys = 0;
  const destroyTexture = shadow.destroy.bind(shadow);
  shadow.destroy = () => {textureDestroys++; destroyTexture();};
  const unrelated = new pc.Entity('Other app content', app); app.root.addChild(unrelated);
  stage.dispose(); stage.dispose();
  assert.deepEqual(app.root.children, [unrelated], 'only the workshop and its vehicle pivot are removed');
  assert.equal(textureDestroys, 1);
  assert.ok([...materials].every(material => destroys.get(material) === 1));
  app.destroy();
});
