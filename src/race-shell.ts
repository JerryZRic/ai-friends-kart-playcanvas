import { itemImage, type ItemKind } from './item-models';
import { resolveCharacter } from './character-profiles';
import { resolveMap, type MapId } from './map-profiles';

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
  boost?: number;
  shield?: number;
  held: ItemKind | null;
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

export interface RaceMapTrack {
  length: number;
  sample: (distance: number) => { p: { x: number; z: number } };
  samples?: number;
}

export interface RaceMapRacer {
  total: number;
  color?: string;
  player?: boolean;
}

const positive = (value: number, fallback = 1) => Number.isFinite(value) && value > 0 ? value : fallback;
const nonnegative = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const count = (value: number, fallback: number) => Math.max(1, Math.floor(positive(value, fallback)));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function formatRaceTime(elapsed: number): string {
  const seconds = Math.floor(nonnegative(elapsed));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function raceNavigation(map: MapId, driver: string) {
  const mapId = resolveMap(map).id, driverId = resolveCharacter(driver).id;
  const route = (screen: string) => `index.html?screen=${screen}&map=${mapId}&driver=${encodeURIComponent(driverId)}`;
  return { main: 'index.html', changeMap: route('maps'), changeCharacter: route('characters') };
}

export function formatRaceResults(snapshot: RaceFinishSnapshot): string {
  const laps = count(snapshot.laps, 3), racers = count(snapshot.racerCount, snapshot.racers.length || 6);
  const distance = positive(snapshot.trackLength) * laps;
  const rows = snapshot.racers.map((racer, index) => {
    const label = racer.label ?? resolveCharacter(racer.id).label;
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
    const label = escape(racer.label ?? resolveCharacter(racer.id).label);
    const value = finished ? `${nonnegative(racer.finishedAt!).toFixed(2)} 秒` : `${clamp(nonnegative(racer.total) / distance * 100, 0, 99.9).toFixed(1)}%`;
    return `<tr class="${player ? 'result-player ' : ''}${finished ? 'result-finished' : 'result-unfinished'}" data-racer-id="${escape(racer.id)}"><th scope="row">${index + 1}</th><td class="result-name">${label}${player ? '<span class="result-you">你</span>' : ''}</td><td class="result-value">${value}</td><td class="result-state">${finished ? '已冲线' : '未冲线'}</td></tr>`;
  });
  return `<table class="result-table"><caption>本场比赛完整排名</caption><thead><tr><th scope="col">名次</th><th scope="col">选手</th><th scope="col">用时 / 进度</th><th scope="col">状态</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

/** Bounds are sampled once. Race updates draw dots without rebuilding track geometry. */
export function createRaceMinimap(canvas: HTMLCanvasElement | null, track: RaceMapTrack) {
  const context = canvas?.getContext('2d');
  const length = positive(track.length);
  const samples = clamp(count(track.samples, 160), 16, 1024);
  const points = Array.from({ length: samples }, (_, i) => track.sample(i / samples * length).p);
  const valid = points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.z));
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
      valid.forEach((point, i) => {
        const [x, y] = coord(point);
        if (i) context.lineTo(x, y); else context.moveTo(x, y);
      });
      context.closePath();
      context.strokeStyle = '#163b4bbb'; context.lineWidth = 12; context.stroke();
      context.strokeStyle = '#eef5e9bb'; context.lineWidth = 4; context.stroke();
      // Draw the player last, so clustered starts never hide their position.
      for (const racer of [...racers.filter(racer => !racer.player), ...racers.filter(racer => racer.player)]) {
        const total = Number.isFinite(racer.total) ? racer.total : 0;
        const point = track.sample(((total % length) + length) % length).p;
        if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) continue;
        const [x, y] = coord(point);
        context.beginPath(); context.arc(x, y, racer.player ? 5.5 : 3.5, 0, Math.PI * 2);
        context.fillStyle = racer.color || (racer.player ? '#d5ff60' : '#ffffff'); context.fill();
        context.strokeStyle = '#163b4b'; context.lineWidth = 1.5; context.stroke();
      }
    },
  };
}

export const RACE_SOUND_KEY = 'ai-friends-kart.sound.v1';
type SoundStorage = Pick<Storage, 'getItem' | 'setItem'>;
export interface RaceSoundOptions {
  storage?: SoundStorage;
  audioFactory?: () => AudioContext | null;
}

function soundStorage(): SoundStorage | undefined {
  try { return globalThis.localStorage; } catch { return undefined; }
}

function browserAudio(): AudioContext | null {
  const browser = typeof window === 'undefined' ? undefined : window;
  const Audio = browser?.AudioContext || (browser as Window & { webkitAudioContext?: typeof AudioContext })?.webkitAudioContext;
  return Audio ? new Audio() : null;
}

/** Independent of quality/refraction settings; denied storage/audio never blocks a race. */
export function createRaceSound(options: RaceSoundOptions = {}) {
  const storage = options.storage ?? soundStorage(), factory = options.audioFactory ?? browserAudio;
  let muted = true, audio: AudioContext | null = null, disposed = false;
  try { muted = storage?.getItem(RACE_SOUND_KEY) !== 'on'; } catch { /* default muted */ }
  return {
    get muted() { return muted; },
    toggle() {
      if (disposed) return muted;
      muted = !muted;
      try { storage?.setItem(RACE_SOUND_KEY, muted ? 'off' : 'on'); } catch { /* session preference still applies */ }
      return muted;
    },
    tone(frequency = 500, duration = .1) {
      if (muted || disposed) return;
      try {
        audio = audio || factory();
        if (!audio) return;
        void audio.resume()?.catch(() => {});
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        const stopAt = audio.currentTime + clamp(positive(duration, .1), .01, 2);
        oscillator.connect(gain); gain.connect(audio.destination);
        oscillator.frequency.value = clamp(positive(frequency, 500), 20, 20000);
        gain.gain.setValueAtTime(.035, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(.001, stopAt);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(); oscillator.stop(stopAt);
      } catch { /* Audio is optional, including on unsupported browsers. */ }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      try { void audio?.close()?.catch(() => {}); } catch { /* already closed */ }
      audio = null;
    },
  };
}

const ITEMS = Object.freeze({
  boost: { name: 'ϟ 涡轮加速', alt: '涡轮加速模型', action: '使用涡轮加速' },
  shield: { name: '◉ 能量护盾', alt: '能量护盾模型', action: '使用能量护盾' },
  pulse: { name: '✦ 追踪脉冲', alt: '追踪脉冲模型', action: '使用追踪脉冲' },
});

export interface RaceShellOptions extends RaceSoundOptions {
  map: MapId;
  driver: string;
  track?: RaceMapTrack;
}

/** DOM-only coordinator. It never owns physics, race elapsed time or standings. */
export function createRaceShell(document: Document, canvas: HTMLCanvasElement, options: RaceShellOptions) {
  const ids = ['rank', 'lap', 'timer', 'speed', 'charge', 'chargeLabel', 'item', 'itemImage', 'itemName', 'itemHelp', 'toast', 'count', 'pause', 'pausePanel', 'resumeRace', 'overlay', 'menu', 'title', 'subtitle', 'desc', 'results', 'start', 'startText', 'sound', 'raceChangeMap', 'raceChangeCharacter', 'raceMainMenu', 'change-driver', 'change-map'] as const;
  const elements = Object.fromEntries(ids.map(id => [id, document.getElementById(id)])) as Record<typeof ids[number], HTMLElement | null>;
  const text = (id: typeof ids[number], value: string) => { if (elements[id]) elements[id].textContent = value; };
  const hidden = (id: typeof ids[number], value: boolean) => {
    const element = elements[id];
    if (element) element.classList[value ? 'add' : 'remove']('hidden');
  };
  const sound = createRaceSound(options);
  const minimap = options.track ? createRaceMinimap(document.getElementById('map') as HTMLCanvasElement | null, options.track) : null;
  let mapId = options.map, phase: 'menu' | 'running' | 'paused' | 'finished' = 'menu';
  let toastRemaining = 0, shownItem: ItemKind | null | undefined, disposed = false;
  const portraits = new Map<ItemKind, string>();
  const focus = (element: HTMLElement | null) => element?.focus?.({ preventScroll: true });

  function updateSound() {
    text('sound', sound.muted ? '♪' : '♫');
    elements.sound?.setAttribute('aria-label', sound.muted ? '开启音效' : '关闭音效');
    elements.sound?.setAttribute('aria-pressed', String(!sound.muted));
  }

  function updateNavigation(map: MapId, driver: string) {
    if (disposed) return;
    mapId = resolveMap(map).id as MapId;
    const urls = raceNavigation(mapId, driver);
    for (const id of ['raceChangeCharacter', 'change-driver'] as const) if (elements[id]) (elements[id] as HTMLAnchorElement).href = urls.changeCharacter;
    for (const id of ['raceChangeMap', 'change-map'] as const) if (elements[id]) (elements[id] as HTMLAnchorElement).href = urls.changeMap;
    if (elements.raceMainMenu) (elements.raceMainMenu as HTMLAnchorElement).href = urls.main;
    return urls;
  }

  function renderCountdown(seconds: number, waitingForFinish = false) {
    if (disposed || phase !== 'running') return;
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

  function clearToast() {
    toastRemaining = 0;
    if (elements.toast) elements.toast.style.opacity = '0';
    text('toast', '');
  }

  updateNavigation(options.map, options.driver);
  updateSound();

  return {
    updateNavigation,
    updateHUD(snapshot: RaceHudSnapshot) {
      if (disposed) return;
      const laps = count(snapshot.laps, 3), racers = count(snapshot.racerCount, 6);
      if (elements.rank) elements.rank.innerHTML = `${clamp(count(snapshot.rank, 1), 1, racers)} <small>/ ${racers}</small>`;
      if (elements.lap) elements.lap.innerHTML = `${clamp(count(snapshot.lap, 1), 1, laps)} <small>/ ${laps}</small>`;
      text('timer', formatRaceTime(snapshot.elapsed));
      const speed = Number.isFinite(snapshot.speed) ? snapshot.speed : 0;
      text('speed', `${speed < -.1 ? 'R ' : ''}${Math.round(Math.abs(speed) * 3.6)}`);
      const charge = nonnegative(snapshot.charge ?? 0);
      if (elements.charge) elements.charge.style.width = `${clamp(charge / positive(snapshot.chargeMax ?? 1.4,1.4) * 100, 0, 100)}%`;
      text('chargeLabel', (snapshot.boost ?? 0) > 0 ? '涡轮加速中！' : (snapshot.shield ?? 0) > 0 ? '能量护盾保护中' : charge >= .6 ? '松开 Shift，释放漂移加速' : Math.abs(speed) < .1 ? '按住 W 油门起步' : snapshot.slideLabel || '左 Shift + A / D 手刹漂移');
      const held = snapshot.held;
      if (shownItem !== held) {
        shownItem = held;
        const image = elements.itemImage as HTMLImageElement | null;
        if (image) {
          image.hidden = !held;
          if (held) {
            if (!portraits.has(held)) portraits.set(held, itemImage(held));
            image.src = portraits.get(held)!; image.alt = ITEMS[held].alt;
          } else { image.removeAttribute('src'); image.alt = ''; }
        }
        if (elements.item) elements.item.dataset.held = held || 'empty';
        elements.item?.setAttribute('aria-label', held ? ITEMS[held].action : '等待道具');
      }
      text('itemName', held ? ITEMS[held].name : '◇ 等待道具');
      text('itemHelp', held ? '点击这里或按 E 使用' : '撞箱拾取 · 问号为随机道具');
      if (elements.item) (elements.item as HTMLButtonElement).disabled = !held || phase !== 'running' || snapshot.canUseItem === false;
    },
    start(countdown = 3) {
      if (disposed) return;
      phase = 'running'; resetPause(); clearToast();
      document.body.classList.remove('menu'); document.body.classList.remove('finished');
      if (elements.pause) (elements.pause as HTMLButtonElement).disabled = false;
      hidden('overlay', true); hidden('menu', true); hidden('results', true);
      text('results', ''); renderCountdown(countdown); focus(canvas);
    },
    setPaused(paused: boolean, countdown = 0) {
      if (disposed || (paused ? phase !== 'running' : phase !== 'paused')) return;
      if (paused) {
        phase = 'paused'; text('count', '已暂停');
        elements.count?.classList.remove('waiting'); elements.count?.classList.add('paused');
        hidden('pausePanel', false); text('pause', '▶');
        if (elements.item) (elements.item as HTMLButtonElement).disabled = true;
        elements.pause?.setAttribute('aria-label', '继续比赛'); elements.pause?.setAttribute('aria-expanded', 'true');
        focus(elements.resumeRace);
      } else {
        phase = 'running'; resetPause(); renderCountdown(countdown); focus(canvas);
      }
    },
    renderCountdown,
    showMenu() {
      if (disposed) return;
      phase = 'menu'; resetPause(); clearToast();
      document.body.classList.add('menu'); document.body.classList.remove('finished');
      if (elements.pause) (elements.pause as HTMLButtonElement).disabled = true;
      if (elements.item) (elements.item as HTMLButtonElement).disabled = true;
      hidden('overlay', false); hidden('menu', false); hidden('results', true); text('count', '');
    },
    finish(snapshot: RaceFinishSnapshot) {
      if (disposed) return;
      phase = 'finished'; resetPause(); clearToast();
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
      if (elements.item) (elements.item as HTMLButtonElement).disabled = true;
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
    tone(frequency = 500, duration = .1) { sound.tone(frequency, duration); },
    toggleSound() { if (!disposed) { sound.toggle(); updateSound(); sound.tone(); } return sound.muted; },
    get muted() { return sound.muted; },
    dispose() { if (disposed) return; disposed = true; sound.dispose(); clearToast(); },
  };
}
