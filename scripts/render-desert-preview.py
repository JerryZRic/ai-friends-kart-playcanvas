"""Render exact runtime desert mesh batches, normals, UVs and procedural textures.
blender -b -t 2 --python scripts/render-desert-preview.py -- OUTPUT_DIR [draft|final] [view,...]
CPU only: final renders use two threads and 48 samples. No gameplay/FPS claim.
"""
import bpy, json, math, sys, hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
from PIL import Image

def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def xyz(p): return Vector((p[0], -p[2], p[1]))
def linear(v): return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
def rgb(hex): return tuple(linear(int(hex.lstrip('#')[i:i+2], 16) / 255) for i in (0, 2, 4))

args=sys.argv[sys.argv.index('--')+1:]
out=Path(args[0]).resolve(); mode=args[1] if len(args)>1 else 'final'; draft=mode=='draft'
selected=set(args[2].split(',')) if len(args)>2 else None
view_names={'desert-overview','desert-topdown','desert-driver-reveal','desert-arch-passage','desert-caravan-detail'}
assert mode in {'draft','final'}, 'Expected draft or final render mode'
assert selected is None or selected <= view_names, 'Unknown requested view'
root=Path(__file__).resolve().parents[1]
data=json.loads((out/'desert-geometry.json').read_text())
for path,digest in data['sourceHashes'].items(): assert sha(root/path)==digest, 'Stale desert geometry: '+path
bpy.ops.wm.read_factory_settings(use_empty=True)
geometry_collection=bpy.data.collections.new('Original runtime static mesh batches'); bpy.context.scene.collection.children.link(geometry_collection)
images={}
for name,record in data['textures'].items():
    image=bpy.data.images.new('Original runtime '+name,width=record['width'],height=record['height'])
    image.colorspace_settings.name='Non-Color'; image.pixels=[v/255 for v in record['pixels']]
    image.pack(); images[name]=image
for record in data['geometry']['batches']:
    positions=record['positions']; indices=record['indices']; uvs=record['uvs']; normals=record['normals']
    mesh=bpy.data.meshes.new(record['name'])
    mesh.from_pydata([xyz(positions[i:i+3]) for i in range(0,len(positions),3)],[],[indices[i:i+3] for i in range(0,len(indices),3)])
    mesh.update(); layer=mesh.uv_layers.new(name='Original runtime UV')
    for loop in mesh.loops: layer.data[loop.index].uv=uvs[loop.vertex_index*2:loop.vertex_index*2+2]
    for polygon in mesh.polygons: polygon.use_smooth=True
    source_normals=[xyz(normals[i:i+3]) for i in range(0,len(normals),3)]
    mesh.normals_split_custom_set_from_vertices(source_normals)
    # Blender's compact custom-corner encoding can be unstable at degenerate
    # poles or other awkward source topology. Preserve every original source
    # vector exactly at float32 in a POINT attribute and use it for shading.
    normal_attribute=mesh.attributes.new('Original runtime normal','FLOAT_VECTOR','POINT')
    normal_attribute.data.foreach_set('vector',[value for normal in source_normals for value in normal])
    obj=bpy.data.objects.new(record['name'],mesh); geometry_collection.objects.link(obj)
    obj['source']='buildDesertSceneGeometry(DESERT_COURSE)'; obj['source_material_color']=record['color']; obj['source_texture']=record['texture']
    material=bpy.data.materials.new(record['name']); material.use_nodes=True; material.use_backface_culling=False
    shader=material.node_tree.nodes.get('Principled BSDF'); color=rgb(record['color'])
    shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=record['roughness']; shader.inputs['Metallic'].default_value=record['metalness']
    source_attribute=material.node_tree.nodes.new('ShaderNodeAttribute'); source_attribute.name='Original runtime normal attribute'
    source_attribute.attribute_type='GEOMETRY'; source_attribute.attribute_name='Original runtime normal'
    normal_transform=material.node_tree.nodes.new('ShaderNodeVectorTransform'); normal_transform.name='Original normal object to world'
    normal_transform.vector_type='NORMAL'; normal_transform.convert_from='OBJECT'; normal_transform.convert_to='WORLD'
    normal_normalize=material.node_tree.nodes.new('ShaderNodeVectorMath'); normal_normalize.name='Normalize original runtime normal'; normal_normalize.operation='NORMALIZE'
    material.node_tree.links.new(source_attribute.outputs['Vector'],normal_transform.inputs['Vector'])
    material.node_tree.links.new(normal_transform.outputs['Vector'],normal_normalize.inputs[0])
    # Match runtime StandardMaterial.twoSidedLighting=true on original
    # double-sided triangles without changing any source winding or vector.
    facing=material.node_tree.nodes.new('ShaderNodeNewGeometry'); facing.name='Original runtime double-sided facing'
    sign=material.node_tree.nodes.new('ShaderNodeMath'); sign.name='Original runtime backface normal sign'; sign.operation='MULTIPLY_ADD'
    sign.inputs[1].default_value=-2; sign.inputs[2].default_value=1
    normal_side=material.node_tree.nodes.new('ShaderNodeVectorMath'); normal_side.name='Original runtime two-sided normal'; normal_side.operation='SCALE'
    material.node_tree.links.new(facing.outputs['Backfacing'],sign.inputs[0])
    material.node_tree.links.new(normal_normalize.outputs['Vector'],normal_side.inputs[0])
    material.node_tree.links.new(sign.outputs[0],normal_side.inputs['Scale'])
    material.node_tree.links.new(normal_side.outputs['Vector'],shader.inputs['Normal'])
    if record['texture']!='none':
        texture=material.node_tree.nodes.new('ShaderNodeTexImage'); texture.image=images[record['texture']]
        texture.interpolation='Linear'; texture.extension='REPEAT'
        multiply=material.node_tree.nodes.new('ShaderNodeMixRGB'); multiply.blend_type='MULTIPLY'
        multiply.inputs[0].default_value=1; multiply.inputs[2].default_value=(*color,1)
        material.node_tree.links.new(texture.outputs['Color'],multiply.inputs[1]); material.node_tree.links.new(multiply.outputs[0],shader.inputs['Base Color'])
    mesh.materials.append(material)

