import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {DESERT_COURSE} from '../src/maps/desert';
const sha=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
test('desert menu poster derives from current original runtime geometry with both physical branches framed',()=>{
 const p=JSON.parse(readFileSync('docs/desert-preview-provenance.json','utf8'));
 assert.equal(p.kind,'offline-native-geometry-render');
 assert.match(p.renderer,/No gameplay\/GPU or FPS claim/);
 for(const [path,digest] of Object.entries({...p.sourceHashes,...p.generatorHashes}))assert.equal(sha(path),digest,path);
 assert.ok(p.batches<=24&&p.triangles<110000&&p.vertices<200000);
 assert.deepEqual(Object.keys(p.views).sort(),['desert-overview','desert-topdown','desert-driver-reveal','desert-arch-passage','desert-caravan-detail'].sort());
 assert.match(p.normalShading.shader,/Backfacing/);
 assert.equal(p.views['desert-topdown'].projection,'ORTHO');
 const topQuaternion=p.views['desert-topdown'].cameraQuaternionBlender;
 // A roll around the viewing axis does not change a genuine downward camera.
 assert.ok(topQuaternion.length===4&&topQuaternion.every(Number.isFinite));
 assert.ok(Math.abs(topQuaternion[1])<1e-6&&Math.abs(topQuaternion[2])<1e-6);
 assert.ok(Math.abs(topQuaternion[0]**2+topQuaternion[3]**2-1)<1e-6);
 const driver=p.views['desert-driver-reveal'];
 assert.equal(driver.roadEdge,'start');assert.equal(driver.roadDistanceMetres,1050);assert.equal(driver.heightAboveSampledRoadMetres,1.6);
 const image=readFileSync(p.menuAsset.file);
 assert.equal(sha(p.menuAsset.file),p.menuAsset.sha256);
 assert.equal(image.toString('ascii',0,4),'RIFF');assert.equal(image.toString('ascii',8,12),'WEBP');
 assert.equal(image.readUInt16LE(26)&0x3fff,1280);assert.equal(image.readUInt16LE(28)&0x3fff,720);
 assert.ok(image.length>10000&&image.length<500000);
 for(const key of ['desert-overview','desert-topdown']){
  const bounds=p.views[key].routeScreenBounds;
  assert.equal(bounds.length,4);assert.ok(bounds.every(Number.isFinite));
  assert.ok(Math.min(...bounds.slice(0,2))>=.059&&Math.max(...bounds.slice(2))<=.941,key);
  for(const edge of ['alley','boulevard']){const b=p.views[key].physicalBranchScreenBounds[edge];assert.equal(b.length,4);assert.ok(b.every(Number.isFinite));assert.ok(Math.min(...b.slice(0,2))>=.059&&Math.max(...b.slice(2))<=.941,`${key}:${edge}`);}
 }
 assert.ok(DESERT_COURSE.edges.alley.length<DESERT_COURSE.edges.boulevard.length);
 assert.ok(p.sourceHashes['src/desert-scenery.ts']);assert.ok(p.sourceHashes['src/maps/desert.ts']);
});
