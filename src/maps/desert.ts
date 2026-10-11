import {Vec3} from 'playcanvas';
import {OpenRoad} from '../open-road';
import type {ClosedCircuit, CircuitPoint} from '../closed-circuit';
import {wrapLandDistance, type LandSample, type LandSurface, type LandTrack} from '../land-track';
import type {CheckpointGate, ForkCourse, RouteEdge, RouteEdgeId} from '../land-routes';

export const DESERT_META=Object.freeze({
  id:'desert',label:'星砂古驿',tag:'SUNWEAVE CARAVAN',
  branchLabels:Object.freeze({alley:'拱廊折径 / Archway Weave',boulevard:'风帆庭环 / Sailcourt Sweep'}),
  description:'Original connected dune ascent and wind-carved sandstone descent; choose a weaving stone lane through two open arches or a broad banked caravan courtyard before the kiln-shoulder return.',
  originality:'Original supported dune ridge, sinuous sandstone corridor, open caravan courtyard and sculpted arch geometry. No commercial track layout, copied artwork, external mesh or texture asset.',
});

/** Original, measured XYZ knots. Branch curves stop before a separately sampled
 * common tail. Production preserves every prototype sample without a refit. */
const points={
  start:[[-450,10,-280],[-290,10,-280],[-145,16,-310],[-15,24,-260],[110,33,-285],[255,41,-230],[355,43,-115],[325,35,20],[255,29,100],[275,25,175],[260,21,225],[220,18,250],[150,18,250],[40,18,250]],
  alley:[[40,18,250],[-25,18,270],[-95,18,245],[-155,18,265],[-205,18,290],[-240,18,290],[-280,18,290],[-315,18,290],[-360,18,265],[-420,18,250]],
  boulevard:[[40,18,250],[-30,18,235],[-105,18,165],[-200,18,120],[-295,18,165],[-370,18,235],[-420,18,250]],
  finish:[[-460,18,250],[-540,18,250],[-590,17,175],[-570,15,75],[-510,13,-15],[-545,10,-125],[-515,10,-220],[-450,10,-280]],
} as const satisfies Record<RouteEdgeId,readonly CircuitPoint[]>;
export const DESERT_POINTS=Object.freeze(Object.fromEntries(Object.entries(points).map(([id,knots])=>
  [id,Object.freeze(knots.map(p=>Object.freeze(p)))],
))) as Readonly<Record<RouteEdgeId,readonly CircuitPoint[]>>;
const east=[1,0,0] as const,west=[-1,0,0] as const;
const edgeIds=['start','alley','boulevard','finish'] as const;
const bound=(s:number,length:number)=>Math.max(0,Math.min(length,Number.isFinite(s)?s:0));
const smooth=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
const window=(s:number,a:number,b:number,r:number)=>smooth((s-a)/r)*smooth((b-s)/r);

/** Physical interaction certificate only. Pavement and exposed-rail ownership
 * follow the exact spatial source-triangle union, including outside this tail. */
export const DESERT_SHARED_MERGE_LENGTH=40;
export const DESERT_MERGE_TAIL_POINTS=Object.freeze([
  Object.freeze([-420,18,250] as const),Object.freeze([-460,18,250] as const),
]);
export const DESERT_MERGE_TAIL=new OpenRoad(DESERT_MERGE_TAIL_POINTS,west,west);
/** Straight, level, unbanked approach containing the unchanged 80m input zone. */
export const DESERT_DECISION_APPROACH_LENGTH=100;
export const DESERT_BASES=Object.freeze(Object.fromEntries(edgeIds.map(id=>[id,new OpenRoad(DESERT_POINTS[id],
  id==='start'?east:west,id==='finish'?east:west,
)]))) as Readonly<Record<RouteEdgeId,OpenRoad>>;
export const DESERT_ROADS=Object.freeze(Object.fromEntries(edgeIds.map(id=>{
  const base=DESERT_BASES[id];
  if(id==='start'||id==='finish')return[id,base];
  const length=base.length+DESERT_MERGE_TAIL.length;
  return[id,Object.freeze({length,sample:(distance:number,lateral=0)=>{
    const s=bound(distance,length);
    // Remaining-distance coordinates also share the tail's very first sample.
    return length-s<=40?DESERT_MERGE_TAIL.sample(40-(length-s),lateral):base.sample(s,lateral);
  }})];
}))) as Readonly<Record<RouteEdgeId,Pick<OpenRoad,'length'|'sample'>>>;
const hardpan:LandSurface=Object.freeze({kind:'desert-hardpan-road',grip:.985,rollingResistance:1.012});
const sandstone:LandSurface=Object.freeze({kind:'desert-sandstone-paving',grip:.95,rollingResistance:1.035});

