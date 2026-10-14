import {resolveMap,type MapId} from './map-profiles';
import {characterIdentity} from './character-identity.js';
/** Authoritative land roster shared by menu, player and opponents. */
export type CharacterId = 'whale'|'gemini'|'gpt'|'claude'|'grok'|'glm';
export type CharacterProfile = {id:CharacterId;label:string;nickname:string;description:string;color:string;emblem:string;acceleration:number;topSpeed:number;steering:number};
export const CHARACTER_PROFILES:readonly Readonly<CharacterProfile>[] = Object.freeze([
 {id:'whale',nickname:'轻快巡游',description:'起步轻快，转向灵活；直线极速稍低。',color:'#77dcea',acceleration:1.1,topSpeed:0.955,steering:1.065},
 {id:'gemini',nickname:'弯道双星',description:'最灵活的弯道选择，起步需要一点耐心。',color:'#a5a4ff',acceleration:0.65,topSpeed:1,steering:1.11},
 {id:'gpt',nickname:'全能伙伴',description:'三项均衡，适合熟悉不同赛道。',color:'#f4e4c8',acceleration:1,topSpeed:1,steering:1},
 {id:'claude',nickname:'起跑专家',description:'加速最强，较温和的极速让节奏更从容。',color:'#eeac8e',acceleration:1.18,topSpeed:0.985,steering:0.99},
 {id:'grok',nickname:'直线先锋',description:'极速最高；请提前为转弯和起步留余量。',color:'#b89bdb',acceleration:0.835,topSpeed:1.025,steering:0.995},
 {id:'glm',nickname:'疾风领航',description:'兼顾极速与转向，起步略慢。',color:'#9cddad',acceleration:0.7,topSpeed:1.02,steering:1.05},
].map(profile=>Object.freeze({...profile,...characterIdentity(profile.id)} as CharacterProfile)));
export function resolveCharacter(id:unknown):Readonly<CharacterProfile>{return CHARACTER_PROFILES.find(profile=>profile.id===id)||CHARACTER_PROFILES[0];}
export const MAP_BASELINES=Object.freeze({coast:Object.freeze({maxSpeed:42,acceleration:18,steering:7}),waterpark:Object.freeze({maxSpeed:22,acceleration:8.6,steering:11})});
export type CharacterMultipliers=Pick<CharacterProfile,'acceleration'|'topSpeed'|'steering'>;
/** This land-only balance pass must not silently change A01 living mounts. */
export const WATER_CHARACTER_MULTIPLIERS:Readonly<Record<CharacterId,Readonly<CharacterMultipliers>>>=Object.freeze({
 whale:Object.freeze({acceleration:1.06,topSpeed:.92,steering:1.02}),gemini:Object.freeze({acceleration:.92,topSpeed:1,steering:1.08}),
 gpt:Object.freeze({acceleration:1,topSpeed:1,steering:1}),claude:Object.freeze({acceleration:1.08,topSpeed:.96,steering:.96}),
 grok:Object.freeze({acceleration:.96,topSpeed:1.08,steering:.96}),glm:Object.freeze({acceleration:.94,topSpeed:1.04,steering:1.02}),
});
export function characterTuning(id:unknown,mapId:MapId,landOverride?:CharacterMultipliers){
 const profile=resolveCharacter(id),land=resolveMap(mapId).vehicle==='kart',base=MAP_BASELINES[land?'coast':'waterpark'];
 const values=land?(landOverride??profile):WATER_CHARACTER_MULTIPLIERS[profile.id];
 if(![values.topSpeed,values.acceleration,values.steering].every(value=>Number.isFinite(value)&&value>0))throw new RangeError('Character tuning must be finite and positive');
 return {maxSpeed:base.maxSpeed*values.topSpeed,acceleration:base.acceleration*values.acceleration,steering:base.steering*values.steering,multipliers:{topSpeed:values.topSpeed,acceleration:values.acceleration,steering:values.steering}};
}
