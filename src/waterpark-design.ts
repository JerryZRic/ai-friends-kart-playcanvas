/** Original geometry shared by native PlayCanvas and offline review renders. No racing physics. */
import * as pc from 'playcanvas';
export type MeshData = { name: string; color: string; positions: number[]; indices: number[]; uvs: number[]; water?: boolean };
export const SAMPLE_LENGTH=285, WATER_HALF_WIDTH=12, SAMPLE_SECONDS=18;
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
const box=new pc.BoxGeometry(),sphere=new pc.SphereGeometry({latitudeBands:8,longitudeBands:12}),cylinder=new pc.CylinderGeometry({radius:.5,height:1,capSegments:10,heightSegments:1});
export function createWaterparkDesign():MeshData[]{
 const all:Batch[]=[],batch=(n:string,c:string,w=false)=>{const b=new Batch(n,c,w);all.push(b);return b;};
 const water=batch('Turquoise flowing canal','#14bde6',true),cream=batch('Ivory coping and bridge stone','#fff0d4'),sand=batch('Warm sand promenade','#e5c598'),aqua=batch('Layered turquoise retaining walls','#279dbd'),navy=batch('Deep blue wall recess','#3f709f');
 const coral=batch('Coral curb accents','#fa9da9'),purple=batch('Orchid landmark tower','#b38ccc'),pink=batch('Rose tower roofs and canopies','#ed95c8'),white=batch('Pearl railings and canopy stripes','#fff5ed');
 const roseFabric=batch('Rose woven parasol panels','#ed9dc2'),ivoryFabric=batch('Ivory woven parasol stripes','#fff5ed');
 const grass=batch('Mint green planted banks','#92cc88'),trunk=batch('Palm trunks','#b59379'),leaves=batch('Palm jade leaves','#4fb694'),lime=batch('Palm lime leaves','#9ccf5e'),dark=batch('Tower window blue glass','#477dab'),cloud=batch('Soft cloud clusters','#ffffff');
 function ribbon(b:Batch,from:number,to:number,y:number,start=-35,end=335,step=2){for(let d=start;d<end;d+=step){const p=(s:number,l:number)=>{const q=sampleWaterpark(s,l).p;q.y=y;return q;},next=Math.min(end,d+step);b.quad(p(d,from),p(d,to),p(next,from),p(next,to));if(b.data.water)b.data.uvs.push(from,d,to,d,from,next,to,next);}}
 function wall(b:Batch,l:number,y0:number,y1:number,start=-35,end=335){for(let d=start;d<end;d+=2){const a=sampleWaterpark(d,l).p,c=sampleWaterpark(Math.min(end,d+2),l).p;b.quad(v(a.x,y0,a.z),v(a.x,y1,a.z),v(c.x,y0,c.z),v(c.x,y1,c.z));}}
 for(let l=-12;l<12;l++)ribbon(water,l,l+1,0,-35,335,1.3);
 for(const s of[-1,1]){
 ribbon(cream,s*12,s*13.1,.28);wall(cream,s*12,-.4,.28);ribbon(sand,s*13.1,s*17.3,.28);wall(navy,s*17.3,.28,.85);wall(sand,s*17.4,.85,1.9);wall(aqua,s*17.25,1.9,2.65);
 ribbon(cream,s*17.05,s*18.15,2.7);ribbon(grass,s*18.15,s*65,2.25);
 for(let d=-30;d<335;d+=5)ribbon(coral,s*12,s*12.65,.295,d,d+2.4,1.2);
 for(const y of[3.1,3.65])wall(white,s*18.05,y,y+.07);
 for(let d=-25;d<333;d+=4){const p=sampleWaterpark(d,s*18.05).p;white.add(cylinder,v(p.x,3.16,p.z),v(.1,1.15,.1));}
 }
 function palm(d:number,l:number,h:number,seed:number){const b=sampleWaterpark(d,l).p;
 for(let j=0;j<7;j++){const f=j/7;trunk.add(cylinder,v(b.x+Math.sin(seed)*f*f*1.3,2.25+h*f+h/14,b.z+f*f*.5),v(.53-f*.22,h/6.5,.53-f*.22),v(0,0,-Math.sin(seed)*9*f));}
 for(let j=0;j<3;j++)grass.add(new pc.SphereGeometry({latitudeBands:5,longitudeBands:8}),v(b.x+Math.sin(j*2)*1.2,2.65,b.z+Math.cos(j*2)*1.1),v(2.2,1.2,1.8));
 const top=v(b.x+Math.sin(seed)*1.3,2.25+h,b.z+.5);
 for(let leaf=0;leaf<9;leaf++){const a=leaf/9*Math.PI*2+seed,m=leaf%3?leaves:lime;
 for(let j=0;j<5;j++){const f=j/5,g=(j+1)/5,point=(t:number,s:number)=>{const r=4.5*t,w=Math.sin(t*Math.PI)*.63*s;return v(top.x+Math.cos(a)*r-Math.sin(a)*w,top.y+Math.sin(t*Math.PI)*1.05-t*t*1.7,top.z+Math.sin(a)*r+Math.cos(a)*w);};m.quad(point(f,-1),point(f,1),point(g,-1),point(g,1));}}
 for(let j=0;j<3;j++)trunk.add(sphere,top.clone().add(v(Math.cos(j*2)*.3,-.3,Math.sin(j*2)*.3)),v(.45,.6,.45));}
 for(const[d,l,h]of[[-3,-23,10],[15,23,9],[40,-26,12],[68,23,9.8],[100,-23,10],[128,24,11],[153,-25,10],[182,24,11],[217,-24,10],[249,26,11],[275,-23,9],[303,26,12]])palm(d,l,h,d*.67);
 function parasol(d:number,l:number,phase:number){const p=sampleWaterpark(d,l).p;white.add(cylinder,v(p.x,3.9,p.z),v(.14,3.4,.14));
 for(let i=0;i<12;i++){const b=i%2===0?roseFabric:ivoryFabric,a=i/12*Math.PI*2+phase,c=(i+1)/12*Math.PI*2+phase,tip=v(p.x,6.15,p.z),a1=v(p.x+Math.cos(a)*2.8,5.15,p.z+Math.sin(a)*2.8),b1=v(p.x+Math.cos(c)*2.8,5.15,p.z+Math.sin(c)*2.8);b.quad(tip,tip,a1,b1);b.quad(a1,b1,v(a1.x,4.82,a1.z),v(b1.x,4.82,b1.z));}
 sand.add(cylinder,v(p.x,3.1,p.z),v(1.65,.18,1.65));}
 for(const s of[-1,1])for(let d=23;d<310;d+=25)parasol(d,s*(21.5+d%3),d*.2);
 const tx=-15,tz=130;purple.add(cylinder,v(tx,10,tz),v(12,16,12));
 for(const y of[4,10.5,17.8]){cream.add(cylinder,v(tx,y,tz),v(13.2,.55,13.2));aqua.add(cylinder,v(tx,y+1,tz),v(12.8,1.5,12.8));}
 for(let i=0;i<10;i++){const a=i*Math.PI/5;dark.add(box,v(tx+Math.sin(a)*6.01,14,tz+Math.cos(a)*6.01),v(1.5,2.2,.12),v(0,a*180/Math.PI,0));}
 dark.add(cylinder,v(tx,20,tz),v(10.8,3.6,10.8));for(let i=0;i<12;i++){const a=i*Math.PI/6;white.add(cylinder,v(tx+Math.sin(a)*5.45,20,tz+Math.cos(a)*5.45),v(.3,3.8,.3));}
 pink.add(new pc.ConeGeometry({baseRadius:7.7,peakRadius:1.3,height:3.7,capSegments:24}),v(tx,23.6,tz));white.add(sphere,v(tx,25.4,tz),v(1.4,.7,1.4));
 const bridge=sampleWaterpark(183),yaw=bridge.angle*180/Math.PI,bp=(l:number,y:number,z=0)=>v(bridge.p.x+bridge.n.x*l+bridge.t.x*z,y,bridge.p.z+bridge.n.z*l+bridge.t.z*z);
 for(const s of[-1,1]){cream.add(box,bp(s*14.7,3.25),v(3.3,6.5,6),v(0,yaw,0));aqua.add(box,bp(s*14.7,1.1),v(3.55,1.6,6.25),v(0,yaw,0));}
 cream.add(box,bp(0,7.5),v(33,1.3,6.5),v(0,yaw,0));
 // Curved arch soffit creates a readable bridge silhouette rather than a flat slab.
 for(let l=-13;l<13;l+=1){const y=(x:number)=>4.85+2*(1-(x/13)**2),r=l+1;for(const f of[-1,1])cream.quad(bp(l,y(l),f*3.2),bp(l,6.9,f*3.2),bp(r,y(r),f*3.2),bp(r,6.9,f*3.2));cream.quad(bp(l,y(l),-3.2),bp(l,y(l),3.2),bp(r,y(r),-3.2),bp(r,y(r),3.2));}
 for(const f of[-1,1]){aqua.add(box,bp(0,8.55,f*3),v(34,1,.3),v(0,yaw,0));white.add(box,bp(0,9.13,f*3),v(34,.18,.45),v(0,yaw,0));for(let l=-16;l<=16;l+=2)white.add(box,bp(l,8.55,f*3),v(.16,1.4,.35),v(0,yaw,0));for(let l=-10;l<11;l+=2.5){const b=l%5===0?pink:cream,tip=bp(l+1,6.25,f*3.3);b.quad(bp(l,7.2,f*3.3),bp(l+2,7.2,f*3.3),tip,tip);}}
 for(const d of[212,267]){const p=sampleWaterpark(d,-27).p;for(const x of[-1,1])for(const z of[-1,1])white.add(cylinder,v(p.x+x*3,4.5,p.z+z*3),v(.26,4.5,.26));pink.add(new pc.ConeGeometry({baseRadius:6,peakRadius:0,height:2.8,capSegments:4}),v(p.x,8,p.z),v(1,1,1),v(0,45,0));}
 for(let i=0;i<16;i++){const a=i*.84,x=Math.cos(a)*250+40,z=Math.sin(a)*250+140,y=78+i%4*15;for(let j=0;j<4;j++)cloud.add(sphere,v(x+j*10,y+Math.sin(j)*7,z),v(23+j%2*10,10+j%3*4,13));}
 return all.filter(b=>b.data.indices.length).map(b=>b.data);
}
