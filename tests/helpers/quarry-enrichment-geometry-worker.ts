/** Finite independent CPU audit of retained Quarry indexed geometry. */
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {buildQuarrySceneGeometry} from '../../src/quarry-scenery';
import {QUARRY_COURSE} from '../../src/maps/quarry';
import {instrumentQuarry,type QuarryPrimitive} from './quarry-enrichment-provenance';
import {MeshOracle,ComponentOracle,hullXZ,area,area3D,boundsOf,clipPolygon,height,supportCoverage,prismIntersection,sub,dot,coincidentOutwardPolygon,subtractConvexSolid,segmentDistanceSquared,type V,type Triangle,type ConvexPlane} from './emitted-scene-oracle';
import {primitivePairs,triangleInsideConvex,witness,polygonCenter,splitShellEdges} from './town-enrichment-geometry';
import {emittedConvexVolume,footprintAxes,triangleKey} from './quarry-enrichment-geometry';
const root=new URL('../../',import.meta.url),sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex'),digest=(v:unknown)=>sha(JSON.stringify(v)),fileSha=(f:string)=>sha(readFileSync(new URL(f,root)));
const original=readFileSync(new URL('../../docs/scene-baselines/quarry-scenery.ts.txt',import.meta.url),'utf8'),source=readFileSync(new URL('../../src/quarry-scenery.ts',import.meta.url),'utf8'),sourceHash=sha(source),started=Date.now();
const receipt=JSON.parse(readFileSync(new URL('../fixtures/quarry-enrichment-preservation.json',import.meta.url),'utf8'));
const auditPaths=['src/quarry-scenery.ts','src/maps/quarry.ts','src/land-mesh-builder.ts','tests/helpers/quarry-enrichment-geometry-worker.ts','tests/helpers/quarry-enrichment-geometry.ts','tests/helpers/quarry-enrichment-provenance.ts','tests/helpers/emitted-scene-oracle.ts','tests/helpers/town-enrichment-geometry.ts','tests/helpers/instrumented-source-files.ts','tests/helpers/bounded-test-process.ts','tests/quarry-enrichment-geometry.test.ts','tests/fixtures/quarry-enrichment-preservation.json'];
const inputHashes=Object.fromEntries(auditPaths.map(path=>[path,fileSha(path)]));
const report:any={inputs:inputHashes,schema:'quarry-independent-enrichment-geometry-v1',sourceHash,checks:[],metrics:{},limitations:['CPU indexed-source geometry only; no runtime pixels, GPU or FPS evidence','AABBs are broadphase or a rigorous disjointness proof, never proof of overlap or solid occupancy','Finite contact and open-aperture checks do not certify structural engineering or runtime vehicle collision']};
function audit(name:string,fn:()=>void){test(name,()=>{try{fn();report.checks.push({name,status:'passed'});}catch(e){report.checks.push({name,status:'failed',error:String(e)});throw e;}});}
function clear(errors:unknown[],name:string){assert.equal(errors.length,0,name+' '+errors.length+'\n'+JSON.stringify(errors.slice(0,16),null,2));}
const baseline=await instrumentQuarry(original),candidate=await instrumentQuarry(source),g=candidate.geometry,bg=baseline.geometry;
const mesh=new MeshOracle(g.batches),parts=new ComponentOracle(mesh,candidate.components),owner=(q:Triangle)=>parts.owner.get(q.id) as QuarryPrimitive;
const changed=candidate.components.filter(c=>['extraction','scenery'].includes(c.phase)),changedSet=new Set(changed),changedTriangles=mesh.triangles.filter(q=>changedSet.has(owner(q)));
const terrain='Quarry continuous dry working floor',roads=mesh.triangles.filter(q=>['Quarry compacted haul road','Quarry sawn pale shelf road'].includes(q.batch)),rocks=candidate.components.filter(c=>c.kind.startsWith('extraction-bench')).sort((a,b)=>Number(a.id.split('#')[1])-Number(b.id.split('#')[1]));
const volumes=new Map<QuarryPrimitive,ConvexPlane[]>();for(const c of candidate.components){if(!changedSet.has(c)&&c.phase!=='machinery')continue;const planes=emittedConvexVolume(parts,c);if(planes)volumes.set(c,planes);}
after(()=>{report.sourceHashAfter=fileSha('src/quarry-scenery.ts');report.inputHashesAfter=Object.fromEntries(auditPaths.map(path=>[path,fileSha(path)]));report.stable=report.sourceHashAfter===sourceHash&&digest(report.inputHashesAfter)===digest(inputHashes);report.seconds=(Date.now()-started)/1000;report.resources={maxRSSKiB:process.resourceUsage().maxRSS,heapCapMiB:448,concurrency:1};if(process.env.QUARRY_ENRICHMENT_AUDIT_DIR){mkdirSync(process.env.QUARRY_ENRICHMENT_AUDIT_DIR,{recursive:true});writeFileSync(resolve(process.env.QUARRY_ENRICHMENT_AUDIT_DIR,'geometry-report.json'),JSON.stringify(report,null,2)+'\n');}assert.ok(report.stable,'source changed during audit');});

