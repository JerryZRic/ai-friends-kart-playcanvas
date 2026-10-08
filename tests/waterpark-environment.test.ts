import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {createWaterparkDesign} from '../src/waterpark-design';
import {createWaterparkEnvironmentDetails, WATERPARK_DETAIL_BUDGET} from '../src/waterpark-environment';
import {createWaterparkMaterials, waterparkSurfaceFor, waterparkSurfaceUvs, waterparkSkyPixels, WATERPARK_SURFACES, WATERPARK_ENVIRONMENT_SIZE} from '../src/waterpark-materials';
import {createWaterparkScene} from '../src/waterpark-scene';
import {CameraShaderParams} from '../node_modules/playcanvas/build/playcanvas/src/scene/camera-shader-params.js';

function createApp() {
  const canvas = {id: 'environment-test', width: 1280, height: 720, addEventListener() {}, removeEventListener() {}, getBoundingClientRect() {return {left: 0, top: 0, width: 1280, height: 720};}} as any;
  const app = new pc.AppBase(canvas), options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
  options.devtools = false; app.init(options); return app;
}

test('environment additions are deterministic, finite, depth-layered and kept in ten merged batches', () => {
  const details = createWaterparkEnvironmentDetails();
  assert.deepEqual(details, createWaterparkEnvironmentDetails());
  assert.ok(details.length <= WATERPARK_DETAIL_BUDGET.batches);
  assert.deepEqual(new Set(details.map(mesh => mesh.depthBand)), new Set(['near', 'middle', 'far']));
  const triangles = details.reduce((sum, mesh) => sum + mesh.indices.length / 3, 0);
  assert.ok(triangles <= WATERPARK_DETAIL_BUDGET.triangles, `${triangles} exceeds detail budget`);
  for (const mesh of details) {
    assert.equal(mesh.positions.length % 3, 0); assert.equal(mesh.indices.length % 3, 0);
    assert.ok(mesh.positions.every(Number.isFinite));
    assert.ok(mesh.indices.every(index => Number.isInteger(index) && index >= 0 && index < mesh.positions.length / 3));
    const normals = pc.calculateNormals(mesh.positions, mesh.indices), uv = waterparkSurfaceUvs(mesh.positions, normals);
    assert.equal(uv.length, mesh.positions.length / 3 * 2); assert.ok(uv.every(Number.isFinite));
    assert.equal(mesh.water, undefined, 'details never alter the water mesh or driving channel');
  }
});

test('fabric, rough stone, glazed tile, metal and backed glass use distinct physical response', () => {
  const app = createApp(), surfaces = createWaterparkMaterials(app.graphicsDevice);
  try {
    assert.equal(surfaces.environment.width, WATERPARK_ENVIRONMENT_SIZE);
    assert.equal(surfaces.environment.height, WATERPARK_ENVIRONMENT_SIZE);
    assert.equal(surfaces.textures.size, 3);
    const materials = Object.fromEntries(Object.keys(WATERPARK_SURFACES).map(surface => [surface, surfaces.get(surface, '#94b7cc', surface as keyof typeof WATERPARK_SURFACES)]));
    assert.ok(materials.stone.gloss < materials.paint.gloss);
    assert.ok(materials.wetStone.gloss > materials.stone.gloss);
    assert.ok(materials.wetStone.clearCoat > materials.stone.clearCoat);
    assert.ok(materials.paint.gloss < materials.tile.gloss);
    assert.ok(materials.tile.gloss < materials.glass.gloss);
    assert.ok(materials.fabric.gloss < .1);
    assert.ok(materials.metal.metalness > .8);
    assert.equal(materials.glass.metalness, 0);
    assert.equal(materials.glass.blendType, pc.BLEND_NONE);
    assert.equal(materials.glass.depthWrite, true);
    assert.ok(materials.tile.clearCoat > materials.stone.clearCoat);
    assert.equal(materials.metal.envAtlas, surfaces.environment);
    assert.equal(materials.glass.envAtlas, surfaces.environment);
    assert.equal(materials.stone.envAtlas, surfaces.environment);
    assert.ok(materials.stone.normalMap && materials.tile.normalMap);
    assert.equal(surfaces.get('duplicate name', '#94b7cc', 'stone'), materials.stone);
    for (const mat of Object.values(materials)) assert.equal(mat.useMetalness, true);
  } finally {surfaces.destroy(); surfaces.destroy(); app.destroy();}
});

