// Build-time gate for separately distributed model archives. The source-only
// ZIP may omit all six; any partial or unexpected runtime directory is an error.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import manifest from '../docs/runtime-models.json' with { type: 'json' };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function verifyRuntimeAssets() {
  const directory = 'dist/assets/drivers';
  if (!existsSync(directory)) return { runtimeModels: 0, sourceOnly: true };
  const files = readdirSync(directory).sort();
  if (!files.length) return { runtimeModels: 0, sourceOnly: true };
  const expected = manifest.assets.map(record => record.path.split('/').at(-1)).sort();
  if (JSON.stringify(files) !== JSON.stringify(expected)) throw new Error('Runtime directory must contain exactly the six manifest gzip models, with no raw duplicates');
  for (const record of manifest.assets) {
    if (!/^assets\/drivers\/(whale|gemini|gpt|claude|grok|glm)-driver\.glb\.gz$/.test(record.path)) throw new Error('Unrecognized runtime model manifest path');
    const compressed = readFileSync(`dist/${record.path}`);
    if (compressed.length !== record.bytes || hash(compressed) !== record.sha256) throw new Error(`Runtime archive identity mismatch: ${record.id}`);
    const decoded = gunzipSync(compressed, { maxOutputLength: 32 * 1024 * 1024 });
    if (decoded.length !== record.decodedBytes || hash(decoded) !== record.decodedSha256) throw new Error(`Decoded model identity mismatch: ${record.id}`);
  }
  return { runtimeModels: manifest.assets.length, sourceOnly: false };
}
