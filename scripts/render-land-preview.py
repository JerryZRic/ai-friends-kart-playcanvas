"""Render exact runtime mountain meshes, original UVs and pixel textures.
blender -b -t 2 --python scripts/render-land-preview.py -- OUTPUT_DIR [draft|final]
CPU only. Rendered lighting approximates runtime; these are not gameplay captures.
"""
import bpy, json, math, sys, hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
from PIL import Image

def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def xyz(p): return Vector((p[0],-p[2],p[1]))
def linear(v): return v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4
args=sys.argv[sys.argv.index('--')+1:]
out=Path(args[0]).resolve(); mode=args[1] if len(args)>1 else 'final'; draft=mode in ('draft','roadside-draft'); roadside_only=mode.startswith('roadside')
root=Path(__file__).resolve().parents[1]
(root/'docs').mkdir(parents=True,exist_ok=True)
data=json.loads((out/'mountain-geometry.json').read_text())
for path,digest in data['sourceHashes'].items(): assert sha(root/path)==digest, 'Stale geometry: '+path
bpy.ops.wm.read_factory_settings(use_empty=True)
images={}
for name,record in data['textures'].items():
    image=bpy.data.images.new('Original runtime '+name,width=record['width'],height=record['height'])
    image.colorspace_settings.name='Non-Color'
    image.pixels=[v/255 for v in record['pixels']]; image.pack(); images[name]=image
for record in data['geometry']['batches']:
    pos=record['positions']; idx=record['indices']; uv=record['uvs']
    mesh=bpy.data.meshes.new(record['name'])
    mesh.from_pydata([xyz(pos[i:i+3]) for i in range(0,len(pos),3)],[],[idx[i:i+3] for i in range(0,len(idx),3)])
    mesh.update()
    layer=mesh.uv_layers.new(name='Original runtime UV')
    for loop in mesh.loops: layer.data[loop.index].uv=uv[loop.vertex_index*2:loop.vertex_index*2+2]
    for polygon in mesh.polygons: polygon.use_smooth=True
    n=record['normals']; mesh.normals_split_custom_set_from_vertices([xyz(n[i:i+3]) for i in range(0,len(n),3)])
    obj=bpy.data.objects.new(record['name'],mesh); bpy.context.collection.objects.link(obj)
    mat=bpy.data.materials.new(record['name']); mat.use_nodes=True
    shader=mat.node_tree.nodes.get('Principled BSDF'); color=record['color'].lstrip('#')
    rgb=tuple(linear(int(color[i:i+2],16)/255) for i in (0,2,4))
    shader.inputs['Base Color'].default_value=(*rgb,1)
    shader.inputs['Roughness'].default_value=record['roughness']; shader.inputs['Metallic'].default_value=record['metalness']
    if record['texture']!='none':
        texture=mat.node_tree.nodes.new('ShaderNodeTexImage'); texture.image=images[record['texture']]; texture.interpolation='Linear'; texture.extension='REPEAT'
        multiply=mat.node_tree.nodes.new('ShaderNodeMixRGB'); multiply.blend_type='MULTIPLY'; multiply.inputs[0].default_value=1; multiply.inputs[2].default_value=(*rgb,1)
        mat.node_tree.links.new(texture.outputs['Color'],multiply.inputs[1]); mat.node_tree.links.new(multiply.outputs[0],shader.inputs['Base Color'])
    mesh.materials.append(mat)
