import * as pc from 'playcanvas';
import { RUNTIME_MODELS, decodeRuntimeBuffer, parseLocalGLB, instantiateRenderEntity, validateDriverContract, disposeDriverAsset, type DriverAsset } from './assets';
import { fetchWithRetry } from './asset-download.js';
import { resolveCharacter } from './character-profiles';
import { readGameSettings } from './game-settings';

/** Only verified CPU bytes survive menu navigation. No app, texture, mesh or rig
 * is cached across WebGL contexts. Two entries / 36 MiB is a hard upper bound. */
export function createPreviewBufferCache(maxEntries = 2, maxBytes = 36 * 1024 * 1024) {
  const buffers = new Map<string, ArrayBuffer>();
  let bytes = 0;
  return {
    get(id: string) {
      const buffer = buffers.get(id);
      if (buffer) { buffers.delete(id); buffers.set(id, buffer); }
      return buffer;
    },
    set(id: string, buffer: ArrayBuffer) {
      const previous = buffers.get(id);
      if (previous) { bytes -= previous.byteLength; buffers.delete(id); }
      if (buffer.byteLength > maxBytes || maxEntries < 1) return;
      buffers.set(id, buffer); bytes += buffer.byteLength;
      while (buffers.size > maxEntries || bytes > maxBytes) {
        const oldest = buffers.keys().next().value!;
        bytes -= buffers.get(oldest)!.byteLength; buffers.delete(oldest);
      }
    },
    clear() { buffers.clear(); bytes = 0; },
    get size() { return buffers.size; },
    get bytes() { return bytes; },
  };
}
const previewBuffers = createPreviewBufferCache();
const aborted = (signal: AbortSignal) => { if (signal.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError'); };
export type PreviewState = { stage: 'loading' | 'preparing' | 'ready' | 'failed' | 'disposed'; driver: string; progress?: number; error?: unknown };

/** Fetch exactly one manifest record; never invokes the all-driver race loader. */
export async function loadCharacterPreviewBuffer(id: string, signal: AbortSignal, onState: (state: PreviewState) => void = () => {}, cache = previewBuffers, fetchAsset?: any) {
  const record = RUNTIME_MODELS.find(record => record.id === id);
  if (!record) throw new Error('Unknown preview character');
  aborted(signal);
  const cached = cache.get(id);
  if (cached) return cached;
  const buffer = await (fetchWithRetry as any)(record.path, {
    signal, ...(fetchAsset ? {fetchAsset} : {}), maxAttempts: 2, timeoutMs: 45000,
    expectedBytes: record.bytes, decodedBytes: record.decodedBytes,
    onProgress: ({receivedBytes, totalBytes}) => onState({stage: 'loading', driver: id, progress: totalBytes ? Math.min(1, receivedBytes / totalBytes) : undefined}),
  });
  aborted(signal); onState({stage: 'preparing', driver: id});
  const decoded = await decodeRuntimeBuffer(buffer as ArrayBuffer, record);
  aborted(signal); cache.set(id, decoded);
  return decoded;
}

function allMeshes(model: pc.Entity) { return (model.findComponents('render') as pc.RenderComponent[]).flatMap(component => component.meshInstances); }

/** A rotation-invariant sphere fit keeps every character in frame, including at
 * narrow mobile aspect ratios. Near/far planes adapt to its actual posed size. */
export function characterPreviewCamera(bounds: pc.BoundingBox, aspect = 1, fov = 34) {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const vertical = fov * Math.PI / 180;
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * safeAspect);
  const radius = Math.max(.15, bounds.halfExtents.length());
  const distance = radius / Math.sin(Math.min(vertical, horizontal) / 2) * 1.07;
  const target = bounds.center.clone();
  return { target, position: target.clone().add(new pc.Vec3(0, .045, 1).normalize().mulScalar(distance)), distance, radius, fov, nearClip: Math.max(.01, distance - radius * 1.3), farClip: distance + radius * 3 };
}

/** Uses the real authored skin and idle track. The identity mount preserves the
 * GLB root fitting transform and rotates the whole skeleton, never a mesh clone. */
export function createCharacterPreviewModel(app: pc.AppBase, asset: DriverAsset) {
  validateDriverContract(asset);
  const root = new pc.Entity('Selected character preview', app), centered = new pc.Entity('Preview center', app);
  const model = instantiateRenderEntity(asset);
  root.addChild(centered); centered.addChild(model); app.root.addChild(root);
  let destroyed = false;
  try {
    const idle = asset.animations.map(asset => asset.resource).find(track => track instanceof pc.AnimTrack && ['Idle', 'DriveIdle'].includes(track.name)) as pc.AnimTrack | undefined;
    if (!idle) throw new Error('Character has no idle animation');
    model.addComponent('anim', {activate: false, enabled: false});
    model.anim!.assignAnimation('PreviewIdle', idle);
    model.anim!.baseLayer.play('PreviewIdle'); model.anim!.update(0);
    const meshes = allMeshes(model);
    const bounds = new pc.BoundingBox(); let first = true;
    for (const mesh of meshes) {
      mesh.castShadow = false; mesh.receiveShadow = false;
      if (mesh.skinInstance) {
        mesh.cull = false;
        mesh.skinInstance.updateMatrices(mesh.skinInstance.rootBone, 1);
      }
      if (first) { bounds.copy(mesh.aabb); first = false; } else bounds.add(mesh.aabb);
    }
    if (first || ![...bounds.center.toArray(), ...bounds.halfExtents.toArray()].every(Number.isFinite)) throw new Error('Character has no usable preview bounds');
    centered.setLocalPosition(-bounds.center.x, -bounds.getMin().y, -bounds.center.z);
    bounds.center.set(0, bounds.halfExtents.y, 0);
    let angle = -16;
    root.setLocalEulerAngles(0, angle, 0);
    return {
      root, model, bounds,
      get angle() { return angle; },
      rotate(degrees: number) { if (!destroyed && Number.isFinite(degrees)) { angle = degrees % 360; root.setLocalEulerAngles(0, angle, 0); } },
      update(dt: number) { if (!destroyed) model.anim!.update(Math.max(0, Math.min(.1, Number.isFinite(dt) ? dt : 0))); },
      destroy() { if (destroyed) return; destroyed = true; root.destroy(); },
    };
  } catch (error) { root.destroy(); throw error; }
}
export type CharacterPreviewModel = ReturnType<typeof createCharacterPreviewModel>;

/** Latest-selection ownership. Downloads are cancelled, parsing is serialized,
 * late results are released, and app destruction can await all parser callbacks. */
export function createCharacterPreviewSession(app: pc.AppBase, options: {
  load?: typeof loadCharacterPreviewBuffer;
  parse?: (buffer: ArrayBuffer) => Promise<DriverAsset>;
  createModel?: (app: pc.AppBase, asset: DriverAsset) => CharacterPreviewModel;
  disposeAsset?: (asset: DriverAsset) => void;
  onState?: (state: PreviewState) => void;
  onModel?: (model: CharacterPreviewModel | null) => void;
} = {}) {
  const {load = loadCharacterPreviewBuffer, parse = buffer => parseLocalGLB(app, buffer), createModel = createCharacterPreviewModel, disposeAsset = disposeDriverAsset, onState = () => {}, onModel = () => {}} = options;
  let version = 0, closed = false, selected = '', abort: AbortController | null = null;
  let model: CharacterPreviewModel | null = null, asset: DriverAsset | null = null;
  let parseTail: Promise<unknown> = Promise.resolve();
  const pending = new Set<Promise<unknown>>();
  const release = () => { model?.destroy(); model = null; onModel(null); if (asset) disposeAsset(asset); asset = null; };
  function select(id: string): Promise<boolean> {
    if (closed) return Promise.resolve(false);
    selected = resolveCharacter(id).id;
    const current = ++version, driver = selected;
    abort?.abort(); abort = new AbortController(); const signal = abort.signal;
    release();
    const stale = () => closed || current !== version || signal.aborted;
    const emit = (state: PreviewState) => { if (!stale()) onState(state); };
    emit({stage: 'loading', driver});
    const work = (async () => {
      let incoming: DriverAsset | null = null;
      try {
        const buffer = await load(driver, signal, emit);
        if (stale()) return false;
        emit({stage: 'preparing', driver});
        const parsing = parseTail.catch(() => {}).then(async () => {
          if (stale()) return null;
          return parse(buffer);
        });
        parseTail = parsing;
        incoming = await parsing;
        if (!incoming || stale()) return false;
        const next = createModel(app, incoming);
        asset = incoming; incoming = null; model = next;
        onModel(model); emit({stage: 'ready', driver}); return true;
      } catch (error) { if (!stale()) { release(); emit({stage: 'failed', driver, error}); } return false; }
      finally { if (incoming) disposeAsset(incoming); }
    })();
    pending.add(work); void work.finally(() => pending.delete(work));
    return work;
  }
  return {
    select, retry: () => select(selected),
    get model() { return model; },
    async dispose() {
      if (!closed) { closed = true; ++version; abort?.abort(); release(); onState({stage: 'disposed', driver: selected}); }
      await Promise.allSettled([...pending]);
    },
  };
}

export type CharacterPreviewController = (() => void) & {updateCharacter: (driver: string) => void; retry: () => void};

/** Dedicated, bounded 30fps portrait renderer. All DOM and frame listeners are
 * released synchronously on exit, even if an embedded texture is still decoding. */
export function mountCharacterPreview(canvas: HTMLCanvasElement, status: HTMLElement, driver: string): CharacterPreviewController {
  let app: pc.Application | null = null, session: ReturnType<typeof createCharacterPreviewSession> | null = null;
  let disposed = false, suspended = false, lost = false, frame = 0, lastFrame = 0, needsFrame = true;
  let aspect = 1, selected = resolveCharacter(driver).id, pointer: number | null = null, lastX = 0;
  let model: CharacterPreviewModel | null = null;
  let camera: pc.Entity | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let released: Promise<unknown> = Promise.resolve();
  const settings = readGameSettings(), motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reducedMotion = motion?.matches ?? false;
  const previousTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = 'pan-y';
  const cancelFrame = () => { if (frame) cancelAnimationFrame(frame); frame = 0; lastFrame = 0; };
  const canDraw = () => !disposed && !suspended && !lost && !document.hidden;
  const stopEngineFrame = () => { if (app?.frameRequestId) { cancelAnimationFrame(app.frameRequestId); app.frameRequestId = null; } };
  function fit() {
    if (!model || !camera) return;
    const view = characterPreviewCamera(model.bounds, aspect);
    camera.setPosition(view.position); camera.lookAt(view.target);
    camera.camera!.fov = view.fov; camera.camera!.nearClip = view.nearClip; camera.camera!.farClip = view.farClip;
  }
  function draw(now: number) {
    frame = 0;
    if (!app || !canDraw()) return;
    if (!needsFrame && lastFrame && now - lastFrame < 1000 / 30 - .5) { frame = requestAnimationFrame(draw); return; }
    const dt = lastFrame ? Math.min(.1, (now - lastFrame) / 1000) : 0; lastFrame = now;
    try {
      model?.update(reducedMotion ? 0 : dt);
      app.update(reducedMotion ? 0 : dt); app.render(); app.fire('frameend'); needsFrame = false;
      if (model && !reducedMotion) frame = requestAnimationFrame(draw);
    } catch (error) { console.warn('Character preview could not render.', error); unavailable(); }
  }
  function resume() { if (app && canDraw() && !frame && (needsFrame || (model && !reducedMotion))) frame = requestAnimationFrame(draw); }
  function refresh() { needsFrame = true; resume(); }
  function resize() {
    if (!app || disposed) return;
    const rect = (canvas.parentElement || canvas).getBoundingClientRect(), width = Math.max(1, Math.round(rect.width)), height = Math.max(1, Math.round(rect.height));
    aspect = width / height;
    app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, settings.quality === 'low' ? 1 : 1.5);
    app.resizeCanvas(width, height); fit(); refresh();
  }
  function display(state: PreviewState) {
    if (disposed) return;
    canvas.dataset.previewState = state.stage;
    status.dataset.previewState = state.stage;
    status.replaceChildren();
    if (state.stage === 'loading') status.textContent = `正在加载角色${state.progress === undefined ? '…' : ` ${Math.floor(state.progress * 100)}%`}`;
    else if (state.stage === 'preparing') status.textContent = '正在准备 3D 形象…';
    else if (state.stage === 'ready') status.textContent = '拖动查看 · 方向键旋转';
    else if (state.stage === 'failed') {
      status.append(document.createTextNode('3D 形象暂未加载 '));
      const button = document.createElement('button'); button.type = 'button'; button.textContent = '重试'; button.className = 'preview-retry'; button.addEventListener('click', retry); status.append(button);
    }
    canvas.setAttribute('aria-busy', String(state.stage === 'loading' || state.stage === 'preparing'));
  }
  function select(id: string) {
    if (disposed) return;
    selected = resolveCharacter(id).id;
    canvas.setAttribute('aria-label', `${resolveCharacter(selected).label} 3D 角色，拖动或按左右方向键旋转，Home 回正`);
    void session?.select(selected);
  }
  function retry() {
    if (disposed) return;
    if (session) select(selected);
    else { display({stage: 'loading', driver: selected}); void released.then(() => { if (!disposed) initialize(); }); }
  }
  function pointerDown(event: PointerEvent) {
    if (event.button !== 0 || pointer !== null) return;
    pointer = event.pointerId; lastX = event.clientX;
    try { canvas.setPointerCapture(pointer); } catch {}
    canvas.style.cursor = 'grabbing';
  }
  function pointerMove(event: PointerEvent) {
    if (pointer !== event.pointerId || !model) return;
    model.rotate(model.angle + (event.clientX - lastX) * .5); lastX = event.clientX; refresh();
  }
  function pointerEnd(event: PointerEvent) {
    if (pointer !== event.pointerId) return;
    const previous = pointer; pointer = null;
    try { if (canvas.hasPointerCapture(previous)) canvas.releasePointerCapture(previous); } catch {}
    canvas.style.cursor = 'grab';
  }
  function keyboard(event: KeyboardEvent) {
    if (!model || !['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
    event.preventDefault(); model.rotate(event.key === 'Home' ? -16 : model.angle + (event.key === 'ArrowLeft' ? -12 : 12)); refresh();
  }
  function visibility() { if (document.hidden) cancelFrame(); else refresh(); }
  function pagehide() { suspended = true; cancelFrame(); }
  function pageshow() { suspended = false; resize(); }
  function motionChanged() { reducedMotion = motion?.matches ?? false; cancelFrame(); refresh(); }
  function contextLost(event: Event) { event.preventDefault(); lost = true; cancelFrame(); }
  function contextRestored() { lost = false; resize(); }
  function releaseApp() {
    const oldApp = app, oldSession = session; app = null; session = null; model = null; camera = null;
    // Container parsing cannot be interrupted halfway through texture callbacks.
    // Stop drawing now and let the owner release its result before its device.
    if (oldApp) {
      const context = (oldApp.graphicsDevice as pc.WebglGraphicsDevice).gl;
      const loseContext = context?.getExtension('WEBGL_lose_context');
      oldApp.root.enabled = false;
      released = (oldSession?.dispose() || Promise.resolve()).finally(() => {
        oldApp.destroy();
        // Returning to the roster creates a fresh canvas/context. Explicitly
        // release this context rather than waiting for browser garbage collection.
        if (disposed) loseContext?.loseContext();
      });
    }
  }
  function unavailable() {
    cancelFrame(); stopEngineFrame(); releaseApp();
    display({stage: 'failed', driver: selected});
  }
  function initialize() {
    if (disposed || app) return;
    try {
      app = new pc.Application(canvas, {graphicsDeviceOptions: {antialias: settings.quality !== 'low', alpha: true, powerPreference: 'low-power'}});
      app.setCanvasFillMode(pc.FILLMODE_NONE); app.setCanvasResolution(pc.RESOLUTION_AUTO);
      app.scene.ambientLight = new pc.Color(.76, .79, .84);
      camera = new pc.Entity('Character portrait camera', app); camera.addComponent('camera', {clearColor: new pc.Color(.08, .12, .19, 0), fov: 34}); app.root.addChild(camera);
      const key = new pc.Entity('Portrait key light', app); key.addComponent('light', {type: 'directional', color: new pc.Color(1, .93, .86), intensity: 1.55, castShadows: false}); key.setLocalEulerAngles(35, -28, 0); app.root.addChild(key);
      const fill = new pc.Entity('Portrait fill light', app); fill.addComponent('light', {type: 'directional', color: new pc.Color(.75, .88, 1), intensity: .65, castShadows: false}); fill.setLocalEulerAngles(-20, 145, 0); app.root.addChild(fill);
      session = createCharacterPreviewSession(app, {onState: display, onModel: next => { model = next; fit(); refresh(); }});
      app.start(); stopEngineFrame(); resize(); select(selected);
    } catch (error) { console.warn('Character preview WebGL initialization is unavailable.', error); unavailable(); }
  }
  function dispose() {
    if (disposed) return;
    disposed = true; cancelFrame(); stopEngineFrame();
    resizeObserver?.disconnect(); resizeObserver = null;
    window.removeEventListener('resize', resize); window.removeEventListener('pagehide', pagehide); window.removeEventListener('pageshow', pageshow);
    document.removeEventListener('visibilitychange', visibility); motion?.removeEventListener?.('change', motionChanged);
    canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerup', pointerEnd); canvas.removeEventListener('pointercancel', pointerEnd); canvas.removeEventListener('lostpointercapture', pointerEnd); canvas.removeEventListener('keydown', keyboard);
    canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', contextRestored);
    if (pointer !== null) { try { if (canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer); } catch {} pointer = null; }
    canvas.style.touchAction = previousTouchAction; canvas.style.cursor = '';
    releaseApp(); status.replaceChildren(); canvas.dataset.previewState = 'disposed'; canvas.setAttribute('aria-busy', 'false');
  }
  window.addEventListener('resize', resize); window.addEventListener('pagehide', pagehide); window.addEventListener('pageshow', pageshow);
  document.addEventListener('visibilitychange', visibility); motion?.addEventListener?.('change', motionChanged);
  canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('pointerup', pointerEnd); canvas.addEventListener('pointercancel', pointerEnd); canvas.addEventListener('lostpointercapture', pointerEnd); canvas.addEventListener('keydown', keyboard);
  canvas.addEventListener('webglcontextlost', contextLost); canvas.addEventListener('webglcontextrestored', contextRestored);
  canvas.style.cursor = 'grab';
  if (typeof ResizeObserver !== 'undefined') { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas.parentElement || canvas); }
  initialize();
  return Object.assign(dispose, {updateCharacter: select, retry});
}
