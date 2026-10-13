import {musicHash, musicPathsWithin, restoreMusicBytes, musicAuditDependencies} from './music-reviewed-revisions';
/** Exact stable-publication repin after v0.5.0; runtime and every historical proof stay immutable. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const STABLE_PAGES_V050_REPIN_BASELINE_COMMIT = '16dd2d0540e300de6e85aa816e73ed94d4e796c0';
export const STABLE_PAGES_V050_REPIN_BASELINE_TREE = 'e015babf38607c3fcd0742dd8666c43a3c86f8bc';
export const STABLE_PAGES_V050_REPIN_REVIEW_PATH = 'tests/helpers/stable-pages-v050-repin-transition.json';
export const STABLE_PAGES_V050_REPIN_REVIEW_SHA256 = '955b9f8cd4361483caba7c994edc750ca0881745378b2f6146ebdfe240b3f6a6';
export const STABLE_PAGES_V050_REPIN_MANIFEST_PATH = 'docs/stable-pages-manifest.json';
export const STABLE_PAGES_V050_REPIN_BRIDGE_PATHS = Object.freeze([
  'tests/helpers/static-menu-art-reviewed-revisions.ts',
  'tests/audit-loading-guide-transition.test.ts',
  'tests/audit-mobile-controls-transition.test.ts',
  'tests/audit-touch-opacity-transition.test.ts',
  'tests/audit-input-mode-transition.test.ts',
  'tests/audit-static-menu-art-transition.test.ts',
  'tests/audit-stable-pages-repin-transition.test.ts',
]);
export const STABLE_PAGES_V050_REPIN_TEST_ADDITIONS = Object.freeze(['tests/audit-stable-pages-v050-repin-transition.test.ts']);
type Hunk = {beforeStart: number; afterStart: number; removedLines: string[]; insertedLines: string[]};
type Revision = {previousSha256: string; currentSha256: string; scope: string; hunks: Hunk[]};
type Publication = {schemaVersion: number; repository: string; stableCommit: string; workflowRunId: number; artifactId: number; artifactSha256: string; baseUrl: string};
type Review = {
  schema: string; baselineCommit: string; baselineTree: string; baselineFileCount: number;
  previousPublication: Publication; currentPublication: Publication;
  publicationEvidence: {method: string; fullArtifactArchiveDownloaded: boolean; buildJobId: number; deployJobId: number; artifactSize: number; archiveFileCount: number; tarFilesSha256: string; mainBuildLogSha256: string; mainDeployLogSha256: string; rootInventorySha256: string; sourceZipSha256: string};
  previousStableFileCount: number; currentStableFileCount: number;
  previousStableTotalBytes: number; currentStableTotalBytes: number;
  changes: Record<string, Revision>; additions: Record<string, {sha256: string; scope: string}>;
  protectedFiles: Record<string, string>;
};
export const stablePagesV050RepinSha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export function assertStablePagesV050RepinReviewBytes(bytes: string): Review {
  assert.equal(stablePagesV050RepinSha(bytes), STABLE_PAGES_V050_REPIN_REVIEW_SHA256, 'Exact reviewed v0.5.0 stable publication transition');
  const review = JSON.parse(bytes) as Review;
  assert.equal(review.schema, 'stable-pages-v050-repin-transition-v1');
  assert.equal(review.baselineCommit, STABLE_PAGES_V050_REPIN_BASELINE_COMMIT);
  assert.equal(review.baselineTree, STABLE_PAGES_V050_REPIN_BASELINE_TREE);
  assert.equal(review.baselineFileCount, 988);
  assert.deepEqual(Object.keys(review.changes), [STABLE_PAGES_V050_REPIN_MANIFEST_PATH, ...STABLE_PAGES_V050_REPIN_BRIDGE_PATHS]);
  assert.deepEqual(Object.keys(review.additions), [...STABLE_PAGES_V050_REPIN_TEST_ADDITIONS]);
  assert.equal(review.previousPublication.stableCommit, '6844110cb77bb5b71041786f1802217766a8f759');
  assert.equal(review.currentPublication.stableCommit, STABLE_PAGES_V050_REPIN_BASELINE_COMMIT);
  assert.equal(review.currentPublication.workflowRunId, 38415797273);
  assert.equal(review.currentPublication.artifactId, 11828367988);
  assert.equal(review.currentPublication.artifactSha256, '2676a53f4e55e5398f08469c0305d65613b8918bef38bed674a951a5c3619fca');
  assert.equal(review.publicationEvidence.method, 'authenticated-artifact-metadata-ci-inventory-and-independent-reproducible-root');
  assert.equal(review.publicationEvidence.fullArtifactArchiveDownloaded, false);
  assert.equal(review.publicationEvidence.buildJobId, 115359756753);
  assert.equal(review.publicationEvidence.deployJobId, 115392825127);
  assert.equal(review.publicationEvidence.artifactSize, 615946440);
  assert.equal(review.publicationEvidence.archiveFileCount, 438);
  for (const key of ['tarFilesSha256', 'mainBuildLogSha256', 'mainDeployLogSha256', 'rootInventorySha256', 'sourceZipSha256'] as const) assert.match(review.publicationEvidence[key], /^[a-f0-9]{64}$/);
  assert.equal(review.previousStableFileCount, 216);
  assert.equal(review.previousStableTotalBytes, 322349659);
  assert.equal(review.currentStableFileCount, 219);
  assert.equal(review.currentStableTotalBytes, 328819057);
  for (const publication of [review.previousPublication, review.currentPublication]) {
    assert.equal(publication.schemaVersion, 1);
    assert.equal(publication.repository, 'JerryZRic/ai-friends-kart-playcanvas');
    assert.equal(publication.baseUrl, 'https://jerryzric.github.io/ai-friends-kart-playcanvas/');
    assert.ok(Number.isSafeInteger(publication.artifactId) && publication.artifactId > 0);
    assert.match(publication.artifactSha256, /^[a-f0-9]{64}$/);
  }
  for (const [path, row] of Object.entries(review.changes)) {
    assert.match(row.previousSha256, /^[a-f0-9]{64}$/); assert.match(row.currentSha256, /^[a-f0-9]{64}$/);
    assert.notEqual(row.previousSha256, row.currentSha256); assert.ok(row.scope && row.hunks.length, path);
    let beforeEnd = 0, afterEnd = 0;
    for (const hunk of row.hunks) {
      assert.ok(Number.isSafeInteger(hunk.beforeStart) && hunk.beforeStart >= beforeEnd, path + ' ordered baseline hunks');
      assert.ok(Number.isSafeInteger(hunk.afterStart) && hunk.afterStart >= afterEnd, path + ' ordered current hunks');
      assert.ok(hunk.removedLines.every(line => typeof line === 'string'));
      assert.ok(hunk.insertedLines.every(line => typeof line === 'string'));
      assert.ok(hunk.removedLines.length || hunk.insertedLines.length, path + ' nonempty exact change');
      beforeEnd = hunk.beforeStart + hunk.removedLines.length; afterEnd = hunk.afterStart + hunk.insertedLines.length;
    }
  }
  assert.equal(review.changes[STABLE_PAGES_V050_REPIN_MANIFEST_PATH].previousSha256, '5387aa54b2f677be0e912ff83e0e5237954d967b837e82f02ad7c172fa711add');
  for (const row of Object.values(review.additions)) { assert.match(row.sha256, /^[a-f0-9]{64}$/); assert.ok(row.scope); }
  assert.equal(Object.keys(review.protectedFiles).length + Object.keys(review.changes).length, review.baselineFileCount);
  for (const [path, hash] of Object.entries(review.protectedFiles)) {
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.ok(!Object.hasOwn(review.changes, path) && !Object.hasOwn(review.additions, path), path + ' protected baseline file cannot be repinned');
  }
  return review;
}
export function stablePagesV050RepinReview() { return assertStablePagesV050RepinReviewBytes(readFileSync(STABLE_PAGES_V050_REPIN_REVIEW_PATH, 'utf8')); }
export function stablePagesV050RepinHash(path: string, incoming: unknown) {
  const review = stablePagesV050RepinReview();
  if (!Object.hasOwn(review.changes, path)) return musicHash(path, incoming);
  const row = review.changes[path];
  assert.equal(incoming, row.previousSha256, path + ' exact pre-v0.5.0-repin incoming identity');
  return musicHash(path, row.currentSha256);
}
export function stablePagesV050RepinPathsWithin(inventory: Record<string, unknown>) {
  return [...new Set([...Object.keys(stablePagesV050RepinReview().changes).filter(path => Object.hasOwn(inventory, path)), ...musicPathsWithin(inventory)])];
}
export function restoreStablePagesV050RepinBytes(path: string, current: string) {
  current = restoreMusicBytes(path, current);
  const review = stablePagesV050RepinReview();
  if (!Object.hasOwn(review.changes, path)) return current;
  const row = review.changes[path];
  assert.equal(stablePagesV050RepinSha(current), row.currentSha256, path + ' exact reviewed bytes before v0.5.0 repin inverse');
  const lines = current.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  for (const hunk of [...row.hunks].reverse()) {
    assert.deepEqual(lines.slice(hunk.afterStart, hunk.afterStart + hunk.insertedLines.length), hunk.insertedLines, path + ' exact inserted v0.5.0 repin bytes');
    lines.splice(hunk.afterStart, hunk.insertedLines.length, ...hunk.removedLines);
  }
  const original = lines.join('');
  assert.equal(stablePagesV050RepinSha(original), row.previousSha256, path + ' every original pre-repin byte reconstructed');
  return original;
}
export function stablePagesV050RepinAuditDependencies() {
  const review = stablePagesV050RepinReview();
  return [STABLE_PAGES_V050_REPIN_REVIEW_PATH, 'tests/helpers/stable-pages-v050-repin-reviewed-revisions.ts',
    ...Object.keys(review.changes), ...Object.keys(review.additions), ...musicAuditDependencies()];
}
