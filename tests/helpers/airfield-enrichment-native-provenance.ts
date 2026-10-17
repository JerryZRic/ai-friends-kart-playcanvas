import {assertCurrentPolishPayload} from './current-airfield-snow-polish';
/** Native collision witnesses retain old source classification only after complete certification. */
import assert from 'node:assert/strict';
import {assertAirfieldOpaquePayload} from './airfield-enrichment-assemblies';
import {airfieldReviewedRecipes} from './airfield-enrichment-piece-oracle';
import type {AirfieldSceneGeometry,AirfieldComponent} from '../../src/airfield-scenery';
import {assertAirfieldOriginalProjection,airfieldFrozenBaseline} from './airfield-enrichment-contract';
export function airfieldNativeBlockerComponents(g:AirfieldSceneGeometry,historicalCore=false){
 const old=airfieldFrozenBaseline(),original=assertAirfieldOriginalProjection(g,old,historicalCore),added=g.components.slice(original.length),result=new Map<any,AirfieldComponent[]>(),owned=new Set<AirfieldComponent>();
 const recipes=airfieldReviewedRecipes(),polish=historicalCore?new Map<any,AirfieldComponent[]>():assertCurrentPolishPayload('airfield',g);
 for(const solid of g.cameraObstacles.filter(o=>o.triangles?.length)){
  let components:AirfieldComponent[];
  if(solid.kind==='airfield-actual-source-shoulder-triangles')components=original.filter(c=>c.kind==='source-exact-layer-owned-shoulders');
  else if(solid.kind==='airfield-actual-open-hangar-triangles')components=original.filter(c=>c.kind.startsWith('hangar-'));
  else if(solid.kind==='airfield-actual-other-source-triangles')components=original.filter(c=>!c.landmark&&!c.kind.startsWith('hangar-')&&c.role!=='terrain'&&c.role!=='road'&&c.kind!=='source-exact-layer-owned-shoulders');
  else if(original.some(c=>'airfield-actual-'+c.landmark===solid.kind))components=original.filter(c=>'airfield-actual-'+c.landmark===solid.kind);
  else if(polish.has(solid)){components=polish.get(solid)!;for(const part of components){assert.ok(added.includes(part));assert.ok(!owned.has(part));owned.add(part);}}
  else {
   const recipe=recipes.assemblies.find((a:any)=>a.id+'-exact-triangles'===solid.kind);assert.ok(recipe,'Every new blocker has independently reviewed ownership');
   components=recipe.pieces.flatMap((item:any)=>item.componentRecords.map((record:any)=>{const part=g.components[record.componentIndex];assert.ok(part&&added.includes(part));assert.deepEqual(part,record.component,'Complete reviewed appended material patch');assert.ok(!owned.has(part),'New component cannot enter two blockers');owned.add(part);return part;}));
  }
  const actual=components.flatMap(c=>{const b=g.batches.find(b=>b.name===c.batch)!;return Array.from({length:(c.indexEnd-c.indexStart)/3},(_,i)=>b.indices.slice(c.indexStart+i*3,c.indexStart+i*3+3).map(v=>b.positions.slice(v*3,v*3+3)));});
  assertAirfieldOpaquePayload(actual,solid);result.set(solid,components);
 }
 assert.equal(owned.size,added.length,'Every appended component appears exactly once in actual opaque blockers');return result;
}
