"""Make unretouched labeled paired frames from locked before/after source renders.
python scripts/compare-mountain-scenes.py BASELINE BASELINE_EXTENSION AFTER AFTER_EXTENSION OUTPUT
No geometry, camera, crop, exposure or source pixels are altered here.
"""
from pathlib import Path
import json,hashlib,sys,math
from PIL import Image,ImageDraw,ImageFont
before,extension,after,after_extension,out=map(Path,sys.argv[1:6]);out.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',17)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
rows=[]
for old,new in [(before,after),(extension,after_extension)]:
    a=json.loads((old/'mountain-comparison-provenance.json').read_text());b=json.loads((new/'mountain-comparison-provenance.json').read_text())
    assert a['cameraPackageSha256']==b['cameraPackageSha256'],'Camera package differs'
    assert a['frozenRenderSettingsSha256']==b['frozenRenderSettingsSha256'],'Frozen view/light package differs'
    assert a['offlineTranslation']==b['offlineTranslation'],'Offline light/exposure differs'
    assert a['normalShading']==b['normalShading'],'Original normal shader path differs'
    assert a['views'].keys()==b['views'].keys(),'View set differs'
    for name,av in a['views'].items():
        bv=b['views'][name]
        for key in ['cameraPositionBlender','cameraQuaternionBlenderWXYZ','resolution','projection','actualLensMillimetres','actualVerticalFovDegrees','sunQuaternionBlenderWXYZ','exposure']:
            assert av[key]==bv[key],(name,key,av[key],bv[key])
        left=old/av['file'];right=new/bv['file'];assert sha(left)==av['sha256'];assert sha(right)==bv['sha256']
        rows.append((name,left,right,av))
# Each individual pair keeps the complete native frames; only a caption is added.
for name,left,right,pose in rows:
    a=Image.open(left).convert('RGB');b=Image.open(right).convert('RGB');assert a.size==b.size
    w,h=a.size;canvas=Image.new('RGB',(w*2,h+48),'#182329');draw=ImageDraw.Draw(canvas)
    canvas.paste(a,(0,48));canvas.paste(b,(w,48));draw.text((12,8),'BEFORE | '+name.replace('mountain-','').replace('-',' ').upper(),font=font,fill='white');draw.text((w+12,8),'AFTER | same camera + same light',font=font,fill='white')
    draw.text((12,30),'Exact-source offline CPU preview; not gameplay/GPU capture',font=small,fill='#bdcbd3');canvas.save(out/(name+'-paired.png'))
# The summary has the same row order and uncropped 16:9 slots for both sides.
tw,th,ch=480,270,38;sheet=Image.new('RGB',(tw*2,len(rows)*(th+ch)+60),'#182329');draw=ImageDraw.Draw(sheet)
draw.text((12,8),'MOUNTAIN001 | BEFORE',font=font,fill='white');draw.text((tw+12,8),'AFTER | locked camera + equal light',font=font,fill='white')
draw.text((12,34),'Exact original runtime geometry, UVs and float32 normals | Offline lighting/material response',font=small,fill='#bdcbd3')
for i,(name,left,right,pose) in enumerate(rows):
    y=60+i*(th+ch)
    for x,p in [(0,left),(tw,right)]:
        im=Image.open(p).convert('RGB');im.thumbnail((tw,th),Image.Resampling.LANCZOS);sheet.paste(im,(x+(tw-im.width)//2,y+(th-im.height)//2))
        draw.text((x+10,y+th+6),name.replace('mountain-','').replace('-',' ').upper(),font=font,fill='white')
sheet.save(out/'mountain-eleven-view-paired-contact-sheet.jpg',quality=93)
report={'equalFrozenCamerasAndLight':True,'views':len(rows),'unretouchedNativePairs':True,'beforeSourceHashes':json.loads((before/'mountain-comparison-provenance.json').read_text())['sourceHashes'],'afterSourceHashes':json.loads((after/'mountain-comparison-provenance.json').read_text())['sourceHashes'],'outputs':{p.name:sha(p) for p in sorted(out.iterdir()) if p.suffix in ['.png','.jpg']}}
(out/'paired-comparison-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'pairedViews':len(rows),'output':str(out),'equalFrozenCamerasAndLight':True}))
