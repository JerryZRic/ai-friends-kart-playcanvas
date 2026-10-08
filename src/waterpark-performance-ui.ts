import {PerformanceCapture} from './waterpark-performance';
export const PERFORMANCE_BUILD='level0-courses-20261008-1';
const CONTEXT_SAMPLE_INTERVAL_MS=250;
export type PerformancePanelOptions={mount?:HTMLElement;scene?:string};
type RefractionControl={getEnabled:()=>boolean;setEnabled:(enabled:boolean)=>void};
type WaterSettings={requestedRefraction:boolean;refractionActive:boolean;reflectionActive:boolean;reflectionTarget:{width:number;height:number}|null;refractionTarget:{width:number;height:number}|null};

/** Called by the existing game update loop; no extra animation loop. */
export function createPerformancePanel(canvas:HTMLCanvasElement,getContext:()=>Record<string,unknown>,refraction?:RefractionControl,options:PerformancePanelOptions={}) {
 const capture=new PerformanceCapture(),events=new AbortController();
 const root=document.createElement('aside');root.id='performance';
 root.innerHTML=`<button id="perf-toggle" class="icon" type="button" title="设置与性能" aria-label="设置与性能" aria-expanded="false" aria-controls="perf-body">⚙</button><section id="perf-body" hidden><strong>本地帧率测试</strong><div id="perf-water"${refraction?'':' hidden'}><button id="perf-refraction" type="button" aria-pressed="false" aria-describedby="perf-water-note">水面折射</button><div id="perf-water-note">折射开 / 关可作 A/B 对照；采集中锁定，请先停止再切换</div></div><div id="perf-live">出发后显示帧率</div><div id="perf-status">累计 60 秒游玩；到终点后点「再跑一次」继续</div><div class="perf-actions"><button id="perf-start" type="button">开始 60 秒</button><button id="perf-cancel" type="button" disabled>停止</button><button id="perf-export" type="button" disabled>导出 JSON</button><button id="perf-copy" type="button" disabled>复制摘要</button></div><pre id="perf-result"></pre><small>只在本机采集，不上传。暂停、后台、终点不计时。帧间隔并非 CPU/GPU 耗时；接近刷新率上限不代表仍有多少性能余量。可收起面板继续测试。对照时请用同一角色、窗口大小和路线分别采集。</small></section>`;
 (options.mount??document.body).append(root);
 const $=<T extends HTMLElement=HTMLElement>(id:string)=>root.querySelector<T>('#'+id)!;
 const rolling=new Float64Array(120);let n=0,index=0,sum=0,last:number|null=null,lastPaint=0,instant=0,disposed=false;
 let report:ReturnType<typeof capture.snapshot>|null=null,context:Record<string,unknown>={},finalContext:Record<string,unknown>|null=null;
 const changes:Array<{activeMs:number;context:Record<string,unknown>}>=[];
 let contextKey='',changesTruncated=false,notice='',noticeUntil=0;
 const body=$('perf-body'),refractionButton=$<HTMLButtonElement>('perf-refraction');
 // Snapshot nested settings too: a later toggle, resize, or getter mutation must
 // never rewrite the conditions under which an earlier result was captured.
 const readContext=()=>JSON.parse(JSON.stringify({...getContext(),canvasWidth:canvas.width,canvasHeight:canvas.height,viewportWidth:innerWidth,viewportHeight:innerHeight,devicePixelRatio:devicePixelRatio||1})) as Record<string,unknown>;
 const observeContext=()=>{
  const current=readContext(),key=JSON.stringify(current);
  if(key!==contextKey){contextKey=key;if(changes.length<64)changes.push({activeMs:capture.elapsedMs,context:current});else changesTruncated=true;}
  return current;
 };
 const waterSummary=(value:Record<string,unknown>)=>{
  const water=value.water as WaterSettings|undefined;if(!water)return '';
  const size=(target:WaterSettings['reflectionTarget'])=>target?`${target.width}×${target.height}`:'未启用';
  return `水面折射：${water.requestedRefraction?'开':'关'}${water.requestedRefraction&&!water.refractionActive?'（当前未生效）':''} · 反射：${water.reflectionActive?'开':'关'}\n离屏目标：反射 ${size(water.reflectionTarget)} / 折射 ${size(water.refractionTarget)}\n`;
 };
 const summary=()=>!report?'':`${waterSummary(context)}有效 ${ (report.activeMs/1000).toFixed(2)} 秒 / 墙钟 ${(report.wallMs/1000).toFixed(2)} 秒\n平均 ${report.averageFps?.toFixed(1)??'—'} FPS · ${report.frames} 帧间隔\n帧间隔中位 / P95 / P99：\n${[report.medianMs,report.p95Ms,report.p99Ms].map(v=>v?.toFixed(2)??'—').join(' / ')} ms\n长帧 >33.3 / >50 / >100 ms：${Object.values(report.longFrames).join(' / ')}\n中断 ${Object.values(report.interruptions).reduce((a,b)=>a+b,0)} 次 · ${report.status==='complete'?'完成':'已停止（部分结果）'}${changes.length?'\n采集条件有变化（含窗口 / 目标尺寸）；请查看 JSON 后比较':''}`;
 const refreshWaterControl=()=>{
  if(!refraction)return;
  const enabled=refraction.getEnabled(),running=capture.status==='recording';
  refractionButton.disabled=running;refractionButton.setAttribute('aria-pressed',String(enabled));
  refractionButton.textContent=`水面折射：${enabled?'开':'关'}`;
  $('perf-water-note').textContent=running?'采集中已锁定水面设置；点「停止」后可切换':'折射开 / 关可作 A/B 对照；采集中锁定，请先停止再切换';
 };
 const finish=(now:number)=>{finalContext=observeContext();report=capture.snapshot(now);$('perf-result').textContent=summary();$<HTMLButtonElement>('perf-export').disabled=!report.frames;$<HTMLButtonElement>('perf-copy').disabled=!report.frames;refreshWaterControl();};
 refractionButton.addEventListener('click',()=>{
  // The guard also protects programmatically dispatched clicks during a sample.
  if(disposed||capture.status==='recording'||!refraction)return;
  refraction.setEnabled(!refraction.getEnabled());refreshWaterControl();canvas.focus();
 },{signal:events.signal});
 refreshWaterControl();
 $('perf-toggle').addEventListener('click',()=>{body.hidden=!body.hidden;if(body.hidden)canvas.focus();$('perf-toggle').setAttribute('aria-expanded',String(!body.hidden));},{signal:events.signal});
 $('perf-start').addEventListener('click',()=>{if(capture.status==='recording')return;context=readContext();contextKey=JSON.stringify(context);finalContext=null;changes.length=0;changesTruncated=false;noticeUntil=0;report=null;canvas.focus();capture.start(performance.now());$('perf-result').textContent='';$<HTMLButtonElement>('perf-export').disabled=true;$<HTMLButtonElement>('perf-copy').disabled=true;paint(performance.now());},{signal:events.signal});
 $('perf-cancel').addEventListener('click',()=>{if(capture.status!=='recording')return;capture.cancel(performance.now());finish(performance.now());paint(performance.now());},{signal:events.signal});
 $('perf-export').addEventListener('click',()=>{
  if(!report?.frames)return;
  const payload={schemaVersion:2,buildId:PERFORMANCE_BUILD,scene:options.scene??'waterpark-circuit-six-racers',captureMethod:'performance.now timestamps between consecutive active PlayCanvas update callbacks; not CPU/GPU render duration',percentileMethod:'nearest rank, raw milliseconds, bounded last 32768 intervals',thresholdsMs:[33.3,50,100],refractionControlLockedDuringCapture:!!refraction,contextSampleIntervalMs:CONTEXT_SAMPLE_INTERVAL_MS,initialContext:context,finalContext,contextChanges:changes,contextChangesTruncated:changesTruncated,result:report,note:'Refresh/VSync may cap FPS; this measurement does not estimate remaining GPU headroom. Context is sampled at start, finish, and during updates no more often than every 250 ms, so brief changes may be missed. Local user-initiated export; no upload.'};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=PERFORMANCE_BUILD+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 },{signal:events.signal});
 $('perf-copy').addEventListener('click',async()=>{if(!report?.frames)return;try{await navigator.clipboard.writeText(PERFORMANCE_BUILD+'\n'+summary());notice='摘要已复制';noticeUntil=performance.now()+5000;$('perf-status').textContent=notice;}catch{notice='浏览器未允许复制，请选中下方摘要或导出 JSON';noticeUntil=performance.now()+8000;$('perf-status').textContent=notice;}},{signal:events.signal});
 function paint(now:number,reason=''){
  lastPaint=now;const running=capture.status==='recording';$<HTMLButtonElement>('perf-start').disabled=running;$<HTMLButtonElement>('perf-cancel').disabled=!running;refreshWaterControl();
  if(!$('perf-body').hidden){$('perf-live').textContent=last===null?'当前未游玩':`即时 ${instant>0?(1000/instant).toFixed(0):'—'} · 平滑 ${sum>0?(n*1000/sum).toFixed(1):'—'} FPS · ${instant.toFixed(2)} ms`;
  $('perf-status').textContent=now<noticeUntil?notice:running?`采集中 ${(capture.elapsedMs/1000).toFixed(1)} / 60 秒${reason?' · 等待继续游玩':''}`:capture.status==='idle'?'累计 60 秒游玩；到终点后点「再跑一次」继续':'结果仅留在当前页面；可导出后分享';}
  if(running)observeContext();
 }
 const interrupt=(reason:string)=>{capture.interrupt(reason);last=null;instant=0;n=index=sum=0;};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)interrupt('hidden');},{signal:events.signal});
 return {sample(now:number,active:boolean,reason:string){
  if(disposed)return;
  if(body.hidden&&capture.status!=='recording'){last=null;instant=0;n=index=sum=0;return;}
  if(!active||document.hidden){interrupt(document.hidden?'hidden':reason);}else{if(last!==null){instant=now-last;if(instant>0&&Number.isFinite(instant)){if(n===rolling.length)sum-=rolling[index];else n++;rolling[index]=instant;sum+=instant;index=(index+1)%rolling.length;}}last=now;}
  const wasRecording=capture.status==='recording';capture.sample(now,active&&!document.hidden,reason);
  if(wasRecording&&capture.status==='complete'){finish(now);paint(now,active?'':reason);}
  else if(now-lastPaint>=CONTEXT_SAMPLE_INTERVAL_MS)paint(now,active?'':reason);
 },interrupt,dispose(){if(disposed)return;disposed=true;capture.cancel(performance.now());events.abort();root.remove();}};
}
