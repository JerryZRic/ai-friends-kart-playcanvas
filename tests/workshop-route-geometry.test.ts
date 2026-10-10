import test from 'node:test';
import assert from 'node:assert/strict';
import {OpenRoad} from '../src/open-road';
import {WORKSHOP_COURSE as c,WORKSHOP_META,WORKSHOP_TRACK,WORKSHOP_ROAD_EDGES,WORKSHOP_LANDMARKS,WORKSHOP_POINTS,WORKSHOP_ROADS,WORKSHOP_MERGE_TAIL,WORKSHOP_MERGE_TAIL_POINTS,WORKSHOP_SPOOL,WORKSHOP_DECISION_APPROACH_LENGTH} from '../src/maps/workshop';
import type {RouteEdgeId} from '../src/land-routes';

const near=(a:number,b:number,t=1e-8) => assert.ok(Math.abs(a-b)<=t,`${a} != ${b} (tolerance ${t})`);
const frames=['p','t','n','normal'] as const;
const expectedLengths={start:1453.8222121229105,alley:367.4336910791745,boulevard:416.87525123740556,finish:771.1308234841844};

test('workshop preserves the original measured physical routes and branch intent',()=>{
  assert.equal(c.id,'workshop');
  assert.equal(WORKSHOP_META.label,'发条工坊回旋道');assert.equal(WORKSHOP_META.tag,'CLOCKWIND WORKSHOP');
  for(const edge of WORKSHOP_ROAD_EDGES)near(edge.length,expectedLengths[edge.id]);
  near(c.canonicalLength,2641.8282868445003);
  near(c.commonStart.length+c.alternates.alley.length+c.commonFinish.length,2592.3867266862694);
  near(c.alternates.boulevard.length-c.alternates.alley.length,49.441560158231084);
  const n=c.commonStart.sample(c.commonStart.length).n;
  for(const [s,separation] of [[10,.30514877903004844],[20,1.1439977668490826],[40,4.115778214722141],[60,7.25783203657393],[80,9.694635858171338],[110,15.74702591047459]]){
    near(c.edges.alley.sample(s).p.sub(c.edges.boulevard.sample(s).p).dot(n),separation);
  }
  assert.equal(c.presentation?.branchLabels.alley,'工具柜弯道');
  assert.equal(c.presentation?.branchLabels.boulevard,'木台外沿');
  assert.deepEqual(Object.keys(WORKSHOP_POINTS),['start','alley','boulevard','finish']);
  assert.deepEqual(WORKSHOP_POINTS.start.at(-2),[160,36,-70]);
  assert.deepEqual(WORKSHOP_POINTS.start.at(-1),[260,36,-70]);
});

test('branch source samplers append the exact same separately sampled 40m tail',()=>{
  near(WORKSHOP_MERGE_TAIL.length,40);
  const shared=new OpenRoad(WORKSHOP_MERGE_TAIL_POINTS,[-1,0,0],[-1,0,0]);
  for(const id of ['alley','boulevard'] as const){
    const base=new OpenRoad(WORKSHOP_POINTS[id],[1,0,0],[-1,0,0]),edge=c.edges[id];
    near(base.length+shared.length,edge.length);
    for(let s=0;s<=edge.length;s+=.5)for(const lateral of [-9.5,0,9.5]){
      const reference=s<=base.length?base.sample(s,lateral):shared.sample(s-base.length,lateral);
      for(const key of frames)near(edge.sample(s,lateral)[key].distance(reference[key]),0);
    }
    for(const lateral of [-9.5,-5,0,5,9.5]){
      const a=base.sample(base.length,lateral),b=shared.sample(0,lateral);
      for(const key of frames)near(a[key].distance(b[key]),0);
    }
    near(WORKSHOP_ROADS[id].length,edge.length);
  }
});

