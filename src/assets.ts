import * as pc from 'playcanvas';
import { gunzipSync } from 'fflate';
import manifest from '../docs/runtime-models.json';
import { DRIVERS } from './driver-roster.js';
import { fetchWithRetry, fetchStream } from './asset-download.js';
import { MAX_IMPORT_BYTES, validateGLB } from './asset-validation';
export { MAX_IMPORT_BYTES, validateGLB } from './asset-validation';

/** All assets remain owned by this container; actors borrow geometry and textures. */
export interface DriverAsset {
  asset: pc.Asset<'container'>;
  resource: pc.ContainerResource;
  animations: pc.Asset[];
  metadata: any;
  bytes: number;
  disposed?: boolean;
}
export const CHASSIS_ASSET = 'assets/kart-r12-chassis.glb';
export const COURSE_FILES = Object.freeze([
  { id: 'kart', label: '原创卡丁车', path: 'assets/kart.glb' },
  { id: 'palm', label: '海岛棕榈', path: 'assets/palm.glb' },
  { id: 'rock', label: '海岸岩石', path: 'assets/rock.glb' },
  { id: 'arch', label: '起点拱门', path: 'assets/arch.glb' },
  { id: 'chassis', label: '角色底盘', path: CHASSIS_ASSET },
]);
export const RUNTIME_MODELS = Object.freeze(manifest.assets.map(record => Object.freeze({ ...record })));
export const DRIVER_CLIPS = Object.freeze(['Idle', 'Steer_Left', 'Steer_Right']);
export const MAX_WHEEL_ANGLE = Math.PI / 10;
export const WHEEL_CENTER = new pc.Vec3(0, 1.105, .30);
export const WHEEL_AXIS = new pc.Vec3(0, Math.cos(43 * Math.PI / 180), Math.sin(43 * Math.PI / 180));
const CLIP_ALIASES: Record<string, string[]> = { Idle: ['Idle', 'DriveIdle'], Steer_Left: ['Steer_Left', 'SteerLeft'], Steer_Right: ['Steer_Right', 'SteerRight'] };
const slotIds = new Set(DRIVERS.map(driver => driver.id));
const validated = new WeakSet<DriverAsset>();
function requireSlot(id: string) { if (!slotIds.has(id)) throw new Error('Unknown driver slot'); return id; }
const taskYield = () => new Promise(resolve => setTimeout(resolve, 0));

/** Validate first, then use a local blob + explicit .glb filename so the parser never guesses .gz.
 * file.contents avoids a second network request. Embedded dependencies are the only permitted URIs.
 */
export async function parseLocalGLB(app: pc.AppBase, buffer: ArrayBuffer, filename = 'local-driver.glb'): Promise<DriverAsset> {
  const metadata = validateGLB(buffer);
  const name = filename.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/\.gz$/i, '');
  const blobUrl = URL.createObjectURL(new Blob([buffer], { type: 'model/gltf-binary' }));
  const asset = new pc.Asset(name, 'container', { url: blobUrl, filename: /\.glb$/i.test(name) ? name : `${name}.glb`, contents: buffer });
  app.assets.add(asset);
  // Container construction happens after texture loading. If later parsing
  // fails, those image subassets otherwise have no owning container to unload.
  const parsedImages = new Set<pc.Asset>();
  const imageOptions = (asset.options as any).image || {};
  const postprocess = imageOptions.postprocess;
  (asset.options as any).image = { ...imageOptions, postprocess(image: unknown, texture: pc.Asset) { parsedImages.add(texture); postprocess?.(image, texture); } };
  try {
    await new Promise<void>((resolve, reject) => {
      const loaded = () => { asset.off('error', failed); resolve(); };
      const failed = (error: unknown) => { asset.off('load', loaded); reject(new Error(String(error))); };
      asset.once('load', loaded); asset.once('error', failed);
      app.assets.load(asset);
    });
    if (!asset.resource?.instantiateRenderEntity) throw new Error('GLB has no PlayCanvas container');
    return { asset, resource: asset.resource, animations: asset.resource.animations, metadata, bytes: buffer.byteLength };
  } catch (error) {
    asset.unload(); app.assets.remove(asset);
    for (const texture of parsedImages) if (texture.registry) { texture.unload(); app.assets.remove(texture); }
    throw error;
  } finally { URL.revokeObjectURL(blobUrl); }
}

