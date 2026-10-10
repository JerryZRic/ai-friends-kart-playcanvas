// Independent emitted-geometry audit. These tests use rendered positions/indices,
// never planned volumes, camera height answers, scene-provided road faces or
// claimed component bounds as proof. Source provenance identifies parts only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {HARVEST_COURSE,HARVEST_LANDMARKS,HARVEST_BARN} from '../src/maps/harvest';
import {buildHarvestSceneGeometry} from '../src/harvest-scenery';
import {harvestPickupRows} from '../src/land-course-pickups';
import {chaseCamera} from '../src/race-camera';
import {safeLandCamera,cameraMeshCandidateIds,type CameraPoint} from '../src/land-camera';

// The collision oracle below consumes ONLY rendered batch positions/indices.
// It deliberately does not import cameraTerrainHeight, road footprint clipping,
// camera boxes, scene terrainGrid, or roadFaces to prove geometry is unobstructed.
type V=readonly number[];
type Triangle={id:number;batch:string;vertices:readonly number[];a:V;b:V;c:V;min:V;max:V};
const geometry=buildHarvestSceneGeometry(HARVEST_COURSE);
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
const terrainName=geometry.batches.find(b=>b.name==='Harvest connected contour earth')?.name;
assert.ok(terrainName,'continuous harvest terrain batch exists');
const roadNames=new Set(['Harvest packed ochre racing earth','Harvest pale yard pavers and coping']);
assert.ok([...roadNames].every(name=>geometry.batches.some(b=>b.name===name)),'both harvest rendered road materials exist');
const terrain=mesh.triangles.filter(t=>t.batch===terrainName);
function boomFailure(a:V,b:V,label:string):string|null{
  const hit=mesh.firstHit(a,b);if(hit)return `${label}: source mesh ${hit.triangle.batch} triangle ${hit.triangle.id} intersects boom at ${hit.fraction}, anchor:${a}, camera:${b}`;
  let traversed=0;
  for(const t of mesh.query(a,b))if(t.batch===terrainName){
    const interval=projectedInterval(t,a,b);if(!interval)continue;traversed++;
    for(const fraction of interval){const p=lerp(a,b,fraction),clearance=p[1]-height(t,p[0],p[2]);if(clearance<=.3-1e-7)return `${label}: actual terrain clearance ${clearance}`;}
  }
  if(!traversed)return `${label}: boom must remain within source terrain`;
  for(const triangle of mesh.query(a,b,.3)){
    if(triangle.min[1]>Math.max(a[1],b[1])+.3||triangle.max[1]<Math.min(a[1],b[1])-.3)continue;
    const clearance=segmentTriangleDistance(a,b,triangle);
    if(clearance<.3-1e-6)return `${label}: actual physical clearance ${clearance} from ${triangle.batch} triangle ${triangle.id}, anchor:${a}, camera:${b}`;
  }return null;
}

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

function subtractTriangleFootprint(subject:V[],triangle:Triangle):V[][]{
  const points=[triangle.a,triangle.b,triangle.c],sign=Math.sign(cross2(points[0],points[1],points[2]));
  let inside=subject;const outside:V[][]=[];
  for(let i=0;i<3&&inside.length;i++){
    const signed=(p:V)=>cross2(points[i],points[(i+1)%3],p)*sign;
    const fragment=clipPlane(inside,p=>-signed(p));if(area(fragment)>1e-9)outside.push(fragment);
    inside=clipPlane(inside,signed);
  }return outside;
}


type Component=(typeof geometry.components)[number];
const componentsByBatch=new Map<string,Component[]>();
for(const c of geometry.components){const list=componentsByBatch.get(c.batch)??[];list.push(c);componentsByBatch.set(c.batch,list);}
for(const list of componentsByBatch.values())list.sort((a,b)=>a.vertexStart-b.vertexStart);
const componentOf=new Map<number,Component>(),componentTriangles=new Map<Component,Triangle[]>();
for(const triangle of mesh.triangles){
  const list=componentsByBatch.get(triangle.batch)??[],vertex=Math.min(...triangle.vertices);let lo=0,hi=list.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(list[mid].vertexStart<=vertex)lo=mid+1;else hi=mid;}
  const c=list[lo-1];if(c&&triangle.vertices.every(v=>v>=c.vertexStart&&v<c.vertexEnd)){
    componentOf.set(triangle.id,c);const triangles=componentTriangles.get(c)??[];triangles.push(triangle);componentTriangles.set(c,triangles);
  }
}
// The pale material is shared by drivable yard faces and decorative coping.
// Primitive provenance labels the coping only; all geometric proof still uses
// the actual rendered triangles and independently reconstructed physical road.
const roads=mesh.triangles.filter(t=>roadNames.has(t.batch)&&componentOf.get(t.id)?.kind!=='road-edge-coping');
const roadIds=new Set(roads.map(t=>t.id));
const actualBounds=new Map(geometry.components.map(c=>[c,boundsOf(actualComponentPoints(c))]));
const belongs=(triangle:Triangle,c:Component)=>componentOf.get(triangle.id)===c;
const shapeKey=(p:V)=>p.map(n=>Math.round(n*1e7)).join(',');
function supportCoverage(polygon:V[],accept:(t:Triangle,p:V[])=>boolean){
  const bounds=boundsOf(polygon);let remaining=[polygon],intersections=0;
  for(const triangle of mesh.query(bounds.min,bounds.max)){
    if(Math.abs(cross2(triangle.a,triangle.b,triangle.c))<1e-9)continue;
    const overlap=clipPolygon(polygon,triangle);if(area(overlap)<1e-9||!accept(triangle,overlap))continue;
    remaining=remaining.flatMap(poly=>subtractTriangleFootprint(poly,triangle));intersections++;
  }
  return {uncovered:remaining.reduce((n,p)=>n+area(p),0),intersections};
}
function fullGroundContact(c:Component,tolerance=.001){
  const bounds=actualBounds.get(c)!,polygon=hullXZ(actualComponentPoints(c));let low=Infinity,high=-Infinity;
  const coverage=supportCoverage(polygon,(t,p)=>{
    if(t.batch!==terrainName)return false;
    for(const point of p){const y=height(t,point[0],point[2]);low=Math.min(low,y);high=Math.max(high,y);}
    return true;
  });
  assert.ok(coverage.uncovered<1e-5,`${c.kind} missing actual full-footprint terrain:${coverage.uncovered}`);
  assert.ok(bounds.min[1]<=low+tolerance,`${c.kind} floats over low terrain:${bounds.min[1]} > ${low}`);
  assert.ok(bounds.max[1]>high+.01,`${c.kind} is buried at highest terrain:${bounds.max[1]} <= ${high}`);
  return coverage.intersections;
}
function fullBottomContact(c:Component,allowed:(other:Component|undefined,t:Triangle)=>boolean,tolerance=.025){
  const points=actualComponentPoints(c),bottom=actualBounds.get(c)!.min[1],foot=hullXZ(points.filter(p=>p[1]<=bottom+1e-7));
  assert.ok(area(foot)>1e-8,`${c.kind} has a measurable complete bottom footprint`);
  const result=supportCoverage(foot,(t,p)=>!belongs(t,c)&&cross2(t.a,t.b,t.c)<-1e-9&&allowed(componentOf.get(t.id),t)&&p.every(q=>Math.abs(height(t,q[0],q[2])-bottom)<=tolerance));
  assert.ok(result.uncovered<1e-5,`${c.kind} lacks ${result.uncovered}m² of complete actual lower support at y${bottom}`);
  return result.intersections;
}
function actualContact(a:Component,b:Component,tolerance=.025){
  const ba=actualBounds.get(a)!,bb=actualBounds.get(b)!;
  if(ba.min.some((n,k)=>n>bb.max[k]+tolerance)||ba.max.some((n,k)=>n<bb.min[k]-tolerance))return false;
  for(const triangle of componentTriangles.get(a)??[])for(const other of componentTriangles.get(b)??[]){
    if(triangle.min.some((n,k)=>n>other.max[k]+tolerance)||triangle.max.some((n,k)=>n<other.min[k]-tolerance))continue;
    if(segmentTriangleDistance(triangle.a,triangle.b,other)<=tolerance||segmentTriangleDistance(triangle.b,triangle.c,other)<=tolerance||segmentTriangleDistance(triangle.c,triangle.a,other)<=tolerance||segmentTriangleDistance(other.a,other.b,triangle)<=tolerance||segmentTriangleDistance(other.b,other.c,triangle)<=tolerance||segmentTriangleDistance(other.c,other.a,triangle)<=tolerance)return true;
  }return false;
}

