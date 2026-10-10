import {Vec3} from 'playcanvas';
import {OpenRoad} from '../open-road';
import type {ClosedCircuit, CircuitPoint} from '../closed-circuit';
import {wrapLandDistance, type LandSample, type LandSurface, type LandTrack} from '../land-track';
import type {CheckpointGate, ForkCourse, RouteEdge, RouteEdgeId} from '../land-routes';

export const WORKSHOP_META = Object.freeze({
  id:'workshop', label:'发条工坊回旋道', tag:'CLOCKWIND WORKSHOP',
  branchLabels:Object.freeze({alley:'工具柜弯道 / Cabinet Chicane',boulevard:'木台外沿 / Workbench Rim'}),
  description:'Original clockmaker workshop: a banked three-quarter spool climb, same-edge overhead crossing, cabinet chicane and graded drawer-terrace return.',
  originality:'Original geometry and handmade workshop art direction; no third-party map, model, texture or layout references.',
});

const arc=(cx:number,cz:number,radius:number,from:number,to:number,count:number,y0:number,y1:number) =>
  Array.from({length:count+1},(_,i) => {
    const t=i/count,angle=(from+(to-from)*t)*Math.PI/180;
    return [cx+radius*Math.cos(angle),y0+(y1-y0)*t,cz+radius*Math.sin(angle)] as const;
  });
/** Original physical-metre knots. The spool and crossing are both on start;
 * neither support nor resets may identify this road by nearest XZ. Branch knots
 * stop at the beginning of the separately sampled common tail. */
const points = {
  start:[[-360,8,-160],[-240,8,-160],[-100,8,-160],[25,8,-150],[110,9,-100],[90,10,-20],
    ...arc(-40,40,110,0,270,9,12,36),[60,36,-70],[160,36,-70],[260,36,-70]],
  alley:[[260,36,-70],[300,36,-82],[338,36,-120],[330,36,-165],[340,36,-215],[310,36,-280],[260,36,-310]],
  boulevard:arc(260,-190,120,90,-90,6,36,36),
  finish:[[220,36,-310],[110,35,-310],[-30,27,-310],[-170,18,-310],[-290,10,-300],[-375,8,-270],[-420,8,-215],[-410,8,-175],[-360,8,-160]],
} satisfies Record<RouteEdgeId, readonly CircuitPoint[]>;
export const WORKSHOP_POINTS = Object.freeze(Object.fromEntries(Object.entries(points).map(([id,knots]) =>
  [id,Object.freeze(knots.map(p => Object.freeze(p)))],
))) as unknown as Readonly<Record<RouteEdgeId, readonly CircuitPoint[]>>;
export const WORKSHOP_SPOOL = Object.freeze({
  center:Object.freeze([-40,40] as const), radius:110, fromDegrees:0, toDegrees:270, rise:24, knots:10,
  fromS:635.5864882347765, toS:1153.7604926330082,
  description:'Three-quarter helical ascent with actual sampled height, camber and grade.',
});

