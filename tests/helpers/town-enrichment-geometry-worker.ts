/** Bounded, independent CPU audit of actual emitted Town architecture. */
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import * as pc from 'playcanvas';
import {buildTownSceneGeometry,TOWN_SCENE_THEME} from '../../src/town-scenery';
import {TOWN_COURSE,TOWN_TRACK,TOWN_ROAD_EDGES,TOWN_LANDMARKS} from '../../src/maps/town';
import {landTexturePixels} from '../../src/land-scenery';
import {instrumentTown,type TownPrimitive,type InstrumentedTown} from './town-enrichment-provenance';
import {MeshOracle,ComponentOracle,area,area3D,boundsOf,clipPolygon,coincidentOutwardPolygon,convexPlanes,height,hullXZ,prismIntersection,sub,dot,supportCoverage,subtractConvexSolid,subtractTerrainBurial,type V,type Triangle,type ConvexPlane} from './emitted-scene-oracle';
import {overlapBounds,primitivePairs,splitShellEdges,triangleInsideConvex,witness,polygonCenter} from './town-enrichment-geometry';
const sha=(input:string|Buffer|Uint8Array)=>createHash('sha256').update(input).digest('hex');
const digest=(input:unknown)=>sha(JSON.stringify(input));
const root=new URL('../../',import.meta.url),contract=JSON.parse(readFileSync(new URL('../fixtures/town-enrichment-protected.json',import.meta.url),'utf8'));
const baselineSource=readFileSync(new URL('./town-enrichment-camera-baseline-source.txt',import.meta.url),'utf8');
const source=readFileSync(new URL('../../src/town-scenery.ts',import.meta.url),'utf8'),sourceHash=sha(source),started=Date.now();
const inventoryHashes=()=>Object.fromEntries([...Object.keys(contract.sourceInventory),...Object.keys(contract.reviewedArtifactRevisions)].map(path=>[path,sha(readFileSync(new URL(path,root)))]));
const inventoryBefore=inventoryHashes();
const report:any={sourceHash,startedAt:new Date().toISOString(),metrics:{},checks:[],limitations:['CPU indexed-source geometry only; no GPU, gameplay pixels or frame-rate certification','Broadphase bounds only locate candidates; geometry acceptance uses actual indexed triangles','Road prism is 0.1 to 3.2m above actual banked road planes; not native six-driver vehicle clearance']};
function audit(name:string,fn:()=>void){test(name,()=>{try{fn();report.checks.push({name,status:'passed'});}catch(error){report.checks.push({name,status:'failed',error:String(error)});throw error;}});}
function noFailures(errors:unknown[],label:string){assert.equal(errors.length,0,`${label}: ${errors.length}\n${JSON.stringify(errors.slice(0,12),null,2)}`);}
const candidate=await instrumentTown(source),baseline=await instrumentTown(baselineSource),g=candidate.geometry,bg=baseline.geometry;
const mesh=new MeshOracle(g.batches),parts=new ComponentOracle(mesh,candidate.components),baselineMesh=new MeshOracle(bg.batches),baselineParts=new ComponentOracle(baselineMesh,baseline.components);
const owned=(q:Triangle)=>parts.owner.get(q.id) as TownPrimitive;
const terrainIds=new Set(mesh.triangles.filter(q=>/^Town garden earth/.test(q.batch)).map(q=>q.id));
const changed=candidate.components.filter(c=>c.changed),changedSet=new Set(changed),changedTriangles=mesh.triangles.filter(q=>changedSet.has(owned(q)));
const roads=mesh.triangles.filter(q=>/cobbled road|paved road|warm stone road/.test(q.batch));
const byBatch=(scene:typeof g,name:string)=>scene.batches.find(b=>b.name===name)!;
const convex=new Map<TownPrimitive,ConvexPlane[]>();for(const c of candidate.components){if(c.method!=='box')continue;const p=convexPlanes(parts,c);if(p)convex.set(c,p);}
after(()=>{report.sourceHashAfter=sha(readFileSync(new URL('../../src/town-scenery.ts',import.meta.url)));report.inventoryDigestBefore=digest(inventoryBefore);report.inventoryDigestAfter=digest(inventoryHashes());report.stable=report.sourceHashAfter===sourceHash&&report.inventoryDigestBefore===report.inventoryDigestAfter;report.durationSeconds=(Date.now()-started)/1000;report.resources={maxRSSKiB:process.resourceUsage().maxRSS,heapCapMiB:448,concurrency:1};if(process.env.TOWN_ENRICHMENT_AUDIT_DIR){mkdirSync(process.env.TOWN_ENRICHMENT_AUDIT_DIR,{recursive:true});writeFileSync(resolve(process.env.TOWN_ENRICHMENT_AUDIT_DIR,'geometry-report.json'),JSON.stringify(report,null,2)+'\n');}assert.ok(report.stable,'Town source changed during audit');});

