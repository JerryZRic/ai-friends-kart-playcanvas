/** Independent scene audit: every physical oracle consumes emitted positions and indices. */
import test,{after,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {MOUNTAIN_TRACK as track} from '../src/maps/mountain';
import {mountainSupportWitnesses,mountainPierContract} from './helpers/mountain-baseline-contract';
import {getAlpineProp} from '../src/alpine-props';
import {buildMountainSceneGeometry} from '../src/mountain-scenery';
import {chaseCamera} from '../src/race-camera';
import {safeLandCamera,cameraMeshCandidateIds,type CameraPoint} from '../src/land-camera';
import {MeshOracle,ComponentOracle,weldedTriangleShells,convexPlanes,subtractConvexSolid,subtractTerrainBurial,clipPlane,tuple,lerp,cross2,area,height,clipPolygon,projectedInterval,segmentTriangleDistance,prismIntersection,area3D,hullXZ,boundsOf,supportCoverage,coincidentOutwardPolygon,sub,dot,type Triangle,type V,type Provenance} from './helpers/emitted-scene-oracle';
const stage=process.env.MOUNTAIN_AUDIT_STAGE??'all',baseline=process.env.MOUNTAIN_AUDIT_BASELINE,dir=process.env.MOUNTAIN_AUDIT_DIR;
const sourceFiles=['src/maps/mountain.ts','src/land-track.ts','src/land-scenery.ts','src/mountain-scenery.ts','src/land-camera.ts','src/race-camera.ts','tests/mountain-independent-audit.test.ts','tests/helpers/emitted-scene-oracle.ts','tests/helpers/mountain-baseline-contract.ts','src/alpine-props.ts','src/generated/alpine-props.json','tests/fixtures/mountain-source-baseline.json'];
const hashes=()=>Object.fromEntries(sourceFiles.filter(f=>!baseline||f!=='src/mountain-scenery.ts').map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')]));
const sourceHashes=hashes(),start=performance.now(),report:any={stage,baseline:!!baseline,startedAt:new Date().toISOString(),sourceHashes,checks:[],metrics:{},limitations:['Emitted CPU geometry only; no GPU/browser pixels or FPS','Finite camera pose histories are not every possible animation or arbitrary custom kart assembly','Baseline is an observed historical scene, not a safety certificate']};
function audit(name:string,phase:'structural'|'camera',fn:(t:TestContext)=>void){if(stage!=='all'&&stage!==phase)return;test(name,t=>{try{fn(t);report.checks.push({name,status:'passed'});}catch(error){report.checks.push({name,status:'failed',error:String(error)});throw error;}});}
function verify(failures:unknown[],label:string){if(!baseline)assert.equal(failures.length,0,label+': '+JSON.stringify(failures.slice(0,18)));}
after(()=>{report.sourceHashesAfter=hashes();report.stable=JSON.stringify(report.sourceHashesAfter)===JSON.stringify(sourceHashes);report.seconds=(performance.now()-start)/1000;report.resources={maxRSSKiB:process.resourceUsage().maxRSS,v8HeapUsedMiB:process.memoryUsage().heapUsed/1048576,configuredOldSpaceMiB:448,concurrency:1};if(dir){mkdirSync(dir,{recursive:true});const prefix=(baseline?'baseline-':'')+stage,body=JSON.stringify(report,null,2)+'\n';writeFileSync(resolve(dir,prefix+'-report.json'),body);writeFileSync(resolve(dir,report.startedAt.replaceAll(':','-')+'-'+prefix+'-report.json'),body);}assert.ok(report.stable,'audited source changed during run');});
const geometry:any=baseline?JSON.parse(readFileSync(baseline,'utf8')).geometry:buildMountainSceneGeometry(track);
const mesh=new MeshOracle(geometry.batches);
const components:Provenance[]=baseline?geometry.batches.map(b=>({kind:b.name,batch:b.name,vertexStart:0,vertexEnd:b.positions.length/3,indexStart:0,indexEnd:b.indices.length,role:b.name==='Forest valley floor'?'terrain':/banked tarmac|aggregate tarmac|stone roadway/.test(b.name)?'road':'legacy-unknown'})):geometry.components;
const parts=new ComponentOracle(mesh,components),terrain=mesh.triangles.filter(q=>baseline?q.batch==='Forest valley floor':parts.owner.get(q.id)?.kind==='connected-contour-terrain'),terrainIds=new Set(terrain.map(q=>q.id));
const road=mesh.triangles.filter(q=>/banked tarmac|aggregate tarmac|stone roadway/.test(q.batch)),roadIds=new Set(road.map(q=>q.id));
const blockers=baseline?[]:geometry.cameraObstacles;
const intendedSupports=mountainSupportWitnesses(track);
const anchorAt=(frame:any):CameraPoint=>({x:frame.p.x,y:frame.p.y+1.35,z:frame.p.z});
const smoothing=(a:CameraPoint,b:CameraPoint,dt=1/60)=>{const alpha=1-Math.exp(-dt*8);return{x:a.x+(b.x-a.x)*alpha,y:a.y+(b.y-a.y)*alpha,z:a.z+(b.z-a.z)*alpha};};
function boomFailure(a:V,b:V,label:string){
 let min=Infinity,candidates=0;for(const q of mesh.query(a,b,.3)){if(q.min[1]>Math.max(a[1],b[1])+.3||q.max[1]<Math.min(a[1],b[1])-.3)continue;candidates++;const gap=segmentTriangleDistance(a,b,q);min=Math.min(min,gap);if(gap<.3-1e-6)return{label,triangle:q.id,batch:q.batch,kind:parts.owner.get(q.id)?.kind,gap,anchor:a,camera:b};}
 for(const q of mesh.query(a,b))if(terrainIds.has(q.id)){const interval=projectedInterval(q,a,b);if(!interval)continue;for(const f of interval){const p=lerp(a,b,f),gap=p[1]-height(q,p[0],p[2]);if(gap<.3-1e-7)return{label,triangle:q.id,batch:q.batch,gap,anchor:a,camera:b};}}
 return null;
}
audit('Mountain all emitted data is finite and original 24 batch/110k triangle/190k vertex budget holds','structural',()=>{
 const failures:unknown[]=[];let vertices=0,triangles=0;for(const b of geometry.batches){vertices+=b.positions.length/3;triangles+=b.indices.length/3;assert.equal(b.positions.length%3,0);assert.equal(b.indices.length%3,0);assert.ok(b.positions.every(Number.isFinite));assert.ok(b.uvs.every(Number.isFinite));assert.equal(b.uvs.length,b.positions.length/3*2);assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));}
 if(vertices>=190000||triangles>=110000||geometry.batches.length>24)failures.push({vertices,triangles,batches:geometry.batches.length});report.metrics.mesh={vertices,triangles,batches:geometry.batches.length,terrainTriangles:terrain.length,components:components.length,failures};verify(failures,'mesh budget');
});
audit('Mountain independent oracle catches vertical faces endpoint and strict clearance failures','structural',()=>{
 const q:Triangle={id:-1,batch:'negative vertical test',vertices:[],a:[0,0,-1],b:[0,4,-1],c:[0,0,1],min:[0,0,-1],max:[0,4,1]};
 assert.equal(segmentTriangleDistance([-1,1,0],[1,1,0],q),0);assert.ok(Math.abs(segmentTriangleDistance([.29,1,0],[.29,2,0],q)-.29)<1e-8);
 const r:Triangle={id:-2,batch:'negative support',vertices:[],a:[-2,0,-2],b:[2,0,-2],c:[0,0,2],min:[-2,0,-2],max:[2,0,2]};assert.ok(area3D(prismIntersection(q,r,.1,3.2))>.1);
 const cube=[{a:[1,0,0],n:[1,0,0]},{a:[-1,0,0],n:[-1,0,0]},{a:[0,1,0],n:[0,1,0]},{a:[0,-1,0],n:[0,-1,0]},{a:[0,0,1],n:[0,0,1]},{a:[0,0,-1],n:[0,0,-1]}],top=[[-.5,1,-.5],[.5,1,-.5],[.5,1,.5],[-.5,1,.5]],inner=top.map(p=>[p[0],0,p[2]]);
 assert.ok(Math.abs(subtractConvexSolid(top,cube).reduce((n,p)=>n+area3D(p),0)-1)<1e-9,'another same-facing boundary is not a burial proof');assert.equal(subtractConvexSolid(inner,cube).length,0,'actual positive-depth interior can prove whole-polygon burial');assert.equal(coincidentOutwardPolygon(q,{...q,a:q.a,b:q.c,c:q.b}),null,'opposite-facing butt contacts are not same-facing duplicate skins');
 report.metrics.negativeOracle={verticalPenetration:true,strictMargin:true,threeDimensionalPrism:true,sameFacingBoundaryNotBurial:true,positiveInteriorBurial:true,oppositeButtContactsDistinct:true};
});
audit('Mountain physical road prism remains open and lower crossing terrain is below every actual road face','structural',()=>{
 let minimum=Infinity,pairs=0,bodyCandidates=0,intendedContacts=0;const failures:any[]=[],contactWitnesses:any[]=[];
 for(const r of road){const covered=supportCoverage(mesh,[r.a,r.b,r.c],(q,p)=>{if(!terrainIds.has(q.id))return false;for(const v of p){const gap=height(r,v[0],v[2])-height(q,v[0],v[2]);minimum=Math.min(minimum,gap);if(gap<2-1e-6&&failures.length<120)failures.push({kind:'terrain-road',road:r.id,terrain:q.id,gap,point:v});}pairs++;return true;});if(covered.uncovered>1e-5&&failures.length<120)failures.push({kind:'missing-terrain',road:r.id,area:covered.uncovered});
  for(const q of mesh.query(r.min,r.max)){if(roadIds.has(q.id)||terrainIds.has(q.id)||q.max[1]<r.min[1]+.1||q.min[1]>r.max[1]+3.2)continue;bodyCandidates++;const p=prismIntersection(q,r,.1,3.2);if(area3D(p)>1e-6){const witness=intendedSupports.records.get(intendedSupports.key([q.a,q.b,q.c]));if(witness){intendedContacts++;if(contactWitnesses.length<12)contactWitnesses.push({road:r.id,triangle:q.id,intersection:p,sourceWitness:witness});continue;}}if(area3D(p)>1e-6&&failures.length<120)failures.push({kind:'road-body-prism',road:r.id,obstacle:q.id,batch:q.batch,component:parts.owner.get(q.id)?.kind,area:area3D(p),points:p});}
 }
 report.metrics.roadSupport={roads:road.length,terrainPairs:pairs,minimumActualGroundGap:minimum,bodyCandidates,intendedContacts,contactWitnesses,failures,scope:'Full emitted road-triangle prism to 3.2 m only; native six-build checks are separate'};verify(failures,'road support and body prism');
});
audit('Mountain connected terrain has single ownership and exact camera heightfield plane parity','structural',()=>{
 if(baseline){report.metrics.terrainParity={status:'legacy ground only; original runtime provides no camera field'};return;}
 const field=geometry.terrainGrid,shape=(p:V)=>p.map(n=>Math.round(n*1e7)).join(','),vertices=new Map<string,number>(),parents:number[]=[],edges=new Map<string,{count:number;points:V[]}>();const root=(i:number):number=>parents[i]===i?i:(parents[i]=root(parents[i]));const vertex=(p:V)=>{const key=shape(p);let i=vertices.get(key);if(i===undefined){i=parents.length;parents.push(i);vertices.set(key,i);}return i;};let maxError=0,totalArea=0;
 for(const q of terrain){assert.ok(cross2(q.a,q.b,q.c)<0);totalArea+=area([q.a,q.b,q.c]);const ps=[q.a,q.b,q.c],ids=ps.map(vertex);for(let k=0;k<3;k++){parents[root(ids[k])]=root(ids[(k+1)%3]);const key=[ids[k],ids[(k+1)%3]].sort((a,b)=>a-b).join(','),edge=edges.get(key)??{count:0,points:[ps[k],ps[(k+1)%3]]};edge.count++;edges.set(key,edge);}
  for(const p of [...ps,lerp(q.a,q.b,.37),lerp(q.b,q.c,.61)]){const gx=(p[0]-field.minX)/field.dx,gz=(p[2]-field.minZ)/field.dz,x=Math.max(0,Math.min(field.columns-2,Math.floor(gx))),z=Math.max(0,Math.min(field.rows-2,Math.floor(gz))),u=gx-x,v=gz-z,i=z*field.columns+x,a=field.heights[i],b=field.heights[i+1],c=field.heights[i+field.columns],d=field.heights[i+field.columns+1],y=u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v),error=Math.abs(y-p[1]);maxError=Math.max(maxError,error);assert.ok(error<1e-6,'terrain emitted plane differs from exact camera two-triangle field');}
 }
 assert.equal(new Set(parents.map((_,i)=>root(i))).size,1);let boundary=0;for(const e of edges.values()){assert.ok(e.count<=2,'duplicated terrain edge');if(e.count===1){boundary++;assert.ok([field.minX,field.minX+(field.columns-1)*field.dx].some(x=>e.points.every(p=>Math.abs(p[0]-x)<1e-6))||[field.minZ,field.minZ+(field.rows-1)*field.dz].some(z=>e.points.every(p=>Math.abs(p[2]-z)<1e-6)),'terrain internal seam or T-junction');}}
 assert.ok(Math.abs(totalArea-(field.columns-1)*field.dx*(field.rows-1)*field.dz)<1e-4);const failures:any[]=[];let overlapPairs=0;
 for(const q of terrain)for(const other of mesh.query(q.min,q.max)){if(other.id<=q.id||!terrainIds.has(other.id))continue;const overlap=area(clipPolygon([q.a,q.b,q.c],other));if(overlap>1e-6){overlapPairs++;if(failures.length<15)failures.push({a:q.id,b:other.id,overlap});}}
 report.metrics.terrainParity={triangles:terrain.length,baselinePlanes:2*(field.columns-1)*(field.rows-1),maxError,totalArea,weldedVertices:vertices.size,boundaryEdges:boundary,connectedComponents:1,overlapPairs,failures};verify(failures,'terrain single ownership');
});
audit('Mountain every actual foundation root leg peg has complete ground footprint and real declared joints','structural',()=>{
 if(baseline){report.metrics.grounding={status:'legacy builder supplies no primitive provenance; not certified retrospectively'};return;}
 const failures:any[]=[],checks:any[]=[];let groundIntersections=0;
 for(const record of [...geometry.foundations,...geometry.groundedDetails]){const c=components[record.component],points=parts.points(c),box=parts.bounds.get(c)!,footprint=hullXZ(points);let low=Infinity,high=-Infinity;
  if(!parts.closedShell(c))failures.push({kind:c.kind,component:record.component,reason:'ground-bearing component must be an actual closed emitted solid'});
  const coverage=supportCoverage(mesh,footprint,(q,p)=>{if(!terrainIds.has(q.id))return false;for(const v of p){const y=height(q,v[0],v[2]);low=Math.min(low,y);high=Math.max(high,y);}return true;});groundIntersections+=coverage.intersections;
  if(coverage.uncovered>1e-5||box.min[1]>low+.001)failures.push({kind:c.kind,component:record.component,uncovered:coverage.uncovered,actualBottom:box.min[1],terrainLow:low,terrainHigh:high});
  // Entirely buried footing is permitted only with an actual attached structural
  // member extending across the local ground plane. Hidden floating boxes fail.
  if(box.max[1]<=high+.01){const attached=components.filter(other=>other!==c&&parts.bounds.get(other)!.max[1]>high+.01&&parts.attachment(c,other));if(!attached.length)failures.push({kind:c.kind,component:record.component,reason:'no actual load member exits buried footing through terrain'});}
  checks.push({kind:c.kind,component:record.component,terrainLow:low,terrainHigh:high,bottom:box.min[1],top:box.max[1],intersections:coverage.intersections});
 }
 let joints=0;for(const edge of geometry.contacts){const a=components[edge.first],b=components[edge.second];if(!a||!b||!parts.attachment(a,b))failures.push({kind:edge.kind,first:edge.first,second:edge.second,reason:'no real emitted triangle/closed-shell contact'});joints++;}
 report.metrics.grounding={footprints:checks.length,groundIntersections,joints,checks,failures};verify(failures,'actual ground contact and joints');
});
audit('Mountain authored assemblies have ground-connected actual component contact graphs','structural',()=>{
 if(baseline)return;const failures:any[]=[],details:any[]=[];let contacts=0;
 const grounded=new Set<number>([...geometry.foundations,...geometry.groundedDetails].map(r=>r.component)),adj=new Map<number,Set<number>>(components.map((_,i)=>[i,new Set()]));
 const join=(a:number,b:number)=>{if(!adj.get(a)!.has(b)){adj.get(a)!.add(b);adj.get(b)!.add(a);contacts++;}};
 for(const assembly of geometry.assemblies){const list=assembly.components as number[];for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)if(parts.attachment(components[list[i]],components[list[j]]))join(list[i],list[j]);}
 // Declared cross-assembly contacts are still accepted only after independent
 // actual triangle/closed-shell verification. In particular the pier-free
 // crossing bent reaches other actual piers through the continuous real deck.
 for(const edge of geometry.contacts)if(parts.attachment(components[edge.first],components[edge.second]))join(edge.first,edge.second);
 const queue=[...grounded],reached=new Set<number>();while(queue.length){const i=queue.pop()!;if(reached.has(i))continue;reached.add(i);queue.push(...adj.get(i)!);}
 for(const assembly of geometry.assemblies){const list=assembly.components as number[],missing=list.filter(i=>!reached.has(i));if(missing.length)failures.push({assembly:assembly.id,missing:missing.map(i=>({component:i,kind:components[i].kind}))});details.push({assembly:assembly.id,members:list.length,groundConnected:list.length-missing.length});}
 report.metrics.supportGraphs={scope:'Authored scene component graph; imported multi-shell material primitives are grouped nodes here. Known map relief shells are checked separately below; this is not all-original-subpart load certification.',assemblies:details.length,actualContacts:contacts,globalGroundConnected:reached.size,details,failures};verify(failures,'assembly load graph');
});
function freeExternalEye(p:V){
 for(const q of mesh.query(p,p)){if(!terrainIds.has(q.id))continue;const sign=Math.sign(cross2(q.a,q.b,q.c));if([[q.a,q.b],[q.b,q.c],[q.c,q.a]].every(([a,b])=>cross2(a,b,p)*sign>=-1e-8)&&p[1]<=height(q,p[0],p[2])+.001)return false;}
 return !components.some(c=>{const b=parts.bounds.get(c)!;return c.solid&&p.every((v,k)=>v>b.min[k]&&v<b.max[k])&&parts.inside(p,c);});
}
audit('Mountain hero detail has actual external first-hit triangle witnesses','structural',()=>{
 if(baseline)return;let rays=0,freeEyes=0,obliqueWitnesses=0;const failures:any[]=[],details:any[]=[];const integrationConnectors=new Set(geometry.reusedProps.flatMap(p=>p.integrationSupports.filter(s=>!s.externalDetail).map(s=>components[s.component])));const chosen=components.filter(c=>c.assembly&&!/spruce|viaduct/.test(c.assembly)&&!['terrain','road'].includes(c.role)&&!integrationConnectors.has(c)&&!/foundation|footing|root|buried/.test(c.kind));
 const diagonals:V[]=[];for(const x of [-1,0,1])for(const y of [-1,0,1])for(const z of [-1,0,1])if(x||y||z){const n=Math.hypot(x,y,z);diagonals.push([x/n,y/n,z/n]);}
 for(const c of chosen){const b=parts.bounds.get(c)!,radius=Math.hypot(...b.max.map((x,k)=>x-b.min[k]))+3;let visible:any=null;
  const inspect=(q:Triangle,target:V,direction:V,distance:number,method:string)=>{const eye=target.map((x,k)=>x+direction[k]*distance);rays++;if(!freeExternalEye(eye))return false;freeEyes++;const hit=mesh.firstHit(eye,target);if(hit&&parts.owner.get(hit.triangle.id)===c){visible={triangle:q.id,first:hit.triangle.id,eye,target,direction,distance,method};return true;}return false;};
  outer:for(const q of parts.triangles.get(c)??[]){const target=[0,1,2].map(k=>(q.a[k]+q.b[k]+q.c[k])/3);for(const axis of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])if(inspect(q,target,axis,radius,'cardinal'))break outer;}
  if(!visible){outer:for(const q of parts.triangles.get(c)??[]){const a=sub(q.b,q.a),b=sub(q.c,q.a),normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...normal);if(length<1e-12)continue;const norm=normal.map(x=>x/length);
   for(const weights of [[1/3,1/3,1/3],[.8,.1,.1],[.1,.8,.1],[.1,.1,.8],[.96,.02,.02],[.02,.96,.02],[.02,.02,.96]]){const target=q.a.map((x,k)=>x*weights[0]+q.b[k]*weights[1]+q.c[k]*weights[2]);for(const direction of [...diagonals,norm,norm.map(x=>-x)])for(const distance of [.5,1,2,4,8,16])if(inspect(q,target,direction,distance,'bounded diagonal/face-normal')){obliqueWitnesses++;break outer;}}
  }}
  if(!visible)failures.push({kind:c.kind,assembly:c.assembly,reason:'no external first-hit witness in the documented finite direction/target matrix'});details.push({component:components.indexOf(c),kind:c.kind,assembly:c.assembly,bounds:parts.bounds.get(c),witness:visible});
 }report.metrics.externalDetails={components:chosen.length,rays,freeEyes,obliqueWitnesses,details,failures,scope:'Every witness starts above actual terrain and outside authored closed solids. Fallback uses 26 directions and actual face normals, six distances, seven barycentric targets. A finite negative is not a universal invisibility proof.'};verify(failures,'externally visible authored detail');
});
audit('Mountain camera payload accounts for every actual source face including road deck and rails','camera',()=>{
 if(baseline){report.metrics.cameraPayload={blockers:0,emittedFaces:mesh.triangles.length,notice:'Historical runtime had empty camera blockers; independent all-face oracle still includes every source face'};return;}
 const key=(ps:readonly V[])=>ps.map(p=>p.map(n=>Math.round(n*1e7)).join(',')).sort().join('|'),payloads=blockers.filter(b=>b.triangles),keys=new Set(payloads.flatMap(b=>b.triangles.map(key))),failures:any[]=[],byRole:any={};
 for(const q of mesh.triangles){const role=parts.owner.get(q.id)!.role,r=byRole[role]??={emitted:0,payload:0,heightfield:0,missing:0};r.emitted++;if(terrainIds.has(q.id))r.heightfield++;else if(keys.has(key([q.a,q.b,q.c])))r.payload++;else{r.missing++;if(failures.length<30)failures.push({triangle:q.id,batch:q.batch,kind:parts.owner.get(q.id)!.kind,role});}}
 const expectedCounts=new Map<string,number>(),actualCounts=new Map<string,number>();for(const q of mesh.triangles)if(!terrainIds.has(q.id)){const k=key([q.a,q.b,q.c]);expectedCounts.set(k,(expectedCounts.get(k)??0)+1);}for(const b of payloads)for(const q of b.triangles){const k=key(q);actualCounts.set(k,(actualCounts.get(k)??0)+1);}for(const [k,n]of expectedCounts)if(actualCounts.get(k)!==n&&failures.length<60)failures.push({kind:'face-multiplicity',key:k,expected:n,actual:actualCounts.get(k)??0});for(const k of actualCounts.keys())if(!expectedCounts.has(k)&&failures.length<60)failures.push({kind:'invented-payload-face',key:k});
 assert.ok(blockers.every(b=>b.triangles||b.heightfield),'a bounding box must not seal the actual lower underpass');report.metrics.cameraPayload={blockers:blockers.length,explicitPayloadFaces:payloads.reduce((n,b)=>n+b.triangles.length,0),uniquePayloadFaces:keys.size,byRole,failures};verify(failures,'camera source coverage');
});
audit('Mountain all legal-lane desired and truly interpolated whole camera booms keep strict 0.3m source margin','camera',()=>{
 const stations=new Set<number>([0,track.length]);for(let d=0;d<track.length;d+=12)stations.add(d);for(const s of track.sections)for(let d=Math.max(0,s.from-30);d<=Math.min(track.length,s.from+30);d+=3)stations.add(d);
 const orientations=Array.from({length:24},(_,i)=>[-.5,0,.5,1.15].map(pitch=>({yaw:-Math.PI+i*Math.PI/12,pitch,rearView:false}))).flat().concat([{yaw:0,pitch:0,rearView:true}]);let poses=0,failureCount=0,rawIntersections=0,retracted=0;const failures:any[]=[];
 for(const d of stations)for(const side of [-1,0,1])for(const view of [0,1])for(const {yaw,pitch,rearView}of orientations){const f=track.sample(d,side*track.laneLimitAt(d)),anchor=anchorAt(f),raw=chaseCamera({position:f.p,tangent:f.t,view,rearView,orbit:{yaw,pitch}}).position,desired=safeLandCamera(anchor,raw,blockers);if(mesh.firstHit(tuple(anchor),tuple(raw)))rawIntersections++;if(Math.hypot(desired.x-raw.x,desired.y-raw.y,desired.z-raw.z)>.01)retracted++;
  const priorD=d-2.4,prior=track.sample(priorD,side*(track.laneLimitAt(priorD)-.25)),priorAnchor=anchorAt(prior),oldRaw=chaseCamera({position:prior.p,tangent:prior.t,view,rearView:false,orbit:{yaw:yaw+.6,pitch}}).position,old=safeLandCamera(priorAnchor,oldRaw,blockers),interpolated=smoothing(old,desired),final=safeLandCamera(anchor,interpolated,blockers);
  for(const [name,p]of [['desired',desired],['interpolated',final]]as const){const failure=boomFailure(tuple(anchor),tuple(p),`${name}/${d}/${side}/${view}/${rearView}/${yaw}/${pitch}`);if(failure){failureCount++;if(failures.length<60)failures.push(failure);}}poses++;
 }
 report.metrics.wholeBooms={stations:stations.size,poses,booms:poses*2,yaws:24,pitches:4,lanes:3,views:2,strictMargin:.3,rawIntersections,retracted,failureCount,failures,scope:'Finite closed-route source-mesh matrix; no fork-route assumptions or all-angle universal claim'};if(!baseline)assert.equal(failureCount,0,JSON.stringify(failures.slice(0,12)));
});
audit('Mountain live smoothing histories retain actual whole-boom and camera-motion clearance across crossing layers','camera',()=>{
 let frames=0,runs=0,failed=0,minMotion=Infinity;const failures:any[]=[];
 for(const hz of [30,60,144])for(const side of [-1,0,1])for(const [from,to]of [[.35,.47],[.86,1]]){let old:CameraPoint|null=null,time=0;for(let d=track.length*from;d<=track.length*to;d+=55/hz){const frame=track.sample(d,side*track.laneLimitAt(d)),anchor=anchorAt(frame),phase=Math.floor(time*2),raw=chaseCamera({position:frame.p,tangent:frame.t,view:phase%2,rearView:phase%5===2,orbit:{yaw:(phase%7-3)*Math.PI/3,pitch:[-.5,0,.5,1.15][phase%4]}}).position,desired=safeLandCamera(anchor,raw,blockers),previous=old??desired,final=safeLandCamera(anchor,smoothing(previous,desired,1/hz),blockers),failure=boomFailure(tuple(anchor),tuple(final),`live/${hz}/${side}/${d}`);if(failure){failed++;if(failures.length<60)failures.push(failure);}
   for(const q of mesh.query(tuple(previous),tuple(final),.3)){if(q.min[1]>Math.max(previous.y,final.y)+.3||q.max[1]<Math.min(previous.y,final.y)-.3)continue;const gap=segmentTriangleDistance(tuple(previous),tuple(final),q);minMotion=Math.min(minMotion,gap);if(gap<.3-1e-6){failed++;if(failures.length<60)failures.push({kind:'camera-motion',hz,side,d,triangle:q.id,batch:q.batch,gap});}}old=final;time+=1/hz;frames++;}runs++;}
 report.metrics.liveSmoothing={runs,frames,hz:[30,60,144],speed:55,minMotion,failures:failed,examples:failures};if(!baseline)assert.equal(failed,0,JSON.stringify(failures.slice(0,12)));
});
audit('Mountain camera query sample reports bounded actual candidates and CPU cost without FPS claims','camera',()=>{
 const timings:number[]=[],candidates:number[]=[];for(let i=0;i<1200;i++){const d=i/1200*track.length,f=track.sample(d,((i%3)-1)*track.laneLimitAt(d)),a=anchorAt(f),b=chaseCamera({position:f.p,tangent:f.t,view:i%2,rearView:i%7===0,orbit:{yaw:(i%24)*Math.PI/12,pitch:[-.5,0,.5,1.15][i%4]}}).position;const candidate=blockers.reduce((n,o)=>n+(o.triangles?cameraMeshCandidateIds(o.triangles,a,b,.45).length:0),0);candidates.push(candidate);const then=performance.now();safeLandCamera(a,b,blockers);timings.push(performance.now()-then);}
 const stats=(a:number[])=>{const v=[...a].sort((x,y)=>x-y);return{min:v[0],median:v[Math.floor(v.length*.5)],p95:v[Math.floor(v.length*.95)],max:v.at(-1),mean:v.reduce((a,b)=>a+b,0)/v.length};};report.metrics.cameraCPU={samples:timings.length,candidates:stats(candidates),milliseconds:stats(timings),notice:'Isolated sampled CPU query costs, not frame rate or GPU performance'};
});

