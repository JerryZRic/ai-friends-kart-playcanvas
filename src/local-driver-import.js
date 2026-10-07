import { LoadingManager } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRIVERS } from './driver-roster.js';
import { validateDriverContract, disposeDriverAsset } from './animated-driver.js';

export const MAX_IMPORT_BYTES = 32 * 1024 * 1024;
const slotIds = new Set(DRIVERS.map(driver => driver.id));
function requireSlot(id) {
  if (!slotIds.has(id)) throw new Error('Unknown driver slot');
  return id;
}

// Inspect bytes before Three.js can resolve any resource. A selected GLB must
// carry every dependency; no remote, relative, file: or supplied blob: URI.
export function validateGLB(buffer) {
  if (!(buffer instanceof ArrayBuffer)) throw new Error('Expected a GLB ArrayBuffer');
  if (buffer.byteLength > MAX_IMPORT_BYTES) throw new Error('GLB exceeds the 32 MiB limit');
  if (buffer.byteLength < 20) throw new Error('Truncated GLB header');
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) throw new Error('Select a binary glTF 2.0 (.glb) file');
  if (view.getUint32(8, true) !== buffer.byteLength) throw new Error('GLB declared length does not match the file');
  let offset = 12, json = null, binaryLength = null, binaryStart = null;
  while (offset < buffer.byteLength) {
    if (offset + 8 > buffer.byteLength) throw new Error('Truncated GLB chunk header');
    const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
    if (length % 4 || offset + 8 + length > buffer.byteLength) throw new Error('Invalid or truncated GLB chunk length');
    if (offset === 12 && type !== 0x4e4f534a) throw new Error('GLB must begin with a JSON chunk');
    if (type === 0x4e4f534a) {
      if (json !== null) throw new Error('GLB contains duplicate JSON chunks');
      try { json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(buffer, offset + 8, length))); }
      catch { throw new Error('GLB contains invalid JSON'); }
    } else if (type === 0x004e4942) {
      if (binaryLength !== null) throw new Error('GLB contains duplicate binary chunks');
      binaryLength = length; binaryStart = offset + 8;
    } else throw new Error('Unsupported GLB chunk type');
    offset += 8 + length;
  }
  if (!json || typeof json !== 'object' || Array.isArray(json) || json.asset?.version !== '2.0') throw new Error('Missing glTF 2.0 asset metadata');
  // Check every nested URI, including optional extensions, not only core images.
  const todo = [json];
  while (todo.length) {
    const object = todo.pop();
    for (const [key, value] of Object.entries(object)) {
      if (key.toLowerCase() === 'uri' && (typeof value !== 'string' || !/^data:/i.test(value))) throw new Error('External resource URI rejected: embed every buffer and image in the GLB');
      if (value && typeof value === 'object') todo.push(value);
    }
  }
  for (const key of ['buffers', 'bufferViews', 'accessors', 'nodes', 'meshes', 'skins', 'images', 'animations']) {
    if (json[key] !== undefined && !Array.isArray(json[key])) throw new Error(`Invalid glTF ${key} array`);
  }
  for (const [key, limit] of Object.entries({ buffers: 8, bufferViews: 8192, accessors: 8192, nodes: 4096, meshes: 1024, skins: 128, images: 16, animations: 64 })) {
    if ((json[key]?.length || 0) > limit) throw new Error(`Too many glTF ${key}`);
  }
  for (const entry of [...(json.buffers || []), ...(json.images || [])]) {
    if (entry.uri !== undefined && !/^data:[^,]*;base64,/i.test(entry.uri)) throw new Error('Embedded URI must use base64 data');
  }
  for (const [index, entry] of (json.buffers || []).entries()) {
    if (!Number.isSafeInteger(entry.byteLength) || entry.byteLength < 0 || entry.byteLength > MAX_IMPORT_BYTES) throw new Error('Invalid GLB buffer length');
    if (!entry.uri && (index !== 0 || binaryLength === null || entry.byteLength > binaryLength || binaryLength - entry.byteLength > 3)) throw new Error('Missing or truncated embedded binary buffer');
  }
  for (const entry of json.buffers || []) if (entry.uri && !/^data:application\/(?:octet-stream|gltf-buffer);base64,/i.test(entry.uri)) throw new Error('Embedded buffers must use application/octet-stream data');
  for (const entry of json.images || []) {
    if (entry.uri && !/^data:image\/(?:png|jpeg|webp);base64,/i.test(entry.uri)) throw new Error('Only embedded PNG, JPEG or WebP images are supported');
    if (!entry.uri && !['image/png', 'image/jpeg', 'image/webp'].includes(entry.mimeType)) throw new Error('Only embedded PNG, JPEG or WebP images are supported');
  }
  for (const entry of json.bufferViews || []) {
    const buffer = json.buffers?.[entry.buffer], offset = entry.byteOffset || 0;
    if (!buffer || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(entry.byteLength) || entry.byteLength < 0 || offset + entry.byteLength > buffer.byteLength) throw new Error('Buffer view exceeds embedded data');
    if (entry.byteStride !== undefined && (!Number.isInteger(entry.byteStride) || entry.byteStride < 4 || entry.byteStride > 252)) throw new Error('Invalid buffer stride');
  }
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
  const sizes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  let decodedBytes = 0;
  for (const entry of json.accessors || []) {
    const itemSize = components[entry.type] * sizes[entry.componentType];
    if (!Number.isSafeInteger(entry.count) || entry.count < 0 || entry.count > 2000000 || !itemSize || entry.sparse) throw new Error('Unsupported or oversized accessor');
    decodedBytes += entry.count * itemSize;
    const offset = entry.byteOffset || 0, view = json.bufferViews?.[entry.bufferView];
    if (!Number.isSafeInteger(offset) || offset < 0 || !view || offset + Math.max(0, entry.count - 1) * (view.byteStride || itemSize) + (entry.count ? itemSize : 0) > view.byteLength) throw new Error('Accessor exceeds embedded data');
  }
  if (decodedBytes > 128 * 1024 * 1024) throw new Error('Decoded geometry exceeds the memory limit');
  const embedded = new Map();
  function dataBytes(uri) {
    try { const decoded = atob(uri.slice(uri.indexOf(',') + 1)); return Uint8Array.from(decoded, character => character.charCodeAt(0)); }
    catch { throw new Error('Invalid embedded base64 data'); }
  }
  function bufferBytes(index) {
    if (!embedded.has(index)) {
      const entry = json.buffers[index];
      const bytes = entry.uri ? dataBytes(entry.uri) : new Uint8Array(buffer, binaryStart, binaryLength);
      if (bytes.byteLength < entry.byteLength) throw new Error('Truncated embedded buffer');
      embedded.set(index, bytes);
    }
    return embedded.get(index);
  }
  let imagePixels = 0;
  for (const entry of json.images || []) {
    const view = json.bufferViews?.[entry.bufferView];
    if (!entry.uri && !view) throw new Error('Image has no embedded buffer view');
    const bytes = entry.uri ? dataBytes(entry.uri) : bufferBytes(view.buffer).subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    const [width, height] = imageDimensions(bytes);
    if (!width || !height || width > 4096 || height > 4096) throw new Error('Embedded image must be at most 4096 × 4096 pixels');
    imagePixels += width * height;
  }
  if (imagePixels > 32 * 1024 * 1024) throw new Error('Embedded images exceed the decoded pixel limit');
  return json;
}

