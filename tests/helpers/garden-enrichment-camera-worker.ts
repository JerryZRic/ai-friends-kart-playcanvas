/** Source-stable bounded original/candidate local-camera worker. */
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {gardenSceneData} from './garden-enrichment-scene';
import {gardenSha as sha} from './garden-enrichment-contract';
import {gardenAuditHashes} from './garden-enrichment-source-stability';
import {gardenEnrichmentCameraChecks} from './garden-enrichment-camera-checks';
import {GardenCameraRecords,gardenCameraPlan,assertGardenCameraExpected,gardenCameraExpectedPath} from './garden-enrichment-camera-records';
const [stage,run,ledger]=process.argv.slice(2),baseline=stage==='baseline',started=Date.now();assert.ok(['baseline','candidate'].includes(stage));
if(!baseline)assert.ok(existsSync(gardenCameraExpectedPath),'Freeze immutable-original digests before candidate execution');
const plan=gardenCameraPlan(),sourceHashesBefore=gardenAuditHashes(),path=baseline?'docs/scene-baselines/garden-original/src/garden-scenery.ts.txt':'src/garden-scenery.ts',sourceSha256=sha(readFileSync(path)),old=baseline?null:JSON.parse(readFileSync(join(run,'baseline-local-report.json'),'utf8'));
if(old){assert.equal(old.sourceSha256,plan.originalSourceSha256);assert.deepEqual(sourceHashesBefore,old.sourceHashesBefore,'All source and QA inputs must stay frozen between stages');}
const {geometry:g}=await gardenSceneData(baseline,ledger),records=new GardenCameraRecords(baseline,run,'local'),camera=gardenEnrichmentCameraChecks(g,baseline,plan,records,old?.camera),outputs=records.finish();
const sourceHashesAfter=gardenAuditHashes();assert.deepEqual(sourceHashesAfter,sourceHashesBefore,'Source and all audit inputs remain stable throughout worker');assert.equal(sha(readFileSync(path)),sourceSha256);
const report={schema:'garden-enrichment-local-camera-v1',stage,baselineCommit:plan.baselineCommit,sourceSha256,sourceHashesBefore,sourceHashesAfter,stable:true,budget:g.budget,camera,baselineFailuresSha256:sha(JSON.stringify(camera.failures??old.camera.failures)),outputs,durationSeconds:(Date.now()-started)/1000,resources:{maxRSSKiB:process.resourceUsage().maxRSS,heapCapMiB:448,concurrency:1}};
writeFileSync(join(run,stage+'-local-report.json'),JSON.stringify(report)+'\n',{flag:'wx'});
if(process.env.GARDEN_ENRICHMENT_AUDIT_DIR){const output=resolve(process.env.GARDEN_ENRICHMENT_AUDIT_DIR);mkdirSync(output,{recursive:true});writeFileSync(join(output,stage+'-local-camera-report.json'),JSON.stringify(report)+'\n');}
console.log(JSON.stringify({stage,sourceSha256,budget:g.budget,denseStations:camera.denseStations,densePoses:camera.densePoses,movingFrames:camera.movingFrames,inspections:camera.inspections,retractions:camera.retractions,forwardRetractions:camera.forwardRetractions,witnesses:camera.witnesses.length,newWitnesses:camera.newWitnesses.length,outputs,durationSeconds:report.durationSeconds,resources:report.resources}));
assert.equal(camera.newWitnesses.length,0,'No new exact-face/multiplicity full-boom or motion witnesses: '+JSON.stringify(camera.newWitnesses.slice(0,16)));
assertGardenCameraExpected(stage,'local',outputs);
if(existsSync(gardenCameraExpectedPath)){const frozen=JSON.parse(readFileSync(gardenCameraExpectedPath,'utf8'));assert.equal(report.baselineFailuresSha256,frozen.localBaselineFailuresSha256,'Only frozen original exact-face/pose witnesses can be inherited');}
if(old){assert.equal(outputs.outputSha256,old.outputs.outputSha256);assert.equal(outputs.labelSha256,old.outputs.labelSha256);assert.equal(outputs.changedRows,0,JSON.stringify(outputs.changes));assert.equal(camera.retractions,old.camera.retractions);assert.equal(camera.forwardRetractions,old.camera.forwardRetractions);}
