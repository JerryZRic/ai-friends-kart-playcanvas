import test from 'node:test';
import assert from 'node:assert/strict';
import {OpenRoad} from '../src/open-road';
import {QUARRY_COURSE as c,QUARRY_TRACK,QUARRY_ROAD_EDGES,QUARRY_LANDMARKS,QUARRY_POINTS,QUARRY_ROADS,QUARRY_MERGE_TAIL,QUARRY_MERGE_TAIL_POINTS,QUARRY_HORIZONTAL_SCALE} from '../src/maps/quarry';
import type {RouteEdgeId} from '../src/land-routes';

const near=(a:number,b:number,t=1e-8) => assert.ok(Math.abs(a-b)<=t,`${a} != ${b} (tolerance ${t})`);
const frames=['p','t','n','normal'] as const;
const expectedLengths={start:669.6794925348206,alley:373.43876933883155,boulevard:441.6981165277977,finish:1127.9580941495626};

test('original quarry preserves measured physical routes and left/right branch intent',()=>{
  assert.equal(c.id,'quarry');near(QUARRY_HORIZONTAL_SCALE,.74);
  for(const edge of QUARRY_ROAD_EDGES)near(edge.length,expectedLengths[edge.id]);
  near(c.canonicalLength,2239.335703212181);
  near(c.commonStart.length+c.alternates.alley.length+c.commonFinish.length,2171.076356023215);
  near(c.alternates.boulevard.length-c.alternates.alley.length,68.25934718896616);
  assert.ok(c.edges.alley.sample(35).p.x>c.edges.boulevard.sample(35).p.x,'positive lateral is the selected shelf direction');
  assert.ok(c.edges.alley.sample(100).p.distance(c.edges.boulevard.sample(100).p)>80);
  assert.equal(c.presentation?.branchLabels.alley,'石脊窄道');
  assert.equal(c.presentation?.branchLabels.boulevard,'重载环坡');
});

test('branch sampler concatenates the original base with the same tail without re-fitting',()=>{
  near(QUARRY_MERGE_TAIL.length,40.7);
  const shared=new OpenRoad(QUARRY_MERGE_TAIL_POINTS,[0,0,-1],[0,0,-1]);
  for(const id of ['alley','boulevard'] as const){
    const base=new OpenRoad(QUARRY_POINTS[id],[0,0,1],[0,0,-1]),edge=c.edges[id];
    near(base.length+shared.length,edge.length);
    for(let s=0;s<=edge.length;s+=.5){
      const reference=s<=base.length?base.sample(s):shared.sample(s-base.length);
      for(const key of frames)near(edge.sample(s)[key].distance(reference[key]),0);
    }
    for(const lateral of [-10,-5,0,5,10]){
      const a=base.sample(base.length,lateral),b=shared.sample(0,lateral);
      for(const key of frames)near(a[key].distance(b[key]),0);
    }
    near(QUARRY_ROADS[id].length,edge.length);
  }
});

test('all five support seams are exact across the complete road width',()=>{
  for(const [a,b] of [[c.edges.start,c.edges.alley],[c.edges.start,c.edges.boulevard],[c.edges.alley,c.edges.finish],[c.edges.boulevard,c.edges.finish],[c.edges.finish,c.edges.start]]){
    for(const lateral of [-10,-5,0,5,10]){
      const x=a.sample(a.length,lateral),y=b.sample(0,lateral);
      for(const key of frames)near(x[key].distance(y[key]),0);
      near(x.grade,y.grade);near(x.bank,y.bank);
    }
    near(a.halfWidthAt(a.length),b.halfWidthAt(0));
    near(a.laneLimitAt(a.length),b.laneLimitAt(0));
    assert.deepEqual(a.surfaceAt(a.length),b.surfaceAt(0));
  }
  near(c.commonStart.sample(c.commonStart.length).p.distance({x:QUARRY_LANDMARKS.split.x,y:QUARRY_LANDMARKS.split.y,z:QUARRY_LANDMARKS.split.z} as any),0);
  near(c.commonFinish.sample(0).p.distance({x:QUARRY_LANDMARKS.merge.x,y:QUARRY_LANDMARKS.merge.y,z:QUARRY_LANDMARKS.merge.z} as any),0);
});

