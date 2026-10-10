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
  const center = new pc.Vec3();
  for (const yaw of [-360, 0, 36, 90, 180, 540]) {
    stage.rotate(yaw);
    root.getWorldTransform().transformPoint(bounds.center, center);
    assert.ok(center.distance(bounds.center) < 1e-5, 'rotation is about the assembly bounds center');
    assert.deepEqual([...part.getLocalTransform().data], [...original.data]);
    assert.deepEqual([...stage.room.getWorldTransform().data], [...roomTransform.data]);
    assert.deepEqual([...light.getWorldTransform().data], [...lightTransform.data]);
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
