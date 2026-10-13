/** Exact static-title art transition; published input, geometry and legal evidence remains immutable. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const STATIC_MENU_ART_BASELINE_COMMIT = 'd0acc156e4902c2741ea7a1dc35966a7e82a4f34';
export const STATIC_MENU_ART_BASELINE_TREE = 'fd4a15d9c7a6255d3c2f3570d714133c4321fa2c';
export const STATIC_MENU_ART_REVIEW_PATH = 'tests/helpers/static-menu-art-transition.json';
export const STATIC_MENU_ART_REVIEW_SHA256 = 'c525470b21e1cca0ba59669889c68567011f959a7197ba17a420f3c86a992493';
export const STATIC_MENU_ART_PRODUCTION_PATHS = Object.freeze(['index.html', 'src/menu.ts']);
export const STATIC_MENU_ART_BRIDGE_PATHS = Object.freeze(['tests/audit-input-mode-transition.test.ts', 'tests/helpers/input-mode-reviewed-revisions.ts']);
export const STATIC_MENU_ART_REGRESSION_PATHS = Object.freeze(['tests/free-mode-menu-dom.test.ts', 'tests/menu-fixed-layout.test.ts']);
export const STATIC_MENU_ART_SOURCE_ADDITIONS = Object.freeze(['src/title-menu.css']);
export const STATIC_MENU_ART_ASSET_ADDITIONS: readonly string[] = Object.freeze(['public/menu-art/title-logo.png', 'public/menu-art/whale-maid.png']);
export const STATIC_MENU_ART_TEST_ADDITIONS = Object.freeze(['tests/title-menu.test.ts']);
type Hunk = {beforeStart: number; afterStart: number; removedLines: string[]; insertedLines: string[]};
type Revision = {previousSha256: string; currentSha256: string; scope: string; hunks: Hunk[]};
type Review = {
  schema: string; baselineCommit: string; baselineTree: string;
  changes: Record<string, Revision>; additions: Record<string, {sha256: string; scope: string}>;
  protectedProduction: Record<string, string>; protectedLegal: Record<string, string>; protectedEvidence: Record<string, string>;
};
export const staticMenuArtSha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export function assertStaticMenuArtReviewBytes(bytes: string): Review {
  assert.equal(staticMenuArtSha(bytes), STATIC_MENU_ART_REVIEW_SHA256, 'Exact reviewed static-title art transition');
  const review = JSON.parse(bytes) as Review;
  assert.equal(review.schema, 'static-menu-art-transition-v1');
  assert.equal(review.baselineCommit, STATIC_MENU_ART_BASELINE_COMMIT);
  assert.equal(review.baselineTree, STATIC_MENU_ART_BASELINE_TREE);
  assert.deepEqual(Object.keys(review.changes), [...STATIC_MENU_ART_PRODUCTION_PATHS, ...STATIC_MENU_ART_BRIDGE_PATHS, ...STATIC_MENU_ART_REGRESSION_PATHS]);
  assert.deepEqual(Object.keys(review.additions), [...STATIC_MENU_ART_SOURCE_ADDITIONS, ...STATIC_MENU_ART_ASSET_ADDITIONS, ...STATIC_MENU_ART_TEST_ADDITIONS]);
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
export function staticMenuArtReview() { return assertStaticMenuArtReviewBytes(readFileSync(STATIC_MENU_ART_REVIEW_PATH, 'utf8')); }
export function staticMenuArtHash(path: string, incoming: unknown) {
  const review = staticMenuArtReview();
  if (!Object.hasOwn(review.changes, path)) return incoming;
  const row = review.changes[path];
  assert.equal(incoming, row.previousSha256, path + ' exact pre-static-title incoming identity');
  return row.currentSha256;
}
export function staticMenuArtPathsWithin(inventory: Record<string, unknown>) {
  return Object.keys(staticMenuArtReview().changes).filter(path => Object.hasOwn(inventory, path));
}
export function assertStaticMenuArtAddition(path: string, bytes: string | Buffer) {
  const review = staticMenuArtReview();
  assert.ok(Object.hasOwn(review.additions, path), path + ' explicit reviewed static-title addition');
  assert.equal(staticMenuArtSha(bytes), review.additions[path].sha256, path + ' exact new dependency bytes');
}
export function staticMenuArtSourcePaths(previous: string[]) {
  for (const path of STATIC_MENU_ART_SOURCE_ADDITIONS) {
    assert.ok(!previous.includes(path), path + ' must be an explicit new production input');
    assertStaticMenuArtAddition(path, readFileSync(path));
  }
  return [...previous, ...STATIC_MENU_ART_SOURCE_ADDITIONS];
}
export function restoreStaticMenuArtBytes(path: string, current: string) {
  const review = staticMenuArtReview();
  if (!Object.hasOwn(review.changes, path)) return current;
  const row = review.changes[path];
  assert.equal(staticMenuArtSha(current), row.currentSha256, path + ' exact reviewed bytes before static-title inverse');
  const lines = current.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  for (const hunk of [...row.hunks].reverse()) {
    assert.deepEqual(lines.slice(hunk.afterStart, hunk.afterStart + hunk.insertedLines.length), hunk.insertedLines, path + ' exact inserted static-title bytes');
    lines.splice(hunk.afterStart, hunk.insertedLines.length, ...hunk.removedLines);
  }
  const original = lines.join('');
  assert.equal(staticMenuArtSha(original), row.previousSha256, path + ' complete published input-mode bytes reconstructed');
  return original;
}
export function staticMenuArtAuditDependencies() {
  const review = staticMenuArtReview();
  return [STATIC_MENU_ART_REVIEW_PATH, 'tests/helpers/static-menu-art-reviewed-revisions.ts', 'tests/audit-static-menu-art-transition.test.ts',
    ...Object.keys(review.changes), ...Object.keys(review.additions), ...Object.keys(review.protectedLegal), ...Object.keys(review.protectedEvidence)];
}
