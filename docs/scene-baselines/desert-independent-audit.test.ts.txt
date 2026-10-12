// Independent emitted-geometry audit. These tests use rendered positions/indices,
// never planned volumes, camera height answers, scene-provided road faces or
// claimed component bounds as proof. Source provenance identifies parts only.
import test, {after,type TestContext} from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {DESERT_COURSE,DESERT_LANDMARKS,DESERT_ARCHES} from '../src/maps/desert';
import {buildDesertSceneGeometry} from '../src/desert-scenery';
import {desertPickupRows} from '../src/land-course-pickups';
import {chaseCamera} from '../src/race-camera';
import {safeLandCamera,cameraMeshCandidateIds,type CameraPoint} from '../src/land-camera';

// The collision oracle below consumes ONLY rendered batch positions/indices.
// It deliberately does not import cameraTerrainHeight, road footprint clipping,
// camera boxes, scene terrainGrid, or roadFaces to prove geometry is unobstructed.
type V=readonly number[];
type Triangle={id:number;batch:string;vertices:readonly number[];a:V;b:V;c:V;min:V;max:V};
const auditStage=process.env.DESERT_AUDIT_STAGE??'all';
const auditDirectory=process.env.DESERT_AUDIT_DIR??resolve('../land-map-artifacts/desert-audit');
const sourceFiles=['src/maps/desert.ts','src/desert-scenery.ts','src/land-course-pickups.ts','src/race-camera.ts','src/land-camera.ts','src/land-road-mesh.ts','src/land-driving.ts','src/land-routes.ts','src/open-road.ts','tests/desert-independent-audit.test.ts'];
const sourceHashes=()=>Object.fromEntries(sourceFiles.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
const hashesBefore=sourceHashes(),started=Date.now();
const report:{stage:string;startedAt:string;sourceHashesBefore:Record<string,string>;sourceHashesAfter?:Record<string,string>;stable?:boolean;durationSeconds?:number;metrics:Record<string,unknown>;checks:{name:string;status:string;error?:string}[];limitations:string[]}={stage:auditStage,startedAt:new Date().toISOString(),sourceHashesBefore:hashesBefore,metrics:{},checks:[],limitations:['CPU emitted-source geometry audit only; no native game pixels, GPU, or FPS certification','Original blueprint volumes are locating and acceptance inputs only, never actual-mesh proof']};
function audit(name:string,phase:'structural'|'camera',fn:(t:TestContext)=>void){
  if(auditStage!=='all'&&auditStage!==phase)return;
  test(name,t=>{try{fn(t);report.checks.push({name,status:'passed'});}catch(error){report.checks.push({name,status:'failed',error:String(error)});throw error;}});
}
after(()=>{report.sourceHashesAfter=sourceHashes();report.stable=JSON.stringify(report.sourceHashesAfter)===JSON.stringify(hashesBefore);report.durationSeconds=(Date.now()-started)/1000;mkdirSync(auditDirectory,{recursive:true});writeFileSync(resolve(auditDirectory,`${auditStage}-report.json`),JSON.stringify(report,null,2)+'\n');assert.ok(report.stable,'audited sources changed during this run; result is stale');});
const geometry=buildDesertSceneGeometry(DESERT_COURSE);
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
const terrainName=geometry.batches.find(b=>b.name==='Desert connected sculpted dune terrain')?.name;
assert.ok(terrainName,'continuous desert terrain batch exists');
const roadNames=new Set(geometry.components.filter(c=>c.role==='road').map(c=>c.batch));
assert.ok([...roadNames].every(name=>geometry.batches.some(b=>b.name===name)),'all desert rendered road materials exist');
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
const roads=mesh.triangles.filter(t=>componentOf.get(t.id)?.role==='road');
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
function fullGroundContact(c:Component,tolerance=.001,exposedTop=actualBounds.get(c)!.max[1]){
  const bounds=actualBounds.get(c)!,polygon=hullXZ(actualComponentPoints(c));let low=Infinity,high=-Infinity;
  const coverage=supportCoverage(polygon,(t,p)=>{
    if(t.batch!==terrainName)return false;
    for(const point of p){const y=height(t,point[0],point[2]);low=Math.min(low,y);high=Math.max(high,y);}
    return true;
  });
  assert.ok(coverage.uncovered<1e-5,`${c.kind} missing actual full-footprint terrain:${coverage.uncovered}`);
  assert.ok(bounds.min[1]<=low+tolerance,`${c.kind} floats over low terrain:${bounds.min[1]} > ${low}`);
  assert.ok(exposedTop>high+.01,`${c.kind} assembly is buried at highest terrain:${exposedTop} <= ${high}`);
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


// The witnesses below reconstruct the full physical ribbon independently. The
// scene's roadFaces and terrain-height convenience API are never used as proof.
const physical: (Triangle&{edgeId:string;s:number;next:number})[]=[];
for(const edge of Object.values(DESERT_COURSE.edges)){
  const n=Math.ceil(edge.length/1.65);
  for(let i=0;i<n;i++){
    const s=i/n*edge.length,next=(i+1)/n*edge.length;
    const a=tuple(edge.sample(s,-edge.halfWidthAt(s)).p),b=tuple(edge.sample(s,edge.halfWidthAt(s)).p),c=tuple(edge.sample(next,-edge.halfWidthAt(next)).p),d=tuple(edge.sample(next,edge.halfWidthAt(next)).p);
    for(const [v0,v1,v2] of [[a,c,b],[b,c,d]])physical.push({id:physical.length,batch:'independent physical width',vertices:[],a:v0,b:v1,c:v2,...boundsOf([v0,v1,v2]),edgeId:edge.id,s,next});
  }
}
const reportMetric=(key:string,value:unknown)=>{report.metrics[key]=value;};
const assertNoFailures=(errors:string[],label:string)=>assert.equal(errors.length,0,`${label}: ${errors.length} failures\n${errors.slice(0,18).join('\n')}`);

audit('desert emitted geometry has finite indexed data and hard material/mesh budgets','structural',t=>{
  let vertices=0,triangles=0;assert.equal(geometry.trackId,'desert');
  for(const b of geometry.batches){
    vertices+=b.positions.length/3;triangles+=b.indices.length/3;
    assert.equal(b.positions.length%3,0);assert.equal(b.indices.length%3,0);assert.equal(b.uvs.length,b.positions.length/3*2);
    assert.ok(b.positions.every(Number.isFinite));assert.ok(b.uvs.every(Number.isFinite));
    assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));
  }
  const counts={batches:geometry.batches.length,vertices,triangles,terrainTriangles:terrain.length,components:geometry.components.length,sourceOwnershipTriangles:componentOf.size};reportMetric('mesh',counts);
  assert.ok(geometry.batches.length<=24,`${geometry.batches.length} batches >24`);assert.ok(vertices<200000,`${vertices} vertices`);assert.ok(triangles<110000,`${triangles} triangles`);
  assert.equal(componentOf.size,triangles,'every emitted terrain, road, support, rail, sign and detail triangle has source provenance');
  for(const c of geometry.components){const bounds=actualBounds.get(c)!;assert.ok((componentTriangles.get(c)?.length??0)>0,`${c.kind} has no emitted faces`);for(let k=0;k<3;k++){assert.ok(Math.abs(bounds.min[k]-c.min[k])<1e-7);assert.ok(Math.abs(bounds.max[k]-c.max[k])<1e-7);}}
  t.diagnostic(JSON.stringify(counts));
});

audit('desert complete physical road is positive single-owned and exact coplanar at every overlap and graph seam','structural',t=>{
  let pairs=0,coveragePolygons=0,laneProbes=0,maxHeightError=0;
  assert.ok(roads.length>3000,'nonempty detailed road union');
  for(const road of roads){
    assert.ok(cross2(road.a,road.b,road.c)<-1e-9,`road ${road.id} has nonpositive upward area`);
    for(const other of mesh.query(road.min,road.max))if(other.id>road.id&&roadIds.has(other.id)){
      const polygon=clipPolygon([road.a,road.b,road.c],other);assert.ok(area(polygon)<1e-7,`actual road ${road.id}/${other.id} overlaps by ${area(polygon)}m²`);pairs++;
    }
  }
  for(const reference of physical){
    assert.ok(cross2(reference.a,reference.b,reference.c)<-1e-9,`physical strip fold ${reference.edgeId}:${reference.s}`);
    const coverage=supportCoverage([reference.a,reference.b,reference.c],(triangle,polygon)=>{
      if(!roadIds.has(triangle.id))return false;
      for(const p of polygon){const error=Math.abs(height(triangle,p[0],p[2])-height(reference,p[0],p[2]));maxHeightError=Math.max(maxHeightError,error);assert.ok(error<1e-6,`actual source affine-height mismatch ${reference.edgeId}:${reference.s} vs rendered ${triangle.id}: ${error}`);}return true;
    });
    assert.ok(coverage.uncovered<1e-5,`${reference.edgeId}:${reference.s} lacks ${coverage.uncovered}m² full road support`);coveragePolygons++;
  }
  for(const edge of Object.values(DESERT_COURSE.edges))for(let s=0;s<=edge.length;s=Math.min(edge.length,s+1)){
    for(const side of [-1,-.5,0,.5,1]){const p=tuple(edge.sample(s,side*edge.laneLimitAt(s)).p);assert.ok(mesh.query(p,p,.03).some(triangle=>roadIds.has(triangle.id)&&projectedInterval(triangle,p,p)&&Math.abs(height(triangle,p[0],p[2])-p[1])<.08),`${edge.id}:${s} legal lane:${side} has no rendered support`);laneProbes++;}if(s===edge.length)break;
  }
  const e=DESERT_COURSE.edges,joins=[[e.start,e.alley],[e.start,e.boulevard],[e.alley,e.finish],[e.boulevard,e.finish],[e.finish,e.start]];
  let seams=0;
  for(const [a,b] of joins)for(let lateral=-a.halfWidthAt(a.length);lateral<=a.halfWidthAt(a.length);lateral+=.125){
    const p=a.sample(a.length,lateral),q=b.sample(0,lateral);assert.ok(p.p.distance(q.p)<1e-7,`${a.id}>${b.id} discontinuous seam at ${lateral}`);assert.ok(p.t.distance(q.t)<1e-7);assert.ok(p.n.distance(q.n)<1e-7);seams++;
  }
  reportMetric('roadOwnership',{actualTriangles:roads.length,nearbyPairs:pairs,wholeWidthPolygons:coveragePolygons,laneProbes,exactSeamSamples:seams,maxHeightError});t.diagnostic(JSON.stringify(report.metrics.roadOwnership));
});

