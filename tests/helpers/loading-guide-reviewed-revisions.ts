import {touchOpacityHash, touchOpacityPathsWithin, restoreTouchOpacityBytes, touchOpacityAuditDependencies} from './touch-opacity-reviewed-revisions';
/** Exact loading-guide presentation follow-up; prior mobile and geometry evidence remains immutable. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const LOADING_GUIDE_BASELINE_COMMIT = '80c72ea963196f415d0cccd6b4084d37e2c1ec8f';
export const LOADING_GUIDE_BASELINE_TREE = 'a7f6defbe4fd7bd3b522822bc405c6f94c06d856';
export const LOADING_GUIDE_REVIEW_PATH = 'tests/helpers/loading-guide-transition.json';
export const LOADING_GUIDE_REVIEW_SHA256 = '17b48d3b06e78496ca2070f3cae971c41f284baeafb96df63f821d407adb7c74';
export const LOADING_GUIDE_PRODUCTION_PATHS = Object.freeze(["src/mobile-controls.css", "src/race-control-guide.ts", "src/race-loading-ui.ts"]);
type Hunk = {beforeStart: number; afterStart: number; removedLines: string[]; insertedLines: string[]};
type Revision = {previousSha256: string; currentSha256: string; scope: string; hunks: Hunk[]};
type Review = {schema: string; baselineCommit: string; baselineTree: string; publicBaselineCommit: string; changes: Record<string, Revision>};
export const loadingGuideSha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export function assertLoadingGuideReviewBytes(bytes: string): Review {
  assert.equal(loadingGuideSha(bytes), LOADING_GUIDE_REVIEW_SHA256, 'Exact reviewed loading-guide transition');
  const review = JSON.parse(bytes) as Review;
  assert.equal(review.schema, 'loading-guide-transition-v1');
  assert.equal(review.baselineCommit, LOADING_GUIDE_BASELINE_COMMIT);
  assert.equal(review.baselineTree, LOADING_GUIDE_BASELINE_TREE);
  assert.equal(review.publicBaselineCommit, '6844110cb77bb5b71041786f1802217766a8f759');
  assert.deepEqual(Object.keys(review.changes).filter(path => path.startsWith('src/')), [...LOADING_GUIDE_PRODUCTION_PATHS]);
  assert.ok(Object.keys(review.changes).every(path => path.startsWith('src/') || (path.startsWith('tests/') && !path.startsWith('tests/fixtures/'))));
  assert.ok(!Object.hasOwn(review.changes, 'tests/helpers/mobile-controls-transition.json'), 'Original mobile proof is immutable');
  for (const row of Object.values(review.changes)) {
    assert.match(row.previousSha256, /^[a-f0-9]{64}$/); assert.match(row.currentSha256, /^[a-f0-9]{64}$/);
    assert.notEqual(row.previousSha256, row.currentSha256); assert.ok(row.scope && row.hunks.length);
    for (const hunk of row.hunks) {
      assert.ok(Number.isSafeInteger(hunk.beforeStart) && hunk.beforeStart >= 0);
      assert.ok(Number.isSafeInteger(hunk.afterStart) && hunk.afterStart >= 0);
      assert.ok(hunk.removedLines.every(line => typeof line === 'string'));
      assert.ok(hunk.insertedLines.every(line => typeof line === 'string'));
    }
  }
  return review;
}
export function loadingGuideReview() { return assertLoadingGuideReviewBytes(readFileSync(LOADING_GUIDE_REVIEW_PATH, 'utf8')); }
export function loadingGuideHash(path: string, incoming: unknown) {
  const review = loadingGuideReview();
  if (!Object.hasOwn(review.changes, path)) return touchOpacityHash(path, incoming);
  const row = review.changes[path];
  assert.equal(incoming, row.previousSha256, path + ' exact pre-loading-guide incoming identity');
  return touchOpacityHash(path, row.currentSha256);
}
export function loadingGuidePathsWithin(inventory: Record<string, unknown>) {
  return [...new Set([...Object.keys(loadingGuideReview().changes).filter(path => Object.hasOwn(inventory, path)), ...touchOpacityPathsWithin(inventory)])];
}
export function restoreLoadingGuideBytes(path: string, current: string) {
  current = restoreTouchOpacityBytes(path, current);
  const review = loadingGuideReview();
  if (!Object.hasOwn(review.changes, path)) return current;
  const row = review.changes[path];
  assert.equal(loadingGuideSha(current), row.currentSha256, path + ' exact reviewed current bytes before loading-guide inverse');
  const lines = current.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  for (const hunk of [...row.hunks].reverse()) {
    assert.deepEqual(lines.slice(hunk.afterStart, hunk.afterStart + hunk.insertedLines.length), hunk.insertedLines, path + ' exact inserted loading-guide bytes');
    lines.splice(hunk.afterStart, hunk.insertedLines.length, ...hunk.removedLines);
  }
  const original = lines.join('');
  assert.equal(loadingGuideSha(original), row.previousSha256, path + ' complete mobile-era bytes reconstructed');
  return original;
}
export function loadingGuideAuditDependencies() {
  return [LOADING_GUIDE_REVIEW_PATH, 'tests/helpers/loading-guide-reviewed-revisions.ts', 'tests/audit-loading-guide-transition.test.ts', ...Object.keys(loadingGuideReview().changes), ...touchOpacityAuditDependencies()];
}
