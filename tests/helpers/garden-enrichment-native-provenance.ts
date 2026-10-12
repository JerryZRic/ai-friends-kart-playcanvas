/** Native collision witnesses retain old source classification only after complete certification. */
import assert from 'node:assert/strict';
import {assertGardenOpaquePayload} from './garden-enrichment-assemblies';
import {readFileSync} from 'node:fs';
import type {GardenSceneGeometry,GardenComponent} from '../../src/garden-scenery';
import {assertGardenOriginalProjection,gardenFrozenBaseline} from './garden-enrichment-contract';
export function gardenNativeBlockerComponents(g:GardenSceneGeometry){
 const old=gardenFrozenBaseline(),original=assertGardenOriginalProjection(g,old),added=g.components.slice(original.length),result=new Map<any,GardenComponent[]>(),owned=new Set<GardenComponent>();
 const recipes=JSON.parse(readFileSync('tests/fixtures/garden-enrichment-assembly-recipes.json','utf8'));
 for(const solid of g.cameraObstacles.filter(o=>o.triangles?.length)){
  let components:GardenComponent[];
  if(solid.kind==='garden-actual-source-shoulder-triangles')components=original.filter(c=>c.kind==='source-exact-layer-owned-shoulders');
  else if(solid.kind==='garden-actual-open-arbor-triangles')components=original.filter(c=>c.kind.startsWith('arbor-'));
  else if(solid.kind==='garden-actual-other-source-triangles')components=original.filter(c=>!c.landmark&&!c.kind.startsWith('arbor-')&&c.role!=='terrain'&&c.role!=='road'&&c.kind!=='source-exact-layer-owned-shoulders');
  else if(original.some(c=>'garden-actual-'+c.landmark===solid.kind))components=original.filter(c=>'garden-actual-'+c.landmark===solid.kind);
  else {
   const recipe=recipes.assemblies.find((a:any)=>a.id+'-exact-triangles'===solid.kind);assert.ok(recipe,'Every new blocker has independently reviewed ownership');
   components=recipe.pieces.flatMap((item:any)=>item.componentRecords.map((record:any)=>{const part=g.components[record.componentIndex];assert.ok(part&&added.includes(part));assert.deepEqual(part,record.component,'Complete reviewed appended material patch');assert.ok(!owned.has(part),'New component cannot enter two blockers');owned.add(part);return part;}));
  }
  const actual=components.flatMap(c=>{const b=g.batches.find(b=>b.name===c.batch)!;return Array.from({length:(c.indexEnd-c.indexStart)/3},(_,i)=>b.indices.slice(c.indexStart+i*3,c.indexStart+i*3+3).map(v=>b.positions.slice(v*3,v*3+3)));});
  assertGardenOpaquePayload(actual,solid);result.set(solid,components);
 }
 assert.equal(owned.size,added.length,'Every appended component appears exactly once in actual opaque blockers');return result;
}
