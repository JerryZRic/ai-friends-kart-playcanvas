import {mountBuildVersion} from './build-version';
import {mountBrandIntro,readyBrandIntro,failBrandIntro,brandIntroPending} from './brand-intro';
import {sceneForUrl,type SceneKind} from './scene-routes';
import {getDocumentMusic,registerSceneNavigator} from './music-ui';
import menuHtml from '../index.html?raw';
import garageHtml from '../garage.html?raw';
import landHtml from '../coast.html?raw';
import waterHtml from '../waterpark.html?raw';
import menuCss from './menu.css?inline';
import uiCss from './ui-layout.css?inline';
import menuFixedCss from './menu-fixed.css?inline';
import titleCss from './title-menu.css?inline';
import emblemCss from './character-emblems.css?inline';
import garageCss from './kart-garage-fixed.css?inline';
import garageStatsCss from './kart-garage-stats.css?inline';
import garageCarsCss from './kart-whole-cars.css?inline';
import raceCss from './race-ui.css?inline';

type Scene = SceneKind;
type Handle = {dispose():void};
const directory=new URL('./',location.href);
const coldRecovery=document.getElementById('startup-recovery');
function releaseColdRecovery(){(window as Window & {__releaseColdRecovery?:()=>void}).__releaseColdRecovery?.();coldRecovery?.remove();}
const music=getDocumentMusic(document,undefined,!/\/(?:coast|waterpark)\.html$/.test(location.pathname));
const introOverlay=document.getElementById('brand-intro');
const sceneRoot=document.createElement('div');sceneRoot.id='app-scene';sceneRoot.style.display='contents';
sceneRoot.inert=!!introOverlay;
if(introOverlay)music?.setPresentationReady?.(false);
// The overlay stays outside scene replacements while real resources load beneath it.
document.body.append(sceneRoot);
for(const node of [...document.body.childNodes])if(node!==sceneRoot&&node!==introOverlay&&node!==coldRecovery)node.remove();
mountBuildVersion(document);
const intro=mountBrandIntro(document,window,()=>{sceneRoot.inert=false;music?.setPresentationReady?.(true);});
const templates={menu:menuHtml,garage:garageHtml,land:landHtml,water:waterHtml};
const css={menu:menuCss+uiCss+menuFixedCss+emblemCss+titleCss,garage:uiCss+garageCss+garageStatsCss+emblemCss+garageCarsCss,land:raceCss+emblemCss,water:raceCss+emblemCss};
const style=document.createElement('style');style.dataset.sceneStyles='true';
for(const node of document.head.querySelectorAll('link[rel="stylesheet"],style:not([data-brand-intro-style])'))node.remove();
document.head.append(style);
let active:Handle|undefined,kind:Scene|undefined,version=0,disposed=false;
const sceneFor=(url:URL)=>sceneForUrl(url,directory);

