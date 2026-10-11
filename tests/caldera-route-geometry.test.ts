import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {OpenRoad} from '../src/open-road';
import {CALDERA_COURSE as c,CALDERA_META,CALDERA_TRACK,CALDERA_ROAD_EDGES,CALDERA_LANDMARKS,CALDERA_POINTS,CALDERA_ROADS,CALDERA_MERGE_TAIL,CALDERA_MERGE_TAIL_POINTS,CALDERA_DECISION_APPROACH_LENGTH} from '../src/maps/caldera';
import type {RouteEdgeId} from '../src/land-routes';

const near=(a:number,b:number,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b} (tolerance ${t})`);
const frames=['p','t','n','normal'] as const;
const expectedLengths={"start": 2053.6082776162234, "alley": 447.17967920091735, "boulevard": 508.3571694625006, "finish": 1176.049829985537};

test('caldera preserves its asymmetric high rim, lower hooked bowl and positive-lateral Jointline Cut',()=>{
  assert.equal(c.id,'caldera');assert.equal(CALDERA_META.label,'玄岩环冕');assert.equal(CALDERA_META.tag,'BASALT CROWN');
  for(const edge of CALDERA_ROAD_EDGES)near(edge.length,expectedLengths[edge.id]);
  near(c.canonicalLength,3738.0152770642608);
  near(c.commonStart.length+c.alternates.alley.length+c.commonFinish.length,3676.8377868026773);
  near(c.alternates.boulevard.length-c.alternates.alley.length,61.17749026158327);
  const n=c.commonStart.sample(c.commonStart.length).n;
  for(const [s,separation] of [[10, 2.5945608647974723], [20, 9.390333203518196], [40, 29.617042160652886], [60, 52.186071310820466], [80, 70.99169201098712], [110, 83.07002548719481]]){
    near(c.edges.alley.sample(s).p.sub(c.edges.boulevard.sample(s).p).dot(n),separation);
  }
  assert.equal(c.presentation?.branchLabels.alley,'裂岩内径');assert.equal(c.presentation?.branchLabels.boulevard,'灰台缓弧');
  assert.deepEqual(Object.keys(CALDERA_POINTS),['start','alley','boulevard','finish']);
  assert.deepEqual(CALDERA_POINTS.start.at(-2),[-275,14,-150]);assert.deepEqual(CALDERA_POINTS.start.at(-1),[-275,14,-260]);
  for(const points of Object.values(CALDERA_POINTS)){assert.ok(Object.isFrozen(points));for(const p of points)assert.ok(Object.isFrozen(p));}
});

test('branch source samplers append a separately sampled common 40m tail without a new spline fit',()=>{
  near(CALDERA_MERGE_TAIL.length,40);
  const tail=new OpenRoad(CALDERA_MERGE_TAIL_POINTS,[0,0,-1],[0,0,-1]);
  for(const id of ['alley','boulevard'] as const){
    const base=new OpenRoad(CALDERA_POINTS[id],[0,0,-1],[0,0,-1]),road=CALDERA_ROADS[id];
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
  assert.equal(CALDERA_DECISION_APPROACH_LENGTH,100);assert.ok(CALDERA_DECISION_APPROACH_LENGTH>80);
  const end=c.commonStart.sample(c.commonStart.length);
  for(let remaining=0;remaining<=CALDERA_DECISION_APPROACH_LENGTH;remaining+=.125){
    const s=c.commonStart.length-remaining;
    for(const lateral of [-9.5,-5,0,5,9.5]){
      const f=c.commonStart.sample(s,lateral),atSplit=c.commonStart.sample(c.commonStart.length,lateral);
      near(f.p.x,atSplit.p.x);near(f.p.y,14);near(f.p.z-atSplit.p.z,remaining);
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
  for(const [frame,landmark] of [[c.commonStart.sample(c.commonStart.length),CALDERA_LANDMARKS.split],[c.commonFinish.sample(0),CALDERA_LANDMARKS.merge]] as const){
    near(frame.p.x,landmark.x);near(frame.p.y,landmark.y);near(frame.p.z,landmark.z);
  }
});

test('dense full-width support preserves measured grades, inside radii, camber and forward ribbons',()=>{
  const limits:Record<RouteEdgeId,{radius:number;inner:number;grade:number;outerGrade:number}>= {
    start:{radius:34.2090,inner:24.7090,grade:.082418,outerGrade:.089511},
    alley:{radius:31.3691,inner:21.8691,grade:1e-10,outerGrade:1e-10},
    boulevard:{radius:43.2535,inner:33.7535,grade:1e-10,outerGrade:.008850},
    finish:{radius:35.6311,inner:26.1311,grade:.057087,outerGrade:.064643},
  };
  let minimumY=Infinity,maximumY=-Infinity;
  for(const edge of CALDERA_ROAD_EDGES){
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
    near(minWidth,edge.id==='alley'?5.8:9.5);near(maxWidth,9.5);near(maxBank,edge.id==='start'?.038:edge.id==='boulevard'?.036:edge.id==='finish'?.026:0);
    assert.ok(maxBankChange<.00104);assert.ok(maxWidthChange<.080);assert.ok(minForward>.697,'full-width ribbon cannot fold along an inside edge');
  }
  near(minimumY,13.441584882367138);near(maximumY,55.360912858702335);assert.ok(maximumY-minimumY>41);
});

test('high-rim, hooked-bowl and broad-sweep camber rotate physical support and ease off at seams',()=>{
  for(const [id,distances] of [['start',[160,210,260,500,950,1000,1050,1260,1300,1345,1500,1595,1635,1680]],['boulevard',[80,110,140,220,290,320,350]],['finish',[90,135,185,300,495,540,590]]] as const){
    for(const s of distances){
      const source=CALDERA_ROADS[id].sample(s),edge=c.edges[id],f=edge.sample(s),w=edge.halfWidthAt(s);
      near(f.t.distance(source.t),0);near(f.p.distance(source.p),0);near(f.n.dot(source.n),Math.cos(f.bank));near(f.normal.dot(source.normal),Math.cos(f.bank));
      near(edge.sample(s,w).p.y-edge.sample(s,-w).p.y,2*w*f.n.y);
    }
  }
  near(c.commonStart.sample(300).bank,.038);near(c.commonStart.sample(1500).bank,-.026);
  near(c.edges.boulevard.sample(220).bank,-.036);near(c.edges.finish.sample(300).bank,.026);
  assert.ok(Math.abs(c.commonStart.sample(300,9.5).p.y-c.commonStart.sample(300,-9.5).p.y)>.72);
  for(const s of [0,160,1050,1260,1680,c.commonStart.length])near(c.commonStart.sample(s).bank,0);
});

test('compatibility loop matches exact sweep-route support, wrapping and bounded invalid inputs',()=>{
  let offset=0;
  for(const edge of [c.commonStart,c.alternates.boulevard,c.commonFinish]){
    for(let s=0;s<edge.length;s+=2.25)for(const lateral of [-8.85,0,8.85]){
      const source=edge.sample(s,lateral),legacy=CALDERA_TRACK.sample(offset+s,lateral);
      for(const key of frames)near(source[key].distance(legacy[key]),0,1e-9);
      near(source.bank,legacy.bank);near(source.grade,legacy.grade);near(CALDERA_TRACK.halfWidthAt(offset+s),edge.halfWidthAt(s));near(CALDERA_TRACK.laneLimitAt(offset+s),edge.laneLimitAt(s));
      assert.deepEqual(CALDERA_TRACK.surfaceAt(offset+s),edge.surfaceAt(s));near(legacy.u,(offset+s)/CALDERA_TRACK.length);
    }
    offset+=edge.length;
  }
  for(const s of [-CALDERA_TRACK.length*3,-1,0,1,CALDERA_TRACK.length,CALDERA_TRACK.length*4+12.5]){
    for(const key of frames)near(CALDERA_TRACK.sample(s)[key].distance(CALDERA_TRACK.sample(s+CALDERA_TRACK.length)[key]),0,1e-9);
    assert.ok(Number.isFinite(CALDERA_TRACK.circuit.curvature(s)));
  }
  for(const value of [NaN,Infinity,-Infinity]){
    near(CALDERA_TRACK.sample(value).p.distance(CALDERA_TRACK.sample(0).p),0);
    for(const edge of CALDERA_ROAD_EDGES){near(edge.sample(value,NaN).p.distance(edge.sample(0).p),0);near(edge.sample(value).bank,0);near(edge.halfWidthAt(value),edge.halfWidthAt(0));assert.deepEqual(edge.surfaceAt(value),edge.surfaceAt(0));}
  }
});

test('jointline-cut taper and surface channels supply ordinary grip and rolling resistance, no speed multiplier',()=>{
  const archway=c.edges.alley,tailStart=archway.length-CALDERA_MERGE_TAIL.length;
  near(archway.halfWidthAt(0),9.5);near(archway.halfWidthAt(70),5.8);near(archway.halfWidthAt(tailStart-70),5.8);near(archway.halfWidthAt(tailStart),9.5);
  const earth={kind:'caldera-dressed-basalt-road',grip:.975,rollingResistance:1.018},pavers={kind:'caldera-jointed-inner-paving',grip:.94,rollingResistance:1.045};
  for(const s of [0,80,tailStart-80,tailStart,archway.length])assert.deepEqual(archway.surfaceAt(s),earth);
  for(const s of [80.001,100,tailStart-80-.001])assert.deepEqual(archway.surfaceAt(s),pavers);
  for(const edge of CALDERA_ROAD_EDGES){
    assert.deepEqual(Object.keys(edge).sort(),['id','length','sample','halfWidthAt','laneLimitAt','surfaceAt'].sort());
    for(let s=0;s<=edge.length;s+=10)if(edge.id!=='alley')assert.deepEqual(edge.surfaceAt(s),earth);
  }
});

test('compatibility clearance includes both branches and every full-width physical edge',()=>{
  for(const edge of CALDERA_ROAD_EDGES)for(let s=0;s<edge.length;s+=7){
    for(const lateral of [-edge.halfWidthAt(s),0,edge.halfWidthAt(s)]){const p=edge.sample(s,lateral).p;assert.equal(CALDERA_TRACK.clearAt(p.x,p.z),false);}
  }
  assert.equal(CALDERA_TRACK.clearAt(1000,1000,10),true);assert.equal(CALDERA_TRACK.clearAt(NaN,100),false);assert.equal(CALDERA_TRACK.clearAt(100,100,Infinity),false);
});


test('production full-width geometry retains its measured prototype fingerprint and checkpoint layout',()=>{
  // Independent prototype capture: 83,735 physical frames at0.25m steps,
  // rounded only for stable serialization. Direct migration parity is exact.
  const hash=createHash('sha256');let samples=0;
  for(const edge of CALDERA_ROAD_EDGES){
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
  assert.equal(samples,83735);assert.equal(hash.digest('hex'),'b68b298bbaaf74d91afae0d27936ae36495036fccb1ee0bf7bada579aa45d1e3');
  assert.deepEqual(c.checkpointGates.map(g=>[g.index,g.edgeId,g.s]),[[0, "start", 698.226814389516], [1, "start", 1889.3196154069255], [2, "alley", 134.1539037602752], [3, "alley", 339.8565561926972], [2, "boulevard", 152.5071508387502], [3, "boulevard", 386.3514487915005], [4, "finish", 188.1679727976859], [5, "finish", 517.4619251936363], [6, "finish", 917.3188673887188], [7, "finish", 1176.049829985537]]);
});