test('harvest emitted geometry has finite indexed data and measures under 24 batches / 110k triangles / 200k vertices',t=>{
  let vertices=0,triangles=0;assert.equal(geometry.trackId,'harvest');
  for(const b of geometry.batches){
    vertices+=b.positions.length/3;triangles+=b.indices.length/3;
    assert.equal(b.positions.length%3,0);assert.equal(b.indices.length%3,0);assert.equal(b.uvs.length,b.positions.length/3*2);
    assert.ok(b.positions.every(Number.isFinite));assert.ok(b.uvs.every(Number.isFinite));
    assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));
  }
  assert.ok(geometry.batches.length<=24);assert.ok(vertices<200000,`${vertices} vertices`);assert.ok(triangles<110000,`${triangles} triangles`);
  for(const c of geometry.components){
    const bounds=actualBounds.get(c)!;assert.ok((componentTriangles.get(c)?.length??0)>0,`${c.kind} provenance has no emitted faces`);
    for(let k=0;k<3;k++){assert.ok(Math.abs(bounds.min[k]-c.min[k])<1e-7);assert.ok(Math.abs(bounds.max[k]-c.max[k])<1e-7);}
  }
  t.diagnostic(`${geometry.batches.length} actual batches, ${vertices} vertices, ${triangles} triangles, ${geometry.components.length} verified source component ranges`);
});

test('harvest actual road ownership is positive, single-covered and fully supports the complete physical width',t=>{
  let overlaps=0,points=0,polygons=0;
  const coping=geometry.components.filter(c=>c.kind==='road-edge-coping');assert.ok(coping.length>100,'visual coping is distinguished from physical road by source provenance');
  for(const c of coping)for(const triangle of componentTriangles.get(c)??[])assert.ok(cross2(triangle.a,triangle.b,triangle.c)<-1e-9,`coping ${triangle.id} has nonpositive actual upward surface`);
  for(const road of roads){
    assert.ok(cross2(road.a,road.b,road.c)<-1e-9,`road ${road.id} has nonpositive actual upward surface`);
    for(const other of mesh.query(road.min,road.max)){
      if(other.id<=road.id||!roadIds.has(other.id))continue;
      const intersection=clipPolygon([road.a,road.b,road.c],other);if(area(intersection)<1e-7)continue;
      assert.fail(`unintended harvest rendered road overlap ${road.id}/${other.id}, ${area(intersection)}m²; no elevated crossing is designed`);
    }overlaps++;
  }
  for(const edge of Object.values(HARVEST_COURSE.edges)){
    // This source ribbon is reconstructed independently from physical edge
    // sampling, without trusting roadFaces or production union clipping.
    const n=Math.ceil(edge.length/1.65);
    for(let i=0;i<n;i++){
      const s=i/n*edge.length,next=(i+1)/n*edge.length;
      const a=tuple(edge.sample(s,-edge.halfWidthAt(s)).p),b=tuple(edge.sample(s,edge.halfWidthAt(s)).p),c=tuple(edge.sample(next,-edge.halfWidthAt(next)).p),d=tuple(edge.sample(next,edge.halfWidthAt(next)).p);
      for(const [v0,v1,v2] of [[a,c,b],[b,c,d]]){
        const reference:Triangle={id:-1,batch:'independent physical width',vertices:[],a:v0,b:v1,c:v2,...boundsOf([v0,v1,v2])};
        const coverage=supportCoverage([v0,v1,v2],(t,p)=>roadIds.has(t.id)&&p.every(q=>Math.abs(height(t,q[0],q[2])-height(reference,q[0],q[2]))<.025));
        assert.ok(coverage.uncovered<1e-5,`${edge.id}:${s} full-width surface lacks ${coverage.uncovered}m² of actual support`);polygons++;
      }
    }
    for(let s=0;s<=edge.length;s=Math.min(edge.length,s+1)){
      for(const side of [-1,-.5,0,.5,1]){
        const p=tuple(edge.sample(s,side*edge.laneLimitAt(s)).p);
        assert.ok(mesh.query(p,p,.03).some(t=>roadIds.has(t.id)&&projectedInterval(t,p,p)&&Math.abs(height(t,p[0],p[2])-p[1])<.08),`${edge.id}:${s} legal lane:${side} has no physical rendered support`);points++;
      }if(s===edge.length)break;
    }
  }
  assert.ok(overlaps>3000&&polygons>3000&&points>15000);t.diagnostic(`${overlaps} positive actual road triangles, ${polygons} exact independent whole-width source polygons, ${points} five-legal-lane physical support probes`);
});

