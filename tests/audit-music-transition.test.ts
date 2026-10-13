import {QUALITY_TIER_REVIEW_PATH} from './helpers/quality-tier-reviewed-revisions';
import {CI_BUILD_DEPLOYMENT_REVIEW_PATH, ciBuildDeploymentHash, restoreCiBuildDeploymentBytes} from './helpers/ci-build-deployment-reviewed-revisions';
import {airfieldReviewedHash} from './helpers/airfield-enrichment-reviewed-revisions';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {MUSIC_BASELINE_COMMIT, MUSIC_BASELINE_TREE, MUSIC_REVIEW_PATH, MUSIC_REVIEW_SHA256, MUSIC_PRODUCTION_PATHS, MUSIC_BRIDGE_PATHS, MUSIC_REGRESSION_PATHS, MUSIC_DOCUMENTATION_PATHS, MUSIC_BINARY_PATHS, MUSIC_SOURCE_ADDITIONS, MUSIC_ASSET_ADDITIONS, MUSIC_OTHER_ADDITIONS, musicSha as sha, musicReview, assertMusicReviewBytes, musicHash, musicPathsWithin, assertMusicAddition, musicSourcePaths, restoreMusicBytes, musicAddedPaths, musicAuditDependencies} from './helpers/music-reviewed-revisions';
import {stablePagesV050RepinReview, stablePagesV050RepinHash, restoreStablePagesV050RepinBytes} from './helpers/stable-pages-v050-repin-reviewed-revisions';
import {menuPresentationSourcePaths, menuPresentationHash} from './helpers/menu-presentation-reviewed-revisions';
import {staticMenuArtReview} from './helpers/static-menu-art-reviewed-revisions';
import {gardenAuditHashes} from './helpers/garden-enrichment-source-stability';
import {airfieldAuditHashes} from './helpers/airfield-enrichment-source-stability';
const read = (path: string) => readFileSync(path, 'utf8');
const review = musicReview();
const walk = (dir: string): string[] => readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? walk(dir + '/' + entry.name) : [dir + '/' + entry.name]);

test('music pins the exact dev baseline and complete bounded change and addition inventory', () => {
  assert.equal(MUSIC_BASELINE_COMMIT, 'fb6e372426def1fb83487ae31b96d057f6968a6f');
  assert.equal(MUSIC_BASELINE_TREE, 'fe0fa8f502adac8143bd356e3e7dac5c061da1a0');
  assert.equal(sha(read(MUSIC_REVIEW_PATH)), MUSIC_REVIEW_SHA256);
  assert.deepEqual(Object.keys(review.changes), [...MUSIC_PRODUCTION_PATHS, ...MUSIC_BRIDGE_PATHS, ...MUSIC_REGRESSION_PATHS, ...MUSIC_DOCUMENTATION_PATHS]);
  assert.deepEqual(Object.keys(review.additions), [...MUSIC_SOURCE_ADDITIONS, ...MUSIC_ASSET_ADDITIONS, ...MUSIC_OTHER_ADDITIONS]);
  assert.deepEqual(walk('public/assets/music').sort(), [...MUSIC_ASSET_ADDITIONS].sort());
  const baseline = [...Object.keys(review.protectedFiles), ...Object.keys(review.changes), ...Object.keys(review.binaryChanges)];
  assert.equal(new Set(baseline).size, 991);
  for (const dir of ['.github', 'docs', 'models', 'public', 'scripts', 'tests']) assert.deepEqual(walk(dir).sort(), [...baseline, ...musicAddedPaths()].filter(path => path.startsWith(dir + '/')).sort(), dir + ' complete exact inventory');
  const oldSources = baseline.filter(path => path.startsWith('src/'));
  assert.deepEqual(musicSourcePaths(oldSources).sort(), [...oldSources, ...MUSIC_SOURCE_ADDITIONS].sort());
  for (const path of MUSIC_SOURCE_ADDITIONS) assert.throws(() => musicSourcePaths([...oldSources, path]));
  const frozen = JSON.parse(read('tests/fixtures/airfield-enrichment-original-inventory.json')).sourceInventory;
  assert.deepEqual(menuPresentationSourcePaths(frozen).sort(), musicSourcePaths(oldSources).sort());
  for (const [path, incoming] of Object.entries(frozen)) assert.equal(airfieldReviewedHash(path, incoming), sha(readFileSync(path)), path + ' exact complete historical chain');
});

