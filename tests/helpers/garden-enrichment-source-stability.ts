/** Snapshot every original input and additive QA dependency before a bounded run. */
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {gardenSha} from './garden-enrichment-contract';
export function gardenAuditHashes(){
 const receipt=JSON.parse(readFileSync('tests/fixtures/garden-enrichment-original-inventory.json','utf8'));
 const files=new Set<string>(Object.keys(receipt.sourceInventory));
 for(const file of ['tests/helpers/geometry-runtime-portability.ts','tests/fixtures/geometry-runtime-portability.json'])files.add(file);
 for(const dir of ['tests','tests/helpers','tests/fixtures','docs'])for(const file of readdirSync(dir))if(file.startsWith('garden-enrichment-')||file==='run-garden-retained-audit.ts'||file==='run-garden-final-audit.ts'||file==='freeze-garden-enrichment-contract.ts')files.add(dir+'/'+file);
 for(const file of ['docs/scene-baselines/garden-original/src/garden-scenery.ts.txt','tests/helpers/emitted-scene-oracle.ts','tests/helpers/harvest-enrichment-surface-support.ts','tests/helpers/bounded-test-process.ts','tests/helpers/instrumented-source-files.ts'])files.add(file);
 const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
 for(const f of walk('docs/scene-baselines/garden-original'))files.add(f);
 for(const f of readdirSync('scripts'))if(f.includes('garden-enrichment'))files.add('scripts/'+f);
 return Object.fromEntries([...files].sort().map(file=>[file,gardenSha(readFileSync(file))]));
}