test('harvest terrain supports every complete road footprint and scenery never penetrates the full-width kart envelope',t=>{
  let covered=0,candidates=0;
  for(const road of roads){
    const coverage=supportCoverage([road.a,road.b,road.c],(triangle,p)=>{
      if(triangle.batch!==terrainName)return false;
      for(const point of p){const gap=height(road,point[0],point[2])-height(triangle,point[0],point[2]);assert.ok(gap>=.15&&gap<4,`actual road ${road.id} terrain support gap ${gap}`);}return true;
    });
    assert.ok(coverage.uncovered<1e-5,`road ${road.id} lacks continuous connected terrain support`);covered++;
    for(const structure of mesh.query(road.min,road.max)){
      if(roadIds.has(structure.id)||structure.min[1]>road.max[1]+2.3||structure.max[1]<road.min[1]+.15)continue;candidates++;
      const intersection=prismIntersection(structure,road,.15,2.3);
      assert.ok(intersection.length<3||area3D(intersection)<1e-7,`${structure.batch}/${componentOf.get(structure.id)?.kind} triangle ${structure.id} penetrates road ${road.id}`);
    }
  }
  t.diagnostic(`${covered} complete road/terrain support polygons; ${candidates} actual body-volume candidate faces, including vertical walls`);
});

test('harvest barn preserves its 48m architectural aperture and 18m full-road roof headroom with visible lane boundaries',t=>{
  const b=HARVEST_BARN,min=[b.center.x-b.interiorHalfWidth+1e-5,b.floorY+.15,-b.exteriorHalfLength],max=[b.center.x+b.interiorHalfWidth-1e-5,b.undersideY-1e-5,b.exteriorHalfLength];let candidates=0;
  for(const triangle of mesh.query(min,max)){
    // The 48m span is architecture, not a 48m driveable racing lane. Intentional
    // low road-edge rails remain visible; separate whole-road body and camera
    // capsule tests include every one of their actual triangles without waiver.
    if(['exposed-farm-road-rail','road-rail-grounded-post'].includes(componentOf.get(triangle.id)?.kind??''))continue;
    let polygon=[triangle.a,triangle.b,triangle.c];
    for(let k=0;k<3;k++){polygon=clipPlane(polygon,p=>p[k]-min[k]);polygon=clipPlane(polygon,p=>max[k]-p[k]);}
    assert.ok(area3D(polygon)<1e-7,`${triangle.batch}/${componentOf.get(triangle.id)?.kind} actual triangle ${triangle.id} fills the barn interior or portal`);candidates++;
  }
  const underBarn=roads.filter(t=>t.min[0]<b.center.x+5.7&&t.max[0]>b.center.x-5.7&&t.min[2]<28&&t.max[2]>-28);let roofPairs=0,minimum=Infinity;
  for(const road of underBarn)for(const triangle of mesh.query(road.min,road.max)){
    if(triangle.max[1]<b.undersideY-.01||Math.abs(cross2(triangle.a,triangle.b,triangle.c))<1e-9)continue;
    const overlap=clipPolygon([road.a,road.b,road.c],triangle);if(area(overlap)<1e-8)continue;
    for(const p of overlap){const clearance=height(triangle,p[0],p[2])-height(road,p[0],p[2]);minimum=Math.min(minimum,clearance);assert.ok(clearance>=18-1e-6,`${triangle.batch} actual barn road headroom:${clearance}`);}roofPairs++;
  }
  assert.ok(underBarn.length>40&&roofPairs>40);t.diagnostic(`${candidates} actual interior candidate triangles; ${roofPairs} exact roof/road intersections, minimum ${minimum}m`);
});

test('harvest actual closed solids do not contain any driving body or barn interior probe',t=>{
  const solids:{component:Component;triangles:Triangle[];min:V;max:V}[]=[];
  for(const c of geometry.components){
    const triangles=(componentTriangles.get(c)??[]).filter(t=>area3D([t.a,t.b,t.c])>1e-10),edges=new Map<string,number>();
    for(const t of triangles){const p=[t.a,t.b,t.c].map(shapeKey);for(let k=0;k<3;k++){const edge=[p[k],p[(k+1)%3]].sort().join('|');edges.set(edge,(edges.get(edge)??0)+1);}}
    if(triangles.length&&[...edges.values()].every(n=>n===2))solids.push({component:c,triangles,...actualBounds.get(c)!});
  }
  const assertOutside=(point:V,label:string,architectural=false)=>{
    for(const solid of solids){
      if(architectural&&['exposed-farm-road-rail','road-rail-grounded-post'].includes(solid.component.kind))continue;
      if(point.some((n,k)=>n<=solid.min[k]+1e-6||n>=solid.max[k]-1e-6))continue;
      const distance=Math.hypot(...solid.max.map((n,k)=>n-solid.min[k]))*3+1,end=[point[0]+distance,point[1]+distance*.371,point[2]+distance*.529];
      const hits=solid.triangles.map(t=>hitFraction(t,point,end)).filter((n):n is number=>n!==null).sort((a,b)=>a-b),unique=hits.filter((n,i)=>!i||n-hits[i-1]>1e-7);
      assert.equal(unique.length%2,0,`${label} is inside actual closed ${solid.component.kind}`);
    }
  };
  let probes=0;
  for(const edge of Object.values(HARVEST_COURSE.edges))for(let s=0;s<=edge.length;s=Math.min(edge.length,s+2)){
    for(const lane of [-1,0,1])for(const lift of [.4,1.5]){const p=edge.sample(s,lane*edge.laneLimitAt(s)).p;assertOutside([p.x,p.y+lift,p.z],`${edge.id}:${s}/${lane}/${lift}`);probes++;}if(s===edge.length)break;
  }
  for(let x=HARVEST_BARN.center.x-23;x<=HARVEST_BARN.center.x+23;x+=2)for(let z=-27;z<=27;z+=2)for(const y of [17,24,32]){assertOutside([x,y,z],`barn architectural volume:${x}/${y}/${z}`,true);probes++;}
  assert.ok(solids.length>100);t.diagnostic(`${solids.length} independently closed emitted solids; ${probes} actual driving/body and architectural barn-interior containment probes`);
});

