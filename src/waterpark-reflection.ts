import * as pc from 'playcanvas';
import { createWaterparkRefraction } from './waterpark-refraction';
import { PlanarRenderer } from 'playcanvas/scripts/esm/planar-renderer.mjs';

export const WATERPARK_REFLECTION_SCALE = 0.5;
export const WATERPARK_REFLECTION_MAX_DIMENSION = 768;

/** Match the official renderer's integer sizing while bounding both axes. */
export function getWaterparkReflectionSize(width: number, height: number, maxTextureSize = 4096) {
  if (![width, height, maxTextureSize].every(Number.isFinite) || width < 2 || height < 2 || maxTextureSize < 1) return null;
  const limit = Math.min(WATERPARK_REFLECTION_MAX_DIMENSION, Math.floor(maxTextureSize));
  const scale = Math.min(WATERPARK_REFLECTION_SCALE, limit / width, limit / height);
  const targetWidth = Math.floor(width * scale), targetHeight = Math.floor(height * scale);
  // Do not pass a zero-sized target to the renderer for a hidden/narrow canvas.
  return targetWidth && targetHeight ? { width: targetWidth, height: targetHeight, scale } : null;
}

/**
 * One scenery-only reflection plus optional underwater color/depth refraction.
 * Both use PlayCanvas's official planar camera/clipping implementation.
 * Call after static scenery is complete, then update() after the chase camera.
 * Water and wake live in a main-camera-only layer. New moving objects are not
 * added to the captured scenery, so the mount cannot reflect its own wake.
 *
 * Shader interface: waterReflectionMap is an sRGB texture sampled as LINEAR RGB;
 * waterReflectionAvailable is 0/1, waterReflectionTexelSize is vec2(1/w,1/h),
 * and uScreenSize is vec4(w,h,1/w,1/h). As in the official Water script, use
 * vec2(screenUV.x, 1.0-screenUV.y), where screenUV=gl_FragCoord.xy*uScreenSize.zw.
 * Convert the sample to display gamma before mixing into display-space water.
 * destroy() is for scene teardown; it releases both target and fallback texture.
 */
