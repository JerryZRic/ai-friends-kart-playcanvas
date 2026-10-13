import {inputModeHash, inputModePathsWithin, restoreInputModeBytes, inputModeAuditDependencies} from './input-mode-reviewed-revisions';
/** Exact touch-paint and legal-shortcut presentation transition; historical proofs stay immutable. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const TOUCH_OPACITY_BASELINE_COMMIT = 'f8d3615bacafae78eadd81224ee78a91e362b677';
export const TOUCH_OPACITY_BASELINE_TREE = '2d6fae0d9b46c66115ea40a6043eb7d2e0181420';
export const TOUCH_OPACITY_REVIEW_PATH = 'tests/helpers/touch-opacity-transition.json';
export const TOUCH_OPACITY_REVIEW_SHA256 = '994d5865aa1f2b98192d8603e821829368166aab265e5e6554597c240630ec07';
export const TOUCH_OPACITY_PRODUCTION_PATHS = Object.freeze(['src/menu.css', 'src/mobile-controls.css', 'src/race-ui.css']);
export const TOUCH_OPACITY_BRIDGE_PATHS = Object.freeze(['tests/audit-loading-guide-transition.test.ts', 'tests/helpers/loading-guide-reviewed-revisions.ts']);
export const TOUCH_OPACITY_TEST_ADDITIONS = Object.freeze(['tests/touch-control-presentation.test.ts']);
type Hunk = {beforeStart: number; afterStart: number; removedLines: string[]; insertedLines: string[]};
type Revision = {previousSha256: string; currentSha256: string; scope: string; hunks: Hunk[]};
type Review = {
  schema: string; baselineCommit: string; baselineTree: string;
  changes: Record<string, Revision>; additions: Record<string, {sha256: string; scope: string}>;
  protectedProduction: Record<string, string>; protectedLegal: Record<string, string>; protectedEvidence: Record<string, string>;
};
export const touchOpacitySha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export function assertTouchOpacityReviewBytes(bytes: string): Review {
  assert.equal(touchOpacitySha(bytes), TOUCH_OPACITY_REVIEW_SHA256, 'Exact reviewed touch-paint and legal-shortcut transition');
  const review = JSON.parse(bytes) as Review;
  assert.equal(review.schema, 'touch-opacity-transition-v1');
  assert.equal(review.baselineCommit, TOUCH_OPACITY_BASELINE_COMMIT);
  assert.equal(review.baselineTree, TOUCH_OPACITY_BASELINE_TREE);
  assert.deepEqual(Object.keys(review.changes), [...TOUCH_OPACITY_PRODUCTION_PATHS, ...TOUCH_OPACITY_BRIDGE_PATHS]);
  assert.deepEqual(Object.keys(review.additions), [...TOUCH_OPACITY_TEST_ADDITIONS]);
  for (const [path, row] of Object.entries(review.changes)) {
    assert.match(row.previousSha256, /^[a-f0-9]{64}$/); assert.match(row.currentSha256, /^[a-f0-9]{64}$/);
    assert.notEqual(row.previousSha256, row.currentSha256); assert.ok(row.scope && row.hunks.length, path);
    for (const hunk of row.hunks) {
      assert.ok(Number.isSafeInteger(hunk.beforeStart) && hunk.beforeStart >= 0);
      assert.ok(Number.isSafeInteger(hunk.afterStart) && hunk.afterStart >= 0);
      assert.ok(hunk.removedLines.every(line => typeof line === 'string'));
      assert.ok(hunk.insertedLines.every(line => typeof line === 'string'));
    }
  }
  for (const row of Object.values(review.additions)) { assert.match(row.sha256, /^[a-f0-9]{64}$/); assert.ok(row.scope); }
  for (const protectedFiles of [review.protectedProduction, review.protectedLegal, review.protectedEvidence]) {
    assert.ok(Object.keys(protectedFiles).length);
    for (const [path, hash] of Object.entries(protectedFiles)) {
      assert.match(hash, /^[a-f0-9]{64}$/); assert.ok(!Object.hasOwn(review.changes, path), path + ' is protected, never repinned');
    }
  }
  return review;
}
export function touchOpacityReview() { return assertTouchOpacityReviewBytes(readFileSync(TOUCH_OPACITY_REVIEW_PATH, 'utf8')); }
export function touchOpacityHash(path: string, incoming: unknown) {
  const review = touchOpacityReview();
  if (!Object.hasOwn(review.changes, path)) return inputModeHash(path, incoming);
  const row = review.changes[path];
  assert.equal(incoming, row.previousSha256, path + ' exact pre-touch-presentation incoming identity');
  return inputModeHash(path, row.currentSha256);
}
export function touchOpacityPathsWithin(inventory: Record<string, unknown>) {
  return [...new Set([...Object.keys(touchOpacityReview().changes).filter(path => Object.hasOwn(inventory, path)), ...inputModePathsWithin(inventory)])];
}
export function restoreTouchOpacityBytes(path: string, current: string) {
  current = restoreInputModeBytes(path, current);
  const review = touchOpacityReview();
  if (!Object.hasOwn(review.changes, path)) return current;
  const row = review.changes[path];
  assert.equal(touchOpacitySha(current), row.currentSha256, path + ' exact reviewed bytes before touch-presentation inverse');
  const lines = current.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  for (const hunk of [...row.hunks].reverse()) {
    assert.deepEqual(lines.slice(hunk.afterStart, hunk.afterStart + hunk.insertedLines.length), hunk.insertedLines, path + ' exact inserted touch-presentation bytes');
    lines.splice(hunk.afterStart, hunk.insertedLines.length, ...hunk.removedLines);
  }
  const original = lines.join('');
  assert.equal(touchOpacitySha(original), row.previousSha256, path + ' complete published loading-guide bytes reconstructed');
  return original;
}
export function touchOpacityAuditDependencies() {
  const review = touchOpacityReview();
  return [TOUCH_OPACITY_REVIEW_PATH, 'tests/helpers/touch-opacity-reviewed-revisions.ts', 'tests/audit-touch-opacity-transition.test.ts',
    ...Object.keys(review.changes), ...Object.keys(review.additions), ...Object.keys(review.protectedLegal), ...inputModeAuditDependencies()];
}
