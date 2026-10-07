import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { ShaderDefinitionUtils } from '../node_modules/playcanvas/build/playcanvas/src/platform/graphics/shader-definition-utils.js';
import { createCoastScene } from '../src/scene';

function coast() {
  const canvas = { id: 'coast-test', width: 1280, height: 720, addEventListener() {}, removeEventListener() {}, getBoundingClientRect() { return {left: 0, top: 0, width: 1280, height: 720}; } } as any;
  const device = new pc.NullGraphicsDevice(canvas), app = new pc.AppBase(canvas);
  const options = new pc.AppOptions();
  options.graphicsDevice = device;
  options.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
  options.devtools = false; app.init(options);
  return {app, world: createCoastScene(app as pc.Application)};
}

// Inspect the actual PlayCanvas-generated GLSL defaults at each declaration.
// This is a cross-stage interface check, not a GPU compile/render substitute.
function floatInterface(source: string) {
  const declarations = new Map<string, string>();
  let precision = 'highp';
  const tokens = /precision\s+(highp|mediump|lowp)\s+float\s*;|\b(uniform|varying)\s+(?:(highp|mediump|lowp)\s+)?(float|vec[234]|mat[234])\s+(\w+)\s*;/g;
  for (const match of source.matchAll(tokens)) {
    if (match[1]) precision = match[1];
    else declarations.set(`${match[2]} ${match[5]}`, `${match[3] || precision} ${match[4]}`);
  }
  return declarations;
}

test('coast custom shaders preserve matching cross-stage float precision after PlayCanvas generation', () => {
  const {app, world} = coast();
  try {
    const sky = world.root.findByName('Gradient sky') as pc.Entity;
    for (const material of [world.oceanMaterial, sky.render!.meshInstances[0].material as pc.ShaderMaterial]) {
      for (const precision of ['highp', 'mediump']) {
        const desc = material.shaderDesc;
        const definition = ShaderDefinitionUtils.createDefinition({precision, maxPrecision: precision, capsDefines: new Map(), maxColorAttachments: 1, isWebGPU: false} as any, {name: desc.uniqueName, vertexCode: desc.vertexGLSL, fragmentCode: desc.fragmentGLSL}) as {vshader: string; fshader: string};
        const vertex = floatInterface(definition.vshader), fragment = floatInterface(definition.fshader);
        if (material === world.oceanMaterial) {
          assert.equal(vertex.get('uniform time'), `${precision} float`);
          assert.equal(fragment.get('uniform time'), `${precision} float`);
        }
        for (const [name, type] of fragment) if (name.startsWith('uniform ') && vertex.has(name)) {
          assert.equal(type, vertex.get(name), `${desc.uniqueName}: ${name} must have matching precision in both stages (${precision} device)`);
        }
      }
    }
    assert.equal((world.oceanMaterial.getParameter('time') as {data: number}).data, 0);
    world.oceanMaterial.setParameter('time', 2.5);
    assert.equal((world.oceanMaterial.getParameter('time') as {data: number}).data, 2.5);
  } finally { app.destroy(); }
});

test('native ocean geometry stays horizontal, upward-facing, opaque and within camera range', () => {
  const {app, world} = coast();
  try {
    const ocean = world.root.findByName('Animated ocean') as pc.Entity;
    assert.ok(ocean.enabled && ocean.render!.enabled);
    const instance = ocean.render!.meshInstances[0];
    const positions: number[] = [], indices: number[] = [];
    instance.mesh.getPositions(positions); instance.mesh.getIndices(indices);
    assert.equal(positions.length / 3, 131 * 131);
    assert.equal(indices.length, 130 * 130 * 6);
    const transform = ocean.getWorldTransform();
    const p = (index: number) => transform.transformPoint(new pc.Vec3(...positions.slice(index * 3, index * 3 + 3)));
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < positions.length / 3; i++) {
      const point = p(i);
      assert.ok(Math.abs(point.y + 1.8) < 1e-6);
      minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
      minZ = Math.min(minZ, point.z); maxZ = Math.max(maxZ, point.z);
    }
    assert.deepEqual([minX, maxX, minZ, maxZ], [-1050, 1050, -1050, 1050]);
    for (let i = 0; i < indices.length; i += 3) {
      const a = p(indices[i]), b = p(indices[i + 1]), c = p(indices[i + 2]);
      assert.ok(new pc.Vec3().cross(b.sub(a), c.sub(a)).y > 0);
    }
    assert.equal(instance.material, world.oceanMaterial);
    assert.equal(instance.material.cull, pc.CULLFACE_NONE);
    assert.equal(instance.material.blendType, pc.BLEND_NONE);
    assert.equal(instance.material.depthWrite, true);
    assert.match(world.oceanMaterial.shaderDesc.fragmentGLSL!, /gl_FragColor=vec4\(col,1\.\)/);
    assert.ok(world.camera.getPosition().y > -1.8 + .18 + .13);
    assert.ok(world.camera.camera!.farClip > 1100);
    assert.ok(world.camera.camera!.nearClip < 1);
    // Water immediately outside the island is inside the initialized camera frustum.
    world.camera.camera!.camera.updateFrustum();
    assert.ok(world.camera.camera!.camera.frustum.containsPoint(new pc.Vec3(0, -1.8, -155)));
  } finally { app.destroy(); }
});
