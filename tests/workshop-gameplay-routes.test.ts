import test from 'node:test';
import assert from 'node:assert/strict';
import {WORKSHOP_COURSE as course,WORKSHOP_TRACK as track,WORKSHOP_LANDMARKS} from '../src/maps/workshop';
import {TOWN_COURSE} from '../src/maps/town';
import {QUARRY_COURSE} from '../src/maps/quarry';
import {WORKSHOP_PICKUP_ROWS,workshopPickupRows} from '../src/land-course-pickups';
import {createDynamicPickupDirector,type DynamicPickupTrack} from '../src/dynamic-pickups';
import {createLandRaceRoute} from '../src/land-race-route';
import {canonicalProgress,createCursor,createRouteProgress,advanceCursor,resetCursor,sampleCursor,type LandCursor} from '../src/land-routes';
import {landRailScrape,stepLandSpeed,landSteeringGrip,landBankDrift} from '../src/land-driving';
import {safeLandCamera} from '../src/land-camera';
import {collectPickups,activateItem,pulseTarget,planLane,type Combatant,type RacingPickup} from '../src/npc-tactics';
import {npcSkill} from '../src/npc-difficulty';
import {createRaceKartTuning,raceKartBuild} from '../src/kart-race';
import {claimPickup,advancePickup,PICKUP_RESPAWN_SECONDS} from '../src/item-pickups';
const actor=(id:string):Combatant=>({id,total:0,lateral:0,speed:30,held:null,boost:0,shield:0,slow:0});
const locate=(id:'alley'|'boulevard'|'start'|'finish',s:number,lateral=0):LandCursor=>({...createCursor(lateral),edgeId:id,s,choiceByLap:id==='alley'||id==='boulevard'?{0:id}:{}});
const place=(runtime:ReturnType<typeof createLandRaceRoute>,id:string,c:LandCursor)=>runtime.states.set(id,createRouteProgress(c));

