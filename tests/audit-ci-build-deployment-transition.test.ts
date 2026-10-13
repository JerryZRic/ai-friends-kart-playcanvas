import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {
  CI_BUILD_DEPLOYMENT_BASELINE_COMMIT, CI_BUILD_DEPLOYMENT_BASELINE_TREE,
  CI_BUILD_DEPLOYMENT_REVIEW_PATH, CI_BUILD_DEPLOYMENT_REVIEW_SHA256,
  CI_BUILD_DEPLOYMENT_PRODUCTION_PATHS, CI_BUILD_DEPLOYMENT_BRIDGE_PATHS, CI_BUILD_DEPLOYMENT_ADDITIONS,
  ciBuildDeploymentSha as sha, ciBuildDeploymentReview, assertCiBuildDeploymentReviewBytes,
  ciBuildDeploymentHash, ciBuildDeploymentPathsWithin, restoreCiBuildDeploymentBytes,
  assertCiBuildDeploymentAddition, ciBuildDeploymentAddedPaths, ciBuildDeploymentAuditDependencies,
} from './helpers/ci-build-deployment-reviewed-revisions';
import {MUSIC_REVIEW_PATH, MUSIC_REVIEW_SHA256, musicReview, musicHash, restoreMusicBytes, musicAuditDependencies} from './helpers/music-reviewed-revisions';
import {airfieldReviewedHash} from './helpers/airfield-enrichment-reviewed-revisions';
import {gardenAuditHashes} from './helpers/garden-enrichment-source-stability';
import {airfieldAuditHashes} from './helpers/airfield-enrichment-source-stability';
const read = (path: string) => readFileSync(path, 'utf8');
const review = ciBuildDeploymentReview();
const walk = (dir: string): string[] => readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? walk(dir + '/' + entry.name) : [dir + '/' + entry.name]);
const baselinePaths = [...Object.keys(review.protectedFiles), ...Object.keys(review.changes)];

// Git's object encoding is computed directly from every reconstructed baseline byte.
// No Git checkout, remote response, mutable ref, or trusted old-hash substitution is used.
function baselineGitTree() {
  type Tree = {[name: string]: Tree | Buffer};
  const root: Tree = {};
  const object = (kind: string, bytes: Buffer) => createHash('sha1').update(kind + ' ' + bytes.length + '\0').update(bytes).digest();
  for (const path of baselinePaths) {
    const bytes = Object.hasOwn(review.changes, path) ? Buffer.from(restoreCiBuildDeploymentBytes(path, read(path))) : readFileSync(path);
    const parts = path.split('/'); let dir = root;
    for (const part of parts.slice(0, -1)) dir = (dir[part] ??= {}) as Tree;
    dir[parts.at(-1)!] = object('blob', bytes);
  }
  const encode = (tree: Tree): Buffer => object('tree', Buffer.concat(Object.entries(tree)
    .sort(([a, x], [b, y]) => Buffer.compare(Buffer.from(a + (Buffer.isBuffer(x) ? '' : '/')), Buffer.from(b + (Buffer.isBuffer(y) ? '' : '/'))))
    .map(([name, item]) => Buffer.concat([Buffer.from((Buffer.isBuffer(item) ? '100644' : '40000') + ' ' + name + '\0'), Buffer.isBuffer(item) ? item : encode(item)]))));
  return encode(root).toString('hex');
}

test('CI split pins and independently reconstructs the complete exact music-enabled dev baseline tree', () => {
  assert.equal(CI_BUILD_DEPLOYMENT_BASELINE_COMMIT, '10cbff39be7b5f1c7ffaaabec86719976314e9b6');
  assert.equal(CI_BUILD_DEPLOYMENT_BASELINE_TREE, 'e0875d0a32b57aa7688e9b861d810f22d21a95b2');
  assert.equal(sha(read(CI_BUILD_DEPLOYMENT_REVIEW_PATH)), CI_BUILD_DEPLOYMENT_REVIEW_SHA256);
  assert.equal(new Set(baselinePaths).size, 1004);
  assert.equal(baselineGitTree(), CI_BUILD_DEPLOYMENT_BASELINE_TREE, 'Every baseline file is reconstructed to the independently anchored exact Git tree');
  assert.deepEqual(Object.keys(review.changes), [...CI_BUILD_DEPLOYMENT_PRODUCTION_PATHS, ...CI_BUILD_DEPLOYMENT_BRIDGE_PATHS]);
  assert.deepEqual(Object.keys(review.additions), [...CI_BUILD_DEPLOYMENT_ADDITIONS]);
  for (const dir of ['.github', 'docs', 'models', 'public', 'scripts', 'tests']) {
    assert.deepEqual(walk(dir).sort(), [...baselinePaths, ...ciBuildDeploymentAddedPaths()].filter(path => path.startsWith(dir + '/')).sort(), dir + ' complete exact addition and baseline inventory');
  }
});

