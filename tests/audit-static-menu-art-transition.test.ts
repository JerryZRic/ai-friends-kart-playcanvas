import {QUALITY_TIER_REVIEW_PATH} from './helpers/quality-tier-reviewed-revisions';
import {CI_BUILD_DEPLOYMENT_REVIEW_PATH} from './helpers/ci-build-deployment-reviewed-revisions';
import {MUSIC_REVIEW_PATH, musicHash} from './helpers/music-reviewed-revisions';
import {STABLE_PAGES_V050_REPIN_REVIEW_PATH, stablePagesV050RepinHash, stablePagesV050RepinPathsWithin, restoreStablePagesV050RepinBytes} from './helpers/stable-pages-v050-repin-reviewed-revisions';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {
  STATIC_MENU_ART_BASELINE_COMMIT, STATIC_MENU_ART_BASELINE_TREE, STATIC_MENU_ART_PRODUCTION_PATHS,
  STATIC_MENU_ART_BRIDGE_PATHS, STATIC_MENU_ART_REGRESSION_PATHS, STATIC_MENU_ART_SOURCE_ADDITIONS,
  STATIC_MENU_ART_ASSET_ADDITIONS, STATIC_MENU_ART_TEST_ADDITIONS, STATIC_MENU_ART_REVIEW_PATH, STATIC_MENU_ART_REVIEW_SHA256,
  staticMenuArtSha as sha, staticMenuArtReview, assertStaticMenuArtReviewBytes,
  staticMenuArtHash, staticMenuArtPathsWithin, staticMenuArtSourcePaths, assertStaticMenuArtAddition,
  restoreStaticMenuArtBytes, staticMenuArtAuditDependencies,
} from './helpers/static-menu-art-reviewed-revisions';
import {inputModeReview, inputModeHash, restoreInputModeBytes, inputModeAuditDependencies} from './helpers/input-mode-reviewed-revisions';
import {touchOpacityReview, touchOpacityHash, restoreTouchOpacityBytes} from './helpers/touch-opacity-reviewed-revisions';
import {loadingGuideReview, loadingGuideHash, restoreLoadingGuideBytes} from './helpers/loading-guide-reviewed-revisions';
import {mobileControlsReview, mobileControlsHash, restoreMobileControlsBytes} from './helpers/mobile-controls-reviewed-revisions';
import {menuPresentationReview, menuPresentationHash, menuPresentationSourcePaths, restoreMenuPresentationBytes} from './helpers/menu-presentation-reviewed-revisions';
import {gardenAuditHashes} from './helpers/garden-enrichment-source-stability';
import {airfieldAuditHashes} from './helpers/airfield-enrichment-source-stability';

const read = (path: string) => readFileSync(path, 'utf8');
const review = staticMenuArtReview();
// Preserve the exact existing instrumented-source allowlist, including PID and UUID.
// Arbitrary dotfiles, subdirectory fixtures and vaguely similar names stay production inputs.
const instrumentedNames = [
  ...['airfield', 'caldera', 'desert', 'garden', 'harvest', 'snow'].map(name => name + '-enrichment-scene'),
  ...['forest', 'quarry', 'town', 'workshop'].map(name => name + '-enrichment-camera-scene'),
  ...['forest', 'quarry', 'town'].map(name => name + '-enrichment-provenance'),
  ...['airfield', 'garden', 'mountain'].map(name => 'land-course-' + name + '-test'),
  ...['airfield', 'caldera', 'course-failure', 'default', 'desert', 'forest', 'garden', 'harvest', 'mountain', 'quarry', 'saved', 'snow', 'town', 'workshop', 'cancel'].map(name => 'game-test-' + name),
  'waterpark-play-test',
];
const instrumentedPath = new RegExp('^src/\\.(?:' + instrumentedNames.join('|') + ')-[0-9]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.ts$');
const productionSources = (paths: string[]) => paths.filter(path => !instrumentedPath.test(path)).sort();
const previousSources = () => [...Object.keys(review.protectedProduction), ...STATIC_MENU_ART_PRODUCTION_PATHS].filter(path => path.startsWith('src/')).sort();
const walk = (dir: string): string[] => readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? walk(dir + '/' + entry.name) : [dir + '/' + entry.name]);