audit('Mountain exact external coflush overlaps cannot be mislabeled as buried support','structural',()=>{
 if(baseline)return;const selected=components.filter(c=>c.assembly&&!/spruce/.test(c.assembly)),eligible=new Set(selected),planes=new Map(selected.map(c=>[c,convexPlanes(parts,c)]));let pairs=0,rawPairs=0,buriedPairs=0,terrainBuriedPairs=0,shellBuriedPairs=0,failureCount=0;const failures:any[]=[];
 // Original imported material groups may contain multiple convex authored
 // shells. Reconstruct those exact shells to prove burial, never use a material
 // group's convex hull or treat shared material as a solid union.
 const sourceShells:{ids:Set<number>;bounds:{min:number[];max:number[]};planes:ReturnType<typeof convexPlanes>}[]=[];
 for(const prop of geometry.reusedProps)for(const primitive of prop.primitives)for(const qs of weldedTriangleShells(parts.triangles.get(components[primitive.component])!)){
  const batch={name:'isolated exact imported shell',positions:qs.flatMap(q=>[...q.a,...q.b,...q.c]),indices:Array.from({length:qs.length*3},(_,i)=>i)},isolatedMesh=new MeshOracle([batch]),component:Provenance={kind:'exact imported shell',batch:batch.name,vertexStart:0,vertexEnd:batch.positions.length/3,indexStart:0,indexEnd:batch.indices.length,role:'detail'},oracle=new ComponentOracle(isolatedMesh,[component]);sourceShells.push({ids:new Set(qs.map(q=>q.id)),bounds:boundsOf(qs.flatMap(q=>[q.a,q.b,q.c])),planes:convexPlanes(oracle,component)});
 }
 for(const c of selected)for(const a of parts.triangles.get(c)??[])for(const b of mesh.query(a.min,a.max)){
  const other=parts.owner.get(b.id)!;if(b.id<=a.id||c===other||!eligible.has(other)||a.min.some((v,k)=>v>b.max[k]+1e-7)||a.max.some((v,k)=>v<b.min[k]-1e-7))continue;pairs++;const overlap=coincidentOutwardPolygon(a,b);if(!overlap)continue;const rawArea=area3D(overlap.polygon);if(rawArea<1e-7)continue;rawPairs++;
  let exposed:V[][]=[overlap.polygon.map(p=>p.map((v,k)=>v+overlap.normal[k]*1e-5))];const box=boundsOf(exposed[0]),candidates=new Set(mesh.query(box.min,box.max,.001).map(q=>parts.owner.get(q.id)!));
  for(const occluder of candidates){if(occluder===c||occluder===other)continue;let certificate=planes.get(occluder);if(certificate===undefined){certificate=convexPlanes(parts,occluder);planes.set(occluder,certificate);}if(!certificate)continue;exposed=exposed.flatMap(p=>subtractConvexSolid(p,certificate!));if(!exposed.length)break;}
  const beforeShell=exposed.reduce((n,p)=>n+area3D(p),0);for(const shell of sourceShells){if(!shell.planes||shell.ids.has(a.id)||shell.ids.has(b.id)||shell.bounds.min.some((v,k)=>v>a.max[k]+1e-7)||shell.bounds.max.some((v,k)=>v<a.min[k]-1e-7))continue;exposed=exposed.flatMap(p=>subtractConvexSolid(p,shell.planes!));if(!exposed.length)break;}if(beforeShell>1e-7&&exposed.reduce((n,p)=>n+area3D(p),0)<=1e-7)shellBuriedPairs++;
  const beforeTerrain=exposed.reduce((n,p)=>n+area3D(p),0);exposed=exposed.flatMap(p=>subtractTerrainBurial(mesh,terrainIds,p));const exposedArea=exposed.reduce((n,p)=>n+area3D(p),0);if(beforeTerrain>1e-7&&exposedArea<=1e-7)terrainBuriedPairs++;if(exposedArea>1e-7){failureCount++;if(failures.length<80)failures.push({first:a.id,second:b.id,firstKind:c.kind,secondKind:other.kind,rawArea,exposedArea,polygon:overlap.polygon});}else buriedPairs++;
 }
 report.metrics.coflush={parts:selected.length,candidatePairs:pairs,rawPairs,buriedPairs,terrainBuriedPairs,shellBuriedPairs,importedShellCertificates:sourceShells.filter(s=>s.planes).length,failureCount,failures,scope:'Whole coplanar polygon subtraction requires actual positive interior depth in proved closed convex scene/imported shells, or exactly clipped higher terrain. A third coplanar outer skin is not burial. Nonconvex shell burial remains conservatively unproven.'};verify(failures,'exposed coflush duplicate skins');
});
audit('Mountain selected Alpine props retain unit-scale original primitives and every low support shell seats on actual stone pad','structural',()=>{
 if(baseline)return;const failures:any[]=[],details:any[]=[];assert.equal(geometry.reusedProps.length,2);
 for(const prop of geometry.reusedProps){const source=getAlpineProp(prop.kind),c=Math.cos(prop.yaw),s=Math.sin(prop.yaw),transform=(p:V)=>[prop.position[0]+p[0]*c+p[2]*s,prop.position[1]+p[1],prop.position[2]-p[0]*s+p[2]*c],pad=components[prop.pad],padTop=parts.bounds.get(pad)!.max[1];let vertices=0,seatedShells=0;
  assert.equal(prop.primitives.length,source.materials.length);assert.equal(prop.sourceSha256,source.source.sha256);
  for(const primitive of prop.primitives){const original=source.materials.find(p=>p.sourcePrimitive===primitive.sourcePrimitive)!;assert.ok(original);const component=components[primitive.component],batch=geometry.batches.find(b=>b.name===component.batch),emitted=batch.positions.slice(component.vertexStart*3,component.vertexEnd*3),indices=batch.indices.slice(component.indexStart,component.indexEnd).map(i=>i-component.vertexStart);assert.deepEqual(indices,original.indices,'reused prop preserves original triangle winding and indices');assert.equal(emitted.length,original.positions.length);
   for(let i=0;i<emitted.length;i+=3){const expected=transform(original.positions.slice(i,i+3));for(let k=0;k<3;k++)assert.ok(Math.abs(expected[k]-emitted[i+k])<1e-7,'no scale, deform or hidden alternate primitive');vertices++;}
   const triangles=parts.triangles.get(component)!,parents=triangles.map((_,i)=>i),root=(i:number):number=>parents[i]===i?i:(parents[i]=root(parents[i])),weld=new Map<string,number>();
   triangles.forEach((q,i)=>{for(const p of [q.a,q.b,q.c]){const key=p.map(n=>Math.round(n*1e6)).join(','),prior=weld.get(key);if(prior===undefined)weld.set(key,i);else parents[root(i)]=root(prior);}});const shells=new Map<number,Triangle[]>();triangles.forEach((q,i)=>{const r=root(i),list=shells.get(r)??[];list.push(q);shells.set(r,list);});
   for(const [shell,qs]of shells){const points=qs.flatMap(q=>[q.a,q.b,q.c]),box=boundsOf(points);if(box.min[1]>prop.position[1]+source.bounds.min[1]+.05+1e-6)continue;
    const submerged=qs.flatMap(q=>clipPlane([q.a,q.b,q.c],p=>padTop-p[1])),foot=hullXZ(submerged);if(area(foot)<1e-8){failures.push({prop:prop.kind,primitive:primitive.sourcePrimitive,shell,reason:'low authored support shell floats above actual pad',bottom:box.min[1],padTop});continue;}
    const coverage=supportCoverage(mesh,foot,(q,p)=>parts.owner.get(q.id)===pad&&cross2(q.a,q.b,q.c)<-1e-9&&p.every(v=>Math.abs(height(q,v[0],v[2])-padTop)<1e-6));if(coverage.uncovered>1e-6)failures.push({prop:prop.kind,primitive:primitive.sourcePrimitive,shell,reason:'actual support footprint is not fully seated',uncovered:coverage.uncovered});seatedShells++;
   }
  }
  assert.ok(seatedShells>0,'at least one actual source support shell is seated');details.push({kind:prop.kind,vertices,seatedShells,padTop});
 }report.metrics.selectedOriginalProps={details,failures};verify(failures,'selected original prop seating');
});