audit('Town exact original source route road bridge terrain texture protection and fixed budget',()=>{
 assert.equal(sha(baselineSource),contract.originalScenerySha256);
 const revisionPath='tests/fixtures/reviewed-scene-revisions.json',reviewed=JSON.parse(readFileSync(new URL(revisionPath,root),'utf8'));
 assert.deepEqual(Object.keys(reviewed.revisions).sort(),['src/desert-scenery.ts','src/forest-scenery.ts','src/harvest-scenery.ts','src/quarry-scenery.ts','src/town-scenery.ts','src/workshop-scenery.ts']);
 for(const [path,revision]of Object.entries(reviewed.revisions) as [string,{previousSHA256:string;currentSHA256:string}][]){
  assert.equal(revision.previousSHA256,contract.sourceInventory[path],path+' original source golden remains exact');
  assert.equal(sha(readFileSync(new URL(path,root))),revision.currentSHA256,path+' separately reviewed scene revision changed');
 }
 const changedInventory=Object.entries(contract.sourceInventory).filter(([path,hash])=>sha(readFileSync(new URL(path,root)))!==hash).map(([path])=>path);
 assert.deepEqual(changedInventory.sort(),[...Object.keys(reviewed.revisions),...Object.keys(contract.reviewedTestContractChanges)].sort());
 for(const [path,hash] of Object.entries(contract.reviewedTestContractChanges))assert.equal(sha(readFileSync(new URL(path,root))),hash,path+' reviewed test contract changed');
 assert.equal(reviewed.revisions['src/town-scenery.ts'].previousSHA256,contract.originalScenerySha256);assert.equal(reviewed.revisions['src/town-scenery.ts'].currentSHA256,sourceHash);
 report.metrics.reviewedAuditChanges={...contract.reviewedTestContractChanges,[revisionPath]:sha(readFileSync(new URL(revisionPath,root)))};
 // Derived deliverables are not production-source exceptions. Both are
 // outside the original424-file inventory and may be pinned only together
 // after their current-source regeneration has been independently verified.
 const artifactPaths=Object.keys(contract.reviewedArtifactRevisions),knownArtifacts=['docs/town-preview-provenance.json','public/map-previews/town-overview.webp'];
 assert.ok(artifactPaths.length===0||artifactPaths.length===2,'artifact revision must be empty or a complete verified pair');
 if(artifactPaths.length){
  assert.deepEqual(artifactPaths.sort(),knownArtifacts.sort());
  for(const path of artifactPaths){const revision=contract.reviewedArtifactRevisions[path];assert.equal(revision.sourceSHA256,sourceHash,path+' stale source binding');assert.match(revision.sha256,/^[a-f0-9]{64}$/);assert.equal(sha(readFileSync(new URL(path,root))),revision.sha256,path+' exact reviewed artifact changed');}
  const provenance=JSON.parse(readFileSync(new URL(knownArtifacts[0],root),'utf8'));assert.equal(provenance.sourceHashes['src/town-scenery.ts'],sourceHash);assert.equal(provenance.menuAsset.file,knownArtifacts[1]);assert.equal(provenance.menuAsset.sha256,contract.reviewedArtifactRevisions[knownArtifacts[1]].sha256);
 }
 report.metrics.reviewedArtifactRevisions=contract.reviewedArtifactRevisions;
 // Instrumentation must produce exactly the ordinary production buffers.
 assert.equal(digest(g),digest(buildTownSceneGeometry(TOWN_COURSE)));
 for(const key of ['roadSamples','routeRoadSamples','roadFaces','structures','landmarks'])assert.equal(digest(g[key]),contract.geometryComponentHashes[key],key);
 assert.equal(digest(TOWN_SCENE_THEME),contract.themeSha256);
 const textures=Object.fromEntries((['stone','asphalt','wood','grass'] as const).map(kind=>[kind,{width:64,height:64,pixels:[...landTexturePixels(kind)]}]));
 assert.equal(digest(textures),contract.texturesSha256);
 report.metrics.textureBytes=Object.fromEntries(Object.entries(textures).map(([k,t])=>[k,{width:t.width,height:t.height,rgbaSha256:sha(Uint8Array.from(t.pixels))}]));
 const edges=TOWN_ROAD_EDGES.map(edge=>{const count=Math.ceil(edge.length/1.5);return{id:edge.id,length:edge.length,samples:Array.from({length:count+1},(_,i)=>{const s=edge.length*i/count,f=edge.sample(s),w=edge.halfWidthAt(s);return{s,p:f.p.toArray(),t:f.t.toArray(),n:f.n.toArray(),halfWidth:w,left:edge.sample(s,-w).p.toArray(),right:edge.sample(s,w).p.toArray()};})};});
 const route={label:TOWN_TRACK.label,tag:TOWN_TRACK.tag,canonicalLength:TOWN_COURSE.canonicalLength,alleyLapLength:TOWN_COURSE.commonStart.length+TOWN_COURSE.alternates.alley.length+TOWN_COURSE.commonFinish.length,boulevardLapLength:TOWN_COURSE.canonicalLength,edges,landmarks:TOWN_LANDMARKS,checkpointGates:TOWN_COURSE.checkpointGates};assert.equal(digest(route),contract.routeSha256);
 const normals=new Map(g.batches.map(b=>[b.name,pc.calculateNormals(b.positions,b.indices)])),bnormals=new Map(bg.batches.map(b=>[b.name,pc.calculateNormals(b.positions,b.indices)]));
 const ranges:any[]=[];
 function compare(name:string,oldRange:[number,number],newRange:[number,number],label=name){
  const extract=(scene:typeof g,range:[number,number],normal:Map<string,number[]>)=>{const b=byBatch(scene,name),indices:number[]=[];for(let i=0;i<b.indices.length;i+=3){const tri=b.indices.slice(i,i+3),inside=tri.map(j=>j>=range[0]&&j<range[1]);if(inside.some(Boolean)){assert.ok(inside.every(Boolean),label+' split primitive');indices.push(...tri.map(j=>j-range[0]));}}return {positions:b.positions.slice(range[0]*3,range[1]*3),normals:Array.from(normal.get(name)!).slice(range[0]*3,range[1]*3),indices};};
  const before=extract(bg,oldRange,bnormals),after=extract(g,newRange,normals);assert.equal(digest(after),digest(before),label);ranges.push({name:label,oldRange,newRange,triangles:after.indices.length/3,sha256:digest(after)});
 }
 for(const name of ['Lantern Alley pale cobbled road','Tram Boulevard dark paved road','Market and civic warm stone road','Street bridge soffit and shadowed masonry','Town garden earth and distant terraces'])compare(name,[0,byBatch(bg,name).positions.length/3],[0,byBatch(g,name).positions.length/3]);
 for(const [name,field] of [['Ochre terrace retaining masonry','masonryVertexStart'],['Cream sidewalk coping and civic columns','pavingVertexStart']] as const){
  compare(name,[0,Math.min(...bg.foundations.map(f=>f[field]))],[0,Math.min(...g.foundations.map(f=>f[field]))],name+' road-bearing prefix');
  compare(name,[Math.max(...bg.foundations.filter(f=>f.kind==='fork-wayfinding-board').map(f=>f[field]+24)),byBatch(bg,name).positions.length/3],[Math.max(...g.foundations.filter(f=>f.kind==='fork-wayfinding-board').map(f=>f[field]+24)),Math.min(...g.foundations.filter(f=>f.kind==='terrace-house').map(f=>f[field]))],name+' bridge rail coping pier cantilever');
 }
 const linen='Ivory market canopy stripes and race markings',end=byBatch(bg,linen).positions.length/3,roadEnd=end-14*3*4-28;compare(linen,[0,roadEnd],[0,roadEnd],'road markings and start stripe');compare(linen,[end-28,end],[roadEnd,roadEnd+28],'sign arrows');
 const relocated=new Set(['terrace-house','open-arcade-bay','striped-market-stall']);assert.deepEqual(g.props.filter(p=>!relocated.has(p.kind)),bg.props.filter(p=>!relocated.has(p.kind)));
 const counts={batches:g.batches.length,vertices:g.batches.reduce((n,b)=>n+b.positions.length/3,0),triangles:g.batches.reduce((n,b)=>n+b.indices.length/3,0)};assert.ok(counts.batches<=24&&counts.vertices<190000&&counts.triangles<110000,JSON.stringify(counts));
 report.metrics.protection={inventory:424,changedInventory,ranges,counts,baseline:{batches:20,vertices:184438,triangles:95630},materialOrUvChanges:g.batches.filter(b=>{const old=byBatch(bg,b.name);return digest([b.color,b.roughness,b.texture,b.metalness,b.uvs])!==digest([old.color,old.roughness,old.texture,old.metalness,old.uvs]);}).map(b=>b.name)};
});

