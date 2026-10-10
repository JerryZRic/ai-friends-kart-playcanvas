import test from 'node:test';
import assert from 'node:assert/strict';
import {OpenRoad} from '../src/open-road';
import {HARVEST_COURSE as c,HARVEST_META,HARVEST_TRACK,HARVEST_ROAD_EDGES,HARVEST_LANDMARKS,HARVEST_POINTS,HARVEST_ROADS,HARVEST_MERGE_TAIL,HARVEST_MERGE_TAIL_POINTS,HARVEST_BARN,HARVEST_DECISION_APPROACH_LENGTH} from '../src/maps/harvest';
import type {RouteEdgeId} from '../src/land-routes';

const near=(a:number,b:number,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b} (tolerance ${t})`);
const frames=['p','t','n','normal'] as const;
const expectedLengths={start:1455.4737229422667,alley:426.3007265117428,boulevard:516.7468731516695,finish:814.7554591526211};

test('harvest preserves original measured farming-basin routes and positive-lateral barn choice',()=>{
  assert.equal(c.id,'harvest');assert.equal(HARVEST_META.label,'谷风麦垄回环');assert.equal(HARVEST_META.tag,'AMBERWIND HARVEST');
  for(const edge of HARVEST_ROAD_EDGES)near(edge.length,expectedLengths[edge.id]);
  near(c.canonicalLength,2786.9760552465577);
  near(c.commonStart.length+c.alternates.alley.length+c.commonFinish.length,2696.5299086066307);
  near(c.alternates.boulevard.length-c.alternates.alley.length,90.44614663992672);
  const n=c.commonStart.sample(c.commonStart.length).n;
  for(const [s,separation] of [[10,.9003752912756084],[20,3.161977234648802],[40,8.96384551565589],[60,13.074687687020386],[80,15.281407024805006],[110,24.58001797917069]]){
    near(c.edges.alley.sample(s).p.sub(c.edges.boulevard.sample(s).p).dot(n),separation);
  }
  assert.equal(c.presentation?.branchLabels.alley,'谷仓折线');assert.equal(c.presentation?.branchLabels.boulevard,'麦浪外环');
  assert.deepEqual(Object.keys(HARVEST_POINTS),['start','alley','boulevard','finish']);
  assert.deepEqual(HARVEST_POINTS.start.at(-2),[92,16,110.4]);assert.deepEqual(HARVEST_POINTS.start.at(-1),[202.4,16,110.4]);
  for(const points of Object.values(HARVEST_POINTS)){assert.ok(Object.isFrozen(points));for(const p of points)assert.ok(Object.isFrozen(p));}
});

test('branch source samplers append a separately sampled common 40m tail without a new spline fit',()=>{
  near(HARVEST_MERGE_TAIL.length,40);
  const tail=new OpenRoad(HARVEST_MERGE_TAIL_POINTS,[-1,0,0],[-1,0,0]);
  for(const id of ['alley','boulevard'] as const){
    const base=new OpenRoad(HARVEST_POINTS[id],[1,0,0],[-1,0,0]),road=HARVEST_ROADS[id];
    near(base.length+tail.length,road.length);near(c.edges[id].length,road.length);
    for(let s=0;s<=road.length;s+=.5)for(const lateral of [-9.5,0,9.5]){
      const reference=s<=base.length?base.sample(s,lateral):tail.sample(s-base.length,lateral);
      for(const key of frames)near(road.sample(s,lateral)[key].distance(reference[key]),0);
    }
    for(const lateral of [-9.5,-5,0,5,9.5]){
      const a=base.sample(base.length,lateral),b=tail.sample(0,lateral);
      for(const key of frames)near(a[key].distance(b[key]),0);
    }
  }
});

test('100m decision approach stays straight, level and unbanked across the complete input zone',()=>{
  assert.equal(HARVEST_DECISION_APPROACH_LENGTH,100);assert.ok(HARVEST_DECISION_APPROACH_LENGTH>80);
  const end=c.commonStart.sample(c.commonStart.length);
  for(let remaining=0;remaining<=HARVEST_DECISION_APPROACH_LENGTH;remaining+=.125){
    const s=c.commonStart.length-remaining;
    for(const lateral of [-9.5,-5,0,5,9.5]){
      const f=c.commonStart.sample(s,lateral),atSplit=c.commonStart.sample(c.commonStart.length,lateral);
      near(f.p.z,atSplit.p.z);near(f.p.y,16);near(atSplit.p.x-f.p.x,remaining);
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
  for(const [frame,landmark] of [[c.commonStart.sample(c.commonStart.length),HARVEST_LANDMARKS.split],[c.commonFinish.sample(0),HARVEST_LANDMARKS.merge]] as const){
    near(frame.p.x,landmark.x);near(frame.p.y,landmark.y);near(frame.p.z,landmark.z);
  }
});

test('dense full-width support preserves measured grades, inside radii, camber and forward ribbons',()=>{
  const limits:Record<RouteEdgeId,{radius:number;inner:number;grade:number;outerGrade:number}>= {
    start:{radius:49.2598,inner:39.7598,grade:.079068,outerGrade:.090719},
    alley:{radius:22.0203,inner:16.3203,grade:1e-10,outerGrade:1e-10},
    boulevard:{radius:142.1762,inner:132.6762,grade:1e-10,outerGrade:.011443},
    finish:{radius:25.8979,inner:16.3979,grade:.027940,outerGrade:.028404},
  };
  let minimumY=Infinity,maximumY=-Infinity;
  for(const edge of HARVEST_ROAD_EDGES){
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
    near(minWidth,edge.id==='alley'?5.7:9.5);near(maxWidth,9.5);near(maxBank,edge.id==='start'?.055:edge.id==='boulevard'?.045:0);
    assert.ok(maxBankChange<.0015);assert.ok(maxWidthChange<.095);assert.ok(minForward>.633,'full-width ribbon cannot fold along an inside edge');
  }
  near(minimumY,9.782496077255175);near(maximumY,34.04627242072294);assert.ok(maximumY-minimumY>24);
});

test('bank sign changes and contour camber rotate actual lane support and ease off at all junctions',()=>{
  for(const [id,distances] of [['start',[300,330,355,500,620,650,730,760,790,970,1050,1080]],['boulevard',[110,140,170,220,290,320,350]]] as const){
    for(const s of distances){
      const source=HARVEST_ROADS[id].sample(s),edge=c.edges[id],f=edge.sample(s),w=edge.halfWidthAt(s);
      near(f.t.distance(source.t),0);near(f.p.distance(source.p),0);near(f.n.dot(source.n),Math.cos(f.bank));near(f.normal.dot(source.normal),Math.cos(f.bank));
      near(edge.sample(s,w).p.y-edge.sample(s,-w).p.y,2*w*f.n.y);
    }
  }
  near(c.commonStart.sample(500).bank,.055);near(c.commonStart.sample(900).bank,-.045);near(c.edges.boulevard.sample(220).bank,-.045);
  assert.ok(Math.abs(c.commonStart.sample(500,9.5).p.y-c.commonStart.sample(500,-9.5).p.y)>1);
  for(const s of [0,300,650,730,1080,c.commonStart.length])near(c.commonStart.sample(s).bank,0);
});

test('barn is a real 55.2m straight with level support, open portals and 18m structural headroom',()=>{
  const b=HARVEST_BARN,e=c.edges.alley;assert.equal(HARVEST_LANDMARKS.barn,b);
  near(b.straightToS-b.straightFromS,55.2);near((b.straightFromS+b.straightToS)/2,b.centerS);
  near(e.sample(b.centerS).p.z,0);assert.equal(b.portalWidth,48);assert.equal(b.undersideY-b.floorY,18);
  for(let s=b.straightFromS;s<=b.straightToS;s+=.25){
    const f=e.sample(s);near(f.p.x,b.center.x);near(f.p.y,b.floorY);near(f.t.x,0);near(f.t.z,-1);near(f.grade,0);near(f.bank,0);near(e.halfWidthAt(s),5.7);
    for(const lateral of [-e.halfWidthAt(s),0,e.halfWidthAt(s)]){
      const p=e.sample(s,lateral).p;assert.ok(p.x>b.center.x-b.interiorHalfWidth&&p.x<b.center.x+b.interiorHalfWidth);near(b.undersideY-p.y,18);
    }
  }
});

test('compatibility loop matches exact contour-route support, wrapping and bounded invalid inputs',()=>{
  let offset=0;
  for(const edge of [c.commonStart,c.alternates.boulevard,c.commonFinish]){
    for(let s=0;s<edge.length;s+=2.25)for(const lateral of [-8.85,0,8.85]){
      const source=edge.sample(s,lateral),legacy=HARVEST_TRACK.sample(offset+s,lateral);
      for(const key of frames)near(source[key].distance(legacy[key]),0,1e-9);
      near(source.bank,legacy.bank);near(source.grade,legacy.grade);near(HARVEST_TRACK.halfWidthAt(offset+s),edge.halfWidthAt(s));near(HARVEST_TRACK.laneLimitAt(offset+s),edge.laneLimitAt(s));
      assert.deepEqual(HARVEST_TRACK.surfaceAt(offset+s),edge.surfaceAt(s));near(legacy.u,(offset+s)/HARVEST_TRACK.length);
    }
    offset+=edge.length;
  }
  for(const s of [-HARVEST_TRACK.length*3,-1,0,1,HARVEST_TRACK.length,HARVEST_TRACK.length*4+12.5]){
    for(const key of frames)near(HARVEST_TRACK.sample(s)[key].distance(HARVEST_TRACK.sample(s+HARVEST_TRACK.length)[key]),0,1e-9);
    assert.ok(Number.isFinite(HARVEST_TRACK.circuit.curvature(s)));
  }
  for(const value of [NaN,Infinity,-Infinity]){
    near(HARVEST_TRACK.sample(value).p.distance(HARVEST_TRACK.sample(0).p),0);
    for(const edge of HARVEST_ROAD_EDGES){near(edge.sample(value,NaN).p.distance(edge.sample(0).p),0);near(edge.sample(value).bank,0);near(edge.halfWidthAt(value),edge.halfWidthAt(0));assert.deepEqual(edge.surfaceAt(value),edge.surfaceAt(0));}
  }
});

test('barn taper and surface channels supply ordinary grip and rolling resistance, no speed multiplier',()=>{
  const barn=c.edges.alley,tailStart=barn.length-HARVEST_MERGE_TAIL.length;
  near(barn.halfWidthAt(0),9.5);near(barn.halfWidthAt(60),5.7);near(barn.halfWidthAt(tailStart-60),5.7);near(barn.halfWidthAt(tailStart),9.5);
  const earth={kind:'harvest-packed-earth',grip:.99,rollingResistance:1.015},pavers={kind:'harvest-yard-pavers',grip:.955,rollingResistance:1.035};
  for(const s of [0,65,tailStart-65,tailStart,barn.length])assert.deepEqual(barn.surfaceAt(s),earth);
  for(const s of [65.001,100,tailStart-65-.001])assert.deepEqual(barn.surfaceAt(s),pavers);
  for(const edge of HARVEST_ROAD_EDGES){
    assert.deepEqual(Object.keys(edge).sort(),['id','length','sample','halfWidthAt','laneLimitAt','surfaceAt'].sort());
    for(let s=0;s<=edge.length;s+=10)if(edge.id!=='alley')assert.deepEqual(edge.surfaceAt(s),earth);
  }
});

test('compatibility clearance includes both branches and every full-width physical edge',()=>{
  for(const edge of HARVEST_ROAD_EDGES)for(let s=0;s<edge.length;s+=7){
    for(const lateral of [-edge.halfWidthAt(s),0,edge.halfWidthAt(s)]){const p=edge.sample(s,lateral).p;assert.equal(HARVEST_TRACK.clearAt(p.x,p.z),false);}
  }
  assert.equal(HARVEST_TRACK.clearAt(1000,1000,10),true);assert.equal(HARVEST_TRACK.clearAt(NaN,100),false);assert.equal(HARVEST_TRACK.clearAt(100,100,Infinity),false);
});