test('every CI revision is bounded, exactly reversible, and rejects historical, altered and wrong incoming identities', () => {
  for (const [path, row] of Object.entries(review.changes)) {
    const current = read(path), previous = restoreCiBuildDeploymentBytes(path, current);
    assert.equal(sha(current), row.currentSha256); assert.equal(sha(previous), row.previousSha256);
    const lines = previous.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    for (const hunk of [...row.hunks].reverse()) {
      assert.deepEqual(lines.slice(hunk.beforeStart, hunk.beforeStart + hunk.removedLines.length), hunk.removedLines, path + ' exact removed CI bytes');
      lines.splice(hunk.beforeStart, hunk.removedLines.length, ...hunk.insertedLines);
    }
    assert.equal(lines.join(''), current, path + ' exact forward round trip');
    assert.equal(ciBuildDeploymentHash(path, row.previousSha256), row.currentSha256);
    for (const altered of [current + ' ', current.slice(1), previous]) assert.throws(() => restoreCiBuildDeploymentBytes(path, altered), undefined, path);
    for (const incoming of [undefined, '', '0'.repeat(64), row.currentSha256]) assert.throws(() => ciBuildDeploymentHash(path, incoming), undefined, path);
    for (const alias of ['./' + path, path + '/extra', path.replace('/', '//')]) {
      assert.equal(ciBuildDeploymentHash(alias, row.previousSha256), row.previousSha256, alias + ' cannot claim a reviewed transition');
      assert.equal(restoreCiBuildDeploymentBytes(alias, 'unreviewed'), 'unreviewed', alias + ' cannot invoke an inverse');
    }
  }
  assert.deepEqual(ciBuildDeploymentPathsWithin({'.github/workflows/pages.yml': 'old', './.github/workflows/pages.yml': 'alias', 'src/game.ts': 'unchanged'}), ['.github/workflows/pages.yml']);
});

test('every new CI tool and regression test has exact named content and rejects aliases and altered bytes', () => {
  for (const [path, row] of Object.entries(review.additions)) {
    const bytes = readFileSync(path); assert.equal(sha(bytes), row.sha256); assertCiBuildDeploymentAddition(path, bytes);
    assert.throws(() => assertCiBuildDeploymentAddition(path, Buffer.concat([bytes, Buffer.from(' ')])));
    for (const alias of ['./' + path, path + '/extra', path.replace('/', '//')]) assert.throws(() => assertCiBuildDeploymentAddition(alias, bytes));
  }
  assert.throws(() => assertCiBuildDeploymentAddition('scripts/unreviewed.mjs', 'unreviewed'));
});

test('all frozen JSON, runtime, music, artwork, legal, main workflow and 219 stable files remain exactly pinned', () => {
  for (const [path, hash] of Object.entries(review.protectedFiles)) assert.equal(sha(readFileSync(path)), hash, path + ' immutable original bytes');
  for (const prefix of ['src/', 'public/', 'models/', 'docs/', 'tests/fixtures/']) {
    assert.ok(baselinePaths.filter(path => path.startsWith(prefix)).every(path => Object.hasOwn(review.protectedFiles, path)), prefix + ' no original source or asset revisions');
  }
  for (const path of ['.github/workflows/pages-stable.yml', 'docs/stable-pages-manifest.json', 'package.json', 'package-lock.json', 'scripts/package-source.mjs', 'scripts/verify-dist.mjs', 'LICENSE', 'NOTICE', 'MODEL-NOTICE.txt', 'FOOD-ASSET-NOTICE.txt', 'ALPINE-PROP-NOTICE.txt', 'THIRD-PARTY-NOTICES.txt', 'SOURCE.txt', 'public/source.html', MUSIC_REVIEW_PATH]) {
    assert.ok(Object.hasOwn(review.protectedFiles, path), path + ' explicitly immutable');
  }
  const baselineJson = baselinePaths.filter(path => path.endsWith('.json') && path.includes('/'));
  assert.ok(baselineJson.every(path => Object.hasOwn(review.protectedFiles, path)));
  assert.deepEqual(['docs', 'tests', 'models', 'public', 'src'].flatMap(walk).filter(path => path.endsWith('.json')).sort(), [...baselineJson, CI_BUILD_DEPLOYMENT_REVIEW_PATH].sort());
  assert.equal(sha(read(MUSIC_REVIEW_PATH)), MUSIC_REVIEW_SHA256, 'Original music proof is byte-for-byte frozen');
  const workflow = read('.github/workflows/pages.yml');
  assert.match(workflow, /- run: npm run build\n/);
  assert.doesNotMatch(workflow, /npm test|test:dist|test-dev-preview/);
  assert.equal(JSON.parse(read('package.json')).scripts.build, 'npm run check && vite build && node scripts/package-source.mjs', 'Dev compiles and packages source without test gates');
  const stable = JSON.parse(read('docs/stable-pages-manifest.json'));
  assert.equal(stable.stableCommit, '16dd2d0540e300de6e85aa816e73ed94d4e796c0');
  assert.equal(stable.files.length, 219); assert.equal(new Set(stable.files.map((row: {path: string}) => row.path)).size, 219);
  assert.equal(stable.files.reduce((sum: number, row: {bytes: number}) => sum + row.bytes, 0), 328819057);
  assert.equal(stable.files.find((row: {path: string}) => row.path === 'source.zip').sha256, '322279609e56006279fd1c60e1f3cf518cc985dc2b3ca8358ee90bda49a7e4de');
});

