import {characterEmblem} from './character-identity.js';
import type {CharacterPreviewController} from './character-preview';
import type {MenuBackdropController} from './menu-backdrop';
import {mountUiLayout,mountUiViewportNotice} from './ui-layout';
import {CHARACTER_PROFILES,resolveCharacter,characterTuning} from './character-profiles';
import {MAP_PROFILES,resolveMap,type MapId} from './map-profiles';
import {readGameSettings,saveGameSettings,type Quality} from './game-settings';
import {parseMenuState,menuQuery,raceEntry,garageEntry,type MenuScreen} from './menu-state';
import {parseRaceOptions} from './race-options';
import {loadGarageState,buildParts,KART_SLOTS,SLOT_LABELS} from './kart-build';
declare global { interface Window { __menuBoot?: {releaseLayout?:()=>void;begin:(fallback?:()=>void)=>void;stage:(step:number,text:string)=>void;ready:()=>boolean;dismiss:()=>void;fail:(message:string)=>void}; } }
const root=document.getElementById('menu')!;
let homeReady=false;
function revealHome(version:number, fallback=false){
 if(version!==renderVersion||state.screen!=='main')return;
 if(!fallback&&window.__menuBoot?.ready()===false)return;
 homeReady=true;
 const nav=root.querySelector<HTMLElement>('.title-actions');
 if(nav){nav.hidden=false;nav.inert=false;nav.setAttribute('aria-hidden','false');}
 root.querySelectorAll<HTMLButtonElement>('.title-action').forEach(button=>{button.disabled=false;});
 if(fallback){const canvas=root.querySelector<HTMLElement>('#title-backdrop');if(canvas)canvas.hidden=true;const poster=root.querySelector<HTMLElement>('.title-fallback');if(poster)poster.hidden=false;root.querySelector<HTMLElement>('#story-button')?.focus();}
}