const orbitCases=Array.from({length:8},(_,i)=>[-.28,0,.4,.78].map(pitch=>({yaw:-Math.PI+i*Math.PI/4,pitch,rearView:false}))).flat();
// Rear view deliberately overrides all orbit yaws/pitches in the real source;
// one rear pose covers them, while release/toggle transitions are tested below.
const allViews=[...orbitCases,{yaw:0,pitch:0,rearView:true}];
const anchorAt=(frame:ReturnType<typeof HARVEST_COURSE.commonStart.sample>)=>({x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z});
const smoothPose=(a:CameraPoint,b:CameraPoint,dt=1/60)=>{const alpha=1-Math.exp(-dt*8);return{x:a.x+(b.x-a.x)*alpha,y:a.y+(b.y-a.y)*alpha,z:a.z+(b.z-a.z)*alpha};};

test('harvest desired-safe and genuinely interpolated whole booms clear actual mesh by 0.3m on all edges lanes and orbit/rear poses',t=>{
  let poses=0,retractions=0,rawHits=0,failures=0;const examples:string[]=[];
  const inspect=(a:CameraPoint,b:CameraPoint,label:string)=>{const failure=boomFailure(tuple(a),tuple(b),label);if(failure){failures++;if(examples.length<12)examples.push(failure);}};
  for(const edge of Object.values(HARVEST_COURSE.edges)){
    const distances=new Set<number>([0,edge.length]);for(let s=0;s<edge.length;s+=12)distances.add(s);
    for(const s0 of [0,edge.length,...(edge.id==='alley'||edge.id==='boulevard'?[80,110,edge.length-80,edge.length-110]:[])])
      for(let s=Math.max(0,s0-36);s<=Math.min(edge.length,s0+36);s+=3)distances.add(s);
    for(const s of distances)for(const side of [-1,0,1])for(const view of [0,1])for(const orientation of allViews){
      const {yaw,pitch,rearView}=orientation,frame=edge.sample(s,side*edge.laneLimitAt(s)),anchor=anchorAt(frame);
      const desired=chaseCamera({position:frame.p,tangent:frame.t,view,rearView,orbit:{yaw,pitch}}).position;
      const safe=safeLandCamera(anchor,desired,geometry.cameraObstacles),label=`${edge.id}:${s.toFixed(2)} lane:${side} view:${view} rear:${rearView} yaw:${yaw.toFixed(3)} pitch:${pitch}`;
      assert.ok(Object.values(safe).every(Number.isFinite));if(Math.hypot(safe.x-desired.x,safe.y-desired.y,safe.z-desired.z)>.01)retractions++;
      if(mesh.firstHit(tuple(anchor),tuple(desired)))rawHits++;inspect(anchor,safe,label+' desired-safe');
      const priorS=Math.max(0,s-2.4),prior=edge.sample(priorS,side*Math.max(0,edge.laneLimitAt(priorS)-.25)),priorAnchor=anchorAt(prior);
      const priorDesired=chaseCamera({position:prior.p,tangent:prior.t,view,rearView:false,orbit:{yaw:yaw+.6,pitch}}).position;
      const priorSafe=safeLandCamera(priorAnchor,priorDesired,geometry.cameraObstacles),interpolated=smoothPose(priorSafe,safe),final=safeLandCamera(anchor,interpolated,geometry.cameraObstacles);
      inspect(anchor,final,label+' interpolated');poses++;
    }
  }
  assert.equal(failures,0,`${failures} actual whole-boom failures:\n${examples.join('\n')}`);
  assert.ok(poses>60000);t.diagnostic(`${poses} desired-safe and ${poses} truly interpolated complete 0.3m capsule/source-mesh checks; ${rawHits} raw desired source hits, ${retractions} retractions`);
});

test('harvest barn and both portals remain actual-mesh clear under dense 24-yaw desired and interpolated camera sweeps',t=>{
  const edge=HARVEST_COURSE.edges.alley,b=HARVEST_BARN;let poses=0,failures=0;const examples:string[]=[];
  for(const side of [-1,0,1])for(const view of [0,1])for(let yawIndex=0;yawIndex<24;yawIndex++)for(const pitch of [-.28,0,.4,.78]){
    const yaw=-Math.PI+yawIndex*Math.PI/12;let previous:CameraPoint|null=null;
    for(let s=b.straightFromS-18;s<=b.straightToS+18;s+=.8){
      const frame=edge.sample(s,side*edge.laneLimitAt(s)),anchor=anchorAt(frame),raw=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:false,orbit:{yaw,pitch}}).position;
      const desired=safeLandCamera(anchor,raw,geometry.cameraObstacles),interpolated=previous?smoothPose(previous,desired):desired,final=safeLandCamera(anchor,interpolated,geometry.cameraObstacles);
      for(const [kind,camera] of [['desired',desired],['interpolated',final]] as const){const failure=boomFailure(tuple(anchor),tuple(camera),`barn:${s.toFixed(2)} lane:${side} view:${view} yaw:${yawIndex} pitch:${pitch} ${kind}`);if(failure){failures++;if(examples.length<12)examples.push(failure);}}
      previous=final;poses++;
    }
  }
  assert.equal(failures,0,`${failures} exact barn boom failures:\n${examples.join('\n')}`);assert.ok(poses>60000);
  t.diagnostic(`${poses} dense desired-safe + ${poses} actual sequentially interpolated 0.8m barn/portal whole booms, 24 yaws and four pitches`);
});

