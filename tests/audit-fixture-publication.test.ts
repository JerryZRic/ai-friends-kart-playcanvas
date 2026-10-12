import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { compactJsonLexemes, restoreIndentedJsonLexemes, assertGardenReviewCompactBytes, GARDEN_REVIEW_ORIGINAL_BYTES, GARDEN_REVIEW_ORIGINAL_SHA256, GARDEN_REVIEW_COMPACT_BYTES, GARDEN_REVIEW_COMPACT_SHA256 } from '../scripts/compact-garden-audit-fixture.mjs';
import { AUDIT_PUBLICATION_BASELINE_COMMIT, AUDIT_PUBLICATION_REVISIONS, AUDIT_PUBLICATION_PATHS, auditPublicationHash } from './helpers/audit-fixture-publication-revisions';
import { assertGardenReviewedBytes } from './helpers/garden-enrichment-reviewed-revisions';

const fixture = 'tests/fixtures/garden-enrichment-reviewed-changes.json';
const sha = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');

test('compact Garden evidence restores every original byte and every historical JSON value', () => {
  const compact = readFileSync(fixture, 'utf8'), original = assertGardenReviewCompactBytes(compact);
  assert.equal(Buffer.byteLength(compact), GARDEN_REVIEW_COMPACT_BYTES);
  assert.equal(sha(compact), GARDEN_REVIEW_COMPACT_SHA256);
  assert.equal(Buffer.byteLength(original), GARDEN_REVIEW_ORIGINAL_BYTES);
  assert.equal(sha(original), GARDEN_REVIEW_ORIGINAL_SHA256);
  assert.equal(compactJsonLexemes(original), compact, 'Deterministic complete round trip');
  assert.deepEqual(JSON.parse(compact), JSON.parse(original), 'No value or nested historical inventory changes');
  const reviewed = assertGardenReviewedBytes(compact);
  assert.equal(reviewed.certifiedIncomingAssertions.length, 108);
  assert.equal(Object.keys(reviewed.changes).length, 17);
  // JSON string encoding adds escapes; the actual blob-content request must also fit the transport ceiling.
  const envelope = JSON.stringify({ content: compact, encoding: 'utf-8' });
  assert.ok(Buffer.byteLength(envelope) < 16 * 1024 * 1024, 'Compact JSON plus JSON request escaping stays below 16 MiB');
});

test('lexical compaction preserves numeric spelling, escaped strings and empty containers', () => {
  const compact = '{"number":-1.144255927613863e-05,"fraction":1.0,"escaped":"a b\\n\\\"\\\\\\u2603","empty":[{},[]]}\n';
  assert.equal(compactJsonLexemes(restoreIndentedJsonLexemes(compact)), compact);
  assert.deepEqual(JSON.parse(compact), JSON.parse(restoreIndentedJsonLexemes(compact)));
  assert.throws(() => compactJsonLexemes('{"malformed":}'));
  assert.throws(() => restoreIndentedJsonLexemes('{"malformed":}'));
});

test('transport validation rejects changed values, extra whitespace and original-format fallback', () => {
  const compact = readFileSync(fixture, 'utf8');
  assert.throws(() => assertGardenReviewCompactBytes(compact + ' '));
  assert.throws(() => assertGardenReviewCompactBytes(compact.replace('certifiedIncomingAssertions', 'certifiedIncomingAssertionX')));
  assert.throws(() => assertGardenReviewCompactBytes(restoreIndentedJsonLexemes(compact)));
});

