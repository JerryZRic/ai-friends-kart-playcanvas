import {stablePagesV100RepinHash, stablePagesV100RepinPathsWithin, restoreStablePagesV100RepinBytes, stablePagesV100RepinAddedPaths, stablePagesV100RepinAuditDependencies} from './stable-pages-v100-repin-reviewed-revisions';
/** Exact v1.0 successor. Historical fixtures and every prior proof remain frozen. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
export const V100_BASELINE_COMMIT = '6c73581de6623076a535830b03ffc8703f0facf5';
export const V100_BASELINE_TREE = '5f560bc4399b87f8274c7c9b410981f990b14e30';
export const V100_REVIEW_PATH = 'tests/helpers/v100-transition.json';
export const V100_REVIEW_SHA256 = '4aefb146e6329e73ad33debd71eb7c0a487c91e9e2e2f51cc9f02f5ce2bfe6c0';
type Hunk = {beforeStart: number; afterStart: number; removedLines: string[]; insertedLines: string[]};
type Revision = {previousSha256: string; currentSha256: string; scope: string; hunks: Hunk[]};
type Review = {schema: string; baselineCommit: string; baselineTree: string; baselineFileCount: number; approvedFeatureCommit: string; approvedFeatureTree: string; changes: Record<string, Revision>; additions: Record<string, {sha256: string; scope: string}>; protectedFiles: Record<string, string>};
export const v100Sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export function assertV100ReviewBytes(bytes: string): Review {
  assert.equal(v100Sha(bytes), V100_REVIEW_SHA256, 'Exact reviewed v1.0 transition');
  const review = JSON.parse(bytes) as Review;
  assert.equal(review.schema, 'v100-transition-v1');
  assert.equal(review.baselineCommit, V100_BASELINE_COMMIT);
  assert.equal(review.baselineTree, V100_BASELINE_TREE);
  assert.equal(review.baselineFileCount, 1019);
  assert.equal(review.approvedFeatureCommit, 'aef53e0165e8f44cd3b7bbf392e213a5769d2cf8');
  assert.equal(review.approvedFeatureTree, '44d840d2116500427e65330f20f77cfda205d46c');
  for (const [path, row] of Object.entries(review.changes)) {
    assert.ok(!path.startsWith('tests/fixtures/') && !path.startsWith('docs/scene-baselines/'));
    assert.ok(!path.endsWith('.json') || ['package.json', 'package-lock.json'].includes(path), path + ' prior proof and publication JSON stay frozen');
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
export function v100Review() { return assertV100ReviewBytes(readFileSync(V100_REVIEW_PATH, 'utf8')); }
export function v100Hash(path: string, incoming: unknown) {
  const row = v100Review().changes[path]; if (!row) return stablePagesV100RepinHash(path, incoming);
  assert.equal(incoming, row.previousSha256, path + ' exact pre-v1.0 incoming identity');
  return stablePagesV100RepinHash(path, row.currentSha256);
}
export function v100PathsWithin(inventory: Record<string, unknown>) { return [...new Set([...Object.keys(v100Review().changes).filter(path => Object.hasOwn(inventory, path)), ...stablePagesV100RepinPathsWithin(inventory)])]; }
export function restoreV100Bytes(path: string, current: string) {
  current = restoreStablePagesV100RepinBytes(path, current);
  const row = v100Review().changes[path]; if (!row) return current;
  assert.equal(v100Sha(current), row.currentSha256, path + ' exact candidate bytes before v1.0 inverse');
  const lines = current.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  for (const hunk of [...row.hunks].reverse()) {
    assert.deepEqual(lines.slice(hunk.afterStart, hunk.afterStart + hunk.insertedLines.length), hunk.insertedLines, path + ' exact inserted v1.0 bytes');
    lines.splice(hunk.afterStart, hunk.insertedLines.length, ...hunk.removedLines);
  }
  const previous = lines.join('');
  assert.equal(v100Sha(previous), row.previousSha256, path + ' every pre-v1.0 byte reconstructed'); return previous;
}
export function v100SourcePaths(previous: string[]) {
  const additions = Object.entries(v100Review().additions).filter(([path]) => path.startsWith('src/'));
  for (const [path, row] of additions) {
    assert.ok(!previous.includes(path), path + ' explicit v1.0 source addition');
    assert.equal(v100Sha(readFileSync(path)), row.sha256, path + ' exact source addition bytes');
  }
  return [...previous, ...additions.map(([path]) => path)];
}
export function v100AddedPaths() { return [V100_REVIEW_PATH, 'tests/helpers/v100-reviewed-revisions.ts', ...Object.keys(v100Review().additions), ...stablePagesV100RepinAddedPaths()]; }
export function v100AuditDependencies() { return [...v100AddedPaths(), ...Object.keys(v100Review().changes), ...stablePagesV100RepinAuditDependencies()]; }
