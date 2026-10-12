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
  'tests/helpers/garden-enrichment-camera-records.ts': Object.freeze({
    previousSha256: '54ddb157a3dd55e090239d2a58ef6e1231b7ad4a7cef0db0967d4953e443125a',
    currentSha256: '04a10653a53243cefe397118cae2243a2ecd2a7693f66f6a82902a873d5f45ed',
    scope: 'One exact reviewed Airfield dependency transition; preserve historical Garden camera plan and all archive/output assertions',
  }),
  'tests/helpers/caldera-enrichment-contract.ts': Object.freeze({
    previousSha256: '4f4a54a739c793373111f524f52a791f94515b3bb5f3330eebe75094c5bd2029',
    currentSha256: 'bbd99b06c51ffc02a8ca85103bbbb43aca589dda55b28c987fd25b6ff6abfdb9',
    scope: 'Select independently certified unchanged-original geometry fingerprints without changing historical fixtures or tolerances',
  }),
  'tests/helpers/caldera-enrichment-geometry-worker.ts': Object.freeze({
    previousSha256: '8e76faf4d4f97e68cc5e3b3756032d67bc07f8fc36a507f47e04db3502cb7303',
    currentSha256: 'c9576d317eda013779d9c8d0bac2d1bb1b698c05ca97d40ddd8e231d69cd9210',
    scope: 'Certify unchanged-original runtime profile and retain complete candidate/original Float64 prefix equality including signed zero',
  }),
  'tests/helpers/caldera-enrichment-source-stability.ts': Object.freeze({
    previousSha256: 'a1022f89e5c300717061a875fc0f78b0d20e27c1ee08969c829f8c0e432fb603',
    currentSha256: '630b4591f79600cac795ffad14939fe6dc6b78d70f0e64e18cf7f5132e3caf73',
    scope: 'Extend before/after source stability to the exact runtime certificate and helper',
  }),
  'tests/helpers/garden-enrichment-contract.ts': Object.freeze({
    previousSha256: '214c289dea2dfaba70b6435b63a076e404b7ad79528a8b729a2f65a82827c114',
    currentSha256: 'c42d0131e8a9635d7af9e317c0801f227b76f36c78e1a8b55dc02022ffe50f9c',
    scope: 'Select independently certified unchanged-original geometry fingerprints without changing historical fixtures or tolerances',
  }),
  'tests/helpers/garden-enrichment-geometry-worker.ts': Object.freeze({
    previousSha256: 'cf233323d51afd90243f431b97b6dd63af8607449caf63e8fc6c7f4aa15b029c',
    currentSha256: 'aa743a54b2431149e9df250ce0e19a2f016bb81b0545c6ee92cdbd74ee86178b',
    scope: 'Certify unchanged-original runtime profile and retain complete candidate/original Float64 prefix equality including signed zero',
  }),
  'tests/helpers/garden-enrichment-source-stability.ts': Object.freeze({
    previousSha256: '57f4b3bc29b0d6b0152d442ab6a189ed90d6b3828901bff1f2e3141bf946fefa',
    currentSha256: 'c0aca866eca760487c37a1765acb8b9e7286900601693190116ea5dae7cc97db',
    scope: 'Extend before/after source stability to the exact runtime certificate and helper',
  }),
  'tests/helpers/garden-enrichment-native-provenance.ts': Object.freeze({
    previousSha256: '0f04e846fb4825487dfee28c1d7491e397fc9aba618dbded2fbf56c093f318f5',
    currentSha256: 'c25cf5e165edeef6aa60bf4cdc4f6c00bc5373a75be3425364e32c7c1d69a298',
    scope: 'Use independently certified Math.pow profile for original geometry hashes; retain all native ownership assertions',
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
