"""Verify six supplementary adjacent source views without rendering or retouching.
python3 scripts/verify-airfield-adjacent-pairs.py BASELINE CANDIDATE COMPARISONS OUTPUT
The primary final-art/model receipt remains the 16-view, 48-sample proof.
"""
import hashlib,json,sys
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
base,candidate,comparisons,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
load=lambda p:json.loads(Path(p).read_text())
a=load(base/'airfield-render-record.json');b=load(candidate/'airfield-render-record.json')
final=load(root/'docs/airfield-enrichment-final-art-verification.json')
pairs=load(comparisons/'comparison-manifest.json')
names=[f'eye-{group}-{stage}' for group in ['workshop','court','terrace'] for stage in ['before','after']]
assert len(pairs['pairs'])==6 and {p['name'] for p in pairs['pairs']}==set(names)
assert a['geometryJsonSha256']==final['baselineGeometrySha256'] and b['geometryJsonSha256']==final['candidateGeometrySha256']
assert b['sourceHashes']==final['candidateSourceHashes']
for report,folder in [(a,base),(b,candidate)]:
 assert set(report['views'])==set(names)
 assert report['verifiedRenderSettings']['samples']==8
 assert report['frozenCameraManifestSha256']==final['frozenCameraManifestSha256']==sha(root/'docs/airfield-enrichment-cameras.json')
 assert report['geometryJsonSha256']==sha(folder/'airfield-geometry.json')
 for file,h in report['generatorHashes'].items():assert sha(root/file)==h,file
for key in ['generatorHashes','frozenCameraManifestSha256','verifiedRenderSettings','verifiedLighting']:assert a[key]==b[key],key
fields=['sourceEye','sourceTarget','sourceAnchor','cameraPositionBlender','cameraQuaternionBlender','cameraMatrixWorldBlender','projection','resolution','lensMillimetres','clipStart','clipEnd','sensorFit','sensorWidthMillimetres','sensorHeightMillimetres','verticalFovDegrees']
rows=[];count=0
for pair in pairs['pairs']:
 name=pair['name'];va=a['views'][name];vb=b['views'][name]
 for field in fields:assert va[field]==vb[field],(name,field)
 pairfile=comparisons/pair['file'];assert sha(pairfile)==pair['sha256'] and pair['scaled'] is False
 combined=Image.open(pairfile).convert('RGB');w,h=va['resolution'];assert combined.size==(w*2,h+66)
 sides=[]
 for offset,folder,view,label in [(0,base,va,'baseline'),(w,candidate,vb,'candidate')]:
  source=folder/view['file'];assert sha(source)==view['sha256'];im=Image.open(source).convert('RGBA');assert im.size==(w,h) and im.getchannel('A').getextrema()==(255,255)
  pixels=im.convert('RGB').tobytes();assert combined.crop((offset,66,offset+w,66+h)).tobytes()==pixels;count+=w*h
  sides.append({'side':label,'sourceSha256':sha(source),'rgbPixelsSha256':hashlib.sha256(pixels).hexdigest(),'completePixelEquality':True})
 rows.append({'name':name,'edge':va['edge'],'s':va['s'],'pairSha256':sha(pairfile),'sourceResolution':[w,h],'sources':sides})
receipt={'schema':'airfield-adjacent-source-pair-proof-v1','status':'passed','pairs':6,'samples':8,'candidateSceneSha256':b['sourceHashes']['src/airfield-scenery.ts'],'baselineGeometrySha256':a['geometryJsonSha256'],'candidateGeometrySha256':b['geometryJsonSha256'],'frozenCameraManifestSha256':final['frozenCameraManifestSha256'],'primaryFinalArtReceiptSha256':sha(root/'docs/airfield-enrichment-final-art-verification.json'),'verifierSha256':sha(__file__),'baselineRenderRecordSha256':sha(base/'airfield-render-record.json'),'candidateRenderRecordSha256':sha(candidate/'airfield-render-record.json'),'identicalCameraFields':fields,'identicalSettingsAndLighting':True,'completeSourcePixelsCompared':count,'scaled':False,'retouched':False,'views':rows,'notice':'Supplementary fixed forward poses around the original review positions. Same geometry as the final reopened models, but lower eight-sample image quality. Pair names before/after refer to the frozen review midpoint, not guaranteed visibility or a claim that every composition has been passed. Main final 16-pair proof remains authoritative. Offline source geometry only; no native GPU/gameplay/FPS claim.'}
(root/'docs/airfield-enrichment-adjacent-art-verification.json').write_text(json.dumps(receipt,indent=2)+'\n')
(out/'adjacent-source-pair-verification.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'status':'passed','pairs':6,'completeSourcePixels':count}))
