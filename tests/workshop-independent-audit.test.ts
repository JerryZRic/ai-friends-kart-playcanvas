import test from 'node:test';
import assert from 'node:assert/strict';
import {WORKSHOP_COURSE,WORKSHOP_LANDMARKS} from '../src/maps/workshop';
import {buildWorkshopSceneGeometry} from '../src/workshop-scenery';
import {workshopPickupRows} from '../src/land-course-pickups';
import {chaseCamera} from '../src/race-camera';
import {safeLandCamera,cameraMeshCandidateIds,type CameraPoint} from '../src/land-camera';

// The collision oracle below consumes ONLY rendered batch positions/indices.
// It deliberately does not import cameraTerrainHeight, road footprint clipping,
// camera boxes, scene terrainGrid, or roadFaces to prove geometry is unobstructed.
type V=readonly number[];
type Triangle={id:number;batch:string;vertices:readonly number[];a:V;b:V;c:V;min:V;max:V};
const geometry=buildWorkshopSceneGeometry(WORKSHOP_COURSE);
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
      const t:Triangle={id:this.triangles.length,batch:batch.name,vertices:batch.indices.slice(i,i+3),a,b,c,min:[0,1,2].map(k=>Math.min(a[k],b[k],c[k])),max:[0,1,2].map(k=>Math.max(a[k],b[k],c[k]))};
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
const terrainName=geometry.batches.find(b=>b.name==='Workshop joined maple room floor')?.name;
assert.ok(terrainName,'continuous workshop terrain batch exists');
const roadNames=new Set(['Workshop pale sealed maple road','Workshop cabinet road inlay']);
assert.ok([...roadNames].every(name=>geometry.batches.some(b=>b.name===name)),'both workshop rendered road materials exist');
const terrain=mesh.triangles.filter(t=>t.batch===terrainName),roads=mesh.triangles.filter(t=>roadNames.has(t.batch));
function boomFailure(a:V,b:V,label:string):string|null{
  const hit=mesh.firstHit(a,b);if(hit)return `${label}: source mesh ${hit.triangle.batch} triangle ${hit.triangle.id} intersects boom at ${hit.fraction}, anchor:${a}, camera:${b}`;
  let traversed=0;
  for(const t of mesh.query(a,b))if(t.batch===terrainName){
    const interval=projectedInterval(t,a,b);if(!interval)continue;traversed++;
    for(const fraction of interval){const p=lerp(a,b,fraction),clearance=p[1]-height(t,p[0],p[2]);if(clearance<=.3-1e-7)return `${label}: actual terrain clearance ${clearance}`;}
  }return traversed>0?null:`${label}: boom must remain within source terrain`;
}

test('workshop actual static output is finite and stays inside 24 batches / 110k triangles / 200k vertices',t=>{
  let vertices=0,triangles=0;
  assert.equal(geometry.trackId,'workshop');assert.ok(geometry.batches.length<=24);
  for(const b of geometry.batches){
    vertices+=b.positions.length/3;triangles+=b.indices.length/3;
    assert.equal(b.positions.length%3,0);assert.equal(b.indices.length%3,0);assert.equal(b.uvs.length,b.positions.length/3*2);
    assert.ok(b.positions.every(Number.isFinite));assert.ok(b.uvs.every(Number.isFinite));
    assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));
  }
  assert.ok(vertices<200000,`${vertices} vertices`);assert.ok(triangles<110000,`${triangles} triangles`);
  t.diagnostic(`${geometry.batches.length} batches, ${vertices} vertices, ${triangles} source triangles`);
});

