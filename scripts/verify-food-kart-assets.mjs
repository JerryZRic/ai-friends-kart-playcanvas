/** Verify public delivery independently of original private work directories. */
import { readFileSync, existsSync, lstatSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const SHA256 = /^[a-f0-9]{64}$/;
const KIT_ID = /^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MODULE_ID = /^(01_BodyShell|02_ChassisSuspension|03_WheelsTires|04_Motor|05_FinalDrive|06_Battery)$/;
const MAX_BUNDLE_BYTES = 24 * 1024 * 1024;
const MAX_DECODED_BYTES = 32 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
// Only the current kit is retained. Entries are zero-copy views of its bounded ZIP.
let currentBundle;

function validatePartPath(part) {
  if (!KIT_ID.test(part.kitId) || !MODULE_ID.test(part.moduleId) || part.path !== `models/food-karts/parts/${part.kitId}/${part.moduleId}.glb.pack.gz`) throw new Error('Unsafe public asset path');
}

function expectedBundleEntries(manifest, kit) {
  const parts = manifest.parts.filter(part => part.kitId === kit.id);
  if (parts.length !== 6 || new Set(parts.map(part => part.moduleId)).size !== 6 || !Array.isArray(kit.partIds) || kit.partIds.length !== 6 || new Set(kit.partIds).size !== 6 || parts.some(part => !kit.partIds.includes(part.id))) throw new Error(`Expected six unique kit modules: ${kit.id}`);
  const expected = new Map();
  for (const part of parts) {
    validatePartPath(part);
    if (!part.available) continue;
    if (!positiveInteger(part.bytes) || !SHA256.test(part.sha256) || !positiveInteger(part.decodedBytes) || part.decodedBytes > MAX_DECODED_BYTES || !SHA256.test(part.decodedSha256) || !SHA256.test(part.originalSha256) || !Array.isArray(part.images)) throw new Error(`Invalid part integrity metadata ${part.id}`);
    expected.set(part.path, { bytes: part.bytes, sha256: part.sha256 });
    for (const image of part.images) {
      if (!SHA256.test(image.sha256) || image.path !== `models/food-karts/textures/${image.sha256}.png`) throw new Error('Unsafe public image path');
      if (!positiveInteger(image.bytes) || !positiveInteger(image.width) || !positiveInteger(image.height) || image.mimeType !== 'image/png') throw new Error(`Invalid image metadata ${image.path}`);
      const previous = expected.get(image.path);
      if (previous && (previous.bytes !== image.bytes || previous.sha256 !== image.sha256 || previous.width !== image.width || previous.height !== image.height)) throw new Error(`Inconsistent shared image ${image.path}`);
      expected.set(image.path, { bytes: image.bytes, sha256: image.sha256, width: image.width, height: image.height });
    }
  }
  return expected;
}

/** Parse only the exact ZIP32/store format used for the public theme bundles.
 * Both directories are checked so duplicate, hidden and external-path entries
 * cannot disappear in a generic unzip object's filename-keyed output.
 */
function readStoredEntries(bytes, expected, kitId) {
  const fail = reason => { throw new Error(`Invalid food bundle ${kitId}: ${reason}`); };
  if (bytes.length < 22) fail('truncated ZIP');
  const end = bytes.length - 22;
  if (bytes.readUInt32LE(end) !== 0x06054b50 || bytes.readUInt16LE(end + 20) !== 0) fail('missing ZIP end or unexpected archive comment');
  const count = bytes.readUInt16LE(end + 10), directoryBytes = bytes.readUInt32LE(end + 12), directoryOffset = bytes.readUInt32LE(end + 16);
  if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6) || bytes.readUInt16LE(end + 8) !== count || count !== expected.size || directoryOffset + directoryBytes !== end) fail('unexpected ZIP directory');
  const entries = new Map(), regions = [];
  let cursor = directoryOffset;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50) fail('truncated central entry');
    const flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10), crc = bytes.readUInt32LE(cursor + 16);
    const compressedBytes = bytes.readUInt32LE(cursor + 20), decodedBytes = bytes.readUInt32LE(cursor + 24);
    const nameBytes = bytes.readUInt16LE(cursor + 28), extraBytes = bytes.readUInt16LE(cursor + 30), commentBytes = bytes.readUInt16LE(cursor + 32);
    const attributes = bytes.readUInt32LE(cursor + 38), offset = bytes.readUInt32LE(cursor + 42);
    if (cursor + 46 + nameBytes + extraBytes + commentBytes > end) fail('truncated central name');
    const nameBuffer = bytes.subarray(cursor + 46, cursor + 46 + nameBytes), name = nameBuffer.toString('utf8'), record = expected.get(name);
    if (!record || !nameBuffer.equals(Buffer.from(name)) || entries.has(name)) fail(`unexpected or duplicate entry ${name}`);
    const unixType = (attributes >>> 16) & 0o170000;
    if (flags & ~0x0800 || method !== 0 || extraBytes || commentBytes || bytes.readUInt16LE(cursor + 34) || (attributes & 0x10) || (unixType && unixType !== 0o100000)) fail(`non-store file or unexpected metadata ${name}`);
    if (compressedBytes !== decodedBytes || decodedBytes !== record.bytes) fail(`entry size ${name}`);
    if (offset + 30 > directoryOffset || bytes.readUInt32LE(offset) !== 0x04034b50) fail(`missing local entry ${name}`);
    const localNameBytes = bytes.readUInt16LE(offset + 26), localExtraBytes = bytes.readUInt16LE(offset + 28);
    const dataOffset = offset + 30 + localNameBytes + localExtraBytes, dataEnd = dataOffset + compressedBytes;
    if (dataEnd > directoryOffset || localExtraBytes || localNameBytes !== nameBytes || !bytes.subarray(offset + 30, offset + 30 + localNameBytes).equals(nameBuffer) || bytes.readUInt16LE(offset + 6) !== flags || bytes.readUInt16LE(offset + 8) !== method || bytes.readUInt32LE(offset + 14) !== crc || bytes.readUInt32LE(offset + 18) !== compressedBytes || bytes.readUInt32LE(offset + 22) !== decodedBytes) fail(`local/central mismatch ${name}`);
    const data = bytes.subarray(dataOffset, dataEnd);
    if (hash(data) !== record.sha256) fail(`entry integrity ${name}`);
    if (record.width && (data.length < 24 || !data.subarray(0, 8).equals(PNG_SIGNATURE) || data.toString('ascii', 12, 16) !== 'IHDR' || data.readUInt32BE(16) !== record.width || data.readUInt32BE(20) !== record.height)) fail(`image dimensions ${name}`);
    entries.set(name, data);
    regions.push([offset, dataEnd]);
    cursor += 46 + nameBytes + extraBytes + commentBytes;
  }
  if (cursor !== end) fail('extra central directory data');
  let localEnd = 0;
  for (const [start, finish] of regions.sort((a, b) => a[0] - b[0])) {
    if (start !== localEnd) fail('hidden, overlapping or extra local entries');
    localEnd = finish;
  }
  if (localEnd !== directoryOffset) fail('extra data before central directory');
  return entries;
}

