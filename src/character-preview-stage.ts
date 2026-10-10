import * as pc from 'playcanvas';

/** Selection-only lighting. Original portrait materials and race scenes are untouched. */
export const PORTRAIT_LIGHTING = Object.freeze({
  ambient: Object.freeze([.40, .43, .45]), key: .95, fill: .30, exposure: 1,
});
export const PORTRAIT_CLEAR_COLOR = new pc.Color(.67, .71, .68, 1);

/** A quiet, stationary display corner. Geometry rather than CSS remains visible
 * behind an opaque WebGL canvas. No shadow maps, post effects or external assets. */
export function createCharacterPreviewStage(app: pc.AppBase) {
  const room = new pc.Entity('Portrait display corner', app);
  app.root.addChild(room);
  const materials: pc.StandardMaterial[] = [];
  const matte = (name: string, color: number[]) => {
    const material = new pc.StandardMaterial(); material.name = name;
    material.diffuse = new pc.Color(...color); material.gloss = .08;
    material.update(); materials.push(material); return material;
  };
  const wall = matte('Portrait warm grey plaster', [.72, .74, .69]);
  const floor = matte('Portrait quiet stone floor', [.60, .65, .61]);
  const mint = matte('Portrait muted mint panels', [.52, .63, .57]);
  const trim = matte('Portrait soft sage trim', [.48, .57, .52]);
  const cream = matte('Portrait cream platform', [.77, .76, .66]);
  const prop = matte('Portrait muted workshop props', [.63, .68, .62]);
  const wood = matte('Portrait pale timber shelf', [.67, .63, .53]);
  function primitive(name: string, type: 'box' | 'cylinder' | 'plane', material: pc.StandardMaterial, position: number[], scale: number[], rotation?: number[]) {
    const entity = new pc.Entity(name, app);
    entity.addComponent('render', {type, material, castShadows: false, receiveShadows: false});
    entity.setLocalPosition(position[0], position[1], position[2]); entity.setLocalScale(scale[0], scale[1], scale[2]);
    if (rotation) entity.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]);
    room.addChild(entity); return entity;
  }
  const box = (name: string, material: pc.StandardMaterial, position: number[], scale: number[], rotation?: number[]) => primitive(name, 'box', material, position, scale, rotation);
  const cylinder = (name: string, material: pc.StandardMaterial, position: number[], scale: number[]) => primitive(name, 'cylinder', material, position, scale);
  box('Portrait floor', floor, [0, -.11, 0], [20, .04, 20]);
  box('Portrait backdrop', wall, [0, 2, -.88], [20, 4.3, .06]);
  box('Portrait lower wall', mint, [0, .13, -.839], [20, .43, .02]);
  box('Portrait dado rail', trim, [0, .355, -.82], [20, .018, .032]);
  // Side details leave the entire central silhouette free of props and signage.
  box('Portrait left recessed panel', mint, [-1.02, .78, -.834], [.52, .60, .025]);
  box('Portrait display shelf', wood, [-1.02, .55, -.72], [.62, .027, .24]);
  for (let i = 0; i < 3; i++) {
    const x = -1.19 + i * .16, height = [.15, .20, .12][i];
    cylinder(`Portrait canister ${i}`, prop, [x, .565 + height / 2, -.72], [.10, height, .10]);
    cylinder(`Portrait canister lid ${i}`, cream, [x, .57 + height, -.72], [.105, .015, .105]);
  }
  box('Portrait tool rail', wood, [1.02, .90, -.78], [.56, .035, .07]);
  for (let i = 0; i < 2; i++) {
    const x = .9 + i * .23;
    box(`Portrait hanging utensil ${i}`, trim, [x, .77, -.73], [.023, .24, .024]);
    primitive(`Portrait utensil head ${i}`, i ? 'box' : 'cylinder', prop, [x, .64, -.73], i ? [.075, .095, .025] : [.075, .022, .075], i ? undefined : [90, 0, 0]);
  }
  const base = cylinder('Portrait pedestal base', trim, [0, -.057, 0], [1.2, .066, 1.2]);
  const top = cylinder('Portrait pedestal top', cream, [0, -.019, 0], [1.18, .010, 1.18]);

  // A tiny procedural opacity mask gives grounding without per-frame shadows.
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5), i = (y * size + x) * 4;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
    pixels[i + 3] = Math.round(255 * Math.pow(Math.max(0, 1 - r * r), 3));
  }
  const shadowTexture = new pc.Texture(app.graphicsDevice, {name: 'Portrait contact falloff', width: size, height: size, format: pc.PIXELFORMAT_RGBA8, mipmaps: false, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE});
  (shadowTexture.lock() as Uint8Array).set(pixels); shadowTexture.unlock();
  const shadowMaterial = matte('Portrait contact shadow', [.19, .24, .21]);
  shadowMaterial.useLighting = false; shadowMaterial.emissive = new pc.Color(.19, .24, .21);
  shadowMaterial.opacityMap = shadowTexture; shadowMaterial.opacityMapChannel = 'a'; shadowMaterial.opacity = .28;
  shadowMaterial.blendType = pc.BLEND_NORMAL; shadowMaterial.depthWrite = false; shadowMaterial.update();
  const shadow = primitive('Portrait contact shadow', 'plane', shadowMaterial, [0, -.013, 0], [.85, 1, .7]);

  app.scene.ambientLight = new pc.Color(...PORTRAIT_LIGHTING.ambient);
  app.scene.exposure = PORTRAIT_LIGHTING.exposure;
  for (const [name, color, intensity, rotation] of [
    ['Portrait key light', [1, .97, .92], PORTRAIT_LIGHTING.key, [35, -28, 0]],
    ['Portrait fill light', [.88, .94, 1], PORTRAIT_LIGHTING.fill, [20, 145, 0]],
  ] as const) {
    const light = new pc.Entity(name, app);
    light.addComponent('light', {type: 'directional', color: new pc.Color(...color), intensity, castShadows: false});
    light.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]); room.addChild(light);
  }
  let disposed = false;
  return {
    room,
    fit(bounds: pc.BoundingBox) {
      if (disposed) return;
      const unit = Math.max(.1, bounds.halfExtents.y * 2);
      const radius = Math.hypot(bounds.halfExtents.x, bounds.halfExtents.z) / unit;
      room.setLocalScale(unit, unit, unit);
      room.setLocalPosition(bounds.center.x, bounds.center.y - bounds.halfExtents.y, bounds.center.z);
      // The platform clears the full rotation envelope, not just the front pose.
      const diameter = Math.max(1.12, radius * 2 + .12);
      base.setLocalScale(diameter + .02, .066, diameter + .02);
      top.setLocalScale(diameter, .010, diameter);
      shadow.setLocalScale(Math.min(diameter * .88, radius * 1.9), 1, Math.min(diameter * .8, radius * 1.6));
    },
    dispose() {
      if (disposed) return; disposed = true;
      room.destroy(); materials.forEach(material => material.destroy()); shadowTexture.destroy();
    },
  };
}
