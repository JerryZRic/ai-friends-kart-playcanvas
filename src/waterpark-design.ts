/** Original geometry shared by native PlayCanvas and offline review renders. No racing physics. */
import * as pc from 'playcanvas';
import {ClosedCircuit} from './closed-circuit';
export type MeshData = { name: string; color: string; positions: number[]; indices: number[]; uvs: number[]; water?: boolean };
export const SAMPLE_LENGTH=285, WATER_HALF_WIDTH=12, SAMPLE_SECONDS=18;
/** Original medium-complexity resort loop: palm-entry chicane, a tower
 * horseshoe, garden dogleg, lagoon counter-bend and a broad south return.
 * All are actual canal turns, not scenery labels on an oval. */
export const WATER_RACE_POINTS = Object.freeze([
 [0, 0],
 [-7.16, 53.44],
 [-15.76, 100.32],
 [-10.4, 138.76],
 [16.4, 160.88],
 [53.76, 157.4],
 [88.6, 138.04],
 [121.12, 129.64],
 [156, 138.6],
 [191.8, 139.76],
 [217.28, 117.36],
 [218.76, 82.4],
 [196.92, 51.36],
 [166.12, 27.16],
 [146.32, -0.12],
 [150.52, -34.32],
 [167.4, -72],
 [168.04, -108.16],
 [142.04, -134.68],
 [100.96, -139.64],
 [60.76, -121.96],
 [29.6, -91.64],
 [9.2, -51.92],
].map(([x,z])=>Object.freeze([x,0,z] as const)));
export const waterCircuit = new ClosedCircuit(WATER_RACE_POINTS,{arcSteps:WATER_RACE_POINTS.length*192});
export const WATER_RACE_LENGTH = waterCircuit.length;
export const WATER_RACE_BRIDGE_DISTANCE = WATER_RACE_LENGTH-30;
export const WATER_RACE_TOWER_DISTANCE = WATER_RACE_LENGTH*.19;
export const WATER_RACE_TOWER_LANE = 36;
/** Authored corner exits, with recovery pickups down the middle. Every
 * line stays reachable by the existing shared AI's ±5.2m planning envelope. */
export const WATER_RACE_PICKUPS:readonly Readonly<{d:number;lateral:number}>[] = Object.freeze([
 [.055,0],[.13,-4.5],[.205,4.5],[.285,-3],[.285,3],[.385,0],
 [.47,4.5],[.545,-4.5],[.625,4.5],[.71,-3],[.71,3],[.81,0],[.89,-4.5],[.96,0],
].map(([fraction,lateral])=>Object.freeze({d:fraction*WATER_RACE_LENGTH,lateral})));
export const WATER_RACE_SECTIONS=Object.freeze([
 {name:'Bridge launch',from:0,to:.075},
 {name:'Palm entry chicane',from:.075,to:.17},
 {name:'Tower horseshoe',from:.17,to:.29},
 {name:'Garden dogleg',from:.29,to:.38},
 {name:'Eastern bowl',from:.38,to:.51},
 {name:'Lagoon counter-bend',from:.51,to:.68},
 {name:'South return',from:.68,to:.90},
 {name:'Bridge sprint',from:.90,to:1},
].map(section=>Object.freeze({...section,from:section.from*WATER_RACE_LENGTH,to:section.to*WATER_RACE_LENGTH})));
/** Keep the entire water surface inside a 16-bit batch as the route grows. */
export const WATER_RACE_SURFACE_STEP=1.6;
export type WaterparkSampler = typeof sampleWaterpark;
export type WaterparkGeometryOptions = {race?: boolean; sampler?: WaterparkSampler; extent?: {start: number; end: number}};
export function sampleWaterparkLoop(distance:number,lateral=0){return waterCircuit.sample(distance,lateral);}
export function waterparkBridgeDistance(options:WaterparkGeometryOptions={}){return options.race?WATER_RACE_BRIDGE_DISTANCE:183;}

