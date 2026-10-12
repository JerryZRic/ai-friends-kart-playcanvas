"""Frozen offline Snow geometry comparisons and the five original catalog views.
blender -b -t 2 --python scripts/render-snow-enrichment-preview.py -- OUTPUT [--baseline] [--views list] [--samples 48] [--catalog] [--resume] [--final-set]
No camera auto-fit. CPU two threads. Catalog updates use the separate post-verification local update script.
"""
import argparse,sys,json,hashlib,math,array
from pathlib import Path
import bpy
from mathutils import Quaternion,Vector
from bpy_extras.object_utils import world_to_camera_view
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('output',type=Path);p.add_argument('--baseline',action='store_true');p.add_argument('--views');p.add_argument('--samples',type=int,default=8);p.add_argument('--catalog',action='store_true');p.add_argument('--resume',action='store_true');p.add_argument('--final-set',action='store_true');args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
root=Path(__file__).resolve().parents[1];out=args.output.resolve();sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
frozen=json.loads((root/'docs/snow-enrichment-cameras.json').read_text());data=json.loads((out/'snow-geometry.json').read_text())
source_root=out/'source' if args.baseline else root
source_hashes=data['sourceHashes'];generator_paths=['scripts/export-snow-preview.ts','scripts/render-snow-preview.py','scripts/freeze-snow-enrichment-cameras.ts','scripts/render-snow-enrichment-preview.py','docs/snow-enrichment-cameras.json','docs/snow-enrichment-final-views.json'];generator_hashes={p:sha(root/p) for p in generator_paths}
def stable():
 for path,digest in source_hashes.items():assert sha(source_root/path)==digest,'Changed source '+path
 for path,digest in generator_hashes.items():assert sha(root/path)==digest,'Changed generator '+path
stable()
if args.baseline:
 assert sha(out/'snow-geometry.json')==frozen['baseline']['geometrySha256']
 assert sha(out/'snow-original-scene.glb')==frozen['baseline']['glbSha256']
original=root/'scripts/render-snow-preview.py';setup=original.read_text().split("edges={edge['id']:edge for edge in data['route']['edges']}")[0]
setup=setup.replace("for path,digest in data['sourceHashes'].items(): assert sha(root/path)==digest, 'Stale snow geometry: '+path",'pass # Every source input is verified against the frozen snapshot or current candidate by stable()')
namespace={'__file__':str(original),'__name__':'__snow_enrichment_setup__'};argv=sys.argv;sys.argv=['render-snow-preview.py','--',str(out),'draft'];exec(compile(setup,str(original),'exec'),namespace);sys.argv=argv
scene=namespace['scene'];bpy.data.objects.remove(namespace['camera'],do_unlink=True);scene.cycles.samples=args.samples;scene.cycles.use_adaptive_sampling=False
scene.render.image_settings.color_mode='RGBA';scene.render.pixel_aspect_x=scene.render.pixel_aspect_y=1
normal_report=[]
for b in data['geometry']['batches']:
 ob=bpy.data.objects[b['name']];a=ob.data.attributes['Original runtime normal'];actual=array.array('f',[0])*len(b['normals']);a.data.foreach_get('vector',actual)
 expected=array.array('f',[v for i in range(0,len(b['normals']),3) for v in (b['normals'][i],-b['normals'][i+2],b['normals'][i+1])]);assert actual==expected,b['name']
 expectedpos=array.array('f',[v for i in range(0,len(b['positions']),3) for v in (b['positions'][i],-b['positions'][i+2],b['positions'][i+1])]);actualpos=array.array('f',[0])*len(expectedpos);ob.data.vertices.foreach_get('co',actualpos);assert actualpos==expectedpos
 assert ob.data.materials[0].node_tree.nodes['Original runtime normal attribute'].attribute_name=='Original runtime normal'
 normal_report.append({'batch':b['name'],'normalFloat32Sha256':hashlib.sha256(actual.tobytes()).hexdigest(),'positionFloat32Sha256':hashlib.sha256(actualpos.tobytes()).hexdigest()})