audit('desert physical ribbon has no nonlocal crossing local fold or noncoplanar branch ownership','structural',t=>{
  const cells=new Map<string,typeof physical>();
  for(const p of physical)for(let x=Math.floor(p.min[0]/20);x<=Math.floor(p.max[0]/20);x++)for(let z=Math.floor(p.min[2]/20);z<=Math.floor(p.max[2]/20);z++){const key=x+','+z,list=cells.get(key)??[];list.push(p);cells.set(key,list);}
  let overlaps=0,localDerivatives=0;let maxCoplanarError=0,minForward=Infinity;
  for(const a of physical){const ids=new Set<number>();for(let x=Math.floor(a.min[0]/20);x<=Math.floor(a.max[0]/20);x++)for(let z=Math.floor(a.min[2]/20);z<=Math.floor(a.max[2]/20);z++)for(const b of cells.get(x+','+z)??[]){
    if(b.id<=a.id||ids.has(b.id))continue;ids.add(b.id);const polygon=clipPolygon([a.a,a.b,a.c],b);if(area(polygon)<1e-7)continue;
    assert.notEqual(a.edgeId,b.edgeId,`same-edge actual source fold ${a.edgeId}:${a.s}/${b.s}`);
    const aa=DESERT_COURSE.edges[a.edgeId as keyof typeof DESERT_COURSE.edges],bb=DESERT_COURSE.edges[b.edgeId as keyof typeof DESERT_COURSE.edges];
    const branches=['alley','boulevard'].includes(a.edgeId)&&['alley','boulevard'].includes(b.edgeId);
    const allowed=branches?Math.min(a.s+b.s,(aa.length-a.s)+(bb.length-b.s))<260:(a.edgeId==='start'?aa.length-a.s:a.edgeId==='finish'?a.s:Math.min(a.s,aa.length-a.s))+(b.edgeId==='start'?bb.length-b.s:b.edgeId==='finish'?b.s:Math.min(b.s,bb.length-b.s))<180;
    // The start/finish lap seam is at the opposite endpoint of their route IDs.
    const lap=new Set([a.edgeId,b.edgeId]).has('start')&&new Set([a.edgeId,b.edgeId]).has('finish')&&(a.edgeId==='start'?a.s+bb.length-b.s:b.s+aa.length-a.s)<80;
    assert.ok(allowed||lap,`unintended nonlocal source overlap ${a.edgeId}:${a.s}/${b.edgeId}:${b.s}`);
    for(const p of polygon){const d=Math.abs(height(a,p[0],p[2])-height(b,p[0],p[2]));maxCoplanarError=Math.max(maxCoplanarError,d);assert.ok(d<1e-7,`noncoplanar route union ${a.edgeId}/${b.edgeId}: ${d}`);}overlaps++;
  }}
  for(const edge of Object.values(DESERT_COURSE.edges))for(let s=.25;s<edge.length-.25;s+=.5)for(const side of [-1,1]){
    const p=edge.sample(s-.25,side*edge.halfWidthAt(s-.25)).p,q=edge.sample(s+.25,side*edge.halfWidthAt(s+.25)).p,tangent=edge.sample(s).t,forward=q.clone().sub(p).dot(tangent)/.5;
    minForward=Math.min(minForward,forward);assert.ok(forward>.6,`${edge.id}:${s} local full-width forward fold ${forward}`);localDerivatives++;
  }
  reportMetric('physicalTopology',{sourceTriangles:physical.length,exactCoplanarOverlaps:overlaps,maxCoplanarError,localDerivatives,minForward});t.diagnostic(JSON.stringify(report.metrics.physicalTopology));
});

audit('desert terrain covers every full road footprint and every emitted solid clears the entire 3.2m kart-body prism','structural',t=>{
  let covered=0,candidates=0,minGap=Infinity,maxGap=-Infinity;
  const errors:string[]=[];
  for(const road of roads){
    const coverage=supportCoverage([road.a,road.b,road.c],(triangle,polygon)=>{
      if(triangle.batch!==terrainName)return false;
      for(const p of polygon){const gap=height(road,p[0],p[2])-height(triangle,p[0],p[2]);minGap=Math.min(minGap,gap);maxGap=Math.max(maxGap,gap);if(gap<.15-1e-7||gap>=4)errors.push(`road ${road.id}, terrain ${triangle.id}, point ${p}: terrain gap ${gap}`);}return true;
    });
    if(coverage.uncovered>=1e-5)errors.push(`road ${road.id} lacks ${coverage.uncovered}m² connected terrain support`);covered++;
    for(const solid of mesh.query(road.min,road.max)){
      if(roadIds.has(solid.id)||solid.min[1]>road.max[1]+3.2||solid.max[1]<road.min[1]+.15)continue;candidates++;
      const intersection=prismIntersection(solid,road,.15,3.2);
      if(intersection.length>=3&&area3D(intersection)>=1e-7)errors.push(`${solid.batch}/${componentOf.get(solid.id)?.kind} triangle ${solid.id} penetrates whole road body prism ${road.id} at ${JSON.stringify(intersection)}`);
    }
  }
  reportMetric('bodyPrisms',{completeRoadTriangles:covered,actualCandidateFaces:candidates,minimumTerrainGap:minGap,maximumTerrainGap:maxGap,failures:errors.length,examples:errors.slice(0,18)});assertNoFailures(errors,'full-width body/support');t.diagnostic(JSON.stringify(report.metrics.bodyPrisms));
});

audit('desert independently closed source solids contain no complete legal kart prism or reserved arch void','structural',t=>{
  const solids:{component:Component;triangles:Triangle[];min:V;max:V}[]=[];
  for(const c of geometry.components){
    const triangles=(componentTriangles.get(c)??[]).filter(t=>area3D([t.a,t.b,t.c])>1e-10),edges=new Map<string,number>();
    for(const t of triangles){const p=[t.a,t.b,t.c].map(shapeKey);for(let k=0;k<3;k++){const edge=[p[k],p[(k+1)%3]].sort().join('|');edges.set(edge,(edges.get(edge)??0)+1);}}
    if(triangles.length&&[...edges.values()].every(n=>n===2))solids.push({component:c,triangles,...actualBounds.get(c)!});
  }
  const assertOutside=(point:V,label:string,architectural=false)=>{
    for(const solid of solids){
      if(architectural&&solid.component.role==='rail')continue;
      if(point.some((n,k)=>n<=solid.min[k]+1e-6||n>=solid.max[k]-1e-6))continue;
      const distance=Math.hypot(...solid.max.map((n,k)=>n-solid.min[k]))*3+1,end=[point[0]+distance,point[1]+distance*.371,point[2]+distance*.529];
      const hits=solid.triangles.map(t=>hitFraction(t,point,end)).filter((n):n is number=>n!==null).sort((a,b)=>a-b),unique=hits.filter((n,i)=>!i||n-hits[i-1]>1e-7);
      assert.equal(unique.length%2,0,`${label} is inside actual closed ${solid.component.kind} at ${point}`);
    }
  };
  // Together with complete face/prism clipping above, an interior representative
  // per connected road prism rules out a whole prism enclosed without crossings.
  let prisms=0,archProbes=0;
  for(const road of roads){const p=[0,1,2].map(k=>(road.a[k]+road.b[k]+road.c[k])/3);p[1]+=1.675;assertOutside(p,`whole road prism ${road.id}`);prisms++;}
  const a=DESERT_ARCHES;
  for(const x of a.centersX)for(let z=a.centerZ-25;z<=a.centerZ+25;z+=2)for(const y of [a.floorY+.4,a.floorY+9,a.floorY+19.8])for(const dx of [-3.9,0,3.9]){assertOutside([x+dx,y,z],`arch interior ${x}/${dx}/${z}/${y}`,true);archProbes++;}
  assert.ok(solids.length>100,'numerous independent source primitives are actually closed');reportMetric('closedContainment',{closedSolids:solids.length,completeKartPrismRepresentatives:prisms,archVoidRepresentatives:archProbes});t.diagnostic(JSON.stringify(report.metrics.closedContainment));
});

