import test from 'node:test';
import assert from 'node:assert/strict';
import {mountBrandIntro,readyBrandIntro,failBrandIntro,brandIntroPending} from '../src/brand-intro';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';

const read=(path:string)=>readFileSync(path,'utf8');
const source=read('src/brand-intro-bootstrap.js'),css=read('src/brand-intro.css');
function harness(reduced=false){
 class Target extends EventTarget {
  listeners=new Map<string,Set<any>>();
  override addEventListener(type:string,fn:any,options?:any){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type)!.add(fn);super.addEventListener(type,fn,options);}
  override removeEventListener(type:string,fn:any,options?:any){this.listeners.get(type)?.delete(fn);super.removeEventListener(type,fn,options);}
  count(){return [...this.listeners.values()].reduce((n,set)=>n+set.size,0);}
 }
 let now=0,next=0;
 const queued=new Map<number,{at:number;fn:()=>void}>();
 const setTimer=(fn:()=>void,delay:number)=>{queued.set(++next,{at:now+delay,fn});return next;};
 const clearTimer=(id:number)=>{queued.delete(id);};
 const overlay={removed:false,style:{opacity:'1',animation:''},dataset:{} as Record<string,string>,remove(){this.removed=true;}};
 const style={removed:false,remove(){this.removed=true;}};
 const recovery={hidden:true,style:{display:'none'},isConnected:true};
 const doc=Object.assign(new Target(),{hidden:false,defaultView:null as any,getElementById:(id:string)=>id==='brand-intro'&&!overlay.removed?overlay:id==='startup-recovery'?recovery:null,querySelector:()=>style});
 const win=Object.assign(new Target(),{matchMedia:()=>({matches:reduced})});doc.defaultView=win;
 const context={window:win,document:doc,performance:{now:()=>now},setTimeout:setTimer,clearTimeout:clearTimer,requestAnimationFrame:(fn:()=>void)=>setTimer(fn,16),cancelAnimationFrame:clearTimer,addEventListener:win.addEventListener.bind(win),removeEventListener:win.removeEventListener.bind(win)};
 const execute=()=>runInNewContext(source,context);execute();
 const runtime=(win as any).__timewishIntro;
 function advance(to:number){assert.ok(to>=now);let guard=0;while(true){const entry=[...queued.entries()].filter(([,row])=>row.at<=to).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;if(++guard>5000)throw new Error('Timer loop');queued.delete(entry[0]);now=entry[1].at;entry[1].fn();}now=to;}
 function jump(to:number){now=to;doc.dispatchEvent(new Event('visibilitychange'));}
 return {doc:doc as unknown as Document,win:win as unknown as Window,overlay,style,recovery,queued,runtime,execute,advance,jump,elapseWithoutEvents:(to:number)=>{now=to;},get now(){return now;},get opacity(){return Number(overlay.style.opacity);},get listeners(){return doc.count()+win.count();},runRecovery(){const script=read('index.html').match(/<script>\n(\(function\(\)\{var panel=[\s\S]*?)<\/script>/)![1];runInNewContext(script,context);}};
}

test('early readiness holds for A1+B2, then a single .5-second overlay fade',()=>{
 for(const readyAt of [0,999,1000,2999,3000]){
  const h=harness();h.advance(readyAt);readyBrandIntro(h.doc);h.advance(3000);
  assert.equal(h.overlay.removed,false);assert.equal(h.opacity,1);assert.equal(h.overlay.dataset.introPhase,'fade-out');
  h.jump(3250);assert.equal(h.opacity,.5);h.advance(3499);assert.equal(h.overlay.removed,false);h.advance(3500);assert.equal(h.overlay.removed,true);
  assert.equal(h.queued.size,0);assert.equal(h.listeners,0);
 }
});

test('readiness between B2 and B5 starts fast fade immediately, including both boundaries',()=>{
 for(const readyAt of [3001,4250,5999,6000]){
  const h=harness();h.advance(readyAt);h.runtime.ready();assert.equal(h.opacity,1);
  h.jump(readyAt+250);assert.equal(h.opacity,.5);h.advance(readyAt+500);assert.equal(h.overlay.removed,true);
 }
});

test('unready startup is bounded by A1+B5+C1.5 and reveals the real loader',()=>{
 const h=harness();h.advance(5999);assert.equal(h.opacity,1);assert.equal(h.overlay.removed,false);
 h.advance(6000);assert.equal(h.overlay.dataset.introPhase,'fade-out');h.jump(6750);assert.equal(h.opacity,.5);
 h.advance(7499);assert.equal(h.overlay.removed,false);h.advance(7500);assert.equal(h.overlay.removed,true);assert.equal(h.queued.size,0);
});

test('late readiness preserves opacity and accelerates remaining slow fade without extending deadline',()=>{
 for(const [readyAt,opacity,end] of [[6001,1499/1500,6001+(1499/1500)*500],[6750,.5,7000],[7200,.2,7350],[7400,1/15,7500]]){
  const h=harness();h.jump(readyAt);assert.ok(Math.abs(h.opacity-opacity)<1e-10);h.runtime.ready();assert.ok(Math.abs(h.opacity-opacity)<1e-10,'no reset or opacity jump');
  h.runtime.ready();h.advance(end-.01);assert.equal(h.overlay.removed,false);h.advance(end+.01);assert.equal(h.overlay.removed,true);
 }
});

test('throttled timers and hidden tabs use absolute deadlines, never replaying phases',()=>{
 const h=harness();(h.doc as any).hidden=true;h.jump(6750);assert.equal(h.opacity,.5);h.runtime.ready();h.jump(7000);assert.equal(h.overlay.removed,true);
 const delayed=harness();delayed.jump(8000);let finished=0;mountBrandIntro(delayed.doc,delayed.win,()=>finished++);assert.equal(finished,1);assert.equal(delayed.queued.size,0);
 const restored=harness();restored.advance(1500);restored.win.dispatchEvent(Object.assign(new Event('pagehide'),{persisted:true}));assert.equal(restored.queued.size,0);
 restored.elapseWithoutEvents(8000);restored.win.dispatchEvent(new Event('pageshow'));assert.equal(restored.overlay.removed,true);assert.equal(restored.queued.size,0);
});

test('reduced motion keeps a readable static logo for .8s with no fade or readiness delay',()=>{
 for(const readyAt of [0,500,null]){
  const h=harness(true);if(readyAt!==null){h.advance(readyAt);h.runtime.ready();}h.advance(799);assert.equal(h.overlay.dataset.introPhase,'static');assert.equal(h.opacity,1);assert.equal(h.overlay.removed,false);
  h.advance(800);assert.equal(h.overlay.removed,true);assert.equal(h.queued.size,0);
 }
 assert.match(css,/#brand-intro img\{opacity:1;animation:none/);
});

test('a slow module or repeated bootstrap/mount cannot restart or recreate the document intro',()=>{
 const h=harness();h.advance(4000);const original=h.runtime;h.execute();assert.equal((h.win as any).__timewishIntro,original);
 let first=0,second=0;const a=mountBrandIntro(h.doc,h.win,()=>first++),b=mountBrandIntro(h.doc,h.win,()=>second++);
 assert.equal(first+second,0);h.runtime.ready();h.advance(4500);assert.deepEqual([first,second],[1,1]);a.dispose();b.dispose();assert.deepEqual([first,second],[1,1]);
 h.execute();h.runtime.ready();let remount=0;mountBrandIntro(h.doc,h.win,()=>remount++);assert.equal(remount,1);assert.equal(h.queued.size,0);assert.equal(brandIntroPending(h.doc),false);
});

test('disposal and non-persisted pagehide release interaction once and clean timers/listeners',()=>{
 for(const close of ['dispose','pagehide']){
  const h=harness();let completions=0,inert=true;const intro=mountBrandIntro(h.doc,h.win,()=>{completions++;inert=false;});
  h.advance(1200);if(close==='dispose')intro.dispose();else h.win.dispatchEvent(Object.assign(new Event('pagehide'),{persisted:false}));
  intro.dispose();assert.equal(inert,false);assert.equal(completions,1);assert.equal(h.overlay.removed,true);assert.equal(h.queued.size,0);assert.equal(h.listeners,0);
 }
});

test('errors expose retry UI immediately and a failed cold module never leaves the SPA root inert',()=>{
 for(const when of [100,5000,6500]){
  const h=harness();h.runRecovery();let inert=true;mountBrandIntro(h.doc,h.win,()=>{inert=false;});h.advance(when);
  const error=new Event('error');Object.defineProperty(error,'target',{value:{tagName:'SCRIPT'}});h.win.dispatchEvent(error);
  assert.equal(h.overlay.removed,true);assert.equal(inert,false);assert.equal(h.recovery.hidden,false);assert.equal(h.recovery.style.display,'grid');
  h.runtime.ready();assert.equal(h.recovery.hidden,false,'late readiness cannot dismiss recovery');
 }
 const h=harness();h.runRecovery();h.advance(7500);assert.equal(h.overlay.removed,true);assert.equal(h.recovery.hidden,true);h.advance(15000);assert.equal(h.recovery.hidden,false,'stalled initial module retains bounded error/retry watchdog');
 const mounted=harness();let released=0;mountBrandIntro(mounted.doc,mounted.win,()=>released++);failBrandIntro(mounted.doc);failBrandIntro(mounted.doc);assert.equal(released,1);
});

test('bootstrap omission fails open instead of leaving the application inert',()=>{
 const h=harness();delete (h.win as any).__timewishIntro;let count=0;const mounted=mountBrandIntro(h.doc,h.win,()=>count++);mounted.dispose();assert.equal(count,1);assert.equal(h.overlay.removed,true);h.runtime.finish();
});

test('all cold entries embed the same early controller, bounded CSS fallback and original outlined logo',()=>{
 const svg=readFileSync('public/brand/timewish.svg');assert.equal(createHash('sha256').update(svg).digest('hex'),'0392baa24bd617a602a13164e4695309d8eb213baeb2f5be2bf532484666c8f8');
 for(const page of ['index.html','garage.html','coast.html','waterpark.html']){
  const html=read(page);assert.equal(html.match(/<script data-brand-intro-bootstrap>\n([\s\S]*?)<\/script>/)![1],source);
  assert.equal(html.match(/<style data-brand-intro-style>\n([\s\S]*?)<\/style>/)![1],css);
  assert.ok(html.indexOf('data-brand-intro-bootstrap')<html.indexOf('src="/src/spa.ts"'));
  assert.match(html,/height:auto/);assert.match(html,/prefers-reduced-motion/);assert.match(html,/window\.__timewishIntro\?\.finish\(\)/);
 }
 assert.match(css,/timewish-logo-in 1s linear forwards/);assert.match(css,/@keyframes timewish-logo-in\{from\{opacity:0\}to\{opacity:1\}\}/);
 assert.match(css,/timewish-cover-deadline 7\.5s/);
 const host=read('src/spa.ts');assert.match(host,/script,noscript,\[data-brand-intro\]/);assert.match(host,/sceneRoot\.replaceChildren/);
 assert.ok(host.indexOf('active=mountMenu()')<host.indexOf('  releaseColdRecovery();'),'keep recovery until a real scene owns loading');
 assert.match(host,/loading\(url,error\);releaseColdRecovery\(\);failBrandIntro\(document\)/);
 const menu=read('src/menu.ts'),reveal=menu.slice(menu.indexOf('function revealHome'),menu.indexOf('let state='));
 assert.ok(reveal.indexOf('button.disabled=false')<reveal.indexOf('readyBrandIntro(document)'),'announce readiness only after enabling real menu controls');
 assert.match(reveal,/if\(!fallback&&boot.ready\(\)===false\)return/);
});