export const DESERT_EDGES=Object.freeze(Object.fromEntries(edgeIds.map(id=>{
  const road=DESERT_ROADS[id];
  const halfWidthAt=(distance:number)=>{
    const s=bound(distance,road.length);
    return id==='alley'?5.9+3.6*(1-smooth(Math.min(s,Math.max(0,road.length-s-40))/70)):9.5;
  };
  const sample=(distance:number,lateral=0):LandSample=>{
    const s=bound(distance,road.length),q=road.sample(s);
    // Camber rotates the actual support frame, never just the road decoration.
    const bank=id==='start'?.045*window(s,390,715,65)-.045*window(s,795,1080,65):id==='boulevard'?.045*window(s,100,460,60):id==='finish'?-.025*window(s,220,390,55):0;
    const up=new Vec3().cross(q.t,q.n).normalize();
    const n=q.n.clone().mulScalar(Math.cos(bank)).add(up.mulScalar(Math.sin(bank))).normalize();
    const normal=new Vec3().cross(q.t,n).normalize();
    return{...q,p:q.p.add(n.clone().mulScalar(Number.isFinite(lateral)?lateral:0)),n,normal,bank};
  };
  return[id,Object.freeze({id,length:road.length,sample,halfWidthAt,
    laneLimitAt:(s:number)=>halfWidthAt(s)-.65,
    surfaceAt:(distance:number)=>{
      const s=bound(distance,road.length);
      return id==='alley'&&s>80&&s<road.length-120?sandstone:hardpan;
    },
  })];
}))) as Readonly<Record<RouteEdgeId,RouteEdge>>;
const {start,alley,boulevard,finish}=DESERT_EDGES;
const gate=(index:number,edgeId:RouteEdgeId,fraction:number):CheckpointGate=>Object.freeze({index,edgeId,s:DESERT_EDGES[edgeId].length*fraction});
export const DESERT_COURSE:ForkCourse=Object.freeze({
  id:DESERT_META.id,edges:DESERT_EDGES,commonStart:start,commonFinish:finish,
  alternates:Object.freeze({alley,boulevard}),sharedMergeLength:40,
  canonicalLength:start.length+boulevard.length+finish.length,gatesPerLap:8,
  presentation:Object.freeze({branchLabels:Object.freeze({alley:'拱廊折径',boulevard:'风帆庭环'})}),
  checkpointGates:Object.freeze([
    gate(0,'start',.29),gate(1,'start',.90),gate(2,'alley',.32),gate(3,'alley',.76),
    gate(2,'boulevard',.32),gate(3,'boulevard',.76),
    gate(4,'finish',.12),gate(5,'finish',.39),gate(6,'finish',.73),gate(7,'finish',1),
  ]),
});
export const DESERT_ROAD_EDGES:readonly RouteEdge[]=Object.freeze(edgeIds.map(id=>DESERT_EDGES[id]));

/** Conservative architectural reservations, not emitted solid geometry. Two
 * elliptical rings stay open with sky between them. The 52m building aperture
 * does not widen the 11.8m driving road. Scene audits must measure real mesh
 * voids, entire pier footings, ring seats and terrain contacts independently. */
