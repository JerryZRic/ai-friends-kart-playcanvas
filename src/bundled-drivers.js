import manifest from '../docs/runtime-models.json' with { type: 'json' };
import { gunzipSync } from 'three/addons/libs/fflate.module.js';
import { parseLocalGLB, validateGLB } from './local-driver-import.js';
import { validateDriverContract, disposeDriverAsset } from './animated-driver.js';

export const RUNTIME_MODELS = Object.freeze(manifest.assets.map(record => Object.freeze({ ...record })));
import { fetchWithRetry, fetchStream } from './asset-download.js';

async function checkIdentity(buffer, bytes, sha256, label) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== bytes) throw new Error(`${label} size differs from its public manifest`);
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== sha256) throw new Error(`${label} checksum differs from its public manifest`);
}

export async function decodeRuntimeBuffer(buffer, record) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 4) throw new Error('Runtime model is truncated');
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  let decoded;
  if (view.getUint32(0, true) === 0x46546c67) {
    // Some static hosts apply Content-Encoding: gzip and the browser decodes it.
    decoded = buffer;
  } else if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    await checkIdentity(buffer, record.bytes, record.sha256, 'Compressed runtime model');
    try {
      const unzipped = gunzipSync(bytes);
      decoded = unzipped.buffer.slice(unzipped.byteOffset, unzipped.byteOffset + unzipped.byteLength);
    } catch { throw new Error('Runtime model gzip could not be decoded'); }
  } else throw new Error('Runtime model is neither a GLB nor a gzip archive');
  await checkIdentity(decoded, record.decodedBytes, record.decodedSha256, 'Decoded runtime model');
  validateGLB(decoded);
  return decoded;
}

const assetByteSizes = new WeakMap();
export async function loadBundledDrivers({ fetchAsset = fetchStream, parse = parseLocalGLB, validate = validateDriverContract, onProgress = () => {}, onStatus = () => {}, existingDrivers = new Map(), maxConcurrent = 2, timeoutMs = 60000, maxAttempts = 4, random, wait, signal } = {}) {
  const drivers = new Map(existingDrivers), failures = new Map();
  const states = new Map(RUNTIME_MODELS.map(record => [record.id, { id: record.id, stage: drivers.has(record.id) ? 'ready' : 'queued', receivedBytes: drivers.has(record.id) ? (assetByteSizes.get(drivers.get(record.id)) || record.bytes) : 0, totalBytes: assetByteSizes.get(drivers.get(record.id)) || record.bytes, attempt: 0, maxAttempts, retryInMs: 0 }]));
  const pending = RUNTIME_MODELS.filter(record => !drivers.has(record.id));
  let next = 0, completed = RUNTIME_MODELS.length - pending.length;
  const emit = () => { const records = [...states.values()].map(value => ({ ...value })); onStatus({ records, receivedBytes: records.reduce((sum, record) => sum + record.receivedBytes, 0), totalBytes: records.every(record => record.totalBytes != null) ? records.reduce((sum, record) => sum + record.totalBytes, 0) : null, completed, total: RUNTIME_MODELS.length, loaded: drivers.size, failed: failures.size }); };
  const update = (id, patch) => { Object.assign(states.get(id), patch); emit(); };
  const limit = Math.max(1, Math.min(2, Math.floor(maxConcurrent) || 2));
  emit();
  async function worker() {
    while (next < pending.length && !signal?.aborted) {
      const record = pending[next++]; let asset = null;
      try {
        const buffer = await fetchWithRetry(record.path, {
          fetchAsset, timeoutMs, maxAttempts, random, wait, signal, expectedBytes: record.bytes, decodedBytes: record.decodedBytes,
          onAttempt: value => update(record.id, { ...value, stage: 'downloading', receivedBytes: 0, retryInMs: 0 }),
          onProgress: value => update(record.id, value),
          onRetry: value => update(record.id, { ...value, stage: 'waiting' }),
        });
        update(record.id, { stage: 'decompressing', receivedBytes: buffer.byteLength, totalBytes: buffer.byteLength });
        // Yield a frame/task so the stage can paint before synchronous decompression.
        await new Promise(resolve => setTimeout(resolve, 0));
        const decoded = await decodeRuntimeBuffer(buffer, record);
        if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');
        update(record.id, { stage: 'preparing' });
        await new Promise(resolve => setTimeout(resolve, 0));
        asset = await parse(decoded); await validate(asset);
        if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');
        assetByteSizes.set(asset, buffer.byteLength); drivers.set(record.id, asset); asset = null;
        update(record.id, { stage: 'ready' });
      } catch (error) {
        if (asset) disposeDriverAsset(asset);
        const message = error instanceof Error ? error.message : 'Unable to load model';
        failures.set(record.id, message); update(record.id, { stage: 'failed', error: message, retryInMs: 0 });
      } finally {
        completed++; emit();
        onProgress({ id: record.id, completed, total: RUNTIME_MODELS.length, loaded: drivers.size, failed: failures.size });
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return { drivers, failures };
}
