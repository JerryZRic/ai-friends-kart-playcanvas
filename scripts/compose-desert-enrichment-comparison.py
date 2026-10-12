"""Labeled same-camera Desert pairs; source pixels are never retouched/reframed.
python3 scripts/compose-desert-enrichment-comparison.py BASELINE CANDIDATE OUTPUT [--views names] [--final-set]
Full pairs preserve each original viewport. A separate thumbnail sheet is scaled.
"""
import argparse,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
p=argparse.ArgumentParser();p.add_argument('baseline',type=Path);p.add_argument('candidate',type=Path);p.add_argument('output',type=Path);p.add_argument('--views');p.add_argument('--final-set',action='store_true');args=p.parse_args();args.output.mkdir(parents=True,exist_ok=True)
root=Path(__file__).resolve().parents[1];manifest=json.loads((root/'docs/desert-enrichment-cameras.json').read_text());all_views={v['name']:v for v in manifest['views']};all_views.update({name:{'name':name,**v} for name,v in manifest['catalogViews'].items()})
names=json.loads((root/'docs/desert-enrichment-final-views.json').read_text())['views'] if args.final_set else args.views.split(',') if args.views else [v['name'] for v in manifest['views'] if v['renderByDefault']]
assert len(set(names))==len(names) and all(n in all_views for n in names)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18);thumbnails=[]
for name in names:
 v=all_views[name];ia=Image.open(args.baseline/(name+'.png')).convert('RGB');ib=Image.open(args.candidate/(name+'.png')).convert('RGB');assert ia.size==ib.size==tuple(v['resolution']);w,h=ia.size
 pair=Image.new('RGB',(w*2,h+58),(23,24,25));draw=ImageDraw.Draw(pair);camera='56 deg vertical FOV' if 'verticalFovDegrees' in v else 'Frozen original catalog camera'
 draw.text((16,8),name+' | '+camera+' | '+str(w)+' x '+str(h)+' | offline CPU source geometry | identical camera/light/material/render settings | no kart/driver/HUD or GPU capture',font=font,fill='white')
 for i,(label,im) in enumerate([('Original Desert / local unpublished baseline',ia),('Enriched Desert / local unpublished candidate',ib)]):pair.paste(im,(i*w,58));draw.text((i*w+16,32),label,font=font,fill='white')
 pair.save(args.output/(name+'-pair.png'));thumbnails.append(pair.resize((1280,round((h+58)*1280/(w*2))),Image.Resampling.LANCZOS))
thumb=Image.new('RGB',(1280,sum(im.height+10 for im in thumbnails)),(23,24,25));y=0
for im in thumbnails:thumb.paste(im,(0,y));y+=im.height+10
filename='eighteen-view-contact-sheet.png' if args.final_set else 'additional-view-contact-sheet.png' if args.views else 'eight-view-contact-sheet.png';thumb.save(args.output/filename)
if args.final_set:
 groups=[('sandstone-crown-descent-sheet','Sandstone crown and descent',['eye-crown','chase-crown','eye-descent','chase-descent']),('caravan-middle-exit-sheet','Caravan court: middle and exit',['chase-court-middle','eye-court-exit','chase-court-exit']),('overview-topdown-arch-sheet','Original catalog framing: overview, topdown and arch',['desert-overview','desert-topdown','desert-arch-passage'])]
 bannerfont=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
 for filename,title,views in groups:
  rows=[]
  for name in views:
   pair=Image.open(args.output/(name+'-pair.png')).convert('RGB');rows.append(pair.resize((1600,round(pair.height*1600/pair.width)),Image.Resampling.LANCZOS))
  sheet=Image.new('RGB',(1600,94+sum(im.height+10 for im in rows)),(23,24,25));draw=ImageDraw.Draw(sheet)
  for y,label in [(8,title+' | local unpublished baseline (left) / candidate (right)'),(34,'Offline CPU source geometry | identical camera, light, material and render settings | no GPU capture, kart, driver or HUD'),(60,'Scaled contact sheet; full-resolution source pairs are retained separately. No camera retargeting or image retouching.')]:draw.text((16,y),label,font=bannerfont,fill='white')
  y=94
  for im in rows:sheet.paste(im,(0,y));y+=im.height+10
  destination=args.output/(filename+'.png');sheet.save(destination);assert destination.stat().st_size<10*1024*1024
