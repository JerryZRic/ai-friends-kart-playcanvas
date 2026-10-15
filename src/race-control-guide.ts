/** Presentation-only inventory of the existing race bindings. Coverage tests
 * compare every physical code with race-controls and vehicle-controls so new
 * shortcuts cannot silently disappear from the loading guide. */
export const RACE_KEY_GUIDE = [
  {id: 'throttle', group: 'driving', codes: ['KeyW', 'ArrowUp'], keys: ['W', '↑'], labels: ['W', '上方向键'], text: '油门'},
  {id: 'reverse', group: 'driving', codes: ['KeyS', 'ArrowDown'], keys: ['S', '↓'], labels: ['S', '下方向键'], text: '先刹车，再倒车'},
  {id: 'left', group: 'driving', codes: ['KeyA', 'ArrowLeft'], keys: ['A', '←'], labels: ['A', '左方向键'], text: '向左转向'},
  {id: 'right', group: 'driving', codes: ['KeyD', 'ArrowRight'], keys: ['D', '→'], labels: ['D', '右方向键'], text: '向右转向'},
  {id: 'brake', group: 'driving', codes: ['Space'], keys: ['Space'], labels: ['空格键'], text: '刹车'},
  {id: 'drift', group: 'driving', codes: ['ShiftLeft', 'ShiftRight'], keys: ['Shift'], labels: ['左或右 Shift 键'], text: '手刹漂移', note: '左右 Shift 均可'},
  {id: 'item', group: 'driving', codes: ['KeyE'], keys: ['E'], labels: ['E'], text: '使用左侧道具'},
  {id: 'item-secondary', group: 'driving', codes: ['KeyR'], keys: ['R'], labels: ['R'], text: '使用右侧道具', note: '两格独立 · 使用后不换位'},
  {id: 'camera', group: 'camera', codes: ['KeyZ', 'KeyC'], keys: ['Z', 'C'], labels: ['Z', 'C'], text: '切换高 / 低追逐视角'},
  {id: 'recenter', group: 'camera', codes: ['KeyQ'], keys: ['Q'], labels: ['Q'], text: '视角回正'},
  {id: 'pause', group: 'pause', codes: ['KeyP'], keys: ['P'], labels: ['P'], text: '暂停 / 继续比赛'},
  {id: 'release', group: 'pause', codes: ['Escape'], keys: ['Esc'], labels: ['Escape'], text: '暂停并释放鼠标'},
  {id: 'start', group: 'ready', codes: ['Enter'], keys: ['Enter'], labels: ['回车键'], text: '就绪菜单开始 / 结算后再来一局'},
] as const;

function keycaps(entry: typeof RACE_KEY_GUIDE[number]) {
  return entry.keys.map((key, index) => `<kbd aria-label="${entry.labels[index]}">${key}</kbd>`).join('<span class="loading-key-or" aria-label="或">/</span>');
}
function rows(group: typeof RACE_KEY_GUIDE[number]['group']) {
  return RACE_KEY_GUIDE.filter(entry => entry.group === group).map(entry => `<div class="loading-control-row" data-control="${entry.id}" data-key-codes="${entry.codes.join(' ')}"><dt>${keycaps(entry)}</dt><dd><span${entry.id === 'drift' ? ' id="loadingDriftHelp"' : ''}>${entry.text}</span>${'note' in entry ? `<small>${entry.note}</small>` : ''}</dd></div>`).join('');
}
function mouseIcon(part: 'move' | 'left' | 'right') {
  return `<svg class="loading-mouse loading-mouse-${part}" viewBox="0 0 40 48" aria-hidden="true"><rect x="10" y="5" width="20" height="34" rx="10"/><path class="mouse-left" d="M20 5A10 10 0 0 0 10 15v5h10Z"/><path class="mouse-right" d="M20 5a10 10 0 0 1 10 10v5H20Z"/><path class="mouse-divider" d="M20 6v14M11 20h18"/><path class="mouse-motion" d="m6 14-4 4 4 4m28-8 4 4-4 4"/></svg>`;
}

