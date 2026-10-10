import * as pc from 'playcanvas';
import { DRIVER_CLIPS, MAX_WHEEL_ANGLE, WHEEL_AXIS, WHEEL_CENTER, instantiateRenderEntity, prepareAnimation, validateDriverContract, type DriverAsset } from './assets';
import type { KartAssembly } from './kart-assembly';

const FOOD_WHEEL_CENTER = new pc.Vec3(0, 1.12, .49);
const FOOD_COLUMN_BASE = new pc.Vec3(0, .455, .58);
const ORIGINAL_RIM_RADIUS = .245;
const ORIGINAL_RIM_TUBE = .026;
const HIP_CLEARANCE = .14;
const renders = (entity: pc.Entity) => entity.findComponents('render') as pc.RenderComponent[];
const meshes = (entity: pc.Entity) => renders(entity).flatMap(render => render.meshInstances);
interface Piece { mesh: pc.MeshInstance; indices: number[]; min: pc.Vec3; max: pc.Vec3; world: number[]; }
interface MeshData { mesh: pc.MeshInstance; positions: number[]; normals: number[]; uvs: number[]; indices: number[]; pieces: Piece[]; }

/** Original GLBs intentionally batch by material. Recover disconnected authored
 * solids by welded positions, without changing the shared asset's buffers. */
function connectedPieces(mesh: pc.MeshInstance): MeshData {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  mesh.mesh.getPositions(positions); mesh.mesh.getNormals(normals); mesh.mesh.getUvs(0, uvs); mesh.mesh.getIndices(indices);
  const count = positions.length / 3, parents = Array.from({length: count}, (_, i) => i), weld = new Map<string, number>();
  const find = (a: number): number => { while (parents[a] !== a) { parents[a] = parents[parents[a]]; a = parents[a]; } return a; };
  const join = (a: number, b: number) => { a = find(a); b = find(b); if (a !== b) parents[b] = a; };
  const world: number[] = [], point = new pc.Vec3(), matrix = mesh.node.getWorldTransform();
  for (let i = 0; i < count; i++) {
    point.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]); matrix.transformPoint(point, point);
    world.push(point.x, point.y, point.z);
    const key = `${Math.round(point.x * 1e6)},${Math.round(point.y * 1e6)},${Math.round(point.z * 1e6)}`;
    const previous = weld.get(key); if (previous === undefined) weld.set(key, i); else join(i, previous);
  }
  for (let i = 0; i < indices.length; i += 3) {join(indices[i], indices[i + 1]); join(indices[i], indices[i + 2]);}
  const groups = new Map<number, number[]>();
  for (let i = 0; i < indices.length; i += 3) {const root = find(indices[i]); let group = groups.get(root); if (!group) groups.set(root, group = []); group.push(indices[i], indices[i + 1], indices[i + 2]);}
  const pieces = [...groups.values()].map(indices => {
    const min = new pc.Vec3(Infinity, Infinity, Infinity), max = new pc.Vec3(-Infinity, -Infinity, -Infinity);
    for (const i of indices) {point.set(world[i * 3], world[i * 3 + 1], world[i * 3 + 2]); min.min(point); max.max(point);}
    return {mesh, indices, min, max, world};
  });
  return {mesh, positions, normals, uvs, indices, pieces};
}
const isWheel = ({min, max}: Piece) => min.x > -.265 && max.x < .265 && min.y > .84 && max.y < 1.40 && min.z > .405 && max.z < .59;
const isColumn = ({min, max}: Piece) => min.x > -.07 && max.x < .07 && min.y < .61 && max.y > 1.07 && min.z > .40 && max.z < .68;

/** Find the actual left/right handle cross sections. Earlier kits include
 * pretzels, crescents and split fruit handles, so a guessed circular radius is
 * insufficient. Intersect each disconnected solid with the neutral grip plane
 * and use the outermost solid on each side, preserving its asymmetric shape. */
