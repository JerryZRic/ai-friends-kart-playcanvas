import { CHARACTER_PROFILES, type CharacterId } from './character-profiles';
import { KART_SLOTS, type KartBuild, type StarterKartBuild } from './kart-build';

const suffix = {body:'01_BodyShell',chassis:'02_ChassisSuspension',motor:'04_Motor',transmission:'05_FinalDrive',battery:'06_Battery',wheels:'03_WheelsTires'};
const build = (kits: readonly number[]): Readonly<KartBuild> => Object.freeze(Object.fromEntries(KART_SLOTS.map((slot,i)=>[slot,`kit${String(kits[i]).padStart(3,'0')}::${suffix[slot]}`])) as KartBuild);
const preset = (id:string,name:string,description:string,kits:readonly number[]): StarterKartBuild => Object.freeze({id,name,description,build:build(kits)});
/** Fixed authored sidegrades, not randomly assembled equipment or power tiers.
 * Every NPC recipe shares these six archives. No additional theme is downloaded
 * merely to vary paint; the player's freely mixed parts remain unrestricted. */
export const kartPresets: readonly StarterKartBuild[] = Object.freeze([
 preset('balanced','均衡练习车','起步、直线与抓地折中；不是所有路段都最快，可自由换件。',[4,5,3,1,1,1]),
 preset('corner','弯道抓地车','窄壳、低重心底盘和软胎提高转向抓地，轻电池限制功率，直线极速较低。',[5,4,4,6,3,3]),
 preset('straight','长直线车','低风阻车身、高功率电机与长终传偏重直线；起步不及爬坡配方、抓地让步，弯前需早刹车。',[2,6,1,2,4,2]),
 preset('start-hill','起步爬坡车','高扭电机与短终传偏重起步和上坡响应；转速较早限制极速。',[1,3,5,5,1,5]),
 preset('impact','稳控碰撞练习车','加固外观、低重心底盘与弯道胎；重量较高。碰撞减伤、耐久和扶正加成尚未启用。',[6,4,3,6,3,5]),
]);
export const NPC_THEME_BUDGET = 6;
export type NpcKartPreset = Readonly<{characterId:CharacterId;build:Readonly<KartBuild>;presetId:string}>;
/** Character assignment is deterministic; difficulty never improves equipment.
 * This function is coast-only: water racers use living mounts, not these parts. */
export function getNpcPresets(trackId:string,seed:number): readonly NpcKartPreset[] {
 if(trackId!=='coast')return Object.freeze([]);
 const offset=(Number.isFinite(seed)?Math.trunc(seed)>>>0:20261010)%kartPresets.length;
 return Object.freeze(CHARACTER_PROFILES.map((character,i)=>{
  const recipe=kartPresets[(i+offset)%kartPresets.length];
  return Object.freeze({characterId:character.id,build:recipe.build,presetId:recipe.id});
 }));
}
export const coastBuildAdvice = '海岸同时有直线、连续弯和坡段：长终传需要提前刹车，短终传让步极速，抓地胎增加滚阻。推荐只解释取舍，不替你决定最优车。';
