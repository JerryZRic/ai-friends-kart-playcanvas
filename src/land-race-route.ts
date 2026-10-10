import {advanceCursor,advanceRouteProgress,canonicalProgress,createCursor,createRouteProgress,routeGap,sampleAhead,sampleCursor,type BranchId,type ForkCourse,type LandCursor,type RouteAdvance,type RouteProgress} from './land-routes';
import type {LandDrivingTrack} from './land-driving';
import type {Combatant,PickupRacer,RacingPickup,RouteInteractions} from './npc-tactics';

/** A private physical cursor per actor. Canonical totals are output for ranking,
 * never input to driving, interactions, visual support or checkpoint awards. */
export function createLandRaceRoute(course:ForkCourse,seed:number) {
  const states=new Map<string,RouteProgress>();
  const motions=new Map<string,{advance:RouteAdvance;requestedMetres:number;previousLane:number;nextLane:number}>();
  const intents=new Map<string,{lap:number;choice:BranchId}>();
  const get=(id:string)=>states.get(id)!;
  const cursor=(id:string)=>get(id).cursor;
  const setLane=(id:string,lateral:number)=>{const state=get(id);states.set(id,{...state,cursor:{...state.cursor,lateral}});};
  const init=(id:string,distance=0,lateral=0)=>{states.set(id,createRouteProgress(advanceCursor(course,createCursor(lateral),distance).cursor));motions.delete(id);intents.delete(id);};
  const reset=()=>{states.clear();motions.clear();intents.clear();};
  const choice=(id:string):BranchId=>cursor(id).choiceByLap[cursor(id).lap]??(intents.get(id)?.lap===cursor(id).lap?intents.get(id)!.choice:'boulevard');
  const view=(id:string,reference=0):LandDrivingTrack=>({
    sample:(d,lateral=0)=>{const c=advanceCursor(course,cursor(id),d-reference,choice(id)).cursor;return sampleCursor(course,c,lateral);},
    surfaceAt:(d)=>{const c=advanceCursor(course,cursor(id),d-reference,choice(id)).cursor;return course.edges[c.edgeId].surfaceAt(c.s);},
  });
  const limit=(id:string,ahead=0,margin=.65)=>{const c=advanceCursor(course,cursor(id),ahead,choice(id)).cursor;return course.edges[c.edgeId].halfWidthAt(c.s)-margin;};
  const nearFork=(id:string)=>cursor(id).edgeId==='start'&&course.commonStart.length-cursor(id).s<80;
  const playerChoice=(id:string,steer:number,lateral=cursor(id).lateral)=>{
    if(nearFork(id)&&steer!==0)intents.set(id,{lap:cursor(id).lap,choice:steer<0?'alley':'boulevard'});
    // Neutral input has no implicit lane assignment; default remains boulevard.
    return choice(id)==='alley'&&lateral>.35?'alley':'boulevard';
  };
  const npcChoice=(id:string)=>{
    const c=cursor(id),chosen=c.choiceByLap[c.lap];if(chosen)return chosen;
    // Stable per-course decisions do not consume the item RNG. For town this
    // remains byte-for-byte the original seed/id/lap/town-fork hash input.
    const key=`${seed}:${id}:${c.lap}:${course.id}-fork`;let hash=2166136261;
    for(const char of key)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
    const selected:BranchId=hash/4294967296<.45?'alley':'boulevard';intents.set(id,{lap:c.lap,choice:selected});return selected;
  };
  const advance=(id:string,metres:number,dt:number,lateral:number,selected:BranchId,maxSpeed=85)=>{
    const old=get(id),previousLane=old.cursor.lateral;
    const result=advanceRouteProgress(course,{...old,cursor:{...old.cursor,lateral}},metres,dt,selected,maxSpeed);
    if(result.accepted){states.set(id,result.state);if(result.advance)motions.set(id,{advance:result.advance,requestedMetres:metres,previousLane,nextLane:lateral});else motions.delete(id);}
    else motions.delete(id);
    return {...result,total:canonicalProgress(course,cursor(id))};
  };
  const truncateFrame=(id:string,prior:RouteProgress,dt:number,fraction:number)=>{
    const motion=motions.get(id),part=Math.max(0,Math.min(1,fraction));
    if(!motion||part===0){states.set(id,prior);return prior;}
    const lateral=motion.previousLane+(motion.nextLane-motion.previousLane)*part;
    const result=advanceRouteProgress(course,{...prior,cursor:{...prior.cursor,lateral}},motion.requestedMetres*part,dt*part,choice(id));
    states.set(id,result.state);return result.state;
  };
  const boxCursor=(box:Pick<RacingPickup,'d'|'lateral'> & Partial<Pick<RacingPickup,'edgeId'|'s'>>):LandCursor=>{
    if(box.edgeId&&box.edgeId in course.edges&&Number.isFinite(box.s))return {...createCursor(box.lateral),edgeId:box.edgeId as LandCursor['edgeId'],s:box.s!};
    return advanceCursor(course,createCursor(box.lateral),box.d).cursor;
  };
  const gap=(a:Combatant,b:Combatant)=>routeGap(course,cursor(a.id),cursor(b.id));
  const interactions:RouteInteractions={gap,pickupGap:(a,b)=>routeGap(course,cursor(a.id),boxCursor(b))};
  const contact=(racer:PickupRacer,box:RacingPickup):number|null=>{
    const motion=motions.get(racer.actor.id);if(!motion)return null;
    const target=boxCursor(box),travel=Math.abs(motion.requestedMetres);let earliest=Infinity;
    if(travel<1e-9){
      const at=cursor(racer.actor.id);if(at.edgeId!==target.edgeId||Math.abs(at.s-target.s)>1.8)return null;
      const start=motion.previousLane,delta=motion.nextLane-start,lo=box.lateral-1.25,hi=box.lateral+1.25;
      if(Math.abs(delta)<1e-9)return start>=lo&&start<=hi?0:null;
      const a=(lo-start)/delta,b=(hi-start)/delta,enter=Math.max(0,Math.min(a,b)),leave=Math.min(1,Math.max(a,b));return enter<=leave?enter:null;
    }
    for(const sweep of motion.advance.sweeps){
      if(sweep.edgeId!==target.edgeId)continue;
      const length=Math.abs(sweep.to-sweep.from),base=travel>1e-9?sweep.travelBefore/travel:0,span=travel>1e-9?length/travel:1;
      let enter=0,leave=1;
      const startLane=motion.previousLane+(motion.nextLane-motion.previousLane)*base;
      const laneDelta=(motion.nextLane-motion.previousLane)*span;
      for(const [start,delta,low,high] of [[sweep.from,sweep.to-sweep.from,target.s-1.8,target.s+1.8],[startLane,laneDelta,box.lateral-1.25,box.lateral+1.25]]){
        if(Math.abs(delta)<1e-9){if(start<low||start>high){enter=2;break;}}
        else {const a=(low-start)/delta,b=(high-start)/delta;enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));}
      }
      if(enter<=leave&&enter<=1&&leave>=0)earliest=Math.min(earliest,base+span*enter);
    }
    return Number.isFinite(earliest)?earliest:null;
  };
  const collides=(a:Combatant,b:Combatant)=>{
    const first=sampleCursor(course,cursor(a.id),a.lateral).p,second=sampleCursor(course,cursor(b.id),b.lateral).p;
    if(first.distance(second)>3.4||Math.abs(first.y-second.y)>1.8)return false;
    const distance=gap(a,b);
    // Alternate throats may overlap geometrically just before the legal merge.
    return (distance!==null&&Math.abs(distance)<2.9&&Math.abs(a.lateral-b.lateral)<1.85)||distance===null&&first.distance(second)<2.2;
  };
  /** Candidate and full reaction corridor must stay on common road, clear of
   * junction throats and both bridge decks. Conservative rejection is deliberate. */
  const eligible=(from:number,to:number,id:string)=>{
    const c=cursor(id);if(c.edgeId==='alley'||c.edgeId==='boulevard')return false;
    for(let d=from;d<=to+6;d+=6){
      const q=((d%course.canonicalLength)+course.canonicalLength)%course.canonicalLength;
      const at=advanceCursor(course,createCursor(),q).cursor;
      if(at.edgeId!=='start'&&at.edgeId!=='finish')return false;
      if(at.edgeId==='start'&&course.commonStart.length-at.s<55||at.edgeId==='finish'&&at.s<55)return false;
      const p=sampleCursor(course,at).p;
      // Detect crossing footprints from distinct road positions; source-derived,
      // not a guessed canonical exclusion that would miss the lower deck.
      for(const edge of Object.values(course.edges))for(let s=0;s<=edge.length;s+=12){
        if(edge.id===at.edgeId&&Math.abs(s-at.s)<45)continue;
        const other=edge.sample(s).p;
        if(Math.hypot(p.x-other.x,p.z-other.z)<28&&Math.abs(p.y-other.y)>5)return false;
      }
    }
    return true;
  };
  return {course,states,motions,init,reset,get,cursor,setLane,choice,view,limit,nearFork,playerChoice,npcChoice,advance,truncateFrame,interactions,contact,collides,eligible,
    sample:(id:string,lateral=cursor(id).lateral)=>sampleCursor(course,cursor(id),lateral),
    sampleAhead:(id:string,metres:number)=>sampleAhead(course,cursor(id),metres,choice(id)),
    total:(id:string)=>canonicalProgress(course,cursor(id)),boxCursor,
    gapToDistance:(id:string,d:number)=>routeGap(course,cursor(id),boxCursor({d,lateral:0})),
    pickupPosition:(box:Pick<RacingPickup,'d'|'lateral'>)=>sampleCursor(course,boxCursor(box),box.lateral).p};
}