test('static title pins the exact published dev baseline and bounded source, asset and test changes', () => {
  assert.equal(STATIC_MENU_ART_BASELINE_COMMIT, 'd0acc156e4902c2741ea7a1dc35966a7e82a4f34');
  assert.equal(STATIC_MENU_ART_BASELINE_TREE, 'fd4a15d9c7a6255d3c2f3570d714133c4321fa2c');
  assert.equal(sha(read(STATIC_MENU_ART_REVIEW_PATH)), STATIC_MENU_ART_REVIEW_SHA256);
  assert.deepEqual(Object.keys(review.changes), [...STATIC_MENU_ART_PRODUCTION_PATHS, ...STATIC_MENU_ART_BRIDGE_PATHS, ...STATIC_MENU_ART_REGRESSION_PATHS]);
  assert.deepEqual(Object.keys(review.additions), [...STATIC_MENU_ART_SOURCE_ADDITIONS, ...STATIC_MENU_ART_ASSET_ADDITIONS, ...STATIC_MENU_ART_TEST_ADDITIONS]);
  assert.deepEqual(STATIC_MENU_ART_SOURCE_ADDITIONS, ['src/title-menu.css']);
  assert.ok(Object.keys(review.changes).every(path => !path.startsWith('tests/fixtures/') && !path.startsWith('docs/') && !path.startsWith('.github/')));
  assert.deepEqual(productionSources(walk('src')), staticMenuArtSourcePaths(previousSources()).sort(), 'Every current source is explicitly protected, changed or added');
  assert.deepEqual(walk('public/menu-art').sort(), [...STATIC_MENU_ART_ASSET_ADDITIONS].sort(), 'Only the explicitly reviewed title assets may be published');
  assert.ok(Object.keys(review.protectedProduction).length > 100);
  for (const [path, hash] of Object.entries(review.protectedProduction)) assert.equal(sha(readFileSync(path)), musicHash(path, hash), path + ' exact music successor production bytes');
});

test('static-title inventories reject unreviewed and duplicate sources, assets and approximate fixture names', () => {
  const previous = previousSources(), expected = staticMenuArtSourcePaths(previous).sort();
  const suffix = '-123-12345678-abcd-4321-9abc-0123456789ab.ts';
  assert.deepEqual(productionSources([...expected, ...instrumentedNames.map(name => 'src/.' + name + suffix)]), expected);
  for (const path of STATIC_MENU_ART_SOURCE_ADDITIONS) {
    assert.throws(() => staticMenuArtSourcePaths([...previous, path]));
    assert.notDeepEqual(productionSources(expected.filter(entry => entry !== path)), expected, path + ' missing new source cannot pass');
  }
  for (const extra of ['src/unreviewed.ts', 'src/.unreviewed' + suffix, 'src/.game-test-default.ts', 'src/.game-test-default-not-a-uuid.ts', 'src/sub/.game-test-default' + suffix]) {
    assert.notDeepEqual(productionSources([...expected, extra]), expected, extra + ' cannot bypass production inventory');
  }
  assert.throws(() => assertStaticMenuArtAddition('public/menu-art/unreviewed.png', Buffer.from('unreviewed')));
  assert.notDeepEqual([...STATIC_MENU_ART_ASSET_ADDITIONS, 'public/menu-art/.unreviewed.png'].sort(), [...STATIC_MENU_ART_ASSET_ADDITIONS].sort());
});

test('every static-title revision reconstructs every baseline byte and an exact forward round trip', () => {
  for (const [path, row] of Object.entries(review.changes)) {
    const raw = read(path), current = restoreStablePagesV050RepinBytes(path, raw), previous = restoreStaticMenuArtBytes(path, raw);
    assert.equal(sha(current), row.currentSha256, path); assert.equal(sha(previous), row.previousSha256, path);
    const lines = previous.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    for (const hunk of [...row.hunks].reverse()) {
      assert.deepEqual(lines.slice(hunk.beforeStart, hunk.beforeStart + hunk.removedLines.length), hunk.removedLines, path);
      lines.splice(hunk.beforeStart, hunk.removedLines.length, ...hunk.insertedLines);
    }
    assert.equal(lines.join(''), current, path + ' complete exact forward reconstruction');
    assert.throws(() => restoreStaticMenuArtBytes(path, raw + ' '), undefined, path + ' modified current bytes rejected');
    assert.throws(() => restoreStaticMenuArtBytes(path, previous), undefined, path + ' no historical-byte fallback');
  }
});

test('every added module, binary art asset and regression test is pinned with no alternate spelling or byte fallback', () => {
  for (const [path, row] of Object.entries(review.additions)) {
    const bytes = readFileSync(path);
    assert.equal(sha(bytes), musicHash(path, row.sha256), path);
    assertStaticMenuArtAddition(path, bytes);
    assert.throws(() => assertStaticMenuArtAddition(path, Buffer.concat([bytes, Buffer.from(' ')])));
    for (const alias of ['./' + path, path + '/extra', path.replace('/', '//'), 'src/unreviewed.ts']) assert.throws(() => assertStaticMenuArtAddition(alias, bytes));
  }
});

