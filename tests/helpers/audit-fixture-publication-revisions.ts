/** Exact technical-only revisions after the sealed Airfield art pass. No historical record is rewritten. */
import assert from 'node:assert/strict';

export const AUDIT_PUBLICATION_BASELINE_COMMIT = 'caff951ba864212e77e3ac2f2ff3f6fa3d79d83a';
export const AUDIT_PUBLICATION_REVISIONS = Object.freeze({
  'tests/fixtures/garden-enrichment-reviewed-changes.json': Object.freeze({
    previousSha256: '9849bf067b63fa83f22ad75dac63ff4a560c601c210d241676ad06cbd6307afa',
    currentSha256: '0bf147bda5bf2d63dbce87a5b5ad09e1dc24406c2d9fb39bc0c5573565a11813',
    scope: 'Whitespace-only JSON transport compaction with exact historical-byte reconstruction',
  }),
  'tests/helpers/garden-enrichment-reviewed-revisions.ts': Object.freeze({
    previousSha256: 'f993f2b2d84b30c95c2cf02b9b23e59eb677365bedf127cb1466875fad3f4035',
    currentSha256: 'f639192feed136fab5fd1d8267e92f385196e6987e5e488b5b444fae27d7b80a',
    scope: 'Validate exact compact transport bytes and reconstruct the independently pinned historical JSON bytes',
  }),
});
export const AUDIT_PUBLICATION_PATHS = Object.freeze(Object.keys(AUDIT_PUBLICATION_REVISIONS));

export function auditPublicationHash(path: string, incoming: unknown) {
  if (!Object.hasOwn(AUDIT_PUBLICATION_REVISIONS, path)) return incoming;
  const row = AUDIT_PUBLICATION_REVISIONS[path as keyof typeof AUDIT_PUBLICATION_REVISIONS];
  assert.equal(incoming, row.previousSha256, path + ' exact pre-publication revision required');
  return row.currentSha256;
}

export function auditPublicationPathsWithin(inventory: Record<string, unknown>) {
  return AUDIT_PUBLICATION_PATHS.filter(path => Object.hasOwn(inventory, path));
}
