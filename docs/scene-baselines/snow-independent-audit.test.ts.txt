// Independent emitted-geometry audit. These tests use rendered positions/indices,
// never planned volumes, camera height answers, scene-provided road faces or
// claimed component bounds as proof. Source provenance identifies parts only.
import test, {after,type TestContext} from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {SNOW_COURSE,SNOW_LANDMARKS} from '../src/maps/snow';
import {buildSnowSceneGeometry} from '../src/snow-scenery';
import {snowPickupRows} from '../src/land-course-pickups';
import {chaseCamera} from '../src/race-camera';
import {safeLandCamera,cameraMeshCandidateIds,type CameraPoint} from '../src/land-camera';

// The collision oracle below consumes ONLY rendered batch positions/indices.
// It deliberately does not import cameraTerrainHeight, road footprint clipping,
// camera boxes, scene terrainGrid, or roadFaces to prove geometry is unobstructed.
type V=readonly number[];
type Triangle={id:number;batch:string;vertices:readonly number[];a:V;b:V;c:V;min:V;max:V};
const auditStage=process.env.SNOW_AUDIT_STAGE??'all';
const auditDirectory=process.env.SNOW_AUDIT_DIR??resolve('../land-map-artifacts/snow-audit');
const sourceFiles=['src/maps/snow.ts','src/snow-scenery.ts','src/land-course-pickups.ts','src/race-camera.ts','src/land-camera.ts','src/land-road-mesh.ts','src/land-mesh-builder.ts','src/land-driving.ts','src/land-routes.ts','src/open-road.ts','tests/snow-independent-audit.test.ts'];
const sourceHashes=()=>Object.fromEntries(sourceFiles.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
const hashesBefore=sourceHashes(),started=Date.now();
const report:{stage:string;startedAt:string;sourceHashesBefore:Record<string,string>;sourceHashesAfter?:Record<string,string>;stable?:boolean;durationSeconds?:number;metrics:Record<string,unknown>;checks:{name:string;status:string;error?:string}[];limitations:string[]}={stage:auditStage,startedAt:new Date().toISOString(),sourceHashesBefore:hashesBefore,metrics:{},checks:[],limitations:['CPU emitted-source geometry audit only; no native game pixels, GPU, or FPS certification','Original blueprint volumes are locating and acceptance inputs only, never actual-mesh proof']};
function audit(name:string,phase:'structural'|'camera',fn:(t:TestContext)=>void){
  if(auditStage!=='all'&&auditStage!==phase)return;
  test(name,t=>{try{fn(t);report.checks.push({name,status:'passed'});}catch(error){report.checks.push({name,status:'failed',error:String(error)});throw error;}});
}
after(()=>{report.sourceHashesAfter=sourceHashes();report.stable=JSON.stringify(report.sourceHashesAfter)===JSON.stringify(hashesBefore);report.durationSeconds=(Date.now()-started)/1000;mkdirSync(auditDirectory,{recursive:true});writeFileSync(resolve(auditDirectory,`${auditStage}-report.json`),JSON.stringify(report,null,2)+'\n');assert.ok(report.stable,'audited sources changed during this run; result is stale');});
const geometry=buildSnowSceneGeometry(SNOW_COURSE);
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
  const list=componentsByBatch.get(triangle.batch)??[],vertex=Math.min(...triangle.vertices);let lo=0,hi=list.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(list[mid].vertexStart<=vertex)lo=mid+1;else hi=mid;}
  const c=list[lo-1];if(c&&triangle.vertices.every(v=>v>=c.vertexStart&&v<c.vertexEnd)){
    componentOf.set(triangle.id,c);const triangles=componentTriangles.get(c)??[];triangles.push(triangle);componentTriangles.set(c,triangles);
  }
}
// The pale material is shared by drivable yard faces and decorative coping.
// Primitive provenance labels the coping only; all geometric proof still uses
// the actual rendered triangles and independently reconstructed physical road.
terrain=mesh.triangles.filter(t=>['connected-snow-bowl-heightfield','connected-slate-exposures-heightfield'].includes(componentOf.get(t.id)?.kind??''));
for(const t of terrain)terrainIds.add(t.id);
assert.ok(terrain.length,'actual connected snow/slate field exists');
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
    if(!terrainIds.has(t.id))return false;
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
for(const edge of Object.values(SNOW_COURSE.edges)){
  const n=Math.ceil(edge.length/1.65);
  for(let i=0;i<n;i++){
    const s=i/n*edge.length,next=(i+1)/n*edge.length;
    const a=tuple(edge.sample(s,-edge.halfWidthAt(s)).p),b=tuple(edge.sample(s,edge.halfWidthAt(s)).p),c=tuple(edge.sample(next,-edge.halfWidthAt(next)).p),d=tuple(edge.sample(next,edge.halfWidthAt(next)).p);
    for(const [v0,v1,v2] of [[a,c,b],[b,c,d]])physical.push({id:physical.length,batch:'independent physical width',vertices:[],a:v0,b:v1,c:v2,...boundsOf([v0,v1,v2]),edgeId:edge.id,s,next});
  }
}
// Frozen from the previously certified runtime export, not regenerated from
// the material-refined scene. This digest fixes all 17,010 physical grid heights.
const ORIGINAL_SNOW_GRID_SHA256='21b5990a647cc49c9b527c56a7af222f24e9a350328dbf3ac5d3c73df25f9f5c';
const ORIGINAL_NON_MACRO_TRIANGLES_SHA256='f28d831186a27c39497a69ed70cc59521cd321ab60f70a12debff57cbe5b3be9';
function nonMacroTriangleHash(){const hash=createHash('sha256');for(const c of geometry.components){if(['connected-snow-bowl-heightfield','connected-slate-exposures-heightfield'].includes(c.kind))continue;hash.update(JSON.stringify({kind:c.kind,role:c.role,landmark:c.landmark??null,triangles:(componentTriangles.get(c)??[]).map(q=>[q.a,q.b,q.c])}));}return hash.digest('hex');}

