/** Additive preservation and architectural acceptance use final indexed buffers. */
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {WORKSHOP_COURSE} from '../../src/maps/workshop';
import {landTexturePixels} from '../../src/land-scenery';
import {workshopSceneData} from './workshop-enrichment-camera-scene';
import {MeshOracle,ComponentOracle,boundsOf,hullXZ,area,area3D,height,projectedInterval,prismIntersection,supportCoverage,coincidentOutwardPolygon,subtractTerrainBurial,subtractConvexSolid,convexPlanes,type V,type Provenance,type Triangle} from './emitted-scene-oracle';
import {triangleInsideConvex} from './town-enrichment-geometry';
const [stage,run,ledger]=process.argv.slice(2),started=Date.now();assert.ok(['baseline','candidate'].includes(stage));
const baseline=stage==='baseline',sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex'),digest=(v:unknown)=>sha(JSON.stringify(v));
const receipt=JSON.parse(readFileSync('tests/fixtures/workshop-enrichment-protected.json','utf8'));
const sourcePath=baseline?'docs/scene-baselines/workshop-scenery.ts.txt':'src/workshop-scenery.ts',sourceSha256=sha(readFileSync(sourcePath));
if(baseline)assert.equal(sourceSha256,receipt.originalScenerySha256);
const loaded=await workshopSceneData(baseline,ledger),g=loaded.geometry;
const immutableKeys=['version','trackId','roadSamples','routeRoadSamples','roadFaces','roadUndersideFaces','supportFaces','structures','landmarks','foundations','groundedDetails','gears','drawers','railMembers','bridgeMembers','sightlines','terrainGrid'] as const;
const appendKeys=['components','props','cameraObstacles'] as const;
const metadata={theme:digest(loaded.theme),...Object.fromEntries(immutableKeys.map(k=>[k,digest(g[k])]))};
const extras=Object.fromEntries(appendKeys.map(k=>[k,{length:g[k].length,sha256:digest(g[k])}]));
const material=(b:any)=>({name:b.name,color:b.color,roughness:b.roughness,metalness:b.metalness,texture:b.texture});
const batchContract=g.batches.map(b=>({material:material(b),vertices:b.positions.length/3,indices:b.indices.length,positions:digest(b.positions),uvs:digest(b.uvs),indexHash:digest(b.indices),normals:digest(pc.calculateNormals(b.positions,b.indices))}));
const textures=digest(Object.fromEntries((['stone','asphalt','wood','grass']as const).map(kind=>[kind,[...landTexturePixels(kind)]])));
if(baseline){
 assert.deepEqual(g.budget,receipt.baselineCounts);
 writeFileSync(join(run,'baseline-contract.json'),JSON.stringify({sourceSha256,metadata,extras,batches:batchContract,textures}));
 console.log(JSON.stringify({stage,sourceSha256,budget:g.budget}));
}else{
 const before=JSON.parse(readFileSync(join(run,'baseline-contract.json'),'utf8'));assert.equal(before.sourceSha256,receipt.originalScenerySha256);assert.deepEqual(metadata,before.metadata,'Original road, support, floor, bridge, landmarks, contacts and sightlines remain exact');assert.equal(textures,before.textures,'Shared procedural texture pixels unchanged');
 for(const k of appendKeys){assert.ok(g[k].length>=before.extras[k].length);assert.equal(digest(g[k].slice(0,before.extras[k].length)),before.extras[k].sha256,k+' original ordered prefix is exact');}
 assert.equal(g.batches.length,21);assert.equal(g.batches.length,before.batches.length);
 for(const [i,b]of g.batches.entries()){
  const old=before.batches[i],review=receipt.reviewedMaterialChanges[b.name];if(review){assert.deepEqual(old.material,review.previous,b.name+' historical material is unchanged');assert.deepEqual(material(b),review.current,b.name+' only explicitly reviewed source-local material selector differs');}else assert.deepEqual(material(b),old.material,'Every unreviewed material family and value remains exact');
  assert.equal(digest(b.positions.slice(0,old.vertices*3)),old.positions,b.name+' original positions');assert.equal(digest(b.uvs.slice(0,old.vertices*2)),old.uvs,b.name+' original UVs');assert.equal(digest(b.indices.slice(0,old.indices)),old.indexHash,b.name+' original index buffer');
  assert.ok(b.indices.slice(old.indices).every(v=>v>=old.vertices),'New faces cannot reuse original vertices');assert.equal(digest(pc.calculateNormals(b.positions,b.indices).slice(0,old.vertices*3)),old.normals,b.name+' actual original normals');
  assert.equal(b.positions.length%3,0);assert.equal(b.uvs.length,b.positions.length/3*2);assert.equal(b.indices.length%3,0);assert.ok(b.positions.every(Number.isFinite)&&b.uvs.every(Number.isFinite));assert.ok(b.indices.every(v=>Number.isInteger(v)&&v>=0&&v<b.positions.length/3));
  if(b.name==='Workshop joined maple room floor')assert.equal(b.indices.length,old.indices,'Floor batch contains only the unchanged heightfield');
 }
 assert.ok(g.budget.triangles>97508&&g.budget.triangles<=105008&&g.budget.triangles<110000,JSON.stringify(g.budget));assert.ok(g.budget.vertices<=165000&&g.budget.vertices<200000);
 const assemblies=(g as any).enrichmentAssemblies as {id:string;label:string;support:string;pieces:(Provenance&{id:string;supportOwner:string;min:number[];max:number[]})[];groundContacts:{pieceId:string;footprint:number[][];bottom:number;supportType:string;supportTop?:number}[];cameraBlockerKind:string}[];
 assert.ok(Array.isArray(assemblies)&&assemblies.length>0,'Architectural additions need explicit assembly records');assert.equal(new Set(assemblies.map(a=>a.id)).size,assemblies.length);
 const addedPieces=assemblies.flatMap(a=>a.pieces.map(p=>({...p,kind:p.id,assembly:a.id})));assert.equal(new Set(addedPieces.map(p=>p.id)).size,addedPieces.length,'Stable piece IDs are unique');
 const originalComponents=g.components.slice(0,before.extras.components.length),supportKinds=new Set(['east-workbench-slab','vise-worktop-wing','lamp-worktop-wing','return-drawer-worktop-wing']);
 const provenance:Provenance[]=[],originalParts:Provenance[]=[];
 for(const [i,b]of g.batches.entries()){
  const old=before.batches[i],owners=new Array<Provenance>(old.vertices),used=new Set<Provenance>();
  for(const c of originalComponents.filter(c=>c.batch===b.name)){const part={...c,indexStart:-1,indexEnd:-1,role:'original'};for(let v=c.vertexStart;v<c.vertexEnd;v++){assert.equal(owners[v],undefined,'Original component ownership is unambiguous');owners[v]=part;}}
  let previous:Provenance|undefined;
  for(let index=0;index<old.indices;index+=3){
   let part=owners[b.indices[index]];assert.ok(b.indices.slice(index,index+3).every(v=>owners[v]===part),'Actual original triangle has one component owner');
   if(!part){if(previous?.kind.startsWith('original-unowned:'))part=previous;else part={kind:'original-unowned:'+b.name+':'+index,batch:b.name,vertexStart:0,vertexEnd:old.vertices,indexStart:index,indexEnd:index+3,role:'original'};}
   if(part!==previous){assert.ok(!used.has(part),'Original component index ownership is contiguous');used.add(part);part.indexStart=index;provenance.push(part);originalParts.push(part);}part.indexEnd=index+3;previous=part;
  }
  let cursor=old.indices;
  for(const part of addedPieces.filter(c=>c.batch===b.name).sort((a,b)=>a.indexStart-b.indexStart)){assert.equal(part.indexStart,cursor,'Each new indexed face has one contiguous piece owner');assert.ok(Number.isInteger(part.indexEnd)&&part.indexEnd%3===0&&part.indexEnd>part.indexStart);provenance.push(part);cursor=part.indexEnd;}
  assert.equal(cursor,b.indices.length,'All new indexed faces must belong to one exact assembly piece');
 }
 const supports=originalParts.filter(c=>supportKinds.has(c.kind));
 const mesh=new MeshOracle(g.batches),parts=new ComponentOracle(mesh,provenance),addedSet=new Set(addedPieces),changed=mesh.triangles.filter(q=>addedSet.has(parts.owner.get(q.id) as any));assert.equal(changed.length,g.budget.triangles-97508,'Each additive triangle has exactly one piece owner');
 const terrainIds=new Set(mesh.triangles.filter(q=>q.batch==='Workshop joined maple room floor').map(q=>q.id));
 const roadIds=new Set(mesh.triangles.filter(q=>['Workshop pale sealed maple road','Workshop cabinet road inlay'].includes(q.batch)).map(q=>q.id));
 const faceKey=(v:readonly V[])=>JSON.stringify(v),counts=(faces:readonly (readonly V[])[])=>{const result=new Map<string,number>();for(const f of faces){const k=faceKey(f);result.set(k,(result.get(k)??0)+1);}return [...result].sort(([a],[b])=>a.localeCompare(b));};
 let contacts=0,grounded=0,cameraFaces=0,roadPairs=0,coflushPairs=0;const coflush:any[]=[],buriedCoflush:any[]=[],structuralIntersections:any[]=[],floorTrimContacts:any[]=[];
 for(const a of assemblies){
  assert.ok(a.label&&a.pieces.length&&a.groundContacts.length,a.id+' has meaningful ownership and grounding');
  const members=addedPieces.filter(p=>p.assembly===a.id),prior=new Map<string,Provenance>(),rootIds=new Set(a.groundContacts.map(c=>c.pieceId));
  for(const p of members){
   assert.ok(p.role&&p.supportOwner,p.id+' declares its role and support owner');assert.deepEqual(parts.bounds.get(p),{min:p.min,max:p.max},p.id+' declared bounds match actual indexed triangles');assert.ok(parts.closedShell(p),p.id+' is a closed consistently wound indexed solid');
   const original=before.batches[g.batches.findIndex(b=>b.name===p.batch)];assert.ok(p.vertexStart>=original.vertices&&p.indexStart>=original.indices,'New piece owns only new buffer suffix');
   const registered=g.components.slice(before.extras.components.length).filter(c=>c.batch===p.batch&&c.vertexStart===p.vertexStart&&c.vertexEnd===p.vertexEnd);assert.equal(registered.length,1,p.id+' also appears in original independent-audit component inventory');assert.equal(registered[0].landmark,undefined,'New assembly cannot borrow a landmark reservation');
   if(rootIds.has(p.id)){assert.equal(p.supportOwner,a.support,'Grounded root names actual assembly support');}
   else{const owner=prior.get(p.supportOwner);assert.ok(owner,p.id+' support owner must be an earlier piece of this assembly');assert.ok(parts.attachment(p,owner),p.id+' has actual indexed attachment to '+p.supportOwner);contacts++;}prior.set(p.id,p);
  }
  for(const contact of a.groundContacts){
   const p=members.find(p=>p.id===contact.pieceId);assert.ok(p,'Ground contact names actual owned member');assert.equal(contact.supportType,a.support);
   const points=parts.points(p),bottom=Math.min(...points.map(v=>v[1]));assert.ok(Math.abs(contact.bottom-bottom)<1e-8,'Declared bottom is actual indexed bottom');
   const footprint=hullXZ(points.filter(v=>Math.abs(v[1]-bottom)<1e-8));assert.ok(footprint.length>=3&&area(footprint)>1e-7,'Indexed base has full footprint');
   const authored=hullXZ(contact.footprint);assert.equal(authored.length,footprint.length);for(let i=0;i<footprint.length;i++)assert.ok(Math.hypot(authored[i][0]-footprint[i][0],authored[i][2]-footprint[i][2])<1e-7,'Declared contact matches complete indexed base');
   const support=a.support==='floor'?null:supports.find(s=>s.kind===a.support);assert.ok(a.support==='floor'||support,'Named support is an actual unchanged slab/wing');
   const ids=support?new Set(parts.triangles.get(support)!.map(q=>q.id)):terrainIds;
   const coverage=supportCoverage(mesh,footprint,(q,overlap)=>{
    if(!ids.has(q.id))return false;if(support&&q.max[1]<parts.bounds.get(support)!.max[1]-1e-6)return false;
    return overlap.every(v=>{const y=height(q,v[0],v[2]),gap=y-bottom;return gap>=-1e-6&&gap<=.3+1e-6;});
   });assert.ok(coverage.uncovered<1e-6,p.id+' complete emitted base must contact its actual support; gap/penetration ≤0.3m');grounded++;
   if(support)assert.ok(parts.attachment(p,support),p.id+' touches the named original slab');
  }
  const blockers=g.cameraObstacles.slice(before.extras.cameraObstacles.length).filter(o=>o.kind===a.cameraBlockerKind);assert.equal(blockers.length,1,a.id+' has one uniquely identified exact mesh blocker');assert.ok(blockers[0].triangles);
  const actual=members.flatMap(p=>parts.triangles.get(p)!.map(q=>[q.a,q.b,q.c]));assert.deepEqual(counts(blockers[0].triangles!),counts(actual),a.id+' exact camera face coverage and multiplicity');assert.deepEqual({min:blockers[0].min,max:blockers[0].max},boundsOf(actual.flat()));cameraFaces+=actual.length;
 }
 // Independent assemblies cannot swallow or pierce original landmarks,
 // shelves or unrelated furniture. Only actual root/support contacts qualify.
 const rootSupport=new Map(assemblies.flatMap(a=>a.groundContacts.map(c=>[c.pieceId,a.support] as const)));
 for(const part of addedPieces){
  const planes=convexPlanes(parts,part);assert.ok(planes,part.id+' emitted box is a convex closed solid');const box=parts.bounds.get(part)!;
  for(const q of mesh.query(box.min,box.max)){
   const owner=parts.owner.get(q.id)!;if(owner===part||owner.assembly===part.assembly||q.min.some((v,k)=>v>box.max[k]+1e-7)||q.max.some((v,k)=>v<box.min[k]-1e-7))continue;
   const polygon=triangleInsideConvex(q,planes);if(area3D(polygon)<=1e-7)continue;
   const support=rootSupport.get(part.id);
   if(support==='floor'&&terrainIds.has(q.id)||support&&support===owner.kind)continue;
   // The original tiny floor-joint strips are part of the contact surface,
   // not free-standing props. Record exact indexed witnesses at grounded feet.
   if(support==='floor'&&['flush-floor-panel-joint','flush-floor-panel-end'].includes(owner.kind)&&polygon.every(p=>p[1]<=.09+1e-8)){floorTrimContacts.push({piece:part.id,kind:owner.kind,batch:q.batch,indexStart:q.indexStart,polygon});continue;}
   structuralIntersections.push({piece:part.id,other:owner.kind,otherAssembly:owner.assembly,batch:q.batch,indexStart:q.indexStart,polygon});
  }
  const neighbors=new Set(mesh.query(box.min,box.max).map(q=>parts.owner.get(q.id)!));
  for(const owner of neighbors){
   if(owner===part||owner.assembly===part.assembly||addedSet.has(owner as any))continue;
   const support=rootSupport.get(part.id);if(support&&support===owner.kind||support==='floor'&&['flush-floor-panel-joint','flush-floor-panel-end'].includes(owner.kind))continue;
   for(const point of parts.points(part))if(parts.inside(point,owner)){structuralIntersections.push({piece:part.id,other:owner.kind,reason:'new indexed vertex contained by original closed component',point});break;}
  }
 }
 assert.equal(structuralIntersections.length,0,'Independent source structures intersect new architecture: '+JSON.stringify(structuralIntersections.slice(0,16)));
 assert.equal(g.cameraObstacles.length-before.extras.cameraObstacles.length,assemblies.length,'No new enclosing proxy camera boxes');assert.equal(g.components.length-before.extras.components.length,addedPieces.length,'All new component declarations have assembly ownership');
 for(const q of changed){
  assert.ok(area3D([q.a,q.b,q.c])>1e-10,'Additions contain no degenerate faces');
  for(const road of mesh.query(q.min,q.max))if(roadIds.has(road.id)&&road.min[1]+2.3>=q.min[1]&&road.max[1]+.15<=q.max[1]){roadPairs++;assert.ok(area3D(prismIntersection(q,road,.15,2.3))<1e-7,`New ${parts.owner.get(q.id)?.kind} enters actual road body prism at ${road.id}`);}
  for(const other of mesh.query(q.min,q.max)){
   if(other.id===q.id||addedSet.has(parts.owner.get(other.id) as any)&&other.id<q.id||other.min.some((n,k)=>n>q.max[k]+1e-7)||other.max.some((n,k)=>n<q.min[k]-1e-7))continue;
   const patch=coincidentOutwardPolygon(q,other);if(!patch)continue;coflushPairs++;
   // A same-facing skin is hidden only when its entire outward side is
   // covered by a third actual closed solid; center points/AABBs do not prove it.
   let uncovered=subtractTerrainBurial(mesh,terrainIds,patch.polygon.map(p=>p.map((v,k)=>v+patch.normal[k]*1e-5)));const covering:string[]=[];
   const owners=new Set(mesh.query(q.min,q.max,.0001).map(face=>parts.owner.get(face.id)!));
   for(const owner of owners){if(owner===parts.owner.get(q.id)||owner===parts.owner.get(other.id))continue;const planes=convexPlanes(parts,owner);if(!planes)continue;const before=uncovered.reduce((n,p)=>n+area3D(p),0);uncovered=uncovered.flatMap(p=>subtractConvexSolid(p,planes));if(uncovered.reduce((n,p)=>n+area3D(p),0)<before-1e-9)covering.push(owner.kind);if(!uncovered.length)break;}
   const exposed=uncovered.reduce((n,p)=>n+area3D(p),0),record={piece:parts.owner.get(q.id)?.kind,face:q.id,faceIndexStart:q.indexStart,vertices:[q.a,q.b,q.c],other:other.id,otherIndexStart:other.indexStart,otherVertices:[other.a,other.b,other.c],batch:other.batch,otherOwner:parts.owner.get(other.id)?.kind,area:area3D(patch.polygon),exposedArea:exposed,covering,uncovered};(exposed>1e-7?coflush:buriedCoflush).push(record);
  }
 }
 if(coflush.length&&process.env.WORKSHOP_ENRICHMENT_GEOMETRY_AUDIT_DIR){const output=resolve(process.env.WORKSHOP_ENRICHMENT_GEOMETRY_AUDIT_DIR);mkdirSync(output,{recursive:true});writeFileSync(join(output,'coflush-failures.json'),JSON.stringify({sourceSha256,coflush,buriedCoflush},null,2)+'\n');}
 assert.equal(coflush.length,0,'New exposed same-facing coflush indexed skins across all materials: '+JSON.stringify(coflush.slice(0,20)));
 let bodyPoints=0;
 for(const edge of Object.values(WORKSHOP_COURSE.edges))for(let s=0;s<=edge.length;s=Math.min(edge.length,s+2)){
  for(const lane of [-1,0,1])for(const lift of [.4,1.5]){const frame=edge.sample(s,lane*edge.laneLimitAt(s)),p=[frame.p.x,frame.p.y+lift,frame.p.z];for(const part of addedPieces)assert.ok(!parts.inside(p,part),`${edge.id}:${s} supported kart body contained by ${part.id}`);bodyPoints++;}if(s===edge.length)break;
 }
 // Visibility is evaluated in genuine frozen forward chase poses. The four
 // landmark-directed rays are intentionally not substituted for these views.
 const viewManifest=JSON.parse(readFileSync('docs/workshop-enrichment-cameras.json','utf8'));
 const forwardVisibility:any[]=[];
 for(const view of viewManifest.views.filter((v:any)=>v.name.startsWith('workshop-chase-'))){
  const eye:V=view.sourceEye,target:V=view.sourceTarget,forward=target.map((v,k)=>v-eye[k]),length=Math.hypot(...forward);forward.forEach((v,k)=>forward[k]=v/length);
  const right=[-forward[2],0,forward[0]],rightLength=Math.hypot(...right);right.forEach((v,k)=>right[k]=v/rightLength);const up=[right[1]*forward[2]-right[2]*forward[1],right[2]*forward[0]-right[0]*forward[2],right[0]*forward[1]-right[1]*forward[0]];
  const rows=assemblies.map(a=>({assembly:a.id,inFrustumFaceCenters:0,visibleFaceCenterRays:0,firstSurfaceWitness:null as any}));
  for(const q of changed){const point=[0,1,2].map(k=>(q.a[k]+q.b[k]+q.c[k])/3),ray=point.map((v,k)=>v-eye[k]),dot=(axis:V)=>axis.reduce((n,v,k)=>n+v*ray[k],0),depth=dot(forward),tan=Math.tan(28*Math.PI/180);if(depth<=0||Math.abs(dot(right))>=depth*tan*16/9||Math.abs(dot(up))>=depth*tan)continue;
   const owner=parts.owner.get(q.id)!,row=rows.find(r=>r.assembly===owner.assembly)!;row.inFrustumFaceCenters++;const hit=mesh.firstHit(eye,point);
   if(hit&&parts.owner.get(hit.triangle.id)?.assembly===owner.assembly){row.visibleFaceCenterRays++;row.firstSurfaceWitness??={batch:hit.triangle.batch,indexStart:hit.triangle.indexStart,vertices:[hit.triangle.a,hit.triangle.b,hit.triangle.c],eye,rayTarget:point};}
  }forwardVisibility.push({view:view.name,rows});
 }
 const unseenAssemblies=assemblies.filter(a=>!forwardVisibility.some(v=>v.rows.some((r:any)=>r.assembly===a.id&&r.visibleFaceCenterRays>0))).map(a=>a.id);
 const report={schema:'workshop-enrichment-geometry-v1',sourceSha256,baselineSourceSha256:before.sourceSha256,budget:g.budget,reviewedMaterialChanges:receipt.reviewedMaterialChanges,addedTriangles:changed.length,assemblies:assemblies.length,pieces:addedPieces.length,contacts,grounded,cameraFaces,roadPairs,bodyPoints,coflushPairs,wholePolygonBuriedCoflush:buriedCoflush,independentStructureIntersections:structuralIntersections.length,exactGroundedFloorTrimContacts:floorTrimContacts,forwardChaseVisibility:{scope:'Finite indexed face-center visibility in13 frozen actual forward-chase poses; not full silhouette or GPU proof',views:forwardVisibility,unseenAssemblies},exposedCoflush:coflush.length,durationSeconds:(Date.now()-started)/1000,resources:{maxRSSKiB:process.resourceUsage().maxRSS,heapCapMiB:448,concurrency:1}};
 assert.equal(sha(readFileSync(sourcePath)),sourceSha256,'Source unchanged through audit');writeFileSync(join(run,'candidate-report.json'),JSON.stringify(report)+'\n');if(process.env.WORKSHOP_ENRICHMENT_GEOMETRY_AUDIT_DIR){const output=resolve(process.env.WORKSHOP_ENRICHMENT_GEOMETRY_AUDIT_DIR);mkdirSync(output,{recursive:true});writeFileSync(join(output,'geometry-report.json'),JSON.stringify(report,null,2)+'\n');}console.log(JSON.stringify({stage,sourceSha256,budget:g.budget,assemblies:assemblies.length,pieces:addedPieces.length,contacts,grounded,cameraFaces,coflushPairs,wholePolygonBuriedCoflushWitnesses:buriedCoflush.length,exposedCoflush:coflush.length,unseenAssemblies,durationSeconds:report.durationSeconds,resources:report.resources}));
}
