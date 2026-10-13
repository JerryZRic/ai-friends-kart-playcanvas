/** Shared menu/race music. No gameplay state or loading depends on audio succeeding. */
export type MusicPhase = 'silent' | 'menu' | 'race' | 'paused';
export interface MusicState {
  phase: MusicPhase;
  volume: number;
  muted: boolean;
  blocked: boolean;
  playing: boolean;
  settingsSaved: boolean;
}
export interface BackgroundMusicOptions {
  themeUrl?: string;
  preloadTheme?: boolean;
  raceUrl?: string;
  document?: Document;
  window?: Window;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  sessionStorage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  createAudio?: (url: string) => HTMLAudioElement;
  createContext?: () => AudioContext;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
}
export interface BackgroundMusic {
  setPhase(phase: MusicPhase, restartRace?: boolean): void;
  unlock(): void;
  preloadRace(): void;
  setRaceUrl?(url: string): void;
  silence(): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  getState(): MusicState;
  subscribe(listener: (state: MusicState) => void): () => void;
  fadeOut(durationMs?: number): Promise<void>;
  dispose(): void;
}
const SETTINGS_KEY = 'ai-friends-kart.music.v1';
const POSITION_KEY = 'ai-friends-kart.music.theme-position.v1';
const controllers = new WeakMap<Document, BackgroundMusic>();

