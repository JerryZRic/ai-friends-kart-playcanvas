/** Original Basalt Crown route. Exact frozen source geometry; no spline refit. */
import {Vec3} from 'playcanvas';
import {OpenRoad} from '../open-road';
import type {ClosedCircuit,CircuitPoint} from '../closed-circuit';
import {wrapLandDistance,type LandSample,type LandSurface,type LandTrack} from '../land-track';
import type {RouteEdgeId,RouteEdge,ForkCourse,CheckpointGate} from '../land-routes';
export const CALDERA_META=Object.freeze({id:'caldera',label:'玄岩环冕',tag:'BASALT CROWN',description:'An asymmetric high caldera rim descends into a hooked bowl; choose two lower routes through separate stone arches, then climb over their real viaduct.',branchLabels:Object.freeze({alley:'裂岩内径 / Jointline Cut',boulevard:'灰台缓弧 / Ashen Sweep'}),originality:'Original asymmetric cooled-volcano rim, low hooked inner bowl, two real lower branches and off-center height-separated stone viaduct. Original dry geology forms and masonry assemblies; no borrowed commercial layout, model, logo or texture.'});
const points={
 start:[[-380,46,-180],[-380,46,-60],[-350,49,100],[-255,53,190],[-110,55,235],[55,53,220],[185,46,130],[230,37,0],[170,27,-120],[60,18,-160],[-45,14,-130],[-125,14,-50],[-145,14,40],[-215,14,75],[-270,14,0],[-275,14,-100],[-275,14,-150],[-275,14,-260]],
 alley:[[-275,14,-260],[-307,14,-330],[-278,14,-405],[-322,14,-480],[-296,14,-555],[-275,14,-630]],
 boulevard:[[-275,14,-260],[-255.522474,14,-306.25],[-208.5,14,-352.5],[-161.477526,14,-398.75],[-142,14,-445],[-161.477526,14,-491.25],[-208.5,14,-537.5],[-255.522474,14,-583.75],[-275,14,-630]],
 finish:[[-275,14,-670],[-195,18,-730],[-20,25,-685],[75,32,-590],[55,38,-470],[-20,44,-380],[-160,47,-350],[-280,47,-350],[-360,46,-330],[-380,46,-265],[-380,46,-180]],
} as const satisfies Record<RouteEdgeId,readonly CircuitPoint[]>;
export const CALDERA_POINTS=Object.freeze(Object.fromEntries(Object.entries(points).map(([id,knots])=>[id,Object.freeze(knots.map(p=>Object.freeze(p)))]))) as Readonly<Record<RouteEdgeId,readonly CircuitPoint[]>>;
const north=[0,0,1]as const,south=[0,0,-1]as const,edgeIds=['start','alley','boulevard','finish']as const;
export const CALDERA_SHARED_MERGE_LENGTH=40;
export const CALDERA_MERGE_TAIL_POINTS=Object.freeze([Object.freeze([-275,14,-630] as const),Object.freeze([-275,14,-670] as const)]);
export const CALDERA_MERGE_TAIL=new OpenRoad(CALDERA_MERGE_TAIL_POINTS,south,south);
export const CALDERA_DECISION_APPROACH_LENGTH=100;
const bound=(s:number,l:number)=>Math.max(0,Math.min(l,Number.isFinite(s)?s:0));
const smooth=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
const window=(s:number,a:number,b:number,r:number)=>smooth((s-a)/r)*smooth((b-s)/r);
export const CALDERA_BASES=Object.freeze(Object.fromEntries(edgeIds.map(id=>[id,new OpenRoad(CALDERA_POINTS[id],id==='start'?north:south,id==='finish'?north:south)])))as Readonly<Record<RouteEdgeId,OpenRoad>>;
export const CALDERA_ROADS=Object.freeze(Object.fromEntries(edgeIds.map(id=>{const base=CALDERA_BASES[id];if(id==='start'||id==='finish')return[id,base];const length=base.length+CALDERA_MERGE_TAIL.length;return[id,Object.freeze({length,sample:(s:number,lateral=0)=>{s=bound(s,length);return length-s<=40?CALDERA_MERGE_TAIL.sample(40-(length-s),lateral):base.sample(s,lateral);}})];})))as Readonly<Record<RouteEdgeId,Pick<OpenRoad,'length'|'sample'>>>;
const dressedBasalt:LandSurface=Object.freeze({kind:'caldera-dressed-basalt-road',grip:.975,rollingResistance:1.018});
const jointstone:LandSurface=Object.freeze({kind:'caldera-jointed-inner-paving',grip:.94,rollingResistance:1.045});
export const CALDERA_EDGES=Object.freeze(Object.fromEntries(edgeIds.map(id=>{const road=CALDERA_ROADS[id];
 const halfWidthAt=(d:number)=>{const s=bound(d,road.length);return id==='alley'?5.8+3.7*(1-smooth(Math.min(s,Math.max(0,road.length-s-40))/70)):9.5;};
 const sample=(d:number,lateral=0):LandSample=>{const s=bound(d,road.length),q=road.sample(s),bank=id==='start'?.038*window(s,160,1050,100)-.026*window(s,1260,1680,85):id==='boulevard'?-.036*window(s,80,350,60):id==='finish'?.026*window(s,90,590,95):0;const up=new Vec3().cross(q.t,q.n).normalize(),n=q.n.clone().mulScalar(Math.cos(bank)).add(up.mulScalar(Math.sin(bank))).normalize(),normal=new Vec3().cross(q.t,n).normalize();return{...q,p:q.p.add(n.clone().mulScalar(Number.isFinite(lateral)?lateral:0)),n,normal,bank};};
 return[id,Object.freeze({id,length:road.length,sample,halfWidthAt,laneLimitAt:(s:number)=>halfWidthAt(s)-.65,surfaceAt:(d:number)=>{const s=bound(d,road.length);return id==='alley'&&s>80&&s<road.length-120?jointstone:dressedBasalt;}})];
})))as Readonly<Record<RouteEdgeId,RouteEdge>>;
const {start,alley,boulevard,finish}=CALDERA_EDGES;
const gate=(index:number,edgeId:RouteEdgeId,f:number):CheckpointGate=>Object.freeze({index,edgeId,s:CALDERA_EDGES[edgeId].length*f});
export const CALDERA_COURSE:ForkCourse=Object.freeze({id:CALDERA_META.id,edges:CALDERA_EDGES,commonStart:start,commonFinish:finish,alternates:Object.freeze({alley,boulevard}),sharedMergeLength:40,canonicalLength:start.length+boulevard.length+finish.length,gatesPerLap:8,presentation:Object.freeze({branchLabels:Object.freeze({alley:'裂岩内径',boulevard:'灰台缓弧'})}),checkpointGates:Object.freeze([gate(0,'start',.34),gate(1,'start',.92),gate(2,'alley',.30),gate(3,'alley',.76),gate(2,'boulevard',.30),gate(3,'boulevard',.76),gate(4,'finish',.16),gate(5,'finish',.44),gate(6,'finish',.78),gate(7,'finish',1)])});
export const CALDERA_ROAD_EDGES=Object.freeze(edgeIds.map(id=>CALDERA_EDGES[id]));