test('200m decision approach stays exactly straight, level and unbanked across the full input zone',()=>{
  near(WORKSHOP_DECISION_APPROACH_LENGTH,200);assert.ok(WORKSHOP_DECISION_APPROACH_LENGTH>80);
  const end=c.commonStart.sample(c.commonStart.length);
  for(let remaining=0;remaining<=WORKSHOP_DECISION_APPROACH_LENGTH;remaining+=.125){
    const s=c.commonStart.length-remaining;
    for(const lateral of [-9.5,-5,0,5,9.5]){
      const sample=c.commonStart.sample(s,lateral),atSplit=c.commonStart.sample(c.commonStart.length,lateral);
      near(sample.p.z,atSplit.p.z);near(sample.p.y,36);near(atSplit.p.x-sample.p.x,remaining);
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
  for(const [frame,landmark] of [[c.commonStart.sample(c.commonStart.length),WORKSHOP_LANDMARKS.split],[c.commonFinish.sample(0),WORKSHOP_LANDMARKS.merge]] as const){
    near(frame.p.x,landmark.x);near(frame.p.y,landmark.y);near(frame.p.z,landmark.z);
  }
});

test('dense physical support preserves measured grade, bank, width, curvature and orthonormal frames',()=>{
  const limits:Record<RouteEdgeId,{radius:number;inner:number;grade:number;outerGrade:number}>= {
    start:{radius:31.172,inner:21.672,grade:.05649,outerGrade:.07596},
    alley:{radius:19.348,inner:13.948,grade:1e-10,outerGrade:1e-10},
    boulevard:{radius:112.402,inner:102.902,grade:1e-10,outerGrade:1e-10},
    finish:{radius:27.258,inner:17.758,grade:.072462,outerGrade:.07304},
  };
  let minimumY=Infinity,maximumY=-Infinity;
  for(const edge of WORKSHOP_ROAD_EDGES){
    let minRadius=Infinity,minInner=Infinity,maxGrade=0,maxOuterGrade=0,maxBank=0,maxBankChange=0,maxWidthChange=0,minWidth=Infinity,maxWidth=0,minForward=Infinity;
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
          minForward=Math.min(minForward,b.clone().sub(a).dot(f.t)/span);
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
    near(minWidth,edge.id==='alley'?5.4:9.5);near(maxWidth,9.5);
    near(maxBank,edge.id==='start'?.10:0);assert.ok(maxBankChange<=.002308);assert.ok(maxWidthChange<=.094615);
    assert.ok(minForward>.65,`${edge.id}: road ribbon must not fold at an inside edge (${minForward})`);
  }
  near(minimumY,7.864451533913854);near(maximumY,36.25369622631135);
  assert.ok(maximumY-minimumY>28,'physical support must carry the elevation, not decoration');
});

test('spool climbs continuously through 270 physical degrees and 24 metres of actual support',()=>{
  const {center,radius,fromS,toS,fromDegrees,toDegrees}=WORKSHOP_SPOOL;
  assert.equal(toDegrees-fromDegrees,270);assert.equal(WORKSHOP_SPOOL.knots,10);
  near(toS-fromS,518.1740043982317);
  const first=c.commonStart.sample(fromS),last=c.commonStart.sample(toS);
  near(last.p.y-first.p.y,24);near(first.p.y,12);near(last.p.y,36);
  let previousAngle=fromDegrees*Math.PI/180,sweep=0,minRadius=Infinity,maxRadius=0,minGrade=Infinity,maxGrade=0;
  for(let s:number=fromS;;s=Math.min(toS,s+.25)){
    const frame=c.commonStart.sample(s),dx=frame.p.x-center[0],dz=frame.p.z-center[1];
    const angle=Math.atan2(dz,dx),delta=Math.atan2(Math.sin(angle-previousAngle),Math.cos(angle-previousAngle));
    assert.ok(delta>=-1e-10&&delta<.003,'every sample moves forward around the spool');
    sweep+=delta;previousAngle=angle;
    minRadius=Math.min(minRadius,Math.hypot(dx,dz));maxRadius=Math.max(maxRadius,Math.hypot(dx,dz));
    minGrade=Math.min(minGrade,frame.grade);maxGrade=Math.max(maxGrade,frame.grade);
    if(s===toS)break;
  }
  near(sweep,Math.PI*1.5);assert.ok(minRadius>107.48);near(maxRadius,radius);
  assert.ok(minGrade>.017&&maxGrade<.05649,`height rises continuously through real sampled grade (${minGrade} to ${maxGrade})`);
});

test('spool banking rotates real support and eases off before the decision approach',()=>{
  for(const s of [580,600,625,645,750,950,1030,1060,1080]){
    const source=WORKSHOP_ROADS.start.sample(s),edge=c.commonStart,f=edge.sample(s),w=edge.halfWidthAt(s);
    near(f.t.distance(source.t),0);near(f.p.distance(source.p),0);
    near(f.n.dot(source.n),Math.cos(f.bank));near(f.normal.dot(source.normal),Math.cos(f.bank));
    near(edge.sample(s,w).p.y-edge.sample(s,-w).p.y,2*w*f.n.y);
  }
  const spool=c.commonStart.sample(750),width=c.commonStart.halfWidthAt(750);
  near(spool.bank,.10);near(Math.abs(spool.bank)*180/Math.PI,5.729577951308232);
  assert.ok(Math.abs(c.commonStart.sample(750,width).p.y-c.commonStart.sample(750,-width).p.y)>1.8);
  near(c.commonStart.sample(580).bank,0);near(c.commonStart.sample(1080).bank,0);
});

test('compatibility loop is exactly start + rim + finish, including seams and wrapping',()=>{
  let offset=0;
  for(const edge of [c.commonStart,c.alternates.boulevard,c.commonFinish]){
    for(let s=0;s<edge.length;s+=2.25)for(const lateral of [-8.85,0,8.85]){
      const source=edge.sample(s,lateral),legacy=WORKSHOP_TRACK.sample(offset+s,lateral);
      for(const key of frames)near(source[key].distance(legacy[key]),0,1e-9);
      near(source.bank,legacy.bank);near(source.grade,legacy.grade);
      near(WORKSHOP_TRACK.halfWidthAt(offset+s),edge.halfWidthAt(s));
      near(WORKSHOP_TRACK.laneLimitAt(offset+s),edge.laneLimitAt(s));
      assert.deepEqual(WORKSHOP_TRACK.surfaceAt(offset+s),edge.surfaceAt(s));near(legacy.u,(offset+s)/WORKSHOP_TRACK.length);
    }
    offset+=edge.length;
  }
  for(const s of [-WORKSHOP_TRACK.length*3,-1,0,1,WORKSHOP_TRACK.length,WORKSHOP_TRACK.length*4+12.5]){
    for(const key of frames)near(WORKSHOP_TRACK.sample(s)[key].distance(WORKSHOP_TRACK.sample(s+WORKSHOP_TRACK.length)[key]),0,1e-9);
    assert.ok(Number.isFinite(WORKSHOP_TRACK.circuit.curvature(s)));
  }
  for(const value of [NaN,Infinity,-Infinity]){
    near(WORKSHOP_TRACK.sample(value).p.distance(WORKSHOP_TRACK.sample(0).p),0);
    for(const edge of WORKSHOP_ROAD_EDGES){
      near(edge.sample(value,NaN).p.distance(edge.sample(0).p),0);near(edge.sample(value).bank,0);
      near(edge.halfWidthAt(value),edge.halfWidthAt(0));assert.deepEqual(edge.surfaceAt(value),edge.surfaceAt(0));
    }
  }
});

test('cabinet taper and ordinary surface properties match the measured source profiles',()=>{
  const cabinet=c.edges.alley,tailStart=cabinet.length-WORKSHOP_MERGE_TAIL.length;
  near(cabinet.halfWidthAt(0),9.5);near(cabinet.halfWidthAt(65),5.4);
  near(cabinet.halfWidthAt(tailStart-65),5.4);near(cabinet.halfWidthAt(tailStart),9.5);
  const wood={kind:'workshop-sealed-wood',grip:.99,rollingResistance:1.02};
  const inlay={kind:'workshop-cabinet-inlay',grip:.96,rollingResistance:1.035};
  for(const s of [0,65,tailStart-65,tailStart,cabinet.length])assert.deepEqual(cabinet.surfaceAt(s),wood);
  for(const s of [65.001,100,tailStart-65-.001])assert.deepEqual(cabinet.surfaceAt(s),inlay);
  for(const edge of WORKSHOP_ROAD_EDGES){
    assert.deepEqual(Object.keys(edge).sort(),['id','length','sample','halfWidthAt','laneLimitAt','surfaceAt'].sort());
    for(let s=0;s<=edge.length;s+=10)if(edge.id!=='alley')assert.deepEqual(edge.surfaceAt(s),wood);
  }
});

test('crossing metadata identifies physical decks and clearance includes every branch',()=>{
  const crossing=WORKSHOP_LANDMARKS.crossing;
  const lower=c.edges[crossing.lowerEdge].sample(crossing.lowerS),upper=c.edges[crossing.upperEdge].sample(crossing.upperS);
  near(lower.p.x,crossing.x);near(lower.p.z,crossing.z);near(upper.p.x,crossing.x);near(upper.p.z,crossing.z);
  near(lower.p.y,9.341319609435596);near(upper.p.y,36);near(upper.p.y-lower.p.y,26.658680390564406);
  assert.equal(crossing.lowerEdge,crossing.upperEdge);assert.ok(crossing.upperS-crossing.lowerS>780);
  for(const edge of WORKSHOP_ROAD_EDGES)for(let s=0;s<edge.length;s+=7){
    for(const lateral of [-edge.halfWidthAt(s),0,edge.halfWidthAt(s)]){
      const p=edge.sample(s,lateral).p;assert.equal(WORKSHOP_TRACK.clearAt(p.x,p.z),false);
    }
  }
  assert.equal(WORKSHOP_TRACK.clearAt(1000,1000,10),true);
  assert.equal(WORKSHOP_TRACK.clearAt(NaN,100),false);assert.equal(WORKSHOP_TRACK.clearAt(100,100,Infinity),false);
});
