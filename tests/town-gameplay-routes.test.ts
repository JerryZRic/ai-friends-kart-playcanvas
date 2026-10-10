import test from 'node:test';
import assert from 'node:assert/strict';
import {TOWN_COURSE as course} from '../src/maps/town';
import {createLandRaceRoute} from '../src/land-race-route';
import {canonicalProgress,createCursor,createRouteProgress,advanceCursor,type LandCursor} from '../src/land-routes';
import {landRailScrape,stepLandSpeed} from '../src/land-driving';
import {safeLandCamera} from '../src/land-camera';
import {collectPickups,activateItem,type Combatant,type RacingPickup} from '../src/npc-tactics';
const actor=(id:string):Combatant=>({id,total:0,lateral:0,speed:30,held:null,boost:0,shield:0,slow:0});
const locate=(id:'alley'|'boulevard'|'start'|'finish',s:number,lateral=0):LandCursor=>({...createCursor(lateral),edgeId:id,s,choiceByLap:id==='alley'||id==='boulevard'?{0:id}:{}});
const place=(runtime:ReturnType<typeof createLandRaceRoute>,id:string,c:LandCursor)=>runtime.states.set(id,createRouteProgress(c));

test('physical route view and five-second travel never scale by canonical branch length',()=>{
  const runtime=createLandRaceRoute(course,987);
  for(const branch of ['alley','boulevard'] as const){runtime.init(branch);place(runtime,branch,locate(branch,20));const before=runtime.cursor(branch).s;
    for(let n=0;n<300;n++)assert.ok(runtime.advance(branch,30/60,1/60,0,branch).accepted);
    assert.ok(Math.abs(runtime.cursor(branch).s-before-150)<1e-6);
    const view=runtime.view(branch,500);assert.ok(view.sample(507).p.distance(course.edges[branch].sample(before+157).p)<1e-6);
  }
  assert.notEqual(runtime.total('alley'),runtime.total('boulevard'));
});
test('existing left/right steering chooses actual fork, neutral defaults boulevard, ledger survives reverse',()=>{
 const runtime=createLandRaceRoute(course,1);runtime.init('p');place(runtime,'p',locate('start',course.commonStart.length-1,2));
 assert.equal(runtime.playerChoice('p',0),'boulevard');assert.equal(runtime.playerChoice('p',-1),'alley');
 runtime.advance('p',2,.1,2,runtime.playerChoice('p',-1));assert.equal(runtime.cursor('p').edgeId,'alley');
 runtime.advance('p',-3,.1,2,'boulevard');runtime.advance('p',3,.1,-2,'boulevard');assert.equal(runtime.cursor('p').edgeId,'alley');
 runtime.reset();runtime.init('p');place(runtime,'p',locate('start',course.commonStart.length-1,-2));assert.equal(runtime.playerChoice('p',1),'boulevard');
});
test('NPC fork hashes are order independent and use both branches without consuming item RNG',()=>{
 const a=createLandRaceRoute(course,72),b=createLandRaceRoute(course,72),ids=['whale','cat','duck','rabbit','panda','fox'];
 for(const id of ids)a.init(id);for(const id of [...ids].reverse())b.init(id);
 const choices=ids.map(id=>a.npcChoice(id));assert.deepEqual(choices,ids.map(id=>b.npcChoice(id)));assert.equal(new Set(choices).size,2);
});
test('opposite branches cannot pulse, bump or collect boxes at equal canonical progress',()=>{
 const runtime=createLandRaceRoute(course,2),a=actor('a'),b=actor('b');runtime.init('a');runtime.init('b');
 place(runtime,'a',locate('alley',course.edges.alley.length*.5));place(runtime,'b',locate('boulevard',course.edges.boulevard.length*.5));
 a.total=runtime.total('a');b.total=runtime.total('b');assert.ok(Math.abs(a.total-b.total)<1e-8);assert.equal(runtime.interactions.gap!(a,b),null);assert.equal(runtime.collides(a,b),false);
 a.held='pulse';assert.equal(activateItem(a,[a,b],course.canonicalLength,runtime.interactions)?.target,undefined);assert.equal(b.slow,0);
 const box={edgeId:'boulevard',s:runtime.cursor('b').s,d:b.total,lateral:0,cool:0,display:'mystery',mesh:{enabled:true}} as RacingPickup;
 const previous=a.total;runtime.advance('a',1,1/30,0,'alley');a.total=runtime.total('a');a.held=null;
 collectPickups([{actor:a,previous,previousLane:0}],[box],course.canonicalLength,()=>.2,runtime.contact);assert.equal(a.held,null);
});
test('route swept pickups retain global contact fractions across edge transitions and ID tie order',()=>{
 const runtime=createLandRaceRoute(course,2),a=actor('z'),b=actor('a');for(const r of [a,b]){runtime.init(r.id);place(runtime,r.id,locate('start',course.commonStart.length-1,2));r.lateral=2;}
 const previous=runtime.total('z');for(const r of [a,b]){runtime.advance(r.id,3,.1,2,'alley');r.total=runtime.total(r.id);}
 const box={edgeId:'alley',s:1,d:course.commonStart.length+1,lateral:2,cool:0,display:'mystery',mesh:{enabled:true}} as RacingPickup;
 collectPickups([a,b].map(actor=>({actor,previous,previousLane:2})),[box],course.canonicalLength,()=>.2,runtime.contact);
 assert.ok(b.held);assert.equal(a.held,null);
});
test('rail contact loss is bounded, equal for both actors and absent on clean support',()=>{
 assert.equal(landRailScrape(30,2,4,1/60).speed,30);const contact=landRailScrape(30,4.4,4,1/60);assert.ok(contact.contact);assert.ok(contact.speed<30&&contact.speed>29.8);assert.equal(contact.lateral,4);assert.deepEqual(contact,landRailScrape(30,4.4,4,1/60));
});
test('camera safety clips both desired and smoothed boom and preserves unobstructed pose',()=>{
 const anchor={x:0,y:6,z:0},desired={x:0,y:15,z:-10},box={min:[-5,10,-8],max:[5,12,-2]};
 const safe=safeLandCamera(anchor,desired,[box]);assert.ok(safe.y<10);assert.deepEqual(safeLandCamera(anchor,desired,[]),desired);
 const interpolated={x:0,y:11,z:-6};assert.ok(safeLandCamera(anchor,interpolated,[box]).y<10);
});
test('dynamic full corridor rejects fork, merge, branches and upper/lower crossing',()=>{
 const runtime=createLandRaceRoute(course,7);runtime.init('p');const from=course.commonStart.length-65;place(runtime,'p',locate('start',from));assert.equal(runtime.eligible(from,from+100,'p'),false);
 place(runtime,'p',locate('alley',80));assert.equal(runtime.eligible(runtime.total('p'),runtime.total('p')+60,'p'),false);
});
