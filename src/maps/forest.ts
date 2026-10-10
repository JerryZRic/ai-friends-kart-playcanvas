import {Vec3} from 'playcanvas';
import {OpenRoad} from '../open-road';
import type {ClosedCircuit, CircuitPoint} from '../closed-circuit';
import {wrapLandDistance, type LandSample, type LandSurface, type LandTrack} from '../land-track';
import type {CheckpointGate, ForkCourse, RouteEdge, RouteEdgeId} from '../land-routes';

export const FOREST_META = Object.freeze({
  id: 'forest', label: '杉影星台环线', tag: 'CEDARLIGHT OBSERVATORY',
  branchLabels: Object.freeze({alley: '星台旧径 / Lens Service Path', boulevard: '望远镜外环 / Observatory Rim'}),
  description: 'Original cedar highlands: a root-valley slalom, physically banked climbing bowl, observatory fork and elevated canopy crossing.',
});

/** Original measured knots. Horizontal reflection makes the service path the
 * positive-lateral (A/left) choice in the shared input adapter. Elevations remain
 * physical metres. Each branch ends at the BEGINNING of the common tail. */
const ORIGINAL_FOREST_POINTS = {
  start: [[-230,8,-280],[-110,8,-280],[0,8,-260],[80,9,-205],[80,10,-130],[20,11,-65],[-40,12,0],[0,14,65],[85,17,80],[165,19,70],[245,23,110],[290,27,185],[265,31,270],[190,34,300],[135,34,330],[100,34,390],[100,34,430],[100,34,560]],
  alley: [[100,34,560],[82,34,607],[30,34,630],[-18,34,610],[-65,34,610],[-125,34,607],[-170,34,560]],
  boulevard: [[100,34,560],[81.91343,34,627.5],[32.5,34,676.91343],[-35,34,695],[-102.5,34,676.91343],[-151.91343,34,627.5],[-170,34,560]],
  finish: [[-170,34,505],[-170,34,370],[-175,34,295],[-200,34,235],[-220,35,180],[-200,36,115],[-130,36,50],[-40,36,0],[85,35,-5],[195,32,-50],[260,27,-130],[265,20,-235],[220,15,-315],[120,10,-365],[-20,8,-380],[-150,8,-420],[-230,8,-420],[-279.49747,8,-399.49747],[-300,8,-350],[-279.49747,8,-300.50253],[-230,8,-280]],
} satisfies Record<RouteEdgeId, readonly CircuitPoint[]>;
export const FOREST_HORIZONTAL_SCALE = .75;
const convert = ([x,y,z]:readonly number[]) => Object.freeze([-x*FOREST_HORIZONTAL_SCALE,y,z*FOREST_HORIZONTAL_SCALE] as const);
export const FOREST_POINTS = Object.freeze(Object.fromEntries(Object.entries(ORIGINAL_FOREST_POINTS).map(([id,points]) =>
  [id,Object.freeze(points.map(convert))],
))) as unknown as Readonly<Record<RouteEdgeId, readonly CircuitPoint[]>>;

