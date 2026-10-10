import test from 'node:test';
import assert from 'node:assert/strict';
import {FOREST_COURSE,FOREST_LANDMARKS} from '../src/maps/forest';
import {buildForestSceneGeometry} from '../src/forest-scenery';
import {forestPickupRows} from '../src/land-course-pickups';
import {chaseCamera} from '../src/race-camera';
import {safeLandCamera,type CameraPoint} from '../src/land-camera';

// The collision oracle below consumes ONLY rendered batch positions/indices.
// It deliberately does not import cameraTerrainHeight, road footprint clipping,
// camera boxes, scene terrainGrid, or roadFaces to prove geometry is unobstructed.
type V=readonly number[];
type Triangle={id:number;batch:string;a:V;b:V;c:V;min:V;max:V};
const geometry=buildForestSceneGeometry(FOREST_COURSE);
const tuple=(p:CameraPoint):V=>[p.x,p.y,p.z];
const lerp=(a:V,b:V,t:number):V=>a.map((n,i)=>n+(b[i]-n)*t);
const cross2=(a:V,b:V,p:V)=>(b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]);
const area=(p:V[])=>Math.abs(p.reduce((v,a,i)=>{const b=p[(i+1)%p.length];return v+a[0]*b[2]-a[2]*b[0];},0))/2;
const height=(t:Triangle,x:number,z:number)=>{
  const {a,b,c}=t,den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
  const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den;
  const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
  return u*a[1]+v*b[1]+(1-u-v)*c[1];
};
function clipPolygon(subject:V[],triangle:Triangle):V[]{
  let p=subject;const c=[triangle.a,triangle.b,triangle.c],sign=Math.sign(cross2(c[0],c[1],c[2]));
  for(let i=0;i<3&&p.length;i++){
    const a=c[i],b=c[(i+1)%3],out:V[]=[];
    for(let j=0;j<p.length;j++){
      const q=p[j],r=p[(j+1)%p.length],dq=cross2(a,b,q)*sign,dr=cross2(a,b,r)*sign;
      if(dq>=0)out.push(q);if((dq>=0)!==(dr>=0))out.push(lerp(q,r,dq/(dq-dr)));
    }p=out;
  }return p;
}
// Exact projected interval, so thin source-terrain peaks cannot slip between
// arbitrary boom sample points. Heights are linear across each source triangle.
function projectedInterval(t:Triangle,a:V,b:V):[number,number]|null{
  const p=[t.a,t.b,t.c],sign=Math.sign(cross2(p[0],p[1],p[2]));if(!sign)return null;
  let lo=0,hi=1;
  for(let i=0;i<3;i++){
    const q=p[i],r=p[(i+1)%3],da=cross2(q,r,a)*sign,db=cross2(q,r,b)*sign,delta=db-da;
    if(Math.abs(delta)<1e-12){if(da< -1e-8)return null;continue;}
    const at=-da/delta;if(delta>0)lo=Math.max(lo,at);else hi=Math.min(hi,at);
    if(lo>hi+1e-10)return null;
  }return [Math.max(0,lo),Math.min(1,hi)];
}
function hitFraction(t:Triangle,o:V,end:V):number|null{
  const dx=end[0]-o[0],dy=end[1]-o[1],dz=end[2]-o[2];
  const ex=t.b[0]-t.a[0],ey=t.b[1]-t.a[1],ez=t.b[2]-t.a[2],fx=t.c[0]-t.a[0],fy=t.c[1]-t.a[1],fz=t.c[2]-t.a[2];
  const hx=dy*fz-dz*fy,hy=dz*fx-dx*fz,hz=dx*fy-dy*fx,det=ex*hx+ey*hy+ez*hz;if(Math.abs(det)<1e-10)return null;
  const sx=o[0]-t.a[0],sy=o[1]-t.a[1],sz=o[2]-t.a[2],u=(sx*hx+sy*hy+sz*hz)/det;if(u< -1e-9||u>1+1e-9)return null;
  const qx=sy*ez-sz*ey,qy=sz*ex-sx*ez,qz=sx*ey-sy*ex,v=(dx*qx+dy*qy+dz*qz)/det;if(v< -1e-9||u+v>1+1e-9)return null;
  const d=(fx*qx+fy*qy+fz*qz)/det;return d>1e-7&&d<1+1e-7?d:null;
}
class MeshOracle {
  triangles:Triangle[]=[];private cells=new Map<string,Triangle[]>();private seen:Uint32Array;private stamp=0;
  constructor(){
    for(const batch of geometry.batches)for(let i=0;i<batch.indices.length;i+=3){
      const [a,b,c]=batch.indices.slice(i,i+3).map(v=>batch.positions.slice(v*3,v*3+3));
      const t:Triangle={id:this.triangles.length,batch:batch.name,a,b,c,min:[0,1,2].map(k=>Math.min(a[k],b[k],c[k])),max:[0,1,2].map(k=>Math.max(a[k],b[k],c[k]))};
      this.triangles.push(t);
      for(let x=Math.floor(t.min[0]/16);x<=Math.floor(t.max[0]/16);x++)for(let z=Math.floor(t.min[2]/16);z<=Math.floor(t.max[2]/16);z++){
        const key=x+','+z,list=this.cells.get(key)??[];list.push(t);this.cells.set(key,list);
      }
    }this.seen=new Uint32Array(this.triangles.length);
  }
  query(a:V,b:V,margin=0){
    const min=a.map((v,i)=>Math.min(v,b[i])-margin),max=a.map((v,i)=>Math.max(v,b[i])+margin),found:Triangle[]=[];this.stamp++;
    for(let x=Math.floor(min[0]/16);x<=Math.floor(max[0]/16);x++)for(let z=Math.floor(min[2]/16);z<=Math.floor(max[2]/16);z++)for(const t of this.cells.get(x+','+z)??[]){
      if(this.seen[t.id]===this.stamp)continue;this.seen[t.id]=this.stamp;
      if(t.min[0]<=max[0]&&t.max[0]>=min[0]&&t.min[2]<=max[2]&&t.max[2]>=min[2])found.push(t);
    }return found;
  }
  firstHit(a:V,b:V){
    let result:{triangle:Triangle;fraction:number}|null=null;
    for(const t of this.query(a,b)){
      if(t.min[1]>Math.max(a[1],b[1])||t.max[1]<Math.min(a[1],b[1]))continue;
      const fraction=hitFraction(t,a,b);if(fraction!==null&&(!result||fraction<result.fraction))result={triangle:t,fraction};
    }return result;
  }
}
const mesh=new MeshOracle();
// These are actual rendered batch identities, independent of the camera payload.
const terrainName=geometry.batches.find(b=>b.name==='Forest connected moss ridge terrain')?.name;
assert.ok(terrainName,'continuous forest terrain batch exists');
const roadNames=new Set(['Forest packed cedar needle road','Forest observatory service stone']);
assert.ok([...roadNames].every(name=>geometry.batches.some(b=>b.name===name)),'both forest rendered road materials exist');
const terrain=mesh.triangles.filter(t=>t.batch===terrainName),roads=mesh.triangles.filter(t=>roadNames.has(t.batch));
function boomFailure(a:V,b:V,label:string):string|null{
  const hit=mesh.firstHit(a,b);if(hit)return `${label}: source mesh ${hit.triangle.batch} triangle ${hit.triangle.id} intersects boom at ${hit.fraction}, anchor:${a}, camera:${b}`;
  let traversed=0;
  for(const t of mesh.query(a,b))if(t.batch===terrainName){
    const interval=projectedInterval(t,a,b);if(!interval)continue;traversed++;
    for(const fraction of interval){const p=lerp(a,b,fraction),clearance=p[1]-height(t,p[0],p[2]);if(clearance<=.3-1e-7)return `${label}: actual terrain clearance ${clearance}`;}
  }return traversed>0?null:`${label}: boom must remain within source terrain`;
}

