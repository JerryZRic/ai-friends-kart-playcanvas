import fs from 'node:fs';
import assert from 'node:assert/strict';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
GLTFLoader.prototype.loadAsync=async function(url){const b=fs.readFileSync('dist/'+url);return this.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const elements=new Map(),touch=[];
function element(id){if(!elements.has(id)){const listeners={};const e={id,listeners,textContent:'',innerHTML:'',disabled:false,style:{},classList:{add(){},remove(){}},setAttribute(){},getContext:()=>new Proxy({},{get:()=>()=>{}}),addEventListener(name,fn){const old=listeners[name];listeners[name]=old?(e)=>{old(e);fn(e)}:fn},setPointerCapture(){},append(){},click(){this.onclick?.()}};elements.set(id,e)}return elements.get(id)}
for(const match of fs.readFileSync('src/index.html','utf8').matchAll(/data-key="([^"]+)"/g)){const e=element('touch-'+match[1]);e.dataset={key:match[1]};touch.push(e)}
const docEvents={};globalThis.document={getElementById:element,body:element('body'),createElement:()=>element('canvas-'+Math.random()),querySelectorAll:()=>touch,addEventListener:(name,fn)=>{const old=docEvents[name];docEvents[name]=old?(e)=>{old(e);fn(e)}:fn},hidden:false};globalThis.window={};globalThis.innerWidth=1280;globalThis.innerHeight=800;globalThis.devicePixelRatio=1;const events={};globalThis.addEventListener=(name,fn)=>events[name]=fn;let frame;globalThis.requestAnimationFrame=fn=>frame=fn;
const source=fs.readFileSync('src/game.js','utf8').replace("import * as THREE from 'three';","import * as THREE from '../tests/three-test.mjs';")+`\nwindow.qa={sample,camera,orbit,mouseLook,player:()=>player,keys,draw,update,set(values){({pos=pos,lane=lane,speed=speed,held=held,boost=boost,state=state,steerVis=steerVis,charge=charge,drifting=drifting}=values);if(values.noBots)bots=[];},get:()=>({steerVis,drifting,shield,view})};`;
const copy=new URL('../src/.game-test-copy.mjs',import.meta.url);fs.writeFileSync(copy,source);
try {
await import(copy);await new Promise(r=>setTimeout(r,40));const game=window.neonKart,qa=window.qa;assert.ok(game,'All models booted');let time=0;const tests=[];
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
console.log(JSON.stringify({status:'passed',suite:'real game logic + Three.js camera projection',tests,note:'Node simulation with mocked WebGLRenderer and DOM; not visual/browser gameplay QA'},null,2));
} finally {fs.unlinkSync(copy)}
