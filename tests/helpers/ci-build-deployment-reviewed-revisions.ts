import {qualityTierHash, qualityTierPathsWithin, restoreQualityTierBytes, qualityTierAddedPaths, qualityTierAuditDependencies} from './quality-tier-reviewed-revisions';
/** Exact CI build/deployment successor; no source, asset, legal or stable-publication drift. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const CI_BUILD_DEPLOYMENT_BASELINE_COMMIT = '10cbff39be7b5f1c7ffaaabec86719976314e9b6';
export const CI_BUILD_DEPLOYMENT_BASELINE_TREE = 'e0875d0a32b57aa7688e9b861d810f22d21a95b2';
export const CI_BUILD_DEPLOYMENT_REVIEW_PATH = 'tests/helpers/ci-build-deployment-transition.json';
export const CI_BUILD_DEPLOYMENT_REVIEW_SHA256 = '9b4cf938d877dec23387a78fd3bb4077d66f9528b0c1bdb1bf47cadb6de75c73';
export const CI_BUILD_DEPLOYMENT_PRODUCTION_PATHS = Object.freeze(['.github/workflows/pages.yml', 'scripts/compose-dev-pages.mjs']);
export const CI_BUILD_DEPLOYMENT_BRIDGE_PATHS = Object.freeze(['tests/helpers/music-reviewed-revisions.ts', 'tests/audit-music-transition.test.ts', 'tests/audit-stable-pages-v050-repin-transition.test.ts', 'tests/audit-static-menu-art-transition.test.ts']);
export const CI_BUILD_DEPLOYMENT_ADDITIONS = Object.freeze(['scripts/test-dev-preview.mjs', 'scripts/verified-build-artifact.mjs', 'tests/ci-build-artifact.test.mjs', 'tests/ci-stable-retry.test.mjs', 'tests/ci-workflow.test.mjs', 'tests/audit-ci-build-deployment-transition.test.ts']);
type Hunk = {beforeStart: number; afterStart: number; removedLines: string[]; insertedLines: string[]};
type Revision = {previousSha256: string; currentSha256: string; scope: string; hunks: Hunk[]};
type Review = {schema: string; baselineCommit: string; baselineTree: string; baselineFileCount: number; changes: Record<string, Revision>; additions: Record<string, {sha256: string; scope: string}>; protectedFiles: Record<string, string>};
export const ciBuildDeploymentSha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');

export function assertCiBuildDeploymentReviewBytes(bytes: string): Review {
  assert.equal(ciBuildDeploymentSha(bytes), CI_BUILD_DEPLOYMENT_REVIEW_SHA256, 'Exact reviewed CI split transition');
  const review = JSON.parse(bytes) as Review;
  assert.equal(review.schema, 'ci-build-deployment-transition-v1');
  assert.equal(review.baselineCommit, CI_BUILD_DEPLOYMENT_BASELINE_COMMIT);
  assert.equal(review.baselineTree, CI_BUILD_DEPLOYMENT_BASELINE_TREE);
  assert.equal(review.baselineFileCount, 1004);
  assert.deepEqual(Object.keys(review.changes), [...CI_BUILD_DEPLOYMENT_PRODUCTION_PATHS, ...CI_BUILD_DEPLOYMENT_BRIDGE_PATHS]);
  assert.deepEqual(Object.keys(review.additions), [...CI_BUILD_DEPLOYMENT_ADDITIONS]);
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
export function ciBuildDeploymentReview() { return assertCiBuildDeploymentReviewBytes(readFileSync(CI_BUILD_DEPLOYMENT_REVIEW_PATH, 'utf8')); }
export function ciBuildDeploymentHash(path: string, incoming: unknown) {
  const review = ciBuildDeploymentReview(); if (!Object.hasOwn(review.changes, path)) return qualityTierHash(path, incoming);
  const row = review.changes[path];
  assert.equal(incoming, row.previousSha256, path + ' exact pre-CI-split incoming identity');
  return qualityTierHash(path, row.currentSha256);
}
export function ciBuildDeploymentPathsWithin(inventory: Record<string, unknown>) { return [...new Set([...Object.keys(ciBuildDeploymentReview().changes).filter(path => Object.hasOwn(inventory, path)), ...qualityTierPathsWithin(inventory)])]; }
export function restoreCiBuildDeploymentBytes(path: string, current: string) {
  current = restoreQualityTierBytes(path, current);
  const review = ciBuildDeploymentReview(); if (!Object.hasOwn(review.changes, path)) return current;
  const row = review.changes[path]; assert.equal(ciBuildDeploymentSha(current), row.currentSha256, path + ' exact successor bytes before CI inverse');
  const lines = current.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  for (const hunk of [...row.hunks].reverse()) {
    assert.deepEqual(lines.slice(hunk.afterStart, hunk.afterStart + hunk.insertedLines.length), hunk.insertedLines, path + ' exact inserted CI bytes');
    lines.splice(hunk.afterStart, hunk.insertedLines.length, ...hunk.removedLines);
  }
  const previous = lines.join(''); assert.equal(ciBuildDeploymentSha(previous), row.previousSha256, path + ' every original pre-CI byte reconstructed'); return previous;
}
export function assertCiBuildDeploymentAddition(path: string, bytes: string | Buffer) {
  const review = ciBuildDeploymentReview(); assert.ok(Object.hasOwn(review.additions, path), path + ' exact named CI addition');
  assert.equal(ciBuildDeploymentSha(bytes), qualityTierHash(path, review.additions[path].sha256), path + ' exact CI addition bytes');
}
export function ciBuildDeploymentAddedPaths() { return [CI_BUILD_DEPLOYMENT_REVIEW_PATH, 'tests/helpers/ci-build-deployment-reviewed-revisions.ts', ...Object.keys(ciBuildDeploymentReview().additions), ...qualityTierAddedPaths()]; }
export function ciBuildDeploymentAuditDependencies() { return [...ciBuildDeploymentAddedPaths(), ...Object.keys(ciBuildDeploymentReview().changes), ...qualityTierAuditDependencies()]; }
