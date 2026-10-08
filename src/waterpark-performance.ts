/** Local frame pacing only. No network, GPU timing, or device fingerprinting. */
export class PerformanceCapture {
  status:'idle'|'recording'|'complete'|'cancelled'='idle';
  private samples=new Float64Array(32768);
  private count=0; private frames=0; private activeMs=0;
  private started=0; private ended:number|null=null; private previous:number|null=null;
  private interruptions:Record<string,number>={};
  private longFrames={over33_3ms:0,over50ms:0,over100ms:0};
  constructor(readonly targetMs=60000) {}
  start(now:number) {
    if(this.status==='recording'||!Number.isFinite(now))return;
    this.status='recording';this.started=now;this.ended=null;this.previous=null;
    this.count=this.frames=this.activeMs=0;this.interruptions={};
    this.longFrames={over33_3ms:0,over50ms:0,over100ms:0};
  }
  interrupt(reason:string) {
    if(this.status==='recording'&&this.previous!==null)this.interruptions[reason]=(this.interruptions[reason]||0)+1;
    this.previous=null;
  }
  sample(now:number,active:boolean,inactiveReason='paused') {
    if(this.status!=='recording')return;
    if(!active){this.interrupt(inactiveReason);return;}
    if(!Number.isFinite(now)){this.previous=null;return;}
    const previous=this.previous;this.previous=now;
    if(previous===null)return;
    const ms=now-previous;if(ms<=0){this.previous=null;return;}
    this.samples[this.frames%this.samples.length]=ms;this.frames++;this.count=Math.min(this.frames,this.samples.length);this.activeMs+=ms;
    if(ms>33.3)this.longFrames.over33_3ms++;
    if(ms>50)this.longFrames.over50ms++;
    if(ms>100)this.longFrames.over100ms++;
    if(this.activeMs>=this.targetMs){this.status='complete';this.ended=now;this.previous=null;}
  }
  cancel(now:number){if(this.status==='recording'){this.status='cancelled';this.ended=Number.isFinite(now)?now:this.started;this.previous=null;}}
  snapshot(now:number) {
    const sorted=Array.from(this.samples.subarray(0,this.count)).sort((a,b)=>a-b);
    const percentile=(p:number)=>sorted.length?sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]:null;
    return {status:this.status,targetMs:this.targetMs,frames:this.frames,activeMs:this.activeMs,
      wallMs:this.status==='idle'?0:Math.max(0,(this.ended??(Number.isFinite(now)?now:this.started))-this.started),
      averageFps:this.activeMs>0?this.frames*1000/this.activeMs:null,
      medianMs:percentile(.5),p95Ms:percentile(.95),p99Ms:percentile(.99),longFrames:{...this.longFrames},interruptions:{...this.interruptions},
      percentileSamples:this.count,percentileScope:this.frames>this.samples.length?'latest 32768 intervals':'all captured intervals'};
  }
  get elapsedMs(){return this.activeMs;}
}
