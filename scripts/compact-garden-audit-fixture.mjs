/** Lossless transport-only JSON compaction. Numeric/string lexemes are never rewritten. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GARDEN_REVIEW_ORIGINAL_BYTES = 16116032;
export const GARDEN_REVIEW_ORIGINAL_SHA256 = '9849bf067b63fa83f22ad75dac63ff4a560c601c210d241676ad06cbd6307afa';
export const GARDEN_REVIEW_COMPACT_BYTES = 11691007;
export const GARDEN_REVIEW_COMPACT_SHA256 = '0bf147bda5bf2d63dbce87a5b5ad09e1dc24406c2d9fb39bc0c5573565a11813';
const sha = text => createHash('sha256').update(text).digest('hex');

function tokens(text) {
  JSON.parse(text); // Reject malformed input before processing any token stream.
  return text.match(/"(?:\\.|[^"\\])*"|[{}\[\],:]|[^\s{}\[\],:]+/g);
}

export function compactJsonLexemes(text) {
  return tokens(text).join('') + '\n';
}

export function restoreIndentedJsonLexemes(text) {
  const parts = tokens(text), output = [];
  let depth = 0;
  for (let i = 0; i < parts.length; i++) {
    const token = parts[i];
    if (token === '{' || token === '[') {
      output.push(token);
      if (parts[i + 1] !== '}' && parts[i + 1] !== ']') output.push('\n', '  '.repeat(++depth));
    } else if (token === '}' || token === ']') {
      if (parts[i - 1] !== '{' && parts[i - 1] !== '[') output.push('\n', '  '.repeat(--depth));
      output.push(token);
    } else if (token === ',') output.push(',\n', '  '.repeat(depth));
    else if (token === ':') output.push(': ');
    else output.push(token);
  }
  return output.join('') + '\n';
}

export function assertGardenReviewCompactBytes(text) {
  assert.equal(Buffer.byteLength(text), GARDEN_REVIEW_COMPACT_BYTES, 'Exact compact fixture length');
  assert.equal(sha(text), GARDEN_REVIEW_COMPACT_SHA256, 'Independently pinned compact fixture bytes');
  const original = restoreIndentedJsonLexemes(text);
  assert.equal(Buffer.byteLength(original), GARDEN_REVIEW_ORIGINAL_BYTES, 'Exact historical fixture length');
  assert.equal(sha(original), GARDEN_REVIEW_ORIGINAL_SHA256, 'All historical fixture bytes reconstruct exactly');
  return original;
}

// Explicit offline reproduction: node scripts/compact-garden-audit-fixture.mjs ORIGINAL DESTINATION
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 4, 'Supply original JSON and compact destination paths');
  const original = readFileSync(process.argv[2], 'utf8');
  assert.equal(Buffer.byteLength(original), GARDEN_REVIEW_ORIGINAL_BYTES);
  assert.equal(sha(original), GARDEN_REVIEW_ORIGINAL_SHA256, 'Only the sealed reviewed original may be compacted');
  const compact = compactJsonLexemes(original);
  assert.equal(assertGardenReviewCompactBytes(compact), original, 'Exact byte-for-byte restoration');
  assert.deepEqual(JSON.parse(compact), JSON.parse(original), 'Every record and value remains unchanged');
  writeFileSync(process.argv[3], compact);
  console.log(JSON.stringify({ originalBytes: Buffer.byteLength(original), compactBytes: Buffer.byteLength(compact), originalSha256: sha(original), compactSha256: sha(compact), exactRestoration: true, semanticEquality: true }));
}