test('parasol cloth is separated from coated railings and enamel roofs without changing water geometry', () => {
  const design = createWaterparkDesign();
  for (const name of ['Rose woven parasol panels', 'Ivory woven parasol stripes']) {
    const mesh = design.find(m => m.name === name)!;
    assert.ok(mesh?.indices.length); assert.equal(waterparkSurfaceFor(name), 'fabric');
  }
  assert.equal(waterparkSurfaceFor('Layered turquoise retaining walls'), 'tile');
  assert.equal(waterparkSurfaceFor('Tower window blue glass'), 'glass');
  assert.equal(waterparkSurfaceFor('Ivory coping and bridge stone'), 'stone');
  assert.equal(waterparkSurfaceFor('Pearl railings and canopy stripes'), 'paint');
  assert.equal(design.filter(mesh => mesh.water).length, 1);
});

test('authored lighting texture is deterministic, small and has a brighter horizon than ground', () => {
  const sky = waterparkSkyPixels(); assert.deepEqual(sky, waterparkSkyPixels()); assert.equal(sky.length, 128 * 64 * 4);
  assert.ok(sky.every((value, i) => i % 4 !== 3 || value === 255));
  const brightness = (y: number) => sky.slice(y * 128 * 4, (y + 1) * 128 * 4).reduce((sum, v, i) => sum + (i % 4 === 3 ? 0 : v), 0);
  assert.ok(brightness(29) > brightness(60));
});

test('full scenery shares material resources, participates in reflections, and disposes on repeated exit', () => {
  const app = createApp();
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const world = createWaterparkScene(app as pc.Application);
      assert.ok(world.triangles < 70000);
      assert.ok(world.surfaces.materials.size <= 27);
      assert.equal(app.scene.fog.type, pc.FOG_LINEAR);
      for (const name of ['Middle timber bench slats', 'Far blue resort glazing', 'Near brushed drainage and pool ladders']) {
        const entity = world.root.findByName(name) as pc.Entity;
        const instance = entity.render!.meshInstances[0];
        assert.equal((instance.material as pc.StandardMaterial).envAtlas, world.surfaces.environment);
        assert.ok(world.reflection.layer.meshInstances.includes(instance));
      }
      const sky = world.root.findByName('Waterpark blue gradient sky') as pc.Entity;
      assert.match((sky.render!.meshInstances[0].material as pc.ShaderMaterial).shaderDesc.fragmentGLSL!, /gammaCorrectOutput\(pow\(palette/);
      let disposed = 0;
      const atlas = world.surfaces.environment, destroy = atlas.destroy.bind(atlas);
      atlas.destroy = () => {disposed++; destroy();};
      world.root.destroy(); world.reflection.destroy(); world.surfaces.destroy();
      assert.equal(disposed, 1);
      assert.equal(app.scene.layers.getLayerByName('Waterpark reflected static scenery'), null);
      assert.equal(app.root.findByName('Waterpark reflection resources'), null);
    }
  } finally {app.destroy();}
});

// This uses PlayCanvas's real material variant/preprocessor, not a string-only
// include check. NullGraphicsDevice does not perform driver/GPU compilation.
test('sky material resolves engine gamma chunk for main and sRGB reflection targets', () => {
  const app = createApp();
  try {
    const world = createWaterparkScene(app as pc.Application);
    const sky = world.root.findByName('Waterpark blue gradient sky') as pc.Entity;
    const instance = sky.render!.meshInstances[0], material = instance.material as pc.ShaderMaterial;
    for (const srgbRenderTarget of [false, true]) {
      const cameraShaderParams = new CameraShaderParams();
      cameraShaderParams.gammaCorrection = pc.GAMMA_SRGB;
      cameraShaderParams.srgbRenderTarget = srgbRenderTarget;
      const shader = material.getShaderVariant({device: app.graphicsDevice, scene: app.scene, objDefs: 0, cameraShaderParams, pass: pc.SHADER_FORWARD, lightList: [], vertexFormat: instance.mesh.vertexBuffer.format} as any);
      assert.equal(shader.failed, false);
      const fragment = shader.definition.fshader!;
      assert.doesNotMatch(fragment, /#include/);
      assert.match(fragment, /gammaCorrectOutput/);
      assert.match(fragment, /pow\(palette,vec3\(2\.2\)\)/);
      if (srgbRenderTarget) {
        assert.match(fragment, /vec3 gammaCorrectOutput\(vec3 color\)\s*\{\s*return color;/);
        assert.match(fragment, /#define GAMMA NONE/);
      } else {
        assert.match(fragment, /vec3 gammaCorrectOutput\(vec3 color\)\s*\{\s*return pow/);
        assert.match(fragment, /#define GAMMA SRGB/);
      }
    }
  } finally {app.destroy();}
});
