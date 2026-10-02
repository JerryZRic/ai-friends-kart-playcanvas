"""Neon Kart: original Blender-native arcade racer.
Run: blender -b --python build_models.py
Blender scene is Z-up / -Y forward; exported GLB is Y-up / +Z forward.
All dimensions are meters-ish game units. Body and Helmet are recolorable.
"""
import bpy, math, json, os
from mathutils import Vector
from math import sin, cos, pi
OUT = os.path.dirname(os.path.abspath(__file__))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.materials): bpy.data.materials.remove(block)
model = bpy.data.collections.new('NEON KART • export'); bpy.context.scene.collection.children.link(model)
studio = bpy.data.collections.new('STUDIO • excluded from GLB'); bpy.context.scene.collection.children.link(studio)
root = bpy.data.objects.new('NeonKart', None); model.objects.link(root)
root['forward_blender'] = '-Y'; root['forward_glb'] = '+Z'; root['recolor_materials'] = 'Body, Helmet'
root['design'] = 'Original low-poly arcade kart. Procedural authoring in Blender 4.3.2.'

def mat(name, color, metallic=0, rough=.4, emission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Metallic'].default_value=metallic; p.inputs['Roughness'].default_value=rough
    if emission: p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emission
    return m
M={
 'Body':mat('Body',(.60,.98,.035),.25,.27),
 'Accent':mat('Accent',(1,.17,.19),.25,.29),
 'Rubber':mat('Rubber',(.018,.024,.039),.0,.75),
 'TireDetail':mat('TireDetail',(.033,.043,.060),.08,.52),
 'Metal':mat('Metal',(.52,.61,.73),.82,.24),
 'DarkMetal':mat('DarkMetal',(.073,.097,.15),.72,.34),
 'Helmet':mat('Helmet',(.9,.96,1),.30,.22),
 'Visor':mat('Visor',(.015,.045,.071),.65,.15),
 'VisorGlint':mat('VisorGlint',(.13,.8,.95),.6,.22,.25),
 'Suit':mat('Suit',(.12,.18,.25),.05,.64),
 'SuitAccent':mat('SuitAccent',(1,.24,.22),.10,.47),
 'Light':mat('Light',(.32,1,.86),.15,.25,2),
 'Number':mat('Number',(.025,.044,.070),.1,.42),
 'Seat':mat('Seat',(.052,.061,.083),.05,.73),
}

def place(o, name, material=None, parent=root):
    o.name=name
    for c in list(o.users_collection): c.objects.unlink(o)
    model.objects.link(o); o.parent=parent
    if material: o.data.materials.append(M[material])
    return o

def bevel(o, width=.035, segments=2):
    mod=o.modifiers.new('Machined soft edges','BEVEL'); mod.width=width; mod.segments=segments
    mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL'); mod.keep_sharp=True; mod.weight=50
    return o

def box(name, loc, scale, material, radius=.025, rot=None, parent=root):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=place(bpy.context.object,name,material,parent)
    o.dimensions=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rot:o.rotation_euler=rot
    if radius:bevel(o,radius,2)
    return o

def uv(name,loc,scale,material,segments=20,rings=12,parent=root):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=loc)
    o=place(bpy.context.object,name,material,parent);o.scale=scale
    for p in o.data.polygons:p.use_smooth=True
    return o

def cylinder(name,loc,radius,depth,material,axis='Z',vertices=20,parent=root):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    o=place(bpy.context.object,name,material,parent)
    if axis=='X':o.rotation_euler[1]=pi/2
    if axis=='Y':o.rotation_euler[0]=pi/2
    bevel(o,.012,2)
    for p in o.data.polygons:p.use_smooth=True
    return o

def bar(name,a,b,r,material,vertices=12,parent=root):
    a,b=Vector(a),Vector(b);d=b-a;o=cylinder(name,(a+b)/2,r,d.length,material,vertices=vertices,parent=parent)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o

def mesh(name,verts,faces,material,parent=root):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);model.objects.link(o);o.parent=parent;o.data.materials.append(M[material]);return o

def prism(name,outline,z0,z1,material,rad=.035):
    if sum(outline[i][0]*outline[(i+1)%len(outline)][1]-outline[(i+1)%len(outline)][0]*outline[i][1] for i in range(len(outline)))<0: outline=list(reversed(outline))
    n=len(outline);vs=[(x,y,z) for z in (z0,z1) for x,y in outline]
    fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)]
    return bevel(mesh(name,vs,fs,material),rad,2)

