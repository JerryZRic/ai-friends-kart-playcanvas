"""Render accepted Mountain final overview/topdown/models without publishing.
blender -b -t 2 --python scripts/render-mountain-final.py -- OUTPUT BASELINE_CAMERA_SETTINGS
All exact source batches remain enabled. CPU source render, not gameplay capture.
"""
import bpy,json,math,sys,hashlib,struct
from pathlib import Path
from mathutils import Vector,Quaternion
from bpy_extras.object_utils import world_to_camera_view
from PIL import Image,ImageDraw,ImageFont

def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def xyz(p): return Vector((p[0],-p[2],p[1]))
def linear(v): return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def rgb(h): return tuple(linear(int(h.lstrip('#')[i:i+2],16)/255) for i in (0,2,4))
def float32(n): return struct.unpack('f',struct.pack('f',n))[0]
args=sys.argv[sys.argv.index('--')+1:]; out=Path(args[0]).resolve()
data=json.loads((out/'mountain-geometry.json').read_text()); package=data['cameras']; settings=package['offlineTranslation']
root=Path(__file__).resolve().parents[1]
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
    obj['source']='Frozen original Mountain source geometry'; obj['source_material_color']=record['color']; obj['source_texture']=record['texture']
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

# Match the source renderer's deliberate shadow exception. No camera-visible
# mesh is suppressed or modified; only valley and distant batches skip shadows.
for obj in geometry_collection.objects:
    obj.visible_shadow=not ('valley floor' in obj.name or 'Distant' in obj.name)
# Read back exact source topology, float32 positions/UVs/normals and loop map.
audit={'batches':len(geometry_collection.objects),'vertices':0,'triangles':0,'errors':[]}
for record in data['geometry']['batches']:
    mesh=bpy.data.meshes[record['name']]; positions=record['positions']; normals=record['normals']; indices=record['indices']; uvs=record['uvs']
    audit['vertices']+=len(mesh.vertices);audit['triangles']+=len(mesh.polygons)
    assert len(mesh.vertices)*3==len(positions)
    assert [v for poly in mesh.polygons for v in poly.vertices]==indices,record['name']+' topology'
    for i,v in enumerate(mesh.vertices):
        assert tuple(v.co)==tuple(xyz(positions[i*3:i*3+3])),record['name']+' positions'
        assert tuple(mesh.attributes['Original runtime normal'].data[i].vector)==tuple(xyz(normals[i*3:i*3+3])),record['name']+' normals'
    for loop in mesh.loops:
        assert tuple(mesh.uv_layers[0].data[loop.index].uv)==tuple(float32(n) for n in uvs[loop.vertex_index*2:loop.vertex_index*2+2]),record['name']+' UV map'
    assert not bpy.data.objects[record['name']].hide_render
(out/'mesh-readback-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
scene=bpy.context.scene; scene['provenance']='Exact source Mountain static meshes, approximate offline material/light response. Not gameplay.'
world=bpy.data.worlds.new('Frozen Mountain ambient and sky');scene.world=world;world.use_nodes=True
nodes=world.node_tree.nodes;links=world.node_tree.links;nodes.clear()
ambient=nodes.new('ShaderNodeBackground');ambient.inputs['Color'].default_value=(*rgb(settings['worldColorSource']),1);ambient.inputs['Strength'].default_value=settings['worldEnergy']
sky=nodes.new('ShaderNodeBackground');sky.inputs['Color'].default_value=(*rgb(settings['backgroundColorSource']),1);sky.inputs['Strength'].default_value=1
path=nodes.new('ShaderNodeLightPath');mix=nodes.new('ShaderNodeMixShader');output=nodes.new('ShaderNodeOutputWorld')
links.new(path.outputs['Is Camera Ray'],mix.inputs[0]);links.new(ambient.outputs[0],mix.inputs[1]);links.new(sky.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],output.inputs['Surface'])
bpy.ops.object.light_add(type='SUN');sun=bpy.context.object;sun.name='Frozen source-direction Mountain sun'
sun.rotation_euler=xyz(settings['sunDirectionSource']).to_track_quat('-Z','Y').to_euler();sun.data.energy=settings['sunEnergy'];sun.data.angle=settings['sunAngleRadians'];sun.data.color=rgb(settings['sunColorSource'])
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=settings['samples'];scene.cycles.seed=settings['seed'];scene.cycles.use_denoising=False
scene.render.threads_mode='FIXED';scene.render.threads=settings['threads'];scene.render.image_settings.file_format='PNG';scene.render.resolution_percentage=100
scene.view_settings.view_transform=settings['viewTransform'];scene.view_settings.look='Medium High Contrast' if False else 'None';scene.view_settings.exposure=settings['exposure'];scene.view_settings.gamma=settings['gamma']
scene.render.film_transparent=False
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.sensor_fit='HORIZONTAL';camera.data.sensor_width=36
anchors=[xyz(p) for row in data['geometry']['roadSamples'] for p in (row['left'],row['right'])]
if len(args)>1:
    frozen=json.loads(Path(args[1]).read_text()); assert frozen['cameraPackageSha256']==data['cameraPackageSha256'],'Camera package changed'
    poses=frozen['views'];assert frozen['offlineTranslation']==settings,'Lighting changed in paired render'
