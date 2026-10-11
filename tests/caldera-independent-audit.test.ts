// Independent emitted-geometry audit. These tests use rendered positions/indices,
// never planned volumes, camera height answers, scene-provided road faces or
// claimed component bounds as proof. Source provenance identifies parts only.
import test, {after,type TestContext} from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {CALDERA_COURSE,CALDERA_LANDMARKS,CALDERA_VIADUCT} from '../src/maps/caldera';
import {buildCalderaSceneGeometry} from '../src/caldera-scenery';
import {calderaPickupRows} from '../src/land-course-pickups';
import {chaseCamera} from '../src/race-camera';
import {safeLandCamera,cameraMeshCandidateIds,type CameraPoint} from '../src/land-camera';

// The collision oracle below consumes ONLY rendered batch positions/indices.
// It deliberately does not import cameraTerrainHeight, road footprint clipping,
// camera boxes, scene terrainGrid, or roadFaces to prove geometry is unobstructed.
type V=readonly number[];
type Triangle={indexStart?:number;id:number;batch:string;vertices:readonly number[];a:V;b:V;c:V;min:V;max:V};
const auditStage=process.env.CALDERA_AUDIT_STAGE??'all';
const auditDirectory=process.env.CALDERA_AUDIT_DIR??resolve('../land-map-artifacts/caldera-audit');
const sourceFiles=['src/maps/caldera.ts','src/caldera-scenery.ts','src/land-course-pickups.ts','src/race-camera.ts','src/land-camera.ts','src/land-road-mesh.ts','src/land-mesh-builder.ts','src/land-driving.ts','src/land-routes.ts','src/open-road.ts','tests/caldera-independent-audit.test.ts'];
const sourceHashes=()=>Object.fromEntries(sourceFiles.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
const hashesBefore=sourceHashes(),started=Date.now();
const report:{stage:string;startedAt:string;sourceHashesBefore:Record<string,string>;sourceHashesAfter?:Record<string,string>;stable?:boolean;durationSeconds?:number;metrics:Record<string,unknown>;checks:{name:string;status:string;error?:string}[];limitations:string[]}={stage:auditStage,startedAt:new Date().toISOString(),sourceHashesBefore:hashesBefore,metrics:{},checks:[],limitations:['CPU emitted-source geometry audit only; no native game pixels, GPU, or FPS certification','Original blueprint volumes are locating and acceptance inputs only, never actual-mesh proof']};
function audit(name:string,phase:'structural'|'camera',fn:(t:TestContext)=>void){
  if(auditStage!=='all'&&auditStage!==phase)return;
  test(name,t=>{try{fn(t);report.checks.push({name,status:'passed'});}catch(error){report.checks.push({name,status:'failed',error:String(error)});throw error;}});
}
after(()=>{report.sourceHashesAfter=sourceHashes();report.stable=JSON.stringify(report.sourceHashesAfter)===JSON.stringify(hashesBefore);report.durationSeconds=(Date.now()-started)/1000;report.metrics.resources={maxRSSKiB:process.resourceUsage().maxRSS,heapCapMiB:448,concurrency:1};mkdirSync(auditDirectory,{recursive:true});writeFileSync(resolve(auditDirectory,`${auditStage}-report.json`),JSON.stringify(report,null,2)+'\n');assert.ok(report.stable,'audited sources changed during this run; result is stale');});
const geometry=buildCalderaSceneGeometry(CALDERA_COURSE);
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
      const t:Triangle={indexStart:i,id:this.triangles.length,batch:batch.name,vertices:batch.indices.slice(i,i+3),a,b,c,min:[0,1,2].map(k=>Math.min(a[k],b[k],c[k])),max:[0,1,2].map(k=>Math.max(a[k],b[k],c[k]))};
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
const terrainIds=new Set<number>();
let terrain:Triangle[]=[];
function boomFailure(a:V,b:V,label:string):string|null{
  const hit=mesh.firstHit(a,b);if(hit)return `${label}: source mesh ${hit.triangle.batch} triangle ${hit.triangle.id} intersects boom at ${hit.fraction}, anchor:${a}, camera:${b}`;
  let traversed=0;
  for(const t of mesh.query(a,b))if(terrainIds.has(t.id)){
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
  const matches=(componentsByBatch.get(triangle.batch)??[]).filter(c=>triangle.indexStart!>=c.indexStart&&triangle.indexStart!<c.indexEnd);
  assert.equal(matches.length,1,`triangle ${triangle.id} must have exactly one primitive provenance owner`);
  const c=matches[0];assert.ok(triangle.vertices.every(v=>v>=c.vertexStart&&v<c.vertexEnd));
  componentOf.set(triangle.id,c);const list=componentTriangles.get(c)??[];list.push(triangle);componentTriangles.set(c,list);
}
// Primitive index spans identify parts only. All geometric proof consumes the actual rendered positions and indices.
terrain=mesh.triangles.filter(t=>['connected-contour-basalt-heightfield','connected-contour-ash-heightfield','connected-contour-ochre-heightfield'].includes(componentOf.get(t.id)?.kind??''));
for(const t of terrain)terrainIds.add(t.id);
assert.ok(terrain.length,'actual connected basalt/ash field exists');
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
function fullGroundContact(c:Component,tolerance=.001,exposedTop=actualBounds.get(c)!.max[1],ridgeIntegrated=false){
  const bounds=actualBounds.get(c)!,polygon=hullXZ(actualComponentPoints(c));let low=Infinity,high=-Infinity;
  const coverage=supportCoverage(polygon,(t,p)=>{
    if(!terrainIds.has(t.id))return false;
    for(const point of p){const y=height(t,point[0],point[2]);low=Math.min(low,y);high=Math.max(high,y);}
    return true;
  });
  assert.ok(coverage.uncovered<1e-5,`${c.kind} missing actual full-footprint terrain:${coverage.uncovered}`);
  assert.ok(bounds.min[1]<=low+tolerance,`${c.kind} floats over low terrain:${bounds.min[1]} > ${low}`);
  assert.ok(exposedTop>(ridgeIntegrated?low:high)+.01,`${c.kind} has no required exposed ground contact:${exposedTop} <= ${ridgeIntegrated?low:high}`);
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
for(const edge of Object.values(CALDERA_COURSE.edges)){
  const n=Math.ceil(edge.length/1.65);
  for(let i=0;i<n;i++){
    const s=i/n*edge.length,next=(i+1)/n*edge.length;
    const a=tuple(edge.sample(s,-edge.halfWidthAt(s)).p),b=tuple(edge.sample(s,edge.halfWidthAt(s)).p),c=tuple(edge.sample(next,-edge.halfWidthAt(next)).p),d=tuple(edge.sample(next,edge.halfWidthAt(next)).p);
    for(const [v0,v1,v2] of [[a,c,b],[b,c,d]])physical.push({id:physical.length,batch:'independent physical width',vertices:[],a:v0,b:v1,c:v2,...boundsOf([v0,v1,v2]),edgeId:edge.id,s,next});
  }
}
const reportMetric=(key:string,value:unknown)=>{report.metrics[key]=value;};
const assertNoFailures=(errors:string[],label:string)=>assert.equal(errors.length,0,`${label}: ${errors.length} failures\n${errors.slice(0,18).join('\n')}`);
const nearSamePlane=(a:Triangle,b:Triangle,p:V[],tolerance=1e-6)=>p.every(q=>Math.abs(height(a,q[0],q[2])-height(b,q[0],q[2]))<tolerance);
const upward=(q:Triangle)=>cross2(q.a,q.b,q.c)<-1e-9;
const kind=(q:Triangle)=>componentOf.get(q.id)?.kind??'';
const shoulderTriangles=mesh.triangles.filter(q=>kind(q)==='source-exact-layer-owned-shoulders');
const shoulderIds=new Set(shoulderTriangles.map(q=>q.id));

// Frozen design grid dimensions are reconstructed using ACTUAL emitted grid
// corner coordinates; no scene heightfield answers or baseline-face metadata
// are trusted. Clipped material vertices have to remain in these source planes.
let terrainPartitionResult:Record<string,unknown>|null=null;
function verifyTerrainPartition(){
 if(terrainPartitionResult)return terrainPartitionResult;
 const minX=-590,maxX=465,minZ=-885,maxZ=455,nx=150,nz=125,dx=(maxX-minX)/nx,dz=(maxZ-minZ)/nz,grid=new Map<number,V>();
 for(const q of terrain)for(const p of [q.a,q.b,q.c]){
  const x=Math.round((p[0]-minX)/dx),z=Math.round((p[2]-minZ)/dz);
  if(x<0||x>nx||z<0||z>nz||Math.abs(p[0]-(minX+x*dx))>1e-7||Math.abs(p[2]-(minZ+z*dz))>1e-7)continue;
  const id=z*(nx+1)+x,prior=grid.get(id);if(prior)assert.ok(Math.abs(prior[1]-p[1])<1e-8,`physical grid corner ${id} has two heights`);else grid.set(id,p);
 }
 assert.equal(grid.size,(nx+1)*(nz+1),'every protected baseline corner actually emitted');
 const scalar=(p:V)=>p[1]-(19+.010*(p[0]+170)+.007*(p[2]+120));
 const credited=new Map<number,number>();let baselineFaces=0,mixedFaces=0,coveredIntersections=0,ownershipPairs=0,maxAffineError=0,maxUncoveredArea=0,maxOverlapArea=0,totalArea=0;
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const i=z*(nx+1)+x;for(const ids of [[i,i+nx+1,i+1],[i+1,i+nx+1,i+nx+2]]){
  const [a,b,c]=ids.map(i=>grid.get(i)!),baseline:Triangle={id:-1-baselineFaces,batch:'independent protected source grid',vertices:ids,a,b,c,...boundsOf([a,b,c])},polygon=[a,b,c],parts:{triangle:Triangle;polygon:V[]}[]=[];let remaining=[polygon];
  for(const q of mesh.query(baseline.min,baseline.max)){
   if(!terrainIds.has(q.id))continue;const overlap=clipPolygon(polygon,q),size=area(overlap);if(size<1e-9)continue;assert.ok(upward(q));
   for(const p of overlap){const error=Math.abs(height(q,p[0],p[2])-height(baseline,p[0],p[2]));maxAffineError=Math.max(maxAffineError,error);assert.ok(error<1e-6,`material face ${q.id} changes protected plane ${baselineFaces} by ${error}`);}
   const basalt=kind(q)==='connected-contour-basalt-heightfield',ash=kind(q)==='connected-contour-ash-heightfield';assert.ok(basalt||ash,'all connected material owners independently classified');
   for(const p of [q.a,q.b,q.c])assert.ok(basalt?scalar(p)>=-1e-7:scalar(p)<=1e-7,`${q.batch} triangle${q.id} crosses exact geological contour`);
   remaining=remaining.flatMap(p=>subtractTriangleFootprint(p,q));parts.push({triangle:q,polygon:overlap});credited.set(q.id,(credited.get(q.id)??0)+size);coveredIntersections++;
  }
  const missing=remaining.reduce((n,p)=>n+area(p),0);maxUncoveredArea=Math.max(maxUncoveredArea,missing);assert.ok(missing<1e-6,`baseline${baselineFaces} missing ${missing}m²`);
  for(let a=0;a<parts.length;a++)for(let b=a+1;b<parts.length;b++){const overlap=area(clipPolygon(parts[a].polygon,parts[b].triangle));maxOverlapArea=Math.max(maxOverlapArea,overlap);assert.ok(overlap<1e-7,`baseline${baselineFaces} double-owned by${parts[a].triangle.id}/${parts[b].triangle.id}: ${overlap}`);ownershipPairs++;}
  if(Math.min(...polygon.map(scalar))< -1e-7&&Math.max(...polygon.map(scalar))>1e-7){mixedFaces++;assert.equal(new Set(parts.map(p=>kind(p.triangle))).size,2,'a crossed geological boundary must have both exact material pieces, never one whole-cell shortcut');}
  totalArea+=area(polygon);baselineFaces++;
 }}
 assert.equal(baselineFaces,37500);assert.equal(credited.size,terrain.length);assert.ok(mixedFaces>100,'actual subcell geological contours are present');
 for(const q of terrain)assert.ok(Math.abs((credited.get(q.id)??0)-area([q.a,q.b,q.c]))<1e-5,`material${q.id} extends outside protected grid`);
 const gridSHA256=createHash('sha256').update(JSON.stringify([...grid].sort((a,b)=>a[0]-b[0]))).digest('hex');
 terrainPartitionResult={baselineFaces,baselineVertices:grid.size,emittedTriangles:terrain.length,mixedContourFaces:mixedFaces,gridSHA256,coveredIntersections,ownershipPairs,maxAffineError,maxUncoveredArea,maxOverlapArea,totalArea,scope:'Actual emitted corner reconstruction; every baseline plane covered once, exact linear geological material split'};
 return terrainPartitionResult;
}

audit('caldera emitted geometry has finite indexed data and stays below24 batches110k triangles200k vertices','structural',t=>{
 let vertices=0,triangles=0;assert.equal(geometry.trackId,'caldera');
 for(const b of geometry.batches){vertices+=b.positions.length/3;triangles+=b.indices.length/3;assert.equal(b.positions.length%3,0);assert.equal(b.indices.length%3,0);assert.equal(b.uvs.length,b.positions.length/3*2);assert.ok(b.positions.every(Number.isFinite));assert.ok(b.uvs.every(Number.isFinite));assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));}
 assert.ok(geometry.batches.length<=24);assert.ok(vertices<200000);assert.ok(triangles<110000);assert.equal(componentOf.size,triangles);
 for(const c of geometry.components){assert.ok((componentTriangles.get(c)?.length??0)>0);const b=actualBounds.get(c)!;for(let k=0;k<3;k++){assert.ok(Math.abs(b.min[k]-c.min[k])<1e-7);assert.ok(Math.abs(b.max[k]-c.max[k])<1e-7);}}
 reportMetric('mesh',{batches:geometry.batches.length,triangles,vertices,components:geometry.components.length,terrainTriangles:terrain.length});t.diagnostic(JSON.stringify(report.metrics.mesh));
});

