"""Freeze the complete portable source/QA dependency manifest after explicit review."""
from pathlib import Path
import hashlib,json
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
original=json.loads(Path('tests/fixtures/airfield-enrichment-original-inventory.json').read_text())
all_original=list(original['sourceInventory'])
def excluded(name):
 return (name.startswith('docs/qa/') and name.endswith(('.png','.jpg','.webp'))) or name.startswith(('public/assets/drivers/','public/assets/portraits/','public/models/food-karts/bundles/'))
excluded_original={p:original['sourceInventory'][p] for p in all_original if excluded(p)}
assert len(excluded_original)==73
portable_original=[p for p in all_original if not excluded(p)]
for p,h in excluded_original.items():assert sha(p)==h,(p,'excluded historical asset changed')
new_qa=sorted(str(p) for p in Path('tests').rglob('*') if p.is_file() and ('airfield-enrichment' in p.name or p.name in ['run-airfield-retained-audit.ts','run-airfield-final-audit.ts']))
snapshots=sorted(str(p) for p in Path('docs/scene-baselines/airfield-original').rglob('*') if p.is_file())
retained=sorted(p for p in all_original if p.startswith('tests/airfield-') and p.endswith('.test.ts'))
art=sorted(str(p) for p in Path('scripts').iterdir() if p.is_file() and ('airfield-enrichment' in p.name or p.name in ['export-airfield-preview.ts','render-airfield-preview.py','verify-airfield-art-pixels.py','verify-airfield-visible-groups.py','verify-airfield-adjacent-pairs.py']))
docs=sorted(str(p) for p in Path('docs').iterdir() if p.is_file() and p.name.startswith('airfield-enrichment-') and p.name!='airfield-enrichment-qa-files.json')
# Original tracked tree includes complete transitive source/native model/test inputs.
# New dependencies augment it; old historical manifests are preserved verbatim.
paths=sorted(set(portable_original+new_qa+snapshots+art+docs))
manifest={'schema':'airfield-enrichment-portable-qa-files-v1','state':'Final source and QA dependencies frozen','baselineCommit':original['baselineCommit'],'newQaFiles':new_qa,'retainedTestFiles':retained,'baselineSnapshots':snapshots,'artDependencies':art,'qaDocuments':docs,'unchangedSharedHelperDependencies':[p for p in all_original if p.startswith('tests/helpers/') and not p.endswith('town-enrichment-geometry-worker.ts')],'portableOriginalSourceInputs':portable_original,'excludedOriginalInputsSha256':excluded_original,'originalInputCounts':{'total':len(all_original),'included':len(portable_original),'excluded':len(excluded_original)},'executionScope':'Map source/model review kit. Every full-source-stability-guarded geometry, camera, native and inventory rerun requires restoring all73 excluded authorized runtime assets. No missing-file assertion bypass; full immutable870-file inventory is included.','finalFileSha256':{p:sha(p) for p in paths},'notice':'This manifest excludes its own self-hash. Every historical finalFileSha256 map remains byte-exact; explicit Airfield review overlay binds all current deltas.'}
p=Path('docs/airfield-enrichment-qa-files.json');p.write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({'files':len(paths),'newQaFiles':len(new_qa),'retained':len(retained),'snapshots':len(snapshots),'manifestSha256':sha(p)}))
