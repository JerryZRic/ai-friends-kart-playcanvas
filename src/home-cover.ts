import {FALLBACK_HOME_COVER,type HomeCover} from './home-cover-registry';

/** Runtime-neutral contract. No Cubism SDK, proprietary Core or fake CSS rig is bundled. */
export interface HomeCoverRuntime {
 setPaused(paused:boolean):void;
 resize():void;
 dispose():void;
}
export interface HomeCoverAdapter {
 mount(canvas:HTMLCanvasElement,model:string,signal:AbortSignal):Promise<HomeCoverRuntime>;
}
export type HomeCoverAdapterLoader=()=>Promise<HomeCoverAdapter>;
export interface HomeCoverController {dispose():void;}
/** Lazy adapter starts only for an approved model, visible page and normal motion.
 * The static portrait stays visible until the adapter has rendered its first frame.
 * mount must reject on failure and honor AbortSignal during resource acquisition.
 */
export function mountHomeCover(image:HTMLImageElement,cover:HomeCover,loadAdapter?:HomeCoverAdapterLoader):HomeCoverController {
 const doc=image.ownerDocument,win=doc?.defaultView;
 const abort=new AbortController();
 let disposed=false,failed=false,loading=false,pageHidden=false,runtime:HomeCoverRuntime|undefined,canvas:HTMLCanvasElement|undefined;
 let fallback=cover.id===FALLBACK_HOME_COVER.id;
 const motion=win?.matchMedia?.('(prefers-reduced-motion: reduce)');
 image.dataset.coverId=cover.id;
 image.dataset.coverMode='static';
 const onImageError=()=>{
  if(disposed)return;
  if(!fallback){fallback=true;image.src=FALLBACK_HOME_COVER.src;image.dataset.coverId=FALLBACK_HOME_COVER.id;}
  else image.hidden=true;
 };
 image.addEventListener('error',onImageError);
 // A cached failure can finish before the menu binds its listener.
 if(image.complete&&image.naturalWidth===0)onImageError();
 function stopRuntime(){runtime?.dispose();runtime=undefined;canvas?.remove();canvas=undefined;image.hidden=false;image.dataset.coverMode='static';}
 function fail(){if(disposed)return;failed=true;abort.abort();stopRuntime();}
 async function sync(){
  if(disposed)return;
  const paused=!!doc?.hidden||pageHidden||!!motion?.matches;
  if(runtime){runtime.setPaused(paused);image.hidden=!paused;if(canvas)canvas.hidden=paused;return;}
  if(paused||failed||loading||!loadAdapter||!cover.approved||!cover.model||!win)return;
  loading=true;
  try{
   const adapter=await loadAdapter();
   if(disposed||abort.signal.aborted)return;
   canvas=doc.createElement('canvas');canvas.className='title-character title-character-live2d';canvas.setAttribute('aria-hidden','true');canvas.hidden=true;
   image.after(canvas);
   canvas.addEventListener('webglcontextlost',fail,{signal:abort.signal});
   const mounted=await adapter.mount(canvas,cover.model,abort.signal);
   if(disposed||abort.signal.aborted){mounted.dispose();return;}
   runtime=mounted;runtime.resize();image.dataset.coverMode='live2d';await sync();
  }catch{fail();}
 }
 function visibility(){void sync().catch(fail);}
 function pagehide(){pageHidden=true;visibility();}
 function pageshow(){pageHidden=false;visibility();}
 function resize(){try{runtime?.resize();}catch{fail();}}
 if(loadAdapter&&cover.approved&&cover.model){
  doc?.addEventListener('visibilitychange',visibility);
  win?.addEventListener('pagehide',pagehide);win?.addEventListener('pageshow',pageshow);win?.addEventListener('resize',resize);
  motion?.addEventListener('change',visibility);
  visibility();
 }
 return {dispose(){
  if(disposed)return;disposed=true;abort.abort();stopRuntime();
  image.removeEventListener('error',onImageError);
  doc?.removeEventListener('visibilitychange',visibility);
  win?.removeEventListener('pagehide',pagehide);win?.removeEventListener('pageshow',pageshow);win?.removeEventListener('resize',resize);
  motion?.removeEventListener('change',visibility);
 }};
}
