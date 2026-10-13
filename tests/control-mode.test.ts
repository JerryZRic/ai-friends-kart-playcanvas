import test from 'node:test';
import assert from 'node:assert/strict';
import {bindControlPreferenceSelect, controlPreference, readControlPreference, setControlPreference, resolveControlMode, type ControlCapabilities} from '../src/control-mode';
import {mountMobileControls} from '../src/mobile-controls';
import {bindRaceControls} from '../src/race-controls';
const phone: ControlCapabilities = {touchPoints:5,coarse:true,fine:false,hover:false,anyCoarse:true,pointerMedia:true};
const desktop: ControlCapabilities = {touchPoints:0,coarse:false,fine:true,hover:true,anyCoarse:false,pointerMedia:true};
const hybrid = {...desktop,touchPoints:10,anyCoarse:true};
const fire = (target: EventTarget, name: string, values: Record<string,unknown> = {}) => { const event = new Event(name,{cancelable:true}); for(const [k,v] of Object.entries(values))Object.defineProperty(event,k,{value:v,configurable:true}); target.dispatchEvent(event);return event; };
class Node extends EventTarget {
  value=''; hidden=true; dataset:Record<string,string>={}; attrs=new Map<string,string>(); children:Node[]=[]; removed=false; focused=false; captured=new Set<number>();
  appendChild(node:Node){this.children.push(node);return node;} remove(){this.removed=true;}
  setAttribute(k:string,v:string){this.attrs.set(k,v);}getAttribute(k:string){return this.attrs.get(k)??null;}
  contains(node:Node){return this===node||this.children.some(child=>child.contains(node));}
  focus(){this.focused=true;}click(){fire(this,'click');}
  closest(){return null;}setPointerCapture(id:number){this.captured.add(id);}hasPointerCapture(id:number){return this.captured.has(id);}releasePointerCapture(id:number){this.captured.delete(id);}
}
function fixture(input=phone,saved='auto', storage=new Map([['kart-control-mode',saved]])) {
  const media=Object.fromEntries(Object.entries({'(pointer: coarse)':input.coarse,'(pointer: fine)':input.fine,'(hover: hover)':input.hover,'(any-pointer: coarse)':input.anyCoarse}).map(([query,matches])=>[query,Object.assign(new EventTarget(),{matches})]));
  const win=Object.assign(new EventTarget(),{navigator:{maxTouchPoints:input.touchPoints},matchMedia:input.pointerMedia?(q:string)=>media[q]:undefined,localStorage:{getItem:(k:string)=>storage.get(k),setItem:(k:string,v:string)=>storage.set(k,v)}});
  const ids=['mobileTouchControls','mobileControlModePanel','mobileControlMode','pauseControlMode','raceSystemTools','mobileControlModeToggle','mobileControlModePopover','perf-toggle'];
  const nodes=new Map(ids.map(id=>[id,new Node()]));
  nodes.get('mobileControlModePanel')!.appendChild(nodes.get('mobileControlModeToggle')!);nodes.get('mobileControlModePanel')!.appendChild(nodes.get('mobileControlModePopover')!);nodes.get('mobileControlModePopover')!.appendChild(nodes.get('mobileControlMode')!);
  const body=new Node(),canvas=new Node();
  const doc=Object.assign(new EventTarget(),{body,defaultView:win,getElementById:(id:string)=>nodes.get(id)||null,querySelectorAll:()=>[],pointerLockElement:null,hidden:false});
  return {doc,body,win,canvas,nodes,media,storage,get:(id:string)=>nodes.get(id)!,mount:()=>mountMobileControls(doc as any,canvas as any)!};
}

test('automatic initial matrix uses primary pointer/hover, not OS labels, UA or viewport',()=>{
  for(const [label,input,expected] of [
    ['ordinary mouse PC',desktop,'desktop'],['Android-like',phone,'touch'],['iPhone-like',phone,'touch'],['tablet',{...phone,touchPoints:10},'touch'],
    ['touchscreen laptop using mouse',hybrid,'desktop'],['phone with primary external mouse',hybrid,'desktop'],
    ['phone desktop-site unchanged capabilities',phone,'touch'],['narrow desktop window',desktop,'desktop'],
    ['no media API but touch capable',{...phone,pointerMedia:false,coarse:false,anyCoarse:false},'touch'],
    ['no media API and no touch',{...desktop,pointerMedia:false},'desktop'],
    ['inconsistent coarse without touch',{...phone,touchPoints:0},'desktop'],
    ['unknown pointer with secondary touch',{...phone,coarse:false},'touch'],
    ['touch tablet with primary stylus without hover',{...phone,coarse:false,fine:true},'touch'],
  ] as const) assert.equal(resolveControlMode('auto',input),expected,label);
  for(const input of [phone,desktop,hybrid])for(const observed of [null,'touch','desktop'] as const){
    assert.equal(resolveControlMode('touch',input,observed),'touch');assert.equal(resolveControlMode('desktop',input,observed),'desktop');
  }
});

