"""Two exact-geometry offline CPU detail cameras; inherits the original renderer.
Usage: blender -b -t 2 --python scripts/render-airfield-dev-polish.py -- OUTPUT_DIR draft airfield-service-study,airfield-tower-study
"""
from pathlib import Path
source=(Path(__file__).parent/'render-airfield-preview.py').read_text()
source=source.replace("'scripts/export-airfield-preview.ts','scripts/render-airfield-preview.py'", "'scripts/export-airfield-preview.ts','scripts/render-airfield-preview.py','scripts/render-airfield-dev-polish.py'")
source=source.replace("'airfield-rotor-detail'}", "'airfield-rotor-detail','airfield-service-study','airfield-tower-study'}")
start=source.index("if wanted('airfield-rotor-detail'):")
end=source.index('\nif not draft:',start)
source=source[:start]+'''if wanted('airfield-service-study'):
    f=next(f for f in data['geometry']['foundations'] if f['kind']=='airfield-polish-ground-service-pad'); q=f['footprint']; ax=Vector(q[1])-Vector(q[0]); ax.normalize(); az=Vector(q[3])-Vector(q[0]); az.normalize(); p=sum((Vector(v) for v in q),Vector())/4; p.y=f['top']
    perspective('airfield-service-study',list(p-ax*10+az*37+Vector((0,18,0))),list(p+ax*4-az*8+Vector((0,3,0))),lens=34,description='Exact dev terminal framing, rear blue glazing, modeled baggage carts and tow tractor on terrain-seated service pad. Offline Blender CPU, approximate materials/light; not a game screenshot.')
if wanted('airfield-tower-study'):
    p=landmark('splitfin-tower')['position']
    perspective('airfield-tower-study',[p[0]-34,p[1]+23,p[2]-43],[p[0],p[1]+14,p[2]],lens=34,description='Exact dev white splitfin tower and compact deep-blue control pavilion/crown on the original upper deck. All runtime geometry included. Offline Blender CPU, approximate materials/light; not a game screenshot.')
''' +source[end:]
exec(compile(source,str(Path(__file__).parent/'render-airfield-preview.py'),'exec'))
