import {stablePagesV050RepinHash} from './helpers/stable-pages-v050-repin-reviewed-revisions';
import {staticMenuArtHash, staticMenuArtPathsWithin, restoreStaticMenuArtBytes} from './helpers/static-menu-art-reviewed-revisions';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {
  INPUT_MODE_BASELINE_COMMIT, INPUT_MODE_BASELINE_TREE, INPUT_MODE_PRODUCTION_PATHS,
  INPUT_MODE_BRIDGE_PATHS, INPUT_MODE_REGRESSION_PATHS, INPUT_MODE_SOURCE_ADDITIONS, INPUT_MODE_TEST_ADDITIONS,
  INPUT_MODE_REVIEW_PATH, INPUT_MODE_REVIEW_SHA256, inputModeSha as sha, inputModeReview, assertInputModeReviewBytes,
  inputModeHash, inputModePathsWithin, inputModeSourcePaths, assertInputModeAddition, restoreInputModeBytes, inputModeAuditDependencies,
} from './helpers/input-mode-reviewed-revisions';
import {touchOpacityReview, touchOpacityHash, restoreTouchOpacityBytes, touchOpacityAuditDependencies} from './helpers/touch-opacity-reviewed-revisions';
import {loadingGuideReview, loadingGuideHash, restoreLoadingGuideBytes} from './helpers/loading-guide-reviewed-revisions';
import {mobileControlsReview, mobileControlsHash, restoreMobileControlsBytes} from './helpers/mobile-controls-reviewed-revisions';
import {menuPresentationReview, menuPresentationHash, menuPresentationSourcePaths, restoreMenuPresentationBytes} from './helpers/menu-presentation-reviewed-revisions';
import {gardenAuditHashes} from './helpers/garden-enrichment-source-stability';
import {airfieldAuditHashes} from './helpers/airfield-enrichment-source-stability';

const read = (path: string) => readFileSync(path, 'utf8');
const review = inputModeReview();
// Retain the exact existing parallel-fixture allowlist; arbitrary dotfiles are production inputs.
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
const previousSources = () => [...Object.keys(review.protectedProduction).filter(path => path.startsWith('src/')), ...INPUT_MODE_PRODUCTION_PATHS].sort();

test('input-mode transition pins the exact published dev baseline and bounded source/test changes', () => {
  assert.equal(INPUT_MODE_BASELINE_COMMIT, 'befa8dda74887b4f04ecf33fe30091cd613545c1');
  assert.equal(INPUT_MODE_BASELINE_TREE, 'f3a3bd9865ee129a29e6df818d85c953a8725e25');
  assert.equal(sha(read(INPUT_MODE_REVIEW_PATH)), INPUT_MODE_REVIEW_SHA256);
  assert.deepEqual(Object.keys(review.changes), [...INPUT_MODE_PRODUCTION_PATHS, ...INPUT_MODE_BRIDGE_PATHS, ...INPUT_MODE_REGRESSION_PATHS]);
  assert.deepEqual(Object.keys(review.additions), [...INPUT_MODE_SOURCE_ADDITIONS, ...INPUT_MODE_TEST_ADDITIONS]);
  assert.deepEqual(INPUT_MODE_SOURCE_ADDITIONS, ['src/control-mode.ts']);
  assert.ok(Object.keys(review.changes).every(path => !path.startsWith('tests/fixtures/') && !path.startsWith('docs/') && !path.startsWith('.github/')));
  const walk = (dir: string): string[] => readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? walk(dir + '/' + entry.name) : [dir + '/' + entry.name]);
  assert.deepEqual(productionSources(walk('src')), inputModeSourcePaths(previousSources()).sort(), 'Every current source is explicitly protected, changed or added');
  assert.ok(Object.keys(review.protectedProduction).length > 100);
  for (const [path, hash] of Object.entries(review.protectedProduction)) assert.equal(sha(restoreStaticMenuArtBytes(path, read(path))), hash, path + ' exact input-mode production bytes');
});

