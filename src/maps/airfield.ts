/** Original Copperwing Airfield route. Exact authored geometry; no spline refit. */
import {Vec3} from 'playcanvas';
import {OpenRoad} from '../open-road';
import type {ClosedCircuit,CircuitPoint} from '../closed-circuit';
import {wrapLandDistance,type LandSample,type LandSurface,type LandTrack} from '../land-track';
import type {RouteEdgeId,RouteEdge,ForkCourse,CheckpointGate} from '../land-routes';
export const AIRFIELD_META=Object.freeze({id:'airfield',label:'铜翼空港',tag:'COPPERWING AIRFIELD',description:'A long runway climbs to a reversing observation ridge, then splits through an open steel hangar or broad taxiway before a long descending return.',branchLabels:{alley:'机库折径 / Hangar Cut',boulevard:'周界滑行道 / Perimeter Taxiway'},originality:'Original dry elevated airfield museum: long eastbound runway, reversing graded observation ridge, eastbound apron split with asymmetrical technical bends, open split-roof hangar and descending perimeter return. Static original aviation-inspired sculpture; no copied aircraft design, logo, commercial map or asset.'});
const points={
 start:[[-220,8,-150],[-100,8,-150],[0,9,-150],[120,15,-105],[175,23,-10],[120,29,75],[15,31,90],[-80,30,145],[-85,26,230],[-15,22,285],[40,20,285],[110,20,285],[220,20,285]],
 alley:[[220,20,285],[290,20,253],[365,20,268],[440,20,250],[540,20,285]],
 boulevard:[[220,20,285],[260,20,300.230447],[300,20,337],[340,20,373.769553],[380,20,389],[420,20,373.769553],[460,20,337],[500,20,300.230447],[540,20,285]],
 finish:[[580,20,285],[650,18,210],[575,13,70],[470,8,-70],[360,8,-220],[200,8,-280],[10,8,-280],[-100,8,-280],[-220,8,-280],[-265.961941,8,-260.961941],[-285,8,-215],[-265.961941,8,-169.038059],[-220,8,-150]],
} as const satisfies Record<RouteEdgeId,readonly CircuitPoint[]>;
export const AIRFIELD_POINTS=Object.freeze(Object.fromEntries(Object.entries(points).map(([id,knots])=>[id,Object.freeze(knots.map(p=>Object.freeze(p)))]))) as Readonly<Record<RouteEdgeId,readonly CircuitPoint[]>>;
const east=[1,0,0]as const,edgeIds=['start','alley','boulevard','finish']as const;
export const AIRFIELD_SHARED_MERGE_LENGTH=40;
export const AIRFIELD_MERGE_TAIL_POINTS=Object.freeze([Object.freeze([540,20,285] as const),Object.freeze([580,20,285] as const)]);
export const AIRFIELD_MERGE_TAIL=new OpenRoad(AIRFIELD_MERGE_TAIL_POINTS,east,east);
export const AIRFIELD_DECISION_APPROACH_LENGTH=100;
const bound=(s:number,l:number)=>Math.max(0,Math.min(l,Number.isFinite(s)?s:0));
const smooth=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
const window=(s:number,a:number,b:number,r:number)=>smooth((s-a)/r)*smooth((b-s)/r);
export const AIRFIELD_BASES=Object.freeze(Object.fromEntries(edgeIds.map(id=>[id,new OpenRoad(AIRFIELD_POINTS[id],east,east)])))as Readonly<Record<RouteEdgeId,OpenRoad>>;
export const AIRFIELD_ROADS=Object.freeze(Object.fromEntries(edgeIds.map(id=>{const base=AIRFIELD_BASES[id];if(id==='start'||id==='finish')return[id,base];const length=base.length+AIRFIELD_MERGE_TAIL.length;return[id,Object.freeze({length,sample:(s:number,lateral=0)=>{s=bound(s,length);return length-s<=40?AIRFIELD_MERGE_TAIL.sample(40-(length-s),lateral):base.sample(s,lateral);}})];})))as Readonly<Record<RouteEdgeId,Pick<OpenRoad,'length'|'sample'>>>;
const runwayStone:LandSurface=Object.freeze({kind:'airfield-dry-runway-road',grip:.975,rollingResistance:1.018});
const apronPaving:LandSurface=Object.freeze({kind:'airfield-apron-jointed-paving',grip:.94,rollingResistance:1.045});
export const AIRFIELD_EDGES=Object.freeze(Object.fromEntries(edgeIds.map(id=>{const road=AIRFIELD_ROADS[id];
 const halfWidthAt=(d:number)=>{const s=bound(d,road.length);return id==='alley'?5.8+3.7*(1-smooth(Math.min(s,Math.max(0,road.length-s-40))/70)):9.5;};
 const sample=(d:number,lateral=0):LandSample=>{const s=bound(d,road.length),q=road.sample(s),bank=id==='start'?.025*window(s,340,670,80)-.020*window(s,790,1070,80):id==='boulevard'?-.032*window(s,80,330,60):id==='finish'?.022*window(s,170,590,80):0;const up=new Vec3().cross(q.t,q.n).normalize(),n=q.n.clone().mulScalar(Math.cos(bank)).add(up.mulScalar(Math.sin(bank))).normalize(),normal=new Vec3().cross(q.t,n).normalize();return{...q,p:q.p.add(n.clone().mulScalar(Number.isFinite(lateral)?lateral:0)),n,normal,bank};};
 return[id,Object.freeze({id,length:road.length,sample,halfWidthAt,laneLimitAt:(s:number)=>halfWidthAt(s)-.65,surfaceAt:(d:number)=>{const s=bound(d,road.length);return id==='alley'&&s>80&&s<road.length-120?apronPaving:runwayStone;}})];
})))as Readonly<Record<RouteEdgeId,RouteEdge>>;
const {start,alley,boulevard,finish}=AIRFIELD_EDGES;
const gate=(index:number,edgeId:RouteEdgeId,f:number):CheckpointGate=>Object.freeze({index,edgeId,s:AIRFIELD_EDGES[edgeId].length*f});
export const AIRFIELD_COURSE:ForkCourse=Object.freeze({id:AIRFIELD_META.id,edges:AIRFIELD_EDGES,commonStart:start,commonFinish:finish,alternates:Object.freeze({alley,boulevard}),sharedMergeLength:40,canonicalLength:start.length+boulevard.length+finish.length,gatesPerLap:8,presentation:Object.freeze({branchLabels:Object.freeze({alley:'机库折径',boulevard:'周界滑行道'})}),checkpointGates:Object.freeze([gate(0,'start',.34),gate(1,'start',.92),gate(2,'alley',.30),gate(3,'alley',.76),gate(2,'boulevard',.30),gate(3,'boulevard',.76),gate(4,'finish',.16),gate(5,'finish',.44),gate(6,'finish',.78),gate(7,'finish',1)])});
export const AIRFIELD_ROAD_EDGES=Object.freeze(edgeIds.map(id=>AIRFIELD_EDGES[id]));