const DESKTOP_GUIDE_CONTENT = `
  <header class="loading-controls-heading"><h2 id="loadingControlsTitle">键鼠操作</h2><span>比赛开始后使用</span></header>
  <div class="loading-control-columns">
    <section class="loading-control-group" aria-labelledby="loadingDrivingTitle"><h3 id="loadingDrivingTitle">驾驶与道具</h3><dl>${rows('driving')}</dl></section>
    <section class="loading-control-group" aria-labelledby="loadingCameraTitle"><h3 id="loadingCameraTitle">视角与鼠标</h3><dl>${rows('camera')}</dl>
      <dl class="loading-mouse-guide">
        <div data-mouse-control="orbit"><dt>${mouseIcon('move')}<span>移动鼠标</span></dt><dd>环顾四周<small>先左键单击赛道锁定鼠标</small></dd></div>
        <div data-mouse-control="drag"><dt>${mouseIcon('left')}<span>左键拖动</span></dt><dd>无法锁定时环顾<small>按住左键拖动赛道画面</small></dd></div>
        <div data-mouse-control="rear"><dt>${mouseIcon('right')}<span>按住右键</span></dt><dd>向后看<small>松开恢复原视角</small></dd></div>
      </dl>
    </section>
  </div>
  <section class="loading-control-secondary" aria-label="暂停与菜单操作"><dl class="loading-pause-guide">${rows('pause')}</dl><dl class="loading-ready-guide">${rows('ready')}</dl><p>下载中不能用 Enter 跳过；聚焦按钮后，Enter / Space 可确认</p></section>
`;

const TOUCH_GUIDE_CONTENT = `
  <header class="loading-controls-heading"><h2>触屏驾驶</h2><span>建议横屏 · 可切换键鼠模式</span></header>
  <div class="loading-control-columns">
    <section class="loading-control-group"><h3>双手驾驶</h3><dl>
      <div class="loading-control-row"><dt>◀ / ▶</dt><dd>左手左右转向</dd></div>
      <div class="loading-control-row"><dt>↑ 油门</dt><dd>右手按住加速</dd></div>
      <div class="loading-control-row"><dt>↓ 倒车</dt><dd>先刹车，再倒车</dd></div>
      <div class="loading-control-row"><dt>刹车 / 漂移</dt><dd>独立刹车 · <span id="loadingDriftHelp">手刹漂移</span>时配合转向</dd></div>
    </dl></section>
    <section class="loading-control-group"><h3>道具与视角</h3><dl>
      <div class="loading-control-row"><dt>E / R 道具</dt><dd>点击对应按钮使用<small>两格独立 · 使用后不换位</small></dd></div>
      <div class="loading-control-row"><dt>滑动画面</dt><dd>空白赛道区域拖动环顾</dd></div>
      <div class="loading-control-row"><dt>回看 / 回正</dt><dd>按住回看 · 点击回正</dd></div>
      <div class="loading-control-row"><dt>视角 / 暂停</dt><dd>切换追逐视角 · 暂停比赛</dd></div>
    </dl></section>
  </div>
  <section class="loading-control-secondary"><p>可同时按住油门、转向和漂移；松开漂移释放蓄力加速。加载完成后点击开始</p></section>
`;

export type RaceGuideMode = 'touch' | 'desktop';
/** Exactly one guide is mounted. CSS never decides which instructions are true. */
export function raceControlGuideContent(mode: RaceGuideMode) {
  return mode === 'touch' ? TOUCH_GUIDE_CONTENT : DESKTOP_GUIDE_CONTENT;
}
export function raceControlGuideMarkup(mode: RaceGuideMode) {
  return `<section id="loadingControlsPanel" class="loading-controls ${mode}-control-guide" aria-label="${mode === 'touch' ? '手机触控操作' : '键鼠操作'}">${raceControlGuideContent(mode)}</section>`;
}
export const RACE_CONTROL_GUIDE_MARKUP = raceControlGuideMarkup('desktop');