scene=bpy.context.scene
scene['provenance']='Exact original runtime desert static meshes; approximate offline lighting/material response. Not a gameplay capture.'
world=bpy.data.worlds.new('Offline warm desert daylight'); scene.world=world; world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(*rgb(data['theme']['sky']),1)
world.node_tree.nodes['Background'].inputs[1].default_value=.7
bpy.ops.object.light_add(type='SUN'); sun=bpy.context.object; sun.name='Approximate offline warm desert sunlight'
sun.rotation_euler=(math.radians(-35),0,math.radians(-16)); sun.data.energy=2.25; sun.data.angle=.09
sun.data.color=(1,.945,.83)
scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=16 if draft else 48
scene.cycles.use_denoising=False; scene.cycles.seed=17; scene.render.threads_mode='FIXED'; scene.render.threads=2
scene.render.image_settings.file_format='PNG'; scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'; scene.view_settings.exposure=.35; scene.render.film_transparent=False
bpy.ops.object.camera_add(); camera=bpy.context.object; camera.name='Desert overview'; scene.camera=camera
camera.data.sensor_fit='HORIZONTAL'; camera.data.clip_start=.1; camera.data.clip_end=10000

edges={edge['id']:edge for edge in data['route']['edges']}
anchors=[xyz(p) for sample in data['geometry']['routeRoadSamples'] for p in (sample['left'],sample['right'])]
anchors += [xyz(p) for edge in data['route']['edges'] for sample in edge['samples'] for p in (sample['left'],sample['right'])]
anchors += [xyz(p) for face in data['geometry']['roadFaces'] for p in face['points']]
# Every actual non-floor opaque member contributes its emitted bounds, so
# full-route views include complete desert components and original landmarks.
fit_anchors=anchors+[xyz((obstacle['min' if x==0 else 'max'][0], obstacle['min' if y==0 else 'max'][1], obstacle['min' if z==0 else 'max'][2]))
    for obstacle in data['geometry']['cameraObstacles'] if 'heightfield' not in obstacle for x in [0,1] for y in [0,1] for z in [0,1]]
