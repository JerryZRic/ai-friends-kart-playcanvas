/** Display-only scales. These never feed back into vehicle or character tuning. */
export type GarageCombinedStats = Readonly<{acceleration: number; speed: number; handling: number; stability: number}>;
export type GarageActiveStat = 'acceleration' | 'speed' | 'handling';
export const GARAGE_STAT_KEYS: readonly GarageActiveStat[] = Object.freeze(['acceleration', 'speed', 'handling']);

/** Fixed, independent coast scales enclose every current character × vehicle clamp.
 * The lower end means zero DISPLAY segments, not zero performance. Rounded outer
 * bounds keep comparisons stable when a part/character changes; do not normalize
 * to the currently selected pair, or a tiny upgrade would always look like 5/5.
 * Values are game acceleration, HUD-converted game speed, and steering coefficient,
 * respectively. SI design estimates must not be passed as these gameplay values. */
export const GARAGE_STAT_SCALES = Object.freeze({
  acceleration: Object.freeze({label: '加速', min: 12, max: 24, unit: '游戏单位/s²', digits: 2}),
  speed: Object.freeze({label: '极速', min: 120, max: 190, unit: 'km/h（HUD）', digits: 1}),
  handling: Object.freeze({label: '操控', min: 5.5, max: 9, unit: '游戏转向系数', digits: 2}),
});

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const validValue = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]!));
const tidy = (value: number, digits: number) => Number(value.toFixed(digits));
const formatValue = (value: unknown, digits: number) => validValue(value) ? value.toFixed(digits) : '—';

/** Scores are bounded to [0, 5]. Invalid input renders an empty, unavailable meter. */
export function garageStatScore(key: GarageActiveStat, value: number): number {
  if (!validValue(value)) return 0;
  const {min, max} = GARAGE_STAT_SCALES[key];
  return clamp((value - min) / (max - min) * 5, 0, 5);
}

/** Five independent 0–1 fills: 3.2 means [1, 1, 1, .2, 0], never four full bars.
 * Round only floating-point noise, not the score, before computing each fill. */
export function garageStatSegments(score: number): readonly number[] {
  const bounded = Number.isFinite(score) ? clamp(score, 0, 5) : 0;
  return Object.freeze(Array.from({length: 5}, (_, index) => tidy(clamp(bounded - index, 0, 1), 10)));
}

export type GarageStatBarsOptions = Readonly<{
  driverLabel: string;
  /** Displayed values: candidate on hover/focus, otherwise the equipped build. */
  current: GarageCombinedStats;
  /** Baseline: equipped build for a candidate, otherwise the previous build. */
  previous: GarageCombinedStats;
  prospective?: boolean;
}>;

/** Pure escaped HTML. The caller owns selection state and imports the CSS once. */
export function renderGarageStatBars({driverLabel, current, previous, prospective = false}: GarageStatBarsOptions): string {
  const from = prospective ? '当前' : '上次', to = prospective ? '试装' : '当前';
  const comparison = `${from} → ${to}`;
  const rows = GARAGE_STAT_KEYS.map(key => {
    const scale = GARAGE_STAT_SCALES[key], value = current[key], baseline = previous[key];
    const available = validValue(value), comparable = available && validValue(baseline);
    const score = garageStatScore(key, value), scoreText = tidy(score, 3);
    // Match neutrality to the visible precision, so ±0.00 never looks like a change.
    const delta = comparable ? tidy(value - baseline, scale.digits) : null;
    const direction = delta === null || delta === 0 ? 'neutral' : delta > 0 ? 'positive' : 'negative';
    const deltaText = delta === null ? 'Δ —' : delta === 0 ? 'Δ 0' : `Δ ${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(scale.digits)}`;
    const deltaDescription = delta === null ? '比较值不可用' : delta === 0 ? '无变化' : `${delta > 0 ? '增加' : '减少'} ${Math.abs(delta).toFixed(scale.digits)} ${scale.unit}`;
    const range = `${scale.min}–${scale.max} ${scale.unit}`;
    const history = `${from} ${formatValue(baseline, scale.digits)} → ${to} ${formatValue(value, scale.digits)} ${scale.unit}`;
    const help = `${history}；${deltaDescription}。独立标尺 ${range} 线性映射到 0–5 格，超出范围截断；0 格不代表零性能`;
    const accessible = available ? `${formatValue(value, scale.digits)} ${scale.unit}，${scoreText}/5 格；${history}；${deltaDescription}；标尺 ${range}` : '数据不可用';
    return `<div class="garage-stat-row" data-stat="${key}" data-available="${available}" title="${escapeHtml(help)}"><div class="garage-stat-main"><span class="garage-stat-name">${scale.label}</span><span class="garage-stat-meter" role="meter" aria-label="${scale.label} · ${to}" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${scoreText}" aria-valuetext="${escapeHtml(accessible)}">${garageStatSegments(score).map(fill => `<span class="garage-stat-segment" aria-hidden="true"><span class="garage-stat-fill" style="width:${tidy(fill * 100, 8)}%"></span></span>`).join('')}</span></div><div class="garage-stat-detail"><span class="garage-stat-value">${formatValue(value, scale.digits)} <small>${scale.unit}</small></span><small class="garage-stat-delta ${direction}" aria-label="${escapeHtml(`${scale.label}，${comparison}，${deltaDescription}`)}">${deltaText}</small></div></div>`;
  }).join('');
  // Stability remains vehicle-only design metadata. It deliberately has no score,
  // colored delta or benefit language while the rollover mechanic is inactive.
  const stability = formatValue(current.stability, 2);
  const ranges = GARAGE_STAT_KEYS.map(key => {const scale = GARAGE_STAT_SCALES[key]; return `${scale.label} ${scale.min}–${scale.max}`;}).join('、');
  return `<section class="garage-stat-bars" data-comparison="${prospective ? 'candidate' : 'equipped'}" aria-label="${escapeHtml(`${driverLabel} + 赛车属性，${comparison}`)}"><div class="garage-stat-heading"><h3>${escapeHtml(driverLabel)} + 赛车</h3><span>${comparison}</span></div><div class="garage-stat-list">${rows}</div><div class="garage-stat-inactive" data-stat="stability"><span>稳定性 <small>未启用</small></span><span>${stability} <small>g · 设计估计</small></span><p>抗侧翻机制未启用，无当前加成</p></div><p class="garage-stat-scale-note">各项独立标尺 0–5 格：${escapeHtml(ranges)}<br>0 格为标尺下限，不代表零性能</p></section>`;
}