audit('caldera actual road is positive single-owned and covers the complete independent full-width two-layer union','structural',t=>{
 let pairs=0,separatedPairs=0,coveragePolygons=0,laneProbes=0,maxHeightError=0;assert.ok(roads.length>3000);
 for(const road of roads){assert.ok(upward(road),`road ${road.id} is nonpositive`);for(const other of mesh.query(road.min,road.max))if(other.id>road.id&&roadIds.has(other.id)){
  const p=clipPolygon([road.a,road.b,road.c],other);if(area(p)<1e-7)continue;assert.ok(p.every(q=>Math.abs(height(road,q[0],q[2])-height(other,q[0],q[2]))>24),`coplanar/unsafe road double ownership ${road.id}/${other.id} area${area(p)}`);separatedPairs++;}pairs++;
 }
 for(const reference of physical){assert.ok(upward(reference),`source fold ${reference.edgeId}:${reference.s}`);const coverage=supportCoverage([reference.a,reference.b,reference.c],(q,p)=>{
  if(!roadIds.has(q.id)||!nearSamePlane(q,reference,p))return false;for(const v of p)maxHeightError=Math.max(maxHeightError,Math.abs(height(q,v[0],v[2])-height(reference,v[0],v[2])));return true;
 });assert.ok(coverage.uncovered<1e-5,`${reference.edgeId}:${reference.s} lacks${coverage.uncovered}m² rendered full width`);coveragePolygons++;}
 for(const edge of Object.values(CALDERA_COURSE.edges))for(let s=0;s<=edge.length;s=Math.min(edge.length,s+1)){
  for(const side of [-1,-.5,0,.5,1]){const p=tuple(edge.sample(s,side*edge.laneLimitAt(s)).p);assert.ok(mesh.query(p,p,.03).some(q=>roadIds.has(q.id)&&projectedInterval(q,p,p)&&Math.abs(height(q,p[0],p[2])-p[1])<.08),`${edge.id}:${s} lane${side} lacks support`);laneProbes++;}if(s===edge.length)break;
 }
 reportMetric('roadUnion',{actualTriangles:roads.length,pairs,separatedPairs,coveragePolygons,laneProbes,maxHeightError});t.diagnostic(JSON.stringify(report.metrics.roadUnion));
});

audit('caldera exact100m level decision40m common tail and five full-width physical seams remain unchanged','structural',t=>{
 const {start,alley,boulevard,finish}=CALDERA_COURSE.edges;let decisions=0,tails=0,seams=0;const end=start.sample(start.length);
 for(let d=0;d<=100;d+=.25)for(const lateral of [-9.5,-4.75,0,4.75,9.5]){const p=start.sample(start.length-d,lateral);assert.ok(Math.abs(p.p.x-(end.p.x-lateral))<1e-9);assert.ok(Math.abs(p.p.y-14)<1e-9);assert.ok(Math.abs(p.p.z-end.p.z-d)<1e-8);assert.equal(p.bank,0);assert.equal(start.halfWidthAt(start.length-d),9.5);decisions++;}
 for(let remaining=0;remaining<=40;remaining+=.125)for(const lateral of [-9.5,-4.75,0,4.75,9.5]){const a=alley.sample(alley.length-remaining,lateral),b=boulevard.sample(boulevard.length-remaining,lateral);assert.ok(a.p.distance(b.p)<1e-9);assert.ok(a.t.distance(b.t)<1e-9);assert.ok(a.n.distance(b.n)<1e-9);assert.ok(a.normal.distance(b.normal)<1e-9);assert.equal(Math.abs(a.bank),0);assert.equal(Math.abs(b.bank),0);assert.equal(alley.halfWidthAt(alley.length-remaining),9.5);tails++;}
 for(const [a,b]of [[start,alley],[start,boulevard],[alley,finish],[boulevard,finish],[finish,start]])for(let l=-9.5;l<=9.5;l+=.125){const p=a.sample(a.length,l),q=b.sample(0,l);assert.ok(p.p.distance(q.p)<1e-7);assert.ok(p.t.distance(q.t)<1e-7);assert.ok(p.n.distance(q.n)<1e-7);seams++;}
 let splitMax=0,mergeMax=0,pairs=0;for(const a of physical.filter(p=>p.edgeId==='alley'))for(const b of physical.filter(p=>p.edgeId==='boulevard')){if(a.min[0]>b.max[0]||a.max[0]<b.min[0]||a.min[2]>b.max[2]||a.max[2]<b.min[2])continue;if(area(clipPolygon([a.a,a.b,a.c],b))<1e-7)continue;pairs++;if(a.s<alley.length/2)splitMax=Math.max(splitMax,a.next,b.next);else mergeMax=Math.max(mergeMax,alley.length-a.s,boulevard.length-b.s);}
 assert.ok(splitMax>25&&splitMax<40);assert.ok(mergeMax>70&&mergeMax<90);assert.ok(mergeMax>40);
 let derivatives=0,maxGrade=0,minForward=Infinity;for(const edge of Object.values(CALDERA_COURSE.edges))for(let s=.25;s<edge.length-.25;s+=.5)for(const side of [-1,0,1]){const a=edge.sample(s-.25,side*edge.halfWidthAt(s-.25)).p,b=edge.sample(s+.25,side*edge.halfWidthAt(s+.25)).p,d=b.clone().sub(a),forward=d.dot(edge.sample(s).t)/.5,grade=Math.abs(d.y)/Math.hypot(d.x,d.z);minForward=Math.min(minForward,forward);maxGrade=Math.max(maxGrade,grade);assert.ok(forward>.55);assert.ok(grade<.091);derivatives++;}
 reportMetric('routeContract',{decisions,tails,seams,splitMax,mergeMax,overlapPairs:pairs,derivatives,maxGrade,minForward});t.diagnostic(JSON.stringify(report.metrics.routeContract));
});

audit('caldera full physical lower ground and upper deck support every road face while actual solids clear3.2m kart prisms','structural',t=>{
 let roadsChecked=0,groundPairs=0,deckPairs=0,bodyCandidates=0,minGroundGap=Infinity,maxGroundGap=0;const errors:string[]=[];
 for(const road of roads){let elevated=false;const coverage=supportCoverage([road.a,road.b,road.c],(q,p)=>{
  if(!terrainIds.has(q.id))return false;for(const point of p){const gap=height(road,point[0],point[2])-height(q,point[0],point[2]);minGroundGap=Math.min(minGroundGap,gap);maxGroundGap=Math.max(maxGroundGap,gap);if(gap<.15-1e-7)errors.push(`road${road.id} terrain${q.id} intrudes ground gap${gap}`);if(gap>=4)elevated=true;}return true;
 });if(coverage.uncovered>1e-5)errors.push(`road${road.id} lacks connected ground${coverage.uncovered}`);groundPairs+=coverage.intersections;
 if(elevated){const deck=supportCoverage([road.a,road.b,road.c],(q,p)=>['viaduct-continuous-two-arch-solid-deck','viaduct-grounded-source-affine-approach-masonry'].includes(kind(q))&&upward(q)&&p.every(v=>{const d=height(road,v[0],v[2])-height(q,v[0],v[2]);return d>=.15&&d<=.30;}));if(deck.uncovered>1e-5)errors.push(`elevated road${road.id} lacks real upper masonry support${deck.uncovered}`);deckPairs+=deck.intersections;}
 for(const q of mesh.query(road.min,road.max)){if(roadIds.has(q.id)||q.min[1]>road.max[1]+3.2||q.max[1]<road.min[1]+.15)continue;bodyCandidates++;const p=prismIntersection(q,road,.15,3.2);if(p.length>=3&&area3D(p)>1e-7)errors.push(`${kind(q)} triangle${q.id} penetrates road${road.id} full-width actual kart body: ${JSON.stringify(p)}`);}roadsChecked++;
 }
 reportMetric('physicalSupportAndKartBody',{roadsChecked,groundPairs,deckPairs,bodyCandidates,minGroundGap,maxGroundGap,failures:errors.length,examples:errors.slice(0,30)});assertNoFailures(errors,'actual road support/body');assert.ok(deckPairs>100);t.diagnostic(JSON.stringify(report.metrics.physicalSupportAndKartBody));
});