catalog=[{'name':name,'sensorFit':'HORIZONTAL','sensorWidthMillimetres':36,'sensorHeightMillimetres':24,'lensMillimetres':v.get('lensMillimetres',50),'clipStart':.1,'clipEnd':10000,**v} for name,v in frozen['catalogViews'].items()]
collection=bpy.data.collections.new('Frozen Snow review and catalog cameras');scene.collection.children.link(collection);cameras={};records={}
for v in frozen['views']+catalog:
 camera=bpy.data.objects.new(v['name'],bpy.data.cameras.new(v['name']));collection.objects.link(camera);camera.rotation_mode='QUATERNION';camera.location=v['cameraPositionBlender'];camera.rotation_quaternion=Quaternion(v['cameraQuaternionBlender']);camera.data.type=v['projection'];camera.data.sensor_fit=v['sensorFit'];camera.data.sensor_width=v['sensorWidthMillimetres'];camera.data.sensor_height=v['sensorHeightMillimetres'];camera.data.lens=v['lensMillimetres'];camera.data.clip_start=v['clipStart'];camera.data.clip_end=v['clipEnd']
 if 'orthographicScaleMetres' in v:camera.data.ortho_scale=v['orthographicScaleMetres']
 if 'verticalFovDegrees' in v:assert abs(2*math.atan(camera.data.sensor_height/(2*camera.data.lens))*180/math.pi-v['verticalFovDegrees'])<1e-5
 bpy.context.view_layer.update();records[v['name']]={**v,'cameraMatrixWorldBlender':[list(row) for row in camera.matrix_world]};cameras[v['name']]=camera
