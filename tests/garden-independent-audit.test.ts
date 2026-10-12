import {gardenOriginalAssemblyIds} from './helpers/garden-enrichment-original-assemblies';
// Independent emitted-geometry audit. These tests use rendered positions/indices,
// never planned volumes, camera height answers, scene-provided road faces or
// claimed component bounds as proof. Source provenance identifies parts only.
import test, {after,type TestContext} from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {GARDEN_COURSE,GARDEN_LANDMARKS,GARDEN_ARBOR,gardenArborPlan} from '../src/maps/garden';
import {buildGardenSceneGeometry} from '../src/garden-scenery';
import {gardenPickupRows} from '../src/land-course-pickups';
import {chaseCamera} from '../src/race-camera';
import {safeLandCamera,cameraMeshCandidateIds,type CameraPoint} from '../src/land-camera';

// The collision oracle below consumes ONLY rendered batch positions/indices.
// It deliberately does not import cameraTerrainHeight, road footprint clipping,
// camera boxes, scene terrainGrid, or roadFaces to prove geometry is unobstructed.
type V=readonly number[];
type Triangle={indexStart?:number;id:number;batch:string;vertices:readonly number[];a:V;b:V;c:V;min:V;max:V};
const auditStage=process.env.GARDEN_AUDIT_STAGE??'all';
const auditDirectory=process.env.GARDEN_AUDIT_DIR??resolve('../land-map-artifacts/garden-audit');
const sourceFiles=['src/game.ts','src/maps/garden.ts','src/garden-scenery.ts','src/land-course-pickups.ts','src/race-camera.ts','src/land-camera.ts','src/land-road-mesh.ts','src/land-mesh-builder.ts','src/land-driving.ts','src/land-routes.ts','src/open-road.ts','tests/garden-independent-audit.test.ts'];
const sourceHashes=()=>Object.fromEntries(sourceFiles.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
const hashesBefore=sourceHashes(),started=Date.now();
const report:{stage:string;startedAt:string;sourceHashesBefore:Record<string,string>;sourceHashesAfter?:Record<string,string>;stable?:boolean;durationSeconds?:number;metrics:Record<string,unknown>;checks:{name:string;status:string;error?:string}[];limitations:string[]}={stage:auditStage,startedAt:new Date().toISOString(),sourceHashesBefore:hashesBefore,metrics:{},checks:[],limitations:['CPU emitted-source geometry audit only; no native game pixels, GPU, or FPS certification','Original blueprint volumes are locating and acceptance inputs only, never actual-mesh proof','3.2m baseline prism is not native six-driver mesh-instance clearance; the separate runtime audit owns that gate']};
function audit(name:string,phase:'structural'|'camera',fn:(t:TestContext)=>void){
  if(auditStage!=='all'&&auditStage!==phase)return;
  test(name,t=>{try{fn(t);report.checks.push({name,status:'passed'});}catch(error){report.checks.push({name,status:'failed',error:String(error)});throw error;}});
}
after(()=>{report.sourceHashesAfter=sourceHashes();report.stable=JSON.stringify(report.sourceHashesAfter)===JSON.stringify(hashesBefore);report.durationSeconds=(Date.now()-started)/1000;report.metrics.resources={maxRSSKiB:process.resourceUsage().maxRSS,heapCapMiB:448,concurrency:1};mkdirSync(auditDirectory,{recursive:true});const serialized=JSON.stringify(report,null,2)+'\n';writeFileSync(resolve(auditDirectory,`${auditStage}-report.json`),serialized);writeFileSync(resolve(auditDirectory,`${report.startedAt.replaceAll(':','-')}-${auditStage}-report.json`),serialized);assert.ok(report.stable,'audited sources changed during this run; result is stale');});
const geometry=buildGardenSceneGeometry(GARDEN_COURSE);
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
terrain=mesh.triangles.filter(t=>/^connected-contour-.*-heightfield$/.test(componentOf.get(t.id)?.kind??''));
for(const t of terrain)terrainIds.add(t.id);
assert.ok(terrain.length,'actual connected planted terrain exists');
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
for(const edge of Object.values(GARDEN_COURSE.edges)){
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

audit('garden emitted geometry has finite indexed data and stays below24 batches120k triangles200k vertices','structural',t=>{
 let vertices=0,triangles=0;assert.equal(geometry.trackId,'garden');
 for(const b of geometry.batches){vertices+=b.positions.length/3;triangles+=b.indices.length/3;assert.equal(b.positions.length%3,0);assert.equal(b.indices.length%3,0);assert.equal(b.uvs.length,b.positions.length/3*2);assert.ok(b.positions.every(Number.isFinite));assert.ok(b.uvs.every(Number.isFinite));assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));}
 assert.ok(geometry.batches.length<=24);assert.ok(vertices<200000);assert.ok(triangles<120000);assert.equal(componentOf.size,triangles);
 for(const c of geometry.components){assert.ok((componentTriangles.get(c)?.length??0)>0);const b=actualBounds.get(c)!;for(let k=0;k<3;k++){assert.ok(Math.abs(b.min[k]-c.min[k])<1e-7);assert.ok(Math.abs(b.max[k]-c.max[k])<1e-7);}}
 reportMetric('mesh',{batches:geometry.batches.length,triangles,vertices,components:geometry.components.length,terrainTriangles:terrain.length});t.diagnostic(JSON.stringify(report.metrics.mesh));
});
audit('garden actual road is positive single-owned and covers the complete independent full-width noncrossing union','structural',t=>{
 let pairs=0,separatedPairs=0,coveragePolygons=0,laneProbes=0,maxHeightError=0;assert.ok(roads.length>3000);
 for(const road of roads){assert.ok(upward(road),`road ${road.id} is nonpositive`);for(const other of mesh.query(road.min,road.max))if(other.id>road.id&&roadIds.has(other.id)){
  const p=clipPolygon([road.a,road.b,road.c],other);if(area(p)<1e-7)continue;assert.fail(`noncrossing Garden road double ownership ${road.id}/${other.id} area${area(p)}`);}pairs++;
 }
 for(const reference of physical){assert.ok(upward(reference),`source fold ${reference.edgeId}:${reference.s}`);const coverage=supportCoverage([reference.a,reference.b,reference.c],(q,p)=>{
  if(!roadIds.has(q.id)||!nearSamePlane(q,reference,p))return false;for(const v of p)maxHeightError=Math.max(maxHeightError,Math.abs(height(q,v[0],v[2])-height(reference,v[0],v[2])));return true;
 });assert.ok(coverage.uncovered<1e-5,`${reference.edgeId}:${reference.s} lacks${coverage.uncovered}m² rendered full width`);coveragePolygons++;}
 for(const edge of Object.values(GARDEN_COURSE.edges))for(let s=0;s<=edge.length;s=Math.min(edge.length,s+1)){
  for(const side of [-1,-.5,0,.5,1]){const p=tuple(edge.sample(s,side*edge.laneLimitAt(s)).p);assert.ok(mesh.query(p,p,.03).some(q=>roadIds.has(q.id)&&projectedInterval(q,p,p)&&Math.abs(height(q,p[0],p[2])-p[1])<.08),`${edge.id}:${s} lane${side} lacks support`);laneProbes++;}if(s===edge.length)break;
 }
 reportMetric('roadUnion',{actualTriangles:roads.length,pairs,separatedPairs,coveragePolygons,laneProbes,maxHeightError});t.diagnostic(JSON.stringify(report.metrics.roadUnion));
});
const orbitCases=Array.from({length:24},(_,i)=>[-.5,0,.5,1.15].map(pitch=>({yaw:-Math.PI+i*Math.PI/12,pitch,rearView:false}))).flat();
// Rear view deliberately overrides all orbit yaws/pitches in the real source;
// one rear pose covers them, while release/toggle transitions are tested below.
const allViews=[...orbitCases,{yaw:0,pitch:0,rearView:true}];
const anchorAt=(frame:ReturnType<typeof GARDEN_COURSE.commonStart.sample>)=>({x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z});
const smoothPose=(a:CameraPoint,b:CameraPoint,dt=1/60)=>{const alpha=1-Math.exp(-dt*8);return{x:a.x+(b.x-a.x)*alpha,y:a.y+(b.y-a.y)*alpha,z:a.z+(b.z-a.z)*alpha};};

