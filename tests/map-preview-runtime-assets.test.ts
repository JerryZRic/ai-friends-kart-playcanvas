import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {MAP_CATALOG} from '../src/map-presentation';

const menu = readFileSync('src/menu.ts', 'utf8');
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
// Read the actual consumer templates, rather than assuming the asset names in the test.
function posterPath(className: string, id: string) {
  const template = menu.match(new RegExp(`<img class="${className}" src="([^"]+)"`))?.[1];
  assert.ok(template, `${className} image source exists`);
  const path = template.replace(/\$\{(?:m|selected)\.id\}/g, id);
  assert.doesNotMatch(path, /\$\{/);
  assert.match(path, /^\.\/map-previews\/[a-z-]+\.webp$/);
  return path;
}

test('all 13 actual map card and WebGL fallback URLs resolve to valid packaged WebP assets', () => {
  assert.equal(MAP_CATALOG.length, 13);
  for (const map of MAP_CATALOG) {
    const card = posterPath('map-overview', map.id);
    const fallback = posterPath('map-stage-fallback', map.id);
    assert.equal(fallback, card, map.id + ' card and fallback share the same original poster');
    const image = readFileSync('public/' + card.slice(2));
    assert.equal(image.toString('ascii', 0, 4), 'RIFF', map.id);
    assert.equal(image.toString('ascii', 8, 12), 'WEBP', map.id);
    assert.ok(image.length > 10000, map.id + ' has complete image bytes');
  }
});

test('map poster URLs preserve the stable root and nested dev preview base', () => {
  for (const base of ['https://example.invalid/ai-friends-kart-playcanvas/', 'https://example.invalid/ai-friends-kart-playcanvas/dev/']) {
    for (const map of MAP_CATALOG) for (const kind of ['map-overview', 'map-stage-fallback']) {
      const path = posterPath(kind, map.id);
      const url = new URL(path, base + 'index.html?screen=maps&map=' + map.id);
      assert.equal(url.href, base + path.slice(2));
      assert.ok(readFileSync('public/' + url.pathname.slice(new URL(base).pathname.length)).length > 10000);
    }
  }
});

test('map 12 runtime alias is byte-identical to the reviewed original airfield render', () => {
  const map = MAP_CATALOG.find(map => map.displayCode === '12')!;
  assert.equal(map.id, 'airfield');
  const provenance = JSON.parse(readFileSync('docs/airfield-preview-provenance.json', 'utf8'));
  assert.equal(provenance.menuAsset.file, 'public/map-previews/airfield.webp');
  const original = readFileSync(provenance.menuAsset.file);
  const runtime = readFileSync('public/' + posterPath('map-overview', map.id).slice(2));
  assert.deepEqual(runtime, original, 'the alias never substitutes unrelated or regenerated artwork');
  assert.equal(sha(runtime), provenance.menuAsset.sha256);
});