audit('Quarry original protected indexed road retaining rail machinery fork and trestle geometry remains exact',()=>{
 assert.equal(sha(original),receipt.sourceHashes['src/quarry-scenery.ts']);assert.equal(digest(g),digest(buildQuarrySceneGeometry(QUARRY_COURSE)),'instrumentation must equal ordinary emitted geometry');
 const spans:any[]=[];
 for(const phase of ['road','machinery','trestle','fork'])for(const batch of g.batches){
  const extract=(scene:typeof candidate)=>{const b=scene.geometry.batches.find(x=>x.name===batch.name)!,p=scene.components.filter(c=>c.phase===phase&&c.batch===b.name);return p.map(c=>({kind:c.kind,method:c.method,positions:b.positions.slice(c.vertexStart*3,c.vertexEnd*3),indices:b.indices.slice(c.indexStart,c.indexEnd).map(i=>i-c.vertexStart)}));};
  const before=extract(baseline),now=extract(candidate);assert.equal(digest(now),digest(before),phase+':'+batch.name);if(now.length)spans.push({phase,batch:batch.name,components:now.length,triangles:now.reduce((n,c)=>n+c.indices.length/3,0),sha256:digest(now)});
 }
 for(const [key,value]of Object.entries(receipt.geometryHashes))assert.equal(digest(g[key]),value,key);
 for(const [path,value]of Object.entries(receipt.preservationSourceHashes))assert.equal(fileSha(path),value,path);
 const counts={batches:g.batches.length,vertices:g.batches.reduce((n,b)=>n+b.positions.length/3,0),triangles:g.batches.reduce((n,b)=>n+b.indices.length/3,0)};assert.equal(counts.batches,20);assert.ok(counts.vertices<200000&&counts.triangles<110000,JSON.stringify(counts));
 report.metrics.protection={spans,counts,baseline:{batches:20,vertices:165571,triangles:102692},protectedSourceCount:Object.keys(receipt.preservationSourceHashes).length};
});

audit('Quarry exact indexed ownership and geological blocker payloads are complete',()=>{
 assert.equal(parts.owner.size,mesh.triangles.length);assert.equal(rocks.length,44);assert.ok(changedTriangles.length>1000);
 const payloads=g.cameraObstacles.filter(o=>o.kind.startsWith('extraction-bench'));
 const actual=new Map<string,number>();for(const c of rocks)for(const q of parts.triangles.get(c)!){const k=c.kind+'|'+triangleKey(q);actual.set(k,(actual.get(k)??0)+1);}
 const supplied=new Map<string,number>();for(const b of payloads){assert.ok(b.triangles?.length);for(const t of b.triangles!){const k=b.kind+'|'+JSON.stringify(t);supplied.set(k,(supplied.get(k)??0)+1);}}
 assert.deepEqual(supplied,actual,'complete oriented emitted face multiset');assert.equal(payloads.length,44);assert.ok(rocks.every(c=>volumes.has(c)),'all authored rock bodies are truly convex indexed volumes');
 report.metrics.provenance={components:candidate.components.length,triangles:mesh.triangles.length,changedComponents:changed.length,changedTriangles:changedTriangles.length,rockComponents:rocks.length,rockFaces:[...actual.values()].reduce((a,b)=>a+b,0)};
});