/** Planned thick crossing contract, not an emitted-scene clearance or grounding proof.
 * Ground under the complete bridge footprint belongs to the LOWER branches.
 * The finish deck is a separate physical layer, never single-valued terrain.
 * Source road union must classify triangle-intersection heights before XZ clipping.
 */
export const CALDERA_VIADUCT=Object.freeze({
 upperEdge:"finish" as const,
 lowerEdges:Object.freeze(["alley", "boulevard"] as const),
 minimumDeckThickness:2.4,
 deckHalfWidth:11.5,
 pierTargetX:Object.freeze([-360, -265, -115]),
 pierAlongRoadHalfWidth:4,
 pierCrossRoadHalfWidth:8,
 capitalAlongRoadHalfWidth:7,
 capitalCrossRoadHalfWidth:13,
 capitalBottomY:36,
 pierFootY:8,
 maxArchExtraDepth:10,
 minimumRoadUndersideClearance:24,
 upperPhysicalS:Object.freeze([772.0030207251166,1021.2578930080276] as const),
 supportStations:Object.freeze([772.0030207251166,922.3575173458157,1021.2578930080276]),
 crossings:Object.freeze([
  Object.freeze({lowerEdge:'alley' as const,upperEdge:'finish' as const,lowerS:96.93603113547367,upperS:960.3510556435753}),
  Object.freeze({lowerEdge:'boulevard' as const,upperEdge:'finish' as const,lowerS:112.54367134824344,upperS:869.091399287674}),
 ]),
 bodyHeight:3.2,cameraMargin:.45,sourceStationSpacing:1.65,
 groundLayer:'lower-branches' as const,upperLayer:'physical-viaduct-deck' as const,
});
/** The frozen two unequal parabolic underside profiles used by planned audit. */
export function calderaViaductDepthAt(s:number):number {
 const piers=CALDERA_VIADUCT.supportStations;
 let a=piers[0],b=piers[1];
 for(let i=0;i<piers.length-1;i++)if(s>=piers[i]&&s<=piers[i+1]){a=piers[i];b=piers[i+1];break;}
 const t=Math.max(0,Math.min(1,(s-a)/(b-a)));
 return CALDERA_VIADUCT.minimumDeckThickness+CALDERA_VIADUCT.maxArchExtraDepth*Math.pow(Math.abs(2*t-1),2);
}
/** Actual support coordinates at the planned underside, including upper camber. */
export function calderaViaductUndersideAt(s:number,lateral=0):Vec3 {
 const p=finish.sample(s,lateral).p;p.y-=calderaViaductDepthAt(s);return p;
}
/** Whole-footprint scene reservations; provisional feet need emitted terrain clipping. */
export const CALDERA_LANDMARKS=Object.freeze({
 split:Object.freeze({x:-275,y:14,z:-260}),merge:Object.freeze({x:-275,y:14,z:-670}),
 junctionClearance:110,
 plots:Object.freeze([
  Object.freeze({"id":"broken-rim-gate","x":-201.53260435878266,"z":272.8678063507081,"ySeed":49.30052539802692,"radius":25,"height":33}),
  Object.freeze({"id":"radial-joint-fan","x":-48.715948913974685,"z":-59.11618094379969,"ySeed":9.299401983485309,"radius":24,"height":13}),
  Object.freeze({"id":"strata-archive","x":-146.21505494650128,"z":-551.9357024208219,"ySeed":12.170621806128269,"radius":22,"height":13}),
  Object.freeze({"id":"stone-resonator","x":-363.51939877460836,"z":-511.34491630152905,"ySeed":11,"radius":18,"height":12}),
  Object.freeze({"id":"wind-carved-tooth","x":20.73596428006931,"z":-573.8768630710183,"ySeed":27.214993592869632,"radius":26,"height":31}),
 ]),
});