const forward=[1,0,0] as const,backward=[-1,0,0] as const;
const edgeIds=['start','alley','boulevard','finish'] as const;
const bounded=(s:number,length:number) => Math.max(0,Math.min(length,Number.isFinite(s)?s:0));
const smooth=(n:number) => {const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
const window=(s:number,from:number,to:number,ramp:number) => smooth((s-from)/ramp)*smooth((to-s)/ramp);
const woodSurface:LandSurface=Object.freeze({kind:'workshop-sealed-wood',grip:.99,rollingResistance:1.02});
const cabinetSurface:LandSurface=Object.freeze({kind:'workshop-cabinet-inlay',grip:.96,rollingResistance:1.035});

/** This exact 40 m tail certifies interactions. The physical fork ribbons overlap
 * around 100 m after split and 98 m before merge: render/rail ownership must use
 * the actual source-triangle union, never this interaction-distance cutoff. */
export const WORKSHOP_SHARED_MERGE_LENGTH=40;
export const WORKSHOP_MERGE_TAIL_POINTS=Object.freeze([
  Object.freeze([260,36,-310] as const),Object.freeze([220,36,-310] as const),
]);
export const WORKSHOP_MERGE_TAIL=new OpenRoad(WORKSHOP_MERGE_TAIL_POINTS,backward,backward);
/** Fully straight, level, unbanked approach containing the shared 80 m input zone. */
export const WORKSHOP_DECISION_APPROACH_LENGTH=200;
const baseRoads=Object.fromEntries(edgeIds.map(id => [id,new OpenRoad(WORKSHOP_POINTS[id],
  id==='finish'?backward:forward,id==='start'||id==='finish'?forward:backward,
)])) as Record<RouteEdgeId,OpenRoad>;

/** Append source samplers without re-fitting: both branches retain identical
 * frames across the entire separately sampled common tail. */
export const WORKSHOP_ROADS=Object.freeze(Object.fromEntries(edgeIds.map(id => {
  const base=baseRoads[id];
  if(id==='start'||id==='finish')return [id,base];
  const length=base.length+WORKSHOP_MERGE_TAIL.length;
  return [id,Object.freeze({length,sample:(distance:number,lateral=0) => {
    const s=bounded(distance,length);
    return s<=base.length?base.sample(s,lateral):WORKSHOP_MERGE_TAIL.sample(s-base.length,lateral);
  }})];
}))) as Readonly<Record<RouteEdgeId,Pick<OpenRoad,'length'|'sample'>>>;

export const WORKSHOP_EDGES=Object.freeze(Object.fromEntries(edgeIds.map(id => {
  const road=WORKSHOP_ROADS[id];
  const halfWidthAt=(distance:number) => {
    const s=bounded(distance,road.length);
    return id==='alley'?5.4+4.1*(1-smooth(Math.min(s,Math.max(0,road.length-s-WORKSHOP_MERGE_TAIL.length))/65)):9.5;
  };
  const sample=(distance:number,lateral=0):LandSample => {
    const s=bounded(distance,road.length),q=road.sample(s);
    // Rotate actual physical support, including outer lanes, karts and pickups.
    const bank=id==='start'?.10*window(s,580,1080,65):0;
    const up=new Vec3().cross(q.t,q.n).normalize();
    const n=q.n.clone().mulScalar(Math.cos(bank)).add(up.mulScalar(Math.sin(bank))).normalize();
    const normal=new Vec3().cross(q.t,n).normalize();
    return {...q,p:q.p.add(n.clone().mulScalar(Number.isFinite(lateral)?lateral:0)),n,normal,bank};
  };
  return [id,Object.freeze({id,length:road.length,sample,halfWidthAt,
    laneLimitAt:(s:number) => halfWidthAt(s)-.65,
    surfaceAt:(distance:number) => {
      const s=bounded(distance,road.length);
      return id==='alley'&&s>65&&s<road.length-WORKSHOP_MERGE_TAIL.length-65?cabinetSurface:woodSurface;
    },
  })];
}))) as Readonly<Record<RouteEdgeId,RouteEdge>>;
const {start,alley,boulevard,finish}=WORKSHOP_EDGES;
const gate=(index:number,edgeId:RouteEdgeId,fraction:number):CheckpointGate => Object.freeze({index,edgeId,s:WORKSHOP_EDGES[edgeId].length*fraction});
export const WORKSHOP_COURSE:ForkCourse=Object.freeze({
  id:WORKSHOP_META.id,edges:WORKSHOP_EDGES,sharedMergeLength:WORKSHOP_SHARED_MERGE_LENGTH,
  commonStart:start,commonFinish:finish,alternates:Object.freeze({alley,boulevard}),
  canonicalLength:start.length+boulevard.length+finish.length,gatesPerLap:8,
  presentation:Object.freeze({branchLabels:Object.freeze({alley:'工具柜弯道',boulevard:'木台外沿'})}),
  checkpointGates:Object.freeze([
    gate(0,'start',.32),gate(1,'start',.90),gate(2,'alley',.34),gate(3,'alley',.72),
    gate(2,'boulevard',.34),gate(3,'boulevard',.72),
    gate(4,'finish',.12),gate(5,'finish',.40),gate(6,'finish',.72),gate(7,'finish',1),
  ]),
});
export const WORKSHOP_ROAD_EDGES:readonly RouteEdge[]=Object.freeze(edgeIds.map(id => WORKSHOP_EDGES[id]));

/** Source-level structure/plot reservations, not emitted scenery certificates.
 * The height-separated crossing lies on one edge at two physical s values.
 * ySeed values must not substitute for final source-mesh foundation sampling. */
export const WORKSHOP_LANDMARKS=Object.freeze({
  split:Object.freeze({x:260,y:36,z:-70}),merge:Object.freeze({x:220,y:36,z:-310}),
  crossing:Object.freeze({
    x:110.81068432623896,z:-70,lowerEdge:'start' as const,lowerS:518.0803465091211,lowerY:9.341319609435596,
    upperEdge:'start' as const,upperS:1304.6328964491433,upperY:36,
    structuralDepth:2.4,minUndersideClearance:24.130,
    noFillBounds:Object.freeze({minX:77,maxX:143,minZ:-100,maxZ:-40}),
  }),
  junctionClearance:120,
  plots:Object.freeze([
    Object.freeze({id:'clock-heart-and-spool',x:-40,z:40,ySeed:3,radius:47,height:62}),
    Object.freeze({id:'tool-cabinet-bank',x:280,z:-190,ySeed:34,radius:23,height:45}),
    Object.freeze({id:'vise-and-jaw-station',x:-53.857062724933975,z:-209.70012796108534,ySeed:4.9525751458576535,radius:20,height:22}),
    Object.freeze({id:'upright-drafting-square',x:423.05358192538665,z:-223.39097080856916,ySeed:33,radius:16,height:48}),
    Object.freeze({id:'turned-wooden-lamp',x:-73.35545262122052,z:-258.8518674647417,ySeed:21.338561045586033,radius:21,height:60}),
    Object.freeze({id:'drawer-stack-ramp',x:-374.0264735991185,z:-325.55644052254195,ySeed:5.288765467740658,radius:18,height:34}),
  ]),
});

const length=WORKSHOP_COURSE.canonicalLength,defaultEdges=[start,boulevard,finish] as const;
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
/** Compatibility is an exact view of start + rim + finish, not another spline.
 * Canonical ranking never replaces physical edge/s driving or crossing support. */
const circuit={length,sample,curvature(distance:number,span=7){
  const a=sample(distance).t,b=sample(distance+span).t;
  return Math.atan2(a.z*b.x-a.x*b.z,a.x*b.x+a.z*b.z)/span;
}} as unknown as ClosedCircuit;
const clearance=WORKSHOP_ROAD_EDGES.flatMap(edge => Array.from({length:Math.ceil(edge.length/2)+1},(_,i) => {
  const s=Math.min(edge.length,i*2);return {p:edge.sample(s).p,w:edge.halfWidthAt(s)};
}));
export const WORKSHOP_TRACK:LandTrack=Object.freeze({
  id:WORKSHOP_META.id,label:WORKSHOP_META.label,tag:WORKSHOP_META.tag,length,circuit,sample,halfWidthAt,
  laneLimitAt:(distance:number) => {const {edge,s}=locate(distance);return edge.laneLimitAt(s);},
  surfaceAt:(distance:number) => {const {edge,s}=locate(distance);return edge.surfaceAt(s);},
  sections:Object.freeze([
    Object.freeze({name:'Launch apron, helical spool and overhead bench',from:0,to:start.length}),
    Object.freeze({name:'Workbench Rim alternate',from:start.length,to:start.length+boulevard.length}),
    Object.freeze({name:'Graded drawer-terrace descent',from:start.length+boulevard.length,to:length}),
  ]),
  // Compatibility only. Fork gameplay retains explicit edge-local pickup support.
  pickups:Object.freeze([240,750,1030,start.length+200,start.length+boulevard.length+280,
    start.length+boulevard.length+530,
  ].flatMap(d => [-3.5,3.5].map(lateral => Object.freeze({d,lateral})))),
  clearAt(x:number,z:number,radius=0){
    return Number.isFinite(x+z+radius)&&clearance.every(({p,w}) => Math.hypot(p.x-x,p.z-z)>w+Math.max(0,radius)+3.5);
  },
});
