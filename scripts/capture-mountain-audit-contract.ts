/** Explicit, opt-in preservation capture. Run only against the verified pristine
 * source snapshot and existing geometry JSON, never bless current modified geometry. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {mountainProtectedSources,mountainRouteContract,mountainRoadContract,mountainPlacementContract,mountainIsolatedSceneSources,mountainUnrelatedLoaderContract,mountainUnrelatedMenuContract,mountainLegacyPierContract} from '../tests/helpers/mountain-baseline-contract';
const baseline=resolve(process.argv[2]),output=resolve(process.argv[3]);
const {MOUNTAIN_TRACK:track}=await import(pathToFileURL(resolve(baseline,'source/src/maps/mountain.ts')).href);
const protectedSources=Object.fromEntries(mountainProtectedSources.map(file=>[file,createHash('sha256').update(readFileSync(resolve(baseline,'source',file))).digest('hex')]));
const geometry=JSON.parse(readFileSync(resolve(baseline,'mountain-geometry.json'),'utf8')).geometry;
const contract={baseCommit:'769911cc562b9330a57f043e9a7f9a2f0a976dac',protectedSources,isolatedSceneSources:Object.fromEntries(mountainIsolatedSceneSources.map(file=>[file,createHash('sha256').update(readFileSync(resolve(baseline,'source',file))).digest('hex')])),unrelatedLoaderSHA256:mountainUnrelatedLoaderContract(readFileSync(resolve(baseline,'source/src/land-course.ts'),'utf8')),unrelatedMenuSHA256:mountainUnrelatedMenuContract(readFileSync(resolve(baseline,'source/src/menu-backdrop.ts'),'utf8')),protectedPlacementSHA256:mountainPlacementContract(readFileSync(resolve(baseline,'source/src/land-course.ts'),'utf8')),route:mountainRouteContract(track),roads:mountainRoadContract(geometry),originalPiers:mountainLegacyPierContract(geometry),baseline:{batches:geometry.batches.length,vertices:geometry.batches.reduce((n,b)=>n+b.positions.length/3,0),triangles:geometry.batches.reduce((n,b)=>n+b.indices.length/3,0),terrain:geometry.batches.filter(b=>b.name==='Forest valley floor').map(b=>({name:b.name,vertices:b.positions.length/3,triangles:b.indices.length/3}))}};
writeFileSync(output,JSON.stringify(contract,null,2)+'\n');console.log(JSON.stringify({output,baseCommit:contract.baseCommit,route:contract.route.frameSHA256,roads:contract.roads,baseline:contract.baseline,resources:{maxRSSKiB:process.resourceUsage().maxRSS,v8HeapUsedMiB:process.memoryUsage().heapUsed/1048576}}));
