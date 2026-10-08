import * as pc from 'playcanvas';
import { instantiateRenderEntity, validateDriverContract, type DriverAsset } from './assets';

/** Original source geometry for AI Friends Kart, AGPL-3.0-only.
 * No downloaded animal model, game rip, or reference-image texture is used.
 * Borrowed character assets retain their separate MODEL-NOTICE.txt rights.
 */
export const WATER_MOUNT_METADATA = Object.freeze({
  name: 'Bluebell water whale', author: 'AI Friends Kart contributors',
  original: true, license: 'AGPL-3.0-only', source: 'src/water-mount.ts',
  forward: '+Z', waterHeight: 0, bodyWidth: 1.7, length: 3.6,
  riderScale: 1.15, pelvisAboveSeat: .06,
});
type Point = readonly [number, number, number];
type Motion = 'body' | 'tail' | 'fin-left' | 'fin-right';
export interface WaterMountPart {
  readonly name: string; readonly motion: Motion; readonly color: string;
  readonly positions: readonly number[]; readonly normals: readonly number[]; readonly indices: readonly number[];
}
export interface WaterMountGeometry {
  readonly parts: readonly WaterMountPart[];
  readonly pivots: Readonly<Record<Motion, Point>>;
  readonly seat: Point;
  readonly triangleCount: number;
}
type MutablePart = { name: string; motion: Motion; color: string; positions: number[]; normals: number[]; indices: number[] };
const PIVOTS: Record<Motion, Point> = { body: [0, 0, 0], tail: [0, .32, -1.13], 'fin-left': [-.69, .34, .28], 'fin-right': [.69, .34, .28] };
const SEAT: Point = [0, 1.1, -.42];
const SKIN = '#638ee8', BELLY = '#fff0ce', FIN = '#7974d7', DARK = '#26384f', SADDLE = '#eeac70';
const unit = (v: number[]) => { const n = Math.hypot(...v); return v.map(x => x / n); };

class GeometryBuilder {
  parts = new Map<string, MutablePart>();
  add(name: string, motion: Motion, color: string, positions: number[], normals: number[], indices: number[]) {
    const key = `${motion}:${name}`;
    if (!this.parts.has(key)) this.parts.set(key, { name, motion, color, positions: [], normals: [], indices: [] });
    const part = this.parts.get(key)!, offset = part.positions.length / 3;
    part.positions.push(...positions); part.normals.push(...normals); part.indices.push(...indices.map(i => i + offset));
  }
  ellipsoid(name: string, motion: Motion, color: string, center: Point, radii: Point, segments = 12, rings = 8, yaw = 0) {
    const p: number[] = [], n: number[] = [], indices: number[] = [], c = Math.cos(yaw), s = Math.sin(yaw);
    const rotate = (v: number[]) => [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
    for (let y = 0; y <= rings; y++) for (let x = 0; x < segments; x++) {
      const a = y * Math.PI / rings, b = x * Math.PI * 2 / segments;
      const sphere = [Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)];
      const at = rotate(sphere.map((v, i) => v * radii[i]));
      p.push(...at.map((v, i) => v + center[i])); n.push(...unit(rotate(sphere.map((v, i) => v / radii[i]))));
    }
    for (let y = 0; y < rings; y++) for (let x = 0; x < segments; x++) {
      const a = y * segments + x, b = y * segments + (x + 1) % segments, c = a + segments, d = b + segments;
      if (y > 0) indices.push(a, b, c);
      if (y < rings - 1) indices.push(b, d, c);
    }
    this.add(name, motion, color, p, n, indices);
  }
  body() {
    // Profiles run tail to nose. Their taper leaves room beside the rear saddle
    // for a real rider's splayed legs, rather than burying kart feet in a sphere.
    const profile = [
      [-1.32, .01, .01, .32], [-1.12, .20, .20, .36], [-.8, .39, .34, .39],
      [-.42, .60, .47, .43], [0, .79, .53, .43], [.45, .85, .55, .43],
      [.85, .76, .50, .45], [1.19, .56, .39, .47], [1.43, .30, .23, .48], [1.53, .01, .01, .48],
    ];
    const segments = 24, p: number[] = [], indices: number[] = [];
    for (const [z, rx, ry, cy] of profile) for (let i = 0; i < segments; i++) {
      const a = i * Math.PI * 2 / segments; p.push(Math.cos(a) * rx, cy + Math.sin(a) * ry, z);
    }
    for (let r = 0; r < profile.length - 1; r++) for (let j = 0; j < segments; j++) {
      const a = r * segments + j, b = r * segments + (j + 1) % segments, c = a + segments, d = b + segments;
      indices.push(a, b, c, b, d, c);
    }
    // Two tiny polar caps, deliberately avoiding degenerate pole triangles.
    for (const end of [0, profile.length - 1]) {
      const [z, , , cy] = profile[end], center = p.length / 3; p.push(0, cy, z);
      for (let j = 0; j < segments; j++) {
        const a = end * segments + j, b = end * segments + (j + 1) % segments;
        indices.push(...(end === 0 ? [center, b, a] : [center, a, b]));
      }
    }
    const normals = pc.calculateNormals(p, indices);
    const top: number[] = [], bottom: number[] = [];
    for (let i = 0; i < indices.length; i += 3) {
      const face = indices.slice(i, i + 3), y = face.reduce((s, v) => s + p[v * 3 + 1], 0) / 3;
      (y < .29 ? bottom : top).push(...face);
    }
    this.add('rounded-blue-body', 'body', SKIN, p, Array.from(normals), top);
    this.add('cream-belly', 'body', BELLY, p, Array.from(normals), bottom);
  }
  finish(): WaterMountGeometry {
    const parts = [...this.parts.values()].map(part => Object.freeze({ ...part,
      positions: Object.freeze(part.positions), normals: Object.freeze(part.normals), indices: Object.freeze(part.indices) }));
    return Object.freeze({ parts: Object.freeze(parts), pivots: Object.freeze(Object.fromEntries(Object.entries(PIVOTS).map(([key, value]) => [key, Object.freeze(value)]))) as Readonly<Record<Motion, Point>>,
      seat: Object.freeze(SEAT), triangleCount: parts.reduce((n, p) => n + p.indices.length / 3, 0) });
  }
}
let geometry: WaterMountGeometry | undefined;
/** Engine-independent numeric arrays are serializable for offline render export.
 * Parts are in their motion group's local coordinates; add pivots for rest pose.
 */
