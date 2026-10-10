import * as pc from 'playcanvas';
import { catalog, partsBySlot, KART_SLOTS, defaultBuild, validateBuild, resolveBuild, buildStats, kartTuning, loadGarageState, saveGarageState, MAX_NAMED_BUILDS, MAX_BUILD_NAME_LENGTH, type KartBuild, type KartSlot, type KartPart, type GarageState } from './kart-build';
import { createKartAssemblyLoader, type KartAssembly, type KartAssemblyProgress } from './kart-assembly';
import { resolveCharacter } from './character-profiles';
import { readGameSettings } from './game-settings';
import {kartPresets} from './kart-presets';
import {parseRaceOptions} from './race-options';
import {loadKartThumbnails} from './kart-thumbnails';
import {KART_SLOT_ICONS as SLOT_ICONS} from './kart-slot-icons';
import {createKartGarageStage, garageStageCamera, garageViewportSize, GARAGE_CLEAR_COLOR} from './kart-garage-stage';

const SLOT_NAMES: Record<KartSlot, string> = {body: '车壳', chassis: '底盘', motor: '电机', transmission: '传动', battery: '电池', wheels: '轮胎'};
const byId = new Map(catalog.map(part => [part.id, part]));
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]!));
const bytes = (size: number) => size < 1024 * 1024 ? `${(size / 1024).toFixed(0)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
const themeName = (part: KartPart) => part.themeName;
/** Navigation is explicit: free-mode completion never starts a race. */
export function garageRaceEntry(driver: unknown, build: KartBuild, search = '') {
  const source = new URLSearchParams(search), options = parseRaceOptions(search);
  const params = new URLSearchParams({driver: resolveCharacter(driver).id, kart: JSON.stringify(resolveBuild(build)), difficulty: options.difficulty, seed: String(options.seed)});
  if (source.get('flow') === 'free') {
    params.set('flow', 'free'); params.set('screen', 'race-settings'); params.set('map', 'coast');
    return `./index.html?${params}`;
  }
  params.set('autostart', '1'); return `./coast.html?${params}`;
}
export function garageBackEntry(driver: unknown, build: KartBuild, search = '') {
  const options = parseRaceOptions(search);
  const params = new URLSearchParams({screen: 'characters', map: 'coast', driver: resolveCharacter(driver).id, kart: JSON.stringify(resolveBuild(build)), difficulty: options.difficulty, seed: String(options.seed)});
  if (new URLSearchParams(search).get('flow') === 'free') params.set('flow', 'free');
  return `./index.html?${params}`;
}
/** Returning home retains the current independent car and race setup too. */
export function garageHomeEntry(driver: unknown, build: KartBuild, search = '') {
  const url = garageBackEntry(driver, build, search);
  const params = new URLSearchParams(url.slice(url.indexOf('?')));
  params.delete('screen');
  return `./index.html?${params}`;
}
/** Keep the current history entry authoritative after edits, including refresh/BFCache. */
export function garageBuildSearch(search: string, build: KartBuild): string {
  const params = new URLSearchParams(search);
  params.set('kart', JSON.stringify(resolveBuild(build)));
  return `?${params}`;
}
export function replaceGarageBuildUrl(build: KartBuild, current: Pick<Location, 'pathname' | 'search' | 'hash'>, navigation: Pick<History, 'state' | 'replaceState'>): boolean {
  try {
    navigation.replaceState(navigation.state, '', `${current.pathname}${garageBuildSearch(current.search, build)}${current.hash}`);
    return true;
  } catch { /* Sandboxed history can be blocked; in-session links still carry the build. */ return false; }
}
export function garageInitialBuild(search: string, fallback: KartBuild): KartBuild {
  const raw = new URLSearchParams(search).get('kart');
  if (raw && raw.length < 4096) {try {const parsed: unknown = JSON.parse(raw); if (validateBuild(parsed)) return {...parsed};} catch { /* Keep the recoverable saved build. */ }}
  return resolveBuild(fallback);
}
export function garageCombinedStats(driver: unknown, build: KartBuild) {
  const tuning = kartTuning(driver, 'coast', build, {grade: 0, curvature: 0, speed: 0});
  return {acceleration: tuning.acceleration, speed: tuning.maxSpeed * 3.6, handling: tuning.steering, stability: tuning.stats.rollThresholdG};
}
/** A loaded recipe updates in place; making a copy requires leaving edit mode. */
export function upsertGarageNamedBuild(state: GarageState, rawName: string, editingId: string | null, newId: string): {ok: true; state: GarageState; id: string} | {ok: false; reason: string} {
  const name = rawName.trim();
  if (!name || name.length > MAX_BUILD_NAME_LENGTH || /[\u0000-\u001f\u007f]/u.test(name)) return {ok: false, reason: `请输入 1–${MAX_BUILD_NAME_LENGTH} 个字符的方案名称（不含控制字符）`};
  const existing = editingId ? state.namedBuilds.find(entry => entry.id === editingId) : undefined;
  if (!existing && state.namedBuilds.length >= MAX_NAMED_BUILDS) return {ok: false, reason: `最多收藏 ${MAX_NAMED_BUILDS} 套搭配，请先删除一套再保存`};
  const id = existing?.id || newId, saved = {id, name, build: {...state.activeBuild}};
  return {ok: true, id, state: {...state, namedBuilds: existing ? state.namedBuilds.map(entry => entry.id === id ? saved : entry) : [...state.namedBuilds, saved]}};
}
export function filterGarageParts(slot: KartSlot, theme: string, query: string) {
  const needle = query.trim().toLocaleLowerCase();
  return partsBySlot[slot].filter(part => (!theme || part.themeId === theme) && (!needle || `${part.id} ${part.name} ${part.themeName} ${part.archetypeLabel}`.toLocaleLowerCase().includes(needle)));
}

/** Bounded horizontal tray: every filtered part remains reachable without page scrolling. */
export function garagePartPage<T>(parts: readonly T[], requested: number, size = 6) {
  const pageSize = Math.max(1, Math.floor(size)), pages = Math.max(1, Math.ceil(parts.length / pageSize));
  const page = Math.max(0, Math.min(pages - 1, Math.floor(requested) || 0));
  return {page, pages, items: parts.slice(page * pageSize, (page + 1) * pageSize)};
}

/** One preview app per mounted garage. Latest builds own their own abort signal;
 * stale results are disposed and never presented as the current selection. */
export function mountKartGaragePreview(canvas: HTMLCanvasElement, onStatus: (state: KartAssemblyProgress | {stage: 'failed'; message: string}) => void, initial: KartBuild) {
  let app: pc.Application | null = null, loader: ReturnType<typeof createKartAssemblyLoader> | null = null, model: KartAssembly | null = null, camera: pc.Entity | null = null;
  let stage: ReturnType<typeof createKartGarageStage> | null = null;
  let selected = resolveBuild(initial), controller: AbortController | null = null, version = 0, disposed = false, lost = false, ready = false;
  let yaw = 36, pitch = 22, zoom = 1, aspect = 1, frame = 0, pointer: number | null = null, lastX = 0, lastY = 0;
  let resizeObserver: ResizeObserver | null = null, released: Promise<unknown> = Promise.resolve();
  const settings = readGameSettings();
  const cancelFrame = () => {if (frame) cancelAnimationFrame(frame); frame = 0;};
  function fit() {
    if (!camera || !model) return;
    stage?.rotate(yaw);
    const view = garageStageCamera(model.bounds, aspect, pitch, zoom);
    camera.setPosition(view.position); camera.lookAt(view.target); camera.camera!.fov = view.fov; camera.camera!.nearClip = view.nearClip; camera.camera!.farClip = view.farClip;
  }
  function draw() {
    frame = 0; if (!app || disposed || lost || document.hidden) return;
    try {app.update(0); app.render(); app.fire('frameend');}
    catch (error) {fail(`3D 渲染失败：${String((error as Error).message || error)}`);}
  }
  function refresh() {fit(); if (!frame && app && !disposed && !lost && !document.hidden) frame = requestAnimationFrame(draw);}
  function resize() {
    if (!app || disposed) return;
    const rect = canvas.parentElement!.getBoundingClientRect(), size = garageViewportSize(rect.width, rect.height, window.devicePixelRatio || 1, settings.quality === 'low');
    aspect = size.aspect; app.graphicsDevice.maxPixelRatio = size.pixelRatio;
    app.resizeCanvas(size.width, size.height); refresh();
  }
  function status(state: KartAssemblyProgress | {stage: 'failed'; message: string}) {
    if (disposed) return; ready = state.stage === 'ready'; canvas.dataset.previewState = state.stage;
    canvas.setAttribute('aria-busy', String(!ready && state.stage !== 'failed')); onStatus(state);
  }
  async function select(build: KartBuild) {
    selected = resolveBuild(build); if (disposed) return;
    if (!loader) {status({stage: 'failed', message: '此设备的 3D 预览尚未就绪。可重试，或继续查看零件参数'}); return;}
    controller?.abort(); controller = new AbortController(); const thisVersion = ++version;
    model?.dispose(); model = null; refresh();
    status({stage: 'loading', receivedBytes: 0, totalBytes: null, completed: 0, total: 6});
    try {
      const next = await loader.load(selected, {signal: controller.signal, onProgress: state => {if (!disposed && thisVersion === version) status(state);}});
      if (disposed || thisVersion !== version) {next.dispose(); return;}
      model = next; stage!.attach(next.root, next.bounds); fit(); refresh();
      status({stage: 'ready', receivedBytes: 0, totalBytes: 0, completed: 6, total: 6});
    } catch (error) {if (!disposed && thisVersion === version && !controller.signal.aborted) status({stage: 'failed', message: `所选零件未加载完成：${String((error as Error).message || error)}`});}
  }
  function releaseApp() {
    const oldApp = app, oldLoader = loader; app = null; loader = null; camera = null;
    controller?.abort(); model?.dispose(); model = null; stage?.dispose(); stage = null;
    if (oldApp) {oldApp.root.enabled = false; released = (oldLoader?.dispose() || Promise.resolve()).finally(() => {oldApp.destroy();});}
  }
  function fail(message: string) {cancelFrame(); ++version; releaseApp(); status({stage: 'failed', message});}
  function initialize() {
    if (disposed || app) return;
    try {
      lost = false;
      app = new pc.Application(canvas, {graphicsDeviceOptions: {antialias: settings.quality !== 'low', alpha: false, powerPreference: 'low-power'}});
      app.setCanvasFillMode(pc.FILLMODE_NONE); app.setCanvasResolution(pc.RESOLUTION_AUTO);
      stage = createKartGarageStage(app);
      camera = new pc.Entity('Garage camera', app); camera.addComponent('camera', {clearColor: GARAGE_CLEAR_COLOR, fov: 34}); app.root.addChild(camera);
      loader = createKartAssemblyLoader(app); app.start(); if (app.frameRequestId) {cancelAnimationFrame(app.frameRequestId); app.frameRequestId = null;}
      resize(); void select(selected);
    } catch (error) {fail(`当前设备无法初始化 WebGL 3D 预览：${String((error as Error).message || error)}`);}
  }
  function down(event: PointerEvent) {if (event.button !== 0 || pointer !== null) return; pointer = event.pointerId; lastX = event.clientX; lastY = event.clientY; canvas.setPointerCapture?.(pointer);}
  function move(event: PointerEvent) {if (event.pointerId !== pointer) return; yaw += (event.clientX - lastX) * .45; pitch = pc.math.clamp(pitch + (event.clientY - lastY) * .25, 4, 78); lastX = event.clientX; lastY = event.clientY; refresh();}
  function end(event: PointerEvent) {if (event.pointerId !== pointer) return; const old = pointer; pointer = null; if (old !== null && canvas.hasPointerCapture?.(old)) canvas.releasePointerCapture(old);}
  function wheel(event: WheelEvent) {event.preventDefault(); zoom = pc.math.clamp(zoom + event.deltaY * .001, .72, 1.8); refresh();}
  function reset() {yaw = 36; pitch = 22; zoom = 1; refresh();}
  function keyboard(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '=', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') reset(); else if (event.key === 'ArrowLeft') yaw -= 12; else if (event.key === 'ArrowRight') yaw += 12;
    else if (event.key === 'ArrowUp') pitch -= 8; else if (event.key === 'ArrowDown') pitch += 8;
    else zoom += event.key === '-' ? .1 : -.1;
    pitch = pc.math.clamp(pitch, 4, 78); zoom = pc.math.clamp(zoom, .72, 1.8); refresh();
  }
  function visibility() {if (document.hidden) cancelFrame(); else refresh();}
  function contextLost(event: Event) {event.preventDefault(); lost = true; ready = false; controller?.abort(); ++version; cancelFrame(); status({stage: 'failed', message: '3D 显卡连接中断，恢复后可重试。尚未显示所选装配'});}
  function contextRestored() {lost = false; void select(selected); resize();}
  const retry = () => {if (disposed) return; if (app && !lost) void select(selected); else {releaseApp(); void released.then(initialize);}};
  const dispose = () => {
    if (disposed) return; disposed = true; ++version; controller?.abort(); cancelFrame(); resizeObserver?.disconnect();
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', end); canvas.removeEventListener('pointercancel', end); canvas.removeEventListener('lostpointercapture', end); canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('keydown', keyboard); canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', contextRestored);
    window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', visibility); releaseApp();
  };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end); canvas.addEventListener('lostpointercapture', end); canvas.addEventListener('wheel', wheel, {passive: false}); canvas.addEventListener('keydown', keyboard); canvas.addEventListener('webglcontextlost', contextLost); canvas.addEventListener('webglcontextrestored', contextRestored);
  window.addEventListener('resize', resize); document.addEventListener('visibilitychange', visibility);
  if (typeof ResizeObserver !== 'undefined') {resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas.parentElement!);}
  initialize(); return {select, retry, reset, zoomBy(delta: number) {zoom = pc.math.clamp(zoom + delta, .72, 1.8); refresh();}, dispose, get ready() {return ready;}};
}

const mountedGarages = new WeakMap<HTMLElement, () => void>();
export function mountKartGarage(root: HTMLElement) {
  mountedGarages.get(root)?.();
  const events = new AbortController();
  const search = location.search, freeFlow = new URLSearchParams(search).get('flow') === 'free';
  const driver = resolveCharacter(new URLSearchParams(search).get('driver'));
  let state: GarageState = loadGarageState(), slot: KartSlot = 'body', theme = '', query = '', compareBuild: KartBuild = {...state.activeBuild};
  state.activeBuild = garageInitialBuild(search, state.activeBuild); compareBuild = {...state.activeBuild};
  let editingId: string | null = null, partPage = 0;
  let preview: ReturnType<typeof mountKartGaragePreview> | null = null, storageAvailable = true;
  let thumbnails:ReadonlyMap<string,string>=new Map();const thumbnailAbort=new AbortController();
  const themes = [...new Map(catalog.map(part => [part.themeId, part])).values()].sort((a, b) => a.kitNumber - b.kitNumber);
  const back = garageBackEntry(driver.id, state.activeBuild, search);
  root.innerHTML = `<header class="garage-header"><a class="garage-brand" data-garage-home href="${garageHomeEntry(driver.id, state.activeBuild, search)}"><span>AI FRIENDS</span>KART<span class="brand-dot">.</span></a><nav aria-label="车库导航"><a data-garage-back href="${esc(back)}">← 角色选择</a><span class="dev-stamp">DEV 试验工坊</span></nav></header>
    <div class="garage-heading"><div><p class="eyebrow">WELCOME TO THE LITTLE KART WORKSHOP</p><h1>好味改装工坊<span>！</span></h1><p class="workshop-steps">选零件 · 看变化 · 出发</p></div><div class="driver-chip"><span style="color:${driver.color}">${driver.symbol}</span><div><small>本次试驾伙伴</small><strong>${driver.label}</strong><a data-garage-back href="${esc(back)}">更换角色 ↗</a></div></div></div>
    <section class="garage-workbench" aria-label="车辆装配台"><aside class="slot-panel"><div class="panel-heading"><h2>选部件</h2><span>6 槽</span></div><div id="garage-slots" role="group" aria-label="选择零件槽位"></div><p class="slot-note"><strong>改装小贴士</strong><br>跨主题自由组合<br>同主题没有额外加成</p></aside>
    <section class="preview-panel" aria-label="当前装配的 3D 预览"><div class="preview-heading"><div><span class="eyebrow">01 / 我的装配台</span><h2 id="build-title">自由混搭</h2><p id="build-description" class="build-description">六槽自由搭配，主题没有额外加成</p></div><span class="preview-badge" id="preview-badge">正在准备</span></div><div class="garage-stage"><div class="bench-scenery" aria-hidden="true"><span class="bench-lamp"></span><span class="bench-pegboard"></span><span class="bench-tool bench-tool-one"></span><span class="bench-tool bench-tool-two"></span><span class="bench-shelf"></span><span class="bench-box"></span><span class="bench-tin"></span><span class="bench-platform"></span><span class="bench-sticker">MIX<br>&amp; RACE</span></div><div class="stage-grid" aria-hidden="true"></div><canvas id="kart-preview" tabindex="0" aria-label="完整六零件 3D 装配。拖动旋转车辆、滚轮缩放、方向键调整视角、加减号缩放、Home 回正"></canvas><div class="stage-labels" aria-hidden="true"><span>六个真实模块 · 一台你的赛车</span><span>3D / ORBIT VIEW</span></div><div class="preview-message" id="preview-message"><p id="preview-status" role="status" aria-live="polite">正在准备真实 3D 装配…</p><progress id="preview-progress" aria-label="所选零件实际下载字节"></progress><small id="preview-detail"></small><button id="preview-retry" hidden>重试所选装配</button></div></div><div class="preview-toolbar"><p>拖动旋转 <span>·</span> 滚轮缩放</p><div class="camera-buttons"><button id="preview-zoom-in" aria-label="放大 3D 装配">＋</button><button id="preview-zoom-out" aria-label="缩小 3D 装配">−</button><button id="preview-reset">↺ 回正</button></div></div></section>
    <aside class="performance-panel"><div class="panel-heading"><h2>试车仪表台</h2><span>CHECK / 02</span></div><div id="build-stats"></div><details class="performance-disclosure"><summary>这些参数如何影响比赛？</summary><p class="performance-note">设计估算先转为车辆倍率，再叠加角色属性；上方比赛平路上限与赛道 HUD 使用相同速度换算。当前试玩：重量、动力、极速、操控已参与海岸竞速；电量消耗、耐久损耗与翻车恢复暂未启用。电池容量和耐久均不提供当前优势；稳定性侧倾阈值仅为设计估算，不是角色增益或翻车机制。</p></details><a class="garage-start" id="garage-race" href="${garageRaceEntry(driver.id, state.activeBuild, search)}"><span><small>READY, SET...</small>${freeFlow ? '完成搭配 · 比赛设置' : '去日落海岸试跑'}</span><span>➜</span></a><p class="race-note">保留六名角色属性 · 水上坐骑不受影响</p></aside></section>
    <section class="build-shelf" aria-label="配方与已保存方案"><div class="shelf-tabs"><h2>灵感配方盒</h2><span>五种取舍，选后仍可自由编辑</span></div><div class="starter-list" id="starter-builds"></div><div class="save-row"><form id="save-build-form"><label for="build-name">收藏这套搭配</label><input id="build-name" name="name" maxlength="${MAX_BUILD_NAME_LENGTH}" placeholder="给你的车起个名字" autocomplete="off"><button id="save-build-submit" type="submit">保存新方案 ＋</button><button id="save-as-new" type="button" hidden>另存新方案</button><p id="edit-build-status">新方案 · 保存名称和六个零件，不绑定角色</p></form><p id="save-status" role="status" aria-live="polite">装配会自动保存在此浏览器</p></div><div id="saved-builds" class="saved-list"></div></section>
    <section class="parts-library" aria-labelledby="parts-heading"><div class="library-heading"><div><p class="eyebrow">PARTS & GOODIES / 零件百宝箱</p><h2 id="parts-heading">挑选<span id="current-slot-label">车壳</span></h2><p id="parts-count"></p></div><div class="library-filters"><label for="theme-filter">外观主题（可选）<select id="theme-filter"><option value="">全部 54 个主题</option>${themes.map(part => `<option value="${esc(part.themeId)}">${String(part.kitNumber).padStart(3, '0')} · ${esc(themeName(part))}</option>`).join('')}</select></label><label for="part-search">搜索<input type="search" id="part-search" placeholder="找零件"></label><button id="apply-theme" title="按当前主题装配六个零件；没有套装加成" disabled>整套试装</button></div></div><p class="comparison-hint">悬停或聚焦零件可比较属性，点选后载入实际 3D 模块。仅按需下载涉及的主题包。</p><p id="thumbnail-status" class="comparison-hint" role="status">正在加载零件缩略图…</p><div class="parts-grid" id="parts-grid" role="group" aria-label="可选零件"></div></section>
    <footer class="garage-footer"><span>原创食物模型 · DEV 独立测试</span><a href="./source.html">开源代码与模型许可 ↗</a><a data-garage-back href="${esc(back)}">返回角色选择</a></footer>`;
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  // Reuse the existing controls in native dialogs; there is only one source of state.
  root.insertAdjacentHTML('beforeend', `<div class="garage-actions"><div class="workshop-actions"><button data-open-dialog="recipes-dialog">▤ 配方与收藏</button><button data-open-dialog="specs-dialog">◴ 详细参数</button><span id="compact-save-status" role="status">搭配自动保存</span></div></div><dialog id="recipes-dialog" class="workshop-dialog" aria-labelledby="recipes-title"><div class="dialog-heading"><h2 id="recipes-title">灵感配方与我的收藏</h2><button data-close-dialog aria-label="关闭配方与收藏">关闭 ×</button></div></dialog><dialog id="specs-dialog" class="workshop-dialog" aria-labelledby="specs-title"><div class="dialog-heading"><h2 id="specs-title">车辆设计与比赛参数</h2><button data-close-dialog aria-label="关闭详细参数">关闭 ×</button></div><div id="advanced-stats"></div></dialog>`);
  $('#recipes-dialog').append($('.build-shelf'));
  $('#specs-dialog').append($('.performance-disclosure'));
  $('.garage-actions').append($('#garage-race'));
  $('.garage-footer').remove();
  $('.garage-actions').insertAdjacentHTML('beforeend', '<a class="license-link" href="./source.html" aria-label="开源代码与模型许可">许可 ↗</a>');
  $('.race-note').remove();
  $('.parts-library').insertAdjacentHTML('beforeend', '<div class="parts-pagination"><span id="tray-hint">悬停比较 · 点击装配</span><div><button id="parts-prev" aria-label="上一页零件">←</button><span id="parts-page" role="status" aria-live="polite"></span><button id="parts-next" aria-label="下一页零件">→</button></div></div>');
  let dialogOpener: HTMLElement | null = null;
  root.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog => {
    dialog.addEventListener('close', () => {dialogOpener?.focus({preventScroll: true}); dialogOpener = null;}, {signal: events.signal});
  });
  function persist(message = '当前装配已自动保存') {storageAvailable = saveGarageState(state); $('#save-status').textContent = storageAvailable ? message : '此浏览器无法保存；本次搭配仍可通过下方试跑入口带入比赛，离开后不会保留'; $('#save-status').dataset.error = String(!storageAvailable); $('#compact-save-status').textContent = storageAvailable ? '✓ 搭配已自动保存' : '⚠ 无法保存到浏览器'; $('#compact-save-status').dataset.error = String(!storageAvailable);}
  function renderSlots() {
    $('#garage-slots').innerHTML = KART_SLOTS.map(name => {const part = byId.get(state.activeBuild[name])!; return `<button class="slot-choice" data-slot="${name}" aria-pressed="${slot === name}" aria-label="${SLOT_NAMES[name]}，已装配${esc(themeName(part))}" title="${SLOT_NAMES[name]} · ${esc(part.name)}"><span class="slot-icon" aria-hidden="true">${SLOT_ICONS[name]}</span><span><strong>${SLOT_NAMES[name]}</strong></span></button>`;}).join('');
    $('#current-slot-label').textContent = SLOT_NAMES[slot];
  }
  function renderStats(candidate?: KartBuild) {
    const current = buildStats(state.activeBuild), comparison = buildStats(candidate || compareBuild), prospective = !!candidate;
    const displayed = prospective ? comparison : current, baseline = prospective ? current : comparison;
    const raceTuning = kartTuning(driver.id, 'coast', candidate || state.activeBuild, {grade: 0, curvature: 0, speed: 0});
    const combined = garageCombinedStats(driver.id, candidate || state.activeBuild), previous = garageCombinedStats(driver.id, candidate ? state.activeBuild : compareBuild);
    const physical = Object.fromEntries(KART_SLOTS.map(key => [key, byId.get((candidate || state.activeBuild)[key])!.physicalDesign])) as Record<KartSlot, Readonly<Record<string, number>>>;
    const combinedRows = [['加速', 'acceleration', '游戏单位/s²'], ['极速', 'speed', 'km/h（HUD 换算）'], ['操控', 'handling', '游戏转向系数'], ['稳定性', 'stability', 'g（设计估计，抗侧翻未启用）']] as const;
    const combinedMarkup = `<div class="combined-stats"><h3>${esc(driver.label)} + 车辆 · ${prospective ? '当前 → 试装' : '上次 → 当前'}</h3>${combinedRows.map(([label, key, unit]) => {const delta = combined[key] - previous[key]; return `<div><span>${label}</span><strong>${previous[key].toFixed(2)} → ${combined[key].toFixed(2)}</strong><small>${unit} · Δ ${delta > 0 ? '+' : ''}${delta.toFixed(2)}</small></div>`;}).join('')}<p>角色参与加速、极速与操控；稳定性显示车辆设计值</p></div>`;
    const compactCombinedMarkup = `<div class="combined-stats compact-comparison"><h3>${esc(driver.label)} + 赛车</h3>${combinedRows.map(([label, key, unit]) => {const delta = combined[key] - previous[key]; return `<div title="${esc(unit)} · ${prospective ? '当前 → 试装' : '上次 → 当前'} ${previous[key].toFixed(2)} → ${combined[key].toFixed(2)}"><span>${label}${key === 'stability' ? '<small class="estimate-tag">设计值</small>' : ''}</span><strong>${combined[key].toFixed(key === 'speed' ? 1 : 2)}${key === 'speed' ? '<small> km/h</small>' : ''}</strong><small class="compact-delta ${Math.abs(delta) < .005 ? 'neutral' : delta > 0 ? 'positive' : 'negative'}">${Math.abs(delta) < .005 ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`}</small></div>`;}).join('')}<p>变化对比${prospective ? '当前装配' : '上次装配'} · 稳定性机制未启用</p></div>`;
    const rows = [
      ['设计极速', 'topSpeedKph', 'km/h', 1, false], ['设计起步', 'launchAcceleration', 'm/s²', 2, false], ['设计抓地', 'lateralGripG', 'g', 2, false], ['整车质量', 'massKg', 'kg', 1, true],
    ] as const;
    $('#build-stats').innerHTML = `<p class="comparison-title">${prospective ? '试装比较' : '我的赛车'}</p><div class="game-speed-summary"><div class="speed-dial" aria-hidden="true"><svg viewBox="0 0 200 126"><path class="dial-track" d="M28.6 120 A76 76 0 1 1 171.4 120"/><path class="dial-zone" d="M28.6 68 A76 76 0 0 1 168.9 61.9"/><path class="dial-redline" d="M168.9 61.9 A76 76 0 0 1 171.4 120"/><g class="dial-ticks"><path d="M28.6 120.0L38.9 116.2M24.0 91.3L35.0 91.7M30.6 63.1L40.6 67.6M47.2 39.3L54.8 47.2M71.5 23.5L75.7 33.7M100.0 18.0L100.0 29.0M128.5 23.5L124.3 33.7M152.8 39.3L145.2 47.2M169.4 63.1L159.4 67.6M176.0 91.3L165.0 91.7M171.4 120.0L161.1 116.2"/></g><text x="40" y="112">0</text><text x="89" y="49">120</text><text x="142" y="112">240</text><g class="dial-needle" style="transform:rotate(${Math.max(-110, Math.min(110, raceTuning.maxSpeed * 3.6 / 240 * 220 - 110))}deg)"><path d="M97 96L100 32L103 96Z"/><circle cx="100" cy="94" r="8"/></g></svg></div><span>${esc(driver.label)} · 比赛平路上限</span><strong class="speed-readout">${(raceTuning.maxSpeed * 3.6).toFixed(1)} <small>km/h</small></strong><p>已叠加角色属性 · 未计道具加速<br>弯道上限依抓地调整</p></div>${compactCombinedMarkup}<div class="detailed-comparison">${combinedMarkup}</div><p class="design-spec-caption">以下为设计估算，用于生成车辆倍率</p><div class="spec-rows">${rows.map(([name, key, unit, digits, inverse]) => {const value = Number(displayed[key]), delta = value - Number(baseline[key]); return `<div class="spec-row"><div><span>${name}</span><small class="stat-delta ${Math.abs(delta) < .005 ? 'neutral' : (delta > 0) !== inverse ? 'positive' : 'negative'}">${Math.abs(delta) < .005 ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(digits)}`}</small></div><strong>${value.toFixed(digits)} <small>${unit}</small></strong></div>`;}).join('')}</div><div class="race-multipliers"><h3>比赛车辆系数</h3>${[['加速', displayed.multipliers.acceleration], ['极速', displayed.multipliers.speed], ['转向', displayed.multipliers.handling]].map(([label, value]) => `<div><span>${label}</span><meter min="0.65" max="1.35" value="${value}" aria-label="${label}系数 ${Number(value).toFixed(2)}"></meter><strong>×${Number(value).toFixed(2)}</strong></div>`).join('')}</div><details class="more-stats"><summary>更多估算参数</summary><dl><div><dt>驱动功率</dt><dd>${displayed.drivePowerKw.toFixed(1)} kW</dd></div><div><dt>电池容量（消耗未启用）</dt><dd>${displayed.batteryKwh.toFixed(1)} kWh</dd></div><div><dt>耐久损耗</dt><dd>未启用 · 无当前优势</dd></div><div><dt>终传齿比（设计）</dt><dd>${physical.transmission.final_drive_ratio.toFixed(2)} : 1</dd></div><div><dt>风阻面积 CdA（设计）</dt><dd>${physical.body.drag_area_m2.toFixed(3)} m²</dd></div><div><dt>轮胎摩擦系数（设计）</dt><dd>${physical.wheels.grip_coefficient.toFixed(2)}（无量纲）</dd></div><div><dt>侧倾阈值</dt><dd>${displayed.rollThresholdG.toFixed(2)} g</dd></div></dl></details>`;
    collectAdvancedStats();
  }
    function collectAdvancedStats() {
    const advanced = $('#advanced-stats'); advanced.replaceChildren();
    for (const selector of ['.detailed-comparison', '.design-spec-caption', '.spec-rows', '.race-multipliers', '.more-stats']) {const element = $('#build-stats').querySelector(selector); if (element) advanced.append(element);}
  }
  function renderParts() {
    const filtered = filterGarageParts(slot, theme, query);
    const paged = garagePartPage(filtered, partPage); partPage = paged.page;
    $('#parts-page').textContent = `${partPage + 1} / ${paged.pages}`;
    $<HTMLButtonElement>('#parts-prev').disabled = partPage === 0; $<HTMLButtonElement>('#parts-next').disabled = partPage === paged.pages - 1;
    $('#parts-count').textContent = `${filtered.length} 款${theme || query ? '符合筛选' : '可选'}`;
    $('#parts-grid').innerHTML = filtered.length ? paged.items.map(part => {const thumbnail = thumbnails.get(part.id), hasThumb = !!thumbnail; return `<button class="part-card" style="--part-hue:${[24,162,204,346,44,276][(part.kitNumber - 1) % 6]}" data-part="${esc(part.id)}" aria-pressed="${state.activeBuild[slot] === part.id}"><span class="part-visual ${hasThumb ? '' : 'no-thumbnail'}">${hasThumb ? `<img src="${thumbnail}" alt="${esc(part.name)}原始模型模块图" loading="lazy" width="400" height="300">` : `<span aria-hidden="true">${SLOT_ICONS[slot]}</span><small>点选查看真实 3D</small>`}<span class="part-number">${String(part.kitNumber).padStart(3, '0')}</span><span class="part-selected" aria-hidden="true">${state.activeBuild[slot] === part.id ? '✓' : '+'}</span></span><span class="part-copy"><strong>${esc(part.name)}</strong><span class="part-type">${esc(part.archetypeLabel)}<span>装配 →</span></span><code>${esc(part.id)}</code></span></button>`;}).join('') : '<div class="no-parts"><strong>没有找到这个零件</strong><p>换个名称、零件 ID，或把主题切回“全部”</p><button id="clear-filters">清除筛选</button></div>';
    $('#apply-theme').toggleAttribute('disabled', !theme);
  }
  function renderEditing() {
    $<HTMLInputElement>('#build-name').setCustomValidity('');
    const saved = state.namedBuilds.find(entry => entry.id === editingId);
    if (!saved) editingId = null;
    $('#save-build-submit').textContent = saved ? '更新方案' : '保存新方案 ＋';
    $('#save-as-new').hidden = !saved;
    $('#edit-build-status').textContent = saved ? `正在编辑“${saved.name}” · 更新会替换这条收藏，改装仍需点击更新` : '新方案 · 保存名称和六个零件，不绑定角色';
  }
  function renderSaved() {
    $('#saved-builds').innerHTML = state.namedBuilds.map(saved => `<div class="saved-build"><button data-load-build="${esc(saved.id)}">↗ ${esc(saved.name)}</button><button class="delete-build" data-delete-build="${esc(saved.id)}" aria-label="删除已保存方案 ${esc(saved.name)}">×</button></div>`).join('');
  }
  function applyBuild(build: KartBuild, name = '自由混搭', description = '六槽自由搭配，主题没有额外加成') {
    compareBuild = {...state.activeBuild}; state = {...state, activeBuild: resolveBuild(build)};
    replaceGarageBuildUrl(state.activeBuild, location, history);
    $('#build-title').textContent = name; $('#build-title').title = name; $('#build-description').textContent = description; $('#garage-race').setAttribute('href', garageRaceEntry(driver.id, state.activeBuild, search));
    root.querySelectorAll<HTMLAnchorElement>('[data-garage-back]').forEach(link => {link.href = garageBackEntry(driver.id, state.activeBuild, search);});
    root.querySelectorAll<HTMLAnchorElement>('[data-garage-home]').forEach(link => {link.href = garageHomeEntry(driver.id, state.activeBuild, search);});
    persist(); renderSlots(); renderStats(); renderParts(); void preview?.select(state.activeBuild);
  }
  $('#starter-builds').innerHTML = kartPresets.map((build, index) => `<button data-starter="${esc(build.id)}" title="${esc(build.description)}"><small>${String(index + 1).padStart(2, '0')}</small><span><strong>${esc(build.name)}</strong><small class="preset-description">${esc(build.description)}</small></span><span aria-hidden="true">↗</span></button>`).join('');
  root.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('button'); if (!target) return;
    if (target.dataset.openDialog) {dialogOpener = target; $<HTMLDialogElement>(`#${target.dataset.openDialog}`).showModal();}
    if (target.hasAttribute('data-close-dialog')) target.closest('dialog')?.close();
    if (target.id === 'parts-prev' || target.id === 'parts-next') {partPage += target.id === 'parts-next' ? 1 : -1; renderParts(); renderStats(); const button = $<HTMLButtonElement>(`#${target.id}`); if (button.disabled) $<HTMLButtonElement>(target.id === 'parts-next' ? '#parts-prev' : '#parts-next').focus({preventScroll:true});}
    if (target.dataset.slot) {partPage = 0; slot = target.dataset.slot as KartSlot; renderSlots(); renderParts(); renderStats(); $(`[data-slot="${slot}"]`).focus({preventScroll: true});}
    if (target.dataset.part) {const part = byId.get(target.dataset.part)!; if (part.id !== state.activeBuild[part.slot]) {applyBuild({...state.activeBuild, [part.slot]: part.id}); $(`[data-part="${part.id}"]`)?.focus({preventScroll: true});}}
    if (target.dataset.starter) {const starter = kartPresets.find(value => value.id === target.dataset.starter); applyBuild(starter?.build || defaultBuild, starter?.name || '标准混搭', starter?.description);}
    if (target.dataset.loadBuild) {const saved = state.namedBuilds.find(value => value.id === target.dataset.loadBuild); if (saved) {editingId = saved.id; $<HTMLInputElement>('#build-name').value = saved.name; applyBuild(saved.build, saved.name); renderEditing();}}
    if (target.dataset.deleteBuild) {state = {...state, namedBuilds: state.namedBuilds.filter(value => value.id !== target.dataset.deleteBuild)}; if (editingId === target.dataset.deleteBuild) {editingId = null; $<HTMLInputElement>('#build-name').value = '';} persist('已删除保存的方案；当前装配保持不变'); renderSaved(); renderEditing();}
    if (target.id === 'save-as-new') {editingId = null; renderEditing(); $<HTMLInputElement>('#build-name').focus();}
    if (target.id === 'clear-filters') {partPage = 0; theme = ''; query = ''; $<HTMLSelectElement>('#theme-filter').value = ''; $<HTMLInputElement>('#part-search').value = ''; renderParts();}
    if (target.id === 'apply-theme' && theme) {const build = {...state.activeBuild}; for (const part of catalog.filter(value => value.themeId === theme)) build[part.slot] = part.id; applyBuild(build, `${themeName(byId.get(build.body)!)} · 整套`);}
    if (target.id === 'preview-zoom-in') preview?.zoomBy(-.1); if (target.id === 'preview-zoom-out') preview?.zoomBy(.1); if (target.id === 'preview-reset') preview?.reset(); if (target.id === 'preview-retry') preview?.retry();
  }, {signal: events.signal});
  const comparePart = (event: Event) => {const target = (event.target as HTMLElement).closest<HTMLElement>('[data-part]'); if (!target) return; const part = byId.get(target.dataset.part!)!; renderStats({...state.activeBuild, [part.slot]: part.id});};
  $('#parts-grid').addEventListener('pointerover', comparePart); $('#parts-grid').addEventListener('focusin', comparePart); $('#parts-grid').addEventListener('pointerleave', () => renderStats()); $('#parts-grid').addEventListener('focusout', event => {if (!$('#parts-grid').contains((event as FocusEvent).relatedTarget as Node)) renderStats();});
  $<HTMLSelectElement>('#theme-filter').addEventListener('change', event => {partPage = 0; theme = (event.target as HTMLSelectElement).value; renderParts(); renderStats();});
  $<HTMLInputElement>('#part-search').addEventListener('input', event => {partPage = 0; query = (event.target as HTMLInputElement).value; renderParts(); renderStats();});
  $('#save-build-form').addEventListener('submit', event => {
    event.preventDefault(); const input = $<HTMLInputElement>('#build-name');
    const result = upsertGarageNamedBuild(state, input.value, editingId, `build-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
    if (result.ok === false) {input.setCustomValidity(result.reason); input.reportValidity(); $('#save-status').textContent = result.reason; return;}
    input.setCustomValidity(''); const updating = editingId !== null; state = result.state; editingId = result.id;
    const name = input.value.trim(); input.value = name; $('#build-title').textContent = name; $('#build-title').title = name;
    persist(`“${name}”已${updating ? '更新' : '保存'}在此浏览器`); renderSaved(); renderEditing();
  });
  $<HTMLInputElement>('#build-name').addEventListener('input', event => (event.target as HTMLInputElement).setCustomValidity(''));
  renderSlots(); renderStats(); renderParts(); renderSaved(); renderEditing();
  void loadKartThumbnails(thumbnailAbort.signal).then(images=>{if(thumbnailAbort.signal.aborted)return;thumbnails=images;renderParts();$('#thumbnail-status').textContent='324 张原始模型缩略图已就绪';}).catch(()=>{if(!thumbnailAbort.signal.aborted)$('#thumbnail-status').textContent='缩略图未能加载；零件名称、参数与真实 3D 选择仍可使用';});
  preview = mountKartGaragePreview($<HTMLCanvasElement>('#kart-preview'), current => {
    const status = $('#preview-status'), detail = $('#preview-detail'), bar = $<HTMLProgressElement>('#preview-progress'), retry = $('#preview-retry'), overlay = $('#preview-message');
    const ready = current.stage === 'ready', failed = current.stage === 'failed'; overlay.dataset.state = current.stage; retry.hidden = !failed; bar.hidden = ready || failed;
    $('#preview-badge').textContent = ready ? '已装配' : failed ? '预览未完成' : '正在准备'; $('#preview-badge').dataset.state = current.stage;
    if (failed) {status.textContent = current.message; detail.textContent = '不会用占位模型替代缺失零件。参数和已选搭配仍可查看';}
    else if (ready) {status.textContent = '六个原始模块已装配'; detail.textContent = '拖动与缩放，检查你的搭配';}
    else {
      status.textContent = current.stage === 'retrying' ? `网络暂时中断，${Math.ceil((current.retryInMs || 0) / 1000)} 秒后重试` : current.stage === 'preparing' ? `正在解析真实模型 · ${current.completed} / 6` : `正在下载所选零件 · ${current.completed} / 6`;
      detail.textContent = `${bytes(current.receivedBytes)}${current.totalBytes ? ` / ${bytes(current.totalBytes)}` : ' 已接收'}${current.cachedBytes ? ` · 缓存复用 ${bytes(current.cachedBytes)}` : ''}${current.partId ? ` · ${current.partId}` : ''}`;
      if (current.totalBytes && current.totalBytes > 0) {bar.max = current.totalBytes; bar.value = current.receivedBytes;} else bar.removeAttribute('value');
    }
  }, state.activeBuild);
  const pagehide = () => {events.abort(); thumbnailAbort.abort();preview?.dispose(); preview = null;};
  const pageshow = (event: PageTransitionEvent) => {if (event.persisted) location.reload();};
  window.addEventListener('pagehide', pagehide, {once: true}); window.addEventListener('pageshow', pageshow);
  const dispose = () => {pagehide(); window.removeEventListener('pagehide', pagehide); window.removeEventListener('pageshow', pageshow); mountedGarages.delete(root);};
  mountedGarages.set(root, dispose);
  return {get state() {return state;}, applyBuild, dispose};
}
if (typeof document !== 'undefined' && document.getElementById('kart-garage')) mountKartGarage(document.getElementById('kart-garage')!);
