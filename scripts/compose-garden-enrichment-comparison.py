"""Labeled unretouched source-pixel comparisons; any downscaling is explicit."""
import argparse,json,math,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
p=argparse.ArgumentParser();p.add_argument('baseline',type=Path);p.add_argument('candidate',type=Path);p.add_argument('output',type=Path);p.add_argument('--views');p.add_argument('--final-set',action='store_true');args=p.parse_args();base,candidate,out=args.baseline,args.candidate,args.output;out.mkdir(parents=True,exist_ok=True)
root=Path(__file__).resolve().parents[1];manifest=json.loads((root/'docs/garden-enrichment-cameras.json').read_text());names=args.views.split(',') if args.views else [v['name'] for v in manifest['views'] if v['renderByDefault']];quality='eight-sample CPU draft'
if args.final_set:
 selection=json.loads((root/'docs/garden-enrichment-final-views.json').read_text());proof=json.loads((candidate/'final-paired-render-verification.json').read_text());assert proof['status']=='passed';names=selection['views'];quality='48-sample CPU final'
records=[]
for n in names:
 a=Image.open(base/(n+'.png')).convert('RGB');b=Image.open(candidate/(n+'.png')).convert('RGB');assert a.size==b.size
 pair=Image.new('RGB',(a.width*2,a.height+66),'#182330');d=ImageDraw.Draw(pair);d.text((14,8),n+' | '+quality+' | identical source cameras / materials / normals / lighting',fill='white');d.text((14,32),'LEFT: original Garden in local unpublished 36a4e224 baseline     RIGHT: local enrichment candidate',fill='#bed7e5');d.text((14,49),'Offline exact-source static preview; approximate lighting/materials; no kart, HUD, native gameplay, GPU or FPS proof',fill='#bed7e5');pair.paste(a,(0,66));pair.paste(b,(a.width,66));path=out/(n+'-matched-pair.png');pair.save(path);records.append({'name':n,'file':path.name,'sourceResolution':list(a.size),'pairResolution':list(pair.size),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'scaled':False})
summary_groups=[names[i:i+4] for i in range(0,len(names),4)]
for group,ns in enumerate(summary_groups):
 sheet=Image.new('RGB',(1280,len(ns)*426+58),'#182330');d=ImageDraw.Draw(sheet);d.text((14,10),'Garden010 | frozen source cameras | '+quality+' | source images scaled to fit comparison sheet',fill='white');d.text((14,32),'LEFT: original local baseline     RIGHT: local enrichment     No gameplay / GPU / FPS claim',fill='#bed7e5')
 for i,n in enumerate(ns):
  y=58+i*426;d.text((10,y+4),n+' | identical camera, source-normal shader, materials and original lighting',fill='white')
  for j,folder in enumerate([base,candidate]):
   im=Image.open(folder/(n+'.png')).convert('RGB');im.thumbnail((640,400),Image.Resampling.LANCZOS);sheet.paste(im,(j*640+(640-im.width)//2,y+26+(400-im.height)//2))
 sheet.save(out/('garden-'+('final' if args.final_set else 'draft')+'-pairs-'+str(group+1)+'.png'))
(out/'comparison-manifest.json').write_text(json.dumps({'pairs':records,'sourceCameraManifest':'docs/garden-enrichment-cameras.json','notice':'Full-resolution pairs retain every input pixel. Summary sheets are explicitly downscaled; no image retouching.'},indent=2)+'\n')
