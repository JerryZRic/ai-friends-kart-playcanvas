import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateManifest} from '../scripts/compose-dev-pages.mjs';
import {
  STABLE_PAGES_REPIN_REVIEW_PATH, STABLE_PAGES_REPIN_REVIEW_SHA256,
  STABLE_PAGES_REPIN_BASELINE_COMMIT, STABLE_PAGES_REPIN_PUBLIC_BASELINE_COMMIT,
  STABLE_PAGES_REPIN_BASELINE_TREE, STABLE_PAGES_REPIN_PATHS,
  stablePagesRepinSha as sha, stablePagesRepinReview, assertStablePagesRepinReviewBytes,
  stablePagesRepinHash, assertStablePagesRepinDependency, stablePagesRepinPathsWithin,
  restoreStablePagesRepinBytes, stablePagesRepinAuditDependencies,
} from './helpers/stable-pages-repin-reviewed-revisions';
import {menuPresentationHash, menuPresentationAuditDependencies, MENU_PRESENTATION_REVIEW_PATH, MENU_PRESENTATION_REVIEW_SHA256} from './helpers/menu-presentation-reviewed-revisions';
import {airfieldAfterGardenHash, airfieldReviewedHash} from './helpers/airfield-enrichment-reviewed-revisions';
import {gardenAuditHashes} from './helpers/garden-enrichment-source-stability';
import {airfieldAuditHashes} from './helpers/airfield-enrichment-source-stability';

const read = (path: string) => readFileSync(path, 'utf8');
const review = stablePagesRepinReview();
const stablePath = 'docs/stable-pages-manifest.json';
const portablePath = 'docs/airfield-enrichment-qa-files.json';

test('stable repin identifies the exact successful main artifact and all 216 published root files', () => {
  assert.equal(STABLE_PAGES_REPIN_BASELINE_COMMIT, '58a3452177acd1e1a2d84e019f014c778f834d89');
  assert.equal(STABLE_PAGES_REPIN_PUBLIC_BASELINE_COMMIT, '6844110cb77bb5b71041786f1802217766a8f759');
  assert.equal(STABLE_PAGES_REPIN_BASELINE_TREE, 'eac91a077f6a27e21f9d3a48039c302a16b4ed2a');
  const bytes = read(stablePath), manifest = validateManifest(JSON.parse(bytes));
  assert.equal(sha(bytes), '5387aa54b2f677be0e912ff83e0e5237954d967b837e82f02ad7c172fa711add');
  assert.equal(Buffer.byteLength(bytes), 37147);
  const {files, ...metadata} = manifest;
  assert.deepEqual(metadata, review.currentPublication);
  assert.equal(files.length, 216);
  assert.equal(files.reduce((sum, row) => sum + row.bytes, 0), 322349659);
  assert.equal(new Set(files.map(row => row.path)).size, 216);
  assert.ok(files.every(row => !row.path.startsWith('dev/') && !row.path.split('/').some(part => part.startsWith('.'))));
  assert.deepEqual(files.find(row => row.path === 'source.zip'), {
    path: 'source.zip', bytes: 29339231, sha256: '63a7166aff8da917915c34830e4b7db165a25b6312b5c3da2246b4ad0c2c2d78',
  });
  const previous = JSON.parse(restoreStablePagesRepinBytes(stablePath, bytes));
  const {files: oldFiles, ...oldMetadata} = previous;
  assert.deepEqual(oldMetadata, review.previousPublication);
  assert.equal(oldFiles.length, 138);
  assert.equal(previous.stableCommit, '5f62027a3670056e5d7d366e9c149aa47c04953f');
});

test('all three repin changes reconstruct exact historical bytes and exact complete forward round trips', () => {
  assert.deepEqual(Object.keys(review.changes), [...STABLE_PAGES_REPIN_PATHS]);
  for (const [path, row] of Object.entries(review.changes)) {
    const current = read(path), original = restoreStablePagesRepinBytes(path, current);
    assert.equal(sha(current), row.currentSha256, path);
    assert.equal(sha(original), row.previousSha256, path);
    const lines = original.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    for (const hunk of [...row.hunks].reverse()) {
      assert.deepEqual(lines.slice(hunk.beforeStart, hunk.beforeStart + hunk.removedLines.length), hunk.removedLines, path);
      lines.splice(hunk.beforeStart, hunk.removedLines.length, ...hunk.insertedLines);
    }
    assert.equal(lines.join(''), current, path + ' full exact forward reconstruction');
    assert.throws(() => restoreStablePagesRepinBytes(path, current + ' '), undefined, path);
    assert.throws(() => restoreStablePagesRepinBytes(path, original), undefined, path + ' no old-byte fallback');
  }
  assert.equal(review.changes[stablePath].previousSha256, 'fcdbfe313018b83a1e1d85ba7af800438dbe43440557c4d5a5cc27c22ec00802');
  assert.equal(review.changes['tests/helpers/menu-presentation-reviewed-revisions.ts'].previousSha256, '8d90743567f9f8a7bf88cda4245df6347a4f0d4529f053dc9833295650437c1a');
  assert.equal(review.changes['tests/audit-menu-presentation-transition.test.ts'].previousSha256, '34383bda22d59b832cede2d154daaa150dad668a13b2aced8f9ec5c3c630636b');
});

