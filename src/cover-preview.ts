import './title-menu.css';
import './cover-preview.css';
import {HOME_COVERS,getDocumentHomeCover} from './home-cover-registry';
import {mountHomeCover} from './home-cover';
const root=document.getElementById('menu')!;
const requested=new URLSearchParams(location.search).get('cover');
const cover=HOME_COVERS.find(x=>x.approved&&x.id===requested)??getDocumentHomeCover(document);
root.innerHTML=`<section class="title-screen" aria-labelledby="game-title"><div class="title-background" aria-hidden="true"><img src="./map-previews/waterpark-overview.webp" class="preview-scenery" alt=""><div class="title-shade"></div></div><div class="title-stage"><div class="title-composition" aria-hidden="true"><div class="title-portrait-frame"><img class="title-character" src="${cover.src}" alt="" draggable="false" decoding="async"></div><img class="title-logo" src="./menu-art/title-logo.png" alt="" draggable="false"></div><h1 id="game-title">大肥鱼卡丁车</h1><nav class="title-actions" aria-label="游戏主菜单"><button data-screen="main">故事模式</button><button data-screen="maps" data-primary="true">自由模式</button><button data-screen="settings">设置</button><button data-screen="exit">退出</button></nav></div></section>`;
const controller=mountHomeCover(root.querySelector<HTMLImageElement>('.title-character')!,cover);
const logo=root.querySelector<HTMLImageElement>('.title-logo')!;
logo.addEventListener('load',()=>root.classList.add('title-logo-ready'));
if(logo.complete&&logo.naturalWidth)root.classList.add('title-logo-ready');
const shell=document.getElementById('menu-ui')!;
function resize(){const width=innerWidth,height=innerHeight;shell.style.setProperty('--title-scale',String(Math.min(width/1600,height/900)));shell.style.setProperty('--title-center-x',`${width/2}px`);shell.style.setProperty('--title-center-y',`${height/2}px`);}
window.addEventListener('resize',resize);resize();
const selector=document.querySelector<HTMLSelectElement>('#preview-character')!;
const names={deepseek:'大肥鱼',gemini:'Gemini',gpt:'GPT',claude:'Claude',grok:'Grok',glm:'GLM'};
for(const item of HOME_COVERS){const option=document.createElement('option');option.value=item.id;option.textContent=names[item.id];selector.append(option);}
selector.value=requested??'';
selector.addEventListener('change',()=>{const url=new URL(location.href);selector.value?url.searchParams.set('cover',selector.value):url.searchParams.delete('cover');location.href=url.href;});
root.querySelectorAll<HTMLButtonElement>('[data-screen]').forEach(button=>button.addEventListener('click',()=>{location.href=`../dev/index.html?screen=${button.dataset.screen}`;}));
window.addEventListener('pagehide',()=>controller.dispose(),{once:true});
