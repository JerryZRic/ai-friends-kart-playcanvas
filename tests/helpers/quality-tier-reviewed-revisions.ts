import {v100Hash, v100PathsWithin, restoreV100Bytes, v100AddedPaths, v100AuditDependencies} from './v100-reviewed-revisions';
/** Exact quality-tier policy successor; runtime, publication evidence and prior JSON stay frozen. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const QUALITY_TIER_BASELINE_COMMIT = '7eee4e5fc37058902bc280d3801bd264e742c83c';
export const QUALITY_TIER_BASELINE_TREE = '2f2e17e6cd906eeab5f10b9699933a2ad5a4663b';
export const QUALITY_TIER_REVIEW_PATH = 'tests/helpers/quality-tier-transition.json';
export const QUALITY_TIER_REVIEW_SHA256 = '68a3e880f4669d993388febd4ccd87cee732b09cacff4b871c531a7ccce89c2f';
export const QUALITY_TIER_PRODUCTION_PATHS = Object.freeze(['.github/workflows/pages-stable.yml']);
export const QUALITY_TIER_REGRESSION_PATHS = Object.freeze(['tests/ci-workflow.test.mjs', 'tests/stable-pages.test.mjs']);
export const QUALITY_TIER_BRIDGE_PATHS = Object.freeze(['tests/helpers/ci-build-deployment-reviewed-revisions.ts', 'tests/audit-ci-build-deployment-transition.test.ts', 'tests/audit-music-transition.test.ts', 'tests/audit-stable-pages-v050-repin-transition.test.ts', 'tests/audit-static-menu-art-transition.test.ts']);
export const QUALITY_TIER_ADDITIONS = Object.freeze(['.github/workflows/release-quality.yml', 'scripts/test-targeted.mjs', 'tests/quality-tier-policy.test.mjs', 'docs/quality-tiers.md', 'tests/audit-quality-tier-transition.test.ts']);
type Hunk = {beforeStart: number; afterStart: number; removedLines: string[]; insertedLines: string[]};
type Revision = {previousSha256: string; currentSha256: string; scope: string; hunks: Hunk[]};
type Review = {schema: string; baselineCommit: string; baselineTree: string; baselineFileCount: number; changes: Record<string, Revision>; additions: Record<string, {sha256: string; scope: string}>; protectedFiles: Record<string, string>};
export const qualityTierSha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');

export function assertQualityTierReviewBytes(bytes: string): Review {
  assert.equal(qualityTierSha(bytes), QUALITY_TIER_REVIEW_SHA256, 'Exact reviewed quality-tier transition');
  const review = JSON.parse(bytes) as Review;
  assert.equal(review.schema, 'quality-tier-transition-v1');
  assert.equal(review.baselineCommit, QUALITY_TIER_BASELINE_COMMIT);
  assert.equal(review.baselineTree, QUALITY_TIER_BASELINE_TREE);
  assert.equal(review.baselineFileCount, 1012);
  assert.deepEqual(Object.keys(review.changes), [...QUALITY_TIER_PRODUCTION_PATHS, ...QUALITY_TIER_REGRESSION_PATHS, ...QUALITY_TIER_BRIDGE_PATHS]);
  assert.deepEqual(Object.keys(review.additions), [...QUALITY_TIER_ADDITIONS]);
  for (const [path, row] of Object.entries(review.changes)) {
    assert.match(row.previousSha256, /^[a-f0-9]{64}$/); assert.match(row.currentSha256, /^[a-f0-9]{64}$/);
    assert.notEqual(row.previousSha256, row.currentSha256); assert.ok(row.scope && row.hunks.length, path);
    let beforeEnd = 0, afterEnd = 0, delta = 0;
    for (const hunk of row.hunks) {
      assert.ok(Number.isSafeInteger(hunk.beforeStart) && hunk.beforeStart >= beforeEnd, path + ' ordered baseline hunks');
      assert.ok(Number.isSafeInteger(hunk.afterStart) && hunk.afterStart >= afterEnd, path + ' ordered successor hunks');
      assert.equal(hunk.afterStart, hunk.beforeStart + delta, path + ' exact paired hunk offsets');
      assert.ok(hunk.removedLines.every(line => typeof line === 'string'));
      assert.ok(hunk.insertedLines.every(line => typeof line === 'string'));
      assert.ok(hunk.removedLines.length || hunk.insertedLines.length, path + ' nonempty bounded revision');
      beforeEnd = hunk.beforeStart + hunk.removedLines.length; afterEnd = hunk.afterStart + hunk.insertedLines.length;
      delta += hunk.insertedLines.length - hunk.removedLines.length;
    }
    assert.ok(!path.endsWith('.json'), path + ' no existing proof or manifest can change');
    assert.ok(!/^(?:src|public|models)\//.test(path), path + ' no game or asset changes');
  }
  for (const [path, row] of Object.entries(review.additions)) {
    assert.match(row.sha256, /^[a-f0-9]{64}$/); assert.ok(row.scope);
    assert.ok(!Object.hasOwn(review.changes, path) && !Object.hasOwn(review.protectedFiles, path));
  }
  assert.equal(Object.keys(review.protectedFiles).length + Object.keys(review.changes).length, review.baselineFileCount);
  for (const [path, hash] of Object.entries(review.protectedFiles)) {
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.ok(!Object.hasOwn(review.changes, path) && !Object.hasOwn(review.additions, path), path + ' immutable baseline file');
  }
  return review;
}
export function qualityTierReview() { return assertQualityTierReviewBytes(readFileSync(QUALITY_TIER_REVIEW_PATH, 'utf8')); }
export function qualityTierHash(path: string, incoming: unknown) {
  const review = qualityTierReview(); if (!Object.hasOwn(review.changes, path)) return v100Hash(path, incoming);
  const row = review.changes[path];
  assert.equal(incoming, row.previousSha256, path + ' exact pre-quality-tier incoming identity');
  return v100Hash(path, row.currentSha256);
}
export function qualityTierPathsWithin(inventory: Record<string, unknown>) { return [...new Set([...Object.keys(qualityTierReview().changes).filter(path => Object.hasOwn(inventory, path)), ...v100PathsWithin(inventory)])]; }
export function restoreQualityTierBytes(path: string, current: string) {
  current = restoreV100Bytes(path, current);
  const review = qualityTierReview(); if (!Object.hasOwn(review.changes, path)) return current;
  const row = review.changes[path]; assert.equal(qualityTierSha(current), row.currentSha256, path + ' exact successor bytes before quality-tier inverse');
  const lines = current.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  for (const hunk of [...row.hunks].reverse()) {
    assert.deepEqual(lines.slice(hunk.afterStart, hunk.afterStart + hunk.insertedLines.length), hunk.insertedLines, path + ' exact inserted quality-tier bytes');
    lines.splice(hunk.afterStart, hunk.insertedLines.length, ...hunk.removedLines);
  }
  const previous = lines.join(''); assert.equal(qualityTierSha(previous), row.previousSha256, path + ' every original pre-quality-tier byte reconstructed'); return previous;
}
export function assertQualityTierAddition(path: string, bytes: string | Buffer) {
  const review = qualityTierReview(); assert.ok(Object.hasOwn(review.additions, path), path + ' exact named quality-tier addition');
  assert.equal(qualityTierSha(bytes), v100Hash(path, review.additions[path].sha256), path + ' exact quality-tier addition bytes');
}
export function qualityTierAddedPaths() { return [QUALITY_TIER_REVIEW_PATH, 'tests/helpers/quality-tier-reviewed-revisions.ts', ...Object.keys(qualityTierReview().additions), ...v100AddedPaths()]; }
export function qualityTierAuditDependencies() { return [...qualityTierAddedPaths(), ...Object.keys(qualityTierReview().changes), ...v100AuditDependencies()]; }