audit('Town final indexed primitive ownership survives removed foundation fronts',()=>{
 assert.ok(candidate.components.length>1000);assert.equal(parts.owner.size,mesh.triangles.length);assert.ok(changedTriangles.length>1000);
 const cut=changed.filter(c=>c.kind==='groundPad'&&c.method==='box'&&c.batch.startsWith('Ochre')&&c.indexEnd-c.indexStart===30);assert.ok(cut.length>0);
 report.metrics.provenance={components:candidate.components.length,triangles:mesh.triangles.length,changedComponents:changed.length,changedTriangles:changedTriangles.length,cutFoundationFronts:cut.length,scopes:candidate.scopes.length};
});

audit('Town every changed architecture triangle clears the actual four-edge banked driving prism',()=>{
 let pairs=0;const errors:any[]=[];
 for(const road of roads)for(const q of mesh.query(road.min,road.max))if(changedSet.has(owned(q))&&q.min[1]<=road.max[1]+3.2&&q.max[1]>=road.min[1]+.1){pairs++;const poly=prismIntersection(q,road,.1,3.2);if(area3D(poly)>1e-7)errors.push({architecture:witness(q),road:witness(road),area:area3D(poly),polygon:poly,owner:owned(q)});}
 report.metrics.corridor={architectureTriangles:changedTriangles.length,roadTriangles:roads.length,exactCandidatePairs:pairs,failures:errors};noFailures(errors,'actual road-prism intersection');
});

