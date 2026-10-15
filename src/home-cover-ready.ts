/** Observe only the mounted portrait; never preload the registry. A failed primary
 * can switch to DeepSeek synchronously in mountHomeCover's earlier error listener.
 * Deadline and abort keep cold-entry/navigation recovery bounded. */
export function waitForHomeCover(image:HTMLImageElement|null,signal:AbortSignal,timeoutMs=3500):Promise<void>{
 if(!image||signal.aborted||image.hidden||image.complete&&image.naturalWidth>0)return Promise.resolve();
 return new Promise(resolve=>{
  let timer:ReturnType<typeof setTimeout>;
  const finish=()=>{clearTimeout(timer);image.removeEventListener('load',finish);image.removeEventListener('error',error);signal.removeEventListener('abort',finish);resolve();};
  const error=()=>{queueMicrotask(()=>{if(image.hidden||image.complete)finish();});};
  image.addEventListener('load',finish);image.addEventListener('error',error);signal.addEventListener('abort',finish,{once:true});
  timer=setTimeout(finish,timeoutMs);
 });
}