// Read image dimensions without decoding or allocating pixel buffers.
function imageDimensions(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset, length) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a && text(12, 4) === 'IHDR') return [view.getUint32(16), view.getUint32(20)];
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const size = view.getUint16(offset);
      if (size < 2 || offset + size > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && size >= 7) return [view.getUint16(offset + 5), view.getUint16(offset + 3)];
      offset += size;
    }
  }
  if (bytes.length >= 30 && text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') {
    const kind = text(12, 4);
    const uint24 = offset => bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536;
    if (kind === 'VP8X') return [uint24(24) + 1, uint24(27) + 1];
    if (kind === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return [view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff];
    if (kind === 'VP8L' && bytes[20] === 0x2f) { const bits = view.getUint32(21, true); return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1]; }
  }
  throw new Error('Embedded image is not a supported PNG, JPEG or WebP');
}

export function resolveImportSlot(filename, selectedId, multiple = false) {
  requireSlot(selectedId);
  if (!multiple) return selectedId;
  const tokens = String(filename).toLowerCase().replace(/\.glb$/i, '').split(/[^a-z0-9]+/);
  const found = DRIVERS.filter(driver => tokens.includes(driver.id));
  if (found.length !== 1) throw new Error('For multiple files, name each GLB with exactly one slot ID: whale, gemini, gpt, claude, grok, glm');
  return found[0].id;
}

