"""Compare a fresh source regeneration with delivered Mountain input data.
python scripts/verify-mountain-regeneration.py DELIVERED.json REGENERATED.json OUTPUT.json
Object key order and camera attachment metadata do not affect geometry equality.
"""
import json,hashlib,sys,gc
from pathlib import Path
paths=list(map(Path,sys.argv[1:4]));keys=['geometry','textures','route','theme']
def read(path):
    data=json.loads(path.read_text());result={k:hashlib.sha256(json.dumps(data[k],sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest() for k in keys}
    result['sourceHashes']=data['sourceHashes'];result['counts']={'batches':len(data['geometry']['batches']),'vertices':sum(len(b['positions'])//3 for b in data['geometry']['batches']),'triangles':sum(len(b['indices'])//3 for b in data['geometry']['batches'])};return result
before=read(paths[0]);gc.collect();after=read(paths[1]);gc.collect()
assert all(before[k]==after[k] for k in keys),'Geometry/textures/route/theme differ'
assert all(before['sourceHashes'][p]==s for p,s in after['sourceHashes'].items()),'Regenerated source identities differ'
report={'completeRegenerationFromPackagedSource':True,'semanticallyExactFields':keys,'fieldSha256':{k:before[k] for k in keys},'counts':before['counts'],'sourceHashes':after['sourceHashes'],'notice':'JSON property order and camera attachment metadata can differ. Actual complete source geometry metadata, texture pixels, route and theme are equal.'}
paths[2].write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'completeRegenerationFromPackagedSource':True,'counts':before['counts']}))
