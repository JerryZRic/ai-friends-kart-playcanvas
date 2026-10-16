import {postV100HistoricalScene} from './post-v100-historical-scene';
/** One serial 448MiB worker; immutable original build is compared before new solids. */
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {landTexturePixels} from '../../src/land-scenery';
import {snowSceneData} from './snow-enrichment-scene';
import {snowSha as sha,snowDigest as digest,snowBaselineContract,snowFrozenBaseline,assertSnowPreservation,assertSnowOriginalProjection,SNOW_ORIGINAL_SOURCE_SHA256} from './snow-enrichment-contract';
import {MeshOracle,ComponentOracle,area3D,weldedTriangleShells} from './emitted-scene-oracle';
import {snowSignedVolume,snowCoflushChecks,snowSelfIntersections} from './snow-enrichment-solids';
import {snowAssemblyChecks} from './snow-enrichment-assemblies';
const [stage,run,ledger]=process.argv.slice(2),baseline=stage==='baseline',started=Date.now();assert.ok(['baseline','candidate'].includes(stage));
const path=baseline?'docs/scene-baselines/snow-scenery.ts.txt':'src/snow-scenery.ts',sourceSha256=sha(readFileSync(path)),{geometry:g,theme,...historicalScope}=baseline?await snowSceneData(true,ledger):await postV100HistoricalScene('snow'),old=baseline?null:JSON.parse(readFileSync(join(run,'baseline-contract.json'),'utf8'));
const textureHash=digest(Object.fromEntries((['stone','asphalt','wood','grass'] as const).map(k=>[k,[...landTexturePixels(k)]])));
const sourceNormalAudit:any[]=[],actualBounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
for(const b of g.batches){assert.equal(b.positions.length%3,0);assert.equal(b.indices.length%3,0);assert.equal(b.uvs.length,b.positions.length/3*2);assert.ok(b.positions.every(Number.isFinite)&&b.uvs.every(Number.isFinite));assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));const normals=pc.calculateNormals(b.positions,b.indices);assert.ok(normals.every(Number.isFinite));sourceNormalAudit.push({batch:b.name,vertices:normals.length/3,sha256:digest(normals),zeroLength:normals.filter((_,i)=>i%3===0&&Math.hypot(normals[i],normals[i+1],normals[i+2])<1e-8).length});for(const index of b.indices)for(let k=0;k<3;k++){actualBounds.min[k]=Math.min(actualBounds.min[k],b.positions[index*3+k]);actualBounds.max[k]=Math.max(actualBounds.max[k],b.positions[index*3+k]);}}
assert.deepEqual(g.bounds,actualBounds,'Bounds include every actual indexed vertex');
let assembly:any=null,coflush:any=null,addedComponents=0,newTriangles=0,closedShells=0,selfIntersectionPairs=0;const selfIntersectionFailures:any[]=[];
if(baseline){
 assert.equal(sourceSha256,SNOW_ORIGINAL_SOURCE_SHA256);assert.deepEqual(g.budget,{batches:23,triangles:106286,vertices:155970});const protection=snowBaselineContract(g,theme);assert.deepEqual(protection,snowFrozenBaseline(),'Fresh unchanged baseline build exactly reproduces independently frozen original export');
 writeFileSync(join(run,'baseline-contract.json'),JSON.stringify({sourceSha256,protection,textureHash})+'\n');
}else{
 const added=assertSnowPreservation(g,theme,old.protection,true);assert.equal(textureHash,old.textureHash);addedComponents=added.length;
 // Mutation sentinels exercise actual original arrays, then restore exactly.
 for(const field of ['positions','uvs','indices'] as const){const array=g.batches[0][field],original=array[0];array[0]=original+1;try{assert.throws(()=>assertSnowOriginalProjection(g,old.protection,true),undefined,'Changed original '+field+' must fail before projection');}finally{array[0]=original;}}
 const appendedBatch=g.batches.find((b,i)=>b.indices.length>old.protection.batches[i].indices)!,appendAt=old.protection.batches[g.batches.indexOf(appendedBatch)].indices,originalIndex=appendedBatch.indices[appendAt];appendedBatch.indices[appendAt]=0;try{assert.throws(()=>assertSnowOriginalProjection(g,old.protection,true),undefined,'New triangles reusing original vertices must fail');}finally{appendedBatch.indices[appendAt]=originalIndex;}
 assertSnowOriginalProjection(g,old.protection,true);
 const mesh=new MeshOracle(g.batches),parts=new ComponentOracle(mesh,g.components),addedSet=new Set(added),terrainIds=new Set(mesh.triangles.filter(q=>['connected-snow-bowl-heightfield','connected-slate-exposures-heightfield'].includes(parts.owner.get(q.id)!.kind)).map(q=>q.id));
 for(const p of g.components)assert.deepEqual(parts.bounds.get(p),{min:p.min,max:p.max},p.kind+' full actual indexed bounds');
 for(const [i,b]of g.batches.entries()){
  const before=old.protection.batches[i],owners=added.filter(p=>p.batch===b.name).sort((a,b)=>a.indexStart-b.indexStart);let end=before.indices,vertexEnd=before.vertices;const used=new Set<number>();
  for(const p of owners){assert.equal(p.indexStart,end,'No new index ownership gap');assert.equal(p.vertexStart,vertexEnd,'No new vertex ownership gap');end=p.indexEnd;vertexEnd=p.vertexEnd;for(const id of b.indices.slice(p.indexStart,p.indexEnd))used.add(id);}
  assert.equal(end,b.indices.length);assert.equal(vertexEnd,b.positions.length/3);assert.equal(used.size,b.positions.length/3-before.vertices,'Every appended vertex is actually indexed exactly within owned new geometry');
 }
 for(const p of added){const faces=parts.triangles.get(p)!;newTriangles+=faces.length;assert.ok(p.solid);assert.ok(faces.every(q=>area3D([q.a,q.b,q.c])>1e-10),p.kind+' zero-area face');assert.ok(parts.closedShell(p),p.kind+' closed opposite-direction welded edges');assert.equal(weldedTriangleShells(faces).length,1);assert.ok(snowSignedVolume(faces)>1e-7,p.kind+' positive outward volume');closedShells++;const self=snowSelfIntersections(mesh,parts,p);selfIntersectionPairs+=self.pairs;selfIntersectionFailures.push(...self.failures.map(w=>({part:p.kind,...w})));}
 assert.equal(newTriangles,g.budget.triangles-106286,'All appended triangles have one complete component owner');
 assembly=snowAssemblyChecks(g,mesh,parts,added,old.protection);coflush=snowCoflushChecks(mesh,parts,addedSet,terrainIds);
}
assert.equal(sha(readFileSync(path)),sourceSha256,'Source stable for full audit');
const report={schema:'snow-enrichment-geometry-v1',stage,sourceSha256,...historicalScope,budget:g.budget,protectedComponents:6339,addedComponents,newTriangles,originalBufferMutationSentinels:baseline?0:4,closedShells,selfIntersectionPairs,selfIntersectionFailures,sourceNormalAudit,textureHash,assembly,coflush,durationSeconds:(Date.now()-started)/1000,resources:{maxRSSKiB:process.resourceUsage().maxRSS,heapCapMiB:448,concurrency:1},limitations:['Strong support/shell/assembly checks cover the exact historical enrichment core; current polish has separate finite/palette/ownership/road-clearance checks','CPU indexed geometry only; no current-polish support-graph, native pixels, GPU or FPS certification']};
writeFileSync(join(run,stage+'-report.json'),JSON.stringify(report)+'\n');
if(process.env.SNOW_ENRICHMENT_AUDIT_DIR){const output=resolve(process.env.SNOW_ENRICHMENT_AUDIT_DIR);mkdirSync(output,{recursive:true});writeFileSync(join(output,stage+'-geometry-report.json'),JSON.stringify(report,null,2)+'\n');if(baseline)writeFileSync(join(output,'baseline-indexed-contract.json'),readFileSync(join(run,'baseline-contract.json')));}
console.log(JSON.stringify({...report,sourceNormalAudit:sourceNormalAudit.map(({batch,vertices,zeroLength})=>({batch,vertices,zeroLength})),assembly:assembly?{assemblies:assembly.assemblies,pieces:assembly.pieces,cameraFaces:assembly.cameraFaces,seatedFaces:assembly.seatedFaces,groundWitnesses:assembly.groundWitnesses.length,contacts:assembly.contacts.length,openings:assembly.openings.length,exposedSurfaces:assembly.visibility.length,intentionalJoins:assembly.intentionalJoins.length,buriedJoints:assembly.buriedJoints.length,intrusions:assembly.intrusions.length,terrainIntrusions:assembly.terrainIntrusions.length,minimumNonRootTerrainGap:assembly.minimumNonRootTerrainGap}:null,coflush:coflush?{facePairs:coflush.facePairs,exposed:coflush.exposed.length,buried:coflush.buried.length,oppositeContactPatches:coflush.oppositeContactPatches}:null}));
if(!baseline){assert.equal(selfIntersectionFailures.length,0,'New self-intersecting shell: '+JSON.stringify(selfIntersectionFailures.slice(0,12)));assert.equal(coflush.exposed.length,0,'New exposed coincident outward faces: '+JSON.stringify(coflush.exposed.slice(0,12)));assert.equal(assembly.terrainIntrusions.length,0,'Non-root scenery intersects actual terrain: '+JSON.stringify(assembly.terrainIntrusions.slice(0,12)));assert.equal(assembly.intrusions.length,0,'Unrelated positive-volume intrusion: '+JSON.stringify(assembly.intrusions.slice(0,12)));}