export async function parseLocalGLB(buffer) {
  const manager = new LoadingManager();
  manager.setURLModifier(url => {
    // Embedded bufferView images are converted to temporary blob URLs inside
    // GLTFLoader. User-supplied blob URIs have already been rejected above.
    if (!/^(?:data:|blob:)/i.test(url)) throw new Error('Local import cannot request external resources');
    return url;
  });
  return new GLTFLoader(manager).parseAsync(buffer, '');
}

// This store owns parsed asset resources. Controllers only borrow them. Before
// replacing an asset, onChange releases its controllers synchronously; only then
// can the previous geometries/materials/textures be disposed.
export function createLocalDriverStore({ parse = parseLocalGLB, validate = validateDriverContract, dispose = disposeDriverAsset, onBusy = () => {}, onChange = () => {}, canImport = () => true, maxConcurrent = 2 } = {}) {
  const assets = new Map(), versions = new Map(), queue = [];
  const limit = Math.max(1, Math.min(2, Math.floor(maxConcurrent) || 2));
  let active = 0, pending = 0, closed = false;
  const notifyBusy = () => onBusy(pending > 0, pending);
  function pump() {
    while (active < limit && queue.length) {
      active++;
      const task = queue.shift();
      task().finally(() => { active--; pump(); });
    }
  }
  function stale(id, version) { return closed || versions.get(id) !== version; }
  function importFile(file, slotId) {
    try { requireSlot(slotId); if (closed) throw new Error('Local import session is closed'); if (!canImport()) throw new Error('Import drivers from the menu after the race'); }
    catch (error) { return Promise.reject(error); }
    const version = (versions.get(slotId) || 0) + 1;
    versions.set(slotId, version);
    pending++; notifyBusy();
    return new Promise((resolve, reject) => {
      queue.push(async () => {
        let asset = null;
        try {
          if (stale(slotId, version)) { resolve({ status: 'stale', slotId }); return; }
          if (!file || typeof file.name !== 'string' || !/\.glb$/i.test(file.name) || typeof file.arrayBuffer !== 'function') throw new Error('Select a .glb file');
          if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_IMPORT_BYTES) throw new Error('GLB must be nonempty and at most 32 MiB');
          const buffer = await file.arrayBuffer();
          if (stale(slotId, version)) { resolve({ status: 'stale', slotId }); return; }
          if (buffer.byteLength !== file.size) throw new Error('GLB file size changed while reading');
          validateGLB(buffer);
          asset = await parse(buffer);
          if (stale(slotId, version)) { dispose(asset); asset = null; resolve({ status: 'stale', slotId }); return; }
          await validate(asset);
          if (stale(slotId, version) || !canImport()) { dispose(asset); asset = null; resolve({ status: 'stale', slotId }); return; }
          const previous = assets.get(slotId);
          assets.set(slotId, asset);
          try { onChange({ slotId, asset, previous }); }
          catch (error) { if (previous) assets.set(slotId, previous); else assets.delete(slotId); throw error; }
          asset = null;
          if (previous) dispose(previous);
          resolve({ status: 'imported', slotId });
        } catch (error) { if (asset) dispose(asset); reject(error); }
        finally { pending--; notifyBusy(); }
      });
      pump();
    });
  }
  return {
    importFile,
    importFiles(files, selectedId) {
      const chosen = Array.from(files || []);
      return Promise.allSettled(chosen.map(file => {
        try { return importFile(file, resolveImportSlot(file.name, selectedId, chosen.length > 1)); }
        catch (error) { return Promise.reject(error); }
      }));
    },
    get: id => assets.get(id),
    has: id => assets.has(id),
    get busy() { return pending > 0; },
    get pending() { return pending; },
    clear(slotId) {
      requireSlot(slotId);
      if (closed || !canImport()) return false;
      versions.set(slotId, (versions.get(slotId) || 0) + 1);
      const previous = assets.get(slotId);
      assets.delete(slotId);
      try { onChange({ slotId, asset: undefined, previous }); }
      catch (error) { if (previous) assets.set(slotId, previous); throw error; }
      if (previous) dispose(previous);
      return true;
    },
    dispose() {
      if (closed) return;
      closed = true;
      for (const [slotId, previous] of assets) { onChange({ slotId, asset: undefined, previous }); dispose(previous); }
      assets.clear();
    },
  };
}
