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
  const matte = (name: string, color: number[], gloss = .12) => {
    const material = new pc.StandardMaterial(); material.name = name;
    material.diffuse = new pc.Color(...color); material.gloss = gloss; material.update(); materials.push(material); return material;
  };
  // A small shared palette keeps the room quieter than the assembled dessert car.
  // Enamel, timber and brushed hardware get distinct finishes without asset loads.
  const floor = matte('Warm tiled floor', [.73, .76, .71]);
  const grout = matte('Recessed floor joints', [.64, .69, .64]);
  const wall = matte('Vanilla plaster', [.90, .89, .80]);
  const cream = matte('Cream enamel', [.91, .88, .75], .34);
  const mint = matte('Mint enamel', [.48, .67, .59], .32);
  const paleMint = matte('Pistachio panel faces', [.68, .79, .68], .26);
  const edge = matte('Deep sage edges', [.34, .47, .41], .24);
  const deck = matte('Warm service platform', [.80, .81, .72], .20);
  const wood = matte('Honey worktop', [.69, .49, .30], .26);
  const endgrain = matte('Honey worktop edging', [.83, .66, .43], .20);
  const metal = matte('Brushed workshop steel', [.55, .62, .61], .58);
  const rubber = matte('Charcoal rubber', [.24, .31, .28], .08);
  const blush = matte('Strawberry tool handles', [.77, .46, .43], .30);
  const glass = matte('Frosted blue window', [.67, .81, .81], .48);
  const glow = matte('Warm lamp diffuser', [1, .94, .77], .20);
  glow.emissive = new pc.Color(.42, .34, .20); glow.update();

  type Shape = 'box' | 'cylinder' | 'plane';
  function primitive(name: string, type: Shape, material: pc.StandardMaterial, position: number[], scale: number[], rotation?: number[]) {
    const entity = new pc.Entity(name, app); entity.addComponent('render', {type, material, castShadows: false, receiveShadows: false});
    entity.setLocalPosition(position[0], position[1], position[2]); entity.setLocalScale(scale[0], scale[1], scale[2]);
    if (rotation) entity.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]);
    room.addChild(entity); return entity;
  }
  const box = (name: string, material: pc.StandardMaterial, position: number[], scale: number[], rotation?: number[]) => primitive(name, 'box', material, position, scale, rotation);
  const cylinder = (name: string, material: pc.StandardMaterial, position: number[], scale: number[], rotation?: number[]) => primitive(name, 'cylinder', material, position, scale, rotation);

  // Normalized room coordinates, scaled once to the complete assembly bounds.
  // The open foreground and lack of a ceiling preserve the full 4–78° inspection.
  box('Garage floor', floor, [0, -.21, 0], [60, .1, 60]);
  box('Garage back wall', wall, [0, 5, -4.35], [60, 10, .15]);
  box('Garage wall skirting', edge, [0, .02, -4.25], [60, .20, .06]);
  box('Mint lower wall panels', paleMint, [0, .48, -4.25], [12, .72, .05]);
  box('Wall panel cap rail', mint, [0, .88, -4.21], [12, .06, .07]);
  for (let i = -3; i <= 3; i++) {
    box(`Wall panel joint ${i}`, mint, [i * 1.35, .48, -4.21], [.025, .68, .04]);
  }
  // Flush joints are behind the platform surface, so the car never intersects them.
  for (let i = -2; i <= 2; i++) {
    box(`Floor joint across ${i}`, grout, [0, -.158, i * 1.6], [12, .002, .012]);
    box(`Floor joint length ${i}`, grout, [i * 1.6, -.158, 0], [.012, .002, 12]);
  }
  cylinder('Stationary turntable base', edge, [0, -.11, 0], [2.46, .15, 2.46]);
  cylinder('Stationary platform rim', metal, [0, -.043, 0], [2.43, .022, 2.43]);
  cylinder('Stationary turntable top', deck, [0, -.026, 0], [2.40, .028, 2.40]);
  // Inset service markers make the base tangible without suggesting a rotating room.
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    box(`Platform service mark ${i}`, mint, [Math.sin(angle) * 1.13, -.011, Math.cos(angle) * 1.13], [.022, .003, .11], [0, i * 45, 0]);
  }

  // Main bench: recessed carcass, separate fronts, toe space and warm edge-banded top.
  box('Workbench recessed carcass', edge, [-2.5, .39, -3.60], [1.92, .91, .74]);
  for (const x of [-3.30, -1.70]) {
    box(`Workbench foot ${x}`, metal, [x, -.06, -3.53], [.10, .20, .56]);
  }
  box('Workbench left door', mint, [-2.98, .43, -3.211], [.87, .77, .05]);
  box('Workbench left inset panel', paleMint, [-2.98, .40, -3.18], [.74, .56, .018]);
  box('Workbench door handle', metal, [-2.70, .65, -3.13], [.035, .17, .07]);
  for (let i = 0; i < 3; i++) {
    const y = .17 + i * .27;
    box(`Workbench drawer ${i}`, mint, [-2.02, y, -3.211], [.88, .24, .05]);
    box(`Workbench drawer pull ${i}`, cream, [-2.02, y + .025, -3.16], [.27, .035, .065]);
  }
  box('Workbench top edge', endgrain, [-2.5, .88, -3.60], [2.06, .12, .87]);
  box('Workbench top surface', wood, [-2.5, .947, -3.60], [2.02, .024, .83]);
  box('Workbench back lip', endgrain, [-2.5, 1.02, -3.98], [2.04, .14, .045]);
  box('Bench rubber service mat', rubber, [-2.65, .964, -3.55], [.66, .008, .43]);
  box('Bench folded cloth', blush, [-1.87, .983, -3.43], [.32, .035, .23], [0, -8, 0]);

  // A framed pegboard and three recognizable tools, with no text or noisy decals.
  box('Pegboard frame', endgrain, [-2.5, 1.92, -4.20], [2.10, 1.25, .10]);
  box('Pegboard inset', wood, [-2.5, 1.92, -4.135], [1.96, 1.11, .035]);
  for (let column = 0; column < 7; column++) {
    // Shallow slots suggest perforations; one mesh per column avoids a dense hole grid.
    box(`Pegboard hanging rail ${column}`, endgrain, [-3.31 + column * .27, 1.91, -4.108], [.016, .96, .014]);
  }
  box('Hanging wrench shaft', metal, [-3.08, 1.85, -4.07], [.055, .47, .032], [0, 0, -12]);
  box('Hanging wrench shoulder', metal, [-3.02, 2.10, -4.07], [.18, .08, .035], [0, 0, -12]);
  for (const x of [-3.10, -2.96]) box(`Hanging wrench jaw ${x}`, metal, [x, 2.16, -4.07], [.045, .13, .035], [0, 0, -12]);
  box('Hanging hammer handle', blush, [-2.47, 1.85, -4.06], [.065, .47, .055], [0, 0, 9]);
  box('Hanging hammer head', metal, [-2.51, 2.12, -4.05], [.32, .115, .08], [0, 0, 9]);
  box('Hanging screwdriver shaft', metal, [-1.94, 2.02, -4.06], [.025, .29, .025]);
  cylinder('Hanging screwdriver grip', cream, [-1.94, 1.78, -4.06], [.10, .22, .10]);
  for (const [i, x] of [-3.03, -2.51, -1.94].entries()) {
    cylinder(`Tool peg ${i}`, metal, [x, 2.24, -4.07], [.035, .09, .035], [90, 0, 0]);
  }
  // A compact bench vise communicates function even when viewed from above.
  box('Bench vise base', metal, [-2.71, 1.003, -3.51], [.30, .07, .22]);
  box('Bench vise body', mint, [-2.71, 1.095, -3.51], [.22, .16, .17]);
  for (const z of [-3.60, -3.42]) box(`Bench vise jaw ${z}`, metal, [-2.71, 1.17, z], [.31, .065, .06]);
  cylinder('Bench vise spindle', metal, [-2.71, 1.075, -3.35], [.03, .23, .03], [90, 0, 0]);
  box('Bench vise crank', metal, [-2.71, 1.075, -3.235], [.035, .20, .035]);

  // Physical wall lamp and shelf diffuser add warm highlights without shadow maps.
  box('Bench light wall mount', edge, [-2.5, 2.77, -4.20], [.28, .17, .10]);
  for (const x of [-3.05, -1.95]) box(`Bench light bracket ${x}`, metal, [x, 2.77, -4.02], [.035, .055, .40]);
  box('Bench light hood', mint, [-2.5, 2.77, -3.80], [1.76, .12, .27]);
  box('Bench light diffuser', glow, [-2.5, 2.702, -3.80], [1.60, .016, .20]);

  // The frosted window provides a quiet cool counterpoint to the working side.
  box('Workshop window frame', cream, [.42, 2.06, -4.20], [1.58, 1.54, .15]);
  box('Workshop frosted window', glass, [.42, 2.06, -4.11], [1.42, 1.38, .035]);
  box('Workshop window mullion', cream, [.42, 2.06, -4.075], [.045, 1.42, .04]);
  box('Workshop window crossbar', cream, [.42, 2.06, -4.075], [1.44, .045, .04]);
  box('Workshop window sill', endgrain, [.42, 1.26, -4.08], [1.75, .085, .35]);
  box('Window reflected light', glow, [.10, 2.52, -4.087], [.49, .018, .008]);

  // Right-hand shelf: restrained cream canisters and one labeled parts bin.
  box('Workshop shelf back', paleMint, [2.46, 1.82, -4.20], [1.68, .73, .05]);
  box('Workshop wall shelf', endgrain, [2.46, 1.44, -4.02], [1.82, .085, .50]);
  for (const x of [1.82, 3.1]) {
    box(`Shelf bracket upright ${x}`, metal, [x, 1.29, -4.18], [.045, .30, .06]);
    box(`Shelf bracket arm ${x}`, metal, [x, 1.39, -4.03], [.045, .045, .34]);
  }
  box('Shelf task light', glow, [2.46, 1.387, -3.92], [1.37, .018, .06]);
  box('Shelf parts bin', mint, [2.94, 1.69, -4.0], [.55, .39, .37]);
  box('Shelf bin lid', cream, [2.94, 1.895, -4.0], [.58, .045, .40]);
  box('Shelf bin label', cream, [2.94, 1.70, -3.807], [.23, .10, .012]);
  for (const [i, x] of [1.93, 2.30].entries()) {
    cylinder(`Shelf canister ${i}`, cream, [x, 1.67, -4.0], [.25, .36, .25]);
    cylinder(`Shelf canister cap ${i}`, i ? blush : mint, [x, 1.86, -4.0], [.265, .045, .265]);
  }

  // A low rolling tool cart stays outside the car's full rotation envelope.
  box('Service trolley shadow pad', grout, [2.18, -.154, -2.38], [1.0, .009, .71]);
  for (const x of [1.83, 2.53]) for (const z of [-2.64, -2.12]) {
    cylinder(`Service trolley caster ${x} ${z}`, rubber, [x, -.06, z], [.16, .07, .16], [90, 0, 0]);
  }
  box('Service trolley body', edge, [2.18, .33, -2.38], [.88, .65, .60]);
  for (let i = 0; i < 2; i++) {
    const y = .18 + i * .29;
    box(`Service trolley drawer ${i}`, paleMint, [2.18, y, -2.065], [.79, .255, .04]);
    box(`Service trolley drawer pull ${i}`, metal, [2.18, y + .03, -2.026], [.25, .033, .06]);
  }
  box('Service trolley tray', cream, [2.18, .687, -2.38], [.97, .065, .70]);
  box('Service trolley tray liner', rubber, [2.18, .725, -2.38], [.83, .014, .56]);
  box('Service trolley rear rail', mint, [2.18, .78, -2.71], [.98, .16, .035]);
  for (const x of [1.715, 2.645]) box(`Service trolley side rail ${x}`, mint, [x, .78, -2.38], [.035, .16, .65]);
  cylinder('Service trolley paint tin', blush, [2.37, .86, -2.42], [.22, .25, .22]);
  cylinder('Service trolley tin lid', metal, [2.37, .997, -2.42], [.235, .027, .235]);
  box('Service trolley spanner', metal, [1.99, .744, -2.29], [.26, .025, .045], [0, 24, 0]);

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
