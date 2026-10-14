import {STABLE_PAGES_V100_REPIN_REVIEW_PATH, stablePagesV100RepinReview, stablePagesV100RepinHash, restoreStablePagesV100RepinBytes} from './helpers/stable-pages-v100-repin-reviewed-revisions';
import {V100_REVIEW_PATH, v100Review, v100Hash, v100SourcePaths, restoreV100Bytes} from './helpers/v100-reviewed-revisions';
import {QUALITY_TIER_REVIEW_PATH} from './helpers/quality-tier-reviewed-revisions';
import {CI_BUILD_DEPLOYMENT_REVIEW_PATH} from './helpers/ci-build-deployment-reviewed-revisions';
import {MUSIC_REVIEW_PATH, musicHash, musicPathsWithin, restoreMusicBytes, musicAddedPaths} from './helpers/music-reviewed-revisions';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {validateManifest} from '../scripts/compose-dev-pages.mjs';
import {
  STABLE_PAGES_V050_REPIN_BASELINE_COMMIT, STABLE_PAGES_V050_REPIN_BASELINE_TREE,
  STABLE_PAGES_V050_REPIN_REVIEW_PATH, STABLE_PAGES_V050_REPIN_REVIEW_SHA256,
  STABLE_PAGES_V050_REPIN_MANIFEST_PATH, STABLE_PAGES_V050_REPIN_BRIDGE_PATHS, STABLE_PAGES_V050_REPIN_TEST_ADDITIONS,
  stablePagesV050RepinSha as sha, stablePagesV050RepinReview, assertStablePagesV050RepinReviewBytes,
  stablePagesV050RepinHash, stablePagesV050RepinPathsWithin, restoreStablePagesV050RepinBytes, stablePagesV050RepinAuditDependencies,
} from './helpers/stable-pages-v050-repin-reviewed-revisions';
import {staticMenuArtReview, staticMenuArtHash, restoreStaticMenuArtBytes, staticMenuArtAuditDependencies} from './helpers/static-menu-art-reviewed-revisions';
import {inputModeReview, inputModeHash, restoreInputModeBytes} from './helpers/input-mode-reviewed-revisions';
import {touchOpacityReview, touchOpacityHash, restoreTouchOpacityBytes} from './helpers/touch-opacity-reviewed-revisions';
import {loadingGuideReview, loadingGuideHash, restoreLoadingGuideBytes} from './helpers/loading-guide-reviewed-revisions';
import {mobileControlsReview, mobileControlsHash, restoreMobileControlsBytes} from './helpers/mobile-controls-reviewed-revisions';
import {menuPresentationReview, menuPresentationHash, restoreMenuPresentationBytes} from './helpers/menu-presentation-reviewed-revisions';
import {stablePagesRepinReview, stablePagesRepinHash, restoreStablePagesRepinBytes} from './helpers/stable-pages-repin-reviewed-revisions';
import {gardenAuditHashes} from './helpers/garden-enrichment-source-stability';
import {airfieldAuditHashes} from './helpers/airfield-enrichment-source-stability';

const read = (path: string) => readFileSync(path, 'utf8');
const review = stablePagesV050RepinReview();
const stablePath = STABLE_PAGES_V050_REPIN_MANIFEST_PATH;
const walk = (dir: string): string[] => readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? walk(dir + '/' + entry.name) : [dir + '/' + entry.name]);

