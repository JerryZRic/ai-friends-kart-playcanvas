export const MAX_IMPORT_BYTES = 32 * 1024 * 1024;
// Inspect bytes before PlayCanvas can resolve any resource. A selected GLB must
// carry every dependency; no remote, relative, file: or supplied blob: URI.
export function validateGLB(buffer: ArrayBuffer): any {
  if (!(buffer instanceof ArrayBuffer)) throw new Error('Expected a GLB ArrayBuffer');
  if (buffer.byteLength > MAX_IMPORT_BYTES) throw new Error('GLB exceeds the 32 MiB limit');
  if (buffer.byteLength < 20) throw new Error('Truncated GLB header');
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) throw new Error('Select a binary glTF 2.0 (.glb) file');
  if (view.getUint32(8, true) !== buffer.byteLength) throw new Error('GLB declared length does not match the file');
  let offset = 12, json: any = null, binaryLength = null, binaryStart = null;
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
  // Declarations must obey the same self-contained decoder policy as extension payloads.
  for (const key of ['extensionsRequired', 'extensionsUsed']) {
    if (json[key] !== undefined && (!Array.isArray(json[key]) || !json[key].every(name => typeof name === 'string'))) throw new Error('Invalid glTF extension declaration');
    if ((json[key] || []).some(name => /^(?:KHR_draco_mesh_compression|EXT_meshopt_compression|KHR_texture_basisu|KHR_gaussian_splatting|EXT_gaussian_splatting)$/i.test(name))) throw new Error('Compressed extension requires an external decoder and is not allowed in local GLB files');
  }
  // Check every nested URI, including optional extensions, not only core images.
  const todo = [json];
  while (todo.length) {
    const object = todo.pop();
    for (const [key, value] of Object.entries(object)) {
      if (/^(?:KHR_draco_mesh_compression|EXT_meshopt_compression|KHR_texture_basisu|KHR_gaussian_splatting|EXT_gaussian_splatting)$/i.test(key)) throw new Error('Compressed extension requires an external decoder and is not allowed in local GLB files');
      if (key.toLowerCase() === 'uri' && (typeof value !== 'string' || !/^data:/i.test(String(value)))) throw new Error('External resource URI rejected: embed every buffer and image in the GLB');
      if (value && typeof value === 'object') todo.push(value);
    }
  }
  for (const key of ['buffers', 'bufferViews', 'accessors', 'nodes', 'meshes', 'skins', 'images', 'animations']) {
    if (json[key] !== undefined && !Array.isArray(json[key])) throw new Error(`Invalid glTF ${key} array`);
  }
  for (const [key, limit] of Object.entries({ buffers: 8, bufferViews: 8192, accessors: 8192, nodes: 4096, meshes: 1024, skins: 128, images: 16, animations: 64 })) {
    if ((json[key]?.length || 0) > limit) throw new Error(`Too many glTF ${key}`);
  }
  // Reject invalid/cyclic hierarchies before the engine recursively instantiates them.
  const parents = new Map<number, number>(), visiting = new Set<number>(), visited = new Set<number>();
  function visitNode(index: number) {
    if (!Number.isInteger(index) || !json.nodes?.[index]) throw new Error('Invalid GLB node reference');
    if (visiting.has(index)) throw new Error('Cyclic GLB node hierarchy');
    if (visited.has(index)) return;
    visiting.add(index);
    const node = json.nodes[index];
    for (const [key, length] of [['translation', 3], ['rotation', 4], ['scale', 3], ['matrix', 16]] as const) {
      if (node[key] !== undefined && (!Array.isArray(node[key]) || node[key].length !== length || !node[key].every(Number.isFinite))) throw new Error('Driver node transform contains non-finite or invalid values');
    }
    if (node.children !== undefined && !Array.isArray(node.children)) throw new Error('Invalid GLB children array');
    for (const child of node.children || []) {
      if (parents.has(child)) throw new Error('GLB node has more than one parent');
      parents.set(child, index); visitNode(child);
    }
    visiting.delete(index); visited.add(index);
  }
  for (let i = 0; i < (json.nodes?.length || 0); i++) visitNode(i);
  for (const scene of json.scenes || []) for (const index of scene.nodes || []) {
    if (!Number.isInteger(index) || !json.nodes?.[index] || parents.has(index)) throw new Error('Invalid GLB scene root');
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