export function instantiateRenderEntity(asset: DriverAsset): pc.Entity {
  if (!asset?.resource || asset.disposed) throw new Error('Model is unavailable');
  return asset.resource.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
}
export function disposeDriverAsset(asset: DriverAsset) {
  if (!asset || asset.disposed) return;
  asset.disposed = true;
  const registry = asset.asset.registry;
  asset.asset.unload(); registry?.remove(asset.asset);
}
function animationTrack(asset: DriverAsset, name: string): pc.AnimTrack | undefined {
  return asset.animations.map(animation => animation.resource).find(track => track instanceof pc.AnimTrack && (CLIP_ALIASES[name] || [name]).includes(track.name)) as pc.AnimTrack | undefined;
}
function meshInstances(entity: pc.Entity): pc.MeshInstance[] {
  return (entity.findComponents('render') as pc.RenderComponent[]).flatMap(render => render.meshInstances);
}

/** Use the engine's skeleton-aware instantiation, never Entity.clone() for a borrowed rig. */
function prepareAnimation(model: pc.Entity, driver: DriverAsset) {
  model.addComponent('anim', { activate: false, enabled: false });
  const anim = model.anim!;
  const range = animationTrack(driver, 'SteeringRange');
  if (range) {
    for (const name of DRIVER_CLIPS) anim.assignAnimation(name, animationTrack(driver, name)!);
    anim.assignAnimation('SteeringRange', range, undefined, 0, false);
    anim.baseLayer.play('SteeringRange');
    anim.update(0);
    return { mode: 'sampled-range', sample(steering: number, _dt: number) { anim.baseLayer.activeStateCurrentTime = (steering + 1) * range.duration / 2; anim.update(0); } };
  }
  anim.loadStateGraph({ layers: [{ name: 'Base', states: [
    { name: 'START' },
    { name: 'Drive', speed: 1, loop: true, blendTree: { type: pc.ANIM_BLEND_1D, parameter: 'steer', children: [
      { name: 'Steer_Left', point: -1 }, { name: 'Idle', point: 0 }, { name: 'Steer_Right', point: 1 },
    ] } },
  ], transitions: [{ from: 'START', to: 'Drive' }] }], parameters: { steer: { type: pc.ANIM_PARAMETER_FLOAT, value: 0 } } });
  for (const name of DRIVER_CLIPS) anim.assignAnimation(`Drive.${name}`, animationTrack(driver, name)!);
  anim.baseLayer.play('Drive');
  anim.update(0);
  return { mode: 'three-clip-blend', sample(steering: number, dt: number) { anim.setFloat('steer', steering); anim.update(dt); } };
}

