import {assertHistoricalPreviewInputs,assertCurrentPreviewLayout,assertPreviewLayoutEqual,historicalPreviewBytes} from './helpers/historical-preview-layout';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const provenance = JSON.parse(readFileSync('docs/map-preview-provenance.json', 'utf8'));

test('historical overview images retain exact provenance and current route/landmark framing', () => {
  assert.equal(provenance.kind, 'offline-native-geometry-render');
  assert.deepEqual(provenance.resolution, [1280, 720]);
  assert.match(provenance.description, /not browser\/GPU gameplay screenshots/);
  assert.deepEqual(Object.keys(provenance.maps), ['coast', 'waterpark']);
  for (const map of ['coast', 'waterpark']) {
    const record = provenance.maps[map], path = `public/${record.asset}`;
    assert.equal(record.asset, `map-previews/${map}-overview.webp`);
    assert.equal(sha(path), record.sha256, `Stale image: ${map}`);
    const bytes = readFileSync(path);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    // Pillow writes a plain lossy VP8 keyframe without EXIF or other metadata.
    assert.equal(bytes.toString('ascii', 12, 16), 'VP8 ');
    assert.deepEqual([...bytes.subarray(23, 26)], [0x9d, 0x01, 0x2a]);
    assert.equal(bytes.readUInt16LE(26) & 0x3fff, 1280);
    assert.equal(bytes.readUInt16LE(28) & 0x3fff, 720);
    assert.equal(bytes.length, record.bytes);
    assert.ok(bytes.length > 10_000 && bytes.length < 500_000);
    assertHistoricalPreviewInputs('docs/map-preview-provenance.json',{...record,generatorHashes:provenance.generatorHashes});
    // Preserve the older renderer-source identities and their existing exact
    // export-compatibility bridge; this is not a newly rendered image.
    assertHistoricalPreviewInputs(record.compatibilityVerification.file,{});
    const compatibility=JSON.parse(readFileSync(record.compatibilityVerification.file,'utf8')).maps[map];
    assert.deepEqual(record.renderSourceHashes,compatibility.baselineSourceHashes);
    assert.deepEqual(record.sourceHashes,compatibility.sourceHashes);
    assert.equal(record.sha256,compatibility.imageSha256);
    assert.equal(record.compatibilityVerification.normalizedExportSha256,compatibility.normalizedExportSha256);
    assert.equal(compatibility.exactExportEqual,true);
    assertCurrentPreviewLayout(map,record);
    assert.ok(record.meshBatches > 15 && record.triangles > 20_000);
    assert.equal(record.camera.projection, 'orthographic');
    assert.equal(record.camera.elevationDegrees, 68);
    const bounds = record.camera.normalizedSafeBounds;
    assert.ok(Math.min(...bounds.slice(0, 2)) >= .059);
    assert.ok(Math.max(...bounds.slice(2)) <= .941);
    assert.ok(bounds[2] > bounds[0] && bounds[3] > bounds[1]);
  }
});


test('historical preview proof rejects changed source identities, route data, landmark anchors and framing',()=>{
  assert.throws(()=>historicalPreviewBytes('src/track.ts','0'.repeat(64)),/exact archived preview source/);
  const baseline={roadPointCount:1440,landmarkAnchorCount:4,authoredRouteSha256:'original-road',emittedLayoutSha256:'original-landmarks',frames:{overview:[.1,.1,.9,.9]}};
  assertPreviewLayoutEqual(structuredClone(baseline),baseline,'guard');
  for(const changed of [{...baseline,authoredRouteSha256:'shifted-road'},{...baseline,emittedLayoutSha256:'moved-landmark'},{...baseline,frames:{overview:[-.1,.1,.9,.9]}},{...baseline,roadPointCount:0}])assert.throws(()=>assertPreviewLayoutEqual(changed,baseline,'guard'));
});
