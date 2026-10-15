import {validateManifest} from '../scripts/compose-dev-pages.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {STABLE_PAGES_V100_REPIN_BASELINE_TREE, STABLE_PAGES_V100_REPIN_REVIEW_PATH, stablePagesV100RepinSha as sha, stablePagesV100RepinReview, assertStablePagesV100RepinReviewBytes, stablePagesV100RepinHash, restoreStablePagesV100RepinBytes, stablePagesV100RepinAddedPaths} from './helpers/stable-pages-v100-repin-reviewed-revisions';
const read = (path: string) => readFileSync(path, 'utf8');
const review = stablePagesV100RepinReview();
const baselinePaths = [...Object.keys(review.protectedFiles), ...Object.keys(review.changes)];
const walk = (dir: string): string[] => readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? walk(dir + '/' + entry.name) : [dir + '/' + entry.name]);
function baselineGitTree() {
  type Tree = {[name: string]: Tree | Buffer};
  const root: Tree = {};
  const object = (kind: string, bytes: Buffer) => createHash('sha1').update(kind + ' ' + bytes.length + '\0').update(bytes).digest();
  for (const path of baselinePaths) {
    const bytes = Object.hasOwn(review.changes, path) ? Buffer.from(restoreStablePagesV100RepinBytes(path, read(path))) : readFileSync(path);
    const parts = path.split('/'); let dir = root;
    for (const part of parts.slice(0, -1)) dir = (dir[part] ??= {}) as Tree;
    dir[parts.at(-1)!] = object('blob', bytes);
  }
  const encode = (tree: Tree): Buffer => object('tree', Buffer.concat(Object.entries(tree)
    .sort(([a, x], [b, y]) => Buffer.compare(Buffer.from(a + (Buffer.isBuffer(x) ? '' : '/')), Buffer.from(b + (Buffer.isBuffer(y) ? '' : '/'))))
    .map(([name, item]) => Buffer.concat([Buffer.from((Buffer.isBuffer(item) ? '100644' : '40000') + ' ' + name + '\0'), Buffer.isBuffer(item) ? item : encode(item)]))));
  return encode(root).toString('hex');
}
test('v1.0 publication repin reconstructs the complete certified stable endpoint and exact file inventory', () => {
  assert.equal(baselineGitTree(), STABLE_PAGES_V100_REPIN_BASELINE_TREE);
  assert.deepEqual(readdirSync('.', {withFileTypes: true}).filter(entry => entry.isFile()).map(entry => entry.name).sort(), baselinePaths.filter(path => !path.includes('/')).sort(), 'Exact root-level source inventory');
  for (const dir of ['.github', 'docs', 'models', 'public', 'scripts', 'src', 'tests']) {
    assert.deepEqual(walk(dir).sort(), [...baselinePaths, ...stablePagesV100RepinAddedPaths()].filter(path => path.startsWith(dir + '/')).sort());
  }
  for (const [path, hash] of Object.entries(review.protectedFiles)) assert.equal(sha(readFileSync(path)), hash, path + ' exact protected byte identity');
  for (const [path, row] of Object.entries(review.additions)) assert.equal(sha(readFileSync(path)), row.sha256, path + ' exact explicitly added bytes');
});
test('each publication repin change has exact reversible hunks with negative mutation and identity tests', () => {
  for (const [path, row] of Object.entries(review.changes)) {
    const current = read(path), previous = restoreStablePagesV100RepinBytes(path, current);
    assert.equal(sha(previous), row.previousSha256);
    const lines = previous.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    for (const hunk of [...row.hunks].reverse()) {
      assert.deepEqual(lines.slice(hunk.beforeStart, hunk.beforeStart + hunk.removedLines.length), hunk.removedLines);
      lines.splice(hunk.beforeStart, hunk.removedLines.length, ...hunk.insertedLines);
    }
    assert.equal(lines.join(''), current);
    assert.equal(stablePagesV100RepinHash(path, row.previousSha256), row.currentSha256);
    for (const altered of [current + ' ', current.slice(1), previous]) assert.throws(() => restoreStablePagesV100RepinBytes(path, altered));
    for (const incoming of [undefined, '', '0'.repeat(64), row.currentSha256]) assert.throws(() => stablePagesV100RepinHash(path, incoming));
    for (const alias of ['./' + path, path + '/extra', path.replace('/', '//')].filter(alias => alias !== path)) {
      assert.equal(stablePagesV100RepinHash(alias, row.previousSha256), row.previousSha256);
      assert.equal(restoreStablePagesV100RepinBytes(alias, 'unreviewed'), 'unreviewed');
    }
  }
  assert.throws(() => assertStablePagesV100RepinReviewBytes(read(STABLE_PAGES_V100_REPIN_REVIEW_PATH) + ' '));
  for (const mutate of [
    (copy: typeof review) => { copy.baselineTree = '0'.repeat(40); },
    (copy: typeof review) => { copy.currentPublication.artifactId = 1; },
    (copy: typeof review) => { copy.publicationEvidence.fullArtifactArchiveDownloaded = true; },
    (copy: typeof review) => { copy.publicationEvidence.liveRootEvidenceSha256 = '0'.repeat(64); },
    (copy: typeof review) => { Object.values(copy.changes)[0].hunks[0].insertedLines.push('unreviewed\n'); },
    (copy: typeof review) => { delete copy.protectedFiles['tests/helpers/v100-transition.json']; },
  ]) { const copy = structuredClone(review); mutate(copy); assert.throws(() => assertStablePagesV100RepinReviewBytes(JSON.stringify(copy))); }
});

test('repin changes only the manifest and exact TypeScript audit bridges', () => {
  assert.deepEqual(Object.keys(review.changes).filter(path => !path.startsWith('tests/')), ['docs/stable-pages-manifest.json']);
  for (const path of Object.keys(review.changes)) assert.ok(path === 'docs/stable-pages-manifest.json' || (path.startsWith('tests/') && path.endsWith('.ts')));
  for (const path of baselinePaths.filter(path => path.endsWith('.json') && path !== 'docs/stable-pages-manifest.json')) assert.ok(Object.hasOwn(review.protectedFiles, path), path + ' every historical JSON frozen');
  const manifest = validateManifest(JSON.parse(read('docs/stable-pages-manifest.json')));
  const {files, ...metadata} = manifest;
  assert.deepEqual(metadata, review.currentPublication);
  assert.equal(manifest.stableCommit, 'b665343da013f5cfec0a0f45797adcd347f9607b');
  assert.deepEqual(files.map((row: {path: string}) => row.path), files.map((row: {path: string}) => row.path).sort());
  const previous = JSON.parse(restoreStablePagesV100RepinBytes('docs/stable-pages-manifest.json', read('docs/stable-pages-manifest.json')));
  const {files: previousFiles, ...previousMetadata} = previous;
  assert.deepEqual(previousMetadata, review.previousPublication);
  assert.equal(previousFiles.length, 219);
  assert.equal(files.reduce((total: number, row: {bytes: number}) => total + row.bytes, 0), 358859213);
  assert.equal(files.length, 219);
  assert.equal(files.length, new Set(files.map((row: {path: string}) => row.path)).size);
  assert.equal(files.find((row: {path: string}) => row.path === 'source.zip').sha256, 'cdc3541e728eb72c8655c7d7b36c9ce6ed6daf11febdca8e3ac3906de27b7153');
});