test('harvest camera crosses barn split merge and lap boundaries in both directions and rear-toggle states using actual interpolation',t=>{
  const e=HARVEST_COURSE.edges,joins=[[e.start,e.alley],[e.start,e.boulevard],[e.alley,e.finish],[e.boulevard,e.finish],[e.finish,e.start]] as const;
  let frames=0;
  const sequence=(sample:(i:number)=>ReturnType<typeof e.start.sample>,label:string,side:number,view:number,rearMode:number,pitch:number)=>{
    let previous:CameraPoint|null=null;
    for(let i=0;i<=80;i++){
      const frame=sample(i),anchor=anchorAt(frame),rearView=rearMode===1||(rearMode===2&&i>=20&&i<50),yaw=Math.PI*Math.sin(i/80*Math.PI*2);
      const raw=chaseCamera({position:frame.p,tangent:frame.t,view,rearView,orbit:{yaw,pitch}}).position,desired=safeLandCamera(anchor,raw,geometry.cameraObstacles);
      const interpolated=previous?smoothPose(previous,desired,1/60):desired,final=safeLandCamera(anchor,interpolated,geometry.cameraObstacles);
      const failure=boomFailure(tuple(anchor),tuple(final),`${label} lane:${side} view:${view} rearMode:${rearMode} pitch:${pitch} frame:${i}`);assert.equal(failure,null);previous=final;frames++;
    }
  };
  for(const reverse of [false,true])for(const side of [-1,0,1])for(const view of [0,1])for(const rearMode of [0,1,2])for(const pitch of [-.28,.78]){
    for(const [from,to] of joins)sequence(i=>{const offset=(reverse?40-i:i-40)*.8,edge=offset<0?from:to,s=offset<0?from.length+offset:offset;return edge.sample(s,side*edge.laneLimitAt(s));},`${from.id}>${to.id} reverse:${reverse}`,side,view,rearMode,pitch);
    for(const center of [HARVEST_BARN.straightFromS,HARVEST_BARN.centerS,HARVEST_BARN.straightToS])sequence(i=>{const s=center+(reverse?40-i:i-40)*.8;return e.alley.sample(s,side*e.alley.laneLimitAt(s));},`barn:${center} reverse:${reverse}`,side,view,rearMode,pitch);
  }
  assert.equal(frames,46656);t.diagnostic(`${frames} continuous actual 60Hz smoothing/recheck frames at both barn portals, barn center, both split/merge routes and lap seam; forward/reverse/rear press-release covered`);
});

function assertDefaultFrustum(camera:CameraPoint,look:CameraPoint,target:V,label:string){
  const forward=sub(tuple(look),tuple(camera)).map((n,_,p)=>n/Math.hypot(...p));
  const right=[-forward[2],0,forward[0]],rl=Math.hypot(...right);right.forEach((_,i)=>right[i]/=rl);
  const up=[right[1]*forward[2]-right[2]*forward[1],right[2]*forward[0]-right[0]*forward[2],right[0]*forward[1]-right[1]*forward[0]],ray=sub(target,tuple(camera)),depth=dot(forward,ray),tan=Math.tan(28*Math.PI/180);
  assert.ok(depth>0&&Math.abs(dot(right,ray))<depth*tan*16/9&&Math.abs(dot(up,ray))<depth*tan,`${label} outside actual 56 degree 16:9 default chase frustum`);
}
test('every harvest pickup has physical mesh-clear approach rays and default framing including barn entrance approaches',t=>{
  let rays=0;
  for(const pickup of harvestPickupRows(HARVEST_COURSE))for(const ahead of pickup.edgeId==='alley'?[12,25,40,55]:[55])for(const side of [-1,0,1])for(const view of [0,1]){
    const edge=HARVEST_COURSE.edges[pickup.edgeId],s=pickup.s-ahead,frame=edge.sample(s,side*edge.laneLimitAt(s)),anchor=anchorAt(frame),pose=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:false,orbit:{yaw:0,pitch:0}}),camera=safeLandCamera(anchor,pose.position,geometry.cameraObstacles);
    for(const lift of [1.08,1.25,1.42]){
      const target=[pickup.p.x,pickup.p.y+lift,pickup.p.z],hit=mesh.firstHit(tuple(camera),target),label=`${pickup.edgeId}:${pickup.s} itemLane:${pickup.lateral} actorLane:${side} ahead:${ahead} view:${view} bob:${lift}`;
      assert.ok(!hit,`${label}: blocked by actual ${hit?.triangle.batch}/${hit&&componentOf.get(hit.triangle.id)?.kind} triangle ${hit?.triangle.id}`);assertDefaultFrustum(camera,pose.look,target,label);rays++;
    }
  }
  assert.equal(rays,432);t.diagnostic(`${rays} physical pickup rays at center and both full legal edge lanes, both default views and bob extremes; barn additionally12/25/40m`);
});

test('harvest camera mesh broadphase covers actual local triangles without unbounded source scans or whole-barn boxes',t=>{
  const triangleKey=(points:readonly V[])=>points.map(shapeKey).sort().join('|'),actualKeys=new Set(mesh.triangles.map(t=>triangleKey([t.a,t.b,t.c])));
  const payloads=geometry.cameraObstacles.filter(b=>b.triangles).map(b=>({kind:b.kind,triangles:b.triangles!,bounds:b.triangles!.map(points=>boundsOf(points))}));let totalTriangles=0,queries=0,maxCandidates=0;
  for(const blocker of geometry.cameraObstacles){assert.ok(blocker.triangles||blocker.heightfield,`${blocker.kind} is a broad solid box which may fill real architectural void`);}
  for(const payload of payloads){totalTriangles+=payload.triangles.length;for(const triangle of payload.triangles)assert.ok(actualKeys.has(triangleKey(triangle)),`${payload.kind} camera mesh invents a non-rendered face`);}
  for(const edge of Object.values(HARVEST_COURSE.edges))for(let s=0;s<edge.length;s+=100)for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/2]){
    const frame=edge.sample(s),anchor=anchorAt(frame),desired=chaseCamera({position:frame.p,tangent:frame.t,view:1,rearView:false,orbit:{yaw,pitch:-.28}}).position,a=tuple(anchor),b=tuple(desired),min=a.map((n,i)=>Math.min(n,b[i])-.45),max=a.map((n,i)=>Math.max(n,b[i])+.45);let local=0;
    for(const payload of payloads){
      const ids=cameraMeshCandidateIds(payload.triangles,anchor,desired),set=new Set(ids);local+=ids.length;
      payload.bounds.forEach((box,i)=>{if(box.min[0]<=max[0]&&box.max[0]>=min[0]&&box.min[2]<=max[2]&&box.max[2]>=min[2])assert.ok(set.has(i),`${payload.kind} local broadphase omitted source face ${i}`);});
    }
    assert.ok(local<totalTriangles*.2,`${local}/${totalTriangles} runtime camera candidates is not a local query`);maxCandidates=Math.max(maxCandidates,local);queries++;
  }
  assert.ok(totalTriangles>5000&&queries>100);t.diagnostic(`${queries} source-bounds broadphase checks, max ${maxCandidates} local candidates of ${totalTriangles} actual mesh faces; no whole-barn boxes`);
});

