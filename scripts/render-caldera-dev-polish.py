"""Offline CPU review of exact dev geometry; inherits the source preview renderer.
Usage: blender -b -t 2 --python scripts/render-caldera-dev-polish.py -- OUTPUT_DIR draft caldera-overview,caldera-vent-study
"""
from pathlib import Path
source=(Path(__file__).parent/'render-caldera-preview.py').read_text()
source=source.replace("'scripts/export-caldera-preview.ts','scripts/render-caldera-preview.py'", "'scripts/export-caldera-preview.ts','scripts/render-caldera-preview.py','scripts/render-caldera-dev-polish.py'")
source=source.replace('caldera-wind-tooth','caldera-vent-study')
source=source.replace("p=landmark('wind-carved-tooth')['position']", "p=[-209,next(a for a in data['geometry']['enrichmentAssemblies'] if a['id']=='enrichment-archive-open-portico')['pieces'][0]['max'][1],-624]")
source=source.replace("[p[0]-32,p[1]+8,p[2]-62],[p[0],p[1]+13,p[2]],lens=28", "[p[0]-27,p[1]+16,p[2]+30],[p[0],p[1]+3.8,p[2]+2],lens=32")
source=source.replace('Original asymmetric Wind-carved Tooth: a genuine daylight erosion window through thick basalt, broad bearing feet, an attached companion shoulder and connected talus. Every terrain, road, rail and landmark mesh remains visible and unmodified; approximate offline CPU lighting/materials.', 'Exact dev portico, tiered vent instruments and cornice geometry. All source geometry included. Offline Blender CPU with approximate materials and light; not a game screenshot.')
exec(compile(source,str(Path(__file__).parent/'render-caldera-preview.py'),'exec'))
