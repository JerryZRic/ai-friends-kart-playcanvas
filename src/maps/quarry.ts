import {OpenRoad} from '../open-road';
import type {ClosedCircuit, CircuitPoint} from '../closed-circuit';
import {wrapLandDistance, type LandTrack, type LandSurface} from '../land-track';
import type {ForkCourse, RouteEdge, RouteEdgeId, CheckpointGate} from '../land-routes';

export const QUARRY_META = Object.freeze({
  id: 'quarry', label: '赤砾采石环道', tag: 'REDSTRATA QUARRY',
  branchLabels: Object.freeze({alley: '石脊窄道 / Carved Shelf', boulevard: '重载环坡 / Haul Road'}),
  description: 'Original dry terraced quarry: a working-floor sweep, carved shelf/haul-road fork and timber-supported crossing.',
});

/** Original quarry knots, authored independently of the other land courses.
 * Horizontal scale is a geometry parameter; elevations remain physical metres.
 * The branch endpoint is the BEGINNING of the separately sampled common tail. */
const ORIGINAL_QUARRY_POINTS = {
  start: [[-180,6,-230],[-95,6,-230],[-25,6,-228],[90,8,-195],[185,11,-145],[220,14,-65],[185,18,10],[95,22,45],[5,27,65],[-65,27,120],[-70,27,185]],
  alley: [[-70,27,185],[-30,27,230],[30,27,215],[90,30,235],[140,30,285],[205,30,280],[250,30,240],[270,30,185]],
  boulevard: [[-70,27,185],[-47.224,27,272.5],[15,27,336.554],[100,30,360],[185,30,336.554],[247.224,30,272.5],[270,30,185]],
  finish: [[270,30,130],[315,30,-10],[345,30,-90],[315,32,-195],[235,32,-280],[110,32,-310],[30,32,-275],[0,32,-230],[-50,30,-170],[-155,22,-135],[-285,13,-145],[-350,9,-150],[-399.497,7.5,-170.503],[-420,6.4,-220],[-399.497,6,-269.497],[-350,6,-290],[-270,6,-260],[-180,6,-230]],
} satisfies Record<RouteEdgeId, readonly CircuitPoint[]>;
export const QUARRY_HORIZONTAL_SCALE = .74;
export const QUARRY_POINTS = Object.freeze(Object.fromEntries(Object.entries(ORIGINAL_QUARRY_POINTS).map(([id, points]) =>
  [id, Object.freeze(points.map(([x,y,z]) => Object.freeze([x*QUARRY_HORIZONTAL_SCALE,y,z*QUARRY_HORIZONTAL_SCALE] as const)))],
))) as unknown as Readonly<Record<RouteEdgeId, readonly CircuitPoint[]>>;

const split = [0,0,1] as const, merge = [0,0,-1] as const, seam = [1,0,0] as const;
const edgeIds = ['start','alley','boulevard','finish'] as const;
const smooth = (v:number) => {const u=Math.max(0,Math.min(1,v));return u*u*(3-2*u);};
const haulSurface:LandSurface = Object.freeze({kind:'quarry-compacted-haul',grip:1,rollingResistance:1.02});
const shelfSurface:LandSurface = Object.freeze({kind:'quarry-cut-stone',grip:.97,rollingResistance:1.035});

/** The complete appended straight is 40.7 m. Only the last 40 m is certified
 * for shared interactions. This is NOT the render-overlap clipping distance. */
export const QUARRY_SHARED_MERGE_LENGTH = 40;
export const QUARRY_MERGE_TAIL_POINTS = Object.freeze([
  Object.freeze([270*QUARRY_HORIZONTAL_SCALE,30,185*QUARRY_HORIZONTAL_SCALE] as const),
  Object.freeze([270*QUARRY_HORIZONTAL_SCALE,30,130*QUARRY_HORIZONTAL_SCALE] as const),
]);
export const QUARRY_MERGE_TAIL = new OpenRoad(QUARRY_MERGE_TAIL_POINTS,merge,merge);
const baseRoads = Object.fromEntries(edgeIds.map(id => [id, new OpenRoad(QUARRY_POINTS[id],
  id==='start'?seam:id==='finish'?merge:split,
  id==='start'?split:id==='finish'?seam:merge,
)])) as Record<RouteEdgeId, OpenRoad>;

/** Concatenate source samplers without re-fitting their knots. Re-fitting would
 * change physical lengths and destroy the identical branch-tail certificate. */
export const QUARRY_ROADS = Object.freeze(Object.fromEntries(edgeIds.map(id => {
  const base=baseRoads[id];
  if(id==='start'||id==='finish')return [id,base];
  return [id,Object.freeze({length:base.length+QUARRY_MERGE_TAIL.length,
    sample:(s:number,lateral=0) => s<=base.length ? base.sample(s,lateral) : QUARRY_MERGE_TAIL.sample(s-base.length,lateral),
  })];
}))) as Readonly<Record<RouteEdgeId, Pick<OpenRoad,'length'|'sample'>>>;