function loadBundle(manifest, kitId) {
  const matching = manifest.kits.filter(kit => kit.id === kitId), kit = matching[0];
  if (matching.length !== 1 || !KIT_ID.test(kitId) || kit.bundlePath !== `models/food-karts/bundles/${kitId}.zip`) throw new Error('Unsafe public bundle path');
  if (!positiveInteger(kit.bundleBytes) || kit.bundleBytes > MAX_BUNDLE_BYTES || !SHA256.test(kit.bundleSha256)) throw new Error(`Invalid bundle integrity metadata ${kitId}`);
  const expected = expectedBundleEntries(manifest, kit), path = `public/${kit.bundlePath}`, stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== kit.bundleBytes) throw new Error(`Bundle byte length ${kitId}`);
  const key = JSON.stringify([process.cwd(), kit.bundlePath, kit.bundleBytes, kit.bundleSha256, stat.ino, stat.mtimeMs, stat.ctimeMs, [...expected]]);
  if (currentBundle?.key === key) return currentBundle;
  currentBundle = undefined;
  const bytes = readFileSync(path);
  // Verify the whole transport before inspecting or decoding any member.
  if (bytes.length !== kit.bundleBytes || hash(bytes) !== kit.bundleSha256) throw new Error(`Bundle integrity ${kitId}`);
  const entries = readStoredEntries(bytes, expected, kitId);
  currentBundle = { key, entries, bytes: bytes.length, logicalBytes: [...expected.values()].reduce((sum, entry) => sum + entry.bytes, 0) };
  return currentBundle;
}