audit('desert separated unroofed arch rings preserve 52m architectural aperture and 20m road overhead','structural',t=>{
  const a=DESERT_ARCHES;assert.equal(a.portalWidth,52);assert.equal(a.driveableWidth,11.8);assert.equal(a.overheadClearance,20);
  let candidates=0,overheadPairs=0,minHeadroom=Infinity;const errors:string[]=[];
  for(const x of a.centersX){
    const min=[x-a.depth/2+1e-5,a.floorY+.15,a.centerZ-26+1e-5],max=[x+a.depth/2-1e-5,a.floorY+20-1e-5,a.centerZ+26-1e-5];
    for(const triangle of mesh.query(min,max)){
      // 52m describes architecture, never road width. Low legal edge rails are
      // waived ONLY here; every rail face remains in full body/camera tests.
      if(componentOf.get(triangle.id)?.role==='rail')continue;
      let p=[triangle.a,triangle.b,triangle.c];for(let k=0;k<3;k++){p=clipPlane(p,q=>q[k]-min[k]);p=clipPlane(p,q=>max[k]-q[k]);}
      if(area3D(p)>1e-7)errors.push(`${componentOf.get(triangle.id)?.kind} actual triangle ${triangle.id} occupies reserved opening at arch ${x}`);candidates++;
    }
  }
  for(const road of roads.filter(t=>t.min[0]<-240&&t.max[0]>-280&&t.min[2]<296&&t.max[2]>284))for(const triangle of mesh.query(road.min,road.max)){
    if(!componentOf.get(triangle.id)?.kind.includes('arch')||triangle.max[1]<a.undersideY-.01||Math.abs(cross2(triangle.a,triangle.b,triangle.c))<1e-9)continue;
    const p=clipPolygon([road.a,road.b,road.c],triangle);if(area(p)<1e-8)continue;
    for(const q of p){const h=height(triangle,q[0],q[2])-height(road,q[0],q[2]);minHeadroom=Math.min(minHeadroom,h);if(h<20-1e-6)errors.push(`actual arch triangle ${triangle.id}/road ${road.id} headroom ${h}`);}overheadPairs++;
  }
  // Outward face carvings project a few centimetres from each ring. The
  // twelve-metre central daylight gap, unlike these edge reliefs, has no roof.
  const gapMin=[-266,a.undersideY-1e-5,a.centerZ-26],gapMax=[-254,80,a.centerZ+26];
  for(const triangle of mesh.query(gapMin,gapMax)){
    if(triangle.max[1]<gapMin[1]||!componentOf.get(triangle.id)?.kind.includes('arch'))continue;
    let p=[triangle.a,triangle.b,triangle.c];for(let k=0;k<3;k++){p=clipPlane(p,q=>q[k]-gapMin[k]);p=clipPlane(p,q=>gapMax[k]-q[k]);}
    if(area3D(p)>1e-7)errors.push(`arch ${triangle.id} creates roof/connector between separate rings`);
  }
  assert.ok(overheadPairs>10,'both real rings have overhead faces rather than absent arch geometry');reportMetric('archClearance',{architecturalOpening:52,physicalRoadWidth:11.8,reservedOverhead:20,candidates,overheadPairs,minHeadroom,failures:errors.length});assertNoFailures(errors,'arch opening');t.diagnostic(JSON.stringify(report.metrics.archClearance));
});

audit('desert connected landforms retain the protected 27k triangle allocation and genuine sculpted relief','structural',t=>{
  assert.ok(terrain.length>=27000,`${terrain.length} connected terrain triangles shrinks protected 27000-triangle allocation`);
  const vertices=new Map<string,number>(),edges=new Map<string,number>(),parent:number[]=[];let minY=Infinity,maxY=-Infinity;
  const root=(i:number):number=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const vertex=(p:V)=>{const key=shapeKey(p);let id=vertices.get(key);if(id===undefined){id=parent.length;vertices.set(key,id);parent.push(id);}return id;};
  for(const triangle of terrain){assert.ok(cross2(triangle.a,triangle.b,triangle.c)<-1e-9,`terrain ${triangle.id} faces downward or folds`);const p=[triangle.a,triangle.b,triangle.c],ids=p.map(vertex);for(let k=0;k<3;k++){parent[root(ids[k])]=root(ids[(k+1)%3]);const key=[ids[k],ids[(k+1)%3]].sort((a,b)=>a-b).join(',');edges.set(key,(edges.get(key)??0)+1);}for(const p0 of p){minY=Math.min(minY,p0[1]);maxY=Math.max(maxY,p0[1]);}}
  const connectedComponents=new Set(parent.map((_,i)=>root(i))).size;assert.equal(connectedComponents,1,'all dune/canyon terrain vertices belong to one connected surface');assert.ok([...edges.values()].every(n=>n<=2),'terrain has no non-manifold edge');assert.ok(maxY-minY>45,`terrain relief ${maxY-minY} is too flat for original crown/dunes`);
  const regions=[{name:'dune shoulder',min:[-190,0,-360],max:[340,0,-155],minimum:22},{name:'sandstone crown',min:[230,0,-180],max:[435,0,70],minimum:25},{name:'wind-carved corridor',min:[190,0,40],max:[390,0,265],minimum:14},{name:'western clay return',min:[-650,0,-290],max:[-450,0,300],minimum:8}];
  const relief=regions.map(region=>{const pts=terrain.flatMap(triangle=>[triangle.a,triangle.b,triangle.c]).filter(p=>p[0]>=region.min[0]&&p[0]<=region.max[0]&&p[2]>=region.min[2]&&p[2]<=region.max[2]);const lo=Math.min(...pts.map(p=>p[1])),hi=Math.max(...pts.map(p=>p[1]));assert.ok(hi-lo>=region.minimum,`${region.name} actual regional relief ${hi-lo}`);return{name:region.name,minY:lo,maxY:hi,relief:hi-lo};});
  reportMetric('connectedLandforms',{triangles:terrain.length,vertices:vertices.size,connectedComponents,minY,maxY,regions:relief,nonManifoldEdges:0});t.diagnostic(JSON.stringify(report.metrics.connectedLandforms));
});

function triangleDistanceXZ(t:Triangle,p:V){
  if(projectedInterval(t,p,p))return 0;const points=[t.a,t.b,t.c];return Math.min(...points.map((a,i)=>{const b=points[(i+1)%3],x=b[0]-a[0],z=b[2]-a[2],u=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[2]-a[2])*z)/(x*x+z*z)));return Math.hypot(p[0]-a[0]-u*x,p[2]-a[2]-u*z);}));
}

const orbitCases=Array.from({length:8},(_,i)=>[-.28,0,.4,.78].map(pitch=>({yaw:-Math.PI+i*Math.PI/4,pitch,rearView:false}))).flat();
// Rear view deliberately overrides all orbit yaws/pitches in the real source;
// one rear pose covers them, while release/toggle transitions are tested below.
const allViews=[...orbitCases,{yaw:0,pitch:0,rearView:true}];
const anchorAt=(frame:ReturnType<typeof DESERT_COURSE.commonStart.sample>)=>({x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z});
const smoothPose=(a:CameraPoint,b:CameraPoint,dt=1/60)=>{const alpha=1-Math.exp(-dt*8);return{x:a.x+(b.x-a.x)*alpha,y:a.y+(b.y-a.y)*alpha,z:a.z+(b.z-a.z)*alpha};};

audit('desert desired-safe and genuinely interpolated whole booms clear actual mesh by 0.3m on all edges lanes and orbit/rear poses','camera',t=>{
  let poses=0,retractions=0,rawHits=0,failures=0;const examples:string[]=[];
  const inspect=(a:CameraPoint,b:CameraPoint,label:string)=>{const failure=boomFailure(tuple(a),tuple(b),label);if(failure){failures++;if(examples.length<12)examples.push(failure);}};
  for(const edge of Object.values(DESERT_COURSE.edges)){
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
  assert.ok(poses>60000);reportMetric('wholeCourseCameras',{poses,desiredBooms:poses,interpolatedBooms:poses,rawHits,retractions,failures,strictMargin:.3});t.diagnostic(`${poses} desired-safe and ${poses} truly interpolated complete 0.3m capsule/source-mesh checks; ${rawHits} raw desired source hits, ${retractions} retractions`);
});

audit('desert arch and both portals remain actual-mesh clear under dense 24-yaw desired and interpolated camera sweeps','camera',t=>{
  const edge=DESERT_COURSE.edges.alley,b=DESERT_ARCHES;let poses=0,failures=0;const examples:string[]=[];
  for(const side of [-1,0,1])for(const view of [0,1])for(let yawIndex=0;yawIndex<24;yawIndex++)for(const pitch of [-.28,0,.4,.78]){
    const yaw=-Math.PI+yawIndex*Math.PI/12;let previous:CameraPoint|null=null;
    for(let s=b.straightFromS-18;s<=b.straightToS+18;s+=.8){
      const frame=edge.sample(s,side*edge.laneLimitAt(s)),anchor=anchorAt(frame),raw=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:false,orbit:{yaw,pitch}}).position;
      const desired=safeLandCamera(anchor,raw,geometry.cameraObstacles),interpolated=previous?smoothPose(previous,desired):desired,final=safeLandCamera(anchor,interpolated,geometry.cameraObstacles);
      for(const [kind,camera] of [['desired',desired],['interpolated',final]] as const){const failure=boomFailure(tuple(anchor),tuple(camera),`arch:${s.toFixed(2)} lane:${side} view:${view} yaw:${yawIndex} pitch:${pitch} ${kind}`);if(failure){failures++;if(examples.length<12)examples.push(failure);}}
      previous=final;poses++;
    }
  }
  assert.equal(failures,0,`${failures} exact arch boom failures:\n${examples.join('\n')}`);assert.ok(poses>50000);reportMetric('denseArchCameras',{poses,desiredBooms:poses,interpolatedBooms:poses,failures,strictMargin:.3,yaws:24,pitches:4,spacingMetres:.8});
  t.diagnostic(`${poses} dense desired-safe + ${poses} actual sequentially interpolated 0.8m arch/portal whole booms, 24 yaws and four pitches`);
});