test('forest actual static output is finite and stays inside 24 batches / 110k triangles / 200k vertices',t=>{
  let vertices=0,triangles=0;
  assert.equal(geometry.trackId,'forest');assert.ok(geometry.batches.length<=24);
  for(const b of geometry.batches){
    vertices+=b.positions.length/3;triangles+=b.indices.length/3;
    assert.equal(b.positions.length%3,0);assert.equal(b.indices.length%3,0);assert.equal(b.uvs.length,b.positions.length/3*2);
    assert.ok(b.positions.every(Number.isFinite));assert.ok(b.uvs.every(Number.isFinite));
    assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));
  }
  assert.ok(vertices<200000,`${vertices} vertices`);assert.ok(triangles<110000,`${triangles} triangles`);
  t.diagnostic(`${geometry.batches.length} batches, ${vertices} vertices, ${triangles} source triangles`);
});

test('forest actual whole booms clear all emitted triangles and terrain at center/edge lanes, orbit extremes and after smoothing',t=>{
  let poses=0,retracted=0,desiredHits=0,failures=0;const examples:string[]=[];
  const inspect=(a:V,b:V,label:string)=>{const failure=boomFailure(a,b,label);if(failure){failures++;if(examples.length<12)examples.push(failure);}};
  for(const edge of Object.values(FOREST_COURSE.edges)){
    const distances=new Set<number>([0,edge.length]);
    for(let s=0;s<edge.length;s+=12)distances.add(s);
    // Independently densify both source decks and both shared branch throats.
    for(const s0 of [0,edge.length,edge.id==='start'?FOREST_LANDMARKS.crossing.lowerS:edge.id==='finish'?FOREST_LANDMARKS.crossing.upperS:-100])
      for(let s=Math.max(0,s0-42);s<=Math.min(edge.length,s0+42);s+=3)distances.add(s);
    for(const s of distances)for(const side of [-1,0,1])for(const view of [0,1])for(let angle=0;angle<8;angle++)for(const pitch of [-.28,0,.78]){
      const yaw=-Math.PI+angle*Math.PI/4,lane=side*edge.laneLimitAt(s),frame=edge.sample(s,lane),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z};
      const desired=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:false,orbit:{yaw,pitch}}).position;
      const safe=safeLandCamera(anchor,desired,geometry.cameraObstacles),label=`${edge.id}:${s.toFixed(2)} lane:${side} view:${view} yaw:${angle} pitch:${pitch}`;
      assert.ok(Object.values(safe).every(Number.isFinite));
      if(Math.hypot(safe.x-desired.x,safe.y-desired.y,safe.z-desired.z)>.01)retracted++;
      if(mesh.firstHit(tuple(anchor),tuple(desired)))desiredHits++;
      inspect(tuple(anchor),tuple(safe),label+' desired');
      // Runtime smooths previous safe pose, THEN rechecks the current anchor.
      // Move2.4m (high-speed frame), drift0.25m and rotate mouse yaw0.6rad.
      const priorS=Math.max(0,s-2.4),prior=edge.sample(priorS,side*Math.max(0,edge.laneLimitAt(priorS)-.25));
      const priorAnchor={x:prior.p.x,y:prior.p.y+1.35,z:prior.p.z};
      const priorDesired=chaseCamera({position:prior.p,tangent:prior.t,view,rearView:false,orbit:{yaw:yaw+.6,pitch}}).position;
      const priorSafe=safeLandCamera(priorAnchor,priorDesired,geometry.cameraObstacles),alpha=1-Math.exp(-8/60);
      const smoothed={x:priorSafe.x+(safe.x-priorSafe.x)*alpha,y:priorSafe.y+(safe.y-priorSafe.y)*alpha,z:priorSafe.z+(safe.z-priorSafe.z)*alpha};
      const final=safeLandCamera(anchor,smoothed,geometry.cameraObstacles);
      inspect(tuple(anchor),tuple(final),label+' smoothed');poses++;
    }
  }
  assert.equal(failures,0,`${failures} actual boom failures:\n${examples.join('\n')}`);
  assert.ok(poses>37000);assert.ok(desiredHits>0,'actual source obstructions are exercised');assert.ok(retracted>0);
  t.diagnostic(`${poses} desired plus ${poses} genuinely interpolated booms; ${desiredHits} raw desired source hits; ${retracted} retractions`);
});