let terrainPartitionResult:Record<string,unknown>|null=null;
function verifyTerrainPartition(){
  if(terrainPartitionResult)return terrainPartitionResult;
  const fields=geometry.cameraObstacles.filter(b=>b.heightfield);assert.equal(fields.length,1);const f=fields[0].heightfield!;
  const gridHash=createHash('sha256').update(JSON.stringify([f.minX,f.minZ,f.columns,f.rows,f.dx,f.dz,f.heights])).digest('hex');
  assert.equal(gridHash,ORIGINAL_SNOW_GRID_SHA256,'material refinement changed the frozen physical terrain heightfield');
  const nonMacroHash=nonMacroTriangleHash();assert.equal(nonMacroHash,ORIGINAL_NON_MACRO_TRIANGLES_SHA256,'material-only refinement changed non-macro actual road/shoulder/architecture/detail triangles');
  const vertex=(i:number):V=>[f.minX+(i%f.columns)*f.dx,f.heights[i],f.minZ+Math.floor(i/f.columns)*f.dz],normal=(q:Triangle)=>{const u=sub(q.b,q.a),v=sub(q.c,q.a),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);return n.map(v=>v/l);};
  const credited=new Map<number,number>();let baselineFaces=0,coveredIntersections=0,ownershipPairs=0,maxAffineError=0,maxNormalDistance=0,maxUncoveredArea=0,maxOverlapArea=0,totalBaselineArea=0;
  for(let z=0;z<f.rows-1;z++)for(let x=0;x<f.columns-1;x++){const i=z*f.columns+x;for(const ids of [[i,i+f.columns,i+1],[i+1,i+f.columns,i+f.columns+1]]){
    const [a,b,c]=ids.map(vertex),baseline:Triangle={id:-1-baselineFaces,batch:'independent frozen baseline grid',vertices:ids,a,b,c,...boundsOf([a,b,c])},baseNormal=normal(baseline),polygon=[a,b,c],candidates=mesh.query(baseline.min,baseline.max).filter(q=>terrainIds.has(q.id)),parts:{triangle:Triangle;polygon:V[]}[]=[];let remaining=[polygon];
    for(const q of candidates){const overlap=clipPolygon(polygon,q),size=area(overlap);if(size<1e-9)continue;assert.ok(cross2(q.a,q.b,q.c)<-1e-9,'terrain contour piece is degenerate or faces down');
      for(const p of overlap){const error=Math.abs(height(q,p[0],p[2])-height(baseline,p[0],p[2]));maxAffineError=Math.max(maxAffineError,error);assert.ok(error<1e-6,`material piece ${q.id} leaves frozen baseline face${baselineFaces} by ${error}m`);}
      const n=normal(q),normalError=Math.hypot(...n.map((v,k)=>v-baseNormal[k]));maxNormalDistance=Math.max(maxNormalDistance,normalError);assert.ok(normalError<1e-6,`material piece${q.id} changes physical plane normal ${normalError}`);
      remaining=remaining.flatMap(p=>subtractTriangleFootprint(p,q));parts.push({triangle:q,polygon:overlap});credited.set(q.id,(credited.get(q.id)??0)+size);coveredIntersections++;
    }
    const missing=remaining.reduce((n,p)=>n+area(p),0);maxUncoveredArea=Math.max(maxUncoveredArea,missing);assert.ok(missing<1e-6,`frozen baseline face${baselineFaces} loses ${missing}m² material coverage`);
    for(let k=0;k<parts.length;k++)for(let j=k+1;j<parts.length;j++){const overlap=area(clipPolygon(parts[k].polygon,parts[j].triangle));maxOverlapArea=Math.max(maxOverlapArea,overlap);assert.ok(overlap<1e-7,`frozen face${baselineFaces} has duplicate snow/slate area${overlap} from ${parts[k].triangle.id}/${parts[j].triangle.id}`);ownershipPairs++;}
    totalBaselineArea+=area(polygon);baselineFaces++;
  }}
  assert.equal(baselineFaces,33500,'protected physical terrain resolution is unchanged');assert.equal(credited.size,terrain.length,'every emitted terrain face belongs to frozen field, no separate false geometry');
  for(const q of terrain){const excess=Math.abs((credited.get(q.id)??0)-area([q.a,q.b,q.c]));assert.ok(excess<1e-5,`terrain piece${q.id} has ${excess}m² outside frozen physical grid`);}
  terrainPartitionResult={frozenGridSHA256:gridHash,unchangedNonMacroTrianglesSHA256:nonMacroHash,baselineFaces,baselineVertices:f.heights.length,emittedPartitionTriangles:terrain.length,totalBaselineArea,coveredIntersections,ownershipPairs,maxAffineError,maxPhysicalPlaneNormalDistance:maxNormalDistance,maxUncoveredArea,maxOverlapArea,scope:'Every original physical triangle is covered once by coplanar emitted material pieces; geometric face normals unchanged. Rendered vertex-normal parity is separately checked by renderer.'};return terrainPartitionResult;
}

const reportMetric=(key:string,value:unknown)=>{report.metrics[key]=value;};
const assertNoFailures=(errors:string[],label:string)=>assert.equal(errors.length,0,`${label}: ${errors.length} failures\n${errors.slice(0,18).join('\n')}`);

