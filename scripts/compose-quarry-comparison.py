"""Compose three labeled comparison sheets from verified Quarry source renders.
python3 scripts/compose-quarry-comparison.py CORRECTED_BASELINE CORRECTED_CANDIDATE [OUTPUT]
Original PNG files are never edited. All pairs must use identical shaders,
render settings, lighting, projection and frozen camera transforms.
"""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageOps
p=argparse.ArgumentParser(description=__doc__);p.add_argument('baseline',type=Path);p.add_argument('candidate',type=Path);p.add_argument('output',type=Path,nargs='?');p.add_argument('--views',help='Comma-separated same-camera subset for a compact review sheet');args=p.parse_args()
base=args.baseline;candidate=args.candidate;out=args.output or candidate;out.mkdir(parents=True,exist_ok=True)
sha=lambda path:hashlib.sha256(Path(path).read_bytes()).hexdigest()
a=json.loads((base/'quarry-render-record.json').read_text());b=json.loads((candidate/'quarry-render-record.json').read_text())
for key in ['generatorHashes','frozenCameraManifestSha256','verifiedRenderSettings','verifiedLighting','normalShading']:assert a[key]==b[key],key
assert a['sourceIdentity']=='archived-baseline' and b['sourceIdentity']=='current-candidate'
groups={
 'working-road':['quarry-forward-lower-crossing','quarry-forward-hopper-approach','quarry-forward-cut-face-approach'],
 'fork-and-machinery':['quarry-forward-fork-approach','quarry-forward-derrick-approach','quarry-forward-conveyor-approach'],
 'overview-and-structure':['quarry-overview','quarry-topdown','quarry-derrick-street','quarry-timber-overpass','quarry-conveyor-detail'],
}
if args.views:groups={'selected-review':args.views.split(',')}
results={}
for group,names in groups.items():
 sheet=Image.new('RGB',(1280,70+435*len(names)),'#eee9df');d=ImageDraw.Draw(sheet)
 d.text((16,12),'BEFORE | Original Quarry geometry | Offline source render',fill='#27241d')
 d.text((656,12),'AFTER | Enriched Quarry geometry | Offline source render',fill='#27241d')
 d.text((16,34),'Same source-normal shader, cameras, light and exposure. Offline geometry only; no driver / vehicle / HUD / gameplay / GPU / FPS claim.',fill='#51493c')
 for row,name in enumerate(names):
  av,bv=a['views'][name],b['views'][name]
  for key in ['cameraMatrixWorldBlender','projection','sensorFit','lensMillimetres','resolution','samples']:assert av[key]==bv[key],(name,key)
  y=65+row*435;d.text((16,y+6),name,fill='#27241d')
  for col,(directory,view) in enumerate([(base,av),(candidate,bv)]):
   source=directory/view['file'];assert sha(source)==view['sha256'],source.name
   with Image.open(source) as im:
    tile=ImageOps.contain(im.convert('RGB'),(640,400),Image.Resampling.LANCZOS);sheet.paste(tile,(col*640+(640-tile.width)//2,y+30+(400-tile.height)//2))
 path=out/('comparison-'+group+'.png');sheet.save(path);assert path.stat().st_size<10*1024*1024
 results[group]={'file':path.name,'sha256':sha(path),'bytes':path.stat().st_size,'views':names}
report={'baselineSourceSha256':a['sourceHashes']['src/quarry-scenery.ts'],'candidateSourceSha256':b['sourceHashes']['src/quarry-scenery.ts'],'baselineRenderRecordSha256':sha(base/'quarry-render-record.json'),'candidateRenderRecordSha256':sha(candidate/'quarry-render-record.json'),'composerSha256':sha(__file__),'notice':'Labeled contact sheets of actual matched source renders; individual files unchanged; no synthetic scene imagery','sheets':results}
(out/'comparison-record.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'sheets':len(results),'maximumBytes':max(r['bytes'] for r in results.values())}))