audit('garden desired-safe and genuinely interpolated whole booms clear actual mesh by 0.3m on all edges lanes and orbit/rear poses','camera',t=>{
  let poses=0,retractions=0,rawHits=0,failures=0;const examples:string[]=[];
  const inspect=(a:CameraPoint,b:CameraPoint,label:string)=>{const failure=boomFailure(tuple(a),tuple(b),label);if(failure){failures++;if(examples.length<12)examples.push(failure);}};
  for(const edge of Object.values(GARDEN_COURSE.edges)){
    const distances=new Set<number>([0,edge.length]);for(let s=0;s<edge.length;s+=12)distances.add(s);
    for(const s0 of [0,edge.length,...(edge.id==='alley'||edge.id==='boulevard'?[80,110,edge.length-80,edge.length-110]:[])])
      for(let s=Math.max(0,s0-36);s<=Math.min(edge.length,s0+36);s+=3)distances.add(s);
    for(const s0 of (edge.id==='alley'?[...GARDEN_ARBOR.physicalS]:[]))for(let s=Math.max(0,s0-35);s<=Math.min(edge.length,s0+35);s+=2)distances.add(s);
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
audit('every garden pickup has physical mesh-clear approach rays and default framing including both branch approaches','camera',t=>{
  let rays=0;
  for(const pickup of gardenPickupRows(GARDEN_COURSE))for(const ahead of [12,25,40,55])for(const side of [-1,0,1])for(const view of [0,1]){
    const edge=GARDEN_COURSE.edges[pickup.edgeId],s=pickup.s-ahead,frame=edge.sample(s,side*edge.laneLimitAt(s)),anchor=anchorAt(frame),pose=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:false,orbit:{yaw:0,pitch:0}}),camera=safeLandCamera(anchor,pose.position,geometry.cameraObstacles);
    for(const lift of [1.08,1.25,1.42]){
      const target=[pickup.p.x,pickup.p.y+lift,pickup.p.z],hit=mesh.firstHit(tuple(camera),target),label=`${pickup.edgeId}:${pickup.s} itemLane:${pickup.lateral} actorLane:${side} ahead:${ahead} view:${view} bob:${lift}`;
      assert.ok(!hit,`${label}: blocked by actual ${hit?.triangle.batch}/${hit&&componentOf.get(hit.triangle.id)?.kind} triangle ${hit?.triangle.id}`);assertDefaultFrustum(camera,pose.look,target,label);rays++;
    }
  }
  assert.ok(rays>=1440);reportMetric('pickupVisibility',{rays,bobHeights:[1.08,1.25,1.42],approaches:[12,25,40,55],views:2,legalLanes:3,verticalFovDegrees:56,aspect:1280/800});t.diagnostic(`${rays} physical pickup rays at center and both full legal edge lanes, both default views and bob extremes; all rows additionally12/25/40m`);
});

audit('garden camera mesh broadphase covers actual local triangles without unbounded source scans or whole-building boxes','camera',t=>{
  const triangleKey=(points:readonly V[])=>points.map(shapeKey).sort().join('|'),actualKeys=new Set(mesh.triangles.map(t=>triangleKey([t.a,t.b,t.c])));
  const payloads=geometry.cameraObstacles.filter(b=>b.triangles).map(b=>({kind:b.kind,triangles:b.triangles!,bounds:b.triangles!.map(points=>boundsOf(points))}));let totalTriangles=0,queries=0,maxCandidates=0;
  for(const blocker of geometry.cameraObstacles){assert.ok(blocker.triangles||blocker.heightfield,`${blocker.kind} is a broad solid box which may fill real architectural void`);}
  for(const payload of payloads){totalTriangles+=payload.triangles.length;for(const triangle of payload.triangles)assert.ok(actualKeys.has(triangleKey(triangle)),`${payload.kind} camera mesh invents a non-rendered face`);}
  const payloadKeys=new Set(payloads.flatMap(p=>p.triangles.map(triangleKey)));
  let requiredFaces=0,wayfindingFaces=0;
  for(const triangle of mesh.triangles){const component=componentOf.get(triangle.id);if(!component||terrainIds.has(triangle.id)||component.role==='road')continue;requiredFaces++;if(/sign|wayfind|icon|board/.test(component.kind))wayfindingFaces++;assert.ok(payloadKeys.has(triangleKey([triangle.a,triangle.b,triangle.c])),`runtime camera omitted actual ${component.kind} triangle ${triangle.id}`);}
  assert.ok(wayfindingFaces>0,'actual wayfinding boards/posts/icons remain physical camera obstacles');
  reportMetric('runtimeMeshCorrespondence',{requiredFaces,wayfindingFaces,payloadFaces:payloadKeys.size});

  for(const edge of Object.values(GARDEN_COURSE.edges))for(let s=0;s<edge.length;s+=100)for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/2]){
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
  for(const c of geometry.components){const triangles=componentTriangles.get(c)??[];if(triangles.length<4||triangles.length>1024)continue;const edges=new Map<string,number>(),planes:{a:V;n:V}[]=[];
    for(const q of triangles){const p=[q.a,q.b,q.c].map(shapeKey);for(let k=0;k<3;k++){const key=[p[k],p[(k+1)%3]].sort().join('|');edges.set(key,(edges.get(key)??0)+1);}const u=sub(q.b,q.a),v=sub(q.c,q.a),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);if(l>1e-10)planes.push({a:q.a,n:n.map(v=>v/l)});}
    if(![...edges.values()].every(v=>v===2))continue;const points=actualComponentPoints(c);if(planes.every(p=>points.every(q=>dot(p.n,sub(q,p.a))<=1e-7)))result.set(c,planes);
  }return result;
}
function subtractConvexSolid(subject:V[],planes:{a:V;n:V}[]){let inside=subject;const outside:V[][]=[];for(const p of planes){const signed=(q:V)=>-dot(p.n,sub(q,p.a));const fragment=clipPlane(inside,q=>-signed(q));if(area3D(fragment)>1e-10)outside.push(fragment);inside=clipPlane(inside,signed);if(!inside.length)break;}return outside;}
audit('garden shared camera crosses split merge and lap seams both directions with genuinely interpolated rear-toggle poses','camera',t=>{
  const e=GARDEN_COURSE.edges,joins=[[e.start,e.alley],[e.start,e.boulevard],[e.alley,e.finish],[e.boulevard,e.finish],[e.finish,e.start]] as const;let frames=0;
  for(const reverse of [false,true])for(const side of [-1,0,1])for(const view of [0,1])for(const rearMode of [0,1,2])for(const pitch of [-.28,.78])for(const [from,to] of joins){
    let previous:CameraPoint|null=null;
    for(let i=0;i<=80;i++){const offset=(reverse?40-i:i-40)*.8,edge=offset<0?from:to,s=offset<0?from.length+offset:offset,frame=edge.sample(s,side*edge.laneLimitAt(s)),anchor=anchorAt(frame),rearView=rearMode===1||(rearMode===2&&i>=20&&i<50),yaw=Math.PI*Math.sin(i/80*Math.PI*2),raw=chaseCamera({position:frame.p,tangent:frame.t,view,rearView,orbit:{yaw,pitch}}).position,desired=safeLandCamera(anchor,raw,geometry.cameraObstacles),interpolated=previous?smoothPose(previous,desired):desired,final=safeLandCamera(anchor,interpolated,geometry.cameraObstacles);assert.equal(boomFailure(tuple(anchor),tuple(final),`${from.id}>${to.id} reverse:${reverse} lane:${side} view:${view} rearMode:${rearMode} pitch:${pitch} frame:${i}`),null);previous=final;frames++;}
  }
  assert.equal(frames,29160);reportMetric('transitionCameras',{frames,joins:5,directions:2,lanes:3,views:2,rearModes:3,pitches:2,strictMargin:.3});t.diagnostic(JSON.stringify(report.metrics.transitionCameras));
});
audit('garden arbor members leaf collars planters and support planes have no duplicate outward coplanar skins','structural',t=>{
  const parts=geometry.components.filter(c=>(c.landmark||c.kind.startsWith('arbor-'))&&c.role!=='terrain');const eligible=new Set(parts),triangles=parts.flatMap(c=>componentTriangles.get(c)??[]);let pairs=0,maxOverlap=0;const errors:string[]=[],groups:Record<string,{pairs:number;area:number;exposedArea:number;examples:unknown[]}>= {};const convex=convexCertificates();let buriedPairs=0,rawPairs=0;
  for(const a of triangles)for(const b of mesh.query(a.min,a.max)){
    const owner=componentOf.get(a.id),other=componentOf.get(b.id);if(b.id<=a.id||owner===other||!other||!eligible.has(other)||a.min.some((v,k)=>v>b.max[k]+1e-7)||a.max.some((v,k)=>v<b.min[k]-1e-7))continue;pairs++;const overlap=coincidentOutwardPolygon(a,b);if(!overlap)continue;const rawArea=area3D(overlap.polygon);if(rawArea<=1e-7)continue;rawPairs++;
    let exposed:V[][]=[overlap.polygon.map(p=>p.map((v,k)=>v+overlap.normal[k]*1e-5))];const bounds=boundsOf(exposed[0]),otherOwners=new Set(mesh.query(bounds.min,bounds.max,.001).map(q=>componentOf.get(q.id)));
    for(const solid of otherOwners){if(!solid||solid===owner||solid===other||!convex.has(solid))continue;exposed=exposed.flatMap(p=>subtractConvexSolid(p,convex.get(solid)!));if(!exposed.length)break;}
    for(const solid of otherOwners){if(!solid||solid===owner||solid===other||convex.has(solid))continue;exposed=exposed.flatMap(p=>subtractActualClosedSolid(p,solid));if(!exposed.length)break;}
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


audit('garden coincident split common-tail merge and lap endpoints preserve exact whole-neighborhood ownership','structural',t=>{
 const e=GARDEN_COURSE.edges,sites=[{name:'split',edge:e.start,s:e.start.length},{name:'technical common-tail first sample',edge:e.alley,s:e.alley.length-40},{name:'broad common-tail first sample',edge:e.boulevard,s:e.boulevard.length-40},{name:'merge exit',edge:e.finish,s:0},{name:'lap seam',edge:e.start,s:0}];const metrics:unknown[]=[];
 for(const site of sites){const f=site.edge.sample(site.s),p=tuple(f.p),n=tuple(f.n),forward=tuple(f.t),at=(x:number,z:number)=>p.map((v,k)=>v+n[k]*x+forward[k]*z),polygon=[at(-16.4,-.4),at(16.4,-.4),at(16.4,.4),at(-16.4,.4)],result=supportCoverage(polygon,q=>(roadIds.has(q.id)||shoulderIds.has(q.id))&&Math.abs((q.min[1]+q.max[1])/2-p[1])<5);assert.ok(result.uncovered<1e-7,`${site.name} endpoint loses${result.uncovered}m² union`);
  const bounds=boundsOf(polygon),faces=mesh.query(bounds.min,bounds.max).filter(q=>roadIds.has(q.id)||shoulderIds.has(q.id));let pairs=0,total=0;for(let i=0;i<faces.length;i++)for(let j=i+1;j<faces.length;j++){let common=clipPolygon(polygon,faces[i]);common=clipPolygon(common,faces[j]);const overlap=area(common);assert.ok(overlap<1e-7,`${site.name} duplicates${overlap}m² triangles${faces[i].id}/${faces[j].id}`);total+=overlap;pairs++;}metrics.push({name:site.name,fullWidth:32.8,length:.8,uncovered:result.uncovered,pairs,overlapArea:total});
 }reportMetric('coincidentEndpointRegression',{sites:metrics});t.diagnostic(JSON.stringify(report.metrics.coincidentEndpointRegression));
});

audit('independent garden oracle catches exact vertical walls thin terrain peaks and contact margins','structural',()=>{
 const triangle=(a:V,b:V,c:V):Triangle=>({id:-1,batch:'independent oracle fixture',vertices:[],a,b,c,...boundsOf([a,b,c])});
 const road=triangle([0,0,0],[10,0,0],[0,0,10]),wall=triangle([2,-1,2],[2,4,2],[2,4,4]);assert.ok(area3D(prismIntersection(wall,road,.15,3.2))>1);assert.equal(prismIntersection(triangle([20,-1,20],[20,4,20],[20,4,24]),road,.15,3.2).length,0);
 const peak=triangle([4.99,0,-1],[5.02,8,0],[4.99,0,1]),interval=projectedInterval(peak,[0,1,0],[10,1,0]);assert.ok(interval&&interval[0]<.5&&interval[1]>.5);assert.ok(height(peak,5,0)>1);assert.equal(segmentTriangleDistance([0,1,2.5],[4,1,2.5],wall),0);assert.ok(Math.abs(segmentTriangleDistance([2.2,1,2.5],[2.2,3,2.5],wall)-.2)<1e-8);
});


// Route contracts are independently sampled and are never used as spatial
// pavement clipping boundaries. Positive spatial overlaps extend past40m.
audit('garden exact100m level decision40m common tail and five full-width seams match frozen source','structural',t=>{
 const {start,alley,boulevard,finish}=GARDEN_COURSE.edges;let decisions=0,tails=0,seams=0;const end=start.sample(start.length);
 for(let d=0;d<=100;d+=.25)for(const lateral of [-9.5,-4.75,0,4.75,9.5]){const p=start.sample(start.length-d,lateral);assert.ok(Math.abs(p.p.x-(end.p.x-lateral))<1e-9);assert.ok(Math.abs(p.p.y-18)<1e-9);assert.ok(Math.abs(p.p.z-end.p.z-d)<1e-8);assert.equal(p.bank,0);assert.equal(start.halfWidthAt(start.length-d),9.5);decisions++;}
 for(let remaining=0;remaining<=40;remaining+=.125)for(const lateral of [-9.5,-4.75,0,4.75,9.5]){const a=alley.sample(alley.length-remaining,lateral),b=boulevard.sample(boulevard.length-remaining,lateral);assert.ok(a.p.distance(b.p)<1e-9);assert.ok(a.t.distance(b.t)<1e-9);assert.ok(a.n.distance(b.n)<1e-9);assert.ok(a.normal.distance(b.normal)<1e-9);assert.equal(Math.abs(a.bank),0);assert.equal(Math.abs(b.bank),0);assert.equal(alley.halfWidthAt(alley.length-remaining),9.5);tails++;}
 for(const[a,b]of [[start,alley],[start,boulevard],[alley,finish],[boulevard,finish],[finish,start]])for(let l=-9.5;l<=9.5;l+=.125){const p=a.sample(a.length,l),q=b.sample(0,l);assert.ok(p.p.distance(q.p)<1e-7);assert.ok(p.t.distance(q.t)<1e-7);assert.ok(p.n.distance(q.n)<1e-7);seams++;}
 let splitMax=0,mergeMax=0,pairs=0;for(const a of physical.filter(p=>p.edgeId==='alley'))for(const b of physical.filter(p=>p.edgeId==='boulevard')){if(a.min[0]>b.max[0]||a.max[0]<b.min[0]||a.min[2]>b.max[2]||a.max[2]<b.min[2])continue;if(area(clipPolygon([a.a,a.b,a.c],b))<1e-7)continue;pairs++;if(a.s<alley.length/2)splitMax=Math.max(splitMax,a.next,b.next);else mergeMax=Math.max(mergeMax,alley.length-a.s,boulevard.length-b.s);}
 assert.ok(splitMax>0);assert.ok(mergeMax>40,'physical road overlap necessarily extends beyond exact interaction certificate');
 let derivatives=0,maxGrade=0,minForward=Infinity;for(const edge of Object.values(GARDEN_COURSE.edges))for(let s=.25;s<edge.length-.25;s+=.5)for(const side of [-1,0,1]){const a=edge.sample(s-.25,side*edge.halfWidthAt(s-.25)).p,b=edge.sample(s+.25,side*edge.halfWidthAt(s+.25)).p,d=b.clone().sub(a),forward=d.dot(edge.sample(s).t)/.5,grade=Math.abs(d.y)/Math.hypot(d.x,d.z);minForward=Math.min(minForward,forward);maxGrade=Math.max(maxGrade,grade);assert.ok(forward>.68);assert.ok(grade<.09);derivatives++;}
 reportMetric('routeContract',{decisions,tails,seams,splitMax,mergeMax,overlapPairs:pairs,derivatives,maxGrade,minForward});t.diagnostic(JSON.stringify(report.metrics.routeContract));
});

audit('garden complete physical road has connected terrain support and clears actual baseline3.2m body prisms','structural',t=>{
 let groundPairs=0,bodyCandidates=0,minGroundGap=Infinity,maxGroundGap=0;const errors:string[]=[];
 for(const road of roads){const coverage=supportCoverage([road.a,road.b,road.c],(q,p)=>{
  if(!terrainIds.has(q.id))return false;for(const point of p){const gap=height(road,point[0],point[2])-height(q,point[0],point[2]);minGroundGap=Math.min(minGroundGap,gap);maxGroundGap=Math.max(maxGroundGap,gap);if(gap<.15-1e-7||gap>4)errors.push(`road${road.id} terrain${q.id} invalid physical ground gap${gap}`);}return true;
 });if(coverage.uncovered>1e-5)errors.push(`road${road.id} lacks connected ground${coverage.uncovered}`);groundPairs+=coverage.intersections;
 for(const q of mesh.query(road.min,road.max)){if(roadIds.has(q.id)||q.min[1]>road.max[1]+3.2||q.max[1]<road.min[1]+.15)continue;bodyCandidates++;const p=prismIntersection(q,road,.15,3.2);if(p.length>=3&&area3D(p)>1e-7)errors.push(`${kind(q)} triangle${q.id} penetrates road${road.id} baseline kart body:${JSON.stringify(p)}`);}
 }
 reportMetric('physicalSupportAndBaselineBody',{roadsChecked:roads.length,groundPairs,bodyCandidates,minGroundGap,maxGroundGap,failures:errors.length,examples:errors.slice(0,30),scope:'3.2m baseline road prism only. Actual all-six native assembled mesh bounds are a separate runtime-worker gate; this test is not six-driver clearance.'});assertNoFailures(errors,'actual road support/baseline body');t.diagnostic(JSON.stringify(report.metrics.physicalSupportAndBaselineBody));
});

audit('garden complete seven-metre shoulder union is single-owned beyond split tail and lap endpoints','structural',t=>{
 let referencePolygons=0,overlapPairs=0;const errors:string[]=[];assert.ok(shoulderTriangles.length>1000);
 for(const edge of Object.values(GARDEN_COURSE.edges)){const n=Math.ceil(edge.length/1.65);for(let i=0;i<n;i++){const s=i/n*edge.length,next=(i+1)/n*edge.length,y=edge.sample((s+next)/2).p.y;
  for(const side of [-1,1]){const a=tuple(edge.sample(s,side*edge.halfWidthAt(s)).p),b=tuple(edge.sample(next,side*edge.halfWidthAt(next)).p),c=tuple(edge.sample(s,side*(edge.halfWidthAt(s)+7)).p),d=tuple(edge.sample(next,side*(edge.halfWidthAt(next)+7)).p);
   for(const poly of [[a,c,b],[b,c,d]]){const result=supportCoverage(poly,(q,p)=>(roadIds.has(q.id)||shoulderIds.has(q.id))&&p.every(v=>Math.abs(height(q,v[0],v[2])-y)<5));if(result.uncovered>1e-5)errors.push(`${edge.id}:${s} shoulder missing${result.uncovered}m²`);referencePolygons++;}
  }
 }}
 for(const a of shoulderTriangles){assert.ok(upward(a));for(const b of mesh.query(a.min,a.max))if((shoulderIds.has(b.id)&&b.id>a.id)||roadIds.has(b.id)){const p=clipPolygon([a.a,a.b,a.c],b);if(area(p)>1e-7)errors.push(`shoulder${a.id}/${kind(b)}${b.id} double ownership${area(p)}`);overlapPairs++;}}
 reportMetric('completeShoulderUnion',{referencePolygons,actualShoulderTriangles:shoulderTriangles.length,candidateOverlapPairs:overlapPairs,failures:errors.length,examples:errors.slice(0,30)});assertNoFailures(errors,'full shoulder union');t.diagnostic(JSON.stringify(report.metrics.completeShoulderUnion));
});

const arborComponents=geometry.components.filter(c=>c.kind.startsWith('arbor-'));
const arborIds=new Set(arborComponents.flatMap(c=>(componentTriangles.get(c)??[]).map(q=>q.id)));
const arborTriangles=mesh.triangles.filter(q=>arborIds.has(q.id));

audit('garden open opaque arbor has actual full-width22.95m road clearance with no crossing posts','structural',t=>{
 let pairs=0,minimum=Infinity;const errors:string[]=[],byKind:Record<string,{pairs:number;minimum:number}>={};assert.ok(arborTriangles.length>700);
 for(const road of physical)for(const q of mesh.query(road.min,road.max)){
  if(!arborIds.has(q.id))continue;
  if(Math.abs(cross2(q.a,q.b,q.c))<1e-9){if(area3D(prismIntersection(q,road,.15,22.95))>1e-7)errors.push(`upright arbor${q.id} enters full road aperture`);continue;}
  const overlap=clipPolygon([q.a,q.b,q.c],road);if(area(overlap)<1e-8)continue;
  const gap=Math.min(...overlap.map(p=>height(q,p[0],p[2])-height(road,p[0],p[2]))),record=byKind[kind(q)]??={pairs:0,minimum:Infinity};record.pairs++;record.minimum=Math.min(record.minimum,gap);minimum=Math.min(minimum,gap);pairs++;if(gap<22.95-1e-6)errors.push(`${kind(q)} triangle${q.id} road${road.edgeId}:${road.s} gap${gap}`);
 }
 assert.ok(pairs>50);reportMetric('actualArborAperture',{actualArborComponents:arborComponents.length,actualArborTriangles:arborTriangles.length,fullWidthPairs:pairs,minimumClearance:minimum,baselineBodyHeadroom:minimum-3.2,byKind,failures:errors.length,examples:errors.slice(0,25)});assertNoFailures(errors,'actual open arbor aperture');t.diagnostic(JSON.stringify(report.metrics.actualArborAperture));
});

audit('garden actual canopy encloses complete all-lane all-yaw all-pitch orbit capsules independently of angular sampling','camera',t=>{
 const radius=Math.hypot(15,6.9),margin=.45,betweenFrames=.75,spacing=.5,bounds=boundsOf(arborTriangles.flatMap(q=>[q.a,q.b,q.c]));let frames=0,candidates=0,minimum=Infinity,minimumTimber=Infinity,maxAdjacentLaneTravel=0;const memberComponents=new Set(geometry.arbor.members.map(m=>geometry.components[m.component]));const errors:string[]=[],examples:unknown[]=[];
 for(const edge of Object.values(GARDEN_COURSE.edges))for(let s=0;s<=edge.length;s+=spacing){
  const p=tuple(edge.sample(s).p);if(p[0]<bounds.min[0]-55||p[0]>bounds.max[0]+55||p[2]<bounds.min[2]-55||p[2]>bounds.max[2]+55)continue;
  const a=tuple(edge.sample(s,-edge.laneLimitAt(s)).p).map((v,k)=>v+(k===1?1:0)),b=tuple(edge.sample(s,edge.laneLimitAt(s)).p).map((v,k)=>v+(k===1?1:0));
  for(const side of [-1,1]){const ns=Math.min(edge.length,s+spacing),delta=edge.sample(s,side*edge.laneLimitAt(s)).p.distance(edge.sample(ns,side*edge.laneLimitAt(ns)).p);maxAdjacentLaneTravel=Math.max(maxAdjacentLaneTravel,delta);assert.ok(delta<betweenFrames);}
  let local=Infinity,closest=-1;for(const q of mesh.query(a,b,radius+margin+betweenFrames+5))if(arborIds.has(q.id)){const d=segmentTriangleDistance(a,b,q)-radius-margin-betweenFrames;candidates++;if(memberComponents.has(componentOf.get(q.id)!))minimumTimber=Math.min(minimumTimber,d);if(d<local){local=d;closest=q.id;}}
  minimum=Math.min(minimum,local);if(local<0){errors.push(`${edge.id}:${s} orbit capsule hits${closest} by${local}`);if(examples.length<20)examples.push({edge:edge.id,s,closest,margin:local});}frames++;
 }
 assert.ok(frames>100);assert.ok(minimumTimber>=3.949,'preserve frozen timber-only3.959m orbit reserve within0.01m rounding');assert.ok(minimum>0,'complete actual arbor including previously unbuilt feet must clear continuous orbit capsule');
 reportMetric('continuousCanopyOrbit',{frames,candidates,orbitRadius:radius,strictShell:margin,sourceStep:spacing,betweenFrameAllowance:betweenFrames,maxAdjacentLaneTravel,minimumAllArborMargin:minimum,minimumTimberMargin:minimumTimber,plannedTimberOnlyMargin:3.959,failures:errors.length,examples,scope:'Actual arbor members plus ground-adapted footing triangles; separately preserve frozen timber-only reserve. Complete legal-lane capsule contains every shared-view/rear-view yaw and pitch and whole boom at each dense station. Adjacent travel checked against0.75m allowance; not an analytic spline-extrema proof.'});assertNoFailures(errors,'complete actual canopy orbit');t.diagnostic(JSON.stringify(report.metrics.continuousCanopyOrbit));
});

// Long running interpolation uses the source safety anchor1.35m, source orbit
// center1m and the real exponential smoothing, not a fabricated midpoint.
audit('garden arbor approach and exit preserve live30 60 144Hz booms and camera movement through view rear orbit transitions','camera',t=>{
 let runs=0,frames=0,retractions=0,minBoom=Infinity,minMotion=Infinity;const errors:string[]=[];const bounds=boundsOf(arborTriangles.flatMap(q=>[q.a,q.b,q.c]));
 for(const branch of ['alley','boulevard']as const)for(const hz of [30,60,144])for(const side of [-1,0,1]){let previous:CameraPoint|null=null,time=0;runs++;
  for(const edge of [GARDEN_COURSE.edges.start,GARDEN_COURSE.edges[branch],GARDEN_COURSE.edges.finish])for(let s=0;s<edge.length;s+=55/hz){const frame=edge.sample(s,side*edge.laneLimitAt(s)),phase=Math.floor(time*2),anchor=anchorAt(frame),raw=chaseCamera({position:frame.p,tangent:frame.t,view:phase%2,rearView:phase%5===2,orbit:{yaw:(phase%7-3)*Math.PI/3,pitch:[-.5,0,.5,1.15][phase%4]}}).position,desired=safeLandCamera(anchor,raw,geometry.cameraObstacles),old=previous??desired,interpolated=smoothPose(old,desired,1/hz),final=safeLandCamera(anchor,interpolated,geometry.cameraObstacles);
   if(frame.p.x>=bounds.min[0]-55&&frame.p.x<=bounds.max[0]+55&&frame.p.z>=bounds.min[2]-55&&frame.p.z<=bounds.max[2]+55){
    const failure=boomFailure(tuple(anchor),tuple(final),`${branch}:${hz}:${side}:${edge.id}:${s}`);if(failure)errors.push(failure);
    for(const q of mesh.query(tuple(old),tuple(final),.3)){if(q.min[1]>Math.max(old.y,final.y)+.3||q.max[1]<Math.min(old.y,final.y)-.3)continue;const d=segmentTriangleDistance(tuple(old),tuple(final),q);minMotion=Math.min(minMotion,d);if(d<.3-1e-6)errors.push(`camera motion intersects${kind(q)} triangle${q.id} clearance${d}`);}
    for(const q of mesh.query(tuple(anchor),tuple(final),1)){if(q.min[1]>Math.max(anchor.y,final.y)+1||q.max[1]<Math.min(anchor.y,final.y)-1)continue;minBoom=Math.min(minBoom,segmentTriangleDistance(tuple(anchor),tuple(final),q));}
    if(Math.hypot(final.x-interpolated.x,final.y-interpolated.y,final.z-interpolated.z)>.01)retractions++;frames++;
   }previous=final;time+=1/hz;
  }
 }
 reportMetric('liveCanopyTransitions',{runs,frames,hz:[30,60,144],speed:55,minBoom,minMotion,retractions,failures:errors.length,examples:errors.slice(0,20),scope:'Finite real smoothing histories with exact emitted mesh distances; no FPS claim'});assert.equal(runs,18);assert.ok(frames>1000);assertNoFailures(errors,'live canopy transition capsules');t.diagnostic(JSON.stringify(report.metrics.liveCanopyTransitions));
});

// Reconstruct the protected150x125 physical grid from emitted corner coordinates.
// Source metadata may identify a component, but never supplies corner heights.
audit('garden protected37500 baseline faces are connected single-owned and exactly clipped into continuous material contours','structural',t=>{
 const minX=-510,maxX=490,minZ=-730,maxZ=450,nx=150,nz=125,dx=(maxX-minX)/nx,dz=(maxZ-minZ)/nz,grid=new Map<number,V>();
 for(const q of terrain)for(const p of [q.a,q.b,q.c]){const x=Math.round((p[0]-minX)/dx),z=Math.round((p[2]-minZ)/dz);if(x<0||x>nx||z<0||z>nz||Math.abs(p[0]-(minX+x*dx))>1e-7||Math.abs(p[2]-(minZ+z*dz))>1e-7)continue;const id=z*(nx+1)+x,prior=grid.get(id);if(prior)assert.ok(Math.abs(prior[1]-p[1])<1e-8);else grid.set(id,p);}
 assert.equal(grid.size,(nx+1)*(nz+1),'every protected source corner must be emitted');
 const scalar=(p:V)=>p[1]-(13.7+.004*(p[0]+120)+2.4*Math.sin(p[2]*.009)+1.8*Math.sin(p[0]*.012+p[2]*.004));
 const normal=(q:Triangle)=>{const a=sub(q.b,q.a),b=sub(q.c,q.a),n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],l=Math.hypot(...n);return n.map(v=>v/l);};
 const credited=new Map<number,number>();let baselineFaces=0,mixedFaces=0,coveredIntersections=0,ownershipPairs=0,maxAffineError=0,maxNormalError=0,maxUncoveredArea=0,maxOverlapArea=0,totalArea=0;
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const i=z*(nx+1)+x;for(const ids of [[i,i+nx+1,i+1],[i+1,i+nx+1,i+nx+2]]){
  const [a,b,c]=ids.map(i=>grid.get(i)!),baseline:Triangle={id:-1-baselineFaces,batch:'independent protected physical grid',vertices:ids,a,b,c,...boundsOf([a,b,c])},polygon=[a,b,c],parts:{triangle:Triangle;polygon:V[]}[]=[],sc=(p:V):V=>[p[0],scalar(p),p[2]],affineScalar={...baseline,a:sc(a),b:sc(b),c:sc(c)},baseNormal=normal(baseline);let remaining=[polygon];
  for(const q of mesh.query(baseline.min,baseline.max)){
   if(!terrainIds.has(q.id))continue;const overlap=clipPolygon(polygon,q),size=area(overlap);if(size<1e-9)continue;assert.ok(upward(q));
   for(const p of overlap){const error=Math.abs(height(q,p[0],p[2])-height(baseline,p[0],p[2]));maxAffineError=Math.max(maxAffineError,error);assert.ok(error<1e-6,`material triangle${q.id} changes baseline${baselineFaces} by${error}`);const value=height(affineScalar,p[0],p[2]);assert.ok(kind(q)==='connected-contour-meadow-heightfield'?value>=-1e-7:value<=1e-7,`${q.batch} triangle${q.id} crosses interpolated continuous material contour`);}
   const n=normal(q),normalError=Math.hypot(...n.map((v,k)=>v-baseNormal[k]));maxNormalError=Math.max(maxNormalError,normalError);assert.ok(normalError<1e-6,'material clipping changes actual geometric plane normal');
   remaining=remaining.flatMap(p=>subtractTriangleFootprint(p,q));parts.push({triangle:q,polygon:overlap});credited.set(q.id,(credited.get(q.id)??0)+size);coveredIntersections++;
  }
  const missing=remaining.reduce((n,p)=>n+area(p),0);maxUncoveredArea=Math.max(maxUncoveredArea,missing);assert.ok(missing<1e-6,`baseline${baselineFaces} missing${missing}m²`);
  for(let a=0;a<parts.length;a++)for(let b=a+1;b<parts.length;b++){const overlap=area(clipPolygon(parts[a].polygon,parts[b].triangle));maxOverlapArea=Math.max(maxOverlapArea,overlap);assert.ok(overlap<1e-7,`baseline${baselineFaces} double owned by${parts[a].triangle.id}/${parts[b].triangle.id}`);ownershipPairs++;}
  if(Math.min(...polygon.map(scalar))< -1e-7&&Math.max(...polygon.map(scalar))>1e-7){mixedFaces++;assert.equal(new Set(parts.map(p=>kind(p.triangle))).size,2,'both material pieces required at a crossed continuous contour');}
  totalArea+=area(polygon);baselineFaces++;
 }}
 assert.equal(baselineFaces,37500);assert.ok(baselineFaces>=36500);assert.equal(credited.size,terrain.length);assert.ok(mixedFaces>100);
 for(const q of terrain)assert.ok(Math.abs((credited.get(q.id)??0)-area([q.a,q.b,q.c]))<1e-5,`material${q.id} escaped original physical field`);
 const vertices=new Map<string,number>(),edges=new Map<string,{count:number;points:V[]}>(),parent:number[]=[];let minY=Infinity,maxY=-Infinity;
 const root=(i:number):number=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};const vertex=(p:V)=>{const key=shapeKey(p);let id=vertices.get(key);if(id===undefined){id=parent.length;vertices.set(key,id);parent.push(id);}return id;};
 for(const q of terrain){const p=[q.a,q.b,q.c],ids=p.map(vertex);for(let k=0;k<3;k++){parent[root(ids[k])]=root(ids[(k+1)%3]);const key=[ids[k],ids[(k+1)%3]].sort((a,b)=>a-b).join(','),edge=edges.get(key)??{count:0,points:[p[k],p[(k+1)%3]]};edge.count++;edges.set(key,edge);}for(const p0 of p){minY=Math.min(minY,p0[1]);maxY=Math.max(maxY,p0[1]);}}
 assert.equal(new Set(parent.map((_,i)=>root(i))).size,1);let boundaryEdges=0;for(const edge of edges.values()){assert.ok(edge.count<=2,'terrain has nonmanifold duplicate edge');if(edge.count===1){boundaryEdges++;assert.ok([minX,maxX].some(x=>edge.points.every(p=>Math.abs(p[0]-x)<1e-7))||[minZ,maxZ].some(z=>edge.points.every(p=>Math.abs(p[2]-z)<1e-7)),'interior contour T-junction/open seam');}}
 assert.ok(maxY-minY>25,'scene must preserve real graded planted terrain relief');
 reportMetric('terrainMaterialPartition',{baselineFaces,protectedMinimum:36500,baselineVertices:grid.size,emittedTriangles:terrain.length,mixedContourFaces:mixedFaces,gridSHA256:createHash('sha256').update(JSON.stringify([...grid].sort((a,b)=>a[0]-b[0]))).digest('hex'),coveredIntersections,ownershipPairs,maxAffineError,maxNormalError,maxUncoveredArea,maxOverlapArea,totalArea,connectedComponents:1,weldedVertices:vertices.size,boundaryEdges,minY,maxY,scope:'Every actual source plane covered exactly once; contour scalar independently interpolated from true baseline corners, geometric normals preserved. CPU geometry, not rendered shading normals.'});t.diagnostic(JSON.stringify(report.metrics.terrainMaterialPartition));
});