def torus(name,loc,major,minor,material,axis='Z',parent=root):
    bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=8,location=loc,major_radius=major,minor_radius=minor)
    o=place(bpy.context.object,name,material,parent)
    if axis=='X':o.rotation_euler[1]=pi/2
    if axis=='Y':o.rotation_euler[0]=pi/2
    for p in o.data.polygons:p.use_smooth=True
    return o

# Low, angular monocoque with a sculpted nose and floating aerodynamic rails.
prism('Chassis tub',[(-.56,-1.3),(.56,-1.3),(.72,-.82),(.69,1.17),(-.69,1.17),(-.72,-.82)],.23,.47,'DarkMetal',.06)
prism('Lower lime sill',[(-.55,-1.38),(.55,-1.38),(.75,-.73),(.75,.93),(.5,1.3),(-.5,1.3),(-.75,.93),(-.75,-.73)],.34,.51,'Body',.05)
# A wedge, rather than a cuboid, gives the recognizable kart front.
verts=[(-.35,-1.64,.38),(.35,-1.64,.38),(.57,-.63,.38),(-.57,-.63,.38),(-.28,-1.56,.63),(.28,-1.56,.63),(.46,-.62,.79),(-.46,-.62,.79)]
bevel(mesh('Sculpted nose cone',verts,[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],'Body'),.045,3)
box('Nose inset stripe',(0,-1.15,.707),(.135,.83,.019),'Accent',.01,rot=(.17,0,0))
box('Front splitter',(0,-1.52,.32),(1.62,.32,.12),'DarkMetal',.04)
for s in (-1,1):
    box('Splitter tip',(.68*s,-1.54,.38),(.17,.36,.18),'Accent',.03)
    box('Nose running light',(.295*s,-1.587,.57),(.18,.023,.045),'Light',.012,rot=(0,0,-s*.13))
    prism('Sculpted side pod',[(.52*s,-.56),(.86*s,-.38),(.84*s,.83),(.48*s,1.10)],.47,.70,'Body',.055)
    box('Pod accent blade',(.814*s,.25,.55),(.041,1.01,.07),'Accent',.015)
    for j in range(3): box('Side cooling louvre',(.832*s,.28+j*.16,.68),(.025,.085,.08),'DarkMetal',.01,rot=(0,s*.22,0))
    bar('Side crash rail',(.88*s,-.7,.31),(.88*s,.97,.31),.039,'Metal')
    bar('Chassis front brace',(.32*s,-1.01,.32),(.87*s,-1.01,.42),.036,'DarkMetal')
# Seat shell, cushion and roll bar.
box('Seat base',(0,.33,.64),(.68,.73,.17),'Seat',.09)
box('Seat back',(0,.77,.96),(.73,.16,.73),'DarkMetal',.11,rot=(-.14,0,0))
box('Seat inner cushion',(0,.654,1.00),(.58,.095,.59),'Seat',.06,rot=(-.14,0,0))
for s in (-1,1):
    bar('Roll hoop upright',(.39*s,.83,.62),(.39*s,.85,1.37),.043,'DarkMetal')
bar('Roll hoop upper',(-.39,.85,1.37),(.39,.85,1.37),.043,'DarkMetal')

