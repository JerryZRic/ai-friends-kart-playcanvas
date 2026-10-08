import {resolveCharacter,type CharacterId} from './character-profiles';
import {resolveMap,type MapId} from './map-profiles';
export type MenuScreen='main'|'maps'|'characters'|'settings'|'exit';
export type MenuState={screen:MenuScreen;map:MapId;driver:CharacterId;returnTo:'main'|'maps'|'characters'};
export function parseMenuState(search:string):MenuState{
 const p=new URLSearchParams(search),screen=p.get('screen'),back=p.get('return');
 return {screen:['maps','characters','settings','exit'].includes(screen||'')?screen as MenuScreen:'main',map:resolveMap(p.get('map')).id as MapId,driver:resolveCharacter(p.get('driver')).id,returnTo:back==='maps'||back==='characters'?back:'main'};
}
export function menuQuery(state:MenuState):string{
 const p=new URLSearchParams();if(state.screen!=='main')p.set('screen',state.screen);
 if(state.screen==='characters'||state.screen==='settings'){p.set('map',state.map);p.set('driver',state.driver);}
 if(state.screen==='settings')p.set('return',state.returnTo);
 return p.size?'?'+p.toString():'';
}
export function raceEntry(map:MapId,driver:unknown):string{return `${resolveMap(map).entry}?driver=${resolveCharacter(driver).id}&autostart=1`;}