audit('garden camera heightfield exactly represents all clipped emitted ground planes and accounts for separate face payloads','camera',t=>{
 const fields=geometry.cameraObstacles.filter(b=>b.heightfield);assert.equal(fields.length,1);const f=fields[0].heightfield!;assert.equal(f.columns,151);assert.equal(f.rows,126);assert.equal(f.heights.length,151*126);assert.equal(f.minX,-510);assert.equal(f.minZ,-730);
 let samples=0,maxError=0;for(const q of terrain)for(const p of [q.a,q.b,q.c,lerp(q.a,q.b,.37),lerp(q.b,q.c,.61)]){const gx=(p[0]-f.minX)/f.dx,gz=(p[2]-f.minZ)/f.dz,x=Math.min(f.columns-2,Math.max(0,Math.floor(gx))),z=Math.min(f.rows-2,Math.max(0,Math.floor(gz))),u=gx-x,v=gz-z,i=z*f.columns+x,a=f.heights[i],b=f.heights[i+1],c=f.heights[i+f.columns],d=f.heights[i+f.columns+1],y=u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v),error=Math.abs(y-p[1]);maxError=Math.max(maxError,error);assert.ok(error<1e-6,`camera field differs from actual ground${q.id}`);samples++;}
 const triangleKey=(points:readonly V[])=>points.map(shapeKey).sort().join('|'),payloads=geometry.cameraObstacles.filter(b=>b.triangles),keys=new Set(payloads.flatMap(b=>b.triangles!.map(triangleKey))),byRole:Record<string,{emitted:number;payload:number;heightfield:number;excluded:number}>={};let payloadInstances=0;
 for(const blocker of payloads)payloadInstances+=blocker.triangles!.length;
 for(const q of mesh.triangles){const c=componentOf.get(q.id)!,r=byRole[c.role]??={emitted:0,payload:0,heightfield:0,excluded:0};r.emitted++;if(terrainIds.has(q.id))r.heightfield++;else if(keys.has(triangleKey([q.a,q.b,q.c])))r.payload++;else{r.excluded++;assert.equal(c.role,'road',`nonterrain nonroad face${q.id}/${c.kind} omitted from camera`);}}
 reportMetric('cameraGroundParity',{samples,maxError,heightfields:1,heightfieldBaselineFaces:2*(f.columns-1)*(f.rows-1),heightfieldEmittedMaterialFaces:terrain.length,explicitPayloadInstances:payloadInstances,uniquePayloadFaces:keys.size,sourceFaceTotal:mesh.triangles.length,byRole,scope:'Exact emitted triangle parity. Road-only exclusions are reported explicitly and remain included in independent whole-boom oracle.'});t.diagnostic(JSON.stringify(report.metrics.cameraGroundParity));
});

