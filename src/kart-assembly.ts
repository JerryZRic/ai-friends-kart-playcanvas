import * as pc from 'playcanvas';
import { parseLocalGLB, instantiateRenderEntity, disposeDriverAsset, type DriverAsset } from './assets';
import { KART_SLOTS, resolveBuild, validateBuild, type KartBuild, type KartSlot } from './kart-build';
import { loadFoodKartPayload } from './food-kart-payload';
import { createKartTexturePool } from './kart-textures';

export interface KartAssemblyProgress {
  stage: 'loading' | 'preparing' | 'ready' | 'retrying';
  receivedBytes: number; totalBytes: number | null; cachedBytes?: number; completed: number; total: number;
  partId?: string; attempt?: number; retryInMs?: number;
}
export interface KartAssembly {
  root: pc.Entity;
  parts: Record<KartSlot, pc.Entity>;
  bounds: pc.BoundingBox;
  build: KartBuild;
  dispose(): void;
}
export interface KartAssemblyLoaderOptions {
  loadPayload?: (partId: string, options: {signal?: AbortSignal; onProgress?: (progress: any) => void}) => Promise<ArrayBuffer>;
  parse?: (buffer: ArrayBuffer, filename: string) => Promise<DriverAsset>;
  releaseAsset?: (asset: DriverAsset) => void;
  maxUnusedParts?: number;
}
function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');
}

/** Each module keeps the authored shared coordinate system (+Y up, +Z forward).
 * The assembly's identity root is the only race/preview positioning interface.
 * Containers own all borrowed meshes/materials; live instances pin their assets.
 */