audit('snow emitted geometry has finite indexed data and hard material/mesh budgets','structural',t=>{
  let vertices=0,triangles=0;assert.equal(geometry.trackId,'snow');
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

audit('snow complete physical road is positive single-owned and exact coplanar at every overlap and graph seam','structural',t=>{
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
  for(const edge of Object.values(SNOW_COURSE.edges))for(let s=0;s<=edge.length;s=Math.min(edge.length,s+1)){
    for(const side of [-1,-.5,0,.5,1]){const p=tuple(edge.sample(s,side*edge.laneLimitAt(s)).p);assert.ok(mesh.query(p,p,.03).some(triangle=>roadIds.has(triangle.id)&&projectedInterval(triangle,p,p)&&Math.abs(height(triangle,p[0],p[2])-p[1])<.08),`${edge.id}:${s} legal lane:${side} has no rendered support`);laneProbes++;}if(s===edge.length)break;
  }
  const e=SNOW_COURSE.edges,joins=[[e.start,e.alley],[e.start,e.boulevard],[e.alley,e.finish],[e.boulevard,e.finish],[e.finish,e.start]];
  let seams=0;
  for(const [a,b] of joins)for(let lateral=-a.halfWidthAt(a.length);lateral<=a.halfWidthAt(a.length);lateral+=.125){
    const p=a.sample(a.length,lateral),q=b.sample(0,lateral);assert.ok(p.p.distance(q.p)<1e-7,`${a.id}>${b.id} discontinuous seam at ${lateral}`);assert.ok(p.t.distance(q.t)<1e-7);assert.ok(p.n.distance(q.n)<1e-7);seams++;
  }
  reportMetric('roadOwnership',{actualTriangles:roads.length,nearbyPairs:pairs,wholeWidthPolygons:coveragePolygons,laneProbes,exactSeamSamples:seams,maxHeightError});t.diagnostic(JSON.stringify(report.metrics.roadOwnership));
});

audit('snow physical ribbon has no nonlocal crossing local fold or noncoplanar branch ownership','structural',t=>{
  const cells=new Map<string,typeof physical>();
  for(const p of physical)for(let x=Math.floor(p.min[0]/20);x<=Math.floor(p.max[0]/20);x++)for(let z=Math.floor(p.min[2]/20);z<=Math.floor(p.max[2]/20);z++){const key=x+','+z,list=cells.get(key)??[];list.push(p);cells.set(key,list);}
  let overlaps=0,localDerivatives=0;let maxCoplanarError=0,minForward=Infinity;
  for(const a of physical){const ids=new Set<number>();for(let x=Math.floor(a.min[0]/20);x<=Math.floor(a.max[0]/20);x++)for(let z=Math.floor(a.min[2]/20);z<=Math.floor(a.max[2]/20);z++)for(const b of cells.get(x+','+z)??[]){
    if(b.id<=a.id||ids.has(b.id))continue;ids.add(b.id);const polygon=clipPolygon([a.a,a.b,a.c],b);if(area(polygon)<1e-7)continue;
    assert.notEqual(a.edgeId,b.edgeId,`same-edge actual source fold ${a.edgeId}:${a.s}/${b.s}`);
    const aa=SNOW_COURSE.edges[a.edgeId as keyof typeof SNOW_COURSE.edges],bb=SNOW_COURSE.edges[b.edgeId as keyof typeof SNOW_COURSE.edges];
    const branches=['alley','boulevard'].includes(a.edgeId)&&['alley','boulevard'].includes(b.edgeId);
    const allowed=branches?Math.min(a.s+b.s,(aa.length-a.s)+(bb.length-b.s))<260:(a.edgeId==='start'?aa.length-a.s:a.edgeId==='finish'?a.s:Math.min(a.s,aa.length-a.s))+(b.edgeId==='start'?bb.length-b.s:b.edgeId==='finish'?b.s:Math.min(b.s,bb.length-b.s))<180;
    // The start/finish lap seam is at the opposite endpoint of their route IDs.
    const lap=new Set([a.edgeId,b.edgeId]).has('start')&&new Set([a.edgeId,b.edgeId]).has('finish')&&(a.edgeId==='start'?a.s+bb.length-b.s:b.s+aa.length-a.s)<80;
    assert.ok(allowed||lap,`unintended nonlocal source overlap ${a.edgeId}:${a.s}/${b.edgeId}:${b.s}`);
    for(const p of polygon){const d=Math.abs(height(a,p[0],p[2])-height(b,p[0],p[2]));maxCoplanarError=Math.max(maxCoplanarError,d);assert.ok(d<1e-7,`noncoplanar route union ${a.edgeId}/${b.edgeId}: ${d}`);}overlaps++;
  }}
  for(const edge of Object.values(SNOW_COURSE.edges))for(let s=.25;s<edge.length-.25;s+=.5)for(const side of [-1,1]){
    const p=edge.sample(s-.25,side*edge.halfWidthAt(s-.25)).p,q=edge.sample(s+.25,side*edge.halfWidthAt(s+.25)).p,tangent=edge.sample(s).t,forward=q.clone().sub(p).dot(tangent)/.5;
    minForward=Math.min(minForward,forward);assert.ok(forward>.6,`${edge.id}:${s} local full-width forward fold ${forward}`);localDerivatives++;
  }
  reportMetric('physicalTopology',{sourceTriangles:physical.length,exactCoplanarOverlaps:overlaps,maxCoplanarError,localDerivatives,minForward});t.diagnostic(JSON.stringify(report.metrics.physicalTopology));
});

audit('snow terrain covers every full road footprint and every emitted solid clears the entire 3.2m kart-body prism','structural',t=>{
  let covered=0,candidates=0,minGap=Infinity,maxGap=-Infinity;
  const errors:string[]=[];
  for(const road of roads){
    const coverage=supportCoverage([road.a,road.b,road.c],(triangle,polygon)=>{
      if(!terrainIds.has(triangle.id))return false;
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


function triangleDistanceXZ(t:Triangle,p:V){
  if(projectedInterval(t,p,p))return 0;const points=[t.a,t.b,t.c];return Math.min(...points.map((a,i)=>{const b=points[(i+1)%3],x=b[0]-a[0],z=b[2]-a[2],u=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[2]-a[2])*z)/(x*x+z*z)));return Math.hypot(p[0]-a[0]-u*x,p[2]-a[2]-u*z);}));
}


const orbitCases=Array.from({length:24},(_,i)=>[-.28,0,.4,.78].map(pitch=>({yaw:-Math.PI+i*Math.PI/12,pitch,rearView:false}))).flat();
// Rear view deliberately overrides all orbit yaws/pitches in the real source;
// one rear pose covers them, while release/toggle transitions are tested below.
const allViews=[...orbitCases,{yaw:0,pitch:0,rearView:true}];
const anchorAt=(frame:ReturnType<typeof SNOW_COURSE.commonStart.sample>)=>({x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z});
const smoothPose=(a:CameraPoint,b:CameraPoint,dt=1/60)=>{const alpha=1-Math.exp(-dt*8);return{x:a.x+(b.x-a.x)*alpha,y:a.y+(b.y-a.y)*alpha,z:a.z+(b.z-a.z)*alpha};};

audit('snow desired-safe and genuinely interpolated whole booms clear actual mesh by 0.3m on all edges lanes and orbit/rear poses','camera',t=>{
  let poses=0,retractions=0,rawHits=0,failures=0;const examples:string[]=[];
  const inspect=(a:CameraPoint,b:CameraPoint,label:string)=>{const failure=boomFailure(tuple(a),tuple(b),label);if(failure){failures++;if(examples.length<12)examples.push(failure);}};
  for(const edge of Object.values(SNOW_COURSE.edges)){
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
  assert.ok(poses>60000);reportMetric('wholeCourseCameras',{poses,desiredBooms:poses,interpolatedBooms:poses,rawHits,retractions,failures,strictMargin:.3,yaws:24,pitches:4,legalLanes:3,views:2,wholeRouteSpacingMetres:12,transitionSpacingMetres:3,scope:'Finite source-mesh pose matrix; not continuous-yaw universal proof'});t.diagnostic(`${poses} desired-safe and ${poses} truly interpolated complete 0.3m capsule/source-mesh checks; ${rawHits} raw desired source hits, ${retractions} retractions`);
});


function assertDefaultFrustum(camera:CameraPoint,look:CameraPoint,target:V,label:string){
  const forward=sub(tuple(look),tuple(camera)).map((n,_,p)=>n/Math.hypot(...p));
  const right=[-forward[2],0,forward[0]],rl=Math.hypot(...right);right.forEach((_,i)=>right[i]/=rl);
  const up=[right[1]*forward[2]-right[2]*forward[1],right[2]*forward[0]-right[0]*forward[2],right[0]*forward[1]-right[1]*forward[0]],ray=sub(target,tuple(camera)),depth=dot(forward,ray),tan=Math.tan(28*Math.PI/180);
  assert.ok(depth>0&&Math.abs(dot(right,ray))<depth*tan*16/10&&Math.abs(dot(up,ray))<depth*tan,`${label} outside actual 56 degree 1280×800 native chase frustum`);
}
audit('every snow pickup has physical mesh-clear approach rays and default framing including both branch approaches','camera',t=>{
  let rays=0;
  for(const pickup of snowPickupRows(SNOW_COURSE))for(const ahead of [12,25,40,55])for(const side of [-1,0,1])for(const view of [0,1]){
    const edge=SNOW_COURSE.edges[pickup.edgeId],s=pickup.s-ahead,frame=edge.sample(s,side*edge.laneLimitAt(s)),anchor=anchorAt(frame),pose=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:false,orbit:{yaw:0,pitch:0}}),camera=safeLandCamera(anchor,pose.position,geometry.cameraObstacles);
    for(const lift of [1.08,1.25,1.42]){
      const target=[pickup.p.x,pickup.p.y+lift,pickup.p.z],hit=mesh.firstHit(tuple(camera),target),label=`${pickup.edgeId}:${pickup.s} itemLane:${pickup.lateral} actorLane:${side} ahead:${ahead} view:${view} bob:${lift}`;
      assert.ok(!hit,`${label}: blocked by actual ${hit?.triangle.batch}/${hit&&componentOf.get(hit.triangle.id)?.kind} triangle ${hit?.triangle.id}`);assertDefaultFrustum(camera,pose.look,target,label);rays++;
    }
  }
  assert.equal(rays,1440);reportMetric('pickupVisibility',{rays,bobHeights:[1.08,1.25,1.42],approaches:[12,25,40,55],views:2,legalLanes:3,verticalFovDegrees:56,aspect:1280/800});t.diagnostic(`${rays} physical pickup rays at center and both full legal edge lanes, both default views and bob extremes; all rows additionally12/25/40m`);
});

audit('snow camera mesh broadphase covers actual local triangles without unbounded source scans or whole-building boxes','camera',t=>{
  const triangleKey=(points:readonly V[])=>points.map(shapeKey).sort().join('|'),actualKeys=new Set(mesh.triangles.map(t=>triangleKey([t.a,t.b,t.c])));
  const payloads=geometry.cameraObstacles.filter(b=>b.triangles).map(b=>({kind:b.kind,triangles:b.triangles!,bounds:b.triangles!.map(points=>boundsOf(points))}));let totalTriangles=0,queries=0,maxCandidates=0;
  for(const blocker of geometry.cameraObstacles){assert.ok(blocker.triangles||blocker.heightfield,`${blocker.kind} is a broad solid box which may fill real architectural void`);}
  for(const payload of payloads){totalTriangles+=payload.triangles.length;for(const triangle of payload.triangles)assert.ok(actualKeys.has(triangleKey(triangle)),`${payload.kind} camera mesh invents a non-rendered face`);}
  const payloadKeys=new Set(payloads.flatMap(p=>p.triangles.map(triangleKey)));
  let requiredFaces=0,wayfindingFaces=0;
  for(const triangle of mesh.triangles){const component=componentOf.get(triangle.id);if(!component||terrainIds.has(triangle.id)||component.role==='road')continue;requiredFaces++;if(/sign|wayfind|icon|board/.test(component.kind))wayfindingFaces++;assert.ok(payloadKeys.has(triangleKey([triangle.a,triangle.b,triangle.c])),`runtime camera omitted actual ${component.kind} triangle ${triangle.id}`);}
  assert.ok(wayfindingFaces>0,'actual wayfinding boards/posts/icons remain physical camera obstacles');
  reportMetric('runtimeMeshCorrespondence',{requiredFaces,wayfindingFaces,payloadFaces:payloadKeys.size});
  reportMetric('terrainMaterialPartition',verifyTerrainPartition());
  for(const edge of Object.values(SNOW_COURSE.edges))for(let s=0;s<edge.length;s+=100)for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/2]){
    const frame=edge.sample(s),anchor=anchorAt(frame),desired=chaseCamera({position:frame.p,tangent:frame.t,view:1,rearView:false,orbit:{yaw,pitch:-.28}}).position,a=tuple(anchor),b=tuple(desired),min=a.map((n,i)=>Math.min(n,b[i])-.45),max=a.map((n,i)=>Math.max(n,b[i])+.45);let local=0;
    for(const payload of payloads){
      const ids=cameraMeshCandidateIds(payload.triangles,anchor,desired),set=new Set(ids);local+=ids.length;
      payload.bounds.forEach((box,i)=>{if(box.min[0]<=max[0]&&box.max[0]>=min[0]&&box.min[2]<=max[2]&&box.max[2]>=min[2])assert.ok(set.has(i),`${payload.kind} local broadphase omitted source face ${i}`);});
    }
    assert.ok(local<totalTriangles*.2,`${local}/${totalTriangles} runtime camera candidates is not a local query`);maxCandidates=Math.max(maxCandidates,local);queries++;
  }
  assert.ok(totalTriangles>5000&&queries>100);reportMetric('runtimeBroadphase',{queries,maxCandidates,totalTriangles,maximumSourceFraction:maxCandidates/totalTriangles,wholeArchitectureBoxes:0,scope:'Representative source-bound queries only; not a universal worst-case or FPS claim'});t.diagnostic(`${queries} source-bounds broadphase checks, max ${maxCandidates} local candidates of ${totalTriangles} actual mesh faces; no whole-building boxes`);
});