test('workshop: physical route view and five-second travel never scale by canonical branch length',()=>{
  const runtime=createLandRaceRoute(course,987);
  for(const branch of ['alley','boulevard'] as const){runtime.init(branch);place(runtime,branch,locate(branch,20));const before=runtime.cursor(branch).s;
    for(let n=0;n<300;n++)assert.ok(runtime.advance(branch,30/60,1/60,0,branch).accepted);
    assert.ok(Math.abs(runtime.cursor(branch).s-before-150)<1e-6);
    const view=runtime.view(branch,500);assert.ok(view.sample(507).p.distance(course.edges[branch].sample(before+157).p)<1e-6);
  }
  assert.notEqual(runtime.total('alley'),runtime.total('boulevard'));
});
test('workshop: existing left/right steering chooses actual fork, neutral defaults boulevard, ledger survives reverse',()=>{
 const runtime=createLandRaceRoute(course,1);runtime.init('p');place(runtime,'p',locate('start',course.commonStart.length-1,2));
 assert.equal(runtime.playerChoice('p',0),'boulevard');assert.equal(runtime.playerChoice('p',-1),'alley');
 runtime.advance('p',2,.1,2,runtime.playerChoice('p',-1));assert.equal(runtime.cursor('p').edgeId,'alley');
 runtime.advance('p',-3,.1,2,'boulevard');runtime.advance('p',3,.1,-2,'boulevard');assert.equal(runtime.cursor('p').edgeId,'alley');
 runtime.reset();runtime.init('p');place(runtime,'p',locate('start',course.commonStart.length-1,-2));assert.equal(runtime.playerChoice('p',1),'boulevard');
});
test('workshop: NPC fork hashes are order independent and use both branches without consuming item RNG',()=>{
 const a=createLandRaceRoute(course,72),b=createLandRaceRoute(course,72),ids=['whale','gemini','gpt','claude','grok','glm'];
 for(const id of ids)a.init(id);for(const id of [...ids].reverse())b.init(id);
 const choices=ids.map(id=>a.npcChoice(id));assert.deepEqual(choices,ids.map(id=>b.npcChoice(id)));assert.equal(new Set(choices).size,2);
});
test('workshop: opposite branches cannot pulse, bump or collect boxes at equal canonical progress',()=>{
 const runtime=createLandRaceRoute(course,2),a=actor('a'),b=actor('b');runtime.init('a');runtime.init('b');
 place(runtime,'a',locate('alley',course.edges.alley.length*.5));place(runtime,'b',locate('boulevard',course.edges.boulevard.length*.5));
 a.total=runtime.total('a');b.total=runtime.total('b');assert.ok(Math.abs(a.total-b.total)<1e-8);assert.equal(runtime.interactions.gap!(a,b),null);assert.equal(runtime.collides(a,b),false);
 a.held='pulse';assert.equal(activateItem(a,[a,b],course.canonicalLength,runtime.interactions)?.target,undefined);assert.equal(b.slow,0);
 const box={edgeId:'boulevard',s:runtime.cursor('b').s,d:b.total,lateral:0,cool:0,display:'mystery',mesh:{enabled:true}} as RacingPickup;
 const previous=a.total;runtime.advance('a',1,1/30,0,'alley');a.total=runtime.total('a');a.held=null;
 collectPickups([{actor:a,previous,previousLane:0}],[box],course.canonicalLength,()=>.2,runtime.contact);assert.equal(a.held,null);
});
test('workshop: route swept pickups retain global contact fractions across edge transitions and ID tie order',()=>{
 const runtime=createLandRaceRoute(course,2),a=actor('z'),b=actor('a');for(const r of [a,b]){runtime.init(r.id);place(runtime,r.id,locate('start',course.commonStart.length-1,2));r.lateral=2;}
 const previous=runtime.total('z');for(const r of [a,b]){runtime.advance(r.id,3,.1,2,'alley');r.total=runtime.total(r.id);}
 const box={edgeId:'alley',s:1,d:course.commonStart.length+1,lateral:2,cool:0,display:'mystery',mesh:{enabled:true}} as RacingPickup;
 collectPickups([a,b].map(actor=>({actor,previous,previousLane:2})),[box],course.canonicalLength,()=>.2,runtime.contact);
 assert.ok(b.held);assert.equal(a.held,null);
});
test('workshop: rail contact loss is bounded, equal for both actors and absent on clean support',()=>{
 assert.equal(landRailScrape(30,2,4,1/60).speed,30);const contact=landRailScrape(30,4.4,4,1/60);assert.ok(contact.contact);assert.ok(contact.speed<30&&contact.speed>29.8);assert.equal(contact.lateral,4);assert.deepEqual(contact,landRailScrape(30,4.4,4,1/60));
});
test('workshop: camera safety clips both desired and smoothed boom and preserves unobstructed pose',()=>{
 const anchor={x:0,y:6,z:0},desired={x:0,y:15,z:-10},box={min:[-5,10,-8],max:[5,12,-2]};
 const safe=safeLandCamera(anchor,desired,[box]);assert.ok(safe.y<10);assert.deepEqual(safeLandCamera(anchor,desired,[]),desired);
 const interpolated={x:0,y:11,z:-6};assert.ok(safeLandCamera(anchor,interpolated,[box]).y<10);
});
test('workshop: dynamic full corridor rejects fork, merge, branches and upper/lower crossing',()=>{
 const runtime=createLandRaceRoute(course,7);runtime.init('p');const from=course.commonStart.length-65;place(runtime,'p',locate('start',from));assert.equal(runtime.eligible(from,from+100,'p'),false);
 place(runtime,'p',locate('alley',80));assert.equal(runtime.eligible(runtime.total('p'),runtime.total('p')+60,'p'),false);
});

