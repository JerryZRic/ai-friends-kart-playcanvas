// Optional retrieval of the six separately served public runtime model files.
// It never uploads any data and never reads user-selected local model files.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import manifest from '../docs/runtime-models.json' with { type: 'json' };

const base = new URL('https://jerryzric.github.io/ai-friends-kart-playcanvas/');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const valid = (bytes, record) => {
  if (bytes.length !== record.bytes || hash(bytes) !== record.sha256) return false;
  try { const decoded=gunzipSync(bytes,{maxOutputLength:32*1024*1024}); return decoded.length===record.decodedBytes&&hash(decoded)===record.decodedSha256; } catch { return false; }
};
let next = 0;
async function worker() {
  while (next < manifest.assets.length) {
    const record = manifest.assets[next++];
    if (!/^assets\/drivers\/(whale|gemini|gpt|claude|grok|glm)-driver\.glb\.gz$/.test(record.path)) throw new Error('Unrecognized public model path');
    const target = `public/${record.path}`;
    if (existsSync(target)) {
      if (valid(readFileSync(target), record)) { console.log(`Already verified: ${record.id}`); continue; }
      throw new Error(`Existing ${target} differs from the manifest; it was not overwritten`);
    }
    const response = await fetch(new URL(record.path, base), { redirect: 'error', headers: { 'Accept-Encoding': 'identity' }, signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`${record.id}: HTTP ${response.status}; the authorized public demo may not yet be deployed`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!valid(bytes, record)) throw new Error(`${record.id}: public archive checksum or size mismatch (server may have transformed the gzip; use a full repository clone)`);
    mkdirSync('public/assets/drivers', { recursive: true });
    writeFileSync(target, bytes, { flag: 'wx' });
    console.log(`Verified runtime model: ${record.id}`);
  }
}
await Promise.all([worker(), worker()]);