test('static-title overlay rejects wrong incoming identities, aliases and modified review permissions', () => {
  for (const [path, row] of Object.entries(review.changes)) {
    assert.equal(staticMenuArtHash(path, row.previousSha256), stablePagesV050RepinHash(path, row.currentSha256));
    for (const incoming of [undefined, '', '0'.repeat(64), row.currentSha256]) assert.throws(() => staticMenuArtHash(path, incoming), undefined, path);
    for (const alias of ['./' + path, path + '/extra']) assert.equal(staticMenuArtHash(alias, row.previousSha256), row.previousSha256);
  }
  assert.throws(() => staticMenuArtHash('src/game.ts', 'unchanged'), undefined, 'Music successor requires exact pre-music identity');
  assert.throws(() => restoreStaticMenuArtBytes('src/game.ts', 'unchanged'), undefined, 'Music successor requires exact current bytes');
  for (const path of ['src/race-controls.ts', 'src/mobile-controls.ts', 'src/control-mode.ts', 'src/race-camera.ts', 'src/land-camera.ts', 'public/source.html']) {
    assert.equal(staticMenuArtHash(path, 'unchanged'), 'unchanged'); assert.equal(restoreStaticMenuArtBytes(path, 'unchanged'), 'unchanged');
  }
  assert.throws(() => staticMenuArtHash('docs/stable-pages-manifest.json', 'unchanged'), undefined, 'Repinned manifest requires its exact historical identity');
  assert.throws(() => restoreStaticMenuArtBytes('docs/stable-pages-manifest.json', 'unchanged'), undefined, 'Repinned manifest requires exact current bytes');
  assert.throws(() => assertStaticMenuArtReviewBytes(read(STATIC_MENU_ART_REVIEW_PATH) + ' '));
  for (const mutate of [
    (copy: typeof review) => { copy.baselineTree = '0'.repeat(40); },
    (copy: typeof review) => { copy.changes['src/unreviewed.ts'] = structuredClone(Object.values(copy.changes)[0]); },
    (copy: typeof review) => { Object.values(copy.changes)[0].hunks[0].removedLines.push('unreviewed\n'); },
    (copy: typeof review) => { Object.values(copy.changes)[0].hunks[0].afterStart++; },
    (copy: typeof review) => { Object.values(copy.additions)[0].sha256 = 'f'.repeat(64); },
    (copy: typeof review) => { copy.protectedProduction['src/game.ts'] = 'f'.repeat(64); },
    (copy: typeof review) => { copy.protectedLegal.LICENSE = 'f'.repeat(64); },
    (copy: typeof review) => { copy.protectedEvidence['tests/helpers/input-mode-transition.json'] = 'f'.repeat(64); },
  ]) { const copy = structuredClone(review); mutate(copy); assert.throws(() => assertStaticMenuArtReviewBytes(JSON.stringify(copy))); }
});

test('all input-mode endpoints retain their exact original protected, changed and added bytes', () => {
  const input = inputModeReview();
  for (const [path, hash] of Object.entries(input.protectedProduction)) {
    assert.equal(sha(restoreStaticMenuArtBytes(path, read(path))), hash, path + ' exact original input-mode protected production');
    assert.equal(staticMenuArtHash(path, hash), sha(readFileSync(path)), path + ' exact current identity from prior protected pin');
  }
  for (const [path, row] of Object.entries(input.changes)) {
    assert.equal(sha(restoreStaticMenuArtBytes(path, read(path))), row.currentSha256, path + ' original input-mode endpoint retained');
    assert.equal(sha(restoreInputModeBytes(path, read(path))), row.previousSha256, path + ' exact pre-input-mode baseline');
    assert.equal(inputModeHash(path, row.previousSha256), sha(readFileSync(path)), path + ' input-mode-to-current chain');
  }
  for (const [path, row] of Object.entries(input.additions)) assert.equal(sha(restoreStaticMenuArtBytes(path, read(path))), row.sha256, path + ' exact input-mode addition retained');
});

test('all older touch, loading, mobile and menu proof chains retain every endpoint and original byte', () => {
  for (const [proof, hash, restore] of [
    [touchOpacityReview(), touchOpacityHash, restoreTouchOpacityBytes],
    [loadingGuideReview(), loadingGuideHash, restoreLoadingGuideBytes],
    [mobileControlsReview(), mobileControlsHash, restoreMobileControlsBytes],
    [menuPresentationReview(), menuPresentationHash, restoreMenuPresentationBytes],
  ] as const) {
    for (const [path, row] of Object.entries(proof.changes)) {
      assert.equal(sha(restore(path, read(path))), row.previousSha256, path + ' exact complete historical inverse');
      assert.equal(hash(path, row.previousSha256), sha(readFileSync(path)), path + ' exact historical-to-current chain');
    }
  }
  const inventory = JSON.parse(read('tests/fixtures/airfield-enrichment-original-inventory.json')).sourceInventory;
  assert.deepEqual(menuPresentationSourcePaths(inventory).sort(), staticMenuArtSourcePaths(previousSources()).sort(), 'Global frozen inventories include only the exact added title stylesheet');
});