test('the CI successor preserves every music endpoint and historical source identity without replacing old hashes', () => {
  const predecessor = musicReview();
  for (const [path, row] of Object.entries(predecessor.changes)) {
    assert.equal(sha(restoreCiBuildDeploymentBytes(path, read(path))), row.currentSha256, path + ' exact music-era endpoint');
    assert.equal(sha(restoreMusicBytes(path, read(path))), row.previousSha256, path + ' exact original pre-music bytes');
    assert.equal(musicHash(path, row.previousSha256), sha(readFileSync(path)), path + ' complete current music/CI chain');
  }
  for (const [path, row] of Object.entries(predecessor.additions)) {
    const bytes = Object.hasOwn(review.changes, path) ? restoreCiBuildDeploymentBytes(path, read(path)) : readFileSync(path);
    assert.equal(sha(bytes), row.sha256, path + ' exact music addition retained');
  }
  const frozen = JSON.parse(read('tests/fixtures/airfield-enrichment-original-inventory.json')).sourceInventory;
  for (const [path, incoming] of Object.entries(frozen)) assert.equal(airfieldReviewedHash(path, incoming), sha(readFileSync(path)), path + ' complete exact original-to-current chain');
  for (const hashes of [gardenAuditHashes(), airfieldAuditHashes()]) {
    for (const path of [...ciBuildDeploymentAuditDependencies(), ...musicAuditDependencies()]) assert.equal(hashes[path], sha(readFileSync(path)), path + ' complete current audit closure');
  }
});

test('altered proof permissions, scope, hunk positions, hashes and protected evidence are rejected', () => {
  assert.throws(() => assertCiBuildDeploymentReviewBytes(read(CI_BUILD_DEPLOYMENT_REVIEW_PATH) + ' '));
  for (const mutate of [
    (copy: typeof review) => { copy.baselineCommit = '0'.repeat(40); },
    (copy: typeof review) => { copy.baselineTree = '0'.repeat(40); },
    (copy: typeof review) => { copy.baselineFileCount++; },
    (copy: typeof review) => { copy.changes['src/unreviewed.ts'] = structuredClone(Object.values(copy.changes)[0]); },
    (copy: typeof review) => { Object.values(copy.changes)[0].hunks[0].insertedLines.push('unreviewed\n'); },
    (copy: typeof review) => { Object.values(copy.changes)[0].hunks[0].afterStart++; },
    (copy: typeof review) => { Object.values(copy.changes)[0].previousSha256 = 'f'.repeat(64); },
    (copy: typeof review) => { Object.values(copy.additions)[0].sha256 = 'f'.repeat(64); },
    (copy: typeof review) => { copy.protectedFiles['docs/stable-pages-manifest.json'] = 'f'.repeat(64); },
    (copy: typeof review) => { copy.protectedFiles[MUSIC_REVIEW_PATH] = 'f'.repeat(64); },
    (copy: typeof review) => { delete copy.protectedFiles['.github/workflows/pages-stable.yml']; },
  ]) { const copy = structuredClone(review); mutate(copy); assert.throws(() => assertCiBuildDeploymentReviewBytes(JSON.stringify(copy))); }
});
