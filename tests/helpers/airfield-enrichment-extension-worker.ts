/** Optional independently frozen extra safety range; original camera plan/rows stay immutable. */
import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {airfieldCameraPlan,AirfieldCameraRecords} from './airfield-enrichment-camera-records';
import {airfieldSceneData} from './airfield-enrichment-scene';
import {airfieldEnrichmentCameraChecks} from './airfield-enrichment-camera-checks';
import {airfieldAuditHashes} from './airfield-enrichment-source-stability';
import {airfieldSha as sha,AIRFIELD_ORIGINAL_SOURCE_SHA256} from './airfield-enrichment-contract';
const [stage,run,ledger]=process.argv.slice(2),baseline=stage==='baseline';assert.ok(['baseline','candidate'].includes(stage));
const input='tests/fixtures/airfield-enrichment-camera-extension-plan.json',expectation='tests/fixtures/airfield-enrichment-camera-extension-outputs.json';
const extensionBytes=readFileSync(input,'utf8');assert.equal(sha(extensionBytes),'edaf7659414757a19e5a4aac373cf1722103c0deaee2211b75b4ecb329546f2b','Separately reviewed extension inputs');const extension=JSON.parse(extensionBytes),base=airfieldCameraPlan();assert.equal(extension.originalPlanSha256,sha(readFileSync('tests/helpers/airfield-enrichment-camera-frozen.json')));assert.equal(extension.sourceSha256,AIRFIELD_ORIGINAL_SOURCE_SHA256);
if(!baseline)assert.ok(existsSync(expectation),'Extra original-only outputs must be frozen before extra candidate');
const plan={...base,omitReviewViews:true,local:{...base.local,windows:extension.windows}},before=airfieldAuditHashes(),started=Date.now(),old=baseline?null:JSON.parse(readFileSync(join(run,'baseline-extension-report.json'),'utf8'));
if(old)assert.deepEqual(old.sourceHashesBefore,before,'Both extension stages use source-stable dependencies');
const {geometry:g}=await airfieldSceneData(baseline,ledger),records=new AirfieldCameraRecords(baseline,run,'extension'),camera=airfieldEnrichmentCameraChecks(g,baseline,plan,records,old?.camera),outputs=records.finish(),after=airfieldAuditHashes();assert.deepEqual(after,before);
const report={schema:'airfield-enrichment-extension-camera-v1',stage,sourceSha256:sha(readFileSync(baseline?'docs/scene-baselines/airfield-original/src/airfield-scenery.ts.txt':'src/airfield-scenery.ts')),sourceHashesBefore:before,sourceHashesAfter:after,stable:true,camera,outputs,baselineFailuresSha256:sha(JSON.stringify(camera.failures??old.camera.failures)),durationSeconds:(Date.now()-started)/1000,resources:{heapCapMiB:448,concurrency:1,maxRSSKiB:process.resourceUsage().maxRSS}};
writeFileSync(join(run,stage+'-extension-report.json'),JSON.stringify(report)+'\n',{flag:'wx'});
if(process.env.AIRFIELD_ENRICHMENT_AUDIT_DIR){const out=resolve(process.env.AIRFIELD_ENRICHMENT_AUDIT_DIR);mkdirSync(out,{recursive:true});writeFileSync(join(out,stage+'-extension-camera-report.json'),JSON.stringify(report)+'\n');}
assert.equal(camera.newWitnesses.length,0,JSON.stringify(camera.newWitnesses.slice(0,12)));
if(existsSync(expectation)){const raw=readFileSync(expectation,'utf8');assert.equal(sha(raw),'35190795d6c5484eb723c63c7e346803ca9e2b8c5923a498180fbc9becc78cec');const fixed=JSON.parse(raw);assert.equal(fixed.originalPlanSha256,extension.originalPlanSha256);assert.equal(fixed.extensionPlanSha256,sha(extensionBytes));assert.deepEqual({rows:outputs.rows,outputSha256:outputs.outputSha256,labelSha256:outputs.labelSha256,phases:outputs.phases},fixed.outputs);assert.equal(report.baselineFailuresSha256,fixed.baselineFailuresSha256);assert.equal(camera.retractions,fixed.retractions);assert.equal(camera.forwardRetractions,fixed.forwardRetractions);}
if(old){assert.equal(outputs.changedRows,0);assert.equal(outputs.outputSha256,old.outputs.outputSha256);assert.equal(outputs.labelSha256,old.outputs.labelSha256);}
console.log(JSON.stringify({stage,rows:outputs.rows,changedRows:outputs.changedRows,denseStations:camera.denseStations,densePoses:camera.densePoses,movingFrames:camera.movingFrames,inspections:camera.inspections,witnesses:camera.witnesses.length,newWitnesses:camera.newWitnesses.length,durationSeconds:report.durationSeconds}));
