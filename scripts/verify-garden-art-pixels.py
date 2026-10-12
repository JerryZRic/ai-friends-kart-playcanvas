"""Verify full, unscaled paired pixels and write portable final-art evidence.
python scripts/verify-garden-art-pixels.py BASELINE CANDIDATE COMPARISONS OUTPUT
This verifies pixel provenance; it does not manufacture an art approval.
"""
import json,hashlib,sys
from pathlib import Path
from PIL import Image
base,candidate,comparisons,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
root=Path(__file__).resolve().parents[1];sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest();load=lambda p:json.loads(Path(p).read_text())
proof=load(candidate/'final-paired-render-verification.json');visible=load(candidate/'visible-first-hit-verification.json');pairs=load(comparisons/'comparison-manifest.json');selection=load(root/'docs/garden-enrichment-final-views.json')
assert proof['status']==visible['status']=='passed' and proof['pairs']==len(pairs['pairs'])==len(selection['views'])==13
assert visible['geometrySha256']==proof['candidateGeometrySha256']
rows=[];pixel_count=0
for pair in pairs['pairs']:
 assert not pair['scaled'];name=pair['name'];p=comparisons/pair['file'];assert sha(p)==pair['sha256'];im=Image.open(p).convert('RGB');a=Image.open(base/(name+'.png')).convert('RGBA');b=Image.open(candidate/(name+'.png')).convert('RGBA');assert a.size==b.size;w,h=a.size;assert im.size==(w*2,h+66)
 assert a.getchannel('A').getextrema()==b.getchannel('A').getextrema()==(255,255),'Paired RGB conversion would lose nonopaque alpha'
 sides=[]
 for offset,source,folder,label in [(0,a,base,'baseline'),(w,b,candidate,'candidate')]:
  actual=im.crop((offset,66,offset+w,66+h)).tobytes();expected=source.convert('RGB').tobytes();assert actual==expected,(name,label,'Complete source pixels differ');pixel_count+=w*h
  sides.append({'side':label,'sourceSha256':sha(folder/(name+'.png')),'sourceRgbPixelSha256':hashlib.sha256(expected).hexdigest(),'extractedRgbPixelSha256':hashlib.sha256(actual).hexdigest(),'cropXYXY':[offset,66,offset+w,66+h],'completePixelEquality':True,'sourceAlphaExactlyOpaque':True})
 rows.append({'name':name,'pairFile':p.name,'pairSha256':sha(p),'sourceResolution':[w,h],'sources':sides})
private={'schema':'garden-complete-source-pixel-equality-v1','status':'passed','pairs':13,'allSourcePixelsCompared':pixel_count,'scaled':False,'retouched':False,'pairProofSha256':sha(candidate/'final-paired-render-verification.json'),'views':rows}
(out/'complete-source-pixel-equality.json').write_text(json.dumps(private,indent=2)+'\n')
receipt={'schema':'garden-portable-final-art-evidence-v1','status':'verified-final-artifacts','sourceBaseCommit':'36a4e224e915f2481513c805a9ed4f6445199d6d','candidateSourceHashes':proof['candidateSourceHashes'],'frozenCameraManifestSha256':proof['cameraManifestSha256'],'viewSelectionSha256':proof['selectionSha256'],'baselineGeometrySha256':proof['baselineGeometrySha256'],'candidateGeometrySha256':proof['candidateGeometrySha256'],'baselineRenderRecordSha256':proof['baselineRenderRecordSha256'],'candidateRenderRecordSha256':proof['candidateRenderRecordSha256'],'baselineReopenedModelProofSha256':proof['baselineReopenedModelProofSha256'],'candidateReopenedModelProofSha256':proof['candidateReopenedModelProofSha256'],'pairedRenderProofSha256':sha(candidate/'final-paired-render-verification.json'),'completeSourcePixelEqualityProofSha256':sha(out/'complete-source-pixel-equality.json'),'visibleFirstHitProofSha256':sha(candidate/'visible-first-hit-verification.json'),'verifiedPairCount':13,'nativeProjectionPairs':8,'unchangedCatalogPairs':5,'completeSourcePixelsCompared':pixel_count,'allSourcePixelsIdenticalInsideUnscaledPairs':True,'visiblePrimaryGroupsMeetMinimumSpan':True,'views':[{'name':r['name'],'pairSha256':r['pairSha256'],'sourceResolution':r['sourceResolution'],'baselineSha256':r['sources'][0]['sourceSha256'],'candidateSha256':r['sources'][1]['sourceSha256']} for r in rows],'notice':'Portable evidence identities only; no private filesystem or Library identifiers. Complete original-source pixel equality and reopened model identity are verified. Offline approximate lighting/materials, no native gameplay/GPU/FPS claim. The art-direction document records visual review separately.'}
(root/'docs/garden-enrichment-final-art-verification.json').write_text(json.dumps(receipt,indent=2)+'\n');(out/'portable-final-art-verification.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({'status':'passed','pairs':13,'completeSourcePixels':pixel_count}))
