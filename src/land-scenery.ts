import * as pc from 'playcanvas';
import type { LandTrack } from './land-track';

export type LandSurfaceTexture = 'stone' | 'asphalt' | 'wood' | 'grass' | 'none';
export interface LandGeometryBatch {
  name: string; color: string; roughness: number; metalness: number;
  texture: LandSurfaceTexture; positions: number[]; indices: number[]; uvs: number[];
}
export interface LandPropPlacement { kind: string; x: number; y: number; z: number; radius: number }
export interface LandSceneGeometry {
  version: 1; trackId: string; batches: LandGeometryBatch[];
  roadSamples: {distance: number; left: number[]; right: number[]}[];
  props: LandPropPlacement[];
  structures: {kind: 'viaduct' | 'gallery'; from: number; to: number; overheadClearance: number}[];
  bounds: {min: number[]; max: number[]};
}
const vec = (x: number, y: number, z: number) => new pc.Vec3(x, y, z);
const noise = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const tuple = (p: pc.Vec3) => [p.x, p.y, p.z];

/** Pure source geometry, also consumed by offline previews. No separate artist
 * mesh can drift away from the actual sampled racing line, bank or grade. */
class Batch implements LandGeometryBatch {
  positions: number[] = []; indices: number[] = []; uvs: number[] = [];
  constructor(public name: string, public color: string, public roughness = .9,
    public texture: LandSurfaceTexture = 'none', public metalness = 0) {}
  vertex(p: pc.Vec3, uv?: number[]) {
    this.positions.push(p.x, p.y, p.z); this.uvs.push(...(uv ?? [p.x * .15, p.z * .15]));
  }
  tri(a: pc.Vec3, b: pc.Vec3, c: pc.Vec3) {
    const i = this.positions.length / 3;
    this.vertex(a); this.vertex(b); this.vertex(c); this.indices.push(i, i + 1, i + 2);
  }
  quad(a: pc.Vec3, b: pc.Vec3, c: pc.Vec3, d: pc.Vec3) {
    const i = this.positions.length / 3;
    this.vertex(a); this.vertex(b); this.vertex(c); this.vertex(d);
    this.indices.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
  }
  box(p: pc.Vec3, size: pc.Vec3, yaw = 0) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const at = (x: number, y: number, z: number) => vec(p.x + x * c + z * s, p.y + y, p.z - x * s + z * c);
    const [x, y, z] = [size.x / 2, size.y / 2, size.z / 2];
    const corners = [at(-x,-y,-z),at(x,-y,-z),at(-x,y,-z),at(x,y,-z),at(-x,-y,z),at(x,-y,z),at(-x,y,z),at(x,y,z)];
    for (const face of [[0,1,2,3],[5,4,7,6],[4,0,6,2],[1,5,3,7],[2,3,6,7],[4,5,0,1]]) {
      const i = this.positions.length / 3;
      face.forEach((index, k) => this.vertex(corners[index], [(k % 2) * Math.max(size.x,size.z) * .3, Math.floor(k / 2) * size.y * .3]));
      this.indices.push(i,i+2,i+1,i+1,i+2,i+3);
    }
  }
  cone(p: pc.Vec3, radius: number, height: number, sides = 7, seed = 0) {
    const peak = p.clone().add(vec(0,height,0));
    for (let i = 0; i < sides; i++) {
      const a = (i / sides * Math.PI * 2) + seed, b = ((i + 1) / sides * Math.PI * 2) + seed;
      this.tri(vec(p.x + Math.cos(a)*radius,p.y,p.z + Math.sin(a)*radius), peak,
        vec(p.x + Math.cos(b)*radius,p.y,p.z + Math.sin(b)*radius));
    }
  }
}

/** Tileable original CPU textures: works on NullGraphicsDevice and needs no
 * canvas, downloaded asset, network request or per-frame generation. */
