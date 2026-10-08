import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { composeDevPages, fetchStableFile, inventory, sha256, validateManifest, verifyStableRoot } from '../scripts/compose-dev-pages.mjs';

const paths = ['index.html', 'waterpark.html', 'waterpark-study.html', 'source.html', 'source.zip', 'LICENSE', 'NOTICE', 'MODEL-NOTICE.txt', 'THIRD-PARTY-NOTICES.txt', 'SOURCE.txt', 'assets/app-stable.js'];
const bodies = new Map(paths.map(path => [path, Buffer.from('exact stable ' + path)]));
const manifest = {
  schemaVersion: 1, repository: 'JerryZRic/ai-friends-kart-playcanvas',
  baseUrl: 'https://jerryzric.github.io/ai-friends-kart-playcanvas/', stableCommit: 'a'.repeat(40),
  files: paths.map(path => ({ path, bytes: bodies.get(path).length, sha256: sha256(bodies.get(path)) })),
};
const clone = () => structuredClone(manifest);
function mockFetch(overrides = new Map()) {
  return async (url, options) => {
    assert.equal(url.origin, 'https://jerryzric.github.io');
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    const path = url.pathname.slice('/ai-friends-kart-playcanvas/'.length);
    assert.notEqual(path, '.nojekyll');
    assert.ok(bodies.has(path));
    return new Response(overrides.get(path) ?? bodies.get(path));
  };
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'dev-pages-test-'));
  const devDirectory = join(root, 'dist');
  await mkdir(join(devDirectory, 'assets'), { recursive: true });
  for (const path of paths) await writeFile(join(devDirectory, path), 'new dev ' + path);
  return { root, devDirectory, output: join(root, 'output') };
}

test('stable manifest pins every published path and rejects traversal, collisions and wrong destinations', () => {
  assert.equal(validateManifest(manifest), manifest);
  for (const path of ['../escape', '/absolute', 'assets/../../escape', 'dev/index.html', 'assets\\escape', 'assets//escape', 'assets/x?token=y', '.git/config']) {
    const value = clone(); value.files[0].path = path;
    assert.throws(() => validateManifest(value), undefined, path);
  }
  const duplicate = clone(); duplicate.files.push(duplicate.files[0]); assert.throws(() => validateManifest(duplicate));
  const foreign = clone(); foreign.baseUrl = 'https://example.com/'; assert.throws(() => validateManifest(foreign));
  const badHash = clone(); badHash.files[0].sha256 = 'no'; assert.throws(() => validateManifest(badHash));
  const missing = clone(); missing.files = missing.files.filter(file => file.path !== 'source.zip'); assert.throws(() => validateManifest(missing));
});

test('composition preserves all stable bytes and copies dev only under its own subdirectory', async () => {
  const context = await fixture();
  try {
    const result = await composeDevPages({ ...context, manifest, fetchImpl: mockFetch() });
    assert.equal(result.stableFiles, paths.length);
    await verifyStableRoot(manifest, context.output);
    assert.deepEqual(await inventory(join(context.output, 'dev')), paths.sort());
    assert.equal((await readFile(join(context.output, 'index.html'))).toString(), 'exact stable index.html');
    assert.equal((await readFile(join(context.output, 'dev/index.html'))).toString(), 'new dev index.html');
    await assert.rejects(composeDevPages({ ...context, manifest, fetchImpl: mockFetch() }), /already exists/);
  } finally { await rm(context.root, { recursive: true, force: true }); }
});

test('remote hash, size, HTTP, and local extra-file changes fail closed', async () => {
  const record = manifest.files.find(file => file.path === 'index.html');
  await assert.rejects(fetchStableFile(record, mockFetch(new Map([['index.html', Buffer.alloc(record.bytes, 65)]]))), /SHA-256/);
  await assert.rejects(fetchStableFile(record, mockFetch(new Map([['index.html', Buffer.alloc(record.bytes + 1)]]))), /Oversized/);
  await assert.rejects(fetchStableFile(record, async () => new Response('not found', { status: 404 })), /HTTP 404/);
  const context = await fixture();
  try {
    await composeDevPages({ ...context, manifest, fetchImpl: mockFetch() });
    await writeFile(join(context.output, 'unexpected.txt'), 'unapproved');
    await assert.rejects(verifyStableRoot(manifest, context.output), /inventory changed/);
  } finally { await rm(context.root, { recursive: true, force: true }); }
});

test('a failed stable download removes the incomplete output before publication', async () => {
  const context = await fixture();
  try {
    await assert.rejects(composeDevPages({ ...context, manifest, fetchImpl: mockFetch(new Map([['index.html', Buffer.from('bad')]])) }), /size changed/);
    await assert.rejects(inventory(context.output), /ENOENT/);
  } finally { await rm(context.root, { recursive: true, force: true }); }
});

test('composition rejects symlinks and overlapping output before writing', async () => {
  const context = await fixture();
  try {
    await assert.rejects(composeDevPages({ ...context, manifest, output: join(context.devDirectory, 'output'), fetchImpl: mockFetch() }), /must be separate/);
    await symlink('index.html', join(context.devDirectory, 'link.html'));
    await assert.rejects(composeDevPages({ ...context, manifest, fetchImpl: mockFetch() }), /symlink/);
  } finally { await rm(context.root, { recursive: true, force: true }); }
});

test('dev-only workflow shares stable concurrency and never uploads the dev build as the root', async () => {
  const workflow = await readFile('.github/workflows/pages.yml', 'utf8');
  assert.match(workflow, /branches: \[dev\]/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/dev'/);
  assert.match(workflow, /group: github-pages/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /path: dist-pages\s/);
  assert.match(workflow, /node scripts\/compose-dev-pages\.mjs/);
  assert.equal((workflow.match(/git ls-remote origin refs\/heads\/main/g) || []).length, 2);
  assert.doesNotMatch(workflow, /preview: true|contents: write|windows-latest/);
});
