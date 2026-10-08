/** Settings fail closed to known values; blocked browser storage never blocks play. */
export type Quality='low'|'balanced'|'high';
export type GameSettings={version:1;quality:Quality;refraction:boolean};
export const SETTINGS_KEY='ai-friends-kart.settings.v1';
export const DEFAULT_SETTINGS:Readonly<GameSettings>=Object.freeze({version:1,quality:'balanced',refraction:true});
type SettingsStorage=Pick<Storage,'getItem'|'setItem'>;
function browserStorage():SettingsStorage|undefined{try{return globalThis.localStorage;}catch{return undefined;}}
export function sanitizeSettings(value:unknown):GameSettings{
 if(!value||typeof value!=='object'||(value as any).version!==1)return {...DEFAULT_SETTINGS};
 const input=value as Partial<GameSettings>;
 return {version:1,quality:input.quality==='low'||input.quality==='high'?input.quality:'balanced',refraction:typeof input.refraction==='boolean'?input.refraction:DEFAULT_SETTINGS.refraction};
}
export function readGameSettings(storage:SettingsStorage|undefined=browserStorage()):GameSettings{try{return sanitizeSettings(JSON.parse(storage?.getItem(SETTINGS_KEY)||'null'));}catch{return {...DEFAULT_SETTINGS};}}
export function saveGameSettings(value:GameSettings,storage:SettingsStorage|undefined=browserStorage()):boolean{try{if(!storage)return false;storage.setItem(SETTINGS_KEY,JSON.stringify(sanitizeSettings(value)));return true;}catch{return false;}}
export function qualitySettings(quality:Quality){return {pixelRatioCap:quality==='low'?1:1.7,shadows:quality!=='low',shadowResolution:quality==='high'?2048:1024};}
