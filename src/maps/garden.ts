/** Original Verdant Canopy route. Exact frozen source geometry; no spline refit. */
import {Vec3} from 'playcanvas';
import {OpenRoad} from '../open-road';
import type {ClosedCircuit,CircuitPoint} from '../closed-circuit';
import {wrapLandDistance,type LandSample,type LandSurface,type LandTrack} from '../land-track';
import type {RouteEdgeId,RouteEdge,ForkCourse,CheckpointGate} from '../land-routes';
export const GARDEN_META=Object.freeze({id:'garden',label:'蔓穹花园',tag:'VERDANT CANOPY',description:'Alternating planted terraces and a crescent fold lead to an open timber-lattice weave or outer garden sweep, then a graded basin return.',branchLabels:{alley:'蔓架曲径 / Arbor Weave',boulevard:'外园舒弧 / Petal Sweep'},originality:'Original noncrossing asymmetric three-lobe terraced botanical route, open timber-lattice arbor, modeled botanical leaves and connected planted terrain. No copied commercial layout, models, logos or textures.'});
const points={
 start:[[-350,14,-160],[-350,14,-40],[-300,18,90],[-175,24,125],[-90,27,90],[-20,27,145],[-30,25,255],[70,22,315],[180,21,275],[215,20,170],[178,19,85],[220,18,20],[220,18,-40],[220,18,-150]],
 alley:[[220,18,-150],[190,18,-230],[225,18,-310],[190,18,-390],[220,18,-470]],
 boulevard:[[220,18,-150],[236.40202,18,-190],[276,18,-230],[315.59798,18,-270],[332,18,-310],[315.59798,18,-350],[276,18,-390],[236.40202,18,-430],[220,18,-470]],
 finish:[[220,18,-510],[130,21,-570],[-10,25,-545],[-110,24,-475],[-200,20,-505],[-300,15,-460],[-375,7,-360],[-350,14,-240],[-350,14,-160]],
} as const satisfies Record<RouteEdgeId,readonly CircuitPoint[]>;
export const GARDEN_POINTS=Object.freeze(Object.fromEntries(Object.entries(points).map(([id,knots])=>[id,Object.freeze(knots.map(p=>Object.freeze(p)))]))) as Readonly<Record<RouteEdgeId,readonly CircuitPoint[]>>;
const north=[0,0,1]as const,south=[0,0,-1]as const,edgeIds=['start','alley','boulevard','finish']as const;
export const GARDEN_SHARED_MERGE_LENGTH=40;
export const GARDEN_MERGE_TAIL_POINTS=Object.freeze([Object.freeze([220,18,-470] as const),Object.freeze([220,18,-510] as const)]);
export const GARDEN_MERGE_TAIL=new OpenRoad(GARDEN_MERGE_TAIL_POINTS,south,south);
export const GARDEN_DECISION_APPROACH_LENGTH=100;
const bound=(s:number,l:number)=>Math.max(0,Math.min(l,Number.isFinite(s)?s:0));
const smooth=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
const window=(s:number,a:number,b:number,r:number)=>smooth((s-a)/r)*smooth((b-s)/r);
export const GARDEN_BASES=Object.freeze(Object.fromEntries(edgeIds.map(id=>[id,new OpenRoad(GARDEN_POINTS[id],id==='start'?north:south,id==='finish'?north:south)])))as Readonly<Record<RouteEdgeId,OpenRoad>>;
export const GARDEN_ROADS=Object.freeze(Object.fromEntries(edgeIds.map(id=>{const base=GARDEN_BASES[id];if(id==='start'||id==='finish')return[id,base];const length=base.length+GARDEN_MERGE_TAIL.length;return[id,Object.freeze({length,sample:(s:number,lateral=0)=>{s=bound(s,length);return length-s<=40?GARDEN_MERGE_TAIL.sample(40-(length-s),lateral):base.sample(s,lateral);}})];})))as Readonly<Record<RouteEdgeId,Pick<OpenRoad,'length'|'sample'>>>;
const gardenStone:LandSurface=Object.freeze({kind:'garden-warm-stone-road',grip:.975,rollingResistance:1.018});
const arborPaving:LandSurface=Object.freeze({kind:'garden-arbor-jointed-paving',grip:.94,rollingResistance:1.045});
export const GARDEN_EDGES=Object.freeze(Object.fromEntries(edgeIds.map(id=>{const road=GARDEN_ROADS[id];
 const halfWidthAt=(d:number)=>{const s=bound(d,road.length);return id==='alley'?5.8+3.7*(1-smooth(Math.min(s,Math.max(0,road.length-s-40))/70)):9.5;};
 const sample=(d:number,lateral=0):LandSample=>{const s=bound(d,road.length),q=road.sample(s),bank=id==='start'?.025*window(s,170,390,80)-.022*window(s,700,1110,80):id==='boulevard'?-.032*window(s,80,330,60):id==='finish'?.022*window(s,150,430,80):0;const up=new Vec3().cross(q.t,q.n).normalize(),n=q.n.clone().mulScalar(Math.cos(bank)).add(up.mulScalar(Math.sin(bank))).normalize(),normal=new Vec3().cross(q.t,n).normalize();return{...q,p:q.p.add(n.clone().mulScalar(Number.isFinite(lateral)?lateral:0)),n,normal,bank};};
 return[id,Object.freeze({id,length:road.length,sample,halfWidthAt,laneLimitAt:(s:number)=>halfWidthAt(s)-.65,surfaceAt:(d:number)=>{const s=bound(d,road.length);return id==='alley'&&s>80&&s<road.length-120?arborPaving:gardenStone;}})];
})))as Readonly<Record<RouteEdgeId,RouteEdge>>;
const {start,alley,boulevard,finish}=GARDEN_EDGES;
const gate=(index:number,edgeId:RouteEdgeId,f:number):CheckpointGate=>Object.freeze({index,edgeId,s:GARDEN_EDGES[edgeId].length*f});
export const GARDEN_COURSE:ForkCourse=Object.freeze({id:GARDEN_META.id,edges:GARDEN_EDGES,commonStart:start,commonFinish:finish,alternates:Object.freeze({alley,boulevard}),sharedMergeLength:40,canonicalLength:start.length+boulevard.length+finish.length,gatesPerLap:8,presentation:Object.freeze({branchLabels:Object.freeze({alley:'蔓架曲径',boulevard:'外园舒弧'})}),checkpointGates:Object.freeze([gate(0,'start',.34),gate(1,'start',.92),gate(2,'alley',.30),gate(3,'alley',.76),gate(2,'boulevard',.30),gate(3,'boulevard',.76),gate(4,'finish',.16),gate(5,'finish',.44),gate(6,'finish',.78),gate(7,'finish',1)])});
export const GARDEN_ROAD_EDGES=Object.freeze(edgeIds.map(id=>GARDEN_EDGES[id]));

