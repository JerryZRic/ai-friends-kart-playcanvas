"""Verify a reopened Airfield BLEND and companion GLB against source data.
blender -b OUTPUT/airfield-original-scene.blend -t 2 --python-exit-code 1 --python scripts/verify-airfield-enrichment-model.py -- OUTPUT
Read-only model audit: no render, geometry, normal, shader or material changes.
"""
import bpy,json,sys,struct,hashlib,math
from io import BytesIO
from PIL import Image
from pathlib import Path
from mathutils import Vector
out=Path(sys.argv[sys.argv.index('--')+1]);root=Path(__file__).resolve().parents[1]
data=json.loads((out/'airfield-geometry.json').read_text());frozen=json.loads((root/'docs/airfield-enrichment-cameras.json').read_text());render=json.loads((out/'airfield-render-record.json').read_text())
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
f32=lambda n:struct.unpack('<f',struct.pack('<f',n))[0]
xyz=lambda p:tuple(Vector((p[0],-p[2],p[1])))
assert sha(bpy.data.filepath)==render['originalModels']['blend']['sha256']
assert render['sourceHashes']==data['sourceHashes'] and render['frozenCameraManifestSha256']==sha(root/'docs/airfield-enrichment-cameras.json')
assert render['geometryJsonSha256']==sha(out/'airfield-geometry.json')
assert render['originalModels']['glb']['sha256']==sha(out/'airfield-original-scene.glb')
for file,digest in render['generatorHashes'].items():assert sha(root/file)==digest,'Changed preview generator: '+file
for file,digest in data['sourceHashes'].items():
 source=out/'source'/file if render['sourceIdentity'].startswith('archived-') else root/file
 assert sha(source)==digest,'Changed source: '+file