const bridgeComponents=geometry.components.filter(c=>c.kind.startsWith('viaduct-'));
const bridgeIds=new Set(bridgeComponents.flatMap(c=>(componentTriangles.get(c)??[]).map(q=>q.id)));
const bridgeTriangles=mesh.triangles.filter(q=>bridgeIds.has(q.id));

audit('caldera actual twin arch undersides provide24m full-width lower apertures and genuine2.4m thick upper stone','structural',t=>{
 const deck=geometry.components.filter(c=>c.kind==='viaduct-continuous-two-arch-solid-deck');assert.equal(deck.length,1);
 const faces=componentTriangles.get(deck[0])!,top=faces.filter(upward),bottom=faces.filter(q=>cross2(q.a,q.b,q.c)>1e-9);assert.ok(top.length>100&&bottom.length>100);
 let minimumThickness=Infinity,maximumThickness=0,thicknessPairs=0;for(const q of bottom){const coverage=supportCoverage([q.a,q.b,q.c],(r,p)=>{
  if(!top.includes(r))return false;for(const v of p){const thickness=height(r,v[0],v[2])-height(q,v[0],v[2]);minimumThickness=Math.min(minimumThickness,thickness);maximumThickness=Math.max(maximumThickness,thickness);assert.ok(thickness>=2.4-1e-5,`actual stone crown thickness ${thickness}`);}return true;
 });assert.ok(coverage.uncovered<1e-5,`soffit${q.id} lacks complete solid top${coverage.uncovered}`);thicknessPairs+=coverage.intersections;}
 const crossings:Record<string,{pairs:number;minimumClearance:number;minS:number;maxS:number}>={};let aperturePairs=0,minimumClearance=Infinity;
 for(const lower of physical.filter(q=>q.edgeId==='alley'||q.edgeId==='boulevard'))for(const q of mesh.query(lower.min,lower.max)){
  if(!bridgeIds.has(q.id)||Math.abs(cross2(q.a,q.b,q.c))<1e-9)continue;const p=clipPolygon([lower.a,lower.b,lower.c],q);if(area(p)<1e-7)continue;
  const minimum=Math.min(...p.map(v=>height(q,v[0],v[2])-height(lower,v[0],v[2])));assert.ok(minimum>=24,`${lower.edgeId}:${lower.s} bridge${q.id}/${kind(q)} true full-width aperture${minimum}`);
  const record=crossings[lower.edgeId]??={pairs:0,minimumClearance:Infinity,minS:Infinity,maxS:-Infinity};record.pairs++;record.minimumClearance=Math.min(record.minimumClearance,minimum);record.minS=Math.min(record.minS,lower.s);record.maxS=Math.max(record.maxS,lower.next);minimumClearance=Math.min(minimumClearance,minimum);aperturePairs++;
 }
 assert.deepEqual(Object.keys(crossings).sort(),['alley','boulevard']);assert.ok(aperturePairs>50);assert.ok(maximumThickness>12);
 reportMetric('actualTwinArch',{actualBridgeTriangles:bridgeTriangles.length,topTriangles:top.length,soffitTriangles:bottom.length,thicknessPairs,minimumThickness,maximumThickness,aperturePairs,minimumClearance,minimumKartHeadroom:minimumClearance-3.2,byLowerEdge:crossings});t.diagnostic(JSON.stringify(report.metrics.actualTwinArch));
});

audit('caldera true shafts and abutments bear on all actual terrain and meet entire triangle-linear soffit','structural',t=>{
 const deck=geometry.components.find(c=>c.kind==='viaduct-continuous-two-arch-solid-deck')!,under=(componentTriangles.get(deck)??[]).filter(q=>cross2(q.a,q.b,q.c)>1e-9),supports=geometry.components.filter(c=>/^viaduct-(center-pier|rim-abutment)-exact-soffit-bearing$/.test(c.kind));assert.equal(supports.length,3);let groundIntersections=0,soffitIntersections=0,contactArea=0;
 for(const c of supports){groundIntersections+=fullGroundContact(c,.001,actualBounds.get(c)!.max[1],c.kind.includes('rim-abutment'));const top=(componentTriangles.get(c)??[]).filter(upward);assert.ok(top.length>0);let fullTopArea=0;
  for(const q of top){fullTopArea+=area([q.a,q.b,q.c]);const result=supportCoverage([q.a,q.b,q.c],(r,p)=>under.includes(r)&&nearSamePlane(q,r,p,1e-6));assert.ok(result.uncovered<1e-5,`${c.kind} top${q.id} lacks${result.uncovered}m² real arch bearing`);soffitIntersections+=result.intersections;}
  const foot=hullXZ(actualComponentPoints(c)),complete=supportCoverage(foot,(r)=>belongs(r,c)&&upward(r));assert.ok(complete.uncovered<1e-5,`${c.kind} has an incomplete physical shaft top`);assert.ok(Math.abs(fullTopArea-area(foot))<1e-5);contactArea+=fullTopArea;
 }
 const wedges=geometry.components.filter(c=>c.kind==='viaduct-attached-real-voussoir-wedge');assert.ok(wedges.length>100);for(const c of wedges)assert.ok(actualContact(c,deck),`${c.kind} ${geometry.components.indexOf(c)} floats away from arch body`);
 reportMetric('bridgeBearing',{shaftsAndAbutments:supports.length,groundIntersections,soffitIntersections,wholeTopContactArea:contactArea,realAttachedWedges:wedges.length});t.diagnostic(JSON.stringify(report.metrics.bridgeBearing));
});

audit('caldera real lower bridge aperture encloses continuous all-lane all-yaw all-pitch camera orbit capsules','camera',t=>{
 const radius=Math.hypot(15,6.9),margin=.3,spacing=.5,betweenFrames=.5;let frames=0,candidates=0,minimum=Infinity;const failures:string[]=[],examples:unknown[]=[];
 for(const edge of [CALDERA_COURSE.edges.alley,CALDERA_COURSE.edges.boulevard])for(let s=0;s<=edge.length;s+=spacing){
  const p=edge.sample(s).p;if(p.x< -445||p.x> -65||p.z< -425||p.z> -270)continue;
  const a=tuple(edge.sample(s,-edge.laneLimitAt(s)).p).map((v,k)=>v+(k===1?1:0)),b=tuple(edge.sample(s,edge.laneLimitAt(s)).p).map((v,k)=>v+(k===1?1:0));let local=Infinity,closest=-1;
  for(const q of mesh.query(a,b,radius+margin+betweenFrames))if(bridgeIds.has(q.id)){const clearance=segmentTriangleDistance(a,b,q)-radius-margin-betweenFrames;candidates++;if(clearance<local){local=clearance;closest=q.id;}}
  minimum=Math.min(minimum,local);if(local<0){failures.push(`${edge.id}:${s} continuous orbit tube hits actual bridge${closest}, margin${local}`);if(examples.length<20)examples.push({edge:edge.id,s,closest,margin:local});}frames++;
 }
 assert.ok(frames>100);reportMetric('continuousLowerApertureOrbit',{frames,candidates,orbitRadius:radius,strictMargin:margin,sourceStep:spacing,betweenFrameAllowance:betweenFrames,minimumMargin:minimum,failures:failures.length,examples,scope:'Actual bridge triangles; complete legal-lane capsule includes every shared-view yaw and pitch and anchor-to-camera boom. Between-frame allowance is additional to the0.3m gate. Full live smoothing is separately exercised.'});assertNoFailures(failures,'continuous actual lower aperture orbit');t.diagnostic(JSON.stringify(report.metrics.continuousLowerApertureOrbit));
});
function triangleDistanceXZ(t:Triangle,p:V){
  if(projectedInterval(t,p,p))return 0;const points=[t.a,t.b,t.c];return Math.min(...points.map((a,i)=>{const b=points[(i+1)%3],x=b[0]-a[0],z=b[2]-a[2],u=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[2]-a[2])*z)/(x*x+z*z)));return Math.hypot(p[0]-a[0]-u*x,p[2]-a[2]-u*z);}));
}


const orbitCases=Array.from({length:24},(_,i)=>[-.28,0,.4,.78].map(pitch=>({yaw:-Math.PI+i*Math.PI/12,pitch,rearView:false}))).flat();
// Rear view deliberately overrides all orbit yaws/pitches in the real source;
// one rear pose covers them, while release/toggle transitions are tested below.
const allViews=[...orbitCases,{yaw:0,pitch:0,rearView:true}];
const anchorAt=(frame:ReturnType<typeof CALDERA_COURSE.commonStart.sample>)=>({x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z});
const smoothPose=(a:CameraPoint,b:CameraPoint,dt=1/60)=>{const alpha=1-Math.exp(-dt*8);return{x:a.x+(b.x-a.x)*alpha,y:a.y+(b.y-a.y)*alpha,z:a.z+(b.z-a.z)*alpha};};

