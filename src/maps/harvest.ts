import {Vec3} from 'playcanvas';
import {OpenRoad} from '../open-road';
import type {ClosedCircuit, CircuitPoint} from '../closed-circuit';
import {wrapLandDistance, type LandSample, type LandSurface, type LandTrack} from '../land-track';
import type {CheckpointGate, ForkCourse, RouteEdge, RouteEdgeId} from '../land-routes';

export const HARVEST_META=Object.freeze({
  id:'harvest',label:'谷风麦垄回环',tag:'AMBERWIND HARVEST',
  branchLabels:Object.freeze({alley:'谷仓折线 / Barnyard Cut',boulevard:'麦浪外环 / Golden Contour'}),
  description:'Original connected grain terraces, windmill ridge and orchard descent; choose a real drive-through barnyard or a broad banked field contour before the market-hollow return.',
  originality:'Original land geometry, agricultural architecture and handmade props; no copied commercial course layout, artwork or external model assets.',
});

/** Original farming-basin knots. Branches end at the beginning of the common
 * tail; that tail is sampled once and appended without re-fitting either curve. */
const unscaledPoints={
  start:[[-400,10,-300],[-290,10,-300],[-175,12,-280],[-100,18,-210],[-120,25,-110],[-225,30,-80],[-335,33,-45],[-425,34,50],[-410,32,160],[-300,27,215],[-180,22,205],[-80,18,160],[10,16,120],[100,16,120],[220,16,120]],
  alley:[[220,16,120],[275,16,95],[305,16,70],[305,16,30],[305,16,-30],[305,16,-70],[300,16,-120],[275,16,-175],[220,16,-210]],
  boulevard:[[220,16,120],[302.5,16,97.894],[362.894,16,37.5],[385,16,-45],[362.894,16,-127.5],[302.5,16,-187.894],[220,16,-210]],
  finish:[[180,16,-210],[60,16,-210],[-40,13,-295],[-155,10,-400],[-290,10,-450],[-425,10,-430],[-475,10,-380],[-465,10,-335],[-400,10,-300]],
} satisfies Record<RouteEdgeId,readonly CircuitPoint[]>;
export const HARVEST_PLAN_SCALE=.92;
export const HARVEST_POINTS=Object.freeze(Object.fromEntries(Object.entries(unscaledPoints).map(([id,points])=>
  [id,Object.freeze(points.map(([x,y,z],i)=>Object.freeze([id==='finish'&&i===0?162.4:x*HARVEST_PLAN_SCALE,y,z*HARVEST_PLAN_SCALE] as const)))],
))) as Readonly<Record<RouteEdgeId,readonly CircuitPoint[]>>;
const forward=[1,0,0] as const,backward=[-1,0,0] as const;
const edgeIds=['start','alley','boulevard','finish'] as const;
const bounded=(s:number,length:number)=>Math.max(0,Math.min(length,Number.isFinite(s)?s:0));
const smooth=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
const window=(s:number,from:number,to:number,ramp:number)=>smooth((s-from)/ramp)*smooth((to-s)/ramp);
const packedEarth:LandSurface=Object.freeze({kind:'harvest-packed-earth',grip:.99,rollingResistance:1.015});
const yardPavers:LandSurface=Object.freeze({kind:'harvest-yard-pavers',grip:.955,rollingResistance:1.035});

/** Interaction certification only. Exact full-width ribbon ownership extends
 * beyond this tail and must be determined from the actual source-triangle union. */