collection=bpy.data.collections['Original runtime static mesh batches'];assert len(collection.objects)==len(data['geometry']['batches'])
assert {obj.name for obj in bpy.context.scene.objects if obj.type=='MESH'}=={obj.name for obj in collection.objects},'Unexpected visible mesh outside original source collection'
def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def rgb(hex):return tuple(linear(int(hex.lstrip('#')[i:i+2],16)/255) for i in (0,2,4))
vertices=triangles=0
required=[('Original runtime normal attribute','Original normal object to world'),('Original normal object to world','Normalize original runtime normal'),('Normalize original runtime normal','Original runtime two-sided normal'),('Original runtime double-sided facing','Original runtime backface normal sign'),('Original runtime backface normal sign','Original runtime two-sided normal'),('Original runtime two-sided normal','Principled BSDF')]
for b in data['geometry']['batches']:
 obj=collection.objects[b['name']];mesh=obj.data;assert obj.matrix_world.is_identity
 assert not obj.hide_render and not obj.hide_viewport and not obj.modifiers
 assert len(mesh.vertices)*3==len(b['positions']);assert [i for p in mesh.polygons for i in p.vertices]==b['indices']
 attribute=mesh.attributes['Original runtime normal'];assert attribute.data_type=='FLOAT_VECTOR' and attribute.domain=='POINT'
 for i,v in enumerate(mesh.vertices):
  assert tuple(v.co)==xyz(b['positions'][i*3:i*3+3]),(b['name'],'position',i)
  assert tuple(attribute.data[i].vector)==xyz(b['normals'][i*3:i*3+3]),(b['name'],'normal',i)
 assert len(mesh.uv_layers)==1
 for loop in mesh.loops:assert tuple(mesh.uv_layers[0].data[loop.index].uv)==tuple(f32(x) for x in b['uvs'][loop.vertex_index*2:loop.vertex_index*2+2]),(b['name'],'UV',loop.index)
 material=mesh.materials[0];nodes=material.node_tree.nodes;links={(l.from_node.name,l.to_node.name) for l in material.node_tree.links}
 assert all(link in links for link in required),b['name']+' source-normal shader links'
 a=nodes['Original runtime normal attribute'];assert a.attribute_type=='GEOMETRY' and a.attribute_name=='Original runtime normal'
 t=nodes['Original normal object to world'];assert t.vector_type=='NORMAL' and t.convert_from=='OBJECT' and t.convert_to=='WORLD'
 assert nodes['Normalize original runtime normal'].operation=='NORMALIZE'
 sign=nodes['Original runtime backface normal sign'];assert sign.operation=='MULTIPLY_ADD' and sign.inputs[1].default_value==-2 and sign.inputs[2].default_value==1
 assert nodes['Original runtime two-sided normal'].operation=='SCALE'
 shader=nodes['Principled BSDF'];assert shader.inputs['Normal'].is_linked
 norm=nodes['Normalize original runtime normal'];side=nodes['Original runtime two-sided normal'];facing=nodes['Original runtime double-sided facing']
 sockets=[(a.outputs['Vector'],t.inputs['Vector']),(t.outputs['Vector'],norm.inputs[0]),(facing.outputs['Backfacing'],sign.inputs[0]),(norm.outputs['Vector'],side.inputs[0]),(sign.outputs[0],side.inputs['Scale']),(side.outputs['Vector'],shader.inputs['Normal'])]
 assert all(any(link.from_socket==source and link.to_socket==target for link in material.node_tree.links) for source,target in sockets),b['name']+' exact shader sockets'
 assert abs(shader.inputs['Roughness'].default_value-b['roughness'])<1e-6 and abs(shader.inputs['Metallic'].default_value-b['metalness'])<1e-6
 assert obj['source_material_color']==b['color'] and obj['source_texture']==b['texture']
 assert not material.use_backface_culling
 color=rgb(b['color'])
 if b['texture']=='none':assert not shader.inputs['Base Color'].is_linked and all(abs(shader.inputs['Base Color'].default_value[i]-color[i])<1e-6 for i in range(3))
 else:
  multiply=next(n for n in nodes if n.bl_idname=='ShaderNodeMixRGB');texture=next(n for n in nodes if n.bl_idname=='ShaderNodeTexImage')
  assert multiply.blend_type=='MULTIPLY' and multiply.inputs[0].default_value==1
  assert all(abs(multiply.inputs[2].default_value[i]-color[i])<1e-6 for i in range(3))
  assert texture.image.name=='Original runtime '+b['texture'] and texture.interpolation=='Linear' and texture.extension=='REPEAT'
  assert any(l.from_socket==texture.outputs['Color'] and l.to_socket==multiply.inputs[1] for l in material.node_tree.links)
  assert any(l.from_socket==multiply.outputs[0] and l.to_socket==shader.inputs['Base Color'] for l in material.node_tree.links)
 vertices+=len(mesh.vertices);triangles+=len(mesh.polygons)
used_texture_kinds={b['texture'] for b in data['geometry']['batches'] if b['texture']!='none'}
assert {im.name for im in bpy.data.images if im.name.startswith('Original runtime ')}=={'Original runtime '+kind for kind in used_texture_kinds}
for kind in sorted(used_texture_kinds):
 texture=data['textures'][kind];im=bpy.data.images['Original runtime '+kind]
 assert im.packed_file is not None and list(im.size)==[texture['width'],texture['height']]
 assert [round(v*255) for v in im.pixels]==texture['pixels'],kind+' packed pixel bytes'
