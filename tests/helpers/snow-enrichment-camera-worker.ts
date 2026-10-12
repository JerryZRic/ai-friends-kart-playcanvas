import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {snowSceneData} from './snow-enrichment-scene';
import {snowSha as sha} from './snow-enrichment-contract';
import {snowCameraChecks} from './snow-enrichment-camera-checks';
import {MeshOracle} from './emitted-scene-oracle';
const [stage,run,ledger]=process.argv.slice(2),baseline=stage==='baseline',started=Date.now();assert.ok(['baseline','candidate'].includes(stage));
const path=baseline?'docs/scene-baselines/snow-scenery.ts.txt':'src/snow-scenery.ts',sourceSha256=sha(readFileSync(path)),{geometry:g}=await snowSceneData(baseline,ledger),mesh=new MeshOracle(g.batches);
const old=baseline?null:JSON.parse(readFileSync(join(run,'baseline-report.json'),'utf8')),camera=snowCameraChecks(g,mesh,baseline,old?.camera);
const report={schema:'snow-enrichment-camera-v1',stage,sourceSha256,budget:g.budget,camera,durationSeconds:(Date.now()-started)/1000,resources:{maxRSSKiB:process.resourceUsage().maxRSS,heapCapMiB:448,concurrency:1}};
assert.equal(sha(readFileSync(path)),sourceSha256,'Camera source did not change while tested');writeFileSync(join(run,stage+'-report.json'),JSON.stringify(report)+'\n');
if(process.env.SNOW_ENRICHMENT_AUDIT_DIR){const output=resolve(process.env.SNOW_ENRICHMENT_AUDIT_DIR);mkdirSync(output,{recursive:true});writeFileSync(join(output,stage+'-camera-report.json'),JSON.stringify(report)+'\n');}
console.log(JSON.stringify({stage,sourceSha256,budget:g.budget,staticPoses:camera.staticPoses,densePoses:camera.densePoses,denseStations:camera.denseStations,movingFrames:camera.movingFrames,inspections:camera.inspections,cameraChanges:camera.cameraChanges.length,witnesses:camera.witnesses.length,newWitnesses:camera.newWitnesses.length,durationSeconds:report.durationSeconds,resources:report.resources}));
assert.equal(camera.newWitnesses.length,0,'New exact-source whole-boom/motion witnesses: '+JSON.stringify(camera.newWitnesses.slice(0,12)));