/** Whole-footprint reservations; provisional seed heights are not terrain contacts. */
export const GARDEN_LANDMARKS=Object.freeze({
 split:Object.freeze({x:220,y:18,z:-150}),merge:Object.freeze({x:220,y:18,z:-510}),
 junctionClearance:110,
 plots:Object.freeze([
  Object.freeze({"id":"foldleaf-fan","x":-280.40518595383,"z":162.93899234469242,"ySeed":15.66766624841549,"radius":23,"height":22}),
  Object.freeze({"id":"radial-petal-court","x":94.71147175084133,"z":260.83260380431057,"ySeed":17.368921753908314,"radius":23,"height":20}),
  Object.freeze({"id":"terrace-seed-library","x":328.9395723106293,"z":-406.9902277580191,"ySeed":16.536035031698447,"radius":18,"height":10}),
  Object.freeze({"id":"spiral-frond-court","x":148.58307780252645,"z":-331.3960804366599,"ySeed":15,"radius":19,"height":12}),
  Object.freeze({"id":"crown-bloom-terrace","x":-125.32001482897905,"z":-542.717617456924,"ySeed":20.046348357914535,"radius":25,"height":24}),
 ]),
});

/** Open opaque timber member plan, not an emitted-scene clearance certificate. */
export const GARDEN_ARBOR=Object.freeze({
 edge:"alley" as const,
 centerFraction:0.45,
 halfLength:40,
 frameSpacing:16,
 postLateral:28,
 footBelowRoad:2,
 postHalfWidth:0.85,
 tieHeight:23.4,
 crownHeight:30,
 memberHalfWidth:0.45,
 purlinHalfWidth:0.28,
 minimumRoadToBeam:22.5,
 frameCount:6,webHalfWidth:.32,latticeHalfWidth:.20,endExtension:.08,footingHalfWidth:1.8,
 bodyHeight:3.2,cameraMargin:.45,minimumRailOffsetBeyondRoadEdge:3.25,
 physicalS:Object.freeze([135.7072233487035, 215.7072233487035] as const),
 supportStations:Object.freeze([135.7072233487035, 151.7072233487035, 167.7072233487035, 183.7072233487035, 199.7072233487035, 215.7072233487035]),
});
export interface GardenArborMember {
 readonly id:string;readonly kind:'post'|'tie'|'rafter'|'web'|'purlin'|'roof-lattice';
 readonly a:Vec3;readonly b:Vec3;readonly halfWidth:number;readonly endExtension:number;
 readonly aNode:string;readonly bNode:string;
}
export interface GardenArborFooting {
 readonly id:string;readonly s:number;readonly side:-1|1;readonly seedY:number;readonly footprint:readonly Vec3[];
}
/** Named shared nodes preserve visible bearings. Production must clip each entire
 * footing to actual terrain and validate the emitted member triangles independently.
 * No whole-canopy box may replace the literal open spaces between these members. */
