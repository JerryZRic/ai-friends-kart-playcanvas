/** Original Frostloop Depot physical route. Frozen design is preserved without a spline refit. */
import {Vec3} from 'playcanvas';
import {OpenRoad} from '../open-road';
import type {ClosedCircuit,CircuitPoint} from '../closed-circuit';
import {wrapLandDistance,type LandSample,type LandSurface,type LandTrack} from '../land-track';
import type {RouteEdgeId,RouteEdge,ForkCourse,CheckpointGate} from '../land-routes';
export const SNOW_META=Object.freeze({id:'snow',label:'霜环雪站',tag:'FROSTLOOP DEPOT',branchLabels:Object.freeze({alley:'机修折径 / Service Cut',boulevard:'雪台外环 / Terrace Sweep'}),description:'Opposing highland snow bowls and a stepped southwest return connect an open rail depot; choose the weaving maintenance yard or a broad banked snow terrace.',originality:'Original highland snow-ridge chain, supported linked banked bends, maintenance yard and open grounded rail depot. No commercial layout, external mesh, logo or texture asset.'});
const points={
 start:[[-257.5,16.7,-335.0],[-257.5,16.7,-215.0],[-205.0,23.2,-136.25],[-96.25,29.05,-121.25],[-13.75,33.6,-188.75],[5.0,34.25,-271.25],[80.0,33.6,-320.0],[162.5,29.7,-290.0],[196.25,25.8,-203.75],[155.0,25.15,-125.0],[87.5,27.1,-68.75],[72.5,31.0,17.5],[136.25,34.25,96.25],[241.25,34.9,111.25],[320.0,29.7,32.5],[320.0,24.5,-61.25],[263.75,19.95,-136.25],[260.0,18.0,-200.0],[260.0,18.0,-240.0],[260.0,18.0,-350.0]],
 alley:[[260,18,-350],[230,18,-425],[260,18,-500],[215,18,-565],[230,18,-640],[260,18,-715],[260,18,-790]],
 boulevard:[[260.0,18,-350.0],[279.770292,18,-405.0],[327.5,18,-460.0],[375.229708,18,-515.0],[395.0,18,-570.0],[375.229708,18,-625.0],[327.5,18,-680.0],[279.770292,18,-735.0],[260.0,18,-790.0]],
 finish:[[260,18,-830],[205,16,-925],[65,14,-965],[-50,16,-895],[-120,19,-780],[-235,23,-810],[-340,24,-705],[-330,22,-555],[-257.5,16.7,-455],[-257.5,16.7,-335]],
} as const satisfies Record<RouteEdgeId,readonly CircuitPoint[]>;
export const SNOW_POINTS=Object.freeze(Object.fromEntries(Object.entries(points).map(([id,knots])=>
 [id,Object.freeze(knots.map(p=>Object.freeze(p)))],
))) as Readonly<Record<RouteEdgeId,readonly CircuitPoint[]>>;
const north=[0,0,1] as const,south=[0,0,-1] as const,edgeIds=['start','alley','boulevard','finish'] as const;
/** Interaction certificate only: road/rail ownership uses the exact spatial road union. */
export const SNOW_SHARED_MERGE_LENGTH=40;
export const SNOW_MERGE_TAIL_POINTS=Object.freeze([Object.freeze([260,18,-790] as const),Object.freeze([260,18,-830] as const)]);
export const SNOW_MERGE_TAIL=new OpenRoad(SNOW_MERGE_TAIL_POINTS,south,south);
/** Straight, level, unbanked approach containing the unchanged 80m input zone. */
export const SNOW_DECISION_APPROACH_LENGTH=100;
const bound=(s:number,l:number)=>Math.max(0,Math.min(l,Number.isFinite(s)?s:0));
const smooth=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
const window=(s:number,a:number,b:number,r:number)=>smooth((s-a)/r)*smooth((b-s)/r);
export const SNOW_BASES=Object.freeze(Object.fromEntries(edgeIds.map(id=>[id,new OpenRoad(SNOW_POINTS[id],id==='start'?north:south,id==='finish'?north:south)]))) as Readonly<Record<RouteEdgeId,OpenRoad>>;
export const SNOW_ROADS=Object.freeze(Object.fromEntries(edgeIds.map(id=>{const base=SNOW_BASES[id];if(id==='start'||id==='finish')return[id,base];const length=base.length+SNOW_MERGE_TAIL.length;return[id,Object.freeze({length,sample:(s:number,lateral=0)=>{s=bound(s,length);return length-s<=40?SNOW_MERGE_TAIL.sample(40-(length-s),lateral):base.sample(s,lateral);}})];}))) as Readonly<Record<RouteEdgeId,Pick<OpenRoad,'length'|'sample'>>>;
const packedSnow:LandSurface=Object.freeze({kind:'snow-packed-snow-road',grip:.975,rollingResistance:1.018});
const serviceStone:LandSurface=Object.freeze({kind:'snow-stone-service-paving',grip:.94,rollingResistance:1.045});
export const SNOW_EDGES=Object.freeze(Object.fromEntries(edgeIds.map(id=>{const road=SNOW_ROADS[id];
 const halfWidthAt=(d:number)=>{const s=bound(d,road.length);return id==='alley'?5.8+3.7*(1-smooth(Math.min(s,Math.max(0,road.length-s-40))/70)):9.5;};
 const sample=(d:number,lateral=0):LandSample=>{const s=bound(d,road.length),q=road.sample(s),bank=id==='start'?.045*window(s,120,570,65)-.045*window(s,600,1040,65)+.042*window(s,1070,1530,65):id==='boulevard'?-.045*window(s,100,420,65):id==='finish'?-.032*window(s,100,550,80):0;const up=new Vec3().cross(q.t,q.n).normalize(),n=q.n.clone().mulScalar(Math.cos(bank)).add(up.mulScalar(Math.sin(bank))).normalize(),normal=new Vec3().cross(q.t,n).normalize();return{...q,p:q.p.add(n.clone().mulScalar(Number.isFinite(lateral)?lateral:0)),n,normal,bank};};
 return[id,Object.freeze({id,length:road.length,sample,halfWidthAt,laneLimitAt:(s:number)=>halfWidthAt(s)-.65,surfaceAt:(d:number)=>{const s=bound(d,road.length);return id==='alley'&&s>80&&s<road.length-120?serviceStone:packedSnow;}})];
}))) as Readonly<Record<RouteEdgeId,RouteEdge>>;
const {start,alley,boulevard,finish}=SNOW_EDGES;
const gate=(index:number,edgeId:RouteEdgeId,f:number):CheckpointGate=>Object.freeze({index,edgeId,s:SNOW_EDGES[edgeId].length*f});
export const SNOW_COURSE:ForkCourse=Object.freeze({id:SNOW_META.id,edges:SNOW_EDGES,commonStart:start,commonFinish:finish,alternates:Object.freeze({alley,boulevard}),sharedMergeLength:40,canonicalLength:start.length+boulevard.length+finish.length,gatesPerLap:8,presentation:Object.freeze({branchLabels:Object.freeze({alley:'机修折径',boulevard:'雪台外环'})}),checkpointGates:Object.freeze([gate(0,'start',.29),gate(1,'start',.90),gate(2,'alley',.32),gate(3,'alley',.76),gate(2,'boulevard',.32),gate(3,'boulevard',.76),gate(4,'finish',.12),gate(5,'finish',.39),gate(6,'finish',.73),gate(7,'finish',1)])});
export const SNOW_ROAD_EDGES:readonly RouteEdge[]=Object.freeze(edgeIds.map(id=>SNOW_EDGES[id]));

