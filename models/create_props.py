"""Original NEON KART island props, modeled in Blender 4.3.2.
Rebuild: blender -b --python create_props.py
Outputs: props.blend, palm.glb, rock.glb, arch.glb, props-preview.png,
         asset-manifest.json. All geometry/materials are original; no textures.
Blender source coordinates are Z-up; GLB uses standard glTF Y-up.
"""
import bpy, math, random, json
from mathutils import Vector
from pathlib import Path

OUT = Path(__file__).resolve().parent
random.seed(47)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.materials):
    bpy.data.materials.remove(block)

# Colors supplied in linear-space-friendly art palette.
def mat(name, color, rough=.55, metallic=0, emission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1)
    m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=metallic
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1)
        p.inputs['Emission Strength'].default_value=emission
    return m

bark=mat('Palm · sun-warmed terracotta bark',(0.43,.19,.09))
bark_light=mat('Palm · honey bark facets',(.67,.34,.13))
bark_dark=mat('Palm · ring shadows',(.27,.10,.045))
leaf=mat('Palm · jade canopy',(.038,.40,.22))
leaf_light=mat('Palm · sunlit mint canopy',(.14,.63,.33))
leaf_dark=mat('Palm · deep teal canopy',(.025,.25,.20))
coconut=mat('Palm · coconut shells',(.24,.10,.052))
sandstone=mat('Rock · peach sandstone',(.60,.37,.22))
sandstone_light=mat('Rock · golden facets',(.79,.55,.34))
sandstone_dark=mat('Rock · shaded ochre',(.44,.25,.15))
navy=mat('Gantry · midnight enamel',(.018,.029,.065),.33,.2)
navy_light=mat('Gantry · blue steel panels',(.045,.075,.13),.38,.36)
coral=mat('Gantry · coral enamel',(.95,.17,.105),.32,.15,.15)
cyan=mat('Gantry · cyan running lights',(.06,.79,.89),.25,.1,1.8)
cream=mat('Gantry · warm ivory lettering',(.95,.88,.65),.36,.12,.3)


def collection(name):
    c=bpy.data.collections.new(name); bpy.context.scene.collection.children.link(c)
    return c

def into(obj,c):
    for old in list(obj.users_collection): old.objects.unlink(obj)
    c.objects.link(obj)
    return obj

def mesh_obj(name,verts,faces,c,mats,indices=None):
    me=bpy.data.meshes.new(name+' geometry'); me.from_pydata(verts,[],faces); me.update()
    o=bpy.data.objects.new(name,me); c.objects.link(o)
    for m in mats: me.materials.append(m)
    if indices:
        for p,idx in zip(me.polygons,indices):p.material_index=idx
    return o

def cube(name,loc,scale,c,material,bevel=.06):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object; o.name=name; o.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    into(o,c);o.data.materials.append(material)
    if bevel:
        m=o.modifiers.new('Soft manufactured bevels','BEVEL');m.width=bevel;m.segments=2
        m.affect='EDGES'
        m=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');m.keep_sharp=True
    return o

# PALM: handcrafted curved ring trunk, eight angular ribbed fronds.
palm=collection('ASSET · palm')
verts=[];faces=[];ids=[];sides=10;levels=16
for j in range(levels):
    t=j/(levels-1); z=t*6.72
    center=Vector((1.05*t*t-.19*math.sin(t*math.pi),.14*math.sin(t*math.pi),z))
    # alternating ring taper gives subtle natural band relief without extra objects.
    radius=(.49*(1-t)+.205*t)*(1+(.042 if j%2 else -.02))
    for i in range(sides):
        a=2*math.pi*i/sides
        verts.append(tuple(center+Vector((math.cos(a)*radius, math.sin(a)*radius,0))))
for j in range(levels-1):
    for i in range(sides):
        faces.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
        ids.append(2 if j%5==0 else (1 if i in (1,2,3,4) else 0))
faces.extend([tuple(reversed(range(sides))),tuple((levels-1)*sides+i for i in range(sides))]);ids.extend([0,1])
mesh_obj('Curved tapered ten-sided trunk',verts,faces,palm,[bark,bark_light,bark_dark],ids)