assert not bpy.data.libraries
image_paths={im.name:im.filepath for im in bpy.data.images if im.source!='VIEWER'}
assert all(not p or p.startswith('//') for p in image_paths.values())
assert all('/workspace/' not in p and '.openai' not in p for p in image_paths.values())
cameras=bpy.data.collections['Frozen Airfield review and catalog cameras'];assert len(cameras.objects)==len(frozen['views'])+len(frozen['catalogViews'])
catalog=[{'name':name,'sensorFit':'HORIZONTAL','sensorWidthMillimetres':36,'sensorHeightMillimetres':24,'lensMillimetres':v.get('lensMillimetres',50),'clipStart':.1,'clipEnd':10000,**v} for name,v in frozen['catalogViews'].items()]
for v in frozen['views']+catalog:
 cam=cameras.objects[v['name']];assert cam.data.sensor_fit==v['sensorFit'];assert cam.data.type==v['projection'];assert max(abs(a-b) for a,b in zip(cam.location,v['cameraPositionBlender']))<1e-6
 assert max(abs(a-b) for a,b in zip(cam.rotation_quaternion,v['cameraQuaternionBlender']))<1e-6
 if 'cameraMatrixWorldBlender' in v:assert max(abs(cam.matrix_world[i][j]-v['cameraMatrixWorldBlender'][i][j]) for i in range(4) for j in range(4))<1e-6
 for key,field in [('lensMillimetres','lens'),('sensorWidthMillimetres','sensor_width'),('sensorHeightMillimetres','sensor_height'),('clipStart','clip_start'),('clipEnd','clip_end')]:assert abs(getattr(cam.data,field)-v[key])<1e-5
 if v['projection']=='ORTHO':assert abs(cam.data.ortho_scale-v['orthographicScaleMetres'])<1e-6
scene=bpy.context.scene;assert scene.camera.name=='airfield-overview' and scene.render.filepath=='//airfield-overview.png'
assert [scene.render.resolution_x,scene.render.resolution_y]==[1920,1080]
light=render['verifiedLighting'];background=scene.world.node_tree.nodes['Background'];sun=next(o for o in scene.objects if o.type=='LIGHT')
assert all(abs(background.inputs[0].default_value[i]-rgb(data['theme']['sky'])[i])<1e-6 for i in range(3))
assert abs(background.inputs[1].default_value-light['worldStrength'])<1e-6
for actual,expected in [(list(sun.rotation_euler),light['sunEulerRadians']),(list(sun.data.color),light['sunColorLinear'])]:assert all(abs(a-b)<1e-6 for a,b in zip(actual,expected))
assert abs(sun.data.energy-light['sunEnergy'])<1e-6 and abs(sun.data.angle-light['sunAngleRadians'])<1e-6
assert scene.render.engine=='CYCLES' and scene.cycles.device=='CPU' and scene.render.threads==2
assert scene.view_settings.view_transform==render['verifiedRenderSettings']['viewTransform'] and abs(scene.view_settings.exposure-render['verifiedRenderSettings']['exposure'])<1e-6
# Check the reusable GLB, including all source normal and UV streams.
raw=(out/'airfield-original-scene.glb').read_bytes();magic,version,length=struct.unpack_from('<III',raw);assert (magic,version,length)==(0x46546c67,2,len(raw))
n,kind=struct.unpack_from('<II',raw,12);assert kind==0x4e4f534a;gltf=json.loads(raw[20:20+n]);size,kind=struct.unpack_from('<II',raw,20+n);assert kind==0x004e4942;binary=raw[28+n:28+n+size]
assert gltf['extras']['sourceHashes']==data['sourceHashes'];assert len(gltf['meshes'])==len(data['geometry']['batches']);accessors=0
assert len(gltf['nodes'])==len(gltf['materials'])==len(gltf['meshes'])
assert gltf['scene']==0 and len(gltf['scenes'])==1 and gltf['scenes'][0]['nodes']==list(range(len(gltf['nodes'])))
assert gltf['samplers']==[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]
texture_names=list(data['textures'])
for i,(mesh,b) in enumerate(zip(gltf['meshes'],data['geometry']['batches'])):
 assert gltf['nodes'][i]=={'name':b['name'],'mesh':i},'No transformed, hidden or additional GLB nodes'
 assert mesh['name']==b['name'] and len(mesh['primitives'])==1;p=mesh['primitives'][0]
 assert p['mode']==4 and p['material']==i and set(p['attributes'])=={'POSITION','NORMAL','TEXCOORD_0'}
 material=gltf['materials'][p['material']];e=material['extras'];assert (e['sourceColor'],e['sourceTexture'],e['sourceRoughness'],e['sourceMetalness'])==(b['color'],b['texture'],b['roughness'],b['metalness'])
 assert set(material)=={'name','doubleSided','pbrMetallicRoughness','extras'} and material['name']==b['name'] and material['doubleSided'] is True
 pbr=material['pbrMetallicRoughness'];assert all(abs(a-z)<1e-12 for a,z in zip(pbr['baseColorFactor'],[*rgb(b['color']),1])) and len(pbr['baseColorFactor'])==4
 assert pbr['roughnessFactor']==b['roughness'] and pbr['metallicFactor']==b['metalness']
 expected_keys={'baseColorFactor','roughnessFactor','metallicFactor'}
 if b['texture']!='none':
  expected_keys.add('baseColorTexture');ti=texture_names.index(b['texture']);assert pbr['baseColorTexture']=={'index':ti} and gltf['textures'][ti]=={'sampler':0,'source':ti}
 assert set(pbr)==expected_keys
 for key,idx in [('positions',p['attributes']['POSITION']),('normals',p['attributes']['NORMAL']),('uvs',p['attributes']['TEXCOORD_0']),('indices',p['indices'])]:
  a=gltf['accessors'][idx];v=gltf['bufferViews'][a['bufferView']];offset=v.get('byteOffset',0)+a.get('byteOffset',0);fmt='I' if key=='indices' else 'f';expected=struct.pack('<'+fmt*len(b[key]),*b[key]);assert binary[offset:offset+len(expected)]==expected,(b['name'],key);accessors+=1
  width=1 if key=='indices' else 2 if key=='uvs' else 3
  assert a['componentType']==(5125 if key=='indices' else 5126) and a['count']==len(b[key])//width and a['type']==('SCALAR' if key=='indices' else 'VEC2' if key=='uvs' else 'VEC3')