# Four individually transformable wheel assemblies. True rounded tire cross sections.
def wheel(name,x,y):
    pivot=bpy.data.objects.new(name,None);model.objects.link(pivot);pivot.parent=root;pivot.location=(x,y,.435)
    # locals generated at origin, wheel axle local X
    profile=[(-.145,.195),(-.172,.25),(-.18,.33),(-.16,.405),(-.115,.43),(.115,.43),(.16,.405),(.18,.33),(.172,.25),(.145,.195)]
    n=28; vs=[(u,r*cos(2*pi*i/n),r*sin(2*pi*i/n))for u,r in profile for i in range(n)]
    fs=[]
    for j in range(len(profile)):
        for i in range(n): fs.append((j*n+i,j*n+(i+1)%n,((j+1)%len(profile))*n+(i+1)%n,((j+1)%len(profile))*n+i))
    o=mesh(name+' tire',vs,fs,'Rubber',pivot)
    for p in o.data.polygons:p.use_smooth=True
    # Narrow tread lines, cast into each shoulder.
    for xx in (-.097,.097):torus(name+' tread band',(xx,0,0),.429,.006,'TireDetail','X',pivot)
    sign=-1 if x<0 else 1; outer=sign*.176
    torus(name+' sidewall',(outer,0,0),.32,.011,'TireDetail','X',pivot)
    cylinder(name+' rim barrel',(0,0,0),.219,.295,'DarkMetal','X',24,pivot)
    cylinder(name+' brake rotor',(outer,0,0),.172,.022,'Metal','X',24,pivot)
    torus(name+' alloy rim',(outer+sign*.008,0,0),.208,.022,'Metal','X',pivot)
    for j in range(5):
        a=2*pi*j/5; bar(name+' alloy spoke',(outer+sign*.019,.05*cos(a),.05*sin(a)),(outer+sign*.019,.185*cos(a+.17),.185*sin(a+.17)),.025,'Metal',8,pivot)
    cylinder(name+' center cap',(outer+sign*.033,0,0),.075,.028,'Accent','X',12,pivot)
    cylinder(name+' axle nut',(outer+sign*.052,0,0),.031,.03,'DarkMetal','X',6,pivot)
for name,x,y in [('Wheel_FL',-.98,-1.02),('Wheel_FR',.98,-1.02),('Wheel_RL',-.98,.99),('Wheel_RR',.98,.99)]:wheel(name,x,y)
for yy in (-1.02,.99):bar('Axle',(-.98,yy,.435),(.98,yy,.435),.055,'Metal')

# Rear engine, heat fins, twin exposed pipes and a broad racing spoiler.
box('Engine block',(0,1.06,.73),(.65,.49,.39),'DarkMetal',.055)
for i in range(5):box('Engine cooling fin',(0,.89+i*.078,.895),(.65,.029,.075),'Metal',.008)
for s in (-1,1):
    bar('Spoiler upright',(.54*s,1.15,.66),(.54*s,1.43,1.21),.041,'DarkMetal')
box('Rear aero wing',(0,1.40,1.25),(1.85,.41,.11),'Body',.04,rot=(-.08,0,0))
box('Wing accent stripe',(0,1.59,1.273),(1.71,.06,.07),'Accent',.017)
for s in (-1,1): box('Wing endplate',(.927*s,1.40,1.27),(.07,.51,.30),'DarkMetal',.028)
for s in (-1,1):
    bar('Bent exhaust inlet',(.32*s,1.07,.58),(.48*s,1.40,.53),.072,'DarkMetal')
    cylinder('Exhaust barrel',(.48*s,1.47,.56),.11,.42,'Metal','Y',20)
    cylinder('Exhaust black opening',(.48*s,1.688,.56),.080,.009,'Rubber','Y',20)
    torus('Exhaust lip',(.48*s,1.698,.56),.092,.010,'Metal','Y')
box('Rear brake lamp',(0,1.315,.72),(.22,.04,.07),'Accent',.015)

# Stylized seated driver with bent arms and knees.
uv('Driver hips',(0,.29,.86),(.27,.29,.19),'Suit')
uv('Driver torso',(0,.30,1.16),(.285,.21,.36),'Suit',20,12)
box('Suit chest panel',(0,.106,1.17),(.32,.045,.37),'SuitAccent',.06,rot=(-.1,0,0))
for s in (-1,1):
    bar('Harness shoulder',(.12*s,.112,1.42),(.13*s,.075,1.10),.024,'Metal')
    # tucked legs towards the pedals
    bar('Driver thigh',(.17*s,.30,.89),(.25*s,-.19,.75),.117,'Suit',16)
    uv('Driver knee',(.25*s,-.19,.76),(.13,.14,.13),'SuitAccent',16,8)
    bar('Driver shin',(.25*s,-.23,.73),(.28*s,-.58,.59),.09,'Suit',16)
    box('Driver boot',(.28*s,-.68,.55),(.20,.32,.16),'Rubber',.055)
    # Arm points lead naturally to the tilted steering rim.
    uv('Driver shoulder',(.27*s,.25,1.33),(.115,.135,.13),'SuitAccent',16,8)
    bar('Driver upper arm',(.28*s,.22,1.31),(.38*s,-.02,1.14),.09,'Suit',16)
    uv('Driver elbow',(.38*s,-.02,1.14),(.09,.10,.09),'SuitAccent',16,8)
    bar('Driver forearm',(.38*s,-.02,1.14),(.25*s,-.32,1.12),.076,'Suit',16)
    uv('Driver glove',(.25*s,-.32,1.12),(.095,.091,.081),'Rubber',16,8)
