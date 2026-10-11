"""Selected original Alpine Campsite authoring source, derived from generate.py.
Only the ridge picnic table and ranger relief-map station are authored here.
Original helper/geometry expressions are retained; unused prop definitions,
collection layout, lighting, cameras and renders have been excluded.
Run with Blender 4.3.2: blender -b -t 1 --python source/generate-selected.py
See ../README.md and ../../../ALPINE-PROP-NOTICE.txt for provenance and adaptation.
"""
import bpy, math, json, os
from math import sin, cos, pi
from mathutils import Vector
OUT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(os.path.join(OUT,'glb'),exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for d in bpy.data.materials: bpy.data.materials.remove(d)
scene=bpy.context.scene; scene.unit_settings.system='METRIC'; scene.unit_settings.scale_length=1
M={};parts=[];assets=[]
def material(n,h,rough=.68,metal=0,emission=0):
 c=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in [int(h[i:i+2],16)/255 for i in (0,2,4)])
 m=bpy.data.materials.new('Alpine_'+n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 if emission:p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=emission
 M[n]=m
for a in [('pine','285E52'),('sage','7FA88A'),('cream','F3E9CB'),('gold','DFA84E'),('coral','D97862'),('cedar','A8714B'),('bark','55483A'),('slate','7B8C85'),('charcoal','263C3B'),('leaf','5B8965'),('water','72A9AA')]: material(*a)
material('brass','CEAA62',.38,.65); material('ember','FFB84C',.55,0,.55); material('glow','FFE1A0',.45,0,.25)
def done(o,m):o.data.materials.append(M[m]);parts.append(o);return o
def bevel(o,w=.03,seg=2):
 if w:
  bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Rounded crafted edges','BEVEL');mod.width=w;mod.segments=seg;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def box(p,s,m,b=.03,rot=(0,0,0)):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p,rotation=rot);o=bpy.context.object;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);bevel(o,b);return done(o,m)
def cyl(p,r,d,m,n=20,rot=(0,0,0),r2=None):
 if r2 is None:bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=d,location=p,rotation=rot)
 else:bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r,radius2=r2,depth=d,location=p,rotation=rot)
 return done(bpy.context.object,m)
def ball(p,s,m,n=20,rings=10):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=n,ring_count=rings,radius=1,location=p);o=bpy.context.object;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return done(o,m)
def ico(p,s,m,sub=2):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=p);o=bpy.context.object;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return done(o,m)
def tor(p,R,r,m,rot=(0,0,0)):
 bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=8,major_radius=R,minor_radius=r,location=p,rotation=rot);return done(bpy.context.object,m)
def rod(a,b,r,m,n=12,r2=None):
 a,b=Vector(a),Vector(b);o=cyl((a+b)/2,r,(b-a).length,m,n,r2=r2);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def mesh(name,v,f,m,thick=0):
 me=bpy.data.meshes.new(name);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);done(o,m)
 if thick:
  bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Real fabric thickness','SOLIDIFY');mod.thickness=thick;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def line(points,r,m):
 # A continuous eight-sided sweep, without hidden caps at every segment.
 # This keeps curved rails and rope silhouettes while avoiding needless triangles.
 points=[Vector(p) for p in points];n=8;v=[];f=[]
 for j,p in enumerate(points):
  tangent=(points[min(j+1,len(points)-1)]-points[max(j-1,0)]).normalized()
  q=tangent.to_track_quat('Z','Y')
  for k in range(n):v.append(tuple(p+q@Vector((r*cos(k*2*pi/n),r*sin(k*2*pi/n),0))))
 f.append(tuple(reversed(range(n))))
 for j in range(len(points)-1):
  for k in range(n):f.append((j*n+k,j*n+(k+1)%n,(j+1)*n+(k+1)%n,(j+1)*n+k))
 f.append(tuple((len(points)-1)*n+k for k in range(n)))
 return mesh('Continuous curved rail or cord',v,f,m)
def arch_handle(p,w,h,m,r=.025):
 x,y,z=p;pts=[(x+w*.5*cos(t*pi/16),y,z+h*sin(t*pi/16)) for t in range(17)];line(pts,r,m)
def pine_icon(p,s,m='cream'):
 x,y,z=p
 for zz,ww in [(0,.48),(.23,.37),(.45,.25)]:mesh('Pine emblem',[(x-ww*s,y,z+zz*s),(x+ww*s,y,z+zz*s),(x,y,z+(zz+.45)*s)],[(0,1,2)],m,.015)
 box((x,y,z-.12*s),(.12*s,.035,.3*s),m,.009)
