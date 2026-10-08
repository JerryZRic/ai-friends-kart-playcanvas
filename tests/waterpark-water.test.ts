import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { ShaderDefinitionUtils } from '../node_modules/playcanvas/build/playcanvas/src/platform/graphics/shader-definition-utils.js';
import { createWaterparkWaterMaterial, WATERPARK_WATER_VERTEX_SHADER, WATERPARK_WATER_FRAGMENT_SHADER } from '../src/waterpark-water';

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

test('waterpark shader lets PlayCanvas inject consistent precision for shared interfaces', () => {
  assert.doesNotMatch(WATERPARK_WATER_VERTEX_SHADER, /precision\s+(?:highp|mediump|lowp)/);
  assert.doesNotMatch(WATERPARK_WATER_FRAGMENT_SHADER, /precision\s+(?:highp|mediump|lowp)/);
  for (const precision of ['highp', 'mediump']) {
    const definition = ShaderDefinitionUtils.createDefinition({precision, maxPrecision: precision, capsDefines: new Map(), maxColorAttachments: 1, isWebGPU: false} as any, {
      name: 'waterpark-water-test', vertexCode: WATERPARK_WATER_VERTEX_SHADER, fragmentCode: WATERPARK_WATER_FRAGMENT_SHADER,
    }) as {vshader: string; fshader: string};
    const vertex = floatInterface(definition.vshader), fragment = floatInterface(definition.fshader);
    assert.equal(vertex.get('uniform time'), `${precision} float`);
    assert.equal(fragment.get('uniform time'), `${precision} float`);
    for (const [name, type] of fragment) {
      if (name.startsWith('varying ') || vertex.has(name)) assert.equal(type, vertex.get(name), `${name} matches on ${precision}`);
    }
  }
});

test('waterpark material is isolated, opaque and exposes explicit animation and bridge controls', () => {
  const material = createWaterparkWaterMaterial(null as unknown as pc.Application);
  const other = createWaterparkWaterMaterial(null as unknown as pc.Application);
  try {
    assert.notEqual(material, other);
    assert.equal(material.shaderDesc.vertexGLSL, WATERPARK_WATER_VERTEX_SHADER);
    assert.equal(material.shaderDesc.fragmentGLSL, WATERPARK_WATER_FRAGMENT_SHADER);
    assert.equal(material.shaderDesc.attributes!.aUv0, pc.SEMANTIC_TEXCOORD0);
    assert.equal(material.blendType, pc.BLEND_NONE);
    assert.equal(material.depthWrite, true);
    assert.equal(material.cull, pc.CULLFACE_NONE);
    assert.equal((material.getParameter('time') as {data: number}).data, 0);
    assert.equal((material.getParameter('waterHalfWidth') as {data: number}).data, 12);
    assert.deepEqual((material.getParameter('bridgeShadow') as {data: number[]}).data, [0, 0, 0, 1.5]);
    material.setParameter('time', 8.2);
    material.setParameter('bridgeShadow', [100, 4, 0.7, 1.5]);
    assert.equal((material.getParameter('time') as {data: number}).data, 8.2);
    assert.equal((other.getParameter('time') as {data: number}).data, 0);
    assert.match(WATERPARK_WATER_FRAGMENT_SHADER, /gl_FragColor = vec4\(water, 1\.0\)/);
  } finally { material.destroy(); other.destroy(); }
});

test('native waterpark scene connects metre UVs, curved water geometry, bridge shade and chase cameras', async () => {
  const { createWaterparkScene } = await import('../src/waterpark-scene');
  const { sampleWaterpark } = await import('../src/waterpark-design');
  const canvas = {id: 'waterpark-test', width: 1280, height: 720, addEventListener() {}, removeEventListener() {}, getBoundingClientRect() { return {left: 0, top: 0, width: 1280, height: 720}; }} as any;
  const app = new pc.AppBase(canvas), options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
  options.devtools = false;
  app.init(options);
  try {
    const scene = createWaterparkScene(app as pc.Application);
    const entity = scene.root.findByName('Turquoise flowing canal') as pc.Entity;
    assert.ok(entity?.render?.enabled);
    const instance = entity.render!.meshInstances[0];
    assert.equal(instance.material, scene.waterMaterial);
    assert.equal(instance.castShadow, false);
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    instance.mesh.getPositions(positions); instance.mesh.getUvs(0, uvs); instance.mesh.getIndices(indices);
    assert.equal(uvs.length / 2, positions.length / 3);
    assert.ok(indices.length > 10000);
    let minLateral = Infinity, maxLateral = -Infinity;
    for (let vertex = 0; vertex < positions.length / 3; vertex++) {
      const lateral = uvs[vertex * 2], distance = uvs[vertex * 2 + 1];
      const expected = sampleWaterpark(distance, lateral).p;
      assert.ok(Math.abs(positions[vertex * 3] - expected.x) < 0.00005);
      assert.equal(positions[vertex * 3 + 1], 0);
      assert.ok(Math.abs(positions[vertex * 3 + 2] - expected.z) < 0.00005);
      minLateral = Math.min(minLateral, lateral); maxLateral = Math.max(maxLateral, lateral);
    }
    assert.deepEqual([minLateral, maxLateral], [-12, 12]);
    const point = (index: number) => new pc.Vec3(...positions.slice(index * 3, index * 3 + 3));
    for (let i = 0; i < indices.length; i += 3) {
      const a = point(indices[i]), b = point(indices[i + 1]), c = point(indices[i + 2]);
      assert.ok(new pc.Vec3().cross(b.sub(a), c.sub(a)).y > 0, 'water triangles face up');
    }
    const shadow = (scene.waterMaterial.getParameter('bridgeShadow') as {data: Float32Array}).data;
    assert.equal(shadow[0], 183); assert.equal(shadow[1], 3.5);
    assert.ok(Math.abs(shadow[2] - 0.6) < 1e-6); assert.equal(shadow[3], 2);
    for (const distance of [12, 92, 130, 183, 225, 285]) {
      scene.setCamera(distance);
      assert.ok(scene.camera.getPosition().y > 0.077);
      const ahead = sampleWaterpark(distance + 24).p;
      scene.camera.camera!.camera.updateFrustum();
      assert.ok(scene.camera.camera!.camera.frustum.containsPoint(ahead), `water ahead remains visible at ${distance} m`);
    }
  } finally { app.destroy(); }
});

test('refraction samples real color and oblique depth with high precision and rejects invalid contacts', () => {
  const shader = WATERPARK_WATER_FRAGMENT_SHADER;
  assert.match(shader, /uniform highp sampler2D waterRefractionDepthMap/);
  assert.match(shader, /texture2D\(waterRefractionMap, refractedUv\)/);
  assert.match(shader, /waterRefractionInverseViewProjection \* vec4\(uv \* 2\.0 - 1\.0, depth \* 2\.0 - 1\.0, 1\.0\)/);
  assert.match(shader, /waterRefractionViewProjection \* vec4\(vWaterWorld, 1\.0\)/);
  assert.match(shader, /if \(hit\.w < 0\.5 \|\| hit\.y > vWaterWorld\.y \+ 0\.015 \|\| rayDepth < 0\.0\)/);
  assert.match(shader, /refractedUv = undistortedUv/);
  assert.match(shader, /sampledShoreDepth/);
  assert.doesNotMatch(shader, /requestSceneDepthMap|camera_far|camera_near/);
});
