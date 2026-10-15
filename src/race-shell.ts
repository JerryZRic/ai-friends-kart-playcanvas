import {createRaceSound,type RaceSoundOptions,type RaceCue} from './race-sound';
import {raceMusicUrl,getDocumentMusic,bindMusicNavigation,bindMusicSettings,MUSIC_SETTINGS_MARKUP,type BackgroundMusic} from './music-ui';
import {touchHint} from './mobile-controls';
import {characterDisplayName,characterEmblem} from './character-identity.js';
import { itemImage, type ItemKind } from './item-models';
import { resolveCharacter } from './character-profiles';
import { resolveMap, type MapId } from './map-profiles';
import {parseMenuState, menuQuery, type MenuScreen} from './menu-state';

/** Both maps keep their own simulation, but share every player-facing race flow. */
export interface RaceHudSnapshot {
  rank: number;
  lap: number;
  laps?: number;
  racerCount?: number;
  elapsed: number;
  /** Signed world speed in metres per second; negative is reverse. */
  speed: number;
  charge?: number;
  chargeMax?: number;
  /** Optional map-specific feedback; absent fields retain the shared defaults. */
  chargeLabel?: string;
  chargeState?: 'idle' | 'charging' | 'ready' | 'full';
  itemHelp?: string;
  itemHelpSecond?: string;
  boost?: number;
  shield?: number;
  held: ItemKind | null;
  /** Fixed R slot; an empty E slot never pulls this item left. */
  heldSecond?: ItemKind | null;
  slideLabel?: string;
  canUseItem?: boolean;
}

export interface RaceResult {
  id: string;
  label?: string;
  finishedAt: number | null;
  total: number;
}

export interface RaceFinishSnapshot {
  rank: number;
  elapsed: number;
  selectedDriverId: string;
  /** Already ordered by the map's authoritative standings function. */
  racers: readonly RaceResult[];
  laps?: number;
  racerCount?: number;
  trackLength: number;
}

export interface RaceMapPath {
  length: number;
  sample: (distance: number) => { p: { x: number; z: number } };
  samples?: number;
  /** Additional branch paths are open unless explicitly closed. */
  closed?: boolean;
}
export interface RaceMapTrack extends RaceMapPath {
  extraPaths?: readonly RaceMapPath[];
}

export interface RaceMapRacer {
  total: number;
  color?: string;
  player?: boolean;
  /** Actual route-local world position; total remains ranking progress only. */
  position?: { x: number; z: number };
}