test('every forest pickup has a 55m source-mesh sightline in both default chase views from three driving lanes',t=>{
  let rays=0;
  for(const pickup of forestPickupRows(FOREST_COURSE))for(const lane of [-3.5,0,3.5])for(const view of [0,1]){
    const frame=FOREST_COURSE.edges[pickup.edgeId].sample(pickup.s-55,lane),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z};
    const pose=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:false,orbit:{yaw:0,pitch:0}});
    const camera=safeLandCamera(anchor,pose.position,geometry.cameraObstacles),target=[pickup.p.x,pickup.p.y+1.25,pickup.p.z],hit=mesh.firstHit(tuple(camera),target);
    assert.ok(!hit,`${pickup.edgeId}:${pickup.s} item lane:${pickup.lateral} actor lane:${lane} view:${view}, blocked by ${hit?.triangle.batch}, triangle ${hit?.triangle.id}`);
    // Actual default race pose retains its original look target after safety
    // retraction. Verify the item also lies inside 56 degree,16:9 chase framing.
    const forward=tuple(pose.look).map((n,i)=>n-tuple(camera)[i]),fl=Math.hypot(...forward);forward.forEach((_,i)=>forward[i]/=fl);
    const right=[-forward[2],0,forward[0]],rl=Math.hypot(...right);right.forEach((_,i)=>right[i]/=rl);
    const up=[right[1]*forward[2]-right[2]*forward[1],right[2]*forward[0]-right[0]*forward[2],right[0]*forward[1]-right[1]*forward[0]];
    const ray=target.map((n,i)=>n-tuple(camera)[i]),dot=(v:V)=>v.reduce((n,x,i)=>n+x*ray[i],0),depth=dot(forward),tan=Math.tan(28*Math.PI/180);
    assert.ok(depth>0&&Math.abs(dot(right))<depth*tan*16/9&&Math.abs(dot(up))<depth*tan,`${pickup.edgeId}:${pickup.s} actor lane:${lane} view:${view} outside default 56 degree 16:9 chase framing`);rays++;
  }
  assert.equal(rays,96);t.diagnostic(`${rays} clear 55m authored pickup rays against every source triangle`);
});

