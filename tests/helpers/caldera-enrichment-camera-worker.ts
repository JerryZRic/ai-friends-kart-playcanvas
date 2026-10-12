import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {calderaSceneData} from './caldera-enrichment-scene';
import {calderaSha as sha} from './caldera-enrichment-contract';
import {calderaCameraChecks} from './caldera-enrichment-camera-checks';
import {MeshOracle} from './emitted-scene-oracle';
import {calderaAuditHashes} from './caldera-enrichment-source-stability';
const sourceHashesBefore=calderaAuditHashes();
const [stage,run,ledger]=process.argv.slice(2),baseline=stage==='baseline',started=Date.now();assert.ok(['baseline','candidate'].includes(stage));
const path=baseline?'docs/scene-baselines/caldera-scenery.ts.txt':'src/caldera-scenery.ts',sourceSha256=sha(readFileSync(path)),{geometry:g}=await calderaSceneData(baseline,ledger),mesh=new MeshOracle(g.batches);
const old=baseline?null:JSON.parse(readFileSync(join(run,'baseline-report.json'),'utf8')),camera=calderaCameraChecks(g,mesh,baseline,old?.camera);
const sourceHashesAfter=calderaAuditHashes();assert.deepEqual(sourceHashesAfter,sourceHashesBefore,'All original inputs and QA dependencies remained stable');
const report={sourceHashesBefore,sourceHashesAfter,stable:true,schema:'caldera-enrichment-camera-v1',stage,sourceSha256,budget:g.budget,camera,durationSeconds:(Date.now()-started)/1000,resources:{maxRSSKiB:process.resourceUsage().maxRSS,heapCapMiB:448,concurrency:1}};
assert.equal(sha(readFileSync(path)),sourceSha256,'Camera source did not change while tested');writeFileSync(join(run,stage+'-report.json'),JSON.stringify(report)+'\n');
if(process.env.CALDERA_ENRICHMENT_AUDIT_DIR){const output=resolve(process.env.CALDERA_ENRICHMENT_AUDIT_DIR);mkdirSync(output,{recursive:true});writeFileSync(join(output,stage+'-camera-report.json'),JSON.stringify(report)+'\n');}
console.log(JSON.stringify({stage,sourceSha256,budget:g.budget,staticPoses:camera.staticPoses,densePoses:camera.densePoses,denseStations:camera.denseStations,movingFrames:camera.movingFrames,inspections:camera.inspections,cameraChanges:camera.cameraChanges.length,witnesses:camera.witnesses.length,newWitnesses:camera.newWitnesses.length,durationSeconds:report.durationSeconds,resources:report.resources}));
assert.equal(camera.newWitnesses.length,0,'New exact-source whole-boom/motion witnesses: '+JSON.stringify(camera.newWitnesses.slice(0,12)));