audit('desert camera crosses arch split merge and lap boundaries in both directions and rear-toggle states using actual interpolation','camera',t=>{
  const e=DESERT_COURSE.edges,joins=[[e.start,e.alley],[e.start,e.boulevard],[e.alley,e.finish],[e.boulevard,e.finish],[e.finish,e.start]] as const;
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
    for(const center of [DESERT_ARCHES.straightFromS,DESERT_ARCHES.centerS,DESERT_ARCHES.straightToS])sequence(i=>{const s=center+(reverse?40-i:i-40)*.8;return e.alley.sample(s,side*e.alley.laneLimitAt(s));},`arch:${center} reverse:${reverse}`,side,view,rearMode,pitch);
  }
  assert.equal(frames,46656);reportMetric('transitionCameras',{frames,joins:5,archCenters:3,directions:2,lanes:3,views:2,rearModes:3,pitches:2});t.diagnostic(`${frames} continuous actual 60Hz smoothing/recheck frames at both arch portals, arch center, both split/merge routes and lap seam; forward/reverse/rear press-release covered`);
});

function assertDefaultFrustum(camera:CameraPoint,look:CameraPoint,target:V,label:string){
  const forward=sub(tuple(look),tuple(camera)).map((n,_,p)=>n/Math.hypot(...p));
  const right=[-forward[2],0,forward[0]],rl=Math.hypot(...right);right.forEach((_,i)=>right[i]/=rl);
  const up=[right[1]*forward[2]-right[2]*forward[1],right[2]*forward[0]-right[0]*forward[2],right[0]*forward[1]-right[1]*forward[0]],ray=sub(target,tuple(camera)),depth=dot(forward,ray),tan=Math.tan(28*Math.PI/180);
  assert.ok(depth>0&&Math.abs(dot(right,ray))<depth*tan*16/10&&Math.abs(dot(up,ray))<depth*tan,`${label} outside actual 56 degree 1280×800 native chase frustum`);
}
audit('every desert pickup has physical mesh-clear approach rays and default framing including arch entrance approaches','camera',t=>{
  let rays=0;
  for(const pickup of desertPickupRows(DESERT_COURSE))for(const ahead of [12,25,40,55])for(const side of [-1,0,1])for(const view of [0,1]){
    const edge=DESERT_COURSE.edges[pickup.edgeId],s=pickup.s-ahead,frame=edge.sample(s,side*edge.laneLimitAt(s)),anchor=anchorAt(frame),pose=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:false,orbit:{yaw:0,pitch:0}}),camera=safeLandCamera(anchor,pose.position,geometry.cameraObstacles);
    for(const lift of [1.08,1.25,1.42]){
      const target=[pickup.p.x,pickup.p.y+lift,pickup.p.z],hit=mesh.firstHit(tuple(camera),target),label=`${pickup.edgeId}:${pickup.s} itemLane:${pickup.lateral} actorLane:${side} ahead:${ahead} view:${view} bob:${lift}`;
      assert.ok(!hit,`${label}: blocked by actual ${hit?.triangle.batch}/${hit&&componentOf.get(hit.triangle.id)?.kind} triangle ${hit?.triangle.id}`);assertDefaultFrustum(camera,pose.look,target,label);rays++;
    }
  }
  assert.equal(rays,1296);reportMetric('pickupVisibility',{rays,bobHeights:[1.08,1.25,1.42],approaches:[12,25,40,55],views:2,legalLanes:3,verticalFovDegrees:56,aspect:1280/800});t.diagnostic(`${rays} physical pickup rays at center and both full legal edge lanes, both default views and bob extremes; all rows additionally12/25/40m`);
});

audit('desert camera mesh broadphase covers actual local triangles without unbounded source scans or whole-arch boxes','camera',t=>{
  const triangleKey=(points:readonly V[])=>points.map(shapeKey).sort().join('|'),actualKeys=new Set(mesh.triangles.map(t=>triangleKey([t.a,t.b,t.c])));
  const payloads=geometry.cameraObstacles.filter(b=>b.triangles).map(b=>({kind:b.kind,triangles:b.triangles!,bounds:b.triangles!.map(points=>boundsOf(points))}));let totalTriangles=0,queries=0,maxCandidates=0;
  for(const blocker of geometry.cameraObstacles){assert.ok(blocker.triangles||blocker.heightfield,`${blocker.kind} is a broad solid box which may fill real architectural void`);}
  for(const payload of payloads){totalTriangles+=payload.triangles.length;for(const triangle of payload.triangles)assert.ok(actualKeys.has(triangleKey(triangle)),`${payload.kind} camera mesh invents a non-rendered face`);}
  const payloadKeys=new Set(payloads.flatMap(p=>p.triangles.map(triangleKey)));
  let requiredFaces=0,wayfindingFaces=0;
  for(const triangle of mesh.triangles){const component=componentOf.get(triangle.id);if(!component||component.batch===terrainName||component.role==='road')continue;requiredFaces++;if(/sign|wayfind|icon|board/.test(component.kind))wayfindingFaces++;assert.ok(payloadKeys.has(triangleKey([triangle.a,triangle.b,triangle.c])),`runtime camera omitted actual ${component.kind} triangle ${triangle.id}`);}
  assert.ok(wayfindingFaces>0,'actual wayfinding boards/posts/icons remain physical camera obstacles');
  reportMetric('runtimeMeshCorrespondence',{requiredFaces,wayfindingFaces,payloadFaces:payloadKeys.size});
  const fields=geometry.cameraObstacles.filter(b=>b.heightfield);assert.equal(fields.length,1,'one exact source-connected terrain field');const field=fields[0].heightfield!;let fieldFaces=0;
  const point=(i:number)=>[field.minX+(i%field.columns)*field.dx,field.heights[i],field.minZ+Math.floor(i/field.columns)*field.dz];
  for(let z=0;z<field.rows-1;z++)for(let x=0;x<field.columns-1;x++){const i=z*field.columns+x;for(const ids of [[i,i+field.columns,i+1],[i+1,i+field.columns,i+field.columns+1]]){assert.ok(actualKeys.has(triangleKey(ids.map(point))),'runtime terrain heightfield invents non-emitted triangle');fieldFaces++;}}assert.equal(fieldFaces,terrain.length);
  for(const edge of Object.values(DESERT_COURSE.edges))for(let s=0;s<edge.length;s+=100)for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/2]){
    const frame=edge.sample(s),anchor=anchorAt(frame),desired=chaseCamera({position:frame.p,tangent:frame.t,view:1,rearView:false,orbit:{yaw,pitch:-.28}}).position,a=tuple(anchor),b=tuple(desired),min=a.map((n,i)=>Math.min(n,b[i])-.45),max=a.map((n,i)=>Math.max(n,b[i])+.45);let local=0;
    for(const payload of payloads){
      const ids=cameraMeshCandidateIds(payload.triangles,anchor,desired),set=new Set(ids);local+=ids.length;
      payload.bounds.forEach((box,i)=>{if(box.min[0]<=max[0]&&box.max[0]>=min[0]&&box.min[2]<=max[2]&&box.max[2]>=min[2])assert.ok(set.has(i),`${payload.kind} local broadphase omitted source face ${i}`);});
    }
    assert.ok(local<totalTriangles*.2,`${local}/${totalTriangles} runtime camera candidates is not a local query`);maxCandidates=Math.max(maxCandidates,local);queries++;
  }
  assert.ok(totalTriangles>5000&&queries>100);reportMetric('runtimeBroadphase',{queries,maxCandidates,totalTriangles,maximumSourceFraction:maxCandidates/totalTriangles,wholeArchitectureBoxes:0});t.diagnostic(`${queries} source-bounds broadphase checks, max ${maxCandidates} local candidates of ${totalTriangles} actual mesh faces; no whole-arch boxes`);
});