test('every music edit has exact reversible bounded hunks and rejects altered or historical bytes', () => {
  for (const [path, row] of Object.entries(review.changes)) {
    const raw = read(path), current = restoreCiBuildDeploymentBytes(path, raw), previous = restoreMusicBytes(path, raw);
    assert.equal(sha(current), row.currentSha256); assert.equal(sha(previous), row.previousSha256);
    const lines = previous.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    for (const hunk of [...row.hunks].reverse()) {
      assert.deepEqual(lines.slice(hunk.beforeStart, hunk.beforeStart + hunk.removedLines.length), hunk.removedLines);
      lines.splice(hunk.beforeStart, hunk.removedLines.length, ...hunk.insertedLines);
    }
    assert.equal(lines.join(''), current, path + ' complete forward proof');
    for (const altered of [raw + ' ', raw.slice(1), previous]) assert.throws(() => restoreMusicBytes(path, altered));
    assert.equal(musicHash(path, row.previousSha256), ciBuildDeploymentHash(path, row.currentSha256));
    for (const incoming of [undefined, '', '0'.repeat(64), row.currentSha256]) assert.throws(() => musicHash(path, incoming));
    for (const alias of ['./' + path, path + '/extra', path.includes('/') ? path.replace('/', '//') : path + '/']) assert.equal(musicHash(alias, row.previousSha256), row.previousSha256);
  }
});

test('new music binaries, documentation, source and tests have exact pinned bytes and no aliases', () => {
  for (const [path, row] of Object.entries(review.additions)) {
    const bytes = readFileSync(path); assert.equal(sha(bytes), ciBuildDeploymentHash(path, row.sha256)); assertMusicAddition(path, bytes);
    assert.throws(() => assertMusicAddition(path, Buffer.concat([bytes, Buffer.from(' ')])));
    for (const alias of ['./' + path, path + '/extra', path.includes('/') ? path.replace('/', '//') : path + '/']) assert.throws(() => assertMusicAddition(alias, bytes));
  }
  assert.throws(() => assertMusicAddition('src/unreviewed.ts', 'unreviewed'));
});

test('all frozen evidence stays byte exact and only exact CI workflow and composition successors advance', () => {
  for (const [path, hash] of Object.entries(review.protectedFiles)) assert.equal(sha(readFileSync(path)), ciBuildDeploymentHash(path, hash), path + ' exact baseline or bounded CI successor bytes');
  for (const path of ['docs/stable-pages-manifest.json', 'LICENSE', 'NOTICE', 'MODEL-NOTICE.txt', 'THIRD-PARTY-NOTICES.txt', 'SOURCE.txt', 'public/source.html', 'scripts/package-source.mjs', 'scripts/compose-dev-pages.mjs', '.github/workflows/pages.yml', '.github/workflows/pages-stable.yml', 'package.json', 'package-lock.json']) assert.ok(Object.hasOwn(review.protectedFiles, path), path);
  assert.ok(Object.keys(review.changes).every(path => !path.endsWith('.json') && !path.startsWith('.github/') && !path.startsWith('docs/') && !path.startsWith('scripts/')));
  const baselineJson = Object.keys(review.protectedFiles).filter(path => path.endsWith('.json') && path.includes('/'));
  assert.deepEqual(['docs', 'tests', 'models', 'public', 'src'].flatMap(walk).filter(path => path.endsWith('.json')).sort(), [...baselineJson, MUSIC_REVIEW_PATH, CI_BUILD_DEPLOYMENT_REVIEW_PATH, QUALITY_TIER_REVIEW_PATH].sort());
  const stable = JSON.parse(read('docs/stable-pages-manifest.json'));
  assert.equal(stable.stableCommit, '16dd2d0540e300de6e85aa816e73ed94d4e796c0'); assert.equal(stable.files.length, 219);
  assert.equal(stable.files.reduce((sum: number, row: {bytes: number}) => sum + row.bytes, 0), 328819057);
});