/** Whole-footprint reservations; seed heights are not terrain contacts. */
export const AIRFIELD_LANDMARKS=Object.freeze({
 split:Object.freeze({x:220,y:20,z:285}),merge:Object.freeze({x:580,y:20,z:285}),junctionClearance:110,
 plots:Object.freeze([
  Object.freeze({"id":"twinboom-courier","x":-54.76903010658787,"z":-211.8234925285509,"ySeed":5.156526154637408,"radius":29,"height":14}),
  Object.freeze({"id":"splitfin-tower","x":32.829517948945885,"z":139.39180599138217,"ySeed":27.989055205124764,"radius":22,"height":27}),
  Object.freeze({"id":"rotor-cutaway-court","x":445.6210624461887,"z":417.3050153082067,"ySeed":18.615724216787147,"radius":20,"height":18}),
  Object.freeze({"id":"wing-spar-gallery","x":417.8768004273584,"z":187.34072596183915,"ySeed":17,"radius":23,"height":14}),
  Object.freeze({"id":"sunfin-glider","x":429.58265817161686,"z":-237.3727674971974,"ySeed":4.929423412041872,"radius":30,"height":17}),
 ]),
});

/** Opaque split-roof plan. The ridge slot and end gables are literal voids.
 * Emitted triangles, refreshed native assemblies and terrain contacts need scene QA. */