def disc_front(p,r,d,m,n=20):return cyl(p,r,d,m,n,(pi/2,0,0))
def bolt(p,r=.027):return disc_front(p,r,.025,'brass',10)
def save(name,description):
 global parts
 bpy.ops.object.select_all(action='DESELECT')
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
 bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 minz=min(v.co.z for v in o.data.vertices)
 for v in o.data.vertices:v.co.z-=minz
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=1e-6);bpy.ops.mesh.dissolve_degenerate(threshold=1e-7);bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.015);bpy.ops.object.mode_set(mode='OBJECT')
 # Join duplicates material slots; compact while preserving material identities.
 used=[]
 for p in o.data.polygons:
  ma=o.data.materials[p.material_index]
  if ma not in used:used.append(ma)
 indices=[used.index(o.data.materials[p.material_index]) for p in o.data.polygons];o.data.materials.clear()
 for ma in used:o.data.materials.append(ma)
 for p,i in zip(o.data.polygons,indices):p.material_index=i
 o['asset_id']=name;o['units']='metres';o['description']=description;o['front']='-Y in Blender';assets.append(o);parts=[]
 bpy.ops.export_scene.gltf(filepath=OUT+'/glb/'+name+'.glb',export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT')
 o.hide_render=True;o.hide_set(True)
# 04. Picnic table with cross braces, separate planks and enamel cups.
for y in [-.68,.68]:
 for side in [-1,1]:box((side*.53,y,.38),(.13,.16,.83),'pine',.025,(0,side*.32,0))
 rod((-.81,y,.36),(.81,y,.36),.07,'cedar');rod((-.65,y,.04),(.45,y,.65),.046,'cedar')
for i in range(5):box((-.56+i*.28,0,.82),(.26,1.98,.105),'cedar',.024)
for x in [-.99,.99]:
 for i in [-.105,.105]:box((x+i,0,.46),(.19,2.15,.11),'cedar',.027)
 for y in [-.68,.68]:box((x,y,.225),(.13,.15,.45),'pine',.02)
 for y in [-.68,.68]:bolt((x,y-.085,.30))
# Runner cloth has real folded ends.
box((.1,0,.887),(.46,1.68,.018),'coral',.012)
for y in [-.9,.9]:box((.1,y,.80),(.46,.025,.2),'coral',.012)
for y in [-.67,-.54,.54,.67]:box((.1,y,.90),(.455,.035,.012),'cream',.003)
for x,y in [(-.43,-.36),(.47,.42)]:
 cyl((x,y,.99),.09,.19,'cream',16);cyl((x,y,1.09),.072,.008,'charcoal',16);tor((x+.105,y,1.0),.059,.015,'cream',(pi/2,0,0))
save('04_ridge_picnic_table','Cedar picnic table with green A-frame legs, cross braces, woven runner and two enamel mugs')
# 12. Ranger map station: canopy, sculpted relief map, pins and lower notice shelf.
for x in [-.89,.89]:
 box((x,.10,1.13),(.16,.18,2.26),'cedar',.027);ico((x,.1,.15),(.29,.25,.17),'slate',1)
box((0,.13,1.55),(1.78,.14,1.28),'bark',.035);box((0,.025,1.56),(1.53,.065,1.07),'cream',.025)
for x in [-.87,.87]:box((x,-.045,1.55),(.10,.1,1.32),'cedar',.024)
for z in [.91,2.19]:box((0,-.045,z),(1.84,.10,.10),'cedar',.024)
# Topographic mountain silhouettes, little lake and segmented trail on board.
for x,z,s in [(-.36,1.79,.38),(.09,1.76,.48),(.42,1.82,.29)]:
 mesh('Relief map peak',[(x-s*.5,-.026,z-.2),(x+s*.5,-.026,z-.2),(x,-.026,z+.24)],[(0,1,2)],'sage',.025)
 mesh('Map snow peak',[(x-s*.16,-.047,z+.10),(x+s*.16,-.047,z+.10),(x,-.047,z+.24)],[(0,1,2)],'cream',.018)
ball((-.35,-.035,1.26),(.24,.017,.12),'water',18,8)
trail=[(-.47,-.06,1.06),(-.11,-.06,1.18),(.22,-.06,1.25),(.14,-.06,1.47),(.45,-.06,1.61)]
line(trail,.014,'coral')
for p in [trail[0],trail[2],trail[-1]]:disc_front(p,.035,.035,'gold',12)
pine_icon((.46,-.053,1.06),.16,'pine');pine_icon((-.59,-.053,1.43),.14,'pine')
box((0,-.01,.78),(1.87,.36,.09),'cedar',.025)
# Pitched canopy extends in y, ridge along x.
mesh('Map station canopy',[(-1.1,-.56,2.28),(1.1,-.56,2.28),(-1.1,.09,2.61),(1.1,.09,2.61),(-1.1,.63,2.28),(1.1,.63,2.28)],[(0,1,3,2),(2,3,5,4)],'pine',.075)
for x in [-1.1,1.1]:rod((x,-.58,2.27),(x,.09,2.62),.035,'gold');rod((x,.09,2.62),(x,.64,2.27),.035,'gold')
rod((-1.14,.09,2.63),(1.14,.09,2.63),.046,'cedar')
save('12_ranger_relief_map_station','Roofed ranger trailhead station with raised landscape map, trail pins, wooden frame and stone footings')
# Save an editable scene containing only the two selected original props.
# Both remain at their authored local origin; toggle visibility to inspect one.
for o in assets:
 o.hide_render=False;o.hide_set(False)
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/source/alpine-selected.blend')
print('ALPINE_SELECTED_SOURCE_COMPLETE', len(assets), flush=True)
