import test from 'node:test';
import assert from 'node:assert/strict';
import {LAND_SIMULATION_MAPS,loadLandSimulationCourse} from '../src/land-simulation-course';
import {createLandRaceRoute} from '../src/land-race-route';
import {createCursor,createRouteProgress,type RouteEdgeId} from '../src/land-routes';
import type {Combatant} from '../src/npc-tactics';
test('collision broad phase exactly matches the published physical-first predicate on every fork map',async()=>{
 let cases=0;
 for(const map of LAND_SIMULATION_MAPS){const loaded=await loadLandSimulationCourse(map);if(!loaded.routes)continue;const course=loaded.routes,routes=createLandRaceRoute(course,72);
  const actor=(id:string,lateral:number):Combatant=>({id,total:0,lateral,speed:30,held:null,boost:0,shield:0,slow:0});
  const positions=(edge:RouteEdgeId)=>[0,.1,course.edges[edge].length*.4,course.edges[edge].length-12,course.edges[edge].length-.1];
  for(const first of ['start','alley','boulevard','finish'] as RouteEdgeId[])for(const second of ['start','alley','boulevard','finish'] as RouteEdgeId[])for(const from of positions(first))for(const offset of [-5,-2.899,-.1,0,2.899,5])for(const lane of [-2,0,2]){
   const s=Math.max(0,Math.min(course.edges[second].length,first===second?from+offset:course.edges[second].length-(course.edges[first].length-from)+offset));
   routes.states.set('a',createRouteProgress({...createCursor(0),edgeId:first,s:from}));routes.states.set('b',createRouteProgress({...createCursor(lane),edgeId:second,s}));
   const a=actor('a',0),b=actor('b',lane),p=routes.sample('a',a.lateral).p,q=routes.sample('b',b.lateral).p,gap=routes.interactions.gap!(a,b);
   const old=p.distance(q)>3.4||Math.abs(p.y-q.y)>1.8?false:(gap!==null&&Math.abs(gap)<2.9&&Math.abs(a.lateral-b.lateral)<1.85)||gap===null&&p.distance(q)<2.2;
   assert.equal(routes.collides(a,b),old,`${map}/${first}/${second}/${from}/${s}/${lane}`);cases++;
  }
 }
 assert.equal(cases,14400);
});
