"""Package the verified Town poster/provenance without unused public byproducts.
python3 scripts/finalize-town-catalog.py CANDIDATE_OUTPUT CORRECTED_BASELINE_OUTPUT
Does not change source geometry, render scripts, images, models or render records.
"""
import argparse,hashlib,json,shutil
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('candidate',type=Path);p.add_argument('baseline',type=Path);args=p.parse_args()
root=Path(__file__).resolve().parents[1];out=args.candidate.resolve();base=args.baseline.resolve()
sha=lambda path:hashlib.sha256(Path(path).read_bytes()).hexdigest()
c=json.loads((out/'town-render-record.json').read_text());b=json.loads((base/'town-render-record.json').read_text());frozen=json.loads((root/'docs/town-enrichment-cameras.json').read_text())
expected={v['name'] for v in frozen['views'] if v['renderByDefault']}|{v['name'] for v in frozen['catalogViews']}
assert set(c['views'])==set(b['views'])==expected and len(expected)==18
for key in ['generatorHashes','frozenCameraManifestSha256','verifiedRenderSettings','verifiedLighting','normalShading']:assert c[key]==b[key],key
assert c['sourceIdentity']=='current-candidate' and b['sourceIdentity']=='archived-baseline'
assert b['sourceHashes']==frozen['baselineGeometryContract']['sourceHashes']
for path,digest in {**c['sourceHashes'],**c['generatorHashes']}.items():assert sha(root/path)==digest,path
for directory,record in [(out,c),(base,b)]:
 for view in record['views'].values():assert sha(directory/view['file'])==view['sha256']
 for model in record['originalModels'].values():assert sha(directory/model['file'])==model['sha256']
 check=json.loads((directory/'reopened-model-verification.json').read_text());assert check['status']=='passed' and check['reopenedBlendSha256']==record['originalModels']['blend']['sha256'] and check['explicitSourceNormalShaderLinksVerified']
for name in expected:
 for key in ['cameraMatrixWorldBlender','cameraPositionBlender','cameraQuaternionBlender','projection','sensorFit','sensorWidthMillimetres','sensorHeightMillimetres','lensMillimetres','clipStart','clipEnd','resolution','samples']:assert c['views'][name][key]==b['views'][name][key],(name,key)
poster=c['menuAsset'];assert poster['file']=='public/map-previews/town-overview.webp' and sha(root/poster['file'])==poster['sha256']
# Keep the original generation evidence and byproduct privately in the output
# bundle; the app has no reference to this optional topdown WebP.
extra=c.pop('topdownAsset');assert extra['file']=='public/map-previews/town-topdown.webp'
public_extra=root/extra['file'];archive=out/'town-topdown-unused-export.webp'
if public_extra.exists():
 assert sha(public_extra)==extra['sha256'],'Do not remove a changed file'
 shutil.copy2(public_extra,archive);public_extra.unlink()
else:assert archive.exists() and sha(archive)==extra['sha256']
shutil.copy2(base/'town-render-record.json',out/'town-corrected-baseline-provenance.json')
shutil.copy2(base/'reopened-model-verification.json',out/'baseline-reopened-model-verification.json')
c['comparisonSourceHashes']={'archivedBaseline':b['sourceHashes'],'currentCandidate':c['sourceHashes']}
c['comparisonRecords']={'baseline':{'file':'town-corrected-baseline-provenance.json','sha256':sha(out/'town-corrected-baseline-provenance.json'),'artifactContext':'Separate corrected-baseline output bundle; its relative image/model names are not candidate files'},'candidateActualRender':{'file':'town-render-record.json','sha256':sha(out/'town-render-record.json')},'pairedViews':16,'additionalLegacyCatalogViews':2,'sameCorrectedShaderCamerasLightingExposure':True}
c['modelVerification']={'file':'reopened-model-verification.json','sha256':sha(out/'reopened-model-verification.json')}
c['packagingGeneratorHashes']={'scripts/finalize-town-catalog.py':sha(__file__)}
c['catalogPackaging']={'onlyRuntimePoster':'public/map-previews/town-overview.webp','excludedUnusedPublicTopdownWebp':{'sha256':extra['sha256'],'archivedAs':archive.name},'topdownDelivery':'town-topdown.png','originalRenderEvidenceUnchanged':True,'notice':'Topdown PNG remains a reusable catalog view; its unused WebP byproduct is excluded from public runtime assets. Render generator hashes still identify the exact bytes that produced the images.'}
text=json.dumps(c,indent=2)+'\n';(out/'town-preview-provenance.json').write_text(text);(root/'docs/town-preview-provenance.json').write_text(text)
result={'status':'packaged','sourceSha256':c['sourceHashes']['src/town-scenery.ts'],'baselineSourceSha256':b['sourceHashes']['src/town-scenery.ts'],'posterSha256':poster['sha256'],'publicProvenanceSha256':sha(root/'docs/town-preview-provenance.json'),'candidateActualRenderRecordSha256':sha(out/'town-render-record.json'),'baselineActualRenderRecordSha256':sha(base/'town-render-record.json'),'unusedPublicTopdownRemoved':not public_extra.exists()}
(out/'catalog-packaging-verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
