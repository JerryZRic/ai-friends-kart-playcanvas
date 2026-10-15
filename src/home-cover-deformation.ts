import {WHALE_RIG,DEFAULT_BLINK_TIMING,type CoverRig,type CoverBlinkTiming} from './home-cover-rigs';
/** Source-space coordinates are pixels, origin top-left; never crop/repaint the approved art. */
export const WHALE_COVER_SIZE={width:1181,height:1331} as const;
export const COVER_MAX_FPS=24;
const bell=(x:number,center:number,radius:number)=>{const d=Math.abs(x-center)/radius;return d>=1?0:(1-d*d)**2;};
/** Deliberately local: face, feet and outer canvas are pinned; no whole-image bobbing. */
export function deformCoverPoint(x:number,y:number,time:number,rig:CoverRig=WHALE_RIG):[number,number]{
 const u=x/rig.width,v=y/rig.height,b=rig.breath;
 const ramp=Math.min(1,Math.max(0,time/.65)),gain=ramp*ramp*(3-2*ramp);
 const breath=Math.sin(time*Math.PI*2/b.period)*gain;
 const chest=bell(u,b.x,b.rx)*bell(v,b.y,b.ry);
 const sway=rig.hair.reduce((sum,h)=>sum+bell(u,h.x,h.rx)*bell(v,h.y,h.ry)*Math.sin(time*h.rate+h.phase)*h.amplitude,0)*gain;
 return [x+chest*(u-b.x)*b.spread*breath+sway,y-chest*b.lift*breath+sway*.172];
}
/** Per-character timing, with the original short opaque eyelid pose preserved. */
export function coverBlink(time:number,timing:CoverBlinkTiming=DEFAULT_BLINK_TIMING):number{
 const {period,offset,close,hold,open}=timing;
 const phase=((time+offset)%period+period)%period;
 const start=period-.08-close-hold-open,elapsed=phase-start;
 if(elapsed<0||elapsed>close+hold+open)return 0;
 if(elapsed<close)return elapsed/close;
 if(elapsed<=close+hold)return 1;
 return (close+hold+open-elapsed)/open;
}
/** Reject unregistered eye assets before network/GPU work. Padded face must be rigid. */
export function validateCoverBlink(rig:CoverRig):void{
 const blink=rig.blink;if(!blink)return;
 const timing=blink.timing??DEFAULT_BLINK_TIMING;
 if(!Object.values(timing).every(Number.isFinite)||timing.close<=0||timing.hold<0||timing.open<=0||timing.period<=timing.close+timing.hold+timing.open+.08)throw new Error('Invalid portrait blink timing');
 if(!Number.isFinite(blink.feather)||blink.feather<=0||!Number.isFinite(blink.width)||!Number.isFinite(blink.height)||blink.width<=0||blink.height<=0||blink.patches.length!==2)throw new Error('Invalid portrait eye registration');
 const padX=rig.width/40,padY=rig.height/46;
 for(const patch of blink.patches){
  const [l,t,r,b]=patch;
  if(!patch.every(Number.isFinite)||l<0||t<0||r>Math.min(rig.width,blink.width)||b>Math.min(rig.height,blink.height)||r-l<=2*blink.feather||b-t<=2*blink.feather)throw new Error('Invalid portrait eye bounds');
  for(const region of [rig.breath,...rig.hair]){
   const left=(region.x-region.rx)*rig.width,right=(region.x+region.rx)*rig.width,top=(region.y-region.ry)*rig.height,bottom=(region.y+region.ry)*rig.height;
   if(l-padX<right&&r+padX>left&&t-padY<bottom&&b+padY>top)throw new Error('Portrait eye patch overlaps moving mesh');
  }
 }
}
export function createCoverGrid(columns=40,rows=46,size:{width:number;height:number}=WHALE_COVER_SIZE){
 const points:number[]=[],uvs:number[]=[],indices:number[]=[];
 for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){
  points.push(x/columns*size.width,y/rows*size.height);
  uvs.push(x/columns,1-y/rows);
 }
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
  const i=y*(columns+1)+x;indices.push(i,i+columns+1,i+1,i+1,i+columns+1,i+columns+2);
 }
 return {points,uvs,indices};
}
