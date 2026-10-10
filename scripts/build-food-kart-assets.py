#!/usr/bin/env python3
"""Losslessly prepare on-demand food kart payloads from verified canonical GLBs.

Usage: python scripts/build-food-kart-assets.py --inventory INVENTORY --source ROOT [--allow-partial]
Original GLBs are read-only. Embedded image bytes become SHA256-keyed shared PNGs
inside one stored ZIP per theme alongside its six gzip skeletons;
all other bytes (including original JSON, anchors, geometry and padding) are retained.
Runtime restores the exact original file and verifies its SHA256 before importing it.
"""
import argparse, collections, gzip, hashlib, io, json, pathlib, re, struct, sys, zipfile

SLOTS = {'01_BodyShell':'body','02_ChassisSuspension':'chassis','03_WheelsTires':'wheels','04_Motor':'motor','05_FinalDrive':'finalDrive','06_Battery':'battery'}
IDENTITY = {'translation':[0,0,0],'rotation':[0,0,0,1],'scale':[1,1,1]}
BASE = 'models/food-karts'
def sha(data): return hashlib.sha256(data).hexdigest()
def parse(data):
    if struct.unpack_from('<III',data) != (0x46546c67,2,len(data)): raise ValueError('Invalid GLB header')
    n,typ=struct.unpack_from('<II',data,12)
    if typ!=0x4e4f534a: raise ValueError('Missing JSON chunk')
    doc=json.loads(data[20:20+n]); bl,bt=struct.unpack_from('<II',data,20+n)
    if bt!=0x004e4942 or 28+n+bl!=len(data): raise ValueError('Invalid binary chunk')
    return doc,28+n

def matmul(a,b): return [sum(a[r*4+k]*b[k*4+c] for k in range(4)) for r in range(4) for c in range(4)]
def node_matrix(node):
    if 'matrix' in node: return [node['matrix'][c*4+r] for r in range(4) for c in range(4)]
    x,y,z,w=node.get('rotation',[0,0,0,1]);sx,sy,sz=node.get('scale',[1,1,1]);tx,ty,tz=node.get('translation',[0,0,0])
    return [(1-2*y*y-2*z*z)*sx,(2*x*y-2*z*w)*sy,(2*x*z+2*y*w)*sz,tx,(2*x*y+2*z*w)*sx,(1-2*x*x-2*z*z)*sy,(2*y*z-2*x*w)*sz,ty,(2*x*z-2*y*w)*sx,(2*y*z+2*x*w)*sy,(1-2*x*x-2*y*y)*sz,tz,0,0,0,1]

