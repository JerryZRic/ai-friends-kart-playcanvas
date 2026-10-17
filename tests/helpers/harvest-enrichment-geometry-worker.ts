import {postV100HistoricalScene} from './post-v100-historical-scene';
/** Serial, independent Harvest preservation/contact/coflush audit. */
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {landTexturePixels} from '../../src/land-scenery';
import {harvestSceneData} from './harvest-enrichment-scene';
import {harvestCameraChecks} from './harvest-enrichment-camera-checks';
import {harvestLandscapeChecks} from './harvest-enrichment-landscape';
import {harvestAssemblyChecks} from './harvest-enrichment-assemblies';
import {harvestFileHash as sha,harvestDigest as digest,harvestParts,harvestPartPayload,harvestProtection,harvestMaterial,type HarvestPart} from './harvest-enrichment-contract';
import {MeshOracle,ComponentOracle,area,area3D,cross2,boundsOf,height,hullXZ,projectedInterval,prismIntersection,supportCoverage,coincidentOutwardPolygon,subtractTerrainBurial,subtractConvexSolid,convexPlanes,type V,type Triangle} from './emitted-scene-oracle';
const [stage,run,ledger]=process.argv.slice(2),baseline=stage==='baseline',started=Date.now();assert.ok(['baseline','candidate'].includes(stage));
const receipt=JSON.parse(readFileSync('tests/fixtures/harvest-enrichment-protected.json','utf8'));
const path=baseline?'docs/scene-baselines/harvest-scenery.ts.txt':'src/harvest-scenery.ts',sourceSha256=sha(readFileSync(path));
const loaded=baseline?await harvestSceneData(true,ledger):await postV100HistoricalScene('harvest'),g=loaded.geometry,originalCounts={components:g.components.length,foundations:g.foundations.length,props:g.props.length,cameraObstacles:g.cameraObstacles.length},provenance=harvestParts(g),protection=harvestProtection(g,provenance,loaded.theme);
const identities=provenance.map(p=>({kind:p.kind,scope:p.scope,hash:digest(harvestPartPayload(g,p))}));
const textureHash=digest(Object.fromEntries((['stone','asphalt','wood','grass'] as const).map(k=>[k,[...landTexturePixels(k)]])));
const before=baseline?null:JSON.parse(readFileSync(join(run,'baseline-contract.json'),'utf8'));
if(baseline){assert.equal(sourceSha256,receipt.originalScenerySha256);assert.deepEqual(g.budget,receipt.baselineCounts);}
else{
 assert.equal(before.sourceSha256,receipt.originalScenerySha256);assert.deepEqual(protection,before.protection,'Original road/support/terrain/architecture/roots/gameplay-facing geometry remains byte-for-number exact');assert.equal(textureHash,before.textureHash);
 assert.equal(g.batches.length,22);assert.deepEqual(g.batches.slice(0,21).map(b=>b.name),before.materials.map((b:any)=>b.name));assert.deepEqual(g.batches.slice(21).map(harvestMaterial),receipt.approvedMaterialAdditions,'Only one explicitly reviewed new cultivated-earth batch');
 for(const b of g.batches.slice(0,21)){const old=before.materials.find((a:any)=>a.name===b.name),review=receipt.reviewedMaterialChanges[b.name];if(review){assert.deepEqual(old,review.previous);assert.deepEqual(harvestMaterial(b),review.current);}else assert.deepEqual(harvestMaterial(b),old,b.name+' original material remains exact');}
 assert.equal(g.cropRows.length,47,'Original accepted crop row count retained');assert.equal(g.trees.length,27+receipt.approvedLandscape.vegetation.filter((v:any)=>v.kind==='grouped-fruit-tree').length,'Original27 roots and explicitly supported new trees');
 assert.ok(g.budget.triangles<118000,JSON.stringify(g.budget));assert.ok(g.budget.vertices<200000);
}
for(const b of g.batches){assert.equal(b.positions.length%3,0);assert.equal(b.uvs.length,b.positions.length/3*2);assert.equal(b.indices.length%3,0);assert.ok(b.positions.every(Number.isFinite)&&b.uvs.every(Number.isFinite));assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));assert.ok(pc.calculateNormals(b.positions,b.indices).every(Number.isFinite),'Every actual computed normal is finite');}
const actualBounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};for(const b of g.batches)for(const index of b.indices)for(let k=0;k<3;k++){actualBounds.min[k]=Math.min(actualBounds.min[k],b.positions[index*3+k]);actualBounds.max[k]=Math.max(actualBounds.max[k],b.positions[index*3+k]);}assert.deepEqual(g.bounds,actualBounds,'Global bounds exactly reflect all current actual indexed geometry');
const mesh=new MeshOracle(g.batches),parts=new ComponentOracle(mesh,provenance),terrainIds=new Set(mesh.triangles.filter(q=>q.batch==='Harvest connected contour earth').map(q=>q.id));
const roadIds=new Set(mesh.triangles.filter(q=>['Harvest packed ochre racing earth','Harvest pale yard pavers and coping'].includes(q.batch)&&parts.owner.get(q.id)!.kind!=='road-edge-coping').map(q=>q.id));
const candidateParts=provenance.filter(p=>p.scope!=='protected'),candidateSet=new Set(candidateParts);
const remaining=new Map<string,number>();for(const p of before?.identities??identities)remaining.set(p.hash,(remaining.get(p.hash)??0)+1);
const changed=provenance.filter(p=>{const k=digest(harvestPartPayload(g,p)),n=remaining.get(k)??0;if(n){remaining.set(k,n-1);return false;}return true;});
assert.ok(changed.every(p=>p.scope!=='protected'),'Every changed indexed component has an explicit approved agricultural scope');
const inspectedParts=baseline?candidateParts:changed,inspectedSet=new Set(inspectedParts),inspectedFaces=mesh.triangles.filter(q=>inspectedSet.has(parts.owner.get(q.id) as HarvestPart));
for(const p of provenance)if(p.sourceComponent!==undefined){const c=g.components[p.sourceComponent];assert.deepEqual(parts.bounds.get(p),{min:c.min,max:c.max},p.id+' complete indexed bounds');}
const groundAt=(p:V)=>{const q=mesh.query(p,p).find(q=>terrainIds.has(q.id)&&projectedInterval(q,p,p));assert.ok(q,'Emitted terrain covers point '+p);return height(q,p[0],p[2]);};
const pointRoadDistance=(p:V,q:Triangle)=>{if(projectedInterval(q,p,p))return 0;return Math.min(...[q.a,q.b,q.c].map((a,i,all)=>{const b=all[(i+1)%3],dx=b[0]-a[0],dz=b[2]-a[2],u=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-u*dx,p[2]-a[2]-u*dz);}));};
let cropFaces=0,cropRootVertices=0,cropTopVertices=0,cropTerrainIntersections=0,treeVertices=0,rootFootprints=0,treeContacts=0,roadPairs=0;
for(const p of provenance.filter(p=>p.kind==='field-surface'))for(const q of parts.triangles.get(p)!){
 cropFaces++;for(const v of [q.a,q.b,q.c]){const gap=v[1]-groundAt(v);if(Math.abs(gap+.04)<1e-6)cropRootVertices++;else{assert.ok([.26,.30,.75,1.05,1.15].some(h=>Math.abs(h-gap)<1e-6),'Every original three-batch crop vertex has an approved actual terrain offset');cropTopVertices++;}}
 if(area([q.a,q.b,q.c])>1e-8){assert.ok(cross2(q.a,q.b,q.c)<0,'Every complete crop top has upward winding');const coverage=supportCoverage(mesh,[q.a,q.b,q.c],(terrain,poly)=>{if(!terrainIds.has(terrain.id))return false;const gaps=poly.map(v=>height(q,v[0],v[2])-height(terrain,v[0],v[2]));assert.ok(Math.max(...gaps)-Math.min(...gaps)<1e-6,'Whole crop top remains source-terrain affine');cropTerrainIntersections++;return true;});assert.ok(coverage.uncovered<1e-5,'Whole crop top has emitted terrain support');}
}
assert.ok(cropFaces>3000&&cropRootVertices>1000&&cropTopVertices>1000);
const orchardGroups:HarvestPart[][]=[];
for(const [i,c]of g.components.entries())if(['orchard-grounded-flared-root','orchard-supported-branch','orchard-original-lobed-canopy','orchard-visible-apples'].includes(c.kind)){if(c.kind==='orchard-grounded-flared-root')orchardGroups.push([]);const p=provenance.find(p=>p.sourceComponent===i);assert.ok(p);assert.ok(orchardGroups.length);orchardGroups.at(-1)!.push(p);}
assert.equal(orchardGroups.length,27);assert.equal(provenance.filter(p=>p.kind==='wheat-grounded-stem').length,34,'Original accepted wheat stems retained');assert.equal(provenance.filter(p=>p.kind==='wheat-modeled-seed-head').length,34,'Original accepted wheat heads retained');
for(const [i,members]of orchardGroups.entries()){
 const tree=g.trees[i];if(!baseline){const mature=receipt.approvedLandscape.matureOriginalTreeOrdinals.includes(i),col=Math.round((tree.position[0]+410)/21.5),row=Math.round((tree.position[2]-125-7*Math.sin(col*.38))/24);assert.equal(mature,[2,3,4,5,10,11,12,13,14].includes(i),'Exactly nine reviewed original tree ordinals');assert.equal(tree.radius,mature?9.6:4.2+(col%3)*.3+1);}
 const root=members.find(p=>p.kind==='orchard-grounded-flared-root')!,branches=members.filter(p=>p.kind==='orchard-supported-branch'),crowns=members.filter(p=>p.kind==='orchard-original-lobed-canopy'),apples=members.filter(p=>p.kind==='orchard-visible-apples');assert.equal(branches.length,3);assert.equal(crowns.length,3);assert.equal(apples.length,6);
 for(const p of members)for(const v of parts.points(p)){assert.ok(Math.hypot(v[0]-tree.position[0],v[2]-tree.position[2])<=tree.radius+1e-7,'Full emitted orchard extent fits declared radius');treeVertices++;}
 if(!baseline)assert.ok(Math.abs(tree.height-(Math.max(...members.flatMap(p=>parts.points(p).map(v=>v[1])))-tree.position[1]))<1e-7,'Revised tree height metadata equals complete actual emitted height');
 for(const q of mesh.query(tree.position,tree.position,tree.radius+24))if(roadIds.has(q.id))assert.ok(pointRoadDistance(tree.position,q)>tree.radius+23-1e-6,'Complete orchard reservation clears actual indexed roads by23m');
 const bottom=parts.bounds.get(root)!.min[1],foot=hullXZ(parts.points(root).filter(v=>Math.abs(v[1]-bottom)<1e-8));
 const coverage=supportCoverage(mesh,foot,(q,poly)=>terrainIds.has(q.id)&&poly.every(v=>bottom<height(q,v[0],v[2])-1e-6));assert.ok(coverage.uncovered<1e-7,'Complete emitted orchard root base remains below exact terrain');rootFootprints++;
 for(const p of branches){assert.ok(parts.attachment(p,root),'Every changed branch joins its actual original root/trunk');treeContacts++;}
 for(const p of crowns){assert.ok(parts.closedShell(p),'Orchard crown indexed shell remains closed/wound');assert.ok(branches.some(q=>parts.attachment(p,q)),'Every changed crown has actual supported branch contact');treeContacts++;}
 for(const p of apples){assert.ok(crowns.some(q=>parts.attachment(p,q)),'Every changed apple contacts or is contained by its own supported crown');treeContacts++;}
}
const faceKey=(q:Triangle)=>digest({batch:q.batch,points:[q.a,q.b,q.c]}),occurrences=new Map<string,number>(),faceKeys=mesh.triangles.map(q=>{const k=faceKey(q),n=occurrences.get(k)??0;occurrences.set(k,n+1);return k+':'+n;});
const intentionalOppositeContacts:any[]=[];
const baselineCoflush=before?.coflush??{},coflush:Record<string,number>={},coflushWitnesses:any[]=[],newCoflush:any[]=[],buriedCoflush:any[]=[],degeneracies:any[]=[];
for(const q of inspectedFaces){
 if(area3D([q.a,q.b,q.c])<1e-10){const owner=parts.owner.get(q.id)!;assert.ok(!['assembly','landform','raised-field','vegetation'].includes((owner as HarvestPart).scope),'No new agricultural piece may contain a degenerate indexed face');degeneracies.push({kind:owner.kind,localIndex:q.indexStart!-owner.indexStart});continue;}
 for(const road of mesh.query(q.min,q.max))if(roadIds.has(road.id)&&road.max[1]+2.3>=q.min[1]&&road.min[1]+.15<=q.max[1]){roadPairs++;assert.ok(area3D(prismIntersection(q,road,.15,2.3))<1e-7,'Changed agricultural geometry intrudes into actual road body prism');}
 for(const other of mesh.query(q.min,q.max)){
  if(other.id===q.id||inspectedSet.has(parts.owner.get(other.id) as HarvestPart)&&other.id<q.id||other.min.some((v,k)=>v>q.max[k]+1e-7)||other.max.some((v,k)=>v<q.min[k]-1e-7))continue;
  let patch=coincidentOutwardPolygon(q,other);if(!patch){const opposite=coincidentOutwardPolygon(q,{...other,b:other.c,c:other.b});if(!opposite)continue;const a=parts.owner.get(q.id)!,b=parts.owner.get(other.id)!;if(convexPlanes(parts,a)&&convexPlanes(parts,b)){intentionalOppositeContacts.push({face:q.id,other:other.id,kind:a.kind,otherKind:b.kind,polygon:opposite.polygon,area:area3D(opposite.polygon),proof:'Complete opposite-facing shared patch of two actual closed outward convex solids'});continue;}patch=opposite;}
  let uncovered=subtractTerrainBurial(mesh,terrainIds,patch.polygon.map(p=>p.map((v,k)=>v+patch.normal[k]*1e-5)));const covering:string[]=[];
  for(const owner of new Set(mesh.query(q.min,q.max,.0001).map(q=>parts.owner.get(q.id)!))){if(owner===parts.owner.get(q.id)||owner===parts.owner.get(other.id))continue;const planes=convexPlanes(parts,owner);if(!planes)continue;const areaBefore=uncovered.reduce((n,p)=>n+area3D(p),0);uncovered=uncovered.flatMap(p=>subtractConvexSolid(p,planes));if(uncovered.reduce((n,p)=>n+area3D(p),0)<areaBefore-1e-9)covering.push(owner.kind);if(!uncovered.length)break;}
  const exposed=uncovered.reduce((n,p)=>n+area3D(p),0),key=[faceKeys[q.id],faceKeys[other.id]].sort().join('|'),w={face:q.id,other:other.id,kind:parts.owner.get(q.id)!.kind,otherKind:parts.owner.get(other.id)!.kind,area:area3D(patch.polygon),exposedArea:exposed,vertices:[q.a,q.b,q.c],otherVertices:[other.a,other.b,other.c],covering,uncovered};
  if(exposed>1e-7){coflush[key]=exposed;coflushWitnesses.push(w);if(!baseline&&(!Object.hasOwn(baselineCoflush,key)||exposed>baselineCoflush[key]+1e-9))newCoflush.push(w);}else buriedCoflush.push(w);
 }
}
// Degenerate oval pole triangles are an inherited topology property, never a
// licence for collapsed new faces. Compare each changed primitive's local slots.
const degenerateTopology=provenance.filter(p=>['field','orchard'].includes(p.scope)).map(p=>({kind:p.kind,indices:parts.triangles.get(p)!.filter(q=>area3D([q.a,q.b,q.c])<1e-10).map(q=>q.indexStart!-p.indexStart)})).filter(p=>p.indices.length);
if(!baseline){
 const mature=new Set(receipt.approvedLandscape.matureOriginalTreeOrdinals),revised=new Map<HarvestPart,{sides:number;rings:number}>();
 for(const [i,members]of orchardGroups.entries())for(const p of members.filter(p=>p.kind==='orchard-original-lobed-canopy'))revised.set(p,{sides:mature.has(i)?10:8,rings:mature.has(i)?5:4});
 for(const [p,{sides,rings}]of revised){const payload=harvestPartPayload(g,p),indices:number[]=[],uvs:number[]=[];for(let j=0;j<=rings;j++)for(let i=0;i<sides;i++)uvs.push(i/sides,j/rings);for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){const a=j*sides+i,c=j*sides+(i+1)%sides;indices.push(a,c,a+sides,c,c+sides,a+sides);}assert.deepEqual(payload.indices,indices,'Only exact reviewed original oval topology');assert.deepEqual(payload.uvs,uvs);assert.equal(payload.positions.length,(rings+1)*sides*3);}
 const exceptCrowns=(rows:any[])=>rows.filter(p=>p.kind!=='orchard-original-lobed-canopy');assert.deepEqual(exceptCrowns(degenerateTopology),exceptCrowns(before.degenerateTopology),'Every other inherited oval pole slot remains exact');
 for(const [p,{sides,rings}]of revised){const expected=[...Array.from({length:sides},(_,i)=>i*6),...Array.from({length:sides},(_,i)=>((rings-1)*sides+i)*6+3)];assert.deepEqual(parts.triangles.get(p)!.filter(q=>area3D([q.a,q.b,q.c])<1e-10).map(q=>q.indexStart!-p.indexStart),expected,'Only explicitly reviewed original crown pole slots remain degenerate');}
}
let cameraFaces=0;
if(!baseline){
 const newBlockers=g.cameraObstacles.filter(o=>o.kind.startsWith('harvest-enrichment-')),actualKeys=new Set(mesh.triangles.map(q=>digest([q.a,q.b,q.c]))),cameraKeys=new Set<string>();
 for(const blocker of newBlockers){assert.ok(blocker.triangles&&!blocker.heightfield,'Only actual mesh camera payloads, never enclosing boxes');assert.deepEqual({min:blocker.min,max:blocker.max},boundsOf(blocker.triangles!.flat()));for(const face of blocker.triangles!){const key=digest(face);assert.ok(actualKeys.has(key),'New camera payload is actual emitted indexed geometry');cameraKeys.add(key);cameraFaces++;}}
 for(const p of changed.filter(p=>p.scope==='orchard'))for(const q of parts.triangles.get(p)!)assert.ok(cameraKeys.has(digest([q.a,q.b,q.c])),'Every changed orchard indexed face has real camera support');
}
const landscape=harvestLandscapeChecks(g,mesh,parts,provenance,receipt,baseline);
const assembly=harvestAssemblyChecks(g,mesh,parts,provenance,receipt,baseline);
if(!baseline){assert.equal(g.components.length,before.originalCounts.components+assembly.pieces+landscape.components,'All original components remain and every new component is reviewed');assert.equal(g.foundations.length,before.originalCounts.foundations+assembly.assemblies);assert.deepEqual(g.foundations.slice(0,before.originalCounts.foundations),before.protection.foundations,'Original foundations stay exact ordered prefix');assert.equal(g.props.length,before.originalCounts.props+assembly.assemblies+landscape.trees);assert.equal(g.cameraObstacles.length,before.originalCounts.cameraObstacles+27+assembly.assemblies+landscape.cameraPayloads,'Only27 real orchard payloads and exact independent groups are added');}
const camera=harvestCameraChecks(g,mesh,baseline,before?.camera);
const report={auditScope:'Historical 6bb9 enrichment core; current geometry remains separately checked',schema:'harvest-enrichment-geometry-v1',stage,sourceSha256,budget:g.budget,camera,assembly,landscape,protectedParts:provenance.filter(p=>p.scope==='protected').length,changedParts:changed.length,changedKinds:[...new Set(changed.map(p=>p.kind))].sort(),inspectedFaces:inspectedFaces.length,cropFaces,cropRootVertices,cropTopVertices,cropTerrainIntersections,treeVertices,rootFootprints,treeContacts,roadPairs,cameraFaces,exposedCoflush:coflushWitnesses,newExposedCoflush:newCoflush,buriedCoflush,intentionalOppositeContacts,degenerateTopology,durationSeconds:(Date.now()-started)/1000,resources:{maxRSSKiB:process.resourceUsage().maxRSS,heapCapMiB:448,concurrency:1}};
assert.equal(sha(readFileSync(path)),sourceSha256,'Source unchanged during independent audit');
writeFileSync(join(run,stage+'-report.json'),JSON.stringify(report)+'\n');
if(baseline)writeFileSync(join(run,'baseline-contract.json'),JSON.stringify({sourceSha256,protection,identities,originalCounts,materials:g.batches.map(harvestMaterial),textureHash,coflush,degenerateTopology,camera})+'\n');
if(process.env.HARVEST_ENRICHMENT_AUDIT_DIR){const output=resolve(process.env.HARVEST_ENRICHMENT_AUDIT_DIR);mkdirSync(output,{recursive:true});writeFileSync(join(output,stage+'-geometry-report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({...report,assembly:{assemblies:assembly.assemblies,pieces:assembly.pieces,contacts:assembly.contacts,grounded:assembly.grounded,wholeSeatContacts:(assembly as any).wholeSeatContacts,cameraFaces:assembly.cameraFaces,unrelatedIntersections:assembly.unrelatedIntersections.length,unseenAssemblies:(assembly as any).forwardChaseVisibility?.unseenAssemblies},camera:{targetedPoses:camera.targetedPoses,inspections:camera.inspections,witnesses:camera.witnesses.length,newWitnesses:camera.newWitnesses.length},exposedCoflush:coflushWitnesses.length,newExposedCoflush:newCoflush.length,buriedCoflush:buriedCoflush.length,intentionalOppositeContacts:intentionalOppositeContacts.length,degenerateTopology:degenerateTopology.length}));
assert.equal(newCoflush.length,0,'Changed geometry adds exposed positive-area coincident skins: '+JSON.stringify(newCoflush.slice(0,12)));

assert.equal(camera.newWitnesses.length,0,'New strict targeted whole-boom camera witness: '+JSON.stringify(camera.newWitnesses.slice(0,12)));

assert.equal(landscape.unrelatedIntersections.length,0,'Unapproved vegetation intersections: '+JSON.stringify(landscape.unrelatedIntersections.slice(0,16)));