audit('desert complete foundation planted-post and prop contact footprints are grounded in actual emitted terrain','structural',t=>{
  let foundations=0,groundedCount=0,intersections=0;const grounded=new Set<Component>();
  for(const foundation of geometry.foundations){
    const center=foundation.footprint.reduce((a,p)=>a.map((n,k)=>n+p[k]/foundation.footprint.length),[0,0,0]);
    const candidates=geometry.components.filter(c=>c.kind===foundation.kind+'-continuous-foundation'&&actualBounds.get(c)!.min[0]<=center[0]&&actualBounds.get(c)!.max[0]>=center[0]&&actualBounds.get(c)!.min[2]<=center[2]&&actualBounds.get(c)!.max[2]>=center[2]);
    assert.equal(candidates.length,1,`${foundation.kind} exact foundation provenance`);const c=candidates[0],bounds=actualBounds.get(c)!;
    assert.ok(Math.abs(bounds.min[1]-foundation.bottom)<1e-6);
    const cap=geometry.components.find(q=>q.kind===foundation.kind+'-foundation-cap'&&actualBounds.get(q)!.min[0]<=center[0]&&actualBounds.get(q)!.max[0]>=center[0]&&actualBounds.get(q)!.min[2]<=center[2]&&actualBounds.get(q)!.max[2]>=center[2]);assert.ok(cap);intersections+=fullGroundContact(c,.001,actualBounds.get(cap)!.max[1]);intersections+=fullBottomContact(cap,other=>other===c);foundations++;
    for(const road of mesh.query(bounds.min,bounds.max))if(roadIds.has(road.id))assert.ok(area(clipPolygon(hullXZ(actualComponentPoints(c)),road))<1e-7,`${foundation.kind} foundation overlaps drivable source triangle ${road.id}`);
  }
  for(const detail of geometry.groundedDetails){
    const matches=geometry.components.filter(c=>c.kind===detail.kind&&actualBounds.get(c)!.min[0]<=detail.x+1e-6&&actualBounds.get(c)!.max[0]>=detail.x-1e-6&&actualBounds.get(c)!.min[2]<=detail.z+1e-6&&actualBounds.get(c)!.max[2]>=detail.z-1e-6);
    assert.ok(matches.length>=1,`${detail.kind} grounded part source is missing`);if(detail.kind!=='desert-grounded-dry-root')assert.equal(matches.length,1,`${detail.kind} grounded part source is ambiguous`);for(const match of matches)grounded.add(match);
  }
  for(const c of geometry.components)if(c.kind.includes('grounded-post'))grounded.add(c);
  for(const c of grounded){
    if(c.kind==='desert-grounded-dry-root'){
      // A branching root is grounded by its actual buried terminal cross-section,
      // not by the horizontal projection of its deliberately raised branches.
      const bottom=actualBounds.get(c)!.min[1],caps=(componentTriangles.get(c)??[]).filter(q=>cross2(q.a,q.b,q.c)>1e-9&&q.max[1]<bottom+.4);assert.ok(caps.length>0,'dry root has a real lower closed end');
      for(const cap of caps){const coverage=supportCoverage([cap.a,cap.b,cap.c],(q,p)=>q.batch===terrainName&&p.every(v=>height(cap,v[0],v[2])<=height(q,v[0],v[2])+.02));assert.ok(coverage.uncovered<1e-5,`dry root lower cap ${cap.id} floats over ${coverage.uncovered}m² of actual terrain`);intersections+=coverage.intersections;}
    }else intersections+=fullGroundContact(c);groundedCount++;
  }
  assert.ok(foundations>=9,`${foundations} foundations misses arch or hero foundations`);assert.ok(groundedCount>50);reportMetric('foundationGrounding',{foundations,groundedCount,completeFootprintTerrainIntersections:intersections});t.diagnostic(JSON.stringify(report.metrics.foundationGrounding));
});

function requireContacts(kind:string,targetKinds:readonly string[],minimum:number,errors:string[],maximum?:number){
  const sources=geometry.components.filter(c=>c.kind===kind),targets=geometry.components.filter(c=>targetKinds.includes(c.kind));if(!sources.length)errors.push(`missing structural ${kind}`);let count=0;
  for(const source of sources){const contacts=targets.filter(target=>target!==source&&actualContact(source,target));if(contacts.length<minimum)errors.push(`${kind} ${JSON.stringify(actualBounds.get(source))} has ${contacts.length} actual contacts to ${targetKinds.join('/')}, needs ${minimum}`);if(maximum!==undefined)assert.ok(contacts.length<=maximum);count+=contacts.length;}return count;
}

// Source kinds below will be kept explicit, so removing an important support
// assembly cannot turn a real structural requirement into a vacuous pass.
const structuralRequirements:[string,string[],number][]=[
 ['arch-six-course-pier-ashlar',['arch-six-course-pier-ashlar'],1],
 ['arch-pier-ring-contact-cap',['arch-six-course-pier-ashlar'],2],
 ['arch-pier-ring-contact-cap',['arch-seated-closed-elliptical-voussoir'],1],
 ['arch-seated-closed-elliptical-voussoir',['arch-seated-closed-elliptical-voussoir','arch-pier-ring-contact-cap'],2],
 ['arch-supported-radial-stone-relief',['arch-seated-closed-elliptical-voussoir'],1],
 ['arch-original-star-seal-ray',['arch-six-course-pier-ashlar'],1],
 ['beacon-passage-load-bearing-pier',['beacon-passage-load-bearing-pier','beacon-stepped-polygonal-foot','beacon-pier-seated-arch-cap'],1],
 ['beacon-arch-seated-upper-course',['beacon-closed-open-passage-arch'],1],
 ['beacon-upper-return-wall',['beacon-arch-seated-upper-course','beacon-seated-upper-coping'],2],
 ['beacon-original-offset-fin',['beacon-fin-support-shoulder','beacon-fin-bronze-seated-cap'],2],
 ['beacon-supported-concentric-dial-ring',['beacon-dial-recessed-support-plate'],1],
 ['beacon-plate-seated-dial-radial-strip',['beacon-dial-recessed-support-plate','beacon-supported-concentric-dial-ring'],1],
 ['beacon-gnomon-attached-socket',['beacon-dial-recessed-support-plate','beacon-socket-seated-gnomon'],2],
 ['beacon-gnomon-braced-return',['beacon-socket-seated-gnomon','beacon-front-slit-separated-masonry'],2],
 ['spire-seated-wavy-stratum-relief',['spire-continuous-pocketed-sandstone-mass'],1],
 ['sail-tapered-post',['sail-post-seated-stone-shoe'],1],
 ['sail-post-seated-crossbar',['sail-tapered-post'],2],
 ['sail-post-seated-longitudinal-bar',['sail-tapered-post'],2],
 ['sail-post-seated-knee-brace',['sail-tapered-post','sail-post-seated-crossbar','sail-post-seated-longitudinal-bar'],2],
 ['sail-supported-sagging-closed-cloth',['sail-post-seated-crossbar'],2],
 ['sail-cloth-joined-edge-hem',['sail-supported-sagging-closed-cloth'],1],
 ['sail-beam-seated-rope-anchor',['sail-post-seated-crossbar','sail-post-seated-longitudinal-bar'],1],
 ['sail-corner-anchored-rope',['sail-beam-seated-rope-anchor','sail-supported-sagging-closed-cloth'],2],
 ['sailcourt-supported-goods-table',['sailcourt-table-grounded-leg'],2],
 ['amphora-seated-paired-handle',['amphora-foot-belly-neck-hollow-lip'],1],
 ['amphora-raised-incised-band',['amphora-foot-belly-neck-hollow-lip'],1],
 ['basket-seated-weave-ring',['basket-grounded-woven-body'],1],
 ['basket-connected-upright-weave',['basket-grounded-woven-body'],1],
 ['kiln-lower-wall-seated-clay-dome',['kiln-mouth-separated-lower-masonry'],8],
 ['kiln-dome-attached-stepped-flue',['kiln-lower-wall-seated-clay-dome'],1],
 ['kiln-mouth-jamb-seated-lintel',['kiln-mouth-seated-jamb'],2],
 ['kiln-ledge-seated-pottery-shelf',['kiln-shelf-grounded-masonry-ledge'],2],
 ['waystation-wall-seated-flat-roof',['waystation-grounded-side-wall','waystation-grounded-back-wall'],3],
 ['waystation-porch-post',['waystation-porch-post-shoe','waystation-post-seated-porch-lintel'],2],
 ['waystation-porch-seated-knee-brace',['waystation-porch-post','waystation-post-seated-porch-lintel'],2],
 ['waystation-wall-seated-porch-rafter',['waystation-post-seated-porch-lintel','waystation-niche-upper-spandrel','waystation-cut-niche-front-pier'],2],
 ['waystation-supported-porch-slat',['waystation-post-seated-porch-lintel','waystation-cut-niche-front-pier','waystation-niche-upper-spandrel'],2],
 ['waystation-frame-secured-folded-cloth',['waystation-supported-porch-slat'],3],
 ['cart-joined-through-axle',['cart-real-axle-bearing-hub'],2],
 ['cart-eight-joined-wheel-spokes',['cart-real-axle-bearing-hub','cart-open-grounded-wheel-rim'],2],
 ['cart-axle-seated-underframe',['cart-joined-through-axle'],1],
 ['cart-underframe-seated-longitudinal-bed-support',['cart-axle-seated-underframe'],1],
 ['cart-supported-separate-bed-slat',['cart-underframe-seated-longitudinal-bed-support'],2],
 ['cart-slats-seated-cargo-tray',['cart-supported-separate-bed-slat'],3],
 ['cart-corner-upright',['cart-underframe-seated-longitudinal-bed-support','cart-supported-separate-bed-slat'],1],
 ['cart-raised-cargo-side-slat',['cart-corner-upright'],2],
 ['cart-ground-resting-support-shaft',['cart-underframe-seated-longitudinal-bed-support','cart-supported-separate-bed-slat'],1],
 ['desert-fork-supported-arrow-board',['desert-fork-grounded-sign-post'],2],
 ['desert-fork-open-arch-icon',['desert-fork-arch-icon-pier'],2],
 ['desert-fork-sail-icon-supported-cloth',['desert-fork-sail-icon-pole','desert-fork-sail-icon-supported-cloth'],2],
];
audit('desert arches stone wood fabric pottery and cart structural support chains meet in actual mesh','structural',t=>{
  let contacts=0;const errors:string[]=[];assert.ok(structuralRequirements.length>=12,'explicit original assembly contact requirements supplied');
  for(const [kind,targets,count] of structuralRequirements)contacts+=requireContacts(kind,targets,count,errors);
  reportMetric('structuralConnections',{requirements:structuralRequirements.length,contacts,failures:errors.length,examples:errors.slice(0,18)});assertNoFailures(errors,'actual structure connections');t.diagnostic(JSON.stringify(report.metrics.structuralConnections));
});

