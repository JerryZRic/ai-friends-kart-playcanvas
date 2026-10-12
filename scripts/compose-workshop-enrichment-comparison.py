"""Compose immutable Workshop baseline/candidate PNG pairs without changing scene pixels.

python3 scripts/compose-workshop-enrichment-comparison.py BASELINE CANDIDATE OUTPUT \
  --approved ART_ACCEPTED_EXPORT

Requires Pillow. Inputs contain workshop-render-record.json and its original PNGs.
The optional approved export proves exact decoded RGBA equality for its views.
All output provenance is portable: filenames and hashes, never private paths.
For byte-identical sheet reproduction use the same Pillow and DejaVu Sans font;
the source PNG hashes and decoded-pixel equality do not depend on sheet fonts.
"""
import argparse
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFont
import json, hashlib, math
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('baseline',type=Path)
parser.add_argument('candidate',type=Path)
parser.add_argument('output',type=Path)
parser.add_argument('--manifest',type=Path,default=Path(__file__).resolve().parents[1]/'docs/workshop-enrichment-cameras.json')
parser.add_argument('--approved',type=Path,help='Optional earlier art-accepted export with render record and PNGs')
parser.add_argument('--font',type=Path,help='Optional TrueType font; DejaVu Sans is preferred for exact sheet reproduction')
args=parser.parse_args()
for directory in [args.baseline,args.candidate]:assert directory.is_dir(),str(directory)
args.output.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
b=json.loads((args.baseline/'workshop-render-record.json').read_text());c=json.loads((args.candidate/'workshop-render-record.json').read_text());f=json.loads((args.manifest).read_text())
names=[v['name'] for v in f['views']+f['catalogViews'] if v.get('renderByDefault',True)]
assert b['sourceHashes']==f['baselineGeometryContract']['sourceHashes'],'Baseline source does not match frozen manifest'
assert b['frozenCameraManifestSha256']==c['frozenCameraManifestSha256']==sha(args.manifest)
assert set(b['views'])==set(c['views'])==set(names) and len(names)==18
for key in ['verifiedRenderSettings','verifiedLighting','normalShading','frozenCameraManifestSha256','generatorHashes']:
 assert b[key]==c[key],key
for path,h in b['sourceHashes'].items():
 if path!='src/workshop-scenery.ts':assert c['sourceHashes'][path]==h,path
pairs=[]
for name in names:
 bv,cv=b['views'][name],c['views'][name]
 assert {k:v for k,v in bv.items() if k not in ['sha256']}=={k:v for k,v in cv.items() if k not in ['sha256']},name+' different view metadata'
 bp=args.baseline/bv['file'];cp=args.candidate/cv['file']
 assert sha(bp)==bv['sha256'] and sha(cp)==cv['sha256']
 bi=Image.open(bp).convert('RGB');ci=Image.open(cp).convert('RGB');assert bi.size==ci.size==tuple(cv['resolution'])
 d=ImageChops.difference(bi,ci);hist=d.histogram(); changed=sum(1 for p in d.get_flattened_data() if p!=(0,0,0));mae=sum((i%256)*n for i,n in enumerate(hist))/(bi.width*bi.height*3)
 pairs.append({'name':name,'resolution':list(bi.size),'baselineSha256':bv['sha256'],'candidateSha256':cv['sha256'],'matchedCameraAndRenderInputs':True,'changedPixels':changed,'totalPixels':bi.width*bi.height,'meanAbsoluteRgbByteDifference':mae})
