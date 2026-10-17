import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {createMenuWorld} from '../src/menu-backdrop';
import {DEFAULT_SETTINGS} from '../src/game-settings';

function application(id: string) {
  const canvas = {id, width: 1280, height: 720, addEventListener() {}, removeEventListener() {}} as unknown as HTMLCanvasElement;
  const app = new pc.AppBase(canvas), options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem, pc.ScriptComponentSystem];
  options.devtools = false;
  app.init(options);
  return app as pc.Application;
}

// Engine tick normally resets the global application. The title's independent,
// capped RAF loops intentionally bypass tick, so construction order must not
// decide which canvas receives a scene's components and GPU resources.
test('menu worlds retain their owner beside a newer portrait app, after its disposal, and on reentry', () => {
  const backdrop = application('ownership-backdrop');
  let portrait: pc.Application | undefined;
  const backdropLayers = backdrop.scene.layers.layerList.length;
  const backdropTextures = backdrop.graphicsDevice.textures.size;
  const backdropBuffers = backdrop.graphicsDevice.buffers.size;
  try {
    for (const phase of ['portrait live', 'portrait disposed', 'portrait reentered']) {
      if (phase === 'portrait disposed') {
        portrait!.destroy(); portrait = undefined;
        assert.equal(pc.AppBase.getApplication(), null);
      } else {
        portrait = application(`ownership-${phase}`);
        const camera = new pc.Entity('Portrait camera', portrait);
        camera.addComponent('camera'); portrait.root.addChild(camera);
        assert.ok(pc.AppBase.getApplication() === portrait);
      }
      for (const map of ['waterpark', 'coast'] as const) {
        const world = createMenuWorld(backdrop, map, {...DEFAULT_SETTINGS, quality: 'high'});
        try {
          world.update(5, 16 / 9);
          assert.ok(world.camera.camera!.system.app === backdrop, `${phase}: ${map} camera owner`);
          for (const type of ['render', 'camera', 'light', 'script']) {
            for (const component of backdrop.root.findComponents(type)) {
              assert.ok(component.system.app === backdrop, `${phase}: ${component.entity.name} ${type} owner`);
            }
          }
          const renders = backdrop.root.findComponents('render') as pc.RenderComponent[];
          assert.ok(renders.length > 0);
          for (const render of renders) for (const instance of render.meshInstances) {
            assert.ok(instance.mesh.device === backdrop.graphicsDevice, `${render.entity.name} mesh device`);
          }
          assert.ok(backdrop.scene.layers.getLayerById(pc.LAYERID_WORLD)!.meshInstances.length > 0);
          if (portrait) {
            for (const layer of portrait.scene.layers.layerList) {
              assert.equal(layer.meshInstances.length, 0, `${phase}: ${map} must not enter portrait layers`);
            }
            assert.equal(portrait.root.findComponents('camera').length, 1);
          }
        } finally { world.destroy(); }
        assert.equal(backdrop.root.children.length, 0, `${phase}: no orphan scene entities`);
        assert.equal(backdrop.scene.layers.layerList.length, backdropLayers);
        assert.equal(backdrop.graphicsDevice.textures.size, backdropTextures);
        assert.equal(backdrop.graphicsDevice.buffers.size, backdropBuffers);
      }
    }
  } finally { backdrop.destroy(); portrait?.destroy(); }
});