function foundationChecks(scene:InstrumentedTown,oracle:MeshOracle,components:ComponentOracle){
 const errors:any[]=[],rows:any[]=[];let minimumBurial=Infinity;
 for(const scope of scene.scopes.filter(s=>s.kind==='groundPad')){
  const members=scene.components.filter(c=>c.scope===scope.id),body=members.find(c=>c.batch.startsWith('Ochre'))!,cap=members.find(c=>c.batch.startsWith('Cream sidewalk'))!;assert.ok(body&&cap);
  const points=components.points(body),bottom=Math.min(...points.map(p=>p[1])),footprint=hullXZ(points),coverage=supportCoverage(oracle,footprint,(q,overlap)=>{
   if(!/^Town garden earth/.test(q.batch))return false;const burial=Math.min(...overlap.map(p=>height(q,p[0],p[2])-bottom));minimumBurial=Math.min(minimumBurial,burial);if(burial<.35-1e-7)errors.push({kind:scope.args[0],scope:scope.id,burial,triangle:witness(q),overlap});return true;
  });
  if(coverage.uncovered>1e-6)errors.push({scope:scope.id,uncoveredArea:coverage.uncovered});
  if(!components.contact(body,cap,1e-7))errors.push({scope:scope.id,reason:'actual foundation cap/body disconnected'});
  rows.push({scope:scope.id,assembly:scope.assembly,kind:scope.args[0],bottom,footprintArea:area(footprint),terrainTriangles:coverage.intersections,uncoveredArea:coverage.uncovered});
 }
 return{foundations:rows.length,minimumBurial,rows,errors};
}
audit('Town whole emitted foundation footprints are covered buried and cap-contacted',()=>{
 const current=foundationChecks(candidate,mesh,parts),original=foundationChecks(baseline,baselineMesh,baselineParts);report.metrics.foundations={current,original};assert.equal(current.foundations,129);noFailures(current.errors,'candidate whole-foundation grounding');
});

function contactGraphs(scene:InstrumentedTown,components:ComponentOracle){
 const assemblies=new Map<string,TownPrimitive[]>();
 for(const c of scene.components)if(c.assembly){const list=assemblies.get(c.assembly)??[];list.push(c);assemblies.set(c.assembly,list);}
 const failures:any[]=[],graphs:any[]=[];
 for(const [assembly,members] of assemblies){
  const scope=scene.scopes.find(s=>s.id===assembly)!;if(!['house','arcade','marketStall','skyline'].includes(scope.kind))continue;
  const connected=new Set(members.filter(c=>c.kind==='groundPad')),edges=new Map<TownPrimitive,TownPrimitive[]>();let contacts=0,candidates=0;
  for(const [a,b] of primitivePairs<TownPrimitive>(members,components.bounds)){candidates++;if(components.attachment(a,b)){contacts++;edges.set(a,[...(edges.get(a)??[]),b]);edges.set(b,[...(edges.get(b)??[]),a]);}}
  const queue=[...connected];while(queue.length){const a=queue.shift()!;for(const b of edges.get(a)??[])if(!connected.has(b)){connected.add(b);queue.push(b);}}
  const unsupported=members.filter(c=>!connected.has(c));
  for(const c of unsupported)failures.push({assembly,scope:scope.args,primitive:c,bounds:components.bounds.get(c),triangles:(components.triangles.get(c)??[]).slice(0,2).map(witness)});
  graphs.push({assembly,members:members.length,broadphasePairs:candidates,actualContacts:contacts,unsupported:unsupported.length});
 }
 return{graphs,failures};
}
audit('Town each changed house arcade and stall decorative member reaches its real foundation',()=>{
 const current=contactGraphs(candidate,parts),original=contactGraphs(baseline,baselineParts);report.metrics.contacts={current,original};assert.ok(current.graphs.length>=71);noFailures(current.failures,'unsupported decorative geometry (baseline witnesses reported separately)');
});