selection=json.loads((root/'docs/snow-enrichment-final-views.json').read_text())
assert selection['frozenCameraManifestSha256']==sha(root/'docs/snow-enrichment-cameras.json')
if args.final_set:assert not args.views and args.samples==selection['samples']
names=selection['views'] if args.final_set else args.views.split(',') if args.views else [v['name'] for v in frozen['views'] if v['renderByDefault']]+([v['name'] for v in catalog] if args.catalog else [])
assert len(set(names))==len(names) and all(n in records for n in names)
normal_shading={'storage':'Exact float32 source normal FLOAT_VECTOR POINT attribute, source (x,y,z) to Blender (x,-z,y)','mapping':'Unchanged vertex-index interpolation','shader':'Attribute Vector -> object-to-world NORMAL -> normalize -> multiply (1 - 2 * Backfacing) -> Principled BSDF Normal','notice':'Exact source normal data and two-sided transform convention; approximate offline material/light response'}
sun=namespace['sun'];world=scene.world.node_tree.nodes['Background'];render_settings={'samples':args.samples,'cpuThreads':2,'seed':17,'denoising':False,'adaptiveSampling':False,'viewTransform':scene.view_settings.view_transform,'exposure':scene.view_settings.exposure};lighting={'worldColorHex':data['theme']['sky'],'worldStrength':world.inputs[1].default_value,'sunEulerRadians':list(sun.rotation_euler),'sunEnergy':sun.data.energy,'sunAngleRadians':sun.data.angle,'sunColorLinear':list(sun.data.color)}
report={'kind':data['kind'],'description':data['description'],'renderer':'Blender '+bpy.app.version_string+' Cycles CPU, 2 threads, '+str(args.samples)+' samples. Fixed original source-derived cameras. No gameplay/GPU or FPS claim.','sourceIdentity':'archived-local-unpublished-baseline' if args.baseline else 'local-unpublished-candidate','sourceHashes':source_hashes,'generatorHashes':generator_hashes,'geometryJsonSha256':sha(out/'snow-geometry.json'),'geometryTexturesRoutesThemeSha256':data['contentSha256'],'frozenCameraManifestSha256':sha(root/'docs/snow-enrichment-cameras.json'),'normalShading':normal_shading,'normalVerification':normal_report,'verifiedRenderSettings':render_settings,'verifiedLighting':lighting,'batches':len(data['geometry']['batches']),'vertices':sum(len(b['positions'])//3 for b in data['geometry']['batches']),'triangles':sum(len(b['indices'])//3 for b in data['geometry']['batches']),'routeLengthsMetres':{e['id']:e['length'] for e in data['route']['edges']},'lapLengthsMetres':{k:data['route'][k] for k in ['serviceCutLapLength','terraceSweepLapLength']},'framingSource':'Twenty-four immutable forward/chase transforms plus five pre-enrichment catalog transforms; no geometry refit','originalModels':{'glb':{'file':'snow-original-scene.glb','sha256':sha(out/'snow-original-scene.glb'),'note':'Original static source geometry at float32 GPU precision, source UVs/normals/material values and embedded procedural textures; approximate glTF PBR response'}},'views':{}}
report_path=out/'snow-render-record.json'
if args.resume and report_path.exists():
 previous=json.loads(report_path.read_text())
 for k in ['sourceHashes','generatorHashes','geometryJsonSha256','frozenCameraManifestSha256','verifiedRenderSettings']:assert previous[k]==report[k],('Cannot resume changed inputs',k)
 for name,v in previous['views'].items():assert sha(out/v['file'])==v['sha256']
 report['views']=previous['views']
xyz=lambda p:Vector((p[0],-p[2],p[1]));anchors=[xyz(p) for sample in data['geometry']['routeRoadSamples'] for p in (sample['left'],sample['right'])];edges={e['id']:e for e in data['route']['edges']}
for name in names:
 if name in report['views']:continue
 v=records[name];camera=cameras[name];scene.camera=camera;scene.render.resolution_x,scene.render.resolution_y=v['resolution'];scene.render.filepath=str(out/(name+'.png'));bpy.context.view_layer.update()
 projected=[world_to_camera_view(scene,camera,p) for p in anchors];bounds=[min(p.x for p in projected),min(p.y for p in projected),max(p.x for p in projected),max(p.y for p in projected)]
 branch_bounds={}
 for edge in ['alley','boulevard']:
  pts=[world_to_camera_view(scene,camera,xyz(p)) for s in edges[edge]['samples'] for p in (s['left'],s['right'])];branch_bounds[edge]=[min(p.x for p in pts),min(p.y for p in pts),max(p.x for p in pts),max(p.y for p in pts)]
 if name in ['snow-overview','snow-topdown']:
  assert min(bounds[:2])>=.059 and max(bounds[2:])<=.941
  for b in branch_bounds.values():assert min(b[:2])>=.059 and max(b[2:])<=.941
 bpy.ops.render.render(write_still=True);stable();record={**v,'file':name+'.png','sha256':sha(scene.render.filepath),'samples':args.samples,'routeScreenBounds':bounds,'physicalBranchScreenBounds':branch_bounds};record.pop('fittedSubjectScreenBounds',None);report['views'][name]=record;report_path.write_text(json.dumps(report,indent=2)+'\n')
scene.camera=cameras['snow-overview'];scene.render.resolution_x,scene.render.resolution_y=records['snow-overview']['resolution'];scene.render.filepath='//snow-overview.png';bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out/'snow-original-scene.blend'))
report['originalModels']['blend']={'file':'snow-original-scene.blend','sha256':sha(out/'snow-original-scene.blend'),'note':'Editable exact source float32 positions, UVs and normal POINT attributes, explicit two-sided source-normal shader, packed procedural textures, frozen daylight and all29 original source-derived cameras'}
if set(frozen['catalogViews'])<=set(report['views']):
 catalog_report={**report,'views':{name:report['views'][name] for name in frozen['catalogViews']}}
 (out/'snow-preview-provenance.json').write_text(json.dumps(catalog_report,indent=2)+'\n')
stable();report_path.write_text(json.dumps(report,indent=2)+'\n');print('SNOW_ENRICHMENT_RENDER_COMPLETE',len(report['views']),flush=True)
