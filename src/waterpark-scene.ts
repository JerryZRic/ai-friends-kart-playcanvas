import * as pc from 'playcanvas';
import {createWaterparkDesign, sampleCamera, waterparkLayout, waterparkBridgeDistance, type WaterparkGeometryOptions} from './waterpark-design';
import {createWaterparkWaterMaterial} from './waterpark-water';
import {createWaterparkEnvironmentDetails, type EnvironmentMesh} from './waterpark-environment';
import {createWaterparkMaterials, waterparkSurfaceUvs} from './waterpark-materials';
import {createWaterparkBedDesign, createWaterparkBedMaterials} from './waterpark-bed';
import {createWaterparkReflection} from './waterpark-reflection';

export function createWaterparkScene(app: pc.Application, options: WaterparkGeometryOptions = {}) {
  const {sample, closed} = waterparkLayout(options);
  const root = new pc.Entity(closed ? 'Waterpark closed-loop race' : 'Waterpark art sample'); app.root.addChild(root);
  app.scene.ambientLight = new pc.Color(.55, .7, .82); app.scene.exposure = 1;
  app.scene.fog.type = pc.FOG_LINEAR; app.scene.fog.color = new pc.Color(.66, .85, .94);
  app.scene.fog.start = 110; app.scene.fog.end = 460;
  const surfaces = createWaterparkMaterials(app.graphicsDevice);
  const bedMaterials = createWaterparkBedMaterials(app.graphicsDevice, surfaces.environment);
  const waterMaterial = createWaterparkWaterMaterial(app);
  waterMaterial.setParameter('bridgeShadow', new Float32Array([waterparkBridgeDistance(options), 3.5, .6, 2]));
  const meshes: pc.Mesh[] = [];
  let triangles = 0;
  for (const data of [...createWaterparkDesign(options), ...createWaterparkEnvironmentDetails(options), ...createWaterparkBedDesign(options)]) {
    const mesh = new pc.Mesh(app.graphicsDevice), normals = pc.calculateNormals(data.positions, data.indices);
    mesh.setPositions(data.positions); mesh.setNormals(normals); mesh.setIndices(data.indices);
    mesh.setUvs(0, data.water || ('submerged' in data && data.submerged) ? data.uvs : waterparkSurfaceUvs(data.positions, normals)); mesh.update(pc.PRIMITIVE_TRIANGLES);
    meshes.push(mesh);
    const material = data.water ? waterMaterial : ('submerged' in data && data.submerged) ? bedMaterials.get(data.name) : surfaces.get(data.name, data.color, (data as Partial<EnvironmentMesh>).surface);
    const entity = new pc.Entity(data.name);
    entity.addComponent('render', {meshInstances: [new pc.MeshInstance(mesh, material)], castShadows: !data.water && !/cloud|joints|drainage recesses|Far /i.test(data.name), receiveShadows: !/cloud/i.test(data.name)});
    root.addChild(entity); triangles += data.indices.length / 3;
  }
  const sun = new pc.Entity('Waterpark afternoon sun');
  sun.addComponent('light', {type: 'directional', color: new pc.Color(1, .94, .83), intensity: 2, castShadows: true, shadowDistance: 130, shadowResolution: 2048, shadowBias: .1, normalOffsetBias: .06, numCascades: 2});
  sun.setEulerAngles(47, -35, 0); root.addChild(sun);
  const camera = new pc.Entity('Waterpark low chase composition');
  camera.addComponent('camera', {fov: 56, nearClip: .1, farClip: 1200, clearColor: new pc.Color(.18, .59, .91), toneMapping: pc.TONEMAP_ACES, gammaCorrection: pc.GAMMA_SRGB}); root.addChild(camera);
  const skyMaterial = new pc.ShaderMaterial({uniqueName: 'waterpark-gradient-sky', attributes: {aPosition: pc.SEMANTIC_POSITION},
    vertexGLSL: 'attribute vec3 aPosition; uniform mat4 matrix_model; uniform mat4 matrix_viewProjection; varying vec3 skyPosition; void main(){skyPosition=aPosition;gl_Position=matrix_viewProjection*matrix_model*vec4(aPosition,1.);}',
    fragmentGLSL: '#include "gammaPS"\nvarying vec3 skyPosition; void main(){float t=smoothstep(-.08,.65,normalize(skyPosition).y);vec3 palette=mix(vec3(.65,.89,.98),vec3(.065,.34,.77),t);gl_FragColor=vec4(gammaCorrectOutput(pow(palette,vec3(2.2))),1.);}',
  });
  skyMaterial.cull = pc.CULLFACE_FRONT; skyMaterial.depthWrite = false;
  const sky = new pc.Entity('Waterpark blue gradient sky');
  const skyMesh = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.SphereGeometry({radius: 700, latitudeBands: 12, longitudeBands: 24})); meshes.push(skyMesh);
  sky.addComponent('render', {meshInstances: [new pc.MeshInstance(skyMesh, skyMaterial)], castShadows: false, receiveShadows: false}); root.addChild(sky);
  function setCamera(distance: number) {
    if (closed || options.sampler) {
      const s = sample(distance), ahead = sample(distance + 24);
      camera.setPosition(s.p.x - s.t.x * 7.8, 3.7, s.p.z - s.t.z * 7.8); camera.lookAt(ahead.p.x, 2.1, ahead.p.z);
    } else {
      const c = sampleCamera(distance); camera.setPosition(...c.position as [number, number, number]); camera.lookAt(...c.target as [number, number, number]);
    }
  }
  setCamera(12);
  const reflection = createWaterparkReflection(app, root, camera, waterMaterial);
  // Runtime materials/textures are not asset registry resources. Release them
  // with this root on exit/retry, including the one-time prefiltered sky atlas.
  root.once('destroy', () => {reflection.destroy(); bedMaterials.destroy(); surfaces.destroy(); waterMaterial.destroy(); skyMaterial.destroy(); for (const mesh of meshes) mesh.destroy();});
  return {root, camera, waterMaterial, triangles, setCamera, surfaces, reflection};
}