test('only exact incoming/current pairs pass and aliases or unlisted paths remain unchanged', () => {
  for (const [path, row] of Object.entries(review.changes)) {
    assert.equal(stablePagesRepinHash(path, row.previousSha256), row.currentSha256);
    assert.equal(menuPresentationHash(path, row.previousSha256), row.currentSha256);
    assertStablePagesRepinDependency(path, row.previousSha256, row.currentSha256);
    for (const incoming of [undefined, '0'.repeat(64), row.currentSha256]) {
      assert.throws(() => stablePagesRepinHash(path, incoming), undefined, path);
      assert.throws(() => menuPresentationHash(path, incoming), undefined, path);
    }
    for (const current of ['', 'f'.repeat(64), row.previousSha256]) {
      assert.throws(() => assertStablePagesRepinDependency(path, row.previousSha256, current), undefined, path);
    }
  }
  const stable = review.changes[stablePath];
  for (const path of ['./docs/stable-pages-manifest.json', stablePath + '/extra', 'src/menu.ts', 'src/unlisted.ts', portablePath]) {
    assert.equal(stablePagesRepinHash(path, 'unchanged'), 'unchanged');
    assert.throws(() => assertStablePagesRepinDependency(path, stable.previousSha256, stable.currentSha256), undefined, path);
  }
});

test('the repin record rejects altered publication identities, hidden paths, hunks, and unlisted permissions', () => {
  const bytes = read(STABLE_PAGES_REPIN_REVIEW_PATH);
  assert.equal(sha(bytes), STABLE_PAGES_REPIN_REVIEW_SHA256);
  assert.throws(() => assertStablePagesRepinReviewBytes(bytes + ' '));
  for (const mutate of [
    (copy: typeof review) => { copy.currentPublication.stableCommit = 'f'.repeat(40); },
    (copy: typeof review) => { copy.currentPublication.artifactSha256 = 'f'.repeat(64); },
    (copy: typeof review) => { copy.changes[stablePath].currentSha256 = 'f'.repeat(64); },
    (copy: typeof review) => { copy.changes[stablePath].hunks[0].removedLines[0] += ' '; },
    (copy: typeof review) => { copy.changes['src/unlisted.ts'] = structuredClone(copy.changes[stablePath]); },
    (copy: typeof review) => { copy.currentStableFileCount++; },
  ]) {
    const copy = structuredClone(review); mutate(copy);
    assert.throws(() => assertStablePagesRepinReviewBytes(JSON.stringify(copy)));
  }
  const manifest = JSON.parse(read(stablePath));
  for (const path of ['.nojekyll', 'dev/index.html', '../index.html', '.git/config']) {
    const changed = structuredClone(manifest); changed.files[0].path = path;
    assert.throws(() => validateManifest(changed), undefined, path);
  }
});

