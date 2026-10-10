import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadFoodKartPayload, clearFoodKartPayloadCache, foodKartPayloadCacheStats, loadFoodKartManifest } from '../src/food-kart-payload.ts';
import { verifyFoodKartAssets, reconstructFoodKartPart } from '../scripts/verify-food-kart-assets.mjs';
const manifest = JSON.parse(readFileSync('public/models/food-karts/manifest.json', 'utf8'));
const first = manifest.parts.find((p: any) => p.available), firstKit = manifest.kits.find((k: any) => k.id === first.kitId);
const hash = (bytes: ArrayBuffer | Uint8Array) => createHash('sha256').update(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes).digest('hex');
type RequestHandler = (path: string, data: Buffer, options: RequestInit, count: number) => Response | Promise<Response>;
function mockFetch(handler?: RequestHandler) {
  clearFoodKartPayloadCache();
  const requests: string[] = [], previous = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    const path = new URL(String(input)).pathname.replace(/^\//, ''); requests.push(path);
    const data = readFileSync(`public/${path}`);
    return handler ? handler(path, data, options, requests.length) : new Response(new Uint8Array(data), { headers: { 'content-length': String(data.length) } });
  };
  return { requests, restore() { globalThis.fetch = previous; clearFoodKartPayloadCache(); } };
}
const response = (data: Uint8Array) => new Response(new Uint8Array(data), { headers: { 'content-length': String(data.length) } });
function quickTimers() {
  const original = globalThis.setTimeout;
  globalThis.setTimeout = ((callback: (...args: any[]) => void, delay: number, ...args: any[]) => original(callback, Math.min(delay, 5), ...args)) as typeof setTimeout;
  return () => { globalThis.setTimeout = original; };
}
function modifiedBundle(change: (data: Buffer, changed: any) => void) {
  const changed = structuredClone(manifest), bytes = Buffer.from(readFileSync(`public/${firstKit.bundlePath}`));
  change(bytes, changed);
  const kit = changed.kits.find((k: any) => k.id === first.kitId); kit.bundleSha256 = hash(bytes);
  return mockFetch((path, data) => response(path.endsWith('manifest.json') ? Buffer.from(JSON.stringify(changed)) : path === kit.bundlePath ? bytes : data));
}
test('all324 theme-bundled payloads reconstruct canonical GLBs and unchanged roots/anchors', () => {
  const result = verifyFoodKartAssets();
  assert.equal(result.verifiedParts, 324); assert.equal(result.expectedParts, 324); assert.equal(result.allComplete, true);
  assert.ok(result.deliveryBytes < result.originalBytes / 2);
  assert.equal(result.deliveryBytes, manifest.kits.reduce((n: number, kit: any) => n + kit.bundleBytes, 0));
});
test('selected-theme bundle uses actual progress and all six modules reuse one verified24MiB cache', async () => {
  const mock = mockFetch();
  try {
    const progress: any[] = [], bytes = await loadFoodKartPayload(first.id, { onProgress: p => progress.push(p) });
    assert.equal(hash(bytes), first.originalSha256); assert.equal(bytes.byteLength, first.decodedBytes);
    assert.equal(progress.at(-1).stage, 'ready'); assert.equal(progress.at(-1).receivedBytes, firstKit.bundleBytes); assert.equal(progress.at(-1).totalBytes, firstKit.bundleBytes);
    assert.deepEqual(mock.requests, ['models/food-karts/manifest.json', firstKit.bundlePath]);
    for (const id of firstKit.partIds) {
      const cached: any[] = [], part = manifest.parts.find((p: any) => p.id === id);
      assert.equal(hash(await loadFoodKartPayload(id, { onProgress: p => cached.push(p) })), part.originalSha256);
      assert.equal(cached.at(-1).receivedBytes, 0); assert.equal(cached.at(-1).totalBytes, 0); assert.equal(cached.at(-1).cachedBytes, firstKit.bundleBytes);
    }
    assert.equal(mock.requests.length, 2);
    assert.deepEqual(foodKartPayloadCacheStats(), { bytes: firstKit.bundleBytes, bundles: 1, limitBytes: 24 * 1024 * 1024 });
  } finally { mock.restore(); }
});
test('full bundle integrity failure is never retried, cached or passed to the renderer', async () => {
  const mock = mockFetch((path, data) => { if (path.endsWith('.zip')) { data = Buffer.from(data); data[100] ^= 1; } return response(data); });
  try { await assert.rejects(loadFoodKartPayload(first.id), /bundle checksum mismatch/); assert.equal(mock.requests.filter(path => path.endsWith('.zip')).length, 1); assert.equal(foodKartPayloadCacheStats().bytes, 0); }
  finally { mock.restore(); }
});
test('aborted payload does not issue a network request', async () => {
  const mock = mockFetch(), controller = new AbortController(); controller.abort();
  try { await assert.rejects(loadFoodKartPayload(first.id, { signal: controller.signal }), { name: 'AbortError' }); assert.equal(mock.requests.length, 0); }
  finally { mock.restore(); }
});
test('manifest forbids external logical paths, bundle URLs and cross-kit identities', async () => {
  for (const mutate of [
    (bad: any) => { bad.parts[0].path = 'https://example.invalid/attack.glb'; },
    (bad: any) => { bad.kits[0].bundlePath = 'https://example.invalid/theme.zip'; },
    (bad: any) => { bad.kits[0].partIds[0] = bad.kits[1].partIds[0]; },
  ]) {
    const mock = mockFetch((path, data) => { if (path.endsWith('manifest.json')) { const bad = JSON.parse(data.toString()); mutate(bad); data = Buffer.from(JSON.stringify(bad)); } return response(data); });
    try { await assert.rejects(loadFoodKartManifest(), /Invalid food kart/); assert.equal(mock.requests.length, 1); }
    finally { mock.restore(); }
  }
});
test('all324 restored modules pass the strict validator used before PlayCanvas import', async () => {
  const { validateGLB } = await import('../src/asset-validation.ts');
  for (const part of manifest.parts) {
    const data = reconstructFoodKartPart(manifest, part);
    assert.equal(hash(data), part.originalSha256, part.id);
    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    assert.doesNotThrow(() => validateGLB(buffer), part.id);
  }
  assert.equal(manifest.parts.length, 324);
});
test('browser-decoded transport encoding preserves exact ZIP bytes and unknown manifest total', async () => {
  const mock = mockFetch((_path, data) => new Response(new Uint8Array(data), { headers: { 'content-encoding': 'gzip' } }));
  try {
    const states: any[] = [], data = await loadFoodKartPayload(first.id, { onProgress: p => states.push(p) });
    assert.equal(hash(data), first.originalSha256);
    assert.ok(states.some(p => p.stage === 'manifest' && p.totalBytes === null));
    assert.equal(states.at(-1).receivedBytes, firstKit.bundleBytes); assert.equal(states.at(-1).totalBytes, firstKit.bundleBytes);
  } finally { mock.restore(); }
});
test('a corrupted inner texture fails even when the outer ZIP hash was recomputed', async () => {
  const image = first.images[0], mock = modifiedBundle(bytes => {
    const original = reconstructFoodKartPart(manifest, first).subarray(image.byteOffset, image.byteOffset + image.bytes), offset = bytes.indexOf(original);
    assert.ok(offset >= 0); bytes[offset + image.bytes - 1] ^= 1;
  });
  try { await assert.rejects(loadFoodKartPayload(first.id), /texture checksum mismatch/); }
  finally { mock.restore(); }
});
test('a corrupted inner gzip pack fails even when the outer ZIP hash was recomputed', async () => {
  const mock = modifiedBundle(bytes => {
    const name = Buffer.from(first.path), header = bytes.indexOf(name) - 30, start = header + 30 + name.length;
    assert.equal(bytes.readUInt32LE(header), 0x04034b50); bytes[start + 20] ^= 1;
  });
  try { await assert.rejects(loadFoodKartPayload(first.id), /payload checksum mismatch/); }
  finally { mock.restore(); }
});
test('unexpected or missing ZIP entries fail before reconstruction even with a matching outer hash', async () => {
  const mock = modifiedBundle(bytes => {
    const original = Buffer.from(first.path), altered = Buffer.from(first.path.replace('parts/', 'other/'));
    for (let offset = bytes.indexOf(original); offset >= 0; offset = bytes.indexOf(original, offset + altered.length)) altered.copy(bytes, offset);
  });
  try { await assert.rejects(loadFoodKartPayload(first.id), /bundle entries/); assert.equal(foodKartPayloadCacheStats().bytes, 0); }
  finally { mock.restore(); }
});
test('permanent missing bundle and oversized body are not retried or cached', async () => {
  for (const mode of ['missing', 'oversized']) {
    const mock = mockFetch((path, data) => path.endsWith('.zip') ? mode === 'missing' ? new Response('', { status: 404 }) : response(new Uint8Array(firstKit.bundleBytes + 1)) : response(data));
    try { await assert.rejects(loadFoodKartPayload(first.id), mode === 'missing' ? /HTTP 404/ : /exceeds declared size/); assert.equal(mock.requests.length, 2); assert.equal(foodKartPayloadCacheStats().bytes, 0); }
    finally { mock.restore(); }
  }
});
test('partial transfer retry preserves measured bytes and successful canonical reconstruction', async () => {
  let attempts = 0; const restoreTimers = quickTimers(), states: any[] = [];
  const mock = mockFetch((path, data) => {
    if (path.endsWith('.zip') && ++attempts === 1) {
      let reads = 0;
      return new Response(new ReadableStream({ pull(controller) { if (reads++ === 0) controller.enqueue(new Uint8Array(data.subarray(0, 1024))); else controller.error(new TypeError('Network interrupted')); } }), { headers: { 'content-length': String(data.length) } });
    }
    return response(data);
  });
  try {
    assert.equal(hash(await loadFoodKartPayload(first.id, { onProgress: p => states.push(p) })), first.originalSha256);
    assert.equal(attempts, 2); assert.ok(states.some(p => p.stage === 'retry' && p.retryInMs > 0));
    assert.equal(states.at(-1).receivedBytes, firstKit.bundleBytes + 1024); assert.equal(states.at(-1).totalBytes, firstKit.bundleBytes + 1024);
    const downloads = states.filter(p => p.stage !== 'manifest'); assert.ok(downloads.every((p, i) => i === 0 || p.receivedBytes >= downloads[i - 1].receivedBytes));
  } finally { mock.restore(); restoreTimers(); }
});
test('stalled theme downloads time out with four bounded retries and never poison cache', async () => {
  const restoreTimers = quickTimers(), signals: AbortSignal[] = [];
  const mock = mockFetch((path, data, options) => {
    if (!path.endsWith('.zip')) return response(data);
    signals.push(options.signal!); return new Promise<Response>(() => {});
  });
  try { await assert.rejects(loadFoodKartPayload(first.id), /超时/); assert.equal(signals.length, 4); assert.ok(signals.every(signal => signal.aborted)); assert.equal(foodKartPayloadCacheStats().bytes, 0); }
  finally { mock.restore(); restoreTimers(); }
});
test('concurrent modules share one manifest and ZIP; aborting one consumer keeps the other alive', async () => {
  const one = new AbortController(), two = new AbortController(); let release: () => void, ready: () => void;
  const blocked = new Promise<void>(resolve => { ready = resolve; }), resumed = new Promise<void>(resolve => { release = resolve; });
  const mock = mockFetch(async (path, data, options) => { if (path.endsWith('.zip')) { ready(); await resumed; assert.equal(options.signal?.aborted, false); } return response(data); });
  try {
    const p1 = loadFoodKartPayload(firstKit.partIds[0], { signal: one.signal }), p2 = loadFoodKartPayload(firstKit.partIds[1], { signal: two.signal });
    await blocked; one.abort(); const rejected = assert.rejects(p1, { name: 'AbortError' }); release();
    await rejected; assert.equal(hash(await p2), manifest.parts.find((p: any) => p.id === firstKit.partIds[1]).originalSha256);
    assert.deepEqual(mock.requests, ['models/food-karts/manifest.json', firstKit.bundlePath]);
  } finally { mock.restore(); }
});
test('aborting every consumer cancels transport; a fresh request restarts without stale progress', async () => {
  const controller = new AbortController(); let signal: AbortSignal, release: () => void, ready: () => void, zipCalls = 0;
  const blocked = new Promise<void>(resolve => { ready = resolve; }), resumed = new Promise<void>(resolve => { release = resolve; });
  const mock = mockFetch(async (path, data, options) => { if (path.endsWith('.zip') && ++zipCalls === 1) { signal = options.signal!; ready(); await resumed; } return response(data); });
  const stale: any[] = [];
  try {
    const pending = loadFoodKartPayload(first.id, { signal: controller.signal, onProgress: p => stale.push(p) });
    await blocked; controller.abort(); await assert.rejects(pending, { name: 'AbortError' }); assert.equal(signal.aborted, true);
    const afterAbort = stale.length;
    assert.equal(hash(await loadFoodKartPayload(first.id)), first.originalSha256); release();
    await new Promise(resolve => setImmediate(resolve)); assert.equal(stale.length, afterAbort); assert.equal(zipCalls, 2);
  } finally { release?.(); mock.restore(); }
});
test('theme cache uses LRU eviction, retains at most24MiB, and clear releases it', async () => {
  const mock = mockFetch();
  try {
    for (const kit of manifest.kits.slice(0, 12)) {
      await loadFoodKartPayload(kit.partIds[0]); assert.ok(foodKartPayloadCacheStats().bytes <= 24 * 1024 * 1024);
    }
    assert.ok(foodKartPayloadCacheStats().bundles < 12);
    const before = mock.requests.length; await loadFoodKartPayload(first.id); assert.equal(mock.requests.length, before + 1);
    assert.ok(mock.requests.every(path => path.endsWith('manifest.json') || path.endsWith('.zip')));
    clearFoodKartPayloadCache(); assert.equal(foodKartPayloadCacheStats().bytes, 0); assert.equal(foodKartPayloadCacheStats().bundles, 0);
  } finally { mock.restore(); }
});