# Steering wheel placed on a inclined plane normal to its shaft.
bar('Steering shaft',(0,-.69,.61),(0,-.30,1.10),.032,'Metal')
steer=torus('Steering wheel',(0,-.30,1.105),.245,.026,'Rubber');steer.rotation_euler[0]=math.radians(43)
for a in (0,2*pi/3,4*pi/3):
    end=Vector((.225*cos(a),.225*sin(a),0));end.rotate(steer.rotation_euler.to_matrix());bar('Steering spoke',(0,-.30,1.105),Vector((0,-.30,1.105))+end,.017,'Metal',8)
uv('Steering hub',(0,-.30,1.11),(.061,.045,.042),'Accent',12,8)
# Full-face helmet: pale shell, dark curved inset visor and chin guard.
uv('Helmet shell',(0,.24,1.76),(.36,.33,.355),'Helmet',24,16)
# visor patch wraps smoothly around the forward -Y hemisphere
vs=[];nu=24;nv=7
for j in range(nv+1):
    elev=-.10+j/nv*.60
    for i in range(nu+1):
        a=-1.29+i/nu*2.58
        vs.append((.367*cos(elev)*sin(a),.24-.339*cos(elev)*cos(a),1.76+.361*sin(elev)))
fs=[(j*(nu+1)+i,j*(nu+1)+i+1,(j+1)*(nu+1)+i+1,(j+1)*(nu+1)+i)for j in range(nv)for i in range(nu)]
visor=mesh('Curved dark visor',vs,fs,'Visor')
for p in visor.data.polygons:p.use_smooth=True
# Thin turquoise glass highlight along upper left lens.
pts=[]
for i in range(11):
    a=-.93+i/10*.94;e=.40;pts.append((.371*cos(e)*sin(a),.24-.343*cos(e)*cos(a),1.76+.363*sin(e)))
for i in range(len(pts)-1):bar('Visor reflection',pts[i],pts[i+1],.006,'VisorGlint',6)
for s in (-1,1):cylinder('Helmet visor hinge',(.343*s,.203,1.805),.051,.023,'DarkMetal','X',16)
# Chin rim and air vents add readable full-face helmet details.
uv('Helmet chin guard',(0,.012,1.598),(.275,.142,.12),'Helmet',20,10)
box('Helmet chin vent',(0,-.127,1.615),(.18,.028,.037),'DarkMetal',.01)
# central race stripe follows the top curvature
vs=[]
for j in range(17):
    a=-.20+j/16*2.83
    for x in (-.047,.047): vs.append((x,.24-.334*cos(a),1.76+.361*sin(a)))
fs=[(2*j,2*j+1,2*j+3,2*j+2)for j in range(16)]
mesh('Helmet coral stripe',vs,fs,'Accent')
# race number on front wedge, raised tiny geometry, legible in hero view
bpy.ops.object.text_add(location=(0,-1.19,.725),rotation=(.17,0,0));o=place(bpy.context.object,'Nose race number 07','Number');o.data.body='07';o.data.align_x='CENTER';o.data.size=.25;o.data.extrude=.0008;o.rotation_euler=(.17,0,0)
# text sits in XY plane with glyph tops toward back; visually an actual decal on wedge
bpy.ops.object.convert(target='MESH')

# Save and export only the actual kart, with modifiers baked for browsers.
bpy.context.view_layer.update()
allcoords=[]
depsgraph=bpy.context.evaluated_depsgraph_get()
for o in model.objects:
    if o.type=='MESH':
        ev=o.evaluated_get(depsgraph);allcoords += [ev.matrix_world@Vector(c) for c in ev.bound_box]
