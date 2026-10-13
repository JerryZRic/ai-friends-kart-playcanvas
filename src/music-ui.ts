import {isMenuGarageFrame,sendGarageNavigation} from './garage-host-protocol';
import {createBackgroundMusic} from './background-music';

export type BackgroundMusic = ReturnType<typeof createBackgroundMusic>;

/** Each full HTML page has one owner; audio never joins a required resource gate. */
export function raceMusicUrl(map?: string): string {
  return map === 'waterpark' ? './assets/music/dfy_fusion.mp3' : './assets/music/dfy_bgm.mp3';
}

export function getDocumentMusic(document: Document, map?: string, preloadTheme = false): BackgroundMusic | null {
  if (!document.defaultView || !document.addEventListener || isMenuGarageFrame(document.defaultView)) return null;
  return createBackgroundMusic({document, window: document.defaultView, preloadTheme, raceUrl: raceMusicUrl(map)});
}

export const MUSIC_SETTINGS_MARKUP = `<div data-music-settings style="display:grid;gap:8px;min-width:0"><label style="display:flex;align-items:center;gap:8px"><input data-music-enabled type="checkbox">背景音乐</label><label style="display:flex;align-items:center;gap:8px">音量 <input data-music-volume type="range" min="0" max="100" step="1" aria-label="背景音乐音量" style="min-width:60px;width:100%;flex:1"><output data-music-level style="min-width:3em"></output></label><small data-music-status role="status" aria-live="polite">音乐设置自动保存</small></div>`;

export function bindMusicSettings(root: ParentNode, music: BackgroundMusic | null): () => void {
  const enabled = root.querySelector<HTMLInputElement>('[data-music-enabled]');
  const volume = root.querySelector<HTMLInputElement>('[data-music-volume]');
  const level = root.querySelector<HTMLOutputElement>('[data-music-level]');
  const status = root.querySelector<HTMLElement>('[data-music-status]');
  if (!enabled || !volume || !music) return () => {};
  const sync = () => {
    const state = music.getState();
    enabled.checked = !state.muted; volume.value = String(Math.round(state.volume * 100));
    if (level) level.value = `${volume.value}%`;
    if (status) status.textContent = !state.settingsSaved ? '浏览器无法保存设置；仅本次有效' : state.muted ? '背景音乐已关闭，音效独立控制' : state.blocked ? '音乐暂未播放；点击或触摸页面重试' : '音乐设置自动保存 · 暂停时音量降至30%';
  };
  const change = () => {const muted = !enabled.checked; music.unlock(); music.setMuted(muted);};
  const input = () => {const volumeValue = Number(volume.value) / 100; music.unlock(); music.setVolume(volumeValue);};
  enabled.addEventListener('change', change); volume.addEventListener('input', input);
  const unsubscribe = music.subscribe(sync); sync();
  return () => {unsubscribe(); enabled.removeEventListener('change', change); volume.removeEventListener('input', input);};
}

/** Latest navigation wins, including rapid alternate clicks and history changes. */
export function bindMusicNavigation(document: Document, music: BackgroundMusic | null, intercept?: (href: string) => boolean) {
  const window = document.defaultView;
  if (!window || !document.addEventListener) return {navigate: (href: string) => {if(window)window.location.href=href;}, cancel: () => {}, dispose: () => {}};
  let version = 0, disposed = false, pending = false;
  let returnPhase = music?.getState().phase ?? 'silent';
  const cancel = () => {
    version++;
    if (pending) {pending = false; music?.setPhase(returnPhase);}
  };
  const navigate = (href: string) => {
    if (intercept?.(href) || sendGarageNavigation(href, window)) return;
    const current = ++version;
    if (!pending) returnPhase = music?.getState().phase ?? 'silent';
    pending = true;
    const commit = () => {if (!disposed && current === version) {pending = false; window.location.href = href;}};
    // Keep race-entry silence, but do not add half a second to theme-only hops.
    const destination = new URL(href, new URL(window.location.href, window.location.origin));
    const menuHop = music?.getState().phase === 'menu' && /\/(?:index|garage)\.html$/.test(destination.pathname);
    if (music) void music.fadeOut(menuHop ? 120 : 500).then(commit, commit); else commit();
  };
  const click = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!anchor || anchor.download || anchor.target && anchor.target !== '_self') return;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin || !/\/(?:index|garage|coast|waterpark|source)\.html$/.test(url.pathname)) return;
    event.preventDefault(); navigate(anchor.href);
  };
  // Capture newer explicit UI actions before their handlers cancel an audio fade.
  // Automatic race readiness must not cancel the user's already requested exit.
  const newerClick = (event: Event) => {if ((event.target as Element)?.closest?.('button,input,select')) cancel();};
  const newerKey = (event: KeyboardEvent) => {if (['Enter','Escape','p','P'].includes(event.key) || (event.target as Element)?.closest?.('button,input,select')) cancel();};
  document.addEventListener('pointerdown', newerClick, true);
  document.addEventListener('click', newerClick, true);
  document.addEventListener('keydown', newerKey, true);
  document.addEventListener('click', click);
  window.addEventListener('popstate', cancel); window.addEventListener('pagehide', cancel);
  return {navigate, cancel, dispose() {disposed = true; pending = false; version++; document.removeEventListener('pointerdown', newerClick, true); document.removeEventListener('click', newerClick, true); document.removeEventListener('keydown', newerKey, true); document.removeEventListener('click', click); window.removeEventListener('popstate', cancel); window.removeEventListener('pagehide', cancel);}};
}