audit('Town composite cut-front recess shells close and 5x5 frontal oblique rays hit their own reveal backing or attached mullion',()=>{
 const errors:any[]=[],rows:any[]=[];let rays=0;
 for(const scope of candidate.scopes.filter(s=>s.kind==='recess')){
  const components=changed.filter(c=>c.scope===scope.id),body=changed.find(c=>c.assembly===scope.assembly&&c.kind==='groundPad'&&c.batch.startsWith('Ochre'))!;
  assert.equal(body.indexEnd-body.indexStart,30,'original front skin was not actually removed');
  const surfaces=components.filter(c=>c.method==='quad'),shell=[...(parts.triangles.get(body)??[]),...surfaces.flatMap(c=>parts.triangles.get(c)??[])];
  const seams=splitShellEdges(shell);if(seams.length)errors.push({scope:scope.id,assembly:scope.assembly,seams});
  const [p,yaw,,, ,padWidth,frontSide]=scope.args,cos=Math.cos(yaw),sin=Math.sin(yaw),at=(x:number,y:number,z:number):V=>[p[0]+x*cos+z*sin,p[1]+y,p[2]-x*sin+z*cos];
  const local=(q:V):V=>[(q[0]-p[0])*cos-(q[2]-p[2])*sin,q[1]-p[1],(q[0]-p[0])*sin+(q[2]-p[2])*cos];
  const backing=surfaces.filter(c=>c.batch.startsWith('Deep blue'));assert.equal(backing.length,2);
  for(const back of backing){
   const points=parts.points(back).map(local),b=boundsOf(points),backZ=points[0][2];
   const reveals=components.filter(c=>{const p=parts.points(c).map(local),bounds=boundsOf(p);return bounds.min[0]>=b.min[0]-1e-7&&bounds.max[0]<=b.max[0]+1e-7&&bounds.min[1]>=b.min[1]-1e-7&&bounds.max[1]<=b.max[1]+1e-7;});
   const intended=new Set(reveals.flatMap(c=>parts.triangles.get(c)??[]).map(t=>t.id));
   for(const angle of [-Math.PI/6,0,Math.PI/6])for(let x=0;x<5;x++)for(let y=0;y<5;y++){
    const target=at(b.min[0]+(x+.5)/5*(b.max[0]-b.min[0]),b.min[1]+(y+.5)/5*(b.max[1]-b.min[1]),backZ);
    // Eyes are 2m in front of the opening, with fixed ±30° horizontal yaw.
    const frontZ=backZ+frontSide*.32,openingX=b.min[0]+(x+.5)/5*(b.max[0]-b.min[0]),openingY=b.min[1]+(y+.5)/5*(b.max[1]-b.min[1]);
    const eye=at(openingX+2*Math.tan(angle),openingY,frontZ+frontSide*2),end=at(openingX-.4*Math.tan(angle),openingY,backZ-frontSide*.08),hit=mesh.firstHit(eye,end);rays++;
    if(!hit||!intended.has(hit.triangle.id))errors.push({scope:scope.id,angle,x,y,eye,target,hit:hit?{...witness(hit.triangle),owner:owned(hit.triangle),fraction:hit.fraction}:null});
   }
  }
  rows.push({scope:scope.id,assembly:scope.assembly,originalFootingTriangles:10,compositeTriangles:shell.length,seams:seams.length,openings:backing.length});
 }
 assert.ok(rows.length>0);report.metrics.recesses={rows,rays,failures:errors};noFailures(errors,'open composite recess or wrong first-hit geometry');
});