function requireContacts(kind:string,targetKinds:readonly string[],minimum:number,errors:string[],maximum?:number){
  const sources=geometry.components.filter(c=>c.kind===kind),targets=geometry.components.filter(c=>targetKinds.includes(c.kind));if(!sources.length)errors.push(`missing structural ${kind}`);let count=0;
  for(const source of sources){const contacts=targets.filter(target=>target!==source&&actualContact(source,target));if(contacts.length<minimum)errors.push(`${kind} ${JSON.stringify(actualBounds.get(source))} has ${contacts.length} actual contacts to ${targetKinds.join('/')}, needs ${minimum}`);if(maximum!==undefined)assert.ok(contacts.length<=maximum);count+=contacts.length;}return count;
}


audit('snow actual landmark vertices fit authored radius height and complete reserved road clearance','structural',t=>{
  let vertices=0,landmarks=0;
  for(const landmark of geometry.landmarks){
    const plot=SNOW_LANDMARKS.plots.find(p=>p.id===landmark.kind);assert.ok(plot);assert.equal(landmark.radius,plot.radius);assert.equal(landmark.height,plot.height);
    for(const triangle of mesh.query(landmark.position,landmark.position,landmark.radius+20))if(roadIds.has(triangle.id))assert.ok(triangleDistanceXZ(triangle,landmark.position)>=landmark.radius+19.5,`${landmark.kind} radius infringes actual road triangle ${triangle.id}`);
    const parts=geometry.components.filter(c=>c.landmark===landmark.kind);assert.ok(parts.length>(landmark.kind==='snow-split-ridge'?2:5),`${landmark.kind} is missing detailed modeled source parts`);
    for(const c of parts)for(const p of actualComponentPoints(c)){assert.ok(Math.hypot(p[0]-landmark.position[0],p[2]-landmark.position[2])<=landmark.radius+1e-6,`${landmark.kind}/${c.kind} actual point ${p} escapes radius`);assert.ok(p[1]<=landmark.position[1]+landmark.height+1e-6,`${landmark.kind}/${c.kind} escapes height`);vertices++;}landmarks++;
  }
  assert.equal(landmarks,5);reportMetric('landmarkEnvelopes',{landmarks,vertices});t.diagnostic(JSON.stringify(report.metrics.landmarkEnvelopes));
});

audit('snow landmark sightlines first hit the actual modeled silhouette rather than empty reservation centers','structural',t=>{
  const errors:string[]=[];let rays=0;
  for(const line of geometry.sightlines){const landmark=geometry.landmarks.find(l=>l.kind===line.targetId);assert.ok(landmark);const hit=mesh.firstHit(line.eye,line.target);if(!hit)errors.push(`${line.name} ends in empty air`);else if(componentOf.get(hit.triangle.id)?.landmark!==landmark.kind)errors.push(`${line.name} first hits ${hit.triangle.batch}/${componentOf.get(hit.triangle.id)?.kind}/${hit.triangle.id} rather than ${landmark.kind}`);rays++;}
  assert.equal(rays,5);reportMetric('landmarkSilhouettes',{rays,failures:errors.length,examples:errors});assertNoFailures(errors,'silhouette first-hit');t.diagnostic(`${rays} actual first-hit source silhouette rays`);
});


function frustumRay(eye:V,look:V,u:number,v:number,length=900):V{
  const forward=sub(look,eye),fl=Math.hypot(...forward),f=forward.map(x=>x/fl),right=[-f[2],0,f[0]],rl=Math.hypot(...right),r=right.map(x=>x/rl),up=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]],tan=Math.tan(28*Math.PI/180);
  const direction=f.map((x,i)=>x+r[i]*u*tan*16/10+up[i]*v*tan),dl=Math.hypot(...direction);return eye.map((x,i)=>x+length*direction[i]/dl);
}

audit('independent snow oracle detects vertical walls thin terrain spikes solid interiors and exact contact','structural',()=>{
  const triangle=(a:V,b:V,c:V):Triangle=>({id:-1,batch:'independent oracle fixture',vertices:[],a,b,c,...boundsOf([a,b,c])});
  const road=triangle([0,0,0],[10,0,0],[0,0,10]),wall=triangle([2,-1,2],[2,4,2],[2,4,4]);assert.ok(area3D(prismIntersection(wall,road,.15,3.2))>1);assert.equal(prismIntersection(triangle([20,-1,20],[20,4,20],[20,4,24]),road,.15,3.2).length,0);
  const peak=triangle([4.99,0,-1],[5.02,8,0],[4.99,0,1]),interval=projectedInterval(peak,[0,1,0],[10,1,0]);assert.ok(interval&&interval[0]<.5&&interval[1]>.5);assert.ok(height(peak,5,0)>1);assert.ok(hitFraction(wall,[0,1,2.5],[4,1,2.5])!==null);assert.equal(segmentTriangleDistance([0,1,2.5],[4,1,2.5],wall),0);assert.ok(Math.abs(segmentTriangleDistance([2.2,1,2.5],[2.2,3,2.5],wall)-.2)<1e-8);
});

