import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('index.html','utf8');
function boot(){
 class Node extends EventTarget {hidden=false;disabled=false;value=0;textContent='';attrs:Record<string,string>={};setAttribute(k:string,v:string){this.attrs[k]=v;}}
 const nodes=new Map([...html.matchAll(/id="(menu-boot[^"]*)"/g)].map(m=>[m[1],new Node()]));
 let id=0,reloads=0;const timers=new Map<number,()=>void>();
 const window=new EventTarget() as EventTarget & {__menuBoot:any};const body={dataset:{} as Record<string,string>};
 vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)![1],{window,document:{body,getElementById:(id:string)=>nodes.get(id)},location:{reload:()=>reloads++},setTimeout:(f:()=>void,ms:number)=>{assert.equal(ms,30000);timers.set(++id,f);return id;},clearTimeout:(id:number)=>timers.delete(id)});
 return {api:window.__menuBoot,window,body,nodes,timers,reloads:()=>reloads,timeout:()=>{for(const f of [...timers.values()])f();}};
}
test('HTML-first shell has useful title and progress before the engine executes',()=>{
 assert.match(html,/<main[^>]*><section class="boot-cover"><h1>大肥鱼卡丁车/);
 assert.ok(html.indexOf('id="menu-boot"')<html.indexOf('src="/src/menu.ts"'));
 assert.match(html,/<style>[\s\S]*\[hidden\]\{display:none!important\}/);
 assert.match(html,/body\[data-menu-loading="true"\] \.title-actions\{display:none!important\}/);
 const b=boot();assert.equal(b.body.dataset.menuLoading,'true');assert.equal(b.timers.size,1);
});
test('real stages advance monotonically by milestones, never a timed fake percentage',()=>{
 const b=boot(),bar=b.nodes.get('menu-boot-progress')!;
 assert.equal(bar.value,0);b.api.stage(2,'engine');assert.equal(bar.value,1);b.api.stage(3,'scene');assert.equal(bar.value,2);b.api.stage(4,'render');assert.equal(bar.value,3);
 assert.equal(b.api.ready(),true);assert.equal(bar.value,4);assert.equal(b.nodes.get('menu-boot')!.hidden,true);assert.equal(b.timers.size,0);assert.equal(b.body.dataset.menuLoading,'false');
 b.api.fail('late unrelated error');assert.equal(b.nodes.get('menu-boot')!.hidden,true);
});
test('missing module times out with retry, cannot unlock via late readiness, and preserves URL through reload',()=>{
 const b=boot();b.timeout();assert.equal(b.nodes.get('menu-boot-retry')!.hidden,false);assert.equal(b.nodes.get('menu-boot-continue')!.hidden,true);assert.equal(b.nodes.get('menu-boot-progress')!.hidden,true);assert.equal(b.api.ready(),false);assert.equal(b.body.dataset.menuLoading,'true');
 b.nodes.get('menu-boot-retry')!.dispatchEvent(new Event('click'));assert.equal(b.reloads(),1);assert.equal(b.nodes.get('menu-boot-retry')!.disabled,true);assert.doesNotMatch(html,/location\.(?:href|search)\s*=/);
});
test('GPU/import failure offers bounded explicit static fallback only after menu handlers exist',()=>{
 const b=boot();let continued=0;b.api.begin(()=>continued++);b.api.fail('GPU unavailable');assert.equal(b.nodes.get('menu-boot-continue')!.hidden,false);assert.equal(b.timers.size,0);
 b.nodes.get('menu-boot-continue')!.dispatchEvent(new Event('click'));b.nodes.get('menu-boot-continue')!.dispatchEvent(new Event('click'));assert.equal(continued,1);assert.equal(b.nodes.get('menu-boot')!.hidden,true);assert.equal(b.body.dataset.menuLoading,'false');
});
test('repeat entry resets errors and history navigation dismisses an old gate',()=>{
 const b=boot();b.api.fail('network');b.api.begin(()=>{});assert.equal(b.nodes.get('menu-boot-retry')!.hidden,true);assert.equal(b.nodes.get('menu-boot-progress')!.hidden,false);assert.equal(b.timers.size,1);b.timeout();b.api.dismiss();assert.equal(b.nodes.get('menu-boot')!.hidden,true);assert.equal(b.timers.size,0);
});
test('module script network errors settle loading immediately',()=>{
 const b=boot();const error=new Event('error');Object.defineProperty(error,'target',{value:{tagName:'SCRIPT'}});b.window.dispatchEvent(error);assert.equal(b.nodes.get('menu-boot-retry')!.hidden,false);assert.equal(b.timers.size,0);
});