test('workshop NPC hash preserves exact historical town and quarry keys and independent workshop replay',()=>{
  assert.deepEqual(TOWN_COURSE.presentation?.branchLabels,{alley:'灯巷捷径',boulevard:'电车大道'});
  assert.deepEqual(course.presentation?.branchLabels,{alley:'工具柜弯道',boulevard:'木台外沿'});
  const legacy=(seed:number,id:string,lap:number,map='town')=>{
    let hash=2166136261;for(const char of `${seed}:${id}:${lap}:${map}-fork`)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
    return hash/4294967296<.45?'alley':'boulevard';
  };
  let distinct=0;
  for(const seed of [0,7,72,713,20261010])for(const id of ['whale','gemini','gpt','claude','grok','glm'])for(let lap=0;lap<3;lap++){
    const town=createLandRaceRoute(TOWN_COURSE,seed),quarry=createLandRaceRoute(QUARRY_COURSE,seed),workshop=createLandRaceRoute(course,seed);
    for(const runtime of [town,quarry,workshop]){runtime.init(id);runtime.states.set(id,{...runtime.get(id),cursor:{...runtime.cursor(id),lap}});}
    assert.equal(town.npcChoice(id),legacy(seed,id,lap));
    assert.equal(quarry.npcChoice(id),legacy(seed,id,lap,'quarry'));
    assert.equal(workshop.npcChoice(id),legacy(seed,id,lap,'workshop'));
    if(workshop.npcChoice(id)!==town.npcChoice(id))distinct++;
    assert.equal(workshop.npcChoice(id),workshop.npcChoice(id));
  }
  assert.ok(distinct>10,'map identity actually separates deterministic branch sequences');
});

test('workshop authored pickup rows stay supported in broad low-grade pockets outside split, merge and overpass',()=>{
  const boxes=workshopPickupRows(course);assert.equal(boxes.length,16);
  for(const {edgeId,s,lanes} of WORKSHOP_PICKUP_ROWS){
    const edge=course.edges[edgeId];
    if(edgeId==='alley'||edgeId==='boulevard'){assert.ok(s>120);assert.ok(edge.length-s>100);}
    else if(edgeId==='start')assert.ok(edge.length-s>80);else assert.ok(s>80);
    for(let local=s-8;local<=s+8;local+=2){
      const a=edge.sample(local-2).t,b=edge.sample(local+2).t;
      const radius=4/Math.abs(Math.atan2(a.x*b.z-a.z*b.x,a.x*b.x+a.z*b.z));
      assert.ok(radius>48,`${edgeId}:${s} pickup in tight ${radius}m bend`);
      assert.ok(Math.abs(edge.sample(local).grade)<.07,`${edgeId}:${s} pickup on steep grade`);
    }
    // Static rows are initially present and retain shared cooldown respawn. The 55m
    // approach still has a road-width sight corridor; dynamic appearances
    // require the speed/acceleration-dependent reaction gate; static cooldown
    // respawns retain shared behavior and do not claim that dynamic guarantee.
    const from=edge.sample(s-55).p,to=edge.sample(s).p,chord=to.clone().sub(from),length=chord.length();
    for(let local=s-55;local<=s;local+=2){
      const p=edge.sample(local).p,u=Math.max(0,Math.min(1,p.clone().sub(from).dot(chord)/(length*length)));
      assert.ok(p.distance(from.clone().add(chord.clone().mulScalar(u)))<edge.halfWidthAt(local)+1.2,`${edgeId}:${s} blind approach`);
      for(const other of Object.values(course.edges))for(let at=0;at<other.length;at+=12){
        if(other.id===edgeId&&Math.abs(at-local)<60)continue;
        const q=other.sample(at).p;
        assert.ok(Math.hypot(q.x-p.x,q.z-p.z)>28||Math.abs(q.y-p.y)<5,'static approach avoids both crossing decks');
      }
    }
    for(const lateral of lanes){
      const box=boxes.find(b=>b.edgeId===edgeId&&b.s===s&&b.lateral===lateral)!;
      assert.ok(Math.abs(lateral)+1.1<edge.halfWidthAt(s));assert.ok(box.p.distance(edge.sample(s,lateral).p)<1e-8);
    }
  }
});