function closedShell(c:Component){
 const triangles=(componentTriangles.get(c)??[]).filter(q=>area3D([q.a,q.b,q.c])>1e-10),edges=new Map<string,{count:number;direction:number}>(),origin=actualBounds.get(c)!.min;let volume=0,down=0;
 for(const q of triangles){const p=[q.a,q.b,q.c].map(shapeKey);if(cross2(q.a,q.b,q.c)>1e-9)down++;for(let k=0;k<3;k++){const x=p[k],y=p[(k+1)%3],key=[x,y].sort().join('|'),v=edges.get(key)??{count:0,direction:0};v.count++;v.direction+=x<y?1:-1;edges.set(key,v);}const x=sub(q.a,origin),y=sub(q.b,origin),z=sub(q.c,origin);volume+=dot(x,[y[1]*z[2]-y[2]*z[1],y[2]*z[0]-y[0]*z[2],y[0]*z[1]-y[1]*z[0]])/6;}
 return{closed:triangles.length>0&&[...edges.values()].every(e=>e.count===2&&e.direction===0),volume,down,triangles:triangles.length,edges:edges.size};
}
let cachedConvex:ReturnType<typeof convexCertificates>|null=null;
function actualAttachment(a:Component,b:Component){
 if(actualContact(a,b,.001))return true;
 cachedConvex??=convexCertificates();const oneInside=(c:Component,inside:Component)=>{const planes=cachedConvex!.get(inside);return !!planes&&actualComponentPoints(c).some(p=>planes.every(q=>dot(q.n,sub(p,q.a))<=1e-7));};
 if(oneInside(a,b)||oneInside(b,a))return true;
 const enclosed=(c:Component,solid:Component)=>{const box=actualBounds.get(solid)!;return actualComponentPoints(c).filter(p=>p.every((v,k)=>v>box.min[k]+1e-7&&v<box.max[k]-1e-7)).some(p=>pointInsideClosed(p,solid));};return enclosed(a,b)||enclosed(b,a);
}
const closedCache=new Map<Component,boolean>();
function pointInsideClosed(p:V,c:Component){
 let closed=closedCache.get(c);if(closed===undefined){closed=closedShell(c).closed;closedCache.set(c,closed);}if(!closed)return false;
 const box=actualBounds.get(c)!,d=Math.hypot(...box.max.map((v,k)=>v-box.min[k]))*3+1;
 return [[1,.371,.529],[.617,1,.419]].every(direction=>{const end=p.map((v,k)=>v+d*direction[k]),hits=(componentTriangles.get(c)??[]).map(q=>hitFraction(q,p,end)).filter((n):n is number=>n!==null).sort((a,b)=>a-b),unique=hits.filter((v,i)=>!i||v-hits[i-1]>1e-7);return unique.length%2===1;});
}
// A nonconvex relieved timber may still physically bury a junction skin.
// Prove that over the WHOLE projected polygon using one true outward exit
// and no other source crossing. No AABB or centroid is a burial certificate.
function subtractActualClosedSolid(subject:V[],c:Component):V[][]{
 let closed=closedCache.get(c);if(closed===undefined){closed=closedShell(c).closed;closedCache.set(c,closed);}if(!closed||subject.length<3)return[subject];
 const u=sub(subject[1],subject[0]),v=sub(subject[2],subject[0]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],drop=n.reduce((best,value,k)=>Math.abs(value)>Math.abs(n[best])?k:best,0),axes=[0,1,2].filter(k=>k!==drop),project=(p:V):V=>[p[axes[0]],p[drop],p[axes[1]]],restore=(p:V):V=>{const q=[0,0,0];q[axes[0]]=p[0];q[drop]=p[1];q[axes[1]]=p[2];return q;},poly=subject.map(project),bounds=boundsOf(poly);
 if(area(poly)<1e-10)return[subject];
 const candidates=(componentTriangles.get(c)??[]).map(q=>{const a=project(q.a),b=project(drop===1?q.b:q.c),d=project(drop===1?q.c:q.b);return{...q,a,b,c:d,...boundsOf([a,b,d])};}).filter(q=>Math.abs(cross2(q.a,q.b,q.c))>1e-9&&q.max[1]>=bounds.min[1]&&q.min[0]<=bounds.max[0]&&q.max[0]>=bounds.min[0]&&q.min[2]<=bounds.max[2]&&q.max[2]>=bounds.min[2]);
 let remaining=[poly];for(const top of candidates.filter(upward)){
  let region=clipPolygon(poly,top);region=clipPlane(region,p=>height(top,p[0],p[2])-p[1]-1e-8);if(area(region)<1e-10)continue;let single=[region];
  for(const other of candidates){if(other===top)continue;const common=clipPolygon(region,other),above=clipPlane(common,p=>height(other,p[0],p[2])-p[1]-1e-8);if(area(above)<1e-10)continue;
   for(let i=1;i<above.length-1;i++){const q:Triangle={id:-1,batch:'additional actual closed-shell ray crossing',vertices:[],a:above[0],b:above[i],c:above[i+1],...boundsOf([above[0],above[i],above[i+1]])};single=single.flatMap(p=>subtractTriangleFootprint(p,q));}
  }
  for(const inside of single)for(let i=1;i<inside.length-1;i++){const q:Triangle={id:-1,batch:'one actual closed-shell exit',vertices:[],a:inside[0],b:inside[i],c:inside[i+1],...boundsOf([inside[0],inside[i],inside[i+1]])};remaining=remaining.flatMap(p=>subtractTriangleFootprint(p,q));}if(!remaining.length)break;
 }return remaining.map(p=>p.map(restore));
}
function fullBottomBearing(c:Component,allowed:(other:Component|undefined,t:Triangle)=>boolean,maxEmbedding=.25){
 const points=actualComponentPoints(c),bottom=actualBounds.get(c)!.min[1],foot=hullXZ(points.filter(p=>p[1]<=bottom+1e-7));assert.ok(area(foot)>1e-8,`${c.kind} needs measurable whole bottom`);
 const result=supportCoverage(foot,(t,p)=>!belongs(t,c)&&upward(t)&&allowed(componentOf.get(t.id),t)&&p.every(q=>{const delta=height(t,q[0],q[2])-bottom;return delta>=-1e-6&&delta<=maxEmbedding+1e-6;}));assert.ok(result.uncovered<1e-5,`${c.kind} misses${result.uncovered}m² of actual full bottom bearing at${bottom}`);return result.intersections;
}