let state=parseMenuState(location.search),settings=readGameSettings();
let disposeBackdrop:MenuBackdropController|undefined,disposeCharacter:CharacterPreviewController|undefined,renderVersion=0;
const shell=document.getElementById('menu-ui')!;
window.__menuBoot?.releaseLayout?.();
const menuLayout=mountUiLayout(shell,()=>{disposeBackdrop?.resize();disposeCharacter?.resize();});
const viewportNotice=mountUiViewportNotice(shell);
let layoutDisposed=false;
function disposeMenuLayout(){
 if(layoutDisposed)return;
 layoutDisposed=true;renderVersion++;
 menuLayout.dispose();viewportNotice.dispose();disposeBackdrop?.();disposeCharacter?.();
 disposeBackdrop=undefined;disposeCharacter=undefined;
 window.removeEventListener('pagehide',pageHide);window.removeEventListener('pageshow',pageShow);
}
function pageHide(event:PageTransitionEvent){if(!event.persisted)disposeMenuLayout();}
function pageShow(){menuLayout.update();}
window.addEventListener('pagehide',pageHide);window.addEventListener('pageshow',pageShow);
if(import.meta.hot)import.meta.hot.dispose(disposeMenuLayout);
function closeStory(){root.querySelector('#story-dialog')?.remove();root.querySelector<HTMLElement>('#story-button')?.focus();}
function startBackdrop(version:number){
 const canvas=root.querySelector<HTMLCanvasElement>('#title-backdrop'),curtain=root.querySelector<HTMLElement>('#title-curtain');
 if(!canvas||!curtain)return;
 if(state.screen==='maps'){
  // Keep the route poster visible if WebGL is absent or temporarily loses its context.
  canvas.addEventListener('webglcontextlost',()=>{canvas.dataset.previewFallback='true';});
  canvas.addEventListener('webglcontextrestored',()=>{delete canvas.dataset.previewFallback;});
 }
 if(typeof canvas.getContext!=='function'){canvas.dataset.backdropState='unavailable';if(state.screen==='main'){if(window.__menuBoot)window.__menuBoot.fail('此设备暂时无法初始化 3D 背景');else revealHome(version,true);}return;}
 if(state.screen==='main')window.__menuBoot?.stage(2,'菜单程序已就绪，正在载入 3D 引擎…');
 void import('./menu-backdrop').then(async ({mountMenuBackdrop})=>{
  // Let the loading shell paint even when the engine chunk is already cached.
  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  if(version!==renderVersion||(state.screen!=='main'&&state.screen!=='maps')||(state.screen==='main'&&homeReady))return;
  if(state.screen==='main')window.__menuBoot?.stage(2,'菜单程序已就绪，正在启动 3D 引擎…');
  disposeBackdrop=mountMenuBackdrop(canvas,curtain,settings,state.screen==='maps'?{map:state.map,autoCycle:false,presentation:'map-preview'}:{presentation:'cover'},undefined,{
   onStage:stage=>{if(version===renderVersion&&state.screen==='main')window.__menuBoot?.stage(stage==='scene'?3:4,stage==='scene'?'正在准备首页场景与材质…':'正在绘制首页画面…');},
   onReady:()=>revealHome(version),
   onError:()=>{if(version===renderVersion&&state.screen==='main')window.__menuBoot?.fail('3D 背景暂时无法显示');},
  });
 }).catch(error=>{if(version===renderVersion){canvas.dataset.backdropState='unavailable';if(state.screen==='main')window.__menuBoot?.fail('3D 引擎加载失败，请检查网络后重试');}console.error('Title background unavailable',error);});
}
function startCharacter(version:number){
 const canvas=root.querySelector<HTMLCanvasElement>('#character-preview'),status=root.querySelector<HTMLElement>('#character-preview-status');
 if(!canvas||!status||typeof canvas.getContext!=='function')return;
 void import('./character-preview').then(({mountCharacterPreview})=>{
  if(version!==renderVersion||state.screen!=='characters')return;
  disposeCharacter=mountCharacterPreview(canvas,status,state.driver);
 }).catch(error=>{if(version===renderVersion)status.textContent='3D 预览暂时不可用';console.error('Character preview unavailable',error);});
}
function navigate(screen:MenuScreen,updates:Partial<typeof state>={}){state={...state,...updates,screen};history.pushState(null,'',`./index.html${menuQuery(state)}`);render();root.focus({preventScroll:true});window.scrollTo({top:0});}
function screenLabel(screen:MenuScreen){return ({main:'主菜单',maps:'地图选择',characters:'角色选择',vehicles:'坐骑选择','race-settings':'比赛设置',settings:'画面设置',exit:'休息页面'})[screen];}
function vehicleBack(){if(state.map==='coast')location.href=garageEntry(state.driver,state);else navigate('vehicles');}
function top(title:string,sub:string,back:MenuScreen='main',vehicle=false){return `<div class="section-top"><button class="back text-button" ${vehicle?'id="back-vehicle"':`data-screen="${back}"`}>← 返回${vehicle?(state.map==='coast'?'卡丁车 / 改装车库':'坐骑选择'):screenLabel(back)}</button><button class="text-button" data-screen="settings">画面设置 ↗</button></div><div class="section-heading"><p class="eyebrow">FREE PLAY / 自由模式</p><h1>${title}</h1><p>${sub}</p></div>`;}
function render(){
 const retainedStage=state.screen==='characters'&&root.className==='screen-characters'&&disposeCharacter?root.querySelector('.character-stage'):null;
 disposeBackdrop?.();disposeBackdrop=undefined;
 if(!retainedStage){disposeCharacter?.();disposeCharacter=undefined;}
 const version=++renderVersion;
 homeReady=false;
 if(state.screen==='main')window.__menuBoot?.begin(()=>{if(version!==renderVersion)return;disposeBackdrop?.();disposeBackdrop=undefined;revealHome(version,true);});
 else window.__menuBoot?.dismiss();
 if(document.body)document.body.dataset.screen=state.screen;
 document.title=`${screenLabel(state.screen)} · 大肥鱼卡丁车`;
 root.className=`screen-${state.screen}`;
 if(state.screen==='main')root.innerHTML=`<section class="title-screen" aria-labelledby="game-title"><div class="title-background" aria-hidden="true"><img class="title-fallback" src="./map-previews/waterpark-overview.webp" alt="" hidden><canvas id="title-backdrop" tabindex="-1"></canvas><div id="title-curtain"></div><div class="title-shade"></div></div><h1 id="game-title">大肥鱼卡丁车</h1><nav class="title-actions" aria-label="游戏主菜单" aria-hidden="true" hidden inert><button class="title-action" id="story-button" disabled>故事模式</button><button class="title-action" data-screen="maps" disabled>自由模式</button><button class="title-action" data-screen="settings" disabled>设置</button><button class="title-action" data-screen="exit" disabled>退出</button></nav></section>`;
 if(state.screen==='maps'){
  const selected=resolveMap(state.map);
  root.innerHTML=top('选择赛道','从海岸公路到晴空水道，下一站由你决定')+`
   <section class="map-preview-layout" aria-label="赛道选择与预览">
    <aside class="map-library" aria-labelledby="map-library-heading">
     <div class="map-library-heading"><h2 id="map-library-heading">赛道一览</h2><span>02 COURSES</span></div>
     <div class="map-choices" role="group" aria-label="选择地图" aria-describedby="map-keyboard-hint">${Object.values(MAP_PROFILES).map((m,index)=>`
      <button class="map-choice" data-map="${m.id}" aria-pressed="${m.id===state.map}" tabindex="${m.id===state.map?'0':'-1'}" aria-label="${m.label}，${m.vehicle==='kart'?'卡丁车':'鲸鱼坐骑'}">
       <span class="map-choice-visual">
        <img class="map-overview" src="./map-previews/${m.id}-overview.webp" alt="${m.label}的 3D 俯视全景，展示完整赛道路线" width="1280" height="720" decoding="async">
        <span class="map-choice-number" aria-hidden="true">0${index+1}</span>
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
 root.innerHTML=top('选一位出发伙伴',`${map.label} · ${map.vehicle==='kart'?'卡丁车':'鲸鱼坐骑'}　/　六名选手，同场竞速`,'maps')+`<div class="character-layout"><div class="character-roster"><div class="character-stage"><canvas id="character-preview" tabindex="0" aria-label="${selected.label} 3D 形象，可拖动旋转"></canvas><p id="character-preview-status" role="status" aria-live="polite">正在载入 ${selected.label} 的 3D 形象…</p></div><div class="character-grid" role="group" aria-label="选择参赛角色">${CHARACTER_PROFILES.map(c=>`<button class="character-card" style="--character:${c.color}" data-driver="${c.id}" aria-pressed="${c.id===selected.id}"><span class="character-symbol" aria-hidden="true">${characterEmblem(c.id)}</span><span class="character-name">${c.label}</span><span class="character-role">${c.nickname}</span><span class="selected-mark" aria-hidden="true">${c.id===selected.id?'✓':'+'}</span></button>`).join('')}<p class="roster-note">拖动上方角色旋转查看 · 方向键也可旋转</p></div></div><aside class="profile-panel" aria-label="已选角色属性" style="--character:${selected.color}"><p class="eyebrow">YOUR DRIVER / 已选伙伴</p><h2>${selected.label}</h2><p class="profile-role">${selected.nickname}</p><p class="profile-description">${selected.description}</p><div class="stats">${stats.map(([label,mult,value,unit])=>`<div class="stat"><div><span>${label}</span><strong>${Number(value).toFixed(2)} <small>${unit}</small></strong></div><meter min="0.85" max="1.15" value="${mult}" aria-label="${label}，标准值的 ${Math.round(Number(mult)*100)}%"></meter><span class="stat-percent">标准值 × ${Number(mult).toFixed(2)}</span></div>`).join('')}</div><p class="stats-note">${state.map==='waterpark'?'加速是阻力修正前的推进加速度；极速是基础速度上限。转向是横向加速度，实际横移受惯性与阻尼影响。':'基础参数，不含道具、漂移与地形修正。转向是正常极速下的横移速度，不是转弯角度。'}玩家与对手使用相同角色系数。</p><p class="flow-step">02 / 04 · 下一步：${state.map==='coast'?'选择卡丁车与改装':'确认水上坐骑'}</p>${state.map==='coast'?`<a class="primary start-race" id="choose-vehicle" href="${garageEntry(selected.id,state)}"><span>选择卡丁车 / 改装车库</span><span>→</span></a>`:`<button class="primary start-race" id="choose-vehicle" data-screen="vehicles"><span>选择水上坐骑</span><span>→</span></button>`}<p class="fine-print">角色与车辆独立选择，可随时返回调整</p></aside></div>`;
 }
 if(state.screen==='vehicles'&&state.map==='coast'){root.innerHTML=top('选择卡丁车',`${resolveMap(state.map).label} · 第 3 / 4 步`,'characters')+`<section class="settings-panel"><h2>卡丁车 / 改装车库</h2><p>选择整车预设，再自由调整六个零件。</p><a class="primary start-race" href="${garageEntry(state.driver,state)}">进入车库 →</a></section>`;}
 if(state.screen==='vehicles'&&state.map==='waterpark'){
  root.innerHTML=top('确认水上坐骑',`${resolveMap(state.map).label} · 第 3 / 4 步`,'characters')+`<section class="settings-panel vehicle-panel"><p class="eyebrow">WATER MOUNT / 水上专属</p><div class="mount-symbol" aria-hidden="true">≈</div><h2>鲸鱼坐骑</h2><p>当前水上赛道使用鲸鱼坐骑，保留水面惯性与滑移手感。</p><p>出发伙伴：${resolveCharacter(state.driver).label}</p><button class="primary start-race" data-screen="race-settings">确认坐骑，设置比赛 →</button></section>`;
 }
 if(state.screen==='race-settings'){
  // Snapshot storage once, so returning or changing graphics cannot swap the car.
  if(state.map==='coast'&&!state.kart){state.kart=JSON.stringify(loadGarageState().activeBuild);history.replaceState(null,'',`./index.html${menuQuery(state)}`);}
  const selectedParts=state.map==='coast'?buildParts(JSON.parse(state.kart!)):undefined;
  const vehicleSummary=selectedParts?`<section class="race-build-summary" aria-label="已选卡丁车"><h2>已选卡丁车</h2><dl>${KART_SLOTS.map(slot=>`<div><dt>${SLOT_LABELS[slot]}</dt><dd>${selectedParts[slot].name}</dd></div>`).join('')}</dl></section>`:'<section class="race-build-summary" aria-label="已选坐骑"><h2>已选坐骑</h2><p>鲸鱼坐骑 · 水面惯性与滑移</p></section>';
  root.innerHTML=top('比赛设置',`${resolveMap(state.map).label} · ${resolveCharacter(state.driver).label} · 第 4 / 4 步`,'characters',true)+`<section class="settings-panel race-options-panel">${vehicleSummary}<fieldset><legend>对手难度</legend><p>只改变 NPC 的驾驶水平；对手与玩家使用相同规则。</p><div class="quality-options">${[['easy','简单','轻松熟悉赛道'],['normal','普通','标准驾驶水平'],['hard','困难','更熟练的路线与操作']].map(([value,label,description])=>`<label><input type="radio" name="difficulty" value="${value}" ${state.difficulty===value?'checked':''}><span><strong>${label}</strong><small>${description}</small></span></label>`).join('')}</div></fieldset><div class="setting-row"><div><label for="race-seed">比赛种子</label><p>相同种子可重现对手配置，范围 0–4294967295</p></div><input id="race-seed" type="number" min="0" max="4294967295" step="1" value="${state.seed}" inputmode="numeric"></div><p id="race-options-status" role="status" aria-live="polite">已选择${state.difficulty==='easy'?'简单':state.difficulty==='hard'?'困难':'普通'}难度</p><a class="primary start-race" id="start-race" href="${raceEntry(state.map,state.driver,state)}"><span>开始比赛</span><span>→</span></a><p class="fine-print">首次进入需要下载 3D 资源，请稍候</p></section>`;
 }
 if(state.screen==='settings')root.innerHTML=`<div class="section-top"><button class="text-button" data-screen="${state.returnTo}">← 返回${screenLabel(state.returnTo)}</button></div><div class="section-heading"><p class="eyebrow">MAKE IT YOURS</p><h1>游戏设置</h1><p>应用于接下来进入的赛道，自动保存在此浏览器</p></div><section class="settings-panel" tabindex="0" aria-label="画面设置与操作说明"><fieldset><legend>画面质量</legend><p>流畅档关闭阴影并降低渲染分辨率；精细档提高阴影清晰度</p><div class="quality-options">${[['low','流畅','低分辨率 · 无阴影'],['balanced','均衡','标准分辨率 · 标准阴影'],['high','精细','标准分辨率 · 精细阴影']].map(([q,name,desc])=>`<label><input type="radio" name="quality" value="${q}" ${settings.quality===q?'checked':''}><span><strong>${name}</strong><small>${desc}</small></span></label>`).join('')}</div></fieldset><div class="setting-row"><div><label for="refraction">水面折射</label><p>水上乐园的透水折射效果；关闭可减轻渲染负担</p></div><input type="checkbox" id="refraction" ${settings.refraction?'checked':''}></div><div class="setting-row muted-row"><div><strong>背景音乐</strong><p>暂未加入背景音乐，后续版本再见</p></div><span class="badge">待加入</span></div><section class="controls-guide" aria-label="操作说明"><h2>操作说明</h2><h3>所有赛道 · 统一操作</h3><p>W / ↑ 油门 · S / ↓ 刹车与倒车<br>A / D 或 ← / → 转向 · 空格 刹车<br>Shift 漂移 / 水上滑移蓄力 · E 使用道具<br>Z / C 切换视角 · 按住鼠标右键回看<br>单击赛道后移动鼠标环顾 · Q 视角回正<br>Esc 暂停并释放鼠标 · P 暂停或继续</p><p>海岸卡丁车抓地转向；水上坐骑保留惯性与阻尼。相同按键与界面，不同驾驶手感。</p><p>触屏：使用赛道画面中的转向、油门、刹车及道具按钮。菜单可用 Tab 切换焦点、Enter 确认、Esc 返回。</p></section><p class="settings-status" id="settings-status" role="status" aria-live="polite">设置已载入</p><button class="text-button" id="reset-settings">恢复默认设置</button></section>`;
 if(state.screen==='exit')root.innerHTML=`<section class="exit-panel"><p class="eyebrow">SEE YOU AT THE START LINE</p><div class="exit-symbol" aria-hidden="true">☀</div><h1>休息一下，<br>随时再出发。</h1><p>已返回休息页面，没有比赛在后台运行。<br>你可以关闭此标签页退出游戏。</p><button class="primary" data-screen="main">返回主菜单 →</button></section>`;
 refreshNavigationLinks();
 bind();
 if(state.screen==='main'||state.screen==='maps')startBackdrop(version);
 if(state.screen==='characters'){
  if(retainedStage&&disposeCharacter){root.querySelector('.character-stage')!.replaceWith(retainedStage);disposeCharacter.updateCharacter(state.driver);}
  else startCharacter(version);
 }
}
function selectMap(map:MapId){if(state.map===map)return;state={...state,map};history.replaceState(null,'',`./index.html${menuQuery(state)}`);render();root.querySelector<HTMLElement>(`[data-map="${map}"]`)?.focus({preventScroll:true});}
/** Update all setup-bearing links together after in-place edits and full renders. */
function refreshNavigationLinks(){
 const headerGarage=document.querySelector<HTMLAnchorElement>('.garage-header-link');if(headerGarage)headerGarage.href=garageEntry(state.driver,state);
 const wordmark=document.querySelector<HTMLAnchorElement>('.wordmark');if(wordmark)wordmark.href=`./index.html${menuQuery({...state,screen:'main'})}`;
 root.querySelector<HTMLAnchorElement>('#start-race')?.setAttribute('href',raceEntry(state.map,state.driver,state));
}
function bind(){
 root.querySelector('#back-vehicle')?.addEventListener('click',vehicleBack);
 const refreshRaceOptions=()=>{
  history.replaceState(null,'',`./index.html${menuQuery(state)}`);
  refreshNavigationLinks();
 };
 root.querySelectorAll<HTMLInputElement>('[name="difficulty"]').forEach(input=>input.addEventListener('change',()=>{
  state={...state,...parseRaceOptions(new URLSearchParams({difficulty:input.value,seed:String(state.seed)}).toString())};refreshRaceOptions();
  const status=root.querySelector<HTMLElement>('#race-options-status');if(status)status.textContent=`已选择${state.difficulty==='easy'?'简单':state.difficulty==='hard'?'困难':'普通'}难度`;
 }));
 root.querySelector<HTMLInputElement>('#race-seed')?.addEventListener('change',event=>{
  const input=event.target as HTMLInputElement,raw=input.value;
  state={...state,...parseRaceOptions(new URLSearchParams({difficulty:state.difficulty,seed:raw}).toString())};input.value=String(state.seed);refreshRaceOptions();
  const status=root.querySelector<HTMLElement>('#race-options-status');if(status)status.textContent=raw===String(state.seed)?'比赛种子已更新':'无效种子已恢复为默认值';
 });
 root.querySelector('#confirm-map')?.addEventListener('click',()=>navigate('characters'));
 root.querySelector('#story-button')?.addEventListener('click',()=>{
  if(!homeReady||root.querySelector('#story-dialog'))return;
  const dialog=document.createElement('section');dialog.id='story-dialog';dialog.className='story-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','story-heading');
  dialog.innerHTML='<h2 id="story-heading">故事模式开发中</h2><p>先来一场自由竞速吧</p><button id="close-story">返回</button>';
  root.querySelector('.title-screen')!.appendChild(dialog);const close=dialog.querySelector<HTMLButtonElement>('#close-story')!;close.addEventListener('click',closeStory);close.focus();
  dialog.addEventListener('keydown',event=>{if(event.key==='Tab'){event.preventDefault();close.focus();}});
 });
 root.querySelectorAll<HTMLElement>('[data-screen]').forEach(button=>button.addEventListener('click',()=>{if(state.screen==='main'&&!homeReady)return;const target=button.dataset.screen as MenuScreen;navigate(target,target==='settings'?{returnTo:state.screen==='maps'||state.screen==='characters'||state.screen==='vehicles'||state.screen==='race-settings'?state.screen:'main'}:{});}));
 root.querySelectorAll<HTMLElement>('[data-map]').forEach(button=>{
  button.addEventListener('click',()=>selectMap(button.dataset.map as MapId));
  button.addEventListener('keydown',event=>{
   const maps=Object.keys(MAP_PROFILES) as MapId[],index=maps.indexOf(button.dataset.map as MapId);
   let next:number;
   if(event.key==='ArrowDown'||event.key==='ArrowRight')next=(index+1)%maps.length;
   else if(event.key==='ArrowUp'||event.key==='ArrowLeft')next=(index+maps.length-1)%maps.length;
   else if(event.key==='Home')next=0;
   else if(event.key==='End')next=maps.length-1;
   else return;
   event.preventDefault();selectMap(maps[next]);
  });
 });
 root.querySelectorAll<HTMLElement>('[data-driver]').forEach(button=>button.addEventListener('click',()=>{if(state.driver===button.dataset.driver)return;state.driver=resolveCharacter(button.dataset.driver).id;history.replaceState(null,'',`./index.html${menuQuery(state)}`);render();root.querySelector<HTMLElement>(`[data-driver="${state.driver}"]`)?.focus({preventScroll:true});}));
 const status=(saved:boolean)=>{const node=document.getElementById('settings-status');if(node)node.textContent=saved?'已保存，下次进入赛道时生效':'此浏览器无法保存设置；重新进入赛道将使用默认值';};
 root.querySelectorAll<HTMLInputElement>('[name="quality"]').forEach(input=>input.addEventListener('change',()=>{settings={...settings,quality:input.value as Quality};status(saveGameSettings(settings));}));
 root.querySelector<HTMLInputElement>('#refraction')?.addEventListener('change',event=>{settings={...settings,refraction:(event.target as HTMLInputElement).checked};status(saveGameSettings(settings));});
 root.querySelector('#reset-settings')?.addEventListener('click',()=>{settings={version:1,quality:'balanced',refraction:true};const saved=saveGameSettings(settings);render();status(saved);root.querySelector<HTMLElement>('#reset-settings')?.focus();});
}
window.addEventListener('popstate',()=>{state=parseMenuState(location.search);settings=readGameSettings();render();root.focus({preventScroll:true});});
window.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(root.querySelector('#story-dialog')){closeStory();return;}if(state.screen==='characters')navigate('maps');else if(state.screen==='vehicles')navigate('characters');else if(state.screen==='race-settings')vehicleBack();else if(state.screen==='settings')navigate(state.returnTo);else if(state.screen!=='main')navigate('main');});
render();
