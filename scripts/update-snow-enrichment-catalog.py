"""Update only local Snow poster/provenance after final13-pair/model proof.
python3 scripts/update-snow-enrichment-catalog.py FINAL_CANDIDATE
No remote, Git, deployment, main/stable or Windows operations.
"""
import sys,json,hashlib
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1];out=Path(sys.argv[1]);sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest();load=lambda p:json.loads(Path(p).read_text())
report=load(out/'snow-render-record.json');paired=load(out/'final-paired-render-verification.json');proof=load(out/'reopened-model-verification.json');frozen=load(root/'docs/snow-enrichment-cameras.json');selection=load(root/'docs/snow-enrichment-final-views.json')
assert report['sourceIdentity']=='local-unpublished-candidate' and paired['status']==proof['status']=='passed' and paired['pairs']==13
assert paired['candidateRenderRecordSha256']==sha(out/'snow-render-record.json') and paired['candidateReopenedModelProofSha256']==sha(out/'reopened-model-verification.json')
assert paired['selectionSha256']==sha(root/'docs/snow-enrichment-final-views.json') and paired['cameraManifestSha256']==sha(root/'docs/snow-enrichment-cameras.json')
assert set(report['views'])==set(selection['views']) and report['verifiedRenderSettings']['samples']==48
for p,h in {**report['sourceHashes'],**report['generatorHashes']}.items():assert sha(root/p)==h,p
for kind in ['glb','blend']:assert sha(out/report['originalModels'][kind]['file'])==report['originalModels'][kind]['sha256']
for v in report['views'].values():assert sha(out/v['file'])==v['sha256']
assert proof['reopenedBlendSha256']==report['originalModels']['blend']['sha256'] and proof['glbSha256']==report['originalModels']['glb']['sha256']
poster=root/'public/map-previews/snow-overview.webp'
with Image.open(out/'snow-overview.png') as im:im.resize((1280,720),Image.Resampling.LANCZOS).convert('RGB').save(poster,'WEBP',quality=94,method=6)
assert 10000<poster.stat().st_size<500000
final={**report,'menuAsset':{'file':'public/map-previews/snow-overview.webp','sha256':sha(poster),'resolution':[1280,720],'sourceView':'snow-overview'},'finalPairedProofSha256':sha(out/'final-paired-render-verification.json'),'reopenedModelProofSha256':sha(out/'reopened-model-verification.json'),'localCatalogUpdaterSha256':sha(__file__)}
catalog={**final,'views':{name:final['views'][name] for name in frozen['catalogViews']}}
(root/'docs/snow-preview-provenance.json').write_text(json.dumps(catalog,indent=2)+'\n')
(out/'snow-preview-provenance.json').write_text(json.dumps(catalog,indent=2)+'\n')
(root/'docs/snow-enrichment-preview-provenance.json').write_text(json.dumps(final,indent=2)+'\n')
(out/'snow-local-candidate-provenance.json').write_text(json.dumps(final,indent=2)+'\n')
print('LOCAL_SNOW_CATALOG_UPDATED',sha(poster),'five legacy catalog poses; thirteen final verified views; no remote action')