audit('Quarry every changed indexed scenic face clears the real banked road prism',()=>{
 const errors:any[]=[];let pairs=0;
 for(const road of roads)for(const q of mesh.query(road.min,road.max))if(changedSet.has(owner(q))&&q.min[1]<road.max[1]+3.2&&q.max[1]>road.min[1]+.1){pairs++;const polygon=prismIntersection(q,road,.1,3.2);if(area3D(polygon)>1e-7)errors.push({scene:witness(q),road:witness(road),area:area3D(polygon)});}
 report.metrics.drivingPrism={roadTriangles:roads.length,changedTriangles:changedTriangles.length,pairs,failures:errors};clear(errors,'changed scenery intersects road prism');
});


audit('Quarry whole changed projected footprints keep the full independent five-metre road reservation',()=>{
 const failures:any[]=[];let candidates=0,minimum=Infinity;
 const roadIds=new Set(roads.map(q=>q.id)),flat=(p:V):V=>[p[0],0,p[2]];
 for(const c of changed){const polygon=hullXZ(parts.points(c));if(polygon.length<3)continue;const b=boundsOf(polygon);
  for(const road of mesh.query(b.min,b.max,5)){if(!roadIds.has(road.id))continue;candidates++;const corners=[road.a,road.b,road.c];
   if(area(clipPolygon(polygon,road))>1e-8){failures.push({component:c.id,kind:c.kind,reason:'overlapping projected road area',road:witness(road)});continue;}
   let gap=Infinity;for(let i=0;i<polygon.length;i++)for(let j=0;j<3;j++)gap=Math.min(gap,Math.sqrt(segmentDistanceSquared(flat(polygon[i]),flat(polygon[(i+1)%polygon.length]),flat(corners[j]),flat(corners[(j+1)%3]))));minimum=Math.min(minimum,gap);if(gap<5-1e-6)failures.push({component:c.id,kind:c.kind,gap,road:witness(road)});
  }
 }
 report.metrics.projectedRoadReservation={components:changed.length,candidates,minimumQueriedGap:minimum,failures};clear(failures,'full scenic footprint within five metres of road');
});

audit('Quarry complete actual foundations and extraction toes are terrain-covered and buried',()=>{
 const errors:any[]=[],rows:any[]=[];let minBurial=Infinity;
 function grounding(label:string,points:V[],bottom:number,top?:number){const polygon=hullXZ(points),result=supportCoverage(mesh,polygon,(q,overlap)=>{if(q.batch!==terrain)return false;const burial=Math.min(...overlap.map(p=>height(q,p[0],p[2])-bottom));minBurial=Math.min(minBurial,burial);if(burial<.499999)errors.push({label,burial,terrain:witness(q),overlap});if(top!==undefined&&overlap.some(p=>top-height(q,p[0],p[2])<.119999))errors.push({label,reason:'cap below terrain',terrain:witness(q)});return true;});if(result.uncovered>1e-5)errors.push({label,uncovered:result.uncovered});rows.push({label,area:area(polygon),terrainTriangles:result.intersections,uncovered:result.uncovered});}
 for(const scope of candidate.scopes.filter(s=>s.kind==='groundPad')){const members=candidate.components.filter(c=>c.scope===scope.id),body=members.find(c=>c.kind.endsWith('-foundation'))!,cap=members.find(c=>c.kind.endsWith('-cap'))!;assert.ok(body&&cap);const points=parts.points(body),bounds=parts.bounds.get(body)!,capBounds=parts.bounds.get(cap)!;grounding(scope.id,points,bounds.min[1],capBounds.max[1]);if(!parts.contact(body,cap,1e-7))errors.push({scope:scope.id,reason:'no actual body/cap contact'});const upward=(c:QuarryPrimitive)=>parts.triangles.get(c)!.filter(q=>Math.abs(q.a[1]-parts.bounds.get(c)!.max[1])<1e-8&&[q.b,q.c].every(p=>Math.abs(p[1]-q.a[1])<1e-8));assert.equal(upward(body).length,0,'body internal top must be absent');assert.equal(upward(cap).length,2,'one outward cap top');}
 for(let site=0;site<5;site++){const c=rocks.filter(c=>c.kind==='extraction-bench-oxide-band')[site===0?0:site===1?5:site===2?8:site===3?13:17],points=parts.points(c),b=parts.bounds.get(c)!;grounding('extraction-site-'+site,points,b.min[1]);}
 report.metrics.terrainCoverage={foundations:rows.length-5,extractionSites:5,minBurial,rows,failures:errors};clear(errors,'whole-footprint terrain support');
});

