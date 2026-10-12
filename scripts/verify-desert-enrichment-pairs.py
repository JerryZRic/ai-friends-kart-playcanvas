"""Verify exactly18 final paired source-geometry renders and reopened models.
python3 scripts/verify-desert-enrichment-pairs.py BASELINE CANDIDATE
No rendering, source modification or image retouching.
"""
import sys,json,hashlib
from pathlib import Path
from PIL import Image,ImageChops
root=Path(__file__).resolve().parents[1];base,candidate=map(Path,sys.argv[1:3]);sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest();load=lambda p:json.loads(Path(p).read_text())
selection=load(root/'docs/desert-enrichment-final-views.json');frozen=load(root/'docs/desert-enrichment-cameras.json');a=load(base/'desert-render-record.json');b=load(candidate/'desert-render-record.json');names=selection['views'];assert len(names)==len(set(names))==18
assert a['geometryJsonSha256']==frozen['baseline']['geometrySha256']
assert a['sourceIdentity']=='archived-local-unpublished-baseline' and b['sourceIdentity']=='local-unpublished-candidate'
assert a['triangles']==107224 and a['vertices']==133911 and a['batches']==22
assert b['batches']==22 and b['triangles']<125000 and b['triangles']-a['triangles']<=16000 and b['vertices']<200000
for report,directory in [(a,base),(b,candidate)]:
 assert set(report['views'])==set(names),'Final set must contain exactly the selected18 views'
 assert report['verifiedRenderSettings']['samples']==48
 assert report['frozenCameraManifestSha256']==selection['frozenCameraManifestSha256']==sha(root/'docs/desert-enrichment-cameras.json')
 proof=load(directory/'reopened-model-verification.json');assert proof['status']=='passed'
 assert proof['reopenedBlendSha256']==sha(directory/'desert-original-scene.blend')==report['originalModels']['blend']['sha256']
 assert proof['glbSha256']==sha(directory/'desert-original-scene.glb')==report['originalModels']['glb']['sha256']
 assert proof['geometrySha256']==sha(directory/'desert-geometry.json')==report['geometryJsonSha256']
 assert proof['sourceHashes']==report['sourceHashes']
 for file,h in report['generatorHashes'].items():assert sha(root/file)==h,file
for k in ['generatorHashes','frozenCameraManifestSha256','verifiedRenderSettings','verifiedLighting']:assert a[k]==b[k],k
fields=['cameraPositionBlender','cameraQuaternionBlender','cameraMatrixWorldBlender','projection','resolution','lensMillimetres','clipStart','clipEnd','sensorFit','sensorWidthMillimetres','sensorHeightMillimetres']
rows=[]
for name in names:
 va,vb=a['views'][name],b['views'][name]
 for k in fields:assert va[k]==vb[k],(name,k)
 for k in ['verticalFovDegrees','orthographicScaleMetres']:
  if k in va:assert va[k]==vb[k]
 for directory,v in [(base,va),(candidate,vb)]:assert sha(directory/v['file'])==v['sha256']
 ia=Image.open(base/va['file']).convert('RGBA');ib=Image.open(candidate/vb['file']).convert('RGBA');assert ia.size==ib.size==tuple(va['resolution'])
 diff=ImageChops.difference(ia.convert('RGB'),ib.convert('RGB'));bbox=diff.getbbox()
 rows.append({'name':name,'baselineSha256':va['sha256'],'candidateSha256':vb['sha256'],'resolution':va['resolution'],'pixelDifferenceBounds':bbox,'notice':'Difference bounds are supporting evidence only, not visual approval'})
receipt={'schema':'desert-final-paired-render-verification-v1','status':'passed','pairs':18,'selectionSha256':sha(root/'docs/desert-enrichment-final-views.json'),'cameraManifestSha256':sha(root/'docs/desert-enrichment-cameras.json'),'identicalCameraFields':fields,'identicalGeneratorsSettingsAndLighting':True,'baselineGeometrySha256':a['geometryJsonSha256'],'candidateGeometrySha256':b['geometryJsonSha256'],'baselineSourceHashes':a['sourceHashes'],'candidateSourceHashes':b['sourceHashes'],'baselineRenderRecordSha256':sha(base/'desert-render-record.json'),'candidateRenderRecordSha256':sha(candidate/'desert-render-record.json'),'baselineReopenedModelProofSha256':sha(base/'reopened-model-verification.json'),'candidateReopenedModelProofSha256':sha(candidate/'reopened-model-verification.json'),'views':rows,'notice':'Both exact reopened models and selected pixel inputs verified. Offline CPU source-geometry review only, no gameplay/GPU/performance proof.'}
(candidate/'final-paired-render-verification.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