fonts=[args.font] if args.font else [Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),Path('/Library/Fonts/Arial.ttf'),Path('C:/Windows/Fonts/arial.ttf')]
fontpath=next((p for p in fonts if p and p.is_file()),None)
if args.font:assert fontpath,'Requested font does not exist'
font=ImageFont.truetype(str(fontpath),22) if fontpath else ImageFont.load_default(size=22)
small=ImageFont.truetype(str(fontpath),17) if fontpath else ImageFont.load_default(size=17)
out=args.output
def sheet(path,selected,title,cell_h=540):
 w=960;header=98;label=38;gap=12;bottom=50
 im=Image.new('RGB',(2*w+3*gap,header+len(selected)*(cell_h+label+gap)+bottom),(19,25,24));draw=ImageDraw.Draw(im)
 draw.text((gap,10),title,font=font,fill=(240,244,240));draw.text((gap,42),'BEFORE: original Workshop at published dev '+f['baselineSourceCommit'][:8],font=small,fill=(190,207,196));draw.text((2*gap+w,42),'AFTER: Workshop room architecture source '+c['sourceHashes']['src/workshop-scenery.ts'][:8],font=small,fill=(190,207,196))
 draw.text((gap,69),'Identical cameras, source-normal shader, lighting and exposure. Offline static source geometry.',font=small,fill=(176,190,182))
 for row,name in enumerate(selected):
  y=header+row*(cell_h+label+gap)
  kind='Shared chase' if '-chase-' in name else 'Forward road eye' if '-road-eye-' in name else 'Landmark-directed road eye' if '-landmark-' in name else 'Historical catalog pose'
  title=name.replace('workshop-chase-','').replace('workshop-landmark-','').replace('workshop-road-eye-','').replace('workshop-','').replace('-',' ').title()
  draw.text((gap,y),kind+' | '+title,font=font,fill=(240,244,240))
  for col,folder in enumerate([args.baseline,args.candidate]):
   src=Image.open(folder/(name+'.png')).convert('RGB');src.thumbnail((w,cell_h),Image.Resampling.LANCZOS)
   x=gap+col*(w+gap);im.paste(src,(x+(w-src.width)//2,y+label+(cell_h-src.height)//2))
 draw.text((gap,im.height-34),'Original game artwork. Bounded room-scale workshop enrichment; no gameplay, vehicle, GPU or frame-rate claim.',font=small,fill=(176,190,182))
 im.save(path)
 return {'file':path.name,'sha256':sha(path),'views':selected,'resolution':list(im.size),'presentation':'Paired source PNGs scaled proportionally, no crop or scene retouching'}
primary=['workshop-chase-lower-crossing-approach','workshop-chase-spool-north-architecture','workshop-chase-fork-signs','workshop-chase-lamp-return']
sheets=[sheet(out/'workshop-final-four-view-before-after.png',primary,'Workshop005 | accepted room-scale workshop composition | final matched source')]
for i in range(0,18,3):sheets.append(sheet(out/('workshop-final-all-views-%02d.png'%(i//3+1)),names[i:i+3],f'Workshop005 | full matched camera set {i+1:02d}-{i+3:02d} / 18',720 if any(n=='workshop-topdown' for n in names[i:i+3]) else 600))
approved=json.loads((args.approved/'workshop-render-record.json').read_text()) if args.approved else {'views':{}}
accepted=[]
for name,v in approved['views'].items():
 old=Image.open(args.approved/v['file']);new=Image.open(args.candidate/v['file']);oldpixels=old.convert('RGBA').tobytes();newpixels=new.convert('RGBA').tobytes()
 metadata=[k for k in old.info.keys()|new.info.keys() if old.info.get(k)!=new.info.get(k)]
 assert set(metadata)<=set(['Date','RenderTime','cycles.ViewLayer.total_time','cycles.ViewLayer.render_time','cycles.ViewLayer.synchronization_time']),metadata
 accepted.append({'name':name,'exactRgbaPixelMatch':oldpixels==newpixels,'rgbaPixelSha256':hashlib.sha256(newpixels).hexdigest(),'exactPngFileMatch':c['views'][name]['sha256']==v['sha256'],'approvedPngSha256':v['sha256'],'finalPngSha256':c['views'][name]['sha256'],'differentNonvisualMetadataFields':sorted(metadata)})
assert all(v['exactRgbaPixelMatch'] for v in accepted),'Final visual inputs differ from accepted composition'
record={'schema':'workshop-final-matched-preview-verification-v1','composerSha256':sha(__file__),'sheetFont':font.getname(),'approvedPixelComparisonPerformed':args.approved is not None,'baselineCommit':f['baselineSourceCommit'],'baselineSourceSha256':b['sourceHashes']['src/workshop-scenery.ts'],'candidateSourceSha256':c['sourceHashes']['src/workshop-scenery.ts'],'baselineRenderRecordSha256':sha(args.baseline/'workshop-render-record.json'),'candidateRenderRecordSha256':sha(args.candidate/'workshop-render-record.json'),'frozenCameraManifestSha256':sha(args.manifest),'pairs':pairs,'acceptedFourViewExactPixelEquality':accepted,'sheets':sheets,'notice':'Exact matched source cameras and shader input evidence; PNGs are offline static CPU rendering, not gameplay or runtime GPU evidence. Pixel differences are descriptive, not a perceptual quality metric.'}
(args.output/'matched-preview-verification.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'matchedPairs':len(pairs),'acceptedExactPixelImages':len(accepted),'sheets':len(sheets),'candidateSourceSha256':record['candidateSourceSha256']}))
