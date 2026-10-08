# Offline CPU geometry review only. Approximate water/light, not a PlayCanvas gameplay capture.
import bpy,json,math,sys,os
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
data=json.load(open(args[0] if args else '/tmp/waterpark-design.json'))
output=args[1] if len(args)>1 else '/tmp/waterpark-renders'
def xyz(a):return(a[0],-a[2],a[1])
def srgb(c):return c/12.92 if c<.04045 else ((c+.055)/1.055)**2.4
for rec in data['meshes']:
 p=rec['positions'];verts=[xyz(p[i:i+3]) for i in range(0,len(p),3)];idx=rec['indices'];faces=[idx[i:i+3] for i in range(0,len(idx),3)]
 mesh=bpy.data.meshes.new(rec['name']);mesh.from_pydata(verts,[],faces);mesh.update();
 if rec.get('normals'):
  for poly in mesh.polygons:poly.use_smooth=True
  ns=rec['normals'];mesh.normals_split_custom_set_from_vertices([xyz(ns[i:i+3]) for i in range(0,len(ns),3)])
 obj=bpy.data.objects.new(rec['name'],mesh);bpy.context.collection.objects.link(obj)
 mat=bpy.data.materials.new(rec['name']);mat.use_nodes=True;n=mat.node_tree.nodes;links=mat.node_tree.links;bs=n.get('Principled BSDF');h=rec['color'].lstrip('#');c=[srgb(int(h[i:i+2],16)/255) for i in (0,2,4)];bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.72;obj.data.materials.append(mat)
 if rec.get('water'):
  uv=mesh.uv_layers.new(name='Canal metres')
  for poly in mesh.polygons:
   for li in poly.loop_indices:
    vi=mesh.loops[li].vertex_index;uv.data[li].uv=rec['uvs'][vi*2:vi*2+2]
  tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=.45;tex.inputs['Detail'].default_value=2;tex.inputs['Roughness'].default_value=.45
  coord=n.new('ShaderNodeTexCoord');mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(1.8,.33,1);links.new(coord.outputs['Object'],mapping.inputs[0]);links.new(mapping.outputs[0],tex.inputs['Vector'])
  ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.24;ramp.color_ramp.elements[0].color=(.008,.22,.48,1);ramp.color_ramp.elements[1].position=.8;ramp.color_ramp.elements[1].color=(.18,.86,.93,1);links.new(tex.outputs['Fac'],ramp.inputs[0]);links.new(ramp.outputs[0],bs.inputs['Base Color'])
  bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.11;links.new(tex.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs[0],bs.inputs['Normal']);bs.inputs['Roughness'].default_value=.24;bs.inputs['Metallic'].default_value=.0;bs.inputs['Specular IOR Level'].default_value=.2
 if 'cloud' in rec['name'].lower():
  for face in mesh.polygons:face.use_smooth=True
world=bpy.data.worlds.new('Bright blue atmosphere');bpy.context.scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.08,.35,.8,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5
bpy.ops.object.light_add(type='SUN',location=(0,0,60));sun=bpy.context.object;sun.rotation_euler=(math.radians(27),math.radians(-24),math.radians(-35));sun.data.energy=2.1;sun.data.angle=.12
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=64;scene.cycles.use_denoising=False;scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard';scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.lens=36/(2*math.tan(math.radians(56)/2)*(16/9));cam.data.sensor_width=36;scene.camera=cam
os.makedirs(output,exist_ok=True)
for c in data['cameras']:
 cam.location=xyz(c['position']);direction=Vector(xyz(c['target']))-cam.location;cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler();scene.render.filepath=os.path.join(output,c['name']+'.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(output,'waterpark-study.blend'))