/** Reconstruct source-welded shells instead of pretending a material primitive is
 * a connected solid. Copies here are bounded to this small imported station and
 * retain every actual emitted world-space triangle, without any convex proxy. */
audit('Mountain known original map relief shells have actual attachment paths and visible emitted faces','structural',()=>{
 if(baseline)return;const prop=geometry.reusedProps.find(p=>p.kind==='12_ranger_relief_map_station');assert.ok(prop);
 const groups:{name:string;triangles:Triangle[];primitive?:number;shell?:number;connector?:number;pad?:boolean;relief?:boolean}[]=[];
 const c=Math.cos(prop.yaw),s=Math.sin(prop.yaw),local=(p:V):V=>{const x=p[0]-prop.position[0],z=p[2]-prop.position[2];return[x*c-z*s,p[1]-prop.position[1],x*s+z*c];};
 for(const primitive of prop.primitives){const qs=parts.triangles.get(components[primitive.component])!,parents=qs.map((_,i)=>i),root=(i:number):number=>parents[i]===i?i:(parents[i]=root(parents[i])),weld=new Map<string,number>();
  qs.forEach((q,i)=>{for(const p of [q.a,q.b,q.c]){const key=p.map(n=>Math.round(n*1e6)).join(','),prior=weld.get(key);if(prior===undefined)weld.set(key,i);else parents[root(i)]=root(prior);}});
  const shells=new Map<number,Triangle[]>();qs.forEach((q,i)=>{const key=root(i),list=shells.get(key)??[];list.push(q);shells.set(key,list);});
  for(const [shell,triangles]of shells){const bounds=boundsOf(triangles.flatMap(q=>[q.a,q.b,q.c].map(local))),relief=primitive.sourcePrimitive>=3&&primitive.sourcePrimitive<=8&&bounds.min[1]>1.02&&bounds.max[1]<2.18;
   groups.push({name:`source primitive ${primitive.sourcePrimitive} shell ${shell}`,triangles,primitive:primitive.sourcePrimitive,shell,relief});}
 }
 for(const connector of prop.integrationSupports)groups.push({name:connector.kind,triangles:parts.triangles.get(components[connector.component])!,connector:connector.component});
 const padGroup=groups.length;groups.push({name:'actual original station support pad',triangles:parts.triangles.get(components[prop.pad])!,pad:true});
 const batches=groups.map((g,i)=>({name:`station exact shell ${i}`,positions:g.triangles.flatMap(q=>[...q.a,...q.b,...q.c]),indices:Array.from({length:g.triangles.length*3},(_,i)=>i)}));
 const isolatedMesh=new MeshOracle(batches),isolatedParts:Provenance[]=batches.map((b,i)=>({kind:groups[i].name,batch:b.name,vertexStart:0,vertexEnd:b.positions.length/3,indexStart:0,indexEnd:b.indices.length,role:groups[i].connector===undefined?'detail':'support'})),shellOracle=new ComponentOracle(isolatedMesh,isolatedParts);
 const adj=groups.map(()=>new Set<number>()),edges:any[]=[];for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++)if(shellOracle.attachment(isolatedParts[i],isolatedParts[j])){adj[i].add(j);adj[j].add(i);edges.push({first:i,second:j});}
 const reached=new Set<number>(),queue=[padGroup];while(queue.length){const i=queue.pop()!;if(reached.has(i))continue;reached.add(i);queue.push(...adj[i]);}
 const failures:any[]=[],targets=groups.map((g,i)=>({g,i})).filter(({g})=>g.relief),details:any[]=[];assert.equal(targets.length,20,'all authored board, three peaks, three caps, lake, trail, three pins and eight pine-emblem solids are represented');
 for(const {g,i}of targets){if(!reached.has(i))failures.push({group:i,primitive:g.primitive,shell:g.shell,reason:'no exact shell-level path to seated support'});
  const ids=new Set(g.triangles.map(q=>q.id));let visible:any=null;outer:for(const q of g.triangles){const target=[0,1,2].map(k=>(q.a[k]+q.b[k]+q.c[k])/3);for(const axis of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){const eye=target.map((x,k)=>x+axis[k]*3),hit=mesh.firstHit(eye,target);if(hit&&ids.has(hit.triangle.id)){visible={triangle:q.id,first:hit.triangle.id,eye,target};break outer;}}}
  if(!visible)failures.push({group:i,primitive:g.primitive,shell:g.shell,reason:'original relief shell has no actual external first-hit witness'});details.push({group:i,primitive:g.primitive,shell:g.shell,triangles:g.triangles.length,groundConnected:reached.has(i),bounds:shellOracle.bounds.get(isolatedParts[i]),visible});
 }
 const mounts:any[]=[];for(const connector of prop.integrationSupports){const i=groups.findIndex(g=>g.connector===connector.component),joins:any[]=[];assert.ok(i>=0);for(const target of connector.joins){const primitive=prop.primitives.find(p=>p.component===target);assert.ok(primitive);const witnesses=[...adj[i]].filter(j=>groups[j].primitive===primitive.sourcePrimitive);if(!witnesses.length)failures.push({component:connector.component,target,reason:'declared mount has no actual target shell contact'});joins.push({primitive:primitive.sourcePrimitive,shells:witnesses});}if(!reached.has(i))failures.push({component:connector.component,reason:'mount itself is not connected to actual seated support'});mounts.push({component:connector.component,kind:connector.kind,joins});}
 report.metrics.originalMapRelief={scope:'Twenty explicitly authored visible relief solids and the scene-added mounting pieces, with exact emitted-shell paths to the station pad. Other original subparts are intermediate contact witnesses, not a universal load or all-original-subpart certificate.',shellGroups:groups.length,sourceTriangles:groups.reduce((n,g)=>n+g.triangles.length,0),targets:details,mounts,edges,failures};verify(failures,'actual original map-relief shell attachment');
});