test('actual emitted road top triangles have no positive-area coplanar overlaps at shared forest junctions',t=>{
  let tested=0;
  for(const a of roads)for(const b of mesh.query(a.min,a.max)){
    if(b.id<=a.id||!roadNames.has(b.batch)||b.min[1]>a.max[1]+1e-7||b.max[1]<a.min[1]-1e-7)continue;
    const overlap=clipPolygon([a.a,a.b,a.c],b);if(overlap.length<3||area(overlap)<1e-7)continue;
    const differences=overlap.map(p=>Math.abs(height(a,p[0],p[2])-height(b,p[0],p[2])));
    assert.ok(differences.some(d=>d>1e-5),`coplanar rendered road triangles ${a.id}/${b.id}, overlap area ${area(overlap)}`);tested++;
  }
  assert.ok(roads.length>3000);t.diagnostic(`${roads.length} actual road top triangles; ${tested} noncoplanar overlapping pairs`);
});

test('actual canopy underside geometry preserves 21.46m clearance over the complete lower road footprint',t=>{
  const c=FOREST_LANDMARKS.crossing,bounds=c.noFillBounds;
  const lower=roads.filter(q=>q.max[1]<c.lowerY+4&&q.min[0]<bounds.maxX&&q.max[0]>bounds.minX&&q.min[2]<bounds.maxZ&&q.max[2]>bounds.minZ);
  let pairs=0,minimum=Infinity;
  for(const road of lower)for(const structure of mesh.query(road.min,road.max)){
    if(structure.batch===terrainName||structure.max[1]<c.lowerY+8||structure.min[1]>c.upperY+1||Math.abs(cross2(structure.a,structure.b,structure.c))<1e-9)continue;
    const overlap=clipPolygon([road.a,road.b,road.c],structure);if(overlap.length<3||area(overlap)<1e-7)continue;
    for(const p of overlap){const clearance=height(structure,p[0],p[2])-height(road,p[0],p[2]);minimum=Math.min(minimum,clearance);assert.ok(clearance>=21.46,`${structure.batch} actual crossing clearance ${clearance}`);}pairs++;
  }
  assert.ok(pairs>100);t.diagnostic(`${pairs} actual crossing overlap pairs; minimum ${minimum.toFixed(6)}m source clearance`);
});

