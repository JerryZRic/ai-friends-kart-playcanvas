"""Create a Timewish-compatible runtime artifact; never mutate the full release dist."""
import hashlib,json,os,re,sys,zipfile
from pathlib import Path
EXT={'.html','.css','.js','.mjs','.json','.wasm','.png','.jpg','.jpeg','.webp','.gif','.svg','.ico','.avif','.woff','.woff2','.ttf','.otf','.glb','.gltf','.bin','.ktx','.ktx2','.basis','.mp3','.ogg','.wav','.mp4','.webm','.txt'}
MODE=os.environ.get('STABLE_RELEASE_MODE','v1.1.0')
if MODE not in ('v1.1.0','v1.1.1-hotfix'):raise ValueError('unapproved runtime release mode')
VERSION='1.1.1' if MODE=='v1.1.1-hotfix' else '1.1.0'
SOURCE=f'https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v{VERSION}/source.zip'
def allowed(name):
 p=Path(name)
 return p.suffix.lower() in EXT or bool(re.fullmatch(r'assets/(drivers|portraits)/[^/]+\.glb\.gz|models/food-karts/bundles/[^/]+\.zip',name))
def package(dist,output,sha):
 if not re.fullmatch('[0-9a-f]{40}',sha):raise ValueError('exact source SHA required')
 dist=Path(dist).resolve();output=Path(output).resolve()
 if dist==output or dist in output.parents:raise ValueError('output overlaps full build')
 for required in ['index.html','source.html','source.zip','LICENSE','NOTICE']:
  if not (dist/required).is_file():raise ValueError('incomplete full build: '+required)
 output.mkdir(parents=True,exist_ok=True)
 target=output/f'ai-friends-kart-playcanvas-v{VERSION}-server-runtime.zip'
 if target.exists():raise ValueError('refuse existing runtime ZIP')
 files=[];excluded=[];before={};legal={'LICENSE':'LICENSE.txt','NOTICE':'NOTICE.txt'}
 with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_STORED,allowZip64=False) as z:
  for path in sorted(dist.rglob('*')):
   if path.is_symlink():raise ValueError('symlink in full build')
   if path.is_dir():continue
   name=path.relative_to(dist).as_posix();data=path.read_bytes();before[name]=hashlib.sha256(data).hexdigest()
   if name in ['source.zip','.nojekyll'] or name.startswith('balance-results/') or name.endswith('.map'):
    excluded.append(name);continue
   name=legal.get(name,name)
   if not allowed(name) or any(p.startswith('.') or p in ['', '..'] for p in name.split('/')) or any(c in name for c in ['\\',':','\0']) or len(name.encode())>512 or len(name.split('/'))>20:raise ValueError('unsupported runtime path '+name)
   if name=='source.html':
    html=data.decode();html=html.replace('href="source.zip"',f'href="{SOURCE}"')
    for old,new in legal.items():html=html.replace(f'href="{old}"',f'href="{new}"')
    html=html.replace('</body>',f'<p>Server runtime source: <a href="{SOURCE}">v{VERSION} corresponding source ZIP</a>; exact commit {sha}. Full offline HTML contains diagnostics and source; this server runtime omits offline diagnostics; download the exact v{VERSION} complete HTML package for those tools.</p></body>');data=html.encode()
   if name in ['balance-report.html','balance-lab.html']:
    dest=f'https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v{VERSION}/ai-friends-kart-playcanvas-v{VERSION}-html.zip'
    data=(f'<!doctype html><meta charset="utf-8"><title>v{VERSION} offline diagnostics</title><h1>v{VERSION} offline diagnostics / 离线诊断工具</h1><p>This runtime does not include offline diagnostic datasets. Download and extract the complete v{VERSION} HTML package to use this tool. 诊断工具请下载并解压 v{VERSION} 完整 HTML 包。</p><a href="{dest}">Download complete v{VERSION} HTML</a>').encode()
   if len(data)>1024**3:raise ValueError('oversize runtime file')
   info=zipfile.ZipInfo(name,(1980,1,1,0,0,0));info.external_attr=0o100644<<16;z.writestr(info,data)
   files.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
 if len(files)>20000 or sum(f['bytes'] for f in files)>2*1024**3 or target.stat().st_size>1024**3:raise ValueError('runtime capacity exceeded')
 for name,digest in before.items():
  if hashlib.sha256((dist/name).read_bytes()).hexdigest()!=digest:raise ValueError('full dist mutated')
 with zipfile.ZipFile(target) as z:
  if z.testzip() is not None:raise ValueError('runtime ZIP corrupt')
 report={'sourceCommit':sha,'sourceUrl':SOURCE,'archive':target.name,'bytes':target.stat().st_size,'expandedBytes':sum(f['bytes'] for f in files),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'files':files,'excluded':excluded,'fullBuildUnchanged':True,'requiresOpaqueAssetWhitelist':['assets/drivers/*.glb.gz','assets/portraits/*.glb.gz','models/food-karts/bundles/*.zip']}
 (output/'SERVER-RUNTIME-MANIFEST.json').write_text(json.dumps(report,indent=2)+'\n');return report
if __name__=='__main__':
 r=package(sys.argv[1],sys.argv[2],os.environ['GITHUB_SHA']);print(json.dumps({k:v for k,v in r.items() if k not in ['files','excluded']}))