export function getWaterMountGeometry(): WaterMountGeometry {
  if (geometry) return geometry;
  const b = new GeometryBuilder(); b.body();
  b.ellipsoid('tail-flukes', 'tail', FIN, [0, .015, -.35], [.18, .14, .51]);
  for (const sign of [-1, 1]) {
    b.ellipsoid('tail-flukes', 'tail', FIN, [sign * .39, .05, -.69], [.48, .09, .24], 14, 6, sign * -.35);
    b.ellipsoid('side-flipper', sign < 0 ? 'fin-left' : 'fin-right', FIN, [sign * .28, -.06, -.17], [.43, .075, .19], 14, 6, sign * .42);
    b.ellipsoid('friendly-eyes', 'body', DARK, [sign * .651, .675, 1.026], [.069, .085, .087], 12, 8);
    b.ellipsoid('eye-glints', 'body', '#ffffff', [sign * .673, .705, 1.091], [.022, .026, .018], 8, 6);
    b.ellipsoid('cheek-spots', 'body', '#bba9f1', [sign * .633, .495, 1.063], [.081, .036, .084], 10, 6);
  }
  // A row of tiny overlapping dark solids gives a genuine curved smile.
  for (let i = 0; i <= 12; i++) {
    const x = -.38 + i * .76 / 12;
    b.ellipsoid('friendly-eyes', 'body', DARK, [x, .37 + .11 * (x / .38) ** 2, 1.479 - .21 * (x / .38) ** 2], [.043, .012, .013], 6, 4);
  }
  // The tapered back is lower than the seat: an original rounded under-pad
  // bridges into the body so the cushion has visible physical support.
  b.ellipsoid('saddle-cushion', 'body', SADDLE, [0, .80, -.48], [.30, .23, .34], 12, 6);
  b.ellipsoid('saddle-cushion', 'body', SADDLE, [0, 1.015, -.42], [.36, .085, .39], 16, 8);
  b.ellipsoid('saddle-cushion', 'body', SADDLE, [0, 1.075, -.73], [.30, .12, .09], 12, 6);
  geometry = b.finish(); return geometry;
}

export interface WaterMountInput { speed: number; steer: number; time: number; boost?: boolean | number }
export interface WaterMountOptions { id?: string; color?: string }

