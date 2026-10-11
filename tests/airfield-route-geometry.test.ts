import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {OpenRoad} from '../src/open-road';
import {AIRFIELD_COURSE as c,AIRFIELD_META,AIRFIELD_TRACK,AIRFIELD_ROAD_EDGES,AIRFIELD_LANDMARKS,AIRFIELD_POINTS,AIRFIELD_ROADS,AIRFIELD_MERGE_TAIL,AIRFIELD_MERGE_TAIL_POINTS,AIRFIELD_DECISION_APPROACH_LENGTH} from '../src/maps/airfield';
import {createLandRaceRoute} from '../src/land-race-route';
import type {RouteEdgeId} from '../src/land-routes';

const near=(a:number,b:number,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b} (tolerance ${t})`);
const frames=['p','t','n','normal'] as const;
const expectedLengths={"start": 1203.3254077843299, "alley": 379.64416145376265, "boulevard": 431.33655446126255, "finish": 1431.8777751189264};

test('airfield preserves the long launch runway, reversing ridge and positive-lateral Hangar Cut',()=>{
  assert.equal(c.id,'airfield');assert.equal(AIRFIELD_META.label,'铜翼空港');assert.equal(AIRFIELD_META.tag,'COPPERWING AIRFIELD');
  for(const edge of AIRFIELD_ROAD_EDGES)near(edge.length,expectedLengths[edge.id]);
  near(c.canonicalLength,3066.5397373645187);
  near(c.commonStart.length+c.alternates.alley.length+c.commonFinish.length,3014.8473443570188);
  near(c.alternates.boulevard.length-c.alternates.alley.length,51.6923930074999);
  const n=c.commonStart.sample(c.commonStart.length).n;
  for(const [s,separation] of [[10, 2.532473710601778], [20, 9.178693886424014], [40, 29.010249818444947], [60, 51.75754644690983], [80, 71.65058791710499], [110, 87.9012518881745]]){
    near(c.edges.alley.sample(s).p.sub(c.edges.boulevard.sample(s).p).dot(n),separation);
  }
  assert.equal(c.presentation?.branchLabels.alley,'机库折径');assert.equal(c.presentation?.branchLabels.boulevard,'周界滑行道');
  assert.deepEqual(Object.keys(AIRFIELD_POINTS),['start','alley','boulevard','finish']);
  assert.deepEqual(AIRFIELD_POINTS.start.at(-2),[110,20,285]);assert.deepEqual(AIRFIELD_POINTS.start.at(-1),[220,20,285]);
  for(const points of Object.values(AIRFIELD_POINTS)){assert.ok(Object.isFrozen(points));for(const p of points)assert.ok(Object.isFrozen(p));}
});

test('branch source samplers append a separately sampled common 40m tail without a new spline fit',()=>{
  near(AIRFIELD_MERGE_TAIL.length,40);
  const tail=new OpenRoad(AIRFIELD_MERGE_TAIL_POINTS,[1,0,0],[1,0,0]);
  for(const id of ['alley','boulevard'] as const){
    const base=new OpenRoad(AIRFIELD_POINTS[id],[1,0,0],[1,0,0]),road=AIRFIELD_ROADS[id];
    near(base.length+tail.length,road.length);near(c.edges[id].length,road.length);
    for(let s=0;s<=road.length;s+=.5)for(const lateral of [-9.5,0,9.5]){
      const reference=road.length-s<=40?tail.sample(40-(road.length-s),lateral):base.sample(s,lateral);
      for(const key of frames)near(road.sample(s,lateral)[key].distance(reference[key]),0);
    }
    for(const lateral of [-9.5,-5,0,5,9.5]){
      const a=base.sample(base.length,lateral),b=tail.sample(0,lateral);
      for(const key of frames)near(a[key].distance(b[key]),0);
    }
  }
});

test('100m decision approach stays straight, level and unbanked across the complete input zone',()=>{
  assert.equal(AIRFIELD_DECISION_APPROACH_LENGTH,100);assert.ok(AIRFIELD_DECISION_APPROACH_LENGTH>80);
  const end=c.commonStart.sample(c.commonStart.length);
  for(let remaining=0;remaining<=AIRFIELD_DECISION_APPROACH_LENGTH;remaining+=.125){
    const s=c.commonStart.length-remaining;
    for(const lateral of [-9.5,-5,0,5,9.5]){
      const f=c.commonStart.sample(s,lateral),atSplit=c.commonStart.sample(c.commonStart.length,lateral);
      near(atSplit.p.x-f.p.x,remaining);near(f.p.y,20);near(f.p.z,atSplit.p.z);
      near(f.t.distance(end.t),0);near(f.n.distance(end.n),0);near(f.normal.distance(end.normal),0);near(f.bank,0);near(f.grade,0);
    }
    near(c.commonStart.halfWidthAt(s),9.5);near(c.commonStart.laneLimitAt(s),8.85);
  }
});

test('all five graph seams retain full-width supported frames and every surface channel',()=>{
  for(const [a,b] of [[c.edges.start,c.edges.alley],[c.edges.start,c.edges.boulevard],[c.edges.alley,c.edges.finish],[c.edges.boulevard,c.edges.finish],[c.edges.finish,c.edges.start]]){
    for(const lateral of [-9.5,-5,0,5,9.5]){
      const x=a.sample(a.length,lateral),y=b.sample(0,lateral);
      for(const key of frames)near(x[key].distance(y[key]),0);
      near(x.grade,y.grade);near(x.bank,y.bank);
    }
    near(a.halfWidthAt(a.length),b.halfWidthAt(0));near(a.laneLimitAt(a.length),b.laneLimitAt(0));assert.deepEqual(a.surfaceAt(a.length),b.surfaceAt(0));
  }
  for(const [frame,landmark] of [[c.commonStart.sample(c.commonStart.length),AIRFIELD_LANDMARKS.split],[c.commonFinish.sample(0),AIRFIELD_LANDMARKS.merge]] as const){
    near(frame.p.x,landmark.x);near(frame.p.y,landmark.y);near(frame.p.z,landmark.z);
  }
});

test('dense full-width support preserves measured grades, inside radii, camber and forward ribbons',()=>{
  const limits:Record<RouteEdgeId,{radius:number;inner:number;grade:number;outerGrade:number}>= {"start": {"radius": 34.22872627608479, "inner": 24.728726276084796, "grade": 0.07789073232636184, "outerGrade": 0.09104428182460544}, "alley": {"radius": 34.02328233903433, "inner": 24.523282339034335, "grade": 1e-10, "outerGrade": 1.0003929781224261e-10}, "boulevard": {"radius": 41.00228896910138, "inner": 31.502288969101382, "grade": 1e-10, "outerGrade": 0.00791032420427287}, "finish": {"radius": 43.08074347264273, "inner": 33.58074347264273, "grade": 0.03354152280159841, "outerGrade": 0.04079097083096141}};
  let minimumY=Infinity,maximumY=-Infinity;
  for(const edge of AIRFIELD_ROAD_EDGES){
    let minRadius=Infinity,minInner=Infinity,maxGrade=0,maxOuterGrade=0,maxBank=0,maxBankChange=0,maxWidthChange=0,minWidth=Infinity,maxWidth=0,minForward=Infinity;
    for(let s=0;;s=Math.min(edge.length,s+.25)){
      const f=edge.sample(s),width=edge.halfWidthAt(s),ns=Math.min(s+.25,edge.length),next=edge.sample(ns),span=ns-s;
      for(const key of frames)assert.ok([f[key].x,f[key].y,f[key].z].every(Number.isFinite),`${edge.id}/${s}/${key}`);
      for(const key of ['t','n','normal'] as const)near(f[key].length(),1,1e-12);
      near(f.t.dot(f.n),0,1e-12);near(f.t.dot(f.normal),0,1e-12);near(f.n.dot(f.normal),0,1e-12);
      near(f.grade,f.t.y/Math.hypot(f.t.x,f.t.z));assert.ok(f.normal.y>.995);
      if(span>1e-8){
        const turn=Math.abs(Math.atan2(f.t.z*next.t.x-f.t.x*next.t.z,f.t.x*next.t.x+f.t.z*next.t.z));
        if(turn>0){minRadius=Math.min(minRadius,span/turn);minInner=Math.min(minInner,span/turn-width);}
        maxBankChange=Math.max(maxBankChange,Math.abs(next.bank-f.bank)/span);maxWidthChange=Math.max(maxWidthChange,Math.abs(edge.halfWidthAt(ns)-width)/span);
        for(const sign of [-1,1]){
          const a=edge.sample(s,sign*width).p,b=edge.sample(ns,sign*edge.halfWidthAt(ns)).p;
          maxOuterGrade=Math.max(maxOuterGrade,Math.abs(b.y-a.y)/Math.hypot(b.x-a.x,b.z-a.z));minForward=Math.min(minForward,b.clone().sub(a).dot(f.t)/span);
        }
      }
      maxGrade=Math.max(maxGrade,Math.abs(f.grade));maxBank=Math.max(maxBank,Math.abs(f.bank));minWidth=Math.min(minWidth,width);maxWidth=Math.max(maxWidth,width);near(edge.laneLimitAt(s),width-.65);
      for(const lateral of [-width,-edge.laneLimitAt(s),0,edge.laneLimitAt(s),width]){
        const support=edge.sample(s,lateral);near(support.p.distance(f.p),Math.abs(lateral));near(support.p.y-f.p.y,f.n.y*lateral);
        minimumY=Math.min(minimumY,support.p.y);maximumY=Math.max(maximumY,support.p.y);
      }
      if(s===edge.length)break;
    }
    assert.ok(minRadius>limits[edge.id].radius,`${edge.id}: radius ${minRadius}`);assert.ok(minInner>limits[edge.id].inner,`${edge.id}: inside radius ${minInner}`);
    assert.ok(maxGrade<=limits[edge.id].grade,`${edge.id}: grade ${maxGrade}`);assert.ok(maxOuterGrade<=limits[edge.id].outerGrade,`${edge.id}: outer grade ${maxOuterGrade}`);
    near(minWidth,edge.id==='alley'?5.8:9.5);near(maxWidth,9.5);near(maxBank,edge.id==='start'?.025:edge.id==='boulevard'?.032:edge.id==='finish'?.022:0);
    assert.ok(maxBankChange<.00104);assert.ok(maxWidthChange<.080);assert.ok(minForward>.689,'full-width ribbon cannot fold along an inside edge');
  }
  near(minimumY,7.40941861706881);near(maximumY,31.06626747903732);assert.ok(maximumY-minimumY>20);
});

test('ridge and outer-taxiway camber rotates support and eases off before every seam',()=>{
  for(const [id,distances] of [['start',[340,380,420,500,590,630,670,790,830,870,930,990,1030,1070]],['boulevard',[80,110,140,220,270,300,330]],['finish',[170,210,250,350,510,550,590]]] as const){
    for(const s of distances){
      const source=AIRFIELD_ROADS[id].sample(s),edge=c.edges[id],f=edge.sample(s),w=edge.halfWidthAt(s);
      near(f.t.distance(source.t),0);near(f.p.distance(source.p),0);near(f.n.dot(source.n),Math.cos(f.bank));near(f.normal.dot(source.normal),Math.cos(f.bank));
      near(edge.sample(s,w).p.y-edge.sample(s,-w).p.y,2*w*f.n.y);
    }
  }
  near(c.commonStart.sample(500).bank,.025);near(c.commonStart.sample(930).bank,-.020);
  near(c.edges.boulevard.sample(220).bank,-.032);near(c.edges.finish.sample(300).bank,.022);
  assert.ok(Math.abs(c.commonStart.sample(500,9.5).p.y-c.commonStart.sample(500,-9.5).p.y)>.47);
  for(const s of [0,340,670,790,1070,c.commonStart.length])near(c.commonStart.sample(s).bank,0);
});

test('compatibility loop matches exact taxiway-route support, wrapping and bounded invalid inputs',()=>{
  let offset=0;
  for(const edge of [c.commonStart,c.alternates.boulevard,c.commonFinish]){
    for(let s=0;s<edge.length;s+=2.25)for(const lateral of [-8.85,0,8.85]){
      const source=edge.sample(s,lateral),legacy=AIRFIELD_TRACK.sample(offset+s,lateral);
      for(const key of frames)near(source[key].distance(legacy[key]),0,1e-9);
      near(source.bank,legacy.bank);near(source.grade,legacy.grade);near(AIRFIELD_TRACK.halfWidthAt(offset+s),edge.halfWidthAt(s));near(AIRFIELD_TRACK.laneLimitAt(offset+s),edge.laneLimitAt(s));
      assert.deepEqual(AIRFIELD_TRACK.surfaceAt(offset+s),edge.surfaceAt(s));near(legacy.u,(offset+s)/AIRFIELD_TRACK.length);
    }
    offset+=edge.length;
  }
  for(const s of [-AIRFIELD_TRACK.length*3,-1,0,1,AIRFIELD_TRACK.length,AIRFIELD_TRACK.length*4+12.5]){
    for(const key of frames)near(AIRFIELD_TRACK.sample(s)[key].distance(AIRFIELD_TRACK.sample(s+AIRFIELD_TRACK.length)[key]),0,1e-9);
    assert.ok(Number.isFinite(AIRFIELD_TRACK.circuit.curvature(s)));
  }
  for(const value of [NaN,Infinity,-Infinity]){
    near(AIRFIELD_TRACK.sample(value).p.distance(AIRFIELD_TRACK.sample(0).p),0);
    for(const edge of AIRFIELD_ROAD_EDGES){near(edge.sample(value,NaN).p.distance(edge.sample(0).p),0);near(edge.sample(value).bank,0);near(edge.halfWidthAt(value),edge.halfWidthAt(0));assert.deepEqual(edge.surfaceAt(value),edge.surfaceAt(0));}
  }
});

test('hangar-cut taper and surface channels supply ordinary grip and rolling resistance, no speed multiplier',()=>{
  const archway=c.edges.alley,tailStart=archway.length-AIRFIELD_MERGE_TAIL.length;
  near(archway.halfWidthAt(0),9.5);near(archway.halfWidthAt(70),5.8);near(archway.halfWidthAt(tailStart-70),5.8);near(archway.halfWidthAt(tailStart),9.5);
  const earth={kind:'airfield-dry-runway-road',grip:.975,rollingResistance:1.018},pavers={kind:'airfield-apron-jointed-paving',grip:.94,rollingResistance:1.045};
  for(const s of [0,80,tailStart-80,tailStart,archway.length])assert.deepEqual(archway.surfaceAt(s),earth);
  for(const s of [80.001,100,tailStart-80-.001])assert.deepEqual(archway.surfaceAt(s),pavers);
  for(const edge of AIRFIELD_ROAD_EDGES){
    assert.deepEqual(Object.keys(edge).sort(),['id','length','sample','halfWidthAt','laneLimitAt','surfaceAt'].sort());
    for(let s=0;s<=edge.length;s+=10)if(edge.id!=='alley')assert.deepEqual(edge.surfaceAt(s),earth);
  }
});

test('compatibility clearance includes both branches and every full-width physical edge',()=>{
  for(const edge of AIRFIELD_ROAD_EDGES)for(let s=0;s<edge.length;s+=7){
    for(const lateral of [-edge.halfWidthAt(s),0,edge.halfWidthAt(s)]){const p=edge.sample(s,lateral).p;assert.equal(AIRFIELD_TRACK.clearAt(p.x,p.z),false);}
  }
  assert.equal(AIRFIELD_TRACK.clearAt(1000,1000,10),true);assert.equal(AIRFIELD_TRACK.clearAt(NaN,100),false);assert.equal(AIRFIELD_TRACK.clearAt(100,100,Infinity),false);
});


test('production full-width support matches the independent frozen prototype exact-double fingerprint',()=>{
  // Independently captured from the frozen prototype, never regenerated from production.
  // Encode all IEEE754 double bits, including signed zero; no rounding tolerance.
  const hash=createHash('sha256'),bytes=Buffer.alloc(8);let samples=0;
  for(const edge of AIRFIELD_ROAD_EDGES){
    hash.update(edge.id);
    for(let s=0;;s=Math.min(edge.length,s+.25)){
      const width=edge.halfWidthAt(s),lane=edge.laneLimitAt(s),surface=edge.surfaceAt(s);
      for(const lateral of [-width,-lane,0,lane,width]){
        const f=edge.sample(s,lateral),values=[s,lateral,...frames.flatMap(k=>f[k].toArray()),f.u,f.angle,f.bank,f.grade,width,lane,surface.grip,surface.rollingResistance];
        for(const value of values){bytes.writeDoubleBE(value);hash.update(bytes);}
        hash.update(surface.kind+'\n');samples++;
      }
      if(s===edge.length)break;
    }
  }
  hash.update(JSON.stringify(c.checkpointGates));
  assert.equal(samples,68955);assert.equal(hash.digest('hex'),'72aecf74df7ffae34f043e7552b71ade70dfd466d176b747e89b1e530f860b07');
  assert.deepEqual(c.checkpointGates,[{"index":0,"edgeId":"start","s":409.1306386466722},{"index":1,"edgeId":"start","s":1107.0593751615836},{"index":2,"edgeId":"alley","s":113.89324843612879},{"index":3,"edgeId":"alley","s":288.52956270485964},{"index":2,"edgeId":"boulevard","s":129.40096633837877},{"index":3,"edgeId":"boulevard","s":327.81578139055955},{"index":4,"edgeId":"finish","s":229.10044401902823},{"index":5,"edgeId":"finish","s":630.0262210523276},{"index":6,"edgeId":"finish","s":1116.8646645927627},{"index":7,"edgeId":"finish","s":1431.8777751189264}]);
});

test('every checkpoint retains independently frozen center, legal-lane edges, tangent and normal',()=>{
  const expected=[{"index":0,"edgeId":"start","s":409.1306386466722,"center":[159.18984418790967,18.921807165494208,-61.06398578462172],"left":[151.62871705274023,18.712246947795624,-56.4696478605066],"right":[166.7509713230791,19.131367383192792,-65.65832370873684],"tangent":[0.5165430715341109,0.07079613303464455,0.8533294573594933],"normal":[-0.05695878708865941,0.9972097105387975,-0.048254427574229805],"laneLimit":8.85},{"index":1,"edgeId":"start","s":1107.0593751615836,"center":[123.73396737725942,20.000000000000004,285],"left":[123.73396737725942,20.000000000000004,293.85],"right":[123.73396737725942,20.000000000000004,276.15],"tangent":[1,0,0],"normal":[-0,1,0],"laneLimit":8.85},{"index":2,"edgeId":"alley","s":113.89324843612879,"center":[325.09814230780876,20,258.7933589452227],"left":[323.47176501403146,20,263.67980928245987],"right":[326.72451960158605,20,253.90690860798549],"tangent":[0.9488253082013988,0,0.3158014162674399],"normal":[-0,1,0],"laneLimit":5.1499999999999995},{"index":3,"edgeId":"alley","s":288.52956270485964,"center":[491.7497112700674,20,269.7095517503984],"left":[489.1034609058473,20,274.8848730569416],"right":[494.39596163428746,20,264.5342304438552],"tangent":[0.890358945892032,0,0.45525920909963996],"normal":[-0,1,0],"laneLimit":5.812623471040836},{"index":2,"edgeId":"boulevard","s":129.40096633837877,"center":[322.3565121331405,20,359.28108721364714],"left":[316.20654686546095,20.25977281168842,365.63977774650397],"right":[328.50647740082,19.74022718831158,352.9223966807903],"tangent":[0.7188058302354206,0,0.6952108877308868],"normal":[0.02040642791211933,0.99956911197038,-0.021099006957998354],"laneLimit":8.85},{"index":3,"edgeId":"boulevard","s":327.81578139055955,"center":[484.3432150768829,20,312.82250371353103],"left":[490.4090147496213,20.001098586526567,319.2667703997658],"right":[478.27741540414456,19.998901413473433,306.3782370272963],"tangent":[0.7281657328684151,0,-0.6854010982455483],"normal":[-0.00008508162845491283,0.9999999922953662,-0.00009039017663685542],"laneLimit":8.85},{"index":4,"edgeId":"finish","s":229.10044401902823,"center":[600.5630979467987,14.305728983828434,105.81590158286208],"left":[607.6546505317523,14.144029923287087,100.52380980846333],"right":[593.4715453618452,14.46742804436978,111.10799335726084],"tangent":[-0.5982477691507214,-0.02956705456080508,-0.8007655062443585],"normal":[-0.0030495521085658218,0.9993957959235864,-0.034622872818391756],"laneLimit":8.85},{"index":5,"edgeId":"finish","s":630.0262210523276,"center":[364.0388134161222,7.99805128094495,-216.7589010297477],"left":[369.6810956610083,7.99805128094495,-223.5770496838211],"right":[358.39653117123606,7.99805128094495,-209.94075237567432],"tangent":[-0.770412064567267,0.0007431335772320411,-0.6375458403296876],"normal":[0.0005725192315707784,0.9999997238762051,0.0004737818517960514],"laneLimit":8.85},{"index":6,"edgeId":"finish","s":1116.8646645927627,"center":[-108.67792094602903,8,-280.0662919642837],"left":[-108.54804190456436,8,-288.91533888666964],"right":[-108.80779998749371,8,-271.2172450418978],"tangent":[-0.9998923076142314,0,-0.014675597905612502],"normal":[0,1,0],"laneLimit":8.85},{"index":7,"edgeId":"finish","s":1431.8777751189264,"center":[-220,8,-150],"left":[-220,8,-141.15],"right":[-220,8,-158.85],"tangent":[1,0,0],"normal":[-0,1,0],"laneLimit":8.85}];
  for(const value of expected){
    const edge=c.edges[value.edgeId as RouteEdgeId],f=edge.sample(value.s),lane=edge.laneLimitAt(value.s);
    assert.deepEqual(f.p.toArray(),value.center);assert.deepEqual(f.t.toArray(),value.tangent);assert.deepEqual(f.normal.toArray(),value.normal);
    assert.deepEqual(edge.sample(value.s,-lane).p.toArray(),value.left);assert.deepEqual(edge.sample(value.s,lane).p.toArray(),value.right);assert.equal(lane,value.laneLimit);
  }
});

test('the final physical taxiway retains the corrected104m bulge rather than the rejected112m version',()=>{
  assert.deepEqual(AIRFIELD_POINTS.boulevard[4],[380,20,389]);
  near(AIRFIELD_POINTS.boulevard[4][2]-AIRFIELD_POINTS.boulevard[0][2],104);
  near(c.alternates.boulevard.length-c.alternates.alley.length,51.6923930074999);
  let minimum=Infinity,maximum=-Infinity;
  for(const edge of AIRFIELD_ROAD_EDGES)for(let s=0;s<edge.length;s+=.25){const y=edge.sample(s).p.y;minimum=Math.min(minimum,y);maximum=Math.max(maximum,y);}
  assert.ok(maximum-minimum>18,'actual physical route must retain its measured vertical traversal');
});

test('unchanged80m steering choice sits inside the100m level corridor and selects physical sides',()=>{
  const route=createLandRaceRoute(c,20261010);
  route.init('pilot',c.commonStart.length-81,2.6);assert.equal(route.nearFork('pilot'),false);
  route.init('pilot',c.commonStart.length-79,2.6);assert.equal(route.nearFork('pilot'),true);
  assert.equal(route.playerChoice('pilot',-1,2.6),'alley');assert.equal(route.playerChoice('pilot',1,-2.6),'boulevard');
});

test('all raw full-width source frames and complete checkpoint cross-sections retain exact double fingerprints',()=>{
  const bytes=Buffer.alloc(8),raw=createHash('sha256'),gates=createHash('sha256');let rawSamples=0,gateSamples=0;
  const numbers=(h:ReturnType<typeof createHash>,values:number[])=>{for(const n of values){bytes.writeDoubleBE(n);h.update(bytes);}};
  for(const edge of AIRFIELD_ROAD_EDGES){raw.update(edge.id);const road=AIRFIELD_ROADS[edge.id];
    for(let s=0;;s=Math.min(road.length,s+.5)){
      for(const lateral of [-9.5,-5,0,5,9.5]){const f=road.sample(s,lateral);numbers(raw,[s,lateral,...frames.flatMap(k=>f[k].toArray()),f.u,f.angle,f.bank,f.grade]);rawSamples++;}
      if(s===road.length)break;
    }
  }
  for(const g of c.checkpointGates){gates.update(JSON.stringify(g));const edge=c.edges[g.edgeId];
    for(const lateral of [-edge.halfWidthAt(g.s),-edge.laneLimitAt(g.s),0,edge.laneLimitAt(g.s),edge.halfWidthAt(g.s)]){const f=edge.sample(g.s,lateral);numbers(gates,[lateral,...frames.flatMap(k=>f[k].toArray()),f.u,f.angle,f.bank,f.grade]);gateSamples++;}
  }
  assert.equal(rawSamples,34490);assert.equal(raw.digest('hex'),'35bc166938ce5008a6c9f2e15fd5ea98e74ac30966ea3c111ae251de48fc9ade');
  assert.equal(gateSamples,50);assert.equal(gates.digest('hex'),'23ecc9303b52d98e271df6b539404a2520a61a4b1ca06f2d9c8bd9f9a2827caa');
});
