"""Reproduce the Harvest enrichment previews from the exact exported source geometry.

First: node --import tsx scripts/export-harvest-preview.ts OUTPUT_DIR
Then: blender -b -t 2 --python scripts/render-harvest-enrichment-preview.py -- OUTPUT_DIR
Optional: --manifest FILE --views name,name --resume --update-catalog

The default renders thirteen driving views and five original catalog poses.
The camera catalog retains fifteen shared-chase, fifteen forward road-eye,
four labeled landmark-directed and five original catalog cameras. None is
refitted to candidate geometry. CPU only, two threads.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Quaternion, Vector
from bpy_extras.object_utils import world_to_camera_view
from PIL import Image

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', type=Path, help='Directory containing harvest-geometry.json and harvest-original-scene.glb')
parser.add_argument('--manifest', type=Path, default=root/'docs/harvest-enrichment-cameras.json')
parser.add_argument('--baseline', action='store_true', help='Render hash-pinned archived baseline geometry using its preserved source snapshot')
parser.add_argument('--views', help='Comma-separated subset; by default render thirteen selected driving views and five original catalog views')
parser.add_argument('--resume', action='store_true', help='Reuse only hash-verified images from an identical source/configuration')
parser.add_argument('--update-catalog', action='store_true', help='After a complete render, update the repository poster and provenance')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
out = args.output.resolve()
frozen = json.loads(args.manifest.read_text())
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
manifest_hash = sha(args.manifest)
input_data = json.loads((out/'harvest-geometry.json').read_text())
def verify_source_inputs():
    expected={**input_data['sourceHashes'],**(frozen['baselineGeometryContract']['additionalProtectedSourceHashes'] if args.baseline else {})}
    for path,digest in expected.items():
        actual = root/(frozen['baselineGeometryContract']['scenerySnapshot'] if args.baseline and path=='src/harvest-scenery.ts' else path)
        assert sha(actual)==digest, 'Stale source input: '+path
if args.baseline:
    assert not args.update_catalog, 'The archived baseline cannot update candidate catalog assets'
    contract=frozen['baselineGeometryContract']
    assert sha(out/'harvest-geometry.json')==contract['geometryJsonSha256']
    assert sha(out/'harvest-original-scene.glb')==contract['glbSha256']
    assert input_data['sourceHashes']==contract['sourceHashes']
verify_source_inputs()

# Reuse the original exact runtime-mesh/material/daylight importer. Its dynamic
# camera-fit and repository-writing section is deliberately not executed.
original = root/'scripts/render-harvest-preview.py'
setup = original.read_text().split("edges={edge['id']:edge for edge in data['route']['edges']}")[0]
setup = setup.replace('root=Path(__file__).resolve().parents[1]', 'root=Path('+repr(str(root))+')')
source_guard="for path,digest in data['sourceHashes'].items(): assert sha(root/path)==digest, 'Stale harvest geometry: '+path"
assert setup.count(source_guard)==1
setup=setup.replace(source_guard,'verify_source_inputs()')
namespace = {'__file__':str(original), '__name__':'__harvest_enrichment_setup__','verify_source_inputs':verify_source_inputs}
original_argv = sys.argv
sys.argv = ['render-harvest-preview.py','--',str(out),'final']
exec(compile(setup, str(original), 'exec'), namespace)
sys.argv = original_argv
scene, data = namespace['scene'], namespace['data']
# The original Harvest importer already installs the exact float32 POINT-normal shader.
# Reuse it unchanged for both baseline and candidate, without duplicate nodes.

normal_shading={'storage':'Exact float32 Original runtime normal FLOAT_VECTOR POINT attribute, source (x,y,z) to Blender (x,-z,y)','mapping':'Original loop vertex indices interpolate the corresponding source normal attribute','shader':'Attribute Vector -> OBJECT to WORLD NORMAL -> normalize -> multiply (1 - 2 * Backfacing) -> Principled Normal','runtimeMatch':'Identity mesh object transforms and StandardMaterial.twoSidedLighting=true; exact normal data and transform convention, approximate offline light/material response','historicalNotice':'Native Blender custom-corner normal encoding is bypassed for shading without deleting or moving source geometry. Both archived baseline and current candidate use this same exact source-normal attribute path.'}

bpy.data.objects.remove(namespace['camera'], do_unlink=True)
scene.render.image_settings.color_mode = 'RGBA'
scene.render.pixel_aspect_x = scene.render.pixel_aspect_y = 1
scene.cycles.use_adaptive_sampling = False
scene.cycles.use_denoising = False
scene.cycles.device = 'CPU'
scene.render.threads_mode = 'FIXED'
scene.render.threads = 2
scene.cycles.seed = 17
actual_render = {
    'engine':scene.render.engine, 'device':scene.cycles.device, 'threads':scene.render.threads,
    'denoise':scene.cycles.use_denoising, 'seed':scene.cycles.seed,
    'viewTransform':scene.view_settings.view_transform, 'exposure':scene.view_settings.exposure,
    'filmTransparent':scene.render.film_transparent, 'imageFormat':scene.render.image_settings.file_format,
    'colorMode':scene.render.image_settings.color_mode,
    'pixelAspect':[scene.render.pixel_aspect_x,scene.render.pixel_aspect_y],
    'resolutionPercentage':scene.render.resolution_percentage, 'blenderVersion':bpy.app.version_string,
    'adaptiveSampling':scene.cycles.use_adaptive_sampling, 'look':scene.view_settings.look,
    'gamma':scene.view_settings.gamma, 'displayDevice':scene.display_settings.display_device,
    'maxBounces':scene.cycles.max_bounces, 'diffuseBounces':scene.cycles.diffuse_bounces,
    'glossyBounces':scene.cycles.glossy_bounces, 'transmissionBounces':scene.cycles.transmission_bounces,
    'transparentMaxBounces':scene.cycles.transparent_max_bounces, 'filterWidth':scene.cycles.filter_width,
    'lightSamplingThreshold':scene.cycles.light_sampling_threshold,
    'sampleClampDirect':scene.cycles.sample_clamp_direct, 'sampleClampIndirect':scene.cycles.sample_clamp_indirect,
    'filmExposure':scene.cycles.film_exposure, 'colorDepth':scene.render.image_settings.color_depth,
    'compression':scene.render.image_settings.compression,
}
def same(a, b):
    if isinstance(a,(float,int)) and isinstance(b,(float,int)): return abs(a-b)<1e-6
    if isinstance(a,list) and isinstance(b,list): return len(a)==len(b) and all(same(x,y) for x,y in zip(a,b))
    return a == b
for key, value in frozen['render'].items():
    assert same(actual_render[key], value), ('Frozen render setting differs', key, actual_render[key], value)
sun, world = namespace['sun'], scene.world.node_tree.nodes['Background']
actual_light = {
    'worldColorHex':data['theme']['sky'], 'worldStrength':world.inputs[1].default_value,
    'sunEulerRadians':list(sun.rotation_euler), 'sunEnergy':sun.data.energy,
    'sunAngleRadians':sun.data.angle, 'sunColorLinear':list(sun.data.color),
}
for key, value in frozen['lighting'].items():
    assert same(actual_light[key], value), ('Frozen lighting differs', key, actual_light[key], value)

collection = bpy.data.collections.new('Frozen Harvest review and catalog cameras')
scene.collection.children.link(collection)
cameras, records = {}, {}
for view in frozen['views']+frozen['catalogViews']:
    name = view['name']
    cam_data = bpy.data.cameras.new(name)
    camera = bpy.data.objects.new(name, cam_data)
    collection.objects.link(camera)
    camera.rotation_mode = 'QUATERNION'
    camera.location = view['cameraPositionBlender']
    camera.rotation_quaternion = Quaternion(view['cameraQuaternionBlender'])
    cam_data.type = view['projection']
    cam_data.sensor_fit = view['sensorFit']
    cam_data.sensor_width = view['sensorWidthMillimetres']
    cam_data.sensor_height = view['sensorHeightMillimetres']
    cam_data.lens = view['lensMillimetres']
    if 'verticalFovDegrees' in view:
        assert abs(2*math.atan(cam_data.sensor_height/(2*cam_data.lens))*180/math.pi-view['verticalFovDegrees'])<1e-5
    cam_data.clip_start = view['clipStart']
    cam_data.clip_end = view['clipEnd']
    if cam_data.type == 'ORTHO': cam_data.ortho_scale = view['orthographicScaleMetres']
    camera['provenance'] = 'Immutable before/after pose' if name not in {v['name'] for v in frozen['catalogViews']} else view['poseSource']
    bpy.context.view_layer.update()
    matrix = [list(row) for row in camera.matrix_world]
    if 'cameraMatrixWorldBlender' in view:
        assert max(abs(matrix[i][j]-view['cameraMatrixWorldBlender'][i][j]) for i in range(4) for j in range(4))<1e-6, name
    records[name] = {**view, 'cameraMatrixWorldBlender':matrix}
    if name=='harvest-overview':
        records[name]['description']='Fixed historical comparison overview. Both physical fork roads and original Harvest landmarks retain their source framing. No camera refitting.'
    cameras[name] = camera

expected_names = [v['name'] for v in frozen['views'] if v['renderByDefault']]+[v['name'] for v in frozen['catalogViews']]
names = args.views.split(',') if args.views else expected_names
assert names and len(set(names))==len(names) and all(n in records for n in names)
if args.update_catalog: assert set(names)==set(expected_names), '--update-catalog requires the complete paired + catalog set'
generator_paths = ['scripts/export-harvest-preview.ts','scripts/render-harvest-preview.py','scripts/render-harvest-enrichment-preview.py','scripts/freeze-harvest-enrichment-cameras.ts','docs/harvest-enrichment-cameras.json']
generator_hashes = {p:sha(root/p) for p in generator_paths}
report_path = out/'harvest-render-record.json'
report = {
    'kind':data['kind'], 'description':data['description'],
    'renderer':'Blender '+bpy.app.version_string+' Cycles CPU, 2 threads, frozen per-view samples. No gameplay/GPU or FPS claim.',
    'sourceHashes':data['sourceHashes'], 'generatorHashes':generator_hashes,
    'geometryTexturesRoutesThemeSha256':data['contentSha256'],
    'geometryJsonSha256':sha(out/'harvest-geometry.json'), 'frozenCameraManifestSha256':manifest_hash,
    'verifiedRenderSettings':actual_render, 'verifiedLighting':actual_light,'normalShading':normal_shading,'sourceIdentity':'archived-baseline' if args.baseline else 'current-candidate',
    'batches':len(data['geometry']['batches']),
    'vertices':sum(len(b['positions'])//3 for b in data['geometry']['batches']),
    'triangles':sum(len(b['indices'])//3 for b in data['geometry']['batches']),
    'routeLengthsMetres':{e['id']:e['length'] for e in data['route']['edges']},
    'lapLengthsMetres':{k:data['route'][k] for k in ['barnyardLapLength','contourLapLength']},
    'framingSource':'Fifteen immutable shared-chase cameras, fifteen forward road-eye cameras, four labeled landmark-directed road-eye cameras and all five original catalog poses; no geometry refit',
    'originalModels':{'glb':{'file':'harvest-original-scene.glb','sha256':sha(out/'harvest-original-scene.glb'),'note':'Exact original runtime geometry at float32 precision, original UVs/normals/material values and embedded original procedural textures; approximate glTF PBR response'}},
    'views':{},
}
if args.resume and report_path.exists():
    previous = json.loads(report_path.read_text())
    for key in ['sourceHashes','generatorHashes','geometryJsonSha256','frozenCameraManifestSha256']:
        assert previous[key]==report[key], ('Resume requires identical inputs',key)
    for name, view in previous['views'].items():
        assert sha(out/view['file'])==view['sha256'], ('Modified image',name)
    report['views'] = previous['views']
def stable():
    verify_source_inputs()
    for path, digest in generator_hashes.items():
        assert sha(root/path)==digest, 'Source changed during render: '+path
    assert sha(args.manifest)==manifest_hash
xyz = lambda p: Vector((p[0],-p[2],p[1]))
anchors = [xyz(p) for sample in data['geometry']['routeRoadSamples'] for p in (sample['left'],sample['right'])]
for name in names:
    if name in report['views']: print('VERIFIED_EXISTING_HARVEST_RENDER',name,flush=True); continue
    view, camera = records[name], cameras[name]
    scene.camera = camera
    scene.render.resolution_x,scene.render.resolution_y = view['resolution']
    scene.cycles.samples = view['samples']
    scene.render.filepath = str(out/(name+'.png'))
    bpy.context.view_layer.update()
    projected = [world_to_camera_view(scene,camera,p) for p in anchors]
    bounds = [min(p.x for p in projected),min(p.y for p in projected),max(p.x for p in projected),max(p.y for p in projected)]
    if name in ['harvest-overview','harvest-topdown']:
        assert min(bounds[:2])>=.059 and max(bounds[2:])<=.941, (name,bounds)
    print('BEGIN_FROZEN_HARVEST_RENDER',name,flush=True)
    bpy.ops.render.render(write_still=True)
    report['views'][name] = {**view,'file':name+'.png','sha256':sha(out/(name+'.png')),'routeScreenBounds':bounds}
    stable()
    report_path.write_text(json.dumps(report,indent=2)+'\n')
    print('COMPLETE_FROZEN_HARVEST_RENDER',name,flush=True)

# Every source image is internally packed. Keep the editable scene on the same
# reviewed overview camera, while retaining all fixed review poses by name.
scene.camera = cameras['harvest-overview']
scene.render.resolution_x,scene.render.resolution_y = records['harvest-overview']['resolution']
scene.cycles.samples = records['harvest-overview']['samples']
scene.render.filepath = '//harvest-overview.png'
bpy.ops.file.pack_all()
for image in bpy.data.images:
    if image.source!='VIEWER': assert image.packed_file is not None, image.name
bpy.ops.wm.save_as_mainfile(filepath=str(out/'harvest-original-scene.blend'))
report['originalModels']['blend'] = {'file':'harvest-original-scene.blend','sha256':sha(out/'harvest-original-scene.blend'),'note':'Editable exact float32 source meshes/UVs/normal POINT attributes, explicit source-normal shader, packed original textures, frozen daylight, fifteen shared-chase and fifteen forward road-eye cameras, four landmark-directed road-eye cameras and five original catalog cameras'}
if args.update_catalog:
    for name,size in [('harvest-overview',(1280,720))]:
        destination = root/'public/map-previews'/(name+'.webp')
        destination.parent.mkdir(parents=True,exist_ok=True)
        with Image.open(out/(name+'.png')) as im:
            im.resize(size,Image.Resampling.LANCZOS).convert('RGB').save(destination,'WEBP',quality=94,method=6)
        report['menuAsset' if name=='harvest-overview' else 'topdownAsset'] = {'file':str(destination.relative_to(root)),'sha256':sha(destination),'resolution':list(size),'sourceView':name}
    (root/'docs/harvest-preview-provenance.json').write_text(json.dumps(report,indent=2)+'\n')
stable()
report_path.write_text(json.dumps(report,indent=2)+'\n')
(out/'harvest-preview-provenance.json').write_text(json.dumps(report,indent=2)+'\n')
print('HARVEST_FROZEN_RENDER_COMPLETE',len(report['views']),flush=True)
