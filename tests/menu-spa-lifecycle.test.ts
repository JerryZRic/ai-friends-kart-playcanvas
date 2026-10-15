import assert from 'node:assert/strict';
import {setMaxListeners,defaultMaxListeners} from 'node:events';
import test from 'node:test';
import {mountMenu} from '../src/menu';
import {getDocumentMusic} from '../src/music-ui';

/** DOM lifecycle contracts only; this fixture deliberately has no GPU/audio backend. */
test('SPA menu remounts cleanly while keeping the document music owner',()=>{
 const maxListeners=defaultMaxListeners;setMaxListeners(0);
 const g=globalThis as any,names=['document','window','location','history','localStorage','cancelAnimationFrame'];
 const saved=new Map(names.map(n=>[n,Object.getOwnPropertyDescriptor(g,n)]));
 const elements:Element[]=[];
 class Element extends EventTarget{
  naturalWidth=0;complete=false;
  classList={contains:(name:string)=>(this.attrs.class||this.className).split(' ').includes(name),add:(name:string)=>{this.className=[this.className,name].filter(Boolean).join(' ');}};
  href='';hidden=false;inert=false;attrs:Record<string,string>={};dataset:Record<string,string>={};disabled=false;checked=false;value='';textContent='';className='';html='';id='';owned:Element[]=[];
  style={getPropertyValue:(_name:string)=>'',getPropertyPriority:(_name:string)=>'',setProperty:(_name:string,_value:string)=>{},removeProperty:(_name:string)=>{}};
  constructor(readonly tagName='DIV'){super();}
  getAttribute(name:string){return this.attrs[name]??null;}
  removeAttribute(name:string){delete this.attrs[name];}
  set innerHTML(html:string){this.html=html;if(this===root)elements.length=0;this.owned=[];for(const m of html.matchAll(/<([a-z]+)\b([^>]*)>/g)){const el=new Element(m[1].toUpperCase());for(const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g)){el.attrs[a[1]]=a[2];if(a[1].startsWith('data-'))el.dataset[a[1].slice(5)]=a[2];}el.disabled=/\bdisabled\b/.test(m[2]);el.checked=/\bchecked\b/.test(m[2]);el.value=el.attrs.value??'';elements.push(el);this.owned.push(el);}}
  get innerHTML(){return this.html;}
  querySelectorAll(selector:string):Element[]{if(selector.includes(','))return selector.split(',').flatMap(part=>this.querySelectorAll(part)) as Element[];return elements.filter(el=>{if(selector.startsWith('#'))return (el.attrs.id||el.id)===selector.slice(1);if(selector.startsWith('.'))return (el.attrs.class||el.className).split(' ').includes(selector.slice(1));const m=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return m&&m[1] in el.attrs&&(m[2]===undefined||el.attrs[m[1]]===m[2]);});}
  querySelector(selector:string){return this.querySelectorAll(selector)[0]??null;}
  setAttribute(name:string,value:string){this.attrs[name]=value;}
  append(...children:Element[]){for(const child of children)this.appendChild(child);}
  appendChild(el:Element){elements.push(el);return el;}
  remove(){for(const el of [this,...this.owned]){const i=elements.indexOf(el);if(i>=0)elements.splice(i,1);}}
  focus(){g.document.activeElement=this;}
  click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
 }
 const headerGarage=new Element('A'),wordmark=new Element('A');
 const shell=new Element(),root=new Element(),windowTarget=new EventTarget(),location={search:'',pathname:'/dev/index.html',origin:'https://test.invalid',get href(){return 'https://test.invalid/dev/index.html'+this.search;}};const urls:string[]=['./index.html'];let historyIndex=0;
 const restoreHistory=()=>{location.search=new URL(urls[historyIndex],'https://test.invalid/dev/').search;windowTarget.dispatchEvent(new Event('popstate'));};
 const history={pushState:(_a:unknown,_b:string,url:string)=>{urls.splice(historyIndex+1);urls.push(url);historyIndex++;location.search=new URL(url,'https://test.invalid/dev/').search;},replaceState:(_a:unknown,_b:string,url:string)=>{urls[historyIndex]=url;location.search=new URL(url,'https://test.invalid/dev/').search;},back:()=>{if(historyIndex>0){historyIndex--;restoreHistory();}},forward:()=>{if(historyIndex<urls.length-1){historyIndex++;restoreHistory();}}};
 g.document=Object.assign(new EventTarget(),{body:new Element(),createElement:(tag:string)=>new Element(tag.toUpperCase()),title:'',activeElement:null,querySelector:(selector:string)=>selector==='.garage-header-link'?headerGarage:selector==='.wordmark'?wordmark:null,getElementById:(id:string)=>id==='menu-ui'?shell:id==='menu'?root:elements.find(e=>e.attrs.id===id)});

let timerId=0;const timers=new Map<number,()=>void>();
const bootIds=['menu-boot','menu-boot-status','menu-boot-progress','menu-boot-detail','menu-boot-retry','menu-boot-continue'];
const bootNodes=new Map(bootIds.map(id=>[id,new Element()]));
const lookup=g.document.getElementById;g.document.getElementById=(id:string)=>bootNodes.get(id)??lookup(id);
g.window=Object.assign(windowTarget,{location,history,innerWidth:1440,innerHeight:900,scrollTo:()=>{},setTimeout:(fn:()=>void)=>{timers.set(++timerId,fn);return timerId;},clearTimeout:(id:number)=>timers.delete(id)});
g.window.parent=g.window;g.document.defaultView=g.window;g.location=location;g.history=history;
g.cancelAnimationFrame=()=>{};
const $=(s:string)=>{const el=root.querySelector(s);assert.ok(el,s);return el;};
let introReady=0;
g.window.__timewishIntro={isPending:()=>false,finish:()=>{},ready:()=>{
 assert.equal($('.title-actions').hidden,false);assert.equal($('.title-actions').inert,false);
 assert.ok(root.querySelectorAll('.title-action').every(button=>!button.disabled),'readiness follows enabled controls');
 assert.equal(bootNodes.get('menu-boot')!.hidden,true);introReady++;
}};
const music=getDocumentMusic(g.document)!;
let controller:ReturnType<typeof mountMenu>|undefined,next:ReturnType<typeof mountMenu>|undefined;
try{
assert.equal(music.getState().phase,'silent');
controller=mountMenu();assert.equal(root.className,'screen-main');assert.equal(music.getState().phase,'silent','first home boot is gated');
assert.equal($('#story-button').disabled,true);assert.equal(introReady,0,'failed backdrop does not report readiness');bootNodes.get('menu-boot-continue')!.click();assert.equal(music.getState().phase,'menu');assert.equal(introReady,1,'explicit usable static fallback reports readiness');
$('[data-screen="maps"]').click();assert.equal(root.className,'screen-maps');
const preview=$('#title-backdrop');preview.dispatchEvent(new Event('webglcontextlost'));assert.equal(preview.dataset.previewFallback,'true');preview.dispatchEvent(new Event('webglcontextrestored'));assert.equal(preview.dataset.previewFallback,undefined);
const staleMap=$('[data-map="mountain"]');const staleConfirm=$('#confirm-map');const html=root.innerHTML;const savedUrl=location.search;
controller.dispose();controller.dispose();assert.equal(music,getDocumentMusic(g.document),'menu disposal preserves document music');
preview.dispatchEvent(new Event('webglcontextlost'));assert.equal(preview.dataset.previewFallback,undefined,'preview context handlers are disposed');
staleMap.click();staleConfirm.click();windowTarget.dispatchEvent(new Event('popstate'));windowTarget.dispatchEvent(Object.assign(new Event('keydown'),{key:'Escape'}));
assert.equal(root.innerHTML,html);assert.equal(location.search,savedUrl);assert.equal(timers.size,0);assert.equal(introReady,1,'disposed handlers cannot report stale readiness');
location.search='';controller=mountMenu();assert.equal(root.className,'screen-main');assert.equal(music.getState().phase,'menu','returning menu preserves theme while its new backdrop prepares');
bootNodes.get('menu-boot-continue')!.click();const replacedButton=$('[data-screen="maps"]');
next=mountMenu();const before=location.search;replacedButton.click();assert.equal(location.search,before,'remount also disposes the old menu controller');
bootNodes.get('menu-boot-continue')!.click();$('[data-screen="maps"]').click();assert.equal(root.className,'screen-maps');
location.pathname='/dev/coast.html';const screen=root.className;windowTarget.dispatchEvent(new Event('popstate'));assert.equal(root.className,screen,'race popstate ignored by menu listener');
next.dispose();music.dispose();assert.equal(timers.size,0);
}finally{
 next?.dispose();controller?.dispose();music.dispose();setMaxListeners(maxListeners);
 for(const[name,descriptor]of saved){if(descriptor)Object.defineProperty(g,name,descriptor);else delete g[name];}
}
});
