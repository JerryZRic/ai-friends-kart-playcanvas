import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { createPickupVisual, type PickupVisual } from '../src/pickup-visual';
import { getItemGeometry, ITEM_MODEL_METADATA, type ItemDisplay } from '../src/item-models';
import { setPickupDisplay } from '../src/item-pickups';
import { createCoastScene } from '../src/scene';
import { createWaterparkScene } from '../src/waterpark-scene';
import { COAST_PICKUPS, sample } from '../src/track';
import { DYNAMIC_PICKUP_CAPACITY } from '../src/dynamic-pickups';

const kinds: ItemDisplay[] = ['boost', 'shield', 'pulse', 'mystery'];
/** Real PlayCanvas geometry/material ownership without a browser or GPU. */
function fixture() {
  const canvas = { id: `pickup-visual-${Math.random()}`, width: 1280, height: 720, addEventListener() {}, removeEventListener() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; } } as any;
  const app = new pc.AppBase(canvas), options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem, pc.ScriptComponentSystem];
  options.devtools = false; app.init(options);
  return app as pc.Application;
}
function shell(visual: PickupVisual) { return (visual.mesh.findByName('Translucent pickup glass') as pc.Entity).render!.meshInstances[0]; }
function frame(visual: PickupVisual) { return (visual.mesh.findByName('Luminous edges') as pc.Entity).render!.meshInstances[0]; }
function parent(app: pc.AppBase) { const root = new pc.Entity('Pickup scene', app); app.root.addChild(root); return root; }

test('shared pickup visual preserves translucent front glass, one opaque display, and the original luminous frame', () => {
  const app = fixture();
  try {
    const root = parent(app), visual = createPickupVisual(app, root);
    assert.equal(visual.mesh.parent, root);
    const glass = shell(visual).material as pc.StandardMaterial;
    assert.equal(glass.opacity, .16); assert.equal(glass.blendType, pc.BLEND_NORMAL);
    assert.equal(glass.depthWrite, false); assert.equal(glass.depthTest, true);
    assert.equal(glass.cull, pc.CULLFACE_BACK); assert.equal(glass.twoSidedLighting, false);
    assert.equal(glass.useLighting, true); assert.equal(glass.diffuse.toString(false), '#b9e7f8');
    const positions: number[] = []; shell(visual).mesh.getPositions(positions);
    assert.equal(Math.min(...positions), -.625); assert.equal(Math.max(...positions), .625);
    const edge = frame(visual), glow = edge.material as pc.StandardMaterial;
    assert.equal(edge.mesh.primitive[0].count / 3, 12 * 12, 'twelve boxes are batched into one frame draw');
    assert.equal(glow.opacity, 1); assert.equal(glow.blendType, pc.BLEND_NONE);
    assert.equal(glow.depthWrite, true); assert.equal(glow.useLighting, false);
    assert.equal(glow.emissive.toString(false), '#fff6ba');
    assert.deepEqual(Object.keys(visual.models), kinds);
    const box = { ...visual, display: 'mystery' as ItemDisplay, cool: 0 };
    for (const display of ['mystery', ...kinds] as const) {
      setPickupDisplay(box, display);
      assert.equal(Object.values(visual.models).filter(model => model.enabled).length, 1);
      assert.equal(visual.models[display].enabled, true);
      for (const kind of kinds) {
        const model = visual.models[kind], bounds = getItemGeometry(kind).bounds;
        assert.equal(model.parent, visual.mesh); assert.deepEqual(model.getLocalScale().toArray(), [1, 1, 1]);
        assert.ok([...bounds.min, ...bounds.max].every(value => Math.abs(value) <= .5), 'the solid fits inside the glass');
        for (const instance of model.render!.meshInstances) {
          const material = instance.material as pc.StandardMaterial;
          assert.equal(material.opacity, 1); assert.equal(material.blendType, pc.BLEND_NONE);
          assert.equal(material.depthWrite, true); assert.equal(material.cull, pc.CULLFACE_BACK);
        }
      }
    }
    visual.mesh.enabled = false;
    assert.ok((visual.mesh.findComponents('render') as pc.RenderComponent[]).every(render => !render.entity.enabled), 'hiding the parent hides glass, frame, and contents together');
  } finally { app.destroy(); }
});

test('scene-owned shell resources survive zero instances and release exactly once without destroying the item cache', () => {
  const app = fixture();
  try {
    const root = parent(app), first = createPickupVisual(app, root), second = createPickupVisual(app, root);
    const glassMesh = shell(first).mesh, frameMesh = frame(first).mesh;
    const glass = shell(first).material, glow = frame(first).material;
    const itemMesh = first.models.boost.render!.meshInstances[0].mesh;
    assert.equal(shell(second).mesh, glassMesh); assert.equal(frame(second).mesh, frameMesh);
    assert.equal(shell(second).material, glass); assert.equal(frame(second).material, glow);
    assert.notEqual(first.models.boost, second.models.boost);
    first.mesh.setPosition(7, 3, 9); assert.deepEqual(second.mesh.getPosition().toArray(), [0, 0, 0]);
    assert.equal(glassMesh.refCount, 3); assert.equal(frameMesh.refCount, 3);
    first.mesh.destroy(); second.mesh.destroy();
    assert.equal(glassMesh.refCount, 1); assert.equal(frameMesh.refCount, 1);
    assert.ok(glassMesh.vertexBuffer && frameMesh.vertexBuffer, 'scene retains both cached meshes');
    const third = createPickupVisual(app, root);
    assert.equal(shell(third).mesh, glassMesh); assert.equal(frame(third).mesh, frameMesh);
    let materialDestructions = 0;
    for (const material of [glass, glow]) {
      const destroy = material.destroy.bind(material);
      material.destroy = () => { materialDestructions++; destroy(); };
    }
    root.destroy(); root.destroy();
    assert.equal(materialDestructions, 2);
    assert.equal(glassMesh.vertexBuffer, null); assert.equal(frameMesh.vertexBuffer, null);
    assert.equal(itemMesh.refCount, 1); assert.ok(itemMesh.vertexBuffer, 'existing item models remain app-owned');
    app.destroy();
    assert.equal(materialDestructions, 2, 'app cleanup does not re-destroy released scene materials');
    assert.equal(itemMesh.vertexBuffer, null);
  } finally { if (app.graphicsDevice) app.destroy(); }
});

