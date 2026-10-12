/** Historical counts use only a complete independently certified original prefix. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {GardenSceneGeometry} from '../../src/garden-scenery';
import {gardenSha,gardenDigest,gardenFrozenBaseline,assertGardenOriginalComponents,assertGardenOriginalProjection} from './garden-enrichment-contract';
export function gardenOriginalAssemblyFixture(){const raw=readFileSync('tests/fixtures/garden-enrichment-original-assemblies.json','utf8');assert.equal(gardenSha(raw),'3f7ea78514e3ef91d3a0037bb39de7a0bfc22622c5a1338c4242a0cf985fa59e');const parts=JSON.parse(raw);assert.equal(gardenDigest(parts),gardenFrozenBaseline().prefixes.assemblies.digest);return parts;}
export function assertGardenOriginalAssemblyRecords(assemblies:GardenSceneGeometry['assemblies'],components:GardenSceneGeometry['components']){
 const old=gardenFrozenBaseline(),original=assertGardenOriginalComponents(components,old),prefix=assemblies.slice(0,old.prefixes.assemblies.count);
 assert.equal(prefix.length,118);assert.equal(gardenDigest(prefix),old.prefixes.assemblies.digest,'Every original assembly, order and component ownership remains exact');
 const ids=new Set<string>(),owned=new Set<number>();for(const a of prefix){assert.ok(!ids.has(a.id));ids.add(a.id);for(const index of a.components){assert.ok(Number.isInteger(index)&&index>=0&&index<original.length);assert.ok(!owned.has(index),'Original assembly material patches are single-owned');owned.add(index);}}
 for(const a of assemblies.slice(prefix.length)){assert.ok(!ids.has(a.id),'Appended assembly cannot impersonate original identity');for(const index of a.components)assert.ok(index>=original.length,'Appended assembly cannot claim an original patch');}
 return prefix;
}
export function gardenOriginalAssemblyIds(g:GardenSceneGeometry){assertGardenOriginalProjection(g);return new Set(assertGardenOriginalAssemblyRecords(g.assemblies,g.components).map(a=>a.id));}

/** Exact approved current-test transformation, preserving every native audit loop. */
export function gardenIndependentCompatibility(before:string){
 let s="import {gardenOriginalAssemblyIds} from './helpers/garden-enrichment-original-assemblies';\n"+before.replaceAll('<110000','<120000').replace('batches110k','batches120k');
 const old="let triangles=0,minThickness=Infinity,maxThickness=0;const details:unknown[]=[];assert.equal(assembled.filter(a=>a.components[0].landmark).length,78",next="let triangles=0,minThickness=Infinity,maxThickness=0;const details:unknown[]=[],originalIds=gardenOriginalAssemblyIds(geometry),originalAssembled=assembled.filter(a=>originalIds.has(a.id));assert.equal(originalAssembled.filter(a=>a.components[0].landmark).length,78";
 assert.equal(s.split(old).length-1,1);s=s.replace(old,next);assert.equal(s.split("assert.equal(assembled.filter(a=>!a.components[0].landmark).length,40").length-1,1);return s.replace("assert.equal(assembled.filter(a=>!a.components[0].landmark).length,40","assert.equal(originalAssembled.filter(a=>!a.components[0].landmark).length,40");
}
