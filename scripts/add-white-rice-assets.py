#!/usr/bin/env python3
"""Append the approved 000 kit without rewriting any original 001–054 bundle.
Usage: python scripts/add-white-rice-assets.py --source SOURCE --runtime runtime-optimized --thumbnails THUMB_DIR
Source and runtime provenance are kept distinct. No private source paths are serialized.
"""
import argparse, base64, gzip, hashlib, importlib.util, io, json, pathlib, zipfile
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source',type=pathlib.Path,required=True)
parser.add_argument('--runtime',default='runtime-optimized',choices=['runtime','runtime-optimized'])
parser.add_argument('--thumbnails',type=pathlib.Path,required=True)
args=parser.parse_args()
helper=pathlib.Path(__file__).with_name('build-food-kart-assets.py')
spec=importlib.util.spec_from_file_location('food_assets',helper);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
sha=lambda b:hashlib.sha256(b).hexdigest()
source=args.source; meta=json.loads((source/'manifest.json').read_text())
if meta.get('selected_variant')!='C_PlainRice':raise ValueError('Only the user-approved C pure-rice model is eligible')
base=pathlib.Path('public/models/food-karts');manifest=json.loads((base/'manifest.json').read_text()); thumbs=json.loads((base/'thumbnails.json').read_text())
kit_id='000-white-rice'; modules=list(mod.SLOTS); records=[];entries={};provenance=[]
old_kits=[kit for kit in manifest['kits'] if kit['id']!=kit_id];old_parts=[part for part in manifest['parts'] if part['kitId']!=kit_id]
if len(old_kits)!=54 or len(old_parts)!=324:raise ValueError('Expected all 54 untouched original kits')
for kit in old_kits:
 b=pathlib.Path('public',kit['bundlePath']).read_bytes()
 if len(b)!=kit['bundleBytes'] or sha(b)!=kit['bundleSha256']:raise ValueError('An original bundle changed')
for module in modules:
 original=(source/'runtime'/f'{module}.glb').read_bytes();data=(source/args.runtime/f'{module}.glb').read_bytes();doc,offset=mod.parse(data)
 author=meta['modules'][module];metrics=mod.inspect(doc,{'module_id':module,'mounts':author['mounts']})
 path=f'{mod.BASE}/parts/{kit_id}/{module}.glb.pack.gz';skeleton=bytearray(data);images=[]
 for im in doc.get('images',[]):
  if 'uri' in im or im.get('mimeType')!='image/png':raise ValueError('External or non-PNG image')
  view=doc['bufferViews'][im['bufferView']];start=offset+view.get('byteOffset',0);length=view['byteLength'];image=data[start:start+length];digest=sha(image)
  import struct
  width,height=struct.unpack_from('>II',image,16);ipath=f'{mod.BASE}/textures/{digest}.png';entries[ipath]=image
  images.append(dict(path=ipath,bytes=length,sha256=digest,byteOffset=start,mimeType='image/png',width=width,height=height));skeleton[start:start+length]=bytes(length)
 packed=gzip.compress(skeleton,compresslevel=9,mtime=0);entries[path]=packed
 record=dict(id=f'kit000::{module}',kitId=kit_id,kitNumber='000',moduleId=module,slot=mod.SLOTS[module],filename=f'{module}.glb',title=meta['title'],path=path,available=True,bytes=len(packed),sha256=sha(packed),decodedBytes=len(data),decodedSha256=sha(skeleton),originalSha256=sha(data),images=images,rootTransform=mod.IDENTITY,**metrics)
 record['sourceOriginalSha256']=sha(original);record['runtimeDerivation']='approved-pure-rice-optimized-v1' if args.runtime!='runtime' else 'approved-pure-rice-full-fidelity'
 reconstructed=bytearray(gzip.decompress(packed))
 for im in images:reconstructed[im['byteOffset']:im['byteOffset']+im['bytes']]=entries[im['path']]
 if reconstructed!=data:raise ValueError('Runtime reconstruction changed bytes')
 image=(args.thumbnails/f'{module}.webp').read_bytes();thumbs['images'][record['id']]='data:image/webp;base64,'+base64.b64encode(image).decode()
 records.append(record);provenance.append(dict(module=module,sourceGlbSha256=sha(original),runtimeGlbSha256=sha(data),sourceBytes=len(original),runtimeBytes=len(data),runtimeTriangles=metrics['triangles'],runtimePrimitives=metrics['materialPrimitives'],thumbnailSha256=sha(image)))
output=io.BytesIO()
with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_STORED,allowZip64=False) as z:
 for path in sorted(entries):
  info=zipfile.ZipInfo(path,date_time=(1980,1,1,0,0,0));info.compress_type=zipfile.ZIP_STORED;info.external_attr=0o100644<<16;z.writestr(info,entries[path])
bundle=output.getvalue();bundle_path=f'{mod.BASE}/bundles/{kit_id}.zip';pathlib.Path('public',bundle_path).write_bytes(bundle)
kit=dict(id=kit_id,number='000',title=meta['title'],theme=meta['theme'],partIds=[p['id'] for p in records],bundlePath=bundle_path,bundleBytes=len(bundle),bundleSha256=sha(bundle))
manifest['kits']=[kit]+old_kits;manifest['parts']=records+old_parts
thumbbytes=(json.dumps(thumbs,ensure_ascii=False,separators=(',',':'))+'\n').encode();(base/'thumbnails.json').write_bytes(thumbbytes)
manifest['thumbnailIndex']=dict(path=f'{mod.BASE}/thumbnails.json',bytes=len(thumbbytes),sha256=sha(thumbbytes))
parts=manifest['parts'];kits=manifest['kits'];unique={im['sha256']:im['bytes'] for p in parts for im in p['images']};packed=sum(p['bytes'] for p in parts)
# Every field describes shipped runtime bytes, not the untouched full-fidelity source archive.
manifest['totals']=dict(kits=len(kits),parts=len(parts),availableParts=sum(p['available'] for p in parts),originalBytes=sum(p['decodedBytes'] for p in parts),embeddedImageBytes=sum(im['bytes'] for p in parts for im in p['images']),uniqueImages=len(unique),sharedImageBytes=sum(unique.values()),packedGeometryBytes=packed,deliveryBytes=sum(k['bundleBytes'] for k in kits),unbundledDeliveryBytes=packed+sum(unique.values()),bundleCount=len(kits),maxBundleBytes=max(k['bundleBytes'] for k in kits),triangles=sum(p['triangles'] for p in parts),materialPrimitives=sum(p['materialPrimitives'] for p in parts),maxPartPackedBytes=max(p['bytes'] for p in parts),maxPartDecodedBytes=max(p['decodedBytes'] for p in parts))
(base/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
proof=dict(kit=kit_id,selectedVariant='C_PlainRice',sourceBlendSha256=sha((source/'source/WhiteRice_Modular.blend').read_bytes()),runtimeDerivation=records[0]['runtimeDerivation'],fullFidelitySourcePreserved=True,original54BundleHashesUnchanged=True,parts=provenance)
pathlib.Path('docs/white-rice-runtime-provenance.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(kit=kit_id,bundleBytes=len(bundle),triangles=sum(p['triangles'] for p in records),primitives=sum(p['materialPrimitives'] for p in records),parts=len(parts)),indent=2))