function compositeFootingSolids(){
 const solids=new Map<TownPrimitive,{outer:ConvexPlane[];cavities:ConvexPlane[][]}>();
 const plane=(q:Triangle):ConvexPlane=>{const a=sub(q.b,q.a),b=sub(q.c,q.a),n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...n);return{a:q.a,n:n.map(v=>v/length)};};
 for(const scope of candidate.scopes.filter(s=>s.kind==='recess')){
  const members=changed.filter(c=>c.scope===scope.id),surfaces=members.filter(c=>c.method==='quad'),body=changed.find(c=>c.assembly===scope.assembly&&c.kind==='groundPad'&&c.batch.startsWith('Ochre'))!;
  const bodyTriangles=parts.triangles.get(body)!,surfaceTriangles=surfaces.flatMap(c=>parts.triangles.get(c)!);assert.equal(splitShellEdges([...bodyTriangles,...surfaceTriangles]).length,0,'composite solid requires witnessed complete closure');
  const [p,yaw,,,,,frontSide]=scope.args,co=Math.cos(yaw),si=Math.sin(yaw),local=(q:V):V=>[(q[0]-p[0])*co-(q[2]-p[2])*si,q[1]-p[1],(q[0]-p[0])*si+(q[2]-p[2])*co],at=(q:V):V=>[p[0]+q[0]*co+q[2]*si,p[1]+q[1],p[2]-q[0]*si+q[2]*co],axis=(q:V):V=>[q[0]*co+q[2]*si,q[1],-q[0]*si+q[2]*co];
  const bodyBounds=boundsOf(parts.points(body).map(local)),front=frontSide>0?bodyBounds.max[2]:bodyBounds.min[2],frontFace=surfaceTriangles.find(q=>[q.a,q.b,q.c].every(p=>Math.abs(local(p)[2]-front)<1e-6));assert.ok(frontFace,'indexed planar front infill missing');
  const outer=[...bodyTriangles.map(plane),plane(frontFace)],cavities:ConvexPlane[][]=[];
  for(const backing of surfaces.filter(c=>c.batch.startsWith('Deep blue'))){
   const points=parts.points(backing).map(local),b=boundsOf(points),back=points[0][2],lo=[b.min[0],b.min[1],Math.min(front,back)],hi=[b.max[0],b.max[1],Math.max(front,back)];
   const planes:ConvexPlane[]=[];
   for(let k=0;k<3;k++)for(const direction of [-1,1]){const n=[0,0,0],a=[...lo];n[k]=direction;a[k]=direction<0?lo[k]:hi[k];const pl={a:at(a),n:axis(n)};
    // Five cavity boundaries are actual revealed or backing planes; its front
    // limit is the actual retained planar facade around the removed opening.
    assert.ok(surfaceTriangles.some(q=>[q.a,q.b,q.c].every(v=>Math.abs(dot(pl.n,sub(v,pl.a)))<1e-6)),'cavity boundary lacks an indexed face witness');planes.push(pl);
   }
   assert.ok(frontSide*(front-back)>.31&&frontSide*(front-back)<.33);cavities.push(planes);
  }
  solids.set(body,{outer,cavities});
 }
 return solids;
}
audit('Town exact cross-assembly triangle solid penetration including unchanged structures',()=>{
 const errors:any[]=[],pairs=primitivePairs<TownPrimitive>(candidate.components,parts.bounds),composite=compositeFootingSolids();let candidates=0,insideTests=0;
 for(const [a,b] of pairs){if((!a.changed&&!b.changed)||(a.assembly&&a.assembly===b.assembly))continue;if(a.role==='terrain'||b.role==='terrain')continue;candidates++;
  for(const [surface,solid] of [[a,b],[b,a]]){const certificate=composite.get(solid),planes=convex.get(solid)??certificate?.outer;if(!planes)continue;
   for(const q of parts.triangles.get(surface)??[]){insideTests++;let fragments=[triangleInsideConvex(q,planes)].filter(p=>area3D(p)>1e-8);
    for(const cavity of certificate?.cavities??[]){const expanded=cavity.map(p=>({a:p.a.map((n,k)=>n+p.n[k]*3e-7),n:p.n}));fragments=fragments.flatMap(p=>subtractConvexSolid(p,expanded));}
    const penetrationArea=fragments.reduce((n,p)=>n+area3D(p),0);if(penetrationArea>1e-6){errors.push({surface,solid,triangle:witness(q),area:penetrationArea,polygons:fragments});break;}}
  }
 }
 report.metrics.crossBuilding={broadphasePairs:pairs.length,candidatePairs:candidates,triangleSolidTests:insideTests,closedCompositeFootings:composite.size,failures:errors};noFailures(errors,'cross-building solid penetration');
});

/** Within-assembly, rigid-transform-invariant exact shape/relative pose key.
 * Different widths, depths, shifted trim or exposed patch geometry cannot match.
 * Cross-assembly coincidences deliberately have no inheritable recipe. */