// Full-width banks are sampled before terrain construction. Concave route
// sections need polygon filling: a fan from a garden centre would cross water.
const terrainRows=Math.ceil(WATER_RACE_LENGTH/2),terrainFrames=Array.from({length:terrainRows},(_,i)=>waterCircuit.sample(i/terrainRows*WATER_RACE_LENGTH));
const raceBends=terrainFrames.map((_,i)=>waterCircuit.curvature(i/terrainRows*WATER_RACE_LENGTH,7));
const innerLand=terrainFrames.map(frame=>frame.p.clone().add(frame.n.clone().mulScalar(18.15)));
const outerLand=terrainFrames.map(frame=>frame.p.clone().add(frame.n.clone().mulScalar(-18.15)));
export const WATER_RACE_LAND_CENTER=Object.freeze({
 x:(Math.min(...innerLand.map(p=>p.x))+Math.max(...innerLand.map(p=>p.x)))/2,
 z:(Math.min(...innerLand.map(p=>p.z))+Math.max(...innerLand.map(p=>p.z)))/2,
});
/** Even-odd horizontal slabs fill simple concave polygons and holes without
 * assuming a star-shaped island. Every boundary vertex is a slab endpoint;
 * land meets the sampled coping exactly, with no radial exterior folds. */
function fillLandPolygons(data:MeshData,polygons:readonly (readonly pc.Vec3[])[]){
 const levels=[...new Set(polygons.flatMap(polygon=>polygon.map(p=>p.z)))].sort((a,b)=>a-b);
 const edges=polygons.flatMap(polygon=>polygon.map((a,i)=>({a,b:polygon[(i+1)%polygon.length]})));
 const xAt=(edge:{a:pc.Vec3;b:pc.Vec3},z:number)=>edge.a.x+(edge.b.x-edge.a.x)*(z-edge.a.z)/(edge.b.z-edge.a.z);
 const triangle=(a:pc.Vec3,b:pc.Vec3,c:pc.Vec3)=>{
  const up=(b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z);
  if(Math.abs(up)<1e-9)return;
  const first=data.positions.length/3;
  for(const p of[a,up>0?b:c,up>0?c:b])data.positions.push(p.x,2.25,p.z);
  data.indices.push(first,first+1,first+2);
 };
 for(let row=0;row<levels.length-1;row++){
  const lo=levels[row],hi=levels[row+1],mid=(lo+hi)/2;
  if(hi-lo<1e-9)continue;
  const crossings=edges.filter(({a,b})=>Math.min(a.z,b.z)<mid&&Math.max(a.z,b.z)>mid).sort((a,b)=>xAt(a,mid)-xAt(b,mid));
  if(crossings.length%2)throw new Error('Land boundaries must form closed polygons');
  for(let i=0;i<crossings.length;i+=2){
   const left=crossings[i],right=crossings[i+1];
   const a=new pc.Vec3(xAt(left,lo),2.25,lo),b=new pc.Vec3(xAt(right,lo),2.25,lo),c=new pc.Vec3(xAt(left,hi),2.25,hi),d=new pc.Vec3(xAt(right,hi),2.25,hi);
   triangle(a,c,b);triangle(b,c,d);
  }
 }
}
export function createWaterparkRaceLand(options:WaterparkGeometryOptions={}):MeshData{
 const {sample,start,end}=waterparkLayout({...options,race:true}),custom=!!options.sampler||!!options.extent;
 const rows=custom?Math.ceil((end-start)/2):terrainRows;
 if(rows<4||sample(start).p.distance(sample(end).p)>1e-5||sample(start).n.distance(sample(end).n)>1e-5)throw new Error('Race land requires a closed sampler over its extent');
 const inner=custom?Array.from({length:rows},(_,i)=>sample(start+i/rows*(end-start),18.15).p):innerLand;
 const outer=custom?Array.from({length:rows},(_,i)=>sample(start+i/rows*(end-start),-18.15).p):outerLand;
 const xs=outer.map(p=>p.x),zs=outer.map(p=>p.z),left=Math.min(...xs)-85,right=Math.max(...xs)+85,back=Math.min(...zs)-85,front=Math.max(...zs)+85;
 const apron=[new pc.Vec3(left,2.25,back),new pc.Vec3(right,2.25,back),new pc.Vec3(right,2.25,front),new pc.Vec3(left,2.25,front)];
 const data:MeshData={name:'Mint green planted banks',color:'#92cc88',positions:[],indices:[],uvs:[]};
 fillLandPolygons(data,[inner]);
 fillLandPolygons(data,[apron,outer]);
 return data;
}

