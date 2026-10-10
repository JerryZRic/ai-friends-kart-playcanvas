"""Render exact runtime workshop mesh batches, normals, UVs and procedural textures.
blender -b -t 2 --python scripts/render-workshop-preview.py -- OUTPUT_DIR [draft|final] [view,...]
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
view_names={'workshop-overview','workshop-topdown','workshop-helix-crossing','workshop-clockheart-detail','workshop-cabinet-detail','workshop-vise-detail'}
assert mode in {'draft','final'}, 'Expected draft or final render mode'
assert selected is None or selected <= view_names, 'Unknown requested view'
root=Path(__file__).resolve().parents[1]
data=json.loads((out/'workshop-geometry.json').read_text())
for path,digest in data['sourceHashes'].items(): assert sha(root/path)==digest, 'Stale workshop geometry: '+path
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
    mesh.normals_split_custom_set_from_vertices([xyz(normals[i:i+3]) for i in range(0,len(normals),3)])
    obj=bpy.data.objects.new(record['name'],mesh); geometry_collection.objects.link(obj)
    obj['source']='buildWorkshopSceneGeometry(WORKSHOP_COURSE)'; obj['source_material_color']=record['color']; obj['source_texture']=record['texture']
    material=bpy.data.materials.new(record['name']); material.use_nodes=True; material.use_backface_culling=False
    shader=material.node_tree.nodes.get('Principled BSDF'); color=rgb(record['color'])
    shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=record['roughness']; shader.inputs['Metallic'].default_value=record['metalness']
    if record['texture']!='none':
        texture=material.node_tree.nodes.new('ShaderNodeTexImage'); texture.image=images[record['texture']]
        texture.interpolation='Linear'; texture.extension='REPEAT'
        multiply=material.node_tree.nodes.new('ShaderNodeMixRGB'); multiply.blend_type='MULTIPLY'
        multiply.inputs[0].default_value=1; multiply.inputs[2].default_value=(*color,1)
        material.node_tree.links.new(texture.outputs['Color'],multiply.inputs[1]); material.node_tree.links.new(multiply.outputs[0],shader.inputs['Base Color'])
    mesh.materials.append(material)

scene=bpy.context.scene
scene['provenance']='Exact original runtime workshop static meshes; approximate offline lighting/material response. Not a gameplay capture.'
world=bpy.data.worlds.new('Offline warm workshop daylight'); scene.world=world; world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(*rgb(data['theme']['sky']),1)
world.node_tree.nodes['Background'].inputs[1].default_value=.7
bpy.ops.object.light_add(type='SUN'); sun=bpy.context.object; sun.name='Approximate offline warm workbench light'
sun.rotation_euler=(math.radians(-35),0,math.radians(-16)); sun.data.energy=2.25; sun.data.angle=.09
sun.data.color=(1,.945,.83)
scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=16 if draft else 48
scene.cycles.use_denoising=False; scene.cycles.seed=17; scene.render.threads_mode='FIXED'; scene.render.threads=2
scene.render.image_settings.file_format='PNG'; scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'; scene.view_settings.exposure=.35; scene.render.film_transparent=False
bpy.ops.object.camera_add(); camera=bpy.context.object; camera.name='Workshop overview'; scene.camera=camera
camera.data.sensor_fit='HORIZONTAL'; camera.data.clip_start=.1; camera.data.clip_end=10000

edges={edge['id']:edge for edge in data['route']['edges']}
anchors=[xyz(p) for sample in data['geometry']['routeRoadSamples'] for p in (sample['left'],sample['right'])]
anchors += [xyz(p) for edge in data['route']['edges'] for sample in edge['samples'] for p in (sample['left'],sample['right'])]
anchors += [xyz(p) for face in data['geometry']['roadFaces'] for p in face['points']]
# Every actual non-floor opaque member contributes its emitted bounds, so
# full-route views include complete workshop components and original landmarks.
fit_anchors=anchors+[xyz((obstacle['min' if x==0 else 'max'][0], obstacle['min' if y==0 else 'max'][1], obstacle['min' if z==0 else 'max'][2]))
    for obstacle in data['geometry']['cameraObstacles'] if 'heightfield' not in obstacle for x in [0,1] for y in [0,1] for z in [0,1]]
fit_anchors += [xyz((component['min' if x==0 else 'max'][0],component['min' if y==0 else 'max'][1],component['min' if z==0 else 'max'][2]))
    for component in data['geometry']['components'] for x in [0,1] for y in [0,1] for z in [0,1]]
mean=sum(anchors,Vector())/len(anchors)
manifest={
    'kind':data['kind'],'description':data['description'],
    'renderer':'Blender '+bpy.app.version_string+' Cycles CPU, 2 threads, '+str(scene.cycles.samples)+' samples. Approximate warm workshop daylight, AgX view transform, +0.35 exposure. All original static batches included. No gameplay/GPU or FPS claim.',
    'sourceHashes':data['sourceHashes'],
    'geometryTexturesRoutesThemeSha256':data['contentSha256'],
    'generatorHashes':{p:sha(root/p) for p in ['scripts/export-workshop-preview.ts','scripts/render-workshop-preview.py']},
    'batches':len(data['geometry']['batches']),
    'vertices':sum(len(b['positions'])//3 for b in data['geometry']['batches']),
    'triangles':sum(len(b['indices'])//3 for b in data['geometry']['batches']),
    'routeLengthsMetres':{e['id']:e['length'] for e in data['route']['edges']},
    'framingSource':'Union of exact left/right routeRoadSamples, independent edge samples including all endpoints, and emitted road-face vertices from start, Cabinet Chicane (alley), Workbench Rim (boulevard) and finish. Overview/topdown also include emitted component and non-heightfield camera bounds. Camera fitting reserves at least six percent on every side.',
    'lapLengthsMetres':{k:data['route'][k] for k in ['cabinetLapLength','rimLapLength']},
    'originalModels':{'glb':{'file':'workshop-original-scene.glb','sha256':sha(out/'workshop-original-scene.glb'),'note':'Complete static geometry in original +Y-up coordinates and float32 GPU precision, original UVs/normals/material settings, embedded original procedural texture PNGs. glTF PBR response can differ from the runtime.'}},
    'views':{},
}
if not draft and selected and (out/'workshop-preview-provenance.json').exists():
    previous=json.loads((out/'workshop-preview-provenance.json').read_text())
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
    if fit and whole_route: assert min(bounds[:2])>=.06 and max(bounds[2:])<=.94, bounds
    return destination
def landmark(kind): return next(p for p in data['geometry']['landmarks'] if p['kind']==kind)
def detail_anchors(kind):
    return [xyz((c['min' if x==0 else 'max'][0],c['min' if y==0 else 'max'][1],c['min' if z==0 else 'max'][2]))
        for c in data['geometry']['components'] if c.get('landmark')==kind for x in [0,1] for y in [0,1] for z in [0,1]]
def street(name,edge_id,target,back=28,look_height=2.7,lens=33,width=1800,height=1125):
    samples=edges[edge_id]['samples']
    nearest=min(range(len(samples)),key=lambda i:(samples[i]['p'][0]-target[0])**2+(samples[i]['p'][2]-target[2])**2)
    s=max(0,samples[nearest]['s']-back)
    frame=min(samples,key=lambda row:abs(row['s']-s)); position=xyz(frame['p']); position.z+=2.1
    look=xyz((target[0],target[1]+look_height,target[2]))
    camera.name=name; camera.data.type='PERSP'; camera.data.lens=lens; camera.location=position
    camera.rotation_euler=(look-position).to_track_quat('-Z','Y').to_euler()
    render(name,'Perspective from 2.1 m above actual sampled '+edge_id+' road centre. Original source scenery only; no driver, HUD or vehicle.',width,height)
    manifest['views'][name].update({'roadEdge':edge_id,'roadDistanceMetres':frame['s'],'heightAboveSampledRoadMetres':2.1})

if wanted('workshop-overview'):
    destination=ortho('workshop-overview',mean,(.76,.57,.68),fit=fit_anchors,description='Complete original Clockwind Workshop circuit with both physical fork roads, banked helical spool climb, open height-separated crossing, connected wooden benches and modeled clockmaker landmarks. Exact emitted static source geometry, approximate offline lighting.')
    if not draft:
        webp=root/'public/map-previews/workshop-overview.webp'; webp.parent.mkdir(parents=True,exist_ok=True)
        with Image.open(destination) as im: im.resize((1280,720),Image.Resampling.LANCZOS).convert('RGB').save(webp,'WEBP',quality=94,method=6)
        assert webp.stat().st_size<500000, 'Menu poster exceeds 500 kB'
        manifest['menuAsset']={'file':'public/map-previews/workshop-overview.webp','sha256':sha(webp),'resolution':[1280,720]}
if wanted('workshop-topdown'):
    ortho('workshop-topdown',mean,(0,0,1),fit=fit_anchors,width=1920,height=1440,
        description='True overhead source geometry, including both independently sampled physical roads: the technical Cabinet Chicane and broad Workbench Rim. Real split/merge geometry and the upper/lower road crossing retain their actual elevations.')
if wanted('workshop-helix-crossing'):
    ortho('workshop-helix-crossing',xyz((-15,25,5)),(.82,.36,.48),scale=355,width=1800,height=1125,
        description='Source-accurate three-quarter spool climb around the original clock heart, continuous graded support and open overhead crossing. Road camber, elevations, underside and separated lower road are unmodified.')
if wanted('workshop-clockheart-detail'):
    clock=landmark('clock-heart-and-spool')['position']
    ortho('workshop-clockheart-detail',xyz((clock[0],clock[1]+30,clock[2])),(.24,.84,.57),fit=detail_anchors('clock-heart-and-spool'),whole_route=False,width=1800,height=1125,
        description='Original modeled clock heart: source dial faces, hands, bezel, static toothed gears, frame, spindle bosses and grounded pedestal. The gear teeth and silhouette are actual mesh geometry.')
if wanted('workshop-cabinet-detail'):
    cabinet=landmark('tool-cabinet-bank')['position']
    ortho('workshop-cabinet-detail',xyz((cabinet[0],cabinet[1]+18,cabinet[2])),(.55,.78,.42),fit=detail_anchors('tool-cabinet-bank'),whole_route=False,width=1800,height=1125,
        description='Original workshop cabinet assembly with actual recessed drawer fronts, pulls, tool silhouettes and grounded wooden construction. Only the emitted source meshes are shown.')
if wanted('workshop-vise-detail'):
    vise=landmark('vise-and-jaw-station')['position']
    ortho('workshop-vise-detail',xyz((vise[0],vise[1]+10,vise[2])),(.58,.68,.47),scale=68,width=1800,height=1125,
        description='Original vise assembly: source fixed and moving jaws, static threaded rod, cross-handle and bolted mounting plinth. This is a static modeled landmark, not an animated clamping interaction.')
if not draft:
    # Save the scene with the overview camera, regardless of the final detail view.
    overview=manifest['views'].get('workshop-overview')
    if overview:
        from mathutils import Quaternion
        camera.name='Workshop source overview'; camera.location=overview['cameraPositionBlender']; camera.rotation_euler=Quaternion(overview['cameraQuaternionBlender']).to_euler()
        camera.data.type='ORTHO'; camera.data.ortho_scale=overview['orthographicScaleMetres']
        scene.render.resolution_x=1920; scene.render.resolution_y=1080
    scene.render.filepath='//workshop-overview.png'
    assert scene.render.filepath=='//workshop-overview.png'
    assert len(geometry_collection.objects)==len(data['geometry']['batches'])
    assert sum(len(obj.data.vertices) for obj in geometry_collection.objects)==manifest['vertices']
    assert sum(len(obj.data.polygons) for obj in geometry_collection.objects)==manifest['triangles']
    assert all(image.packed_file is not None for image in images.values())
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'workshop-original-scene.blend'))
    manifest['originalModels']['blend']={'file':'workshop-original-scene.blend','sha256':sha(out/'workshop-original-scene.blend'),'note':'Editable original mesh batches, packed source procedural textures, UVs, runtime-derived normals and approximate offline lighting/camera.'}
    # Preserve the truthful render record even if behavior-only source is being
    # edited concurrently. A later identical-content re-export can prove that
    # such edits do not require rerendering; never silently replace this proof.
    (out/'workshop-render-record.json').write_text(json.dumps(manifest,indent=2)+'\n')
    for path,digest in data['sourceHashes'].items(): assert sha(root/path)==digest,'Source changed during render: '+path
    (root/'docs').mkdir(parents=True,exist_ok=True)
    (root/'docs/workshop-preview-provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (out/'workshop-preview-provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
if draft: (out/'workshop-draft-provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('WORKSHOP_RENDER_COMPLETE',flush=True)
