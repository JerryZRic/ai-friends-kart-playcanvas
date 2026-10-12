/** Historical counts use only a complete independently certified original prefix. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {AirfieldSceneGeometry} from '../../src/airfield-scenery';
import {airfieldSha,airfieldDigest,airfieldFrozenBaseline,assertAirfieldOriginalComponents,assertAirfieldOriginalProjection} from './airfield-enrichment-contract';
export function airfieldOriginalAssemblyFixture(){const raw=readFileSync('tests/fixtures/airfield-enrichment-original-assemblies.json','utf8');assert.equal(airfieldSha(raw),'cb2a673122ad2e9656f9563b92b792c19d07839a904e89b1402ed0212f0f788a');const parts=JSON.parse(raw);assert.equal(airfieldDigest(parts),airfieldFrozenBaseline().prefixes.assemblies.digest);return parts;}
export function assertAirfieldOriginalAssemblyRecords(assemblies:AirfieldSceneGeometry['assemblies'],components:AirfieldSceneGeometry['components']){
 const old=airfieldFrozenBaseline(),original=assertAirfieldOriginalComponents(components,old),prefix=assemblies.slice(0,old.prefixes.assemblies.count);
 assert.equal(prefix.length,16);assert.equal(airfieldDigest(prefix),old.prefixes.assemblies.digest,'Every original assembly, order and component ownership remains exact');
 const ids=new Set<string>(),owned=new Set<number>();for(const a of prefix){assert.ok(!ids.has(a.id));ids.add(a.id);for(const index of a.components){assert.ok(Number.isInteger(index)&&index>=0&&index<original.length);assert.ok(!owned.has(index),'Original assembly material patches are single-owned');owned.add(index);}}
 for(const a of assemblies.slice(prefix.length)){assert.ok(!ids.has(a.id),'Appended assembly cannot impersonate original identity');for(const index of a.components)assert.ok(index>=original.length,'Appended assembly cannot claim an original patch');}
 return prefix;
}
export function airfieldOriginalAssemblyIds(g:AirfieldSceneGeometry){assertAirfieldOriginalProjection(g);return new Set(assertAirfieldOriginalAssemblyRecords(g.assemblies,g.components).map(a=>a.id));}

