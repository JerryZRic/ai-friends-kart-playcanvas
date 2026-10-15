"""Offline CPU review of exact dev geometry; inherits the original renderer.
Usage: blender -b -t 2 --python scripts/render-garden-dev-polish.py -- OUTPUT_DIR draft garden-overview,garden-nursery-study
"""
from pathlib import Path
source=(Path(__file__).parent/'render-garden-preview.py').read_text()
source=source.replace("'scripts/export-garden-preview.ts','scripts/render-garden-preview.py'", "'scripts/export-garden-preview.ts','scripts/render-garden-preview.py','scripts/render-garden-dev-polish.py'")
source=source.replace('garden-crown-bloom','garden-nursery-study')
source=source.replace("p=landmark('crown-bloom-terrace')['position']", "f=next(f for f in data['geometry']['foundations'] if f['kind']=='garden-polish-rose-planter-foot-0'); q=f['footprint']; ax=Vector(q[1])-Vector(q[0]); ax.normalize(); az=Vector(q[3])-Vector(q[0]); az.normalize(); p=sum((Vector(v) for v in q),Vector())/4+az*8.3; p.y=f['top']")
source=source.replace("[p[0]-40,p[1]+23,p[2]-48],[p[0],p[1]+8,p[2]],lens=40", "list(p-ax*23-az*34+Vector((0,17,0))),list(p+ax*6+Vector((0,4,0))),lens=32")
source=source.replace('Original Crown Bloom Terrace: thick dimensional coral and ivory petals in two joined whorls, shared receptacle and calyx, continuous supported stem and soil-seated buttressed base. Every terrain, road, rail and landmark mesh remains visible and unmodified; approximate offline CPU lighting/materials.', 'Exact dev nursery fascia, capitals, braces and paired rose planters. All runtime geometry included. Offline Blender CPU with approximate materials/light; not a game screenshot.')
exec(compile(source,str(Path(__file__).parent/'render-garden-preview.py'),'exec'))