fit_anchors += [xyz((component['min' if x==0 else 'max'][0],component['min' if y==0 else 'max'][1],component['min' if z==0 else 'max'][2]))
    for component in data['geometry']['components'] for x in [0,1] for y in [0,1] for z in [0,1]]
mean=sum(anchors,Vector())/len(anchors)
manifest={
    'kind':data['kind'],'description':data['description'],
    'renderer':'Blender '+bpy.app.version_string+' Cycles CPU, 2 threads, '+str(scene.cycles.samples)+' samples. Approximate warm desert daylight, AgX view transform, +0.35 exposure. All original static batches included. No gameplay/GPU or FPS claim.',
    'sourceHashes':data['sourceHashes'],
    'geometryTexturesRoutesThemeSha256':data['contentSha256'],
    'generatorHashes':{p:sha(root/p) for p in ['scripts/export-desert-preview.ts','scripts/render-desert-preview.py']},
    'batches':len(data['geometry']['batches']),
    'vertices':sum(len(b['positions'])//3 for b in data['geometry']['batches']),
    'triangles':sum(len(b['indices'])//3 for b in data['geometry']['batches']),
    'routeLengthsMetres':{e['id']:e['length'] for e in data['route']['edges']},
    'normalShading':{'storage':'Original source normal vectors in a FLOAT_VECTOR POINT mesh attribute, transformed (x,y,z) to (x,-z,y) and stored at float32 precision','mapping':'Each original loop uses its unchanged source vertex index to interpolate the corresponding POINT vector','shader':'Attribute Vector -> object-to-world NORMAL transform -> vector normalization -> multiply by (1 - 2 * Backfacing) -> Principled BSDF Normal; matches runtime twoSidedLighting=true','blenderCornerEncodingNotice':'Built-in custom-corner encoding can differ, especially at degenerate poles when present. The render uses the preserved source vector attribute instead; no original triangles are removed.'},
    'framingSource':'Union of exact left/right routeRoadSamples, independent edge samples including all endpoints, and emitted road-face vertices from start, Archway Weave (alley), Sailcourt Sweep (boulevard) and finish. Overview/topdown also include emitted component and non-heightfield camera bounds. Camera fitting reserves at least six percent on every side.',
    'lapLengthsMetres':{k:data['route'][k] for k in ['archwayLapLength','sailcourtLapLength']},
    'originalModels':{'glb':{'file':'desert-original-scene.glb','sha256':sha(out/'desert-original-scene.glb'),'note':'Complete static geometry in original +Y-up coordinates and float32 GPU precision, original UVs/normals/material settings, embedded original procedural texture PNGs. glTF PBR response can differ from the runtime.'}},
    'views':{},
}
if not draft and selected and (out/'desert-preview-provenance.json').exists():
    previous=json.loads((out/'desert-preview-provenance.json').read_text())
    assert previous['sourceHashes']==data['sourceHashes'],'Partial rerender requires unchanged geometry'
    assert previous['generatorHashes']==manifest['generatorHashes'],'Changed generators require a complete rerender'
    manifest['views']=previous['views']
    for key in ['menuAsset']:
        if key in previous:manifest[key]=previous[key]

def wanted(name): return selected is None or name in selected
def render(name,description,width=1920,height=1080):
    scene.render.resolution_x=width//2 if draft else width; scene.render.resolution_y=height//2 if draft else height
    bpy.context.view_layer.update()
    projected=[world_to_camera_view(scene,camera,p) for p in anchors]
    bounds=[min(p.x for p in projected),min(p.y for p in projected),max(p.x for p in projected),max(p.y for p in projected)]
    destination=out/(name+('-draft' if draft else '')+'.png'); scene.render.filepath=str(destination)
    bpy.ops.render.render(write_still=True)
    assert destination.stat().st_size<10*1024*1024, 'Preview exceeds 10 MiB'
    result={'file':destination.name,'sha256':sha(destination),'resolution':[scene.render.resolution_x,scene.render.resolution_y],
        'cameraPositionBlender':list(camera.location),'cameraQuaternionBlender':list(camera.rotation_euler.to_quaternion()),
        'projection':camera.data.type,'description':description,'routeScreenBounds':bounds}
    result['physicalBranchScreenBounds']={}
    for edge_id in ['alley','boulevard']:
        projected_branch=[world_to_camera_view(scene,camera,xyz(point)) for sample in edges[edge_id]['samples'] for point in (sample['left'],sample['right'])]
        result['physicalBranchScreenBounds'][edge_id]=[min(p.x for p in projected_branch),min(p.y for p in projected_branch),max(p.x for p in projected_branch),max(p.y for p in projected_branch)]
    if camera.data.type=='ORTHO':result['orthographicScaleMetres']=camera.data.ortho_scale
    else:result['lensMillimetres']=camera.data.lens
    manifest['views'][name]=result
    return destination,bounds
def ortho(name,target,direction,scale=None,fit=None,width=1920,height=1080,description='',whole_route=True):
    camera.name=name; camera.data.type='ORTHO'; direction=Vector(direction).normalized(); aspect=width/height
    camera.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler()
    if fit:
        right=camera.rotation_euler.to_matrix()@Vector((1,0,0)); up=camera.rotation_euler.to_matrix()@Vector((0,1,0))
        xx=[(p-target).dot(right) for p in fit]; yy=[(p-target).dot(up) for p in fit]
        target=target+right*((min(xx)+max(xx))/2)+up*((min(yy)+max(yy))/2)
        scale=max(max(xx)-min(xx),(max(yy)-min(yy))*aspect)/.86
    camera.location=target+direction*1500; camera.data.ortho_scale=scale
    destination,bounds=render(name,description,width,height)
    if fit:
        projected=[world_to_camera_view(scene,camera,p) for p in fit]
        subject_bounds=[min(p.x for p in projected),min(p.y for p in projected),max(p.x for p in projected),max(p.y for p in projected)]
        manifest['views'][name]['fittedSubjectScreenBounds']=subject_bounds
        assert min(subject_bounds[:2])>=.06 and max(subject_bounds[2:])<=.94, subject_bounds
    if fit and whole_route:
        assert min(bounds[:2])>=.06 and max(bounds[2:])<=.94, bounds
        for branch_bounds in manifest['views'][name]['physicalBranchScreenBounds'].values():assert min(branch_bounds[:2])>=.06 and max(branch_bounds[2:])<=.94, branch_bounds
    return destination
def landmark(kind): return next(p for p in data['geometry']['landmarks'] if p['kind']==kind)
def detail_anchors(kind):
    return [xyz((c['min' if x==0 else 'max'][0],c['min' if y==0 else 'max'][1],c['min' if z==0 else 'max'][2]))
        for c in data['geometry']['components'] if c.get('landmark')==kind for x in [0,1] for y in [0,1] for z in [0,1]]
def perspective(name,position,target,lens=30,width=1800,height=1125,description=''):
    camera.name=name; camera.data.type='PERSP'; camera.data.lens=lens; camera.location=xyz(position)
    camera.rotation_euler=(xyz(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    return render(name,description,width,height)
def driver_pose(name,pose_id,lens=30,target=None,description=''):
    pose=next(row for row in data['route']['driverReviewPoses'] if row['id']==pose_id)
    perspective(name,pose['driverEye'],target or pose['driverLook'],lens=lens,description=description)
    manifest['views'][name].update({'roadEdge':pose['edge'],'roadDistanceMetres':pose['s'],
        'heightAboveSampledRoadMetres':pose['heightAboveSampledRoadMetres'],
        'sourceDriverPose':pose,'lookTargetSourceCoordinates':target or pose['driverLook']})

if wanted('desert-overview'):
    destination=ortho('desert-overview',mean,(.16,.94,.54),fit=fit_anchors,description='Complete original Sunweave Caravan circuit, connected dune ascent and wind-carved sandstone descent, both physical fork roads, two open stone arches, caravan sailcourt, beacon, kiln and waystation. Exact emitted source geometry with approximate offline light.')
    if not draft:
        webp=root/'public/map-previews/desert-overview.webp'; webp.parent.mkdir(parents=True,exist_ok=True)
        with Image.open(destination) as im: im.resize((1280,720),Image.Resampling.LANCZOS).convert('RGB').save(webp,'WEBP',quality=94,method=6)
        assert webp.stat().st_size<500000, 'Menu poster exceeds 500 kB'
        manifest['menuAsset']={'file':'public/map-previews/desert-overview.webp','sha256':sha(webp),'resolution':[1280,720]}
if wanted('desert-topdown'):
    ortho('desert-topdown',mean,(0,0,1),fit=fit_anchors,width=1920,height=1440,
        description='True overhead source geometry with both complete physical roads: the technical Archway Weave and broad banked Sailcourt Sweep. Actual road widths, branch ownership, split/merge throats and complete connected landform are retained.')
if wanted('desert-driver-reveal'):
    driver_pose('desert-driver-reveal','carved-canyon',lens=30,
        description='Blueprint driver-eye pose on the real start road at 1050 m, exactly 1.6 m above source support. The original carved sandstone shoulder and connected dune landform frame the next bend. No raised camera, hidden foreground, lowered terrain, HUD, driver or vehicle.')
if wanted('desert-arch-passage'):
    arches=data['geometry']['arches']; center=[sum(a['center'][i] for a in arches)/len(arches) for i in range(3)]
    driver_pose('desert-arch-passage','twin-arch-approach',lens=21,target=[center[0],center[1]+18,center[2]],
        description='Low approach on the actual Archway Weave, exactly 1.6 m above source road. Both genuinely open stone rings, seated piers and crown blocks, the flush through-road and daylight between arches remain unmodified. No cutaway, hidden wall or gameplay claim.')
if wanted('desert-caravan-detail'):
    court=landmark('caravan-sailcourt')['position']
    perspective('desert-caravan-detail',[court[0]+21,court[1]+3,court[2]-25],[court[0],court[1]+10,court[2]],lens=22,
        description='Nearby low perspective of the original grounded caravan sailcourt with connected timber frames, actual cloth surfaces, seated posts, rope ties and source-built detail. All scenery remains visible and unchanged; approximate offline material response.')

if not draft:
    # Save the scene with the overview camera, regardless of the final detail view.
    overview=manifest['views'].get('desert-overview')
    if overview:
        from mathutils import Quaternion
        camera.name='Desert source overview'; camera.location=overview['cameraPositionBlender']; camera.rotation_euler=Quaternion(overview['cameraQuaternionBlender']).to_euler()
        camera.data.type='ORTHO'; camera.data.ortho_scale=overview['orthographicScaleMetres']
        scene.render.resolution_x=1920; scene.render.resolution_y=1080
    scene.render.filepath='//desert-overview.png'
    assert scene.render.filepath=='//desert-overview.png'
    assert len(geometry_collection.objects)==len(data['geometry']['batches'])
    assert sum(len(obj.data.vertices) for obj in geometry_collection.objects)==manifest['vertices']
    assert sum(len(obj.data.polygons) for obj in geometry_collection.objects)==manifest['triangles']
    assert all(image.packed_file is not None for image in images.values())
    assert all(not obj.hide_render and not obj.hide_viewport and not obj.modifiers for obj in geometry_collection.objects)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'desert-original-scene.blend'))
    manifest['originalModels']['blend']={'file':'desert-original-scene.blend','sha256':sha(out/'desert-original-scene.blend'),'note':'Editable original mesh batches, packed source textures, original UVs and exact float32 source normal POINT attributes driving normalized, two-sided object-to-world shading. Built-in Blender corner encoding can differ at degenerate poles. Approximate offline lighting/camera.'}
    # Preserve the truthful render record even if behavior-only source is being
    # edited concurrently. A later identical-content re-export can prove that
    # such edits do not require rerendering; never silently replace this proof.
    (out/'desert-render-record.json').write_text(json.dumps(manifest,indent=2)+'\n')
    for path,digest in data['sourceHashes'].items(): assert sha(root/path)==digest,'Source changed during render: '+path
    (root/'docs').mkdir(parents=True,exist_ok=True)
    (root/'docs/desert-preview-provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (out/'desert-preview-provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
if draft: (out/'desert-draft-provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('DESERT_RENDER_COMPLETE',flush=True)
