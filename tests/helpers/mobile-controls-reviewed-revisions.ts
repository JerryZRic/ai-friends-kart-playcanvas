/** Exact additive mobile-input transition. Historical scene and publication evidence is never regenerated. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const MOBILE_CONTROLS_BASELINE_COMMIT = '26a7ea81bd927bf8399384e2a168721ba645c783';
export const MOBILE_CONTROLS_BASELINE_TREE = '4bdee3f165474f1022029b4911a0272a36a68bcd';
export const MOBILE_CONTROLS_REVIEW_PATH = 'tests/helpers/mobile-controls-transition.json';
export const MOBILE_CONTROLS_REVIEW_SHA256 = 'c102771cf3f33552d57697ad22394da6c1d3a05735be5446b93e620e5cf5aa34';
export const MOBILE_CONTROLS_PRODUCTION_PATHS = Object.freeze([
  'coast.html', 'src/race-control-guide.ts', 'src/race-controls.ts', 'src/race-hud.ts',
  'src/race-loading-ui.ts', 'src/race-shell.ts', 'src/race-ui.css', 'waterpark.html',
]);
export const MOBILE_CONTROLS_SOURCE_ADDITIONS = Object.freeze(['src/mobile-controls.css', 'src/mobile-controls.ts']);
type Hunk = {beforeStart: number; afterStart: number; removedLines: string[]; insertedLines: string[]};
type Revision = {previousSha256: string; currentSha256: string; scope: string; hunks: Hunk[]};
type Review = {schema: string; baselineCommit: string; baselineTree: string; publicBaselineCommit: string; changes: Record<string, Revision>; additions: Record<string, {sha256: string; scope: string}>};
export const mobileControlsSha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export function assertMobileControlsReviewBytes(bytes: string): Review {
  assert.equal(mobileControlsSha(bytes), MOBILE_CONTROLS_REVIEW_SHA256, 'Exact independently reviewed mobile controls transition');
  const review = JSON.parse(bytes) as Review;
  assert.equal(review.schema, 'mobile-controls-transition-v1');
  assert.equal(review.baselineCommit, MOBILE_CONTROLS_BASELINE_COMMIT);
  assert.equal(review.baselineTree, MOBILE_CONTROLS_BASELINE_TREE);
  assert.equal(review.publicBaselineCommit, '5774f6ade2a51007031c7157fc012bd3def132b1');
  assert.deepEqual(Object.keys(review.changes).filter(path => path.startsWith('src/') || path.endsWith('.html')), [...MOBILE_CONTROLS_PRODUCTION_PATHS]);
  assert.deepEqual(Object.keys(review.additions).filter(path => path.startsWith('src/')), [...MOBILE_CONTROLS_SOURCE_ADDITIONS]);
  assert.ok(Object.keys(review.changes).every(path => !path.startsWith('tests/fixtures/') && !path.startsWith('docs/') && !path.startsWith('.github/')), 'No historical fixture, scene baseline, stable manifest or publication workflow changes');
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
export function mobileControlsReview() { return assertMobileControlsReviewBytes(readFileSync(MOBILE_CONTROLS_REVIEW_PATH, 'utf8')); }
export function mobileControlsHash(path: string, incoming: unknown) {
  const review = mobileControlsReview();
  if (!Object.hasOwn(review.changes, path)) return incoming;
  const row = review.changes[path];
  assert.equal(incoming, row.previousSha256, path + ' exact pre-mobile incoming identity');
  return row.currentSha256;
}
export function mobileControlsPathsWithin(inventory: Record<string, unknown>) {
  return Object.keys(mobileControlsReview().changes).filter(path => Object.hasOwn(inventory, path));
}
export function mobileControlsSourcePaths(previous: string[]) {
  const additions = Object.entries(mobileControlsReview().additions).filter(([path]) => path.startsWith('src/'));
  for (const [path, row] of additions) {
    assert.ok(!previous.includes(path), path + ' explicit new production input');
    assert.equal(mobileControlsSha(readFileSync(path)), row.sha256, path + ' exact mobile-only addition');
  }
  return [...previous, ...additions.map(([path]) => path)];
}
export function restoreMobileControlsBytes(path: string, current: string) {
  const review = mobileControlsReview();
  if (!Object.hasOwn(review.changes, path)) return current;
  const row = review.changes[path];
  assert.equal(mobileControlsSha(current), row.currentSha256, path + ' exact reviewed current bytes before mobile inverse');
  const lines = current.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  for (const hunk of [...row.hunks].reverse()) {
    assert.deepEqual(lines.slice(hunk.afterStart, hunk.afterStart + hunk.insertedLines.length), hunk.insertedLines, path + ' exact inserted mobile bytes');
    lines.splice(hunk.afterStart, hunk.insertedLines.length, ...hunk.removedLines);
  }
  const original = lines.join('');
  assert.equal(mobileControlsSha(original), row.previousSha256, path + ' complete historical bytes reconstructed');
  return original;
}
export function mobileControlsAuditDependencies() {
  const review = mobileControlsReview();
  return [MOBILE_CONTROLS_REVIEW_PATH, 'tests/helpers/mobile-controls-reviewed-revisions.ts', 'tests/audit-mobile-controls-transition.test.ts', ...Object.keys(review.changes), ...Object.keys(review.additions)];
}