export function validateDriverContract(driver: DriverAsset) {
  if (!driver?.resource?.instantiateRenderEntity || !Array.isArray(driver.animations)) throw new Error('GLB has no driver container and animations');
  if (validated.has(driver)) return true;
  const legacyFormat = driver.animations.some(animation => (animation.resource as pc.AnimTrack)?.name === 'DriveIdle');
  const required = legacyFormat ? [...DRIVER_CLIPS, 'SteeringDemo', 'SteeringRange'] : DRIVER_CLIPS;
  for (const name of required) {
    const track = animationTrack(driver, name);
    if (!track || !track.curves.length || !Number.isFinite(track.duration) || track.duration <= 0) throw new Error(`Driver is missing the ${name} animation`);
    for (const data of [...track.inputs, ...track.outputs]) if (!data.data.length || !Array.from(data.data).every(Number.isFinite)) throw new Error(`Invalid animation data in ${name}`);
  }
  const instance = instantiateRenderEntity(driver);
  try {
    // PlayCanvas returns the authored GLB root directly, unlike Three's identity
    // scene wrapper. Its authored fitting transform must remain intact. The race
    // actor creates an identity outer mount and never rewrites this transform.
    const skins = meshInstances(instance).filter(mesh => mesh.skinInstance);
    if (!skins.length) throw new Error('Driver needs at least one rigged SkinnedMesh');
    const nodes = new Set<pc.GraphNode>(); const walk = (node: pc.GraphNode) => {
      const p = node.getLocalPosition(), q = node.getLocalRotation(), s = node.getLocalScale();
      if (![p.x,p.y,p.z,q.x,q.y,q.z,q.w,s.x,s.y,s.z].every(Number.isFinite)) throw new Error('Driver node transform contains non-finite values');
      nodes.add(node); node.children.forEach(walk);
    }; walk(instance);
    for (const mesh of skins) {
      const skin = mesh.skinInstance;
      if (!skin.bones.length || !skin.bones.every(bone => nodes.has(bone))) throw new Error('Driver skin refers to bones outside its scene');
      if (!mesh.mesh.skin.inverseBindPose.every(matrix => Array.from(matrix.data).every(Number.isFinite))) throw new Error('Invalid driver bind matrices');
      const positions: number[] = [], indices: number[] = [], weights: number[] = [];
      const count = mesh.mesh.getPositions(positions);
      mesh.mesh.getVertexStream(pc.SEMANTIC_BLENDINDICES, indices); mesh.mesh.getVertexStream(pc.SEMANTIC_BLENDWEIGHT, weights);
      if (positions.length !== count * 3 || indices.length !== count * 4 || weights.length !== count * 4 || !positions.every(Number.isFinite)) throw new Error('Driver needs valid four-influence skin attributes');
      for (let i = 0; i < count; i++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          const index = indices[i * 4 + k], weight = weights[i * 4 + k];
          if (!Number.isInteger(index) || index < 0 || index >= skin.bones.length || !Number.isFinite(weight) || weight < 0 || weight > 1) throw new Error('Invalid driver bone weights');
          sum += weight;
        }
        if (Math.abs(sum - 1) > .01) throw new Error('Driver skin weights must be normalized');
      }
    }
    const range = animationTrack(driver, 'SteeringRange');
    if (range) {
      if (Math.abs(range.duration - 2) > 1e-6) throw new Error('SteeringRange must be exactly two seconds');
      const grips = ['L', 'R'].map(side => instance.findByName(`Grip${side}`) || instance.findByName(`Grip.${side}`));
      if (!grips.every(Boolean)) throw new Error('Driver needs authored GripL/GripR (or Grip.L/Grip.R) markers');
      const animation = prepareAnimation(instance, driver);
      animation.sample(0, 0);
      const neutral = grips.map(grip => grip.getPosition().clone().sub(WHEEL_CENTER));
      if (neutral.some(offset => offset.clone().sub(WHEEL_AXIS.clone().mulScalar(offset.dot(WHEEL_AXIS))).length() < .01)) throw new Error('Grip markers must be offset from the steering axis');
      const rotation = new pc.Quat();
      for (const steering of [-1, -.5, 0, .5, 1]) {
        animation.sample(steering, 0);
        rotation.setFromAxisAngle(WHEEL_AXIS, -steering * 18);
        for (let i = 0; i < grips.length; i++) {
          const expected = rotation.transformVector(neutral[i]).add(WHEEL_CENTER);
          if (grips[i].getPosition().distance(expected) > .02) throw new Error('SteeringRange grip motion must follow the original wheel through ±18 degrees');
        }
      }
    }
  } finally { instance.destroy(); }
  validated.add(driver); return true;
}

