import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RACE_HUD_MARKUP} from '../src/race-hud';
import {CONTROL_MODE_OPTIONS,CONTROL_PREFERENCE_EVENT,setControlPreference} from '../src/control-mode';
import {SETTINGS_KEY} from '../src/game-settings';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('race toolbar and pause dialog expose the same labelled control preference with unique IDs',()=>{
 const ids=[...RACE_HUD_MARKUP.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(new Set(ids).size,ids.length);
 for(const id of ['raceSystemTools','mobileControlModeToggle','mobileControlModePopover','mobileControlMode','pauseControlMode'])assert.equal(ids.filter(value=>value===id).length,1,id);
 assert.match(RACE_HUD_MARKUP,/<div class="tools" id="raceSystemTools" role="group" aria-label="比赛系统设置">/);
 assert.ok(RACE_HUD_MARKUP.indexOf('id="raceSettings"')<RACE_HUD_MARKUP.indexOf('id="mobileControlModePanel"'));
 assert.ok(RACE_HUD_MARKUP.indexOf('id="mobileControlModePanel"')<RACE_HUD_MARKUP.indexOf('<canvas id="map"'),'compact entry belongs to the system toolbar');
 assert.match(RACE_HUD_MARKUP,/<button type="button" id="mobileControlModeToggle"[^>]*aria-expanded="false"[^>]*aria-controls="mobileControlModePopover"[^>]*>操控<\/button>/);
 assert.match(RACE_HUD_MARKUP,/<div id="mobileControlModePopover"[^>]* hidden>/);
 for(const id of ['mobileControlMode','pauseControlMode']){
  assert.ok(RACE_HUD_MARKUP.includes(`<label for="${id}">操控方式</label>`),id+' visible label');
  const select=RACE_HUD_MARKUP.match(new RegExp(`<select id="${id}"[^>]*aria-describedby="(${id}Hint)"[^>]*>([\\s\\S]*?)</select>`));
  assert.ok(select,id);assert.equal(select[2],CONTROL_MODE_OPTIONS);
  assert.ok(ids.includes(select[1]),id+' explanatory text exists');
 }
 const pause=RACE_HUD_MARKUP.slice(RACE_HUD_MARKUP.indexOf('<section id="pausePanel"'));
 assert.ok(pause.includes('id="pauseControlMode"'));assert.ok(pause.indexOf('id="pauseControlMode"')<pause.indexOf('id="resumeRace"'));
 assert.match(pause,/点击“继续比赛”返回赛道/);
});

test('system actions and expanded panels stay in the safe-area corner with physical-size targets',()=>{
 const css=source('src/mobile-controls.css');
 assert.match(css,/#raceSystemTools\s*\{[^}]*position:fixed;[^}]*top:max\(12px,env\(safe-area-inset-top\)\);[^}]*right:max\(12px,env\(safe-area-inset-right\)\);left:auto/s);
 assert.match(css,/#raceSystemTools #perf-toggle\s*\{[^}]*width:44px;height:44px;min-width:44px;min-height:44px/s);
 assert.match(css,/\.mobile-control-mode\s*\{position:relative;pointer-events:none\}/);
 assert.match(css,/\.mobile-control-popover\s*\{[^}]*position:absolute;right:0;top:52px;width:224px/s);
 assert.match(css,/#raceSystemTools #perf-body\s*\{[^}]*position:fixed;[^}]*right:max\(12px,env\(safe-area-inset-right\)\)/s);
 assert.match(css,/body.menu #raceSystemTools>:not\(\.mobile-control-mode\)\{display:none\}/);
 assert.match(css,/body.race-paused #raceSystemTools\{visibility:hidden;pointer-events:none\}/);
 assert.match(css,/\.mobile-control-popover\[hidden\]\{display:none\}/);
 assert.match(css,/\.pause-control-setting select\{[^}]*min-height:44px/);
 assert.match(source('src/menu.css'),/\.control-mode-setting select\{[^}]*min-height:44px/);
 // Independent rectangle arithmetic anchored to the constants above. Real
 // rendering/screenshots remain necessary to establish appearance.
 for(const [width,height,insetLeft,insetRight,insetTop,insetBottom] of [[320,568,0,0,0,0],[360,640,0,0,0,0],[390,844,0,0,47,34],[640,360,0,0,0,0],[844,390,44,44,0,21],[1440,900,0,0,0,0]]){
  const edge=Math.max(12,insetRight),top=Math.max(12,insetTop);
  for(const count of [1,3,5]){
   const rowWidth=44*count+7*(count-1),left=width-edge-rowWidth;
   assert.ok(left>=insetLeft&&top+44<=height-insetBottom,`${width}×${height}: ${count} system actions fit`);
  }
  for(const authoredWidth of [224,310]){
   const popupWidth=Math.min(authoredWidth,width-24-insetLeft-insetRight),left=width-edge-popupWidth;
   assert.ok(left>=insetLeft&&width-edge<=width-insetRight,`${width}: corner popup stays in bounds`);
  }
  const panelTop=top+52,panelMaxHeight=height-80-insetTop-insetBottom;
  assert.ok(panelTop+panelMaxHeight<=height-insetBottom,`${width}: performance popup scrolls within screen`);
 }
});

test('physical toolbar gaps pass through while compact HUD and portrait hints clear the corner controls',()=>{
 const css=source('src/mobile-controls.css');
 assert.match(css,/#raceSystemTools\s*\{[^}]*pointer-events:none/s);
 assert.match(css,/#raceSystemTools \.icon,#raceSystemTools select,#raceSystemTools \.mobile-control-popover,#raceSystemTools #performance\{pointer-events:auto\}/);
 assert.match(css,/#raceUi \.top \.hud\{position:absolute;left:50%;transform:translateX\(-50%\);pointer-events:none\}/);
 assert.match(css,/#raceUi\[data-ui-compact='true'\] \.top\{top:max\(27px,calc\(\(max\(12px,env\(safe-area-inset-top\)\) \+ 52px - var\(--ui-top,0px\)\) \/ var\(--ui-scale,1\)\)\)\}/);
 assert.match(css,/#raceUi\[data-ui-compact='true'\] #map\{top:max\(128px,[^}]*pointer-events:none\}/);
 assert.match(css,/#raceUi\[data-ui-compact\] \.top\{top:calc\(\(max\(12px,env\(safe-area-inset-top\)\) \+ 100px - var\(--ui-top,0px\)\) \/ var\(--ui-scale,1\)\)\}/);
 assert.match(css,/\.mobile-rotate-hint\{display:none;pointer-events:none\}/);
 assert.match(css,/\.mobile-rotate-hint\{display:block;[^}]*top:calc\(max\(12px,env\(safe-area-inset-top\)\) \+ 52px\)/);
 assert.match(css,/\.mobile-control-popover\s*\{[^}]*max-height:calc\(100dvh - 80px - env\(safe-area-inset-top\) - env\(safe-area-inset-bottom\)\);overflow:auto/s);
 // Calculations validate the authored spacing, not rendered text or GPU output.
 for(const [width,height,safeTop,safeBottom]of [[320,568,0,0],[360,640,0,0],[390,844,47,34],[640,360,0,0],[844,390,0,21],[1024,768,0,0],[1440,900,0,0]]){
  const scale=Math.min(width/1440,height/900),rootTop=(height-900*scale)/2,compact=scale<.55,portrait=height>width;
  const toolbarTop=Math.max(12,safeTop),toolbarBottom=toolbarTop+44;
  const top=portrait?toolbarTop+100:compact?Math.max(rootTop+27*scale,toolbarTop+52):rootTop+27*scale;
  const mapTop=compact?Math.max(rootTop+128*scale,toolbarTop+52):rootTop+128*scale;
  assert.ok(mapTop>=toolbarBottom+8,`${width}: minimap clears the physical toolbar`);
  if(compact&&!portrait)assert.ok(top>=toolbarBottom+8,`${width}: scoreboard is below the physical toolbar`);
  if(portrait){
   const hintTop=toolbarTop+52,utilityTop=height-(22+safeBottom+360)-48;
   assert.ok(hintTop>=toolbarBottom+8,`${width}: portrait hint clears the physical toolbar`);
   assert.ok(top>=hintTop+48,`${width}: HUD has a separate row below the portrait hint`);
   assert.ok(top+80*scale<=utilityTop,`${width}: proportional HUD row remains above fixed driving utilities`);
  }
 }
});

test('menu preference restores, saves, synchronizes, resets, and disposes across repeated navigation',async()=>{
 const g=globalThis as any,names=['document','window','location','history','localStorage'];
 const originals=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(g,name)]));
 const values=new Map<string,string>([['kart-control-mode','touch']]);let denied=false,writes=0;
 const storage={getItem:(key:string)=>{if(denied)throw Error('blocked');return values.get(key)??null;},setItem:(key:string,value:string)=>{if(denied)throw Error('blocked');writes++;values.set(key,value);}};
 class Target extends EventTarget{
  listeners=new Map<string,Set<any>>();
  addEventListener(type:string,listener:any,options?:any){super.addEventListener(type,listener,options);if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type)!.add(listener);}
  removeEventListener(type:string,listener:any,options?:any){super.removeEventListener(type,listener,options);this.listeners.get(type)?.delete(listener);}
  count(type:string){return this.listeners.get(type)?.size??0;}
 }
 const elements:Element[]=[];
 class Element extends Target{
  attrs:Record<string,string>={};dataset:Record<string,string>={};value='';checked=false;disabled=false;hidden=false;inert=false;textContent='';className='';html='';id='';
  style={getPropertyValue:()=>'',getPropertyPriority:()=>'',setProperty:()=>{},removeProperty:()=>{}};
  constructor(readonly tagName='DIV'){super();}
  getAttribute(name:string){return this.attrs[name]??null;}
  setAttribute(name:string,value:string){this.attrs[name]=value;}
  removeAttribute(name:string){delete this.attrs[name];}
  set innerHTML(html:string){this.html=html;if(this===root)elements.length=0;for(const match of html.matchAll(/<([a-z]+)\b([^>]*)>/g)){const el=new Element(match[1].toUpperCase());for(const attr of match[2].matchAll(/([\w-]+)="([^"]*)"/g)){el.attrs[attr[1]]=attr[2];if(attr[1].startsWith('data-'))el.dataset[attr[1].slice(5)]=attr[2];}el.value=el.attrs.value??'';el.checked=/\bchecked\b/.test(match[2]);elements.push(el);}}
  get innerHTML(){return this.html;}
  querySelectorAll(selector:string){return elements.filter(el=>{if(selector.startsWith('#'))return (el.attrs.id||el.id)===selector.slice(1);if(selector.startsWith('.'))return (el.attrs.class||el.className).split(' ').includes(selector.slice(1));const match=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return match&&match[1] in el.attrs&&(match[2]===undefined||el.attrs[match[1]]===match[2]);});}
  querySelector(selector:string){return this.querySelectorAll(selector)[0]??null;}
  focus(){doc.activeElement=this;}
  click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
 }
 const root=new Element(),shell=new Element(),win=Object.assign(new Target(),{localStorage:storage,scrollTo:()=>{}});
 const location={pathname:'/dev/index.html',search:'?screen=settings&return=maps&map=waterpark&driver=glm&difficulty=hard&seed=77'};
 const historyChanges:string[]=[];
 const history={pushState:(_state:unknown,_title:string,url:string)=>{historyChanges.push(url);location.search=new URL(url,'https://test.invalid/').search;},replaceState:(_state:unknown,_title:string,url:string)=>{location.search=new URL(url,'https://test.invalid/').search;}};
 const doc=Object.assign(new Target(),{defaultView:win,body:{dataset:{}},activeElement:null as Element|null,title:'',querySelector:()=>null,getElementById:(id:string)=>id==='menu'?root:id==='menu-ui'?shell:elements.find(el=>el.attrs.id===id),createElement:(tag:string)=>new Element(tag)});
 const $=(selector:string)=>{const el=root.querySelector(selector);assert.ok(el,selector);return el;};
 const change=(mode:string)=>{const select=$('#menuControlMode');select.value=mode;select.dispatchEvent(new Event('change'));};
 const historyRefresh=()=>win.dispatchEvent(new Event('popstate'));
 const escape=()=>win.dispatchEvent(Object.assign(new Event('keydown'),{key:'Escape'}));
 try{
  for(const [name,value] of Object.entries({document:doc,window:win,location,history,localStorage:storage}))Object.defineProperty(g,name,{configurable:true,writable:true,value});
  const bootNodes=new Map(['menu-boot','menu-boot-status','menu-boot-progress','menu-boot-detail','menu-boot-retry','menu-boot-continue'].map(id=>[id,new Element()]));
  const lookup=doc.getElementById;doc.getElementById=(id:string)=>bootNodes.get(id)??lookup(id);
  Object.assign(win,{setTimeout:()=>1,clearTimeout:()=>{}});
  const {mountMenu}=await import('../src/menu');mountMenu();
  assert.equal(root.className,'screen-settings');assert.match(doc.title,/游戏设置/);
  assert.equal($('#menuControlMode').value,'touch','saved choice is restored before interaction');
  assert.match(root.innerHTML,/<label for="menuControlMode">操控方式<\/label>/);
  assert.equal($('#menuControlMode').attrs['aria-describedby'],'menuControlModeHint');
  assert.ok(root.innerHTML.includes(CONTROL_MODE_OPTIONS));
  const bindingListeners=doc.count(CONTROL_PREFERENCE_EVENT);assert.ok(bindingListeners>0);
  const beforeUrl=location.search,beforeHistory=historyChanges.length;
  for(const mode of ['desktop','auto','touch']){
   const beforeWrites=writes;$('#menuControlMode').focus();change(mode);
   assert.equal(values.get('kart-control-mode'),mode);assert.equal(writes,beforeWrites+1,'one storage write per user change');
   assert.equal(doc.activeElement,$('#menuControlMode'),'choice keeps native focus');assert.match($('#settings-status').textContent,/操控方式已保存/);
   assert.equal(root.className,'screen-settings');assert.equal(location.search,beforeUrl);assert.equal(historyChanges.length,beforeHistory,'setting is not navigation');
  }
  setControlPreference(doc as unknown as Document,'desktop');assert.equal($('#menuControlMode').value,'desktop','shared updates reach the rendered entry');
  for(let i=0;i<3;i++){
   const stale=$('#menuControlMode');escape();assert.equal(root.className,'screen-maps');assert.equal(doc.count(CONTROL_PREFERENCE_EVENT),0,'leaving settings releases listeners');
   const beforeWrites=writes;stale.value='touch';stale.dispatchEvent(new Event('change'));assert.equal(writes,beforeWrites,'detached controls cannot change the preference');
   $('[data-screen="settings"]').click();assert.equal($('#menuControlMode').value,'desktop');assert.equal(doc.count(CONTROL_PREFERENCE_EVENT),bindingListeners,'repeat visits do not accumulate listeners');
   assert.match(location.search,/map=waterpark/);assert.match(location.search,/driver=glm/);assert.match(location.search,/difficulty=hard/);assert.match(location.search,/seed=77/);
  }
  const stale=$('#menuControlMode');historyRefresh();assert.notEqual($('#menuControlMode'),stale);assert.equal($('#menuControlMode').value,'desktop');assert.equal(doc.count(CONTROL_PREFERENCE_EVENT),bindingListeners);
  const beforeStale=writes;stale.value='touch';stale.dispatchEvent(new Event('change'));assert.equal(writes,beforeStale);
  $('#reset-settings').click();assert.equal($('#menuControlMode').value,'auto');assert.equal(values.get('kart-control-mode'),'auto');assert.deepEqual(JSON.parse(values.get(SETTINGS_KEY)!),{version:1,quality:'balanced',refraction:true});assert.equal(doc.activeElement,$('#reset-settings'));
  denied=true;change('touch');assert.equal($('#menuControlMode').value,'touch');assert.match($('#settings-status').textContent,/无法保存/);assert.equal(values.get('kart-control-mode'),'auto','denied storage is not claimed as persisted');
  historyRefresh();assert.equal($('#menuControlMode').value,'touch','session fallback survives rerender when storage is unavailable');assert.equal(doc.count(CONTROL_PREFERENCE_EVENT),bindingListeners);
  win.dispatchEvent(Object.assign(new Event('pagehide'),{persisted:true}));assert.equal(doc.count(CONTROL_PREFERENCE_EVENT),bindingListeners,'BFCache keeps working bindings');
  const finalSelector=$('#menuControlMode');win.dispatchEvent(Object.assign(new Event('pagehide'),{persisted:false}));assert.equal(doc.count(CONTROL_PREFERENCE_EVENT),0);assert.equal(finalSelector.count('change'),0,'real navigation disposes selection handler');
 }finally{for(const [name,descriptor]of originals){if(descriptor)Object.defineProperty(g,name,descriptor);else delete g[name];}}
});

 test('pause settings stay physical-size after a phone is manually switched to keyboard mode',()=>{
 const css=source('src/mobile-controls.css');
 assert.match(css,/#pausePanel \.pause-actions\s*\{[^}]*transform:scale\(calc\(1 \/ var\(--ui-scale, 1\)\)\)/s);
 assert.match(css,/#pausePanel \.pause-actions button\{min-height:48px/);
 assert.doesNotMatch(css,/body\[data-input-mode='touch'\] \.pause-actions/);
 for(const scale of [.22,.4,.8,1,1.5])assert.ok(Math.abs(44*scale*(1/scale)-44)<1e-10);
 });
