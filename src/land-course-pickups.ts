import {canonicalProgress,createCursor,type ForkCourse,type RouteEdgeId} from './land-routes';

export type RoutePickupRow=Readonly<{edgeId:RouteEdgeId;s:number;lanes:readonly number[]}>;
/** Physical coordinates are authoritative. d is a ranking/minimap compatibility
 * value and must never be used to position a branch box. */
export function routePickupRows(course:ForkCourse,rows:readonly RoutePickupRow[]) {
  return rows.flatMap(({edgeId,s,lanes})=>lanes.map(lateral=>{
    const edge=course.edges[edgeId];
    if(!Number.isFinite(s+lateral)||s<0||s>edge.length||Math.abs(lateral)>edge.halfWidthAt(s)-1.1)throw new RangeError(`Unsupported ${course.id} pickup ${edgeId}:${s}/${lateral}`);
    const cursor={...createCursor(lateral),edgeId,s};
    return {edgeId,s,lateral,d:canonicalProgress(course,cursor),p:edge.sample(s,lateral).p};
  }));
}
export function townPickupRows(course:ForkCourse) {
  return routePickupRows(course,([['start',.15],['alley',.43],['boulevard',.32],['boulevard',.61],['finish',.56],['finish',.83]] as const)
    .map(([edgeId,fraction])=>({edgeId,s:course.edges[edgeId].length*fraction,lanes:[-2.4,2.4]})));
}
/** Fixed positions are initially visible and retain the shared pickup respawn.
 * Shelf s=160 is the gentle, nearly level reversal pocket, not its tight bend.
 * Both branch rows are >50m after split and >135m before merge; the common
 * rows avoid both levels of the dry-cut crossing. Dynamic rows separately
 * certify the full physical reaction corridor in createLandRaceRoute. */
export const QUARRY_PICKUP_ROWS:readonly RoutePickupRow[]=Object.freeze([
  {edgeId:'start',s:230,lanes:[-3.5,3.5]},
  {edgeId:'start',s:450,lanes:[-3.5,3.5]},
  {edgeId:'alley',s:160,lanes:[-2.2,2.2]},
  {edgeId:'boulevard',s:230,lanes:[-3.5,3.5]},
  {edgeId:'finish',s:180,lanes:[-3.5,3.5]},
  {edgeId:'finish',s:840,lanes:[-3.5,3.5]},
  {edgeId:'finish',s:1040,lanes:[-3.5,3.5]},
].map(row=>Object.freeze({...row,lanes:Object.freeze(row.lanes)})) as RoutePickupRow[]);
export const quarryPickupRows=(course:ForkCourse)=>routePickupRows(course,QUARRY_PICKUP_ROWS);