else:
    poses={}
    spec=package['overview']; direction=Vector(spec['directionBlender']).normalized(); target=sum(anchors,Vector())/len(anchors)
    q=(-direction).to_track_quat('-Z','Y');right=q@Vector((1,0,0));up=q@Vector((0,1,0));xx=[(p-target).dot(right) for p in anchors];yy=[(p-target).dot(up) for p in anchors]
    target+=right*((min(xx)+max(xx))/2)+up*((min(yy)+max(yy))/2)
    scale=max(max(xx)-min(xx),(max(yy)-min(yy))*spec['aspect'])/.88
    poses[spec['id']]={**spec,'cameraPositionBlender':list(target+direction*1500),'cameraQuaternionBlenderWXYZ':list(q),'targetBlender':list(target),'orthographicScaleMetres':scale}
    for spec in [*package['poses'],package['architecture']]:
        position=xyz(spec['positionSource']);target=xyz(spec['targetSource']);q=(target-position).to_track_quat('-Z','Y')
        poses[spec['id']]={**spec,'cameraPositionBlender':list(position),'cameraQuaternionBlenderWXYZ':list(q),'targetBlender':list(target)}
    frozen={'version':1,'cameraPackageSha256':data['cameraPackageSha256'],'sourceHashes':data['sourceHashes'],'offlineTranslation':settings,'runtimeTheme':package['runtimeTheme'],'runtimeExposure':package['runtimeExposure'],'runtimeToneMapping':package['runtimeToneMapping'],'views':poses}
    assert not (out/'frozen-render-settings.json').exists(),'Refusing to overwrite frozen camera/render settings'
    (out/'frozen-render-settings.json').write_text(json.dumps(frozen,indent=2)+'\n')
manifest={'kind':data['kind'],'description':data['description'],'sourceHashes':data['sourceHashes'],'geometryContentSha256':data['contentSha256'],'geometryFileSha256':sha(out/'mountain-geometry.json'),'cameraPackageSha256':data['cameraPackageSha256'],'frozenRenderSettingsSha256':sha(Path(args[1]) if len(args)>1 else out/'frozen-render-settings.json'),'generatorHashes':{p:sha(root/p) for p in ['scripts/export-mountain-enrichment-preview.ts','scripts/render-mountain-final.py']},'renderer':'Blender '+bpy.app.version_string+' Cycles CPU; exact source geometry with approximate offline shading/light/material response, no gameplay or FPS claim','offlineTranslation':settings,'normalShading':'Original runtime float32 normal FLOAT_VECTOR POINT attribute, source loop-vertex mapping, (x,y,z)->(x,-z,y), OBJECT->WORLD NORMAL, normalize, multiply (1-2*Backfacing), Principled BSDF Normal','meshReadbackAudit':audit,'views':{}}
# Final delivery is separate from the immutable moderate-resolution comparisons.
assert len(args)>1,'Final rendering requires the explicit sealed comparison settings'
final_samples=48;scene.cycles.samples=final_samples
original_overview=dict(poses['mountain-overview'])
final_overview={**original_overview,'resolution':[1920,1080],
    'description':'Frozen original overview pose, same aspect/framing, higher resolution and samples only; every source batch remains enabled.'}
