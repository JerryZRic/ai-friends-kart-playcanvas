import './balance-lab.css';
import { CHARACTER_PROFILES } from './character-profiles';
import { createCpuRace, type CpuRaceResult, type CpuSimulationOptions } from './land-cpu-simulation';
import { LAND_SIMULATION_MAPS, loadLandSimulationCourse, type LandSimulationCourse, type LandSimulationMap } from './land-simulation-course';

type Race = ReturnType<typeof createCpuRace>;
type Phase = 'idle' | 'loading' | 'running' | 'paused' | 'complete' | 'error';
type Point = { x: number; z: number };
const STEP = 1 / 60;
const FRAME_BUDGET_MS = 5;
const MAX_STEPS_PER_FRAME = 120;
const MAP_NAMES = ['日落海岸', '云岭盘山道', '灯阶旧城环线', '赤砾采石环道', '杉影星台环线', '发条工坊回旋道', '谷风麦垄回环', '星砂古驿', '霜环雪站', '玄岩环冕', '蔓穹花园', '铜翼空港'];
const profiles = new Map(CHARACTER_PROFILES.map(profile => [profile.id, profile]));
const element = <T extends HTMLElement>(id: string) => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing balance lab element: ${id}`);
  return found as T;
};
const form = element<HTMLFormElement>('race-form');
const settings = element<HTMLFieldSetElement>('race-settings');
const mapSelect = element<HTMLSelectElement>('map');
const seedInput = element<HTMLInputElement>('seed');
const rotationSelect = element<HTMLSelectElement>('rotation');
const difficultySelect = element<HTMLSelectElement>('difficulty');
const equipmentSelect = element<HTMLSelectElement>('equipment');
const itemsSelect = element<HTMLSelectElement>('items');
const startButton = element<HTMLButtonElement>('start');
const pauseButton = element<HTMLButtonElement>('pause');
const jsonButton = element<HTMLButtonElement>('download-json');
const csvButton = element<HTMLButtonElement>('download-csv');
const status = element<HTMLParagraphElement>('status');
const standings = element<HTMLTableSectionElement>('standings');
const canvas = element<HTMLCanvasElement>('track-map');
const context = canvas.getContext('2d');
const summaryButton = element<HTMLButtonElement>('load-summary');
const summaryStatus = element<HTMLParagraphElement>('summary-status');

for (const [index, id] of LAND_SIMULATION_MAPS.entries()) {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = `${String(index + 1).padStart(2, '0')} · ${MAP_NAMES[index]}`;
  mapSelect.append(option);
}

let phase: Phase = 'idle';
let generation = 0;
let frame: number | null = null;
let race: Race | null = null;
let finalResult: CpuRaceResult | null = null;
let lastPaint = -Infinity;
let trackPaths: Point[][] = [];
let project: (point: Point) => { x: number; y: number } = () => ({ x: 0, y: 0 });
let summaryRequest: AbortController | null = null;
let summaryGeneration = 0;
const downloadUrls = new Map<string, ReturnType<typeof setTimeout>>();

function setPhase(next: Phase, message: string) {
  phase = next;
  const busy = next === 'loading' || next === 'running' || next === 'paused';
  settings.disabled = busy;
  startButton.disabled = busy;
  startButton.textContent = next === 'complete' ? '再跑一场' : '运行一场';
  pauseButton.disabled = next !== 'running' && next !== 'paused';
  pauseButton.textContent = next === 'paused' ? '继续' : '暂停';
  jsonButton.disabled = csvButton.disabled = finalResult === null;
  status.dataset.phase = next;
  status.textContent = message;
}

function cancelFrame() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
}

function emptyView() {
  element('elapsed').replaceChildren('0.00', unit(' 秒'));
  element('finish-count').replaceChildren('0', unit(' / 6'));
  element('course-label').textContent = '尚未载入';
  element('result-note').textContent = '等待开始';
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 7;
  cell.className = 'empty-state';
  cell.textContent = '运行后显示六位 CPU 的真实比赛数据';
  row.append(cell);
  standings.replaceChildren(row);
  trackPaths = [];
  drawMap();
}

function reset() {
  generation++;
  cancelFrame();
  race = null;
  finalResult = null;
  lastPaint = -Infinity;
  emptyView();
  setPhase('idle', '已重置；当前设置保留，可重新运行');
}

function unit(text: string) {
  const span = document.createElement('span');
  span.textContent = text;
  return span;
}

function buildMap(course: LandSimulationCourse) {
  const paths = course.routes
    ? Object.values(course.routes.edges).map(edge => ({ length: edge.length, sample: (distance: number) => edge.sample(distance).p }))
    : [{ length: course.length, sample: (distance: number) => course.sample(distance).p }];
  trackPaths = paths.map(path => {
    const count = Math.max(30, Math.min(500, Math.ceil(path.length / 5)));
    return Array.from({ length: count + 1 }, (_, index) => {
      const point = path.sample(index * path.length / count);
      return { x: point.x, z: point.z };
    });
  });
  const points = trackPaths.flat();
  const minX = Math.min(...points.map(point => point.x)), maxX = Math.max(...points.map(point => point.x));
  const minZ = Math.min(...points.map(point => point.z)), maxZ = Math.max(...points.map(point => point.z));
  const scale = Math.min((canvas.width - 80) / Math.max(1, maxX - minX), (canvas.height - 80) / Math.max(1, maxZ - minZ));
  project = point => ({ x: canvas.width / 2 + (point.x - (minX + maxX) / 2) * scale, y: canvas.height / 2 + (point.z - (minZ + maxZ) / 2) * scale });
}

function drawMap() {
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!trackPaths.length) {
    context.fillStyle = '#b0becb';
    context.font = '22px system-ui';
    context.textAlign = 'center';
    context.fillText('运行后显示赛道与 CPU 位置', canvas.width / 2, canvas.height / 2);
    return;
  }
  context.lineJoin = context.lineCap = 'round';
  for (const path of trackPaths) {
    context.beginPath();
    path.forEach((point, index) => {
      const projected = project(point);
      if (index === 0) context.moveTo(projected.x, projected.y);
      else context.lineTo(projected.x, projected.y);
    });
    context.strokeStyle = '#344a5b';
    context.lineWidth = 12;
    context.stroke();
    context.strokeStyle = '#6e8492';
    context.lineWidth = 2;
    context.stroke();
  }
  if (!race) return;
  for (const actor of race.actors) {
    const point = project(race.position(actor));
    context.beginPath();
    context.arc(point.x, point.y, 11, 0, Math.PI * 2);
    context.fillStyle = profiles.get(actor.characterId)?.color ?? '#ffffff';
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = '#101820';
    context.stroke();
    context.fillStyle = '#101820';
    context.font = 'bold 14px system-ui';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(String(actor.seat + 1), point.x, point.y + .5);
  }
}

function render() {
  if (!race) return;
  const snapshot = finalResult ?? race.result();
  element('elapsed').replaceChildren(snapshot.elapsed.toFixed(2), unit(' 秒'));
  element('finish-count').replaceChildren(String(snapshot.racers.filter(actor => !actor.dnf).length), unit(' / 6'));
  const rows = snapshot.racers.map(actor => {
    const row = document.createElement('tr');
    const profile = profiles.get(actor.characterId);
    const liveActor = race!.actors.find(candidate => candidate.id === actor.id)!;
    const values = [String(actor.rank), '', `${actor.laps} / 3`, liveActor.speed.toFixed(1), actor.finishedAt !== null ? `${actor.finishedAt.toFixed(3)} 秒` : race!.done ? 'DNF' : '比赛中', `${actor.pickups} / ${actor.uses}`, `${actor.collisionCount} / ${actor.railContacts}`];
    for (const [index, value] of values.entries()) {
      const cell = document.createElement('td');
      if (index === 1) {
        const label = document.createElement('span');
        label.className = 'racer-label';
        const dot = document.createElement('span');
        dot.className = 'racer-dot';
        dot.style.backgroundColor = profile?.color ?? '#ffffff';
        const seat = unit(`席位 ${actor.seat + 1}`);
        seat.className = 'seat';
        label.append(dot, profile?.label ?? actor.characterId.toUpperCase(), seat);
        cell.append(label);
      } else cell.textContent = value;
      row.append(cell);
    }
    return row;
  });
  standings.replaceChildren(...rows);
  drawMap();
}

function schedule(token: number) {
  if (frame !== null || phase !== 'running' || token !== generation) return;
  frame = requestAnimationFrame(() => tick(token));
}

function tick(token: number) {
  frame = null;
  if (token !== generation || phase !== 'running' || !race) return;
  try {
    const began = performance.now();
    // Wall time only bounds UI work; simulation always advances exactly STEP.
    for (let steps = 0; steps < MAX_STEPS_PER_FRAME && !race.done; steps++) {
      race.step(STEP);
      if (performance.now() - began >= FRAME_BUDGET_MS) break;
    }
    const now = performance.now();
    if (race.done) {
      finalResult = race.result();
      const winner = finalResult.winner ? profiles.get(finalResult.winner)?.label ?? finalResult.winner : null;
      element('result-note').textContent = winner ? `本场第一名：${winner}${finalResult.timeout ? '；仍有车手超时未完赛' : ''}` : '本场没有车手完成三圈';
      setPhase('complete', finalResult.timeout ? '达到 600 秒模拟上限；未完赛车手标为 DNF，完整诊断可下载' : '六位 CPU 均已完赛；可下载本场结果或重新运行');
      render();
      return;
    }
    if (now - lastPaint >= 100) {
      render();
      lastPaint = now;
    }
    schedule(token);
  } catch (error) {
    cancelFrame();
    finalResult = null;
    setPhase('error', `模拟中止：${error instanceof Error ? error.message : String(error)}。可重置后重试`);
  }
}

async function start() {
  if (phase === 'loading' || phase === 'running' || phase === 'paused' || !form.reportValidity()) return;
  const map = mapSelect.value as LandSimulationMap;
  const seed = Number(seedInput.value);
  const rotation = Number(rotationSelect.value);
  const difficulty = difficultySelect.value;
  const equipment = equipmentSelect.value;
  if (!LAND_SIMULATION_MAPS.includes(map) || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !Number.isInteger(rotation) || rotation < 0 || rotation > 5 || !['easy', 'normal', 'hard'].includes(difficulty) || !['equal', 'mixed'].includes(equipment) || !['on', 'off'].includes(itemsSelect.value)) {
    setPhase('error', '参数无效；请检查地图、种子和比赛选项');
    return;
  }
  const options: CpuSimulationOptions = { seed, rotation, difficulty: difficulty as CpuSimulationOptions['difficulty'], equipment: equipment as CpuSimulationOptions['equipment'], items: itemsSelect.value === 'on' };
  const token = ++generation;
  cancelFrame();
  race = null;
  finalResult = null;
  lastPaint = -Infinity;
  emptyView();
  setPhase('loading', '正在载入赛道；可随时重置取消');
  try {
    const course = await loadLandSimulationCourse(map);
    if (token !== generation) return;
    race = createCpuRace(course, options);
    buildMap(course);
    const index = LAND_SIMULATION_MAPS.indexOf(map);
    element('course-label').textContent = `${String(index + 1).padStart(2, '0')} · ${MAP_NAMES[index]}`;
    element('result-note').textContent = `种子 ${seed} · 轮换 ${rotation} · ${equipment === 'equal' ? '相同装备' : '混合预设'} · 道具${options.items ? '开启' : '关闭'}`;
    setPhase(document.hidden ? 'paused' : 'running', document.hidden ? '赛道已载入；页面在后台，点击继续开始计算' : '正在运行六 CPU 实验；可以暂停或重置');
    render();
    schedule(token);
  } catch (error) {
    if (token !== generation) return;
    race = null;
    setPhase('error', `载入失败：${error instanceof Error ? error.message : String(error)}。可重置更换地图，或刷新页面重试`);
  }
}

function pause(message = '已暂停；继续将从相同物理步恢复') {
  if (phase !== 'running') return;
  cancelFrame();
  setPhase('paused', message);
  render();
}

function csvValue(value: unknown) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function resultCsv(result: CpuRaceResult) {
  const { racers, ...scenario } = result;
  const fields = [...Object.keys(scenario), ...Object.keys(racers[0])];
  return [fields.join(','), ...racers.map(actor => {
    const record = { ...scenario, ...actor };
    return fields.map(field => csvValue(record[field])).join(',');
  })].join('\r\n');
}

function download(format: 'json' | 'csv') {
  if (!finalResult) return;
  const content = format === 'json' ? JSON.stringify(finalResult, null, 2) : '\ufeff' + resultCsv(finalResult);
  const blob = new Blob([content], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `cpu-${finalResult.map}-seed${finalResult.seed}-r${finalResult.rotation}-${finalResult.difficulty}-${finalResult.equipment}-${finalResult.items ? 'items' : 'noitems'}.${format}`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser time to consume the download, then release its blob.
  downloadUrls.set(url, setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.delete(url); }, 1000));
}

async function loadSummary() {
  if (summaryRequest) return;
  const token = ++summaryGeneration;
  const controller = new AbortController();
  summaryRequest = controller;
  summaryButton.disabled = true;
  summaryStatus.textContent = '正在读取当前预览附带的汇总…';
  element<HTMLDetailsElement>('summary-details').hidden = true;
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('./balance-results/summary.json', { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const report = await response.json();
    if (token !== summaryGeneration) return;
    if (!report || typeof report !== 'object') throw new Error('Invalid report');
    element('summary-content').textContent = JSON.stringify(report, null, 2);
    element<HTMLDetailsElement>('summary-details').hidden = false;
    summaryStatus.textContent = '已读取随包报告；这是已有批量结果，与上方当前单场实验分开';
  } catch {
    if (token !== summaryGeneration) return;
    summaryStatus.textContent = '当前预览未提供可读取的批量汇总，或读取失败。仍可运行并下载上方的单场实验';
  } finally {
    clearTimeout(timeout);
    if (token === summaryGeneration) {
      summaryRequest = null;
      summaryButton.disabled = false;
    }
  }
}

form.addEventListener('submit', event => { event.preventDefault(); void start(); });
element('reset').addEventListener('click', reset);
pauseButton.addEventListener('click', () => {
  if (phase === 'running') pause();
  else if (phase === 'paused') {
    setPhase('running', '继续运行六 CPU 实验');
    schedule(generation);
  }
});
jsonButton.addEventListener('click', () => download('json'));
csvButton.addEventListener('click', () => download('csv'));
summaryButton.addEventListener('click', () => { void loadSummary(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause('页面已离开前台，实验自动暂停；返回后点击继续'); });
window.addEventListener('pagehide', () => {
  pause('页面已暂停；点击继续恢复实验');
  if (phase === 'loading') reset();
  cancelFrame();
  summaryGeneration++;
  summaryRequest?.abort();
  summaryRequest = null;
  summaryButton.disabled = false;
  if (summaryStatus.textContent?.includes('正在读取')) summaryStatus.textContent = '报告读取已取消，可重新读取';
  for (const [url, timeout] of downloadUrls) { clearTimeout(timeout); URL.revokeObjectURL(url); }
  downloadUrls.clear();
});

emptyView();