export function createImportedRacer(app: pc.AppBase, driver: DriverAsset, kart: DriverAsset, { id = 'driver', color = '#d2ff53' } = {}) {
  validateDriverContract(driver);
  const root = new pc.Entity(`Driver_${id}`, app), model = instantiateRenderEntity(driver), chassis = instantiateRenderEntity(kart);
  root.addChild(chassis); root.addChild(model);
  const wheel = chassis.findByName('SteeringPivot');
  if (!wheel) { root.destroy(); throw new Error('Chassis is missing SteeringPivot'); }
  const ownedMaterials: pc.Material[] = [];
  for (const mesh of meshInstances(model)) { mesh.castShadow = true; mesh.receiveShadow = true; if (mesh.skinInstance) mesh.cull = false; }
  for (const mesh of meshInstances(chassis)) {
    const material = mesh.material.clone(); mesh.material = material; ownedMaterials.push(material);
    if (/^(body|paint)$/i.test(material.name) && material instanceof pc.StandardMaterial) { material.diffuse.fromString(color); material.update(); }
  }
  const animation = prepareAnimation(model, driver);
  const wheelBase = wheel.getLocalRotation().clone(), turn = new pc.Quat();
  const wheelAxis = wheel.getRotation().clone().invert().transformVector(WHEEL_AXIS).normalize();
  let steering = 0, disposed = false, animationTime = 0;
  const apply = (dt: number) => {
    animation.sample(steering, dt);
    turn.setFromAxisAngle(wheelAxis, -steering * 18);
    wheel.setLocalRotation(new pc.Quat().mul2(wheelBase, turn));
  };
  const reset = () => { if (!disposed) { steering = 0; animationTime = 0; apply(0); } };
  reset();
  return {
    root, model, chassis, wheel,
    update(dt: number, input = 0, paused = false) {
      if (disposed || paused) return;
      const delta = Math.max(0, Number.isFinite(dt) ? dt : 0), target = pc.math.clamp(Number.isFinite(input) ? input : 0, -1, 1);
      steering += (target - steering) * (1 - Math.exp(-12 * delta));
      if (Math.abs(steering - target) < 1e-5) steering = target;
      animationTime += delta; apply(delta);
    }, reset,
    getState: () => ({ status: disposed ? 'disposed' : 'ready', id, steering, wheelAngle: -steering * MAX_WHEEL_ANGLE, rangeTime: steering + 1, animationTime, animationMode: animation.mode, clips: [...DRIVER_CLIPS], weights: animation.mode === 'sampled-range' ? { Idle: 0, Steer_Left: 0, Steer_Right: 0, SteeringRange: 1 } : { Idle: 1 - Math.abs(steering), Steer_Left: Math.max(0, -steering), Steer_Right: Math.max(0, steering), SteeringRange: 0 } }),
    dispose() { if (disposed) return; disposed = true; root.destroy(); ownedMaterials.forEach(material => material.destroy()); },
  };
}

