import type {LandSample, LandSurface} from './land-track';
export type BranchId = 'alley' | 'boulevard';
export type RouteEdgeId = 'start' | BranchId | 'finish';
export interface RouteEdge {
  readonly id: RouteEdgeId; readonly length: number;
  sample(s: number,lateral?:number): LandSample;
  halfWidthAt(s:number):number; laneLimitAt(s:number):number; surfaceAt(s:number):LandSurface;
}
export type CheckpointGate = Readonly<{index:number;edgeId:RouteEdgeId;s:number}>;
export interface ForkCourse {
  readonly presentation?:Readonly<{branchLabels:Readonly<Record<BranchId,string>>}>;
  readonly id:string; readonly edges:Readonly<Record<RouteEdgeId,RouteEdge>>;
  readonly commonStart:RouteEdge; readonly commonFinish:RouteEdge;
  readonly alternates:Readonly<Record<BranchId,RouteEdge>>;
  readonly canonicalLength:number; readonly checkpointGates:readonly CheckpointGate[];
  readonly gatesPerLap:number;
  /** Authored physical overlap before the merge, never canonical progress.
   * Cross-branch interactions still certify both local support frames. */
  readonly sharedMergeLength?:number;
}
/** Ledger covers starting lap (-1) and all three race laps, never unbounded history. */
export type LandCursor = Readonly<{lap:number;edgeId:RouteEdgeId;s:number;lateral:number;choiceByLap:Readonly<Partial<Record<number,BranchId>>>}>;
export type RouteSweep = Readonly<{lap:number;edgeId:RouteEdgeId;from:number;to:number;lateral:number;travelBefore:number}>;
export type RouteAdvance = Readonly<{cursor:LandCursor;sweeps:readonly RouteSweep[];physicalTravel:number;canonicalBefore:number;canonicalAfter:number}>;
const branch = (c:LandCursor):BranchId => c.choiceByLap[c.lap] ?? 'boulevard';
export function createCursor(lateral=0):LandCursor { return Object.freeze({lap:0,edgeId:'start',s:0,lateral,choiceByLap:Object.freeze({})}); }
export function canonicalProgress(course:ForkCourse,c:LandCursor):number {
  const offset=c.edgeId==='start'?c.s:c.edgeId==='finish'?course.commonStart.length+course.alternates.boulevard.length+c.s:course.commonStart.length+c.s/course.edges[c.edgeId].length*course.alternates.boulevard.length;
  return c.lap*course.canonicalLength+offset;
}
function frozen(c:LandCursor):LandCursor {return Object.freeze({...c,choiceByLap:Object.freeze({...c.choiceByLap})});}
export function advanceCursor(course:ForkCourse,cursor:LandCursor,signedMetres:number,choice:BranchId='boulevard'):RouteAdvance {
  if(!Number.isFinite(signedMetres) || Math.abs(signedMetres)>course.canonicalLength*4) throw new Error('Invalid physical route travel');
  let c={...cursor,choiceByLap:{...cursor.choiceByLap}}, remaining=Math.abs(signedMetres), travelled=0; const direction=Math.sign(signedMetres), sweeps:RouteSweep[]=[];
  for(let iteration=0;remaining>1e-9 && iteration<40;iteration++) {
    const edge=course.edges[c.edgeId], available=direction>0?edge.length-c.s:c.s, take=Math.min(remaining,Math.max(0,available));
    if(take>0) {const to=c.s+direction*take; sweeps.push(Object.freeze({lap:c.lap,edgeId:c.edgeId,from:c.s,to,lateral:c.lateral,travelBefore:travelled}));c.s=to;remaining-=take;travelled+=take;}
    if(remaining<=1e-9 && available>take+1e-9)break;
    if(direction>0 && c.s>=edge.length-1e-9) {
      if(c.edgeId==='start') {const selected=c.choiceByLap[c.lap]??choice;if(c.lap>=-1&&c.lap<=2)c.choiceByLap[c.lap]=selected;c.edgeId=selected;}
      else if(c.edgeId==='finish'){c.lap++;c.edgeId='start';}
      else c.edgeId='finish'; c.s=0;
    } else if(direction<0&&c.s<=1e-9) {
      if(c.edgeId==='start'){c.lap--;c.edgeId='finish';}
      else if(c.edgeId==='finish'){const selected=branch(c);if(c.lap>=-1&&c.lap<=2)c.choiceByLap[c.lap]=selected;c.edgeId=selected;}
      else c.edgeId='start';c.s=course.edges[c.edgeId].length;
    }
  }
  const result=frozen(c);return Object.freeze({cursor:result,sweeps:Object.freeze(sweeps),physicalTravel:direction*travelled,canonicalBefore:canonicalProgress(course,cursor),canonicalAfter:canonicalProgress(course,result)});
}
export function sampleCursor(course:ForkCourse,c:LandCursor,lateral=c.lateral):LandSample {return course.edges[c.edgeId].sample(c.s,lateral);}
export function sampleAhead(course:ForkCourse,c:LandCursor,physicalMetres:number,choice:BranchId=branch(c)):LandSample{return sampleCursor(course,advanceCursor(course,c,physicalMetres,choice).cursor);}
export function resetCursor(course:ForkCourse,safe:LandCursor):LandCursor { const e=course.edges[safe.edgeId];return frozen({...safe,s:Math.max(0,Math.min(e.length,safe.s)),lateral:0}); }
/** Signed nearest physical ring gap. Different alternate interiors cannot
 * interact until at least one actor reaches an authored, source-identical
 * shared merge throat reachable by the other's own physical route. */
