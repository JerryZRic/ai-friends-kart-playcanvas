"""Verify and assemble the complete 18-view Harvest baseline/candidate pairs.
python scripts/compare-harvest-enrichment-previews.py BASELINE_DIR CANDIDATE_DIR OUTPUT_DIR
Pillow is required. Original full-resolution PNGs remain the canonical evidence.
"""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('baseline',type=Path);p.add_argument('candidate',type=Path);p.add_argument('output',type=Path)
a=p.parse_args();root=Path(__file__).resolve().parents[1]
sha=lambda f:hashlib.sha256(Path(f).read_bytes()).hexdigest()
frozen=json.loads((root/'docs/harvest-enrichment-cameras.json').read_text())
B=json.loads((a.baseline/'harvest-render-record.json').read_text());C=json.loads((a.candidate/'harvest-render-record.json').read_text())
assert B['sourceIdentity']=='archived-baseline' and C['sourceIdentity']=='current-candidate'
expected=[v['name'] for v in frozen['views'] if v['renderByDefault']]+[v['name'] for v in frozen['catalogViews']]
assert len(expected)==18 and set(B['views'])==set(C['views'])==set(expected)
for key in ['generatorHashes','verifiedRenderSettings','verifiedLighting','normalShading','frozenCameraManifestSha256','routeLengthsMetres','lapLengthsMetres']:assert B[key]==C[key],key
for f,h in B['sourceHashes'].items():
 if f!='src/harvest-scenery.ts':assert C['sourceHashes'][f]==h,f
verifiers=[]
for record,folder in [(B,a.baseline),(C,a.candidate)]:
 assert sha(folder/'harvest-geometry.json')==record['geometryJsonSha256']
 for model in record['originalModels'].values():assert sha(folder/model['file'])==model['sha256']
 verified=json.loads((folder/'reopened-model-verification.json').read_text())
 assert verified['status']=='passed' and verified['sourceHashes']==record['sourceHashes']
 assert verified['glbActualPbrFactorsTexturesSamplersAndIdentityNodesVerified'] is True
 verifiers.append(verified['verifierSha256'])
 assert verified['reopenedBlendSha256']==record['originalModels']['blend']['sha256']
 assert verified['glbSha256']==record['originalModels']['glb']['sha256']
 for name,v in record['views'].items():assert sha(folder/v['file'])==v['sha256'],name
assert verifiers[0]==verifiers[1]==sha(root/'scripts/verify-harvest-enrichment-model.py')
for name in expected:assert {k:v for k,v in B['views'][name].items() if k!='sha256'}=={k:v for k,v in C['views'][name].items() if k!='sha256'},name
ids=['terrace-mill-reveal','orchard-descent','barn-historical-approach','contour-silo-approach']
groups={'approach-chase':['harvest-chase-'+s for s in ids],'approach-road-eye':['harvest-road-eye-'+s for s in ids],
        'district-chase':['harvest-chase-'+s for s in ['press-approach','fork-signs','barn-interior','granary-return','market-late-approach']],
        'original-catalog':[v['name'] for v in frozen['catalogViews']]}
assert sorted(n for names in groups.values() for n in names)==sorted(expected)
try:font=ImageFont.truetype('DejaVuSans.ttf',22);subtitle_font=ImageFont.truetype('DejaVuSans.ttf',19)
except OSError:font=ImageFont.load_default();subtitle_font=ImageFont.load_default()
notice='Offline source-geometry comparison; identical cameras and lighting; no gameplay/GPU/FPS verification'
group_labels={'approach-chase':'Driving views: fixed shared-chase approach cameras','approach-road-eye':'Driving views: fixed forward road-eye cameras','district-chase':'Driving views: fixed shared-chase district cameras','original-catalog':'Original catalog overview/detail poses; separate from driving views'}
a.output.mkdir(parents=True,exist_ok=True);sheets=[]
for group,names in groups.items():
 sheet=Image.new('RGB',(1920,105+len(names)*630),'#18201e');d=ImageDraw.Draw(sheet)
 d.text((16,12),'BASELINE: local 15db9eb (unpublished)',font=font,fill='white');d.text((976,12),'CANDIDATE: Harvest farm enrichment',font=font,fill='white')
 d.text((16,44),notice,font=subtitle_font,fill='#d8e5df');d.text((16,73),group_labels[group],font=subtitle_font,fill='#d8e5df')
 for row,name in enumerate(names):
  for column,(record,folder) in enumerate([(B,a.baseline),(C,a.candidate)]):
   with Image.open(folder/record['views'][name]['file']) as im:
    image=ImageOps.contain(im.convert('RGB'),(960,590),Image.Resampling.LANCZOS)
    sheet.paste(image,(960*column+(960-image.width)//2,105+row*630+(590-image.height)//2))
   d.text((960*column+16,105+row*630+597),name.removeprefix('harvest-'),font=font,fill='white')
  
 file=group+'-before-after.jpg';sheet.save(a.output/file,quality=94);sheets.append({'file':file,'sha256':sha(a.output/file),'views':names})
report={'kind':'source-derived static offline matched comparison','notice':'No kart, driver, HUD, gameplay, GPU or frame-rate evidence. Contact sheets are scaled/compressed presentations; canonical full-resolution PNGs and exact models remain retained.',
 'baselineSourceCommit':frozen['baselineSourceCommit'],'baselineIdentity':frozen['baselineIdentity'],'lastVerifiedPublicDevCommit':frozen['lastVerifiedPublicDevCommit'],
 'baselineSourceHashes':B['sourceHashes'],'candidateSourceHashes':C['sourceHashes'],'identicalGeneratorHashes':B['generatorHashes'],'frozenCameraManifestSha256':B['frozenCameraManifestSha256'],
 'identicalModelVerifierSha256':verifiers[0],'sameSettingsLightsNormalsAndCameraMatrices':True,'renderedPairs':len(expected),'unrenderedOptionalCameraCount':len(frozen['views'])+len(frozen['catalogViews'])-len(expected),
 'baselineModels':B['originalModels'],'candidateModels':C['originalModels'],'comparisonGenerator':{'file':'scripts/compare-harvest-enrichment-previews.py','sha256':sha(__file__)},'onSheetNotice':notice,'groupLabels':group_labels,'sheets':sheets,
 'views':[{'name':n,'baselineFile':B['views'][n]['file'],'baselineSha256':B['views'][n]['sha256'],'candidateFile':C['views'][n]['file'],'candidateSha256':C['views'][n]['sha256']} for n in expected]}
(a.output/'comparison-record.json').write_text(json.dumps(report,indent=2)+'\n');print('Verified18 exact same-camera pairs and wrote4 labeled comparison sheets')
