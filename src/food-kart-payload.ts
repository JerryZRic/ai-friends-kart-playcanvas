import { gunzipSync } from 'fflate';
import { fetchWithRetry, DownloadError } from './asset-download.js';

/** Wire records contain only public paths. Original image and GLB hashes identify exact bytes. */
export interface FoodKartImage {
  path: string; bytes: number; sha256: string; byteOffset: number;
  mimeType: 'image/png'; width: number; height: number;
}
export interface FoodKartPart {
  id: string; kitId: string; kitNumber: string; moduleId: string;
  slot: 'body' | 'chassis' | 'wheels' | 'motor' | 'finalDrive' | 'battery';
  filename: string; title: string; path: string; available: boolean;
  bytes: number; sha256: string; decodedBytes: number; decodedSha256: string; originalSha256: string;
  images: FoodKartImage[]; thumbnail?: string; triangles?: number; materialPrimitives?: number;
  vertices?: number; materialCount?: number; embeddedImages?: number;
  anchors?: Record<string, [number, number, number]>; boundsGltf?: number[][];
  rootTransform: { translation: number[]; rotation: number[]; scale: number[] };
}
export interface FoodKartKit {
  id: string; number: string; title: string; theme: string; partIds: string[];
  bundlePath: string; bundleBytes: number; bundleSha256: string;
}
export interface FoodKartManifest {
  schemaVersion: 1; encoding: 'food-kart-glb-image-chunks-v1'; units: 'meter'; axes: string; assemblyRule: string;
  kits: FoodKartKit[];
  thumbnailIndex?: { path: string; bytes: number; sha256: string };
  parts: FoodKartPart[]; totals: Record<string, number>;
}
export interface FoodKartProgress {
  /** Downloaded bytes for this operation, including partial failed attempts; never a timer estimate. */
  receivedBytes: number;
  /** Selected theme bundle bytes; manifest has a separate total. Retries add measured work. */
  totalBytes: number | null;
  cachedBytes: number;
  stage: 'manifest' | 'download' | 'retry' | 'verify' | 'reconstruct' | 'ready';
  attempt?: number; retryInMs?: number;
}
export interface FoodKartLoadOptions { signal?: AbortSignal; onProgress?: (progress: FoodKartProgress) => void }
const ROOT = 'models/food-karts/';
const MAX_GLB = 32 * 1024 * 1024;
const MAX_MANIFEST = 4 * 1024 * 1024;
const MAX_CACHE = 24 * 1024 * 1024;
const MAX_BUNDLE = 8 * 1024 * 1024;
const slots = { '01_BodyShell': 'body', '02_ChassisSuspension': 'chassis', '03_WheelsTires': 'wheels', '04_Motor': 'motor', '05_FinalDrive': 'finalDrive', '06_Battery': 'battery' };
interface VerifiedBundle { bytes: Uint8Array; entries: Map<string, Uint8Array> }
const bundleCache = new Map<string, VerifiedBundle>();
interface SharedRequest<T> { controller: AbortController; promise: Promise<T>; listeners: Set<(p: FoodKartProgress) => void>; users: Set<symbol>; latest?: FoodKartProgress }
const manifestRequests = new Map<string, SharedRequest<FoodKartManifest>>();
const bundleRequests = new Map<string, SharedRequest<VerifiedBundle>>();
let cacheBytes = 0;
let manifestCache: FoodKartManifest | undefined;
const hashPattern = /^[a-f0-9]{64}$/;
const baseUrl = () => new URL(import.meta.env?.BASE_URL || './', globalThis.location?.href || 'http://localhost/');
const publicUrl = (path: string) => new URL(path, baseUrl()).href;
const aborted = (signal?: AbortSignal) => { if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError'); };
async function hash(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function validSize(value: unknown, max = MAX_GLB): value is number { return Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= max; }
function validateManifest(value: FoodKartManifest) {
  if (value?.schemaVersion !== 1 || value.encoding !== 'food-kart-glb-image-chunks-v1' || value.units !== 'meter' || value.kits?.length !== 55 || value.parts?.length !== 330) throw new Error('Invalid food kart manifest');
  const ids = new Set<string>();
  for (const part of value.parts) {
    if (!/^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(part.kitId) || part.kitNumber !== part.kitId.slice(0, 3) || !Object.hasOwn(slots, part.moduleId) || part.slot !== slots[part.moduleId]) throw new Error('Invalid food kart identity');
    if (part.id !== `kit${part.kitNumber}::${part.moduleId}` || ids.has(part.id) || part.path !== `${ROOT}parts/${part.kitId}/${part.moduleId}.glb.pack.gz`) throw new Error('Invalid food kart public path');
    ids.add(part.id);
    if (part.thumbnail && part.thumbnail !== `${ROOT}thumbs/${part.kitId}/${part.moduleId}.webp`) throw new Error('Invalid food kart thumbnail path');
    if (!part.available) continue;
    if (![part.sha256, part.decodedSha256, part.originalSha256].every(h => hashPattern.test(h)) || !validSize(part.bytes) || !validSize(part.decodedBytes) || !Array.isArray(part.images) || part.images.length > 32) throw new Error('Invalid food kart integrity metadata');
    const ranges: [number, number][] = [];
    for (const im of part.images) {
      if (!hashPattern.test(im.sha256) || im.path !== `${ROOT}textures/${im.sha256}.png` || !validSize(im.bytes, 2 * 1024 * 1024) || !Number.isSafeInteger(im.byteOffset) || im.byteOffset < 28 || im.byteOffset + im.bytes > part.decodedBytes || im.mimeType !== 'image/png' || !validSize(im.width, 4096) || !validSize(im.height, 4096)) throw new Error('Invalid food kart image metadata');
      if (ranges.some(([lo, hi]) => im.byteOffset < hi && im.byteOffset + im.bytes > lo)) throw new Error('Overlapping food kart image ranges');
      ranges.push([im.byteOffset, im.byteOffset + im.bytes]);
    }
  }
  const kits = new Set<string>();
  for (const kit of value.kits) {
    const members = value.parts.filter(p => p.kitId === kit.id);
    if (kits.has(kit.id) || kit.number !== kit.id.slice(0, 3) || kit.partIds?.length !== 6 || new Set(kit.partIds).size !== 6 || kit.partIds.some(id => !members.some(p => p.id === id)) || members.length !== 6) throw new Error('Invalid food kart kit');
    if (kit.bundlePath !== `${ROOT}bundles/${kit.id}.zip` || !validSize(kit.bundleBytes, MAX_BUNDLE) || !hashPattern.test(kit.bundleSha256)) throw new Error('Invalid food kart bundle metadata');
    kits.add(kit.id);
  }
  if (value.thumbnailIndex && (value.thumbnailIndex.path !== `${ROOT}thumbnails.json` || !validSize(value.thumbnailIndex.bytes, 16 * 1024 * 1024) || !hashPattern.test(value.thumbnailIndex.sha256))) throw new Error('Invalid food kart thumbnail index');
  return value;
}
/** Bounded streaming rejects unexpected oversized responses before retaining their full body. */
async function fetchBounded(path: string, options: any = {}) {
  const response = await fetch(path, { credentials: 'omit', redirect: 'error', signal: options.signal });
  if (!response.ok) throw new DownloadError(`HTTP ${response.status}`, [408, 429].includes(response.status) || response.status >= 500);
  const max = options.decodedBytes || options.expectedBytes || MAX_MANIFEST;
  const contentLength = Number(response.headers.get('content-length'));
  if (!response.headers.get('content-encoding') && contentLength > max) { await response.body?.cancel(); throw new Error('Food kart response exceeds declared size'); }
  const total = response.headers.get('content-encoding') ? (options.expectedBytes || null) : (contentLength || options.expectedBytes || null);
  if (!response.body?.getReader) {
    const result = await response.arrayBuffer(); if (result.byteLength > max) throw new Error('Food kart response exceeds declared size');
    options.onProgress?.({ receivedBytes: result.byteLength, totalBytes: total || result.byteLength }); return result;
  }
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > max) { await reader.cancel(); throw new Error('Food kart response exceeds declared size'); }
      chunks.push(value); options.onProgress?.({ receivedBytes: length, totalBytes: total });
    }
  } finally { reader.releaseLock(); }
  const output = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  options.onProgress?.({ receivedBytes: length, totalBytes: length });
  return output.buffer;
}
/** Coalesce same-resource loads without letting one cancelled consumer cancel another. */
function joinRequest<T>(requests: Map<string, SharedRequest<T>>, key: string, options: FoodKartLoadOptions, work: (signal: AbortSignal, report: (p: FoodKartProgress) => void) => Promise<T>): Promise<T> {
  aborted(options.signal);
  let request = requests.get(key);
  if (!request) {
    const controller = new AbortController();
    request = { controller, promise: undefined as unknown as Promise<T>, listeners: new Set(), users: new Set() };
    const created = request;
    created.promise = Promise.resolve().then(() => work(controller.signal, progress => {
      aborted(controller.signal); created.latest = progress;
      for (const listener of [...created.listeners]) listener(progress);
    })).finally(() => { if (requests.get(key) === created) requests.delete(key); });
    requests.set(key, created);
  }
  const shared = request, token = Symbol(); shared.users.add(token);
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const report = (p: FoodKartProgress) => { if (!settled && !options.signal?.aborted) options.onProgress?.(p); };
    const release = () => {
      settled = true; shared.listeners.delete(report); shared.users.delete(token); options.signal?.removeEventListener('abort', cancel);
      if (!shared.users.size && requests.get(key) === shared) { requests.delete(key); shared.controller.abort(); }
    };
    const cancel = () => { if (!settled) { release(); reject(options.signal?.reason || new DOMException('Aborted', 'AbortError')); } };
    shared.listeners.add(report); options.signal?.addEventListener('abort', cancel, { once: true });
    if (options.signal?.aborted) cancel(); else if (shared.latest) report(shared.latest);
    shared.promise.then(value => { if (!settled) { release(); resolve(value); } }, error => { if (!settled) { release(); reject(error); } });
  });
}
function cacheBundle(key: string, value: VerifiedBundle) {
  if (bundleCache.has(key)) { cacheBytes -= bundleCache.get(key)!.bytes.byteLength; bundleCache.delete(key); }
  while (cacheBytes + value.bytes.byteLength > MAX_CACHE && bundleCache.size) {
    const oldest = bundleCache.keys().next().value!; cacheBytes -= bundleCache.get(oldest)!.bytes.byteLength; bundleCache.delete(oldest);
  }
  bundleCache.set(key, value); cacheBytes += value.bytes.byteLength;
}
/** One bounded CPU cache holds verified ZIPs; entry views do not duplicate their bytes. */
export function clearFoodKartPayloadCache() {
  for (const request of [...manifestRequests.values(), ...bundleRequests.values()]) request.controller.abort();
  manifestRequests.clear(); bundleRequests.clear(); bundleCache.clear(); cacheBytes = 0; manifestCache = undefined;
}
export function foodKartPayloadCacheStats() { return { bytes: cacheBytes, bundles: bundleCache.size, limitBytes: MAX_CACHE }; }
export async function loadFoodKartManifest(options: FoodKartLoadOptions = {}): Promise<FoodKartManifest> {
  aborted(options.signal);
  if (manifestCache) return manifestCache;
  return joinRequest(manifestRequests, 'manifest', options, async (signal, report) => {
    const buffer = await fetchWithRetry(publicUrl(`${ROOT}manifest.json`), { fetchAsset: fetchBounded, signal, decodedBytes: MAX_MANIFEST, onProgress: p => report({ ...p, cachedBytes: 0, stage: 'manifest' }) } as any);
    aborted(signal);
    const value = validateManifest(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)));
    manifestCache = value; return value;
  });
}
export async function lookupFoodKartPart(id: string, options: FoodKartLoadOptions = {}): Promise<FoodKartPart> {
  const part = (await loadFoodKartManifest(options)).parts.find(p => p.id === id);
  if (!part) throw new Error('Unknown food kart part');
  if (!part.available) throw new Error('This food kart part is not available in this build');
  return part;
}
/** Strict stored-ZIP reader: check both directories, exact membership and bounds before exposing views. */
function indexBundle(bytes: Uint8Array, manifest: FoodKartManifest, kit: FoodKartKit): VerifiedBundle {
  const fail = () => { throw new Error('Invalid food kart bundle entries'); };
  const expected = new Map<string, number>();
  for (const part of manifest.parts.filter(p => p.kitId === kit.id && p.available)) {
    expected.set(part.path, part.bytes);
    for (const image of part.images) {
      if (expected.has(image.path) && expected.get(image.path) !== image.bytes) fail();
      expected.set(image.path, image.bytes);
    }
  }
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), end = bytes.length - 22;
  if (end < 0 || data.getUint32(end, true) !== 0x06054b50 || data.getUint16(end + 4, true) || data.getUint16(end + 6, true) || data.getUint16(end + 20, true)) fail();
  const count = data.getUint16(end + 10, true), directoryLength = data.getUint32(end + 12, true), directory = data.getUint32(end + 16, true);
  if (count !== expected.size || data.getUint16(end + 8, true) !== count || directory + directoryLength !== end) fail();
  const decoder = new TextDecoder('utf-8', { fatal: true }), entries = new Map<string, Uint8Array>();
  let cursor = directory, localEnd = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || data.getUint32(cursor, true) !== 0x02014b50) fail();
    const flags = data.getUint16(cursor + 8, true), method = data.getUint16(cursor + 10, true), crc = data.getUint32(cursor + 16, true);
    const packed = data.getUint32(cursor + 20, true), size = data.getUint32(cursor + 24, true), nameSize = data.getUint16(cursor + 28, true), extraSize = data.getUint16(cursor + 30, true), commentSize = data.getUint16(cursor + 32, true), offset = data.getUint32(cursor + 42, true);
    if (flags !== 0 || method !== 0 || packed !== size || extraSize || commentSize || data.getUint16(cursor + 34, true) || cursor + 46 + nameSize > end) fail();
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameSize));
    if (!expected.has(name) || expected.get(name) !== size || entries.has(name) || offset !== localEnd || offset + 30 > directory || data.getUint32(offset, true) !== 0x04034b50) fail();
    const localNameSize = data.getUint16(offset + 26, true), localExtraSize = data.getUint16(offset + 28, true), start = offset + 30 + localNameSize + localExtraSize;
    if (data.getUint16(offset + 6, true) !== flags || data.getUint16(offset + 8, true) !== method || data.getUint32(offset + 14, true) !== crc || data.getUint32(offset + 18, true) !== packed || data.getUint32(offset + 22, true) !== size || localNameSize !== nameSize || localExtraSize || start + size > directory || decoder.decode(bytes.subarray(offset + 30, start)) !== name) fail();
    entries.set(name, bytes.subarray(start, start + size)); localEnd = start + size; cursor += 46 + nameSize;
  }
  if (cursor !== end || localEnd !== directory) fail();
  return { bytes, entries };
}
/** Lossless reconstruction is separate from rendering. Consumers own imported containers/disposal. */
export async function loadFoodKartPayload(id: string, options: FoodKartLoadOptions = {}): Promise<ArrayBuffer> {
  const manifest = await loadFoodKartManifest(options); aborted(options.signal);
  const part = manifest.parts.find(p => p.id === id);
  if (!part) throw new Error('Unknown food kart part');
  if (!part.available) throw new Error('This food kart part is not available in this build');
  const kit = manifest.kits.find(k => k.id === part.kitId)!;
  let progress: FoodKartProgress = { receivedBytes: 0, totalBytes: kit.bundleBytes, cachedBytes: 0, stage: 'download' };
  const report = (next: FoodKartProgress) => { aborted(options.signal); progress = next; options.onProgress?.(next); };
  const emit = (stage: FoodKartProgress['stage']) => report({ ...progress, stage });
  let bundle = bundleCache.get(kit.bundleSha256);
  if (bundle) {
    bundleCache.delete(kit.bundleSha256); bundleCache.set(kit.bundleSha256, bundle);
    progress = { receivedBytes: 0, totalBytes: 0, cachedBytes: bundle.bytes.byteLength, stage: 'verify' }; emit('verify');
  } else bundle = await joinRequest(bundleRequests, kit.bundleSha256, { signal: options.signal, onProgress: report }, async (signal, notify) => {
    let receivedBytes = 0, totalBytes = kit.bundleBytes, previous = 0, attemptNumber = 1;
    const emitDownload = (stage: FoodKartProgress['stage'], extra = {}) => { aborted(signal); notify({ receivedBytes, totalBytes, cachedBytes: 0, stage, ...extra }); };
    const bytes = new Uint8Array(await fetchWithRetry(publicUrl(kit.bundlePath), {
      signal, fetchAsset: fetchBounded, expectedBytes: kit.bundleBytes,
      onAttempt: ({ attempt }) => { if (attempt > 1) totalBytes += previous; previous = 0; attemptNumber = attempt; emitDownload('download', { attempt }); },
      onProgress: p => { receivedBytes += Math.max(0, p.receivedBytes - previous); previous = p.receivedBytes; emitDownload('download', { attempt: attemptNumber }); },
      onRetry: retry => emitDownload('retry', retry),
    } as any));
    emitDownload('verify');
    if (bytes.byteLength !== kit.bundleBytes || await hash(bytes) !== kit.bundleSha256) throw new Error('Food kart bundle checksum mismatch');
    aborted(signal); const verified = indexBundle(bytes, manifest, kit); cacheBundle(kit.bundleSha256, verified); return verified;
  });
  aborted(options.signal); emit('verify');
  const packed = bundle.entries.get(part.path);
  if (!packed || packed.byteLength !== part.bytes || await hash(packed) !== part.sha256) throw new Error('Food kart payload checksum mismatch');
  aborted(options.signal);
  const skeleton = gunzipSync(packed, { out: new Uint8Array(part.decodedBytes) });
  if (skeleton.byteLength !== part.decodedBytes || await hash(skeleton) !== part.decodedSha256) throw new Error('Food kart decoded checksum mismatch');
  const images = new Map<string, Uint8Array>();
  for (const record of part.images) {
    aborted(options.signal); if (images.has(record.sha256)) continue;
    const bytes = bundle.entries.get(record.path);
    if (!bytes || bytes.byteLength !== record.bytes || await hash(bytes) !== record.sha256) throw new Error('Food kart texture checksum mismatch');
    images.set(record.sha256, bytes);
  }
  emit('reconstruct');
  for (const record of part.images) skeleton.set(images.get(record.sha256)!, record.byteOffset);
  if (await hash(skeleton) !== part.originalSha256) throw new Error('Reconstructed food kart differs from the canonical original');
  aborted(options.signal); emit('ready');
  return skeleton.buffer.slice(skeleton.byteOffset, skeleton.byteOffset + skeleton.byteLength) as ArrayBuffer;
}
