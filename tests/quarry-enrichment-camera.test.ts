/** Serial baseline/candidate source-geometry camera audit. No GPU/browser
 * process, build, source camera changes or renderer proxy acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {boundedTestProcess} from './helpers/bounded-test-process';
import {cleanupInstrumentedSourceManifest} from './helpers/instrumented-source-files';
import {quarryCameraOracleSentinels,quarryWitnessKey,inheritedQuarryCameraWitness,quarryAnchoredShorteningProof} from './helpers/quarry-enrichment-camera-oracle';

test('Quarry camera oracle catches whole-boom faces and thin terrain without broad-bound shortcuts',()=>{
 quarryCameraOracleSentinels();
 const a=[0,1,0],b=[10,1,0],key=quarryWitnessKey('same-pose','face-clearance','exact-face:0',a,b),failures={[key]:.2};
 assert.equal(inheritedQuarryCameraWitness(false,key,.2,failures),true);
 assert.equal(inheritedQuarryCameraWitness(true,key,.2,failures),false,'changed faces are never inherited');
 assert.equal(inheritedQuarryCameraWitness(false,key,0,{[key]:1e-10}),false,'an exact-label new intersection cannot inherit a numerical near miss');
 assert.equal(inheritedQuarryCameraWitness(false,key,.19,failures),false,'worse gap on unchanged face is a regression');
 assert.equal(inheritedQuarryCameraWitness(false,quarryWitnessKey('same-pose','face-clearance','exact-face:0',a,[10,1,.001]),.2,failures),false,'changed camera path on unchanged face is a new witness');
 assert.equal(inheritedQuarryCameraWitness(false,quarryWitnessKey('same-pose','face-clearance','exact-face:1',a,b),.2,failures),false,'extra coincident face is not covered by original multiplicity');
 assert.equal(inheritedQuarryCameraWitness(false,quarryWitnessKey('new-pose','face-clearance','exact-face:0',a,b),.2,failures),false,'no region-wide inherited exemption');
 assert.ok(quarryAnchoredShorteningProof(a,[6,1,0],a,b,.2,.2),'same-anchor exact subsegment and same gap can inherit');
 assert.equal(quarryAnchoredShorteningProof(a,[6,1,.000001],a,b,.2,.2),null,'off-axis shortened ray is new');
 assert.equal(quarryAnchoredShorteningProof(a,[10.000001,1,0],a,b,.2,.2),null,'extended ray is new');
 assert.equal(quarryAnchoredShorteningProof([.000001,1,0],[6,1,0],a,b,.2,.2),null,'shifted segment start is new even on the same line');
 assert.equal(quarryAnchoredShorteningProof(a,[6,1,0],a,b,.199,.2),null,'a worse clearance cannot inherit');
 assert.equal(quarryAnchoredShorteningProof(a,[-1,1,0],a,b,.2,.2),null,'reversed ray outside old segment is new');
 assert.equal(quarryAnchoredShorteningProof(a,[6,1,0],a,b,0,1e-10),null,'new intersection cannot inherit a former near miss');
});

test('Quarry enrichment adds no actual indexed-face or exact terrain camera regressions', {timeout:990_000},async t=>{
 const root=process.env.TMPDIR??tmpdir();mkdirSync(root,{recursive:true});const run=join(root,'quarry-enrichment-camera-'+randomUUID());mkdirSync(run);
 try{
  for(const stage of ['baseline','candidate']){
   const ledger=join(run,stage+'-sources.json');
   try{
    const result=await boundedTestProcess(process.execPath,['--max-old-space-size=448','--import','tsx','tests/helpers/quarry-enrichment-camera-worker.ts',stage,run,ledger],{timeoutMs:480_000,env:{...process.env,NODE_OPTIONS:'--max-old-space-size=448'},signal:t.signal});
    assert.equal(result.termination,null,result.output);assert.equal(result.code,0,result.output);
   }finally{cleanupInstrumentedSourceManifest(ledger);}
  }
  const report=JSON.parse(readFileSync(join(run,'candidate-report.json'),'utf8'));
  t.diagnostic(JSON.stringify({candidateSourceSha256:report.candidateSourceSha256,baselineSourceSha256:report.baselineSourceSha256,durationSeconds:report.durationSeconds,resources:report.resources,static:{stations:report.metrics.static.stations,poses:report.metrics.static.poses,booms:report.metrics.static.booms},motion:{runs:report.metrics.motion.runs,frames:report.metrics.motion.frames,actualPreviousRetained:report.metrics.motion.actualPreviousRetained},frozenReplay:report.metrics.frozenBaselineReplay,geometry:report.metrics.geometry,archiveDiagnostics:{totalFailures:report.archivedRuntimeReplay.totalFailures,newFailures:report.archivedRuntimeReplay.newFailures,changedMeshFailures:report.archivedRuntimeReplay.changedMeshFailures},inheritedShorteningProofs:report.inheritedShorteningWitnesses.length,totalFailures:report.totalFailures,inheritedFailures:report.inheritedFailures,newFailures:report.newFailures,changedMeshFailures:report.changedMeshFailures,unchangedMeshRegressions:report.unchangedMeshRegressions,newFailuresByBatch:report.newFailuresByBatch}));
  assert.equal(report.newFailures,0,JSON.stringify(report.newFailureExamples));
 }finally{rmSync(run,{recursive:true,force:true});}
});
