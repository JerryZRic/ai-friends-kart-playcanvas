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
  {id: 'item', group: 'driving', codes: ['KeyE'], keys: ['E'], labels: ['E'], text: '使用持有道具'},
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

export const RACE_CONTROL_GUIDE_MARKUP = `<section class="loading-controls" aria-labelledby="loadingControlsTitle">
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
</section>`;
