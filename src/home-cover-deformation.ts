/** Source-space coordinates are pixels, origin top-left; never crop/repaint the approved art. */
export const WHALE_COVER_SIZE={width:1181,height:1331} as const;
export const COVER_MAX_FPS=24;
const bell=(x:number,center:number,radius:number)=>{const d=Math.abs(x-center)/radius;return d>=1?0:(1-d*d)**2;};
/** Deliberately local: face, feet and outer canvas are pinned; no whole-image bobbing. */
export function deformCoverPoint(x:number,y:number,time:number):[number,number]{
 const u=x/WHALE_COVER_SIZE.width,v=y/WHALE_COVER_SIZE.height;
 const breath=Math.sin(time*Math.PI*2/4.8);
 const chest=bell(u,.465,.22)*bell(v,.53,.16);
 const leftHair=bell(u,.15,.14)*bell(v,.57,.30);
 const rightHair=bell(u,.82,.17)*bell(v,.54,.31);
 const sway=leftHair*Math.sin(time*1.55)+rightHair*Math.sin(time*1.43+.7);
 return [x+chest*(u-.465)*5*breath+sway*3.2,y-chest*1.8*breath+sway*.55];
}
/** A short held eyelid frame with soft transitions, every 4.9s. */
export function coverBlink(time:number):number{
 const phase=(time+1.1)%4.9;
 if(phase<4.56||phase>4.82)return 0;
 if(phase<4.62)return (phase-4.56)/.06;
 if(phase<=4.73)return 1;
 return (4.82-phase)/.09;
}
export function createCoverGrid(columns=40,rows=46){
 const points:number[]=[],uvs:number[]=[],indices:number[]=[];
 for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){
  points.push(x/columns*WHALE_COVER_SIZE.width,y/rows*WHALE_COVER_SIZE.height);
  uvs.push(x/columns,1-y/rows);
 }
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
  const i=y*(columns+1)+x;indices.push(i,i+columns+1,i+1,i+1,i+columns+1,i+columns+2);
 }
 return {points,uvs,indices};
}