test('all frozen geometry, legal and historical proof bytes and all 216 stable publication records remain unchanged', () => {
  assert.ok(Object.keys(review.protectedEvidence).length > 100);
  for (const path of ['tests/helpers/input-mode-transition.json', 'tests/helpers/touch-opacity-transition.json', 'tests/helpers/loading-guide-transition.json', 'tests/helpers/mobile-controls-transition.json', 'tests/helpers/menu-presentation-transition.json', 'tests/helpers/stable-pages-repin-transition.json', 'tests/helpers/mobile-controls-protected-evidence.json', 'docs/stable-pages-manifest.json']) assert.ok(Object.hasOwn(review.protectedEvidence, path), path);
  for (const path of ['LICENSE', 'NOTICE', 'MODEL-NOTICE.txt', 'FOOD-ASSET-NOTICE.txt', 'ALPINE-PROP-NOTICE.txt', 'THIRD-PARTY-NOTICES.txt', 'SOURCE.txt', 'public/source.html', 'scripts/package-source.mjs']) assert.ok(Object.hasOwn(review.protectedLegal, path), path);
  for (const protectedFiles of [review.protectedLegal, review.protectedEvidence]) {
    for (const [path, hash] of Object.entries(protectedFiles)) assert.equal(sha(readFileSync(path)), stablePagesV050RepinHash(path, hash), path + ' immutable evidence or exact reviewed publication successor');
  }
  const historicalPaths = [...new Set([...Object.keys(review.protectedProduction), ...Object.keys(review.protectedLegal), ...Object.keys(review.protectedEvidence)])];
  const currentJson = ['docs', 'tests', 'models', 'public', 'src'].flatMap(walk).filter(path => path.endsWith('.json')).sort();
  const historicalJson = historicalPaths.filter(path => path.endsWith('.json') && path.includes('/'));
  assert.deepEqual(currentJson, [...historicalJson, STATIC_MENU_ART_REVIEW_PATH, STABLE_PAGES_V050_REPIN_REVIEW_PATH, MUSIC_REVIEW_PATH, CI_BUILD_DEPLOYMENT_REVIEW_PATH, QUALITY_TIER_REVIEW_PATH].sort(), 'Every historical JSON stays pinned and only the explicit successor transition JSONs are added');
  assert.deepEqual(walk('docs/scene-baselines').sort(), historicalPaths.filter(path => path.startsWith('docs/scene-baselines/')).sort(), 'Every archived source baseline remains present and immutable');
  const stableBytes = restoreStablePagesV050RepinBytes('docs/stable-pages-manifest.json', read('docs/stable-pages-manifest.json')), manifest = JSON.parse(stableBytes);
  assert.equal(sha(stableBytes), '5387aa54b2f677be0e912ff83e0e5237954d967b837e82f02ad7c172fa711add');
  assert.equal(manifest.stableCommit, '6844110cb77bb5b71041786f1802217766a8f759');
  assert.equal(manifest.files.length, 216); assert.equal(new Set(manifest.files.map((row: {path: string}) => row.path)).size, 216);
  assert.equal(manifest.files.reduce((sum: number, row: {bytes: number}) => sum + row.bytes, 0), 322349659);
  assert.ok(manifest.files.every((row: {path: string}) => !row.path.startsWith('dev/')));
});

test('all new modules, art, regression, audit and legal dependencies join both source-stability closures', () => {
  const inventory = JSON.parse(read('tests/fixtures/airfield-enrichment-original-inventory.json')).sourceInventory;
  assert.deepEqual(staticMenuArtPathsWithin(inventory), [...new Set([...Object.keys(review.changes).filter(path => Object.hasOwn(inventory, path)), ...stablePagesV050RepinPathsWithin(inventory)])]);
  for (const hashes of [gardenAuditHashes(), airfieldAuditHashes()]) {
    for (const path of staticMenuArtAuditDependencies()) assert.equal(hashes[path], sha(readFileSync(path)), path + ' explicit current static-title audit closure');
    for (const path of inputModeAuditDependencies()) assert.equal(hashes[path], sha(readFileSync(path)), path + ' retained input-mode audit closure');
  }
});