export const AIRFIELD_HANGAR=Object.freeze({
 edge:'alley' as const,centerFraction:.49,halfLength:40,frameSpacing:20,frameCount:5,
 postLateral:32,footBelowRoad:2,postHalfWidth:.85,tieHeight:25.4,crownHeight:32,
 memberHalfWidth:.45,purlinHalfWidth:.28,minimumRoadToBeam:24.5,
 webHalfWidth:.32,latticeHalfWidth:.20,sideBraceHalfWidth:.3,endExtension:.08,footingHalfWidth:1.8,
 roofThickness:.35,ridgeLateral:5,ridgeSlot:Object.freeze([2,8] as const),
 bodyHeight:3.2,cameraMargin:.45,minimumRailOffsetBeyondRoadEdge:3.25,
 physicalS:Object.freeze([146.0256391123437, 226.0256391123437] as const),
 supportStations:Object.freeze([146.0256391123437, 166.0256391123437, 186.0256391123437, 206.0256391123437, 226.0256391123437]),
});

export interface AirfieldHangarBeam {
 readonly id:string;readonly kind:'post'|'tie'|'rafter'|'web'|'purlin'|'roof-lattice'|'side-brace';
 readonly a:Vec3;readonly b:Vec3;readonly halfWidth:number;readonly endExtension:number;
 readonly aNode:string;readonly bNode:string;
}
export interface AirfieldHangarPanel {
 readonly id:string;readonly kind:'roof-panel';readonly a:Vec3;readonly b:Vec3;
 readonly corners:readonly Vec3[];readonly thickness:number;readonly cornerNodes:readonly string[];
 readonly aNode:string;readonly bNode:string;
}
export type AirfieldHangarMember=AirfieldHangarBeam|AirfieldHangarPanel;
export interface AirfieldHangarFooting {
 readonly id:string;readonly s:number;readonly side:-1|1;readonly seedY:number;readonly footprint:readonly Vec3[];
}
/** Shared named bearings, actual panel corners and complete footing polygons.
 * Planned foot seeds must never replace complete emitted-terrain grounding. */
export function airfieldHangarPlan(){
 const spec=AIRFIELD_HANGAR,e=AIRFIELD_EDGES.alley,members:AirfieldHangarMember[]=[],supports:AirfieldHangarFooting[]=[];
 const point=(s:number,lateral:number,height:number)=>{const p=e.sample(s,lateral).p;p.y+=height;return p;};
 const beam=(id:string,kind:AirfieldHangarBeam['kind'],a:Vec3,b:Vec3,halfWidth:number,aNode:string,bNode:string)=>members.push(Object.freeze({id,kind,a,b,halfWidth,endExtension:spec.endExtension,aNode,bNode}));
 const frames=spec.supportStations.map((s,i)=>{
  const l=point(s,-spec.postLateral,spec.tieHeight),r=point(s,spec.postLateral,spec.tieHeight),c=point(s,5,spec.crownHeight),lc=point(s,-13.5,(spec.tieHeight+spec.crownHeight)/2),rc=point(s,18.5,(spec.tieHeight+spec.crownHeight)/2),m=point(s,5,spec.tieHeight),lp=point(s,2,spec.tieHeight+34/37*(spec.crownHeight-spec.tieHeight)),rp=point(s,8,spec.tieHeight+24/27*(spec.crownHeight-spec.tieHeight)),name=(node:string)=>`frame${i}-${node}`;
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
  return {s,l,r,c,lc,rc,m,lp,rp};
 });
 for(let i=0;i<frames.length-1;i++){
  const a=frames[i],b=frames[i+1];
  for(const key of ['l','lc','lp','c','rp','rc','r'] as const)beam(`bay${i}-purlin-${key}`,'purlin',a[key],b[key],spec.purlinHalfWidth,`frame${i}-${key}`,`frame${i+1}-${key}`);
  for(const[x,y]of [['l','lc'],['lc','c'],['c','rc'],['rc','r']] as const){const from=i%2?y:x,to=i%2?x:y;beam(`bay${i}-lattice-${x}`,'roof-lattice',a[from],b[to],spec.latticeHalfWidth,`frame${i}-${from}`,`frame${i+1}-${to}`);}
 }
 const panel=(id:string,corners:readonly Vec3[],cornerNodes:readonly string[])=>members.push(Object.freeze({id,kind:'roof-panel',a:corners[0],b:corners[2],corners:Object.freeze(corners),thickness:spec.roofThickness,cornerNodes:Object.freeze(cornerNodes),aNode:cornerNodes[0],bNode:cornerNodes[2]}));
 for(let i=0;i<frames.length-1;i++){
  const a=frames[i],b=frames[i+1];
  panel(`bay${i}-left-sheet`,[a.l,a.lp,b.lp,b.l],[`frame${i}-l`,`frame${i}-lp`,`frame${i+1}-lp`,`frame${i+1}-l`]);
  panel(`bay${i}-right-sheet`,[a.rp,a.r,b.r,b.rp],[`frame${i}-rp`,`frame${i}-r`,`frame${i+1}-r`,`frame${i+1}-rp`]);
  for(const[side,label]of [[-1,'L'],[1,'R']]as const){
   const bottomA=point(a.s,side*spec.postLateral,-spec.footBelowRoad),bottomB=point(b.s,side*spec.postLateral,-spec.footBelowRoad),key=label==='L'?'l':'r';
   beam(`bay${i}-${label}-side-diagonal`,'side-brace',i%2?bottomB:bottomA,i%2?a[key]:b[key],spec.sideBraceHalfWidth,`frame${i%2?i+1:i}-${label}-base`,`frame${i%2?i:i+1}-${key}`);
  }
 }
 return {frames,members,supports};
}

