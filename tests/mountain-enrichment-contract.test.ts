import {mobileControlsHash} from './helpers/mobile-controls-reviewed-revisions';
import {airfieldReviewedHash} from './helpers/airfield-enrichment-reviewed-revisions';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MOUNTAIN_TRACK} from '../src/maps/mountain';
import {buildMountainSceneGeometry} from '../src/mountain-scenery';
import {mountainProtectedSources,mountainRouteContract,mountainRoadContract,mountainPlacementContract,mountainIsolatedSceneSources,mountainUnrelatedLoaderContract,mountainUnrelatedMenuContract,mountainPierContract} from './helpers/mountain-baseline-contract';
const golden=JSON.parse(readFileSync(new URL('./fixtures/mountain-source-baseline.json',import.meta.url),'utf8'));
const reviewed=JSON.parse(readFileSync(new URL('./fixtures/reviewed-scene-revisions.json',import.meta.url),'utf8'));
test('Mountain route driver physics AI items controls and shared camera source stay exactly unchanged',()=>{
 assert.equal(golden.baseCommit,'769911cc562b9330a57f043e9a7f9a2f0a976dac');
 for(const file of mountainProtectedSources)assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),mobileControlsHash(file,golden.protectedSources[file]),file+' changed during scenery-only enrichment');
 assert.equal(mountainPlacementContract(readFileSync('src/land-course.ts','utf8')),golden.protectedPlacementSHA256,'shared grade/camber placement stays exact while loader changes');
 assert.deepEqual(mountainRouteContract(MOUNTAIN_TRACK),golden.route,'every sampled Float64 frame/width/grade/camber/surface remains exact');
});
test('Mountain emitted original road positions indices and UVs remain bit-identical to pristine base',()=>{
 const geometry=buildMountainSceneGeometry(MOUNTAIN_TRACK);assert.deepEqual(mountainRoadContract(geometry),golden.roads);assert.equal(geometry.roadSamples.length,960);assert.equal(MOUNTAIN_TRACK.sections.length,8);assert.deepEqual(mountainPierContract(geometry),golden.originalPiers,'all forty-six original pier placements and exact emitted dimensions/topology remain pristine');
});

test('Mountain isolation preserves unrelated inputs with only exact separately reviewed Town Quarry Forest Workshop Harvest and Desert scenery revisions',()=>{
 assert.equal(reviewed.schemaVersion,1);
 assert.equal(reviewed.baseCommit,'9b3ba3b6a667d181c56bbf86dae5efb9d800db65');
 assert.deepEqual(Object.keys(reviewed.revisions).sort(),['src/caldera-scenery.ts','src/desert-scenery.ts','src/forest-scenery.ts','src/garden-scenery.ts','src/harvest-scenery.ts','src/quarry-scenery.ts','src/snow-scenery.ts','src/town-scenery.ts','src/workshop-scenery.ts']);
 for(const file of mountainIsolatedSceneSources){
  const revision=reviewed.revisions[file];
  if(revision){
   assert.equal(revision.previousSHA256,golden.isolatedSceneSources[file],'historical isolation baseline must remain exact');
   assert.match(revision.currentSHA256,/^[a-f0-9]{64}$/);
  }
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),airfieldReviewedHash(file,revision?.currentSHA256??golden.isolatedSceneSources[file]),file+' unreviewed scene input changed');
 }
 assert.equal(mountainUnrelatedLoaderContract(readFileSync('src/land-course.ts','utf8')),golden.unrelatedLoaderSHA256,'non-Mountain loader branches stay source-exact');
 assert.equal(mountainUnrelatedMenuContract(readFileSync('src/menu-backdrop.ts','utf8')),golden.unrelatedMenuSHA256,'non-Mountain menu branches stay source-exact');
});