test('complete Garden and Airfield original inventories retain all exact historical and reviewed identities', () => {
  for (const [name, fixtureSha, apply] of [
    ['garden', 'ee38acf0339c017150d2ed99a70ebaf2bf4ea5555dd8beb3ea7a47647a1c26d4', airfieldAfterGardenHash],
    ['airfield', '803c61344abe2f97fb9acaaf8c5960f64036938fff7e1248d8263e1db332b6cf', airfieldReviewedHash],
  ] as const) {
    const bytes = read(`tests/fixtures/${name}-enrichment-original-inventory.json`);
    assert.equal(sha(bytes), fixtureSha);
    const inventory = JSON.parse(bytes).sourceInventory;
    assert.deepEqual(stablePagesRepinPathsWithin(inventory), [stablePath]);
    for (const [path, incoming] of Object.entries(inventory)) assert.equal(sha(readFileSync(path)), apply(path, incoming), name + ' ' + path);
  }
  assert.equal(sha(read(MENU_PRESENTATION_REVIEW_PATH)), MENU_PRESENTATION_REVIEW_SHA256);
  assert.equal(MENU_PRESENTATION_REVIEW_SHA256, '65a635b8628717ef43f89779b8799fea5c874c1ee6d106ef273a5aa0a7352283');
  for (const [path, hash] of Object.entries({
    'tests/fixtures/garden-enrichment-reviewed-changes.json': '0bf147bda5bf2d63dbce87a5b5ad09e1dc24406c2d9fb39bc0c5573565a11813',
    'tests/fixtures/airfield-enrichment-reviewed-changes.json': 'b036ddf5cd27fdd7dcb18a38715ea45c7ef426101ebcac77009c0e2f7dd44324',
    'tests/helpers/garden-enrichment-camera-frozen.json': '06c49fb8e7e4161c2be0380f887246cc6539a5792e0440c4adfc0dc92fb2d598',
    'tests/helpers/airfield-enrichment-camera-frozen.json': '3e9b75eef6f98647fbc3813ce5248d0a6805b7668bdc46626e79f7e3959c333a',
    'tests/fixtures/garden-enrichment-camera-outputs.json': '8cdac054678a3f529619dcf0d93d45f6bc0ba592b063bbf2b118d99dc229c900',
    'tests/fixtures/airfield-enrichment-camera-outputs.json': '596e883062ddd1683ebae3f3aedfcdae4bf04e7faf8100af15003674a5b39f67',
  })) assert.equal(sha(readFileSync(path)), hash, path + ' immutable original evidence');
});

test('the current Airfield closure is complete, excludes self-hashes, and restores its exact earlier manifest', () => {
  const manifest = JSON.parse(read(portablePath)), section = manifest.stablePagesRepin;
  assert.deepEqual(Object.keys(section), ['schema', 'baselineCommit', 'publicBaselineCommit', 'baselineTree', 'previousManifestSha256', 'transitionPath', 'transitionSha256', 'currentFileSha256']);
  assert.equal(section.schema, 'stable-pages-repin-current-closure-v1');
  assert.equal(section.baselineCommit, STABLE_PAGES_REPIN_BASELINE_COMMIT);
  assert.equal(section.publicBaselineCommit, STABLE_PAGES_REPIN_PUBLIC_BASELINE_COMMIT);
  assert.equal(section.baselineTree, STABLE_PAGES_REPIN_BASELINE_TREE);
  assert.equal(section.previousManifestSha256, review.previousAirfieldManifestSha256);
  assert.equal(section.transitionPath, STABLE_PAGES_REPIN_REVIEW_PATH);
  assert.equal(section.transitionSha256, STABLE_PAGES_REPIN_REVIEW_SHA256);
  const restored = structuredClone(manifest); delete restored.stablePagesRepin;
  assert.equal(sha(JSON.stringify(restored, null, 2) + '\n'), review.previousAirfieldManifestSha256, 'Every earlier ledger field and value is preserved');
  const required = [...new Set([...Object.keys(manifest.finalFileSha256), ...menuPresentationAuditDependencies()])].filter(path => path !== portablePath).sort();
  assert.deepEqual(Object.keys(section.currentFileSha256).sort(), required);
  assert.ok(!Object.hasOwn(section.currentFileSha256, portablePath), 'No self-referential closure digest');
  for (const [path, hash] of Object.entries(section.currentFileSha256)) assert.equal(sha(readFileSync(path)), hash, path + ' exact current closure');
  for (const [path, hash] of Object.entries(manifest.finalFileSha256)) assert.equal(section.currentFileSha256[path], menuPresentationHash(path, hash), path + ' complete historical-to-current provenance');
  for (const path of stablePagesRepinAuditDependencies().filter(path => path !== portablePath)) assert.ok(Object.hasOwn(section.currentFileSha256, path), path + ' repin proof dependency');
});

test('both camera stability snapshots capture every repin proof dependency and the complete current closure', () => {
  for (const hashes of [gardenAuditHashes(), airfieldAuditHashes()]) {
    for (const path of stablePagesRepinAuditDependencies()) assert.equal(hashes[path], sha(readFileSync(path)), path);
    for (const path of menuPresentationAuditDependencies()) assert.equal(hashes[path], sha(readFileSync(path)), path);
    assert.equal(hashes[stablePath], review.changes[stablePath].currentSha256);
  }
});