function coplanarRecipe(scene:InstrumentedTown,parts:ComponentOracle,a:TownPrimitive,b:TownPrimitive,exposed:V[][]){
 if(!a.assembly||a.assembly!==b.assembly)return null;
 const scope=scene.scopes.find(s=>s.id===a.assembly);if(!scope)return null;
 const yaw=scope.args[1];if(typeof yaw!=='number')return null;
 const co=Math.cos(yaw),si=Math.sin(yaw),rotate=(p:V):V=>[p[0]*co-p[2]*si,p[1],p[0]*si+p[2]*co];
 const pa=parts.points(a).map(rotate),pb=parts.points(b).map(rotate),box=boundsOf([...pa,...pb]),origin=box.min.map((n,k)=>(n+box.max[k])/2);
 const key=(p:V)=>p.map((n,k)=>Math.round((n-origin[k])*1e5)).join(',');
 const member=(c:TownPrimitive,p:V[])=>({batch:c.batch,method:c.method,vertices:[...new Set(p.map(key))].sort(),triangles:(c.indexEnd-c.indexStart)/3});
 const members=[member(a,pa),member(b,pb)].sort((x,y)=>JSON.stringify(x).localeCompare(JSON.stringify(y)));
 return digest({members,exposedVertices:[...new Set(exposed.flat().map(rotate).map(key))].sort(),exposedArea:Math.round(exposed.reduce((n,p)=>n+area3D(p),0)*1e6)});
}
function coplanarity(scene:InstrumentedTown,mesh:MeshOracle,parts:ComponentOracle,baselineMode=false){
 const owned=(q:Triangle)=>parts.owner.get(q.id) as TownPrimitive,terrainIds=new Set(mesh.triangles.filter(q=>/^Town garden earth/.test(q.batch)).map(q=>q.id));
 const convex=new Map<TownPrimitive,ConvexPlane[]>();for(const c of scene.components){if(c.method!=='box')continue;const p=convexPlanes(parts,c);if(p)convex.set(c,p);}
 const included=(c:TownPrimitive)=>baselineMode?!!c.assembly&&['house','marketStall','arcade'].some(k=>c.assembly!.startsWith(k+'#')):c.changed;
 const errors:any[]=[],groups:any={};let pairs=0,raw=0,buried=0;
 for(const [a,b] of primitivePairs<TownPrimitive>(scene.components,parts.bounds)){
  if(!included(a)&&!included(b))continue;if(a.role==='terrain'||b.role==='terrain')continue;
  for(const q of parts.triangles.get(a)??[])for(const r of parts.triangles.get(b)??[]){if(!overlapBounds(q,r))continue;pairs++;const overlap=coincidentOutwardPolygon(q,r);if(!overlap||area3D(overlap.polygon)<1e-7)continue;raw++;
   let exposed:V[][]=[overlap.polygon.map(p=>p.map((v,k)=>v+overlap.normal[k]*1e-5))];const box=boundsOf(exposed[0]);
   const others=new Set(mesh.query(box.min,box.max,.001).map(owned));
   for(const other of others){if(other===a||other===b)continue;const planes=convex.get(other);if(!planes)continue;exposed=exposed.flatMap(p=>subtractConvexSolid(p,planes));if(!exposed.length)break;}
   exposed=exposed.flatMap(p=>subtractTerrainBurial(mesh,terrainIds,p));const exposedArea=exposed.reduce((n,p)=>n+area3D(p),0);
   const key=[a.kind+' / '+a.batch,b.kind+' / '+b.batch].sort().join(' vs ');const group=groups[key]??{pairs:0,rawArea:0,exposedArea:0};group.pairs++;group.rawArea+=area3D(overlap.polygon);group.exposedArea+=exposedArea;groups[key]=group;
   if(exposedArea>1e-6)errors.push({a,b,triangleA:witness(q),triangleB:witness(r),rawArea:area3D(overlap.polygon),exposedArea,exposed,recipeKey:coplanarRecipe(scene,parts,a,b,exposed)});else buried++;
  }
 }
 return{candidateTrianglePairs:pairs,rawPairs:raw,fullyBuriedPairs:buried,groups,failures:errors};
}
audit('Town exposed same-facing coplanarity has only fully witnessed geometric burial exemptions',()=>{
 const original=coplanarity(baseline,baselineMesh,baselineParts,true),current=coplanarity(candidate,mesh,parts);
 const prior=new Set(original.failures.map(f=>f.recipeKey).filter(Boolean)),inherited=current.failures.filter(f=>f.recipeKey&&prior.has(f.recipeKey)),newFailures=current.failures.filter(f=>!f.recipeKey||!prior.has(f.recipeKey));
 report.metrics.coplanarity={current,original,classification:{strictInheritedPairs:inherited.length,strictInheritedArea:inherited.reduce((n,f)=>n+f.exposedArea,0),newPairs:newFailures.length,newArea:newFailures.reduce((n,f)=>n+f.exposedArea,0),crossAssemblyInheritance:false,newExamples:newFailures}};noFailures(current.failures,'duplicate exposed coplanar skin (exact baseline recipe witnesses classified separately)');
});