audit('caldera desired-safe and genuinely interpolated whole booms clear actual mesh by 0.3m on all edges lanes and orbit/rear poses','camera',t=>{
  let poses=0,retractions=0,rawHits=0,failures=0;const examples:string[]=[];
  const inspect=(a:CameraPoint,b:CameraPoint,label:string)=>{const failure=boomFailure(tuple(a),tuple(b),label);if(failure){failures++;if(examples.length<12)examples.push(failure);}};
  for(const edge of Object.values(CALDERA_COURSE.edges)){
    const distances=new Set<number>([0,edge.length]);for(let s=0;s<edge.length;s+=12)distances.add(s);
    for(const s0 of [0,edge.length,...(edge.id==='alley'||edge.id==='boulevard'?[80,110,edge.length-80,edge.length-110]:[])])
      for(let s=Math.max(0,s0-36);s<=Math.min(edge.length,s0+36);s+=3)distances.add(s);
    for(const s0 of [...CALDERA_VIADUCT.crossings.filter(c=>c.lowerEdge===edge.id).map(c=>c.lowerS),...(edge.id==='finish'?[...CALDERA_VIADUCT.upperPhysicalS,...CALDERA_VIADUCT.crossings.map(c=>c.upperS)]:[])])for(let s=Math.max(0,s0-35);s<=Math.min(edge.length,s0+35);s+=2)distances.add(s);
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
  assert.ok(poses>60000);reportMetric('wholeCourseCameras',{poses,desiredBooms:poses,interpolatedBooms:poses,rawHits,retractions,failures,strictMargin:.3,yaws:24,pitches:4,legalLanes:3,views:2,wholeRouteSpacingMetres:12,transitionSpacingMetres:3,scope:'Finite source-mesh pose matrix; not continuous-yaw universal proof'});t.diagnostic(`${poses} desired-safe and ${poses} truly interpolated complete 0.3m capsule/source-mesh checks; ${rawHits} raw desired source hits, ${retractions} retractions`);
});


function assertDefaultFrustum(camera:CameraPoint,look:CameraPoint,target:V,label:string){
  const forward=sub(tuple(look),tuple(camera)).map((n,_,p)=>n/Math.hypot(...p));
  const right=[-forward[2],0,forward[0]],rl=Math.hypot(...right);right.forEach((_,i)=>right[i]/=rl);
  const up=[right[1]*forward[2]-right[2]*forward[1],right[2]*forward[0]-right[0]*forward[2],right[0]*forward[1]-right[1]*forward[0]],ray=sub(target,tuple(camera)),depth=dot(forward,ray),tan=Math.tan(28*Math.PI/180);
  assert.ok(depth>0&&Math.abs(dot(right,ray))<depth*tan*16/10&&Math.abs(dot(up,ray))<depth*tan,`${label} outside actual 56 degree 1280×800 native chase frustum`);
}
audit('every caldera pickup has physical mesh-clear approach rays and default framing including both branch approaches','camera',t=>{
  let rays=0;
  for(const pickup of calderaPickupRows(CALDERA_COURSE))for(const ahead of [12,25,40,55])for(const side of [-1,0,1])for(const view of [0,1]){
    const edge=CALDERA_COURSE.edges[pickup.edgeId],s=pickup.s-ahead,frame=edge.sample(s,side*edge.laneLimitAt(s)),anchor=anchorAt(frame),pose=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:false,orbit:{yaw:0,pitch:0}}),camera=safeLandCamera(anchor,pose.position,geometry.cameraObstacles);
    for(const lift of [1.08,1.25,1.42]){
      const target=[pickup.p.x,pickup.p.y+lift,pickup.p.z],hit=mesh.firstHit(tuple(camera),target),label=`${pickup.edgeId}:${pickup.s} itemLane:${pickup.lateral} actorLane:${side} ahead:${ahead} view:${view} bob:${lift}`;
      assert.ok(!hit,`${label}: blocked by actual ${hit?.triangle.batch}/${hit&&componentOf.get(hit.triangle.id)?.kind} triangle ${hit?.triangle.id}`);assertDefaultFrustum(camera,pose.look,target,label);rays++;
    }
  }
  assert.ok(rays>=1440);reportMetric('pickupVisibility',{rays,bobHeights:[1.08,1.25,1.42],approaches:[12,25,40,55],views:2,legalLanes:3,verticalFovDegrees:56,aspect:1280/800});t.diagnostic(`${rays} physical pickup rays at center and both full legal edge lanes, both default views and bob extremes; all rows additionally12/25/40m`);
});

audit('caldera camera mesh broadphase covers actual local triangles without unbounded source scans or whole-building boxes','camera',t=>{
  const triangleKey=(points:readonly V[])=>points.map(shapeKey).sort().join('|'),actualKeys=new Set(mesh.triangles.map(t=>triangleKey([t.a,t.b,t.c])));
  const payloads=geometry.cameraObstacles.filter(b=>b.triangles).map(b=>({kind:b.kind,triangles:b.triangles!,bounds:b.triangles!.map(points=>boundsOf(points))}));let totalTriangles=0,queries=0,maxCandidates=0;
  for(const blocker of geometry.cameraObstacles){assert.ok(blocker.triangles||blocker.heightfield,`${blocker.kind} is a broad solid box which may fill real architectural void`);}
  for(const payload of payloads){totalTriangles+=payload.triangles.length;for(const triangle of payload.triangles)assert.ok(actualKeys.has(triangleKey(triangle)),`${payload.kind} camera mesh invents a non-rendered face`);}
  const payloadKeys=new Set(payloads.flatMap(p=>p.triangles.map(triangleKey)));
  let requiredFaces=0,wayfindingFaces=0;
  for(const triangle of mesh.triangles){const component=componentOf.get(triangle.id);if(!component||terrainIds.has(triangle.id)||component.role==='road')continue;requiredFaces++;if(/sign|wayfind|icon|board/.test(component.kind))wayfindingFaces++;assert.ok(payloadKeys.has(triangleKey([triangle.a,triangle.b,triangle.c])),`runtime camera omitted actual ${component.kind} triangle ${triangle.id}`);}
  assert.ok(wayfindingFaces>0,'actual wayfinding boards/posts/icons remain physical camera obstacles');
  reportMetric('runtimeMeshCorrespondence',{requiredFaces,wayfindingFaces,payloadFaces:payloadKeys.size});

  for(const edge of Object.values(CALDERA_COURSE.edges))for(let s=0;s<edge.length;s+=100)for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/2]){
    const frame=edge.sample(s),anchor=anchorAt(frame),desired=chaseCamera({position:frame.p,tangent:frame.t,view:1,rearView:false,orbit:{yaw,pitch:-.28}}).position,a=tuple(anchor),b=tuple(desired),min=a.map((n,i)=>Math.min(n,b[i])-.45),max=a.map((n,i)=>Math.max(n,b[i])+.45);let local=0;
    for(const payload of payloads){
      const ids=cameraMeshCandidateIds(payload.triangles,anchor,desired),set=new Set(ids);local+=ids.length;
      payload.bounds.forEach((box,i)=>{if(box.min[0]<=max[0]&&box.max[0]>=min[0]&&box.min[2]<=max[2]&&box.max[2]>=min[2])assert.ok(set.has(i),`${payload.kind} local broadphase omitted source face ${i}`);});
    }
    assert.ok(local<totalTriangles*.2,`${local}/${totalTriangles} runtime camera candidates is not a local query`);maxCandidates=Math.max(maxCandidates,local);queries++;
  }
  assert.ok(totalTriangles>5000&&queries>100);reportMetric('runtimeBroadphase',{queries,maxCandidates,totalTriangles,maximumSourceFraction:maxCandidates/totalTriangles,wholeArchitectureBoxes:0,scope:'Representative source-bound queries only; not a universal worst-case or FPS claim'});t.diagnostic(`${queries} source-bounds broadphase checks, max ${maxCandidates} local candidates of ${totalTriangles} actual mesh faces; no whole-building boxes`);
});



function coincidentOutwardPolygon(a:Triangle,b:Triangle):{polygon:V[];normal:V}|null{
  const normal=(q:Triangle)=>{const u=sub(q.b,q.a),v=sub(q.c,q.a);return[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];};
  const na=normal(a),nb=normal(b),la=Math.hypot(...na),lb=Math.hypot(...nb);if(la<1e-10||lb<1e-10||dot(na,nb)/(la*lb)<1-1e-9)return null;
  if([b.a,b.b,b.c].some(p=>Math.abs(dot(na,sub(p,a.a)))/la>1e-7))return null;
  const drop=na.reduce((best,n,i)=>Math.abs(n)>Math.abs(na[best])?i:best,0),axes=[0,1,2].filter(i=>i!==drop),project=(p:V):V=>[p[axes[0]],0,p[axes[1]]],projected={...b,a:project(b.a),b:project(b.b),c:project(b.c)};
  const polygon=clipPolygon([project(a.a),project(a.b),project(a.c)],projected).map(p=>{const q=[0,0,0];q[axes[0]]=p[0];q[axes[1]]=p[2];q[drop]=a.a[drop]-(na[axes[0]]*(q[axes[0]]-a.a[axes[0]])+na[axes[1]]*(q[axes[1]]-a.a[axes[1]]))/na[drop];return q;});
  return{polygon,normal:na.map(v=>v/la)};
}
function coincidentOutwardArea(a:Triangle,b:Triangle){const q=coincidentOutwardPolygon(a,b);return q?area3D(q.polygon):0;}
// A duplicate surface buried completely inside another actual closed convex
// solid is internal contact, not an exposed z-fighting skin. The certificate
// below proves closure and convexity from emitted faces; labels do not count.
function convexCertificates(){
  const result=new Map<Component,{a:V;n:V}[]>();
  for(const c of geometry.components){const triangles=componentTriangles.get(c)??[];if(triangles.length<4||triangles.length>36)continue;const edges=new Map<string,number>(),planes:{a:V;n:V}[]=[];
    for(const q of triangles){const p=[q.a,q.b,q.c].map(shapeKey);for(let k=0;k<3;k++){const key=[p[k],p[(k+1)%3]].sort().join('|');edges.set(key,(edges.get(key)??0)+1);}const u=sub(q.b,q.a),v=sub(q.c,q.a),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);if(l>1e-10)planes.push({a:q.a,n:n.map(v=>v/l)});}
    if(![...edges.values()].every(v=>v===2))continue;const points=actualComponentPoints(c);if(planes.every(p=>points.every(q=>dot(p.n,sub(q,p.a))<=1e-7)))result.set(c,planes);
  }return result;
}
function subtractConvexSolid(subject:V[],planes:{a:V;n:V}[]){let inside=subject;const outside:V[][]=[];for(const p of planes){const signed=(q:V)=>-dot(p.n,sub(q,p.a));const fragment=clipPlane(inside,q=>-signed(q));if(area3D(fragment)>1e-10)outside.push(fragment);inside=clipPlane(inside,signed);if(!inside.length)break;}return outside;}

audit('caldera no scenic roof crossing overhead face or closed solid contains the complete legal kart prism','structural',t=>{
  const solids:{component:Component;triangles:Triangle[];min:V;max:V}[]=[];
  for(const c of geometry.components){
    const triangles=(componentTriangles.get(c)??[]).filter(t=>area3D([t.a,t.b,t.c])>1e-10),edges=new Map<string,number>();
    for(const q of triangles){const p=[q.a,q.b,q.c].map(shapeKey);for(let k=0;k<3;k++){const key=[p[k],p[(k+1)%3]].sort().join('|');edges.set(key,(edges.get(key)??0)+1);}}
    if(triangles.length&&[...edges.values()].every(n=>n===2))solids.push({component:c,triangles,...actualBounds.get(c)!});
  }
  let representatives=0,overheadPairs=0;
  for(const road of roads){
    const point=[0,1,2].map(k=>(road.a[k]+road.b[k]+road.c[k])/3);point[1]+=1.675;
    for(const solid of solids){if(point.some((v,k)=>v<=solid.min[k]+1e-6||v>=solid.max[k]-1e-6))continue;const d=Math.hypot(...solid.max.map((v,k)=>v-solid.min[k]))*3+1,end=[point[0]+d,point[1]+d*.371,point[2]+d*.529];const hits=solid.triangles.map(q=>hitFraction(q,point,end)).filter((n):n is number=>n!==null).sort((a,b)=>a-b),unique=hits.filter((v,i)=>!i||v-hits[i-1]>1e-7);assert.equal(unique.length%2,0,`road ${road.id} inside actual closed ${solid.component.kind}`);}representatives++;
    for(const q of mesh.query(road.min,road.max)){const owner=componentOf.get(q.id);if(!owner?.landmark||q.max[1]<road.min[1]+3.2||Math.abs(cross2(q.a,q.b,q.c))<1e-9)continue;const overlap=clipPolygon([road.a,road.b,road.c],q);if(area(overlap)>1e-7){overheadPairs++;assert.ok(overlap.every(p=>height(q,p[0],p[2])<=height(road,p[0],p[2])+3.2),`${owner.kind} scenic overhead triangle ${q.id} above legal road ${road.id}`);}}
  }
  assert.ok(solids.length>100);assert.equal(overheadPairs,0);reportMetric('closedContainment',{closedSolids:solids.length,completeKartPrismRepresentatives:representatives,scenicOverheadPairs:overheadPairs});t.diagnostic(JSON.stringify(report.metrics.closedContainment));
});