export function createKartAssemblyLoader(app: pc.AppBase, options: KartAssemblyLoaderOptions = {}) {
  const loadPayload = options.loadPayload || loadFoodKartPayload;
  const texturePool = createKartTexturePool();
  const parse = options.parse || (async (buffer, filename) => {
    const asset = await parseLocalGLB(app, buffer, filename);
    try {await texturePool.adopt(asset, buffer); return asset;}
    catch (error) {texturePool.release(asset); disposeDriverAsset(asset); throw error;}
  });
  const releaseAsset = options.releaseAsset || (asset => {texturePool.release(asset); disposeDriverAsset(asset);});
  const maxUnused = Math.max(0, options.maxUnusedParts ?? 12);
  const assets = new Map<string, {asset: DriverAsset; references: number}>();
  const instances = new Set<KartAssembly>(), pending = new Set<Promise<unknown>>(), controllers = new Set<AbortController>();
  let closed = false, parseTail: Promise<unknown> = Promise.resolve();
  function prune() {
    const unused = [...assets].filter(([, value]) => value.references === 0);
    for (const [id, value] of unused.slice(0, Math.max(0, unused.length - (closed ? 0 : maxUnused)))) {
      assets.delete(id); releaseAsset(value.asset);
    }
  }
  function instantiate(input: KartBuild): KartAssembly {
    if (closed) throw new Error('Kart loader has been disposed');
    if (!validateBuild(input)) throw new Error('Kart needs one valid part in each of six slots');
    const build = resolveBuild(input), root = new pc.Entity('Modular food kart', app);
    const parts = {} as Record<KartSlot, pc.Entity>, pinned: string[] = [];
    try {
      for (const slot of KART_SLOTS) {
        const entry = assets.get(build[slot]);
        if (!entry) throw new Error(`Kart part is not loaded: ${build[slot]}`);
        entry.references++; pinned.push(build[slot]);
        const part = instantiateRenderEntity(entry.asset); part.name = `${slot}:${build[slot]}`;
        // Never fit or recenter a module individually: anchors belong to the kit.
        root.addChild(part); parts[slot] = part;
      }
      const bounds = new pc.BoundingBox(); let first = true;
      for (const render of root.findComponents('render') as pc.RenderComponent[]) for (const mesh of render.meshInstances) {
        mesh.castShadow = true; mesh.receiveShadow = true;
        if (first) { bounds.copy(mesh.aabb); first = false; } else bounds.add(mesh.aabb);
      }
      if (first || ![...bounds.center.toArray(), ...bounds.halfExtents.toArray()].every(Number.isFinite)) throw new Error('Kart geometry has no finite bounds');
      let disposed = false;
      const instance: KartAssembly = {root, parts, bounds, build, dispose() {
        if (disposed) return; disposed = true; root.destroy(); instances.delete(instance);
        for (const id of pinned) { const entry = assets.get(id); if (entry) entry.references--; }
        prune();
      }};
      instances.add(instance); return instance;
    } catch (error) {
      root.destroy(); for (const id of pinned) {const entry = assets.get(id); if (entry) entry.references--;}
      prune(); throw error;
    }
  }
  function load(input: KartBuild, {signal, onProgress = () => {}}: {signal?: AbortSignal; onProgress?: (state: KartAssemblyProgress) => void} = {}): Promise<KartAssembly> {
    if (closed) return Promise.reject(new Error('Kart loader has been disposed'));
    if (!validateBuild(input)) return Promise.reject(new Error('Kart needs six valid part IDs'));
    const build = resolveBuild(input), controller = new AbortController(); controllers.add(controller);
    const cancel = () => controller.abort(signal?.reason); signal?.addEventListener('abort', cancel, {once: true});
    if (signal?.aborted) cancel();
    const currentSignal = controller.signal, states = new Map<string, {receivedBytes: number; totalBytes: number | null; cachedBytes?: number}>();
    const pins: string[] = []; let completed = 0;
    const emit = (stage: KartAssemblyProgress['stage'], extra: Partial<KartAssemblyProgress> = {}) => {
      if (closed || currentSignal.aborted) return;
      const values = [...states.values()];
      onProgress({stage, cachedBytes: values.reduce((n, value) => n + (value.cachedBytes || 0), 0), receivedBytes: values.reduce((n, value) => n + value.receivedBytes, 0), totalBytes: values.length === KART_SLOTS.length && values.every(value => value.totalBytes !== null) ? values.reduce((n, value) => n + value.totalBytes!, 0) : null, completed, total: KART_SLOTS.length, ...extra});
    };
    const work = (async () => {
      try {
        // Sequential payloads avoid a six-texture decode spike on mobile. Races
        // may load several assemblies; the parser is serialized across them.
        for (const slot of KART_SLOTS) {
          checkAbort(currentSignal); const id = build[slot]; let entry = assets.get(id);
          if (!entry) {
            states.set(id, {receivedBytes: 0, totalBytes: null}); emit('loading', {partId: id});
            const buffer = await loadPayload(id, {signal: currentSignal, onProgress: progress => {
              if (currentSignal.aborted) return;
              states.set(id, {receivedBytes: progress.receivedBytes || 0, totalBytes: progress.totalBytes ?? null, cachedBytes: progress.cachedBytes || 0});
              emit(progress.stage === 'retry' ? 'retrying' : 'loading', {partId: id, attempt: progress.attempt, retryInMs: progress.retryInMs});
            }});
            checkAbort(currentSignal); emit('preparing', {partId: id});
            const parsing = parseTail.catch(() => {}).then(async () => {
              checkAbort(currentSignal);
              // Another concurrently prepared racer may already own this part.
              if (assets.has(id)) return null;
              return parse(buffer, `${id.replace(/[^a-z0-9_-]/gi, '_')}.glb`);
            });
            parseTail = parsing; const parsed = await parsing;
            if (closed || currentSignal.aborted) { if (parsed) releaseAsset(parsed); checkAbort(currentSignal); throw new Error('Kart loader has been disposed'); }
            if (parsed) assets.set(id, {asset: parsed, references: 0});
            entry = assets.get(id);
            if (!entry) throw new Error(`Part parser returned no model: ${id}`);
          } else states.set(id, {receivedBytes: 0, totalBytes: 0});
          // Pin partially loaded batches so concurrent load/instance disposal
          // cannot evict a module before the complete assembly is instantiated.
          entry.references++; pins.push(id); completed++; emit('preparing', {partId: id});
        }
        checkAbort(currentSignal); const instance = instantiate(build); emit('ready'); return instance;
      } finally {
        signal?.removeEventListener('abort', cancel); controllers.delete(controller);
        for (const id of pins) {const entry = assets.get(id); if (entry) entry.references--;}
        prune();
      }
    })();
    pending.add(work); void work.then(() => pending.delete(work), () => pending.delete(work)); return work;
  }
  return {load, instantiate, get cachedParts() {return assets.size;}, get liveInstances() {return instances.size;}, textureStats: texturePool.stats, async dispose() {
    if (!closed) {closed = true; for (const controller of controllers) controller.abort(); for (const instance of [...instances]) instance.dispose();}
    await Promise.allSettled([...pending]); prune();
  }};
}

/** The preview camera fits the complete assembly, never rewrites part transforms. */
export function kartAssemblyCamera(bounds: pc.BoundingBox, aspect = 1, yaw = 35, pitch = 22, zoom = 1) {
  const safeAspect = Math.max(.2, Number.isFinite(aspect) ? aspect : 1), fov = 34;
  const radius = Math.max(.25, bounds.halfExtents.length()), limitingHalfFov = Math.min(fov * Math.PI / 360, Math.atan(Math.tan(fov * Math.PI / 360) * safeAspect));
  const distance = radius / Math.sin(limitingHalfFov) * 1.04 * pc.math.clamp(zoom, .72, 1.8);
  const y = yaw * Math.PI / 180, p = pc.math.clamp(pitch, 4, 78) * Math.PI / 180;
  const target = bounds.center.clone();
  return {target, position: target.clone().add(new pc.Vec3(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)).mulScalar(distance)), fov, nearClip: Math.max(.01, distance - radius * 1.6), farClip: distance + radius * 4};
}