export function landTexturePixels(kind: Exclude<LandSurfaceTexture, 'none'>, size = 64): Uint8Array {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = noise(x + y * size), u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
    const tone = kind === 'asphalt' ? .78 + .21 * n - (n > .965 ? .17 : 0)
      : kind === 'wood' ? .69 + .16 * Math.sin(u * 7 + Math.sin(v)*1.8) + n * .12
      : kind === 'stone' ? .77 + .1 * Math.sin(v * 5 + Math.sin(u*2)) + n * .15
      : .77 + n * .22;
    const i = (y * size + x) * 4, c = Math.round(Math.max(0,Math.min(1,tone))*255);
    pixels[i] = pixels[i+1] = pixels[i+2] = c; pixels[i+3] = 255;
  }
  return pixels;
}

export function buildLandSceneGeometry(track: LandTrack): LandSceneGeometry {
  const asphalt = new Batch('Mountain banked tarmac', '#49515a', .97, 'asphalt');
  const roughAsphalt = new Batch('Weathered aggregate tarmac', '#62696b', 1, 'asphalt');
  const underpassStone = new Batch('Underpass dressed stone roadway', '#92958d', .94, 'stone');
  const shoulder = new Batch('Crushed limestone shoulders', '#a6a28c', .99, 'stone');
  const stone = new Batch('Stratified granite and retaining masonry', '#858f91', .96, 'stone');
  const lightStone = new Batch('Weathered limestone strata', '#b6b8a7', .98, 'stone');
  const darkStone = new Batch('Slate ledges and viaduct soffits', '#566570', .96, 'stone');
  const turf = new Batch('Alpine terrace meadow', '#6b8661', .98, 'grass');
  const valley = new Batch('Forest valley floor', '#465f4e', 1, 'grass');
  const distant = new Batch('Distant blue mountain ridges', '#657f91', 1, 'stone');
  const snow = new Batch('High ridge limestone snow patches', '#e0e7df', .88);
  const rail = new Batch('Galvanized double guardrail', '#bdc8c9', .46, 'none', .65);
  const white = new Batch('Ivory road markings', '#f1ebce', .81);
  const yellow = new Batch('Amber edge reflectors', '#e8ab4d', .67);
  const red = new Batch('Oxblood safety kerbs and roof', '#ad5b4b', .92);
  const wood = new Batch('Lookout cedar timber', '#755441', .94, 'wood');
  const bark = new Batch('Spruce trunks and fence timber', '#55463a', .97, 'wood');
  const pine = new Batch('Spruce shaded boughs', '#294d43', 1);
  const pineTips = new Batch('Spruce fresh alpine tips', '#426c53', 1);
  const glass = new Batch('Chalet amber windows', '#d7b778', .24, 'none', .15);
  const batches = [asphalt,roughAsphalt,underpassStone,shoulder,stone,lightStone,darkStone,turf,valley,distant,snow,rail,white,yellow,red,wood,bark,pine,pineTips,glass];
  const props: LandPropPlacement[] = [], structures: LandSceneGeometry['structures'] = [];
  const roadSamples: LandSceneGeometry['roadSamples'] = [];
  const samples = 960, step = track.length / samples;
  const point = (d: number, lateral: number, height = 0) => {const p = track.sample(d,lateral).p.clone(); p.y += height; return p;};
  const ribbon = (batch: Batch, d: number, next: number, a: number, b: number, height = 0) =>
    batch.quad(point(d,a,height),point(d,b,height),point(next,a,height),point(next,b,height));
  const spans = track.sections as readonly {name: string; from: number; to: number; kind?: string}[];
  const bridge = spans.find(s => /viaduct|bridge/i.test(s.kind ?? '') || /viaduct|bridge/i.test(s.name));
  const gallery = spans.find(s => /gallery|tunnel/i.test(s.kind ?? '') || /gallery|tunnel/i.test(s.name));
  const within = (d: number, span?: {from: number; to: number}) => span && d >= span.from && d <= span.to;
  let minimum = Infinity;
  for(let i=0;i<samples;i++) minimum = Math.min(minimum,track.sample(i*step).p.y - Math.abs(track.sample(i*step).n.y)*track.halfWidthAt(i*step));
  const floor = minimum - 19;

  for(let i=0;i<samples;i++) {
    const d=i*step, next=(i+1)*step, w=track.halfWidthAt(d), wn=track.halfWidthAt(next);
    const a=point(d,-w),b=point(d,w),c=point(next,-wn),e=point(next,wn);
    const surface=track.surfaceAt(d).kind;
    (surface==='rough-asphalt'?roughAsphalt:surface==='underpass-stone'?underpassStone:asphalt).quad(a,b,c,e);
    roadSamples.push({distance:d,left:tuple(a),right:tuple(b)});
    for(const side of [-1,1]) {
      shoulder.quad(point(d,side*w,-.04),point(d,side*(w+1.5),-.04),point(next,side*wn,-.04),point(next,side*(wn+1.5),-.04));
      ribbon(i%8<4?white:red,d,next,side*(w+.10),side*(w+.65),.035);
      // Both beam courses follow grade and lateral banking without flat boxes.
      for(const h of [.77,1.10]) rail.quad(point(d,side*(w+1.25),h),point(d,side*(w+1.25),h+.16),point(next,side*(wn+1.25),h),point(next,side*(wn+1.25),h+.16));
      const edgeA=point(d,side*(w+1.5),-.12),edgeB=point(next,side*(wn+1.5),-.12);
      if(within(d,bridge)) {
        darkStone.quad(edgeA,edgeA.clone().add(vec(0,-1.1,0)),edgeB,edgeB.clone().add(vec(0,-1.1,0)));
      } else {
        // Narrow terrace caps cannot cut across an adjacent racing ribbon.
        const outerA=point(d,side*(w+4.8),-1.5),outerB=point(next,side*(wn+4.8),-1.5);
        if(track.clearAt(outerA.x,outerA.z,0) && track.clearAt(outerB.x,outerB.z,0)) {
          turf.quad(edgeA,outerA,edgeB,outerB);
          const bottomA=outerA.clone(),bottomB=outerB.clone(); bottomA.y=floor;bottomB.y=floor;
          (i%11<4?lightStone:stone).quad(outerA,bottomA,outerB,bottomB);
        } else {
          const bottomA=edgeA.clone(),bottomB=edgeB.clone();bottomA.y=floor;bottomB.y=floor;
          stone.quad(edgeA,bottomA,edgeB,bottomB);
        }
      }
    }
    if(i%10<5) ribbon(white,d,next,-.055,.055,.025);
    if(i%4===0) for(const side of [-1,1]) {
      const p=point(d,side*(w+1.25),.57),yaw=track.sample(d).angle;
      rail.box(p,vec(.12,1.18,.14),yaw);
      if(i%12===0) yellow.box(point(d,side*(w+1.23),1.12),vec(.2,.13,.10),yaw);
    }
  }
  for(let row=0;row<2;row++) for(let col=0;col<16;col++) if((row+col)%2===0) {
    const w=track.halfWidthAt(0); ribbon(white,row*.7,(row+1)*.7,-w+col*w/8,-w+(col+1)*w/8,.045);
  }

  // Irregular, stepped rock masses share three material batches. Each mass is
  // bounded by its declared clearance radius, including its highest ledges.
  function rock(p: pc.Vec3,radius: number,height: number,seed: number,remote=false) {
    const sides=9,ringCount=5, rings: pc.Vec3[][]=[];
    for(let ring=0;ring<ringCount;ring++) {
      const factor=[1,.93,.73,.49,.11][ring];
      rings.push(Array.from({length:sides},(_,j)=>{
        const angle=j/sides*Math.PI*2, rr=radius*factor*(.79+.2*noise(seed+j*3+ring*17));
        return vec(p.x+Math.cos(angle)*rr,p.y+height*ring/(ringCount-1)+height*.08*(noise(seed+j*7)-.5),p.z+Math.sin(angle)*rr);
      }));
    }
    for(let ring=0;ring<ringCount-1;ring++) for(let j=0;j<sides;j++) {
      const batch=remote?distant:ring===2?lightStone:(j+ring)%3===0?darkStone:stone;
      const a=rings[ring][j],b=rings[ring][(j+1)%sides],c=rings[ring+1][j],d=rings[ring+1][(j+1)%sides];
      batch.quad(a,b,c,d);
    }
    const peak=vec(p.x,p.y+height*1.02,p.z);
    for(let j=0;j<sides;j++) (remote?snow:lightStone).tri(rings[4][j],peak,rings[4][(j+1)%sides]);
  }
  const centers=Array.from({length:80},(_,i)=>track.sample(i/80*track.length).p);
  const minX=Math.min(...centers.map(p=>p.x)),maxX=Math.max(...centers.map(p=>p.x));
  const minZ=Math.min(...centers.map(p=>p.z)),maxZ=Math.max(...centers.map(p=>p.z));
  const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2,extent=Math.max(maxX-minX,maxZ-minZ)/2;
  // A source-derived heightfield joins the roadside terraces into land rather
  // than isolated floating track ribbons. The lower deck wins at crossings:
  // a conservative neighborhood ceiling prevents a terrain triangle entering
  // either drivable corridor, even between grid vertices.
  const groundSamples=Array.from({length:Math.ceil(track.length/9)},(_,i)=>{
    const d=i/Math.ceil(track.length/9)*track.length,s=track.sample(d);
    return {p:s.p,half:track.halfWidthAt(d),edge:s.p.y-Math.abs(s.n.y)*track.halfWidthAt(d)};
  });
  const terrainHeight=(x:number,z:number)=>{
    let nearest=Infinity,nearHeight=floor,ceiling=Infinity;
    for(const s of groundSamples) {
      const d=Math.hypot(x-s.p.x,z-s.p.z);
      if(d<nearest){nearest=d;nearHeight=s.edge;}
      if(d<s.half+24)ceiling=Math.min(ceiling,s.edge-3.2);
    }
    const blend=Math.max(0,1-Math.max(0,nearest-8)/100);
    return Math.min(ceiling,floor+(nearHeight-4-floor)*blend+(Math.sin(x*.031)*Math.cos(z*.026))*Math.min(2,nearest/20));
  };
  const groundMinX=cx-extent-210,groundMaxX=cx+extent+210,groundMinZ=cz-extent-210,groundMaxZ=cz+extent+210;
  const nx=Math.ceil((groundMaxX-groundMinX)/12),nz=Math.ceil((groundMaxZ-groundMinZ)/12);
  for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++) {
    const px=groundMinX+(groundMaxX-groundMinX)*x/nx,pz=groundMinZ+(groundMaxZ-groundMinZ)*z/nz;
    valley.vertex(vec(px,terrainHeight(px,pz),pz));
    if(x<nx&&z<nz){const i=z*(nx+1)+x;valley.indices.push(i,i+nx+1,i+1,i+1,i+nx+1,i+nx+2);}
  }
  for(let i=0;i<22;i++) {
    const a=i/22*Math.PI*2,r=extent+110+noise(i)*90,p=vec(cx+Math.cos(a)*r,floor-8,cz+Math.sin(a)*r);
    const radius=38+noise(i+90)*35,height=85+noise(i+35)*105;
    if(track.clearAt(p.x,p.z,radius+4)) {rock(p,radius,height,i*5,true);props.push({kind:'distant-ridge',x:p.x,y:p.y,z:p.z,radius});}
  }
  for(let i=0;i<78;i++) {
    const d=i/78*track.length,side=i%2?1:-1,radius=6+noise(i)*11;
    const p=point(d,side*(track.halfWidthAt(d)+radius+8+noise(i+8)*14),-8);
    if(track.clearAt(p.x,p.z,radius+1)) {rock(p,radius,12+noise(i+80)*30,i+50);props.push({kind:'roadside-rock',x:p.x,y:p.y,z:p.z,radius});}
  }
  // Spruces grow in deliberate three-tree clusters on the actual heightfield;
  // small rooted stone collars cover terrain interpolation without tall plinths.
  for(let i=0;i<240;i++) {
    const cluster=Math.floor(i/3),member=i%3;
    const d=cluster/80*track.length+(member-1)*5,side=cluster%3===0?-1:1,radius=2.4+noise(i+250)*1.7;
    const p=point(d,side*(track.halfWidthAt(d)+12+noise(cluster+5)*21+member*3),-1.7),height=8+noise(i+130)*9;
    if(!track.clearAt(p.x,p.z,radius+1)) continue;
    p.y=terrainHeight(p.x,p.z)-.25;
    stone.box(p.clone().add(vec(0,-.18,0)),vec(radius*.65,.7,radius*.65));
    bark.box(p.clone().add(vec(0,height*.28,0)),vec(.35,height*.62,.35));
    for(let j=0;j<4;j++) (j%2?pineTips:pine).cone(p.clone().add(vec(0,height*(.18+j*.17),0)),radius*(1-j*.21),height*.43,7,i*.9);
    props.push({kind:'spruce',x:p.x,y:p.y,z:p.z,radius});
  }

  if(bridge) {
    let crossingClearance=Infinity;
    for(let d=bridge.from;d<bridge.to;d+=8) {
      const upper=track.sample(d),w=track.halfWidthAt(d);
      for(let q=0;q<track.length;q+=8) {
        const separation=Math.min(Math.abs(d-q),track.length-Math.abs(d-q));if(separation<110)continue;
        const lower=track.sample(q),lw=track.halfWidthAt(q);
        if(Math.hypot(upper.p.x-lower.p.x,upper.p.z-lower.p.z)>w+lw+4||lower.p.y>=upper.p.y)continue;
        crossingClearance=Math.min(crossingClearance,upper.p.y-Math.abs(upper.n.y)*(w+7.3)-1.9-lower.p.y-Math.abs(lower.n.y)*lw);
      }
    }
    structures.push({kind:'viaduct',from:bridge.from,to:bridge.to,overheadClearance:Number.isFinite(crossingClearance)?crossingClearance:0});
    const count=Math.max(2,Math.ceil((bridge.to-bridge.from)/18));
    // Deck undersurface and piers use the actual bridge spline. Twin piers
    // stay outside the driving corridor; no column rises through the road.
    for(let i=0;i<count;i++) {
      const d=bridge.from+(bridge.to-bridge.from)*(i+.5)/count,w=track.halfWidthAt(d),s=track.sample(d);
      const beamY=s.p.y-Math.abs(s.n.y)*(w+6.5)-1.5;
      darkStone.box(vec(s.p.x,beamY,s.p.z),vec((w+7.3)*2,.8,2.3),s.angle);
      for(const side of [-1,1]) {
        const p=point(d,side*(w+6.5),-1.0);
        p.y=beamY-.4;
        if(!track.clearAt(p.x,p.z,2.4)) continue;
        const h=p.y-floor;
        stone.box(vec(p.x,floor+h/2,p.z),vec(1.5,h,2.2),s.angle);
        lightStone.box(vec(p.x,floor+.6,p.z),vec(3,1.2,3.5),s.angle);
        props.push({kind:'viaduct-pier',x:p.x,y:floor,z:p.z,radius:2.4});
      }
    }
    for(let d=bridge.from;d<bridge.to;d+=step) {
      const end=Math.min(bridge.to,d+step),w=track.halfWidthAt(d),wn=track.halfWidthAt(end);
      darkStone.quad(point(d,-w-1.5,-1.1),point(d,w+1.5,-1.1),point(end,-wn-1.5,-1.1),point(end,wn+1.5,-1.1));
    }
  }
  if(gallery) {
    structures.push({kind:'gallery',from:gallery.from,to:gallery.to,overheadClearance:8.4});
    for(let d=gallery.from;d<gallery.to;d+=step*2) {
      const end=Math.min(d+step*2,gallery.to),w=track.halfWidthAt(d)+2.8,wn=track.halfWidthAt(end)+2.8;
      lightStone.quad(point(d,-w,9),point(d,w,9),point(end,-wn,9),point(end,wn,9));
      darkStone.quad(point(d,-w,8.4),point(d,w,8.4),point(end,-wn,8.4),point(end,wn,8.4));
      for(const side of [-1,1]) stone.quad(point(d,side*w,8.4),point(d,side*w,9),point(end,side*wn,8.4),point(end,side*wn,9));
    }
    for(let d=gallery.from;d<=gallery.to;d+=9) {
      const w=track.halfWidthAt(d),s=track.sample(d);
      for(const side of [-1,1]) {
        const p=point(d,side*(w+2.25),4.05);
        stone.box(p,vec(.65,8.7,.8),s.angle);
        lightStone.box(point(d,side*(w+2.25),.35),vec(1,.7,1.3),s.angle);
      }
    }
  }

  // Chalet/lookout: genuinely modeled stone footing, timber courses, pitched
  // roof, rafters, glazed windows, balcony and fence, not a texture billboard.
  for(const fraction of [.045,.56,.72]) {
    const d=fraction*track.length,w=track.halfWidthAt(d),s=track.sample(d);
    let p=point(d,w+22,-1.8);
    if(!track.clearAt(p.x,p.z,12)) {p=point(d,-w-22,-1.8);if(!track.clearAt(p.x,p.z,12))continue;}
    const yaw=s.angle, local=(x:number,y:number,z:number)=>vec(p.x+x*Math.cos(yaw)+z*Math.sin(yaw),p.y+y,p.z-x*Math.sin(yaw)+z*Math.cos(yaw));
    const put=(batch:Batch,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>batch.box(local(x,y,z),vec(sx,sy,sz),yaw);
    put(stone,0,(floor-p.y)/2,0,18,p.y-floor,15);put(lightStone,0,.1,0,18,.3,15);
    put(stone,0,1.3,0,10,2.6,8);put(wood,0,4,0,10,3.2,8);
    for(let y=2.6;y<5.7;y+=.45) for(const z of [-4.1,4.1]) put(bark,0,y,z,10.5,.08,.12);
    for(const z of [-4.03,4.03]) for(const x of [-3.1,0,3.1]) {put(glass,x,4.15,z,1.6,1.55,.07);put(bark,x,4.15,z, .10,1.8,.16);put(bark,x,4.15,z,1.85,.10,.16);}
    // Four triangles make solid gables; roof planes overlap generous eaves.
    for(const z of [-4,4]) wood.tri(local(-5,5.6,z),local(0,8.2,z),local(5,5.6,z));
    red.quad(local(-5.9,5.45,-4.9),local(0,8.45,-4.9),local(-5.9,5.45,4.9),local(0,8.45,4.9));
    red.quad(local(0,8.45,-4.9),local(5.9,5.45,-4.9),local(0,8.45,4.9),local(5.9,5.45,4.9));
    put(stone,3.1,7,1.3,1.1,4.2,1.1);put(darkStone,3.1,9.15,1.3,1.5,.25,1.5);
    put(wood,0,2.5,5.3,12,.3,2.6);
    for(let x=-5.5;x<=5.5;x+=1.1) {put(bark,x,3.15,6.45,.12,1.2,.12);put(bark,x,1.15,6.45,.22,2.3,.22);}
    put(wood,0,3.7,6.45,12,.16,.16);
    for(const side of [-1,1]) {
      for(let z=-6.5;z<=6.5;z+=2)put(wood,side*8.5,.8,z,.2,1.6,.2);
      put(wood,side*8.5,1.2,0,.14,.15,14);put(wood,side*8.5,.65,0,.14,.15,14);
    }
    props.push({kind:'lookout-chalet',x:p.x,y:p.y,z:p.z,radius:12});
    break;
  }
  const used=batches.filter(b=>b.indices.length>0), min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const b of used) for(let i=0;i<b.positions.length;i++){const axis=i%3;min[axis]=Math.min(min[axis],b.positions[i]);max[axis]=Math.max(max[axis],b.positions[i]);}
  return {version:1,trackId:track.id,batches:used,roadSamples,props,structures,bounds:{min,max}};
}