function wheelGrips(pieces: Piece[]) {
  return [-1, 1].map(side => {
    let best: {center: pc.Vec3; tube: number; edge: number} | undefined;
    for (const piece of pieces) {
      const points: pc.Vec3[] = [], p = piece.world;
      for (let t = 0; t < piece.indices.length; t += 3) for (let edge = 0; edge < 3; edge++) {
        const a = piece.indices[t + edge] * 3, b = piece.indices[t + (edge + 1) % 3] * 3;
        const ay = p[a + 1] - FOOD_WHEEL_CENTER.y, by = p[b + 1] - FOOD_WHEEL_CENTER.y;
        if (ay * by > 0 || Math.abs(ay - by) < 1e-10) continue;
        const alpha = ay / (ay - by), x = p[a] + (p[b] - p[a]) * alpha;
        if (x * side > .08) points.push(new pc.Vec3(x, FOOD_WHEEL_CENTER.y, p[a + 2] + (p[b + 2] - p[a + 2]) * alpha));
      }
      if (!points.length) continue;
      const min = new pc.Vec3(Infinity, Infinity, Infinity), max = new pc.Vec3(-Infinity, -Infinity, -Infinity);
      points.forEach(point => {min.min(point); max.max(point);});
      const edge = side < 0 ? -min.x : max.x;
      if (!best || edge > best.edge) best = {center: min.clone().add(max).mulScalar(.5).sub(FOOD_WHEEL_CENTER), tube: (max.x - min.x) / 2, edge};
    }
    if (!best || best.edge < .105 || best.edge > .26) throw new Error('Food wheel has no measurable left/right handle');
    return best;
  });
}

/** Short vertical probes measure the actual cushion, not the much lower
 * slot_seat_reference construction marker. The backrest and wheel are outside
 * this probe footprint. Use the median to ignore seeds, icing and leaf ridges. */
function seatSurface(data: MeshData[]) {
  const heights: number[] = [];
  for (const x of [-.16, -.075, 0, .075, .16]) for (const z of [-.12, -.06, 0, .06, .12]) {
    let height = -Infinity;
    for (const {pieces} of data) for (const piece of pieces) {
      if (piece.min.x > x || piece.max.x < x || piece.min.z > z || piece.max.z < z || piece.max.y < .56) continue;
      const p = piece.world, ii = piece.indices;
      for (let t = 0; t < ii.length; t += 3) {
        const a = ii[t] * 3, b = ii[t + 1] * 3, c = ii[t + 2] * 3;
        const ax = p[a], az = p[a + 2], bx = p[b], bz = p[b + 2], cx = p[c], cz = p[c + 2];
        const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(denominator) < 1e-10) continue;
        const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator;
        const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator;
        if (u < -1e-5 || v < -1e-5 || u + v > 1.00001) continue;
        const y = u * p[a + 1] + v * p[b + 1] + (1 - u - v) * p[c + 1];
        if (y > .56 && y < 1.23) height = Math.max(height, y);
      }
    }
    if (Number.isFinite(height)) heights.push(height);
  }
  if (heights.length < 3) throw new Error('Food chassis has no measurable seat cushion');
  heights.sort((a, b) => a - b); return heights[Math.floor(heights.length / 2)];
}

function between(from: pc.Vec3, to: pc.Vec3) {
  const a = from.clone().normalize(), b = to.clone().normalize(), dot = pc.math.clamp(a.dot(b), -1, 1);
  if (dot > .9999999) return new pc.Quat();
  if (dot < -.9999999) {const axis = new pc.Vec3().cross(a, Math.abs(a.x) < .8 ? pc.Vec3.RIGHT : pc.Vec3.UP).normalize(); return new pc.Quat().setFromAxisAngle(axis, 180);}
  const cross = new pc.Vec3().cross(a, b); return new pc.Quat(cross.x, cross.y, cross.z, 1 + dot).normalize();
}
function copyMesh(app: pc.AppBase, source: MeshData, selected: number[], transform?: (position: pc.Vec3, normal: pc.Vec3) => void) {
  const mesh = new pc.Mesh(app.graphicsDevice), remap = new Map<number, number>(), positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const p = new pc.Vec3(), n = new pc.Vec3();
  for (const original of selected) {
    let index = remap.get(original);
    if (index === undefined) {
      index = positions.length / 3; remap.set(original, index);
      p.set(source.positions[original * 3], source.positions[original * 3 + 1], source.positions[original * 3 + 2]);
      n.set(source.normals[original * 3] || 0, source.normals[original * 3 + 1] || 0, source.normals[original * 3 + 2] || 0);
      transform?.(p, n); positions.push(p.x, p.y, p.z); normals.push(n.x, n.y, n.z);
      if (source.uvs.length) uvs.push(source.uvs[original * 2], source.uvs[original * 2 + 1]);
    }
    indices.push(index);
  }
  mesh.setPositions(positions); mesh.setNormals(normals); if (uvs.length) mesh.setUvs(0, uvs); mesh.setIndices(indices); mesh.update(pc.PRIMITIVE_TRIANGLES); return mesh;
}