const length=AIRFIELD_COURSE.canonicalLength,defaultEdges=[start,boulevard,finish] as const;
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
/** Exact start + broad taxiway + finish compatibility view. Gameplay support,
 * gates, branch choices, reset and interaction retain physical edge/s metres. */
const circuit={length,sample,curvature(distance:number,span=7){
  const a=sample(distance).t,b=sample(distance+span).t;
  return Math.atan2(a.z*b.x-a.x*b.z,a.x*b.x+a.z*b.z)/span;
}} as unknown as ClosedCircuit;
const clearance=AIRFIELD_ROAD_EDGES.flatMap(edge=>Array.from({length:Math.ceil(edge.length/2)+1},(_,i)=>{
  const s=Math.min(edge.length,i*2);return{p:edge.sample(s).p,w:edge.halfWidthAt(s)};
}));
export const AIRFIELD_TRACK:LandTrack=Object.freeze({
  id:AIRFIELD_META.id,label:AIRFIELD_META.label,tag:AIRFIELD_META.tag,length,circuit,sample,halfWidthAt,
  laneLimitAt:(distance:number)=>{const {edge,s}=locate(distance);return edge.laneLimitAt(s);},
  surfaceAt:(distance:number)=>{const {edge,s}=locate(distance);return edge.surfaceAt(s);},
  sections:Object.freeze([
    Object.freeze({name:'Launch runway and reversing observation ridge',from:0,to:start.length}),
    Object.freeze({name:'Perimeter Taxiway outside the split-roof hangar',from:start.length,to:start.length+boulevard.length}),
    Object.freeze({name:'Descending eastern upland and long low runway return',from:start.length+boulevard.length,to:length}),
  ]),
  // Compatibility only. Fork pickups use the explicit edge-local runtime rows.
  pickups:Object.freeze([95,265,620,1060,start.length+155,start.length+280,
    start.length+boulevard.length+285,start.length+boulevard.length+720,start.length+boulevard.length+1000,
  ].flatMap(d=>[-3.5,3.5].map(lateral=>Object.freeze({d,lateral})))),
  clearAt(x:number,z:number,radius=0){
    return Number.isFinite(x+z+radius)&&clearance.every(({p,w})=>Math.hypot(p.x-x,p.z-z)>w+Math.max(0,radius)+3.5);
  },
});