const find = (model: pc.Entity, name: string) => model.findByName(name) as pc.GraphNode | null;
const renders = (model: pc.Entity) => (model.findComponents('render') as pc.RenderComponent[]).flatMap(r => r.meshInstances);

/** Sample the supplied rig without a chassis and preserve its authored GLB root. */
function prepareRider(model: pc.Entity, asset: DriverAsset) {
  model.addComponent('anim', { activate: false, enabled: false });
  const track = (names: string[]) => asset.animations.map(a => a.resource as pc.AnimTrack).find(t => names.includes(t.name));
  const range = track(['SteeringRange']);
  if (range) {
    model.anim!.assignAnimation('Ride', range, undefined, 0, false); model.anim!.baseLayer.play('Ride');
    return { mode: 'sampled-range', sample(steer: number) { model.anim!.baseLayer.activeStateCurrentTime = (steer + 1) * range.duration / 2; model.anim!.update(0); } };
  }
  // Canonical local imports can omit a continuous range. Keep their existing
  // three authored poses and deterministically blend at a fixed sample time.
  model.anim!.loadStateGraph({ layers: [{ name: 'Base', states: [{ name: 'START' }, { name: 'Ride', speed: 0, loop: true,
    blendTree: { type: pc.ANIM_BLEND_1D, parameter: 'steer', children: [
      { name: 'Left', point: -1 }, { name: 'Idle', point: 0 }, { name: 'Right', point: 1 },
    ] } }], transitions: [{ from: 'START', to: 'Ride' }] }], parameters: { steer: { type: pc.ANIM_PARAMETER_FLOAT, value: 0 } } });
  for (const [pose, aliases] of [['Left', ['Steer_Left', 'SteerLeft']], ['Idle', ['Idle', 'DriveIdle']], ['Right', ['Steer_Right', 'SteerRight']]] as [string, string[]][]) model.anim!.assignAnimation(`Ride.${pose}`, track(aliases)!);
  model.anim!.baseLayer.play('Ride');
  return { mode: 'three-clip-blend', sample(steer: number) { model.anim!.setFloat('steer', steer); model.anim!.update(0); } };
}

/** A mount owns only its authored materials/mesh instances; the driver's
 * container, source meshes, textures and materials always remain borrowed.
 * Place/rotate root in the course. update never changes that race transform.
 */