audit('Town distant skyline is made of grounded closed masses and actual roof faces',()=>{
 const scopes=candidate.scopes.filter(s=>s.kind==='house'&&s.args[8]===true),rows:any[]=[];assert.equal(scopes.length,2);
 for(const scope of scopes){const members=changed.filter(c=>c.assembly===scope.assembly),bodies=members.filter(c=>c.kind==='house'&&c.method==='box'&&/plaster facades/.test(c.batch)),roofs=members.filter(c=>c.kind==='house'&&c.method==='quad'&&c.batch.startsWith('Terracotta'));
  assert.equal(bodies.length,scope.args[9]??2);assert.equal(roofs.length,bodies.length*2);for(const body of bodies)assert.ok(parts.closedShell(body),'distant mass is not a closed emitted solid');rows.push({assembly:scope.id,position:scope.args[0],closedBodies:bodies.length,roofFaces:roofs.length,foundation:members.find(c=>c.kind==='groundPad')?.scope});
 }
 report.metrics.distantSkyline={rows,coverage:'Included without exemptions in whole-footprint burial, driving-prism, contact, cross-building and coplanarity tests'};
});


audit('Town geometry oracles reject a missing closure duplicate skin and positive-volume overlap',()=>{
 const body=changed.find(c=>c.method==='box'&&parts.closedShell(c))!,qs=parts.triangles.get(body)!;
 assert.equal(splitShellEdges(qs).length,0);assert.ok(splitShellEdges(qs.slice(1)).length>0);assert.ok(splitShellEdges([...qs,qs[0]]).length>0);
 const q=qs[0],same=coincidentOutwardPolygon(q,{...q,id:-1}),opposite=coincidentOutwardPolygon(q,{...q,id:-2,b:q.c,c:q.b});assert.ok(same&&area3D(same.polygon)>0);assert.equal(opposite,null);
 const planes=convex.get(body)!;assert.equal(area3D(triangleInsideConvex(q,planes)),0,'butt boundary must not count as positive-volume penetration');
 const center=polygonCenter(parts.points(body)),inside={...q,a:q.a.map((n,k)=>(n+center[k])/2),b:q.b.map((n,k)=>(n+center[k])/2),c:q.c.map((n,k)=>(n+center[k])/2)};assert.ok(area3D(triangleInsideConvex(inside,planes))>0);
});

audit('Town structural camera payload exactly equals all protected roadside and bridge faces',()=>{
 const blockers=g.cameraObstacles.filter(b=>b.triangles);assert.equal(blockers.length,1);const blocker=blockers[0];assert.equal(blocker.kind,'town-exact-roadside-and-bridge-structure');
 const expected:Triangle[]=[],spans:any[]=[];
 for(const batch of ['Cream sidewalk coping and civic columns','Ochre terrace retaining masonry']){
  const foundations=candidate.components.filter(c=>c.kind==='groundPad'&&c.batch===batch),kind=(c:TownPrimitive)=>candidate.scopes.find(s=>s.id===c.scope)!.args[0];
  const roadEnd=Math.min(...foundations.map(c=>c.vertexStart)),bridgeStart=Math.max(...foundations.filter(c=>kind(c)==='fork-wayfinding-board').map(c=>c.vertexEnd)),bridgeEnd=Math.min(...foundations.filter(c=>kind(c)==='terrace-house').map(c=>c.vertexStart));
  for(const [phase,start,end] of [['roadside',0,roadEnd],['bridge',bridgeStart,bridgeEnd]] as const){
   const triangles=mesh.triangles.filter(q=>q.batch===batch&&q.vertices.some(v=>v>=start&&v<end));assert.ok(triangles.every(q=>q.vertices.every(v=>v>=start&&v<end)),'protected span cuts an actual primitive');expected.push(...triangles);spans.push({batch,phase,vertexRange:[start,end],triangles:triangles.length});
  }
 }
 assert.deepEqual(spans.map(s=>s.triangles),[6320,212,3052,236]);assert.equal(expected.length,9820);assert.equal(blocker.triangles!.length,9820);
 const faceKey=(p:readonly V[])=>JSON.stringify(p),expectedKeys=expected.map(q=>faceKey([q.a,q.b,q.c])).sort(),actualKeys=blocker.triangles!.map(faceKey).sort();
 assert.deepEqual(actualKeys,expectedKeys,'payload must contain the complete oriented triangle multiset without invented or omitted faces');
 const bounds=boundsOf(expected.flatMap(q=>[q.a,q.b,q.c]));assert.deepEqual(blocker.min,bounds.min);assert.deepEqual(blocker.max,bounds.max);
 assert.ok([...blocker.min,...blocker.max].every(Number.isFinite));
 report.metrics.structuralCameraPayload={kind:blocker.kind,triangles:expected.length,spans,bounds,orientedFaceMultisetSHA256:digest(actualKeys),inventedFaces:0,omittedFaces:0,scope:'Bounds only locate the exact indexed face payload; no aggregate solid volume is asserted'};
});