const positive = (value: number, fallback = 1) => Number.isFinite(value) && value > 0 ? value : fallback;
const nonnegative = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const count = (value: number, fallback: number) => Math.max(1, Math.floor(positive(value, fallback)));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function formatRaceTime(elapsed: number): string {
  const seconds = Math.floor(nonnegative(elapsed));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function raceNavigation(map: MapId, driver: string, search = globalThis.location?.search || '') {
  const mapId = resolveMap(map).id as MapId, driverId = resolveCharacter(driver).id;
  // Preserve complete explicit setup through race → map/character → garage.
  // Legacy links without setup still retain their exact simple route shape.
  if (!search) {
    const route = (screen: string) => `index.html?screen=${screen}&map=${mapId}&driver=${encodeURIComponent(driverId)}`;
    return {main:'index.html',changeMap:route('maps'),changeCharacter:route('characters')};
  }
  const state = {...parseMenuState(search),map:mapId,driver:driverId};
  const route = (screen: MenuScreen) => `index.html${menuQuery({...state,screen})}`;
  return {main:route('main'),changeMap:route('maps'),changeCharacter:route('characters')};
}

export function formatRaceResults(snapshot: RaceFinishSnapshot): string {
  const laps = count(snapshot.laps, 3), racers = count(snapshot.racerCount, snapshot.racers.length || 6);
  const distance = positive(snapshot.trackLength) * laps;
  const rows = snapshot.racers.map((racer, index) => {
    const label = characterDisplayName(racer.id,racer.label);
    const time = racer.finishedAt !== null && Number.isFinite(racer.finishedAt)
      ? `${nonnegative(racer.finishedAt).toFixed(2)} 秒`
      : `未冲线 · ${clamp(nonnegative(racer.total) / distance * 100, 0, 99.9).toFixed(1)}%`;
    return `${index + 1}. ${label}${racer.id === snapshot.selectedDriverId ? '（你）' : ''} · ${time}`;
  });
  return [`第 ${clamp(count(snapshot.rank, 1), 1, racers)} / ${racers} 名 · ${nonnegative(snapshot.elapsed).toFixed(2)} 秒`, ...rows].join('\n');
}

/** Table content is escaped, and unfinished racers never receive inferred times. */
export function renderRaceResults(snapshot: RaceFinishSnapshot): string {
  const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
  const distance = positive(snapshot.trackLength) * count(snapshot.laps, 3);
  const rows = snapshot.racers.map((racer, index) => {
    const finished = racer.finishedAt !== null && Number.isFinite(racer.finishedAt);
    const player = racer.id === snapshot.selectedDriverId;
    const label = escape(characterDisplayName(racer.id,racer.label));
    const value = finished ? `${nonnegative(racer.finishedAt!).toFixed(2)} 秒` : `${clamp(nonnegative(racer.total) / distance * 100, 0, 99.9).toFixed(1)}%`;
    return `<tr class="${player ? 'result-player ' : ''}${finished ? 'result-finished' : 'result-unfinished'}" data-racer-id="${escape(racer.id)}"><th scope="row">${index + 1}</th><td class="result-name">${characterEmblem(racer.id)}${label}${player ? '<span class="result-you">你</span>' : ''}</td><td class="result-value">${value}</td><td class="result-state">${finished ? '已冲线' : '未冲线'}</td></tr>`;
  });
  return `<table class="result-table"><caption>本场比赛完整排名</caption><thead><tr><th scope="col">名次</th><th scope="col">选手</th><th scope="col">用时 / 进度</th><th scope="col">状态</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

/** Bounds are sampled once. Race updates draw dots without rebuilding track geometry. */
export function createRaceMinimap(canvas: HTMLCanvasElement | null, track: RaceMapTrack) {
  const context = canvas?.getContext('2d');
  const length = positive(track.length);
  const paths = [track, ...(track.extraPaths ?? [])].map((path, index) => {
    const samples = clamp(count(path.samples, 160), 16, 1024);
    const closed = path.closed ?? index === 0;
    const points = Array.from({ length: samples + (closed ? 0 : 1) }, (_, i) => path.sample(i / samples * positive(path.length)).p)
      .filter(point => Number.isFinite(point.x) && Number.isFinite(point.z));
    return { points, closed };
  });
  const valid = paths.flatMap(path => path.points);
  const minX = Math.min(...valid.map(point => point.x)), maxX = Math.max(...valid.map(point => point.x));
  const minZ = Math.min(...valid.map(point => point.z)), maxZ = Math.max(...valid.map(point => point.z));
  return {
    draw(racers: readonly RaceMapRacer[]) {
      if (!context || !canvas) return;
      const width = positive(canvas.width, 260), height = positive(canvas.height, 230);
      context.clearRect(0, 0, width, height);
      if (!valid.length) return;
      const padding = Math.min(14, width / 4, height / 4);
      const scale = Math.min((width - padding * 2) / positive(maxX - minX), (height - padding * 2) / positive(maxZ - minZ));
      const coord = (point: { x: number; z: number }) => [width / 2 + (point.x - (minX + maxX) / 2) * scale, height / 2 + (point.z - (minZ + maxZ) / 2) * scale];
      context.beginPath();
      for (const path of paths) {
        path.points.forEach((point, i) => {
          const [x, y] = coord(point);
          if (i) context.lineTo(x, y); else context.moveTo(x, y);
        });
        if (path.closed) context.closePath();
      }
      context.strokeStyle = '#163b4bbb'; context.lineWidth = 12; context.stroke();
      context.strokeStyle = '#eef5e9bb'; context.lineWidth = 4; context.stroke();
      // Draw the player last, so clustered starts never hide their position.
      for (const racer of [...racers.filter(racer => !racer.player), ...racers.filter(racer => racer.player)]) {
        const total = Number.isFinite(racer.total) ? racer.total : 0;
        const point = racer.position ?? track.sample(((total % length) + length) % length).p;
        if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) continue;
        const [x, y] = coord(point);
        context.beginPath(); context.arc(x, y, racer.player ? 5.5 : 3.5, 0, Math.PI * 2);
        context.fillStyle = racer.color || (racer.player ? '#d5ff60' : '#ffffff'); context.fill();
        context.strokeStyle = '#163b4b'; context.lineWidth = 1.5; context.stroke();
      }
    },
  };
}

export {RACE_SOUND_KEY,createRaceSound} from './race-sound';
const ITEMS = Object.freeze({
  boost: { shortName: '加速', name: 'ϟ 涡轮加速', alt: '涡轮加速模型', action: '使用涡轮加速' },
  shield: { shortName: '护盾', name: '◉ 能量护盾', alt: '能量护盾模型', action: '使用能量护盾' },
  pulse: { shortName: '脉冲', name: '✦ 追踪脉冲', alt: '追踪脉冲模型', action: '使用追踪脉冲' },
});

const ITEM_SLOTS = [
  {button: 'item', image: 'itemImage', name: 'itemName', help: 'itemHelp', action: 'item', key: 'E'},
  {button: 'item-secondary', image: 'itemImageSecondary', name: 'itemNameSecondary', help: 'itemHelpSecondary', action: 'item-secondary', key: 'R'},
] as const;

export interface RaceShellOptions extends RaceSoundOptions {
  music?: BackgroundMusic | null;
  map: MapId;
  driver: string;
  track?: RaceMapTrack;
}

/** Extend the existing shared HUD without requiring a second map template. */
function mountItemSlots(document: Document) {
  const primary = document.getElementById('item') as HTMLButtonElement | null;
  if (!primary) return;
  primary.type = 'button'; primary.dataset.itemSlot = '0';
  primary.setAttribute('aria-keyshortcuts', 'E'); primary.setAttribute('aria-label', 'E 道具槽 · 等待道具'); primary.disabled = true;
  const label = primary.querySelector?.('.itemCopy > span');
  if (label) label.textContent = '道具槽 E';
  if (!primary.parentElement || !document.createElement) return;
  let group = document.getElementById('raceItemSlots');
  if (!group) {
    group = document.createElement('div'); group.id = 'raceItemSlots'; group.className = 'item-slots';
    group.setAttribute('role', 'group'); group.setAttribute('aria-label', '固定道具槽 E 和 R');
    primary.parentElement.insertBefore(group, primary); group.appendChild(primary);
  }
  if (!document.getElementById('item-secondary')) {
    const secondary = document.createElement('button');
    secondary.id = 'item-secondary'; secondary.type = 'button'; secondary.className = 'item';
    secondary.dataset.itemSlot = '1'; secondary.disabled = true;
    secondary.setAttribute('aria-keyshortcuts', 'R'); secondary.setAttribute('aria-label', 'R 道具槽 · 等待道具');
    secondary.innerHTML = '<img id="itemImageSecondary" width="80" height="80" alt="" hidden><div class="itemCopy"><span>道具槽 R</span><strong id="itemNameSecondary">◇ 等待道具</strong><span id="itemHelpSecondary">撞箱拾取 · 两格独立</span></div>';
    group.appendChild(secondary);
  }
}

/** DOM-only coordinator. It never owns physics, race elapsed time or standings. */
export function createRaceShell(document: Document, canvas: HTMLCanvasElement, options: RaceShellOptions) {
  mountItemSlots(document);
  const ids = ['rank', 'lap', 'timer', 'speed', 'charge', 'chargeLabel', 'item', 'itemImage', 'itemName', 'itemHelp', 'item-secondary', 'itemImageSecondary', 'itemNameSecondary', 'itemHelpSecondary', 'toast', 'count', 'pause', 'pausePanel', 'resumeRace', 'overlay', 'menu', 'title', 'subtitle', 'desc', 'results', 'start', 'startText', 'sound', 'raceChangeMap', 'raceChangeCharacter', 'raceMainMenu', 'change-driver', 'change-map', 'raceDriverIdentity'] as const;
  const elements = Object.fromEntries(ids.map(id => [id, document.getElementById(id)])) as Record<typeof ids[number], HTMLElement | null>;
  const text = (id: typeof ids[number], value: string) => { if (elements[id]) elements[id].textContent = (id === 'chargeLabel' || id === 'itemHelp' || id === 'itemHelpSecondary') && document.body?.dataset?.inputMode === 'touch' ? touchHint(value) : value; };
  const hidden = (id: typeof ids[number], value: boolean) => {
    const element = elements[id];
    if (element) element.classList[value ? 'add' : 'remove']('hidden');
  };
  const sound = createRaceSound(options);
  const unlockSound=()=>sound.unlock(), stopSound=()=>sound.stop();
  document.addEventListener?.('pointerdown',unlockSound,true);document.addEventListener?.('keydown',unlockSound,true);
  document.defaultView?.addEventListener('blur',stopSound);
  const visibilitySound=()=>{if(document.hidden)sound.stop();};document.addEventListener?.('visibilitychange',visibilitySound);
  let disposeSoundSettings=()=>{};

  const music = options.music === undefined ? getDocumentMusic(document, options.map) : options.music;
  const musicNavigation = bindMusicNavigation(document, music);
  const pauseActions = document.querySelector?.<HTMLElement>('#pausePanel .pause-actions');
  let disposeMusicSettings = () => {};
  if (pauseActions && document.createElement) {
    const musicPanel = document.createElement('div');
    musicPanel.innerHTML = MUSIC_SETTINGS_MARKUP + `<div style="display:grid;gap:8px;margin-top:14px"><label><input data-sfx-enabled type="checkbox"> 游戏音效</label><label style="display:flex;gap:8px">音效音量 <input data-sfx-volume type="range" min="0" max="100" aria-label="游戏音效音量"><output data-sfx-level></output></label><small>原创合成音效 · 与背景音乐独立</small></div>`;
    const enabled=musicPanel.querySelector<HTMLInputElement>('[data-sfx-enabled]')!,volume=musicPanel.querySelector<HTMLInputElement>('[data-sfx-volume]')!,level=musicPanel.querySelector<HTMLOutputElement>('[data-sfx-level]')!;
    const sync=()=>{enabled.checked=!sound.muted;volume.value=String(Math.round(sound.volume*100));level.value=volume.value+'%';};sync();
    const change=()=>{sound.setMuted(!enabled.checked);updateSound();},input=()=>{sound.unlock();sound.setVolume(Number(volume.value)/100);sync();};
    enabled.addEventListener('change',change);volume.addEventListener('input',input);
    disposeSoundSettings=()=>{enabled.removeEventListener('change',change);volume.removeEventListener('input',input);};

    pauseActions.insertBefore(musicPanel, elements.resumeRace);
    pauseActions.style.maxHeight = 'calc(100% - 32px)'; pauseActions.style.overflowY = 'auto';
    disposeMusicSettings = bindMusicSettings(musicPanel, music);
  }
  const minimap = options.track ? createRaceMinimap(document.getElementById('map') as HTMLCanvasElement | null, options.track) : null;
  let mapId = options.map, phase: 'menu' | 'running' | 'paused' | 'finished' = 'menu';
  let raceMusicStarted = false, lastCount=-1, driftStage=0;
  let toastRemaining = 0, disposed = false;
  const shownItems: Array<ItemKind | null | undefined> = [undefined, undefined];
  const portraits = new Map<ItemKind, string>();
  const focus = (element: HTMLElement | null) => element?.focus?.({ preventScroll: true });

  function updateSound() {
    text('sound', sound.muted ? '♪' : '♫');
    const enabled=document.querySelector?.<HTMLInputElement>('[data-sfx-enabled]');if(enabled)enabled.checked=!sound.muted;
    elements.sound?.setAttribute('aria-label', sound.muted ? '开启音效' : '关闭音效');
    elements.sound?.setAttribute('aria-pressed', String(!sound.muted));
  }

  function updateNavigation(map: MapId, driver: string) {
    if (disposed) return;
    mapId = resolveMap(map).id as MapId;
    const urls = raceNavigation(mapId, driver);
    if (elements.raceDriverIdentity) elements.raceDriverIdentity.innerHTML = characterEmblem(driver) + characterDisplayName(driver);
    for (const id of ['raceChangeCharacter', 'change-driver'] as const) if (elements[id]) (elements[id] as HTMLAnchorElement).href = urls.changeCharacter;
    for (const id of ['raceChangeMap', 'change-map'] as const) if (elements[id]) (elements[id] as HTMLAnchorElement).href = urls.changeMap;
    if (elements.raceMainMenu) (elements.raceMainMenu as HTMLAnchorElement).href = urls.main;
    return urls;
  }

  function renderCountdown(seconds: number, waitingForFinish = false) {
    if (disposed || phase !== 'running') return;
    const countValue=Math.max(0,Math.ceil(seconds)); if(countValue!==lastCount){lastCount=countValue;sound.play(countValue>0?'count':'go');}
    if (seconds <= 0 && !raceMusicStarted) { raceMusicStarted = true; music?.setPhase('race', true); }
    text('count', seconds > 0 ? String(Math.ceil(seconds)) : waitingForFinish ? '冲线！等待其他选手…' : '');
    if (elements.count) elements.count.classList[waitingForFinish && seconds <= 0 ? 'add' : 'remove']('waiting');
  }

  function resetPause() {
    hidden('pausePanel', true);
    elements.count?.classList.remove('paused');
    elements.count?.classList.remove('waiting');
    text('pause', 'Ⅱ');
    elements.pause?.setAttribute('aria-label', '暂停');
    elements.pause?.setAttribute('aria-expanded', 'false');
  }

  function disableItems() {
    for (const id of ['item', 'item-secondary'] as const) {
      if (elements[id]) (elements[id] as HTMLButtonElement).disabled = true;
    }
    for (const action of ['item', 'item-secondary']) {
      const button = document.querySelector?.<HTMLButtonElement>(`[data-mobile-action="${action}"]`);
      if (button) button.disabled = true;
    }
  }

  function clearToast() {
    toastRemaining = 0;
    if (elements.toast) elements.toast.style.opacity = '0';
    text('toast', '');
  }

  updateNavigation(options.map, options.driver);
  updateSound();

  return {
    updateNavigation,
    navigate: musicNavigation.navigate,
    loading() { if (!disposed) music?.silence(); },
    updateHUD(snapshot: RaceHudSnapshot) {
      if (disposed) return;
      const laps = count(snapshot.laps, 3), racers = count(snapshot.racerCount, 6);
      if (elements.rank) elements.rank.innerHTML = `${clamp(count(snapshot.rank, 1), 1, racers)} <small>/ ${racers}</small>`;
      if (elements.lap) elements.lap.innerHTML = `${clamp(count(snapshot.lap, 1), 1, laps)} <small>/ ${laps}</small>`;
      text('timer', formatRaceTime(snapshot.elapsed));
      const speed = Number.isFinite(snapshot.speed) ? snapshot.speed : 0;
      text('speed', `${speed < -.1 ? 'R ' : ''}${Math.round(Math.abs(speed) * 3.6)}`);
      const charge = nonnegative(snapshot.charge ?? 0);
      const nextDrift=charge>=(snapshot.chargeMax??1.4)?3:charge>.6?2:charge>0?1:0;
      if(phase==='running'&&nextDrift>driftStage)sound.play(nextDrift===3?'full':nextDrift===2?'ready':'drift');driftStage=nextDrift;
      if (elements.charge) elements.charge.style.width = `${clamp(charge / positive(snapshot.chargeMax ?? 1.4,1.4) * 100, 0, 100)}%`;
      if (elements.charge) elements.charge.dataset.state = snapshot.chargeState || 'idle';
      text('chargeLabel', snapshot.chargeLabel ?? ((snapshot.boost ?? 0) > 0 ? '涡轮加速中！' : (snapshot.shield ?? 0) > 0 ? '能量护盾保护中' : charge >= .6 ? '松开 Shift，释放漂移加速' : Math.abs(speed) < .1 ? '按住 W 油门起步' : snapshot.slideLabel || '左 Shift + A / D 手刹漂移'));
      // Index is identity: never filter, compact or shift an occupied R slot.
      const heldSlots = [snapshot.held, snapshot.heldSecond ?? null] as const;
      for (const [slot, ids] of ITEM_SLOTS.entries()) {
        const held = heldSlots[slot], button = elements[ids.button] as HTMLButtonElement | null;
        const label = `${ids.key} 道具槽 · ${held ? ITEMS[held].action : '等待道具'}`;
        const disabled = !held || phase !== 'running' || snapshot.canUseItem === false;
        if (shownItems[slot] !== held) {
          shownItems[slot] = held;
          const image = elements[ids.image] as HTMLImageElement | null;
          if (image) {
            image.hidden = !held;
            if (held) {
              if (!portraits.has(held)) portraits.set(held, itemImage(held));
              image.src = portraits.get(held)!; image.alt = ITEMS[held].alt;
            } else { image.removeAttribute('src'); image.alt = ''; }
          }
          if (button) button.dataset.held = held || 'empty';
          button?.setAttribute('aria-label', label);
        }
        text(ids.name, held ? ITEMS[held].name : '◇ 等待道具');
        const help = slot === 0 ? snapshot.itemHelp : snapshot.itemHelpSecond;
        text(ids.help, held ? help ?? `点击这里或按 ${ids.key} 使用` : '撞箱拾取 · 两格独立');
        if (button) button.disabled = disabled;
        const mobileItem = document.querySelector?.<HTMLButtonElement>(`[data-mobile-action="${ids.action}"]`);
        if (mobileItem) {
          const changed = mobileItem.dataset.held !== (held || 'empty');
          mobileItem.disabled = disabled; mobileItem.setAttribute('aria-label', label);
          mobileItem.dataset.held = held || 'empty';
          const image = mobileItem.querySelector<HTMLImageElement>('.mobile-item-image');
          const symbol = mobileItem.querySelector<HTMLElement>('.mobile-item-symbol');
          const name = mobileItem.querySelector<HTMLElement>('.mobile-item-label');
          if (image && changed) {
            image.hidden = !held;
            if (held) {
              if (!portraits.has(held)) portraits.set(held, itemImage(held));
              image.src = portraits.get(held)!; image.alt = ITEMS[held].alt;
            } else { image.removeAttribute('src'); image.alt = ''; }
          }
          if (symbol) symbol.hidden = !!held;
          if (name) name.textContent = `${ids.key} ${held ? ITEMS[held].shortName : '道具'}`;
        }
      }
    },
    start(countdown = 3) {
      if (disposed) return;
      sound.stop();sound.unlock();lastCount=-1;driftStage=0;raceMusicStarted = false; music?.silence();
      music?.setRaceUrl?.(raceMusicUrl(options.map));
      music?.preloadRace();
      phase = 'running'; disableItems(); document.body.classList.remove('race-paused'); resetPause(); clearToast();
      document.body.classList.remove('menu'); document.body.classList.remove('finished');
      if (elements.pause) (elements.pause as HTMLButtonElement).disabled = false;
      hidden('overlay', true); hidden('menu', true); hidden('results', true);
      text('results', ''); renderCountdown(countdown); focus(canvas);
    },
    setPaused(paused: boolean, countdown = 0) {
      if (disposed || (paused ? phase !== 'running' : phase !== 'paused')) return;
      music?.setPhase(raceMusicStarted ? (paused ? 'paused' : 'race') : 'silent');
      if (paused) {
        sound.stop();driftStage=0;
        phase = 'paused'; document.body.classList.add('race-paused'); text('count', '已暂停');
        elements.count?.classList.remove('waiting'); elements.count?.classList.add('paused');
        hidden('pausePanel', false); text('pause', '▶');
        disableItems();
        elements.pause?.setAttribute('aria-label', '继续比赛'); elements.pause?.setAttribute('aria-expanded', 'true');
        focus(elements.resumeRace);
      } else {
        phase = 'running'; document.body.classList.remove('race-paused'); resetPause(); renderCountdown(countdown); focus(canvas);
      }
    },
    renderCountdown,
    showMenu() {
      if (disposed) return;
      sound.stop();music?.silence();
      phase = 'menu'; document.body.classList.remove('race-paused'); resetPause(); clearToast();
      document.body.classList.add('menu'); document.body.classList.remove('finished');
      if (elements.pause) (elements.pause as HTMLButtonElement).disabled = true;
      disableItems();
      hidden('overlay', false); hidden('menu', false); hidden('results', true); text('count', '');
    },
    finish(snapshot: RaceFinishSnapshot) {
      if (disposed) return;
      sound.stop();sound.play('finish');music?.setPhase('menu');
      phase = 'finished'; document.body.classList.remove('race-paused'); resetPause(); clearToast();
      document.body.classList.add('menu'); document.body.classList.add('finished');
      hidden('overlay', false); hidden('menu', false); hidden('results', false); text('count', '');
      text('title', '比赛结果');
      const racers = count(snapshot.racerCount, snapshot.racers.length || 6);
      text('subtitle', `第 ${clamp(count(snapshot.rank, 1), 1, racers)} / ${racers} 名${snapshot.rank === 1 ? ' · 冠军冲线' : ''}`);
      const laps = count(snapshot.laps, 3);
      text('desc', `${resolveMap(mapId).label} · ${laps === 3 ? '三' : laps}圈大奖赛`);
      if (elements.results) elements.results.innerHTML = renderRaceResults(snapshot);
      text('startText', '再来一场');
      if (elements.pause) (elements.pause as HTMLButtonElement).disabled = true;
      disableItems();
      focus(elements.start);
    },
    toast(message: string, seconds = 2.1) {
      if (disposed) return;
      toastRemaining = nonnegative(seconds); text('toast', message);
      if (elements.toast) elements.toast.style.opacity = toastRemaining > 0 ? '1' : '0';
    },
    /** UI time only: this never advances the simulation or countdown. */
    tick(dt: number) {
      if (disposed || toastRemaining <= 0) return;
      toastRemaining = Math.max(0, toastRemaining - nonnegative(dt));
      if (!toastRemaining && elements.toast) elements.toast.style.opacity = '0';
    },
    drawMinimap(racers: readonly RaceMapRacer[]) { if (!disposed) minimap?.draw(racers); },
    cue(cue:RaceCue,distance=0){sound.play(cue,distance);},
    tone(frequency = 500, duration = .1) { sound.tone(frequency, duration); },
    toggleSound() { if (!disposed) { sound.toggle(); updateSound(); sound.tone(); } return sound.muted; },
    get muted() { return sound.muted; },
    dispose() { if (disposed) return; disableItems(); disposed = true; disposeMusicSettings();disposeSoundSettings();document.removeEventListener?.('pointerdown',unlockSound,true);document.removeEventListener?.('keydown',unlockSound,true);document.removeEventListener?.('visibilitychange',visibilitySound);document.defaultView?.removeEventListener('blur',stopSound); musicNavigation.dispose(); sound.dispose(); clearToast(); },
  };
}