export function createWaterMount(app: pc.AppBase, driver?: DriverAsset, { id = 'water-whale', color = SKIN }: WaterMountOptions = {}) {
  if (driver?.disposed) throw new Error('Model is unavailable');
  if (driver) validateDriverContract(driver);
  const root = new pc.Entity(`WaterMount_${id}`, app), body = new pc.Entity('WaterMountMotion', app);
  root.addChild(body);
  const materials = new Map<string, pc.StandardMaterial>();
  const material = (hex: string) => {
    if (!materials.has(hex)) { const m = new pc.StandardMaterial(); m.name = `Original water mount ${hex}`; m.diffuse.fromString(hex); m.gloss = .38; m.cull = pc.CULLFACE_BACK; m.update(); materials.set(hex, m); }
    return materials.get(hex)!;
  };
  const shape = getWaterMountGeometry();
  const groups: Record<Motion, pc.Entity> = { body, tail: new pc.Entity('Tail flukes', app), 'fin-left': new pc.Entity('Left flipper', app), 'fin-right': new pc.Entity('Right flipper', app) };
  for (const motion of ['tail', 'fin-left', 'fin-right'] as Motion[]) { body.addChild(groups[motion]); groups[motion].setLocalPosition(...shape.pivots[motion]); }
  for (const motion of Object.keys(groups) as Motion[]) {
    const instances = shape.parts.filter(p => p.motion === motion).map(part => {
      const mesh = new pc.Mesh(app.graphicsDevice); mesh.setPositions(part.positions as number[]); mesh.setNormals(part.normals as number[]); mesh.setIndices(part.indices as number[]); mesh.update(pc.PRIMITIVE_TRIANGLES);
      const instance = new pc.MeshInstance(mesh, material(part.color === SKIN ? color : part.color)); instance.castShadow = true; instance.receiveShadow = true; return instance;
    });
    groups[motion].addComponent('render', { meshInstances: instances });
  }
  const seatAnchor = new pc.Entity('WaterMountSeat', app); body.addChild(seatAnchor); seatAnchor.setLocalPosition(...shape.seat);
  const gripTargets = { left: new pc.Entity('WaterMountGripLeft', app), right: new pc.Entity('WaterMountGripRight', app) };
  body.addChild(gripTargets.left); body.addChild(gripTargets.right);
  gripTargets.left.setLocalPosition(-.28, 1.39, -.08); gripTargets.right.setLocalPosition(.28, 1.39, -.08);
  const riderMount = new pc.Entity('WaterMountRiderFitting', app); body.addChild(riderMount);
  riderMount.setLocalScale(WATER_MOUNT_METADATA.riderScale, WATER_MOUNT_METADATA.riderScale, WATER_MOUNT_METADATA.riderScale);
  let rider: pc.Entity | null = null, pelvis: pc.GraphNode | null = null;
  let animation: ReturnType<typeof prepareRider> | undefined;
  const lockedBones: { bone: pc.GraphNode; rotation: pc.Quat; position: pc.Vec3 }[] = [];
  let legPairs = 0;
  if (driver) {
    rider = instantiateRenderEntity(driver); riderMount.addChild(rider);
    for (const mesh of renders(rider)) { mesh.castShadow = true; mesh.receiveShadow = true; if (mesh.skinInstance) mesh.cull = false; }
    animation = prepareRider(rider, driver); animation.sample(0);
    pelvis = find(rider, 'Pelvis');
    const seatPoint = new pc.Vec3(...SEAT); seatPoint.y += WATER_MOUNT_METADATA.pelvisAboveSeat;
    // Alignment is measured on this actual evaluated skeleton, including the
    // container root's original fitting scale, rather than guessing its height.
    const source = pelvis?.getPosition().clone() || new pc.Vec3(0, .88 * WATER_MOUNT_METADATA.riderScale, 0);
    riderMount.setLocalPosition(seatPoint.clone().sub(source));
    if (pelvis) lockedBones.push({ bone: pelvis, rotation: pelvis.getLocalRotation().clone(), position: pelvis.getLocalPosition().clone() });
    for (const side of ['L', 'R']) {
      const thigh = find(rider, `Thigh.${side}`), shin = find(rider, `Shin.${side}`), foot = find(rider, `Foot.${side}`);
      if (!thigh || !shin || !foot) continue;
      const sign = Math.sign(thigh.getPosition().x - (pelvis?.getPosition().x || 0)) || (side === 'L' ? -1 : 1);
      const footRotation = foot.getRotation().clone();
      const aim = (bone: pc.GraphNode, end: pc.GraphNode, direction: pc.Vec3) => {
        const from = end.getPosition().clone().sub(bone.getPosition()).normalize();
        const swing = new pc.Quat().setFromDirections(from, direction.normalize());
        bone.setRotation(new pc.Quat().mul2(swing, bone.getRotation()));
      };
      aim(thigh, shin, new pc.Vec3(sign * .86, -.5, .06));
      aim(shin, foot, new pc.Vec3(sign * .65, -.75, .1));
      foot.setRotation(footRotation);
      for (const bone of [thigh, shin, foot]) lockedBones.push({ bone, rotation: bone.getLocalRotation().clone(), position: bone.getLocalPosition().clone() });
      legPairs++;
    }
  }
  // A soft grab bar instead of a hidden kart wheel. Endpoints follow the real
  // authored hand markers; all six rigs retain their existing finger pose.
  const bar = new pc.Entity('Saddle grab bar', app), stem = new pc.Entity('Saddle grab bar stem', app);
  const grabBarGeometry = new pc.CylinderGeometry({ radius: 1, height: 1, heightSegments: 1, capSegments: 10 });
  const triangleCount = shape.triangleCount + grabBarGeometry.indices.length / 3 * 2;
  for (const entity of [bar, stem]) { body.addChild(entity); entity.addComponent('render', { meshInstances: [new pc.MeshInstance(pc.Mesh.fromGeometry(app.graphicsDevice, grabBarGeometry), material('#ffe1a2'))] }); }
  const leftMarker = rider && (find(rider, 'Grip.L') || find(rider, 'GripL'));
  const rightMarker = rider && (find(rider, 'Grip.R') || find(rider, 'GripR'));
  const inverse = new pc.Mat4(), local = new pc.Vec3(), center = new pc.Vec3(), direction = new pc.Vec3(), rotation = new pc.Quat();
  const connect = (entity: pc.Entity, a: pc.Vec3, b: pc.Vec3, radius: number) => {
    center.add2(a, b).mulScalar(.5); direction.sub2(b, a);
    entity.setLocalPosition(center); entity.setLocalRotation(rotation.setFromDirections(pc.Vec3.UP, direction.clone().normalize())); entity.setLocalScale(radius, direction.length(), radius);
  };
  let disposed = false, lastInput = { speed: 0, steer: 0, time: 0, boost: 0 };
  const update = ({ speed, steer, time, boost = false }: WaterMountInput) => {
    if (disposed) return;
    lastInput = { speed: Number.isFinite(speed) ? pc.math.clamp(speed, -80, 80) : 0, steer: Number.isFinite(steer) ? pc.math.clamp(steer, -1, 1) : 0, time: Number.isFinite(time) ? pc.math.clamp(time, 0, 86400) : 0, boost: Number.isFinite(Number(boost)) ? pc.math.clamp(Number(boost), 0, 1) : 0 };
    // Blend two stable phases rather than multiplying absolute time by speed:
    // acceleration must not make the tail suddenly jump to a different phase.
    const t = lastInput.time, effort = Math.min(1, Math.abs(lastInput.speed) / 24), stroke = Math.sin(t * 2.2) * (1 - effort) + Math.sin(t * 5.5) * effort;
    body.setLocalPosition(0, Math.sin(t * 2.2) * (.025 + effort * .018), 0);
    body.setLocalEulerAngles(stroke * effort * 1.7 - lastInput.boost * 3, 0, -lastInput.steer * (3 + effort * 9));
    groups.tail.setLocalEulerAngles(stroke * (8 + effort * 16), lastInput.steer * 6, 0);
    groups['fin-left'].setLocalEulerAngles(0, -lastInput.steer * 7, -8 + stroke * 8 - lastInput.steer * 8);
    groups['fin-right'].setLocalEulerAngles(0, -lastInput.steer * 7, 8 - stroke * 8 - lastInput.steer * 8);
    animation?.sample(lastInput.steer);
    for (const locked of lockedBones) { locked.bone.setLocalRotation(locked.rotation); locked.bone.setLocalPosition(locked.position); }
    inverse.copy(body.getWorldTransform()).invert();
    if (leftMarker) gripTargets.left.setLocalPosition(inverse.transformPoint(leftMarker.getPosition(), local));
    if (rightMarker) gripTargets.right.setLocalPosition(inverse.transformPoint(rightMarker.getPosition(), local));
    const a = gripTargets.left.getLocalPosition(), b = gripTargets.right.getLocalPosition();
    connect(bar, a, b, .026);
    const middle = new pc.Vec3().add2(a, b).mulScalar(.5); connect(stem, new pc.Vec3(0, 1.015, -.15), middle, .027);
  };
  update({ speed: 0, steer: 0, time: 0 });
  const dispose = () => {
    if (disposed) return;
    disposed = true; app.off('destroy', dispose); root.destroy(); materials.forEach(m => m.destroy()); materials.clear();
  };
  app.once('destroy', dispose);
  return {
    root, body, rider, riderMount, seatAnchor, gripTargets, tail: groups.tail,
    flippers: { left: groups['fin-left'], right: groups['fin-right'] },
    update,
    getState() {
      const pelvisTarget = seatAnchor.getWorldTransform().transformPoint(new pc.Vec3(0, WATER_MOUNT_METADATA.pelvisAboveSeat, 0));
      return { id, status: disposed ? 'disposed' : 'ready', riderStatus: rider ? 'ready' : 'unloaded',
        animationMode: animation?.mode || 'none', ridingLegPairs: legPairs, rigFit: pelvis && legPairs === 2 ? 'pelvis-straddle' : rider ? 'legacy-anchor' : 'none', pelvisSeatError: pelvis ? pelvis.getPosition().distance(pelvisTarget) : null,
        gripErrors: { left: leftMarker ? leftMarker.getPosition().distance(gripTargets.left.getPosition()) : null, right: rightMarker ? rightMarker.getPosition().distance(gripTargets.right.getPosition()) : null },
        triangles: triangleCount, materialCount: materials.size, ...lastInput };
    },
    dispose,
  };
}
