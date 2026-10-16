import {assertHistoricalPreviewInputs,assertCurrentPreviewLayout} from './helpers/historical-preview-layout';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {WORKSHOP_COURSE} from '../src/maps/workshop';
const sha=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
test('workshop historical menu poster retains exact provenance and compatible current route/landmark framing',()=>{
 const p=JSON.parse(readFileSync('docs/workshop-preview-provenance.json','utf8'));
 assert.equal(p.kind,'offline-native-geometry-render');
 assert.match(p.renderer,/No gameplay\/GPU or FPS claim/);
 assertHistoricalPreviewInputs('docs/workshop-preview-provenance.json',p);
 assertCurrentPreviewLayout('workshop',p);
 assert.ok(p.batches<=24&&p.triangles<110000);
 const image=readFileSync(p.menuAsset.file);
 assert.equal(sha(p.menuAsset.file),p.menuAsset.sha256);
 assert.equal(image.toString('ascii',0,4),'RIFF');assert.equal(image.toString('ascii',8,12),'WEBP');
 assert.equal(image.readUInt16LE(26)&0x3fff,1280);assert.equal(image.readUInt16LE(28)&0x3fff,720);
 assert.ok(image.length>10000&&image.length<500000);
 for(const key of ['workshop-overview','workshop-topdown']){
  const bounds=p.views[key].routeScreenBounds;
  assert.equal(bounds.length,4);assert.ok(bounds.every(Number.isFinite));
  assert.ok(Math.min(...bounds.slice(0,2))>=.059&&Math.max(...bounds.slice(2))<=.941,key);
 }
 assert.ok(WORKSHOP_COURSE.edges.alley.length<WORKSHOP_COURSE.edges.boulevard.length);
 assert.ok(p.sourceHashes['src/workshop-scenery.ts']);assert.ok(p.sourceHashes['src/maps/workshop.ts']);
});
