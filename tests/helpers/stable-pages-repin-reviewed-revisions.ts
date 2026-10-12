import {restoreMobileControlsBytes} from './mobile-controls-reviewed-revisions';
/** Exact dev-preservation repin after the immutable menu/publication review. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const STABLE_PAGES_REPIN_REVIEW_PATH = 'tests/helpers/stable-pages-repin-transition.json';
export const STABLE_PAGES_REPIN_REVIEW_SHA256 = '0b406ff247642f2b0ad76fe5cc5c6da76f6a1573a7b6ffe25185d67df5e7b9e7';
export const STABLE_PAGES_REPIN_BASELINE_COMMIT = '58a3452177acd1e1a2d84e019f014c778f834d89';
export const STABLE_PAGES_REPIN_PUBLIC_BASELINE_COMMIT = '6844110cb77bb5b71041786f1802217766a8f759';
export const STABLE_PAGES_REPIN_BASELINE_TREE = 'eac91a077f6a27e21f9d3a48039c302a16b4ed2a';
export const STABLE_PAGES_REPIN_PATHS = Object.freeze([
  'docs/stable-pages-manifest.json',
  'tests/helpers/menu-presentation-reviewed-revisions.ts',
  'tests/audit-menu-presentation-transition.test.ts',
]);
type Hunk = {beforeStart: number; afterStart: number; removedLines: string[]; insertedLines: string[]};
type Revision = {previousSha256: string; currentSha256: string; scope: string; hunks: Hunk[]};
type Review = {
  schema: string; baselineCommit: string; publicBaselineCommit: string; baselineTree: string;
  previousAirfieldManifestSha256: string; previousPublication: Record<string, unknown>;
  currentPublication: Record<string, unknown>; currentStableFileCount: number; changes: Record<string, Revision>;
};
export const stablePagesRepinSha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export function assertStablePagesRepinReviewBytes(bytes: string): Review {
  assert.equal(stablePagesRepinSha(bytes), STABLE_PAGES_REPIN_REVIEW_SHA256, 'Exact independently reviewed stable repin bytes');
  const review = JSON.parse(bytes) as Review;
  assert.equal(review.schema, 'stable-pages-repin-transition-v1');
  assert.equal(review.baselineCommit, STABLE_PAGES_REPIN_BASELINE_COMMIT);
  assert.equal(review.publicBaselineCommit, STABLE_PAGES_REPIN_PUBLIC_BASELINE_COMMIT);
  assert.equal(review.baselineTree, STABLE_PAGES_REPIN_BASELINE_TREE);
  assert.equal(review.previousAirfieldManifestSha256, '359b12e5e10204938f2180a9ebd17ced8a1015fe9413724262e28ba96355217a');
  assert.deepEqual(Object.keys(review.changes), [...STABLE_PAGES_REPIN_PATHS], 'Only the manifest and exact test wiring are reviewed');
  assert.equal(review.currentPublication.stableCommit, STABLE_PAGES_REPIN_PUBLIC_BASELINE_COMMIT);
  assert.equal(review.currentPublication.workflowRunId, 38236353768);
  assert.equal(review.currentPublication.artifactId, 11742248971);
  assert.equal(review.currentPublication.artifactSha256, '067e402c9999bcb80d0b9c30d92d9ce217982e06baab03596893a5c32d6c3f18');
  assert.equal(review.currentStableFileCount, 216);
  for (const row of Object.values(review.changes)) {
    assert.match(row.previousSha256, /^[a-f0-9]{64}$/);
    assert.match(row.currentSha256, /^[a-f0-9]{64}$/);
    assert.notEqual(row.previousSha256, row.currentSha256);
    assert.ok(row.scope && row.hunks.length);
    for (const hunk of row.hunks) {
      assert.ok(Number.isSafeInteger(hunk.beforeStart) && hunk.beforeStart >= 0);
      assert.ok(Number.isSafeInteger(hunk.afterStart) && hunk.afterStart >= 0);
      assert.ok(hunk.removedLines.every(line => typeof line === 'string'));
      assert.ok(hunk.insertedLines.every(line => typeof line === 'string'));
    }
  }
  return review;
}
export function stablePagesRepinReview() {
  return assertStablePagesRepinReviewBytes(readFileSync(STABLE_PAGES_REPIN_REVIEW_PATH, 'utf8'));
}
export function stablePagesRepinHash(path: string, incoming: unknown) {
  const review = stablePagesRepinReview();
  if (!Object.hasOwn(review.changes, path)) return incoming;
  const row = review.changes[path];
  assert.equal(incoming, row.previousSha256, path + ' exact pre-repin incoming identity');
  return row.currentSha256;
}
export function assertStablePagesRepinDependency(path: string, incoming: unknown, actual: string) {
  assert.equal(actual, stablePagesRepinHash(path, incoming), path + ' exact original or reviewed stable repin identity');
}
export function stablePagesRepinPathsWithin(inventory: Record<string, unknown>) {
  return STABLE_PAGES_REPIN_PATHS.filter(path => Object.hasOwn(inventory, path));
}
export function restoreStablePagesRepinBytes(path: string, current: string) {
  current = restoreMobileControlsBytes(path, current);
  const review = stablePagesRepinReview();
  if (!Object.hasOwn(review.changes, path)) return current;
  const row = review.changes[path];
  assert.equal(stablePagesRepinSha(current), row.currentSha256, path + ' exact current bytes before inverse');
  const lines = current.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  for (const hunk of [...row.hunks].reverse()) {
    assert.deepEqual(lines.slice(hunk.afterStart, hunk.afterStart + hunk.insertedLines.length), hunk.insertedLines, path + ' exact inserted bytes');
    lines.splice(hunk.afterStart, hunk.insertedLines.length, ...hunk.removedLines);
  }
  const original = lines.join('');
  assert.equal(stablePagesRepinSha(original), row.previousSha256, path + ' every historical byte reconstructed');
  return original;
}
export function stablePagesRepinAuditDependencies() {
  return [...STABLE_PAGES_REPIN_PATHS, STABLE_PAGES_REPIN_REVIEW_PATH,
    'tests/helpers/stable-pages-repin-reviewed-revisions.ts', 'tests/audit-stable-pages-repin-transition.test.ts',
    'docs/airfield-enrichment-qa-files.json'];
}
