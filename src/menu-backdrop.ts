import * as pc from 'playcanvas';
import { createCoastScene, coastGroundHeightAt, material, meshEntity } from './scene';
import { createWaterparkScene } from './waterpark-scene';
import { sample } from './track';
import type { GameSettings } from './game-settings';
import type { MapId } from './map-profiles';
import { MENU_MAX_FPS, menuBackdropPhase, menuBackdropQuality, mapPreviewCameraPose, coverCameraPose, type MenuPresentation, type MenuBackdropOptions } from './menu-camera';

type MenuWorld = { map: MapId; camera: pc.Entity; update: (time: number, aspect: number) => void; destroy: () => void };

/** Small scenery-only palms replace GLB props in the coastal preview. No asset
 * registry request, character model, or gameplay animation is needed. */
function addCoastPalms(app: pc.Application, root: pc.Entity) {
  const materials = [material('#a17b60'), material('#66a979'), material('#9dc879')];
  const batches = materials.map(() => ({positions: [] as number[], indices: [] as number[]}));
  const trunk = new pc.CylinderGeometry({radius: .35, height: 8, capSegments: 6});
  const leaf = new pc.ConeGeometry({baseRadius: 1.1, peakRadius: 0, height: 6, capSegments: 3});
  function add(geometry: pc.Geometry, batchIndex: number, transform: pc.Mat4) {
    const batch = batches[batchIndex], offset = batch.positions.length / 3;
    for (let i = 0; i < geometry.positions.length; i += 3) {
      const p = transform.transformPoint(new pc.Vec3(geometry.positions[i], geometry.positions[i + 1], geometry.positions[i + 2]));
      batch.positions.push(p.x, p.y, p.z);
    }
    for (const index of geometry.indices) batch.indices.push(offset + index);
  }
  for (let i = 0; i < 26; i++) {
    const place = sample(i * 37 + 9, (i % 2 ? -1 : 1) * (16 + i % 3 * 4)).p;
    const ground = coastGroundHeightAt(place.x, place.z);
    if (ground === null) continue;
    const palm = new pc.Mat4().setTRS(new pc.Vec3(place.x, ground - .2, place.z), pc.Quat.IDENTITY, new pc.Vec3(1, .8 + i % 4 * .12, 1));
    add(trunk, 0, new pc.Mat4().mul2(palm, new pc.Mat4().setTranslate(0, 4, 0)));
    for (let j = 0; j < 7; j++) {
      const angle = j * Math.PI * 2 / 7 + i;
      const rotation = new pc.Quat().setFromEulerAngles(0, -angle * 180 / Math.PI, 0).mul(new pc.Quat().setFromEulerAngles(0, 0, -76));
      const local = new pc.Mat4().setTRS(new pc.Vec3(Math.cos(angle) * 2.2, 7.6, Math.sin(angle) * 2.2), rotation, pc.Vec3.ONE);
      add(leaf, j % 3 ? 1 : 2, new pc.Mat4().mul2(palm, local));
    }
  }
  batches.forEach((batch, index) => {
    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.setPositions(batch.positions); mesh.setNormals(pc.calculateNormals(batch.positions, batch.indices)); mesh.setIndices(batch.indices); mesh.update();
    meshEntity('Menu coastal palms', mesh, materials[index], root, index === 0);
  });
  root.once('destroy', () => { for (const mat of materials) mat.destroy(); });
}