export function routeGap(course:ForkCourse,a:LandCursor,b:LandCursor):number|null {
  const isBranch=(id:RouteEdgeId)=>id==='alley'||id==='boulevard';
  if(isBranch(a.edgeId)&&isBranch(b.edgeId)&&a.edgeId!==b.edgeId){
    const first=course.edges[a.edgeId],second=course.edges[b.edgeId],shared=course.sharedMergeLength;
    const remainingA=first.length-a.s,remainingB=second.length-b.s;
    if(typeof shared!=='number'||!Number.isFinite(shared)||shared<=0||shared>Math.min(first.length,second.length)
      ||!Number.isFinite(remainingA)||remainingA<0||remainingA>first.length
      ||!Number.isFinite(remainingB)||remainingB<0||remainingB>second.length)return null;
    const inThroat=(remaining:number)=>remaining<=shared;
    if(!inThroat(remainingA)&&!inThroat(remainingB))return null;
    const agrees=(x:{x:number;y:number;z:number},y:{x:number;y:number;z:number},tolerance:number)=>
      [x.x,x.y,x.z,y.x,y.y,y.z].every(Number.isFinite)&&Math.hypot(x.x-y.x,x.y-y.y,x.z-y.z)<=tolerance;
    // Only a certified common-pavement cursor is mapped to the alternate.
    // An approaching racer keeps its own physical path to that shared point.
    for(const remaining of [remainingA,remainingB].filter(inThroat)){
      const x=first.sample(first.length-remaining),y=second.sample(second.length-remaining);
      if(!agrees(x.p,y.p,.001)||!agrees(x.t,y.t,.00001)||!agrees(x.n,y.n,.00001)||!agrees(x.normal,y.normal,.00001))return null;
    }
    return remainingA-remainingB;
  }
  const chosen:BranchId=isBranch(a.edgeId)?a.edgeId as BranchId:isBranch(b.edgeId)?b.edgeId as BranchId:branch(a);
  const length=course.commonStart.length+course.alternates[chosen].length+course.commonFinish.length;
  const position=(c:LandCursor)=>c.edgeId==='start'?c.s:c.edgeId==='finish'?course.commonStart.length+course.alternates[chosen].length+c.s:course.commonStart.length+c.s;
  let gap=position(b)-position(a);if(gap>length/2)gap-=length;if(gap< -length/2)gap+=length;return gap;
}
export type RouteProgress = Readonly<{cursor:LandCursor;nextGate:number;laps:number;finished:boolean}>;
export function createRouteProgress(cursor=createCursor()):RouteProgress {return {cursor,nextGate:0,laps:0,finished:false};}
/** Consume only freshly integrated legal physical sweeps; no scalar rebasing can
 * award a gate. Bounds apply to physical metres, never scaled ranking progress. */
export function advanceRouteProgress(course:ForkCourse,state:RouteProgress,metres:number,dt:number,choice:BranchId='boulevard',maxSpeed=85):{accepted:boolean;state:RouteProgress;advance?:RouteAdvance;finishFraction?:number;reason?:string} {
  if(![metres,dt,maxSpeed,state.cursor.lateral].every(Number.isFinite)||dt<=0||dt>.25||maxSpeed<=0)return {accepted:false,state,reason:'invalid-step'};
  if(Math.abs(metres)>maxSpeed*dt+.03)return {accepted:false,state,reason:'teleport'};
  if(!course.edges[state.cursor.edgeId] || !Number.isFinite(state.cursor.s) || !Number.isInteger(state.cursor.lap) || state.cursor.s<0 || state.cursor.s>course.edges[state.cursor.edgeId].length) return {accepted:false,state,reason:'invalid-cursor'};
  if(state.finished)return {accepted:true,state};
  const advance=advanceCursor(course,state.cursor,metres,choice);let nextGate=state.nextGate,laps=state.laps,finishFraction:number|undefined;
  for(const sweep of advance.sweeps) {
    if(sweep.to<=sweep.from)continue;
    const expectedLap=Math.floor(nextGate/course.gatesPerLap);
    if(sweep.lap!==expectedLap)continue;
    // Several gates in one physical sweep remain ordered.
    for(const gate of course.checkpointGates.filter(g=>g.edgeId===sweep.edgeId).sort((a,b)=>a.s-b.s)) {
      if(gate.index!==nextGate%course.gatesPerLap || Math.floor(nextGate/course.gatesPerLap)!==sweep.lap)continue;
      if(sweep.from<gate.s && sweep.to>=gate.s && Math.abs(sweep.lateral)<=course.edges[sweep.edgeId].laneLimitAt(gate.s)+.01) {
        nextGate++;if(nextGate%course.gatesPerLap===0){laps++;if(laps===3)finishFraction=(sweep.travelBefore+gate.s-sweep.from)/Math.max(1e-9,Math.abs(metres));}
      }
    }
  }
  const completedAdvance=finishFraction===undefined?advance:advanceCursor(course,state.cursor,metres*finishFraction,choice);
  return {accepted:true,state:{cursor:completedAdvance.cursor,nextGate,laps,finished:laps>=3},advance:completedAdvance,finishFraction};
}
export function rebaseRouteProgress(state:RouteProgress,safe:LandCursor):RouteProgress {
  const chosen=state.cursor.choiceByLap[safe.lap];
  if(chosen && (safe.edgeId==='alley'||safe.edgeId==='boulevard') && safe.edgeId!==chosen)return state;
  return {...state,cursor:frozen({...safe,choiceByLap:{...safe.choiceByLap,...state.cursor.choiceByLap}})};
}
