import { pulseTarget, type Combatant,type RouteInteractions } from './npc-tactics';
import type { RaceHudSnapshot } from './race-shell';

/** Match the existing coast release rule exactly; water has its own tuning. */
export const COAST_DRIFT = Object.freeze({ readyAfter: .6, maxCharge: 1.6 });
export const coastDriftReady = (charge: number) => charge > COAST_DRIFT.readyAfter;
export const coastDriftBoost = (charge: number) => coastDriftReady(charge) ? Math.min(2.5, charge * 1.5) : 0;

type Tangent = {x: number; z: number};
type TrackSample = (distance: number) => {t: Tangent};
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const turnAngle = (a: Tangent, b: Tangent) => Math.abs(Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z));

/** Coast rivals lift before stronger bends and recover on exits. Two overlapping
 * 22m windows avoid cancelling the opposite turns of the downhill chicane.
 * Only track geometry and the rival's speed are read: no player/rank catch-up.
 * driveSpeed still owns acceleration/braking; this never sets speed directly. */
export function coastCornerPace(distance: number, speed: number, sample: TrackSample) {
  const approach = clamp(Math.max(0, speed) * .3, 0, 16);
  const a = sample(distance).t, b = sample(distance + 22).t;
  const c = sample(distance + approach).t, d = sample(distance + approach + 22).t;
  const angle = Math.max(turnAngle(a, b), turnAngle(c, d));
  const t = clamp((angle - .18) / .47, 0, 1);
  return 1 - .14 * t * t * (3 - 2 * t);
}

export function coastHudFeedback(actor: Combatant, racers: readonly Combatant[], length: number,
  charge: number, label: (id: string) => string,routes?:RouteInteractions): Pick<RaceHudSnapshot, 'chargeMax' | 'chargeLabel' | 'chargeState' | 'itemHelp'> {
  const ready = coastDriftReady(charge), full = charge >= COAST_DRIFT.maxCharge;
  const chargeState = full ? 'full' : ready ? 'ready' : charge > 0 ? 'charging' : 'idle';
  const effects = [actor.boost > 0 ? `加速 ${actor.boost.toFixed(1)} 秒` : '', actor.shield > 0 ? `护盾 ${actor.shield.toFixed(1)} 秒` : '', actor.slow > 0 ? `减速 ${actor.slow.toFixed(1)} 秒` : ''].filter(Boolean).join(' · ');
  const drift = ready ? `${full ? '蓄力已满' : '漂移就绪'} · 松开 Shift 加速 ${coastDriftBoost(charge).toFixed(1)} 秒` : charge > 0 ? '漂移蓄力中 · 继续保持转向' : Math.abs(actor.speed) < .1 ? '按住 W 油门起步' : '左 Shift + A / D 手刹漂移';
  let itemHelp: string | undefined;
  if (actor.held === 'pulse') {
    const target = pulseTarget(actor, racers, length,routes);
    itemHelp = target ? `${label(target.id)}${target.shield > 0 ? ' 有护盾 · 脉冲会被挡住' : ' · E 发射脉冲'}` : '前方无目标 · E 转为 1.9 秒加速';
  } else if (actor.held === 'boost') itemHelp = 'E 加速 3.3 秒 · 适合出弯直线';
  else if (actor.held === 'shield') itemHelp = 'E 护盾 6 秒 · 抵挡碰撞与脉冲';
  return {chargeMax: COAST_DRIFT.maxCharge, chargeLabel: charge > 0 ? drift : effects || drift, chargeState, itemHelp};
}