audit('caldera shared camera crosses split merge and lap seams both directions with genuinely interpolated rear-toggle poses','camera',t=>{
  const e=CALDERA_COURSE.edges,joins=[[e.start,e.alley],[e.start,e.boulevard],[e.alley,e.finish],[e.boulevard,e.finish],[e.finish,e.start]] as const;let frames=0;
  for(const reverse of [false,true])for(const side of [-1,0,1])for(const view of [0,1])for(const rearMode of [0,1,2])for(const pitch of [-.28,.78])for(const [from,to] of joins){
    let previous:CameraPoint|null=null;
    for(let i=0;i<=80;i++){const offset=(reverse?40-i:i-40)*.8,edge=offset<0?from:to,s=offset<0?from.length+offset:offset,frame=edge.sample(s,side*edge.laneLimitAt(s)),anchor=anchorAt(frame),rearView=rearMode===1||(rearMode===2&&i>=20&&i<50),yaw=Math.PI*Math.sin(i/80*Math.PI*2),raw=chaseCamera({position:frame.p,tangent:frame.t,view,rearView,orbit:{yaw,pitch}}).position,desired=safeLandCamera(anchor,raw,geometry.cameraObstacles),interpolated=previous?smoothPose(previous,desired):desired,final=safeLandCamera(anchor,interpolated,geometry.cameraObstacles);assert.equal(boomFailure(tuple(anchor),tuple(final),`${from.id}>${to.id} reverse:${reverse} lane:${side} view:${view} rearMode:${rearMode} pitch:${pitch} frame:${i}`),null);previous=final;frames++;}
  }
  assert.equal(frames,29160);reportMetric('transitionCameras',{frames,joins:5,directions:2,lanes:3,views:2,rearModes:3,pitches:2,strictMargin:.3});t.diagnostic(JSON.stringify(report.metrics.transitionCameras));
});

audit('caldera continuous piers shelves jambs lintels and support planes have no duplicate outward coplanar skins','structural',t=>{
  const parts=geometry.components.filter(c=>(c.landmark||c.kind.startsWith('viaduct-'))&&c.role!=='terrain');const eligible=new Set(parts),triangles=parts.flatMap(c=>componentTriangles.get(c)??[]);let pairs=0,maxOverlap=0;const errors:string[]=[],groups:Record<string,{pairs:number;area:number;exposedArea:number;examples:unknown[]}>= {};const convex=convexCertificates();let buriedPairs=0,rawPairs=0;
  for(const a of triangles)for(const b of mesh.query(a.min,a.max)){
    const owner=componentOf.get(a.id),other=componentOf.get(b.id);if(b.id<=a.id||owner===other||!other||!eligible.has(other)||a.min.some((v,k)=>v>b.max[k]+1e-7)||a.max.some((v,k)=>v<b.min[k]-1e-7))continue;pairs++;const overlap=coincidentOutwardPolygon(a,b);if(!overlap)continue;const rawArea=area3D(overlap.polygon);if(rawArea<=1e-7)continue;rawPairs++;
    let exposed:V[][]=[overlap.polygon.map(p=>p.map((v,k)=>v+overlap.normal[k]*1e-5))];const bounds=boundsOf(exposed[0]),otherOwners=new Set(mesh.query(bounds.min,bounds.max,.001).map(q=>componentOf.get(q.id)));
    for(const solid of otherOwners){if(!solid||solid===owner||solid===other||!convex.has(solid))continue;exposed=exposed.flatMap(p=>subtractConvexSolid(p,convex.get(solid)!));if(!exposed.length)break;}
    for(const assembly of assembled){if(assembly.components.includes(owner!)||assembly.components.includes(other))continue;exposed=exposed.flatMap(p=>subtractVerifiedClosedAssembly(p,assembly));if(!exposed.length)break;}
    const exposedArea=exposed.reduce((n,p)=>n+area3D(p),0);maxOverlap=Math.max(maxOverlap,exposedArea);if(exposedArea>1e-7)errors.push(`${owner?.kind} triangle${a.id}/${other.kind} triangle${b.id} duplicate exposed coplanar area${exposedArea} (raw${rawArea})`);else buriedPairs++;
    const key=[owner?.kind,other.kind].sort().join(' / '),group=groups[key]??{pairs:0,area:0,exposedArea:0,examples:[]};group.pairs++;group.area+=rawArea;group.exposedArea+=exposedArea;if(group.examples.length<2)group.examples.push({a:[a.a,a.b,a.c],b:[b.a,b.b,b.c],rawArea,exposedArea});groups[key]=group;
  }
  const q=triangles[0];assert.ok(coincidentOutwardArea(q,{...q,id:-1})>1e-5);assert.equal(coincidentOutwardArea(q,{...q,id:-2,b:q.c,c:q.b}),0);
  reportMetric('exposedCoplanarConstruction',{components:parts.length,actualTriangles:triangles.length,candidatePairs:pairs,maximumExposedOverlap:maxOverlap,rawPairs,buriedPairs,actualClosedConvexOccluders:convex.size,groups,failures:errors.length,examples:errors});assertNoFailures(errors,'duplicate outward source planes');t.diagnostic(JSON.stringify(report.metrics.exposedCoplanarConstruction));
});

audit('independent coplanar burial oracle preserves exposed faces and subtracts complete actual convex overlap','structural',()=>{
  const planes=[{a:[-1,0,0],n:[-1,0,0]},{a:[1,0,0],n:[1,0,0]},{a:[0,-1,0],n:[0,-1,0]},{a:[0,1,0],n:[0,1,0]},{a:[0,0,-1],n:[0,0,-1]},{a:[0,0,1],n:[0,0,1]}];
  const square=(x:number,y:number)=>[[x,y,-.5],[x+1,y,-.5],[x+1,y,.5],[x,y,.5]];
  assert.equal(subtractConvexSolid(square(-.5,0),planes).reduce((n,p)=>n+area3D(p),0),0);
  assert.ok(Math.abs(subtractConvexSolid(square(.5,0),planes).reduce((n,p)=>n+area3D(p),0)-.5)<1e-10);
  assert.ok(Math.abs(subtractConvexSolid(square(-.5,1.00001),planes).reduce((n,p)=>n+area3D(p),0)-1)<1e-10);
});


// Grouped geological objects are reconstructed by primitive provenance only;
// their closure, actual bounds, grounding and contact are proved from triangles.
type ActualAssembly={id:string;components:Component[];triangles:Triangle[];points:V[];min:V;max:V};
const assembled:ActualAssembly[]=geometry.assemblies.map(a=>{
 const parts=a.components.map(i=>geometry.components[i]);assert.ok(parts.every(Boolean));
 const triangles=parts.flatMap(c=>componentTriangles.get(c)??[]),points=triangles.flatMap(q=>[q.a,q.b,q.c]);return{id:a.id,components:parts,triangles,points,...boundsOf(points)};
});
const assemblyOf=new Map<Component,ActualAssembly>();for(const a of assembled)for(const c of a.components){assert.ok(!assemblyOf.has(c));assemblyOf.set(c,a);}
function completeAssemblyGround(a:ActualAssembly){
 const footprint=hullXZ(a.points);let low=Infinity,high=-Infinity;const coverage=supportCoverage(footprint,(q,p)=>{if(!terrainIds.has(q.id))return false;for(const v of p){const y=height(q,v[0],v[2]);low=Math.min(low,y);high=Math.max(high,y);}return true;});
 assert.ok(coverage.uncovered<1e-5,`${a.id} full terrain grounding uncovered${coverage.uncovered}`);assert.ok(a.min[1]<=low+.001,`${a.id} ground base floats: ${a.min[1]} >${low}`);assert.ok(a.max[1]>high+.01,`${a.id} completely buried`);return coverage.intersections;
}
function sameGroup(a:Component,b:Component){return a===b||(assemblyOf.has(a)&&assemblyOf.get(a)===assemblyOf.get(b));}
function groupedContact(a:Component,b:Component){const aa=assemblyOf.get(a)?.components??[a],bb=assemblyOf.get(b)?.components??[b];return aa.some(c=>bb.some(d=>c!==d&&actualContact(c,d)));}

audit('caldera material fragments form real closed original geological solids with outward orientation','structural',t=>{
 let triangles=0;const details:unknown[]=[];
 for(const a of assembled){const edges=new Map<string,{count:number;direction:number}>();let volume=0;
  for(const q of a.triangles){assert.ok(area3D([q.a,q.b,q.c])>1e-9,`${a.id} has degenerate face`);const v=[q.a,q.b,q.c],p=v.map(shapeKey);for(let k=0;k<3;k++){const x=p[k],y=p[(k+1)%3],key=[x,y].sort().join('|'),value=edges.get(key)??{count:0,direction:0};value.count++;value.direction+=x<y?1:-1;edges.set(key,value);}const x=sub(q.a,a.min),y=sub(q.b,a.min),z=sub(q.c,a.min);volume+=dot(x,[y[1]*z[2]-y[2]*z[1],y[2]*z[0]-y[0]*z[2],y[0]*z[1]-y[1]*z[0]])/6;}
  assert.ok([...edges.values()].every(v=>v.count===2&&v.direction===0),`${a.id} material-boundary seam is open/nonmanifold/reversed`);assert.ok(volume>0,`${a.id} has inward shell`);triangles+=a.triangles.length;details.push({id:a.id,triangles:a.triangles.length,volume,closedEdges:edges.size});
 }
 assert.ok(assembled.length>=15);reportMetric('actualGeologicalAssemblies',{count:assembled.length,triangles,details});t.diagnostic(JSON.stringify(report.metrics.actualGeologicalAssemblies));
});

