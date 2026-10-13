import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackgroundMusic } from '../src/background-music.ts';

class FakeAudio extends EventTarget {
  readyState = 1; loop = false; preload = ''; volume = 1; currentTime = 0; duration = 100; paused = true;
  playCalls = 0; pauseCalls = 0; fail = false;
  pending?: Promise<void>;
  constructor(public src: string, private log: string[]) { super(); }
  play() { this.playCalls++; this.log.push('play'); if (this.fail) return Promise.reject(new Error('autoplay denied')); this.paused = false; return this.pending ?? Promise.resolve(); }
  pause() { this.paused = true; this.pauseCalls++; }
  removeAttribute() { this.src = ''; }
  load() {}
}
class FakeParam {
  value = 0; ramps: number[] = []; targets: number[] = [];
  cancelScheduledValues() {}
  setValueAtTime(value: number) { this.value = value; }
  linearRampToValueAtTime(value: number, time: number) { this.ramps.push(time); this.targets.push(value); }
}
class FakeNode { disconnected = false; connect() {} disconnect() { this.disconnected = true; } }
class FakeGain extends FakeNode { gain = new FakeParam(); }
class FakeContext {
  state = 'suspended'; currentTime = 1; destination = {}; closed = false;
  gains: FakeGain[] = []; sources: FakeNode[] = []; resumePending?: Promise<void>;
  constructor(private log: string[]) {}
  createMediaElementSource() { const node = new FakeNode(); this.sources.push(node); return node; }
  createGain() { const node = new FakeGain(); this.gains.push(node); return node; }
  resume() { this.log.push('resume'); this.state = 'running'; return this.resumePending ?? Promise.resolve(); }
  close() { this.closed = true; return Promise.resolve(); }
}
class FakeDocument extends EventTarget { hidden = false; }
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function harness(initial?: string, brokenStorage = false) {
  const log: string[] = [], audios: FakeAudio[] = [];
  const doc = new FakeDocument(), win = new EventTarget(), context = new FakeContext(log);
  const saved = new Map<string, string>(); if (initial) saved.set('ai-friends-kart.music.v1', initial);
  const storage = { getItem: (key: string) => { if (brokenStorage) throw Error(); return saved.get(key) ?? null; }, setItem: (key: string, value: string) => { if (brokenStorage) throw Error(); saved.set(key, value); } };
  const timers = new Map<number, { fn: () => void; delay: number }>(); let id = 0;
  const options = {
    document: doc as unknown as Document, window: win as unknown as Window,
    storage, sessionStorage: storage,
    createAudio: (url: string) => { const audio = new FakeAudio(url, log); audios.push(audio); return audio as unknown as HTMLAudioElement; },
    createContext: () => context as unknown as AudioContext,
    setTimeout: ((fn: () => void, delay: number) => { timers.set(++id, { fn, delay }); return id; }) as unknown as typeof setTimeout,
    clearTimeout: ((key: number) => timers.delete(key)) as unknown as typeof clearTimeout,
  };
  const music = createBackgroundMusic(options);
  return { music, options, log, audios, doc, win, context, saved, timers, tick: () => { const jobs = [...timers.values()]; timers.clear(); jobs.forEach(job => job.fn()); } };
}