def inspect(doc,part):
    nodes=doc.get('nodes',[]); roots=doc['scenes'][doc.get('scene',0)]['nodes']; identity=node_matrix({})
    if len(roots)!=1 or nodes[roots[0]].get('name')!=part['module_id'] or node_matrix(nodes[roots[0]])!=identity: raise ValueError('Module root must have exact original identity')
    anchors={}; expected=set(part.get('mounts',{})); worlds={}
    def walk(i,parent):
        n=nodes[i];m=matmul(parent,node_matrix(n));worlds[i]=m
        if n.get('name') in expected: anchors[n['name']]=[m[3],m[7],m[11]]
        for child in n.get('children',[]):walk(child,m)
    for r in roots:walk(r,identity)
    if set(anchors)!=expected:raise ValueError('Missing anchor nodes')
    for name,source in part.get('mounts',{}).items():
        target=[source[0],source[2],-source[1]]
        if max(abs(a-b) for a,b in zip(target,anchors[name]))>1e-5:raise ValueError('Anchor disagrees with source metadata: '+name)
    triangles=0;primitives=0;vertices=0;lo=[float('inf')]*3;hi=[float('-inf')]*3
    for i,matrix in worlds.items():
        if 'mesh' not in nodes[i]:continue
        for primitive in doc['meshes'][nodes[i]['mesh']]['primitives']:
            if primitive.get('mode',4)!=4:raise ValueError('Only triangle primitives supported')
            a=doc['accessors'][primitive['attributes']['POSITION']];vertices+=a['count'];primitives+=1
            triangles+=(doc['accessors'][primitive['indices']]['count'] if 'indices' in primitive else a['count'])//3
            for x in [a['min'][0],a['max'][0]]:
              for y in [a['min'][1],a['max'][1]]:
                for z in [a['min'][2],a['max'][2]]:
                  for axis in range(3):
                    value=matrix[axis*4]*x+matrix[axis*4+1]*y+matrix[axis*4+2]*z+matrix[axis*4+3]
                    lo[axis]=min(lo[axis],value);hi[axis]=max(hi[axis],value)
    return dict(anchors=anchors,boundsGltf=[lo,hi],triangles=triangles,materialPrimitives=primitives,vertices=vertices,materialCount=len(doc.get('materials',[])),embeddedImages=len(doc.get('images',[])))

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--inventory',type=pathlib.Path,required=True);parser.add_argument('--source',type=pathlib.Path,required=True);parser.add_argument('--allow-partial',action='store_true');args=parser.parse_args()
    source=args.source.resolve(); inventory=json.loads(args.inventory.read_text());out=pathlib.Path('public')/BASE;out.mkdir(parents=True,exist_ok=True)
    candidates=collections.defaultdict(list)
    for p in source.rglob('*.glb'):
        if p.stem in SLOTS:candidates[p.name].append(p)
    byhash={};missing=[];parts=[];unique_images={};delivery_entries={};all_original=all_gzip=all_image=pack_bytes=0;valid_count=0
    kit_by_id={k['kit_id']:k for k in inventory['kits']}
    if len(kit_by_id)!=54 or len(inventory['parts'])!=324: raise ValueError('Expected the complete canonical54-kit collection')
    if any(not re.fullmatch(r'\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*', k) for k in kit_by_id): raise ValueError('Invalid kit path identity')
    for original in inventory['parts']:
        kit=kit_by_id[original['kit_id']];module=original['module_id'];pid=original['inventory_key']; path=f'{BASE}/parts/{kit["kit_id"]}/{module}.glb.pack.gz'
        part=dict(id=pid,kitId=kit['kit_id'],kitNumber=kit['kit_number'],moduleId=module,slot=SLOTS[module],filename=original['file'],title=kit['title'],path=path,available=False,bytes=0,sha256='',decodedBytes=original['glb_bytes'],decodedSha256='',originalSha256=original['glb_sha256'],images=[],rootTransform=IDENTITY)
        thumb=f'{BASE}/thumbs/{kit["kit_id"]}/{module}.webp'
        if (pathlib.Path('public')/thumb).is_file():part['thumbnail']=thumb
        exact=source/kit['kit_id']/'runtime'/original['file']; possible=[exact] if exact.is_file() else []
        possible.extend(p for p in candidates[original['file']] if p not in possible and (kit['kit_id'] in str(p) or (kit.get('original_archive_root') or '__NO_MATCH__') in str(p)))
        match=None;data=None
        for p in possible:
            if p not in byhash:byhash[p]=sha(p.read_bytes())
            if byhash[p]==original['glb_sha256']:match=p;data=p.read_bytes();break
        if match is None:
            missing.append(pid);parts.append(part);continue
        doc,offset=parse(data);part.update(inspect(doc,original));skeleton=bytearray(data);images=[]
        if part['triangles']!=original['triangles'] or part['materialPrimitives']!=original['material_primitives']:raise ValueError(f'Inventory count mismatch {pid}')
        for im in doc.get('images',[]):
            if 'uri' in im or im['mimeType']!='image/png':raise ValueError('Expected self-contained original PNG')
            view=doc['bufferViews'][im['bufferView']];start=offset+view.get('byteOffset',0);length=view['byteLength'];image=data[start:start+length];digest=sha(image)
            if image[:8]!=b'\x89PNG\r\n\x1a\n':raise ValueError('Invalid PNG signature')
            width,height=struct.unpack_from('>II',image,16);ipath=f'{BASE}/textures/{digest}.png'
            if ipath in delivery_entries and delivery_entries[ipath]!=image:raise ValueError('Image hash collision')
            delivery_entries[ipath]=image
            images.append(dict(path=ipath,bytes=length,sha256=digest,byteOffset=start,mimeType='image/png',width=width,height=height))
            skeleton[start:start+length]=bytes(length);unique_images[digest]=length;all_image+=length
        packed=gzip.compress(skeleton,compresslevel=9,mtime=0);delivery_entries[path]=packed
        part.update(available=True,bytes=len(packed),sha256=sha(packed),decodedBytes=len(data),decodedSha256=sha(skeleton),images=images)
        reconstructed=bytearray(gzip.decompress(packed))
        for im in images:reconstructed[im['byteOffset']:im['byteOffset']+im['bytes']]=delivery_entries[im['path']]
        if reconstructed!=data:raise ValueError('Lossless reconstruction verification failed')
        parts.append(part);all_original+=len(data);all_gzip+=len(gzip.compress(data,compresslevel=9,mtime=0));pack_bytes+=len(packed);valid_count+=1
        print(f'{pid}: {len(data):,} original -> {len(packed):,} packed + shared images',flush=True)
    kits=[dict(id=k['kit_id'],number=k['kit_number'],title=k['title'],theme=k['theme'],partIds=[p['id'] for p in parts if p['kitId']==k['kit_id']]) for k in inventory['kits']]
    bundle_total=0
    for kit in kits:
        records=[p for p in parts if p['kitId']==kit['id'] and p['available']]
        if not records:continue
        paths={p['path'] for p in records}|{im['path'] for p in records for im in p['images']}
        output=io.BytesIO()
        with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_STORED,allowZip64=False) as archive:
            for path in sorted(paths):
                info=zipfile.ZipInfo(path,date_time=(1980,1,1,0,0,0));info.compress_type=zipfile.ZIP_STORED;info.external_attr=0o100644<<16
                archive.writestr(info,delivery_entries[path])
        bundle=output.getvalue();bundle_path=f'{BASE}/bundles/{kit["id"]}.zip';target=pathlib.Path('public')/bundle_path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(bundle)
        # Re-open and compare every stored payload before publishing its manifest hash.
        with zipfile.ZipFile(io.BytesIO(bundle)) as archive:
            if set(archive.namelist())!=paths or any(archive.read(path)!=delivery_entries[path] for path in paths):raise ValueError('Bundle changed a payload')
        kit.update(bundlePath=bundle_path,bundleBytes=len(bundle),bundleSha256=sha(bundle));bundle_total+=len(bundle)
    totals=dict(kits=len(kits),parts=len(parts),availableParts=valid_count,originalBytes=all_original,originalGzipBytes=all_gzip,embeddedImageBytes=all_image,uniqueImages=len(unique_images),sharedImageBytes=sum(unique_images.values()),packedGeometryBytes=pack_bytes,deliveryBytes=bundle_total,unbundledDeliveryBytes=pack_bytes+sum(unique_images.values()),bundleCount=sum(1 for k in kits if "bundlePath" in k),maxBundleBytes=max((k.get("bundleBytes",0) for k in kits),default=0),triangles=sum(p.get('triangles',0) for p in parts),materialPrimitives=sum(p.get('materialPrimitives',0) for p in parts),maxPartPackedBytes=max(p['bytes'] for p in parts),maxPartDecodedBytes=max(p['decodedBytes'] for p in parts))
    manifest=dict(schemaVersion=1,encoding='food-kart-glb-image-chunks-v1',units='meter',axes='+X right, +Y up, +Z forward',assemblyRule='Place all six module roots at the identical identity transform. Do not recenter or rescale individual parts.',kits=kits,parts=parts,totals=totals)
    thumbnail_index=out/'thumbnails.json'
    if thumbnail_index.is_file():
        index_bytes=thumbnail_index.read_bytes();manifest['thumbnailIndex']=dict(path=f'{BASE}/thumbnails.json',bytes=len(index_bytes),sha256=sha(index_bytes))
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(totals,indent=2));print('Missing original files:',len(missing))
    if missing:
        print('\n'.join(missing),file=sys.stderr)
        if not args.allow_partial:raise SystemExit('Incomplete canonical collection; do not publish')
if __name__=='__main__':main()