test('input-mode inventory rejects unreviewed or duplicate source additions and accepts only exact temporary fixtures', () => {
  const previous = previousSources(), expected = inputModeSourcePaths(previous).sort();
  const suffix = '-123-12345678-abcd-4321-9abc-0123456789ab.ts';
  assert.deepEqual(productionSources([...expected, ...instrumentedNames.map(name => 'src/.' + name + suffix)]), expected);
  assert.throws(() => inputModeSourcePaths([...previous, 'src/control-mode.ts']));
  for (const extra of ['src/unreviewed.ts', 'src/.unreviewed' + suffix, 'src/.game-test-default.ts', 'src/.game-test-default-not-a-uuid.ts', 'src/sub/.game-test-default' + suffix]) {
    assert.notDeepEqual(productionSources([...expected, extra]), expected, extra + ' cannot bypass production inventory');
  }
  assert.notDeepEqual(productionSources(expected.filter(path => path !== 'src/control-mode.ts')), expected, 'Missing new source cannot pass');
});

test('every input-mode revision reconstructs all baseline bytes and an exact forward round trip', () => {
  for (const [path, row] of Object.entries(review.changes)) {
    const raw = read(path), current = restoreStaticMenuArtBytes(path, raw), previous = restoreInputModeBytes(path, raw);
    assert.equal(sha(current), row.currentSha256, path); assert.equal(sha(previous), row.previousSha256, path);
    const lines = previous.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    for (const hunk of [...row.hunks].reverse()) {
      assert.deepEqual(lines.slice(hunk.beforeStart, hunk.beforeStart + hunk.removedLines.length), hunk.removedLines, path);
      lines.splice(hunk.beforeStart, hunk.removedLines.length, ...hunk.insertedLines);
    }
    assert.equal(lines.join(''), current, path + ' complete exact forward reconstruction');
    assert.throws(() => restoreInputModeBytes(path, raw + ' '), undefined, path + ' modified current bytes rejected');
    assert.throws(() => restoreInputModeBytes(path, previous), undefined, path + ' no historical-byte fallback');
  }
  for (const [path, row] of Object.entries(review.additions)) {
    assert.equal(sha(readFileSync(path)), row.sha256, path);
    assertInputModeAddition(path, readFileSync(path));
    assert.throws(() => assertInputModeAddition(path, read(path) + ' '));
    for (const alias of ['./' + path, path + '/extra', 'src/unreviewed.ts']) assert.throws(() => assertInputModeAddition(alias, read(path)));
  }
});

test('input-mode overlay rejects incorrect incoming identities, aliases and any modified review permission', () => {
  for (const [path, row] of Object.entries(review.changes)) {
    assert.equal(inputModeHash(path, row.previousSha256), staticMenuArtHash(path, row.currentSha256));
    for (const incoming of [undefined, '', '0'.repeat(64), row.currentSha256]) assert.throws(() => inputModeHash(path, incoming), undefined, path);
    for (const alias of ['./' + path, path + '/extra']) assert.equal(inputModeHash(alias, row.previousSha256), row.previousSha256);
  }
  for (const path of ['src/game.ts', 'src/race-controls.ts', 'src/race-camera.ts', 'src/land-camera.ts', 'public/source.html']) {
    assert.equal(inputModeHash(path, 'unchanged'), 'unchanged'); assert.equal(restoreInputModeBytes(path, 'unchanged'), 'unchanged');
  }
  assert.throws(() => inputModeHash('docs/stable-pages-manifest.json', 'unchanged'), undefined, 'Repinned manifest requires its exact historical identity');
  assert.throws(() => restoreInputModeBytes('docs/stable-pages-manifest.json', 'unchanged'), undefined, 'Repinned manifest requires exact current bytes');
  assert.throws(() => assertInputModeReviewBytes(read(INPUT_MODE_REVIEW_PATH) + ' '));
  for (const mutate of [
    (copy: typeof review) => { copy.baselineTree = '0'.repeat(40); },
    (copy: typeof review) => { copy.changes['src/unreviewed.ts'] = structuredClone(Object.values(copy.changes)[0]); },
    (copy: typeof review) => { Object.values(copy.changes)[0].hunks[0].removedLines.push('unreviewed\n'); },
    (copy: typeof review) => { Object.values(copy.changes)[0].hunks[0].afterStart++; },
    (copy: typeof review) => { Object.values(copy.additions)[0].sha256 = 'f'.repeat(64); },
    (copy: typeof review) => { copy.protectedProduction['src/game.ts'] = 'f'.repeat(64); },
    (copy: typeof review) => { copy.protectedLegal.LICENSE = 'f'.repeat(64); },
    (copy: typeof review) => { copy.protectedEvidence['tests/helpers/touch-opacity-transition.json'] = 'f'.repeat(64); },
  ]) { const copy = structuredClone(review); mutate(copy); assert.throws(() => assertInputModeReviewBytes(JSON.stringify(copy))); }
});

