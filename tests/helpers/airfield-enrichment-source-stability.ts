import {menuPresentationAuditDependencies} from './menu-presentation-reviewed-revisions';
/** Snapshot every original input and additive QA dependency before a bounded run. */
import {readFileSync,readdirSync} from 'node:fs';
import {airfieldSha} from './airfield-enrichment-contract';
export function airfieldAuditHashes(){
 const receipt=JSON.parse(readFileSync('tests/fixtures/airfield-enrichment-original-inventory.json','utf8'));
 const files=new Set<string>([...Object.keys(receipt.sourceInventory),...menuPresentationAuditDependencies()]);
 for(const dir of ['tests','tests/helpers','tests/fixtures','docs'])for(const file of readdirSync(dir))if(file.includes('airfield-enrichment')||file==='run-airfield-retained-audit.ts'||file==='run-airfield-final-audit.ts'||file==='freeze-airfield-enrichment-contract.ts')files.add(dir+'/'+file);
 for(const file of ['docs/scene-baselines/airfield-original/src/airfield-scenery.ts.txt','tests/helpers/emitted-scene-oracle.ts','tests/helpers/harvest-enrichment-surface-support.ts','tests/helpers/bounded-test-process.ts','tests/helpers/instrumented-source-files.ts'])files.add(file);
 const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
 for(const f of walk('docs/scene-baselines/airfield-original'))files.add(f);
 for(const f of readdirSync('scripts'))if(f.includes('airfield-enrichment'))files.add('scripts/'+f);
 return Object.fromEntries([...files].sort().map(file=>[file,airfieldSha(readFileSync(file))]));
}
