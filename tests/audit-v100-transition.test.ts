import {restorePostV100Buffer} from './helpers/post-v100-current';
import {STABLE_PAGES_V100_REPIN_REVIEW_PATH, stablePagesV100RepinReview, stablePagesV100RepinHash, restoreStablePagesV100RepinBytes} from './helpers/stable-pages-v100-repin-reviewed-revisions';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {V100_BASELINE_TREE, V100_REVIEW_PATH, v100Sha as sha, v100Review, assertV100ReviewBytes, v100Hash, restoreV100Bytes, v100AddedPaths} from './helpers/v100-reviewed-revisions';
const read = (path: string) => readFileSync(path, 'utf8');
const review = v100Review();
const baselinePaths = [...Object.keys(review.protectedFiles), ...Object.keys(review.changes)];
const walk = (dir: string): string[] => readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? walk(dir + '/' + entry.name) : [dir + '/' + entry.name]);
function baselineGitTree() {
  type Tree = {[name: string]: Tree | Buffer};
  const root: Tree = {};
  const object = (kind: string, bytes: Buffer) => createHash('sha1').update(kind + ' ' + bytes.length + '\0').update(bytes).digest();
  for (const path of baselinePaths) {
    const bytes = (Object.hasOwn(review.changes, path) || Object.hasOwn(stablePagesV100RepinReview().changes, path)) ? Buffer.from(restoreV100Bytes(path, read(path))) : restorePostV100Buffer(path,readFileSync(path));
    const parts = path.split('/'); let dir = root;
    for (const part of parts.slice(0, -1)) dir = (dir[part] ??= {}) as Tree;
    dir[parts.at(-1)!] = object('blob', bytes);
  }
  const encode = (tree: Tree): Buffer => object('tree', Buffer.concat(Object.entries(tree)
    .sort(([a, x], [b, y]) => Buffer.compare(Buffer.from(a + (Buffer.isBuffer(x) ? '' : '/')), Buffer.from(b + (Buffer.isBuffer(y) ? '' : '/'))))
    .map(([name, item]) => Buffer.concat([Buffer.from((Buffer.isBuffer(item) ? '100644' : '40000') + ' ' + name + '\0'), Buffer.isBuffer(item) ? item : encode(item)]))));
  return encode(root).toString('hex');
}
test('v1.0 reconstructs the complete pre-feature audit endpoint and exact file inventory', () => {
  assert.equal(baselineGitTree(), V100_BASELINE_TREE);
  for (const dir of ['.github', 'docs', 'models', 'public', 'scripts', 'src', 'tests']) {
    assert.deepEqual(walk(dir).sort(), [...baselinePaths, ...v100AddedPaths()].filter(path => path.startsWith(dir + '/')).sort());
  }
  for (const [path, hash] of Object.entries(review.protectedFiles)) assert.equal(sha(readFileSync(path)), stablePagesV100RepinHash(path, hash), path + ' exact protected byte identity');
  for (const [path, row] of Object.entries(review.additions)) assert.equal(sha(readFileSync(path)), stablePagesV100RepinHash(path, row.sha256), path + ' exact explicitly added bytes');
});
test('each v1.0 change has exact reversible hunks with negative mutation and identity tests', () => {
  for (const [path, row] of Object.entries(review.changes)) {
    const raw = read(path), current = restoreStablePagesV100RepinBytes(path, raw), previous = restoreV100Bytes(path, raw);
    assert.equal(sha(previous), row.previousSha256);
    const lines = previous.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    for (const hunk of [...row.hunks].reverse()) {
      assert.deepEqual(lines.slice(hunk.beforeStart, hunk.beforeStart + hunk.removedLines.length), hunk.removedLines);
      lines.splice(hunk.beforeStart, hunk.removedLines.length, ...hunk.insertedLines);
    }
    assert.equal(lines.join(''), current);
    assert.equal(v100Hash(path, row.previousSha256), stablePagesV100RepinHash(path, row.currentSha256));
    for (const altered of [raw + ' ', raw.slice(1), previous]) assert.throws(() => restoreV100Bytes(path, altered));
    for (const incoming of [undefined, '', '0'.repeat(64), row.currentSha256]) assert.throws(() => v100Hash(path, incoming));
    for (const alias of ['./' + path, path + '/extra', path.replace('/', '//')].filter(alias => alias !== path)) {
      assert.equal(v100Hash(alias, row.previousSha256), row.previousSha256);
      assert.equal(restoreV100Bytes(alias, 'unreviewed'), 'unreviewed');
    }
  }
  assert.throws(() => assertV100ReviewBytes(read(V100_REVIEW_PATH) + ' '));
  for (const mutate of [
    (copy: typeof review) => { copy.baselineTree = '0'.repeat(40); },
    (copy: typeof review) => { Object.values(copy.changes)[0].hunks[0].insertedLines.push('unreviewed\n'); },
    (copy: typeof review) => { delete copy.protectedFiles['docs/stable-pages-manifest.json']; },
  ]) { const copy = structuredClone(review); mutate(copy); assert.throws(() => assertV100ReviewBytes(JSON.stringify(copy))); }
});