test('loading is silent; one document owns exactly two sources and looping tracks', async () => {
  const h = harness(); assert.equal(h.audios.length, 2); assert.equal(h.context.sources.length, 0);
  assert.equal(createBackgroundMusic(h.options), h.music); assert.equal(h.audios.length, 2);
  h.doc.dispatchEvent(new Event('pointerdown'));
  assert.deepEqual(h.log, ['resume']); assert.equal(h.context.sources.length, 2);
  h.music.setPhase('menu'); h.tick(); await flush();
  assert.equal(h.music.getState().playing, true); assert.equal(h.context.gains[0].gain.value, .65);
  assert.ok(h.audios.every(audio => audio.loop)); assert.match(h.audios[0].src, /^\.\/assets\/music\//);
  h.music.unlock(); assert.equal(h.context.sources.length, 2); h.music.dispose();
});
test('resume and play are synchronous in gesture stack, even while resume is pending', async () => {
  const h = harness(); h.context.resumePending = new Promise(() => {});
  h.music.setPhase('menu'); assert.deepEqual(h.log, ['resume', 'play']);
  h.music.dispose();
});
test('autoplay rejection is nonblocking and next gesture retries', async () => {
  const h = harness(); h.audios[0].fail = true;
  h.music.setPhase('menu'); await flush(); assert.equal(h.music.getState().blocked, true);
  h.audios[0].fail = false; h.doc.dispatchEvent(new Event('keydown')); await flush();
  assert.equal(h.music.getState().playing, true); assert.equal(h.music.getState().blocked, false); h.music.dispose();
});
test('race, pause and finish select only one track; racing restarts while pause resumes', async () => {
  const h = harness(); h.music.setPhase('menu'); h.audios[0].currentTime = 19;
  h.music.setPhase('race'); h.tick(); await flush(); assert.equal(h.audios[0].paused, true); assert.equal(h.audios[1].paused, false);
  h.audios[1].currentTime = 27; h.music.setPhase('paused'); h.tick(); assert.equal(h.context.gains[1].gain.value, .65 * .3);
  h.music.setPhase('race'); assert.equal(h.audios[1].currentTime, 27);
  h.music.setPhase('menu'); h.tick(); assert.equal(h.audios[0].currentTime, 19); assert.equal(h.audios[1].paused, true);
  h.music.setPhase('race'); assert.equal(h.audios[1].currentTime, 0); h.music.dispose();
});
test('hidden is silent and restores the latest selected phase', async () => {
  const h = harness(); h.music.setPhase('race');
  h.doc.hidden = true; h.doc.dispatchEvent(new Event('visibilitychange'));
  assert.ok(h.audios.every(audio => audio.paused)); assert.ok(h.context.gains.every(gain => gain.gain.value === 0));
  h.music.setPhase('menu'); assert.equal(h.audios[0].paused, true);
  h.doc.hidden = false; h.doc.dispatchEvent(new Event('visibilitychange')); await flush();
  assert.equal(h.audios[0].paused, false); assert.equal(h.audios[1].paused, true); h.music.dispose();
});
test('preferences persist independently, clamp volume, and tolerate blocked storage', () => {
  const h = harness('{"volume":0.4,"muted":true}'); h.music.setPhase('menu'); assert.equal(h.audios[0].playCalls, 0);
  h.music.setMuted(false); h.tick(); assert.equal(h.context.gains[0].gain.value, .4);
  h.music.setVolume(5); assert.equal(h.music.getState().volume, 1);
  h.music.setVolume(NaN); assert.equal(h.music.getState().volume, 1);
  h.music.setMuted(true); assert.equal(h.music.getState().volume, 1); assert.equal(h.audios[0].paused, true);
  assert.deepEqual(JSON.parse(h.saved.get('ai-friends-kart.music.v1')!), { volume: 1, muted: true }); h.music.dispose();
  const b = harness(undefined, true); b.music.setVolume(.2); b.music.setMuted(true); b.music.dispose();
});
test('navigation fade is capped at 500 ms, pauses and resolves; stale fades never stop new phase', async () => {
  const h = harness(); h.music.setPhase('menu');
  const first = h.music.fadeOut(9000); assert.equal([...h.timers.values()][0].delay, 500);
  h.music.setPhase('race'); await first; h.tick(); assert.equal(h.timers.size, 0); assert.equal(h.audios[1].paused, false);
  const second = h.music.fadeOut(); h.tick(); await second;
  assert.equal(h.music.getState().phase, 'silent'); assert.ok(h.audios.every(audio => audio.paused)); h.music.dispose();
});
test('late play settlement after silent or disposal cannot restore audio or status', async () => {
  const h = harness(); let resolve!: () => void;
  h.audios[0].pending = new Promise<void>(done => { resolve = done; });
  h.music.setPhase('menu'); h.music.setPhase('silent'); h.tick();
  h.audios[0].paused = false; resolve(); await flush();
  assert.equal(h.audios[0].paused, true); assert.equal(h.music.getState().playing, false);
  h.music.dispose(); assert.ok(h.context.closed); assert.ok(h.context.sources.every(node => node.disconnected));
  const plays = h.audios[0].playCalls; h.doc.dispatchEvent(new Event('pointerdown')); assert.equal(h.audios[0].playCalls, plays);
});
test('session menu position is saved for page navigation, and pagehide silences immediately', () => {
  const h = harness(); h.music.setPhase('menu'); h.audios[0].currentTime = 42;
  h.win.dispatchEvent(new Event('pagehide')); assert.equal(h.saved.get('ai-friends-kart.music.theme-position.v1'), '42');
  assert.equal(h.audios[0].paused, true); h.music.dispose();
  const restored = createBackgroundMusic(h.options); assert.equal(h.audios[2].currentTime, 42); restored.dispose();
});
test('dispose resolves pending fade and unsubscribes observers', async () => {
  const h = harness(); let calls = 0; const off = h.music.subscribe(() => calls++);
  assert.equal(calls, 1); off(); h.music.setPhase('menu'); const fade = h.music.fadeOut(); h.music.dispose(); await fade;
  assert.equal(calls, 1); assert.equal(h.timers.size, 0);
});

test('an older rejected attempt cannot overwrite a newer successful gesture', async () => {
  const h = harness(); let reject!: (error: Error) => void;
  h.audios[0].pending = new Promise<void>((_, fail) => { reject = fail; });
  h.music.setPhase('menu'); h.audios[0].pending = undefined; h.audios[0].paused = true;
  h.music.unlock(); await flush(); assert.equal(h.music.getState().playing, true);
  reject(new Error('old attempt')); await flush();
  assert.equal(h.music.getState().blocked, false); assert.equal(h.music.getState().playing, true); h.music.dispose();
});
test('partially constructed audio graphs disconnect without duplicate media sources', () => {
  const h = harness(); let calls = 0;
  const original = h.context.createMediaElementSource.bind(h.context);
  h.context.createMediaElementSource = () => { if (++calls === 2) throw Error('source unavailable'); return original(); };
  h.music.setPhase('menu'); assert.equal(h.music.getState().blocked, true);
  assert.ok(h.context.sources[0].disconnected); assert.ok(h.context.closed);
  h.music.unlock(); assert.equal(calls, 2); assert.ok(h.audios.every(audio => audio.paused)); h.music.dispose();
});

test('phase changes ramp for 500 ms and crossfade without normal gestures disrupting ramps', async () => {
  const h = harness(); h.music.setPhase('menu');
  assert.equal(h.context.gains[0].gain.value, 0);
  assert.equal(h.context.gains[0].gain.targets.at(-1), .65);
  assert.equal(h.context.gains[0].gain.ramps.at(-1), 1.5);
  h.tick(); await flush(); h.music.setPhase('race'); await flush();
  assert.equal(h.audios[0].paused, false); assert.equal(h.audios[1].paused, false);
  assert.equal(h.context.gains[0].gain.targets.at(-1), 0);
  assert.equal(h.context.gains[1].gain.targets.at(-1), .65);
  const count = h.context.gains[1].gain.ramps.length, plays = h.audios[1].playCalls;
  h.doc.dispatchEvent(new Event('pointerdown')); h.doc.dispatchEvent(new Event('pointerup')); h.doc.dispatchEvent(new Event('touchend'));
  assert.equal(h.context.gains[1].gain.ramps.length, count); assert.equal(h.audios[1].playCalls, plays);
  h.tick(); assert.equal(h.audios[0].paused, true);
  h.music.setPhase('menu'); assert.equal(h.audios[1].paused, false); h.tick(); assert.equal(h.audios[1].paused, true);
  h.music.dispose();
});
test('same-track pause ducks over 200 ms and explicit race restart differs from resume', () => {
  const h = harness(); h.music.setPhase('race'); h.tick(); h.audios[1].currentTime = 30;
  h.music.setPhase('paused'); assert.equal(h.context.gains[1].gain.ramps.at(-1), 1.2);
  assert.equal(h.context.gains[1].gain.targets.at(-1), .65 * .3);
  h.music.setPhase('race'); assert.equal(h.audios[1].currentTime, 30);
  h.music.setPhase('paused'); h.music.setPhase('race', true); assert.equal(h.audios[1].currentTime, 0); h.music.dispose();
});
test('rapid transition reversal cancels obsolete timers, while hidden cancels all ramps immediately', () => {
  const h = harness(); h.music.setPhase('menu'); h.tick(); h.music.setPhase('race');
  const stale = [...h.timers.values()][0].fn;
  h.music.setPhase('menu'); stale(); assert.equal(h.audios[0].paused, false);
  h.doc.hidden = true; h.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(h.timers.size, 0); assert.ok(h.audios.every(audio => audio.paused));
  assert.ok(h.context.gains.every(gain => gain.gain.value === 0)); h.music.dispose();
});
test('audio factory failures return a safe controller and dispose partial media', async () => {
  const h = harness(); h.music.dispose(); let calls = 0;
  const first = new FakeAudio('partial.mp3', []);
  const music = createBackgroundMusic({ ...h.options, createAudio: () => { if (++calls === 2) throw Error('no media'); return first as unknown as HTMLAudioElement; } });
  assert.equal(music.getState().blocked, true); assert.equal(first.src, '');
  music.setPhase('race', true); music.unlock(); music.setMuted(true); music.setVolume(.2);
  await music.fadeOut(); music.dispose();
});

test('race preload is idempotent and never plays or unlocks audio', () => {
  const h = harness(); let loads = 0; h.audios[1].load = () => { loads++; };
  h.music.preloadRace(); h.music.preloadRace();
  assert.equal(loads, 1); assert.equal(h.audios[1].preload, 'auto'); assert.deepEqual(h.log, []);
  h.music.dispose();
});
test('settingsSaved reports blocked storage after setting changes', () => {
  const h = harness(undefined, true); assert.equal(h.music.getState().settingsSaved, false);
  h.music.setMuted(true); h.music.setVolume(.8); assert.equal(h.music.getState().settingsSaved, false); h.music.dispose();
});

test('late media errors report blocked and retry loading on the next gesture', async () => {
  const h = harness(); h.music.setPhase('menu'); h.tick(); await flush();
  let loads = 0;
  Object.assign(h.audios[0], { error: { code: 2 } });
  h.audios[0].load = () => { loads++; Object.assign(h.audios[0], { error: null }); };
  h.audios[0].dispatchEvent(new Event('error')); assert.equal(h.music.getState().blocked, true);
  h.doc.dispatchEvent(new Event('touchend')); await flush();
  assert.equal(loads, 1); assert.equal(h.music.getState().blocked, false); h.music.dispose();
});

test('autoplay retry after wall-clock fade expiry rearms fade-in from zero', async () => {
  const h = harness(); h.audios[0].fail = true;
  h.music.setPhase('menu'); await flush(); h.tick();
  assert.equal(h.context.gains[0].gain.value, .65);
  const ramps = h.context.gains[0].gain.ramps.length;
  h.audios[0].fail = false; h.doc.dispatchEvent(new Event('touchend')); await flush();
  assert.equal(h.context.gains[0].gain.value, 0);
  assert.equal(h.context.gains[0].gain.ramps.length, ramps + 1);
  assert.equal(h.context.gains[0].gain.targets.at(-1), .65);
  h.doc.dispatchEvent(new Event('pointerup'));
  assert.equal(h.context.gains[0].gain.ramps.length, ramps + 1);
  h.tick(); assert.equal(h.context.gains[0].gain.value, .65);
  h.doc.hidden = true; h.doc.dispatchEvent(new Event('visibilitychange'));
  h.doc.hidden = false; h.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(h.context.gains[0].gain.value, 0);
  assert.equal(h.context.gains[0].gain.targets.at(-1), .65); h.music.dispose();
});

test('native looping stays enabled through menu, race, paused and boundary events without duplicate playback', async () => {
  const h = harness();
  for (const phase of ['menu', 'race', 'paused', 'race', 'menu'] as const) {
    h.music.setPhase(phase); h.tick(); await flush();
    assert.ok(h.audios.every(audio => audio.loop));
    assert.equal(h.audios.length, 2); assert.equal(h.context.sources.length, 2);
    const active = phase === 'menu' ? h.audios[0] : h.audios[1];
    const inactive = phase === 'menu' ? h.audios[1] : h.audios[0];
    assert.equal(active.paused, false); assert.equal(inactive.paused, true);
    const plays = active.playCalls;
    // Native loop owns end-to-start playback. Synthetic boundary events verify
    // the controller never layers a manual replay, new element or new source.
    active.currentTime = active.duration;
    active.dispatchEvent(new Event('timeupdate'));
    active.dispatchEvent(new Event('ended'));
    active.currentTime = 0;
    active.dispatchEvent(new Event('timeupdate'));
    await flush();
    assert.equal(active.playCalls, plays); assert.equal(h.audios.length, 2);
    assert.equal(h.context.sources.length, 2); assert.equal(inactive.paused, true);
    if (phase === 'paused') assert.equal(h.context.gains[1].gain.value, .65 * .3);
  }
  h.music.dispose();
});

test('explicit loading/countdown silence immediately cancels every track and ramp, then remains reusable', async () => {
  const h = harness(); h.music.setPhase('menu'); h.tick(); await flush();
  h.audios[0].currentTime = 15; h.music.setPhase('race');
  assert.equal(h.audios[0].paused, false); assert.equal(h.audios[1].paused, false);
  const stalePhase = [...h.timers.values()][0].fn;
  const fade = h.music.fadeOut(); const staleNavigation = [...h.timers.values()][0].fn;
  h.music.silence(); await fade;
  assert.equal(h.music.getState().phase, 'silent'); assert.equal(h.music.getState().playing, false);
  assert.ok(h.audios.every(audio => audio.paused)); assert.equal(h.timers.size, 0);
  assert.ok(h.context.gains.every(gain => gain.gain.value === 0));
  assert.equal(h.saved.get('ai-friends-kart.music.theme-position.v1'), '15');
  stalePhase(); staleNavigation(); assert.ok(h.audios.every(audio => audio.paused));
  h.music.setPhase('race', true); h.tick(); await flush();
  assert.equal(h.audios[1].paused, false); assert.equal(h.audios[0].paused, true);
  h.music.dispose();
});

// Regression: real media at HAVE_NOTHING can accept a default start position,
// then reset it while loading. Do not consume persisted handoff until metadata.
test('cross-page theme handoff survives delayed metadata and an early unload', () => {
  const h = harness(); h.music.dispose();
  h.saved.set('ai-friends-kart.music.theme-position.v1', '142');
  const factory = h.options.createAudio;
  h.options.createAudio = url => { const audio = factory(url); (audio as any).readyState = 0; return audio; };
  const music = createBackgroundMusic(h.options);
  const theme = h.audios[2]; assert.equal(theme.currentTime, 0);
  h.win.dispatchEvent(new Event('pagehide'));
  assert.equal(h.saved.get('ai-friends-kart.music.theme-position.v1'), '142');
  theme.readyState = 1; theme.dispatchEvent(new Event('loadedmetadata'));
  assert.equal(theme.currentTime, 42);
  music.dispose();
});
test('menu preload buffers only theme without creating a context or starting playback', () => {
  const h = harness(); h.music.dispose();
  const music = createBackgroundMusic({...h.options, preloadTheme: true});
  assert.equal(h.audios[2].preload, 'auto'); assert.equal(h.audios[3].preload, 'metadata');
  assert.equal(h.audios[2].playCalls, 0); assert.equal(h.context.sources.length, 0);
  music.dispose();
});

test('single-document land and water races reuse media sources and theme position while changing race asset',()=>{
 const h=harness();h.music.setPhase('menu');h.tick();h.audios[0].currentTime=42;
 h.music.silence();h.music.setRaceUrl?.('./assets/music/dfy_fusion.mp3');h.music.setPhase('race');h.tick();
 assert.equal(h.audios[1].src,'./assets/music/dfy_fusion.mp3');assert.equal(h.context.sources.length,2);assert.equal(h.audios.length,2);
 h.music.setPhase('menu');h.tick();assert.equal(h.audios[0].currentTime,42);
 h.music.silence();h.music.setRaceUrl?.('./assets/music/dfy_bgm.mp3');h.music.setPhase('race');h.tick();
 assert.equal(h.audios[1].src,'./assets/music/dfy_bgm.mp3');assert.equal(h.context.sources.length,2);assert.ok(h.audios.every(audio=>audio.loop));h.music.dispose();
});