test('v0.5.0 repin identifies the exact approved main artifact and complete reviewed stable root', () => {
  assert.equal(STABLE_PAGES_V050_REPIN_BASELINE_COMMIT, '16dd2d0540e300de6e85aa816e73ed94d4e796c0');
  assert.equal(STABLE_PAGES_V050_REPIN_BASELINE_TREE, 'e015babf38607c3fcd0742dd8666c43a3c86f8bc');
  assert.equal(sha(read(STABLE_PAGES_V050_REPIN_REVIEW_PATH)), STABLE_PAGES_V050_REPIN_REVIEW_SHA256);
  const raw = read(stablePath), bytes = restoreStablePagesV100RepinBytes(stablePath, raw), manifest = validateManifest(JSON.parse(bytes));
  const {files, ...metadata} = manifest;
  assert.deepEqual(metadata, review.currentPublication);
  assert.equal(sha(bytes), review.changes[stablePath].currentSha256);
  assert.equal(files.length, review.currentStableFileCount);
  assert.equal(new Set(files.map(row => row.path)).size, review.currentStableFileCount);
  assert.equal(files.reduce((sum, row) => sum + row.bytes, 0), review.currentStableTotalBytes);
  assert.deepEqual(files.map(row => row.path), files.map(row => row.path).sort(), 'Complete stable inventory is uniquely and canonically ordered');
  assert.ok(files.every(row => !row.path.startsWith('dev/') && !row.path.split('/').some(part => part.startsWith('.'))));
  for (const path of ['source.zip', 'menu-art/title-logo.png', 'menu-art/whale-maid.png', 'map-previews/airfield.webp']) {
    assert.equal(files.filter(row => row.path === path).length, 1, path + ' exact published v0.5.0 entry');
  }
  assert.deepEqual(files.find(row => row.path === 'source.zip'), {
    path: 'source.zip', bytes: 32559340, sha256: '322279609e56006279fd1c60e1f3cf518cc985dc2b3ca8358ee90bda49a7e4de',
  }, 'Exact corresponding-source archive from the independently rebuilt approved commit');
  const previousBytes = restoreStablePagesV050RepinBytes(stablePath, raw), previous = validateManifest(JSON.parse(previousBytes));
  const {files: oldFiles, ...oldMetadata} = previous;
  assert.deepEqual(oldMetadata, review.previousPublication);
  assert.equal(sha(previousBytes), '5387aa54b2f677be0e912ff83e0e5237954d967b837e82f02ad7c172fa711add');
  assert.equal(Buffer.byteLength(previousBytes), 37147);
  assert.equal(oldFiles.length, 216);
  assert.equal(oldFiles.reduce((sum, row) => sum + row.bytes, 0), 322349659);
  assert.deepEqual(oldFiles.find(row => row.path === 'source.zip'), {
    path: 'source.zip', bytes: 29339231, sha256: '63a7166aff8da917915c34830e4b7db165a25b6312b5c3da2246b4ad0c2c2d78',
  });
  const oldest = JSON.parse(restoreStablePagesRepinBytes(stablePath, raw));
  assert.equal(oldest.stableCommit, '5f62027a3670056e5d7d366e9c149aa47c04953f');
  assert.equal(oldest.files.length, 138);
  assert.equal(sha(restoreStablePagesRepinBytes(stablePath, raw)), 'fcdbfe313018b83a1e1d85ba7af800438dbe43440557c4d5a5cc27c22ec00802');
});

test('only the manifest and seven bounded audit bridges change, with exact complete inverse and forward proofs', () => {
  assert.deepEqual(Object.keys(review.changes), [stablePath, ...STABLE_PAGES_V050_REPIN_BRIDGE_PATHS]);
  assert.deepEqual(Object.keys(review.additions), [...STABLE_PAGES_V050_REPIN_TEST_ADDITIONS]);
  assert.deepEqual(Object.keys(review.changes).filter(path => !path.startsWith('tests/')), [stablePath], 'No runtime, workflow, legal or packaging changes');
  for (const [path, row] of Object.entries(review.changes)) {
    const raw = read(path), current = restoreMusicBytes(path, raw), previous = restoreStablePagesV050RepinBytes(path, raw);
    assert.equal(sha(current), row.currentSha256, path); assert.equal(sha(previous), row.previousSha256, path);
    const lines = previous.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    for (const hunk of [...row.hunks].reverse()) {
      assert.deepEqual(lines.slice(hunk.beforeStart, hunk.beforeStart + hunk.removedLines.length), hunk.removedLines, path);
      lines.splice(hunk.beforeStart, hunk.removedLines.length, ...hunk.insertedLines);
    }
    assert.equal(lines.join(''), current, path + ' complete exact forward reconstruction');
    for (const invalid of [raw + ' ', raw.slice(1), previous]) {
      assert.throws(() => restoreStablePagesV050RepinBytes(path, invalid), undefined, path + ' no altered-byte or historical-byte fallback');
    }
  }
  for (const [path, row] of Object.entries(review.additions)) assert.equal(sha(restoreMusicBytes(path, read(path))), row.sha256, path + ' exact new audit');
});

