import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {OpenRoad} from '../src/open-road';
import {SNOW_COURSE as c,SNOW_META,SNOW_TRACK,SNOW_ROAD_EDGES,SNOW_LANDMARKS,SNOW_POINTS,SNOW_ROADS,SNOW_MERGE_TAIL,SNOW_MERGE_TAIL_POINTS,SNOW_DECISION_APPROACH_LENGTH} from '../src/maps/snow';
import type {RouteEdgeId} from '../src/land-routes';

const near=(a:number,b:number,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b} (tolerance ${t})`);
const frames=['p','t','n','normal'] as const;
const expectedLengths={start:1804.37166902813,alley:518.3166696310494,boulevard:568.5820115628107,finish:1212.2364284845742};

test('snow preserves original opposing snow bowls, stepped return and positive-lateral service choice',()=>{
  assert.equal(c.id,'snow');assert.equal(SNOW_META.label,'霜环雪站');assert.equal(SNOW_META.tag,'FROSTLOOP DEPOT');
  for(const edge of SNOW_ROAD_EDGES)near(edge.length,expectedLengths[edge.id]);
  near(c.canonicalLength,3585.1901090755155);
  near(c.commonStart.length+c.alternates.alley.length+c.commonFinish.length,3534.9247671437533);
  near(c.alternates.boulevard.length-c.alternates.alley.length,50.26534193176133);
  const n=c.commonStart.sample(c.commonStart.length).n;
  for(const [s,separation] of [[10,2.0983151636173147],[20,7.683388229054856],[40,24.893933455873764],[60,44.704437215012206],[80,61.98589935980712],[110,73.51684309037236]]){
    near(c.edges.alley.sample(s).p.sub(c.edges.boulevard.sample(s).p).dot(n),separation);
  }
  assert.equal(c.presentation?.branchLabels.alley,'机修折径');assert.equal(c.presentation?.branchLabels.boulevard,'雪台外环');
  assert.deepEqual(Object.keys(SNOW_POINTS),['start','alley','boulevard','finish']);
  assert.deepEqual(SNOW_POINTS.start.at(-2),[260,18,-240]);assert.deepEqual(SNOW_POINTS.start.at(-1),[260,18,-350]);
  for(const points of Object.values(SNOW_POINTS)){assert.ok(Object.isFrozen(points));for(const p of points)assert.ok(Object.isFrozen(p));}
});

test('branch source samplers append a separately sampled common 40m tail without a new spline fit',()=>{
  near(SNOW_MERGE_TAIL.length,40);
  const tail=new OpenRoad(SNOW_MERGE_TAIL_POINTS,[0,0,-1],[0,0,-1]);
  for(const id of ['alley','boulevard'] as const){
    const base=new OpenRoad(SNOW_POINTS[id],[0,0,-1],[0,0,-1]),road=SNOW_ROADS[id];
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
  assert.equal(SNOW_DECISION_APPROACH_LENGTH,100);assert.ok(SNOW_DECISION_APPROACH_LENGTH>80);
  const end=c.commonStart.sample(c.commonStart.length);
  for(let remaining=0;remaining<=SNOW_DECISION_APPROACH_LENGTH;remaining+=.125){
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
  for(const [frame,landmark] of [[c.commonStart.sample(c.commonStart.length),SNOW_LANDMARKS.split],[c.commonFinish.sample(0),SNOW_LANDMARKS.merge]] as const){
    near(frame.p.x,landmark.x);near(frame.p.y,landmark.y);near(frame.p.z,landmark.z);
  }
});

test('dense full-width support preserves measured grades, inside radii, camber and forward ribbons',()=>{
  const limits:Record<RouteEdgeId,{radius:number;inner:number;grade:number;outerGrade:number}>= {
    start:{radius:37.4213,inner:27.9213,grade:.079211,outerGrade:.089385},
    alley:{radius:29.6660,inner:23.8660,grade:1e-10,outerGrade:1e-10},
    boulevard:{radius:59.4860,inner:49.9860,grade:1e-10,outerGrade:.010298},
    finish:{radius:31.5040,inner:22.0040,grade:.050048,outerGrade:.053266},
  };
  let minimumY=Infinity,maximumY=-Infinity;
  for(const edge of SNOW_ROAD_EDGES){
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
    near(minWidth,edge.id==='alley'?5.8:9.5);near(maxWidth,9.5);near(maxBank,edge.id==='start'||edge.id==='boulevard'?.045:edge.id==='finish'?.032:0);
    assert.ok(maxBankChange<.00104);assert.ok(maxWidthChange<.080);assert.ok(minForward>.698,'full-width ribbon cannot fold along an inside edge');
  }
  near(minimumY,13.696051919588237);near(maximumY,35.658404318588296);assert.ok(maximumY-minimumY>21);
});

test('opposing bowl banks and broad terrace camber rotate physical support and ease off at seams',()=>{
  for(const [id,distances] of [['start',[120,150,185,300,505,570,600,630,665,900,1040,1070,1100,1135,1400,1530]],['boulevard',[100,130,165,220,355,390,420]],['finish',[100,140,180,300,470,510,550]]] as const){
    for(const s of distances){
      const source=SNOW_ROADS[id].sample(s),edge=c.edges[id],f=edge.sample(s),w=edge.halfWidthAt(s);
      near(f.t.distance(source.t),0);near(f.p.distance(source.p),0);near(f.n.dot(source.n),Math.cos(f.bank));near(f.normal.dot(source.normal),Math.cos(f.bank));
      near(edge.sample(s,w).p.y-edge.sample(s,-w).p.y,2*w*f.n.y);
    }
  }
  near(c.commonStart.sample(300).bank,.045);near(c.commonStart.sample(900).bank,-.045);near(c.commonStart.sample(1400).bank,.042);
  near(c.edges.boulevard.sample(220).bank,-.045);near(c.edges.finish.sample(300).bank,-.032);
  assert.ok(Math.abs(c.commonStart.sample(300,9.5).p.y-c.commonStart.sample(300,-9.5).p.y)>.85);
  for(const s of [0,120,570,600,1040,1070,1530,c.commonStart.length])near(c.commonStart.sample(s).bank,0);
});

test('compatibility loop matches exact sweep-route support, wrapping and bounded invalid inputs',()=>{
  let offset=0;
  for(const edge of [c.commonStart,c.alternates.boulevard,c.commonFinish]){
    for(let s=0;s<edge.length;s+=2.25)for(const lateral of [-8.85,0,8.85]){
      const source=edge.sample(s,lateral),legacy=SNOW_TRACK.sample(offset+s,lateral);
      for(const key of frames)near(source[key].distance(legacy[key]),0,1e-9);
      near(source.bank,legacy.bank);near(source.grade,legacy.grade);near(SNOW_TRACK.halfWidthAt(offset+s),edge.halfWidthAt(s));near(SNOW_TRACK.laneLimitAt(offset+s),edge.laneLimitAt(s));
      assert.deepEqual(SNOW_TRACK.surfaceAt(offset+s),edge.surfaceAt(s));near(legacy.u,(offset+s)/SNOW_TRACK.length);
    }
    offset+=edge.length;
  }
  for(const s of [-SNOW_TRACK.length*3,-1,0,1,SNOW_TRACK.length,SNOW_TRACK.length*4+12.5]){
    for(const key of frames)near(SNOW_TRACK.sample(s)[key].distance(SNOW_TRACK.sample(s+SNOW_TRACK.length)[key]),0,1e-9);
    assert.ok(Number.isFinite(SNOW_TRACK.circuit.curvature(s)));
  }
  for(const value of [NaN,Infinity,-Infinity]){
    near(SNOW_TRACK.sample(value).p.distance(SNOW_TRACK.sample(0).p),0);
    for(const edge of SNOW_ROAD_EDGES){near(edge.sample(value,NaN).p.distance(edge.sample(0).p),0);near(edge.sample(value).bank,0);near(edge.halfWidthAt(value),edge.halfWidthAt(0));assert.deepEqual(edge.surfaceAt(value),edge.surfaceAt(0));}
  }
});

test('service-cut taper and surface channels supply ordinary grip and rolling resistance, no speed multiplier',()=>{
  const archway=c.edges.alley,tailStart=archway.length-SNOW_MERGE_TAIL.length;
  near(archway.halfWidthAt(0),9.5);near(archway.halfWidthAt(70),5.8);near(archway.halfWidthAt(tailStart-70),5.8);near(archway.halfWidthAt(tailStart),9.5);
  const earth={kind:'snow-packed-snow-road',grip:.975,rollingResistance:1.018},pavers={kind:'snow-stone-service-paving',grip:.94,rollingResistance:1.045};
  for(const s of [0,80,tailStart-80,tailStart,archway.length])assert.deepEqual(archway.surfaceAt(s),earth);
  for(const s of [80.001,100,tailStart-80-.001])assert.deepEqual(archway.surfaceAt(s),pavers);
  for(const edge of SNOW_ROAD_EDGES){
    assert.deepEqual(Object.keys(edge).sort(),['id','length','sample','halfWidthAt','laneLimitAt','surfaceAt'].sort());
    for(let s=0;s<=edge.length;s+=10)if(edge.id!=='alley')assert.deepEqual(edge.surfaceAt(s),earth);
  }
});

test('compatibility clearance includes both branches and every full-width physical edge',()=>{
  for(const edge of SNOW_ROAD_EDGES)for(let s=0;s<edge.length;s+=7){
    for(const lateral of [-edge.halfWidthAt(s),0,edge.halfWidthAt(s)]){const p=edge.sample(s,lateral).p;assert.equal(SNOW_TRACK.clearAt(p.x,p.z),false);}
  }
  assert.equal(SNOW_TRACK.clearAt(1000,1000,10),true);assert.equal(SNOW_TRACK.clearAt(NaN,100),false);assert.equal(SNOW_TRACK.clearAt(100,100,Infinity),false);
});


test('production full-width geometry retains its measured prototype fingerprint and checkpoint layout',()=>{
  // Independent prototype capture: 82,100 physical frames at0.25m steps,
  // rounded only for stable serialization. Direct migration parity is exact.
  const hash=createHash('sha256');let samples=0;
  for(const edge of SNOW_ROAD_EDGES){
    hash.update(edge.id);
    for(let s=0;;s=Math.min(edge.length,s+.25)){
      const width=edge.halfWidthAt(s),lane=edge.laneLimitAt(s),surface=edge.surfaceAt(s);
      for(const lateral of [-width,-lane,0,lane,width]){
        const f=edge.sample(s,lateral),values=[s,lateral,...frames.flatMap(k=>f[k].toArray()),f.bank,f.grade,width,lane,surface.grip,surface.rollingResistance];
        hash.update(values.map(v=>v.toFixed(9)).join(',')+';'+surface.kind+'\n');samples++;
      }
      if(s===edge.length)break;
    }
  }
  hash.update(JSON.stringify(c.checkpointGates));
  assert.equal(samples,82100);assert.equal(hash.digest('hex'),'1f5ababd2569701d608d0fb93aae465e49739d6388aae9f8c15a74b01f5e84b2');
  assert.deepEqual(c.checkpointGates.map(g=>[g.index,g.edgeId,g.s]),[[0,"start",523.2677840181577],[1,"start",1623.934502125317],[2,"alley",165.86133428193583],[3,"alley",393.9206689195976],[2,"boulevard",181.94624370009944],[3,"boulevard",432.1223287877362],[4,"finish",145.4683714181489],[5,"finish",472.77220710898393],[6,"finish",884.9325927937391],[7,"finish",1212.2364284845742]]);
});