audit('garden every actual arbor footing post tie rafter kingpost web purlin and lattice member bears through a connected mesh chain','structural',t=>{
 const plan=gardenArborPlan(),records=geometry.arbor.members,members=new Map(records.map(m=>[m.id,geometry.components[m.component]])),feet=geometry.arbor.supports.map(f=>geometry.components[f.component]);assert.equal(records.length,plan.members.length);assert.equal(members.size,plan.members.length);assert.equal(feet.length,12);let plannedJunctions=0,physicalContacts=0,groundPairs=0,bottomPairs=0;const errors:string[]=[],details:unknown[]=[];
 for(const member of plan.members){const c=members.get(member.id);assert.ok(c,`missing actual member${member.id}`);assert.ok(c.kind.startsWith('arbor-'));const shell=closedShell(c);assert.ok(shell.closed&&shell.volume>0,`${member.id} is not actual closed outward timber`);const points=actualComponentPoints(c);
  // End rings are measured directly; every nonpost must preserve frozen source
  // member endpoints, axis, thickness and deliberate0.08m joined ends.
  if(member.kind!=='post'){
   const a=tuple(member.a),b=tuple(member.b),d=sub(b,a),l=Math.hypot(...d),axis=d.map(v=>v/l),ref=Math.abs(axis[1])>.95?[1,0,0]:[0,1,0],u0=[axis[1]*ref[2]-axis[2]*ref[1],axis[2]*ref[0]-axis[0]*ref[2],axis[0]*ref[1]-axis[1]*ref[0]],ul=Math.hypot(...u0),u=u0.map(v=>v/ul),v=[axis[1]*u[2]-axis[2]*u[1],axis[2]*u[0]-axis[0]*u[2],axis[0]*u[1]-axis[1]*u[0]];
   const expected=[a.map((n,k)=>n-axis[k]*member.endExtension),b.map((n,k)=>n+axis[k]*member.endExtension)].flatMap(p=>[-1,1].flatMap(i=>[-1,1].map(j=>p.map((n,k)=>n+member.halfWidth*(i*u[k]+j*v[k])))));
   for(const p of expected)assert.ok(points.some(q=>Math.hypot(...sub(p,q))<1e-7),`${member.id} changed frozen actual square-beam corner${p}`);
  }
 }
 const adjacency=new Map<Component,Set<Component>>(Array.from(members.values()).map(c=>[c,new Set()]));
 for(let i=0;i<plan.members.length;i++)for(let j=i+1;j<plan.members.length;j++){
  const a=plan.members[i],b=plan.members[j],ca=members.get(a.id)!,cb=members.get(b.id)!,meets=actualAttachment(ca,cb);if(meets){physicalContacts++;adjacency.get(ca)!.add(cb);adjacency.get(cb)!.add(ca);}
  if(segmentDistanceSquared(tuple(a.a),tuple(a.b),tuple(b.a),tuple(b.b))<1e-8){plannedJunctions++;if(!meets)errors.push(`missing actual planned intersection${a.id}/${b.id}`);}
 }
 const reached=new Set<Component>(),queue:Component[]=[];
 for(const foot of feet){groundPairs+=fullGroundContact(foot);const supported=[...members.values()].filter(c=>actualAttachment(foot,c));assert.equal(supported.length,1,`${foot.kind} must bear exactly its vertical post`);const post=supported[0];assert.match(post.kind,/post/);bottomPairs+=fullBottomBearing(post,q=>q===foot,.35);queue.push(post);}
 while(queue.length){const c=queue.shift()!;if(reached.has(c))continue;reached.add(c);queue.push(...adjacency.get(c)!);}
 assert.equal(reached.size,members.size,'every actual timber part must reach a real grounded footing through actual triangle contacts');
 for(const [id,c]of members)details.push({id,component:geometry.components.indexOf(c),contacts:adjacency.get(c)!.size});
 reportMetric('actualArborBearings',{members:members.size,footings:feet.length,plannedJunctions,physicalContacts,groundIntersections:groundPairs,fullBottomIntersections:bottomPairs,groundConnectedMembers:reached.size,failures:errors.length,examples:errors,details});assertNoFailures(errors,'arbor real member bearings');t.diagnostic(JSON.stringify(report.metrics.actualArborBearings));
});