test('workshop actual whole booms clear all emitted triangles and terrain at center/edge lanes, orbit extremes and after smoothing',t=>{
  let poses=0,retracted=0,desiredHits=0,failures=0;const examples:string[]=[];
  const inspect=(a:V,b:V,label:string)=>{const failure=boomFailure(a,b,label);if(failure){failures++;if(examples.length<12)examples.push(failure);}};
  for(const edge of Object.values(WORKSHOP_COURSE.edges)){
    const distances=new Set<number>([0,edge.length]);
    for(let s=0;s<edge.length;s+=12)distances.add(s);
    // Both height-separated visits are on start. Keep their physical distances
    // distinct and densify both visits, as well as the entire 120m branch throats.
    for(const s0 of [0,edge.length,...(edge.id==='start'?[WORKSHOP_LANDMARKS.crossing.lowerS,WORKSHOP_LANDMARKS.crossing.upperS]:[]),...(edge.id==='alley'||edge.id==='boulevard'?[80,edge.length-80]:[])])
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

test('every workshop pickup has a 55m source-mesh sightline in both default chase views from three driving lanes',t=>{
  let rays=0;
  for(const pickup of workshopPickupRows(WORKSHOP_COURSE))for(const lane of [-3.5,0,3.5])for(const view of [0,1]){
    const frame=WORKSHOP_COURSE.edges[pickup.edgeId].sample(pickup.s-55,lane),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z};
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

test('actual emitted road top triangles have no positive-area coplanar overlaps at shared workshop junctions',t=>{
  let tested=0;
  for(const a of roads)for(const b of mesh.query(a.min,a.max)){
    if(b.id<=a.id||!roadNames.has(b.batch)||b.min[1]>a.max[1]+1e-7||b.max[1]<a.min[1]-1e-7)continue;
    const overlap=clipPolygon([a.a,a.b,a.c],b);if(overlap.length<3||area(overlap)<1e-7)continue;
    const differences=overlap.map(p=>Math.abs(height(a,p[0],p[2])-height(b,p[0],p[2])));
    assert.ok(differences.some(d=>d>1e-5),`coplanar rendered road triangles ${a.id}/${b.id}, overlap area ${area(overlap)}`);tested++;
  }
  assert.ok(roads.length>3000);t.diagnostic(`${roads.length} actual road top triangles; ${tested} noncoplanar overlapping pairs`);
});

test('actual workshop underside geometry preserves 24.13m clearance over the complete lower road footprint',t=>{
  const c=WORKSHOP_LANDMARKS.crossing,bounds=c.noFillBounds;
  const lower=roads.filter(q=>q.max[1]<c.lowerY+4&&q.min[0]<bounds.maxX&&q.max[0]>bounds.minX&&q.min[2]<bounds.maxZ&&q.max[2]>bounds.minZ);
  let pairs=0,minimum=Infinity;
  for(const road of lower)for(const structure of mesh.query(road.min,road.max)){
    if(structure.batch===terrainName||structure.max[1]<c.lowerY+8||structure.min[1]>c.upperY+1||Math.abs(cross2(structure.a,structure.b,structure.c))<1e-9)continue;
    const overlap=clipPolygon([road.a,road.b,road.c],structure);if(overlap.length<3||area(overlap)<1e-7)continue;
    for(const p of overlap){const clearance=height(structure,p[0],p[2])-height(road,p[0],p[2]);minimum=Math.min(minimum,clearance);assert.ok(clearance>=24.13,`${structure.batch} actual crossing clearance ${clearance}`);}pairs++;
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
test('workshop live camera interpolation remains mesh-clear while crossing split, shared merge and lap seams in either direction',t=>{
  const e=WORKSHOP_COURSE.edges,joins=[[e.start,e.alley],[e.start,e.boulevard],[e.alley,e.finish],[e.boulevard,e.finish],[e.finish,e.start]] as const;
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

// Three-dimensional clipping catches upright piers/walls too. Projected-area
// overlap alone silently discards exactly vertical triangles.
function clipPlane(subject:V[],signed:(p:V)=>number):V[]{
  const out:V[]=[];
  for(let i=0;i<subject.length;i++){
    const a=subject[i],b=subject[(i+1)%subject.length],da=signed(a),db=signed(b);
    if(da>=0)out.push(a);
    if((da>=0)!==(db>=0))out.push(lerp(a,b,da/(da-db)));
  }return out;
}
function area3D(points:V[]){
  let total=0;
  for(let i=2;i<points.length;i++){
    const a=sub(points[i-1],points[0]),b=sub(points[i],points[0]);
    total+=Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])/2;
  }return total;
}
function prismIntersection(triangle:Triangle,road:Triangle,bottom:number,top:number){
  let polygon=[triangle.a,triangle.b,triangle.c];
  const p=[road.a,road.b,road.c],sign=Math.sign(cross2(p[0],p[1],p[2]));
  for(let i=0;i<3&&polygon.length;i++)polygon=clipPlane(polygon,q=>sign*cross2(p[i],p[(i+1)%3],q));
  if(polygon.length)polygon=clipPlane(polygon,q=>q[1]-height(road,q[0],q[2])-bottom);
  if(polygon.length)polygon=clipPlane(polygon,q=>height(road,q[0],q[2])+top-q[1]);
  return polygon;
}

test('all emitted workshop road footprints remain free of scenery and vertical piers through the kart body envelope',t=>{
  let candidates=0,failures=0;const examples:string[]=[];
  for(const road of roads)for(const structure of mesh.query(road.min,road.max)){
    if(roadNames.has(structure.batch)||structure.min[1]>road.max[1]+2.3||structure.max[1]<road.min[1]+.15)continue;
    candidates++;
    const intersection=prismIntersection(structure,road,.15,2.3);
    if(intersection.length<3||area3D(intersection)<1e-7)continue;
    failures++;if(examples.length<12)examples.push(`${structure.batch} triangle ${structure.id} penetrates road triangle ${road.id}, area:${area3D(intersection)}`);
  }
  assert.equal(failures,0,`${failures} actual drivable-footprint obstructions:\n${examples.join('\n')}`);
  assert.ok(candidates>0);t.diagnostic(`${roads.length} actual road triangles; ${candidates} candidate scenery triangles, including vertical surfaces`);
});

test('workshop lower same-edge crossing has a genuinely open 24.13m full-width structural corridor',t=>{
  const c=WORKSHOP_LANDMARKS.crossing,b=c.noFillBounds;
  const lower=roads.filter(q=>q.max[1]<c.lowerY+4&&q.min[0]<b.maxX&&q.max[0]>b.minX&&q.min[2]<b.maxZ&&q.max[2]>b.minZ);
  let candidates=0,failures=0;const examples:string[]=[];
  for(const road of lower)for(const structure of mesh.query(road.min,road.max)){
    if(roadNames.has(structure.batch)||structure.max[1]<road.min[1]+.15||structure.min[1]>road.max[1]+24.13)continue;
    candidates++;const intersection=prismIntersection(structure,road,.15,24.13-1e-6);
    if(intersection.length<3||area3D(intersection)<1e-7)continue;
    failures++;if(examples.length<12)examples.push(`${structure.batch} triangle ${structure.id} fills lower road ${road.id}, area:${area3D(intersection)}`);
  }
  assert.equal(failures,0,`${failures} lower road void intrusions:\n${examples.join('\n')}`);
  assert.ok(lower.length>=30);t.diagnostic(`${lower.length} actual lower road triangles; ${candidates} candidate surfaces; 24.13m checked including upright supports`);
});

test('every workshop driving lane remains supported by the correct actual road deck through the spiral and both same-edge crossing visits',t=>{
  let points=0;
  for(const edge of Object.values(WORKSHOP_COURSE.edges))for(let s=0;s<=edge.length;s=Math.min(edge.length,s+1)){
    for(const side of [-1,-.5,0,.5,1]){
      const frame=edge.sample(s,side*edge.laneLimitAt(s)),p=tuple(frame.p);
      const triangles=mesh.query(p,p).filter(q=>roadNames.has(q.batch)&&projectedInterval(q,p,p));
      assert.ok(triangles.some(q=>Math.abs(height(q,p[0],p[2])-p[1])<.08),`${edge.id}:${s} lane:${side} has no emitted supporting road near physical height ${p[1]}`);points++;
    }
    if(s===edge.length)break;
  }
  assert.ok(points>15000);t.diagnostic(`${points} five-lane source-triangle support checks; both levels remain physically distinct`);
});

test('dense actual workshop crossing camera sequences remain mesh-clear in both travel directions and backward views after interpolation',t=>{
  let frames=0;
  const edge=WORKSHOP_COURSE.commonStart;
  for(const crossingS of [WORKSHOP_LANDMARKS.crossing.lowerS,WORKSHOP_LANDMARKS.crossing.upperS])
    for(const reverse of [false,true])for(const side of [-1,0,1])for(const view of [0,1])for(const rearView of [false,true])for(const pitch of [-.28,0,.78]){
      let previous:CameraPoint|null=null;
      for(let step=0;step<=80;step++){
        const s=crossingS+(reverse?40-step:step-40)*.8,frame=edge.sample(s,side*edge.laneLimitAt(s));
        const anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z},yaw=rearView?0:Math.PI*Math.sin(step/80*Math.PI*2);
        const pose=chaseCamera({position:frame.p,tangent:frame.t,view,rearView,orbit:{yaw,pitch}});
        const desired=safeLandCamera(anchor,pose.position,geometry.cameraObstacles),alpha=1-Math.exp(-8/60);
        const smoothed=previous?{x:previous.x+(desired.x-previous.x)*alpha,y:previous.y+(desired.y-previous.y)*alpha,z:previous.z+(desired.z-previous.z)*alpha}:desired;
        const camera=safeLandCamera(anchor,smoothed,geometry.cameraObstacles);
        const failure=boomFailure(tuple(anchor),tuple(camera),`crossing:${crossingS} reverse:${reverse} lane:${side} view:${view} rear:${rearView} pitch:${pitch} frame:${step}`);
        assert.equal(failure,null);previous=camera;frames++;
      }
    }
  assert.equal(frames,11664);t.diagnostic(`${frames} continuously interpolated 0.8m crossing frames against actual rendered triangles`);
});

test('independent mesh oracle detects vertical obstacles, hidden triangle crossings and narrow terrain peaks',()=>{
  const triangle=(a:V,b:V,c:V):Triangle=>({id:-1,batch:'oracle fixture',vertices:[],a,b,c,min:[0,1,2].map(i=>Math.min(a[i],b[i],c[i])),max:[0,1,2].map(i=>Math.max(a[i],b[i],c[i]))});
  const road=triangle([0,0,0],[10,0,0],[0,0,10]),wall=triangle([2,-1,2],[2,4,2],[2,4,4]);
  assert.ok(area3D(prismIntersection(wall,road,.15,2.3))>1,'upright wall cannot disappear in zero projected area');
  assert.equal(prismIntersection(triangle([20,-1,20],[20,4,20],[20,4,24]),road,.15,2.3).length,0);
  const peak=triangle([4.99,0,-1],[5.02,8,0],[4.99,0,1]);
  const interval=projectedInterval(peak,[0,1,0],[10,1,0]);assert.ok(interval);
  assert.ok(interval[0]<.5&&interval[1]>.5);
  assert.ok(height(peak,5,0)>1,'thin emitted peak is above the boom');
  assert.ok(hitFraction(wall,[0,1,2.5],[4,1,2.5])!==null,'segment traversal hits actual wall triangles');
});

test('actual closed workshop solids never contain any supported driving-lane body, including the lower same-edge underpass',t=>{
  // Primitive ranges identify provenance, but closure, bounds and containment
  // all come from emitted triangles. A claimed blocker box is not an oracle.
  const key=(p:V)=>p.map(n=>Math.round(n*1e7)).join(',');
  const solids:{kind:string;triangles:Triangle[];min:V;max:V}[]=[];
  for(const component of geometry.components){
    const batch=geometry.batches.find(b=>b.name===component.batch);assert.ok(batch);
    const triangles:Triangle[]=[],edges=new Map<string,number>();
    for(let i=0;i<batch.indices.length;i+=3){
      const ids=batch.indices.slice(i,i+3);if(!ids.every(j=>j>=component.vertexStart&&j<component.vertexEnd))continue;
      const [a,b,c]=ids.map(j=>batch.positions.slice(j*3,j*3+3));
      if(area3D([a,b,c])<1e-10)continue;
      triangles.push({id:i/3,batch:batch.name,vertices:ids,a,b,c,min:[0,1,2].map(k=>Math.min(a[k],b[k],c[k])),max:[0,1,2].map(k=>Math.max(a[k],b[k],c[k]))});
      const points=[a,b,c].map(key);for(let k=0;k<3;k++){const edge=[points[k],points[(k+1)%3]].sort().join('|');edges.set(edge,(edges.get(edge)??0)+1);}
    }
    if(!triangles.length||[...edges.values()].some(n=>n!==2))continue;
    solids.push({kind:component.kind,triangles,min:[0,1,2].map(k=>Math.min(...triangles.map(q=>q.min[k]))),max:[0,1,2].map(k=>Math.max(...triangles.map(q=>q.max[k])))});
  }
  let points=0,candidates=0;
  for(const edge of Object.values(WORKSHOP_COURSE.edges))for(let s=0;s<=edge.length;s=Math.min(edge.length,s+2)){
    for(const side of [-1,0,1])for(const lift of [.4,1.5]){
      const frame=edge.sample(s,side*edge.laneLimitAt(s)),point=[frame.p.x,frame.p.y+lift,frame.p.z];points++;
      for(const solid of solids){
        if(point.some((n,k)=>n<=solid.min[k]+1e-6||n>=solid.max[k]-1e-6))continue;candidates++;
        const distance=Math.hypot(...solid.max.map((n,k)=>n-solid.min[k]))*3+1;
        const end=[point[0]+distance,point[1]+distance*.371,point[2]+distance*.529];
        const intersections=solid.triangles.map(q=>hitFraction(q,point,end)).filter((n):n is number=>n!==null).sort((a,b)=>a-b);
        const unique=intersections.filter((n,i)=>!i||n-intersections[i-1]>1e-7);
        assert.equal(unique.length%2,0,`${edge.id}:${s} lane:${side} height:${lift} is inside actual closed ${solid.kind} from ${solid.triangles[0].batch}`);
      }
    }if(s===edge.length)break;
  }
  assert.ok(solids.length>20,'nontrivial closed primitive provenance must be exercised');
  t.diagnostic(`${solids.length} independently verified closed solids; ${points} physical body points, ${candidates} actual-bounds containment candidates`);
});

function actualComponentPoints(component:(typeof geometry.components)[number]){
  const batch=geometry.batches.find(b=>b.name===component.batch);assert.ok(batch);
  return Array.from({length:component.vertexEnd-component.vertexStart},(_,i)=>batch.positions.slice((component.vertexStart+i)*3,(component.vertexStart+i+1)*3));
}
function hullXZ(input:V[]):V[]{
  const points=[...new Map(input.map(p=>[p[0]+','+p[2],p])).values()].sort((a,b)=>a[0]-b[0]||a[2]-b[2]);
  if(points.length<3)return points;const lower:V[]=[],upper:V[]=[];
  for(const p of points){while(lower.length>=2&&cross2(lower.at(-2)!,lower.at(-1)!,p)<=1e-9)lower.pop();lower.push(p);}
  for(const p of [...points].reverse()){while(upper.length>=2&&cross2(upper.at(-2)!,upper.at(-1)!,p)<=1e-9)upper.pop();upper.push(p);}
  return [...lower.slice(0,-1),...upper.slice(0,-1)];
}
function boundsOf(points:readonly V[]){return{min:[0,1,2].map(k=>Math.min(...points.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...points.map(p=>p[k])))};}

test('workshop landmark foundation footprints and all supporting leg corners are grounded in actual emitted support triangles',t=>{
  const floor=terrainName,worktop='Workshop continuous maple worktops';let clipped=0,feet=0;
  for(const foundation of geometry.foundations){
    const component=geometry.components.find(c=>c.kind==='landmark-ground-contact-trim'&&c.landmark===foundation.kind);assert.ok(component);
    const points=actualComponentPoints(component),bounds=boundsOf(points),polygon=hullXZ(points),bottom=bounds.min[1],top=bounds.max[1];
    assert.equal(polygon.length,4);assert.ok(Math.abs(bottom-foundation.bottom)<1e-8&&Math.abs(top-foundation.top)<1e-8);
    const supportBatch=foundation.support==='exact-room-floor'?floor:worktop;let covered=0;
    for(const tri of mesh.query(bounds.min,bounds.max)){
      if(roadNames.has(tri.batch)&&area(clipPolygon(polygon,tri))>1e-7)assert.fail(`${foundation.kind} actual contact footprint overlaps road ${tri.id}`);
      if(tri.batch!==supportBatch||cross2(tri.a,tri.b,tri.c)>-1e-9)continue;
      if(geometry.components.some(c=>c.landmark===foundation.kind&&c.batch===tri.batch&&tri.vertices.every(j=>j>=c.vertexStart&&j<c.vertexEnd)))continue;
      const overlap=clipPolygon(polygon,tri),size=area(overlap);if(size<1e-8)continue;
      const heights=overlap.map(p=>height(tri,p[0],p[2]));
      // Only the real upper support face can support this pad. Soffits and
      // worktop bottoms cannot substitute for contact at the actual foundation.
      if(heights.some(y=>y<bottom-1e-7||y>top+1e-7))continue;
      covered+=size;clipped++;
    }
    assert.ok(Math.abs(covered-area(polygon))<1e-5,`${foundation.kind} actual full contact area:${area(polygon)} but supported:${covered}`);
  }
  for(const detail of geometry.groundedDetails){
    const matches=geometry.components.filter(c=>c.kind===detail.kind&&c.min[0]<=detail.x&&c.max[0]>=detail.x&&c.min[2]<=detail.z&&c.max[2]>=detail.z);
    assert.equal(matches.length,1,`${detail.kind} actual leg must be identifiable`);
    const points=actualComponentPoints(matches[0]),bounds=boundsOf(points),polygon=hullXZ(points);let covered=0;
    for(const tri of mesh.query(bounds.min,bounds.max))if(tri.batch===floor){
      const overlap=clipPolygon(polygon,tri),size=area(overlap);if(size<1e-9)continue;
      for(const p of overlap)assert.ok(bounds.min[1]<=height(tri,p[0],p[2])-.11,`${detail.kind} leg foot floats at ${p}`);
      covered+=size;clipped++;
    }
    assert.ok(Math.abs(covered-area(polygon))<1e-6,`${detail.kind} complete foot must lie within the emitted room floor`);feet++;
  }
  assert.equal(geometry.foundations.length,6);assert.ok(feet>=50);t.diagnostic(`6 actual full-footprint contact pads, ${feet} actual leg footprints against ${clipped} source support intersections`);
});

function subtractTriangleFootprint(subject:V[],triangle:Triangle):V[][]{
  const points=[triangle.a,triangle.b,triangle.c],sign=Math.sign(cross2(points[0],points[1],points[2]));
  let inside=subject;const outside:V[][]=[];
  for(let i=0;i<3&&inside.length;i++){
    const signed=(p:V)=>cross2(points[i],points[(i+1)%3],p)*sign;
    const fragment=clipPlane(inside,p=>-signed(p));if(area(fragment)>1e-9)outside.push(fragment);
    inside=clipPlane(inside,signed);
  }return outside;
}

test('all actual landmark components stay inside reserved circumradii, clear the whole road and have supported lower contacts',t=>{
  let vertices=0,contacts=0;
  const groundKinds=new Set(['clock-grounded-stepped-pedestal','cabinet-bottom-plinth','vise-bolted-round-plinth','drafting-square-stout-foot','lamp-layered-foot','return-stepped-cabinet-body']);
  const supportNames=new Set([terrainName,'Workshop continuous maple worktops','Workshop dark joints and contact trim']);
  for(const landmark of geometry.landmarks){
    const center=landmark.position,radius=landmark.radius;
    for(const road of mesh.query(center,center,radius+19.9))if(roadNames.has(road.batch))assert.ok(triangleDistanceXZ(road,center)>radius+19.9,`${landmark.kind} reserved complete envelope infringes actual road ${road.id}`);
    const components=geometry.components.filter(c=>c.landmark===landmark.kind);assert.ok(components.length>0);
    for(const component of components){
      const points=actualComponentPoints(component);
      for(const p of points){assert.ok(Math.hypot(p[0]-center[0],p[2]-center[2])<=radius+1e-6,`${landmark.kind}/${component.kind} actual vertex escapes reserved radius at ${p}`);vertices++;}
      if(!groundKinds.has(component.kind))continue;
      const bottom=Math.min(...points.map(p=>p[1])),foot=points.filter(p=>p[1]<bottom+1e-7),polygon=hullXZ(foot);assert.ok(polygon.length>=3);
      let uncovered=[polygon];const footBounds=boundsOf(polygon);
      for(const triangle of mesh.query(footBounds.min,footBounds.max)){
        if(!supportNames.has(triangle.batch)||cross2(triangle.a,triangle.b,triangle.c)>-1e-9)continue;
        if(triangle.batch===component.batch&&triangle.vertices.every(j=>j>=component.vertexStart&&j<component.vertexEnd))continue;
        const sourcePart=geometry.components.find(c=>c.batch===triangle.batch&&triangle.vertices.every(j=>j>=c.vertexStart&&j<c.vertexEnd));
        if(sourcePart?.landmark&&sourcePart.kind!=='landmark-ground-contact-trim')continue;
        const overlap=clipPolygon(polygon,triangle);if(area(overlap)<1e-9||overlap.some(p=>Math.abs(height(triangle,p[0],p[2])-bottom)>=.025))continue;
        uncovered=uncovered.flatMap(poly=>subtractTriangleFootprint(poly,triangle));
      }
      assert.ok(uncovered.reduce((n,poly)=>n+area(poly),0)<1e-5,`${landmark.kind}/${component.kind} lacks complete actual lower footprint support`);

      // Every footprint corner plus 0.5m edge samples must contact real support.
      const probes=polygon.flatMap((p,i)=>{const next=polygon[(i+1)%polygon.length],n=Math.max(1,Math.ceil(Math.hypot(next[0]-p[0],next[2]-p[2])/.5));return Array.from({length:n},(_,j)=>lerp(p,next,j/n));});
      probes.push([polygon.reduce((n,p)=>n+p[0],0)/polygon.length,bottom,polygon.reduce((n,p)=>n+p[2],0)/polygon.length]);
      for(const p of probes){
        const candidates=mesh.query(p,p,1e-7).filter(q=>supportNames.has(q.batch)&&!(q.batch===component.batch&&q.vertices.every(j=>j>=component.vertexStart&&j<component.vertexEnd))&&projectedInterval(q,p,p));
        const supported=candidates.some(q=>Math.abs(height(q,p[0],p[2])-bottom)<.025);
        assert.ok(supported,`${landmark.kind}/${component.kind} actual lower contact is unsupported at ${p}`);contacts++;
      }
    }
  }
  assert.ok(vertices>10000);assert.ok(contacts>1000);t.diagnostic(`${vertices} actual landmark vertices inside surveyed radii; ${contacts} actual bottom-contact samples`);
});

test('four authored workshop landmark sightlines remain visible through the complete source geometry',t=>{
  for(const line of geometry.sightlines){
    const target=geometry.landmarks.find(l=>l.kind===line.targetId);assert.ok(target);
    assert.ok(Math.hypot(line.target[0]-target.position[0],line.target[2]-target.position[2])<target.radius);
    const targetHit=mesh.firstHit(line.eye,line.target);
    assert.ok(targetHit,`${line.name} sight ray must actually reach a modeled landmark, not empty reservation air`);
    assert.ok(geometry.components.some(c=>c.landmark===target.kind&&c.batch===targetHit.triangle.batch&&targetHit.triangle.vertices.every(j=>j>=c.vertexStart&&j<c.vertexEnd)),`${line.name} first visible mesh must belong to intended landmark, saw ${targetHit.triangle.batch}`);
    const blocked=mesh.query(line.eye,line.target).filter(triangle=>{
      // Only the intended target's actual parts may terminate its view. No
      // unrelated nearby geometry is exempted by a broad target-radius box.
      const targetParts=geometry.components.filter(c=>c.landmark===target.kind&&c.batch===triangle.batch);
      if(targetParts.some(c=>triangle.vertices.every(j=>j>=c.vertexStart&&j<c.vertexEnd)))return false;
      return hitFraction(triangle,line.eye,line.target)!==null;
    });
    assert.deepEqual(blocked.map(q=>({batch:q.batch,id:q.id})).slice(0,12),[],`${line.name} actual target view is occluded`);
  }
  assert.equal(geometry.sightlines.length,4);t.diagnostic('4 whole-source center rays to three distinct modeled workshop landmarks; no all-material 3m foreground-clearance claim');
});

test('workshop whole default and orbit booms retain a physical 0.3m margin from every emitted triangle',t=>{
  let booms=0,minimum=Infinity,failures=0;const examples:string[]=[];
  for(const edge of Object.values(WORKSHOP_COURSE.edges))for(let s=0;s<=edge.length;s=Math.min(edge.length,s+8)){
    for(const side of [-1,0,1])for(const view of [0,1])for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/2])for(const pitch of [-.28,.78]){
      const frame=edge.sample(s,side*edge.laneLimitAt(s)),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z};
      const desired=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:false,orbit:{yaw,pitch}}).position;
      const camera=safeLandCamera(anchor,desired,geometry.cameraObstacles),a=tuple(anchor),b=tuple(camera);
      for(const triangle of mesh.query(a,b,.3)){
        if(triangle.min[1]>Math.max(a[1],b[1])+.3||triangle.max[1]<Math.min(a[1],b[1])-.3)continue;
        const distance=segmentTriangleDistance(a,b,triangle);minimum=Math.min(minimum,distance);
        if(distance<.3-1e-6){failures++;if(examples.length<12)examples.push(`${edge.id}:${s} lane:${side} view:${view} yaw:${yaw} pitch:${pitch}, ${triangle.batch} triangle ${triangle.id} physical boom clearance:${distance}, anchor:${a}, camera:${b}`);}
      }booms++;
    }if(s===edge.length)break;
  }
  assert.equal(failures,0,`${failures} insufficient source-mesh clearance cases:\n${examples.join('\n')}`);
  assert.ok(booms>18000);t.diagnostic(`${booms} complete boom-to-triangle distance probes; minimum near-surface clearance ${minimum.toFixed(6)}m`);
});

test('actual workshop mesh camera broadphase includes all intersecting source bounds while inspecting only local corridors',t=>{
  let queries=0,maxCandidates=0,sourceTriangles=0;
  for(const blocker of geometry.cameraObstacles){
    if(!blocker.triangles)continue;const triangles=blocker.triangles;sourceTriangles+=triangles.length;
    const bounds=triangles.map(points=>boundsOf(points));
    for(const edge of Object.values(WORKSHOP_COURSE.edges))for(let s=0;s<edge.length;s+=80)for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/2]){
      const frame=edge.sample(s),anchor={x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z},desired=chaseCamera({position:frame.p,tangent:frame.t,view:1,rearView:false,orbit:{yaw,pitch:-.28}}).position;
      const ids=cameraMeshCandidateIds(triangles,anchor,desired),set=new Set(ids),a=tuple(anchor),b=tuple(desired);
      const min=a.map((n,i)=>Math.min(n,b[i])-.45),max=a.map((n,i)=>Math.max(n,b[i])+.45);
      bounds.forEach((box,i)=>{if(box.min[0]<=max[0]&&box.max[0]>=min[0]&&box.min[2]<=max[2]&&box.max[2]>=min[2])assert.ok(set.has(i),`mesh broadphase omitted actual near-boom triangle ${i}`);});
      assert.ok(ids.length<triangles.length*.2,`${ids.length}/${triangles.length} camera candidates is not a local query`);maxCandidates=Math.max(maxCandidates,ids.length);queries++;
    }
  }
  assert.ok(queries>100);assert.ok(sourceTriangles>5000);t.diagnostic(`${queries} bounded actual mesh queries, maximum ${maxCandidates} candidates from ${sourceTriangles} source camera triangles`);
});