function terrainAt(x:number,z:number){
  const p=[x,0,z],triangle=mesh.query(p,p).find(t=>t.batch===terrainName&&projectedInterval(t,p,p));
  assert.ok(triangle,`actual ground missing at ${x},${z}`);return height(triangle,x,z);
}
function triangleDistanceXZ(t:Triangle,p:V){
  if(projectedInterval(t,p,p))return 0;
  const points=[t.a,t.b,t.c];return Math.min(...points.map((a,i)=>{
    const b=points[(i+1)%3],x=b[0]-a[0],z=b[2]-a[2],u=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[2]-a[2])*z)/(x*x+z*z)));
    return Math.hypot(p[0]-a[0]-u*x,p[2]-a[2]-u*z);
  }));
}
test('forest complete prop radii and actual foundation footprints are grounded and clear every rendered road',t=>{
  for(const p of geometry.props){
    const center=[p.x,p.y,p.z],radius=p.radius+4.99;
    for(const road of mesh.query(center,center,radius))if(roadNames.has(road.batch))
      assert.ok(triangleDistanceXZ(road,center)>radius,`${p.kind} prop envelope infringes rendered road triangle ${road.id}`);
  }
  const masonry=geometry.batches.find(b=>b.name==='Forest observatory foundation masonry')!;
  const paving=geometry.batches.find(b=>b.name==='Forest pale road coping and foundation caps')!;
  let clippedCells=0;
  for(const f of geometry.foundations){
    const lower=Array.from({length:24},(_,i)=>masonry.positions.slice((f.masonryVertexStart+i)*3,(f.masonryVertexStart+i+1)*3));
    const upper=Array.from({length:24},(_,i)=>paving.positions.slice((f.pavingVertexStart+i)*3,(f.pavingVertexStart+i+1)*3));
    const bottom=Math.min(...lower.map(p=>p[1])),joint=Math.max(...lower.map(p=>p[1])),top=Math.max(...upper.map(p=>p[1]));
    assert.ok(Math.abs(Math.min(...upper.map(p=>p[1]))-joint)<1e-8,`${f.kind} cap has a floating interface`);
    const unique=[...new Map(lower.map(p=>[p[0]+','+p[2],p])).values()];assert.equal(unique.length,4);
    const cx=unique.reduce((v,p)=>v+p[0],0)/4,cz=unique.reduce((v,p)=>v+p[2],0)/4;
    const polygon=unique.sort((a,b)=>Math.atan2(a[2]-cz,a[0]-cx)-Math.atan2(b[2]-cz,b[0]-cx));
    const min=[Math.min(...polygon.map(p=>p[0])),bottom,Math.min(...polygon.map(p=>p[2]))],max=[Math.max(...polygon.map(p=>p[0])),top,Math.max(...polygon.map(p=>p[2]))];
    let coveredArea=0;
    for(const triangle of mesh.query(min,max)){
      if(triangle.batch!==terrainName&&!roadNames.has(triangle.batch))continue;
      const overlap=clipPolygon(polygon,triangle),size=area(overlap);if(size<1e-8)continue;
      if(roadNames.has(triangle.batch))assert.fail(`${f.kind} actual foundation overlaps actual road`);
      coveredArea+=size;clippedCells++;
      for(const p of overlap){const h=height(triangle,p[0],p[2]);assert.ok(bottom<h-.49,`${f.kind} actual footing floats above terrain`);assert.ok(top>h+.109,`${f.kind} actual cap is buried`);}
    }
    assert.ok(Math.abs(coveredArea-area(polygon))<1e-5,`${f.kind} foundation exceeds source terrain`);
    // No touching internal top/bottom faces survive the final rendered indices.
    const count=(b:typeof masonry,start:number,y:number)=>Array.from({length:b.indices.length/3},(_,i)=>b.indices.slice(i*3,i*3+3)).filter(ids=>ids.every(j=>j>=start&&j<start+24&&Math.abs(b.positions[j*3+1]-y)<1e-8)).length;
    assert.equal(count(masonry,f.masonryVertexStart,joint),0,`${f.kind} hidden lower cap remains coplanar`);
    assert.equal(count(paving,f.pavingVertexStart,joint),0,`${f.kind} hidden upper base remains coplanar`);
    assert.equal(count(paving,f.pavingVertexStart,top),2,`${f.kind} exactly one visible upper cap`);
  }
  const trunks=geometry.components.filter(c=>c.kind==='cedar-tapered-trunk');
  for(const component of trunks){
    const b=geometry.batches.find(b=>b.name===component.batch)!,points=Array.from({length:component.vertexEnd-component.vertexStart},(_,i)=>b.positions.slice((component.vertexStart+i)*3,(component.vertexStart+i+1)*3));
    const bottom=Math.min(...points.map(p=>p[1])),foot=points.filter(p=>p[1]<bottom+.15);
    assert.ok(foot.length>0);for(const p of foot)assert.ok(p[1]<terrainAt(p[0],p[2])-.1,`${component.kind} actual foot floats at ${p}, terrain:${terrainAt(p[0],p[2])}, vertexStart:${component.vertexStart}`);
  }
  assert.ok(geometry.foundations.length>=6);assert.ok(trunks.length>=30);
  t.diagnostic(`${geometry.props.length} prop envelopes; ${geometry.foundations.length} full-footprint foundations against ${clippedCells} clipped terrain triangles; ${trunks.length} actual trunk feet`);
});

