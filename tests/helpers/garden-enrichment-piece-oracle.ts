/** Group exact indexed material patches into independently reviewed physical shells. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gardenSha} from './garden-enrichment-contract';
import {ComponentOracle,boundsOf,type Provenance} from './emitted-scene-oracle';
export function gardenPhysicalPieces(g:any,parts:ComponentOracle,added:any[],executedSourceSha256=gardenSha(readFileSync('src/garden-scenery.ts'))){
 // Original multi-material botanical shells remain physical obstacles too.
 // Their immutable assembly records already certify membership; union uses every
 // actual triangle unchanged, never a filled hull or replacement surface.
 for(const assembly of g.assemblies.filter((a:any)=>a.closed&&a.components.every((i:number)=>i<1813))){const components=assembly.components.map((i:number)=>g.components[i]);if(components.length<2)continue;const triangles=components.flatMap((c:any)=>parts.triangles.get(c)!);const p:Provenance={...components[0],kind:assembly.id,solid:true};parts.triangles.set(p,triangles);parts.bounds.set(p,boundsOf(triangles.flatMap(q=>[q.a,q.b,q.c])));for(const q of triangles)parts.owner.set(q.id,p);}
 const recipes=JSON.parse(readFileSync('tests/fixtures/garden-enrichment-assembly-recipes.json','utf8')),owned=new Set<Provenance>(),pieces:Provenance[]=[],byId=new Map<string,Provenance>(),componentsByPiece=new Map<Provenance,Provenance[]>();
 assert.equal(recipes.sourceSha256,executedSourceSha256,'Reviewed shell recipes bind exact executed source, independently of current runtime source');
 for(const assembly of recipes.assemblies)for(const item of assembly.pieces){
  const components:Provenance[]=item.componentRecords.map((record:any)=>{const p=g.components[record.componentIndex];assert.ok(p&&added.includes(p));assert.deepEqual(p,record.component,'Every complete appended indexed material patch is frozen independently');assert.ok(!owned.has(p));owned.add(p);return p;});
  assert.ok(components.length>0);const p:Provenance=components.length===1?components[0]:{kind:item.kind,batch:'compound indexed material patches',vertexStart:0,vertexEnd:0,indexStart:0,indexEnd:0,role:'structure',solid:true,assembly:assembly.id};
  const triangles=components.flatMap(c=>parts.triangles.get(c)!);parts.triangles.set(p,triangles);parts.bounds.set(p,boundsOf(triangles.flatMap(q=>[q.a,q.b,q.c])));for(const q of triangles)parts.owner.set(q.id,p);
  assert.ok(!byId.has(item.id));byId.set(item.id,p);componentsByPiece.set(p,components);pieces.push(p);
 }
 assert.equal(owned.size,added.length,'Every new material patch belongs to exactly one physical closed shell');return{pieces,byId,componentsByPiece,recipes};
}
