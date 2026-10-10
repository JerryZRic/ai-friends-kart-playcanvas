import test from 'node:test';
import assert from 'node:assert/strict';
import {OpenRoad} from '../src/open-road';
import {FOREST_COURSE as c,FOREST_META,FOREST_TRACK,FOREST_ROAD_EDGES,FOREST_LANDMARKS,FOREST_POINTS,FOREST_ROADS,FOREST_MERGE_TAIL,FOREST_MERGE_TAIL_POINTS,FOREST_HORIZONTAL_SCALE,FOREST_DECISION_APPROACH_LENGTH} from '../src/maps/forest';
import type {RouteEdgeId} from '../src/land-routes';

const near=(a:number,b:number,t=1e-8) => assert.ok(Math.abs(a-b)<=t,`${a} != ${b} (tolerance ${t})`);
const frames=['p','t','n','normal'] as const;
const expectedLengths={start:1120.5480641511485,alley:295.12727701508993,boulevard:359.2384938967034,finish:1382.5470495830305};

test('forest preserves the original measured physical routes and branch intent',()=>{
  assert.equal(c.id,'forest');near(FOREST_HORIZONTAL_SCALE,.75);
  assert.equal(FOREST_META.label,'杉影星台环线');assert.equal(FOREST_META.tag,'CEDARLIGHT OBSERVATORY');
  for(const edge of FOREST_ROAD_EDGES)near(edge.length,expectedLengths[edge.id]);
  near(c.canonicalLength,2862.3336076308824);
  near(c.commonStart.length+c.alternates.alley.length+c.commonFinish.length,2798.222390749269);
  near(c.alternates.boulevard.length-c.alternates.alley.length,64.11121688161347);
  const n=c.commonStart.sample(c.commonStart.length).n;
  for(const [s,separation] of [[40,6.611679883061605],[60,13.69077431339776]]){
    near(c.edges.alley.sample(s).p.sub(c.edges.boulevard.sample(s).p).dot(n),separation);
  }
  assert.equal(c.presentation?.branchLabels.alley,'星台旧径');
  assert.equal(c.presentation?.branchLabels.boulevard,'星台外环');
  assert.deepEqual(Object.keys(FOREST_POINTS),['start','alley','boulevard','finish']);
  assert.deepEqual(FOREST_POINTS.start.at(-2),[-75,34,322.5]);
  assert.deepEqual(FOREST_POINTS.start.at(-1),[-75,34,420]);
});

test('branch source samplers append the exact same separately sampled 41.25m tail',()=>{
  near(FOREST_MERGE_TAIL.length,41.25);
  const shared=new OpenRoad(FOREST_MERGE_TAIL_POINTS,[0,0,-1],[0,0,-1]);
  for(const id of ['alley','boulevard'] as const){
    const base=new OpenRoad(FOREST_POINTS[id],[0,0,1],[0,0,-1]),edge=c.edges[id];
    near(base.length+shared.length,edge.length);
    for(let s=0;s<=edge.length;s+=.5)for(const lateral of [-9.5,0,9.5]){
      const reference=s<=base.length?base.sample(s,lateral):shared.sample(s-base.length,lateral);
      for(const key of frames)near(edge.sample(s,lateral)[key].distance(reference[key]),0);
    }
    for(const lateral of [-9.5,-5,0,5,9.5]){
      const a=base.sample(base.length,lateral),b=shared.sample(0,lateral);
      for(const key of frames)near(a[key].distance(b[key]),0);
    }
    near(FOREST_ROADS[id].length,edge.length);
  }
});

test('97.5m decision approach stays exactly straight, level and unbanked across the full input zone',()=>{
  near(FOREST_DECISION_APPROACH_LENGTH,97.5);assert.ok(FOREST_DECISION_APPROACH_LENGTH>80);
  const end=c.commonStart.sample(c.commonStart.length);
  for(let remaining=0;remaining<=FOREST_DECISION_APPROACH_LENGTH;remaining+=.125){
    const s=c.commonStart.length-remaining;
    for(const lateral of [-9.5,-5,0,5,9.5]){
      const sample=c.commonStart.sample(s,lateral),atSplit=c.commonStart.sample(c.commonStart.length,lateral);
      near(sample.p.x,atSplit.p.x);near(sample.p.y,34);near(atSplit.p.z-sample.p.z,remaining);
      near(sample.t.distance(end.t),0);near(sample.n.distance(end.n),0);near(sample.normal.distance(end.normal),0);
      near(sample.bank,0);near(sample.grade,0);
    }
    near(c.commonStart.halfWidthAt(s),9.5);near(c.commonStart.laneLimitAt(s),8.85);
  }
});