/** Restore a canonical GLB using only its public theme ZIP, for tests/import QA. */
export function reconstructFoodKartPart(manifest, part) {
  validatePartPath(part);
  if (!part.available) throw new Error(`Missing canonical asset ${part.id}`);
  const bundle = loadBundle(manifest, part.kitId), packed = bundle.entries.get(part.path);
  if (!packed || packed.length !== part.bytes || hash(packed) !== part.sha256) throw new Error(`Packed integrity ${part.id}`);
  const data = gunzipSync(packed, { maxOutputLength: MAX_DECODED_BYTES });
  if (data.length !== part.decodedBytes || hash(data) !== part.decodedSha256) throw new Error(`Decoded integrity ${part.id}`);
  const regions = [];
  for (const image of part.images) {
    if (!Number.isSafeInteger(image.byteOffset) || image.byteOffset < 0 || image.byteOffset + image.bytes > data.length) throw new Error(`Image bounds ${part.id}`);
    const bytes = bundle.entries.get(image.path);
    if (!bytes || bytes.length !== image.bytes || hash(bytes) !== image.sha256) throw new Error(`Image integrity ${image.path}`);
    const blank = data.subarray(image.byteOffset, image.byteOffset + image.bytes);
    if (blank.some(byte => byte !== 0)) throw new Error(`Image placeholder not zeroed ${part.id}`);
    regions.push([image.byteOffset, image.byteOffset + image.bytes]);
    bytes.copy(data, image.byteOffset);
  }
  let previousEnd = 0;
  for (const [start, end] of regions.sort((a, b) => a[0] - b[0])) {
    if (start < previousEnd) throw new Error(`Overlapping image placeholders ${part.id}`);
    previousEnd = end;
  }
  if (hash(data) !== part.originalSha256) throw new Error(`Canonical reconstruction ${part.id}`);
  return data;
}

function publicFiles(directory) {
  if (!existsSync(directory)) return [];
  const stat = lstatSync(directory);
  if (stat.isSymbolicLink()) throw new Error(`Public food symlink ${directory}`);
  if (!stat.isDirectory()) return [directory];
  return readdirSync(directory).flatMap(name => publicFiles(`${directory}/${name}`));
}