audit('desert actual landmark vertices fit authored radius height and complete reserved road clearance','structural',t=>{
  let vertices=0,landmarks=0;
  for(const landmark of geometry.landmarks){
    const plot=DESERT_LANDMARKS.plots.find(p=>p.id===landmark.kind);assert.ok(plot);assert.equal(landmark.radius,plot.radius);assert.equal(landmark.height,plot.height);
    for(const triangle of mesh.query(landmark.position,landmark.position,landmark.radius+20))if(roadIds.has(triangle.id))assert.ok(triangleDistanceXZ(triangle,landmark.position)>=landmark.radius+19.5,`${landmark.kind} radius infringes actual road triangle ${triangle.id}`);
    const parts=geometry.components.filter(c=>c.landmark===landmark.kind);assert.ok(parts.length>5,`${landmark.kind} is missing detailed modeled source parts`);
    for(const c of parts)for(const p of actualComponentPoints(c)){assert.ok(Math.hypot(p[0]-landmark.position[0],p[2]-landmark.position[2])<=landmark.radius+1e-6,`${landmark.kind}/${c.kind} actual point ${p} escapes radius`);assert.ok(p[1]<=landmark.position[1]+landmark.height+1e-6,`${landmark.kind}/${c.kind} escapes height`);vertices++;}landmarks++;
  }
  assert.equal(landmarks,5);reportMetric('landmarkEnvelopes',{landmarks,vertices});t.diagnostic(JSON.stringify(report.metrics.landmarkEnvelopes));
});

audit('desert landmark sightlines first hit the actual modeled silhouette rather than empty reservation centers','structural',t=>{
  const errors:string[]=[];let rays=0;
  for(const line of geometry.sightlines){const landmark=geometry.landmarks.find(l=>l.kind===line.targetId);assert.ok(landmark);const hit=mesh.firstHit(line.eye,line.target);if(!hit)errors.push(`${line.name} ends in empty air`);else if(componentOf.get(hit.triangle.id)?.landmark!==landmark.kind)errors.push(`${line.name} first hits ${hit.triangle.batch}/${componentOf.get(hit.triangle.id)?.kind}/${hit.triangle.id} rather than ${landmark.kind}`);rays++;}
  assert.ok(rays>=4);reportMetric('landmarkSilhouettes',{rays,failures:errors.length,examples:errors});assertNoFailures(errors,'silhouette first-hit');t.diagnostic(`${rays} actual first-hit source silhouette rays`);
});

const revealPoses=[{edge:'start',s:450,name:'Dune shoulders rise through the horizon'},{edge:'start',s:820,name:'High sandstone crown and lower joined basin'},{edge:'start',s:1050,name:'First carved shoulder reveals the bend'},{edge:'start',s:1200,name:'Open alcove releases second S bend'},{edge:'start',s:1430,name:'Ruin approach opens two route silhouettes'},{edge:'alley',s:DESERT_ARCHES.centerS,name:'Two genuinely open stone arches'},{edge:'boulevard',s:290,name:'Banked sailcourt and connected dune lip'}] as const;
function frustumRay(eye:V,look:V,u:number,v:number,length=900):V{
  const forward=sub(look,eye),fl=Math.hypot(...forward),f=forward.map(x=>x/fl),right=[-f[2],0,f[0]],rl=Math.hypot(...right),r=right.map(x=>x/rl),up=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]],tan=Math.tan(28*Math.PI/180);
  const direction=f.map((x,i)=>x+r[i]*u*tan*16/10+up[i]*v*tan),dl=Math.hypot(...direction);return eye.map((x,i)=>x+length*direction[i]/dl);
}
audit('desert seven source driver rear and chase review poses reveal emitted connected landforms','structural',t=>{
  const results:unknown[]=[];let rays=0;const revealErrors:string[]=[];
  for(const review of revealPoses){
    const edge=DESERT_COURSE.edges[review.edge],frame=edge.sample(review.s),anchor=anchorAt(frame),forward=edge.sample(Math.min(edge.length,review.s+32));
    const poses:[string,V,V][]=[['driver',[frame.p.x,frame.p.y+1.6,frame.p.z],[forward.p.x,forward.p.y+1.6,forward.p.z]]];
    for(const view of [0,1])for(const rearView of [false,true]){const pose=chaseCamera({position:frame.p,tangent:frame.t,view,rearView,orbit:{yaw:0,pitch:0}}),camera=safeLandCamera(anchor,pose.position,geometry.cameraObstacles);assert.equal(boomFailure(tuple(anchor),tuple(camera),`review ${review.name}/${view}/${rearView}`),null);poses.push([`view${view}-${rearView?'rear':'chase'}`,tuple(camera),tuple(pose.look)]);}
    const stats=poses.map(([view,eye,look])=>{
      let terrainHits=0,elevatedTerrainHits=0,roadHits=0,structureHits=0,minTerrainY=Infinity,maxTerrainY=-Infinity;const firstHits:number[]=[];
      for(const vertical of [-1,-.8,-.6,-.4,-.25,-.15,-.1,-.06,-.025,0,.025,.06,.1,.15,.25,.4,.6,.8,1])for(let column=0;column<17;column++){
        const end=frustumRay(eye,look,(column-8)/8,vertical),hit=mesh.firstHit(eye,end);rays++;if(!hit)continue;firstHits.push(hit.triangle.id);
        if(componentOf.get(hit.triangle.id)?.role==='terrain'){const p=lerp(eye,end,hit.fraction);terrainHits++;minTerrainY=Math.min(minTerrainY,p[1]);maxTerrainY=Math.max(maxTerrainY,p[1]);if(p[1]>eye[1]+.5)elevatedTerrainHits++;}else if(roadIds.has(hit.triangle.id))roadHits++;else structureHits++;
      }
      if(terrainHits<=4)revealErrors.push(`${review.name}/${view} shows only ${terrainHits} actual landform hits in source frustum`);
      return{view,eye,look,terrainHits,elevatedTerrainHits,roadHits,structureHits,minTerrainY,maxTerrainY,firstHitTriangles:firstHits};
    });
    if(review.edge==='start'&&review.s<=1200&&!stats.filter(p=>!p.view.includes('rear')).some(p=>p.elevatedTerrainHits>0))revealErrors.push(`${review.name} no actual connected dune/canyon crest rises above driver/chase eye line`);
    results.push({...review,poses:stats});
  }
  reportMetric('driverRevealReview',{reviewPositions:7,viewsPerPosition:5,rays,poses:results,nativePixelReview:'required separately; these are exact-source first-hit samples, not rendered screenshots',failures:revealErrors});assertNoFailures(revealErrors,'landform reveal');t.diagnostic(`${rays} source-frustum rays across seven driver/rear/chase reveal locations`);
});


audit('independent desert oracle detects vertical walls thin terrain spikes solid interiors and exact contact','structural',()=>{
  const triangle=(a:V,b:V,c:V):Triangle=>({id:-1,batch:'independent oracle fixture',vertices:[],a,b,c,...boundsOf([a,b,c])});
  const road=triangle([0,0,0],[10,0,0],[0,0,10]),wall=triangle([2,-1,2],[2,4,2],[2,4,4]);assert.ok(area3D(prismIntersection(wall,road,.15,3.2))>1);assert.equal(prismIntersection(triangle([20,-1,20],[20,4,20],[20,4,24]),road,.15,3.2).length,0);
  const peak=triangle([4.99,0,-1],[5.02,8,0],[4.99,0,1]),interval=projectedInterval(peak,[0,1,0],[10,1,0]);assert.ok(interval&&interval[0]<.5&&interval[1]>.5);assert.ok(height(peak,5,0)>1);assert.ok(hitFraction(wall,[0,1,2.5],[4,1,2.5])!==null);assert.equal(segmentTriangleDistance([0,1,2.5],[4,1,2.5],wall),0);assert.ok(Math.abs(segmentTriangleDistance([2.2,1,2.5],[2.2,3,2.5],wall)-.2)<1e-8);
});

