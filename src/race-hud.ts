import { mountRaceUiLayout } from './race-ui-layout';

/** Canonical race interface shared by coast and waterpark. Map adapters update
 * these common IDs; loading and finish presentation are shared as well. */
export const RACE_HUD_MARKUP = `<canvas id="game" tabindex="0" aria-label="真实 3D 卡丁车赛道"></canvas><div id="vignette"></div><div class="top"><div><div class="brand">NEON<i> KART</i><sup style="font-size:9px;letter-spacing:1px;margin-left:6px;font-style:normal">3D</sup></div><div class="sub" id="raceSubtitle">SUNSET COAST GRAND PRIX</div><div id="raceDriverIdentity" class="race-driver-identity" aria-label="当前选手"></div></div><div class="hud game-ui"><div><div class="label">POSITION</div><div class="value" id="rank">1 <small>/ 6</small></div></div><div><div class="label">LAP</div><div class="value" id="lap">1 <small>/ 3</small></div></div><div><div class="label">TIME</div><div class="value" id="timer">0:00</div></div></div><div class="tools"><button class="icon" id="camera" title="切换视角 / Z" aria-label="切换视角">◉</button><button class="icon" id="sound" title="音效开关" aria-label="音效开关">♪</button><button class="icon game-ui" id="pause" title="暂停 / Esc / P" aria-label="暂停">Ⅱ</button><span id="raceSettings"></span></div></div><canvas id="map" class="game-ui" width="260" height="230" aria-label="赛道进度图"></canvas><div class="toast" id="toast" role="status" aria-live="polite"></div><div class="center" id="count" role="status" aria-live="polite"></div><div class="bottom game-ui"><div><div class="speed"><span id="speed">0</span> <small>KM/H</small></div><div class="meter"><div class="fill" id="charge"></div></div><div class="hint" id="chargeLabel">按住 W 油门起步</div></div><button class="item" id="item"><img id="itemImage" width="80" height="80" alt="" hidden><div class="itemCopy"><span>ITEM / E 使用</span><strong id="itemName">◇ 等待道具</strong><span id="itemHelp">撞箱拾取 · 问号为随机道具</span></div></button></div><div id="lookHint" class="look-hint game-ui">单击赛道，移动鼠标环顾 · Q 回正 · Esc 暂停</div><div class="touch"><div class="group"><button data-key="ArrowLeft" aria-label="左转">◀</button><button data-key="ArrowRight" aria-label="右转">▶</button></div><div class="group"><button class="drift" data-key="ShiftLeft" aria-label="手刹漂移">漂移</button><button data-key="Space" aria-label="刹车">刹车</button><button data-key="KeyS" aria-label="刹车与倒车">倒车</button><button class="throttle" data-key="KeyW" aria-label="油门">油门</button></div></div><section id="pausePanel" class="pause-panel hidden" role="dialog" aria-modal="true" aria-label="比赛暂停"><div class="pause-actions"><h2>比赛已暂停</h2><button id="resumeRace">继续比赛</button><button id="restartRace">重新开始</button><button id="pauseChangeMap">更换地图</button><button id="pauseMenu">返回主菜单</button></div></section>`;

export const RACE_CONTROL_HELP = `<b>W</b> 油门　<b>S</b> 刹车 / 倒车　<b>A D</b> 左 / 右转<br><b>空格</b> 刹车　<b>Shift</b> 漂移 / 水上滑移　<b>Z / C</b> 视角<br><b>鼠标右键</b> 回看　<b>E</b> 使用道具　<b>Esc</b> 暂停<br><b>单击赛道</b> 移动鼠标环顾　<b>Q</b> 视角回正`;

export type RaceHudOptions = { subtitle: string; canvasLabel: string };

export function mountRaceHud({subtitle, canvasLabel}: RaceHudOptions, doc: Document = document) {
  const host = doc.getElementById('raceHud');
  if (!host) throw new Error('Missing shared race HUD mount');
  host.innerHTML = RACE_HUD_MARKUP;
  const instructions=doc.getElementById('instructions');
  if(instructions)instructions.innerHTML=RACE_CONTROL_HELP;
  doc.getElementById('raceSubtitle')!.textContent = subtitle;
  const canvas = doc.getElementById('game') as HTMLCanvasElement;
  canvas.setAttribute('aria-label', canvasLabel);
  // Mount before the map adapter begins WebGL or asynchronous asset setup.
  mountRaceUiLayout(doc, canvas);
  return canvas;
}