export const DESERT_ARCHES=Object.freeze({
  id:'paired-open-sunweave-arches',edgeId:'alley' as const,
  floorY:18,centerZ:290,portalWidth:52,innerHalfWidth:26,driveableWidth:11.8,
  archSpringY:38,archCrownY:54,undersideY:38,overheadClearance:20,depth:8,
  centersX:Object.freeze([-248,-272]),
  centerS:318.72575808588084,straightFromS:298.72575808588084,straightToS:338.72575808588084,
  straightFrom:Object.freeze([-240,18,290] as const),straightTo:Object.freeze([-280,18,290] as const),
  solids:Object.freeze([-248,-272].flatMap((x,i)=>[
    Object.freeze({id:`arch-${i}-south-pier`,kind:'pier',min:Object.freeze([x-4,18,261] as const),max:Object.freeze([x+4,38,264] as const)}),
    Object.freeze({id:`arch-${i}-north-pier`,kind:'pier',min:Object.freeze([x-4,18,316] as const),max:Object.freeze([x+4,38,319] as const)}),
    Object.freeze({id:`arch-${i}-ring-envelope`,kind:'overhead-ring',min:Object.freeze([x-4,38,261] as const),max:Object.freeze([x+4,54,319] as const)}),
  ])),
  construction:'Two separate elliptical voussoir stone rings, no connecting roof. Inner half ellipse radius26m and rise14m springs from y38; outer rise16m. Rectangular envelopes overstate the actual ring and provide a conservative camera check. Pier contact caps at y38 seat both ring feet. Continuous approved pad y18; foot blocks extend outward from the opening. Final mesh must retain real open arch holes; never substitute a solid building box.',
});
/** Whole horizontal reservations only. A ySeed is never a grounding proof;
 * final support must clip each full footprint against emitted terrain faces. */
export const DESERT_LANDMARKS=Object.freeze({
  split:Object.freeze({x:40,y:18,z:250}),merge:Object.freeze({x:-460,y:18,z:250}),
  junctionClearance:110,arches:DESERT_ARCHES,
  plots:Object.freeze([
    Object.freeze({id:'sun-dial-beacon',x:145,z:-40,ySeed:27,radius:27,height:42}),
    Object.freeze({id:'wind-carved-spire',x:375.75246803720836,z:30.482669948055367,ySeed:30.48708184926617,radius:20,height:38}),
    Object.freeze({id:'caravan-sailcourt',x:-202.8203114674157,z:174.64595156552548,ySeed:17.45167236505248,radius:24,height:17}),
    Object.freeze({id:'terracotta-kiln-court',x:-562.0954105823064,z:-21.506240456810755,ySeed:9.914441708729237,radius:22,height:16}),
    Object.freeze({id:'saltstone-waystation',x:-197.52555113189763,z:-249.35653259226845,ySeed:9.646323245732304,radius:22,height:19}),
  ]),
});

const length=DESERT_COURSE.canonicalLength,defaultEdges=[start,boulevard,finish] as const;
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
const clearance=DESERT_ROAD_EDGES.flatMap(edge=>Array.from({length:Math.ceil(edge.length/2)+1},(_,i)=>{
  const s=Math.min(edge.length,i*2);return{p:edge.sample(s).p,w:edge.halfWidthAt(s)};
}));
export const DESERT_TRACK:LandTrack=Object.freeze({
  id:DESERT_META.id,label:DESERT_META.label,tag:DESERT_META.tag,length,circuit,sample,halfWidthAt,
  laneLimitAt:(distance:number)=>{const {edge,s}=locate(distance);return edge.laneLimitAt(s);},
  surfaceAt:(distance:number)=>{const {edge,s}=locate(distance);return edge.surfaceAt(s);},
  sections:Object.freeze([
    Object.freeze({name:'Dune-ridge ascent, sandstone crown and wind-carved descent',from:0,to:start.length}),
    Object.freeze({name:'Sailcourt Sweep alternate',from:start.length,to:start.length+boulevard.length}),
    Object.freeze({name:'Kiln shoulder and western return',from:start.length+boulevard.length,to:length}),
  ]),
  // Compatibility only. Fork pickups use the explicit edge-local runtime rows.
  pickups:Object.freeze([185,650,950,1200,start.length+200,start.length+365,
    start.length+boulevard.length+220,start.length+boulevard.length+540,
  ].flatMap(d=>[-3.5,3.5].map(lateral=>Object.freeze({d,lateral})))),
  clearAt(x:number,z:number,radius=0){
    return Number.isFinite(x+z+radius)&&clearance.every(({p,w})=>Math.hypot(p.x-x,p.z-z)>w+Math.max(0,radius)+3.5);
  },
});