audit('Mountain preserves the real crossing and measures the inherited unretracted-orbit envelope separately from safe-camera gates','camera',()=>{
 const failures:any[]=[],crossings:any[]=[];let crossPairs=0,minimumVerticalGap=Infinity;
 const upper=road.filter(q=>q.min[1]>30),lower=road.filter(q=>q.max[1]<12);
 for(const a of upper)for(const b of mesh.query(a.min,a.max)){if(!roadIds.has(b.id)||b.max[1]>=12)continue;const polygon=clipPolygon([a.a,a.b,a.c],b);if(area(polygon)<1e-6)continue;crossPairs++;for(const p of polygon)minimumVerticalGap=Math.min(minimumVerticalGap,height(a,p[0],p[2])-height(b,p[0],p[2]));if(crossings.length<12)crossings.push({upper:a.id,lower:b.id,polygon});}
 assert.ok(crossPairs>0&&minimumVerticalGap>29,'genuine high crossing remains geometrically separated');
 const radius=Math.hypot(15,6.9),margin=.3,betweenStations=.75;let stations=0,candidates=0,minimumStructuralMargin=Infinity,maxAdjacentLaneTravel=0,failureCount=0,unexpectedIntersections=0,minimumEnvelopeY=Infinity,maximumEnvelopeY=-Infinity;const offendingComponents=new Map<number,{component:number;kind:string;assembly:string|undefined;faces:Set<number>;witnesses:number;minimumGap:number}>();let prior:V[]|null=null;
 for(let d=track.length*.875;d<=track.length*.935;d+=.5){const w=track.laneLimitAt(d),a=tuple(track.sample(d,-w).p),b=tuple(track.sample(d,w).p);if(prior)maxAdjacentLaneTravel=Math.max(maxAdjacentLaneTravel,Math.hypot(...sub(a,prior[0])),Math.hypot(...sub(b,prior[1])));prior=[a,b];const lo=Math.min(a[1],b[1])+1.35-margin,hi=Math.max(a[1],b[1])+1+radius+margin;minimumEnvelopeY=Math.min(minimumEnvelopeY,lo);maximumEnvelopeY=Math.max(maximumEnvelopeY,hi);
  for(const q of mesh.query(a,b,radius+margin+betweenStations)){const c=parts.owner.get(q.id)!;if(!(/viaduct/.test(c.kind)||/viaduct/.test(c.assembly??'')||roadIds.has(q.id))||q.max[1]<lo||q.min[1]>hi)continue;candidates++;let p=clipPlane([q.a,q.b,q.c],v=>v[1]-lo);p=clipPlane(p,v=>hi-v[1]);if(p.length<3)continue;const flat=(p:V):V=>[p[0],0,p[2]],x=flat(a),y=flat(b);let distance=Infinity;for(let i=1;i<p.length-1;i++){const t:Triangle={id:q.id,batch:q.batch,vertices:[],a:flat(p[0]),b:flat(p[i]),c:flat(p[i+1]),min:[0,0,0],max:[0,0,0]};distance=Math.min(distance,segmentTriangleDistance(x,y,t));}const gap=distance-radius-betweenStations;minimumStructuralMargin=Math.min(minimumStructuralMargin,gap);if(gap<margin-1e-6){failureCount++;const id=components.indexOf(c),record=offendingComponents.get(id)??{component:id,kind:c.kind,assembly:c.assembly,faces:new Set<number>(),witnesses:0,minimumGap:Infinity};record.faces.add(q.id);record.witnesses++;record.minimumGap=Math.min(record.minimumGap,gap);offendingComponents.set(id,record);if(c.kind!=='source-exact-viaduct-pier')unexpectedIntersections++;if(failures.length<40)failures.push({d,triangle:q.id,component:id,kind:c.kind,gap,clipped:p});}}
  stations++;
 }
 assert.ok(maxAdjacentLaneTravel<betweenStations);let pristinePierBuffersVerified=false;if(!baseline){const golden=JSON.parse(readFileSync(new URL('./fixtures/mountain-source-baseline.json',import.meta.url),'utf8'));assert.deepEqual(mountainPierContract(geometry),golden.originalPiers,'historical envelope allowance requires every original pier position/dimension/index unchanged');pristinePierBuffersVerified=true;}
 report.metrics.underpassOrbitEnvelope={crossPairs,minimumVerticalGap,crossings,routeInterval:[track.length*.875,track.length*.935],routeFractions:[.875,.935],stationStep:.5,stations,candidates,radius,margin,betweenStations,maxAdjacentLaneTravel,minimumEnvelopeY,maximumEnvelopeY,minimumStructuralMargin,unretractedEnvelopeClear:failureCount===0,failureCount,unexpectedIntersections,pristinePierBuffersVerified,offendingComponents:[...offendingComponents.values()].map(r=>({...r,faces:[...r.faces]})),witnessCap:40,failures,scope:'Measured conservative unretracted whole-orbit cylinder across the full legal lateral segment at .5 m stations. Existing exact pristine piers can intersect this raw envelope; that negative is retained, not widened into a pass or hidden by changing supports. Mandatory full body-prism, all-face safety-adjusted booms and actual camera-motion gates remain separate and unchanged. Adjacent travel is bounded numerically, not a universal analytic spline proof.'};if(!baseline)assert.equal(unexpectedIntersections,0,'new scenery cannot silently inherit the exact original-pier raw-envelope limitation');
});