audit('garden all declared structural attachments are actual touching or penetrating emitted closed solids','structural',t=>{
 const errors:string[]=[];for(const edge of geometry.structuralContacts){const a=geometry.components[edge.first],b=geometry.components[edge.second];if(!a||!b||!joinedAttachment(a,b))errors.push(`${edge.kind}: ${a?.kind}/${b?.kind} has no actual emitted contact`);}
 assert.ok(geometry.structuralContacts.length>100);reportMetric('declaredActualContacts',{contacts:geometry.structuralContacts.length,failures:errors.length,examples:errors});assertNoFailures(errors,'declared actual structural contact');t.diagnostic(JSON.stringify(report.metrics.declaredActualContacts));
});

audit('garden all foundations and planted rails signs and stakes have full-footprint support in every actual terrain plane','structural',t=>{
 const foundations=geometry.components.filter(c=>c.kind.endsWith('-whole-footprint-foundation'));let intersections=0;assert.ok(foundations.length>=17);for(const c of foundations)intersections+=fullGroundContact(c);
 const planted=geometry.groundedDetails.map(d=>geometry.components[d.component]);assert.ok(planted.length>100);assert.equal(new Set(planted).size,planted.length);for(const c of planted)intersections+=fullGroundContact(c);
 reportMetric('fullFootprintTerrainContacts',{foundations:foundations.length,groundedDetails:planted.length,actualTerrainIntersections:intersections,scope:'Actual full convex footprint clipped against every intersected emitted terrain triangle, all intersection extrema checked; no center-only grounding'});t.diagnostic(JSON.stringify(report.metrics.fullFootprintTerrainContacts));
});

function triangleDistanceXZ(t:Triangle,p:V){
 if(projectedInterval(t,p,p))return 0;const points=[t.a,t.b,t.c];return Math.min(...points.map((a,i)=>{const b=points[(i+1)%3],x=b[0]-a[0],z=b[2]-a[2],u=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[2]-a[2])*z)/(x*x+z*z)));return Math.hypot(p[0]-a[0]-u*x,p[2]-a[2]-u*z);}));
}
function frustumRay(eye:V,look:V,u:number,v:number,length=900):V{
 const forward=sub(look,eye),fl=Math.hypot(...forward),f=forward.map(x=>x/fl),right=[-f[2],0,f[0]],rl=Math.hypot(...right),r=right.map(x=>x/rl),up=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]],tan=Math.tan(28*Math.PI/180),direction=f.map((x,i)=>x+r[i]*u*tan*16/10+up[i]*v*tan),dl=Math.hypot(...direction);return eye.map((x,i)=>x+length*direction[i]/dl);
}
const reviewFractions=[['start',.13],['start',.31],['start',.54],['start',.75],['start',.96],['alley',.43],['boulevard',.43],['finish',.36],['finish',.78]]as const;
audit('garden frozen nine driver and shared-chase source poses genuinely see connected graded terrain','structural',t=>{
 let rays=0;const details:unknown[]=[];
 for(const[edgeId,fraction]of reviewFractions){const edge=GARDEN_COURSE.edges[edgeId],s=edge.length*fraction,frame=edge.sample(s),anchor=anchorAt(frame),forward=edge.sample(s+32),poses:[string,V,V][]=[['driver',[frame.p.x,frame.p.y+1.6,frame.p.z],[forward.p.x,forward.p.y+1.6,forward.p.z]]];
  for(const view of [0,1]){const p=chaseCamera({position:frame.p,tangent:frame.t,view,rearView:false,orbit:{yaw:0,pitch:0}}),camera=safeLandCamera(anchor,p.position,geometry.cameraObstacles);assert.equal(boomFailure(tuple(anchor),tuple(camera),`review${edgeId}:${s}/${view}`),null);poses.push([`chase${view}`,tuple(camera),tuple(p.look)]);}
  for(const[view,eye,look]of poses){let terrainHits=0,elevated=0,roadHits=0,structureHits=0;for(const v of [-1,-.8,-.6,-.4,-.2,-.1,-.04,0,.04,.1,.2,.4,.6,.8,1])for(let column=0;column<13;column++){const end=frustumRay(eye,look,(column-6)/6,v),hit=mesh.firstHit(eye,end);rays++;if(!hit)continue;if(terrainIds.has(hit.triangle.id)){terrainHits++;if(lerp(eye,end,hit.fraction)[1]>eye[1]+.5)elevated++;}else if(roadIds.has(hit.triangle.id))roadHits++;else structureHits++;}assert.ok(terrainHits>3,`${edgeId}:${s}/${view} shows no actual connected landform`);details.push({edgeId,s,view,eye,look,terrainHits,elevated,roadHits,structureHits});}
 }
 reportMetric('sourceReviewRays',{poses:details.length,rays,details,scope:'Numerical actual-source frustum first-hit samples from frozen review fractions; not native game pixels'});t.diagnostic(JSON.stringify(report.metrics.sourceReviewRays));
});

audit('garden five original heroes fit planned cylinders and are actual first-hit surfaces from physical source driver poses','structural',t=>{
 let vertices=0,rays=0;const details:unknown[]=[];assert.equal(geometry.landmarks.length,5);
 for(const landmark of geometry.landmarks){const plot=GARDEN_LANDMARKS.plots.find(p=>p.id===landmark.kind);assert.ok(plot);const parts=geometry.components.filter(c=>c.landmark===plot.id);assert.ok(parts.length>5);
  for(const road of roads)assert.ok(triangleDistanceXZ(road,[plot.x,0,plot.z])>=plot.radius+20,`${plot.id} reserved footprint enters road/camera tube`);
  for(const c of parts)for(const q of actualComponentPoints(c)){assert.ok(Math.hypot(q[0]-plot.x,q[2]-plot.z)<=plot.radius+1e-6,`${plot.id}/${c.kind} escapes authored footprint:${q}`);assert.ok(q[1]<=landmark.position[1]+plot.height+1e-6,`${plot.id}/${c.kind} escapes authored height`);vertices++;}
 }
 for(const line of geometry.sightlines){const hit=mesh.firstHit(line.eye,line.target);assert.ok(hit,`${line.name} points into empty space`);assert.equal(componentOf.get(hit.triangle.id)?.landmark,line.targetId,`${line.name} first hits${kind(hit.triangle)} triangle${hit.triangle.id}`);rays++;details.push({source:'production authored exact sightline',name:line.name,targetId:line.targetId,eye:line.eye,target:line.target,firstHit:hit.triangle.id});}
 for(const[edgeId,fraction,id]of [['start',.15,'foldleaf-fan'],['start',.53,'radial-petal-court'],['boulevard',.43,'terrace-seed-library'],['alley',.43,'spiral-frond-court'],['finish',.28,'crown-bloom-terrace']]as const){const edge=GARDEN_COURSE.edges[edgeId],s=edge.length*fraction,f=edge.sample(s),eye=[f.p.x,f.p.y+1.6,f.p.z],parts=mesh.triangles.filter(q=>componentOf.get(q.id)?.landmark===id&&!/foundation|planter|soil/.test(kind(q)));let found:{triangle:number;target:V;hit:number}|null=null;
  for(const q of parts){const target=[0,1,2].map(k=>(q.a[k]+q.b[k]+q.c[k])/3),hit=mesh.firstHit(eye,target);rays++;if(hit&&componentOf.get(hit.triangle.id)?.landmark===id){found={triangle:q.id,target,hit:hit.triangle.id};break;}}
  assert.ok(found,`${id} is completely hidden from frozen source eye${eye}`);details.push({source:'frozen design physical driver pose',edgeId,s,fraction,id,eye,...found});
 }
 reportMetric('actualHeroReveals',{heroes:geometry.landmarks.length,vertices,rays,details,scope:'First-hit actual emitted surfaces and road gap. Directional visibility is not a full rendered silhouette or pixel claim; default-frustum field samples reported separately.'});t.diagnostic(JSON.stringify(report.metrics.actualHeroReveals));
});