# Honest additive vertical catalog camera, fitted to exact existing road edges.
target=sum(anchors,Vector())/len(anchors);q=Quaternion((1,0,0,0));aspect=1920/1440
xx=[p.x for p in anchors];yy=[p.y for p in anchors];target.x=(min(xx)+max(xx))/2;target.y=(min(yy)+max(yy))/2
scale=max(max(xx)-min(xx),(max(yy)-min(yy))*aspect)/.88
topdown={'id':'mountain-topdown','projection':'ORTHO','cameraPositionBlender':list(target+Vector((0,0,1500))),
    'cameraQuaternionBlenderWXYZ':list(q),'targetBlender':list(target),'orthographicScaleMetres':scale,
    'resolution':[1920,1440],'aspect':aspect,'nearClip':.12,'farClip':10000,
    'description':'Additive final vertical source view with separately recorded road-edge fit. Not substituted for any frozen comparison camera. Every original source batch stays enabled, including terrain and landmarks.'}
poses={'mountain-overview':final_overview,'mountain-topdown':topdown}
# Optional additive original-prop detail from a real emitted terrain surface.
# This is explicitly architectural and does not replace any chase comparison.
if data['geometry'].get('reusedProps'):
    lookout=data['geometry']['lookout'];origin=lookout['position'];yaw=lookout['yaw'];c=math.cos(yaw);s=math.sin(yaw)
    def local_point(x,y,z):return [origin[0]+x*c+z*s,origin[1]+y,origin[2]-x*s+z*c]
    foot=local_point(0,0,25);field=data['geometry']['terrainGrid']
    gx=(foot[0]-field['minX'])/field['dx'];gz=(foot[2]-field['minZ'])/field['dz'];assert 0<=gx<=field['columns']-1 and 0<=gz<=field['rows']-1
    ix=min(field['columns']-2,math.floor(gx));iz=min(field['rows']-2,math.floor(gz));u=gx-ix;v=gz-iz;i=iz*field['columns']+ix
    a,b,cc,d=[field['heights'][k] for k in [i,i+1,i+field['columns'],i+field['columns']+1]]
    foot[1]=a+(b-a)*u+(cc-a)*v if u+v<=1 else d+(cc-d)*(1-u)+(b-d)*(1-v)
    eye=[foot[0],foot[1]+1.6,foot[2]];target_source=local_point(-.1,1.35,7.25);position=xyz(eye);target=xyz(target_source);q=(target-position).to_track_quat('-Z','Y')
    poses['mountain-terrace-selected-props']={'id':'mountain-terrace-selected-props','projection':'PERSP','cameraPositionBlender':list(position),'cameraQuaternionBlenderWXYZ':list(q),'targetBlender':list(target),
        'positionSource':eye,'physicalFootPointSource':foot,'physicalSupport':'Exact emitted terrain triangle (not bilinear interpolation)','heightAbovePhysicalTerrainMetres':1.6,'targetSource':target_source,
        'lensMillimetres':28,'sensorWidthMillimetres':36,'resolution':[1600,1000],'aspect':1.6,'nearClip':.12,'farClip':2200,
        'description':'Separately labeled additive architectural detail of the two selected original Alpine props on the lookout terrace. Physical eye is 1.6 m above the exact source terrain; this is not the gameplay chase camera and not a before/after replacement.'}

