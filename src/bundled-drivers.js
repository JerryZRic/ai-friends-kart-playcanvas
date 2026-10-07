import manifest from '../docs/runtime-models.json' with { type: 'json' };
import { gunzipSync } from 'three/addons/libs/fflate.module.js';
import { parseLocalGLB, validateGLB } from './local-driver-import.js';
import { validateDriverContract, disposeDriverAsset } from './animated-driver.js';

export const RUNTIME_MODELS = Object.freeze(manifest.assets.map(record => Object.freeze({ ...record })));
async function fetchRuntimeAsset(path, { signal } = {}) {
  // These are fixed same-origin distribution files. No user-selected file or
  // selected-file bytes are ever sent to this path or any other destination.
  const response = await fetch(path, { credentials: 'omit', redirect: 'error', signal });
  if (!response.ok) throw new Error(`Model download failed (${response.status})`);
  return response.arrayBuffer();
}

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

export async function loadBundledDrivers({ fetchAsset = fetchRuntimeAsset, parse = parseLocalGLB, validate = validateDriverContract, onProgress = () => {}, maxConcurrent = 2, timeoutMs = 60000 } = {}) {
  const drivers = new Map(), failures = new Map();
  let next = 0, completed = 0;
  const limit = Math.max(1, Math.min(2, Math.floor(maxConcurrent) || 2));
  async function worker() {
    while (next < RUNTIME_MODELS.length) {
      const record = RUNTIME_MODELS[next++];
      let asset = null;
      try {
        const abort = new AbortController();
        let timer;
        const deadline = Math.max(1, Math.min(180000, Number.isFinite(timeoutMs) ? timeoutMs : 60000));
        let buffer;
        try {
          buffer = await Promise.race([
            fetchAsset(record.path, { signal: abort.signal }),
            new Promise((_, reject) => { timer = setTimeout(() => { abort.abort(); reject(new Error('Runtime model download timed out; refresh to retry')); }, deadline); }),
          ]);
        } finally { clearTimeout(timer); }

        const decoded = await decodeRuntimeBuffer(buffer, record);
        asset = await parse(decoded);
        await validate(asset);
        drivers.set(record.id, asset); asset = null;
      } catch (error) {
        if (asset) disposeDriverAsset(asset);
        failures.set(record.id, error instanceof Error ? error.message : 'Unable to load model');
      } finally {
        completed++;
        onProgress({ id: record.id, completed, total: RUNTIME_MODELS.length, loaded: drivers.size, failed: failures.size });
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return { drivers, failures };
}