async function checkIdentity(buffer: ArrayBuffer, bytes: number, sha256: string, label: string) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== bytes) throw new Error(`${label} size differs from its public manifest`);
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== sha256) throw new Error(`${label} checksum differs from its public manifest`);
}
export async function decodeRuntimeBuffer(buffer: ArrayBuffer, record: typeof RUNTIME_MODELS[number]) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 4) throw new Error('Runtime model is truncated');
  const bytes = new Uint8Array(buffer), view = new DataView(buffer); let decoded: ArrayBuffer;
  if (view.getUint32(0, true) === 0x46546c67) decoded = buffer;
  else if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    await checkIdentity(buffer, record.bytes, record.sha256, 'Compressed runtime model');
    try { const unzipped = gunzipSync(bytes); decoded = unzipped.buffer.slice(unzipped.byteOffset, unzipped.byteOffset + unzipped.byteLength) as ArrayBuffer; }
    catch { throw new Error('Runtime model gzip could not be decoded'); }
  } else throw new Error('Runtime model is neither a GLB nor a gzip archive');
  await checkIdentity(decoded, record.decodedBytes, record.decodedSha256, 'Decoded runtime model');
  validateGLB(decoded); return decoded;
}
export interface LoadOptions {
  existing?: Map<string, DriverAsset>; existingDrivers?: Map<string, DriverAsset>;
  onStatus?: (status: any) => void; onProgress?: (status: any) => void;
  fetchAsset?: typeof fetchStream; parse?: (buffer: ArrayBuffer) => Promise<DriverAsset>;
  validate?: (asset: DriverAsset) => any; maxConcurrent?: number; timeoutMs?: number; maxAttempts?: number;
  random?: () => number; wait?: any; signal?: AbortSignal;
}
async function loadAssets(app: pc.AppBase, runtime: boolean, options: LoadOptions = {}) {
  const { fetchAsset = fetchStream, parse = buffer => parseLocalGLB(app, buffer), validate = validateDriverContract, onProgress = () => {}, onStatus = () => {}, maxConcurrent = 2, timeoutMs = 60000, maxAttempts = 4, random, wait, signal } = options;
  const assets = new Map(options.existingDrivers || options.existing || []), failures = new Map<string, string>();
  const files = runtime ? RUNTIME_MODELS : COURSE_FILES;
  const states = new Map<string, any>(files.map(record => [record.id, { ...record, stage: assets.has(record.id) ? 'ready' : 'queued', receivedBytes: assets.has(record.id) ? (assets.get(record.id)?.bytes || ('bytes' in record ? record.bytes : 0)) : 0, totalBytes: assets.get(record.id)?.bytes || ('bytes' in record ? record.bytes : 0), attempt: 0, maxAttempts: Math.max(1, Math.min(4, maxAttempts)), retryInMs: 0 } as any] as [string, any]));
  const pending = files.filter(record => !assets.has(record.id)); let next = 0, completed = files.length - pending.length;
  const emit = () => { const records = [...states.values()].map(value => ({ ...value })); onStatus({ phase: runtime ? 'drivers' : 'course', records, receivedBytes: records.reduce((sum, r) => sum + r.receivedBytes, 0), totalBytes: records.every(r => r.totalBytes > 0) ? records.reduce((sum, r) => sum + r.totalBytes, 0) : null, completed, total: files.length, loaded: assets.size, failed: failures.size }); };
  const update = (id: string, patch: any) => { Object.assign(states.get(id), patch); emit(); };
  emit();
  async function worker() {
    while (next < pending.length && !signal?.aborted) {
      const record = pending[next++]; let asset: DriverAsset;
      try {
        const buffer = await (fetchWithRetry as any)(record.path, {
          fetchAsset, timeoutMs, maxAttempts, random, wait, signal,
          expectedBytes: 'bytes' in record ? record.bytes : undefined, decodedBytes: 'decodedBytes' in record ? record.decodedBytes : undefined,
          onAttempt: value => update(record.id, { ...value, stage: 'downloading', receivedBytes: 0, retryInMs: 0 }),
          onProgress: value => update(record.id, value), onRetry: value => update(record.id, { ...value, stage: 'waiting' }),
        });
        update(record.id, { stage: runtime ? 'decompressing' : 'preparing', receivedBytes: buffer.byteLength, totalBytes: buffer.byteLength });
        await taskYield();
        const decoded = runtime ? await decodeRuntimeBuffer(buffer, record as typeof RUNTIME_MODELS[number]) : buffer;
        if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');
        update(record.id, { stage: 'preparing' }); await taskYield();
        asset = await parse(decoded); if (runtime) await validate(asset);
        if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');
        asset.bytes = buffer.byteLength; assets.set(record.id, asset); asset = null;
        update(record.id, { stage: 'ready' });
      } catch (error) {
        if (asset) disposeDriverAsset(asset);
        const message = error instanceof Error ? error.message : 'Unable to load model';
        failures.set(record.id, message); update(record.id, { stage: 'failed', error: message, retryInMs: 0 });
      } finally { completed++; emit(); onProgress({ id: record.id, completed, total: files.length, loaded: assets.size, failed: failures.size }); }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(2, Math.floor(maxConcurrent) || 2)) }, worker));
  return { assets, drivers: assets, failures };
}
export const loadBundledDrivers = (app: pc.AppBase, options: LoadOptions = {}) => loadAssets(app, true, options);
export const loadCourseAssets = (app: pc.AppBase, options: LoadOptions = {}) => loadAssets(app, false, options);
export interface LocalStoreOptions {
  parse?: (buffer: ArrayBuffer) => Promise<DriverAsset>; validate?: (asset: DriverAsset) => any; dispose?: (asset: DriverAsset) => void;
  onBusy?: (busy: boolean, pending: number) => void; onChange?: (change: {slotId: string; asset?: DriverAsset; previous?: DriverAsset}) => void;
  canImport?: () => boolean; maxConcurrent?: number;
}
export function resolveImportSlot(filename, selectedId, multiple = false) {
  requireSlot(selectedId);
  if (!multiple) return selectedId;
  const tokens = String(filename).toLowerCase().replace(/\.glb$/i, '').split(/[^a-z0-9]+/);
  const found = DRIVERS.filter(driver => tokens.includes(driver.id));
  if (found.length !== 1) throw new Error('For multiple files, name each GLB with exactly one slot ID: whale, gemini, gpt, claude, grok, glm');
  return found[0].id;
}