test('publication overlay enumerates exact reviewed inputs and rejects wrong incoming or current identities', () => {
  assert.equal(AUDIT_PUBLICATION_BASELINE_COMMIT, 'caff951ba864212e77e3ac2f2ff3f6fa3d79d83a');
  assert.deepEqual([...AUDIT_PUBLICATION_PATHS], [fixture,
    'tests/helpers/garden-enrichment-reviewed-revisions.ts',
    'tests/helpers/garden-enrichment-camera-records.ts',
    'tests/helpers/caldera-enrichment-contract.ts',
    'tests/helpers/caldera-enrichment-geometry-worker.ts',
    'tests/helpers/caldera-enrichment-source-stability.ts',
    'tests/helpers/garden-enrichment-contract.ts',
    'tests/helpers/garden-enrichment-geometry-worker.ts',
    'tests/helpers/garden-enrichment-source-stability.ts',
    'tests/helpers/garden-enrichment-native-provenance.ts',
  ]);
  for (const [path, row] of Object.entries(AUDIT_PUBLICATION_REVISIONS)) {
    assert.equal(sha(readFileSync(path)), row.currentSha256, path + ' exact reviewed output');
    assert.equal(auditPublicationHash(path, row.previousSha256), row.currentSha256);
    assert.throws(() => auditPublicationHash(path, '0'.repeat(64)), undefined, 'Wrong historical identity rejected');
    assert.throws(() => auditPublicationHash(path, row.currentSha256), undefined, 'No generic current-hash acceptance');
    assert.ok(row.scope);
  }
  assert.equal(auditPublicationHash('src/unlisted-publication-change.ts', 'unchanged'), 'unchanged');
  const incoming = JSON.parse(readFileSync('tests/fixtures/airfield-enrichment-original-inventory.json', 'utf8'));
  for (const [path, row] of Object.entries(AUDIT_PUBLICATION_REVISIONS)) assert.equal(incoming.sourceInventory[path], row.previousSha256);
});

test('Garden assertion helper differs only by exact compact-byte verification before unchanged historical checks', () => {
  const current = readFileSync('tests/helpers/garden-enrichment-reviewed-revisions.ts', 'utf8');
  const original = current
    .replace("import {assertGardenReviewCompactBytes} from '../../scripts/compact-garden-audit-fixture.mjs';\n", '')
    .replace('const original=assertGardenReviewCompactBytes(text);assert.equal(gardenSha(original),', 'assert.equal(gardenSha(text),');
  assert.equal(sha(original), AUDIT_PUBLICATION_REVISIONS['tests/helpers/garden-enrichment-reviewed-revisions.ts'].previousSha256, 'Every historical assertion is preserved');
});

test('current Airfield portable manifest includes the entire technical codec and validation closure', () => {
  const manifest = JSON.parse(readFileSync('docs/airfield-enrichment-qa-files.json', 'utf8'));
  assert.equal(manifest.publicationCompatibility.baselineCommit, AUDIT_PUBLICATION_BASELINE_COMMIT);
  assert.deepEqual(manifest.publicationCompatibility.reviewedInputRevisions, AUDIT_PUBLICATION_REVISIONS);
  assert.equal(manifest.publicationCompatibility.preCiCompatibilityCommit, '0ea002f4b8ced63560e7305712f3dfad2f9ae0a8');
  assert.equal(manifest.publicationCompatibility.preCiCompatibilityManifestSha256, 'd09e9371e181137f0be27b0a95528e44532395e75c5f2e82a4b46a6c0a6c7b46');
  for (const path of [fixture, 'tests/helpers/garden-enrichment-reviewed-revisions.ts', 'tests/helpers/garden-enrichment-camera-records.ts', 'tests/audit-camera-dependency-transition.test.ts', 'tests/helpers/audit-fixture-publication-revisions.ts', 'scripts/compact-garden-audit-fixture.mjs', 'tests/audit-fixture-publication.test.ts', 'docs/audit-fixture-publication.md', 'tests/helpers/geometry-runtime-portability.ts', 'tests/fixtures/geometry-runtime-portability.json', 'tests/audit-geometry-runtime-portability.test.ts']) {
    assert.equal(manifest.finalFileSha256[path], sha(readFileSync(path)), path + ' exact packaged dependency');
  }
});
