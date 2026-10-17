import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRaceShell} from '../src/race-shell';
import type {MusicState} from '../src/background-music';
import {MAP_PROFILES} from '../src/map-profiles';
import {RACE_MUSIC,raceMusicUrl,bindMusicNavigation,bindMusicSettings,getDocumentMusic,type BackgroundMusic} from '../src/music-ui';

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
 for(const {name,size,sha256:hash} of JSON.parse(read('public/assets/music/inventory.json'))){
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

test('every race map including waterpark shares the same music pool',()=>{
 for(const map of Object.keys(MAP_PROFILES))assert.equal(raceMusicUrl(map,()=>0),RACE_MUSIC[0]);
 assert.equal(raceMusicUrl(undefined,()=>0), RACE_MUSIC[0]);assert.match(read('src/race-shell.ts'),/getDocumentMusic\(document, options.map\)/);
 const license=read('public/assets/music/LICENSE.txt');for(const name of ['dfy_theme.mp3','dfy_water.mp3',...Array.from({length:6},(_,i)=>`dfy0${i+1}.mp3`)])assert.ok(license.includes(name));
 assert.match(license,/Copyright © 2026 JerryZRic/);assert.match(license,/musical works and recordings/);assert.match(license,/Commercial use/);assert.match(license,/prior permission/);assert.match(license,/statutory exceptions/);assert.match(license,/AGPL-3.0-only terms are unchanged/);
});


test('each new land or water race draws once; countdown, pause, resume and GO never redraw',()=>{
 const originalRandom=Math.random;let draws=0;
 Math.random=()=>((draws++ % RACE_MUSIC.length)+.5)/RACE_MUSIC.length;
 try {
  for(const map of ['coast','waterpark'] as const){
   const {music}=fakeMusic();const selected:string[]=[];let preloads=0;
   music.setRaceUrl=url=>{selected.push(url);};music.preloadRace=()=>{preloads++;};
   const elements=new Map<string,any>();
   const el=(id:string)=>{if(!elements.has(id))elements.set(id,{textContent:'',innerHTML:'',style:{},dataset:{},classList:{add(){},remove(){}},setAttribute(){},focus(){}});return elements.get(id);};
   const doc={body:el('body'),getElementById:el} as unknown as Document;
   const shell=createRaceShell(doc,el('canvas'),{map,driver:'whale',music,audioFactory:()=>null});
   assert.equal(preloads,0);assert.equal(selected.length,0);
   const before=draws;
   for(let i=0;i<RACE_MUSIC.length;i++){
    shell.start(3);assert.equal(preloads,i+1);assert.equal(selected.length,i+1);
    assert.equal(selected[i],RACE_MUSIC[i]);
    shell.renderCountdown(2);shell.setPaused(true,2);shell.setPaused(false,2);shell.renderCountdown(0);shell.renderCountdown(0);shell.setPaused(true);shell.setPaused(false);
    assert.equal(selected.length,i+1,'resume and repeated GO preserve the selected source');
   }
   assert.equal(draws-before,RACE_MUSIC.length);shell.dispose();
  }
 }finally {Math.random=originalRandom;}
});

test('all race selection intervals are exact and the pool excludes menu music',()=>{
 for(const map of Object.keys(MAP_PROFILES))for(let i=0;i<RACE_MUSIC.length;i++){
  assert.equal(raceMusicUrl(map,()=>i/RACE_MUSIC.length),RACE_MUSIC[i]);
 }
 assert.equal(raceMusicUrl('coast',()=>.999999),RACE_MUSIC.at(-1));
 assert.equal(RACE_MUSIC.length,17);
 assert.equal(new Set(RACE_MUSIC).size,RACE_MUSIC.length);
 assert.ok(!RACE_MUSIC.some(url=>/THEME|Love_on_Kart/i.test(url)));
 assert.ok(RACE_MUSIC.includes('./assets/music/dfy02.mp3'));
 for(const url of RACE_MUSIC)assert.ok(existsSync(new URL('../public/'+url.slice(2),import.meta.url)),url); 
 assert.ok(!RACE_MUSIC.includes('./assets/music/dfy_theme.mp3')); 
});