audit('garden source-derived camera queries have measured bounded spatial candidates and sampled CPU costs','camera',t=>{
 const timings:number[]=[],candidates:number[]=[];const payloads=geometry.cameraObstacles.filter(b=>b.triangles).map(b=>b.triangles!);
 for(const edge of Object.values(GARDEN_COURSE.edges))for(let s=0;s<edge.length;s+=38)for(const side of [-1,0,1])for(const view of [0,1]){
  const f=edge.sample(s,side*edge.laneLimitAt(s)),anchor=anchorAt(f),raw=chaseCamera({position:f.p,tangent:f.t,view,rearView:false,orbit:{yaw:s*.021,pitch:-.5}}).position,count=payloads.reduce((n,p)=>n+cameraMeshCandidateIds(p,anchor,raw).length,0);candidates.push(count);const begin=process.hrtime.bigint();safeLandCamera(anchor,raw,geometry.cameraObstacles);timings.push(Number(process.hrtime.bigint()-begin)/1e6);
 }
 const summarize=(values:number[])=>{const v=[...values].sort((a,b)=>a-b);return{min:v[0],median:v[Math.floor(v.length*.5)],p95:v[Math.floor(v.length*.95)],max:v.at(-1),mean:v.reduce((n,x)=>n+x,0)/v.length};};
 reportMetric('sampledCameraCpuCost',{samples:timings.length,localCandidateCounts:summarize(candidates),safeCameraMilliseconds:summarize(timings),scope:'Read-only sampled CPU source queries in this process with warm shared spatial indexes. No universal worst-case, GPU frame time, gameplay FPS or browser performance claim.'});assert.ok(timings.length>400);t.diagnostic(JSON.stringify(report.metrics.sampledCameraCpuCost));
});

type ActualAssembly={id:string;components:Component[];triangles:Triangle[];points:V[];min:V;max:V};
const assembled:ActualAssembly[]=geometry.assemblies.map(a=>{const parts=a.components.map(i=>geometry.components[i]);assert.ok(parts.every(Boolean));const triangles=parts.flatMap(c=>componentTriangles.get(c)??[]),points=triangles.flatMap(q=>[q.a,q.b,q.c]);return{id:a.id,components:parts,triangles,points,...boundsOf(points)};});
const assemblyOf=new Map<Component,ActualAssembly>();for(const a of assembled)for(const c of a.components){assert.ok(!assemblyOf.has(c));assemblyOf.set(c,a);}
function joinedParts(c:Component){return assemblyOf.get(c)?.components??[c];}
function joinedAttachment(a:Component,b:Component){return joinedParts(a).some(c=>joinedParts(b).some(d=>c!==d&&actualAttachment(c,d)));}

audit('garden every modeled leaf petal and seed section is a single closed thick outward shell with coherent material edges','structural',t=>{
 let triangles=0,minThickness=Infinity,maxThickness=0;const details:unknown[]=[],originalIds=gardenOriginalAssemblyIds(geometry),originalAssembled=assembled.filter(a=>originalIds.has(a.id));assert.equal(originalAssembled.filter(a=>a.components[0].landmark).length,78,'3foldleaf+7court+2seed+54leaflets+12crown authored hero shells');assert.equal(originalAssembled.filter(a=>!a.components[0].landmark).length,40,'ten sparse four-leaf accents');
 for(const a of assembled){const edges=new Map<string,{count:number;direction:number}>(),vertices=new Map<string,number>(),parent:number[]=[];let volume=0;
  const root=(i:number):number=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;},vertex=(p:V)=>{const key=shapeKey(p);let id=vertices.get(key);if(id===undefined){id=parent.length;vertices.set(key,id);parent.push(id);}return id;};
  for(const q of a.triangles){assert.ok(area3D([q.a,q.b,q.c])>1e-10,`${a.id} degenerate triangle${q.id}`);const p=[q.a,q.b,q.c].map(shapeKey),ids=[q.a,q.b,q.c].map(vertex);for(let k=0;k<3;k++){const x=p[k],y=p[(k+1)%3],key=[x,y].sort().join('|'),v=edges.get(key)??{count:0,direction:0};v.count++;v.direction+=x<y?1:-1;edges.set(key,v);parent[root(ids[k])]=root(ids[(k+1)%3]);}const x=sub(q.a,a.min),y=sub(q.b,a.min),z=sub(q.c,a.min);volume+=dot(x,[y[1]*z[2]-y[2]*z[1],y[2]*z[0]-y[0]*z[2],y[0]*z[1]-y[1]*z[0]])/6;}
  assert.ok([...edges.values()].every(v=>v.count===2&&v.direction===0),`${a.id} open nonmanifold or inconsistently wound material perimeter`);assert.equal(new Set(parent.map((_,i)=>root(i))).size,1,`${a.id} disconnected shell pieces`);assert.ok(volume>.01,`${a.id} nonpositive or zero-thickness volume${volume}`);
  const upper=a.components.find(c=>c.kind.endsWith('-joined-upper-surface')),lower=a.components.find(c=>c.kind.endsWith('-joined-lower-surface'));assert.ok(upper&&lower);const u=actualComponentPoints(upper),l=actualComponentPoints(lower);assert.equal(u.length,l.length);let localMin=Infinity,localMax=0;
  for(let i=0;i<u.length;i++){const thickness=Math.hypot(...sub(u[i],l[i]));minThickness=Math.min(minThickness,thickness);maxThickness=Math.max(maxThickness,thickness);localMin=Math.min(localMin,thickness);localMax=Math.max(localMax,thickness);assert.ok(thickness>=.119999&&thickness<=.180001,`${a.id} nonphysical skin thickness${thickness}`);}
  assert.ok(Math.max(...a.max.map((v,k)=>v-a.min[k]))>1);triangles+=a.triangles.length;details.push({id:a.id,triangles:a.triangles.length,volume,closedEdges:edges.size,thickness:[localMin,localMax]});
 }
 reportMetric('closedBotanicalShells',{assemblies:assembled.length,triangles,minThickness,maxThickness,details});t.diagnostic(JSON.stringify(report.metrics.closedBotanicalShells));
});

audit('garden five botanical heroes have actual blade midrib petiole calyx stem soil and fully seated planter bearing chains','structural',t=>{
 let contacts=0,bottomIntersections=0;const errors:string[]=[],details:unknown[]=[];
 const requirements:[RegExp,RegExp,number][]=[
  [/^foldleaf-root-crown$/,/^foldleaf-fan-continuous-planted-soil$/,1],
  [/^foldleaf-\d+-continuous-curved-petiole$/,/^foldleaf-root-crown$/,1],
  [/^foldleaf-\d+-joined-upper-surface$/,/^foldleaf-\d+-continuous-curved-petiole$/,1],
  [/^foldleaf-\d+-continuous-raised-midrib$/,/^foldleaf-\d+-(continuous-curved-petiole|joined-upper-surface)$/,2],
  [/^petal-court-grounded-stalk$/,/^radial-petal-court-continuous-planted-soil$/,1],
  [/^petal-court-radial-calyx-arm-\d+$/,/^petal-court-(grounded-stalk|open-central-collar)$/,2],
  [/^petal-court-petal-\d+-joined-upper-surface$/,/^petal-court-open-central-collar$/,1],
  [/^petal-court-petal-\d+-joined-center-vein$/,/^petal-court-petal-\d+-joined-upper-surface$/,1],
  [/^petal-court-offset-seed-stalk$/,/^radial-petal-court-continuous-planted-soil$/,1],
  [/^petal-court-offset-sculpted-seedpod$/,/^petal-court-offset-seed-stalk$/,1],
  [/^offset-seedpod-attached-longitudinal-rib$/,/^petal-court-offset-sculpted-seedpod$/,1],
  [/^seed-library-bench-grounded-leg$/,/^terrace-seed-library-whole-footprint-foundation$/,1],
  [/^seed-library-bearing-bench$/,/^seed-library-bench-grounded-leg$/,2],
  [/^seed-library-seated-specimen-tray$/,/^seed-library-bearing-bench$/,1],
  [/^seed-library-grounded-specimen-seed$/,/^seed-library-seated-specimen-tray$/,1],
  [/^seed-section-display-grounded-seat$/,/^terrace-seed-library-whole-footprint-foundation$/,1],
  [/^seed-section-thick-original-almond-joined-upper-surface$/,/^seed-section-display-grounded-seat$/,1],
  [/^seed-section-attached-heartwood-joined-upper-surface$/,/^seed-section-thick-original-almond-joined-upper-surface$/,1],
  [/^seed-section-modeled-embryo-relief$/,/^seed-section-attached-heartwood-joined-upper-surface$/,1],
  [/^seed-section-visible-bearing-brace$/,/^seed-(section-display-grounded-seat|section-thick-original-almond-joined-upper-surface)$/,2],
  [/^frond-grounded-radial-root-crown$/,/^spiral-frond-court-continuous-planted-soil$/,1],
  [/^frond-\d+-continuous-curled-rachis$/,/^frond-grounded-radial-root-crown$/,1],
  [/^frond-\d+-joined-leaflet-\d+--?1-joined-upper-surface$/,/^frond-\d+-continuous-curled-rachis$/,1],
  [/^crown-bloom-buttressed-root-seat$/,/^crown-bloom-terrace-continuous-planted-soil$/,1],
  [/^crown-bloom-continuous-thick-stalk$/,/^crown-bloom-buttressed-root-seat$/,1],
  [/^crown-root-real-buttress-\d+$/,/^crown-bloom-(terrace-continuous-planted-soil|buttressed-root-seat|continuous-thick-stalk)$/,3],
  [/^crown-bloom-bearing-calyx$/,/^crown-bloom-continuous-thick-stalk$/,1],
  [/^crown-bloom-two-whorl-receptacle$/,/^crown-bloom-bearing-calyx$/,1],
  [/^crown-whorl-\d+-petal-\d+-joined-upper-surface$/,/^crown-bloom-two-whorl-receptacle$/,1],
  [/^crown-whorl-\d+-petal-\d+-attached-vein$/,/^crown-whorl-\d+-petal-\d+-joined-upper-surface$/,1],
  [/-soil-seated-label-stake$/,/continuous-planted-soil$|^seed-library-crescent-soil-/,1],
  [/-attached-label-board$/,/-soil-seated-label-stake$/,2],
  [/-bearing-label-brace$/,/-(attached-label-board|soil-seated-label-stake)$/,2],
  [/-original-specimen-glyph$/,/-attached-label-board$/,1],
 ];
 for(const[pattern,target,min]of requirements){const sources=geometry.components.filter(c=>pattern.test(c.kind)),targets=geometry.components.filter(c=>target.test(c.kind));if(!sources.length)errors.push(`missing required botanical construction${pattern}`);for(const c of sources){const hits=targets.filter(q=>q!==c&&q.landmark===c.landmark&&joinedAttachment(c,q));if(hits.length<min)errors.push(`${c.kind} touches${hits.length}<${min} actual supports${target}`);contacts+=hits.length;details.push({kind:c.kind,component:geometry.components.indexOf(c),supports:hits.map(q=>geometry.components.indexOf(q))});}}
 const feet=geometry.components.filter(c=>/-continuous-(stone-rim|planted-soil)$/.test(c.kind)||/^seed-library-(crescent-stone-bed-\d+|bench-grounded-leg)$/.test(c.kind)||c.kind==='seed-section-display-grounded-seat');
 for(const c of feet){try{bottomIntersections+=fullBottomBearing(c,q=>q?.kind===c.landmark+'-whole-footprint-foundation',.051);}catch(error){errors.push(String(error));}}
 reportMetric('botanicalBearingChains',{requirements:requirements.length,actualContacts:contacts,wholeBottomFeet:feet.length,wholeBottomIntersections:bottomIntersections,failures:errors.length,examples:errors,details});assertNoFailures(errors,'botanical actual bearing chains');t.diagnostic(JSON.stringify(report.metrics.botanicalBearingChains));
});

