import * as pc from 'playcanvas';
import {kartAssemblyCamera} from './kart-assembly';

/** Opaque room rendering avoids browser-dependent transparent-canvas compositing. */
export const GARAGE_CLEAR_COLOR = new pc.Color(.86, .89, .86, 1);

/** Native render-resolution sizing, independent of the canvas's previous dimensions. */
export function garageViewportSize(width: number, height: number, pixelRatio = 1, lowQuality = false) {
  const safe = (value: number) => Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1;
  const w = safe(width), h = safe(height);
  return {width: w, height: h, aspect: w / h, pixelRatio: Math.min(Math.max(1, Number.isFinite(pixelRatio) ? pixelRatio : 1), lowQuality ? 1 : 1.5)};
}

/** Camera azimuth stays fixed while the car turns. Vertical orbit and zoom remain available. */
export function garageStageCamera(bounds: pc.BoundingBox, aspect = 1, pitch = 22, zoom = 1) {
  const fittedZoom = 1 + (pc.math.clamp(Number.isFinite(zoom) ? zoom : 1, .72, 1.8) - .72) * .5;
  const view = kartAssemblyCamera(bounds, aspect, 36, pitch, fittedZoom);
  const unit = Math.max(.5, Math.hypot(bounds.halfExtents.x, bounds.halfExtents.z));
  return {...view, nearClip: .01, farClip: Math.max(view.farClip, view.position.distance(view.target) + unit * 40)};
}

/** World-space props and lights never inherit the vehicle's turntable rotation.
 * Only the assembly root is transformed; original module geometry/materials stay intact. */
export function createKartGarageStage(app: pc.AppBase) {
  const room = new pc.Entity('Garage room', app), turntable = new pc.Entity('Garage vehicle pivot', app);
  const carrier = new pc.Entity('Garage assembly offset', app);
  app.root.addChild(room); app.root.addChild(turntable); turntable.addChild(carrier);
  const materials: pc.StandardMaterial[] = [];
  const matte = (name: string, color: number[]) => {
    const material = new pc.StandardMaterial(); material.name = name;
    material.diffuse = new pc.Color(...color); material.gloss = .12; material.update(); materials.push(material); return material;
  };
  const floor = matte('Warm grey floor', [.70, .73, .70]);
  const wall = matte('Cream garage wall', [.85, .86, .79]);
  const mint = matte('Muted mint trim', [.47, .64, .58]);
  const edge = matte('Turntable edge', [.43, .51, .48]);
  const deck = matte('Turntable top', [.75, .78, .72]);
  function primitive(name: string, type: 'box' | 'cylinder' | 'plane', material: pc.StandardMaterial, position: number[], scale: number[]) {
    const entity = new pc.Entity(name, app); entity.addComponent('render', {type, material, castShadows: false, receiveShadows: false});
    entity.setLocalPosition(position[0], position[1], position[2]); entity.setLocalScale(scale[0], scale[1], scale[2]); room.addChild(entity); return entity;
  }
  // Normalized room coordinates, scaled once to the actual complete assembly bounds.
  primitive('Garage floor', 'box', floor, [0, -.21, 0], [60, .1, 60]);
  primitive('Garage back wall', 'box', wall, [0, 5, -5], [60, 10, .15]);
  primitive('Garage wall skirting', 'box', mint, [0, .1, -4.89], [60, .35, .08]);
  primitive('Stationary turntable base', 'cylinder', edge, [0, -.11, 0], [2.46, .15, 2.46]);
  primitive('Stationary turntable top', 'cylinder', deck, [0, -.026, 0], [2.40, .028, 2.40]);
  // One cabinet and one shallow shelf: a readable room rather than a prop collage.
  primitive('Low workshop cabinet', 'box', mint, [-2.8, .40, -3.5], [1.5, 1.1, .75]);
  primitive('Cabinet worktop', 'box', deck, [-2.8, .97, -3.5], [1.60, .08, .82]);
  primitive('Quiet wall shelf', 'box', mint, [2.5, 1.4, -4.7], [1.8, .10, .45]);
  primitive('Single storage box', 'box', deck, [2.6, 1.64, -4.65], [.60, .38, .36]);

  // Procedural radial opacity, no network/image load and no expensive shadow maps.
  const pixels = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const r = Math.hypot((x - 63.5) / 63.5, (y - 63.5) / 63.5), i = (y * 128 + x) * 4;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
    pixels[i + 3] = Math.round(255 * Math.pow(Math.max(0, 1 - r * r), 3));
  }
  const shadowTexture = new pc.Texture(app.graphicsDevice, {name: 'Garage contact falloff', width: 128, height: 128, format: pc.PIXELFORMAT_RGBA8, mipmaps: false, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE});
  (shadowTexture.lock() as Uint8Array).set(pixels); shadowTexture.unlock();
  const shadowMaterial = matte('Soft contact shadow', [.14, .20, .17]);
  shadowMaterial.useLighting = false; shadowMaterial.emissive = new pc.Color(.14, .20, .17);
  shadowMaterial.opacityMap = shadowTexture; shadowMaterial.opacityMapChannel = 'a'; shadowMaterial.opacity = .30;
  shadowMaterial.blendType = pc.BLEND_NORMAL; shadowMaterial.depthWrite = false; shadowMaterial.update();
  primitive('Soft contact shadow', 'plane', shadowMaterial, [0, -.008, 0], [2.0, 1, 2.0]);
  app.scene.ambientLight = new pc.Color(.67, .70, .68);
  for (const [name, color, intensity, rotation] of [['Garage key', [1, .96, .87], 1.15, [42, -30, 0]], ['Garage fill', [.83, .92, 1], .48, [30, 150, 0]]] as const) {
    const light = new pc.Entity(name, app); light.addComponent('light', {type: 'directional', color: new pc.Color(...color), intensity, castShadows: false});
    light.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]); room.addChild(light);
  }
  let bounds: pc.BoundingBox | null = null, disposed = false;
  return {
    room, turntable,
    attach(root: pc.Entity, nextBounds: pc.BoundingBox) {
      bounds = nextBounds.clone();
      const center = bounds.center, unit = Math.max(.5, Math.hypot(bounds.halfExtents.x, bounds.halfExtents.z));
      room.setLocalPosition(center.x, center.y - bounds.halfExtents.y, center.z); room.setLocalScale(unit, unit, unit);
      turntable.setLocalPosition(center); carrier.setLocalPosition(-center.x, -center.y, -center.z);
      carrier.addChild(root);
    },
    rotate(yaw: number) {turntable.setLocalEulerAngles(0, 36 - (Number.isFinite(yaw) ? yaw : 36), 0);},
    get bounds() {return bounds?.clone() || null;},
    dispose() {if (disposed) return; disposed = true; room.destroy(); turntable.destroy(); materials.forEach(material => material.destroy()); shadowTexture.destroy();},
  };
}
