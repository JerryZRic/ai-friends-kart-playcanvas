"""Actual-source well detail, approximate Blender CPU lighting (not gameplay).
First export with scripts/export-desert-preview.ts, then:
blender -b -t 2 --python scripts/render-desert-visual-polish.py -- OUTPUT_DIR
This helper never modifies published/frozen preview assets or audit manifests.
"""
import sys, json, hashlib
from pathlib import Path
import bpy
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
out=Path(sys.argv[sys.argv.index('--')+1]).resolve()
original=root/'scripts/render-desert-preview.py'
setup=original.read_text().split("edges={edge['id']:edge for edge in data['route']['edges']}")[0]
namespace={'__file__':str(original),'__name__':'__desert_polish_setup__'}
argv=sys.argv
sys.argv=['render-desert-preview.py','--',str(out),'draft']
exec(compile(setup,str(original),'exec'),namespace)
sys.argv=argv
scene,data,camera=namespace['scene'],namespace['data'],namespace['camera']
base=next(a for a in data['geometry']['enrichmentAssemblies'] if a['id']=='desert-enrichment-crescent-high-bay')
top=next(p for p in base['pieces'] if p['kind']=='desert-enrichment-court-conforming-platform')['max'][1]
xyz=lambda p:Vector((p[0],-p[2],p[1]))
eye=[-237+10,top+5.7,79-16]
target=[-237,top+2.35,79]
camera.name='Desert shaded well source detail';camera.data.type='PERSP';camera.data.lens=35
camera.location=xyz(eye);camera.rotation_euler=(xyz(target)-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=1000;scene.render.resolution_y=650
scene.cycles.samples=24;scene.cycles.device='CPU';scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.filepath=str(out/'desert-well-detail-draft.png')
bpy.ops.render.render(write_still=True)
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
record={'kind':'offline-native-geometry-render','notice':'All actual emitted source meshes are included. Approximate Blender CPU lighting/material response, not browser or gameplay, no FPS claim. Camera is a detail illustration, not a frozen before/after comparison.','sourceHashes':data['sourceHashes'],'geometryTexturesRoutesThemeSha256':data['contentSha256'],'generatorSha256':sha(__file__),'sourceEye':eye,'sourceTarget':target,'lensMillimetres':35,'resolution':[1000,650],'samples':24,'cpuThreads':2,'file':'desert-well-detail-draft.png','imageSha256':sha(out/'desert-well-detail-draft.png')}
(out/'desert-well-detail-provenance.json').write_text(json.dumps(record,indent=2)+'\n')
print('DESERT_WELL_RENDER_COMPLETE',flush=True)
