/** Exact additive music transition; all earlier proof records and stable publication stay frozen. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
export const MUSIC_BASELINE_COMMIT = 'fb6e372426def1fb83487ae31b96d057f6968a6f';
export const MUSIC_BASELINE_TREE = 'fe0fa8f502adac8143bd356e3e7dac5c061da1a0';
export const MUSIC_REVIEW_PATH = 'tests/helpers/music-transition.json';
export const MUSIC_REVIEW_SHA256 = '8d58514a2de87c63627e2b13f85d1c6cd75d717e73f8930b31c18b75d6225b22';
export const MUSIC_PRODUCTION_PATHS = Object.freeze(['src/game.ts', 'src/kart-garage.ts', 'src/menu.ts', 'src/race-shell.ts', 'src/waterpark-play.ts']);
export const MUSIC_BRIDGE_PATHS = Object.freeze(['tests/mountain-preview-assets.test.ts', 'tests/helpers/quarry-enrichment-camera-worker.ts', 'tests/helpers/town-enrichment-camera-worker.ts', 'tests/audit-input-mode-transition.test.ts', 'tests/audit-loading-guide-transition.test.ts', 'tests/audit-mobile-controls-transition.test.ts', 'tests/audit-touch-opacity-transition.test.ts', 'tests/audit-stable-pages-v050-repin-transition.test.ts', 'tests/audit-static-menu-art-transition.test.ts', 'tests/helpers/stable-pages-v050-repin-reviewed-revisions.ts', 'tests/helpers/static-menu-art-reviewed-revisions.ts']);
export const MUSIC_REGRESSION_PATHS = Object.freeze(['tests/free-mode-menu.test.ts', 'tests/free-mode-menu-dom.test.ts']);
export const MUSIC_DOCUMENTATION_PATHS = Object.freeze(['README.ja.md', 'README.ko.md', 'README.md', 'README.yue.md', 'README.zh-CN.md', 'README.zh-TW.md']);
export const MUSIC_BINARY_PATHS = Object.freeze(['public/menu-art/whale-maid.png']);
export const MUSIC_SOURCE_ADDITIONS = Object.freeze(['src/background-music.ts', 'src/music-ui.ts']);
export const MUSIC_ASSET_ADDITIONS = Object.freeze(['public/assets/music/LICENSE.txt', 'public/assets/music/dfy_fusion.mp3', 'public/assets/music/README.txt', 'public/assets/music/dfy_bgm.mp3', 'public/assets/music/dfy_theme.mp3']);
export const MUSIC_OTHER_ADDITIONS = Object.freeze(['docs/music.md', 'tests/background-music.test.ts', 'tests/music-integration.test.ts', 'tests/audit-music-transition.test.ts']);
type Hunk = {beforeStart: number; afterStart: number; removedLines: string[]; insertedLines: string[]};
type Revision = {previousSha256: string; currentSha256: string; scope: string; hunks: Hunk[]};
type BinaryRevision = {previousSha256: string; currentSha256: string; previousBytes: number; currentBytes: number; width: number; height: number; bitDepth: number; colorType: number; scope: string};
type Review = {schema: string; baselineCommit: string; baselineTree: string; baselineFileCount: number; changes: Record<string, Revision>; binaryChanges: Record<string, BinaryRevision>; additions: Record<string, {sha256: string; scope: string}>; protectedFiles: Record<string, string>};
export const musicSha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export function assertMusicReviewBytes(bytes: string): Review {
  assert.equal(musicSha(bytes), MUSIC_REVIEW_SHA256, 'Exact reviewed original music transition');
  const review = JSON.parse(bytes) as Review;
  assert.equal(review.schema, 'music-transition-v1');
  assert.equal(review.baselineCommit, MUSIC_BASELINE_COMMIT); assert.equal(review.baselineTree, MUSIC_BASELINE_TREE);
  assert.equal(review.baselineFileCount, 991);
  assert.deepEqual(Object.keys(review.changes), [...MUSIC_PRODUCTION_PATHS, ...MUSIC_BRIDGE_PATHS, ...MUSIC_REGRESSION_PATHS, ...MUSIC_DOCUMENTATION_PATHS]);
  assert.deepEqual(Object.keys(review.additions), [...MUSIC_SOURCE_ADDITIONS, ...MUSIC_ASSET_ADDITIONS, ...MUSIC_OTHER_ADDITIONS]);
  assert.deepEqual(Object.keys(review.binaryChanges), [...MUSIC_BINARY_PATHS]);
  for (const [path, row] of Object.entries(review.binaryChanges)) {
    assert.match(row.previousSha256, /^[a-f0-9]{64}$/); assert.match(row.currentSha256, /^[a-f0-9]{64}$/);
    assert.notEqual(row.previousSha256, row.currentSha256); assert.ok(row.scope, path);
    assert.equal(row.previousBytes, 1902226); assert.equal(row.currentBytes, 1883909);
    assert.equal(row.width, 1181); assert.equal(row.height, 1331); assert.equal(row.bitDepth, 8); assert.equal(row.colorType, 6);
    assert.ok(!Object.hasOwn(review.changes, path) && !Object.hasOwn(review.additions, path));
  }
  for (const [path, row] of Object.entries(review.changes)) {
    assert.match(row.previousSha256, /^[a-f0-9]{64}$/); assert.match(row.currentSha256, /^[a-f0-9]{64}$/);
    assert.notEqual(row.previousSha256, row.currentSha256); assert.ok(row.scope && row.hunks.length, path);
    let beforeEnd = 0, afterEnd = 0;
    for (const hunk of row.hunks) {
      assert.ok(Number.isSafeInteger(hunk.beforeStart) && hunk.beforeStart >= beforeEnd, path);
      assert.ok(Number.isSafeInteger(hunk.afterStart) && hunk.afterStart >= afterEnd, path);
      assert.ok(hunk.removedLines.every(line => typeof line === 'string'));
      assert.ok(hunk.insertedLines.every(line => typeof line === 'string'));
      assert.ok(hunk.removedLines.length || hunk.insertedLines.length);
      beforeEnd = hunk.beforeStart + hunk.removedLines.length; afterEnd = hunk.afterStart + hunk.insertedLines.length;
    }
  }
  for (const row of Object.values(review.additions)) { assert.match(row.sha256, /^[a-f0-9]{64}$/); assert.ok(row.scope); }
  assert.equal(Object.keys(review.protectedFiles).length + Object.keys(review.changes).length + Object.keys(review.binaryChanges).length, review.baselineFileCount);
  for (const [path, hash] of Object.entries(review.protectedFiles)) {
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.ok(!Object.hasOwn(review.changes, path) && !Object.hasOwn(review.binaryChanges, path) && !Object.hasOwn(review.additions, path), path);
  }
  return review;
}
export function musicReview() { return assertMusicReviewBytes(readFileSync(MUSIC_REVIEW_PATH, 'utf8')); }
export function musicHash(path: string, incoming: unknown) {
  const review = musicReview();
  if (!Object.hasOwn(review.changes, path) && !Object.hasOwn(review.binaryChanges, path)) return incoming;
  const row = review.changes[path] ?? review.binaryChanges[path];
  assert.equal(incoming, row.previousSha256, path + ' exact pre-music incoming identity');
  return row.currentSha256;
}
export function musicPathsWithin(inventory: Record<string, unknown>) { const review = musicReview(); return [...Object.keys(review.changes), ...Object.keys(review.binaryChanges)].filter(path => Object.hasOwn(inventory, path)); }
export function assertMusicAddition(path: string, bytes: string | Buffer) {
  const review = musicReview(); assert.ok(Object.hasOwn(review.additions, path), path + ' exact named music addition');
  assert.equal(musicSha(bytes), review.additions[path].sha256, path + ' exact music addition bytes');
}
export function musicSourcePaths(previous: string[]) {
  for (const path of MUSIC_SOURCE_ADDITIONS) { assert.ok(!previous.includes(path), path + ' must be new'); assertMusicAddition(path, readFileSync(path)); }
  return [...previous, ...MUSIC_SOURCE_ADDITIONS];
}
export function restoreMusicBytes(path: string, current: string) {
  const review = musicReview(); if (!Object.hasOwn(review.changes, path)) return current;
  const row = review.changes[path]; assert.equal(musicSha(current), row.currentSha256, path + ' exact reviewed bytes before music inverse');
  const lines = current.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  for (const hunk of [...row.hunks].reverse()) {
    assert.deepEqual(lines.slice(hunk.afterStart, hunk.afterStart + hunk.insertedLines.length), hunk.insertedLines, path + ' exact inserted music bytes');
    lines.splice(hunk.afterStart, hunk.insertedLines.length, ...hunk.removedLines);
  }
  const previous = lines.join(''); assert.equal(musicSha(previous), row.previousSha256, path + ' all pre-music bytes reconstructed'); return previous;
}
export function musicAddedPaths() { return [MUSIC_REVIEW_PATH, 'tests/helpers/music-reviewed-revisions.ts', ...Object.keys(musicReview().additions)]; }
export function musicAuditDependencies() { return [...musicAddedPaths(), ...Object.keys(musicReview().changes), ...Object.keys(musicReview().binaryChanges)]; }
