import fs from 'node:fs';
import assert from 'node:assert/strict';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {syntheticDriverGLB, localFile, deferred} from './helpers/synthetic-driver.mjs';
const loadedURLs=[],bundledRequests=[];const initialBundleGate=deferred();
const driverIds=['whale','gemini','gpt','claude','grok','glm'];
async function syntheticBundle(failed=[],onProgress=()=>{},{existingDrivers=new Map(),onStatus=()=>{}}={}){
  const drivers=new Map(existingDrivers),failures=new Map();
  const records=driverIds.map(id=>({id,stage:drivers.has(id)?'ready':'queued',receivedBytes:drivers.has(id)?100:0,totalBytes:100,attempt:1,maxAttempts:4}));
  const emit=()=>onStatus({records:records.map(record=>({...record})),receivedBytes:records.reduce((sum,record)=>sum+record.receivedBytes,0),totalBytes:600,completed:drivers.size+failures.size,total:6,loaded:drivers.size,failed:failures.size});emit();
  for(const record of records){const id=record.id;if(drivers.has(id))continue;bundledRequests.push('assets/drivers/'+id+'-driver.glb.gz');record.stage='downloading';record.receivedBytes=20;emit();
    if(failed.includes(id)){failures.set(id,'Simulated unavailable model');record.stage='failed';record.error=failures.get(id)}
    else{record.stage='preparing';record.receivedBytes=100;emit();drivers.set(id,await new GLTFLoader().parseAsync(syntheticDriverGLB(),''));record.stage='ready'}
    emit();onProgress({id,completed:drivers.size+failures.size,total:6,loaded:drivers.size,failed:failures.size});
  }return {drivers,failures};
}
let bootLoaderCalls=0;
GLTFLoader.prototype.loadAsync=async function(url){loadedURLs.push(url);assert.ok(/^assets\/(?:kart|palm|rock|arch|kart-r12-chassis)\.glb$/.test(url),'Only original public assets may load at boot');const b=fs.readFileSync('dist/'+url);return this.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
globalThis.__testFetchWithRetry=async(url,options={})=>{loadedURLs.push(url);assert.ok(/^assets\/(?:kart|palm|rock|arch|kart-r12-chassis)\.glb$/.test(url));const b=fs.readFileSync('dist/'+url);options.onProgress?.({receivedBytes:b.byteLength,totalBytes:b.byteLength});return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};
const elements=new Map(),touch=[];
function element(id){if(!elements.has(id)){const listeners={};const e={id,listeners,textContent:'',innerHTML:'',disabled:false,style:{},attributes:{},classList:{add(){},remove(){}},setAttribute(name,value){this.attributes[name]=value},removeAttribute(name){delete this.attributes[name];if(name==='value')delete this.value},replaceChildren(){},getContext:()=>new Proxy({},{get:()=>()=>{}}),addEventListener(name,fn){const old=listeners[name];listeners[name]=old?(e)=>{old(e);fn(e)}:fn},setPointerCapture(){},append(){},focus(){globalThis.document.activeElement=this;},click(){if(!this.disabled)this.onclick?.()}};elements.set(id,e)}return elements.get(id)}
for(const match of fs.readFileSync('src/index.html','utf8').matchAll(/data-key="([^"]+)"/g)){const e=element('touch-'+match[1]);e.dataset={key:match[1]};touch.push(e)}
const docEvents={};globalThis.document={getElementById:element,body:element('body'),createElement:()=>element('canvas-'+Math.random()),querySelectorAll:()=>touch,addEventListener:(name,fn)=>{const old=docEvents[name];docEvents[name]=old?(e)=>{old(e);fn(e)}:fn},hidden:false};globalThis.window={};globalThis.innerWidth=1280;globalThis.innerHeight=800;globalThis.devicePixelRatio=1;const events={};globalThis.addEventListener=(name,fn)=>events[name]=fn;let frame;globalThis.requestAnimationFrame=fn=>frame=fn;
window.__testLoadBundledDrivers=async options=>{bootLoaderCalls++;await initialBundleGate.promise;return syntheticBundle([],options.onProgress,options)};
const source=fs.readFileSync('src/game.js','utf8').replace("import * as THREE from 'three';","import * as THREE from '../tests/three-test.mjs';").replace("import { fetchWithRetry } from './asset-download.js';","const fetchWithRetry = (...args) => globalThis.__testFetchWithRetry(...args);").replace("import { loadBundledDrivers } from './bundled-drivers.js';","const loadBundledDrivers = (...args) => window.__testLoadBundledDrivers(...args);")+`\nwindow.qa={sample,camera,orbit,mouseLook,scene,boot,courseAssets,setupRacers,setSetup:fn=>setupRacers=fn,loading:()=>loadingSnapshot,bundled:()=>bundledDrivers,player:()=>player,bots:()=>bots,controllers,localDrivers,updateDriverUI,keys,draw,update,set(values){({pos=pos,lane=lane,speed=speed,held=held,boost=boost,state=state,ready=ready,steerVis=steerVis,charge=charge,drifting=drifting}=values);if(values.noBots)bots=[];},get:()=>({steerVis,drifting,shield,view,ready,state,loadingError})};`;
const copy=new URL('../src/.game-test-copy.mjs',import.meta.url);fs.writeFileSync(copy,source);
try {
await import(copy);for(let attempt=0;attempt<100&&!bootLoaderCalls;attempt++)await new Promise(r=>setTimeout(r,2));assert.equal(bootLoaderCalls,1);assert.equal(window.qa.get().ready,false);assert.equal(window.neonKart,undefined);element('start').click();assert.notEqual(window.qa.get().state,'countdown');initialBundleGate.resolve();for(let attempt=0;attempt<100&&!window.neonKart;attempt++)await new Promise(r=>setTimeout(r,2));const game=window.neonKart,qa=window.qa;assert.ok(game,'All models booted');let time=0;const tests=['all six automatic model requests settle before game readiness or Start'];
function test(name,fn){fn();tests.push(name)}
function step(seconds){for(let i=0;i<Math.ceil(seconds*60);i++){time+=1000/60;frame(time)}}
function key(type,code,key=code){events[type]({key,code,repeat:false,preventDefault(){}})}
function down(code){key('keydown',code)}function up(code){key('keyup',code)}
function race(){game.start();step(3.3);assert.equal(game.getState().state,'running')}
test('asset boot and countdown',()=>{assert.equal(game.getState().state,'menu');race()});
test('stays still without W; W accelerates',()=>{step(2);assert.equal(game.getState().speed,0);assert.equal(game.getState().pos,0);down('KeyW');step(3);assert.ok(game.getState().speed>35);up('KeyW')});
test('A/D position and body yaw project correctly on both cameras around the real circuit',()=>{
  for(const view of [0,1]){if(qa.get().view!==view)element('camera').click();for(let i=0;i<32;i++){
    let d=game.getState().length*i/32;qa.set({pos:d,lane:0,speed:30,noBots:true,steerVis:0});qa.draw(1);
    const base=qa.sample(d).p.clone().project(qa.camera);
    for(const code of ['KeyA','KeyD']){qa.set({pos:d,lane:0,speed:30,steerVis:0});down(code);qa.update(.1);up(code);const s=game.getState(),offset=qa.sample(d,s.lane).p.clone().project(qa.camera);assert.equal(Math.sign(offset.x-base.x),code==='KeyA'?-1:1,`${code} camera ${view}, point ${i}`);assert.equal(Math.sign(qa.get().steerVis),code==='KeyA'?1:-1)}
  }}
});
test('Space brakes to zero without consuming held item; E uses item',()=>{qa.set({speed:42,held:'shield',noBots:true});down('Space');step(2);assert.equal(game.getState().speed,0);assert.equal(game.getState().held,'shield');up('Space');down('KeyE');assert.equal(game.getState().held,null);assert.ok(qa.get().shield>0);up('KeyE')});
test('S brakes then reverses; speed shows R and lap does not become zero',()=>{qa.set({pos:1,speed:20,lane:0});down('KeyS');step(3);up('KeyS');assert.ok(game.getState().speed<0);assert.ok(game.getState().pos<0);assert.equal(game.getState().lap,1);assert.match(element('speed').textContent,/^R /)});
test('Shift and steering charge drift, release grants existing kart boost',()=>{qa.set({pos:200,speed:35,lane:0,noBots:true});down('KeyW');down('ShiftLeft');down('KeyA');step(1);assert.ok(game.getState().charge>.7);up('ShiftLeft');up('KeyA');step(.1);assert.ok(game.getState().boost>0);up('KeyW')});
test('Space braking cancels drift charge without awarding boost',()=>{qa.set({speed:35,charge:1,drifting:true,boost:0});down('Space');step(.1);assert.equal(game.getState().boost,0);assert.equal(game.getState().charge,0);up('Space')});
test('Z toggles camera and right mouse holds rear view until released',()=>{const prev=game.getState().camera;down('KeyZ');up('KeyZ');assert.notEqual(game.getState().camera,prev);const e={button:2,pointerId:1,preventDefault(){}};element('game').listeners.pointerdown(e);qa.draw(.1);assert.equal(qa.keys.RearView,true);element('game').listeners.pointerup(e);assert.equal(qa.keys.RearView,false)});
test('right-view mouse button chording never leaves a sticky rear camera',()=>{
  const c=element('game');c.listeners.mousedown({button:2,preventDefault(){}});assert.equal(qa.keys.RearView,true);
  // Another button remains held: there is no pointerup for the right release.
  c.listeners.pointermove({pointerType:'mouse',buttons:1});assert.equal(qa.keys.RearView,false);
  c.listeners.mousedown({button:2,preventDefault(){}});docEvents.mouseup({button:0});assert.equal(qa.keys.RearView,true);docEvents.mouseup({button:2});assert.equal(qa.keys.RearView,false);
});
test('orbit directions are right/left, elevation stays above road, rear view restores orbit, Q recenters',()=>{
  race();qa.set({pos:200,speed:0,lane:0,noBots:true});
  for(const view of [0,1]){if(qa.get().view!==view)element('camera').click();const base=qa.sample(200);qa.orbit.recenter(true);qa.orbit.move(200,0);for(let i=0;i<100;i++)qa.draw(1/60);const cameraOffset=qa.camera.position.clone().sub(base.p);assert.ok(cameraOffset.dot(base.n)>0,'mouse right orbits camera left to look right');qa.orbit.move(-300,0);for(let i=0;i<100;i++)qa.draw(1/60);assert.ok(qa.camera.position.clone().sub(base.p).dot(base.n)<0,'mouse left looks left');for(let i=0;i<20;i++){qa.orbit.move(300,-300);qa.draw(.1)}assert.ok(qa.camera.position.y>base.p.y+1);for(let i=0;i<20;i++){qa.orbit.move(-300,300);qa.draw(.1)}assert.ok(qa.camera.position.y>base.p.y+1);}
  const saved=qa.orbit.get().targetYaw;const e={button:2,pointerId:1,preventDefault(){}};element('game').listeners.pointerdown(e);qa.draw(.1);assert.ok(qa.camera.position.clone().sub(qa.sample(200).p).dot(qa.sample(200).t)>0);element('game').listeners.pointerup(e);qa.draw(.1);assert.equal(qa.orbit.get().targetYaw,saved);down('KeyQ');up('KeyQ');for(let i=0;i<150;i++)qa.draw(1/60);assert.ok(Math.abs(Math.sin(qa.orbit.get().yaw))<1e-8);assert.ok(Math.abs(qa.orbit.get().pitch)<1e-8);
});
test('Escape pauses idempotently and restart clears the orbit',()=>{race();qa.orbit.move(200,100);down('Escape');up('Escape');assert.equal(game.getState().state,'paused');down('Escape');up('Escape');assert.equal(game.getState().state,'paused');down('KeyP');up('KeyP');assert.equal(game.getState().state,'running');game.start();assert.equal(qa.orbit.get().targetYaw,0);assert.equal(qa.orbit.get().targetPitch,0);step(3.3)});
test('pause/resume freezes timer and clears held keys, blur and visibility safety pause',()=>{down('KeyW');down('ShiftLeft');game.pause();assert.ok(Object.values(qa.keys).every(v=>!v));const paused=game.getState().elapsed;step(1);assert.equal(game.getState().elapsed,paused);game.pause();assert.equal(game.getState().state,'running');events.blur();assert.equal(game.getState().state,'paused');game.pause();document.hidden=true;docEvents.visibilitychange();assert.equal(game.getState().state,'paused');document.hidden=false;game.pause()});
test('all touch buttons bind and release actual driving inputs',()=>{for(const e of touch){e.listeners.pointerdown({preventDefault(){},pointerId:1});assert.equal(qa.keys[e.dataset.key],true);e.listeners.pointercancel();assert.equal(qa.keys[e.dataset.key],false)}assert.ok(touch.find(e=>e.dataset.key==='KeyW'));assert.ok(touch.find(e=>e.dataset.key==='Space'))});
test('three-lap race still finishes while driving; restart resets all driving state',()=>{race();down('KeyW');step(180);assert.equal(game.getState().state,'finished');assert.equal(game.getState().lap,3);game.start();const s=game.getState();assert.equal(s.state,'countdown');assert.equal(s.elapsed,0);assert.equal(s.pos,0);assert.equal(s.speed,0);assert.equal(s.boost,0);assert.equal(s.charge,0);assert.equal(qa.get().steerVis,0);assert.ok(Object.values(qa.keys).every(v=>!v))});
async function asyncTest(name,fn){await fn();tests.push(name)}
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
const ids=['whale','gemini','gpt','claude','grok','glm'];
function menu(){qa.set({state:'menu'});qa.updateDriverUI()}
function actors(){return [qa.player(),...qa.bots().map(b=>b.mesh)]}
test('default public boot automatically supplies six models and every slot works without local imports',()=>{
  assert.deepEqual(loadedURLs.sort(),['arch','kart','kart-r12-chassis','palm','rock'].map(n=>'assets/'+n+'.glb').sort());
  assert.deepEqual(game.getState().importedSlots,[]);assert.equal(game.getState().allDriversLoaded,true);assert.deepEqual(game.getState().bundledLoaded.sort(),[...ids].sort());assert.deepEqual(bundledRequests.sort(),ids.map(id=>'assets/drivers/'+id+'-driver.glb.gz').sort());assert.ok(game.getState().driverStates.every(d=>d.appearance==='bundled-model'));assert.equal(qa.controllers.size,6);
  menu();for(const id of ids){assert.equal(game.selectDriver(id),true);assert.equal(qa.player().userData.driverId,id);assert.equal(new Set(actors().map(a=>a.userData.driverId)).size,6);assert.equal(qa.bots().length,5)}
});
test('focused interactive Enter/Space retain native activation and start transfers focus to canvas',()=>{
  menu();game.selectDriver('whale');
  for(const id of ['slot-gpt','importButton','clearDriver','start','driverFiles'])for(const code of ['Enter','Space']){
    let prevented=false;const target={closest:()=>element(id)};events.keydown({code,key:code,repeat:false,target,preventDefault(){prevented=true}});events.keyup({code,key:code,target,preventDefault(){prevented=true}});
    assert.equal(prevented,false,`${id}: ${code} must keep native button handling`);assert.equal(game.getState().state,'menu');assert.equal(!!qa.keys[code],false);
  }
  element('slot-gpt').click();assert.equal(game.getState().selectedDriverId,'gpt');element('start').click();assert.equal(game.getState().state,'countdown');assert.equal(document.activeElement,element('game'));
});
test('driving shortcuts survive focus on race toolbar buttons while native Enter/Space remain available',()=>{
  game.start();step(3.3);
  const cameraButton=element('camera'),target={closest:selector=>selector.includes('button')?cameraButton:null};
  events.keydown({code:'KeyW',key:'w',repeat:false,target,preventDefault(){}});assert.equal(qa.keys.KeyW,true,'A focused Camera button must not swallow throttle');
  events.keyup({code:'KeyW',key:'w',target,preventDefault(){}});assert.equal(qa.keys.KeyW,false);
  for(const code of ['Enter','Space']){let prevented=false;events.keydown({code,key:code,repeat:false,target,preventDefault(){prevented=true}});assert.equal(prevented,false);assert.equal(!!qa.keys[code],false)}
});
await asyncTest('cancel and invalid local file keep the automatically loaded model and return file input to reusable state',async()=>{
  menu();const previous=qa.player();const input=element('driverFiles');input.value='selected';input.listeners.change({target:{files:[],value:'selected'}});await tick();assert.equal(qa.player(),previous);assert.equal(game.getState().importing,false);
  const event={target:{files:[],value:'selected'}};input.listeners.change(event);assert.equal(event.target.value,'');
  const results=await game.importDrivers([localFile(syntheticDriverGLB(),'wrong.zip')],'gpt');assert.equal(results[0].status,'rejected');assert.deepEqual(game.getState().importedSlots,[]);assert.equal(qa.player(),previous);assert.equal(element('start').disabled,false);
});
await asyncTest('pending local read blocks Start; changing selection preserves captured target slot',async()=>{
  menu();game.selectDriver('gpt');const waiting=deferred();const importTask=game.importDrivers([localFile(syntheticDriverGLB(),'custom.glb',{arrayBuffer:()=>waiting.promise})]);
  assert.equal(game.getState().importing,true);assert.equal(element('start').disabled,true);game.start();assert.equal(game.getState().state,'menu');down('Enter');up('Enter');assert.equal(game.getState().state,'menu');
  game.selectDriver('gemini');waiting.resolve(syntheticDriverGLB());const results=await importTask;assert.equal(results[0].value.status,'imported');assert.deepEqual(game.getState().importedSlots,['gpt']);assert.equal(game.getState().selectedDriverId,'gemini');assert.equal(qa.player().userData.driverId,'gemini');assert.equal(element('start').disabled,false);
  assert.ok(qa.controllers.has('gpt'));assert.ok(qa.controllers.has('gemini'));assert.equal(game.getState().driverStates.find(d=>d.id==='gemini').appearance,'bundled-model');
});
await asyncTest('six imported slots create independent actors and bot phases; race blocks imports',async()=>{
  menu();await game.importDrivers(ids.map(id=>localFile(syntheticDriverGLB(),id+'.glb')));assert.equal(qa.controllers.size,6);assert.equal(new Set(actors()).size,6);assert.equal(new Set(qa.bots().map(b=>b.phase)).size,5);
  const models=ids.map(id=>qa.controllers.get(id).model);assert.equal(new Set(models.map(m=>m.getObjectByName('WheelBone'))).size,6);
  game.start();step(3.4);down('KeyW');step(.4);up('KeyW');assert.equal(game.getState().state,'running');assert.ok(new Set(qa.bots().map(b=>qa.controllers.get(b.id).getState().steering.toFixed(5))).size>1);
  let reads=0;assert.deepEqual(await game.importDrivers([localFile(syntheticDriverGLB(),'driver.glb',{arrayBuffer:async()=>{reads++;return syntheticDriverGLB()}})],'gpt'),[]);assert.equal(reads,0);
  assert.equal(game.selectDriver('glm'),false);assert.equal(game.clearDriver(),false);
});
await asyncTest('failed or repeated replacement retains six racers and clears only the selected slot',async()=>{
  menu();game.selectDriver('gpt');const previous=qa.localDrivers.get('gpt');const actorsBefore=actors();const failure=await game.importDrivers([localFile(syntheticDriverGLB({clips:['DriveIdle']}))]);assert.equal(failure[0].status,'rejected');assert.equal(qa.localDrivers.get('gpt'),previous);assert.deepEqual(actors(),actorsBefore);
  for(let i=0;i<4;i++){const old=qa.controllers.get('gpt');await game.importDrivers([localFile(syntheticDriverGLB())]);assert.equal(old.getState().status,'disposed');assert.equal(qa.controllers.size,6);assert.equal(actors().length,6)}
  const old=qa.controllers.get('gpt');assert.equal(game.clearDriver(),true);assert.equal(old.getState().status,'disposed');assert.equal(qa.controllers.size,6);assert.equal(game.getState().driverStates.find(d=>d.id==='gpt').appearance,'bundled-model');assert.equal(qa.localDrivers.has('gpt'),false);assert.equal(qa.player().userData.driverId,'gpt');assert.equal(actors().length,6);
});
await asyncTest('stale import resolves without replacing the latest successful driver',async()=>{
  menu();game.selectDriver('gpt');const wait=deferred();const old=game.importDrivers([localFile(syntheticDriverGLB(),'old.glb',{arrayBuffer:()=>wait.promise})]);await game.importDrivers([localFile(syntheticDriverGLB(),'new.glb')]);const latest=qa.localDrivers.get('gpt'),latestStatus=element('importStatus').textContent;wait.resolve(syntheticDriverGLB());await old;assert.equal(element('importStatus').textContent,latestStatus,'Older completion must not overwrite the newest import status');assert.equal(qa.localDrivers.get('gpt'),latest);assert.equal(qa.controllers.size,6);assert.equal(element('start').disabled,false);
});
test('repeated full-game reset, pause and camera changes preserve independent imported drivers',()=>{
  for(let i=0;i<6;i++){game.start();step(3.3);down('KeyA');step(.2);up('KeyA');game.pause();const states=game.getState().driverStates;step(.3);assert.deepEqual(game.getState().driverStates,states);element('camera').click();game.pause();assert.equal(game.getState().state,'running');assert.equal(qa.controllers.size,6);assert.equal(actors().length,6)}
  menu();for(const id of ids){game.selectDriver(id);game.clearDriver()}assert.deepEqual(game.getState().importedSlots,[]);assert.equal(qa.controllers.size,6);assert.ok(game.getState().driverStates.every(d=>d.appearance==='bundled-model'));game.start();step(3.3);assert.equal(game.getState().state,'running');
});
await asyncTest('failed automatic models are explicit per-slot fallbacks; no partial-ready success claim',async()=>{
  for(const failed of [['gpt'],ids]){
    window.neonKart=undefined;window.__testLoadBundledDrivers=options=>syntheticBundle(failed,options.onProgress,options);
    await import(copy.href+'?failures='+failed.length);for(let attempt=0;attempt<100&&!window.neonKart;attempt++)await new Promise(r=>setTimeout(r,2));
    const failedGame=window.neonKart;assert.ok(failedGame);const state=failedGame.getState();assert.equal(state.modelsLoaded,true);assert.equal(state.allDriversLoaded,false);assert.deepEqual(state.bundledFailures,[...failed]);assert.equal(state.bundledLoaded.length,6-failed.length);assert.equal(window.qa.controllers.size,6-failed.length);
    for(const id of ids)assert.equal(state.driverStates.find(d=>d.id===id).appearance,failed.includes(id)?'original-fallback':'bundled-model');
    assert.match(element('loading').textContent,/失败/);assert.match(element('startText').textContent,/替身/);assert.equal(new Set([window.qa.player(),...window.qa.bots().map(b=>b.mesh)].map(actor=>actor.userData.driverId)).size,6);failedGame.start();assert.equal(failedGame.getState().state,'countdown');
  }
});
await asyncTest('failed-driver retries preserve successes and imports, stay single-flight and never rebuild the course',async()=>{
  window.neonKart=undefined;window.__testLoadBundledDrivers=options=>syntheticBundle(['gpt'],options.onProgress,options);
  await import(copy.href+'?driver-retry');await window.qa.boot();const retryGame=window.neonKart,retryQA=window.qa;
  const originalReads=loadedURLs.length,groups=retryQA.scene.children.filter(child=>child.name==='original-course-props');assert.equal(groups.length,1);
  const assets=new Map(retryQA.bundled());assert.equal(assets.size,5);assert.equal(element('retryLoading').disabled,false);
  // A pending local file import blocks retry without discarding that import.
  const importGate=deferred(),pending=retryGame.importDrivers([localFile(syntheticDriverGLB(),'custom.glb',{arrayBuffer:()=>importGate.promise})],'gpt');
  assert.equal(await retryGame.retryLoading(),false);assert.equal(element('retryLoading').disabled,true);importGate.resolve(syntheticDriverGLB());await pending;const imported=retryQA.localDrivers.get('gpt');
  const gate=deferred();let calls=0;
  window.__testLoadBundledDrivers=async options=>{calls++;assert.equal(options.existingDrivers.size,5);options.onStatus({records:[{id:'gpt',stage:'waiting',receivedBytes:20,totalBytes:100,attempt:1,maxAttempts:4,retryInMs:1200}],receivedBytes:520,totalBytes:600,completed:5,total:6,loaded:5,failed:0});await gate.promise;return syntheticBundle(['gpt'],options.onProgress,options)};
  const first=retryGame.retryLoading(),second=retryGame.retryLoading();assert.equal(first,second);assert.equal(calls,1);assert.equal(retryGame.getState().loading.busy,true);
  assert.equal(element('loadingProgress').value,520);assert.equal(element('loadingProgress').max,600);assert.match(element('loadingBytes').textContent,/86%/);assert.match(element('loadingDetails').textContent,/2 秒后自动重试（第 2 \/ 4 次）/);
  assert.equal(element('start').disabled,true);assert.equal(element('driverFiles').disabled,true);retryGame.start();assert.equal(retryGame.getState().state,'loading');assert.equal(retryGame.selectDriver('whale'),false);assert.equal(retryGame.clearDriver(),false);
  let fileReads=0;assert.deepEqual(await retryGame.importDrivers([localFile(syntheticDriverGLB(),'ignored.glb',{arrayBuffer:()=>{fileReads++;return syntheticDriverGLB()}})]),[]);assert.equal(fileReads,0);
  const requestCount=bundledRequests.length;gate.resolve();await first;assert.equal(element('retryLoading').disabled,false);assert.equal(retryGame.getState().state,'menu');assert.deepEqual(retryGame.getState().bundledFailures,['gpt']);
  window.__testLoadBundledDrivers=options=>syntheticBundle([],options.onProgress,options);await retryGame.retryLoading();
  assert.equal(retryGame.getState().allDriversLoaded,true);assert.equal(retryGame.getState().loading.busy,false);assert.deepEqual(bundledRequests.slice(requestCount),['assets/drivers/gpt-driver.glb.gz','assets/drivers/gpt-driver.glb.gz']);
  for(const [id,asset] of assets)assert.equal(retryQA.bundled().get(id),asset,'Successful model must stay cached');
  assert.equal(retryQA.localDrivers.get('gpt'),imported);assert.equal(retryGame.getState().driverStates.find(record=>record.id==='gpt').appearance,'local-import');assert.equal(loadedURLs.length,originalReads);assert.deepEqual(retryQA.scene.children.filter(child=>child.name==='original-course-props'),groups);assert.equal(element('loadingDetailGroup').open,false);
  assert.equal(await retryGame.retryLoading(),false,'No-op when all models are ready');retryGame.start();assert.equal(await retryGame.retryLoading(),false,'Race cannot trigger retry');
});
await asyncTest('course failure retries only the missing asset and builds scenery exactly once after recovery',async()=>{
  const originalFetch=globalThis.__testFetchWithRetry,courseReads=new Map();let unavailable=true;const gate=deferred();
  globalThis.__testFetchWithRetry=async(url,options)=>{courseReads.set(url,(courseReads.get(url)||0)+1);if(url==='assets/rock.glb'){if(unavailable)throw new Error('HTTP 404');options.onAttempt({attempt:1,maxAttempts:4});options.onProgress({receivedBytes:4,totalBytes:null});await gate.promise;}return originalFetch(url,options)};
  window.neonKart=undefined;window.__testLoadBundledDrivers=options=>syntheticBundle([],options.onProgress,options);
  const originalError=console.error;try{console.error=()=>{};await import(copy.href+'?course-retry');assert.equal(await window.qa.boot(),false)}finally{console.error=originalError}
  const courseQA=window.qa;assert.equal(window.neonKart,undefined);assert.equal(courseQA.get().ready,false);assert.equal(courseQA.courseAssets.size,4);assert.equal(courseQA.scene.children.filter(child=>child.name==='original-course-props').length,0);assert.match(element('loadingDetails').textContent,/HTTP 404/);assert.equal(element('retryLoading').disabled,false);
  unavailable=false;const first=courseQA.boot(),second=courseQA.boot();assert.equal(first,second);assert.equal(courseQA.get().ready,false);assert.equal(element('loadingProgress').value,undefined,'Unknown total must be indeterminate');assert.match(element('loadingBytes').textContent,/正在确定下载大小/);
  gate.resolve();assert.equal(await first,true);assert.ok(window.neonKart);assert.equal(window.neonKart.getState().allDriversLoaded,true);assert.equal(courseQA.scene.children.filter(child=>child.name==='original-course-props').length,1);assert.equal(courseReads.get('assets/rock.glb'),2);for(const [url,count] of courseReads)if(url!=='assets/rock.glb')assert.equal(count,1,'Do not redownload successful course assets');assert.equal(await courseQA.boot(),false);assert.equal(courseQA.scene.children.filter(child=>child.name==='original-course-props').length,1);globalThis.__testFetchWithRetry=originalFetch;
});
await asyncTest('unexpected model preparation failure stays honest and offers manual retry',async()=>{
  const currentGame=window.neonKart,currentQA=window.qa,setup=currentQA.setupRacers,reads=loadedURLs.length;currentQA.set({ready:false,state:'menu'});currentQA.setSetup(()=>{throw new Error('Simulated preparation failure')});
  const originalError=console.error;try{console.error=()=>{};assert.equal(await currentGame.retryLoading(),false)}finally{console.error=originalError}
  assert.equal(currentGame.getState().modelsLoaded,false);assert.match(currentGame.getState().loading.error,/Simulated preparation failure/);assert.match(element('loading').textContent,/模型准备失败/);assert.doesNotMatch(element('loading').textContent,/6 \/ 6 角色已就绪/);assert.equal(element('retryLoading').disabled,false);assert.equal(element('retryLoading').textContent,'重试模型准备');
  currentQA.setSetup(setup);assert.equal(await currentGame.retryLoading(),true);assert.equal(currentGame.getState().loading.error,null);assert.equal(currentGame.getState().modelsLoaded,true);assert.equal(loadedURLs.length,reads);assert.equal(currentQA.scene.children.filter(child=>child.name==='original-course-props').length,1);
});
test('loading panel is above choices and uses accessible native byte progress',()=>{
  const html=fs.readFileSync('src/index.html','utf8');assert.ok(html.indexOf('id="loadingSection"')<html.indexOf('class="driver-picker"'));assert.match(html,/<progress id="loadingProgress"[^>]*aria-labelledby="loadingProgressLabel"/);assert.match(html,/id="loading" role="status" aria-live="polite"/);for(const id of ['loading','loadingSection','loadingProgress','loadingBytes','loadingDetails','retryLoading'])assert.equal([...html.matchAll(new RegExp('id="'+id+'"','g'))].length,1);
});
console.log(JSON.stringify({status:'passed',suite:'real game logic + Three.js camera projection',tests,note:'Node simulation with mocked WebGLRenderer, DOM and synthetic bundled-model loader; actual GLB bytes/loader/skins are checked separately. Not visual/browser gameplay QA'},null,2));
} finally {fs.unlinkSync(copy)}