audit('Quarry new sheds and relocated worksets have actual connected supports',()=>{
 const failures:any[]=[],graphs:any[]=[];
 for(const scope of candidate.scopes.filter(s=>!s.parent&&(/service-shelter|receiving-shelter/.test(s.kind)||s.kind==='roadside-stone-workset'))){
  const members=candidate.components.filter(c=>c.assembly===scope.id);if(scope.kind==='roadside-stone-workset')assert.equal(members.filter(c=>c.kind==='workset-timber-sleeper').length,3,'each moved three-stone set has three real sleepers');const connected=new Set(members.filter(c=>c.kind.endsWith('-foundation')||c.kind.endsWith('-cap'))),edges=new Map<QuarryPrimitive,QuarryPrimitive[]>();let contacts=0;
  for(const [a,b]of primitivePairs<QuarryPrimitive>(members,parts.bounds))if(parts.attachment(a,b)){contacts++;edges.set(a,[...(edges.get(a)??[]),b]);edges.set(b,[...(edges.get(b)??[]),a]);}
  const todo=[...connected];while(todo.length){const a=todo.pop()!;for(const b of edges.get(a)??[])if(!connected.has(b)){connected.add(b);todo.push(b);}}
  for(const brace of members.filter(c=>c.kind==='service-shelter-open-brace'))if((edges.get(brace)??[]).length<2)failures.push({assembly:scope.id,kind:brace.kind,reason:'brace has no second real frame contact',contacts:(edges.get(brace)??[]).map(c=>c.kind)});
  const missing=members.filter(c=>!connected.has(c));for(const c of missing)failures.push({assembly:scope.id,kind:c.kind,points:parts.points(c).slice(0,4),bounds:parts.bounds.get(c)});graphs.push({assembly:scope.id,members:members.length,contacts,unsupported:missing.length});
 }
 assert.equal(graphs.filter(g=>/shelter/.test(g.assembly)).length,3);assert.ok(graphs.filter(g=>/workset/.test(g.assembly)).length>=20);report.metrics.contacts={graphs,worksets:graphs.filter(g=>/workset/.test(g.assembly)).length,sleepers:changed.filter(c=>c.kind==='workset-timber-sleeper').length,shelters:graphs.filter(g=>/shelter/.test(g.assembly)).length,failures};clear(failures,'unsupported changed members');
});

