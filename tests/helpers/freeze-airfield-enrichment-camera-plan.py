"""One-time original-only camera inputs. Refuses candidate source and existing plan."""
from pathlib import Path
import hashlib,json
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
original=json.loads(Path('tests/fixtures/airfield-enrichment-original-inventory.json').read_text())
assert sha('src/airfield-scenery.ts')==original['sourceInventory']['src/airfield-scenery.ts']
views=json.loads(Path('docs/airfield-enrichment-cameras.json').read_text())
p=Path('tests/helpers/airfield-enrichment-camera-frozen.json');assert not p.exists()
plan={'schema':'airfield-enrichment-camera-plan-v1','baselineCommit':original['baselineCommit'],'originalSourceSha256':original['sourceInventory']['src/airfield-scenery.ts'],'originalGeometryFixtureSha256':sha('tests/fixtures/airfield-enrichment-original-geometry.json'),'reviewViewsSha256':sha('docs/airfield-enrichment-cameras.json'),'reviewViews':len(views['views']),'reviewChases':sum(v['kind'].startswith('chase') for v in views['views']),'protected':{k:v for k,v in original['sourceInventory'].items() if k.startswith('src/') and k!='src/airfield-scenery.ts'},'local':{'spacingMetres':2,'windowExpansionMetres':25,'windows':[{'id':'workshop','edge':'start','from':210,'to':300},{'id':'court','edge':'boulevard','from':130,'to':245},{'id':'terrace','edge':'finish','from':720,'to':850}],'laneFractions':[-1,0,1],'views':[0,1],'yawSteps':24,'pitches':[-.5,0,.5,1.15],'ratesHz':[30,60,144],'speedMetresPerSecond':55}}
p.write_text(json.dumps(plan,indent=2)+'\n');target=Path('tests/helpers/airfield-enrichment-camera-records.ts');target.write_text(target.read_text().replace('PENDING_CAMERA_PLAN_FREEZE',sha(p)));print(json.dumps({'planSha256':sha(p),'reviewViews':plan['reviewViews'],'reviewChases':plan['reviewChases']}))
