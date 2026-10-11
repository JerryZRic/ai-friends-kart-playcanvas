import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {OpenRoad} from '../src/open-road';
import {GARDEN_COURSE as c,GARDEN_META,GARDEN_TRACK,GARDEN_ROAD_EDGES,GARDEN_LANDMARKS,GARDEN_POINTS,GARDEN_ROADS,GARDEN_MERGE_TAIL,GARDEN_MERGE_TAIL_POINTS,GARDEN_DECISION_APPROACH_LENGTH} from '../src/maps/garden';
import type {RouteEdgeId} from '../src/land-routes';

const near=(a:number,b:number,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b} (tolerance ${t})`);
const frames=['p','t','n','normal'] as const;
const expectedLengths={"start": 1393.9187422626346, "alley": 390.46049633045226, "boulevard": 441.21933090504297, "finish": 923.9572174706034};

test('garden preserves its asymmetric planted terraces, western basin and positive-lateral Arbor Weave',()=>{
  assert.equal(c.id,'garden');assert.equal(GARDEN_META.label,'蔓穹花园');assert.equal(GARDEN_META.tag,'VERDANT CANOPY');
  for(const edge of GARDEN_ROAD_EDGES)near(edge.length,expectedLengths[edge.id]);
  near(c.canonicalLength,2759.095290638281);
  near(c.commonStart.length+c.alternates.alley.length+c.commonFinish.length,2708.33645606369);
  near(c.alternates.boulevard.length-c.alternates.alley.length,50.75883457459071);
  const n=c.commonStart.sample(c.commonStart.length).n;
  for(const [s,separation] of [[10, 2.407054503064302], [20, 8.725180560920393], [40, 27.798275561773494], [60, 50.093137474429085], [80, 70.82600763311169], [110, 86.33146751150196]]){
    near(c.edges.alley.sample(s).p.sub(c.edges.boulevard.sample(s).p).dot(n),separation);
  }
  assert.equal(c.presentation?.branchLabels.alley,'蔓架曲径');assert.equal(c.presentation?.branchLabels.boulevard,'外园舒弧');
  assert.deepEqual(Object.keys(GARDEN_POINTS),['start','alley','boulevard','finish']);
  assert.deepEqual(GARDEN_POINTS.start.at(-2),[220,18,-40]);assert.deepEqual(GARDEN_POINTS.start.at(-1),[220,18,-150]);
  for(const points of Object.values(GARDEN_POINTS)){assert.ok(Object.isFrozen(points));for(const p of points)assert.ok(Object.isFrozen(p));}
});

test('branch source samplers append a separately sampled common 40m tail without a new spline fit',()=>{
  near(GARDEN_MERGE_TAIL.length,40);
  const tail=new OpenRoad(GARDEN_MERGE_TAIL_POINTS,[0,0,-1],[0,0,-1]);
  for(const id of ['alley','boulevard'] as const){
    const base=new OpenRoad(GARDEN_POINTS[id],[0,0,-1],[0,0,-1]),road=GARDEN_ROADS[id];
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
  assert.equal(GARDEN_DECISION_APPROACH_LENGTH,100);assert.ok(GARDEN_DECISION_APPROACH_LENGTH>80);
  const end=c.commonStart.sample(c.commonStart.length);
  for(let remaining=0;remaining<=GARDEN_DECISION_APPROACH_LENGTH;remaining+=.125){
    const s=c.commonStart.length-remaining;
    for(const lateral of [-9.5,-5,0,5,9.5]){
      const f=c.commonStart.sample(s,lateral),atSplit=c.commonStart.sample(c.commonStart.length,lateral);
      near(f.p.x,atSplit.p.x);near(f.p.y,18);near(f.p.z-atSplit.p.z,remaining);
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
  for(const [frame,landmark] of [[c.commonStart.sample(c.commonStart.length),GARDEN_LANDMARKS.split],[c.commonFinish.sample(0),GARDEN_LANDMARKS.merge]] as const){
    near(frame.p.x,landmark.x);near(frame.p.y,landmark.y);near(frame.p.z,landmark.z);
  }
});

test('dense full-width support preserves measured grades, inside radii, camber and forward ribbons',()=>{
  const limits:Record<RouteEdgeId,{radius:number;inner:number;grade:number;outerGrade:number}>= {"start": {"radius": 30.60822676796273, "inner": 21.10822676796273, "grade": 0.04664630959291325, "outerGrade": 0.05809123564493166}, "alley": {"radius": 37.26544128515722, "inner": 29.9156753923827, "grade": 1e-10, "outerGrade": 1.0003335988574215e-10}, "boulevard": {"radius": 38.31322091769166, "inner": 28.813220917691662, "grade": 1e-10, "outerGrade": 0.008046864552462967}, "finish": {"radius": 34.08993839431132, "inner": 24.58993839431132, "grade": 0.08110953644842052, "outerGrade": 0.0841933664753532}};
  let minimumY=Infinity,maximumY=-Infinity;
  for(const edge of GARDEN_ROAD_EDGES){
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
  near(minimumY,6.995821564223508);near(maximumY,27.345687878025977);assert.ok(maximumY-minimumY>20);
});

test('terrace and outer-sweep camber rotates support and eases off before every seam',()=>{
  for(const [id,distances] of [['start',[170,210,250,300,350,390,700,740,780,900,1030,1070,1110]],['boulevard',[80,110,140,220,270,300,330]],['finish',[150,190,230,300,350,390,430]]] as const){
    for(const s of distances){
      const source=GARDEN_ROADS[id].sample(s),edge=c.edges[id],f=edge.sample(s),w=edge.halfWidthAt(s);
      near(f.t.distance(source.t),0);near(f.p.distance(source.p),0);near(f.n.dot(source.n),Math.cos(f.bank));near(f.normal.dot(source.normal),Math.cos(f.bank));
      near(edge.sample(s,w).p.y-edge.sample(s,-w).p.y,2*w*f.n.y);
    }
  }
  near(c.commonStart.sample(300).bank,.025);near(c.commonStart.sample(900).bank,-.022);
  near(c.edges.boulevard.sample(220).bank,-.032);near(c.edges.finish.sample(300).bank,.022);
  assert.ok(Math.abs(c.commonStart.sample(300,9.5).p.y-c.commonStart.sample(300,-9.5).p.y)>.47);
  for(const s of [0,170,390,700,1110,c.commonStart.length])near(c.commonStart.sample(s).bank,0);
});

test('compatibility loop matches exact sweep-route support, wrapping and bounded invalid inputs',()=>{
  let offset=0;
  for(const edge of [c.commonStart,c.alternates.boulevard,c.commonFinish]){
    for(let s=0;s<edge.length;s+=2.25)for(const lateral of [-8.85,0,8.85]){
      const source=edge.sample(s,lateral),legacy=GARDEN_TRACK.sample(offset+s,lateral);
      for(const key of frames)near(source[key].distance(legacy[key]),0,1e-9);
      near(source.bank,legacy.bank);near(source.grade,legacy.grade);near(GARDEN_TRACK.halfWidthAt(offset+s),edge.halfWidthAt(s));near(GARDEN_TRACK.laneLimitAt(offset+s),edge.laneLimitAt(s));
      assert.deepEqual(GARDEN_TRACK.surfaceAt(offset+s),edge.surfaceAt(s));near(legacy.u,(offset+s)/GARDEN_TRACK.length);
    }
    offset+=edge.length;
  }
  for(const s of [-GARDEN_TRACK.length*3,-1,0,1,GARDEN_TRACK.length,GARDEN_TRACK.length*4+12.5]){
    for(const key of frames)near(GARDEN_TRACK.sample(s)[key].distance(GARDEN_TRACK.sample(s+GARDEN_TRACK.length)[key]),0,1e-9);
    assert.ok(Number.isFinite(GARDEN_TRACK.circuit.curvature(s)));
  }
  for(const value of [NaN,Infinity,-Infinity]){
    near(GARDEN_TRACK.sample(value).p.distance(GARDEN_TRACK.sample(0).p),0);
    for(const edge of GARDEN_ROAD_EDGES){near(edge.sample(value,NaN).p.distance(edge.sample(0).p),0);near(edge.sample(value).bank,0);near(edge.halfWidthAt(value),edge.halfWidthAt(0));assert.deepEqual(edge.surfaceAt(value),edge.surfaceAt(0));}
  }
});

test('arbor-weave taper and surface channels supply ordinary grip and rolling resistance, no speed multiplier',()=>{
  const archway=c.edges.alley,tailStart=archway.length-GARDEN_MERGE_TAIL.length;
  near(archway.halfWidthAt(0),9.5);near(archway.halfWidthAt(70),5.8);near(archway.halfWidthAt(tailStart-70),5.8);near(archway.halfWidthAt(tailStart),9.5);
  const earth={kind:'garden-warm-stone-road',grip:.975,rollingResistance:1.018},pavers={kind:'garden-arbor-jointed-paving',grip:.94,rollingResistance:1.045};
  for(const s of [0,80,tailStart-80,tailStart,archway.length])assert.deepEqual(archway.surfaceAt(s),earth);
  for(const s of [80.001,100,tailStart-80-.001])assert.deepEqual(archway.surfaceAt(s),pavers);
  for(const edge of GARDEN_ROAD_EDGES){
    assert.deepEqual(Object.keys(edge).sort(),['id','length','sample','halfWidthAt','laneLimitAt','surfaceAt'].sort());
    for(let s=0;s<=edge.length;s+=10)if(edge.id!=='alley')assert.deepEqual(edge.surfaceAt(s),earth);
  }
});

test('compatibility clearance includes both branches and every full-width physical edge',()=>{
  for(const edge of GARDEN_ROAD_EDGES)for(let s=0;s<edge.length;s+=7){
    for(const lateral of [-edge.halfWidthAt(s),0,edge.halfWidthAt(s)]){const p=edge.sample(s,lateral).p;assert.equal(GARDEN_TRACK.clearAt(p.x,p.z),false);}
  }
  assert.equal(GARDEN_TRACK.clearAt(1000,1000,10),true);assert.equal(GARDEN_TRACK.clearAt(NaN,100),false);assert.equal(GARDEN_TRACK.clearAt(100,100,Infinity),false);
});


test('production full-width support matches the independent frozen prototype exact-double fingerprint',()=>{
  // Independently captured from the frozen prototype, never regenerated from production.
  // Encode all IEEE754 double bits, including signed zero; no rounding tolerance.
  const hash=createHash('sha256'),bytes=Buffer.alloc(8);let samples=0;
  for(const edge of GARDEN_ROAD_EDGES){
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
  assert.equal(samples,63015);assert.equal(hash.digest('hex'),'c90df9b683e808b661bbefc990dc78878bad6e50010f597408566d74811e10a6');
  assert.deepEqual(c.checkpointGates,[{"index":0,"edgeId":"start","s":473.9323723692958},{"index":1,"edgeId":"start","s":1282.405242881624},{"index":2,"edgeId":"alley","s":117.13814889913567},{"index":3,"edgeId":"alley","s":296.74997721114374},{"index":2,"edgeId":"boulevard","s":132.36579927151288},{"index":3,"edgeId":"boulevard","s":335.32669148783265},{"index":4,"edgeId":"finish","s":147.83315479529654},{"index":5,"edgeId":"finish","s":406.5411756870655},{"index":6,"edgeId":"finish","s":720.6866296270707},{"index":7,"edgeId":"finish","s":923.9572174706034}]);
});

test('every checkpoint retains independently frozen center, legal-lane edges, tangent and normal',()=>{
  const expected=[{"index":0,"edgeId":"start","s":473.9323723692958,"center":[-104.78530862775452,26.66304868435919,91.24773788975608],"left":[-102.36683833203011,26.66304868435919,99.76087488082457],"right":[-107.20377892347892,26.66304868435919,82.73460089868759],"tangent":[0.9616299902814629,0.025237514328440028,-0.2731864375509799],"normal":[-0.024276883253340556,0.9996814832087879,0.006896743360593373],"laneLimit":8.85},{"index":1,"edgeId":"start","s":1282.405242881624,"center":[220.01182182692813,17.999718527930284,-38.48656453230748],"left":[228.86077238048475,17.999718527930284,-38.62285136479756],"right":[211.1628712733715,17.999718527930284,-38.350277699817404],"tangent":[-0.015399641054124292,0.0003666581203362916,-0.9998813512698529],"normal":[5.646403822304933e-06,0.9999999327809092,0.0003666146414594185],"laneLimit":8.85},{"index":2,"edgeId":"alley","s":117.13814889913567,"center":[200.21332605985583,18,-258.41021004060946],"left":[204.59865524594062,18,-255.70995302882835],"right":[195.82799687377104,18,-261.11046705239056],"tangent":[0.5243217498604082,0,-0.8515202303077241],"normal":[0,1,0],"laneLimit":5.1499999999999995},{"index":3,"edgeId":"alley","s":296.74997721114374,"center":[199.50732125434354,18,-421.05333308695157],"left":[204.46194006079608,18,-418.3215003745531],"right":[194.552702447891,18,-423.78516579935],"tangent":[0.482840190047292,0,-0.875708485099405],"normal":[0,1,0],"laneLimit":5.6578403552754635},{"index":2,"edgeId":"boulevard","s":132.36579927151288,"center":[299.4741926542146,18,-251.83232195802566],"left":[305.5806280106087,18.270570213656526,-245.43226422409367],"right":[293.36775729782056,17.729429786343474,-258.23237969195765],"tangent":[0.7235085771225583,0,-0.6903153908396444],"normal":[-0.021104947207895144,0.9995325394650321,-0.022119759355297284],"laneLimit":8.85},{"index":3,"edgeId":"boulevard","s":335.32669148783265,"center":[250.8331449527232,18,-413.46422826103833],"left":[257.01059152247626,18,-419.80155055660185],"right":[244.65569838297014,18,-407.1269059654748],"tangent":[-0.7160816153179103,0,-0.6980165615540168],"normal":[0,1,0],"laneLimit":8.85},{"index":4,"edgeId":"finish","s":147.83315479529654,"center":[98.6976604036054,22.010316956198892,-571.7382423861951],"left":[98.40400426532861,22.010316956198892,-580.5833690711246],"right":[98.99131654188218,22.010316956198892,-562.8931157012656],"tangent":[-0.9988908212318036,0.033426734100021546,0.03316294176123478],"normal":[0.033408327432558685,0.9994411705785422,-0.0011091486611319067],"laneLimit":8.85},{"index":5,"edgeId":"finish","s":406.5411756870655,"center":[-132.3511315758456,23.254802685741105,-477.16449582968244],"left":[-129.37105059559428,23.21442463120645,-485.4975617098886],"right":[-135.33121255609694,23.295180740275757,-468.8314299494763],"tangent":[-0.9409974178969288,-0.03741269442428641,-0.3363393372878467],"normal":[-0.03369284963733814,0.9992894845650684,-0.01689135639893585],"laneLimit":8.85},{"index":6,"edgeId":"finish","s":720.6866296270707,"center":[-375.2100574899392,6.996785650058238,-359.04391114508263],"left":[-383.867345659781,6.996785650058238,-360.88071857764527],"right":[-366.55276932009735,6.996785650058238,-357.20710371252],"tangent":[-0.20754838886157026,-0.002136234390811246,0.9782224198941639],"normal":[-0.000443373017710507,0.9999977182487105,0.002089717143455299],"laneLimit":8.85},{"index":7,"edgeId":"finish","s":923.9572174706034,"center":[-350,14,-160],"left":[-358.85,14,-160],"right":[-341.15,14,-160],"tangent":[0,0,1],"normal":[0,1,0],"laneLimit":8.85}];
  for(const value of expected){
    const edge=c.edges[value.edgeId as RouteEdgeId],f=edge.sample(value.s),lane=edge.laneLimitAt(value.s);
    assert.deepEqual(f.p.toArray(),value.center);assert.deepEqual(f.t.toArray(),value.tangent);assert.deepEqual(f.normal.toArray(),value.normal);
    assert.deepEqual(edge.sample(value.s,-lane).p.toArray(),value.left);assert.deepEqual(edge.sample(value.s,lane).p.toArray(),value.right);assert.equal(lane,value.laneLimit);
  }
});

test('western basin keeps the corrected physical descent rather than the rejected shallow-height candidate',()=>{
  assert.deepEqual(GARDEN_POINTS.finish[6],[-375,7,-360]);
  let minimum=Infinity,maximum=-Infinity;
  for(let s=0;s<c.commonFinish.length;s+=.25){const y=c.commonFinish.sample(s).p.y;minimum=Math.min(minimum,y);maximum=Math.max(maximum,y);}
  assert.ok(maximum-minimum>18,'actual physical traversal must retain the depth repair');
});
