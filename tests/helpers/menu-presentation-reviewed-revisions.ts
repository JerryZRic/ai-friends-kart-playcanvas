import {stablePagesRepinHash, stablePagesRepinPathsWithin, stablePagesRepinAuditDependencies} from './stable-pages-repin-reviewed-revisions';
/** Exact presentation/publication overlay. Historical source and geometry goldens stay untouched. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const MENU_PRESENTATION_BASELINE_COMMIT = 'c6ac26335aa2fa93cec0b1a96a4ca7bea6ae5840';
export const MENU_PRESENTATION_PUBLIC_BASELINE_COMMIT = 'eb2a0b3aae43c06664b84a7f8d209c44ec71e99a';
export const MENU_PRESENTATION_REVIEW_PATH = 'tests/helpers/menu-presentation-transition.json';
export const MENU_PRESENTATION_REVIEW_SHA256 = '65a635b8628717ef43f89779b8799fea5c874c1ee6d106ef273a5aa0a7352283';
type Hunk = {beforeStart: number; afterStart: number; removedLines: string[]; insertedLines: string[]};
type Revision = {previousSha256: string; currentSha256: string; scope: string; hunks: Hunk[]};
type Review = {schema: string; baselineCommit: string; publicBaselineCommit: string; changes: Record<string, Revision>; additions: Record<string, {sha256: string; scope: string}>};
export const menuPresentationSha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export function assertMenuPresentationReviewBytes(bytes: string): Review {
  assert.equal(menuPresentationSha(bytes), MENU_PRESENTATION_REVIEW_SHA256, 'Exact independently reviewed presentation transition');
  const review = JSON.parse(bytes) as Review;
  assert.equal(review.schema, 'menu-presentation-transition-v1');
  assert.equal(review.baselineCommit, MENU_PRESENTATION_BASELINE_COMMIT);
  assert.equal(review.publicBaselineCommit, MENU_PRESENTATION_PUBLIC_BASELINE_COMMIT);
  assert.deepEqual(Object.keys(review.changes).filter(path => path.startsWith('src/')), ['src/menu.ts'], 'Only the menu consumer changes existing production bytes');
  assert.deepEqual(Object.keys(review.additions), ['src/map-presentation.ts'], 'One separately pinned pure presentation module');
  for (const row of Object.values(review.changes)) {
    assert.match(row.previousSha256, /^[a-f0-9]{64}$/);
    assert.match(row.currentSha256, /^[a-f0-9]{64}$/);
    assert.notEqual(row.previousSha256, row.currentSha256);
    assert.ok(row.scope && row.hunks.length);
  }
  return review;
}
export function menuPresentationReview() {
  return assertMenuPresentationReviewBytes(readFileSync(MENU_PRESENTATION_REVIEW_PATH, 'utf8'));
}
export function menuPresentationHash(path: string, incoming: unknown) {
  const review = menuPresentationReview();
  if (!Object.hasOwn(review.changes, path)) return stablePagesRepinHash(path, incoming);
  const row = review.changes[path];
  assert.equal(incoming, row.previousSha256, path + ' exact pre-presentation incoming identity');
  return stablePagesRepinHash(path, row.currentSha256);
}
export function assertMenuPresentationDependency(path: string, incoming: unknown, actual: string) {
  assert.equal(actual, menuPresentationHash(path, incoming), path + ' exact original or reviewed presentation identity');
}
export function menuPresentationPathsWithin(inventory: Record<string, unknown>) {
  return [...new Set([...Object.keys(menuPresentationReview().changes).filter(path => Object.hasOwn(inventory, path)), ...stablePagesRepinPathsWithin(inventory)])];
}
export function menuPresentationSourcePaths(inventory: Record<string, unknown>) {
  const additions = menuPresentationReview().additions;
  for (const [path, row] of Object.entries(additions)) {
    assert.ok(!Object.hasOwn(inventory, path), path + ' must be an explicit addition');
    assert.equal(menuPresentationSha(readFileSync(path)), row.sha256, path + ' exact presentation-only source');
  }
  return [...Object.keys(inventory).filter(path => path.startsWith('src/')), ...Object.keys(additions)];
}
export function restoreMenuPresentationBytes(path: string, current: string) {
  const review = menuPresentationReview();
  if (!Object.hasOwn(review.changes, path)) return current;
  const row = review.changes[path];
  assert.equal(menuPresentationSha(current), row.currentSha256, path + ' exact approved current bytes before inverse');
  const lines = current.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  for (const hunk of [...row.hunks].reverse()) {
    assert.deepEqual(lines.slice(hunk.afterStart, hunk.afterStart + hunk.insertedLines.length), hunk.insertedLines, path + ' exact approved inserted bytes');
    lines.splice(hunk.afterStart, hunk.insertedLines.length, ...hunk.removedLines);
  }
  const original = lines.join('');
  assert.equal(menuPresentationSha(original), row.previousSha256, path + ' every historical byte reconstructed');
  return original;
}
export function menuPresentationAuditDependencies() {
  return [MENU_PRESENTATION_REVIEW_PATH, 'tests/helpers/menu-presentation-reviewed-revisions.ts', 'tests/audit-menu-presentation-transition.test.ts', 'tests/map-presentation.test.ts', ...Object.keys(menuPresentationReview().additions), ...stablePagesRepinAuditDependencies()];
}