/** Build-time clearance against every branch, including concave inlets. The
 * radius includes the whole canopy/roof, not merely its trunk or centre. */
export function waterparkSceneryClearance(options:WaterparkGeometryOptions={}){
 const {sample,start,end}=waterparkLayout({...options,race:true});
 const frames=options.sampler||options.extent?Array.from({length:Math.ceil((end-start)/2)},(_,i)=>sample(start+i/Math.ceil((end-start)/2)*(end-start))):terrainFrames;
 return (x:number,z:number,radius:number)=>frames.every(({p})=>Math.hypot(p.x-x,p.z-z)>WATER_HALF_WIDTH+radius+2);
}

/** Signed look-ahead bend in radians/metre. A fixed table avoids per-racer spline allocations. */
export function waterparkCurvature(distance:number){
 const u=((Number.isFinite(distance)?distance:0)%WATER_RACE_LENGTH+WATER_RACE_LENGTH)%WATER_RACE_LENGTH/WATER_RACE_LENGTH*terrainRows;
 const i=Math.floor(u),f=u-i;
 return raceBends[i]*(1-f)+raceBends[(i+1)%terrainRows]*f;
}

export function waterparkLayout(options: WaterparkGeometryOptions = {}) {
 return {
  sample: options.sampler ?? (options.race ? sampleWaterparkLoop : sampleWaterpark),
  start: options.extent?.start ?? (options.race ? 0 : -35),
  end: options.extent?.end ?? (options.race ? WATER_RACE_LENGTH : 335),
  closed: options.race === true,
 };
}
export function sampleWaterpark(distance:number,lateral=0){
 const d=Math.max(-40,Math.min(340,distance)),r=76,a=Math.max(0,Math.min(1.75,(d-92)/r));
 let x=r*(1-Math.cos(a)),z=Math.min(d,92)+r*Math.sin(a);
 if(d>225){x+=(d-225)*Math.sin(a);z+=(d-225)*Math.cos(a);}
 const t=new pc.Vec3(Math.sin(a),0,Math.cos(a)),n=new pc.Vec3(Math.cos(a),0,-Math.sin(a));
 return{p:new pc.Vec3(x+n.x*lateral,0,z+n.z*lateral),t,n,angle:a};
}
export function sampleCamera(distance:number){const s=sampleWaterpark(distance),a=sampleWaterpark(distance+24);return{position:[s.p.x-s.t.x*7.8,3.7,s.p.z-s.t.z*7.8],target:[a.p.x,2.1,a.p.z]};}
const v=(x=0,y=0,z=0)=>new pc.Vec3(x,y,z);
class Batch{
 data:MeshData;
 constructor(name:string,color:string,water=false){this.data={name,color,positions:[],indices:[],uvs:[],...(water?{water}:{})};}
 add(g:pc.Geometry,p:pc.Vec3,scale=v(1,1,1),rot=v()){
 const m=new pc.Mat4().setTRS(p,new pc.Quat().setFromEulerAngles(rot.x,rot.y,rot.z),scale),offset=this.data.positions.length/3;
 for(let i=0;i<g.positions.length;i+=3){const q=m.transformPoint(v(g.positions[i],g.positions[i+1],g.positions[i+2]));this.data.positions.push(q.x,q.y,q.z);}
 for(const i of g.indices)this.data.indices.push(i+offset);
 }
 quad(a:pc.Vec3,b:pc.Vec3,c:pc.Vec3,d:pc.Vec3){const n=this.data.positions.length/3;for(const q of[a,b,c,d])this.data.positions.push(q.x,q.y,q.z);this.data.indices.push(n,n+2,n+1,n+1,n+2,n+3);}
}
const railPost=new pc.CylinderGeometry({radius:.5,height:1,capSegments:6,heightSegments:1}),palmFruit=new pc.SphereGeometry({latitudeBands:5,longitudeBands:8});
const box=new pc.BoxGeometry(),sphere=new pc.SphereGeometry({latitudeBands:8,longitudeBands:12}),cylinder=new pc.CylinderGeometry({radius:.5,height:1,capSegments:10,heightSegments:1});
export function createWaterparkDesign(options: WaterparkGeometryOptions = {}):MeshData[]{
 const {sample, start: trackStart, end: trackEnd, closed} = waterparkLayout(options);
 const sceneryClear=closed?waterparkSceneryClearance(options):()=>true;
 const all:Batch[]=[],batch=(n:string,c:string,w=false)=>{const b=new Batch(n,c,w);all.push(b);return b;};
 const water=batch('Turquoise flowing canal','#14bde6',true),cream=batch('Ivory coping and bridge stone','#fff0d4'),sand=batch('Warm sand promenade','#e5c598'),aqua=batch('Layered turquoise retaining walls','#279dbd'),navy=batch('Deep blue wall recess','#3f709f');
 const coral=batch('Coral curb accents','#fa9da9'),purple=batch('Orchid landmark tower','#b38ccc'),pink=batch('Rose tower roofs and canopies','#ed95c8'),white=batch('Pearl railings and canopy stripes','#fff5ed');
 const roseFabric=batch('Rose woven parasol panels','#ed9dc2'),ivoryFabric=batch('Ivory woven parasol stripes','#fff5ed');
 const grass=batch('Mint green planted banks','#92cc88'),trunk=batch('Palm trunks','#b59379'),leaves=batch('Palm jade leaves','#4fb694'),lime=batch('Palm lime leaves','#9ccf5e'),dark=batch('Tower window blue glass','#477dab'),cloud=batch('Soft cloud clusters','#ffffff');
 function ribbon(b:Batch,from:number,to:number,y:number,start=trackStart,end=trackEnd,step=2){for(let d=start;d<end;d+=step){const p=(s:number,l:number)=>{const q=sample(s,l).p;q.y=y;return q;},next=Math.min(end,d+step);b.quad(p(d,from),p(d,to),p(next,from),p(next,to));if(b.data.water)b.data.uvs.push(from,d,to,d,from,next,to,next);}}
 function wall(b:Batch,l:number,y0:number,y1:number,start=trackStart,end=trackEnd){for(let d=start;d<end;d+=2){const a=sample(d,l).p,c=sample(Math.min(end,d+2),l).p;b.quad(v(a.x,y0,a.z),v(a.x,y1,a.z),v(c.x,y0,c.z),v(c.x,y1,c.z));}}
 for(let l=-12;l<12;l++)ribbon(water,l,l+1,0,trackStart,trackEnd,closed?WATER_RACE_SURFACE_STEP:1.3);
 for(const s of[-1,1]){
 ribbon(cream,s*12,s*13.1,.28);wall(cream,s*12,-.4,.28);ribbon(sand,s*13.1,s*17.3,.28);wall(navy,s*17.3,.28,.85);wall(sand,s*17.4,.85,1.9);wall(aqua,s*17.25,1.9,2.65);
 ribbon(cream,s*17.05,s*18.15,2.7);
 if(!closed)ribbon(grass,s*18.15,s*65,2.25);
 for(let d=closed?0:-30;d<trackEnd;d+=5)ribbon(coral,s*12,s*12.65,.295,d,Math.min(trackEnd,d+2.4),1.2);
 for(const y of[3.1,3.65])wall(white,s*18.05,y,y+.07);
 for(let d=closed?0:-25;d<trackEnd-2;d+=closed?5.5:4){const p=sample(d,s*18.05).p;white.add(closed?railPost:cylinder,v(p.x,3.16,p.z),v(.1,1.15,.1));}
 }
 if(closed){const land=createWaterparkRaceLand(options);grass.data.positions.push(...land.positions);grass.data.indices.push(...land.indices);}
 function palm(d:number,l:number,h:number,seed:number){if(closed)l=Math.sign(l)*(22+(Math.abs(l)-23)*.25);const b=sample(d,l).p;if(!sceneryClear(b.x,b.z,6.1))return;
 for(let j=0;j<7;j++){const f=j/7;trunk.add(cylinder,v(b.x+Math.sin(seed)*f*f*1.3,2.25+h*f+h/14,b.z+f*f*.5),v(.53-f*.22,h/6.5,.53-f*.22),v(0,0,-Math.sin(seed)*9*f));}
 for(let j=0;j<3;j++)grass.add(new pc.SphereGeometry({latitudeBands:5,longitudeBands:8}),v(b.x+Math.sin(j*2)*1.2,2.65,b.z+Math.cos(j*2)*1.1),v(2.2,1.2,1.8));
 const top=v(b.x+Math.sin(seed)*1.3,2.25+h,b.z+.5);
 for(let leaf=0;leaf<9;leaf++){const a=leaf/9*Math.PI*2+seed,m=leaf%3?leaves:lime;
 for(let j=0;j<5;j++){const f=j/5,g=(j+1)/5,point=(t:number,s:number)=>{const r=4.5*t,w=Math.sin(t*Math.PI)*.63*s;return v(top.x+Math.cos(a)*r-Math.sin(a)*w,top.y+Math.sin(t*Math.PI)*1.05-t*t*1.7,top.z+Math.sin(a)*r+Math.cos(a)*w);};m.quad(point(f,-1),point(f,1),point(g,-1),point(g,1));}}
 for(let j=0;j<3;j++)trunk.add(closed?palmFruit:sphere,top.clone().add(v(Math.cos(j*2)*.3,-.3,Math.sin(j*2)*.3)),v(.45,.6,.45));}
 const palms = [[-3,-23,10],[15,23,9],[40,-26,12],[68,23,9.8],[100,-23,10],[128,24,11],[153,-25,10],[182,24,11],[217,-24,10],[249,26,11],[275,-23,9],[303,26,12]];
 for(const[d,l,h]of palms){palm(d,l,h,d*.67);if(closed)palm(d+WATER_RACE_LENGTH/2,l,h,d*.67+1);}
 function parasol(d:number,l:number,phase:number){const p=sample(d,l).p;if(!sceneryClear(p.x,p.z,3))return;white.add(cylinder,v(p.x,3.9,p.z),v(.14,3.4,.14));
 for(let i=0;i<12;i++){const b=i%2===0?roseFabric:ivoryFabric,a=i/12*Math.PI*2+phase,c=(i+1)/12*Math.PI*2+phase,tip=v(p.x,6.15,p.z),a1=v(p.x+Math.cos(a)*2.8,5.15,p.z+Math.sin(a)*2.8),b1=v(p.x+Math.cos(c)*2.8,5.15,p.z+Math.sin(c)*2.8);b.quad(tip,tip,a1,b1);b.quad(a1,b1,v(a1.x,4.82,a1.z),v(b1.x,4.82,b1.z));}
 sand.add(cylinder,v(p.x,3.1,p.z),v(1.65,.18,1.65));}
 for(const s of[-1,1])for(let d=23;d<trackEnd-25;d+=closed?33:25)parasol(d,s*(21.5+d%3),d*.2);
 const tower=closed?sample(WATER_RACE_TOWER_DISTANCE,WATER_RACE_TOWER_LANE).p:v(-15,0,130),tx=tower.x,tz=tower.z;purple.add(cylinder,v(tx,10,tz),v(12,16,12));
 for(const y of[4,10.5,17.8]){cream.add(cylinder,v(tx,y,tz),v(13.2,.55,13.2));aqua.add(cylinder,v(tx,y+1,tz),v(12.8,1.5,12.8));}
 for(let i=0;i<10;i++){const a=i*Math.PI/5;dark.add(box,v(tx+Math.sin(a)*6.01,14,tz+Math.cos(a)*6.01),v(1.5,2.2,.12),v(0,a*180/Math.PI,0));}
 dark.add(cylinder,v(tx,20,tz),v(10.8,3.6,10.8));for(let i=0;i<12;i++){const a=i*Math.PI/6;white.add(cylinder,v(tx+Math.sin(a)*5.45,20,tz+Math.cos(a)*5.45),v(.3,3.8,.3));}
 pink.add(new pc.ConeGeometry({baseRadius:7.7,peakRadius:1.3,height:3.7,capSegments:24}),v(tx,23.6,tz));white.add(sphere,v(tx,25.4,tz),v(1.4,.7,1.4));
 const bridge=sample(waterparkBridgeDistance(options)),yaw=bridge.angle*180/Math.PI,bp=(l:number,y:number,z=0)=>v(bridge.p.x+bridge.n.x*l+bridge.t.x*z,y,bridge.p.z+bridge.n.z*l+bridge.t.z*z);
 for(const s of[-1,1]){cream.add(box,bp(s*14.7,3.25),v(3.3,6.5,6),v(0,yaw,0));aqua.add(box,bp(s*14.7,1.1),v(3.55,1.6,6.25),v(0,yaw,0));}
 cream.add(box,bp(0,7.5),v(33,1.3,6.5),v(0,yaw,0));
 // Curved arch soffit creates a readable bridge silhouette rather than a flat slab.
 for(let l=-13;l<13;l+=1){const y=(x:number)=>4.85+2*(1-(x/13)**2),r=l+1;for(const f of[-1,1])cream.quad(bp(l,y(l),f*3.2),bp(l,6.9,f*3.2),bp(r,y(r),f*3.2),bp(r,6.9,f*3.2));cream.quad(bp(l,y(l),-3.2),bp(l,y(l),3.2),bp(r,y(r),-3.2),bp(r,y(r),3.2));}
 for(const f of[-1,1]){aqua.add(box,bp(0,8.55,f*3),v(34,1,.3),v(0,yaw,0));white.add(box,bp(0,9.13,f*3),v(34,.18,.45),v(0,yaw,0));for(let l=-16;l<=16;l+=2)white.add(box,bp(l,8.55,f*3),v(.16,1.4,.35),v(0,yaw,0));for(let l=-10;l<11;l+=2.5){const b=l%5===0?pink:cream,tip=bp(l+1,6.25,f*3.3);b.quad(bp(l,7.2,f*3.3),bp(l+2,7.2,f*3.3),tip,tip);}}
 for(const d of[212,267]){const p=sample(d,-27).p;if(!sceneryClear(p.x,p.z,6.2))continue;for(const x of[-1,1])for(const z of[-1,1])white.add(cylinder,v(p.x+x*3,4.5,p.z+z*3),v(.26,4.5,.26));pink.add(new pc.ConeGeometry({baseRadius:6,peakRadius:0,height:2.8,capSegments:4}),v(p.x,8,p.z),v(1,1,1),v(0,45,0));}
 for(let i=0;i<16;i++){const a=i*.84,x=Math.cos(a)*250+40,z=Math.sin(a)*250+140,y=78+i%4*15;for(let j=0;j<4;j++)cloud.add(sphere,v(x+j*10,y+Math.sin(j)*7,z),v(23+j%2*10,10+j%3*4,13));}
 return all.filter(b=>b.data.indices.length).map(b=>b.data);
}
