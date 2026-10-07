"""Export the original kart without its baked driver, preserving authored geometry.
Run: blender --background --disable-autoexec --python-exit-code 1 --python export_original_chassis.py -- --source /path/to/original/models/kart.blend
The original input is read only; generated outputs are written to --output.
"""
from pathlib import Path
import bpy, json, hashlib, argparse, sys
from mathutils import Vector
parser=argparse.ArgumentParser()
parser.add_argument('--source',required=True,help='Original v1.0.0 models/kart.blend')
parser.add_argument('--output',default=str(Path.cwd()/'build-chassis'))
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
BASE=Path(args.source).resolve()
OUT=Path(args.output).resolve()
(OUT/'models').mkdir(parents=True,exist_ok=True)
(OUT/'qa').mkdir(parents=True,exist_ok=True)
source_hash=hashlib.sha256(BASE.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(BASE))
collection=bpy.data.collections['NEON KART • export']
collection.name='R12 Kart - original chassis'
root=bpy.data.objects['NeonKart']

def old_driver(obj):
    return obj.name.startswith(('Driver ', 'Helmet ', 'Harness shoulder', 'Visor reflection')) or obj.name in ('Suit chest panel','Curved dark visor')

removed=sorted(o.name for o in collection.objects if old_driver(o))
assert len(removed)==40, removed
kept=[o for o in collection.objects if o.type=='MESH' and not old_driver(o)]

def snapshot(objects):
    bpy.context.view_layer.update()
    deps=bpy.context.evaluated_depsgraph_get()
    result={}
    for o in objects:
        ev=o.evaluated_get(deps)
        mesh=ev.to_mesh(preserve_all_data_layers=True,depsgraph=deps)
        result[o.name]={'vertices':[ev.matrix_world@v.co for v in mesh.vertices], 'polygons':[tuple(p.vertices) for p in mesh.polygons], 'materials':[m.name for m in mesh.materials]}
        ev.to_mesh_clear()
    return result

before=snapshot(kept)
for o in list(collection.objects):
    if old_driver(o): bpy.data.objects.remove(o,do_unlink=True)
pivot=bpy.data.objects.new('SteeringPivot',None)
collection.objects.link(pivot);pivot.parent=root;pivot.location=(0,-.30,1.105)
pivot.empty_display_type='ARROWS';pivot.empty_display_size=.18
pivot['shaft_axis_blender']=[0,-.6819983600624985,.7313537016191705]
pivot['shaft_axis_gltf']=[0,.7313537016191705,.6819983600624985]
pivot['travel_degrees']=18.0
bpy.context.view_layer.update()
steering=[o for o in kept if o.name=='Steering wheel' or o.name=='Steering hub' or o.name.startswith('Steering spoke')]
assert len(steering)==5
for o in steering:
    world=o.matrix_world.copy();o.parent=pivot;o.matrix_world=world
bpy.context.view_layer.update()
after=snapshot(kept)
max_error=0
for name,original in before.items():
    updated=after[name]
    assert original['polygons']==updated['polygons'],name
    assert original['materials']==updated['materials'],name
    assert len(original['vertices'])==len(updated['vertices']),name
    max_error=max(max_error,max((a-b).length for a,b in zip(original['vertices'],updated['vertices'])))
assert max_error<2e-6,max_error
root['r12_preview']='Original chassis retained; original driver removed; steering wheel pivot added.'
bpy.ops.object.select_all(action='DESELECT');root.select_set(True);bpy.context.view_layer.objects.active=root
blend=OUT/'models/kart-r12-chassis.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend))

# Only temporary export copies are joined. The .blend keeps every authored part.
pivot.name='SteeringPivot_authored'
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
export_collection=bpy.data.collections.new('R12 export only');bpy.context.scene.collection.children.link(export_collection)
export_root=bpy.data.objects.new('R12KartChassis',None);export_collection.objects.link(export_root)
parents={root.name:export_root}
for o in collection.objects:
    if o.type=='EMPTY' and o!=root:
        name='SteeringPivot' if o==pivot else o.name+'_pivot'
        q=bpy.data.objects.new(name,None);export_collection.objects.link(q);q.parent=export_root;q.matrix_world=o.matrix_world.copy()
        for key in o.keys(): q[key]=o[key]
        parents[o.name]=q
batches={}
for o in kept:
    ev=o.evaluated_get(deps);mesh=bpy.data.meshes.new_from_object(ev,preserve_all_data_layers=True,depsgraph=deps)
    q=bpy.data.objects.new(o.name+'_export',mesh);export_collection.objects.link(q);q.matrix_world=o.matrix_world.copy()
    key=(o.parent.name,o.data.materials[0].name);batches.setdefault(key,[]).append(q)
for (parent_name,material_name),objects in batches.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=parent_name+'_'+material_name
    world=o.matrix_world.copy();o.parent=parents[parent_name];o.matrix_world=world
bpy.ops.object.select_all(action='DESELECT')
for o in export_collection.objects:o.select_set(True)
bpy.context.view_layer.objects.active=export_root
bpy.ops.export_scene.gltf(filepath=str(OUT/'models/kart-r12-chassis.glb'),export_format='GLB',use_selection=True,export_apply=True,export_cameras=False,export_lights=False,export_animations=False,export_yup=True,export_extras=True)
report={'status':'passed','source':str(BASE),'source_sha256':source_hash,'collection':collection.name,'removed_old_driver_parts':removed,'preserved_meshes':len(kept),'export_batches':len(batches),'steering_meshes':[o.name for o in steering],'maximum_world_vertex_delta':max_error,'topology_and_material_assignments_unchanged':True,'steering_pivot_blender':[0,-.30,1.105],'steering_pivot_gltf':[0,1.105,.30],'blend':str(blend),'glb':str(OUT/'models/kart-r12-chassis.glb')}
assert hashlib.sha256(BASE.read_bytes()).hexdigest()==source_hash
(OUT/'qa/chassis-preservation.json').write_text(json.dumps(report,indent=2)+'\n')
print('R12_CHASSIS_RESULT',json.dumps(report))
