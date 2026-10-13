import {loadingGuideHash, loadingGuidePathsWithin, restoreLoadingGuideBytes} from './helpers/loading-guide-reviewed-revisions';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  MOBILE_CONTROLS_BASELINE_COMMIT, MOBILE_CONTROLS_BASELINE_TREE,
  MOBILE_CONTROLS_REVIEW_PATH, MOBILE_CONTROLS_REVIEW_SHA256,
  MOBILE_CONTROLS_PRODUCTION_PATHS, MOBILE_CONTROLS_SOURCE_ADDITIONS,
  mobileControlsSha as sha, mobileControlsReview, assertMobileControlsReviewBytes,
  mobileControlsHash, mobileControlsPathsWithin, mobileControlsSourcePaths,
  restoreMobileControlsBytes, mobileControlsAuditDependencies,
} from './helpers/mobile-controls-reviewed-revisions';
import {gardenAuditHashes} from './helpers/garden-enrichment-source-stability';
import {airfieldAuditHashes} from './helpers/airfield-enrichment-source-stability';
const read = (path: string) => readFileSync(path, 'utf8');
const review = mobileControlsReview();

test('mobile input names the exact prior dev tree and bounded shared input-only production delta', () => {
  assert.equal(MOBILE_CONTROLS_BASELINE_COMMIT, '26a7ea81bd927bf8399384e2a168721ba645c783');
  assert.equal(MOBILE_CONTROLS_BASELINE_TREE, '4bdee3f165474f1022029b4911a0272a36a68bcd');
  assert.equal(sha(read(MOBILE_CONTROLS_REVIEW_PATH)), MOBILE_CONTROLS_REVIEW_SHA256);
  assert.deepEqual(Object.keys(review.changes).filter(path => path.startsWith('src/') || path.endsWith('.html')), [...MOBILE_CONTROLS_PRODUCTION_PATHS]);
  assert.deepEqual(Object.keys(review.additions).filter(path => path.startsWith('src/')), [...MOBILE_CONTROLS_SOURCE_ADDITIONS]);
  assert.ok(Object.keys(review.changes).every(path => !path.startsWith('tests/fixtures/') && !path.startsWith('docs/') && !path.startsWith('.github/')));
});

test('every mobile transition reconstructs every historical byte and a complete forward round trip', () => {
  for (const [path, row] of Object.entries(review.changes)) {
    const raw = read(path), current = restoreLoadingGuideBytes(path, raw), original = restoreMobileControlsBytes(path, raw);
    assert.equal(sha(current), row.currentSha256, path); assert.equal(sha(original), row.previousSha256, path);
    const lines = original.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    for (const hunk of [...row.hunks].reverse()) {
      assert.deepEqual(lines.slice(hunk.beforeStart, hunk.beforeStart + hunk.removedLines.length), hunk.removedLines, path);
      lines.splice(hunk.beforeStart, hunk.removedLines.length, ...hunk.insertedLines);
    }
    assert.equal(lines.join(''), current, path + ' exact forward reconstruction');
    assert.throws(() => restoreMobileControlsBytes(path, raw + ' '));
    assert.throws(() => restoreMobileControlsBytes(path, original), undefined, path + ' no historical-byte fallback');
  }
  for (const [path, row] of Object.entries(review.additions)) assert.equal(sha(restoreLoadingGuideBytes(path, read(path))), row.sha256, path + ' exact new dependency');
});

test('mobile overlay only accepts exact incoming pairs and rejects aliases, current fallback and record tampering', () => {
  for (const [path, row] of Object.entries(review.changes)) {
    assert.equal(mobileControlsHash(path, row.previousSha256), loadingGuideHash(path, row.currentSha256));
    for (const incoming of [undefined, '', '0'.repeat(64), row.currentSha256]) assert.throws(() => mobileControlsHash(path, incoming), undefined, path);
    for (const alias of ['./' + path, path + '/extra']) assert.equal(mobileControlsHash(alias, row.previousSha256), row.previousSha256);
  }
  for (const path of ['src/game.ts', 'src/race-camera.ts', 'src/land-camera.ts', 'src/vehicle-controls.js', 'docs/stable-pages-manifest.json']) assert.equal(mobileControlsHash(path, 'unchanged'), 'unchanged');
  assert.throws(() => assertMobileControlsReviewBytes(read(MOBILE_CONTROLS_REVIEW_PATH) + ' '));
  for (const mutate of [
    (copy: typeof review) => { copy.baselineTree = '0'.repeat(40); },
    (copy: typeof review) => { copy.changes['src/unreviewed.ts'] = structuredClone(Object.values(copy.changes)[0]); },
    (copy: typeof review) => { Object.values(copy.changes)[0].hunks[0].removedLines.push('unreviewed\n'); },
    (copy: typeof review) => { Object.values(copy.additions)[0].sha256 = 'f'.repeat(64); },
  ]) { const copy = structuredClone(review); mutate(copy); assert.throws(() => assertMobileControlsReviewBytes(JSON.stringify(copy))); }
});

test('historical geometry, camera, source inventories and stable publication evidence remain byte-exact', () => {
  const protectedEvidence = JSON.parse(read('tests/helpers/mobile-controls-protected-evidence.json')) as Record<string, string>;
  assert.ok(Object.keys(protectedEvidence).length > 100);
  for (const [path, digest] of Object.entries(protectedEvidence)) assert.equal(sha(readFileSync(path)), digest, path + ' immutable historical evidence');
  assert.ok(Object.hasOwn(protectedEvidence, 'docs/stable-pages-manifest.json'));
  assert.ok(Object.hasOwn(protectedEvidence, 'docs/airfield-enrichment-qa-files.json'));
  assert.ok(Object.hasOwn(protectedEvidence, 'tests/helpers/menu-presentation-transition.json'));
  assert.ok(Object.hasOwn(protectedEvidence, 'tests/helpers/stable-pages-repin-transition.json'));
});

test('source additions and camera stability closures include the exact mobile modules and every proof dependency', () => {
  const inventory = JSON.parse(read('tests/fixtures/airfield-enrichment-original-inventory.json')).sourceInventory;
  assert.deepEqual(mobileControlsPathsWithin(inventory), [...new Set([...Object.keys(review.changes).filter(path => Object.hasOwn(inventory, path)), ...loadingGuidePathsWithin(inventory)])]);
  const previous = Object.keys(inventory).filter(path => path.startsWith('src/'));
  assert.deepEqual(mobileControlsSourcePaths(previous), [...previous, ...MOBILE_CONTROLS_SOURCE_ADDITIONS]);
  for (const hashes of [gardenAuditHashes(), airfieldAuditHashes()]) {
    for (const path of mobileControlsAuditDependencies()) assert.equal(hashes[path], sha(readFileSync(path)), path);
  }
});
