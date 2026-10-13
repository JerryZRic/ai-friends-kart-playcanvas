import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {
  QUALITY_TIER_BASELINE_COMMIT, QUALITY_TIER_BASELINE_TREE,
  QUALITY_TIER_REVIEW_PATH, QUALITY_TIER_REVIEW_SHA256,
  QUALITY_TIER_PRODUCTION_PATHS, QUALITY_TIER_REGRESSION_PATHS, QUALITY_TIER_BRIDGE_PATHS, QUALITY_TIER_ADDITIONS,
  qualityTierSha as sha, qualityTierReview, assertQualityTierReviewBytes,
  qualityTierHash, qualityTierPathsWithin, restoreQualityTierBytes,
  assertQualityTierAddition, qualityTierAddedPaths, qualityTierAuditDependencies,
} from './helpers/quality-tier-reviewed-revisions';
import {
  CI_BUILD_DEPLOYMENT_REVIEW_PATH, CI_BUILD_DEPLOYMENT_REVIEW_SHA256,
  ciBuildDeploymentReview, ciBuildDeploymentHash, restoreCiBuildDeploymentBytes, ciBuildDeploymentAuditDependencies,
} from './helpers/ci-build-deployment-reviewed-revisions';
import {airfieldReviewedHash} from './helpers/airfield-enrichment-reviewed-revisions';
import {gardenAuditHashes} from './helpers/garden-enrichment-source-stability';
import {airfieldAuditHashes} from './helpers/airfield-enrichment-source-stability';
const read = (path: string) => readFileSync(path, 'utf8');
const review = qualityTierReview();
const walk = (dir: string): string[] => readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? walk(dir + '/' + entry.name) : [dir + '/' + entry.name]);
const baselinePaths = [...Object.keys(review.protectedFiles), ...Object.keys(review.changes)];

// Independently encode the Git tree from actual reconstructed file bytes.
// No Git checkout, old-hash replacement, mutable ref or remote request is trusted.
function baselineGitTree() {
  type Tree = {[name: string]: Tree | Buffer};
  const root: Tree = {};
  const object = (kind: string, bytes: Buffer) => createHash('sha1').update(kind + ' ' + bytes.length + '\0').update(bytes).digest();
  for (const path of baselinePaths) {
    const bytes = Object.hasOwn(review.changes, path) ? Buffer.from(restoreQualityTierBytes(path, read(path))) : readFileSync(path);
    const parts = path.split('/'); let dir = root;
    for (const part of parts.slice(0, -1)) dir = (dir[part] ??= {}) as Tree;
    dir[parts.at(-1)!] = object('blob', bytes);
  }
  const encode = (tree: Tree): Buffer => object('tree', Buffer.concat(Object.entries(tree)
    .sort(([a, x], [b, y]) => Buffer.compare(Buffer.from(a + (Buffer.isBuffer(x) ? '' : '/')), Buffer.from(b + (Buffer.isBuffer(y) ? '' : '/'))))
    .map(([name, item]) => Buffer.concat([Buffer.from((Buffer.isBuffer(item) ? '100644' : '40000') + ' ' + name + '\0'), Buffer.isBuffer(item) ? item : encode(item)]))));
  return encode(root).toString('hex');
}

test('quality tiers reconstruct the full exact compiled-preview dev baseline and complete bounded inventory', () => {
  assert.equal(QUALITY_TIER_BASELINE_COMMIT, '7eee4e5fc37058902bc280d3801bd264e742c83c');
  assert.equal(QUALITY_TIER_BASELINE_TREE, '2f2e17e6cd906eeab5f10b9699933a2ad5a4663b');
  assert.equal(sha(read(QUALITY_TIER_REVIEW_PATH)), QUALITY_TIER_REVIEW_SHA256);
  assert.equal(new Set(baselinePaths).size, 1012);
  assert.equal(baselineGitTree(), QUALITY_TIER_BASELINE_TREE, 'Every original byte reconstructs the independently anchored baseline Git tree');
  assert.deepEqual(Object.keys(review.changes), [...QUALITY_TIER_PRODUCTION_PATHS, ...QUALITY_TIER_REGRESSION_PATHS, ...QUALITY_TIER_BRIDGE_PATHS]);
  assert.deepEqual(Object.keys(review.additions), [...QUALITY_TIER_ADDITIONS]);
  for (const dir of ['.github', 'docs', 'models', 'public', 'scripts', 'src', 'tests']) {
    assert.deepEqual(walk(dir).sort(), [...baselinePaths, ...qualityTierAddedPaths()].filter(path => path.startsWith(dir + '/')).sort(), dir + ' complete exact baseline and addition inventory');
  }
  assert.deepEqual(readdirSync('.', {withFileTypes: true}).filter(entry => entry.isFile()).map(entry => entry.name).sort(), baselinePaths.filter(path => !path.includes('/')).sort(), 'All project root files remain exact and no root additions are permitted');
});