function verifyThumbnails(manifest) {
  if (!manifest.thumbnailIndex) return;
  const record = manifest.thumbnailIndex;
  if (record.path !== 'models/food-karts/thumbnails.json' || !positiveInteger(record.bytes) || !SHA256.test(record.sha256)) throw new Error('Unsafe thumbnail index');
  const bytes = readFileSync(`public/${record.path}`);
  if (bytes.length !== record.bytes || hash(bytes) !== record.sha256) throw new Error('Thumbnail index integrity');
  const index = JSON.parse(bytes);
  if (index.schemaVersion !== 1 || !index.images || Object.keys(index.images).length !== manifest.parts.length) throw new Error('Expected exactly324 indexed thumbnails');
  for (const part of manifest.parts) {
    const value = index.images[part.id];
    if (typeof value !== 'string' || !/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error(`Invalid thumbnail ${part.id}`);
    const base64 = value.slice('data:image/webp;base64,'.length), image = Buffer.from(base64, 'base64');
    if (image.toString('base64') !== base64 || image.length < 12 || image.toString('ascii', 0, 4) !== 'RIFF' || image.toString('ascii', 8, 12) !== 'WEBP' || image.readUInt32LE(4) + 8 !== image.length) throw new Error(`Thumbnail WebP integrity ${part.id}`);
  }
}

export function verifyFoodKartAssets({ allowPartial = false, allowLoose = false } = {}) {
  currentBundle = undefined;
  const text = readFileSync('public/models/food-karts/manifest.json', 'utf8'), manifest = JSON.parse(text);
  if (/libfile_|\/workspace\/|\/home\/agent|\.openai|sediment:\/\/|library_file|file_000000|version_id|archive_internal/i.test(text)) throw new Error('Private source metadata leaked into public manifest');
  if (manifest.kits.length !== 54 || new Set(manifest.kits.map(kit => kit.id)).size !== 54 || manifest.parts.length !== 324 || new Set(manifest.parts.map(part => part.id)).size !== 324) throw new Error('Expected exactly54 kits and324 unique parts');
  if (!allowLoose && ['parts', 'textures'].some(directory => publicFiles(`public/models/food-karts/${directory}`).length)) throw new Error('Loose public food parts/textures must be removed after bundle verification');
  const expectedBundles = new Set(manifest.kits.filter(kit => manifest.parts.some(part => part.kitId === kit.id && part.available)).map(kit => `public/${kit.bundlePath}`));
  for (const path of publicFiles('public/models/food-karts/bundles')) if (!expectedBundles.has(path)) throw new Error(`Unexpected public food bundle ${path}`);
  for (const kit of manifest.kits) expectedBundleEntries(manifest, kit);
  verifyThumbnails(manifest);
  let verified = 0, triangles = 0, primitives = 0, originalBytes = 0, packedBytes = 0;
  const textures = new Map(), perKit = new Map(), perSlot = new Map();
  for (const part of manifest.parts) {
    validatePartPath(part);
    if (!part.available) { if (!allowPartial) throw new Error(`Missing canonical asset ${part.id}`); continue; }
    const data = reconstructFoodKartPart(manifest, part);
    if (data.length < 20 || data.readUInt32LE(0) !== 0x46546c67 || data.readUInt32LE(4) !== 2 || data.readUInt32LE(8) !== data.length || data.readUInt32LE(16) !== 0x4e4f534a || 20 + data.readUInt32LE(12) > data.length) throw new Error('GLB header');
    const jsonText = data.subarray(20, 20 + data.readUInt32LE(12)).toString();
    if (/libfile_|\/workspace\/|\/home\/agent|\.openai|sediment:\/\//i.test(jsonText)) throw new Error('Private metadata in original GLB: ' + part.id);
    const doc = JSON.parse(jsonText);
    for (const resource of [...(doc.buffers || []), ...(doc.images || [])]) if (resource.uri && !resource.uri.startsWith('data:')) throw new Error(`External model dependency ${part.id}`);
    const roots = doc.scenes[doc.scene || 0].nodes;
    if (roots.length !== 1 || doc.nodes[roots[0]].name !== part.moduleId) throw new Error(`Module identity ${part.id}`);
    const root = doc.nodes[roots[0]];
    for (const [field, identity] of [['translation', [0, 0, 0]], ['rotation', [0, 0, 0, 1]], ['scale', [1, 1, 1]]]) if (root[field] && JSON.stringify(root[field]) !== JSON.stringify(identity)) throw new Error(`Changed root ${part.id}`);
    let pt = 0, pp = 0;
    for (const mesh of doc.meshes) for (const primitive of mesh.primitives) { pp++; pt += doc.accessors[primitive.indices].count / 3; }
    if (pt !== part.triangles || pp !== part.materialPrimitives) throw new Error(`Budget count ${part.id}`);
    for (const [name, position] of Object.entries(part.anchors)) {
      const node = doc.nodes.find(node => node.name === name);
      if (!node || position.some((value, i) => Math.abs(value - (node.translation?.[i] || 0)) > 1e-6)) throw new Error(`Anchor mismatch ${part.id} ${name}`);
    }
    if (!manifest.thumbnailIndex && part.thumbnail && (!part.thumbnail.startsWith(`models/food-karts/thumbs/${part.kitId}/`) || part.thumbnail.includes('..') || !existsSync(`public/${part.thumbnail}`))) throw new Error(`Missing or unsafe thumbnail ${part.id}`);
    triangles += pt; primitives += pp; originalBytes += data.length; packedBytes += part.bytes; verified++;
    if (!perKit.has(part.kitId)) {
      const bundle = loadBundle(manifest, part.kitId);
      perKit.set(part.kitId, { id: part.kitId, parts: 0, triangles: 0, materialPrimitives: 0, packedGeometryBytes: 0, originalBytes: 0, bundleBytes: bundle.bytes, unbundledLogicalBytes: bundle.logicalBytes, zipOverheadBytes: bundle.bytes - bundle.logicalBytes, images: new Map(), repeatedImagePixels: 0 });
    }
    const kit = perKit.get(part.kitId); kit.parts++; kit.triangles += pt; kit.materialPrimitives += pp; kit.packedGeometryBytes += part.bytes; kit.originalBytes += data.length;
    for (const image of part.images) {
      const previous = textures.get(image.path);
      if (previous && (previous.bytes !== image.bytes || previous.width !== image.width || previous.height !== image.height)) throw new Error(`Inconsistent global image ${image.path}`);
      textures.set(image.path, image); kit.images.set(image.path, image); kit.repeatedImagePixels += image.width * image.height;
    }
    if (!perSlot.has(part.slot)) perSlot.set(part.slot, []);
    perSlot.get(part.slot).push({ triangles: pt, materialPrimitives: pp, packedBytes: part.bytes });
  }
  const kits = [...perKit.values()].map(({ images, ...kit }) => ({ ...kit, uniqueImages: images.size, sharedImageBytes: [...images.values()].reduce((n, image) => n + image.bytes, 0), estimatedRgba8MipsBytesWithoutGpuDedup: Math.ceil(kit.repeatedImagePixels * 4 * 4 / 3), estimatedRgba8MipsBytesWithGpuDedup: Math.ceil([...images.values()].reduce((n, image) => n + image.width * image.height, 0) * 4 * 4 / 3) }));
  const summary = { verifiedParts: verified, expectedParts: 324, allComplete: verified === 324, triangles, materialPrimitives: primitives, originalBytes, packedBytes, uniqueTextures: textures.size, sharedTextureBytes: [...textures.values()].reduce((n, image) => n + image.bytes, 0), maxAssembledTriangles: Math.max(0, ...kits.map(kit => kit.triangles)), maxAssembledMaterialPrimitives: Math.max(0, ...kits.map(kit => kit.materialPrimitives)), maxMixedTriangles: [...perSlot.values()].reduce((n, parts) => n + Math.max(...parts.map(part => part.triangles)), 0), maxMixedMaterialPrimitives: [...perSlot.values()].reduce((n, parts) => n + Math.max(...parts.map(part => part.materialPrimitives)), 0), kits };
  summary.bundleCount = kits.length;
  summary.maxBundleBytes = Math.max(0, ...kits.map(kit => kit.bundleBytes));
  summary.unbundledDeliveryBytes = summary.packedBytes + summary.sharedTextureBytes;
  summary.unbundledLogicalBytes = kits.reduce((sum, kit) => sum + kit.unbundledLogicalBytes, 0);
  summary.crossKitDuplicateTextureBytes = summary.unbundledLogicalBytes - summary.unbundledDeliveryBytes;
  summary.deliveryBytes = kits.reduce((sum, kit) => sum + kit.bundleBytes, 0);
  summary.zipOverheadBytes = summary.deliveryBytes - summary.unbundledLogicalBytes;
  const totals = { availableParts: verified, originalBytes, packedGeometryBytes: packedBytes, uniqueImages: textures.size, sharedImageBytes: summary.sharedTextureBytes, triangles, materialPrimitives: primitives, deliveryBytes: summary.deliveryBytes, unbundledDeliveryBytes: summary.unbundledDeliveryBytes, bundleCount: summary.bundleCount, maxBundleBytes: summary.maxBundleBytes };
  for (const [field, value] of Object.entries(totals)) if (manifest.totals[field] !== undefined && manifest.totals[field] !== value) throw new Error(`Delivery budget mismatch: ${field}`);
  if (manifest.totals.deliveryBytes !== summary.deliveryBytes) throw new Error('Delivery budget mismatch');
  currentBundle = undefined;
  return summary;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) console.log(JSON.stringify(verifyFoodKartAssets({ allowPartial: process.argv.includes('--allow-partial'), allowLoose: process.argv.includes('--allow-loose') }), null, 2));