test('compatibility loop samples exactly start + haul + finish, including wrapping and seams',()=>{
  let offset=0;
  for(const edge of [c.commonStart,c.alternates.boulevard,c.commonFinish]){
    for(let s=0;s<edge.length;s+=2.25)for(const lateral of [-9.35,0,9.35]){
      const source=edge.sample(s,lateral),compatibility=QUARRY_TRACK.sample(offset+s,lateral);
      for(const key of frames)near(source[key].distance(compatibility[key]),0,1e-9);
      near(QUARRY_TRACK.halfWidthAt(offset+s),edge.halfWidthAt(s));
      near(QUARRY_TRACK.laneLimitAt(offset+s),edge.laneLimitAt(s));
      assert.deepEqual(QUARRY_TRACK.surfaceAt(offset+s),edge.surfaceAt(s));
      near(compatibility.u,(offset+s)/QUARRY_TRACK.length);
    }
    offset+=edge.length;
  }
  for(const s of [-QUARRY_TRACK.length*3,-1,0,1,QUARRY_TRACK.length,QUARRY_TRACK.length*4+12.5]){
    for(const key of frames)near(QUARRY_TRACK.sample(s)[key].distance(QUARRY_TRACK.sample(s+QUARRY_TRACK.length)[key]),0,1e-9);
    assert.ok(Number.isFinite(QUARRY_TRACK.circuit.curvature(s)));
  }
  for(const value of [NaN,Infinity,-Infinity])near(QUARRY_TRACK.sample(value).p.distance(QUARRY_TRACK.sample(0).p),0);
});

test('dense full-width support frames preserve real grade, safe inside radii and smooth width taper',()=>{
  const limits:Record<RouteEdgeId,{radius:number;inner:number;grade:number}>={
    start:{radius:28,inner:18,grade:.0847},alley:{radius:17.69,inner:11.56,grade:.0787},
    boulevard:{radius:113.8,inner:103.8,grade:.0562},finish:{radius:26.75,inner:16.75,grade:.1043},
  };
  let minY=Infinity,maxY=-Infinity;
  for(const edge of QUARRY_ROAD_EDGES){
    let minRadius=Infinity,minInner=Infinity,maxGrade=0,minWidth=Infinity,maxWidth=0;
    for(let s=0;s<=edge.length;s+=.25){
      const f=edge.sample(s),width=edge.halfWidthAt(s),next=edge.sample(Math.min(s+.25,edge.length));
      minY=Math.min(minY,f.p.y);maxY=Math.max(maxY,f.p.y);
      for(const key of frames)assert.ok([f[key].x,f[key].y,f[key].z].every(Number.isFinite),`${edge.id}/${s}/${key}`);
      for(const key of ['t','n','normal'] as const)near(f[key].length(),1);
      near(f.t.dot(f.n),0);near(f.t.dot(f.normal),0);near(f.n.dot(f.normal),0);near(f.bank,0);
      near(f.grade,f.t.y/Math.hypot(f.t.x,f.t.z));assert.ok(f.normal.y>.99);
      const span=Math.min(.25,edge.length-s);
      if(span>1e-8){
        const turn=Math.abs(Math.atan2(f.t.z*next.t.x-f.t.x*next.t.z,f.t.x*next.t.x+f.t.z*next.t.z));
        minRadius=Math.min(minRadius,span/turn);minInner=Math.min(minInner,span/turn-width);
      }
      maxGrade=Math.max(maxGrade,Math.abs(f.grade));minWidth=Math.min(minWidth,width);maxWidth=Math.max(maxWidth,width);
      assert.ok(width>=4.4&&width<=10);near(edge.laneLimitAt(s),width-.65);
      assert.ok(Math.abs(edge.halfWidthAt(Math.min(s+1,edge.length))-width)<.1236);
      for(const lateral of [-width,-edge.laneLimitAt(s),0,edge.laneLimitAt(s),width]){
        const support=edge.sample(s,lateral);
        assert.ok([support.p.x,support.p.y,support.p.z,support.grade,support.bank].every(Number.isFinite));
        near(support.p.distance(f.p),Math.abs(lateral));near(support.p.y,f.p.y);
      }
    }
    assert.ok(minRadius>limits[edge.id].radius,`${edge.id}: radius ${minRadius}`);
    assert.ok(minInner>limits[edge.id].inner,`${edge.id}: inside radius ${minInner}`);
    assert.ok(maxGrade<=limits[edge.id].grade,`${edge.id}: grade ${maxGrade}`);
    near(minWidth,edge.id==='alley'?4.4:10);near(maxWidth,10);
  }
  assert.ok(minY<5.9&&minY>5.88);assert.ok(maxY>32.15&&maxY<32.17);
  assert.ok(maxY-minY>26.26,'decorative terrain must not substitute for physical relief');
});