test('forest live camera interpolation remains mesh-clear while crossing split, shared merge and lap seams in either direction',t=>{
  const e=FOREST_COURSE.edges,joins=[[e.start,e.alley],[e.start,e.boulevard],[e.alley,e.finish],[e.boulevard,e.finish],[e.finish,e.start]] as const;
  let frames=0;
  for(const [from,to] of joins)for(const reverse of [false,true])for(const side of [-1,0,1])for(const view of [0,1])for(const rearView of [false,true]){
    let previous:CameraPoint|null=null;
    for(let step=0;step<=24;step++){
      const offset=(reverse?12-step:step-12)*1.4,edge=offset<0?from:to,s=offset<0?from.length+offset:offset;
      const sample=edge.sample(s,side*edge.laneLimitAt(s)),anchor={x:sample.p.x,y:sample.p.y+1.35,z:sample.p.z};
      const pose=chaseCamera({position:sample.p,tangent:sample.t,view,rearView,orbit:{yaw:0,pitch:0}});
      const desired=safeLandCamera(anchor,pose.position,geometry.cameraObstacles),alpha=1-Math.exp(-8/60);
      const smooth=previous?{x:previous.x+(desired.x-previous.x)*alpha,y:previous.y+(desired.y-previous.y)*alpha,z:previous.z+(desired.z-previous.z)*alpha}:desired;
      const camera=safeLandCamera(anchor,smooth,geometry.cameraObstacles),failure=boomFailure(tuple(anchor),tuple(camera),`${from.id}>${to.id} reverse:${reverse} side:${side} view:${view} rear:${rearView} step:${step}`);
      assert.equal(failure,null);previous=camera;frames++;
    }
  }
  assert.equal(frames,3000);t.diagnostic(`${frames} actual interpolated seam frames, both directions and both branch choices`);
});

