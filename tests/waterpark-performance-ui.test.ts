import test from 'node:test';
import assert from 'node:assert/strict';
import {createPerformancePanel,PERFORMANCE_BUILD} from '../src/waterpark-performance-ui';

/** DOM event/Blob coverage only; no rendered WebGL or device FPS claim. */
function harness(run:(env:any)=>void|Promise<void>) {
 return async()=>{
  const g=globalThis as any;
  const names=['document','innerWidth','innerHeight','devicePixelRatio','performance','navigator'];
  const saved=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(g,name)]));
  const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
  const elements=new Map<string,Element>(),blobs:Blob[]=[],downloads:any[]=[],copies:string[]=[];
  let now=0,disposed=false,failClipboard=false;
  class Element extends EventTarget {
   id='';hidden=false;disabled=false;removed=false;textContent='';width=1280;height=800;attributes:Record<string,string>={};href='';download='';
   constructor(readonly tagName='DIV'){super();}
   set innerHTML(html:string){for(const match of html.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const child=new Element(match[1].toUpperCase());child.id=match[3];child.disabled=/\bdisabled\b/.test(match[2]);child.hidden=/\bhidden\b/.test(match[2]);for(const attribute of match[2].matchAll(/([\w-]+)="([^"]*)"/g))child.setAttribute(attribute[1],attribute[2]);elements.set(child.id,child);}}
   querySelector(selector:string){return elements.get(selector.slice(1))??null;}
   append(child:Element){elements.set(child.id,child);}
   remove(){this.removed=true;elements.delete(this.id);}
   setAttribute(name:string,value:string){this.attributes[name]=value;}
   focus(){g.document.activeElement=this;}
   click(){if(this.tagName==='A')downloads.push({href:this.href,download:this.download});if(!this.disabled)this.dispatchEvent(new Event('click'));}
  }
  const documentTarget=new EventTarget();
  g.document=Object.assign(documentTarget,{hidden:false,activeElement:null,body:new Element('BODY'),createElement:(tag:string)=>new Element(tag.toUpperCase())});
  g.innerWidth=1280;g.innerHeight=800;g.devicePixelRatio=1;
  Object.defineProperty(g,'performance',{configurable:true,value:{now:()=>now}});
  Object.defineProperty(g,'navigator',{configurable:true,value:{clipboard:{writeText:async(text:string)=>{if(failClipboard)throw new Error('denied');copies.push(text);}}}});
  URL.createObjectURL=blob=>{blobs.push(blob as Blob);return 'blob:performance-test';};URL.revokeObjectURL=()=>{};
  const canvas=new Element('CANVAS');
  const water={requestedRefraction:true,refractionActive:true,reflectionActive:true,reflectionTarget:{width:640,height:400} as {width:number;height:number}|null,refractionTarget:{width:640,height:400} as {width:number;height:number}|null,scale:.5,maxDimension:768,refractionDepth:'sampled-oblique-depth',capture:'static-scenery'};
  let setterCalls=0;
  const panel=createPerformancePanel(canvas as any,()=>({driver:'whale',pixelRatioCap:1.7,water}),{getEnabled:()=>water.requestedRefraction,setEnabled:enabled=>{setterCalls++;water.requestedRefraction=enabled;water.refractionActive=enabled;water.refractionTarget=enabled?{width:640,height:400}:null;}});
  const $=(id:string)=>elements.get(id)!;
  const env={$,panel,water,canvas,blobs,downloads,copies,document:documentTarget,get setterCalls(){return setterCalls;},get disposed(){return disposed;},setClock(value:number){now=value;},sample(value:number,active=true,reason='riding'){now=value;panel.sample(value,active,reason);},failClipboard(){failClipboard=true;},dispose(){panel.dispose();disposed=true;}};
  try{await run(env);}finally{if(!disposed)panel.dispose();URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;for(const[name,descriptor]of saved){if(descriptor)Object.defineProperty(g,name,descriptor);else delete g[name];}}
 };
}

test('refraction A/B toggle locks across collapsed, paused and hidden capture flows',harness(async env=>{
 const {$,panel,water,canvas}=env;
 assert.equal($('perf-refraction').attributes['aria-pressed'],'true');
 assert.equal($('perf-refraction').textContent,'水面折射：开');
 $('perf-refraction').click();assert.equal(water.requestedRefraction,false);assert.equal(env.setterCalls,1);
 assert.equal($('perf-refraction').attributes['aria-pressed'],'false');
 assert.equal(document.activeElement,canvas);
 $('perf-start').click();assert.equal($('perf-refraction').disabled,true);assert.match($('perf-water-note').textContent,/已锁定.*停止/);
 $('perf-refraction').click();$('perf-refraction').dispatchEvent(new Event('click'));assert.equal(env.setterCalls,1,'disabled and synthetic clicks cannot change a recording');
 assert.equal($('perf-body').hidden,true,'sampling can continue with the panel collapsed');
 env.sample(0);env.sample(20);panel.interrupt('paused');env.sample(2000,false,'paused');
 assert.equal($('perf-refraction').disabled,true,'a paused capture stays locked');
 (document as any).hidden=true;env.document.dispatchEvent(new Event('visibilitychange'));env.sample(3000);
 assert.equal($('perf-refraction').disabled,true,'backgrounding does not unlock a capture');
 (document as any).hidden=false;env.sample(4000);env.sample(4020);
 $('perf-cancel').click();assert.equal($('perf-refraction').disabled,false);assert.match($('perf-result').textContent,/水面折射：关/);
 $('perf-export').click();const payload=JSON.parse(await env.blobs[0].text());
 assert.equal(payload.initialContext.water.requestedRefraction,false);assert.equal(payload.initialContext.water.refractionTarget,null);
 assert.equal(payload.result.activeMs,40);assert.equal(payload.result.frames,2);assert.equal(payload.result.status,'cancelled');
 assert.deepEqual(payload.result.interruptions,{paused:1});
 $('perf-refraction').click();assert.equal(water.requestedRefraction,true);assert.equal(env.setterCalls,2);
 assert.match($('perf-result').textContent,/水面折射：关/,'later selection must not relabel the stored result');
 $('perf-copy').click();await Promise.resolve();assert.match(env.copies[0],/水面折射：关/);
 assert.match(env.copies[0],new RegExp(PERFORMANCE_BUILD));
}));