export const HARVEST_SHARED_MERGE_LENGTH=40;
export const HARVEST_MERGE_TAIL_POINTS=Object.freeze([
  Object.freeze([202.4,16,-193.2] as const),Object.freeze([162.4,16,-193.2] as const),
]);
export const HARVEST_MERGE_TAIL=new OpenRoad(HARVEST_MERGE_TAIL_POINTS,backward,backward);
/** Straight, level and unbanked, containing the shared runtime's 80 m input zone. */
export const HARVEST_DECISION_APPROACH_LENGTH=100;
export const HARVEST_BASES=Object.freeze(Object.fromEntries(edgeIds.map(id=>[id,new OpenRoad(HARVEST_POINTS[id],
  id==='finish'?backward:forward,id==='start'||id==='finish'?forward:backward,
)]))) as Readonly<Record<RouteEdgeId,OpenRoad>>;
export const HARVEST_ROADS=Object.freeze(Object.fromEntries(edgeIds.map(id=>{
  const base=HARVEST_BASES[id];
  if(id==='start'||id==='finish')return[id,base];
  const length=base.length+HARVEST_MERGE_TAIL.length;
  return[id,Object.freeze({length,sample:(distance:number,lateral=0)=>{
    const s=bounded(distance,length);
    return s<=base.length?base.sample(s,lateral):HARVEST_MERGE_TAIL.sample(s-base.length,lateral);
  }})];
}))) as Readonly<Record<RouteEdgeId,Pick<OpenRoad,'length'|'sample'>>>;

export const HARVEST_EDGES=Object.freeze(Object.fromEntries(edgeIds.map(id=>{
  const road=HARVEST_ROADS[id];
  const halfWidthAt=(distance:number)=>{
    const s=bounded(distance,road.length);
    return id==='alley'?5.7+3.8*(1-smooth(Math.min(s,Math.max(0,road.length-s-HARVEST_SHARED_MERGE_LENGTH))/60)):9.5;
  };
  const sample=(distance:number,lateral=0):LandSample=>{
    const s=bounded(distance,road.length),q=road.sample(s);
    // Banking rotates real lane support, kart frames and pickup support together.
    const bank=id==='start'?.055*window(s,300,650,55)-.045*window(s,730,1080,60):id==='boulevard'?-.045*window(s,110,350,60):0;
    const up=new Vec3().cross(q.t,q.n).normalize();
    const n=q.n.clone().mulScalar(Math.cos(bank)).add(up.mulScalar(Math.sin(bank))).normalize();
    const normal=new Vec3().cross(q.t,n).normalize();
    return{...q,p:q.p.add(n.clone().mulScalar(Number.isFinite(lateral)?lateral:0)),n,normal,bank};
  };
  return[id,Object.freeze({id,length:road.length,sample,halfWidthAt,
    laneLimitAt:(s:number)=>halfWidthAt(s)-.65,
    surfaceAt:(distance:number)=>{
      const s=bounded(distance,road.length);
      return id==='alley'&&s>65&&s<road.length-HARVEST_SHARED_MERGE_LENGTH-65?yardPavers:packedEarth;
    },
  })];
}))) as Readonly<Record<RouteEdgeId,RouteEdge>>;
const {start,alley,boulevard,finish}=HARVEST_EDGES;
const gate=(index:number,edgeId:RouteEdgeId,fraction:number):CheckpointGate=>Object.freeze({index,edgeId,s:HARVEST_EDGES[edgeId].length*fraction});
export const HARVEST_COURSE:ForkCourse=Object.freeze({
  id:HARVEST_META.id,edges:HARVEST_EDGES,sharedMergeLength:HARVEST_SHARED_MERGE_LENGTH,
  commonStart:start,commonFinish:finish,alternates:Object.freeze({alley,boulevard}),
  canonicalLength:start.length+boulevard.length+finish.length,gatesPerLap:8,
  presentation:Object.freeze({branchLabels:Object.freeze({alley:'谷仓折线',boulevard:'麦浪外环'})}),
  checkpointGates:Object.freeze([
    gate(0,'start',.31),gate(1,'start',.91),gate(2,'alley',.34),gate(3,'alley',.75),
    gate(2,'boulevard',.34),gate(3,'boulevard',.75),
    gate(4,'finish',.10),gate(5,'finish',.38),gate(6,'finish',.72),gate(7,'finish',1),
  ]),
});
export const HARVEST_ROAD_EDGES:readonly RouteEdge[]=Object.freeze(edgeIds.map(id=>HARVEST_EDGES[id]));

/** Source-level barn reservation, not a complete-building solid. Keep both
 * portals open; scenery must measure actual walls, beam contacts and grounding. */
