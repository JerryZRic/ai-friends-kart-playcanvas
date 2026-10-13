import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRaceShell} from '../src/race-shell';
import type {MusicState} from '../src/background-music';
import {MAP_PROFILES} from '../src/map-profiles';
import {raceMusicUrl,bindMusicNavigation,bindMusicSettings,getDocumentMusic,type BackgroundMusic} from '../src/music-ui';

const read=(path:string)=>readFileSync(path,'utf8');
function fakeMusic(){
 const phases:string[]=[];let disposed=false;
 const state={phase:'silent' as any,volume:.65,muted:false,blocked:false,playing:false,settingsSaved:true};
 const listeners=new Set<(state:MusicState)=>void>(),updates=()=>listeners.forEach(fn=>fn({...state}));
 const music={setPhase(phase:string){state.phase=phase;phases.push(phase);},getState:()=>({...state}),unlock(){updates();},silence(){state.phase='silent';phases.push('silent');},preloadRace(){},setMuted(muted:boolean){state.muted=muted;updates();},setVolume(volume:number){state.volume=volume;updates();},subscribe(fn:(state:MusicState)=>void){listeners.add(fn);fn({...state});return()=>{listeners.delete(fn);};},fadeOut:()=>Promise.resolve(),dispose(){disposed=true;}} as BackgroundMusic;
 return {music,phases,state,listeners,get disposed(){return disposed;}};
}

test('shared land and water shell owns precise music phases without owning simulation',()=>{
 for(const map of ['coast','waterpark'] as const){
  const {music,phases}=fakeMusic();
  const elements=new Map<string,any>();
  const el=(id:string)=>{if(!elements.has(id))elements.set(id,{textContent:'',innerHTML:'',style:{},dataset:{},classList:{add(){},remove(){}},setAttribute(){},focus(){}});return elements.get(id);};
  const doc={body:el('body'),getElementById:el} as unknown as Document;
  const shell=createRaceShell(doc,el('canvas'),{map,driver:'whale',music,audioFactory:()=>null});
  assert.deepEqual(phases,[],'resource loading does not begin menu or race music');
  shell.loading();shell.start(3);shell.setPaused(true,3);shell.setPaused(false,3);shell.renderCountdown(0);shell.setPaused(true);shell.setPaused(false);
  shell.finish({rank:1,elapsed:10,selectedDriverId:'whale',racers:[{id:'whale',finishedAt:10,total:300}],trackLength:100});
  shell.start(3);shell.showMenu();
  assert.deepEqual(phases,['silent','silent','silent','silent','race','paused','race','menu','silent','silent']);
  shell.dispose();shell.start();assert.equal(phases.length,10);
 }
});

test('settings update live and unsubscribe when their menu DOM is replaced',()=>{
 class Input extends EventTarget {checked=false;value='';textContent='';}
 const nodes=new Map(['enabled','volume','level','status'].map(id=>[id,new Input()]));
 const root={querySelector:(selector:string)=>nodes.get(selector.slice(12,-1))} as unknown as ParentNode;
 const {music,state,listeners}=fakeMusic();const dispose=bindMusicSettings(root,music);
 assert.equal(nodes.get('enabled')!.checked,true);assert.equal(nodes.get('volume')!.value,'65');
 nodes.get('enabled')!.checked=false;nodes.get('enabled')!.dispatchEvent(new Event('change'));assert.equal(state.muted,true);
 nodes.get('volume')!.value='40';nodes.get('volume')!.dispatchEvent(new Event('input'));assert.equal(state.volume,.4);
 assert.equal(nodes.get('level')!.value,'40%');dispose();assert.equal(listeners.size,0);
 nodes.get('volume')!.value='80';nodes.get('volume')!.dispatchEvent(new Event('input'));assert.equal(state.volume,.4);
});

test('latest navigation wins and disposal/history cancel a pending fade navigation',async()=>{
 const waits:Array<()=>void>=[];const fake=fakeMusic();fake.music.fadeOut=()=>new Promise(resolve=>waits.push(resolve));
 const win=Object.assign(new EventTarget(),{location:{href:'https://example.test/dev/index.html',origin:'https://example.test'}});
 const doc=Object.assign(new EventTarget(),{defaultView:win}) as unknown as Document;
 const nav=bindMusicNavigation(doc,fake.music);
 nav.navigate('coast.html');nav.navigate('waterpark.html');waits[0]();await Promise.resolve();assert.match(win.location.href,/index.html$/);
 waits[1]();await Promise.resolve();assert.equal(win.location.href,'waterpark.html');
 nav.navigate('garage.html');nav.cancel();waits[2]();await Promise.resolve();assert.equal(win.location.href,'waterpark.html');
 nav.navigate('garage.html');win.dispatchEvent(new Event('popstate'));waits[3]();await Promise.resolve();assert.equal(win.location.href,'waterpark.html');
 nav.navigate('index.html');nav.dispose();waits[4]();await Promise.resolve();assert.equal(win.location.href,'waterpark.html');
 assert.equal(getDocumentMusic({} as Document),null,'server and minimal mocked DOM do not create audio');
});