assert len(gltf['images'])==len(data['textures'])
for image,(name,t) in zip(gltf['images'],data['textures'].items()):
 v=gltf['bufferViews'][image['bufferView']];embedded=binary[v['byteOffset']:v['byteOffset']+v['byteLength']];assert embedded==(out/'textures'/(name+'.png')).read_bytes()
 im=Image.open(BytesIO(embedded)).convert('RGBA');assert im.size==(t['width'],t['height']) and list(im.tobytes())==t['pixels']
report={'status':'passed','sourceHashes':data['sourceHashes'],'reopenedBlendSha256':sha(bpy.data.filepath),'glbSha256':sha(out/'airfield-original-scene.glb'),'geometrySha256':sha(out/'airfield-geometry.json'),'verifierSha256':sha(__file__),'batches':len(collection.objects),'vertices':vertices,'triangles':triangles,'exactFloat32PositionsNormalsUvsAndIndices':True,'explicitSourceNormalShaderLinksVerified':True,'objectTransformsIdentity':True,'normalTransform':'Source (x,y,z) to Blender (x,-z,y) is an orthogonal determinant +1 rotation; OBJECT to WORLD NORMAL transform, normalized and double-sided sign matches runtime convention','nativeCustomCornerEncodingBypassed':True,'packedSourceTexturePixelsExact':True,'packedBlendTextureKinds':sorted(used_texture_kinds),'unusedExportedTextureKinds':sorted(set(data['textures'])-used_texture_kinds),'unusedTextureNote':'Blender omits unused image data on save; every used source texture is packed, and all four exported source PNG sets remain exact in the GLB and texture directory','externalLinkedLibraries':0,'imagePaths':image_paths,'reviewCameras':len(frozen['views']),'catalogCameras':len(frozen['catalogViews']),'glbExactAccessors':accessors,'glbMaterialRecords':len(gltf['materials']),'glbActualPbrFactorsTexturesSamplersAndIdentityNodesVerified':True,'reopenedMaterialColorsTextureLinksLightingAndCameraSensorsVerified':True,'glbEmbeddedTexturePixelSets':len(gltf['images']),'notice':'Exact geometry/normal-data/shader-path verification; offline material/light response remains approximate, not runtime GPU or performance evidence'}
(out/'reopened-model-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
