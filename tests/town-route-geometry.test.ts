import test from 'node:test';
import assert from 'node:assert/strict';
import {TOWN_COURSE as c,TOWN_ROAD_EDGES,TOWN_TRACK,TOWN_LANDMARKS} from '../src/maps/town';
const near=(a:number,b:number,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('original town has genuinely different physical alternate lengths and positions',()=>{
  assert.ok(c.canonicalLength>1400&&c.canonicalLength<1600);
  assert.ok(c.edges.boulevard.length-c.edges.alley.length>50);
  assert.ok(c.edges.boulevard.length-c.edges.alley.length<95, 'alley shortcut must not overwhelm measured scrape risk');
  assert.ok(c.edges.alley.sample(c.edges.alley.length/2).p.clone().sub(c.edges.boulevard.sample(c.edges.boulevard.length/2).p).length()>45);
  assert.ok(c.edges.alley.sample(35).p.x>c.edges.boulevard.sample(35).p.x,'positive lane alley respects existing screen-left controls');
});
test('all support endpoints and default compatibility view agree exactly',()=>{
  for(const [a,b] of [[c.edges.start,c.edges.alley],[c.edges.start,c.edges.boulevard],[c.edges.alley,c.edges.finish],[c.edges.boulevard,c.edges.finish],[c.edges.finish,c.edges.start]]){
    const x=a.sample(a.length),y=b.sample(0);near(x.p.clone().sub(y.p).length(),0);near(x.t.dot(y.t),1);near(x.normal.dot(y.normal),1);near(a.halfWidthAt(a.length),b.halfWidthAt(0));
    for(const lane of [-10,0,10])near(a.sample(a.length,lane).p.clone().sub(b.sample(0,lane).p).length(),0);
  }
  let offset=0;for(const e of [c.edges.start,c.edges.boulevard,c.edges.finish]){for(let s=1;s<e.length;s+=9)near(TOWN_TRACK.sample(offset+s).p.clone().sub(e.sample(s).p).length(),0,1e-5);offset+=e.length;}
});
test('entire sampled ribbons have finite orthonormal frames, safe radii, grade and width taper',()=>{
  for(const e of TOWN_ROAD_EDGES){let minimumRadius=Infinity;
    for(let s=0;s<e.length-1;s+=.5){const f=e.sample(s),g=e.sample(s+1),curvature=Math.abs(Math.atan2(f.t.z*g.t.x-f.t.x*g.t.z,f.t.x*g.t.x+f.t.z*g.t.z));minimumRadius=Math.min(minimumRadius,1/curvature);
      assert.ok(Math.abs(f.grade)<.125);near(f.t.length(),1);near(f.n.length(),1);near(f.normal.length(),1);near(f.t.dot(f.n),0);near(f.t.dot(f.normal),0);
      assert.ok(Math.abs(e.halfWidthAt(s+1)-e.halfWidthAt(s))<.125);
      for(const lane of [-e.halfWidthAt(s),e.halfWidthAt(s)])assert.ok(Object.values(e.sample(s,lane).p).every(Number.isFinite));
    }
    assert.ok(minimumRadius>(e.id==='alley'?13:e.id==='boulevard'?20:25),`${e.id} radius ${minimumRadius}`);
  }
});
test('merge last 35 physical metres is a straight common-width support throat',()=>{
  for(let d=0;d<=35;d++){const a=c.edges.alley.sample(c.edges.alley.length-d),b=c.edges.boulevard.sample(c.edges.boulevard.length-d);assert.ok(Math.acos(Math.min(1,a.t.dot(b.t)))<12*Math.PI/180);near(a.p.clone().sub(b.p).length(),0,1e-4);}
});
test('full ribbon bounds overlap only at connected junctions or named high bridge',()=>{
  const samples=TOWN_ROAD_EDGES.flatMap(e=>Array.from({length:Math.ceil(e.length/2)+1},(_,i)=>{const s=Math.min(e.length,i*2);return {id:e.id,s,len:e.length,p:e.sample(s).p,w:e.halfWidthAt(s)};}));
  let bridgePairs=0,minClearance=Infinity;
  for(let i=0;i<samples.length;i++)for(let j=i+1;j<samples.length;j++){
    const a=samples[i],b=samples[j];if(a.id===b.id&&Math.abs(a.s-b.s)<60)continue;
    if(Math.hypot(a.p.x-b.p.x,a.p.z-b.p.z)>a.w+b.w+2)continue;
    const nearStart=(v:typeof a)=>v.s<TOWN_LANDMARKS.junctionClearance,nearEnd=(v:typeof a)=>v.len-v.s<TOWN_LANDMARKS.junctionClearance;
    const branch=(v:typeof a)=>v.id==='alley'||v.id==='boulevard';
    const junction=a.id!==b.id&&((a.id==='start'&&branch(b)&&nearEnd(a)&&nearStart(b))||(branch(a)&&b.id==='finish'&&nearEnd(a)&&nearStart(b))||(branch(a)&&branch(b)&&((nearStart(a)&&nearStart(b))||(nearEnd(a)&&nearEnd(b))))||(a.id==='start'&&b.id==='finish'&&nearStart(a)&&nearEnd(b)));
    if(junction)continue;
    assert.equal(a.id,'start');assert.equal(b.id,'finish');
    assert.ok(Math.hypot(a.p.x-TOWN_LANDMARKS.crossing.x,a.p.z-TOWN_LANDMARKS.crossing.z)<60,'lower ribbon overlap outside bridge');
    const undersideClearance=Math.abs(a.p.y-b.p.y)-2;minClearance=Math.min(minClearance,undersideClearance);assert.ok(undersideClearance>16);bridgePairs++;
  }
  assert.ok(bridgePairs>100);assert.ok(minClearance>18);
});