audit('Quarry changed rocks cannot intrude into any fixed machinery or independent changed structure',()=>{
 const errors:any[]=[],clearances:any[]=[];let candidates=0,clipped=0;
 const structure=candidate.components.filter(c=>c.phase==='machinery'||(c.phase==='scenery'&&c.assembly));
 for(const rock of rocks){const rb=parts.bounds.get(rock)!,planes=volumes.get(rock);assert.ok(planes,'convex rock required');for(const c of structure){const cb=parts.bounds.get(c)!;if(rb.min.some((n,k)=>n>=cb.max[k])||rb.max.some((n,k)=>n<=cb.min[k]))continue;candidates++;for(const q of parts.triangles.get(c)!){const overlap=triangleInsideConvex(q,planes);clipped++;if(area3D(overlap)>1e-7)errors.push({rock:rock.id,rockKind:rock.kind,target:c.kind,assembly:c.assembly,triangle:witness(q),overlap});}}}
 // Broadphase-disjointness proves separation. The record is the exact bounds
 // of retained emitted members, not padded source placement metadata.
 const derrick=candidate.components.filter(c=>c.assembly==='timber-counterweight-derrick#0'),db=boundsOf(derrick.flatMap(c=>parts.points(c))),north=rocks.filter(c=>{const b=parts.bounds.get(c)!;return b.max[2]>330&&b.min[0]<-120&&b.max[0]>100;}),nb=boundsOf(north.flatMap(c=>parts.points(c)));clearances.push({pair:'north cut / complete fixed derrick',derrick:db,north:nb,zSeparation:nb.min[2]-db.max[2]});assert.ok(nb.min[2]-db.max[2]>.1,'full derrick requires positive rigorous disjoint separation');
 report.metrics.crossAssembly={rockComponents:rocks.length,structureComponents:structure.length,candidates,clipped,clearances,failures:errors};clear(errors,'new rock penetrates independent structure');
});

audit('Quarry open shelter access bays and ends are real empty indexed space',()=>{
 const errors:any[]=[],rows:any[]=[];let rays=0;
 for(const scope of candidate.scopes.filter(s=>!s.parent&&/service-shelter|receiving-shelter/.test(s.kind))){const [p,yaw,sx,sz]=scope.args,c=Math.cos(yaw),s=Math.sin(yaw),at=(x:number,y:number,z:number):V=>[p[0]+x*sx*c+z*sz*s,p[1]+y,p[2]-x*sx*s+z*sz*c];
  // The access aisle is ahead of the rear stock/screen. Avoid frame posts by
  // testing both real bays, several heights and +/- oblique inward segments.
  for(const x of [-6,-4.5,-3,3,4.5,6])for(const y of [1.1,2.7,4.3])for(const skew of [-.35,0,.35]){const a=at(x+skew,y,-8),b=at(x-skew,y,-1),hit=mesh.firstHit(a,b);rays++;if(hit)errors.push({scope:scope.id,opening:'front',x,y,skew,hit:witness(hit.triangle),owner:owner(hit.triangle)});}
  for(const side of [-1,1])for(const z of [-3.5,-2.5,-1.5])for(const y of [1.1,2.7,4.3]){const a=at(side*10.4,y,z),b=at(side*7,y,z),hit=mesh.firstHit(a,b);rays++;if(hit)errors.push({scope:scope.id,opening:'end',side,z,y,hit:witness(hit.triangle),owner:owner(hit.triangle)});}
  rows.push({assembly:scope.id,frontBays:2,openEnds:2});}
 assert.equal(rows.length,3);report.metrics.openings={rows,rays,failures:errors};clear(errors,'shelter aperture blocked');
});

audit('Quarry altered cut silhouettes retain distinct orientation-independent elongated walls',()=>{
 const cuts=rocks.filter(c=>c.kind==='extraction-bench-cut-face'),axes=cuts.map(c=>({component:c.id,...footprintAxes(parts.points(c))}));assert.equal(cuts.length,22);assert.ok(axes.filter(a=>a.ratio>2.7).length>=7);assert.ok(axes.some(a=>a.long>400));
 const counts=[5,3,5,4,5];let offset=0;const profiles=counts.map(count=>{const rows=axes.slice(offset,offset+count);offset+=count;return rows.map(a=>[a.long,a.short,a.ratio]);});assert.notEqual(digest(profiles[1]),digest(profiles[3]));assert.ok(profiles[1][0][2]>2.7&&profiles[3][0][2]>2.7);report.metrics.silhouettes={axes,profiles};
});