export const QUARRY_EDGES = Object.freeze(Object.fromEntries(edgeIds.map(id => {
  const road=QUARRY_ROADS[id];
  const halfWidthAt=(s:number) => id==='alley'
    ? 4.4+5.6*(1-smooth(Math.min(s,Math.max(0,road.length-s-QUARRY_MERGE_TAIL.length))/68)) : 10;
  return [id,Object.freeze({id,length:road.length,
    sample:(s:number,lateral=0) => road.sample(s,lateral), halfWidthAt,
    laneLimitAt:(s:number) => halfWidthAt(s)-.65,
    surfaceAt:(s:number) => id==='alley'&&s>50&&s<road.length-QUARRY_MERGE_TAIL.length ? shelfSurface : haulSurface,
  })];
}))) as Readonly<Record<RouteEdgeId, RouteEdge>>;

const {start,alley,boulevard,finish}=QUARRY_EDGES;
const gate=(index:number,edgeId:RouteEdgeId,fraction:number):CheckpointGate => Object.freeze({index,edgeId,s:QUARRY_EDGES[edgeId].length*fraction});
export const QUARRY_COURSE:ForkCourse = Object.freeze({
  id:QUARRY_META.id, sharedMergeLength:QUARRY_SHARED_MERGE_LENGTH, edges:QUARRY_EDGES,
  commonStart:start,commonFinish:finish,alternates:Object.freeze({alley,boulevard}),
  canonicalLength:start.length+boulevard.length+finish.length,gatesPerLap:8,
  presentation:Object.freeze({branchLabels:Object.freeze({alley:'石脊窄道',boulevard:'重载环坡'})}),
  checkpointGates:Object.freeze([
    gate(0,'start',.30),gate(1,'start',.88),gate(2,'alley',.36),gate(3,'alley',.75),
    gate(2,'boulevard',.36),gate(3,'boulevard',.75),
    gate(4,'finish',.08),gate(5,'finish',.35),gate(6,'finish',.70),gate(7,'finish',1),
  ]),
});
export const QUARRY_ROAD_EDGES:readonly RouteEdge[] = Object.freeze(edgeIds.map(id => QUARRY_EDGES[id]));

/** Explicit physical crossing metadata. Never choose support height by nearest
 * XZ: lower and upper road, camera and reset all retain their own edge and s. */
export const QUARRY_LANDMARKS = Object.freeze({
  split:Object.freeze({x:-51.8,y:27,z:136.9}),
  merge:Object.freeze({x:199.8,y:30,z:96.2}),
  crossing:Object.freeze({
    x:-3.3552661948250266,z:-165.60958142078994,
    lowerEdge:'start' as const,lowerS:130.27728635033287,lowerY:6.245987120991759,
    upperEdge:'finish' as const,upperS:550.2825243569553,upperY:31.88915021958154,
    structuralDepth:2.4,minUndersideClearance:22.753,
  }),
  // A conservative gameplay exclusion, never a substitute for ribbon subtraction.
  junctionClearance:135,
});

const length=QUARRY_COURSE.canonicalLength;
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
/** LandTrack's legacy circuit is only a view of exact start + haul + finish.
 * It never introduces another spline or converts canonical ranking to support. */
const circuit={length,sample,curvature(distance:number,span=7){
  const a=sample(distance).t,b=sample(distance+span).t;
  return Math.atan2(a.z*b.x-a.x*b.z,a.x*b.x+a.z*b.z)/span;
}} as unknown as ClosedCircuit;
const clearance=QUARRY_ROAD_EDGES.flatMap(edge => Array.from({length:Math.ceil(edge.length/2)+1},(_,i) => {
  const s=Math.min(edge.length,i*2);return {p:edge.sample(s).p,w:edge.halfWidthAt(s)};
}));
export const QUARRY_TRACK:LandTrack = Object.freeze({
  id:QUARRY_META.id,label:QUARRY_META.label,tag:QUARRY_META.tag,length,circuit,sample,halfWidthAt,
  laneLimitAt:(distance:number) => {const {edge,s}=locate(distance);return edge.laneLimitAt(s);},
  surfaceAt:(distance:number) => {const {edge,s}=locate(distance);return edge.surfaceAt(s);},
  sections:Object.freeze([
    Object.freeze({name:'Working floor and carved ascent',from:0,to:start.length}),
    Object.freeze({name:'Haul Road alternate',from:start.length,to:start.length+boulevard.length}),
    Object.freeze({name:'Dry-Cut Trestle and loading-yard return',from:start.length+boulevard.length,to:length}),
  ]),
  // Legacy default-loop rows only. Fork runtime uses explicit edge-local pickups.
  pickups:Object.freeze([230,450,start.length+230,start.length+boulevard.length+180,
    start.length+boulevard.length+840,start.length+boulevard.length+1040,
  ].flatMap(d => [-3.5,3.5].map(lateral => Object.freeze({d,lateral})))),
  clearAt(x:number,z:number,radius=0){
    return Number.isFinite(x+z+radius)&&clearance.every(({p,w}) => Math.hypot(p.x-x,p.z-z)>w+Math.max(0,radius)+3.5);
  },
});