test('surface and taper are ordinary source support profiles without branch speed modifiers',()=>{
  const shelf=c.edges.alley,tailStart=shelf.length-QUARRY_MERGE_TAIL.length;
  near(shelf.halfWidthAt(0),10);near(shelf.halfWidthAt(68),4.4);
  near(shelf.halfWidthAt(tailStart-68),4.4);near(shelf.halfWidthAt(tailStart),10);
  for(const s of [0,50,tailStart,tailStart+20,shelf.length])assert.deepEqual(shelf.surfaceAt(s),{kind:'quarry-compacted-haul',grip:1,rollingResistance:1.02});
  for(const s of [50.001,100,tailStart-.001])assert.deepEqual(shelf.surfaceAt(s),{kind:'quarry-cut-stone',grip:.97,rollingResistance:1.035});
  for(const edge of QUARRY_ROAD_EDGES){
    assert.deepEqual(Object.keys(edge).sort(),['id','length','sample','halfWidthAt','laneLimitAt','surfaceAt'].sort());
    for(let s=0;s<=edge.length;s+=10)if(edge.id!=='alley')assert.deepEqual(edge.surfaceAt(s),{kind:'quarry-compacted-haul',grip:1,rollingResistance:1.02});
  }
});

test('conservative full-ribbon envelopes overlap only at planar legal junctions and the named high trestle',()=>{
  // Radius includes the complete supported half-width plus 2 m between samples.
  // Dense radius/frame tests above establish that local strips do not fold.
  const points=QUARRY_ROAD_EDGES.flatMap(edge => Array.from({length:Math.ceil(edge.length/2)+1},(_,i)=>{
    const s=Math.min(edge.length,i*2);return {id:edge.id,s,remaining:edge.length-s,p:edge.sample(s).p,w:edge.halfWidthAt(s)};
  }));
  const branch=(p:typeof points[number]) => p.id==='alley'||p.id==='boulevard';
  let crossings=0,junctions=0,minClearance=Infinity;
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
    const a=points[i],b=points[j];
    if(a.id===b.id&&Math.abs(a.s-b.s)<40)continue;
    if(Math.hypot(a.p.x-b.p.x,a.p.z-b.p.z)>a.w+b.w+2)continue;
    const junction=a.id!==b.id&&(
      a.id==='start'&&branch(b)&&a.remaining<=24&&b.s<=50 ||
      branch(a)&&b.id==='finish'&&a.remaining<=122&&b.s<=24 ||
      branch(a)&&branch(b)&&(a.s<=50&&b.s<=50||a.remaining<=122&&b.remaining<=122) ||
      a.id==='start'&&b.id==='finish'&&a.s<=24&&b.remaining<=24
    );
    if(junction){near(a.p.y,b.p.y);junctions++;continue;}
    assert.equal(a.id,'start',`unexpected lower overlap ${a.id}/${a.s} and ${b.id}/${b.s}`);
    assert.equal(b.id,'finish',`unexpected upper overlap ${a.id}/${a.s} and ${b.id}/${b.s}`);
    for(const p of [a,b]){
      assert.ok(p.p.x>=-25.24&&p.p.x<=19.67,'crossing escaped its authored X envelope');
      assert.ok(p.p.z>=-184.52&&p.p.z<=-146.02,'crossing escaped its authored Z envelope');
    }
    const clearance=b.p.y-a.p.y-QUARRY_LANDMARKS.crossing.structuralDepth;
    assert.ok(clearance>=QUARRY_LANDMARKS.crossing.minUndersideClearance);
    minClearance=Math.min(minClearance,clearance);crossings++;
  }
  assert.equal(junctions,1720);assert.equal(crossings,403);near(minClearance,22.753434855583432);
});

test('crossing metadata identifies both physical decks; scenery clearance includes every alternate',()=>{
  const crossing=QUARRY_LANDMARKS.crossing;
  const lower=c.edges[crossing.lowerEdge].sample(crossing.lowerS),upper=c.edges[crossing.upperEdge].sample(crossing.upperS);
  near(lower.p.y,crossing.lowerY);near(upper.p.y,crossing.upperY);
  assert.ok(Math.hypot(lower.p.x-upper.p.x,lower.p.z-upper.p.z)<.01);
  near(lower.p.x,crossing.x);near(lower.p.z,crossing.z);
  assert.ok(upper.p.y-lower.p.y>25.64);
  for(const edge of QUARRY_ROAD_EDGES)for(let s=0;s<edge.length;s+=7){
    for(const lateral of [-edge.halfWidthAt(s),0,edge.halfWidthAt(s)]){
      const p=edge.sample(s,lateral).p;assert.equal(QUARRY_TRACK.clearAt(p.x,p.z),false);
    }
  }
  assert.equal(QUARRY_TRACK.clearAt(1000,1000,10),true);
  assert.equal(QUARRY_TRACK.clearAt(NaN,100),false);
  assert.equal(QUARRY_TRACK.clearAt(100,100,Infinity),false);
});
