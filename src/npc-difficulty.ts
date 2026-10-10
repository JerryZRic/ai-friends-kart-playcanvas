import type { Difficulty } from './race-options';

/** Skill only changes decisions and input timing. Never feed these values into
 * kart/character tuning, part selection, item strength or collision rules. */
export const NPC_SKILLS = Object.freeze({
  easy: Object.freeze({decision: .55, reaction: 1.25, lookAhead: 14, cornerReserve: .26, lineWander: 2.4, apex: .3, pickupLookAhead: 24, boostBend: .12, driftBend: .52, driftCharge: .78}),
  normal: Object.freeze({decision: .28, reaction: .65, lookAhead: 22, cornerReserve: .16, lineWander: 1.1, apex: 1.5, pickupLookAhead: 36, boostBend: .23, driftBend: .30, driftCharge: 1.12}),
  hard: Object.freeze({decision: .12, reaction: .3, lookAhead: 32, cornerReserve: .07, lineWander: .25, apex: 2.3, pickupLookAhead: 48, boostBend: .3, driftBend: .18, driftCharge: 1.5}),
});
export type NpcSkill = typeof NPC_SKILLS[Difficulty];
export const npcSkill = (difficulty: Difficulty): NpcSkill => NPC_SKILLS[difficulty] || NPC_SKILLS.normal;
export function seededRandom(initial: number) {
  let seed = initial >>> 0;
  return () => {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296;};
}
export function npcLine(distance: number, phase: number, bend: number, skill: NpcSkill) {
  return Math.sin(distance / 90 + phase) * skill.lineWander - Math.sign(bend) * Math.min(1, Math.abs(bend) / .4) * skill.apex;
}
/** Deliberate early braking and recovery, using real brake/coast/throttle inputs.
 * The target is a driver's chosen pace, never an altered engine speed limit. */
export function npcDriving(speed: number, maxSpeed: number, bend: number, skill: NpcSkill, charge = 0, laneError = 0) {
  const turn = Math.min(1, Math.abs(bend) / .65);
  const target = maxSpeed * (1 - turn * skill.cornerReserve);
  const brake = speed > target + .8;
  const drift = !brake && speed > maxSpeed * .4 && Math.abs(bend) > skill.driftBend && charge < skill.driftCharge && Math.abs(laneError) < 3;
  return {throttle: !brake, brake, handbrake: drift, drift, target};
}
