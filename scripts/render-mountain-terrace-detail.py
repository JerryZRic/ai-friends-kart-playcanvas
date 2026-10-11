"""Additive terrace detail from an exact emitted apron support, not a chase view.
blender -b MODEL.blend -t 2 --python scripts/render-mountain-terrace-detail.py -- GEOMETRY.json OUTPUT_DIR
All source meshes and the saved final light/material setup remain unchanged.
"""
import bpy,json,math,sys,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
args=sys.argv[sys.argv.index('--')+1:];source=Path(args[0]).resolve();out=Path(args[1]).resolve();out.mkdir(parents=True,exist_ok=True);data=json.loads(source.read_text())
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def xyz(p):return Vector((p[0],-p[2],p[1]))
geometry=data['geometry'];origin=geometry['lookout']['position'];yaw=geometry['lookout']['yaw'];c=math.cos(yaw);s=math.sin(yaw)
def local(x,y,z):return [origin[0]+x*c+z*s,origin[1]+y,origin[2]-x*s+z*c]
index,bedding=next((i,v) for i,v in enumerate(geometry['components']) if v['kind']=='lookout-pale-masonry-bedding')
foot=local(11,.32,4.2);assert abs(foot[1]-bedding['max'][1])<1e-8
position=foot.copy();position[1]+=1.6;target=local(-.1,1.35,7.25)
scene=bpy.context.scene;camera=scene.camera;camera.name='Additive physical apron selected-prop detail';camera.data.type='PERSP';camera.data.sensor_fit='HORIZONTAL';camera.data.sensor_width=36;camera.data.lens=28;camera.data.clip_start=.12;camera.data.clip_end=2200;camera.location=xyz(position);camera.rotation_mode='QUATERNION';camera.rotation_quaternion=(xyz(target)-camera.location).to_track_quat('-Z','Y')
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=48;scene.cycles.use_denoising=False;scene.cycles.seed=17;scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
collection=bpy.data.collections['Original runtime static mesh batches'];assert len(collection.objects)==len(geometry['batches']);assert all(not obj.hide_render and not obj.hide_viewport and not obj.modifiers for obj in collection.objects)
bpy.context.view_layer.update();batches={v['name']:v for v in geometry['batches']};points=[]
for prop in geometry['reusedProps']:
 for i in prop['components']:
  component=geometry['components'][i];p=batches[component['batch']]['positions'];points.extend(xyz(p[k*3:k*3+3]) for k in range(component['vertexStart'],component['vertexEnd']))
projected=[world_to_camera_view(scene,camera,p) for p in points];bounds=[min(p.x for p in projected),min(p.y for p in projected),max(p.x for p in projected),max(p.y for p in projected)]
assert min(p.z for p in projected)>0 and min(bounds[:2])>=.025 and max(bounds[2:])<=.975,('Whole selected props must be framed',bounds)
dest=out/'mountain-terrace-props-front.png';scene.render.filepath=str(dest);bpy.ops.render.render(write_still=True)
manifest={'kind':'additive-offline-source-architecture-view','file':dest.name,'sha256':sha(dest),'sourceGeometrySha256':sha(source),'sourceHashes':data['sourceHashes'],'sourceBlendSha256':sha(bpy.data.filepath),'resolution':[1600,1000],'samples':48,'description':'Additive map-station/porch detail. Physical eye is 1.6 m above the exact emitted apron bedding top. The relief map front is clearly visible; the picnic table is partly occluded by the retained porch column, so this is not a clear showcase of both props. Source bounds prove frustum containment, not absence of occlusion. This is not a gameplay chase view or a before/after replacement. All source batches stay enabled; saved source-normal shader and equal final light remain unchanged.','physicalFootPointSource':foot,'supportComponentIndex':index,'supportKind':bedding['kind'],'heightAbovePhysicalApronMetres':1.6,'positionSource':position,'targetSource':target,'cameraPositionBlender':list(camera.location),'cameraQuaternionBlenderWXYZ':list(camera.rotation_quaternion),'lensMillimetres':28,'sensorWidthMillimetres':36,'aspect':1.6,'selectedPropsScreenBounds':bounds,'exposure':scene.view_settings.exposure,'allSourceBatchesEnabled':True,'generatorSha256':sha(__file__)}
(out/'mountain-terrace-props-front-provenance.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({'file':dest.name,'selectedPropsScreenBounds':bounds,'physicalFootPointSource':foot}))
