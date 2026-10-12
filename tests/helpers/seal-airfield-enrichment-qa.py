"""Aggregate final distinct passed files and exact portable evidence, never rerun totals."""
from pathlib import Path
import json,hashlib,datetime,sys
A=Path(sys.argv[2]) if len(sys.argv)==3 else Path('../land-map-artifacts/airfield-enrichment-audit')
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
read=lambda p:json.loads(Path(p).read_text())
assert len(sys.argv) in [2,3],'Supply explicitly approved final scene SHA256 and optional audit-evidence directory'
source=sys.argv[1];assert len(source)==64 and sha('src/airfield-scenery.ts')==source
manifest='docs/airfield-enrichment-qa-files.json';m=read(manifest)
assert m['state']=='Final source and QA dependencies frozen'
for p,h in m['finalFileSha256'].items():assert sha(p)==h,p
for p,h in m['excludedOriginalInputsSha256'].items():assert sha(p)==h,p
r=read(A/'retained-native-receipt.json');a=read(A/'final-additive-inherited-receipt.json');c=read(A/'camera-pair-receipt.json');x=read(A/'extra-camera-pair-receipt.json');g=read(A/'candidate-geometry-report.json')
assert r['finalSourceSha256']==c['sourceSha256']==x['sourceSha256']==g['sourceSha256']==source
assert a['status']==c['status']==x['status']==g['status']=='passed'
assert a['stable'] is True and a['sourceHashesBefore']==a['sourceHashesAfter']
assert a['sourceHashesAfter']['src/airfield-scenery.ts']==source and a['sourceHashesAfter'][manifest]==sha(manifest)
for p,h in m['finalFileSha256'].items():assert a['sourceHashesAfter'][p]==h,(p,'final additive execution did not bind current dependency')
assert g['stable'] is True and g['sourceHashesBefore']==g['sourceHashesAfter']
for p,h in g['sourceHashesAfter'].items():assert a['sourceHashesAfter'][p]==h,(p,'geometry report is not from the final source-stable additive run')

runs=r['runs']+a['runs'];files=[row['file'] for row in runs]+['tests/airfield-enrichment-camera.test.ts','tests/airfield-enrichment-extension.test.ts'];assert len(files)==len(set(files))==28
for row in runs:
 assert row['code']==0 and row['termination'] is None and row['signal'] is None
 s=row['summary'];assert s['tests']==s['pass'] and s['tests']>0 and all(s[k]==0 for k in ['fail','cancelled','skipped','todo'])
