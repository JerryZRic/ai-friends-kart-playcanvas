import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SETTINGS_KEY} from '../src/game-settings';
/** DOM event contract tests, intentionally no GPU / visual-rendering claim. */
test('menu repeated select/back/settings/exit, history and blocked storage work without WebGL',async()=>{
 const g=globalThis as any,names=['document','window','location','history','localStorage'];
 const saved=new Map(names.map(n=>[n,Object.getOwnPropertyDescriptor(g,n)]));
 const storage=new Map<string,string>(),elements:Element[]=[];
 let deny=false;
 class Element extends EventTarget{
  hidden=false;inert=false;attrs:Record<string,string>={};dataset:Record<string,string>={};disabled=false;checked=false;value='';textContent='';className='';html='';id='';owned:Element[]=[];
  constructor(readonly tagName='DIV'){super();}
  set innerHTML(html:string){this.html=html;if(this===root)elements.length=0;this.owned=[];for(const m of html.matchAll(/<([a-z]+)\b([^>]*)>/g)){const el=new Element(m[1].toUpperCase());for(const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g)){el.attrs[a[1]]=a[2];if(a[1].startsWith('data-'))el.dataset[a[1].slice(5)]=a[2];}el.disabled=/\bdisabled\b/.test(m[2]);el.checked=/\bchecked\b/.test(m[2]);el.value=el.attrs.value??'';elements.push(el);this.owned.push(el);}}
  get innerHTML(){return this.html;}
  querySelectorAll(selector:string){return elements.filter(el=>{if(selector.startsWith('#'))return (el.attrs.id||el.id)===selector.slice(1);if(selector.startsWith('.'))return (el.attrs.class||el.className).split(' ').includes(selector.slice(1));const m=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return m&&m[1] in el.attrs&&(m[2]===undefined||el.attrs[m[1]]===m[2]);});}
  querySelector(selector:string){return this.querySelectorAll(selector)[0]??null;}
  setAttribute(name:string,value:string){this.attrs[name]=value;}
  appendChild(el:Element){elements.push(el);return el;}
  remove(){for(const el of [this,...this.owned]){const i=elements.indexOf(el);if(i>=0)elements.splice(i,1);}}
  focus(){g.document.activeElement=this;}
  click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
 }
 const root=new Element(),windowTarget=new EventTarget(),location={search:''};const urls:string[]=[];
 const history={pushState:(_a:unknown,_b:string,url:string)=>{urls.push(url);location.search=new URL(url,'https://test.invalid/dev/').search;},replaceState:(_a:unknown,_b:string,url:string)=>{urls[urls.length-1]=url;location.search=new URL(url,'https://test.invalid/dev/').search;}};
 g.document={body:{dataset:{}},createElement:(tag:string)=>new Element(tag.toUpperCase()),title:'',activeElement:null,getElementById:(id:string)=>id==='menu'?root:elements.find(e=>e.attrs.id===id)};
 let fallback:(()=>void)|undefined,firstBoot=true,failures=0;
 g.window=Object.assign(windowTarget,{scrollTo:()=>{},__menuBoot:{begin:(next:()=>void)=>{fallback=next;},stage:()=>{},ready:()=>true,dismiss:()=>{},fail:()=>{failures++;if(!firstBoot)fallback?.();}}});g.location=location;g.history=history;
 Object.defineProperty(g,'localStorage',{configurable:true,value:{getItem:(k:string)=>{if(deny)throw Error();return storage.get(k)??null;},setItem:(k:string,v:string)=>{if(deny)throw Error();storage.set(k,v);}}});
 const $=(s:string)=>{const el=root.querySelector(s);assert.ok(el,s);return el;};
 const key=(key:string,target:EventTarget=windowTarget)=>{const event=new Event('keydown',{cancelable:true});Object.assign(event,{key});target.dispatchEvent(event);return event;};
 try{
  await import('../src/menu');
  assert.equal(root.className,'screen-main');assert.equal(g.document.body.dataset.screen,'main');
  assert.equal(elements.filter(e=>e.disabled).length,4,'all home buttons disabled until readiness or explicit fallback');assert.match(root.innerHTML,/aria-hidden="true" hidden inert/);
  $('[data-screen="maps"]').dispatchEvent(new Event('click'));$('#story-button').dispatchEvent(new Event('click'));assert.equal(root.className,'screen-main');assert.equal(root.querySelector('#story-dialog'),null,'synthetic early activation is also gated');
  assert.equal(failures,1);firstBoot=false;fallback?.();assert.equal($('.title-actions').hidden,false);assert.equal($('.title-actions').inert,false);assert.equal($('.title-actions').attrs['aria-hidden'],'false');assert.equal($('#title-backdrop').hidden,true);
  assert.equal(elements.filter(e=>e.tagName==='BUTTON').length,4);assert.equal(elements.filter(e=>e.disabled).length,0);assert.equal(root.innerHTML.replace(/<[^>]*>/g,''),'大肥鱼卡丁车故事模式自由模式设置退出');
  $('#story-button').click();assert.ok($('#story-dialog'));key('Escape');assert.equal(root.querySelector('#story-dialog'),null);assert.equal(g.document.activeElement.attrs.id,'story-button');
  $('#story-button').click();$('#close-story').click();assert.equal(root.querySelector('#story-dialog'),null);
  for(let n=0;n<2;n++){
   $('[data-screen="maps"]').click();assert.equal(root.className,'screen-maps');
   const ids=elements.map(e=>e.attrs.id).filter(Boolean);assert.equal(new Set(ids).size,ids.length,'map controls and preview IDs must be unique');
   assert.equal(elements.filter(e=>e.tagName==='CANVAS').length,1,'only the selected map creates a live preview');
   const preview=$('#title-backdrop');assert.equal(preview.dataset.backdropState,'unavailable','missing WebGL retains the static route poster');preview.dispatchEvent(new Event('webglcontextlost'));assert.equal(preview.dataset.previewFallback,'true');preview.dispatchEvent(new Event('webglcontextrestored'));assert.equal(preview.dataset.previewFallback,undefined);
   const overviewImages=root.querySelectorAll('.map-overview');assert.equal(overviewImages.length,2);assert.deepEqual(overviewImages.map(e=>e.attrs.src),['./map-previews/coast-overview.webp','./map-previews/waterpark-overview.webp']);assert.ok(overviewImages.every(e=>e.attrs.alt.includes('3D 俯视全景')));
   assert.ok(root.innerHTML.indexOf('class="map-library"')<root.innerHTML.indexOf('class="map-detail-panel"'),'route cards precede the scenic preview in reading order');
   assert.equal($('[data-map="coast"]').attrs.tabindex,'0');assert.equal($('[data-map="waterpark"]').attrs.tabindex,'-1');
   const historyLength=urls.length;assert.equal(key('ArrowDown',$('[data-map="coast"]')).defaultPrevented,true);assert.equal(g.document.activeElement.dataset.map,'waterpark');assert.equal(urls.length,historyLength,'selection updates the existing history entry');
   assert.equal($('[data-map="waterpark"]').attrs['aria-pressed'],'true');assert.equal($('[data-map="waterpark"]').attrs.tabindex,'0');assert.equal($('[data-map="coast"]').attrs.tabindex,'-1');assert.equal($('.map-detail-panel').dataset['preview-map'],'waterpark');assert.equal($('.map-stage-fallback').attrs.src,'./map-previews/waterpark-overview.webp');
   key('ArrowDown',$('[data-map="waterpark"]'));assert.equal(g.document.activeElement.dataset.map,'coast','arrow navigation wraps');
   key('End',$('[data-map="coast"]'));assert.equal(g.document.activeElement.dataset.map,'waterpark');key('Home',$('[data-map="waterpark"]'));assert.equal(g.document.activeElement.dataset.map,'coast');
   key('ArrowLeft',$('[data-map="coast"]'));assert.equal(g.document.activeElement.dataset.map,'waterpark');key('ArrowRight',$('[data-map="waterpark"]'));assert.equal(g.document.activeElement.dataset.map,'coast');key('ArrowUp',$('[data-map="coast"]'));assert.equal(g.document.activeElement.dataset.map,'waterpark');
   assert.equal(key('Tab',$('[data-map="waterpark"]')).defaultPrevented,false,'native Tab and button activation remain available');
   $('[data-screen="settings"]').click();key('Escape');assert.equal(root.className,'screen-maps');assert.equal($('[data-map="waterpark"]').attrs['aria-pressed'],'true','settings return retains the selected course');
   $('[data-map="waterpark"]').click();assert.equal(root.className,'screen-maps');assert.equal($('[data-map="waterpark"]').attrs['aria-pressed'],'true');$('#confirm-map').click();$('[data-driver="grok"]').click();assert.match($('#start-race').attrs.href,/waterpark.html\?driver=grok/);
   assert.equal(g.document.activeElement.dataset.driver,'grok');
   $('[data-screen="settings"]').click();const low=$('[value="low"]');low.dispatchEvent(new Event('change'));assert.equal(JSON.parse(storage.get(SETTINGS_KEY)!).quality,'low');
   const refraction=$('#refraction');refraction.checked=false;refraction.dispatchEvent(new Event('change'));assert.equal(JSON.parse(storage.get(SETTINGS_KEY)!).refraction,false);
   key('Escape');assert.equal(root.className,'screen-characters');assert.match($('#start-race').attrs.href,/driver=grok/);
   key('Escape');assert.equal(root.className,'screen-maps');$('[data-map="coast"]').click();$('#confirm-map').click();assert.match($('#start-race').attrs.href,/coast.html\?driver=whale/,'new map has no stale driver');
   key('Escape');key('Escape');$('[data-screen="exit"]').click();assert.equal(root.className,'screen-exit');assert.match(root.innerHTML,/关闭此标签页/);$('[data-screen="main"]').click();
  }
  location.search='?screen=maps&map=waterpark';windowTarget.dispatchEvent(new Event('popstate'));assert.equal($('.map-detail-panel').dataset['preview-map'],'waterpark');assert.equal($('[data-map="waterpark"]').attrs.tabindex,'0');assert.equal(g.document.activeElement,root,'history restores screen focus');
  location.search='?screen=characters&map=coast&driver=glm';windowTarget.dispatchEvent(new Event('popstate'));assert.match($('#start-race').attrs.href,/driver=glm/);
  $('[data-screen="settings"]').click();deny=true;$('[value="high"]').dispatchEvent(new Event('change'));assert.match($('#settings-status').textContent,/无法保存/);
  $('#reset-settings').click();assert.equal(g.document.activeElement.attrs.id,'reset-settings');assert.match($('#settings-status').textContent,/无法保存/);
  key('Escape');assert.match($('#start-race').attrs.href,/driver=glm/);
 }finally{for(const[n,d]of saved){if(d)Object.defineProperty(g,n,d);else delete g[n];}}
});

test('desktop course library uses side-by-side uncropped overview cards alongside the scenic panel',async()=>{
 const css=await readFile('src/menu.css','utf8');
 assert.match(css,/\.map-preview-layout\{[^}]*grid-template-columns:minmax\(350px,1fr\) minmax\(0,1\.25fr\)/);
 assert.match(css,/\.map-choices\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.map-choice-visual\{[^}]*aspect-ratio:16\/9/);
 assert.match(css,/\.map-overview\{[^}]*object-fit:contain/);
 assert.match(css,/@media\(max-width:900px\)\{\.map-preview-layout\{grid-template-columns:1fr/);
});