export function createWaterparkReflection(
  app: pc.AppBase,
  root: pc.Entity,
  camera: pc.Entity,
  waterMaterial: pc.Material,
  excludedEntities: readonly pc.Entity[] = [],
  options: { waterLevel?: number } = {},
) {
  if (!camera.camera) throw new Error('Waterpark reflection needs a main camera component.');
  // AppBase test/headless hosts need the same public system as pc.Application.
  if (!app.systems.script) app.systems.add(new pc.ScriptComponentSystem(app));

  const mainCamera = camera.camera, composition = app.scene.layers;
  const layer = new pc.Layer({ name: 'Waterpark reflected static scenery' });
  const waterLayer = new pc.Layer({ name: 'Waterpark water and wake' });
  const worldLayer = composition.getLayerById(pc.LAYERID_WORLD);
  if (worldLayer) {
    composition.insertOpaque(waterLayer, composition.getOpaqueIndex(worldLayer) + 1);
    composition.insertTransparent(waterLayer, composition.getTransparentIndex(worldLayer) + 1);
  } else {
    composition.push(waterLayer);
  }
  composition.push(layer);
  mainCamera.layers = [...mainCamera.layers, waterLayer.id];

  const resources = new pc.Entity('Waterpark reflection resources');
  app.root.addChild(resources);
  const reflectionCamera = new pc.Entity('Waterpark scenery reflection camera');
  reflectionCamera.addComponent('camera', {
    layers: [layer.id], priority: mainCamera.priority - 1,
    clearColor: mainCamera.clearColor.clone(),
    toneMapping: mainCamera.toneMapping, gammaCorrection: mainCamera.gammaCorrection,
    fog: mainCamera.fog,
  });
  resources.addChild(reflectionCamera);
  reflectionCamera.addComponent('script');
  const renderer = reflectionCamera.script!.create(PlanarRenderer, {
    properties: {
      sceneCameraEntity: camera, mode: 'reflection',
      planePoint: new pc.Vec3(0, options.waterLevel ?? 0, 0),
      planeNormal: new pc.Vec3(0, 1, 0),
      scale: WATERPARK_REFLECTION_SCALE, mipmaps: false, depth: true,
      obliqueClipping: true, clipBias: 0.15,
    },
  })!;

  const fallback = new pc.Texture(app.graphicsDevice, {
    name: 'Waterpark reflection fallback', width: 1, height: 1,
    format: pc.PIXELFORMAT_SRGBA8, mipmaps: false,
    minFilter: pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR,
    addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    levels: [new Uint8Array([142, 201, 220, 255])],
  });
  let destroyed = false;
  const displacedLayers = new Map<pc.RenderComponent, number[]>();
  const texelSize = new Float32Array([1, 1]);
  const screenSize = new Float32Array([1, 1, 1, 1]);
  waterMaterial.setParameter('waterReflectionMap', fallback);
  waterMaterial.setParameter('waterReflectionAvailable', 0);
  waterMaterial.setParameter('waterReflectionTexelSize', texelSize);
  waterMaterial.setParameter('uScreenSize', screenSize);

  function exclude(entity: pc.Entity) {
    if (destroyed) return;
    for (const render of entity.findComponents('render') as pc.RenderComponent[]) {
      layer.removeMeshInstances([...render.meshInstances], true);
      if (!displacedLayers.has(render)) displacedLayers.set(render, [...render.layers]);
      render.layers = [waterLayer.id];
    }
  }
  for (const entity of excludedEntities) exclude(entity);
  const staticRenders = root.findComponents('render') as pc.RenderComponent[];
  // The material check is a second guard against render-target feedback.
  for (const render of staticRenders) {
    if (render.meshInstances.some(instance => instance.material === waterMaterial)) exclude(render.entity);
  }
  for (const render of staticRenders) {
    if (render.enabled && render.entity.enabled && !displacedLayers.has(render) &&
        render.layers.some(id => mainCamera.layers.includes(id))) {
      layer.addMeshInstances([...render.meshInstances], true);
    }
  }

  // A reflection-only copy keeps the authored direct lighting without triggering
  // another directional shadow atlas/cascade pass for the reflected viewpoint.
  const reflectionLights: pc.Entity[] = [];
  const mainOnlyLights: pc.LightComponent[] = [];
  for (const light of root.findComponents('light') as pc.LightComponent[]) {
    if (!light.enabled || !light.entity.enabled || !light.layers.some(id => mainCamera.layers.includes(id))) continue;
    // Excluding a rider from the capture must not exclude it from sunlight.
    // The main-only layer needs the original light (and its existing shadows),
    // while the reflection keeps its separate shadow-free copy.
    if (!light.layers.includes(waterLayer.id)) {
      light.layers = [...light.layers, waterLayer.id];
      mainOnlyLights.push(light);
    }
    const copy = new pc.Entity(`${light.entity.name} (reflection, no shadows)`);
    copy.addComponent('light', {
      type: light.type, color: light.color.clone(), intensity: light.intensity,
      luminance: light.luminance, range: light.range,
      innerConeAngle: light.innerConeAngle, outerConeAngle: light.outerConeAngle,
      castShadows: false, layers: [layer.id], mask: light.mask,
    });
    resources.addChild(copy);
    copy.setPosition(light.entity.getPosition());
    copy.setRotation(light.entity.getRotation());
    reflectionLights.push(copy);
  }

  const refraction = createWaterparkRefraction(app, root, camera, waterMaterial, layer, fallback, options.waterLevel ?? 0);

  function update() {
    if (destroyed) return null;
    const width = mainCamera.renderTarget?.width ?? app.graphicsDevice.width;
    const height = mainCamera.renderTarget?.height ?? app.graphicsDevice.height;
    const size = getWaterparkReflectionSize(width, height, app.graphicsDevice.maxTextureSize);
    const safeWidth = Number.isFinite(width) && width > 0 ? width : 1;
    const safeHeight = Number.isFinite(height) && height > 0 ? height : 1;
    screenSize.set([safeWidth, safeHeight, 1 / safeWidth, 1 / safeHeight]);
    waterMaterial.setParameter('uScreenSize', screenSize);
    const enabled = !!size && root.enabled && camera.enabled && mainCamera.enabled;
    reflectionCamera.camera!.enabled = enabled;
    refraction.update(enabled ? size : null);
    if (!enabled || !size) {
      waterMaterial.setParameter('waterReflectionMap', fallback);
      waterMaterial.setParameter('waterReflectionAvailable', 0);
      texelSize.set([1, 1]);
      waterMaterial.setParameter('waterReflectionTexelSize', texelSize);
      return null;
    }
    renderer.scale = size.scale;
    reflectionCamera.camera!.priority = mainCamera.priority - 1;
    reflectionCamera.camera!.toneMapping = mainCamera.toneMapping;
    reflectionCamera.camera!.gammaCorrection = mainCamera.gammaCorrection;
    reflectionCamera.camera!.clearColor.copy(mainCamera.clearColor);
    const texture = renderer.frameUpdate() as pc.Texture | null;
    waterMaterial.setParameter('waterReflectionMap', texture ?? fallback);
    waterMaterial.setParameter('waterReflectionAvailable', texture ? 1 : 0);
    texelSize.set(texture ? [1 / texture.width, 1 / texture.height] : [1, 1]);
    waterMaterial.setParameter('waterReflectionTexelSize', texelSize);
    return texture;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    app.off('destroy', destroy);
    root.off('destroy', destroy);
    // Destroy the script while its camera still exists: Entity.destroy removes
    // the camera component first, hiding the target from the official cleanup.
    refraction.destroy();
    reflectionCamera.script?.destroy(PlanarRenderer);
    resources.destroy();
    for (const light of mainOnlyLights) {
      if (light.entity.light === light) light.layers = light.layers.filter(id => id !== waterLayer.id);
    }
    mainOnlyLights.length = 0;
    for (const [render, previous] of displacedLayers) {
      if (render.entity.render === render) render.layers = previous;
    }
    displacedLayers.clear();
    if (camera.camera === mainCamera) mainCamera.layers = mainCamera.layers.filter(id => id !== waterLayer.id);
    layer.clearMeshInstances();
    composition.remove(layer);
    composition.remove(waterLayer);
    waterMaterial.setParameter('waterReflectionAvailable', 0);
    waterMaterial.deleteParameter('waterReflectionMap');
    fallback.destroy();
  }

  app.on('destroy', destroy);
  root.on('destroy', destroy);
  update();
  return { camera: reflectionCamera, layer, waterLayer, renderer, reflectionLights, refraction, update, exclude, destroy,
    setRefractionEnabled(value: boolean) { refraction.setEnabled(value); update(); },
    getSettings() { const target = reflectionCamera.camera?.enabled ? reflectionCamera.camera.renderTarget : null;
      return {...refraction.getSettings(), reflectionActive: !!target,
        reflectionTarget: target ? {width: target.width, height: target.height} : null,
        scale: WATERPARK_REFLECTION_SCALE, maxDimension: WATERPARK_REFLECTION_MAX_DIMENSION,
        refractionDepth: 'sampled-oblique-depth', capture: 'static-scenery'};
    },
  };
}
