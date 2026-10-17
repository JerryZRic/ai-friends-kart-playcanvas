import {postV100PortableClosure,restorePostV100Bytes} from './helpers/post-v100-current';
import {airfieldReviewedHash,airfieldReviewedPathsWithin} from './helpers/airfield-enrichment-reviewed-revisions';
import {gardenIndependentCompatibility} from './helpers/garden-enrichment-original-assemblies';
/** Immutable original evidence and exact separately reviewed current identities. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {gardenSha as sha,gardenFrozenBaseline,GARDEN_ORIGINAL_SOURCE_SHA256} from './helpers/garden-enrichment-contract';
const originalText=readFileSync('tests/fixtures/garden-enrichment-original-inventory.json','utf8');
assert.equal(sha(originalText),'ee38acf0339c017150d2ed99a70ebaf2bf4ea5555dd8beb3ea7a47647a1c26d4','Original source inventory is immutable');
const original=JSON.parse(originalText);
test('Garden independently frozen original source and every old test snapshot remain exact',()=>{
 assert.equal(original.baselineCommit,'36a4e224e915f2481513c805a9ed4f6445199d6d');assert.equal(sha(readFileSync('docs/scene-baselines/garden-original/src/garden-scenery.ts.txt')),GARDEN_ORIGINAL_SOURCE_SHA256);
 assert.deepEqual(gardenFrozenBaseline().budget,{batches:21,triangles:108557,vertices:117223});
 const files=Object.keys(original.sourceInventory).filter(p=>/^tests\/garden.*\.test\.ts$/.test(p)||['src/garden-scenery.ts','docs/garden-preview-provenance.json'].includes(p));assert.equal(files.filter(p=>p.startsWith('tests/')).length,13);
 for(const path of files)assert.equal(sha(readFileSync('docs/scene-baselines/garden-original/'+path+'.txt')),original.sourceInventory[path],path+' exact historical snapshot');
});
test('Garden current-source changes have separately reviewed exact hashes without rebasing old evidence',()=>{
 const reviewed=JSON.parse(readFileSync('tests/fixtures/garden-enrichment-reviewed-changes.json','utf8'));
 assert.equal(reviewed.baselineCommit,original.baselineCommit);assert.equal(reviewed.certifiedIncomingAssertions.length,108);for(const row of reviewed.certifiedIncomingAssertions){assert.ok(Object.hasOwn(reviewed.changes,row.path));assert.equal(row.incomingExpectedSha256,original.sourceInventory[row.path],row.consumer+' original incoming expectation');}const changed:string[]=[];
 for(const [path,hash]of Object.entries(original.sourceInventory)){const actual=sha(readFileSync(path)),revision=reviewed.changes[path];if(revision){assert.equal(revision.previousSha256,hash);assert.equal(actual,airfieldReviewedHash(path,revision.currentSha256),path+' separately reviewed current revision');assert.ok(revision.scope);}else assert.equal(actual,airfieldReviewedHash(path,hash),path+' unchanged original input');if(actual!==hash)changed.push(path);}
 assert.deepEqual(changed.sort(),[...new Set([...Object.keys(reviewed.changes),...airfieldReviewedPathsWithin(original.sourceInventory)])].sort());
 const sceneRevisions=JSON.parse(readFileSync('tests/fixtures/reviewed-scene-revisions.json','utf8'));delete sceneRevisions.revisions['src/garden-scenery.ts'];assert.deepEqual(sceneRevisions,reviewed.historicalSceneRevisionRecord,'All eight complete older scene revision records remain exact');
 for(const [path,record]of Object.entries(reviewed.historicalJsonRecords) as [string,any][]){const current=JSON.parse(readFileSync(path,'utf8'));for(const [key,value]of Object.entries(record))assert.deepEqual(current[key],value,path+' exact old nested record '+key);}
});
test('Garden portable manifest contains every retained runner, baseline snapshot, helper and actual art dependency',()=>{
 const manifest=JSON.parse(readFileSync('docs/garden-enrichment-qa-files.json','utf8'));assert.equal(manifest.state,'Final source and QA dependencies frozen');assert.ok(Object.keys(manifest.finalFileSha256).length>0,'Final dependencies cannot be an empty or partial preliminary map');
 const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
 const required=[...walk('docs/scene-baselines/garden-original'),...readdirSync('tests').filter(p=>/^garden-.*\.test\.ts$/.test(p)).map(p=>'tests/'+p),...readdirSync('tests/helpers').filter(p=>p.includes('garden-enrichment')||p==='run-garden-retained-audit.ts'||p==='run-garden-final-audit.ts').map(p=>'tests/helpers/'+p),...readdirSync('tests/fixtures').filter(p=>p.startsWith('garden-enrichment')).map(p=>'tests/fixtures/'+p),...readdirSync('scripts').filter(p=>p.includes('garden-enrichment')||['verify-garden-art-pixels.py','verify-garden-visible-groups.py'].includes(p)).map(p=>'scripts/'+p)];
 const included=new Set([...manifest.newQaFiles,...manifest.unchangedSharedHelperDependencies,...manifest.retainedTestFiles,...manifest.baselineSnapshots,...manifest.artDependencies]);postV100PortableClosure('garden',manifest.finalFileSha256,required);for(const p of included)assert.ok(Object.hasOwn(manifest.finalFileSha256,p as string),p+' listed dependency lacks final identity');
 for(const [file,hash]of Object.entries(manifest.finalFileSha256))assert.equal(sha(readFileSync(file)),airfieldReviewedHash(file,hash),file+' final portable identity');
});

test('Garden retained safety source changes are exactly the approved cap and native ownership transformations',()=>{
 for(const file of ['garden-scene.test.ts','garden-independent-audit.test.ts','garden-preview-assets.test.ts']){
  const before=readFileSync('docs/scene-baselines/garden-original/tests/'+file+'.txt','utf8'),current=restorePostV100Bytes('tests/'+file,readFileSync('tests/'+file,'utf8'));assert.equal(current,file==='garden-independent-audit.test.ts'?gardenIndependentCompatibility(before):before.replaceAll('<110000','<120000').replace('batches110k','batches120k'),file+' no other retained safety weakening');
 }
 const before=readFileSync('docs/scene-baselines/garden-original/tests/garden-gameplay.test.ts.txt','utf8');let expected="import {gardenNativeBlockerComponents} from './helpers/garden-enrichment-native-provenance';\n"+before;
 const start=expected.indexOf(' const componentRanges=new Map<any,any[]>();'),end=expected.indexOf('  let from=0;',start);assert.ok(start>=0&&end>start);
 expected=expected.slice(0,start)+" const componentRanges=new Map<any,any[]>(),certifiedBlockerComponents=gardenNativeBlockerComponents(geometry);\n for(const solid of solids){\n  const components=certifiedBlockerComponents.get(solid)!;\n"+expected.slice(end);
 assert.equal(restorePostV100Bytes('tests/garden-gameplay.test.ts',readFileSync('tests/garden-gameplay.test.ts','utf8')),expected,'Only certified source classification changes; every native safety loop and exact face-coverage count remains');
});

test('Garden exact review overlay rejects wrong incoming hashes, unlisted paths and tampered replacements',async()=>{
 const {gardenReviewedHash,assertGardenReviewedBytes,GARDEN_REVIEWED_PATHS}=await import('./helpers/garden-enrichment-reviewed-revisions'),raw=readFileSync('tests/fixtures/garden-enrichment-reviewed-changes.json','utf8'),review=assertGardenReviewedBytes(raw),first=GARDEN_REVIEWED_PATHS[0];assert.ok(first);
 assert.throws(()=>gardenReviewedHash(first,'0'.repeat(64)),undefined,'Wrong historical incoming revision fails');
 const unlisted=structuredClone(review);unlisted.changes['src/unlisted-safety-bypass.ts']={previousSha256:'0'.repeat(64),currentSha256:'1'.repeat(64),scope:'unauthorized'};assert.throws(()=>assertGardenReviewedBytes(JSON.stringify(unlisted)),undefined,'Unlisted path cannot enter exact approved review layer');
 const replacement=structuredClone(review);replacement.changes[first].currentSha256='f'.repeat(64);assert.throws(()=>assertGardenReviewedBytes(JSON.stringify(replacement)),undefined,'Changed replacement identity fails independent byte pin');
});