/** One live world only. Exported for native-engine lifecycle regression tests. */
export function createMenuWorld(app: pc.Application, map: MapId, settings: GameSettings, presentation: MenuPresentation = 'map-preview'): MenuWorld {
  const quality = menuBackdropQuality(settings, 1, 1);
  const coast = map === 'coast' ? createCoastScene(app, {preview: true}) : null;
  const waterpark = map === 'waterpark' ? createWaterparkScene(app, {race: true}) : null;
  const world = (coast ?? waterpark)!;
  if (coast) addCoastPalms(app, coast.root);
  for (const light of app.root.findComponents('light') as pc.LightComponent[]) {
    if (light.entity.name.includes('(reflection')) continue;
    light.castShadows = quality.shadows;
    light.shadowResolution = quality.shadowResolution;
    light.numCascades = 1;
    light.shadowDistance = map === 'coast' ? 260 : 170;
  }
  if (waterpark) {
    waterpark.reflection.setRefractionEnabled(quality.refraction);
    if (!quality.reflection) {
      waterpark.reflection.camera.enabled = false;
      waterpark.waterMaterial.setParameter('waterReflectionAvailable', 0);
    }
  }
  let destroyed = false;
  return {
    map, camera: world.camera,
    update(time, aspect) {
      if (destroyed) return;
      const pose = presentation === 'cover' ? coverCameraPose(map, time, aspect) : mapPreviewCameraPose(map, time, aspect);
      world.camera.setPosition(...pose.position); world.camera.lookAt(...pose.target);
      world.camera.camera!.fov = pose.fov;
      world.camera.camera!.aspectRatioMode = pc.ASPECT_MANUAL;
      world.camera.camera!.aspectRatio = aspect;
      if (coast) coast.oceanMaterial.setParameter('time', time);
      if (waterpark) {
        waterpark.waterMaterial.setParameter('time', time);
        if (quality.reflection) waterpark.reflection.update();
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      // Tear planar scripts down while their cameras still exist.
      waterpark?.reflection.destroy();
      world.root.destroy();
      if (coast) { coast.camera.destroy(); coast.sun.destroy(); }
    },
  };
}

export type MenuBackdropController = (() => void) & {resize: () => void};

export type MenuBackdropCallbacks = {
  onStage?: (stage: 'scene' | 'render') => void;
  onReady?: () => void;
  onError?: (error: unknown) => void;
};

/** Owns only the title-screen canvas. The menu destroys it before replacing DOM.
 * Uses the real engine's shared course geometry with an on-demand 30 fps loop. */
export function mountMenuBackdrop(canvas: HTMLCanvasElement, curtain: HTMLElement, settings: GameSettings, options: MenuBackdropOptions = {},
  // Test seam: lifecycle tests use a real PlayCanvas AppBase + NullGraphicsDevice.
  createApplication: () => pc.Application = () => new pc.Application(canvas, {graphicsDeviceOptions: {antialias: settings.quality === 'high', alpha: false, powerPreference: 'low-power'}}),
  callbacks: MenuBackdropCallbacks = {},
): MenuBackdropController {
  let app: pc.Application | null = null, world: MenuWorld | null = null;
  let disposed = false, suspended = false, lost = false;
  let frame = 0, elapsed = 0, lastFrame = 0, needsFrame = true;
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reducedMotion = motion?.matches ?? false;
  let aspect = 16 / 9;
  let sceneAnnounced = false, firstWorld = true, ready = false, readyPending = false;
  const cancelFrame = () => { if (frame) cancelAnimationFrame(frame); frame = 0; lastFrame = 0; };
  const cancelEngineFrame = () => {
    if (app?.frameRequestId) { cancelAnimationFrame(app.frameRequestId); app.frameRequestId = null; }
  };
  const canDraw = () => !disposed && !suspended && !lost && !document.hidden;
  const updateState = () => { canvas.dataset.backdropState = !canDraw() ? 'paused' : reducedMotion ? 'static' : 'running'; };

  function resize() {
    if (!app || disposed) return;
    // resizeCanvas writes inline pixel dimensions. Measure the responsive owner,
    // never those stale canvas dimensions after orientation/container changes.
    const rect = (canvas.parentElement ?? canvas).getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || window.innerWidth || 1));
    const height = Math.max(1, Math.round(rect.height || window.innerHeight || 1));
    aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : width / height;
    app.graphicsDevice.maxPixelRatio = menuBackdropQuality(settings, width, height, window.devicePixelRatio).pixelRatio;
    app.resizeCanvas(width, height);
    // AUTO reads untransformed clientWidth/clientHeight and would ignore the
    // physical fit. Keep the GPU buffer independent of the logical CSS box.
    app.setCanvasResolution(pc.RESOLUTION_FIXED, width, height);
    needsFrame = true;
    resume();
  }
  function fail(error: unknown) {
    if (disposed) return;
    try { callbacks.onError?.(error); }
    finally { dispose(); canvas.dataset.backdropState = 'unavailable'; curtain.style.opacity = '0'; }
  }
  function draw(now: number) {
    frame = 0;
    if (!app || !canDraw()) { updateState(); return; }
    // This callback runs on the next owned RAF, after the rendered canvas had
    // a paint opportunity. A reduced-motion scene also gets this final RAF.
    if (readyPending) {
      readyPending = false; ready = true;
      callbacks.onReady?.();
      if (disposed) return;
      if (reducedMotion && !needsFrame) return;
    }
    if (!sceneAnnounced) {
      sceneAnnounced = true;
      callbacks.onStage?.('scene');
      if (!disposed) frame = requestAnimationFrame(draw);
      return;
    }
    if (!needsFrame && lastFrame && now - lastFrame < 1000 / MENU_MAX_FPS - .5) {
      frame = requestAnimationFrame(draw); return;
    }
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, .12) : 0;
    lastFrame = now;
    if (!reducedMotion) elapsed += dt;
    const phase = menuBackdropPhase(elapsed, reducedMotion, options);
    curtain.style.opacity = phase.opacity.toFixed(3);
    try {
      if (!world || world.map !== phase.map) {
        world?.destroy(); world = null;
        world = createMenuWorld(app, phase.map, settings, options.presentation ?? (options.map ? 'map-preview' : 'cover'));
        canvas.dataset.backdropMap = phase.map;
        if (firstWorld) {
          firstWorld = false; lastFrame = 0;
          callbacks.onStage?.('render');
          if (!disposed) frame = requestAnimationFrame(draw);
          return;
        }
      }
      world.update(phase.localTime, aspect);
      app.update(reducedMotion ? 0 : dt);
      app.render();
      if (disposed) return;
      app.fire('frameend');
      if (disposed) return;
      needsFrame = false;
      updateState();
      if (!ready && phase.opacity < .05) readyPending = true;
      if (!reducedMotion || readyPending) frame = requestAnimationFrame(draw);
    } catch (error) {
      console.warn('Title scenery could not be rendered.', error);
      fail(error);
    }
  }
  function resume() {
    if (!app || !canDraw()) { updateState(); return; }
    updateState();
    if (!frame && (!reducedMotion || needsFrame)) frame = requestAnimationFrame(draw);
  }
  function visibility() { if (document.hidden) { readyPending = false; cancelFrame(); updateState(); } else { needsFrame = true; resume(); } }
  function pagehide() { readyPending = false; suspended = true; cancelFrame(); updateState(); }
  function pageshow() { suspended = false; needsFrame = true; resize(); }
  function motionChanged() { readyPending = false; reducedMotion = motion?.matches ?? false; elapsed = 0; cancelFrame(); needsFrame = true; resume(); }
  function contextLost(event: Event) {
    event.preventDefault(); readyPending = false; lost = true; cancelFrame(); updateState();
    if (!ready) fail(new Error('Title scenery WebGL context was lost during loading.'));
  }
  function contextRestored() {
    // Rebuild the small generated lighting atlas as well as ordinary resources.
    world?.destroy(); world = null; lost = false; needsFrame = true; resize();
  }
  function dispose() {
    if (disposed) return;
    disposed = true; cancelFrame(); cancelEngineFrame();
    window.removeEventListener('resize', resize);
    window.removeEventListener('pagehide', pagehide); window.removeEventListener('pageshow', pageshow);
    document.removeEventListener('visibilitychange', visibility);
    motion?.removeEventListener?.('change', motionChanged);
    canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', contextRestored);
    world?.destroy(); world = null;
    // Re-entering menus creates a fresh canvas. Release its browser WebGL slot
    // immediately rather than waiting for garbage collection of the old canvas.
    const context = (app?.graphicsDevice as pc.WebglGraphicsDevice | undefined)?.gl;
    const releaseContext = context?.getExtension('WEBGL_lose_context');
    app?.destroy(); app = null;
    releaseContext?.loseContext();
    curtain.style.opacity = '0'; canvas.dataset.backdropState = 'disposed';
  }
  try {
    app = createApplication();
    app.setCanvasFillMode(pc.FILLMODE_NONE); app.setCanvasResolution(pc.RESOLUTION_AUTO);
    // start initializes engine systems; only this owner schedules subsequent work.
    app.start(); cancelEngineFrame();
    window.addEventListener('resize', resize);
    window.addEventListener('pagehide', pagehide); window.addEventListener('pageshow', pageshow);
    document.addEventListener('visibilitychange', visibility);
    motion?.addEventListener?.('change', motionChanged);
    canvas.addEventListener('webglcontextlost', contextLost); canvas.addEventListener('webglcontextrestored', contextRestored);
    resize();
  } catch (error) {
    console.warn('Title scenery WebGL initialization is unavailable.', error);
    fail(error);
  }
  return Object.assign(dispose, {resize});
}