test('all v0.5.0 endpoints and original bytes survive the music successor without widened permissions', () => {
  const predecessor = stablePagesV050RepinReview();
  for (const [path, row] of Object.entries(predecessor.changes)) {
    assert.equal(sha(restoreMusicBytes(path, read(path))), row.currentSha256);
    assert.equal(sha(restoreStablePagesV050RepinBytes(path, read(path))), row.previousSha256);
    assert.equal(stablePagesV050RepinHash(path, row.previousSha256), sha(readFileSync(path)));
  }
  assert.deepEqual(musicPathsWithin({'src/game.ts': 'old', './src/game.ts': 'alias', 'src/race-camera.ts': 'unchanged'}), ['src/game.ts']);
  for (const hashes of [gardenAuditHashes(), airfieldAuditHashes()]) for (const path of musicAuditDependencies()) assert.equal(hashes[path], sha(readFileSync(path)), path + ' complete current audit closure');
  assert.throws(() => assertMusicReviewBytes(read(MUSIC_REVIEW_PATH) + ' '));
  for (const mutate of [
    (copy: typeof review) => { copy.baselineCommit = '0'.repeat(40); },
    (copy: typeof review) => { copy.baselineTree = '0'.repeat(40); },
    (copy: typeof review) => { copy.changes['src/unreviewed.ts'] = structuredClone(Object.values(copy.changes)[0]); },
    (copy: typeof review) => { Object.values(copy.changes)[0].hunks[0].insertedLines.push('unreviewed\n'); },
    (copy: typeof review) => { Object.values(copy.changes)[0].hunks[0].afterStart++; },
    (copy: typeof review) => { Object.values(copy.additions)[0].sha256 = 'f'.repeat(64); },
    (copy: typeof review) => { copy.protectedFiles['docs/stable-pages-manifest.json'] = 'f'.repeat(64); },
    (copy: typeof review) => { delete copy.protectedFiles.LICENSE; },
  ]) { const copy = structuredClone(review); mutate(copy); assert.throws(() => assertMusicReviewBytes(JSON.stringify(copy))); }
});

test('Mountain preview and Town/Quarry frozen camera metadata accept only exact music identity transitions', () => {
  const mountain = JSON.parse(read('docs/mountain-preview-provenance.json'));
  const town = JSON.parse(read('tests/helpers/town-enrichment-camera-frozen.json'));
  const quarry = JSON.parse(read('tests/helpers/quarry-enrichment-camera-frozen.json'));
  for (const dependencies of [{...mountain.sourceHashes, ...mountain.generatorHashes}, Object.fromEntries(Object.entries(town.sourceHashes).filter(([path]) => path !== 'src/town-scenery.ts')), quarry.dependencies] as Record<string, string>[]) {
    assert.deepEqual(musicPathsWithin(dependencies), ['src/game.ts'], 'Only the reviewed game music lifecycle changed in each frozen dependency set');
    for (const [path, oldHash] of Object.entries(dependencies)) {
      assert.equal(sha(readFileSync(path)), musicHash(path, oldHash), path + ' exact frozen dependency or music successor');
      if (path === 'src/game.ts') {
        assert.equal(sha(restoreMusicBytes(path, read(path))), oldHash, 'Every original camera dependency byte remains reconstructible');
        assert.throws(() => musicHash(path, '0'.repeat(64)));
        assert.throws(() => restoreMusicBytes(path, read(path) + ' '));
      }
    }
  }
  for (const path of ['tests/helpers/town-enrichment-camera-worker.ts', 'tests/helpers/quarry-enrichment-camera-worker.ts']) {
    assert.ok(read(path).includes('...musicAuditDependencies()'), path + ' tracks all exact successor proof bytes across serial geometry stages');
  }
});