const length=CALDERA_COURSE.canonicalLength,defaultEdges=[start,boulevard,finish] as const;
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
const clearance=CALDERA_ROAD_EDGES.flatMap(edge=>Array.from({length:Math.ceil(edge.length/2)+1},(_,i)=>{
  const s=Math.min(edge.length,i*2);return{p:edge.sample(s).p,w:edge.halfWidthAt(s)};
}));
export const CALDERA_TRACK:LandTrack=Object.freeze({
  id:CALDERA_META.id,label:CALDERA_META.label,tag:CALDERA_META.tag,length,circuit,sample,halfWidthAt,
  laneLimitAt:(distance:number)=>{const {edge,s}=locate(distance);return edge.laneLimitAt(s);},
  surfaceAt:(distance:number)=>{const {edge,s}=locate(distance);return edge.surfaceAt(s);},
  sections:Object.freeze([
    Object.freeze({name:'Asymmetric high caldera rim and hooked lower bowl',from:0,to:start.length}),
    Object.freeze({name:'Ashen Sweep alternate below the eastern stone arch',from:start.length,to:start.length+boulevard.length}),
    Object.freeze({name:'Climbing return over the real two-aperture viaduct',from:start.length+boulevard.length,to:length}),
  ]),
  // Compatibility only. Fork pickups use the explicit edge-local runtime rows.
  pickups:Object.freeze([260,650,950,1420,start.length+175,start.length+310,
    start.length+boulevard.length+190,start.length+boulevard.length+570,start.length+boulevard.length+900,
  ].flatMap(d=>[-3.5,3.5].map(lateral=>Object.freeze({d,lateral})))),
  clearAt(x:number,z:number,radius=0){
    return Number.isFinite(x+z+radius)&&clearance.every(({p,w})=>Math.hypot(p.x-x,p.z-z)>w+Math.max(0,radius)+3.5);
  },
});