audit('Quarry actual nested extraction profiles are continuously supported without invented metadata',()=>{
 const failures:any[]=[],rows:any[]=[];
 const ring=(c:QuarryPrimitive)=>hullXZ(splitShellEdges(parts.triangles.get(c)!).flatMap(e=>[e.a,e.b]));
 const caps=(c:QuarryPrimitive)=>parts.triangles.get(c)!.filter(q=>{const a=sub(q.b,q.a),b=sub(q.c,q.a),n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];return n[1]/Math.hypot(...n)>.95;});
 let at=0;
 for(const [site,levels]of [5,3,5,4,5].entries())for(let level=0;level<levels;level++){
  const band=rocks[at++],body=rocks[at++];assert.equal(band.kind,'extraction-bench-oxide-band');assert.equal(body.kind,'extraction-bench-cut-face');
  const lower=ring(band),bodyBottom=ring(body),bandCap=caps(band),bodyCap=caps(body);assert.ok(lower.length>=6&&bodyBottom.length>=6&&bandCap.length>=4&&bodyCap.length>=4);
  const support=(label:string,base:V[],surfaces:Triangle[],tolerance:number)=>{const ids=new Set(surfaces.map(q=>q.id)),result=supportCoverage(mesh,base,(q,poly)=>{if(!ids.has(q.id))return false;const gaps=poly.map(p=>p[1]-height(q,p[0],p[2]));if(gaps.some(g=>g>1e-6||g< -tolerance-1e-6))failures.push({site,level,label,gaps,triangle:witness(q),overlap:poly});return true;});if(result.uncovered>1e-6)failures.push({site,level,label,uncovered:result.uncovered});return result;};
  support('oxide/body interface',bodyBottom,bandCap,1e-6);
  if(level)support('nested terrace load path',lower,caps(rocks[at-3]),.061);
  const meta=g.extractionTerraces.find(t=>t.site===site&&t.level===level)!;
  const sameRing=(a:V[],b:V[])=>{assert.equal(a.length,b.length);assert.ok(a.every(p=>b.some(q=>Math.hypot(...sub(p,q))<1e-7)));};
  sameRing(lower,meta.bottom);sameRing(hullXZ(bodyCap.flatMap(q=>[q.a,q.b,q.c])),meta.top);sameRing(hullXZ(bandCap.flatMap(q=>[q.a,q.b,q.c])),meta.oxideTop);
  rows.push({site,level,indexedLowerArea:area(lower),indexedCapArea:area(hullXZ(bodyCap.flatMap(q=>[q.a,q.b,q.c])))});
 }
 report.metrics.terraceSupport={rows,failures};clear(failures,'actual extraction terrace unsupported');
});

