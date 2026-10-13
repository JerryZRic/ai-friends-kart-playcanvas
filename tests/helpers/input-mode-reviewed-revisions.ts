/** Exact input-mode detection/settings transition; prior input, geometry and legal proofs stay immutable. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const INPUT_MODE_BASELINE_COMMIT = 'befa8dda74887b4f04ecf33fe30091cd613545c1';
export const INPUT_MODE_BASELINE_TREE = 'f3a3bd9865ee129a29e6df818d85c953a8725e25';
export const INPUT_MODE_REVIEW_PATH = 'tests/helpers/input-mode-transition.json';
export const INPUT_MODE_REVIEW_SHA256 = 'fed720938f85546ad240223bb4c60b51c5f3058adf93cc8073e17eed57a2359e';
export const INPUT_MODE_PRODUCTION_PATHS = Object.freeze(["src/menu.css", "src/menu.ts", "src/mobile-controls.css", "src/mobile-controls.ts", "src/race-hud.ts"]);
export const INPUT_MODE_BRIDGE_PATHS = Object.freeze([
  'tests/audit-loading-guide-transition.test.ts', 'tests/audit-menu-presentation-transition.test.ts',
  'tests/audit-mobile-controls-transition.test.ts', 'tests/audit-touch-opacity-transition.test.ts',
  'tests/helpers/mobile-controls-reviewed-revisions.ts', 'tests/helpers/touch-opacity-reviewed-revisions.ts',
]);
export const INPUT_MODE_REGRESSION_PATHS = Object.freeze(["tests/mobile-controls.test.ts", "tests/race-loading-ui.test.ts", "tests/race-ui-layout.test.ts"]);
export const INPUT_MODE_SOURCE_ADDITIONS = Object.freeze(['src/control-mode.ts']);
export const INPUT_MODE_TEST_ADDITIONS = Object.freeze(["tests/control-mode.test.ts", "tests/control-settings-entries.test.ts"]);
type Hunk = {beforeStart: number; afterStart: number; removedLines: string[]; insertedLines: string[]};
type Revision = {previousSha256: string; currentSha256: string; scope: string; hunks: Hunk[]};
type Review = {
  schema: string; baselineCommit: string; baselineTree: string;
  changes: Record<string, Revision>; additions: Record<string, {sha256: string; scope: string}>;
  protectedProduction: Record<string, string>; protectedLegal: Record<string, string>; protectedEvidence: Record<string, string>;
};
export const inputModeSha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export function assertInputModeReviewBytes(bytes: string): Review {
  assert.equal(inputModeSha(bytes), INPUT_MODE_REVIEW_SHA256, 'Exact reviewed input-mode detection and settings transition');
  const review = JSON.parse(bytes) as Review;
  assert.equal(review.schema, 'input-mode-transition-v1');
  assert.equal(review.baselineCommit, INPUT_MODE_BASELINE_COMMIT);
  assert.equal(review.baselineTree, INPUT_MODE_BASELINE_TREE);
  assert.deepEqual(Object.keys(review.changes), [...INPUT_MODE_PRODUCTION_PATHS, ...INPUT_MODE_BRIDGE_PATHS, ...INPUT_MODE_REGRESSION_PATHS]);
  assert.deepEqual(Object.keys(review.additions), [...INPUT_MODE_SOURCE_ADDITIONS, ...INPUT_MODE_TEST_ADDITIONS]);
  for (const [path, row] of Object.entries(review.changes)) {
    assert.match(row.previousSha256, /^[a-f0-9]{64}$/); assert.match(row.currentSha256, /^[a-f0-9]{64}$/);
    assert.notEqual(row.previousSha256, row.currentSha256); assert.ok(row.scope && row.hunks.length, path);
    let beforeEnd = 0, afterEnd = 0;
    for (const hunk of row.hunks) {
      assert.ok(Number.isSafeInteger(hunk.beforeStart) && hunk.beforeStart >= beforeEnd, path + ' ordered baseline hunks');
      assert.ok(Number.isSafeInteger(hunk.afterStart) && hunk.afterStart >= afterEnd, path + ' ordered current hunks');
      assert.ok(hunk.removedLines.every(line => typeof line === 'string'));
      assert.ok(hunk.insertedLines.every(line => typeof line === 'string'));
      assert.ok(hunk.removedLines.length || hunk.insertedLines.length, path + ' nonempty change');
      beforeEnd = hunk.beforeStart + hunk.removedLines.length; afterEnd = hunk.afterStart + hunk.insertedLines.length;
    }
  }
  for (const row of Object.values(review.additions)) { assert.match(row.sha256, /^[a-f0-9]{64}$/); assert.ok(row.scope); }
  for (const protectedFiles of [review.protectedProduction, review.protectedLegal, review.protectedEvidence]) {
    assert.ok(Object.keys(protectedFiles).length);
    for (const [path, hash] of Object.entries(protectedFiles)) {
      assert.match(hash, /^[a-f0-9]{64}$/);
      assert.ok(!Object.hasOwn(review.changes, path) && !Object.hasOwn(review.additions, path), path + ' protected bytes cannot be repinned');
    }
  }
  return review;
}
export function inputModeReview() { return assertInputModeReviewBytes(readFileSync(INPUT_MODE_REVIEW_PATH, 'utf8')); }
export function inputModeHash(path: string, incoming: unknown) {
  const review = inputModeReview();
  if (!Object.hasOwn(review.changes, path)) return incoming;
  const row = review.changes[path];
  assert.equal(incoming, row.previousSha256, path + ' exact pre-input-mode incoming identity');
  return row.currentSha256;
}
export function inputModePathsWithin(inventory: Record<string, unknown>) {
  return Object.keys(inputModeReview().changes).filter(path => Object.hasOwn(inventory, path));
}
export function assertInputModeAddition(path: string, bytes: string | Buffer) {
  const review = inputModeReview();
  assert.ok(Object.hasOwn(review.additions, path), path + ' explicit reviewed input-mode addition');
  const row = review.additions[path];
  assert.equal(inputModeSha(bytes), row.sha256, path + ' exact new dependency bytes');
}
export function inputModeSourcePaths(previous: string[]) {
  for (const path of INPUT_MODE_SOURCE_ADDITIONS) {
    assert.ok(!previous.includes(path), path + ' must be an explicit new production input');
    assertInputModeAddition(path, readFileSync(path));
  }
  return [...previous, ...INPUT_MODE_SOURCE_ADDITIONS];
}
export function restoreInputModeBytes(path: string, current: string) {
  const review = inputModeReview();
  if (!Object.hasOwn(review.changes, path)) return current;
  const row = review.changes[path];
  assert.equal(inputModeSha(current), row.currentSha256, path + ' exact reviewed bytes before input-mode inverse');
  const lines = current.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  for (const hunk of [...row.hunks].reverse()) {
    assert.deepEqual(lines.slice(hunk.afterStart, hunk.afterStart + hunk.insertedLines.length), hunk.insertedLines, path + ' exact inserted input-mode bytes');
    lines.splice(hunk.afterStart, hunk.insertedLines.length, ...hunk.removedLines);
  }
  const original = lines.join('');
  assert.equal(inputModeSha(original), row.previousSha256, path + ' complete published touch-presentation bytes reconstructed');
  return original;
}
export function inputModeAuditDependencies() {
  const review = inputModeReview();
  return [INPUT_MODE_REVIEW_PATH, 'tests/helpers/input-mode-reviewed-revisions.ts', 'tests/audit-input-mode-transition.test.ts',
    ...Object.keys(review.changes), ...Object.keys(review.additions), ...Object.keys(review.protectedLegal), ...Object.keys(review.protectedEvidence)];
}
