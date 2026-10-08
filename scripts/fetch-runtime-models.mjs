// Optional retrieval of separately served, manifest-verified character archives.
// It never uploads data and never reads user-selected local model files.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import drivers from '../docs/runtime-models.json' with { type: 'json' };
import portraits from '../docs/portrait-models.json' with { type: 'json' };

// This source belongs to the isolated dev preview. The preserved stable site
// intentionally does not contain these new standing-portrait archives.
const base = new URL('https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/');
const ids = ['whale', 'gemini', 'gpt', 'claude', 'grok', 'glm'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const collections = [{manifest: drivers, directory: 'drivers', suffix: 'driver'}, {manifest: portraits, directory: 'portraits', suffix: 'portrait'}];
const records = collections.flatMap(({manifest, directory, suffix}) => {
  if (!Array.isArray(manifest.assets) || manifest.assets.length !== ids.length || new Set(manifest.assets.map(record => record.id)).size !== ids.length) throw new Error(`Invalid ${directory} model manifest`);
  return manifest.assets.map(record => {
    if (!ids.includes(record.id) || record.path !== `assets/${directory}/${record.id}-${suffix}.glb.gz`) throw new Error('Unrecognized public model path');
    for (const field of ['sha256', 'decodedSha256']) if (!/^[a-f0-9]{64}$/.test(record[field])) throw new Error(`Invalid ${directory} checksum`);
    for (const field of ['bytes', 'decodedBytes']) if (!Number.isSafeInteger(record[field]) || record[field] <= 0 || record[field] > 32 * 1024 * 1024) throw new Error(`Invalid ${directory} byte limit`);
    return record;
  });
});
const valid = (bytes, record) => {
  if (bytes.length !== record.bytes || hash(bytes) !== record.sha256) return false;
  try { const decoded = gunzipSync(bytes, {maxOutputLength: 32 * 1024 * 1024}); return decoded.length === record.decodedBytes && hash(decoded) === record.decodedSha256; } catch { return false; }
};
let next = 0;
async function worker() {
  while (next < records.length) {
    const record = records[next++], target = `public/${record.path}`;
    if (existsSync(target)) {
      if (valid(readFileSync(target), record)) { console.log(`Already verified: ${record.path}`); continue; }
      throw new Error(`Existing ${target} differs from the manifest; it was not overwritten`);
    }
    const response = await fetch(new URL(record.path, base), {redirect: 'error', headers: {'Accept-Encoding': 'identity'}, signal: AbortSignal.timeout(120000)});
    if (!response.ok) throw new Error(`${record.path}: HTTP ${response.status}; the authorized public dev preview may not yet be deployed`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!valid(bytes, record)) throw new Error(`${record.path}: public archive checksum or size mismatch (server may have transformed the gzip; use a full repository clone)`);
    mkdirSync(dirname(target), {recursive: true});
    writeFileSync(target, bytes, {flag: 'wx'});
    console.log(`Verified character archive: ${record.path}`);
  }
}
await Promise.all([worker(), worker()]);
