import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MAP_PROFILES,resolveMap} from '../src/map-profiles';
import {parseMenuState,menuQuery,raceEntry,garageEntry} from '../src/menu-state';
import {garageRaceEntry,garageBackEntry,garageHomeEntry} from '../src/kart-garage';
import {defaultBuild} from '../src/kart-build';
import {characterTuning,CHARACTER_PROFILES} from '../src/character-profiles';
import {raceNavigation} from '../src/race-shell';
const url=(path:string)=>new URL(path,'https://test.invalid/dev/');

test('catalog dynamically resolves every map and safely rejects prototype keys',()=>{
 assert.ok(Object.keys(MAP_PROFILES).length>=8);
 for(const [id,profile] of Object.entries(MAP_PROFILES))assert.equal(resolveMap(id),profile);
 for(const bad of [null,{},'__proto__','constructor','not-a-map'])assert.equal(resolveMap(bad),MAP_PROFILES.coast);
 assert.equal(MAP_PROFILES.harvest.label,'谷风麦垄回环');
 assert.deepEqual(characterTuning('gpt','harvest'),characterTuning('gpt','coast'));
});
test('harvest free flow retains course, kart, driver, difficulty and seed at every return',()=>{
 const build=({...defaultBuild}),kart=JSON.stringify(build);
 const state=parseMenuState('?screen=characters&map=harvest&driver=claude&difficulty=hard&seed=4294967295&kart='+encodeURIComponent(kart));
 assert.equal(parseMenuState(menuQuery({...state,screen:'settings',returnTo:'race-settings'})).map,'harvest');
 const garage=url(garageEntry(state.driver,state));
 const routes=[garage, url(garageRaceEntry(state.driver,build,garage.search)),url(garageBackEntry(state.driver,build,garage.search)),url(garageHomeEntry(state.driver,build,garage.search)),url(raceEntry(state.map,state.driver,state))];
 for(const target of routes){for(const [key,value] of Object.entries({map:'harvest',driver:'claude',difficulty:'hard',seed:'4294967295',kart}))assert.equal(target.searchParams.get(key),value,`${target.pathname}: ${key}`);}
 assert.equal(routes[1].searchParams.get('screen'),'race-settings');assert.equal(routes[1].searchParams.has('autostart'),false);
 assert.equal(routes[4].pathname,'/dev/coast.html');assert.equal(routes[4].searchParams.get('autostart'),'1');
 for(const target of Object.values(raceNavigation('harvest','claude',routes[4].search)))assert.equal(url(target).searchParams.get('map'),'harvest');
 assert.equal(url(garageRaceEntry('claude',build,'?map=harvest')).searchParams.get('map'),'harvest');
});
test('legacy coast and water links retain exact entry semantics',()=>{
 assert.equal(raceEntry('coast','gpt'),'./coast.html?driver=gpt&autostart=1');
 assert.equal(raceEntry('waterpark','gpt'),'./waterpark.html?driver=gpt&autostart=1');
 assert.equal(url(raceEntry('waterpark','gpt',{difficulty:'normal',seed:1,kart:JSON.stringify(({...defaultBuild}))})).searchParams.has('kart'),false);
});
test('harvest preview imports are lazy and stale navigation is gated after preparation',()=>{
 const source=readFileSync('src/menu-backdrop.ts','utf8'),menu=readFileSync('src/menu.ts','utf8');
 assert.match(source,/Promise\.all\(\[import\('\.\/land-scene'\),import\('\.\/maps\/harvest'\),import\('\.\/harvest-scenery'\)\]/);
 assert.doesNotMatch(source,/^import .* from ['"]\.\/(?:land-scene|maps\/harvest)/m);
 assert.match(menu,/await prepareMenuWorld\(state.map\)/);
 assert.match(menu,/version!==renderVersion\|\|\(state.screen/);
 assert.match(readFileSync('src/menu.css','utf8'),/\.map-choices\{[^}]*max-height:490px;overflow-y:auto/);
});

test('lazy harvest preview uses actual harvest geometry and releases native resources on repeat switches',async()=>{
 const pc=await import('playcanvas');
 const {prepareMenuWorld,createMenuWorld}=await import('../src/menu-backdrop');
 const {mapPreviewCameraPose,menuCameraAnchors}=await import('../src/menu-camera');
 const {DEFAULT_SETTINGS}=await import('../src/game-settings');
 const {HARVEST_TRACK}=await import('../src/maps/harvest');
 await Promise.all([prepareMenuWorld('harvest'),prepareMenuWorld('harvest')]);
 const canvas={id:'harvest-menu-test',width:1440,height:900,addEventListener(){},removeEventListener(){}} as any;
 const app=new pc.AppBase(canvas),options=new pc.AppOptions();options.graphicsDevice=new pc.NullGraphicsDevice(canvas);
 options.componentSystems=[pc.RenderComponentSystem,pc.CameraComponentSystem,pc.LightComponentSystem,pc.ScriptComponentSystem];options.devtools=false;app.init(options);
 const buffers=app.graphicsDevice.buffers.size,textures=app.graphicsDevice.textures.size,layers=app.scene.layers.layerList.length;
 try{
  for(const aspect of [1440/900,390/844]){
   const time=12,pose=mapPreviewCameraPose('harvest',time,aspect),p=HARVEST_TRACK.sample(HARVEST_TRACK.length*.69+18*Math.sin(time*.13)).p;
   assert.deepEqual(pose.target,[p.x,p.y+1,p.z]);assert.ok(pose.position.every(Number.isFinite));
   assert.ok(menuCameraAnchors('harvest',aspect).some(point=>point[1]>8));
   const world=createMenuWorld(app as any,'harvest',DEFAULT_SETTINGS);world.update(time,aspect);
   assert.equal(app.assets.list().length,0,'preview never requests racer/prop GLBs');
   const position=world.camera.getPosition().toArray();position.forEach((v,i)=>assert.ok(Math.abs(v-pose.position[i])<.0001));
   world.destroy();world.destroy();assert.equal(app.root.children.length,0);
   assert.equal(app.graphicsDevice.buffers.size,buffers);assert.equal(app.graphicsDevice.textures.size,textures);assert.equal(app.scene.layers.layerList.length,layers);
  }
 }finally{app.destroy();}
});

test('every kart map retains all six characters and every difficulty through garage and launch',()=>{
 for(const {id:driver} of CHARACTER_PROFILES)for(const difficulty of ['easy','normal','hard'] as const){
  const state=parseMenuState(`?screen=characters&map=harvest&driver=${driver}&difficulty=${difficulty}&seed=713`);
  const garage=url(garageEntry(state.driver,state));
  const setup=url(garageRaceEntry(state.driver,{...defaultBuild},garage.search));
  assert.equal(setup.searchParams.get('map'),'harvest');assert.equal(setup.searchParams.get('difficulty'),difficulty);
  const race=url(raceEntry('harvest',state.driver,{difficulty,seed:713,kart:JSON.stringify(defaultBuild)}));
  assert.equal(race.searchParams.get('map'),'harvest');assert.equal(race.searchParams.get('driver'),state.driver);
  for(const target of Object.values(raceNavigation('harvest',state.driver,race.search)))assert.equal(url(target).searchParams.get('map'),'harvest');
 }
});