test('all five graph seams retain identical full-width supported frames',()=>{
  for(const [a,b] of [[c.edges.start,c.edges.alley],[c.edges.start,c.edges.boulevard],[c.edges.alley,c.edges.finish],[c.edges.boulevard,c.edges.finish],[c.edges.finish,c.edges.start]]){
    for(const lateral of [-9.5,-5,0,5,9.5]){
      const x=a.sample(a.length,lateral),y=b.sample(0,lateral);
      for(const key of frames)near(x[key].distance(y[key]),0);
      near(x.grade,y.grade);near(x.bank,y.bank);
    }
    near(a.halfWidthAt(a.length),b.halfWidthAt(0));near(a.laneLimitAt(a.length),b.laneLimitAt(0));
    assert.deepEqual(a.surfaceAt(a.length),b.surfaceAt(0));
  }
  for(const [frame,landmark] of [[c.commonStart.sample(c.commonStart.length),FOREST_LANDMARKS.split],[c.commonFinish.sample(0),FOREST_LANDMARKS.merge]] as const){
    near(frame.p.x,landmark.x);near(frame.p.y,landmark.y);near(frame.p.z,landmark.z);
  }
});

test('dense physical support preserves measured grade, bank, width, curvature and orthonormal frames',()=>{
  const limits:Record<RouteEdgeId,{radius:number;inner:number;grade:number;outerGrade:number}>= {
    start:{radius:22.899,inner:13.399,grade:.06613,outerGrade:.09497},
    alley:{radius:19.546,inner:11.244,grade:1e-10,outerGrade:1e-10},
    boulevard:{radius:94.875,inner:85.375,grade:1e-10,outerGrade:1e-10},
    finish:{radius:33.357,inner:23.857,grade:.08999,outerGrade:.09633},
  };
  let minimumY=Infinity,maximumY=-Infinity;
  for(const edge of FOREST_ROAD_EDGES){
    let minRadius=Infinity,minInner=Infinity,maxGrade=0,maxOuterGrade=0,maxBank=0,maxBankChange=0,maxWidthChange=0,minWidth=Infinity,maxWidth=0;
    for(let s=0;;s=Math.min(edge.length,s+.25)){
      const f=edge.sample(s),width=edge.halfWidthAt(s),ns=Math.min(s+.25,edge.length),next=edge.sample(ns),span=ns-s;
      for(const key of frames)assert.ok([f[key].x,f[key].y,f[key].z].every(Number.isFinite),`${edge.id}/${s}/${key}`);
      for(const key of ['t','n','normal'] as const)near(f[key].length(),1,1e-12);
      near(f.t.dot(f.n),0,1e-12);near(f.t.dot(f.normal),0,1e-12);near(f.n.dot(f.normal),0,1e-12);
      near(f.grade,f.t.y/Math.hypot(f.t.x,f.t.z));assert.ok(f.normal.y>.98);
      if(span>1e-8){
        const turn=Math.abs(Math.atan2(f.t.z*next.t.x-f.t.x*next.t.z,f.t.x*next.t.x+f.t.z*next.t.z));
        if(turn>0){minRadius=Math.min(minRadius,span/turn);minInner=Math.min(minInner,span/turn-width);}
        maxBankChange=Math.max(maxBankChange,Math.abs(next.bank-f.bank)/span);
        maxWidthChange=Math.max(maxWidthChange,Math.abs(edge.halfWidthAt(ns)-width)/span);
        for(const sign of [-1,1]){
          const a=edge.sample(s,sign*width).p,b=edge.sample(ns,sign*edge.halfWidthAt(ns)).p;
          maxOuterGrade=Math.max(maxOuterGrade,Math.abs(b.y-a.y)/Math.hypot(b.x-a.x,b.z-a.z));
        }
      }
      maxGrade=Math.max(maxGrade,Math.abs(f.grade));maxBank=Math.max(maxBank,Math.abs(f.bank));
      minWidth=Math.min(minWidth,width);maxWidth=Math.max(maxWidth,width);near(edge.laneLimitAt(s),width-.65);
      for(const lateral of [-width,-edge.laneLimitAt(s),0,edge.laneLimitAt(s),width]){
        const support=edge.sample(s,lateral);
        near(support.p.distance(f.p),Math.abs(lateral));near(support.p.y-f.p.y,f.n.y*lateral);
        minimumY=Math.min(minimumY,support.p.y);maximumY=Math.max(maximumY,support.p.y);
      }
      if(s===edge.length)break;
    }
    assert.ok(minRadius>limits[edge.id].radius,`${edge.id}: radius ${minRadius}`);
    assert.ok(minInner>limits[edge.id].inner,`${edge.id}: inside radius ${minInner}`);
    assert.ok(maxGrade<=limits[edge.id].grade,`${edge.id}: grade ${maxGrade}`);
    assert.ok(maxOuterGrade<=limits[edge.id].outerGrade,`${edge.id}: outer grade ${maxOuterGrade}`);
    near(minWidth,edge.id==='alley'?5.2:9.5);near(maxWidth,edge.id==='start'?11.2:9.5);
    near(maxBank,edge.id==='start'?.14:0);assert.ok(maxBankChange<=.0028);assert.ok(maxWidthChange<=.092143);
  }
  near(minimumY,7.8537489106558525);near(maximumY,36.08950085609975);
  assert.ok(maximumY-minimumY>28,'physical support must carry the elevation, not decoration');
});