test('the v0.5.0 bridge only advances exact path and old-hash pairs and rejects all changed permission records', () => {
  for (const [path, row] of Object.entries(review.changes)) {
    assert.equal(stablePagesV050RepinHash(path, row.previousSha256), musicHash(path, row.currentSha256));
    for (const incoming of [undefined, '', '0'.repeat(64), row.currentSha256]) assert.throws(() => stablePagesV050RepinHash(path, incoming), undefined, path);
    for (const alias of ['./' + path, path + '/extra', path.replace('/', '//')]) assert.equal(stablePagesV050RepinHash(alias, row.previousSha256), row.previousSha256);
  }
  for (const path of ['src/menu.ts', 'src/game.ts', '.github/workflows/pages-stable.yml']) {
    assert.throws(() => stablePagesV050RepinHash(path, 'unchanged'), undefined, 'Reviewed successor requires exact incoming identity');
    assert.throws(() => restoreStablePagesV050RepinBytes(path, 'unchanged'), undefined, 'Reviewed successor requires exact current bytes');
  }
  for (const path of ['src/race-controls.ts', 'src/race-camera.ts', 'scripts/package-source.mjs', 'public/source.html', 'docs/airfield-enrichment-qa-files.json']) {
    assert.equal(stablePagesV050RepinHash(path, 'unchanged'), 'unchanged');
    assert.equal(restoreStablePagesV050RepinBytes(path, 'unchanged'), 'unchanged');
  }
  assert.throws(() => assertStablePagesV050RepinReviewBytes(read(STABLE_PAGES_V050_REPIN_REVIEW_PATH) + ' '));
  for (const mutate of [
    (copy: typeof review) => { copy.baselineCommit = '0'.repeat(40); },
    (copy: typeof review) => { copy.currentPublication.stableCommit = 'f'.repeat(40); },
    (copy: typeof review) => { copy.currentPublication.workflowRunId++; },
    (copy: typeof review) => { copy.currentPublication.artifactId++; },
    (copy: typeof review) => { copy.currentPublication.artifactSha256 = 'f'.repeat(64); },
    (copy: typeof review) => { copy.publicationEvidence.tarFilesSha256 = 'f'.repeat(64); },
    (copy: typeof review) => { copy.publicationEvidence.fullArtifactArchiveDownloaded = true; },
    (copy: typeof review) => { copy.currentStableFileCount++; },
    (copy: typeof review) => { copy.currentStableTotalBytes++; },
    (copy: typeof review) => { copy.changes[stablePath].hunks[0].removedLines.push('unreviewed\n'); },
    (copy: typeof review) => { copy.changes[stablePath].hunks[0].afterStart++; },
    (copy: typeof review) => { copy.changes['src/unreviewed.ts'] = structuredClone(copy.changes[stablePath]); },
    (copy: typeof review) => { copy.protectedFiles['tests/helpers/static-menu-art-transition.json'] = 'f'.repeat(64); },
    (copy: typeof review) => { delete copy.protectedFiles['tests/helpers/mobile-controls-protected-evidence.json']; },
    (copy: typeof review) => { copy.additions[STABLE_PAGES_V050_REPIN_TEST_ADDITIONS[0]].sha256 = 'f'.repeat(64); },
  ]) { const copy = structuredClone(review); mutate(copy); assert.throws(() => assertStablePagesV050RepinReviewBytes(JSON.stringify(copy))); }
});

test('all 988 baseline identities survive and every non-manifest JSON, production, legal and workflow file stays exact', () => {
  assert.equal(Object.keys(review.protectedFiles).length, 980);
  for (const [path, hash] of Object.entries(review.protectedFiles)) assert.equal(sha(readFileSync(path)), musicHash(path, hash), path + ' exact baseline or bounded music successor');
  for (const path of [
    '.github/workflows/pages-stable.yml', '.github/workflows/pages.yml',
    'LICENSE', 'NOTICE', 'MODEL-NOTICE.txt', 'FOOD-ASSET-NOTICE.txt', 'ALPINE-PROP-NOTICE.txt', 'THIRD-PARTY-NOTICES.txt', 'SOURCE.txt',
    'scripts/package-source.mjs', 'scripts/compose-dev-pages.mjs', 'public/source.html', 'package.json', 'package-lock.json',
    'docs/airfield-enrichment-qa-files.json', 'tests/helpers/mobile-controls-protected-evidence.json',
  ]) assert.ok(Object.hasOwn(review.protectedFiles, path), path + ' explicitly immutable');
  const baselinePaths = [...Object.keys(review.protectedFiles), ...Object.keys(review.changes)];
  assert.equal(new Set(baselinePaths).size, 988);
  const addedPaths = [STABLE_PAGES_V050_REPIN_REVIEW_PATH, 'tests/helpers/stable-pages-v050-repin-reviewed-revisions.ts', ...Object.keys(review.additions), ...musicAddedPaths()];
  for (const dir of ['.github', 'docs', 'models', 'public', 'scripts', 'tests']) {
    assert.deepEqual(walk(dir).sort(), [...baselinePaths, ...addedPaths].filter(path => path.startsWith(dir + '/')).sort(), dir + ' exact complete file inventory');
  }
  const currentJson = ['docs', 'tests', 'models', 'public', 'src'].flatMap(walk).filter(path => path.endsWith('.json')).sort();
  const baselineJson = baselinePaths.filter(path => path.endsWith('.json') && path.includes('/')).sort();
  assert.deepEqual(currentJson, [...baselineJson, STABLE_PAGES_V050_REPIN_REVIEW_PATH, MUSIC_REVIEW_PATH, CI_BUILD_DEPLOYMENT_REVIEW_PATH, QUALITY_TIER_REVIEW_PATH, V100_REVIEW_PATH, STABLE_PAGES_V100_REPIN_REVIEW_PATH].sort(), 'Every existing JSON retained with only the explicit successor reviews');
  for (const path of baselineJson.filter(path => path !== stablePath)) assert.ok(Object.hasOwn(review.protectedFiles, path), path + ' historical JSON cannot change');
});

