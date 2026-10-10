import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {buildQuarrySceneGeometry,QUARRY_SCENE_THEME} from '../src/quarry-scenery';
import {QUARRY_COURSE,QUARRY_ROAD_EDGES,QUARRY_TRACK,QUARRY_LANDMARKS} from '../src/maps/quarry';
import {footprintArea,intersectRoadFootprint,RoadFootprintIndex,roadFootprint,sampleRoadFootprints} from '../src/land-road-mesh';
const geometry=buildQuarrySceneGeometry(QUARRY_COURSE);
const sourceIndex=new RoadFootprintIndex(sampleRoadFootprints(QUARRY_ROAD_EDGES));
const ground=geometry.batches.find(b=>b.name==='Quarry continuous dry working floor')!;
function terrainHeight(x:number,z:number){
  const {minX,minZ,dx,dz,columns}=geometry.terrainGrid,gx=(x-minX)/dx,gz=(z-minZ)/dz,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,i=iz*columns+ix;
  const y=(j:number)=>ground.positions[j*3+1],a=y(i),b=y(i+1),c=y(i+columns),d=y(i+columns+1);
  return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}
test('original quarry is dry finite source geometry within 20-batch static budgets',()=>{
  assert.equal(geometry.trackId,'quarry');assert.equal(geometry.batches.length,20);
  let vertices=0,triangles=0;
  for(const b of geometry.batches){
    vertices+=b.positions.length/3;triangles+=b.indices.length/3;
    assert.equal(b.positions.length%3,0);assert.equal(b.indices.length%3,0);assert.equal(b.uvs.length,b.positions.length/3*2);
    assert.ok(b.positions.every(Number.isFinite));assert.ok(b.uvs.every(Number.isFinite));
    assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));
  }
  assert.ok(vertices<200000,`vertices ${vertices}`);assert.ok(triangles<110000,`triangles ${triangles}`);
  assert.equal(new Set(geometry.batches.filter(b=>b.texture!=='none').map(b=>b.texture)).size,3);
  assert.ok(!geometry.batches.some(b=>/town|roof|pine|water|ocean|reflection/i.test(b.name)));
  for(const kind of ['feed-hopper','stepped-cut-face','timber-counterweight-derrick','double-belt-transfer','stone-cassette-yard','strata-monolith','dry-cut-trestle'])assert.equal(geometry.landmarks.filter(l=>l.kind===kind).length,1,kind);
  assert.equal(geometry.landmarks.filter(l=>l.kind==='extraction-bench').length,5);
  assert.ok(geometry.props.filter(p=>p.kind==='roadside-stone-workset').length>=20);
  assert.equal(geometry.props.filter(p=>p.kind==='quarry-fork-wayfinding').length,2);
  assert.equal(QUARRY_SCENE_THEME.sky,'#e5caa0');
});
test('all four quarry ribbons use exact physical samples and one paired underside per retained face',()=>{
  assert.equal(geometry.routeRoadSamples.length,QUARRY_ROAD_EDGES.reduce((n,e)=>n+Math.ceil(e.length/1.65),0));
  for(const sample of geometry.routeRoadSamples){
    const edge=QUARRY_ROAD_EDGES.find(e=>e.id===sample.edgeId)!;
    for(const [lateral,p] of [[-edge.halfWidthAt(sample.distance),sample.left],[edge.halfWidthAt(sample.distance),sample.right]] as const)assert.ok(edge.sample(sample.distance,lateral).p.distance(new pc.Vec3(...p))<1e-8);
  }
  assert.equal(geometry.roadFaces.length,geometry.roadUndersideFaces.length);
  for(let i=0;i<geometry.roadFaces.length;i++)for(let j=0;j<3;j++){
    const a=geometry.roadFaces[i].points[j],b=geometry.roadUndersideFaces[i].points[2-j];
    assert.ok(Math.abs(a[0]-b[0])<1e-8&&Math.abs(a[2]-b[2])<1e-8);assert.ok(Math.abs(a[1]-b[1]-.6)<1e-8);
  }
});
test('every planar junction has exact footprint ownership including the long shared merge',()=>{
  const faces=geometry.roadFaces.map(f=>roadFootprint(QUARRY_ROAD_EDGES.find(e=>e.id===f.edgeId)!,f.distance,f.points.map(p=>new pc.Vec3(...p))));
  const index=new RoadFootprintIndex(faces),ids=new Map(faces.map((f,i)=>[f,i]));let tested=0;
  for(const a of faces)for(const b of index.query(a.minX,a.maxX,a.minZ,a.maxZ)){
    if(ids.get(a)!>=ids.get(b)!||a.edge===b.edge||a.maxY<b.minY-.005||a.minY>b.maxY+.005)continue;
    const intersection=intersectRoadFootprint(a.points,b.points);assert.ok(footprintArea(intersection)<1e-6,`duplicate ${a.edge.id}:${a.distance} / ${b.edge.id}:${b.distance}`);tested++;
  }
  assert.ok(tested>250);
  const original=sampleRoadFootprints([QUARRY_COURSE.alternates.alley]);
  assert.ok(original.some(f=>QUARRY_COURSE.alternates.alley.length-f.distance>50&&QUARRY_COURSE.alternates.alley.length-f.distance<120&&
    faces.filter(g=>g.edge===f.edge&&g.distance===f.distance).reduce((n,g)=>n+footprintArea(g.points),0)<original.filter(g=>g.distance===f.distance).reduce((n,g)=>n+footprintArea(g.points),0)-.01));
  // Keep support across the whole road union, not just absence of duplicate tops.
  for(const edge of QUARRY_ROAD_EDGES)for(let s=1;s<edge.length;s+=3.7)for(const l of [-.8,0,.8]){
    const p=edge.sample(s,edge.halfWidthAt(s)*l).p,candidates=index.query(p.x-.1,p.x+.1,p.z-.1,p.z+.1);
    assert.ok(candidates.some(f=>f.minY<=p.y+.2&&f.maxY>=p.y-.2&&!new RoadFootprintIndex([f]).clearAt(p.x,p.z,.06)),`missing road ${edge.id}:${s}:${l}`);
  }
});
test('continuous terrain stays below every ribbon including the dry lower crossing',()=>{
  for(const edge of QUARRY_ROAD_EDGES)for(let s=0;s<=edge.length;s+=2.3)for(const l of [-1,0,1]){
    const p=edge.sample(s,l*edge.halfWidthAt(s)).p;assert.ok(terrainHeight(p.x,p.z)<p.y-1.1,`fill intersects ${edge.id}:${s}:${l}`);
  }
  const {crossing}=QUARRY_LANDMARKS;assert.ok(terrainHeight(crossing.x,crossing.z)<crossing.lowerY-1.1);
});
test('all quarry props and complete foundations clear the road union and reach actual terrain',()=>{
  for(const p of geometry.props){
    assert.ok(QUARRY_TRACK.clearAt(p.x,p.z,p.radius),`${p.kind} has unsafe road radius`);
    assert.ok(sourceIndex.clearAt(p.x,p.z,p.radius+4.9999),`${p.kind} intersects exact road footprint`);
    assert.ok(geometry.foundations.some(f=>f.kind===p.kind&&Math.hypot((f.footprint[0][0]+f.footprint[2][0])/2-p.x,(f.footprint[0][2]+f.footprint[2][2])/2-p.z)<1e-7),`${p.kind} lacks foundation`);
  }
  for(const f of geometry.foundations){
    const [a,b,,d]=f.footprint;
    for(let i=0;i<=18;i++)for(let j=0;j<=18;j++){
      const x=a[0]+(b[0]-a[0])*i/18+(d[0]-a[0])*j/18,z=a[2]+(b[2]-a[2])*i/18+(d[2]-a[2])*j/18,h=terrainHeight(x,z);
      assert.ok(f.bottom<h-.49,`${f.kind} floats at ${x},${z}`);assert.ok(f.top>h+.11,`${f.kind} buried at ${x},${z}`);
      assert.ok(sourceIndex.clearAt(x,z,0),`${f.kind} foundation crosses a road`);
    }
    assert.ok(geometry.cameraObstacles.some(o=>o.kind===f.kind+'-foundation'&&Math.abs(o.min[1]-f.bottom)<1e-8));
  }
});
test('foundation caps have one visible outward top and no duplicated internal interface',()=>{
  const masonry=geometry.batches.find(b=>b.name==='Quarry solid footing foundations')!,paving=geometry.batches.find(b=>b.name==='Quarry freshly sawn sandstone edges')!;
  for(const f of geometry.foundations){
    const inspect=(batch:typeof masonry,start:number,expectedTopTriangles:number)=>{
      const p=Array.from({length:24},(_,i)=>new pc.Vec3(...batch.positions.slice((start+i)*3,(start+i+1)*3))),top=Math.max(...p.map(v=>v.y)),bottom=Math.min(...p.map(v=>v.y));let topCount=0;
      for(let i=0;i<24;i+=4)if(p.slice(i,i+4).every(v=>Math.abs(v.y-top)<1e-8)){
        assert.ok(new pc.Vec3().cross(p[i+2].clone().sub(p[i]),p[i+1].clone().sub(p[i])).normalize().y>.999999);topCount++;
      }assert.equal(topCount,1);
      let renderedTopTriangles=0;
      for(let i=0;i<batch.indices.length;i+=3){const ids=batch.indices.slice(i,i+3);if(ids.every(j=>j>=start&&j<start+24)&&ids.every(j=>Math.abs(batch.positions[j*3+1]-top)<1e-8))renderedTopTriangles++;}
      assert.equal(renderedTopTriangles,expectedTopTriangles);return {top,bottom};
    };
    const a=inspect(masonry,f.masonryVertexStart,0),b=inspect(paving,f.pavingVertexStart,2);
    assert.ok(Math.abs(a.bottom-f.bottom)<1e-8);assert.ok(Math.abs(a.top-b.bottom)<1e-8);assert.ok(Math.abs(b.top-f.top)<1e-8);assert.ok(b.top-a.top>.0999);
  }
});
test('trestle preserves measured underside clearance and outside-corridor grounded bents',()=>{
  assert.equal(geometry.structures.length,1);assert.ok(geometry.structures[0].overheadClearance>=22.753);
  const lower=QUARRY_COURSE.commonStart,upper=QUARRY_COURSE.commonFinish;
  const lowerIndex=new RoadFootprintIndex(sampleRoadFootprints([lower]));
  for(const member of geometry.trestleMembers){
    if(member.kind==='shallow-chord'||member.kind==='cross-sleeper'){
      for(const p of member.points){
        let nearest=Infinity,y=0;for(let s=498;s<=612;s+=.5){const q=upper.sample(s).p,d=Math.hypot(p[0]-q.x,p[2]-q.z);if(d<nearest){nearest=d;y=q.y;}}
        assert.ok(p[1]>=y-2.4,`too deep: ${member.kind}`);
      }
    }else{
      for(const p of member.points)assert.ok(lowerIndex.clearAt(p[0],p[2],5),`${member.kind} enters lower road corridor`);
    }
  }
  assert.equal(geometry.trestleMembers.filter(m=>m.kind==='outside-corridor-post').length,8);
  assert.ok(geometry.cameraObstacles.some(o=>o.kind==='trestle-open-knee-brace'));
  assert.ok(geometry.cameraObstacles.every(o=>[...o.min,...o.max].every(Number.isFinite)&&o.min.every((n,i)=>n<o.max[i])));
  assert.ok(!geometry.cameraObstacles.some(o=>o.kind==='dry-cut-trestle'),'open trestle must not get one giant opaque camera box');
});