test('saved settings synchronize all selectors, survive remount and remain usable without storage',()=>{
  const f=fixture(phone,'desktop'),m=f.mount();assert.equal(f.body.dataset.inputMode,'desktop');
  for(const id of ['mobileControlMode','pauseControlMode'])assert.equal(f.get(id).value,'desktop');
  f.get('pauseControlMode').value='touch';fire(f.get('pauseControlMode'),'change');
  assert.equal(f.body.dataset.inputMode,'touch');assert.equal(f.get('mobileControlMode').value,'touch');assert.equal(f.storage.get('kart-control-mode'),'touch');m.dispose();
  const restored=fixture(desktop,'auto',f.storage),m2=restored.mount();assert.equal(restored.body.dataset.inputMode,'touch');m2.dispose();
  f.win.localStorage.getItem=()=>{throw Error('denied');};f.win.localStorage.setItem=()=>{throw Error('denied');};
  assert.equal(readControlPreference(f.win as any),'auto');assert.equal(setControlPreference(f.doc as any,'desktop'),false);assert.equal(controlPreference(f.doc as any),'desktop');
  const standalone=new Node(),stop=bindControlPreferenceSelect(f.doc as any,standalone as any);assert.equal(standalone.value,'desktop');stop();
});

test('explicit interaction switches auto once, ignores hover and synthesized mouse, respects manual modes',()=>{
  const f=fixture(hybrid),m=f.mount();let changes=0;f.doc.addEventListener('racecontrolmodechange',()=>changes++);
  let now=10000;const original=Date.now;Date.now=()=>now;
  try {
    fire(f.doc,'pointerdown',{pointerType:'touch',target:{closest:()=>({})}});assert.equal(f.body.dataset.inputMode,'desktop','UI targets must not disappear during the same press');
    fire(f.doc,'pointerdown',{pointerType:'touch'});assert.equal(f.body.dataset.inputMode,'touch');assert.equal(changes,1);
    fire(f.doc,'pointermove',{pointerType:'mouse'});fire(f.doc,'pointerdown',{pointerType:'mouse'});assert.equal(changes,1);
    now+=1000;fire(f.doc,'pointerdown',{pointerType:'mouse',sourceCapabilities:{firesTouchEvents:true}});assert.equal(changes,1);
    fire(f.doc,'pointerdown',{pointerType:'mouse'});assert.equal(f.body.dataset.inputMode,'desktop');assert.equal(changes,2);
    fire(f.doc,'pointerdown',{pointerType:'touch'});fire(f.win,'keydown',{code:'KeyW',repeat:false});assert.equal(f.body.dataset.inputMode,'desktop');
    fire(f.doc,'pointerdown',{pointerType:'touch'});fire(f.win,'keydown',{code:'ArrowDown',target:{closest:()=>({})}});assert.equal(f.body.dataset.inputMode,'touch');
    setControlPreference(f.doc as any,'desktop');fire(f.doc,'pointerdown',{pointerType:'touch'});assert.equal(f.body.dataset.inputMode,'desktop');
    setControlPreference(f.doc as any,'touch');now+=1000;fire(f.doc,'pointerdown',{pointerType:'mouse'});fire(f.win,'keydown',{code:'KeyW'});assert.equal(f.body.dataset.inputMode,'touch');
    setControlPreference(f.doc as any,'auto');assert.equal(f.body.dataset.inputMode,'desktop','return to auto reevaluates primary capabilities');
  } finally {Date.now=original;m.dispose();}
});

test('capability updates and teardown are deterministic and do not retain stale event bindings',()=>{
  const f=fixture(hybrid),m=f.mount();fire(f.doc,'pointerdown',{pointerType:'touch'});assert.equal(f.body.dataset.inputMode,'touch');
  fire(f.media['(pointer: fine)'],'change');assert.equal(f.body.dataset.inputMode,'desktop');
  f.media['(pointer: fine)'].matches=false;f.media['(hover: hover)'].matches=false;f.media['(pointer: coarse)'].matches=true;fire(f.media['(pointer: coarse)'],'change');assert.equal(f.body.dataset.inputMode,'touch');
  fire(f.win,'pagehide',{persisted:true});assert.equal(f.body.dataset.inputMode,'touch');m.dispose();m.dispose();
  fire(f.doc,'pointerdown',{pointerType:'mouse'});fire(f.win,'keydown',{code:'KeyW'});assert.equal(f.body.dataset.inputMode,undefined);
  assert.ok(f.get('raceSystemTools').removed);
});