test('actual cabinet tools rise above every crown and have unobstructed front-facing source-surface views',t=>{
  const target=geometry.landmarks.find(l=>l.kind==='tool-cabinet-bank');assert.ok(target);
  const parts=geometry.components.filter(c=>c.landmark===target.kind);
  const crowns=parts.filter(c=>c.kind==='cabinet-crown-lip');assert.equal(crowns.length,3);
  const crownTop=Math.max(...crowns.flatMap(c=>actualComponentPoints(c).map(p=>p[1])));
  const tools=parts.filter(c=>/^pegboard-(ruler-tool|mallet-handle|mallet-head|caliper-spine|caliper-jaw)$/.test(c.kind));assert.equal(tools.length,6);
  let rays=0;
  for(const tool of tools){
    const points=actualComponentPoints(tool),bounds=boundsOf(points);
    assert.ok(bounds.min[1]>crownTop+.5,`${tool.kind} actual geometry remains hidden below a cabinet crown`);
    const faces=mesh.triangles.filter(q=>q.batch===tool.batch&&q.vertices.every(j=>j>=tool.vertexStart&&j<tool.vertexEnd));assert.ok(faces.length>0);
    const targets=faces.map(q=>[0,1,2].map(k=>(q.a[k]+q.b[k]+q.c[k])/3)).sort((a,b)=>a[2]-b[2]);
    const visible=targets.slice(0,Math.min(4,targets.length)).some(point=>{
      const eye=[point[0],point[1],bounds.min[2]-12],hit=mesh.firstHit(eye,point);rays++;
      return hit&&tools.some(c=>c.batch===hit.triangle.batch&&hit.triangle.vertices.every(j=>j>=c.vertexStart&&j<c.vertexEnd));
    });
    assert.ok(visible,`${tool.kind} has no front ray reaching actual tool geometry before shells/backboard`);
  }
  for(const landmark of geometry.landmarks){
    const plot=WORKSHOP_LANDMARKS.plots.find(p=>p.id===landmark.kind);assert.ok(plot);
    assert.equal(plot.height,landmark.height,`${landmark.kind} scene/map height reservations disagree`);
    for(const component of geometry.components.filter(c=>c.landmark===landmark.kind))
      for(const p of actualComponentPoints(component))assert.ok(p[1]<=landmark.position[1]+landmark.height+1e-6,`${landmark.kind}/${component.kind} escapes the actual vertical reservation`);
  }
  t.diagnostic(`${tools.length} actual tool components clear all3crown tops and are visible on ${rays} front-surface probes; all six landmark heights fit source vertices`);
});