test('harvest foundations every planted root and all grounded prop footprints contact actual terrain over their complete area',t=>{
  let foundations=0,roots=0,intersections=0;
  for(const foundation of geometry.foundations){
    const center=foundation.footprint.reduce((a,p)=>a.map((n,k)=>n+p[k]/foundation.footprint.length),[0,0,0]);
    const candidates=geometry.components.filter(c=>c.kind===foundation.kind+'-continuous-foundation'&&actualBounds.get(c)!.min[0]<=center[0]&&actualBounds.get(c)!.max[0]>=center[0]&&actualBounds.get(c)!.min[2]<=center[2]&&actualBounds.get(c)!.max[2]>=center[2]);
    assert.equal(candidates.length,1,`${foundation.kind} exact continuous foundation provenance`);const c=candidates[0],bounds=actualBounds.get(c)!;
    intersections+=fullGroundContact(c);assert.ok(Math.abs(bounds.min[1]-foundation.bottom)<1e-6);
    const cap=geometry.components.find(q=>q.kind===foundation.kind+'-foundation-cap'&&actualBounds.get(q)!.min[0]<=center[0]&&actualBounds.get(q)!.max[0]>=center[0]&&actualBounds.get(q)!.min[2]<=center[2]&&actualBounds.get(q)!.max[2]>=center[2]);assert.ok(cap);intersections+=fullBottomContact(cap,other=>other===c);foundations++;
    for(const road of mesh.query(bounds.min,bounds.max))if(roadNames.has(road.batch))assert.ok(area(clipPolygon(hullXZ(actualComponentPoints(c)),road))<1e-7,`${foundation.kind} full actual foundation overlaps drivable surface`);
  }
  const grounded=new Set<Component>();
  for(const detail of geometry.groundedDetails){
    const matches=geometry.components.filter(c=>c.kind===detail.kind&&actualBounds.get(c)!.min[0]<=detail.x+1e-6&&actualBounds.get(c)!.max[0]>=detail.x-1e-6&&actualBounds.get(c)!.min[2]<=detail.z+1e-6&&actualBounds.get(c)!.max[2]>=detail.z-1e-6);
    assert.equal(matches.length,1,`${detail.kind} full planted detail source must be unambiguous`);grounded.add(matches[0]);
  }
  // Rail-post provenance is audited even when omitted from groundedDetails.
  for(const c of geometry.components)if(c.kind==='road-rail-grounded-post')grounded.add(c);
  for(const c of grounded){intersections+=fullGroundContact(c);roots++;}
  assert.ok(foundations>=7&&roots>100);t.diagnostic(`${foundations} actual complete foundations/caps, ${roots} root/post/terrace/detail footprints, ${intersections} independently clipped terrain/support intersections`);
});

test('harvest grain stubble fallow and orchard have terrain-following actual planted surfaces rather than floating crop slabs',t=>{
  const cropNames=new Set(['Harvest ripe wheat rows','Harvest dry crop stems','Harvest olive orchard leaves']);let faces=0,rootVertices=0,topVertices=0,topArea=0;
  for(const triangle of mesh.triangles){
    if(!cropNames.has(triangle.batch)||componentOf.has(triangle.id))continue;faces++;
    const polygon=[triangle.a,triangle.b,triangle.c];
    for(const point of polygon){
      const terrainFaces=mesh.query(point,point,1e-7).filter(t=>t.batch===terrainName&&projectedInterval(t,point,point));assert.ok(terrainFaces.length);
      const delta=point[1]-height(terrainFaces[0],point[0],point[2]);
      if(Math.abs(delta+.04)<1e-6)rootVertices++;else{assert.ok([.26,.30,.75,1.05,1.15].some(h=>Math.abs(h-delta)<1e-6),`actual crop vertex ${point} floats/embeds by ${delta}`);topVertices++;}
    }
    if(area(polygon)>1e-8){
      const coverage=supportCoverage(polygon,(t,overlap)=>{
        if(t.batch!==terrainName)return false;
        const gaps=overlap.map(p=>height(triangle,p[0],p[2])-height(t,p[0],p[2]));
        assert.ok(Math.max(...gaps)-Math.min(...gaps)<1e-6,`crop top ${triangle.id} is not affine to actual underlying terrain`);return true;
      });assert.ok(coverage.uncovered<1e-5);topArea+=area(polygon);
    }
  }
  assert.deepEqual([...new Set(geometry.cropRows.map(r=>r.kind))].sort(),['grain-terrace','market-fallow','outer-golden-grain','southern-stubble']);
  assert.ok(faces>3000&&rootVertices>1000&&topVertices>1000&&topArea>5000);assert.ok(geometry.trees.length>=15);
  const terrainYs=terrain.flatMap(t=>[t.a[1],t.b[1],t.c[1]]);assert.ok(Math.max(...terrainYs)-Math.min(...terrainYs)>20,'genuine connected grain/orchard elevation relief');
  t.diagnostic(`${faces} source crop triangles, ${rootVertices} buried root vertices, ${topVertices} terrain-affine crop-top vertices, ${topArea.toFixed(1)}m² planted canopy; ${geometry.trees.length} independently grounded orchard trees`);
});

