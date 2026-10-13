import {stablePagesV050RepinHash} from './helpers/stable-pages-v050-repin-reviewed-revisions';
import {touchOpacityHash, restoreTouchOpacityBytes} from './helpers/touch-opacity-reviewed-revisions';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  LOADING_GUIDE_BASELINE_COMMIT, LOADING_GUIDE_BASELINE_TREE, LOADING_GUIDE_PRODUCTION_PATHS,
  LOADING_GUIDE_REVIEW_PATH, LOADING_GUIDE_REVIEW_SHA256,
  loadingGuideSha as sha, loadingGuideReview, assertLoadingGuideReviewBytes,
  loadingGuideHash, restoreLoadingGuideBytes, loadingGuideAuditDependencies,
} from './helpers/loading-guide-reviewed-revisions';
import {mobileControlsReview, mobileControlsHash, restoreMobileControlsBytes} from './helpers/mobile-controls-reviewed-revisions';
import {gardenAuditHashes} from './helpers/garden-enrichment-source-stability';
import {airfieldAuditHashes} from './helpers/airfield-enrichment-source-stability';
const read = (path: string) => readFileSync(path, 'utf8');
const review = loadingGuideReview();

test('loading guide pins exact published mobile dev tree with a presentation-only production delta', () => {
  assert.equal(LOADING_GUIDE_BASELINE_COMMIT, '80c72ea963196f415d0cccd6b4084d37e2c1ec8f');
  assert.equal(LOADING_GUIDE_BASELINE_TREE, 'a7f6defbe4fd7bd3b522822bc405c6f94c06d856');
  assert.equal(sha(read(LOADING_GUIDE_REVIEW_PATH)), LOADING_GUIDE_REVIEW_SHA256);
  assert.deepEqual(Object.keys(review.changes).filter(path => path.startsWith('src/')), [...LOADING_GUIDE_PRODUCTION_PATHS]);
  assert.equal(sha(read('tests/helpers/mobile-controls-transition.json')), 'c102771cf3f33552d57697ad22394da6c1d3a05735be5446b93e620e5cf5aa34');
  const protectedEvidence = JSON.parse(read('tests/helpers/mobile-controls-protected-evidence.json')) as Record<string, string>;
  assert.ok(Object.keys(protectedEvidence).length > 100);
  for (const [path, hash] of Object.entries(protectedEvidence)) assert.equal(sha(readFileSync(path)), stablePagesV050RepinHash(path, hash), path + ' unchanged historical evidence');
});

test('every loading-guide change reconstructs exact prior bytes and the complete forward round trip', () => {
  for (const [path, row] of Object.entries(review.changes)) {
    const raw = read(path), current = restoreTouchOpacityBytes(path, raw), original = restoreLoadingGuideBytes(path, raw);
    assert.equal(sha(current), row.currentSha256, path);
    assert.equal(sha(original), row.previousSha256, path);
    const lines = original.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    for (const hunk of [...row.hunks].reverse()) {
      assert.deepEqual(lines.slice(hunk.beforeStart, hunk.beforeStart + hunk.removedLines.length), hunk.removedLines, path);
      lines.splice(hunk.beforeStart, hunk.removedLines.length, ...hunk.insertedLines);
    }
    assert.equal(lines.join(''), current, path + ' exact forward reconstruction');
    assert.throws(() => restoreLoadingGuideBytes(path, raw + ' '));
    assert.throws(() => restoreLoadingGuideBytes(path, original), undefined, path + ' no historical fallback');
  }
});

test('loading-guide overlay rejects wrong incoming pairs, aliases and modified review records', () => {
  for (const [path, row] of Object.entries(review.changes)) {
    assert.equal(loadingGuideHash(path, row.previousSha256), touchOpacityHash(path, row.currentSha256));
    for (const incoming of [undefined, '', '0'.repeat(64), row.currentSha256]) assert.throws(() => loadingGuideHash(path, incoming), undefined, path);
    for (const alias of ['./' + path, path + '/extra']) assert.equal(loadingGuideHash(alias, row.previousSha256), row.previousSha256);
  }
  assert.throws(() => loadingGuideHash('src/game.ts', 'unchanged'), undefined, 'Music successor requires exact pre-music identity');
  for (const path of ['src/race-controls.ts', 'src/race-camera.ts', 'src/land-camera.ts']) assert.equal(loadingGuideHash(path, 'unchanged'), 'unchanged');
  const mobilePath = 'src/mobile-controls.ts', mobilePin = mobileControlsReview().additions[mobilePath].sha256;
  assert.equal(sha(restoreTouchOpacityBytes(mobilePath, read(mobilePath))), mobilePin, 'Exact formerly unchanged mobile source survives the input-mode inverse');
  assert.equal(loadingGuideHash(mobilePath, mobilePin), sha(read(mobilePath)), 'Only the new exact input-mode pair advances this source');
  assert.throws(() => loadingGuideHash(mobilePath, 'unchanged'));
  assert.throws(() => loadingGuideHash('docs/stable-pages-manifest.json', 'unchanged'), undefined, 'Repinned manifest requires its exact historical identity');
  assert.throws(() => assertLoadingGuideReviewBytes(read(LOADING_GUIDE_REVIEW_PATH) + ' '));
  for (const mutate of [
    (copy: typeof review) => { copy.baselineTree = '0'.repeat(40); },
    (copy: typeof review) => { copy.changes['src/unreviewed.ts'] = structuredClone(Object.values(copy.changes)[0]); },
    (copy: typeof review) => { Object.values(copy.changes)[0].hunks[0].removedLines.push('unreviewed\n'); },
  ]) { const copy = structuredClone(review); mutate(copy); assert.throws(() => assertLoadingGuideReviewBytes(JSON.stringify(copy))); }
});

test('mobile proof remains complete through the loading-guide chain and every audit dependency is covered', () => {
  for (const [path, row] of Object.entries(mobileControlsReview().changes)) {
    assert.equal(sha(restoreLoadingGuideBytes(path, read(path))), row.currentSha256, path + ' original mobile reviewed endpoint');
    assert.equal(sha(restoreMobileControlsBytes(path, read(path))), row.previousSha256, path + ' complete pre-mobile history');
    assert.equal(mobileControlsHash(path, row.previousSha256), sha(read(path)), path + ' historical-to-current identity');
  }
  for (const hashes of [gardenAuditHashes(), airfieldAuditHashes()]) {
    for (const path of loadingGuideAuditDependencies()) assert.equal(hashes[path], sha(readFileSync(path)), path + ' explicit current audit closure');
  }
});