test('cassette slabs sit on real sleepers and spacers without floating gaps',()=>{
  const parts=geometry.cameraObstacles,slabs=parts.filter(p=>p.kind==='cassette-yard-stone-slab'),spacers=parts.filter(p=>p.kind==='cassette-yard-slab-spacer'),sleepers=parts.filter(p=>p.kind==='cassette-yard-sleeper');
  assert.ok(slabs.length>=24);
  for(const slab of slabs){
    const touching=[...spacers,...sleepers].filter(p=>Math.abs(p.max[1]-slab.min[1])<1e-8&&p.min[0]<slab.max[0]&&p.max[0]>slab.min[0]&&p.min[2]<slab.max[2]&&p.max[2]>slab.min[2]);
    assert.ok(touching.length>=2,'each slab needs two touching supports');
  }
  assert.equal(parts.filter(p=>p.kind==='hopper-tapered-bin-wall').length,4);
});

test('derrick hoist and counterweight lines physically connect from frame to suspended load',()=>{
  const parts=geometry.cameraObstacles,one=(kind:string)=>{const p=parts.filter(p=>p.kind===kind);assert.equal(p.length,1);return p[0];};
  const suspension=one('derrick-hoist-suspension-beam'),counterSuspension=one('derrick-counterweight-suspension-beam'),spreader=one('derrick-hook-spreader'),hanger=one('derrick-hook-hanger'),hook=one('derrick-hook-block'),weight=one('derrick-suspended-counterweight');
  const endpoint=(p:typeof hanger,upper:boolean)=>[(p.min[0]+p.max[0])/2,upper?p.max[1]:p.min[1],(p.min[2]+p.max[2])/2];
  const contains=(box:typeof hanger,p:number[])=>p.every((v,i)=>v>=box.min[i]-1e-8&&v<=box.max[i]+1e-8);
  for(const line of parts.filter(p=>p.kind==='derrick-static-hoist-line')){assert.ok(contains(suspension,endpoint(line,true)));assert.ok(contains(spreader,endpoint(line,false)));}
  for(const line of parts.filter(p=>p.kind==='derrick-counterweight-chain')){assert.ok(contains(counterSuspension,endpoint(line,true)));assert.ok(contains(weight,endpoint(line,false)));}
  assert.ok(contains(spreader,endpoint(hanger,true)));assert.ok(contains(hook,endpoint(hanger,false)));
});

test('two outer extraction walls have distinct elongated silhouettes and unequal terrace counts',()=>{
  const cuts=geometry.landmarks.filter(p=>p.kind==='extraction-bench');
  assert.equal(cuts.length,5);assert.equal(cuts.filter(p=>/three-break|four-break/.test(p.label)).length,2);
  const bounds=geometry.cameraObstacles.filter(p=>p.kind==='extraction-bench-cut-face');
  assert.equal(bounds.length,22); // 5 + 3 + 5 + 4 + 5
  assert.ok(bounds.filter(p=>(p.max[0]-p.min[0])/(p.max[2]-p.min[2])>2.7).length>=7);
});
