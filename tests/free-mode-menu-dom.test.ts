import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SETTINGS_KEY} from '../src/game-settings';
import {garageRaceEntry} from '../src/kart-garage';
import {registerSceneNavigator} from '../src/music-ui';
const mapIds=['coast','mountain','town','quarry','forest','workshop','harvest','desert','snow','caldera','garden','airfield','waterpark'],lastMap='waterpark';
const mapCodes=['01','02','03','04','05','06','07','08','09','10','11','12','A01'];
/** DOM event contract tests, intentionally no GPU / visual-rendering claim. */
test('menu repeated select/back/settings/exit, history and blocked storage work without WebGL',async()=>{
 const g=globalThis as any,names=['document','window','location','history','localStorage'];
 const saved=new Map(names.map(n=>[n,Object.getOwnPropertyDescriptor(g,n)]));
 const storage=new Map<string,string>(),elements:Element[]=[];
 let deny=false;
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
 const shell=new Element(),root=new Element(),windowTarget=new EventTarget(),location={pathname:'/dev/index.html',search:'',origin:'https://test.invalid',get href(){return 'https://test.invalid/dev/index.html'+this.search;}};const urls:string[]=['./index.html'];let historyIndex=0;
 const restoreHistory=()=>{location.search=new URL(urls[historyIndex],'https://test.invalid/dev/').search;windowTarget.dispatchEvent(new Event('popstate'));};
 const history={pushState:(_a:unknown,_b:string,url:string)=>{urls.splice(historyIndex+1);urls.push(url);historyIndex++;location.search=new URL(url,'https://test.invalid/dev/').search;},replaceState:(_a:unknown,_b:string,url:string)=>{urls[historyIndex]=url;location.search=new URL(url,'https://test.invalid/dev/').search;},back:()=>{if(historyIndex>0){historyIndex--;restoreHistory();}},forward:()=>{if(historyIndex<urls.length-1){historyIndex++;restoreHistory();}}};
 g.document=Object.assign(new EventTarget(),{body:new Element(),createElement:(tag:string)=>new Element(tag.toUpperCase()),title:'',activeElement:null,querySelector:(selector:string)=>selector==='.garage-header-link'?headerGarage:selector==='.wordmark'?wordmark:null,getElementById:(id:string)=>id==='menu-ui'?shell:id==='menu'?root:elements.find(e=>e.attrs.id===id)});
 const bootNodes=new Map(['menu-boot','menu-boot-status','menu-boot-progress','menu-boot-detail','menu-boot-retry','menu-boot-continue'].map(id=>[id,new Element()]));
 const lookup=g.document.getElementById;g.document.getElementById=(id:string)=>bootNodes.get(id)??lookup(id);
 const fallback=()=>bootNodes.get('menu-boot-continue')!.click();
 g.window=Object.assign(windowTarget,{location,history,scrollTo:()=>{},setTimeout:()=>1,clearTimeout:()=>{}});g.document.defaultView=g.window;g.location=location;g.history=history;
 Object.defineProperty(g,'localStorage',{configurable:true,value:{getItem:(k:string)=>{if(deny)throw Error();return storage.get(k)??null;},setItem:(k:string,v:string)=>{if(deny)throw Error();storage.set(k,v);}}});
 const $=(s:string)=>{const el=root.querySelector(s);assert.ok(el,s);return el;};
 let garageDestination:URL|undefined;
 // The real SPA host owns route replacement. This menu-only fixture captures its handoff.
 const releaseNavigator=registerSceneNavigator(g.document,(href:string)=>{garageDestination=new URL(href,location.href);return true;});
 const key=(key:string,target:EventTarget=windowTarget)=>{const event=new Event('keydown',{cancelable:true});Object.assign(event,{key});target.dispatchEvent(event);return event;};
 try{
  const {mountMenu}=await import('../src/menu');mountMenu();
  assert.equal(root.className,'screen-main');assert.equal(g.document.body.dataset.screen,'main');assert.equal(shell.attrs['data-fixed-layout'],'1440x900');
  assert.equal(elements.filter(e=>e.disabled).length,4,'all home buttons disabled until readiness or explicit fallback');assert.match(root.innerHTML,/aria-hidden="true" hidden inert/);
  $('[data-screen="maps"]').dispatchEvent(new Event('click'));$('#story-button').dispatchEvent(new Event('click'));assert.equal(root.className,'screen-main');assert.equal(root.querySelector('#story-dialog'),null,'synthetic early activation is also gated');
  assert.match(bootNodes.get('menu-boot-status')!.textContent,/无法初始化 3D/);assert.equal(bootNodes.get('menu-boot-continue')!.hidden,false);
  const failedLogo=$('.title-logo'),failedCharacter=$('.title-character');
  failedLogo.dispatchEvent(new Event('error'));failedCharacter.dispatchEvent(new Event('error'));
  // A new portrait retries the approved whale once; only its failed fallback is hidden.
  if(!failedCharacter.hidden){assert.equal(failedCharacter.dataset.coverId,'deepseek');assert.equal((failedCharacter as any).src,'./menu-art/whale-maid.png');failedCharacter.dispatchEvent(new Event('error'));}
  assert.equal(failedLogo.hidden,true);assert.equal(failedCharacter.hidden,true);assert.equal($('#story-button').disabled,true,'art failure cannot bypass engine preparation');
  fallback();assert.equal($('.title-actions').hidden,false);assert.equal($('.title-actions').inert,false);assert.equal($('.title-actions').attrs['aria-hidden'],'false');assert.equal($('#title-backdrop').hidden,true);
  assert.equal(elements.filter(e=>e.tagName==='BUTTON').length,4);assert.equal(elements.filter(e=>e.disabled).length,0);assert.equal(root.innerHTML.replace(/<[^>]*>/g,''),'大肥鱼卡丁车故事模式自由模式设置退出');
  $('#story-button').click();assert.ok($('#story-dialog'));key('Escape');assert.equal(root.querySelector('#story-dialog'),null);assert.equal(g.document.activeElement.attrs.id,'story-button');
  $('#story-button').click();$('#close-story').click();assert.equal(root.querySelector('#story-dialog'),null);
  for(let n=0;n<2;n++){
   $('[data-screen="maps"]').click();assert.equal(root.className,'screen-maps');
   const ids=elements.map(e=>e.attrs.id).filter(Boolean);assert.equal(new Set(ids).size,ids.length,'map controls and preview IDs must be unique');
   assert.equal(elements.filter(e=>e.tagName==='CANVAS').length,1,'only the selected map creates a live preview');
   const preview=$('#title-backdrop');assert.equal(preview.dataset.backdropState,'unavailable','missing WebGL retains the static route poster');preview.dispatchEvent(new Event('webglcontextlost'));assert.equal(preview.dataset.previewFallback,'true');preview.dispatchEvent(new Event('webglcontextrestored'));assert.equal(preview.dataset.previewFallback,undefined);
   const overviewImages=root.querySelectorAll('.map-overview');assert.equal(overviewImages.length,mapIds.length);assert.deepEqual(overviewImages.map(e=>e.attrs.src),mapIds.map(id=>`./map-previews/${id}-overview.webp`));assert.ok(overviewImages.every(e=>e.attrs.alt.includes('3D 俯视全景')));
   assert.deepEqual(root.querySelectorAll('[data-map]').map(e=>e.dataset.map),mapIds,'visual and reading order keep water last');
   assert.deepEqual([...root.innerHTML.matchAll(/class="map-choice-number" aria-hidden="true">([^<]+)</g)].map(m=>m[1]),mapCodes);
   for(const [i,id] of mapIds.entries())assert.ok($(`[data-map="${id}"]`).attrs['aria-label'].startsWith(mapCodes[i]+' '),'accessible card identity matches its visible code');
   assert.match(root.innerHTML,/01 \/ 04/,'flow step is not a map code');
   assert.ok(root.innerHTML.indexOf('class="map-library"')<root.innerHTML.indexOf('class="map-detail-panel"'),'route cards precede the scenic preview in reading order');
   assert.equal($('[data-map="coast"]').attrs.tabindex,'0');assert.equal($('[data-map="waterpark"]').attrs.tabindex,'-1');
   const historyLength=urls.length;assert.equal(key('ArrowDown',$('[data-map="coast"]')).defaultPrevented,true);assert.equal(g.document.activeElement.dataset.map,'mountain');assert.equal(urls.length,historyLength,'selection updates the existing history entry');
   assert.equal($('[data-map="mountain"]').attrs['aria-pressed'],'true');assert.equal($('[data-map="mountain"]').attrs.tabindex,'0');assert.equal($('[data-map="coast"]').attrs.tabindex,'-1');assert.equal($('.map-detail-panel').dataset['preview-map'],'mountain');assert.equal($('.map-stage-fallback').attrs.src,'./map-previews/mountain-overview.webp');
   for(let i=2;i<mapIds.length;i++){key('ArrowDown',$(`[data-map="${mapIds[i-1]}"]`));assert.equal(g.document.activeElement.dataset.map,mapIds[i]);assert.equal($('.map-stage-fallback').attrs.src,`./map-previews/${mapIds[i]}-overview.webp`);}
   assert.ok(root.innerHTML.includes(`${String(mapIds.length).padStart(2,'0')} COURSES`));key('ArrowDown',$(`[data-map="${lastMap}"]`));assert.equal(g.document.activeElement.dataset.map,'coast','arrow navigation wraps');
   key('End',$('[data-map="coast"]'));assert.equal(g.document.activeElement.dataset.map,lastMap);key('Home',$(`[data-map="${lastMap}"]`));assert.equal(g.document.activeElement.dataset.map,'coast');
   key('ArrowLeft',$('[data-map="coast"]'));assert.equal(g.document.activeElement.dataset.map,lastMap);key('ArrowRight',$(`[data-map="${lastMap}"]`));assert.equal(g.document.activeElement.dataset.map,'coast');key('ArrowUp',$('[data-map="coast"]'));assert.equal(g.document.activeElement.dataset.map,lastMap);$('[data-map="waterpark"]').click();
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
   key('Escape');key('Escape');fallback();$('[data-screen="exit"]').click();assert.equal(root.className,'screen-exit');assert.match(root.innerHTML,/关闭此标签页/);$('[data-screen="main"]').click();fallback();
  }
  location.search='?screen=maps&map=waterpark';windowTarget.dispatchEvent(new Event('popstate'));assert.equal($('.map-detail-panel').dataset['preview-map'],'waterpark');assert.equal($('[data-map="waterpark"]').attrs.tabindex,'0');assert.equal(g.document.activeElement,root,'history restores screen focus');
  // Existing water deep links and browser history use stable IDs after presentation reorder.
  history.replaceState(null,'','./index.html?screen=maps&map=waterpark&driver=glm&difficulty=hard&seed=77');windowTarget.dispatchEvent(new Event('popstate'));
  const waterSelection=()=>{assert.equal(root.className,'screen-maps');assert.equal(root.querySelectorAll('[data-map]').at(-1)?.dataset.map,'waterpark');assert.equal($('[data-map="waterpark"]').attrs['aria-pressed'],'true');assert.equal($('[data-map="waterpark"]').attrs.tabindex,'0');assert.match($('[data-map="waterpark"]').attrs['aria-label'],/^A01 晴空水上乐园/);assert.equal($('.map-detail-panel').dataset['preview-map'],'waterpark');assert.equal($('.map-stage-fallback').attrs.src,'./map-previews/waterpark-overview.webp');};
  const waterSetup=()=>{const p=new URLSearchParams(location.search);assert.equal(p.get('map'),'waterpark');assert.equal(p.get('driver'),'glm');assert.equal(p.get('difficulty'),'hard');assert.equal(p.get('seed'),'77');};
  waterSelection();waterSetup();const waterHtml=root.innerHTML,waterHistoryLength=urls.length;
  $('[data-map="waterpark"]').click();$('[data-map="waterpark"]').click();assert.equal(root.innerHTML,waterHtml);assert.equal(urls.length,waterHistoryLength,'repeated selected-card clicks do not create history entries');
  $('[data-screen="settings"]').click();assert.equal(root.className,'screen-settings');history.back();waterSelection();waterSetup();assert.equal(g.document.activeElement,root);
  history.forward();assert.equal(root.className,'screen-settings');waterSetup();history.back();waterSelection();
  $('#confirm-map').click();assert.equal(root.className,'screen-characters');assert.match(root.innerHTML,/02 \/ 04/,'character flow numbering is unchanged');waterSetup();history.back();waterSelection();waterSetup();history.forward();assert.equal(root.className,'screen-characters');
  $('#choose-vehicle').click();$('[data-screen="race-settings"]').click();assert.equal(root.className,'screen-race-settings');
  const waterRace=new URL($('#start-race').attrs.href,'https://test.invalid/dev/');assert.equal(waterRace.pathname,'/dev/waterpark.html');assert.equal(waterRace.searchParams.get('driver'),'glm');assert.equal(waterRace.searchParams.get('difficulty'),'hard');assert.equal(waterRace.searchParams.get('seed'),'77');assert.equal(waterRace.searchParams.has('map'),false,'display code never replaces route identity');
  location.search='?screen=characters&map=coast&driver=glm';windowTarget.dispatchEvent(new Event('popstate'));assert.match($('#choose-vehicle').attrs.href,/driver=glm/);
  $('[data-screen="settings"]').click();deny=true;$('[value="high"]').dispatchEvent(new Event('change'));assert.match($('#settings-status').textContent,/无法保存/);
  $('#reset-settings').click();assert.equal(g.document.activeElement.attrs.id,'reset-settings');assert.match($('#settings-status').textContent,/无法保存/);
  key('Escape');assert.match($('#choose-vehicle').attrs.href,/driver=glm/);
  location.search='?screen=race-settings&map=coast&driver=glm&difficulty=hard&seed=12&kart=broken';windowTarget.dispatchEvent(new Event('popstate'));
  assert.equal(root.className,'screen-race-settings');assert.match(root.innerHTML,/已选卡丁车/);assert.equal(root.querySelectorAll('.race-build-summary').length,1);
  const snapshot=new URLSearchParams(location.search).get('kart');assert.ok(snapshot,'direct setup snapshots default car even when storage is denied');
  assert.equal(new URL($('#start-race').attrs.href,'https://test.invalid').searchParams.get('kart'),snapshot);
  $('[data-screen="settings"]').click();key('Escape');assert.equal(root.className,'screen-race-settings');assert.equal(new URLSearchParams(location.search).get('kart'),snapshot);
  $('#back-vehicle').click();const garageRoute=garageDestination!;assert.equal(garageRoute.pathname,'/dev/garage.html');for(const [key,value] of Object.entries({driver:'glm',difficulty:'hard',seed:'12'}))assert.equal(garageRoute.searchParams.get(key),value);assert.equal(garageRoute.searchParams.get('kart'),snapshot);assert.equal(root.className,'screen-race-settings','menu view replacement belongs to the SPA host');
  $('[value="easy"]').dispatchEvent(new Event('change'));$('[value="hard"]').dispatchEvent(new Event('change'));const newSeed=$('#race-seed');newSeed.value='77';newSeed.dispatchEvent(new Event('change'));
  const headerTarget=new URL(headerGarage.href,'https://test.invalid'),homeTarget=new URL(wordmark.href,'https://test.invalid');
  for(const target of [headerTarget,homeTarget]){assert.equal(target.searchParams.get('difficulty'),'hard');assert.equal(target.searchParams.get('seed'),'77');assert.equal(target.searchParams.get('driver'),'glm');assert.equal(target.searchParams.get('kart'),snapshot);}
  const completed=new URL(garageRaceEntry('glm',JSON.parse(snapshot),headerTarget.search),'https://test.invalid');
  location.search=completed.search;windowTarget.dispatchEvent(new Event('popstate'));assert.equal(root.className,'screen-race-settings');assert.match($('#start-race').attrs.href,/difficulty=hard.*seed=77/);
  location.search=homeTarget.search;windowTarget.dispatchEvent(new Event('popstate'));assert.equal(root.className,'screen-main');fallback();$('[data-screen="maps"]').click();assert.equal(new URLSearchParams(location.search).get('seed'),'77');assert.equal(new URLSearchParams(location.search).get('kart'),snapshot);

  location.search='?screen=maps&map=mountain&driver=claude&difficulty=hard&seed=89';windowTarget.dispatchEvent(new Event('popstate'));
  assert.equal($('.map-detail-panel').dataset['preview-map'],'mountain');$('#confirm-map').click();
  const mountainGarage=new URL($('#choose-vehicle').attrs.href,'https://test.invalid');assert.equal(mountainGarage.searchParams.get('map'),'mountain');
  const mountainSetup=new URL(garageRaceEntry('claude',JSON.parse(snapshot),mountainGarage.search),'https://test.invalid');
  location.search=mountainSetup.search;windowTarget.dispatchEvent(new Event('popstate'));assert.equal(root.className,'screen-race-settings');assert.match(root.innerHTML,/云岭盘山道/);
  const mountainRace=new URL($('#start-race').attrs.href,'https://test.invalid');assert.equal(mountainRace.pathname,'/coast.html');assert.equal(mountainRace.searchParams.get('map'),'mountain');assert.equal(mountainRace.searchParams.get('kart'),snapshot);
  $('[data-screen="settings"]').click();key('Escape');assert.equal(new URLSearchParams(location.search).get('map'),'mountain');$('#back-vehicle').click();assert.equal(garageDestination!.pathname,'/dev/garage.html');assert.equal(garageDestination!.searchParams.get('map'),'mountain');

  windowTarget.dispatchEvent(Object.assign(new Event('pagehide'),{persisted:true}));assert.equal(shell.attrs['data-fixed-layout'],'1440x900','BFCache keeps layout mounted');
  windowTarget.dispatchEvent(new Event('pageshow'));assert.equal(shell.attrs['data-fixed-layout'],'1440x900');
  windowTarget.dispatchEvent(Object.assign(new Event('pagehide'),{persisted:false}));assert.equal(shell.attrs['data-fixed-layout'],undefined,'real navigation disposes the layout');
 }finally{releaseNavigator();for(const[n,d]of saved){if(d)Object.defineProperty(g,n,d);else delete g[n];}}
});

test('desktop course library uses side-by-side uncropped overview cards alongside the scenic panel',async()=>{
 const css=await readFile('src/menu.css','utf8');
 assert.match(css,/\.map-preview-layout\{[^}]*grid-template-columns:minmax\(350px,1fr\) minmax\(0,1\.25fr\)/);
 assert.match(css,/\.map-choices\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.map-choice-visual\{[^}]*aspect-ratio:16\/9/);
 assert.match(css,/\.map-overview\{[^}]*object-fit:contain/);
 assert.doesNotMatch(css,/@media\s*\([^)]*(?:min|max)-(?:width|height)/,'physical viewport breakpoints must not rearrange the fixed composition');
});