export function gardenArborPlan(){
 const spec=GARDEN_ARBOR,e=GARDEN_EDGES.alley,members:GardenArborMember[]=[],supports:GardenArborFooting[]=[];
 const point=(s:number,lateral:number,height:number)=>{const p=e.sample(s,lateral).p;p.y+=height;return p;};
 const beam=(id:string,kind:GardenArborMember['kind'],a:Vec3,b:Vec3,halfWidth:number,aNode:string,bNode:string)=>members.push(Object.freeze({id,kind,a,b,halfWidth,endExtension:spec.endExtension,aNode,bNode}));
 const frames=spec.supportStations.map((s,i)=>{
  const l=point(s,-spec.postLateral,spec.tieHeight),r=point(s,spec.postLateral,spec.tieHeight),c=point(s,0,spec.crownHeight),lc=point(s,-spec.postLateral/2,(spec.tieHeight+spec.crownHeight)/2),rc=point(s,spec.postLateral/2,(spec.tieHeight+spec.crownHeight)/2),m=point(s,0,spec.tieHeight),name=(node:string)=>`frame${i}-${node}`;
  for(const[side,label,top]of [[-1,'L',l],[1,'R',r]]as const){
   const base=point(s,side*spec.postLateral,-spec.footBelowRoad);
   beam(`frame${i}-${label}-post`,'post',base,top,spec.postHalfWidth,name(`${label}-base`),name(label==='L'?'l':'r'));
   const f=e.sample(s,side*spec.postLateral),foot=f.p.clone();foot.y-=spec.footBelowRoad;
   supports.push(Object.freeze({id:`frame${i}-${label}-footing`,s,side,seedY:foot.y,footprint:Object.freeze([[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>foot.clone().add(f.n.clone().mulScalar(x*spec.footingHalfWidth)).add(f.t.clone().mulScalar(z*spec.footingHalfWidth))))}));
  }
  beam(`frame${i}-tie`,'tie',l,r,spec.memberHalfWidth,name('l'),name('r'));
  beam(`frame${i}-left-rafter`,'rafter',l,c,spec.memberHalfWidth,name('l'),name('c'));
  beam(`frame${i}-right-rafter`,'rafter',c,r,spec.memberHalfWidth,name('c'),name('r'));
  beam(`frame${i}-kingpost`,'web',m,c,spec.webHalfWidth,name('m'),name('c'));
  beam(`frame${i}-left-web`,'web',m,lc,spec.webHalfWidth,name('m'),name('lc'));
  beam(`frame${i}-right-web`,'web',m,rc,spec.webHalfWidth,name('m'),name('rc'));
  return {s,l,r,c,lc,rc,m};
 });
 for(let i=0;i<frames.length-1;i++){
  const a=frames[i],b=frames[i+1];
  for(const key of ['l','lc','c','rc','r'] as const)beam(`bay${i}-purlin-${key}`,'purlin',a[key],b[key],spec.purlinHalfWidth,`frame${i}-${key}`,`frame${i+1}-${key}`);
  for(const[x,y]of [['l','lc'],['lc','c'],['c','rc'],['rc','r']] as const){const from=i%2?y:x,to=i%2?x:y;beam(`bay${i}-lattice-${x}`,'roof-lattice',a[from],b[to],spec.latticeHalfWidth,`frame${i}-${from}`,`frame${i+1}-${to}`);}
 }
 return {frames,members,supports};
}

const length=GARDEN_COURSE.canonicalLength,defaultEdges=[start,boulevard,finish] as const;
const locate=(distance:number)=>{
  let s=wrapLandDistance(distance,length);
  for(const edge of defaultEdges){if(s<edge.length)return{edge,s};s-=edge.length;}
  return{edge:start,s:0};
};
const sample=(distance:number,lateral=0)=>{
  const {edge,s}=locate(distance);
  return{...edge.sample(s,lateral),u:wrapLandDistance(distance,length)/length};
};
const halfWidthAt=(distance:number)=>{const {edge,s}=locate(distance);return edge.halfWidthAt(s);};
/** Exact start + broad sweep + finish compatibility view. Gameplay support,
 * gates, branch choices, reset and interaction retain physical edge/s metres. */
const circuit={length,sample,curvature(distance:number,span=7){
  const a=sample(distance).t,b=sample(distance+span).t;
  return Math.atan2(a.z*b.x-a.x*b.z,a.x*b.x+a.z*b.z)/span;
}} as unknown as ClosedCircuit;
const clearance=GARDEN_ROAD_EDGES.flatMap(edge=>Array.from({length:Math.ceil(edge.length/2)+1},(_,i)=>{
  const s=Math.min(edge.length,i*2);return{p:edge.sample(s).p,w:edge.halfWidthAt(s)};
}));
export const GARDEN_TRACK:LandTrack=Object.freeze({
  id:GARDEN_META.id,label:GARDEN_META.label,tag:GARDEN_META.tag,length,circuit,sample,halfWidthAt,
  laneLimitAt:(distance:number)=>{const {edge,s}=locate(distance);return edge.laneLimitAt(s);},
  surfaceAt:(distance:number)=>{const {edge,s}=locate(distance);return edge.surfaceAt(s);},
  sections:Object.freeze([
    Object.freeze({name:'Alternating planted ascent and upper petal terraces',from:0,to:start.length}),
    Object.freeze({name:'Petal Sweep outside the open timber arbor',from:start.length,to:start.length+boulevard.length}),
    Object.freeze({name:'Graded southern return through the western garden basin',from:start.length+boulevard.length,to:length}),
  ]),
  // Compatibility only. Fork pickups use the explicit edge-local runtime rows.
  pickups:Object.freeze([80,260,655,1000,start.length+155,start.length+280,
    start.length+boulevard.length+170,start.length+boulevard.length+460,start.length+boulevard.length+870,
  ].flatMap(d=>[-3.5,3.5].map(lateral=>Object.freeze({d,lateral})))),
  clearAt(x:number,z:number,radius=0){
    return Number.isFinite(x+z+radius)&&clearance.every(({p,w})=>Math.hypot(p.x-x,p.z-z)>w+Math.max(0,radius)+3.5);
  },
});