scene=bpy.context.scene
world=bpy.data.worlds.new('Offline soft alpine daylight'); scene.world=world; world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.68,.78,1); world.node_tree.nodes['Background'].inputs[1].default_value=.75
bpy.ops.object.light_add(type='SUN'); sun=bpy.context.object; sun.name='Offline daylight approximation'
sun.rotation_euler=(math.radians(25),math.radians(-25),math.radians(-35)); sun.data.energy=2.2; sun.data.angle=.12
scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=12 if draft else 48; scene.cycles.use_denoising=False; scene.cycles.seed=17
scene.render.threads_mode='FIXED'; scene.render.threads=2; scene.render.image_settings.file_format='PNG'; scene.view_settings.view_transform='AgX'
scene.render.resolution_percentage=100
points=[xyz(p) for p in data['route']['points']]
anchors=[xyz(p) for r in data['geometry']['roadSamples'] for p in (r['left'],r['right'])]
mean=sum(points,Vector())/len(points)
bpy.ops.object.camera_add(); camera=bpy.context.object; camera.name='Overview'; scene.camera=camera; camera.data.type='ORTHO'; camera.data.sensor_fit='HORIZONTAL'; camera.data.clip_end=10000
manifest={'kind':data['kind'],'description':data['description'],'renderer':'Blender '+bpy.app.version_string+' Cycles CPU, 2 threads, 48 samples. Approximate offline daylight, AgX view transform. All runtime static geometry included; peripheral scenery can lie outside the camera frame. No gameplay/GPU or FPS claim.','sourceHashes':data['sourceHashes'],'generatorHashes':{p:sha(root/p) for p in ['scripts/export-land-preview.ts','scripts/render-land-preview.py']},'batches':len(data['geometry']['batches']),'triangles':sum(len(b['indices'])//3 for b in data['geometry']['batches']),'routeLengthMetres':data['route']['length'],'views':{}}
def view(name,target,direction,scale=None,fit=None,width=1920,height=1080):
    direction=Vector(direction).normalized(); aspect=width/height
    camera.name=name; camera.location=target+direction*1500; camera.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler()
    if fit:
        right=camera.rotation_euler.to_matrix()@Vector((1,0,0)); up=camera.rotation_euler.to_matrix()@Vector((0,1,0))
        xx=[(p-target).dot(right) for p in fit]; yy=[(p-target).dot(up) for p in fit]
        target=target+right*((min(xx)+max(xx))/2)+up*((min(yy)+max(yy))/2)
        camera.location=target+direction*1500; scale=max(max(xx)-min(xx),(max(yy)-min(yy))*aspect)/.88
    camera.data.ortho_scale=scale; scene.render.resolution_x=width//2 if draft else width; scene.render.resolution_y=height//2 if draft else height
    bpy.context.view_layer.update()
    bounds=[world_to_camera_view(scene,camera,p) for p in anchors]
    safe=[min(p.x for p in bounds),min(p.y for p in bounds),max(p.x for p in bounds),max(p.y for p in bounds)]
    if fit: assert min(safe[:2])>=.059 and max(safe[2:])<=.941, safe
    dest=out/(name+('-draft' if draft else '')+'.png'); scene.render.filepath=str(dest); bpy.ops.render.render(write_still=True)
    manifest['views'][name]={'file':dest.name,'sha256':sha(dest),'resolution':[scene.render.resolution_x,scene.render.resolution_y],'cameraPosition':list(camera.location),'orthographicScale':scale,'routeScreenBounds':safe}
    return dest
def roadside_chalet():
    chalet=next(p for p in data['geometry']['props'] if p['kind']=='lookout-chalet')
    route=data['route']['points']; nearest=min(range(len(route)),key=lambda i:(route[i][0]-chalet['x'])**2+(route[i][2]-chalet['z'])**2)
    position=xyz(route[(nearest-8)%len(route)]); position.z+=2.1
    target=xyz((chalet['x'],chalet['y']+3.2,chalet['z']))
    camera.name='Roadside chalet perspective'; camera.data.type='PERSP'; camera.data.lens=36; camera.data.clip_start=.1
    camera.location=position; camera.rotation_euler=(target-position).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x=800 if draft else 1600; scene.render.resolution_y=500 if draft else 1000
    dest=out/('mountain-chalet-roadside'+('-draft' if draft else '')+'.png'); scene.render.filepath=str(dest)
    bpy.ops.render.render(write_still=True)
    manifest['views']['mountain-chalet-roadside']={'file':dest.name,'sha256':sha(dest),'resolution':[scene.render.resolution_x,scene.render.resolution_y],'cameraPosition':list(position),'projection':'perspective','lensMillimetres':36,'heightAboveSampledRoadMetres':2.1,'description':'Actual road-centre camera position at roadside height, looking toward original modeled chalet. Offline image; no driver/HUD.'}

# The map's east-west span reads horizontally; bridge crossing stays in the centre.
if not roadside_only:
    view('mountain-overview',mean,(.12,-.60,.80),fit=anchors)
    if not draft:
        with Image.open(out/'mountain-overview.png') as im:
            destination=root/'public/map-previews/mountain-overview.webp'; destination.parent.mkdir(parents=True,exist_ok=True); im.resize((1280,720),Image.Resampling.LANCZOS).convert('RGB').save(destination,'WEBP',quality=94,method=6)
        manifest['menuAsset']={'file':'public/map-previews/mountain-overview.webp','sha256':sha(destination),'resolution':[1280,720]}
        bpy.ops.wm.save_as_mainfile(filepath=str(out/'mountain-original-scene.blend'))
        view('mountain-topdown',mean,(0,0,1),fit=anchors)
        view('mountain-viaduct',xyz((0,20,0)),(.7,-.6,.4),scale=270,width=1600,height=1000)
        chalet=next((p for p in data['geometry']['props'] if p['kind']=='lookout-chalet'),None)
        if chalet: view('mountain-chalet',xyz((chalet['x'],chalet['y']+3,chalet['z'])),(.5,-.75,.5),scale=100,width=1600,height=1000)
        roadside_chalet()
else:
    if not draft:
        previous=json.loads((out/'mountain-preview-provenance.json').read_text())
        assert previous['sourceHashes']==data['sourceHashes'], 'Roadside addendum requires same geometry source'
        manifest['views']=previous['views']; manifest['menuAsset']=previous['menuAsset']
    roadside_chalet()
if not draft:
    for path,digest in data['sourceHashes'].items(): assert sha(root/path)==digest,'Source changed during render: '+path
    (root/'docs/mountain-preview-provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (out/'mountain-preview-provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('MOUNTAIN_RENDER_COMPLETE',flush=True)
