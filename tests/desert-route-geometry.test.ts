import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {OpenRoad} from '../src/open-road';
import {DESERT_COURSE as c,DESERT_META,DESERT_TRACK,DESERT_ROAD_EDGES,DESERT_LANDMARKS,DESERT_POINTS,DESERT_ROADS,DESERT_MERGE_TAIL,DESERT_MERGE_TAIL_POINTS,DESERT_ARCHES,DESERT_DECISION_APPROACH_LENGTH} from '../src/maps/desert';
import type {RouteEdgeId} from '../src/land-routes';

const near=(a:number,b:number,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b} (tolerance ${t})`);
const frames=['p','t','n','normal'] as const;
const expectedLengths={start:1501.1606892319999,alley:527.7831907192183,boulevard:584.8322648642281,finish:697.5813569881483};

test('desert preserves original measured dune-crown routes and positive-lateral archway choice',()=>{
  assert.equal(c.id,'desert');assert.equal(DESERT_META.label,'星砂古驿');assert.equal(DESERT_META.tag,'SUNWEAVE CARAVAN');
  for(const edge of DESERT_ROAD_EDGES)near(edge.length,expectedLengths[edge.id]);
  near(c.canonicalLength,2783.5743110843764);
  near(c.commonStart.length+c.alternates.alley.length+c.commonFinish.length,2726.5252369393666);
  near(c.alternates.boulevard.length-c.alternates.alley.length,57.049074145009854);
  const n=c.commonStart.sample(c.commonStart.length).n;
  for(const [s,separation] of [[10,1.4198268114028565],[20,5.132750488280038],[40,16.401619288480703],[60,28.84086267962445],[80,37.261208762163506],[110,44.81204495936913]]){
    near(c.edges.alley.sample(s).p.sub(c.edges.boulevard.sample(s).p).dot(n),separation);
  }
  assert.equal(c.presentation?.branchLabels.alley,'拱廊折径');assert.equal(c.presentation?.branchLabels.boulevard,'风帆庭环');
  assert.deepEqual(Object.keys(DESERT_POINTS),['start','alley','boulevard','finish']);
  assert.deepEqual(DESERT_POINTS.start.at(-2),[150,18,250]);assert.deepEqual(DESERT_POINTS.start.at(-1),[40,18,250]);
  for(const points of Object.values(DESERT_POINTS)){assert.ok(Object.isFrozen(points));for(const p of points)assert.ok(Object.isFrozen(p));}
});

test('branch source samplers append a separately sampled common 40m tail without a new spline fit',()=>{
  near(DESERT_MERGE_TAIL.length,40);
  const tail=new OpenRoad(DESERT_MERGE_TAIL_POINTS,[-1,0,0],[-1,0,0]);
  for(const id of ['alley','boulevard'] as const){
    const base=new OpenRoad(DESERT_POINTS[id],[-1,0,0],[-1,0,0]),road=DESERT_ROADS[id];
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
  assert.equal(DESERT_DECISION_APPROACH_LENGTH,100);assert.ok(DESERT_DECISION_APPROACH_LENGTH>80);
  const end=c.commonStart.sample(c.commonStart.length);
  for(let remaining=0;remaining<=DESERT_DECISION_APPROACH_LENGTH;remaining+=.125){
    const s=c.commonStart.length-remaining;
    for(const lateral of [-9.5,-5,0,5,9.5]){
      const f=c.commonStart.sample(s,lateral),atSplit=c.commonStart.sample(c.commonStart.length,lateral);
      near(f.p.z,atSplit.p.z);near(f.p.y,18);near(f.p.x-atSplit.p.x,remaining);
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
  for(const [frame,landmark] of [[c.commonStart.sample(c.commonStart.length),DESERT_LANDMARKS.split],[c.commonFinish.sample(0),DESERT_LANDMARKS.merge]] as const){
    near(frame.p.x,landmark.x);near(frame.p.y,landmark.y);near(frame.p.z,landmark.z);
  }
});

test('dense full-width support preserves measured grades, inside radii, camber and forward ribbons',()=>{
  const limits:Record<RouteEdgeId,{radius:number;inner:number;grade:number;outerGrade:number}>= {
    start:{radius:29.9609,inner:20.4609,grade:.078971,outerGrade:.092561},
    alley:{radius:29.5952,inner:23.6952,grade:1e-10,outerGrade:1e-10},
    boulevard:{radius:72.5999,inner:63.0999,grade:1e-10,outerGrade:.010878},
    finish:{radius:36.9794,inner:27.4794,grade:.029463,outerGrade:.033551},
  };
  let minimumY=Infinity,maximumY=-Infinity;
  for(const edge of DESERT_ROAD_EDGES){
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
    near(minWidth,edge.id==='alley'?5.9:9.5);near(maxWidth,9.5);near(maxBank,edge.id==='start'||edge.id==='boulevard'?.045:edge.id==='finish'?.025:0);
    assert.ok(maxBankChange<.0015);assert.ok(maxWidthChange<.078);assert.ok(minForward>.683,'full-width ribbon cannot fold along an inside edge');
  }
  near(minimumY,9.53602653917637);near(maximumY,43.84226875373854);assert.ok(maximumY-minimumY>34);
});

test('bank sign changes and sweep camber rotate actual lane support and ease off at all junctions',()=>{
  for(const [id,distances] of [['start',[390,420,455,500,650,715,795,830,860,970,1050,1080]],['boulevard',[100,130,160,220,290,400,460]],['finish',[220,245,275,300,335,360,390]]] as const){
    for(const s of distances){
      const source=DESERT_ROADS[id].sample(s),edge=c.edges[id],f=edge.sample(s),w=edge.halfWidthAt(s);
      near(f.t.distance(source.t),0);near(f.p.distance(source.p),0);near(f.n.dot(source.n),Math.cos(f.bank));near(f.normal.dot(source.normal),Math.cos(f.bank));
      near(edge.sample(s,w).p.y-edge.sample(s,-w).p.y,2*w*f.n.y);
    }
  }
  near(c.commonStart.sample(500).bank,.045);near(c.commonStart.sample(900).bank,-.045);near(c.edges.boulevard.sample(220).bank,.045);near(c.edges.finish.sample(300).bank,-.025);
  assert.ok(Math.abs(c.commonStart.sample(500,9.5).p.y-c.commonStart.sample(500,-9.5).p.y)>.85);
  for(const s of [0,390,715,795,1080,c.commonStart.length])near(c.commonStart.sample(s).bank,0);
});

test('two open52m arches reserve20m headroom over a real40m straight and11.8m road',()=>{
  const b=DESERT_ARCHES,e=c.edges.alley;assert.equal(DESERT_LANDMARKS.arches,b);
  near(b.straightToS-b.straightFromS,40);near((b.straightFromS+b.straightToS)/2,b.centerS);
  near(e.sample(b.centerS).p.x,-260);assert.equal(b.portalWidth,52);assert.equal(b.driveableWidth,11.8);
  assert.equal(b.undersideY-b.floorY,b.overheadClearance);assert.equal(b.overheadClearance,20);
  assert.equal(b.centersX.length,2);assert.ok(Math.abs(b.centersX[0]-b.centersX[1])>b.depth,'open sky between arches');
  for(let s=b.straightFromS;s<=b.straightToS;s+=.25){
    const f=e.sample(s);near(f.p.z,b.centerZ);near(f.p.y,b.floorY);near(f.t.x,-1);near(f.t.z,0);near(f.grade,0);near(f.bank,0);near(e.halfWidthAt(s),5.9);
    for(const lateral of [-e.halfWidthAt(s),0,e.halfWidthAt(s)]){
      const p=e.sample(s,lateral).p;assert.ok(p.z>b.centerZ-b.innerHalfWidth&&p.z<b.centerZ+b.innerHalfWidth);near(b.undersideY-p.y,20);
    }
  }
});

test('compatibility loop matches exact sweep-route support, wrapping and bounded invalid inputs',()=>{
  let offset=0;
  for(const edge of [c.commonStart,c.alternates.boulevard,c.commonFinish]){
    for(let s=0;s<edge.length;s+=2.25)for(const lateral of [-8.85,0,8.85]){
      const source=edge.sample(s,lateral),legacy=DESERT_TRACK.sample(offset+s,lateral);
      for(const key of frames)near(source[key].distance(legacy[key]),0,1e-9);
      near(source.bank,legacy.bank);near(source.grade,legacy.grade);near(DESERT_TRACK.halfWidthAt(offset+s),edge.halfWidthAt(s));near(DESERT_TRACK.laneLimitAt(offset+s),edge.laneLimitAt(s));
      assert.deepEqual(DESERT_TRACK.surfaceAt(offset+s),edge.surfaceAt(s));near(legacy.u,(offset+s)/DESERT_TRACK.length);
    }
    offset+=edge.length;
  }
  for(const s of [-DESERT_TRACK.length*3,-1,0,1,DESERT_TRACK.length,DESERT_TRACK.length*4+12.5]){
    for(const key of frames)near(DESERT_TRACK.sample(s)[key].distance(DESERT_TRACK.sample(s+DESERT_TRACK.length)[key]),0,1e-9);
    assert.ok(Number.isFinite(DESERT_TRACK.circuit.curvature(s)));
  }
  for(const value of [NaN,Infinity,-Infinity]){
    near(DESERT_TRACK.sample(value).p.distance(DESERT_TRACK.sample(0).p),0);
    for(const edge of DESERT_ROAD_EDGES){near(edge.sample(value,NaN).p.distance(edge.sample(0).p),0);near(edge.sample(value).bank,0);near(edge.halfWidthAt(value),edge.halfWidthAt(0));assert.deepEqual(edge.surfaceAt(value),edge.surfaceAt(0));}
  }
});

test('archway taper and surface channels supply ordinary grip and rolling resistance, no speed multiplier',()=>{
  const archway=c.edges.alley,tailStart=archway.length-DESERT_MERGE_TAIL.length;
  near(archway.halfWidthAt(0),9.5);near(archway.halfWidthAt(70),5.9);near(archway.halfWidthAt(tailStart-70),5.9);near(archway.halfWidthAt(tailStart),9.5);
  const earth={kind:'desert-hardpan-road',grip:.985,rollingResistance:1.012},pavers={kind:'desert-sandstone-paving',grip:.95,rollingResistance:1.035};
  for(const s of [0,80,tailStart-80,tailStart,archway.length])assert.deepEqual(archway.surfaceAt(s),earth);
  for(const s of [80.001,100,tailStart-80-.001])assert.deepEqual(archway.surfaceAt(s),pavers);
  for(const edge of DESERT_ROAD_EDGES){
    assert.deepEqual(Object.keys(edge).sort(),['id','length','sample','halfWidthAt','laneLimitAt','surfaceAt'].sort());
    for(let s=0;s<=edge.length;s+=10)if(edge.id!=='alley')assert.deepEqual(edge.surfaceAt(s),earth);
  }
});

test('compatibility clearance includes both branches and every full-width physical edge',()=>{
  for(const edge of DESERT_ROAD_EDGES)for(let s=0;s<edge.length;s+=7){
    for(const lateral of [-edge.halfWidthAt(s),0,edge.halfWidthAt(s)]){const p=edge.sample(s,lateral).p;assert.equal(DESERT_TRACK.clearAt(p.x,p.z),false);}
  }
  assert.equal(DESERT_TRACK.clearAt(1000,1000,10),true);assert.equal(DESERT_TRACK.clearAt(NaN,100),false);assert.equal(DESERT_TRACK.clearAt(100,100,Infinity),false);
});


test('production full-width geometry retains its measured prototype fingerprint and checkpoint layout',()=>{
  // Independent prototype capture: 66,260 physical frames at0.25m steps,
  // rounded only for stable serialization. Direct migration parity is exact.
  const hash=createHash('sha256');let samples=0;
  for(const edge of DESERT_ROAD_EDGES){
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
  assert.equal(samples,66260);assert.equal(hash.digest('hex'),'58caa4afc9045fad76871fa14a97a4b9da7f6c7484b07a73bc2cf83511297137');
  assert.deepEqual(c.checkpointGates.map(g=>[g.index,g.edgeId,g.s]),[
    [0,'start',435.3365998772799],[1,'start',1351.0446203088],
    [2,'alley',168.89062103014984],[3,'alley',401.1152249466059],
    [2,'boulevard',187.146324756553],[3,'boulevard',444.4725212968134],
    [4,'finish',83.70976283857779],[5,'finish',272.05672922537786],
    [6,'finish',509.23439060134825],[7,'finish',697.5813569881483],
  ]);
});