function requireContacts(kind:string,targetKinds:readonly string[],minimum:number,errors:string[],maximum?:number){
  const sources=geometry.components.filter(c=>c.kind===kind),targets=geometry.components.filter(c=>targetKinds.includes(c.kind));if(!sources.length)errors.push(`missing visible structural ${kind}`);let count=0;
  for(const source of sources){
    const contacts=targets.filter(target=>target!==source&&actualContact(source,target));
    if(contacts.length<minimum)errors.push(`${kind} ${JSON.stringify(actualBounds.get(source))} has ${contacts.length} actual contacts to ${targetKinds.join('/')}, needs ${minimum}`);
    if(maximum!==undefined)assert.ok(contacts.length<=maximum);count+=contacts.length;
  }return count;
}
test('harvest barn post plinth wall plate tie rafter roof and rack contacts are real emitted-mesh connections',t=>{
  let contacts=0;const errors:string[]=[];
  for(const post of geometry.components.filter(c=>c.kind==='barn-load-bearing-post')){
    const bounds=actualBounds.get(post)!,bottom=bounds.min[1],foot=hullXZ(actualComponentPoints(post).filter(p=>p[1]<=bottom+1e-7));
    const coverage=supportCoverage(foot,(triangle,overlap)=>componentOf.get(triangle.id)?.kind==='barn-side-plinth-foundation-cap'&&cross2(triangle.a,triangle.b,triangle.c)<-1e-9&&overlap.every(p=>height(triangle,p[0],p[2])>=bottom-.025&&height(triangle,p[0],p[2])<bottom+.25));
    assert.ok(coverage.uncovered<1e-6,`barn post full foot lacks ${coverage.uncovered}m² actual plinth contact`);
  }
  contacts+=requireContacts('barn-load-bearing-post',['barn-side-plinth-foundation-cap'],1,errors);
  contacts+=requireContacts('barn-load-bearing-post',['barn-continuous-wall-plate'],1,errors);
  contacts+=requireContacts('barn-post-seated-tie-beam',['barn-load-bearing-post'],2,errors);
  contacts+=requireContacts('barn-in-wall-diagonal-brace',['barn-load-bearing-post','barn-continuous-wall-plate'],2,errors);
  contacts+=requireContacts('barn-recessed-side-plank',['barn-side-plinth-foundation-cap'],1,errors);
  contacts+=requireContacts('barn-tie-seated-rafter',['barn-post-seated-tie-beam'],1,errors);
  contacts+=requireContacts('barn-tie-seated-rafter',['barn-thin-pitched-roof-shell'],1,errors);
  contacts+=requireContacts('barn-ridge-truss-kingpost',['barn-post-seated-tie-beam','barn-continuous-supported-ridge'],2,errors);
  contacts+=requireContacts('barn-thin-pitched-roof-shell',['barn-tie-seated-rafter'],5,errors);
  contacts+=requireContacts('barn-continuous-supported-ridge',['barn-thin-pitched-roof-shell'],2,errors);
  contacts+=requireContacts('barn-raised-roof-seam',['barn-thin-pitched-roof-shell'],1,errors);
  contacts+=requireContacts('barn-roof-edge-trim',['barn-thin-pitched-roof-shell'],1,errors);
  contacts+=requireContacts('barn-rack-wall-bracket',['barn-recessed-side-plank','barn-tool-supported-rack'],2,errors);
  contacts+=requireContacts('barn-tool-supported-rack',['barn-rack-wall-bracket'],1,errors);
  contacts+=requireContacts('barn-tool-peg',['barn-tool-supported-rack'],1,errors);
  contacts+=requireContacts('barn-visible-fork-handle',['barn-tool-peg'],1,errors);
  contacts+=requireContacts('barn-visible-fork-crossbar',['barn-visible-fork-handle'],1,errors);
  contacts+=requireContacts('barn-visible-fork-tine',['barn-visible-fork-crossbar'],1,errors);
  assert.equal(errors.length,0,`${errors.length} missing actual architectural contacts:\n${errors.slice(0,40).join('\n')}`);
  t.diagnostic(`${contacts} actual source-surface structural and visible-tool connections, including both tie seats and each roof's five rafter bays`);
});

test('harvest mill shaft sail frames and other landmark roof support chains are connected in actual source geometry',t=>{
  let contacts=0;const errors:string[]=[];
  contacts+=requireContacts('mill-bearing-support-upright',['mill-tower-top-collar'],1,errors);
  contacts+=requireContacts('mill-supported-axle-crossmember',['mill-bearing-support-upright'],2,errors);
  contacts+=requireContacts('mill-static-hub-axle',['mill-supported-axle-crossmember','mill-raised-iron-hub'],2,errors);
  contacts+=requireContacts('mill-raised-iron-hub',['mill-sail-continuous-spar'],4,errors);
  contacts+=requireContacts('mill-sail-separate-slat',['mill-sail-continuous-spar'],2,errors);
  contacts+=requireContacts('mill-sail-continuous-spar',['mill-sail-separate-slat'],10,errors);
  contacts+=requireContacts('mill-sail-diagonal-tension',['mill-sail-continuous-spar'],2,errors);
  contacts+=requireContacts('granary-porch-post',['stone-granary-foundation-cap','granary-porch-support-beam'],2,errors);
  contacts+=requireContacts('granary-porch-flat-roof',['granary-porch-support-beam'],2,errors);
  contacts+=requireContacts('granary-wall-seated-roof-rafter',['granary-solid-plaster-body','granary-pitched-tile-roof'],2,errors);
  contacts+=requireContacts('granary-pitched-tile-roof',['granary-wall-seated-roof-rafter'],2,errors);
  contacts+=requireContacts('press-load-bearing-post',['press-stone-post-seat','press-post-seated-crossbeam'],2,errors);
  contacts+=requireContacts('press-beam-seated-roof-rafter',['press-roof-longitudinal-beam','press-post-seated-crossbeam'],1,errors);
  contacts+=requireContacts('press-supported-pitched-roof',['press-beam-seated-roof-rafter'],2,errors);
  contacts+=requireContacts('market-canopy-upright',['market-post-stone-seat','market-post-seated-beam'],2,errors);
  contacts+=requireContacts('market-beam-seated-canopy-rafter',['market-post-seated-beam'],1,errors);
  contacts+=requireContacts('market-asymmetric-cloth-roof',['market-beam-seated-canopy-rafter'],2,errors);
  assert.equal(geometry.sails.length,4);assert.equal(geometry.components.filter(c=>c.kind==='mill-sail-separate-slat').length,48);
  assert.equal(errors.length,0,`${errors.length} missing actual architectural contacts:\n${errors.slice(0,40).join('\n')}`);
  t.diagnostic(`${contacts} independently measured actual support connections; four static open-frame sails and 48 separated modeled slats`);
});