manifest['finalRenderTranslation']={**settings,'samples':final_samples}
manifest['finalDeliveryNotice']='Accepted source geometry, final CPU rendering. Frozen overview pose is retained; only resolution and sampling increase. Topdown is an additive recorded camera. No public file is written here.'
manifest['views']={}
for name,pose in poses.items():
    camera.name=name;camera.location=pose['cameraPositionBlender'];camera.rotation_mode='QUATERNION';camera.rotation_quaternion=Quaternion(pose['cameraQuaternionBlenderWXYZ']);camera.data.type=pose['projection'];camera.data.clip_start=pose['nearClip'];camera.data.clip_end=pose['farClip']
    if pose['projection']=='ORTHO':camera.data.ortho_scale=pose['orthographicScaleMetres']
    else:camera.data.lens=pose['lensMillimetres']
    width,height=pose['resolution'];scene.render.resolution_x=width;scene.render.resolution_y=height;bpy.context.view_layer.update()
    projected=[world_to_camera_view(scene,camera,p) for p in anchors];bounds=[min(p.x for p in projected),min(p.y for p in projected),max(p.x for p in projected),max(p.y for p in projected)]
    if pose['projection']=='ORTHO':assert min(bounds[:2])>=.059 and max(bounds[2:])<=.941,(name,'Full route outside protected frame',bounds)
    if name=='mountain-terrace-selected-props':
        ids=[component for prop in data['geometry']['reusedProps'] for component in prop['components']]
        batches={row['name']:row for row in data['geometry']['batches']};vertices=[]
        for ci in ids:
            component=data['geometry']['components'][ci];source=batches[component['batch']]['positions']
            vertices.extend(xyz(source[k*3:k*3+3]) for k in range(component['vertexStart'],component['vertexEnd']))
        props_in_view=[world_to_camera_view(scene,camera,p) for p in vertices]
        detail_bounds=[min(p.x for p in props_in_view),min(p.y for p in props_in_view),max(p.x for p in props_in_view),max(p.y for p in props_in_view)]
        assert min(p.z for p in props_in_view)>0 and min(detail_bounds[:2])>=.025 and max(detail_bounds[2:])<=.975,('Additive selected props framing',detail_bounds)
        pose['selectedPropsScreenBounds']=detail_bounds
    dest=out/(name+'.png');scene.render.filepath=str(dest);bpy.ops.render.render(write_still=True)
    assert dest.stat().st_size<10*1024*1024,'PNG over per-attachment limit'
    manifest['views'][name]={**pose,'file':dest.name,'sha256':sha(dest),'routeScreenBounds':bounds,
        'sunQuaternionBlenderWXYZ':list(sun.rotation_euler.to_quaternion()),'exposure':scene.view_settings.exposure,'samples':scene.cycles.samples}
    (out/'mountain-final-render-provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
with Image.open(out/'mountain-overview.png') as im:im.resize((1280,720),Image.Resampling.LANCZOS).convert('RGB').save(out/'mountain-menu-overview.webp','WEBP',quality=94,method=6)
manifest['menuCandidate']={'file':'mountain-menu-overview.webp','sha256':sha(out/'mountain-menu-overview.webp'),'resolution':[1280,720],'derivedFrom':'mountain-overview.png','notPublished':True}
# Deliver an editable all-source .blend with the canonical overview active.
pose=poses['mountain-overview'];camera.name='Mountain accepted source overview';camera.location=pose['cameraPositionBlender'];camera.rotation_quaternion=Quaternion(pose['cameraQuaternionBlenderWXYZ']);camera.data.type='ORTHO';camera.data.ortho_scale=pose['orthographicScaleMetres'];camera.data.clip_start=pose['nearClip'];camera.data.clip_end=pose['farClip'];scene.render.resolution_x,scene.render.resolution_y=pose['resolution'];scene.render.filepath='//mountain-overview.png'
assert all(image.packed_file is not None for image in images.values())
assert all(not obj.hide_render and not obj.hide_viewport and not obj.modifiers for obj in geometry_collection.objects)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'mountain-enriched-source-scene.blend'),compress=True)
manifest['editableBlender']={'file':'mountain-enriched-source-scene.blend','sha256':sha(out/'mountain-enriched-source-scene.blend'),'byteLength':(out/'mountain-enriched-source-scene.blend').stat().st_size,'notice':'Complete source meshes, original UVs, packed procedural pixels and float32 source-normal POINT shader; approximate offline light/material response.'}
manifest['generatorHashes']['scripts/render-mountain-final.py']=sha(root/'scripts/render-mountain-final.py')
(out/'mountain-final-render-provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('MOUNTAIN_FINAL_SOURCE_RENDER_COMPLETE',flush=True)