export const HARVEST_BARN=Object.freeze({
  id:'open-threshing-barn',edgeId:'alley' as const,center:Object.freeze({x:280.6,y:16,z:0}),
  centerS:157.71487126710332,straightFromS:130.1148712670008,straightToS:185.31487126720583,
  exteriorHalfWidth:26,exteriorHalfLength:28,interiorHalfWidth:24,portalWidth:48,
  floorY:16,undersideY:34,roofRidgeY:43,
  solids:Object.freeze([
    Object.freeze({id:'west-wall-and-posts',min:Object.freeze([254.6,16,-26] as const),max:Object.freeze([256.6,34,26] as const)}),
    Object.freeze({id:'east-wall-and-posts',min:Object.freeze([304.6,16,-26] as const),max:Object.freeze([306.6,34,26] as const)}),
    Object.freeze({id:'roof-and-tie-envelope',min:Object.freeze([254.6,34,-28] as const),max:Object.freeze([306.6,43,28] as const)}),
  ]),
});
/** Horizontal reservations only. Every final full footprint and contact chain
 * must be checked against emitted terrain; ySeed is never a grounding proof. */
export const HARVEST_LANDMARKS=Object.freeze({
  split:Object.freeze({x:202.4,y:16,z:110.4}),merge:Object.freeze({x:162.4,y:16,z:-193.2}),
  junctionClearance:110,barn:HARVEST_BARN,
  plots:Object.freeze([
    Object.freeze({id:'amberwind-mill',x:-205,z:25,ySeed:24,radius:35,height:56}),
    Object.freeze({id:'stone-granary',x:-45.346328981244035,z:-209.77734289004638,ySeed:15.017012465778503,radius:19,height:21}),
    Object.freeze({id:'orchard-press',x:-298.33223835008846,z:241.56972426375236,ySeed:26.69099016425446,radius:17,height:17}),
    Object.freeze({id:'field-silo-cluster',x:402.5564852979575,z:-47.413882819346284,ySeed:15.181763480826522,radius:18,height:29}),
    Object.freeze({id:'harvest-market',x:-165.2363233219158,z:-440.4465763627862,ySeed:6.785036718657185,radius:23,height:15}),
  ]),
});

const length=HARVEST_COURSE.canonicalLength,defaultEdges=[start,boulevard,finish] as const;
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
/** Exact compatibility view of start + contour + finish. Physical edge/s remains
 * authoritative for driving, checkpoint credit, reset, interaction and pickups. */
const circuit={length,sample,curvature(distance:number,span=7){
  const a=sample(distance).t,b=sample(distance+span).t;
  return Math.atan2(a.z*b.x-a.x*b.z,a.x*b.x+a.z*b.z)/span;
}} as unknown as ClosedCircuit;
const clearance=HARVEST_ROAD_EDGES.flatMap(edge=>Array.from({length:Math.ceil(edge.length/2)+1},(_,i)=>{
  const s=Math.min(edge.length,i*2);return{p:edge.sample(s).p,w:edge.halfWidthAt(s)};
}));
export const HARVEST_TRACK:LandTrack=Object.freeze({
  id:HARVEST_META.id,label:HARVEST_META.label,tag:HARVEST_META.tag,length,circuit,sample,halfWidthAt,
  laneLimitAt:(distance:number)=>{const {edge,s}=locate(distance);return edge.laneLimitAt(s);},
  surfaceAt:(distance:number)=>{const {edge,s}=locate(distance);return edge.surfaceAt(s);},
  sections:Object.freeze([
    Object.freeze({name:'Grain terrace climb, windmill ridge and orchard release',from:0,to:start.length}),
    Object.freeze({name:'Golden Contour alternate',from:start.length,to:start.length+boulevard.length}),
    Object.freeze({name:'Market hollow return',from:start.length+boulevard.length,to:length}),
  ]),
  // Compatibility only. Fork gameplay uses explicit edge-local pickup support.
  pickups:Object.freeze([240,750,1030,start.length+220,start.length+boulevard.length+280,
    start.length+boulevard.length+550,
  ].flatMap(d=>[-3.5,3.5].map(lateral=>Object.freeze({d,lateral})))),
  clearAt(x:number,z:number,radius=0){
    return Number.isFinite(x+z+radius)&&clearance.every(({p,w})=>Math.hypot(p.x-x,p.z-z)>w+Math.max(0,radius)+3.5);
  },
});
