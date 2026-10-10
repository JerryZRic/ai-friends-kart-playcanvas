import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {catalog, KART_SLOTS, defaultBuild, buildStats, kartTuning, partsBySlot, VEHICLE_CLAMPS} from '../src/kart-build';
import {CHARACTER_PROFILES, characterTuning} from '../src/character-profiles';
import {wholeCars} from '../src/kart-whole-cars';
import {loadFoodKartPayload, clearFoodKartPayloadCache} from '../src/food-kart-payload';
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const manifest = JSON.parse(readFileSync('public/models/food-karts/manifest.json','utf8'));
const rice = wholeCars.find(car => car.number === 0)!;

test('000 pure rice is first for testing and all original 54 themes, stats and bundles remain unchanged', () => {
 assert.equal(wholeCars.length, 55); assert.equal(catalog.length, 330); assert.equal(wholeCars[0].id, '000-white-rice');
 assert.equal(manifest.kits[0].id, rice.id); assert.equal(manifest.parts[0].kitId, rice.id);
 const source = JSON.parse(readFileSync('src/kart-catalog.json','utf8'));
 assert.equal(hash(JSON.stringify(source.parts.filter(part=>part.kitNumber>0))), '047fd998c678a11c12ee7341d69534ad0492fdd45ab24d05252ebbe2984c057d');
 assert.equal(hash(JSON.stringify(manifest.kits.filter(kit=>kit.number!=='000').map(kit=>[kit.id,kit.bundleSha256]))), '93ec67475aadad172801ac5e2e02a60dc249b3ec8c38a70efd308fd8267e2f58');
 assert.deepEqual(source.experimentalKits[0], {id:'000-white-rice',futureHidden:true,currentFreeTestVisible:true,sortOrder:0,statPolicy:'Neutral reference design estimates; no exclusive or same-theme bonus'});
});
test('000 per-part balance exactly matches neutral design references in full and mixed builds', () => {
 const source = JSON.parse(readFileSync('src/kart-catalog.json','utf8'));
 for (const slot of KART_SLOTS) assert.deepEqual(catalog.find(part=>part.id===rice.build[slot])!.physicalDesign, source.referenceParts[slot]);
 assert.deepEqual(buildStats(rice.build),buildStats(defaultBuild));
 for (const driver of CHARACTER_PROFILES) {
  const base = characterTuning(driver.id,'coast'), tuned = kartTuning(driver.id,'coast',rice.build);
  assert.equal(tuned.maxSpeed,base.maxSpeed);assert.equal(tuned.acceleration,base.acceleration);assert.equal(tuned.steering,base.steering);
 }
 for (const slot of KART_SLOTS) for(const part of partsBySlot[slot]) {
  const stats = buildStats({...rice.build,[slot]:part.id});
  for (const key of ['acceleration','speed','handling'] as const) {assert.ok(Number.isFinite(stats.multipliers[key]));assert.ok(stats.multipliers[key]>=VEHICLE_CLAMPS[key][0]&&stats.multipliers[key]<=VEHICLE_CLAMPS[key][1]);}
 }
});
test('000 has honest source-to-runtime provenance and one bounded on-demand transport for all six modules', async () => {
 const proof=JSON.parse(readFileSync('docs/white-rice-runtime-provenance.json','utf8')), kit=manifest.kits[0], previous=globalThis.fetch, requests:string[]=[];
 assert.equal(proof.selectedVariant,'C_PlainRice');assert.equal(proof.sourceBlendSha256,'e59b6681eb158af9f3ca89a9c53fb78f9be68449c0fafc8323dec8cfa7794af9');
 assert.equal(proof.runtimeDerivation,'approved-pure-rice-optimized-v1');assert.equal(proof.parts.length,6);
 const records=manifest.parts.filter(part=>part.kitNumber==='000');
 assert.equal(records.reduce((n,p)=>n+p.triangles,0),89712);assert.equal(records.reduce((n,p)=>n+p.materialPrimitives,0),18);assert.ok(records.every(p=>p.images.length===0&&p.sourceOriginalSha256!==p.originalSha256));
 clearFoodKartPayloadCache();globalThis.fetch=async input=>{const path=new URL(String(input)).pathname.slice(1);requests.push(path);const bytes=readFileSync('public/'+path);return new Response(bytes,{headers:{'content-length':String(bytes.length)}});};
 try {for(const part of records){const bytes=new Uint8Array(await loadFoodKartPayload(part.id));assert.equal(hash(bytes),part.originalSha256);const header=new DataView(bytes.buffer);const gltf=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+header.getUint32(12,true))));assert.ok(gltf.meshes.every(mesh=>mesh.primitives.every(primitive=>Number.isInteger(primitive.attributes.COLOR_0))));assert.ok(!gltf.images?.length);}
 assert.deepEqual(requests,['models/food-karts/manifest.json',kit.bundlePath]);
 } finally {globalThis.fetch=previous;clearFoodKartPayloadCache();}
});