audit('Quarry independent altered assemblies have no positive-volume intersection or duplicate outward skins',()=>{
 const structure=candidate.components.filter(c=>c.assembly&&(changedSet.has(c)||c.phase==='machinery')),errors:any[]=[],duplicates:any[]=[],hiddenInterfaces:any[]=[];let pairs=0,trianglePairs=0;
 for(const [a,b]of primitivePairs<QuarryPrimitive>(structure,parts.bounds)){
  if(a.assembly===b.assembly||(!changedSet.has(a)&&!changedSet.has(b)))continue;pairs++;
  for(const [shape,target]of [[a,b],[b,a]]){const planes=volumes.get(target);if(!planes)continue;for(const q of parts.triangles.get(shape)!){const p=triangleInsideConvex(q,planes);if(area3D(p)>1e-7)errors.push({first:a.kind,second:b.kind,assemblies:[a.assembly,b.assembly],polygon:p});}}
 }
 for(const [a,b]of primitivePairs<QuarryPrimitive>(changed.filter(c=>c.assembly),parts.bounds))for(const q of parts.triangles.get(a)!)for(const r of parts.triangles.get(b)!){trianglePairs++;if(q.min.some((v,k)=>v>r.max[k]+1e-7)||q.max.some((v,k)=>v<r.min[k]-1e-7))continue;const overlap=coincidentOutwardPolygon(q,r);if(overlap&&area3D(overlap.polygon)>1e-7){
   // Same-facing coincident undersides at real support joints are invisible
   // only when their ENTIRE outward side is covered by emitted solid geometry.
   // Clip every overlap fragment; a centre-point/AABB claim is insufficient.
   let exposed:V[][]=[overlap.polygon.map(p=>p.map((v,k)=>v+overlap.normal[k]*1e-5))];const covering:string[]=[];
   for(const c of structure){if(c===a||c===b)continue;const planes=volumes.get(c);if(!planes)continue;const cb=parts.bounds.get(c)!;if(q.min.some((v,k)=>v>cb.max[k]+1e-4)||q.max.some((v,k)=>v<cb.min[k]-1e-4))continue;const before=exposed.reduce((n,p)=>n+area3D(p),0);exposed=exposed.flatMap(p=>subtractConvexSolid(p,planes));if(exposed.reduce((n,p)=>n+area3D(p),0)<before-1e-9)covering.push(c.id+':'+c.kind);if(!exposed.length)break;}
   const record={first:a.kind,second:b.kind,assemblies:[a.assembly,b.assembly],area:area3D(overlap.polygon),exposedArea:exposed.reduce((n,p)=>n+area3D(p),0),covering,firstTriangle:witness(q),secondTriangle:witness(r)};
   (record.exposedArea>1e-7?duplicates:hiddenInterfaces).push(record);
  }}
 report.metrics.independentStructures={pairs,trianglePairs,failures:errors,duplicateSkins:duplicates,wholePolygonHiddenSupportInterfaces:hiddenInterfaces};clear(errors,'independent structural intersection');clear(duplicates,'duplicate outward skins');
});

audit('Quarry independent geometry oracles reject intrusion duplication and filled openings',()=>{
 const rock=rocks[0],planes=volumes.get(rock)!,center=polygonCenter(parts.points(rock)),q=parts.triangles.get(rock)![0],inside={...q,a:q.a.map((v,k)=>(v+center[k])/2),b:q.b.map((v,k)=>(v+center[k])/2),c:q.c.map((v,k)=>(v+center[k])/2)};assert.ok(area3D(triangleInsideConvex(inside,planes))>0);assert.equal(area3D(triangleInsideConvex(q,planes)),0);
 const workset=candidate.scopes.find(s=>s.kind==='roadside-stone-workset'&&!s.parent)!,members=candidate.components.filter(c=>c.assembly===workset.id),byEmission=(a:QuarryPrimitive,b:QuarryPrimitive)=>Number(a.id.split('#')[1])-Number(b.id.split('#')[1]);
 const centerStone=members.filter(c=>c.kind==='workset-cut-stone').sort(byEmission)[1],centerSleeper=members.filter(c=>c.kind==='workset-timber-sleeper').sort(byEmission)[1];assert.ok(parts.contact(centerStone,centerSleeper));
 const remaining=members.filter(c=>c!==centerSleeper),connected=new Set(remaining.filter(c=>c.kind.endsWith('-foundation')||c.kind.endsWith('-cap')));let size=-1;
 while(size!==connected.size){size=connected.size;for(const member of remaining)if(!connected.has(member)&&[...connected].some(support=>parts.attachment(member,support)))connected.add(member);}
 assert.ok(!connected.has(centerStone),'removing the actual center sleeper must expose the formerly floating stone');
 assert.ok(coincidentOutwardPolygon(q,{...q,id:-1}));assert.equal(coincidentOutwardPolygon(q,{...q,id:-1,b:q.c,c:q.b}),null);
 const wall=new MeshOracle([{name:'filled aperture sentinel',positions:[-10,-10,0,10,-10,0,0,10,0],indices:[0,1,2]}]);assert.ok(wall.firstHit([0,1,-2],[0,1,2]));
});
