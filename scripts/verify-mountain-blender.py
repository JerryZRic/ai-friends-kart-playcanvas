"""Verify a saved/reopened Mountain .blend against exported source data.
blender -b MODEL.blend -t 2 --python scripts/verify-mountain-blender.py -- GEOMETRY.json OUTPUT.json
No rendering or geometry changes; proves the delivered file, not just memory.
"""
import bpy,json,sys,struct,hashlib
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];source=Path(args[0]);destination=Path(args[1]);data=json.loads(source.read_text())
f32=lambda n:struct.unpack('f',struct.pack('f',n))[0]
def xyz(p):return tuple(Vector((p[0],-p[2],p[1])))
collection=bpy.data.collections['Original runtime static mesh batches'];assert len(collection.objects)==len(data['geometry']['batches'])
vertices=triangles=0
for record in data['geometry']['batches']:
    obj=collection.objects[record['name']];mesh=obj.data;assert not obj.hide_render and not obj.hide_viewport and not obj.modifiers
    assert len(mesh.vertices)*3==len(record['positions']);assert [v for p in mesh.polygons for v in p.vertices]==record['indices']
    assert len(mesh.uv_layers)==1;attribute=mesh.attributes['Original runtime normal'];assert attribute.data_type=='FLOAT_VECTOR' and attribute.domain=='POINT'
    for i,v in enumerate(mesh.vertices):
        assert tuple(v.co)==xyz(record['positions'][i*3:i*3+3]),(record['name'],'positions',i)
        assert tuple(attribute.data[i].vector)==xyz(record['normals'][i*3:i*3+3]),(record['name'],'normals',i)
    for loop in mesh.loops:
        assert tuple(mesh.uv_layers[0].data[loop.index].uv)==tuple(f32(x) for x in record['uvs'][loop.vertex_index*2:loop.vertex_index*2+2]),(record['name'],'uv',loop.index)
    material=mesh.materials[0];nodes=material.node_tree.nodes;links=material.node_tree.links
    required=[('Original runtime normal attribute','Original normal object to world'),('Original normal object to world','Normalize original runtime normal'),('Normalize original runtime normal','Original runtime two-sided normal'),('Original runtime double-sided facing','Original runtime backface normal sign'),('Original runtime backface normal sign','Original runtime two-sided normal'),('Original runtime two-sided normal','Principled BSDF')]
    actual={(l.from_node.name,l.to_node.name) for l in links};assert all(edge in actual for edge in required),record['name']+' normal shader links'
    assert nodes['Original runtime backface normal sign'].operation=='MULTIPLY_ADD';assert nodes['Original runtime backface normal sign'].inputs[1].default_value==-2;assert nodes['Original runtime backface normal sign'].inputs[2].default_value==1
    vertices+=len(mesh.vertices);triangles+=len(mesh.polygons)
for kind,texture in data['textures'].items():
    im=bpy.data.images['Original runtime '+kind];assert im.packed_file is not None and list(im.size)==[texture['width'],texture['height']]
    assert [round(v*255) for v in im.pixels]==texture['pixels'],kind+' original pixel bytes'
scene=bpy.context.scene;assert scene.camera.data.type=='ORTHO' and [scene.render.resolution_x,scene.render.resolution_y]==[1920,1080]
assert scene.render.filepath=='//mountain-overview.png'
report={'reopenedBlend':Path(bpy.data.filepath).name,'sha256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),'sourceGeometrySha256':hashlib.sha256(source.read_bytes()).hexdigest(),'batches':len(collection.objects),'vertices':vertices,'triangles':triangles,'positionsTopologyUvsNormalsExact':True,'normalPointShaderLinksVerified':True,'packedSourceTextureBytesExact':True,'allSourceBatchesEnabled':True,'relativeOverviewRenderPath':True}
destination.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
