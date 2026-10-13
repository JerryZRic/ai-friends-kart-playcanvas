import {mountMenuBoot} from './menu-boot';
import {getDocumentMusic,bindMusicNavigation,bindMusicSettings,MUSIC_SETTINGS_MARKUP} from './music-ui';
import {characterEmblem} from './character-identity.js';
import type {CharacterPreviewController} from './character-preview';
import type {MenuBackdropController} from './menu-backdrop';
import {mountUiLayout,mountUiViewportNotice} from './ui-layout';
import {CHARACTER_PROFILES,resolveCharacter,characterTuning} from './character-profiles';
import {MAP_PROFILES,resolveMap,type MapId} from './map-profiles';
import {MAP_CATALOG,MAP_MENU_ORDER} from './map-presentation';
import {readGameSettings,saveGameSettings,type Quality} from './game-settings';
import {CONTROL_MODE_OPTIONS,CONTROL_PREFERENCE_EVENT,bindControlPreferenceSelect,setControlPreference} from './control-mode';
import {parseMenuState,menuQuery,raceEntry,garageEntry,type MenuScreen} from './menu-state';
import {parseRaceOptions} from './race-options';
import {loadGarageState,buildParts,KART_SLOTS,SLOT_LABELS} from './kart-build';
export interface MenuController {dispose():void;}
const mountedMenus=new WeakMap<Document,MenuController>();

/** The application host inserts the menu shell before mounting this view. */
export function mountMenu():MenuController {
const root=document.getElementById('menu'),shell=document.getElementById('menu-ui');
if(!root||!shell)throw new Error('The menu shell must be present before mountMenu()');
mountedMenus.get(document)?.dispose();
const boot=mountMenuBoot(document);
const music=getDocumentMusic(document),musicNavigation=bindMusicNavigation(document,music);
let disposed=false,renderListeners=new AbortController();
const pendingPaints=new Set<()=>void>();
type MenuElementEventMap=HTMLElementEventMap&{webglcontextlost:Event;webglcontextrestored:Event};
function listen<K extends keyof MenuElementEventMap>(target:Element|null,type:K,handler:(event:MenuElementEventMap[K])=>void,options:AddEventListenerOptions={}){
 target?.addEventListener(type,handler as EventListener,{...options,signal:renderListeners.signal});
}
function cancelPendingPaints(){for(const cancel of [...pendingPaints])cancel();}
function waitForPaint(){return new Promise<void>(resolve=>{
 let frame=0;
 const finish=()=>{cancelAnimationFrame(frame);pendingPaints.delete(finish);resolve();};
 pendingPaints.add(finish);frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(finish);});
});}
let disposeMusicSettings:(()=>void)|undefined;
let homeReady=false;
let disposeControlPreference:(()=>void)|undefined;
function revealHome(version:number, fallback=false){
 if(version!==renderVersion||state.screen!=='main')return;
 if(!fallback&&boot.ready()===false)return;
 homeReady=true;music?.setPhase('menu');
 const nav=root.querySelector<HTMLElement>('.title-actions');
 if(nav){nav.hidden=false;nav.inert=false;nav.setAttribute('aria-hidden','false');}
 root.querySelectorAll<HTMLButtonElement>('.title-action').forEach(button=>{button.disabled=false;});
 if(fallback){const canvas=root.querySelector<HTMLElement>('#title-backdrop');if(canvas)canvas.hidden=true;const poster=root.querySelector<HTMLElement>('.title-fallback');if(poster)poster.hidden=false;root.querySelector<HTMLElement>('#story-button')?.focus();}
}

let state=parseMenuState(location.search),settings=readGameSettings();
let disposeBackdrop:MenuBackdropController|undefined,disposeCharacter:CharacterPreviewController|undefined,renderVersion=0;

