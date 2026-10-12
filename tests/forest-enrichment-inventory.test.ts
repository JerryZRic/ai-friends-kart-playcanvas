/** Historical source inventories/goldens are immutable. Reviewed subsequent
 * scene, QA and derived catalog revisions require exact individual hashes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex');
const receipt=JSON.parse(readFileSync('tests/fixtures/forest-enrichment-protected.json','utf8'));
const reviewedPaths=['src/desert-scenery.ts','tests/desert-scene.test.ts','tests/desert-independent-audit.test.ts','tests/desert-preview-assets.test.ts','docs/desert-preview-provenance.json','public/map-previews/desert-overview.webp','src/harvest-scenery.ts','tests/harvest-scene.test.ts','tests/harvest-independent-audit.test.ts','tests/harvest-preview-assets.test.ts','docs/harvest-preview-provenance.json','public/map-previews/harvest-overview.webp','src/workshop-scenery.ts','docs/workshop-preview-provenance.json','public/map-previews/workshop-overview.webp','src/forest-scenery.ts','tests/forest-scene.test.ts','tests/mountain-enrichment-contract.test.ts','tests/helpers/town-enrichment-geometry-worker.ts','tests/fixtures/reviewed-scene-revisions.json','tests/fixtures/town-enrichment-protected.json','tests/quarry-enrichment-inventory.test.ts','tests/fixtures/quarry-enrichment-source-inventory.json','docs/forest-preview-provenance.json','public/map-previews/forest-overview.webp'];
test('Forest exact source isolation preserves539 original inputs and every historical geometry/source golden',()=>{
 assert.equal(receipt.schema,'forest-enrichment-protected-v1');assert.equal(receipt.baselineSourceCommit,'a5ffb65ec9e12f0e80b9643b03335650235b04a1');assert.equal(receipt.baselineSourceTree,'31a857424d0ac0600ea9ab738efac92628377c81');
 assert.equal(Object.keys(receipt.sourceInventory).length,539);assert.equal(sha(JSON.stringify(receipt.sourceInventory)),'f35263c9d3df815881ba35b694a953c0ab490ae1cb2077b6321087235256644f','original Forest inventory is immutable');
 assert.equal(sha(JSON.stringify(receipt.historicalContracts)),'46fd92ed2de5b154db8ecb1b167979bd582976efbe59b261ef7c672f8b509d90','older nested golden snapshots are immutable');
 for(const [file,golden]of Object.entries(receipt.historicalContracts)){const actual=JSON.parse(readFileSync(file,'utf8'));for(const [key,value]of Object.entries(golden))assert.deepEqual(actual[key],value,file+' original '+key+' is unchanged');}
 assert.equal(receipt.originalScenerySha256,'f41fdd4886d01f131cb3b4fdfda5ce36444a80545a45ec8ee20a6457082f8802');assert.equal(sha(readFileSync('docs/scene-baselines/forest-scenery.ts.txt')),receipt.originalScenerySha256);assert.deepEqual(receipt.baselineCounts,{batches:21,vertices:140018,triangles:107780,trees:99});
 assert.deepEqual(Object.keys(receipt.reviewedChanges).sort(),[...reviewedPaths].sort());const changed:string[]=[];
 for(const [file,original]of Object.entries(receipt.sourceInventory)){
  const actual=sha(readFileSync(file)),review=receipt.reviewedChanges[file];if(review){assert.equal(review.previousSHA256,original,file+' historical hash');assert.match(review.currentSHA256,/^[a-f0-9]{64}$/);assert.ok(review.scope);assert.equal(actual,review.currentSHA256,file+' exact reviewed revision');}else assert.equal(actual,original,file+' unreviewed original input');if(actual!==original)changed.push(file);
 }
 assert.deepEqual(changed.sort(),[...reviewedPaths].sort());
 const files=(directory:string):string[]=>readdirSync(directory,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(directory+'/'+e.name):[directory+'/'+e.name]);
 const transient=/^\.[a-z][a-z0-9-]+-\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.ts$/;
 assert.deepEqual(files('src').filter(p=>!transient.test(p.split('/').at(-1)!)).sort(),Object.keys(receipt.sourceInventory).filter(p=>p.startsWith('src/')).sort(),'no added production inputs or twelfth land scene');
 const reviewed=JSON.parse(readFileSync('tests/fixtures/reviewed-scene-revisions.json','utf8')).revisions['src/forest-scenery.ts'];assert.equal(reviewed.previousSHA256,receipt.originalScenerySha256);assert.equal(reviewed.currentSHA256,receipt.reviewedChanges['src/forest-scenery.ts'].currentSHA256);
 const preview=JSON.parse(readFileSync('docs/forest-preview-provenance.json','utf8'));assert.equal(preview.sourceHashes['src/forest-scenery.ts'],reviewed.currentSHA256);assert.equal(preview.menuAsset.sha256,receipt.reviewedChanges['public/map-previews/forest-overview.webp'].currentSHA256);
});

test('Forest reviewed revision fits the exact historical Mountain and Town isolation contracts',()=>{
 const reviewed=JSON.parse(readFileSync('tests/fixtures/reviewed-scene-revisions.json','utf8'));
 assert.equal(reviewed.schemaVersion,1);assert.equal(reviewed.baseCommit,'9b3ba3b6a667d181c56bbf86dae5efb9d800db65');assert.deepEqual(Object.keys(reviewed.revisions).sort(),['src/desert-scenery.ts','src/forest-scenery.ts','src/harvest-scenery.ts','src/quarry-scenery.ts','src/town-scenery.ts','src/workshop-scenery.ts']);
 const town=JSON.parse(readFileSync('tests/fixtures/town-enrichment-protected.json','utf8')),mountain=JSON.parse(readFileSync('tests/fixtures/mountain-source-baseline.json','utf8'));
 for(const [file,review]of Object.entries(reviewed.revisions) as [string,{previousSHA256:string;currentSHA256:string}][]){assert.equal(review.previousSHA256,town.sourceInventory[file],file+' original Town isolation golden');assert.equal(review.previousSHA256,mountain.isolatedSceneSources[file],file+' original Mountain isolation golden');assert.equal(sha(readFileSync(file)),review.currentSHA256,file+' exact reviewed scene revision');}
 const townChanges=Object.entries(town.sourceInventory).filter(([file,original])=>sha(readFileSync(file))!==original).map(([file])=>file);assert.deepEqual(townChanges.sort(),[...Object.keys(reviewed.revisions),...Object.keys(town.reviewedTestContractChanges)].sort());
 for(const [file,digest]of Object.entries(town.reviewedTestContractChanges))assert.equal(sha(readFileSync(file)),digest,file+' exact Town QA contract revision');
 for(const [file,digest]of Object.entries(mountain.isolatedSceneSources))assert.equal(sha(readFileSync(file)),reviewed.revisions[file]?.currentSHA256??digest,file+' unrelated Mountain input is exact');
});