test('bowl banking rotates real support and eases off before the decision approach',()=>{
  for(const s of [605,620,650,680,750,850,900,920,935]){
    const source=FOREST_ROADS.start.sample(s),edge=c.commonStart,f=edge.sample(s),w=edge.halfWidthAt(s);
    near(f.t.distance(source.t),0);near(f.p.distance(source.p),0);
    near(f.n.dot(source.n),Math.cos(f.bank));near(f.normal.dot(source.normal),Math.cos(f.bank));
    near(edge.sample(s,w).p.y-edge.sample(s,-w).p.y,2*w*f.n.y);
  }
  const bowl=c.commonStart.sample(750),width=c.commonStart.halfWidthAt(750);
  near(bowl.bank,-.14);near(Math.abs(bowl.bank)*180/Math.PI,8.021409131831525);
  assert.ok(Math.abs(c.commonStart.sample(750,width).p.y-c.commonStart.sample(750,-width).p.y)>3.1);
  near(c.commonStart.sample(605).bank,0);near(c.commonStart.sample(935).bank,0);
});

test('compatibility loop is exactly start + rim + finish, including seams and wrapping',()=>{
  let offset=0;
  for(const edge of [c.commonStart,c.alternates.boulevard,c.commonFinish]){
    for(let s=0;s<edge.length;s+=2.25)for(const lateral of [-8.85,0,8.85]){
      const source=edge.sample(s,lateral),legacy=FOREST_TRACK.sample(offset+s,lateral);
      for(const key of frames)near(source[key].distance(legacy[key]),0,1e-9);
      near(source.bank,legacy.bank);near(source.grade,legacy.grade);
      near(FOREST_TRACK.halfWidthAt(offset+s),edge.halfWidthAt(s));
      near(FOREST_TRACK.laneLimitAt(offset+s),edge.laneLimitAt(s));
      assert.deepEqual(FOREST_TRACK.surfaceAt(offset+s),edge.surfaceAt(s));near(legacy.u,(offset+s)/FOREST_TRACK.length);
    }
    offset+=edge.length;
  }
  for(const s of [-FOREST_TRACK.length*3,-1,0,1,FOREST_TRACK.length,FOREST_TRACK.length*4+12.5]){
    for(const key of frames)near(FOREST_TRACK.sample(s)[key].distance(FOREST_TRACK.sample(s+FOREST_TRACK.length)[key]),0,1e-9);
    assert.ok(Number.isFinite(FOREST_TRACK.circuit.curvature(s)));
  }
  for(const value of [NaN,Infinity,-Infinity]){
    near(FOREST_TRACK.sample(value).p.distance(FOREST_TRACK.sample(0).p),0);
    for(const edge of FOREST_ROAD_EDGES){
      near(edge.sample(value,NaN).p.distance(edge.sample(0).p),0);near(edge.sample(value).bank,0);
      near(edge.halfWidthAt(value),edge.halfWidthAt(0));assert.deepEqual(edge.surfaceAt(value),edge.surfaceAt(0));
    }
  }
});

test('service taper and ordinary surface properties match the measured source profiles',()=>{
  const service=c.edges.alley,tailStart=service.length-FOREST_MERGE_TAIL.length;
  near(service.halfWidthAt(0),9.5);near(service.halfWidthAt(70),5.2);
  near(service.halfWidthAt(tailStart-70),5.2);near(service.halfWidthAt(tailStart),9.5);
  const earth={kind:'cedar-packed-earth',grip:.99,rollingResistance:1.025};
  const stone={kind:'observatory-service-stone',grip:.97,rollingResistance:1.035};
  for(const s of [0,70,tailStart-70,tailStart,service.length])assert.deepEqual(service.surfaceAt(s),earth);
  for(const s of [70.001,100,tailStart-70-.001])assert.deepEqual(service.surfaceAt(s),stone);
  for(const edge of FOREST_ROAD_EDGES){
    assert.deepEqual(Object.keys(edge).sort(),['id','length','sample','halfWidthAt','laneLimitAt','surfaceAt'].sort());
    for(let s=0;s<=edge.length;s+=10)if(edge.id!=='alley')assert.deepEqual(edge.surfaceAt(s),earth);
  }
});

test('crossing metadata identifies physical decks and clearance includes every branch',()=>{
  const crossing=FOREST_LANDMARKS.crossing;
  const lower=c.edges[crossing.lowerEdge].sample(crossing.lowerS),upper=c.edges[crossing.upperEdge].sample(crossing.upperS);
  near(lower.p.x,crossing.x);near(lower.p.z,crossing.z);near(upper.p.x,crossing.x);near(upper.p.z,crossing.z);
  near(lower.p.y,12);near(upper.p.y,36);near(upper.p.y-lower.p.y,24);
  for(const edge of FOREST_ROAD_EDGES)for(let s=0;s<edge.length;s+=7){
    for(const lateral of [-edge.halfWidthAt(s),0,edge.halfWidthAt(s)]){
      const p=edge.sample(s,lateral).p;assert.equal(FOREST_TRACK.clearAt(p.x,p.z),false);
    }
  }
  assert.equal(FOREST_TRACK.clearAt(1000,1000,10),true);
  assert.equal(FOREST_TRACK.clearAt(NaN,100),false);assert.equal(FOREST_TRACK.clearAt(100,100,Infinity),false);
});
