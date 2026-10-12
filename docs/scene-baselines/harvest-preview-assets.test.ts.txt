import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {HARVEST_COURSE} from '../src/maps/harvest';
const sha=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
test('harvest menu poster derives from current original runtime geometry with both physical branches framed',()=>{
 const p=JSON.parse(readFileSync('docs/harvest-preview-provenance.json','utf8'));
 assert.equal(p.kind,'offline-native-geometry-render');
 assert.match(p.renderer,/No gameplay\/GPU or FPS claim/);
 for(const [path,digest] of Object.entries({...p.sourceHashes,...p.generatorHashes}))assert.equal(sha(path),digest,path);
 assert.ok(p.batches<=24&&p.triangles<110000);
 const image=readFileSync(p.menuAsset.file);
 assert.equal(sha(p.menuAsset.file),p.menuAsset.sha256);
 assert.equal(image.toString('ascii',0,4),'RIFF');assert.equal(image.toString('ascii',8,12),'WEBP');
 assert.equal(image.readUInt16LE(26)&0x3fff,1280);assert.equal(image.readUInt16LE(28)&0x3fff,720);
 assert.ok(image.length>10000&&image.length<500000);
 for(const key of ['harvest-overview','harvest-topdown']){
  const bounds=p.views[key].routeScreenBounds;
  assert.equal(bounds.length,4);assert.ok(bounds.every(Number.isFinite));
  assert.ok(Math.min(...bounds.slice(0,2))>=.059&&Math.max(...bounds.slice(2))<=.941,key);
 }
 assert.ok(HARVEST_COURSE.edges.alley.length<HARVEST_COURSE.edges.boulevard.length);
 assert.ok(p.sourceHashes['src/harvest-scenery.ts']);assert.ok(p.sourceHashes['src/maps/harvest.ts']);
});