audit('garden opaque lattice has real open air between emitted roof members and actual timber first hits','structural',t=>{
 const edge=GARDEN_COURSE.edges.alley;let gaps=0,timber=0;const witnesses:unknown[]=[];
 for(let s=GARDEN_ARBOR.physicalS[0]+.5;s<GARDEN_ARBOR.physicalS[1]-.5;s+=1)for(let lateral=-edge.laneLimitAt(s);lateral<=edge.laneLimitAt(s);lateral+=.5){const p=edge.sample(s,lateral).p,a=[p.x,p.y+3.2,p.z],b=[p.x,p.y+38,p.z],hit=mesh.firstHit(a,b);if(hit){assert.ok(arborIds.has(hit.triangle.id),`nonarbor roof fills canopy opening:${kind(hit.triangle)}`);timber++;}else{gaps++;if(witnesses.length<8)witnesses.push({s,lateral,from:a,to:b});}}
 assert.ok(timber>0);assert.ok(gaps>timber,'open lattice retains more real aperture than projected timber roof');reportMetric('literalArborVoids',{clearVerticalRays:gaps,opaqueTimberFirstHits:timber,witnesses,scope:'Actual mesh vertical rays through complete road width; no transparency or filled-canopy bounding box'});t.diagnostic(JSON.stringify(report.metrics.literalArborVoids));
});

audit('garden entire stem crown specimen and label feet penetrate real soil or bearing seats without floating edges','structural',t=>{
 const patterns:[RegExp,RegExp,number][]=[
  [/^(foldleaf-root-crown|petal-court-grounded-stalk|petal-court-offset-seed-stalk|frond-grounded-radial-root-crown|crown-bloom-buttressed-root-seat)$/,/continuous-planted-soil$/,.251],
  [/^seed-library-grounded-specimen-seed$/,/^seed-library-seated-specimen-tray$/,.051],
  [/-soil-seated-label-stake$/,/continuous-planted-soil$|^seed-library-crescent-(soil|stone-bed)-/,.151],
 ];let feet=0,intersections=0;const errors:string[]=[];
 for(const[pattern,support,maxEmbed]of patterns)for(const c of geometry.components.filter(c=>pattern.test(c.kind))){try{intersections+=fullBottomBearing(c,q=>!!q&&q.landmark===c.landmark&&support.test(q.kind),maxEmbed);}catch(error){errors.push(String(error));}feet++;}
 assert.ok(feet>=20);reportMetric('wholeBotanicalFeet',{feet,intersections,failures:errors.length,examples:errors});assertNoFailures(errors,'whole planted stem and stake feet');t.diagnostic(JSON.stringify(report.metrics.wholeBotanicalFeet));
});

audit('garden actual outboard rails preserve at least3.25m beyond the complete rendered road union','structural',t=>{
 const rails=mesh.triangles.filter(q=>componentOf.get(q.id)?.role==='rail');let candidates=0,minimum=Infinity;const errors:string[]=[];
 const flat=(p:V):V=>[p[0],0,p[2]],distance=(a:Triangle,b:Triangle)=>{const av=[a.a,a.b,a.c].map(flat),bv=[b.a,b.b,b.c].map(flat);if(projectedInterval(b,av[0],av[0])||projectedInterval(a,bv[0],bv[0]))return 0;let d=Infinity;for(let i=0;i<3;i++)for(let j=0;j<3;j++)d=Math.min(d,segmentDistanceSquared(av[i],av[(i+1)%3],bv[j],bv[(j+1)%3]));return Math.sqrt(d);};
 for(const q of rails)for(const road of mesh.query(q.min,q.max,5))if(roadIds.has(road.id)){const gap=distance(q,road);minimum=Math.min(minimum,gap);candidates++;if(gap<3.25-1e-6)errors.push(`${kind(q)} triangle${q.id} only${gap}m beyond road${road.id}`);}
 assert.ok(rails.length>100&&candidates>100);reportMetric('actualRailReservation',{railFaces:rails.length,roadPairs:candidates,minimumPlanarGap:minimum,requiredRoadEdgeGap:3.25,failures:errors.length,examples:errors.slice(0,20),scope:'Actual emitted rail/post faces versus full physical road union. Preserves planned lateral reservation; six native authored assemblies verified separately.'});assertNoFailures(errors,'actual outboard rail reservation');t.diagnostic(JSON.stringify(report.metrics.actualRailReservation));
});

audit('garden actual closed scenic solids cannot silently contain a complete legal road body prism','structural',t=>{
 const solids=geometry.components.filter(c=>closedShell(c).closed).map(c=>({component:c,triangles:componentTriangles.get(c)!,...actualBounds.get(c)!}));let representatives=0;
 for(const road of roads){const point=[0,1,2].map(k=>(road.a[k]+road.b[k]+road.c[k])/3);point[1]+=1.675;
  for(const solid of solids){if(point.some((v,k)=>v<=solid.min[k]+1e-6||v>=solid.max[k]-1e-6))continue;const d=Math.hypot(...solid.max.map((v,k)=>v-solid.min[k]))*3+1,end=[point[0]+d,point[1]+d*.371,point[2]+d*.529],hits=solid.triangles.map(q=>hitFraction(q,point,end)).filter((n):n is number=>n!==null).sort((a,b)=>a-b),unique=hits.filter((v,i)=>!i||v-hits[i-1]>1e-7);assert.equal(unique.length%2,0,`road${road.id} is inside actual closed${solid.component.kind}`);}representatives++;
 }
 assert.ok(solids.length>100);reportMetric('closedBodyContainment',{closedSolids:solids.length,bodyRepresentatives:representatives,scope:'Actual closed shell parity supplements every full-width3.2m triangle prism. Not all-six native racer clearance.'});t.diagnostic(JSON.stringify(report.metrics.closedBodyContainment));
});

audit('garden modeled soil specimen boards veins braces and embryo remain externally exposed actual surfaces','structural',t=>{
 const parts=geometry.components.filter(c=>/^seed-library-crescent-soil-/.test(c.kind)||/(attached-label-board|original-specimen-glyph|bearing-label-brace|modeled-embryo-relief|continuous-raised-midrib|joined-center-vein|attached-vein)$/.test(c.kind));assert.ok(parts.length>50);let rays=0;const errors:string[]=[];
 for(const c of parts){const bounds=actualBounds.get(c)!;let visible=false;for(const q of componentTriangles.get(c)??[]){if(area3D([q.a,q.b,q.c])<1e-9)continue;const target=[0,1,2].map(k=>(q.a[k]+q.b[k]+q.c[k])/3);for(const d of [[-1,0,0],[1,0,0],[0,0,-1],[0,0,1],[0,1,0],[-1,0,-1],[-1,0,1],[1,0,-1],[1,0,1],[-1,1,0],[1,1,0],[0,1,-1],[0,1,1]]){const eye=target.map((v,k)=>d[k]<0?bounds.min[k]-5:d[k]>0?bounds.max[k]+5:v),hit=mesh.firstHit(eye,target);rays++;if(hit&&belongs(hit.triangle,c)){visible=true;break;}}if(visible)break;}if(!visible)errors.push(`${c.kind} has no actual external first-hit surface at${JSON.stringify(bounds)}`);}
 reportMetric('externalBotanicalDetails',{parts:parts.length,rays,failures:errors.length,examples:errors,scope:'Conservative emitted-face first-hit witnesses; no pixel claim'});assertNoFailures(errors,'externally exposed modeled botanical details');t.diagnostic(JSON.stringify(report.metrics.externalBotanicalDetails));
});

audit('garden closed-shell burial oracle preserves outside faces and proves complete interior patches on all three axes','structural',()=>{
 const c=geometry.components.find(c=>c.kind==='arbor-frame0-tie')!,bounds=actualBounds.get(c)!,center=bounds.min.map((v,k)=>(v+bounds.max[k])/2);assert.ok(pointInsideClosed(center,c),'real tie center must be inside its emitted closed shell');
 for(const drop of [0,1,2]){const axes=[0,1,2].filter(k=>k!==drop),patch=(base:V)=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>base.map((v,k)=>v+(k===axes[0]?a*.002:k===axes[1]?b*.002:0))),inside=patch(center),outside=patch(bounds.max.map(v=>v+1));
  assert.ok(subtractActualClosedSolid(inside,c).reduce((n,p)=>n+area3D(p),0)<1e-10,`full inside patch not certified on axis${drop}`);assert.ok(Math.abs(subtractActualClosedSolid(outside,c).reduce((n,p)=>n+area3D(p),0)-area3D(outside))<1e-10,`outside face wrongly buried on axis${drop}`);
 }
});