test('each policy or audit bridge is exactly reversible and rejects altered bytes and wrong incoming identities', () => {
  for (const [path, row] of Object.entries(review.changes)) {
    const current = read(path), previous = restoreQualityTierBytes(path, current);
    assert.equal(sha(current), row.currentSha256); assert.equal(sha(previous), row.previousSha256);
    const lines = previous.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    for (const hunk of [...row.hunks].reverse()) {
      assert.deepEqual(lines.slice(hunk.beforeStart, hunk.beforeStart + hunk.removedLines.length), hunk.removedLines, path + ' exact removed bytes');
      lines.splice(hunk.beforeStart, hunk.removedLines.length, ...hunk.insertedLines);
    }
    assert.equal(lines.join(''), current, path + ' complete exact forward reconstruction');
    assert.equal(qualityTierHash(path, row.previousSha256), row.currentSha256);
    for (const altered of [current + ' ', current.slice(1), previous]) assert.throws(() => restoreQualityTierBytes(path, altered), undefined, path);
    for (const incoming of [undefined, '', '0'.repeat(64), row.currentSha256]) assert.throws(() => qualityTierHash(path, incoming), undefined, path);
    for (const alias of ['./' + path, path + '/extra', path.replace('/', '//')]) {
      assert.equal(qualityTierHash(alias, row.previousSha256), row.previousSha256, alias + ' cannot claim a reviewed successor');
      assert.equal(restoreQualityTierBytes(alias, 'unreviewed'), 'unreviewed', alias + ' cannot invoke an inverse');
    }
  }
  assert.deepEqual(qualityTierPathsWithin({'.github/workflows/pages-stable.yml': 'old', './.github/workflows/pages-stable.yml': 'alias', '.github/workflows/pages.yml': 'unchanged', 'src/game.ts': 'unchanged'}), ['.github/workflows/pages-stable.yml']);
});

test('the new release workflow, selector, documentation and regression tools have exact named bytes', () => {
  for (const [path, row] of Object.entries(review.additions)) {
    const bytes = readFileSync(path); assert.equal(sha(bytes), row.sha256); assertQualityTierAddition(path, bytes);
    assert.throws(() => assertQualityTierAddition(path, Buffer.concat([bytes, Buffer.from(' ')])));
    for (const alias of ['./' + path, path + '/extra', path.replace('/', '//')]) assert.throws(() => assertQualityTierAddition(alias, bytes));
  }
  assert.throws(() => assertQualityTierAddition('scripts/unreviewed.mjs', 'unreviewed'));
});

test('all existing JSON, dev workflow, game bytes, assets, legal files and pinned stable publication remain immutable', () => {
  for (const [path, hash] of Object.entries(review.protectedFiles)) assert.equal(sha(readFileSync(path)), hash, path + ' immutable original bytes');
  for (const prefix of ['src/', 'public/', 'models/', 'docs/', 'tests/fixtures/']) {
    assert.ok(baselinePaths.filter(path => path.startsWith(prefix)).every(path => Object.hasOwn(review.protectedFiles, path)), prefix + ' no existing runtime, asset or evidence revisions');
  }
  for (const path of ['.github/workflows/pages.yml', 'docs/stable-pages-manifest.json', 'package.json', 'package-lock.json', 'scripts/package-source.mjs', 'scripts/verify-dist.mjs', 'scripts/compose-dev-pages.mjs', 'scripts/verified-build-artifact.mjs', 'LICENSE', 'NOTICE', 'MODEL-NOTICE.txt', 'FOOD-ASSET-NOTICE.txt', 'ALPINE-PROP-NOTICE.txt', 'THIRD-PARTY-NOTICES.txt', 'SOURCE.txt', 'public/source.html', CI_BUILD_DEPLOYMENT_REVIEW_PATH]) assert.ok(Object.hasOwn(review.protectedFiles, path), path + ' explicitly immutable');
  const allOriginalJson = baselinePaths.filter(path => path.endsWith('.json'));
  assert.ok(allOriginalJson.every(path => Object.hasOwn(review.protectedFiles, path)), 'No prior proof, manifest or package JSON may change');
  const nestedJson = allOriginalJson.filter(path => path.includes('/'));
  assert.deepEqual(['docs', 'tests', 'models', 'public', 'src'].flatMap(walk).filter(path => path.endsWith('.json')).sort(), [...nestedJson, QUALITY_TIER_REVIEW_PATH].sort());
  assert.equal(sha(read(CI_BUILD_DEPLOYMENT_REVIEW_PATH)), CI_BUILD_DEPLOYMENT_REVIEW_SHA256, 'Previous CI proof stays byte-for-byte frozen');
  const workflow = read('.github/workflows/pages.yml');
  assert.match(workflow, /- run: npm run build\n/);
  assert.doesNotMatch(workflow, /npm test|test:dist|test-dev-preview|test-targeted/);
  assert.equal(JSON.parse(read('package.json')).scripts.build, 'npm run check && vite build && node scripts/package-source.mjs');
  const stable = JSON.parse(read('docs/stable-pages-manifest.json'));
  assert.equal(stable.stableCommit, '16dd2d0540e300de6e85aa816e73ed94d4e796c0');
  assert.equal(stable.files.length, 219); assert.equal(new Set(stable.files.map((row: {path: string}) => row.path)).size, 219);
  assert.equal(stable.files.reduce((sum: number, row: {bytes: number}) => sum + row.bytes, 0), 328819057);
  assert.equal(stable.files.find((row: {path: string}) => row.path === 'source.zip').sha256, '322279609e56006279fd1c60e1f3cf518cc985dc2b3ca8358ee90bda49a7e4de');
});