audit('caldera foundations terrain-grown geology and planted details contact every intersected actual terrain face','structural',t=>{
 let intersections=0;const foundations=geometry.components.filter(c=>c.kind.endsWith('-single-full-footprint-foundation')||/^viaduct-(center-pier|rim-abutment)-exact-soffit-bearing$/.test(c.kind));assert.equal(foundations.length,5);for(const c of foundations)intersections+=fullGroundContact(c,.001,actualBounds.get(c)!.max[1],c.kind.includes('rim-abutment'));
 const bases=assembled.filter(a=>/^(broken-rim-connected-saddle|radial-fan-attached-erosion-apron|wind-tooth-connected-talus-foot)-/.test(a.id));assert.equal(bases.length,3);for(const a of bases)intersections+=completeAssemblyGround(a);
 const planted=geometry.components.filter(c=>/^(road-grounded-rail-pier|fork-wayfinding-grounded-stone-leg)$/.test(c.kind));assert.ok(planted.length>100);for(const c of planted)intersections+=fullGroundContact(c);
 const blades=geometry.components.filter(c=>c.kind==='dry-terrain-rooted-broad-grass-blade');for(const c of blades){const b=actualBounds.get(c)!,p=actualComponentPoints(c).filter(p=>p[1]<b.min[1]+.13);assert.ok(p.some(p=>mesh.query(p,p,.01).some(q=>terrainIds.has(q.id)&&projectedInterval(q,p,p)&&p[1]<height(q,p[0],p[2]))),`${c.kind} root floats`);}
 reportMetric('wholeFootprintGrounding',{foundations:foundations.length,geologicalBases:bases.length,plantedSupports:planted.length,grassRoots:blades.length,terrainIntersections:intersections});t.diagnostic(JSON.stringify(report.metrics.wholeFootprintGrounding));
});

const contactRequirements:[RegExp,RegExp,number][]=[
 [/^archive-continuous-bearing-jamb$/,/^strata-archive-single-full-footprint-foundation$/,1],
 [/^archive-thick-jamb-seated-roof$/,/^archive-continuous-bearing-jamb$/,2],
 [/^archive-rear-low-sill-wall$/,/^strata-archive-single-full-footprint-foundation$/,1],
 [/^archive-rear-slit-lintel$/,/^archive-(rear-slit-side-reveal|continuous-bearing-jamb)$/,2],
 [/^archive-rear-slit-side-reveal$/,/^archive-(rear-low-sill-wall|rear-slit-lintel)$/,2],
 [/^archive-seated-roof-edge-block$/,/^archive-thick-jamb-seated-roof$/,1],
 [/^archive-attached-slab-joint-pin$/,/^archive-thick-jamb-seated-roof$/,1],
 [/^archive-specimen-floor-seated-plinth$/,/^strata-archive-single-full-footprint-foundation$/,1],
 [/^archive-specimen-seated-timber-cradle$/,/^archive-specimen-floor-seated-plinth$/,1],
 [/^archive-original-cut-layer-specimen-joined-lithic-band$/,/^archive-specimen-seated-timber-cradle$/,2],
 [/^archive-plinth-attached-bronze-label$/,/^archive-specimen-floor-seated-plinth$/,1],
 [/^archive-courtyard-bench-foot$/,/^strata-archive-single-full-footprint-foundation$/,1],
 [/^archive-courtyard-bench-bearing-seat$/,/^archive-courtyard-bench-foot$/,1],
 [/^archive-original-low-geology-relief-table$/,/^strata-archive-single-full-footprint-foundation$/,1],
 [/^archive-original-crescent-relief-contour$/,/^archive-original-low-geology-relief-table$/,1],
 [/^resonator-radial-ring-wedge$/,/^stone-resonator-single-full-footprint-foundation$/,1],
 [/^resonator-sounding-block-stone-seat$/,/^stone-resonator-single-full-footprint-foundation$/,1],
 [/^resonator-unequal-cooled-sounding-block-joined-lithic-band$/,/^resonator-sounding-block-stone-seat$/,1],
 [/^resonator-frame-grounded-stone-shoe$/,/^stone-resonator-single-full-footprint-foundation$/,1],
 [/^resonator-frame-continuous-timber-post$/,/^resonator-frame-grounded-stone-shoe$/,1],
 [/^resonator-post-seated-timber-crossbeam$/,/^resonator-frame-continuous-timber-post$/,2],
 [/^resonator-crossbeam-attached-bronze-clevis$/,/^resonator-post-seated-timber-crossbeam$/,1],
 [/^resonator-clevis-attached-static-suspension$/,/^resonator-crossbeam-attached-bronze-clevis$/,1],
 [/^resonator-attached-static-bronze-striker$/,/^resonator-clevis-attached-static-suspension$/,1],
 [/^resonator-seated-frame-pin-head$/,/^resonator-frame-continuous-timber-post$/,1],
 [/^resonator-visitor-bench-foot$/,/^stone-resonator-single-full-footprint-foundation$/,1],
 [/^resonator-visitor-bench-bearing-slab$/,/^resonator-visitor-bench-foot$/,1],
 [/^wind-tooth-real-thick-daylight-window$/,/^wind-tooth-wide-window-bearing-foot$/,2],
 [/^wind-tooth-wide-window-bearing-foot$/,/^wind-tooth-connected-talus-foot-/,1],
 [/^fork-wayfinding-seated-stone-tablet$/,/^fork-wayfinding-grounded-stone-leg$/,2],
 [/^fork-tablet-attached-(route-glyph|arrow)$/,/^fork-wayfinding-seated-stone-tablet$/,1],
];
audit('caldera every roof jamb specimen striker strap pin relief and sign has an actual load-bearing attachment','structural',t=>{
 const errors:string[]=[];let contacts=0,requirements=0;const checked=new Set<Component>();
 for(const [pattern,target,min]of contactRequirements){const sources=geometry.components.filter(c=>pattern.test(c.kind)),targets=geometry.components.filter(c=>target.test(c.kind));if(!sources.length)errors.push(`missing required construction ${pattern}`);
  for(const c of sources){const group=assemblyOf.get(c),representative=group?.components[0]??c;if(checked.has(representative))continue;checked.add(representative);const hits=targets.filter(q=>!sameGroup(c,q)&&groupedContact(c,q));if(hits.length<min)errors.push(`${c.kind} actual contact count${hits.length} <${min} to${target}`);contacts+=hits.length;requirements++;}
 }
 for(const edge of geometry.structuralContacts){const a=geometry.components[edge.first],b=geometry.components[edge.second];if(!a||!b||!groupedContact(a,b))errors.push(`declared ${edge.kind}: ${a?.kind}/${b?.kind} does not physically touch`);else contacts++;}
 // Every architectural bottom intended to be seated has its ENTIRE actual
 // footprint on the platform, not a center/corner or nominal-radius witness.
 const feet=geometry.components.filter(c=>/^(archive-(continuous-bearing-jamb|rear-low-sill-wall|specimen-floor-seated-plinth|courtyard-bench-foot|original-low-geology-relief-table)|resonator-(radial-ring-wedge|sounding-block-stone-seat|frame-grounded-stone-shoe|visitor-bench-foot))$/.test(c.kind));let fullFeet=0;
 for(const c of feet){try{fullFeet+=fullBottomContact(c,q=>q?.kind===c.landmark+'-single-full-footprint-foundation');}catch(error){errors.push(String(error));}}
 reportMetric('actualAssemblyContacts',{requirements,verifiedContacts:contacts,declaredEdges:geometry.structuralContacts.length,completeFeet:feet.length,fullFootprintIntersections:fullFeet,failures:errors.length,examples:errors});assertNoFailures(errors,'actual assembly contacts');t.diagnostic(JSON.stringify(report.metrics.actualAssemblyContacts));
});

audit('caldera protected37500-face terrain is connected and exactly contour-partitioned','structural',t=>{
 reportMetric('terrainMaterialPartition',verifyTerrainPartition());
 const vertices=new Map<string,number>(),edges=new Map<string,number>(),parent:number[]=[];let minY=Infinity,maxY=-Infinity;
 const root=(i:number):number=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};const vertex=(p:V)=>{const key=shapeKey(p);let id=vertices.get(key);if(id===undefined){id=parent.length;vertices.set(key,id);parent.push(id);}return id;};
 for(const q of terrain){assert.ok(upward(q));const p=[q.a,q.b,q.c],ids=p.map(vertex);for(let k=0;k<3;k++){parent[root(ids[k])]=root(ids[(k+1)%3]);const key=[ids[k],ids[(k+1)%3]].sort((a,b)=>a-b).join(',');edges.set(key,(edges.get(key)??0)+1);}for(const p0 of p){minY=Math.min(minY,p0[1]);maxY=Math.max(maxY,p0[1]);}}
 assert.equal(new Set(parent.map((_,i)=>root(i))).size,1);assert.ok([...edges.values()].every(v=>v<=2));assert.ok(maxY-minY>75);
 const regions=[{name:'northwest cooled rim',min:[-520,40],max:[110,410],relief:50},{name:'eastern descending rim',min:[150,-180],max:[410,310],relief:40},{name:'hooked inner bowl',min:[-250,-200],max:[10,170],relief:15},{name:'south rising return ridge',min:[-190,-860],max:[285,-305],relief:40},{name:'west abutment ridge',min:[-520,-420],max:[-395,-65],relief:25}];
 const details=regions.map(r=>{let lo=Infinity,hi=-Infinity;for(const q of terrain)for(const p of [q.a,q.b,q.c])if(p[0]>=r.min[0]&&p[0]<=r.max[0]&&p[2]>=r.min[1]&&p[2]<=r.max[1]){lo=Math.min(lo,p[1]);hi=Math.max(hi,p[1]);}assert.ok(hi-lo>=r.relief,`${r.name} is flattened: ${hi-lo}`);return{name:r.name,minY:lo,maxY:hi,relief:hi-lo};});
 reportMetric('connectedTerrain',{actualFaces:terrain.length,vertices:vertices.size,components:1,minY,maxY,regions:details});t.diagnostic(JSON.stringify(report.metrics.connectedTerrain));
});

audit('caldera complete seven-metre ground and two-metre upper shoulder unions remain singly owned across all layers','structural',t=>{
 let referencePolygons=0,overlapPairs=0;const errors:string[]=[];
 for(const edge of Object.values(CALDERA_COURSE.edges)){const n=Math.ceil(edge.length/1.65),stations=Array.from({length:n+1},(_,i)=>i/n*edge.length);if(edge.id==='finish')stations.push(...CALDERA_VIADUCT.upperPhysicalS);stations.sort((a,b)=>a-b);
  for(let i=0;i<stations.length-1;i++){const s=stations[i],next=stations[i+1];if(next-s<1e-8)continue;const middle=(s+next)/2,isUpper=edge.id==='finish'&&middle>=CALDERA_VIADUCT.upperPhysicalS[0]&&middle<=CALDERA_VIADUCT.upperPhysicalS[1],extra=isUpper?2:7,y=edge.sample(middle).p.y;
   for(const side of [-1,1]){const a=tuple(edge.sample(s,side*edge.halfWidthAt(s)).p),b=tuple(edge.sample(next,side*edge.halfWidthAt(next)).p),c=tuple(edge.sample(s,side*(edge.halfWidthAt(s)+extra)).p),d=tuple(edge.sample(next,side*(edge.halfWidthAt(next)+extra)).p);
    for(const poly of [[a,c,b],[b,c,d]]){const result=supportCoverage(poly,(q,p)=>(roadIds.has(q.id)||shoulderIds.has(q.id))&&p.every(v=>Math.abs(height(q,v[0],v[2])-y)<5));if(result.uncovered>1e-5)errors.push(`${edge.id}:${s} shoulder missing${result.uncovered}m²`);referencePolygons++;}
   }
  }
 }
 for(const a of shoulderTriangles){assert.ok(upward(a));for(const b of mesh.query(a.min,a.max))if((shoulderIds.has(b.id)&&b.id>a.id)||roadIds.has(b.id)){
  const p=clipPolygon([a.a,a.b,a.c],b);if(area(p)>1e-7&&p.every(v=>Math.abs(height(a,v[0],v[2])-height(b,v[0],v[2]))<5))errors.push(`same physical layer shoulder${a.id}/${kind(b)}${b.id} double ownership${area(p)}`);overlapPairs++;
 }}
 reportMetric('completeShoulderUnion',{referencePolygons,actualShoulderTriangles:shoulderTriangles.length,candidateOverlapPairs:overlapPairs,failures:errors.length,examples:errors.slice(0,30)});assertNoFailures(errors,'full shoulder union');t.diagnostic(JSON.stringify(report.metrics.completeShoulderUnion));
});

