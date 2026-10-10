import {OpenRoad} from '../open-road';
import type {ClosedCircuit, CircuitPoint} from '../closed-circuit';
import type {LandTrack,LandSurface} from '../land-track';
import type {ForkCourse,RouteEdge,RouteEdgeId,CheckpointGate} from '../land-routes';
/** Original hillside-town control knots in metres. The common ring crosses itself
 * only at the masonry bridge; alternate streets occupy the northern terrace. */
const ORIGINAL_TOWN_POINTS = {
  start: [[-140,7,-180],[-115,6,-110],[-55,6,-65],[0,6,-30],[55,7,5],[115,13,35],[130,18,100]],
  alley: [[130,18,100],[123,19,140],[88,21,167],[55,22,145],[35,22.5,132],[-5,23,127],[-45,23.7,153],[-63,24,190],[-120,24,200],[-150,24,175],[-150,24,145],[-150,24,100]],
  boulevard: [[130,18,100],[137,19,145],[150,21,194],[117,24,246],[-5,26,264],[-120,25,250],[-147,24,215],[-150,24,175],[-150,24,145],[-150,24,100]],
  finish: [[-150,24,100],[-145,25,45],[-80,27,0],[0,27,-30],[100,23,-65],[170,16,-150],[100,10,-225],[-40,8,-235],[-140,7,-180]],
} satisfies Record<RouteEdgeId,readonly CircuitPoint[]>;
/** Horizontal block scale keeps a 1.5 km lap without flattening the 21 m bridge.
 * Mirror X so the alley uses positive lateral, matching the existing A/left control. */
export const TOWN_HORIZONTAL_SCALE = .85;
export const TOWN_POINTS = Object.freeze(Object.fromEntries(Object.entries(ORIGINAL_TOWN_POINTS).map(([id, points]) => [id, Object.freeze(points.map(([x,y,z]) => Object.freeze([-x*.85,y,z*.85] as const)))])) as unknown as Record<RouteEdgeId, readonly CircuitPoint[]>);
const split=[0,.025,1] as const, merge=[0,0,-1] as const, seam=[.35,-.015,1] as const;
const stone:LandSurface=Object.freeze({kind:'town-cobbles',grip:.98,rollingResistance:1.02});
const tram:LandSurface=Object.freeze({kind:'tram-paving',grip:1,rollingResistance:1});
const smooth=(x:number)=>{const u=Math.max(0,Math.min(1,x));return u*u*(3-2*u);};
function edge(id:RouteEdgeId,start:CircuitPoint,end:CircuitPoint):RouteEdge {
  const road=new OpenRoad(TOWN_POINTS[id],start,end);
  const halfWidthAt=(s:number)=> id==='alley' ? 4.7+5.3*(1-smooth(Math.min(s,road.length-s)/65)) : 10;
  return Object.freeze({id,length:road.length,sample:(s:number,lateral=0)=>road.sample(s,lateral),halfWidthAt,laneLimitAt:(s:number)=>halfWidthAt(s)-.65,surfaceAt:()=>id==='boulevard'?tram:stone});
}
const start=edge('start',seam,split),alley=edge('alley',split,merge),boulevard=edge('boulevard',split,merge),finish=edge('finish',merge,seam);
const edges=Object.freeze({start,alley,boulevard,finish});
const gate=(index:number,edgeId:RouteEdgeId,fraction:number):CheckpointGate=>Object.freeze({index,edgeId,s:edges[edgeId].length*fraction});
export const TOWN_COURSE:ForkCourse=Object.freeze({id:'town',presentation:Object.freeze({branchLabels:Object.freeze({alley:'灯巷捷径',boulevard:'电车大道'})}),edges,commonStart:start,commonFinish:finish,alternates:Object.freeze({alley,boulevard}),canonicalLength:start.length+boulevard.length+finish.length,gatesPerLap:8,sharedMergeLength:35,
  checkpointGates:Object.freeze([gate(0,'start',.32),gate(1,'start',.85),gate(2,'alley',1/3),gate(3,'alley',2/3),gate(2,'boulevard',1/3),gate(3,'boulevard',2/3),gate(4,'finish',.08),gate(5,'finish',.35),gate(6,'finish',.7),gate(7,'finish',1)])});
export const TOWN_ROAD_EDGES:readonly RouteEdge[]=Object.freeze(Object.values(edges));
/** Explicit scene metadata; decorative/scenery systems never infer a deck from XZ. */
export const TOWN_LANDMARKS=Object.freeze({split:{x:-110.5,y:18,z:85},merge:{x:127.5,y:24,z:85},crossing:{x:0,z:-25.5,lowerY:6,upperY:27},junctionClearance:100});
const length=TOWN_COURSE.canonicalLength;
const locate=(distance:number)=>{let d=((distance%length)+length)%length;for(const e of [start,boulevard,finish]){if(d<e.length)return {e,s:d};d-=e.length;}return {e:start,s:0};};
const sample=(distance:number,lateral=0)=>{const {e,s}=locate(distance);return {...e.sample(s,lateral),u:((distance%length)+length)%length/length};};
const halfWidthAt=(distance:number)=>{const {e,s}=locate(distance);return e.halfWidthAt(s);};
// LandTrack's historical circuit field is consumed only through sample/curvature
// by gameplay. This compatibility view samples the exact common/default ribbons.
const circuit={length,sample,curvature(distance:number,span=7){const a=sample(distance).t,b=sample(distance+span).t;return Math.atan2(a.z*b.x-a.x*b.z,a.x*b.x+a.z*b.z)/span;}} as unknown as ClosedCircuit;
const clearance=TOWN_ROAD_EDGES.flatMap(e=>Array.from({length:Math.ceil(e.length/3)+1},(_,i)=>{const s=Math.min(e.length,i*3);return {p:e.sample(s).p,w:e.halfWidthAt(s)};}));
export const TOWN_TRACK:LandTrack=Object.freeze({id:'town',label:'灯阶旧城环线',tag:'LANTERN TERRACE RALLY',length,circuit,sample,halfWidthAt,laneLimitAt:(s:number)=>halfWidthAt(s)-.65,
  surfaceAt(distance:number){const {e,s}=locate(distance);return e.surfaceAt(s);},
  sections:Object.freeze([{name:'Lower market and underpass',from:0,to:start.length},{name:'Tram Boulevard alternate',from:start.length,to:start.length+boulevard.length},{name:'Upper bridge and civic descent',from:start.length+boulevard.length,to:length}]),
  pickups:Object.freeze([.08,.19,.35,.47,.62,.79,.92].flatMap(d=>[-3.5,3.5].map(lateral=>({d:d*length,lateral})))),
  clearAt(x:number,z:number,radius=0){return Number.isFinite(x+z+radius)&&clearance.every(({p,w})=>Math.hypot(p.x-x,p.z-z)>w+Math.max(0,radius)+3.5);}});
