import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CHARACTER_PROFILES,resolveCharacter,characterTuning,MAP_BASELINES,WATER_CHARACTER_MULTIPLIERS} from '../src/character-profiles';
import {DEFAULT_SETTINGS,SETTINGS_KEY,readGameSettings,saveGameSettings,sanitizeSettings,qualitySettings} from '../src/game-settings';
import {parseMenuState,menuQuery,raceEntry} from '../src/menu-state';
import {MAP_PROFILES} from '../src/map-profiles';
test('six bounded land profiles retain tradeoffs with independent axis budgets; water remains released',()=>{
 assert.deepEqual(CHARACTER_PROFILES.map(p=>p.id),['whale','gemini','gpt','claude','grok','glm']);
 const axes=['topSpeed','acceleration','steering'] as const;
 const bounds={topSpeed:[.9,1.1],acceleration:[.65,1.45],steering:[.85,1.3]} as const;
 for(const p of CHARACTER_PROFILES){assert.ok(Object.isFrozen(p));for(const k of axes)assert.ok(p[k]>=bounds[k][0]&&p[k]<=bounds[k][1]);
 for(const q of CHARACTER_PROFILES.filter(q=>q!==p))assert.ok(axes.some(k=>p[k]<q[k])&&axes.some(k=>p[k]>q[k]));}
 assert.equal(resolveCharacter('invalid').id,'whale');
 for(const map of ['coast','waterpark'] as const)for(const p of CHARACTER_PROFILES){const t=characterTuning(p.id,map),multipliers=map==='coast'?p:WATER_CHARACTER_MULTIPLIERS[p.id];assert.equal(t.maxSpeed,MAP_BASELINES[map].maxSpeed*multipliers.topSpeed);assert.equal(t.acceleration,MAP_BASELINES[map].acceleration*multipliers.acceleration);assert.equal(t.steering,MAP_BASELINES[map].steering*multipliers.steering);}
});
test('settings survive reload and reject corrupt values, unknown versions, missing or blocked storage',()=>{
 const values=new Map<string,string>();const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
 assert.deepEqual(readGameSettings(storage),DEFAULT_SETTINGS);
 assert.equal(saveGameSettings({version:1,quality:'low',refraction:false},storage),true);
 assert.deepEqual(readGameSettings(storage),{version:1,quality:'low',refraction:false});
 for(const text of ['{','null','[]','{"version":2,"quality":"high"}','"hello"']){values.set(SETTINGS_KEY,text);assert.deepEqual(readGameSettings(storage),DEFAULT_SETTINGS);}
 assert.deepEqual(sanitizeSettings({version:1,quality:'ultra',refraction:'false'}),DEFAULT_SETTINGS);
 const blocked={getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('blocked');}};
 assert.deepEqual(readGameSettings(blocked),DEFAULT_SETTINGS);assert.equal(saveGameSettings({...DEFAULT_SETTINGS},blocked),false);
 assert.equal(qualitySettings('low').shadows,false);assert.equal(qualitySettings('balanced').pixelRatioCap,1.7);assert.equal(qualitySettings('high').shadowResolution,2048);
});
test('menu URLs sanitize hostile states and preserve selected setup on back',()=>{
 assert.deepEqual(parseMenuState('?screen=nonsense&driver=<script>&map=external&return=exit'),{screen:'main',driver:'whale',map:'coast',returnTo:'main',difficulty:'normal',seed:20261010});
 const state=parseMenuState('?screen=characters&driver=grok&map=waterpark');assert.equal(parseMenuState(menuQuery(state)).driver,'grok');
 assert.equal(parseMenuState(menuQuery({...state,screen:'maps'})).driver,'grok');
 assert.equal(raceEntry('coast','grok'),'./coast.html?driver=grok&autostart=1');assert.equal(raceEntry('waterpark','x'),'./waterpark.html?driver=whale&autostart=1');
 assert.equal(MAP_PROFILES.coast.entry,'./coast.html');
});
test('entry uses the shared scene host; deep links and settings remain explicit',async()=>{
 const index=await readFile('index.html','utf8'),menu=await readFile('src/menu.ts','utf8'),coast=await readFile('coast.html','utf8'),vite=await readFile('vite.config.ts','utf8');
 assert.match(index,/\/src\/spa.ts/);assert.doesNotMatch(index,/<canvas|src\/game.ts|src\/waterpark-play.ts/);assert.doesNotMatch(menu,/from ['"]playcanvas|window.close|volume|AudioContext/);
 assert.match(menu,/menu-backdrop/);assert.match(menu,/大肥鱼卡丁车/);assert.match(menu,/故事模式/);assert.match(menu,/开发中/);assert.match(menu,/popstate/);assert.match(menu,/MUSIC_SETTINGS_MARKUP/);assert.match(menu,/转向加速度/);assert.match(menu,/惯性与阻尼/);assert.match(menu,/操作说明/);
 assert.match(coast,/src\/spa.ts/);const spa=await readFile('src/spa.ts','utf8');assert.match(spa,/mountMenu/);assert.match(spa,/import\('\.\/game'\)/);assert.match(vite,/coast: 'coast.html'/);
});
