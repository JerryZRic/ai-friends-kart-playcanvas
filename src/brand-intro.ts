/** Once per document: presentation only, never part of a resource/audio gate. */
export function mountBrandIntro(document: Document, window: Window, onFinish: () => void) {
  const overlay=document.getElementById('brand-intro');
  const style=document.querySelector('[data-brand-intro-style]');
  let finished=false,timer:number|undefined;
  const duration=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?800:2000;
  const finish=()=>{
    if(finished)return;finished=true;
    if(timer!==undefined)window.clearTimeout(timer);
    overlay?.removeEventListener('animationend',ended);
    window.removeEventListener('error',failed,true);window.removeEventListener('unhandledrejection',failed);
    overlay?.remove();style?.remove();onFinish();
  };
  const ended=(event:AnimationEvent)=>{if(event.target===overlay)finish();};
  const failed=()=>finish();
  if(!overlay){finish();return {dispose:finish};}
  overlay.addEventListener('animationend',ended);
  window.addEventListener('error',failed,true);window.addEventListener('unhandledrejection',failed);
  // CSS starts while scripts/resources load. Do not repeat it after a slow bundle.
  const animation=overlay.getAnimations?.().find(animation=>(animation as CSSAnimation).animationName==='timewish-cover');
  const elapsed=typeof animation?.currentTime==='number'?animation.currentTime:0;
  if(window.getComputedStyle(overlay).visibility==='hidden')finish();
  else timer=window.setTimeout(finish,Math.max(0,duration-elapsed)+60);
  return {dispose:finish};
}
