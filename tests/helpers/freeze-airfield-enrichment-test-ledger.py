"""Freeze reviewed exact text transformations from immutable git objects.
This is an audit-author operation; it does not change an original source baseline.
"""
from pathlib import Path
import subprocess,json,difflib,hashlib,re
sha=lambda b:hashlib.sha256(b).hexdigest()
base='fc5360139c00e0d60148afabd0d24ed85c272ed6';paths=['tests/airfield-gameplay.test.ts','tests/mountain-enrichment-contract.test.ts','tests/helpers/town-enrichment-geometry-worker.ts']+[f'tests/{n}-enrichment-inventory.test.ts' for n in ['quarry','forest','workshop','harvest','desert','snow','caldera','garden']];rows=[]
for p in paths:
 b=subprocess.check_output(['git','show',base+':'+p]).decode();a=Path(p).read_text();old=b.splitlines(keepends=True);new=a.splitlines(keepends=True);h=[]
 for tag,i,j,k,l in difflib.SequenceMatcher(None,old,new,autojunk=False).get_opcodes():
  if tag!='equal':h.append({'startLine':i,'removedLines':old[i:j],'insertedLines':new[k:l]})
 rows.append({'path':p,'beforeSha256':sha(b.encode()),'afterSha256':sha(a.encode()),'scope':'Only native original/new face classification' if p=='tests/airfield-gameplay.test.ts' else 'Only exact Airfield incoming/reviewed hash overlay','hunks':h})
p=Path('tests/fixtures/airfield-enrichment-test-transformations.json');p.write_text(json.dumps({'schema':'airfield-enrichment-test-transformations-v1','baselineCommit':base,'files':rows},indent=2)+'\n');digest=sha(p.read_bytes());test=Path('tests/airfield-enrichment-inventory.test.ts');text=test.read_text();text=re.sub(r"(const bytes=readFileSync\('tests/fixtures/airfield-enrichment-test-transformations.json','utf8'\);assert.equal\(sha\(bytes\),')[^']+'",r'\g<1>'+digest+"'",text);test.write_text(text);print(json.dumps({'files':len(rows),'ledgerSha256':digest}))