test('harvest landmarks stay inside actual radius height and road-clearance reservations and their grounded lower parts have full support',t=>{
  let vertices=0,contacts=0;
  const kinds=new Set(['mill-stepped-masonry-foot','granary-solid-plaster-body','granary-porch-post','grain-scale-stone-plinth','press-stone-post-seat','press-stone-basket-foot','press-dry-stone-trough-floor','silo-concrete-foot-ring','silo-low-service-shed','market-post-stone-seat','market-table-grounded-leg']);
  for(const landmark of geometry.landmarks){
    const plot=HARVEST_LANDMARKS.plots.find(p=>p.id===landmark.kind);assert.ok(plot);assert.equal(landmark.radius,plot.radius);assert.equal(landmark.height,plot.height);
    for(const triangle of mesh.query(landmark.position,landmark.position,landmark.radius+20))if(roadNames.has(triangle.batch))assert.ok(triangleDistanceXZ(triangle,landmark.position)>landmark.radius+19.5,`${landmark.kind} reserved radius infringes actual road ${triangle.id}`);
    const parts=geometry.components.filter(c=>c.landmark===landmark.kind);assert.ok(parts.length>10);
    for(const c of parts){
      for(const p of actualComponentPoints(c)){
        assert.ok(Math.hypot(p[0]-landmark.position[0],p[2]-landmark.position[2])<=landmark.radius+1e-6,`${landmark.kind}/${c.kind} actual vertex ${p} escapes radius`);
        assert.ok(p[1]<=landmark.position[1]+landmark.height+1e-6,`${landmark.kind}/${c.kind} actual vertex escapes reserved height`);vertices++;
      }
      if(kinds.has(c.kind))contacts+=fullBottomContact(c,other=>other?.kind===landmark.kind+'-foundation-cap');
    }
  }
  assert.equal(geometry.landmarks.length,5);assert.ok(vertices>10000&&contacts>20);t.diagnostic(`${vertices} actual landmark vertices inside full surveyed radius/height envelopes, ${contacts} whole lower-footprint support intersections`);
});

test('harvest landmark first-hit rays reach intended modeled silhouettes before unrelated actual scenery',t=>{
  const errors:string[]=[];
  for(const line of geometry.sightlines){
    const target=geometry.landmarks.find(l=>l.kind===line.targetId);assert.ok(target);
    const hit=mesh.firstHit(line.eye,line.target);if(!hit){errors.push(`${line.name} ray terminates in empty reservation air`);continue;}
    if(componentOf.get(hit.triangle.id)?.landmark!==target.kind)errors.push(`${line.name} first sees ${hit.triangle.batch}/${componentOf.get(hit.triangle.id)?.kind}, not modeled ${target.kind}`);
  }
  assert.equal(errors.length,0,errors.join('\n'));assert.equal(geometry.sightlines.length,4);t.diagnostic('Four actual first-hit silhouette rays to modeled mill, silo and market; no planned-cylinder or empty-target shortcut');
});

test('harvest visible mill slats axle and barn forks have exposed physical surface rays rather than embedding behind shells',t=>{
  let rays=0,details=0;
  const visible=(c:Component,eyes:(p:V,bounds:{min:V;max:V})=>V[])=>{
    const bounds=actualBounds.get(c)!,triangles=componentTriangles.get(c)??[];let seen=false;
    for(const triangle of triangles){
      if(area3D([triangle.a,triangle.b,triangle.c])<1e-8)continue;const target=[0,1,2].map(k=>(triangle.a[k]+triangle.b[k]+triangle.c[k])/3);
      for(const eye of eyes(target,bounds)){const hit=mesh.firstHit(eye,target);rays++;if(hit&&belongs(hit.triangle,c)){seen=true;break;}}if(seen)break;
    }
    assert.ok(seen,`${c.kind} actual detail is wholly hidden/embedded from its intended exposed side`);details++;
  };
  for(const c of geometry.components.filter(c=>['mill-sail-separate-slat','mill-sail-continuous-spar','mill-raised-iron-hub'].includes(c.kind)))visible(c,(p,b)=>[[p[0],p[1],b.min[2]-12]]);
  for(const c of geometry.components.filter(c=>c.kind==='mill-static-hub-axle'))visible(c,(p,b)=>[[b.min[0]-12,p[1],p[2]],[b.max[0]+12,p[1],p[2]],[p[0],b.max[1]+12,p[2]]]);
  for(const c of geometry.components.filter(c=>['barn-visible-fork-handle','barn-visible-fork-crossbar','barn-visible-fork-tine'].includes(c.kind)))visible(c,p=>[[HARVEST_BARN.center.x,p[1],p[2]]]);
  assert.ok(details>=100);t.diagnostic(`${details} individually exposed source details verified using ${rays} first-hit surface rays, including every sail slat and barn fork part`);
});

test('independent harvest mesh oracle detects hidden vertical obstacles thin terrain peaks and genuine source contact',()=>{
  const triangle=(a:V,b:V,c:V):Triangle=>({id:-1,batch:'independent oracle fixture',vertices:[],a,b,c,...boundsOf([a,b,c])});
  const road=triangle([0,0,0],[10,0,0],[0,0,10]),wall=triangle([2,-1,2],[2,4,2],[2,4,4]);
  assert.ok(area3D(prismIntersection(wall,road,.15,2.3))>1);assert.equal(prismIntersection(triangle([20,-1,20],[20,4,20],[20,4,24]),road,.15,2.3).length,0);
  const peak=triangle([4.99,0,-1],[5.02,8,0],[4.99,0,1]),interval=projectedInterval(peak,[0,1,0],[10,1,0]);assert.ok(interval&&interval[0]<.5&&interval[1]>.5);assert.ok(height(peak,5,0)>1);
  assert.ok(hitFraction(wall,[0,1,2.5],[4,1,2.5])!==null);assert.equal(segmentTriangleDistance([0,1,2.5],[4,1,2.5],wall),0);
  assert.ok(Math.abs(segmentTriangleDistance([2.2,1,2.5],[2.2,3,2.5],wall)-.2)<1e-8);
});

function triangleDistanceXZ(t:Triangle,p:V){
  if(projectedInterval(t,p,p))return 0;
  const points=[t.a,t.b,t.c];return Math.min(...points.map((a,i)=>{
    const b=points[(i+1)%3],x=b[0]-a[0],z=b[2]-a[2],u=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[2]-a[2])*z)/(x*x+z*z)));
    return Math.hypot(p[0]-a[0]-u*x,p[2]-a[2]-u*z);
  }));
}
