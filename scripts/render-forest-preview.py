"""Render exact runtime forest mesh batches, normals, UVs and procedural textures.
blender -b -t 2 --python scripts/render-forest-preview.py -- OUTPUT_DIR [draft|final] [view,...]
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
root=Path(__file__).resolve().parents[1]
data=json.loads((out/'forest-geometry.json').read_text())
for path,digest in data['sourceHashes'].items(): assert sha(root/path)==digest, 'Stale forest geometry: '+path
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
    obj['source']='buildForestSceneGeometry(FOREST_COURSE)'; obj['source_material_color']=record['color']; obj['source_texture']=record['texture']
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
scene['provenance']='Exact original runtime forest static meshes; approximate offline lighting/material response. Not a gameplay capture.'
world=bpy.data.worlds.new('Offline cool cedar daylight'); scene.world=world; world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(*rgb(data['theme']['sky']),1)
world.node_tree.nodes['Background'].inputs[1].default_value=.7
bpy.ops.object.light_add(type='SUN'); sun=bpy.context.object; sun.name='Approximate offline warm canopy light'
sun.rotation_euler=(math.radians(-35),0,math.radians(-16)); sun.data.energy=2.25; sun.data.angle=.09
sun.data.color=(1,.945,.83)
scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=12 if draft else 48
scene.cycles.use_denoising=False; scene.cycles.seed=17; scene.render.threads_mode='FIXED'; scene.render.threads=2
scene.render.image_settings.file_format='PNG'; scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'; scene.view_settings.exposure=.35; scene.render.film_transparent=False
bpy.ops.object.camera_add(); camera=bpy.context.object; camera.name='Forest overview'; scene.camera=camera
camera.data.sensor_fit='HORIZONTAL'; camera.data.clip_start=.1; camera.data.clip_end=10000

edges={edge['id']:edge for edge in data['route']['edges']}
anchors=[xyz(p) for sample in data['geometry']['routeRoadSamples'] for p in (sample['left'],sample['right'])]
# Every actual non-terrain opaque member contributes its emitted bounds, so
# full-route views include complete forest crowns and original landmarks.
fit_anchors=anchors+[xyz((obstacle['min' if x==0 else 'max'][0], obstacle['min' if y==0 else 'max'][1], obstacle['min' if z==0 else 'max'][2]))
    for obstacle in data['geometry']['cameraObstacles'] if 'heightfield' not in obstacle for x in [0,1] for y in [0,1] for z in [0,1]]
mean=sum(anchors,Vector())/len(anchors)
manifest={
    'kind':data['kind'],'description':data['description'],
    'renderer':'Blender '+bpy.app.version_string+' Cycles CPU, 2 threads, '+str(scene.cycles.samples)+' samples. Approximate cool cedar daylight, AgX view transform, +0.35 exposure. All original static batches included. No gameplay/GPU or FPS claim.',
    'sourceHashes':data['sourceHashes'],
    'geometryTexturesRoutesThemeSha256':data['contentSha256'],
    'generatorHashes':{p:sha(root/p) for p in ['scripts/export-forest-preview.ts','scripts/render-forest-preview.py']},
    'batches':len(data['geometry']['batches']),
    'vertices':sum(len(b['positions'])//3 for b in data['geometry']['batches']),
    'triangles':sum(len(b['indices'])//3 for b in data['geometry']['batches']),
    'routeLengthsMetres':{e['id']:e['length'] for e in data['route']['edges']},
    'framingSource':'Union of exact left/right routeRoadSamples from start, Lens Service Path (alley), Observatory Rim (boulevard) and finish; overview/topdown also include all emitted non-terrain camera-component bounds, including full tree crowns and original landmarks.',
    'lapLengthsMetres':{k:data['route'][k] for k in ['serviceLapLength','rimLapLength']},
    'originalModels':{'glb':{'file':'forest-original-scene.glb','sha256':sha(out/'forest-original-scene.glb'),'note':'Complete static geometry in original +Y-up coordinates and float32 GPU precision, original UVs/normals/material settings, embedded original procedural texture PNGs. glTF PBR response can differ from the runtime.'}},
    'views':{},
}
if not draft and selected and (out/'forest-preview-provenance.json').exists():
    previous=json.loads((out/'forest-preview-provenance.json').read_text())
    assert previous['sourceHashes']==data['sourceHashes'],'Partial rerender requires unchanged geometry'
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
def ortho(name,target,direction,scale=None,fit=None,width=1920,height=1080,description=''):
    camera.name=name; camera.data.type='ORTHO'; direction=Vector(direction).normalized(); aspect=width/height
    camera.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler()
    if fit:
        right=camera.rotation_euler.to_matrix()@Vector((1,0,0)); up=camera.rotation_euler.to_matrix()@Vector((0,1,0))
        xx=[(p-target).dot(right) for p in fit]; yy=[(p-target).dot(up) for p in fit]
        target=target+right*((min(xx)+max(xx))/2)+up*((min(yy)+max(yy))/2)
        scale=max(max(xx)-min(xx),(max(yy)-min(yy))*aspect)/.88
    camera.location=target+direction*1500; camera.data.ortho_scale=scale
    destination,bounds=render(name,description,width,height)
    if fit: assert min(bounds[:2])>=.059 and max(bounds[2:])<=.941, bounds
    return destination
def landmark(kind): return next(p for p in data['geometry']['landmarks'] if p['kind']==kind)
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

if wanted('forest-overview'):
    destination=ortho('forest-overview',mean,(.76,.57,.68),fit=fit_anchors,description='Complete original CedarLight Observatory forest circuit, both physical fork roads, connected cedar ridge and root valley, banked bowl, open canopy viaduct and modeled forest station. Peripheral terrain extends beyond the full-road frame.')
    if not draft:
        webp=root/'public/map-previews/forest-overview.webp'; webp.parent.mkdir(parents=True,exist_ok=True)
        with Image.open(destination) as im: im.resize((1280,720),Image.Resampling.LANCZOS).convert('RGB').save(webp,'WEBP',quality=94,method=6)
        assert webp.stat().st_size<500000, 'Menu poster exceeds 500 kB'
        manifest['menuAsset']={'file':'public/map-previews/forest-overview.webp','sha256':sha(webp),'resolution':[1280,720]}
if wanted('forest-topdown'):
    ortho('forest-topdown',mean,(0,0,1),fit=fit_anchors,width=1920,height=1440,
        description='True overhead source geometry: pale narrow Lens Service Path cuts through the inner observatory plateau; the broad Observatory Rim follows the outer arc. Both independent roads retain their actual split/merge throats. Upper canopy viaduct crosses the earlier root-valley road at its real separate elevation.')
if wanted('forest-canopy-passage'):
    bridge=landmark('canopy-root-viaduct')['position']
    ortho('forest-canopy-passage',xyz((bridge[0],bridge[1]-12,bridge[2])),(.84,.38,.30),scale=145,width=1800,height=1125,
        description='Actual two-level canopy crossing: upper laminated timber viaduct, shallow source chords, separated sleepers, outside-corridor grounded supports and the open root-valley road below. This view retains every emitted source mesh and its true clearance.')
if wanted('forest-observatory-detail'):
    observatory=landmark('abandoned-observatory')['position']
    ortho('forest-observatory-detail',xyz((observatory[0],observatory[1]+11,observatory[2])),(-.275,.961,.27),scale=68,width=1800,height=1125,
        description='Southwestern three-quarter detail of the original observatory: genuinely open copper dome slit with a double-fork survey instrument, articulated shutter edges, stepped masonry plinth and offset stair tower. The view uses only actual emitted source geometry.')
if wanted('forest-station-detail'):
    station=landmark('old-forestry-station')['position']
    ortho('forest-station-detail',xyz((station[0],station[1]+5,station[2])),(.52,.80,.48),scale=76,width=1800,height=1125,
        description='Original grounded forestry station: pitched workshop roof, open lean-to, supported cut logs with modeled end grain, recessed doors and windows, masonry foundations and neighboring cedar landform. Source geometry is unchanged.')
if not draft:
    # Save the scene with the overview camera, regardless of the final detail view.
    overview=manifest['views'].get('forest-overview')
    if overview:
        from mathutils import Quaternion
        camera.name='Forest source overview'; camera.location=overview['cameraPositionBlender']; camera.rotation_euler=Quaternion(overview['cameraQuaternionBlender']).to_euler()
        camera.data.type='ORTHO'; camera.data.ortho_scale=overview['orthographicScaleMetres']
        scene.render.resolution_x=1920; scene.render.resolution_y=1080
    scene.render.filepath='//forest-overview.png'
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'forest-original-scene.blend'))
    manifest['originalModels']['blend']={'file':'forest-original-scene.blend','sha256':sha(out/'forest-original-scene.blend'),'note':'Editable original mesh batches, packed source procedural textures, UVs, runtime-derived normals and approximate offline lighting/camera.'}
    # Preserve the truthful render record even if behavior-only source is being
    # edited concurrently. A later identical-content re-export can prove that
    # such edits do not require rerendering; never silently replace this proof.
    (out/'forest-render-record.json').write_text(json.dumps(manifest,indent=2)+'\n')
    for path,digest in data['sourceHashes'].items(): assert sha(root/path)==digest,'Source changed during render: '+path
    (root/'docs').mkdir(parents=True,exist_ok=True)
    (root/'docs/forest-preview-provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (out/'forest-preview-provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
if draft: (out/'forest-draft-provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('FOREST_RENDER_COMPLETE',flush=True)