export function createBackgroundMusic(options: BackgroundMusicOptions = {}): BackgroundMusic {
  const doc = options.document ?? globalThis.document;
  const win = options.window ?? globalThis.window;
  const existing = doc && controllers.get(doc);
  if (existing) return existing;
  const later = options.setTimeout ?? globalThis.setTimeout;
  const cancelTimer = options.clearTimeout ?? globalThis.clearTimeout;
  const safelyGetStorage = (session: boolean) => {
    try { return session ? win?.sessionStorage : win?.localStorage; } catch { return null; }
  };
  const storage = options.storage === undefined ? safelyGetStorage(false) : options.storage;
  const session = options.sessionStorage === undefined ? safelyGetStorage(true) : options.sessionStorage;
  let volume = .65, muted = false;
  let settingsSaved = !!storage;
  try {
    const saved = JSON.parse(storage?.getItem(SETTINGS_KEY) ?? 'null');
    if (typeof saved?.volume === 'number' && Number.isFinite(saved.volume)) volume = Math.max(0, Math.min(1, saved.volume));
    if (typeof saved?.muted === 'boolean') muted = saved.muted;
  } catch { settingsSaved = false; /* Storage restrictions and corrupt preferences must never block play. */ }
  const persist = () => {
    try {
      if (!storage) { settingsSaved = false; return; }
      storage.setItem(SETTINGS_KEY, JSON.stringify({ volume, muted })); settingsSaved = true;
    } catch { settingsSaved = false; }
  };
  let currentRaceUrl=options.raceUrl ?? './assets/music/dfy_bgm.mp3';
  const audioFactory = options.createAudio ?? ((url: string) => new Audio(url));
  const tracks: HTMLAudioElement[] = [];
  try {
    tracks.push(audioFactory(options.themeUrl ?? './assets/music/dfy_theme.mp3'));
    tracks.push(audioFactory(currentRaceUrl));
  } catch {
    tracks.forEach(audio => { try { audio.pause(); audio.removeAttribute('src'); audio.load(); } catch { /* unavailable media backend */ } });
    // Audio is optional: even unavailable constructors must not stop loading/gameplay.
    let phase: MusicPhase = 'silent';
    const subscribers = new Set<(state: MusicState) => void>();
    const getState = (): MusicState => ({ phase, volume, muted, blocked: true, playing: false, settingsSaved });
    const emit = () => subscribers.forEach(listener => listener(getState()));
    const inert: BackgroundMusic = {
      getState, setPhase(next) { phase = next; emit(); }, unlock() {}, preloadRace() {}, silence() { phase = 'silent'; emit(); },
      setVolume(next) { if (Number.isFinite(next)) volume = Math.max(0, Math.min(1, next)); persist(); emit(); },
      setMuted(next) { muted = !!next; persist(); emit(); },
      subscribe(listener) { subscribers.add(listener); listener(getState()); return () => subscribers.delete(listener); },
      fadeOut() { phase = 'silent'; emit(); return Promise.resolve(); },
      dispose() { subscribers.clear(); if (doc) controllers.delete(doc); },
    };
    if (doc) controllers.set(doc, inert);
    return inert;
  }
  const [theme, race] = tracks;
  tracks.forEach(audio => { audio.loop = true; audio.preload = 'metadata'; audio.volume = 1; });
  // Menu pages may buffer the theme while their heavier UI graph loads.
  if (options.preloadTheme) { theme.preload = 'auto'; try { theme.load(); } catch { /* optional */ } }
  let savedPosition = 0;
  try { savedPosition = Number(session?.getItem(POSITION_KEY) ?? 0); } catch { /* optional */ }
  const restorePosition = () => {
    if (!Number.isFinite(savedPosition) || savedPosition <= 0 || theme.readyState < 1) return;
    try {
      theme.currentTime = Number.isFinite(theme.duration) && theme.duration > 0 ? savedPosition % theme.duration : savedPosition;
      savedPosition = 0;
    } catch { /* Some browsers require loadedmetadata before seeking. */ }
  };
  restorePosition();
  theme.addEventListener('loadedmetadata', restorePosition);
  const savePosition = () => {
    // A destination unloaded before metadata must not erase the handoff position.
    if (Number.isFinite(savedPosition) && savedPosition > 0) return;
    try { session?.setItem(POSITION_KEY, String(theme.currentTime)); } catch { /* optional */ }
  };
  let context: AudioContext | undefined;
  let graphFailed = false, racePreloaded = false;
  let gains: GainNode[] = [];
  let sources: MediaElementAudioSourceNode[] = [];
  let phase: MusicPhase = 'silent', blocked = false, playing = false, disposed = false;
  let hidden = !!doc?.hidden, fading = false, generation = 0;
  let fadeTimer: ReturnType<typeof setTimeout> | undefined;
  let finishFade: (() => void) | undefined;
  let phaseTimer: ReturnType<typeof setTimeout> | undefined;
  let transitionVersion = 0;
  let outgoing: HTMLAudioElement | undefined;
  const listeners = new Set<(state: MusicState) => void>();
  const getState = (): MusicState => ({ phase, volume, muted, blocked, playing, settingsSaved });
  const emit = () => listeners.forEach(listener => listener(getState()));
  const target = () => phase === 'menu' ? theme : phase === 'race' || phase === 'paused' ? race : undefined;
  const desired = (audio: HTMLAudioElement) => !disposed && !hidden && !muted && volume > 0 && target() === audio;
  const mayPlay = (audio: HTMLAudioElement) => desired(audio) || (!disposed && !hidden && !muted && volume > 0 && (audio === outgoing || fading));
  const level = () => hidden || muted || phase === 'silent' ? 0 : volume * (phase === 'paused' ? .3 : 1);
  const applyGains = () => gains.forEach((gain, index) => {
    gain.gain.cancelScheduledValues(context!.currentTime);
    gain.gain.setValueAtTime(desired(tracks[index]) ? level() : 0, context!.currentTime);
  });
  const ensureGraph = () => {
    if (context) return true;
    if (graphFailed) return false;
    try {
      const factory = options.createContext ?? (() => {
        const audioWindow = win as Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
        const Constructor = audioWindow?.AudioContext ?? audioWindow?.webkitAudioContext;
        if (!Constructor) throw new Error('Web Audio unavailable');
        return new Constructor();
      });
      context = factory();
      tracks.forEach(audio => sources.push(context!.createMediaElementSource(audio)));
      tracks.forEach(() => gains.push(context!.createGain()));
      sources.forEach((source, index) => { source.connect(gains[index]); gains[index].connect(context!.destination); });
      applyGains();
      return true;
    } catch {
      // Fail silent instead of relying on HTMLMediaElement.volume, which iOS ignores.
      blocked = true;
      // A source attached to a media element cannot be created twice, even after
      // disconnect. Treat partial graph construction failure as terminal for it.
      if (context) graphFailed = true;
      tracks.forEach(audio => audio.pause());
      sources.forEach(source => source.disconnect());
      gains.forEach(gain => gain.disconnect());
      if (context) void context.close().catch(() => {});
      context = undefined; sources = []; gains = [];
      return false;
    }
  };
  const cancelFade = () => {
    if (fadeTimer !== undefined) cancelTimer(fadeTimer);
    fadeTimer = undefined;
    fading = false;
    const resolve = finishFade; finishFade = undefined; resolve?.();
  };
  const cancelTransition = (pauseOutgoing = true) => {
    transitionVersion++;
    if (phaseTimer !== undefined) cancelTimer(phaseTimer);
    phaseTimer = undefined;
    if (pauseOutgoing && outgoing && outgoing !== target()) outgoing.pause();
    outgoing = undefined;
  };
  const attempt = (preserveRamp = false) => {
    if (disposed || fading) return;
    const selected = target();
    tracks.forEach(audio => { if (!mayPlay(audio)) audio.pause(); });
    playing = false;
    if (!selected || !desired(selected)) { if (!preserveRamp) applyGains(); emit(); return; }
    if (!ensureGraph()) { emit(); return; }
    if (!preserveRamp) {
      applyGains();
      if (selected.paused || context!.state !== 'running' || blocked) {
        // Wall-clock transitions can finish while autoplay keeps the audio clock
        // suspended. Start a new fade when playback is actually retried/restored.
        const gain = gains[tracks.indexOf(selected)].gain;
        const now = context!.currentTime;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(0, now);
        gain.linearRampToValueAtTime(level(), now + .5);
        const version = ++transitionVersion;
        phaseTimer = later(() => {
          if (disposed || version !== transitionVersion) return;
          phaseTimer = undefined; applyGains();
        }, 500);
      }
    }
    if (!selected.paused && context!.state === 'running' && !blocked) {
      playing = true; emit(); return;
    }
    const token = ++generation;
    // Both calls happen in this stack, preserving transient user activation on iOS.
    let resumed: Promise<void>;
    try { resumed = context!.state === 'running' ? Promise.resolve() : context!.resume(); }
    catch { resumed = Promise.reject(new Error('Audio resume failed')); }
    let started: Promise<void>;
    try {
      // A failed resource needs a fresh load before the next user-triggered retry.
      if (selected.error) {
        const position = selected.currentTime;
        selected.load();
        try { selected.currentTime = position; } catch { /* seek when media is available */ }
      }
      started = Promise.resolve(selected.play());
    }
    catch { started = Promise.reject(new Error('Audio play failed')); }
    void started.then(() => { if (!mayPlay(selected)) selected.pause(); }, () => {});
    void Promise.all([resumed, started]).then(() => {
      if (!mayPlay(selected)) selected.pause();
      if (disposed || token !== generation) return;
      blocked = false; playing = desired(selected) && !selected.paused; emit();
    }).catch(() => {
      if (!mayPlay(selected)) selected.pause();
      if (disposed || token !== generation) return;
      blocked = true; playing = false; emit();
    });
  };

  const refresh = () => { generation++; cancelFade(); cancelTransition(); attempt(); };
  const unlock = () => {
    if (disposed || hidden) return;
    // An early loading-screen gesture may unlock the context without playing a track.
    if (!context && !ensureGraph()) { emit(); return; }
    if (!target() && context!.state !== 'running') {
      try { void context!.resume().catch(() => { if (!disposed) { blocked = true; emit(); } }); } catch { blocked = true; emit(); }
    }
    // Ordinary input must not cancel the phase crossfade or restart playback.
    attempt(phaseTimer !== undefined);
  };
  const onMediaError = (event: Event) => {
    if (disposed || event.target !== target()) return;
    blocked = true; playing = false; emit();
  };
  tracks.forEach(audio => audio.addEventListener('error', onMediaError));
  const onVisibility = () => { hidden = !!doc.hidden; refresh(); };
  const onPageHide = () => { savePosition(); hidden = true; refresh(); };
  const onPageShow = () => { hidden = !!doc?.hidden; refresh(); };
  const controller: BackgroundMusic = {
    getState,
    subscribe(listener) { if (disposed) return () => {}; listeners.add(listener); listener(getState()); return () => listeners.delete(listener); },
    setPhase(next, restartRace = false) {
      if (disposed) return;
      if (phase === next && !restartRace && !fading) { attempt(phaseTimer !== undefined); return; }
      const previous = target();
      if (phase === 'menu' && next !== 'menu') savePosition();
      if (next === 'race' && (restartRace || (phase !== 'race' && phase !== 'paused'))) {
        try { race.currentTime = 0; } catch { /* not loaded */ }
      }
      generation++; cancelFade(); cancelTransition();
      phase = next;
      if (hidden || muted || volume <= 0 || !ensureGraph()) { attempt(); return; }
      const selected = target();
      outgoing = previous !== selected && previous && !previous.paused ? previous : undefined;
      const seconds = previous === selected ? .2 : .5;
      gains.forEach((gain, index) => {
        const now = context!.currentTime;
        const current = tracks[index];
        const from = current === selected && current.paused ? 0 : gain.gain.value;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(from, now);
        gain.gain.linearRampToValueAtTime(current === selected ? level() : 0, now + seconds);
      });
      const version = ++transitionVersion;
      phaseTimer = later(() => {
        if (disposed || version !== transitionVersion) return;
        phaseTimer = undefined;
        if (outgoing && outgoing !== target()) outgoing.pause();
        outgoing = undefined;
        if (previous === theme && selected !== theme) savePosition();
        applyGains();
      }, seconds * 1000);
      attempt(true);
    },
    unlock,
    silence() {
      if (disposed) return;
      savePosition();
      phase = 'silent';
      // Loading/countdowns must be silent immediately, unlike navigational fades.
      generation++; cancelFade(); cancelTransition();
      tracks.forEach(audio => audio.pause());
      playing = false; applyGains(); emit();
    },
    setRaceUrl(url) {
      if(disposed||currentRaceUrl===url)return;
      currentRaceUrl=url;
      generation++;race.pause();race.src=url;race.preload='metadata';racePreloaded=false;
      try {race.load();}catch{/* Optional music never blocks a scene. */}
    },
    preloadRace() {
      if (disposed || racePreloaded) return;
      racePreloaded = true;
      try { race.preload = 'auto'; race.load(); } catch { /* Playback can still retry later. */ }
    },
    setVolume(next) { if (disposed || !Number.isFinite(next)) return; volume = Math.max(0, Math.min(1, next)); persist(); refresh(); },
    setMuted(next) { if (disposed) return; muted = !!next; persist(); refresh(); },
    fadeOut(durationMs = 500) {
      if (disposed) return Promise.resolve();
      cancelFade();
      cancelTransition(false);
      generation++;
      const token = generation;
      fading = true;
      savePosition();
      const ms = Number.isFinite(durationMs) ? Math.max(0, Math.min(500, durationMs)) : 500;
      gains.forEach(gain => {
        const now = context!.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + ms / 1000);
      });
      return new Promise<void>(resolve => {
        finishFade = resolve;
        fadeTimer = later(() => {
          fadeTimer = undefined; finishFade = undefined;
          if (!disposed && token === generation) {
            tracks.forEach(audio => audio.pause()); savePosition();
            phase = 'silent'; fading = false; playing = false; applyGains(); emit();
          }
          resolve();
        }, ms);
      });
    },
    dispose() {
      if (disposed) return;
      savePosition(); disposed = true; generation++; cancelFade(); cancelTransition();
      tracks.forEach(audio => { audio.removeEventListener('error', onMediaError); audio.pause(); audio.removeAttribute('src'); audio.load(); });
      theme.removeEventListener('loadedmetadata', restorePosition);
      doc?.removeEventListener('visibilitychange', onVisibility);
      doc?.removeEventListener('pointerdown', unlock, true);
      doc?.removeEventListener('pointerup', unlock, true);
      doc?.removeEventListener('touchend', unlock, true);
      doc?.removeEventListener('keydown', unlock, true);
      win?.removeEventListener('pagehide', onPageHide);
      win?.removeEventListener('pageshow', onPageShow);
      sources.forEach(source => source.disconnect()); gains.forEach(gain => gain.disconnect());
      if (context) void context.close().catch(() => {});
      listeners.clear(); if (doc) controllers.delete(doc);
    },
  };
  doc?.addEventListener('visibilitychange', onVisibility);
  doc?.addEventListener('pointerdown', unlock, true);
  doc?.addEventListener('pointerup', unlock, true);
  doc?.addEventListener('touchend', unlock, true);
  doc?.addEventListener('keydown', unlock, true);
  win?.addEventListener('pagehide', onPageHide);
  win?.addEventListener('pageshow', onPageShow);
  if (doc) controllers.set(doc, controller);
  return controller;
}