crown=Vector((1.05,0,6.7))
# Each blade has a lifted center rib, pointed faceted edges and a closed underside.
for k in range(8):
    angle=2*math.pi*k/8 + .10
    d=Vector((math.cos(angle),math.sin(angle),0)); side=Vector((-d.y,d.x,0))
    length=[3.5,3.9,3.3,3.75,4.05,3.55,3.8,3.5][k]
    rise=[1.22,1.0,1.4,1.12,1.32,1.18,1.3,1.5][k]
    droop=[1.38,1.58,1.3,1.54,1.5,1.7,1.45,1.38][k]
    steps=11;vv=[];ff=[];mi=[]
    for j in range(steps):
        t=j/(steps-1)
        pos=crown+d*(length*t)+Vector((0,0,rise*math.sin(math.pi*t)-droop*t*t))
        width=(math.sin(math.pi*t)**.76)*(.68+.09*(k%3))
        if j%2:width*=.79
        ridge=.14*math.sin(math.pi*t)
        # left, ridge, right, underside left/ridge/right
        for v in [pos-side*width,pos+Vector((0,0,ridge)),pos+side*width,
                  pos-side*width-Vector((0,0,.045)),pos-Vector((0,0,.045)),pos+side*width-Vector((0,0,.045))]:
            vv.append(tuple(v))
    for j in range(steps-1):
        a=j*6;b=(j+1)*6
        ff += [(a,b,b+1,a+1),(a+1,b+1,b+2,a+2),
               (a+3,a+4,b+4,b+3),(a+4,a+5,b+5,b+4),
               (a,a+3,b+3,b),(a+2,b+2,b+5,a+5)]
        mi += [1 if k%2==0 else 0,0,2,2,0,0]
    ff += [(0,1,2,5,4,3),tuple((steps-1)*6+i for i in (0,3,4,5,2,1))];mi += [0,0]
    mesh_obj('Broad angular frond %02d'%(k+1),vv,ff,palm,[leaf,leaf_light,leaf_dark],mi)
for k,loc in enumerate([(1.02,-.28,6.39),(.70,.1,6.46),(1.25,.15,6.3)]):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.29,location=loc)
    o=bpy.context.object;o.name='Coconut %02d'%(k+1);o.scale=(1,.92,1.15);o.data.materials.append(coconut);into(o,palm)

# ROCK: compact asymmetric cluster, flattened ground contact and flat facet normals.
rock=collection('ASSET · rock')
for k,(loc,sc) in enumerate([((-.45,.15,1.05),(2.2,1.55,1.9)),((1.95,.25,.57),(1.35,1.2,1.12)),((-2.12,-.32,.43),(1.03,.99,.83)),((.58,-1.0,.2),(1.05,.72,.48))]):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=loc)
    o=bpy.context.object;o.name='Sandstone boulder %02d'%(k+1);into(o,rock)
    for m in [sandstone,sandstone_light,sandstone_dark]:o.data.materials.append(m)
    for v in o.data.vertices:
        noise=random.uniform(.84,1.12)
        v.co.x*=sc[0]*noise;v.co.y*=sc[1]*noise;v.co.z*=sc[2]*noise
        v.co.z=max(-loc[2],v.co.z)
    o.rotation_euler.z=[.23,-.5,.34,-.2][k]
    o.data.update()
    for p in o.data.polygons:
        p.material_index=1 if p.normal.z>.45 else (2 if p.normal.y>.35 else 0)

# GANTRY: 18m clear span, beam underside at 7m, feet stay outside clear opening.
arch=collection('ASSET · start gantry')
for side_sign,side_name in [(-1,'left'),(1,'right')]:
    x=side_sign*9.75
    cube(side_name+' structural tower',(x,0,3.5),(1.5,1.55,7),arch,navy,.13)
    cube(side_name+' outward base shoe',(side_sign*9.95,0,.26),(1.9,2.1,.52),arch,navy_light,.10)
    cube(side_name+' coral lower armor',(x,-.82,1.82),(1.31,.13,2.32),arch,coral,.055)
    cube(side_name+' cyan light channel',(x+side_sign*.41,-.815,4.6),(.135,.09,3.7),arch,cyan,.028)
    cube(side_name+' ivory tower mark',(x-side_sign*.28,-.84,4.4),(.48,.08,.12),arch,cream,.02)
    for z in (2.5,2.86,3.22):
        o=cube(side_name+' diagonal warning slash '+str(z),(x-.07,-.835,z),(.58,.055,.13),arch,cream,.01)
        o.rotation_euler.y=side_sign*-.42
cube('Main spanning top beam',(0,0,7.6),(21,1.7,1.2),arch,navy,.16)
cube('Coral crown rail',(0,0,8.21),(21.15,1.8,.23),arch,coral,.065)
cube('Blue face inset',(0,-.875,7.57),(18.8,.08,.78),arch,navy_light,.10)
cube('Cyan lower edge',(0,-.91,7.11),(18.4,.09,.10),arch,cyan,.025)
# Warm checkered enamel on both ends of the front panel.
for sign in [-1,1]:
    for col in range(5):
        for row in range(2):
            if (col+row)%2==0:
                cube('Ivory checker %s %s %s'%(sign,col,row),(sign*(6.0+col*.51),-.95,7.36+row*.35),(.48,.055,.33),arch,cream,.009)
# Native Blender font converted to editable mesh on both sides; no font dependency.
for front in [True,False]:
    bpy.ops.object.text_add(location=(0,-.969 if front else .871,7.24))
    o=bpy.context.object;o.name='START · front lettering' if front else 'START · rear lettering';into(o,arch)
    o.data.body='START';o.data.align_x='CENTER';o.data.size=.79;o.data.space_character=1.25
    o.data.extrude=.012;o.data.resolution_u=3;o.data.bevel_depth=.006;o.data.bevel_resolution=0
    o.rotation_euler=(math.pi/2,0,0 if front else math.pi)
    o.data.materials.append(cream)
    bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')