mins=[min(v[i] for v in allcoords)for i in range(3)];maxs=[max(v[i] for v in allcoords)for i in range(3)]
metadata={'name':'Neon Kart','source':'Original model authored in Blender 4.3.2','forward_blender':'-Y','up_blender':'+Z','forward_glb':'+Z','up_glb':'+Y','bounds_blender':{'min':mins,'max':maxs},'dimensions_blender':[maxs[i]-mins[i]for i in range(3)],'recolor_materials':['Body','Helmet'],'wheel_nodes':['Wheel_FL','Wheel_FR','Wheel_RL','Wheel_RR'],'wheel_axle_glb':'+X','ground_blender_z':0,'mesh_objects':sum(o.type=='MESH' for o in model.objects)}
with open(os.path.join(OUT,'model_metadata.json'),'w') as f:json.dump(metadata,f,indent=2)
# Batch compatible meshes to reduce draw calls while retaining wheel pivots.
# The authored scene stays fully editable; only these temporary copies are joined.
export_collection=bpy.data.collections.new('TEMP optimized export');bpy.context.scene.collection.children.link(export_collection)
export_root=bpy.data.objects.new('Kart',None);export_collection.objects.link(export_root)
export_root['forward']='+Z in GLB';export_root['body_material']='Body';export_root['helmet_material']='Helmet'
parents={root.name:export_root}
for o in model.objects:
    if o.type=='EMPTY' and o!=root:
        q=bpy.data.objects.new(o.name+'_pivot',None);export_collection.objects.link(q);q.parent=export_root;q.matrix_world=o.matrix_world.copy();parents[o.name]=q
batches={}
for o in model.objects:
    if o.type!='MESH':continue
    ev=o.evaluated_get(depsgraph);me=bpy.data.meshes.new_from_object(ev,preserve_all_data_layers=True,depsgraph=depsgraph)
    q=bpy.data.objects.new(o.name+'_export',me);export_collection.objects.link(q)
    q.matrix_world=o.matrix_world.copy();key=(o.parent.name,o.data.materials[0].name);batches.setdefault(key,[]).append(q)
for (parent_name,material_name),objects in batches.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=parent_name+'_'+material_name
    world=o.matrix_world.copy();o.parent=parents[parent_name];o.matrix_world=world
metadata['export_mesh_batches']=len(batches)
metadata['wheel_nodes_blender']=metadata['wheel_nodes']
metadata['wheel_nodes']=[n+'_pivot' for n in metadata['wheel_nodes']]
bpy.ops.object.select_all(action='DESELECT')
for o in export_collection.objects:o.select_set(True)
bpy.context.view_layer.objects.active=export_root
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'kart.glb'),export_format='GLB',use_selection=True,export_apply=True,export_cameras=False,export_lights=False,export_animations=False,export_yup=True,export_extras=True)
for o in list(export_collection.objects):bpy.data.objects.remove(o,do_unlink=True)
bpy.data.collections.remove(export_collection)
with open(os.path.join(OUT,'model_metadata.json'),'w') as f:json.dump(metadata,f,indent=2)

# A soft studio floor and three colored area lights are kept in .blend, not exported.
def stage(o):
    for c in list(o.users_collection):c.objects.unlink(o)
    studio.objects.link(o)
    return o
floor=mat('Studio floor',(.024,.033,.061),.25,.52)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.012));o=stage(bpy.context.object);o.name='Studio floor';o.data.materials.append(floor)
def area(name,loc,power,color,size):
    bpy.ops.object.light_add(type='AREA',location=loc);o=stage(bpy.context.object);o.name=name;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,.6))-o.location).to_track_quat('-Z','Y').to_euler()
area('Key softbox',(-3,-4,6),1000,(.83,.94,1),5)
area('Warm fill',(4,-1,3),750,(1,.43,.32),4)
area('Blue rim',(1,4,5),1300,(.25,.54,1),3)
area('Front eye light',(0,-5,2),200,(.63,.88,1),2)
bpy.ops.object.camera_add(location=(5.1,-6.6,4.1));cam=stage(bpy.context.object);cam.name='Hero camera';cam.rotation_euler=(Vector((0,0,.91))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=4.85;bpy.context.scene.camera=cam
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=96;scene.cycles.use_denoising=False
scene.render.resolution_x=1400;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.world.color=(.08,.08,.08);scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.07,.10,.19,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(OUT,'kart_preview.png')
# Store an intuitive modeling viewport.
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':a.spaces.active.region_3d.view_distance=5.5;a.spaces.active.region_3d.view_location=(0,0,.8)
bpy.ops.object.select_all(action='DESELECT');root.select_set(True);bpy.context.view_layer.objects.active=root
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'kart.blend'))
bpy.ops.render.render(write_still=True)
print('NEON_KART_METADATA',json.dumps(metadata))