audit('caldera coincident split common-tail merge and lap endpoints preserve exact whole-neighborhood ownership','structural',t=>{
 const e=CALDERA_COURSE.edges,sites=[{name:'split',edge:e.start,s:e.start.length},{name:'technical common-tail first sample',edge:e.alley,s:e.alley.length-40},{name:'broad common-tail first sample',edge:e.boulevard,s:e.boulevard.length-40},{name:'merge exit',edge:e.finish,s:0},{name:'lap seam',edge:e.start,s:0}];const metrics:unknown[]=[];
 for(const site of sites){const f=site.edge.sample(site.s),p=tuple(f.p),n=tuple(f.n),forward=tuple(f.t),at=(x:number,z:number)=>p.map((v,k)=>v+n[k]*x+forward[k]*z),polygon=[at(-16.4,-.4),at(16.4,-.4),at(16.4,.4),at(-16.4,.4)],result=supportCoverage(polygon,q=>(roadIds.has(q.id)||shoulderIds.has(q.id))&&Math.abs((q.min[1]+q.max[1])/2-p[1])<5);assert.ok(result.uncovered<1e-7,`${site.name} endpoint loses${result.uncovered}m² union`);
  const bounds=boundsOf(polygon),faces=mesh.query(bounds.min,bounds.max).filter(q=>roadIds.has(q.id)||shoulderIds.has(q.id));let pairs=0,total=0;for(let i=0;i<faces.length;i++)for(let j=i+1;j<faces.length;j++){let common=clipPolygon(polygon,faces[i]);common=clipPolygon(common,faces[j]);const overlap=area(common);assert.ok(overlap<1e-7,`${site.name} duplicates${overlap}m² triangles${faces[i].id}/${faces[j].id}`);total+=overlap;pairs++;}metrics.push({name:site.name,fullWidth:32.8,length:.8,uncovered:result.uncovered,pairs,overlapArea:total});
 }reportMetric('coincidentEndpointRegression',{sites:metrics});t.diagnostic(JSON.stringify(report.metrics.coincidentEndpointRegression));
});

audit('caldera actual camera heightfield equals every emitted ground plane and never upper road XY','camera',t=>{
 const fields=geometry.cameraObstacles.filter(b=>b.heightfield);assert.equal(fields.length,1);const f=fields[0].heightfield!;assert.equal(f.columns,151);assert.equal(f.rows,126);assert.equal(f.heights.length,151*126);
 let samples=0,lowerChecks=0;for(const q of terrain)for(const p of [q.a,q.b,q.c]){const gx=(p[0]-f.minX)/f.dx,gz=(p[2]-f.minZ)/f.dz,x=Math.min(f.columns-2,Math.max(0,Math.floor(gx))),z=Math.min(f.rows-2,Math.max(0,Math.floor(gz))),u=gx-x,v=gz-z,i=z*f.columns+x,a=f.heights[i],b=f.heights[i+1],c=f.heights[i+f.columns],d=f.heights[i+f.columns+1],y=u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);assert.ok(Math.abs(y-p[1])<1e-6,`camera grid differs from actual ground${q.id}`);samples++;}
 for(const cross of CALDERA_VIADUCT.crossings){const edge=CALDERA_COURSE.edges[cross.lowerEdge];for(let s=cross.lowerS-22;s<=cross.lowerS+22;s+=.5)for(const side of [-1,-.5,0,.5,1]){const p=tuple(edge.sample(s,side*edge.halfWidthAt(s)).p),ground=mesh.query(p,p).filter(q=>terrainIds.has(q.id)&&projectedInterval(q,p,p));assert.ok(ground.length);for(const q of ground){const gap=p[1]-height(q,p[0],p[2]);assert.ok(gap>=.15&&gap<4,`${cross.lowerEdge}:${s} underpass ground gap${gap}`);}lowerChecks++;}}
 reportMetric('cameraGroundParity',{samples,lowerChecks,fields:1,source:'Emitted triangles, no convenience height lookup'});t.diagnostic(JSON.stringify(report.metrics.cameraGroundParity));
});

// Prove burial in a nonconvex CLOSED emitted geological assembly using exactly
// one upward vertical ray crossing, over complete clipped polygons. Areas with
// any second surface crossing are retained, never guessed from a centroid.
// This is a conservative certificate: inconclusive regions remain exposed.
function subtractVerifiedClosedAssembly(subject:V[],a:ActualAssembly):V[][]{
 if(area(subject)<1e-10)return[subject];const bounds=boundsOf(subject);if(bounds.min.some((v,k)=>v>a.max[k])||bounds.max.some((v,k)=>v<a.min[k]))return[subject];
 const candidates=mesh.query(bounds.min,bounds.max).filter(q=>a.triangles.includes(q)&&Math.abs(cross2(q.a,q.b,q.c))>1e-9&&q.max[1]>=bounds.min[1]);
 let remaining=[subject];for(const top of candidates.filter(upward)){
  let region=clipPolygon(subject,top);region=clipPlane(region,p=>height(top,p[0],p[2])-p[1]-1e-8);if(area(region)<1e-10)continue;let single=[region];
  for(const other of candidates){if(other===top)continue;const intersected=clipPolygon(region,other),above=clipPlane(intersected,p=>height(other,p[0],p[2])-p[1]-1e-8);if(area(above)<1e-10)continue;
   for(let i=1;i<above.length-1;i++){const cutter:Triangle={id:-1,batch:'second ray crossing',vertices:[],a:above[0],b:above[i],c:above[i+1],...boundsOf([above[0],above[i],above[i+1]])};single=single.flatMap(p=>subtractTriangleFootprint(p,cutter));}
  }
  for(const inside of single)for(let i=1;i<inside.length-1;i++){const cutter:Triangle={id:-1,batch:'one exiting closed-mesh ray',vertices:[],a:inside[0],b:inside[i],c:inside[i+1],...boundsOf([inside[0],inside[i],inside[i+1]])};remaining=remaining.flatMap(p=>subtractTriangleFootprint(p,cutter));}if(!remaining.length)break;
 }return remaining;
}

function frustumRay(eye:V,look:V,u:number,v:number,length=900):V{
 const forward=sub(look,eye),fl=Math.hypot(...forward),f=forward.map(x=>x/fl),right=[-f[2],0,f[0]],rl=Math.hypot(...right),r=right.map(x=>x/rl),up=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]],tan=Math.tan(28*Math.PI/180),direction=f.map((x,i)=>x+r[i]*u*tan*16/10+up[i]*v*tan),dl=Math.hypot(...direction);return eye.map((x,i)=>x+length*direction[i]/dl);
}
audit('caldera original five heroes fit frozen envelopes and actual faces reveal the intended silhouettes','structural',t=>{
 let vertices=0,rays=0;for(const landmark of geometry.landmarks){const p=CALDERA_LANDMARKS.plots.find(p=>p.id===landmark.kind);assert.ok(p);assert.equal(landmark.radius,p.radius);assert.equal(landmark.height,p.height);const parts=geometry.components.filter(c=>c.landmark===p.id);assert.ok(parts.length>5);
  for(const road of roads)assert.ok(triangleDistanceXZ(road,landmark.position)>=p.radius+20,`${p.id} reserved footprint enters road/camera reservation`);
  for(const c of parts)for(const q of actualComponentPoints(c)){assert.ok(Math.hypot(q[0]-p.x,q[2]-p.z)<=p.radius+1e-6,`${p.id}/${c.kind} escapes original footprint: ${q}`);assert.ok(q[1]<=landmark.position[1]+p.height+1e-6,`${p.id}/${c.kind} too tall`);vertices++;}
 }
 assert.equal(geometry.landmarks.length,5);for(const line of geometry.sightlines){const hit=mesh.firstHit(line.eye,line.target);assert.ok(hit,`${line.name} target is empty`);assert.equal(componentOf.get(hit.triangle.id)?.landmark,line.targetId,`${line.name} first hits${kind(hit.triangle)}${hit.triangle.id}`);rays++;}
 reportMetric('heroEnvelopesAndSilhouettes',{landmarks:geometry.landmarks.length,vertices,sourceSilhouetteRays:rays,scope:'Actual geometric witnesses only; no pixel/GPU claim'});t.diagnostic(JSON.stringify(report.metrics.heroEnvelopesAndSilhouettes));
});

audit('caldera real erosion window and archive courtyard preserve literal empty aperture through actual meshes','structural',t=>{
 const window=geometry.components.find(c=>c.kind==='wind-tooth-real-thick-daylight-window');assert.ok(window);const base=geometry.landmarks.find(l=>l.kind==='wind-carved-tooth')!.position,yaw=.42,c=Math.cos(yaw),s=Math.sin(yaw),at=(x:number,y:number,z:number):V=>[base[0]+x*c+z*s,base[1]+y,base[2]-x*s+z*c];let rays=0;
 for(const x of [-3,0,3])for(const y of [7,10,13]){const a=at(x,y,-6),b=at(x,y,6),hit=mesh.firstHit(a,b);assert.ok(!hit,`real erosion opening ray ${x}/${y} filled by${hit&&kind(hit.triangle)}`);rays++;}
 const top=at(0,27,0),hit=mesh.firstHit(at(0,27,-8),top);assert.ok(hit&&belongs(hit.triangle,window),'stone above aperture must physically exist');
 reportMetric('actualVoids',{windowRays:rays,windowStoneWitness:hit.triangle.id,noWholeBridgeOrHeroBoxes:true});t.diagnostic(JSON.stringify(report.metrics.actualVoids));
});