test('workshop upper and lower same-edge spool cursors retain support and cannot collide or collect through the overhead bench',()=>{
  const runtime=createLandRaceRoute(course,7),a=actor('lower'),b=actor('upper');
  const lower=locate('start',WORKSHOP_LANDMARKS.crossing.lowerS),upper=locate('start',WORKSHOP_LANDMARKS.crossing.upperS);
  for(const [actor,cursor]of [[a,lower],[b,upper]] as const){runtime.init(actor.id);place(runtime,actor.id,cursor);actor.total=runtime.total(actor.id);actor.lateral=0;}
  const p=sampleCursor(course,resetCursor(course,lower)).p,q=sampleCursor(course,resetCursor(course,upper)).p;
  assert.ok(Math.hypot(p.x-q.x,p.z-q.z)<.01);assert.ok(q.y-p.y>26.5);
  assert.equal(runtime.collides(a,b),false);
  const box={edgeId:'start',s:upper.s,d:b.total,lateral:2,cool:0,display:'mystery',mesh:{enabled:true}} as RacingPickup;
  runtime.advance(a.id,1,1/30,2,'boulevard');assert.equal(runtime.contact({actor:a,previous:a.total,previousLane:2},box),null);
  for(const [edgeId,s]of [['start',WORKSHOP_LANDMARKS.crossing.lowerS],['start',WORKSHOP_LANDMARKS.crossing.upperS]] as const){
    place(runtime,a.id,locate(edgeId,s));const d=runtime.total(a.id);assert.equal(runtime.eligible(d-30,d+30,a.id),false);
  }
});

test('workshop dynamic reaction window uses a fast cabinet exit physical gap and only safe common corridors',t=>{
  const runtime=createLandRaceRoute(course,7);runtime.init('target');runtime.init('other');
  place(runtime,'target',locate('finish',56));place(runtime,'other',locate('alley',course.edges.alley.length-7.5));
  const target={id:'target',total:runtime.total('target'),lateral:0,travelSpeed:6,maxSpeed:6,acceleration:0,reactionSpeed:6};
  const other={id:'other',total:runtime.total('other'),lateral:0,travelSpeed:58,maxSpeed:58,acceleration:0,reactionSpeed:58,held:'shield'};
  const adapter:DynamicPickupTrack={length:course.canonicalLength,sample:track.sample,laneLimit:track.laneLimitAt,eligibility:runtime.eligible,racerPosition:r=>runtime.sample(r.id,r.lateral).p,racerGap:(r,d)=>runtime.gapToDistance(r.id,d),pickupPosition:runtime.pickupPosition};
  const box={d:0,lateral:0,cool:0,display:'mystery',mesh:{enabled:true},models:{boost:{enabled:false},shield:{enabled:false},pulse:{enabled:false},mystery:{enabled:true}}} as RacingPickup;
  const legacyBox={...box,mesh:{enabled:true}};
  const candidate=target.total+25,physicalGap=runtime.gapToDistance('other',candidate)!;
  assert.ok(Math.abs(physicalGap-88.5)<1e-7);assert.ok(candidate-other.total>89.2);
  assert.ok(physicalGap<58*1.4+8,'physical boosted approach is inside the unchanged reaction safety distance');
  const legacy=createDynamicPickupDirector([legacyBox],{...adapter,racerGap:undefined},{initialDelay:0,attempts:1,aheadJitter:0,rng:()=>.5}).tick({dt:.1,active:true,racers:[target,other]});
  assert.equal(legacy.length,1,'the same actual geometry admits the unsafe canonical-gap candidate');
  const spawned=createDynamicPickupDirector([box],adapter,{initialDelay:0,attempts:1,aheadJitter:0,rng:()=>.5}).tick({dt:.1,active:true,racers:[target,other]});
  assert.equal(spawned.length,0,'shorter physical branch cannot receive a reaction-unsafe spawn');
  t.diagnostic(JSON.stringify({physicalGap,canonicalGap:candidate-other.total,requiredGap:58*1.4+8}));
  for(const [edgeId,s]of [['start',185],['finish',80]] as const){place(runtime,'target',locate(edgeId,s));const d=runtime.total('target');assert.equal(runtime.eligible(d,d+24,'target'),true);}
});