const sub=(a:V,b:V):V=>a.map((n,i)=>n-b[i]);
const dot=(a:V,b:V)=>a.reduce((n,v,i)=>n+v*b[i],0);
const lengthSquared=(a:V)=>dot(a,a);
function pointTriangleDistanceSquared(p:V,t:Triangle){
  const ab=sub(t.b,t.a),ac=sub(t.c,t.a),ap=sub(p,t.a),d1=dot(ab,ap),d2=dot(ac,ap);
  if(d1<=0&&d2<=0)return lengthSquared(ap);
  const bp=sub(p,t.b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return lengthSquared(bp);
  const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0)return lengthSquared(sub(p,lerp(t.a,t.b,d1/(d1-d3))));
  const cp=sub(p,t.c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return lengthSquared(cp);
  const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0)return lengthSquared(sub(p,lerp(t.a,t.c,d2/(d2-d6))));
  const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0)return lengthSquared(sub(p,lerp(t.b,t.c,(d4-d3)/(d4-d3+d5-d6))));
  const den=1/(va+vb+vc),v=vb*den,w=vc*den;
  return lengthSquared(sub(p,t.a.map((n,i)=>n+ab[i]*v+ac[i]*w)));
}
function segmentDistanceSquared(p:V,q:V,a:V,b:V){
  const d=sub(q,p),e=sub(b,a),r=sub(p,a),dd=dot(d,d),ee=dot(e,e),de=dot(d,e),dr=dot(d,r),er=dot(e,r),clamp=(v:number)=>Math.max(0,Math.min(1,v));
  let s=dd*ee-de*de>1e-12?clamp((de*er-dr*ee)/(dd*ee-de*de)):0,t=ee>1e-12?(de*s+er)/ee:0;
  if(t<0){t=0;s=dd>1e-12?clamp(-dr/dd):0;}else if(t>1){t=1;s=dd>1e-12?clamp((de-dr)/dd):0;}
  return lengthSquared(sub(lerp(p,q,s),lerp(a,b,t)));
}
function segmentTriangleDistance(a:V,b:V,t:Triangle){
  if(hitFraction(t,a,b)!==null)return 0;
  return Math.sqrt(Math.min(pointTriangleDistanceSquared(a,t),pointTriangleDistanceSquared(b,t),segmentDistanceSquared(a,b,t.a,t.b),segmentDistanceSquared(a,b,t.b,t.c),segmentDistanceSquared(a,b,t.c,t.a)));
}

test('four authored forest landmark views reach the actual observatory through the complete source mesh',t=>{
  const observatory=FOREST_LANDMARKS.plots.find(p=>p.id==='abandoned-observatory')!;
  for(const line of geometry.sightlines){
    assert.ok(Math.hypot(line.target[0]-observatory.x,line.target[2]-observatory.z)<1e-8);
    const blocked=mesh.query(line.eye,line.target,line.radius).filter(triangle=>{
      // The intended observatory silhouette terminates the sightline. Only its
      // authored footprint is exempt; trees/terrain/other landmarks stay tested.
      if([triangle.a,triangle.b,triangle.c].every(p=>Math.hypot(p[0]-observatory.x,p[2]-observatory.z)<observatory.radius))return false;
      // A 3m sphere around a 1.6m road-level eye necessarily includes
      // foreground road. The full-source certificate is the exact center ray;
      // the authored 3m foliage reservation is checked separately and exactly.
      const cedar=/cedar bough fans|fissured cedar bark/.test(triangle.batch);
      return hitFraction(triangle,line.eye,line.target)!==null||(cedar&&segmentTriangleDistance(line.eye,line.target,triangle)<line.radius-1e-6);
    });
    assert.deepEqual(blocked.map(q=>({batch:q.batch,id:q.id})).slice(0,12),[],`${line.name} actual observatory view is occluded`);
  }
  assert.equal(geometry.sightlines.length,4);t.diagnostic('4 full-source observatory center rays and 3m cedar crown/trunk reservations; no all-material 3m foreground-clearance claim');
});
