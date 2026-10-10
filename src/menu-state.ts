import {resolveCharacter,type CharacterId} from './character-profiles';
import {resolveMap,type MapId} from './map-profiles';
import {validateBuild} from './kart-build';
import {parseRaceOptions,raceOptionsQuery,type RaceOptions} from './race-options';
export type MenuScreen='main'|'maps'|'characters'|'vehicles'|'race-settings'|'settings'|'exit';
export type MenuState=RaceOptions&{screen:MenuScreen;map:MapId;driver:CharacterId;returnTo:Exclude<MenuScreen,'settings'|'exit'>;kart?:string};
function kartValue(raw:unknown):string|undefined{
 if(typeof raw!=='string'||raw.length>4000)return;
 try{const value:unknown=JSON.parse(raw);if(validateBuild(value))return JSON.stringify(value);}catch{/* Corrupt links never prevent menu navigation. */}
}
export function parseMenuState(search:string):MenuState{
 const p=new URLSearchParams(search),screen=p.get('screen'),back=p.get('return'),kart=kartValue(p.get('kart'));
 return {screen:['maps','characters','vehicles','race-settings','settings','exit'].includes(screen||'')?screen as MenuScreen:'main',map:resolveMap(p.get('map')).id as MapId,driver:resolveCharacter(p.get('driver')).id,returnTo:back==='maps'||back==='characters'||back==='vehicles'||back==='race-settings'?back:'main',...parseRaceOptions(search),...(kart?{kart}:{})};
}
export function menuQuery(state:MenuState):string{
 const p=new URLSearchParams(raceOptionsQuery(state));if(state.screen!=='main')p.set('screen',state.screen);
 p.set('map',state.map);p.set('driver',state.driver);
 if(state.screen==='settings')p.set('return',state.returnTo);
 const kart=kartValue(state.kart);if(kart)p.set('kart',kart);
 return '?'+p.toString();
}
export function raceEntry(map:MapId,driver:unknown,options?:RaceOptions&{kart?:string}):string{
 const p=new URLSearchParams({driver:resolveCharacter(driver).id,autostart:'1'});
 if(map!=='coast'&&resolveMap(map).vehicle==='kart')p.set('map',map);
 if(options){new URLSearchParams(raceOptionsQuery(options)).forEach((v,k)=>p.set(k,v));const kart=kartValue(options.kart);if(resolveMap(map).vehicle==='kart'&&kart)p.set('kart',kart);}
 return `${resolveMap(map).entry}?${p.toString()}`;
}
/** The workshop is a separate page so preview resources are released on navigation. */
export function garageEntry(driver:unknown,options?:RaceOptions&{kart?:string;map?:MapId}):string{
 const p=new URLSearchParams({driver:resolveCharacter(driver).id});
 if(options){p.set('flow','free');p.set('map',resolveMap(options.map).vehicle==='kart'?resolveMap(options.map).id:'coast');new URLSearchParams(raceOptionsQuery(options)).forEach((v,k)=>p.set(k,v));const kart=kartValue(options.kart);if(kart)p.set('kart',kart);}
 return `./garage.html?${p.toString()}`;
}
