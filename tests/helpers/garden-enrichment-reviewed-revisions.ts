/** Exact Garden-only review layer over immutable older fixtures and manifests. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gardenSha} from './garden-enrichment-contract';
export const GARDEN_REVIEWED_CHANGES_SHA256='9849bf067b63fa83f22ad75dac63ff4a560c601c210d241676ad06cbd6307afa';
export const GARDEN_REVIEWED_PATHS:string[]=["docs/garden-preview-provenance.json", "public/map-previews/garden-overview.webp", "src/garden-scenery.ts", "tests/caldera-enrichment-inventory.test.ts", "tests/desert-enrichment-inventory.test.ts", "tests/fixtures/reviewed-scene-revisions.json", "tests/forest-enrichment-inventory.test.ts", "tests/garden-gameplay.test.ts", "tests/garden-independent-audit.test.ts", "tests/garden-preview-assets.test.ts", "tests/garden-scene.test.ts", "tests/harvest-enrichment-inventory.test.ts", "tests/helpers/town-enrichment-geometry-worker.ts", "tests/mountain-enrichment-contract.test.ts", "tests/quarry-enrichment-inventory.test.ts", "tests/snow-enrichment-inventory.test.ts", "tests/workshop-enrichment-inventory.test.ts"];
export function assertGardenReviewedBytes(text:string){assert.equal(gardenSha(text),GARDEN_REVIEWED_CHANGES_SHA256,'Independently pinned exact reviewed replacements');const review=JSON.parse(text);assert.deepEqual(Object.keys(review.changes).sort(),[...GARDEN_REVIEWED_PATHS].sort(),'Only individually enumerated reviewed paths');return review;}
let cached:any;
export function gardenReviewedRevisions(){
 if(!cached){const originalText=readFileSync('tests/fixtures/garden-enrichment-original-inventory.json','utf8');assert.equal(gardenSha(originalText),'ee38acf0339c017150d2ed99a70ebaf2bf4ea5555dd8beb3ea7a47647a1c26d4');const original=JSON.parse(originalText),review=assertGardenReviewedBytes(readFileSync('tests/fixtures/garden-enrichment-reviewed-changes.json','utf8'));assert.equal(review.baselineCommit,original.baselineCommit);for(const [path,row]of Object.entries<any>(review.changes)){assert.equal(row.previousSha256,original.sourceInventory[path],path+' previous exact baseline revision');assert.ok(row.scope);assert.match(row.currentSha256,/^[0-9a-f]{64}$/);}cached={baselineCommit:review.baselineCommit,changes:review.changes};}
 return cached;
}
export function gardenReviewedHash(path:string,previous:unknown){const row=gardenReviewedRevisions().changes[path];if(!row)return previous;assert.equal(row.previousSha256,previous,path+' incoming historical expected revision is still exact');return row.currentSha256;}
export function gardenReviewedPathsWithin(inventory:Record<string,unknown>){return Object.keys(gardenReviewedRevisions().changes).filter(p=>p in inventory);}
