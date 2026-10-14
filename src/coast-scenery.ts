import * as pc from 'playcanvas';
import {LandMeshBatch, cylinder, ellipsoid} from './land-mesh-builder';
import {isRoadsideClear} from './track';

/** A single coastal palette: large calm surfaces, small coral navigation accents.
 * Decorations are static, deterministic and never enter the collision/AI graph. */
export const COAST_PALETTE = Object.freeze({
  cream:'#fff0cd', sand:'#f2d9a4', stone:'#d0d9ce', teal:'#42aaa8',
  coral:'#ed886e', timber:'#bd9066', dark:'#466978', foliage:'#72ad7f',
});
export type CoastDecoration = {kind:string;x:number;y:number;z:number;radius:number};
const v=(x:number,y:number,z:number)=>new pc.Vec3(x,y,z);
export function buildCoastScenery(ground:(x:number,z:number)=>number|null) {
  const cream=new LandMeshBatch('Coast cream plaster, sails and canvas',COAST_PALETTE.cream,.86);
  const sand=new LandMeshBatch('Coast warm sand plazas',COAST_PALETTE.sand,.96);
  const stone=new LandMeshBatch('Coast layered limestone plinths',COAST_PALETTE.stone,.94);
  const teal=new LandMeshBatch('Coast teal painted roofs and shutters',COAST_PALETTE.teal,.7);
  const coral=new LandMeshBatch('Coast restrained coral trim',COAST_PALETTE.coral,.82);
  const wood=new LandMeshBatch('Coast honey timber slats and pilings',COAST_PALETTE.timber,.9);
  const dark=new LandMeshBatch('Coast recessed windows and hardware',COAST_PALETTE.dark,.68);
  const green=new LandMeshBatch('Coast rounded planted foliage',COAST_PALETTE.foliage,.97);
  const batches=[cream,sand,stone,teal,coral,wood,dark,green], props:CoastDecoration[]=[];
  function site(kind:string,x:number,z:number,radius:number,offshore=false) {
    if(!isRoadsideClear(x,z,radius))return null;
    const g=ground(x,z);if(g===null&&!offshore)return null;
    const y=g??.3;props.push({kind,x,y,z,radius});return {x,y,z};
  }
  function box(b:LandMeshBatch,x:number,y:number,z:number,sx:number,sy:number,sz:number,yaw=0){b.box(v(x,y,z),v(sx,sy,sz),yaw);}
  function post(x:number,y:number,z:number,h:number){cylinder(wood,v(x,y,z),.14,h,6);cylinder(cream,v(x,y+h,z),.19,.12,6);}
  function planter(x:number,y:number,z:number){cylinder(cream,v(x,y,z),1.1,.7,8);ellipsoid(green,v(x,y+1,z),v(1.3,.8,1.25),7,3);}
  function parasol(x:number,y:number,z:number,r=2.8){
    cylinder(wood,v(x,y,z),.09,3.1,6);
    for(let j=0;j<10;j++){
      const a=j/10*Math.PI*2,b=(j+1)/10*Math.PI*2,m=j%2?cream:teal;
      m.tri(v(x,y+3.65,z),v(x+Math.cos(a)*r,y+2.95,z+Math.sin(a)*r),v(x+Math.cos(b)*r,y+2.95,z+Math.sin(b)*r));
      m.quad(v(x+Math.cos(a)*r,y+2.95,z+Math.sin(a)*r),v(x+Math.cos(b)*r,y+2.95,z+Math.sin(b)*r),v(x+Math.cos(a)*r,y+2.72,z+Math.sin(a)*r),v(x+Math.cos(b)*r,y+2.72,z+Math.sin(b)*r));
    }
    for(const s of [-1,1]){box(wood,x+s*1.4,y+.6,z,1,.13,2.2);box(cream,x+s*1.4,y+.7,z, .88,.13,1.9);for(const zz of [-.7,.7])box(wood,x+s*1.4,y+.3,z+zz,.1,.6,.1);}
  }
  function hut(x:number,y:number,z:number,accent:LandMeshBatch){
    box(stone,x,y+.2,z,9,.4,7);box(cream,x,y+2.4,z,7.8,4.4,5.8);
    // Pitched roof, broad overhang, separate fascia and recessed openings.
    accent.quad(v(x-4.5,y+4.5,z-3.5),v(x-4.5,y+4.5,z+3.5),v(x,y+6.3,z-3.5),v(x,y+6.3,z+3.5));
    accent.quad(v(x,y+6.3,z-3.5),v(x,y+6.3,z+3.5),v(x+4.5,y+4.5,z-3.5),v(x+4.5,y+4.5,z+3.5));
    for(const side of [-1,1]){cream.tri(v(x-3.9,y+4.5,z+side*2.9),v(x+3.9,y+4.5,z+side*2.9),v(x,y+6.15,z+side*2.9));box(wood,x,y+4.48,z+side*3.5,9,.22,.18);}
    box(dark,x,y+1.8,z-2.92,1.5,3.1,.09);box(accent,x,y+3.5,z-3,1.9,.18,.3);
    for(const s of [-1,1]){box(dark,x+s*2.6,y+2.5,z-2.93,1.35,1.65,.1);box(cream,x+s*2.6,y+1.6,z-3,1.65,.18,.5);for(const off of [-.88,.88])box(accent,x+s*2.6+off,y+2.5,z-3,.32,1.8,.18);}
    // Slatted veranda and square posts give legible modeling detail at race scale.
    for(let i=0;i<12;i++)box(wood,x-4+i*.72,y+.42,z-4.35,.64,.16,2.4);
    for(const s of [-1,1]){box(cream,x+s*3.8,y+1.95,z-5.35,.24,3,.24);planter(x+s*5.8,y,z-2.7);}
    box(accent,x,y+3.65,z-4.3,8.2,.16,2.65);
  }
  const village=site('beach-cabana-cluster',80,-85,23);
  if(village){const {x,y,z}=village;cylinder(sand,v(x,y+.02,z),22,.08,32);hut(x-9,y+.1,z,teal);hut(x+8,y+.1,z+7,coral);parasol(x+8,y+.12,z-8);parasol(x-6,y+.12,z+11);}
  const garden=site('coastal-picnic-grove',-90,-60,17);
  if(garden){const {x,y,z}=garden;cylinder(sand,v(x,y+.02,z),15,.08,24);for(const [dx,dz]of [[-6,-4],[5,3]])parasol(x+dx,y+.1,z+dz);for(const s of [-1,1]){planter(x+s*10,y,z-7);box(wood,x+s*9,y+.75,z+7,3,.22,1);for(const dx of [-1,1])box(cream,x+s*9+dx,y+.35,z+7,.32,.7,.65);}}
  const tower=site('harbour-lighthouse',190,145,14,true);
  if(tower){const{x,y,z}=tower;
    cylinder(stone,v(x,-3,z),13,y+3,12);cylinder(sand,v(x,y,z),11,.5,12);
    for(let ring=0;ring<6;ring++)cylinder(ring===2||ring===4?coral:cream,v(x,y+.5+ring*3.3,z),4.4-ring*.32,3.3,12);
    cylinder(cream,v(x,y+20.3,z),4.7,.5,12);cylinder(dark,v(x,y+20.8,z),2.7,3,10);
    for(let j=0;j<10;j++){const a=j/10*Math.PI*2;cylinder(cream,v(x+Math.cos(a)*2.8,y+20.8,z+Math.sin(a)*2.8),.16,3.1,5);post(x+Math.cos(a)*4.1,y+20.8,z+Math.sin(a)*4.1,1.25);}
    cylinder(cream,v(x,y+23.8,z),3.6,.35,12);teal.cone(v(x,y+24.15,z),3.8,3.3,12);cylinder(coral,v(x,y+27.45,z),.22,1.6,6);
    box(dark,x,y+2,z-4.5,1.55,3,.12);for(let i=0;i<4;i++)box(cream,x,y+.2+i*.17,z-6+i*.4,2.6,.25,1.3);
  }
  const dock=site('timber-marina',0,-202,20,true);
  if(dock){const{x,y,z}=dock;
    for(let i=0;i<32;i++)box(wood,x-15.5+i,y,z, .9,.3,6.8);
    for(let i=0;i<7;i++)for(const s of [-1,1]){cylinder(wood,v(x-15+i*5,-3,z+s*3),.32,5.1,7);cylinder(cream,v(x-15+i*5,2.1,z+s*3),.4,.2,7);}
    box(teal,x-10,y+1.7,z,5.3,3.1,4);box(cream,x-10,y+3.35,z,6.4,.25,5.2);box(dark,x-10,y+2,z-2.06,3,1.3,.1);box(coral,x-10,y+.8,z-2.15,3.4,.2,.45);
    for(const dx of [-3,5,11]){box(cream,x+dx,y+.7,z,1.6,.2,3.6);for(const dz of [-1.2,1.2])box(teal,x+dx,y+.3,z+dz,.15,.7,.15);}
  }
  for(const [i,x,z]of [[0,60,-225],[1,218,55],[2,-218,10]]){
    const p=site('anchored-sailboat',x,z,8,true);if(!p)continue;
    const y=-1.4;ellipsoid(i===1?coral:teal,v(x,y,z),v(2.5,1.25,6),8,3);box(cream,x,y+.65,z,4.2,.25,9);
    cylinder(wood,v(x,y+.6,z),.14,11,6);cream.tri(v(x+.2,y+2,z),v(x+.2,y+11,z),v(x+.2,y+2,z+5.8));teal.tri(v(x-.2,y+2,z-.3),v(x-.2,y+9,z-.3),v(x-.2,y+2,z-4.6));
  }
  // Low shoreline detail only: avoids visual fences along every bend.
  for(let i=0;i<11;i++){const a=i*.5,x=-35+Math.cos(a)*62,z=25+Math.sin(a)*56;const p=site('coastal-planter',x,z,2);if(p)planter(x,p.y,z);}
  return {batches,props};
}
