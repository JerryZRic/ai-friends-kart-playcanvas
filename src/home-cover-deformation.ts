import {WHALE_RIG,type CoverRig} from './home-cover-rigs';
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
/** A short held eyelid frame with soft transitions, every 4.9s. */
export function coverBlink(time:number):number{
 const phase=(time+1.1)%4.9;
 if(phase<4.56||phase>4.82)return 0;
 if(phase<4.62)return (phase-4.56)/.06;
 if(phase<=4.73)return 1;
 return (4.82-phase)/.09;
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