test('three original tracks retain the approved separate music license without changing AGPL code or other asset rights', () => {
  assert.deepEqual(MUSIC_DOCUMENTATION_PATHS, ['README.ja.md', 'README.ko.md', 'README.md', 'README.yue.md', 'README.zh-CN.md', 'README.zh-TW.md']);
  const license = read('public/assets/music/LICENSE.txt').replace(/\s+/g, ' ');
  assert.match(license, /Copyright © 2026 JerryZRic/);
  for (const file of ['dfy_theme.mp3', 'dfy_bgm.mp3', 'dfy_fusion.mp3']) assert.ok(license.includes(file));
  assert.match(license, /use, reproduce, modify, and distribute/);
  assert.match(license, /non-commercial use as part of AI Friends Kart and forks of this game/);
  assert.match(license, /requires JerryZRic's prior permission/);
  assert.match(license, /does not authorize use in unrelated projects or standalone distribution or sale/);
  assert.match(license, /Credit JerryZRic and retain this notice and license/);
  assert.match(license, /code's AGPL-3.0-only terms are unchanged/);
  assert.match(license, /中文/);
  for (const path of MUSIC_DOCUMENTATION_PATHS) {
    assert.ok(read(path).includes('public/assets/music/LICENSE.txt'), path + ' links the exact separate music license');
    assert.ok(read(path).includes('© 2026 JerryZRic'), path + ' retains approved attribution');
    assert.equal(sha(restoreMusicBytes(path, read(path))), review.changes[path].previousSha256, path + ' exact localized baseline reconstructed');
  }
});

test('approved title portrait replacement preserves exact old identity and new PNG bytes without claiming binary inversion', () => {
  assert.deepEqual(MUSIC_BINARY_PATHS, ['public/menu-art/whale-maid.png']);
  assert.deepEqual(Object.keys(review.binaryChanges), [...MUSIC_BINARY_PATHS]);
  const path = MUSIC_BINARY_PATHS[0], row = review.binaryChanges[path], bytes = readFileSync(path);
  assert.equal(row.previousSha256, staticMenuArtReview().additions[path].sha256, 'Old binary hash is independently anchored in immutable static-title evidence');
  assert.equal(row.currentSha256, 'a8b8184cccfa1180305fe9bf63730cc64ad8ee94b8ddba02e2ae15fe0bb77a11', 'Exact user-approved replacement');
  assert.equal(sha(bytes), row.currentSha256); assert.equal(bytes.length, 1883909);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
  assert.equal(bytes.readUInt32BE(16), 1181); assert.equal(bytes.readUInt32BE(20), 1331);
  assert.equal(bytes[24], 8); assert.equal(bytes[25], 6, 'Same RGBA8 image representation');
  assert.equal(musicHash(path, row.previousSha256), ciBuildDeploymentHash(path, row.currentSha256));
  for (const incoming of [undefined, '', '0'.repeat(64), row.currentSha256]) assert.throws(() => musicHash(path, incoming));
  for (const alias of ['./' + path, path + '/extra', path.replace('/', '//')]) assert.equal(musicHash(alias, row.previousSha256), row.previousSha256);
  assert.notEqual(sha(Buffer.concat([bytes, Buffer.from(' ')])), row.currentSha256);
  assert.ok(!Object.hasOwn(review.changes, path), 'Binary replacement is never decoded into text hunks');
  for (const file of ['src/title-menu.css', 'index.html']) assert.equal(sha(readFileSync(file)), review.protectedFiles[file], file + ' exact original sizing and layout');
  const titleMarkup = (source: string) => source.split('\n').find(line => line.includes('class="title-character"'));
  assert.ok(titleMarkup(read('src/menu.ts')));
  assert.equal(titleMarkup(read('src/menu.ts')), titleMarkup(restoreMusicBytes('src/menu.ts', read('src/menu.ts'))), 'Title artwork markup, positioning and image path remain exact');
  for (const change of ['previousSha256', 'currentSha256'] as const) {
    const copy = structuredClone(review); copy.binaryChanges[path][change] = 'f'.repeat(64);
    assert.throws(() => assertMusicReviewBytes(JSON.stringify(copy)));
  }
});
