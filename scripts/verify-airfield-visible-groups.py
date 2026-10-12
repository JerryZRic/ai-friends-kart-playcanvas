"""Exact first-hit surface evidence from the reopened, verified Airfield BLEND.
blender -b OUTPUT/airfield-original-scene.blend -t 2 --python-exit-code 1 --python scripts/verify-airfield-visible-groups.py -- OUTPUT
No rendering, geometry editing, or source-pixel retouching. Masks are explicit
640x400 centre-sampled visibility evidence, not replacements for full images.
"""
import bpy,json,sys,hashlib,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from PIL import Image
out=Path(sys.argv[sys.argv.index('--')+1]);root=Path(__file__).resolve().parents[1]
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
data=json.loads((out/'airfield-geometry.json').read_text());g=data['geometry'];render=json.loads((out/'airfield-render-record.json').read_text());proof=json.loads((out/'reopened-model-verification.json').read_text())
assert proof['status']=='passed' and proof['reopenedBlendSha256']==sha(bpy.data.filepath)==render['originalModels']['blend']['sha256']
assert proof['geometrySha256']==sha(out/'airfield-geometry.json')
labels=[q['id'] for q in g['enrichmentAssemblies']]+[q['kind'] for q in g['landmarks']]
colors=[(249,174,75),(214,127,199),(90,211,203),(235,233,130),(255,166,165),(181,155,217),(110,195,114),(239,204,141)]
lookup={b['name']:[-1]*(len(b['indices'])//3) for b in g['batches']}
for group in g['enrichmentAssemblies']:
 gi=labels.index(group['id'])
 for piece in group['pieces']:
  for ci in piece['componentIndices']:
   c=g['components'][ci]
   for i in range(c['indexStart']//3,c['indexEnd']//3):assert lookup[c['batch']][i]==-1;lookup[c['batch']][i]=gi
for c in g['components']:
 if c.get('landmark') in labels:
  for i in range(c['indexStart']//3,c['indexEnd']//3):lookup[c['batch']][i]=labels.index(c['landmark'])
vertices=[];triangles=[];owners=[]
for b in g['batches']:
 obj=bpy.data.objects[b['name']];assert obj.matrix_world.is_identity;offset=len(vertices)
 vertices.extend(v.co.copy() for v in obj.data.vertices);triangles.extend(tuple(offset+i for i in p.vertices) for p in obj.data.polygons);owners.extend(lookup[b['name']])
assert len(triangles)==g['budget']['triangles']
tree=BVHTree.FromPolygons(vertices,triangles,all_triangles=True,epsilon=0.0)
w,h=640,400;tanv=math.tan(math.radians(28));tanh=tanv*w/h
names=['eye-workshop-middle','chase0-workshop-middle','eye-court-middle','chase0-court-middle','eye-terrace-middle','chase0-terrace-middle']
rows=[]
for name in names:
 camera=bpy.data.objects[name];q=camera.rotation_quaternion;origin=camera.location.copy();pixels=bytearray(w*h*3);stats={label:{'pixels':0,'bbox':[w,h,-1,-1],'depthClasses':{'under50m':0,'50to100m':0,'over100m':0}} for label in labels}
 for y in range(h):
  for x in range(w):
   direction=q@Vector(((2*(x+.5)/w-1)*tanh,(1-2*(y+.5)/h)*tanv,-1));direction.normalize();location,normal,face,distance=tree.ray_cast(origin,direction,2200)
   if face is None or owners[face]<0:continue
   k=owners[face];s=stats[labels[k]];s['pixels']+=1;s['bbox']=[min(s['bbox'][0],x),min(s['bbox'][1],y),max(s['bbox'][2],x),max(s['bbox'][3],y)];s['depthClasses']['under50m' if distance<50 else '50to100m' if distance<100 else 'over100m']+=1
   i=(y*w+x)*3;pixels[i:i+3]=bytes(colors[k])
 for label,s in stats.items():
  if not s['pixels']:s['bbox']=None;s['widthFraction']=s['heightFraction']=s['imageAreaFraction']=0
  else:s['widthFraction']=(s['bbox'][2]-s['bbox'][0]+1)/w;s['heightFraction']=(s['bbox'][3]-s['bbox'][1]+1)/h;s['imageAreaFraction']=s['pixels']/(w*h)
 target='airfield-enrichment-'+('runway-workshop' if 'workshop' in name else 'perimeter-court' if 'court' in name else 'return-terrace')
 assert stats[target]['widthFraction']>=.08 and stats[target]['heightFraction']>=.06,(name,'Primary visible group is smaller than art target',stats[target])
 file=name+'-first-hit-mask.png';Image.frombytes('RGB',(w,h),bytes(pixels)).save(out/file);rows.append({'view':name,'maskFile':file,'maskSha256':sha(out/file),'sourceImageSha256':render['views'][name]['sha256'],'groups':stats,'primaryTarget':target})
 print('VISIBLE_GROUP',name,stats[target],flush=True)
report={'schema':'airfield-source-first-hit-visibility-v1','status':'passed','geometrySha256':sha(out/'airfield-geometry.json'),'reopenedBlendSha256':sha(bpy.data.filepath),'verifierSha256':sha(__file__),'cameraManifestSha256':render['frozenCameraManifestSha256'],'samplingResolution':[w,h],'projection':'Original frozen56-degree vertical FOV, exact source camera matrix, pixel-centre rays against complete float32 source triangles','legend':dict(zip(labels,colors)),'views':rows,'notice':'Visible first-hit surface masks measure actual unoccluded group span and sampled area. They do not substitute for art review or native gameplay/performance. Distance classes are source-camera distances, not proof of artistic depth.'}
(out/'visible-first-hit-verification.json').write_text(json.dumps(report,indent=2)+'\n')