audit('desert exposed physical road boundaries are stitched to emitted shoulders and visual coping never owns road','structural',t=>{
  let exposed=0,interior=0,shoulderTriangles=0,copingTriangles=0;const errors:string[]=[];
  const support=mesh.triangles.filter(triangle=>componentOf.get(triangle.id)?.role==='support'&&cross2(triangle.a,triangle.b,triangle.c)<-1e-9),supportIds=new Set(support.map(t=>t.id));
  for(const edge of Object.values(DESERT_COURSE.edges)){
    const n=Math.ceil(edge.length/1.65);
    for(let i=0;i<n;i++)for(const side of [-1,1]){
      const s=i/n*edge.length,next=(i+1)/n*edge.length,a=tuple(edge.sample(s,side*edge.halfWidthAt(s)).p),b=tuple(edge.sample(next,side*edge.halfWidthAt(next)).p),p=lerp(a,b,.5),center=tuple(edge.sample((s+next)/2).p),out=sub(p,center),outLength=Math.hypot(out[0],out[2]),outside=[p[0]+out[0]/outLength*.05,p[1],p[2]+out[2]/outLength*.05];
      if(mesh.query(p,p,.01).some(q=>roadIds.has(q.id)&&[cross2(q.a,q.b,p),cross2(q.b,q.c,p),cross2(q.c,q.a,p)].every(n=>n<-1e-7))||mesh.query(outside,outside,.01).some(triangle=>roadIds.has(triangle.id)&&projectedInterval(triangle,outside,outside))){interior++;continue;}
      const supports=mesh.query(p,p,.01).filter(triangle=>supportIds.has(triangle.id)&&projectedInterval(triangle,p,p));if(!supports.some(triangle=>Math.abs(height(triangle,p[0],p[2])-p[1])<1e-6)){
        // Ownership clips both route surfaces to a common interior seam. A
        // complete local road neighborhood proves this is not an exposed edge,
        // even when neither individual owner triangle strictly contains p.
        const r=.001,neighborhood=[[p[0]-r,p[1],p[2]-r],[p[0]+r,p[1],p[2]-r],[p[0]+r,p[1],p[2]+r],[p[0]-r,p[1],p[2]+r]],union=supportCoverage(neighborhood,q=>roadIds.has(q.id));
        if(union.uncovered<1e-9){interior++;continue;}
        errors.push(`${edge.id}:${s}/${side} road boundary ${p} lacks exact shoulder contact: ${supports.map(q=>`${q.id}:${height(q,p[0],p[2])-p[1]}`).join(',')}`);
      }exposed++;
    }
  }
  for(const triangle of support){
    for(const road of mesh.query(triangle.min,triangle.max))if(roadIds.has(road.id)){const overlap=clipPolygon([triangle.a,triangle.b,triangle.c],road);assert.ok(area(overlap)<1e-7,`upward support ${triangle.id} overlaps road ${road.id}`);}shoulderTriangles++;
  }
  for(const triangle of mesh.triangles)if(componentOf.get(triangle.id)?.role==='visual-coping'){assert.ok(!roadIds.has(triangle.id));copingTriangles++;}
  assert.ok(exposed>2000&&shoulderTriangles>3000&&copingTriangles>1000);reportMetric('shoulderStitches',{exposedBoundarySegments:exposed,internalUnionSegments:interior,shoulderTriangles,nonDrivableCopingTriangles:copingTriangles,failures:errors.length,examples:errors.slice(0,18)});assertNoFailures(errors,'exposed shoulder stitches');t.diagnostic(JSON.stringify(report.metrics.shoulderStitches));
});

audit('desert canyon lobes are fully grounded and their visible strata have actual rock connections','structural',t=>{
  const lobes=geometry.components.filter(c=>c.kind==='wind-carved-sandstone-corridor'),bands=geometry.components.filter(c=>c.kind==='canyon-joined-curving-stratum');let intersections=0,contacts=0;
  assert.ok(lobes.length>=3,'wind-carved corridor needs interrupted actual volumetric lobes');assert.ok(bands.length>=12,'rounded canyon surfaces retain broad modeled stratum bands');
  for(const lobe of lobes)intersections+=fullGroundContact(lobe);
  for(const band of bands){const contact=lobes.filter(lobe=>actualContact(band,lobe));assert.ok(contact.length>=1,`actual canyon stratum ${JSON.stringify(actualBounds.get(band))} floats away from its lobe`);contacts+=contact.length;}
  reportMetric('canyonConnections',{lobes:lobes.length,strata:bands.length,fullGroundIntersections:intersections,contacts});t.diagnostic(JSON.stringify(report.metrics.canyonConnections));
});

audit('desert cart wheel contact patches and every hero lower support footprint actually seat on ground or cap','structural',t=>{
  const seatedKinds=new Set(['beacon-stepped-polygonal-foot','beacon-grounded-court-coping','sail-post-seated-stone-shoe','sailcourt-table-grounded-leg','basket-grounded-woven-body','kiln-mouth-separated-lower-masonry','kiln-recessed-firing-chamber-back','kiln-mouth-grounded-hearth','kiln-mouth-seated-jamb','kiln-shelf-grounded-masonry-ledge','kiln-grounded-glazed-tile-sample','waystation-grounded-side-wall','waystation-grounded-back-wall','waystation-cut-niche-front-pier','waystation-porch-post-shoe']);
  let feet=0,wheels=0,intersections=0;const wheelMetrics:unknown[]=[],footErrors:string[]=[];
  for(const c of geometry.components){
    if(!seatedKinds.has(c.kind)&&c.kind!=='cart-open-grounded-wheel-rim'&&c.kind!=='amphora-foot-belly-neck-hollow-lip')continue;
    const bounds=actualBounds.get(c)!,bottom=bounds.min[1],isWheel=c.kind==='cart-open-grounded-wheel-rim',points=isWheel?(componentTriangles.get(c)??[]).flatMap(q=>clipPlane([q.a,q.b,q.c],p=>bottom+.025-p[1])):actualComponentPoints(c).filter(p=>p[1]<=bottom+1e-7),foot=hullXZ(points);
    assert.ok(area(foot)>1e-8,`${c.kind} actual lower footprint must be measurable`);
    const coverage=supportCoverage(foot,(q,p)=>{
      const other=componentOf.get(q.id);if(other===c||cross2(q.a,q.b,q.c)>=-1e-9)return false;
      if(!other?.kind.endsWith('foundation-cap')&&q.batch!==terrainName&&!['cart-supported-separate-bed-slat','cart-slats-seated-cargo-tray','kiln-ledge-seated-pottery-shelf','sailcourt-supported-goods-table'].includes(other?.kind??''))return false;
      return p.every(v=>{const delta=height(q,v[0],v[2])-bottom;return delta>=-.02&&delta<=(isWheel?.025:.25);});
    });
    if(coverage.uncovered>=1e-5)footErrors.push(`${c.kind} at ${JSON.stringify(bounds)} lacks ${coverage.uncovered}m² actual lower support`);intersections+=coverage.intersections;if(isWheel){
      let minSupportGap=Infinity,maxPenetration=-Infinity,supportSamples=0;
      for(const q of componentTriangles.get(c)??[])for(const point of [q.a,q.b,q.c])for(const support of mesh.query(point,point,.001)){
        const owner=componentOf.get(support.id);if((support.batch!==terrainName&&owner?.kind!==c.landmark+'-foundation-cap')||cross2(support.a,support.b,support.c)>=-1e-9||!projectedInterval(support,point,point))continue;
        const ground=height(support,point[0],point[2]),penetration=ground-point[1];maxPenetration=Math.max(maxPenetration,penetration);if(point[1]<=bottom+1e-7)minSupportGap=Math.min(minSupportGap,point[1]-ground);supportSamples++;
      }
      assert.ok(Number.isFinite(minSupportGap)&&minSupportGap>=-.025&&minSupportGap<=1e-6,`wheel exact lowest surface/support gap ${minSupportGap}`);assert.ok(maxPenetration<=.025,`wheel penetrates actual supporting surface by ${maxPenetration}`);wheelMetrics.push({bounds,exactLowestSupportGap:minSupportGap,maximumSourceSurfacePenetration:maxPenetration,supportSamples,contactPatchArea:area(foot)});wheels++;
    }else feet++;
  }
  assert.equal(wheels,2);assert.ok(feet>75);reportMetric('heroFeetAndWheels',{feet,wheels,fullContactIntersections:intersections,wheelContactPatchHeight:.025,maxVisibleBaseFloat:.02,wheelPositiveFloatTolerance:1e-6,wheelMetrics,failures:footErrors.length,examples:footErrors.slice(0,18)});assertNoFailures(footErrors,'complete lower support');t.diagnostic(JSON.stringify(report.metrics.heroFeetAndWheels));
});