test('all earlier mobile, title and publication chains retain their exact original endpoints and inverses', () => {
  for (const [proof, successorRestore, restore, hash] of [
    [staticMenuArtReview(), restoreStablePagesV050RepinBytes, restoreStaticMenuArtBytes, staticMenuArtHash],
    [inputModeReview(), restoreStaticMenuArtBytes, restoreInputModeBytes, inputModeHash],
    [touchOpacityReview(), restoreInputModeBytes, restoreTouchOpacityBytes, touchOpacityHash],
    [loadingGuideReview(), restoreTouchOpacityBytes, restoreLoadingGuideBytes, loadingGuideHash],
    [mobileControlsReview(), restoreLoadingGuideBytes, restoreMobileControlsBytes, mobileControlsHash],
    [menuPresentationReview(), restoreMobileControlsBytes, restoreMenuPresentationBytes, menuPresentationHash],
  ] as const) {
    for (const [path, row] of Object.entries(proof.changes)) {
      const current = read(path);
      assert.equal(sha(successorRestore(path, current)), row.currentSha256, path + ' original reviewed endpoint retained');
      assert.equal(sha(restore(path, current)), row.previousSha256, path + ' original baseline reconstructed');
      assert.equal(hash(path, row.previousSha256), sha(current), path + ' complete current identity chain');
    }
  }
  for (const [path, row] of Object.entries(stablePagesRepinReview().changes)) {
    const current = read(path);
    assert.equal(sha(restoreMobileControlsBytes(path, current)), row.currentSha256, path + ' original stable endpoint');
    assert.equal(sha(restoreStablePagesRepinBytes(path, current)), row.previousSha256, path + ' original pre-stable bytes');
    assert.equal(mobileControlsHash(path, stablePagesRepinHash(path, row.previousSha256)), sha(current), path + ' complete stable-to-current chain');
  }
});

test('every original protected-evidence manifest remains intact with exact predecessor and current publication proof', () => {
  const protectedManifests = [
    JSON.parse(read('tests/helpers/mobile-controls-protected-evidence.json')) as Record<string, string>,
    touchOpacityReview().protectedEvidence, inputModeReview().protectedEvidence, staticMenuArtReview().protectedEvidence,
  ];
  for (const protectedFiles of protectedManifests) {
    assert.equal(protectedFiles[stablePath], '5387aa54b2f677be0e912ff83e0e5237954d967b837e82f02ad7c172fa711add');
    for (const [path, hash] of Object.entries(protectedFiles)) {
      assert.equal(sha(readFileSync(path)), stablePagesV050RepinHash(path, hash), path + ' exact protected-evidence successor');
      if (Object.hasOwn(review.changes, path)) assert.equal(sha(restoreStablePagesV050RepinBytes(path, read(path))), hash, path + ' original protected bytes retained');
    }
  }
});

test('both source-stability closures include every new proof and bounded bridge while original inventories stay immutable', () => {
  const inventory = JSON.parse(read('tests/fixtures/airfield-enrichment-original-inventory.json')).sourceInventory;
  assert.deepEqual(stablePagesV050RepinPathsWithin(inventory), [...new Set([stablePath, ...musicPathsWithin(inventory)])]);
  assert.deepEqual(stablePagesV050RepinPathsWithin({[stablePath]: 'old', ['./' + stablePath]: 'alias', 'src/game.ts': 'unchanged'}), [stablePath, 'src/game.ts']);
  for (const hashes of [gardenAuditHashes(), airfieldAuditHashes()]) {
    for (const path of [...stablePagesV050RepinAuditDependencies(), ...staticMenuArtAuditDependencies()]) assert.equal(hashes[path], sha(readFileSync(path)), path + ' complete current closure');
    assert.equal(hashes[stablePath], stablePagesV100RepinHash(stablePath, review.changes[stablePath].currentSha256));
  }
});
