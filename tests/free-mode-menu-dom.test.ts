import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SETTINGS_KEY} from '../src/game-settings';
import {garageRaceEntry} from '../src/kart-garage';
/** DOM event contract tests, intentionally no GPU / visual-rendering claim. */
test('menu repeated select/back/settings/exit, history and blocked storage work without WebGL',async()=>{
 const g=globalThis as any,names=['document','window','location','history','localStorage'];
 const saved=new Map(names.map(n=>[n,Object.getOwnPropertyDescriptor(g,n)]));
 const storage=new Map<string,string>(),elements:Element[]=[];
 let deny=false;
 class Element extends EventTarget{
  href='';hidden=false;inert=false;attrs:Record<string,string>={};dataset:Record<string,string>={};disabled=false;checked=false;value='';textContent='';className='';html='';id='';owned:Element[]=[];
  style={getPropertyValue:(_name:string)=>'',getPropertyPriority:(_name:string)=>'',setProperty:(_name:string,_value:string)=>{},removeProperty:(_name:string)=>{}};
  constructor(readonly tagName='DIV'){super();}
  getAttribute(name:string){return this.attrs[name]??null;}
  removeAttribute(name:string){delete this.attrs[name];}
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
 const headerGarage=new Element('A'),wordmark=new Element('A');
 const shell=new Element(),root=new Element(),windowTarget=new EventTarget(),location={search:''};const urls:string[]=[];
 const history={pushState:(_a:unknown,_b:string,url:string)=>{urls.push(url);location.search=new URL(url,'https://test.invalid/dev/').search;},replaceState:(_a:unknown,_b:string,url:string)=>{urls[urls.length-1]=url;location.search=new URL(url,'https://test.invalid/dev/').search;}};
 g.document={body:{dataset:{}},createElement:(tag:string)=>new Element(tag.toUpperCase()),title:'',activeElement:null,querySelector:(selector:string)=>selector==='.garage-header-link'?headerGarage:selector==='.wordmark'?wordmark:null,getElementById:(id:string)=>id==='menu-ui'?shell:id==='menu'?root:elements.find(e=>e.attrs.id===id)};
 let fallback:(()=>void)|undefined,firstBoot=true,failures=0;
 g.window=Object.assign(windowTarget,{scrollTo:()=>{},__menuBoot:{begin:(next:()=>void)=>{fallback=next;},stage:()=>{},ready:()=>true,dismiss:()=>{},fail:()=>{failures++;if(!firstBoot)fallback?.();}}});g.location=location;g.history=history;
 Object.defineProperty(g,'localStorage',{configurable:true,value:{getItem:(k:string)=>{if(deny)throw Error();return storage.get(k)??null;},setItem:(k:string,v:string)=>{if(deny)throw Error();storage.set(k,v);}}});
 const $=(s:string)=>{const el=root.querySelector(s);assert.ok(el,s);return el;};
 const key=(key:string,target:EventTarget=windowTarget)=>{const event=new Event('keydown',{cancelable:true});Object.assign(event,{key});target.dispatchEvent(event);return event;};
 try{
  await import('../src/menu');
  assert.equal(root.className,'screen-main');assert.equal(g.document.body.dataset.screen,'main');assert.equal(shell.attrs['data-fixed-layout'],'1440x900');
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
   const overviewImages=root.querySelectorAll('.map-overview');assert.equal(overviewImages.length,4);assert.deepEqual(overviewImages.map(e=>e.attrs.src),['./map-previews/coast-overview.webp','./map-previews/waterpark-overview.webp','./map-previews/mountain-overview.webp','./map-previews/town-overview.webp']);assert.ok(overviewImages.every(e=>e.attrs.alt.includes('3D 俯视全景')));
   assert.ok(root.innerHTML.indexOf('class="map-library"')<root.innerHTML.indexOf('class="map-detail-panel"'),'route cards precede the scenic preview in reading order');
   assert.equal($('[data-map="coast"]').attrs.tabindex,'0');assert.equal($('[data-map="waterpark"]').attrs.tabindex,'-1');
   const historyLength=urls.length;assert.equal(key('ArrowDown',$('[data-map="coast"]')).defaultPrevented,true);assert.equal(g.document.activeElement.dataset.map,'waterpark');assert.equal(urls.length,historyLength,'selection updates the existing history entry');
   assert.equal($('[data-map="waterpark"]').attrs['aria-pressed'],'true');assert.equal($('[data-map="waterpark"]').attrs.tabindex,'0');assert.equal($('[data-map="coast"]').attrs.tabindex,'-1');assert.equal($('.map-detail-panel').dataset['preview-map'],'waterpark');assert.equal($('.map-stage-fallback').attrs.src,'./map-previews/waterpark-overview.webp');
   key('ArrowDown',$('[data-map="waterpark"]'));assert.equal(g.document.activeElement.dataset.map,'mountain');assert.match(root.innerHTML,/04 COURSES/);assert.equal($('.map-stage-fallback').attrs.src,'./map-previews/mountain-overview.webp');key('ArrowDown',$('[data-map="mountain"]'));assert.equal(g.document.activeElement.dataset.map,'town');assert.equal($('.map-stage-fallback').attrs.src,'./map-previews/town-overview.webp');key('ArrowDown',$('[data-map="town"]'));assert.equal(g.document.activeElement.dataset.map,'coast','arrow navigation wraps');
   key('End',$('[data-map="coast"]'));assert.equal(g.document.activeElement.dataset.map,'town');key('Home',$('[data-map="town"]'));assert.equal(g.document.activeElement.dataset.map,'coast');
   key('ArrowLeft',$('[data-map="coast"]'));assert.equal(g.document.activeElement.dataset.map,'town');key('ArrowRight',$('[data-map="town"]'));assert.equal(g.document.activeElement.dataset.map,'coast');key('ArrowUp',$('[data-map="coast"]'));assert.equal(g.document.activeElement.dataset.map,'town');$('[data-map="waterpark"]').click();
   assert.equal(key('Tab',$('[data-map="waterpark"]')).defaultPrevented,false,'native Tab and button activation remain available');
   $('[data-screen="settings"]').click();key('Escape');assert.equal(root.className,'screen-maps');assert.equal($('[data-map="waterpark"]').attrs['aria-pressed'],'true','settings return retains the selected course');
   $('[data-map="waterpark"]').click();assert.equal(root.className,'screen-maps');assert.equal($('[data-map="waterpark"]').attrs['aria-pressed'],'true');$('#confirm-map').click();$('[data-driver="grok"]').click();assert.equal($('#choose-vehicle').attrs['data-screen'],'vehicles');
   assert.equal($('[data-driver="grok"]').attrs['aria-pressed'],'true');
   $('[data-screen="settings"]').click();const low=$('[value="low"]');low.dispatchEvent(new Event('change'));assert.equal(JSON.parse(storage.get(SETTINGS_KEY)!).quality,'low');
   const refraction=$('#refraction');refraction.checked=false;refraction.dispatchEvent(new Event('change'));assert.equal(JSON.parse(storage.get(SETTINGS_KEY)!).refraction,false);
   key('Escape');assert.equal(root.className,'screen-characters');assert.equal($('#choose-vehicle').attrs['data-screen'],'vehicles');
   $('#choose-vehicle').click();assert.equal(root.className,'screen-vehicles');$('[data-screen="race-settings"]').click();assert.equal(root.className,'screen-race-settings');assert.match($('#start-race').attrs.href,/waterpark.html\?driver=grok/);
   $('[value="hard"]').dispatchEvent(new Event('change'));assert.match($('#start-race').attrs.href,/difficulty=hard/);const seed=$('#race-seed');seed.value='77';seed.dispatchEvent(new Event('change'));assert.match($('#start-race').attrs.href,/seed=77/);
   $('[data-screen="settings"]').click();key('Escape');assert.equal(root.className,'screen-race-settings');assert.match($('#start-race').attrs.href,/difficulty=hard.*seed=77/);key('Escape');assert.equal(root.className,'screen-vehicles');key('Escape');assert.equal(root.className,'screen-characters');
   key('Escape');assert.equal(root.className,'screen-maps');$('[data-map="coast"]').click();$('#confirm-map').click();assert.match($('#choose-vehicle').attrs.href,/garage.html\?driver=grok/,'map changes preserve independent driver selection');
   key('Escape');key('Escape');$('[data-screen="exit"]').click();assert.equal(root.className,'screen-exit');assert.match(root.innerHTML,/关闭此标签页/);$('[data-screen="main"]').click();
  }
  location.search='?screen=maps&map=waterpark';windowTarget.dispatchEvent(new Event('popstate'));assert.equal($('.map-detail-panel').dataset['preview-map'],'waterpark');assert.equal($('[data-map="waterpark"]').attrs.tabindex,'0');assert.equal(g.document.activeElement,root,'history restores screen focus');
  location.search='?screen=characters&map=coast&driver=glm';windowTarget.dispatchEvent(new Event('popstate'));assert.match($('#choose-vehicle').attrs.href,/driver=glm/);
  $('[data-screen="settings"]').click();deny=true;$('[value="high"]').dispatchEvent(new Event('change'));assert.match($('#settings-status').textContent,/无法保存/);
  $('#reset-settings').click();assert.equal(g.document.activeElement.attrs.id,'reset-settings');assert.match($('#settings-status').textContent,/无法保存/);
  key('Escape');assert.match($('#choose-vehicle').attrs.href,/driver=glm/);
  location.search='?screen=race-settings&map=coast&driver=glm&difficulty=hard&seed=12&kart=broken';windowTarget.dispatchEvent(new Event('popstate'));
  assert.equal(root.className,'screen-race-settings');assert.match(root.innerHTML,/已选卡丁车/);assert.equal(root.querySelectorAll('.race-build-summary').length,1);
  const snapshot=new URLSearchParams(location.search).get('kart');assert.ok(snapshot,'direct setup snapshots default car even when storage is denied');
  assert.equal(new URL($('#start-race').attrs.href,'https://test.invalid').searchParams.get('kart'),snapshot);
  $('[data-screen="settings"]').click();key('Escape');assert.equal(root.className,'screen-race-settings');assert.equal(new URLSearchParams(location.search).get('kart'),snapshot);
  $('#back-vehicle').click();assert.match((location as any).href,/garage.html\?driver=glm.*difficulty=hard.*seed=12/);
  $('[value="easy"]').dispatchEvent(new Event('change'));$('[value="hard"]').dispatchEvent(new Event('change'));const newSeed=$('#race-seed');newSeed.value='77';newSeed.dispatchEvent(new Event('change'));
  const headerTarget=new URL(headerGarage.href,'https://test.invalid'),homeTarget=new URL(wordmark.href,'https://test.invalid');
  for(const target of [headerTarget,homeTarget]){assert.equal(target.searchParams.get('difficulty'),'hard');assert.equal(target.searchParams.get('seed'),'77');assert.equal(target.searchParams.get('driver'),'glm');assert.equal(target.searchParams.get('kart'),snapshot);}
  const completed=new URL(garageRaceEntry('glm',JSON.parse(snapshot),headerTarget.search),'https://test.invalid');
  location.search=completed.search;windowTarget.dispatchEvent(new Event('popstate'));assert.equal(root.className,'screen-race-settings');assert.match($('#start-race').attrs.href,/difficulty=hard.*seed=77/);
  location.search=homeTarget.search;windowTarget.dispatchEvent(new Event('popstate'));assert.equal(root.className,'screen-main');$('[data-screen="maps"]').click();assert.equal(new URLSearchParams(location.search).get('seed'),'77');assert.equal(new URLSearchParams(location.search).get('kart'),snapshot);

  location.search='?screen=maps&map=mountain&driver=claude&difficulty=hard&seed=89';windowTarget.dispatchEvent(new Event('popstate'));
  assert.equal($('.map-detail-panel').dataset['preview-map'],'mountain');$('#confirm-map').click();
  const mountainGarage=new URL($('#choose-vehicle').attrs.href,'https://test.invalid');assert.equal(mountainGarage.searchParams.get('map'),'mountain');
  const mountainSetup=new URL(garageRaceEntry('claude',JSON.parse(snapshot),mountainGarage.search),'https://test.invalid');
  location.search=mountainSetup.search;windowTarget.dispatchEvent(new Event('popstate'));assert.equal(root.className,'screen-race-settings');assert.match(root.innerHTML,/云岭盘山道/);
  const mountainRace=new URL($('#start-race').attrs.href,'https://test.invalid');assert.equal(mountainRace.pathname,'/coast.html');assert.equal(mountainRace.searchParams.get('map'),'mountain');assert.equal(mountainRace.searchParams.get('kart'),snapshot);
  $('[data-screen="settings"]').click();key('Escape');assert.equal(new URLSearchParams(location.search).get('map'),'mountain');$('#back-vehicle').click();assert.equal(new URL((location as any).href,'https://test.invalid').searchParams.get('map'),'mountain');

  windowTarget.dispatchEvent(Object.assign(new Event('pagehide'),{persisted:true}));assert.equal(shell.attrs['data-fixed-layout'],'1440x900','BFCache keeps layout mounted');
  windowTarget.dispatchEvent(new Event('pageshow'));assert.equal(shell.attrs['data-fixed-layout'],'1440x900');
  windowTarget.dispatchEvent(Object.assign(new Event('pagehide'),{persisted:false}));assert.equal(shell.attrs['data-fixed-layout'],undefined,'real navigation disposes the layout');
 }finally{for(const[n,d]of saved){if(d)Object.defineProperty(g,n,d);else delete g[n];}}
});

test('desktop course library uses side-by-side uncropped overview cards alongside the scenic panel',async()=>{
 const css=await readFile('src/menu.css','utf8');
 assert.match(css,/\.map-preview-layout\{[^}]*grid-template-columns:minmax\(350px,1fr\) minmax\(0,1\.25fr\)/);
 assert.match(css,/\.map-choices\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.map-choice-visual\{[^}]*aspect-ratio:16\/9/);
 assert.match(css,/\.map-overview\{[^}]*object-fit:contain/);
 assert.doesNotMatch(css,/@media\s*\([^)]*(?:min|max)-(?:width|height)/,'physical viewport breakpoints must not rearrange the fixed composition');
});
