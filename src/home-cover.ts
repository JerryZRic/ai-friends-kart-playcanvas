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
export interface HomeCoverController {dispose():void;setAnimationEnabled(enabled:boolean):void;}
/** Lazy adapter starts only for an approved model, visible page and normal motion.
 * The static portrait stays visible until the adapter has rendered its first frame.
 * mount must reject on failure and honor AbortSignal during resource acquisition.
 */
export function mountHomeCover(image:HTMLImageElement,cover:HomeCover,loadAdapter?:HomeCoverAdapterLoader,options:{enabled?:boolean}={}):HomeCoverController {
 const doc=image.ownerDocument,win=doc?.defaultView;
 const abort=new AbortController();
 let enabled=options.enabled!==false,staticFailed=false;
 let disposed=false,failed=false,loading=false,pageHidden=false,runtime:HomeCoverRuntime|undefined,canvas:HTMLCanvasElement|undefined;
 let fallback=cover.id===FALLBACK_HOME_COVER.id;
 const motion=win?.matchMedia?.('(prefers-reduced-motion: reduce)');
 const setFraming=(entry:HomeCover)=>{const f=entry.framing;image.style?.setProperty('--portrait-scale',String(f?.scale??1));image.style?.setProperty('--portrait-x',`${f?.x??0}%`);image.style?.setProperty('--portrait-y',`${f?.y??0}%`);};
 setFraming(cover);
 image.dataset.coverId=cover.id;
 image.dataset.coverMode='static';
 const onImageError=()=>{
  if(disposed)return;
  fail();
  if(!fallback){fallback=true;image.src=FALLBACK_HOME_COVER.src;setFraming(FALLBACK_HOME_COVER);image.dataset.coverId=FALLBACK_HOME_COVER.id;}
  else {staticFailed=true;image.hidden=true;}
 };
 image.addEventListener('error',onImageError);
 // A cached failure can finish before the menu binds its listener.
 if(image.complete&&image.naturalWidth===0)onImageError();
 function stopRuntime(){runtime?.dispose();runtime=undefined;canvas?.remove();canvas=undefined;image.hidden=staticFailed;image.dataset.coverMode='static';}
 function fail(){if(disposed)return;failed=true;abort.abort();stopRuntime();}
 async function sync(){
  if(disposed)return;
  const paused=!enabled||!!doc?.hidden||pageHidden||!!motion?.matches;
  if(runtime){runtime.setPaused(paused);image.hidden=!paused;if(canvas)canvas.hidden=paused;return;}
  if(paused||failed||loading||!loadAdapter||!cover.approved||!cover.model||!win)return;
  loading=true;
  try{
   const adapter=await loadAdapter();
   if(disposed||abort.signal.aborted)return;
   canvas=doc.createElement('canvas');canvas.className='title-character title-character-animated';canvas.setAttribute('aria-hidden','true');canvas.hidden=true;
   const f=cover.framing;canvas.style?.setProperty('--portrait-scale',String(f?.scale??1));canvas.style?.setProperty('--portrait-x',`${f?.x??0}%`);canvas.style?.setProperty('--portrait-y',`${f?.y??0}%`);
   image.after(canvas);
   canvas.addEventListener('webglcontextlost',fail,{signal:abort.signal});
   const mounted=await adapter.mount(canvas,cover.model,abort.signal);
   if(disposed||abort.signal.aborted){mounted.dispose();return;}
   runtime=mounted;runtime.resize();image.dataset.coverMode='custom-2d';await sync();
  }catch(error){image.dataset.coverError=error instanceof Error?error.message:String(error);console.warn('Custom 2D cover unavailable; approved static portrait retained.',error);fail();}
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
 return {setAnimationEnabled(value){enabled=value;visibility();},dispose(){
  if(disposed)return;disposed=true;abort.abort();stopRuntime();
  image.removeEventListener('error',onImageError);
  doc?.removeEventListener('visibilitychange',visibility);
  win?.removeEventListener('pagehide',pagehide);win?.removeEventListener('pageshow',pageshow);win?.removeEventListener('resize',resize);
  motion?.removeEventListener('change',visibility);
 }};
}

/** Imported only when the selected approved cover has a model and motion is allowed. */
export const loadWhaleCoverAdapter:HomeCoverAdapterLoader=async()=> (await import('./home-cover-playcanvas')).whaleCoverAdapter;