/** Whole-footprint scene reservations, not emitted solids or a grounding proof.
 * Every ySeed is provisional; final foundations must clip emitted terrain faces. */
export const SNOW_LANDMARKS=Object.freeze({
 split:Object.freeze({x:260,y:18,z:-350}),merge:Object.freeze({x:260,y:18,z:-830}),
 junctionClearance:110,
 plots:Object.freeze([
  Object.freeze({"id":"ridge-signal-house","x":78.21051759724152,"z":-265.7541594056325,"ySeed":31.04962568831835,"radius":22,"height":26}),
  Object.freeze({"id":"snow-split-ridge","x":126.25436072868013,"z":-0.30407261971647337,"ySeed":27.68203979639005,"radius":26,"height":39}),
  Object.freeze({"id":"depot-clock-hall","x":445.37842115712493,"z":-525.5060716381129,"ySeed":17.631611621203124,"radius":28,"height":25}),
  Object.freeze({"id":"maintenance-roundhouse","x":170.01970061790266,"z":-604.5657070926818,"ySeed":15,"radius":20,"height":16}),
  Object.freeze({"id":"stone-plow-shed","x":-31.669037995054445,"z":-810.7023664917805,"ySeed":12.555235242999109,"radius":24,"height":17}),
 ]),
});

const length=SNOW_COURSE.canonicalLength,defaultEdges=[start,boulevard,finish] as const;
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
const clearance=SNOW_ROAD_EDGES.flatMap(edge=>Array.from({length:Math.ceil(edge.length/2)+1},(_,i)=>{
  const s=Math.min(edge.length,i*2);return{p:edge.sample(s).p,w:edge.halfWidthAt(s)};
}));
export const SNOW_TRACK:LandTrack=Object.freeze({
  id:SNOW_META.id,label:SNOW_META.label,tag:SNOW_META.tag,length,circuit,sample,halfWidthAt,
  laneLimitAt:(distance:number)=>{const {edge,s}=locate(distance);return edge.laneLimitAt(s);},
  surfaceAt:(distance:number)=>{const {edge,s}=locate(distance);return edge.surfaceAt(s);},
  sections:Object.freeze([
    Object.freeze({name:'Opposing highland snow bowls and connecting saddle',from:0,to:start.length}),
    Object.freeze({name:'Terrace Sweep alternate',from:start.length,to:start.length+boulevard.length}),
    Object.freeze({name:'Low basin and stepped southwest return',from:start.length+boulevard.length,to:length}),
  ]),
  // Compatibility only. Fork pickups use the explicit edge-local runtime rows.
  pickups:Object.freeze([185,650,950,1450,start.length+200,start.length+365,
    start.length+boulevard.length+220,start.length+boulevard.length+800,
  ].flatMap(d=>[-3.5,3.5].map(lateral=>Object.freeze({d,lateral})))),
  clearAt(x:number,z:number,radius=0){
    return Number.isFinite(x+z+radius)&&clearance.every(({p,w})=>Math.hypot(p.x-x,p.z-z)>w+Math.max(0,radius)+3.5);
  },
});