const split = [0,0,1] as const, merge = [0,0,-1] as const, seam = [-1,0,0] as const;
const edgeIds = ['start','alley','boulevard','finish'] as const;
const bounded = (s:number,length:number) => Math.max(0,Math.min(length,Number.isFinite(s)?s:0));
const smooth = (n:number) => {const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
const window = (s:number,from:number,to:number,ramp:number) => smooth((s-from)/ramp)*smooth((to-s)/ramp);
const forestSurface:LandSurface = Object.freeze({kind:'cedar-packed-earth',grip:.99,rollingResistance:1.025});
const stoneSurface:LandSurface = Object.freeze({kind:'observatory-service-stone',grip:.97,rollingResistance:1.035});

/** The full tail is 41.25 m; only its final 40 m certifies shared interactions.
 * Actual source-ribbon overlap begins earlier and requires spatial ownership,
 * never a guessed 40 m render/rail cutoff. */
export const FOREST_SHARED_MERGE_LENGTH = 40;
export const FOREST_MERGE_TAIL_POINTS = Object.freeze([convert([-170,34,560]),convert([-170,34,505])]);
export const FOREST_MERGE_TAIL = new OpenRoad(FOREST_MERGE_TAIL_POINTS,merge,merge);
/** This straight contains the shared runtime's complete 80 m decision zone. */
export const FOREST_DECISION_APPROACH_LENGTH = 97.5;

const baseRoads = Object.fromEntries(edgeIds.map(id => [id,new OpenRoad(FOREST_POINTS[id],
  id==='start'?seam:id==='finish'?merge:split,
  id==='start'?split:id==='finish'?seam:merge,
)])) as Record<RouteEdgeId,OpenRoad>;

/** Concatenate source samplers without re-fitting the knots: both alternatives
 * must retain the exact same separately sampled physical tail. */
export const FOREST_ROADS = Object.freeze(Object.fromEntries(edgeIds.map(id => {
  const base=baseRoads[id];
  if(id==='start'||id==='finish')return [id,base];
  const length=base.length+FOREST_MERGE_TAIL.length;
  return [id,Object.freeze({length,sample:(distance:number,lateral=0) => {
    const s=bounded(distance,length);
    return s<=base.length ? base.sample(s,lateral) : FOREST_MERGE_TAIL.sample(s-base.length,lateral);
  }})];
}))) as Readonly<Record<RouteEdgeId,Pick<OpenRoad,'length'|'sample'>>>;

export const FOREST_EDGES = Object.freeze(Object.fromEntries(edgeIds.map(id => {
  const road=FOREST_ROADS[id];
  const halfWidthAt=(distance:number) => {
    const s=bounded(distance,road.length);
    return id==='alley' ? 5.2+4.3*(1-smooth(Math.min(s,Math.max(0,road.length-s-FOREST_MERGE_TAIL.length))/70))
      : id==='start' ? 9.5+1.7*window(s,575,950,70) : 9.5;
  };
  const sample=(distance:number,lateral=0):LandSample => {
    const s=bounded(distance,road.length),q=road.sample(s);
    // Bank the actual road, kart and pickup support, with eased entry/exit.
    // The plateau, all junctions and the lap seam remain exactly unbanked.
    const bank=id==='start' ? -.14*window(s,605,935,75) : 0;
    const up=new Vec3().cross(q.t,q.n).normalize();
    const n=q.n.clone().mulScalar(Math.cos(bank)).add(up.mulScalar(Math.sin(bank))).normalize();
    const normal=new Vec3().cross(q.t,n).normalize();
    return {...q,p:q.p.add(n.clone().mulScalar(Number.isFinite(lateral)?lateral:0)),n,normal,bank};
  };
  return [id,Object.freeze({id,length:road.length,sample,halfWidthAt,
    laneLimitAt:(s:number) => halfWidthAt(s)-.65,
    surfaceAt:(distance:number) => {
      const s=bounded(distance,road.length);
      return id==='alley'&&s>70&&s<road.length-FOREST_MERGE_TAIL.length-70 ? stoneSurface : forestSurface;
    },
  })];
}))) as Readonly<Record<RouteEdgeId,RouteEdge>>;

const {start,alley,boulevard,finish}=FOREST_EDGES;
const gate=(index:number,edgeId:RouteEdgeId,fraction:number):CheckpointGate => Object.freeze({index,edgeId,s:FOREST_EDGES[edgeId].length*fraction});
export const FOREST_COURSE:ForkCourse = Object.freeze({
  id:FOREST_META.id,edges:FOREST_EDGES,sharedMergeLength:FOREST_SHARED_MERGE_LENGTH,
  commonStart:start,commonFinish:finish,alternates:Object.freeze({alley,boulevard}),
  canonicalLength:start.length+boulevard.length+finish.length,gatesPerLap:8,
  presentation:Object.freeze({branchLabels:Object.freeze({alley:'星台旧径',boulevard:'星台外环'})}),
  checkpointGates:Object.freeze([
    gate(0,'start',.30),gate(1,'start',.88),gate(2,'alley',.34),gate(3,'alley',.7),
    gate(2,'boulevard',.34),gate(3,'boulevard',.7),
    gate(4,'finish',.13),gate(5,'finish',.43),gate(6,'finish',.72),gate(7,'finish',1),
  ]),
});
export const FOREST_ROAD_EDGES:readonly RouteEdge[] = Object.freeze(edgeIds.map(id => FOREST_EDGES[id]));

/** Crossing support is always edge + physical s, never nearest XZ. The clearance
 * certificate uses 2 m source-triangle ribbons and reserves 2.2 m for structure.
 * Landmark ySeed values are placement seeds, not emitted terrain foundations. */
export const FOREST_LANDMARKS = Object.freeze({
  split:Object.freeze({x:-75,y:34,z:420}),
  merge:Object.freeze({x:127.5,y:34,z:378.75}),
  crossing:Object.freeze({
    x:30,z:0,lowerEdge:'start' as const,lowerS:441.2366530619097,lowerY:12,
    upperEdge:'finish' as const,upperS:452.3205033850164,upperY:36,
    structuralDepth:2.2,minUndersideClearance:21.468,
    noFillBounds:Object.freeze({minX:2,maxX:52,minZ:-24,maxZ:25}),
  }),
  // Gameplay exclusion only. Scenery clips the exact union of road footprints.
  junctionClearance:135,
  plots:Object.freeze([
    Object.freeze({id:'abandoned-observatory',x:20,z:405,ySeed:32,radius:23,height:30}),
    Object.freeze({id:'root-cathedral',x:69.88613199486466,z:-47.050011386285156,ySeed:8.6183514761597,radius:17,height:27}),
    Object.freeze({id:'cedar-bowl-fan',x:-278.6908745068894,z:148.5673587453813,ySeed:33.164217222713305,radius:20,height:29}),
    Object.freeze({id:'broken-meridian-armillary',x:46.63393569558838,z:571.3495747545905,ySeed:31,radius:12,height:13}),
    Object.freeze({id:'canopy-viaduct-lookout',x:106.34834083478663,z:115.4405858299369,ySeed:33.01244082331058,radius:13,height:16}),
    Object.freeze({id:'old-forestry-station',x:179.1281131652654,z:-369.12287388948823,ySeed:5,radius:15,height:10}),
  ]),
});

const length=FOREST_COURSE.canonicalLength;
const defaultEdges=[start,boulevard,finish] as const;
const locate=(distance:number) => {
  let s=wrapLandDistance(distance,length);
  for(const edge of defaultEdges){if(s<edge.length)return {edge,s};s-=edge.length;}
  return {edge:start,s:0};
};
const sample=(distance:number,lateral=0) => {
  const {edge,s}=locate(distance);
  return {...edge.sample(s,lateral),u:wrapLandDistance(distance,length)/length};
};
const halfWidthAt=(distance:number) => {const {edge,s}=locate(distance);return edge.halfWidthAt(s);};
/** Legacy LandTrack is only a view of exact start + rim + finish support. No
 * extra spline and no conversion from canonical ranking to physical driving. */
const circuit={length,sample,curvature(distance:number,span=7){
  const a=sample(distance).t,b=sample(distance+span).t;
  return Math.atan2(a.z*b.x-a.x*b.z,a.x*b.x+a.z*b.z)/span;
}} as unknown as ClosedCircuit;
const clearance=FOREST_ROAD_EDGES.flatMap(edge => Array.from({length:Math.ceil(edge.length/2)+1},(_,i) => {
  const s=Math.min(edge.length,i*2);return {p:edge.sample(s).p,w:edge.halfWidthAt(s)};
}));
export const FOREST_TRACK:LandTrack = Object.freeze({
  id:FOREST_META.id,label:FOREST_META.label,tag:FOREST_META.tag,length,circuit,sample,halfWidthAt,
  laneLimitAt:(distance:number) => {const {edge,s}=locate(distance);return edge.laneLimitAt(s);},
  surfaceAt:(distance:number) => {const {edge,s}=locate(distance);return edge.surfaceAt(s);},
  sections:Object.freeze([
    Object.freeze({name:'Root valley and banked cedar bowl',from:0,to:start.length}),
    Object.freeze({name:'Observatory Rim alternate',from:start.length,to:start.length+boulevard.length}),
    Object.freeze({name:'Canopy viaduct and forestry-station return',from:start.length+boulevard.length,to:length}),
  ]),
  // Compatibility rows only. Fork gameplay uses explicit edge-local pickups.
  pickups:Object.freeze([220,600,start.length+160,start.length+boulevard.length+750,
    start.length+boulevard.length+1020,start.length+boulevard.length+1200,
  ].flatMap(d => [-3.5,3.5].map(lateral => Object.freeze({d,lateral})))),
  clearAt(x:number,z:number,radius=0){
    return Number.isFinite(x+z+radius)&&clearance.every(({p,w}) => Math.hypot(p.x-x,p.z-z)>w+Math.max(0,radius)+3.5);
  },
});