test('workshop certified shared pavement supports pulse, shield, traffic avoidance and bump contact across branch IDs',()=>{
  const runtime=createLandRaceRoute(course,7),a=actor('cabinet'),b=actor('rim');
  const locateTail=(id:'alley'|'boulevard',remaining:number)=>locate(id,course.edges[id].length-remaining);
  for(const racer of [a,b])runtime.init(racer.id);
  place(runtime,a.id,locateTail('alley',30));place(runtime,b.id,locateTail('boulevard',25));
  a.total=runtime.total(a.id);b.total=runtime.total(b.id);
  assert.equal(pulseTarget(a,[a,b],course.canonicalLength,runtime.interactions),b);
  assert.equal(planLane(a,[a,b],[],course.canonicalLength,0,0,npcSkill('hard'),runtime.interactions),2.4);
  a.held='pulse';b.shield=1;assert.equal(activateItem(a,[a,b],course.canonicalLength,runtime.interactions)?.blocked,true);assert.equal(b.slow,0);
  a.held='pulse';b.shield=0;assert.equal(activateItem(a,[a,b],course.canonicalLength,runtime.interactions)?.target,b);assert.equal(b.slow,3);
  place(runtime,b.id,locateTail('boulevard',28));assert.equal(runtime.collides(a,b),true);
  place(runtime,a.id,locateTail('alley',55));place(runtime,b.id,locateTail('boulevard',30));
  a.total=runtime.total(a.id);b.total=runtime.total(b.id);
  assert.equal(pulseTarget(a,[a,b],course.canonicalLength,runtime.interactions),b,'approaching cabinet sees traffic already in the certified throat');
});

test('workshop finish subframe clipping preserves physical NPC checkpoints and reset clears all six ledgers',()=>{
  const runtime=createLandRaceRoute(course,7),ids=['whale','gemini','gpt','claude','grok','glm'];
  for(const id of ids)runtime.init(id);
  const prior={cursor:{...locate('finish',course.commonFinish.length-2),lap:2},nextGate:23,laps:2,finished:false};
  runtime.states.set('whale',prior);const completed=runtime.advance('whale',4,.1,0,'boulevard');
  assert.equal(completed.finishFraction,.5);assert.equal(completed.state.nextGate,24);
  const replay=runtime.truncateFrame('whale',prior,.1,.25);
  assert.equal(replay.cursor.s,course.commonFinish.length-1);assert.equal(replay.laps,2);assert.equal(replay.nextGate,23);assert.equal(replay.finished,false);
  runtime.reset();assert.equal(runtime.states.size,0);assert.equal(runtime.motions.size,0);
  for(const id of ids){runtime.init(id);assert.deepEqual(runtime.cursor(id).choiceByLap,{});assert.equal(runtime.get(id).nextGate,0);}
});

test('workshop checkpoint validation rejects scalar shortcuts and reverse gate farming on both physical routes',()=>{
 for(const selected of ['alley','boulevard'] as const){
  const runtime=createLandRaceRoute(course,84);runtime.init('p',0,0);
  assert.equal(runtime.advance('p',course.canonicalLength,.1,0,selected).accepted,false);
  const gate=course.checkpointGates.find(g=>g.edgeId==='start'&&g.index===0)!;
  place(runtime,'p',locate('start',gate.s-1));
  assert.equal(runtime.advance('p',2,.1,0,selected).state.nextGate,1);
  assert.equal(runtime.advance('p',-2,.1,0,selected).state.nextGate,1);
  assert.equal(runtime.advance('p',2,.1,0,selected).state.nextGate,1);
  // Landing near the line without every ordered gate does not invent a lap.
  runtime.states.set('p',{...runtime.get('p'),cursor:locate('finish',course.commonFinish.length-1)});
  runtime.advance('p',2,.1,0,selected);assert.equal(runtime.get('p').laps,0);
  runtime.reset();runtime.init('p');
  while(!runtime.get('p').finished){const result=runtime.advance('p',5,.1,0,selected);assert.ok(result.accepted);}
  assert.equal(runtime.get('p').laps,3);assert.equal(runtime.get('p').nextGate,24);
  assert.deepEqual(Object.values(runtime.cursor('p').choiceByLap),[selected,selected,selected]);
 }
});

