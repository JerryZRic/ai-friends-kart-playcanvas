/** Original source and gameplay goldens remain immutable. Separately reviewed
 * scene and QA-contract revisions have explicit old/new hashes, never wildcards. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const hash=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
const receipt=JSON.parse(readFileSync('tests/fixtures/quarry-enrichment-source-inventory.json','utf8'));
const reviewedPaths=['src/forest-scenery.ts','tests/forest-scene.test.ts','src/quarry-scenery.ts','tests/quarry-scene.test.ts','tests/quarry-gameplay-camera.test.ts','tests/mountain-enrichment-contract.test.ts','tests/helpers/town-enrichment-geometry-worker.ts','tests/fixtures/town-enrichment-protected.json','tests/fixtures/reviewed-scene-revisions.json'];
test('Quarry only exact reviewed scene and QA contracts can differ from original full source inventory',()=>{
 assert.equal(receipt.schema,'quarry-enrichment-source-inventory-v1');assert.equal(receipt.baselineSourceCommit,'3a0e97db08bc2c6036d6a8e7000e1c9437551337');assert.equal(receipt.baselineSourceTree,'53751230de3c89645c15bd2c7ff358b4f39623da');assert.equal(Object.keys(receipt.sourceInventory).length,448);
 assert.deepEqual(Object.keys(receipt.reviewedChanges).sort(),reviewedPaths.sort());
 const changed:string[]=[];
 for(const [path,old]of Object.entries(receipt.sourceInventory)){
  const actual=hash(readFileSync(path)),review=receipt.reviewedChanges[path];
  if(review){assert.equal(review.previousSHA256,old,path+' historical source hash must remain intact');assert.match(review.currentSHA256,/^[a-f0-9]{64}$/);assert.ok(review.scope);assert.equal(actual,review.currentSHA256,path+' exact reviewed version changed');}
  else assert.equal(actual,old,path+' unreviewed original input changed');
  if(actual!==old)changed.push(path);
 }
 assert.deepEqual(changed.sort(),reviewedPaths.sort());
 const sourceFiles=(directory:string):string[]=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?sourceFiles(directory+'/'+entry.name):[directory+'/'+entry.name]);
 // Concurrent CI may contain another UUID-owned instrumentation module. Such
 // files are never production inputs or accepted as replacements of old files.
 const transient=/^\.[a-z][a-z0-9-]+-\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.ts$/;
 const found=sourceFiles('src').filter(path=>!transient.test(path.split('/').at(-1)!));
 assert.deepEqual(found.sort(),Object.keys(receipt.sourceInventory).filter(p=>p.startsWith('src/')).sort(),'no added production files or maps');
 const revisions=JSON.parse(readFileSync('tests/fixtures/reviewed-scene-revisions.json','utf8'));
 assert.equal(revisions.revisions['src/quarry-scenery.ts'].previousSHA256,receipt.sourceInventory['src/quarry-scenery.ts']);assert.equal(revisions.revisions['src/quarry-scenery.ts'].currentSHA256,receipt.reviewedChanges['src/quarry-scenery.ts'].currentSHA256);
 const originalTown=JSON.parse(readFileSync('tests/fixtures/town-enrichment-protected.json','utf8'));
 assert.equal(originalTown.originalScenerySha256,originalTown.sourceInventory['src/town-scenery.ts']);
 assert.equal(originalTown.reviewedArtifactRevisions['docs/town-preview-provenance.json'].sha256,'8ac03960e61f175576352a595cd153246d5d4124c1a5298e224b5d6102bf268f');
 assert.equal(originalTown.reviewedArtifactRevisions['public/map-previews/town-overview.webp'].sha256,'4d6471b5c80a9944d3ed249b512e0043b2942326094caf629b6ff3f0684038b0');
});