# Export one origin-centered joined mesh per GLB to keep scene-graph/draw-call overhead low.
# Source modeling objects are kept separate and editable in props.blend.
manifest={'authoring_tool':bpy.app.version_string,'style':'Original low-poly tropical synthwave island racing props','coordinates':'GLB Y-up; source Z-up; origin at ground center','textures':0,'assets':{}}
for name,col in [('palm',palm),('rock',rock),('arch',arch)]:
    originals=list(col.objects);copies=[]
    for obj in originals:
        cp=obj.copy();cp.data=obj.data.copy();bpy.context.scene.collection.objects.link(cp);copies.append(cp)
    bpy.ops.object.select_all(action='DESELECT')
    for o in copies:o.select_set(True)
    bpy.context.view_layer.objects.active=copies[0]
    # Apply bevel and normals before merging.
    for o in copies:
        bpy.context.view_layer.objects.active=o
        for mod in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join()
    joined=bpy.context.object;joined.name=name
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    # Consolidate duplicate slots from source components.
    oldmats=list(joined.data.materials);uniq=[];remap={}
    for i,m in enumerate(oldmats):
        if m not in uniq:uniq.append(m)
        remap[i]=uniq.index(m)
    oldindices=[p.material_index for p in joined.data.polygons]
    joined.data.materials.clear()
    for m in uniq:joined.data.materials.append(m)
    for p,i in zip(joined.data.polygons,oldindices):p.material_index=remap[i]
    # Repeated scenery exports use a single draw call, preserving source palettes
    # as glTF vertex colors. Source objects retain descriptive named materials.
    if name in ('palm','rock'):
        attr=joined.data.color_attributes.new(name='Palette',type='FLOAT_COLOR',domain='CORNER')
        for poly in joined.data.polygons:
            color=tuple(joined.data.materials[poly.material_index].diffuse_color)
            for li in poly.loop_indices:attr.data[li].color=color
        palette=mat(name.title()+' · vertex-painted original palette',(1,1,1),.57)
        nodes=palette.node_tree.nodes;vcol=nodes.new('ShaderNodeVertexColor');vcol.layer_name='Palette'
        palette.node_tree.links.new(vcol.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])
        joined.data.materials.clear();joined.data.materials.append(palette)
        for poly in joined.data.polygons:poly.material_index=0
        uniq=[palette]
    joined.data.calc_loop_triangles()
    coords=[joined.matrix_world @ Vector(c) for c in joined.bound_box]
    bounds=[[round(min(v[i] for v in coords),3),round(max(v[i] for v in coords),3)] for i in range(3)]
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True,export_texcoords=False)
    manifest['assets'][name]={'file':name+'.glb','bytes':(OUT/(name+'.glb')).stat().st_size,'triangles':len(joined.data.loop_triangles),'materials':len(uniq),'source_bounds_xyz':bounds,'root_origin':[0,0,0]}
    bpy.data.objects.remove(joined,do_unlink=True)

# Editable source arranged for immediate visual inspection, with named ground-root empties.
for name,col,offset in [('palm',palm,(-14,-1,0)),('rock',rock,(12,-1,0)),('arch',arch,(0,3,0))]:
    root=bpy.data.objects.new(name.upper()+' · ground origin',None);col.objects.link(root)
    root.empty_display_type='PLAIN_AXES';root.empty_display_size=1
    for o in list(col.objects):
        if o!=root:o.parent=root
    root.location=offset

stage=collection('PREVIEW ONLY · camera lights floor')
floor_mat=mat('Preview · dusty lavender',(.14,.095,.18),.82)
cube('Preview floor',(0,0,-.15),(200,200,.24),stage,floor_mat,.0)
world=bpy.context.scene.world
world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.27,.32,.45,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.5

def light(name,typ,loc,power,color,size):
    data=bpy.data.lights.new(name,typ);data.energy=power;data.color=color
    if typ=='AREA':data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);stage.objects.link(obj);obj.location=loc
    obj.rotation_euler=(Vector((0,0,3))-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj
light('Golden hour key','AREA',(-12,-14,22),2600,(1,.73,.44),14)
light('Cool ocean fill','AREA',(12,-6,14),1900,(.43,.79,1),12)
light('Pink rim','AREA',(0,11,16),3200,(1,.29,.26),10)
sun=light('Late afternoon sun','SUN',(-20,-30,40),2.0,(1,.79,.54),1);sun.data.angle=.25
cam_data=bpy.data.cameras.new('Asset showcase camera');cam=bpy.data.objects.new('Asset showcase camera',cam_data);stage.objects.link(cam)
cam.location=(23,-39,23);target=Vector((-1,1,3.4));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
cam_data.type='ORTHO';cam_data.ortho_scale=39
scene=bpy.context.scene;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=64
scene.cycles.use_denoising=False
scene.render.resolution_x=1400;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'props-preview.png')
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
# Make source open on the clean camera composition.
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
scene['asset_notes']='Each ASSET collection has a ground-pivot root. GLBs are exported before showcase arrangement. Render stage is never exported. Rebuild with create_props.py.'
(OUT/'asset-manifest.json').write_text(json.dumps(manifest,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'props.blend'))
bpy.ops.render.render(write_still=True)
print('ASSET_BUILD_COMPLETE',json.dumps(manifest))
