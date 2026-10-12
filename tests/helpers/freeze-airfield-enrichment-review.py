"""Explicit final Airfield review, independently retaining every original fixture.
Requires reviewed runtime, provenance and poster hashes from the completed art gate.
Never silently accepts current source hashes or changes an historical inventory.
"""
from pathlib import Path
import sys,json,hashlib,difflib
sha=lambda b:hashlib.sha256(b).hexdigest()
original=json.loads(Path('tests/fixtures/airfield-enrichment-original-inventory.json').read_text())
assert sha(Path('tests/fixtures/airfield-enrichment-original-inventory.json').read_bytes())=='803c61344abe2f97fb9acaaf8c5960f64036938fff7e1248d8263e1db332b6cf'
args=sys.argv[1:];assert len(args)==3,'Supply explicitly reviewed scene, catalog-provenance, poster SHA256 values'
production=['src/airfield-scenery.ts','docs/airfield-preview-provenance.json','public/map-previews/airfield.webp']
for f,h in zip(production,args):assert len(h)==64 and sha(Path(f).read_bytes())==h,(f,'reviewed current artifact changed')
consumers=['tests/mountain-enrichment-contract.test.ts','tests/helpers/town-enrichment-geometry-worker.ts']+[f'tests/{n}-enrichment-inventory.test.ts' for n in ['quarry','forest','workshop','harvest','desert','snow','caldera','garden']]
allowed=sorted(production+consumers+['tests/airfield-gameplay.test.ts'])
changed={p:{'previousSha256':old,'currentSha256':sha(Path(p).read_bytes()),'scope':('Append-only original Airfield service architecture or exact source-matched catalog' if p in production else 'Exact reviewed original-prefix and appended-face native classification' if p=='tests/airfield-gameplay.test.ts' else 'Exact Airfield-only incoming-baseline/current-reviewed identity overlay; unchanged historical fixtures and assertions')} for p,old in original['sourceInventory'].items() if sha(Path(p).read_bytes())!=old}
assert sorted(changed)==allowed,('Unlisted or omitted changed path',sorted(changed),allowed)
# Every accepted historical fixture and portable manifest must be byte-identical.
for p,h in original['sourceInventory'].items():
 if p.startswith('tests/fixtures/') or p.endswith('enrichment-qa-files.json'):assert sha(Path(p).read_bytes())==h,p
previous=json.loads(Path('tests/fixtures/garden-enrichment-reviewed-changes.json').read_text())
def garden(path,incoming):
 row=previous['changes'].get(path)
 if row:
  assert row['previousSha256']==incoming,(path,'wrong incoming Garden identity',incoming)
  return row['currentSha256']
 return incoming
certified=[]
def accept(consumer,path,incoming):
 if path not in changed:return
 assert incoming==original['sourceInventory'][path],(consumer,path,'not the independently fixed Airfield incoming revision',incoming,original['sourceInventory'][path])
 certified.append({'consumer':consumer,'path':path,'incomingExpectedSha256':incoming})
for name in ['town','quarry','forest','workshop','harvest','desert','snow','caldera']:
 fixture='tests/fixtures/'+('town-enrichment-protected' if name=='town' else 'quarry-enrichment-source-inventory' if name=='quarry' else name+'-enrichment-protected')+'.json'
 row=json.loads(Path(fixture).read_text());scene=json.loads(Path('tests/fixtures/reviewed-scene-revisions.json').read_text())['revisions'];consumer='tests/helpers/town-enrichment-geometry-worker.ts' if name=='town' else f'tests/{name}-enrichment-inventory.test.ts'
 for p,h in row['sourceInventory'].items():
  if p not in changed:continue
  if name=='town':incoming=row.get('reviewedTestContractChanges',{}).get(p,scene.get(p,{}).get('currentSHA256',h))
  else:incoming=row.get('reviewedChanges',{}).get(p,{}).get('currentSHA256',h)
  accept(consumer,p,garden(p,incoming))
# Garden's source inventory and final dependency manifest predate this final pass.
row=json.loads(Path('tests/fixtures/garden-enrichment-original-inventory.json').read_text())
for p,h in row['sourceInventory'].items():accept('tests/garden-enrichment-inventory.test.ts',p,previous['changes'].get(p,{}).get('currentSha256',h))
for name in ['snow','caldera','garden']:
 row=json.loads(Path('docs/'+name+'-enrichment-qa-files.json').read_text())
 for p,h in row['finalFileSha256'].items():
  if p not in changed:continue
  incoming=row.get('calderaReviewedRevisions',{}).get(p,{}).get('currentSHA256',h)
  accept(f'tests/{name}-enrichment-inventory.test.ts#portable',p,incoming if name=='garden' else garden(p,incoming))
mountain=json.loads(Path('tests/fixtures/mountain-source-baseline.json').read_text());scene=json.loads(Path('tests/fixtures/reviewed-scene-revisions.json').read_text())['revisions']
for p,h in mountain['isolatedSceneSources'].items():accept('tests/mountain-enrichment-contract.test.ts',p,scene.get(p,{}).get('currentSHA256',h))
record={'schema':'airfield-enrichment-reviewed-changes-v1','baselineCommit':original['baselineCommit'],'changes':changed,'certifiedIncomingAssertions':certified}
p=Path('tests/fixtures/airfield-enrichment-reviewed-changes.json');p.write_text(json.dumps(record,indent=2)+'\n');helper=Path('tests/helpers/airfield-enrichment-reviewed-revisions.ts');text=helper.read_text();import re
text=re.sub(r"export const AIRFIELD_REVIEWED_CHANGES_SHA256='[^']+';",f"export const AIRFIELD_REVIEWED_CHANGES_SHA256='{sha(p.read_bytes())}';",text)
text=re.sub(r'export const AIRFIELD_REVIEWED_PATHS:string\[\]=[^;]+;',f'export const AIRFIELD_REVIEWED_PATHS:string[]={json.dumps(allowed)};',text);helper.write_text(text)
print(json.dumps({'reviewedPaths':len(changed),'certifiedIncomingAssertions':len(certified),'reviewFixtureSha256':sha(p.read_bytes())}))
