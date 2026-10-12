/** Review new indexed shell/support identities; never regenerates historical originals. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {MeshOracle,ComponentOracle,boundsOf,cross2,sub,dot,height,projectedInterval,type V} from './emitted-scene-oracle';
import {gardenSceneData} from './garden-enrichment-scene';
import {gardenSha,gardenFrozenBaseline,assertGardenPreservation} from './garden-enrichment-contract';
const path=process.argv[2]??'tests/fixtures/garden-enrichment-assembly-recipes.json',ledger=process.argv[3];assert.ok(ledger,'Explicit cleanup ledger is required');
const source=gardenSha(readFileSync('src/garden-scenery.ts')),{geometry:g,theme}=await gardenSceneData(false,ledger),old=gardenFrozenBaseline();assertGardenPreservation(g,theme,old);
const mesh=new MeshOracle(g.batches),parts=new ComponentOracle(mesh,g.components),terrainIds=new Set(mesh.triangles.filter(q=>parts.owner.get(q.id)!.role==='terrain').map(q=>q.id));
const assemblies=g.enrichmentAssemblies.map((assembly:any)=>{
 const byId=new Map(assembly.pieces.map((p:any)=>[p.id,p])),pieces=assembly.pieces.map((item:any)=>({id:item.id,kind:item.kind,supportOwner:item.supportOwner,componentRecords:item.componentIndices.map((componentIndex:number)=>({componentIndex,component:g.components[componentIndex]}))}));
 const flatFeet=assembly.pieces.filter((p:any)=>p.kind.endsWith('-stone-column-shoe')).map((p:any)=>p.id);
 const roofSeats=[...new Set<string>(assembly.roofSeats.map((r:any)=>r.roofPieceId))].map(pieceId=>({pieceId,supportOwner:(byId.get(pieceId) as any).supportOwner}));
 const openings=assembly.openBayWitnesses.map((w:any)=>{assert.ok(w.top-w.bottom>.5,'Meaningful full-height architectural aperture');assert.ok(w.width>8&&w.depth>=8);const average=(ids:number[])=>[0,1,2].map(k=>ids.reduce((n,i)=>n+w.corners[i][k],0)/ids.length);return{...w,a:average([0,1,4,5]),b:average([2,3,6,7])};});
 const visibleSurfaces=assembly.pieces.map((item:any)=>{
  const components=item.componentIndices.map((i:number)=>g.components[i]),triangles=components.flatMap((p:any)=>parts.triangles.get(p)!);let witness:any=null;
  outer:for(const q of triangles){const e=sub(q.b,q.a),f=sub(q.c,q.a),raw=[e[1]*f[2]-e[2]*f[1],e[2]*f[0]-e[0]*f[2],e[0]*f[1]-e[1]*f[0]],size=Math.hypot(...raw);if(size<1e-9)continue;const n=raw.map(v=>v/size),center=[0,1,2].map(k=>(q.a[k]+q.b[k]+q.c[k])/3);
   for(const distance of [1,2,4,.35]){const eye=center.map((v,k)=>v+n[k]*distance),target=center.map((v,k)=>v-n[k]*.002),hit=mesh.firstHit(eye,target);if(!hit||!components.includes(parts.owner.get(hit.triangle.id)!))continue;
    if(mesh.query(eye,eye).some(t=>terrainIds.has(t.id)&&projectedInterval(t,eye,eye)&&height(t,eye[0],eye[2])>eye[1]-.01))continue;
    if([...new Set(mesh.query(eye,eye).map(t=>parts.owner.get(t.id)!))].some(p=>parts.inside(eye,p)))continue;
    witness={pieceId:item.id,eye,target,faceBatch:q.batch,faceIndexStart:q.indexStart};break outer;
   }
  }
  assert.ok(witness,item.id+' has no independently verified external visible face');return witness;
 });
 return{id:assembly.id,pieces,groundRoots:assembly.groundContacts.map((g:any)=>g.pieceId),fullSeats:[],fullSeatSupports:{},flatFeet,roofSeats,openings,visibleSurfaces};
});
assert.equal(gardenSha(readFileSync('src/garden-scenery.ts')),source,'Scenery changed during recipe review');writeFileSync(path,JSON.stringify({schema:'garden-enrichment-reviewed-recipes-v1',sourceSha256:source,assemblies},null,2)+'\n');console.log(JSON.stringify({sourceSha256:source,assemblies:assemblies.length,pieces:assemblies.reduce((n,a)=>n+a.pieces.length,0),openings:assemblies.reduce((n,a)=>n+a.openings.length,0),recipeSha256:gardenSha(readFileSync(path))}));