test('all prior touch production pins remain exact through the inverse current layer', () => {
  const touch = touchOpacityReview();
  for (const [path, hash] of Object.entries(touch.protectedProduction)) {
    assert.equal(sha(restoreInputModeBytes(path, read(path))), hash, path + ' exact original touch-era protected production');
    assert.equal(inputModeHash(path, hash), sha(readFileSync(path)), path + ' exact current identity from prior protected pin');
  }
  for (const [path, row] of Object.entries(touch.changes)) {
    assert.equal(sha(restoreInputModeBytes(path, read(path))), row.currentSha256, path + ' touch endpoint retained');
    assert.equal(sha(restoreTouchOpacityBytes(path, read(path))), row.previousSha256, path + ' exact touch baseline');
    assert.equal(touchOpacityHash(path, row.previousSha256), sha(readFileSync(path)), path + ' touch-to-current chain');
  }
  for (const [path, row] of Object.entries(touch.additions)) assert.equal(sha(restoreInputModeBytes(path, read(path))), row.sha256, path + ' exact touch addition retained');
});

test('all older input and menu proof chains retain every endpoint and original byte', () => {
  for (const [proof, hash, restore] of [
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
  assert.deepEqual(menuPresentationSourcePaths(inventory).sort(), inputModeSourcePaths(previousSources()).sort(), 'Global frozen source inventories include only the exact new module');
});

test('all frozen geometry, legal, publication and historical proof bytes remain unchanged', () => {
  assert.ok(Object.keys(review.protectedEvidence).length > 100);
  for (const path of ['tests/helpers/touch-opacity-transition.json', 'tests/helpers/loading-guide-transition.json', 'tests/helpers/mobile-controls-transition.json', 'tests/helpers/menu-presentation-transition.json', 'tests/helpers/stable-pages-repin-transition.json', 'tests/helpers/mobile-controls-protected-evidence.json', 'docs/stable-pages-manifest.json']) assert.ok(Object.hasOwn(review.protectedEvidence, path), path);
  for (const path of ['LICENSE', 'NOTICE', 'MODEL-NOTICE.txt', 'FOOD-ASSET-NOTICE.txt', 'ALPINE-PROP-NOTICE.txt', 'THIRD-PARTY-NOTICES.txt', 'SOURCE.txt', 'public/source.html', 'scripts/package-source.mjs']) assert.ok(Object.hasOwn(review.protectedLegal, path), path);
  for (const protectedFiles of [review.protectedLegal, review.protectedEvidence]) {
    for (const [path, hash] of Object.entries(protectedFiles)) assert.equal(sha(readFileSync(path)), stablePagesV050RepinHash(path, hash), path + ' immutable evidence');
  }
});

test('all new production, regression, audit and legal dependencies join both current stability closures', () => {
  const inventory = JSON.parse(read('tests/fixtures/airfield-enrichment-original-inventory.json')).sourceInventory;
  assert.deepEqual(inputModePathsWithin(inventory), [...new Set([...Object.keys(review.changes).filter(path => Object.hasOwn(inventory, path)), ...staticMenuArtPathsWithin(inventory)])]);
  for (const hashes of [gardenAuditHashes(), airfieldAuditHashes()]) {
    for (const path of inputModeAuditDependencies()) assert.equal(hashes[path], sha(readFileSync(path)), path + ' explicit current input-mode audit closure');
    for (const path of touchOpacityAuditDependencies()) assert.equal(hashes[path], sha(readFileSync(path)), path + ' retained touch audit closure');
  }
});
