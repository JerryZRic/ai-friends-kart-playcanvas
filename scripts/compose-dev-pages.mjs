// Preserve the exact deployed stable site while adding an isolated /dev/ build.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const canonicalBase = 'https://jerryzric.github.io/ai-friends-kart-playcanvas/';
const requiredFiles = ['index.html', 'waterpark.html', 'waterpark-study.html', 'source.html', 'source.zip', 'LICENSE', 'NOTICE', 'MODEL-NOTICE.txt', 'THIRD-PARTY-NOTICES.txt', 'SOURCE.txt'];
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function validateManifest(manifest) {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.repository, 'JerryZRic/ai-friends-kart-playcanvas');
  assert.equal(manifest.baseUrl, canonicalBase);
  assert.match(manifest.stableCommit, /^[0-9a-f]{40}$/);
  assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0);
  const paths = new Set();
  for (const record of manifest.files) {
    assert.match(record.path, /^[A-Za-z0-9_.\/-]+$/);
    const parts = record.path.split('/');
    assert.ok(parts.every(part => part && part !== '.' && part !== '..'));
    assert.ok(!parts.some(part => part.startsWith('.')));
    assert.notEqual(parts[0], 'dev', 'Stable inventory cannot contain a dev preview');
    assert.ok(!paths.has(record.path), `Duplicate stable path: ${record.path}`);
    paths.add(record.path);
    assert.match(record.sha256, /^[0-9a-f]{64}$/);
    assert.ok(Number.isSafeInteger(record.bytes) && record.bytes >= 0 && record.bytes <= 100 * 1024 * 1024);
  }
  for (const path of requiredFiles) assert.ok(paths.has(path), `Missing stable entry: ${path}`);
  assert.ok(manifest.files.reduce((sum, file) => sum + file.bytes, 0) <= 300 * 1024 * 1024);
  return manifest;
}

export async function inventory(directory, prefix = '') {
  const result = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    assert.ok(!entry.isSymbolicLink(), `Published symlink: ${prefix}${entry.name}`);
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await inventory(path, prefix + entry.name + '/'));
    else {
      assert.ok(entry.isFile(), `Non-file publication entry: ${path}`);
      result.push(prefix + entry.name);
    }
  }
  return result.sort();
}

export function verifyBytes(record, bytes) {
  assert.equal(bytes.length, record.bytes, `Stable size changed: ${record.path}`);
  assert.equal(sha256(bytes), record.sha256, `Stable SHA-256 changed: ${record.path}`);
}

export async function fetchStableFile(record, fetchImpl = fetch) {
  const response = await fetchImpl(new URL(record.path, canonicalBase), {
    redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(60000),
  });
  assert.ok(response.ok, `Cannot preserve stable file ${record.path}: HTTP ${response.status}`);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    assert.ok(size <= record.bytes, `Oversized stable response: ${record.path}`);
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  verifyBytes(record, bytes);
  return bytes;
}

export async function restoreStable(manifest, output, fetchImpl = fetch) {
  validateManifest(manifest);
  let next = 0;
  const outcomes = await Promise.allSettled(Array.from({ length: 4 }, async () => {
    while (next < manifest.files.length) {
      const record = manifest.files[next++];
      const bytes = await fetchStableFile(record, fetchImpl);
      if (output) {
        const target = join(output, record.path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, bytes);
      }
    }
  }));
  const failure = outcomes.find(outcome => outcome.status === 'rejected');
  if (failure) throw failure.reason;
}

export async function verifyStableRoot(manifest, directory) {
  validateManifest(manifest);
  assert.deepEqual((await inventory(directory)).filter(path => !path.startsWith('dev/')), manifest.files.map(file => file.path).sort(), 'Stable inventory changed');
  for (const record of manifest.files) verifyBytes(record, await readFile(join(directory, record.path)));
}

export async function composeDevPages({ manifest, devDirectory = 'dist', output = 'dist-pages', fetchImpl = fetch }) {
  validateManifest(manifest);
  const source = resolve(devDirectory), target = resolve(output);
  assert.ok(relative(source, target).startsWith('..') && relative(target, source).startsWith('..'), 'Build and output directories must be separate');
  assert.equal(await lstat(target).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; }), false, 'Output already exists; use a fresh output directory');
  const devFiles = await inventory(source);
  for (const path of requiredFiles) assert.ok(devFiles.includes(path), `Missing dev entry: ${path}`);
  assert.ok(!devFiles.some(path => path.startsWith('dev/')), 'Dev build contains a nested preview');
  await mkdir(target, { recursive: true });
  try {
    await restoreStable(manifest, target, fetchImpl);
    await cp(source, join(target, 'dev'), { recursive: true, errorOnExist: true });
    await verifyStableRoot(manifest, target);
    assert.deepEqual(await inventory(join(target, 'dev')), devFiles);
    for (const path of devFiles) assert.equal(sha256(await readFile(join(target, 'dev', path))), sha256(await readFile(join(source, path))), `Dev copy changed: ${path}`);
    return { stableCommit: manifest.stableCommit, stableFiles: manifest.files.length, devFiles: devFiles.length, previewPath: 'dev/' };
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const mode = args[0] || 'compose';
  assert.ok(['compose', 'verify-live', 'verify-output'].includes(mode), 'Use compose, verify-live or verify-output');
  const manifest = validateManifest(JSON.parse(await readFile('docs/stable-pages-manifest.json', 'utf8')));
  if (mode === 'verify-live') {
    await restoreStable(manifest);
    console.log(`Verified ${manifest.files.length} exact stable files for ${manifest.stableCommit}.`);
  } else if (mode === 'verify-output') {
    await verifyStableRoot(manifest, args[1] || 'dist-pages');
    console.log('Stable publication root is byte-identical to its deployed artifact.');
  } else {
    console.log(JSON.stringify(await composeDevPages({ manifest, devDirectory: args[1] || 'dist', output: args[2] || 'dist-pages' }), null, 2));
  }
}