audit('snow exposed physical road boundaries are stitched to emitted shoulders and visual coping never owns road','structural',t=>{
  let exposed=0,interior=0,shoulderTriangles=0,copingTriangles=0;const errors:string[]=[];
  const support=mesh.triangles.filter(triangle=>componentOf.get(triangle.id)?.role==='support'&&cross2(triangle.a,triangle.b,triangle.c)<-1e-9),supportIds=new Set(support.map(t=>t.id));
  for(const edge of Object.values(SNOW_COURSE.edges)){
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

audit('snow exact 100m level decision and independently sampled 40m common tail survive complete spatial ownership','structural',t=>{
  const {start,alley,boulevard}=SNOW_COURSE.edges;let decisionSamples=0,tailSamples=0;const end=start.sample(start.length);
  for(let d=0;d<=100;d+=.25)for(const lateral of [-9.5,-4.75,0,4.75,9.5]){
    const p=start.sample(start.length-d,lateral);assert.ok(Math.abs(p.p.x-(end.p.x-lateral))<1e-9);assert.ok(Math.abs(p.p.y-18)<1e-9);assert.ok(Math.abs(p.p.z-(end.p.z+d))<1e-8);assert.equal(p.bank,0);assert.equal(start.halfWidthAt(start.length-d),9.5);decisionSamples++;
  }
  for(let remaining=0;remaining<=40;remaining+=.125)for(const lateral of [-9.5,-4.75,0,4.75,9.5]){
    const a=alley.sample(alley.length-remaining,lateral),b=boulevard.sample(boulevard.length-remaining,lateral);assert.ok(a.p.distance(b.p)<1e-9);assert.ok(a.t.distance(b.t)<1e-9);assert.ok(a.n.distance(b.n)<1e-9);assert.ok(a.normal.distance(b.normal)<1e-9);assert.equal(Math.abs(a.bank),0);assert.equal(Math.abs(b.bank),0);assert.equal(alley.halfWidthAt(alley.length-remaining),9.5);tailSamples++;
  }
  // Quantify actual positive-area overlap, including both lobes beyond tail.
  const branch=physical.filter(p=>p.edgeId==='alley'),wide=physical.filter(p=>p.edgeId==='boulevard');let splitMax=0,mergeMax=0,pairs=0;
  for(const a of branch)for(const b of wide){if(a.min[0]>b.max[0]||a.max[0]<b.min[0]||a.min[2]>b.max[2]||a.max[2]<b.min[2])continue;const overlap=clipPolygon([a.a,a.b,a.c],b);if(area(overlap)<1e-7)continue;pairs++;if(a.s<alley.length/2)splitMax=Math.max(splitMax,a.next,b.next);else mergeMax=Math.max(mergeMax,alley.length-a.s,boulevard.length-b.s);}
  assert.ok(splitMax>=25&&splitMax<40,`measured split union ${splitMax}m`);assert.ok(mergeMax>=85&&mergeMax<110,`measured merge union ${mergeMax}m`);assert.ok(mergeMax>40,'union overlap must not be truncated at runtime common tail');
  reportMetric('decisionAndTail',{decisionMetres:100,decisionSamples,commonTailMetres:40,tailSamples,positiveOverlapPairs:pairs,splitExtentUpperSampleBound:splitMax,mergeExtentUpperSampleBound:mergeMax});t.diagnostic(JSON.stringify(report.metrics.decisionAndTail));
});

audit('snow connected snow slate landform retains all 33500 protected triangles and real bowl saddle return relief','structural',t=>{
  assert.ok(terrain.length>=33500,`${terrain.length} actual connected snow/slate triangles below protected 33500`);
  const vertices=new Map<string,number>(),edges=new Map<string,number>(),parent:number[]=[];let minY=Infinity,maxY=-Infinity;
  const root=(i:number):number=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const vertex=(p:V)=>{const key=shapeKey(p);let id=vertices.get(key);if(id===undefined){id=parent.length;vertices.set(key,id);parent.push(id);}return id;};
  for(const triangle of terrain){assert.ok(cross2(triangle.a,triangle.b,triangle.c)<-1e-9,`terrain ${triangle.id} faces downward or folds`);const p=[triangle.a,triangle.b,triangle.c],ids=p.map(vertex);for(let k=0;k<3;k++){parent[root(ids[k])]=root(ids[(k+1)%3]);const key=[ids[k],ids[(k+1)%3]].sort((a,b)=>a-b).join(',');edges.set(key,(edges.get(key)??0)+1);}for(const p0 of p){minY=Math.min(minY,p0[1]);maxY=Math.max(maxY,p0[1]);}}
  assert.equal(new Set(parent.map((_,i)=>root(i))).size,1);assert.ok([...edges.values()].every(n=>n<=2));assert.ok(maxY-minY>40,`connected relief ${maxY-minY}`);
  const regions=[{name:'west snow bowl and low inner saddle',min:[-360,-320],max:[0,-35],minimum:25},{name:'opposing east snow bowl',min:[40,-30],max:[435,220],minimum:30},{name:'southwest stepped return',min:[-460,-1040],max:[140,-550],minimum:20},{name:'station terrace',min:[410,-780],max:[530,-340],minimum:6}];
  const relief=regions.map(r=>{const points=terrain.flatMap(q=>[q.a,q.b,q.c]).filter(p=>p[0]>=r.min[0]&&p[0]<=r.max[0]&&p[2]>=r.min[1]&&p[2]<=r.max[1]);const min=Math.min(...points.map(p=>p[1])),max=Math.max(...points.map(p=>p[1]));assert.ok(max-min>=r.minimum,`${r.name} actual connected relief ${max-min}`);return{name:r.name,minY:min,maxY:max,relief:max-min};});
  reportMetric('connectedLandforms',{triangles:terrain.length,connectedComponents:1,vertices:vertices.size,minY,maxY,regions:relief,nonManifoldEdges:0});t.diagnostic(JSON.stringify(report.metrics.connectedLandforms));
});

audit('snow no scenic roof crossing overhead face or closed solid contains the complete legal kart prism','structural',t=>{
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

audit('snow full emitted foundation and planted support footprints contact every intersected actual terrain face','structural',t=>{
  const foundationParts=geometry.components.filter(c=>c.kind.endsWith('-continuous-foundation'));let intersections=0,grounded=0;
  assert.ok(foundationParts.length>=4,'all four architecture sites need continuous ground bearing');
  for(const c of foundationParts){const key=c.kind.replace(/-continuous-foundation$/,''),cap=geometry.components.find(p=>p.kind===key+'-foundation-cap'&&actualContact(c,p));assert.ok(cap,`${key} cap missing actual foundation contact`);intersections+=fullGroundContact(c,.001,actualBounds.get(cap)!.max[1]);intersections+=fullBottomContact(cap,p=>p===c);}
  const groundParts=new Set<Component>();for(const detail of geometry.groundedDetails){const matches=geometry.components.filter(c=>c.kind===detail.kind&&actualBounds.get(c)!.min[0]<=detail.x+1e-6&&actualBounds.get(c)!.max[0]>=detail.x-1e-6&&actualBounds.get(c)!.min[2]<=detail.z+1e-6&&actualBounds.get(c)!.max[2]>=detail.z-1e-6);assert.equal(matches.length,1,`${detail.kind} grounded provenance`);groundParts.add(matches[0]);}
  for(const c of groundParts){intersections+=fullGroundContact(c);grounded++;}
  assert.ok(grounded>50);reportMetric('foundationGrounding',{foundations:foundationParts.length,groundedParts:grounded,fullFootprintTerrainIntersections:intersections});t.diagnostic(JSON.stringify(report.metrics.foundationGrounding));
});

audit('snow shared camera crosses split merge and lap seams both directions with genuinely interpolated rear-toggle poses','camera',t=>{
  const e=SNOW_COURSE.edges,joins=[[e.start,e.alley],[e.start,e.boulevard],[e.alley,e.finish],[e.boulevard,e.finish],[e.finish,e.start]] as const;let frames=0;
  for(const reverse of [false,true])for(const side of [-1,0,1])for(const view of [0,1])for(const rearMode of [0,1,2])for(const pitch of [-.28,.78])for(const [from,to] of joins){
    let previous:CameraPoint|null=null;
    for(let i=0;i<=80;i++){const offset=(reverse?40-i:i-40)*.8,edge=offset<0?from:to,s=offset<0?from.length+offset:offset,frame=edge.sample(s,side*edge.laneLimitAt(s)),anchor=anchorAt(frame),rearView=rearMode===1||(rearMode===2&&i>=20&&i<50),yaw=Math.PI*Math.sin(i/80*Math.PI*2),raw=chaseCamera({position:frame.p,tangent:frame.t,view,rearView,orbit:{yaw,pitch}}).position,desired=safeLandCamera(anchor,raw,geometry.cameraObstacles),interpolated=previous?smoothPose(previous,desired):desired,final=safeLandCamera(anchor,interpolated,geometry.cameraObstacles);assert.equal(boomFailure(tuple(anchor),tuple(final),`${from.id}>${to.id} reverse:${reverse} lane:${side} view:${view} rearMode:${rearMode} pitch:${pitch} frame:${i}`),null);previous=final;frames++;}
  }
  assert.equal(frames,29160);reportMetric('transitionCameras',{frames,joins:5,directions:2,lanes:3,views:2,rearModes:3,pitches:2,strictMargin:.3});t.diagnostic(JSON.stringify(report.metrics.transitionCameras));
});

const revealPoses=[{edge:'start',s:380,name:'First snow bowl'},{edge:'start',s:640,name:'Lower connecting saddle'},{edge:'start',s:1100,name:'Opposing snow bowl'},{edge:'start',s:1400,name:'Depot descent'},{edge:'start',s:1740,name:'Level depot choice'},{edge:'alley',s:210,name:'Open service yard'},{edge:'boulevard',s:330,name:'Clock hall terrace'},{edge:'finish',s:620,name:'Stepped southwest return'}] as const;
audit('snow eight driver and shared chase review poses reveal actual connected snow slate silhouettes','structural',t=>{
  const results:unknown[]=[],errors:string[]=[];let rays=0;
  for(const review of revealPoses){const edge=SNOW_COURSE.edges[review.edge],frame=edge.sample(review.s),anchor=anchorAt(frame),forward=edge.sample(Math.min(edge.length,review.s+32)),poses:[string,V,V][]=[['driver',[frame.p.x,frame.p.y+1.6,frame.p.z],[forward.p.x,forward.p.y+1.6,forward.p.z]]];
    for(const view of [0,1])for(const rearView of [false,true]){const pose=chaseCamera({position:frame.p,tangent:frame.t,view,rearView,orbit:{yaw:0,pitch:0}}),camera=safeLandCamera(anchor,pose.position,geometry.cameraObstacles);assert.equal(boomFailure(tuple(anchor),tuple(camera),`review ${review.name}/${view}/${rearView}`),null);poses.push([`view${view}-${rearView?'rear':'chase'}`,tuple(camera),tuple(pose.look)]);}
    const stats=poses.map(([view,eye,look])=>{let terrainHits=0,elevatedTerrainHits=0,roadHits=0,structureHits=0,minTerrainY=Infinity,maxTerrainY=-Infinity;const firstHits:number[]=[];
      for(const vertical of [-1,-.8,-.6,-.4,-.25,-.15,-.1,-.06,-.025,0,.025,.06,.1,.15,.25,.4,.6,.8,1])for(let column=0;column<17;column++){const end=frustumRay(eye,look,(column-8)/8,vertical),hit=mesh.firstHit(eye,end);rays++;if(!hit)continue;firstHits.push(hit.triangle.id);if(componentOf.get(hit.triangle.id)?.role==='terrain'){const p=lerp(eye,end,hit.fraction);terrainHits++;minTerrainY=Math.min(minTerrainY,p[1]);maxTerrainY=Math.max(maxTerrainY,p[1]);if(p[1]>eye[1]+.5)elevatedTerrainHits++;}else if(roadIds.has(hit.triangle.id))roadHits++;else structureHits++;}
      if(terrainHits<=4)errors.push(`${review.name}/${view} reveals only ${terrainHits} actual landform rays`);return{view,eye,look,terrainHits,elevatedTerrainHits,roadHits,structureHits,minTerrainY,maxTerrainY,firstHitTriangles:firstHits};});
    if(review.edge==='start'&&[380,640,1100].includes(review.s)&&!stats.filter(p=>!p.view.includes('rear')).some(p=>p.elevatedTerrainHits>0))errors.push(`${review.name} has no connected snow/slate crest above driver or chase eye`);results.push({...review,poses:stats});
  }
  reportMetric('driverRevealReview',{reviewPositions:8,viewsPerPosition:5,rays,poses:results,scope:'Exact emitted-source first-hit rays only; native rendered pixel review remains separate',failures:errors});assertNoFailures(errors,'driver landform silhouette');t.diagnostic(`${rays} source rays from eight driver/rear/chase poses`);
});

const structuralRequirements:[string,string[],number][]=[
 ['parcels-cart-axle-to-frame-bearing',['parcels-cart-through-axle','parcels-cart-supported-deck-frame'],2],
 ['inspection-trolley-paired-spring-block',['inspection-trolley-exposed-through-axle','inspection-trolley-axle-seated-frame'],2],
 ['snowplow-axle-seated-chassis',['snowplow-continuous-through-axle'],1],
 ['clock-deep-seated-stone-dial',['clock-tower-front-back-lower-wall'],1],
 ['clock-dial-seated-hand-arbor',['clock-bronze-recessed-dial-face'],1],
 ['clock-supported-hour-hand',['clock-dial-seated-hand-arbor'],1],
 ['clock-supported-minute-hand',['clock-dial-seated-hand-arbor'],1],
 ['clock-original-central-snowflake',['clock-dial-seated-hand-arbor','clock-supported-hour-hand','clock-supported-minute-hand'],1],
 ['parcels-cart-through-axle',['parcels-cart-actual-wheel-seated-hub'],2],
 ['parcels-cart-seated-deck-slat',['parcels-cart-supported-deck-frame'],1],
 ['parcels-cart-push-handle',['parcels-cart-supported-deck-frame','parcels-cart-seated-deck-slat'],1],
 ['parcels-cart-push-crossbar',['parcels-cart-push-handle'],2],
 ['parcels-cart-seated-tied-cargo',['parcels-cart-seated-deck-slat'],1],
 ['parcels-cart-secured-cargo-binding',['parcels-cart-seated-tied-cargo'],1],
 ['bench-leg-supported-seat-slat',['bench-continuous-seated-leg'],2],
 ['bench-supported-back-slat',['bench-back-continuous-upright'],2],
 ['signal-porch-tenoned-timber-post',['signal-porch-stone-post-shoe'],1],
 ['signal-porch-seated-eave-beam',['signal-porch-tenoned-timber-post'],3],
 ['signal-porch-supported-canopy',['signal-porch-seated-eave-beam'],1],
 ['clock-platform-porch-tenoned-timber-post',['clock-platform-porch-stone-post-shoe'],1],
 ['clock-platform-post-seated-beam',['clock-platform-porch-tenoned-timber-post'],5],
 ['clock-platform-open-canopy-slate',['clock-platform-post-seated-beam'],1],
 ['clock-bronze-recessed-dial-face',['clock-deep-seated-stone-dial'],1],
 ['clock-twelve-original-radial-tick',['clock-bronze-recessed-dial-face'],1],
 ['roundhouse-pier-seated-bay-lintel',['roundhouse-continuous-bay-pier'],2],
 ['roundhouse-door-seated-plank-batten',['roundhouse-third-bay-sliding-door'],1],
 ['siding-sleeper-seated-rail-shoe',['siding-platform-seated-sleeper'],1],
 ['siding-continuous-raised-rail-head',['siding-sleeper-bearing-rail-web'],1],
 ['inspection-trolley-exposed-through-axle',['inspection-trolley-flanged-wheel-seated-hub'],2],
 ['inspection-trolley-frame-seated-slat',['inspection-trolley-axle-seated-frame'],1],
 ['inspection-trolley-supported-hand-lever',['inspection-trolley-joined-pump-post'],2],
 ['plow-shed-open-front-tenoned-timber-post',['plow-shed-open-front-stone-post-shoe'],1],
 ['plow-shed-post-seated-front-lintel',['plow-shed-open-front-tenoned-timber-post'],3],
 ['snowplow-continuous-through-axle',['snowplow-open-eight-spoke-wheel-seated-hub'],2],
 ['snowplow-chassis-to-blade-strut',['snowplow-axle-seated-chassis','snowplow-thick-curved-wedge-blade'],2],
 ['snowplow-blade-seated-rear-rib',['snowplow-thick-curved-wedge-blade'],1],
 ['snowplow-supported-center-nose-spine',['snowplow-thick-curved-wedge-blade'],2],
 ['snowplow-forked-drawbar',['snowplow-axle-seated-chassis'],1],
 ['snowplow-supported-drawbar-handle',['snowplow-forked-drawbar'],2],
 ['plow-rack-pier-seated-shelf',['plow-rack-continuous-pier'],4],
 ['plow-rack-seated-spare-blade-plate',['plow-rack-pier-seated-shelf'],1],
 ['snow-fir-trunk-joined-branch',['snow-fir-grounded-continuous-trunk'],1],
 ['snow-fir-bough-seated-snow',['snow-fir-branch-seated-bough'],1],
 ['snow-fork-supported-arrow-board',['snow-fork-grounded-sign-post'],2],
 ['snow-fork-supported-raised-arrow',['snow-fork-supported-arrow-board'],1],
 ['snow-fork-supported-route-icon',['snow-fork-supported-arrow-board'],1],
];
audit('snow actual shafts spokes hands handles slats roofs and detail support chains attach physically','structural',t=>{
  let contacts=0;const errors:string[]=[];
  for(const [kind,targets,minimum]of structuralRequirements)contacts+=requireContacts(kind,targets,minimum,errors);
  for(const edge of geometry.structuralContacts){const a=geometry.components[edge.first],b=geometry.components[edge.second];if(!a||!b||!actualContact(a,b))errors.push(`claimed contact ${edge.kind}: ${a?.kind} / ${b?.kind} does not physically meet`);else contacts++;}
  for(const kind of new Set(geometry.components.filter(c=>/actual-wheel$|flanged-wheel$|open-eight-spoke-wheel$/.test(c.kind)).map(c=>c.kind))){
    contacts+=requireContacts(kind+'-eight-joined-spoke',[kind,kind+'-seated-hub'],2,errors);
  }
  reportMetric('structuralConnections',{requirements:structuralRequirements.length,declaredEdgesChecked:geometry.structuralContacts.length,contacts,failures:errors.length,examples:errors.slice(0,60)});assertNoFailures(errors,'actual structure contacts');t.diagnostic(JSON.stringify(report.metrics.structuralConnections));
});

function insideClosedComponent(point:V,c:Component){
  const b=actualBounds.get(c)!;if(point.some((v,k)=>v<=b.min[k]+1e-7||v>=b.max[k]-1e-7))return false;const d=Math.hypot(...b.max.map((v,k)=>v-b.min[k]))*3+1,end=[point[0]+d,point[1]+d*.371,point[2]+d*.529],hits=(componentTriangles.get(c)??[]).map(q=>hitFraction(q,point,end)).filter((v):v is number=>v!==null).sort((a,b)=>a-b),unique=hits.filter((v,i)=>!i||v-hits[i-1]>1e-7);return unique.length%2===1;
}
audit('snow actual lowest wheel patches seat on real platform rail surfaces and never intrude inside cart bodies','structural',t=>{
  const wheels=geometry.components.filter(c=>/actual-wheel$|flanged-wheel$|open-eight-spoke-wheel$/.test(c.kind));assert.equal(wheels.length,14);let contacts=0,intersections=0;const metrics:unknown[]=[],errors:string[]=[];
  const chassis=geometry.components.filter(c=>/^(parcels-cart|inspection-trolley|snowplow).*(deck-frame|deck-slat|axle-seated-frame|frame-seated-slat|axle-seated-chassis)$/.test(c.kind));
  for(const c of wheels){const bounds=actualBounds.get(c)!,bottom=bounds.min[1],vertices=actualComponentPoints(c),lowest=vertices.filter(p=>Math.abs(p[1]-bottom)<1e-8);let maxGap=-Infinity,minGap=Infinity,maxPenetration=-Infinity;
    const accepts=(q:Triangle)=>{const p=componentOf.get(q.id);return p!==c&&cross2(q.a,q.b,q.c)<-1e-9&&(p?.kind===c.landmark+'-foundation-cap'||p?.kind==='siding-continuous-raised-rail-head');};
    for(const p of lowest){const supporting=mesh.query(p,p,.001).filter(q=>accepts(q)&&projectedInterval(q,p,p));assert.ok(supporting.length,`${c.kind} lowest actual vertex ${p} has no support triangle`);const y=Math.max(...supporting.map(q=>height(q,p[0],p[2]))),gap=p[1]-y;minGap=Math.min(minGap,gap);maxGap=Math.max(maxGap,gap);contacts++;}
    for(const p of vertices)for(const q of mesh.query(p,p,.001))if(accepts(q)&&projectedInterval(q,p,p))maxPenetration=Math.max(maxPenetration,height(q,p[0],p[2])-p[1]);
    if(minGap<-.025||maxGap>1e-6||maxPenetration>.025)errors.push(`${c.kind} lowest gap [${minGap},${maxGap}], maximum penetration ${maxPenetration}`);
    const patch=hullXZ((componentTriangles.get(c)??[]).flatMap(q=>clipPlane([q.a,q.b,q.c],p=>bottom+.025-p[1])));assert.ok(area(patch)>1e-8);const coverage=supportCoverage(patch,(q,p)=>accepts(q)&&p.every(v=>Math.abs(height(q,v[0],v[2])-bottom)<=.025));if(coverage.uncovered>1e-5)errors.push(`${c.kind} actual lower contact patch lacks ${coverage.uncovered}m² support`);intersections+=coverage.intersections;
    for(const body of chassis.filter(p=>p.landmark===c.landmark)){let intrusions=0;for(const p of vertices)if(insideClosedComponent(p,body))intrusions++;if(intrusions)errors.push(`${c.kind} has ${intrusions} actual wheel vertices inside ${body.kind}`);}
    metrics.push({kind:c.kind,bounds,actualLowestVertices:lowest.length,minGap,maxGap,maxPenetration,contactPatchArea:area(patch)});
  }
  const feet=geometry.components.filter(c=>/stone-post-shoe$|continuous-bay-pier$|continuous-side-wall$|continuous-rear-wall$|side-bearing-wall$|window-low-wall$|door-lower-jamb$|siding-platform-seated-sleeper$|bench-continuous-seated-leg$|plow-rack-continuous-pier$|floor-seated-grit-bin$|ground-seated-adjustable-skid$|drawbar-grounded-parking-leg$/.test(c.kind));
  for(const c of feet)intersections+=fullBottomContact(c,p=>p?.kind===c.landmark+'-foundation-cap');assert.ok(feet.length>=50);
  reportMetric('heroFeetAndWheels',{wheels:wheels.length,lowestContacts:contacts,completeFeet:feet.length,fullContactIntersections:intersections,wheelMetrics:metrics,failures:errors.length,examples:errors.slice(0,50)});assertNoFailures(errors,'actual wheel contacts and body clearance');t.diagnostic(JSON.stringify(report.metrics.heroFeetAndWheels));
});

audit('snow continuous piers shelves jambs lintels and support planes have no duplicate outward coplanar skins','structural',t=>{
  const parts=geometry.components.filter(c=>c.landmark&&c.role!=='terrain');const eligible=new Set(parts),triangles=parts.flatMap(c=>componentTriangles.get(c)??[]);let pairs=0,maxOverlap=0;const errors:string[]=[],groups:Record<string,{pairs:number;area:number;exposedArea:number;examples:unknown[]}>= {};const convex=convexCertificates();let buriedPairs=0,rawPairs=0;
  for(const a of triangles)for(const b of mesh.query(a.min,a.max)){
    const owner=componentOf.get(a.id),other=componentOf.get(b.id);if(b.id<=a.id||owner===other||!other||!eligible.has(other)||a.min.some((v,k)=>v>b.max[k]+1e-7)||a.max.some((v,k)=>v<b.min[k]-1e-7))continue;pairs++;const overlap=coincidentOutwardPolygon(a,b);if(!overlap)continue;const rawArea=area3D(overlap.polygon);if(rawArea<=1e-7)continue;rawPairs++;
    let exposed:V[][]=[overlap.polygon.map(p=>p.map((v,k)=>v+overlap.normal[k]*1e-5))];const bounds=boundsOf(exposed[0]),otherOwners=new Set(mesh.query(bounds.min,bounds.max,.001).map(q=>componentOf.get(q.id)));
    for(const solid of otherOwners){if(!solid||solid===owner||solid===other||!convex.has(solid))continue;exposed=exposed.flatMap(p=>subtractConvexSolid(p,convex.get(solid)!));if(!exposed.length)break;}
    const exposedArea=exposed.reduce((n,p)=>n+area3D(p),0);maxOverlap=Math.max(maxOverlap,exposedArea);if(exposedArea>1e-7)errors.push(`${owner?.kind} triangle${a.id}/${other.kind} triangle${b.id} duplicate exposed coplanar area${exposedArea} (raw${rawArea})`);else buriedPairs++;
    const key=[owner?.kind,other.kind].sort().join(' / '),group=groups[key]??{pairs:0,area:0,exposedArea:0,examples:[]};group.pairs++;group.area+=rawArea;group.exposedArea+=exposedArea;if(group.examples.length<2)group.examples.push({a:[a.a,a.b,a.c],b:[b.a,b.b,b.c],rawArea,exposedArea});groups[key]=group;
  }
  const q=triangles[0];assert.ok(coincidentOutwardArea(q,{...q,id:-1})>1e-5);assert.equal(coincidentOutwardArea(q,{...q,id:-2,b:q.c,c:q.b}),0);
  reportMetric('exposedCoplanarConstruction',{components:parts.length,actualTriangles:triangles.length,candidatePairs:pairs,maximumExposedOverlap:maxOverlap,rawPairs,buriedPairs,actualClosedConvexOccluders:convex.size,groups,failures:errors.length,examples:errors});assertNoFailures(errors,'duplicate outward source planes');t.diagnostic(JSON.stringify(report.metrics.exposedCoplanarConstruction));
});

audit('snow hero wheels spokes clock hands blade handles and signs expose actual source surfaces','structural',t=>{
  const kinds=[/actual-wheel$/, /flanged-wheel$/, /open-eight-spoke-wheel$/, /eight-joined-spoke$/, /clock-supported-.*hand$/, /clock-twelve-original-radial-tick$/, /clock-supported-bronze-dial-rim$/, /snowplow-thick-curved-wedge-blade$/, /parcels-cart-push-handle$/, /inspection-trolley-supported-hand-lever$/, /snow-fork-supported-arrow-board$/, /snow-fork-supported-raised-arrow$/];
  const parts=geometry.components.filter(c=>kinds.some(r=>r.test(c.kind)));let rays=0;const errors:string[]=[],spokes=new Map<string,{visible:number;total:number}>();
  for(const c of parts){const bounds=actualBounds.get(c)!;let visible=false;
    for(const q of componentTriangles.get(c)??[]){if(area3D([q.a,q.b,q.c])<1e-8)continue;const target=[0,1,2].map(k=>(q.a[k]+q.b[k]+q.c[k])/3);for(const direction of [[-1,0,0],[1,0,0],[0,0,-1],[0,0,1],[0,1,0],[-1,0,-1],[-1,0,1],[1,0,-1],[1,0,1],[-1,1,0],[1,1,0],[0,1,-1],[0,1,1]]){const eye=target.map((v,k)=>direction[k]<0?bounds.min[k]-5:direction[k]>0?bounds.max[k]+5:v),hit=mesh.firstHit(eye,target);rays++;if(hit&&belongs(hit.triangle,c)){visible=true;break;}}if(visible)break;}
    if(/eight-joined-spoke$/.test(c.kind)){const wheel=geometry.components.find(p=>p.kind===c.kind.replace(/-eight-joined-spoke$/,'')&&actualContact(p,c));assert.ok(wheel);const key=geometry.components.indexOf(wheel).toString(),group=spokes.get(key)??{total:0,visible:0};group.total++;if(visible)group.visible++;spokes.set(key,group);}else if(!visible)errors.push(`${c.kind} at ${JSON.stringify(bounds)} has no external first-hit surface witness`);
  }
  assert.equal(spokes.size,14);for(const [id,q]of spokes){assert.equal(q.total,8);if(q.visible<6)errors.push(`actual wheel component${id} exposes ${q.visible}/8 spokes`);}
  reportMetric('exposedModeledDetails',{details:parts.length,rays,wheelSpokes:Object.fromEntries(spokes),failures:errors.length,examples:errors.slice(0,40),scope:'First-hit source triangle witnesses from external viewpoints, not rendered pixels or universal gameplay visibility'});assertNoFailures(errors,'actual exposed hero details');t.diagnostic(JSON.stringify(report.metrics.exposedModeledDetails));
});

audit('snow complete eight metre shoulder polygons form a single owned road shoulder union and return to actual terrain','structural',t=>{
  const shoulder=mesh.triangles.filter(q=>componentOf.get(q.id)?.kind==='exact-source-shoulder-stitches'),ids=new Set(shoulder.map(q=>q.id));let referencePolygons=0,pairs=0,terrainIntersections=0;const errors:string[]=[],overlapPairs:unknown[]=[];const source=new Map(shoulder.map((q,i)=>[q.id,geometry.shoulderFaces[i]]));
  for(const edge of Object.values(SNOW_COURSE.edges)){const n=Math.ceil(edge.length/1.65);for(let i=0;i<n;i++)for(const side of [-1,1]){const s=i/n*edge.length,next=(i+1)/n*edge.length,a=tuple(edge.sample(s,side*edge.halfWidthAt(s)).p),b=tuple(edge.sample(next,side*edge.halfWidthAt(next)).p),c=tuple(edge.sample(s,side*(edge.halfWidthAt(s)+8)).p),d=tuple(edge.sample(next,side*(edge.halfWidthAt(next)+8)).p);for(const polygon of [[a,c,b],[b,c,d]]){const coverage=supportCoverage(polygon,q=>ids.has(q.id)||roadIds.has(q.id));if(coverage.uncovered>1e-5)errors.push(`${edge.id}:${s} full shoulder polygon lacks ${coverage.uncovered}m² actual road/shoulder union`);referencePolygons++;}}}
  for(const a of shoulder){assert.ok(cross2(a.a,a.b,a.c)<-1e-9);for(const b of mesh.query(a.min,a.max))if(b.id>a.id&&ids.has(b.id)){const overlap=area(clipPolygon([a.a,a.b,a.c],b));if(overlap>1e-7){errors.push(`shoulder ${a.id}/${b.id} double owns ${overlap}m²`);if(overlapPairs.length<100)overlapPairs.push({a:{id:a.id,source:source.get(a.id),vertices:[a.a,a.b,a.c]},b:{id:b.id,source:source.get(b.id),vertices:[b.a,b.b,b.c]},area:overlap});}pairs++;}const coverage=supportCoverage([a.a,a.b,a.c],q=>terrainIds.has(q.id));if(coverage.uncovered>1e-5)errors.push(`shoulder ${a.id} leaves actual connected terrain by ${coverage.uncovered}m²`);terrainIntersections+=coverage.intersections;}
  reportMetric('wholeShoulderUnion',{referencePolygons,actualShoulderTriangles:shoulder.length,candidateOwnershipPairs:pairs,fullTerrainIntersections:terrainIntersections,overlapPairs,failures:errors.length,examples:errors});assertNoFailures(errors,'whole shoulder union');t.diagnostic(JSON.stringify(report.metrics.wholeShoulderUnion));
});

audit('snow coincident split tail merge and lap endpoints keep one whole road shoulder owner','structural',t=>{
  const e=SNOW_COURSE.edges,sites=[{name:'split',edge:e.start,s:e.start.length},{name:'technical common-tail first sample',edge:e.alley,s:e.alley.length-40},{name:'broad common-tail first sample',edge:e.boulevard,s:e.boulevard.length-40},{name:'merge exit',edge:e.finish,s:0},{name:'lap seam',edge:e.start,s:0}],shoulders=new Set(mesh.triangles.filter(q=>componentOf.get(q.id)?.kind==='exact-source-shoulder-stitches').map(q=>q.id));
  const metrics:unknown[]=[];
  for(const site of sites){const f=site.edge.sample(site.s),p=tuple(f.p),n=tuple(f.n),forward=tuple(f.t),at=(x:number,z:number)=>p.map((v,k)=>v+n[k]*x+forward[k]*z),polygon=[at(-17,-.4),at(17,-.4),at(17,.4),at(-17,.4)],coverage=supportCoverage(polygon,q=>roadIds.has(q.id)||shoulders.has(q.id));assert.ok(coverage.uncovered<1e-7,`${site.name} repeated coincident route endpoint loses ${coverage.uncovered}m² union`);
    const bounds=boundsOf(polygon),faces=mesh.query(bounds.min,bounds.max).filter(q=>roadIds.has(q.id)||shoulders.has(q.id));let pairs=0,overlapArea=0;
    for(let i=0;i<faces.length;i++)for(let j=i+1;j<faces.length;j++){let common=clipPolygon(polygon,faces[i]);common=clipPolygon(common,faces[j]);const overlap=area(common);assert.ok(overlap<1e-7,`${site.name} repeated endpoint duplicates ${overlap}m² triangles${faces[i].id}/${faces[j].id}`);overlapArea+=overlap;pairs++;}
    metrics.push({name:site.name,edge:site.edge.id,s:site.s,point:p,completeWidthMetres:34,lengthMetres:.8,uncoveredArea:coverage.uncovered,candidatePairs:pairs,overlapArea});
  }
  reportMetric('coincidentEndpointRegression',{sites:metrics,scope:'Actual emitted ownership at original coincident endpoint coordinates; no production polygon clipping imported'});t.diagnostic(JSON.stringify(report.metrics.coincidentEndpointRegression));
});

audit('independent coplanar burial oracle preserves exposed faces and subtracts complete actual convex overlap','structural',()=>{
  const planes=[{a:[-1,0,0],n:[-1,0,0]},{a:[1,0,0],n:[1,0,0]},{a:[0,-1,0],n:[0,-1,0]},{a:[0,1,0],n:[0,1,0]},{a:[0,0,-1],n:[0,0,-1]},{a:[0,0,1],n:[0,0,1]}];
  const square=(x:number,y:number)=>[[x,y,-.5],[x+1,y,-.5],[x+1,y,.5],[x,y,.5]];
  assert.equal(subtractConvexSolid(square(-.5,0),planes).reduce((n,p)=>n+area3D(p),0),0);
  assert.ok(Math.abs(subtractConvexSolid(square(.5,0),planes).reduce((n,p)=>n+area3D(p),0)-.5)<1e-10);
  assert.ok(Math.abs(subtractConvexSolid(square(-.5,1.00001),planes).reduce((n,p)=>n+area3D(p),0)-1)<1e-10);
});

audit('snow material contours partition every frozen physical terrain face exactly once without changing height or plane normal','structural',t=>{reportMetric('terrainMaterialPartition',verifyTerrainPartition());t.diagnostic(JSON.stringify(report.metrics.terrainMaterialPartition));});
