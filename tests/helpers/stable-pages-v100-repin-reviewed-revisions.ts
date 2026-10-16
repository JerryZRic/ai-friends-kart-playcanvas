import {postV100Hash,postV100PathsWithin,restorePostV100Bytes,postV100AddedPaths,postV100AuditDependencies} from './post-v100-current';
/** Exact post-v1.0 stable publication repin. Every runtime byte and historical proof stays frozen. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
export const STABLE_PAGES_V100_REPIN_BASELINE_COMMIT = 'b665343da013f5cfec0a0f45797adcd347f9607b';
export const STABLE_PAGES_V100_REPIN_BASELINE_TREE = '87f4c4ad2d15421146e3a01fc36ed1880f0e688d';
export const STABLE_PAGES_V100_REPIN_REVIEW_PATH = 'tests/helpers/stable-pages-v100-repin-transition.json';
export const STABLE_PAGES_V100_REPIN_REVIEW_SHA256 = 'd4141e48f3cfa8e2179cf82a7d5003014f405710b6beb51d88ac8c2ea16aa20a';
type Hunk = {beforeStart: number; afterStart: number; removedLines: string[]; insertedLines: string[]};
type Revision = {previousSha256: string; currentSha256: string; scope: string; hunks: Hunk[]};
type Review = {schema: string; baselineCommit: string; baselineTree: string; baselineFileCount: number; previousPublication: Record<string, unknown>; currentPublication: Record<string, unknown>; publicationEvidence: Record<string, unknown>; changes: Record<string, Revision>; additions: Record<string, {sha256: string; scope: string}>; protectedFiles: Record<string, string>};
export const stablePagesV100RepinSha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export function assertStablePagesV100RepinReviewBytes(bytes: string): Review {
  assert.equal(stablePagesV100RepinSha(bytes), STABLE_PAGES_V100_REPIN_REVIEW_SHA256, 'Exact reviewed v1.0 stable publication repin');
  const review = JSON.parse(bytes) as Review;
  assert.equal(review.schema, 'stable-pages-v100-repin-transition-v1');
  assert.equal(review.baselineCommit, STABLE_PAGES_V100_REPIN_BASELINE_COMMIT);
  assert.equal(review.baselineTree, STABLE_PAGES_V100_REPIN_BASELINE_TREE);
  assert.equal(review.baselineFileCount, 1048);
  assert.deepEqual(Object.keys(review.changes), [
    'docs/stable-pages-manifest.json',
    'tests/audit-ci-build-deployment-transition.test.ts',
    'tests/audit-music-transition.test.ts',
    'tests/audit-quality-tier-transition.test.ts',
    'tests/audit-stable-pages-v050-repin-transition.test.ts',
    'tests/audit-static-menu-art-transition.test.ts',
    'tests/audit-v100-transition.test.ts',
    'tests/helpers/v100-reviewed-revisions.ts',
  ]);
  assert.deepEqual(Object.keys(review.additions), ['tests/audit-stable-pages-v100-repin-transition.test.ts']);
  assert.equal(review.previousPublication.stableCommit, '16dd2d0540e300de6e85aa816e73ed94d4e796c0');
  assert.equal(review.currentPublication.stableCommit, STABLE_PAGES_V100_REPIN_BASELINE_COMMIT);
  assert.equal(review.currentPublication.workflowRunId, 38494111625);
  assert.equal(review.currentPublication.artifactId, 11863017796);
  assert.equal(review.currentPublication.artifactSha256, 'f02f23cd8a50d2203d6b45439736f58577047f7bdae240f8f955ade5a11f7f72');
  assert.equal(review.publicationEvidence.method, 'authenticated-main-artifact-metadata-certified-root-and-complete-live-http-byte-verification');
  assert.equal(review.publicationEvidence.liveRootFilesVerified, 219);
  assert.equal(review.publicationEvidence.liveRootMatchesCertifiedDist, true);
  assert.equal(review.publicationEvidence.fullArtifactArchiveDownloaded, false);
  assert.equal(review.publicationEvidence.buildJobId, 115625860087);
  assert.equal(review.publicationEvidence.deployJobId, 115626784235);
  assert.equal(review.publicationEvidence.artifactSize, 674857014);
  assert.equal(review.publicationEvidence.rootFileCount, 219);
  assert.equal(review.publicationEvidence.rootTotalBytes, 358859213);
  assert.equal(review.publicationEvidence.sourceZipSha256, 'cdc3541e728eb72c8655c7d7b36c9ce6ed6daf11febdca8e3ac3906de27b7153');
  assert.match(String(review.publicationEvidence.liveRootEvidenceSha256), /^[a-f0-9]{64}$/);

  for (const [path, row] of Object.entries(review.changes)) {
    assert.ok(!path.startsWith('tests/fixtures/') && !path.startsWith('docs/scene-baselines/'));
    assert.ok(path === 'docs/stable-pages-manifest.json' || (path.startsWith('tests/') && path.endsWith('.ts')), path + ' only publication manifest and bounded audit bridges');
    assert.match(row.previousSha256, /^[a-f0-9]{64}$/); assert.match(row.currentSha256, /^[a-f0-9]{64}$/);
    assert.notEqual(row.previousSha256, row.currentSha256); assert.ok(row.scope && row.hunks.length, path);
    let beforeEnd = 0, afterEnd = 0, delta = 0;
    for (const hunk of row.hunks) {
      assert.ok(Number.isSafeInteger(hunk.beforeStart) && hunk.beforeStart >= beforeEnd);
      assert.ok(Number.isSafeInteger(hunk.afterStart) && hunk.afterStart >= afterEnd);
      assert.equal(hunk.afterStart, hunk.beforeStart + delta);
      assert.ok(hunk.removedLines.every(line => typeof line === 'string'));
      assert.ok(hunk.insertedLines.every(line => typeof line === 'string'));
      assert.ok(hunk.removedLines.length || hunk.insertedLines.length);
      beforeEnd = hunk.beforeStart + hunk.removedLines.length; afterEnd = hunk.afterStart + hunk.insertedLines.length;
      delta += hunk.insertedLines.length - hunk.removedLines.length;
    }
  }
  for (const [path, row] of Object.entries(review.additions)) {
    assert.match(row.sha256, /^[a-f0-9]{64}$/); assert.ok(row.scope);
    assert.ok(!Object.hasOwn(review.changes, path) && !Object.hasOwn(review.protectedFiles, path));
  }
  assert.equal(Object.keys(review.protectedFiles).length + Object.keys(review.changes).length, review.baselineFileCount);
  for (const [path, hash] of Object.entries(review.protectedFiles)) {
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.ok(!Object.hasOwn(review.changes, path) && !Object.hasOwn(review.additions, path));
  }
  return review;
}
export function stablePagesV100RepinReview() { return assertStablePagesV100RepinReviewBytes(readFileSync(STABLE_PAGES_V100_REPIN_REVIEW_PATH, 'utf8')); }
export function stablePagesV100RepinHash(path: string, incoming: unknown) {
  const row = stablePagesV100RepinReview().changes[path]; if (!row) return postV100Hash(path,incoming);
  assert.equal(incoming, row.previousSha256, path + ' exact certified-v1.0 incoming identity');
  return postV100Hash(path,row.currentSha256);
}
export function stablePagesV100RepinPathsWithin(inventory: Record<string, unknown>) { return [...new Set([...Object.keys(stablePagesV100RepinReview().changes).filter(path => Object.hasOwn(inventory, path)),...postV100PathsWithin(inventory)])]; }
export function restoreStablePagesV100RepinBytes(path: string, current: string) {
  current=restorePostV100Bytes(path,current);
  const row = stablePagesV100RepinReview().changes[path]; if (!row) return current;
  assert.equal(stablePagesV100RepinSha(current), row.currentSha256, path + ' exact candidate bytes before stable-repin inverse');
  const lines = current.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  for (const hunk of [...row.hunks].reverse()) {
    assert.deepEqual(lines.slice(hunk.afterStart, hunk.afterStart + hunk.insertedLines.length), hunk.insertedLines, path + ' exact inserted stable-repin bytes');
    lines.splice(hunk.afterStart, hunk.insertedLines.length, ...hunk.removedLines);
  }
  const previous = lines.join('');
  assert.equal(stablePagesV100RepinSha(previous), row.previousSha256, path + ' every certified-v1.0 byte reconstructed'); return previous;
}
export function stablePagesV100RepinAddedPaths() { return [STABLE_PAGES_V100_REPIN_REVIEW_PATH, 'tests/helpers/stable-pages-v100-repin-reviewed-revisions.ts', ...Object.keys(stablePagesV100RepinReview().additions),...postV100AddedPaths()]; }
export function stablePagesV100RepinAuditDependencies() { return [...stablePagesV100RepinAddedPaths(), ...Object.keys(stablePagesV100RepinReview().changes),...postV100AuditDependencies()]; }