test('workshop backward split/merge motion keeps chosen branch and reset keeps the true deck height',()=>{
 for(const selected of ['alley','boulevard'] as const){
  const runtime=createLandRaceRoute(course,84);runtime.init('p');
  place(runtime,'p',{...locate('finish',1),choiceByLap:{0:selected}});
  assert.ok(runtime.advance('p',-2,.1,0,selected).accepted);assert.equal(runtime.cursor('p').edgeId,selected);
  runtime.advance('p',2,.1,0,selected);assert.equal(runtime.cursor('p').edgeId,'finish');
  place(runtime,'p',locate(selected,1));runtime.advance('p',-2,.1,0,selected);assert.equal(runtime.cursor('p').edgeId,'start');
  runtime.advance('p',2,.1,0,selected==='alley'?'boulevard':'alley');assert.equal(runtime.cursor('p').edgeId,selected);
 }
 const lower=resetCursor(course,locate('start',WORKSHOP_LANDMARKS.crossing.lowerS,8)),upper=resetCursor(course,locate('start',WORKSHOP_LANDMARKS.crossing.upperS,-8));
 assert.equal(lower.edgeId,'start');assert.equal(upper.edgeId,'start');
 assert.ok(Math.abs(sampleCursor(course,lower).p.y-WORKSHOP_LANDMARKS.crossing.lowerY)<1e-7);assert.ok(Math.abs(sampleCursor(course,upper).p.y-36)<1e-7);
});


test('workshop sampled wood, cabinet inlay, helical grade and bank drive the unchanged force terms',()=>{
 const tuning=createRaceKartTuning(raceKartBuild(''),20261010)('whale','whale');
 const cabinet=course.edges.alley,wood=course.edges.boulevard,s=235,step=1/60;
 assert.equal(cabinet.surfaceAt(s).kind,'workshop-cabinet-inlay');assert.equal(wood.surfaceAt(s).kind,'workshop-sealed-wood');
 assert.equal(landSteeringGrip(cabinet,s),.96);assert.equal(landSteeringGrip(wood,s),.99);
 const cabinetWood={sample:cabinet.sample,surfaceAt:wood.surfaceAt};
 const inlaySpeed=stepLandSpeed(cabinet,s,30,{throttle:true},step,tuning,0,0);
 const woodSpeed=stepLandSpeed(cabinetWood,s,30,{throttle:true},step,tuning,0,0);
 assert.ok(inlaySpeed<woodSpeed,'actual inlay rolling resistance affects shared driving');
 const climb=course.commonStart.sample(920),bankDrift=landBankDrift(course.commonStart,920,30,step);
 assert.ok(climb.grade>.04);assert.ok(climb.bank>.09);assert.ok(Math.abs(bankDrift)>.002);
 const level={sample:(d:number,lateral=0)=>{const frame=course.commonStart.sample(d,lateral);return {...frame,t:frame.t.clone().set(frame.t.x,0,frame.t.z).normalize()};},surfaceAt:course.commonStart.surfaceAt};
 assert.ok(stepLandSpeed(course.commonStart,920,30,{throttle:true},step,tuning,0,0)<stepLandSpeed(level,920,30,{throttle:true},step,tuning,0,0));
});

test('workshop static pickup rows retain shared eight-second cooldown without dynamic-reaction promises',()=>{
 assert.equal(PICKUP_RESPAWN_SECONDS,8);
 for(const row of workshopPickupRows(course)){
  const box={...row,cool:0,display:'shield' as const,mesh:{enabled:true},models:{boost:{enabled:false},shield:{enabled:true},pulse:{enabled:false},mystery:{enabled:false}}};
  assert.equal(claimPickup(box,false), 'shield');assert.equal(box.cool,8);assert.equal(box.mesh.enabled,false);
  advancePickup(box,7.9,()=>.5);assert.equal(box.mesh.enabled,false);advancePickup(box,.1+1e-8,()=>.5);
  assert.equal(box.cool,0);assert.equal(box.mesh.enabled,true);assert.equal(box.edgeId,row.edgeId);assert.equal(box.s,row.s);
 }
});
