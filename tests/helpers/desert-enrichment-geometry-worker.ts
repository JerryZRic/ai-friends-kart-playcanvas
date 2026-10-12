/** Disk-backed serial baseline/candidate audit,448MiB heap per process. */
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {landTexturePixels} from '../../src/land-scenery';
import {desertSceneData} from './desert-enrichment-scene';
import {desertSha as sha,desertDigest as digest,desertBaselineContract,assertDesertPreservation} from './desert-enrichment-contract';
import {MeshOracle,ComponentOracle,area3D,boundsOf,weldedTriangleShells} from './emitted-scene-oracle';
import {desertSignedVolume,desertCoflushChecks} from './desert-enrichment-solids';
import {desertAssemblyChecks} from './desert-enrichment-assemblies';
const [stage,run,ledger]=process.argv.slice(2),baseline=stage==='baseline',started=Date.now();assert.ok(['baseline','candidate'].includes(stage));
const path=baseline?'docs/scene-baselines/desert-scenery.ts.txt':'src/desert-scenery.ts',sourceSha256=sha(readFileSync(path));
const {geometry:g,theme}=await desertSceneData(baseline,ledger),old=baseline?null:JSON.parse(readFileSync(join(run,'baseline-contract.json'),'utf8'));
const textureHash=digest(Object.fromEntries((['stone','asphalt','wood','grass'] as const).map(k=>[k,[...landTexturePixels(k)]])));
const sourceNormalAudit:any[]=[],actualBounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
for(const b of g.batches){assert.equal(b.positions.length%3,0);assert.equal(b.indices.length%3,0);assert.equal(b.uvs.length,b.positions.length/3*2);assert.ok(b.positions.every(Number.isFinite)&&b.uvs.every(Number.isFinite));assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));const normals=pc.calculateNormals(b.positions,b.indices);assert.ok(normals.every(Number.isFinite));sourceNormalAudit.push({batch:b.name,vertices:normals.length/3,sha256:digest(normals),zeroLength:normals.filter((_,i)=>i%3===0&&Math.hypot(normals[i],normals[i+1],normals[i+2])<1e-8).length});for(const index of b.indices)for(let k=0;k<3;k++){actualBounds.min[k]=Math.min(actualBounds.min[k],b.positions[index*3+k]);actualBounds.max[k]=Math.max(actualBounds.max[k],b.positions[index*3+k]);}}
assert.deepEqual(g.bounds,actualBounds,'Bounds include every actual current indexed vertex');
let assembly:any=null,coflush:any=null,addedComponents=0,newTriangles=0;
if(baseline){assert.equal(sourceSha256,'ea35a4a1d40ea12ec0b74e1cc2276e78bc722d16ecdae154c2fa1f602f96672c');assert.deepEqual(g.budget,{batches:22,triangles:107224,vertices:133911});writeFileSync(join(run,'baseline-contract.json'),JSON.stringify({sourceSha256,protection:desertBaselineContract(g,theme),textureHash})+'\n');}
else{
 const added=assertDesertPreservation(g,theme,old.protection);assert.equal(textureHash,old.textureHash,'Original procedural source pixel families remain exact');addedComponents=added.length;
 const mesh=new MeshOracle(g.batches),parts=new ComponentOracle(mesh,g.components),addedSet=new Set(added),terrainIds=new Set(mesh.triangles.filter(q=>q.batch==='Desert connected sculpted dune terrain').map(q=>q.id));
 for(const p of g.components)assert.deepEqual(parts.bounds.get(p),{min:p.min,max:p.max},p.kind+' complete actual indexed bounds');
 for(const p of added){const faces=parts.triangles.get(p)!;newTriangles+=faces.length;assert.ok(p.solid,'New component is an explicit closed solid');assert.ok(faces.every(q=>area3D([q.a,q.b,q.c])>1e-10),p.kind+' has no collapsed indexed face');assert.ok(parts.closedShell(p),p.kind+' closed consistently wound edges');assert.equal(weldedTriangleShells(faces).length,1,p.kind+' is one connected actual indexed solid');assert.ok(desertSignedVolume(faces)>1e-7,p.kind+' outward positive volume');}
 assert.equal(newTriangles,g.budget.triangles-old.protection.budget.triangles,'Every appended triangle has exactly one new component owner');
 assembly=desertAssemblyChecks(g,mesh,parts,added,old.protection);
 coflush=desertCoflushChecks(mesh,parts,addedSet,terrainIds);
}
assert.equal(sha(readFileSync(path)),sourceSha256,'Source did not change while audited');
const report={schema:'desert-enrichment-geometry-v1',stage,sourceSha256,budget:g.budget,protectedComponents:baseline?g.components.length:old.protection.prefixes.components.count,addedComponents,newTriangles,sourceNormalAudit,textureHash,assembly,coflush,durationSeconds:(Date.now()-started)/1000,resources:{maxRSSKiB:process.resourceUsage().maxRSS,heapCapMiB:448,concurrency:1},limitations:['Actual CPU indexed-source geometry audit; no native pixels,GPU orFPS certification']};
writeFileSync(join(run,stage+'-report.json'),JSON.stringify(report)+'\n');
if(process.env.DESERT_ENRICHMENT_AUDIT_DIR){const output=resolve(process.env.DESERT_ENRICHMENT_AUDIT_DIR);mkdirSync(output,{recursive:true});writeFileSync(join(output,stage+'-geometry-report.json'),JSON.stringify(report,null,2)+'\n');if(baseline)writeFileSync(join(output,'baseline-indexed-contract.json'),readFileSync(join(run,'baseline-contract.json')));}
console.log(JSON.stringify({...report,sourceNormalAudit:sourceNormalAudit.map(({batch,vertices,zeroLength})=>({batch,vertices,zeroLength})),assembly:assembly?{...assembly,groundWitnesses:assembly.groundWitnesses?.length,contacts:assembly.contacts?.length,intrusions:assembly.intrusions?.length}:null,coflush:coflush?{facePairs:coflush.facePairs,exposed:coflush.exposed.length,buried:coflush.buried.length,oppositeContactPatches:coflush.oppositeContactPatches}:null}));
if(!baseline){assert.equal(coflush.exposed.length,0,'New exposed coincident outward faces: '+JSON.stringify(coflush.exposed.slice(0,12)));assert.equal(assembly.intrusions.length,0,'Unapproved positive-volume solid intrusion: '+JSON.stringify(assembly.intrusions.slice(0,12)));}