interface Arm { upper: pc.GraphNode; forearm: pc.GraphNode; hand: pc.GraphNode; grip: pc.GraphNode; }
function armsFor(model: pc.Entity): Arm[] {
  return ['L', 'R'].map(side => {
    const upper = model.findByName(`UpperArm.${side}`), forearm = model.findByName(`Forearm.${side}`), hand = model.findByName(`Hand.${side}`), grip = model.findByName(`Grip.${side}`) || model.findByName(`Grip${side}`);
    if (!upper || !forearm || !hand || !grip) throw new Error(`Driver is missing the ${side} cockpit fitting bones`);
    return {upper, forearm, hand, grip};
  });
}

const validatedModularDrivers = new WeakSet<DriverAsset>();
/** Run this before accepting a local import. A generic animated skinned mesh
 * can satisfy the original contract while lacking the cockpit's IK bones. */
export function validateModularDriverContract(driver: DriverAsset) {
  validateDriverContract(driver);
  if (validatedModularDrivers.has(driver)) return true;
  const model = instantiateRenderEntity(driver);
  try {
    if (!model.findByName('Pelvis')) throw new Error('Food kart driver needs a Pelvis bone and named UpperArm/Forearm/Hand/Grip bones');
    armsFor(model);
  } finally {model.destroy();}
  validatedModularDrivers.add(driver); return true;
}

/** Analytic two-bone IK keeps both bone lengths and authored finger curls. The
 * original elbow plane is the pole, and the sampled wrist orientation is kept. */
function fitArm(arm: Arm, targetGrip: pc.Vec3) {
  const {upper, forearm, hand, grip} = arm;
  const shoulder = upper.getPosition().clone(), elbow = forearm.getPosition().clone(), wrist = hand.getPosition().clone();
  const wristRotation = hand.getRotation().clone(), target = targetGrip.clone().sub(grip.getPosition().clone().sub(wrist));
  const first = shoulder.distance(elbow), second = elbow.distance(wrist), toward = target.clone().sub(shoulder), distance = toward.length();
  if (distance > first + second + .002 || distance < Math.abs(first - second) - .002) throw new Error('Food wheel is outside the driver arm reach');
  const d = pc.math.clamp(distance, Math.abs(first - second) + 1e-6, first + second - 1e-6), direction = toward.normalize();
  const pole = elbow.clone().sub(shoulder); pole.sub(direction.clone().mulScalar(pole.dot(direction)));
  if (pole.lengthSq() < 1e-10) pole.cross(direction, pc.Vec3.UP); pole.normalize();
  const along = (first * first - second * second + d * d) / (2 * d), across = Math.sqrt(Math.max(0, first * first - along * along));
  const newElbow = shoulder.clone().add(direction.clone().mulScalar(along)).add(pole.mulScalar(across));
  upper.setRotation(new pc.Quat().mul2(between(elbow.clone().sub(shoulder), newElbow.clone().sub(shoulder)), upper.getRotation()));
  const currentElbow = forearm.getPosition().clone(), currentWrist = hand.getPosition().clone();
  forearm.setRotation(new pc.Quat().mul2(between(currentWrist.sub(currentElbow), target.clone().sub(currentElbow)), forearm.getRotation()));
  hand.setRotation(wristRotation);
  return grip.getPosition().distance(targetGrip);
}

/** Rider-only cockpit adapter. Six original part roots stay aligned;
 * only the existing food steering solids are detached at runtime. The original
 * wheel is tilted and its original column extended to an ergonomic seated pose.
 * No source GLB, driver material, finger animation, or shared mesh is modified. */