audit('Mountain true height contours split original source planes while preserving protected terrain density','structural',()=>{
 if(baseline)return;const f=geometry.terrainGrid,baselinePlanes=2*(f.columns-1)*(f.rows-1),grid=(i:number):V=>[f.minX+(i%f.columns)*f.dx,f.heights[i],f.minZ+Math.floor(i/f.columns)*f.dz],sourcePolygons=new Map<number,Triangle>();
 let id=0;for(let z=0;z<f.rows-1;z++)for(let x=0;x<f.columns-1;x++){const i=z*f.columns+x;for(const ids of [[i,i+f.columns,i+1],[i+1,i+f.columns,i+f.columns+1]]){const [a,b,c]=ids.map(grid);sourcePolygons.set(id,{id,batch:'independent field source',vertices:ids,a,b,c,...boundsOf([a,b,c])});id++;}}
 const covered=new Float64Array(baselinePlanes),materials=new Map<number,Set<string>>();let fragments=0,maxPlaneError=0;
 for(const partition of geometry.terrainPartitions){const c=components.find(c=>c.batch===partition.batch&&c.kind==='connected-contour-terrain');if(!c){assert.equal(partition.sourceTriangles.length,0);continue;}const emitted=parts.triangles.get(c)!;assert.equal(partition.sourceTriangles.length,emitted.length);
  for(let i=0;i<emitted.length;i++){const q=emitted[i],source=sourcePolygons.get(partition.sourceTriangles[i]);assert.ok(source,'every contour triangle has an original field face');const polygon=clipPolygon([q.a,q.b,q.c],source),size=area([q.a,q.b,q.c]);assert.ok(Math.abs(area(polygon)-size)<1e-6,'material triangle escapes its original source plane footprint');for(const p of [q.a,q.b,q.c]){const error=Math.abs(height(source,p[0],p[2])-p[1]);maxPlaneError=Math.max(maxPlaneError,error);assert.ok(error<1e-6);}covered[source.id]+=size;const set=materials.get(source.id)??new Set<string>();set.add(q.batch);materials.set(source.id,set);fragments++;}
 }
 for(const [id,q]of sourcePolygons)assert.ok(Math.abs(covered[id]-area([q.a,q.b,q.c]))<1e-5,`source field triangle ${id} not covered exactly once`);
 const splitMaterialFaces=[...materials.values()].filter(set=>set.size>1).length;assert.ok(baselinePlanes>=22472,'enrichment must not reduce original protected terrain density');assert.ok(splitMaterialFaces>100,'true contours must cross and split source triangles');
 report.metrics.trueMaterialContours={baselinePlanes,protectedMinimum:22472,emittedFragments:fragments,splitMaterialFaces,maxPlaneError,scope:'Each actual fragment preserves its original source face exactly and every original face has full single-owned coverage; material transitions cross face interiors rather than selecting the whole face by centroid'};
});
audit('Mountain tree root flares make real complete terrain-seated end footprints','structural',()=>{
 if(baseline)return;let checked=0;const failures:any[]=[];
 for(const c of components.filter(c=>c.kind==='spruce-ground-root-flare')){const triangles=parts.triangles.get(c)!,points=parts.points(c),bottom=parts.bounds.get(c)!.min[1];
  // Reconstruct the complete finite bottom face of each actual rooted solid,
  // independent of its declared footprint and terrain extrema.
  const unique=[...new Map(points.map(p=>[p.map(n=>Math.round(n*1e7)).join(','),p])).values()].sort((a,b)=>a[1]-b[1]),toe=unique.filter(p=>p[1]<=bottom+1e-7),foot=hullXZ(toe);let low=Infinity,high=-Infinity;
  const coverage=supportCoverage(mesh,foot,(q,p)=>{if(!terrainIds.has(q.id))return false;for(const v of p){const y=height(q,v[0],v[2]);low=Math.min(low,y);high=Math.max(high,y);}return true;});
  if(area(foot)<1e-8||coverage.uncovered>1e-6||bottom>low+.001)failures.push({kind:c.kind,assembly:c.assembly,bottom,terrainLow:low,terrainHigh:high,footprint:foot,uncovered:coverage.uncovered});checked++;
 }report.metrics.rootToes={checked,failures,scope:'Actual emitted complete bottom-face hull clipped against every source terrain face, with retained root/trunk contact graph and separate closed-solid/ground-bearing checks'};verify(failures,'root toe grounding');
});
