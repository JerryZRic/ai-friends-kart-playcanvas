import type {CharacterPreviewController} from './character-preview';
import {CHARACTER_PROFILES,resolveCharacter,characterTuning} from './character-profiles';
import {MAP_PROFILES,resolveMap,type MapId} from './map-profiles';
import {readGameSettings,saveGameSettings,type Quality} from './game-settings';
import {parseMenuState,menuQuery,raceEntry,type MenuScreen} from './menu-state';
const root=document.getElementById('menu')!;
let state=parseMenuState(location.search),settings=readGameSettings();
let disposeBackdrop:(()=>void)|undefined,disposeCharacter:CharacterPreviewController|undefined,renderVersion=0;
function closeStory(){root.querySelector('#story-dialog')?.remove();root.querySelector<HTMLElement>('#story-button')?.focus();}
function startBackdrop(version:number){
 const canvas=root.querySelector<HTMLCanvasElement>('#title-backdrop'),curtain=root.querySelector<HTMLElement>('#title-curtain');
 if(!canvas||!curtain||typeof canvas.getContext!=='function')return;
 void import('./menu-backdrop').then(({mountMenuBackdrop})=>{
  if(version!==renderVersion||(state.screen!=='main'&&state.screen!=='maps'))return;
  disposeBackdrop=mountMenuBackdrop(canvas,curtain,settings,state.screen==='maps'?{map:state.map,autoCycle:false}:undefined);
 }).catch(error=>console.error('Title background unavailable',error));
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
function top(title:string,sub:string,back:MenuScreen='main'){return `<div class="section-top"><button class="back text-button" data-screen="${back}">← 返回${back==='maps'?'地图选择':'主菜单'}</button><button class="text-button" data-screen="settings">画面设置 ↗</button></div><div class="section-heading"><p class="eyebrow">FREE PLAY / 自由模式</p><h1>${title}</h1><p>${sub}</p></div>`;}
function render(){
 const retainedStage=state.screen==='characters'&&root.className==='screen-characters'&&disposeCharacter?root.querySelector('.character-stage'):null;
 disposeBackdrop?.();disposeBackdrop=undefined;
 if(!retainedStage){disposeCharacter?.();disposeCharacter=undefined;}
 const version=++renderVersion;
 if(document.body)document.body.dataset.screen=state.screen;
 document.title=`${({main:'主菜单',maps:'选择地图',characters:'选择角色',settings:'游戏设置',exit:'休息一下'})[state.screen]} · 大肥鱼卡丁车`;
 root.className=`screen-${state.screen}`;
 if(state.screen==='main')root.innerHTML=`<section class="title-screen" aria-labelledby="game-title"><div class="title-background" aria-hidden="true"><canvas id="title-backdrop" tabindex="-1"></canvas><div id="title-curtain"></div><div class="title-shade"></div></div><h1 id="game-title">大肥鱼卡丁车</h1><nav class="title-actions" aria-label="游戏主菜单"><button id="story-button">故事模式</button><button data-screen="maps">自由模式</button><button data-screen="settings">设置</button><button data-screen="exit">退出</button></nav></section>`;
 if(state.screen==='maps'){
  const selected=resolveMap(state.map);
  root.innerHTML=top('选择赛道','')+`<section class="map-preview-layout"><div class="map-stage" aria-label="${selected.label} 3D 赛道预览"><canvas id="title-backdrop" aria-hidden="true" tabindex="-1"></canvas><div id="title-curtain" aria-hidden="true"></div><div class="map-stage-shade" aria-hidden="true"></div><div class="map-stage-caption"><p class="eyebrow">${selected.tag}</p><h2>${selected.label}</h2><p>${selected.description}</p></div></div><div class="map-choices" role="group" aria-label="选择地图">${Object.values(MAP_PROFILES).map(m=>`<button class="map-choice" data-map="${m.id}" aria-pressed="${m.id===state.map}"><strong>${m.label}</strong><span>${m.vehicle==='kart'?'卡丁车':'鲸鱼坐骑'}</span></button>`).join('')}</div><button class="primary map-confirm" id="confirm-map">确认地图，选择角色 →</button></section>`;
 }
 if(state.screen==='characters'){
 const map=resolveMap(state.map),selected=resolveCharacter(state.driver),t=characterTuning(selected.id,state.map);
 const stats=[['加速能力',selected.acceleration,t.acceleration,'m/s²'],['最高速度',selected.topSpeed,t.maxSpeed,'m/s'],[state.map==='waterpark'?'转向加速度':'转向横移能力',selected.steering,t.steering,state.map==='waterpark'?'m/s²':'m/s']];
 root.innerHTML=top('选一位出发伙伴',`${map.label} · ${map.vehicle==='kart'?'卡丁车':'鲸鱼坐骑'}　/　六名选手，同场竞速`,'maps')+`<div class="character-layout"><div class="character-roster"><div class="character-stage"><canvas id="character-preview" tabindex="0" aria-label="${selected.label} 3D 形象，可拖动旋转"></canvas><p id="character-preview-status" role="status" aria-live="polite">正在载入 ${selected.label} 的 3D 形象…</p></div><div class="character-grid" role="group" aria-label="选择参赛角色">${CHARACTER_PROFILES.map(c=>`<button class="character-card" style="--character:${c.color}" data-driver="${c.id}" aria-pressed="${c.id===selected.id}"><span class="character-symbol" aria-hidden="true">${c.symbol}</span><span class="character-name">${c.label}</span><span class="character-role">${c.nickname}</span><span class="selected-mark" aria-hidden="true">${c.id===selected.id?'✓':'+'}</span></button>`).join('')}<p class="roster-note">拖动上方角色旋转查看 · 方向键也可旋转</p></div></div><aside class="profile-panel" aria-label="已选角色属性" style="--character:${selected.color}"><p class="eyebrow">YOUR DRIVER / 已选伙伴</p><h2>${selected.label}</h2><p class="profile-role">${selected.nickname}</p><p class="profile-description">${selected.description}</p><div class="stats">${stats.map(([label,mult,value,unit])=>`<div class="stat"><div><span>${label}</span><strong>${Number(value).toFixed(2)} <small>${unit}</small></strong></div><meter min="0.85" max="1.15" value="${mult}" aria-label="${label}，标准值的 ${Math.round(Number(mult)*100)}%"></meter><span class="stat-percent">标准值 × ${Number(mult).toFixed(2)}</span></div>`).join('')}</div><p class="stats-note">${state.map==='waterpark'?'加速是阻力修正前的推进加速度；极速是基础速度上限。转向是横向加速度，实际横移受惯性与阻尼影响。':'基础参数，不含道具、漂移与地形修正。转向是正常极速下的横移速度，不是转弯角度。'}玩家与对手使用相同角色系数。</p><a class="primary start-race" id="start-race" href="${raceEntry(state.map,selected.id)}"><span>开始比赛</span><span>→</span></a><p class="fine-print">首次进入需要下载 3D 资源，请稍候</p></aside></div>`;
 }
 if(state.screen==='settings')root.innerHTML=`<div class="section-top"><button class="text-button" data-screen="${state.returnTo}">← 返回${state.returnTo==='characters'?'角色选择':state.returnTo==='maps'?'地图选择':'主菜单'}</button></div><div class="section-heading"><p class="eyebrow">MAKE IT YOURS</p><h1>游戏设置</h1><p>应用于接下来进入的赛道，自动保存在此浏览器</p></div><section class="settings-panel"><fieldset><legend>画面质量</legend><p>流畅档关闭阴影并降低渲染分辨率；精细档提高阴影清晰度</p><div class="quality-options">${[['low','流畅','低分辨率 · 无阴影'],['balanced','均衡','标准分辨率 · 标准阴影'],['high','精细','标准分辨率 · 精细阴影']].map(([q,name,desc])=>`<label><input type="radio" name="quality" value="${q}" ${settings.quality===q?'checked':''}><span><strong>${name}</strong><small>${desc}</small></span></label>`).join('')}</div></fieldset><div class="setting-row"><div><label for="refraction">水面折射</label><p>水上乐园的透水折射效果；关闭可减轻渲染负担</p></div><input type="checkbox" id="refraction" ${settings.refraction?'checked':''}></div><div class="setting-row muted-row"><div><strong>背景音乐</strong><p>暂未加入背景音乐，后续版本再见</p></div><span class="badge">待加入</span></div><section class="controls-guide" aria-label="操作说明"><h2>操作说明</h2><h3>日落海岸 · 卡丁车</h3><p>W / ↑ 油门 · S / ↓ 刹车与倒车<br>A / D 或 ← / → 转向 · 空格 刹车<br>Shift 漂移 · E 使用道具 · Z 切换视角<br>单击赛道后移动鼠标环顾 · Q 视角回正<br>Esc / P 暂停或继续</p><h3>晴空水上乐园 · 鲸鱼坐骑</h3><p>W / ↑ 油门 · S / ↓ 减速<br>A / D 或 ← / → 转向 · E 使用道具<br>Esc / P 暂停或继续 · R 重新比赛</p><p>触屏：使用赛道画面中的转向、油门、刹车及道具按钮。菜单可用 Tab 切换焦点、Enter 确认、Esc 返回。</p></section><p class="settings-status" id="settings-status" role="status" aria-live="polite">设置已载入</p><button class="text-button" id="reset-settings">恢复默认设置</button></section>`;
 if(state.screen==='exit')root.innerHTML=`<section class="exit-panel"><p class="eyebrow">SEE YOU AT THE START LINE</p><div class="exit-symbol" aria-hidden="true">☀</div><h1>休息一下，<br>随时再出发。</h1><p>已返回休息页面，没有比赛在后台运行。<br>你可以关闭此标签页退出游戏。</p><button class="primary" data-screen="main">返回主菜单 →</button></section>`;
 bind();
 if(state.screen==='main'||state.screen==='maps')startBackdrop(version);
 if(state.screen==='characters'){
  if(retainedStage&&disposeCharacter){root.querySelector('.character-stage')!.replaceWith(retainedStage);disposeCharacter.updateCharacter(state.driver);}
  else startCharacter(version);
 }
}
function selectMap(map:MapId){if(state.map===map)return;state={...state,map,driver:'whale'};history.replaceState(null,'',`./index.html${menuQuery(state)}`);render();root.querySelector<HTMLElement>(`[data-map="${map}"]`)?.focus({preventScroll:true});}
function bind(){
 root.querySelector('#confirm-map')?.addEventListener('click',()=>navigate('characters'));
 root.querySelector('#story-button')?.addEventListener('click',()=>{
  if(root.querySelector('#story-dialog'))return;
  const dialog=document.createElement('section');dialog.id='story-dialog';dialog.className='story-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','story-heading');
  dialog.innerHTML='<h2 id="story-heading">故事模式开发中</h2><p>先来一场自由竞速吧</p><button id="close-story">返回</button>';
  root.querySelector('.title-screen')!.appendChild(dialog);const close=dialog.querySelector<HTMLButtonElement>('#close-story')!;close.addEventListener('click',closeStory);close.focus();
  dialog.addEventListener('keydown',event=>{if(event.key==='Tab'){event.preventDefault();close.focus();}});
 });
 root.querySelectorAll<HTMLElement>('[data-screen]').forEach(button=>button.addEventListener('click',()=>{const target=button.dataset.screen as MenuScreen;navigate(target,target==='settings'?{returnTo:state.screen==='maps'||state.screen==='characters'?state.screen:'main'}:{});}));
 root.querySelectorAll<HTMLElement>('[data-map]').forEach(button=>button.addEventListener('click',()=>selectMap(button.dataset.map as MapId)));
 root.querySelectorAll<HTMLElement>('[data-driver]').forEach(button=>button.addEventListener('click',()=>{if(state.driver===button.dataset.driver)return;state.driver=resolveCharacter(button.dataset.driver).id;history.replaceState(null,'',`./index.html${menuQuery(state)}`);render();root.querySelector<HTMLElement>(`[data-driver="${state.driver}"]`)?.focus({preventScroll:true});}));
 const status=(saved:boolean)=>{const node=document.getElementById('settings-status');if(node)node.textContent=saved?'已保存，下次进入赛道时生效':'此浏览器无法保存设置；重新进入赛道将使用默认值';};
 root.querySelectorAll<HTMLInputElement>('[name="quality"]').forEach(input=>input.addEventListener('change',()=>{settings={...settings,quality:input.value as Quality};status(saveGameSettings(settings));}));
 root.querySelector<HTMLInputElement>('#refraction')?.addEventListener('change',event=>{settings={...settings,refraction:(event.target as HTMLInputElement).checked};status(saveGameSettings(settings));});
 root.querySelector('#reset-settings')?.addEventListener('click',()=>{settings={version:1,quality:'balanced',refraction:true};const saved=saveGameSettings(settings);render();status(saved);root.querySelector<HTMLElement>('#reset-settings')?.focus();});
}
window.addEventListener('popstate',()=>{state=parseMenuState(location.search);settings=readGameSettings();render();root.focus({preventScroll:true});});
window.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(root.querySelector('#story-dialog')){closeStory();return;}if(state.screen==='characters')navigate('maps');else if(state.screen==='settings')navigate(state.returnTo);else if(state.screen!=='main')navigate('main');});
render();
