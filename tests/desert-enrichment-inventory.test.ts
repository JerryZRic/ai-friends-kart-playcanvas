/** Additive Desert scenery has no permission to rebaseline native safety gates. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const receipt=JSON.parse(readFileSync('tests/fixtures/desert-enrichment-protected.json','utf8'));
const reviewedPaths=['src/snow-scenery.ts','tests/snow-scene.test.ts','tests/snow-independent-audit.test.ts','tests/snow-preview-assets.test.ts','docs/snow-preview-provenance.json','public/map-previews/snow-overview.webp',
 'src/desert-scenery.ts','tests/desert-scene.test.ts','tests/desert-independent-audit.test.ts','tests/desert-preview-assets.test.ts',
 'docs/desert-preview-provenance.json','public/map-previews/desert-overview.webp',
 'tests/mountain-enrichment-contract.test.ts','tests/helpers/town-enrichment-geometry-worker.ts',
 'tests/quarry-enrichment-inventory.test.ts','tests/forest-enrichment-inventory.test.ts','tests/workshop-enrichment-inventory.test.ts','tests/harvest-enrichment-inventory.test.ts',
 'tests/fixtures/reviewed-scene-revisions.json','tests/fixtures/town-enrichment-protected.json','tests/fixtures/quarry-enrichment-source-inventory.json','tests/fixtures/forest-enrichment-protected.json','tests/fixtures/workshop-enrichment-protected.json','tests/fixtures/harvest-enrichment-protected.json',
];
test('Desert immutable source and native safety inventories retain the exact original baseline',()=>{
 assert.equal(receipt.schema,'desert-enrichment-protected-v1');
 assert.equal(receipt.baselineSourceCommit,'077d232f4b4160d8928cce8cd85d0008c7212747');
 assert.equal(receipt.baselinePublicCommit,'915109353ed1d2fcdc8afbb5bdacafca3648e92e');
 assert.equal(Object.keys(receipt.sourceInventory).length,709);
 assert.equal(sha(JSON.stringify(receipt.sourceInventory)),'fa6d162f70a1814eba26c13bfb6ec427fb5eae9ae70d106401ba9735c97d32a6');
 assert.equal(sha(JSON.stringify(receipt.protectedFiles)),'a81ff8371f18ab3806ec93e585da9a740ff78f686265f41e1335444379602509');
 assert.equal(sha(JSON.stringify(receipt.historicalContracts)),'fb060d1224388209101d4c6b577ca351bc0e43c882b909cdd46a29e8b25d7d7c');assert.equal(sha(JSON.stringify(receipt.historicalSceneRevisions)),'871ce2dc1733d0545e5c5f089e0319b73132170dcce498597dcbda9159330ae5');
 for(const [file,original]of Object.entries(receipt.historicalContracts)){const current=JSON.parse(readFileSync(file,'utf8'));for(const [key,value]of Object.entries(original))assert.deepEqual(current[key],value,file+' nested original contract remains immutable');}
 const reviewed=JSON.parse(readFileSync('tests/fixtures/reviewed-scene-revisions.json','utf8'));for(const [file,revision]of Object.entries(receipt.historicalSceneRevisions.revisions))assert.deepEqual(reviewed.revisions[file],revision,'Earlier accepted scene revisions cannot be rebased');
 for(const [file,hash]of Object.entries(receipt.protectedFiles))assert.equal(sha(readFileSync(file)),hash,file+' protected route/physics/camera/other scene changed');
 assert.equal(receipt.originalScenerySha256,'ea35a4a1d40ea12ec0b74e1cc2276e78bc722d16ecdae154c2fa1f602f96672c');
 assert.equal(sha(readFileSync('docs/scene-baselines/desert-scenery.ts.txt')),receipt.originalScenerySha256);
 assert.deepEqual(receipt.baselineCounts,{batches:22,triangles:107224,vertices:133911});
 assert.deepEqual(Object.keys(receipt.reviewedChanges).sort(),[...reviewedPaths].sort());const changed:string[]=[];
 for(const [file,original]of Object.entries(receipt.sourceInventory)){
  const actual=sha(readFileSync(file)),review=receipt.reviewedChanges[file];
  if(review){assert.equal(review.previousSHA256,original,file+' immutable original hash');assert.ok(review.scope);assert.match(review.currentSHA256,/^[a-f0-9]{64}$/);assert.equal(actual,review.currentSHA256,file+' precise reviewed revision');}
  else assert.equal(actual,original,file+' unreviewed original input changed');
  if(actual!==original)changed.push(file);
 }
 assert.deepEqual(changed.sort(),[...reviewedPaths].sort());
 const files=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]);
 const temporary=/^\.[a-z][a-z0-9-]+-\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.ts$/;
 assert.deepEqual(files('src').filter(p=>!temporary.test(p.split('/').at(-1)!)).sort(),Object.keys(receipt.sourceInventory).filter(p=>p.startsWith('src/')).sort(),'No new production source, twelfth map or alternate runtime');
});
test('Desert final source and six inherited isolation consumers bind exactly one new reviewed revision',()=>{
 const file='src/desert-scenery.ts',currentSHA256='aa2ad6819309066caa4a7acd74f3df55a037358c9c9f3c551a0d0bcbf5ccf713';
 assert.equal(sha(readFileSync(file)),currentSHA256);assert.equal(receipt.reviewedChanges[file].currentSHA256,currentSHA256);
 const all=JSON.parse(readFileSync('tests/fixtures/reviewed-scene-revisions.json','utf8'));
 assert.equal(all.schemaVersion,1);assert.equal(all.baseCommit,receipt.historicalSceneRevisions.baseCommit);
 assert.deepEqual(Object.keys(all.revisions).sort(),['src/snow-scenery.ts',file,...Object.keys(receipt.historicalSceneRevisions.revisions)].sort());
 assert.equal(all.revisions[file].previousSHA256,receipt.originalScenerySha256);assert.equal(all.revisions[file].currentSHA256,currentSHA256);assert.ok(all.revisions[file].scope);
 const mountain=JSON.parse(readFileSync('tests/fixtures/mountain-source-baseline.json','utf8'));assert.equal(mountain.isolatedSceneSources[file],receipt.originalScenerySha256);
 for(const name of ['town-enrichment-protected','quarry-enrichment-source-inventory','forest-enrichment-protected','workshop-enrichment-protected','harvest-enrichment-protected']){
  const old=JSON.parse(readFileSync('tests/fixtures/'+name+'.json','utf8'));assert.equal(old.sourceInventory[file],receipt.originalScenerySha256);if(old.reviewedChanges)assert.equal(old.reviewedChanges[file].currentSHA256,currentSHA256);
 }
});
test('Desert final catalog uses current source and the exact frozen legacy cameras',()=>{
 const preview=JSON.parse(readFileSync('docs/desert-preview-provenance.json','utf8'));
 const full=JSON.parse(readFileSync('docs/desert-enrichment-preview-provenance.json','utf8'));
 const frozen=JSON.parse(readFileSync('tests/helpers/desert-enrichment-camera-frozen.json','utf8'));
 const selection=JSON.parse(readFileSync('docs/desert-enrichment-final-views.json','utf8'));
 assert.equal(preview.sourceHashes['src/desert-scenery.ts'],receipt.reviewedChanges['src/desert-scenery.ts'].currentSHA256);
 assert.deepEqual([preview.batches,preview.triangles,preview.vertices],[22,118490,154180]);assert.equal(preview.triangles-receipt.baselineCounts.triangles,11266);
 assert.equal(preview.menuAsset.sha256,sha(readFileSync(preview.menuAsset.file)));
 assert.equal(preview.localCatalogUpdaterSha256,sha(readFileSync('scripts/update-desert-enrichment-catalog.py')));
 assert.equal(preview.frozenCameraManifestSha256,sha(readFileSync('docs/desert-enrichment-cameras.json')));
 assert.equal(preview.verifiedRenderSettings.samples,48);assert.equal(preview.verifiedRenderSettings.cpuThreads,2);assert.equal(preview.verifiedRenderSettings.seed,17);
 for(const [file,hash]of Object.entries({...preview.sourceHashes,...preview.generatorHashes}))assert.equal(sha(readFileSync(file)),hash,file+' actual source and generator binding');
 for(const [file,hash]of Object.entries(receipt.sourceInventory))if(file==='scripts/export-desert-preview.ts'||file==='scripts/render-desert-preview.py')assert.equal(preview.generatorHashes[file],hash,'Original exporter and source-normal importer stay exact');
 assert.deepEqual(Object.keys(preview.views).sort(),Object.keys(frozen.catalogViews).sort());
 for(const [name,original]of Object.entries<any>(frozen.catalogViews))for(const key of ['resolution','cameraPositionBlender','cameraQuaternionBlender','projection','orthographicScaleMetres','lensMillimetres','roadEdge','roadDistanceMetres','heightAboveSampledRoadMetres','sourceDriverPose','lookTargetSourceCoordinates'])if(key in original)assert.deepEqual(preview.views[name][key],original[key],name+' frozen '+key);
 assert.equal(selection.samples,48);assert.equal(selection.views.length,18);assert.deepEqual(Object.keys(full.views).sort(),[...selection.views].sort());
 for(const [key,value]of Object.entries(preview))if(key!=='views')assert.deepEqual(full[key],value,'Catalog and full proof '+key);
 for(const [name,value]of Object.entries(preview.views))assert.deepEqual(full.views[name],value,name+' same final catalog pixels');
 for(const name of selection.views){
  const v=full.views[name];assert.equal(v.samples,48);assert.match(v.sha256,/^[a-f0-9]{64}$/);
  const original=frozen.views.find((view:any)=>view.name===name);
  if(original)for(const [key,value]of Object.entries(original))if(key!=='samples')assert.deepEqual(v[key],value,name+' unchanged native-like '+key);
 }
 for(const field of ['finalPairedProofSha256','reopenedModelProofSha256'])assert.match(preview[field],/^[a-f0-9]{64}$/);
});
test('Desert permits only three exact numeric native-test cap replacements',()=>{
 assert.deepEqual(receipt.historicalBudget,{trianglesExclusive:110000,verticesExclusive:200000,batches:22,sharedBatchCeiling:24});
 assert.deepEqual(receipt.approvedBudget,{trianglesExclusive:125000,verticesExclusive:200000,batches:22,addedTrianglesInclusive:16000});
 const deltas=[
  {file:'tests/desert-scene.test.ts',before:'triangles<110000',after:'triangles<125000'},
  {file:'tests/desert-independent-audit.test.ts',before:'triangles<110000',after:'triangles<125000'},
  {file:'tests/desert-preview-assets.test.ts',before:'p.triangles<110000',after:'p.triangles<125000'},
 ];
 assert.deepEqual(receipt.permittedNativeTestDeltas,deltas);
 for(const {file,before,after}of deltas){const original=readFileSync('docs/scene-baselines/'+file.split('/').at(-1)+'.txt','utf8');assert.equal(sha(original),receipt.sourceInventory[file]);assert.equal(original.split(before).length-1,1);assert.equal(readFileSync(file,'utf8'),original.replace(before,after),file+' all original camera/contact/pickup/route assertions must remain byte-identical');}
 const scene=readFileSync('src/desert-scenery.ts','utf8');assert.equal(scene.split('budget.triangles>=125000').length-1,1);assert.ok(!scene.includes('budget.triangles>=110000'));assert.equal(scene.split('budget.vertices>=200000').length-1,1);
});
test('Desert art-review manifest preserves every pre-edit native-like and catalog camera',()=>{
 const frozen=JSON.parse(readFileSync('tests/helpers/desert-enrichment-camera-frozen.json','utf8'));assert.equal(sha(JSON.stringify(frozen)),'170d0147641810d7f043761f8f951bac32f1a6c57bdd115e90eda7086eed78c9');
 const manifest=JSON.parse(readFileSync('docs/desert-enrichment-cameras.json','utf8'));for(const [key,value]of Object.entries(frozen))assert.deepEqual(manifest[key],value,'Exact frozen '+key);
 assert.equal(manifest.baseline.sourceHashes['src/desert-scenery.ts'],receipt.originalScenerySha256);assert.equal(frozen.views.length,30);assert.equal(Object.keys(frozen.catalogViews).length,5);
 for(const v of frozen.views){assert.equal(v.verticalFovDegrees,56);assert.deepEqual(v.resolution,[1280,800]);assert.equal(v.samples,8);}
});
