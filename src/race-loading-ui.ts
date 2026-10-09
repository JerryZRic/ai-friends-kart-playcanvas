import { resolveMap, type MapId } from './map-profiles';

/** Presentation only: adapters supply real loading progress and short stage text. */
export interface RaceLoadingSnapshot {
  /** Real downloaded bytes / known total, 0–1. Unknown totals must use null. */
  progress: number | null;
  status: string;
  busy?: boolean;
  canRetry?: boolean;
  canContinue?: boolean;
  /** Defaults to visible for an idle failure with no continue action. */
  canExit?: boolean;
  continueLabel?: string;
}

export const RACE_LOADING_MARKUP = `<section class="race-loading-screen" aria-label="赛前加载">
  <header class="loading-map"><span class="loading-map-tag" id="loadingMapTag"></span><h1 id="loadingMapName"></h1><p>06 位选手 <span>·</span> 03 圈 <span>·</span> 自由竞速</p></header>
  <section class="loading-controls" aria-label="键盘操作">
    <div class="loading-keyboard" aria-hidden="true"><kbd class="key-w">W</kbd><kbd class="key-a">A</kbd><kbd class="key-s">S</kbd><kbd class="key-d">D</kbd><kbd class="key-shift">Shift</kbd><kbd class="key-space">Space</kbd></div>
    <dl><div><dt>W / S</dt><dd>油门 / 刹车倒车</dd></div><div><dt>A / D</dt><dd>左右转向</dd></div><div><dt>Shift</dt><dd id="loadingDriftHelp">手刹漂移</dd></div><div><dt>Space / E</dt><dd>刹车 / 使用道具</dd></div><div><dt>Esc</dt><dd>暂停比赛</dd></div></dl>
  </section>
  <section class="loading-footer" id="raceLoadingProgressGroup" aria-label="资源下载进度" aria-busy="true">
    <div class="loading-actions"><button type="button" id="raceLoadingRetry" hidden disabled>重试加载</button><button type="button" id="raceLoadingContinue" hidden disabled>继续比赛</button><a id="raceLoadingExit" href="index.html" hidden>返回主菜单</a></div>
    <progress class="race-loading-progress" id="raceLoadingProgress" max="1" aria-label="资源下载进度" aria-describedby="raceLoadingStatus"></progress>
    <div class="loading-status-line"><span id="raceLoadingPercent" aria-hidden="true">—</span><span id="raceLoadingStatus" role="status" aria-live="polite" aria-atomic="true">正在准备赛道…</span></div>
  </section>
</section>`;

export function mountRaceLoadingUi(doc: Document, map: MapId) {
  const host = doc.getElementById('raceLoading');
  if (!host) throw new Error('Missing shared race loading mount');
  host.innerHTML = RACE_LOADING_MARKUP;
  const get = <T extends HTMLElement = HTMLElement>(id: string) => doc.getElementById(id) as T;
  const profile = resolveMap(map);
  get('loadingMapName').textContent = profile.label;
  get('loadingMapTag').textContent = profile.tag;
  get('loadingDriftHelp').textContent = profile.id === 'waterpark' ? '水上滑移' : '手刹漂移';
  const progress = get<HTMLProgressElement>('raceLoadingProgress');
  const percent = get('raceLoadingPercent'), status = get('raceLoadingStatus'), group = get('raceLoadingProgressGroup');
  const retryButton = get<HTMLButtonElement>('raceLoadingRetry'), continueButton = get<HTMLButtonElement>('raceLoadingContinue');
  const exitLink = get<HTMLAnchorElement>('raceLoadingExit');
  let disposed = false;
  return {
    retryButton,
    continueButton,
    update(snapshot: RaceLoadingSnapshot) {
      if (disposed) return;
      const value = snapshot.progress !== null && Number.isFinite(snapshot.progress) ? Math.max(0, Math.min(1, snapshot.progress)) : null;
      if (value === null) { progress.removeAttribute('value'); percent.textContent = '—'; }
      else { progress.value = value; percent.textContent = `${Math.floor(value * 100)}%`; }
      // Avoid re-announcing unchanged text on every byte/status callback.
      if (status.textContent !== snapshot.status) status.textContent = snapshot.status;
      group.setAttribute('aria-busy', String(snapshot.busy ?? true));
      retryButton.hidden = !snapshot.canRetry; retryButton.disabled = !snapshot.canRetry || !!snapshot.busy;
      continueButton.hidden = !snapshot.canContinue; continueButton.disabled = !snapshot.canContinue || !!snapshot.busy;
      continueButton.textContent = snapshot.continueLabel || '继续比赛';
      exitLink.hidden = !(snapshot.canExit ?? (snapshot.busy === false && !snapshot.canContinue));
    },
    dispose() { disposed = true; retryButton.disabled = true; continueButton.disabled = true; },
  };
}