function loading(url:URL,error?:unknown){
 document.body.className='';for(const key of Object.keys(document.body.dataset))delete document.body.dataset[key];
 style.textContent='html,body{margin:0;width:100%;height:100%;background:#123641;color:#fff5dd;font:18px system-ui}#scene-loading{position:fixed;inset:0;display:grid;place-content:center;text-align:center;gap:16px}#scene-loading .game-nav{display:inline-flex;align-items:center;justify-content:center;gap:12px;justify-self:center;min-height:54px;min-width:168px;padding:12px 20px;border:1px solid #dce7ba77;border-radius:13px;background:linear-gradient(#335250,#1a383f);box-shadow:inset 0 1px 0 #f7f1d526,0 4px 0 #071d26;color:#fff0c9;font:750 15px/1.2 system-ui;cursor:pointer;touch-action:manipulation}#scene-loading .game-nav svg{width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}#scene-loading .game-nav:hover{background:#365c57;border-color:#f5ebbd}#scene-loading .game-nav:active{transform:translateY(3px);box-shadow:inset 0 2px 5px #071d2666,0 1px 0 #071d26}#scene-loading .game-nav:focus-visible{outline:3px solid #d5ff60;outline-offset:5px}';
 const panel=document.createElement('main');panel.id='scene-loading';panel.setAttribute('role','status');
 const text=document.createElement('p');text.textContent=error?'场景暂时无法载入，请重试':'正在切换场景…';panel.append(text);
 if(error){const detail=document.createElement('small');detail.textContent=String(error instanceof Error?error.message:error).slice(0,180);panel.append(detail);const retry=document.createElement('button');retry.className='game-nav';retry.textContent='重新加载';retry.onclick=()=>void show(url,false);panel.append(retry);}
 const back=document.createElement('button');back.className='game-nav';back.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9"/></svg><span>返回主菜单</span>';back.onclick=()=>navigate(new URL('index.html',directory).href);panel.append(back);sceneRoot.replaceChildren(panel);back.focus();
}
function mountMarkup(next:Scene){
 const parsed=new DOMParser().parseFromString(templates[next],'text/html');
 for(const script of parsed.querySelectorAll('script,noscript,[data-brand-intro],[data-cold-recovery]'))script.remove();
 style.textContent=css[next]+Array.from(parsed.head.querySelectorAll('style:not([data-brand-intro-style])'),s=>s.textContent??'').join('\n');
 document.body.className=parsed.body.className;for(const key of Object.keys(document.body.dataset))delete document.body.dataset[key];
 for(const [key,value] of Object.entries(parsed.body.dataset))document.body.dataset[key]=value;
 sceneRoot.replaceChildren(...Array.from(parsed.body.childNodes).map(node=>document.importNode(node,true)));
 document.title=parsed.title;window.scrollTo({top:0});
}
async function show(url:URL,push:boolean){
 const next=sceneFor(url);if(!next||disposed)return;
 const token=++version;
 // Stop the old scene before starting another renderer; music is owned here.
 active?.dispose();active=undefined;
 const previous=kind;kind=next;
 if(push)history.pushState(null,'',url.href);
 loading(url);
 try{
  if(next==='land'||next==='water'){
   await music?.fadeOut(500);if(token!==version||disposed)return;music?.silence();
  }else if(previous!==undefined){music?.setPhase('menu');}
  if(next==='menu'){
   const {mountMenu}=await import('./menu');if(token!==version||disposed)return;mountMarkup(next);active=mountMenu();
  }else if(next==='garage'){
   const {mountKartGarage}=await import('./kart-garage');if(token!==version||disposed)return;mountMarkup(next);active=mountKartGarage(document.getElementById('kart-garage')!);music?.setPhase('menu');
  }else if(next==='land'){
   const {mountLandRace}=await import('./game');if(token!==version||disposed)return;mountMarkup(next);active=mountLandRace();
  }else{
   const {mountWaterRace}=await import('./waterpark-play');if(token!==version||disposed)return;mountMarkup(next);active=mountWaterRace();
  }
  // Each mounted scene now owns its real loader/retry UI. Until then the
  // original cold-load watchdog stays available even if a lazy import stalls.
  releaseColdRecovery();
  if(next!=='menu'&&brandIntroPending(document))requestAnimationFrame(()=>requestAnimationFrame(()=>{if(token===version&&!disposed)readyBrandIntro(document);}));
 }catch(error){if(token!==version||disposed)return;active?.dispose();active=undefined;console.error('Scene unavailable',error);loading(url,error);releaseColdRecovery();failBrandIntro(document);}
}
function navigate(href:string):boolean{const url=new URL(href,location.href);if(!sceneFor(url))return false;void show(url,true);return true;}
const releaseNavigator=registerSceneNavigator(document,navigate);
const click=(event:MouseEvent)=>{
 if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const anchor=(event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement|null;
 if(!anchor||anchor.download||anchor.target&&anchor.target!=='_self')return;
 if(navigate(anchor.href))event.preventDefault();
};
const pop=(event:PopStateEvent)=>{
 const url=new URL(location.href),next=sceneFor(url);
 if(kind==='menu'&&next==='menu'&&active)return; // Menu owns its internal screens.
 event.stopImmediatePropagation();void show(url,false);
};
document.addEventListener('click',click);window.addEventListener('popstate',pop);
function dispose(){if(disposed)return;disposed=true;version++;releaseColdRecovery();active?.dispose();active=undefined;releaseNavigator();music?.dispose();intro.dispose();document.removeEventListener('click',click);window.removeEventListener('popstate',pop);}
window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();});
if(import.meta.hot)import.meta.hot.dispose(dispose);
void show(new URL(location.href),false);