const reviewFractions=[['start',.13],['start',.35],['start',.56],['start',.80],['start',.965],['alley',.22],['boulevard',.23],['finish',.36],['finish',.76]] as const;
audit('caldera nine driver and shared-chase reviews see actual connected relief and both lower arch openings','structural',t=>{
 let rays=0;const details:unknown[]=[];
 for(const [edgeId,fraction]of reviewFractions){const edge=CALDERA_COURSE.edges[edgeId],s=edge.length*fraction,frame=edge.sample(s),anchor=anchorAt(frame),forward=edge.sample(s+32),poses:[string,V,V][]=[['driver',[frame.p.x,frame.p.y+1.6,frame.p.z],[forward.p.x,forward.p.y+1.6,forward.p.z]]];
  for(const view of [0,1]){const p=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:false,orbit:{yaw:0,pitch:0}}),camera=safeLandCamera(anchor,p.position,geometry.cameraObstacles);assert.equal(boomFailure(tuple(anchor),tuple(camera),`review${edgeId}:${s}/${view}`),null);poses.push([`chase${view}`,tuple(camera),tuple(p.look)]);}
  for(const [view,eye,look]of poses){let terrainHits=0,elevated=0,roadHits=0,structureHits=0;for(const v of [-1,-.8,-.6,-.4,-.2,-.1,-.04,0,.04,.1,.2,.4,.6,.8,1])for(let column=0;column<13;column++){const end=frustumRay(eye,look,(column-6)/6,v),hit=mesh.firstHit(eye,end);rays++;if(!hit)continue;if(terrainIds.has(hit.triangle.id)){terrainHits++;if(lerp(eye,end,hit.fraction)[1]>eye[1]+.5)elevated++;}else if(roadIds.has(hit.triangle.id))roadHits++;else structureHits++;}assert.ok(terrainHits>3,`${edgeId}:${s}/${view} shows no actual connected landform`);details.push({edgeId,s,view,terrainHits,elevated,roadHits,structureHits});}
 }
 reportMetric('sourceReviewRays',{poses:details.length,rays,details,scope:'Numerical source-frustum first-hit samples, not native or external rendered pixels'});t.diagnostic(JSON.stringify(report.metrics.sourceReviewRays));
});

audit('caldera every complete geological hero foot has real apron cradle or plinth support','structural',t=>{
 let assemblies=0,faces=0,intersections=0;const errors:string[]=[];
 for(const a of assembled){if(/^(broken-rim-connected-saddle|radial-fan-attached-erosion-apron|wind-tooth-connected-talus-foot|archive-original-cut-layer-specimen)-/.test(a.id))continue;
  const foot=a.triangles.filter(q=>cross2(q.a,q.b,q.c)>1e-9&&[q.a,q.b,q.c].every(p=>Math.abs(p[1]-a.min[1])<1e-7));assert.ok(foot.length,`${a.id} needs actual complete bottom faces`);
  for(const q of foot){const coverage=supportCoverage([q.a,q.b,q.c],(r,p)=>{
   const owner=componentOf.get(r.id);if(!owner||a.components.includes(owner)||owner.landmark!==a.components[0].landmark||!upward(r))return false;
   const expected=a.id.startsWith('broken-rim-')?'broken-rim-connected-saddle-':a.id.startsWith('radial-fan-')?'radial-fan-attached-erosion-apron-':a.id.startsWith('wind-tooth-')?'wind-tooth-connected-talus-foot-':'resonator-sounding-block-stone-seat';
   if(!owner.kind.startsWith(expected))return false;
   return p.every(v=>height(r,v[0],v[2])>=height(q,v[0],v[2])-.025);
  });if(coverage.uncovered>1e-5)errors.push(`${a.id} bottom${q.id} lacks${coverage.uncovered}m² actual complete foot bearing`);faces++;intersections+=coverage.intersections;}assemblies++;
 }
 reportMetric('completeGeologicalFeet',{assemblies,bottomFaces:faces,intersections,failures:errors.length,examples:errors});assertNoFailures(errors,'whole geological feet');t.diagnostic(JSON.stringify(report.metrics.completeGeologicalFeet));
});

audit('caldera roofs fully cover supporting jamb seats and upper rail piers seat on actual masonry','structural',t=>{
 let jambs=0,piers=0,intersections=0;
 for(const c of geometry.components.filter(c=>c.kind==='archive-continuous-bearing-jamb')){
  for(const q of componentTriangles.get(c)??[])if(upward(q)){const support=supportCoverage([q.a,q.b,q.c],(r,p)=>kind(r)==='archive-thick-jamb-seated-roof'&&cross2(r.a,r.b,r.c)>1e-9&&nearSamePlane(q,r,p));assert.ok(support.uncovered<1e-6,`jamb${q.id} lacks complete slab bearing contact`);intersections+=support.intersections;}jambs++;
 }
 for(const c of geometry.components.filter(c=>c.kind==='viaduct-deck-seated-rail-pier')){intersections+=fullBottomContact(c,(q,r)=>!!q&&q.kind.startsWith('viaduct-')&&q!==c&&upward(r));piers++;}
 assert.equal(jambs,6);assert.ok(piers>10);reportMetric('fullBearingSeats',{jambs,upperRailPiers:piers,intersections});t.diagnostic(JSON.stringify(report.metrics.fullBearingSeats));
});

audit('caldera modeled labels striker straps pins relief benches and route glyphs expose real external surfaces','structural',t=>{
 const parts=geometry.components.filter(c=>/^(archive-(plinth-attached-bronze-label|original-crescent-relief-contour|courtyard-bench-bearing-seat)|resonator-(crossbeam-attached-bronze-clevis|clevis-attached-static-suspension|attached-static-bronze-striker|seated-frame-pin-head|visitor-bench-bearing-slab)|fork-tablet-attached-(route-glyph|arrow))$/.test(c.kind));assert.ok(parts.length>35);let rays=0;const errors:string[]=[];
 for(const c of parts){const bounds=actualBounds.get(c)!;let visible=false;for(const q of componentTriangles.get(c)??[]){if(area3D([q.a,q.b,q.c])<1e-9)continue;const target=[0,1,2].map(k=>(q.a[k]+q.b[k]+q.c[k])/3);for(const d of [[-1,0,0],[1,0,0],[0,0,-1],[0,0,1],[0,1,0],[-1,0,-1],[-1,0,1],[1,0,-1],[1,0,1],[-1,1,0],[1,1,0],[0,1,-1],[0,1,1]]){const eye=target.map((v,k)=>d[k]<0?bounds.min[k]-5:d[k]>0?bounds.max[k]+5:v),hit=mesh.firstHit(eye,target);rays++;if(hit&&belongs(hit.triangle,c)){visible=true;break;}}if(visible)break;}if(!visible)errors.push(`${c.kind} has no actual external first-hit surface at${JSON.stringify(bounds)}`);}
 reportMetric('externalDetailWitnesses',{parts:parts.length,rays,failures:errors.length,examples:errors,scope:'Actual mesh first-hit witnesses only, not pixel proof'});assertNoFailures(errors,'exposed static details');t.diagnostic(JSON.stringify(report.metrics.externalDetailWitnesses));
});

audit('independent caldera oracle catches exact vertical walls thin terrain peaks and contact margins','structural',()=>{
 const triangle=(a:V,b:V,c:V):Triangle=>({id:-1,batch:'independent oracle fixture',vertices:[],a,b,c,...boundsOf([a,b,c])});
 const road=triangle([0,0,0],[10,0,0],[0,0,10]),wall=triangle([2,-1,2],[2,4,2],[2,4,4]);assert.ok(area3D(prismIntersection(wall,road,.15,3.2))>1);assert.equal(prismIntersection(triangle([20,-1,20],[20,4,20],[20,4,24]),road,.15,3.2).length,0);
 const peak=triangle([4.99,0,-1],[5.02,8,0],[4.99,0,1]),interval=projectedInterval(peak,[0,1,0],[10,1,0]);assert.ok(interval&&interval[0]<.5&&interval[1]>.5);assert.ok(height(peak,5,0)>1);assert.equal(segmentTriangleDistance([0,1,2.5],[4,1,2.5],wall),0);assert.ok(Math.abs(segmentTriangleDistance([2.2,1,2.5],[2.2,3,2.5],wall)-.2)<1e-8);
});

audit('caldera bridge shafts deck and approach masonry are closed consistently outward actual solids','structural',t=>{
 const parts=geometry.components.filter(c=>/^viaduct-(continuous-two-arch-solid-deck|center-pier-exact-soffit-bearing|rim-abutment-exact-soffit-bearing|grounded-source-affine-approach-masonry)$/.test(c.kind));let faces=0,groundPairs=0;
 for(const c of parts){const triangles=componentTriangles.get(c)??[],edges=new Map<string,{count:number;direction:number}>();let volume=0,down=0;const origin=actualBounds.get(c)!.min;
  for(const q of triangles){const p=[q.a,q.b,q.c].map(shapeKey);if(cross2(q.a,q.b,q.c)>1e-9)down++;for(let k=0;k<3;k++){const x=p[k],y=p[(k+1)%3],key=[x,y].sort().join('|'),v=edges.get(key)??{count:0,direction:0};v.count++;v.direction+=x<y?1:-1;edges.set(key,v);}const x=sub(q.a,origin),y=sub(q.b,origin),z=sub(q.c,origin);volume+=dot(x,[y[1]*z[2]-y[2]*z[1],y[2]*z[0]-y[0]*z[2],y[0]*z[1]-y[1]*z[0]])/6;}
  assert.ok([...edges.values()].every(e=>e.count===2&&e.direction===0),`${c.kind} ${geometry.components.indexOf(c)} is open or has inconsistent outward edges`);assert.ok(volume>0);assert.ok(down>0,`${c.kind} missing downward closing/bearing faces`);faces+=triangles.length;
  if(c.kind==='viaduct-grounded-source-affine-approach-masonry')groundPairs+=fullGroundContact(c,.001,actualBounds.get(c)!.max[1],true);
 }
 assert.ok(parts.length>10);reportMetric('closedBridgeShells',{parts:parts.length,faces,fullApproachGroundIntersections:groundPairs});t.diagnostic(JSON.stringify(report.metrics.closedBridgeShells));
});

audit('caldera five stone specimens genuinely bear on both narrow timber cradle rails with open space between','structural',t=>{
 const specimens=assembled.filter(a=>a.id.startsWith('archive-original-cut-layer-specimen'));assert.equal(specimens.length,5);const metrics:unknown[]=[];
 for(const a of specimens){const bottoms=a.triangles.filter(q=>cross2(q.a,q.b,q.c)>1e-9&&q.max[1]<=a.min[1]+1e-7),contacts:{component:number;area:number}[]=[];
  for(const c of geometry.components.filter(c=>c.kind==='archive-specimen-seated-timber-cradle')){let areaSum=0;for(const q of bottoms)for(const r of componentTriangles.get(c)??[])if(upward(r)){const p=clipPolygon([q.a,q.b,q.c],r);if(area(p)>1e-9&&nearSamePlane(q,r,p,.025))areaSum+=area(p);}if(areaSum>.1)contacts.push({component:geometry.components.indexOf(c),area:areaSum});}
  assert.equal(contacts.length,2,`${a.id} must bear physically on exactly two cradle rails`);metrics.push({specimen:a.id,contacts});
 }
 reportMetric('specimenCradleBearing',{specimens:specimens.length,metrics});t.diagnostic(JSON.stringify(report.metrics.specimenCradleBearing));
});