test('completed exports retain actual initial/final render target sizes and nested immutable water settings',harness(async env=>{
 const {$,water}=env;
 $('perf-toggle').click();$('perf-start').click();env.sample(0);env.sample(59990);
 assert.equal($('perf-refraction').disabled,true);
 // A resize on the final interval must be retained even though it is too soon
 // for the next regular 250 ms panel/context refresh.
 water.reflectionTarget!.width=768;water.reflectionTarget!.height=480;
 water.refractionTarget!.width=768;water.refractionTarget!.height=480;
 env.sample(60000);
 assert.equal($('perf-start').disabled,false);assert.equal($('perf-cancel').disabled,true);
 assert.equal($('perf-refraction').disabled,false,'completion unlocks immediately, not on the next paint tick');
 assert.match($('perf-result').textContent,/采集条件有变化/);
 $('perf-export').click();
 const payload=JSON.parse(await env.blobs[0].text());
 assert.equal(payload.schemaVersion,2);assert.equal(payload.buildId,PERFORMANCE_BUILD);
 assert.equal(payload.refractionControlLockedDuringCapture,true);
 assert.equal(payload.contextSampleIntervalMs,250);
 assert.equal(payload.result.status,'complete');assert.equal(payload.result.activeMs,60000);
 assert.deepEqual(payload.initialContext.water.reflectionTarget,{width:640,height:400});
 assert.deepEqual(payload.initialContext.water.refractionTarget,{width:640,height:400});
 assert.deepEqual(payload.finalContext.water.reflectionTarget,{width:768,height:480});
 assert.deepEqual(payload.finalContext.water.refractionTarget,{width:768,height:480});
 assert.equal(payload.finalContext.water.scale,.5);assert.equal(payload.finalContext.water.maxDimension,768);
 assert.equal(payload.finalContext.water.refractionDepth,'sampled-oblique-depth');assert.equal(payload.finalContext.water.capture,'static-scenery');
 assert.equal(payload.contextChanges.length,1);assert.equal(payload.contextChanges[0].activeMs,60000);
 assert.equal(payload.contextChangesTruncated,false);
 assert.deepEqual(env.downloads,[{href:'blob:performance-test',download:PERFORMANCE_BUILD+'.json'}]);
 // Capture end state is also detached from objects returned by the scene.
 water.reflectionTarget!.width=123;water.refractionActive=false;$('perf-refraction').click();
 $('perf-export').click();assert.deepEqual(JSON.parse(await env.blobs[1].text()),payload);
}));

test('a new A/B capture resets old results and copying failure preserves the local export',harness(async env=>{
 const {$}=env;
 $('perf-toggle').click();$('perf-start').click();env.sample(0);env.sample(20);$('perf-cancel').click();
 env.failClipboard();$('perf-copy').click();await Promise.resolve();await Promise.resolve();
 assert.match($('perf-status').textContent,/浏览器未允许复制/);assert.equal($('perf-export').disabled,false);
 $('perf-refraction').click();$('perf-start').click();
 assert.equal($('perf-result').textContent,'');assert.equal($('perf-export').disabled,true);assert.equal($('perf-copy').disabled,true);
 env.sample(100);env.sample(120);$('perf-cancel').click();$('perf-export').click();
 const payload=JSON.parse(await env.blobs[0].text());
 assert.equal(payload.initialContext.water.requestedRefraction,false);assert.equal(payload.finalContext.water.requestedRefraction,false);
 assert.equal(payload.initialContext.water.refractionActive,false);assert.equal(payload.initialContext.water.refractionTarget,null);
 assert.deepEqual(payload.contextChanges,[]);assert.equal(payload.result.frames,1);
 const control=$('perf-refraction'),start=$('perf-start'),root=$('performance');
 const calls=env.setterCalls;env.dispose();control.click();start.click();
 assert.equal(root.removed,true);assert.equal(env.setterCalls,calls,'disposal removes the toggle listener');
}));

test('context history marks truncation only after an observation is actually dropped',harness(async env=>{
 const {$,water}=env;
 $('perf-start').click();env.sample(0);
 for(let index=1;index<=64;index++){water.reflectionTarget!.width=600+index;env.sample(index*250);}
 $('perf-cancel').click();$('perf-export').click();
 const full=JSON.parse(await env.blobs[0].text());assert.equal(full.contextChanges.length,64);assert.equal(full.contextChangesTruncated,false);
 $('perf-start').click();env.sample(17000);
 for(let index=1;index<=65;index++){water.reflectionTarget!.width=500+index;env.sample(17000+index*250);}
 $('perf-cancel').click();$('perf-export').click();
 const truncated=JSON.parse(await env.blobs[1].text());assert.equal(truncated.contextChanges.length,64);assert.equal(truncated.contextChangesTruncated,true);
 assert.equal(truncated.finalContext.water.reflectionTarget.width,565,'final actual state survives history truncation');
}));
