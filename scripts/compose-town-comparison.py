"""Compose four labeled comparison sheets from verified Town source renders.
python3 scripts/compose-town-comparison.py CORRECTED_BASELINE CORRECTED_CANDIDATE [OUTPUT]
Original PNG files are never edited. All pairs must use identical shaders,
render settings, lighting, projection and frozen camera transforms.
"""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageOps
p=argparse.ArgumentParser(description=__doc__);p.add_argument('baseline',type=Path);p.add_argument('candidate',type=Path);p.add_argument('output',type=Path,nargs='?');args=p.parse_args()
base=args.baseline;candidate=args.candidate;out=args.output or candidate;out.mkdir(parents=True,exist_ok=True)
sha=lambda path:hashlib.sha256(Path(path).read_bytes()).hexdigest()
a=json.loads((base/'town-render-record.json').read_text());b=json.loads((candidate/'town-render-record.json').read_text())
for key in ['generatorHashes','frozenCameraManifestSha256','verifiedRenderSettings','verifiedLighting','normalShading']:assert a[key]==b[key],key
assert a['sourceIdentity']=='archived-baseline' and b['sourceIdentity']=='current-candidate'
groups={
 'market-and-fork':['town-market-frontage-low-forward','town-market-underpass-approach-low-forward','town-fork-advance-decision-low-forward','town-fork-approach-low-forward'],
 'landmarks-and-alley':['town-tram-arcade-approach-low-forward','town-civic-far-approach-low-forward','town-alley-bend-low-forward','town-alley-bend-high-forward'],
 'merge-and-bridge':['town-tram-arcade-approach-high-forward','town-boulevard-merge-approach-low-forward','town-alley-merge-approach-low-forward','town-upper-bridge-approach-low-forward'],
 'overview-and-legacy':['town-overview','town-market-street','town-clocktower-street','town-civic-approach-low-forward']}
results={}
for group,names in groups.items():
 sheet=Image.new('RGB',(1280,1810),'#eee9df');d=ImageDraw.Draw(sheet)
 d.text((16,12),'BEFORE | Original Town geometry | Offline source render',fill='#27241d')
 d.text((656,12),'AFTER | Enriched Town geometry | Offline source render',fill='#27241d')
 d.text((16,34),'Identical corrected source-normal shader, cameras, lighting and exposure. No gameplay / GPU / FPS claim.',fill='#51493c')
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
report={'baselineSourceSha256':a['sourceHashes']['src/town-scenery.ts'],'candidateSourceSha256':b['sourceHashes']['src/town-scenery.ts'],'baselineRenderRecordSha256':sha(base/'town-render-record.json'),'candidateRenderRecordSha256':sha(candidate/'town-render-record.json'),'composerSha256':sha(__file__),'notice':'Labeled contact sheets of actual matched source renders; individual files unchanged; no synthetic scene imagery','sheets':results}
(out/'comparison-record.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'sheets':len(results),'maximumBytes':max(r['bytes'] for r in results.values())}))