assert len(c['runs'])==4 and len(x['runs'])==2
expected_retained=['tests/'+n+'.test.ts' for n in ['airfield-gameplay-balance','airfield-gameplay-camera','airfield-gameplay-npc','airfield-gameplay-routes','airfield-gameplay','airfield-independent-audit','airfield-menu','airfield-preview-assets','airfield-route-cursor','airfield-route-footprints','airfield-route-geometry','airfield-route-shared-tail','airfield-scene']]
expected_additive=['tests/airfield-enrichment-geometry.test.ts','tests/airfield-enrichment-oracles.test.ts','tests/airfield-enrichment-inventory.test.ts','tests/mountain-enrichment-contract.test.ts','tests/town-enrichment-geometry.test.ts']+['tests/'+n+'-enrichment-inventory.test.ts' for n in ['quarry','forest','workshop','harvest','desert','snow','caldera','garden']]
assert sorted(row['file'] for row in r['runs'])==sorted(expected_retained)==sorted(m['retainedTestFiles'])
assert [row['file'] for row in a['runs']]==expected_additive
assert [(row['stage'],row['suite'])for row in c['runs']]==[(stage,suite)for stage in ['baseline','candidate']for suite in ['retained','local']]
assert [row['stage']for row in x['runs']]==['baseline','candidate']
assert c['stable'] is True and c['sourceHashesBefore']==c['sourceHashesAfter']
assert x['stable'] is True and x['sourceHashesBefore']==x['sourceHashesAfter']
expected_camera_names={f'{stage}-{suite}-camera-report.json' for stage in ['baseline','candidate'] for suite in ['retained','local']}
assert set(c['reportFiles'])==expected_camera_names
original_outputs=read('tests/fixtures/airfield-enrichment-camera-outputs.json')
assert c['expectedFixtureSha256']==sha('tests/fixtures/airfield-enrichment-camera-outputs.json')=='596e883062ddd1683ebae3f3aedfcdae4bf04e7faf8100af15003674a5b39f67'
for name,h in c['reportFiles'].items():
 assert sha(A/name)==h,(name,'camera detailed report differs from exact executed pair receipt hash')
 stage,suite=name.split('-')[:2];report=read(A/name)
 assert report['stage']==stage and report['sourceSha256']==(source if stage=='candidate' else original_outputs['baselineSourceSha256'])
 assert report['stable'] is True and report['sourceHashesBefore']==report['sourceHashesAfter']==c['sourceHashesAfter']
 assert {k:report['outputs'][k]for k in ['rows','outputSha256','labelSha256','phases']}==original_outputs[suite]
 assert report['outputs']['changedRows']==0 and report['outputs']['changes']==[]
 if suite=='retained':assert report['retractions']==original_outputs['retainedRetractions']==55 and report['retractionOutputSha256']==original_outputs['retainedRetractionOutputSha256']
 else:assert report['camera']['witnesses']==report['camera']['newWitnesses']==[]
extra_outputs=read('tests/fixtures/airfield-enrichment-camera-extension-outputs.json')
assert x['fixtureSha256']==sha('tests/fixtures/airfield-enrichment-camera-extension-outputs.json')=='35190795d6c5484eb723c63c7e346803ca9e2b8c5923a498180fbc9becc78cec'
extension_reports=[]
for stage in ['baseline','candidate']:
 report=read(A/f'{stage}-extension-camera-report.json');extension_reports.append(report)
 assert report['stage']==stage and report['sourceSha256']==(source if stage=='candidate' else extra_outputs['sourceSha256'])
 assert report['stable'] is True and report['sourceHashesBefore']==report['sourceHashesAfter']==x['sourceHashesAfter']
 assert {k:report['outputs'][k]for k in ['rows','outputSha256','labelSha256','phases']}==extra_outputs['outputs']
 assert report['outputs']['changedRows']==0 and report['outputs']['changes']==[] and report['camera']['witnesses']==report['camera']['newWitnesses']==[]
 assert report['baselineFailuresSha256']==extra_outputs['baselineFailuresSha256']
 assert report['camera']['retractions']==extra_outputs['retractions'] and report['camera']['forwardRetractions']==extra_outputs['forwardRetractions']
 for key in ['denseStations','densePoses','movingFrames']:assert report['camera'][key]==x[key]
 assert report['outputs']['rows']==x['rows'] and len(report['camera']['newWitnesses'])==x['newWitnesses']
assert {k:v for k,v in extension_reports[0]['camera'].items()if k!='failures'}==extension_reports[1]['camera']