const menuLayout=mountUiLayout(shell,layout=>{
 const style=window.getComputedStyle?.(shell);
 const inset=(edge:string)=>Math.max(0,parseFloat(style?.getPropertyValue('--title-safe-'+edge)??'0')||0);
 const left=inset('left'),right=inset('right'),top=inset('top'),bottom=inset('bottom');
 const scale=Math.min(Math.max(1,layout.viewportWidth-left-right)/1600,Math.max(1,layout.viewportHeight-top-bottom)/900);
 shell.style.setProperty('--title-scale',String(scale));
 shell.style.setProperty('--title-center-x',`${layout.centerX+(left-right)/2}px`);
 shell.style.setProperty('--title-center-y',`${layout.centerY+(top-bottom)/2}px`);
 disposeBackdrop?.resize();disposeCharacter?.resize();
});
const viewportNotice=mountUiViewportNotice(shell);
function dispose(){
 if(disposed)return;
 disposed=true;renderVersion++;
 cancelPendingPaints();renderListeners.abort();
 disposeMusicSettings?.();disposeMusicSettings=undefined;musicNavigation.dispose();boot.dispose();
 menuLayout.dispose();viewportNotice.dispose();disposeBackdrop?.();disposeCharacter?.();
 disposeControlPreference?.();disposeControlPreference=undefined;
 disposeBackdrop=undefined;disposeCharacter=undefined;
 window.removeEventListener('pagehide',pageHide);window.removeEventListener('pageshow',pageShow);
 window.removeEventListener('popstate',popState);window.removeEventListener('keydown',keyDown);
 if(mountedMenus.get(document)===controller)mountedMenus.delete(document);
}
function pageHide(event:PageTransitionEvent){if(!event.persisted)dispose();}
function pageShow(){menuLayout.update();}
window.addEventListener('pagehide',pageHide);window.addEventListener('pageshow',pageShow);
function closeStory(){root.querySelector('#story-dialog')?.remove();root.querySelector<HTMLElement>('#story-button')?.focus();}
function startBackdrop(version:number){
 const canvas=root.querySelector<HTMLCanvasElement>('#title-backdrop'),curtain=root.querySelector<HTMLElement>('#title-curtain');
 if(!canvas||!curtain)return;
 if(state.screen==='maps'){
  // Keep the route poster visible if WebGL is absent or temporarily loses its context.
  listen(canvas,'webglcontextlost',()=>{canvas.dataset.previewFallback='true';});
  listen(canvas,'webglcontextrestored',()=>{delete canvas.dataset.previewFallback;});
 }
 if(typeof canvas.getContext!=='function'){canvas.dataset.backdropState='unavailable';if(state.screen==='main'){boot.fail('此设备暂时无法初始化 3D 背景');}return;}
 if(state.screen==='main')boot.stage(2,'菜单程序已就绪，正在载入 3D 引擎…');
 void import('./menu-backdrop').then(async ({mountMenuBackdrop,prepareMenuWorld})=>{
  if(version!==renderVersion)return;
  if(state.screen==='maps')await prepareMenuWorld(state.map);
  if(version!==renderVersion)return;
  // Let the loading shell paint even when the engine chunk is already cached.
  await waitForPaint();
  if(version!==renderVersion||(state.screen!=='main'&&state.screen!=='maps')||(state.screen==='main'&&homeReady))return;
  if(state.screen==='main')boot.stage(2,'菜单程序已就绪，正在启动 3D 引擎…');
  disposeBackdrop=mountMenuBackdrop(canvas,curtain,settings,state.screen==='maps'?{map:state.map,autoCycle:false,presentation:'map-preview'}:{presentation:'cover'},undefined,{
   onStage:stage=>{if(version===renderVersion&&state.screen==='main')boot.stage(stage==='scene'?3:4,stage==='scene'?'正在准备首页场景与材质…':'正在绘制首页画面…');},
   onReady:()=>revealHome(version),
   onError:()=>{if(version===renderVersion&&state.screen==='main')boot.fail('3D 背景暂时无法显示');},
  });
 }).catch(error=>{if(version===renderVersion){canvas.dataset.backdropState='unavailable';if(state.screen==='main')boot.fail('3D 引擎加载失败，请检查网络后重试');}console.error('Title background unavailable',error);});
}
function startCharacter(version:number){
 const canvas=root.querySelector<HTMLCanvasElement>('#character-preview'),status=root.querySelector<HTMLElement>('#character-preview-status');
 if(!canvas||!status||typeof canvas.getContext!=='function')return;
 void import('./character-preview').then(({mountCharacterPreview})=>{
  if(version!==renderVersion||state.screen!=='characters')return;
  disposeCharacter=mountCharacterPreview(canvas,status,state.driver);
 }).catch(error=>{if(version===renderVersion)status.textContent='3D 预览暂时不可用';console.error('Character preview unavailable',error);});
}
function navigate(screen:MenuScreen,updates:Partial<typeof state>={}){if(disposed)return;state={...state,...updates,screen};history.pushState(null,'',`./index.html${menuQuery(state)}`);render();root.focus({preventScroll:true});window.scrollTo({top:0});}
function screenLabel(screen:MenuScreen){return ({main:'主菜单',maps:'地图选择',characters:'角色选择',vehicles:'坐骑选择','race-settings':'比赛设置',settings:'游戏设置',exit:'休息页面'})[screen];}
function vehicleBack(){if(resolveMap(state.map).vehicle==='kart')musicNavigation.navigate(garageEntry(state.driver,state));else navigate('vehicles');}
function menuIcon(kind:'back'|'settings'|'reset'){
 const path={back:'M19 12H5m6-6-6 6 6 6',settings:'M4 7h16M4 17h16M8 4v6m8 4v6',reset:'M4 11a8 8 0 1 1 2 7M4 4v7h7'}[kind];
 return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
}
function top(title:string,sub:string,back:MenuScreen='main',vehicle=false){return `<div class="section-top"><button class="back game-nav" aria-label="返回${vehicle?(resolveMap(state.map).vehicle==='kart'?'卡丁车 / 改装车库':'坐骑选择'):screenLabel(back)}" ${vehicle?'id="back-vehicle"':`data-screen="${back}"`}>${menuIcon('back')}<span>${vehicle?(resolveMap(state.map).vehicle==='kart'?'返回车库':'返回坐骑'):'返回'}</span></button><button class="game-nav" data-screen="settings">${menuIcon('settings')}<span>游戏设置</span></button></div><div class="section-heading"><p class="eyebrow">FREE PLAY / 自由模式</p><h1>${title}</h1><p>${sub}</p></div>`;}
function render(){
 if(disposed)return;
 const version=++renderVersion;
 cancelPendingPaints();renderListeners.abort();renderListeners=new AbortController();
 shell.hidden=false;
 musicNavigation.cancel();
 disposeMusicSettings?.();disposeMusicSettings=undefined;
 if(state.screen!=='main')music?.setPhase(state.screen==='exit'?'silent':'menu');
 disposeControlPreference?.();disposeControlPreference=undefined;
 const retainedStage=state.screen==='characters'&&root.className==='screen-characters'&&disposeCharacter?root.querySelector('.character-stage'):null;
 disposeBackdrop?.();disposeBackdrop=undefined;
 if(!retainedStage){disposeCharacter?.();disposeCharacter=undefined;}
 homeReady=false;
 if(state.screen==='main')boot.begin(()=>{if(version!==renderVersion)return;disposeBackdrop?.();disposeBackdrop=undefined;revealHome(version,true);});
 else boot.dismiss();
 if(document.body)document.body.dataset.screen=state.screen;
 document.title=`${screenLabel(state.screen)} · 大肥鱼卡丁车`;
 root.className=`screen-${state.screen}`;
 if(state.screen==='main')root.innerHTML=`<section class="title-screen" aria-labelledby="game-title"><div class="title-background" aria-hidden="true"><img class="title-fallback" src="./map-previews/waterpark-overview.webp" alt="" hidden><canvas id="title-backdrop" tabindex="-1"></canvas><div id="title-curtain"></div><div class="title-shade"></div></div><div class="title-stage"><div class="title-composition" aria-hidden="true"><img class="title-character" src="./menu-art/whale-maid.png" alt="" draggable="false" decoding="async"><img class="title-logo" src="./menu-art/title-logo.png" alt="" draggable="false" decoding="async"></div><h1 id="game-title">大肥鱼卡丁车</h1><nav class="title-actions" aria-label="游戏主菜单" aria-hidden="true" hidden inert><button class="title-action" id="story-button" disabled><svg viewBox="0 0 32 32" aria-hidden="true"><path d="m3 5 8-3 10 4 8-3v24l-8 3-10-4-8 3zM11 3v23M21 6v24"/></svg><span>故事模式</span><span class="title-hit-area" aria-hidden="true"></span></button><button class="title-action" data-screen="maps" data-primary="true" disabled><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13"/><circle cx="16" cy="16" r="4"/><path d="M4 12h24M14 20l-3 8M18 20l3 8"/></svg><span>自由模式</span><span class="title-hit-area" aria-hidden="true"></span></button><button class="title-action" data-screen="settings" disabled><svg viewBox="0 0 32 32" aria-hidden="true"><path d="m12 3 8 0 1 5 5 3 5 1v8l-5 1-5 5-1 5h-8l-1-5-5-5-5-1v-8l5-1 5-3z"/><circle cx="16" cy="16" r="5"/></svg><span>设置</span><span class="title-hit-area" aria-hidden="true"></span></button><button class="title-action" data-screen="exit" disabled><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 29V3h20v26M10 7l12-2v24l-12-3z"/><path d="M17 17h1"/></svg><span>退出</span><span class="title-hit-area" aria-hidden="true"></span></button></nav></div></section>`;
 if(state.screen==='maps'){
  const selected=resolveMap(state.map);
  root.innerHTML=top('选择赛道','从海岸公路、云岭山道到晴空水道，下一站由你决定')+`
   <section class="map-preview-layout" aria-label="赛道选择与预览">
    <aside class="map-library" aria-labelledby="map-library-heading">
     <div class="map-library-heading"><h2 id="map-library-heading">赛道一览</h2><span>${String(Object.keys(MAP_PROFILES).length).padStart(2,'0')} COURSES</span></div>
     <div class="map-choices" role="group" aria-label="选择地图" aria-describedby="map-keyboard-hint">${MAP_CATALOG.map(m=>`
      <button class="map-choice" data-map="${m.id}" aria-pressed="${m.id===state.map}" tabindex="${m.id===state.map?'0':'-1'}" aria-label="${m.displayCode} ${m.label}，${m.vehicle==='kart'?'卡丁车':'鲸鱼坐骑'}">
       <span class="map-choice-visual">
        <img class="map-overview" src="./map-previews/${m.id}-overview.webp" alt="${m.label}的 3D 俯视全景，展示完整赛道路线" width="1280" height="720" decoding="async">
        <span class="map-choice-number" aria-hidden="true">${m.displayCode}</span>
        <span class="map-overview-label">3D 俯视图</span>
        <span class="map-selected-indicator" aria-hidden="true">${m.id===state.map?'✓':'↗'}</span>
       </span>
       <span class="map-choice-copy"><span class="map-choice-title"><strong>${m.label}</strong><span class="map-choice-arrow" aria-hidden="true">→</span></span><span class="map-choice-meta"><span>${m.vehicle==='kart'?'卡丁车':'鲸鱼坐骑'}</span><span>${m.id===state.map?'已选择':m.tag}</span></span></span>
      </button>`).join('')}</div>
     <p class="map-keyboard-hint" id="map-keyboard-hint">↑ ↓ 切换赛道 <span>·</span> Tab 前往下一步</p>
    </aside>
    <section class="map-detail-panel" data-preview-map="${selected.id}" aria-labelledby="selected-map-title">
     <div class="map-stage" aria-label="${selected.label} 3D 赛道预览">
      <img class="map-stage-fallback" src="./map-previews/${selected.id}-overview.webp" alt="" aria-hidden="true">
      <canvas id="title-backdrop" aria-hidden="true" tabindex="-1"></canvas><div id="title-curtain" aria-hidden="true"></div><div class="map-stage-shade" aria-hidden="true"></div>
      <div class="map-preview-label"><i aria-hidden="true"></i><span class="map-preview-scenic-label">赛道预览</span><span class="map-preview-fallback-label">3D 俯视图</span></div>
      <div class="map-stage-caption"><p class="eyebrow">${selected.tag}</p><h2 id="selected-map-title">${selected.label}</h2><p>${selected.description}</p></div>
     </div>
     <div class="map-detail-copy">
      <p class="map-detail-description">${selected.detail}</p>
      <dl class="map-facts"><div><dt>专属载具</dt><dd>${selected.vehicle==='kart'?'卡丁车':'鲸鱼坐骑'}</dd></div><div><dt>参赛阵容</dt><dd>六名选手</dd></div><div><dt>驾驶手感</dt><dd>${selected.vehicle==='kart'?'抓地与漂移':'水面惯性与滑移'}</dd></div></dl>
      <div class="map-proceed"><p><span>01 / 04</span> 下一步：选择出发伙伴</p><button class="primary map-confirm" id="confirm-map"><span>确认赛道，选择角色</span><span aria-hidden="true">→</span></button></div>
     </div>
    </section>
   </section>`;
 }
 if(state.screen==='characters'){
 const map=resolveMap(state.map),selected=resolveCharacter(state.driver),t=characterTuning(selected.id,state.map);
 const stats=[['加速能力',selected.acceleration,t.acceleration,'m/s²'],['最高速度',selected.topSpeed,t.maxSpeed,'m/s'],[state.map==='waterpark'?'转向加速度':'转向横移能力',selected.steering,t.steering,state.map==='waterpark'?'m/s²':'m/s']];
 root.innerHTML=top('选一位出发伙伴',`${map.label} · ${map.vehicle==='kart'?'卡丁车':'鲸鱼坐骑'}　/　六名选手，同场竞速`,'maps')+`<div class="character-layout"><div class="character-roster"><div class="character-stage"><canvas id="character-preview" tabindex="0" aria-label="${selected.label} 3D 形象，可拖动旋转"></canvas><p id="character-preview-status" role="status" aria-live="polite">正在载入 ${selected.label} 的 3D 形象…</p></div><div class="character-grid" role="group" aria-label="选择参赛角色">${CHARACTER_PROFILES.map(c=>`<button class="character-card" style="--character:${c.color}" data-driver="${c.id}" aria-pressed="${c.id===selected.id}"><span class="character-symbol" aria-hidden="true">${characterEmblem(c.id)}</span><span class="character-name">${c.label}</span><span class="character-role">${c.nickname}</span><span class="selected-mark" aria-hidden="true">${c.id===selected.id?'✓':'+'}</span></button>`).join('')}<p class="roster-note">拖动上方角色旋转查看 · 方向键也可旋转</p></div></div><aside class="profile-panel" aria-label="已选角色属性" style="--character:${selected.color}"><p class="eyebrow">YOUR DRIVER / 已选伙伴</p><h2>${selected.label}</h2><p class="profile-role">${selected.nickname}</p><p class="profile-description">${selected.description}</p><div class="stats">${stats.map(([label,mult,value,unit])=>`<div class="stat"><div><span>${label}</span><strong>${Number(value).toFixed(2)} <small>${unit}</small></strong></div><meter min="0.85" max="1.15" value="${mult}" aria-label="${label}，标准值的 ${Math.round(Number(mult)*100)}%"></meter><span class="stat-percent">标准值 × ${Number(mult).toFixed(2)}</span></div>`).join('')}</div><p class="stats-note">${state.map==='waterpark'?'加速是阻力修正前的推进加速度；极速是基础速度上限。转向是横向加速度，实际横移受惯性与阻尼影响。':'基础参数，不含道具、漂移与地形修正。转向是正常极速下的横移速度，不是转弯角度。'}玩家与对手使用相同角色系数。</p><p class="flow-step">02 / 04 · 下一步：${resolveMap(state.map).vehicle==='kart'?'选择卡丁车与改装':'确认水上坐骑'}</p>${resolveMap(state.map).vehicle==='kart'?`<a class="primary start-race" id="choose-vehicle" href="${garageEntry(selected.id,state)}"><span>选择卡丁车 / 改装车库</span><span>→</span></a>`:`<button class="primary start-race" id="choose-vehicle" data-screen="vehicles"><span>选择水上坐骑</span><span>→</span></button>`}<p class="fine-print">角色与车辆独立选择，可随时返回调整</p></aside></div>`;
 }
 if(state.screen==='vehicles'&&resolveMap(state.map).vehicle==='kart'){root.innerHTML=top('选择卡丁车',`${resolveMap(state.map).label} · 第 3 / 4 步`,'characters')+`<section class="settings-panel"><h2>卡丁车 / 改装车库</h2><p>选择整车预设，再自由调整六个零件。</p><a class="primary start-race" href="${garageEntry(state.driver,state)}">进入车库 →</a></section>`;}
 if(state.screen==='vehicles'&&state.map==='waterpark'){
  root.innerHTML=top('确认水上坐骑',`${resolveMap(state.map).label} · 第 3 / 4 步`,'characters')+`<section class="settings-panel vehicle-panel"><p class="eyebrow">WATER MOUNT / 水上专属</p><div class="mount-symbol" aria-hidden="true">≈</div><h2>鲸鱼坐骑</h2><p>当前水上赛道使用鲸鱼坐骑，保留水面惯性与滑移手感。</p><p>出发伙伴：${resolveCharacter(state.driver).label}</p><button class="primary start-race" data-screen="race-settings">确认坐骑，设置比赛 →</button></section>`;
 }
 if(state.screen==='race-settings'){
  // Snapshot storage once, so returning or changing graphics cannot swap the car.
  if(resolveMap(state.map).vehicle==='kart'&&!state.kart){state.kart=JSON.stringify(loadGarageState().activeBuild);history.replaceState(null,'',`./index.html${menuQuery(state)}`);}
  const selectedParts=resolveMap(state.map).vehicle==='kart'?buildParts(JSON.parse(state.kart!)):undefined;
  const vehicleSummary=selectedParts?`<section class="race-build-summary" aria-label="已选卡丁车"><h2>已选卡丁车</h2><dl>${KART_SLOTS.map(slot=>`<div><dt>${SLOT_LABELS[slot]}</dt><dd>${selectedParts[slot].name}</dd></div>`).join('')}</dl></section>`:'<section class="race-build-summary" aria-label="已选坐骑"><h2>已选坐骑</h2><p>鲸鱼坐骑 · 水面惯性与滑移</p></section>';
  root.innerHTML=top('比赛设置',`${resolveMap(state.map).label} · ${resolveCharacter(state.driver).label} · 第 4 / 4 步`,'characters',true)+`<section class="settings-panel race-options-panel">${vehicleSummary}<fieldset><legend>对手难度</legend><p>只改变 NPC 的驾驶水平；对手与玩家使用相同规则。</p><div class="quality-options">${[['easy','简单','轻松熟悉赛道'],['normal','普通','标准驾驶水平'],['hard','困难','更熟练的路线与操作']].map(([value,label,description])=>`<label><input type="radio" name="difficulty" value="${value}" ${state.difficulty===value?'checked':''}><span><strong>${label}</strong><small>${description}</small></span></label>`).join('')}</div></fieldset><div class="setting-row"><div><label for="race-seed">比赛种子</label><p>相同种子可重现对手配置，范围 0–4294967295</p></div><input id="race-seed" type="number" min="0" max="4294967295" step="1" value="${state.seed}" inputmode="numeric"></div><p id="race-options-status" role="status" aria-live="polite">已选择${state.difficulty==='easy'?'简单':state.difficulty==='hard'?'困难':'普通'}难度</p><a class="primary start-race" id="start-race" href="${raceEntry(state.map,state.driver,state)}"><span>开始比赛</span><span>→</span></a><p class="fine-print">首次进入需要下载 3D 资源，请稍候</p></section>`;
 }
 if(state.screen==='settings')root.innerHTML=`<div class="section-top"><button class="game-nav" data-screen="${state.returnTo}" aria-label="返回${screenLabel(state.returnTo)}">${menuIcon('back')}<span>返回</span></button></div><div class="section-heading"><p class="eyebrow">MAKE IT YOURS</p><h1>游戏设置</h1><p>设置自动保存在此浏览器；比赛中也可在暂停菜单更改操控方式</p></div><section class="settings-panel system-options-panel" tabindex="0" aria-label="画面设置与操作说明"><div class="settings-controls"><div class="setting-row control-mode-setting"><div><label for="menuControlMode">操控方式</label><p id="menuControlModeHint">自动根据设备与实际操作识别，也可手动选择；比赛中可在暂停菜单更改</p></div><select id="menuControlMode" aria-describedby="menuControlModeHint">${CONTROL_MODE_OPTIONS}</select></div><fieldset><legend>画面质量</legend><p>流畅档关闭阴影并降低渲染分辨率；精细档提高阴影清晰度</p><div class="quality-options">${[['low','流畅','低分辨率 · 无阴影'],['balanced','均衡','标准分辨率 · 标准阴影'],['high','精细','标准分辨率 · 精细阴影']].map(([q,name,desc])=>`<label><input type="radio" name="quality" value="${q}" ${settings.quality===q?'checked':''}><span><strong>${name}</strong><small>${desc}</small></span></label>`).join('')}</div></fieldset><div class="setting-row"><div><label for="refraction">水面折射</label><p>水上乐园的透水折射效果；关闭可减轻渲染负担</p></div><input type="checkbox" id="refraction" ${settings.refraction?'checked':''}></div><div class="setting-row">${MUSIC_SETTINGS_MARKUP}</div></div><section class="controls-guide" aria-label="操作说明"><h2>操作说明</h2><h3>所有赛道 · 统一操作</h3><p>W / ↑ 油门 · S / ↓ 刹车与倒车<br>A / D 或 ← / → 转向 · 空格 刹车<br>Shift 漂移 / 水上滑移蓄力 · E 使用道具<br>Z / C 切换视角 · 按住鼠标右键回看<br>单击赛道后移动鼠标环顾 · Q 视角回正<br>Esc 暂停并释放鼠标 · P 暂停或继续</p><p>海岸卡丁车抓地转向；水上坐骑保留惯性与阻尼。相同按键与界面，不同驾驶手感。</p><p>触屏：使用赛道画面中的转向、油门、刹车及道具按钮。菜单可用 Tab 切换焦点、Enter 确认、Esc 返回。</p></section><div class="settings-bottom"><p class="settings-status" id="settings-status" role="status" aria-live="polite">设置已载入</p><button class="game-nav" id="reset-settings">${menuIcon('reset')}<span>恢复默认</span></button></div></section>`;
 if(state.screen==='exit')root.innerHTML=`<section class="exit-panel"><p class="eyebrow">SEE YOU AT THE START LINE</p><div class="exit-symbol" aria-hidden="true">☀</div><h1>休息一下，<br>随时再出发。</h1><p>已返回休息页面，没有比赛在后台运行。<br>你可以关闭此标签页退出游戏。</p><button class="primary" data-screen="main">返回主菜单 →</button></section>`;
 refreshNavigationLinks();
 bind();
 if(state.screen==='main'||state.screen==='maps')startBackdrop(version);
 if(state.screen==='characters'){
  if(retainedStage&&disposeCharacter){root.querySelector('.character-stage')!.replaceWith(retainedStage);disposeCharacter.updateCharacter(state.driver);}
  else startCharacter(version);
 }
}
function selectMap(map:MapId){if(state.map===map)return;state={...state,map};history.replaceState(null,'',`./index.html${menuQuery(state)}`);render();const card=root.querySelector<HTMLElement>(`[data-map="${map}"]`);card?.focus({preventScroll:true});card?.scrollIntoView?.({block:'nearest',inline:'nearest'});}
/** Update all setup-bearing links together after in-place edits and full renders. */
function refreshNavigationLinks(){
 const headerGarage=document.querySelector<HTMLAnchorElement>('.garage-header-link');if(headerGarage)headerGarage.href=garageEntry(state.driver,state);
 const wordmark=document.querySelector<HTMLAnchorElement>('.wordmark');if(wordmark)wordmark.href=`./index.html${menuQuery({...state,screen:'main'})}`;
 root.querySelector<HTMLAnchorElement>('#start-race')?.setAttribute('href',raceEntry(state.map,state.driver,state));
}
function bind(){
 root.querySelectorAll<HTMLImageElement>('.title-character,.title-logo').forEach(image=>{
  const settle=()=>{if(image.naturalWidth>0){if(root.querySelector('.title-logo')===image&&image.classList.contains('title-logo'))root.classList.add('title-logo-ready');}else image.hidden=true;};
  listen(image,'load',settle,{once:true});listen(image,'error',()=>{image.hidden=true;},{once:true});
  if(image.complete)settle();
 });
 const controlSelector=root.querySelector<HTMLSelectElement>('#menuControlMode');
 if(controlSelector){
  const disposeSelector=bindControlPreferenceSelect(document,controlSelector);
  const preferenceChanged=(event:Event)=>{
   const node=document.getElementById('settings-status'),saved=(event as CustomEvent<{saved:boolean}>).detail?.saved;
   if(node)node.textContent=saved===false?'操控方式本次已切换；此浏览器无法保存，下次打开可能恢复默认':'操控方式已保存，也可在比赛暂停菜单更改';
  };
  document.addEventListener?.(CONTROL_PREFERENCE_EVENT,preferenceChanged);
  disposeControlPreference=()=>{disposeSelector();document.removeEventListener?.(CONTROL_PREFERENCE_EVENT,preferenceChanged);};
 }
 listen(root.querySelector('#back-vehicle'),'click',vehicleBack);
 const refreshRaceOptions=()=>{
  history.replaceState(null,'',`./index.html${menuQuery(state)}`);
  refreshNavigationLinks();
 };
 root.querySelectorAll<HTMLInputElement>('[name="difficulty"]').forEach(input=>listen(input,'change',()=>{
  state={...state,...parseRaceOptions(new URLSearchParams({difficulty:input.value,seed:String(state.seed)}).toString())};refreshRaceOptions();
  const status=root.querySelector<HTMLElement>('#race-options-status');if(status)status.textContent=`已选择${state.difficulty==='easy'?'简单':state.difficulty==='hard'?'困难':'普通'}难度`;
 }));
 listen(root.querySelector<HTMLInputElement>('#race-seed'),'change',event=>{
  const input=event.target as HTMLInputElement,raw=input.value;
  state={...state,...parseRaceOptions(new URLSearchParams({difficulty:state.difficulty,seed:raw}).toString())};input.value=String(state.seed);refreshRaceOptions();
  const status=root.querySelector<HTMLElement>('#race-options-status');if(status)status.textContent=raw===String(state.seed)?'比赛种子已更新':'无效种子已恢复为默认值';
 });
 listen(root.querySelector('#confirm-map'),'click',()=>navigate('characters'));
 listen(root.querySelector('#story-button'),'click',()=>{
  if(!homeReady||root.querySelector('#story-dialog'))return;
  const dialog=document.createElement('section');dialog.id='story-dialog';dialog.className='story-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','story-heading');
  dialog.innerHTML='<h2 id="story-heading">故事模式开发中</h2><p>先来一场自由竞速吧</p><button id="close-story">返回</button>';
  root.querySelector('.title-screen')!.appendChild(dialog);const close=dialog.querySelector<HTMLButtonElement>('#close-story')!;listen(close,'click',closeStory);close.focus();
  listen(dialog,'keydown',event=>{if(event.key==='Tab'){event.preventDefault();close.focus();}});
 });
 root.querySelectorAll<HTMLElement>('[data-screen]').forEach(button=>listen(button,'click',()=>{if(state.screen==='main'&&!homeReady)return;const target=button.dataset.screen as MenuScreen;navigate(target,target==='settings'?{returnTo:state.screen==='maps'||state.screen==='characters'||state.screen==='vehicles'||state.screen==='race-settings'?state.screen:'main'}:{});}));
 root.querySelectorAll<HTMLElement>('[data-map]').forEach(button=>{
  listen(button,'click',()=>selectMap(button.dataset.map as MapId));
  listen(button,'keydown',event=>{
   const maps=MAP_MENU_ORDER,index=maps.indexOf(button.dataset.map as MapId);
   let next:number;
   if(event.key==='ArrowDown'||event.key==='ArrowRight')next=(index+1)%maps.length;
   else if(event.key==='ArrowUp'||event.key==='ArrowLeft')next=(index+maps.length-1)%maps.length;
   else if(event.key==='Home')next=0;
   else if(event.key==='End')next=maps.length-1;
   else return;
   event.preventDefault();selectMap(maps[next]);
  });
 });
 root.querySelectorAll<HTMLElement>('[data-driver]').forEach(button=>listen(button,'click',()=>{if(state.driver===button.dataset.driver)return;state.driver=resolveCharacter(button.dataset.driver).id;history.replaceState(null,'',`./index.html${menuQuery(state)}`);render();root.querySelector<HTMLElement>(`[data-driver="${state.driver}"]`)?.focus({preventScroll:true});}));
 disposeMusicSettings=bindMusicSettings(root,music);
 const status=(saved:boolean)=>{const node=document.getElementById('settings-status');if(node)node.textContent=saved?'已保存，下次进入赛道时生效':'此浏览器无法保存设置；重新进入赛道将使用默认值';};
 root.querySelectorAll<HTMLInputElement>('[name="quality"]').forEach(input=>listen(input,'change',()=>{settings={...settings,quality:input.value as Quality};status(saveGameSettings(settings));}));
 listen(root.querySelector<HTMLInputElement>('#refraction'),'change',event=>{settings={...settings,refraction:(event.target as HTMLInputElement).checked};status(saveGameSettings(settings));});
 listen(root.querySelector('#reset-settings'),'click',()=>{settings={version:1,quality:'balanced',refraction:true};const graphicsSaved=saveGameSettings(settings),controlSaved=setControlPreference(document,'auto');music?.setVolume(.65);music?.setMuted(false);render();status(graphicsSaved&&controlSaved);root.querySelector<HTMLElement>('#reset-settings')?.focus();});
}
function isMenuRoute(){return /\/(?:index\.html)?$/.test(location.pathname);}
function popState(){
 if(disposed||!isMenuRoute())return;
 state=parseMenuState(location.search);settings=readGameSettings();render();root.focus({preventScroll:true});
}
function keyDown(event:KeyboardEvent){
 if(disposed||!isMenuRoute()||event.key!=='Escape')return;
 if(root.querySelector('#story-dialog')){closeStory();return;}
 if(state.screen==='characters')navigate('maps');
 else if(state.screen==='vehicles')navigate('characters');
 else if(state.screen==='race-settings')vehicleBack();
 else if(state.screen==='settings')navigate(state.returnTo);
 else if(state.screen!=='main')navigate('main');
}
window.addEventListener('popstate',popState);window.addEventListener('keydown',keyDown);
const controller={dispose};mountedMenus.set(document,controller);
try{render();}catch(error){dispose();throw error;}
return controller;
}