test('pickup resources are isolated between scene parents and graphics devices', () => {
  const firstApp = fixture(), secondApp = fixture();
  try {
    const firstRoot = parent(firstApp), otherRoot = parent(firstApp);
    const first = createPickupVisual(firstApp, firstRoot), other = createPickupVisual(firstApp, otherRoot);
    const second = createPickupVisual(secondApp, parent(secondApp));
    const firstMesh = shell(first).mesh, otherMesh = shell(other).mesh, secondMesh = shell(second).mesh;
    assert.notEqual(firstMesh, otherMesh); assert.notEqual(firstMesh, secondMesh);
    assert.notEqual(shell(first).material, shell(other).material);
    assert.equal(first.models.pulse.render!.meshInstances[0].mesh, other.models.pulse.render!.meshInstances[0].mesh, 'item cache is still shared within an app');
    assert.notEqual(first.models.pulse.render!.meshInstances[0].mesh, second.models.pulse.render!.meshInstances[0].mesh);
    firstRoot.destroy();
    assert.equal(firstMesh.vertexBuffer, null); assert.ok(otherMesh.vertexBuffer && secondMesh.vertexBuffer);
    firstApp.destroy();
    assert.equal(otherMesh.vertexBuffer, null); assert.ok(secondMesh.vertexBuffer);
    secondApp.destroy(); assert.equal(secondMesh.vertexBuffer, null);
  } finally { if (firstApp.graphicsDevice) firstApp.destroy(); if (secondApp.graphicsDevice) secondApp.destroy(); }
});

test('coast preserves authored fixed boxes and preallocates only the bounded disabled dynamic pool', () => {
  const app = fixture();
  try {
    const world = createCoastScene(app), fixed = world.boxes.filter(box => !box.dynamic), dynamic = world.boxes.filter(box => box.dynamic);
    assert.equal(fixed.length, COAST_PICKUPS.length); assert.equal(dynamic.length, DYNAMIC_PICKUP_CAPACITY);
    assert.equal(world.boxes.length, COAST_PICKUPS.length + DYNAMIC_PICKUP_CAPACITY);
    for (const [index, box] of fixed.entries()) {
      const source = COAST_PICKUPS[index], p = sample(source.d, source.lateral).p; p.y += 1.25;
      assert.equal(box.d, source.d); assert.equal(box.lateral, source.lateral);
      assert.ok(box.mesh.getPosition().clone().sub(p).length() < .00001);
      assert.equal(box.base, p.y); assert.equal(box.mesh.enabled, true);
    }
    for (const box of dynamic) {
      assert.equal(box.dynamic, true); assert.equal(box.mesh.enabled, false); assert.equal(box.cool, 0);
      assert.equal(box.base, sample(0).p.y + 1.25);
      assert.equal(shell(box).mesh, shell(fixed[0]).mesh); assert.equal(frame(box).mesh, frame(fixed[0]).mesh);
      assert.equal(box.models.pulse.render!.meshInstances[0].mesh, fixed[0].models.pulse.render!.meshInstances[0].mesh);
    }
  } finally { app.destroy(); }
});

test('coast previews allocate no pickup visuals, pool slots, or retained item-model buffers', () => {
  const app = fixture();
  try {
    const baseline = app.graphicsDevice.buffers.size;
    for (let pass = 0; pass < 2; pass++) {
      const world = createCoastScene(app, { preview: true });
      assert.equal(world.boxes.length, 0);
      for (const name of ['Energy item box', 'Translucent pickup glass', 'Luminous edges', ...kinds.map(kind => ITEM_MODEL_METADATA.items[kind].name)]) assert.equal(world.root.findByName(name), null);
      world.root.destroy(); world.camera.destroy(); world.sun.destroy();
      assert.equal(app.graphicsDevice.buffers.size, baseline, 'no pickup/item cache was initialized during preview');
    }
  } finally { app.destroy(); }
});

test('shared water pickup retains direct lighting while every render is excluded from water capture', () => {
  const app = fixture();
  try {
    const world = createWaterparkScene(app, { race: true });
    const visual = createPickupVisual(app, world.root);
    world.reflection.exclude(visual.mesh);
    const sun = world.root.findByName('Waterpark afternoon sun') as pc.Entity;
    assert.ok(sun.light!.layers.includes(world.reflection.waterLayer.id));
    assert.ok(world.camera.camera!.layers.includes(world.reflection.waterLayer.id));
    for (const render of visual.mesh.findComponents('render') as pc.RenderComponent[]) {
      assert.deepEqual(render.layers, [world.reflection.waterLayer.id]);
      for (const instance of render.meshInstances) assert.ok(!world.reflection.layer.meshInstances.includes(instance));
    }
    assert.equal((shell(visual).material as pc.StandardMaterial).opacity, .16);
    for (const kind of kinds) for (const instance of visual.models[kind].render!.meshInstances) assert.equal((instance.material as pc.StandardMaterial).useLighting, true);
  } finally { app.destroy(); }
});