assert all(row['code']==0 and row['termination'] is None and row['signal'] is None for row in c['runs']+x['runs'])
assert c['retained']['changedRows']==c['local']['changedRows']==c['local']['newWitnesses']==x['changedRows']==x['newWitnesses']==0
assert c['retained']['rows']==519453 and c['local']['rows']==311356 and x['rows']==51864
assert all(v==[] for v in [g['selfIntersectionFailures'],g['coflush']['exposed'],g['assembly']['terrainIntrusions'],g['assembly']['intrusions']])
base=read(A/'baseline-geometry-report.json');assert len(g['binaryOriginalBuffers'])==20 and g['binaryOriginalBuffers']==base['binaryOriginalBuffers'] and g['signedZeroMutationSentinels']==1
# Assert every exact runtime, original-plan and transitive camera implementation input
# still equals the identity actually executed. Only later review/catalog layers differ.
plan=read('tests/helpers/airfield-enrichment-camera-frozen.json')
extra=['tests/airfield-enrichment-camera.test.ts','tests/airfield-enrichment-extension.test.ts','tests/helpers/emitted-scene-oracle.ts','tests/helpers/bounded-test-process.ts','tests/helpers/instrumented-source-files.ts','docs/airfield-enrichment-cameras.json','docs/scene-baselines/airfield-original/src/airfield-scenery.ts.txt','package.json','package-lock.json']
extra += ['tests/helpers/airfield-enrichment-'+n+'.ts' for n in ['camera-worker','extension-worker','pose-worker','camera-records','camera-checks','scene','contract','source-stability']]
extra += ['tests/helpers/airfield-enrichment-camera-frozen.json']
extra += ['tests/fixtures/airfield-enrichment-'+n+'.json' for n in ['camera-outputs','camera-extension-plan','camera-extension-outputs','original-inventory','original-geometry']]
protected={p:h for p,h in c['sourceHashesAfter'].items() if p.startswith('src/') or p in extra or p in plan['protected']}
assert set(extra)<=set(protected)
for p,h in protected.items():assert sha(p)==h and x['sourceHashesAfter'][p]==h,p+' changed since final complete camera pair'
allowed_later_changes={'docs/airfield-enrichment-art-direction.md':'Final artist-authored visual review and completion status','tests/airfield-enrichment-inventory.test.ts':'Require the final supplementary adjacent-view verifier in the complete portable manifest','tests/helpers/airfield-enrichment-geometry-worker.ts':'Add binary64/binary32 original-buffer identity and signed-zero mutation proof only','tests/helpers/freeze-airfield-enrichment-qa-files.py':'Clarify complete portable rerun scope and include the final supplementary adjacent-view verifier','tests/helpers/freeze-airfield-enrichment-review.py':'Restrict review certification to exact changed paths before composing historical Garden layer','docs/airfield-enrichment-qa-changes.md':'Final factual QA documentation','docs/airfield-preview-provenance.json':'Reviewed final source-matched catalog provenance','public/map-previews/airfield.webp':'Reviewed final source-matched catalog poster','tests/helpers/airfield-enrichment-reviewed-revisions.ts':'Pin exact final Airfield-only review whitelist and overlay bytes'}
later={}
for p,h in c['sourceHashesAfter'].items():
 current=sha(p)
 if current==h:continue
 assert p in allowed_later_changes,(p,'unreviewed post-camera change')
 assert m['finalFileSha256'][p]==current
 later[p]={'executedCameraRunSha256':h,'finalReviewedSha256':current,'scope':allowed_later_changes[p]}
attestation={'schema':'airfield-camera-final-applicability-v1','status':'passed','sourceSha256':source,'cameraPairReceiptSha256':sha(A/'camera-pair-receipt.json'),'extensionPairReceiptSha256':sha(A/'extra-camera-pair-receipt.json'),'unchangedExecutedCameraInputs':protected,'exactLaterNonCameraChanges':later,'allExactAtFinalSeal':True,'scope':'All runtime sources, protected plan inputs, exact transitive CPU camera implementation, baseline snapshots and binary64 fixtures remain identical to the final paired executions. Later geometry-proof-only QA, exact review-layer, catalog and documentation identities are separately enumerated and sealed by final additive/inherited QA.'}
(A/'camera-final-applicability-receipt.json').write_text(json.dumps(attestation,indent=2)+'\n')
t=read(A/'final-typecheck-receipt.json');assert t['status']=='passed' and t['code']==0 and t['sourceSha256']==source and t['portableManifestSha256']==sha(manifest)
names=['final-typecheck-receipt.json','retained-native-receipt.json','final-additive-inherited-receipt.json','candidate-geometry-report.json','baseline-geometry-report.json','original-camera-freeze-receipt.json','original-camera-freeze/baseline-retained-camera-report.json','original-camera-freeze/baseline-local-camera-report.json','portable-original-extension-freeze-receipt.json','camera-pair-receipt.json','extra-camera-pair-receipt.json','camera-final-applicability-receipt.json','retained-native/airfield-native-camera.json','retained-native/airfield-native-assembly-bounds.json','retained-native/all-report.json']+[f'{stage}-{suite}-camera-report.json' for stage in ['baseline','candidate'] for suite in ['retained','local','extension']]
# Portable evidence is separately authored, never silently sanitized from private evidence.
for name in names:
 raw=(A/name).read_bytes();assert b'/workspace/'not in raw and b'/tmp/'not in raw,name+' contains a private path'
