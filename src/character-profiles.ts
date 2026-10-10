import {characterIdentity} from './character-identity.js';
/** One authoritative, balanced roster shared by menu, player and opponents. */
export type CharacterId = 'whale'|'gemini'|'gpt'|'claude'|'grok'|'glm';
export type CharacterProfile = {id:CharacterId;label:string;nickname:string;description:string;color:string;emblem:string;acceleration:number;topSpeed:number;steering:number};
export const CHARACTER_PROFILES:readonly Readonly<CharacterProfile>[] = Object.freeze([
 {id:'whale',nickname:'轻快巡游',description:'起步轻快，转向灵活；直线极速稍低。',color:'#77dcea',acceleration:1.06,topSpeed:.92,steering:1.02},
 {id:'gemini',nickname:'弯道双星',description:'最灵活的弯道选择，起步需要一点耐心。',color:'#a5a4ff',acceleration:.92,topSpeed:1,steering:1.08},
 {id:'gpt',nickname:'全能伙伴',description:'三项均衡，适合熟悉两张赛道。',color:'#f4e4c8',acceleration:1,topSpeed:1,steering:1},
 {id:'claude',nickname:'起跑专家',description:'加速最强，较温和的极速让节奏更从容。',color:'#eeac8e',acceleration:1.08,topSpeed:.96,steering:.96},
 {id:'grok',nickname:'直线先锋',description:'极速最高；请提前为转弯和起步留余量。',color:'#b89bdb',acceleration:.96,topSpeed:1.08,steering:.96},
 {id:'glm',nickname:'疾风领航',description:'兼顾极速与转向，起步略慢。',color:'#9cddad',acceleration:.94,topSpeed:1.04,steering:1.02},
].map(profile=>Object.freeze({...profile,...characterIdentity(profile.id)} as CharacterProfile)));
export function resolveCharacter(id:unknown):Readonly<CharacterProfile>{return CHARACTER_PROFILES.find(profile=>profile.id===id)||CHARACTER_PROFILES[0];}
export const MAP_BASELINES=Object.freeze({coast:Object.freeze({maxSpeed:42,acceleration:18,steering:7}),waterpark:Object.freeze({maxSpeed:22,acceleration:8.6,steering:11})});
export function characterTuning(id:unknown,mapId:'coast'|'waterpark'){
 const profile=resolveCharacter(id),base=MAP_BASELINES[mapId]||MAP_BASELINES.coast;
 return {maxSpeed:base.maxSpeed*profile.topSpeed,acceleration:base.acceleration*profile.acceleration,steering:base.steering*profile.steering,multipliers:{topSpeed:profile.topSpeed,acceleration:profile.acceleration,steering:profile.steering}};
}
