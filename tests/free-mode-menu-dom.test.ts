import test from 'node:test';
import assert from 'node:assert/strict';
import {SETTINGS_KEY} from '../src/game-settings';
/** DOM event contract tests, intentionally no GPU / visual-rendering claim. */
test('menu repeated select/back/settings/exit, history and blocked storage work without WebGL',async()=>{
 const g=globalThis as any,names=['document','window','location','history','localStorage'];
 const saved=new Map(names.map(n=>[n,Object.getOwnPropertyDescriptor(g,n)]));
 const storage=new Map<string,string>(),elements:Element[]=[];
 let deny=false;
 class Element extends EventTarget{
  attrs:Record<string,string>={};dataset:Record<string,string>={};disabled=false;checked=false;value='';textContent='';className='';html='';
  constructor(readonly tagName='DIV'){super();}
  set innerHTML(html:string){this.html=html;elements.length=0;for(const m of html.matchAll(/<([a-z]+)\b([^>]*)>/g)){const el=new Element(m[1].toUpperCase());for(const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g)){el.attrs[a[1]]=a[2];if(a[1].startsWith('data-'))el.dataset[a[1].slice(5)]=a[2];}el.disabled=/\bdisabled\b/.test(m[2]);el.checked=/\bchecked\b/.test(m[2]);el.value=el.attrs.value??'';elements.push(el);}}
  get innerHTML(){return this.html;}
  querySelectorAll(selector:string){return elements.filter(el=>{if(selector.startsWith('#'))return el.attrs.id===selector.slice(1);const m=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return m&&m[1] in el.attrs&&(m[2]===undefined||el.attrs[m[1]]===m[2]);});}
  querySelector(selector:string){return this.querySelectorAll(selector)[0]??null;}
  focus(){g.document.activeElement=this;}
  click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
 }
 const root=new Element(),windowTarget=new EventTarget(),location={search:''};const urls:string[]=[];
 const history={pushState:(_a:unknown,_b:string,url:string)=>{urls.push(url);location.search=new URL(url,'https://test.invalid/dev/').search;},replaceState:(_a:unknown,_b:string,url:string)=>{urls[urls.length-1]=url;location.search=new URL(url,'https://test.invalid/dev/').search;}};
 g.document={title:'',activeElement:null,getElementById:(id:string)=>id==='menu'?root:elements.find(e=>e.attrs.id===id)};
 g.window=Object.assign(windowTarget,{scrollTo:()=>{}});g.location=location;g.history=history;
 Object.defineProperty(g,'localStorage',{configurable:true,value:{getItem:(k:string)=>{if(deny)throw Error();return storage.get(k)??null;},setItem:(k:string,v:string)=>{if(deny)throw Error();storage.set(k,v);}}});
 const $=(s:string)=>{const el=root.querySelector(s);assert.ok(el,s);return el;};
 const key=(key:string)=>{const event=new Event('keydown');Object.assign(event,{key});windowTarget.dispatchEvent(event);};
 try{
  await import('../src/menu');
  assert.equal(root.className,'screen-main');assert.ok(elements.some(e=>e.tagName==='BUTTON'&&e.disabled));
  for(let n=0;n<2;n++){
   $('[data-screen="maps"]').click();assert.equal(root.className,'screen-maps');
   const ids=elements.map(e=>e.attrs.id).filter(Boolean);assert.equal(new Set(ids).size,ids.length,'map SVG definitions must be unique');
   $('[data-map="waterpark"]').click();$('[data-driver="grok"]').click();assert.match($('#start-race').attrs.href,/waterpark.html\?driver=grok/);
   assert.equal(g.document.activeElement.dataset.driver,'grok');
   $('[data-screen="settings"]').click();const low=$('[value="low"]');low.dispatchEvent(new Event('change'));assert.equal(JSON.parse(storage.get(SETTINGS_KEY)!).quality,'low');
   const refraction=$('#refraction');refraction.checked=false;refraction.dispatchEvent(new Event('change'));assert.equal(JSON.parse(storage.get(SETTINGS_KEY)!).refraction,false);
   key('Escape');assert.equal(root.className,'screen-characters');assert.match($('#start-race').attrs.href,/driver=grok/);
   key('Escape');assert.equal(root.className,'screen-maps');$('[data-map="coast"]').click();assert.match($('#start-race').attrs.href,/coast.html\?driver=whale/,'new map has no stale driver');
   key('Escape');key('Escape');$('[data-screen="exit"]').click();assert.equal(root.className,'screen-exit');assert.match(root.innerHTML,/关闭此标签页/);$('[data-screen="main"]').click();
  }
  location.search='?screen=characters&map=coast&driver=glm';windowTarget.dispatchEvent(new Event('popstate'));assert.match($('#start-race').attrs.href,/driver=glm/);
  $('[data-screen="settings"]').click();deny=true;$('[value="high"]').dispatchEvent(new Event('change'));assert.match($('#settings-status').textContent,/无法保存/);
  $('#reset-settings').click();assert.equal(g.document.activeElement.attrs.id,'reset-settings');assert.match($('#settings-status').textContent,/无法保存/);
  key('Escape');assert.match($('#start-race').attrs.href,/driver=glm/);
 }finally{for(const[n,d]of saved){if(d)Object.defineProperty(g,n,d);else delete g[n];}}
});