test('top-right mode popup closes on select, outside and Escape without forwarding pause',()=>{
  const f=fixture(),m=f.mount(),toggle=f.get('mobileControlModeToggle'),panel=f.get('mobileControlModePopover');let pauses=0;
  f.win.addEventListener('keydown',()=>pauses++);
  toggle.click();assert.equal(panel.hidden,false);assert.equal(toggle.getAttribute('aria-expanded'),'true');assert.ok(f.get('mobileControlMode').focused);
  fire(f.win,'keydown',{code:'Escape'});assert.equal(panel.hidden,true);assert.equal(pauses,0);
  toggle.click();f.get('mobileControlMode').value='desktop';fire(f.get('mobileControlMode'),'change');assert.equal(panel.hidden,true);
  toggle.click();fire(f.doc,'click',{target:f.canvas});assert.equal(panel.hidden,true);
  const perf=f.get('perf-toggle');perf.setAttribute('aria-expanded','true');let closed=0;perf.addEventListener('click',()=>{closed++;perf.setAttribute('aria-expanded','false');});
  toggle.click();assert.equal(closed,1);fire(f.doc,'click',{target:perf});assert.equal(panel.hidden,true);m.dispose();
});

test('real mode controller clears held race input before the next key, without pause or stuck fingers',()=>{
  const f=fixture(),m=f.mount(),throttle=new Node();throttle.dataset.key='KeyW';let pauses=0;
  const controls=bindRaceControls(f.canvas as any,{document:f.doc as any,window:f.win as any,buttons:[throttle as any],state:()=> 'active',pause:()=>pauses++,useItem(){},switchCamera(){},recenter(){},start(){},status(){}});
  fire(throttle,'pointerdown',{pointerType:'touch',pointerId:1,button:0});assert.equal(controls.keys.KeyW,true);
  fire(f.win,'keydown',{code:'KeyD',repeat:false,target:f.canvas});assert.equal(f.body.dataset.inputMode,'desktop');assert.equal(controls.keys.KeyW,false);assert.equal(controls.keys.KeyD,true);assert.equal(throttle.captured.size,0);assert.equal(pauses,0);
  fire(f.doc,'pointerdown',{pointerType:'touch'});assert.equal(controls.keys.KeyD,false);assert.equal(f.body.dataset.inputMode,'touch');assert.equal(pauses,0);
  controls.dispose();m.dispose();
});

test('the first auto-detected touch reaches camera drag after clearing old input, alongside other fingers',()=>{
  const f=fixture(hybrid),m=f.mount(),throttle=new Node();throttle.dataset.key='KeyW';let pauses=0;
  const controls=bindRaceControls(f.canvas as any,{document:f.doc as any,window:f.win as any,buttons:[throttle as any],state:()=> 'active',pause:()=>pauses++,useItem(){},switchCamera(){},recenter(){},start(){},status(){}});
  fire(f.win,'keydown',{code:'KeyD',target:f.canvas});assert.equal(controls.keys.KeyD,true);
  // Explicit capture then target phases mirror the browser's event path.
  const first={pointerType:'touch',pointerId:1,button:0,clientX:100,clientY:100};
  fire(f.doc,'pointerdown',first);fire(f.canvas,'pointerdown',first);
  assert.equal(f.body.dataset.inputMode,'touch');assert.equal(controls.keys.KeyD,false);assert.equal(f.canvas.captured.has(1),true);
  assert.equal(controls.orbit.get().targetYaw,0,'tap alone does not turn');
  fire(throttle,'pointerdown',{pointerType:'touch',pointerId:2,button:0});
  fire(f.canvas,'pointermove',{pointerType:'touch',pointerId:1,clientX:140,clientY:120});
  assert.ok(controls.orbit.get().targetYaw>0);assert.ok(controls.orbit.get().targetPitch>0);assert.equal(controls.keys.KeyW,true);assert.equal(pauses,0);
  const angles=controls.orbit.get();fire(f.canvas,'pointerup',{pointerId:1});
  fire(f.canvas,'pointermove',{pointerId:1,clientX:250,clientY:250});assert.deepEqual(controls.orbit.get(),angles,'release retains view, without automatic recenter');assert.equal(controls.keys.KeyW,true);
  fire(throttle,'pointerup',{pointerId:2});assert.equal(controls.keys.KeyW,false);controls.dispose();m.dispose();
});

test('unavailable pointer-media API falls back to reported touch support without blocking mount',()=>{
  const f=fixture();f.win.matchMedia=()=>{throw Error('unsupported');};const m=f.mount();assert.equal(f.body.dataset.inputMode,'touch');m.dispose();
});