// This store owns parsed asset resources. Controllers only borrow them. Before
// replacing an asset, onChange releases its controllers synchronously; only then
// can the previous geometries/materials/textures be disposed.
export function createLocalDriverStore(app: pc.AppBase, { parse = (buffer: ArrayBuffer) => parseLocalGLB(app, buffer), validate = validateDriverContract, dispose = disposeDriverAsset, onBusy = () => {}, onChange = () => {}, canImport = () => true, maxConcurrent = 2 }: LocalStoreOptions = {}) {
  const assets = new Map<string, DriverAsset>(), versions = new Map<string, number>(), queue: Array<() => Promise<void>> = [];
  const limit = Math.max(1, Math.min(2, Math.floor(maxConcurrent) || 2));
  let active = 0, pending = 0, closed = false;
  const notifyBusy = () => onBusy(pending > 0, pending);
  function pump() {
    while (active < limit && queue.length) {
      active++;
      const task = queue.shift();
      task().finally(() => { active--; pump(); });
    }
  }
  function stale(id, version) { return closed || versions.get(id) !== version; }
  function importFile(file, slotId) {
    try { requireSlot(slotId); if (closed) throw new Error('Local import session is closed'); if (!canImport()) throw new Error('Import drivers from the menu after the race'); }
    catch (error) { return Promise.reject(error); }
    const version = (versions.get(slotId) || 0) + 1;
    versions.set(slotId, version);
    pending++; notifyBusy();
    return new Promise<{status: string; slotId: string}>((resolve, reject) => {
      queue.push(async () => {
        let asset = null;
        try {
          if (stale(slotId, version)) { resolve({ status: 'stale', slotId }); return; }
          if (!file || typeof file.name !== 'string' || !/\.glb$/i.test(file.name) || typeof file.arrayBuffer !== 'function') throw new Error('Select a .glb file');
          if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_IMPORT_BYTES) throw new Error('GLB must be nonempty and at most 32 MiB');
          const buffer = await file.arrayBuffer();
          if (stale(slotId, version)) { resolve({ status: 'stale', slotId }); return; }
          if (buffer.byteLength !== file.size) throw new Error('GLB file size changed while reading');
          validateGLB(buffer);
          asset = await parse(buffer);
          if (stale(slotId, version)) { dispose(asset); asset = null; resolve({ status: 'stale', slotId }); return; }
          await validate(asset);
          if (stale(slotId, version) || !canImport()) { dispose(asset); asset = null; resolve({ status: 'stale', slotId }); return; }
          const previous = assets.get(slotId);
          assets.set(slotId, asset);
          try { onChange({ slotId, asset, previous }); }
          catch (error) { if (previous) assets.set(slotId, previous); else assets.delete(slotId); throw error; }
          asset = null;
          if (previous) dispose(previous);
          resolve({ status: 'imported', slotId });
        } catch (error) { if (asset) dispose(asset); reject(error); }
        finally { pending--; notifyBusy(); }
      });
      pump();
    });
  }
  return {
    importFile,
    importFiles(files: Iterable<File> | ArrayLike<File>, selectedId: string) {
      const chosen = Array.from(files || []);
      return Promise.allSettled(chosen.map(file => {
        try { return importFile(file, resolveImportSlot(file.name, selectedId, chosen.length > 1)); }
        catch (error) { return Promise.reject(error); }
      }));
    },
    get: id => assets.get(id),
    has: id => assets.has(id),
    get busy() { return pending > 0; },
    get pending() { return pending; },
    clear(slotId) {
      requireSlot(slotId);
      if (closed || !canImport()) return false;
      versions.set(slotId, (versions.get(slotId) || 0) + 1);
      const previous = assets.get(slotId);
      assets.delete(slotId);
      try { onChange({ slotId, asset: undefined, previous }); }
      catch (error) { if (previous) assets.set(slotId, previous); throw error; }
      if (previous) dispose(previous);
      return true;
    },
    dispose() {
      if (closed) return;
      closed = true;
      for (const [slotId, previous] of assets) { onChange({ slotId, asset: undefined, previous }); dispose(previous); }
      assets.clear();
    },
  };
}