test('every earlier CI endpoint, source identity and audit dependency survives through exact successor bridges', () => {
  const predecessor = ciBuildDeploymentReview();
  for (const [path, row] of Object.entries(predecessor.changes)) {
    assert.equal(sha(restoreQualityTierBytes(path, read(path))), row.currentSha256, path + ' exact CI-era endpoint');
    assert.equal(sha(restoreCiBuildDeploymentBytes(path, read(path))), row.previousSha256, path + ' exact original pre-CI bytes');
    assert.equal(ciBuildDeploymentHash(path, row.previousSha256), sha(readFileSync(path)), path + ' full current CI-quality identity chain');
  }
  for (const [path, row] of Object.entries(predecessor.additions)) assert.equal(sha(restoreQualityTierBytes(path, read(path))), row.sha256, path + ' exact original CI addition');
  for (const [path, hash] of Object.entries(predecessor.protectedFiles)) assert.equal(sha(readFileSync(path)), qualityTierHash(path, hash), path + ' exact original or individually reviewed policy successor');
  const frozen = JSON.parse(read('tests/fixtures/airfield-enrichment-original-inventory.json')).sourceInventory;
  for (const [path, incoming] of Object.entries(frozen)) assert.equal(airfieldReviewedHash(path, incoming), sha(readFileSync(path)), path + ' complete exact original-to-current chain');
  for (const hashes of [gardenAuditHashes(), airfieldAuditHashes()]) {
    for (const path of [...qualityTierAuditDependencies(), ...ciBuildDeploymentAuditDependencies()]) assert.equal(hashes[path], sha(readFileSync(path)), path + ' complete current audit closure');
  }
});

test('changed proof scope, paths, hunk offsets, hashes or protected evidence cannot widen this successor', () => {
  assert.throws(() => assertQualityTierReviewBytes(read(QUALITY_TIER_REVIEW_PATH) + ' '));
  for (const mutate of [
    (copy: typeof review) => { copy.baselineCommit = '0'.repeat(40); },
    (copy: typeof review) => { copy.baselineTree = '0'.repeat(40); },
    (copy: typeof review) => { copy.baselineFileCount++; },
    (copy: typeof review) => { copy.changes['src/unreviewed.ts'] = structuredClone(Object.values(copy.changes)[0]); },
    (copy: typeof review) => { copy.changes['.github/workflows/pages.yml'] = structuredClone(Object.values(copy.changes)[0]); },
    (copy: typeof review) => { Object.values(copy.changes)[0].scope = 'Unbounded permission'; },
    (copy: typeof review) => { Object.values(copy.changes)[0].hunks[0].insertedLines.push('unreviewed\n'); },
    (copy: typeof review) => { Object.values(copy.changes)[0].hunks[0].afterStart++; },
    (copy: typeof review) => { Object.values(copy.changes)[0].previousSha256 = 'f'.repeat(64); },
    (copy: typeof review) => { Object.values(copy.additions)[0].sha256 = 'f'.repeat(64); },
    (copy: typeof review) => { copy.protectedFiles['docs/stable-pages-manifest.json'] = 'f'.repeat(64); },
    (copy: typeof review) => { copy.protectedFiles[CI_BUILD_DEPLOYMENT_REVIEW_PATH] = 'f'.repeat(64); },
    (copy: typeof review) => { delete copy.protectedFiles['.github/workflows/pages.yml']; },
  ]) { const copy = structuredClone(review); mutate(copy); assert.throws(() => assertQualityTierReviewBytes(JSON.stringify(copy))); }
});