audit('desert authored wheel jar handle dial cloth and wayfinding details expose actual modeled surfaces','structural',t=>{
  const visibleKinds=new Set(['cart-open-grounded-wheel-rim','cart-eight-joined-wheel-spokes','amphora-seated-paired-handle','amphora-foot-belly-neck-hollow-lip','beacon-supported-concentric-dial-ring','beacon-plate-seated-dial-radial-strip','beacon-socket-seated-gnomon','sail-supported-sagging-closed-cloth','desert-fork-supported-arrow-board','desert-fork-open-arch-icon','desert-fork-sail-icon-supported-cloth']);
  let details=0,rays=0;const errors:string[]=[],occludedSpokes:unknown[]=[],spokeGroups=new Map<string,{visible:number;total:number}>();
  for(const c of geometry.components.filter(c=>visibleKinds.has(c.kind))){
    const bounds=actualBounds.get(c)!,triangles=componentTriangles.get(c)??[];let seen=false;
    for(const q of triangles){
      if(area3D([q.a,q.b,q.c])<1e-8)continue;const target=[0,1,2].map(k=>(q.a[k]+q.b[k]+q.c[k])/3),eyes=[[-1,0,0],[1,0,0],[0,0,-1],[0,0,1],[0,1,0],[-1,0,-1],[-1,0,1],[1,0,-1],[1,0,1],[-1,1,0],[1,1,0],[0,1,-1],[0,1,1]].map(direction=>target.map((v,k)=>direction[k]<0?bounds.min[k]-12:direction[k]>0?bounds.max[k]+12:v));
      for(const eye of eyes){const hit=mesh.firstHit(eye,target);rays++;if(hit&&belongs(hit.triangle,c)){seen=true;break;}}if(seen)break;
    }
    if(c.kind==='cart-eight-joined-wheel-spokes'){
      const key=((bounds.min[0]+bounds.max[0])/2).toFixed(5),group=spokeGroups.get(key)??{visible:0,total:0};group.total++;if(seen)group.visible++;else occludedSpokes.push({kind:c.kind,bounds});spokeGroups.set(key,group);
    }else if(!seen)errors.push(`${c.kind} ${JSON.stringify(bounds)} has no exposed modeled surface witness`);details++;
  }
  assert.ok(details>50);assert.equal(spokeGroups.size,2);for(const [position,group] of spokeGroups){assert.equal(group.total,8);assert.ok(group.visible>=6,`wheel at x${position} exposes only ${group.visible}/8 physically connected spokes`);}reportMetric('exposedModeledDetails',{details,rays,failures:errors.length,examples:errors.slice(0,18),wheelSpokeVisibility:Object.fromEntries(spokeGroups),normallyOccludedSpokes:occludedSpokes,scope:'First-hit surface witnesses from explicit external source viewpoints; no universal gameplay visibility claim'});assertNoFailures(errors,'modeled surface exposure');t.diagnostic(JSON.stringify(report.metrics.exposedModeledDetails));
});

audit('desert wheel and dial tube rings are genuinely closed and pottery mouths are actual deep openings','structural',t=>{
  let rings=0,mouths=0;const errors:string[]=[];
  for(const c of geometry.components.filter(c=>['cart-open-grounded-wheel-rim','beacon-supported-concentric-dial-ring'].includes(c.kind))){
    const edges=new Map<string,number>();for(const q of componentTriangles.get(c)??[]){if(area3D([q.a,q.b,q.c])<1e-10)continue;const points=[q.a,q.b,q.c].map(shapeKey);for(let i=0;i<3;i++){const key=[points[i],points[(i+1)%3]].sort().join('|');edges.set(key,(edges.get(key)??0)+1);}}
    const open=[...edges.entries()].filter(([,count])=>count!==2);if(open.length)errors.push(`${c.kind} ${JSON.stringify(actualBounds.get(c))} has ${open.length} unjoined source edges, e.g.${open.slice(0,2).map(([key])=>key).join(';')}`);rings++;
  }
  for(const c of geometry.components.filter(c=>c.kind==='amphora-foot-belly-neck-hollow-lip')){
    const b=actualBounds.get(c)!,x=(b.min[0]+b.max[0])/2,z=(b.min[2]+b.max[2])/2,eye=[x,b.max[1]+1,z],end=[x,b.min[1]-1,z];
    const hits=(componentTriangles.get(c)??[]).map(q=>({id:q.id,fraction:hitFraction(q,eye,end)})).filter(q=>q.fraction!==null).sort((a,b)=>a.fraction!-b.fraction!);assert.ok(hits.length,'hollow jar has a real interior floor');const y=lerp(eye,end,hits[0].fraction!)[1];if(y>b.min[1]+(b.max[1]-b.min[1])*.35)errors.push(`${c.kind} vertical mouth ray first hits actual triangle ${hits[0].id} at y${y}, bottom ${b.min[1]}, top ${b.max[1]}`);mouths++;
  }
  assert.equal(rings,5);assert.ok(mouths>=14);reportMetric('modeledOpenings',{closedLoopRings:rings,deepPotteryMouths:mouths,failures:errors.length,examples:errors.slice(0,18)});assertNoFailures(errors,'closed tube/open pottery');t.diagnostic(JSON.stringify(report.metrics.modeledOpenings));
});

// Regression for the rendered kiln defect: nested solid boxes can satisfy
// contact tests while their coincident, outward-facing skin z-fights. Measure
// actual coplanar triangle overlap, not component boxes or material settings.
function coincidentOutwardArea(a:Triangle,b:Triangle){
  const normal=(q:Triangle)=>{const u=sub(q.b,q.a),v=sub(q.c,q.a);return[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];};
  const na=normal(a),nb=normal(b),la=Math.hypot(...na),lb=Math.hypot(...nb);if(la<1e-10||lb<1e-10||dot(na,nb)/(la*lb)<1-1e-9)return 0;
  if([b.a,b.b,b.c].some(p=>Math.abs(dot(na,sub(p,a.a)))/la>1e-7))return 0;
  const drop=na.reduce((best,n,i)=>Math.abs(n)>Math.abs(na[best])?i:best,0),axes=[0,1,2].filter(i=>i!==drop),project=(p:V):V=>[p[axes[0]],0,p[axes[1]]],projected={...b,a:project(b.a),b:project(b.b),c:project(b.c)};
  return area(clipPolygon([project(a.a),project(a.b),project(a.c)],projected))*la/Math.abs(na[drop]);
}
audit('desert repaired kiln continuous piers and seated lintel have no duplicate exposed coplanar source faces','structural',t=>{
  const piers=geometry.components.filter(c=>c.kind==='kiln-shelf-grounded-masonry-ledge'),shelves=geometry.components.filter(c=>c.kind==='kiln-ledge-seated-pottery-shelf'),jambs=geometry.components.filter(c=>c.kind==='kiln-mouth-seated-jamb'),lintels=geometry.components.filter(c=>c.kind==='kiln-mouth-jamb-seated-lintel');
  assert.equal(piers.length,2,'two continuous masonry piers replace six nested solids');assert.equal(shelves.length,3);assert.equal(jambs.length,2);assert.equal(lintels.length,1);
  for(const pier of piers){const b=actualBounds.get(pier)!;assert.ok(Math.abs(b.max[1]-b.min[1]-4.6)<1e-7);assert.ok(Math.abs(b.max[2]-b.min[2]-1.6)<1e-7);}
  for(const shelf of shelves)assert.equal(piers.filter(pier=>actualContact(shelf,pier)).length,2,`shelf ${JSON.stringify(actualBounds.get(shelf))} lacks both actual pier contacts`);
  const lintel=lintels[0];for(const jamb of jambs){assert.ok(Math.abs(actualBounds.get(jamb)!.max[1]-actualBounds.get(lintel)!.min[1])<1e-7,'jamb top exactly meets lintel underside');assert.ok(actualContact(jamb,lintel),'actual jamb/lintel surfaces touch');}
  const parts=[...piers,...shelves,...jambs,lintel],triangles=parts.flatMap(c=>componentTriangles.get(c)??[]);let testedPairs=0,maximumOverlap=0;const errors:string[]=[];
  for(let i=0;i<triangles.length;i++)for(let j=i+1;j<triangles.length;j++){
    const a=triangles[i],b=triangles[j];if(componentOf.get(a.id)===componentOf.get(b.id))continue;testedPairs++;
    const overlap=coincidentOutwardArea(a,b);maximumOverlap=Math.max(maximumOverlap,overlap);if(overlap>1e-7)errors.push(`${componentOf.get(a.id)?.kind} triangle${a.id}/${componentOf.get(b.id)?.kind} triangle${b.id} duplicate exposed coplanar area${overlap}`);
  }
  // A real coincident same-facing fixture must fail the geometry predicate,
  // while opposite-facing internal seating faces remain legitimate contacts.
  const q=triangles[0],copy={...q,id:-2},reversed={...q,id:-3,b:q.c,c:q.b};assert.ok(coincidentOutwardArea(q,copy)>1e-4);assert.equal(coincidentOutwardArea(q,reversed),0);
  reportMetric('kilnConstructionRepair',{continuousPiers:piers.length,shelves:shelves.length,jambs:jambs.length,lintels:lintels.length,actualTriangles:triangles.length,testedPairs,maximumDuplicateOutwardArea:maximumOverlap,failures:errors.length,pierBounds:piers.map(p=>actualBounds.get(p)),jambTopY:jambs.map(j=>actualBounds.get(j)!.max[1]),lintelUndersideY:actualBounds.get(lintel)!.min[1]});assertNoFailures(errors,'kiln exposed coplanar source faces');t.diagnostic(JSON.stringify(report.metrics.kilnConstructionRepair));
});