test('menu ready gate, same-page screens, separate garage and both race exits wire music safely',()=>{
 const menu=read('src/menu.ts'),garage=read('src/kart-garage.ts'),game=read('src/game.ts'),water=read('src/waterpark-play.ts');
 assert.match(menu,/homeReady=true;music\?\.setPhase\('menu'\)/);
 assert.match(menu,/state.screen!=='main'.*state.screen==='exit'\?'silent':'menu'/);
 assert.match(menu,/disposeMusicSettings\?\.\(\)/);assert.match(menu,/bindMusicSettings\(root,music\)/);
 assert.doesNotMatch(menu,/暂未加入背景音乐/);
 assert.match(garage,/music\?\.setPhase\('menu'\)/);assert.match(garage,/musicNavigation\.dispose\(\);events\.abort\(\)/);assert.doesNotMatch(garage,/music\?\.dispose\(\)/);
 for(const source of [game,water])assert.match(source,/shell.navigate\(screen==='maps'\?urls.changeMap:screen==='characters'\?urls.changeCharacter:urls.main\)/);
 assert.ok(game.indexOf('getDocumentMusic(document)')<game.indexOf('await loadLandCourse'));
 assert.match(read('src/race-shell.ts'),/pauseActions.style.maxHeight = 'calc\(100% - 32px\)'/,'expanded pause menu remains scrollable');
});

test('uploaded music bytes remain exact and have separate rights documentation',()=>{
 for(const [name,size,hash] of [['dfy_theme.mp3',4727040,'07fcbd78aaf0ea7e2f56c23dd3ee0b389baf84a1d4fabfc8f5c0288323fb151f'],['dfy_bgm.mp3',4195584,'6f0661e804024b47521facd96112ae59ecd9efdd37a33a7eec5593efd0592bf0'],['dfy_fusion.mp3',5968896,'5b06c0a3fcffafd09e7ad05012e2a22638b04763d629b53cf42b6c4dc47911e9']] as const){
  const bytes=readFileSync('public/assets/music/'+name);assert.equal(bytes.length,size);assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
 }
 assert.match(read('public/assets/music/README.txt'),/AGPL source-code grant does not grant an additional license/);
});

test('newer Resume/Restart clicks cancel an exit before synchronous phase changes resolve its fade',async()=>{
 const fake=fakeMusic();let resolveFade:()=>void=()=>{};
 const original=fake.music.setPhase;
 fake.music.setPhase=(phase)=>{original(phase);resolveFade();};
 fake.music.fadeOut=()=>new Promise(resolve=>{resolveFade=resolve;});
 const win=Object.assign(new EventTarget(),{location:{href:'https://example.test/dev/coast.html',origin:'https://example.test'}});
 const doc=Object.assign(new EventTarget(),{defaultView:win,closest:()=>({})}) as unknown as Document;
 const nav=bindMusicNavigation(doc,fake.music);
 nav.navigate('index.html');
 doc.addEventListener('click',()=>fake.music.setPhase('race'));
 doc.dispatchEvent(new Event('click'));await Promise.resolve();
 assert.match(win.location.href,/coast.html$/,'newer button intent wins over canceled fade completion');
 assert.equal(fake.state.phase,'race');
 nav.navigate('index.html');doc.dispatchEvent(new Event('pointerdown'));fake.music.setVolume(.2);resolveFade();await Promise.resolve();
 assert.match(win.location.href,/coast.html$/,'range drag cancels navigation before its first input mutation');
 nav.dispose();
});

test('waterpark alone selects fusion while every land course keeps its original race track',()=>{
 for(const map of Object.keys(MAP_PROFILES))assert.equal(raceMusicUrl(map),map==='waterpark'?'./assets/music/dfy_fusion.mp3':'./assets/music/dfy_bgm.mp3');
 assert.equal(raceMusicUrl(), './assets/music/dfy_bgm.mp3');assert.match(read('src/race-shell.ts'),/getDocumentMusic\(document, options.map\)/);
 const license=read('public/assets/music/LICENSE.txt');for(const name of ['dfy_theme.mp3','dfy_bgm.mp3','dfy_fusion.mp3'])assert.ok(license.includes(name));
 assert.match(license,/Copyright © 2026 JerryZRic/);assert.match(license,/musical works and recordings/);assert.match(license,/Commercial use/);assert.match(license,/prior permission/);assert.match(license,/statutory exceptions/);assert.match(license,/AGPL-3.0-only terms are unchanged/);
});