export function createModularRacer(app: pc.AppBase, driver: DriverAsset, assembly: KartAssembly, {id = 'driver', color: _color = '#d2ff53'} = {}) {
  validateModularDriverContract(driver);
  const root = new pc.Entity(`ModularDriver_${id}`, app), model = instantiateRenderEntity(driver), mount = new pc.Entity('Measured seat mount', app), chassis = assembly.root;
  const ownedMeshes: pc.Mesh[] = [];
  root.addChild(chassis); root.addChild(mount); mount.addChild(model);
  let disposed = false;
  try {
    const animation = prepareAnimation(model, driver), arms = armsFor(model); animation.sample(0, 0);
    const pelvis = model.findByName('Pelvis'); if (!pelvis) throw new Error('Driver is missing its seated pelvis');
    const data = meshes(assembly.parts.chassis).map(connectedPieces), seatHeight = seatSurface(data);
    const offset = new pc.Vec3(0, seatHeight + HIP_CLEARANCE - pelvis.getPosition().y, -pelvis.getPosition().z);
    mount.setLocalPosition(offset);
    const wheelCenter = WHEEL_CENTER.clone().add(offset), wheel = new pc.Entity('FoodSteeringPivot', app); root.addChild(wheel); wheel.setLocalPosition(wheelCenter);
    const baseRotation = between(pc.Vec3.FORWARD.clone().mulScalar(-1), WHEEL_AXIS);
    const handles = wheelGrips(data.flatMap(item => item.pieces.filter(isWheel)));
    const rimRadius = handles.reduce((n, handle) => n + Math.abs(handle.center.x), 0) / 2, rimTube = handles.reduce((n, handle) => n + handle.tube, 0) / 2;
    const gripAnchors = arms.map(arm => {
      const original = arm.grip.getPosition().clone().sub(wheelCenter), side = original.x < 0 ? -1 : 1, handle = handles[side < 0 ? 0 : 1];
      const anchor = handle.center.clone(); anchor.x += side * Math.max(0, original.length() - ORIGINAL_RIM_RADIUS) * handle.tube / ORIGINAL_RIM_TUBE;
      return baseRotation.transformVector(anchor);
    });
    let wheelPieces = 0, columnPieces = 0, staticTriangles = 0, movingTriangles = 0;
    const columnOld = FOOD_WHEEL_CENTER.clone().sub(FOOD_COLUMN_BASE), columnNew = wheelCenter.clone().sub(FOOD_COLUMN_BASE), columnRotation = between(columnOld, columnNew);
    for (const item of data) {
      const rim = item.pieces.filter(isWheel), column = item.pieces.filter(piece => !isWheel(piece) && isColumn(piece));
      const fixed = item.pieces.filter(piece => !rim.includes(piece) && !column.includes(piece)).flatMap(piece => piece.indices);
      staticTriangles += fixed.length / 3;
      if (!rim.length && !column.length) continue;
      // Replacing only this MeshInstance keeps sibling actors and cached assets intact.
      if (fixed.length) {const replacement = copyMesh(app, item, fixed); ownedMeshes.push(replacement); item.mesh.mesh = replacement;} else item.mesh.visible = false;
      const matrix = item.mesh.node.getWorldTransform().clone();
      if (rim.length) {
        wheelPieces += rim.length;
        const selected = rim.flatMap(piece => piece.indices); movingTriangles += selected.length / 3;
        const mesh = copyMesh(app, item, selected, (p, n) => {matrix.transformPoint(p, p); p.sub(FOOD_WHEEL_CENTER); matrix.transformVector(n, n).normalize();}); ownedMeshes.push(mesh);
        const entity = new pc.Entity('Original food wheel material', app); wheel.addChild(entity); entity.addComponent('render', {meshInstances: [new pc.MeshInstance(mesh, item.mesh.material, entity)], castShadows: true, receiveShadows: true});
      }
      if (column.length) {
        columnPieces += column.length; const selected = column.flatMap(piece => piece.indices); movingTriangles += selected.length / 3;
        const mesh = copyMesh(app, item, selected, (p, n) => {
          matrix.transformPoint(p, p); p.sub(FOOD_COLUMN_BASE); const t = p.dot(columnOld) / columnOld.lengthSq();
          p.sub(columnOld.clone().mulScalar(t)); columnRotation.transformVector(p, p); p.add(columnNew.clone().mulScalar(t)).add(FOOD_COLUMN_BASE);
          matrix.transformVector(n, n); columnRotation.transformVector(n, n).normalize();
        }); ownedMeshes.push(mesh);
        const entity = new pc.Entity('Adjusted original food column', app); root.addChild(entity); entity.addComponent('render', {meshInstances: [new pc.MeshInstance(mesh, item.mesh.material, entity)], castShadows: true, receiveShadows: true});
      }
    }
    if (!wheelPieces || !columnPieces || rimRadius < .10 || rimRadius > .25) throw new Error(`Food chassis has no supported original steering geometry (${wheelPieces} wheel solids, ${columnPieces} columns, radius ${rimRadius.toFixed(4)})`);
    for (const mesh of meshes(model)) {mesh.castShadow = true; mesh.receiveShadow = true; if (mesh.skinInstance) mesh.cull = false;}
    const rollingWheels = ['LF', 'RF', 'LR', 'RR'].map(name => ({name, node: assembly.parts.wheels?.findByName(`Wheel_${name}_pivot`)})).filter(value => value.node).map(value => ({...value, base: value.node!.getLocalRotation().clone()}));
    const runtimeMeshBytes = ownedMeshes.reduce((sum, mesh) => sum + (mesh.vertexBuffer?.numBytes || 0) + (mesh.indexBuffer?.[0]?.numBytes || 0), 0);
    let steering = 0, animationTime = 0, maxGripError = 0, wheelSpin = 0;
    const apply = (dt: number) => {
      animation.sample(steering, dt);
      // Actor roots can already be translated/rotated by the race. Fit in world
      // coordinates while wheel and mount remain in the actor's local system.
      maxGripError = 0;
      const turn = new pc.Quat().setFromAxisAngle(WHEEL_AXIS, -steering * 18);
      for (let i = 0; i < arms.length; i++) {
        const localTarget = turn.transformVector(gripAnchors[i]).add(wheelCenter);
        const target = root.getWorldTransform().transformPoint(localTarget);
        maxGripError = Math.max(maxGripError, fitArm(arms[i], target));
      }
      wheel.setLocalRotation(new pc.Quat().mul2(baseRotation, new pc.Quat().setFromAxisAngle(new pc.Vec3(0, 0, 1), -steering * 18)));
      for (const rolling of rollingWheels) {
        const yaw = new pc.Quat().setFromAxisAngle(pc.Vec3.UP, rolling.name.endsWith('F') ? -steering * 18 : 0);
        const spin = new pc.Quat().setFromAxisAngle(pc.Vec3.RIGHT, wheelSpin * pc.math.RAD_TO_DEG);
        rolling.node!.setLocalRotation(new pc.Quat().mul2(rolling.base, new pc.Quat().mul2(yaw, spin)));
      }
    };
    const reset = () => {if (!disposed) {steering = 0; animationTime = 0; wheelSpin = 0; apply(0);}};
    reset();
    return {
      root, model, chassis, wheel,
      update(dt: number, input = 0, paused = false, signedSpeed = 0) {
        if (disposed || paused) return;
        const delta = Math.max(0, Number.isFinite(dt) ? dt : 0), target = pc.math.clamp(Number.isFinite(input) ? input : 0, -1, 1);
        steering += (target - steering) * (1 - Math.exp(-12 * delta)); if (Math.abs(steering - target) < 1e-5) steering = target;
        animationTime += delta; wheelSpin = (wheelSpin + delta * (Number.isFinite(signedSpeed) ? signedSpeed : 0) / .435) % (Math.PI * 2); apply(delta);
      }, reset,
      getState: () => ({status: disposed ? 'disposed' : 'ready', id, steering, wheelAngle: -steering * MAX_WHEEL_ANGLE, rangeTime: steering + 1, animationTime, animationMode: animation.mode, clips: [...DRIVER_CLIPS], weights: animation.mode === 'sampled-range' ? {Idle: 0, Steer_Left: 0, Steer_Right: 0, SteeringRange: 1} : {Idle: 1 - Math.abs(steering), Steer_Left: Math.max(0, -steering), Steer_Right: Math.max(0, steering), SteeringRange: 0}, wheelSpin, fit: {runtimeMeshCount: ownedMeshes.length, runtimeMeshBytes, seatHeight, hipClearance: HIP_CLEARANCE, wheelCenter: wheelCenter.toArray(), rimRadius, rimTube, maxGripError, wheelPieces, columnPieces, staticTriangles, movingTriangles}}),
      dispose() {if (disposed) return; disposed = true; root.destroy(); ownedMeshes.forEach(mesh => mesh.destroy()); assembly.dispose();},
    };
  } catch (error) {root.destroy(); ownedMeshes.forEach(mesh => mesh.destroy()); assembly.dispose(); throw error;}
}