native=read(A/'retained-native/airfield-native-camera.json');bounds=read(A/'retained-native/airfield-native-assembly-bounds.json');independent=read(A/'retained-native/all-report.json')
assert native['sourceSHA256']==bounds['sourceSHA256'] and native['sourceSHA256']['src/airfield-scenery.ts']==source
for p,h in native['sourceSHA256'].items():assert sha(p)==h
assert native['assemblies']==len(bounds['measuredBounds'])==8856 and native['individualMeshBounds']==448704
assert native['intrusionCount']==len(bounds['intrusions'])==native['terrainActualTriangleIntersections']==native['underfaceActualTriangleIntersections']==0
assert native['defaultRearViews']==372 and native['interpolationSamples']==5628
assert len(independent['checks'])==39 and all(row['status']=='passed' for row in independent['checks'])
tests=sum(row['summary']['tests'] for row in runs)+3
out={'schema':'airfield-final-distinct-qa-v1','status':'passed','finished':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSha256':source,'portableManifest':{'file':manifest,'sha256':sha(manifest)},'distinctTestFiles':len(files),'distinctTests':tests,'distinctFiles':files,'testGroups':{'originalAirfield':{'files':13,'tests':sum(row['summary']['tests'] for row in r['runs'])},'additiveAndInherited':{'files':len(a['runs']),'tests':sum(row['summary']['tests'] for row in a['runs'])},'pairedCamera':{'files':2,'tests':3}},'receiptFiles':{p:sha(A/p) for p in names},'originalGeometry':{'baselineCommit':m['baselineCommit'],'components':1585,'assemblies':16,'originalTriangles':94747,'originalVertices':103278,'batches':20},'candidateGeometry':{'budget':g['budget'],'newTriangles':g['newTriangles'],'addedComponents':g['addedComponents']},'cameraComparisonRows':{'retained':519453,'local':311356,'extraRange':51864,'totalComparedSequenceRows':882673,'changedRows':0,'newTriangleWitnesses':0,'retainedHistoricalRetractions':55},'originalNativeCoverage':r['exactCoverage'],'actualNativeAssemblies':{k:v for k,v in native.items() if k not in ['sourceSHA256','cameraRuns']},'countingPolicy':'Each final top-level test file counted once. Failed diagnostics, original-only freeze workers, geometry/art repair iterations and repeated oracle executions excluded. Extra-range samples intentionally overlap original dense coverage; sequence rows are not unique physical stations.','cameraApplicability':attestation['scope'],'limitations':['CPU indexed-source geometry and NullGraphicsDevice native vehicle assemblies; actual source-derived pixel comparisons are separate art receipts','Map source/model kit excludes73 unrelated original assets with exact hash ledger; complete inventory/full-game reruns require restoring authorized runtime assets','No native browser GPU, FPS, Windows or exact-head remote CI claim; parent owns shared49/build/repro and release packaging']}
(A/'final-distinct-qa-receipt.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'distinctFiles':len(files),'distinctTests':tests,'receiptSha256':sha(A/'final-distinct-qa-receipt.json')}))
