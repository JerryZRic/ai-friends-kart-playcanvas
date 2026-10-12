/** Snapshot every original input and additive QA dependency before a bounded run. */
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {calderaSha} from './caldera-enrichment-contract';
export function calderaAuditHashes(){
 const receipt=JSON.parse(readFileSync('tests/fixtures/caldera-enrichment-protected.json','utf8'));
 const files=new Set<string>(Object.keys(receipt.sourceInventory));
 for(const dir of ['tests','tests/helpers','tests/fixtures','docs'])for(const file of readdirSync(dir))if(file.startsWith('caldera-enrichment-')||file==='run-caldera-retained-audit.ts'||file==='run-caldera-final-audit.ts'||file==='freeze-caldera-enrichment-contract.ts')files.add(dir+'/'+file);
 for(const file of ['docs/scene-baselines/caldera-scenery.ts.txt','tests/helpers/emitted-scene-oracle.ts','tests/helpers/harvest-enrichment-surface-support.ts','tests/helpers/bounded-test-process.ts','tests/helpers/instrumented-source-files.ts'])files.add(file);
 return Object.fromEntries([...files].sort().map(file=>[file,calderaSha(readFileSync(file))]));
}
