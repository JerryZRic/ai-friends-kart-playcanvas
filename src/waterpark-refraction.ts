import * as pc from 'playcanvas';
import { PlanarRenderer } from 'playcanvas/scripts/esm/planar-renderer.mjs';

/** The official camera/clipping implementation, with an explicitly sampleable,
 * nearest-filtered depth attachment. Its oblique depth must be unprojected with
 * that exact projection, never the main camera's near/far linear-depth formula. */
export class WaterparkRefractionRenderer extends PlanarRenderer {
  static scriptName = 'waterparkRefractionRenderer';
  depthTexture: pc.Texture | null = null;
  override _destroyRenderTarget() {
    super._destroyRenderTarget();
    this.depthTexture?.destroy();
    this.depthTexture = null;
  }
  override updateRenderTarget() {
    super.updateRenderTarget();
    const camera = this.entity.camera!, target = camera.renderTarget!;
    if (target.depthBuffer === this.depthTexture && this.depthTexture) return;
    // super destroys the prior depth texture through our override on resize.
    this.depthTexture = new pc.Texture(this.app.graphicsDevice, {
      name: 'Waterpark sampled refraction depth', width: target.width, height: target.height,
      format: pc.PIXELFORMAT_DEPTH, mipmaps: false,
      minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      compareOnRead: false,
    });
    const color = target.colorBuffer!;
    target.destroy(); // Framebuffer only; preserve the official color texture.
    camera.renderTarget = new pc.RenderTarget({colorBuffer: color, depthBuffer: this.depthTexture, samples: 1});
  }
}

export function createWaterparkRefraction(app: pc.AppBase, root: pc.Entity, main: pc.Entity,
  material: pc.Material, sceneryLayer: pc.Layer, fallback: pc.Texture, waterLevel: number) {
  const camera = new pc.Entity('Waterpark underwater refraction camera');
  camera.addComponent('camera', {layers: [sceneryLayer.id], priority: main.camera!.priority - 2,
    clearColor: new pc.Color(.03, .25, .3), clearDepthBuffer: true,
    toneMapping: main.camera!.toneMapping, gammaCorrection: main.camera!.gammaCorrection, fog: main.camera!.fog});
  app.root.addChild(camera);
  camera.addComponent('script');
  const renderer = camera.script!.create(WaterparkRefractionRenderer, {properties: {
    sceneCameraEntity: main, mode: 'refraction', planePoint: new pc.Vec3(0, waterLevel, 0),
    planeNormal: new pc.Vec3(0, 1, 0), scale: .5, mipmaps: false, depth: true,
    obliqueClipping: true, clipBias: .15,
  }})!;
  const inverse = new pc.Mat4(), projection = new pc.Mat4(), view = new pc.Mat4(), viewProjection = new pc.Mat4();
  const texel = new Float32Array([1, 1]);
  let requested = true, active = false, destroyed = false;
  function reset() {
    active = false;
    material.setParameter('waterRefractionAvailable', 0);
    material.setParameter('waterRefractionMap', fallback);
    // A color sampler is a legal fallback for the depth sampler while disabled.
    material.setParameter('waterRefractionDepthMap', fallback);
    material.setParameter('waterRefractionInverseViewProjection', inverse.data);
    material.setParameter('waterRefractionViewProjection', viewProjection.data);
    material.setParameter('waterRefractionTexelSize', texel);
  }
  reset();
  function update(size: {scale: number} | null) {
    if (destroyed) return;
    const enabled = requested && !!size && root.enabled && main.enabled && !!main.camera?.enabled && main.getPosition().y > waterLevel + .16;
    camera.camera!.enabled = enabled;
    if (!enabled || !size) { reset(); return; }
    renderer.scale = size.scale;
    camera.camera!.priority = main.camera!.priority - 2;
    camera.camera!.toneMapping = main.camera!.toneMapping;
    camera.camera!.gammaCorrection = main.camera!.gammaCorrection;
    const color = renderer.frameUpdate();
    if (!color || !renderer.depthTexture) { reset(); return; }
    camera.camera!.calculateProjection!(projection, pc.VIEW_CENTER);
    view.invert(camera.getWorldTransform());
    viewProjection.mul2(projection, view); inverse.invert(viewProjection);
    texel.set([1 / color.width, 1 / color.height]);
    material.setParameter('waterRefractionMap', color);
    material.setParameter('waterRefractionDepthMap', renderer.depthTexture);
    material.setParameter('waterRefractionInverseViewProjection', inverse.data);
    material.setParameter('waterRefractionViewProjection', viewProjection.data);
    material.setParameter('waterRefractionTexelSize', texel);
    material.setParameter('waterRefractionAvailable', 1);
    active = true;
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true; active = false;
    camera.script?.destroy(WaterparkRefractionRenderer);
    camera.destroy();
    material.setParameter('waterRefractionAvailable', 0);
    material.deleteParameter('waterRefractionMap'); material.deleteParameter('waterRefractionDepthMap');
  }
  return {camera, renderer, update, destroy,
    setEnabled(value: boolean) { requested = !!value; },
    getSettings() {return {requestedRefraction: requested, refractionActive: active,
      refractionTarget: active && camera.camera?.renderTarget ? {width: camera.camera.renderTarget.width, height: camera.camera.renderTarget.height} : null};},
  };
}
